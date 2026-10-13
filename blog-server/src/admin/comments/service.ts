import { getSql } from "../../shared/db/postgres";
import { queueCommentNotifications } from "../../shared/email-notifications";
import type { CommentRow, CommentStatus, CommentTargetType } from "../../shared/comment";
import { toCommentItem } from "../../shared/comment";

export type AdminCommentQuery = {
  articleId?: string;
  includeDeleted?: boolean;
  page?: number;
  pageSize?: number;
  query?: string;
  sortBy?: "createdAt" | "updatedAt";
  sortOrder?: "asc" | "desc";
  status?: CommentStatus | "all";
  targetType?: CommentTargetType | "all";
  userId?: string;
};

export const ADMIN_COMMENT_FAILURE = {
  InvalidStatus: "invalid-status",
  NotFound: "not-found",
} as const;

export type AdminCommentFailure =
  (typeof ADMIN_COMMENT_FAILURE)[keyof typeof ADMIN_COMMENT_FAILURE];

export class AdminCommentError extends Error {
  readonly reason: AdminCommentFailure;

  constructor(reason: AdminCommentFailure, message: string) {
    super(message);
    this.reason = reason;
  }
}

type CountRow = {
  total: number | string | bigint;
};

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

const toPage = ({ page, pageSize }: AdminCommentQuery) => {
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

const readOrderSql = ({
  sortBy,
  sortOrder,
}: {
  sortBy?: "createdAt" | "updatedAt";
  sortOrder?: "asc" | "desc";
}) => {
  const direction = sortOrder === "asc" ? "ASC" : "DESC";
  const column = sortBy === "updatedAt" ? "c.updated_at" : "c.created_at";
  return `${column} ${direction}, c.created_at DESC`;
};

const readCommentById = async (commentId: string) => {
  const sql = getSql();
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
      c.comment_location
    FROM comments c
    JOIN users u ON u.id = c.user_id
    LEFT JOIN articles a ON a.id = c.article_id
    WHERE c.id = ${commentId}
    LIMIT 1
  `;

  if (row === undefined) {
    throw new AdminCommentError(ADMIN_COMMENT_FAILURE.NotFound, "Comment was not found.");
  }

  return toCommentItem(row);
};

export const listAdminComments = async (query: AdminCommentQuery = {}) => {
  const sql = getSql();
  const page = toPage(query);
  const search = query.query?.trim() ? `%${query.query.trim().toLowerCase()}%` : null;
  const targetType = query.targetType === "all" ? undefined : query.targetType;
  const status = query.status === "all" ? undefined : query.status;
  const orderBy = readOrderSql({
    sortBy: query.sortBy,
    sortOrder: query.sortOrder,
  });
  const rows = await sql.unsafe<CommentRow[]>(
    `
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
        c.comment_location
      FROM comments c
      JOIN users u ON u.id = c.user_id
      LEFT JOIN articles a ON a.id = c.article_id
      WHERE ($1::text IS NULL OR lower(c.content) LIKE $1 OR lower(u.username) LIKE $1 OR lower(coalesce(u.name, '')) LIKE $1 OR lower(coalesce(a.title, '')) LIKE $1)
        AND ($2::text IS NULL OR c.target_type = $2)
        AND ($3::uuid IS NULL OR c.article_id = $3)
        AND ($4::uuid IS NULL OR c.user_id = $4)
        AND ($5::text IS NULL OR c.status = $5)
        AND ($6::boolean = true OR c.deleted_at IS NULL)
      ORDER BY ${orderBy}
      LIMIT $7
      OFFSET $8
    `,
    [
      search,
      targetType ?? null,
      query.articleId ?? null,
      query.userId ?? null,
      status ?? null,
      query.includeDeleted ?? false,
      page.pageSize,
      page.offset,
    ],
  );
  const [countRow] = await sql.unsafe<CountRow[]>(
    `
      SELECT count(*) AS total
      FROM comments c
      JOIN users u ON u.id = c.user_id
      LEFT JOIN articles a ON a.id = c.article_id
      WHERE ($1::text IS NULL OR lower(c.content) LIKE $1 OR lower(u.username) LIKE $1 OR lower(coalesce(u.name, '')) LIKE $1 OR lower(coalesce(a.title, '')) LIKE $1)
        AND ($2::text IS NULL OR c.target_type = $2)
        AND ($3::uuid IS NULL OR c.article_id = $3)
        AND ($4::uuid IS NULL OR c.user_id = $4)
        AND ($5::text IS NULL OR c.status = $5)
        AND ($6::boolean = true OR c.deleted_at IS NULL)
    `,
    [
      search,
      targetType ?? null,
      query.articleId ?? null,
      query.userId ?? null,
      status ?? null,
      query.includeDeleted ?? false,
    ],
  );
  const totalItems = Number(countRow?.total ?? 0);

  return {
    items: rows.map(toCommentItem),
    ok: true as const,
    pageInfo: completePageInfo({
      page: page.page,
      pageSize: page.pageSize,
      totalItems,
    }),
  };
};

export const reviewComment = async ({
  commentId,
  nextStatus,
}: {
  commentId: string;
  nextStatus: CommentStatus;
}) => {
  if (nextStatus !== "approved" && nextStatus !== "pending" && nextStatus !== "rejected") {
    throw new AdminCommentError(ADMIN_COMMENT_FAILURE.InvalidStatus, "Comment status is invalid.");
  }

  const sql = getSql();
  await readCommentById(commentId);
  await sql.begin(async (transaction) => {
    await transaction`
      UPDATE comments SET status = ${nextStatus} WHERE id = ${commentId}
    `;
    if (nextStatus === "approved") {
      await queueCommentNotifications({ commentId, sql: transaction });
    }
  });

  return {
    item: await readCommentById(commentId),
    ok: true as const,
  };
};

export const deleteCommentByAdmin = async ({ commentId }: { commentId: string }) => {
  const sql = getSql();
  await readCommentById(commentId);
  await sql`
    UPDATE comments
    SET deleted_at = now()
    WHERE id = ${commentId}
  `;

  return { ok: true as const };
};
