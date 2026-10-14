import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";

import { updateUploadProgress, UploadProgressList } from "./upload-progress";
import type { UploadProgress } from "./upload-request";

const upload: UploadProgress = {
  id: "upload-1",
  fileName: "photo.png",
  loaded: 25,
  total: 100,
  phase: "uploading",
};

describe("shared upload ProgressBar", () => {
  it("renders no idle bar", () => {
    expect(
      renderToStaticMarkup(createElement(UploadProgressList, { language: "en", uploads: [] })),
    ).toBe("");
  });
  it.each(["en", "zh-CN"] as const)("renders real percentage in %s", (language) => {
    const markup = renderToStaticMarkup(
      createElement(UploadProgressList, { language, uploads: [upload] }),
    );
    expect(markup).toContain('role="progressbar"');
    expect(markup).toContain('aria-valuenow="25"');
    expect(markup).toContain(language === "en" ? "Uploading" : "上传中");
    expect(markup).toContain("photo.png");
  });
  it("does not display a numeric 100% while server processing is pending", () => {
    const markup = renderToStaticMarkup(
      createElement(UploadProgressList, {
        language: "en",
        uploads: [{ ...upload, loaded: 100, phase: "processing" }],
      }),
    );
    expect(markup).toContain("Processing");
    expect(markup).not.toContain("aria-valuenow");
    expect(markup).not.toContain("100%");
  });
  it("tracks concurrent uploads separately and resets finished batches", () => {
    const second: UploadProgress = { ...upload, id: "upload-2" };
    const concurrent = updateUploadProgress([upload], second);
    expect(concurrent).toHaveLength(2);
    const completed = updateUploadProgress(concurrent, { ...upload, phase: "complete" });
    expect(completed[1]).toEqual(second);
    expect(updateUploadProgress(completed, { ...second, phase: "error" })).toHaveLength(2);
    expect(
      updateUploadProgress(
        completed.map((item) => ({ ...item, phase: "complete" })),
        {
          ...upload,
          id: "upload-3",
        },
      ),
    ).toHaveLength(1);
  });
});
