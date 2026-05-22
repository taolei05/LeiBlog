import { Avatar, Chip, Link as HeroLink } from "@heroui/react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { AppIcon } from "../../../shared/icons";
import { ArticleMdxContent } from "../shared/ArticleMdxContent";
import { EmptyPlaceholder } from "../shared/BlogComponents";
import { CommentThread } from "../shared/CommentThread";
import { fetchPublicArticleBySlug, type BlogArticle } from "../shared/blogApi";

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
          <nav aria-label="文章面包屑" className="front-breadcrumbs">
            <Link to="/">
              <AppIcon name="home" />
              首页
            </Link>
            <Link to="/articles">
              <AppIcon name="reader" />
              文章
            </Link>
          </nav>
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
        <nav aria-label="文章面包屑" className="front-breadcrumbs">
          <Link to="/">
            <AppIcon name="home" />
            首页
          </Link>
          <Link to="/articles">
            <AppIcon name="reader" />
            文章
          </Link>
          <span>{article.title}</span>
        </nav>

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
        <nav>
          {article.toc.map((item) => (
            <a href={`#${item.id}`} key={item.id}>
              {item.title}
            </a>
          ))}
        </nav>
      </aside>
    </section>
  );
}
