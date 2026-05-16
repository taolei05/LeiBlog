import { describe, expect, it } from "vitest";

import {
  getAdminAccessRedirect,
  isAdminRoleAllowed,
  parseAdminRole,
} from "../src/shared/routing/adminGuards";

describe("admin route guards", () => {
  it("normalizes stored admin roles", () => {
    expect(parseAdminRole("admin")).toBe("admin");
    expect(parseAdminRole("demo")).toBe("demo");
    expect(parseAdminRole("user")).toBe("user");
    expect(parseAdminRole("root")).toBe("admin");
    expect(parseAdminRole(null, "demo")).toBe("demo");
  });

  it("allows admin and demo roles by default", () => {
    expect(isAdminRoleAllowed("admin")).toBe(true);
    expect(isAdminRoleAllowed("demo")).toBe(true);
    expect(isAdminRoleAllowed("user")).toBe(false);
  });

  it("prioritizes setup, login, and role redirects", () => {
    expect(
      getAdminAccessRedirect({
        currentPath: "/admin/content/articles",
        isAuthenticated: false,
        role: "admin",
        setupComplete: false,
      }),
    ).toEqual({
      state: { next: "/admin/content/articles" },
      to: "/admin/setup",
    });

    expect(
      getAdminAccessRedirect({
        currentPath: "/admin/content/articles",
        isAuthenticated: false,
        role: "admin",
        setupComplete: true,
      }),
    ).toEqual({
      state: { next: "/admin/content/articles" },
      to: "/admin/login",
    });

    expect(
      getAdminAccessRedirect({
        currentPath: "/admin/content/articles",
        isAuthenticated: true,
        role: "user",
        setupComplete: true,
      }),
    ).toEqual({ to: "/" });

    expect(
      getAdminAccessRedirect({
        currentPath: "/admin/content/articles",
        isAuthenticated: true,
        role: "demo",
        setupComplete: true,
      }),
    ).toBeNull();
  });
});
