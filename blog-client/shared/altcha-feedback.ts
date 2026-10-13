import type { AppLanguage } from "./i18n";

export type AltchaFeedback = {
  status: "info" | "success" | "error";
  title: string;
};

type AltchaSuccessAction =
  | "login"
  | "register"
  | "password-reset"
  | "email-code"
  | "email-code-request"
  | "comment"
  | "reply"
  | "message"
  | "message-reply";

export const getAltchaFeedbackCopy = (language: AppLanguage) =>
  language === "en"
    ? {
        processing: "Verification completed. Processing your request...",
        failed: "Verification failed. Please try again.",
        expired: "Verification expired. Please verify again.",
        actionFailed: "The action could not be completed. Please try again.",
      }
    : {
        processing: "人机验证已完成，正在处理，请稍候。",
        failed: "验证失败，请重试。",
        expired: "验证已过期，请重新验证。",
        actionFailed: "操作未完成，请重试。",
      };

export const getAltchaSuccessMessage = (language: AppLanguage, action: AltchaSuccessAction) => {
  const messages: Record<AltchaSuccessAction, string> =
    language === "en"
      ? {
          login: "Verification successful. You are signed in.",
          register: "Verification successful. Your account is created and you are signed in.",
          "password-reset": "Verification successful. Your password has been reset.",
          "email-code": "Verification successful. The verification code has been sent.",
          "email-code-request":
            "Verification successful. The code request has been processed. Please check your email.",
          comment: "Verification successful. Your comment has been submitted.",
          reply: "Verification successful. Your reply has been submitted.",
          message: "Verification successful. Your message has been submitted.",
          "message-reply": "Verification successful. Your reply has been submitted.",
        }
      : {
          login: "验证成功，登录成功。",
          register: "验证成功，账号已创建并登录。",
          "password-reset": "验证成功，密码已重置。",
          "email-code": "验证成功，验证码已发送。",
          "email-code-request": "验证成功，验证码请求已处理，请检查邮箱。",
          comment: "验证成功，评论已提交。",
          reply: "验证成功，回复已提交。",
          message: "验证成功，留言已提交。",
          "message-reply": "验证成功，留言回复已提交。",
        };
  return messages[action];
};

export type AltchaActionResult<Result> =
  | { status: "cancelled" }
  | { status: "completed"; value: Result };

type RunAltchaActionParameters<Result> = {
  requestAltcha: () => Promise<string | undefined>;
  runAction: (proof: string) => Promise<Result>;
  onVerified: () => void;
  onSuccess: (value: Result) => void;
  onFailure: (error: unknown) => void;
};

export const runAltchaAction = async <Result>({
  requestAltcha,
  runAction,
  onVerified,
  onSuccess,
  onFailure,
}: RunAltchaActionParameters<Result>): Promise<AltchaActionResult<Result>> => {
  try {
    const proof = await requestAltcha();
    if (proof === undefined) {
      return { status: "cancelled" };
    }
    onVerified();
    const value = await runAction(proof);
    onSuccess(value);
    return { status: "completed", value };
  } catch (error) {
    onFailure(error);
    throw error;
  }
};
