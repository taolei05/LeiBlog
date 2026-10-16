import { Download, Eye, Trash2 } from "lucide-react";
import { IconButton } from "@astryxdesign/core/IconButton";
import { HStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import type { AppLanguage } from "../../../../shared/i18n";
import type { SubscriptionAttachment } from "../../../../shared/subscriptions-api";
import { subscriptionCopy } from "./copy";

type SubscriptionAttachmentRowProps = {
  attachment: SubscriptionAttachment;
  language: AppLanguage;
  isDownloading: boolean;
  onPreview: () => void;
  onDownload: () => void;
  onRemove: () => void;
};
export const SubscriptionAttachmentRow = ({
  attachment,
  language,
  isDownloading,
  onPreview,
  onDownload,
  onRemove,
}: SubscriptionAttachmentRowProps) => {
  const copy = subscriptionCopy[language];
  return (
    <HStack gap={2} hAlign="between" vAlign="center" wrap="wrap">
      <Text style={{ overflowWrap: "anywhere" }}>
        {attachment.fileName} · {(attachment.fileSize / 1024).toFixed(1)} KiB
      </Text>
      <HStack gap={1}>
        <IconButton
          label={copy.preview}
          tooltip={copy.preview}
          icon={<Eye size={16} />}
          isDisabled={isDownloading}
          onClick={onPreview}
        />
        <IconButton
          label={copy.download}
          tooltip={copy.download}
          icon={<Download size={16} />}
          isLoading={isDownloading}
          onClick={onDownload}
        />
        <IconButton
          label={copy.remove}
          tooltip={copy.remove}
          icon={<Trash2 size={16} />}
          onClick={onRemove}
        />
      </HStack>
    </HStack>
  );
};
