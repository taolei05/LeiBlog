import { renderCommentNotificationEmailHtml, sendResendEmail } from "../../auth/service";
import type { DbClient } from "../../shared/db";
import { db } from "../../shared/db";

export type CommentNotificationKind = "admin" | "reply";

export type CommentEmailNotification = {
  content: string;
  description: string;
  kind: CommentNotificationKind;
  subject: string;
  to: string;
};

type CommentNotificationCommentRow = {
  article_title: string | null;
  author_id: string;
  author_name: string | null;
  author_username: string;
  content: string;
  parent_id: string | null;
  target_type: "article" | "guestbook";
};

type CommentNotificationUserRow = {
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

function getDisplayName(row: { author_name: string | null; author_username: string }) {
  return row.author_name?.trim() || row.author_username;
}

type CreateNotificationDescriptionParameters = {
  articleTitle: string | null;
  authorDisplayName: string;
  kind: CommentNotificationKind;
  parentId: string | null;
  targetType: "article" | "guestbook";
};

function createNotificationDescription({
  articleTitle,
  authorDisplayName,
  kind,
  parentId,
  targetType,
}: CreateNotificationDescriptionParameters) {
  const isReply = Boolean(parentId);

  if (kind === "reply") {
    if (targetType === "article") {
      return `${authorDisplayName}在《${articleTitle ?? "未知文章"}》文章中回复了你的评论：`;
    }

    return `${authorDisplayName}在留言板中回复了你的评论：`;
  }

  if (targetType === "article") {
    const action = isReply ? "回复了评论" : "评论了";
    return `${authorDisplayName}在《${articleTitle ?? "未知文章"}》文章${action}：`;
  }

  const action = isReply ? "回复了评论" : "评论了";
  return `${authorDisplayName}在留言板${action}：`;
}

type CreateNotificationSubjectParameters = {
  articleTitle: string | null;
  kind: CommentNotificationKind;
  targetType: "article" | "guestbook";
};

function createNotificationSubject({
  articleTitle,
  kind,
  targetType,
}: CreateNotificationSubjectParameters) {
  const notificationType = kind === "admin" ? "新评论通知" : "评论回复通知";
  const targetName = targetType === "article" ? articleTitle ?? "未知文章" : "留言板";

  return `${notificationType}：${targetName}`;
}

type CreateCommentNotificationParameters = {
  comment: CommentNotificationCommentRow;
  kind: CommentNotificationKind;
  to: string;
};

function createCommentNotification({
  comment,
  kind,
  to,
}: CreateCommentNotificationParameters): CommentEmailNotification {
  return {
    content: comment.content,
    description: createNotificationDescription({
      articleTitle: comment.article_title,
      authorDisplayName: getDisplayName(comment),
      kind,
      parentId: comment.parent_id,
      targetType: comment.target_type,
    }),
    kind,
    subject: createNotificationSubject({
      articleTitle: comment.article_title,
      kind,
      targetType: comment.target_type,
    }),
    to,
  };
}

export function mergeCommentNotificationRecipients(
  notifications: CommentEmailNotification[]
) {
  const seenEmails = new Set<string>();
  const mergedNotifications: CommentEmailNotification[] = [];

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

export async function resolveCommentNotifications(
  commentId: string,
  client: DbClient = db
) {
  const [comment] = await client<CommentNotificationCommentRow[]>`
    SELECT c.target_type, c.parent_id, c.content,
           u.id AS author_id, u.username AS author_username, u.name AS author_name,
           a.title AS article_title
    FROM comments c
    JOIN users u ON u.id = c.user_id
    LEFT JOIN articles a ON a.id = c.article_id
    WHERE c.id = ${commentId}
      AND c.deleted_at IS NULL
    LIMIT 1
  `;
  if (!comment) return [];

  const adminRows = await client<CommentNotificationUserRow[]>`
    SELECT id, email
    FROM users
    WHERE role = 'admin'
      AND comment_email_notifications_enabled = true
      AND email IS NOT NULL
    ORDER BY created_at ASC, id ASC
  `;
  const adminNotifications = adminRows
    .map((admin) => normalizeNotificationEmail(admin.email))
    .filter((email): email is string => email !== undefined)
    .map((email) => createCommentNotification({ comment, kind: "admin", to: email }));
  const replyNotifications: CommentEmailNotification[] = [];

  if (comment.parent_id) {
    const [parentAuthor] = await client<CommentNotificationUserRow[]>`
      SELECT parent_author.id, parent_author.email
      FROM comments parent_comment
      JOIN users parent_author ON parent_author.id = parent_comment.user_id
      WHERE parent_comment.id = ${comment.parent_id}
        AND parent_comment.deleted_at IS NULL
        AND parent_author.comment_email_notifications_enabled = true
      LIMIT 1
    `;
    const replyEmail = normalizeNotificationEmail(parentAuthor?.email);

    if (parentAuthor && parentAuthor.id !== comment.author_id && replyEmail) {
      replyNotifications.push(
        createCommentNotification({ comment, kind: "reply", to: replyEmail })
      );
    }
  }

  return mergeCommentNotificationRecipients([
    ...adminNotifications,
    ...replyNotifications,
  ]);
}

export async function sendCommentEmailNotifications(
  commentId: string,
  client: DbClient = db
) {
  const notifications = await resolveCommentNotifications(commentId, client);
  let sentAnyEmail = false;

  for (const notification of notifications) {
    try {
      const sent = await sendResendEmail(client, {
        html: renderCommentNotificationEmailHtml({
          content: notification.content,
          description: notification.description,
          title: notification.subject,
        }),
        subject: notification.subject,
        text: `${notification.description}\n\n${notification.content}`,
        to: notification.to,
      });
      sentAnyEmail = sentAnyEmail || sent;
    } catch (error) {
      console.error(error);
    }
  }

  return sentAnyEmail;
}

export function scheduleCommentEmailNotifications(
  commentId: string,
  client: DbClient = db
) {
  void sendCommentEmailNotifications(commentId, client).catch((error) => {
    console.error(error);
  });
}
