import { Spinner } from "@astryxdesign/core/Spinner";
import { HStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";

type LoadingStatusProps = { label: string; className?: string };

export const LoadingStatus = ({ label, className }: LoadingStatusProps) => (
  <HStack
    aria-live="polite"
    className={className}
    gap={2}
    role="status"
    style={{ minHeight: 32 }}
    vAlign="center"
  >
    <Spinner aria-hidden="true" label={label} size="sm" />
    <Text color="secondary" type="supporting">
      {label}
    </Text>
  </HStack>
);
