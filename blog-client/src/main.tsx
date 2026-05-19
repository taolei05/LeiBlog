import { Toast } from "@heroui/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { AppRouter } from "./app/router";
import { ThemeProviderLite } from "./shared/theme/ThemeProviderLite";
import "./shared/theme/index.css";

const appElement = document.querySelector("#app");

if (!appElement) {
  throw new Error("缺少应用挂载节点 #app");
}

createRoot(appElement).render(
  <StrictMode>
    <ThemeProviderLite>
      <Toast.Provider placement="top" />
      <AppRouter />
    </ThemeProviderLite>
  </StrictMode>,
);
