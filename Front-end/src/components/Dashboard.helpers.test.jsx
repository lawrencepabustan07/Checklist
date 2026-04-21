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
  getChecklistImageUrl,
  moveItem,
  validateImageFile,
} from "./Dashboard";

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
});
