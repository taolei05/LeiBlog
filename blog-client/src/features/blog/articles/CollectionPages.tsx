import type { CSSProperties } from "react";
import type { Key } from "@heroui/react";

import { Label, ListBox, Select } from "@heroui/react";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";

import { AppIcon } from "../../../shared/icons";
import type { PublicSiteInfo } from "../../../shared/site/site-info";
import { fetchPublicSiteInfo } from "../../../shared/site/site-info";
import { BlogPageHeader, EmptyPlaceholder } from "../shared/BlogComponents";
import type { BlogArticle, BlogCategory, BlogTag } from "../shared/blogApi";
import { deriveBlogCategories, deriveBlogTags, fetchPublicArticles } from "../shared/blogApi";
import { PageHeroCoverCarousel } from "../shared/HeroCoverCarousel";
import { getArchiveTagColorStyle, normalizeBlogTagColor } from "../shared/tagColors";

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

type CategorySortMode = "earliest" | "latest" | "views";

type ArchiveSortMode = "earliest" | "latest";

const categorySortOptions: {
  icon: "calendar" | "eye" | "swapVertical";
  id: CategorySortMode;
  label: string;
}[] = [
  { icon: "calendar", id: "latest", label: "最新发布" },
  { icon: "swapVertical", id: "earliest", label: "最早发布" },
  { icon: "eye", id: "views", label: "阅读最多" },
];

const archiveSortOptions: {
  icon: "calendar" | "swapVertical";
  id: ArchiveSortMode;
  label: string;
}[] = [
  { icon: "calendar", id: "latest", label: "最新优先" },
  { icon: "swapVertical", id: "earliest", label: "最早优先" },
];

const archiveMonthLabels = [
  "一月",
  "二月",
  "三月",
  "四月",
  "五月",
  "六月",
  "七月",
  "八月",
  "九月",
  "十月",
  "十一月",
  "十二月",
] as const;

function isCategorySortMode(value: string): value is CategorySortMode {
  return categorySortOptions.some((option) => option.id === value);
}

function getNextCategorySortMode(value: Key | null) {
  if (value === null) return "latest";

  const nextValue = String(value);
  return isCategorySortMode(nextValue) ? nextValue : "latest";
}

function isArchiveSortMode(value: string): value is ArchiveSortMode {
  return archiveSortOptions.some((option) => option.id === value);
}

function getNextArchiveSortMode(value: Key | null) {
  if (value === null) return "latest";

  const nextValue = String(value);
  return isArchiveSortMode(nextValue) ? nextValue : "latest";
}

function getCategoryArticleTime(article: BlogArticle) {
  const time = new Date(article.publishedAt ?? article.date).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function getCategoryArticleExcerpt(article: BlogArticle) {
  const excerpt = article.excerpt.trim();
  return excerpt || "这篇文章还没有填写摘要。";
}

function sortCategoryArticles(articles: BlogArticle[], sortMode: CategorySortMode) {
  return [...articles].sort((left, right) => {
    if (sortMode === "views") return right.readCount - left.readCount;

    const leftTime = getCategoryArticleTime(left);
    const rightTime = getCategoryArticleTime(right);
    return sortMode === "latest" ? rightTime - leftTime : leftTime - rightTime;
  });
}

function sortArchiveArticles(articles: BlogArticle[], sortMode: ArchiveSortMode) {
  return [...articles].sort((left, right) => {
    const leftTime = getCategoryArticleTime(left);
    const rightTime = getCategoryArticleTime(right);
    return sortMode === "latest" ? rightTime - leftTime : leftTime - rightTime;
  });
}

const categoryTones = ["violet", "pink", "cyan", "green", "amber"] as const;

type CategoryTone = (typeof categoryTones)[number];

type BlogCategoryGroup = BlogCategory & {
  articles: BlogArticle[];
  coverUrl: string | null;
  tone: CategoryTone;
};

type BlogTagGroup = BlogTag & {
  articles: BlogArticle[];
  color: string;
};

type TagCloudStyle = CSSProperties & {
  "--tag-color"?: string;
};

type ArchiveArticleEntry = {
  article: BlogArticle;
  day: string;
  monthIndex: number;
  yearLabel: string;
};

type ArchiveMonthGroup = {
  entries: ArchiveArticleEntry[];
  key: string;
  label: string;
};

type ArchiveYearGroup = {
  key: string;
  label: string;
  months: ArchiveMonthGroup[];
};

function buildCategoryGroups(articles: BlogArticle[]): BlogCategoryGroup[] {
  return deriveBlogCategories(articles).map((category, index) => {
    const categoryArticles = articles.filter((article) =>
      article.categories.some((item) => item.slug === category.slug),
    );
    const latestArticle = sortCategoryArticles(categoryArticles, "latest")[0] ?? null;

    return {
      ...category,
      articles: categoryArticles,
      coverUrl: latestArticle?.cover ?? null,
      tone: categoryTones[index % categoryTones.length],
    };
  });
}

function buildTagGroups(articles: BlogArticle[]): BlogTagGroup[] {
  return deriveBlogTags(articles).map((tag) => ({
    ...tag,
    articles: articles.filter((article) => article.tags.some((item) => item.slug === tag.slug)),
    color: normalizeBlogTagColor(tag.color),
  }));
}

function getArchiveDatePart(article: BlogArticle) {
  const date = new Date(article.publishedAt ?? article.date);

  if (Number.isNaN(date.getTime())) {
    return {
      day: "--",
      monthIndex: 0,
      yearLabel: "未发布",
    };
  }

  const parts = new Intl.DateTimeFormat("zh-CN", {
    day: "2-digit",
    month: "numeric",
    timeZone: "Asia/Shanghai",
    year: "numeric",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "未发布";
  const month = Number(parts.find((part) => part.type === "month")?.value ?? "1");
  const day = parts.find((part) => part.type === "day")?.value ?? "--";

  return {
    day,
    monthIndex: Math.max(0, month - 1),
    yearLabel: year,
  };
}

function toArchiveArticleEntry(article: BlogArticle): ArchiveArticleEntry {
  return {
    article,
    ...getArchiveDatePart(article),
  };
}

function buildArchiveGroups(
  articles: BlogArticle[],
  sortMode: ArchiveSortMode,
): ArchiveYearGroup[] {
  const yearGroups = new Map<string, Map<string, ArchiveMonthGroup>>();

  for (const article of sortArchiveArticles(articles, sortMode)) {
    const entry = toArchiveArticleEntry(article);
    const monthLabel = archiveMonthLabels[entry.monthIndex] ?? "未知月份";
    const monthKey = `${entry.yearLabel}-${entry.monthIndex}`;
    const yearGroup = yearGroups.get(entry.yearLabel) ?? new Map<string, ArchiveMonthGroup>();
    const monthGroup = yearGroup.get(monthKey) ?? {
      entries: [],
      key: monthKey,
      label: monthLabel,
    };

    monthGroup.entries.push(entry);
    yearGroup.set(monthKey, monthGroup);
    yearGroups.set(entry.yearLabel, yearGroup);
  }

  return [...yearGroups.entries()].map(([yearLabel, monthGroups]) => ({
    key: yearLabel,
    label: yearLabel,
    months: [...monthGroups.values()],
  }));
}

function getCategoryPath(category: BlogCategoryGroup) {
  return `/categories/${encodeURIComponent(category.slug)}`;
}

function getTagPathBySlug(slug: string) {
  return `/tags/${encodeURIComponent(slug)}`;
}

function getTagPath(tag: Pick<BlogTag, "slug">) {
  return getTagPathBySlug(tag.slug);
}

function CategoryHeroWaves() {
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
          id="category-hero-wave-path"
        />
      </defs>
      <g className="articles-index-hero__waves-parallax">
        <use
          className="articles-index-hero__wave articles-index-hero__wave--one"
          href="#category-hero-wave-path"
          x="48"
          y="0"
        />
        <use
          className="articles-index-hero__wave articles-index-hero__wave--two"
          href="#category-hero-wave-path"
          x="48"
          y="3"
        />
        <use
          className="articles-index-hero__wave articles-index-hero__wave--three"
          href="#category-hero-wave-path"
          x="48"
          y="5"
        />
        <use
          className="articles-index-hero__wave articles-index-hero__wave--four"
          href="#category-hero-wave-path"
          x="48"
          y="7"
        />
      </g>
    </svg>
  );
}

type CategoryOverviewCardProps = {
  category: BlogCategoryGroup;
};

type CategoryOverviewCardStyle = CSSProperties & {
  "--category-cover"?: string;
};

function CategoryOverviewCard({ category }: CategoryOverviewCardProps) {
  const coverStyle: CategoryOverviewCardStyle | undefined = category.coverUrl
    ? { "--category-cover": `url("${category.coverUrl.replace(/"/g, '\\"')}")` }
    : undefined;

  return (
    <Link
      className={[
        "category-overview-card",
        `category-overview-card--${category.tone}`,
        category.coverUrl ? "has-cover" : "has-empty-cover",
      ].join(" ")}
      style={coverStyle}
      to={getCategoryPath(category)}
    >
      <span className="category-overview-card__top">
        <span className="category-overview-card__cover-mark">
          <AppIcon name="albums" size={34} />
        </span>
      </span>
      <span className="category-overview-card__body">
        <strong>{category.name}</strong>
        <span>
          <AppIcon name="documentText" size={16} />
          {category.count} 篇文章
        </span>
      </span>
      <span className="category-overview-card__footer">
        点击查看该分类下的所有文章
        <AppIcon name="chevronForward" size={16} />
      </span>
    </Link>
  );
}

type CategorySortSelectProps = {
  onSortChange: (sortMode: CategorySortMode) => void;
  sortMode: CategorySortMode;
};

function CategorySortSelect({ onSortChange, sortMode }: CategorySortSelectProps) {
  return (
    <Select
      className="category-detail-sort"
      onChange={(value) => onSortChange(getNextCategorySortMode(value))}
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
        <ListBox aria-label="分类文章排序">
          {categorySortOptions.map((option) => (
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
  );
}

function TagSortSelect({ onSortChange, sortMode }: CategorySortSelectProps) {
  return (
    <Select
      className="category-detail-sort"
      onChange={(value) => onSortChange(getNextCategorySortMode(value))}
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
        <ListBox aria-label="标签文章排序">
          {categorySortOptions.map((option) => (
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
  );
}

type ArchiveSortSelectProps = {
  onSortChange: (sortMode: ArchiveSortMode) => void;
  sortMode: ArchiveSortMode;
};

function ArchiveSortSelect({ onSortChange, sortMode }: ArchiveSortSelectProps) {
  return (
    <Select
      className="archive-sort"
      onChange={(value) => onSortChange(getNextArchiveSortMode(value))}
      placeholder="最新优先"
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
        <ListBox aria-label="归档文章排序">
          {archiveSortOptions.map((option) => (
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
  );
}

type CategoryArticleRowProps = {
  article: BlogArticle;
  category: BlogCategoryGroup;
  index: number;
};

function CategoryArticleRow({ article, category, index }: CategoryArticleRowProps) {
  return (
    <article className={`category-article-row category-article-row--${category.tone}`}>
      <span className="category-article-row__index">{index + 1}</span>
      <div className="category-article-row__content">
        <h3>
          <Link to={`/articles/${article.slug}`}>{article.title}</Link>
        </h3>
        <p>{getCategoryArticleExcerpt(article)}</p>
        <div className="category-article-row__meta">
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
          {article.tags.slice(0, 4).map((tag) => {
            const style = getArchiveTagColorStyle(tag.color);

            return (
              <Link
                className="category-article-row__tag"
                key={tag.slug}
                style={style}
                to={getTagPathBySlug(tag.slug)}
              >
                #{tag.name}
              </Link>
            );
          })}
        </div>
      </div>
    </article>
  );
}

type TagArticleRowProps = {
  article: BlogArticle;
  index: number;
  tag: BlogTagGroup;
};

type TagArticleRowStyle = CSSProperties & {
  "--category-row-accent"?: string;
};

function TagArticleRow({ article, index, tag }: TagArticleRowProps) {
  const style: TagArticleRowStyle = {
    "--category-row-accent": tag.color,
  };

  return (
    <article className="category-article-row tag-article-row" style={style}>
      <span className="category-article-row__index">{index + 1}</span>
      <div className="category-article-row__content">
        <h3>
          <Link to={`/articles/${article.slug}`}>{article.title}</Link>
        </h3>
        <p>{getCategoryArticleExcerpt(article)}</p>
        <div className="category-article-row__meta">
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
          {article.tags.slice(0, 4).map((item) => {
            const style = getArchiveTagColorStyle(item.color);

            return (
              <Link
                className="category-article-row__tag"
                key={item.slug}
                style={style}
                to={getTagPathBySlug(item.slug)}
              >
                #{item.name}
              </Link>
            );
          })}
        </div>
      </div>
    </article>
  );
}

type CategoryDetailViewProps = {
  allArticles: BlogArticle[];
  categories: BlogCategoryGroup[];
  category: BlogCategoryGroup | null;
  onSortChange: (sortMode: CategorySortMode) => void;
  siteInfo: PublicSiteInfo | null;
  sortMode: CategorySortMode;
  status: "error" | "idle" | "loading";
};

function CategoryDetailView({
  allArticles,
  categories,
  category,
  onSortChange,
  siteInfo,
  sortMode,
  status,
}: CategoryDetailViewProps) {
  const sortedArticles = category ? sortCategoryArticles(category.articles, sortMode) : [];

  return (
    <section className="category-detail-page">
      <header className="articles-index-hero category-hero">
        <PageHeroCoverCarousel siteInfo={siteInfo} />
        <div className="articles-index-hero__content category-hero__content">
          <p className="eyebrow">分类索引</p>
          <h1>
            <AppIcon name="grid" size="clamp(2.25rem, 5vw, 4.5rem)" />
            文章分类
          </h1>
          <p>
            共 {categories.length} 个分类，{allArticles.length} 篇文章
          </p>
        </div>
        <CategoryHeroWaves />
      </header>
      <section className="category-detail-content">
        <div className="category-detail-controls">
          <Link className="category-detail-button" to="/categories">
            <AppIcon name="chevronBack" size={18} />
            返回
          </Link>
          <CategorySortSelect onSortChange={onSortChange} sortMode={sortMode} />
        </div>
        {category ? (
          <>
            <div className={`category-detail-heading category-detail-heading--${category.tone}`}>
              <AppIcon name={category.icon} size={40} />
              <h2>{category.name}</h2>
              <span>{category.count} 篇文章</span>
            </div>
            {sortedArticles.length > 0 ? (
              <div className="category-detail-list">
                {sortedArticles.map((article, index) => (
                  <CategoryArticleRow
                    article={article}
                    category={category}
                    index={index}
                    key={article.slug}
                  />
                ))}
              </div>
            ) : (
              <EmptyPlaceholder text="这个分类下暂时没有文章。" />
            )}
          </>
        ) : (
          <EmptyPlaceholder
            text={
              status === "loading"
                ? "正在读取分类文章。"
                : status === "error"
                  ? "文章接口暂时不可用。"
                  : "没有找到这个分类。"
            }
          />
        )}
      </section>
    </section>
  );
}

export function CategoriesPage() {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const activeCategory = slug ?? searchParams.get("category");
  const { articles: allArticles, status } = useArticleIndex();
  const [siteInfo, setSiteInfo] = useState<PublicSiteInfo | null>(null);
  const [sortMode, setSortMode] = useState<CategorySortMode>("latest");
  const categories = useMemo(() => buildCategoryGroups(allArticles), [allArticles]);
  const category = activeCategory
    ? (categories.find((item) => item.slug === activeCategory) ?? null)
    : null;

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

  if (activeCategory) {
    return (
      <CategoryDetailView
        allArticles={allArticles}
        categories={categories}
        category={category}
        onSortChange={setSortMode}
        siteInfo={siteInfo}
        sortMode={sortMode}
        status={status}
      />
    );
  }

  return (
    <section className="category-index-page">
      <header className="articles-index-hero category-hero">
        <PageHeroCoverCarousel siteInfo={siteInfo} />
        <div className="articles-index-hero__content category-hero__content">
          <p className="eyebrow">分类索引</p>
          <h1>
            <AppIcon name="grid" size="clamp(2.25rem, 5vw, 4.5rem)" />
            文章分类
          </h1>
          <p>
            共 {categories.length} 个分类，{allArticles.length} 篇文章
          </p>
        </div>
        <CategoryHeroWaves />
      </header>
      <section className="category-index-content">
        {categories.length > 0 ? (
          <div className="category-card-grid">
            {categories.map((item) => (
              <CategoryOverviewCard category={item} key={item.slug} />
            ))}
          </div>
        ) : (
          <EmptyPlaceholder text={status === "error" ? "文章接口暂时不可用。" : "暂无分类。"} />
        )}
      </section>
    </section>
  );
}

type TagDetailViewProps = {
  allArticles: BlogArticle[];
  onSortChange: (sortMode: CategorySortMode) => void;
  siteInfo: PublicSiteInfo | null;
  sortMode: CategorySortMode;
  status: "error" | "idle" | "loading";
  tag: BlogTagGroup | null;
  tags: BlogTagGroup[];
};

function TagDetailView({
  allArticles,
  onSortChange,
  siteInfo,
  sortMode,
  status,
  tag,
  tags,
}: TagDetailViewProps) {
  const sortedArticles = tag ? sortCategoryArticles(tag.articles, sortMode) : [];
  const headingStyle: TagCloudStyle | undefined = tag ? { "--tag-color": tag.color } : undefined;

  return (
    <section className="tag-detail-page">
      <header className="articles-index-hero tag-hero">
        <PageHeroCoverCarousel siteInfo={siteInfo} />
        <div className="articles-index-hero__content category-hero__content">
          <p className="eyebrow">标签索引</p>
          <h1>
            <AppIcon name="pricetags" size="clamp(2.25rem, 5vw, 4.5rem)" />
            全部标签
          </h1>
          <p>
            共 {tags.length} 个标签，{allArticles.length} 篇关联文章
          </p>
        </div>
        <CategoryHeroWaves />
      </header>
      <section className="tag-detail-content">
        <div className="category-detail-controls">
          <Link className="category-detail-button" to="/tags">
            <AppIcon name="chevronBack" size={18} />
            返回
          </Link>
          <TagSortSelect onSortChange={onSortChange} sortMode={sortMode} />
        </div>
        {tag ? (
          <>
            <div className="category-detail-heading tag-detail-heading" style={headingStyle}>
              <AppIcon name="pricetags" size={40} />
              <h2>#{tag.name}</h2>
              <span>{tag.count} 篇文章</span>
            </div>
            {sortedArticles.length > 0 ? (
              <div className="category-detail-list">
                {sortedArticles.map((article, index) => (
                  <TagArticleRow article={article} index={index} key={article.slug} tag={tag} />
                ))}
              </div>
            ) : (
              <EmptyPlaceholder text="这个标签下暂时没有文章。" />
            )}
          </>
        ) : (
          <EmptyPlaceholder
            text={
              status === "loading"
                ? "正在读取标签文章。"
                : status === "error"
                  ? "文章接口暂时不可用。"
                  : "没有找到这个标签。"
            }
          />
        )}
      </section>
    </section>
  );
}

export function TagsPage() {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const activeTag = slug ?? searchParams.get("tag");
  const { articles: allArticles, status } = useArticleIndex();
  const [siteInfo, setSiteInfo] = useState<PublicSiteInfo | null>(null);
  const [sortMode, setSortMode] = useState<CategorySortMode>("latest");
  const tags = useMemo(() => buildTagGroups(allArticles), [allArticles]);
  const tag = activeTag ? (tags.find((item) => item.slug === activeTag) ?? null) : null;
  const linkedArticleCount = useMemo(() => {
    const articleIds = new Set<string>();
    for (const item of tags) {
      for (const article of item.articles) {
        articleIds.add(article.id);
      }
    }

    return articleIds.size;
  }, [tags]);

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

  if (activeTag) {
    return (
      <TagDetailView
        allArticles={allArticles}
        onSortChange={setSortMode}
        siteInfo={siteInfo}
        sortMode={sortMode}
        status={status}
        tag={tag}
        tags={tags}
      />
    );
  }

  return (
    <section className="tag-index-page">
      <header className="articles-index-hero tag-hero">
        <PageHeroCoverCarousel siteInfo={siteInfo} />
        <div className="articles-index-hero__content category-hero__content">
          <p className="eyebrow">标签索引</p>
          <h1>
            <AppIcon name="pricetags" size="clamp(2.25rem, 5vw, 4.5rem)" />
            全部标签
          </h1>
          <p>
            共 {tags.length} 个标签，{linkedArticleCount} 篇关联文章
          </p>
        </div>
        <CategoryHeroWaves />
      </header>
      <section className="tag-index-content">
        {tags.length > 0 ? (
          <div className="tag-cloud-panel">
            {tags.map((item) => {
              const style: TagCloudStyle = { "--tag-color": item.color };

              return (
                <Link
                  className="tag-cloud-link"
                  key={item.slug}
                  style={style}
                  to={getTagPath(item)}
                >
                  #{item.name}
                  <span>{item.count}</span>
                </Link>
              );
            })}
          </div>
        ) : (
          <EmptyPlaceholder text={status === "error" ? "文章接口暂时不可用。" : "暂无标签。"} />
        )}
      </section>
    </section>
  );
}

export function ArchivesPage() {
  const { articles, status } = useArticleIndex();
  const [siteInfo, setSiteInfo] = useState<PublicSiteInfo | null>(null);
  const [sortMode, setSortMode] = useState<ArchiveSortMode>("latest");
  const archiveGroups = useMemo(() => buildArchiveGroups(articles, sortMode), [articles, sortMode]);

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

  return (
    <section className="archive-page">
      <header className="articles-index-hero archive-hero">
        <PageHeroCoverCarousel siteInfo={siteInfo} />
        <div className="articles-index-hero__content archive-hero__content">
          <p className="eyebrow">文章索引</p>
          <h1>
            <AppIcon name="archive" size="clamp(2.25rem, 5vw, 4.5rem)" />
            文章归档
          </h1>
          <p>共 {articles.length} 篇文章，记录成长的每一步</p>
        </div>
        <CategoryHeroWaves />
      </header>
      <section className="archive-content">
        <div className="archive-toolbar">
          <ArchiveSortSelect onSortChange={setSortMode} sortMode={sortMode} />
        </div>
        {archiveGroups.length > 0 ? (
          <div className="archive-timeline">
            {archiveGroups.map((yearGroup) => (
              <section className="archive-year" key={yearGroup.key}>
                <div className="archive-year__heading">
                  <h2>{yearGroup.label}</h2>
                  <span aria-hidden />
                </div>
                <div className="archive-year__months">
                  {yearGroup.months.map((monthGroup) => (
                    <section className="archive-month" key={monthGroup.key}>
                      <span aria-hidden className="archive-month__dot" />
                      <div className="archive-month__body">
                        <h3 className="archive-month__heading">
                          <AppIcon name="calendar" size={16} />
                          {monthGroup.label} · {monthGroup.entries.length}篇
                        </h3>
                        <div className="archive-month__entries">
                          {monthGroup.entries.map((entry) => (
                            <ArchiveArticleRow entry={entry} key={entry.article.slug} />
                          ))}
                        </div>
                      </div>
                    </section>
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <EmptyPlaceholder
            text={
              status === "loading"
                ? "正在读取归档文章。"
                : status === "error"
                  ? "文章接口暂时不可用。"
                  : "暂无归档文章。"
            }
          />
        )}
      </section>
    </section>
  );
}

type ArchiveArticleRowProps = {
  entry: ArchiveArticleEntry;
};

function ArchiveArticleRow({ entry }: ArchiveArticleRowProps) {
  const { article, day } = entry;
  const dateTime = article.publishedAt ?? article.date;

  return (
    <Link className="archive-entry" to={`/articles/${article.slug}`}>
      <time className="archive-entry__day" dateTime={dateTime}>
        {day}
      </time>
      <span className="archive-entry__main">
        <span className="archive-entry__title">{article.title}</span>
        <span className="archive-entry__excerpt">{getCategoryArticleExcerpt(article)}</span>
      </span>
      <span className="archive-entry__chips">
        <span className="archive-entry__chip archive-entry__chip--category">
          <AppIcon name="folderOpen" size={14} />
          {article.category}
        </span>
        {article.tags.slice(0, 5).map((tag) => {
          const style = getArchiveTagColorStyle(tag.color);

          return (
            <span
              className="archive-entry__chip archive-entry__chip--tag"
              key={tag.slug}
              style={style}
            >
              #{tag.name}
            </span>
          );
        })}
      </span>
    </Link>
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
