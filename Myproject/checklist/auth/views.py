import jwt as pyjwt
from datetime import datetime, timedelta
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
import requests
from django.conf import settings
from django.contrib.auth.models import User
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
    
    def get(self, request):
       
        return Response({
            'status': 'success',
            'data': {
                'id': request.user.id,
                'email': request.user.email,
                
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
            # ✅ Use Auth0's UserInfo endpoint (bypasses JWT decoding issues)
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

            # Get or create user
            user, created = User.objects.get_or_create(
                email=email,
                defaults={'username': email.split('@')[0]}
            )

            # Create your own JWT token
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


  