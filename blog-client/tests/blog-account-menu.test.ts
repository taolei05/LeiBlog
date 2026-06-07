import { describe, expect, it } from "vitest";

import { getBlogAccountMenuItems } from "../src/app/blog/BlogLayout";

describe("blog account menu", () => {
  it("shows the admin entry only for admin users", () => {
    expect(getBlogAccountMenuItems("admin").map((item) => item.id)).toContain("admin");
    expect(getBlogAccountMenuItems("user").map((item) => item.id)).not.toContain("admin");
  });
});
