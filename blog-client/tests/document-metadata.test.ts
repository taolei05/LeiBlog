import { Window } from "happy-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { applyDocumentMetadata } from "../src/shared/seo/document-metadata";

const previousDocumentDescriptor = Object.getOwnPropertyDescriptor(globalThis, "document");
const previousWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window");

function installBrowserGlobals() {
  const browserWindow = new Window();

  Object.defineProperty(globalThis, "window", { configurable: true, value: browserWindow });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: browserWindow.document,
  });
}

function restoreGlobal(name: "document" | "window", descriptor: PropertyDescriptor | undefined) {
  if (descriptor) {
    Object.defineProperty(globalThis, name, descriptor);
    return;
  }

  Reflect.deleteProperty(globalThis, name);
}

function readMeta(selector: string) {
  return document.head.querySelector<HTMLMetaElement>(selector)?.content;
}

beforeEach(() => {
  installBrowserGlobals();
});

afterEach(() => {
  document.head.innerHTML = "";
  restoreGlobal("document", previousDocumentDescriptor);
  restoreGlobal("window", previousWindowDescriptor);
});

describe("document metadata", () => {
  it("applies title, canonical, description, keywords, and Open Graph tags", () => {
    applyDocumentMetadata({
      canonicalPath: "/articles/hello",
      description: "文章描述",
      imageUrl: "https://taolei.test/uploads/cover.jpg",
      keywords: ["LeiBlog", "React"],
      origin: "https://taolei.test",
      title: "你好 LeiBlog",
      type: "article",
    });

    expect(document.title).toBe("你好 LeiBlog");
    expect(document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href).toBe(
      "https://taolei.test/articles/hello",
    );
    expect(readMeta('meta[name="description"]')).toBe("文章描述");
    expect(readMeta('meta[name="keywords"]')).toBe("LeiBlog, React");
    expect(readMeta('meta[property="og:title"]')).toBe("你好 LeiBlog");
    expect(readMeta('meta[property="og:type"]')).toBe("article");
    expect(readMeta('meta[property="og:image"]')).toBe("https://taolei.test/uploads/cover.jpg");
  });
});
