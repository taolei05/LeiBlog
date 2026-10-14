import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { AppLanguage } from "../../../../shared/i18n";

type TranslationButtonProps = { isDisabled?: boolean; onClick?: () => void };

const { request, renderButton } = vi.hoisted(() => ({
  request: vi.fn<(input: unknown) => Promise<string>>(),
  renderButton: vi.fn<(props: TranslationButtonProps) => null>(),
}));
vi.mock("../../../../shared/admin-api", () => ({ translateArticleBody: request }));
vi.mock("@astryxdesign/core/Button", () => ({ Button: renderButton }));
import { useArticleTranslation } from "./article-translation";

const renderAction = ({
  target = "en",
  contentZh = "# 中文",
  contentEn = "",
  isSaving = false,
}: {
  target?: AppLanguage;
  contentZh?: string;
  contentEn?: string;
  isSaving?: boolean;
} = {}) => {
  const onTranslated = vi.fn();
  const onFeedback = vi.fn();
  const Harness = () =>
    useArticleTranslation({
      authToken: "synthetic-token",
      language: "zh-CN",
      scopeKey: "article-id",
      contentZh,
      contentEn,
      isSaving,
      onTranslated,
      onFeedback,
    }).renderAction(target);
  renderToStaticMarkup(createElement(Harness));
  const props = renderButton.mock.calls.at(-1)?.[0];
  if (!props) throw new Error("Translation button was not rendered");
  return { props, onTranslated, onFeedback };
};

describe("article translation actions", () => {
  beforeEach(() => {
    request.mockReset();
    renderButton.mockReset().mockReturnValue(null);
  });
  it.each(["en", "zh-CN"] as const)(
    "translates to %s without saving or modifying the source",
    async (target) => {
      request.mockResolvedValue("Translated body");
      const action = renderAction({
        target,
        contentZh: target === "en" ? "# 中文" : "",
        contentEn: target === "en" ? "" : "# English",
      });
      action.props.onClick?.();
      await vi.waitFor(() =>
        expect(action.onTranslated).toHaveBeenCalledWith(target, "Translated body"),
      );
      expect(request).toHaveBeenCalledWith(
        expect.objectContaining({
          content: target === "en" ? "# 中文" : "# English",
          sourceLocale: target === "en" ? "zh-CN" : "en",
          token: "synthetic-token",
          signal: expect.any(AbortSignal),
        }),
      );
      expect(action.onFeedback).toHaveBeenCalledWith("翻译完成，尚未保存。", "success");
    },
  );
  it("requires confirmation before replacing existing text", () => {
    renderAction({ contentEn: "Existing content" }).props.onClick?.();
    expect(request).not.toHaveBeenCalled();
  });
  it.each(["missing-deepl-api-key", "translation-failed"])(
    "keeps both bodies unchanged on %s",
    async (reason) => {
      request.mockRejectedValue(new Error(reason));
      const action = renderAction();
      action.props.onClick?.();
      await vi.waitFor(() =>
        expect(action.onFeedback).toHaveBeenCalledWith(expect.any(String), "error"),
      );
      expect(action.onTranslated).not.toHaveBeenCalled();
    },
  );
  it("disables empty-source and saving actions", () => {
    expect(renderAction({ contentZh: "" }).props.isDisabled).toBe(true);
    expect(renderAction({ isSaving: true }).props.isDisabled).toBe(true);
    expect(request).not.toHaveBeenCalled();
  });
});
