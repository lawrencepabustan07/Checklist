from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views
from .views.admin_view import (
    AdminChecklistDetailView,
    AdminChecklistItemDetailView,
    AdminChecklistItemListCreateView,
    AdminInsightsView,
    AdminChecklistListCreateView,
    AdminUserActivityView,
    AdminUserDetailView,
    AdminUserMetricsView,
)


router = DefaultRouter()
router.register(r'checklist', views.ChecklistViewSet)
router.register(r'checklist/(?P<checklist_pk>[^/.]+)/items', views.ChecklistItemViewSet, basename='checklist-items')
router.register(r'items', views.ChecklistItemViewSet)


urlpatterns = [
    path('admin/users/', AdminUserMetricsView.as_view(), name='admin-users'),
    path('admin/users/<int:pk>/', AdminUserDetailView.as_view(), name='admin-user-detail'),
    path('admin/users/<int:pk>/activity/', AdminUserActivityView.as_view(), name='admin-user-activity'),
    path('admin/insights/', AdminInsightsView.as_view(), name='admin-insights'),
    path('admin/checklists/', AdminChecklistListCreateView.as_view(), name='admin-checklists'),
    path('admin/checklists/<uuid:pk>/', AdminChecklistDetailView.as_view(), name='admin-checklist-detail'),
    path('admin/checklists/<uuid:checklist_pk>/items/', AdminChecklistItemListCreateView.as_view(), name='admin-checklist-items'),
    path('admin/checklists/<uuid:checklist_pk>/items/<uuid:pk>/', AdminChecklistItemDetailView.as_view(), name='admin-checklist-item-detail'),
    path('', include(router.urls)),
    path('auth/', include('checklist.auth.urls')),
]
