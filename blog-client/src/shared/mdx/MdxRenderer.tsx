import { MDXProvider, useMDXComponents } from "@mdx-js/react";
import type {
  AnchorHTMLAttributes,
  ComponentPropsWithoutRef,
  ReactElement,
  ReactNode,
} from "react";
import { isValidElement, useEffect, useMemo, useState } from "react";
import { PhotoProvider, PhotoView } from "react-photo-view";
import { Link } from "react-router-dom";

import { resolveApiAssetUrl } from "../api/api-base-url";
import { AppIcon } from "../icons";

type MdxRendererProps = {
  children: ReactNode | MdxContentRenderer;
  className?: string;
};

type MdxCodeElementProps = {
  children?: ReactNode;
  className?: string;
};

type MdxCalloutProps = {
  children?: ReactNode;
  title?: string;
  tone?: "info" | "success" | "warning";
};

type MdxImageLinkProps = {
  alt: string;
  caption?: string;
  src: string;
};

type MdxReadNextProps = {
  children?: ReactNode;
  title: string;
  to: string;
};

export type MdxCodeBlockProps = {
  children?: ReactNode;
  fileName?: string;
  language?: string;
};

function getCodeLanguage(className: string | undefined) {
  return className?.match(/language-([\w-]+)/)?.[1];
}

function getCodeBlockText(children: ReactNode): string {
  if (children === null || children === undefined || typeof children === "boolean") return "";
  if (typeof children === "string" || typeof children === "number") return String(children);
  if (Array.isArray(children)) return children.map(getCodeBlockText).join("");
  if (isValidElement<{ children?: ReactNode }>(children)) {
    return getCodeBlockText(children.props.children);
  }

  return "";
}

function MdxSmartLink({ children, href = "", ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  if (href.startsWith("/") && !href.startsWith("/uploads/")) {
    return <Link to={href}>{children}</Link>;
  }

  const resolvedHref = resolveApiAssetUrl(href) ?? href;

  return (
    <a href={resolvedHref} rel="noreferrer" target="_blank" {...props}>
      {children}
    </a>
  );
}

function MdxImageLink({ alt, caption, src }: MdxImageLinkProps) {
  const imageSrc = resolveApiAssetUrl(src) ?? src;

  return (
    <figure className="mdx-image-link">
      <PhotoView src={imageSrc}>
        <button
          aria-label={`预览图片：${alt || "文章图片"}`}
          className="mdx-image-link__preview"
          type="button"
        >
          <img alt={alt} loading="lazy" src={imageSrc} />
        </button>
      </PhotoView>
      {caption ? <figcaption>{caption}</figcaption> : null}
    </figure>
  );
}

function MdxCallout({ children, title, tone = "info" }: MdxCalloutProps) {
  return (
    <aside className={`mdx-callout mdx-callout--${tone}`}>
      <AppIcon name={tone === "warning" ? "warning" : "informationCircle"} />
      <div>
        {title ? <strong>{title}</strong> : null}
        <div>{children}</div>
      </div>
    </aside>
  );
}

export function MdxCodeBlock({ children, fileName, language }: MdxCodeBlockProps) {
  const [isCopied, setIsCopied] = useState(false);
  const codeText = useMemo(() => getCodeBlockText(children), [children]);

  useEffect(() => {
    if (!isCopied) return;

    const timer = window.setTimeout(() => {
      setIsCopied(false);
    }, 1600);

    return () => {
      window.clearTimeout(timer);
    };
  }, [isCopied]);

  async function copyCode() {
    if (!codeText.trim()) return;
    if (!navigator.clipboard) return;

    await navigator.clipboard.writeText(codeText);
    setIsCopied(true);
  }

  return (
    <figure className="article-code-window">
      <figcaption>
        <span className="article-code-window__dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
        <strong>{fileName ?? language ?? "mdx"}</strong>
        <button
          aria-label={isCopied ? "代码已复制" : "复制代码"}
          className="article-code-window__copy"
          data-copied={isCopied ? "true" : undefined}
          disabled={!codeText.trim()}
          onClick={() => void copyCode()}
          type="button"
        >
          <AppIcon name={isCopied ? "checkmarkCircle" : "copy"} size={14} />
          <span>{isCopied ? "已复制" : "复制"}</span>
        </button>
      </figcaption>
      <pre>
        <code>{children}</code>
      </pre>
    </figure>
  );
}

function MdxPre({ children }: ComponentPropsWithoutRef<"pre">) {
  if (isValidElement(children)) {
    const codeElement = children as ReactElement<MdxCodeElementProps>;
    const codeProps = codeElement.props;
    const language = getCodeLanguage(codeProps.className);

    return <MdxCodeBlock language={language}>{codeProps.children}</MdxCodeBlock>;
  }

  return <MdxCodeBlock>{children}</MdxCodeBlock>;
}

function MdxReadNext({ children, title, to }: MdxReadNextProps) {
  return (
    <Link className="mdx-read-next" to={to}>
      <span>
        <AppIcon name="reader" />
        继续阅读
      </span>
      <strong>{title}</strong>
      {children ? <small>{children}</small> : null}
    </Link>
  );
}

function MdxTable({ children, ...props }: ComponentPropsWithoutRef<"table">) {
  return (
    <div className="mdx-table-wrap">
      <table {...props}>{children}</table>
    </div>
  );
}

export const mdxComponents = {
  a: MdxSmartLink,
  blockquote: (props: ComponentPropsWithoutRef<"blockquote">) => <blockquote {...props} />,
  Callout: MdxCallout,
  CodeBlock: MdxCodeBlock,
  code: (props: ComponentPropsWithoutRef<"code">) => (
    <code className="mdx-inline-code" {...props} />
  ),
  h2: (props: ComponentPropsWithoutRef<"h2">) => <h2 {...props} />,
  h3: (props: ComponentPropsWithoutRef<"h3">) => <h3 {...props} />,
  hr: () => <hr className="mdx-rule" />,
  ImageLink: MdxImageLink,
  img: ({ alt = "", src = "" }: ComponentPropsWithoutRef<"img">) => (
    <MdxImageLink alt={alt} src={src} />
  ),
  li: (props: ComponentPropsWithoutRef<"li">) => <li {...props} />,
  ol: (props: ComponentPropsWithoutRef<"ol">) => <ol {...props} />,
  p: (props: ComponentPropsWithoutRef<"p">) => <p {...props} />,
  pre: MdxPre,
  ReadNext: MdxReadNext,
  table: MdxTable,
  tbody: (props: ComponentPropsWithoutRef<"tbody">) => <tbody {...props} />,
  td: (props: ComponentPropsWithoutRef<"td">) => <td {...props} />,
  th: (props: ComponentPropsWithoutRef<"th">) => <th {...props} />,
  thead: (props: ComponentPropsWithoutRef<"thead">) => <thead {...props} />,
  tr: (props: ComponentPropsWithoutRef<"tr">) => <tr {...props} />,
  ul: (props: ComponentPropsWithoutRef<"ul">) => <ul {...props} />,
} as const;

export type MdxContentComponents = typeof mdxComponents;

export type MdxContentRenderer = (components: MdxContentComponents) => ReactNode;

function MdxRendererContent({ children, className }: MdxRendererProps) {
  useMDXComponents(mdxComponents);

  return (
    <div
      className={
        className ? `article-prose mdx-renderer ${className}` : "article-prose mdx-renderer"
      }
    >
      {typeof children === "function" ? children(mdxComponents) : children}
    </div>
  );
}

export function MdxRenderer({ children, className }: MdxRendererProps) {
  return (
    <PhotoProvider>
      <MDXProvider components={mdxComponents} disableParentContext>
        <MdxRendererContent className={className}>{children}</MdxRendererContent>
      </MDXProvider>
    </PhotoProvider>
  );
}
