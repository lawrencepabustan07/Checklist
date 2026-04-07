from rest_framework import serializers
from ..models import ChecklistItem

class ChecklistItemDetailSerializer(serializers.ModelSerializer):
            
            checklist__name = serializers.CharField(source='checklist.name', read_only=True)
            checklist__type = serializers.CharField(source='checklist.type', read_only=True)
            class Meta:
                model = ChecklistItem
                fields = ['id', 'checklist', 'checklist__name', 'checklist__type', 'label', 'type']