import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { i18n } from "../../../../shared/i18n";
import { SubscriptionsPage } from "./page";
afterEach(async () => {
  await i18n.changeLanguage("zh-CN");
});
describe("subscriptions management entry", () => {
  it.each(["zh-CN", "en"] as const)(
    "renders accessible controls and loading state in %s",
    async (locale) => {
      await i18n.changeLanguage(locale);
      const html = renderToStaticMarkup(
        createElement(SubscriptionsPage, {
          authToken: "",
          isNarrow: false,
          timeZone: "Asia/Shanghai",
          adminEmail: "admin@example.test",
        }),
      );
      expect(html).toContain(locale === "en" ? "Add subscription" : "新增订阅");
      expect(html).toContain(locale === "en" ? "Loading subscriptions" : "正在加载订阅");
      expect(html).toContain(locale === "en" ? "Convert to" : "折算货币");
      expect(html).not.toContain("private invoice");
    },
  );
});
