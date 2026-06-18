import { Avatar, Button, Chip, Link as HeroLink, Popover } from "@heroui/react";
import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { AppIcon } from "../../../shared/icons";
import { useDocumentMetadata } from "../../../shared/seo/document-metadata";
import { ArticleMdxContent } from "../shared/ArticleMdxContent";
import { EmptyPlaceholder } from "../shared/BlogComponents";
import { CommentThread } from "../shared/CommentThread";
import type { BlogArticle } from "../shared/blogApi";
import { fetchPublicArticleBySlug, fetchPublicArticles } from "../shared/blogApi";
import { getArticleTagColorStyle } from "../shared/tagColors";

export type ArticleReadingNavigation = {
  nextArticle?: BlogArticle;
  previousArticle?: BlogArticle;
  relatedArticles: BlogArticle[];
};

function getArticleTime(article: BlogArticle) {
  const time = new Date(article.publishedAt ?? article.date).getTime();
  return Number.isNaN(time) ? 0 : time;
}

type GetSharedTagCountParameters = {
  article: BlogArticle;
  currentArticle: BlogArticle;
};

function getSharedTagCount({ article, currentArticle }: GetSharedTagCountParameters) {
  const currentTagSlugs = new Set(currentArticle.tags.map((tag) => tag.slug));

  return article.tags.filter((tag) => currentTagSlugs.has(tag.slug)).length;
}

type GetRelatedArticleScoreParameters = {
  article: BlogArticle;
  currentArticle: BlogArticle;
};

function getRelatedArticleScore({ article, currentArticle }: GetRelatedArticleScoreParameters) {
  const tagScore = getSharedTagCount({ article, currentArticle }) * 3;
  const categoryScore = article.categorySlug === currentArticle.categorySlug ? 1 : 0;

  return tagScore + categoryScore;
}

export type CreateArticleReadingNavigationParameters = {
  articles: BlogArticle[];
  currentArticle: BlogArticle;
};

export function createArticleReadingNavigation({
  articles,
  currentArticle,
}: CreateArticleReadingNavigationParameters): ArticleReadingNavigation {
  const sortedArticles = [...articles].sort(
    (left, right) => getArticleTime(right) - getArticleTime(left),
  );
  const currentIndex = sortedArticles.findIndex((article) => article.slug === currentArticle.slug);
  const relatedArticles = articles
    .filter((article) => article.slug !== currentArticle.slug)
    .filter((article) => getSharedTagCount({ article, currentArticle }) > 0)
    .map((article) => ({
      article,
      score: getRelatedArticleScore({ article, currentArticle }),
    }))
    .filter(({ score }) => score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return getArticleTime(right.article) - getArticleTime(left.article);
    })
    .slice(0, 3)
    .map(({ article }) => article);

  return {
    nextArticle: currentIndex > 0 ? sortedArticles[currentIndex - 1] : undefined,
    previousArticle:
      currentIndex >= 0 && currentIndex < sortedArticles.length - 1
        ? sortedArticles[currentIndex + 1]
        : undefined,
    relatedArticles,
  };
}

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
          className={`article-toc__link article-toc__link--level-${item.level}`}
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

type ArticleNeighborLinkProps = {
  article?: BlogArticle;
  direction: "next" | "previous";
};

function ArticleNeighborLink({ article, direction }: ArticleNeighborLinkProps) {
  if (!article) {
    return (
      <span aria-hidden="true" className="article-neighbor-card article-neighbor-card--empty" />
    );
  }

  const isNext = direction === "next";

  return (
    <Link className="article-neighbor-card" to={`/articles/${article.slug}`}>
      <span>
        <AppIcon name={isNext ? "chevronForward" : "chevronBack"} />
        {isNext ? "下一篇" : "上一篇"}
      </span>
      <strong>{article.title}</strong>
      <small>{article.date}</small>
    </Link>
  );
}

type ArticleReadingNavigationPanelProps = {
  navigation: ArticleReadingNavigation | null;
};

function ArticleReadingNavigationPanel({ navigation }: ArticleReadingNavigationPanelProps) {
  if (!navigation) {
    return null;
  }

  const hasNeighbors = Boolean(navigation.nextArticle || navigation.previousArticle);
  const hasRelatedArticles = navigation.relatedArticles.length > 0;

  if (!hasNeighbors && !hasRelatedArticles) {
    return null;
  }

  return (
    <section aria-label="继续阅读" className="article-reading-navigation">
      {hasNeighbors ? (
        <div className="article-neighbor-grid">
          <ArticleNeighborLink article={navigation.previousArticle} direction="previous" />
          <ArticleNeighborLink article={navigation.nextArticle} direction="next" />
        </div>
      ) : null}

      {hasRelatedArticles ? (
        <div className="article-related">
          <p className="eyebrow">相关阅读</p>
          <div className="article-related-grid">
            {navigation.relatedArticles.map((article) => (
              <Link
                className="article-related-card"
                key={article.slug}
                to={`/articles/${article.slug}`}
              >
                <strong>{article.title}</strong>
                <span>
                  {article.category} / {article.date}
                </span>
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

export function BlogArticleDetailPage() {
  const { slug } = useParams();
  const [article, setArticle] = useState<BlogArticle | null>(null);
  const [articleNavigation, setArticleNavigation] = useState<ArticleReadingNavigation | null>(null);
  const [readingProgress, setReadingProgress] = useState(0);
  const [status, setStatus] = useState<"error" | "idle" | "loading">("loading");
  const articleRef = useRef<HTMLElement | null>(null);

  useDocumentMetadata(
    article
      ? {
          canonicalPath: `/articles/${article.slug}`,
          description: article.excerpt,
          imageUrl: article.cover,
          keywords: [
            article.category,
            ...article.tags.map((tag) => tag.name),
            ...article.categories.map((category) => category.name),
          ],
          title: `${article.title} - LeiBlog`,
          type: "article",
        }
      : undefined,
  );

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
        setArticleNavigation(null);
        setStatus("idle");
      } catch {
        if (!isActive) return;
        setArticle(null);
        setArticleNavigation(null);
        setStatus("error");
      }
    }

    void loadArticle();

    return () => {
      isActive = false;
    };
  }, [slug]);

  useEffect(() => {
    if (!article) {
      setArticleNavigation(null);
      return;
    }

    const currentArticle = article;
    let isActive = true;

    async function loadArticleNavigation() {
      try {
        const articles = await fetchPublicArticles({
          pageSize: 100,
          sortBy: "publishedAt",
          sortOrder: "desc",
        });

        if (!isActive) {
          return;
        }

        setArticleNavigation(createArticleReadingNavigation({ articles, currentArticle }));
      } catch {
        if (!isActive) {
          return;
        }

        setArticleNavigation(null);
      }
    }

    void loadArticleNavigation();

    return () => {
      isActive = false;
    };
  }, [article]);

  useEffect(() => {
    function updateReadingProgress() {
      const element = articleRef.current;

      if (!element) {
        setReadingProgress(0);
        return;
      }

      const rect = element.getBoundingClientRect();
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
      const scrollableDistance = Math.max(1, rect.height - viewportHeight);
      const progress = Math.min(
        100,
        Math.max(0, ((viewportHeight - rect.top) / scrollableDistance) * 100),
      );
      setReadingProgress(progress);
    }

    updateReadingProgress();
    window.addEventListener("scroll", updateReadingProgress, { passive: true });
    window.addEventListener("resize", updateReadingProgress);

    return () => {
      window.removeEventListener("scroll", updateReadingProgress);
      window.removeEventListener("resize", updateReadingProgress);
    };
  }, [article]);

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
      <div aria-hidden="true" className="article-reading-progress">
        <span style={{ transform: `scaleX(${readingProgress / 100})` }} />
      </div>
      <article className="article-detail" ref={articleRef}>
        <ArticleBreadcrumbs title={article.title} tocItems={article.toc} />

        <header className="article-detail__header">
          <p className="eyebrow">{article.category}</p>
          <h1>{article.title}</h1>
          <p>{article.excerpt}</p>
          <div className="article-detail__meta">
            <span>{article.date}</span>
            <span>{article.readTime}</span>
            {article.tags.map((tag) => (
              <Chip
                className="article-detail__tag"
                key={tag.slug}
                size="sm"
                style={getArticleTagColorStyle(tag.color)}
                variant="soft"
              >
                <Chip.Label>#{tag.name}</Chip.Label>
              </Chip>
            ))}
          </div>
        </header>

        {article.cover ? (
          <img alt={article.title} className="article-detail__cover" src={article.cover} />
        ) : null}

        <ArticleMdxContent contentMdx={article.contentMdx ?? ""} />

        <ArticleReadingNavigationPanel navigation={articleNavigation} />

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
