import {
  getEmailBranding,
  renderArticleNotificationEmailHtml,
  sendResendEmail,
} from "../../auth/service";
import { appConfig } from "../../shared/config";
import type { DbClient } from "../../shared/db";
import { db } from "../../shared/db";

export type ArticleEmailNotification = {
  articleUrl: string;
  description: string;
  subject: string;
  summary: string;
  to: string;
};

type ArticleNotificationArticleRow = {
  author_id: string | null;
  id: string;
  slug: string;
  summary: string | null;
  title: string;
};

type ArticleNotificationUserRow = {
  email: string | null;
  id: string;
};

const MAX_EMAIL_LENGTH = 254;
const VALID_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+$/;

function normalizeNotificationEmail(email: string | null | undefined) {
  const normalizedEmail = email?.trim().toLowerCase();
  if (!normalizedEmail) return undefined;
  if (normalizedEmail.length > MAX_EMAIL_LENGTH) return undefined;
  if (!VALID_EMAIL_PATTERN.test(normalizedEmail)) return undefined;

  return normalizedEmail;
}

function getPublicSiteBaseUrl() {
  const preferredOrigin = appConfig.corsOrigins[0]?.trim();
  if (preferredOrigin) return preferredOrigin.replace(/\/+$/, "");

  const host = appConfig.host === "0.0.0.0" ? "localhost" : appConfig.host;
  return `http://${host}:${appConfig.port}`;
}

function createArticleUrl(slug: string) {
  return `${getPublicSiteBaseUrl()}/articles/${encodeURIComponent(slug)}`;
}

type CreateArticleNotificationParameters = {
  article: ArticleNotificationArticleRow;
  to: string;
};

function createArticleNotification({
  article,
  to,
}: CreateArticleNotificationParameters): ArticleEmailNotification {
  return {
    articleUrl: createArticleUrl(article.slug),
    description: `《${article.title}》已经发布：`,
    subject: `新文章发布：${article.title}`,
    summary: article.summary ?? "有一篇新文章发布了，点击下方链接查看全文。",
    to,
  };
}

export function mergeArticleNotificationRecipients(
  notifications: ArticleEmailNotification[]
) {
  const seenEmails = new Set<string>();
  const mergedNotifications: ArticleEmailNotification[] = [];

  for (const notification of notifications) {
    const email = normalizeNotificationEmail(notification.to);
    if (!email) continue;
    if (seenEmails.has(email)) continue;

    seenEmails.add(email);
    mergedNotifications.push({
      ...notification,
      to: email,
    });
  }

  return mergedNotifications;
}

export async function resolveArticleNotifications(articleId: string, client: DbClient = db) {
  const [article] = await client<ArticleNotificationArticleRow[]>`
    SELECT id, author_id, title, slug, summary
    FROM articles
    WHERE id = ${articleId}
      AND status = 'published'
      AND COALESCE(published_at, created_at) <= now()
    LIMIT 1
  `;
  if (!article) return [];

  const rows = await client<ArticleNotificationUserRow[]>`
    SELECT id, email
    FROM users
    WHERE new_article_email_notifications_enabled = true
      AND email IS NOT NULL
      AND (${article.author_id}::uuid IS NULL OR id <> ${article.author_id})
    ORDER BY created_at ASC, id ASC
  `;
  const notifications = rows
    .map((user) => normalizeNotificationEmail(user.email))
    .filter((email): email is string => email !== undefined)
    .map((email) => createArticleNotification({ article, to: email }));

  return mergeArticleNotificationRecipients(notifications);
}

export async function sendArticleEmailNotifications(
  articleId: string,
  client: DbClient = db
) {
  const notifications = await resolveArticleNotifications(articleId, client);
  const branding = await getEmailBranding(client);
  let sentAnyEmail = false;

  for (const notification of notifications) {
    try {
      const sent = await sendResendEmail(client, {
        branding,
        html: renderArticleNotificationEmailHtml({
          articleUrl: notification.articleUrl,
          branding,
          description: notification.description,
          summary: notification.summary,
          title: notification.subject,
        }),
        subject: notification.subject,
        text: `${notification.description}\n\n${notification.summary}\n\n${notification.articleUrl}`,
        to: notification.to,
      });
      sentAnyEmail = sentAnyEmail || sent;
    } catch (error) {
      console.error({
        articleId,
        error,
        subject: notification.subject,
        to: notification.to,
      });
    }
  }

  return sentAnyEmail;
}

export function scheduleArticleEmailNotifications(articleId: string, client: DbClient = db) {
  void sendArticleEmailNotifications(articleId, client).catch((error) => {
    console.error({
      articleId,
      error,
    });
  });
}
