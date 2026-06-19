import { describe, expect, it } from "vitest";

import blogApiSource from "../src/features/blog/shared/blogApi.ts?raw";
import commentThreadSource from "../src/features/blog/shared/CommentThread.tsx?raw";

describe("comment author profile link", () => {
  it("keeps the author's blog URL in the public comment model", () => {
    expect(blogApiSource).toContain("blogUrl: string | null;");
    expect(blogApiSource).toContain('blogUrl: readNullableString(authorValue, "blogUrl")');
  });

  it("renders linked author names with HeroUI Link and improves avatar fallback styling", () => {
    expect(commentThreadSource).toContain("Link,");
    expect(commentThreadSource).toContain("comment.author.blogUrl ? (");
    expect(commentThreadSource).toContain("<Link");
    expect(commentThreadSource).toContain('target="_blank"');
    expect(commentThreadSource).toContain('rel="noreferrer"');
    expect(commentThreadSource).toContain("comment-item__avatar-fallback");
    expect(commentThreadSource).toContain("getCommentAvatarInitials(authorName)");
  });
});
