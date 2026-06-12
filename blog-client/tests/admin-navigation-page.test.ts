import { describe, expect, it, vi } from "vitest";

import navigationPageSource from "../src/features/admin/content/NavigationPage.tsx?raw";
import routerSource from "../src/app/router.tsx?raw";
import { persistOptimisticOrder } from "../src/features/admin/content/navigation-order";

describe("admin navigation page", () => {
  it("supports icon media, drag sorting, accessible sorting, and protected group deletion", () => {
    expect(navigationPageSource).toContain('folderSlug="website-icons"');
    expect(navigationPageSource).toContain("draggable");
    expect(navigationPageSource).toContain("moveOrderedItem");
    expect(navigationPageSource).toContain("reorderByDrop");
    expect(navigationPageSource).toContain("请先移动或删除组内网站");
    expect(routerSource).toContain('path="admin/content/navigation"');
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
