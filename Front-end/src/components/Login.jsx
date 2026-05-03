export default function Login() {

  function handleGoogleLogin() {
    const domain = import.meta.env.VITE_AUTH0_DOMAIN;
    const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID;
    const redirectUri = encodeURIComponent("http://localhost:5173/callback");

    // Redirect to Auth0's login page
    window.location.href = `https://${domain}/authorize?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}&scope=openid%20profile%20email&connection=google-oauth2`;
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.orb} />
        <div style={styles.header}>
          <p style={styles.kicker}>Checklist</p>
          <h1 style={styles.title}>Sign in to continue</h1>
          <p style={styles.subtitle}>
            Use your Google account to open your checklist workspace.
          </p>
        </div>

        <button
          onClick={handleGoogleLogin}
          style={styles.googleButton}
        >
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
          Continue with Google
        </button>

        <p style={styles.footnote}>
          Your checklist access is based on the account role attached to your sign-in.
        </p>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: "100vh",
    background:
      "radial-gradient(circle at top, rgba(14, 165, 233, 0.2), transparent 24%), radial-gradient(circle at bottom right, rgba(16, 185, 129, 0.18), transparent 22%), linear-gradient(180deg, #f8fafc 0%, #eef6ff 100%)",
    fontFamily: '"Segoe UI", "Trebuchet MS", sans-serif',
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px",
  },
  card: {
    position: "relative",
    background: "rgba(255,255,255,0.92)",
    backdropFilter: "blur(10px)",
    borderRadius: "32px",
    padding: "56px 36px 42px",
    width: "100%",
    maxWidth: "460px",
    boxShadow: "0 28px 70px rgba(15, 23, 42, 0.12)",
    animation: "fadeInUp 0.5s ease-out",
    border: "1px solid rgba(226,232,240,0.9)",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
  },
  orb: {
    position: "absolute",
    top: "18px",
    right: "18px",
    width: "74px",
    height: "74px",
    borderRadius: "50%",
    background:
      "radial-gradient(circle at 30% 30%, rgba(255,255,255,0.95), rgba(14,165,233,0.22) 45%, rgba(16,185,129,0.18) 100%)",
    border: "1px solid rgba(125, 211, 252, 0.4)",
  },
  header: {
    marginBottom: "28px",
  },
  kicker: {
    margin: 0,
    fontSize: "12px",
    color: "#0f766e",
    textTransform: "uppercase",
    letterSpacing: "0.16em",
    fontWeight: 800,
  },
  title: {
    fontSize: "38px",
    lineHeight: 1.1,
    fontWeight: 800,
    margin: "12px 0 10px",
    color: "#0f172a",
  },
  subtitle: {
    fontSize: "15px",
    color: "#475569",
    margin: 0,
  },
  googleButton: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    padding: "14px",
    fontSize: "15px",
    fontWeight: 700,
    backgroundColor: "#ffffff",
    color: "#0f172a",
    border: "1.5px solid #cbd5e1",
    borderRadius: "16px",
    cursor: "pointer",
    transition: "all 0.2s",
  },
  footnote: {
    margin: "18px 0 0",
    color: "#64748b",
    fontSize: "13px",
    lineHeight: 1.6,
  },
};


/* v8 ignore next -- DOM-only style injection */
if (typeof document !== "undefined") {
  const styleSheet = document.createElement("style");
  styleSheet.textContent = `
    @keyframes fadeInUp {
      from {
        opacity: 0;
        transform: translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    
    button:hover {
      transform: translateY(-1px);
    }

    @media (max-width: 900px) {
      button:hover {
        transform: none;
      }
    }
  `;
  document.head.appendChild(styleSheet);
}
