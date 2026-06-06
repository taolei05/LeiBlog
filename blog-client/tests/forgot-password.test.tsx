import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { ForgotPasswordPage } from "../src/features/blog/auth/AuthPages";

describe("ForgotPasswordPage", () => {
  it("renders a complete email verification password reset form", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <ForgotPasswordPage />
      </MemoryRouter>,
    );

    expect(html).toContain("发送验证码");
    expect(html).toContain("验证码");
    expect(html).toContain("新密码");
    expect(html).toContain("确认密码");
    expect(html).toContain("重置密码");
  });
});
