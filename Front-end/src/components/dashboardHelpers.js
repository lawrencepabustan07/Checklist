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

function attachAuthHeader(config) {
  const token = localStorage.getItem("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}

function validateImageFile(file) {
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

function buildChecklistFormData({ name, type, image, removeImage }) {
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

function getChecklistImageUrl(checklist, preview = "") {
  return preview || checklist?.image_url || DEFAULT_CHECKLIST_IMAGE;
}

function moveItem(items, draggedId, targetId) {
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

function getPriorityMeta(priority = "none") {
  return (
    PRIORITY_OPTIONS.find((option) => option.value === priority) ||
    PRIORITY_OPTIONS[PRIORITY_OPTIONS.length - 1]
  );
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

function getDueBadge(dueDate) {
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

function buildItemPayload({ label, type, dueDate, priority }) {
  return {
    label,
    type,
    due_date: dueDate || null,
    priority: priority || "none",
  };
}

function normaliseCollection(response) {
  return response?.data?.data || response?.data?.results || response?.data || [];
}

function buildItemQuery(
  sortOption,
  sortDirection,
  priorityFilter,
  statusFilter,
) {
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

function resolveTheme(themePreference, systemDarkMode) {
  if (themePreference === "system") {
    return systemDarkMode ? "dark" : "light";
  }
  if (themePreference === "contrast") {
    return "contrast";
  }
  return themePreference || "light";
}

function createEmptyAnalytics() {
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

export {
  attachAuthHeader,
  buildChecklistFormData,
  buildItemPayload,
  buildItemQuery,
  CHECKLIST_TYPE_TABS,
  createEmptyAnalytics,
  DEFAULT_AVATAR_IMAGE,
  DEFAULT_CHECKLIST_IMAGE,
  formatDate,
  getChecklistImageUrl,
  getDueBadge,
  getPriorityMeta,
  moveItem,
  normaliseCollection,
  PRIORITY_OPTIONS,
  resolveTheme,
  SORT_OPTIONS,
  THEME_OPTIONS,
  THEME_TOKENS,
  validateImageFile,
};
