import { describe, expect, it } from "vitest";

import {
  moveOrderedItem,
  persistOptimisticOrder,
  reorderByDrop,
} from "../src/features/admin/content/navigation-order";

describe("navigation ordering helpers", () => {
  it("moves an item one position without mutating the input", () => {
    const ids = ["a", "b", "c"];

    expect(moveOrderedItem(ids, "b", -1)).toEqual(["b", "a", "c"]);
    expect(moveOrderedItem(ids, "a", -1)).toEqual(["a", "b", "c"]);
    expect(ids).toEqual(["a", "b", "c"]);
  });

  it("places a dragged item after the drop target", () => {
    expect(reorderByDrop(["a", "b", "c"], "a", "c")).toEqual(["b", "c", "a"]);
    expect(reorderByDrop(["a", "b", "c"], "c", "a")).toEqual(["a", "c", "b"]);
  });

  it("keeps an optimistic order after persistence succeeds", async () => {
    const applied: string[][] = [];

    await persistOptimisticOrder(
      ["a", "b"],
      ["b", "a"],
      (ids) => applied.push(ids),
      async () => undefined,
    );

    expect(applied).toEqual([["b", "a"]]);
  });
});
