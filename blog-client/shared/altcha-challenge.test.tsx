import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Banner } from "@astryxdesign/core/Banner";
import type { AltchaFeedback } from "./altcha-feedback";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const { request } = vi.hoisted(() => ({
  request: vi.fn<() => { id: number; promise: Promise<string | undefined> }>(),
}));
const onFeedback = vi.fn<(feedback: AltchaFeedback) => void>();

vi.mock("./altcha-verification", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./altcha-verification")>()),
  createAltchaRequestController: () => ({ cancel: vi.fn(), request, resolve: vi.fn() }),
}));

import { getAltchaVerificationDialogCopy, useAltchaVerificationDialog } from "./altcha-challenge";

const captureVerificationHook = () => {
  let hook: ReturnType<typeof useAltchaVerificationDialog> | undefined;
  function Harness() {
    hook = useAltchaVerificationDialog({
      copy: getAltchaVerificationDialogCopy("en"),
      language: "en",
      onFeedback,
    });
    return null;
  }
  renderToStaticMarkup(createElement(Harness));
  if (hook === undefined) {
    throw new Error("Verification hook was not rendered.");
  }
  return hook;
};

describe("ALTCHA Banner integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    request.mockReturnValue({ id: 1, promise: Promise.resolve("proof") });
  });

  it("replaces processing feedback with success only after the protected action completes", async () => {
    let complete: ((value: string) => void) | undefined;
    const runAction = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          complete = resolve;
        }),
    );
    const action = captureVerificationHook().runWithAltcha({
      runAction,
      successMessage: (value) => `Verification successful. Code ${value}.`,
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(runAction).toHaveBeenCalledWith("proof");
    expect(onFeedback).toHaveBeenCalledOnce();
    expect(onFeedback.mock.calls[0]?.[0]).toMatchObject({ status: "info" });
    complete?.("sent");
    await action;
    const success = onFeedback.mock.calls[1]?.[0];
    expect(success).toEqual({ status: "success", title: "Verification successful. Code sent." });
    if (success === undefined) {
      throw new Error("Success feedback was not delivered.");
    }
    const markup = renderToStaticMarkup(createElement(Banner, success));
    expect(markup).toContain('data-status="success"');
    expect(markup).toContain('role="status"');
    expect(markup).toContain("Verification successful. Code sent.");
  });

  it("replaces processing feedback with an error when the server rejects the operation", async () => {
    const error = new Error("Verification expired. Please try again.");
    await expect(
      captureVerificationHook().runWithAltcha({
        runAction: async () => {
          throw error;
        },
        successMessage: "Verification successful. Signed in.",
      }),
    ).rejects.toThrow(error);
    expect(onFeedback).toHaveBeenCalledTimes(2);
    const failure = onFeedback.mock.calls[1]?.[0];
    expect(failure).toEqual({ title: error.message, status: "error" });
    if (failure === undefined) {
      throw new Error("Failure feedback was not delivered.");
    }
    const markup = renderToStaticMarkup(createElement(Banner, failure));
    expect(markup).toContain('data-status="error"');
    expect(markup).toContain('role="alert"');
    expect(markup).toContain(error.message);
  });

  it("does not call the API or show feedback when verification is cancelled", async () => {
    request.mockReturnValue({ id: 1, promise: Promise.resolve(undefined) });
    const runAction = vi.fn(async () => "sent");
    expect(
      await captureVerificationHook().runWithAltcha({
        runAction,
        successMessage: "Verification successful. Code sent.",
      }),
    ).toEqual({ status: "cancelled" });
    expect(runAction).not.toHaveBeenCalled();
    expect(onFeedback).not.toHaveBeenCalled();
  });
});
