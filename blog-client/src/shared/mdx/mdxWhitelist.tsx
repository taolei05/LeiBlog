import type { JsxComponentDescriptor, JsxEditorProps } from "@mdxeditor/editor";

export const allowedMdxJsxComponentNames = [
  "Callout",
  "ImageLink",
  "ReadNext",
  "CodeBlock",
] as const;

export type AllowedMdxJsxComponentName = (typeof allowedMdxJsxComponentNames)[number];

export function isAllowedMdxJsxComponent(value: string): value is AllowedMdxJsxComponentName {
  return allowedMdxJsxComponentNames.includes(value as AllowedMdxJsxComponentName);
}

function MdxJsxComponentEditor({ descriptor }: JsxEditorProps) {
  return <div className="mdx-jsx-component-editor">{descriptor.name ?? "MDX 组件"}</div>;
}

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
