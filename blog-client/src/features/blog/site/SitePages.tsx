import type { CSSProperties, ReactNode } from "react";

import { Card } from "@heroui/react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import type { AppIconName } from "../../../shared/icons";
import { AppIcon } from "../../../shared/icons";
import type { PublicSiteInfo } from "../../../shared/site/site-info";
import { fetchPublicSiteInfo } from "../../../shared/site/site-info";
import { BlogPageHeader } from "../shared/BlogComponents";
import { CommentThread } from "../shared/CommentThread";
import type { BlogArticle } from "../shared/blogApi";
import { deriveBlogCategories, deriveBlogTags, fetchPublicArticles } from "../shared/blogApi";

type AboutSiteHeroStyle = CSSProperties & {
  "--articles-index-cover"?: string;
};

type AboutSiteCardItem = {
  description: string;
  icon: AppIconName;
  title: string;
};

type AboutSiteInfoItem = {
  href?: string;
  icon: AppIconName;
  label: string;
  value: string;
};

const defaultSiteInfo = {
  description: "记录技术实践、产品体验和长期写作的个人博客。",
  establishedYear: "2024 年",
  siteName: "LeiBlog",
};

const featureItems: AboutSiteCardItem[] = [
  {
    description: "围绕文章、归档、分类和标签组织内容，减少来回跳转。",
    icon: "sparkles",
    title: "清晰索引",
  },
  {
    description: "阅读页、列表页和专题页保持一致节奏，优先服务正文内容。",
    icon: "reader",
    title: "沉浸阅读",
  },
  {
    description: "宽屏与移动端使用同一套内容层级，保证浏览路径稳定。",
    icon: "desktop",
    title: "响应式界面",
  },
  {
    description: "分类承载主题方向，标签补充细粒度线索，便于回看。",
    icon: "folderOpen",
    title: "内容归类",
  },
  {
    description: "后台管理文章、媒体、评论和站点设置，支撑持续维护。",
    icon: "settings",
    title: "后台管理",
  },
  {
    description: "以低噪声节奏整理技术实践，把有价值的内容写完整。",
    icon: "calendar",
    title: "持续更新",
  },
];

const technologyItems: AboutSiteCardItem[] = [
  {
    description: "负责公开博客和后台管理界面的交互层。",
    icon: "codeSlash",
    title: "React 19",
  },
  {
    description: "为前后端数据结构和组件接口提供类型约束。",
    icon: "terminal",
    title: "TypeScript",
  },
  {
    description: "统一开发、测试、检查和构建入口。",
    icon: "refresh",
    title: "Vite Plus",
  },
  {
    description: "提供可访问的基础组件和一致的界面组合方式。",
    icon: "colorPalette",
    title: "HeroUI v3",
  },
  {
    description: "让文章内容保留 Markdown 书写体验和组件扩展能力。",
    icon: "documentText",
    title: "MDX",
  },
  {
    description: "支撑后端接口、认证、文章和评论等核心数据流。",
    icon: "server",
    title: "Bun + Elysia",
  },
];

function AboutSiteHeroWaves() {
  return (
    <svg
      aria-hidden
      className="articles-index-hero__waves about-site-hero__waves"
      preserveAspectRatio="none"
      viewBox="0 24 150 28"
    >
      <defs>
        <path
          d="M-160 44c30 0 58-18 88-18s58 18 88 18 58-18 88-18 58 18 88 18v44h-352z"
          id="about-site-hero-wave-path"
        />
      </defs>
      <g className="articles-index-hero__waves-parallax">
        <use
          className="articles-index-hero__wave articles-index-hero__wave--one"
          href="#about-site-hero-wave-path"
          x="48"
          y="0"
        />
        <use
          className="articles-index-hero__wave articles-index-hero__wave--two"
          href="#about-site-hero-wave-path"
          x="48"
          y="3"
        />
        <use
          className="articles-index-hero__wave articles-index-hero__wave--three"
          href="#about-site-hero-wave-path"
          x="48"
          y="5"
        />
        <use
          className="articles-index-hero__wave articles-index-hero__wave--four"
          href="#about-site-hero-wave-path"
          x="48"
          y="7"
        />
      </g>
    </svg>
  );
}

function getAboutSiteHeroStyle(siteInfo: PublicSiteInfo | null): AboutSiteHeroStyle | undefined {
  const coverUrl = siteInfo?.homeCoverUrl?.trim();

  if (!coverUrl) return undefined;

  return {
    "--articles-index-cover": `url("${coverUrl.replace(/"/g, '\\"')}")`,
  };
}

function formatEstablishedYear(value: string | undefined) {
  if (!value) return defaultSiteInfo.establishedYear;

  const year = new Date(value).getFullYear();
  return Number.isNaN(year) ? defaultSiteInfo.establishedYear : `${year} 年`;
}

function formatStatValue(value: number, unit: string, status: "error" | "idle" | "loading") {
  if (status === "loading") return "读取中";
  if (status === "error" && value === 0) return "暂不可用";
  return `${value} ${unit}`;
}

function getCurrentSiteUrl() {
  const origin = globalThis.location?.origin?.trim();

  return origin && origin !== "null" ? origin : "";
}

function AboutSiteSection({
  children,
  icon,
  title,
}: {
  children: ReactNode;
  icon: AppIconName;
  title: string;
}) {
  return (
    <section className="about-site-section" aria-labelledby={`about-site-${title}`}>
      <div className="about-site-section__heading">
        <AppIcon name={icon} size={24} />
        <h2 id={`about-site-${title}`}>{title}</h2>
      </div>
      {children}
    </section>
  );
}

function AboutSiteFeatureCard({ item }: { item: AboutSiteCardItem }) {
  return (
    <Card className="about-site-feature-card">
      <AppIcon name={item.icon} size={34} />
      <Card.Header>
        <Card.Title>{item.title}</Card.Title>
        <Card.Description>{item.description}</Card.Description>
      </Card.Header>
    </Card>
  );
}

function AboutSiteTechnologyCard({ item }: { item: AboutSiteCardItem }) {
  return (
    <Card className="about-site-technology-card">
      <span className="about-site-technology-card__icon">
        <AppIcon name={item.icon} size={24} />
      </span>
      <Card.Header>
        <Card.Title>{item.title}</Card.Title>
        <Card.Description>{item.description}</Card.Description>
      </Card.Header>
    </Card>
  );
}

function AboutSiteInfoCard({ item }: { item: AboutSiteInfoItem }) {
  const value = item.href ? (
    <a href={item.href} rel="noreferrer" target="_blank">
      {item.value}
    </a>
  ) : (
    item.value
  );

  return (
    <Card className="about-site-info-card">
      <span className="about-site-info-card__icon">
        <AppIcon name={item.icon} size={24} />
      </span>
      <Card.Header>
        <Card.Title>{item.label}</Card.Title>
        <Card.Description>{value}</Card.Description>
      </Card.Header>
    </Card>
  );
}

export function AboutSitePage() {
  const [articles, setArticles] = useState<BlogArticle[]>([]);
  const [siteInfo, setSiteInfo] = useState<PublicSiteInfo | null>(null);
  const [status, setStatus] = useState<"error" | "idle" | "loading">("loading");
  const categories = useMemo(() => deriveBlogCategories(articles), [articles]);
  const tags = useMemo(() => deriveBlogTags(articles), [articles]);
  const heroStyle = useMemo(() => getAboutSiteHeroStyle(siteInfo), [siteInfo]);
  const siteName = siteInfo?.siteName.trim() || defaultSiteInfo.siteName;
  const siteDescription = siteInfo?.description.trim() || defaultSiteInfo.description;
  const siteUrl = getCurrentSiteUrl();
  const infoItems: AboutSiteInfoItem[] = [
    {
      icon: "globe",
      label: "站点名称",
      value: siteName,
    },
    {
      icon: "documentText",
      label: "简介",
      value: siteDescription,
    },
    {
      icon: "reader",
      label: "文章总数",
      value: formatStatValue(articles.length, "篇", status),
    },
    {
      icon: "folderOpen",
      label: "分类总数",
      value: formatStatValue(categories.length, "个", status),
    },
    {
      icon: "pricetags",
      label: "标签总数",
      value: formatStatValue(tags.length, "个", status),
    },
    {
      icon: "calendar",
      label: "建立时间",
      value: formatEstablishedYear(siteInfo?.establishedAt),
    },
    {
      href: siteUrl || undefined,
      icon: "link",
      label: "网址",
      value: siteUrl || "当前访问地址",
    },
    {
      href: "https://creativecommons.org/licenses/by-nc-sa/4.0/deed.zh-hans",
      icon: "shield",
      label: "版权声明",
      value: "CC BY-NC-SA 4.0 协议",
    },
  ];

  useEffect(() => {
    let isActive = true;

    async function loadAboutSiteData() {
      setStatus("loading");
      const [articlesResult, siteInfoResult] = await Promise.allSettled([
        fetchPublicArticles({ pageSize: 100 }),
        fetchPublicSiteInfo(),
      ]);

      if (!isActive) return;

      if (articlesResult.status === "fulfilled") {
        setArticles(articlesResult.value);
      } else {
        setArticles([]);
      }

      if (siteInfoResult.status === "fulfilled") {
        setSiteInfo(siteInfoResult.value);
      } else {
        setSiteInfo(null);
      }

      setStatus(articlesResult.status === "rejected" ? "error" : "idle");
    }

    void loadAboutSiteData();

    return () => {
      isActive = false;
    };
  }, []);

  return (
    <section className="about-site-page">
      <header className="articles-index-hero about-site-hero" style={heroStyle}>
        <div className="articles-index-hero__content about-site-hero__content">
          <p className="eyebrow">站点</p>
          <h1>
            <AppIcon name="informationCircle" size="clamp(2.25rem, 5vw, 4.5rem)" />
            关于本站
          </h1>
          <p>{siteDescription}</p>
        </div>
        <AboutSiteHeroWaves />
      </header>

      <div className="about-site-content">
        <AboutSiteSection icon="sparkles" title="网站特色">
          <div className="about-site-feature-grid">
            {featureItems.map((item) => (
              <AboutSiteFeatureCard item={item} key={item.title} />
            ))}
          </div>
        </AboutSiteSection>

        <AboutSiteSection icon="construct" title="技术栈">
          <div className="about-site-technology-grid">
            {technologyItems.map((item) => (
              <AboutSiteTechnologyCard item={item} key={item.title} />
            ))}
          </div>
        </AboutSiteSection>

        <AboutSiteSection icon="statsChart" title="本站信息">
          <div className="about-site-info-grid">
            {infoItems.map((item) => (
              <AboutSiteInfoCard item={item} key={item.label} />
            ))}
          </div>
        </AboutSiteSection>

        <section className="about-site-contact" aria-labelledby="about-site-contact-title">
          <div className="about-site-contact__heading">
            <AppIcon name="chatbubbles" size={28} />
            <h2 id="about-site-contact-title">联系与反馈</h2>
          </div>
          <p>如果你有问题、建议，或者想交流技术话题，可以通过下面的入口继续浏览。</p>
          <div className="about-site-contact__actions">
            <Link className="front-action-link" to="/about-author">
              <AppIcon name="personCircle" size={18} />
              关于作者
            </Link>
            <Link className="front-action-link" to="/guestbook">
              <AppIcon name="chatbubbles" size={18} />
              留言板
            </Link>
          </div>
        </section>
      </div>
    </section>
  );
}

export function AboutAuthorPage() {
  return (
    <section className="front-stack about-author">
      <BlogPageHeader
        description="作者页先保留个人信息、标签和社交链接区域，后续和用户资料接口打通。"
        eyebrow="站点"
        icon="personCircle"
        title="关于作者"
      />
      <div className="author-panel">
        <img
          alt="作者工作桌面"
          src="https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1200&q=80"
        />
        <div>
          <p>
            我喜欢把复杂系统拆成能解释清楚的小块，也喜欢在夜晚出门拍一点城市光线。这个博客会慢慢变成工程和生活的交汇处。
          </p>
          <div className="front-tag-list">
            {["全栈", "写作", "摄影", "React", "Elysia"].map((tag) => (
              <span key={tag}>#{tag}</span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function GuestbookPage() {
  return (
    <section className="front-stack">
      <BlogPageHeader
        description="留言板复用评论系统，支持登录用户留言、回复和后台审核。"
        eyebrow="站点"
        icon="chatbubbles"
        title="留言板"
      />
      <CommentThread
        description="这里的数据目标类型是 guestbook，和文章评论分开筛选。"
        target="guestbook"
        title="站点留言"
      />
    </section>
  );
}
