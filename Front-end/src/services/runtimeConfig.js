function getApiOrigin() {
  const configuredOrigin = import.meta.env.VITE_API_ORIGIN?.trim();
  if (configuredOrigin) {
    return configuredOrigin.replace(/\/+$/, "");
  }

  const protocol =
    typeof window !== "undefined" && window.location.protocol === "https:"
      ? "https:"
      : "http:";
  const hostname =
    typeof window !== "undefined" && window.location.hostname
      ? window.location.hostname
      : "127.0.0.1";

  return `${protocol}//${hostname}:8000`;
}

const API_ORIGIN = getApiOrigin();
const API_BASE_URL = `${API_ORIGIN}/api`;
const AUTH_API_BASE_URL = `${API_BASE_URL}/auth`;
const DEFAULT_CHECKLIST_IMAGE_URL = `${API_ORIGIN}/media/checklists/default-checklist.svg`;
const DEFAULT_AVATAR_IMAGE_URL = `${API_ORIGIN}/media/profiles/default-avatar.svg`;

export {
  API_BASE_URL,
  API_ORIGIN,
  AUTH_API_BASE_URL,
  DEFAULT_AVATAR_IMAGE_URL,
  DEFAULT_CHECKLIST_IMAGE_URL,
};
