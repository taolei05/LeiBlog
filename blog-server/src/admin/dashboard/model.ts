import { t } from "elysia";

const DashboardTaskToneSchema = t.Union([
  t.Literal("accent"),
  t.Literal("default"),
  t.Literal("success"),
  t.Literal("warning"),
  t.Literal("danger"),
]);

const DashboardIntegrationStateSchema = t.Union([
  t.Literal("configured"),
  t.Literal("disabled"),
  t.Literal("enabled"),
  t.Literal("missing"),
]);

const ArticleStatusSchema = t.Union([
  t.Literal("draft"),
  t.Literal("offline"),
  t.Literal("published"),
]);

const CommentStatusSchema = t.Union([
  t.Literal("approved"),
  t.Literal("pending"),
  t.Literal("rejected"),
]);

const CommentTargetTypeSchema = t.Union([t.Literal("article"), t.Literal("guestbook")]);

const DashboardMetricsSchema = t.Object({
  draftArticles: t.Number(),
  localMedia: t.Number(),
  pendingComments: t.Number(),
  publishedArticles: t.Number(),
  r2Media: t.Number(),
  scheduledArticles: t.Number(),
  totalComments: t.Number(),
  totalReads: t.Number(),
});

const DashboardContentTaskSchema = t.Object({
  href: t.String(),
  key: t.String(),
  label: t.String(),
  tone: DashboardTaskToneSchema,
  value: t.Number(),
});

const DashboardRecentArticleSchema = t.Object({
  commentCount: t.Number(),
  href: t.String(),
  id: t.String(),
  publicHref: t.String(),
  readCount: t.Number(),
  scheduledPublishAt: t.Nullable(t.String()),
  status: ArticleStatusSchema,
  title: t.String(),
  updatedAt: t.String(),
});

const DashboardRecentCommentSchema = t.Object({
  authorName: t.String(),
  createdAt: t.String(),
  excerpt: t.String(),
  href: t.String(),
  id: t.String(),
  status: CommentStatusSchema,
  targetTitle: t.String(),
  targetType: CommentTargetTypeSchema,
});

const DashboardStorageSchema = t.Object({
  localCount: t.Number(),
  r2Configured: t.Boolean(),
  r2Count: t.Number(),
  r2Enabled: t.Boolean(),
  totalCount: t.Number(),
  totalSizeBytes: t.Number(),
});

const DashboardIntegrationSchema = t.Object({
  key: t.String(),
  label: t.String(),
  state: DashboardIntegrationStateSchema,
});

export const DashboardOverviewResponse = t.Object({
  ok: t.Boolean(),
  item: t.Object({
    contentTasks: t.Array(DashboardContentTaskSchema),
    integrations: t.Array(DashboardIntegrationSchema),
    metrics: DashboardMetricsSchema,
    recentArticles: t.Array(DashboardRecentArticleSchema),
    recentComments: t.Array(DashboardRecentCommentSchema),
    storage: DashboardStorageSchema,
  }),
});
