from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework import viewsets, status
from rest_framework.response import Response
from ..models import Checklist
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

    def create(self, request, *args, **kwargs):
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

    @action(detail=False, methods=['get'], url_path='archived')
    def archived(self, request):
        queryset = Checklist.objects.filter(created_by=request.user, is_archived=True)
        serializer = self.get_serializer(queryset, many=True)
        return Response({
            'status': 'success',
            'count': queryset.count(),
            'data': serializer.data
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='restore')
    def restore(self, request, pk=None):
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
