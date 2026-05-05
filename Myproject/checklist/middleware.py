from django.conf import settings


class SecurityHeadersMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)

        content_security_policy = getattr(settings, "CONTENT_SECURITY_POLICY", "")
        permissions_policy = getattr(settings, "PERMISSIONS_POLICY", "")

        if content_security_policy and "Content-Security-Policy" not in response:
            response["Content-Security-Policy"] = content_security_policy

        if permissions_policy and "Permissions-Policy" not in response:
            response["Permissions-Policy"] = permissions_policy

        response.setdefault(
            "Referrer-Policy",
            "strict-origin-when-cross-origin",
        )
        response.setdefault(
            "Cross-Origin-Resource-Policy",
            "same-origin",
        )

        return response
