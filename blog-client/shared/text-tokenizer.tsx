import { useMemo } from "react";
import { Tokenizer } from "@astryxdesign/core/Tokenizer";
import type { TokenizerProps } from "@astryxdesign/core/Tokenizer";
import { createStaticSource } from "@astryxdesign/core/Typeahead";
import type { SearchableItem } from "@astryxdesign/core/Typeahead";

type TextToken = SearchableItem<{ __createdValue?: string }>;

type TextTokenizerProps = Pick<
  TokenizerProps<TextToken>,
  | "label"
  | "description"
  | "placeholder"
  | "status"
  | "statusVariant"
  | "isDisabled"
  | "maxEntries"
  | "size"
> & {
  value: string[];
  onChange: (values: string[]) => void;
  createLabel: (value: string) => string;
};

const createItems = (values: string[]): TextToken[] => {
  const seen = new Set<string>();
  return values.reduce<TextToken[]>((items, value) => {
    const label = value.trim();
    const key = label.toLocaleLowerCase();
    if (label && !seen.has(key)) {
      seen.add(key);
      items.push({ id: label, label });
    }
    return items;
  }, []);
};

export function TextTokenizer({ value, onChange, createLabel, ...props }: TextTokenizerProps) {
  const items = useMemo(() => createItems(value), [value]);
  const searchSource = useMemo(() => createStaticSource(items), [items]);

  return (
    <Tokenizer
      {...props}
      value={items}
      searchSource={searchSource}
      onChange={(nextItems) =>
        onChange(createItems(nextItems.map((item) => item.label)).map((item) => item.label))
      }
      renderItem={(item) =>
        item.auxiliaryData?.__createdValue
          ? createLabel(item.auxiliaryData.__createdValue)
          : item.label
      }
      hasCreate
      hasClear
      hasEntriesOnFocus
      debounceMs={0}
    />
  );
}
