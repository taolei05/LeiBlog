import { TextTokenizer } from "../../../../shared/text-tokenizer";
import { subscriptionCopy } from "./copy";

export const areReminderTimesValid = (values: string[]) =>
  values.length > 0 &&
  values.length <= 12 &&
  new Set(values).size === values.length &&
  values.every((value) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value));

export const normalizeReminderTimeTokens = (values: string[]) => {
  const tokens = values
    .flatMap((value) => value.split(/[,，;；\s]+/))
    .filter(Boolean)
    .map((value) => {
      const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(value);
      return match ? `${match[1].padStart(2, "0")}:${match[2]}` : value;
    });
  return [...new Set(tokens)].sort();
};

type ReminderTimesFieldProps = {
  language: "zh-CN" | "en";
  value: string[];
  isDisabled: boolean;
  onChange: (values: string[]) => void;
};

export const ReminderTimesField = ({
  language,
  value,
  isDisabled,
  onChange,
}: ReminderTimesFieldProps) => {
  const copy = subscriptionCopy[language];
  return (
    <TextTokenizer
      label={copy.reminderTime}
      value={value}
      placeholder="HH:mm"
      statusVariant="detached"
      maxEntries={12}
      isDisabled={isDisabled}
      status={
        !isDisabled && !areReminderTimesValid(value)
          ? { type: "error", message: copy.reminderTimesInvalid }
          : undefined
      }
      createLabel={(value) => copy.addReminderTime.replace("{{time}}", value)}
      onChange={(values) => onChange(normalizeReminderTimeTokens(values))}
    />
  );
};
