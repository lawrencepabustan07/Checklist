import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { register } from "../services/api";
import { clearStoredCodeVerifier, getStoredCodeVerifier } from "./authPkce";
import { setAccessToken } from "../services/authStorage";

export default function Callback() {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const called = useRef(false);

  useEffect(() => {
    if (called.current) {
      return;
    }
    called.current = true;
    async function handleCallback() {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get("code");
      const verifier = getStoredCodeVerifier();

      if (!code) {
        setError("No authorization code received");
        setTimeout(() => navigate("/login"), 3000);
        return;
      }

      if (!verifier) {
        setError("Missing PKCE verifier. Please try signing in again.");
        setTimeout(() => navigate("/login"), 3000);
        return;
      }

      try {
        const domain = import.meta.env.VITE_AUTH0_DOMAIN;
        const tokenResponse = await fetch(
          `https://${domain}/oauth/token`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              grant_type: "authorization_code",
              client_id: import.meta.env.VITE_AUTH0_CLIENT_ID,
              code,
              code_verifier: verifier,
              redirect_uri: `${window.location.origin}/callback`,
            }),
          },
        );

        const tokenData = await tokenResponse.json();

        if (!tokenResponse.ok) {
          throw new Error(tokenData.error_description || "Token exchange failed");
        }

        const cleanToken = String(tokenData.access_token).trim();
        clearStoredCodeVerifier();
        const registerResponse = await register(cleanToken);
        const registerData = registerResponse.data;

        setAccessToken(registerData.access_token);
        localStorage.setItem("email", registerData.email);
        let nextPath = "/dashboard";

        try {
          const profileResponse = await fetch(
            "http://127.0.0.1:8000/api/auth/user/",
            {
              headers: {
                Authorization: `Bearer ${registerData.access_token}`,
              },
            },
          );

          if (profileResponse.ok) {
            const profileData = await profileResponse.json();
            const isAdmin = Boolean(profileData?.data?.is_admin);
            localStorage.setItem("is_admin", String(isAdmin));
            if (isAdmin) {
              nextPath = "/admin";
            }
          } else {
            localStorage.setItem("is_admin", "false");
          }
        } catch {
          localStorage.setItem("is_admin", "false");
        }

        navigate(nextPath);
      } catch (err) {
        console.error("Callback error:", err);
        clearStoredCodeVerifier();
        setError(err.message);
        setTimeout(() => navigate("/login"), 3000);
      }
    }

    handleCallback();
  }, [navigate]);

  return (
    <div style={styles.container}>
      {error ? (
        <div style={styles.error}>
          <h2>Login Failed</h2>
          <p>{error}</p>
          <p>Redirecting to login page...</p>
        </div>
      ) : (
        <div style={styles.loading}>
          <div style={styles.spinner}></div>
          <h2>Completing login...</h2>
          <p>Please wait</p>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    minHeight: "100vh",
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  },
  loading: { textAlign: "center", color: "white" },
  spinner: {
    width: "50px",
    height: "50px",
    border: "4px solid rgba(255,255,255,0.3)",
    borderTop: "4px solid white",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
    margin: "0 auto 20px",
  },
  error: {
    textAlign: "center",
    color: "white",
    backgroundColor: "rgba(220,38,38,0.9)",
    padding: "30px",
    borderRadius: "12px",
  },
};

/* v8 ignore next -- DOM-only style injection */
if (typeof document !== "undefined") {
  const style = document.createElement("style");
  style.textContent = `@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`;
  document.head.appendChild(style);
}
