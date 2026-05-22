import { Avatar, Button, Card, Chip, Label, TextArea } from "@heroui/react";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { AppIcon } from "../../../shared/icons";
import { fetchPublicComments, type BlogComment } from "./blogApi";

type CommentTarget = "article" | "guestbook";

function formatNow() {
  return new Intl.DateTimeFormat("zh-CN", {
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Shanghai",
    year: "numeric",
  })
    .format(new Date())
    .replace(/\//g, "-");
}

export function CommentThread({
  articleId,
  description,
  target,
  title,
}: {
  articleId?: string;
  description: string;
  target: CommentTarget;
  title: string;
}) {
  const [searchParams] = useSearchParams();
  const [comments, setComments] = useState<BlogComment[]>([]);
  const [content, setContent] = useState("");
  const [draftKey, setDraftKey] = useState(0);
  const [notice, setNotice] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const activeReply = comments.find((comment) => comment.id === replyTo);
  const rootComments = useMemo(
    () => comments.filter((comment) => comment.parentId === null),
    [comments],
  );
  const highlightedCommentId = searchParams.get("comment");

  useEffect(() => {
    let isActive = true;

    async function loadComments() {
      if (target === "article" && !articleId) return;

      try {
        const nextComments = await fetchPublicComments({ articleId, target });
        if (!isActive) return;
        setComments(nextComments);
        setNotice("");
      } catch {
        if (!isActive) return;
        setComments([]);
        setNotice("评论接口暂时不可用。");
      }
    }

    void loadComments();

    return () => {
      isActive = false;
    };
  }, [articleId, target]);

  useEffect(() => {
    if (!highlightedCommentId || comments.length === 0) return;

    const frameId = window.requestAnimationFrame(() => {
      document
        .getElementById(`comment-${highlightedCommentId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [comments, highlightedCommentId]);

  function submitComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedContent = content.trim();
    if (!trimmedContent) return;

    setContent("");
    setDraftKey((key) => key + 1);
    setReplyTo(null);
    setNotice(`评论已在 ${formatNow()} 写入表单，登录后可提交到后端审核。`);
  }

  function renderComment(comment: BlogComment) {
    const replies = comments.filter((item) => item.parentId === comment.id);
    const authorName = comment.author.name ?? comment.author.username;

    return (
      <article
        className={
          comment.id === highlightedCommentId ? "comment-item is-highlighted" : "comment-item"
        }
        id={`comment-${comment.id}`}
        key={comment.id}
      >
        <Avatar className="comment-item__avatar" size="sm">
          {comment.author.avatarUrl ? <Avatar.Image src={comment.author.avatarUrl} /> : null}
          <Avatar.Fallback>{authorName.slice(0, 1).toUpperCase()}</Avatar.Fallback>
        </Avatar>
        <div className="comment-item__body">
          <header className="comment-item__header">
            <strong>{authorName}</strong>
            <time>{new Date(comment.createdAt).toLocaleString("zh-CN")}</time>
            {comment.author.tags.map((tag) => (
              <Chip key={tag} size="sm" variant="soft">
                <Chip.Label>{tag}</Chip.Label>
              </Chip>
            ))}
          </header>
          <p>{comment.content}</p>
          <Button
            className="comment-item__reply"
            onPress={() => setReplyTo(comment.id)}
            size="sm"
            variant="tertiary"
          >
            <AppIcon name="chatbubbles" />
            回复
          </Button>
          {replies.length > 0 ? (
            <div className="comment-item__replies">{replies.map(renderComment)}</div>
          ) : null}
        </div>
      </article>
    );
  }

  return (
    <Card className="comment-panel" id="comments">
      <Card.Header>
        <Card.Title>
          <AppIcon name="chatbubbles" />
          {title}
        </Card.Title>
        <Card.Description>{description}</Card.Description>
      </Card.Header>

      <div className="comment-list">{rootComments.map(renderComment)}</div>

      <form className="comment-form" onSubmit={submitComment}>
        <div className="comment-form__identity">
          <span>当前身份</span>
          <strong>未登录用户</strong>
        </div>
        {activeReply ? (
          <div className="comment-form__replying">
            <span>回复 {activeReply.author.name ?? activeReply.author.username}</span>
            <Button onPress={() => setReplyTo(null)} size="sm" variant="tertiary">
              <AppIcon name="close" />
              取消
            </Button>
          </div>
        ) : null}
        <div className="comment-form__textarea">
          <Label>{target === "guestbook" ? "留言" : "评论"}</Label>
          <TextArea
            key={draftKey}
            onChange={(event) => setContent(event.target.value)}
            placeholder={target === "guestbook" ? "登录后可提交留言" : "登录后可提交评论"}
            rows={4}
          />
        </div>
        {notice ? <p className="front-form-note">{notice}</p> : null}
        <Button type="submit">
          <AppIcon name="send" />
          记录到表单
        </Button>
      </form>
    </Card>
  );
}
