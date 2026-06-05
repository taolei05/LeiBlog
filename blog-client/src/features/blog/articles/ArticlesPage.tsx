import type { Key } from "@heroui/react";

import { Label, ListBox, Select } from "@heroui/react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { AppIcon } from "../../../shared/icons";
import type { PublicSiteInfo } from "../../../shared/site/site-info";
import { fetchPublicSiteInfo } from "../../../shared/site/site-info";
import { ArticleTagLink, EmptyPlaceholder } from "../shared/BlogComponents";
import type { BlogArticle } from "../shared/blogApi";
import { fetchPublicArticles } from "../shared/blogApi";
import {
  createRandomCoverAssignments,
  getHeroCoverUrls,
  PageHeroCoverCarousel,
} from "../shared/HeroCoverCarousel";

type ArticleSortMode = "earliest" | "latest" | "views";

const sortOptions: {
  icon: "calendar" | "eye" | "swapVertical";
  id: ArticleSortMode;
  label: string;
}[] = [
  { icon: "calendar", id: "latest", label: "最新发布" },
  { icon: "swapVertical", id: "earliest", label: "最早发布" },
  { icon: "eye", id: "views", label: "阅读最多" },
];

function isArticleSortMode(value: string): value is ArticleSortMode {
  return sortOptions.some((option) => option.id === value);
}

function getNextSortMode(value: Key | null) {
  if (value === null) return "latest";

  const nextValue = String(value);
  return isArticleSortMode(nextValue) ? nextValue : "latest";
}

function getArticleTime(article: BlogArticle) {
  const time = new Date(article.publishedAt ?? article.date).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function getArticleExcerpt(article: BlogArticle) {
  const excerpt = article.excerpt.trim();
  return excerpt || "这篇文章还没有填写摘要。";
}

function sortArticles(articles: BlogArticle[], sortMode: ArticleSortMode) {
  return [...articles].sort((left, right) => {
    if (sortMode === "views") return right.readCount - left.readCount;

    const leftTime = getArticleTime(left);
    const rightTime = getArticleTime(right);
    return sortMode === "latest" ? rightTime - leftTime : leftTime - rightTime;
  });
}

type ArticleIndexCardProps = {
  article: BlogArticle;
  fallbackCoverUrl?: string;
  index: number;
};

function ArticleIndexCard({ article, fallbackCoverUrl, index }: ArticleIndexCardProps) {
  const coverUrl = article.cover || fallbackCoverUrl;
  const excerpt = getArticleExcerpt(article);

  return (
    <article className="articles-index-card">
      <Link
        aria-label={`阅读${article.title}`}
        className="articles-index-card__cover"
        to={`/articles/${article.slug}`}
      >
        {coverUrl ? (
          <img alt={article.cover ? article.title : ""} src={coverUrl} />
        ) : (
          <span className="articles-index-card__cover-empty">
            <AppIcon name={index % 2 === 0 ? "reader" : "documentText"} size={34} />
            <span>{article.category}</span>
          </span>
        )}
      </Link>
      <div className="articles-index-card__body">
        <div className="articles-index-card__meta">
          <span>
            <AppIcon name="calendar" size={14} />
            {article.date}
          </span>
          <span>
            <AppIcon name="folderOpen" size={14} />
            {article.category}
          </span>
          <span>
            <AppIcon name="reader" size={14} />
            {article.readTime}
          </span>
        </div>
        <h2>
          <Link to={`/articles/${article.slug}`}>{article.title}</Link>
        </h2>
        <p>{excerpt}</p>
        <div className="articles-index-card__footer">
          <div className="articles-index-card__tags">
            {article.tags.slice(0, 3).map((tag) => (
              <ArticleTagLink key={tag.slug} tag={tag} />
            ))}
          </div>
          <Link className="articles-index-card__read" to={`/articles/${article.slug}`}>
            阅读全文 &gt;
          </Link>
        </div>
      </div>
    </article>
  );
}

function ArticlesIndexHeroWaves() {
  return (
    <svg
      aria-hidden
      className="articles-index-hero__waves"
      preserveAspectRatio="none"
      viewBox="0 24 150 28"
    >
      <defs>
        <path
          d="M-160 44c30 0 58-18 88-18s58 18 88 18 58-18 88-18 58 18 88 18v44h-352z"
          id="articles-index-hero-wave-path"
        />
      </defs>
      <g className="articles-index-hero__waves-parallax">
        <use
          className="articles-index-hero__wave articles-index-hero__wave--one"
          href="#articles-index-hero-wave-path"
          x="48"
          y="0"
        />
        <use
          className="articles-index-hero__wave articles-index-hero__wave--two"
          href="#articles-index-hero-wave-path"
          x="48"
          y="3"
        />
        <use
          className="articles-index-hero__wave articles-index-hero__wave--three"
          href="#articles-index-hero-wave-path"
          x="48"
          y="5"
        />
        <use
          className="articles-index-hero__wave articles-index-hero__wave--four"
          href="#articles-index-hero-wave-path"
          x="48"
          y="7"
        />
      </g>
    </svg>
  );
}

export function BlogArticlesPage() {
  const [articles, setArticles] = useState<BlogArticle[]>([]);
  const [siteInfo, setSiteInfo] = useState<PublicSiteInfo | null>(null);
  const [sortMode, setSortMode] = useState<ArticleSortMode>("latest");
  const [status, setStatus] = useState<"error" | "idle" | "loading">("loading");
  const sortedArticles = useMemo(() => sortArticles(articles, sortMode), [articles, sortMode]);
  const homeCoverUrls = useMemo(() => getHeroCoverUrls(siteInfo), [siteInfo]);
  const fallbackCoverAssignments = useMemo(
    () =>
      createRandomCoverAssignments({
        coverUrls: homeCoverUrls,
        getKey: (article: BlogArticle) => article.slug,
        items: sortedArticles.filter((article) => !article.cover),
      }),
    [homeCoverUrls, sortedArticles],
  );

  useEffect(() => {
    let isActive = true;

    async function loadSiteInfo() {
      try {
        const nextSiteInfo = await fetchPublicSiteInfo();
        if (!isActive) return;
        setSiteInfo(nextSiteInfo);
      } catch {
        if (!isActive) return;
        setSiteInfo(null);
      }
    }

    void loadSiteInfo();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    let isActive = true;

    async function loadArticles() {
      try {
        setStatus("loading");
        const nextArticles = await fetchPublicArticles({
          pageSize: 100,
        });
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

  return (
    <section className="articles-index-page">
      <header className="articles-index-hero">
        <PageHeroCoverCarousel siteInfo={siteInfo} />
        <div className="articles-index-hero__content">
          <p className="eyebrow">文章索引</p>
          <h1>
            <AppIcon name="reader" size="clamp(2.25rem, 5vw, 4.5rem)" />
            全部文章
          </h1>
          <p>发现 {articles.length} 篇公开文章</p>
        </div>
        <ArticlesIndexHeroWaves />
      </header>
      <section className="articles-index-content">
        <div className="articles-index-tools">
          <Select
            className="articles-index-sort"
            onChange={(value) => setSortMode(getNextSortMode(value))}
            placeholder="最新发布"
            value={sortMode}
            variant="secondary"
          >
            <Label className="articles-index-sort__label">
              <AppIcon name="swapVertical" />
              排序方式
            </Label>
            <Select.Trigger className="articles-index-sort__trigger">
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox aria-label="排序方式">
                {sortOptions.map((option) => (
                  <ListBox.Item
                    className="articles-index-sort__item"
                    id={option.id}
                    key={option.id}
                    textValue={option.label}
                  >
                    <span className="articles-index-sort__option">
                      <AppIcon name={option.icon} />
                      {option.label}
                    </span>
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>
        </div>
        {sortedArticles.length > 0 ? (
          <div className="articles-index-grid">
            {sortedArticles.map((article, index) => (
              <ArticleIndexCard
                article={article}
                fallbackCoverUrl={fallbackCoverAssignments[article.slug]}
                index={index}
                key={article.slug}
              />
            ))}
          </div>
        ) : (
          <EmptyPlaceholder
            text={status === "error" ? "文章接口暂时不可用。" : "没有匹配的文章。"}
          />
        )}
      </section>
    </section>
  );
}
