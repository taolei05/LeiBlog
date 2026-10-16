import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";
import {
  ReminderTimesField,
  normalizeReminderTimeTokens,
  areReminderTimesValid,
} from "./reminder-times-field";

describe("reminder time Tokenizer", () => {
  it("normalizes hour padding, pasted lists, duplicates and chronological order", () => {
    expect(normalizeReminderTimeTokens(["18:30，9:00;18:30\n12:00"])).toEqual([
      "09:00",
      "12:00",
      "18:30",
    ]);
  });
  it("keeps invalid tokens visible for correction and rejects an empty selection", () => {
    expect(normalizeReminderTimeTokens(["25:00", "9:00"])).toEqual(["09:00", "25:00"]);
    for (const values of [[], ["25:00"], ["09:60"], ["09:00", "09:00"], Array(13).fill("09:00")])
      expect(areReminderTimesValid(values)).toBe(false);
    expect(areReminderTimesValid(["09:00", "18:30"])).toBe(true);
  });
  it.each(["zh-CN", "en"] as const)(
    "renders removable time tokens and localized validation in %s",
    (language) => {
      const render = (value: string[], isDisabled = false) =>
        renderToStaticMarkup(
          createElement(ReminderTimesField, { value, onChange: () => {}, language, isDisabled }),
        );
      const html = render(["09:00", "18:30"]);
      expect(html).toContain("astryx-tokenizer");
      expect(html).toContain("09:00");
      expect(html).toContain("18:30");
      expect(html).toContain(language === "en" ? "Send at" : "发送时刻");
      expect(render(["25:00"])).toContain(language === "en" ? "HH:mm" : "HH:mm");
      expect(render(["09:00"], true)).toContain('disabled=""');
    },
  );
});
