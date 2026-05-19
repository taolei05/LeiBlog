import type { ReactNode } from "react";

import { resolveApiAssetUrl } from "../../../shared/api/api-base-url";
import { MdxCodeBlock, MdxRenderer } from "../../../shared/mdx/MdxRenderer";
import { createHeadingId } from "./blogApi";

type MdxBlock =
  | {
      id: string;
      level: 2 | 3;
      text: string;
      type: "heading";
    }
  | {
      language?: string;
      text: string;
      type: "code";
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
      alt: string;
      src: string;
      type: "image";
    }
  | {
      headers: string[];
      rows: string[][];
      type: "table";
    }
  | {
      type: "rule";
    };

function stripFrontmatter(content: string) {
  return content.replace(/^---[\s\S]*?---\s*/, "").trim();
}

function cleanInlineMarkdown(value: string) {
  return value
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)]\([^)]+\)/g, "$1");
}

function splitTableRow(line: string) {
  return line
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((cell) => cleanInlineMarkdown(cell.trim()));
}

function isTableSeparator(line: string | undefined) {
  return Boolean(line?.trim().match(/^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/));
}

function parseBlocks(content: string) {
  const blocks: MdxBlock[] = [];
  const lines = stripFrontmatter(content).split("\n");
  let index = 0;
  let headingIndex = 0;

  while (index < lines.length) {
    const line = lines[index]?.trimEnd() ?? "";
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    if (trimmed === "---") {
      blocks.push({ type: "rule" });
      index += 1;
      continue;
    }

    const fence = trimmed.match(/^```(\w+)?/);
    if (fence) {
      const codeLines: string[] = [];
      index += 1;

      while (index < lines.length && !lines[index]?.trim().startsWith("```")) {
        codeLines.push(lines[index] ?? "");
        index += 1;
      }

      blocks.push({
        language: fence[1],
        text: codeLines.join("\n"),
        type: "code",
      });
      index += 1;
      continue;
    }

    const heading = trimmed.match(/^(##|###)\s+(.+)$/);
    if (heading) {
      const text = cleanInlineMarkdown(heading[2] ?? "");
      blocks.push({
        id: createHeadingId(text, headingIndex),
        level: heading[1] === "###" ? 3 : 2,
        text,
        type: "heading",
      });
      headingIndex += 1;
      index += 1;
      continue;
    }

    const image = trimmed.match(/^!\[([^\]]*)]\(([^)]+)\)$/);
    if (image) {
      blocks.push({
        alt: image[1] ?? "",
        src: image[2] ?? "",
        type: "image",
      });
      index += 1;
      continue;
    }

    if (trimmed.startsWith("- ")) {
      const items: string[] = [];
      while (index < lines.length && lines[index]?.trim().startsWith("- ")) {
        items.push(cleanInlineMarkdown(lines[index]?.trim().slice(2) ?? ""));
        index += 1;
      }

      blocks.push({ items, type: "list" });
      continue;
    }

    if (trimmed.includes("|") && isTableSeparator(lines[index + 1])) {
      const headers = splitTableRow(trimmed);
      const rows: string[][] = [];
      index += 2;

      while (index < lines.length && (lines[index] ?? "").trim().includes("|")) {
        rows.push(splitTableRow(lines[index] ?? ""));
        index += 1;
      }

      blocks.push({ headers, rows, type: "table" });
      continue;
    }

    const paragraphLines = [trimmed];
    index += 1;

    while (index < lines.length) {
      const nextLine = lines[index]?.trim() ?? "";
      if (
        !nextLine ||
        nextLine.startsWith("## ") ||
        nextLine.startsWith("### ") ||
        nextLine.startsWith("```") ||
        nextLine.startsWith("- ") ||
        nextLine.startsWith("![") ||
        nextLine === "---"
      ) {
        break;
      }

      paragraphLines.push(nextLine);
      index += 1;
    }

    blocks.push({
      text: cleanInlineMarkdown(paragraphLines.join(" ")),
      type: "paragraph",
    });
  }

  return blocks;
}

function renderBlock(block: MdxBlock, index: number): ReactNode {
  switch (block.type) {
    case "heading": {
      const Heading = block.level === 2 ? "h2" : "h3";
      return (
        <Heading id={block.id} key={`${block.id}-${index}`}>
          {block.text}
        </Heading>
      );
    }
    case "code":
      return (
        <MdxCodeBlock key={`code-${index}`} language={block.language}>
          {block.text}
        </MdxCodeBlock>
      );
    case "image": {
      const imageSrc = resolveApiAssetUrl(block.src) ?? block.src;
      return (
        <figure className="mdx-image-link" key={`image-${index}`}>
          <a href={imageSrc} rel="noreferrer" target="_blank">
            <img alt={block.alt} loading="lazy" src={imageSrc} />
          </a>
        </figure>
      );
    }
    case "list":
      return (
        <ul key={`list-${index}`}>
          {block.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      );
    case "paragraph":
      return <p key={`paragraph-${index}`}>{block.text}</p>;
    case "rule":
      return <hr className="mdx-rule" key={`rule-${index}`} />;
    case "table":
      return (
        <div className="mdx-table-wrap" key={`table-${index}`}>
          <table>
            <thead>
              <tr>
                {block.headers.map((header) => (
                  <th key={header}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, rowIndex) => (
                <tr key={`row-${rowIndex}`}>
                  {row.map((cell, cellIndex) => (
                    <td key={`${cell}-${cellIndex}`}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
  }
}

export function ArticleMdxContent({ contentMdx }: { contentMdx: string }) {
  const blocks = parseBlocks(contentMdx);

  return <MdxRenderer>{blocks.map(renderBlock)}</MdxRenderer>;
}
