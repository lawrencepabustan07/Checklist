import { useState } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import Login from "./components/Login";
import Dashboard from "./components/Dashboard";
import Callback from "./components/Callback";
import AdminPage from "./components/AdminPage";
import { getAccessToken } from "./services/authStorage";

function isAdminUser() {
  return localStorage.getItem("is_admin") === "true";
}

function ProtectedRoute({ children }) {
  const token = getAccessToken();
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function PublicRoute({ children }) {
  const token = getAccessToken();
  if (token) {
    return <Navigate to={isAdminUser() ? "/admin" : "/dashboard"} replace />;
  }
  return children;
}

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(
    () => !!getAccessToken(),
  );

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
              {isAdminUser() ? (
                <Navigate to="/admin" replace />
              ) : (
                <Dashboard onLogout={() => setIsLoggedIn(false)} />
              )}
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <AdminPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/"
          element={
            isLoggedIn ? (
              <Navigate to={isAdminUser() ? "/admin" : "/dashboard"} replace />
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
export default App;
