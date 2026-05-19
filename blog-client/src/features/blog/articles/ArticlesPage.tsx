import { SearchField } from "@heroui/react";
import { useDeferredValue, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { ArticleCard, BlogPageHeader, EmptyPlaceholder } from "../shared/BlogComponents";
import { fetchPublicArticles, type BlogArticle } from "../shared/blogApi";

export function BlogArticlesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [articles, setArticles] = useState<BlogArticle[]>([]);
  const [status, setStatus] = useState<"error" | "idle" | "loading">("loading");
  const query = searchParams.get("q") ?? "";
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());

  useEffect(() => {
    let isActive = true;

    async function loadArticles() {
      try {
        setStatus("loading");
        const nextArticles = await fetchPublicArticles({
          pageSize: 100,
          search: deferredQuery,
        });
        if (!isActive) return;
        setArticles(nextArticles);
        setStatus("idle");
      } catch {
        if (!isActive) return;
        setArticles([]);
        setStatus("error");
      }
    }

    void loadArticles();

    return () => {
      isActive = false;
    };
  }, [deferredQuery]);

  return (
    <section className="front-stack">
      <BlogPageHeader
        description="从后端公开接口读取已发布文章，搜索会同步到接口查询参数。"
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
      {articles.length > 0 ? (
        <div className="article-list">
          {articles.map((article) => (
            <ArticleCard article={article} key={article.slug} />
          ))}
        </div>
      ) : (
        <EmptyPlaceholder text={status === "error" ? "文章接口暂时不可用。" : "没有匹配的文章。"} />
      )}
    </section>
  );
}
