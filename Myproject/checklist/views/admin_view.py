from django.conf import settings
from django.contrib.auth.models import User
from django.db import IntegrityError
from django.db.models import Prefetch, Q
from django.utils import timezone
from rest_framework import status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView

from ..models import Checklist, ChecklistItem, LoginActivity, UserProfile
from ..serializers import ChecklistItemSerializer, ChecklistSerializer


DEFAULT_AVATAR_URL = f"{settings.MEDIA_URL}profiles/default-avatar.svg"


def _build_avatar_url(request, user):
    profile = getattr(user, "profile", None)
    avatar_url = profile.avatar.url if profile and profile.avatar else DEFAULT_AVATAR_URL
    return request.build_absolute_uri(avatar_url)


def _checklist_progress(checklist):
    items = list(checklist.items.all())
    total_items = len(items)
    completed_items = sum(1 for item in items if item.is_completed)
    pending_items = max(total_items - completed_items, 0)
    is_completed = total_items > 0 and completed_items == total_items
    completion_rate = round((completed_items / total_items) * 100, 2) if total_items else 0
    return {
        "total_items": total_items,
        "completed_items": completed_items,
        "pending_items": pending_items,
        "is_completed": is_completed,
        "completion_rate": completion_rate,
    }


def _serialize_admin_checklist(request, checklist):
    serializer = ChecklistSerializer(instance=checklist, context={"request": request})
    payload = dict(serializer.data)
    payload.update(
        {
            "created_by_id": checklist.created_by_id,
            "created_by_email": checklist.created_by.email if checklist.created_by else "",
            "created_by_username": checklist.created_by.username if checklist.created_by else "",
        }
    )
    payload.update(_checklist_progress(checklist))
    return payload


def _serialize_admin_item(item):
    serializer = ChecklistItemSerializer(instance=item)
    payload = dict(serializer.data)
    payload.update(
        {
            "checklist_id": str(item.checklist_id),
            "checklist_name": item.checklist.name,
            "created_by_email": item.checklist.created_by.email if item.checklist.created_by else "",
        }
    )
    return payload


def _serialise_login_activity(activity):
    return {
        "id": activity.id,
        "provider": activity.provider,
        "logged_in_at": activity.logged_in_at,
        "ip_address": activity.ip_address,
        "user_agent": activity.user_agent,
    }


def _user_metrics(request, user):
    profile = getattr(user, "profile", None)
    active_checklists = [checklist for checklist in user.checklists.all() if not checklist.is_archived]
    total_checklists = len(active_checklists)
    completed_checklists = 0
    total_items = 0
    completed_items = 0

    for checklist in active_checklists:
        progress = _checklist_progress(checklist)
        total_items += progress["total_items"]
        completed_items += progress["completed_items"]
        if progress["is_completed"]:
            completed_checklists += 1

    pending_checklists = max(total_checklists - completed_checklists, 0)
    pending_items = max(total_items - completed_items, 0)
    item_completion_rate = round((completed_items / total_items) * 100, 2) if total_items else 0
    recent_logins = [_serialise_login_activity(activity) for activity in user.login_activities.all()[:5]]

    return {
        "id": user.id,
        "email": user.email,
        "username": user.username,
        "is_admin": user.is_staff,
        "is_active": user.is_active,
        "avatar_url": _build_avatar_url(request, user),
        "archived_at": profile.archived_at if profile else None,
        "last_login_at": profile.last_login_at if profile else None,
        "total_checklists": total_checklists,
        "completed_checklists": completed_checklists,
        "pending_checklists": pending_checklists,
        "completion_rate": item_completion_rate,
        "total_items": total_items,
        "completed_items": completed_items,
        "pending_items": pending_items,
        "item_completion_rate": item_completion_rate,
        "login_count": len(user.login_activities.all()),
        "recent_logins": recent_logins,
    }


def _get_admin_users_queryset():
    return User.objects.order_by("email").prefetch_related(
        "profile",
        Prefetch(
            "checklists",
            queryset=Checklist.objects.prefetch_related("items").order_by("name"),
        ),
        Prefetch(
            "login_activities",
            queryset=LoginActivity.objects.order_by("-logged_in_at"),
        ),
    )


class AdminUserMetricsView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        users = _get_admin_users_queryset()
        search = request.query_params.get("search", "").strip()
        role = request.query_params.get("role", "").strip().lower()
        status_filter = request.query_params.get("status", "").strip().lower()

        if search:
            users = users.filter(
                Q(email__icontains=search) |
                Q(username__icontains=search)
            )

        if role == "admin":
            users = users.filter(is_staff=True)
        elif role == "member":
            users = users.filter(is_staff=False)

        if status_filter == "active":
            users = users.filter(is_active=True)
        elif status_filter in {"inactive", "archived"}:
            users = users.filter(is_active=False)

        payload = [_user_metrics(request, user) for user in users]
        return Response({"status": "success", "data": payload}, status=status.HTTP_200_OK)


class AdminUserDetailView(APIView):
    permission_classes = [IsAdminUser]

    def patch(self, request, pk):
        try:
            user = User.objects.select_related("profile").get(pk=pk)
        except User.DoesNotExist:
            return Response(
                {"status": "error", "message": "User not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        if user.pk == request.user.pk and "is_admin" in request.data:
            return Response(
                {"status": "error", "message": "You cannot change your own admin role from this page."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if user.pk == request.user.pk and "is_active" in request.data and not bool(request.data.get("is_active")):
            return Response(
                {"status": "error", "message": "You cannot deactivate your own account."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        profile, _ = UserProfile.objects.get_or_create(user=user)
        fields_to_update = []

        if "is_admin" in request.data:
            user.is_staff = bool(request.data.get("is_admin"))
            fields_to_update.append("is_staff")

        if "is_active" in request.data:
            user.is_active = bool(request.data.get("is_active"))
            fields_to_update.append("is_active")
            profile.archived_at = None if user.is_active else timezone.now()
            profile.save(update_fields=["archived_at"])

        if fields_to_update:
            user.save(update_fields=fields_to_update)

        refreshed_user = _get_admin_users_queryset().get(pk=user.pk)
        return Response(
            {
                "status": "success",
                "message": "User updated successfully",
                "data": _user_metrics(request, refreshed_user),
            },
            status=status.HTTP_200_OK,
        )


class AdminUserActivityView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request, pk):
        try:
            user = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response(
                {"status": "error", "message": "User not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        limit = request.query_params.get("limit")
        activities = LoginActivity.objects.filter(user=user).order_by("-logged_in_at")
        if limit:
            try:
                activities = activities[: max(int(limit), 1)]
            except ValueError:
                pass

        payload = [_serialise_login_activity(activity) for activity in activities]
        return Response(
            {"status": "success", "count": len(payload), "data": payload},
            status=status.HTTP_200_OK,
        )


class AdminInsightsView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        users = list(_get_admin_users_queryset())
        user_payload = [_user_metrics(request, user) for user in users]
        active_checklists = Checklist.objects.filter(is_archived=False).prefetch_related("items", "created_by")
        archived_checklists_count = Checklist.objects.filter(is_archived=True).count()
        total_checklists = active_checklists.count()
        item_queryset = ChecklistItem.objects.filter(checklist__is_archived=False)
        total_items = item_queryset.count()
        completed_items = item_queryset.filter(is_completed=True).count()
        pending_items = max(total_items - completed_items, 0)
        item_completion_rate = round((completed_items / total_items) * 100, 2) if total_items else 0
        avg_completion_rate = round(
            sum(payload["completion_rate"] for payload in user_payload) / len(user_payload),
            2,
        ) if user_payload else 0

        return Response(
            {
                "status": "success",
                "data": {
                    "total_users": len(user_payload),
                    "active_users": sum(1 for payload in user_payload if payload["is_active"]),
                    "inactive_users": sum(1 for payload in user_payload if not payload["is_active"]),
                    "total_checklists": total_checklists,
                    "archived_checklists": archived_checklists_count,
                    "total_checklist_items": total_items,
                    "total_completed_items": completed_items,
                    "total_pending_items": pending_items,
                    "avg_completion_rate": avg_completion_rate,
                    "total_items": total_items,
                    "completed_items": completed_items,
                    "pending_items": pending_items,
                    "item_completion_rate": item_completion_rate,
                },
            },
            status=status.HTTP_200_OK,
        )


class AdminChecklistListCreateView(APIView):
    permission_classes = [IsAdminUser]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request):
        checklists = (
            Checklist.objects.filter(is_archived=False)
            .select_related("created_by")
            .prefetch_related("items")
            .order_by("-created_at", "created_by__email", "name")
        )

        search = request.query_params.get("search", "").strip()
        checklist_type = request.query_params.get("type", "").strip()
        creator = request.query_params.get("creator", "").strip()
        date_from = request.query_params.get("date_from", "").strip()
        date_to = request.query_params.get("date_to", "").strip()

        if search:
            checklists = checklists.filter(
                Q(name__icontains=search) |
                Q(type__icontains=search) |
                Q(created_by__email__icontains=search)
            )

        if checklist_type:
            checklists = checklists.filter(type__iexact=checklist_type)

        if creator:
            checklists = checklists.filter(created_by__email__icontains=creator)

        if date_from:
            checklists = checklists.filter(created_at__date__gte=date_from)

        if date_to:
            checklists = checklists.filter(created_at__date__lte=date_to)

        payload = [_serialize_admin_checklist(request, checklist) for checklist in checklists]
        return Response({"status": "success", "count": len(payload), "data": payload}, status=status.HTTP_200_OK)

    def post(self, request):
        owner_id = request.data.get("created_by_id")
        if not owner_id:
            return Response(
                {"status": "error", "message": "created_by_id is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            owner = User.objects.get(pk=owner_id)
        except User.DoesNotExist:
            return Response(
                {"status": "error", "message": "User not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        name = request.data.get("name")
        if name and Checklist.objects.filter(name=name, created_by=owner).exists():
            return Response(
                {
                    "status": "error",
                    "message": "A checklist with this name already exists",
                    "errors": {"name": ["Checklist with this name already exists."]},
                },
                status=status.HTTP_409_CONFLICT,
            )

        serializer = ChecklistSerializer(data=request.data, context={"request": request})
        if not serializer.is_valid():
            return Response(
                {
                    "status": "error",
                    "message": "Validation failed",
                    "errors": serializer.errors,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        checklist = serializer.save(created_by=owner)
        checklist.refresh_from_db()
        return Response(
            {
                "status": "success",
                "message": "Checklist created successfully",
                "data": _serialize_admin_checklist(request, checklist),
            },
            status=status.HTTP_201_CREATED,
        )


class AdminChecklistDetailView(APIView):
    permission_classes = [IsAdminUser]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def patch(self, request, pk):
        try:
            checklist = Checklist.objects.select_related("created_by").prefetch_related("items").get(pk=pk)
        except Checklist.DoesNotExist:
            return Response(
                {"status": "error", "message": "Checklist not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        owner = checklist.created_by
        owner_id = request.data.get("created_by_id")
        if owner_id:
            try:
                owner = User.objects.get(pk=owner_id)
            except User.DoesNotExist:
                return Response(
                    {"status": "error", "message": "User not found"},
                    status=status.HTTP_404_NOT_FOUND,
                )

        name = request.data.get("name")
        if name and Checklist.objects.filter(name=name, created_by=owner).exclude(pk=checklist.pk).exists():
            return Response(
                {
                    "status": "error",
                    "message": "A checklist with this name already exists",
                    "errors": {"name": ["Checklist with this name already exists."]},
                },
                status=status.HTTP_409_CONFLICT,
            )

        serializer = ChecklistSerializer(
            checklist,
            data=request.data,
            partial=True,
            context={"request": request},
        )
        if not serializer.is_valid():
            return Response(
                {
                    "status": "error",
                    "message": "Validation failed",
                    "errors": serializer.errors,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        checklist = serializer.save(created_by=owner)
        checklist.refresh_from_db()
        return Response(
            {
                "status": "success",
                "message": "Checklist updated successfully",
                "data": _serialize_admin_checklist(request, checklist),
            },
            status=status.HTTP_200_OK,
        )

    def delete(self, request, pk):
        try:
            checklist = Checklist.objects.get(pk=pk)
        except Checklist.DoesNotExist:
            return Response(
                {"status": "error", "message": "Checklist not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        checklist.delete()
        return Response(
            {"status": "success", "message": "Checklist deleted successfully"},
            status=status.HTTP_200_OK,
        )


class AdminChecklistItemListCreateView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request, checklist_pk):
        try:
            checklist = (
                Checklist.objects.select_related("created_by")
                .prefetch_related("items")
                .get(pk=checklist_pk, is_archived=False)
            )
        except Checklist.DoesNotExist:
            return Response(
                {"status": "error", "message": "Checklist not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        items = checklist.items.all()
        search = request.query_params.get("search", "").strip()
        item_type = request.query_params.get("type", "").strip()
        status_filter = request.query_params.get("status", "").strip().lower()
        priority = request.query_params.get("priority", "").strip().lower()
        date_from = request.query_params.get("date_from", "").strip()
        date_to = request.query_params.get("date_to", "").strip()

        if search:
            items = items.filter(Q(label__icontains=search) | Q(type__icontains=search))

        if item_type:
            items = items.filter(type__icontains=item_type)

        if status_filter == "completed":
            items = items.filter(is_completed=True)
        elif status_filter == "pending":
            items = items.filter(is_completed=False)

        if priority:
            items = items.filter(priority=priority)

        if date_from:
            items = items.filter(created_at__date__gte=date_from)

        if date_to:
            items = items.filter(created_at__date__lte=date_to)

        payload = [_serialize_admin_item(item) for item in items]
        return Response(
            {"status": "success", "count": len(payload), "data": payload},
            status=status.HTTP_200_OK,
        )

    def post(self, request, checklist_pk):
        try:
            checklist = Checklist.objects.get(pk=checklist_pk, is_archived=False)
        except Checklist.DoesNotExist:
            return Response(
                {"status": "error", "message": "Checklist not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = ChecklistItemSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {"status": "error", "message": "Validation failed", "errors": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            max_position = checklist.items.order_by("-position").values_list("position", flat=True).first() or 0
            item = serializer.save(checklist=checklist, position=max_position + 1)
        except IntegrityError:
            return Response(
                {
                    "status": "error",
                    "message": "An item with this label already exists in this checklist.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            {
                "status": "success",
                "message": "Checklist item created successfully",
                "data": _serialize_admin_item(item),
            },
            status=status.HTTP_201_CREATED,
        )


class AdminChecklistItemDetailView(APIView):
    permission_classes = [IsAdminUser]

    def patch(self, request, checklist_pk, pk):
        try:
            item = ChecklistItem.objects.select_related("checklist", "checklist__created_by").get(
                pk=pk,
                checklist_id=checklist_pk,
                checklist__is_archived=False,
            )
        except ChecklistItem.DoesNotExist:
            return Response(
                {"status": "error", "message": "Checklist item not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = ChecklistItemSerializer(item, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(
                {"status": "error", "message": "Validation failed", "errors": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            item = serializer.save()
            if "is_completed" in serializer.validated_data:
                item.completed_at = timezone.now() if item.is_completed else None
                item.save(update_fields=["completed_at"])
        except IntegrityError:
            return Response(
                {
                    "status": "error",
                    "message": "An item with this label already exists in this checklist.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            {
                "status": "success",
                "message": "Checklist item updated successfully",
                "data": _serialize_admin_item(item),
            },
            status=status.HTTP_200_OK,
        )

    def delete(self, request, checklist_pk, pk):
        try:
            item = ChecklistItem.objects.get(pk=pk, checklist_id=checklist_pk)
        except ChecklistItem.DoesNotExist:
            return Response(
                {"status": "error", "message": "Checklist item not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        item.delete()
        return Response(
            {"status": "success", "message": "Checklist item deleted successfully"},
            status=status.HTTP_200_OK,
        )
