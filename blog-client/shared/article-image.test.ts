import { describe, expect, it } from "vite-plus/test";

import { readArticleImageHtml, readImageDimension } from "./article-image";

describe("saved article image dimensions", () => {
  it.each([1, "320", 10_000])("accepts bounded pixel dimensions %j", (value) => {
    expect(readImageDimension(value)).toBe(Number(value));
  });
  it.each([undefined, null, "", "auto", "50%", 0, -1, 1.5, 10_001, Infinity, true])(
    "rejects invalid dimensions %j",
    (value) => expect(readImageDimension(value)).toBeUndefined(),
  );

  it("reads only image attributes and preserves surrounding text", () => {
    const parts = readArticleImageHtml(
      'Before<img width="400" height="225" src="/uploads/image.jpg" alt="A &amp; B" />After',
    );
    expect(parts).toEqual([
      { type: "text", value: "Before" },
      {
        type: "image",
        image: {
          url: "/uploads/image.jpg",
          alt: "A & B",
          title: undefined,
          width: 400,
          height: 225,
        },
      },
      { type: "text", value: "After" },
    ]);
  });

  it.each([
    '<img src="/uploads/image.jpg" onerror="alert(1)" />',
    '<img src="/uploads/image.jpg" style="position:fixed" />',
    '<svg><image href="/uploads/image.jpg" /></svg>',
    "<script>alert(1)</script>",
    '<a href="https://example.test"><img src="/uploads/image.jpg" /></a>',
  ])("does not allow other HTML or executable attributes: %s", (value) => {
    expect(readArticleImageHtml(value)).toBeUndefined();
  });
});
