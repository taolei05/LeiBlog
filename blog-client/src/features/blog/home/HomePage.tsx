import { Card } from "@heroui/react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { AppIcon } from "../../../shared/icons/AppIcon";
import { ArticleCard, EmptyPlaceholder, FrontActionLink } from "../shared/BlogComponents";
import {
  deriveBlogCategories,
  deriveBlogTags,
  fetchPublicArticles,
  type BlogArticle,
} from "../shared/blogApi";

export function BlogHomePage() {
  const [articles, setArticles] = useState<BlogArticle[]>([]);
  const [status, setStatus] = useState<"error" | "idle" | "loading">("loading");
  const featuredArticle = articles[0];
  const categories = useMemo(() => deriveBlogCategories(articles), [articles]);
  const tags = useMemo(() => deriveBlogTags(articles), [articles]);

  useEffect(() => {
    let isActive = true;

    async function loadArticles() {
      try {
        setStatus("loading");
        const nextArticles = await fetchPublicArticles({ pageSize: 12 });
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
  }, []);

  return (
    <section className="front-stack">
      <header className="front-hero">
        {featuredArticle?.cover ? (
          <img alt="" className="front-hero__image" src={featuredArticle.cover} />
        ) : null}
        <div className="front-hero__overlay" />
        <div className="front-hero__content">
          <p className="eyebrow">内容优先的个人博客</p>
          <h1>LeiBlog</h1>
          <p>{featuredArticle?.excerpt ?? "正在从数据库读取最新发布内容。"}</p>
          <div className="front-hero__actions">
            <FrontActionLink icon="reader" to="/articles">
              浏览文章
            </FrontActionLink>
            <FrontActionLink icon="personCircle" to="/about-author">
              关于作者
            </FrontActionLink>
          </div>
        </div>
      </header>

      <section className="front-section">
        <div className="front-section__heading">
          <p className="eyebrow">最近文章</p>
          <h2>从数据库里的新内容开始</h2>
        </div>
        {articles.length > 0 ? (
          <div className="article-grid">
            {articles.slice(0, 3).map((article) => (
              <ArticleCard article={article} key={article.slug} />
            ))}
          </div>
        ) : (
          <EmptyPlaceholder text={status === "error" ? "文章接口暂时不可用。" : "正在读取文章。"} />
        )}
      </section>

      {categories.length > 0 ? (
        <section className="front-section front-section--split">
          <div className="front-section__heading">
            <p className="eyebrow">分类入口</p>
            <h2>按主题继续阅读</h2>
          </div>
          <div className="front-category-grid">
            {categories.map((category) => (
              <Card className="front-category-card" key={category.slug}>
                <AppIcon name={category.icon} size={24} />
                <Card.Header>
                  <Card.Title>{category.name}</Card.Title>
                  <Card.Description>{category.description}</Card.Description>
                </Card.Header>
                <Link to={`/categories?category=${encodeURIComponent(category.slug)}`}>
                  {category.count} 篇文章
                </Link>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      {tags.length > 0 ? (
        <section className="front-section front-tag-band">
          <div>
            <p className="eyebrow">标签入口</p>
            <h2>把线索摊开</h2>
          </div>
          <div className="front-tag-list">
            {tags.map((tag) => (
              <Link key={tag.slug} to={`/tags?tag=${encodeURIComponent(tag.slug)}`}>
                #{tag.name}
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </section>
  );
}
