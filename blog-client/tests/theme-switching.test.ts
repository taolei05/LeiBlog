import { describe, expect, it } from "vitest";

import {
  isThemeMode,
  parseThemeMode,
  resolveThemeMode,
  themeModes,
} from "../src/shared/theme/ThemeProviderLite";

describe("theme switching", () => {
  it("accepts only supported theme modes", () => {
    expect(themeModes).toEqual(["system", "light", "dark"]);
    expect(isThemeMode("system")).toBe(true);
    expect(isThemeMode("light")).toBe(true);
    expect(isThemeMode("dark")).toBe(true);
    expect(isThemeMode("blue")).toBe(false);
  });

  it("falls back to system for invalid persisted values", () => {
    expect(parseThemeMode("dark")).toBe("dark");
    expect(parseThemeMode("unknown")).toBe("system");
    expect(parseThemeMode(null, "light")).toBe("light");
  });

  it("resolves explicit and system themes deterministically", () => {
    expect(resolveThemeMode("light", "dark")).toBe("light");
    expect(resolveThemeMode("dark", "light")).toBe("dark");
    expect(resolveThemeMode("system", "dark")).toBe("dark");
    expect(resolveThemeMode("system", "light")).toBe("light");
  });
});
