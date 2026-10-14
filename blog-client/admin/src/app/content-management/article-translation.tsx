import { useEffect, useRef, useState } from "react";
import { Languages } from "lucide-react";
import { AlertDialog } from "@astryxdesign/core/AlertDialog";
import { Button } from "@astryxdesign/core/Button";
import { translateArticleBody } from "../../../../shared/admin-api";
import type { AppLanguage } from "../../../../shared/i18n";

const COPY = {
  "zh-CN": {
    toEnglish: "翻译为英文",
    toChinese: "翻译为中文",
    title: "覆盖现有正文？",
    description: "目标语言已有正文，确认后将被翻译结果替换。",
    confirm: "翻译并替换",
    cancel: "取消",
    success: "翻译完成，尚未保存。",
    failed: "翻译失败，原正文未修改。",
    missing: "未配置 DeepL API key。",
    invalid: "正文 MDX 格式无效，原正文未修改。",
    large: "正文过长，请拆分后翻译。",
  },
  en: {
    toEnglish: "Translate to English",
    toChinese: "Translate to Chinese",
    title: "Replace existing content?",
    description: "The target language already has content. Translation will replace it.",
    confirm: "Translate and replace",
    cancel: "Cancel",
    success: "Translation complete. Not saved yet.",
    failed: "Translation failed. Original content was not changed.",
    missing: "DeepL API key is not configured.",
    invalid: "Invalid MDX. Original content was not changed.",
    large: "Content is too long. Split it before translating.",
  },
};

type UseArticleTranslationParameters = {
  authToken: string;
  language: AppLanguage;
  scopeKey: string | null;
  contentZh: string;
  contentEn: string;
  isSaving: boolean;
  onTranslated: (locale: AppLanguage, content: string) => void;
  onFeedback: (message: string, status: "success" | "error") => void;
};

export const useArticleTranslation = ({
  authToken,
  language,
  scopeKey,
  contentZh,
  contentEn,
  isSaving,
  onTranslated,
  onFeedback,
}: UseArticleTranslationParameters) => {
  const copy = COPY[language];
  const [pending, setPending] = useState<AppLanguage | null>(null);
  const [confirmation, setConfirmation] = useState<AppLanguage | null>(null);
  const controller = useRef<AbortController | null>(null);
  const activeScope = useRef(scopeKey);
  activeScope.current = scopeKey;
  useEffect(() => {
    setPending(null);
    setConfirmation(null);
    controller.current?.abort();
    return () => controller.current?.abort();
  }, [scopeKey]);

  const perform = async (target: AppLanguage) => {
    if (controller.current !== null && !controller.current.signal.aborted) return;
    const request = new AbortController();
    controller.current = request;
    setConfirmation(null);
    setPending(target);
    try {
      const content = await translateArticleBody({
        content: target === "en" ? contentZh : contentEn,
        sourceLocale: target === "en" ? "zh-CN" : "en",
        token: authToken,
        signal: request.signal,
      });
      if (request.signal.aborted || activeScope.current !== scopeKey) return;
      onTranslated(target, content);
      onFeedback(copy.success, "success");
    } catch (error) {
      if (request.signal.aborted || activeScope.current !== scopeKey) return;
      const reason = error instanceof Error ? error.message : "";
      onFeedback(
        reason === "missing-deepl-api-key"
          ? copy.missing
          : reason === "invalid-mdx"
            ? copy.invalid
            : reason === "content-too-large"
              ? copy.large
              : copy.failed,
        "error",
      );
    } finally {
      if (controller.current === request) {
        controller.current = null;
        setPending(null);
      }
    }
  };
  const renderAction = (target: AppLanguage) => (
    <Button
      icon={<Languages size={16} />}
      label={target === "en" ? copy.toEnglish : copy.toChinese}
      isLoading={pending === target}
      isDisabled={isSaving || pending !== null || !(target === "en" ? contentZh : contentEn).trim()}
      onClick={() => {
        if ((target === "en" ? contentEn : contentZh).trim()) setConfirmation(target);
        else void perform(target);
      }}
      variant="secondary"
      size="sm"
      type="button"
    />
  );
  return {
    isTranslating: pending !== null,
    renderAction,
    confirmation:
      confirmation === null ? null : (
        <AlertDialog
          isOpen
          title={copy.title}
          description={copy.description}
          actionLabel={copy.confirm}
          cancelLabel={copy.cancel}
          onAction={() => {
            void perform(confirmation);
          }}
          onOpenChange={(open) => {
            if (!open) setConfirmation(null);
          }}
        />
      ),
  };
};
