import { toast } from "@heroui/react";

type OperationToastVariant = "danger" | "info" | "success" | "warning";

const dangerKeywords = [
  "失败",
  "错误",
  "缺失",
  "不能为空",
  "不能",
  "不可",
  "无效",
  "拒绝",
  "禁止",
  "不存在",
  "过期",
  "异常",
];

const warningKeywords = ["请选择", "请输入", "只读", "需要", "暂无", "未配置"];

function inferToastVariant(message: string): OperationToastVariant {
  if (dangerKeywords.some((keyword) => message.includes(keyword))) {
    return "danger";
  }

  if (warningKeywords.some((keyword) => message.includes(keyword))) {
    return "warning";
  }

  return "success";
}

export function showOperationToast(
  message: string,
  variant: OperationToastVariant = inferToastVariant(message),
) {
  if (!message.trim()) {
    return;
  }

  if (variant === "danger") {
    toast.danger(message);
    return;
  }

  if (variant === "warning") {
    toast.warning(message);
    return;
  }

  if (variant === "info") {
    toast.info(message);
    return;
  }

  toast.success(message);
}

export function showSuccessToast(message: string, description?: string) {
  toast.success(message, { description });
}

export function showErrorToast(message: string, description?: string) {
  toast.danger(message, { description });
}
