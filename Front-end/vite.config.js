import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const configDir = path.dirname(fileURLToPath(import.meta.url));

function buildSecurityHeaders(env) {
  const auth0Domain = env.VITE_AUTH0_DOMAIN?.trim();
  const apiOrigin = env.VITE_API_ORIGIN?.trim() || "http://127.0.0.1:8000";

  const connectSources = [
    "'self'",
    apiOrigin.replace(/\/+$/, ""),
  ];

  if (auth0Domain) {
    connectSources.push(`https://${auth0Domain}`);
  }

  const csp = [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    `connect-src ${connectSources.join(" ")}`,
    `img-src 'self' data: blob: ${apiOrigin.replace(/\/+$/, "")}`,
    "font-src 'self' data:",
    "form-action 'self'",
  ].join("; ");

  return {
    "Content-Security-Policy": csp,
    "Cross-Origin-Resource-Policy": "same-origin",
    "Permissions-Policy":
      "camera=(), geolocation=(), microphone=(), payment=(), usb=()",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, configDir, "");
  const securityHeaders = buildSecurityHeaders(env);

  return {
    plugins: [react()],
    preview: {
      headers: securityHeaders,
    },
    server: {
      headers: securityHeaders,
    },
  };
});
