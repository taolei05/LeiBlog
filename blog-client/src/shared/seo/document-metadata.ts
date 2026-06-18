import { useEffect } from "react";

export type DocumentMetadata = {
  canonicalPath?: string;
  description?: string;
  imageUrl?: string | null;
  keywords?: string[];
  origin?: string;
  title: string;
  type?: "article" | "website";
};

function getCurrentOrigin() {
  if (typeof window === "undefined") {
    return "";
  }

  return window.location.origin;
}

function resolveAbsoluteUrl(pathOrUrl: string | null | undefined, origin: string) {
  if (!pathOrUrl) {
    return undefined;
  }

  try {
    return new URL(pathOrUrl, origin || getCurrentOrigin()).toString();
  } catch {
    return undefined;
  }
}

function upsertMeta(attribute: "name" | "property", key: string, content: string | undefined) {
  const selector = `meta[${attribute}="${key}"]`;
  const existing = document.head.querySelector<HTMLMetaElement>(selector);

  if (!content) {
    existing?.remove();
    return;
  }

  const element = existing ?? document.createElement("meta");
  element.setAttribute(attribute, key);
  element.content = content;

  if (!existing) {
    document.head.appendChild(element);
  }
}

function upsertCanonicalLink(href: string | undefined) {
  const existing = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');

  if (!href) {
    existing?.remove();
    return;
  }

  const element = existing ?? document.createElement("link");
  element.rel = "canonical";
  element.href = href;

  if (!existing) {
    document.head.appendChild(element);
  }
}

export function applyDocumentMetadata(metadata: DocumentMetadata) {
  const origin = metadata.origin ?? getCurrentOrigin();
  const canonicalUrl = resolveAbsoluteUrl(metadata.canonicalPath, origin);
  const imageUrl = resolveAbsoluteUrl(metadata.imageUrl, origin);
  const keywords = metadata.keywords?.filter(Boolean).join(", ");
  const type = metadata.type ?? "website";

  document.title = metadata.title;
  upsertCanonicalLink(canonicalUrl);
  upsertMeta("name", "description", metadata.description);
  upsertMeta("name", "keywords", keywords);
  upsertMeta("property", "og:title", metadata.title);
  upsertMeta("property", "og:description", metadata.description);
  upsertMeta("property", "og:type", type);
  upsertMeta("property", "og:url", canonicalUrl);
  upsertMeta("property", "og:image", imageUrl);
}

export function useDocumentMetadata(metadata: DocumentMetadata | undefined) {
  const canonicalPath = metadata?.canonicalPath;
  const description = metadata?.description;
  const imageUrl = metadata?.imageUrl;
  const keywords = metadata?.keywords?.join(",");
  const origin = metadata?.origin;
  const title = metadata?.title;
  const type = metadata?.type;

  useEffect(() => {
    if (!title) {
      return;
    }

    applyDocumentMetadata({
      canonicalPath,
      description,
      imageUrl,
      keywords: keywords ? keywords.split(",").filter(Boolean) : undefined,
      origin,
      title,
      type,
    });
  }, [canonicalPath, description, imageUrl, keywords, origin, title, type]);
}
