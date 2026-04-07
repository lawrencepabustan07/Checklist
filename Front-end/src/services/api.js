import axios from "axios";

const API_BASE = "http://127.0.0.1:8000/api/auth";

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    "Content-Type": "application/json",
  },
});

export const login = (email, password) => {
  return api.post("/login/", { email, password });
};

export const register = (credential) => {
  return api.post("/register/", {
    method: "auth0",
    credential: credential,
  });
};

export default api;
