import { Button, Card, Chip, Label, TextArea } from "@heroui/react";
import { useMemo, useState, type FormEvent } from "react";

import { AppIcon } from "../../../shared/icons";

type CommentTarget = "article" | "guestbook";

type CommentItem = {
  author: string;
  content: string;
  createdAt: string;
  id: string;
  parentId?: string;
  tags: string[];
};

const seededComments: Record<CommentTarget, CommentItem[]> = {
  article: [
    {
      author: "Mika",
      content: "这篇把缓存失效边界讲得很清楚，尤其是评论变化只清理详情页这一点。",
      createdAt: "2026-05-15 22:16",
      id: "article-comment-1",
      tags: ["读者", "前端"],
    },
    {
      author: "Lei",
      content: "后面会把管理后台里的发布流也补成一篇，顺手把踩坑记录进去。",
      createdAt: "2026-05-15 22:40",
      id: "article-comment-2",
      parentId: "article-comment-1",
      tags: ["作者"],
    },
  ],
  guestbook: [
    {
      author: "小陈",
      content: "路过留个脚印，站点的交互风格很有记忆点。",
      createdAt: "2026-05-12 19:03",
      id: "guestbook-comment-1",
      tags: ["小可爱"],
    },
  ],
};

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
  description,
  target,
  title,
}: {
  description: string;
  target: CommentTarget;
  title: string;
}) {
  const [comments, setComments] = useState(() => seededComments[target]);
  const [content, setContent] = useState("");
  const [draftKey, setDraftKey] = useState(0);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const activeReply = comments.find((comment) => comment.id === replyTo);
  const rootComments = useMemo(() => comments.filter((comment) => !comment.parentId), [comments]);

  function submitComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedContent = content.trim();
    if (!trimmedContent) return;

    setComments((items) => [
      ...items,
      {
        author: "LeiBlog 读者",
        content: trimmedContent,
        createdAt: formatNow(),
        id: `${target}-comment-${Date.now()}`,
        parentId: replyTo ?? undefined,
        tags: ["预览"],
      },
    ]);
    setContent("");
    setDraftKey((key) => key + 1);
    setReplyTo(null);
  }

  function renderComment(comment: CommentItem) {
    const replies = comments.filter((item) => item.parentId === comment.id);

    return (
      <article className="comment-item" key={comment.id}>
        <div className="comment-item__avatar" aria-hidden="true">
          {comment.author.slice(0, 1).toUpperCase()}
        </div>
        <div className="comment-item__body">
          <header className="comment-item__header">
            <strong>{comment.author}</strong>
            <time>{comment.createdAt}</time>
            {comment.tags.map((tag) => (
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
    <Card className="comment-panel">
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
          <strong>LeiBlog 读者 · 预览</strong>
        </div>
        {activeReply ? (
          <div className="comment-form__replying">
            <span>回复 {activeReply.author}</span>
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
            placeholder={target === "guestbook" ? "写下你想留在这里的话" : "写下你的阅读想法"}
            rows={4}
          />
        </div>
        <Button type="submit">
          <AppIcon name="send" />
          发布
        </Button>
      </form>
    </Card>
  );
}
