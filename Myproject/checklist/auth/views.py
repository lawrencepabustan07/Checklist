import jwt as pyjwt
import os
from datetime import datetime, timedelta
from django.core.files.uploadedfile import UploadedFile
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
import requests
from django.conf import settings
from django.contrib.auth.models import User
from checklist.models import UserProfile


DEFAULT_AVATAR_URL = f"{settings.MEDIA_URL}profiles/default-avatar.svg"


def get_or_create_profile(user):
    profile, _ = UserProfile.objects.get_or_create(user=user)
    return profile


def get_avatar_url(request, profile):
    avatar_url = profile.avatar.url if profile.avatar else DEFAULT_AVATAR_URL
    return request.build_absolute_uri(avatar_url)


def validate_avatar(file: UploadedFile | None):
    if not file:
        return None

    max_size = 2 * 1024 * 1024
    allowed_extensions = {".jpg", ".jpeg", ".png", ".webp"}
    allowed_content_types = {"image/jpeg", "image/png", "image/webp"}
    extension = os.path.splitext(file.name)[1].lower()

    if extension not in allowed_extensions:
        return "Only JPG, PNG, and WEBP images are allowed."
    if getattr(file, "size", 0) > max_size:
        return "Image must be 2MB or smaller."
    if getattr(file, "content_type", None) and file.content_type not in allowed_content_types:
        return "Only JPG, PNG, and WEBP images are allowed."
    return None

class Auth0LoginView(APIView):
    """
    POST /api/auth/login/
    """
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get('email')
        password = request.data.get('password')
        
        if not email or not password:
            return Response({
                'status': 'error',
                'message': 'Email and password required'
            }, status=400)
        
        response = requests.post(
            f'https://{settings.AUTH0_DOMAIN}/oauth/token',
            json={
                'grant_type': 'password',
                'username': email,
                'password': password,
                'client_id': settings.AUTH0_CLIENT_ID,
                'client_secret': settings.AUTH0_CLIENT_SECRET,
                'audience': settings.AUTH0_AUDIENCE,
                'scope': 'openid profile email'
            }
        )
        
        if response.status_code != 200:
            return Response({
                'status': 'error',
                'message': 'Invalid credentials'
            }, status=401)
        
        data = response.json()
        
        return Response({
            'status': 'success',
            'data': {
                'access_token': data['access_token'],
                'token_type': data['token_type'],
                'expires_in': data['expires_in']
            }
        }, status=200)


class Auth0UserView(APIView):
    """
    GET /api/auth/user/
    """
    permission_classes = [IsAuthenticated] 
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    
    def get(self, request):
        profile = get_or_create_profile(request.user)
        return Response({
            'status': 'success',
            'data': {
                'id': request.user.id,
                'email': request.user.email,
                'avatar_url': get_avatar_url(request, profile),
            }
        }, status=200)

    def patch(self, request):
        profile = get_or_create_profile(request.user)
        remove_avatar = str(request.data.get('remove_avatar', '')).lower() == 'true'
        avatar = request.FILES.get('avatar')

        validation_error = validate_avatar(avatar)
        if validation_error:
            return Response({
                'status': 'error',
                'errors': {'avatar': [validation_error]}
            }, status=400)

        old_avatar = profile.avatar
        if remove_avatar:
            profile.avatar = None
        elif avatar:
            profile.avatar = avatar

        profile.save()
        if old_avatar and (remove_avatar or avatar) and old_avatar.name != getattr(profile.avatar, 'name', None):
            old_avatar.delete(save=False)

        return Response({
            'status': 'success',
            'data': {
                'id': request.user.id,
                'email': request.user.email,
                'avatar_url': get_avatar_url(request, profile),
            }
        }, status=200)


class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        method = request.data.get('method')
        credential = request.data.get('credential')

        if not method or not credential:
            return Response({
                'status': 'error',
                'message': 'method and credential are required'
            }, status=400)

        if method != 'auth0':
            return Response({
                'status': 'error',
                'message': 'Unsupported method'
            }, status=400)

        try:
            
            userinfo_url = f'https://{settings.AUTH0_DOMAIN}/userinfo'
            headers = {'Authorization': f'Bearer {credential}'}
            
            response = requests.get(userinfo_url, headers=headers)
            
            if response.status_code != 200:
                print(f"UserInfo error: {response.status_code} - {response.text}")
                return Response({
                    'status': 'error',
                    'message': 'Failed to verify token'
                }, status=401)
            
            user_data = response.json()
            email = user_data.get('email')
            
            if not email:
                return Response({
                    'status': 'error', 
                    'message': 'No email in token'
                }, status=400)

            
            user, created = User.objects.get_or_create(
                email=email,
                defaults={'username': email.split('@')[0]}
            )
            get_or_create_profile(user)

            
            access_token = pyjwt.encode({
                'user_id': user.id,
                'email': user.email,
                'exp': datetime.utcnow() + timedelta(days=1)
            }, settings.SECRET_KEY, algorithm='HS256')

            return Response({
                'status': 'success',
                'access_token': access_token,
                'email': user.email
            }, status=201 if created else 200)

        except Exception as e:
            print(f"Register error: {str(e)}")
            import traceback
            traceback.print_exc()
            return Response({
                'status': 'error',
                'message': str(e)
            }, status=401)


  
