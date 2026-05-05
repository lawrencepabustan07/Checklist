import axios from "axios";
import { AUTH_API_BASE_URL } from "./runtimeConfig";

const api = axios.create({
  baseURL: AUTH_API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

export const register = (credential) => {
  return api.post("/register/", {
    method: "auth0",
    credential: credential,
  });
};

export default api;
