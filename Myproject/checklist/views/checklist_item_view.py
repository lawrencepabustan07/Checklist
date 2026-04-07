from rest_framework.decorators import action
from rest_framework import viewsets, status
from rest_framework.response import Response
from ..models import ChecklistItem
from ..models import Checklist
from ..serializers import ChecklistItemSerializer
from django.db import IntegrityError
from rest_framework.permissions import IsAuthenticated

class ChecklistItemViewSet(viewsets.ModelViewSet):
    queryset = ChecklistItem.objects.all()
    serializer_class = ChecklistItemSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        
        return ChecklistItem.objects.filter(checklist__created_by=self.request.user)

    @action(detail=True, methods=['post'], url_path='item')
    def create_item(self, request, pk=None):
        """POST /api/checklist/{id}/item/ - Create item"""
        try:
            checklist = self.get_object()
        except Checklist.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'Checklist not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        serializer = ChecklistItemSerializer(data=request.data)
        
        if serializer.is_valid():
            try:
                item = serializer.save(checklist=checklist)
                return Response({
                    'checklist_id': item.checklist.id,
                    'label': item.label,
                    'type': item.type
                }, status=status.HTTP_201_CREATED)
            except IntegrityError:
                return Response({
                    'status': 'error',
                    'message': 'An item with this label already exists in this checklist.'
                }, status=status.HTTP_400_BAD_REQUEST)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['get'], url_path='items')
    def get_items(self, request, pk=None):
        """GET /api/checklist/{id}/items/ - Get all items of checklist"""
        try:
            checklist = self.get_object()
        except Checklist.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'Checklist not found'
            }, status=status.HTTP_404_NOT_FOUND)

        items = checklist.items.all()
        return Response({
            'status': 'success',
            'count': items.count(),
            'data': ChecklistItemSerializer(items, many=True).data
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['get'], url_path='item/(?P<item_id>[^/.]+)')
    def get_item(self, request, pk=None, item_id=None):
        """GET /api/checklist/{id}/item/{item_id}/ - Get one item"""
        try:
            checklist = self.get_object()
        except Checklist.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'Checklist not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        try:
            item = ChecklistItem.objects.get(id=item_id, checklist=checklist)
        except ChecklistItem.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'Item not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        return Response({
            'checklist_id': item.checklist.id,
            'label': item.label,
            'type': item.type
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['patch'], url_path='item/(?P<item_id>[^/.]+)')
    def update_item(self, request, pk=None, item_id=None):
        """PATCH /api/checklist/{id}/item/{item_id}/ - Update item"""
        try:
            checklist = self.get_object()
        except Checklist.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'Checklist not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        try:
            item = ChecklistItem.objects.get(id=item_id, checklist=checklist)
        except ChecklistItem.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'Item not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        serializer = ChecklistItemSerializer(item, data=request.data, partial=True)
        
        if serializer.is_valid():
            try:
                item = serializer.save()
            except IntegrityError:
                return Response({
                    'status': 'error',
                    'message': 'An item with this label already exists in this checklist.'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            return Response({
                'checklist_id': item.checklist.id,
                'label': item.label,
                'type': item.type
            }, status=status.HTTP_200_OK)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['delete'], url_path='item/(?P<item_id>[^/.]+)')
    def delete_item(self, request, pk=None, item_id=None):
        """DELETE /api/checklist/{id}/item/{item_id}/ - Delete item"""
        try:
            checklist = self.get_object()
        except Checklist.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'Checklist not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        try:
            item = ChecklistItem.objects.get(id=item_id, checklist=checklist)
        except ChecklistItem.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'Item not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        item.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)