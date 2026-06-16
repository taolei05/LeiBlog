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

export function toSvgDataUri(value: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(extractSvgDocument(value))}`;
}
