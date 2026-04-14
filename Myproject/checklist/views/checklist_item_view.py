# checklist/views/checklistitems_view.py
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

    def get_serializer_context(self):
        context = super().get_serializer_context()
        return context

    
    def create(self, request, *args, **kwargs):
        """POST /api/checklist/{checklist_pk}/items/"""
        checklist_pk = self.kwargs.get('checklist_pk')
        
        if not checklist_pk:
            return Response({
                'error': 'Checklist ID is required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            checklist = Checklist.objects.get(pk=checklist_pk)
        except Checklist.DoesNotExist:
            return Response({
                'error': 'Checklist not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        serializer = self.get_serializer(data=request.data)
        
        if serializer.is_valid():
            try:
                item = serializer.save(checklist=checklist)
                return Response({
                    'id': str(item.id),
                    'label': item.label,
                    'type': item.type
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
            checklist = Checklist.objects.get(pk=checklist_pk)
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
            checklist = Checklist.objects.get(pk=checklist_pk)
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
            checklist = Checklist.objects.get(pk=checklist_pk)
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
                    'type': item.type
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
            checklist = Checklist.objects.get(pk=checklist_pk)
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