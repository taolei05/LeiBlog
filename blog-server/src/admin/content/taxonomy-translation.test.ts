import { afterEach, describe, expect, test } from "bun:test";
import { prepareTaxonomyInput } from "./taxonomy-translation";

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});
const mockTranslations = (words: Record<string, string>) => {
  globalThis.fetch = Object.assign(
    async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { text: string[] };
      return Response.json({
        translations: body.text.map((text) => ({ text: words[text] ?? text })),
      });
    },
    { preconnect: originalFetch.preconnect },
  );
};

describe("taxonomy automatic translation", () => {
  test("fills missing English names and descriptions without changing a custom slug or tag color", async () => {
    mockTranslations({ 分类: "Category", 描述: "Description" });
    const result = await prepareTaxonomyInput({
      apiKey: "synthetic",
      input: { name: "分类", description: "描述", slug: "custom-slug", color: "#123456" },
    });
    expect(result).toMatchObject({
      name: "分类",
      description: "描述",
      slug: "custom-slug",
      color: "#123456",
      localizations: { en: { name: "Category", description: "Description" } },
    });
  });
  test("keeps manually entered English and translates an English-only description to Chinese", async () => {
    mockTranslations({ "English bio": "中文描述" });
    const result = await prepareTaxonomyInput({
      apiKey: "synthetic",
      input: {
        name: "标签",
        localizations: { en: { name: "Custom name", description: "English bio" } },
      },
    });
    expect(result.description).toBe("中文描述");
    expect(result.localizations?.en).toEqual({ name: "Custom name", description: "English bio" });
  });
  test("preserves stored English when omitted from a patch", async () => {
    const result = await prepareTaxonomyInput({
      input: { name: "分类" },
      existing: { nameEn: "Saved category", descriptionEn: "Saved description" },
    });
    expect(result.localizations?.en?.name).toBe("Saved category");
    expect(result.localizations?.en?.description).toBe("Saved description");
  });
  test("repairs a copied Chinese fallback in English fields but keeps shared Latin names", async () => {
    mockTranslations({ 测试分类: "Test category" });
    const result = await prepareTaxonomyInput({
      apiKey: "synthetic",
      input: { name: "测试分类", localizations: { en: { name: "测试分类" } } },
    });
    expect(result.localizations?.en?.name).toBe("Test category");
    const shared = await prepareTaxonomyInput({
      input: { name: "React", localizations: { en: { name: "React" } } },
    });
    expect(shared.localizations?.en?.name).toBe("React");
  });
  test("missing API configuration keeps entered text and leaves unavailable translations empty", async () => {
    const result = await prepareTaxonomyInput({ input: { name: "分类", description: "描述" } });
    expect(result.name).toBe("分类");
    expect(result.localizations?.en).toEqual({ name: "", description: "" });
  });
});
