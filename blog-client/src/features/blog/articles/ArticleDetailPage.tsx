import { Chip } from "@heroui/react";
import { Link, useParams } from "react-router-dom";

import { AppIcon } from "../../../shared/icons";
import { MdxRenderer } from "../../../shared/mdx/MdxRenderer";
import { CommentThread } from "../shared/CommentThread";
import { getArticleBySlug } from "../shared/blogContent";

export function BlogArticleDetailPage() {
  const { slug } = useParams();
  const article = getArticleBySlug(slug);

  return (
    <section className="article-reading-layout">
      <article className="article-detail">
        <nav aria-label="文章面包屑" className="front-breadcrumbs">
          <Link to="/">
            <AppIcon name="home" />
            首页
          </Link>
          <Link to="/articles">
            <AppIcon name="reader" />
            文章
          </Link>
          <span>{article.title}</span>
        </nav>

        <header className="article-detail__header">
          <p className="eyebrow">{article.category}</p>
          <h1>{article.title}</h1>
          <p>{article.excerpt}</p>
          <div className="article-detail__meta">
            <span>{article.date}</span>
            <span>{article.readTime}</span>
            {article.tags.map((tag) => (
              <Chip key={tag} size="sm" variant="soft">
                <Chip.Label>#{tag}</Chip.Label>
              </Chip>
            ))}
          </div>
        </header>

        <img alt={article.title} className="article-detail__cover" src={article.cover} />

        <MdxRenderer>{article.renderMdx}</MdxRenderer>

        <footer className="article-detail__footer">
          <Link className="front-action-link" to="/articles">
            <AppIcon name="chevronBack" />
            返回文章列表
          </Link>
        </footer>

        <CommentThread
          description="评论支持回复、用户标签和审核状态，真实数据会接入 /api/articles/:id/comments。"
          target="article"
          title="文章评论"
        />
      </article>

      <aside aria-label="文章目录" className="article-toc">
        <p>本篇目录</p>
        <nav>
          {article.toc.map((item) => (
            <a href={`#${item.id}`} key={item.id}>
              {item.title}
            </a>
          ))}
        </nav>
      </aside>
    </section>
  );
}
