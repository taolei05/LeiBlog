import { describe, expect, it } from "vitest";

import dataTableSource from "../src/features/admin/shared/DataTable.tsx?raw";

describe("admin data table selection controls", () => {
  it("wraps every table selection checkbox control in Checkbox.Content", () => {
    const selectionCheckboxes =
      dataTableSource.match(/<Checkbox[\s\S]*?slot="selection"[\s\S]*?<\/Checkbox>/g) ?? [];

    expect(selectionCheckboxes).toHaveLength(2);
    selectionCheckboxes.forEach((checkboxSource) => {
      expect(checkboxSource).toContain("<Checkbox.Content>");
      expect(checkboxSource).toMatch(
        /<Checkbox\.Content>[\s\S]*?<Checkbox\.Control>[\s\S]*?<Checkbox\.Indicator \/>[\s\S]*?<\/Checkbox\.Control>[\s\S]*?<\/Checkbox\.Content>/,
      );
    });
  });
});
