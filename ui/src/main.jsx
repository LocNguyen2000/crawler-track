import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import "./css/main.css";
import "./css/common.css";
import "./css/width.css";
import "./css/animation.css";
import "./css/components/button.css";
import "./css/components/dialog.css";
import "./css/components/dropdown.css";
import "./css/components/icon.css";
import "./css/components/input.css";
import "./css/components/label.css";
import "./css/components/overview.css";
import "./css/components/paging.css";
import "./css/components/popover.css";
import "./css/components/table.css";
import "./css/components/title.css";
import "./css/components/toolbar.css";
import "./css/components/uploadfile.css";
import "./css/layout/content.css";
import "./css/layout/navbar.css";
import "./css/layout/sidebar.css";
import "./css/react-app.css";
import "./css/crawler-detail.css";

createRoot(document.getElementById("app")).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
