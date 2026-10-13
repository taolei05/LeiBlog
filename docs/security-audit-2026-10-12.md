# LeiBlog 项目审查与修复记录

审查日期：2026-10-12。范围包括前后台页面、共享 API、Elysia 路由与服务、身份认证、ALTCHA、媒体与备份、依赖、Docker 开发配置。保留了工作区已有修改，没有创建分支、提交或推送。

## 已修复问题

| 优先级 | 问题与影响 | 修复位置及行为 |
| --- | --- | --- |
| P1 | ALTCHA 用原始载荷文本防重放，换 JSON 排版、Base64 编码或解题元数据可绕过 | `blog-server/src/shared/altcha.ts` 按已验证的挑战签名生成稳定键，Redis 原子单次消费，Redis 故障时拒绝通过 |
| P1 | 六位邮箱验证码没有跨 IP 的猜测上限，并发消费及旧码回退存在风险 | `shared/email-verification.ts` 限制邮箱/用途 10 分钟内最多 5 次尝试；注册、密码重置与后台密钥查看均检查原子消费结果，最新验证码是唯一有效码 |
| P1 | 邮件配置不可用时可能暴露可用的开发验证码 | `blog/auth/service.ts` 发送失败使验证码失效并返回服务不可用，不向客户端返回验证码 |
| P1 | 修改密码、重置密码、管理员修改用户角色后，旧后台会话可能继续生效 | `admin/auth/service.ts` 和 `admin/users/service.ts` 使用数据库撤销状态；每次校验同时检查有效期和实时管理员角色，Redis 清理失败也不会绕过撤销 |
| P1 | 旧后台会话的哈希由可预测值派生，可能被当前台会话使用 | 后台会话使用随机秘密的哈希，前后台会话认证隔离 |
| P1 | GitHub 未验证的公开邮箱可能关联已有本地账号；OAuth 缺少浏览器绑定 | `blog/auth/oauth.ts` 仅使用已验证邮箱；回调必须匹配 HttpOnly 状态 Cookie，状态单次消费，返回地址限定前台来源 |
| P1 | 上传主要依赖扩展名；存储路径存在目录穿越和符号链接风险 | `admin/media/file-policy.ts` 校验文件内容与格式，拒绝 SVG；`storage-path.ts` 限制规范存储键及符号链接 |
| P1 | ZIP 解压与备份恢复缺少资源上限、完整性预检，恢复失败可能覆盖旧媒体 | `admin/backup/archive.ts` 限制实际解压输出；`payload.ts` 检查完整表集合、文件清单、大小、CRC/校验和及媒体内容；恢复写入新目录，失败时回滚并清理新文件 |
| P1 | 带凭据的通配 CORS、缺少统一跨站写请求保护 | `shared/cors-policy.ts` 拒绝通配凭据来源；写请求校验 Origin/Referer，携带 Cookie 却缺少来源证明时拒绝执行 |
| P1 | 后台 JWT 保存在 localStorage | 网页后台使用 HttpOnly Cookie，生产环境使用 Secure、SameSite=Lax 和 `__Host-` 前缀；网页登录响应不返回 JWT；启动时清除旧本地凭据，通过服务器恢复会话。Bearer API 客户端保留 |
| P1 | 生产环境可沿用公开默认密钥；首次安装入口可被抢先注册 | `shared/env.ts` 对生产密钥、HTTPS 来源、连接地址和初始密码强制校验；生产禁用首次安装写接口；初始化并发通过锁保证只创建一位管理员 |
| P1 | PostgreSQL、无密码 Redis 的本地 Docker 端口默认向所有网卡暴露 | `compose.yml` 改为仅绑定 127.0.0.1，已重新应用，数据卷保留 |
| P2 | 信任代理后直接取 X-Forwarded-For 首项，攻击者可伪造 IP 绕过限流 | `shared/request-meta.ts` 从可信代理链右侧逐跳解析，在首个不可信或非法节点停止，统一 IPv4 映射 IPv6 |
| P2 | 缺少 API 限流、真实请求体上限、安全响应头；异常可能泄露输入或数据库细节 | `shared/request-security.ts` 和 `request-body.ts` 增加 Redis 原子限流、流式大小检查、CSP/no-sniff/防嵌入头、API 禁缓存及错误脱敏 |
| P2 | R2 配置可影响请求目标，且默认跟随重定向 | `admin/media/r2-storage.ts` 校验账户 ID、桶名、对象键，禁止重定向并设置超时；非法配置在网络访问前拒绝 |
| P2 | 文章、用户外链和编辑器预览缺少统一 URL 协议校验 | 前端 `shared/content-url.ts` 与后端 `admin/content/input-policy.ts` 对链接和媒体协议做白名单检查；文章 HTML/MDX 表达式按文本转义 |
| P2 | ALTCHA 弹窗的过期载荷、延迟回调和连续点击可能执行错误动作 | `shared/altcha-verification.ts` 使用请求编号隔离回调，取消时结束待处理 Promise，过期/错误时清空载荷，提交使用同步防重入保护 |
| P2 | 启动会话请求可能覆盖更新后的登录状态；错误响应形状可能触发递归渲染 | 会话版本检查防止过期异步响应覆盖新状态；API 验证分页、可选字段及评论 ID 唯一性 |
| P2 | 局部更新英文内容时，省略的翻译字段可能被清空；非法发布时间可能被当作立即发布 | `admin/content/localizations.ts` 保留省略字段，仅显式空值清除；非法时间和无日期的定时发布被拒绝 |
| P2 | 外部翻译、邮件发送和存储请求缺少超时 | 相关请求增加 10 秒或 30 秒超时，失败按现有错误流程返回 |
| P2 | 前端依赖存在已知拒绝服务漏洞 | 固定 `js-yaml` 为 4.3.2、`source-map-js` 为 1.2.2，更新 Bun 锁文件，当前两端 `bun audit` 均为零已知漏洞 |

## 代码质量与性能

- 提取了可单独验证的来源校验、请求体读取、验证码尝试限制、内容 URL/时间检查、媒体内容/路径检查、ZIP 预检和翻译局部更新模块。
- 前后台格式检查、前端 lint 和类型检查通过。修复源文件 lint 告警；Astryx 生成的声明文件保留其必需的三斜线引用，通过单文件 lint 配置豁免。
- `bun run check` 只检查；需要自动修改时使用 `bun run check:fix`。
- 增加项目根目录 `check.sh` 和 `blog-server/scripts/security-tests.sh`。后者使用随机本地端口、一次性容器和模拟记录，不读取实际用户资料或调用真实邮件/OAuth 服务。
- 后台管理页、初始化页按需加载，文章编辑器样式也随编辑器加载。后台入口 JS 由约 1,843 KB 降至约 90 KB；这是入口文件大小，公共依赖仍需下载，不等于整个首屏网络传输量。加载失败提供重新加载入口。

## 验证

- 后端：类型检查、84 项单元/请求回归测试。
- 真实隔离 PostgreSQL/Redis：20 项认证安全测试，包括验证码并发、ALTCHA 重放、OAuth 绑定、Cookie 登录/退出、会话撤销、首次安装并发和密文篡改。
- 前端：50 项测试、完整格式/lint/类型检查、生产构建。
- 前后端依赖审计、Shell 语法检查及 Compose 配置/运行状态检查。

复现：项目根目录执行 `./check.sh`；后端目录执行 `bun run test:security`。

## 部署与后续边界

这些结果是代码与本机验证，不是公网渗透测试或“没有任何漏洞”的保证。遵循已有项目偏好，本次没有使用浏览器自动化；需要真实浏览器补测 Cookie、弹窗焦点、移动端、懒加载失败和实际 OAuth/邮件链路。

- HTTPS、前端 HTML 的 CSP/防嵌入策略、反向代理来源处理、可信代理名单、生产数据库/Redis 网络隔离，需要在实际部署环境验证。API 的 CSP 不会自动作用于独立部署的前端 HTML。
- 网页后台旧 localStorage 会话会被清除，需要重新登录一次。前端和 API 应采用相同站点域名策略；跨注册域名 Cookie 需要单独设计。
- 既有 SVG 文件和历史数据未批量改写。备份预检会拒绝旧 SVG 媒体；需先转换为受支持的图片格式。R2 上历史 SVG 还需由存储服务限制活跃内容。
- 备份保留恢复所必需的密码哈希和个人资料，需限制归档访问并考虑存储加密。恢复仍应先在独立环境演练；本次没有覆盖现有数据库执行真实全站恢复。
- 数据量增长后，需要扩展备份流式处理能力，替代当前 64 MiB 压缩/256 MiB 解压上限。R2 下载已按实际流量限制在 64 MiB，备份接口另有限流；备份生成仍在内存中完成。
- `ContentManagementPage`、设置页、用户页、共享 API 文件仍较大，可按资源/表单分拆。当前已提取高风险策略模块；进一步拆分应配合实际工作流回归测试。
- 构建保留依赖的 `use client` 指令和部分大分块告警；后台编辑器仍是较大懒加载块，后续可继续缩减语言模块和前台公共依赖。

参考：[MDN CSRF](https://developer.mozilla.org/en-US/docs/Web/Security/Attacks/CSRF)、[Elysia 生命周期](https://elysiajs.com/essential/life-cycle)、[js-yaml 公告](https://github.com/advisories/GHSA-2883-xcg3-v3hh)、[source-map-js 公告](https://github.com/advisories/GHSA-68fv-2mgg-jv7q)。
