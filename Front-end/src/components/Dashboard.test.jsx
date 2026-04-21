import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mock axios BEFORE importing Dashboard ──────────────────────────────────
const { mockApi } = vi.hoisted(() => ({
  mockApi: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    interceptors: { request: { use: vi.fn() } },
  },
}));

vi.mock("axios", () => ({
  default: { create: vi.fn(() => mockApi) },
}));

import Dashboard from "./Dashboard";

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Default resolved responses for the three on-mount GET calls */
function setupDefaultMocks({
  profile = { data: { data: { avatar_url: "http://example.com/avatar.svg" } } },
  checklists = { data: { data: [] } },
  archived = { data: { data: [] } },
} = {}) {
  // Component calls: loadProfile → GET /auth/user/
  //                  loadChecklists → GET /checklist/
  //                  loadArchivedChecklists → GET /checklist/archived/
  mockApi.get.mockImplementation((url) => {
    if (url === "/auth/user/") return Promise.resolve(profile);
    if (url === "/checklist/") return Promise.resolve(checklists);
    if (url === "/checklist/archived/") return Promise.resolve(archived);
    return Promise.resolve({ data: { data: [] } });
  });
}

const SAMPLE_LIST = {
  id: "1",
  name: "Daily Setup",
  type: "Daily",
  image_url: "http://test/image.png",
};

const SAMPLE_ITEM = {
  id: "10",
  label: "Brush teeth",
  type: "Habit",
  is_completed: false,
};

function renderDashboard(props = {}) {
  return render(
    <MemoryRouter>
      <Dashboard onLogout={vi.fn()} {...props} />
    </MemoryRouter>,
  );
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("Dashboard – initial load", () => {
  beforeEach(() => {
    mockApi.get.mockReset();
    mockApi.post.mockReset();
    mockApi.patch.mockReset();
    mockApi.delete.mockReset();
    localStorage.setItem("email", "lawrence@example.com");
    localStorage.setItem("access_token", "token");
  });

  it("shows the welcome message with the user's name", async () => {
    setupDefaultMocks();
    renderDashboard();
    expect(await screen.findByText("Welcome back, lawrence")).toBeInTheDocument();
  });

  it("shows 'User' when no email is stored", async () => {
    localStorage.removeItem("email");
    setupDefaultMocks();
    renderDashboard();
    expect(await screen.findByText("Welcome back, User")).toBeInTheDocument();
  });

  it("renders checklists returned from the API", async () => {
    setupDefaultMocks({ checklists: { data: { data: [SAMPLE_LIST] } } });
    renderDashboard();
    expect(await screen.findByText("Daily Setup")).toBeInTheDocument();
  });

  it("shows empty-state message when there are no checklists", async () => {
    setupDefaultMocks();
    renderDashboard();
    expect(await screen.findByText(/No checklists yet/i)).toBeInTheDocument();
  });

  it("shows error banner when checklist load fails", async () => {
    mockApi.get.mockImplementation((url) => {
      if (url === "/auth/user/") return Promise.resolve({ data: { data: {} } });
      if (url === "/checklist/archived/") return Promise.resolve({ data: { data: [] } });
      return Promise.reject(new Error("Network error"));
    });
    renderDashboard();
    expect(await screen.findByText(/Failed to load checklists/i)).toBeInTheDocument();
  });

  it("sets the avatar URL from the profile endpoint", async () => {
    setupDefaultMocks({ profile: { data: { data: { avatar_url: "http://example.com/avatar.svg" } } } });
    renderDashboard();
    await screen.findByText("Welcome back, lawrence");
    const avatar = screen.getByAltText("Profile avatar");
    expect(avatar.src).toBe("http://example.com/avatar.svg");
  });

  it("falls back to default avatar when profile has no avatar_url", async () => {
    setupDefaultMocks({ profile: { data: { data: {} } } });
    renderDashboard();
    await screen.findByText("Welcome back, lawrence");
    const avatar = screen.getByAltText("Profile avatar");
    expect(avatar.src).toContain("default-avatar.svg");
  });

  it("silently handles a failing profile fetch (no crash)", async () => {
    mockApi.get.mockImplementation((url) => {
      if (url === "/auth/user/") return Promise.reject(new Error("Forbidden"));
      if (url === "/checklist/") return Promise.resolve({ data: { data: [] } });
      if (url === "/checklist/archived/") return Promise.resolve({ data: { data: [] } });
      return Promise.resolve({ data: {} });
    });
    renderDashboard();
    expect(await screen.findByText(/No checklists yet/i)).toBeInTheDocument();
  });

  it("shows archived count in the toggle button", async () => {
    setupDefaultMocks({
      archived: { data: { data: [{ id: "99", name: "Old List", type: "Daily" }] } },
    });
    renderDashboard();
    expect(await screen.findByText(/Show Archived \(1\)/i)).toBeInTheDocument();
  });
});

describe("Dashboard – creating a checklist", () => {
  beforeEach(() => {
    mockApi.get.mockReset();
    mockApi.post.mockReset();
    mockApi.patch.mockReset();
    mockApi.delete.mockReset();
    localStorage.setItem("email", "lawrence@example.com");
    localStorage.setItem("access_token", "token");
  });

  it("opens and closes the add-checklist form", async () => {
    const user = userEvent.setup();
    setupDefaultMocks();
    renderDashboard();
    await screen.findByText(/No checklists yet/i);

    await user.click(screen.getByRole("button", { name: "+ New Checklist" }));
    expect(screen.getByPlaceholderText("Checklist name")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByPlaceholderText("Checklist name")).not.toBeInTheDocument();
  });

  it("submits the form and appends the new checklist", async () => {
    const user = userEvent.setup();
    setupDefaultMocks();
    mockApi.post.mockResolvedValueOnce({
      data: { data: { id: "2", name: "Weekly Review", type: "Weekly" } },
    });

    renderDashboard();
    await screen.findByText(/No checklists yet/i);

    await user.click(screen.getByRole("button", { name: "+ New Checklist" }));
    await user.type(screen.getByPlaceholderText("Checklist name"), "Weekly Review");
    await user.selectOptions(screen.getByRole("combobox"), "Weekly");
    await user.click(screen.getByRole("button", { name: "+ Create Checklist" }));

    expect(await screen.findByText("Weekly Review")).toBeInTheDocument();

    const [url, formData] = mockApi.post.mock.calls[0];
    expect(url).toBe("/checklist/");
    expect(formData.get("name")).toBe("Weekly Review");
    expect(formData.get("type")).toBe("Weekly");
  });

  it("shows an API error message when checklist creation fails", async () => {
    const user = userEvent.setup();
    setupDefaultMocks();
    mockApi.post.mockRejectedValueOnce({
      response: { data: { message: "Name already taken" } },
    });

    renderDashboard();
    await screen.findByText(/No checklists yet/i);

    await user.click(screen.getByRole("button", { name: "+ New Checklist" }));
    await user.type(screen.getByPlaceholderText("Checklist name"), "Dup");
    await user.selectOptions(screen.getByRole("combobox"), "Daily");
    await user.click(screen.getByRole("button", { name: "+ Create Checklist" }));

    expect(await screen.findByText("Name already taken")).toBeInTheDocument();
  });

  it("shows image validation error for a disallowed MIME type", async () => {
    const user = userEvent.setup();
    setupDefaultMocks();
    renderDashboard();
    await screen.findByText(/No checklists yet/i);

    await user.click(screen.getByRole("button", { name: "+ New Checklist" }));

    const file = new File(["gif"], "anim.gif", { type: "image/gif" });
    const input = document.getElementById("new-checklist-image");
    fireEvent.change(input, { target: { files: [file] } });

    expect(await screen.findByText(/Only JPG, PNG, and WEBP/i)).toBeInTheDocument();
  });

  it("shows image validation error for an oversized file", async () => {
    const user = userEvent.setup();
    setupDefaultMocks();
    renderDashboard();
    await screen.findByText(/No checklists yet/i);

    await user.click(screen.getByRole("button", { name: "+ New Checklist" }));

    const bigContent = new Uint8Array(3 * 1024 * 1024);
    const file = new File([bigContent], "big.png", { type: "image/png" });
    const input = document.getElementById("new-checklist-image");
    fireEvent.change(input, { target: { files: [file] } });

    expect(await screen.findByText(/2MB or smaller/i)).toBeInTheDocument();
  });

  it("accepts a valid image file and shows a preview", async () => {
    const user = userEvent.setup();
    setupDefaultMocks();
    global.URL.createObjectURL = vi.fn(() => "blob:preview-url");

    renderDashboard();
    await screen.findByText(/No checklists yet/i);
    await user.click(screen.getByRole("button", { name: "+ New Checklist" }));

    const file = new File(["img"], "photo.jpg", { type: "image/jpeg" });
    const input = document.getElementById("new-checklist-image");
    fireEvent.change(input, { target: { files: [file] } });

    expect(screen.queryByText(/Only JPG/i)).not.toBeInTheDocument();

    await user.type(screen.getByPlaceholderText("Checklist name"), "Image List");
    await user.selectOptions(screen.getByRole("combobox"), "Daily");
    
    mockApi.post.mockResolvedValueOnce({
      data: { data: { id: "3", name: "Image List", type: "Daily" } }
    });
    
    await user.click(screen.getByRole("button", { name: "+ Create Checklist" }));
    await waitFor(() => expect(mockApi.post).toHaveBeenCalledTimes(1));
    const formData = mockApi.post.mock.calls[0][1];
    expect(formData.has("image")).toBe(true);
  });
});

describe("Dashboard – editing a checklist", () => {
  beforeEach(() => {
    mockApi.get.mockReset();
    mockApi.post.mockReset();
    mockApi.patch.mockReset();
    mockApi.delete.mockReset();
    localStorage.setItem("email", "test@example.com");
    localStorage.setItem("access_token", "token");
  });

  it("enters edit mode and cancels via the Cancel button", async () => {
    const user = userEvent.setup();
    setupDefaultMocks({ checklists: { data: { data: [SAMPLE_LIST] } } });
    renderDashboard();

    await user.click(await screen.findByRole("button", { name: "Edit" }));
    expect(screen.getByDisplayValue("Daily Setup")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByDisplayValue("Daily Setup")).not.toBeInTheDocument();
  });

  it("saves checklist edits and updates the UI", async () => {
    const user = userEvent.setup();
    setupDefaultMocks({ checklists: { data: { data: [SAMPLE_LIST] } } });
    mockApi.patch.mockResolvedValueOnce({
      data: { data: { ...SAMPLE_LIST, name: "Morning Routine" } },
    });

    renderDashboard();
    await user.click(await screen.findByRole("button", { name: "Edit" }));

    const nameInput = screen.getByDisplayValue("Daily Setup");
    await user.clear(nameInput);
    await user.type(nameInput, "Morning Routine");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Morning Routine")).toBeInTheDocument();
    expect(mockApi.patch).toHaveBeenCalledWith(`/checklist/${SAMPLE_LIST.id}/`, expect.any(FormData));
  });

  it("shows an error when updating checklist fails", async () => {
    const user = userEvent.setup();
    setupDefaultMocks({ checklists: { data: { data: [SAMPLE_LIST] } } });
    mockApi.patch.mockRejectedValueOnce({
      response: { data: { message: "Update failed" } },
    });

    renderDashboard();
    await user.click(await screen.findByRole("button", { name: "Edit" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Update failed")).toBeInTheDocument();
  });

  it("sets remove-image flag when 'Delete image' is clicked", async () => {
    const user = userEvent.setup();
    setupDefaultMocks({ checklists: { data: { data: [SAMPLE_LIST] } } });
    mockApi.patch.mockResolvedValueOnce({
      data: { data: { ...SAMPLE_LIST, image_url: null } },
    });

    renderDashboard();
    await user.click(await screen.findByRole("button", { name: "Edit" }));
    await user.click(screen.getByRole("button", { name: "Delete image" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(mockApi.patch).toHaveBeenCalledTimes(1));
    const formData = mockApi.patch.mock.calls[0][1];
    expect(formData.get("remove_image")).toBe("true");
  });

  it("updates checklist with a new image", async () => {
    const user = userEvent.setup();
    setupDefaultMocks({ checklists: { data: { data: [SAMPLE_LIST] } } });
    mockApi.patch.mockResolvedValueOnce({
      data: { data: { ...SAMPLE_LIST } },
    });

    renderDashboard();
    await user.click(await screen.findByRole("button", { name: "Edit" }));
    
    const file = new File(["img"], "photo.jpg", { type: "image/jpeg" });
    const editForm = screen.getByDisplayValue("Daily Setup").closest("form");
    const imageInput = editForm.querySelector("input[type='file']");
    fireEvent.change(imageInput, { target: { files: [file] } });
    
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(mockApi.patch).toHaveBeenCalledTimes(1));
    const formData = mockApi.patch.mock.calls[0][1];
    expect(formData.has("image")).toBe(true);
  });

  it("shows error for invalid edit image file", async () => {
    const user = userEvent.setup();
    setupDefaultMocks({ checklists: { data: { data: [SAMPLE_LIST] } } });
    renderDashboard();
    await user.click(await screen.findByRole("button", { name: "Edit" }));
    const file = new File(["gif"], "anim.gif", { type: "image/gif" });
    const editForm = screen.getByDisplayValue("Daily Setup").closest("form");
    const imageInput = editForm.querySelector("input[type='file']");
    fireEvent.change(imageInput, { target: { files: [file] } });
    
    expect(await screen.findByText(/Only JPG, PNG, and WEBP/i)).toBeInTheDocument();
  });
});

describe("Dashboard – archiving & restoring checklists", () => {
  beforeEach(() => {
    mockApi.get.mockReset();
    mockApi.post.mockReset();
    mockApi.patch.mockReset();
    mockApi.delete.mockReset();
    localStorage.setItem("email", "test@example.com");
    localStorage.setItem("access_token", "token");
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  it("archives a checklist and removes it from the active list", async () => {
    const user = userEvent.setup();
    setupDefaultMocks({ checklists: { data: { data: [SAMPLE_LIST] } } });
    mockApi.delete.mockResolvedValueOnce({ data: { data: SAMPLE_LIST } });

    renderDashboard();
    await user.click(await screen.findByRole("button", { name: "Archive" }));

    await waitFor(() => expect(screen.queryByText("Daily Setup")).not.toBeInTheDocument());
    expect(mockApi.delete).toHaveBeenCalledWith(`/checklist/${SAMPLE_LIST.id}/`);
  });

  it("archives a checklist using local fallback when the API omits checklist data", async () => {
    const user = userEvent.setup();
    setupDefaultMocks({ checklists: { data: { data: [SAMPLE_LIST] } } });
    mockApi.delete.mockResolvedValueOnce({ data: {} });

    renderDashboard();
    await user.click(await screen.findByRole("button", { name: "Archive" }));

    await waitFor(() => expect(screen.queryByText("Daily Setup")).not.toBeInTheDocument());
  });

  it("does NOT archive if the user cancels the confirm dialog", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const user = userEvent.setup();
    setupDefaultMocks({ checklists: { data: { data: [SAMPLE_LIST] } } });

    renderDashboard();
    await user.click(await screen.findByRole("button", { name: "Archive" }));

    expect(mockApi.delete).not.toHaveBeenCalled();
    expect(screen.getByText("Daily Setup")).toBeInTheDocument();
  });

  it("shows error when archiving fails", async () => {
    const user = userEvent.setup();
    setupDefaultMocks({ checklists: { data: { data: [SAMPLE_LIST] } } });
    mockApi.delete.mockRejectedValueOnce(new Error("Network error"));

    renderDashboard();
    await user.click(await screen.findByRole("button", { name: "Archive" }));

    expect(await screen.findByText(/Could not archive/i)).toBeInTheDocument();
  });

  it("shows and hides the archived section", async () => {
    const user = userEvent.setup();
    setupDefaultMocks({
      archived: { data: { data: [{ id: "99", name: "Old List", type: "Daily" }] } },
    });
    renderDashboard();
    await screen.findByText(/Show Archived/i);

    await user.click(screen.getByRole("button", { name: /Show Archived/i }));
    expect(screen.getByText("Old List")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Hide Archived" }));
    expect(screen.queryByText("Old List")).not.toBeInTheDocument();
  });

  it("restores a checklist from the archived section", async () => {
    const user = userEvent.setup();
    const archivedItem = { id: "99", name: "Old List", type: "Daily" };
    setupDefaultMocks({ archived: { data: { data: [archivedItem] } } });
    mockApi.post.mockResolvedValueOnce({
      data: { data: { ...archivedItem } },
    });

    renderDashboard();
    await user.click(await screen.findByRole("button", { name: /Show Archived/i }));
    expect(screen.getByText("Old List")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Restore" }));

    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalledWith(`/checklist/${archivedItem.id}/restore/`);
    });
  });

  it("restores a checklist using local fallback when the API omits checklist data", async () => {
    const user = userEvent.setup();
    const archivedItem = { id: "99", name: "Old List", type: "Daily" };
    setupDefaultMocks({ archived: { data: { data: [archivedItem] } } });
    mockApi.post.mockResolvedValueOnce({ data: {} });

    renderDashboard();
    await user.click(await screen.findByRole("button", { name: /Show Archived/i }));
    await user.click(screen.getByRole("button", { name: "Restore" }));

    expect(await screen.findByText("Old List")).toBeInTheDocument();
  });

  it("shows error when restoring fails", async () => {
    const user = userEvent.setup();
    const archivedItem = { id: "99", name: "Old List", type: "Daily" };
    setupDefaultMocks({ archived: { data: { data: [archivedItem] } } });
    mockApi.post.mockRejectedValueOnce(new Error("Fail"));

    renderDashboard();
    await user.click(await screen.findByRole("button", { name: /Show Archived/i }));
    await user.click(screen.getByRole("button", { name: "Restore" }));

    expect(await screen.findByText(/Could not restore/i)).toBeInTheDocument();
  });
});

describe("Dashboard – checklist items", () => {
  beforeEach(() => {
    mockApi.get.mockReset();
    mockApi.post.mockReset();
    mockApi.patch.mockReset();
    mockApi.delete.mockReset();
    localStorage.setItem("email", "test@example.com");
    localStorage.setItem("access_token", "token");
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  /** Renders dashboard and navigates into SAMPLE_LIST with the given items loaded */
  async function openChecklist(user, items = [SAMPLE_ITEM]) {
    mockApi.get.mockImplementation((url) => {
      if (url === "/auth/user/") return Promise.resolve({ data: { data: {} } });
      if (url === "/checklist/") return Promise.resolve({ data: { data: [SAMPLE_LIST] } });
      if (url === "/checklist/archived/") return Promise.resolve({ data: { data: [] } });
      if (url === `/checklist/${SAMPLE_LIST.id}/items/`) return Promise.resolve({ data: { data: items } });
      return Promise.resolve({ data: { data: [] } });
    });

    renderDashboard();
    await user.click(await screen.findByText("Daily Setup"));

    if (items.length > 0) {
      await screen.findByText(items[0].label);
    } else {
      await screen.findByText(/No items yet/i);
    }
  }

  it("opens a checklist and loads its items", async () => {
    const user = userEvent.setup();
    await openChecklist(user);
    expect(screen.getByText("Brush teeth")).toBeInTheDocument();
  });

  it("shows empty state when checklist has no items", async () => {
    const user = userEvent.setup();
    setupDefaultMocks({ checklists: { data: { data: [SAMPLE_LIST] } } });
    mockApi.get.mockImplementation((url) => {
      if (url === "/auth/user/") return Promise.resolve({ data: { data: {} } });
      if (url === "/checklist/") return Promise.resolve({ data: { data: [SAMPLE_LIST] } });
      if (url === "/checklist/archived/") return Promise.resolve({ data: { data: [] } });
      if (url === `/checklist/${SAMPLE_LIST.id}/items/`) return Promise.resolve({ data: { data: [] } });
      return Promise.resolve({ data: {} });
    });

    renderDashboard();
    await user.click(await screen.findByText("Daily Setup"));
    expect(await screen.findByText(/No items yet/i)).toBeInTheDocument();
  });

  it("shows error when item load fails", async () => {
    const user = userEvent.setup();
    setupDefaultMocks({ checklists: { data: { data: [SAMPLE_LIST] } } });
    mockApi.get.mockImplementation((url) => {
      if (url === "/auth/user/") return Promise.resolve({ data: { data: {} } });
      if (url === "/checklist/") return Promise.resolve({ data: { data: [SAMPLE_LIST] } });
      if (url === "/checklist/archived/") return Promise.resolve({ data: { data: [] } });
      return Promise.reject(new Error("Server error"));
    });

    renderDashboard();
    await user.click(await screen.findByText("Daily Setup"));
    expect(await screen.findByText(/Failed to load items/i)).toBeInTheDocument();
  });

  it("adds a new item to the list", async () => {
    const user = userEvent.setup();
    await openChecklist(user, []);

    setupDefaultMocks({ checklists: { data: { data: [SAMPLE_LIST] } } });
    mockApi.post.mockResolvedValueOnce({
      data: { data: { id: "20", label: "Floss", type: "Habit" } },
    });

    await user.click(screen.getByRole("button", { name: "+ Add Item" }));
    await user.type(screen.getByPlaceholderText("Item label"), "Floss");
    await user.type(screen.getByPlaceholderText("Item type"), "Habit");
    await user.click(screen.getByRole("button", { name: "+ Add Item" }));

    expect(await screen.findByText("Floss")).toBeInTheDocument();
  });

  it("shows error when adding an item fails", async () => {
    const user = userEvent.setup();
    await openChecklist(user, []);

    mockApi.post.mockRejectedValueOnce({
      response: { data: { message: "Label required" } },
    });

    await user.click(screen.getByRole("button", { name: "+ Add Item" }));
    await user.type(screen.getByPlaceholderText("Item label"), "x");
    await user.type(screen.getByPlaceholderText("Item type"), "y");
    await user.click(screen.getByRole("button", { name: "+ Add Item" }));

    expect(await screen.findByText("Label required")).toBeInTheDocument();
  });

  it("cancels the add-item form", async () => {
    const user = userEvent.setup();
    await openChecklist(user, []);

    await user.click(screen.getByRole("button", { name: "+ Add Item" }));
    expect(screen.getByPlaceholderText("Item label")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByPlaceholderText("Item label")).not.toBeInTheDocument();
  });

  it("updates an existing item", async () => {
    const user = userEvent.setup();
    await openChecklist(user);

    mockApi.patch.mockResolvedValueOnce({
      data: { data: { ...SAMPLE_ITEM, label: "Rinse" } },
    });

    await user.click(screen.getByRole("button", { name: "Edit" }));
    const labelInput = screen.getByDisplayValue("Brush teeth");
    await user.clear(labelInput);
    await user.type(labelInput, "Rinse");
    const typeInput = screen.getByDisplayValue("Habit");
    await user.clear(typeInput);
    await user.type(typeInput, "Task");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Rinse")).toBeInTheDocument();
  });

  it("updates an existing item when the API returns the item directly", async () => {
    const user = userEvent.setup();
    await openChecklist(user);

    mockApi.patch.mockResolvedValueOnce({
      data: { ...SAMPLE_ITEM, label: "Direct Update", type: "Task" },
    });

    await user.click(screen.getByRole("button", { name: "Edit" }));
    const labelInput = screen.getByDisplayValue("Brush teeth");
    await user.clear(labelInput);
    await user.type(labelInput, "Direct Update");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Direct Update")).toBeInTheDocument();
  });

  it("updates one item without changing the other items in the list", async () => {
    const user = userEvent.setup();
    const secondItem = { id: "11", label: "Wash face", type: "Habit", is_completed: false };
    await openChecklist(user, [SAMPLE_ITEM, secondItem]);

    mockApi.patch.mockResolvedValueOnce({
      data: { data: { ...SAMPLE_ITEM, label: "Updated first item" } },
    });

    await user.click(screen.getAllByRole("button", { name: "Edit" })[0]);
    const labelInput = screen.getByDisplayValue("Brush teeth");
    await user.clear(labelInput);
    await user.type(labelInput, "Updated first item");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Updated first item")).toBeInTheDocument();
    expect(screen.getByText("Wash face")).toBeInTheDocument();
  });

  it("shows error when updating an item fails", async () => {
    const user = userEvent.setup();
    await openChecklist(user);

    mockApi.patch.mockRejectedValueOnce({
      response: { data: { message: "Save failed" } },
    });

    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Save failed")).toBeInTheDocument();
  });

  it("shows the default error when updating an item fails without a response message", async () => {
    const user = userEvent.setup();
    await openChecklist(user);

    mockApi.patch.mockRejectedValueOnce(new Error("plain failure"));

    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Failed to update item")).toBeInTheDocument();
  });

  it("cancels item editing", async () => {
    const user = userEvent.setup();
    await openChecklist(user);

    await user.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getByDisplayValue("Brush teeth")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByDisplayValue("Brush teeth")).not.toBeInTheDocument();
  });

  it("deletes an item after confirmation", async () => {
    const user = userEvent.setup();
    await openChecklist(user);

    mockApi.delete.mockResolvedValueOnce({});

    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(screen.queryByText("Brush teeth")).not.toBeInTheDocument();
    });
    expect(mockApi.delete).toHaveBeenCalledWith(
      `/checklist/${SAMPLE_LIST.id}/items/${SAMPLE_ITEM.id}/`,
    );
  });

  it("does NOT delete item if confirm is cancelled", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const user = userEvent.setup();
    await openChecklist(user);

    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(mockApi.delete).not.toHaveBeenCalled();
    expect(screen.getByText("Brush teeth")).toBeInTheDocument();
  });

  it("shows error when deleting an item fails", async () => {
    const user = userEvent.setup();
    await openChecklist(user);

    mockApi.delete.mockRejectedValueOnce(new Error("Fail"));

    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(await screen.findByText(/Failed to delete item/i)).toBeInTheDocument();
  });

  it("toggles item completion via the checkbox", async () => {
    const user = userEvent.setup();
    await openChecklist(user);

    mockApi.patch.mockResolvedValueOnce({
      data: { data: { ...SAMPLE_ITEM, is_completed: true } },
    });

    await user.click(screen.getByRole("checkbox"));

    await waitFor(() => {
      expect(mockApi.patch).toHaveBeenCalledWith(
        `/checklist/${SAMPLE_LIST.id}/items/${SAMPLE_ITEM.id}/`,
        { is_completed: true },
      );
    });
  });

  it("toggles item completion when the API returns the item directly", async () => {
    const user = userEvent.setup();
    await openChecklist(user);

    mockApi.patch.mockResolvedValueOnce({
      data: { ...SAMPLE_ITEM, is_completed: true },
    });

    await user.click(screen.getByRole("checkbox"));

    await waitFor(() => {
      expect(screen.getByText("Brush teeth")).toHaveStyle({ textDecoration: "line-through" });
    });
  });

  it("toggles one item without changing the other items in the list", async () => {
    const user = userEvent.setup();
    const secondItem = { id: "11", label: "Wash face", type: "Habit", is_completed: false };
    await openChecklist(user, [SAMPLE_ITEM, secondItem]);

    mockApi.patch.mockResolvedValueOnce({
      data: {
        data: { ...SAMPLE_ITEM, is_completed: true },
      },
    });

    await user.click(screen.getAllByRole("checkbox")[0]);

    await waitFor(() => {
      expect(screen.getByText("Brush teeth")).toHaveStyle({ textDecoration: "line-through" });
    });
    expect(screen.getByText("Wash face")).not.toHaveStyle({ textDecoration: "line-through" });
  });

  it("shows error when toggling item fails", async () => {
    const user = userEvent.setup();
    await openChecklist(user);

    mockApi.patch.mockRejectedValueOnce(new Error("Fail"));

    await user.click(screen.getByRole("checkbox"));

    expect(await screen.findByText(/Failed to update item status/i)).toBeInTheDocument();
  });

  it("navigates back to the dashboard from item view", async () => {
    const user = userEvent.setup();
    await openChecklist(user);

    await user.click(screen.getByRole("button", { name: "Back" }));

    expect(await screen.findByText("All Checklists")).toBeInTheDocument();
    expect(screen.queryByText("Brush teeth")).not.toBeInTheDocument();
  });
});

describe("Dashboard – drag-and-drop reorder", () => {
  beforeEach(() => {
    mockApi.get.mockReset();
    mockApi.post.mockReset();
    mockApi.patch.mockReset();
    mockApi.delete.mockReset();
    localStorage.setItem("email", "test@example.com");
    localStorage.setItem("access_token", "token");
  });

  it("calls the reorder API when an item is dropped on another", async () => {
    const user = userEvent.setup();
    const item1 = { id: "1", label: "First", type: "Task", is_completed: false };
    const item2 = { id: "2", label: "Second", type: "Task", is_completed: false };

    mockApi.get.mockImplementation((url) => {
      if (url === "/auth/user/") return Promise.resolve({ data: { data: {} } });
      if (url === "/checklist/") return Promise.resolve({ data: { data: [SAMPLE_LIST] } });
      if (url === "/checklist/archived/") return Promise.resolve({ data: { data: [] } });
      if (url === `/checklist/${SAMPLE_LIST.id}/items/`)
        return Promise.resolve({ data: { data: [item1, item2] } });
      return Promise.resolve({ data: {} });
    });

    mockApi.post.mockResolvedValueOnce({ data: [item2, item1] });

    renderDashboard();
    await user.click(await screen.findByText("Daily Setup"));
    await screen.findByText("First");

    const rows = document.querySelectorAll("[draggable]");
    fireEvent.dragStart(rows[0]);
    fireEvent.dragOver(rows[1]);
    fireEvent.drop(rows[1]);

    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalledWith(
        `/checklist/${SAMPLE_LIST.id}/items/reorder/`,
        expect.objectContaining({ ordered_ids: expect.any(Array) }),
      );
    });
  });

  it("reverts items and shows error when reorder API fails", async () => {
    const user = userEvent.setup();
    const item1 = { id: "1", label: "First", type: "Task", is_completed: false };
    const item2 = { id: "2", label: "Second", type: "Task", is_completed: false };

    mockApi.get.mockImplementation((url) => {
      if (url === "/auth/user/") return Promise.resolve({ data: { data: {} } });
      if (url === "/checklist/") return Promise.resolve({ data: { data: [SAMPLE_LIST] } });
      if (url === "/checklist/archived/") return Promise.resolve({ data: { data: [] } });
      if (url === `/checklist/${SAMPLE_LIST.id}/items/`)
        return Promise.resolve({ data: { data: [item1, item2] } });
      return Promise.resolve({ data: {} });
    });

    mockApi.post.mockRejectedValueOnce(new Error("Reorder fail"));

    renderDashboard();
    await user.click(await screen.findByText("Daily Setup"));
    await screen.findByText("First");

    const rows = document.querySelectorAll("[draggable]");
    fireEvent.dragStart(rows[0]);
    fireEvent.dragOver(rows[1]);
    fireEvent.drop(rows[1]);

    expect(await screen.findByText(/Failed to reorder/i)).toBeInTheDocument();
  });

  it("does not call reorder API when an item is dropped onto itself", async () => {
    const user = userEvent.setup();
    const item1 = { id: "1", label: "First", type: "Task", is_completed: false };

    mockApi.get.mockImplementation((url) => {
      if (url === "/auth/user/") return Promise.resolve({ data: { data: {} } });
      if (url === "/checklist/") return Promise.resolve({ data: { data: [SAMPLE_LIST] } });
      if (url === "/checklist/archived/") return Promise.resolve({ data: { data: [] } });
      if (url === `/checklist/${SAMPLE_LIST.id}/items/`) {
        return Promise.resolve({ data: { data: [item1] } });
      }
      return Promise.resolve({ data: {} });
    });

    renderDashboard();
    await user.click(await screen.findByText("Daily Setup"));
    await screen.findByText("First");

    const rows = document.querySelectorAll("[draggable]");
    fireEvent.dragStart(rows[0]);
    fireEvent.dragOver(rows[0]);
    fireEvent.drop(rows[0]);

    expect(mockApi.post).not.toHaveBeenCalled();
  });

  it("returns early when draggedItem is the same as targetItem", async () => {
    const user = userEvent.setup();
    const item1 = { id: "1", label: "First", type: "Task", is_completed: false };
    
    mockApi.get.mockImplementation((url) => {
      if (url === "/auth/user/") return Promise.resolve({ data: { data: {} } });
      if (url === "/checklist/") return Promise.resolve({ data: { data: [SAMPLE_LIST] } });
      if (url === "/checklist/archived/") return Promise.resolve({ data: { data: [] } });
      if (url === `/checklist/${SAMPLE_LIST.id}/items/`)
        return Promise.resolve({ data: { data: [item1] } });
      return Promise.resolve({ data: {} });
    });

    renderDashboard();
    await user.click(await screen.findByText("Daily Setup"));
    await screen.findByText("First");

    const rows = document.querySelectorAll("[draggable]");
    fireEvent.dragStart(rows[0]);
    fireEvent.dragOver(rows[0]);
    fireEvent.drop(rows[0]);
    
    expect(mockApi.post).not.toHaveBeenCalled();
  });
});

describe("Dashboard – avatar management", () => {
  beforeEach(() => {
    mockApi.get.mockReset();
    mockApi.patch.mockReset();
    localStorage.setItem("email", "test@example.com");
    localStorage.setItem("access_token", "token");
    global.URL.createObjectURL = vi.fn(() => "blob:avatar-preview");
  });

  it("uploads a valid avatar and updates the avatar URL", async () => {
    const user = userEvent.setup();
    setupDefaultMocks();
    mockApi.patch.mockResolvedValueOnce({
      data: { data: { avatar_url: "http://example.com/new-avatar.jpg" } },
    });

    renderDashboard();
    await screen.findByText("Welcome back, test");

    const fileInput = document.querySelector("input[type='file'][accept='.jpg,.jpeg,.png,.webp']");
    const file = new File(["img"], "avatar.jpg", { type: "image/jpeg" });
    await user.upload(fileInput, file);

    await waitFor(() => {
      expect(mockApi.patch).toHaveBeenCalledWith("/auth/user/", expect.any(FormData));
    });

    const avatar = screen.getByAltText("Profile avatar");
    expect(avatar.src).toBe("http://example.com/new-avatar.jpg");
  });

  it("shows the temporary avatar preview while upload is in flight", async () => {
    const user = userEvent.setup();
    let resolvePatch;
    setupDefaultMocks();
    mockApi.patch.mockReturnValueOnce(
      new Promise((resolve) => {
        resolvePatch = resolve;
      }),
    );

    renderDashboard();
    await screen.findByText("Welcome back, test");

    const fileInput = document.querySelector("input[type='file'][accept='.jpg,.jpeg,.png,.webp']");
    const file = new File(["img"], "avatar.jpg", { type: "image/jpeg" });
    await user.upload(fileInput, file);

    const avatar = screen.getByAltText("Profile avatar");
    expect(avatar.src).toContain("blob:avatar-preview");

    resolvePatch({ data: { data: { avatar_url: "http://example.com/final-avatar.jpg" } } });

    await waitFor(() => {
      expect(screen.getByAltText("Profile avatar").src).toBe("http://example.com/final-avatar.jpg");
    });
  });

  it("shows validation error for an invalid avatar file type", async () => {
    setupDefaultMocks();

    renderDashboard();
    await screen.findByText("Welcome back, test");

    // First file input inside the label is the avatar input (hidden); use fireEvent
    const fileInput = document.querySelector("input[type='file'][accept='.jpg,.jpeg,.png,.webp']");
    const file = new File(["gif"], "anim.gif", { type: "image/gif" });
    fireEvent.change(fileInput, { target: { files: [file] } });

    expect(await screen.findByText(/Only JPG, PNG, and WEBP/i)).toBeInTheDocument();
    expect(mockApi.patch).not.toHaveBeenCalled();
  });

  it("ignores empty avatar selection", async () => {
    setupDefaultMocks();
    renderDashboard();
    await screen.findByText("Welcome back, test");
    const fileInput = document.querySelector("input[type='file'][accept='.jpg,.jpeg,.png,.webp']");
    fireEvent.change(fileInput, { target: { files: [] } });
    expect(mockApi.patch).not.toHaveBeenCalled();
  });

  it("shows error when avatar upload fails", async () => {
    const user = userEvent.setup();
    setupDefaultMocks();
    mockApi.patch.mockRejectedValueOnce({
      response: { data: { errors: { avatar: ["Too large"] } } },
    });

    renderDashboard();
    await screen.findByText("Welcome back, test");

    const fileInput = document.querySelector("input[type='file'][accept='.jpg,.jpeg,.png,.webp']");
    const file = new File(["img"], "avatar.jpg", { type: "image/jpeg" });
    await user.upload(fileInput, file);

    expect(await screen.findByText("Too large")).toBeInTheDocument();
  });

  it("removes the avatar and falls back to default", async () => {
    const user = userEvent.setup();
    setupDefaultMocks();
    mockApi.patch.mockResolvedValueOnce({
      data: { data: { avatar_url: null } },
    });

    renderDashboard();
    await screen.findByText("Welcome back, test");

    await user.click(screen.getByRole("button", { name: "Remove" }));

    await waitFor(() => {
      expect(mockApi.patch).toHaveBeenCalledWith("/auth/user/", expect.any(FormData));
    });

    const avatar = screen.getByAltText("Profile avatar");
    expect(avatar.src).toContain("default-avatar.svg");
  });

  it("shows error when removing avatar fails", async () => {
    const user = userEvent.setup();
    setupDefaultMocks();
    mockApi.patch.mockRejectedValueOnce(new Error("Network error"));

    renderDashboard();
    await screen.findByText("Welcome back, test");

    await user.click(screen.getByRole("button", { name: "Remove" }));

    expect(await screen.findByText(/Failed to remove avatar/i)).toBeInTheDocument();
  });
});

describe("Dashboard – error banner dismissal", () => {
  beforeEach(() => {
    mockApi.get.mockReset();
    localStorage.setItem("email", "test@example.com");
    localStorage.setItem("access_token", "token");
  });

  it("dismisses the error banner when x is clicked", async () => {
    const user = userEvent.setup();
    mockApi.get.mockImplementation((url) => {
      if (url === "/auth/user/") return Promise.resolve({ data: { data: {} } });
      if (url === "/checklist/archived/") return Promise.resolve({ data: { data: [] } });
      return Promise.reject(new Error("load fail"));
    });

    renderDashboard();
    await screen.findByText(/Failed to load checklists/i);

    await user.click(screen.getByRole("button", { name: "x" }));

    await waitFor(() => {
      expect(screen.queryByText(/Failed to load checklists/i)).not.toBeInTheDocument();
    });
  });
});

describe("Dashboard – logout", () => {
  beforeEach(() => {
    mockApi.get.mockReset();
    mockApi.post.mockReset();
    mockApi.patch.mockReset();
    mockApi.delete.mockReset();
    localStorage.setItem("email", "test@example.com");
    localStorage.setItem("access_token", "token");
  });

  it("clears local storage and calls onLogout on sign out", async () => {
    const user = userEvent.setup();
    const onLogout = vi.fn();
    setupDefaultMocks();

    renderDashboard({ onLogout });
    await screen.findByText("All Checklists");

    await user.click(screen.getByRole("button", { name: "Sign out" }));

    expect(localStorage.getItem("access_token")).toBeNull();
    expect(localStorage.getItem("email")).toBeNull();
    expect(onLogout).toHaveBeenCalledTimes(1);
  });

  it("handles archive success", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    setupDefaultMocks({ checklists: { data: { data: [{
      id: 1, name: "Archive Me", type: "Daily"
    }] } } });
    mockApi.delete.mockResolvedValueOnce({ data: {} });
    
    renderDashboard();
    await screen.findByText("Archive Me");
    
    const archiveBtn = screen.getByText("Archive");
    await userEvent.click(archiveBtn);
    
    await waitFor(() => {
      expect(mockApi.delete).toHaveBeenCalled();
    });
  });

  it("handles item deletion and cancellation", async () => {
    // Correctly mock the items for the specific checklist
    mockApi.get.mockImplementation((url) => {
      if (url === "/auth/user/") return Promise.resolve({ data: { data: { email: "u" } } });
      if (url === "/checklist/") return Promise.resolve({ data: { data: [SAMPLE_LIST] } });
      if (url === "/checklist/archived/") return Promise.resolve({ data: { data: [] } });
      if (url.includes("/items/")) return Promise.resolve({ data: { data: [SAMPLE_ITEM] } });
      return Promise.resolve({ data: { data: [] } });
    });
    
    renderDashboard();
    await screen.findByText("Daily Setup");
    await userEvent.click(screen.getByText("Daily Setup")); // Open checklist
    
    // Wait for item to appear
    await screen.findByText(SAMPLE_ITEM.label);
    const deleteBtn = screen.getByText("Delete");
    
    // Cancel
    vi.spyOn(window, "confirm").mockReturnValueOnce(false);
    await userEvent.click(deleteBtn);
    expect(mockApi.delete).not.toHaveBeenCalled();
    
    // Confirm
    vi.spyOn(window, "confirm").mockReturnValueOnce(true);
    mockApi.delete.mockResolvedValueOnce({ data: {} });
    await userEvent.click(deleteBtn);
    expect(mockApi.delete).toHaveBeenCalled();
  });

  it("updates checklist type in edit mode", async () => {
    setupDefaultMocks({ checklists: { data: { data: [SAMPLE_LIST] } } });
    renderDashboard();
    await screen.findByText("Daily Setup");
    
    await userEvent.click(screen.getByText("Edit"));
    const select = screen.getByDisplayValue("Daily");
    await userEvent.selectOptions(select, "Weekly");
    expect(select.value).toBe("Weekly");
    
    mockApi.patch.mockResolvedValueOnce({ data: { ...SAMPLE_LIST, type: "Weekly" } });
    await userEvent.click(screen.getByText("Save"));
  });

  it("handles restore success", async () => {
    setupDefaultMocks({ archived: { data: { data: [{
      id: 99, name: "Archived List", type: "Daily"
    }] } } });
    mockApi.post.mockResolvedValueOnce({ data: {} });
    
    renderDashboard();
    const showArchivedBtn = screen.getByText(/Show Archived/i);
    await userEvent.click(showArchivedBtn);
    
    const restoreBtn = await screen.findByText("Restore");
    await userEvent.click(restoreBtn);
    
    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalled();
    });
  });

  it("handles unauthorized error path", async () => {
    mockApi.get.mockRejectedValueOnce({ response: { status: 401, data: {} } });
    renderDashboard();
  });
});
