import os

from django.conf import settings
from rest_framework import serializers
from ..models import Checklist, ChecklistItem
from .checklist_item_serializer import ChecklistItemSerializer


class ChecklistSerializer(serializers.ModelSerializer):
    items = ChecklistItemSerializer(many=True, required=False)
    image_url = serializers.SerializerMethodField(read_only=True)
    remove_image = serializers.BooleanField(write_only=True, required=False, default=False)
    
    class Meta:
        model = Checklist
        fields = ['id', 'name', 'type', 'image', 'image_url', 'remove_image', 'is_archived', 'items']
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

    def validate_image(self, value):
        if not value:
            return value

        max_size = 2 * 1024 * 1024
        allowed_extensions = {".jpg", ".jpeg", ".png", ".webp"}
        allowed_content_types = {"image/jpeg", "image/png", "image/webp"}
        extension = os.path.splitext(value.name)[1].lower()

        if extension not in allowed_extensions:
            raise serializers.ValidationError("Only JPG, PNG, and WEBP images are allowed.")

        if getattr(value, "size", 0) > max_size:
            raise serializers.ValidationError("Image must be 2MB or smaller.")

        content_type = getattr(value, "content_type", None)
        if content_type and content_type not in allowed_content_types:
            raise serializers.ValidationError("Only JPG, PNG, and WEBP images are allowed.")

        return value

    def get_image_url(self, obj):
        request = self.context.get("request")
        image_url = obj.image.url if obj.image else f"{settings.MEDIA_URL}checklists/default-checklist.svg"
        return request.build_absolute_uri(image_url) if request else image_url
    
    def create(self, validated_data):
        items_data = validated_data.pop('items', [])
        validated_data.pop('remove_image', False)
        checklist = Checklist.objects.create(**validated_data)

        for item_data in items_data:
         ChecklistItem.objects.create(checklist=checklist, **item_data)

        return checklist

    def update(self, instance, validated_data):
        items_data = validated_data.pop('items', None)
        remove_image = validated_data.pop('remove_image', False)
        new_image = validated_data.get('image')
        old_image = instance.image

        if remove_image:
            validated_data['image'] = None
        
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        
        instance.save()

        if old_image and (remove_image or new_image) and old_image.name != getattr(instance.image, "name", None):
            old_image.delete(save=False)
        
        if items_data is not None:
            instance.items.all().delete()
            for item_data in items_data:
                ChecklistItem.objects.create(checklist=instance, **item_data)
        
        return instance
