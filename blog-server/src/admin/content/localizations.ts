import type { Sql, TransactionSql } from "postgres";

import type { ArticleInput, ArticlePatchInput, CategoryInput, TagInput } from "./service";

type ContentSql = Sql | TransactionSql;

const cleanOptionalText = (value: string | null | undefined) => {
  const text = value?.trim() ?? "";
  return text.length > 0 ? text : null;
};

export const upsertArticleEn = async ({
  articleId,
  input,
  sql,
}: {
  articleId: string;
  input: ArticleInput | ArticlePatchInput;
  sql: ContentSql;
}) => {
  const localization = input.localizations?.en;
  if (localization === undefined) return;

  await sql`
    INSERT INTO articles_en (article_id, title, summary, content_mdx)
    VALUES (
      ${articleId}, ${cleanOptionalText(localization.title)},
      ${cleanOptionalText(localization.summary)}, ${cleanOptionalText(localization.contentMdx)}
    )
    ON CONFLICT (article_id) DO UPDATE SET
      title = CASE WHEN ${localization.title !== undefined} THEN EXCLUDED.title ELSE articles_en.title END,
      summary = CASE WHEN ${localization.summary !== undefined} THEN EXCLUDED.summary ELSE articles_en.summary END,
      content_mdx = CASE WHEN ${localization.contentMdx !== undefined} THEN EXCLUDED.content_mdx ELSE articles_en.content_mdx END
  `;
};

export const upsertCategoryEn = async ({
  categoryId,
  input,
  sql,
}: {
  categoryId: string;
  input: CategoryInput;
  sql: ContentSql;
}) => {
  const localization = input.localizations?.en;
  if (localization === undefined) return;

  await sql`
    INSERT INTO article_categories_en (category_id, name, description)
    VALUES (${categoryId}, ${cleanOptionalText(localization.name)}, ${cleanOptionalText(localization.description)})
    ON CONFLICT (category_id) DO UPDATE SET
      name = CASE WHEN ${localization.name !== undefined} THEN EXCLUDED.name ELSE article_categories_en.name END,
      description = CASE WHEN ${localization.description !== undefined} THEN EXCLUDED.description ELSE article_categories_en.description END
  `;
};

export const upsertTagEn = async ({
  input,
  sql,
  tagId,
}: {
  input: TagInput;
  sql: ContentSql;
  tagId: string;
}) => {
  const localization = input.localizations?.en;
  if (localization === undefined) return;

  await sql`
    INSERT INTO article_tags_en (tag_id, name, description)
    VALUES (${tagId}, ${cleanOptionalText(localization.name)}, ${cleanOptionalText(localization.description)})
    ON CONFLICT (tag_id) DO UPDATE SET
      name = CASE WHEN ${localization.name !== undefined} THEN EXCLUDED.name ELSE article_tags_en.name END,
      description = CASE WHEN ${localization.description !== undefined} THEN EXCLUDED.description ELSE article_tags_en.description END
  `;
};
