import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vite-plus/test";

import { LoadingStatus } from "./loading-status";

it("renders an accessible loading status with the Spinner component", () => {
  const markup = renderToStaticMarkup(createElement(LoadingStatus, { label: "正在加载" }));
  expect(markup).toContain('role="status"');
  expect(markup).toContain('aria-live="polite"');
  expect(markup).toContain("正在加载");
  expect(markup).toContain("<svg");
});
