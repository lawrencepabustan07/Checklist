import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const API = axios.create({
  baseURL: "http://127.0.0.1:8000/api",
});

const DEFAULT_CHECKLIST_IMAGE =
  "http://127.0.0.1:8000/media/checklists/default-checklist.svg";
const DEFAULT_AVATAR_IMAGE =
  "http://127.0.0.1:8000/media/profiles/default-avatar.svg";
const MAX_IMAGE_SIZE = 2 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const PRIORITY_OPTIONS = [
  { value: "high", label: "High", dot: "#ef4444" },
  { value: "medium", label: "Medium", dot: "#f59e0b" },
  { value: "low", label: "Low", dot: "#22c55e" },
  { value: "none", label: "None", dot: "#94a3b8" },
];
const THEME_OPTIONS = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "contrast", label: "High Contrast" },
];
const SORT_OPTIONS = [
  { value: "position", label: "Custom Order" },
  { value: "name", label: "Name" },
  { value: "due_date", label: "Due Date" },
  { value: "priority", label: "Priority" },
  { value: "status", label: "Status" },
  { value: "created_at", label: "Creation Date" },
];
const CHECKLIST_TYPE_TABS = [
  { value: "All", label: "All" },
  { value: "Daily", label: "Daily" },
  { value: "Weekly", label: "Weekly" },
  { value: "Monthly", label: "Monthly" },
  { value: "Quarterly", label: "Quarterly" },
  { value: "Yearly", label: "Yearly" },
];

const THEME_TOKENS = {
  light: {
    page: "#eef2ff",
    panel: "#ffffff",
    panelAlt: "#f8fafc",
    text: "#0f172a",
    muted: "#475569",
    border: "#dbe4f0",
    accent: "#0f766e",
    accentSoft: "#ccfbf1",
    danger: "#b91c1c",
    warning: "#b45309",
    shadow: "0 20px 50px rgba(15, 23, 42, 0.08)",
  },
  dark: {
    page: "#08111f",
    panel: "#111c31",
    panelAlt: "#17253f",
    text: "#e2e8f0",
    muted: "#94a3b8",
    border: "#27344d",
    accent: "#22c55e",
    accentSoft: "#14321d",
    danger: "#f87171",
    warning: "#fbbf24",
    shadow: "0 24px 60px rgba(0, 0, 0, 0.35)",
  },
  contrast: {
    page: "#000000",
    panel: "#101010",
    panelAlt: "#171717",
    text: "#ffffff",
    muted: "#f5f5f5",
    border: "#ffffff",
    accent: "#00e5ff",
    accentSoft: "#0a2a30",
    danger: "#ff5a5a",
    warning: "#ffe600",
    shadow: "0 0 0 2px #ffffff",
  },
};

export function attachAuthHeader(config) {
  const token = localStorage.getItem("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}

API.interceptors.request.use(attachAuthHeader);

export function validateImageFile(file) {
  if (!file) {
    return "";
  }

  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return "Only JPG, PNG, and WEBP images are allowed.";
  }

  if (file.size > MAX_IMAGE_SIZE) {
    return "Image must be 2MB or smaller.";
  }

  return "";
}

export function buildChecklistFormData({ name, type, image, removeImage }) {
  const formData = new FormData();
  formData.append("name", name);
  formData.append("type", type);

  if (image) {
    formData.append("image", image);
  }

  if (removeImage) {
    formData.append("remove_image", "true");
  }

  return formData;
}

export function getChecklistImageUrl(checklist, preview = "") {
  return preview || checklist?.image_url || DEFAULT_CHECKLIST_IMAGE;
}

export function moveItem(items, draggedId, targetId) {
  const updated = [...items];
  const draggedIndex = updated.findIndex((item) => item.id === draggedId);
  const targetIndex = updated.findIndex((item) => item.id === targetId);

  if (
    draggedIndex === -1 ||
    targetIndex === -1 ||
    draggedIndex === targetIndex
  ) {
    return items;
  }

  const [draggedItem] = updated.splice(draggedIndex, 1);
  updated.splice(targetIndex, 0, draggedItem);

  return updated.map((item, index) => ({ ...item, position: index + 1 }));
}

export function getPriorityMeta(priority = "none") {
  return (
    PRIORITY_OPTIONS.find((option) => option.value === priority) ||
    PRIORITY_OPTIONS[PRIORITY_OPTIONS.length - 1]
  );
}

export function getDueBadge(dueDate) {
  if (!dueDate) {
    return null;
  }

  const today = new Date();
  const todayKey = today.toISOString().slice(0, 10);
  if (dueDate < todayKey) {
    return { label: "Overdue", tone: "danger" };
  }
  if (dueDate === todayKey) {
    return { label: "Due Today", tone: "warning" };
  }
  return { label: formatDate(dueDate), tone: "neutral" };
}

function formatDate(value) {
  if (!value) {
    return "No due date";
  }

  const dateValue = new Date(`${value}T00:00:00`);
  return dateValue.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function buildItemPayload({ label, type, dueDate, priority }) {
  return {
    label,
    type,
    due_date: dueDate || null,
    priority: priority || "none",
  };
}

export function normaliseCollection(response) {
  return response?.data?.data || response?.data?.results || response?.data || [];
}

export function buildItemQuery(sortOption, sortDirection, priorityFilter, statusFilter) {
  const params = new URLSearchParams();
  params.set("sort_by", sortOption);
  params.set("direction", sortDirection);
  if (priorityFilter && priorityFilter !== "all") {
    params.set("priority", priorityFilter);
  }
  if (statusFilter && statusFilter !== "all") {
    params.set("status", statusFilter);
  }
  return params.toString();
}

export function resolveTheme(themePreference, systemDarkMode) {
  if (themePreference === "system") {
    return systemDarkMode ? "dark" : "light";
  }
  if (themePreference === "contrast") {
    return "contrast";
  }
  return themePreference || "light";
}

export function createEmptyAnalytics() {
  return {
    total_items: 0,
    completed_items: 0,
    pending_items: 0,
    overdue_items: 0,
    completion_rate: 0,
    weekly_activity: {
      Mon: 0,
      Tue: 0,
      Wed: 0,
      Thu: 0,
      Fri: 0,
      Sat: 0,
      Sun: 0,
    },
    best_day: null,
    heatmap: {},
    priority_breakdown: [],
  };
}

export default function Dashboard({ onLogout }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [avatarUrl, setAvatarUrl] = useState(DEFAULT_AVATAR_IMAGE);
  const [avatarPreview, setAvatarPreview] = useState("");
  const [checklists, setChecklists] = useState([]);
  const [archivedChecklists, setArchivedChecklists] = useState([]);
  const [selectedChecklist, setSelectedChecklist] = useState(null);
  const [items, setItems] = useState([]);
  const [calendarItems, setCalendarItems] = useState({});
  const [dashboardAnalytics, setDashboardAnalytics] = useState({
    total_items: 0,
    completed_items: 0,
    pending_items: 0,
    overdue_items: 0,
    completion_rate: 0,
    due_today: 0,
    by_priority: [],
  });
  const [checklistAnalytics, setChecklistAnalytics] = useState(
    createEmptyAnalytics(),
  );
  const [loading, setLoading] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);
  const [showAddList, setShowAddList] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [activeChecklistType, setActiveChecklistType] = useState("All");
  const [systemDarkMode, setSystemDarkMode] = useState(false);
  const [themePreference, setThemePreference] = useState(
    localStorage.getItem("theme_preference") || "system",
  );
  const [sortOption, setSortOption] = useState(
    localStorage.getItem("sort_option") || "position",
  );
  const [sortDirection, setSortDirection] = useState(
    localStorage.getItem("sort_direction") || "asc",
  );
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedItemIds, setSelectedItemIds] = useState([]);
  const [bulkPriority, setBulkPriority] = useState("medium");
  const [newListName, setNewListName] = useState("");
  const [newListType, setNewListType] = useState("");
  const [newListImage, setNewListImage] = useState(null);
  const [newListImagePreview, setNewListImagePreview] = useState("");
  const [newItemLabel, setNewItemLabel] = useState("");
  const [newItemType, setNewItemType] = useState("");
  const [newItemDueDate, setNewItemDueDate] = useState("");
  const [newItemPriority, setNewItemPriority] = useState("none");
  const [editingItem, setEditingItem] = useState(null);
  const [editLabel, setEditLabel] = useState("");
  const [editType, setEditType] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [editPriority, setEditPriority] = useState("none");
  const [error, setError] = useState("");
  const [editingChecklist, setEditingChecklist] = useState(null);
  const [editChecklistName, setEditChecklistName] = useState("");
  const [editChecklistType, setEditChecklistType] = useState("");
  const [editChecklistImage, setEditChecklistImage] = useState(null);
  const [editChecklistImagePreview, setEditChecklistImagePreview] =
    useState("");
  const [removeChecklistImage, setRemoveChecklistImage] = useState(false);
  const [draggedItemId, setDraggedItemId] = useState(null);
  const actualTheme = resolveTheme(themePreference, systemDarkMode);
  const theme = THEME_TOKENS[actualTheme];
  const checklistTypeCounts = useMemo(() => {
    const counts = { All: checklists.length };
    for (const tab of CHECKLIST_TYPE_TABS) {
      if (tab.value === "All") {
        continue;
      }
      counts[tab.value] = checklists.filter(
        (checklist) => checklist.type === tab.value,
      ).length;
    }
    return counts;
  }, [checklists]);
  const visibleChecklists = useMemo(() => {
    if (activeChecklistType === "All") {
      return checklists;
    }
    return checklists.filter(
      (checklist) => checklist.type === activeChecklistType,
    );
  }, [activeChecklistType, checklists]);

  useEffect(() => {
    const mediaQuery = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!mediaQuery) {
      return undefined;
    }

    setSystemDarkMode(mediaQuery.matches);
    const listener = (event) => setSystemDarkMode(event.matches);
    mediaQuery.addEventListener?.("change", listener);
    return () => mediaQuery.removeEventListener?.("change", listener);
  }, []);

  useEffect(() => {
    document.body.style.background = theme.page;
    document.body.style.color = theme.text;
    document.body.style.transition =
      "background-color 220ms ease, color 220ms ease";
  }, [theme]);

  useEffect(() => {
    setEmail(localStorage.getItem("email") || "User");
    loadProfile();
    loadChecklists();
    loadArchivedChecklists();
    loadDashboardAnalytics();
  }, []);

  useEffect(() => {
    if (!selectedChecklist) {
      return;
    }
    loadItems(selectedChecklist.id);
    loadChecklistAnalytics(selectedChecklist.id);
    if (showCalendar) {
      loadCalendar(selectedChecklist.id);
    }
  }, [
    selectedChecklist,
    sortOption,
    sortDirection,
    priorityFilter,
    statusFilter,
    showCalendar,
  ]);

  async function loadProfile() {
    try {
      const res = await API.get("/auth/user/");
      const userData = res.data.data || {};
      setAvatarUrl(userData.avatar_url || DEFAULT_AVATAR_IMAGE);
      const nextTheme = userData.theme_preference || themePreference;
      const nextSort = userData.sort_option || sortOption;
      const nextDirection = userData.sort_direction || sortDirection;
      setThemePreference(nextTheme);
      setSortOption(nextSort);
      setSortDirection(nextDirection);
      localStorage.setItem("theme_preference", nextTheme);
      localStorage.setItem("sort_option", nextSort);
      localStorage.setItem("sort_direction", nextDirection);
    } catch (err) {
      console.error(err);
    }
  }

  async function saveProfilePreferences(preferences) {
    const formData = new FormData();
    Object.entries(preferences).forEach(([key, value]) => {
      formData.append(key, value);
    });
    try {
      await API.patch("/auth/user/", formData);
    } catch (err) {
      console.error(err);
    }
  }

  async function loadChecklists() {
    setLoading(true);
    try {
      const res = await API.get("/checklist/");
      const data = normaliseCollection(res);
      setChecklists(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setError("Failed to load checklists");
    } finally {
      setLoading(false);
    }
  }

  async function loadArchivedChecklists() {
    try {
      const res = await API.get("/checklist/archived/");
      const data = normaliseCollection(res);
      setArchivedChecklists(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    }
  }

  async function loadItems(checklistId) {
    setLoadingItems(true);
    try {
      const query = buildItemQuery(
        sortOption,
        sortDirection,
        priorityFilter,
        statusFilter,
      );
      const url = `/checklist/${checklistId}/items/${query ? `?${query}` : ""}`;
      const res = await API.get(url);
      const data = normaliseCollection(res);
      setItems(Array.isArray(data) ? data : []);
      setSelectedItemIds([]);
    } catch (err) {
      console.error(err);
      setError("Failed to load items");
    } finally {
      setLoadingItems(false);
    }
  }

  async function loadCalendar(checklistId) {
    try {
      const res = await API.get(`/checklist/${checklistId}/items/calendar/`);
      setCalendarItems(res.data || {});
    } catch (err) {
      console.error(err);
    }
  }

  async function loadDashboardAnalytics() {
    try {
      const res = await API.get("/checklist/dashboard-analytics/");
      setDashboardAnalytics(res.data.data || {});
    } catch (err) {
      console.error(err);
    }
  }

  async function loadChecklistAnalytics(checklistId) {
    try {
      const res = await API.get(`/checklist/${checklistId}/items/analytics/`);
      setChecklistAnalytics(res.data || createEmptyAnalytics());
    } catch (err) {
      console.error(err);
    }
  }

  function resetNewChecklistForm() {
    setNewListName("");
    setNewListType("");
    setNewListImage(null);
    setNewListImagePreview("");
  }

  function resetEditingChecklistForm() {
    setEditingChecklist(null);
    setEditChecklistName("");
    setEditChecklistType("");
    setEditChecklistImage(null);
    setEditChecklistImagePreview("");
    setRemoveChecklistImage(false);
  }

  function resetItemForm() {
    setNewItemLabel("");
    setNewItemType("");
    setNewItemDueDate("");
    setNewItemPriority("none");
  }

  function handleChecklistClick(checklist) {
    setSelectedChecklist(checklist);
    setShowAddItem(false);
    setEditingItem(null);
    setError("");
  }

  function handleBackToDashboard() {
    setSelectedChecklist(null);
    setShowAddList(false);
    setShowAddItem(false);
    setEditingItem(null);
    setShowCalendar(false);
    setSelectedItemIds([]);
    resetEditingChecklistForm();
    setError("");
  }

  function handleNewImageChange(event) {
    const file = event.target.files?.[0];
    const validationError = validateImageFile(file);

    if (validationError) {
      setError(validationError);
      event.target.value = "";
      return;
    }

    setError("");
    setNewListImage(file || null);
    setNewListImagePreview(file ? URL.createObjectURL(file) : "");
  }

  function handleEditImageChange(event) {
    const file = event.target.files?.[0];
    const validationError = validateImageFile(file);

    if (validationError) {
      setError(validationError);
      event.target.value = "";
      return;
    }

    setError("");
    setRemoveChecklistImage(false);
    setEditChecklistImage(file || null);
    setEditChecklistImagePreview(file ? URL.createObjectURL(file) : "");
  }

  async function handleAvatarChange(event) {
    const file = event.target.files?.[0];
    const validationError = validateImageFile(file);

    if (validationError) {
      setError(validationError);
      event.target.value = "";
      return;
    }

    if (!file) {
      return;
    }

    const formData = new FormData();
    formData.append("avatar", file);

    try {
      const preview = URL.createObjectURL(file);
      setAvatarPreview(preview);
      const res = await API.patch("/auth/user/", formData);
      setAvatarUrl(res.data.data.avatar_url || DEFAULT_AVATAR_IMAGE);
      setAvatarPreview("");
    } catch (err) {
      setError(
        err.response?.data?.errors?.avatar?.[0] || "Failed to update avatar",
      );
    }
  }

  async function handleRemoveAvatar() {
    const formData = new FormData();
    formData.append("remove_avatar", "true");

    try {
      const res = await API.patch("/auth/user/", formData);
      setAvatarUrl(res.data.data.avatar_url || DEFAULT_AVATAR_IMAGE);
      setAvatarPreview("");
    } catch (err) {
      setError("Failed to remove avatar");
    }
  }

  async function handleAddList(event) {
    event.preventDefault();
    setLoading(true);

    try {
      const payload = buildChecklistFormData({
        name: newListName,
        type: newListType,
        image: newListImage,
        removeImage: false,
      });
      const res = await API.post("/checklist/", payload);
      const newChecklist = res.data.data || res.data;
      setChecklists([newChecklist, ...checklists]);
      resetNewChecklistForm();
      setShowAddList(false);
    } catch (err) {
      const apiError =
        err.response?.data?.errors?.image?.[0] ||
        err.response?.data?.message ||
        "Failed to create checklist";
      setError(apiError);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateChecklist(event) {
    event.preventDefault();

    try {
      const payload = buildChecklistFormData({
        name: editChecklistName,
        type: editChecklistType,
        image: editChecklistImage,
        removeImage: removeChecklistImage,
      });
      const res = await API.patch(
        `/checklist/${editingChecklist.id}/`,
        payload,
      );
      const updatedChecklist = res.data.data || res.data;

      setChecklists(
        checklists.map((checklist) =>
          checklist.id === editingChecklist.id ? updatedChecklist : checklist,
        ),
      );
      resetEditingChecklistForm();
    } catch (err) {
      const apiError =
        err.response?.data?.errors?.image?.[0] ||
        err.response?.data?.message ||
        "Failed to update checklist";
      setError(apiError);
    }
  }

  async function handleArchiveChecklist(checklistId) {
    if (!confirm("Archive this checklist? You can restore it later.")) {
      return;
    }

    try {
      const res = await API.delete(`/checklist/${checklistId}/`);
      const archivedChecklist =
        res.data.data || checklists.find((item) => item.id === checklistId);
      setChecklists(
        checklists.filter((checklist) => checklist.id !== checklistId),
      );
      setArchivedChecklists(
        archivedChecklist
          ? [archivedChecklist, ...archivedChecklists]
          : archivedChecklists,
      );
      loadDashboardAnalytics();
    } catch (err) {
      setError("Could not archive checklist.");
    }
  }

  async function handleRestoreChecklist(checklistId) {
    try {
      const res = await API.post(`/checklist/${checklistId}/restore/`);
      const restoredChecklist =
        res.data.data ||
        archivedChecklists.find((item) => item.id === checklistId);
      setArchivedChecklists(
        archivedChecklists.filter((checklist) => checklist.id !== checklistId),
      );
      if (restoredChecklist) {
        setChecklists([restoredChecklist, ...checklists]);
      }
    } catch (err) {
      setError("Could not restore checklist.");
    }
  }

  async function handleDeleteChecklistPermanently(checklistId) {
    if (!confirm("Delete this checklist permanently? This cannot be undone.")) {
      return;
    }

    try {
      await API.delete(`/checklist/${checklistId}/permanent/`);
      setArchivedChecklists(
        archivedChecklists.filter((checklist) => checklist.id !== checklistId),
      );
      loadDashboardAnalytics();
    } catch (err) {
      setError("Could not delete checklist permanently.");
    }
  }

  async function refreshChecklistData(checklistId) {
    await Promise.all([
      loadItems(checklistId),
      loadChecklistAnalytics(checklistId),
      loadDashboardAnalytics(),
      showCalendar ? loadCalendar(checklistId) : Promise.resolve(),
    ]);
  }

  async function handleAddItem(event) {
    event.preventDefault();
    setLoadingItems(true);

    try {
      const res = await API.post(
        `/checklist/${selectedChecklist.id}/items/`,
        buildItemPayload({
          label: newItemLabel,
          type: newItemType,
          dueDate: newItemDueDate,
          priority: newItemPriority,
        }),
      );
      const newItem = res.data.data || res.data;
      setItems([...items, newItem]);
      resetItemForm();
      setShowAddItem(false);
      refreshChecklistData(selectedChecklist.id);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to add item");
    } finally {
      setLoadingItems(false);
    }
  }

  async function handleUpdateItem(event) {
    event.preventDefault();
    try {
      const res = await API.patch(
        `/checklist/${selectedChecklist.id}/items/${editingItem.id}/`,
        buildItemPayload({
          label: editLabel,
          type: editType,
          dueDate: editDueDate,
          priority: editPriority,
        }),
      );
      const updatedItem = res.data.data || res.data;
      setItems(
        items.map((item) => (item.id === editingItem.id ? updatedItem : item)),
      );
      setEditingItem(null);
      refreshChecklistData(selectedChecklist.id);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update item");
    }
  }

  async function handleDeleteItem(itemId) {
    if (!confirm("Delete this item?")) {
      return;
    }

    try {
      await API.delete(`/checklist/${selectedChecklist.id}/items/${itemId}/`);
      setItems(items.filter((item) => item.id !== itemId));
      refreshChecklistData(selectedChecklist.id);
    } catch (err) {
      setError("Failed to delete item");
    }
  }

  async function handleToggleItem(item) {
    try {
      const res = await API.patch(
        `/checklist/${selectedChecklist.id}/items/${item.id}/`,
        { is_completed: !item.is_completed },
      );
      const updatedItem = res.data.data || res.data;
      setItems(
        items.map((current) =>
          current.id === item.id ? updatedItem : current,
        ),
      );
      refreshChecklistData(selectedChecklist.id);
    } catch (err) {
      setError("Failed to update item status");
    }
  }

  async function handleReorderItems(nextItems) {
    setItems(nextItems);
    try {
      const res = await API.post(
        `/checklist/${selectedChecklist.id}/items/reorder/`,
        { ordered_ids: nextItems.map((item) => item.id) },
      );
      setItems(res.data);
    } catch (err) {
      setError("Failed to reorder items");
      loadItems(selectedChecklist.id);
    }
  }

  async function handleBulkPriorityChange(event) {
    event.preventDefault();
    try {
      const res = await API.patch(
        `/checklist/${selectedChecklist.id}/items/bulk-priority/`,
        { item_ids: selectedItemIds, priority: bulkPriority },
      );
      setItems(res.data);
      setSelectedItemIds([]);
      refreshChecklistData(selectedChecklist.id);
    } catch (err) {
      setError("Failed to update item priorities");
    }
  }

  async function handleThemeChange(nextTheme) {
    setThemePreference(nextTheme);
    localStorage.setItem("theme_preference", nextTheme);
    saveProfilePreferences({ theme_preference: nextTheme });
  }

  function handleSortOptionChange(nextOption) {
    setSortOption(nextOption);
    localStorage.setItem("sort_option", nextOption);
    saveProfilePreferences({ sort_option: nextOption });
  }

  function handleSortDirectionChange(nextDirection) {
    setSortDirection(nextDirection);
    localStorage.setItem("sort_direction", nextDirection);
    saveProfilePreferences({ sort_direction: nextDirection });
  }

  function resetSorting() {
    handleSortOptionChange("position");
    handleSortDirectionChange("asc");
  }

  function startEditingChecklist(checklist) {
    setEditingChecklist(checklist);
    setEditChecklistName(checklist.name);
    setEditChecklistType(checklist.type);
    setEditChecklistImage(null);
    setEditChecklistImagePreview("");
    setRemoveChecklistImage(false);
  }

  function startEditingItem(item) {
    setEditingItem(item);
    setEditLabel(item.label);
    setEditType(item.type);
    setEditDueDate(item.due_date || "");
    setEditPriority(item.priority || "none");
    setShowAddItem(false);
  }

  function handleLogout() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("email");
    onLogout();
    navigate("/login");
  }

  function renderAnalyticsBlock(data, global = false) {
    const weeklyEntries = Object.entries(data.weekly_activity || {});
    const heatmapEntries = Object.entries(data.heatmap || {});
    const maxWeeklyValue = Math.max(
      ...weeklyEntries.map(([, value]) => value),
      1,
    );
    const maxHeat = Math.max(...heatmapEntries.map(([, value]) => value), 1);

    return (
      <div style={styles(theme).analyticsStack}>
        <div style={styles(theme).statsGrid}>
          <div style={styles(theme).statCard}>
            <span style={styles(theme).statLabel}>Total Items</span>
            <strong style={styles(theme).statValue}>{data.total_items || 0}</strong>
          </div>
          <div style={styles(theme).statCard}>
            <span style={styles(theme).statLabel}>Completion Rate</span>
            <strong style={styles(theme).statValue}>
              {data.completion_rate || 0}%
            </strong>
          </div>
          <div style={styles(theme).statCard}>
            <span style={styles(theme).statLabel}>Overdue</span>
            <strong style={styles(theme).statValue}>{data.overdue_items || 0}</strong>
          </div>
          <div style={styles(theme).statCard}>
            <span style={styles(theme).statLabel}>Best Day</span>
            <strong style={styles(theme).statValue}>
              {data.best_day || (global ? "Keep going" : "No data yet")}
            </strong>
          </div>
        </div>
        <div style={styles(theme).chartGrid}>
          <div style={styles(theme).chartCard}>
            <h3 style={styles(theme).chartTitle}>Progress</h3>
            <div style={styles(theme).progressWrap}>
              <div
                style={styles(theme).progressFill(
                  `${data.completion_rate || 0}%`,
                )}
              />
            </div>
            <p style={styles(theme).mutedText}>
              {data.completed_items || 0} completed and {data.pending_items || 0} pending.
            </p>
          </div>
          <div style={styles(theme).chartCard}>
            <h3 style={styles(theme).chartTitle}>Weekly Activity</h3>
            <div style={styles(theme).barChart}>
              {weeklyEntries.map(([day, value]) => (
                <div key={day} style={styles(theme).barColumn}>
                  <div
                    style={styles(theme).bar(
                      `${Math.max((value / maxWeeklyValue) * 100, value ? 18 : 6)}%`,
                    )}
                  />
                  <span style={styles(theme).barLabel}>{day}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={styles(theme).chartCardWide}>
            <h3 style={styles(theme).chartTitle}>Activity Heatmap</h3>
            <div style={styles(theme).heatmap}>
              {heatmapEntries.length === 0 ? (
                <p style={styles(theme).mutedText}>No completed-item streak yet.</p>
              ) : (
                heatmapEntries.map(([day, value]) => (
                  <div key={day} style={styles(theme).heatCellWrap}>
                    <div
                      title={`${day}: ${value}`}
                      style={styles(theme).heatCell(value / maxHeat)}
                    />
                    <span style={styles(theme).heatLabel}>
                      {day.slice(5)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles(theme).container}>
      <div style={styles(theme).header}>
        <div style={styles(theme).headerLeft}>
          {(selectedChecklist || showAddList) && (
            <button onClick={handleBackToDashboard} style={styles(theme).backBtn}>
              Back
            </button>
          )}
          <div>
            <h1 style={styles(theme).title}>My Checklists</h1>
            <p style={styles(theme).subtitle}>Welcome back, {email.split("@")[0]}</p>
          </div>
        </div>
        <div style={styles(theme).headerRight}>
          <div style={styles(theme).themeCard}>
            <span style={styles(theme).smallLabel}>Theme</span>
            <div style={styles(theme).themeToggle}>
              {THEME_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleThemeChange(option.value)}
                  style={styles(theme).themeBtn(
                    themePreference === option.value,
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <div style={styles(theme).profileCard}>
            <img
              src={avatarPreview || avatarUrl || DEFAULT_AVATAR_IMAGE}
              alt="Profile avatar"
              style={styles(theme).avatar}
            />
            <div style={styles(theme).profileActions}>
              <label style={styles(theme).avatarBtn}>
                Change Avatar
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp"
                  onChange={handleAvatarChange}
                  style={styles(theme).hiddenInput}
                />
              </label>
              <button
                type="button"
                onClick={handleRemoveAvatar}
                style={styles(theme).secondaryBtn}
              >
                Remove
              </button>
            </div>
          </div>
          <button onClick={handleLogout} style={styles(theme).logoutBtn}>
            Sign out
          </button>
        </div>
      </div>

      {error && (
        <div style={styles(theme).error}>
          {error}
          <button onClick={() => setError("")} style={styles(theme).closeErr}>
            x
          </button>
        </div>
      )}

      {!selectedChecklist ? (
        <div style={styles(theme).pageStack}>
          <div style={styles(theme).card}>
            <div style={styles(theme).cardHeader}>
              <div style={styles(theme).cardTitleSection}>
                <span style={styles(theme).cardIcon}>Insights</span>
                <h3 style={styles(theme).cardTitle}>Dashboard Analytics</h3>
              </div>
            </div>
            {renderAnalyticsBlock(
              {
                ...createEmptyAnalytics(),
                ...dashboardAnalytics,
                weekly_activity: checklistAnalytics.weekly_activity,
                heatmap: checklistAnalytics.heatmap,
                best_day: checklistAnalytics.best_day,
              },
              true,
            )}
          </div>

          <div style={styles(theme).card}>
            <div style={styles(theme).cardHeader}>
              <div style={styles(theme).cardTitleSection}>
                <span style={styles(theme).cardIcon}>Lists</span>
                <h3 style={styles(theme).cardTitle}>All Checklists</h3>
                <span style={styles(theme).count}>{visibleChecklists.length}</span>
              </div>
              <button
                onClick={() => setShowAddList(!showAddList)}
                style={styles(theme).addBtn}
              >
                {showAddList ? "Cancel" : "+ New Checklist"}
              </button>
            </div>

            {showAddList && (
              <form onSubmit={handleAddList} style={styles(theme).form}>
                <input
                  type="text"
                  placeholder="Checklist name"
                  value={newListName}
                  onChange={(event) => setNewListName(event.target.value)}
                  required
                  style={styles(theme).input}
                />
                <select
                  value={newListType}
                  onChange={(event) => setNewListType(event.target.value)}
                  required
                  style={styles(theme).select}
                >
                  <option value="">-- Select type --</option>
                  <option value="Daily">Daily</option>
                  <option value="Weekly">Weekly</option>
                  <option value="Monthly">Monthly</option>
                  <option value="Quarterly">Quarterly</option>
                  <option value="Yearly">Yearly</option>
                </select>

                <div style={styles(theme).imageField}>
                  <label style={styles(theme).imageLabel} htmlFor="new-checklist-image">
                    Checklist image
                  </label>
                  <input
                    id="new-checklist-image"
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp"
                    onChange={handleNewImageChange}
                  />
                  <p style={styles(theme).helperText}>JPG, PNG, or WEBP up to 2MB.</p>
                  <img
                    src={getChecklistImageUrl(null, newListImagePreview)}
                    alt="New checklist preview"
                    style={styles(theme).formImagePreview}
                  />
                </div>

                <button type="submit" style={styles(theme).submitBtn}>
                  + Create Checklist
                </button>
              </form>
            )}

            {loading && <p style={styles(theme).muted}>Loading...</p>}

            {!loading && checklists.length === 0 && (
              <p style={styles(theme).muted}>No checklists yet - create one above</p>
            )}

            {checklists.length > 0 && (
              <div style={styles(theme).tabRow}>
                {CHECKLIST_TYPE_TABS.map((tab) => (
                  <button
                    key={tab.value}
                    type="button"
                    onClick={() => setActiveChecklistType(tab.value)}
                    style={styles(theme).tabBtn(
                      activeChecklistType === tab.value,
                    )}
                  >
                    {tab.label}
                    <span style={styles(theme).tabCount}>
                      {checklistTypeCounts[tab.value] || 0}
                    </span>
                  </button>
                ))}
              </div>
            )}

            <div style={styles(theme).checklistGrid}>
              {visibleChecklists.map((list) => (
                <div key={list.id} style={styles(theme).checklistCard}>
                  {editingChecklist?.id === list.id ? (
                    <form
                      onSubmit={handleUpdateChecklist}
                      style={styles(theme).editChecklistForm}
                    >
                      <img
                        src={getChecklistImageUrl(
                          removeChecklistImage ? null : list,
                          removeChecklistImage
                            ? DEFAULT_CHECKLIST_IMAGE
                            : editChecklistImagePreview,
                        )}
                        alt={`${list.name} preview`}
                        style={styles(theme).editChecklistImage}
                      />
                      <input
                        value={editChecklistName}
                        onChange={(event) =>
                          setEditChecklistName(event.target.value)
                        }
                        required
                        style={styles(theme).input}
                      />
                      <select
                        value={editChecklistType}
                        onChange={(event) =>
                          setEditChecklistType(event.target.value)
                        }
                        required
                        style={styles(theme).select}
                      >
                        <option value="Daily">Daily</option>
                        <option value="Weekly">Weekly</option>
                        <option value="Monthly">Monthly</option>
                        <option value="Quarterly">Quarterly</option>
                        <option value="Yearly">Yearly</option>
                      </select>
                      <input
                        type="file"
                        accept=".jpg,.jpeg,.png,.webp"
                        onChange={handleEditImageChange}
                      />
                      <div style={styles(theme).imageActionRow}>
                        <button
                          type="button"
                          onClick={() => {
                            setRemoveChecklistImage(true);
                            setEditChecklistImage(null);
                            setEditChecklistImagePreview("");
                          }}
                          style={styles(theme).deleteBtn}
                        >
                          Delete image
                        </button>
                        <button type="submit" style={styles(theme).saveBtn}>
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={resetEditingChecklistForm}
                          style={styles(theme).cancelBtn}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <div
                        style={styles(theme).checklistCardContent}
                        onClick={() => handleChecklistClick(list)}
                      >
                        <img
                          src={getChecklistImageUrl(list)}
                          alt={`${list.name} cover`}
                          style={styles(theme).checklistImage}
                        />
                        <div>
                          <div style={styles(theme).checklistName}>{list.name}</div>
                          <div style={styles(theme).checklistType}>{list.type}</div>
                        </div>
                      </div>

                      <div style={styles(theme).checklistActions}>
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            startEditingChecklist(list);
                          }}
                          style={styles(theme).editBtn}
                        >
                          Edit
                        </button>
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            handleArchiveChecklist(list.id);
                          }}
                          style={styles(theme).deleteChecklistBtn}
                        >
                          Archive
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>

            {!loading && checklists.length > 0 && visibleChecklists.length === 0 && (
              <p style={styles(theme).muted}>
                No {activeChecklistType.toLowerCase()} checklists yet.
              </p>
            )}

            <div style={styles(theme).archivedSection}>
              <button
                type="button"
                onClick={() => setShowArchived(!showArchived)}
                style={styles(theme).archiveToggle}
              >
                {showArchived
                  ? "Hide Archived"
                  : `Show Archived (${archivedChecklists.length})`}
              </button>

              {showArchived && (
                <div style={styles(theme).archivedList}>
                  {archivedChecklists.length === 0 ? (
                    <p style={styles(theme).muted}>No archived checklists yet.</p>
                  ) : (
                    archivedChecklists.map((list) => (
                      <div key={list.id} style={styles(theme).archivedCard}>
                        <div style={styles(theme).archivedCardInfo}>
                          <img
                            src={getChecklistImageUrl(list)}
                            alt={`${list.name} archived cover`}
                            style={styles(theme).archivedImage}
                          />
                          <div>
                            <div style={styles(theme).checklistName}>{list.name}</div>
                            <div style={styles(theme).checklistType}>{list.type}</div>
                          </div>
                        </div>
                        <div style={styles(theme).itemActions}>
                          <button
                            type="button"
                            style={styles(theme).saveBtn}
                            onClick={() => handleRestoreChecklist(list.id)}
                          >
                            Restore
                          </button>
                          <button
                            type="button"
                            style={styles(theme).deleteBtn}
                            onClick={() => handleDeleteChecklistPermanently(list.id)}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div style={styles(theme).pageStack}>
          <div style={styles(theme).card}>
            <div style={styles(theme).cardHeader}>
              <div style={styles(theme).selectedChecklistHeader}>
                <img
                  src={getChecklistImageUrl(selectedChecklist)}
                  alt={`${selectedChecklist.name} cover`}
                  style={styles(theme).selectedChecklistImage}
                />
                <div style={styles(theme).cardTitleSection}>
                  <span style={styles(theme).cardIcon}>Items</span>
                  <h3 style={styles(theme).cardTitle}>{selectedChecklist.name}</h3>
                  <span style={styles(theme).typeBadge}>{selectedChecklist.type}</span>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowAddItem(!showAddItem);
                  setEditingItem(null);
                }}
                style={styles(theme).addBtn}
              >
                {showAddItem ? "Cancel" : "+ Add Item"}
              </button>
            </div>

            {renderAnalyticsBlock(checklistAnalytics)}

            <div style={styles(theme).toolbar}>
              <div style={styles(theme).toolbarGroup}>
                <label style={styles(theme).smallLabel}>Sort</label>
                <select
                  value={sortOption}
                  onChange={(event) => handleSortOptionChange(event.target.value)}
                  style={styles(theme).select}
                >
                  {SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() =>
                    handleSortDirectionChange(
                      sortDirection === "asc" ? "desc" : "asc",
                    )
                  }
                  style={styles(theme).secondaryBtn}
                >
                  {sortDirection === "asc" ? "Ascending" : "Descending"}
                </button>
                <button
                  type="button"
                  onClick={resetSorting}
                  style={styles(theme).secondaryBtn}
                >
                  Reset Sort
                </button>
              </div>
              <div style={styles(theme).toolbarGroup}>
                <label style={styles(theme).smallLabel}>Priority</label>
                <select
                  value={priorityFilter}
                  onChange={(event) => setPriorityFilter(event.target.value)}
                  style={styles(theme).select}
                >
                  <option value="all">All priorities</option>
                  {PRIORITY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <label style={styles(theme).smallLabel}>Status</label>
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  style={styles(theme).select}
                >
                  <option value="all">All statuses</option>
                  <option value="pending">Pending</option>
                  <option value="completed">Completed</option>
                </select>
                <button
                  type="button"
                  onClick={() => setShowCalendar((current) => !current)}
                  style={styles(theme).secondaryBtn}
                >
                  {showCalendar ? "Hide Calendar" : "Calendar View"}
                </button>
              </div>
            </div>

            {showAddItem && (
              <form onSubmit={handleAddItem} style={styles(theme).form}>
                <input
                  type="text"
                  placeholder="Item label"
                  value={newItemLabel}
                  onChange={(event) => setNewItemLabel(event.target.value)}
                  required
                  style={styles(theme).input}
                />
                <input
                  type="text"
                  placeholder="Item type"
                  value={newItemType}
                  onChange={(event) => setNewItemType(event.target.value)}
                  required
                  style={styles(theme).input}
                />
                <div style={styles(theme).gridTwo}>
                  <input
                    type="date"
                    value={newItemDueDate}
                    onChange={(event) => setNewItemDueDate(event.target.value)}
                    style={styles(theme).input}
                  />
                  <select
                    value={newItemPriority}
                    onChange={(event) => setNewItemPriority(event.target.value)}
                    style={styles(theme).select}
                  >
                    {PRIORITY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <button type="submit" style={styles(theme).submitBtn}>
                  + Add Item
                </button>
              </form>
            )}

            {selectedItemIds.length > 0 && (
              <form onSubmit={handleBulkPriorityChange} style={styles(theme).bulkCard}>
                <span style={styles(theme).smallLabel}>
                  {selectedItemIds.length} selected
                </span>
                <select
                  value={bulkPriority}
                  onChange={(event) => setBulkPriority(event.target.value)}
                  style={styles(theme).select}
                >
                  {PRIORITY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <button type="submit" style={styles(theme).submitBtn}>
                  Apply Priority
                </button>
              </form>
            )}

            {loadingItems && <p style={styles(theme).muted}>Loading items...</p>}

            {!loadingItems && items.length === 0 && (
              <p style={styles(theme).muted}>No items yet - add one above</p>
            )}

            {showCalendar && Object.keys(calendarItems).length > 0 && (
              <div style={styles(theme).calendarCard}>
                <h3 style={styles(theme).chartTitle}>Calendar View</h3>
                <div style={styles(theme).calendarList}>
                  {Object.entries(calendarItems).map(([day, dayItems]) => (
                    <div key={day} style={styles(theme).calendarDay}>
                      <div style={styles(theme).calendarDate}>{formatDate(day)}</div>
                      <div style={styles(theme).calendarItems}>
                        {dayItems.map((item) => (
                          <div key={item.id} style={styles(theme).calendarPill}>
                            {item.label}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {items.length > 0 && (
              <div style={styles(theme).itemsContainer}>
                <div style={styles(theme).itemsHeader}>
                  <div>Select</div>
                  <div>Status</div>
                  <div>Label</div>
                  <div>Due</div>
                  <div>Priority</div>
                  <div>Actions</div>
                </div>
                {items.map((item) => {
                  const dueBadge = getDueBadge(item.due_date);
                  const priorityMeta = getPriorityMeta(item.priority);
                  return (
                    <div
                      key={item.id}
                      draggable={!editingItem && sortOption === "position"}
                      onDragStart={() => setDraggedItemId(item.id)}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={() => {
                        if (
                          draggedItemId &&
                          draggedItemId !== item.id &&
                          sortOption === "position"
                        ) {
                          handleReorderItems(
                            moveItem(items, draggedItemId, item.id),
                          );
                        }
                        setDraggedItemId(null);
                      }}
                    >
                      {editingItem?.id === item.id ? (
                        <form onSubmit={handleUpdateItem} style={styles(theme).editRow}>
                          <input
                            value={editLabel}
                            onChange={(event) => setEditLabel(event.target.value)}
                            required
                            style={{ ...styles(theme).input, flex: 1 }}
                          />
                          <input
                            value={editType}
                            onChange={(event) => setEditType(event.target.value)}
                            required
                            style={{ ...styles(theme).input, flex: 1 }}
                          />
                          <input
                            type="date"
                            value={editDueDate}
                            onChange={(event) => setEditDueDate(event.target.value)}
                            style={styles(theme).input}
                          />
                          <select
                            value={editPriority}
                            onChange={(event) => setEditPriority(event.target.value)}
                            style={styles(theme).select}
                          >
                            {PRIORITY_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                          <button type="submit" style={styles(theme).saveBtn}>
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingItem(null)}
                            style={styles(theme).cancelBtn}
                          >
                            Cancel
                          </button>
                        </form>
                      ) : (
                        <div style={styles(theme).itemRow}>
                          <div>
                            <input
                              type="checkbox"
                              checked={selectedItemIds.includes(item.id)}
                              onChange={() =>
                                setSelectedItemIds((current) =>
                                  current.includes(item.id)
                                    ? current.filter((id) => id !== item.id)
                                    : [...current, item.id],
                                )
                              }
                            />
                          </div>
                          <div style={styles(theme).itemStatus}>
                            <span style={styles(theme).dragHandle}>
                              {sortOption === "position" ? "::" : "--"}
                            </span>
                            <input
                              type="checkbox"
                              checked={Boolean(item.is_completed)}
                              onChange={() => handleToggleItem(item)}
                            />
                          </div>
                          <div
                            style={{
                              ...styles(theme).itemLabel,
                              ...(item.is_completed
                                ? styles(theme).completedItemLabel
                                : {}),
                            }}
                          >
                            {item.label}
                            <div style={styles(theme).itemTypeText}>{item.type}</div>
                          </div>
                          <div>
                            {dueBadge ? (
                              <span style={styles(theme).dueBadge(dueBadge.tone)}>
                                {dueBadge.label}
                              </span>
                            ) : (
                              <span style={styles(theme).mutedText}>No due date</span>
                            )}
                          </div>
                          <div>
                            <span style={styles(theme).priorityBadge(priorityMeta.dot)}>
                              {priorityMeta.label}
                            </span>
                          </div>
                          <div style={styles(theme).itemActions}>
                            <button
                              onClick={() => startEditingItem(item)}
                              style={styles(theme).editBtn}
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteItem(item.id)}
                              style={styles(theme).deleteBtn}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function styles(theme) {
  return {
    container: {
      minHeight: "100vh",
      padding: "24px 32px 40px",
      fontFamily: '"Segoe UI", "Trebuchet MS", sans-serif',
      background:
        actualGradient(theme.page, theme.panelAlt, theme.accentSoft),
      color: theme.text,
      transition: "background 220ms ease, color 220ms ease",
    },
    pageStack: {
      display: "flex",
      flexDirection: "column",
      gap: "24px",
    },
    header: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: "24px",
      padding: "18px 24px",
      background: theme.panel,
      borderRadius: "20px",
      boxShadow: theme.shadow,
      border: `1px solid ${theme.border}`,
      gap: "16px",
      flexWrap: "wrap",
    },
    headerLeft: {
      display: "flex",
      alignItems: "center",
      gap: "18px",
    },
    headerRight: {
      display: "flex",
      alignItems: "center",
      gap: "16px",
      flexWrap: "wrap",
    },
    title: {
      fontSize: "26px",
      margin: 0,
      fontWeight: 800,
      letterSpacing: "-0.04em",
    },
    subtitle: {
      margin: "6px 0 0",
      color: theme.muted,
      fontSize: "14px",
    },
    themeCard: {
      display: "flex",
      flexDirection: "column",
      gap: "8px",
      minWidth: "280px",
    },
    themeToggle: {
      display: "flex",
      gap: "8px",
      flexWrap: "wrap",
    },
    themeBtn: (active) => ({
      border: `1px solid ${active ? theme.accent : theme.border}`,
      background: active ? theme.accentSoft : theme.panelAlt,
      color: theme.text,
      borderRadius: "999px",
      padding: "8px 12px",
      cursor: "pointer",
      fontWeight: 700,
    }),
    profileCard: {
      display: "flex",
      alignItems: "center",
      gap: "12px",
    },
    profileActions: {
      display: "flex",
      gap: "8px",
      alignItems: "center",
      flexWrap: "wrap",
    },
    avatar: {
      width: "56px",
      height: "56px",
      borderRadius: "50%",
      objectFit: "cover",
      background: theme.panelAlt,
      border: `2px solid ${theme.border}`,
    },
    avatarBtn: {
      padding: "9px 12px",
      background: theme.text,
      color: theme.panel,
      borderRadius: "10px",
      cursor: "pointer",
      fontSize: "12px",
      fontWeight: 700,
    },
    hiddenInput: {
      display: "none",
    },
    backBtn: {
      padding: "10px 18px",
      background: theme.accent,
      color: theme.panel,
      border: "none",
      borderRadius: "12px",
      cursor: "pointer",
      fontSize: "14px",
      fontWeight: 700,
    },
    logoutBtn: {
      padding: "10px 18px",
      background: theme.danger,
      color: "#ffffff",
      border: "none",
      borderRadius: "12px",
      cursor: "pointer",
      fontSize: "14px",
      fontWeight: 700,
    },
    error: {
      backgroundColor: theme.panel,
      color: theme.danger,
      padding: "12px 16px",
      borderRadius: "12px",
      marginBottom: "20px",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      border: `1px solid ${theme.danger}`,
    },
    closeErr: {
      background: "none",
      border: "none",
      cursor: "pointer",
      color: theme.danger,
      fontSize: "16px",
    },
    card: {
      background: theme.panel,
      borderRadius: "24px",
      padding: "24px",
      boxShadow: theme.shadow,
      border: `1px solid ${theme.border}`,
    },
    cardHeader: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: "20px",
      paddingBottom: "16px",
      borderBottom: `1px solid ${theme.border}`,
      gap: "16px",
      flexWrap: "wrap",
    },
    cardTitleSection: {
      display: "flex",
      alignItems: "center",
      gap: "10px",
      flexWrap: "wrap",
    },
    selectedChecklistHeader: {
      display: "flex",
      alignItems: "center",
      gap: "16px",
    },
    cardIcon: {
      fontSize: "12px",
      fontWeight: 800,
      textTransform: "uppercase",
      letterSpacing: "0.14em",
      color: theme.muted,
    },
    cardTitle: {
      fontSize: "19px",
      fontWeight: 700,
      margin: 0,
      color: theme.text,
    },
    count: {
      fontSize: "12px",
      fontWeight: 700,
      padding: "4px 10px",
      background: theme.accentSoft,
      color: theme.accent,
      borderRadius: "999px",
    },
    addBtn: {
      padding: "10px 18px",
      background: theme.text,
      color: theme.panel,
      border: "none",
      borderRadius: "12px",
      cursor: "pointer",
      fontSize: "13px",
      fontWeight: 700,
    },
    secondaryBtn: {
      padding: "10px 12px",
      background: theme.panelAlt,
      color: theme.text,
      border: `1px solid ${theme.border}`,
      borderRadius: "10px",
      cursor: "pointer",
      fontSize: "12px",
      fontWeight: 700,
    },
    form: {
      display: "flex",
      flexDirection: "column",
      gap: "12px",
      marginBottom: "24px",
      padding: "20px",
      background: theme.panelAlt,
      borderRadius: "18px",
      border: `1px solid ${theme.border}`,
    },
    gridTwo: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: "12px",
    },
    imageField: {
      display: "flex",
      flexDirection: "column",
      gap: "10px",
    },
    imageLabel: {
      fontSize: "13px",
      fontWeight: 700,
      color: theme.text,
    },
    helperText: {
      margin: 0,
      fontSize: "12px",
      color: theme.muted,
    },
    formImagePreview: {
      width: "100%",
      maxWidth: "320px",
      height: "180px",
      objectFit: "cover",
      borderRadius: "14px",
      border: `1px solid ${theme.border}`,
      background: theme.panel,
    },
    input: {
      padding: "12px 14px",
      fontSize: "14px",
      border: `1px solid ${theme.border}`,
      borderRadius: "12px",
      outline: "none",
      backgroundColor: theme.panel,
      color: theme.text,
      fontWeight: 600,
    },
    select: {
      padding: "12px 14px",
      fontSize: "14px",
      border: `1px solid ${theme.border}`,
      borderRadius: "12px",
      outline: "none",
      background: theme.panel,
      color: theme.text,
      fontWeight: 600,
      cursor: "pointer",
    },
    submitBtn: {
      padding: "12px 14px",
      fontSize: "14px",
      fontWeight: 700,
      background: theme.accent,
      color: theme.panel,
      border: "none",
      borderRadius: "12px",
      cursor: "pointer",
    },
    muted: {
      textAlign: "center",
      color: theme.muted,
      padding: "32px 0",
      fontSize: "13px",
    },
    mutedText: {
      color: theme.muted,
      fontSize: "12px",
      margin: 0,
    },
    checklistGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
      gap: "14px",
    },
    tabRow: {
      display: "flex",
      gap: "10px",
      flexWrap: "wrap",
      marginBottom: "18px",
    },
    tabBtn: (active) => ({
      display: "inline-flex",
      alignItems: "center",
      gap: "8px",
      borderRadius: "999px",
      border: `1px solid ${active ? theme.accent : theme.border}`,
      background: active ? theme.accentSoft : theme.panelAlt,
      color: theme.text,
      padding: "9px 14px",
      cursor: "pointer",
      fontWeight: 800,
    }),
    tabCount: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      minWidth: "24px",
      height: "24px",
      borderRadius: "999px",
      background: theme.panel,
      border: `1px solid ${theme.border}`,
      fontSize: "11px",
      fontWeight: 800,
    },
    checklistCard: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "stretch",
      padding: "16px 18px",
      background: theme.panelAlt,
      borderRadius: "16px",
      border: `1px solid ${theme.border}`,
      gap: "16px",
    },
    checklistCardContent: {
      flex: 1,
      cursor: "pointer",
      display: "flex",
      gap: "14px",
      alignItems: "center",
    },
    checklistImage: {
      width: "96px",
      height: "96px",
      objectFit: "cover",
      borderRadius: "14px",
      background: theme.panel,
      flexShrink: 0,
    },
    selectedChecklistImage: {
      width: "84px",
      height: "84px",
      objectFit: "cover",
      borderRadius: "16px",
      background: theme.panelAlt,
    },
    editChecklistImage: {
      width: "100%",
      maxWidth: "180px",
      height: "120px",
      objectFit: "cover",
      borderRadius: "12px",
      background: theme.panel,
    },
    checklistName: {
      fontSize: "16px",
      fontWeight: 800,
      marginBottom: "8px",
      color: theme.text,
    },
    checklistType: {
      fontSize: "13px",
      fontWeight: 700,
      color: theme.text,
      backgroundColor: theme.panel,
      display: "inline-block",
      padding: "4px 12px",
      borderRadius: "999px",
      border: `1px solid ${theme.border}`,
    },
    checklistActions: {
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      gap: "10px",
    },
    editChecklistForm: {
      display: "flex",
      flexDirection: "column",
      gap: "10px",
      width: "100%",
    },
    imageActionRow: {
      display: "flex",
      gap: "8px",
      alignItems: "center",
      flexWrap: "wrap",
    },
    deleteChecklistBtn: {
      padding: "6px 14px",
      background: theme.danger,
      color: "#ffffff",
      border: "none",
      borderRadius: "10px",
      cursor: "pointer",
      fontSize: "12px",
      fontWeight: 700,
    },
    archivedSection: {
      marginTop: "28px",
      borderTop: `1px solid ${theme.border}`,
      paddingTop: "20px",
    },
    archiveToggle: {
      padding: "10px 16px",
      borderRadius: "12px",
      border: `1px solid ${theme.border}`,
      background: theme.panelAlt,
      color: theme.text,
      cursor: "pointer",
      fontWeight: 700,
    },
    archivedList: {
      display: "flex",
      flexDirection: "column",
      gap: "12px",
      marginTop: "16px",
    },
    archivedCard: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: "16px",
      padding: "14px",
      border: `1px solid ${theme.border}`,
      borderRadius: "12px",
      background: theme.panelAlt,
    },
    archivedCardInfo: {
      display: "flex",
      alignItems: "center",
      gap: "14px",
    },
    archivedImage: {
      width: "72px",
      height: "72px",
      objectFit: "cover",
      borderRadius: "12px",
      background: theme.panel,
    },
    typeBadge: {
      fontSize: "12px",
      padding: "4px 12px",
      background: theme.accentSoft,
      color: theme.accent,
      borderRadius: "999px",
      fontWeight: 700,
    },
    analyticsStack: {
      display: "flex",
      flexDirection: "column",
      gap: "20px",
      marginBottom: "20px",
    },
    statsGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
      gap: "12px",
    },
    statCard: {
      padding: "18px",
      borderRadius: "16px",
      background: theme.panelAlt,
      border: `1px solid ${theme.border}`,
    },
    statLabel: {
      display: "block",
      color: theme.muted,
      fontSize: "12px",
      textTransform: "uppercase",
      letterSpacing: "0.08em",
      marginBottom: "10px",
    },
    statValue: {
      fontSize: "28px",
      fontWeight: 800,
    },
    chartGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
      gap: "16px",
    },
    chartCard: {
      padding: "18px",
      borderRadius: "18px",
      background: theme.panelAlt,
      border: `1px solid ${theme.border}`,
    },
    chartCardWide: {
      padding: "18px",
      borderRadius: "18px",
      background: theme.panelAlt,
      border: `1px solid ${theme.border}`,
      gridColumn: "span 2",
    },
    chartTitle: {
      margin: "0 0 14px",
      fontSize: "16px",
      fontWeight: 800,
    },
    progressWrap: {
      width: "100%",
      height: "14px",
      background: theme.panel,
      borderRadius: "999px",
      overflow: "hidden",
      marginBottom: "12px",
    },
    progressFill: (width) => ({
      width,
      height: "100%",
      background: `linear-gradient(90deg, ${theme.accent}, ${theme.warning})`,
      borderRadius: "999px",
    }),
    barChart: {
      display: "grid",
      gridTemplateColumns: "repeat(7, 1fr)",
      gap: "10px",
      alignItems: "end",
      minHeight: "160px",
    },
    barColumn: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: "8px",
      justifyContent: "flex-end",
    },
    bar: (height) => ({
      width: "100%",
      minHeight: height,
      background: `linear-gradient(180deg, ${theme.accent}, ${theme.accentSoft})`,
      borderRadius: "14px 14px 8px 8px",
    }),
    barLabel: {
      fontSize: "12px",
      color: theme.muted,
    },
    heatmap: {
      display: "flex",
      gap: "10px",
      flexWrap: "wrap",
    },
    heatCellWrap: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: "6px",
    },
    heatCell: (intensity) => ({
      width: "20px",
      height: "20px",
      borderRadius: "6px",
      background: `rgba(34, 197, 94, ${Math.max(0.15, intensity)})`,
      border: `1px solid ${theme.border}`,
    }),
    heatLabel: {
      fontSize: "10px",
      color: theme.muted,
    },
    toolbar: {
      display: "flex",
      justifyContent: "space-between",
      gap: "16px",
      flexWrap: "wrap",
      marginBottom: "16px",
    },
    toolbarGroup: {
      display: "flex",
      alignItems: "center",
      gap: "10px",
      flexWrap: "wrap",
    },
    smallLabel: {
      fontSize: "11px",
      color: theme.muted,
      textTransform: "uppercase",
      letterSpacing: "0.08em",
      fontWeight: 800,
    },
    bulkCard: {
      display: "flex",
      alignItems: "center",
      gap: "10px",
      flexWrap: "wrap",
      padding: "16px",
      background: theme.panelAlt,
      border: `1px solid ${theme.border}`,
      borderRadius: "16px",
      marginBottom: "16px",
    },
    calendarCard: {
      padding: "18px",
      border: `1px solid ${theme.border}`,
      background: theme.panelAlt,
      borderRadius: "18px",
      marginBottom: "16px",
    },
    calendarList: {
      display: "flex",
      flexDirection: "column",
      gap: "12px",
    },
    calendarDay: {
      display: "grid",
      gridTemplateColumns: "180px 1fr",
      gap: "14px",
      alignItems: "start",
    },
    calendarDate: {
      fontWeight: 800,
    },
    calendarItems: {
      display: "flex",
      gap: "10px",
      flexWrap: "wrap",
    },
    calendarPill: {
      padding: "8px 12px",
      borderRadius: "999px",
      background: theme.panel,
      border: `1px solid ${theme.border}`,
      fontWeight: 700,
    },
    itemsContainer: {
      marginTop: "8px",
    },
    itemsHeader: {
      display: "grid",
      gridTemplateColumns: "70px 110px 2fr 1.2fr 1fr 130px",
      padding: "12px",
      background: theme.panelAlt,
      borderRadius: "12px",
      fontSize: "12px",
      fontWeight: 800,
      color: theme.muted,
      marginBottom: "8px",
      gap: "10px",
    },
    itemRow: {
      display: "grid",
      gridTemplateColumns: "70px 110px 2fr 1.2fr 1fr 130px",
      alignItems: "center",
      padding: "12px",
      borderBottom: `1px solid ${theme.border}`,
      gap: "10px",
    },
    itemStatus: {
      display: "flex",
      alignItems: "center",
      gap: "10px",
    },
    dragHandle: {
      color: theme.muted,
      fontWeight: 700,
      cursor: "grab",
    },
    itemLabel: {
      fontSize: "14px",
      fontWeight: 700,
      color: theme.text,
      display: "flex",
      flexDirection: "column",
      gap: "6px",
    },
    itemTypeText: {
      fontSize: "12px",
      color: theme.muted,
      fontWeight: 600,
    },
    completedItemLabel: {
      textDecoration: "line-through",
      color: theme.muted,
    },
    dueBadge: (tone) => ({
      fontSize: "11px",
      padding: "6px 10px",
      borderRadius: "999px",
      fontWeight: 800,
      display: "inline-block",
      background:
        tone === "danger"
          ? "rgba(239, 68, 68, 0.18)"
          : tone === "warning"
            ? "rgba(245, 158, 11, 0.22)"
            : theme.panelAlt,
      color:
        tone === "danger"
          ? theme.danger
          : tone === "warning"
            ? theme.warning
            : theme.text,
      border: `1px solid ${theme.border}`,
    }),
    priorityBadge: (color) => ({
      display: "inline-flex",
      alignItems: "center",
      gap: "8px",
      padding: "6px 10px",
      borderRadius: "999px",
      fontWeight: 800,
      border: `1px solid ${theme.border}`,
      background: theme.panelAlt,
      color: theme.text,
      boxShadow: `inset 12px 0 0 ${color}`,
    }),
    itemActions: {
      display: "flex",
      gap: "8px",
      justifyContent: "flex-end",
      flexWrap: "wrap",
    },
    editBtn: {
      padding: "6px 12px",
      background: "none",
      border: `1px solid ${theme.accent}`,
      borderRadius: "8px",
      cursor: "pointer",
      fontSize: "11px",
      color: theme.accent,
      fontWeight: 800,
    },
    deleteBtn: {
      padding: "6px 12px",
      background: "none",
      border: `1px solid ${theme.danger}`,
      borderRadius: "8px",
      cursor: "pointer",
      fontSize: "11px",
      color: theme.danger,
      fontWeight: 800,
    },
    editRow: {
      display: "flex",
      gap: "8px",
      alignItems: "center",
      padding: "12px",
      background: theme.panelAlt,
      borderRadius: "12px",
      marginBottom: "8px",
      flexWrap: "wrap",
    },
    saveBtn: {
      padding: "8px 12px",
      background: theme.accent,
      color: theme.panel,
      border: "none",
      borderRadius: "8px",
      cursor: "pointer",
      fontSize: "11px",
      fontWeight: 800,
    },
    cancelBtn: {
      padding: "8px 12px",
      background: theme.muted,
      color: theme.panel,
      border: "none",
      borderRadius: "8px",
      cursor: "pointer",
      fontSize: "11px",
      fontWeight: 800,
    },
  };
}

function actualGradient(page, panelAlt, accentSoft) {
  return `radial-gradient(circle at top left, ${accentSoft}, transparent 38%), linear-gradient(180deg, ${page}, ${panelAlt})`;
}
