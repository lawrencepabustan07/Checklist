import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const API = axios.create({
  baseURL: "http://127.0.0.1:8000/api",
});

API.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default function Dashboard({ onLogout }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [checklists, setChecklists] = useState([]);
  const [selectedChecklist, setSelectedChecklist] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);
  const [showAddList, setShowAddList] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [newListType, setNewListType] = useState("");
  const [newItemLabel, setNewItemLabel] = useState("");
  const [newItemType, setNewItemType] = useState("");
  const [editingItem, setEditingItem] = useState(null);
  const [editLabel, setEditLabel] = useState("");
  const [editType, setEditType] = useState("");
  const [error, setError] = useState("");
  const [editingChecklist, setEditingChecklist] = useState(null);
  const [editChecklistName, setEditChecklistName] = useState("");
  const [editChecklistType, setEditChecklistType] = useState("");
  useEffect(() => {
    setEmail(localStorage.getItem("email") || "User");
    loadChecklists();
  }, []);

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
    setError("");
  }

  async function handleAddList(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await API.post("/checklist/", {
        name: newListName,
        type: newListType,
      });
      const newChecklist = res.data.data || res.data;
      setChecklists([newChecklist, ...checklists]);
      setNewListName("");
      setNewListType("");
      setShowAddList(false);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create checklist");
    } finally {
      setLoading(false);
    }
  }
    
  async function handleUpdateChecklist(e) {
    e.preventDefault();
    try {
      const res = await API.patch(
        `/checklist/${editingChecklist.id}/`,
        { name: editChecklistName, type: editChecklistType },
      );
      const updatedChecklist = res.data.data || res.data;
      setChecklists(checklists.map((c) => (c.id === editingChecklist.id ? updatedChecklist : c)));
      setEditingChecklist(null);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update checklist");
    } 
  }
  async function handleDeleteChecklist(checklistId) {
    if (!confirm("Delete this checklist? All items will be deleted.")) {
      return;
    }

    try {
      await API.delete(`/checklist/${checklistId}/`);

      setChecklists(checklists.filter((c) => c.id !== checklistId));

      if (selectedChecklist?.id === checklistId) {
        setSelectedChecklist(null);
        setItems([]);
      }
    } catch (err) {
      setError("Could not delete checklist.");
    }
  }

  async function handleAddItem(e) {
    e.preventDefault();
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

  async function handleUpdateItem(e) {
    e.preventDefault();
    try {
      const res = await API.patch(
        `/checklist/${selectedChecklist.id}/items/${editingItem.id}/`,
        { label: editLabel, type: editType },
      );
      const updatedItem = res.data.data || res.data;
      setItems(items.map((i) => (i.id === editingItem.id ? updatedItem : i)));
      setEditingItem(null);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update item");
    }
  }

  async function handleDeleteItem(itemId) {
    if (!confirm("Delete this item?")) return;
    try {
      await API.delete(`/checklist/${selectedChecklist.id}/items/${itemId}/`);
      setItems(items.filter((i) => i.id !== itemId));
    } catch (err) {
      setError("Failed to delete item");
    }
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
              ← Back
            </button>
          )}
          <div>
            <h1 style={styles.title}>My Checklists</h1>
            <p style={styles.subtitle}>Welcome back, {email.split("@")[0]}</p>
          </div>
        </div>
        <button onClick={handleLogout} style={styles.logoutBtn}>
          Sign out
        </button>
      </div>

      {error && (
        <div style={styles.error}>
          {error}
          <button onClick={() => setError("")} style={styles.closeErr}>
            ✕
          </button>
        </div>
      )}

      {!selectedChecklist ? (
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <div style={styles.cardTitleSection}>
              <span style={styles.cardIcon}>📋</span>
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
                onChange={(e) => setNewListName(e.target.value)}
                required
                style={styles.input}
              />
              <select
                value={newListType}
                onChange={(e) => setNewListType(e.target.value)}
                required
                style={styles.select}
              >
                <option value="">-- Select type --</option>
                <option value="Daily">📅 Daily</option>
                <option value="Weekly">📆 Weekly</option>
                <option value="Monthly">📊 Monthly</option>
                <option value="Quarterly">📈 Quarterly</option>
                <option value="Yearly">🎯 Yearly</option>
              </select>
              <button type="submit" style={styles.submitBtn}>
                + Create Checklist
              </button>
            </form>
          )}

          {loading && <p style={styles.muted}>Loading...</p>}

          {!loading && checklists.length === 0 && (
            <p style={styles.muted}>No checklists yet — create one above</p>
          )}

          {}
          <div style={styles.checklistGrid}>
            {checklists.map((list) => (
              <div key={list.id} style={styles.checklistCard}>
                {editingChecklist?.id === list.id ? (
                  <form onSubmit={handleUpdateChecklist} style={styles.editRow}>
                    <input
                      value={editChecklistName}
                      onChange={(e) => setEditChecklistName(e.target.value)}
                      required
                      style={{ ...styles.input, flex: 1 }}
                    />
                    <select
                      value={editChecklistType}
                      onChange={(e) => setEditChecklistType(e.target.value)}
                      required
                      style={{ ...styles.select, flex: 1 }}
                    >
                      <option value="Daily">📅 Daily</option>
                      <option value="Weekly">📆 Weekly</option>
                      <option value="Monthly">📊 Monthly</option>
                      <option value="Quarterly">📈 Quarterly</option>
                      <option value="Yearly">🎯 Yearly</option>
                    </select>
                    <button type="submit" style={styles.saveBtn}>Save</button>
                    <button type="button" onClick={() => setEditingChecklist(null)} style={styles.cancelBtn}>Cancel</button>
                  </form>
                ) : (
                  <>
                    <div
                      style={styles.checklistCardContent}
                      onClick={() => handleChecklistClick(list)}
                    >
                      <div>
                        <div style={styles.checklistName}>{list.name}</div>
                        <div style={styles.checklistType}>{list.type}</div>
                      </div>
                    </div>

                    <div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingChecklist(list);
                          setEditChecklistName(list.name);
                          setEditChecklistType(list.type);
                        }}
                        style={styles.editBtn}
                      >
                        Edit
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteChecklist(list.id);
                        }}
                        style={styles.deleteChecklistBtn}
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        // ============================================
        // ITEMS VIEW
        // ============================================
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <div style={styles.cardTitleSection}>
              <span style={styles.cardIcon}>✅</span>
              <h3 style={styles.cardTitle}>{selectedChecklist.name}</h3>
              <span style={styles.typeBadge}>{selectedChecklist.type}</span>
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
                onChange={(e) => setNewItemLabel(e.target.value)}
                required
                style={styles.input}
              />
              <input
                type="text"
                placeholder="Item type"
                value={newItemType}
                onChange={(e) => setNewItemType(e.target.value)}
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
            <p style={styles.muted}>No items yet — add one above</p>
          )}

          {items.length > 0 && (
            <div style={styles.itemsContainer}>
              <div style={styles.itemsHeader}>
                <div>Label</div>
                <div>Type</div>
                <div>Actions</div>
              </div>
              {items.map((item) => (
                <div key={item.id}>
                  {editingItem?.id === item.id ? (
                    <form onSubmit={handleUpdateItem} style={styles.editRow}>
                      <input
                        value={editLabel}
                        onChange={(e) => setEditLabel(e.target.value)}
                        required
                        style={{ ...styles.input, flex: 1 }}
                      />
                      <input
                        value={editType}
                        onChange={(e) => setEditType(e.target.value)}
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
                      <div style={styles.itemLabel}>{item.label}</div>
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
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: "20px",
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
  },
  cardTitleSection: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  cardIcon: {
    fontSize: "22px",
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
    gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
    gap: "14px",
  },
  checklistCard: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "16px 18px",
    background: "#ffffff",
    borderRadius: "12px",
    border: "1px solid #e5e7eb",
    boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
  },
  checklistCardContent: {
    flex: 1,
    cursor: "pointer",
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
  // ✅ ITO ANG STYLE NG DELETE BUTTON PARA SA CHECKLIST
  deleteChecklistBtn: {
    padding: "6px 14px",
    background: "#dc2626",
    color: "white",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: 600,
    marginLeft: "12px",
    transition: "all 0.2s",
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
    gridTemplateColumns: "2fr 1fr 100px",
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
    gridTemplateColumns: "2fr 1fr 100px",
    alignItems: "center",
    padding: "12px 12px",
    borderBottom: "1px solid #f0f0f0",
  },
  itemLabel: {
    fontSize: "14px",
    fontWeight: 500,
    color: "#1a1a1a",
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
