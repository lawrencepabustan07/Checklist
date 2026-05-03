import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockApi, mockNavigate } = vi.hoisted(() => ({
  mockApi: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    interceptors: { request: { use: vi.fn() } },
  },
  mockNavigate: vi.fn(),
}));

vi.mock("axios", () => ({
  default: { create: vi.fn(() => mockApi) },
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

import AdminPage from "./AdminPage";

const USERS_RESPONSE = {
  data: {
    data: [
      {
        id: 2,
        email: "member@example.com",
        username: "member",
        is_admin: false,
        is_active: true,
        avatar_url: "http://example.com/member.png",
        total_checklists: 3,
        completed_checklists: 1,
        pending_checklists: 2,
        completion_rate: 33.33,
      },
      {
        id: 3,
        email: "other@example.com",
        username: "other",
        is_admin: false,
        is_active: true,
        avatar_url: "http://example.com/other.png",
        total_checklists: 1,
        completed_checklists: 1,
        pending_checklists: 0,
        completion_rate: 100,
      },
    ],
  },
};

const CHECKLISTS_RESPONSE = {
  data: {
    data: [
      {
        id: "abc",
        name: "Payroll Review",
        type: "Monthly",
        image_url: "http://example.com/payroll.png",
        created_by_id: 2,
        created_by_email: "member@example.com",
        total_items: 6,
        completed_items: 4,
        pending_items: 2,
        completion_rate: 66.67,
      },
      {
        id: "xyz",
        name: "Other User Checklist",
        type: "Weekly",
        image_url: "http://example.com/other.png",
        created_by_id: 3,
        created_by_email: "other@example.com",
        total_items: 2,
        completed_items: 2,
        pending_items: 0,
        completion_rate: 100,
      },
    ],
  },
};

const ITEMS_RESPONSE = {
  data: {
    data: [
      {
        id: "item-1",
        label: "Approve payroll",
        type: "Task",
        due_date: "2026-05-02",
        priority: "high",
        priority_label: "High",
        is_completed: false,
      },
    ],
  },
};

const INSIGHTS_RESPONSE = {
  data: {
    data: {
      total_users: 2,
      active_users: 2,
      inactive_users: 0,
      total_checklists: 4,
      archived_checklists: 0,
      total_items: 8,
      completed_items: 5,
      pending_items: 3,
      item_completion_rate: 62.5,
      leaderboard: [
        {
          id: 2,
          email: "member@example.com",
          completed_items: 4,
          completion_rate: 33.33,
          total_checklists: 3,
          total_items: 6,
        },
      ],
      most_active_user: {
        id: 2,
        email: "member@example.com",
        completed_items: 4,
        total_items: 6,
      },
      least_active_user: {
        id: 3,
        email: "other@example.com",
        completed_items: 1,
        total_items: 2,
      },
    },
  },
};

const ACTIVITY_RESPONSE = {
  data: {
    data: [
      {
        id: 11,
        provider: "auth0",
        logged_in_at: "2026-05-04T03:30:00Z",
        ip_address: "127.0.0.1",
        user_agent: "Vitest",
      },
    ],
  },
};

function createUsersResponse(data) {
  return { data: { data } };
}

function createChecklistsResponse(data) {
  return { data: { data } };
}

function createItemsResponse(data) {
  return { data: { data } };
}

function createInsightsResponse(data) {
  return { data: { data } };
}

function setupAdminMocks({
  currentUser = {
    data: {
      data: {
        email: "admin@example.com",
        is_admin: true,
      },
    },
  },
  users = USERS_RESPONSE,
  checklists = CHECKLISTS_RESPONSE,
  items = ITEMS_RESPONSE,
  insights = INSIGHTS_RESPONSE,
  activity = ACTIVITY_RESPONSE,
} = {}) {
  mockApi.get.mockImplementation((url) => {
    if (url === "/auth/user/") return Promise.resolve(currentUser);
    if (url === "/admin/users/") return Promise.resolve(users);
    if (url.startsWith("/admin/users/?")) return Promise.resolve(users);
    if (url === "/admin/insights/") return Promise.resolve(insights);
    if (url === "/admin/checklists/") return Promise.resolve(checklists);
    if (url.startsWith("/admin/checklists/?")) return Promise.resolve(checklists);
    if (url === "/admin/checklists/abc/items/") return Promise.resolve(items);
    if (url.startsWith("/admin/checklists/abc/items/?")) return Promise.resolve(items);
    if (url === "/admin/checklists/xyz/items/") return Promise.resolve({ data: { data: [] } });
    if (url === "/admin/users/2/activity/?limit=10") return Promise.resolve(activity);
    return Promise.resolve({ data: { data: [] } });
  });
}

function renderAdminPage() {
  return render(
    <MemoryRouter>
      <AdminPage />
    </MemoryRouter>,
  );
}

describe("AdminPage", () => {
  beforeEach(() => {
    mockApi.get.mockReset();
    mockApi.post.mockReset();
    mockApi.patch.mockReset();
    mockApi.delete.mockReset();
    mockNavigate.mockReset();
    globalThis.URL.createObjectURL = vi.fn(() => "blob:checklist-preview");
  });

  it("renders the checklists workspace by default and auto-selects the first user", async () => {
    const user = userEvent.setup();
    setupAdminMocks();
    renderAdminPage();

    expect(await screen.findByRole("heading", { name: "Admin Console" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "System Insights" })).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { name: "Users" }).length).toBeGreaterThan(0);
    expect(await screen.findByRole("heading", { name: "member@example.com Checklists" })).toBeInTheDocument();
    expect(screen.getByText("Payroll Review")).toBeInTheDocument();
    expect(screen.queryByText("Other User Checklist")).not.toBeInTheDocument();
    await user.click(screen.getByText("Payroll Review"));
    expect(await screen.findByRole("heading", { name: "Items for Payroll Review" })).toBeInTheDocument();
  });

  it("redirects non-admin users back to the dashboard", async () => {
    setupAdminMocks({
      currentUser: {
        data: {
          data: {
            email: "member@example.com",
            is_admin: false,
          },
        },
      },
    });
    renderAdminPage();

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/dashboard", { replace: true });
    });
  });

  it("shows user statistics in the users tab", async () => {
    setupAdminMocks();
    renderAdminPage();

    expect((await screen.findAllByRole("heading", { name: "Users" })).length).toBeGreaterThan(0);
    expect(screen.getAllByText("member@example.com").length).toBeGreaterThan(0);
    expect(screen.getAllByText("other@example.com").length).toBeGreaterThan(0);
    expect(screen.getAllByText("33.33%").length).toBeGreaterThan(0);
    expect(screen.getAllByText("100%").length).toBeGreaterThan(0);
  });

  it("lets admins change user roles, archive users, and view activity history", async () => {
    const user = userEvent.setup();
    setupAdminMocks();
    mockApi.patch.mockResolvedValue({ data: { data: {} } });

    renderAdminPage();
    expect((await screen.findAllByRole("heading", { name: "Users" })).length).toBeGreaterThan(0);

    await user.click(screen.getAllByRole("button", { name: "Make Admin" })[0]);
    await waitFor(() => {
      expect(mockApi.patch).toHaveBeenCalledWith("/admin/users/2/", { is_admin: true });
    });

    await user.click(screen.getAllByRole("button", { name: "Archive User" })[0]);
    await waitFor(() => {
      expect(mockApi.patch).toHaveBeenCalledWith("/admin/users/2/", { is_active: false });
    });

    await user.click(screen.getAllByRole("button", { name: "View Activity" })[0]);
    expect(await screen.findByRole("heading", { name: /Login Activity/i })).toBeInTheDocument();
    expect(screen.getByText("127.0.0.1")).toBeInTheDocument();
  });

  it("shows empty user and checklist states when no users are available", async () => {
    setupAdminMocks({
      users: createUsersResponse([]),
      checklists: createChecklistsResponse([]),
      insights: createInsightsResponse(null),
    });

    renderAdminPage();

    expect(await screen.findByRole("heading", { name: "Admin Console" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "System Insights" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Select a user to begin" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /Checklists$/i })).not.toBeInTheDocument();
  });

  it("creates a checklist from the modal with the selected user and image upload", async () => {
    const user = userEvent.setup();
    setupAdminMocks();
    mockApi.post.mockResolvedValueOnce({ data: { data: { id: "new" } } });

    renderAdminPage();
    await screen.findByRole("heading", { name: "member@example.com Checklists" });
    await user.click(screen.getByRole("button", { name: "Add New Checklist" }));

    expect(await screen.findByRole("heading", { name: "Add New Checklist" })).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/User/i, { selector: "select" }), "2");
    await user.type(screen.getByLabelText(/Checklist Name/i), "Quarterly Audit");
    await user.selectOptions(screen.getByLabelText(/Checklist Type/i), "Quarterly");
    fireEvent.change(screen.getByLabelText(/Checklist Image/i), {
      target: { files: [new File(["img"], "cover.png", { type: "image/png" })] },
    });
    await user.click(screen.getByRole("button", { name: "Create Checklist" }));

    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalledWith("/admin/checklists/", expect.any(FormData));
    });

    const formData = mockApi.post.mock.calls[0][1];
    expect(formData.get("created_by_id")).toBe("2");
    expect(formData.get("name")).toBe("Quarterly Audit");
    expect(formData.get("type")).toBe("Quarterly");
    expect(formData.get("image").name).toBe("cover.png");
  });

  it("lets admins remove a checklist image while editing", async () => {
    const user = userEvent.setup();
    setupAdminMocks();
    mockApi.patch.mockResolvedValueOnce({ data: { data: {} } });

    renderAdminPage();
    const checklistHeading = await screen.findByRole("heading", { name: "member@example.com Checklists" });
    const checklistSection = checklistHeading.closest("section");

    await user.click(within(checklistSection).getAllByRole("button", { name: "Edit" })[0]);
    expect(await screen.findByRole("heading", { name: "Edit Checklist" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Remove Image" }));
    expect(screen.getByAltText("Checklist preview")).toHaveAttribute(
      "src",
      "http://127.0.0.1:8000/media/checklists/default-checklist.svg",
    );

    await user.click(screen.getByRole("button", { name: "Save Checklist" }));

    await waitFor(() => {
      expect(mockApi.patch).toHaveBeenCalledWith("/admin/checklists/abc/", expect.any(FormData));
    });
    expect(mockApi.patch.mock.calls[0][1].get("remove_image")).toBe("true");
  });

  it("opens edit and delete checklist flows in modals", async () => {
    const user = userEvent.setup();
    setupAdminMocks();
    mockApi.patch.mockResolvedValueOnce({ data: { data: {} } });
    mockApi.delete.mockResolvedValueOnce({ data: { status: "success" } });

    renderAdminPage();
    const checklistHeading = await screen.findByRole("heading", { name: "member@example.com Checklists" });
    const checklistSection = checklistHeading.closest("section");

    const editButtons = within(checklistSection).getAllByRole("button", { name: "Edit" });
    await user.click(editButtons[0]);

    expect(await screen.findByRole("heading", { name: "Edit Checklist" })).toBeInTheDocument();
    const checklistNameInput = screen.getByDisplayValue("Payroll Review");
    await user.clear(checklistNameInput);
    await user.type(checklistNameInput, "Executive Payroll Review");
    await user.click(screen.getByRole("button", { name: "Save Checklist" }));

    await waitFor(() => {
      expect(mockApi.patch).toHaveBeenCalledWith("/admin/checklists/abc/", expect.any(FormData));
    });
    expect(mockApi.patch.mock.calls[0][1].get("name")).toBe("Executive Payroll Review");

    const deleteButtons = within(checklistSection).getAllByRole("button", { name: "Delete" });
    await user.click(deleteButtons[0]);

    expect(await screen.findByRole("heading", { name: "Delete Checklist" })).toBeInTheDocument();
    expect(screen.getByText('Delete "Payroll Review" permanently?')).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Confirm Delete" }));

    await waitFor(() => {
      expect(mockApi.delete).toHaveBeenCalledWith("/admin/checklists/abc/");
    });
  });

  it("lets admins add, edit, delete, and toggle items for the selected checklist", async () => {
    const user = userEvent.setup();
    setupAdminMocks();
    mockApi.post.mockResolvedValueOnce({ data: { data: { id: "item-2" } } });
    mockApi.patch
      .mockResolvedValueOnce({ data: { data: {} } })
      .mockResolvedValueOnce({ data: { data: {} } });
    mockApi.delete.mockResolvedValueOnce({ data: { status: "success" } });

    renderAdminPage();
    await screen.findByRole("heading", { name: "member@example.com Checklists" });
    await user.click(screen.getByText("Payroll Review"));
    const itemSectionHeading = await screen.findByRole("heading", { name: "Items for Payroll Review" });
    const itemSection = itemSectionHeading.closest("section");

    expect(await within(itemSection).findByText("Approve payroll")).toBeInTheDocument();

    await user.click(within(itemSection).getByRole("button", { name: "Add Item" }));
    expect(await screen.findByRole("heading", { name: "Add New Item" })).toBeInTheDocument();

    await user.type(screen.getByLabelText(/Item Label/i), "Prepare packet");
    await user.type(screen.getByLabelText(/Item Type/i), "Task");
    await user.click(screen.getByRole("button", { name: "Create Item" }));

    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalledWith("/admin/checklists/abc/items/", {
        label: "Prepare packet",
        type: "Task",
        due_date: null,
        priority: "none",
        is_completed: false,
      });
    });

    await user.click(within(itemSection).getByRole("button", { name: "Edit" }));
    expect(await screen.findByRole("heading", { name: "Edit Checklist Item" })).toBeInTheDocument();

    const itemLabelInput = screen.getByDisplayValue("Approve payroll");
    await user.clear(itemLabelInput);
    await user.type(itemLabelInput, "Approve payroll packet");
    await user.click(screen.getByRole("button", { name: "Save Item" }));

    await waitFor(() => {
      expect(mockApi.patch).toHaveBeenCalledWith("/admin/checklists/abc/items/item-1/", {
        label: "Approve payroll packet",
        type: "Task",
        due_date: "2026-05-02",
        priority: "high",
        is_completed: false,
      });
    });

    await user.click(within(itemSection).getByLabelText(/Mark Complete/i));
    await waitFor(() => {
      expect(mockApi.patch).toHaveBeenCalledWith("/admin/checklists/abc/items/item-1/", {
        is_completed: true,
      });
    });

    await user.click(within(itemSection).getByRole("button", { name: "Delete" }));
    expect(await screen.findByRole("heading", { name: "Delete Item" })).toBeInTheDocument();
    expect(screen.getByText('Delete "Approve payroll" permanently?')).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Confirm Delete" }));

    await waitFor(() => {
      expect(mockApi.delete).toHaveBeenCalledWith("/admin/checklists/abc/items/item-1/");
    });
  });

  it("shows item empty states for a checklist with no items and during empty activity history", async () => {
    const user = userEvent.setup();
    setupAdminMocks({
      activity: createItemsResponse([]),
    });

    renderAdminPage();
    await screen.findByRole("heading", { name: "member@example.com Checklists" });

    await user.click(screen.getAllByRole("button", { name: /other@example\.com/i })[0]);
    expect(await screen.findByRole("heading", { name: "other@example.com Checklists" })).toBeInTheDocument();
    await user.click(screen.getByText("Other User Checklist"));
    expect(await screen.findByRole("heading", { name: "Items for Other User Checklist" })).toBeInTheDocument();
    expect(await screen.findByText("No items for this checklist yet.")).toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: "View Activity" })[1]);
    expect(await screen.findByRole("heading", { name: /Login Activity/i })).toBeInTheDocument();
    expect(screen.getByText("No login activity recorded for this user yet.")).toBeInTheDocument();
  });

  it("shows a loading state before user activity resolves", async () => {
    const user = userEvent.setup();
    let resolveActivity;
    const activityPromise = new Promise((resolve) => {
      resolveActivity = resolve;
    });

    setupAdminMocks();
    mockApi.get.mockImplementation((url) => {
      if (url === "/auth/user/") return Promise.resolve({ data: { data: { email: "admin@example.com", is_admin: true } } });
      if (url === "/admin/users/") return Promise.resolve(USERS_RESPONSE);
      if (url.startsWith("/admin/users/?")) return Promise.resolve(USERS_RESPONSE);
      if (url === "/admin/insights/") return Promise.resolve(INSIGHTS_RESPONSE);
      if (url === "/admin/checklists/") return Promise.resolve(CHECKLISTS_RESPONSE);
      if (url.startsWith("/admin/checklists/?")) return Promise.resolve(CHECKLISTS_RESPONSE);
      if (url === "/admin/checklists/abc/items/") return Promise.resolve(ITEMS_RESPONSE);
      if (url.startsWith("/admin/checklists/abc/items/?")) return Promise.resolve(ITEMS_RESPONSE);
      if (url === "/admin/checklists/xyz/items/") return Promise.resolve({ data: { data: [] } });
      if (url === "/admin/users/2/activity/?limit=10") return activityPromise;
      return Promise.resolve({ data: { data: [] } });
    });

    renderAdminPage();
    await screen.findByRole("heading", { name: "Admin Console" });

    await user.click(screen.getAllByRole("button", { name: "View Activity" })[0]);
    expect(await screen.findByText("Loading activity...")).toBeInTheDocument();

    resolveActivity({ data: { data: [] } });
    expect(await screen.findByText("No login activity recorded for this user yet.")).toBeInTheDocument();
  });

  it("renders archived admin states and supports keyboard user selection", async () => {
    setupAdminMocks({
      users: createUsersResponse([
        {
          id: 7,
          email: "archived-admin@example.com",
          username: "archived-admin",
          is_admin: true,
          is_active: false,
          avatar_url: "http://example.com/admin.png",
          total_checklists: 0,
          completed_checklists: 0,
          pending_checklists: 0,
          completion_rate: 0,
          completed_items: 0,
          last_login_at: null,
        },
        {
          id: 8,
          email: "worker@example.com",
          username: "worker",
          is_admin: false,
          is_active: true,
          avatar_url: "http://example.com/worker.png",
          total_checklists: 1,
          completed_checklists: 1,
          pending_checklists: 0,
          completion_rate: 100,
          completed_items: 2,
          last_login_at: "2026-05-04T00:00:00Z",
        },
      ]),
      checklists: createChecklistsResponse([
        {
          id: "abc",
          name: "Wrapped Checklist",
          type: "Weekly",
          image_url: "",
          created_by_id: 8,
          created_by_email: "worker@example.com",
          total_items: 1,
          completed_items: 1,
          pending_items: 0,
          completion_rate: 100,
        },
      ]),
      items: createItemsResponse([
        {
          id: "done-item",
          label: "Ship report",
          type: "Task",
          due_date: "",
          priority: "low",
          is_completed: true,
        },
      ]),
      insights: createInsightsResponse({
        total_users: 2,
        active_users: 1,
        inactive_users: 1,
        total_checklists: 1,
        archived_checklists: 0,
        total_items: 1,
        completed_items: 1,
        pending_items: 0,
        item_completion_rate: 100,
        leaderboard: [],
        most_active_user: null,
        least_active_user: null,
      }),
    });

    renderAdminPage();

    expect(await screen.findByText("No leaderboard data yet.")).toBeInTheDocument();
    expect(screen.getAllByText("Waiting for activity").length).toBeGreaterThan(0);
    expect(screen.getByText("Reactivate User")).toBeInTheDocument();
    expect(screen.getByText("Make Member")).toBeInTheDocument();
    expect(screen.getByText("No logins yet")).toBeInTheDocument();
    expect(screen.getByText("This user has no checklists yet.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Click a checklist to view its items" })).toBeInTheDocument();

    fireEvent.keyDown(
      screen.getByRole("button", { name: /worker@example\.com/i }),
      { key: "Enter" },
    );

    expect(await screen.findByRole("heading", { name: "worker@example.com Checklists" })).toBeInTheDocument();
    await userEvent.click(screen.getByText("Wrapped Checklist"));
    const itemSectionHeading = await screen.findByRole("heading", { name: "Items for Wrapped Checklist" });
    const itemSection = itemSectionHeading.closest("section");
    expect(within(itemSection).getAllByText("Completed").length).toBeGreaterThan(0);
    expect(within(itemSection).getByText("No due date")).toBeInTheDocument();
    expect(within(itemSection).getByText("low")).toBeInTheDocument();
  });

  it("signs out from the admin page", async () => {
    const user = userEvent.setup();
    localStorage.setItem("access_token", "token");
    localStorage.setItem("email", "admin@example.com");
    localStorage.setItem("is_admin", "true");
    setupAdminMocks();

    renderAdminPage();
    await screen.findByRole("heading", { name: "Admin Console" });
    await user.click(screen.getByRole("button", { name: "Sign out" }));

    expect(localStorage.getItem("access_token")).toBeNull();
    expect(localStorage.getItem("email")).toBeNull();
    expect(localStorage.getItem("is_admin")).toBeNull();
    expect(mockNavigate).toHaveBeenCalledWith("/login");
  });

  it("sends checklist and item filters to the admin endpoints", async () => {
    const user = userEvent.setup();
    setupAdminMocks();

    renderAdminPage();
    await screen.findByRole("heading", { name: "member@example.com Checklists" });

    await user.type(screen.getByLabelText(/Search Checklists/i), "Payroll");
    await user.selectOptions(screen.getByLabelText(/^Type$/i, { selector: "select" }), "Monthly");
    await waitFor(() => {
      expect(mockApi.get).toHaveBeenCalledWith(
        expect.stringContaining("/admin/checklists/?"),
      );
    });

    await user.click(screen.getAllByText("Payroll Review")[0]);
    await screen.findByRole("heading", { name: "Items for Payroll Review" });
    await user.type(screen.getByLabelText(/Search Items/i), "Approve");
    await user.selectOptions(screen.getByLabelText(/Status/i, { selector: "#admin-item-status-filter" }), "pending");

    await waitFor(() => {
      expect(mockApi.get).toHaveBeenCalledWith(
        expect.stringContaining("/admin/checklists/abc/items/?"),
      );
    });
  });
});
