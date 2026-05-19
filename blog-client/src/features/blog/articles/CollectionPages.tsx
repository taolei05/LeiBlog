import { Card, Chip } from "@heroui/react";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { AppIcon } from "../../../shared/icons";
import { ArticleCard, BlogPageHeader, EmptyPlaceholder } from "../shared/BlogComponents";
import {
  deriveBlogCategories,
  deriveBlogTags,
  fetchPublicArticles,
  groupArticlesByMonth,
  type BlogArticle,
} from "../shared/blogApi";

function useArticleIndex() {
  const [articles, setArticles] = useState<BlogArticle[]>([]);
  const [status, setStatus] = useState<"error" | "idle" | "loading">("loading");

  useEffect(() => {
    let isActive = true;

    async function loadArticles() {
      try {
        setStatus("loading");
        const nextArticles = await fetchPublicArticles({ pageSize: 100 });
        if (!isActive) return;
        setArticles(nextArticles);
        setStatus("idle");
      } catch {
        if (!isActive) return;
        setArticles([]);
        setStatus("error");
      }
    }

    void loadArticles();

    return () => {
      isActive = false;
    };
  }, []);

  return { articles, status };
}

export function CategoriesPage() {
  const [searchParams] = useSearchParams();
  const activeCategory = searchParams.get("category");
  const { articles: allArticles, status } = useArticleIndex();
  const categories = useMemo(() => deriveBlogCategories(allArticles), [allArticles]);
  const articles = activeCategory
    ? allArticles.filter((article) =>
        article.categories.some((category) => category.slug === activeCategory),
      )
    : allArticles;

  return (
    <section className="front-stack">
      <BlogPageHeader
        description="按分类浏览数据库中的已发布文章。"
        eyebrow="聚合"
        icon="albums"
        title="分类"
      />
      <div className="front-category-grid">
        {categories.map((category) => (
          <Card
            className={
              activeCategory === category.slug
                ? "front-category-card is-active"
                : "front-category-card"
            }
            key={category.slug}
          >
            <AppIcon name={category.icon} size={24} />
            <Card.Header>
              <Card.Title>{category.name}</Card.Title>
              <Card.Description>{category.description}</Card.Description>
            </Card.Header>
            <Link to={`/categories?category=${encodeURIComponent(category.slug)}`}>
              {category.count} 篇文章
            </Link>
          </Card>
        ))}
      </div>
      {articles.length > 0 ? (
        <div className="article-grid">
          {articles.map((article) => (
            <ArticleCard article={article} compact key={article.slug} />
          ))}
        </div>
      ) : (
        <EmptyPlaceholder text={status === "error" ? "文章接口暂时不可用。" : "暂无分类文章。"} />
      )}
    </section>
  );
}

export function TagsPage() {
  const [searchParams] = useSearchParams();
  const activeTag = searchParams.get("tag");
  const { articles: allArticles, status } = useArticleIndex();
  const tags = useMemo(() => deriveBlogTags(allArticles), [allArticles]);
  const articles = activeTag
    ? allArticles.filter((article) => article.tags.some((tag) => tag.slug === activeTag))
    : allArticles;

  return (
    <section className="front-stack">
      <BlogPageHeader
        description="标签页用于从主题线索切入数据库中的文章。"
        eyebrow="聚合"
        icon="pricetags"
        title="标签"
      />
      <div className="front-tag-list front-tag-list--large">
        {tags.map((tag) => (
          <Link
            className={activeTag === tag.slug ? "is-active" : undefined}
            key={tag.slug}
            to={`/tags?tag=${encodeURIComponent(tag.slug)}`}
          >
            #{tag.name}
          </Link>
        ))}
      </div>
      {articles.length > 0 ? (
        <div className="article-grid">
          {articles.map((article) => (
            <ArticleCard article={article} compact key={article.slug} />
          ))}
        </div>
      ) : (
        <EmptyPlaceholder text={status === "error" ? "文章接口暂时不可用。" : "暂无标签文章。"} />
      )}
    </section>
  );
}

export function ArchivesPage() {
  const { articles, status } = useArticleIndex();
  const archiveGroups = useMemo(() => groupArticlesByMonth(articles), [articles]);

  return (
    <section className="front-stack">
      <BlogPageHeader
        description="归档页按发布时间组织数据库中的已发布内容。"
        eyebrow="聚合"
        icon="archive"
        title="归档"
      />
      {archiveGroups.length > 0 ? (
        <div className="archive-list">
          {archiveGroups.map((group) => (
            <section className="archive-group" key={group.label}>
              <h2>{group.label}</h2>
              <div className="archive-group__items">
                {group.articles.map((article) => (
                  <Link key={article.slug} to={`/articles/${article.slug}`}>
                    <time>{article.date}</time>
                    <span>{article.title}</span>
                    <Chip size="sm" variant="soft">
                      <Chip.Label>{article.category}</Chip.Label>
                    </Chip>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <EmptyPlaceholder text={status === "error" ? "文章接口暂时不可用。" : "暂无归档文章。"} />
      )}
    </section>
  );
}

export function ArticleListPage() {
  const { articles, status } = useArticleIndex();

  return (
    <section className="front-stack">
      <BlogPageHeader
        description="更紧凑的文章索引，适合快速扫描标题、日期和分类。"
        eyebrow="聚合"
        icon="list"
        title="文章目录"
      />
      {articles.length > 0 ? (
        <div className="compact-article-list">
          {articles.map((article) => (
            <Link key={article.slug} to={`/articles/${article.slug}`}>
              <span>{article.title}</span>
              <small>{article.category}</small>
              <time>{article.date}</time>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyPlaceholder text={status === "error" ? "文章接口暂时不可用。" : "暂无文章。"} />
      )}
    </section>
  );
}
