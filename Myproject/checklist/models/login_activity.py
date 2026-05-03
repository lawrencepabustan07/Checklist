from django.conf import settings
from django.db import models


class LoginActivity(models.Model):
    PROVIDER_AUTH0 = "auth0"
    PROVIDER_PASSWORD = "password"
    PROVIDER_CHOICES = [
        (PROVIDER_AUTH0, "Auth0"),
        (PROVIDER_PASSWORD, "Password"),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="login_activities",
    )
    provider = models.CharField(max_length=20, choices=PROVIDER_CHOICES, default=PROVIDER_AUTH0)
    ip_address = models.CharField(max_length=64, blank=True, default="")
    user_agent = models.TextField(blank=True, default="")
    logged_in_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-logged_in_at"]

    def __str__(self):
        return f"{self.user.email} login at {self.logged_in_at:%Y-%m-%d %H:%M:%S}"
