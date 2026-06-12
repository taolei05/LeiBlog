import { describe, expect, test } from "bun:test";

import { renderCommentNotificationEmailHtml } from "../src/auth/service";

describe("comment notification emails", () => {
  test("renders comment notification content inside the LeiBlog email shell", () => {
    const html = renderCommentNotificationEmailHtml({
      content: '<script>alert("x")</script>\n第二行 & Tom\'s reply',
      description: '张三在《测试文章》文章评论了： <script>alert("desc")</script> & Tom\'s note',
      title: "新评论通知",
    });

    expect(html).toContain("<!doctype html>");
    expect(html).toContain("LeiBlog");
    expect(html).toContain("张三在《测试文章》文章评论了：");
    expect(html).toContain(
      "张三在《测试文章》文章评论了： &lt;script&gt;alert(&quot;desc&quot;)&lt;/script&gt; &amp; Tom&#39;s note"
    );
    expect(html).not.toContain('<script>alert("desc")</script>');
    expect(html).toContain("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
    expect(html).toContain("第二行 &amp; Tom&#39;s reply");
    expect(html).not.toContain('<script>alert("x")</script>');
    expect(html).toContain("white-space:pre-wrap");
    expect(html).toContain("word-break:break-word");
  });
});
