import { describe, expect, test } from "bun:test";

import { isMediaFileContentValid } from "./file-policy";

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j9WQAAAAASUVORK5CYII=",
  "base64",
);

describe("media content validation", () => {
  test("accepts actual PNG bytes and rejects an extension mismatch", async () => {
    expect(await isMediaFileContentValid({ bytes: png, fileFormat: "png" })).toBe(true);
    expect(await isMediaFileContentValid({ bytes: png, fileFormat: "jpg" })).toBe(false);
  });

  test.each(["png", "jpg", "gif", "docx", "pdf", "mp4"])(
    "rejects HTML renamed to %s",
    async (fileFormat) => {
      expect(
        await isMediaFileContentValid({
          bytes: Buffer.from("<!doctype html><script>alert(document.cookie)</script>"),
          fileFormat,
        }),
      ).toBe(false);
    },
  );

  test("rejects SVG, including scripts and foreignObject payloads", async () => {
    for (const bytes of [
      Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'),
      Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><foreignObject /></svg>'),
    ]) {
      expect(await isMediaFileContentValid({ bytes, fileFormat: "svg" })).toBe(false);
      expect(await isMediaFileContentValid({ bytes, fileFormat: "png" })).toBe(false);
    }
  });

  test("accepts UTF-8 text while rejecting binary and invalid UTF-8 disguised as text", async () => {
    expect(
      await isMediaFileContentValid({
        bytes: Buffer.from("# Article\n\nContent"),
        fileFormat: "md",
      }),
    ).toBe(true);
    expect(
      await isMediaFileContentValid({ bytes: Buffer.from("Plain text"), fileFormat: "txt" }),
    ).toBe(true);
    expect(
      await isMediaFileContentValid({ bytes: Buffer.from([0xff, 0xfe]), fileFormat: "txt" }),
    ).toBe(false);
    expect(
      await isMediaFileContentValid({ bytes: Buffer.from("text\0payload"), fileFormat: "md" }),
    ).toBe(false);
    expect(await isMediaFileContentValid({ bytes: Buffer.alloc(0), fileFormat: "txt" })).toBe(
      false,
    );
  });
});
