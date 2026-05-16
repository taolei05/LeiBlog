import { Button } from "@heroui/react";
import { useNavigate } from "react-router-dom";

import { AppIcon } from "../../shared/icons/AppIcon";

export function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <main className="error-page">
      <div className="error-page__content">
        <p className="eyebrow">404</p>
        <div className="error-page__icon" aria-hidden="true">
          <AppIcon name="search" size={28} />
        </div>
        <h1>页面没有找到</h1>
        <p>你访问的地址不存在，或这个页面还没有进入当前前端阶段。</p>
        <div className="action-row">
          <Button onPress={() => navigate("/")}>返回首页</Button>
          <Button variant="secondary" onPress={() => navigate("/admin")}>
            前往后台
          </Button>
        </div>
      </div>
    </main>
  );
}
