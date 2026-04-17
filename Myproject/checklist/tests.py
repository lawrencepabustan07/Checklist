import jwt
from unittest.mock import Mock, patch

from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.test import TestCase
from rest_framework.test import APIClient, APITestCase

from .models import Checklist, ChecklistItem


class ChecklistModelTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="model-user", email="model@example.com", password="pass1234"
        )

    def test_checklist_requires_non_empty_name(self):
        checklist = Checklist(name="   ", type="Daily")

        with self.assertRaises(ValidationError):
            checklist.full_clean()

    def test_checklist_requires_minimum_name_length(self):
        checklist = Checklist(name="ab", type="Daily")

        with self.assertRaises(ValidationError):
            checklist.full_clean()

    def test_checklist_item_requires_non_empty_label(self):
        checklist = Checklist.objects.create(
            name="Morning Tasks",
            type="Daily",
            created_by=self.user,
        )
        item = ChecklistItem(checklist=checklist, label="   ", type="Task")

        with self.assertRaises(ValidationError):
            item.full_clean()


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

        payload = jwt.decode(
            response.data["access_token"],
            "django-insecure-&l=***y#zmmqtjzfng0urm%jhz!a7!sy7koi)=j7hie0&*ry9t",
            algorithms=["HS256"],
        )
        self.assertEqual(payload["email"], "newuser@example.com")

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
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["data"][0]["id"], str(owned.id))

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
