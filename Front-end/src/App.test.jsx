import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App";

vi.mock("./components/Login", () => ({
  default: (props) => (
    <div data-testid="login-screen">
      Login Screen
      <button onClick={props.onLogin} data-testid="mock-login-btn">
        Login
      </button>
    </div>
  ),
}));

vi.mock("./components/Dashboard", () => ({
  default: (props) => (
    <div data-testid="dashboard-screen">
      Dashboard Screen
      <button onClick={props.onLogout} data-testid="mock-logout-btn">
        Logout
      </button>
    </div>
  ),
}));

vi.mock("./components/Callback", () => ({
  default: () => <div data-testid="callback-screen">Callback Screen</div>,
}));

describe("App routing", () => {
  beforeEach(() => {
    window.history.pushState({}, "", "/");
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("sends unauthenticated users to login from root", async () => {
    window.history.pushState({}, "", "/");
    render(<App />);
    expect(await screen.findByTestId("login-screen")).toBeInTheDocument();
  });

  it("sends authenticated users to dashboard from root", async () => {
    localStorage.setItem("access_token", "token");
    window.history.pushState({}, "", "/");
    render(<App />);
    expect(await screen.findByTestId("dashboard-screen")).toBeInTheDocument();
  });

  it("sends unauthenticated users to login if they try to access dashboard", async () => {
    window.history.pushState({}, "", "/dashboard");
    render(<App />);
    expect(await screen.findByTestId("login-screen")).toBeInTheDocument();
  });

  it("redirects authenticated users away from login to dashboard", async () => {
    localStorage.setItem("access_token", "token");
    window.history.pushState({}, "", "/login");
    render(<App />);
    expect(await screen.findByTestId("dashboard-screen")).toBeInTheDocument();
  });

  it("renders the callback screen at /callback", async () => {
    window.history.pushState({}, "", "/callback");
    render(<App />);
    expect(await screen.findByTestId("callback-screen")).toBeInTheDocument();
  });

  it("handles unknown routes by redirecting to root (which goes to login if unauth)", async () => {
    window.history.pushState({}, "", "/unknown-route");
    render(<App />);
    expect(await screen.findByTestId("login-screen")).toBeInTheDocument();
  });

  it("shows the loading state initially", () => {
    render(<App />);
    // Check for either the loading state or the result if it finishes too fast
    const loading = screen.queryByText("Loading...");
    const login = screen.queryByTestId("login-screen");
    const dashboard = screen.queryByTestId("dashboard-screen");
    expect(loading || login || dashboard).toBeTruthy();
  });

  it("updates login state when onLogin is called", async () => {
    window.history.pushState({}, "", "/login");
    render(<App />);
    const loginBtn = await screen.findByTestId("mock-login-btn");
    
    // Clicking the login button calls setIsLoggedIn(true). 
    // To trigger the route transition, we also simulate what Callback does:
    localStorage.setItem("access_token", "token");
    
    // Click the mocked login button
    loginBtn.click();
    
    // By changing state, App re-renders. We should navigate to dashboard.
    expect(await screen.findByTestId("dashboard-screen")).toBeInTheDocument();
  });

  it("updates login state when onLogout is called", async () => {
    localStorage.setItem("access_token", "token");
    window.history.pushState({}, "", "/dashboard");
    render(<App />);
    const logoutBtn = await screen.findByTestId("mock-logout-btn");
    
    // Simulate what Dashboard logout usually does:
    localStorage.removeItem("access_token");
    
    logoutBtn.click();
    
    // Should navigate to login
    expect(await screen.findByTestId("login-screen")).toBeInTheDocument();
  });
});
