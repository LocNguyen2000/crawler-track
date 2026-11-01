import { useEffect, useState } from "react";
import { Navigate, NavLink, Outlet, Route, Routes } from "react-router-dom";
import { BaseToast } from "./components/Shared.jsx";
import { API_ERROR_EVENT } from "./js/apiClient.js";
import { useAuth } from "./js/AuthContext.jsx";
import CrawlerDashboard from "./views/crawler/CrawlerDashboard.jsx";
import UrlGenerator from "./views/url/UrlGenerator.jsx";
import { LoginPage, SignupPage, VerifyEmailPage } from "./views/auth/AuthPages.jsx";
import AdminApprovalsPage from "./views/auth/AdminApprovalsPage.jsx";

function Sidebar() {
  const { user } = useAuth();
  return (
    <aside className="m-sidebar">
      <div className="m-logo-container">
        <div className="m-icon icon--dragable m-icon-w-16" />
        <div className="logo-text">HOME</div>
      </div>
      <nav className="m-menu-item-list">
        <NavLink className="m-menu-item" to="/CA" title="Dashboard">
          <div className="m-icon icon--overview" />
          <div className="item-title">Dashboard</div>
        </NavLink>
        <NavLink className="m-menu-item" to="/URL" title="Tools">
          <div className="m-icon icon--tools" />
          <div className="item-title">Tools</div>
        </NavLink>
        {user?.role === "admin" && (
          <NavLink className="m-menu-item" to="/admin/approvals" title="Account approvals">
            <div className="m-icon icon--overview" />
            <div className="item-title">Approvals</div>
          </NavLink>
        )}
      </nav>
    </aside>
  );
}

function Navbar() {
  const { user, logout } = useAuth();
  return (
    <header className="m-navbar">
      <div className="branch-name-wrapper">
        <div className="branch-name">E-COMMERCE WEB CRAWLER</div>
        <div className="m-icon icon--arrowdown" />
      </div>
      <div className="current-db-header">
        <div className="current-db-icon" />
        <div className="current-db-name">DC-01</div>
      </div>
      <div className="m-space" />
      <div className="m-dropdown-user">
        <div className="m-icon icon--avatar" />
        <div className="display-user">{user?.email}</div>
        <button className="auth-logout" type="button" onClick={logout}>Sign out</button>
      </div>
    </header>
  );
}

function ProtectedLayout() {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div className="auth-loading">Loading your session...</div>;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="m-app-body">
      <Sidebar />
      <div className="m-app-content">
        <Navbar />
        <main className="m-content"><Outlet /></main>
      </div>
    </div>
  );
}

export default function App() {
  const [apiErrorToast, setApiErrorToast] = useState("");

  useEffect(() => {
    const handleApiError = (event) => setApiErrorToast(event.detail);
    window.addEventListener(API_ERROR_EVENT, handleApiError);
    return () => window.removeEventListener(API_ERROR_EVENT, handleApiError);
  }, []);

  return (
    <>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route element={<ProtectedLayout />}>
          <Route path="/" element={<Navigate to="/CA" replace />} />
          <Route path="/CA" element={<CrawlerDashboard />} />
          <Route path="/URL" element={<UrlGenerator />} />
          <Route path="/admin/approvals" element={<AdminApprovalsPage />} />
          <Route path="*" element={<Navigate to="/CA" replace />} />
        </Route>
      </Routes>
      <BaseToast
        type="error"
        content={apiErrorToast}
        onClose={() => setApiErrorToast("")}
      />
    </>
  );
}
