import type { ImageUploadHandler, MDXEditorMethods, Translation } from "@mdxeditor/editor";
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
} from "@mdxeditor/editor";
import { useEffect, useRef } from "react";

import {
  expireAdminSessionForResponse,
  getAdminApiUrl,
  readStoredAdminSession,
} from "../../features/admin/shared/admin-api";
import { resolveApiAssetUrl } from "../api/api-base-url";
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

const mdxEditorChineseTranslations: Record<string, string> = {
  "codeBlock.inlineLanguage": "语言",
  "codeBlock.language": "代码块语言",
  "codeBlock.selectLanguage": "选择代码块语言",
  "codeblock.delete": "删除代码块",
  "createLink.cancelTooltip": "取消修改",
  "createLink.saveTooltip": "设置链接",
  "createLink.text": "链接文字",
  "createLink.textTooltip": "链接显示的文字",
  "createLink.title": "链接标题",
  "createLink.titleTooltip": "鼠标悬停时显示的链接标题",
  "createLink.url": "链接",
  "createLink.urlPlaceholder": "选择或粘贴链接",
  "dialog.close": "关闭弹窗",
  "dialogControls.cancel": "取消",
  "dialogControls.save": "保存",
  "frontmatterEditor.addEntry": "添加字段",
  "frontmatterEditor.key": "键",
  "frontmatterEditor.title": "编辑 Frontmatter",
  "frontmatterEditor.value": "值",
  "imageEditor.deleteImage": "删除图片",
  "imageEditor.editImage": "编辑图片",
  "linkPreview.copied": "已复制",
  "linkPreview.copyToClipboard": "复制到剪贴板",
  "linkPreview.edit": "编辑链接",
  "linkPreview.remove": "移除链接",
  "table.alignCenter": "居中",
  "table.alignLeft": "左对齐",
  "table.alignRight": "右对齐",
  "table.columnMenu": "列菜单",
  "table.deleteColumn": "删除此列",
  "table.deleteRow": "删除此行",
  "table.deleteTable": "删除表格",
  "table.insertColumnLeft": "在左侧插入列",
  "table.insertColumnRight": "在右侧插入列",
  "table.insertRowAbove": "在上方插入行",
  "table.insertRowBelow": "在下方插入行",
  "table.rowMenu": "行菜单",
  "table.textAlignment": "文本对齐",
  "toolbar.blockTypeSelect.placeholder": "块类型",
  "toolbar.blockTypeSelect.selectBlockTypeTooltip": "选择块类型",
  "toolbar.blockTypes.heading": "标题 {{level}}",
  "toolbar.blockTypes.paragraph": "段落",
  "toolbar.blockTypes.quote": "引用",
  "toolbar.bold": "加粗",
  "toolbar.bulletedList": "无序列表",
  "toolbar.checkList": "任务列表",
  "toolbar.codeBlock": "插入代码块",
  "toolbar.diffMode": "差异模式",
  "toolbar.editFrontmatter": "编辑 Frontmatter",
  "toolbar.highlight": "高亮",
  "toolbar.image": "插入图片",
  "toolbar.inlineCode": "行内代码",
  "toolbar.insertFrontmatter": "插入 Frontmatter",
  "toolbar.italic": "斜体",
  "toolbar.link": "创建链接",
  "toolbar.numberedList": "有序列表",
  "toolbar.redo": "重做 {{shortcut}}",
  "toolbar.removeBold": "取消加粗",
  "toolbar.removeHighlight": "取消高亮",
  "toolbar.removeInlineCode": "取消行内代码",
  "toolbar.removeItalic": "取消斜体",
  "toolbar.removeUnderline": "取消下划线",
  "toolbar.richText": "富文本",
  "toolbar.source": "源码模式",
  "toolbar.table": "插入表格",
  "toolbar.thematicBreak": "插入分割线",
  "toolbar.toggleGroup": "切换组",
  "toolbar.underline": "下划线",
  "toolbar.undo": "撤销 {{shortcut}}",
  "uploadImage.addViaUrlInstructions": "或通过链接添加图片：",
  "uploadImage.addViaUrlInstructionsNoUpload": "通过链接添加图片：",
  "uploadImage.alt": "替代文本：",
  "uploadImage.autoCompletePlaceholder": "选择或粘贴图片地址",
  "uploadImage.dialogTitle": "上传图片",
  "uploadImage.height": "高度：",
  "uploadImage.title": "标题：",
  "uploadImage.uploadInstructions": "从本机上传图片：",
  "uploadImage.width": "宽度：",
};

const mdxEditorChineseTranslation: Translation = (key, defaultValue, interpolations = {}) => {
  let value = mdxEditorChineseTranslations[key] ?? defaultValue;

  for (const [name, interpolationValue] of Object.entries(interpolations)) {
    value = value.replaceAll(`{{${name}}}`, String(interpolationValue));
  }

  return value;
};

export const uploadMdxImageToMedia: ImageUploadHandler = async (file) => {
  const formData = new FormData();
  const session = readStoredAdminSession();
  const headers = new Headers();

  formData.append("file", file);
  formData.append("fileName", file.name);
  if (session?.token) {
    headers.set("Authorization", `Bearer ${session.token}`);
  }

  const response = await fetch(getAdminApiUrl("/admin/media/"), {
    body: formData,
    headers,
    method: "POST",
  });

  if (!response.ok) {
    expireAdminSessionForResponse(response, true);
    throw new Error("图片上传失败");
  }

  const payload = (await response.json()) as MediaUploadResponse;
  const accessUrl = payload.item?.accessUrl;

  if (!accessUrl) {
    throw new Error("媒体接口没有返回图片链接");
  }

  return resolveApiAssetUrl(accessUrl) ?? accessUrl;
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
  const editorRef = useRef<MDXEditorMethods>(null);
  const lastAppliedValueRef = useRef(value);
  const fieldClassName = ["mdx-editor-field", readOnly ? "is-read-only" : "", className ?? ""]
    .filter(Boolean)
    .join(" ");

  useEffect(() => {
    if (value === lastAppliedValueRef.current) return;

    editorRef.current?.setMarkdown(value);
    lastAppliedValueRef.current = value;
  }, [value]);

  return (
    <div aria-disabled={readOnly} aria-label={ariaLabel} className={fieldClassName} role="group">
      <MDXEditor
        className="mdx-editor-field__editor"
        contentEditableClassName="mdx-editor-field__content"
        markdown={value}
        onChange={(markdown) => {
          lastAppliedValueRef.current = markdown;
          onChange?.(markdown);
        }}
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
        ref={editorRef}
        readOnly={readOnly}
        suppressHtmlProcessing
        translation={mdxEditorChineseTranslation}
      />
    </div>
  );
}
