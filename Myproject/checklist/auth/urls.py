# checklist/auth/urls.py

# checklist/auth/urls.py
from django.urls import path
from .views import Auth0LoginView, Auth0UserView, RegisterView

urlpatterns = [
    path('login/', Auth0LoginView.as_view(), name='login'),
    path('user/', Auth0UserView.as_view(), name='user'),
    path('register/', RegisterView.as_view(), name='register'),  
]