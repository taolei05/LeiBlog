import { status, t } from "elysia";

export const ErrorResponseSchema = t.Object({
  ok: t.Literal(false),
  code: t.String(),
  message: t.String(),
  details: t.Optional(t.Unknown()),
});

export const RateLimitErrorResponseSchema = t.Object({
  ok: t.Literal(false),
  code: t.Literal("RATE_LIMITED"),
  message: t.String(),
  details: t.Object({
    retryAfterSeconds: t.Number(),
  }),
});

export interface ErrorBody {
  ok: false;
  code: string;
  message: string;
  details?: unknown;
}

export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export function createErrorBody(error: AppError): ErrorBody {
  return {
    ok: false,
    code: error.code,
    message: error.message,
    ...(error.details === undefined ? {} : { details: error.details }),
  };
}

export function appStatus(error: AppError) {
  return status(error.statusCode, createErrorBody(error));
}

export function notFound(message = "资源不存在") {
  return new AppError(404, "NOT_FOUND", message);
}

export function unauthorized(message = "请先登录") {
  return new AppError(401, "UNAUTHORIZED", message);
}

export function forbidden(message = "没有权限执行该操作") {
  return new AppError(403, "FORBIDDEN", message);
}

export function conflict(message = "资源已存在") {
  return new AppError(409, "CONFLICT", message);
}

export function tooManyRequests(
  retryAfterSeconds: number,
  message = "请求过于频繁，请稍后再试"
) {
  return new AppError(429, "RATE_LIMITED", message, {
    retryAfterSeconds,
  });
}

export function validationError(message = "请求参数无效", details?: unknown) {
  return new AppError(422, "VALIDATION_ERROR", message, details);
}
