import { Button } from "@heroui/react";
import { useNavigate } from "react-router-dom";

import { AppIcon } from "../../shared/icons/AppIcon";

export function ServerErrorPage() {
  const navigate = useNavigate();

  return (
    <main className="error-page">
      <div className="error-page__content">
        <p className="eyebrow">500</p>
        <div className="error-page__icon" aria-hidden="true">
          <AppIcon name="server" size={28} />
        </div>
        <h1>服务暂时不可用</h1>
        <p>这是一页前端错误态占位，后续会接入真实异常边界和错误恢复入口。</p>
        <div className="action-row">
          <Button onPress={() => navigate("/")}>返回首页</Button>
          <Button variant="secondary" onPress={() => navigate(-1)}>
            返回上一页
          </Button>
        </div>
      </div>
    </main>
  );
}
