function formatPercent(value) {
  const numeric = Number(value || 0);
  return `${numeric.toFixed(numeric % 1 === 0 ? 0 : 2)}%`;
}

function ProgressRing({ value, label, styles }) {
  const safeValue = Math.max(0, Math.min(100, Number(value || 0)));
  const radius = 48;
  const circumference = 2 * Math.PI * radius;
  const strokeOffset = circumference - (safeValue / 100) * circumference;

  return (
    <div style={styles.ringWrap}>
      <svg width="132" height="132" viewBox="0 0 132 132" style={styles.ringSvg}>
        <defs>
          <linearGradient id="adminCompletionRing" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#22c55e" />
            <stop offset="100%" stopColor="#38bdf8" />
          </linearGradient>
        </defs>
        <circle cx="66" cy="66" r={radius} stroke="rgba(148, 163, 184, 0.16)" strokeWidth="12" fill="none" />
        <circle
          cx="66"
          cy="66"
          r={radius}
          stroke="url(#adminCompletionRing)"
          strokeWidth="12"
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeOffset}
          transform="rotate(-90 66 66)"
        />
      </svg>
      <div style={styles.ringCenter}>
        <strong style={styles.ringValue}>{formatPercent(safeValue)}</strong>
        <span style={styles.ringLabel}>{label}</span>
      </div>
    </div>
  );
}

export function StatCard({ title, value, icon, trend, color = "default", styles }) {
  const cardStyle =
    color === "success"
      ? styles.statCardSuccess
      : color === "warning"
        ? styles.statCardWarning
        : styles.insightStatCard;

  return (
    <article style={cardStyle}>
      <div style={styles.metricIconRow}>
        <span style={styles.metricEmoji} aria-hidden="true">
          {icon}
        </span>
        <span style={styles.metricLabel}>{title}</span>
      </div>
      <strong style={styles.metricValue}>{value}</strong>
      {trend ? <span style={styles.metricCaption}>{trend}</span> : null}
    </article>
  );
}

export function AdminInsights({ insights, styles }) {
  const totalChecklistItems = insights?.total_checklist_items ?? insights?.total_items ?? 0;
  const totalPendingItems = insights?.total_pending_items ?? insights?.pending_items ?? 0;
  const totalCompletedItems = insights?.total_completed_items ?? insights?.completed_items ?? 0;
  const avgCompletionRate = insights?.avg_completion_rate ?? insights?.item_completion_rate ?? 0;
  const pendingPercentage = totalChecklistItems ? (totalPendingItems / totalChecklistItems) * 100 : 0;
  const completedPercentage = totalChecklistItems ? (totalCompletedItems / totalChecklistItems) * 100 : 0;

  return (
    <section style={styles.section} className="admin-surface">
      <div style={styles.sectionAccent} />
      <div style={styles.sectionHeader}>
        <div>
          <h2 style={styles.sectionTitle}>System Insights</h2>
          <span style={styles.sectionMeta}>Live admin-wide performance snapshot</span>
        </div>
      </div>
      <div style={styles.insightsGrid}>
        <StatCard
          title="Total Users"
          value={insights.total_users}
          icon="??"
          trend={`${insights.active_users} active · ${insights.inactive_users} archived`}
          styles={styles}
        />
        <StatCard
          title="Total Checklist Items"
          value={totalChecklistItems}
          icon="??"
          trend="Across all active user checklists"
          styles={styles}
        />
        <StatCard
          title="Pending Items"
          value={totalPendingItems}
          icon="?"
          trend={`${formatPercent(pendingPercentage)} of all checklist items`}
          color="warning"
          styles={styles}
        />
        <StatCard
          title="Completed Items"
          value={totalCompletedItems}
          icon="?"
          trend={`${formatPercent(completedPercentage)} of all checklist items`}
          color="success"
          styles={styles}
        />
        <article style={styles.ringCard}>
          <div style={styles.sectionHeader}>
            <div>
              <h3 style={styles.cardTitle}>Average Completion Rate</h3>
              <span style={styles.sectionMeta}>Average across all users</span>
            </div>
          </div>
          <ProgressRing value={avgCompletionRate} label="Avg complete" styles={styles} />
        </article>
      </div>
    </section>
  );
}

export function AdminFilters({
  filters,
  onFilterChange,
  type,
  styles,
  checklistTypes = [],
  priorityOptions = [],
}) {
  if (type === "users") {
    return (
      <div style={styles.filterGrid}>
        <div style={styles.modalField}>
          <label htmlFor="admin-user-search" style={styles.modalLabel}>
            Search Users
          </label>
          <input
            id="admin-user-search"
            name="search"
            value={filters.search}
            onChange={onFilterChange}
            placeholder="Search by email or username"
            style={styles.input}
            className="admin-input"
          />
        </div>
        <div style={styles.modalField}>
          <label htmlFor="admin-user-role" style={styles.modalLabel}>
            Role
          </label>
          <select
            id="admin-user-role"
            name="role"
            value={filters.role}
            onChange={onFilterChange}
            style={styles.select}
            className="admin-input"
          >
            <option value="">All roles</option>
            <option value="admin">Admin</option>
            <option value="member">Member</option>
          </select>
        </div>
        <div style={styles.modalField}>
          <label htmlFor="admin-user-status" style={styles.modalLabel}>
            Status
          </label>
          <select
            id="admin-user-status"
            name="status"
            value={filters.status}
            onChange={onFilterChange}
            style={styles.select}
            className="admin-input"
          >
            <option value="">All users</option>
            <option value="active">Active</option>
            <option value="inactive">Archived</option>
          </select>
        </div>
      </div>
    );
  }

  if (type === "checklists") {
    return (
      <div style={styles.filterGrid}>
        <div style={styles.modalField}>
          <label htmlFor="admin-checklist-search" style={styles.modalLabel}>
            Search Checklists
          </label>
          <input
            id="admin-checklist-search"
            name="search"
            value={filters.search}
            onChange={onFilterChange}
            placeholder="Search by name or creator"
            style={styles.input}
            className="admin-input"
          />
        </div>
        <div style={styles.modalField}>
          <label htmlFor="admin-checklist-filter-type" style={styles.modalLabel}>
            Type
          </label>
          <select
            id="admin-checklist-filter-type"
            name="type"
            value={filters.type}
            onChange={onFilterChange}
            style={styles.select}
            className="admin-input"
          >
            <option value="">All types</option>
            {checklistTypes.map((checklistType) => (
              <option key={checklistType} value={checklistType}>
                {checklistType}
              </option>
            ))}
          </select>
        </div>
        <div style={styles.modalField}>
          <label htmlFor="admin-checklist-creator" style={styles.modalLabel}>
            Creator
          </label>
          <input
            id="admin-checklist-creator"
            name="creator"
            value={filters.creator}
            onChange={onFilterChange}
            placeholder="Filter by creator email"
            style={styles.input}
            className="admin-input"
          />
        </div>
        <div style={styles.modalField}>
          <label htmlFor="admin-checklist-date-from" style={styles.modalLabel}>
            Created From
          </label>
          <input
            id="admin-checklist-date-from"
            type="date"
            name="date_from"
            value={filters.date_from}
            onChange={onFilterChange}
            style={styles.input}
            className="admin-input"
          />
        </div>
        <div style={styles.modalField}>
          <label htmlFor="admin-checklist-date-to" style={styles.modalLabel}>
            Created To
          </label>
          <input
            id="admin-checklist-date-to"
            type="date"
            name="date_to"
            value={filters.date_to}
            onChange={onFilterChange}
            style={styles.input}
            className="admin-input"
          />
        </div>
      </div>
    );
  }

  return (
    <div style={styles.filterGrid}>
      <div style={styles.modalField}>
        <label htmlFor="admin-item-search" style={styles.modalLabel}>
          Search Items
        </label>
        <input
          id="admin-item-search"
          name="search"
          value={filters.search}
          onChange={onFilterChange}
          placeholder="Search by label or type"
          style={styles.input}
          className="admin-input"
        />
      </div>
      <div style={styles.modalField}>
        <label htmlFor="admin-item-type-filter" style={styles.modalLabel}>
          Type
        </label>
        <input
          id="admin-item-type-filter"
          name="type"
          value={filters.type}
          onChange={onFilterChange}
          placeholder="Task, Habit, Reminder..."
          style={styles.input}
          className="admin-input"
        />
      </div>
      <div style={styles.modalField}>
        <label htmlFor="admin-item-status-filter" style={styles.modalLabel}>
          Status
        </label>
        <select
          id="admin-item-status-filter"
          name="status"
          value={filters.status}
          onChange={onFilterChange}
          style={styles.select}
          className="admin-input"
        >
          <option value="">All statuses</option>
          <option value="completed">Completed</option>
          <option value="pending">Pending</option>
        </select>
      </div>
      <div style={styles.modalField}>
        <label htmlFor="admin-item-priority-filter" style={styles.modalLabel}>
          Priority
        </label>
        <select
          id="admin-item-priority-filter"
          name="priority"
          value={filters.priority}
          onChange={onFilterChange}
          style={styles.select}
          className="admin-input"
        >
          <option value="">All priorities</option>
          {priorityOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div style={styles.modalField}>
        <label htmlFor="admin-item-date-from" style={styles.modalLabel}>
          Created From
        </label>
        <input
          id="admin-item-date-from"
          type="date"
          name="date_from"
          value={filters.date_from}
          onChange={onFilterChange}
          style={styles.input}
          className="admin-input"
        />
      </div>
      <div style={styles.modalField}>
        <label htmlFor="admin-item-date-to" style={styles.modalLabel}>
          Created To
        </label>
        <input
          id="admin-item-date-to"
          type="date"
          name="date_to"
          value={filters.date_to}
          onChange={onFilterChange}
          style={styles.input}
          className="admin-input"
        />
      </div>
    </div>
  );
}

export function UserDetailCard({
  user,
  onPromoteDemote,
  onArchiveReactivate,
  onViewActivity,
  updatingUserId,
  styles,
}) {
  return (
    <article style={styles.userStatsCard} className="admin-interactive-card">
      <div style={styles.userTopRow}>
        <img src={user.avatar_url} alt={`${user.email} avatar`} style={styles.avatar} />
        <div style={styles.userIdentity}>
          <h3 style={styles.userEmail}>{user.email}</h3>
          <p style={styles.userRole}>{user.is_admin ? "Admin" : "Member"}</p>
        </div>
        <span style={styles.userCompletionPill}>{user.completion_rate}%</span>
      </div>
      <div style={styles.actions}>
        <button
          type="button"
          onClick={() => onPromoteDemote(user)}
          disabled={updatingUserId === user.id}
          style={styles.secondaryButton}
          className="admin-btn admin-secondary-btn"
        >
          {updatingUserId === user.id
            ? "Saving..."
            : user.is_admin
              ? "Make Member"
              : "Make Admin"}
        </button>
        <button
          type="button"
          onClick={() => onArchiveReactivate(user)}
          disabled={updatingUserId === user.id}
          style={user.is_active ? styles.deleteGhostButton : styles.primaryButton}
          className={`admin-btn ${user.is_active ? "admin-danger-ghost-btn" : "admin-primary-btn"}`}
        >
          {updatingUserId === user.id
            ? "Saving..."
            : user.is_active
              ? "Archive User"
              : "Reactivate User"}
        </button>
        <button
          type="button"
          onClick={() => onViewActivity(user)}
          style={styles.ghostButton}
          className="admin-btn admin-ghost-btn"
        >
          View Activity
        </button>
      </div>
      <div style={styles.metricGrid}>
        <div style={styles.metricCard}>
          <span style={styles.metricLabel}>Checklists</span>
          <strong style={styles.metricValue}>{user.total_checklists}</strong>
        </div>
        <div style={styles.metricCard}>
          <span style={styles.metricLabel}>Completed</span>
          <strong style={styles.metricValue}>{user.completed_checklists}</strong>
        </div>
        <div style={styles.metricCard}>
          <span style={styles.metricLabel}>Pending</span>
          <strong style={styles.metricValue}>{user.pending_checklists}</strong>
        </div>
        <div style={styles.metricCard}>
          <span style={styles.metricLabel}>Completion</span>
          <strong style={styles.metricValue}>{user.completion_rate}%</strong>
        </div>
        <div style={styles.metricCard}>
          <span style={styles.metricLabel}>Completed Items</span>
          <strong style={styles.metricValue}>{user.completed_items || 0}</strong>
        </div>
        <div style={styles.metricCard}>
          <span style={styles.metricLabel}>Last Login</span>
          <strong style={styles.metricValueSmall}>
            {user.last_login_at ? new Date(user.last_login_at).toLocaleDateString() : "No logins yet"}
          </strong>
        </div>
      </div>
      <div style={styles.userItemProgressBlock}>
        <div style={styles.progressHeaderRow}>
          <span style={styles.metricLabel}>Checklist Item Progress</span>
          <strong style={styles.progressCountText}>
            Completed {user.completed_items || 0} / {user.total_items || 0} total items
          </strong>
        </div>
        <div style={styles.progressTrack}>
          <div style={styles.progressFill(user.completion_rate || 0)} />
        </div>
      </div>
    </article>
  );
}

export function AdminUsersList({ users, selectedUserId, onSelectUser, styles }) {
  return (
    <section style={styles.userRail} className="admin-surface">
      <div style={styles.userList}>
        {users.map((user) => (
          <article
            key={user.id}
            style={styles.userCard(String(selectedUserId) === String(user.id))}
            className="admin-interactive-card"
            onClick={() => onSelectUser(user)}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelectUser(user);
              }
            }}
          >
            <div style={styles.userTopRow}>
              <img src={user.avatar_url} alt={`${user.email} avatar`} style={styles.avatar} />
              <div style={styles.userIdentity}>
                <h3 style={styles.userEmail}>{user.email}</h3>
                <p style={styles.userRole}>{user.is_admin ? "Admin" : "Member"}</p>
              </div>
              <span style={styles.userCompletionPill}>{user.completion_rate}%</span>
            </div>
            <div style={styles.userMiniStats}>
              <span>{user.total_checklists} checklists</span>
              <span>{user.pending_checklists} pending</span>
            </div>
            <div style={styles.userMiniProgressBlock}>
              <span style={styles.userMiniProgressText}>
                Completed {user.completed_items || 0} / {user.total_items || 0} total items
              </span>
              <div style={styles.progressTrackSmall}>
                <div style={styles.progressFill(user.completion_rate || 0)} />
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function AdminChecklistsList({
  checklists,
  selectedChecklistId,
  userId,
  userEmail,
  onSelectChecklist,
  onEditChecklist,
  onDeleteChecklist,
  onCreateChecklist,
  styles,
  defaultChecklistImage,
}) {
  return (
    <section style={styles.section} className="admin-surface">
      <div style={styles.sectionAccent} />
      <div style={styles.sectionHeader}>
        <div>
          <h2 style={styles.sectionTitle}>{userEmail} Checklists</h2>
          <span style={styles.sectionMeta}>{checklists.length} active</span>
        </div>
        <button
          type="button"
          onClick={onCreateChecklist}
          disabled={!userId}
          style={styles.primaryButton}
          className="admin-btn admin-primary-btn"
        >
          Add New Checklist
        </button>
      </div>
      <div style={styles.checklistList}>
        {checklists.length === 0 ? (
          <p style={styles.emptyText}>This user has no checklists yet.</p>
        ) : (
          checklists.map((checklist) => (
            <article
              key={checklist.id}
              style={styles.checklistCard(String(selectedChecklistId) === String(checklist.id))}
              className="admin-interactive-card"
              onClick={() => onSelectChecklist(checklist.id)}
            >
              <div style={styles.checklistInfo}>
                <div style={styles.checklistTopRow}>
                  <img
                    src={checklist.image_url || defaultChecklistImage}
                    alt={`${checklist.name} cover`}
                    style={styles.checklistImage}
                  />
                  <div style={styles.checklistBody}>
                    <div style={styles.checklistHeadingRow}>
                      <h3 style={styles.checklistName}>{checklist.name}</h3>
                      <span style={styles.checklistType}>{checklist.type}</span>
                    </div>
                    <div style={styles.checklistStats}>
                      <span>Label: {checklist.name}</span>
                      <span>Total items: {checklist.total_items}</span>
                      <span>Completed: {checklist.completed_items}</span>
                      <span>Pending: {checklist.pending_items}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div style={styles.actions}>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onEditChecklist(checklist);
                  }}
                  style={styles.secondaryButton}
                  className="admin-btn admin-secondary-btn"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onDeleteChecklist(checklist);
                  }}
                  style={styles.deleteButton}
                  className="admin-btn admin-danger-btn"
                >
                  Delete
                </button>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

export function AdminItemsList({
  items,
  selectedChecklist,
  onToggleItem,
  onEditItem,
  onDeleteItem,
  onCreateItem,
  loading,
  styles,
}) {
  return (
    <section style={styles.section} className="admin-surface">
      <div style={styles.sectionAccent} />
      <div style={styles.sectionHeader}>
        <div>
          <h2 style={styles.sectionTitle}>Items for {selectedChecklist.name}</h2>
          <span style={styles.sectionMeta}>{items.length} items · click a checklist card to switch</span>
        </div>
        <button
          type="button"
          onClick={onCreateItem}
          style={styles.primaryButton}
          className="admin-btn admin-primary-btn"
        >
          Add Item
        </button>
      </div>
      {loading ? (
        <p style={styles.emptyText}>Loading items...</p>
      ) : items.length === 0 ? (
        <p style={styles.emptyText}>No items for this checklist yet.</p>
      ) : (
        <div style={styles.itemList}>
          {items.map((item) => (
            <article key={item.id} style={styles.itemCard} className="admin-interactive-card">
              <div style={styles.itemInfo}>
                <div style={styles.itemHeadingRow}>
                  <h3 style={styles.itemName}>{item.label}</h3>
                  <span style={styles.checklistType}>{item.type}</span>
                </div>
                <div style={styles.itemStatsRow}>
                  <span style={styles.statusPill(item.is_completed)}>
                    {item.is_completed ? "Completed" : "Pending"}
                  </span>
                  <span style={styles.metaPill}>{item.due_date || "No due date"}</span>
                  <span style={styles.metaPill}>{item.priority_label || item.priority}</span>
                </div>
              </div>
              <div style={styles.actions}>
                <label style={styles.checkboxAction}>
                  <input
                    type="checkbox"
                    checked={Boolean(item.is_completed)}
                    onChange={() => onToggleItem(item)}
                  />
                  <span>{item.is_completed ? "Complete" : "Mark Complete"}</span>
                </label>
                <button
                  type="button"
                  onClick={() => onEditItem(item)}
                  style={styles.secondaryButton}
                  className="admin-btn admin-secondary-btn"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteItem(item)}
                  style={styles.deleteButton}
                  className="admin-btn admin-danger-btn"
                >
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

