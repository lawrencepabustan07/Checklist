from datetime import date

from django.db.models import Count
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework import viewsets, status
from rest_framework.response import Response
from ..models import Checklist, ChecklistItem
from ..serializers import ChecklistSerializer


class ChecklistViewSet(viewsets.ModelViewSet):
    queryset = Checklist.objects.all()
    serializer_class = ChecklistSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        include_archived = self.request.query_params.get('archived') == 'true'
        queryset = Checklist.objects.filter(created_by=self.request.user)
        if not include_archived:
            queryset = queryset.filter(is_archived=False)
        return queryset

    def _ensure_admin(self, request):
        if request.user.is_staff:
            return None
        return Response(
            {
                "status": "error",
                "message": "Admin access is required for checklist management.",
            },
            status=status.HTTP_403_FORBIDDEN,
        )

    def create(self, request, *args, **kwargs):
        admin_error = self._ensure_admin(request)
        if admin_error:
            return admin_error
        name = request.data.get('name')
        if name and Checklist.objects.filter(name=name, created_by=request.user).exists():
            return Response({
                'status': 'error',
                'message': 'A checklist with this name already exists',
                'errors': {'name': ['Checklist with this name already exists.']}
            }, status=status.HTTP_409_CONFLICT)

        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            serializer.save(created_by=request.user)
            return Response({
                'status': 'success',
                'message': 'Checklist created successfully',
                'data': serializer.data
            }, status=status.HTTP_201_CREATED)

        return Response({
            'status': 'error',
            'message': 'Validation failed',
            'errors': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        return Response({
            'status': 'success',
            'count': queryset.count(),
            'data': serializer.data
        }, status=status.HTTP_200_OK)

    def retrieve(self, request, *args, **kwargs):
        try:
            instance = self.get_object()
        except Exception:
            return Response({
                'status': 'error',
                'message': 'Checklist not found'
            }, status=status.HTTP_404_NOT_FOUND)

        serializer = self.get_serializer(instance)
        return Response({
            'status': 'success',
            'data': serializer.data
        }, status=status.HTTP_200_OK)

    def update(self, request, *args, **kwargs):
        admin_error = self._ensure_admin(request)
        if admin_error:
            return admin_error
        partial = kwargs.pop('partial', False)
        try:
            instance = self.get_object()
        except Exception:
            return Response({
                'status': 'error',
                'message': 'Checklist not found'
            }, status=status.HTTP_404_NOT_FOUND)

        name = request.data.get('name')
        if name and Checklist.objects.filter(
            name=name,
            created_by=request.user
        ).exclude(id=instance.id).exists():
            return Response({
                'status': 'error',
                'message': 'A checklist with this name already exists',
                'errors': {'name': ['Checklist with this name already exists.']}
            }, status=status.HTTP_409_CONFLICT)

        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        if serializer.is_valid():
            serializer.save(created_by=request.user)
            return Response({
                'status': 'success',
                'message': 'Checklist updated successfully',
                'data': serializer.data
            }, status=status.HTTP_200_OK)

        return Response({
            'status': 'error',
            'message': 'Validation failed',
            'errors': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)

    def destroy(self, request, *args, **kwargs):
        admin_error = self._ensure_admin(request)
        if admin_error:
            return admin_error
        try:
            instance = self.get_object()
        except Exception:
            return Response({
                'status': 'error',
                'message': 'Checklist not found'
            }, status=status.HTTP_404_NOT_FOUND)

        instance.is_archived = True
        instance.save(update_fields=['is_archived'])
        serializer = self.get_serializer(instance)
        return Response({
            'status': 'success',
            'message': 'Checklist archived successfully',
            'data': serializer.data
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['delete'], url_path='permanent')
    def permanent_delete(self, request, pk=None):
        admin_error = self._ensure_admin(request)
        if admin_error:
            return admin_error
        try:
            instance = Checklist.objects.get(pk=pk, created_by=request.user)
        except Checklist.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'Checklist not found'
            }, status=status.HTTP_404_NOT_FOUND)

        instance.delete()
        return Response({
            'status': 'success',
            'message': 'Checklist deleted permanently'
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='archived')
    def archived(self, request):
        admin_error = self._ensure_admin(request)
        if admin_error:
            return admin_error
        queryset = Checklist.objects.filter(created_by=request.user, is_archived=True)
        serializer = self.get_serializer(queryset, many=True)
        return Response({
            'status': 'success',
            'count': queryset.count(),
            'data': serializer.data
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='restore')
    def restore(self, request, pk=None):
        admin_error = self._ensure_admin(request)
        if admin_error:
            return admin_error
        try:
            instance = Checklist.objects.get(pk=pk, created_by=request.user)
        except Checklist.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'Checklist not found'
            }, status=status.HTTP_404_NOT_FOUND)

        instance.is_archived = False
        instance.save(update_fields=['is_archived'])
        serializer = self.get_serializer(instance)
        return Response({
            'status': 'success',
            'message': 'Checklist restored successfully',
            'data': serializer.data
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='dashboard-analytics')
    def dashboard_analytics(self, request):
        base_queryset = self.get_queryset().prefetch_related("items")
        item_queryset = ChecklistItem.objects.filter(
            checklist__created_by=request.user,
            checklist__is_archived=False,
        )

        total_items = item_queryset.count()
        completed_items = item_queryset.filter(is_completed=True).count()
        overdue_items = item_queryset.filter(is_completed=False, due_date__lt=date.today()).count()
        completion_rate = round((completed_items / total_items) * 100, 2) if total_items else 0

        return Response(
            {
                "status": "success",
                "data": {
                    "checklists": base_queryset.count(),
                    "total_items": total_items,
                    "completed_items": completed_items,
                    "pending_items": max(total_items - completed_items, 0),
                    "completion_rate": completion_rate,
                    "overdue_items": overdue_items,
                    "by_priority": list(
                        item_queryset.values("priority").annotate(count=Count("id")).order_by("priority")
                    ),
                    "due_today": item_queryset.filter(due_date=date.today(), is_completed=False).count(),
                },
            },
            status=status.HTTP_200_OK,
        )
