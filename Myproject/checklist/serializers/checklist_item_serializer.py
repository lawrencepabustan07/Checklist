from rest_framework import serializers

from ..models import ChecklistItem

class ChecklistItemSerializer(serializers.ModelSerializer):
    priority_label = serializers.CharField(source="get_priority_display", read_only=True)

    class Meta:
        model = ChecklistItem
        fields = [
            "id",
            "label",
            "type",
            "is_completed",
            "position",
            "due_date",
            "priority",
            "priority_label",
            "completed_at",
            "created_at",
            "updated_at",
        ]
