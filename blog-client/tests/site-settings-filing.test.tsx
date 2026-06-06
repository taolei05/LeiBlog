import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SiteSettingsPage } from "../src/features/admin/system/SiteSettingsPage";

describe("SiteSettingsPage filing settings", () => {
  it("renders multiple ICP filing controls", () => {
    const html = renderToStaticMarkup(<SiteSettingsPage />);

    expect(html).toContain("ICP备案 1");
    expect(html).toContain("添加 ICP 备案");
    expect(html).toContain("保存备案配置");
  });
});
