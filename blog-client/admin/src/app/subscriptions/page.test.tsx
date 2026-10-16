import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { i18n } from "../../../../shared/i18n";
import { SubscriptionsPage } from "./page";
import { SubscriptionPriceField } from "./price-field";
afterEach(async () => {
  await i18n.changeLanguage("zh-CN");
});
describe("subscriptions management entry", () => {
  it.each(["zh-CN", "en"] as const)("pairs each price with its own currency in %s", (language) => {
    const renderPrice = (kind: "initial" | "renewal", currency: "HKD" | "USD") =>
      renderToStaticMarkup(
        createElement(SubscriptionPriceField, {
          language,
          kind,
          currency,
          price: "12.50",
          onPriceChange: () => {},
          onCurrencyChange: () => {},
        }),
      );
    const initial = renderPrice("initial", "HKD");
    const renewal = renderPrice("renewal", "USD");
    expect(initial).toContain(language === "en" ? "Initial currency" : "首付货币");
    expect(initial).toContain(language === "en" ? "Hong Kong dollar HKD" : "港币 HKD");
    expect(initial).not.toContain(language === "en" ? "Renewal currency" : "续费货币");
    expect(renewal).toContain(language === "en" ? "Renewal currency" : "续费货币");
    expect(renewal).toContain(language === "en" ? "US dollar USD" : "美元 USD");
  });
  it.each(["zh-CN", "en"] as const)(
    "renders accessible controls and loading state in %s",
    async (locale) => {
      await i18n.changeLanguage(locale);
      const html = renderToStaticMarkup(
        createElement(SubscriptionsPage, {
          authToken: "",
          isNarrow: false,
          timeZone: "Asia/Shanghai",
        }),
      );
      expect(html).toContain(locale === "en" ? "Add subscription" : "新增订阅");
      expect(html).toContain(locale === "en" ? "Loading subscriptions" : "正在加载订阅");
      expect(html).toContain(locale === "en" ? "Convert to" : "折算货币");
      expect(html).not.toContain("private invoice");
    },
  );
});
