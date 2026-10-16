import { useEffect, useRef } from "react";
import { DocViewerPlus } from "react-doc-viewer-plus";
import { VStack } from "@astryxdesign/core/Stack";

export const DocumentViewer = ({
  url,
  fileName,
  onClose,
}: {
  url: string;
  fileName: string;
  onClose: () => void;
}) => {
  const frame = useRef<HTMLElement>(null);
  useEffect(() => {
    const iframe = frame.current?.querySelector("iframe");
    if (iframe) {
      iframe.title = fileName;
      iframe.referrerPolicy = "no-referrer";
    }
  }, [url, fileName]);
  return (
    <VStack ref={frame} className="admin-document-viewer" gap={0}>
      <DocViewerPlus
        previewFile={{ fileUrl: url, fileName }}
        visibleViewerPlus
        onVisibleChange={onClose}
      />
    </VStack>
  );
};
