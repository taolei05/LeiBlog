import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vite-plus/test";

import { MediaAssetField, MultiMediaAssetField } from "./media-asset-field";
import { i18n } from "../../../../shared/i18n";

describe.each(["single", "multiple"])("%s media library entry", (kind) => {
  const render = (options: {
    token?: string;
    isDisabled?: boolean;
    allowMediaLibrary?: boolean;
  }) => {
    const props = {
      folderSlug: "site",
      label: "Site image",
      onChange: vi.fn(),
      ...options,
    };
    return renderToStaticMarkup(
      kind === "single"
        ? createElement(MediaAssetField, { ...props, value: "", onLocalFileChange: vi.fn() })
        : createElement(MultiMediaAssetField, {
            ...props,
            values: [],
            localFiles: [],
            onLocalFilesChange: vi.fn(),
          }),
    );
  };
  const libraryLabel = () => i18n.t("admin.mediaAssetField.chooseFromLibrary");

  it.each(["", "explicit-bearer-token"])("allows authenticated transport %j", (token) => {
    expect(render({ token })).toContain(libraryLabel());
  });
  it("hides the entry when authentication is not supplied", () => {
    expect(render({})).not.toContain(libraryLabel());
  });
  it("keeps setup and disabled fields from opening the library", () => {
    expect(render({ token: "", allowMediaLibrary: false })).not.toContain(libraryLabel());
    expect(render({ token: "", isDisabled: true })).not.toContain(libraryLabel());
  });
});
