import { StrictMode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const navigateMock = vi.fn();
const registerMock = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock("../services/api", () => ({
  register: (...args) => registerMock(...args),
}));

import Callback from "./Callback";

describe("Callback", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    registerMock.mockReset();
    localStorage.clear();
    vi.stubEnv("VITE_AUTH0_CLIENT_ID", "client-123");
    vi.stubEnv("VITE_AUTH0_CLIENT_SECRET", "secret-456");
  });

  it("shows an error and redirects to login when no authorization code is present", async () => {
    window.history.pushState({}, "", "/callback");

    render(
      <MemoryRouter>
        <Callback />
      </MemoryRouter>,
    );

    expect(await screen.findByText("No authorization code received")).toBeInTheDocument();

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith("/login");
    }, { timeout: 4000 });
  });

  it("stores auth data and navigates to dashboard on successful callback", async () => {
    window.history.pushState({}, "", "/callback?code=abc123");
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: " external-token " }),
    });
    registerMock.mockResolvedValue({
      data: {
        access_token: "internal-token",
        email: "lawrence@example.com",
      },
    });

    render(
      <MemoryRouter>
        <Callback />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(registerMock).toHaveBeenCalledWith("external-token");
    });

    expect(localStorage.getItem("access_token")).toBe("internal-token");
    expect(localStorage.getItem("email")).toBe("lawrence@example.com");
    expect(navigateMock).toHaveBeenCalledWith("/dashboard");
  });

  it("shows fetch/register errors and redirects back to login", async () => {
    window.history.pushState({}, "", "/callback?code=bad-code");
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error_description: "Token exchange failed hard" }),
    });

    render(
      <MemoryRouter>
        <Callback />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Token exchange failed hard")).toBeInTheDocument();

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith("/login");
    }, { timeout: 4000 });
  });

  it("falls back to the default token exchange error message", async () => {
    window.history.pushState({}, "", "/callback?code=bad-code");
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({}),
    });

    render(
      <MemoryRouter>
        <Callback />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Token exchange failed")).toBeInTheDocument();
  });

  it("runs the callback flow only once in StrictMode", async () => {
    window.history.pushState({}, "", "/callback?code=abc123");
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: " external-token " }),
    });
    registerMock.mockResolvedValue({
      data: {
        access_token: "internal-token",
        email: "lawrence@example.com",
      },
    });

    render(
      <StrictMode>
        <MemoryRouter>
          <Callback />
        </MemoryRouter>
      </StrictMode>,
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });
});
