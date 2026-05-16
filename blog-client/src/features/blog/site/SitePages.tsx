import { Card } from "@heroui/react";

import { AppIcon } from "../../../shared/icons";
import { BlogPageHeader } from "../shared/BlogComponents";
import { CommentThread } from "../shared/CommentThread";

export function AboutSitePage() {
  return (
    <section className="front-stack">
      <BlogPageHeader
        description="这里会记录站点的技术栈、内容边界和更新计划。"
        eyebrow="站点"
        icon="library"
        title="关于本站"
      />
      <div className="site-story-grid">
        <Card className="site-story-card">
          <AppIcon name="server" size={24} />
          <Card.Header>
            <Card.Title>技术栈</Card.Title>
            <Card.Description>Bun、Elysia、PostgreSQL、React 19、HeroUI v3。</Card.Description>
          </Card.Header>
        </Card>
        <Card className="site-story-card">
          <AppIcon name="reader" size={24} />
          <Card.Header>
            <Card.Title>内容边界</Card.Title>
            <Card.Description>工程实践、前端体验、摄影观察和个人写作。</Card.Description>
          </Card.Header>
        </Card>
        <Card className="site-story-card">
          <AppIcon name="calendar" size={24} />
          <Card.Header>
            <Card.Title>更新节奏</Card.Title>
            <Card.Description>保持低噪声更新，先把真正有用的内容写完整。</Card.Description>
          </Card.Header>
        </Card>
      </div>
    </section>
  );
}

export function AboutAuthorPage() {
  return (
    <section className="front-stack about-author">
      <BlogPageHeader
        description="作者页先保留个人信息、标签和社交链接区域，后续和用户资料接口打通。"
        eyebrow="站点"
        icon="personCircle"
        title="关于作者"
      />
      <div className="author-panel">
        <img
          alt="作者工作桌面"
          src="https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1200&q=80"
        />
        <div>
          <p>
            我喜欢把复杂系统拆成能解释清楚的小块，也喜欢在夜晚出门拍一点城市光线。这个博客会慢慢变成工程和生活的交汇处。
          </p>
          <div className="front-tag-list">
            {["全栈", "写作", "摄影", "React", "Elysia"].map((tag) => (
              <span key={tag}>#{tag}</span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function GuestbookPage() {
  return (
    <section className="front-stack">
      <BlogPageHeader
        description="留言板复用评论系统，支持登录用户留言、回复和后台审核。"
        eyebrow="站点"
        icon="chatbubbles"
        title="留言板"
      />
      <CommentThread
        description="这里的数据目标类型是 guestbook，和文章评论分开筛选。"
        target="guestbook"
        title="站点留言"
      />
    </section>
  );
}
