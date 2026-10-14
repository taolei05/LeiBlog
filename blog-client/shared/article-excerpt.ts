import type { Nodes } from "mdast";
import { fromMarkdown } from "mdast-util-from-markdown";

export const readArticleExcerptText = (source: string) => {
  const read = (node: Nodes): string => {
    if (
      node.type === "image" ||
      node.type === "imageReference" ||
      node.type === "definition" ||
      node.type === "html"
    )
      return " ";
    if ("value" in node) return node.value;
    if ("children" in node) return node.children.map(read).join(node.type === "root" ? " " : "");
    return " ";
  };
  return read(fromMarkdown(source)).replace(/\s+/g, " ").trim();
};
