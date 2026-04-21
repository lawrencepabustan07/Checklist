from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
import jwt
from django.contrib.auth.models import User
from django.conf import settings
from checklist.models import UserProfile


class Auth0Authentication(BaseAuthentication):

    def authenticate(self, request):
        auth_header = request.headers.get('Authorization', '')

        if not auth_header or not auth_header.startswith('Bearer '):
            return None

        token = auth_header.split(' ')[1]

      
        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=['HS256'])
            user = User.objects.get(id=payload['user_id'])
            UserProfile.objects.get_or_create(user=user)
            return (user, token)
        except jwt.ExpiredSignatureError:
            raise AuthenticationFailed('Token expired')
        except (jwt.InvalidTokenError, User.DoesNotExist, KeyError):
            pass

        
        try:
            jwks_url = f'https://{settings.AUTH0_DOMAIN}/.well-known/jwks.json'
            jwks_client = jwt.PyJWKClient(jwks_url)
            signing_key = jwks_client.get_signing_key_from_jwt(token)

            payload = jwt.decode(
                token,
                signing_key.key,
                algorithms=['RS256'],
                audience=settings.AUTH0_AUDIENCE,
                issuer=f'https://{settings.AUTH0_DOMAIN}/'
            )

           
            email = (
                payload.get('email') or 
                payload.get('https://checklist-api.com/email') or
                payload.get('https://checklist-api.com/email', '').split('|')[-1]
            )
            
            if not email:
                raise AuthenticationFailed('No email in token')

            user, created = User.objects.get_or_create(
                email=email,
                defaults={'username': email.split('@')[0]}
            )
            UserProfile.objects.get_or_create(user=user)
            return (user, token)

        except jwt.ExpiredSignatureError:
            raise AuthenticationFailed('Token expired')
        except jwt.InvalidTokenError:
            raise AuthenticationFailed('Invalid token')
        except AuthenticationFailed:
            raise
        except Exception as e:
            raise AuthenticationFailed(str(e))

    def authenticate_header(self, request):
        return 'Bearer'
