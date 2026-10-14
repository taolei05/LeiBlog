import type { Nodes } from "mdast";
import { fromMarkdown } from "mdast-util-from-markdown";
import { mdxFromMarkdown } from "mdast-util-mdx";
import { mdxjs } from "micromark-extension-mdxjs";
import { gfmFromMarkdown } from "mdast-util-gfm";
import { gfm } from "micromark-extension-gfm";
import { translateTexts } from "../../shared/profile-tags";
import type { UserProfileLocale } from "../../shared/profile-tags";

export class ArticleTranslationError extends Error {
  constructor(readonly reason: "invalid-mdx" | "translation-failed" | "content-too-large") {
    super(reason);
  }
}

type TranslateArticleBodyParameters = {
  apiKey: string;
  content: string;
  sourceLocale: UserProfileLocale;
  translate?: typeof translateTexts;
};

export const translateArticleBody = async ({
  apiKey,
  content,
  sourceLocale,
  translate = translateTexts,
}: TranslateArticleBodyParameters) => {
  if (content.length > 100_000) throw new ArticleTranslationError("content-too-large");
  let tree: ReturnType<typeof fromMarkdown>;
  try {
    tree = fromMarkdown(content, {
      extensions: [gfm(), mdxjs()],
      mdastExtensions: [gfmFromMarkdown(), mdxFromMarkdown()],
    });
  } catch {
    throw new ArticleTranslationError("invalid-mdx");
  }
  const segments: { start: number; end: number; text: string; prefix: string; suffix: string }[] =
    [];
  const collect = (node: Nodes) => {
    if (node.type === "text") {
      const start = node.position?.start.offset;
      const end = node.position?.end.offset;
      if (start === undefined || end === undefined) return;
      const rawLines = content.slice(start, end).split(/(\r\n|\r|\n)/);
      const lines = node.value.split(/\r\n|\r|\n/);
      if (Math.ceil(rawLines.length / 2) !== lines.length) return;
      let offset = start;
      rawLines.forEach((raw, index) => {
        const text = lines[index / 2]?.trim();
        if (
          index % 2 === 0 &&
          text &&
          /\p{L}/u.test(text) &&
          !/^(?:https?:\/\/|\S+@\S+\.\S+$)/i.test(text)
        ) {
          if (text.length > 12_000 || segments.length >= 2000)
            throw new ArticleTranslationError("content-too-large");
          const prefix =
            index === 0 ? raw.match(/^[ \t]*/u)?.[0] : raw.match(/^(?:[ \t]*>[ \t]?)*[ \t]*/u)?.[0];
          segments.push({
            start: offset,
            end: offset + raw.length,
            text,
            prefix: prefix ?? "",
            suffix: raw.match(/[ \t]*$/u)?.[0] ?? "",
          });
        }
        offset += raw.length;
      });
    } else if ("children" in node) {
      if (
        (node.type === "mdxJsxFlowElement" || node.type === "mdxJsxTextElement") &&
        ["CodeBlock", "code", "pre", "script", "style"].includes(node.name ?? "")
      )
        return;
      node.children.forEach(collect);
    }
  };
  collect(tree);
  const texts = [...new Set(segments.map((segment) => segment.text))];
  const translations = new Map<string, string>();
  for (let offset = 0; offset < texts.length;) {
    const batch: string[] = [];
    let size = 0;
    while (offset < texts.length && batch.length < 50) {
      const text = texts[offset];
      if (text === undefined) break;
      const bytes = new TextEncoder().encode(JSON.stringify(text)).length;
      if (batch.length > 0 && size + bytes > 40_000) break;
      batch.push(text);
      size += bytes;
      offset++;
    }
    const translated = await translate({
      apiKey,
      texts: batch,
      sourceLocale,
      targetLocale: sourceLocale === "en" ? "zh-CN" : "en",
    });
    if (translated.length !== batch.length || translated.some((value) => !value.trim()))
      throw new ArticleTranslationError("translation-failed");
    batch.forEach((text, index) => translations.set(text, translated[index] ?? text));
  }
  let result = content;
  // Apply ranges backwards so every non-text byte keeps its original position and value.
  for (const segment of segments.reverse()) {
    const text = (translations.get(segment.text) ?? segment.text)
      .replace(/[\r\n]+/g, " ")
      .replace(/[\\`*_{}\[\]<>&|!~#+.()>-]/g, "\\$&");
    result =
      result.slice(0, segment.start) +
      segment.prefix +
      text +
      segment.suffix +
      result.slice(segment.end);
  }
  return result;
};
