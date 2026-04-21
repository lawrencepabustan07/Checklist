import { describe, expect, it, vi } from "vitest";

const { createMock, postMock } = vi.hoisted(() => {
  const postMock = vi.fn();
  return {
    postMock,
    createMock: vi.fn(() => ({ post: postMock })),
  };
});

vi.mock("axios", () => ({
  default: {
    create: (...args) => createMock(...args),
  },
}));

import { register } from "./api";

describe("auth api", () => {
  it("creates the axios client with the expected auth base URL", () => {
    expect(createMock).toHaveBeenCalledWith({
      baseURL: "http://127.0.0.1:8000/api/auth",
      headers: {
        "Content-Type": "application/json",
      },
    });
  });

  it("posts the auth0 credential payload during register", async () => {
    postMock.mockResolvedValueOnce({ data: { ok: true } });

    await register("clean-token");

    expect(postMock).toHaveBeenCalledWith("/register/", {
      method: "auth0",
      credential: "clean-token",
    });
  });
});
