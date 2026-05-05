import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  AdminChecklistsList,
  AdminFilters,
  AdminInsights,
  AdminItemsList,
  AdminUsersList,
  StatCard,
  UserDetailCard,
} from "./AdminPageSections";

const styles = {
  ringWrap: {},
  ringSvg: {},
  ringCenter: {},
  ringValue: {},
  ringLabel: {},
  statCardSuccess: {},
  statCardWarning: {},
  insightStatCard: {},
  metricIconRow: {},
  metricEmoji: {},
  metricLabel: {},
  metricValue: {},
  metricCaption: {},
  section: {},
  sectionAccent: {},
  sectionHeader: {},
  sectionTitle: {},
  sectionMeta: {},
  insightsGrid: {},
  ringCard: {},
  cardTitle: {},
  filterGrid: {},
  modalField: {},
  modalLabel: {},
  input: {},
  select: {},
  userStatsCard: {},
  userTopRow: {},
  avatar: {},
  userIdentity: {},
  userEmail: {},
  userRole: {},
  userCompletionPill: {},
  actions: {},
  secondaryButton: {},
  deleteGhostButton: {},
  primaryButton: {},
  ghostButton: {},
  metricGrid: {},
  metricCard: {},
  metricValueSmall: {},
  userItemProgressBlock: {},
  progressHeaderRow: {},
  progressCountText: {},
  progressTrack: {},
  progressTrackSmall: {},
  progressFill: () => ({}),
  userRail: {},
  userList: {},
  userCard: () => ({}),
  userMiniStats: {},
  userMiniProgressBlock: {},
  userMiniProgressText: {},
  checklistList: {},
  emptyText: {},
  checklistCard: () => ({}),
  checklistInfo: {},
  checklistTopRow: {},
  checklistImage: {},
  checklistBody: {},
  checklistHeadingRow: {},
  checklistName: {},
  checklistType: {},
  checklistStats: {},
  deleteButton: {},
  itemList: {},
  itemCard: {},
  itemInfo: {},
  itemHeadingRow: {},
  itemName: {},
  itemStatsRow: {},
  statusPill: () => ({}),
  metaPill: {},
  checkboxAction: {},
};

const users = [
  {
    id: 1,
    email: "member@example.com",
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
    last_login_at: "2026-05-04T00:00:00Z",
  },
];

const checklists = [
  {
    id: "abc",
    name: "Payroll Review",
    type: "Monthly",
    image_url: "",
    total_items: 4,
    completed_items: 2,
    pending_items: 2,
  },
];

const items = [
  {
    id: "item-1",
    label: "Approve payroll",
    type: "Task",
    due_date: "",
    priority: "low",
    priority_label: "Low",
    is_completed: false,
  },
];

describe("AdminPageSections", () => {
  it("renders the reusable stat and insights cards", () => {
    render(
      <>
        <StatCard title="Completed" value="8" icon="✅" trend="Up" color="success" styles={styles} />
        <AdminInsights
          insights={{
            total_users: 2,
            active_users: 1,
            inactive_users: 1,
            total_checklist_items: 10,
            total_pending_items: 4,
            total_completed_items: 6,
            avg_completion_rate: 60,
          }}
          styles={styles}
        />
      </>,
    );

    expect(screen.getAllByText("Completed").length).toBeGreaterThan(0);
    expect(screen.getByText("System Insights")).toBeInTheDocument();
    expect(screen.getByText("Total Users")).toBeInTheDocument();
    expect(screen.getByText("Total Checklist Items")).toBeInTheDocument();
    expect(screen.getByText("Pending Items")).toBeInTheDocument();
    expect(screen.getByText("Average Completion Rate")).toBeInTheDocument();
  });

  it("renders all three filter variants", () => {
    const onFilterChange = vi.fn();
    render(
      <>
        <AdminFilters
          filters={{ search: "", role: "", status: "" }}
          onFilterChange={onFilterChange}
          type="users"
          styles={styles}
        />
        <AdminFilters
          filters={{ search: "", type: "", creator: "", date_from: "", date_to: "" }}
          onFilterChange={onFilterChange}
          type="checklists"
          styles={styles}
          checklistTypes={["Daily", "Monthly"]}
        />
        <AdminFilters
          filters={{ search: "", type: "", status: "", priority: "", date_from: "", date_to: "" }}
          onFilterChange={onFilterChange}
          type="items"
          styles={styles}
          priorityOptions={[{ value: "low", label: "Low" }]}
        />
      </>,
    );

    expect(screen.getByLabelText("Search Users")).toBeInTheDocument();
    expect(screen.getByLabelText("Search Checklists")).toBeInTheDocument();
    expect(screen.getByLabelText("Search Items")).toBeInTheDocument();
  });

  it("renders the user detail card actions", async () => {
    const user = userEvent.setup();
    const onPromoteDemote = vi.fn();
    const onArchiveReactivate = vi.fn();
    const onViewActivity = vi.fn();

    render(
      <UserDetailCard
        user={users[0]}
        onPromoteDemote={onPromoteDemote}
        onArchiveReactivate={onArchiveReactivate}
        onViewActivity={onViewActivity}
        updatingUserId={null}
        styles={styles}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Make Admin" }));
    await user.click(screen.getByRole("button", { name: "Archive User" }));
    await user.click(screen.getByRole("button", { name: "View Activity" }));

    expect(onPromoteDemote).toHaveBeenCalledWith(users[0]);
    expect(onArchiveReactivate).toHaveBeenCalledWith(users[0]);
    expect(onViewActivity).toHaveBeenCalledWith(users[0]);
  });

  it("supports click and keyboard selection in the users list", async () => {
    const user = userEvent.setup();
    const onSelectUser = vi.fn();

    render(
      <AdminUsersList
        users={users}
        selectedUserId={null}
        onSelectUser={onSelectUser}
        styles={styles}
      />,
    );

    const card = screen.getByRole("button", { name: /member@example\.com/i });
    await user.click(card);
    fireEvent.keyDown(card, { key: "Enter" });
    fireEvent.keyDown(card, { key: " " });

    expect(onSelectUser).toHaveBeenCalledTimes(3);
  });

  it("renders empty and interactive checklist list states", async () => {
    const user = userEvent.setup();
    const onSelectChecklist = vi.fn();
    const onEditChecklist = vi.fn();
    const onDeleteChecklist = vi.fn();
    const onCreateChecklist = vi.fn();

    const { rerender } = render(
      <AdminChecklistsList
        checklists={[]}
        selectedChecklistId={null}
        userId={null}
        userEmail="member@example.com"
        onSelectChecklist={onSelectChecklist}
        onEditChecklist={onEditChecklist}
        onDeleteChecklist={onDeleteChecklist}
        onCreateChecklist={onCreateChecklist}
        styles={styles}
        defaultChecklistImage="http://example.com/default.svg"
      />,
    );

    expect(screen.getByText("This user has no checklists yet.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add New Checklist" })).toBeDisabled();

    rerender(
      <AdminChecklistsList
        checklists={checklists}
        selectedChecklistId={null}
        userId={1}
        userEmail="member@example.com"
        onSelectChecklist={onSelectChecklist}
        onEditChecklist={onEditChecklist}
        onDeleteChecklist={onDeleteChecklist}
        onCreateChecklist={onCreateChecklist}
        styles={styles}
        defaultChecklistImage="http://example.com/default.svg"
      />,
    );

    await user.click(screen.getByText("Payroll Review"));
    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(onSelectChecklist).toHaveBeenCalledWith("abc");
    expect(onEditChecklist).toHaveBeenCalledWith(checklists[0]);
    expect(onDeleteChecklist).toHaveBeenCalledWith(checklists[0]);
  });

  it("renders loading, empty, and interactive item list states", async () => {
    const user = userEvent.setup();
    const onToggleItem = vi.fn();
    const onEditItem = vi.fn();
    const onDeleteItem = vi.fn();
    const onCreateItem = vi.fn();

    const { rerender } = render(
      <AdminItemsList
        items={[]}
        selectedChecklist={{ name: "Payroll Review" }}
        onToggleItem={onToggleItem}
        onEditItem={onEditItem}
        onDeleteItem={onDeleteItem}
        onCreateItem={onCreateItem}
        loading
        styles={styles}
      />,
    );

    expect(screen.getByText("Loading items...")).toBeInTheDocument();

    rerender(
      <AdminItemsList
        items={[]}
        selectedChecklist={{ name: "Payroll Review" }}
        onToggleItem={onToggleItem}
        onEditItem={onEditItem}
        onDeleteItem={onDeleteItem}
        onCreateItem={onCreateItem}
        loading={false}
        styles={styles}
      />,
    );

    expect(screen.getByText("No items for this checklist yet.")).toBeInTheDocument();

    rerender(
      <AdminItemsList
        items={items}
        selectedChecklist={{ name: "Payroll Review" }}
        onToggleItem={onToggleItem}
        onEditItem={onEditItem}
        onDeleteItem={onDeleteItem}
        onCreateItem={onCreateItem}
        loading={false}
        styles={styles}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Add Item" }));
    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.click(screen.getByLabelText(/Mark Complete/i));

    expect(onCreateItem).toHaveBeenCalled();
    expect(onEditItem).toHaveBeenCalledWith(items[0]);
    expect(onDeleteItem).toHaveBeenCalledWith(items[0]);
    expect(onToggleItem).toHaveBeenCalledWith(items[0]);
    expect(screen.getByText("No due date")).toBeInTheDocument();
    expect(screen.getByText("Low")).toBeInTheDocument();
  });

  it("renders completed item branches with priority fallback text", () => {
    render(
      <AdminItemsList
        items={[
          {
            id: "item-2",
            label: "Ship report",
            type: "Task",
            due_date: "2026-05-06",
            priority: "medium",
            is_completed: true,
          },
        ]}
        selectedChecklist={{ name: "Weekly Ops" }}
        onToggleItem={vi.fn()}
        onEditItem={vi.fn()}
        onDeleteItem={vi.fn()}
        onCreateItem={vi.fn()}
        loading={false}
        styles={styles}
      />,
    );

    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(screen.getByText("medium")).toBeInTheDocument();
    expect(screen.getByText("Complete")).toBeInTheDocument();
  });
});
