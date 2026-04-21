import { useEffect, useState } from "react";
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

  if (draggedIndex === -1 || targetIndex === -1 || draggedIndex === targetIndex) {
    return items;
  }

  const [draggedItem] = updated.splice(draggedIndex, 1);
  updated.splice(targetIndex, 0, draggedItem);

  return updated.map((item, index) => ({ ...item, position: index + 1 }));
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
  const [loading, setLoading] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);
  const [showAddList, setShowAddList] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [newListType, setNewListType] = useState("");
  const [newListImage, setNewListImage] = useState(null);
  const [newListImagePreview, setNewListImagePreview] = useState("");
  const [newItemLabel, setNewItemLabel] = useState("");
  const [newItemType, setNewItemType] = useState("");
  const [editingItem, setEditingItem] = useState(null);
  const [editLabel, setEditLabel] = useState("");
  const [editType, setEditType] = useState("");
  const [error, setError] = useState("");
  const [editingChecklist, setEditingChecklist] = useState(null);
  const [editChecklistName, setEditChecklistName] = useState("");
  const [editChecklistType, setEditChecklistType] = useState("");
  const [editChecklistImage, setEditChecklistImage] = useState(null);
  const [editChecklistImagePreview, setEditChecklistImagePreview] = useState("");
  const [removeChecklistImage, setRemoveChecklistImage] = useState(false);
  const [draggedItemId, setDraggedItemId] = useState(null);

  useEffect(() => {
    setEmail(localStorage.getItem("email") || "User");
    loadProfile();
    loadChecklists();
    loadArchivedChecklists();
  }, []);

  async function loadProfile() {
    try {
      const res = await API.get("/auth/user/");
      const userData = res.data.data || {};
      setAvatarUrl(userData.avatar_url || DEFAULT_AVATAR_IMAGE);
    } catch (err) {
      console.error(err);
    }
  }

  async function loadChecklists() {
    setLoading(true);
    try {
      const res = await API.get("/checklist/");
      const data = res.data.data || res.data.results || res.data;
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
      const data = res.data.data || res.data.results || res.data;
      setArchivedChecklists(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    }
  }

  async function loadItems(checklistId) {
    setLoadingItems(true);
    try {
      const res = await API.get(`/checklist/${checklistId}/items/`);
      const data = res.data.data || res.data.results || res.data;
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setError("Failed to load items");
    } finally {
      setLoadingItems(false);
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

  function handleChecklistClick(checklist) {
    setSelectedChecklist(checklist);
    loadItems(checklist.id);
    setShowAddItem(false);
    setEditingItem(null);
    setError("");
  }

  function handleBackToDashboard() {
    setSelectedChecklist(null);
    setShowAddList(false);
    setShowAddItem(false);
    setEditingItem(null);
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
      setError(err.response?.data?.errors?.avatar?.[0] || "Failed to update avatar");
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
      const res = await API.patch(`/checklist/${editingChecklist.id}/`, payload);
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
      const archivedChecklist = res.data.data || checklists.find((item) => item.id === checklistId);
      setChecklists(checklists.filter((checklist) => checklist.id !== checklistId));
      setArchivedChecklists(
        archivedChecklist ? [archivedChecklist, ...archivedChecklists] : archivedChecklists,
      );

    } catch (err) {
      setError("Could not archive checklist.");
    }
  }

  async function handleRestoreChecklist(checklistId) {
    try {
      const res = await API.post(`/checklist/${checklistId}/restore/`);
      const restoredChecklist = res.data.data || archivedChecklists.find((item) => item.id === checklistId);
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

  async function handleAddItem(event) {
    event.preventDefault();
    setLoadingItems(true);

    try {
      const res = await API.post(`/checklist/${selectedChecklist.id}/items/`, {
        label: newItemLabel,
        type: newItemType,
      });
      const newItem = res.data.data || res.data;
      setItems([...items, newItem]);
      setNewItemLabel("");
      setNewItemType("");
      setShowAddItem(false);
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
        { label: editLabel, type: editType },
      );
      const updatedItem = res.data.data || res.data;
      setItems(items.map((item) => (item.id === editingItem.id ? updatedItem : item)));
      setEditingItem(null);
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
      setItems(items.map((current) => (current.id === item.id ? updatedItem : current)));
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

  function startEditingChecklist(checklist) {
    setEditingChecklist(checklist);
    setEditChecklistName(checklist.name);
    setEditChecklistType(checklist.type);
    setEditChecklistImage(null);
    setEditChecklistImagePreview("");
    setRemoveChecklistImage(false);
  }

  function handleLogout() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("email");
    onLogout();
    navigate("/login");
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          {(selectedChecklist || showAddList) && (
            <button onClick={handleBackToDashboard} style={styles.backBtn}>
              Back
            </button>
          )}
          <div>
            <h1 style={styles.title}>My Checklists</h1>
            <p style={styles.subtitle}>Welcome back, {email.split("@")[0]}</p>
          </div>
        </div>
        <div style={styles.headerRight}>
          <div style={styles.profileCard}>
            <img
              src={avatarPreview || avatarUrl || DEFAULT_AVATAR_IMAGE}
              alt="Profile avatar"
              style={styles.avatar}
            />
            <div style={styles.profileActions}>
              <label style={styles.avatarBtn}>
                Change Avatar
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp"
                  onChange={handleAvatarChange}
                  style={styles.hiddenInput}
                />
              </label>
              <button type="button" onClick={handleRemoveAvatar} style={styles.secondaryBtn}>
                Remove
              </button>
            </div>
          </div>
          <button onClick={handleLogout} style={styles.logoutBtn}>
            Sign out
          </button>
        </div>
      </div>

      {error && (
        <div style={styles.error}>
          {error}
          <button onClick={() => setError("")} style={styles.closeErr}>
            x
          </button>
        </div>
      )}

      {!selectedChecklist ? (
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <div style={styles.cardTitleSection}>
              <span style={styles.cardIcon}>Lists</span>
              <h3 style={styles.cardTitle}>All Checklists</h3>
              <span style={styles.count}>{checklists.length}</span>
            </div>
            <button
              onClick={() => setShowAddList(!showAddList)}
              style={styles.addBtn}
            >
              {showAddList ? "Cancel" : "+ New Checklist"}
            </button>
          </div>

          {showAddList && (
            <form onSubmit={handleAddList} style={styles.form}>
              <input
                type="text"
                placeholder="Checklist name"
                value={newListName}
                onChange={(event) => setNewListName(event.target.value)}
                required
                style={styles.input}
              />
              <select
                value={newListType}
                onChange={(event) => setNewListType(event.target.value)}
                required
                style={styles.select}
              >
                <option value="">-- Select type --</option>
                <option value="Daily">Daily</option>
                <option value="Weekly">Weekly</option>
                <option value="Monthly">Monthly</option>
                <option value="Quarterly">Quarterly</option>
                <option value="Yearly">Yearly</option>
              </select>

              <div style={styles.imageField}>
                <label style={styles.imageLabel} htmlFor="new-checklist-image">
                  Checklist image
                </label>
                <input
                  id="new-checklist-image"
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp"
                  onChange={handleNewImageChange}
                />
                <p style={styles.helperText}>JPG, PNG, or WEBP up to 2MB.</p>
                <img
                  src={getChecklistImageUrl(null, newListImagePreview)}
                  alt="New checklist preview"
                  style={styles.formImagePreview}
                />
              </div>

              <button type="submit" style={styles.submitBtn}>
                + Create Checklist
              </button>
            </form>
          )}

          {loading && <p style={styles.muted}>Loading...</p>}

          {!loading && checklists.length === 0 && (
            <p style={styles.muted}>No checklists yet - create one above</p>
          )}

          <div style={styles.checklistGrid}>
            {checklists.map((list) => (
              <div key={list.id} style={styles.checklistCard}>
                {editingChecklist?.id === list.id ? (
                  <form onSubmit={handleUpdateChecklist} style={styles.editChecklistForm}>
                    <img
                      src={getChecklistImageUrl(
                        removeChecklistImage ? null : list,
                        removeChecklistImage ? DEFAULT_CHECKLIST_IMAGE : editChecklistImagePreview,
                      )}
                      alt={`${list.name} preview`}
                      style={styles.editChecklistImage}
                    />
                    <input
                      value={editChecklistName}
                      onChange={(event) => setEditChecklistName(event.target.value)}
                      required
                      style={styles.input}
                    />
                    <select
                      value={editChecklistType}
                      onChange={(event) => setEditChecklistType(event.target.value)}
                      required
                      style={styles.select}
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
                    <div style={styles.imageActionRow}>
                      <button
                        type="button"
                        onClick={() => {
                          setRemoveChecklistImage(true);
                          setEditChecklistImage(null);
                          setEditChecklistImagePreview("");
                        }}
                        style={styles.secondaryBtn}
                      >
                        Delete image
                      </button>
                      <button type="submit" style={styles.saveBtn}>
                        Save
                      </button>
                      <button type="button" onClick={resetEditingChecklistForm} style={styles.cancelBtn}>
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div
                      style={styles.checklistCardContent}
                      onClick={() => handleChecklistClick(list)}
                    >
                      <img
                        src={getChecklistImageUrl(list)}
                        alt={`${list.name} cover`}
                        style={styles.checklistImage}
                      />
                      <div>
                        <div style={styles.checklistName}>{list.name}</div>
                        <div style={styles.checklistType}>{list.type}</div>
                      </div>
                    </div>

                    <div style={styles.checklistActions}>
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          startEditingChecklist(list);
                        }}
                        style={styles.editBtn}
                      >
                        Edit
                      </button>
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          handleArchiveChecklist(list.id);
                        }}
                        style={styles.deleteChecklistBtn}
                      >
                        Archive
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>

          <div style={styles.archivedSection}>
            <button
              type="button"
              onClick={() => setShowArchived(!showArchived)}
              style={styles.archiveToggle}
            >
              {showArchived ? "Hide Archived" : `Show Archived (${archivedChecklists.length})`}
            </button>

            {showArchived && (
              <div style={styles.archivedList}>
                {archivedChecklists.length === 0 ? (
                  <p style={styles.muted}>No archived checklists yet.</p>
                ) : (
                  archivedChecklists.map((list) => (
                    <div key={list.id} style={styles.archivedCard}>
                      <div style={styles.archivedCardInfo}>
                        <img
                          src={getChecklistImageUrl(list)}
                          alt={`${list.name} archived cover`}
                          style={styles.archivedImage}
                        />
                        <div>
                          <div style={styles.checklistName}>{list.name}</div>
                          <div style={styles.checklistType}>{list.type}</div>
                        </div>
                      </div>
                      <button
                        type="button"
                        style={styles.saveBtn}
                        onClick={() => handleRestoreChecklist(list.id)}
                      >
                        Restore
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <div style={styles.selectedChecklistHeader}>
              <img
                src={getChecklistImageUrl(selectedChecklist)}
                alt={`${selectedChecklist.name} cover`}
                style={styles.selectedChecklistImage}
              />
              <div style={styles.cardTitleSection}>
                <span style={styles.cardIcon}>Items</span>
                <h3 style={styles.cardTitle}>{selectedChecklist.name}</h3>
                <span style={styles.typeBadge}>{selectedChecklist.type}</span>
              </div>
            </div>
            <button
              onClick={() => {
                setShowAddItem(!showAddItem);
                setEditingItem(null);
              }}
              style={styles.addBtn}
            >
              {showAddItem ? "Cancel" : "+ Add Item"}
            </button>
          </div>

          {showAddItem && (
            <form onSubmit={handleAddItem} style={styles.form}>
              <input
                type="text"
                placeholder="Item label"
                value={newItemLabel}
                onChange={(event) => setNewItemLabel(event.target.value)}
                required
                style={styles.input}
              />
              <input
                type="text"
                placeholder="Item type"
                value={newItemType}
                onChange={(event) => setNewItemType(event.target.value)}
                required
                style={styles.input}
              />
              <button type="submit" style={styles.submitBtn}>
                + Add Item
              </button>
            </form>
          )}

          {loadingItems && <p style={styles.muted}>Loading items...</p>}

          {!loadingItems && items.length === 0 && (
            <p style={styles.muted}>No items yet - add one above</p>
          )}

          {items.length > 0 && (
            <div style={styles.itemsContainer}>
              <div style={styles.itemsHeader}>
                <div>Status</div>
                <div>Label</div>
                <div>Type</div>
                <div>Actions</div>
              </div>
              {items.map((item) => (
                <div
                  key={item.id}
                  draggable={!editingItem}
                  onDragStart={() => setDraggedItemId(item.id)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => {
                    if (draggedItemId && draggedItemId !== item.id) {
                      handleReorderItems(moveItem(items, draggedItemId, item.id));
                    }
                    setDraggedItemId(null);
                  }}
                >
                  {editingItem?.id === item.id ? (
                    <form onSubmit={handleUpdateItem} style={styles.editRow}>
                      <input
                        value={editLabel}
                        onChange={(event) => setEditLabel(event.target.value)}
                        required
                        style={{ ...styles.input, flex: 1 }}
                      />
                      <input
                        value={editType}
                        onChange={(event) => setEditType(event.target.value)}
                        required
                        style={{ ...styles.input, flex: 1 }}
                      />
                      <button type="submit" style={styles.saveBtn}>
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingItem(null)}
                        style={styles.cancelBtn}
                      >
                        Cancel
                      </button>
                    </form>
                  ) : (
                    <div style={styles.itemRow}>
                      <div style={styles.itemStatus}>
                        <span style={styles.dragHandle}>::</span>
                        <input
                          type="checkbox"
                          checked={Boolean(item.is_completed)}
                          onChange={() => handleToggleItem(item)}
                        />
                      </div>
                      <div
                        style={{
                          ...styles.itemLabel,
                          ...(item.is_completed ? styles.completedItemLabel : {}),
                        }}
                      >
                        {item.label}
                      </div>
                      <div>
                        <span style={styles.itemTypeBadge}>{item.type}</span>
                      </div>
                      <div style={styles.itemActions}>
                        <button
                          onClick={() => {
                            setEditingItem(item);
                            setEditLabel(item.label);
                            setEditType(item.type);
                            setShowAddItem(false);
                          }}
                          style={styles.editBtn}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          style={styles.deleteBtn}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: "100%",
    height: "100vh",
    overflow: "auto",
    padding: "24px 32px",
    fontFamily: "system-ui, -apple-system, sans-serif",
    background: "#f0f2f5",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "28px",
    padding: "16px 24px",
    background: "white",
    borderRadius: "16px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
    gap: "16px",
    flexWrap: "wrap",
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: "20px",
  },
  headerRight: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
    flexWrap: "wrap",
  },
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
    background: "#dbeafe",
  },
  avatarBtn: {
    padding: "9px 12px",
    background: "#111827",
    color: "white",
    borderRadius: "10px",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: 600,
  },
  hiddenInput: {
    display: "none",
  },
  backBtn: {
    padding: "8px 20px",
    background: "#667eea",
    color: "white",
    border: "none",
    borderRadius: "10px",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: 600,
  },
  title: {
    fontSize: "22px",
    fontWeight: 700,
    margin: 0,
    color: "#1a1a1a",
  },
  subtitle: {
    fontSize: "13px",
    color: "#666",
    margin: "4px 0 0",
  },
  logoutBtn: {
    padding: "8px 24px",
    background: "#dc2626",
    color: "white",
    border: "none",
    borderRadius: "10px",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: 600,
  },
  error: {
    backgroundColor: "#fee2e2",
    color: "#dc2626",
    padding: "12px 16px",
    borderRadius: "10px",
    marginBottom: "20px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: "13px",
  },
  closeErr: {
    background: "none",
    border: "none",
    cursor: "pointer",
    color: "#dc2626",
    fontSize: "16px",
  },
  card: {
    background: "white",
    borderRadius: "20px",
    padding: "24px",
    boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
    minHeight: "calc(100vh - 140px)",
    overflow: "auto",
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "20px",
    paddingBottom: "16px",
    borderBottom: "1px solid #e0e0e0",
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
    fontSize: "14px",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "#64748b",
  },
  cardTitle: {
    fontSize: "17px",
    fontWeight: 600,
    margin: 0,
    color: "#1a1a1a",
  },
  count: {
    fontSize: "12px",
    fontWeight: 500,
    padding: "2px 8px",
    background: "#e0e7ff",
    color: "#4338ca",
    borderRadius: "20px",
  },
  addBtn: {
    padding: "8px 18px",
    background: "#1a1a18",
    color: "white",
    border: "none",
    borderRadius: "10px",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: 500,
  },
  secondaryBtn: {
    padding: "9px 12px",
    background: "#e2e8f0",
    color: "#1e293b",
    border: "none",
    borderRadius: "10px",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: 600,
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    marginBottom: "24px",
    padding: "20px",
    background: "#ffffff",
    borderRadius: "16px",
    border: "2px solid #e5e7eb",
  },
  imageField: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  imageLabel: {
    fontSize: "13px",
    fontWeight: 700,
    color: "#334155",
  },
  helperText: {
    margin: 0,
    fontSize: "12px",
    color: "#64748b",
  },
  formImagePreview: {
    width: "100%",
    maxWidth: "320px",
    height: "180px",
    objectFit: "cover",
    borderRadius: "14px",
    border: "1px solid #cbd5e1",
    background: "#f8fafc",
  },
  input: {
    padding: "12px 14px",
    fontSize: "14px",
    border: "2px solid #d1d5db",
    borderRadius: "10px",
    outline: "none",
    backgroundColor: "white",
    color: "#1f2937",
    fontWeight: "500",
  },
  select: {
    padding: "12px 14px",
    fontSize: "14px",
    border: "2px solid #d1d5db",
    borderRadius: "10px",
    outline: "none",
    background: "white",
    color: "#1f2937",
    fontWeight: "500",
    cursor: "pointer",
  },
  submitBtn: {
    padding: "12px",
    fontSize: "14px",
    fontWeight: 600,
    background: "#10b981",
    color: "white",
    border: "none",
    borderRadius: "10px",
    cursor: "pointer",
  },
  muted: {
    textAlign: "center",
    color: "#999",
    padding: "40px 0",
    fontSize: "13px",
  },
  checklistGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
    gap: "14px",
  },
  checklistCard: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "stretch",
    padding: "16px 18px",
    background: "#ffffff",
    borderRadius: "12px",
    border: "1px solid #e5e7eb",
    boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
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
    borderRadius: "12px",
    background: "#e2e8f0",
    flexShrink: 0,
  },
  selectedChecklistImage: {
    width: "84px",
    height: "84px",
    objectFit: "cover",
    borderRadius: "16px",
    background: "#e2e8f0",
  },
  editChecklistImage: {
    width: "100%",
    maxWidth: "180px",
    height: "120px",
    objectFit: "cover",
    borderRadius: "12px",
    background: "#e2e8f0",
  },
  checklistName: {
    fontSize: "16px",
    fontWeight: 700,
    marginBottom: "8px",
    color: "#111827",
  },
  checklistType: {
    fontSize: "13px",
    fontWeight: 600,
    color: "#1f2937",
    backgroundColor: "#e5e7eb",
    display: "inline-block",
    padding: "4px 12px",
    borderRadius: "20px",
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
    background: "#dc2626",
    color: "white",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: 600,
  },
  archivedSection: {
    marginTop: "28px",
    borderTop: "1px solid #e5e7eb",
    paddingTop: "20px",
  },
  archiveToggle: {
    padding: "10px 16px",
    borderRadius: "12px",
    border: "1px solid #d7cdcdff",
    background: "#0a0a0aff",
    cursor: "pointer",
    fontWeight: 600,
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
    border: "1px solid #e5e7eb",
    borderRadius: "12px",
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
    background: "#e2e8f0",
  },
  typeBadge: {
    fontSize: "12px",
    padding: "4px 12px",
    background: "#e0e7ff",
    color: "#4338ca",
    borderRadius: "20px",
    fontWeight: 500,
  },
  itemsContainer: {
    marginTop: "8px",
  },
  itemsHeader: {
    display: "grid",
    gridTemplateColumns: "140px 2fr 1fr 120px",
    padding: "10px 12px",
    background: "#f8f9fa",
    borderRadius: "10px",
    fontSize: "12px",
    fontWeight: 600,
    color: "#666",
    marginBottom: "8px",
  },
  itemRow: {
    display: "grid",
    gridTemplateColumns: "140px 2fr 1fr 120px",
    alignItems: "center",
    padding: "12px 12px",
    borderBottom: "1px solid #f0f0f0",
  },
  itemStatus: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  dragHandle: {
    color: "#94a3b8",
    fontWeight: 700,
    cursor: "grab",
  },
  itemLabel: {
    fontSize: "14px",
    fontWeight: 500,
    color: "#1a1a1a",
  },
  completedItemLabel: {
    textDecoration: "line-through",
    color: "#94a3b8",
  },
  itemTypeBadge: {
    fontSize: "11px",
    padding: "4px 12px",
    background: "#e0e7ff",
    color: "#4338ca",
    borderRadius: "20px",
    fontWeight: 500,
  },
  itemActions: {
    display: "flex",
    gap: "8px",
    justifyContent: "flex-end",
  },
  editBtn: {
    padding: "4px 12px",
    background: "none",
    border: "1px solid #667eea",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "11px",
    color: "#667eea",
  },
  deleteBtn: {
    padding: "4px 12px",
    background: "none",
    border: "1px solid #dc2626",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "11px",
    color: "#dc2626",
  },
  editRow: {
    display: "flex",
    gap: "8px",
    alignItems: "center",
    padding: "8px 12px",
    background: "#fef3c7",
    borderRadius: "10px",
    marginBottom: "8px",
    flexWrap: "wrap",
  },
  saveBtn: {
    padding: "5px 12px",
    background: "#10b981",
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "11px",
  },
  cancelBtn: {
    padding: "5px 12px",
    background: "#9ca3af",
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "11px",
  },
};
