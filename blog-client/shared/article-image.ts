import { fromHtml } from "hast-util-from-html";

export const MAX_ARTICLE_IMAGE_DIMENSION = 10_000;

export const readImageDimension = (value: unknown) => {
  const number =
    typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isInteger(number) && number > 0 && number <= MAX_ARTICLE_IMAGE_DIMENSION
    ? number
    : undefined;
};

export type ArticleImageSource = {
  url: string;
  alt?: string | null;
  title?: string | null;
  width?: number;
  height?: number;
};

type ArticleImageHtmlPart =
  | { type: "text"; value: string }
  | { type: "image"; image: ArticleImageSource };

const IMAGE_ATTRIBUTES = new Set(["src", "alt", "title", "width", "height"]);

export const readArticleImageHtml = (value: string): ArticleImageHtmlPart[] | undefined => {
  const tree = fromHtml(value, { fragment: true });
  const parts: ArticleImageHtmlPart[] = [];
  for (const node of tree.children) {
    if (node.type === "text") {
      parts.push({ type: "text", value: node.value });
      continue;
    }
    if (
      node.type !== "element" ||
      node.tagName !== "img" ||
      Object.keys(node.properties).some((name) => !IMAGE_ATTRIBUTES.has(name)) ||
      typeof node.properties.src !== "string"
    ) {
      return undefined;
    }
    parts.push({
      type: "image",
      image: {
        url: node.properties.src,
        alt: typeof node.properties.alt === "string" ? node.properties.alt : "",
        title: typeof node.properties.title === "string" ? node.properties.title : undefined,
        width: readImageDimension(node.properties.width),
        height: readImageDimension(node.properties.height),
      },
    });
  }
  return parts.some((part) => part.type === "image") ? parts : undefined;
};
