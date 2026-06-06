import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AdminInputGroupField } from "../src/features/admin/shared/admin-form-modal";

describe("password inputs", () => {
  it("renders the shared visibility toggle for admin password fields", () => {
    const html = renderToStaticMarkup(
      <AdminInputGroupField
        icon="lockClosed"
        label="密码"
        onChange={() => undefined}
        type="password"
        value=""
      />,
    );

    expect(html).toContain('type="password"');
    expect(html).toContain('aria-label="显示密码"');
  });
});
