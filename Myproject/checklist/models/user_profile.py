import os

from django.conf import settings
from django.db import models


class UserProfile(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="profile",
    )
    avatar = models.FileField(upload_to="profiles/", null=True, blank=True)

    def delete(self, *args, **kwargs):
        avatar_path = self.avatar.path if self.avatar and hasattr(self.avatar, "path") else None
        super().delete(*args, **kwargs)
        if avatar_path and os.path.exists(avatar_path):
            os.remove(avatar_path)
