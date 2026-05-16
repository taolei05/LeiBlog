import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { AppRouter } from "./app/router";
import { ThemeProviderLite } from "./shared/theme/ThemeProviderLite";
import "./shared/theme/index.css";

createRoot(document.querySelector("#app")!).render(
  <StrictMode>
    <ThemeProviderLite>
      <AppRouter />
    </ThemeProviderLite>
  </StrictMode>,
);
