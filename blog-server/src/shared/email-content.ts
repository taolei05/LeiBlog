import type { Definition, Nodes } from "mdast";
import { fromMarkdown } from "mdast-util-from-markdown";
import { fromHtml } from "hast-util-from-html";

export const escapeEmailHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

export const resolveEmailAssetUrl = (value: string | null | undefined, baseUrl: string) => {
  const input = value?.trim();
  if (!input || /[\u0000-\u001f\u007f]/.test(input) || input.length > 2048) return null;
  try {
    const base = new URL(baseUrl);
    const url = new URL(input, base.origin + "/");
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return null;
    if (url.origin === base.origin && url.pathname.startsWith("/uploads/")) {
      url.searchParams.set("media-v", "2");
    }
    return url.href;
  } catch {
    return null;
  }
};

export const renderEmailLogo = (
  branding: {
    logoUrl?: string | null;
    siteName: string;
    siteInitial: string;
  },
  baseUrl: string,
) => {
  const url = resolveEmailAssetUrl(branding.logoUrl, baseUrl);
  return url === null
    ? escapeEmailHtml(branding.siteInitial)
    : `<img alt="${escapeEmailHtml(branding.siteName)} logo" src="${escapeEmailHtml(url)}" width="34" height="34" style="display:block;width:34px;height:34px;border:0;object-fit:contain;" />`;
};

export const renderEmailExcerpt = (content: string, baseUrl: string) => {
  const tree = fromMarkdown(content.slice(0, 50_000));
  const definitions = new Map<string, Definition>();
  const collect = (node: Nodes) => {
    if (node.type === "definition") definitions.set(node.identifier.toLowerCase(), node);
    if ("children" in node) node.children.forEach(collect);
  };
  collect(tree);
  let remainingText = 2000;
  let imageCount = 0;
  const text: string[] = [];
  const renderText = (value: string) => {
    const excerpt = value.slice(0, remainingText);
    remainingText -= excerpt.length;
    text.push(excerpt);
    return escapeEmailHtml(excerpt);
  };
  const renderImage = (source: string | undefined, alt: string, title?: string | null) => {
    const url = resolveEmailAssetUrl(source, baseUrl);
    if (url === null || imageCount >= 8) return renderText(alt);
    imageCount++;
    const label = alt.slice(0, 120);
    text.push(`\n${label}: ${url}\n`);
    const titleAttribute = title ? ` title="${escapeEmailHtml(title.slice(0, 200))}"` : "";
    return `<a href="${escapeEmailHtml(url)}" style="display:block;margin:12px 0;"><img src="${escapeEmailHtml(url)}" alt="${escapeEmailHtml(label)}"${titleAttribute} width="438" style="display:block;width:100%;max-width:438px;height:auto;border:0;" /></a>`;
  };
  const render = (node: Nodes): string => {
    if (node.type === "definition") return "";
    if (node.type === "image" || node.type === "imageReference") {
      const source = node.type === "image" ? node : definitions.get(node.identifier.toLowerCase());
      return renderImage(source?.url, node.alt ?? "", source?.title);
    }
    if (node.type === "html") {
      const fragment = fromHtml(node.value, { fragment: true });
      if (
        fragment.children.every(
          (child) => child.type === "text" || (child.type === "element" && child.tagName === "img"),
        )
      ) {
        return fragment.children
          .map((child) => {
            if (child.type === "text") return renderText(child.value);
            if (child.type !== "element") return "";
            const { src, alt, title } = child.properties;
            return renderImage(
              typeof src === "string" ? src : undefined,
              typeof alt === "string" ? alt : "",
              typeof title === "string" ? title : undefined,
            );
          })
          .join("");
      }
      return renderText(node.value);
    }
    if (node.type === "break") {
      text.push("\n");
      return "<br />";
    }
    if ("value" in node) return renderText(node.value);
    if (!("children" in node)) return "";
    const children = node.children.map(render).join("");
    if (node.type === "paragraph" || node.type === "heading" || node.type === "listItem") {
      text.push("\n");
      return `<div style="margin:0 0 10px;white-space:pre-wrap;">${children}</div>`;
    }
    if (node.type === "strong") return `<strong>${children}</strong>`;
    if (node.type === "emphasis") return `<em>${children}</em>`;
    return children;
  };
  const html = render(tree);
  return { html, text: text.join("").trim() };
};
