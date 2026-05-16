import {
  BlockTypeSelect,
  BoldItalicUnderlineToggles,
  CodeToggle,
  CreateLink,
  DiffSourceToggleWrapper,
  headingsPlugin,
  imagePlugin,
  InsertCodeBlock,
  InsertImage,
  InsertTable,
  InsertThematicBreak,
  jsxPlugin,
  linkDialogPlugin,
  linkPlugin,
  listsPlugin,
  ListsToggle,
  markdownShortcutPlugin,
  MDXEditor,
  quotePlugin,
  Separator,
  tablePlugin,
  thematicBreakPlugin,
  toolbarPlugin,
  UndoRedo,
  codeBlockPlugin,
  codeMirrorPlugin,
  diffSourcePlugin,
  frontmatterPlugin,
  type ImageUploadHandler,
} from "@mdxeditor/editor";

import { mdxJsxComponentDescriptors } from "./mdxWhitelist";

type MdxEditorFieldProps = {
  "aria-label"?: string;
  className?: string;
  onChange?: (markdown: string) => void;
  readOnly?: boolean;
  value: string;
};

type MediaUploadResponse = {
  item?: {
    accessUrl?: string;
  };
  ok?: boolean;
};

export const uploadMdxImageToMedia: ImageUploadHandler = async (file) => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("fileName", file.name);

  const response = await fetch("/api/admin/media/", {
    body: formData,
    credentials: "include",
    method: "POST",
  });

  if (!response.ok) {
    throw new Error("图片上传失败");
  }

  const payload = (await response.json()) as MediaUploadResponse;
  const accessUrl = payload.item?.accessUrl;

  if (!accessUrl) {
    throw new Error("媒体接口没有返回图片链接");
  }

  return accessUrl;
};

function MdxEditorToolbar() {
  return (
    <DiffSourceToggleWrapper options={["rich-text", "source", "diff"]}>
      <UndoRedo />
      <Separator />
      <BlockTypeSelect />
      <BoldItalicUnderlineToggles />
      <CodeToggle />
      <Separator />
      <CreateLink />
      <InsertImage />
      <InsertTable />
      <InsertThematicBreak />
      <Separator />
      <ListsToggle />
      <InsertCodeBlock />
    </DiffSourceToggleWrapper>
  );
}

export function MdxEditorField({
  "aria-label": ariaLabel = "MDX 编辑器",
  className,
  onChange,
  readOnly = false,
  value,
}: MdxEditorFieldProps) {
  const fieldClassName = ["mdx-editor-field", readOnly ? "is-read-only" : "", className ?? ""]
    .filter(Boolean)
    .join(" ");

  return (
    <div aria-disabled={readOnly} aria-label={ariaLabel} className={fieldClassName} role="group">
      <MDXEditor
        className="mdx-editor-field__editor"
        contentEditableClassName="mdx-editor-field__content"
        markdown={value}
        onChange={(markdown) => onChange?.(markdown)}
        placeholder="写下正文..."
        plugins={[
          headingsPlugin(),
          listsPlugin(),
          quotePlugin(),
          thematicBreakPlugin(),
          linkPlugin(),
          linkDialogPlugin(),
          imagePlugin({
            disableImageResize: true,
            imageUploadHandler: uploadMdxImageToMedia,
          }),
          tablePlugin(),
          frontmatterPlugin(),
          codeBlockPlugin({ defaultCodeBlockLanguage: "tsx" }),
          codeMirrorPlugin({
            autoLoadLanguageSupport: false,
            codeBlockLanguages: {
              bash: "Shell",
              css: "CSS",
              html: "HTML",
              js: "JavaScript",
              json: "JSON",
              mdx: "MDX",
              ts: "TypeScript",
              tsx: "TSX",
            },
          }),
          jsxPlugin({
            allowFragment: false,
            jsxComponentDescriptors: mdxJsxComponentDescriptors,
          }),
          diffSourcePlugin({ diffMarkdown: value, viewMode: "rich-text" }),
          markdownShortcutPlugin(),
          toolbarPlugin({
            toolbarClassName: "mdx-editor-field__toolbar",
            toolbarContents: MdxEditorToolbar,
          }),
        ]}
        readOnly={readOnly}
        suppressHtmlProcessing
      />
    </div>
  );
}
