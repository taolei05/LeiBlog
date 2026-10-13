import { createElement, useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { X } from "lucide-react";

import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Dialog } from "@astryxdesign/core/Dialog";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Heading, Text } from "@astryxdesign/core/Text";

import { getAltchaChallengeUrl } from "./admin-api";
import type { AppLanguage } from "./i18n";
import { getAltchaFeedbackCopy, runAltchaAction } from "./altcha-feedback";
import type { AltchaActionResult, AltchaFeedback } from "./altcha-feedback";
import {
  createAltchaRequestController,
  readAltchaEventFailure,
  readAltchaEventPayload,
} from "./altcha-verification";
import type { AltchaFailure } from "./altcha-verification";

export type AltchaValue = string;

type AltchaWidgetElement = HTMLElement & {
  reset?: (state?: string, error?: string) => void;
};

type AltchaChallengeProps = {
  className?: string;
  language: AppLanguage;
  onChange: (value: AltchaValue) => void;
  onFailure?: (failure: AltchaFailure | undefined) => void;
  resetKey: number;
};

export type AltchaVerificationDialogCopy = {
  cancel: string;
  close: string;
  description: string;
  title: string;
};

export const getAltchaVerificationDialogCopy = (
  language: AppLanguage,
): AltchaVerificationDialogCopy =>
  language === "en"
    ? {
        cancel: "Cancel",
        close: "Close",
        description: "Complete verification to continue the current action.",
        title: "Human verification",
      }
    : {
        cancel: "取消",
        close: "关闭",
        description: "请先完成验证，验证通过后会自动继续当前操作。",
        title: "人机验证",
      };

const readHiddenInputPayload = (widget: AltchaWidgetElement) => {
  const input = widget.querySelector<HTMLInputElement>('input[name="altcha"]');
  return input?.value ?? "";
};

const readAltchaLanguage = (language: AppLanguage) => (language === "en" ? "en" : "zh-cn");

export function AltchaChallenge({
  className,
  language,
  onChange,
  onFailure,
  resetKey,
}: AltchaChallengeProps) {
  const widgetRef = useRef<AltchaWidgetElement | null>(null);
  const onChangeRef = useRef(onChange);
  const onFailureRef = useRef(onFailure);
  const classes = ["leiblog-altcha", className].filter(Boolean).join(" ");

  useEffect(() => {
    onChangeRef.current = onChange;
    onFailureRef.current = onFailure;
  }, [onChange, onFailure]);

  useEffect(() => {
    const widget = widgetRef.current;
    if (widget === null) {
      return undefined;
    }

    onChangeRef.current("");

    const handleEvent = (event: Event) => {
      const detail = (event as CustomEvent<unknown>).detail;
      onFailureRef.current?.(readAltchaEventFailure({ detail, type: event.type }));
      onChangeRef.current(
        readAltchaEventPayload({
          detail,
          hiddenPayload: readHiddenInputPayload(widget),
          type: event.type,
        }),
      );
    };

    widget.addEventListener("error", handleEvent);
    widget.addEventListener("expired", handleEvent);
    widget.addEventListener("statechange", handleEvent);
    widget.addEventListener("verified", handleEvent);

    return () => {
      widget.removeEventListener("error", handleEvent);
      widget.removeEventListener("expired", handleEvent);
      widget.removeEventListener("statechange", handleEvent);
      widget.removeEventListener("verified", handleEvent);
    };
  }, [resetKey]);

  return (
    <VStack className={classes}>
      {createElement("altcha-widget", {
        auto: "off",
        challenge: getAltchaChallengeUrl(),
        key: resetKey,
        language: readAltchaLanguage(language),
        name: "altcha",
        ref: widgetRef,
      })}
    </VStack>
  );
}

type AltchaVerificationDialogProps = {
  copy: AltchaVerificationDialogCopy;
  isOpen: boolean;
  language: AppLanguage;
  onCancel: () => void;
  onFailure: (failure: AltchaFailure) => void;
  onVerified: (value: AltchaValue) => void;
  resetKey: number;
};

function AltchaVerificationDialog({
  copy,
  isOpen,
  language,
  onCancel,
  onFailure,
  onVerified,
  resetKey,
}: AltchaVerificationDialogProps) {
  const [failure, setFailure] = useState<AltchaFailure>();
  const feedbackCopy = getAltchaFeedbackCopy(language);
  const handleChange = useCallback(
    (value: AltchaValue) => {
      const payload = value.trim();
      if (payload.length === 0) {
        return;
      }

      onVerified(payload);
    },
    [onVerified],
  );

  return (
    <Dialog
      aria-label={copy.title}
      isOpen={isOpen}
      maxHeight="calc(100dvh - 32px)"
      onOpenChange={(open) => {
        if (!open) {
          onCancel();
        }
      }}
      purpose="form"
      width="min(420px, calc(100vw - 24px))"
    >
      <VStack className="leiblog-altcha-dialog" gap={4}>
        <HStack className="leiblog-altcha-dialog__header" hAlign="between" vAlign="start">
          <VStack gap={1}>
            <Heading level={2}>{copy.title}</Heading>
            <Text color="secondary" type="supporting">
              {copy.description}
            </Text>
          </VStack>
          <button
            aria-label={copy.close}
            className="leiblog-altcha-dialog__close"
            onClick={onCancel}
            type="button"
          >
            <X aria-hidden="true" size={18} />
          </button>
        </HStack>
        <AltchaChallenge
          className="leiblog-altcha-dialog__challenge"
          language={language}
          onChange={handleChange}
          onFailure={(nextFailure) => {
            setFailure(nextFailure);
            if (nextFailure !== undefined) {
              onFailure(nextFailure);
            }
          }}
          resetKey={resetKey}
        />
        {failure === undefined ? null : <Banner status="error" title={feedbackCopy[failure]} />}
        <HStack className="leiblog-altcha-dialog__actions" hAlign="end">
          <Button label={copy.cancel} onClick={onCancel} variant="secondary" />
        </HStack>
      </VStack>
    </Dialog>
  );
}

type UseAltchaVerificationDialogParameters = {
  copy: AltchaVerificationDialogCopy;
  language: AppLanguage;
  onFeedback: (feedback: AltchaFeedback) => void;
  scopeKey?: string;
};

type AltchaProtectedActionParameters<Result> = {
  runAction: (proof: AltchaValue) => Promise<Result>;
  successMessage: string | ((value: Result) => string);
};

export const useAltchaVerificationDialog = ({
  copy,
  language,
  onFeedback,
  scopeKey,
}: UseAltchaVerificationDialogParameters): {
  dialog: ReactNode;
  cancelAltcha: () => void;
  requestAltcha: () => Promise<AltchaValue | undefined>;
  runWithAltcha: <Result>(
    parameters: AltchaProtectedActionParameters<Result>,
  ) => Promise<AltchaActionResult<Result>>;
} => {
  const feedbackCopy = getAltchaFeedbackCopy(language);
  const [controller] = useState(createAltchaRequestController);
  const [requestId, setRequestId] = useState<number>();

  const cancelAltcha = useCallback(() => {
    controller.cancel();
    setRequestId(undefined);
  }, [controller]);

  const requestAltcha = useCallback(() => {
    const request = controller.request();
    setRequestId(request.id);
    return request.promise;
  }, [controller]);

  const runWithAltcha = <Result,>({
    runAction,
    successMessage,
  }: AltchaProtectedActionParameters<Result>) =>
    runAltchaAction({
      requestAltcha,
      runAction,
      onVerified: () => {
        onFeedback({
          status: "info",
          title: feedbackCopy.processing,
        });
      },
      onSuccess: (value) => {
        onFeedback({
          status: "success",
          title: typeof successMessage === "function" ? successMessage(value) : successMessage,
        });
      },
      onFailure: (error) => {
        onFeedback({
          status: "error",
          title:
            error instanceof Error && error.message ? error.message : feedbackCopy.actionFailed,
        });
      },
    });

  useEffect(() => {
    cancelAltcha();
  }, [cancelAltcha, scopeKey]);

  useEffect(
    () => () => {
      controller.cancel();
    },
    [controller],
  );

  return {
    cancelAltcha,
    dialog:
      requestId === undefined ? null : (
        <AltchaVerificationDialog
          copy={copy}
          isOpen
          key={requestId}
          language={language}
          onCancel={() => {
            if (controller.resolve(requestId, undefined)) {
              setRequestId(undefined);
            }
          }}
          onFailure={(failure) => {
            onFeedback({
              status: "error",
              title: feedbackCopy[failure],
            });
          }}
          onVerified={(value) => {
            if (controller.resolve(requestId, value)) {
              setRequestId(undefined);
            }
          }}
          resetKey={requestId}
        />
      ),
    requestAltcha,
    runWithAltcha,
  };
};
