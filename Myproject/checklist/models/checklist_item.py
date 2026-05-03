import uuid

from django.core.exceptions import ValidationError
from django.db import models

from .checklist import Checklist

class ChecklistItem(models.Model):
    PRIORITY_HIGH = "high"
    PRIORITY_MEDIUM = "medium"
    PRIORITY_LOW = "low"
    PRIORITY_NONE = "none"
    PRIORITY_CHOICES = [
        (PRIORITY_HIGH, "High"),
        (PRIORITY_MEDIUM, "Medium"),
        (PRIORITY_LOW, "Low"),
        (PRIORITY_NONE, "None"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    checklist = models.ForeignKey(Checklist, on_delete=models.CASCADE, related_name="items")
    label = models.CharField(max_length=255)
    type = models.CharField(max_length=200)
    is_completed = models.BooleanField(default=False)
    position = models.PositiveIntegerField(default=0)
    due_date = models.DateField(null=True, blank=True)
    priority = models.CharField(max_length=10, choices=PRIORITY_CHOICES, default=PRIORITY_NONE)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["position", "id"]
        constraints = [
            models.UniqueConstraint(fields=["checklist", "label"], name="unique_item_per_checklist")
        ]

    def __str__(self):
        return f"{self.label} ({self.type})"

    def clean(self):
        super().clean()

        if not self.label or self.label.strip() == "":
            raise ValidationError({"label": "Label cannot be empty or whitespace."})

        if not self.type or self.type.strip() == "":
            raise ValidationError({"type": "Type cannot be empty or whitespace."})

        if self.priority not in dict(self.PRIORITY_CHOICES):
            raise ValidationError({"priority": "Invalid priority selected."})

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

