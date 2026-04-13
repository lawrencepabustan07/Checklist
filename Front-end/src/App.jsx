import React, { useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import Login from "./components/Login";
import Dashboard from "./components/Dashboard";
import Callback from "./components/Callback";

//
function ProtectedRoute({ children }) {
  const token = localStorage.getItem("access_token");
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function PublicRoute({ children }) {
  const token = localStorage.getItem("access_token");
  if (token) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}

function App() {
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    setIsLoggedIn(!!token);
    setLoading(false);
  }, []);

  if (loading) {
    return <div style={styles.loading}>Loading...</div>;
  }

  return (
    <Router>
      <Routes>
        <Route
          path="/login"
          element={
            <PublicRoute>
              <Login onLogin={() => setIsLoggedIn(true)} />
            </PublicRoute>
          }
        />

        <Route path="/callback" element={<Callback />} />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard onLogout={() => setIsLoggedIn(false)} />
            </ProtectedRoute>
          }
        />

        <Route
          path="/"
          element={
            isLoggedIn ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

const styles = {
  loading: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    height: "100vh",
    fontSize: "18px",
    color: "#667eea",
    fontFamily: "system-ui, sans-serif",
  },
};

export default App;
