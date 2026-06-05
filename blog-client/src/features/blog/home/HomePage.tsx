import type { PublicSiteAuthor, PublicSiteInfo } from "../../../shared/site/site-info";
import type { BlogArticle, BlogCategory, BlogTag } from "../shared/blogApi";

import { Avatar, Card, Chip } from "@heroui/react";
import { motion, useAnimationFrame, useMotionValue, useTransform } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { AppIcon } from "../../../shared/icons/AppIcon";
import { fetchPublicSiteAuthor, fetchPublicSiteInfo } from "../../../shared/site/site-info";
import { BlogPageHeader, EmptyPlaceholder } from "../shared/BlogComponents";
import { deriveBlogCategories, deriveBlogTags, fetchPublicArticles } from "../shared/blogApi";
import {
  createRandomCoverAssignments,
  getHeroCoverUrls,
  HeroCoverCarousel,
  useHeroCoverCarousel,
} from "../shared/HeroCoverCarousel";

const SOCIAL_LABELS: Record<string, string> = {
  bilibili: "Bilibili",
  email: "邮箱",
  github: "GitHub",
  gitlab: "GitLab",
  juejin: "掘金",
  twitter: "Twitter",
  x: "X",
  zhihu: "知乎",
};

export const HOME_LATEST_ARTICLE_LIMIT = 6;
const HOME_PINNED_ARTICLE_LIMIT = 4;

function getAuthorName(author: PublicSiteAuthor | null, siteInfo: PublicSiteInfo | null) {
  return author?.name ?? author?.username ?? siteInfo?.siteName ?? "LeiBlog";
}

function getAuthorFallback(name: string) {
  return name.trim().slice(0, 1).toUpperCase() || "L";
}

function getSocialLabel(key: string) {
  return SOCIAL_LABELS[key.toLowerCase()] ?? key;
}

export function getHomeArticleList<TArticle extends { isPinned: boolean }>({
  articles,
  isPinned,
}: {
  articles: TArticle[];
  isPinned: boolean;
}) {
  return articles
    .filter((article) => article.isPinned === isPinned)
    .slice(0, isPinned ? HOME_PINNED_ARTICLE_LIMIT : HOME_LATEST_ARTICLE_LIMIT);
}

function getArticleExcerpt(article: BlogArticle) {
  const excerpt = article.excerpt.trim();

  if (excerpt) return excerpt;

  const bodyText = (article.contentMdx ?? "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)]\([^)]*\)/g, "$1")
    .replace(/<[^>]*>/g, " ")
    .replace(/[#*_`>{}()[\]\\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!bodyText) return "这篇文章还没有填写摘要。";

  return bodyText.length > 120 ? `${bodyText.slice(0, 120)}...` : bodyText;
}

function getHomeSlogan(siteInfo: PublicSiteInfo | null) {
  return siteInfo?.homeSlogan.trim() || null;
}

export function BlogHomePage() {
  const [articles, setArticles] = useState<BlogArticle[]>([]);
  const [author, setAuthor] = useState<PublicSiteAuthor | null>(null);
  const [siteInfo, setSiteInfo] = useState<PublicSiteInfo | null>(null);
  const [status, setStatus] = useState<"error" | "idle" | "loading">("loading");
  const categories = useMemo(() => deriveBlogCategories(articles), [articles]);
  const latestArticles = useMemo(
    () => getHomeArticleList({ articles, isPinned: false }),
    [articles],
  );
  const pinnedArticles = useMemo(
    () => getHomeArticleList({ articles, isPinned: true }),
    [articles],
  );
  const tags = useMemo(() => deriveBlogTags(articles), [articles]);
  const homeCoverUrls = useMemo(() => getHeroCoverUrls(siteInfo), [siteInfo]);

  useEffect(() => {
    let isActive = true;

    async function loadHomeData() {
      setStatus("loading");
      const [articleResult, siteResult, authorResult] = await Promise.allSettled([
        fetchPublicArticles({ pageSize: 24, sortBy: "publishedAt", sortOrder: "desc" }),
        fetchPublicSiteInfo(),
        fetchPublicSiteAuthor(),
      ]);

      if (!isActive) return;

      if (siteResult.status === "fulfilled") {
        setSiteInfo(siteResult.value);
      }

      if (authorResult.status === "fulfilled") {
        setAuthor(authorResult.value);
      }

      if (articleResult.status === "fulfilled") {
        setArticles(articleResult.value);
        setStatus("idle");
        return;
      }

      if (articleResult.status === "rejected") {
        setArticles([]);
        setStatus("error");
      }
    }

    void loadHomeData();

    return () => {
      isActive = false;
    };
  }, []);

  return (
    <section className="front-stack home-page">
      <HomeHero author={author} siteInfo={siteInfo} />

      <div className="home-page__content">
        <BlogPageHeader
          description="置顶内容、最新文章和站点导航集中在首页，优先把可读内容放到前面。"
          eyebrow="主页"
          icon="home"
          title={siteInfo?.siteName ?? "LeiBlog"}
        />

        <div className="home-page__layout">
          <main className="home-page__main">
            <HomeArticleSection
              articles={pinnedArticles}
              emptyText={status === "error" ? "文章接口暂时不可用。" : "暂无置顶文章。"}
              fallbackCoverUrls={homeCoverUrls}
              icon="bookmark"
              section="pinned"
              title="置顶文章"
            />
            <HomeArticleSection
              articles={
                latestArticles.length > 0
                  ? latestArticles
                  : articles.slice(0, HOME_LATEST_ARTICLE_LIMIT)
              }
              emptyText={status === "error" ? "文章接口暂时不可用。" : "正在读取最新文章。"}
              fallbackCoverUrls={homeCoverUrls}
              icon="reader"
              section="latest"
              title="最新文章"
            />
          </main>

          <aside aria-label="首页侧栏" className="home-page__sidebar">
            <HomeAuthorCard author={author} siteInfo={siteInfo} />
            <HomeCategoryCard categories={categories} />
            <HomeTagCard tags={tags} />
          </aside>
        </div>
      </div>
    </section>
  );
}

type HomeHeroProps = {
  author: PublicSiteAuthor | null;
  siteInfo: PublicSiteInfo | null;
};

export function HomeHero({ author, siteInfo }: HomeHeroProps) {
  const { activeCoverIndex, coverUrls, setActiveCoverIndex } = useHeroCoverCarousel(siteInfo);
  const slogan = getHomeSlogan(siteInfo);
  const siteName = siteInfo?.siteName ?? "LeiBlog";
  const authorName = getAuthorName(author, siteInfo);

  return (
    <section aria-label="主页首屏" className="home-hero-showcase">
      <HeroCoverCarousel
        activeIndex={activeCoverIndex}
        activeSlideClassName="home-hero-showcase__slide--active"
        className="home-hero-showcase__carousel"
        coverUrls={coverUrls}
        slideClassName="home-hero-showcase__slide"
      />
      <div className="home-hero-showcase__shade" />
      <div className="home-hero-showcase__content">
        <Avatar className="home-hero-showcase__avatar">
          {author?.avatarUrl ? <Avatar.Image src={author.avatarUrl} /> : null}
          <Avatar.Fallback>{getAuthorFallback(authorName)}</Avatar.Fallback>
        </Avatar>
        <h1 aria-label={siteName}>
          <ShinyText
            className="home-hero-shiny-title"
            color="rgb(255 255 255 / 82%)"
            delay={0.7}
            shineColor="#ffffff"
            speed={3.4}
            text={siteName}
          />
        </h1>
        {slogan ? <HomeTextType text={slogan} /> : null}
        <nav aria-label="主页快捷入口" className="home-hero-showcase__actions">
          <Link
            className="home-hero-showcase__action home-hero-showcase__action--primary"
            to="/articles"
          >
            <AppIcon name="documentText" size={18} />
            浏览文章
          </Link>
          <Link className="home-hero-showcase__action" to="/archives">
            <AppIcon name="archive" size={18} />
            归档
          </Link>
        </nav>
        {coverUrls.length > 1 ? (
          <div aria-label="主页封面轮播" className="home-hero-showcase__dots" role="group">
            {coverUrls.map((coverUrl, index) => (
              <button
                aria-current={index === activeCoverIndex ? "true" : undefined}
                aria-label={`封面 ${index + 1} / ${coverUrls.length}`}
                key={coverUrl}
                onClick={() => setActiveCoverIndex(index)}
                type="button"
              />
            ))}
          </div>
        ) : null}
      </div>
      <HomeHeroWaves />
    </section>
  );
}

type HomeTextTypeProps = {
  text: string;
};

type ShinyTextProps = {
  className?: string;
  color?: string;
  delay?: number;
  direction?: "left" | "right";
  disabled?: boolean;
  pauseOnHover?: boolean;
  shineColor?: string;
  speed?: number;
  spread?: number;
  text: string;
  yoyo?: boolean;
};

function ShinyText({
  className = "",
  color = "#b5b5b5",
  delay = 0,
  direction = "left",
  disabled = false,
  pauseOnHover = false,
  shineColor = "#ffffff",
  speed = 2,
  spread = 120,
  text,
  yoyo = false,
}: ShinyTextProps) {
  const [isPaused, setIsPaused] = useState(false);
  const progress = useMotionValue(0);
  const elapsedRef = useRef(0);
  const lastTimeRef = useRef<null | number>(null);
  const directionRef = useRef(direction === "left" ? 1 : -1);

  const animationDuration = speed * 1000;
  const delayDuration = delay * 1000;

  useAnimationFrame((time) => {
    if (disabled || isPaused) {
      lastTimeRef.current = null;
      return;
    }

    if (lastTimeRef.current === null) {
      lastTimeRef.current = time;
      return;
    }

    const deltaTime = time - lastTimeRef.current;
    lastTimeRef.current = time;
    elapsedRef.current += deltaTime;

    if (yoyo) {
      const cycleDuration = animationDuration + delayDuration;
      const fullCycle = cycleDuration * 2;
      const cycleTime = elapsedRef.current % fullCycle;

      if (cycleTime < animationDuration) {
        const percent = (cycleTime / animationDuration) * 100;
        progress.set(directionRef.current === 1 ? percent : 100 - percent);
        return;
      }

      if (cycleTime < cycleDuration) {
        progress.set(directionRef.current === 1 ? 100 : 0);
        return;
      }

      if (cycleTime < cycleDuration + animationDuration) {
        const reverseTime = cycleTime - cycleDuration;
        const percent = 100 - (reverseTime / animationDuration) * 100;
        progress.set(directionRef.current === 1 ? percent : 100 - percent);
        return;
      }

      progress.set(directionRef.current === 1 ? 0 : 100);
      return;
    }

    const cycleDuration = animationDuration + delayDuration;
    const cycleTime = elapsedRef.current % cycleDuration;

    if (cycleTime < animationDuration) {
      const percent = (cycleTime / animationDuration) * 100;
      progress.set(directionRef.current === 1 ? percent : 100 - percent);
      return;
    }

    progress.set(directionRef.current === 1 ? 100 : 0);
  });

  useEffect(() => {
    directionRef.current = direction === "left" ? 1 : -1;
    elapsedRef.current = 0;
    progress.set(0);
  }, [direction, progress]);

  const backgroundPosition = useTransform(progress, (percent) => `${150 - percent * 2}% center`);

  const handleMouseEnter = useCallback(() => {
    if (pauseOnHover) setIsPaused(true);
  }, [pauseOnHover]);

  const handleMouseLeave = useCallback(() => {
    if (pauseOnHover) setIsPaused(false);
  }, [pauseOnHover]);

  return (
    <motion.span
      className={`shiny-text ${className}`.trim()}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        backgroundClip: "text",
        backgroundImage: `linear-gradient(${spread}deg, ${color} 0%, ${color} 35%, ${shineColor} 50%, ${color} 65%, ${color} 100%)`,
        backgroundPosition,
        backgroundSize: "200% auto",
      }}
    >
      {text}
    </motion.span>
  );
}

function HomeTextType({ text }: HomeTextTypeProps) {
  const [displayText, setDisplayText] = useState("");

  useEffect(() => {
    let currentIndex = 0;
    let isDeleting = false;
    let timeoutId = 0;
    setDisplayText("");

    function tick() {
      const nextDelay = isDeleting ? 78 : 132;

      if (!isDeleting && currentIndex < text.length) {
        currentIndex += 1;
        setDisplayText(text.slice(0, currentIndex));
        timeoutId = window.setTimeout(tick, nextDelay);

        return;
      }

      if (!isDeleting && currentIndex >= text.length) {
        isDeleting = true;
        timeoutId = window.setTimeout(tick, 1800);

        return;
      }

      if (isDeleting && currentIndex > 0) {
        currentIndex -= 1;
        setDisplayText(text.slice(0, currentIndex));
        timeoutId = window.setTimeout(tick, nextDelay);

        return;
      }

      isDeleting = false;
      timeoutId = window.setTimeout(tick, 720);
    }

    timeoutId = window.setTimeout(tick, 480);

    return () => window.clearTimeout(timeoutId);
  }, [text]);

  return (
    <p aria-label={text} className="home-hero-type">
      <span>{displayText}</span>
      <span aria-hidden className="home-hero-type__cursor" />
    </p>
  );
}

function HomeHeroWaves() {
  return (
    <svg aria-hidden className="home-hero-waves" preserveAspectRatio="none" viewBox="0 24 150 28">
      <defs>
        <path
          d="M-160 44c30 0 58-18 88-18s58 18 88 18 58-18 88-18 58 18 88 18v44h-352z"
          id="home-hero-wave-path"
        />
      </defs>
      <g className="home-hero-waves__parallax">
        <use
          className="home-hero-waves__layer home-hero-waves__layer--one"
          href="#home-hero-wave-path"
          x="48"
          y="0"
        />
        <use
          className="home-hero-waves__layer home-hero-waves__layer--two"
          href="#home-hero-wave-path"
          x="48"
          y="3"
        />
        <use
          className="home-hero-waves__layer home-hero-waves__layer--three"
          href="#home-hero-wave-path"
          x="48"
          y="5"
        />
        <use
          className="home-hero-waves__layer home-hero-waves__layer--four"
          href="#home-hero-wave-path"
          x="48"
          y="7"
        />
      </g>
    </svg>
  );
}

type HomeArticleSectionProps = {
  articles: BlogArticle[];
  emptyText: string;
  fallbackCoverUrls: string[];
  icon: "bookmark" | "reader";
  section: "latest" | "pinned";
  title: string;
};

function HomeArticleSection({
  articles,
  emptyText,
  fallbackCoverUrls,
  icon,
  section,
  title,
}: HomeArticleSectionProps) {
  const fallbackCoverAssignments = useMemo(
    () =>
      createRandomCoverAssignments({
        coverUrls: fallbackCoverUrls,
        getKey: (article: BlogArticle) => article.slug,
        items: articles.filter((article) => !article.cover),
      }),
    [articles, fallbackCoverUrls],
  );

  return (
    <Card className={`home-doc-panel home-doc-panel--${section}`}>
      <div className="home-doc-panel__heading">
        <span>
          <AppIcon name={icon} />
          {title}
        </span>
        <Link to="/articles">全部文章</Link>
      </div>
      {articles.length > 0 ? (
        <div className="home-doc-list">
          {articles.map((article, index) => (
            <HomeArticleRow
              article={article}
              fallbackCoverUrl={fallbackCoverAssignments[article.slug]}
              index={index}
              key={article.slug}
              section={section}
            />
          ))}
        </div>
      ) : (
        <EmptyPlaceholder text={emptyText} />
      )}
    </Card>
  );
}

type HomeArticleRowProps = {
  article: BlogArticle;
  fallbackCoverUrl?: string;
  index: number;
  section: "latest" | "pinned";
};

function getHomeArticleRowClassName(
  article: BlogArticle,
  fallbackCoverUrl: string | undefined,
  index: number,
  section: "latest" | "pinned",
) {
  const classNames = ["home-article-row", `home-article-row--${section}`];

  if (index % 2 === 1) classNames.push("home-article-row--reverse");
  if (!article.cover) classNames.push("home-article-row--no-cover");
  if (!article.cover && fallbackCoverUrl) classNames.push("home-article-row--fallback-cover");

  return classNames.join(" ");
}

function HomeArticleRow({ article, fallbackCoverUrl, index, section }: HomeArticleRowProps) {
  const coverUrl = article.cover || fallbackCoverUrl;
  const excerpt = getArticleExcerpt(article);
  const isFallbackCover = !article.cover && Boolean(fallbackCoverUrl);

  return (
    <Link
      className={getHomeArticleRowClassName(article, fallbackCoverUrl, index, section)}
      to={`/articles/${article.slug}`}
    >
      {coverUrl ? (
        <span
          className={`home-article-row__media${
            isFallbackCover ? " home-article-row__media--fallback" : ""
          }`}
        >
          <img alt={article.cover ? article.title : ""} src={coverUrl} />
        </span>
      ) : null}
      <span className="home-article-row__body">
        <span className="home-article-row__meta">
          <span className="home-article-row__meta-item">
            <AppIcon name={article.isPinned ? "bookmark" : "folderOpen"} size={14} />
            {article.isPinned ? "置顶" : article.category}
          </span>
          <span className="home-article-row__meta-item">
            <AppIcon name="calendar" size={14} />
            {article.date}
          </span>
          <span className="home-article-row__meta-item">
            <AppIcon name="reader" size={14} />
            {article.readTime}
          </span>
        </span>
        <span className="home-article-row__title">{article.title}</span>
        <span className="home-article-row__excerpt">{excerpt}</span>
        <span className="home-article-row__footer">
          <span className="home-article-row__stats">
            <span>
              <AppIcon name="eye" size={14} />
              {article.readCount}
            </span>
            <span>
              <AppIcon name="chatbubbles" size={14} />
              {article.commentCount}
            </span>
          </span>
          <span className="home-article-row__read">阅读全文 &gt;</span>
        </span>
      </span>
    </Link>
  );
}

type HomeAuthorCardProps = {
  author: PublicSiteAuthor | null;
  siteInfo: PublicSiteInfo | null;
};

function HomeAuthorCard({ author, siteInfo }: HomeAuthorCardProps) {
  const authorName = getAuthorName(author, siteInfo);
  const description =
    author?.description || siteInfo?.description || "作者资料尚未配置，首页会在配置后自动展示。";
  const socialLinks = Object.entries(author?.socialLinks ?? {});
  const blogUrl = author?.blogUrl;

  return (
    <Card className="home-side-card home-author-card">
      <Avatar className="home-author-card__avatar">
        {author?.avatarUrl ? <Avatar.Image src={author.avatarUrl} /> : null}
        <Avatar.Fallback>{getAuthorFallback(authorName)}</Avatar.Fallback>
      </Avatar>
      <div className="home-author-card__body">
        <h2>{authorName}</h2>
        <p>{description}</p>
      </div>
      {author?.tags && author.tags.length > 0 ? (
        <div className="home-author-card__tags">
          {author.tags.map((tag) => (
            <Chip key={tag} size="sm" variant="soft">
              <Chip.Label>{tag}</Chip.Label>
            </Chip>
          ))}
        </div>
      ) : null}
      {socialLinks.length > 0 || blogUrl ? (
        <div className="home-author-card__links">
          {blogUrl ? (
            <a href={blogUrl} rel="noreferrer" target="_blank">
              <AppIcon name="globe" size={18} />
              <span>博客</span>
            </a>
          ) : null}
          {socialLinks.map(([key, href]) => (
            <a href={href} key={key} rel="noreferrer" target="_blank">
              <AppIcon name={key.toLowerCase().includes("mail") ? "mail" : "link"} size={18} />
              <span>{getSocialLabel(key)}</span>
            </a>
          ))}
        </div>
      ) : null}
    </Card>
  );
}

type HomeCategoryCardProps = {
  categories: BlogCategory[];
};

function HomeCategoryCard({ categories }: HomeCategoryCardProps) {
  return (
    <Card className="home-side-card">
      <div className="home-side-card__heading">
        <AppIcon name="grid" />
        <h2>分类</h2>
      </div>
      {categories.length > 0 ? (
        <div className="home-side-list">
          {categories.map((category) => (
            <Link
              key={category.slug}
              to={`/categories?category=${encodeURIComponent(category.slug)}`}
            >
              <span>
                <AppIcon name={category.icon} size={16} />
                {category.name}
              </span>
              <strong>{category.count}</strong>
            </Link>
          ))}
        </div>
      ) : (
        <p className="home-side-empty">暂无分类。</p>
      )}
    </Card>
  );
}

type HomeTagCardProps = {
  tags: BlogTag[];
};

function HomeTagCard({ tags }: HomeTagCardProps) {
  return (
    <Card className="home-side-card">
      <div className="home-side-card__heading">
        <AppIcon name="pricetags" />
        <h2>标签</h2>
      </div>
      {tags.length > 0 ? (
        <div className="home-tag-cloud">
          {tags.map((tag) => (
            <Link key={tag.slug} to={`/tags/${encodeURIComponent(tag.slug)}`}>
              #{tag.name}
              <span>{tag.count}</span>
            </Link>
          ))}
        </div>
      ) : (
        <p className="home-side-empty">暂无标签。</p>
      )}
    </Card>
  );
}
