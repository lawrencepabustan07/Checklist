# checklist/views/checklistitems_view.py
from datetime import date

from django.db import IntegrityError, transaction
from django.db.models import Count, Max
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from ..models import Checklist, ChecklistItem
from ..serializers import ChecklistItemSerializer

class ChecklistItemViewSet(viewsets.ModelViewSet):
    queryset = ChecklistItem.objects.all()
    serializer_class = ChecklistItemSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = ChecklistItem.objects.filter(
            checklist__created_by=self.request.user,
            checklist__is_archived=False,
        )
        checklist_pk = self.kwargs.get("checklist_pk")
        if checklist_pk:
            queryset = queryset.filter(checklist_id=checklist_pk)

        priority = self.request.query_params.get("priority")
        status_filter = self.request.query_params.get("status")
        if priority:
            queryset = queryset.filter(priority=priority)
        if status_filter == "completed":
            queryset = queryset.filter(is_completed=True)
        elif status_filter == "pending":
            queryset = queryset.filter(is_completed=False)

        return self._apply_sort(queryset).distinct()

    def get_serializer_context(self):
        context = super().get_serializer_context()
        return context

    def _get_checklist(self, checklist_pk, user):
        return Checklist.objects.get(pk=checklist_pk, created_by=user, is_archived=False)

    def _apply_sort(self, queryset):
        sort_by = self.request.query_params.get("sort_by", "position")
        direction = self.request.query_params.get("direction", "asc")
        descending = "-" if direction == "desc" else ""
        order_map = {
            "name": "label",
            "due_date": "due_date",
            "priority": "priority",
            "status": "is_completed",
            "created_at": "id",
            "position": "position",
        }
        order_field = order_map.get(sort_by, "position")
        if order_field == "priority":
            order_field = "priority"
        return queryset.order_by(f"{descending}{order_field}", "position", "id")

    def _serialize_item(self, item):
        return self.get_serializer(item).data

    
    def create(self, request, *args, **kwargs):
        """POST /api/checklist/{checklist_pk}/items/"""
        checklist_pk = self.kwargs.get('checklist_pk')
        
        if not checklist_pk:
            return Response({
                'error': 'Checklist ID is required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            checklist = self._get_checklist(checklist_pk, request.user)
        except Checklist.DoesNotExist:
            return Response({
                'error': 'Checklist not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        serializer = self.get_serializer(data=request.data)
        
        if serializer.is_valid():
            try:
                max_position = checklist.items.aggregate(max_position=Max('position'))['max_position'] or 0
                item = serializer.save(checklist=checklist, position=max_position + 1)
                return Response(self._serialize_item(item), status=status.HTTP_201_CREATED)
            except IntegrityError:
                return Response({
                    'error': 'An item with this label already exists in this checklist.'
                }, status=status.HTTP_400_BAD_REQUEST)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

  
    def list(self, request, *args, **kwargs):
        """GET /api/checklist/{checklist_pk}/items/"""
        checklist_pk = self.kwargs.get('checklist_pk')
        
        if not checklist_pk:
            return Response({
                'error': 'Checklist ID is required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            checklist = self._get_checklist(checklist_pk, request.user)
        except Checklist.DoesNotExist:
            return Response({
                'error': 'Checklist not found'
            }, status=status.HTTP_404_NOT_FOUND)

        items = self.get_queryset()
        serializer = self.get_serializer(items, many=True)
        
        return Response(serializer.data, status=status.HTTP_200_OK)

    
    def retrieve(self, request, *args, **kwargs):
        """GET /api/checklist/{checklist_pk}/items/{pk}/"""
        checklist_pk = self.kwargs.get('checklist_pk')
        pk = self.kwargs.get('pk')
        
        try:
            checklist = self._get_checklist(checklist_pk, request.user)
        except Checklist.DoesNotExist:
            return Response({
                'error': 'Checklist not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        try:
            item = ChecklistItem.objects.get(id=pk, checklist=checklist)
        except ChecklistItem.DoesNotExist:
            return Response({
                'error': 'Item not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        serializer = self.get_serializer(item)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def update(self, request, *args, **kwargs):
        """PUT/PATCH /api/checklist/{checklist_pk}/items/{pk}/"""
        checklist_pk = self.kwargs.get('checklist_pk')
        pk = self.kwargs.get('pk')
        
        try:
            checklist = self._get_checklist(checklist_pk, request.user)
        except Checklist.DoesNotExist:
            return Response({
                'error': 'Checklist not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        try:
            item = ChecklistItem.objects.get(id=pk, checklist=checklist)
        except ChecklistItem.DoesNotExist:
            return Response({
                'error': 'Item not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        serializer = self.get_serializer(item, data=request.data, partial=True)
        
        if serializer.is_valid():
            try:
                item = serializer.save()
                if "is_completed" in serializer.validated_data:
                    item.completed_at = timezone.now() if item.is_completed else None
                    item.save(update_fields=["completed_at"])
                return Response(self._serialize_item(item), status=status.HTTP_200_OK)
            except IntegrityError:
                return Response({
                    'error': 'An item with this label already exists in this checklist.'
                }, status=status.HTTP_400_BAD_REQUEST)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    
    def destroy(self, request, *args, **kwargs):
        """DELETE /api/checklist/{checklist_pk}/items/{pk}/"""
        checklist_pk = self.kwargs.get('checklist_pk')
        pk = self.kwargs.get('pk')
        
        try:
            checklist = self._get_checklist(checklist_pk, request.user)
        except Checklist.DoesNotExist:
            return Response({
                'error': 'Checklist not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        try:
            item = ChecklistItem.objects.get(id=pk, checklist=checklist)
        except ChecklistItem.DoesNotExist:
            return Response({
                'error': 'Item not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        item.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=['post'], url_path='reorder')
    def reorder(self, request, checklist_pk=None):
        try:
            checklist = self._get_checklist(checklist_pk, request.user)
        except Checklist.DoesNotExist:
            return Response({
                'error': 'Checklist not found'
            }, status=status.HTTP_404_NOT_FOUND)

        ordered_ids = request.data.get('ordered_ids', [])
        if not isinstance(ordered_ids, list):
            return Response({
                'error': 'ordered_ids must be a list'
            }, status=status.HTTP_400_BAD_REQUEST)

        items = list(checklist.items.all())
        existing_ids = {str(item.id) for item in items}
        if set(ordered_ids) != existing_ids:
            return Response({
                'error': 'ordered_ids must include every item in the checklist exactly once'
            }, status=status.HTTP_400_BAD_REQUEST)

        items_by_id = {str(item.id): item for item in items}
        with transaction.atomic():
            for index, item_id in enumerate(ordered_ids, start=1):
                item = items_by_id[item_id]
                item.position = index
                item.save(update_fields=['position'])

        serializer = self.get_serializer(checklist.items.all(), many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=False, methods=["patch"], url_path="bulk-priority")
    def bulk_priority(self, request, checklist_pk=None):
        try:
            checklist = self._get_checklist(checklist_pk, request.user)
        except Checklist.DoesNotExist:
            return Response({"error": "Checklist not found"}, status=status.HTTP_404_NOT_FOUND)

        item_ids = request.data.get("item_ids", [])
        priority = request.data.get("priority", ChecklistItem.PRIORITY_NONE)
        if not isinstance(item_ids, list):
            return Response({"error": "item_ids must be a list"}, status=status.HTTP_400_BAD_REQUEST)
        if priority not in dict(ChecklistItem.PRIORITY_CHOICES):
            return Response({"error": "Invalid priority"}, status=status.HTTP_400_BAD_REQUEST)

        queryset = checklist.items.filter(id__in=item_ids)
        queryset.update(priority=priority)
        serializer = self.get_serializer(checklist.items.all(), many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=False, methods=["get"], url_path="calendar")
    def calendar(self, request, checklist_pk=None):
        try:
            self._get_checklist(checklist_pk, request.user)
        except Checklist.DoesNotExist:
            return Response({"error": "Checklist not found"}, status=status.HTTP_404_NOT_FOUND)

        items = self.get_queryset().exclude(due_date__isnull=True)
        grouped = {}
        for item in items:
            key = item.due_date.isoformat()
            grouped.setdefault(key, []).append(self._serialize_item(item))
        return Response(grouped, status=status.HTTP_200_OK)

    @action(detail=False, methods=["get"], url_path="analytics")
    def analytics(self, request, checklist_pk=None):
        try:
            checklist = self._get_checklist(checklist_pk, request.user)
        except Checklist.DoesNotExist:
            return Response({"error": "Checklist not found"}, status=status.HTTP_404_NOT_FOUND)

        items = checklist.items.all()
        total_items = items.count()
        completed_items = items.filter(is_completed=True).count()
        overdue_items = items.filter(is_completed=False, due_date__lt=date.today()).count()
        completion_rate = round((completed_items / total_items) * 100, 2) if total_items else 0

        week_counts = {
            day: 0
            for day in ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
        }
        heatmap = {}
        for item in items.filter(completed_at__isnull=False):
            local_completed = timezone.localtime(item.completed_at)
            weekday = local_completed.strftime("%a")
            week_counts[weekday] = week_counts.get(weekday, 0) + 1
            day_key = local_completed.date().isoformat()
            heatmap[day_key] = heatmap.get(day_key, 0) + 1

        best_day = max(week_counts, key=week_counts.get) if any(week_counts.values()) else None

        return Response(
            {
                "total_items": total_items,
                "completed_items": completed_items,
                "pending_items": max(total_items - completed_items, 0),
                "completion_rate": completion_rate,
                "overdue_items": overdue_items,
                "priority_breakdown": list(
                    items.values("priority").annotate(count=Count("id")).order_by("priority")
                ),
                "weekly_activity": week_counts,
                "best_day": best_day,
                "heatmap": heatmap,
            },
            status=status.HTTP_200_OK,
        )
