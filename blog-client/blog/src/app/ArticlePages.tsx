import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { readArticleExcerptText } from "../../../shared/article-excerpt";
import { UploadProgressList, useUploadProgress } from "../../../shared/upload-progress";
import type { UploadProgress } from "../../../shared/upload-request";
import type { ChangeEvent, CSSProperties, FormEvent, MouseEvent, ReactNode } from "react";
import type { EmojiClickData } from "emoji-picker-react";
import type { EmojiData } from "emoji-picker-react/dist/types/exposedTypes";
import {
  Archive,
  ArrowRight,
  ArrowUp,
  ArrowUpDown,
  BookOpen,
  CalendarDays,
  ChevronRight,
  ChevronLeft,
  Clock,
  FileText,
  FolderOpen,
  Home,
  ImagePlus,
  List,
  MessageCircle,
  MessageSquareText,
  Reply,
  Search,
  Send,
  ShieldCheck,
  Smile,
  Sparkles,
  Tag,
  Tags,
  X,
  UsersRound,
} from "lucide-react";
import EmojiPicker, { EmojiStyle, Theme as EmojiTheme } from "emoji-picker-react";
import zhEmojiDataJson from "emoji-picker-react/dist/data/emojis-zh.json";
import { PhotoProvider, PhotoView } from "react-photo-view";

import { Avatar } from "@astryxdesign/core/Avatar";
import { Badge } from "@astryxdesign/core/Badge";
import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { DropdownMenu } from "@astryxdesign/core/DropdownMenu";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Heading } from "@astryxdesign/core/Heading";
import { Layout, LayoutContent, LayoutPanel } from "@astryxdesign/core/Layout";
import { Outline } from "@astryxdesign/core/Outline";
import { OverflowList } from "@astryxdesign/core/OverflowList";
import { Popover } from "@astryxdesign/core/Popover";
import { Selector } from "@astryxdesign/core/Selector";
import { Spinner } from "@astryxdesign/core/Spinner";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { TextArea } from "@astryxdesign/core/TextArea";
import { useMediaQuery } from "@astryxdesign/core/hooks";

import type {
  ArticleCategory,
  ArticleContributorRelation,
  ArticleContent,
  ArticleContentList,
  ArticleRelation,
  ArticleTag,
  BlogUser,
  CommentItem,
  CommentList,
} from "../../../shared/admin-api";
import {
  createPublicArticleComment,
  createPublicGuestbookComment,
  getPublicArticle,
  getPublicArticleComments,
  getPublicArticleCategories,
  getPublicArticles,
  getPublicArticleTags,
  getPublicGuestbookComments,
  uploadPublicCommentImage,
} from "../../../shared/admin-api";
import type { AppLanguage } from "../../../shared/i18n";
import {
  formatDayInTimeZone,
  formatDateInTimeZone,
  formatDateTimeInTimeZone,
  formatMonthInTimeZone,
  formatYearInTimeZone,
} from "../../../shared/time-zone";
import { ArticleMdxContent, parseArticleToc } from "./ArticleMdxContent";
import { FrontPageHero } from "./FrontPageHero";
import {
  getSafeLinkUrl,
  resolveContentAssetUrl as resolveFrontAssetUrl,
} from "../../../shared/content-url";
import {
  getAltchaVerificationDialogCopy,
  useAltchaVerificationDialog,
} from "../../../shared/altcha-challenge";
import { getAltchaSuccessMessage } from "../../../shared/altcha-feedback";
import type { AltchaFeedback } from "../../../shared/altcha-feedback";

type FrontArticlePageProps = {
  coverUrls: readonly string[];
  fallbackCoverUrl: string;
  language: AppLanguage;
  onNavigate: (path: string) => void;
  search: string;
  timeZone: string;
};

type FilteredArticlePageProps = FrontArticlePageProps & {
  slug: string;
};

type ArticleDetailPageProps = FrontArticlePageProps & {
  authUser: BlogUser | null;
  commentsEnabled: boolean;
  onFeedback: (feedback: AltchaFeedback) => void;
  onOpenAuth: () => void;
  slug: string;
};

type GuestbookPageProps = {
  authUser: BlogUser | null;
  commentsEnabled: boolean;
  coverUrls: readonly string[];
  fallbackCoverUrl: string;
  language: AppLanguage;
  onFeedback: (feedback: AltchaFeedback) => void;
  onOpenAuth: () => void;
  timeZone: string;
};

type FrontArticleCopy = {
  articleEmpty: string;
  articleError: string;
  articleFallbackTitle: string;
  articleListDescription: string;
  articleListEyebrow: string;
  articleListTitle: string;
  breadcrumbArticles: string;
  breadcrumbHome: string;
  breadcrumbLabel: string;
  commentsClosed: string;
  commentsComposerLabel: string;
  commentsEmpty: string;
  commentsError: string;
  commentsImageRemove: string;
  commentsImageUpload: string;
  commentsImageUploading: string;
  commentsLatest: string;
  commentsHumanRequired: string;
  commentsLocationFallback: string;
  commentsLogin: string;
  commentsOldest: string;
  commentsPanelDescription: string;
  commentsPlaceholder: string;
  commentsPublicCountLabel: (count: number) => string;
  commentsReply: string;
  commentsReplyCancel: string;
  commentsReplyingTo: (name: string) => string;
  commentsSend: string;
  commentsSending: string;
  commentsTitle: string;
  contributorsTitle: string;
  guestbookComposerLabel: string;
  guestbookDescription: string;
  guestbookEmpty: string;
  guestbookEyebrow: string;
  guestbookGuidelinesTitle: string;
  guestbookPanelDescription: string;
  guestbookPlaceholder: string;
  guestbookPublicCountLabel: (count: number) => string;
  guestbookReply: string;
  guestbookSend: string;
  guestbookThreadTitle: string;
  guestbookTitle: string;
  archivesDescription: string;
  archivesEyebrow: string;
  archivesTitle: string;
  categoriesDescription: string;
  categoriesEyebrow: string;
  categoriesTitle: string;
  categoryArticleFallback: string;
  articleCountLabel: (count: number) => string;
  back: string;
  backToTop: string;
  categoryFooter: string;
  contentUpdated: string;
  readArticle: string;
  readCount: (count: number) => string;
  refresh: string;
  searchResult: (query: string, count: number) => string;
  searchLabel: string;
  searchPlaceholder: string;
  sortLabel: string;
  sortLatest: string;
  sortOldest: string;
  tagArticleFallback: string;
  tagsDescription: string;
  tagsEyebrow: string;
  tagsTitle: string;
  toc: string;
  tocEmpty: string;
};

const PAGE_SIZE = 12;
const COMMENT_PAGE_SIZE = 80;
const zhEmojiData = zhEmojiDataJson as unknown as EmojiData;
const SORT_OPTIONS = [
  { label: "最新发布", value: "desc" },
  { label: "最早发布", value: "asc" },
];

type GuestbookGuidelineItem = {
  description: string;
  icon: ReactNode;
  title: string;
};

const guestbookGuidelinesByLanguage: Record<AppLanguage, readonly GuestbookGuidelineItem[]> = {
  "zh-CN": [
    {
      description: "欢迎提问题、补充视角，也欢迎指出文章里不严谨的地方。",
      icon: <MessageCircle aria-hidden="true" size={22} />,
      title: "真实交流",
    },
    {
      description: "技术讨论、阅读反馈、站点建议都会比泛泛寒暄更容易跟进。",
      icon: <BookOpen aria-hidden="true" size={22} />,
      title: "聚焦内容",
    },
    {
      description: "留言会按公开评论规则展示，忙的时候回复可能慢一些。",
      icon: <ShieldCheck aria-hidden="true" size={22} />,
      title: "耐心等待",
    },
  ],
  en: [
    {
      description: "Questions, extra context, and corrections are all welcome.",
      icon: <MessageCircle aria-hidden="true" size={22} />,
      title: "Real exchange",
    },
    {
      description:
        "Technical discussion, reading feedback, and site suggestions are easiest to follow up.",
      icon: <BookOpen aria-hidden="true" size={22} />,
      title: "Stay focused",
    },
    {
      description: "Messages follow the public comment rules, and replies may take a little time.",
      icon: <ShieldCheck aria-hidden="true" size={22} />,
      title: "Please be patient",
    },
  ],
};

const frontArticleCopyByLanguage: Record<AppLanguage, FrontArticleCopy> = {
  "zh-CN": {
    articleEmpty: "暂时没有公开文章。",
    articleError: "文章内容加载失败。",
    articleFallbackTitle: "文章",
    articleListDescription: "浏览全部公开文章，也可以按关键词、分类或标签进入具体内容。",
    articleListEyebrow: "文章索引",
    articleListTitle: "全部文章",
    breadcrumbArticles: "文章",
    breadcrumbHome: "首页",
    breadcrumbLabel: "面包屑",
    commentsClosed: "评论已关闭。",
    commentsComposerLabel: "评论",
    commentsEmpty: "还没有评论，来写第一条吧。",
    commentsError: "评论加载失败。",
    commentsImageRemove: "移除",
    commentsImageUpload: "添加图片",
    commentsImageUploading: "上传中",
    commentsLatest: "最新",
    commentsHumanRequired: "请先完成人机验证。",
    commentsLocationFallback: "本地或未知地点",
    commentsLogin: "登录后参与评论",
    commentsOldest: "最早",
    commentsPanelDescription: "评论来自当前文章的公开评论接口。",
    commentsPlaceholder: "写下你的评论...",
    commentsPublicCountLabel: (count) => `共 ${count} 条公开评论`,
    commentsReply: "回复",
    commentsReplyCancel: "取消回复",
    commentsReplyingTo: (name) => `正在回复 ${name}`,
    commentsSend: "发送评论",
    commentsSending: "发送中",
    commentsTitle: "文章评论",
    contributorsTitle: "贡献者",
    guestbookComposerLabel: "留言",
    guestbookDescription: "把问题、建议和想继续聊的话题留在这里。",
    guestbookEmpty: "还没有留言，来写第一条吧。",
    guestbookEyebrow: "交流",
    guestbookGuidelinesTitle: "留言前的小约定",
    guestbookPanelDescription: "这里的数据目标类型是 guestbook，和文章评论分开筛选。",
    guestbookPlaceholder: "写下你的留言，可以添加 Emoji 和图片...",
    guestbookPublicCountLabel: (count) => `共 ${count} 条公开留言`,
    guestbookReply: "回复留言",
    guestbookSend: "发送留言",
    guestbookThreadTitle: "站点留言",
    guestbookTitle: "留言板",
    archivesDescription: "按发布时间回看所有公开文章。",
    archivesEyebrow: "文章索引",
    archivesTitle: "文章归档",
    categoriesDescription: "按内容主题浏览文章分类和分类下的文章。",
    categoriesEyebrow: "分类索引",
    categoriesTitle: "文章分类",
    categoryArticleFallback: "分类文章",
    articleCountLabel: (count) => `${count} 篇文章`,
    back: "返回",
    backToTop: "回到顶部",
    categoryFooter: "点击查看该分类下的所有文章",
    contentUpdated: "更新于",
    readArticle: "阅读全文",
    readCount: (count) => `${count} 次阅读`,
    refresh: "刷新",
    searchResult: (query, count) => `搜索“${query}”，找到 ${count} 篇文章`,
    searchLabel: "搜索文章",
    searchPlaceholder: "搜索标题、摘要或正文",
    sortLabel: "排序方式",
    sortLatest: "最新发布",
    sortOldest: "最早发布",
    tagArticleFallback: "标签文章",
    tagsDescription: "按标签聚合主题与关联文章。",
    tagsEyebrow: "标签索引",
    tagsTitle: "全部标签",
    toc: "本文目录",
    tocEmpty: "暂无目录",
  },
  en: {
    articleEmpty: "No public articles yet.",
    articleError: "Failed to load article content.",
    articleFallbackTitle: "Article",
    articleListDescription:
      "Browse every public article, or enter through search, categories, or tags.",
    articleListEyebrow: "Article Index",
    articleListTitle: "All Articles",
    breadcrumbArticles: "Articles",
    breadcrumbHome: "Home",
    breadcrumbLabel: "Breadcrumb",
    commentsClosed: "Comments are currently closed.",
    commentsComposerLabel: "Comment",
    commentsEmpty: "No comments yet. Start the conversation.",
    commentsError: "Failed to load comments.",
    commentsImageRemove: "Remove",
    commentsImageUpload: "Add image",
    commentsImageUploading: "Uploading",
    commentsLatest: "Latest",
    commentsHumanRequired: "Complete human verification first.",
    commentsLocationFallback: "Local or unknown location",
    commentsLogin: "Sign in to comment",
    commentsOldest: "Oldest",
    commentsPanelDescription: "Comments come from this article's public discussion endpoint.",
    commentsPlaceholder: "Write a comment...",
    commentsPublicCountLabel: (count) => `${count} public ${count === 1 ? "comment" : "comments"}`,
    commentsReply: "Reply",
    commentsReplyCancel: "Cancel reply",
    commentsReplyingTo: (name) => `Replying to ${name}`,
    commentsSend: "Send comment",
    commentsSending: "Sending",
    commentsTitle: "Article comments",
    contributorsTitle: "Contributors",
    guestbookComposerLabel: "Message",
    guestbookDescription: "Leave questions, suggestions, or topics you want to keep talking about.",
    guestbookEmpty: "No messages yet. Start the guestbook.",
    guestbookEyebrow: "Conversation",
    guestbookGuidelinesTitle: "Before You Leave A Message",
    guestbookPanelDescription:
      "These messages use the guestbook target and stay separate from article comments.",
    guestbookPlaceholder: "Write a message with Emoji or images...",
    guestbookPublicCountLabel: (count) => `${count} public ${count === 1 ? "message" : "messages"}`,
    guestbookReply: "Reply",
    guestbookSend: "Send message",
    guestbookThreadTitle: "Site messages",
    guestbookTitle: "Guestbook",
    archivesDescription: "Review public articles by publication time.",
    archivesEyebrow: "Article Index",
    archivesTitle: "Article Archives",
    categoriesDescription: "Browse article categories and the writing inside them.",
    categoriesEyebrow: "Category Index",
    categoriesTitle: "Article Categories",
    categoryArticleFallback: "Category Articles",
    articleCountLabel: (count) => `${count} ${count === 1 ? "article" : "articles"}`,
    back: "Back",
    backToTop: "Back to top",
    categoryFooter: "Open every article in this category",
    contentUpdated: "Updated",
    readArticle: "Read more",
    readCount: (count) => `${count} reads`,
    refresh: "Refresh",
    searchResult: (query, count) => `Search "${query}" found ${count} articles`,
    searchLabel: "Search articles",
    searchPlaceholder: "Search title, summary, or content",
    sortLabel: "Sort",
    sortLatest: "Newest",
    sortOldest: "Oldest",
    tagArticleFallback: "Tag Articles",
    tagsDescription: "Collect topics and related articles by tag.",
    tagsEyebrow: "Tag Index",
    tagsTitle: "All Tags",
    toc: "On this page",
    tocEmpty: "No sections",
  },
};

const createEmptyArticleList = (): ArticleContentList => ({
  items: [],
  ok: true,
  pageInfo: {
    page: 1,
    pageSize: PAGE_SIZE,
    totalItems: 0,
    totalPages: 1,
  },
});

const createEmptyCommentList = (): CommentList => ({
  items: [],
  ok: true,
  pageInfo: {
    page: 1,
    pageSize: COMMENT_PAGE_SIZE,
    totalItems: 0,
    totalPages: 1,
  },
});

const isModifiedClick = (event: MouseEvent<HTMLAnchorElement>) =>
  event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0;

const readArticleContent = (article: ArticleContent, language: AppLanguage) =>
  language === "en" ? article.localizations.en : article.localizations.zhCN;

const readTaxonomyName = (taxonomy: ArticleCategory | ArticleTag, language: AppLanguage) =>
  language === "en" ? taxonomy.localizations.en.name : taxonomy.localizations.zhCN.name;

const readTaxonomyDescription = (taxonomy: ArticleCategory | ArticleTag, language: AppLanguage) =>
  language === "en"
    ? taxonomy.localizations.en.description
    : taxonomy.localizations.zhCN.description;

const readRelationName = (relation: ArticleRelation, language: AppLanguage) =>
  language === "en" ? relation.localizations.en.name : relation.localizations.zhCN.name;

const readDate = ({
  language,
  timeZone,
  value,
}: {
  language: AppLanguage;
  timeZone: string;
  value: string | null;
}) =>
  formatDateInTimeZone({
    language,
    timeZone,
    value,
  }) ?? "";

const readDateTime = ({
  language,
  timeZone,
  value,
}: {
  language: AppLanguage;
  timeZone: string;
  value: string | null;
}) =>
  formatDateTimeInTimeZone({
    language,
    timeZone,
    value,
  });

const readYear = ({
  fallback,
  timeZone,
  value,
}: {
  fallback: string;
  timeZone: string;
  value: string | null;
}) =>
  formatYearInTimeZone({
    fallback,
    timeZone,
    value,
  }) ?? fallback;

const readMonth = ({
  fallback,
  language,
  timeZone,
  value,
}: {
  fallback: string;
  language: AppLanguage;
  timeZone: string;
  value: string | null;
}) =>
  formatMonthInTimeZone({
    fallback,
    language,
    timeZone,
    value,
  }) ?? fallback;

const readDay = ({
  fallback,
  timeZone,
  value,
}: {
  fallback: string;
  timeZone: string;
  value: string | null;
}) =>
  formatDayInTimeZone({
    fallback,
    timeZone,
    value,
  }) ?? fallback;

const readArticleTimestamp = (article: ArticleContent) => article.publishedAt ?? article.createdAt;

const readArticleExcerpt = ({
  article,
  language,
}: {
  article: ArticleContent;
  language: AppLanguage;
}) => {
  const content = readArticleContent(article, language);
  const source = content.summary || article.summary || content.contentMdx;

  return readArticleExcerptText(source);
};

const readArticleReadingTime = ({
  article,
  language,
}: {
  article: ArticleContent;
  language: AppLanguage;
}) => {
  const content = readArticleContent(article, language);
  const plainText = content.contentMdx.replace(/[#*_`>\-[\]()]/g, " ").trim();
  const readingUnits =
    language === "en"
      ? plainText.split(/\s+/).filter(Boolean).length
      : plainText.replace(/\s+/g, "").length;
  const minutes = Math.max(1, Math.ceil(readingUnits / (language === "en" ? 220 : 500)));

  return language === "en" ? `${minutes} min` : `${minutes} 分钟`;
};

const readContributorAvatarUrl = (contributor: ArticleContributorRelation) => {
  const avatarUrl = contributor.avatarUrl?.trim();

  return avatarUrl === undefined || avatarUrl.length === 0
    ? undefined
    : resolveFrontAssetUrl(avatarUrl);
};

const readContributorLinkUrl = (contributor: ArticleContributorRelation) => {
  const linkUrl = contributor.linkUrl?.trim();

  return getSafeLinkUrl(linkUrl);
};

const readCommentAuthorName = (comment: CommentItem) =>
  comment.author.name?.trim() || comment.author.username;

const readCommentAvatarUrl = (comment: CommentItem) => {
  const avatarUrl = comment.author.avatarUrl?.trim();

  return avatarUrl === undefined || avatarUrl.length === 0
    ? undefined
    : resolveFrontAssetUrl(avatarUrl);
};

type CommentSortOrder = "latest" | "oldest";

const sortComments = ({
  comments,
  sortOrder,
}: {
  comments: readonly CommentItem[];
  sortOrder: CommentSortOrder;
}) =>
  [...comments].sort((firstComment, secondComment) => {
    const firstTime = new Date(firstComment.createdAt).getTime();
    const secondTime = new Date(secondComment.createdAt).getTime();

    return sortOrder === "latest" ? secondTime - firstTime : firstTime - secondTime;
  });

type UploadedCommentImage = {
  id: string;
  name: string;
  url: string;
};

type CommentContentPart =
  | {
      alt: string;
      kind: "image";
      url: string;
    }
  | {
      kind: "text";
      value: string;
    };

const commentImageMarkdownPattern = /!\[([^\]]*)\]\(([^)]+)\)/g;

const createRandomBrowserId = () => {
  const cryptoValue = globalThis.crypto;

  if (typeof cryptoValue?.randomUUID === "function") {
    return cryptoValue.randomUUID();
  }

  if (typeof cryptoValue?.getRandomValues === "function") {
    const values = cryptoValue.getRandomValues(new Uint32Array(2));
    return `${values[0].toString(36)}-${values[1].toString(36)}`;
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
};

const createCommentUploadId = (file: File) =>
  `${file.name}-${file.size}-${file.lastModified}-${createRandomBrowserId()}`;

const normalizeCommentImageAlt = (value: string) =>
  value.replace(/[\][]/g, "").trim() || "comment image";

const buildCommentContent = ({
  images,
  text,
}: {
  images: readonly UploadedCommentImage[];
  text: string;
}) => {
  const imageMarkdown = images.map(
    (image) => `![${normalizeCommentImageAlt(image.name)}](${image.url})`,
  );

  return [text.trim(), ...imageMarkdown].filter(Boolean).join("\n\n");
};

const parseCommentContent = (content: string): CommentContentPart[] => {
  const parts: CommentContentPart[] = [];
  let lastIndex = 0;

  for (const match of content.matchAll(commentImageMarkdownPattern)) {
    const [source, alt = "", url = ""] = match;
    const matchIndex = match.index ?? 0;
    if (matchIndex > lastIndex) {
      parts.push({
        kind: "text",
        value: content.slice(lastIndex, matchIndex),
      });
    }

    parts.push({
      alt: alt.trim() || "comment image",
      kind: "image",
      url: url.trim(),
    });
    lastIndex = matchIndex + source.length;
  }

  if (lastIndex < content.length) {
    parts.push({
      kind: "text",
      value: content.slice(lastIndex),
    });
  }

  if (parts.length > 0) {
    return parts;
  }

  return [{ kind: "text", value: content }];
};

const readPrimaryCategoryName = ({
  article,
  fallback,
  language,
}: {
  article: ArticleContent;
  fallback: string;
  language: AppLanguage;
}) => {
  const category = article.categories[0];

  return category === undefined ? fallback : readRelationName(category, language);
};

const readTaxonomyFallbackCoverUrl = ({
  coverUrls,
  fallbackCoverUrl,
  index,
}: {
  coverUrls: readonly string[];
  fallbackCoverUrl: string;
  index: number;
}) => coverUrls[index % Math.max(coverUrls.length, 1)] ?? fallbackCoverUrl;

type ArticleSortSelectorProps = {
  className?: string;
  copy: FrontArticleCopy;
  onSortOrderChange: (sortOrder: "asc" | "desc") => void;
  sortOrder: "asc" | "desc";
};

function ArticleSortSelector({
  className,
  copy,
  onSortOrderChange,
  sortOrder,
}: ArticleSortSelectorProps) {
  return (
    <div className={className ?? "front-article-sort"}>
      <div className="front-article-sort__label">
        <ArrowUpDown aria-hidden="true" size={16} />
        {copy.sortLabel}
      </div>
      <Selector
        className="front-article-sort__selector"
        isLabelHidden
        label={copy.sortLabel}
        onChange={(value) => {
          if (value === "asc" || value === "desc") {
            onSortOrderChange(value);
          }
        }}
        options={SORT_OPTIONS.map((option) => ({
          label: option.value === "desc" ? copy.sortLatest : copy.sortOldest,
          value: option.value,
        }))}
        value={sortOrder}
      />
    </div>
  );
}

type ArticleListToolsProps = {
  copy: FrontArticleCopy;
  onClearSearch: () => void;
  onSortOrderChange: (sortOrder: "asc" | "desc") => void;
  query: string;
  resultCount: number;
  sortOrder: "asc" | "desc";
};

function ArticleListTools({
  copy,
  onClearSearch,
  onSortOrderChange,
  query,
  resultCount,
  sortOrder,
}: ArticleListToolsProps) {
  return (
    <div className="front-article-tools">
      {query.trim().length > 0 ? (
        <button className="front-article-search-state" onClick={onClearSearch} type="button">
          <Search aria-hidden="true" size={16} />
          <span>{copy.searchResult(query, resultCount)}</span>
        </button>
      ) : (
        <span aria-hidden="true" className="front-article-tools__spacer" />
      )}
      <ArticleSortSelector
        copy={copy}
        onSortOrderChange={onSortOrderChange}
        sortOrder={sortOrder}
      />
    </div>
  );
}

type FrontArticleCardProps = {
  article: ArticleContent;
  index: number;
  language: AppLanguage;
  onNavigate: (path: string) => void;
  timeZone: string;
};

function FrontArticleCard({
  article,
  index,
  language,
  onNavigate,
  timeZone,
}: FrontArticleCardProps) {
  const copy = frontArticleCopyByLanguage[language];
  const content = readArticleContent(article, language);
  const coverUrl = article.coverImageUrl?.trim();
  const hasCover = coverUrl !== undefined && coverUrl.length > 0;
  const articleUrl = `/articles/${article.slug}`;
  const publishedDate = readDate({
    language,
    timeZone,
    value: readArticleTimestamp(article),
  });
  const primaryCategoryName = readPrimaryCategoryName({
    article,
    fallback: copy.articleFallbackTitle,
    language,
  });
  const excerpt = readArticleExcerpt({ article, language });

  return (
    <Card
      className={
        hasCover ? "front-article-card" : "front-article-card front-article-card--without-cover"
      }
      padding={0}
    >
      <a
        className="front-article-card__cover"
        href={articleUrl}
        onClick={(event) => {
          if (isModifiedClick(event)) {
            return;
          }

          event.preventDefault();
          onNavigate(articleUrl);
        }}
      >
        {hasCover ? (
          <img alt={content.title} src={resolveFrontAssetUrl(coverUrl)} />
        ) : (
          <span className="front-article-card__placeholder">
            {index % 2 === 0 ? <BookOpen size={34} /> : <FileText size={34} />}
            <small>{primaryCategoryName}</small>
          </span>
        )}
      </a>
      <div className="front-article-card__body">
        <div className="front-article-card__meta">
          <span>
            <CalendarDays aria-hidden="true" size={14} />
            {publishedDate}
          </span>
          <span>
            <FolderOpen aria-hidden="true" size={14} />
            {primaryCategoryName}
          </span>
          <span>
            <Clock aria-hidden="true" size={14} />
            {readArticleReadingTime({ article, language })}
          </span>
        </div>
        <Heading level={3}>
          <a
            href={articleUrl}
            onClick={(event) => {
              if (isModifiedClick(event)) {
                return;
              }

              event.preventDefault();
              onNavigate(articleUrl);
            }}
          >
            {content.title}
          </a>
        </Heading>
        <p>{excerpt.length > 0 ? excerpt : copy.articleListDescription}</p>
        <div className="front-article-card__footer">
          <OverflowList
            className="front-article-card__tags"
            gap={1}
            minVisibleItems={0}
            overflowRenderer={(overflowItems) => (
              <DropdownMenu
                alignment="end"
                button={{
                  className: "front-article-card__tag-overflow",
                  label: `+${overflowItems.length}`,
                  size: "sm",
                  variant: "ghost",
                }}
                hasChevron={false}
                items={overflowItems
                  .map(({ index }) => article.tags[index])
                  .filter((tag) => tag !== undefined)
                  .map((tag) => ({
                    id: tag.id,
                    label: (
                      <span
                        className="front-article-card__dropdown-tag"
                        style={{ "--article-tag-color": tag.color ?? "#ec4899" } as CSSProperties}
                      >
                        #{readRelationName(tag, language)}
                      </span>
                    ),
                    onClick: () => {
                      onNavigate(`/tags/${tag.slug}`);
                    },
                  }))}
                placement="below"
              />
            )}
          >
            {article.tags.map((tag) => (
              <a
                href={`/tags/${tag.slug}`}
                key={tag.id}
                onClick={(event) => {
                  if (isModifiedClick(event)) {
                    return;
                  }

                  event.preventDefault();
                  onNavigate(`/tags/${tag.slug}`);
                }}
                style={{ "--article-tag-color": tag.color ?? "#ec4899" } as CSSProperties}
              >
                #{readRelationName(tag, language)}
              </a>
            ))}
          </OverflowList>
          <a
            className="front-article-card__link"
            href={articleUrl}
            onClick={(event) => {
              if (isModifiedClick(event)) {
                return;
              }

              event.preventDefault();
              onNavigate(articleUrl);
            }}
          >
            {copy.readArticle}
            <ArrowRight aria-hidden="true" size={14} />
          </a>
        </div>
      </div>
    </Card>
  );
}

function usePublicArticleList({
  categorySlug,
  page,
  query,
  sortOrder,
  tagSlug,
}: {
  categorySlug?: string;
  page: number;
  query: string;
  sortOrder: "asc" | "desc";
  tagSlug?: string;
}) {
  const [articleList, setArticleList] = useState<ArticleContentList>(() =>
    createEmptyArticleList(),
  );
  const [errorMessage, setErrorMessage] = useState<string>();
  const [isLoading, setIsLoading] = useState(true);

  const loadArticles = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(undefined);
    try {
      setArticleList(
        await getPublicArticles({
          categorySlug,
          page,
          pageSize: PAGE_SIZE,
          query,
          sortBy: "publishedAt",
          sortOrder,
          tagSlug,
        }),
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to load articles.");
    } finally {
      setIsLoading(false);
    }
  }, [categorySlug, page, query, sortOrder, tagSlug]);

  useEffect(() => {
    void loadArticles();
  }, [loadArticles]);

  return {
    articleList,
    errorMessage,
    isLoading,
    loadArticles,
  };
}

function ArticleListPage({
  categorySlug,
  coverUrls,
  fallbackCoverUrl,
  language,
  onNavigate,
  search,
  tagSlug,
  timeZone,
  titleFallback,
}: FrontArticlePageProps & {
  categorySlug?: string;
  tagSlug?: string;
  titleFallback?: string;
}) {
  const copy = frontArticleCopyByLanguage[language];
  const searchParams = useMemo(() => new URLSearchParams(search), [search]);
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [page, setPage] = useState(1);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const { articleList, errorMessage, isLoading } = usePublicArticleList({
    categorySlug,
    page,
    query,
    sortOrder,
    tagSlug,
  });
  const pageTitle = titleFallback ?? copy.articleListTitle;
  const heroDescription =
    categorySlug !== undefined || tagSlug !== undefined
      ? `${articleList.pageInfo.totalItems} ${language === "en" ? "articles" : "篇文章"}`
      : copy.articleListDescription;

  useEffect(() => {
    setQuery(searchParams.get("q") ?? "");
    setPage(1);
  }, [searchParams]);

  return (
    <main className="page-shell page-shell--with-front-hero front-articles-page">
      <FrontPageHero
        coverUrls={coverUrls}
        description={heroDescription}
        eyebrow={copy.articleListEyebrow}
        fallbackCoverUrl={fallbackCoverUrl}
        icon={BookOpen}
        title={pageTitle}
      />
      <section className="front-article-page-body front-article-page-body--index">
        <ArticleListTools
          copy={copy}
          onClearSearch={() => {
            setQuery("");
            setPage(1);
            onNavigate("/articles");
          }}
          onSortOrderChange={(value) => {
            setSortOrder(value);
            setPage(1);
          }}
          query={query}
          resultCount={articleList.pageInfo.totalItems}
          sortOrder={sortOrder}
        />

        {isLoading ? (
          <div className="front-loading">
            <Spinner />
          </div>
        ) : errorMessage !== undefined ? (
          <EmptyState
            description={errorMessage}
            icon={<FileText size={24} />}
            title={copy.articleError}
          />
        ) : articleList.items.length === 0 ? (
          <EmptyState
            description={copy.articleListDescription}
            icon={<BookOpen size={24} />}
            title={copy.articleEmpty}
          />
        ) : (
          <div className="front-article-grid">
            {articleList.items.map((article, index) => (
              <FrontArticleCard
                article={article}
                index={(page - 1) * PAGE_SIZE + index}
                key={article.id}
                language={language}
                onNavigate={onNavigate}
                timeZone={timeZone}
              />
            ))}
          </div>
        )}

        {articleList.pageInfo.totalPages > 1 ? (
          <HStack className="front-pagination" gap={2} hAlign="center" wrap="wrap">
            <Button
              isDisabled={page <= 1}
              label={language === "en" ? "Previous" : "上一页"}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              variant="secondary"
            />
            <Text color="secondary" type="supporting">
              {page} / {articleList.pageInfo.totalPages}
            </Text>
            <Button
              isDisabled={page >= articleList.pageInfo.totalPages}
              label={language === "en" ? "Next" : "下一页"}
              onClick={() =>
                setPage((current) => Math.min(articleList.pageInfo.totalPages, current + 1))
              }
              variant="secondary"
            />
          </HStack>
        ) : null}
      </section>
    </main>
  );
}

export function ArticlesPage(props: FrontArticlePageProps) {
  return <ArticleListPage {...props} />;
}

type TaxonomyArticleRowProps = {
  accentColor?: string;
  article: ArticleContent;
  index: number;
  language: AppLanguage;
  onNavigate: (path: string) => void;
  timeZone: string;
};

function TaxonomyArticleRow({
  accentColor,
  article,
  index,
  language,
  onNavigate,
  timeZone,
}: TaxonomyArticleRowProps) {
  const copy = frontArticleCopyByLanguage[language];
  const content = readArticleContent(article, language);
  const articleUrl = `/articles/${article.slug}`;

  return (
    <a
      className="front-taxonomy-article-row"
      href={articleUrl}
      onClick={(event) => {
        if (isModifiedClick(event)) {
          return;
        }

        event.preventDefault();
        onNavigate(articleUrl);
      }}
      style={{ "--taxonomy-row-accent": accentColor ?? "#8b5cf6" } as CSSProperties}
    >
      <span className="front-taxonomy-article-row__index">{index + 1}</span>
      <span className="front-taxonomy-article-row__content">
        <strong>{content.title}</strong>
        <span>{readArticleExcerpt({ article, language }) || copy.articleListDescription}</span>
        <span className="front-taxonomy-article-row__meta">
          <span>
            <CalendarDays aria-hidden="true" size={14} />
            {readDate({ language, timeZone, value: readArticleTimestamp(article) })}
          </span>
          <span>
            <FolderOpen aria-hidden="true" size={14} />
            {readPrimaryCategoryName({
              article,
              fallback: copy.articleFallbackTitle,
              language,
            })}
          </span>
          <span>
            <Clock aria-hidden="true" size={14} />
            {readArticleReadingTime({ article, language })}
          </span>
          {article.tags.slice(0, 4).map((tag) => (
            <span
              className="front-taxonomy-article-row__tag"
              key={tag.id}
              style={{ "--article-tag-color": tag.color ?? "#ec4899" } as CSSProperties}
            >
              #{readRelationName(tag, language)}
            </span>
          ))}
        </span>
      </span>
    </a>
  );
}

type TaxonomyArticleListPageProps = FilteredArticlePageProps & {
  kind: "category" | "tag";
};

function TaxonomyArticleListPage({
  coverUrls,
  fallbackCoverUrl,
  kind,
  language,
  onNavigate,
  slug,
  timeZone,
}: TaxonomyArticleListPageProps) {
  const copy = frontArticleCopyByLanguage[language];
  const [category, setCategory] = useState<ArticleCategory>();
  const [tag, setTag] = useState<ArticleTag>();
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const isTagPage = kind === "tag";
  const { articleList, errorMessage, isLoading } = usePublicArticleList({
    categorySlug: isTagPage ? undefined : slug,
    page,
    query: "",
    sortOrder,
    tagSlug: isTagPage ? slug : undefined,
  });
  const taxonomy = isTagPage ? tag : category;
  const titleFallback = isTagPage ? copy.tagArticleFallback : copy.categoryArticleFallback;
  const pageTitle = taxonomy === undefined ? titleFallback : readTaxonomyName(taxonomy, language);
  const description =
    taxonomy === undefined
      ? isTagPage
        ? copy.tagsDescription
        : copy.categoriesDescription
      : readTaxonomyDescription(taxonomy, language) ||
        copy.articleCountLabel(articleList.pageInfo.totalItems);
  const accentColor = isTagPage ? (tag?.color ?? "#ec4899") : "#8b5cf6";
  const backPath = isTagPage ? "/tags" : "/categories";

  useEffect(() => {
    let isMounted = true;

    const loadTaxonomy = async () => {
      try {
        if (isTagPage) {
          const result = await getPublicArticleTags();
          const nextTag = result.items.find((item) => item.slug === slug);
          if (isMounted) {
            setTag(nextTag);
          }
          return;
        }

        const result = await getPublicArticleCategories();
        const nextCategory = result.items.find((item) => item.slug === slug);
        if (isMounted) {
          setCategory(nextCategory);
        }
      } catch {
        if (isMounted) {
          setCategory(undefined);
          setTag(undefined);
        }
      }
    };

    void loadTaxonomy();

    return () => {
      isMounted = false;
    };
  }, [isTagPage, slug]);

  return (
    <main className="page-shell page-shell--with-front-hero front-taxonomy-detail-page">
      <FrontPageHero
        coverUrls={coverUrls}
        description={description}
        eyebrow={isTagPage ? copy.tagsEyebrow : copy.categoriesEyebrow}
        fallbackCoverUrl={fallbackCoverUrl}
        icon={isTagPage ? Tags : FolderOpen}
        title={isTagPage ? copy.tagsTitle : copy.categoriesTitle}
      />
      <section className="front-article-page-body front-taxonomy-detail-body">
        <div className="front-taxonomy-detail-controls">
          <Button
            icon={<ChevronLeft size={17} />}
            label={copy.back}
            onClick={() => onNavigate(backPath)}
            variant="secondary"
          />
          <ArticleSortSelector
            copy={copy}
            onSortOrderChange={(value) => {
              setSortOrder(value);
              setPage(1);
            }}
            sortOrder={sortOrder}
          />
        </div>
        <Card className="front-taxonomy-detail-heading" padding={0}>
          <span
            className="front-taxonomy-detail-heading__icon"
            style={{ "--taxonomy-heading-accent": accentColor } as CSSProperties}
          >
            {isTagPage ? (
              <Tag aria-hidden="true" size={38} />
            ) : (
              <FolderOpen aria-hidden="true" size={38} />
            )}
          </span>
          <Heading level={2}>{isTagPage ? `#${pageTitle}` : pageTitle}</Heading>
          <Badge
            className="front-taxonomy-detail-heading__count"
            label={copy.articleCountLabel(articleList.pageInfo.totalItems)}
            style={{ "--taxonomy-heading-accent": accentColor } as CSSProperties}
            variant="neutral"
          />
        </Card>
        {isLoading ? (
          <div className="front-loading">
            <Spinner />
          </div>
        ) : errorMessage !== undefined ? (
          <EmptyState
            description={errorMessage}
            icon={<FileText size={24} />}
            title={copy.articleError}
          />
        ) : articleList.items.length === 0 ? (
          <EmptyState
            description={description}
            icon={<FileText size={24} />}
            title={copy.articleEmpty}
          />
        ) : (
          <div className="front-taxonomy-article-list">
            {articleList.items.map((article, index) => (
              <TaxonomyArticleRow
                accentColor={accentColor}
                article={article}
                index={(page - 1) * PAGE_SIZE + index}
                key={article.id}
                language={language}
                onNavigate={onNavigate}
                timeZone={timeZone}
              />
            ))}
          </div>
        )}
        {articleList.pageInfo.totalPages > 1 ? (
          <HStack className="front-pagination" gap={2} hAlign="center" wrap="wrap">
            <Button
              isDisabled={page <= 1}
              label={language === "en" ? "Previous" : "上一页"}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              variant="secondary"
            />
            <Text color="secondary" type="supporting">
              {page} / {articleList.pageInfo.totalPages}
            </Text>
            <Button
              isDisabled={page >= articleList.pageInfo.totalPages}
              label={language === "en" ? "Next" : "下一页"}
              onClick={() =>
                setPage((current) => Math.min(articleList.pageInfo.totalPages, current + 1))
              }
              variant="secondary"
            />
          </HStack>
        ) : null}
      </section>
    </main>
  );
}

export function CategoryArticlesPage(props: FilteredArticlePageProps) {
  return <TaxonomyArticleListPage {...props} kind="category" />;
}

export function TagArticlesPage(props: FilteredArticlePageProps) {
  return <TaxonomyArticleListPage {...props} kind="tag" />;
}

export function CategoriesPage({
  coverUrls,
  fallbackCoverUrl,
  language,
  onNavigate,
}: FrontArticlePageProps) {
  const copy = frontArticleCopyByLanguage[language];
  const [categories, setCategories] = useState<ArticleCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const loadCategories = async () => {
      try {
        const result = await getPublicArticleCategories();
        if (isMounted) {
          setCategories(result.items);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadCategories();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <main className="page-shell page-shell--with-front-hero taxonomy-page">
      <FrontPageHero
        coverUrls={coverUrls}
        description={copy.categoriesDescription}
        eyebrow={copy.categoriesEyebrow}
        fallbackCoverUrl={fallbackCoverUrl}
        icon={FolderOpen}
        title={copy.categoriesTitle}
      />
      <section className="front-article-page-body front-taxonomy-index-body">
        {isLoading ? (
          <div className="front-loading">
            <Spinner />
          </div>
        ) : categories.length === 0 ? (
          <EmptyState
            description={copy.categoriesDescription}
            icon={<FolderOpen size={24} />}
            title={copy.categoriesTitle}
          />
        ) : (
          <div className="front-taxonomy-grid">
            {categories.map((category, index) => {
              const coverUrl = readTaxonomyFallbackCoverUrl({
                coverUrls,
                fallbackCoverUrl,
                index,
              });

              return (
                <a
                  className="taxonomy-card taxonomy-card--overview"
                  href={`/categories/${category.slug}`}
                  key={category.id}
                  onClick={(event) => {
                    if (isModifiedClick(event)) {
                      return;
                    }

                    event.preventDefault();
                    onNavigate(`/categories/${category.slug}`);
                  }}
                >
                  <Card
                    className="taxonomy-card__surface taxonomy-card__surface--overview"
                    padding={0}
                  >
                    <div className="taxonomy-card__cover">
                      {coverUrl.length > 0 ? (
                        <img alt="" src={resolveFrontAssetUrl(coverUrl)} />
                      ) : (
                        <span>
                          <FolderOpen aria-hidden="true" size={34} />
                        </span>
                      )}
                      <span className="taxonomy-card__cover-mark">
                        <FolderOpen aria-hidden="true" size={28} />
                      </span>
                    </div>
                    <div className="taxonomy-card__content">
                      <Heading level={3}>{readTaxonomyName(category, language)}</Heading>
                      <span className="taxonomy-card__count">
                        <FileText aria-hidden="true" size={15} />
                        {copy.articleCountLabel(category.articleCount)}
                      </span>
                      <Text color="secondary" maxLines={3}>
                        {readTaxonomyDescription(category, language) || copy.categoriesDescription}
                      </Text>
                    </div>
                    <span className="taxonomy-card__footer">
                      {copy.categoryFooter}
                      <ArrowRight aria-hidden="true" size={16} />
                    </span>
                  </Card>
                </a>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}

export function TagsPage({
  coverUrls,
  fallbackCoverUrl,
  language,
  onNavigate,
}: FrontArticlePageProps) {
  const copy = frontArticleCopyByLanguage[language];
  const [tags, setTags] = useState<ArticleTag[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const loadTags = async () => {
      try {
        const result = await getPublicArticleTags();
        if (isMounted) {
          setTags(result.items);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadTags();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <main className="page-shell page-shell--with-front-hero taxonomy-page">
      <FrontPageHero
        coverUrls={coverUrls}
        description={copy.tagsDescription}
        eyebrow={copy.tagsEyebrow}
        fallbackCoverUrl={fallbackCoverUrl}
        icon={Tags}
        title={copy.tagsTitle}
      />
      <section className="front-article-page-body front-taxonomy-index-body">
        {isLoading ? (
          <div className="front-loading">
            <Spinner />
          </div>
        ) : tags.length === 0 ? (
          <EmptyState
            description={copy.tagsDescription}
            icon={<Tags size={24} />}
            title={copy.tagsTitle}
          />
        ) : (
          <div className="front-tag-cloud">
            {tags.map((tag) => (
              <a
                href={`/tags/${tag.slug}`}
                key={tag.id}
                onClick={(event) => {
                  if (isModifiedClick(event)) {
                    return;
                  }

                  event.preventDefault();
                  onNavigate(`/tags/${tag.slug}`);
                }}
                style={{ "--tag-color": tag.color ?? "#ec4899" } as CSSProperties}
              >
                <span className="front-tag-cloud__mark">
                  <Tag aria-hidden="true" size={14} />
                </span>
                <strong>{readTaxonomyName(tag, language)}</strong>
                <small>{tag.articleCount}</small>
              </a>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

type ArchiveMonthGroup = {
  entries: ArticleContent[];
  key: string;
  label: string;
};

type ArchiveYearGroup = {
  key: string;
  label: string;
  months: ArchiveMonthGroup[];
};

export function ArchivesPage({
  coverUrls,
  fallbackCoverUrl,
  language,
  onNavigate,
  timeZone,
}: FrontArticlePageProps) {
  const copy = frontArticleCopyByLanguage[language];
  const [articleList, setArticleList] = useState<ArticleContentList>(() =>
    createEmptyArticleList(),
  );
  const [isLoading, setIsLoading] = useState(true);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const archiveGroups = useMemo<ArchiveYearGroup[]>(() => {
    const sortedArticles = [...articleList.items].sort((firstArticle, secondArticle) => {
      const firstTime = new Date(readArticleTimestamp(firstArticle)).getTime();
      const secondTime = new Date(readArticleTimestamp(secondArticle)).getTime();
      const safeFirstTime = Number.isNaN(firstTime) ? 0 : firstTime;
      const safeSecondTime = Number.isNaN(secondTime) ? 0 : secondTime;

      return sortOrder === "desc" ? safeSecondTime - safeFirstTime : safeFirstTime - safeSecondTime;
    });
    const yearGroups = new Map<string, ArchiveYearGroup>();

    sortedArticles.forEach((article) => {
      const timestamp = readArticleTimestamp(article);
      const year = readYear({
        fallback: language === "en" ? "Unknown" : "未知年份",
        timeZone,
        value: timestamp,
      });
      const month = readMonth({
        fallback: language === "en" ? "Unknown" : "未知月份",
        language,
        timeZone,
        value: timestamp,
      });
      const monthKey = `${year}-${month}`;
      const yearGroup =
        yearGroups.get(year) ??
        ({
          key: year,
          label: year,
          months: [],
        } satisfies ArchiveYearGroup);
      const monthGroup =
        yearGroup.months.find((group) => group.key === monthKey) ??
        ({
          entries: [],
          key: monthKey,
          label: month,
        } satisfies ArchiveMonthGroup);

      if (!yearGroups.has(year)) {
        yearGroups.set(year, yearGroup);
      }

      if (!yearGroup.months.some((group) => group.key === monthKey)) {
        yearGroup.months.push(monthGroup);
      }

      monthGroup.entries.push(article);
    });

    return [...yearGroups.values()];
  }, [articleList.items, language, sortOrder, timeZone]);

  useEffect(() => {
    let isMounted = true;
    const loadArticles = async () => {
      try {
        const result = await getPublicArticles({
          page: 1,
          pageSize: 100,
          query: "",
          sortBy: "publishedAt",
          sortOrder: "desc",
        });
        if (isMounted) {
          setArticleList(result);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadArticles();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <main className="page-shell page-shell--with-front-hero archive-page">
      <FrontPageHero
        coverUrls={coverUrls}
        description={copy.archivesDescription}
        eyebrow={copy.archivesEyebrow}
        fallbackCoverUrl={fallbackCoverUrl}
        icon={Archive}
        title={copy.archivesTitle}
      />
      <section className="front-article-page-body front-archive-body">
        <div className="front-archive-toolbar">
          <ArticleSortSelector
            className="front-article-sort front-archive-sort"
            copy={copy}
            onSortOrderChange={setSortOrder}
            sortOrder={sortOrder}
          />
        </div>
        {isLoading ? (
          <div className="front-loading">
            <Spinner />
          </div>
        ) : archiveGroups.length === 0 ? (
          <EmptyState
            description={copy.archivesDescription}
            icon={<Archive size={24} />}
            title={copy.archivesTitle}
          />
        ) : (
          <div className="archive-list">
            {archiveGroups.map((yearGroup) => (
              <section className="archive-year" key={yearGroup.key}>
                <div className="archive-year__heading">
                  <Heading level={2}>{yearGroup.label}</Heading>
                  <span aria-hidden="true" />
                </div>
                <div className="archive-year__months">
                  {yearGroup.months.map((monthGroup) => (
                    <section className="archive-month" key={monthGroup.key}>
                      <span aria-hidden="true" className="archive-month__dot" />
                      <div className="archive-month__body">
                        <h3 className="archive-month__heading">
                          <CalendarDays aria-hidden="true" size={15} />
                          {monthGroup.label} · {copy.articleCountLabel(monthGroup.entries.length)}
                        </h3>
                        <div className="archive-month__entries">
                          {monthGroup.entries.map((article) => {
                            const content = readArticleContent(article, language);
                            const articleUrl = `/articles/${article.slug}`;
                            const categoryName = readPrimaryCategoryName({
                              article,
                              fallback: copy.articleFallbackTitle,
                              language,
                            });

                            return (
                              <a
                                className="archive-entry"
                                href={articleUrl}
                                key={article.id}
                                onClick={(event) => {
                                  if (isModifiedClick(event)) {
                                    return;
                                  }

                                  event.preventDefault();
                                  onNavigate(articleUrl);
                                }}
                              >
                                <span className="archive-entry__day">
                                  {readDay({
                                    fallback: "--",
                                    timeZone,
                                    value: readArticleTimestamp(article),
                                  })}
                                </span>
                                <span className="archive-entry__main">
                                  <strong className="archive-entry__title">{content.title}</strong>
                                  <span className="archive-entry__excerpt">
                                    {readArticleExcerpt({ article, language }) ||
                                      copy.articleListDescription}
                                  </span>
                                </span>
                                <span className="archive-entry__chips">
                                  <span className="archive-entry__chip archive-entry__chip--category">
                                    <FolderOpen aria-hidden="true" size={13} />
                                    {categoryName}
                                  </span>
                                  {article.tags.slice(0, 4).map((tag) => (
                                    <span
                                      className="archive-entry__chip archive-entry__chip--tag"
                                      key={tag.id}
                                      style={
                                        {
                                          "--archive-tag-color": tag.color ?? "#ec4899",
                                        } as CSSProperties
                                      }
                                    >
                                      #{readRelationName(tag, language)}
                                    </span>
                                  ))}
                                </span>
                              </a>
                            );
                          })}
                        </div>
                      </div>
                    </section>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

type ArticleDetailBreadcrumbsProps = {
  copy: FrontArticleCopy;
  isMobile: boolean;
  isMobileTocOpen: boolean;
  onMobileTocSelect: (id: string) => void;
  onMobileTocToggle: () => void;
  onNavigate: (path: string) => void;
  outlineItems: ReturnType<typeof parseArticleToc>;
  title: string;
};

function ArticleDetailBreadcrumbs({
  copy,
  isMobile,
  isMobileTocOpen,
  onMobileTocSelect,
  onMobileTocToggle,
  onNavigate,
  outlineItems,
  title,
}: ArticleDetailBreadcrumbsProps) {
  return (
    <nav aria-label={copy.breadcrumbLabel} className="article-detail-breadcrumbs">
      <span className="article-detail-breadcrumbs__trail">
        <button
          onClick={() => {
            onNavigate("/");
          }}
          type="button"
        >
          <Home aria-hidden="true" size={17} />
          <span>{copy.breadcrumbHome}</span>
        </button>
        <ChevronRight
          aria-hidden="true"
          className="article-detail-breadcrumbs__separator"
          size={16}
        />
        <button
          onClick={() => {
            onNavigate("/articles");
          }}
          type="button"
        >
          <FileText aria-hidden="true" size={17} />
          <span>{copy.breadcrumbArticles}</span>
        </button>
        <ChevronRight
          aria-hidden="true"
          className="article-detail-breadcrumbs__separator"
          size={16}
        />
        <span className="article-detail-breadcrumbs__current">{title}</span>
      </span>
      {isMobile ? (
        <span className="article-detail-breadcrumbs__toc">
          <button
            aria-expanded={isMobileTocOpen}
            aria-label={copy.toc}
            className="article-detail-breadcrumbs__toc-button"
            onClick={onMobileTocToggle}
            type="button"
          >
            <List aria-hidden="true" size={18} />
          </button>
          {isMobileTocOpen ? (
            <span aria-label={copy.toc} className="article-detail-mobile-toc" role="dialog">
              <strong>{copy.toc}</strong>
              {outlineItems.length === 0 ? (
                <span>{copy.tocEmpty}</span>
              ) : (
                <span className="article-detail-mobile-toc__links">
                  {outlineItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        onMobileTocSelect(item.id);
                      }}
                      type="button"
                    >
                      {item.label}
                    </button>
                  ))}
                </span>
              )}
            </span>
          ) : null}
        </span>
      ) : null}
    </nav>
  );
}

type ArticleContributorStripProps = {
  contributors: ArticleContributorRelation[];
  copy: FrontArticleCopy;
};

function ArticleContributorStrip({ contributors, copy }: ArticleContributorStripProps) {
  if (contributors.length === 0) {
    return null;
  }

  return (
    <Card className="article-contributors-card" padding={4}>
      <div className="article-section-heading">
        <UsersRound aria-hidden="true" size={18} />
        <Heading level={2}>{copy.contributorsTitle}</Heading>
      </div>
      <div className="article-contributors-list">
        {contributors.map((contributor) => {
          const linkUrl = readContributorLinkUrl(contributor);
          const contributorContent = (
            <>
              <Avatar
                name={contributor.name}
                shape="circle"
                size={40}
                src={readContributorAvatarUrl(contributor)}
              />
              <span>{contributor.name}</span>
            </>
          );

          return linkUrl === undefined ? (
            <span className="article-contributor-chip" key={contributor.id}>
              {contributorContent}
            </span>
          ) : (
            <a
              className="article-contributor-chip"
              href={linkUrl}
              key={contributor.id}
              rel="noreferrer"
              target="_blank"
            >
              {contributorContent}
            </a>
          );
        })}
      </div>
    </Card>
  );
}

type ArticleCommentThreadProps = {
  activeReplyTargetId?: string;
  comment: CommentItem;
  commentsByParent: Map<string | null, CommentItem[]>;
  copy: FrontArticleCopy;
  depth?: number;
  language: AppLanguage;
  onReply?: (comment: CommentItem) => void;
  replyComposer?: ReactNode;
  timeZone: string;
};

type ArticleCommentContentProps = {
  content: string;
};

function ArticleCommentContent({ content }: ArticleCommentContentProps) {
  const parts = parseCommentContent(content);

  return (
    <div className="article-comment-content">
      {parts.map((part, index) => {
        if (part.kind === "image") {
          const imageUrl = resolveFrontAssetUrl(part.url);

          return imageUrl.length > 0 ? (
            <PhotoView key={`${part.url}-${index}`} src={imageUrl}>
              <button
                aria-label={`预览图片：${part.alt || "评论图片"}`}
                className="article-comment-image"
                type="button"
              >
                <img alt={part.alt} loading="lazy" src={imageUrl} />
              </button>
            </PhotoView>
          ) : null;
        }

        const text = part.value.trim();
        if (text.length === 0) {
          return null;
        }

        const lines = text.split("\n");

        return (
          <p className="article-comment-text" key={`${text}-${index}`}>
            {lines.map((line, lineIndex) => (
              <span key={`${line}-${lineIndex}`}>
                {line}
                {lineIndex < lines.length - 1 ? <br /> : null}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}

function ArticleCommentThread({
  activeReplyTargetId,
  comment,
  commentsByParent,
  copy,
  depth = 0,
  language,
  onReply,
  replyComposer,
  timeZone,
}: ArticleCommentThreadProps) {
  const authorName = readCommentAuthorName(comment);
  const authorLinkUrl = getSafeLinkUrl(comment.author.blogUrl);
  const replies = commentsByParent.get(comment.id) ?? [];
  const location = comment.location?.trim() || copy.commentsLocationFallback;
  const timestamp = readDateTime({
    language,
    timeZone,
    value: comment.createdAt,
  });
  const footer =
    onReply === undefined ? null : (
      <button
        className="article-comment-reply-button"
        onClick={() => {
          onReply(comment);
        }}
        type="button"
      >
        <Reply aria-hidden="true" size={13} />
        {copy.commentsReply}
      </button>
    );

  return (
    <div
      className="article-comment-thread"
      style={{ "--article-comment-depth": Math.min(depth, 4) } as CSSProperties}
    >
      <article className="article-comment-card">
        <Avatar
          className="article-comment-avatar"
          name={authorName}
          shape="circle"
          size="sm"
          src={readCommentAvatarUrl(comment)}
        />
        <div className="article-comment-body">
          <header className="article-comment-header">
            <div className="article-comment-author">
              <div className="article-comment-author-row">
                {authorLinkUrl === undefined ? (
                  <strong>{authorName}</strong>
                ) : (
                  <a href={authorLinkUrl} rel="noreferrer" target="_blank">
                    {authorName}
                  </a>
                )}
              </div>
              {comment.author.tags.length === 0 ? null : (
                <div className="article-comment-author-tags">
                  {comment.author.tags.map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>
              )}
              <div className="article-comment-meta">
                <time>{timestamp}</time>
                <span>{location}</span>
              </div>
            </div>
          </header>
          <ArticleCommentContent content={comment.content} />
          {footer === null ? null : <footer className="article-comment-footer">{footer}</footer>}
        </div>
      </article>
      {activeReplyTargetId === comment.id && replyComposer !== undefined ? replyComposer : null}
      {replies.length > 0 ? (
        <div className="article-comment-replies">
          {replies.map((reply) => (
            <ArticleCommentThread
              activeReplyTargetId={activeReplyTargetId}
              comment={reply}
              commentsByParent={commentsByParent}
              copy={copy}
              depth={depth + 1}
              key={reply.id}
              language={language}
              onReply={onReply}
              replyComposer={replyComposer}
              timeZone={timeZone}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

type ArticleCommentComposerProps = {
  uploads: readonly UploadProgress[];
  copy: FrontArticleCopy;
  draft: string;
  images: readonly UploadedCommentImage[];
  isAuthenticated: boolean;
  isDisabled: boolean;
  isUploadingImage: boolean;
  language: AppLanguage;
  onChange: (value: string) => void;
  onImageRemove: (imageId: string) => void;
  onImageUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  onOpenAuth: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  placeholder: string;
  submitLabel: string;
  variant?: "reply" | "root";
};

function ArticleCommentComposer({
  uploads,
  copy,
  draft,
  images,
  isAuthenticated,
  isDisabled,
  isUploadingImage,
  language,
  onChange,
  onImageRemove,
  onImageUpload,
  onOpenAuth,
  onSubmit,
  placeholder,
  submitLabel,
  variant = "root",
}: ArticleCommentComposerProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const effectiveSubmitLabel = isDisabled ? copy.commentsSending : submitLabel;

  return (
    <form
      className={`article-comment-composer article-comment-composer--${variant}`}
      onSubmit={onSubmit}
    >
      <label className="article-comment-composer__label">{copy.commentsComposerLabel}</label>
      <div className="article-comment-composer__box">
        <TextArea
          className="article-comment-composer__textarea"
          isLabelHidden
          label={copy.commentsPlaceholder}
          onChange={onChange}
          placeholder={placeholder}
          rows={4}
          value={draft}
        />
        <div className="article-comment-composer__toolbar">
          <div className="article-comment-composer__tools">
            <input
              accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
              hidden
              multiple
              onChange={onImageUpload}
              ref={fileInputRef}
              type="file"
            />
            <Button
              icon={<ImagePlus aria-hidden="true" size={16} />}
              isDisabled={isUploadingImage}
              isIconOnly
              label={isUploadingImage ? copy.commentsImageUploading : copy.commentsImageUpload}
              onClick={() => {
                if (!isAuthenticated) {
                  onOpenAuth();
                  return;
                }

                fileInputRef.current?.click();
              }}
              size="sm"
              variant="ghost"
            />
            <Popover
              alignment="start"
              content={
                <div className="article-comment-emoji-picker">
                  <EmojiPicker
                    autoFocusSearch={false}
                    emojiData={language === "en" ? undefined : zhEmojiData}
                    emojiStyle={EmojiStyle.NATIVE}
                    height={360}
                    lazyLoadEmojis
                    onEmojiClick={(emoji: EmojiClickData) => {
                      onChange(`${draft}${emoji.emoji}`);
                    }}
                    previewConfig={{ showPreview: false }}
                    searchPlaceholder={language === "en" ? "Search Emoji" : "搜索 Emoji"}
                    theme={language === "en" ? EmojiTheme.LIGHT : EmojiTheme.AUTO}
                    width={320}
                  />
                </div>
              }
              label="Emoji"
              placement="above"
            >
              <Button
                icon={<Smile aria-hidden="true" size={16} />}
                isIconOnly
                label="Emoji"
                size="sm"
                variant="ghost"
              />
            </Popover>
          </div>
          <div className="article-comment-composer__actions">
            {isAuthenticated ? null : (
              <Button
                label={copy.commentsLogin}
                onClick={onOpenAuth}
                size="sm"
                variant="secondary"
              />
            )}
            <Button
              className="article-comment-composer__submit"
              icon={<Send aria-hidden="true" size={15} />}
              isDisabled={isDisabled}
              isIconOnly
              label={effectiveSubmitLabel}
              size="sm"
              type="submit"
            />
          </div>
        </div>
      </div>
      <UploadProgressList language={language} uploads={uploads} />
      {images.length > 0 ? (
        <div className="article-comment-image-list">
          {images.map((image) => {
            const imageUrl = resolveFrontAssetUrl(image.url);

            return (
              <div className="article-comment-image-item" key={image.id}>
                <PhotoView src={imageUrl}>
                  <button
                    aria-label={`预览图片：${image.name}`}
                    className="article-comment-image-item__preview"
                    type="button"
                  >
                    <img alt={image.name} src={imageUrl} />
                  </button>
                </PhotoView>
                <span>{image.name}</span>
                <button
                  aria-label={`${copy.commentsImageRemove} ${image.name}`}
                  className="article-comment-image-item__remove"
                  onClick={() => {
                    onImageRemove(image.id);
                  }}
                  type="button"
                >
                  <X aria-hidden="true" size={13} />
                </button>
              </div>
            );
          })}
        </div>
      ) : null}
    </form>
  );
}

type PublicCommentsSectionBaseProps = {
  authUser: BlogUser | null;
  commentsEnabled: boolean;
  copy: FrontArticleCopy;
  language: AppLanguage;
  onFeedback: (feedback: AltchaFeedback) => void;
  onOpenAuth: () => void;
  timeZone: string;
};

type PublicCommentsSectionProps =
  | (PublicCommentsSectionBaseProps & {
      article: ArticleContent;
      target: "article";
    })
  | (PublicCommentsSectionBaseProps & {
      target: "guestbook";
    });

const getCommentTargetCopy = ({
  copy,
  target,
}: {
  copy: FrontArticleCopy;
  target: "article" | "guestbook";
}): FrontArticleCopy => {
  if (target === "article") {
    return copy;
  }

  return {
    ...copy,
    commentsComposerLabel: copy.guestbookComposerLabel,
    commentsEmpty: copy.guestbookEmpty,
    commentsPanelDescription: copy.guestbookPanelDescription,
    commentsPlaceholder: copy.guestbookPlaceholder,
    commentsPublicCountLabel: copy.guestbookPublicCountLabel,
    commentsReply: copy.guestbookReply,
    commentsSend: copy.guestbookSend,
    commentsTitle: copy.guestbookThreadTitle,
  };
};

function PublicCommentsSection(props: PublicCommentsSectionProps) {
  const { uploads, onUploadProgress } = useUploadProgress();
  const { authUser, commentsEnabled, copy, language, onFeedback, onOpenAuth, timeZone } = props;
  const target = props.target;
  const articleSlug = target === "article" ? props.article.slug : undefined;
  const commentCopy = useMemo(() => getCommentTargetCopy({ copy, target }), [copy, target]);
  const [commentList, setCommentList] = useState<CommentList>(() => createEmptyCommentList());
  const [draft, setDraft] = useState("");
  const [uploadedImages, setUploadedImages] = useState<UploadedCommentImage[]>([]);
  const [errorMessage, setErrorMessage] = useState<string>();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [replyTarget, setReplyTarget] = useState<CommentItem | null>(null);
  const [sortOrder, setSortOrder] = useState<CommentSortOrder>("latest");
  const { dialog: commentAltchaDialog, runWithAltcha } = useAltchaVerificationDialog({
    copy: getAltchaVerificationDialogCopy(language),
    language,
    onFeedback,
    scopeKey: `${target}:${articleSlug ?? ""}:${authUser?.id ?? ""}:${commentsEnabled}`,
  });

  const loadComments = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(undefined);
    try {
      const nextCommentList =
        target === "article" && articleSlug !== undefined
          ? await getPublicArticleComments({
              articleSlug,
              locale: language,
              page: 1,
              pageSize: COMMENT_PAGE_SIZE,
            })
          : await getPublicGuestbookComments({
              locale: language,
              page: 1,
              pageSize: COMMENT_PAGE_SIZE,
            });
      setCommentList(nextCommentList);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : commentCopy.commentsError);
      setCommentList(createEmptyCommentList());
    } finally {
      setIsLoading(false);
    }
  }, [articleSlug, commentCopy.commentsError, language, target]);

  useEffect(() => {
    void loadComments();
  }, [loadComments]);

  const sortedComments = useMemo(
    () =>
      sortComments({
        comments: commentList.items,
        sortOrder,
      }),
    [commentList.items, sortOrder],
  );

  const commentsByParent = useMemo(() => {
    const nextCommentsByParent = new Map<string | null, CommentItem[]>();

    for (const comment of sortedComments) {
      const currentReplies = nextCommentsByParent.get(comment.parentId) ?? [];
      currentReplies.push(comment);
      nextCommentsByParent.set(comment.parentId, currentReplies);
    }

    return nextCommentsByParent;
  }, [sortedComments]);

  const rootComments = commentsByParent.get(null) ?? [];
  const commentCount = commentList.pageInfo.totalItems;
  const replyTargetName =
    !commentsEnabled || replyTarget === null ? undefined : readCommentAuthorName(replyTarget);
  const replyTargetId = commentsEnabled ? replyTarget?.id : undefined;

  const removeUploadedImage = (imageId: string) => {
    setUploadedImages((currentImages) => currentImages.filter((image) => image.id !== imageId));
  };

  const uploadCommentImages = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = "";

    if (!commentsEnabled || files.length === 0) {
      return;
    }

    if (authUser === null) {
      onOpenAuth();
      return;
    }

    setIsUploadingImage(true);
    setErrorMessage(undefined);
    try {
      const nextImages = await Promise.all(
        files.map(async (file) => ({
          id: createCommentUploadId(file),
          name: file.name,
          url: await uploadPublicCommentImage({ file, onUploadProgress }),
        })),
      );
      setUploadedImages((currentImages) => [...currentImages, ...nextImages]);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : commentCopy.commentsError);
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!commentsEnabled || submittingRef.current) {
      return;
    }
    const content = buildCommentContent({ images: uploadedImages, text: draft });
    if (content.length === 0) {
      return;
    }

    if (authUser === null) {
      onOpenAuth();
      return;
    }

    submittingRef.current = true;
    setIsSubmitting(true);
    setErrorMessage(undefined);
    try {
      const action = await runWithAltcha({
        runAction: (altcha) =>
          target === "article" && articleSlug !== undefined
            ? createPublicArticleComment({
                altcha,
                articleSlug,
                content,
                locale: language,
                parentId: replyTarget?.id ?? null,
              })
            : createPublicGuestbookComment({
                altcha,
                content,
                locale: language,
                parentId: replyTarget?.id ?? null,
              }),
        successMessage: getAltchaSuccessMessage(
          language,
          target === "article"
            ? replyTarget === null
              ? "comment"
              : "reply"
            : replyTarget === null
              ? "message"
              : "message-reply",
        ),
      });
      if (action.status === "cancelled") {
        return;
      }
      const nextComment = action.value;
      setCommentList((current) => ({
        ...current,
        items: [...current.items, nextComment],
        pageInfo: {
          ...current.pageInfo,
          totalItems: current.pageInfo.totalItems + 1,
        },
      }));
      setDraft("");
      setUploadedImages([]);
      setReplyTarget(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : commentCopy.commentsError);
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const composerStatus =
    errorMessage === undefined
      ? undefined
      : {
          message: errorMessage,
          type: "error" as const,
        };
  const replyComposer =
    replyTargetName === undefined ? undefined : (
      <div className="article-comment-inline-composer">
        <div className="article-comment-reply-target">
          <Reply aria-hidden="true" size={14} />
          <span>{commentCopy.commentsReplyingTo(replyTargetName)}</span>
          <button
            aria-label={commentCopy.commentsReplyCancel}
            onClick={() => {
              setReplyTarget(null);
            }}
            type="button"
          >
            <X aria-hidden="true" size={14} />
          </button>
        </div>
        <ArticleCommentComposer
          uploads={uploads}
          copy={commentCopy}
          draft={draft}
          images={uploadedImages}
          isAuthenticated={authUser !== null}
          isDisabled={isSubmitting || isUploadingImage}
          isUploadingImage={isUploadingImage}
          language={language}
          onChange={setDraft}
          onImageRemove={removeUploadedImage}
          onImageUpload={uploadCommentImages}
          onOpenAuth={onOpenAuth}
          onSubmit={handleSubmit}
          placeholder={
            authUser === null ? commentCopy.commentsLogin : commentCopy.commentsPlaceholder
          }
          submitLabel={commentCopy.commentsReply}
          variant="reply"
        />
      </div>
    );

  return (
    <>
      {commentAltchaDialog}
      <Card className="article-comments-card" id="comments" padding={0}>
        <div className="article-comments-header">
          <div className="article-comments-title">
            <div className="article-section-heading">
              <MessageCircle aria-hidden="true" size={18} />
              <Heading level={2}>{commentCopy.commentsTitle}</Heading>
            </div>
            <Text color="secondary" type="supporting">
              {commentCopy.commentsPanelDescription}
            </Text>
          </div>
          <div className="article-comments-toolbar">
            <span>{commentCopy.commentsPublicCountLabel(commentCount)}</span>
            <div className="article-comments-sort" role="group" aria-label={commentCopy.sortLabel}>
              <Button
                label={commentCopy.commentsLatest}
                onClick={() => {
                  setSortOrder("latest");
                }}
                size="sm"
                variant={sortOrder === "latest" ? "primary" : "secondary"}
              />
              <Button
                label={commentCopy.commentsOldest}
                onClick={() => {
                  setSortOrder("oldest");
                }}
                size="sm"
                variant={sortOrder === "oldest" ? "primary" : "secondary"}
              />
            </div>
          </div>
        </div>
        <div className="article-comments-list">
          {isLoading ? (
            <div className="article-comments-state">
              <Spinner />
              <span>{commentCopy.refresh}</span>
            </div>
          ) : rootComments.length === 0 ? (
            <div className="article-comments-state">{commentCopy.commentsEmpty}</div>
          ) : (
            rootComments.map((comment) => (
              <ArticleCommentThread
                activeReplyTargetId={replyTargetId}
                comment={comment}
                commentsByParent={commentsByParent}
                copy={commentCopy}
                key={comment.id}
                language={language}
                onReply={commentsEnabled ? setReplyTarget : undefined}
                replyComposer={replyComposer}
                timeZone={timeZone}
              />
            ))
          )}
        </div>
        {composerStatus === undefined ? null : (
          <div className="front-feedback-banner">
            <Banner container="card" status={composerStatus.type} title={composerStatus.message} />
          </div>
        )}
        {!commentsEnabled ? (
          <Text className="article-comments-state" color="secondary" role="status">
            {commentCopy.commentsClosed}
          </Text>
        ) : replyTargetId === undefined ? (
          <ArticleCommentComposer
            uploads={uploads}
            copy={commentCopy}
            draft={draft}
            images={uploadedImages}
            isAuthenticated={authUser !== null}
            isDisabled={isSubmitting || isUploadingImage}
            isUploadingImage={isUploadingImage}
            language={language}
            onChange={setDraft}
            onImageRemove={removeUploadedImage}
            onImageUpload={uploadCommentImages}
            onOpenAuth={onOpenAuth}
            onSubmit={handleSubmit}
            placeholder={
              authUser === null ? commentCopy.commentsLogin : commentCopy.commentsPlaceholder
            }
            submitLabel={commentCopy.commentsSend}
          />
        ) : null}
      </Card>
    </>
  );
}

type GuestbookGuidelineCardProps = {
  item: GuestbookGuidelineItem;
};

function GuestbookGuidelineCard({ item }: GuestbookGuidelineCardProps) {
  return (
    <Card className="guestbook-guideline-card" padding={4}>
      <span className="guestbook-guideline-card__icon">{item.icon}</span>
      <div className="guestbook-guideline-card__body">
        <Heading level={3}>{item.title}</Heading>
        <Text as="p" color="secondary" type="supporting">
          {item.description}
        </Text>
      </div>
    </Card>
  );
}

export function GuestbookPage({
  authUser,
  commentsEnabled,
  coverUrls,
  fallbackCoverUrl,
  language,
  onFeedback,
  onOpenAuth,
  timeZone,
}: GuestbookPageProps) {
  const copy = frontArticleCopyByLanguage[language];
  const guidelines = guestbookGuidelinesByLanguage[language];

  return (
    <main className="page-shell page-shell--with-front-hero guestbook-page">
      <FrontPageHero
        coverUrls={coverUrls}
        description={copy.guestbookDescription}
        eyebrow={copy.guestbookEyebrow}
        fallbackCoverUrl={fallbackCoverUrl}
        icon={MessageSquareText}
        title={copy.guestbookTitle}
      />
      <section className="guestbook-page-body">
        <section className="guestbook-guidelines" aria-labelledby="guestbook-guidelines-title">
          <div className="guestbook-section-heading">
            <Sparkles aria-hidden="true" size={22} />
            <Heading id="guestbook-guidelines-title" level={2}>
              {copy.guestbookGuidelinesTitle}
            </Heading>
          </div>
          <div className="guestbook-guideline-grid">
            {guidelines.map((item) => (
              <GuestbookGuidelineCard item={item} key={item.title} />
            ))}
          </div>
        </section>
        <PhotoProvider>
          <section className="guestbook-comments-section">
            <PublicCommentsSection
              authUser={authUser}
              commentsEnabled={commentsEnabled}
              copy={copy}
              language={language}
              onFeedback={onFeedback}
              onOpenAuth={onOpenAuth}
              target="guestbook"
              timeZone={timeZone}
            />
          </section>
        </PhotoProvider>
      </section>
    </main>
  );
}

export function ArticleDetailPage({
  authUser,
  commentsEnabled,
  language,
  onFeedback,
  onOpenAuth,
  onNavigate,
  slug,
  timeZone,
}: ArticleDetailPageProps) {
  const copy = frontArticleCopyByLanguage[language];
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [article, setArticle] = useState<ArticleContent>();
  const [errorMessage, setErrorMessage] = useState<string>();
  const [isMobileTocOpen, setIsMobileTocOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const content = article === undefined ? undefined : readArticleContent(article, language);
  const outlineItems = useMemo(
    () => (content === undefined ? [] : parseArticleToc(content.contentMdx)),
    [content],
  );
  const handleMobileTocSelect = useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
    setIsMobileTocOpen(false);
  }, []);

  const handleScrollToTop = useCallback(() => {
    window.scrollTo({ behavior: "smooth", top: 0 });
  }, []);

  useEffect(() => {
    let isMounted = true;
    const loadArticle = async () => {
      setIsLoading(true);
      setErrorMessage(undefined);
      try {
        const nextArticle = await getPublicArticle(slug);
        if (isMounted) {
          setArticle(nextArticle);
        }
      } catch (error) {
        if (isMounted) {
          setErrorMessage(error instanceof Error ? error.message : copy.articleError);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadArticle();

    return () => {
      isMounted = false;
    };
  }, [copy.articleError, slug]);

  useEffect(() => {
    if (!isMobile) {
      setIsMobileTocOpen(false);
    }
  }, [isMobile]);

  const title = content?.title ?? copy.articleFallbackTitle;

  return (
    <main className="page-shell article-detail-page">
      {isLoading ? (
        <div className="front-loading">
          <Spinner />
        </div>
      ) : errorMessage !== undefined || article === undefined || content === undefined ? (
        <section className="front-article-page-body">
          <EmptyState
            description={errorMessage ?? copy.articleError}
            icon={<FileText size={24} />}
            title={copy.articleError}
          />
        </section>
      ) : (
        <>
          <ArticleDetailBreadcrumbs
            copy={copy}
            isMobile={isMobile}
            isMobileTocOpen={isMobileTocOpen}
            onMobileTocSelect={handleMobileTocSelect}
            onMobileTocToggle={() => {
              setIsMobileTocOpen((currentValue) => !currentValue);
            }}
            onNavigate={onNavigate}
            outlineItems={outlineItems}
            title={title}
          />
          <Layout
            contentWidth={960}
            end={
              isMobile || outlineItems.length === 0 ? undefined : (
                <LayoutPanel
                  className="article-detail-toc"
                  isScrollable={false}
                  label={copy.toc}
                  role="complementary"
                >
                  <Outline items={outlineItems} label={copy.toc} />
                </LayoutPanel>
              )
            }
            height="auto"
            content={
              <LayoutContent
                className="article-detail-layout"
                isScrollable={false}
                padding={isMobile ? 4 : 8}
              >
                <PhotoProvider>
                  <VStack gap={5}>
                    <header className="article-detail-header">
                      <h1>{title}</h1>
                      <div className="article-detail-header__meta">
                        <time>
                          {readDate({
                            language,
                            timeZone,
                            value: readArticleTimestamp(article),
                          })}
                        </time>
                        <span>{readArticleReadingTime({ article, language })}</span>
                        <span>{copy.readCount(article.readCount)}</span>
                      </div>
                      <div className="article-detail-header__chips">
                        {article.categories.map((category) => (
                          <Badge
                            key={category.id}
                            label={category.localizations[language === "en" ? "en" : "zhCN"].name}
                          />
                        ))}
                        {article.tags.map((tag) => (
                          <Badge
                            className="article-detail-header__tag"
                            key={tag.id}
                            label={`#${tag.localizations[language === "en" ? "en" : "zhCN"].name}`}
                            style={
                              { "--article-tag-color": tag.color ?? "#ec4899" } as CSSProperties
                            }
                          />
                        ))}
                      </div>
                    </header>
                    <ArticleMdxContent content={content.contentMdx} language={language} />
                    <Button
                      label={language === "en" ? "Back to articles" : "返回全部文章"}
                      onClick={() => onNavigate("/articles")}
                      variant="secondary"
                    />
                    <ArticleContributorStrip contributors={article.contributors} copy={copy} />
                    {commentsEnabled ? (
                      <PublicCommentsSection
                        article={article}
                        authUser={authUser}
                        commentsEnabled={commentsEnabled}
                        copy={copy}
                        language={language}
                        onFeedback={onFeedback}
                        onOpenAuth={onOpenAuth}
                        target="article"
                        timeZone={timeZone}
                      />
                    ) : null}
                  </VStack>
                </PhotoProvider>
              </LayoutContent>
            }
          />
          <button
            aria-label={copy.backToTop}
            className="article-detail-back-to-top"
            onClick={handleScrollToTop}
            title={copy.backToTop}
            type="button"
          >
            <ArrowUp aria-hidden="true" size={20} />
          </button>
        </>
      )}
    </main>
  );
}
