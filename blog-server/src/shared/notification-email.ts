import type { ResolvedEmailBranding } from "../blog/auth/service";
import { escapeHtml, renderLeiBlogEmailHtml } from "../blog/auth/service";
import { renderEmailExcerpt } from "./email-content";

type NotificationBodyParameters = {
  branding: ResolvedEmailBranding;
  subject: string;
  description: string;
  excerpt: string;
  actionLabel: string;
  actionUrl: string;
  preferencesUrl: string;
};

const renderNotificationBody = ({
  branding,
  subject: rawSubject,
  description,
  excerpt: rawExcerpt,
  actionLabel,
  actionUrl,
  preferencesUrl,
}: NotificationBodyParameters) => {
  const subject = rawSubject.replace(/[\r\n]+/g, " ").slice(0, 220);
  const excerpt = renderEmailExcerpt(rawExcerpt, actionUrl);
  const manageLabel = branding.locale === "en" ? "Manage email notifications" : "管理邮件通知";
  return {
    subject,
    text: `${description}\n\n${excerpt.text}\n\n${actionLabel}: ${actionUrl}\n\n${manageLabel}: ${preferencesUrl}`,
    html: renderLeiBlogEmailHtml({
      branding,
      preheader: description,
      title: subject,
      bodyHtml: `
        <p style="margin:0 0 14px;color:#52525b;font-size:15px;line-height:1.7;">${escapeHtml(description)}</p>
        <div style="margin:18px 0 0;padding:16px 18px;border:1px solid #e4e4e7;border-radius:18px;background:#fafafa;color:#27272a;font-size:14px;line-height:1.75;word-break:break-word;">${excerpt.html}</div>
        <p style="margin:20px 0 0;"><a href="${escapeHtml(actionUrl)}" style="display:inline-block;padding:11px 16px;border-radius:12px;background:#ec4899;color:#ffffff;font-size:14px;font-weight:800;line-height:1.2;text-decoration:none;">${escapeHtml(actionLabel)}</a></p>
        <p style="margin:20px 0 0;font-size:12px;line-height:1.7;"><a href="${escapeHtml(preferencesUrl)}" style="color:#71717a;">${escapeHtml(manageLabel)}</a></p>
      `,
    }),
  };
};

type RenderArticleNotificationEmailParameters = {
  articleUrl: string;
  branding: ResolvedEmailBranding;
  preferencesUrl: string;
  summary: string | null;
  title: string;
};

export const renderArticleNotificationEmail = ({
  articleUrl,
  branding,
  preferencesUrl,
  summary,
  title,
}: RenderArticleNotificationEmailParameters) => {
  const english = branding.locale === "en";
  return renderNotificationBody({
    branding,
    subject: english ? `New article: ${title}` : `新文章发布：${title}`,
    description: english
      ? `A new article, "${title}", has been published.`
      : `《${title}》已经发布：`,
    excerpt:
      summary?.trim() ||
      (english ? "Read the full article using the link below." : "点击下方链接查看全文。"),
    actionLabel: english ? "Read article" : "查看文章",
    actionUrl: articleUrl,
    preferencesUrl,
  });
};

type RenderCommentNotificationEmailParameters = {
  articleTitle: string | null;
  authorName: string;
  branding: ResolvedEmailBranding;
  commentUrl: string;
  content: string;
  kind: "comment_admin" | "comment_reply";
  preferencesUrl: string;
  target: "article" | "guestbook";
};

export const renderCommentNotificationEmail = ({
  articleTitle,
  authorName,
  branding,
  commentUrl,
  content,
  kind,
  preferencesUrl,
  target,
}: RenderCommentNotificationEmailParameters) => {
  const english = branding.locale === "en";
  const reply = kind === "comment_reply";
  const targetName =
    target === "guestbook"
      ? english
        ? "Guestbook"
        : "留言板"
      : articleTitle?.trim() || (english ? "Article" : "文章");
  const action = reply
    ? english
      ? "replied to your comment"
      : "回复了你的评论"
    : english
      ? "left a comment"
      : "发表了评论";
  return renderNotificationBody({
    branding,
    subject: english
      ? `${reply ? "New reply" : "New comment"}: ${targetName}`
      : `${reply ? "评论回复通知" : "新评论通知"}：${targetName}`,
    description: english
      ? `${authorName} ${action} in ${targetName}:`
      : `${authorName}在${target === "article" ? `《${targetName}》` : targetName}${action}：`,
    excerpt: content,
    actionLabel: english ? (reply ? "View reply" : "View comment") : "前往查看",
    actionUrl: commentUrl,
    preferencesUrl,
  });
};
