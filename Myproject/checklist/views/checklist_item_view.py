# checklist/views/checklistitems_view.py
from django.db import IntegrityError, transaction
from django.db.models import Max
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from ..models import Checklist, ChecklistItem
from ..serializers import ChecklistItemSerializer
from rest_framework.permissions import IsAuthenticated

class ChecklistItemViewSet(viewsets.ModelViewSet):
    queryset = ChecklistItem.objects.all()
    serializer_class = ChecklistItemSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return ChecklistItem.objects.filter(
            checklist__created_by=self.request.user,
            checklist__is_archived=False,
        )

    def get_serializer_context(self):
        context = super().get_serializer_context()
        return context

    def _get_checklist(self, checklist_pk, user):
        return Checklist.objects.get(pk=checklist_pk, created_by=user, is_archived=False)

    
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
                return Response({
                    'id': str(item.id),
                    'label': item.label,
                    'type': item.type,
                    'is_completed': item.is_completed,
                    'position': item.position,
                }, status=status.HTTP_201_CREATED)
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

        items = checklist.items.all()
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
                return Response({
                    'id': str(item.id),
                    'label': item.label,
                    'type': item.type,
                    'is_completed': item.is_completed,
                    'position': item.position,
                }, status=status.HTTP_200_OK)
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
