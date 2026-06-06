import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SiteSettingsPage } from "../src/features/admin/system/SiteSettingsPage";

describe("SiteSettingsPage filing settings", () => {
  it("renders ICP filing controls with a social-link style editor", () => {
    const html = renderToStaticMarkup(<SiteSettingsPage />);

    expect(html).toContain("ICP备案");
    expect(html).toContain("备案号");
    expect(html).toContain("filing-record-row");
    expect(html).not.toContain("filing-record-card");
    expect(html).toContain("添加 ICP 备案");
    expect(html).toContain("保存备案配置");
  });
});
