import type { JSONValue, Sql, TransactionSql } from "postgres";

import type { BlogUserProfile } from "../auth/service";
import { getSql } from "../../shared/db/postgres";
import { queueCommentNotifications } from "../../shared/email-notifications";
import { readLocationLabels, resolveLoginLocation } from "../../shared/login-metadata";
import type { RequestMeta } from "../../shared/request-meta";
import type { CommentItem, CommentRow, CommentTargetType } from "../../shared/comment";
import { toCommentItem } from "../../shared/comment";
import type { UserProfileContent } from "../../shared/profile-tags";
import { normalizeProfileTagLocale, readLocalizedUserProfile } from "../../shared/profile-tags";

type CommentSql = Sql | TransactionSql;

export type PublicCommentQuery = {
  locale?: string | null;
  page?: number;
  pageSize?: number;
  parentId?: string | null;
};

export type CreatePublicCommentInput = {
  content: string;
  parentId?: string | null;
};

export const PUBLIC_COMMENT_FAILURE = {
  ArticleNotFound: "article-not-found",
  CommentsDisabled: "comments-disabled",
  EmptyContent: "empty-content",
  ParentNotFound: "parent-not-found",
  Unauthorized: "unauthorized",
} as const;

export type PublicCommentFailure =
  (typeof PUBLIC_COMMENT_FAILURE)[keyof typeof PUBLIC_COMMENT_FAILURE];

export class PublicCommentError extends Error {
  readonly reason: PublicCommentFailure;

  constructor(reason: PublicCommentFailure, message: string) {
    super(message);
    this.reason = reason;
  }
}

type ArticleCommentTarget = {
  articleId: string;
  targetType: Extract<CommentTargetType, "article">;
};

type GuestbookCommentTarget = {
  articleId: null;
  targetType: Extract<CommentTargetType, "guestbook">;
};

type CommentTarget = ArticleCommentTarget | GuestbookCommentTarget;

type CountRow = {
  total: number | string | bigint;
};

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

const toPage = ({ page, pageSize }: PublicCommentQuery) => {
  const safePage =
    page === undefined || !Number.isFinite(page) ? DEFAULT_PAGE : Math.max(1, Math.floor(page));
  const safePageSize =
    pageSize === undefined || !Number.isFinite(pageSize)
      ? DEFAULT_PAGE_SIZE
      : Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(pageSize)));

  return {
    offset: (safePage - 1) * safePageSize,
    page: safePage,
    pageSize: safePageSize,
  };
};

const completePageInfo = ({
  page,
  pageSize,
  totalItems,
}: {
  page: number;
  pageSize: number;
  totalItems: number;
}) => ({
  page,
  pageSize,
  totalItems,
  totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
});

type ReadLocalizedCommentProfilesParameters = {
  locale?: string | null;
  rows: CommentRow[];
  sql: CommentSql;
};

const readLocalizedCommentProfiles = async ({
  locale,
  rows,
  sql,
}: ReadLocalizedCommentProfilesParameters) => {
  const rowsByUserId = new Map<string, CommentRow>();
  const normalizedLocale = normalizeProfileTagLocale(locale);

  for (const row of rows) {
    if (!rowsByUserId.has(row.userId)) {
      rowsByUserId.set(row.userId, row);
    }
  }

  const entries = await Promise.all(
    [...rowsByUserId.values()].map(async (row) => {
      const profile = await readLocalizedUserProfile({
        base: {
          bio: null,
          name: row.name,
          tags: row.tags ?? [],
        },
        locale: normalizedLocale,
        sql,
        userId: row.userId,
      });

      return [row.userId, profile] as const;
    }),
  );

  return new Map<string, UserProfileContent>(entries);
};

type ToLocalizedCommentItemsParameters = {
  locale?: string | null;
  rows: CommentRow[];
  sql: CommentSql;
};

const toLocalizedCommentItems = async ({
  locale,
  rows,
  sql,
}: ToLocalizedCommentItemsParameters) => {
  const profiles = await readLocalizedCommentProfiles({ locale, rows, sql });
  const labels = normalizeProfileTagLocale(locale) === "en"
    ? await readLocationLabels({ values: rows.map((row) => row.commentLocation), sql })
    : [];

  return rows.map((row, index) => {
    const profile = profiles.get(row.userId);
    const item = toCommentItem(profile === undefined ? row : {
      ...row,
      name: profile.name.length > 0 ? profile.name : row.name,
      tags: profile.tags,
    });
    const location = labels[index];
    return location === undefined ? item : { ...item, location: location.en };
  });
};

export const ensureCommentsEnabled = async (sql: CommentSql = getSql()) => {
  const [settings] = await sql<{ commentsEnabled: boolean }[]>`
    SELECT comments_enabled
    FROM site_settings
    WHERE id = 1
  `;

  if (settings?.commentsEnabled === false) {
    throw new PublicCommentError(PUBLIC_COMMENT_FAILURE.CommentsDisabled, "Comments are disabled.");
  }
};

const readPublishedArticleTarget = async ({ slug, sql }: { slug: string; sql: CommentSql }) => {
  const [article] = await sql<{ id: string }[]>`
    SELECT id
    FROM articles
    WHERE slug = ${slug.trim()}
      AND status = 'published'
      AND (published_at IS NULL OR published_at <= now())
    LIMIT 1
  `;

  if (article === undefined) {
    throw new PublicCommentError(PUBLIC_COMMENT_FAILURE.ArticleNotFound, "Article was not found.");
  }

  return {
    articleId: article.id,
    targetType: "article" as const,
  };
};

const ensureParentComment = async ({
  parentId,
  sql,
  target,
}: {
  parentId: string | null | undefined;
  sql: CommentSql;
  target: CommentTarget;
}) => {
  const normalizedParentId = parentId?.trim();
  if (normalizedParentId === undefined || normalizedParentId.length === 0) {
    return null;
  }

  if (target.targetType === "guestbook") {
    const [parent] = await sql<{ id: string }[]>`
      SELECT id
      FROM comments
      WHERE id = ${normalizedParentId}
        AND target_type = 'guestbook'
        AND article_id IS NULL
        AND status = 'approved'
        AND deleted_at IS NULL
      LIMIT 1
    `;

    if (parent === undefined) {
      throw new PublicCommentError(
        PUBLIC_COMMENT_FAILURE.ParentNotFound,
        "Parent comment was not found.",
      );
    }

    return parent.id;
  }

  const [parent] = await sql<{ id: string }[]>`
    SELECT id
    FROM comments
    WHERE id = ${normalizedParentId}
      AND target_type = ${target.targetType}
      AND article_id = ${target.articleId}
      AND status = 'approved'
      AND deleted_at IS NULL
    LIMIT 1
  `;

  if (parent === undefined) {
    throw new PublicCommentError(
      PUBLIC_COMMENT_FAILURE.ParentNotFound,
      "Parent comment was not found.",
    );
  }

  return parent.id;
};

type ReadCommentByIdParameters = {
  commentId: string;
  locale?: string | null;
  sql: CommentSql;
};

const readCommentById = async ({ commentId, locale, sql }: ReadCommentByIdParameters) => {
  const [row] = await sql<CommentRow[]>`
    SELECT
      c.id,
      c.target_type,
      c.article_id,
      a.title AS article_title,
      c.user_id,
      c.parent_id,
      c.content,
      c.status,
      c.created_at,
      c.updated_at,
      c.deleted_at,
      u.username,
      u.name,
      u.role,
      u.avatar_url,
      u.tags,
      u.blog_url,
      COALESCE(c.comment_location, u.last_login_location) AS comment_location
    FROM comments c
    JOIN users u ON u.id = c.user_id
    LEFT JOIN articles a ON a.id = c.article_id
    WHERE c.id = ${commentId}
    LIMIT 1
  `;

  if (row === undefined) {
    throw new PublicCommentError(PUBLIC_COMMENT_FAILURE.ParentNotFound, "Comment was not found.");
  }

  const [item] = await toLocalizedCommentItems({ locale, rows: [row], sql });

  return item ?? toCommentItem(row);
};

type ListPublicCommentsParameters = {
  articleSlug: string;
  query?: PublicCommentQuery;
};

export const listPublicComments = async ({
  articleSlug,
  query = {},
}: ListPublicCommentsParameters) => {
  const sql = getSql();
  const target = await readPublishedArticleTarget({ slug: articleSlug, sql });

  const page = toPage(query);
  const parentId = query.parentId?.trim() || null;
  const rows = await sql<CommentRow[]>`
    SELECT
      c.id,
      c.target_type,
      c.article_id,
      a.title AS article_title,
      c.user_id,
      c.parent_id,
      c.content,
      c.status,
      c.created_at,
      c.updated_at,
      c.deleted_at,
      u.username,
      u.name,
      u.role,
      u.avatar_url,
      u.tags,
      u.blog_url,
      COALESCE(c.comment_location, u.last_login_location) AS comment_location
    FROM comments c
    JOIN users u ON u.id = c.user_id
    LEFT JOIN articles a ON a.id = c.article_id
    WHERE c.target_type = 'article'
      AND c.article_id = ${target.articleId}
      AND c.status = 'approved'
      AND c.deleted_at IS NULL
      AND (${parentId}::uuid IS NULL OR c.parent_id = ${parentId})
    ORDER BY c.created_at ASC
    LIMIT ${page.pageSize}
    OFFSET ${page.offset}
  `;
  const [countRow] = await sql<CountRow[]>`
    SELECT count(*) AS total
    FROM comments c
    WHERE c.target_type = 'article'
      AND c.article_id = ${target.articleId}
      AND c.status = 'approved'
      AND c.deleted_at IS NULL
      AND (${parentId}::uuid IS NULL OR c.parent_id = ${parentId})
  `;
  const totalItems = Number(countRow?.total ?? 0);
  const items = await toLocalizedCommentItems({
    locale: query.locale,
    rows,
    sql,
  });

  return {
    items,
    ok: true as const,
    pageInfo: completePageInfo({
      page: page.page,
      pageSize: page.pageSize,
      totalItems,
    }),
  };
};

type ListPublicGuestbookCommentsParameters = {
  query?: PublicCommentQuery;
};

export const listPublicGuestbookComments = async ({
  query = {},
}: ListPublicGuestbookCommentsParameters = {}) => {
  const sql = getSql();
  const page = toPage(query);
  const parentId = query.parentId?.trim() || null;
  const rows = await sql<CommentRow[]>`
    SELECT
      c.id,
      c.target_type,
      c.article_id,
      a.title AS article_title,
      c.user_id,
      c.parent_id,
      c.content,
      c.status,
      c.created_at,
      c.updated_at,
      c.deleted_at,
      u.username,
      u.name,
      u.role,
      u.avatar_url,
      u.tags,
      u.blog_url,
      COALESCE(c.comment_location, u.last_login_location) AS comment_location
    FROM comments c
    JOIN users u ON u.id = c.user_id
    LEFT JOIN articles a ON a.id = c.article_id
    WHERE c.target_type = 'guestbook'
      AND c.article_id IS NULL
      AND c.status = 'approved'
      AND c.deleted_at IS NULL
      AND (${parentId}::uuid IS NULL OR c.parent_id = ${parentId})
    ORDER BY c.created_at ASC
    LIMIT ${page.pageSize}
    OFFSET ${page.offset}
  `;
  const [countRow] = await sql<CountRow[]>`
    SELECT count(*) AS total
    FROM comments c
    WHERE c.target_type = 'guestbook'
      AND c.article_id IS NULL
      AND c.status = 'approved'
      AND c.deleted_at IS NULL
      AND (${parentId}::uuid IS NULL OR c.parent_id = ${parentId})
  `;
  const totalItems = Number(countRow?.total ?? 0);
  const items = await toLocalizedCommentItems({
    locale: query.locale,
    rows,
    sql,
  });

  return {
    items,
    ok: true as const,
    pageInfo: completePageInfo({
      page: page.page,
      pageSize: page.pageSize,
      totalItems,
    }),
  };
};

type CreatePublicCommentParameters = {
  articleSlug: string;
  input: CreatePublicCommentInput;
  locale?: string | null;
  meta: RequestMeta;
  user: BlogUserProfile;
};

export const createPublicComment = async ({
  articleSlug,
  input,
  locale,
  meta,
  user,
}: CreatePublicCommentParameters): Promise<{ item: CommentItem; ok: true }> => {
  const content = input.content.trim();
  if (content.length === 0) {
    throw new PublicCommentError(PUBLIC_COMMENT_FAILURE.EmptyContent, "Comment is empty.");
  }

  const sql = getSql();
  const commentId = await sql.begin(async (transaction) => {
    await ensureCommentsEnabled(transaction);
    const target = await readPublishedArticleTarget({ slug: articleSlug, sql: transaction });
    const parentId = await ensureParentComment({
      parentId: input.parentId,
      sql: transaction,
      target,
    });
    const location = await resolveLoginLocation({ meta, sql: transaction });
    const device = meta.userAgent === null ? null : { userAgent: meta.userAgent };
    const [created] = await transaction<{ id: string }[]>`
      INSERT INTO comments (
        target_type,
        article_id,
        user_id,
        parent_id,
        content,
        comment_ip,
        comment_location,
        comment_device
      )
      VALUES (
        ${target.targetType},
        ${target.articleId},
        ${user.id},
        ${parentId},
        ${content},
        ${meta.ip},
        ${location === null ? null : transaction.json(location as JSONValue)},
        ${device === null ? null : transaction.json(device)}
      )
      RETURNING id
    `;

    await queueCommentNotifications({ commentId: created.id, sql: transaction });
    return created.id;
  });

  return {
    item: await readCommentById({ commentId, locale, sql }),
    ok: true,
  };
};

type CreatePublicGuestbookCommentParameters = {
  input: CreatePublicCommentInput;
  locale?: string | null;
  meta: RequestMeta;
  user: BlogUserProfile;
};

export const createPublicGuestbookComment = async ({
  input,
  locale,
  meta,
  user,
}: CreatePublicGuestbookCommentParameters): Promise<{ item: CommentItem; ok: true }> => {
  const content = input.content.trim();
  if (content.length === 0) {
    throw new PublicCommentError(PUBLIC_COMMENT_FAILURE.EmptyContent, "Comment is empty.");
  }

  const sql = getSql();
  const commentId = await sql.begin(async (transaction) => {
    await ensureCommentsEnabled(transaction);
    const target: GuestbookCommentTarget = {
      articleId: null,
      targetType: "guestbook",
    };
    const parentId = await ensureParentComment({
      parentId: input.parentId,
      sql: transaction,
      target,
    });
    const location = await resolveLoginLocation({ meta, sql: transaction });
    const device = meta.userAgent === null ? null : { userAgent: meta.userAgent };
    const [created] = await transaction<{ id: string }[]>`
      INSERT INTO comments (
        target_type,
        article_id,
        user_id,
        parent_id,
        content,
        comment_ip,
        comment_location,
        comment_device
      )
      VALUES (
        ${target.targetType},
        ${target.articleId},
        ${user.id},
        ${parentId},
        ${content},
        ${meta.ip},
        ${location === null ? null : transaction.json(location as JSONValue)},
        ${device === null ? null : transaction.json(device)}
      )
      RETURNING id
    `;

    await queueCommentNotifications({ commentId: created.id, sql: transaction });
    return created.id;
  });

  return {
    item: await readCommentById({ commentId, locale, sql }),
    ok: true,
  };
};
