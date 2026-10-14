import { useCallback, useState } from "react";
import { ProgressBar } from "@astryxdesign/core/ProgressBar";

import type { AppLanguage } from "./i18n";
import type { UploadProgress, UploadProgressHandler } from "./upload-request";
import "./upload-progress.css";

export const updateUploadProgress = (current: readonly UploadProgress[], next: UploadProgress) => {
  if (
    next.phase === "uploading" &&
    !current.some((item) => item.phase === "uploading" || item.phase === "processing")
  ) {
    return [next];
  }
  return current.some((item) => item.id === next.id)
    ? current.map((item) => (item.id === next.id ? next : item))
    : [...current, next];
};

export const useUploadProgress = () => {
  const [uploads, setUploads] = useState<readonly UploadProgress[]>([]);
  const onUploadProgress: UploadProgressHandler = useCallback((next: UploadProgress) => {
    setUploads((current) => updateUploadProgress(current, next));
  }, []);
  return { uploads, onUploadProgress };
};

type UploadProgressListProps = {
  language: AppLanguage;
  uploads: readonly UploadProgress[];
};

export const UploadProgressList = ({ language, uploads }: UploadProgressListProps) => {
  const labels =
    language === "en"
      ? {
          uploading: "Uploading",
          processing: "Processing",
          complete: "Uploaded",
          error: "Upload failed",
        }
      : { uploading: "上传中", processing: "处理中", complete: "上传完成", error: "上传失败" };
  if (uploads.length === 0) {
    return null;
  }
  return (
    <div className="leiblog-upload-progress">
      {uploads.map((upload) => {
        const indeterminate =
          upload.phase === "processing" ||
          (upload.phase === "uploading" && upload.total === undefined);
        const value =
          upload.phase === "complete"
            ? 100
            : upload.total === undefined
              ? 0
              : Math.min(100, Math.floor((upload.loaded / upload.total) * 100));
        return (
          <div className="leiblog-upload-progress__item" key={upload.id}>
            <span className="leiblog-upload-progress__file">{upload.fileName}</span>
            <ProgressBar
              hasValueLabel={!indeterminate}
              isIndeterminate={indeterminate}
              label={labels[upload.phase]}
              value={value}
              variant={
                upload.phase === "error"
                  ? "error"
                  : upload.phase === "complete"
                    ? "success"
                    : "accent"
              }
            />
          </div>
        );
      })}
    </div>
  );
};
