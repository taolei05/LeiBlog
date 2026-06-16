const SVG_CLOSE_TAG = "</svg>";

export function extractSvgDocument(value: string) {
  const openMatch = /<svg\b/i.exec(value);
  if (!openMatch || openMatch.index === undefined) return null;

  const endIndex = value.toLowerCase().indexOf(SVG_CLOSE_TAG, openMatch.index);
  if (endIndex === -1) return null;

  return value.slice(openMatch.index, endIndex + SVG_CLOSE_TAG.length).trim();
}

export function normalizeSvgBuffer(bytes: Uint8Array) {
  const svg = extractSvgDocument(new TextDecoder("utf-8", { fatal: false }).decode(bytes));
  if (!svg) return null;

  return new TextEncoder().encode(svg);
}
