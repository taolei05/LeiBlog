import { describe, expect, it } from "vite-plus/test";
import { readArticleExcerptText } from "./article-excerpt";

describe("article card excerpts", () => {
  it("omits HTML and Markdown image markup and destinations", () => {
    expect(
      readArticleExcerptText(
        'Hello <img height="134" width="233" src="/uploads/photo.jpg" /> world ![caption](/uploads/second.png)',
      ),
    ).toBe("Hello world");
    expect(readArticleExcerptText("Before ![photo][ref] after\n\n[ref]: /uploads/image.jpg")).toBe(
      "Before after",
    );
  });
  it("keeps readable text and link labels without formatting code or URLs", () => {
    expect(
      readArticleExcerptText("# Title\n\nA **good** [article](https://example.test) and `code`."),
    ).toBe("Title A good article and code.");
  });
});
