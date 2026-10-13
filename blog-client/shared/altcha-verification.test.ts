import { describe, expect, it } from "vite-plus/test";

import { createAltchaRequestController, readAltchaEventPayload } from "./altcha-verification";

describe("ALTCHA token lifecycle", () => {
  it.each(["expired", "error", "unverified", "verifying"])(
    "clears a stale hidden token on %s",
    (state) => {
      expect(
        readAltchaEventPayload({
          detail: { payload: "stale", state },
          hiddenPayload: "stale",
          type: state === "expired" ? "expired" : "statechange",
        }),
      ).toBe("");
    },
  );

  it("accepts payloads only from verified transitions", () => {
    expect(
      readAltchaEventPayload({
        detail: { payload: " fresh " },
        hiddenPayload: "old",
        type: "verified",
      }),
    ).toBe("fresh");
    expect(
      readAltchaEventPayload({
        detail: { state: "verified" },
        hiddenPayload: "fresh",
        type: "statechange",
      }),
    ).toBe("fresh");
    expect(
      readAltchaEventPayload({ detail: null, hiddenPayload: "old", type: "statechange" }),
    ).toBe("");
  });
});

describe("ALTCHA popup requests", () => {
  it("cancels a replaced action and ignores its late widget callbacks", async () => {
    const controller = createAltchaRequestController();
    const first = controller.request();
    const second = controller.request();
    expect(await first.promise).toBeUndefined();
    expect(controller.resolve(first.id, "stale")).toBe(false);
    expect(controller.resolve(first.id, undefined)).toBe(false);
    expect(controller.resolve(second.id, "fresh")).toBe(true);
    expect(await second.promise).toBe("fresh");
  });

  it("consumes a verified token once despite duplicate events", async () => {
    const controller = createAltchaRequestController();
    const request = controller.request();
    expect(controller.resolve(request.id, "fresh")).toBe(true);
    expect(controller.resolve(request.id, "fresh")).toBe(false);
    expect(await request.promise).toBe("fresh");
  });

  it("settles pending actions on cancellation or unmount", async () => {
    const controller = createAltchaRequestController();
    const request = controller.request();
    controller.cancel();
    expect(await request.promise).toBeUndefined();
    expect(controller.resolve(request.id, "late")).toBe(false);
    const next = controller.request();
    expect(next.id).not.toBe(request.id);
    controller.cancel();
    expect(await next.promise).toBeUndefined();
  });
});
