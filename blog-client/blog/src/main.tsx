import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "@astryxdesign/core/reset.css";
import "@astryxdesign/core/astryx.css";
import "altcha";
import "altcha/i18n/all";
import "react-photo-view/dist/react-photo-view.css";

import { App } from "./app/App";
import "../../shared/themes/neutral/neutral.css";
import "./style.css";

const rootElement = document.getElementById("app");

if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
