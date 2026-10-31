import { Navigate, NavLink, Route, Routes } from "react-router-dom";
import CrawlerDashboard from "./views/crawler/CrawlerDashboard.jsx";
import UrlGenerator from "./views/url/UrlGenerator.jsx";

function Sidebar() {
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
      </nav>
    </aside>
  );
}

function Navbar() {
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
        <div className="display-user">Nguyễn Hữu Lộc</div>
      </div>
    </header>
  );
}

export default function App() {
  return (
    <div className="m-app-body">
      <Sidebar />
      <div className="m-app-content">
        <Navbar />
        <main className="m-content">
          <Routes>
            <Route path="/" element={<Navigate to="/CA" replace />} />
            <Route path="/CA" element={<CrawlerDashboard />} />
            <Route path="/URL" element={<UrlGenerator />} />
            <Route path="*" element={<Navigate to="/CA" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
