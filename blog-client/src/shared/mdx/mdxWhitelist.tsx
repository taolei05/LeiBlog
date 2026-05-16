import { GenericJsxEditor, type JsxComponentDescriptor } from "@mdxeditor/editor";

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

export const mdxJsxComponentDescriptors: JsxComponentDescriptor[] = [
  {
    Editor: GenericJsxEditor,
    hasChildren: true,
    kind: "flow",
    name: "Callout",
    props: [
      { name: "title", type: "string" },
      { name: "tone", type: "string" },
    ],
  },
  {
    Editor: GenericJsxEditor,
    kind: "flow",
    name: "ImageLink",
    props: [
      { name: "src", required: true, type: "string" },
      { name: "alt", required: true, type: "string" },
      { name: "caption", type: "string" },
    ],
  },
  {
    Editor: GenericJsxEditor,
    hasChildren: true,
    kind: "flow",
    name: "ReadNext",
    props: [
      { name: "to", required: true, type: "string" },
      { name: "title", required: true, type: "string" },
    ],
  },
  {
    Editor: GenericJsxEditor,
    hasChildren: true,
    kind: "flow",
    name: "CodeBlock",
    props: [
      { name: "fileName", type: "string" },
      { name: "language", type: "string" },
    ],
  },
];
