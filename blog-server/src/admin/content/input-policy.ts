import { ContentInputError } from "./errors";

export const normalizeContentUrl = (value: string | null | undefined) => {
  const url = value?.trim() ?? "";
  if (url.length === 0) {
    return null;
  }
  if (url.length > 4096 || /[\\\u0000-\u001f\u007f]/.test(value ?? "")) {
    throw new ContentInputError("invalid-url", "Content URL is invalid.");
  }
  if (url.startsWith("/") && !url.startsWith("//")) {
    return url;
  }
  try {
    const parsed = new URL(url);
    if (
      (parsed.protocol === "https:" || parsed.protocol === "http:") &&
      parsed.hostname.length > 0
    ) {
      return url;
    }
  } catch {
    throw new ContentInputError("invalid-url", "Content URL is invalid.");
  }
  throw new ContentInputError("invalid-url", "Content URL is invalid.");
};

export const parsePublicationDate = (value: string | null | undefined) => {
  if (value === undefined) {
    return undefined;
  }
  if (value === null || value.trim().length === 0) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new ContentInputError("invalid-date", "Publication date is invalid.");
  }
  return date;
};
