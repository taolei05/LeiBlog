import { describe, expect, it, vi } from "vite-plus/test";

import { getAltchaFeedbackCopy, getAltchaSuccessMessage, runAltchaAction } from "./altcha-feedback";
import { readAltchaEventFailure } from "./altcha-verification";

describe("ALTCHA action feedback", () => {
  it("waits for verification and the API result before reporting action success", async () => {
    let verify: ((value: string) => void) | undefined;
    let complete: ((value: string) => void) | undefined;
    const onVerified = vi.fn();
    const onSuccess = vi.fn();
    const onFailure = vi.fn();
    const runAction = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          complete = resolve;
        }),
    );
    const promise = runAltchaAction({
      requestAltcha: () =>
        new Promise<string>((resolve) => {
          verify = resolve;
        }),
      runAction,
      onVerified,
      onSuccess,
      onFailure,
    });
    expect(runAction).not.toHaveBeenCalled();
    expect(onVerified).not.toHaveBeenCalled();
    verify?.("proof");
    await Promise.resolve();
    expect(onVerified).toHaveBeenCalledOnce();
    expect(onSuccess).not.toHaveBeenCalled();
    complete?.("sent");
    expect(await promise).toEqual({ status: "completed", value: "sent" });
    expect(onSuccess).toHaveBeenCalledWith("sent");
    expect(onFailure).not.toHaveBeenCalled();
  });

  it("does not report success or run the action after cancellation", async () => {
    const runAction = vi.fn(async () => "sent");
    const onVerified = vi.fn();
    const onSuccess = vi.fn();
    const onFailure = vi.fn();
    expect(
      await runAltchaAction({
        requestAltcha: async () => undefined,
        runAction,
        onVerified,
        onSuccess,
        onFailure,
      }),
    ).toEqual({ status: "cancelled" });
    expect(runAction).not.toHaveBeenCalled();
    expect(onVerified).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onFailure).not.toHaveBeenCalled();
  });

  it("distinguishes a completed action without a return value from cancellation", async () => {
    const onSuccess = vi.fn();
    expect(
      await runAltchaAction({
        requestAltcha: async () => "proof",
        runAction: async () => undefined,
        onVerified: vi.fn(),
        onSuccess,
        onFailure: vi.fn(),
      }),
    ).toEqual({ status: "completed", value: undefined });
    expect(onSuccess).toHaveBeenCalledWith(undefined);
  });

  it("reports action failure without claiming the operation succeeded", async () => {
    const error = new Error("Email delivery failed");
    const onSuccess = vi.fn();
    const onFailure = vi.fn();
    await expect(
      runAltchaAction({
        requestAltcha: async () => "proof",
        runAction: async () => {
          throw error;
        },
        onVerified: vi.fn(),
        onSuccess,
        onFailure,
      }),
    ).rejects.toThrow(error);
    expect(onFailure).toHaveBeenCalledWith(error);
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("reports request failures and never starts the action", async () => {
    const error = new Error("Challenge unavailable");
    const runAction = vi.fn(async () => "sent");
    const onFailure = vi.fn();
    await expect(
      runAltchaAction({
        requestAltcha: async () => {
          throw error;
        },
        runAction,
        onVerified: vi.fn(),
        onSuccess: vi.fn(),
        onFailure,
      }),
    ).rejects.toThrow(error);
    expect(runAction).not.toHaveBeenCalled();
    expect(onFailure).toHaveBeenCalledWith(error);
  });

  it.each(["en", "zh-CN"] as const)(
    "has localized success messages for every protected action (%s)",
    (language) => {
      for (const action of [
        "login",
        "register",
        "password-reset",
        "email-code",
        "email-code-request",
        "comment",
        "reply",
        "message",
        "message-reply",
      ] as const) {
        expect(getAltchaSuccessMessage(language, action)).toContain(
          language === "en" ? "Verification successful" : "验证成功",
        );
      }
      expect(getAltchaFeedbackCopy(language).failed).toContain(
        language === "en" ? "failed" : "失败",
      );
      expect(getAltchaFeedbackCopy(language).expired).toContain(
        language === "en" ? "expired" : "过期",
      );
    },
  );

  it("does not claim email delivery or code generation for a generic code request result", () => {
    const english = getAltchaSuccessMessage("en", "email-code-request");
    expect(english).not.toContain("has been sent");
    expect(english).not.toContain("has been generated");
    const chinese = getAltchaSuccessMessage("zh-CN", "email-code-request");
    expect(chinese).not.toContain("已发送");
    expect(chinese).not.toContain("已生成");
  });
});

describe("ALTCHA widget failure feedback", () => {
  it.each([
    { type: "error", detail: undefined, expected: "failed" },
    { type: "expired", detail: {}, expected: "expired" },
    { type: "statechange", detail: { state: "error" }, expected: "failed" },
    { type: "statechange", detail: { state: "expired" }, expected: "expired" },
    { type: "statechange", detail: { state: "verifying" }, expected: undefined },
    { type: "statechange", detail: { state: "unverified" }, expected: undefined },
    { type: "verified", detail: { payload: "proof" }, expected: undefined },
  ])(
    "classifies $type / $detail without treating pending states as failures",
    ({ type, detail, expected }) => {
      expect(readAltchaEventFailure({ type, detail })).toBe(expected);
    },
  );
});
