import { describe, expect, it, vi, beforeEach } from "vitest";

const { mockApi } = vi.hoisted(() => ({
  mockApi: {
    create: vi.fn(() => ({
      interceptors: { request: { use: vi.fn() } },
    })),
  },
}));

vi.mock("axios", () => ({
  default: {
    create: mockApi.create,
  },
}));

import {
  attachAuthHeader,
  buildChecklistFormData,
  buildItemQuery,
  createEmptyAnalytics,
  getDueBadge,
  getChecklistImageUrl,
  getPriorityMeta,
  moveItem,
  normaliseCollection,
  resolveTheme,
  validateImageFile,
} from "./dashboardHelpers";

describe("Dashboard helpers", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("adds the bearer token when present", () => {
    localStorage.setItem("access_token", "token-123");
    const config = { headers: {} };

    const result = attachAuthHeader(config);

    expect(result.headers.Authorization).toBe("Bearer token-123");
  });

  it("leaves headers unchanged when no bearer token exists", () => {
    const config = { headers: {} };

    const result = attachAuthHeader(config);

    expect(result.headers.Authorization).toBeUndefined();
  });

  it("returns an empty validation message when no file is provided", () => {
    expect(validateImageFile(undefined)).toBe("");
  });

  it("builds checklist form data with remove_image when requested", () => {
    const formData = buildChecklistFormData({
      name: "Trip Prep",
      type: "Weekly",
      image: null,
      removeImage: true,
    });

    expect(formData.get("name")).toBe("Trip Prep");
    expect(formData.get("type")).toBe("Weekly");
    expect(formData.get("remove_image")).toBe("true");
  });

  it("returns the default checklist image when no image or preview exists", () => {
    expect(getChecklistImageUrl(null)).toContain("default-checklist.svg");
  });

  it("returns the original list when moveItem gets invalid indices", () => {
    const items = [{ id: "1" }, { id: "2" }];

    expect(moveItem(items, "missing", "2")).toBe(items);
    expect(moveItem(items, "1", "1")).toBe(items);
  });

  it("returns priority metadata for known priorities", () => {
    expect(getPriorityMeta("high")).toMatchObject({
      value: "high",
      label: "High",
    });
  });

  it("returns an overdue badge for past due dates", () => {
    expect(getDueBadge("2000-01-01")).toMatchObject({
      label: "Overdue",
      tone: "danger",
    });
  });

  it("returns a due-today badge for today's date", () => {
    const today = new Date().toISOString().slice(0, 10);
    expect(getDueBadge(today)).toMatchObject({
      label: "Due Today",
      tone: "warning",
    });
  });

  it("returns a neutral badge for a future date", () => {
    expect(getDueBadge("2099-01-01")).toMatchObject({
      tone: "neutral",
    });
  });

  it("returns null when there is no due date", () => {
    expect(getDueBadge("")).toBeNull();
  });

  it("falls back to the none priority metadata", () => {
    expect(getPriorityMeta("unknown")).toMatchObject({
      value: "none",
      label: "None",
    });
  });

  it("rejects unsupported image types", () => {
    const file = new File(["gif"], "bad.gif", { type: "image/gif" });
    expect(validateImageFile(file)).toMatch(/Only JPG/i);
  });

  it("rejects files larger than 2MB", () => {
    const bigContent = new Uint8Array(3 * 1024 * 1024);
    const file = new File([bigContent], "big.png", { type: "image/png" });
    expect(validateImageFile(file)).toMatch(/2MB or smaller/i);
  });

  it("accepts valid image files", () => {
    const file = new File(["img"], "ok.png", { type: "image/png" });
    expect(validateImageFile(file)).toBe("");
  });

  it("includes image in checklist form data when provided", () => {
    const file = new File(["img"], "cover.png", { type: "image/png" });
    const formData = buildChecklistFormData({
      name: "Trip Prep",
      type: "Weekly",
      image: file,
      removeImage: false,
    });

    expect(formData.get("image")).toBe(file);
  });

  it("returns preview URL before checklist image URL", () => {
    expect(
      getChecklistImageUrl({ image_url: "http://server/image.png" }, "blob:preview"),
    ).toBe("blob:preview");
  });

  it("reorders items and recalculates positions", () => {
    const items = [
      { id: "1", position: 1 },
      { id: "2", position: 2 },
      { id: "3", position: 3 },
    ];

    expect(moveItem(items, "3", "1")).toEqual([
      { id: "3", position: 1 },
      { id: "1", position: 2 },
      { id: "2", position: 3 },
    ]);
  });

  it("normalises API collections from nested, results, and raw data shapes", () => {
    expect(normaliseCollection({ data: { data: [1, 2] } })).toEqual([1, 2]);
    expect(normaliseCollection({ data: { results: [3] } })).toEqual([3]);
    expect(normaliseCollection({ data: [4] })).toEqual([4]);
  });

  it("builds item queries with and without optional filters", () => {
    expect(buildItemQuery("priority", "desc", "high", "pending")).toContain(
      "priority=high",
    );
    expect(buildItemQuery("position", "asc", "all", "all")).toBe(
      "sort_by=position&direction=asc",
    );
  });

  it("resolves themes for system, explicit contrast, and fallback cases", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("contrast", false)).toBe("contrast");
    expect(resolveTheme("", false)).toBe("light");
  });

  it("creates an empty analytics object with expected defaults", () => {
    expect(createEmptyAnalytics()).toMatchObject({
      total_items: 0,
      completed_items: 0,
      pending_items: 0,
      best_day: null,
      heatmap: {},
    });
    expect(createEmptyAnalytics()).not.toHaveProperty("weekly_activity");
  });
});
