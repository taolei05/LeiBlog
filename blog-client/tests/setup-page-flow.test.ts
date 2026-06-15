import { describe, expect, it } from "vitest";

import setupPageSource from "../src/features/admin/setup/SetupPage.tsx?raw";

describe("setup page flow", () => {
  it("opens the completion confirmation only from the final action button", () => {
    expect(setupPageSource).toContain("function goToNextStep()");
    expect(setupPageSource).toContain("function goToPreviousStep()");
    expect(setupPageSource).toContain("setIsCompleteConfirmOpen(false);");
    expect(setupPageSource).toMatch(
      /onSubmit=\{\(event\) => \{\s*event\.preventDefault\(\);\s*\}\}/,
    );
    expect(setupPageSource).toContain('<Button onPress={goToNextStep} type="button">');
    expect(setupPageSource).toContain("onPress={() => setIsCompleteConfirmOpen(true)}");
    expect(setupPageSource).toContain('type="button"');
    expect(setupPageSource).toContain("完成配置并进入后台");
  });
});
