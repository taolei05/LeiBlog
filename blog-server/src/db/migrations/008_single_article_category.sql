WITH ranked_article_categories AS (
  SELECT
    article_id,
    category_id,
    row_number() OVER (
      PARTITION BY article_id
      ORDER BY created_at ASC, category_id ASC
    ) AS position
  FROM article_category_links
)
DELETE FROM article_category_links links
USING ranked_article_categories ranked
WHERE links.article_id = ranked.article_id
  AND links.category_id = ranked.category_id
  AND ranked.position > 1;

ALTER TABLE article_category_links
DROP CONSTRAINT IF EXISTS article_category_links_pkey;

ALTER TABLE article_category_links
ADD CONSTRAINT article_category_links_pkey PRIMARY KEY (article_id);
