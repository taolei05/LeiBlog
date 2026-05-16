import { Card } from "@heroui/react";
import { Link } from "react-router-dom";

import { AppIcon } from "../../../shared/icons/AppIcon";
import { ArticleCard, FrontActionLink } from "../shared/BlogComponents";
import { blogArticles, blogCategories, blogTags } from "../shared/blogContent";

export function BlogHomePage() {
  const featuredArticle = blogArticles[0]!;

  return (
    <section className="front-stack">
      <header className="front-hero">
        <img alt="" className="front-hero__image" src={featuredArticle.cover} />
        <div className="front-hero__overlay" />
        <div className="front-hero__content">
          <p className="eyebrow">内容优先的个人博客</p>
          <h1>LeiBlog</h1>
          <p>记录工程、前端、摄影和那些值得慢慢写下来的瞬间。</p>
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
          <h2>从正在发生的工程现场开始</h2>
        </div>
        <div className="article-grid">
          {blogArticles.slice(0, 3).map((article) => (
            <ArticleCard article={article} key={article.slug} />
          ))}
        </div>
      </section>

      <section className="front-section front-section--split">
        <div className="front-section__heading">
          <p className="eyebrow">分类入口</p>
          <h2>按主题继续阅读</h2>
        </div>
        <div className="front-category-grid">
          {blogCategories.map((category) => (
            <Card className="front-category-card" key={category.name}>
              <AppIcon name={category.icon} size={24} />
              <Card.Header>
                <Card.Title>{category.name}</Card.Title>
                <Card.Description>{category.description}</Card.Description>
              </Card.Header>
              <Link to={`/categories?category=${encodeURIComponent(category.name)}`}>
                {category.count} 篇文章
              </Link>
            </Card>
          ))}
        </div>
      </section>

      <section className="front-section front-tag-band">
        <div>
          <p className="eyebrow">标签入口</p>
          <h2>把线索摊开</h2>
        </div>
        <div className="front-tag-list">
          {blogTags.map((tag) => (
            <Link key={tag} to={`/tags?tag=${encodeURIComponent(tag)}`}>
              #{tag}
            </Link>
          ))}
        </div>
      </section>
    </section>
  );
}
