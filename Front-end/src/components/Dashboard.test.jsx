import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

const SAMPLE_LIST = {
  id: "1",
  name: "Daily Setup",
  type: "Daily",
  image_url: "http://test/image.png",
};
const WEEKLY_LIST = {
  id: "2",
  name: "Weekly Review",
  type: "Weekly",
  image_url: "http://test/weekly.png",
};
const MONTHLY_LIST = {
  id: "3",
  name: "Monthly Close",
  type: "Monthly",
  image_url: "http://test/monthly.png",
};

const SAMPLE_ITEM = {
  id: "10",
  label: "Brush teeth",
  type: "Habit",
  is_completed: false,
  due_date: "2026-04-26",
  priority: "medium",
};

function setupDefaultMocks({
  profile = {
    data: {
      data: {
        avatar_url: "http://example.com/avatar.svg",
        theme_preference: "system",
        sort_option: "position",
        sort_direction: "asc",
      },
    },
  },
  checklists = { data: { data: [SAMPLE_LIST] } },
  archived = { data: { data: [] } },
  dashboardAnalytics = {
    data: {
      data: {
        total_items: 3,
        completed_items: 1,
        pending_items: 2,
        completion_rate: 33.33,
        overdue_items: 1,
      },
    },
  },
  items = { data: { data: [SAMPLE_ITEM] } },
  checklistAnalytics = {
    data: {
      total_items: 1,
      completed_items: 0,
      pending_items: 1,
      overdue_items: 0,
      completion_rate: 0,
      best_day: null,
      heatmap: {},
      priority_breakdown: [],
    },
  },
  calendar = { data: { "2026-04-26": [SAMPLE_ITEM] } },
} = {}) {
  mockApi.get.mockImplementation((url) => {
    if (url === "/auth/user/") return Promise.resolve(profile);
    if (url === "/checklist/") return Promise.resolve(checklists);
    if (url === "/checklist/archived/") return Promise.resolve(archived);
    if (url === "/checklist/dashboard-analytics/") {
      return Promise.resolve(dashboardAnalytics);
    }
    if (url.startsWith(`/checklist/${SAMPLE_LIST.id}/items/analytics/`)) {
      return Promise.resolve(checklistAnalytics);
    }
    if (url.startsWith(`/checklist/${SAMPLE_LIST.id}/items/calendar/`)) {
      return Promise.resolve(calendar);
    }
    if (url.startsWith(`/checklist/${SAMPLE_LIST.id}/items/`)) {
      return Promise.resolve(items);
    }
    return Promise.resolve({ data: { data: [] } });
  });
}

function renderDashboard(props = {}) {
  return render(
    <MemoryRouter>
      <Dashboard onLogout={vi.fn()} {...props} />
    </MemoryRouter>,
  );
}

async function openChecklist(user, items = [SAMPLE_ITEM]) {
  setupDefaultMocks({ items: { data: { data: items } } });
  renderDashboard();
  await user.click(await screen.findByText("Daily Setup"));
  if (items.length > 0) {
    await screen.findByText(items[0].label);
  } else {
    await screen.findByText(/No items yet/i);
  }
}

describe("Dashboard", () => {
  beforeEach(() => {
    mockApi.get.mockReset();
    mockApi.post.mockReset();
    mockApi.patch.mockReset();
    mockApi.delete.mockReset();
    localStorage.clear();
    localStorage.setItem("email", "lawrence@example.com");
    localStorage.setItem("access_token", "token");
    vi.spyOn(window, "confirm").mockReturnValue(true);
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
  });

  it("renders welcome copy and dashboard analytics on load", async () => {
    setupDefaultMocks();
    renderDashboard();

    expect(await screen.findByText("Welcome back, lawrence")).toBeInTheDocument();
    expect(screen.getByText("Dashboard Analytics")).toBeInTheDocument();
    expect(screen.getByText("Total Items")).toBeInTheDocument();
  });

  it("filters checklists by type and shows count badges", async () => {
    const user = userEvent.setup();
    setupDefaultMocks({
      checklists: { data: { data: [SAMPLE_LIST, WEEKLY_LIST, MONTHLY_LIST] } },
    });

    renderDashboard();
    expect(await screen.findByText("Daily Setup")).toBeInTheDocument();
    expect(screen.getByText("Weekly Review")).toBeInTheDocument();
    expect(screen.getByText("Monthly Close")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /All 3/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Daily 1/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Weekly 1/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Weekly 1/i }));

    expect(screen.getByText("Weekly Review")).toBeInTheDocument();
    expect(screen.queryByText("Daily Setup")).not.toBeInTheDocument();
    expect(screen.queryByText("Monthly Close")).not.toBeInTheDocument();
  });

  it("creates a checklist with multipart form data", async () => {
    const user = userEvent.setup();
    setupDefaultMocks({ checklists: { data: { data: [] } } });
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
    const [, formData] = mockApi.post.mock.calls[0];
    expect(formData.get("name")).toBe("Weekly Review");
    expect(formData.get("type")).toBe("Weekly");
  });

  it("shows checklist creation errors from the API", async () => {
    const user = userEvent.setup();
    setupDefaultMocks({ checklists: { data: { data: [] } } });
    mockApi.post.mockRejectedValueOnce({
      response: { data: { message: "Name already taken" } },
    });

    renderDashboard();
    await screen.findByText(/No checklists yet/i);
    await user.click(screen.getByRole("button", { name: "+ New Checklist" }));
    await user.type(screen.getByPlaceholderText("Checklist name"), "Weekly Review");
    await user.selectOptions(screen.getByRole("combobox"), "Weekly");
    await user.click(screen.getByRole("button", { name: "+ Create Checklist" }));

    expect(await screen.findByText("Name already taken")).toBeInTheDocument();
  });

  it("validates checklist image type and size", async () => {
    const user = userEvent.setup();
    setupDefaultMocks();
    renderDashboard();
    await screen.findByText("Daily Setup");

    await user.click(screen.getByRole("button", { name: "+ New Checklist" }));

    const fileInput = document.getElementById("new-checklist-image");
    fireEvent.change(fileInput, {
      target: { files: [new File(["gif"], "bad.gif", { type: "image/gif" })] },
    });
    expect(await screen.findByText(/Only JPG, PNG, and WEBP/i)).toBeInTheDocument();

    const bigContent = new Uint8Array(3 * 1024 * 1024);
    fireEvent.change(fileInput, {
      target: { files: [new File([bigContent], "big.png", { type: "image/png" })] },
    });
    expect(await screen.findByText(/2MB or smaller/i)).toBeInTheDocument();
  });

  it("accepts a valid checklist image for creation", async () => {
    const user = userEvent.setup();
    globalThis.URL.createObjectURL = vi.fn(() => "blob:cover-preview");
    setupDefaultMocks();
    renderDashboard();
    await screen.findByText("Daily Setup");

    await user.click(screen.getByRole("button", { name: "+ New Checklist" }));
    const fileInput = document.getElementById("new-checklist-image");
    fireEvent.change(fileInput, {
      target: { files: [new File(["img"], "cover.png", { type: "image/png" })] },
    });

    expect(screen.getByAltText("New checklist preview")).toHaveAttribute(
      "src",
      "blob:cover-preview",
    );
  });

  it("edits a checklist and supports removing its image", async () => {
    const user = userEvent.setup();
    setupDefaultMocks();
    mockApi.patch.mockResolvedValueOnce({
      data: { data: { ...SAMPLE_LIST, name: "Morning Setup", image_url: null } },
    });

    renderDashboard();
    await screen.findByText("Daily Setup");
    await user.click(screen.getByRole("button", { name: "Edit" }));
    const checklistNameInput = screen.getByDisplayValue("Daily Setup");
    await user.clear(checklistNameInput);
    await user.type(checklistNameInput, "Morning Setup");
    await user.click(screen.getByRole("button", { name: "Delete image" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(mockApi.patch).toHaveBeenCalledWith("/checklist/1/", expect.any(FormData));
    });
    const formData = mockApi.patch.mock.calls[0][1];
    expect(formData.get("remove_image")).toBe("true");
    expect(await screen.findByText("Morning Setup")).toBeInTheDocument();
  });

  it("updates checklist type during edit", async () => {
    const user = userEvent.setup();
    setupDefaultMocks();
    mockApi.patch.mockResolvedValueOnce({
      data: { data: { ...SAMPLE_LIST, type: "Weekly" } },
    });

    renderDashboard();
    await screen.findByText("Daily Setup");
    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.selectOptions(screen.getByDisplayValue("Daily"), "Weekly");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(mockApi.patch).toHaveBeenCalledWith("/checklist/1/", expect.any(FormData));
    });
  });

  it("accepts a valid replacement image while editing a checklist", async () => {
    const user = userEvent.setup();
    globalThis.URL.createObjectURL = vi.fn(() => "blob:edit-preview");
    setupDefaultMocks();
    renderDashboard();
    await screen.findByText("Daily Setup");

    await user.click(screen.getByRole("button", { name: "Edit" }));
    const fileInputs = document.querySelectorAll("input[type='file']");
    fireEvent.change(fileInputs[fileInputs.length - 1], {
      target: { files: [new File(["img"], "edit.png", { type: "image/png" })] },
    });

    expect(screen.getByAltText("Daily Setup preview")).toHaveAttribute(
      "src",
      "blob:edit-preview",
    );
  });

  it("shows checklist update errors", async () => {
    const user = userEvent.setup();
    setupDefaultMocks();
    mockApi.patch.mockRejectedValueOnce({
      response: { data: { message: "Update failed" } },
    });

    renderDashboard();
    await screen.findByText("Daily Setup");
    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Update failed")).toBeInTheDocument();
  });

  it("opens a checklist and requests items using saved sort defaults", async () => {
    const user = userEvent.setup();
    setupDefaultMocks();
    renderDashboard();

    await user.click(await screen.findByText("Daily Setup"));

    expect(await screen.findByText("Brush teeth")).toBeInTheDocument();
    expect(mockApi.get).toHaveBeenCalledWith(
      expect.stringContaining("/checklist/1/items/?sort_by=position&direction=asc"),
    );
    expect(screen.getByText("Calendar View")).toBeInTheDocument();
  });

  it("shows the empty state when a checklist has no items", async () => {
    const user = userEvent.setup();
    await openChecklist(user, []);
    expect(screen.getByText(/No items yet - add one above/i)).toBeInTheDocument();
  });

  it("adds an item with due date and priority", async () => {
    const user = userEvent.setup();
    setupDefaultMocks();
    mockApi.post.mockResolvedValueOnce({
      data: {
        data: {
          id: "20",
          label: "Floss",
          type: "Habit",
          due_date: "2026-04-27",
          priority: "high",
        },
      },
    });

    renderDashboard();
    await user.click(await screen.findByText("Daily Setup"));
    await screen.findByText("Brush teeth");

    await user.click(screen.getByRole("button", { name: "+ Add Item" }));
    await user.type(screen.getByPlaceholderText("Item label"), "Floss");
    await user.type(screen.getByPlaceholderText("Item type"), "Habit");
    fireEvent.change(document.querySelector("input[type='date']"), {
      target: { value: "2026-04-27" },
    });
    await user.selectOptions(screen.getByDisplayValue("None"), "high");
    await user.click(screen.getByRole("button", { name: "+ Add Item" }));

    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalledWith(
        "/checklist/1/items/",
        expect.objectContaining({
          label: "Floss",
          type: "Habit",
          due_date: "2026-04-27",
          priority: "high",
        }),
      );
    });
  });

  it("shows calendar items for due dates", async () => {
    const user = userEvent.setup();
    setupDefaultMocks();
    renderDashboard();

    await user.click(await screen.findByText("Daily Setup"));
    await screen.findByText("Brush teeth");
    await user.click(screen.getByRole("button", { name: "Calendar View" }));

    expect(await screen.findByText("Calendar View")).toBeInTheDocument();
    expect((await screen.findAllByText("Apr 26, 2026")).length).toBeGreaterThan(0);
  });

  it("does not render the calendar card when there are no due-dated items", async () => {
    const user = userEvent.setup();
    setupDefaultMocks({ calendar: { data: {} } });
    renderDashboard();

    await user.click(await screen.findByText("Daily Setup"));
    await screen.findByText("Brush teeth");
    await user.click(screen.getByRole("button", { name: "Calendar View" }));

    expect(screen.queryAllByText("Calendar View").length).toBe(0);
    expect(screen.queryByText("Apr 26, 2026")).not.toBeInTheDocument();
  });

  it("toggles sort direction and resets sort defaults", async () => {
    const user = userEvent.setup();
    await openChecklist(user);

    await user.click(screen.getByRole("button", { name: "Ascending" }));
    expect(localStorage.getItem("sort_direction")).toBe("desc");

    await user.selectOptions(screen.getByDisplayValue("Custom Order"), "priority");
    expect(localStorage.getItem("sort_option")).toBe("priority");

    await user.click(screen.getByRole("button", { name: "Reset Sort" }));
    expect(localStorage.getItem("sort_option")).toBe("position");
    expect(localStorage.getItem("sort_direction")).toBe("asc");
  });

  it("filters item requests by priority and status", async () => {
    const user = userEvent.setup();
    await openChecklist(user);

    await user.selectOptions(screen.getByDisplayValue("All priorities"), "high");
    await waitFor(() => {
      expect(mockApi.get).toHaveBeenCalledWith(
        expect.stringContaining("priority=high"),
      );
    });

    await user.selectOptions(screen.getByDisplayValue("All statuses"), "completed");
    await waitFor(() => {
      expect(mockApi.get).toHaveBeenCalledWith(
        expect.stringContaining("status=completed"),
      );
    });
  });

  it("renders analytics heatmap activity when completion data exists", async () => {
    const user = userEvent.setup();
    setupDefaultMocks({
      checklistAnalytics: {
        data: {
          total_items: 2,
          completed_items: 1,
          pending_items: 1,
          overdue_items: 0,
          completion_rate: 50,
          best_day: "Mon",
          heatmap: { "2026-04-26": 2 },
          priority_breakdown: [],
        },
      },
    });
    renderDashboard();
    await user.click(await screen.findByText("Daily Setup"));
    await screen.findByText("Brush teeth");

    expect(screen.getByText("Best Day")).toBeInTheDocument();
    expect(screen.getAllByText("Mon").length).toBeGreaterThan(0);
    expect(screen.getByText("04-26")).toBeInTheDocument();
  });

  it("saves theme preference to local storage and backend", async () => {
    const user = userEvent.setup();
    setupDefaultMocks();
    mockApi.patch.mockResolvedValue({ data: { data: {} } });

    renderDashboard();
    await screen.findByText("Welcome back, lawrence");

    await user.click(screen.getByRole("button", { name: "Dark" }));

    expect(localStorage.getItem("theme_preference")).toBe("dark");
    await waitFor(() => {
      expect(mockApi.patch).toHaveBeenCalledWith("/auth/user/", expect.any(FormData));
    });
  });

  it("supports high contrast theme and default avatar fallback", async () => {
    const user = userEvent.setup();
    setupDefaultMocks({
      profile: {
        data: {
          data: {
            avatar_url: null,
            theme_preference: "system",
            sort_option: "position",
            sort_direction: "asc",
          },
        },
      },
    });
    renderDashboard();

    expect(await screen.findByAltText("Profile avatar")).toHaveAttribute(
      "src",
      expect.stringContaining("default-avatar.svg"),
    );
    await user.click(screen.getByRole("button", { name: "High Contrast" }));
    expect(localStorage.getItem("theme_preference")).toBe("contrast");
  });

  it("updates bulk priority for selected items", async () => {
    const user = userEvent.setup();
    setupDefaultMocks();
    mockApi.patch.mockResolvedValueOnce({
      data: [{ ...SAMPLE_ITEM, priority: "high" }],
    });

    renderDashboard();
    await user.click(await screen.findByText("Daily Setup"));
    await screen.findByText("Brush teeth");

    const checkboxes = screen.getAllByRole("checkbox");
    await user.click(checkboxes[0]);

    expect(await screen.findByText("1 selected")).toBeInTheDocument();
    await user.selectOptions(screen.getByDisplayValue("Medium"), "high");
    await user.click(screen.getByRole("button", { name: "Apply Priority" }));

    await waitFor(() => {
      expect(mockApi.patch).toHaveBeenCalledWith(
        "/checklist/1/items/bulk-priority/",
        { item_ids: ["10"], priority: "high" },
      );
    });
  });

  it("toggles selected item state off when clicked twice", async () => {
    const user = userEvent.setup();
    await openChecklist(user);
    const selectCheckbox = screen.getAllByRole("checkbox")[0];
    await user.click(selectCheckbox);
    expect(await screen.findByText("1 selected")).toBeInTheDocument();
    await user.click(selectCheckbox);
    expect(screen.queryByText("1 selected")).not.toBeInTheDocument();
  });

  it("does not apply bulk priority when nothing is selected", async () => {
    const user = userEvent.setup();
    await openChecklist(user);
    expect(screen.queryByText("1 selected")).not.toBeInTheDocument();
    expect(mockApi.patch).not.toHaveBeenCalledWith(
      "/checklist/1/items/bulk-priority/",
      expect.anything(),
    );
  });

  it("shows bulk priority failure errors", async () => {
    const user = userEvent.setup();
    await openChecklist(user);
    mockApi.patch.mockRejectedValueOnce(new Error("fail"));

    const checkboxes = screen.getAllByRole("checkbox");
    await user.click(checkboxes[0]);
    await user.click(screen.getByRole("button", { name: "Apply Priority" }));

    expect(await screen.findByText(/Failed to update item priorities/i)).toBeInTheDocument();
  });

  it("adds item errors are surfaced", async () => {
    const user = userEvent.setup();
    await openChecklist(user);
    mockApi.post.mockRejectedValueOnce({
      response: { data: { message: "Failed to add" } },
    });

    await user.click(screen.getByRole("button", { name: "+ Add Item" }));
    await user.type(screen.getByPlaceholderText("Item label"), "Floss");
    await user.type(screen.getByPlaceholderText("Item type"), "Habit");
    await user.click(screen.getByRole("button", { name: "+ Add Item" }));

    expect(await screen.findByText("Failed to add")).toBeInTheDocument();
  });

  it("updates an item and persists due date and priority", async () => {
    const user = userEvent.setup();
    await openChecklist(user);
    mockApi.patch.mockResolvedValueOnce({
      data: {
        data: {
          ...SAMPLE_ITEM,
          label: "Floss now",
          due_date: "2026-04-27",
          priority: "high",
        },
      },
    });

    await user.click(screen.getByRole("button", { name: "Edit" }));
    const itemNameInput = screen.getByDisplayValue("Brush teeth");
    await user.clear(itemNameInput);
    await user.type(itemNameInput, "Floss now");
    const itemTypeInput = screen.getByDisplayValue("Habit");
    await user.clear(itemTypeInput);
    await user.type(itemTypeInput, "Routine");
    fireEvent.change(screen.getByDisplayValue("2026-04-26"), {
      target: { value: "2026-04-27" },
    });
    await user.selectOptions(screen.getByDisplayValue("Medium"), "high");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
        expect(mockApi.patch).toHaveBeenCalledWith(
          "/checklist/1/items/10/",
          expect.objectContaining({
            label: "Floss now",
            type: "Routine",
            due_date: "2026-04-27",
            priority: "high",
          }),
      );
    });
  });

  it("cancels item editing", async () => {
    const user = userEvent.setup();
    await openChecklist(user);
    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByDisplayValue("Brush teeth")).not.toBeInTheDocument();
  });

  it("shows update item failure errors", async () => {
    const user = userEvent.setup();
    await openChecklist(user);
    mockApi.patch.mockRejectedValueOnce({
      response: { data: { message: "Save failed" } },
    });
    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Save failed")).toBeInTheDocument();
  });

  it("shows default item update failure message without response text", async () => {
    const user = userEvent.setup();
    await openChecklist(user);
    mockApi.patch.mockRejectedValueOnce(new Error("boom"));
    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Failed to update item")).toBeInTheDocument();
  });

  it("deletes an item after confirmation and handles cancel/failure paths", async () => {
    const user = userEvent.setup();
    await openChecklist(user);

    vi.spyOn(window, "confirm").mockReturnValueOnce(false);
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(mockApi.delete).not.toHaveBeenCalledWith("/checklist/1/items/10/");

    vi.spyOn(window, "confirm").mockReturnValueOnce(true);
    mockApi.delete.mockResolvedValueOnce({});
    await user.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => {
      expect(mockApi.delete).toHaveBeenCalledWith("/checklist/1/items/10/");
    });

    await openChecklist(user);
    mockApi.delete.mockRejectedValueOnce(new Error("fail"));
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(await screen.findByText(/Failed to delete item/i)).toBeInTheDocument();
  });

  it("toggles item completion and handles failure", async () => {
    const user = userEvent.setup();
    await openChecklist(user);
    mockApi.patch.mockResolvedValueOnce({
      data: { data: { ...SAMPLE_ITEM, is_completed: true } },
    });

    await user.click(screen.getAllByRole("checkbox")[1]);
    await waitFor(() => {
      expect(mockApi.patch).toHaveBeenCalledWith(
        "/checklist/1/items/10/",
        { is_completed: true },
      );
    });

    mockApi.patch.mockRejectedValueOnce(new Error("fail"));
    await user.click(screen.getAllByRole("checkbox")[1]);
    expect(await screen.findByText(/Failed to update item status/i)).toBeInTheDocument();
  });

  it("reorders items and handles reorder failures", async () => {
    const user = userEvent.setup();
    const items = [
      { ...SAMPLE_ITEM, id: "10", label: "First" },
      { ...SAMPLE_ITEM, id: "11", label: "Second", due_date: "2026-04-27" },
    ];
    await openChecklist(user, items);
    mockApi.post.mockResolvedValueOnce({ data: [items[1], items[0]] });

    const rows = document.querySelectorAll("[draggable='true']");
    fireEvent.dragStart(rows[0]);
    fireEvent.dragOver(rows[1]);
    fireEvent.drop(rows[1]);
    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalledWith(
        "/checklist/1/items/reorder/",
        expect.objectContaining({ ordered_ids: expect.any(Array) }),
      );
    });
    await waitFor(() => {
      expect(screen.getByText("Second")).toBeInTheDocument();
    });

    mockApi.post.mockRejectedValueOnce(new Error("fail"));
    fireEvent.dragStart(rows[0]);
    fireEvent.dragOver(rows[1]);
    fireEvent.drop(rows[1]);
    expect(await screen.findByText(/Failed to reorder items/i)).toBeInTheDocument();
  });

  it("shows non-draggable ordering cues when using non-custom sort", async () => {
    const user = userEvent.setup();
    await openChecklist(user, [{ ...SAMPLE_ITEM, is_completed: true, due_date: null }]);
    await user.selectOptions(screen.getByDisplayValue("Custom Order"), "priority");

    expect(screen.getByText("--")).toBeInTheDocument();
    expect(screen.getByText("No due date")).toBeInTheDocument();
    expect(screen.getByText("Brush teeth")).toHaveStyle({
      textDecoration: "line-through",
    });
  });

  it("archives, restores, and handles failures for checklists", async () => {
    const user = userEvent.setup();
    setupDefaultMocks();
    renderDashboard();
    await screen.findByText("Daily Setup");

    vi.spyOn(window, "confirm").mockReturnValueOnce(false);
    await user.click(screen.getByRole("button", { name: "Archive" }));
    expect(mockApi.delete).not.toHaveBeenCalledWith("/checklist/1/");

    vi.spyOn(window, "confirm").mockReturnValueOnce(true);
    mockApi.delete.mockResolvedValueOnce({ data: { data: SAMPLE_LIST } });
    await user.click(screen.getByRole("button", { name: "Archive" }));
    await waitFor(() => {
      expect(mockApi.delete).toHaveBeenCalledWith("/checklist/1/");
    });

    mockApi.post.mockResolvedValueOnce({ data: { data: SAMPLE_LIST } });
    await user.click(screen.getByRole("button", { name: /Show Archived/i }));
    await user.click(screen.getByRole("button", { name: "Restore" }));
    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalledWith("/checklist/1/restore/");
    });

    setupDefaultMocks();
    mockApi.delete.mockRejectedValueOnce(new Error("fail"));
    renderDashboard();
    await screen.findByText("Daily Setup");
    await user.click(screen.getAllByRole("button", { name: "Archive" })[0]);
    expect(await screen.findByText(/Could not archive checklist/i)).toBeInTheDocument();
  });

  it("restores from local fallback data", async () => {
    const user = userEvent.setup();
    setupDefaultMocks({
      archived: {
        data: { data: [{ id: "9", name: "Old List", type: "Weekly" }] },
      },
    });
    mockApi.post.mockResolvedValueOnce({ data: {} });

    renderDashboard();
    await screen.findByText("Welcome back, lawrence");
    await user.click(screen.getByRole("button", { name: /Show Archived/i }));
    await user.click(screen.getByRole("button", { name: "Restore" }));
    expect(await screen.findByText("Old List")).toBeInTheDocument();
  });

  it("shows restore failures", async () => {
    const user = userEvent.setup();
    setupDefaultMocks({
      archived: {
        data: { data: [{ id: "9", name: "Old List", type: "Weekly" }] },
      },
    });
    mockApi.post.mockRejectedValueOnce(new Error("fail"));

    renderDashboard();
    await screen.findByText("Welcome back, lawrence");
    await user.click(screen.getByRole("button", { name: /Show Archived/i }));
    await user.click(screen.getByRole("button", { name: "Restore" }));
    expect(await screen.findByText(/Could not restore checklist/i)).toBeInTheDocument();
  });

  it("handles permanent delete cancel and failure paths", async () => {
    const user = userEvent.setup();
    setupDefaultMocks({
      archived: {
        data: { data: [{ id: "9", name: "Old List", type: "Weekly" }] },
      },
    });
    renderDashboard();
    await screen.findByText("Welcome back, lawrence");
    await user.click(screen.getByRole("button", { name: /Show Archived/i }));

    vi.spyOn(window, "confirm").mockReturnValueOnce(false);
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(mockApi.delete).not.toHaveBeenCalledWith("/checklist/9/permanent/");

    vi.spyOn(window, "confirm").mockReturnValueOnce(true);
    mockApi.delete.mockRejectedValueOnce(new Error("fail"));
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(await screen.findByText(/Could not delete checklist permanently/i)).toBeInTheDocument();
  });

  it("dismisses the error banner", async () => {
    const user = userEvent.setup();
    setupDefaultMocks({ checklists: { data: { data: [] } } });
    mockApi.post.mockRejectedValueOnce({
      response: { data: { message: "Name already taken" } },
    });
    renderDashboard();
    await screen.findByText(/No checklists yet/i);
    await user.click(screen.getByRole("button", { name: "+ New Checklist" }));
    await user.type(screen.getByPlaceholderText("Checklist name"), "Weekly Review");
    await user.selectOptions(screen.getByRole("combobox"), "Weekly");
    await user.click(screen.getByRole("button", { name: "+ Create Checklist" }));
    await screen.findByText("Name already taken");
    await user.click(screen.getByRole("button", { name: "x" }));
    expect(screen.queryByText("Name already taken")).not.toBeInTheDocument();
  });

  it("signs out and clears local session state", async () => {
    const user = userEvent.setup();
    const onLogout = vi.fn();
    setupDefaultMocks();
    renderDashboard({ onLogout });

    await screen.findByText("Welcome back, lawrence");
    await user.click(screen.getByRole("button", { name: "Sign out" }));

    expect(localStorage.getItem("access_token")).toBeNull();
    expect(localStorage.getItem("email")).toBeNull();
    expect(onLogout).toHaveBeenCalledTimes(1);
  });

  it("permanently deletes an archived checklist", async () => {
    const user = userEvent.setup();
    setupDefaultMocks({
      archived: {
        data: { data: [{ id: "9", name: "Old List", type: "Weekly" }] },
      },
    });
    mockApi.delete.mockResolvedValueOnce({ data: { status: "success" } });

    renderDashboard();
    await screen.findByText("Welcome back, lawrence");
    await user.click(screen.getByRole("button", { name: /Show Archived \(1\)/i }));
    expect(await screen.findByText("Old List")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(mockApi.delete).toHaveBeenCalledWith("/checklist/9/permanent/");
    });
  });
});
