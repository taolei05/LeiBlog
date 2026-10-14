import { createElement } from "react";
import type { PropsWithChildren } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { MDXEditorProps, imagePlugin } from "@mdxeditor/editor";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

type ImageOptions = NonNullable<Parameters<typeof imagePlugin>[0]>;
const { recordImageOptions, recordEditor, recordPicker } = vi.hoisted(() => ({
  recordImageOptions: vi.fn<(options: ImageOptions) => void>(),
  recordEditor: vi.fn<(props: MDXEditorProps) => void>(),
  recordPicker: vi.fn<(props: { folderSlug: string; token: string }) => void>(),
}));

vi.mock("@mdxeditor/editor", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@mdxeditor/editor")>();
  const { createElement: element } = await import("react");
  return {
    ...actual,
    imagePlugin: (options: ImageOptions) => {
      recordImageOptions(options);
      return actual.imagePlugin(options);
    },
    MDXEditor: (props: MDXEditorProps) => {
      recordEditor(props);
      const ImageDialog = recordImageOptions.mock.calls.at(-1)?.[0].ImageDialog;
      return ImageDialog === undefined ? null : element(ImageDialog);
    },
  };
});
vi.mock("@mdxeditor/gurx", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@mdxeditor/gurx")>()),
  useCellValues: () => [[], { type: "new" }, vi.fn(), true],
  usePublisher: () => vi.fn(),
}));
vi.mock("@astryxdesign/core/Dialog", () => ({
  Dialog: ({ children }: PropsWithChildren) => children,
}));
vi.mock("./media-asset-field", () => ({
  MediaPickerDialog: (props: { folderSlug: string; token: string }) => {
    recordPicker(props);
    return null;
  },
}));

import { MdxEditorField } from "./mdx-editor-field";

describe("MD image editing", () => {
  beforeEach(() => vi.clearAllMocks());

  const render = (token?: string) => {
    const onChange = vi.fn();
    const markup = renderToStaticMarkup(
      createElement(MdxEditorField, {
        value: "",
        onChange,
        imageUploadHandler: vi.fn(),
        mediaLibraryFolderSlug: "article-covers",
        mediaLibraryToken: token,
      }),
    );
    return { markup, onChange };
  };

  it("enables drag resizing and preserves dimension attributes on change", () => {
    const { onChange } = render("");
    expect(recordImageOptions.mock.calls.at(-1)?.[0]).toMatchObject({
      disableImageResize: false,
      allowSetImageDimensions: true,
    });
    const editor = recordEditor.mock.calls.at(-1)?.[0];
    if (editor === undefined) throw new Error("Editor did not render.");
    const markdown = '<img width="400" height="225" src="/uploads/article-covers/test.jpg" />';
    editor.onChange?.(markdown, false);
    expect(onChange).toHaveBeenCalledWith(markdown);
    expect(editor.suppressHtmlProcessing).toBe(true);
  });

  it("shows the article media picker for Cookie-based sessions", () => {
    const { markup } = render("");
    expect(markup).toContain("从媒体库选择");
    expect(recordPicker.mock.calls.at(-1)?.[0]).toMatchObject({
      folderSlug: "article-covers",
      token: "",
    });
  });

  it("does not offer a picker without authenticated transport", () => {
    expect(render().markup).not.toContain("从媒体库选择");
    expect(recordPicker).not.toHaveBeenCalled();
  });
});
