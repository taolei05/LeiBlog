import { describe, expect, test } from "bun:test";
import { renderSubscriptionReminderEmail } from "./reminder-email";

const subscription = {
  name: "Spaceship",
  details: "taolei.net\nContract <script>alert(1)</script> & invoice",
  expiryDate: "2026-12-07",
  renewalPrice: "80.27",
  currency: "USD",
  renewalType: "automatic",
  serviceUrl: "https://www.spaceship.com/",
};
const branding = { locale: "en" as const, logoUrl: null, siteInitial: "L", siteName: "LeiBlog" };
describe("subscription reminder details", () => {
  test.each(["zh-CN", "en"] as const)("includes escaped multiline details in %s", (locale) => {
    const mail = renderSubscriptionReminderEmail({
      branding: { ...branding, locale }, subscription, adminUrl: "https://example.test/admin/#subscriptions",
    });
    expect(mail.text).toContain(`${locale === "en" ? "Details" : "详情"}: ${subscription.details}`);
    expect(mail.html).toContain("taolei.net");
    expect(mail.html).toContain("&lt;script&gt;");
    expect(mail.html).not.toContain("<script>");
    expect(mail.html).toContain("white-space:pre-wrap");
    expect(mail.text).toContain("USD 80.27");
  });
  test("supports frozen legacy jobs without details", () => {
    const { details, ...legacy } = subscription;
    const mail = renderSubscriptionReminderEmail({ branding, subscription: legacy, adminUrl: "https://example.test/admin/" });
    expect(mail.text).not.toContain("Details:");
    expect(mail.text).not.toContain("undefined");
  });
  test.each(["zh-CN", "en"] as const)("labels the single final expiration notice in %s", (locale) => {
    const mail = renderSubscriptionReminderEmail({
      branding: { ...branding, locale }, subscription: { ...subscription, isOverdue: true },
      adminUrl: "https://example.test/admin/#subscriptions",
    });
    expect(mail.subject).toContain(locale === "en" ? "Subscription expired" : "订阅服务到期提醒");
    expect(mail.text).toContain(locale === "en" ? "Status: Expired" : "状态: 已过期");
    expect(mail.html).not.toContain("<script>");
  });
});
