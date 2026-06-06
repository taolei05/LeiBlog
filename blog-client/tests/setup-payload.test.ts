import { describe, expect, it } from "vitest";

import { toSetupFilingPayload, toSetupHomeCoverUrls } from "../src/features/admin/setup/SetupPage";

describe("setup payload helpers", () => {
  it("cleans homepage covers and multiple ICP records for setup submission", () => {
    expect(
      toSetupHomeCoverUrls(
        [" https://example.com/a.jpg ", "", "https://example.com/a.jpg"],
        ["https://example.com/b.jpg"],
      ),
    ).toEqual(["https://example.com/a.jpg", "https://example.com/b.jpg"]);

    expect(
      toSetupFilingPayload([
        { id: "first", number: " 京ICP备00000000号-1 ", url: " https://beian.miit.gov.cn/ " },
        { id: "empty", number: " ", url: "https://example.com/ignored" },
        { id: "second", number: "京ICP备00000000号-2", url: "" },
      ]),
    ).toEqual([
      { number: "京ICP备00000000号-1", url: "https://beian.miit.gov.cn/" },
      { number: "京ICP备00000000号-2", url: null },
    ]);
  });
});
