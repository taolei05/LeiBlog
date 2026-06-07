import type { Key } from "@heroui/react";
import type { EmojiClickData } from "emoji-picker-react";
import type { EmojiData } from "emoji-picker-react/dist/types/exposedTypes";
import type { ChangeEvent, FormEvent } from "react";

import {
  Accordion,
  Avatar,
  Button,
  Card,
  Chip,
  Label,
  Popover,
  ScrollShadow,
  Separator,
  TextArea,
} from "@heroui/react";
import EmojiPicker, { EmojiStyle, Theme } from "emoji-picker-react";
import zhEmojiDataJson from "emoji-picker-react/dist/data/emojis-zh.json";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { PhotoProvider, PhotoView } from "react-photo-view";
import { useNavigate, useSearchParams } from "react-router-dom";

import { resolveApiAssetUrl } from "../../../shared/api/api-base-url";
import { AppIcon } from "../../../shared/icons";
import { showOperationToast } from "../../../shared/toast/operation-toast";
import type { BlogComment } from "./blogApi";
import { createPublicComment, fetchPublicComments, uploadPublicCommentImage } from "./blogApi";

const zhEmojiData = zhEmojiDataJson as unknown as EmojiData;

type CommentTarget = "article" | "guestbook";

type BlogCommentSessionUser = {
  avatarUrl: string | null;
  name: string | null;
  role: "admin" | "user";
  tags: string[];
  username: string;
};

type BlogCommentSession = {
  token: string;
  user: BlogCommentSessionUser;
};

type CommentThreadProps = {
  articleId?: string;
  description: string;
  target: CommentTarget;
  title: string;
};

type CommentSortOrder = "latest" | "oldest";

type UploadedCommentImage = {
  id: string;
  name: string;
  url: string;
};

type CommentContentPart =
  | {
      alt: string;
      kind: "image";
      url: string;
    }
  | {
      kind: "text";
      value: string;
    };

const BLOG_SESSION_KEY = "leiblog:blog-session";
const BLOG_SESSION_CHANGE_EVENT = "leiblog:blog-session-change";
const imageMarkdownPattern = /!\[([^\]]*)\]\(([^)]+)\)/g;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function readNullableString(value: unknown) {
  const stringValue = readString(value).trim();
  return stringValue ? stringValue : null;
}

function readStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function readCommentSessionUser(value: unknown): BlogCommentSessionUser | null {
  if (!isRecord(value)) return null;

  const username = readString(value.username);
  if (!username) return null;

  const role = value.role === "admin" ? "admin" : "user";

  return {
    avatarUrl: readNullableString(value.avatarUrl),
    name: readNullableString(value.name),
    role,
    tags: readStringArray(value.tags),
    username,
  };
}

function readCurrentCommentSession() {
  if (typeof window === "undefined") return null;

  try {
    const storedValue = window.localStorage.getItem(BLOG_SESSION_KEY);
    if (!storedValue) return null;

    const session = JSON.parse(storedValue) as unknown;
    if (!isRecord(session)) return null;

    const token = readString(session.token);
    const user = readCommentSessionUser(session.user);
    if (!token || !user) return null;

    return { token, user };
  } catch {
    return null;
  }
}

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

function createUploadId(file: File) {
  return `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`;
}

function normalizeImageAlt(value: string) {
  return value.replace(/[\][]/g, "").trim() || "评论图片";
}

function buildCommentContent(content: string, images: UploadedCommentImage[]) {
  const imageMarkdown = images.map((image) => `![${normalizeImageAlt(image.name)}](${image.url})`);

  return [content.trim(), ...imageMarkdown].filter(Boolean).join("\n\n");
}

function parseCommentContent(content: string): CommentContentPart[] {
  const parts: CommentContentPart[] = [];
  let lastIndex = 0;

  for (const match of content.matchAll(imageMarkdownPattern)) {
    const [source, alt = "", url = ""] = match;
    const matchIndex = match.index ?? 0;
    if (matchIndex > lastIndex) {
      parts.push({
        kind: "text",
        value: content.slice(lastIndex, matchIndex),
      });
    }

    parts.push({
      alt: alt.trim() || "评论图片",
      kind: "image",
      url: url.trim(),
    });
    lastIndex = matchIndex + source.length;
  }

  if (lastIndex < content.length) {
    parts.push({
      kind: "text",
      value: content.slice(lastIndex),
    });
  }

  if (parts.length > 0) return parts;

  return [{ kind: "text", value: content }];
}

function sortComments(comments: BlogComment[], sortOrder: CommentSortOrder) {
  return [...comments].sort((first, second) => {
    const firstTime = new Date(first.createdAt).getTime();
    const secondTime = new Date(second.createdAt).getTime();

    return sortOrder === "latest" ? secondTime - firstTime : firstTime - secondTime;
  });
}

function commentTargetName(target: CommentTarget) {
  return target === "guestbook" ? "留言" : "评论";
}

type CommentContentProps = {
  content: string;
};

function CommentContent({ content }: CommentContentProps) {
  const parts = parseCommentContent(content);

  return (
    <div className="comment-content">
      {parts.map((part, index) => {
        if (part.kind === "image") {
          const imageUrl = resolveApiAssetUrl(part.url);

          return imageUrl ? (
            <PhotoView key={`${part.url}-${index}`} src={imageUrl}>
              <button className="comment-content__image-link" type="button">
                <img alt={part.alt} src={imageUrl} />
              </button>
            </PhotoView>
          ) : null;
        }

        const lines = part.value.split("\n");

        return (
          <p key={`${part.value}-${index}`}>
            {lines.map((line, lineIndex) => (
              <Fragment key={`${line}-${lineIndex}`}>
                {line}
                {lineIndex < lines.length - 1 ? <br /> : null}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}

type CommentComposerProps = {
  buttonLabel: "回复" | "提交";
  content: string;
  images: UploadedCommentImage[];
  isEmojiPickerOpen: boolean;
  isSubmitting: boolean;
  isUploadingImage: boolean;
  onAppendEmoji: (emojiData: EmojiClickData) => void;
  onContentChange: (value: string) => void;
  onRemoveImage: (id: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onEmojiOpenChange: (isOpen: boolean) => void;
  onUploadImages: (event: ChangeEvent<HTMLInputElement>) => void;
  placeholder: string;
  requireSession: () => boolean;
  target: CommentTarget;
};

function CommentComposer({
  buttonLabel,
  content,
  images,
  isEmojiPickerOpen,
  isSubmitting,
  isUploadingImage,
  onAppendEmoji,
  onContentChange,
  onEmojiOpenChange,
  onRemoveImage,
  onSubmit,
  onUploadImages,
  placeholder,
  requireSession,
  target,
}: CommentComposerProps) {
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const isSubmitDisabled = isSubmitting || (!content.trim() && images.length === 0);

  function triggerImagePicker() {
    if (!requireSession()) return;
    imageInputRef.current?.click();
  }

  function handleEmojiOpenChange(isOpen: boolean) {
    if (isOpen && !requireSession()) return;
    onEmojiOpenChange(isOpen);
  }

  return (
    <form className="comment-composer" onSubmit={onSubmit}>
      <div className="comment-composer__field">
        <Label>{target === "guestbook" ? "留言" : "评论"}</Label>
        <div className="comment-composer__box">
          <TextArea
            className="comment-composer__textarea"
            onChange={(event) => onContentChange(event.target.value)}
            placeholder={placeholder}
            rows={4}
            value={content}
          />
          <div className="comment-composer__actions">
            <div className="comment-composer__toolbar comment-composer__toolbar--left">
              <input
                accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
                hidden
                multiple
                onChange={onUploadImages}
                ref={imageInputRef}
                type="file"
              />
              <Button
                aria-label={isUploadingImage ? "评论图片上传中" : "添加评论图片"}
                className="comment-composer__icon-button"
                isIconOnly
                isDisabled={isUploadingImage}
                onPress={triggerImagePicker}
                size="sm"
                type="button"
                variant="secondary"
              >
                <AppIcon name="image" />
              </Button>
              <Popover isOpen={isEmojiPickerOpen} onOpenChange={handleEmojiOpenChange}>
                <Popover.Trigger>
                  <Button
                    aria-label="选择 Emoji"
                    className="comment-composer__icon-button"
                    isIconOnly
                    size="sm"
                    type="button"
                    variant="secondary"
                  >
                    <AppIcon name="sparkles" />
                  </Button>
                </Popover.Trigger>
                <Popover.Content
                  className="comment-emoji-popover"
                  offset={10}
                  placement="top start"
                >
                  <Popover.Dialog>
                    <div className="comment-emoji-panel">
                      <EmojiPicker
                        autoFocusSearch={false}
                        emojiData={zhEmojiData}
                        emojiStyle={EmojiStyle.NATIVE}
                        height={340}
                        lazyLoadEmojis
                        onEmojiClick={onAppendEmoji}
                        previewConfig={{ showPreview: false }}
                        searchPlaceholder="搜索 Emoji"
                        theme={Theme.AUTO}
                        width="100%"
                      />
                    </div>
                  </Popover.Dialog>
                </Popover.Content>
              </Popover>
            </div>
            <div className="comment-composer__toolbar comment-composer__toolbar--right">
              <Button
                className="comment-composer__submit-button"
                isDisabled={isSubmitDisabled}
                type="submit"
              >
                <AppIcon name="send" />
                {isSubmitting ? "提交中" : buttonLabel}
              </Button>
            </div>
          </div>
        </div>
      </div>
      {images.length > 0 ? (
        <div className="comment-image-list">
          {images.map((image) => {
            const imageUrl = resolveApiAssetUrl(image.url);

            return (
              <div className="comment-image-list__item" key={image.id}>
                {imageUrl ? <img alt={image.name} src={imageUrl} /> : null}
                <span>{image.name}</span>
                <Button onPress={() => onRemoveImage(image.id)} size="sm" variant="tertiary">
                  <AppIcon name="close" />
                  移除
                </Button>
              </div>
            );
          })}
        </div>
      ) : null}
    </form>
  );
}

export function CommentThread({ articleId, description, target, title }: CommentThreadProps) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [comments, setComments] = useState<BlogComment[]>([]);
  const [content, setContent] = useState("");
  const [uploadedImages, setUploadedImages] = useState<UploadedCommentImage[]>([]);
  const [replyContent, setReplyContent] = useState("");
  const [replyUploadedImages, setReplyUploadedImages] = useState<UploadedCommentImage[]>([]);
  const [notice, setNotice] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<CommentSortOrder>("latest");
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [isReplyEmojiPickerOpen, setIsReplyEmojiPickerOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isUploadingReplyImage, setIsUploadingReplyImage] = useState(false);
  const [session, setSession] = useState<BlogCommentSession | null>(() =>
    readCurrentCommentSession(),
  );
  const sortedComments = useMemo(() => sortComments(comments, sortOrder), [comments, sortOrder]);
  const rootComments = useMemo(
    () => sortedComments.filter((comment) => comment.parentId === null),
    [sortedComments],
  );
  const highlightedCommentId = searchParams.get("comment");

  async function refreshComments() {
    if (target === "article" && !articleId) return;

    const nextComments = await fetchPublicComments({ articleId, target });
    setComments(nextComments);
  }

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
    if (typeof window === "undefined") return;

    function syncSession() {
      setSession(readCurrentCommentSession());
    }

    window.addEventListener(BLOG_SESSION_CHANGE_EVENT, syncSession);
    window.addEventListener("storage", syncSession);
    window.addEventListener("focus", syncSession);

    return () => {
      window.removeEventListener(BLOG_SESSION_CHANGE_EVENT, syncSession);
      window.removeEventListener("storage", syncSession);
      window.removeEventListener("focus", syncSession);
    };
  }, []);

  useEffect(() => {
    if (!highlightedCommentId || comments.length === 0) return;

    const frameId = window.requestAnimationFrame(() => {
      document
        .getElementById(`comment-${highlightedCommentId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [comments, highlightedCommentId]);

  function requireSession() {
    if (session) return true;

    const message = "请先登录或注册后再继续操作。";
    setNotice(message);
    showOperationToast(message, "warning");
    return false;
  }

  function clearReplyComposer() {
    setReplyTo(null);
    setReplyContent("");
    setReplyUploadedImages([]);
    setIsReplyEmojiPickerOpen(false);
  }

  async function uploadCommentImageFiles(files: File[]) {
    const currentSession = session;
    if (!currentSession) {
      requireSession();
      return null;
    }

    try {
      const uploads = await Promise.all(
        files.map(async (file) => ({
          id: createUploadId(file),
          name: file.name,
          url: await uploadPublicCommentImage({ file, token: currentSession.token }),
        })),
      );
      showOperationToast(`已添加 ${uploads.length} 张评论图片`);
      return uploads;
    } catch (error) {
      const message = error instanceof Error ? error.message : "评论图片上传失败";
      setNotice(message);
      showOperationToast(message, "danger");
      return null;
    }
  }

  async function uploadRootCommentImages(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = "";

    if (files.length === 0) return;

    setIsUploadingImage(true);

    try {
      const uploads = await uploadCommentImageFiles(files);
      if (!uploads) return;
      setUploadedImages((currentImages) => [...currentImages, ...uploads]);
    } finally {
      setIsUploadingImage(false);
    }
  }

  async function uploadReplyCommentImages(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = "";

    if (files.length === 0) return;

    setIsUploadingReplyImage(true);

    try {
      const uploads = await uploadCommentImageFiles(files);
      if (!uploads) return;
      setReplyUploadedImages((currentImages) => [...currentImages, ...uploads]);
    } finally {
      setIsUploadingReplyImage(false);
    }
  }

  function startReply(commentId: string) {
    if (!requireSession()) return;

    setReplyTo(commentId);
    setReplyContent("");
    setReplyUploadedImages([]);
    setIsEmojiPickerOpen(false);
    setIsReplyEmojiPickerOpen(false);
  }

  function appendRootEmoji(emojiData: EmojiClickData) {
    setContent((currentContent) => `${currentContent}${emojiData.emoji}`);
  }

  function appendReplyEmoji(emojiData: EmojiClickData) {
    setReplyContent((currentContent) => `${currentContent}${emojiData.emoji}`);
  }

  function removeUploadedImage(id: string) {
    setUploadedImages((currentImages) => currentImages.filter((image) => image.id !== id));
  }

  function removeReplyUploadedImage(id: string) {
    setReplyUploadedImages((currentImages) => currentImages.filter((image) => image.id !== id));
  }

  function handleReplyAccordionChange(keys: Set<Key>, commentId: string, accordionId: string) {
    if (keys.has(accordionId)) {
      startReply(commentId);
      return;
    }

    if (replyTo === commentId) {
      clearReplyComposer();
    }
  }

  async function submitComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const currentSession = session;
    if (!currentSession) {
      requireSession();
      return;
    }

    const nextContent = buildCommentContent(content, uploadedImages);
    if (!nextContent) {
      setNotice(`请先输入${commentTargetName(target)}内容或添加图片。`);
      return;
    }

    setIsSubmitting(true);

    try {
      await createPublicComment({
        articleId,
        content: nextContent,
        parentId: null,
        target,
        token: currentSession.token,
      });
      setContent("");
      setUploadedImages([]);
      setIsEmojiPickerOpen(false);
      await refreshComments();
      const message = `${commentTargetName(target)}提交成功。`;
      setNotice(`${message} ${formatNow()}`);
      showOperationToast(message);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : `${commentTargetName(target)}提交失败`;
      setNotice(message);
      showOperationToast(message, "danger");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function submitReply(commentId: string, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const currentSession = session;
    if (!currentSession) {
      requireSession();
      return;
    }

    const nextContent = buildCommentContent(replyContent, replyUploadedImages);
    if (!nextContent) {
      setNotice("请先输入回复内容或添加图片。");
      return;
    }

    setIsSubmittingReply(true);

    try {
      await createPublicComment({
        articleId,
        content: nextContent,
        parentId: commentId,
        target,
        token: currentSession.token,
      });
      clearReplyComposer();
      await refreshComments();
      const message = "回复成功。";
      setNotice(`${message} ${formatNow()}`);
      showOperationToast(message);
    } catch (error) {
      const message = error instanceof Error ? error.message : "回复失败";
      setNotice(message);
      showOperationToast(message, "danger");
    } finally {
      setIsSubmittingReply(false);
    }
  }

  function renderComment(comment: BlogComment) {
    const replies = sortedComments.filter((item) => item.parentId === comment.id);
    const authorName = comment.author.name ?? comment.author.username;
    const replyAccordionId = `reply-${comment.id}`;
    const replyExpandedKeys =
      replyTo === comment.id ? new Set<Key>([replyAccordionId]) : new Set<Key>();
    const location = comment.location?.trim();

    return (
      <article
        className={
          comment.id === highlightedCommentId ? "comment-item is-highlighted" : "comment-item"
        }
        id={`comment-${comment.id}`}
      >
        <Avatar className="comment-item__avatar" size="sm">
          {comment.author.avatarUrl ? <Avatar.Image src={comment.author.avatarUrl} /> : null}
          <Avatar.Fallback>{authorName.slice(0, 1).toUpperCase()}</Avatar.Fallback>
        </Avatar>
        <div className="comment-item__body">
          <header className="comment-item__header">
            <div className="comment-item__headline">
              <strong>{authorName}</strong>
              {comment.author.tags.length > 0 ? (
                <div className="comment-item__tags">
                  {comment.author.tags.map((tag) => (
                    <Chip key={tag} size="sm" variant="soft">
                      <Chip.Label>{tag}</Chip.Label>
                    </Chip>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="comment-item__meta">
              <time>{new Date(comment.createdAt).toLocaleString("zh-CN")}</time>
              {location ? <span className="comment-item__location">{location}</span> : null}
            </div>
          </header>
          <CommentContent content={comment.content} />
          <Button
            className="comment-item__reply"
            onPress={() => startReply(comment.id)}
            size="sm"
            variant="tertiary"
          >
            <AppIcon name="chatbubbles" />
            回复
          </Button>
          {replyTo === comment.id ? (
            <Accordion
              className="comment-reply-accordion"
              expandedKeys={replyExpandedKeys}
              hideSeparator
              onExpandedChange={(keys) =>
                handleReplyAccordionChange(keys, comment.id, replyAccordionId)
              }
              variant="surface"
            >
              <Accordion.Item id={replyAccordionId}>
                <Accordion.Heading>
                  <Accordion.Trigger className="comment-reply-accordion__trigger">
                    <AppIcon name="chatbubbles" />
                    回复 {authorName}
                    <Accordion.Indicator />
                  </Accordion.Trigger>
                </Accordion.Heading>
                <Accordion.Panel>
                  <Accordion.Body className="comment-reply-accordion__body">
                    <CommentComposer
                      buttonLabel="回复"
                      content={replyContent}
                      images={replyUploadedImages}
                      isEmojiPickerOpen={isReplyEmojiPickerOpen}
                      isSubmitting={isSubmittingReply}
                      isUploadingImage={isUploadingReplyImage}
                      onAppendEmoji={appendReplyEmoji}
                      onContentChange={setReplyContent}
                      onRemoveImage={removeReplyUploadedImage}
                      onSubmit={(event) => {
                        void submitReply(comment.id, event);
                      }}
                      onEmojiOpenChange={setIsReplyEmojiPickerOpen}
                      onUploadImages={uploadReplyCommentImages}
                      placeholder="写下你的回复，可以添加 Emoji 和图片"
                      requireSession={requireSession}
                      target={target}
                    />
                  </Accordion.Body>
                </Accordion.Panel>
              </Accordion.Item>
            </Accordion>
          ) : null}
          {replies.length > 0 ? (
            <ScrollShadow
              hideScrollBar
              className="comment-item__replies-scroll"
              orientation="horizontal"
            >
              <div className="comment-item__replies">
                {replies.map((reply, index) => (
                  <Fragment key={reply.id}>
                    {renderComment(reply)}
                    {index < replies.length - 1 ? (
                      <Separator className="comment-reply-separator" />
                    ) : null}
                  </Fragment>
                ))}
              </div>
            </ScrollShadow>
          ) : null}
        </div>
      </article>
    );
  }

  return (
    <Card className="comment-panel" id="comments">
      <PhotoProvider>
        <Card.Header>
          <Card.Title>
            <AppIcon name="chatbubbles" />
            {title}
          </Card.Title>
          <Card.Description>{description}</Card.Description>
        </Card.Header>

        {!session ? (
          <div className="comment-login-prompt">
            <div>
              <strong>登录或注册后参与评论</strong>
              <span>可发表新评论、回复读者、上传评论图片和使用 Emoji。</span>
            </div>
            <div className="comment-login-prompt__actions">
              <Button onPress={() => navigate("/login")} size="sm">
                <AppIcon name="logIn" />
                登录
              </Button>
              <Button onPress={() => navigate("/register")} size="sm" variant="secondary">
                <AppIcon name="personAdd" />
                注册
              </Button>
            </div>
          </div>
        ) : null}

        <div className="comment-panel__toolbar">
          <span>共 {comments.length} 条公开评论</span>
          <div className="comment-sort" role="group" aria-label="评论排序">
            <Button
              onPress={() => setSortOrder("latest")}
              size="sm"
              variant={sortOrder === "latest" ? undefined : "secondary"}
            >
              最新
            </Button>
            <Button
              onPress={() => setSortOrder("oldest")}
              size="sm"
              variant={sortOrder === "oldest" ? undefined : "secondary"}
            >
              最早
            </Button>
          </div>
        </div>

        <div className="comment-list">
          {rootComments.map((comment, index) => (
            <Fragment key={comment.id}>
              {renderComment(comment)}
              {index < rootComments.length - 1 ? <Separator className="comment-separator" /> : null}
            </Fragment>
          ))}
        </div>

        <CommentComposer
          buttonLabel="提交"
          content={content}
          images={uploadedImages}
          isEmojiPickerOpen={isEmojiPickerOpen}
          isSubmitting={isSubmitting}
          isUploadingImage={isUploadingImage}
          onAppendEmoji={appendRootEmoji}
          onContentChange={setContent}
          onRemoveImage={removeUploadedImage}
          onSubmit={submitComment}
          onEmojiOpenChange={setIsEmojiPickerOpen}
          onUploadImages={uploadRootCommentImages}
          placeholder={
            session
              ? target === "guestbook"
                ? "写下你的留言，可以添加 Emoji 和图片"
                : "写下你的评论，可以添加 Emoji 和图片"
              : target === "guestbook"
                ? "登录或注册后可提交留言"
                : "登录或注册后可提交评论"
          }
          requireSession={requireSession}
          target={target}
        />
        {notice ? <p className="front-form-note">{notice}</p> : null}
      </PhotoProvider>
    </Card>
  );
}
