import type { AuthUser } from "../../shared/auth";
import { requireAdmin } from "../../shared/auth";
import type { DbClient } from "../../shared/db";
import { db } from "../../shared/db";

type DashboardIntegrationState = "configured" | "disabled" | "enabled" | "missing";
type DashboardTaskTone = "accent" | "default" | "success" | "warning" | "danger";

type ArticleStatus = "draft" | "offline" | "published";
type CommentStatus = "approved" | "pending" | "rejected";
type CommentTargetType = "article" | "guestbook";

type ArticleStatsRow = {
  draft_articles: string;
  published_articles: string;
  scheduled_articles: string;
  total_reads: string | null;
};

type CommentStatsRow = {
  pending_comments: string;
  total_comments: string;
};

type MediaStatsRow = {
  local_media: string;
  r2_media: string;
  total_media: string;
  total_size_bytes: string | null;
};

type DashboardConfigRow = {
  comments_enabled: boolean;
  has_deepl_api_key: boolean;
  has_ipgeolocation_api_key: boolean;
  has_r2_secret_access_key: boolean;
  has_resend_api_key: boolean;
  r2_access_key_id: string | null;
  r2_account_id: string | null;
  r2_bucket: string | null;
  r2_enabled: boolean;
  r2_public_base_url: string | null;
  resend_domain: string | null;
};

type AuthProviderStatsRow = {
  configured_count: string;
  enabled_count: string;
};

type RecentArticleRow = {
  comment_count: string;
  id: string;
  read_count: string;
  scheduled_publish_at: Date | string | null;
  slug: string;
  status: ArticleStatus;
  title: string;
  updated_at: Date | string;
};

type RecentCommentRow = {
  article_slug: string | null;
  article_title: string | null;
  content: string;
  created_at: Date | string;
  id: string;
  name: string | null;
  status: CommentStatus;
  target_type: CommentTargetType;
  username: string;
};

function numberFromDb(value: string | number | null | undefined) {
  if (typeof value === "number") return value;
  return Number(value ?? 0);
}

function toIso(value: Date | string | null) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

function readIntegrationState({
  configured,
  enabled,
}: {
  configured: boolean;
  enabled?: boolean;
}): DashboardIntegrationState {
  if (enabled === false) return configured ? "disabled" : "missing";
  if (enabled === true) return configured ? "enabled" : "missing";
  return configured ? "configured" : "missing";
}

function contentTask({
  href,
  key,
  label,
  tone,
  value,
}: {
  href: string;
  key: string;
  label: string;
  tone: DashboardTaskTone;
  value: number;
}) {
  return { href, key, label, tone, value };
}

function publicCommentHref(row: RecentCommentRow) {
  const commentQuery = `comment=${encodeURIComponent(row.id)}#comments`;
  if (row.target_type === "guestbook") return `/guestbook?${commentQuery}`;
  if (!row.article_slug) return "/admin/content/comments";

  return `/articles/${encodeURIComponent(row.article_slug)}?${commentQuery}`;
}

export async function getAdminDashboardOverview(currentUser: AuthUser, client: DbClient = db) {
  requireAdmin(currentUser);

  const [articleStats] = await client<ArticleStatsRow[]>`
    SELECT
      count(*) FILTER (WHERE status = 'published') AS published_articles,
      count(*) FILTER (WHERE status = 'draft') AS draft_articles,
      count(*) FILTER (WHERE status = 'draft' AND scheduled_publish_at IS NOT NULL) AS scheduled_articles,
      COALESCE(sum(read_count), 0) AS total_reads
    FROM articles
  `;
  const [commentStats] = await client<CommentStatsRow[]>`
    SELECT
      count(*) FILTER (WHERE deleted_at IS NULL) AS total_comments,
      count(*) FILTER (WHERE status = 'pending' AND deleted_at IS NULL) AS pending_comments
    FROM comments
  `;
  const [mediaStats] = await client<MediaStatsRow[]>`
    SELECT
      count(*) AS total_media,
      count(*) FILTER (WHERE storage_provider = 'local') AS local_media,
      count(*) FILTER (WHERE storage_provider = 'r2') AS r2_media,
      COALESCE(sum(file_size_bytes), 0) AS total_size_bytes
    FROM media_assets
  `;
  const [config] = await client<DashboardConfigRow[]>`
    SELECT
      comments_enabled,
      resend_domain,
      resend_api_key_encrypted IS NOT NULL AS has_resend_api_key,
      deepl_api_key_encrypted IS NOT NULL AS has_deepl_api_key,
      ipgeolocation_api_key_encrypted IS NOT NULL AS has_ipgeolocation_api_key,
      r2_enabled,
      r2_account_id,
      r2_bucket,
      r2_access_key_id,
      r2_secret_access_key_encrypted IS NOT NULL AS has_r2_secret_access_key,
      r2_public_base_url
    FROM site_config
    WHERE id = 1
  `;
  const [authProviderStats] = await client<AuthProviderStatsRow[]>`
    SELECT
      count(*) FILTER (
        WHERE client_id IS NOT NULL AND client_secret_encrypted IS NOT NULL AND redirect_uri IS NOT NULL
      ) AS configured_count,
      count(*) FILTER (
        WHERE enabled = true AND client_id IS NOT NULL AND client_secret_encrypted IS NOT NULL AND redirect_uri IS NOT NULL
      ) AS enabled_count
    FROM auth_provider_settings
  `;

  const recentArticles = await client<RecentArticleRow[]>`
    SELECT
      a.id,
      a.title,
      a.slug,
      a.status,
      a.read_count,
      a.updated_at,
      a.scheduled_publish_at,
      (
        SELECT count(*)
        FROM comments c
        WHERE c.article_id = a.id
          AND c.deleted_at IS NULL
      ) AS comment_count
    FROM articles a
    ORDER BY a.updated_at DESC
    LIMIT 5
  `;
  const recentComments = await client<RecentCommentRow[]>`
    SELECT
      c.id,
      c.content,
      c.status,
      c.target_type,
      c.created_at,
      a.title AS article_title,
      a.slug AS article_slug,
      u.username,
      u.name
    FROM comments c
    JOIN users u ON u.id = c.user_id
    LEFT JOIN articles a ON a.id = c.article_id
    WHERE c.deleted_at IS NULL
    ORDER BY c.created_at DESC
    LIMIT 5
  `;

  const publishedArticles = numberFromDb(articleStats?.published_articles);
  const draftArticles = numberFromDb(articleStats?.draft_articles);
  const scheduledArticles = numberFromDb(articleStats?.scheduled_articles);
  const pendingComments = numberFromDb(commentStats?.pending_comments);
  const localMedia = numberFromDb(mediaStats?.local_media);
  const r2Media = numberFromDb(mediaStats?.r2_media);
  const r2Configured = Boolean(
    config?.r2_account_id &&
      config.r2_bucket &&
      config.r2_access_key_id &&
      config.has_r2_secret_access_key &&
      config.r2_public_base_url,
  );
  const emailConfigured = Boolean(config?.resend_domain && config.has_resend_api_key);
  const oauthConfigured = numberFromDb(authProviderStats?.configured_count) > 0;
  const oauthEnabled = numberFromDb(authProviderStats?.enabled_count) > 0;

  return {
    ok: true,
    item: {
      contentTasks: [
        contentTask({
          href: "/admin/content/comments",
          key: "pending-comments",
          label: "待审核评论",
          tone: "warning",
          value: pendingComments,
        }),
        contentTask({
          href: "/admin/content/articles",
          key: "scheduled-articles",
          label: "定时文章",
          tone: "accent",
          value: scheduledArticles,
        }),
        contentTask({
          href: "/admin/content/articles",
          key: "draft-articles",
          label: "草稿文章",
          tone: "default",
          value: draftArticles,
        }),
      ],
      integrations: [
        {
          key: "comments",
          label: "评论系统",
          state: readIntegrationState({
            configured: true,
            enabled: config?.comments_enabled ?? false,
          }),
        },
        {
          key: "email",
          label: "邮件通知",
          state: readIntegrationState({ configured: emailConfigured }),
        },
        {
          key: "r2",
          label: "Cloudflare R2",
          state: readIntegrationState({
            configured: r2Configured,
            enabled: config?.r2_enabled ?? false,
          }),
        },
        {
          key: "deepl",
          label: "DeepL",
          state: readIntegrationState({ configured: Boolean(config?.has_deepl_api_key) }),
        },
        {
          key: "ipgeolocation",
          label: "IPGeolocation",
          state: readIntegrationState({
            configured: Boolean(config?.has_ipgeolocation_api_key),
          }),
        },
        {
          key: "oauth",
          label: "第三方登录",
          state: readIntegrationState({ configured: oauthConfigured, enabled: oauthEnabled }),
        },
      ],
      metrics: {
        draftArticles,
        localMedia,
        pendingComments,
        publishedArticles,
        r2Media,
        scheduledArticles,
        totalComments: numberFromDb(commentStats?.total_comments),
        totalReads: numberFromDb(articleStats?.total_reads),
      },
      recentArticles: recentArticles.map((row) => ({
        commentCount: numberFromDb(row.comment_count),
        href: `/admin/content/articles/${row.id}/edit`,
        id: row.id,
        publicHref: `/articles/${encodeURIComponent(row.slug)}`,
        readCount: numberFromDb(row.read_count),
        scheduledPublishAt: toIso(row.scheduled_publish_at),
        status: row.status,
        title: row.title,
        updatedAt: toIso(row.updated_at) ?? "",
      })),
      recentComments: recentComments.map((row) => ({
        authorName: row.name ?? row.username,
        createdAt: toIso(row.created_at) ?? "",
        excerpt: row.content.slice(0, 80),
        href: publicCommentHref(row),
        id: row.id,
        status: row.status,
        targetTitle: row.target_type === "guestbook" ? "留言板" : (row.article_title ?? "未知文章"),
        targetType: row.target_type,
      })),
      storage: {
        localCount: localMedia,
        r2Configured,
        r2Count: r2Media,
        r2Enabled: config?.r2_enabled ?? false,
        totalCount: numberFromDb(mediaStats?.total_media),
        totalSizeBytes: numberFromDb(mediaStats?.total_size_bytes),
      },
    },
  };
}
