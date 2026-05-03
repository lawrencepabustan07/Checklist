import os

from django.conf import settings
from django.db import models


class UserProfile(models.Model):
    THEME_SYSTEM = "system"
    THEME_LIGHT = "light"
    THEME_DARK = "dark"
    THEME_CONTRAST = "contrast"
    THEME_CHOICES = [
        (THEME_SYSTEM, "System"),
        (THEME_LIGHT, "Light"),
        (THEME_DARK, "Dark"),
        (THEME_CONTRAST, "High Contrast"),
    ]

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="profile",
    )
    avatar = models.FileField(upload_to="profiles/", null=True, blank=True)
    archived_at = models.DateTimeField(null=True, blank=True)
    last_login_at = models.DateTimeField(null=True, blank=True)
    theme_preference = models.CharField(
        max_length=20,
        choices=THEME_CHOICES,
        default=THEME_SYSTEM,
    )
    sort_option = models.CharField(max_length=50, default="position")
    sort_direction = models.CharField(max_length=4, default="asc")

    def delete(self, *args, **kwargs):
        avatar_path = self.avatar.path if self.avatar and hasattr(self.avatar, "path") else None
        super().delete(*args, **kwargs)
        if avatar_path and os.path.exists(avatar_path):
            os.remove(avatar_path)
