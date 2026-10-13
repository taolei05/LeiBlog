import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import {
  Archive,
  ArrowUpRight,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  Database,
  FileText,
  Image,
  MessageSquareText,
  PenLine,
  RefreshCcw,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";

import { Badge } from "@astryxdesign/core/Badge";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { Divider } from "@astryxdesign/core/Divider";
import { Grid } from "@astryxdesign/core/Grid";
import { IconButton } from "@astryxdesign/core/IconButton";
import { HStack, StackItem, VStack } from "@astryxdesign/core/Stack";
import { Heading, Text } from "@astryxdesign/core/Text";

import type {
  AdminUser,
  ArticleContent,
  ArticleContentList,
  CommentItem,
  CommentList,
  MediaLibraryList,
  SiteSettings,
  UserManagementList,
} from "../../../../shared/admin-api";
import {
  getAdminArticles,
  getAdminComments,
  getManagedUsers,
  getMediaAssets,
} from "../../../../shared/admin-api";
import type { AppLanguage } from "../../../../shared/i18n";
import { formatDateTimeInTimeZone } from "../../../../shared/time-zone";

type AdminDashboardTargetPage =
  | "backups"
  | "comments"
  | "media"
  | "navigation"
  | "posts"
  | "site-settings"
  | "users";

type AdminDashboardPageProps = {
  readonly authToken: string;
  readonly isNarrow: boolean;
  readonly language: AppLanguage;
  readonly siteSettings?: SiteSettings;
  readonly timeZone: string;
  readonly user: AdminUser;
  readonly onOpenBlog: () => void;
  readonly onPageChange: (pageId: AdminDashboardTargetPage) => void;
};

type AdminDashboardData = {
  readonly articles: ArticleContentList;
  readonly comments: CommentList;
  readonly draftArticles: ArticleContentList;
  readonly media: MediaLibraryList;
  readonly pendingComments: CommentList;
  readonly publishedArticles: ArticleContentList;
  readonly scheduledArticles: ArticleContentList;
  readonly users: UserManagementList;
};

type DashboardCopy = {
  readonly actions: {
    readonly backup: string;
    readonly comments: string;
    readonly media: string;
    readonly openBlog: string;
    readonly refresh: string;
    readonly settings: string;
    readonly users: string;
    readonly write: string;
  };
  readonly articleStatus: Record<ArticleContent["status"], string>;
  readonly comments: {
    readonly approved: string;
    readonly guestbook: string;
    readonly latest: string;
    readonly pending: string;
    readonly rejected: string;
    readonly title: string;
  };
  readonly empty: {
    readonly comments: string;
    readonly items: string;
    readonly recent: string;
  };
  readonly focus: {
    readonly commentsClear: string;
    readonly commentsClearDetail: string;
    readonly commentsDetail: string;
    readonly commentsPending: string;
    readonly draftDetail: string;
    readonly draftReady: string;
    readonly draftWaiting: string;
    readonly localStorage: string;
    readonly mediaDetail: string;
    readonly mediaReady: string;
    readonly r2Storage: string;
    readonly settingsDetail: string;
    readonly settingsReady: string;
    readonly settingsTodo: string;
    readonly title: string;
  };
  readonly hero: {
    readonly badge: string;
    readonly description: string;
    readonly greeting: string;
    readonly storageLocal: string;
    readonly storageR2: string;
    readonly subtitle: string;
    readonly title: string;
  };
  readonly loading: string;
  readonly metrics: {
    readonly administrators: string;
    readonly articles: string;
    readonly articlesDescription: string;
    readonly comments: string;
    readonly commentsDescription: string;
    readonly media: string;
    readonly mediaDescription: string;
    readonly subscribers: string;
    readonly users: string;
    readonly usersDescription: string;
  };
  readonly recent: {
    readonly comments: string;
    readonly content: string;
    readonly read: string;
    readonly pinned: string;
    readonly title: string;
    readonly updated: string;
  };
  readonly snapshot: {
    readonly admin: string;
    readonly comments: string;
    readonly commentsOff: string;
    readonly commentsOn: string;
    readonly deepl: string;
    readonly deeplMissing: string;
    readonly deeplReady: string;
    readonly storage: string;
    readonly title: string;
    readonly timezone: string;
  };
};

type DashboardMetricCardProps = {
  readonly accentColor: string;
  readonly description: string;
  readonly icon: ReactNode;
  readonly label: string;
  readonly value: string;
};

type DashboardFocusItemProps = {
  readonly description: string;
  readonly icon: ReactNode;
  readonly label: string;
  readonly variant: "neutral" | "pink" | "success";
  readonly onClick: () => void;
};

type DashboardRecentArticleProps = {
  readonly article: ArticleContent;
  readonly fallback: string;
  readonly language: AppLanguage;
  readonly timeZone: string;
};

type DashboardRecentCommentProps = {
  readonly comment: CommentItem;
  readonly fallback: string;
  readonly timeZone: string;
  readonly language: AppLanguage;
};

const DASHBOARD_PAGE_SIZE = 5;

const DASHBOARD_COPY_BY_LANGUAGE: Record<AppLanguage, DashboardCopy> = {
  "zh-CN": {
    actions: {
      backup: "全站备份",
      comments: "处理评论",
      media: "整理媒体",
      openBlog: "打开前台",
      refresh: "刷新数据",
      settings: "站点设置",
      users: "用户管理",
      write: "写文章",
    },
    articleStatus: {
      draft: "草稿",
      published: "已发布",
      scheduled: "定时",
    },
    comments: {
      approved: "已通过",
      guestbook: "留言板",
      latest: "最新评论",
      pending: "待审核",
      rejected: "已拒绝",
      title: "评论动向",
    },
    empty: {
      comments: "还没有新的评论。",
      items: "暂无需要处理的事项。",
      recent: "还没有文章记录。",
    },
    focus: {
      commentsClear: "评论队列很干净",
      commentsClearDetail: "没有待审核评论，可以继续发布内容。",
      commentsDetail: "优先审核公开评论，避免前台互动卡住。",
      commentsPending: "有评论等待审核",
      draftDetail: "草稿和定时文章需要检查标题、封面和发布时间。",
      draftReady: "文章发布节奏稳定",
      draftWaiting: "文章队列需要收口",
      localStorage: "当前使用本地媒体存储",
      mediaDetail: "媒体文件会保存在本机上传目录，适合开发和小规模站点。",
      mediaReady: "媒体存储已接入 R2",
      r2Storage: "Cloudflare R2 已启用，适合公开资源分发。",
      settingsDetail: "站点 Logo、封面图或基础集成还有未配置项。",
      settingsReady: "站点资料完整",
      settingsTodo: "站点资料还可以补齐",
      title: "今天优先看这里",
    },
    hero: {
      badge: "运营总览",
      description: "文章、评论、媒体、用户和站点配置汇总在一个页面，适合登录后先扫一眼。",
      greeting: "你好，",
      storageLocal: "本地存储",
      storageR2: "R2 存储",
      subtitle: "实时读取后台数据",
      title: "后台工作台",
    },
    loading: "读取中",
    metrics: {
      administrators: "管理员",
      articles: "文章总数",
      articlesDescription: "已发布、草稿和定时内容",
      comments: "待审核评论",
      commentsDescription: "优先处理公开互动",
      media: "媒体资源",
      mediaDescription: "图片、视频和文档总量",
      subscribers: "订阅提醒",
      users: "注册用户",
      usersDescription: "管理员、读者和订阅提醒",
    },
    recent: {
      comments: "条评论",
      content: "最近内容",
      pinned: "置顶",
      read: "阅读",
      title: "最近更新",
      updated: "更新于",
    },
    snapshot: {
      admin: "当前管理员",
      comments: "评论开关",
      commentsOff: "已关闭",
      commentsOn: "已开启",
      deepl: "DeepL 翻译",
      deeplMissing: "未配置",
      deeplReady: "已配置",
      storage: "媒体存储",
      title: "系统快照",
      timezone: "站点时区",
    },
  },
  en: {
    actions: {
      backup: "Back up",
      comments: "Review comments",
      media: "Manage media",
      openBlog: "Open blog",
      refresh: "Refresh",
      settings: "Site settings",
      users: "Users",
      write: "Write post",
    },
    articleStatus: {
      draft: "Draft",
      published: "Published",
      scheduled: "Scheduled",
    },
    comments: {
      approved: "Approved",
      guestbook: "Guestbook",
      latest: "Latest comments",
      pending: "Pending",
      rejected: "Rejected",
      title: "Comment flow",
    },
    empty: {
      comments: "No new comments yet.",
      items: "Nothing needs attention right now.",
      recent: "No article records yet.",
    },
    focus: {
      commentsClear: "Comment queue is clear",
      commentsClearDetail: "No comments are waiting for review, so publishing can stay in motion.",
      commentsDetail: "Review public comments first so front-end conversations keep moving.",
      commentsPending: "Comments need review",
      draftDetail: "Drafts and scheduled posts still need title, cover, or timing checks.",
      draftReady: "Publishing rhythm is steady",
      draftWaiting: "Article queue needs a pass",
      localStorage: "Media is stored locally",
      mediaDetail:
        "Uploads stay in the local media directory, which fits development and small sites.",
      mediaReady: "R2 media storage is enabled",
      r2Storage: "Cloudflare R2 is ready for public asset delivery.",
      settingsDetail: "Site logos, cover images, or integrations still have missing pieces.",
      settingsReady: "Site profile is complete",
      settingsTodo: "Site profile can be improved",
      title: "Start here today",
    },
    hero: {
      badge: "Operations",
      description:
        "Articles, comments, media, users, and site configuration are gathered into one first-look page.",
      greeting: "Hello, ",
      storageLocal: "Local storage",
      storageR2: "R2 storage",
      subtitle: "Live admin data",
      title: "Admin workspace",
    },
    loading: "Loading",
    metrics: {
      administrators: "admins",
      articles: "All articles",
      articlesDescription: "Published, draft, and scheduled content",
      comments: "Pending comments",
      commentsDescription: "Public interaction to handle first",
      media: "Media assets",
      mediaDescription: "Images, videos, and documents",
      subscribers: "subscribers",
      users: "Registered users",
      usersDescription: "Admins, readers, and notification subscribers",
    },
    recent: {
      comments: "comments",
      content: "Recent content",
      pinned: "Pinned",
      read: "reads",
      title: "Recent updates",
      updated: "Updated",
    },
    snapshot: {
      admin: "Current admin",
      comments: "Comments",
      commentsOff: "Off",
      commentsOn: "On",
      deepl: "DeepL",
      deeplMissing: "Missing",
      deeplReady: "Ready",
      storage: "Media storage",
      title: "System snapshot",
      timezone: "Site time zone",
    },
  },
};

const metricCardStyle: CSSProperties = {
  minHeight: 132,
};

const metricIconStyle: CSSProperties = {
  alignItems: "center",
  borderRadius: 12,
  color: "white",
  display: "flex",
  flex: "0 0 40px",
  height: 40,
  justifyContent: "center",
  width: 40,
};

const dashboardHeroStyle: CSSProperties = {
  background:
    "linear-gradient(135deg, color-mix(in srgb, var(--color-text-pink) 12%, transparent), color-mix(in srgb, var(--color-background-muted) 82%, white))",
  overflow: "hidden",
};

const dashboardHeroTextStyle: CSSProperties = {
  minWidth: 0,
};

const dashboardActionGridStyle: CSSProperties = {
  minWidth: 220,
};

const dashboardListItemStyle: CSSProperties = {
  border: "1px solid var(--color-border)",
  borderRadius: 8,
  padding: 12,
};

const dashboardListItemTextStyle: CSSProperties = {
  minWidth: 0,
};

const dashboardMutedPanelStyle: CSSProperties = {
  background: "var(--color-background-muted)",
  borderRadius: 8,
  padding: 12,
};

const dashboardValueStyle: CSSProperties = {
  overflowWrap: "anywhere",
};

const dashboardMetricAccentColors = {
  articles: "#7c3aed",
  comments: "#be185d",
  media: "#0f766e",
  users: "#2563eb",
} as const;

const readFirstText = (values: ReadonlyArray<string | null | undefined>, fallback: string) => {
  const matchedValue = values.find(
    (value) => value !== undefined && value !== null && value.trim().length > 0,
  );

  return matchedValue?.trim() ?? fallback;
};

const getArticleTitle = ({
  article,
  fallback,
  language,
}: {
  readonly article: ArticleContent;
  readonly fallback: string;
  readonly language: AppLanguage;
}) => {
  if (language === "en") {
    return readFirstText([article.localizations.en.title, article.title], fallback);
  }

  return readFirstText(
    [article.title, article.localizations.zhCN.title, article.localizations.en.title],
    fallback,
  );
};

const formatFileSize = (sizeBytes: number) => {
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }

  const units = ["KB", "MB", "GB", "TB"] as const;
  let unitIndex = -1;
  let value = sizeBytes;

  do {
    value /= 1024;
    unitIndex += 1;
  } while (value >= 1024 && unitIndex < units.length - 1);

  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex] ?? "KB"}`;
};

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message.length > 0 ? error.message : fallback;

const getArticleStatusVariant = (status: ArticleContent["status"]) => {
  switch (status) {
    case "draft":
      return "neutral";
    case "published":
      return "success";
    case "scheduled":
      return "pink";
    default: {
      const exhaustiveStatus: never = status;
      return exhaustiveStatus;
    }
  }
};

const getCommentStatusVariant = (status: CommentItem["status"]) => {
  switch (status) {
    case "approved":
      return "success";
    case "pending":
      return "pink";
    case "rejected":
      return "neutral";
    default: {
      const exhaustiveStatus: never = status;
      return exhaustiveStatus;
    }
  }
};

const DashboardMetricCard = ({
  accentColor,
  description,
  icon,
  label,
  value,
}: DashboardMetricCardProps) => (
  <Card padding={4} style={metricCardStyle}>
    <VStack gap={3}>
      <HStack gap={3} vAlign="center">
        <div style={{ ...metricIconStyle, background: accentColor }}>{icon}</div>
        <StackItem size="fill" style={dashboardListItemTextStyle}>
          <Text type="label" color="secondary">
            {label}
          </Text>
        </StackItem>
      </HStack>
      <Heading level={2} style={dashboardValueStyle}>
        {value}
      </Heading>
      <Text type="supporting" color="secondary">
        {description}
      </Text>
    </VStack>
  </Card>
);

const DashboardFocusItem = ({
  description,
  icon,
  label,
  onClick,
  variant,
}: DashboardFocusItemProps) => (
  <div style={dashboardListItemStyle}>
    <HStack gap={3} vAlign="center">
      <Badge icon={icon} label={label} variant={variant} />
      <StackItem size="fill" style={dashboardListItemTextStyle}>
        <Text type="supporting" color="secondary">
          {description}
        </Text>
      </StackItem>
      <IconButton
        label={label}
        tooltip={label}
        icon={<ArrowUpRight size={15} />}
        variant="ghost"
        size="sm"
        onClick={onClick}
      />
    </HStack>
  </div>
);

const DashboardRecentArticle = ({
  article,
  fallback,
  language,
  timeZone,
}: DashboardRecentArticleProps) => {
  const copy = DASHBOARD_COPY_BY_LANGUAGE[language];
  const title = getArticleTitle({ article, fallback, language });
  const updatedAt = formatDateTimeInTimeZone({
    fallback: article.updatedAt,
    language,
    timeZone,
    value: article.updatedAt,
  });

  return (
    <div style={dashboardListItemStyle}>
      <VStack gap={2}>
        <HStack gap={2} vAlign="center" wrap="wrap">
          <Badge
            label={copy.articleStatus[article.status]}
            variant={getArticleStatusVariant(article.status)}
          />
          {article.isPinned && <Badge label={copy.recent.pinned} variant="pink" />}
          <Text type="supporting" color="secondary">
            {copy.recent.updated} {updatedAt}
          </Text>
        </HStack>
        <Heading level={3}>{title}</Heading>
        <HStack gap={2} vAlign="center" wrap="wrap">
          <Text type="supporting" color="secondary">
            {article.readCount} {copy.recent.read}
          </Text>
          <Text type="supporting" color="secondary">
            {article.commentCount} {copy.recent.comments}
          </Text>
        </HStack>
      </VStack>
    </div>
  );
};

const DashboardRecentComment = ({
  comment,
  fallback,
  language,
  timeZone,
}: DashboardRecentCommentProps) => {
  const copy = DASHBOARD_COPY_BY_LANGUAGE[language];
  const authorName = comment.author.name ?? comment.author.username;
  const targetLabel = comment.articleTitle ?? copy.comments.guestbook;
  const createdAt = formatDateTimeInTimeZone({
    fallback: comment.createdAt,
    language,
    timeZone,
    value: comment.createdAt,
  });

  return (
    <div style={dashboardListItemStyle}>
      <VStack gap={2}>
        <HStack gap={2} vAlign="center" wrap="wrap">
          <Badge
            label={copy.comments[comment.status]}
            variant={getCommentStatusVariant(comment.status)}
          />
          <Text type="supporting" color="secondary">
            {createdAt}
          </Text>
        </HStack>
        <Text type="label">{authorName}</Text>
        <Text type="supporting" color="secondary">
          {readFirstText([targetLabel, comment.content], fallback)}
        </Text>
      </VStack>
    </div>
  );
};

export function AdminDashboardPage({
  authToken,
  isNarrow,
  language,
  onOpenBlog,
  onPageChange,
  siteSettings,
  timeZone,
  user,
}: AdminDashboardPageProps) {
  const copy = DASHBOARD_COPY_BY_LANGUAGE[language];
  const [data, setData] = useState<AdminDashboardData>();
  const [errorMessage, setErrorMessage] = useState<string>();
  const [isLoading, setIsLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const numberFormatter = useMemo(
    () => new Intl.NumberFormat(language === "en" ? "en-US" : "zh-CN"),
    [language],
  );
  const formatCount = (value?: number) =>
    value === undefined ? copy.loading : numberFormatter.format(value);
  const displayName = user.name ?? user.username;
  const isR2Enabled = siteSettings?.storage.r2Enabled ?? false;
  const storageLabel = isR2Enabled ? copy.hero.storageR2 : copy.hero.storageLocal;
  const hasSiteProfileGaps =
    siteSettings === undefined ||
    siteSettings.site.coverUrls.length === 0 ||
    siteSettings.site.lightLogoUrl.trim().length === 0 ||
    siteSettings.site.faviconUrl.trim().length === 0;
  const pendingCommentCount = data?.pendingComments.pageInfo.totalItems ?? 0;
  const draftArticleCount = data?.draftArticles.pageInfo.totalItems ?? 0;
  const scheduledArticleCount = data?.scheduledArticles.pageInfo.totalItems ?? 0;
  const queuedArticleCount = draftArticleCount + scheduledArticleCount;
  const mediaStorageValue =
    data === undefined
      ? copy.loading
      : `${formatCount(data.media.summary.total)} / ${formatFileSize(data.media.summary.storageBytes)}`;

  useEffect(() => {
    let isMounted = true;

    const loadDashboard = async () => {
      setIsLoading(true);
      setErrorMessage(undefined);

      try {
        const [
          articles,
          publishedArticles,
          draftArticles,
          scheduledArticles,
          comments,
          pendingComments,
          users,
          media,
        ] = await Promise.all([
          getAdminArticles({
            page: 1,
            pageSize: DASHBOARD_PAGE_SIZE,
            query: "",
            sortBy: "updatedAt",
            sortOrder: "desc",
            status: "all",
            token: authToken,
          }),
          getAdminArticles({
            page: 1,
            pageSize: 1,
            query: "",
            sortBy: "updatedAt",
            sortOrder: "desc",
            status: "published",
            token: authToken,
          }),
          getAdminArticles({
            page: 1,
            pageSize: 1,
            query: "",
            sortBy: "updatedAt",
            sortOrder: "desc",
            status: "draft",
            token: authToken,
          }),
          getAdminArticles({
            page: 1,
            pageSize: 1,
            query: "",
            sortBy: "updatedAt",
            sortOrder: "desc",
            status: "scheduled",
            token: authToken,
          }),
          getAdminComments({
            includeDeleted: false,
            page: 1,
            pageSize: DASHBOARD_PAGE_SIZE,
            query: "",
            sortBy: "createdAt",
            sortOrder: "desc",
            status: "all",
            targetType: "all",
            token: authToken,
          }),
          getAdminComments({
            includeDeleted: false,
            page: 1,
            pageSize: 1,
            query: "",
            sortBy: "createdAt",
            sortOrder: "desc",
            status: "pending",
            targetType: "all",
            token: authToken,
          }),
          getManagedUsers({
            locale: language,
            page: 1,
            pageSize: DASHBOARD_PAGE_SIZE,
            query: "",
            role: "all",
            token: authToken,
          }),
          getMediaAssets({
            fileType: "all",
            page: 1,
            pageSize: DASHBOARD_PAGE_SIZE,
            query: "",
            storageProvider: "all",
            token: authToken,
          }),
        ]);

        if (!isMounted) {
          return;
        }

        setData({
          articles,
          comments,
          draftArticles,
          media,
          pendingComments,
          publishedArticles,
          scheduledArticles,
          users,
        });
      } catch (error) {
        if (isMounted) {
          setErrorMessage(getErrorMessage(error, "Dashboard data request failed."));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadDashboard();

    return () => {
      isMounted = false;
    };
  }, [authToken, language, reloadKey]);

  return (
    <VStack gap={4}>
      <Card padding={isNarrow ? 4 : 5} style={dashboardHeroStyle}>
        <HStack gap={isNarrow ? 3 : 5} vAlign="center" wrap="wrap">
          <StackItem size="fill" style={dashboardHeroTextStyle}>
            <VStack gap={3}>
              <HStack gap={2} vAlign="center" wrap="wrap">
                <Badge label={copy.hero.badge} icon={<Sparkles size={14} />} variant="pink" />
                <Badge label={storageLabel} icon={<Database size={14} />} variant="neutral" />
                <Text type="supporting" color="secondary">
                  {copy.hero.subtitle}
                </Text>
              </HStack>
              <VStack gap={1}>
                <Heading level={2}>
                  {copy.hero.greeting}
                  {displayName}
                </Heading>
                <Text type="body" color="secondary">
                  {copy.hero.description}
                </Text>
              </VStack>
            </VStack>
          </StackItem>
          <VStack gap={2} style={dashboardActionGridStyle}>
            <HStack gap={2} wrap="wrap">
              <Button
                label={copy.actions.write}
                icon={<PenLine size={16} />}
                variant="primary"
                size="sm"
                onClick={() => onPageChange("posts")}
              />
              <Button
                label={copy.actions.media}
                icon={<Image size={16} />}
                variant="secondary"
                size="sm"
                onClick={() => onPageChange("media")}
              />
            </HStack>
            <HStack gap={2} wrap="wrap">
              <Button
                label={copy.actions.openBlog}
                icon={<ArrowUpRight size={16} />}
                variant="ghost"
                size="sm"
                onClick={onOpenBlog}
              />
              <Button
                label={copy.actions.refresh}
                icon={<RefreshCcw size={16} />}
                variant="ghost"
                size="sm"
                onClick={() => setReloadKey((currentKey) => currentKey + 1)}
              />
            </HStack>
          </VStack>
        </HStack>
      </Card>

      {errorMessage !== undefined && (
        <Card padding={3}>
          <HStack gap={2} vAlign="center">
            <Badge label="API" variant="pink" />
            <Text type="supporting" color="secondary">
              {errorMessage}
            </Text>
          </HStack>
        </Card>
      )}

      <Grid columns={{ minWidth: isNarrow ? 180 : 220, max: 4 }} gap={3}>
        <DashboardMetricCard
          accentColor={dashboardMetricAccentColors.articles}
          description={`${formatCount(data?.publishedArticles.pageInfo.totalItems)} ${copy.articleStatus.published} · ${formatCount(queuedArticleCount)} ${copy.articleStatus.draft}`}
          icon={<FileText size={18} />}
          label={copy.metrics.articles}
          value={formatCount(data?.articles.pageInfo.totalItems)}
        />
        <DashboardMetricCard
          accentColor={dashboardMetricAccentColors.comments}
          description={copy.metrics.commentsDescription}
          icon={<MessageSquareText size={18} />}
          label={copy.metrics.comments}
          value={formatCount(data?.pendingComments.pageInfo.totalItems)}
        />
        <DashboardMetricCard
          accentColor={dashboardMetricAccentColors.media}
          description={copy.metrics.mediaDescription}
          icon={<Image size={18} />}
          label={copy.metrics.media}
          value={mediaStorageValue}
        />
        <DashboardMetricCard
          accentColor={dashboardMetricAccentColors.users}
          description={`${formatCount(data?.users.summary.administrators)} ${copy.metrics.administrators} · ${formatCount(data?.users.summary.notificationSubscribers)} ${copy.metrics.subscribers}`}
          icon={<Users size={18} />}
          label={copy.metrics.users}
          value={formatCount(data?.users.summary.total)}
        />
      </Grid>

      <Grid columns={{ minWidth: isNarrow ? 260 : 360, max: 2 }} gap={4}>
        <Card padding={4}>
          <VStack gap={3}>
            <HStack gap={2} vAlign="center">
              <CalendarClock size={18} />
              <Heading level={3}>{copy.focus.title}</Heading>
            </HStack>
            <VStack gap={2}>
              <DashboardFocusItem
                description={
                  pendingCommentCount > 0
                    ? copy.focus.commentsDetail
                    : copy.focus.commentsClearDetail
                }
                icon={<MessageSquareText size={14} />}
                label={
                  pendingCommentCount > 0 ? copy.focus.commentsPending : copy.focus.commentsClear
                }
                variant={pendingCommentCount > 0 ? "pink" : "success"}
                onClick={() => onPageChange("comments")}
              />
              <DashboardFocusItem
                description={
                  queuedArticleCount > 0 ? copy.focus.draftDetail : copy.metrics.articlesDescription
                }
                icon={<BookOpen size={14} />}
                label={queuedArticleCount > 0 ? copy.focus.draftWaiting : copy.focus.draftReady}
                variant={queuedArticleCount > 0 ? "pink" : "success"}
                onClick={() => onPageChange("posts")}
              />
              <DashboardFocusItem
                description={
                  hasSiteProfileGaps ? copy.focus.settingsDetail : copy.snapshot.timezone
                }
                icon={hasSiteProfileGaps ? <Settings size={14} /> : <CheckCircle2 size={14} />}
                label={hasSiteProfileGaps ? copy.focus.settingsTodo : copy.focus.settingsReady}
                variant={hasSiteProfileGaps ? "neutral" : "success"}
                onClick={() => onPageChange("site-settings")}
              />
              <DashboardFocusItem
                description={isR2Enabled ? copy.focus.r2Storage : copy.focus.mediaDetail}
                icon={<Database size={14} />}
                label={isR2Enabled ? copy.focus.mediaReady : copy.focus.localStorage}
                variant={isR2Enabled ? "success" : "neutral"}
                onClick={() => onPageChange("media")}
              />
            </VStack>
          </VStack>
        </Card>

        <Card padding={4}>
          <VStack gap={3}>
            <HStack gap={2} vAlign="center">
              <FileText size={18} />
              <Heading level={3}>{copy.recent.content}</Heading>
            </HStack>
            {data?.articles.items.length === 0 && !isLoading ? (
              <Text type="supporting" color="secondary">
                {copy.empty.recent}
              </Text>
            ) : (
              <VStack gap={2}>
                {(data?.articles.items ?? []).map((article) => (
                  <DashboardRecentArticle
                    key={article.id}
                    article={article}
                    fallback={copy.empty.recent}
                    language={language}
                    timeZone={timeZone}
                  />
                ))}
                {isLoading && (
                  <Text type="supporting" color="secondary">
                    {copy.loading}
                  </Text>
                )}
              </VStack>
            )}
          </VStack>
        </Card>

        <Card padding={4}>
          <VStack gap={3}>
            <HStack gap={2} vAlign="center">
              <MessageSquareText size={18} />
              <Heading level={3}>{copy.comments.latest}</Heading>
            </HStack>
            {data?.comments.items.length === 0 && !isLoading ? (
              <Text type="supporting" color="secondary">
                {copy.empty.comments}
              </Text>
            ) : (
              <VStack gap={2}>
                {(data?.comments.items ?? []).map((comment) => (
                  <DashboardRecentComment
                    key={comment.id}
                    comment={comment}
                    fallback={copy.empty.comments}
                    language={language}
                    timeZone={timeZone}
                  />
                ))}
                {isLoading && (
                  <Text type="supporting" color="secondary">
                    {copy.loading}
                  </Text>
                )}
              </VStack>
            )}
          </VStack>
        </Card>

        <Card padding={4}>
          <VStack gap={3}>
            <HStack gap={2} vAlign="center">
              <ShieldCheck size={18} />
              <Heading level={3}>{copy.snapshot.title}</Heading>
            </HStack>
            <VStack gap={2} style={dashboardMutedPanelStyle}>
              <HStack gap={2} vAlign="center">
                <Text type="label">{copy.snapshot.admin}</Text>
                <StackItem size="fill" />
                <Text type="supporting" color="secondary">
                  {displayName}
                </Text>
              </HStack>
              <Divider />
              <HStack gap={2} vAlign="center">
                <Text type="label">{copy.snapshot.timezone}</Text>
                <StackItem size="fill" />
                <Text type="supporting" color="secondary">
                  {timeZone}
                </Text>
              </HStack>
              <Divider />
              <HStack gap={2} vAlign="center">
                <Text type="label">{copy.snapshot.comments}</Text>
                <StackItem size="fill" />
                <Badge
                  label={
                    siteSettings?.basics.commentsEnabled === false
                      ? copy.snapshot.commentsOff
                      : copy.snapshot.commentsOn
                  }
                  variant={siteSettings?.basics.commentsEnabled === false ? "neutral" : "success"}
                />
              </HStack>
              <Divider />
              <HStack gap={2} vAlign="center">
                <Text type="label">{copy.snapshot.deepl}</Text>
                <StackItem size="fill" />
                <Badge
                  label={
                    siteSettings?.basics.deeplApiKeyConfigured === true
                      ? copy.snapshot.deeplReady
                      : copy.snapshot.deeplMissing
                  }
                  variant={
                    siteSettings?.basics.deeplApiKeyConfigured === true ? "success" : "neutral"
                  }
                />
              </HStack>
              <Divider />
              <HStack gap={2} vAlign="center">
                <Text type="label">{copy.snapshot.storage}</Text>
                <StackItem size="fill" />
                <Text type="supporting" color="secondary">
                  {storageLabel}
                </Text>
              </HStack>
            </VStack>
            <Grid columns={{ minWidth: 140, max: 2 }} gap={2}>
              <Button
                label={copy.actions.comments}
                icon={<MessageSquareText size={16} />}
                variant="secondary"
                size="sm"
                onClick={() => onPageChange("comments")}
              />
              <Button
                label={copy.actions.users}
                icon={<Users size={16} />}
                variant="secondary"
                size="sm"
                onClick={() => onPageChange("users")}
              />
              <Button
                label={copy.actions.settings}
                icon={<Settings size={16} />}
                variant="secondary"
                size="sm"
                onClick={() => onPageChange("site-settings")}
              />
              <Button
                label={copy.actions.backup}
                icon={<Archive size={16} />}
                variant="secondary"
                size="sm"
                onClick={() => onPageChange("backups")}
              />
            </Grid>
          </VStack>
        </Card>
      </Grid>
    </VStack>
  );
}
