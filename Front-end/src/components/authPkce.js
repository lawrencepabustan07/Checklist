const PKCE_VERIFIER_KEY = "auth_pkce_code_verifier";

function toBase64Url(bytes) {
  const binary = String.fromCharCode(...bytes);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function createCodeVerifier(length = 64) {
  const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  const randomBytes = new Uint8Array(length);
  crypto.getRandomValues(randomBytes);
  return Array.from(randomBytes, (byte) => charset[byte % charset.length]).join("");
}

export async function createCodeChallenge(verifier) {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return toBase64Url(new Uint8Array(digest));
}

export async function preparePkce() {
  const verifier = createCodeVerifier();
  const challenge = await createCodeChallenge(verifier);
  sessionStorage.setItem(PKCE_VERIFIER_KEY, verifier);
  return { verifier, challenge };
}

export function getStoredCodeVerifier() {
  return sessionStorage.getItem(PKCE_VERIFIER_KEY) || "";
}

export function clearStoredCodeVerifier() {
  sessionStorage.removeItem(PKCE_VERIFIER_KEY);
}
