import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import profilePageSource from "../src/features/admin/system/ProfilePage.tsx?raw";

const layoutsCss = readFileSync(
  new URL("../src/shared/theme/layouts.css", import.meta.url),
  "utf8",
);

describe("admin profile metric layout", () => {
  it("uses compact stacked text metrics without changing other admin metric cards", () => {
    expect(profilePageSource).toContain('metricGridClassName="admin-profile-metric-grid"');
    expect(layoutsCss).toContain(`.admin-profile-metric-grid .admin-metric-card .card__header {
  grid-template-columns: minmax(0, 1fr);`);
    expect(layoutsCss).toContain(`.admin-profile-metric-grid .admin-metric-card .card__title {
  grid-column: 1;
  grid-row: 2;`);
    expect(layoutsCss).toContain("font-size: clamp(1.125rem, 1.65vw, 1.5rem);");
    expect(layoutsCss).toContain("overflow-wrap: anywhere;");
    expect(layoutsCss).toContain(`.admin-profile-metric-grid {
    grid-template-columns: minmax(0, 1fr);`);
    expect(layoutsCss).toContain(`.admin-profile-metric-grid .admin-metric-card .card__title {
    overflow: visible;
    text-overflow: clip;
    white-space: normal;
  }`);
  });
});
