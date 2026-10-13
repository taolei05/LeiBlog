import { useEffect, useMemo, useState } from "react";
import type { MouseEvent, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  AtSign,
  BookOpen,
  CalendarDays,
  Code2,
  Database,
  ExternalLink,
  FileText,
  FolderOpen,
  Globe2,
  Layers3,
  Library,
  Link as LinkIcon,
  Mail,
  MessageSquareText,
  MonitorCheck,
  Palette,
  PencilLine,
  Server,
  ShieldCheck,
  Sparkles,
  Tags,
  Terminal,
  UserRound,
  Wrench,
} from "lucide-react";

import { Avatar } from "@astryxdesign/core/Avatar";
import { Badge } from "@astryxdesign/core/Badge";
import { Card } from "@astryxdesign/core/Card";
import { Heading } from "@astryxdesign/core/Heading";
import { Text } from "@astryxdesign/core/Text";

import type { AdminSocialLink, PublicSiteSettings } from "../../../shared/admin-api";
import {
  getPublicArticleCategories,
  getPublicArticles,
  getPublicArticleTags,
} from "../../../shared/admin-api";
import type { AppLanguage } from "../../../shared/i18n";
import { formatDateInTimeZone } from "../../../shared/time-zone";
import { FrontPageHero } from "./FrontPageHero";
import {
  getSafeLinkUrl,
  resolveContentAssetUrl as resolveSiteAssetUrl,
} from "../../../shared/content-url";

type SitePageBrand = {
  readonly coverUrls: readonly string[];
  readonly description: string;
  readonly logoUrl: string;
  readonly name: string;
};

type SitePageAuthor = {
  readonly avatarUrl: string;
  readonly bio: string;
  readonly blogUrl: string;
  readonly name: string;
  readonly socialLinks: ReadonlyArray<AdminSocialLink>;
  readonly tags: readonly string[];
  readonly username: string;
};

type SitePageShellProps = {
  readonly coverUrls: readonly string[];
  readonly fallbackCoverUrl: string;
  readonly language: AppLanguage;
  readonly onNavigate: (path: string) => void;
  readonly siteAuthor: SitePageAuthor;
  readonly siteBrand: SitePageBrand;
  readonly siteSettings?: PublicSiteSettings;
  readonly timeZone: string;
};

type AboutCardItem = {
  readonly description: string;
  readonly icon: ReactNode;
  readonly title: string;
};

type AboutPageCopy = {
  readonly articleCountLabel: string;
  readonly authorActionsTitle: string;
  readonly authorBioFallback: string;
  readonly authorCtaDescription: string;
  readonly authorCtaEyebrow: string;
  readonly authorCtaTitle: string;
  readonly authorHeroDescription: string;
  readonly authorHeroEyebrow: string;
  readonly authorHeroTitle: string;
  readonly authorInfoTitle: string;
  readonly authorLinksTitle: string;
  readonly authorNameFallback: string;
  readonly authorStatsTitle: string;
  readonly categoryCountLabel: string;
  readonly categoryCount: (count: number) => string;
  readonly currentSite: string;
  readonly error: string;
  readonly filingEmpty: string;
  readonly foundedAtFallback: string;
  readonly loading: string;
  readonly navigationArticles: string;
  readonly navigationAuthor: string;
  readonly navigationGuestbook: string;
  readonly noPublicLinks: string;
  readonly profileLabel: string;
  readonly siteAuthorLabel: string;
  readonly siteContactDescription: string;
  readonly siteContactTitle: string;
  readonly siteCopyrightLabel: string;
  readonly siteDescriptionLabel: string;
  readonly siteFeatureTitle: string;
  readonly siteFoundedLabel: string;
  readonly siteHeroDescription: string;
  readonly siteHeroEyebrow: string;
  readonly siteHeroTitle: string;
  readonly siteInfoTitle: string;
  readonly siteNameLabel: string;
  readonly siteRecordsTitle: string;
  readonly siteTechnologyTitle: string;
  readonly siteUrlLabel: string;
  readonly tagCountLabel: string;
  readonly tagCount: (count: number) => string;
  readonly totalArticleCount: (count: number) => string;
  readonly latestArticleLabel: string;
};

type SitePublicMetricsStatus = "error" | "idle" | "loading";

type SitePublicMetrics = {
  readonly articleCount: number;
  readonly categoryCount: number;
  readonly latestArticleDate?: string;
  readonly status: SitePublicMetricsStatus;
  readonly tagCount: number;
};

const emptySitePublicMetrics: SitePublicMetrics = {
  articleCount: 0,
  categoryCount: 0,
  status: "loading",
  tagCount: 0,
};

const aboutPageCopyByLanguage: Record<AppLanguage, AboutPageCopy> = {
  "zh-CN": {
    articleCountLabel: "文章总数",
    authorActionsTitle: "公开入口",
    authorBioFallback: "写代码、做产品，也记录一些日常片段。",
    authorCtaDescription: "从文章继续了解具体实践，或者去留言板留下一段想法。",
    authorCtaEyebrow: "Next",
    authorCtaTitle: "继续探索",
    authorHeroDescription: "关于作者的公开资料、技术兴趣和常用联系方式。",
    authorHeroEyebrow: "作者",
    authorHeroTitle: "关于作者",
    authorInfoTitle: "作者资料",
    authorLinksTitle: "联系方式",
    authorNameFallback: "十七更好",
    authorStatsTitle: "内容概览",
    categoryCountLabel: "分类总数",
    categoryCount: (count) => `${count} 个分类`,
    currentSite: "当前访问地址",
    error: "暂未获取",
    filingEmpty: "暂无公开备案信息",
    foundedAtFallback: "暂未设置",
    loading: "同步中",
    navigationArticles: "浏览文章",
    navigationAuthor: "关于作者",
    navigationGuestbook: "留言板",
    noPublicLinks: "暂未公开联系方式",
    profileLabel: "公开资料",
    siteAuthorLabel: "站点作者",
    siteContactDescription:
      "如果你想继续了解内容、提出建议，或者只是留下一个想法，可以从这里进入。",
    siteContactTitle: "联系与反馈",
    siteCopyrightLabel: "版权说明",
    siteDescriptionLabel: "简介",
    siteFeatureTitle: "网站特色",
    siteFoundedLabel: "建立时间",
    siteHeroDescription: "记录这个站点的定位、内容结构、运行信息和维护方式。",
    siteHeroEyebrow: "站点",
    siteHeroTitle: "关于本站",
    siteInfoTitle: "本站信息",
    siteNameLabel: "站点名称",
    siteRecordsTitle: "备案与版权",
    siteTechnologyTitle: "技术栈",
    siteUrlLabel: "网址",
    tagCountLabel: "标签总数",
    tagCount: (count) => `${count} 个标签`,
    totalArticleCount: (count) => `${count} 篇文章`,
    latestArticleLabel: "最近更新",
  },
  en: {
    articleCountLabel: "Articles",
    authorActionsTitle: "Public entry points",
    authorBioFallback: "Writing code, shaping products, and keeping everyday notes.",
    authorCtaDescription: "Continue through the articles, or leave a message in the guestbook.",
    authorCtaEyebrow: "Next",
    authorCtaTitle: "Keep Exploring",
    authorHeroDescription: "Public profile, technical interests, and contact links for the author.",
    authorHeroEyebrow: "Author",
    authorHeroTitle: "About Author",
    authorInfoTitle: "Author Profile",
    authorLinksTitle: "Contact Links",
    authorNameFallback: "Seventeen Is Better",
    authorStatsTitle: "Content Overview",
    categoryCountLabel: "Categories",
    categoryCount: (count) => `${count} ${count === 1 ? "category" : "categories"}`,
    currentSite: "Current site",
    error: "Unavailable",
    filingEmpty: "No public filing records yet",
    foundedAtFallback: "Not set",
    loading: "Loading",
    navigationArticles: "Read Articles",
    navigationAuthor: "About Author",
    navigationGuestbook: "Guestbook",
    noPublicLinks: "No public contact links yet",
    profileLabel: "Public profile",
    siteAuthorLabel: "Author",
    siteContactDescription:
      "If you want to explore more, suggest an improvement, or leave a note, start here.",
    siteContactTitle: "Contact And Feedback",
    siteCopyrightLabel: "Copyright",
    siteDescriptionLabel: "Description",
    siteFeatureTitle: "Site Features",
    siteFoundedLabel: "Founded",
    siteHeroDescription: "Site purpose, content structure, runtime details, and maintenance notes.",
    siteHeroEyebrow: "Site",
    siteHeroTitle: "About Site",
    siteInfoTitle: "Site Information",
    siteNameLabel: "Site Name",
    siteRecordsTitle: "Records And License",
    siteTechnologyTitle: "Technology Stack",
    siteUrlLabel: "URL",
    tagCountLabel: "Tags",
    tagCount: (count) => `${count} ${count === 1 ? "tag" : "tags"}`,
    totalArticleCount: (count) => `${count} ${count === 1 ? "article" : "articles"}`,
    latestArticleLabel: "Latest Update",
  },
};

const siteFeatureItemsByLanguage: Record<AppLanguage, readonly AboutCardItem[]> = {
  "zh-CN": [
    {
      description: "把公开文章、分类、标签、归档和导航页放在读者能自然抵达的位置。",
      icon: <BookOpen aria-hidden="true" size={26} />,
      title: "阅读路径清晰",
    },
    {
      description: "站点资料、作者资料、媒体资源和评论都能在后台维护，前台实时读取。",
      icon: <MonitorCheck aria-hidden="true" size={26} />,
      title: "后台自维护",
    },
    {
      description: "中英文内容一并保存，前台跟随语言切换展示对应字段。",
      icon: <Globe2 aria-hidden="true" size={26} />,
      title: "双语内容",
    },
    {
      description: "文章正文、评论图片和媒体库资源都沿用统一的本地/远端资源入口。",
      icon: <FolderOpen aria-hidden="true" size={26} />,
      title: "媒体管理",
    },
    {
      description: "评论区、留言板和个人资料都接入真实账号状态。",
      icon: <MessageSquareText aria-hidden="true" size={26} />,
      title: "真实互动",
    },
    {
      description: "以小步更新的方式继续打磨内容组织、编辑体验和前台阅读细节。",
      icon: <Sparkles aria-hidden="true" size={26} />,
      title: "持续演进",
    },
  ],
  en: [
    {
      description: "Articles, categories, tags, archives, and navigation stay easy to reach.",
      icon: <BookOpen aria-hidden="true" size={26} />,
      title: "Clear Reading Paths",
    },
    {
      description:
        "Site profile, author profile, media, and comments are maintained from the console.",
      icon: <MonitorCheck aria-hidden="true" size={26} />,
      title: "Admin Maintained",
    },
    {
      description:
        "Chinese and English content are stored together and rendered by the active language.",
      icon: <Globe2 aria-hidden="true" size={26} />,
      title: "Bilingual Content",
    },
    {
      description:
        "Article content, comment images, and media assets share the same asset pipeline.",
      icon: <FolderOpen aria-hidden="true" size={26} />,
      title: "Media Workflow",
    },
    {
      description:
        "Comments, guestbook messages, and profiles are connected to real account state.",
      icon: <MessageSquareText aria-hidden="true" size={26} />,
      title: "Real Interaction",
    },
    {
      description:
        "The site keeps improving through small updates to writing, editing, and reading details.",
      icon: <Sparkles aria-hidden="true" size={26} />,
      title: "Continuous Care",
    },
  ],
};

const siteTechnologyItemsByLanguage: Record<AppLanguage, readonly AboutCardItem[]> = {
  "zh-CN": [
    {
      description: "用于构建前台页面、交互状态和后台管理界面。",
      icon: <Code2 aria-hidden="true" size={22} />,
      title: "React 19",
    },
    {
      description: "保证前后台数据结构、表单状态和 API 调用都有类型约束。",
      icon: <Terminal aria-hidden="true" size={22} />,
      title: "TypeScript",
    },
    {
      description: "承担开发服务器、脚本执行和前后端工作区依赖管理。",
      icon: <Wrench aria-hidden="true" size={22} />,
      title: "Bun",
    },
    {
      description: "支撑文章正文中的扩展块、代码片段和阅读组件。",
      icon: <FileText aria-hidden="true" size={22} />,
      title: "MDX",
    },
    {
      description: "提供前台和后台一致的基础控件、弹窗、导航和表单体验。",
      icon: <Palette aria-hidden="true" size={22} />,
      title: "Astryx Design",
    },
    {
      description: "后端接口、内容模型和持久化数据共同支撑真实站点行为。",
      icon: <Server aria-hidden="true" size={22} />,
      title: "ElysiaJS + PostgreSQL",
    },
  ],
  en: [
    {
      description: "Powers public pages, interaction state, and the admin console.",
      icon: <Code2 aria-hidden="true" size={22} />,
      title: "React 19",
    },
    {
      description: "Keeps frontend data, form state, and API calls typed.",
      icon: <Terminal aria-hidden="true" size={22} />,
      title: "TypeScript",
    },
    {
      description: "Runs development scripts, servers, and workspace dependency flows.",
      icon: <Wrench aria-hidden="true" size={22} />,
      title: "Bun",
    },
    {
      description: "Supports rich article blocks, code snippets, and reading components.",
      icon: <FileText aria-hidden="true" size={22} />,
      title: "MDX",
    },
    {
      description: "Provides shared controls for dialogs, navigation, forms, and layouts.",
      icon: <Palette aria-hidden="true" size={22} />,
      title: "Astryx Design",
    },
    {
      description: "Back-end APIs, content models, and persistence support real site behavior.",
      icon: <Server aria-hidden="true" size={22} />,
      title: "ElysiaJS + PostgreSQL",
    },
  ],
};

const authorFocusItemsByLanguage: Record<AppLanguage, readonly AboutCardItem[]> = {
  "zh-CN": [
    {
      description: "关注阅读页面、移动端导航、媒体预览和小交互的完成度。",
      icon: <MonitorCheck aria-hidden="true" size={22} />,
      title: "前台体验",
    },
    {
      description: "把文章编辑、媒体管理、评论和站点设置做成能反复使用的工具。",
      icon: <Wrench aria-hidden="true" size={22} />,
      title: "内容工具",
    },
    {
      description: "从数据模型、API 到页面状态，尽量让功能真实闭环。",
      icon: <Database aria-hidden="true" size={22} />,
      title: "后台系统",
    },
    {
      description: "把实现过程、踩坑记录和产品想法沉淀成可回看的文章。",
      icon: <PencilLine aria-hidden="true" size={22} />,
      title: "工程记录",
    },
  ],
  en: [
    {
      description: "Reading pages, mobile navigation, media previews, and small interactions.",
      icon: <MonitorCheck aria-hidden="true" size={22} />,
      title: "Frontend Experience",
    },
    {
      description: "Reusable tools for article editing, media, comments, and site settings.",
      icon: <Wrench aria-hidden="true" size={22} />,
      title: "Content Tools",
    },
    {
      description: "Data models, APIs, and UI state that close the loop with real behavior.",
      icon: <Database aria-hidden="true" size={22} />,
      title: "Admin Systems",
    },
    {
      description: "Implementation notes, hard-won details, and product ideas worth revisiting.",
      icon: <PencilLine aria-hidden="true" size={22} />,
      title: "Engineering Notes",
    },
  ],
};

const authorToolItemsByLanguage: Record<AppLanguage, readonly AboutCardItem[]> = {
  "zh-CN": [
    {
      description: "组合页面、状态和可复用组件。",
      icon: <Code2 aria-hidden="true" size={22} />,
      title: "React",
    },
    {
      description: "让数据结构和交互状态更明确。",
      icon: <Terminal aria-hidden="true" size={22} />,
      title: "TypeScript",
    },
    {
      description: "用于快速开发、构建和运行脚本。",
      icon: <Wrench aria-hidden="true" size={22} />,
      title: "Bun",
    },
    {
      description: "让文章可以承载更丰富的展示块。",
      icon: <FileText aria-hidden="true" size={22} />,
      title: "MDX",
    },
    {
      description: "保持控件和交互细节一致。",
      icon: <Palette aria-hidden="true" size={22} />,
      title: "Astryx",
    },
    {
      description: "承载前后台真实数据接口。",
      icon: <Server aria-hidden="true" size={22} />,
      title: "Elysia",
    },
  ],
  en: [
    {
      description: "Composes pages, state, and reusable components.",
      icon: <Code2 aria-hidden="true" size={22} />,
      title: "React",
    },
    {
      description: "Keeps data shapes and interaction states explicit.",
      icon: <Terminal aria-hidden="true" size={22} />,
      title: "TypeScript",
    },
    {
      description: "Runs development, builds, and local scripts quickly.",
      icon: <Wrench aria-hidden="true" size={22} />,
      title: "Bun",
    },
    {
      description: "Lets articles carry richer custom content blocks.",
      icon: <FileText aria-hidden="true" size={22} />,
      title: "MDX",
    },
    {
      description: "Keeps controls and interaction details consistent.",
      icon: <Palette aria-hidden="true" size={22} />,
      title: "Astryx",
    },
    {
      description: "Serves real data contracts for the public and admin apps.",
      icon: <Server aria-hidden="true" size={22} />,
      title: "Elysia",
    },
  ],
};

const getCurrentSiteUrl = () => {
  if (typeof window === "undefined") {
    return "";
  }

  return window.location.origin;
};

const getNonEmptyText = (value?: string) => {
  const trimmedValue = value?.trim();
  return trimmedValue && trimmedValue.length > 0 ? trimmedValue : undefined;
};

const isModifiedClick = (event: MouseEvent<HTMLAnchorElement>) =>
  event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0;

const useSitePublicMetrics = () => {
  const [metrics, setMetrics] = useState<SitePublicMetrics>(emptySitePublicMetrics);

  useEffect(() => {
    let isMounted = true;

    const loadMetrics = async () => {
      setMetrics(emptySitePublicMetrics);
      const [articlesResult, categoriesResult, tagsResult] = await Promise.allSettled([
        getPublicArticles({
          page: 1,
          pageSize: 1,
          query: "",
          sortBy: "publishedAt",
          sortOrder: "desc",
        }),
        getPublicArticleCategories(),
        getPublicArticleTags(),
      ]);

      if (!isMounted) {
        return;
      }

      const latestArticle =
        articlesResult.status === "fulfilled" ? articlesResult.value.items[0] : undefined;

      setMetrics({
        articleCount:
          articlesResult.status === "fulfilled" ? articlesResult.value.pageInfo.totalItems : 0,
        categoryCount:
          categoriesResult.status === "fulfilled" ? categoriesResult.value.pageInfo.totalItems : 0,
        latestArticleDate: latestArticle?.publishedAt ?? latestArticle?.createdAt,
        status:
          articlesResult.status === "rejected" ||
          categoriesResult.status === "rejected" ||
          tagsResult.status === "rejected"
            ? "error"
            : "idle",
        tagCount: tagsResult.status === "fulfilled" ? tagsResult.value.pageInfo.totalItems : 0,
      });
    };

    void loadMetrics();

    return () => {
      isMounted = false;
    };
  }, []);

  return metrics;
};

type FormatMetricValueParameters = {
  readonly copy: AboutPageCopy;
  readonly formatter: (count: number) => string;
  readonly status: SitePublicMetricsStatus;
  readonly value: number;
};

const formatMetricValue = ({ copy, formatter, status, value }: FormatMetricValueParameters) => {
  if (status === "loading") {
    return copy.loading;
  }

  if (status === "error" && value === 0) {
    return copy.error;
  }

  return formatter(value);
};

type FormatDateValueParameters = {
  readonly copy: AboutPageCopy;
  readonly language: AppLanguage;
  readonly timeZone: string;
  readonly value?: string;
};

const formatDateValue = ({ copy, language, timeZone, value }: FormatDateValueParameters) => {
  const dateValue = getNonEmptyText(value);
  if (dateValue === undefined) {
    return copy.foundedAtFallback;
  }

  return formatDateInTimeZone({ language, timeZone, value: dateValue }) ?? copy.foundedAtFallback;
};

type FormatMetricDateValueParameters = FormatDateValueParameters & {
  readonly status: SitePublicMetricsStatus;
};

const formatMetricDateValue = ({
  copy,
  language,
  status,
  timeZone,
  value,
}: FormatMetricDateValueParameters) => {
  if (status === "loading") {
    return copy.loading;
  }

  if (status === "error" && getNonEmptyText(value) === undefined) {
    return copy.error;
  }

  return formatDateValue({ copy, language, timeZone, value });
};

const getFilingItems = (settings?: PublicSiteSettings) => {
  const icpItems =
    settings?.filings.icpRecords
      .map((record) => ({
        key: `icp-${record.number}`,
        number: record.number.trim(),
        url: getNonEmptyText(record.url),
      }))
      .filter((record) => record.number.length > 0) ?? [];
  const policeNumber = getNonEmptyText(settings?.filings.policeRecordNumber);

  if (policeNumber === undefined) {
    return icpItems;
  }

  return [
    ...icpItems,
    {
      key: `police-${policeNumber}`,
      number: policeNumber,
      url: getNonEmptyText(settings?.filings.policeRecordUrl),
    },
  ];
};

type GetSocialIconParameters = {
  readonly label: string;
  readonly url: string;
};

const getSocialIcon = ({ label, url }: GetSocialIconParameters): LucideIcon => {
  const normalizedLabel = label.toLowerCase();
  const normalizedUrl = url.toLowerCase();

  if (normalizedUrl.startsWith("mailto:") || normalizedLabel.includes("mail")) {
    return Mail;
  }

  if (normalizedLabel.includes("github") || normalizedUrl.includes("github.com")) {
    return Code2;
  }

  if (normalizedLabel.includes("blog")) {
    return BookOpen;
  }

  if (normalizedLabel.includes("x") || normalizedLabel.includes("twitter")) {
    return AtSign;
  }

  return LinkIcon;
};

type SiteActionLinkProps = {
  readonly external?: boolean;
  readonly href: string;
  readonly icon: ReactNode;
  readonly label: string;
  readonly onNavigate?: (path: string) => void;
};

function SiteActionLink({ external = false, href, icon, label, onNavigate }: SiteActionLinkProps) {
  return (
    <a
      className="about-action-link"
      href={getSafeLinkUrl(href)}
      onClick={
        onNavigate === undefined
          ? undefined
          : (event) => {
              if (isModifiedClick(event)) {
                return;
              }

              event.preventDefault();
              onNavigate(href);
            }
      }
      rel={external ? "noreferrer" : undefined}
      target={external ? "_blank" : undefined}
    >
      {icon}
      {label}
      {external ? (
        <ExternalLink aria-hidden="true" size={15} />
      ) : (
        <ArrowRight aria-hidden="true" size={15} />
      )}
    </a>
  );
}

type AboutSectionProps = {
  readonly children: ReactNode;
  readonly icon: ReactNode;
  readonly title: string;
};

function AboutSection({ children, icon, title }: AboutSectionProps) {
  return (
    <section className="about-section" aria-labelledby={`about-section-${title}`}>
      <div className="about-section__heading">
        {icon}
        <Heading id={`about-section-${title}`} level={2}>
          {title}
        </Heading>
      </div>
      {children}
    </section>
  );
}

type AboutFeatureCardProps = {
  readonly item: AboutCardItem;
};

function AboutFeatureCard({ item }: AboutFeatureCardProps) {
  return (
    <Card className="about-feature-card" padding={4}>
      <span className="about-feature-card__icon">{item.icon}</span>
      <div className="about-feature-card__body">
        <Heading level={3}>{item.title}</Heading>
        <Text as="p" color="secondary" type="supporting">
          {item.description}
        </Text>
      </div>
    </Card>
  );
}

type AboutInfoCardProps = {
  readonly icon: ReactNode;
  readonly label: string;
  readonly value: ReactNode;
};

function AboutInfoCard({ icon, label, value }: AboutInfoCardProps) {
  return (
    <Card className="about-info-card" padding={4}>
      <span className="about-info-card__icon">{icon}</span>
      <div className="about-info-card__body">
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </Card>
  );
}

type AboutStatProps = {
  readonly label: string;
  readonly value: string;
};

function AboutStat({ label, value }: AboutStatProps) {
  return (
    <div className="about-author-stat">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

type AboutSitePageProps = SitePageShellProps;

export function AboutSitePage({
  coverUrls,
  fallbackCoverUrl,
  language,
  onNavigate,
  siteAuthor,
  siteBrand,
  siteSettings,
  timeZone,
}: AboutSitePageProps) {
  const copy = aboutPageCopyByLanguage[language];
  const metrics = useSitePublicMetrics();
  const siteUrl = useMemo(getCurrentSiteUrl, []);
  const filingItems = getFilingItems(siteSettings);
  const siteName = getNonEmptyText(siteBrand.name) ?? "LeiBlog";
  const siteDescription = getNonEmptyText(siteBrand.description) ?? copy.siteHeroDescription;
  const authorName = getNonEmptyText(siteAuthor.name) ?? copy.authorNameFallback;
  const copyright = getNonEmptyText(siteSettings?.basics.copyright) ?? "CC BY-NC-SA 4.0";
  const foundedAt = formatDateValue({
    copy,
    language,
    timeZone,
    value: siteSettings?.site.foundedAt,
  });
  const latestArticleDate = formatMetricDateValue({
    copy,
    language,
    status: metrics.status,
    timeZone,
    value: metrics.latestArticleDate,
  });
  const infoItems = [
    {
      icon: <Library aria-hidden="true" size={22} />,
      label: copy.siteNameLabel,
      value: siteName,
    },
    {
      icon: <UserRound aria-hidden="true" size={22} />,
      label: copy.siteAuthorLabel,
      value: authorName,
    },
    {
      icon: <FileText aria-hidden="true" size={22} />,
      label: copy.siteDescriptionLabel,
      value: siteDescription,
    },
    {
      icon: <BookOpen aria-hidden="true" size={22} />,
      label: copy.articleCountLabel,
      value: formatMetricValue({
        copy,
        formatter: copy.totalArticleCount,
        status: metrics.status,
        value: metrics.articleCount,
      }),
    },
    {
      icon: <FolderOpen aria-hidden="true" size={22} />,
      label: copy.categoryCountLabel,
      value: formatMetricValue({
        copy,
        formatter: copy.categoryCount,
        status: metrics.status,
        value: metrics.categoryCount,
      }),
    },
    {
      icon: <Tags aria-hidden="true" size={22} />,
      label: copy.tagCountLabel,
      value: formatMetricValue({
        copy,
        formatter: copy.tagCount,
        status: metrics.status,
        value: metrics.tagCount,
      }),
    },
    {
      icon: <CalendarDays aria-hidden="true" size={22} />,
      label: copy.siteFoundedLabel,
      value: foundedAt,
    },
    {
      icon: <Sparkles aria-hidden="true" size={22} />,
      label: copy.latestArticleLabel,
      value: latestArticleDate,
    },
    {
      icon: <Globe2 aria-hidden="true" size={22} />,
      label: copy.siteUrlLabel,
      value:
        siteUrl.length > 0 ? (
          <a href={siteUrl} rel="noreferrer" target="_blank">
            {siteUrl}
          </a>
        ) : (
          copy.currentSite
        ),
    },
  ] as const;

  return (
    <main className="page-shell page-shell--with-front-hero about-site-page">
      <FrontPageHero
        coverUrls={coverUrls}
        description={siteDescription}
        eyebrow={copy.siteHeroEyebrow}
        fallbackCoverUrl={fallbackCoverUrl}
        icon={Library}
        title={copy.siteHeroTitle}
      />
      <section className="about-page-body">
        <section className="about-site-summary" aria-labelledby="about-site-summary-title">
          <div className="about-site-summary__brand">
            <span className="about-site-summary__logo">
              {siteBrand.logoUrl.length > 0 ? (
                <img alt={siteName} src={resolveSiteAssetUrl(siteBrand.logoUrl)} />
              ) : (
                <Library aria-hidden="true" size={44} />
              )}
            </span>
            <div>
              <Badge label={copy.siteHeroEyebrow} variant="neutral" />
              <Heading id="about-site-summary-title" level={2}>
                {siteName}
              </Heading>
              <Text as="p" color="secondary">
                {siteDescription}
              </Text>
            </div>
          </div>
          <div className="about-site-summary__actions">
            <SiteActionLink
              href="/about-author"
              icon={<UserRound aria-hidden="true" size={17} />}
              label={copy.navigationAuthor}
              onNavigate={onNavigate}
            />
            <SiteActionLink
              href="/guestbook"
              icon={<MessageSquareText aria-hidden="true" size={17} />}
              label={copy.navigationGuestbook}
              onNavigate={onNavigate}
            />
          </div>
        </section>

        <AboutSection
          icon={<Sparkles aria-hidden="true" size={22} />}
          title={copy.siteFeatureTitle}
        >
          <div className="about-feature-grid">
            {siteFeatureItemsByLanguage[language].map((item) => (
              <AboutFeatureCard item={item} key={item.title} />
            ))}
          </div>
        </AboutSection>

        <AboutSection
          icon={<Layers3 aria-hidden="true" size={22} />}
          title={copy.siteTechnologyTitle}
        >
          <div className="about-technology-grid">
            {siteTechnologyItemsByLanguage[language].map((item) => (
              <AboutFeatureCard item={item} key={item.title} />
            ))}
          </div>
        </AboutSection>

        <AboutSection icon={<Globe2 aria-hidden="true" size={22} />} title={copy.siteInfoTitle}>
          <div className="about-info-grid">
            {infoItems.map((item) => (
              <AboutInfoCard
                icon={item.icon}
                key={item.label}
                label={item.label}
                value={item.value}
              />
            ))}
          </div>
        </AboutSection>

        <section className="about-records" aria-labelledby="about-site-records-title">
          <div className="about-records__heading">
            <ShieldCheck aria-hidden="true" size={22} />
            <Heading id="about-site-records-title" level={2}>
              {copy.siteRecordsTitle}
            </Heading>
          </div>
          <div className="about-records__content">
            <AboutInfoCard
              icon={<ShieldCheck aria-hidden="true" size={22} />}
              label={copy.siteCopyrightLabel}
              value={copyright}
            />
            <Card className="about-filing-card" padding={4}>
              {filingItems.length > 0 ? (
                filingItems.map((item) =>
                  item.url === undefined ? (
                    <span key={item.key}>{item.number}</span>
                  ) : (
                    <a
                      href={getSafeLinkUrl(item.url)}
                      key={item.key}
                      rel="noreferrer"
                      target="_blank"
                    >
                      {item.number}
                    </a>
                  ),
                )
              ) : (
                <span>{copy.filingEmpty}</span>
              )}
            </Card>
          </div>
        </section>

        <section className="about-next-panel" aria-labelledby="about-site-contact-title">
          <div>
            <Text as="p" className="about-next-panel__eyebrow">
              {copy.siteHeroEyebrow}
            </Text>
            <Heading id="about-site-contact-title" level={2}>
              {copy.siteContactTitle}
            </Heading>
            <Text as="p" color="secondary">
              {copy.siteContactDescription}
            </Text>
          </div>
          <div className="about-next-panel__actions">
            <SiteActionLink
              href="/articles"
              icon={<BookOpen aria-hidden="true" size={17} />}
              label={copy.navigationArticles}
              onNavigate={onNavigate}
            />
            <SiteActionLink
              href="/guestbook"
              icon={<MessageSquareText aria-hidden="true" size={17} />}
              label={copy.navigationGuestbook}
              onNavigate={onNavigate}
            />
          </div>
        </section>
      </section>
    </main>
  );
}

type AboutAuthorPageProps = SitePageShellProps;

export function AboutAuthorPage({
  coverUrls,
  fallbackCoverUrl,
  language,
  onNavigate,
  siteAuthor,
  siteBrand,
  timeZone,
}: AboutAuthorPageProps) {
  const copy = aboutPageCopyByLanguage[language];
  const metrics = useSitePublicMetrics();
  const authorName = getNonEmptyText(siteAuthor.name) ?? copy.authorNameFallback;
  const authorBio = getNonEmptyText(siteAuthor.bio) ?? copy.authorBioFallback;
  const username = getNonEmptyText(siteAuthor.username);
  const avatarUrl = getNonEmptyText(siteAuthor.avatarUrl);
  const blogUrl = getNonEmptyText(siteAuthor.blogUrl);
  const authorTags = siteAuthor.tags.map((tag) => tag.trim()).filter((tag) => tag.length > 0);
  const publicLinks = [...siteAuthor.socialLinks];
  if (blogUrl !== undefined) {
    publicLinks.unshift({ label: siteBrand.name, url: blogUrl });
  }
  const latestArticleDate = formatMetricDateValue({
    copy,
    language,
    status: metrics.status,
    timeZone,
    value: metrics.latestArticleDate,
  });

  return (
    <main className="page-shell page-shell--with-front-hero about-author-page">
      <FrontPageHero
        coverUrls={coverUrls}
        description={authorBio}
        eyebrow={copy.authorHeroEyebrow}
        fallbackCoverUrl={fallbackCoverUrl}
        icon={UserRound}
        title={copy.authorHeroTitle}
      />
      <section className="about-page-body">
        <section className="about-author-profile" aria-labelledby="about-author-profile-title">
          <div className="about-author-profile__visual">
            <Avatar
              alt={authorName}
              name={authorName}
              shape="circle"
              size={144}
              src={avatarUrl === undefined ? undefined : resolveSiteAssetUrl(avatarUrl)}
            />
          </div>
          <div className="about-author-profile__body">
            <Badge label={copy.profileLabel} variant="neutral" />
            <Heading id="about-author-profile-title" level={2}>
              {authorName}
            </Heading>
            {username === undefined ? null : (
              <Text as="p" className="about-author-profile__username">
                @{username}
              </Text>
            )}
            <Text as="p" color="secondary">
              {authorBio}
            </Text>
            {authorTags.length > 0 ? (
              <div className="about-author-tags">
                {authorTags.map((tag) => (
                  <span key={tag}>#{tag}</span>
                ))}
              </div>
            ) : null}
          </div>
          <div className="about-author-profile__aside">
            <Heading level={3}>{copy.authorStatsTitle}</Heading>
            <div className="about-author-stats">
              <AboutStat
                label={copy.articleCountLabel}
                value={formatMetricValue({
                  copy,
                  formatter: copy.totalArticleCount,
                  status: metrics.status,
                  value: metrics.articleCount,
                })}
              />
              <AboutStat
                label={copy.categoryCountLabel}
                value={formatMetricValue({
                  copy,
                  formatter: copy.categoryCount,
                  status: metrics.status,
                  value: metrics.categoryCount,
                })}
              />
              <AboutStat label={copy.latestArticleLabel} value={latestArticleDate} />
            </div>
          </div>
        </section>

        <section className="about-author-links-panel" aria-labelledby="about-author-links-title">
          <div>
            <Heading id="about-author-links-title" level={2}>
              {copy.authorLinksTitle}
            </Heading>
            <Text as="p" color="secondary">
              {copy.authorActionsTitle}
            </Text>
          </div>
          <div className="about-author-links">
            {publicLinks.length > 0 ? (
              publicLinks.map((link) => {
                const href = getSafeLinkUrl(link.url);
                if (href === undefined) {
                  return null;
                }
                const Icon = getSocialIcon({ label: link.label, url: link.url });

                return (
                  <SiteActionLink
                    external
                    href={href}
                    icon={<Icon aria-hidden="true" size={17} />}
                    key={`${link.label}-${link.url}`}
                    label={link.label}
                  />
                );
              })
            ) : (
              <Text as="p" color="secondary">
                {copy.noPublicLinks}
              </Text>
            )}
          </div>
        </section>

        <AboutSection
          icon={<MonitorCheck aria-hidden="true" size={22} />}
          title={copy.authorInfoTitle}
        >
          <div className="about-author-focus-grid">
            {authorFocusItemsByLanguage[language].map((item) => (
              <AboutFeatureCard item={item} key={item.title} />
            ))}
          </div>
        </AboutSection>

        <AboutSection
          icon={<Terminal aria-hidden="true" size={22} />}
          title={copy.siteTechnologyTitle}
        >
          <div className="about-technology-grid">
            {authorToolItemsByLanguage[language].map((item) => (
              <AboutFeatureCard item={item} key={item.title} />
            ))}
          </div>
        </AboutSection>

        <section className="about-next-panel" aria-labelledby="about-author-next-title">
          <div>
            <Text as="p" className="about-next-panel__eyebrow">
              {copy.authorCtaEyebrow}
            </Text>
            <Heading id="about-author-next-title" level={2}>
              {copy.authorCtaTitle}
            </Heading>
            <Text as="p" color="secondary">
              {copy.authorCtaDescription}
            </Text>
          </div>
          <div className="about-next-panel__actions">
            <SiteActionLink
              href="/articles"
              icon={<BookOpen aria-hidden="true" size={17} />}
              label={copy.navigationArticles}
              onNavigate={onNavigate}
            />
            <SiteActionLink
              href="/guestbook"
              icon={<MessageSquareText aria-hidden="true" size={17} />}
              label={copy.navigationGuestbook}
              onNavigate={onNavigate}
            />
          </div>
        </section>
      </section>
    </main>
  );
}
