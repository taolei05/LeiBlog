import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { TokenizerProps } from "@astryxdesign/core/Tokenizer";
import type { SearchableItem } from "@astryxdesign/core/Typeahead";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

type TextToken = SearchableItem<{ __createdValue?: string }>;
const { renderTokenizer } = vi.hoisted(() => ({
  renderTokenizer: vi.fn<(props: TokenizerProps<TextToken>) => null>(),
}));
vi.mock("@astryxdesign/core/Tokenizer", () => ({ Tokenizer: renderTokenizer }));

import { TextTokenizer } from "./text-tokenizer";

const renderField = (value: string[]) => {
  const onChange = vi.fn<(values: string[]) => void>();
  renderToStaticMarkup(
    createElement(TextTokenizer, {
      label: "SEO keywords",
      value,
      onChange,
      createLabel: (label) => `Create ${label}`,
      isDisabled: true,
    }),
  );
  const props = renderTokenizer.mock.calls.at(-1)?.[0];
  if (props === undefined) throw new Error("Tokenizer was not rendered.");
  return { props, onChange };
};

describe("text token fields", () => {
  beforeEach(() => renderTokenizer.mockReset().mockReturnValue(null));

  it("hydrates saved values, removes empty and duplicate tokens, and preserves commas within a token", () => {
    const { props } = renderField([" Bun ", "bun", "", "JavaScript, TypeScript"]);
    expect(props.value).toEqual([
      { id: "Bun", label: "Bun" },
      { id: "JavaScript, TypeScript", label: "JavaScript, TypeScript" },
    ]);
    expect(props).toMatchObject({
      hasCreate: true,
      hasClear: true,
      debounceMs: 0,
      isDisabled: true,
    });
    expect(
      props.renderItem?.({ id: "create", label: "", auxiliaryData: { __createdValue: "React" } }),
    ).toBe("Create React");
  });

  it("submits normalized string arrays when creating and removing tokens", () => {
    const { props, onChange } = renderField(["Bun"]);
    const created = { id: "react", label: " React " };
    props.onChange([...props.value, created, { id: "duplicate", label: "react" }], {
      type: "create",
      item: created,
    });
    expect(onChange).toHaveBeenLastCalledWith(["Bun", "React"]);
    props.onChange([created], { type: "remove", item: { id: "Bun", label: "Bun" } });
    expect(onChange).toHaveBeenLastCalledWith(["React"]);
  });

  it("submits an empty array when all tokens are cleared", () => {
    const { props, onChange } = renderField(["Bun"]);
    props.onChange([], { type: "remove", item: { id: "Bun", label: "Bun" } });
    expect(onChange).toHaveBeenCalledWith([]);
  });
});
