export function extractSvgDocument(value: string) {
  const openMatch = /<svg\b/i.exec(value);
  if (!openMatch || openMatch.index === undefined) return value.trim();

  const endIndex = value.toLowerCase().indexOf("</svg>", openMatch.index);
  if (endIndex === -1) return value.slice(openMatch.index).trim();

  return value.slice(openMatch.index, endIndex + "</svg>".length).trim();
}

export function isSvgAssetUrl(value: string | null | undefined) {
  const url = value?.trim();
  if (!url) return false;

  return url.toLowerCase().startsWith("data:image/svg+xml") || /\.svg(?:[?#]|$)/i.test(url);
}

function getCurrentOrigin() {
  if (typeof window === "undefined") return undefined;

  return window.location.origin;
}

function isCrossOriginUrl(value: string, currentOrigin = getCurrentOrigin()) {
  if (value.toLowerCase().startsWith("data:")) return false;
  if (!/^(?:[a-z][a-z\d+\-.]*:)?\/\//i.test(value)) return false;
  if (!currentOrigin) return true;

  try {
    return new URL(value, currentOrigin).origin !== currentOrigin;
  } catch {
    return false;
  }
}

export function shouldInlineSvgAssetUrl(value: string | null | undefined, currentOrigin?: string) {
  const url = value?.trim();
  if (!url || !isSvgAssetUrl(url)) return false;
  if (url.toLowerCase().startsWith("data:image/svg+xml")) return true;

  return !isCrossOriginUrl(url, currentOrigin);
}

export function toSvgDataUri(value: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(extractSvgDocument(value))}`;
}
