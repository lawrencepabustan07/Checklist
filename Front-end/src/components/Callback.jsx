import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { register } from "../services/api";

export default function Callback() {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const called = useRef(false);

  useEffect(() => {
    if (called.current) return;
    called.current = true;
    handleCallback();
  }, []);

  async function handleCallback() {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get("code");

    if (!code) {
      setError("No authorization code received");
      setTimeout(() => navigate("/login"), 3000);
      return;
    }

    try {
      console.log(
        "Secret loaded:",
        import.meta.env.VITE_AUTH0_CLIENT_SECRET ? "Yes" : "No",
      );

      const tokenResponse = await fetch(
        `https://dev-zg54pxgt5z5cithx.us.auth0.com/oauth/token`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            grant_type: "authorization_code",
            client_id: "7gZpLBI7a7nGsM11zRczrJBZja3dz41d",
            client_secret: import.meta.env.VITE_AUTH0_CLIENT_SECRET,
            code: code,
            redirect_uri: "http://localhost:5173/callback",
          }),
        },
      );

      const tokenData = await tokenResponse.json();

      if (!tokenResponse.ok) {
        throw new Error(tokenData.error_description || "Token exchange failed");
      }

      const cleanToken = String(tokenData.access_token).trim();
      const registerResponse = await register(cleanToken);
      const registerData = registerResponse.data;

      localStorage.setItem("access_token", registerData.access_token);
      localStorage.setItem("email", registerData.email);

      navigate("/dashboard");
    } catch (err) {
      console.error("Callback error:", err);
      setError(err.message);
      setTimeout(() => navigate("/login"), 3000);
    }
  }

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

if (typeof document !== "undefined") {
  const style = document.createElement("style");
  style.textContent = `@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`;
  document.head.appendChild(style);
}
