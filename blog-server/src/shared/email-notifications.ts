import type { Static } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import { t } from "elysia";
import type { Sql, TransactionSql } from "postgres";

import { getSiteSettings, readEncryptedSetting } from "../admin/settings/service";
import { resolveEmailBranding, sendResendEmail } from "../blog/auth/service";
import { getSql } from "./db/postgres";
import { env } from "./env";
import { queueDueSubscriptionReminders } from "../admin/subscriptions/service";
import { renderSubscriptionReminderEmail } from "../admin/subscriptions/reminder-email";
import type { SubscriptionReminderContent } from "../admin/subscriptions/reminder-email";
import { readSiteTimeZone } from "./time-zone";
import {
  renderArticleNotificationEmail,
  renderCommentNotificationEmail,
} from "./notification-email";

type NotificationSql = Sql | TransactionSql;
type NotificationKind = "new_article" | "comment_reply" | "comment_admin" | "subscription_expiry";

const notificationMessageSchema = t.Object({
  branding: t.Object({
    locale: t.Union([t.Literal("en"), t.Literal("zh-CN")]),
    logoUrl: t.Nullable(t.String()),
    siteInitial: t.String(),
    siteName: t.String(),
  }),
  senderDomain: t.String({ minLength: 1 }),
  html: t.String(),
  subject: t.String(),
  text: t.String(),
  to: t.String({ minLength: 1 }),
});
type NotificationMessage = Static<typeof notificationMessageSchema>;

type QueueCommentNotificationsParameters = { commentId: string; sql: NotificationSql };

export const queueCommentNotifications = async ({
  commentId,
  sql,
}: QueueCommentNotificationsParameters) => {
  await sql`
    WITH source AS (
      UPDATE comments c SET notification_enqueued_at = now()
      WHERE c.id = ${commentId} AND c.status = 'approved' AND c.deleted_at IS NULL
        AND c.notification_enqueued_at IS NULL
        AND (c.target_type = 'guestbook' OR EXISTS (
          SELECT 1 FROM articles a WHERE a.id = c.article_id AND a.status = 'published'
            AND (a.published_at IS NULL OR a.published_at <= now())
        ))
      RETURNING c.*
    )
    INSERT INTO email_notification_jobs (kind, recipient_id, article_id, comment_id)
    SELECT CASE WHEN recipient.id = parent.user_id THEN 'comment_reply' ELSE 'comment_admin' END,
      recipient.id, source.article_id, source.id
    FROM source
    LEFT JOIN comments parent ON parent.id = source.parent_id AND parent.status = 'approved'
      AND parent.deleted_at IS NULL AND parent.target_type = source.target_type
      AND parent.article_id IS NOT DISTINCT FROM source.article_id
    JOIN users recipient ON recipient.id = parent.user_id OR recipient.role = 'admin'
    WHERE recipient.comment_email_notifications = true AND recipient.id <> source.user_id
    ON CONFLICT DO NOTHING
  `;
};

type QueueArticleNotificationsParameters = { articleId: string; sql: NotificationSql };

export const queueArticleNotifications = async ({
  articleId,
  sql,
}: QueueArticleNotificationsParameters) => {
  await sql`
    WITH source AS (
      UPDATE articles SET notification_enqueued_at = now()
      WHERE id = ${articleId} AND status = 'published'
        AND (published_at IS NULL OR published_at <= clock_timestamp()) AND notification_enqueued_at IS NULL
      RETURNING id, author_id
    )
    INSERT INTO email_notification_jobs (kind, recipient_id, article_id)
    SELECT 'new_article', recipient.id, source.id FROM source
    JOIN users recipient ON recipient.id IS DISTINCT FROM source.author_id
    WHERE recipient.new_post_email_notifications = true
    ON CONFLICT DO NOTHING
  `;
};

export const publishDueScheduledArticles = async (sql: Sql = getSql()) => {
  return sql.begin(async (transaction) => {
    await transaction`
      UPDATE articles SET status = 'published', published_at = scheduled_publish_at, scheduled_publish_at = NULL
      WHERE status = 'scheduled' AND scheduled_publish_at <= now()
    `;
    const articles = await transaction<{ id: string }[]>`
      SELECT id FROM articles WHERE status = 'published' AND notification_enqueued_at IS NULL
        AND (published_at IS NULL OR published_at <= now())
      ORDER BY published_at ASC NULLS FIRST, id LIMIT 100
    `;
    for (const article of articles) {
      await queueArticleNotifications({ articleId: article.id, sql: transaction });
    }
    return articles.length;
  });
};

const getPublicOrigin = () => {
  if (env.publicSiteUrl) return env.publicSiteUrl;
  for (const origin of env.corsOrigins) {
    try {
      const url = new URL(origin);
      if (
        (url.protocol === "https:" || url.protocol === "http:") &&
        !url.username &&
        !url.password
      ) {
        return url.origin;
      }
    } catch {
      /* CORS patterns are not usable as public links. */
    }
  }
  throw new Error("No public origin is configured for email notification links.");
};

type NotificationJob = {
  id: string;
  kind: NotificationKind;
  recipientId: string;
  articleId: string | null;
  commentId: string | null;
  attempts: number;
  firstAttemptAt: Date | null;
  message: unknown;
  subscriptionId: string | null;
  subscriptionRevision: number | null;
  subscriptionExpiry: string | null;
};
type NotificationSource = {
  email: string;
  locale: "en" | "zh-CN";
  slug: string | null;
  title: string | null;
  summary: string | null;
  content: string | null;
  authorName: string | null;
  targetType: "article" | "guestbook" | null;
  subscription?: SubscriptionReminderContent;
};

type ReadNotificationSourceParameters = { job: NotificationJob; sql: Sql };

const readNotificationSource = async ({ job, sql }: ReadNotificationSourceParameters) => {
  const [recipient] = await sql<{ email: string; notificationEmailLocale: "en" | "zh-CN" }[]>`
    SELECT email, notification_email_locale FROM users WHERE id = ${job.recipientId}
      AND (CASE WHEN ${job.kind} = 'subscription_expiry' THEN role = 'admin'
        WHEN ${job.kind} = 'new_article' THEN new_post_email_notifications ELSE comment_email_notifications END)
      AND (${job.kind} <> 'comment_admin' OR role = 'admin')
  `;
  if (
    recipient === undefined ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient.email) ||
    recipient.email.length > 254
  )
    return undefined;
  const locale = recipient.notificationEmailLocale;
  if (job.kind === "subscription_expiry") {
    const timeZone = await readSiteTimeZone({ sql });
    const [subscription] = await sql<SubscriptionReminderContent[]>`
      SELECT name, expiry_date::text AS expiry_date, renewal_price::text AS renewal_price, currency, renewal_type, service_url
      FROM subscriptions WHERE id = ${job.subscriptionId} AND reminder_revision = ${job.subscriptionRevision}
        AND expiry_date = ${job.subscriptionExpiry}::date AND reminder_recipient_id = ${job.recipientId}
        AND reminder_enabled AND expiry_date >= (now() AT TIME ZONE ${timeZone})::date
        AND ((expiry_date - reminder_days + reminder_time) AT TIME ZONE ${timeZone}) <= now()
    `;
    return subscription === undefined ? undefined : {
      email: recipient.email, locale, subscription, slug: null, title: null, summary: null,
      content: null, authorName: null, targetType: null,
    };
  }
  const [source] =
    job.kind === "new_article"
      ? await sql<Omit<NotificationSource, "email" | "locale">[]>`
        SELECT a.slug, CASE WHEN ${locale} = 'en' THEN COALESCE(NULLIF(ae.title, ''), a.title) ELSE a.title END AS title,
          CASE WHEN ${locale} = 'en' THEN COALESCE(NULLIF(ae.summary, ''), a.summary) ELSE a.summary END AS summary,
          NULL::text AS content, NULL::text AS author_name, NULL::text AS target_type
        FROM articles a LEFT JOIN articles_en ae ON ae.article_id = a.id
        WHERE a.id = ${job.articleId} AND a.status = 'published' AND (a.published_at IS NULL OR a.published_at <= now())
          AND a.author_id IS DISTINCT FROM ${job.recipientId}::uuid
      `
      : await sql<Omit<NotificationSource, "email" | "locale">[]>`
        SELECT a.slug, CASE WHEN ${locale} = 'en' THEN COALESCE(NULLIF(ae.title, ''), a.title) ELSE a.title END AS title,
          NULL::text AS summary, c.content, c.target_type,
          CASE WHEN ${locale} = 'en' THEN COALESCE(NULLIF(ue.name, ''), NULLIF(author.name, ''), author.username)
            ELSE COALESCE(NULLIF(author.name, ''), author.username) END AS author_name
        FROM comments c JOIN users author ON author.id = c.user_id
        LEFT JOIN users_en ue ON ue.user_id = author.id
        LEFT JOIN articles a ON a.id = c.article_id LEFT JOIN articles_en ae ON ae.article_id = a.id
        LEFT JOIN comments parent ON parent.id = c.parent_id
        WHERE c.id = ${job.commentId} AND c.status = 'approved' AND c.deleted_at IS NULL
          AND c.user_id <> ${job.recipientId}
          AND (c.target_type = 'guestbook' OR (a.status = 'published' AND (a.published_at IS NULL OR a.published_at <= now())))
          AND (${job.kind} = 'comment_admin' OR (parent.user_id = ${job.recipientId} AND parent.status = 'approved'
            AND parent.deleted_at IS NULL AND parent.target_type = c.target_type AND parent.article_id IS NOT DISTINCT FROM c.article_id))
      `;
  return source === undefined ? undefined : { ...source, email: recipient.email, locale };
};

type ProcessNextEmailNotificationParameters = {
  sql?: Sql;
  send?: typeof sendResendEmail;
};

export const processNextEmailNotification = async ({
  sql = getSql(),
  send = sendResendEmail,
}: ProcessNextEmailNotificationParameters = {}) => {
  const token = crypto.randomUUID();
  const [job] = await sql<NotificationJob[]>`
    WITH next AS (
      SELECT id FROM email_notification_jobs WHERE status = 'pending' AND available_at <= now()
        AND (locked_until IS NULL OR locked_until <= now())
      ORDER BY available_at, created_at, id FOR UPDATE SKIP LOCKED LIMIT 1
    )
    UPDATE email_notification_jobs j SET lock_token = ${token}, locked_until = now() + interval '2 minutes', attempts = attempts + 1
    FROM next WHERE j.id = next.id RETURNING j.*
  `;
  if (job === undefined) return false;
  const finish = async (status: "sent" | "skipped" | "failed") => {
    await sql`
      UPDATE email_notification_jobs SET status = ${status}, completed_at = now(), lock_token = NULL, locked_until = NULL
      WHERE id = ${job.id} AND lock_token = ${token}
    `;
  };
  const retry = async (configured: boolean) => {
    const delay = configured ? Math.min(3600, 60 * 2 ** Math.min(job.attempts - 1, 6)) : 900;
    await sql`
      UPDATE email_notification_jobs SET available_at = now() + ${delay} * interval '1 second',
        attempts = attempts - ${configured ? 0 : 1}, lock_token = NULL, locked_until = NULL
      WHERE id = ${job.id} AND lock_token = ${token}
    `;
  };
  try {
    const source = await readNotificationSource({ job, sql });
    if (source === undefined) {
      await finish("skipped");
      return true;
    }
    // Keep retries within Resend's 24-hour idempotency window after the first attempt.
    if (
      job.firstAttemptAt !== null &&
      Date.now() - new Date(job.firstAttemptAt).getTime() >= 23 * 60 * 60 * 1000
    ) {
      await finish("failed");
      return true;
    }
    let message: NotificationMessage;
    if (job.message === null) {
      const settings = await getSiteSettings();
      const senderDomain = settings.basics.resendDomain.trim();
      if (!senderDomain || (await readEncryptedSetting("resend_api_key")) === undefined) {
        await retry(false);
        return true;
      }
      const origin = getPublicOrigin();
      const branding = await resolveEmailBranding({ locale: source.locale });
      const preferencesUrl = `${origin}/profile#profile-section-preferences`;
      const articleUrl = `${origin}/articles/${encodeURIComponent(source.slug ?? "")}`;
      const email =
        job.kind === "subscription_expiry" && source.subscription !== undefined
          ? renderSubscriptionReminderEmail({ branding, subscription: source.subscription, adminUrl: `${origin}/admin/#subscriptions` })
          : job.kind === "new_article"
          ? renderArticleNotificationEmail({
              branding,
              articleUrl,
              preferencesUrl,
              title: source.title ?? "",
              summary: source.summary,
            })
          : renderCommentNotificationEmail({
              branding,
              preferencesUrl,
              kind: job.kind === "comment_reply" ? "comment_reply" : "comment_admin",
              articleTitle: source.title,
              authorName: source.authorName ?? "",
              content: source.content ?? "",
              target: source.targetType ?? "guestbook",
              commentUrl: `${source.targetType === "article" ? articleUrl : `${origin}/guestbook`}?comment=${encodeURIComponent(job.commentId ?? "")}#comments`,
            });
      message = { ...email, branding, senderDomain, to: source.email };
      // Commit the exact payload before sending so a crash cannot change a retried request.
      const saved = await sql`
        UPDATE email_notification_jobs SET message = ${sql.json(message)}, first_attempt_at = now()
        WHERE id = ${job.id} AND lock_token = ${token} RETURNING id
      `;
      if (saved.length === 0) return true;
    } else {
      if (!Value.Check(notificationMessageSchema, job.message))
        throw new Error("Invalid notification message");
      message = job.message;
      if (message.to.toLowerCase() !== source.email.toLowerCase()) {
        await finish("skipped");
        return true;
      }
    }
    if (await send({ ...message, idempotencyKey: `notification/${job.id}` })) await finish("sent");
    else await retry(false);
  } catch {
    console.error("Email notification delivery failed", {
      jobId: job.id,
      kind: job.kind,
      attempt: job.attempts,
    });
    if (job.attempts >= 8) await finish("failed");
    else await retry(true);
  }
  return true;
};

export const startEmailNotificationWorker = () => {
  let lastSubscriptionCheck = 0;
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let running: Promise<void>;
  const tick = async () => {
    try {
      await publishDueScheduledArticles();
      if (Date.now() - lastSubscriptionCheck >= 30000) {
        await queueDueSubscriptionReminders();
        lastSubscriptionCheck = Date.now();
      }
      await processNextEmailNotification();
    } catch {
      console.error("Email notification worker tick failed");
    } finally {
      if (!stopped) {
        timer = setTimeout(() => {
          running = tick();
        }, 1000);
        timer.unref();
      }
    }
  };
  running = tick();
  return {
    stop: async () => {
      stopped = true;
      clearTimeout(timer);
      await running;
    },
  };
};
