from rest_framework.response import Response
from rest_framework import status
from django.http import JsonResponse

def error_500(request):
    return Response({
        'status': 'error',
        'message': 'An unexpected error occurred on the server.'
    })


def error_404(request, exception):
    return Response({
        'status': 'error',
        'message': 'The requested resource was not found.'
    }, status=status.HTTP_404_NOT_FOUND)
