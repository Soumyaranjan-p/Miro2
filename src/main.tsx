import React from "react";
import ReactDOM from "react-dom/client";

import App from "./App";
import "./styles/tokens.css";
import "./styles/notch.css";

// Preview-only theme deep link. Tauri always loads without a query string and
// follows the saved setting, so this never fires in the shipped window.
const theme = import.meta.env.DEV
  ? new URLSearchParams(window.location.search).get("theme")
  : null;
if (theme === "dark" || theme === "light") {
  document.documentElement.dataset.theme = theme;
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
