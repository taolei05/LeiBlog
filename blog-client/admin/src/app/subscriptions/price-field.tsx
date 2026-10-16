import { NumberInput } from "@astryxdesign/core/NumberInput";
import { Selector } from "@astryxdesign/core/Selector";
import { VStack } from "@astryxdesign/core/Stack";
import type { AppLanguage } from "../../../../shared/i18n";
import { subscriptionCurrencies } from "../../../../shared/subscriptions-api";
import type { SubscriptionCurrency } from "../../../../shared/subscriptions-api";
import { subscriptionCopy } from "./copy";

type SubscriptionPriceFieldProps = {
  language: AppLanguage;
  kind: "initial" | "renewal";
  price: string;
  currency: SubscriptionCurrency;
  onPriceChange: (price: string) => void;
  onCurrencyChange: (currency: SubscriptionCurrency) => void;
};
export const SubscriptionPriceField = ({
  language,
  kind,
  price,
  currency,
  onPriceChange,
  onCurrencyChange,
}: SubscriptionPriceFieldProps) => {
  const copy = subscriptionCopy[language];
  return (
    <VStack gap={2}>
      <NumberInput
        label={kind === "initial" ? copy.initialPrice : copy.renewalPrice}
        value={Number(price)}
        onChange={(value) => onPriceChange(value.toFixed(2))}
        min={0}
        max={9999999999.99}
        step={0.01}
        isWheelEnabled={false}
      />
      <Selector
        label={kind === "initial" ? copy.initialCurrency : copy.renewalCurrency}
        value={currency}
        presentation="adaptive"
        onChange={(value) => {
          const selected = subscriptionCurrencies.find((item) => item === value);
          if (selected) onCurrencyChange(selected);
        }}
        options={subscriptionCurrencies.map((value) => ({
          value,
          label: copy.currencies[value],
        }))}
      />
    </VStack>
  );
};
