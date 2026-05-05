import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

import {
  AdminChecklistsList,
  AdminFilters,
  AdminItemsList,
  AdminUsersList,
  UserDetailCard,
} from "./AdminPageSections";
import { clearAccessToken } from "../services/authStorage";
import { attachAuthHeader } from "./dashboardHelpers";
import {
  API_BASE_URL,
  DEFAULT_CHECKLIST_IMAGE_URL,
} from "../services/runtimeConfig";

const API = axios.create({
  baseURL: API_BASE_URL,
});

API.interceptors.request.use(attachAuthHeader);

const CHECKLIST_TYPES = ["Daily", "Weekly", "Monthly", "Quarterly", "Yearly"];
const PRIORITY_OPTIONS = [
  { value: "none", label: "None" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];
const DEFAULT_CHECKLIST_IMAGE = DEFAULT_CHECKLIST_IMAGE_URL;
const SPACING = {
  xs: "8px",
  sm: "12px",
  md: "16px",
  lg: "20px",
  xl: "24px",
  xxl: "32px",
};

const THEME = {
  page: "radial-gradient(circle at top left, rgba(56, 189, 248, 0.16), transparent 24%), radial-gradient(circle at bottom right, rgba(20, 184, 166, 0.14), transparent 22%), linear-gradient(180deg, #020617 0%, #0f172a 46%, #111827 100%)",
  panel: "rgba(15, 23, 42, 0.92)",
  panelSoft: "rgba(15, 23, 42, 0.76)",
  panelAlt: "rgba(30, 41, 59, 0.9)",
  card: "linear-gradient(145deg, rgba(15,23,42,0.98) 0%, rgba(30,41,59,0.96) 100%)",
  cardSoft:
    "linear-gradient(145deg, rgba(30,41,59,0.95) 0%, rgba(51,65,85,0.92) 100%)",
  border: "rgba(148, 163, 184, 0.22)",
  borderStrong: "rgba(96, 165, 250, 0.42)",
  text: "#e5eefb",
  textStrong: "#f8fafc",
  muted: "#94a3b8",
  accent: "#38bdf8",
  accentDeep: "#0ea5e9",
  successBg: "rgba(20, 83, 45, 0.88)",
  successBorder: "rgba(74, 222, 128, 0.28)",
  successText: "#dcfce7",
  errorBg: "rgba(127, 29, 29, 0.88)",
  errorBorder: "rgba(248, 113, 113, 0.28)",
  errorText: "#fee2e2",
  danger: "#ef4444",
  dangerSoft: "rgba(127, 29, 29, 0.2)",
  white: "#ffffff",
};

function validateImageFile(file) {
  if (!file) {
    return "";
  }

  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
  if (!allowedTypes.includes(file.type)) {
    return "Only JPG, PNG, and WEBP images are allowed.";
  }

  if (file.size > 2 * 1024 * 1024) {
    return "Image must be 2MB or smaller.";
  }

  return "";
}

function normaliseCollection(response) {
  const data = response?.data?.data ?? response?.data ?? [];
  return Array.isArray(data) ? data : [];
}

function buildQueryString(filters) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      params.set(key, value);
    }
  });
  const query = params.toString();
  return query ? `?${query}` : "";
}

function buildChecklistPayload(form, checklistImage, removeImage) {
  const payload = new FormData();
  payload.append("name", form.name);
  payload.append("type", form.type);
  payload.append("created_by_id", form.created_by_id);
  if (checklistImage) {
    payload.append("image", checklistImage);
  }
  if (removeImage) {
    payload.append("remove_image", "true");
  }
  return payload;
}

function checklistPreviewSrc(targetChecklist, preview, removeImage) {
  if (preview) {
    return preview;
  }
  if (removeImage) {
    return DEFAULT_CHECKLIST_IMAGE;
  }
  return targetChecklist?.image_url || DEFAULT_CHECKLIST_IMAGE;
}

function ModalShell({ title, children, onClose, panelStyle }) {
  return (
    <div style={styles.modalBackdrop}>
      <div style={{ ...styles.modalPanel, ...panelStyle }} className="admin-surface">
        <div style={styles.modalHeader}>
          <div>
            <h2 style={styles.modalTitle}>{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={styles.iconCloseButton}
            className="admin-btn admin-ghost-btn"
          >
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function AdminPage() {
  const navigate = useNavigate();
  const [adminEmail, setAdminEmail] = useState("");
  const [users, setUsers] = useState([]);
  const [checklists, setChecklists] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [selectedChecklistId, setSelectedChecklistId] = useState(null);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingItems, setLoadingItems] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [savingChecklist, setSavingChecklist] = useState(false);
  const [savingItem, setSavingItem] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [updatingUserId, setUpdatingUserId] = useState(null);

  const [checklistModal, setChecklistModal] = useState({
    open: false,
    mode: "create",
    checklistId: null,
  });
  const [itemModal, setItemModal] = useState({
    open: false,
    mode: "create",
    itemId: null,
  });
  const [confirmModal, setConfirmModal] = useState({
    open: false,
    kind: "checklist",
    id: null,
    title: "",
    message: "",
  });
  const [activityModal, setActivityModal] = useState({
    open: false,
    user: null,
    activities: [],
    loading: false,
  });

  const [checklistForm, setChecklistForm] = useState({
    created_by_id: "",
    name: "",
    type: "Daily",
  });
  const [checklistErrors, setChecklistErrors] = useState({});
  const [checklistImage, setChecklistImage] = useState(null);
  const [checklistImagePreview, setChecklistImagePreview] = useState("");
  const [removeChecklistImage, setRemoveChecklistImage] = useState(false);

  const [itemForm, setItemForm] = useState({
    label: "",
    type: "",
    due_date: "",
    priority: "none",
    is_completed: false,
  });
  const [itemErrors, setItemErrors] = useState({});
  const [userFilters, setUserFilters] = useState({
    search: "",
    role: "",
    status: "",
  });
  const [checklistFilters, setChecklistFilters] = useState({
    search: "",
    type: "",
    creator: "",
    date_from: "",
    date_to: "",
  });
  const [itemFilters, setItemFilters] = useState({
    search: "",
    type: "",
    status: "",
    priority: "",
    date_from: "",
    date_to: "",
  });

  const selectedUser = useMemo(
    () =>
      users.find((user) => String(user.id) === String(selectedUserId)) || null,
    [selectedUserId, users],
  );

  const visibleChecklists = useMemo(() => {
    if (!selectedUserId) {
      return [];
    }
    return checklists.filter(
      (checklist) => String(checklist.created_by_id) === String(selectedUserId),
    );
  }, [checklists, selectedUserId]);

  const selectedChecklist = useMemo(
    () =>
      visibleChecklists.find(
        (checklist) => String(checklist.id) === String(selectedChecklistId),
      ) || null,
    [selectedChecklistId, visibleChecklists],
  );

  const loadCurrentUser = useCallback(async () => {
    const res = await API.get("/auth/user/");
    const userData = res.data.data || {};
    if (!userData.is_admin) {
      navigate("/dashboard", { replace: true });
      return false;
    }
    setAdminEmail(userData.email || "");
    return true;
  }, [navigate]);

  const loadUsers = useCallback(async () => {
    const res = await API.get(`/admin/users/${buildQueryString(userFilters)}`);
    const nextUsers = normaliseCollection(res);
    setUsers(nextUsers);
    if (!nextUsers.some((user) => String(user.id) === String(selectedUserId))) {
      setSelectedUserId(null);
      setUserModalOpen(false);
      setSelectedChecklistId(null);
      setItems([]);
    }
  }, [selectedUserId, userFilters]);

  const loadChecklists = useCallback(async () => {
    const res = await API.get(
      `/admin/checklists/${buildQueryString(checklistFilters)}`,
    );
    setChecklists(normaliseCollection(res));
  }, [checklistFilters]);

  const loadItems = useCallback(
    async (checklistId) => {
      if (!checklistId) {
        setItems([]);
        return;
      }
      setLoadingItems(true);
      try {
        const res = await API.get(
          `/admin/checklists/${checklistId}/items/${buildQueryString(itemFilters)}`,
        );
        setItems(normaliseCollection(res));
      } finally {
        setLoadingItems(false);
      }
    },
    [itemFilters],
  );

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      try {
        const isAdmin = await loadCurrentUser();
        if (!isAdmin || !mounted) {
          return;
        }
        await Promise.all([loadUsers(), loadChecklists()]);
      } catch (err) {
        if (mounted) {
          setError(
            err.response?.data?.message || "Failed to load admin console",
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    bootstrap();

    return () => {
      mounted = false;
    };
  }, [loadChecklists, loadCurrentUser, loadUsers]);

  useEffect(() => {
    if (!selectedChecklistId) {
      setItems([]);
      return;
    }
    loadItems(selectedChecklistId).catch((err) => {
      setError(
        err.response?.data?.message || "Failed to load checklist items.",
      );
    });
  }, [selectedChecklistId, loadItems]);

  useEffect(() => {
    if (!selectedUserId || !userModalOpen) {
      setSelectedChecklistId(null);
      return;
    }
    const firstChecklist = visibleChecklists[0] || null;
    if (
      !visibleChecklists.some(
        (checklist) => String(checklist.id) === String(selectedChecklistId),
      )
    ) {
      setSelectedChecklistId(firstChecklist?.id || null);
    }
  }, [selectedChecklistId, selectedUserId, userModalOpen, visibleChecklists]);

  function clearStatus() {
    setError("");
    setSuccess("");
  }

  function resetChecklistModalForm(userId = selectedUserId) {
    setChecklistForm({
      created_by_id: userId ? String(userId) : "",
      name: "",
      type: "Daily",
    });
    setChecklistErrors({});
    setChecklistImage(null);
    setChecklistImagePreview("");
    setRemoveChecklistImage(false);
  }

  function resetItemModalForm() {
    setItemForm({
      label: "",
      type: "",
      due_date: "",
      priority: "none",
      is_completed: false,
    });
    setItemErrors({});
  }

  function openCreateChecklistModal() {
    clearStatus();
    resetChecklistModalForm(selectedUserId);
    setChecklistModal({ open: true, mode: "create", checklistId: null });
  }

  function openEditChecklistModal(checklist) {
    clearStatus();
    setChecklistForm({
      created_by_id: String(checklist.created_by_id),
      name: checklist.name,
      type: checklist.type,
    });
    setChecklistErrors({});
    setChecklistImage(null);
    setChecklistImagePreview("");
    setRemoveChecklistImage(false);
    setChecklistModal({ open: true, mode: "edit", checklistId: checklist.id });
  }

  function closeChecklistModal() {
    setChecklistModal({ open: false, mode: "create", checklistId: null });
    resetChecklistModalForm(selectedUserId);
  }

  function openCreateItemModal() {
    clearStatus();
    resetItemModalForm();
    setItemModal({ open: true, mode: "create", itemId: null });
  }

  function openEditItemModal(item) {
    clearStatus();
    setItemForm({
      label: item.label,
      type: item.type,
      due_date: item.due_date || "",
      priority: item.priority || "none",
      is_completed: Boolean(item.is_completed),
    });
    setItemErrors({});
    setItemModal({ open: true, mode: "edit", itemId: item.id });
  }

  function closeItemModal() {
    setItemModal({ open: false, mode: "create", itemId: null });
    resetItemModalForm();
  }

  function openDeleteModal(kind, target) {
    const isChecklist = kind === "checklist";
    setConfirmModal({
      open: true,
      kind,
      id: target.id,
      title: isChecklist ? "Delete Checklist" : "Delete Item",
      message: isChecklist
        ? `Delete "${target.name}" permanently?`
        : `Delete "${target.label}" permanently?`,
    });
  }

  function closeDeleteModal() {
    setConfirmModal({
      open: false,
      kind: "checklist",
      id: null,
      title: "",
      message: "",
    });
  }

  function closeActivityModal() {
    setActivityModal({
      open: false,
      user: null,
      activities: [],
      loading: false,
    });
  }

  function handleUserSelect(user) {
    setSelectedUserId(user.id);
    setSelectedChecklistId(null);
    setUserModalOpen(true);
    clearStatus();
    closeChecklistModal();
    closeItemModal();
  }

  function closeUserManagementModal() {
    setUserModalOpen(false);
    setSelectedUserId(null);
    setSelectedChecklistId(null);
    setItems([]);
    closeChecklistModal();
    closeItemModal();
    closeDeleteModal();
    closeActivityModal();
    clearStatus();
  }

  function handleChecklistCardClick(checklistId) {
    setSelectedChecklistId(checklistId);
    clearStatus();
  }

  function handleChecklistInputChange(event) {
    const { name, value } = event.target;
    setChecklistForm((current) => ({ ...current, [name]: value }));
    setChecklistErrors((current) => ({ ...current, [name]: "" }));
  }

  function handleItemInputChange(event) {
    const { name, value, type, checked } = event.target;
    setItemForm((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
    setItemErrors((current) => ({ ...current, [name]: "" }));
  }

  function handleUserFilterChange(event) {
    const { name, value } = event.target;
    setUserFilters((current) => ({ ...current, [name]: value }));
  }

  function handleChecklistFilterChange(event) {
    const { name, value } = event.target;
    setChecklistFilters((current) => ({ ...current, [name]: value }));
  }

  function handleItemFilterChange(event) {
    const { name, value } = event.target;
    setItemFilters((current) => ({ ...current, [name]: value }));
  }

  function handleChecklistImageChange(event) {
    const file = event.target.files?.[0] || null;
    const validationError = validateImageFile(file);
    if (validationError) {
      setChecklistErrors((current) => ({ ...current, image: validationError }));
      return;
    }

    setChecklistErrors((current) => ({ ...current, image: "" }));
    setChecklistImage(file);
    setChecklistImagePreview(file ? URL.createObjectURL(file) : "");
    setRemoveChecklistImage(false);
  }

  function validateChecklistForm() {
    const nextErrors = {};
    if (!checklistForm.created_by_id) {
      nextErrors.created_by_id = "User is required.";
    }
    if (!checklistForm.name.trim()) {
      nextErrors.name = "Checklist name is required.";
    }
    if (!checklistForm.type) {
      nextErrors.type = "Checklist type is required.";
    }
    setChecklistErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function validateItemForm() {
    const nextErrors = {};
    if (!itemForm.label.trim()) {
      nextErrors.label = "Item label is required.";
    }
    if (!itemForm.type.trim()) {
      nextErrors.type = "Item type is required.";
    }
    setItemErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function submitChecklistForm(event) {
    event.preventDefault();
    if (!validateChecklistForm()) {
      return;
    }

    setSavingChecklist(true);
    clearStatus();

    try {
      const payload = buildChecklistPayload(
        checklistForm,
        checklistImage,
        removeChecklistImage,
      );
      if (checklistModal.mode === "edit" && checklistModal.checklistId) {
        await API.patch(
          `/admin/checklists/${checklistModal.checklistId}/`,
          payload,
        );
        setSuccess("Checklist updated successfully.");
      } else {
        await API.post("/admin/checklists/", payload);
        setSuccess("Checklist created successfully.");
      }
      await Promise.all([loadUsers(), loadChecklists()]);
      closeChecklistModal();
    } catch (err) {
      const apiErrors = err.response?.data?.errors || {};
      setChecklistErrors((current) => ({ ...current, ...apiErrors }));
      setError(err.response?.data?.message || "Failed to save checklist.");
    } finally {
      setSavingChecklist(false);
    }
  }

  async function submitItemForm(event) {
    event.preventDefault();
    if (!selectedChecklist || !validateItemForm()) {
      return;
    }

    setSavingItem(true);
    clearStatus();
    try {
      const payload = {
        ...itemForm,
        due_date: itemForm.due_date || null,
      };
      if (itemModal.mode === "edit" && itemModal.itemId) {
        await API.patch(
          `/admin/checklists/${selectedChecklist.id}/items/${itemModal.itemId}/`,
          payload,
        );
        setSuccess("Checklist item updated successfully.");
      } else {
        await API.post(
          `/admin/checklists/${selectedChecklist.id}/items/`,
          payload,
        );
        setSuccess("Checklist item created successfully.");
      }
      await Promise.all([
        loadItems(selectedChecklist.id),
        loadUsers(),
        loadChecklists(),
      ]);
      closeItemModal();
    } catch (err) {
      const apiErrors = err.response?.data?.errors || {};
      setItemErrors((current) => ({ ...current, ...apiErrors }));
      setError(err.response?.data?.message || "Failed to save checklist item.");
    } finally {
      setSavingItem(false);
    }
  }

  async function confirmDelete() {
    if (!confirmModal.id) {
      return;
    }

    setConfirmingDelete(true);
    clearStatus();

    try {
      if (confirmModal.kind === "checklist") {
        await API.delete(`/admin/checklists/${confirmModal.id}/`);
        if (String(selectedChecklistId) === String(confirmModal.id)) {
          setSelectedChecklistId(null);
          setItems([]);
        }
        setSuccess("Checklist deleted successfully.");
        await Promise.all([loadUsers(), loadChecklists()]);
      } else if (selectedChecklist) {
        await API.delete(
          `/admin/checklists/${selectedChecklist.id}/items/${confirmModal.id}/`,
        );
        setSuccess("Checklist item deleted successfully.");
        await Promise.all([
          loadItems(selectedChecklist.id),
          loadUsers(),
          loadChecklists(),
        ]);
      }
      closeDeleteModal();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete.");
    } finally {
      setConfirmingDelete(false);
    }
  }

  async function toggleItemCompletion(item) {
    if (!selectedChecklist) {
      return;
    }

    clearStatus();
    try {
      await API.patch(
        `/admin/checklists/${selectedChecklist.id}/items/${item.id}/`,
        {
          is_completed: !item.is_completed,
        },
      );
      await Promise.all([
        loadItems(selectedChecklist.id),
        loadUsers(),
        loadChecklists(),
      ]);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update item status.");
    }
  }

  async function updateUser(userId, payload, successMessage) {
    setUpdatingUserId(userId);
    clearStatus();
    try {
      await API.patch(`/admin/users/${userId}/`, payload);
      setSuccess(successMessage);
      await loadUsers();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update user.");
    } finally {
      setUpdatingUserId(null);
    }
  }

  async function openActivityHistory(user) {
    setActivityModal({
      open: true,
      user,
      activities: [],
      loading: true,
    });
    clearStatus();
    try {
      const res = await API.get(`/admin/users/${user.id}/activity/?limit=10`);
      setActivityModal({
        open: true,
        user,
        activities: normaliseCollection(res),
        loading: false,
      });
    } catch (err) {
      setActivityModal({
        open: true,
        user,
        activities: [],
        loading: false,
      });
      setError(
        err.response?.data?.message || "Failed to load activity history.",
      );
    }
  }

  function handlePromoteDemoteUser(user) {
    updateUser(
      user.id,
      { is_admin: !user.is_admin },
      user.is_admin
        ? "User demoted successfully."
        : "User promoted successfully.",
    );
  }

  function handleArchiveReactivateUser(user) {
    updateUser(
      user.id,
      { is_active: !user.is_active },
      user.is_active
        ? "User archived successfully."
        : "User reactivated successfully.",
    );
  }

  function handleDeleteChecklistRequest(checklist) {
    openDeleteModal("checklist", checklist);
  }

  function handleDeleteItemRequest(item) {
    openDeleteModal("item", item);
  }

  function handleLogout() {
    clearAccessToken();
    localStorage.removeItem("email");
    localStorage.removeItem("is_admin");
    navigate("/login");
  }

  return (
    <div style={styles.page}>
      <div style={styles.shell}>
        <header style={styles.header}>
          <div style={styles.headerCopy}>
            <span style={styles.eyebrow}>Admin Workspace</span>
            <button
              type="button"
              onClick={() => navigate("/dashboard")}
              style={styles.backButton}
              className="admin-btn admin-ghost-btn"
            >
              Back to Dashboard
            </button>
            <h1 style={styles.title}>Admin Console</h1>
            <p style={styles.subtitle}>
              Manage users, checklists, images, and checklist items from one
              focused control center.
            </p>
            <p style={styles.metaLine}>
              Signed in as <strong>{adminEmail || "admin"}</strong>
            </p>
          </div>
          <div style={styles.headerActionWrap}>
            <button
              type="button"
              onClick={handleLogout}
              style={styles.logoutButton}
              className="admin-btn admin-logout-btn"
            >
              Sign out
            </button>
          </div>
        </header>

        {error ? <div style={styles.errorBanner}>{error}</div> : null}
        {success ? <div style={styles.successBanner}>{success}</div> : null}

        {loading ? (
          <div style={styles.loadingCard}>Loading admin data...</div>
        ) : (
          <>
            <section style={styles.section} className="admin-surface">
              <div style={styles.sectionAccent} />
              <div style={styles.sectionHeader}>
                <div>
                  <h2 style={styles.sectionTitle}>Users</h2>
                  <span style={styles.sectionMeta}>
                    Click any user to open the management modal
                  </span>
                </div>
                <span style={styles.sectionMeta}>{users.length} users</span>
              </div>
              <AdminFilters
                filters={userFilters}
                onFilterChange={handleUserFilterChange}
                type="users"
                styles={styles}
              />
              <AdminUsersList
                users={users}
                selectedUserId={userModalOpen ? selectedUserId : null}
                onSelectUser={handleUserSelect}
                styles={styles}
              />
              {!users.length ? (
                <div style={styles.inlineEmptyState}>
                  <h3 style={styles.emptyStateTitle}>No users found</h3>
                  <p style={styles.emptyStateCopy}>
                    Try adjusting the filters to find a user to manage.
                  </p>
                </div>
              ) : null}
            </section>
          </>
        )}

        {userModalOpen && selectedUser ? (
          <ModalShell
            title={`Manage ${selectedUser.email}`}
            onClose={closeUserManagementModal}
            panelStyle={styles.managementModalPanel}
          >
            <div style={styles.managementModalBody}>
              <UserDetailCard
                user={selectedUser}
                onPromoteDemote={handlePromoteDemoteUser}
                onArchiveReactivate={handleArchiveReactivateUser}
                onViewActivity={openActivityHistory}
                updatingUserId={updatingUserId}
                styles={styles}
              />

              <section style={styles.section} className="admin-surface">
                <div style={styles.sectionAccent} />
                <div style={styles.sectionHeader}>
                  <div>
                    <h2 style={styles.sectionTitle}>Checklists</h2>
                    <span style={styles.sectionMeta}>
                      Full checklist and item management for {selectedUser.email}
                    </span>
                  </div>
                </div>
                <AdminFilters
                  filters={checklistFilters}
                  onFilterChange={handleChecklistFilterChange}
                  type="checklists"
                  styles={styles}
                  checklistTypes={CHECKLIST_TYPES}
                />
                <AdminChecklistsList
                  checklists={visibleChecklists}
                  selectedChecklistId={selectedChecklistId}
                  userId={selectedUser.id}
                  userEmail={selectedUser.email}
                  onSelectChecklist={handleChecklistCardClick}
                  onEditChecklist={openEditChecklistModal}
                  onDeleteChecklist={handleDeleteChecklistRequest}
                  onCreateChecklist={openCreateChecklistModal}
                  styles={styles}
                  defaultChecklistImage={DEFAULT_CHECKLIST_IMAGE}
                />
              </section>

              {selectedChecklist ? (
                <section style={styles.section} className="admin-surface">
                  <div style={styles.sectionAccent} />
                  <div style={styles.sectionHeader}>
                    <div>
                      <h2 style={styles.sectionTitle}>Items</h2>
                      <span style={styles.sectionMeta}>
                        Managing items for {selectedChecklist.name}
                      </span>
                    </div>
                  </div>
                  <AdminFilters
                    filters={itemFilters}
                    onFilterChange={handleItemFilterChange}
                    type="items"
                    styles={styles}
                    priorityOptions={PRIORITY_OPTIONS}
                  />
                  <AdminItemsList
                    items={items}
                    selectedChecklist={selectedChecklist}
                    onToggleItem={toggleItemCompletion}
                    onEditItem={openEditItemModal}
                    onDeleteItem={handleDeleteItemRequest}
                    onCreateItem={openCreateItemModal}
                    loading={loadingItems}
                    styles={styles}
                  />
                </section>
              ) : (
                <section style={styles.emptyStateCard} className="admin-surface">
                  <span style={styles.eyebrow}>Items Section</span>
                  <h2 style={styles.emptyStateTitle}>
                    Click a checklist to view its items
                  </h2>
                  <p style={styles.emptyStateCopy}>
                    Select a checklist inside this modal to add, edit, delete,
                    and toggle checklist items without leaving the page.
                  </p>
                </section>
              )}
            </div>
          </ModalShell>
        ) : null}

        {checklistModal.open ? (
          <ModalShell
            title={
              checklistModal.mode === "edit"
                ? "Edit Checklist"
                : "Add New Checklist"
            }
            onClose={closeChecklistModal}
          >
            <form onSubmit={submitChecklistForm} style={styles.modalForm}>
              <div style={styles.modalField}>
                <label htmlFor="admin-checklist-user" style={styles.modalLabel}>
                  User <span style={styles.required}>*</span>
                </label>
                <select
                  id="admin-checklist-user"
                  name="created_by_id"
                  value={checklistForm.created_by_id}
                  onChange={handleChecklistInputChange}
                  style={styles.select}
                  className="admin-input"
                >
                  <option value="">Select user</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.email}
                    </option>
                  ))}
                </select>
                {checklistErrors.created_by_id ? (
                  <p style={styles.validationText}>
                    {checklistErrors.created_by_id}
                  </p>
                ) : null}
              </div>
              <div style={styles.modalField}>
                <label htmlFor="admin-checklist-name" style={styles.modalLabel}>
                  Checklist Name <span style={styles.required}>*</span>
                </label>
                <input
                  id="admin-checklist-name"
                  name="name"
                  value={checklistForm.name}
                  onChange={handleChecklistInputChange}
                  style={styles.input}
                  className="admin-input"
                />
                {checklistErrors.name ? (
                  <p style={styles.validationText}>{checklistErrors.name}</p>
                ) : null}
              </div>
              <div style={styles.modalField}>
                <label htmlFor="admin-checklist-type" style={styles.modalLabel}>
                  Checklist Type <span style={styles.required}>*</span>
                </label>
                <select
                  id="admin-checklist-type"
                  name="type"
                  value={checklistForm.type}
                  onChange={handleChecklistInputChange}
                  style={styles.select}
                  className="admin-input"
                >
                  {CHECKLIST_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
                {checklistErrors.type ? (
                  <p style={styles.validationText}>{checklistErrors.type}</p>
                ) : null}
              </div>
              <div style={styles.modalField}>
                <label
                  htmlFor="admin-checklist-image"
                  style={styles.modalLabel}
                >
                  Checklist Image
                </label>
                <input
                  id="admin-checklist-image"
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp"
                  onChange={handleChecklistImageChange}
                  className="admin-file-input"
                />
                {checklistErrors.image ? (
                  <p style={styles.validationText}>{checklistErrors.image}</p>
                ) : null}
              </div>
              <div style={styles.modalPreviewRow}>
                <img
                  src={checklistPreviewSrc(
                    visibleChecklists.find(
                      (checklist) =>
                        checklist.id === checklistModal.checklistId,
                    ),
                    checklistImagePreview,
                    removeChecklistImage,
                  )}
                  alt="Checklist preview"
                  style={styles.modalPreviewImage}
                />
                {checklistModal.mode === "edit" ? (
                  <button
                    type="button"
                    onClick={() => {
                      setChecklistImage(null);
                      setChecklistImagePreview("");
                      setRemoveChecklistImage(true);
                    }}
                    style={styles.deleteGhostButton}
                    className="admin-btn admin-danger-ghost-btn"
                  >
                    Remove Image
                  </button>
                ) : null}
              </div>
              <div style={styles.modalActions}>
                <button
                  type="button"
                  onClick={closeChecklistModal}
                  style={styles.ghostButton}
                  className="admin-btn admin-ghost-btn"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={styles.primaryButton}
                  className="admin-btn admin-primary-btn"
                >
                  {savingChecklist
                    ? checklistModal.mode === "edit"
                      ? "Saving..."
                      : "Creating..."
                    : checklistModal.mode === "edit"
                      ? "Save Checklist"
                      : "Create Checklist"}
                </button>
              </div>
            </form>
          </ModalShell>
        ) : null}

        {itemModal.open ? (
          <ModalShell
            title={
              itemModal.mode === "edit" ? "Edit Checklist Item" : "Add New Item"
            }
            onClose={closeItemModal}
          >
            <form onSubmit={submitItemForm} style={styles.modalForm}>
              <div style={styles.modalField}>
                <label htmlFor="admin-item-label" style={styles.modalLabel}>
                  Item Label <span style={styles.required}>*</span>
                </label>
                <input
                  id="admin-item-label"
                  name="label"
                  value={itemForm.label}
                  onChange={handleItemInputChange}
                  style={styles.input}
                  className="admin-input"
                />
                {itemErrors.label ? (
                  <p style={styles.validationText}>{itemErrors.label}</p>
                ) : null}
              </div>
              <div style={styles.modalField}>
                <label htmlFor="admin-item-type" style={styles.modalLabel}>
                  Item Type <span style={styles.required}>*</span>
                </label>
                <input
                  id="admin-item-type"
                  name="type"
                  value={itemForm.type}
                  onChange={handleItemInputChange}
                  style={styles.input}
                  className="admin-input"
                />
                {itemErrors.type ? (
                  <p style={styles.validationText}>{itemErrors.type}</p>
                ) : null}
              </div>
              <div style={styles.modalField}>
                <label htmlFor="admin-item-due-date" style={styles.modalLabel}>
                  Due Date
                </label>
                <input
                  id="admin-item-due-date"
                  type="date"
                  name="due_date"
                  value={itemForm.due_date}
                  onChange={handleItemInputChange}
                  style={styles.input}
                  className="admin-input"
                />
              </div>
              <div style={styles.modalField}>
                <label htmlFor="admin-item-priority" style={styles.modalLabel}>
                  Priority
                </label>
                <select
                  id="admin-item-priority"
                  name="priority"
                  value={itemForm.priority}
                  onChange={handleItemInputChange}
                  style={styles.select}
                  className="admin-input"
                >
                  {PRIORITY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div style={styles.modalField}>
                <label style={styles.modalLabel}>Status</label>
                <label style={styles.checkboxAction}>
                  <input
                    type="checkbox"
                    name="is_completed"
                    checked={itemForm.is_completed}
                    onChange={handleItemInputChange}
                  />
                  <span>Completed</span>
                </label>
              </div>
              <div style={styles.modalActions}>
                <button
                  type="button"
                  onClick={closeItemModal}
                  style={styles.ghostButton}
                  className="admin-btn admin-ghost-btn"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={styles.primaryButton}
                  className="admin-btn admin-primary-btn"
                >
                  {savingItem
                    ? itemModal.mode === "edit"
                      ? "Saving..."
                      : "Creating..."
                    : itemModal.mode === "edit"
                      ? "Save Item"
                      : "Create Item"}
                </button>
              </div>
            </form>
          </ModalShell>
        ) : null}

        {activityModal.open ? (
          <ModalShell
            title={`Login Activity${activityModal.user ? ` Â· ${activityModal.user.email}` : ""}`}
            onClose={closeActivityModal}
          >
            {activityModal.loading ? (
              <p style={styles.emptyText}>Loading activity...</p>
            ) : activityModal.activities.length ? (
              <div style={styles.stackList}>
                {activityModal.activities.map((activity) => (
                  <div key={activity.id} style={styles.activityRow}>
                    <div>
                      <strong style={styles.listTitle}>
                        {activity.provider}
                      </strong>
                      <p style={styles.listMeta}>
                        {new Date(activity.logged_in_at).toLocaleString()}
                      </p>
                    </div>
                    <div style={styles.activityMeta}>
                      <span style={styles.metaPill}>
                        {activity.ip_address || "No IP"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={styles.emptyText}>
                No login activity recorded for this user yet.
              </p>
            )}
          </ModalShell>
        ) : null}

        {confirmModal.open ? (
          <ModalShell title={confirmModal.title} onClose={closeDeleteModal}>
            <div style={styles.confirmBody}>
              <p style={styles.confirmText}>{confirmModal.message}</p>
              <div style={styles.modalActions}>
                <button
                  type="button"
                  onClick={closeDeleteModal}
                  style={styles.ghostButton}
                  className="admin-btn admin-ghost-btn"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmDelete}
                  style={styles.deleteButton}
                  className="admin-btn admin-danger-btn"
                >
                  {confirmingDelete ? "Deleting..." : "Confirm Delete"}
                </button>
              </div>
            </div>
          </ModalShell>
        ) : null}
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: THEME.page,
    padding: SPACING.xl,
    fontFamily: '"Segoe UI", "Trebuchet MS", sans-serif',
    color: THEME.text,
  },
  shell: {
    maxWidth: "1400px",
    margin: "0 auto",
    display: "flex",
    flexDirection: "column",
    gap: SPACING.lg,
  },
  header: {
    background:
      "linear-gradient(140deg, rgba(15, 23, 42, 0.96), rgba(30, 41, 59, 0.94) 58%, rgba(15, 118, 110, 0.92))",
    borderRadius: "32px",
    padding: `${SPACING.xl} ${SPACING.xxl}`,
    boxShadow: "0 28px 60px rgba(15, 23, 42, 0.16)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "stretch",
    gap: SPACING.lg,
    flexWrap: "wrap",
    color: THEME.textStrong,
  },
  headerCopy: {
    maxWidth: "760px",
  },
  eyebrow: {
    display: "inline-block",
    marginBottom: "14px",
    padding: "6px 12px",
    borderRadius: "999px",
    background: "rgba(255,255,255,0.1)",
    color: "#bfdbfe",
    fontSize: "12px",
    textTransform: "uppercase",
    letterSpacing: "0.14em",
    fontWeight: 800,
  },
  backButton: {
    border: `1px solid ${THEME.border}`,
    background: "rgba(255,255,255,0.08)",
    color: THEME.white,
    padding: "10px 14px",
    borderRadius: "999px",
    cursor: "pointer",
    fontWeight: 700,
    marginBottom: "16px",
  },
  title: {
    margin: 0,
    fontSize: "40px",
    letterSpacing: "-0.04em",
  },
  subtitle: {
    margin: "12px 0 0",
    color: "#cbd5e1",
    maxWidth: "620px",
    lineHeight: 1.65,
  },
  metaLine: {
    margin: "14px 0 0",
    color: "#e2e8f0",
  },
  headerActionWrap: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "flex-end",
  },
  headerStatsWrap: {
    display: "flex",
    gap: SPACING.sm,
    flexWrap: "wrap",
    alignItems: "stretch",
  },
  headerStat: {
    minWidth: "220px",
    background: "rgba(255,255,255,0.08)",
    color: THEME.white,
    padding: `${SPACING.md} ${SPACING.lg}`,
    borderRadius: "22px",
    border: `1px solid ${THEME.border}`,
    backdropFilter: "blur(8px)",
  },
  headerStatLabel: {
    display: "block",
    fontSize: "12px",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    opacity: 0.72,
    marginBottom: "10px",
  },
  headerStatValue: {
    fontSize: "34px",
    fontWeight: 800,
  },
  headerMiniStat: {
    minWidth: "132px",
    padding: SPACING.md,
    borderRadius: "22px",
    background: "rgba(255,255,255,0.08)",
    border: `1px solid ${THEME.border}`,
    backdropFilter: "blur(8px)",
  },
  headerMiniLabel: {
    display: "block",
    fontSize: "11px",
    color: "#bfdbfe",
    textTransform: "uppercase",
    letterSpacing: "0.14em",
    marginBottom: "8px",
    fontWeight: 800,
  },
  headerMiniValue: {
    fontSize: "28px",
    color: THEME.white,
    fontWeight: 800,
  },
  logoutButton: {
    border: `1px solid ${THEME.border}`,
    background: "rgba(15, 23, 42, 0.42)",
    color: THEME.white,
    padding: "14px 18px",
    borderRadius: "18px",
    cursor: "pointer",
    fontWeight: 800,
    alignSelf: "stretch",
    minHeight: "72px",
  },
  errorBanner: {
    background: THEME.errorBg,
    color: THEME.errorText,
    border: `1px solid ${THEME.errorBorder}`,
    borderRadius: "16px",
    padding: "14px 18px",
    fontWeight: 700,
  },
  successBanner: {
    background: THEME.successBg,
    color: THEME.successText,
    border: `1px solid ${THEME.successBorder}`,
    borderRadius: "16px",
    padding: "14px 18px",
    fontWeight: 700,
  },
  loadingCard: {
    background: THEME.panel,
    borderRadius: "24px",
    padding: "32px",
    boxShadow: "0 18px 45px rgba(15, 23, 42, 0.08)",
    textAlign: "center",
    fontWeight: 700,
    border: `1px solid ${THEME.border}`,
  },
  section: {
    background: THEME.panel,
    borderRadius: "28px",
    padding: SPACING.xl,
    boxShadow: "0 18px 45px rgba(15, 23, 42, 0.08)",
    border: `1px solid ${THEME.border}`,
  },
  sectionAccent: {
    width: "88px",
    height: "4px",
    borderRadius: "999px",
    background: `linear-gradient(90deg, ${THEME.accent}, rgba(56, 189, 248, 0.08))`,
    marginBottom: "18px",
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: SPACING.md,
    flexWrap: "wrap",
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    margin: 0,
    fontSize: "22px",
  },
  sectionMeta: {
    color: THEME.muted,
    fontWeight: 700,
  },
  sectionHint: {
    margin: "0 0 18px",
    color: THEME.muted,
    lineHeight: 1.6,
    fontSize: "14px",
  },
  filterGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  workspace: {
    display: "grid",
    gridTemplateColumns: "320px minmax(0, 1fr)",
    gap: SPACING.lg,
    alignItems: "start",
  },
  userRail: {
    background: THEME.panelSoft,
    borderRadius: "28px",
    padding: SPACING.xl,
    boxShadow: "0 18px 45px rgba(15, 23, 42, 0.08)",
    border: `1px solid ${THEME.border}`,
    position: "sticky",
    top: "20px",
  },
  userList: {
    display: "flex",
    flexDirection: "column",
    gap: SPACING.sm,
  },
  inlineEmptyState: {
    marginTop: SPACING.lg,
    padding: SPACING.xl,
    borderRadius: "24px",
    border: `1px dashed ${THEME.borderStrong}`,
    background: THEME.panelSoft,
  },
  mainWorkspace: {
    display: "flex",
    flexDirection: "column",
    gap: SPACING.lg,
  },
  userCard: (selected) => ({
    border: selected
      ? `2px solid ${THEME.accent}`
      : `1px solid ${THEME.border}`,
    borderRadius: "22px",
    padding: "16px",
    background: selected
      ? "linear-gradient(145deg, rgba(14,165,233,0.16), rgba(15,23,42,0.98))"
      : THEME.card,
    cursor: "pointer",
    transition:
      "border-color 180ms ease, background 180ms ease, transform 180ms ease",
  }),
  userStatsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: SPACING.md,
  },
  userStatsCard: {
    border: `1px solid ${THEME.border}`,
    borderRadius: "24px",
    padding: SPACING.lg,
    background: THEME.card,
  },
  insightsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: SPACING.md,
    alignItems: "stretch",
  },
  insightStatCard: {
    border: `1px solid ${THEME.border}`,
    borderRadius: "24px",
    padding: SPACING.lg,
    background:
      "linear-gradient(145deg, rgba(15,23,42,0.98) 0%, rgba(14,165,233,0.12) 100%)",
    boxShadow: "0 12px 30px rgba(14, 165, 233, 0.08)",
    display: "flex",
    flexDirection: "column",
    gap: SPACING.sm,
  },
  ringCard: {
    border: `1px solid ${THEME.borderStrong}`,
    borderRadius: "24px",
    padding: SPACING.lg,
    background:
      "linear-gradient(145deg, rgba(15,23,42,0.98) 0%, rgba(34,197,94,0.08) 100%)",
    boxShadow: "0 16px 36px rgba(34, 197, 94, 0.08)",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    gap: SPACING.sm,
  },
  metricIconRow: {
    display: "flex",
    alignItems: "center",
    gap: SPACING.sm,
  },
  metricEmoji: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "36px",
    height: "36px",
    borderRadius: "12px",
    background: "rgba(255,255,255,0.08)",
    fontSize: "18px",
  },
  metricCaption: {
    color: "#cbd5e1",
    fontSize: "13px",
    lineHeight: 1.6,
  },
  ringWrap: {
    position: "relative",
    width: "132px",
    height: "132px",
    alignSelf: "center",
    marginTop: SPACING.sm,
  },
  ringSvg: {
    display: "block",
    filter: "drop-shadow(0 10px 20px rgba(56, 189, 248, 0.18))",
  },
  ringCenter: {
    position: "absolute",
    inset: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
  },
  ringValue: {
    color: THEME.textStrong,
    fontSize: "24px",
    fontWeight: 800,
  },
  ringLabel: {
    color: THEME.muted,
    fontSize: "12px",
    fontWeight: 700,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
  },
  cardTitle: {
    margin: 0,
    fontSize: "18px",
    color: THEME.textStrong,
  },
  userTopRow: {
    display: "flex",
    alignItems: "center",
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  userIdentity: {
    minWidth: 0,
    flex: 1,
  },
  avatar: {
    width: "52px",
    height: "52px",
    borderRadius: "50%",
    objectFit: "cover",
    background: "#0f172a",
    border: `1px solid ${THEME.borderStrong}`,
  },
  userEmail: {
    margin: 0,
    fontSize: "16px",
    color: THEME.textStrong,
  },
  userRole: {
    margin: "4px 0 0",
    color: THEME.muted,
    fontSize: "13px",
  },
  userCompletionPill: {
    padding: "7px 10px",
    borderRadius: "999px",
    background: "rgba(56, 189, 248, 0.16)",
    color: "#bae6fd",
    fontWeight: 800,
    fontSize: "12px",
  },
  userMiniStats: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
    color: "#cbd5e1",
    fontSize: "13px",
    fontWeight: 700,
  },
  userMiniProgressBlock: {
    marginTop: SPACING.sm,
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  userMiniProgressText: {
    color: "#dbeafe",
    fontSize: "12px",
    fontWeight: 700,
    lineHeight: 1.5,
  },
  metricGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: SPACING.xs,
  },
  metricCard: {
    background: THEME.panelAlt,
    borderRadius: "16px",
    padding: SPACING.sm,
    border: `1px solid ${THEME.border}`,
  },
  metricLabel: {
    display: "block",
    color: THEME.muted,
    fontSize: "12px",
    marginBottom: "6px",
  },
  metricValue: {
    fontSize: "20px",
    fontWeight: 800,
    color: THEME.textStrong,
  },
  metricValueSmall: {
    fontSize: "14px",
    fontWeight: 700,
    color: THEME.textStrong,
    lineHeight: 1.5,
  },
  userItemProgressBlock: {
    marginTop: SPACING.md,
    padding: SPACING.sm,
    borderRadius: "18px",
    border: `1px solid ${THEME.border}`,
    background: "rgba(15, 23, 42, 0.75)",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  progressHeaderRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: SPACING.sm,
    flexWrap: "wrap",
  },
  progressCountText: {
    color: "#dcfce7",
    fontSize: "13px",
    fontWeight: 800,
  },
  progressTrack: {
    width: "100%",
    height: "10px",
    borderRadius: "999px",
    overflow: "hidden",
    background: "rgba(148, 163, 184, 0.16)",
    border: `1px solid ${THEME.border}`,
  },
  progressTrackSmall: {
    width: "100%",
    height: "8px",
    borderRadius: "999px",
    overflow: "hidden",
    background: "rgba(148, 163, 184, 0.16)",
    border: `1px solid ${THEME.border}`,
  },
  progressFill: (value) => ({
    width: `${Math.max(0, Math.min(100, Number(value || 0)))}%`,
    height: "100%",
    borderRadius: "999px",
    background: "linear-gradient(90deg, #22c55e 0%, #38bdf8 100%)",
    boxShadow: "0 0 18px rgba(34, 197, 94, 0.28)",
  }),
  stackList: {
    display: "flex",
    flexDirection: "column",
    gap: SPACING.sm,
  },
  listRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: SPACING.sm,
    padding: `${SPACING.sm} 0`,
    borderBottom: `1px solid ${THEME.border}`,
  },
  listTitle: {
    color: THEME.textStrong,
  },
  listMeta: {
    margin: "6px 0 0",
    color: THEME.muted,
    lineHeight: 1.5,
    fontSize: "13px",
  },
  rankPill: {
    minWidth: "42px",
    textAlign: "center",
    padding: "6px 10px",
    borderRadius: "999px",
    background: "rgba(56, 189, 248, 0.14)",
    color: "#bae6fd",
    fontWeight: 800,
    fontSize: "12px",
  },
  heroPanel: {
    background:
      "linear-gradient(145deg, rgba(15,23,42,0.98) 0%, rgba(30,41,59,0.96) 52%, rgba(8,47,73,0.94) 100%)",
    borderRadius: "30px",
    padding: SPACING.xl,
    border: `1px solid ${THEME.borderStrong}`,
    boxShadow: "0 20px 48px rgba(37, 99, 235, 0.08)",
  },
  heroTopRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: SPACING.md,
    flexWrap: "wrap",
  },
  heroIdentity: {
    display: "flex",
    alignItems: "center",
    gap: SPACING.md,
  },
  heroAvatar: {
    width: "70px",
    height: "70px",
    borderRadius: "22px",
    objectFit: "cover",
    border: `2px solid ${THEME.borderStrong}`,
    background: "#0f172a",
  },
  heroTitle: {
    margin: "6px 0 0",
    fontSize: "30px",
    letterSpacing: "-0.03em",
  },
  heroSubtitle: {
    margin: "10px 0 0",
    color: "#cbd5e1",
    maxWidth: "650px",
    lineHeight: 1.65,
  },
  heroRateCard: {
    minWidth: "170px",
    padding: `${SPACING.md} ${SPACING.lg}`,
    borderRadius: "22px",
    background: "rgba(2, 6, 23, 0.92)",
    color: THEME.white,
    border: `1px solid ${THEME.border}`,
  },
  heroRateValue: {
    fontSize: "30px",
    fontWeight: 800,
  },
  heroStatsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: SPACING.sm,
    marginTop: SPACING.lg,
  },
  heroStatCard: {
    padding: `${SPACING.md} ${SPACING.md}`,
    borderRadius: "20px",
    background: THEME.panelAlt,
    border: `1px solid ${THEME.border}`,
  },
  heroStatValue: {
    display: "block",
    marginTop: "6px",
    fontSize: "26px",
    fontWeight: 800,
  },
  checklistList: {
    display: "flex",
    flexDirection: "column",
    gap: SPACING.sm,
  },
  checklistCard: (selected) => ({
    display: "flex",
    justifyContent: "space-between",
    alignItems: "stretch",
    gap: SPACING.md,
    padding: SPACING.lg,
    background: selected
      ? "linear-gradient(145deg, rgba(14,165,233,0.14), rgba(30,41,59,0.96))"
      : THEME.cardSoft,
    borderRadius: "26px",
    border: selected
      ? `1px solid ${THEME.borderStrong}`
      : `1px solid ${THEME.border}`,
    flexWrap: "wrap",
    cursor: "pointer",
  }),
  checklistInfo: {
    flex: 1,
    minWidth: "240px",
  },
  checklistTopRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: SPACING.sm,
    flexWrap: "wrap",
  },
  checklistImage: {
    width: "92px",
    height: "92px",
    borderRadius: "18px",
    objectFit: "cover",
    border: `1px solid ${THEME.borderStrong}`,
    background: "#0f172a",
  },
  checklistBody: {
    display: "flex",
    flexDirection: "column",
    gap: SPACING.xs,
    minWidth: 0,
  },
  checklistHeadingRow: {
    display: "flex",
    alignItems: "center",
    gap: SPACING.xs,
    flexWrap: "wrap",
    marginBottom: SPACING.xs,
  },
  checklistName: {
    margin: 0,
    fontSize: "18px",
    color: THEME.textStrong,
  },
  checklistType: {
    background: "rgba(56, 189, 248, 0.14)",
    color: "#bae6fd",
    borderRadius: "999px",
    padding: "4px 10px",
    fontSize: "12px",
    fontWeight: 800,
  },
  checklistStats: {
    display: "flex",
    gap: SPACING.sm,
    flexWrap: "wrap",
    color: "#cbd5e1",
    fontSize: "13px",
    fontWeight: 700,
  },
  itemList: {
    display: "flex",
    flexDirection: "column",
    gap: SPACING.sm,
  },
  itemCard: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "stretch",
    gap: SPACING.md,
    padding: SPACING.lg,
    background: THEME.cardSoft,
    borderRadius: "24px",
    border: `1px solid ${THEME.border}`,
    flexWrap: "wrap",
  },
  itemInfo: {
    flex: 1,
    minWidth: "240px",
  },
  itemHeadingRow: {
    display: "flex",
    alignItems: "center",
    gap: SPACING.xs,
    flexWrap: "wrap",
    marginBottom: SPACING.xs,
  },
  itemName: {
    margin: 0,
    fontSize: "18px",
    color: THEME.textStrong,
  },
  itemStatsRow: {
    display: "flex",
    gap: SPACING.xs,
    flexWrap: "wrap",
    marginTop: SPACING.xs,
  },
  statusPill: (done) => ({
    padding: "7px 10px",
    borderRadius: "999px",
    background: done ? "rgba(34,197,94,0.16)" : "rgba(251,191,36,0.14)",
    color: done ? "#bbf7d0" : "#fde68a",
    fontSize: "12px",
    fontWeight: 800,
  }),
  metaPill: {
    padding: "7px 10px",
    borderRadius: "999px",
    background: "rgba(148,163,184,0.14)",
    color: "#cbd5e1",
    fontSize: "12px",
    fontWeight: 700,
  },
  ownerText: {
    margin: `0 0 ${SPACING.xs}`,
    color: THEME.muted,
  },
  actions: {
    display: "flex",
    gap: SPACING.xs,
    flexWrap: "wrap",
    alignItems: "center",
  },
  checkboxAction: {
    display: "flex",
    alignItems: "center",
    gap: SPACING.xs,
    color: THEME.text,
    fontWeight: 700,
    padding: `${SPACING.xs} ${SPACING.sm}`,
    borderRadius: "14px",
    background: THEME.panelAlt,
    border: `1px solid ${THEME.border}`,
  },
  emptyText: {
    margin: 0,
    color: THEME.muted,
    lineHeight: 1.7,
  },
  emptyStateCard: {
    borderRadius: "30px",
    padding: "40px",
    background:
      "linear-gradient(145deg, rgba(15,23,42,0.98), rgba(8,47,73,0.94))",
    border: `1px solid ${THEME.borderStrong}`,
    boxShadow: "0 20px 48px rgba(37, 99, 235, 0.08)",
  },
  emptyStateTitle: {
    margin: "10px 0 0",
    fontSize: "30px",
    letterSpacing: "-0.03em",
    color: THEME.textStrong,
  },
  emptyStateCopy: {
    margin: `${SPACING.sm} 0 0`,
    maxWidth: "620px",
    lineHeight: 1.7,
    color: "#cbd5e1",
  },
  input: {
    border: `1px solid ${THEME.border}`,
    borderRadius: "14px",
    padding: `${SPACING.sm} ${SPACING.sm}`,
    fontSize: "14px",
    background: "rgba(15, 23, 42, 0.86)",
    color: THEME.textStrong,
    minHeight: "48px",
  },
  select: {
    border: `1px solid ${THEME.border}`,
    borderRadius: "14px",
    padding: `${SPACING.sm} ${SPACING.sm}`,
    fontSize: "14px",
    background: "rgba(15, 23, 42, 0.86)",
    color: THEME.textStrong,
    minHeight: "48px",
  },
  primaryButton: {
    border: "none",
    background: `linear-gradient(135deg, ${THEME.accentDeep}, ${THEME.accent})`,
    color: THEME.white,
    borderRadius: "14px",
    padding: `${SPACING.sm} ${SPACING.md}`,
    fontWeight: 800,
    cursor: "pointer",
  },
  secondaryButton: {
    border: `1px solid ${THEME.accent}`,
    background: "rgba(14, 165, 233, 0.08)",
    color: "#bae6fd",
    borderRadius: "12px",
    padding: `${SPACING.xs} ${SPACING.sm}`,
    fontWeight: 800,
    cursor: "pointer",
  },
  ghostButton: {
    border: `1px solid ${THEME.border}`,
    background: "rgba(15, 23, 42, 0.76)",
    color: THEME.text,
    borderRadius: "14px",
    padding: `${SPACING.xs} ${SPACING.sm}`,
    fontWeight: 700,
    cursor: "pointer",
  },
  deleteButton: {
    border: "none",
    background: THEME.danger,
    color: THEME.white,
    borderRadius: "12px",
    padding: `${SPACING.xs} ${SPACING.sm}`,
    fontWeight: 800,
    cursor: "pointer",
  },
  deleteGhostButton: {
    border: "1px solid rgba(248, 113, 113, 0.4)",
    background: THEME.dangerSoft,
    color: "#fecaca",
    borderRadius: "14px",
    padding: "10px 14px",
    fontWeight: 700,
    cursor: "pointer",
  },
  modalBackdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(2, 6, 23, 0.72)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: SPACING.xl,
    zIndex: 1000,
  },
  modalPanel: {
    width: "100%",
    maxWidth: "760px",
    background: THEME.panel,
    borderRadius: "28px",
    border: `1px solid ${THEME.borderStrong}`,
    boxShadow: "0 28px 60px rgba(2, 6, 23, 0.34)",
    padding: SPACING.xl,
  },
  managementModalPanel: {
    maxWidth: "1200px",
    maxHeight: "88vh",
    overflowY: "auto",
  },
  managementModalBody: {
    display: "flex",
    flexDirection: "column",
    gap: SPACING.lg,
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  modalTitle: {
    margin: 0,
    fontSize: "28px",
    color: THEME.textStrong,
  },
  iconCloseButton: {
    minWidth: "96px",
  },
  modalForm: {
    display: "flex",
    flexDirection: "column",
    gap: SPACING.md,
  },
  modalField: {
    display: "flex",
    flexDirection: "column",
    gap: SPACING.xs,
  },
  modalLabel: {
    color: "#cbd5e1",
    fontWeight: 800,
  },
  required: {
    color: "#fca5a5",
  },
  validationText: {
    margin: 0,
    color: "#fca5a5",
    fontSize: "13px",
    fontWeight: 700,
  },
  modalPreviewRow: {
    display: "flex",
    alignItems: "center",
    gap: SPACING.md,
    flexWrap: "wrap",
  },
  modalPreviewImage: {
    width: "160px",
    height: "110px",
    borderRadius: "18px",
    objectFit: "cover",
    border: `1px solid ${THEME.borderStrong}`,
    background: "#0f172a",
  },
  modalActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: SPACING.sm,
    flexWrap: "wrap",
    marginTop: SPACING.xs,
  },
  confirmBody: {
    display: "flex",
    flexDirection: "column",
    gap: SPACING.md,
  },
  confirmText: {
    margin: 0,
    color: "#cbd5e1",
    lineHeight: 1.7,
  },
  activityRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: SPACING.sm,
    padding: `${SPACING.sm} 0`,
    borderBottom: `1px solid ${THEME.border}`,
    flexWrap: "wrap",
  },
  activityMeta: {
    display: "flex",
    alignItems: "center",
    gap: SPACING.xs,
  },
};

/* v8 ignore next -- DOM-only style injection */
if (
  typeof document !== "undefined" &&
  !document.getElementById("admin-page-theme")
) {
  const styleSheet = document.createElement("style");
  styleSheet.id = "admin-page-theme";
  styleSheet.textContent = `
    .admin-surface {
      transition: box-shadow 180ms ease, border-color 180ms ease, transform 180ms ease;
    }

    .admin-interactive-card:hover {
      transform: translateY(-2px);
      border-color: rgba(56, 189, 248, 0.5) !important;
      box-shadow: 0 18px 36px rgba(14, 165, 233, 0.12) !important;
    }

    .admin-btn {
      transition: transform 160ms ease, filter 160ms ease, box-shadow 160ms ease, background 160ms ease;
    }

    .admin-btn:hover {
      transform: translateY(-1px);
      filter: brightness(1.06);
    }

    .admin-primary-btn:hover {
      box-shadow: 0 14px 26px rgba(14, 165, 233, 0.22);
    }

    .admin-secondary-btn:hover,
    .admin-ghost-btn:hover,
    .admin-logout-btn:hover {
      box-shadow: 0 10px 22px rgba(15, 23, 42, 0.22);
    }

    .admin-danger-btn:hover,
    .admin-danger-ghost-btn:hover {
      box-shadow: 0 10px 22px rgba(239, 68, 68, 0.18);
    }

    .admin-input:focus {
      outline: none;
      border-color: rgba(56, 189, 248, 0.55) !important;
      box-shadow: 0 0 0 4px rgba(56, 189, 248, 0.14);
    }

    .admin-file-input::file-selector-button {
      margin-right: 10px;
      border: 1px solid rgba(56, 189, 248, 0.32);
      border-radius: 10px;
      background: rgba(56, 189, 248, 0.12);
      color: #e0f2fe;
      padding: 8px 12px;
      font-weight: 700;
      cursor: pointer;
    }

    .admin-file-input::file-selector-button:hover {
      background: rgba(56, 189, 248, 0.18);
    }

    @media (max-width: 1100px) {
      .admin-interactive-card:hover,
      .admin-btn:hover {
        transform: none;
      }
    }
  `;
  document.head.appendChild(styleSheet);
}


