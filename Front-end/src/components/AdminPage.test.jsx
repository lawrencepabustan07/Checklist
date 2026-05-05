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
        total_items: 6,
        completed_items: 2,
        pending_items: 4,
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
        total_items: 2,
        completed_items: 2,
        pending_items: 0,
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
  activity = ACTIVITY_RESPONSE,
} = {}) {
  mockApi.get.mockImplementation((url) => {
    if (url === "/auth/user/") return Promise.resolve(currentUser);
    if (url === "/admin/users/") return Promise.resolve(users);
    if (url.startsWith("/admin/users/?")) return Promise.resolve(users);
    if (url === "/admin/checklists/") return Promise.resolve(checklists);
    if (url.startsWith("/admin/checklists/?")) return Promise.resolve(checklists);
    if (url === "/admin/checklists/abc/items/") return Promise.resolve(items);
    if (url.startsWith("/admin/checklists/abc/items/?")) return Promise.resolve(items);
    if (url === "/admin/checklists/xyz/items/") return Promise.resolve({ data: { data: [] } });
    if (url.startsWith("/admin/checklists/xyz/items/?")) return Promise.resolve({ data: { data: [] } });
    if (url === "/admin/users/2/activity/?limit=10") return Promise.resolve(activity);
    if (url === "/admin/users/3/activity/?limit=10") return Promise.resolve(activity);
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
    localStorage.clear();
    sessionStorage.clear();
    globalThis.URL.createObjectURL = vi.fn(() => "blob:checklist-preview");
  });

  it("renders a single user list and opens management inside a modal", async () => {
    const user = userEvent.setup();
    setupAdminMocks();
    renderAdminPage();

    expect(await screen.findByRole("heading", { name: "Admin Console" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "System Insights" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "member@example.com Checklists" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /member@example\.com/i }));

    expect(await screen.findByRole("heading", { name: "Manage member@example.com" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "member@example.com Checklists" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Items for Payroll Review" })).toBeInTheDocument();
    expect(screen.getByText("Approve payroll")).toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: "Close" })[0]);
    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: "Manage member@example.com" })).not.toBeInTheDocument();
    });
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

  it("navigates back to the dashboard from the header action", async () => {
    const user = userEvent.setup();
    setupAdminMocks();
    renderAdminPage();

    await screen.findByRole("heading", { name: "Admin Console" });
    await user.click(screen.getByRole("button", { name: "Back to Dashboard" }));

    expect(mockNavigate).toHaveBeenCalledWith("/dashboard");
  });

  it("lets admins change user roles, archive users, and view activity inside the modal", async () => {
    const user = userEvent.setup();
    setupAdminMocks();
    mockApi.patch.mockResolvedValue({ data: { data: {} } });

    renderAdminPage();
    await user.click(await screen.findByRole("button", { name: /member@example\.com/i }));
    expect(await screen.findByRole("heading", { name: "Manage member@example.com" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Make Admin" }));
    await waitFor(() => {
      expect(mockApi.patch).toHaveBeenCalledWith("/admin/users/2/", { is_admin: true });
    });

    await user.click(screen.getByRole("button", { name: "Archive User" }));
    await waitFor(() => {
      expect(mockApi.patch).toHaveBeenCalledWith("/admin/users/2/", { is_active: false });
    });

    await user.click(screen.getByRole("button", { name: "View Activity" }));
    expect(await screen.findByRole("heading", { name: /Login Activity/i })).toBeInTheDocument();
    expect(screen.getByText("127.0.0.1")).toBeInTheDocument();
  });

  it("shows error feedback for failed user updates, failed activity loading, and failed item toggles", async () => {
    const user = userEvent.setup();
    setupAdminMocks();
    mockApi.patch
      .mockRejectedValueOnce({ response: { data: { message: "Role update failed." } } })
      .mockRejectedValueOnce({ response: { data: { message: "Toggle failed." } } });
    mockApi.get.mockImplementation((url) => {
      if (url === "/auth/user/") return Promise.resolve({ data: { data: { email: "admin@example.com", is_admin: true } } });
      if (url === "/admin/users/") return Promise.resolve(USERS_RESPONSE);
      if (url.startsWith("/admin/users/?")) return Promise.resolve(USERS_RESPONSE);
      if (url === "/admin/checklists/") return Promise.resolve(CHECKLISTS_RESPONSE);
      if (url.startsWith("/admin/checklists/?")) return Promise.resolve(CHECKLISTS_RESPONSE);
      if (url === "/admin/checklists/abc/items/") return Promise.resolve(ITEMS_RESPONSE);
      if (url.startsWith("/admin/checklists/abc/items/?")) return Promise.resolve(ITEMS_RESPONSE);
      if (url === "/admin/checklists/xyz/items/") return Promise.resolve({ data: { data: [] } });
      if (url.startsWith("/admin/checklists/xyz/items/?")) return Promise.resolve({ data: { data: [] } });
      if (url === "/admin/users/2/activity/?limit=10") {
        return Promise.reject({ response: { data: { message: "Activity failed." } } });
      }
      return Promise.resolve({ data: { data: [] } });
    });

    renderAdminPage();
    await user.click(await screen.findByRole("button", { name: /member@example\.com/i }));
    expect(await screen.findByRole("heading", { name: "Manage member@example.com" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Make Admin" }));
    expect(await screen.findByText("Role update failed.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "View Activity" }));
    expect(await screen.findByText("Activity failed.")).toBeInTheDocument();

    const itemSectionHeading = await screen.findByRole("heading", { name: "Items for Payroll Review" });
    const itemSection = itemSectionHeading.closest("section");
    await user.click(within(itemSection).getByLabelText(/Mark Complete/i));
    expect(await screen.findByText("Toggle failed.")).toBeInTheDocument();
  });

  it("creates, edits, and deletes checklists for the selected user from the management modal", async () => {
    const user = userEvent.setup();
    setupAdminMocks();
    mockApi.post.mockResolvedValueOnce({ data: { data: { id: "new" } } });
    mockApi.patch.mockResolvedValueOnce({ data: { data: {} } });
    mockApi.delete.mockResolvedValueOnce({ data: { status: "success" } });

    renderAdminPage();
    await user.click(await screen.findByRole("button", { name: /member@example\.com/i }));
    await screen.findByRole("heading", { name: "Manage member@example.com" });

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
    expect(mockApi.post.mock.calls[0][1].get("created_by_id")).toBe("2");

    const checklistHeading = await screen.findByRole("heading", { name: "member@example.com Checklists" });
    const checklistSection = checklistHeading.closest("section");
    await user.click(within(checklistSection).getAllByRole("button", { name: "Edit" })[0]);
    expect(await screen.findByRole("heading", { name: "Edit Checklist" })).toBeInTheDocument();
    const checklistNameInput = screen.getByDisplayValue("Payroll Review");
    await user.clear(checklistNameInput);
    await user.type(checklistNameInput, "Executive Payroll Review");
    await user.click(screen.getByRole("button", { name: "Save Checklist" }));

    await waitFor(() => {
      expect(mockApi.patch).toHaveBeenCalledWith("/admin/checklists/abc/", expect.any(FormData));
    });
    expect(mockApi.patch.mock.calls[0][1].get("name")).toBe("Executive Payroll Review");

    await user.click(within(checklistSection).getAllByRole("button", { name: "Delete" })[0]);
    expect(await screen.findByRole("heading", { name: "Delete Checklist" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Confirm Delete" }));

    await waitFor(() => {
      expect(mockApi.delete).toHaveBeenCalledWith("/admin/checklists/abc/");
    });
  });

  it("lets admins remove a checklist image while editing inside the management modal", async () => {
    const user = userEvent.setup();
    setupAdminMocks();
    mockApi.patch.mockResolvedValueOnce({ data: { data: {} } });

    renderAdminPage();
    await user.click(await screen.findByRole("button", { name: /member@example\.com/i }));
    const checklistHeading = await screen.findByRole("heading", { name: "member@example.com Checklists" });
    const checklistSection = checklistHeading.closest("section");

    await user.click(within(checklistSection).getAllByRole("button", { name: "Edit" })[0]);
    expect(await screen.findByRole("heading", { name: "Edit Checklist" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Remove Image" }));
    expect(screen.getByAltText("Checklist preview")).toHaveAttribute(
      "src",
      "http://localhost:8000/media/checklists/default-checklist.svg",
    );

    await user.click(screen.getByRole("button", { name: "Save Checklist" }));

    await waitFor(() => {
      expect(mockApi.patch).toHaveBeenCalledWith("/admin/checklists/abc/", expect.any(FormData));
    });
    expect(mockApi.patch.mock.calls[0][1].get("remove_image")).toBe("true");
  });

  it("lets admins add, edit, delete, and toggle items inside the same user modal", async () => {
    const user = userEvent.setup();
    setupAdminMocks();
    mockApi.post.mockResolvedValueOnce({ data: { data: { id: "item-2" } } });
    mockApi.patch
      .mockResolvedValueOnce({ data: { data: {} } })
      .mockResolvedValueOnce({ data: { data: {} } });
    mockApi.delete.mockResolvedValueOnce({ data: { status: "success" } });

    renderAdminPage();
    await user.click(await screen.findByRole("button", { name: /member@example\.com/i }));
    const itemSectionHeading = await screen.findByRole("heading", { name: "Items for Payroll Review" });
    const itemSection = itemSectionHeading.closest("section");

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
    await user.click(screen.getByRole("button", { name: "Confirm Delete" }));

    await waitFor(() => {
      expect(mockApi.delete).toHaveBeenCalledWith("/admin/checklists/abc/items/item-1/");
    });
  });

  it("supports filtering users on the page and checklists/items inside the user modal", async () => {
    const user = userEvent.setup();
    setupAdminMocks();

    renderAdminPage();
    await screen.findByRole("heading", { name: "Admin Console" });

    await user.type(screen.getByLabelText(/Search Users/i), "member");
    await waitFor(() => {
      expect(mockApi.get).toHaveBeenCalledWith(expect.stringContaining("/admin/users/?"));
    });

    await user.click(screen.getByRole("button", { name: /member@example\.com/i }));
    await screen.findByRole("heading", { name: "Manage member@example.com" });

    await user.type(screen.getByLabelText(/Search Checklists/i), "Payroll");
    await user.selectOptions(screen.getByLabelText(/^Type$/i, { selector: "#admin-checklist-filter-type" }), "Monthly");
    await waitFor(() => {
      expect(mockApi.get).toHaveBeenCalledWith(expect.stringContaining("/admin/checklists/?"));
    });

    await user.type(screen.getByLabelText(/Search Items/i), "Approve");
    await user.selectOptions(screen.getByLabelText(/Status/i, { selector: "#admin-item-status-filter" }), "pending");
    await waitFor(() => {
      expect(mockApi.get).toHaveBeenCalledWith(expect.stringContaining("/admin/checklists/abc/items/?"));
    });
  });

  it("shows empty modal states for users without checklists or items", async () => {
    const user = userEvent.setup();
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
          total_items: 0,
          completed_items: 0,
          pending_items: 0,
          completion_rate: 0,
          last_login_at: null,
        },
      ]),
      checklists: createChecklistsResponse([]),
    });

    renderAdminPage();
    await user.click(await screen.findByRole("button", { name: /archived-admin@example\.com/i }));

    expect(await screen.findByRole("heading", { name: "Manage archived-admin@example.com" })).toBeInTheDocument();
    expect(screen.getByText("Reactivate User")).toBeInTheDocument();
    expect(screen.getByText("No logins yet")).toBeInTheDocument();
    expect(screen.getByText("This user has no checklists yet.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Click a checklist to view its items" })).toBeInTheDocument();
  });

  it("signs out from the admin page", async () => {
    const user = userEvent.setup();
    sessionStorage.setItem("access_token", "token");
    localStorage.setItem("email", "admin@example.com");
    localStorage.setItem("is_admin", "true");
    setupAdminMocks();

    renderAdminPage();
    await screen.findByRole("heading", { name: "Admin Console" });
    await user.click(screen.getByRole("button", { name: "Sign out" }));

    expect(sessionStorage.getItem("access_token")).toBeNull();
    expect(localStorage.getItem("email")).toBeNull();
    expect(localStorage.getItem("is_admin")).toBeNull();
    expect(mockNavigate).toHaveBeenCalledWith("/login");
  });
});
