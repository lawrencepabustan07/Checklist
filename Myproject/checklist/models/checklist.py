from django.db import models
from django.core.exceptions import ValidationError
import uuid
from django.conf import settings 
#import re

#def validate_name(value):
#   if not re.match(r'^[a-zA-Z0-9\s]+$', value):
#   raise ValidationError('Name can only contain letters, numbers, and spaces.')
 
class Checklist(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255, unique=True) #, validators=[validate_name] )
    type = models.CharField(max_length=100)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE,
        related_name='checklists',
        null=True
    )
    
    class Meta:
        ordering = ['-id']
    
    def __str__(self):
     return f"{self.name} ({self.type})"

    def clean(self):
        super().clean()


        if not self.name or self.name.strip() == '':

            raise ValidationError({'name': 'Name cannot be empty or whitespace.'})
        
        if not self.type or self.type.strip() == '':

            raise ValidationError({'type': 'Type cannot be empty or whitespace.'})
    
        if len(self.name) < 3:
          
            raise ValidationError({'name': 'Name must be at least 3 characters long.'})
    
        if len(self.name) > 255:
           
            raise ValidationError({'name': 'Name cannot exceed 255 characters.'})
        

    def save(self, *args, **kwargs):
        self.full_clean()  
        super().save(*args, **kwargs)
