import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./authPkce", () => ({
  preparePkce: vi.fn().mockResolvedValue({ challenge: "pkce-challenge" }),
}));

import Login from "./Login";

describe("Login", () => {
  let locationMock;

  beforeEach(() => {
    vi.stubEnv("VITE_AUTH0_DOMAIN", "auth.example.com");
    vi.stubEnv("VITE_AUTH0_CLIENT_ID", "client-123");
    locationMock = {
      href: "http://localhost:5173/login",
      origin: "http://localhost:5173",
    };
    Object.defineProperty(window, "location", {
      configurable: true,
      writable: true,
      value: locationMock,
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("renders the login CTA", () => {
    render(
      <MemoryRouter>
        <Login onLogin={vi.fn()} />
      </MemoryRouter>,
    );

    expect(screen.getByText("Sign in to continue")).toBeInTheDocument();
    expect(screen.getByText("Use your Google account to open your checklist workspace.")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Continue with Google/i }),
    ).toBeInTheDocument();
  });

  it("redirects to the Auth0 authorize URL when Google sign-in is clicked", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <Login onLogin={vi.fn()} />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: /Continue with Google/i }));

    expect(window.location.href).toBe(
      "https://auth.example.com/authorize?response_type=code&client_id=client-123&redirect_uri=http%3A%2F%2Flocalhost%3A5173%2Fcallback&scope=openid%20profile%20email&connection=google-oauth2&code_challenge=pkce-challenge&code_challenge_method=S256",
    );
  });
});
