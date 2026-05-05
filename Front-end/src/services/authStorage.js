export function getAccessToken() {
  return sessionStorage.getItem("access_token");
}

export function setAccessToken(token) {
  sessionStorage.setItem("access_token", token);
}

export function clearAccessToken() {
  sessionStorage.removeItem("access_token");
}
