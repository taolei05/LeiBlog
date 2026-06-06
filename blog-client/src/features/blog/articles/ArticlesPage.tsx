import type { Key } from "@heroui/react";

import { Label, ListBox, Pagination, Select } from "@heroui/react";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

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
type ArticleListStatus = "error" | "idle" | "loading";

export const ARTICLES_PER_PAGE = 9;

export type ArticlePaginationItem = "ellipsis-end" | "ellipsis-start" | number;

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

export function getArticleListEmptyText({
  isSearchResult,
  searchQuery,
  status,
}: {
  isSearchResult: boolean;
  searchQuery: string;
  status: ArticleListStatus;
}) {
  if (status === "loading") {
    return isSearchResult ? `正在搜索“${searchQuery}”。` : "正在加载文章。";
  }

  if (status === "error") {
    return "文章接口暂时不可用。";
  }

  return isSearchResult ? `没有找到与“${searchQuery}”匹配的文章。` : "没有匹配的文章。";
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

function getClampedArticlePage({
  currentPage,
  pageCount,
}: {
  currentPage: number;
  pageCount: number;
}) {
  const page = Number.isFinite(currentPage) ? Math.trunc(currentPage) : 1;
  return Math.min(Math.max(page, 1), pageCount);
}

export function createArticlePaginationItems({
  currentPage,
  pageCount,
}: {
  currentPage: number;
  pageCount: number;
}): ArticlePaginationItem[] {
  const items: ArticlePaginationItem[] = [];
  let lastVisiblePage = 0;

  for (let page = 1; page <= pageCount; page += 1) {
    const isBoundary = page === 1 || page === pageCount;
    const isNearCurrent = Math.abs(page - currentPage) <= 1;
    const isNearStart = currentPage <= 4 && page <= 5;
    const isNearEnd = currentPage >= pageCount - 3 && page >= pageCount - 4;

    if (!isBoundary && !isNearCurrent && !isNearStart && !isNearEnd) {
      continue;
    }

    if (lastVisiblePage > 0 && page - lastVisiblePage > 1) {
      items.push(page < currentPage ? "ellipsis-start" : "ellipsis-end");
    }

    items.push(page);
    lastVisiblePage = page;
  }

  return items;
}

export function createArticlePaginationViewModel<TArticle>({
  articles,
  currentPage,
}: {
  articles: TArticle[];
  currentPage: number;
}) {
  const pageCount = Math.max(1, Math.ceil(articles.length / ARTICLES_PER_PAGE));
  const page = getClampedArticlePage({ currentPage, pageCount });
  const fromArticle = articles.length > 0 ? (page - 1) * ARTICLES_PER_PAGE + 1 : 0;
  const toArticle = Math.min(page * ARTICLES_PER_PAGE, articles.length);
  const pageArticles = articles.slice(fromArticle > 0 ? fromArticle - 1 : 0, toArticle);

  return {
    currentPage: page,
    fromArticle,
    pageArticles,
    pageCount,
    toArticle,
  };
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
  const [searchParams] = useSearchParams();
  const searchQuery = searchParams.get("q")?.trim() ?? "";
  const isSearchResult = searchQuery.length > 0;
  const [articles, setArticles] = useState<BlogArticle[]>([]);
  const [articlePage, setArticlePage] = useState(1);
  const [siteInfo, setSiteInfo] = useState<PublicSiteInfo | null>(null);
  const [sortMode, setSortMode] = useState<ArticleSortMode>("latest");
  const [status, setStatus] = useState<ArticleListStatus>("loading");
  const sortedArticles = useMemo(() => sortArticles(articles, sortMode), [articles, sortMode]);
  const { currentPage, fromArticle, pageArticles, pageCount, toArticle } = useMemo(
    () =>
      createArticlePaginationViewModel({
        articles: sortedArticles,
        currentPage: articlePage,
      }),
    [articlePage, sortedArticles],
  );
  const paginationItems = useMemo(
    () => createArticlePaginationItems({ currentPage, pageCount }),
    [currentPage, pageCount],
  );
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
    if (articlePage === currentPage) return;
    setArticlePage(currentPage);
  }, [articlePage, currentPage]);

  useEffect(() => {
    setArticlePage(1);
  }, [searchQuery]);

  function updateSortMode(value: Key | null) {
    setSortMode(getNextSortMode(value));
    setArticlePage(1);
  }

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
        setArticles([]);
        const nextArticles = await fetchPublicArticles({
          pageSize: 100,
          search: searchQuery || undefined,
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
  }, [searchQuery]);

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
          <p>
            {isSearchResult
              ? `搜索“${searchQuery}”，找到 ${articles.length} 篇公开文章`
              : `发现 ${articles.length} 篇公开文章`}
          </p>
        </div>
        <ArticlesIndexHeroWaves />
      </header>
      <section className="articles-index-content">
        <div className="articles-index-tools">
          {isSearchResult ? (
            <div className="articles-index-search-state">
              <span className="articles-index-search-state__query">
                <AppIcon name="search" />
                搜索“{searchQuery}”
              </span>
              <span className="articles-index-search-state__count">
                找到 {sortedArticles.length} 篇文章
              </span>
              <Link className="articles-index-search-state__clear" to="/articles">
                清除搜索
              </Link>
            </div>
          ) : null}
          <Select
            className="articles-index-sort"
            onChange={updateSortMode}
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
          <>
            <div className="articles-index-grid">
              {pageArticles.map((article, index) => (
                <ArticleIndexCard
                  article={article}
                  fallbackCoverUrl={fallbackCoverAssignments[article.slug]}
                  index={fromArticle + index - 1}
                  key={article.slug}
                />
              ))}
            </div>
            {pageCount > 1 ? (
              <Pagination className="articles-index-pagination" size="sm">
                <Pagination.Summary>
                  显示 {fromArticle}-{toArticle} / {sortedArticles.length} 篇，第 {currentPage} /{" "}
                  {pageCount} 页
                </Pagination.Summary>
                <Pagination.Content>
                  <Pagination.Item>
                    <Pagination.Previous
                      isDisabled={currentPage <= 1}
                      onPress={() => setArticlePage(currentPage - 1)}
                    >
                      <Pagination.PreviousIcon />
                      <span>上一页</span>
                    </Pagination.Previous>
                  </Pagination.Item>
                  {paginationItems.map((item) =>
                    typeof item === "number" ? (
                      <Pagination.Item key={item}>
                        <Pagination.Link
                          isActive={item === currentPage}
                          onPress={() => setArticlePage(item)}
                        >
                          {item}
                        </Pagination.Link>
                      </Pagination.Item>
                    ) : (
                      <Pagination.Item key={item}>
                        <Pagination.Ellipsis />
                      </Pagination.Item>
                    ),
                  )}
                  <Pagination.Item>
                    <Pagination.Next
                      isDisabled={currentPage >= pageCount}
                      onPress={() => setArticlePage(currentPage + 1)}
                    >
                      <span>下一页</span>
                      <Pagination.NextIcon />
                    </Pagination.Next>
                  </Pagination.Item>
                </Pagination.Content>
              </Pagination>
            ) : null}
          </>
        ) : (
          <EmptyPlaceholder
            text={getArticleListEmptyText({ isSearchResult, searchQuery, status })}
          />
        )}
      </section>
    </section>
  );
}
