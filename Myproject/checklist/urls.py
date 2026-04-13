from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views


router = DefaultRouter()
router.register(r'checklist', views.ChecklistViewSet)
router.register(r'checklist/(?P<checklist_pk>[^/.]+)/items', views.ChecklistItemViewSet, basename='checklist-items')
router.register(r'items', views.ChecklistItemViewSet)


urlpatterns = [
    path('', include(router.urls)),
    path('auth/', include('checklist.auth.urls')),
]