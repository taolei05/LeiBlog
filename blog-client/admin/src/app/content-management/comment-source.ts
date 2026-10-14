import type { CommentItem } from "../../../../shared/admin-api";

type GetCommentSourceLabelParameters = {
  comment: Pick<CommentItem, "articleTitle" | "targetType">;
  fallback: string;
  guestbookLabel: string;
};

export const getCommentSourceLabel = ({
  comment,
  fallback,
  guestbookLabel,
}: GetCommentSourceLabelParameters) =>
  comment.targetType === "guestbook" ? guestbookLabel : (comment.articleTitle ?? fallback);
