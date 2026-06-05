import { Avatar, Button, Chip, Link as HeroLink, Popover } from "@heroui/react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { AppIcon } from "../../../shared/icons";
import { ArticleMdxContent } from "../shared/ArticleMdxContent";
import { EmptyPlaceholder } from "../shared/BlogComponents";
import { CommentThread } from "../shared/CommentThread";
import type { BlogArticle } from "../shared/blogApi";
import { fetchPublicArticleBySlug } from "../shared/blogApi";

type ArticleTocNavProps = {
  items: BlogArticle["toc"];
  onNavigate?: () => void;
};

function ArticleTocNav({ items, onNavigate }: ArticleTocNavProps) {
  if (items.length === 0) {
    return <p className="article-toc__empty">暂无目录</p>;
  }

  return (
    <nav className="article-toc__nav">
      {items.map((item) => (
        <a
          className="article-toc__link"
          href={`#${item.id}`}
          key={item.id}
          onClick={() => onNavigate?.()}
        >
          {item.title}
        </a>
      ))}
    </nav>
  );
}

type ArticleMobileTocProps = {
  items: BlogArticle["toc"];
};

function ArticleMobileToc({ items }: ArticleMobileTocProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Popover isOpen={isOpen} onOpenChange={setIsOpen}>
      <Popover.Trigger>
        <Button
          aria-label="打开本篇目录"
          className="article-mobile-toc__button"
          isIconOnly
          size="sm"
          variant="secondary"
        >
          <AppIcon name="list" />
        </Button>
      </Popover.Trigger>
      <Popover.Content className="article-mobile-toc__popover" offset={8} placement="bottom end">
        <Popover.Dialog>
          <div className="article-mobile-toc__panel">
            <p>本篇目录</p>
            <ArticleTocNav items={items} onNavigate={() => setIsOpen(false)} />
          </div>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}

type ArticleBreadcrumbsProps = {
  title?: string;
  tocItems?: BlogArticle["toc"];
};

function ArticleBreadcrumbs({ title, tocItems = [] }: ArticleBreadcrumbsProps) {
  return (
    <nav aria-label="文章面包屑" className="front-breadcrumbs">
      <Link to="/">
        <AppIcon name="home" />
        首页
      </Link>
      <span aria-hidden="true" className="front-breadcrumbs__separator">
        <AppIcon name="chevronForward" />
      </span>
      <Link to="/articles">
        <AppIcon name="reader" />
        文章
      </Link>
      {title ? (
        <>
          <span aria-hidden="true" className="front-breadcrumbs__separator">
            <AppIcon name="chevronForward" />
          </span>
          <span aria-current="page" className="front-breadcrumbs__current">
            {title}
          </span>
          <span className="article-mobile-toc">
            <ArticleMobileToc items={tocItems} />
          </span>
        </>
      ) : null}
    </nav>
  );
}

export function BlogArticleDetailPage() {
  const { slug } = useParams();
  const [article, setArticle] = useState<BlogArticle | null>(null);
  const [status, setStatus] = useState<"error" | "idle" | "loading">("loading");

  useEffect(() => {
    let isActive = true;

    async function loadArticle() {
      if (!slug) {
        setStatus("error");
        return;
      }

      try {
        setStatus("loading");
        const nextArticle = await fetchPublicArticleBySlug(slug);
        if (!isActive) return;
        setArticle(nextArticle);
        setStatus("idle");
      } catch {
        if (!isActive) return;
        setArticle(null);
        setStatus("error");
      }
    }

    void loadArticle();

    return () => {
      isActive = false;
    };
  }, [slug]);

  if (!article) {
    return (
      <section className="article-reading-layout">
        <article className="article-detail">
          <ArticleBreadcrumbs />
          <EmptyPlaceholder
            text={status === "error" ? "文章不存在或接口暂时不可用。" : "正在读取文章。"}
          />
        </article>
      </section>
    );
  }

  return (
    <section className="article-reading-layout">
      <article className="article-detail">
        <ArticleBreadcrumbs title={article.title} tocItems={article.toc} />

        <header className="article-detail__header">
          <p className="eyebrow">{article.category}</p>
          <h1>{article.title}</h1>
          <p>{article.excerpt}</p>
          <div className="article-detail__meta">
            <span>{article.date}</span>
            <span>{article.readTime}</span>
            {article.tags.map((tag) => (
              <Chip key={tag.slug} size="sm" variant="soft">
                <Chip.Label>#{tag.name}</Chip.Label>
              </Chip>
            ))}
          </div>
        </header>

        {article.cover ? (
          <img alt={article.title} className="article-detail__cover" src={article.cover} />
        ) : null}

        <ArticleMdxContent contentMdx={article.contentMdx ?? ""} />

        <footer className="article-detail__footer">
          <Link className="front-action-link" to="/articles">
            <AppIcon name="chevronBack" />
            返回文章列表
          </Link>
        </footer>

        {article.contributors.length > 0 ? (
          <section aria-label="文章贡献者" className="article-contributors">
            <p className="eyebrow">贡献者</p>
            <div className="article-contributors__list">
              {article.contributors.map((contributor) => (
                <div className="article-contributors__item" key={contributor.id}>
                  <Avatar size="sm">
                    {contributor.avatarUrl ? <Avatar.Image src={contributor.avatarUrl} /> : null}
                    <Avatar.Fallback>{contributor.name.slice(0, 1)}</Avatar.Fallback>
                  </Avatar>
                  <HeroLink
                    href={contributor.linkUrl ?? undefined}
                    isDisabled={!contributor.linkUrl}
                    rel="noreferrer"
                    target={contributor.linkUrl ? "_blank" : undefined}
                  >
                    {contributor.name}
                  </HeroLink>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <CommentThread
          articleId={article.id}
          description="评论来自当前文章的公开评论接口。"
          target="article"
          title="文章评论"
        />
      </article>

      <aside aria-label="文章目录" className="article-toc">
        <p>本篇目录</p>
        <ArticleTocNav items={article.toc} />
      </aside>
    </section>
  );
}
