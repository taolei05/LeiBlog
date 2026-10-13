import type { ReactNode } from "react";
import { PhotoView } from "react-photo-view";

import { CodeBlock } from "@astryxdesign/core/CodeBlock";
import type { OutlineItem } from "@astryxdesign/core/Outline";
import { getSafeLinkUrl, resolveContentAssetUrl } from "../../../shared/content-url";

type ArticleMdxContentProps = {
  content: string;
};

type MarkdownBlock =
  | {
      code: string;
      title?: string;
      language: string;
      type: "code";
    }
  | {
      id: string;
      level: 1 | 2 | 3 | 4;
      text: string;
      type: "heading";
    }
  | {
      alt: string;
      src: string;
      type: "image";
    }
  | {
      items: string[];
      type: "list";
    }
  | {
      text: string;
      type: "paragraph";
    }
  | {
      text: string;
      type: "quote";
    };

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

const readImageLine = (line: string) => {
  const match = line.match(/^!\[(?<alt>[^\]]*)\]\((?<src>[^)]+)\)$/u);
  if (match?.groups === undefined) {
    return undefined;
  }

  return {
    alt: match.groups.alt,
    src: match.groups.src,
  };
};

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

const parseMarkdownBlocks = (content: string): MarkdownBlock[] => {
  const blocks: MarkdownBlock[] = [];
  const lines = content.replace(/\r\n/gu, "\n").split("\n");
  let paragraphLines: string[] = [];
  let listLines: string[] = [];
  let codeLines: string[] = [];
  let codeLanguage = "";
  let isInCode = false;
  let headingIndex = 0;

  const flushParagraph = () => {
    if (paragraphLines.length === 0) {
      return;
    }

    const text = paragraphLines.join(" ").trim();
    if (text.length > 0) {
      const image = readImageLine(text);
      blocks.push(
        image === undefined
          ? {
              text,
              type: "paragraph",
            }
          : {
              ...image,
              type: "image",
            },
      );
    }
    paragraphLines = [];
  };

  const flushList = () => {
    if (listLines.length === 0) {
      return;
    }

    blocks.push({
      items: listLines,
      type: "list",
    });
    listLines = [];
  };

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (trimmedLine.startsWith("```")) {
      if (isInCode) {
        const codeFenceInfo = readCodeFenceInfo(codeLanguage);
        blocks.push({
          code: codeLines.join("\n"),
          language: codeFenceInfo.language,
          title: codeFenceInfo.title,
          type: "code",
        });
        codeLines = [];
        codeLanguage = "";
        isInCode = false;
      } else {
        flushParagraph();
        flushList();
        codeLanguage = trimmedLine.replace(/^```/u, "").trim();
        isInCode = true;
      }
      continue;
    }

    if (isInCode) {
      codeLines.push(line);
      continue;
    }

    const headingMatch = trimmedLine.match(/^(#{1,4})\s+(?<text>.+)$/u);
    if (headingMatch?.groups !== undefined) {
      flushParagraph();
      flushList();
      const text = headingMatch.groups.text.trim();
      blocks.push({
        id: createArticleHeadingId(text, headingIndex),
        level: Math.min(4, headingMatch[1]?.length ?? 2) as 1 | 2 | 3 | 4,
        text,
        type: "heading",
      });
      headingIndex += 1;
      continue;
    }

    if (trimmedLine.startsWith("- ") || trimmedLine.startsWith("* ")) {
      flushParagraph();
      listLines.push(trimmedLine.slice(2).trim());
      continue;
    }

    if (trimmedLine.startsWith("> ")) {
      flushParagraph();
      flushList();
      blocks.push({
        text: trimmedLine.slice(2).trim(),
        type: "quote",
      });
      continue;
    }

    if (trimmedLine.length === 0) {
      flushParagraph();
      flushList();
      continue;
    }

    paragraphLines.push(trimmedLine);
  }

  flushParagraph();
  flushList();

  if (isInCode) {
    const codeFenceInfo = readCodeFenceInfo(codeLanguage);
    blocks.push({
      code: codeLines.join("\n"),
      language: codeFenceInfo.language,
      title: codeFenceInfo.title,
      type: "code",
    });
  }

  return blocks;
};

export const parseArticleToc = (content: string): OutlineItem[] =>
  parseMarkdownBlocks(content)
    .filter(
      (block): block is Extract<MarkdownBlock, { type: "heading" }> => block.type === "heading",
    )
    .filter((block) => block.level >= 2)
    .map((block) => ({
      id: block.id,
      label: block.text,
      level: block.level,
    }));

const renderInlineText = (text: string): ReactNode[] => {
  const nodes: ReactNode[] = [];
  const pattern = /(`[^`]+`|\[[^\]]+\]\([^)]+\))/gu;
  let lastIndex = 0;

  text.replace(pattern, (match, _group: string, offset: number) => {
    if (offset > lastIndex) {
      nodes.push(text.slice(lastIndex, offset));
    }

    if (match.startsWith("`")) {
      nodes.push(<code key={`${match}-${offset}`}>{match.slice(1, -1)}</code>);
    } else {
      const linkMatch = match.match(/^\[(?<label>[^\]]+)\]\((?<href>[^)]+)\)$/u);
      if (linkMatch?.groups === undefined) {
        nodes.push(match);
      } else {
        const href = getSafeLinkUrl(linkMatch.groups.href);
        nodes.push(
          href === undefined ? (
            linkMatch.groups.label
          ) : (
            <a href={href} key={`${match}-${offset}`}>
              {linkMatch.groups.label}
            </a>
          ),
        );
      }
    }

    lastIndex = offset + match.length;
    return match;
  });

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
};

const renderHeadingBlock = (block: Extract<MarkdownBlock, { type: "heading" }>, index: number) => {
  if (block.level === 1) {
    return (
      <h1 id={block.id} key={`${block.id}-${index}`}>
        {block.text}
      </h1>
    );
  }

  if (block.level === 3) {
    return (
      <h3 id={block.id} key={`${block.id}-${index}`}>
        {block.text}
      </h3>
    );
  }

  if (block.level === 4) {
    return (
      <h4 id={block.id} key={`${block.id}-${index}`}>
        {block.text}
      </h4>
    );
  }

  return (
    <h2 id={block.id} key={`${block.id}-${index}`}>
      {block.text}
    </h2>
  );
};

export function ArticleMdxContent({ content }: ArticleMdxContentProps) {
  const blocks = parseMarkdownBlocks(content);

  return (
    <article className="article-mdx-content">
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          return renderHeadingBlock(block, index);
        }

        if (block.type === "code") {
          return (
            <CodeBlock
              className="article-mdx-code-block"
              code={block.code}
              hasCopyButton
              hasLanguageLabel={false}
              hasLineNumbers
              key={`code-${index}`}
              language={block.language || undefined}
              title={block.title}
              width="100%"
            />
          );
        }

        if (block.type === "list") {
          return (
            <ul key={`list-${index}`}>
              {block.items.map((item, itemIndex) => (
                <li key={`${item}-${itemIndex}`}>{renderInlineText(item)}</li>
              ))}
            </ul>
          );
        }

        if (block.type === "quote") {
          return <blockquote key={`quote-${index}`}>{renderInlineText(block.text)}</blockquote>;
        }

        if (block.type === "image") {
          const imageUrl = resolveContentAssetUrl(block.src);
          if (imageUrl.length === 0) {
            return null;
          }

          return (
            <figure className="mdx-image-link" key={`${block.src}-${index}`}>
              <PhotoView src={imageUrl}>
                <button
                  aria-label={`预览图片：${block.alt || "文章图片"}`}
                  className="mdx-image-link__preview"
                  type="button"
                >
                  <img alt={block.alt} loading="lazy" src={imageUrl} />
                </button>
              </PhotoView>
            </figure>
          );
        }

        return <p key={`paragraph-${index}`}>{renderInlineText(block.text)}</p>;
      })}
    </article>
  );
}
