import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import mediaAssetFieldSource from "../src/features/admin/shared/media-asset-field.tsx?raw";
import { MediaAssetField } from "../src/features/admin/shared/media-asset-field";
import { SiteSettingsPage } from "../src/features/admin/system/SiteSettingsPage";
import siteSettingsPageSource from "../src/features/admin/system/SiteSettingsPage.tsx?raw";
import layoutsCss from "../src/shared/theme/layouts.css?raw";

describe("SiteSettingsPage filing settings", () => {
  it("renders ICP filing controls with a social-link style editor", () => {
    const html = renderToStaticMarkup(<SiteSettingsPage />);

    expect(html).toContain("ICP备案");
    expect(html).toContain("备案号");
    expect(html).toContain("filing-record-row");
    expect(html).not.toContain("filing-record-card");
    expect(html).toContain("添加 ICP 备案");
    expect(html).toContain("保存备案配置");
    expect(html).toMatch(/aria-label="移除第 1 条 ICP 备案"[\s\S]*移除/);
    expect(siteSettingsPageSource).toContain("确认移除 ICP 备案？");
  });

  it("stretches filing action buttons on mobile and shows a removal toast", () => {
    const html = renderToStaticMarkup(<SiteSettingsPage />);

    expect(html).toContain("filing-record-panel__add-button");
    expect(html).toContain("filing-record-row__remove-button");
    expect(layoutsCss).toContain(`.filing-record-panel__add-button,
  .filing-record-row__remove-button {
    width: 100%;
    justify-content: center;
  }`);
    expect(layoutsCss).toContain(`.filing-record-row > .filing-record-row__remove-button {
    justify-self: stretch;
  }`);
    expect(siteSettingsPageSource).toContain("已移除${record.number.trim()");
  });

  it("confirms before removing stored site logo and favicon assets", () => {
    const ignoreValue = () => undefined;
    const ignoreFile = () => undefined;
    const html = renderToStaticMarkup(
      <>
        {["浅色 Logo", "深色 Logo", "favicon"].map((label) => (
          <MediaAssetField
            canRemoveValue
            folderSlug="site"
            key={label}
            label={label}
            localFile={null}
            onChange={ignoreValue}
            onLocalFileChange={ignoreFile}
            value={`/uploads/site/${label}.png`}
          />
        ))}
      </>,
    );

    expect(html).toContain("移除当前图片");
    expect(mediaAssetFieldSource).toContain("确认移除{label}？");
    expect(mediaAssetFieldSource).toContain("将从站点信息中移除当前{label}");
  });
});
