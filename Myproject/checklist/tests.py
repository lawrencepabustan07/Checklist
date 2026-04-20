# checklist/tests.py - LAHAT NG TEST DITO!
import jwt
import uuid
from datetime import datetime, timedelta
from unittest.mock import Mock, patch

from django.conf import settings
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.test import TestCase
from rest_framework.test import APIClient, APITestCase
from rest_framework.exceptions import AuthenticationFailed

from .models import Checklist, ChecklistItem
from .serializers import ChecklistSerializer, ChecklistItemSerializer
from .auth.authentication import Auth0Authentication


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


# ============================================================
# 4. CHECKLIST API TESTS
# ============================================================

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
        self.assertEqual(response.status_code, 204)
        self.assertFalse(Checklist.objects.filter(id=cl.id).exists())

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