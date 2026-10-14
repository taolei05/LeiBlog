import { describe, expect, test } from "bun:test";
import { translateArticleBody } from "./article-translation";

describe("article body translation", () => {
  test("replaces text only and preserves Markdown, MDX, image dimensions and code exactly", async () => {
    const source =
      '# 标题\r\n\r\n**你好** [链接](https://example.test/path?q=1)\r\n\r\n- 列表\r\n\r\n| 列名 |\r\n| --- |\r\n| 内容 |\r\n\r\n<img width="233" height="134" src="/uploads/image.png?media-v=2" />\r\n\r\n![说明](/uploads/photo.jpg "原始标题")\r\n\r\n```ts\r\nconst code = "不要翻译";\r\n```\r\n\r\n<Callout type="note">提示 {value}</Callout>\r\n';
    const words: Record<string, string> = {
      标题: "Heading",
      你好: "Hello",
      链接: "Link",
      列表: "Item",
      列名: "Column",
      内容: "Content",
      提示: "Note",
    };
    const result = await translateArticleBody({
      content: source,
      sourceLocale: "zh-CN",
      apiKey: "synthetic",
      translate: async ({ texts }) => texts.map((text) => words[text] ?? text),
    });
    let expected = source;
    for (const [from, to] of Object.entries(words)) expected = expected.replace(from, to);
    expect(result).toBe(expected);
  });
  test("supports English to Chinese and escapes translated syntax instead of creating MDX", async () => {
    const result = await translateArticleBody({
      content: "**Hello**",
      sourceLocale: "en",
      apiKey: "synthetic",
      translate: async ({ sourceLocale, targetLocale }) => {
        expect(sourceLocale).toBe("en");
        expect(targetLocale).toBe("zh-CN");
        return ["你好 <img> {x}"];
      },
    });
    expect(result).toBe("**你好 \\<img\\> \\{x\\}**");
  });
  test("does not translate images, code, expressions or URL destinations", async () => {
    const source =
      '<img width="200" height="100" src="/uploads/image.png" />\n\n`code` {value}\n\n![alt](/image.png)';
    let calls = 0;
    expect(
      await translateArticleBody({
        content: source,
        sourceLocale: "en",
        apiKey: "synthetic",
        translate: async () => {
          calls++;
          return [];
        },
      }),
    ).toBe(source);
    expect(calls).toBe(0);
  });
  test("rejects incomplete translations without returning a partially translated article", async () => {
    await expect(
      translateArticleBody({
        content: "# Heading\n\nBody",
        sourceLocale: "en",
        apiKey: "synthetic",
        translate: async () => [],
      }),
    ).rejects.toMatchObject({ reason: "translation-failed" });
  });
  test("keeps continuation quote markers, nested list indentation and reference destinations", async () => {
    const source =
      '> First line\n> second line\n>\n> - Item\n>   continuation\n\n[Label][ref]\n\n[ref]: https://example.test/path "Reference title"\n';
    const words: Record<string, string> = {
      "First line": "第一行",
      "second line": "第二行",
      Item: "条目",
      continuation: "续行",
      Label: "链接",
    };
    let expected = source;
    for (const [from, to] of Object.entries(words)) expected = expected.replace(from, to);
    expect(
      await translateArticleBody({
        content: source,
        sourceLocale: "en",
        apiKey: "synthetic",
        translate: async ({ texts }) => texts.map((text) => words[text] ?? text),
      }),
    ).toBe(expected);
  });
  test("deduplicates repeated prose and batches longer documents without losing structure", async () => {
    const source =
      Array.from({ length: 61 }, (_, index) => `- Paragraph ${index}`).join("\n") +
      "\n\nParagraph 0";
    const batches: string[][] = [];
    const result = await translateArticleBody({
      content: source,
      sourceLocale: "en",
      apiKey: "synthetic",
      translate: async ({ texts }) => {
        batches.push(texts);
        return texts.map((text) => text.replace("Paragraph", "段落"));
      },
    });
    expect(batches.map((batch) => batch.length)).toEqual([50, 11]);
    expect(result).toBe(source.replaceAll("Paragraph", "段落"));
  });
  test("rejects malformed MDX before making an external request", async () => {
    let calls = 0;
    await expect(
      translateArticleBody({
        content: '<img width="20"',
        sourceLocale: "en",
        apiKey: "synthetic",
        translate: async () => {
          calls++;
          return [];
        },
      }),
    ).rejects.toMatchObject({ reason: "invalid-mdx" });
    expect(calls).toBe(0);
  });
});
