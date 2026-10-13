import { describe, expect, it } from "vite-plus/test";

import { createAuthSessionGuard } from "./auth-session";

describe("session refresh ordering", () => {
  it.each(["login", "logout", "password change", "profile update"])(
    "ignores a startup response that finishes after %s",
    async () => {
      const guard = createAuthSessionGuard();
      const isCurrentSession = guard.capture();
      let finishRefresh: (() => void) | undefined;
      let applied = false;
      const refresh = new Promise<void>((resolve) => {
        finishRefresh = resolve;
      });
      const applyRefresh = async () => {
        await refresh;
        if (isCurrentSession()) {
          applied = true;
        }
      };
      const result = applyRefresh();
      guard.invalidate();
      finishRefresh?.();
      await result;
      expect(applied).toBe(false);
      expect(guard.capture()()).toBe(true);
    },
  );
});
