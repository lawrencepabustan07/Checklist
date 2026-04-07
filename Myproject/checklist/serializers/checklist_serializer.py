# checklist/serializers/checklist_serializer.py

from rest_framework import serializers
from ..models import Checklist, ChecklistItem
from .checklist_item_serializer import ChecklistItemSerializer


class ChecklistSerializer(serializers.ModelSerializer):
    items = ChecklistItemSerializer(many=True, required=False)
    
    class Meta:
        model = Checklist
        fields = ['id', 'name', 'type', 'items']
        read_only_fields = ['created_by', 'created_at', 'updated_at'] 

    # ========== CUSTOM VALIDATION FOR NAME ==========
    def validate_name(self, value):
        """Validate name field"""
        if not value or value.strip() == '':
            raise serializers.ValidationError("Name cannot be empty")
        
        if len(value) < 3:
            raise serializers.ValidationError("Name must be at least 3 characters long")
        
        if len(value) > 255:
            raise serializers.ValidationError("Name cannot exceed 255 characters")
        
        # Check for duplicate (handled in view for 409 status)
        return value.strip()

    # ========== CUSTOM VALIDATION FOR TYPE ==========
    def validate_type(self, value):
        """Validate type field"""
        if not value or value.strip() == '':
            raise serializers.ValidationError("Type cannot be empty")
        
        valid_types = ['Weekly', 'Daily', 'Monthly', 'Quarterly', 'Yearly']
        if value not in valid_types:
            raise serializers.ValidationError(f"Type must be one of: {', '.join(valid_types)}")
        
        return value.strip()

    def create(self, validated_data):
        items_data = validated_data.pop('items', [])
        checklist = Checklist.objects.create(**validated_data)
        
        for item_data in items_data:
            ChecklistItem.objects.create(checklist=checklist, **item_data)
        
        return checklist
    
    def update(self, instance, validated_data):
        items_data = validated_data.pop('items', None)
        
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        
        instance.save()
        
        if items_data is not None:
            instance.items.all().delete()
            for item_data in items_data:
                ChecklistItem.objects.create(checklist=instance, **item_data)
        
        return instance