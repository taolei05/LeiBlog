const frontmatterPattern = /^---[\s\S]*?---/;
const codeBlockPattern = /```[\s\S]*?```/g;
const jsxTagPattern = /<[^>]+>/g;
const markdownSyntaxPattern = /[#*_>`{}[\]()|:-]/g;
const whitespacePattern = /\s+/g;

export function createArticleSummary(
  summary: string | null | undefined,
  contentMdx: string,
  maxLength = 200
) {
  if (summary === null) return null;

  const trimmedSummary = summary?.trim();
  if (trimmedSummary) return trimmedSummary.slice(0, 500);

  const plainText = contentMdx
    .replace(frontmatterPattern, " ")
    .replace(codeBlockPattern, " ")
    .replace(jsxTagPattern, " ")
    .replace(markdownSyntaxPattern, " ")
    .replace(whitespacePattern, " ")
    .trim();

  return plainText ? plainText.slice(0, maxLength) : null;
}
