import { useState } from "react";

const API_BASE = "http://127.0.0.1:8000/api/auth";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`${API_BASE}/login/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "Login failed");
        return;
      }

      const regRes = await fetch(`${API_BASE}/register/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method: "auth0",
          credential: data.data.access_token,
        }),
      });

      const regData = await regRes.json();

      if (!regRes.ok) {
        setError(regData.message || "Registration failed");
        return;
      }

      localStorage.setItem("access_token", regData.access_token);
      localStorage.setItem("email", regData.email);

      alert(`Welcome, ${regData.email}`);
    } catch (err) {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleGoogle() {
    const domain = "dev-zg54pxgt5z5cithx.us.auth0.com";
    const clientId = "7gZpLBI7a7nGsM11zRczrJBZja3dz41d";
    const redirectUri = encodeURIComponent("http://localhost:5173/callback");
    const audience = encodeURIComponent("https://checklist-api.com");
    window.location.href = `https://${domain}/authorize?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}&scope=openid%20profile%20email&connection=google-oauth2&audience=${audience}`;
  }

  return (
    <div style={styles.container}>
      <div style={styles.overlay}>
        <div style={styles.card}>
          <div style={styles.header}>
            <h1 style={styles.title}>Welcome</h1>
            <p style={styles.subtitle}>Sign in to continue to Checklist App</p>
          </div>

          {error && <div style={styles.error}>{error}</div>}

          <form onSubmit={handleLogin} style={styles.form}>
            <div style={styles.field}>
              <label style={styles.label}>Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                style={styles.input}
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                style={styles.input}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                ...styles.button,
                opacity: loading ? 0.7 : 1,
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <div style={styles.dividerRow}>
            <div style={styles.dividerLine} />
            <span style={styles.dividerText}>or continue with</span>
            <div style={styles.dividerLine} />
          </div>

          <button onClick={handleGoogle} style={styles.googleButton}>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              style={{ marginRight: 8 }}
            >
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Google
          </button>

          <p style={styles.footer}>
            Don't have an account?{" "}
            <a href="/register" style={styles.link}>
              Sign up
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: "100%",
    height: "100%",
    background: "linear-gradient(135deg, #050608 0%, #d2bfe6 100%)",
  },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backdropFilter: "blur(8px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    backgroundColor: "white",
    borderRadius: 24,
    padding: "40px",
    width: "100%",
    maxWidth: 440,
    boxShadow: "0 20px 35px rgba(0, 0, 0, 0.2)",
    margin: "20px",
  },
  header: {
    textAlign: "center",
    marginBottom: "32px",
  },
  title: {
    fontSize: 32,
    fontWeight: 600,
    margin: "0 0 8px",
    color: "#1a1a1a",
  },
  subtitle: {
    fontSize: 14,
    color: "#666",
    margin: 0,
  },
  error: {
    backgroundColor: "#fee2e2",
    color: "#dc2626",
    fontSize: 13,
    padding: "12px 16px",
    borderRadius: 12,
    marginBottom: "20px",
    border: "1px solid #fecaca",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: 20,
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: 500,
    color: "#333",
  },
  input: {
    padding: "12px 14px",
    fontSize: 14,
    border: "1px solid #d1d5db",
    borderRadius: 12,
    outline: "none",
    backgroundColor: "#fff",
    color: "#1a1a1a",
    fontWeight: "normal",
    transition: "all 0.2s",
  },
  button: {
    marginTop: 8,
    padding: "12px",
    fontSize: 15,
    fontWeight: 600,
    backgroundColor: "#1a1a1a",
    color: "#fff",
    border: "none",
    borderRadius: 12,
    width: "100%",
  },
  dividerRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    margin: "24px 0 20px",
  },
  dividerLine: {
    flex: 1,
    height: "1px",
    backgroundColor: "#e5e7eb",
  },
  dividerText: {
    fontSize: 12,
    color: "#9ca3af",
  },
  googleButton: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    padding: "12px",
    fontSize: 14,
    fontWeight: 500,
    backgroundColor: "#fff",
    color: "#333",
    border: "1px solid #d1d5db",
    borderRadius: 12,
    cursor: "pointer",
    transition: "all 0.2s",
  },
  footer: {
    textAlign: "center",
    fontSize: 13,
    color: "#666",
    marginTop: 24,
    marginBottom: 0,
  },
  link: {
    color: "#2563eb",
    textDecoration: "none",
    fontWeight: 500,
  },
};
