// src/services/api.js
import axios from "axios";

const API_BASE = "http://127.0.0.1:8000/api/auth";

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
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

export const getUser = () => {
  return api.get("/user/");
};

export const getChecklists = () => {
  return api.get("/checklist/");
};

export const createChecklist = (data) => {
  return api.post("/checklist/", data);
};

export const updateChecklist = (id, data) => {
  return api.patch(`/checklist/${id}/`, data);
};

export const deleteChecklist = (id) => {
  return api.delete(`/checklist/${id}/`);
};

export const getItems = (checklistId) => {
  return api.get(`/checklist/${checklistId}/items/`);
};

export const createItem = (checklistId, data) => {
  return api.post(`/checklist/${checklistId}/item/`, data);
};

export const updateItem = (checklistId, itemId, data) => {
  return api.patch(`/checklist/${checklistId}/item/${itemId}/`, data);
};

export const deleteItem = (checklistId, itemId) => {
  return api.delete(`/checklist/${checklistId}/item/${itemId}/`);
};

export default api;
