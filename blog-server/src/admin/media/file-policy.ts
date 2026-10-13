import { fileType } from "elysia";

const MEDIA_MIME_TYPES: Record<string, readonly string[]> = {
  doc: ["application/msword", "application/x-cfb"],
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  gif: ["image/gif"],
  ico: ["image/x-icon"],
  jpeg: ["image/jpeg"],
  jpg: ["image/jpeg"],
  mov: ["video/quicktime"],
  mp4: ["video/mp4"],
  pdf: ["application/pdf"],
  png: ["image/png"],
  webm: ["video/webm"],
  webp: ["image/webp"],
};

export const isMediaFileContentValid = async ({
  bytes,
  fileFormat,
}: {
  bytes: Buffer;
  fileFormat: string;
}) => {
  if (bytes.length === 0) {
    return false;
  }

  if (fileFormat === "txt" || fileFormat === "md") {
    try {
      const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      return !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text);
    } catch {
      return false;
    }
  }

  const mimeTypes = Object.prototype.hasOwnProperty.call(MEDIA_MIME_TYPES, fileFormat)
    ? MEDIA_MIME_TYPES[fileFormat]
    : undefined;
  if (mimeTypes === undefined) {
    return false;
  }

  try {
    return await fileType(new Blob([new Uint8Array(bytes)]), [...mimeTypes]);
  } catch {
    return false;
  }
};
