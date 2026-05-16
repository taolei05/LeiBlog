import { SearchField } from "@heroui/react";
import { useDeferredValue } from "react";
import { useSearchParams } from "react-router-dom";

import { ArticleCard, BlogPageHeader, EmptyPlaceholder } from "../shared/BlogComponents";
import { blogArticles } from "../shared/blogContent";

export function BlogArticlesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get("q") ?? "";
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const filteredArticles = blogArticles.filter((article) => {
    if (!deferredQuery) return true;

    return `${article.title} ${article.excerpt} ${article.category} ${article.tags.join(" ")}`
      .toLowerCase()
      .includes(deferredQuery);
  });

  return (
    <section className="front-stack">
      <BlogPageHeader
        description="文章列表先接入前端搜索和稳定卡片布局，真实接口会在后续 API 阶段替换。"
        eyebrow="文章"
        icon="reader"
        title="文章列表"
      />
      <SearchField
        aria-label="搜索文章列表"
        className="front-page-search"
        fullWidth
        onChange={(value) => {
          const nextParams = new URLSearchParams(searchParams);

          if (value) {
            nextParams.set("q", value);
          } else {
            nextParams.delete("q");
          }

          setSearchParams(nextParams, { replace: true });
        }}
        value={query}
        variant="secondary"
      >
        <SearchField.Group>
          <SearchField.SearchIcon />
          <SearchField.Input placeholder="搜索标题、分类、标签" />
          <SearchField.ClearButton />
        </SearchField.Group>
      </SearchField>
      {filteredArticles.length > 0 ? (
        <div className="article-list">
          {filteredArticles.map((article) => (
            <ArticleCard article={article} key={article.slug} />
          ))}
        </div>
      ) : (
        <EmptyPlaceholder text="没有匹配的文章。" />
      )}
    </section>
  );
}
