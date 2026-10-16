import type { ResolvedEmailBranding } from "../../blog/auth/service";
import { escapeHtml, renderLeiBlogEmailHtml } from "../../blog/auth/service";

export type SubscriptionReminderContent = {
  name: string;
  details?: string;
  expiryDate: string;
  renewalPrice: string;
  currency: string;
  renewalType: string;
  serviceUrl: string;
};
export const renderSubscriptionReminderEmail = ({
  branding,
  subscription,
  adminUrl,
}: {
  branding: ResolvedEmailBranding;
  subscription: SubscriptionReminderContent;
  adminUrl: string;
}) => {
  const en = branding.locale === "en";
  const subject = `${en ? "Subscription expiring" : "订阅到期提醒"}: ${subscription.name}`
    .replace(/[\r\n]+/g, " ")
    .slice(0, 220);
  const mode =
    subscription.renewalType === "automatic"
      ? en
        ? "Automatic renewal"
        : "自动续订"
      : en
        ? "Manual renewal"
        : "手动续订";
  const rows = [
    [en ? "Service" : "服务", subscription.name],
    ...(subscription.details?.trim() ? [[en ? "Details" : "详情", subscription.details]] : []),
    [en ? "Expiry date" : "到期日期", subscription.expiryDate],
    [en ? "Renewal price" : "续费价格", `${subscription.currency} ${subscription.renewalPrice}`],
    [en ? "Renewal type" : "续订类型", mode],
    [en ? "Website" : "服务网站", subscription.serviceUrl],
  ];
  const action = en ? "Manage subscriptions" : "管理订阅与提醒";
  const note = en
    ? "Check the provider for renewal and payment. LeiBlog does not renew or charge subscriptions."
    : "请前往服务商确认续费与扣费情况，LeiBlog 不会执行续费或扣费。";
  return {
    subject,
    text: `${rows.map(([key, value]) => `${key}: ${value}`).join("\n")}\n\n${note}\n\n${action}: ${adminUrl}`,
    html: renderLeiBlogEmailHtml({
      branding,
      preheader: subject,
      title: subject,
      bodyHtml: `<table role="presentation" style="width:100%;border-collapse:collapse;">${rows.map(([key, value]) => `<tr><td style="padding:8px 0;color:#71717a;vertical-align:top;">${escapeHtml(key)}</td><td style="padding:8px 0;word-break:break-word;white-space:pre-wrap;">${escapeHtml(value)}</td></tr>`).join("")}</table><p>${escapeHtml(note)}</p><p><a href="${escapeHtml(adminUrl)}">${escapeHtml(action)}</a></p>`,
    }),
  };
};
