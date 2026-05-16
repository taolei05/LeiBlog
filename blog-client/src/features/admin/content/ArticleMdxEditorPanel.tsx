import { Card, Chip } from "@heroui/react";
import { useState } from "react";

import { MdxEditorField } from "../../../shared/mdx/MdxEditorField";
import { allowedMdxJsxComponentNames } from "../../../shared/mdx/mdxWhitelist";
import { useAdminSession } from "../../../shared/routing/adminGuards";
import { blogArticles } from "../../blog/shared/blogContent";

export function ArticleMdxEditorPanel() {
  const session = useAdminSession();
  const [draftMdx, setDraftMdx] = useState(blogArticles[0]?.contentMdx ?? "");

  return (
    <Card className="admin-mdx-card">
      <Card.Header>
        <Card.Title>正文编辑</Card.Title>
        <Card.Description>MDX 正文、图片链接和自定义组件在这里预览。</Card.Description>
      </Card.Header>
      <div className="admin-mdx-card__toolbar">
        {allowedMdxJsxComponentNames.map((name) => (
          <Chip key={name} size="sm" variant="soft">
            <Chip.Label>{name}</Chip.Label>
          </Chip>
        ))}
      </div>
      <MdxEditorField
        aria-label="文章 MDX 编辑器"
        onChange={setDraftMdx}
        readOnly={session.isReadOnly}
        value={draftMdx}
      />
    </Card>
  );
}
