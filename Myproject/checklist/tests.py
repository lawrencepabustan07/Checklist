# checklist/tests.py - LAHAT NG TEST DITO!
import jwt
import os
import tempfile
import uuid
from datetime import datetime, timedelta
from unittest.mock import Mock, patch

from django.conf import settings
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.db import IntegrityError
from django.http import HttpRequest
from django.test import TestCase
from django.test import override_settings
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient, APITestCase
from rest_framework.exceptions import AuthenticationFailed
from unittest.mock import patch, Mock, PropertyMock

from .models import Checklist, ChecklistItem, UserProfile
from .serializers import ChecklistSerializer, ChecklistItemSerializer
from .auth.authentication import Auth0Authentication
from .views.error_handlers import error_404, error_500


# ============================================================
# Helpers
# ============================================================
def _make_jwt(user, exp_delta=timedelta(days=1)):
    """Return a valid HS256 JWT for *user*."""
    return jwt.encode(
        {
            "user_id": user.id,
            "email": user.email,
            "exp": datetime.utcnow() + exp_delta,
        },
        settings.SECRET_KEY,
        algorithm="HS256",
    )


# ============================================================
# 1. MODEL TESTS
# ============================================================
class ChecklistModelTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="model-user", email="model@example.com", password="pass1234"
        )
        self.checklist = Checklist.objects.create(
            name="Morning Tasks", type="Daily", created_by=self.user
        )

    def test_valid_checklist_string_representation(self):
        self.assertEqual(str(self.checklist), "Morning Tasks (Daily)")

    def test_checklist_requires_non_empty_name(self):
        checklist = Checklist(name="   ", type="Daily", created_by=self.user)
        with self.assertRaises(ValidationError):
            checklist.full_clean()

    def test_checklist_requires_minimum_name_length(self):
        checklist = Checklist(name="ab", type="Daily", created_by=self.user)
        with self.assertRaises(ValidationError):
            checklist.full_clean()
            
    def test_checklist_requires_non_empty_type(self):
        checklist = Checklist(name="Test", type="   ", created_by=self.user)
        with self.assertRaises(ValidationError):
            checklist.full_clean()

    def test_checklist_name_max_length(self):
        checklist = Checklist(name="a" * 256, type="Daily", created_by=self.user)
        with self.assertRaises(ValidationError):
            checklist.full_clean()


class ChecklistItemModelTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="model-user", email="model@example.com", password="pass1234"
        )
        self.checklist = Checklist.objects.create(
            name="Morning Tasks", type="Daily", created_by=self.user
        )

    def test_checklist_item_requires_non_empty_label(self):
        item = ChecklistItem(checklist=self.checklist, label="   ", type="Task")
        with self.assertRaises(ValidationError):
            item.full_clean()
            
    def test_checklist_item_requires_non_empty_type(self):
        item = ChecklistItem(checklist=self.checklist, label="Valid", type="   ")
        with self.assertRaises(ValidationError):
            item.full_clean()
            
    def test_valid_item_string_representation(self):
        item = ChecklistItem(checklist=self.checklist, label="Brush teeth", type="Task")
        self.assertEqual(str(item), "Brush teeth (Task)")


@override_settings(MEDIA_ROOT=tempfile.mkdtemp())
class UserProfileModelTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="profile-user", email="profile@example.com", password="pass1234"
        )

    def test_delete_removes_avatar_file_from_disk(self):
        avatar = SimpleUploadedFile(
            "avatar.png",
            b"\x89PNG\r\n\x1a\nfakepngdata",
            content_type="image/png",
        )
        profile = UserProfile.objects.create(user=self.user, avatar=avatar)
        avatar_path = profile.avatar.path

        self.assertTrue(os.path.exists(avatar_path))

        profile.delete()

        self.assertFalse(os.path.exists(avatar_path))

    def test_delete_without_avatar_does_not_fail(self):
        profile = UserProfile.objects.create(user=self.user)
        profile.delete()
        self.assertFalse(UserProfile.objects.filter(user=self.user).exists())


# ============================================================
# 2. SERIALIZER TESTS
# ============================================================
class ChecklistSerializerTests(TestCase):
    def test_valid_checklist_serializer(self):
        data = {"name": "Sprint Review", "type": "Weekly"}
        s = ChecklistSerializer(data=data)
        self.assertTrue(s.is_valid())

    def test_invalid_type_checklist_serializer(self):
        data = {"name": "Sprint Review", "type": "Hourly"}
        s = ChecklistSerializer(data=data)
        self.assertFalse(s.is_valid())
        self.assertIn("type", s.errors)

    def test_serializer_returns_default_image_url_when_missing_image(self):
        user = User.objects.create_user(
            username="serializer-user", email="serializer@example.com", password="pass1234"
        )
        checklist = Checklist.objects.create(
            name="Checklist Without Image",
            type="Daily",
            created_by=user,
        )

        serializer = ChecklistSerializer(instance=checklist)

        self.assertTrue(serializer.data["image_url"].endswith("/media/checklists/default-checklist.svg"))


class ChecklistItemSerializerTests(TestCase):
    def test_valid_item_serializer(self):
        s = ChecklistItemSerializer(data={"label": "Write docs", "type": "Task"})
        self.assertTrue(s.is_valid())


# ============================================================
# 3. REGISTER/AUTH TESTS
# ============================================================

class Auth0LoginViewTests(APITestCase):
    URL = "/api/auth/login/"

    def test_missing_email_or_password(self):
        response = self.client.post(self.URL, {"password": "secret"}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["status"], "error")

    @patch("checklist.auth.views.requests.post")
    def test_invalid_credentials_returns_401(self, mock_post):
        mock_post.return_value = Mock(status_code=403, json=Mock(return_value={}))
        response = self.client.post(
            self.URL, {"email": "a@b.com", "password": "wrong"}, format="json"
        )
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.data["status"], "error")

    @patch("checklist.auth.views.requests.post")
    def test_valid_credentials_returns_200_with_token(self, mock_post):
        mock_post.return_value = Mock(
            status_code=200,
            json=Mock(
                return_value={
                    "access_token": "tok123",
                    "token_type": "Bearer",
                    "expires_in": 86400,
                }
            ),
        )
        response = self.client.post(
            self.URL, {"email": "a@b.com", "password": "correct"}, format="json"
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], "success")

class Auth0UserViewTests(APITestCase):
    URL = "/api/auth/user/"

    def setUp(self):
        self.user = User.objects.create_user(
            username="userview", email="userview@example.com", password="pass"
        )

    def test_authenticated_returns_user_info(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get(self.URL)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["data"]["email"], self.user.email)
        self.assertIn("avatar_url", response.data["data"])

    @override_settings(MEDIA_ROOT=tempfile.mkdtemp())
    def test_authenticated_user_can_update_avatar(self):
        self.client.force_authenticate(user=self.user)
        avatar = SimpleUploadedFile(
            "avatar.png",
            b"\x89PNG\r\n\x1a\nfakepngdata",
            content_type="image/png",
        )

        response = self.client.patch(self.URL, {"avatar": avatar}, format="multipart")

        self.assertEqual(response.status_code, 200)
        self.user.refresh_from_db()
        self.assertTrue(bool(self.user.profile.avatar))


class RegisterViewTests(APITestCase):
    def setUp(self):
        self.url = "/api/auth/register/"

    def test_register_requires_method_and_credential(self):
        response = self.client.post(self.url, {}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["status"], "error")

    def test_register_rejects_unsupported_method(self):
        response = self.client.post(
            self.url,
            {"method": "google", "credential": "token"},
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["message"], "Unsupported method")

    @patch("checklist.auth.views.requests.get")
    def test_register_creates_user_and_returns_jwt(self, mock_get):
        mock_get.return_value = Mock(
            status_code=200,
            json=Mock(return_value={"email": "newuser@example.com"}),
        )
        response = self.client.post(
            self.url,
            {"method": "auth0", "credential": "valid-token"},
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["status"], "success")
        self.assertEqual(response.data["email"], "newuser@example.com")
        self.assertTrue(User.objects.filter(email="newuser@example.com").exists())
        self.assertTrue(UserProfile.objects.filter(user__email="newuser@example.com").exists())

    @patch("checklist.auth.views.requests.get")
    def test_register_returns_401_when_userinfo_verification_fails(self, mock_get):
        mock_get.return_value = Mock(status_code=401, text="bad token")
        response = self.client.post(
            self.url,
            {"method": "auth0", "credential": "bad-token"},
            format="json",
        )
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.data["status"], "error")


class Auth0AuthenticationTests(TestCase):
    def setUp(self):
        self.auth = Auth0Authentication()
        self.user = User.objects.create_user(
            username="auth-user", email="auth@example.com", password="pass"
        )

    def _request(self, header=""):
        request = Mock()
        request.headers = {"Authorization": header}
        return request

    def test_no_auth_header_returns_none(self):
        self.assertIsNone(self.auth.authenticate(self._request("")))

    def test_valid_hs256_token_authenticates_user(self):
        token = _make_jwt(self.user)
        result = self.auth.authenticate(self._request(f"Bearer {token}"))
        self.assertIsNotNone(result)
        self.assertEqual(result[0], self.user)

    def test_expired_hs256_token_raises_authentication_failed(self):
        token = _make_jwt(self.user, exp_delta=timedelta(seconds=-1))
        with self.assertRaises(AuthenticationFailed):
            self.auth.authenticate(self._request(f"Bearer {token}"))

    def test_authenticate_header_returns_bearer(self):
        self.assertEqual(self.auth.authenticate_header(Mock()), "Bearer")

    @patch("checklist.auth.authentication.jwt.decode")
    @patch("checklist.auth.authentication.jwt.PyJWKClient")
    def test_rs256_token_authenticates_user_with_email(self, mock_jwk_client, mock_decode):
        signing_key = Mock()
        signing_key.key = "public-key"
        mock_jwk_client.return_value.get_signing_key_from_jwt.return_value = signing_key
        mock_decode.side_effect = [
            jwt.InvalidTokenError("invalid hs256"),
            {"email": "rs256@example.com"},
        ]

        result = self.auth.authenticate(self._request("Bearer rs256-token"))

        self.assertEqual(result[0].email, "rs256@example.com")
        self.assertTrue(UserProfile.objects.filter(user=result[0]).exists())

    @patch("checklist.auth.authentication.jwt.decode")
    @patch("checklist.auth.authentication.jwt.PyJWKClient")
    def test_rs256_token_uses_namespaced_email_when_email_missing(self, mock_jwk_client, mock_decode):
        signing_key = Mock()
        signing_key.key = "public-key"
        mock_jwk_client.return_value.get_signing_key_from_jwt.return_value = signing_key
        mock_decode.side_effect = [
            jwt.InvalidTokenError("invalid hs256"),
            {"https://checklist-api.com/email": "fallback@example.com"},
        ]

        result = self.auth.authenticate(self._request("Bearer rs256-token"))

        self.assertEqual(result[0].email, "fallback@example.com")

    @patch("checklist.auth.authentication.jwt.decode")
    @patch("checklist.auth.authentication.jwt.PyJWKClient")
    def test_rs256_token_without_email_raises_authentication_failed(self, mock_jwk_client, mock_decode):
        signing_key = Mock()
        signing_key.key = "public-key"
        mock_jwk_client.return_value.get_signing_key_from_jwt.return_value = signing_key
        mock_decode.side_effect = [
            jwt.InvalidTokenError("invalid hs256"),
            {"sub": "auth0|123"},
        ]

        with self.assertRaises(AuthenticationFailed):
            self.auth.authenticate(self._request("Bearer rs256-token"))

    @patch("checklist.auth.authentication.jwt.decode")
    @patch("checklist.auth.authentication.jwt.PyJWKClient")
    def test_rs256_expired_token_raises_authentication_failed(self, mock_jwk_client, mock_decode):
        signing_key = Mock()
        signing_key.key = "public-key"
        mock_jwk_client.return_value.get_signing_key_from_jwt.return_value = signing_key
        mock_decode.side_effect = [
            jwt.InvalidTokenError("invalid hs256"),
            jwt.ExpiredSignatureError("expired"),
        ]

        with self.assertRaises(AuthenticationFailed):
            self.auth.authenticate(self._request("Bearer rs256-token"))

    @patch("checklist.auth.authentication.jwt.decode")
    @patch("checklist.auth.authentication.jwt.PyJWKClient")
    def test_rs256_invalid_token_raises_authentication_failed(self, mock_jwk_client, mock_decode):
        signing_key = Mock()
        signing_key.key = "public-key"
        mock_jwk_client.return_value.get_signing_key_from_jwt.return_value = signing_key
        mock_decode.side_effect = [
            jwt.InvalidTokenError("invalid hs256"),
            jwt.InvalidTokenError("invalid rs256"),
        ]

        with self.assertRaises(AuthenticationFailed):
            self.auth.authenticate(self._request("Bearer rs256-token"))

    @patch("checklist.auth.authentication.jwt.decode")
    @patch("checklist.auth.authentication.jwt.PyJWKClient")
    def test_rs256_unexpected_error_raises_authentication_failed(self, mock_jwk_client, mock_decode):
        mock_jwk_client.side_effect = Exception("jwks down")
        mock_decode.side_effect = [jwt.InvalidTokenError("invalid hs256")]

        with self.assertRaises(AuthenticationFailed):
            self.auth.authenticate(self._request("Bearer rs256-token"))


# ============================================================
# 4. CHECKLIST API TESTS
# ============================================================

@override_settings(MEDIA_ROOT=tempfile.mkdtemp())
class ChecklistApiTests(APITestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="owner", email="owner@example.com", password="pass1234"
        )
        self.other_user = User.objects.create_user(
            username="other", email="other@example.com", password="pass1234"
        )
        self.client.force_authenticate(user=self.user)

    def test_list_returns_only_authenticated_users_checklists(self):
        owned = Checklist.objects.create(
            name="Owned Checklist",
            type="Daily",
            created_by=self.user,
        )
        Checklist.objects.create(
            name="Other Checklist",
            type="Weekly",
            created_by=self.other_user,
        )
        response = self.client.get("/api/checklist/")
        self.assertEqual(response.status_code, 200)
        # Fix the assertion: response.data has "data" and "count"
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(len(response.data["data"]), 1)
        self.assertEqual(response.data["data"][0]['id'], str(owned.id))
        
    def test_retrieve_checklist(self):
        owned = Checklist.objects.create(
            name="Owned Checklist", type="Daily", created_by=self.user,
        )
        response = self.client.get(f"/api/checklist/{owned.id}/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["data"]["id"], str(owned.id))

    def test_create_checklist_assigns_authenticated_user(self):
        response = self.client.post(
            "/api/checklist/",
            {"name": "Sprint Prep", "type": "Weekly"},
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        checklist = Checklist.objects.get(name="Sprint Prep")
        self.assertEqual(checklist.created_by, self.user)
        self.assertEqual(response.data["status"], "success")
        self.assertFalse(checklist.is_archived)

    def test_create_checklist_with_image_upload(self):
        image = SimpleUploadedFile(
            "cover.png",
            b"\x89PNG\r\n\x1a\nfakepngdata",
            content_type="image/png",
        )

        response = self.client.post(
            "/api/checklist/",
            {"name": "Photo Checklist", "type": "Weekly", "image": image},
            format="multipart",
        )

        self.assertEqual(response.status_code, 201)
        checklist = Checklist.objects.get(name="Photo Checklist")
        self.assertTrue(bool(checklist.image))
        self.assertIn("/media/checklists/", response.data["data"]["image_url"])

    def test_create_checklist_rejects_invalid_image_type(self):
        bad_file = SimpleUploadedFile(
            "cover.gif",
            b"GIF89a",
            content_type="image/gif",
        )

        response = self.client.post(
            "/api/checklist/",
            {"name": "Bad Image", "type": "Weekly", "image": bad_file},
            format="multipart",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("image", response.data["errors"])

    def test_create_checklist_rejects_large_image(self):
        large_file = SimpleUploadedFile(
            "large.png",
            b"a" * (2 * 1024 * 1024 + 1),
            content_type="image/png",
        )

        response = self.client.post(
            "/api/checklist/",
            {"name": "Large Image", "type": "Weekly", "image": large_file},
            format="multipart",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("image", response.data["errors"])

    def test_create_duplicate_checklist_name_for_same_user_returns_409(self):
        Checklist.objects.create(
            name="Sprint Prep",
            type="Weekly",
            created_by=self.user,
        )
        response = self.client.post(
            "/api/checklist/",
            {"name": "Sprint Prep", "type": "Daily"},
            format="json",
        )
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data["status"], "error")
        
    def test_update_checklist(self):
        cl = Checklist.objects.create(
            name="Old Name", type="Daily", created_by=self.user
        )
        response = self.client.put(
            f"/api/checklist/{cl.id}/",
            {"name": "New Name", "type": "Weekly"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        cl.refresh_from_db()
        self.assertEqual(cl.name, "New Name")

    def test_update_checklist_can_remove_existing_image(self):
        image = SimpleUploadedFile(
            "cover.png",
            b"\x89PNG\r\n\x1a\nfakepngdata",
            content_type="image/png",
        )
        checklist = Checklist.objects.create(
            name="Image Checklist",
            type="Daily",
            created_by=self.user,
            image=image,
        )

        response = self.client.patch(
            f"/api/checklist/{checklist.id}/",
            {"name": checklist.name, "type": checklist.type, "remove_image": "true"},
            format="multipart",
        )

        self.assertEqual(response.status_code, 200)
        checklist.refresh_from_db()
        self.assertFalse(bool(checklist.image))
        self.assertTrue(response.data["data"]["image_url"].endswith("/media/checklists/default-checklist.svg"))
        
    def test_update_to_duplicate_name_returns_409(self):
        Checklist.objects.create(name="First List", type="Daily", created_by=self.user)
        second = Checklist.objects.create(name="Second List", type="Weekly", created_by=self.user)
        response = self.client.put(
            f"/api/checklist/{second.id}/",
            {"name": "First List", "type": "Daily"},
            format="json",
        )
        self.assertEqual(response.status_code, 409)
        
    def test_destroy_checklist(self):
        cl = Checklist.objects.create(
            name="To Delete", type="Daily", created_by=self.user
        )
        response = self.client.delete(f"/api/checklist/{cl.id}/")
        self.assertEqual(response.status_code, 200)
        cl.refresh_from_db()
        self.assertTrue(cl.is_archived)

    def test_archived_checklist_not_returned_in_default_list(self):
        Checklist.objects.create(
            name="Archived Checklist",
            type="Daily",
            created_by=self.user,
            is_archived=True,
        )

        response = self.client.get("/api/checklist/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 0)

    def test_archived_endpoint_returns_archived_checklists(self):
        archived = Checklist.objects.create(
            name="Archived Checklist Two",
            type="Daily",
            created_by=self.user,
            is_archived=True,
        )

        response = self.client.get("/api/checklist/archived/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["data"][0]["id"], str(archived.id))

    def test_restore_archived_checklist(self):
        archived = Checklist.objects.create(
            name="Archived Checklist Restore",
            type="Daily",
            created_by=self.user,
            is_archived=True,
        )

        response = self.client.post(f"/api/checklist/{archived.id}/restore/")

        self.assertEqual(response.status_code, 200)
        archived.refresh_from_db()
        self.assertFalse(archived.is_archived)

    # ✅ BAGONG TESTS
    def test_get_nonexistent_checklist_returns_404(self):
        response = self.client.get("/api/checklist/99999/")
        self.assertEqual(response.status_code, 404)

    def test_update_nonexistent_checklist_returns_404(self):
        response = self.client.patch(
            "/api/checklist/99999/",
            {"name": "Updated"},
            format="json"
        )
        self.assertEqual(response.status_code, 404)

    def test_destroy_nonexistent_checklist_returns_404(self):
        response = self.client.delete("/api/checklist/99999/")
        self.assertEqual(response.status_code, 404)

    def test_create_checklist_with_invalid_type(self):
        response = self.client.post(
            "/api/checklist/",
            {"name": "Test Checklist", "type": "InvalidType"},
            format="json"
        )
        self.assertEqual(response.status_code, 400)

    def test_cannot_access_other_users_checklist(self):
        other_checklist = Checklist.objects.create(
            name="Other's Checklist", type="Daily", created_by=self.other_user
        )
        response = self.client.get(f"/api/checklist/{other_checklist.id}/")
        self.assertEqual(response.status_code, 404)

    def test_cannot_update_other_users_checklist(self):
        other_checklist = Checklist.objects.create(
            name="Other's Checklist", type="Daily", created_by=self.other_user
        )
        response = self.client.patch(
            f"/api/checklist/{other_checklist.id}/",
            {"name": "Hacked"},
            format="json"
        )
        self.assertEqual(response.status_code, 404)

    def test_update_checklist_with_invalid_data(self):
        checklist = Checklist.objects.create(
            name="Test", type="Daily", created_by=self.user
        )
        response = self.client.patch(
            f"/api/checklist/{checklist.id}/",
            {"name": ""},
            format="json"
        )
        self.assertEqual(response.status_code, 400)


# ============================================================
# 5. CHECKLIST ITEM API TESTS
# ============================================================

class ChecklistItemApiTests(APITestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="items-user", email="items@example.com", password="pass1234"
        )
        self.client.force_authenticate(user=self.user)
        self.checklist = Checklist.objects.create(
            name="Release Checklist",
            type="Monthly",
            created_by=self.user,
        )

    def test_create_item_under_checklist(self):
        response = self.client.post(
            f"/api/checklist/{self.checklist.id}/items/",
            {"label": "Draft release notes", "type": "Task"},
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertTrue(
            ChecklistItem.objects.filter(
                checklist=self.checklist,
                label="Draft release notes",
            ).exists()
        )
        item = ChecklistItem.objects.get(label="Draft release notes")
        self.assertFalse(item.is_completed)
        self.assertEqual(item.position, 1)

    def test_create_item_without_checklist_id_returns_400(self):
        response = self.client.post(
            "/api/items/",
            {"label": "Loose item", "type": "Task"},
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["error"], "Checklist ID is required")

    def test_list_items_for_checklist(self):
        item = ChecklistItem.objects.create(
            checklist=self.checklist,
            label="Tag release",
            type="Task",
        )
        response = self.client.get(f"/api/checklist/{self.checklist.id}/items/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["id"], str(item.id))

    def test_list_items_without_checklist_id_returns_400(self):
        response = self.client.get("/api/items/")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["error"], "Checklist ID is required")

    def test_retrieve_item(self):
        item = ChecklistItem.objects.create(
            checklist=self.checklist, label="Review PR", type="Task"
        )
        response = self.client.get(f"/api/checklist/{self.checklist.id}/items/{item.id}/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["id"], str(item.id))

    def test_update_item(self):
        item = ChecklistItem.objects.create(
            checklist=self.checklist,
            label="Prepare changelog",
            type="Task",
        )
        response = self.client.patch(
            f"/api/checklist/{self.checklist.id}/items/{item.id}/",
            {"label": "Prepare final changelog", "type": "Review"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        item.refresh_from_db()
        self.assertEqual(item.label, "Prepare final changelog")
        self.assertEqual(item.type, "Review")

    def test_update_item_duplicate_label_returns_400(self):
        item = ChecklistItem.objects.create(
            checklist=self.checklist,
            label="Editable",
            type="Task",
            position=2,
        )

        with patch("checklist.views.checklist_item_view.ChecklistItemSerializer.save", side_effect=IntegrityError):
            response = self.client.patch(
                f"/api/checklist/{self.checklist.id}/items/{item.id}/",
                {"label": "Existing"},
                format="json",
            )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.data["error"],
            "An item with this label already exists in this checklist.",
        )

    def test_toggle_item_completion(self):
        item = ChecklistItem.objects.create(
            checklist=self.checklist,
            label="Complete me",
            type="Task",
            position=1,
        )
        response = self.client.patch(
            f"/api/checklist/{self.checklist.id}/items/{item.id}/",
            {"is_completed": True},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        item.refresh_from_db()
        self.assertTrue(item.is_completed)

    def test_reorder_items(self):
        first = ChecklistItem.objects.create(
            checklist=self.checklist, label="First", type="Task", position=1
        )
        second = ChecklistItem.objects.create(
            checklist=self.checklist, label="Second", type="Task", position=2
        )

        response = self.client.post(
            f"/api/checklist/{self.checklist.id}/items/reorder/",
            {"ordered_ids": [str(second.id), str(first.id)]},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        first.refresh_from_db()
        second.refresh_from_db()
        self.assertEqual(first.position, 2)
        self.assertEqual(second.position, 1)

    def test_reorder_items_requires_list(self):
        response = self.client.post(
            f"/api/checklist/{self.checklist.id}/items/reorder/",
            {"ordered_ids": "not-a-list"},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["error"], "ordered_ids must be a list")

    def test_reorder_items_requires_every_item_exactly_once(self):
        item = ChecklistItem.objects.create(
            checklist=self.checklist, label="Only", type="Task", position=1
        )

        response = self.client.post(
            f"/api/checklist/{self.checklist.id}/items/reorder/",
            {"ordered_ids": []},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.data["error"],
            "ordered_ids must include every item in the checklist exactly once",
        )

    def test_reorder_items_nonexistent_checklist_returns_404(self):
        response = self.client.post(
            f"/api/checklist/{uuid.uuid4()}/items/reorder/",
            {"ordered_ids": []},
            format="json",
        )

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.data["error"], "Checklist not found")
        
#//
    def test_delete_item(self):
        item = ChecklistItem.objects.create(
            checklist=self.checklist,
            label="Ship release",
            type="Task",
        )
        response = self.client.delete(
            f"/api/checklist/{self.checklist.id}/items/{item.id}/"
        )
        self.assertEqual(response.status_code, 204)
        self.assertFalse(ChecklistItem.objects.filter(id=item.id).exists())

    # ✅ BAGONG TESTS
    def test_create_item_with_empty_label(self):
        response = self.client.post(
            f"/api/checklist/{self.checklist.id}/items/",
            {"label": "", "type": "Task"},
            format="json"
        )
        self.assertEqual(response.status_code, 400)

    def test_create_item_with_empty_type(self):
        response = self.client.post(
            f"/api/checklist/{self.checklist.id}/items/",
            {"label": "Valid Label", "type": ""},
            format="json"
        )
        self.assertEqual(response.status_code, 400)

    def test_get_nonexistent_item_returns_404(self):
        invalid_uuid = uuid.uuid4()
        response = self.client.get(
            f"/api/checklist/{self.checklist.id}/items/{invalid_uuid}/"
        )
        self.assertEqual(response.status_code, 404)
        
    def test_create_item_in_nonexistent_checklist_returns_404(self):
        invalid_uuid = uuid.uuid4()
        response = self.client.post(
            f"/api/checklist/{invalid_uuid}/items/",
            {"label": "Valid Label", "type": "Task"},
            format="json"
        )
        self.assertEqual(response.status_code, 404)

    def test_update_nonexistent_item_returns_404(self):
        invalid_uuid = uuid.uuid4()
        response = self.client.patch(
            f"/api/checklist/{self.checklist.id}/items/{invalid_uuid}/",
            {"label": "Updated"},
            format="json"
        )
        self.assertEqual(response.status_code, 404)

    def test_delete_nonexistent_item_returns_404(self):
        invalid_uuid = uuid.uuid4()
        response = self.client.delete(
            f"/api/checklist/{self.checklist.id}/items/{invalid_uuid}/"
        )
        self.assertEqual(response.status_code, 404)

    def test_update_item_with_invalid_data(self):
        item = ChecklistItem.objects.create(
            checklist=self.checklist, label="Test", type="Task"
        )
        response = self.client.patch(
            f"/api/checklist/{self.checklist.id}/items/{item.id}/",
            {"label": ""},
            format="json"
        )
        self.assertEqual(response.status_code, 400)


# ============================================================
# 6. AUTHENTICATION TESTS
# ============================================================

class AuthenticationTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", email="test@example.com", password="pass1234"
        )
        self.checklist = Checklist.objects.create(
            name="Test Checklist", type="Daily", created_by=self.user
        )

    def test_unauthenticated_access_to_checklists_returns_401(self):
        self.client.force_authenticate(user=None)
        response = self.client.get("/api/checklist/")
        self.assertEqual(response.status_code, 401)

    def test_unauthenticated_access_to_items_returns_401(self):
        self.client.force_authenticate(user=None)
        response = self.client.get(f"/api/checklist/{self.checklist.id}/items/")
        self.assertEqual(response.status_code, 401)

    def test_unauthenticated_create_checklist_returns_401(self):
        self.client.force_authenticate(user=None)
        response = self.client.post(
            "/api/checklist/",
            {"name": "New Checklist", "type": "Daily"},
            format="json"
        )
        self.assertEqual(response.status_code, 401)

    def test_invalid_token_returns_401(self):
        self.client.credentials(HTTP_AUTHORIZATION='Bearer invalid-token')
        response = self.client.get("/api/checklist/")
        self.assertEqual(response.status_code, 401)

    def test_auth0_token_validation_failure(self):
        with patch('checklist.auth.views.requests.get') as mock_get:
            mock_get.return_value = Mock(status_code=401)
            response = self.client.post(
                "/api/auth/register/",
                {"method": "auth0", "credential": "invalid"},
                format="json"
            )
            self.assertEqual(response.status_code, 401)


class ErrorHandlerTests(TestCase):
    def test_error_500_returns_expected_payload(self):
        response = error_500(HttpRequest())
        self.assertEqual(response.data["status"], "error")
        self.assertEqual(
            response.data["message"],
            "An unexpected error occurred on the server.",
        )

    def test_error_404_returns_expected_payload(self):
        response = error_404(HttpRequest(), Exception("missing"))
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.data["status"], "error")
        self.assertEqual(
            response.data["message"],
            "The requested resource was not found.",
        )
