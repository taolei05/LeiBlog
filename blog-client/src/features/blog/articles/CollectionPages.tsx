import { Card, Chip } from "@heroui/react";
import { Link, useSearchParams } from "react-router-dom";

import { AppIcon } from "../../../shared/icons";
import { ArticleCard, BlogPageHeader } from "../shared/BlogComponents";
import { archiveGroups, blogArticles, blogCategories, blogTags } from "../shared/blogContent";

export function CategoriesPage() {
  const [searchParams] = useSearchParams();
  const activeCategory = searchParams.get("category");
  const articles = activeCategory
    ? blogArticles.filter((article) => article.category === activeCategory)
    : blogArticles;

  return (
    <section className="front-stack">
      <BlogPageHeader
        description="按分类浏览内容，阶段 5 先保留 URL 参数筛选占位。"
        eyebrow="聚合"
        icon="albums"
        title="分类"
      />
      <div className="front-category-grid">
        {blogCategories.map((category) => (
          <Card
            className={
              activeCategory === category.name
                ? "front-category-card is-active"
                : "front-category-card"
            }
            key={category.name}
          >
            <AppIcon name={category.icon} size={24} />
            <Card.Header>
              <Card.Title>{category.name}</Card.Title>
              <Card.Description>{category.description}</Card.Description>
            </Card.Header>
            <Link to={`/categories?category=${encodeURIComponent(category.name)}`}>
              {category.count} 篇文章
            </Link>
          </Card>
        ))}
      </div>
      <div className="article-grid">
        {articles.map((article) => (
          <ArticleCard article={article} compact key={article.slug} />
        ))}
      </div>
    </section>
  );
}

export function TagsPage() {
  const [searchParams] = useSearchParams();
  const activeTag = searchParams.get("tag");
  const articles = activeTag
    ? blogArticles.filter((article) => article.tags.includes(activeTag))
    : blogArticles;

  return (
    <section className="front-stack">
      <BlogPageHeader
        description="标签页用于从主题线索切入文章，真实引用次数会在后续 API 阶段接入。"
        eyebrow="聚合"
        icon="pricetags"
        title="标签"
      />
      <div className="front-tag-list front-tag-list--large">
        {blogTags.map((tag) => (
          <Link
            className={activeTag === tag ? "is-active" : undefined}
            key={tag}
            to={`/tags?tag=${encodeURIComponent(tag)}`}
          >
            #{tag}
          </Link>
        ))}
      </div>
      <div className="article-grid">
        {articles.map((article) => (
          <ArticleCard article={article} compact key={article.slug} />
        ))}
      </div>
    </section>
  );
}

export function ArchivesPage() {
  return (
    <section className="front-stack">
      <BlogPageHeader
        description="归档页按时间组织内容，保留后续接入分页和年度筛选的位置。"
        eyebrow="聚合"
        icon="archive"
        title="归档"
      />
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
    </section>
  );
}

export function ArticleListPage() {
  return (
    <section className="front-stack">
      <BlogPageHeader
        description="更紧凑的文章索引，适合快速扫描标题、日期和分类。"
        eyebrow="聚合"
        icon="list"
        title="文章目录"
      />
      <div className="compact-article-list">
        {blogArticles.map((article) => (
          <Link key={article.slug} to={`/articles/${article.slug}`}>
            <span>{article.title}</span>
            <small>{article.category}</small>
            <time>{article.date}</time>
          </Link>
        ))}
      </div>
    </section>
  );
}
