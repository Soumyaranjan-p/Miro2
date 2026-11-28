import React from "react";
import ReactDOM from "react-dom/client";

import App from "./App";
import { DockApp } from "./dock/DockApp";
import "./styles/tokens.css";
import "./styles/notch.css";
import "./dock/dock.css";

// Preview-only theme deep link. Tauri always loads without a query string and
// follows the saved setting, so this never fires in the shipped window.
const query = new URLSearchParams(window.location.search);
const theme = import.meta.env.DEV ? query.get("theme") : null;
if (theme === "dark" || theme === "light") {
  document.documentElement.dataset.theme = theme;
}

// The usage dock window loads the same bundle with ?window=dock and renders
// its own subtree; the notch window (no query) keeps the normal app.
const isDock = query.get("window") === "dock";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    {isDock ? <DockApp /> : <App />}
  </React.StrictMode>,
);
