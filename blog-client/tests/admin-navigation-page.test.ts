import { readFileSync } from "node:fs";

import { describe, expect, it, vi } from "vitest";

import navigationPageSource from "../src/features/admin/content/NavigationPage.tsx?raw";
import routerSource from "../src/app/router.tsx?raw";
import { persistOptimisticOrder } from "../src/features/admin/content/navigation-order";

const navigationStyles = readFileSync(
  new URL("../src/shared/theme/navigation.css", import.meta.url),
  "utf8",
);

describe("admin navigation page", () => {
  it("supports icon media, card drag sorting, and protected group deletion", () => {
    expect(navigationPageSource).toContain('folderSlug="website-icons"');
    expect(navigationPageSource).toContain("draggable");
    expect(navigationPageSource).toContain("reorderByDrop");
    expect(navigationPageSource).toContain("openMoveItem(item)");
    expect(navigationPageSource).toContain('submitLabel="移动网站"');
    expect(navigationPageSource).toContain("网站已移动到");
    expect(navigationPageSource).toContain("请选择其它分组");
    expect(navigationPageSource).toContain("至少需要两个分组才能移动网站");
    expect(navigationPageSource).toContain('<AppIcon name="swapVertical" />');
    expect(navigationPageSource).not.toContain("moveOrderedItem");
    expect(navigationPageSource).not.toContain("上移");
    expect(navigationPageSource).not.toContain("下移");
    expect(navigationPageSource).toContain('className="navigation-admin-row__icon"');
    expect(navigationPageSource).toContain("NavigationAdminIcon");
    expect(navigationPageSource).toContain("resolveApiAssetUrl(iconUrl)");
    expect(navigationPageSource).toContain('accept={websiteIconAccept}');
    expect(navigationPageSource).toContain(".ico");
    expect(navigationPageSource).toContain('referrerPolicy="no-referrer"');
    expect(navigationPageSource).toContain("setHasIconError(true)");
    expect(navigationPageSource).toContain('<AppIcon name="link" />');
    expect(navigationPageSource).toContain("请先移动或删除组内网站");
    expect(routerSource).toContain('path="admin/content/navigation"');
  });

  it("uses the shared danger confirmation dialog for deletions", () => {
    expect(navigationPageSource).not.toContain("window.confirm");
    expect(navigationPageSource).toContain("<AlertDialog.Backdrop");
    expect(navigationPageSource).toContain('<AlertDialog.Icon status="danger" />');
    expect(navigationPageSource).toContain("确认删除分组");
    expect(navigationPageSource).toContain("确认删除网站");
    expect(navigationPageSource).toContain("请先移动或删除组内网站");
  });

  it("keeps the group column compact on desktop", () => {
    expect(navigationStyles).toContain(
      "grid-template-columns: minmax(16rem, 0.7fr) minmax(24rem, 1.3fr);",
    );
    expect(navigationStyles).toContain(`@media (max-width: 1024px) {
  .navigation-admin-layout {
    grid-template-columns: 1fr;
  }`);
  });

  it("lets group and website columns scroll independently on desktop", () => {
    expect(navigationStyles).toContain("align-items: start;");
    expect(navigationStyles).toContain("max-height: min(52rem, calc(100dvh - 14rem));");
    expect(navigationStyles).toContain("overflow: hidden;");
    expect(navigationStyles).toContain("overflow-y: auto;");
    expect(navigationStyles).toContain("scrollbar-gutter: stable;");
    expect(navigationStyles).toContain(`@media (max-width: 1024px) {
  .navigation-admin-layout {
    grid-template-columns: 1fr;
  }

  .navigation-admin-panel {
    max-height: none;
    overflow: visible;
  }

  .navigation-admin-list {
    overflow: visible;
  }`);
  });

  it("aligns create and card action buttons for mobile", () => {
    expect(navigationStyles).toContain(`@media (max-width: 720px) {
  .navigation-admin-panel__header,
  .navigation-admin-row {
    align-items: stretch;
    flex-direction: column;
  }

  .navigation-admin-panel__header > .button {
    align-self: flex-end;
  }

  .navigation-admin-row__actions {
    display: grid;
    width: 100%;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .navigation-admin-row__actions > .button {
    width: 100%;
  }

  .navigation-admin-row--item .navigation-admin-row__actions {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}`);
  });

  it("rolls back an optimistic order when persistence fails", async () => {
    const applied: string[][] = [];
    const persist = vi.fn().mockRejectedValue(new Error("保存失败"));

    await expect(
      persistOptimisticOrder(["a", "b"], ["b", "a"], (ids) => applied.push(ids), persist),
    ).rejects.toThrow("保存失败");

    expect(applied).toEqual([
      ["b", "a"],
      ["a", "b"],
    ]);
  });
});
