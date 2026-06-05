import { Card, Chip } from "@heroui/react";
import { Link } from "react-router-dom";

import { AppIcon, type AppIconName } from "../../../shared/icons";
import type { BlogArticle } from "./blogApi";

export function BlogPageHeader({
  description,
  eyebrow,
  icon,
  title,
}: {
  description: string;
  eyebrow: string;
  icon: AppIconName;
  title: string;
}) {
  return (
    <header className="blog-page-header">
      <p className="eyebrow">{eyebrow}</p>
      <h1>
        <AppIcon name={icon} />
        {title}
      </h1>
      <p>{description}</p>
    </header>
  );
}

export function ArticleCard({
  article,
  compact = false,
}: {
  article: BlogArticle;
  compact?: boolean;
}) {
  return (
    <Card className={compact ? "article-card article-card--compact" : "article-card"}>
      <Link
        aria-label={`阅读${article.title}`}
        className="article-card__media"
        to={`/articles/${article.slug}`}
      >
        {article.cover ? (
          <img alt={article.title} src={article.cover} />
        ) : (
          <span className="article-card__media-empty">
            <AppIcon name="image" size={28} />
          </span>
        )}
      </Link>
      <div className="article-card__body">
        <div className="article-card__meta">
          <Chip color="accent" size="sm" variant="soft">
            <Chip.Label>{article.category}</Chip.Label>
          </Chip>
          <span>{article.date}</span>
          <span>{article.readTime}</span>
        </div>
        <h2>
          <Link to={`/articles/${article.slug}`}>{article.title}</Link>
        </h2>
        <p>{article.excerpt}</p>
        <div className="article-card__tags">
          {article.tags.map((tag) => (
            <Link key={tag.slug} to={`/tags/${encodeURIComponent(tag.slug)}`}>
              #{tag.name}
            </Link>
          ))}
        </div>
      </div>
    </Card>
  );
}

export function EmptyPlaceholder({ text }: { text: string }) {
  return (
    <div className="front-empty">
      <AppIcon name="search" size={24} />
      <p>{text}</p>
    </div>
  );
}

export function FrontActionLink({
  children,
  icon,
  to,
}: {
  children: string;
  icon: AppIconName;
  to: string;
}) {
  return (
    <Link className="front-action-link" to={to}>
      <AppIcon name={icon} />
      {children}
    </Link>
  );
}
