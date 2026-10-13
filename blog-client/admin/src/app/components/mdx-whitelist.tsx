import type { JsxComponentDescriptor, JsxEditorProps } from "@mdxeditor/editor";
import { useTranslation } from "react-i18next";

export const allowedMdxJsxComponentNames = [
  "Callout",
  "ImageLink",
  "ReadNext",
  "CodeBlock",
] as const;

type MdxJsxComponentEditorProps = JsxEditorProps;

const MdxJsxComponentEditor = ({ descriptor }: MdxJsxComponentEditorProps) => {
  const { t } = useTranslation();

  return (
    <div className="mdx-jsx-component-editor">
      {descriptor.name ?? t("admin.contentManagement.editor.mdxComponentFallback")}
    </div>
  );
};

export const mdxJsxComponentDescriptors: JsxComponentDescriptor[] = [
  {
    Editor: MdxJsxComponentEditor,
    hasChildren: true,
    kind: "flow",
    name: "Callout",
    props: [
      { name: "title", type: "string" },
      { name: "tone", type: "string" },
    ],
  },
  {
    Editor: MdxJsxComponentEditor,
    kind: "flow",
    name: "ImageLink",
    props: [
      { name: "src", required: true, type: "string" },
      { name: "alt", required: true, type: "string" },
      { name: "caption", type: "string" },
    ],
  },
  {
    Editor: MdxJsxComponentEditor,
    hasChildren: true,
    kind: "flow",
    name: "ReadNext",
    props: [
      { name: "to", required: true, type: "string" },
      { name: "title", required: true, type: "string" },
    ],
  },
  {
    Editor: MdxJsxComponentEditor,
    hasChildren: true,
    kind: "flow",
    name: "CodeBlock",
    props: [
      { name: "fileName", type: "string" },
      { name: "language", type: "string" },
    ],
  },
];
