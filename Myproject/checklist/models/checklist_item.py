from django.db import models
from django.core.exceptions import ValidationError
import uuid
from .checklist import Checklist

class ChecklistItem(models.Model):
        id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
        checklist = models.ForeignKey(Checklist, on_delete=models.CASCADE, related_name='items')
        label = models.CharField(max_length=255)
        type = models.CharField(max_length=200)
        is_completed = models.BooleanField(default=False)
        position = models.PositiveIntegerField(default=0)
        
        class Meta:
            ordering = ['position', 'id']
            constraints = [
                models.UniqueConstraint(fields=['checklist', 'label'], name='unique_item_per_checklist')
            ]
        def __str__(self):
         return f"{self.label} ({self.type})"
        
        def clean(self):
         super().clean()

         if not self.label or self.label.strip() == '':
            raise ValidationError({'label': 'Label cannot be empty or whitespace.'})
         
         if not self.type or self.type.strip() == '':
            raise ValidationError({'type': 'Type cannot be empty or whitespace.'})
         
        def save(self, *args, **kwargs):
           self.full_clean()  
           super().save(*args, **kwargs)

