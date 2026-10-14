import { createElement, Fragment, useState } from "react";
import type { ReactNode } from "react";
import { PhotoView } from "react-photo-view";
import { fromMarkdown } from "mdast-util-from-markdown";
import { toString } from "mdast-util-to-string";
import type { Definition, Heading, Nodes } from "mdast";

import { CodeBlock } from "@astryxdesign/core/CodeBlock";
import type { OutlineItem } from "@astryxdesign/core/Outline";
import { Spinner } from "@astryxdesign/core/Spinner";
import { getSafeLinkUrl, resolveContentAssetUrl } from "../../../shared/content-url";
import type { AppLanguage } from "../../../shared/i18n";
import { readArticleImageHtml } from "../../../shared/article-image";
import type { ArticleImageSource } from "../../../shared/article-image";

type ArticleMdxContentProps = { content: string; language?: AppLanguage };

const normalizeHeadingId = (text: string) => {
  const normalizedText = text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/gu, "-")
    .replace(/^-+|-+$/g, "");
  return normalizedText.length > 0 ? normalizedText : "section";
};

export const createArticleHeadingId = (text: string, index: number) =>
  `${normalizeHeadingId(text)}-${index + 1}`;

const CODE_FENCE_FILE_ATTRIBUTE_KEYS = new Set(["file", "filename", "title"]);
const CODE_FENCE_LANGUAGE_LABELS: Record<string, string> = {
  js: "javascript",
  jsx: "javascript jsx",
  md: "markdown",
  py: "python",
  rb: "ruby",
  rs: "rust",
  sh: "shell",
  ts: "typescript",
  tsx: "typescript tsx",
  txt: "plaintext",
  yml: "yaml",
};
const getCodeFenceLanguageLabel = (language: string) =>
  CODE_FENCE_LANGUAGE_LABELS[language] ?? language;
const cleanCodeFenceToken = (value: string) => value.replace(/^["']|["']$/gu, "").trim();

const readCodeFenceInfo = (value: string) => {
  const tokens =
    value
      .match(/"[^"]*"|'[^']*'|\S+/gu)
      ?.map(cleanCodeFenceToken)
      .filter(Boolean) ?? [];
  const language = tokens[0]?.toLowerCase() || "plaintext";
  let fileName: string | undefined;
  for (const token of tokens.slice(1)) {
    const separatorIndex = token.indexOf("=");
    if (separatorIndex > 0) {
      const key = token.slice(0, separatorIndex).toLowerCase();
      const attributeValue = cleanCodeFenceToken(token.slice(separatorIndex + 1));
      if (CODE_FENCE_FILE_ATTRIBUTE_KEYS.has(key) && attributeValue.length > 0) {
        fileName = attributeValue;
        break;
      }
      continue;
    }
    fileName = token;
    break;
  }
  const languageLabel = getCodeFenceLanguageLabel(language);
  return {
    language,
    title:
      fileName === undefined
        ? language === "plaintext"
          ? undefined
          : languageLabel
        : `${fileName} - ${languageLabel}`,
  };
};

const readArticleDocument = (content: string) => {
  const tree = fromMarkdown(content);
  const headings: Heading[] = [];
  const definitions = new Map<string, Definition>();
  const visit = (node: Nodes) => {
    if (node.type === "heading") headings.push(node);
    if (node.type === "definition" && !definitions.has(node.identifier))
      definitions.set(node.identifier, node);
    if ("children" in node) node.children.forEach(visit);
  };
  visit(tree);
  return { tree, headings, definitions };
};

export const parseArticleToc = (content: string): OutlineItem[] =>
  readArticleDocument(content)
    .headings.map((heading, index) => ({
      id: createArticleHeadingId(toString(heading), index),
      label: toString(heading),
      level: heading.depth,
    }))
    .filter((heading) => heading.level >= 2);

type ArticleImageProps = {
  alt: string;
  language: AppLanguage;
  linked: boolean;
  src: string;
  title?: string | null;
  width?: number;
  height?: number;
};

const ArticleImage = ({ alt, language, linked, src, title, width, height }: ArticleImageProps) => {
  const [state, setState] = useState<"error" | "loading" | "ready">("loading");
  const loadingLabel = language === "en" ? "Loading image..." : "图片加载中...";
  const failureLabel = language === "en" ? "Image could not be loaded." : "图片加载失败。";
  const image = (
    <img
      alt={alt}
      decoding="async"
      loading="lazy"
      onError={() => setState("error")}
      onLoad={() => setState("ready")}
      ref={(element) => {
        if (element?.complete) setState(element.naturalWidth > 0 ? "ready" : "error");
      }}
      src={src}
      title={title ?? undefined}
      width={width}
      height={height}
      style={
        width !== undefined && height !== undefined
          ? { aspectRatio: `${width} / ${height}` }
          : height !== undefined
            ? { height }
            : undefined
      }
    />
  );
  return (
    <span className="mdx-image-link" data-image-state={state}>
      {state !== "ready" ? (
        <span className="mdx-image-link__status" role="status">
          {state === "loading" ? (
            <Spinner aria-hidden="true" label={loadingLabel} size="sm" />
          ) : null}
          {state === "loading" ? loadingLabel : failureLabel}
        </span>
      ) : null}
      {linked ? (
        image
      ) : (
        <PhotoView src={src}>
          <button
            aria-label={
              language === "en"
                ? `Preview image: ${alt || "Article image"}`
                : `预览图片：${alt || "文章图片"}`
            }
            className="mdx-image-link__preview"
            disabled={state !== "ready"}
            type="button"
          >
            {image}
          </button>
        </PhotoView>
      )}
    </span>
  );
};

export function ArticleMdxContent({ content, language = "zh-CN" }: ArticleMdxContentProps) {
  const { tree, headings, definitions } = readArticleDocument(content);
  const headingIds = new Map(
    headings.map((heading, index) => [heading, createArticleHeadingId(toString(heading), index)]),
  );
  const renderChildren = (nodes: readonly Nodes[], linked = false): ReactNode =>
    nodes.map((node, index) => <Fragment key={index}>{renderNode(node, linked)}</Fragment>);
  const renderImage = (image: ArticleImageSource, linked: boolean) => {
    const src = resolveContentAssetUrl(image.url);
    return src ? (
      <ArticleImage
        alt={image.alt ?? ""}
        key={src}
        language={language}
        linked={linked}
        src={src}
        title={image.title}
        width={image.width}
        height={image.height}
      />
    ) : null;
  };
  const renderNode = (node: Nodes, linked: boolean): ReactNode => {
    switch (node.type) {
      case "root":
        return renderChildren(node.children);
      case "text":
        return node.value;
      case "html": {
        const parts = readArticleImageHtml(node.value);
        return parts === undefined
          ? node.value
          : parts.map((part, index) => (
              <Fragment key={index}>
                {part.type === "text" ? part.value : renderImage(part.image, linked)}
              </Fragment>
            ));
      }
      case "paragraph":
        return <p>{renderChildren(node.children, linked)}</p>;
      case "heading":
        return createElement(
          `h${node.depth}`,
          { id: headingIds.get(node) },
          renderChildren(node.children, linked),
        );
      case "code": {
        const info = readCodeFenceInfo([node.lang, node.meta].filter(Boolean).join(" "));
        return (
          <CodeBlock
            className="article-mdx-code-block"
            code={node.value}
            hasCopyButton
            hasLanguageLabel={false}
            hasLineNumbers
            language={info.language}
            title={info.title}
            width="100%"
          />
        );
      }
      case "inlineCode":
        return <code>{node.value}</code>;
      case "strong":
        return <strong>{renderChildren(node.children, linked)}</strong>;
      case "emphasis":
        return <em>{renderChildren(node.children, linked)}</em>;
      case "break":
        return <br />;
      case "thematicBreak":
        return <hr />;
      case "blockquote":
        return <blockquote>{renderChildren(node.children, linked)}</blockquote>;
      case "list":
        return node.ordered ? (
          <ol start={node.start ?? undefined}>{renderChildren(node.children, linked)}</ol>
        ) : (
          <ul>{renderChildren(node.children, linked)}</ul>
        );
      case "listItem":
        return <li>{renderChildren(node.children, linked)}</li>;
      case "image":
        return renderImage(node, linked);
      case "imageReference": {
        const definition = definitions.get(node.identifier);
        return definition ? renderImage({ ...definition, alt: node.alt }, linked) : node.alt;
      }
      case "link":
      case "linkReference": {
        const target = node.type === "link" ? node : definitions.get(node.identifier);
        const href = getSafeLinkUrl(target?.url);
        const children = renderChildren(node.children, linked || href !== undefined);
        return href === undefined ? (
          children
        ) : (
          <a href={href} title={target?.title ?? undefined}>
            {children}
          </a>
        );
      }
      default:
        return null;
    }
  };
  return <article className="article-mdx-content">{renderChildren(tree.children)}</article>;
}
