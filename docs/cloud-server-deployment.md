# LeiBlog 新项目生产部署

部署入口为 `deploy/leiblog.sh`，保持旧项目的 `leiblog` 运维命令。Linux 上使用 Docker Compose：Caddy 提供 HTTPS 和前后台静态入口，Bun/Elysia 提供 API，PostgreSQL 17 与带密码的 Redis 7 只连接私有网络。API 使用非 root 用户，根文件系统只读；上传文件、数据库和证书持久化。

## 上线前

1. **先提交并推送本次完整改动到部署分支。** 当前脚本默认下载 `taolei05/LeiBlog` 的 `main` 源码。本地新增文件未推送时，远程安装命令不会获得它们，脚本会拒绝旧源码。
2. 准备 Linux 服务器、真实域名与管理员邮箱。建议至少 2 核、4 GB 内存以及足够保存媒体、镜像和备份的磁盘；前端构建比运行时更耗内存。
3. 将域名 A/AAAA 记录指向服务器，允许入站 TCP 80/443；HTTP/3 可额外开放 UDP 443。不要开放数据库、Redis 或 API 的内部端口。
4. 安装 Docker Compose v2，需支持 `up --wait`。未安装 Docker 时脚本会使用 Docker 官方安装器；不希望自动安装时设置 `LEIBLOG_INSTALL_DOCKER=0`。
5. **不得覆盖旧项目的部署目录、数据库或 Compose 项目名。** 旧项目 `.env` 和备份格式不兼容。仍运行旧项目时，给新项目使用不同目录和项目名；80/443 被占用时先明确安排域名/端口切换。

## 安装

已拿到新源码时，优先从本地已检查的脚本安装：

```bash
sudo bash deploy/leiblog.sh install-cli
sudo env LEIBLOG_ADMIN_EMAIL=you@example.com leiblog install blog.example.com
```

部署分支推送完成后，远程安装全局命令：

```bash
curl -fsSL https://raw.githubusercontent.com/taolei05/LeiBlog/main/deploy/leiblog.sh -o leiblog.sh
bash -n leiblog.sh
sudo bash leiblog.sh install-cli
sudo env LEIBLOG_ADMIN_EMAIL=you@example.com leiblog install blog.example.com
```

脚本下载源码、构建镜像、创建私有网络与随机密钥，自动申请和续期 TLS 证书，等待 API 健康，然后检查公网 HTTPS、前台和后台入口。生产安装不使用旧项目 `SETUP_TOKEN` 或网页初始化。

初始登录资料只写入 `/var/leiblog/bootstrap-credentials.txt`，权限为 600，不输出密码到部署日志。管理员成功创建后，脚本清空 `.env` 中的初始密码并重建 API，避免长期留在容器环境中。

```bash
sudo cat /var/leiblog/bootstrap-credentials.txt
sudo leiblog doctor
```

登录 `https://blog.example.com/admin`，立即修改初始密码，然后删除上述凭据文件。在后台完善站点资料、Resend 发信域名/API key，以及需要使用的 OAuth、R2 和翻译配置。邮件发送域名需实际配置 SPF/DKIM，并验证邮件投递；OAuth 服务商需配置真实 HTTPS 回调地址。

## 配置和更新

默认运行目录 `/var/leiblog`，`.env` 权限 600，保存当前域名、基础服务密码和三把应用密钥。配置仅支持脚本生成的简单 `KEY=value` 行，不使用 shell `source` 执行文件，也不支持任意 shell 表达式。

**不要随意更改 `CONFIG_ENCRYPTION_SECRET`**，否则已有 API key 和 OAuth 密钥无法解密。不要直接修改已有 PostgreSQL/Redis 密码、Compose 项目名或内网地址；密码变更还需同步服务内部凭据，单纯编辑 `.env` 不是完整的轮换操作。

```bash
sudo leiblog update
sudo leiblog update --domain new.example.com
sudo leiblog domain new.example.com
sudo leiblog status
sudo leiblog logs api
sudo leiblog stop
sudo leiblog start
sudo leiblog restart
```

更新会先短暂停止 API 进行一致性备份，再下载、构建并等待健康检查。构建期间旧容器仍可运行；新容器启动时存在短暂切换，不是零停机部署。旧源码目录保留为 `source.previous.*`，确认新版本稳定后可自行清理。

数据库迁移使用事务与 PostgreSQL 锁；管理员初始化也使用事务锁，防止多个启动进程竞争。没有自动将数据库回退到旧模式，健康检查失败时需要查日志，并根据情况恢复更新前备份；不要盲目重复更新。

离线/本地源码部署可使用 `LEIBLOG_SOURCE_DIR=/absolute/path/to/LeiBlog`，脚本会排除依赖、构建结果、真实 `.env` 和上传目录。其他可配置项：`LEIBLOG_BASE_DIR`、`LEIBLOG_PROJECT_NAME`、`LEIBLOG_REPO_BRANCH`、`LEIBLOG_REPO_ARCHIVE_URL`、`LEIBLOG_COMMAND_PATH`。

默认代理专用网段为 `172.30.197.0/29`。与服务器已有网络冲突时，在首次安装前一起设置 `LEIBLOG_PROXY_SUBNET`、`LEIBLOG_PROXY_IP` 和 `LEIBLOG_API_IP`。API 只信任 Caddy 的确切内网 IP，不笼统信任所有私网地址。

## 备份与恢复

```bash
sudo leiblog backup
sudo leiblog restore /var/leiblog/backups/leiblog-backup-YYYYMMDD-HHMMSS-XXXXXX.tar.gz
```

备份包括 PostgreSQL 自定义格式导出、上传文件、环境配置、Compose 配置和格式标记。归档权限为 600，含密码哈希、个人数据和加密密钥，请加密保存到异地，并限制读取权限。

恢复只接受可信的新项目备份，拒绝链接、特殊文件、路径穿越和未知顶层文件，限制文件数和解压大小，并预检磁盘空闲空间。恢复前再次备份；数据库恢复在单个事务中进行，失败时恢复原媒体和配置。成功后撤销历史会话、验证码、OAuth 状态，并清理 Redis，需要重新登录。

恢复保留当前服务器域名、网络和 PostgreSQL/Redis 凭据，只从备份恢复三把应用密钥以解密业务配置；**不会执行备份内的 Compose 文件**。数据库已提交后若后续步骤失败，保持服务停止并检查日志，使用恢复前备份处理，不要直接删除数据目录。

部署备份不下载 R2 对象，只保留数据库中的元数据和相关配置。R2 必须独立保留对象/版本或做同步备份。还原历史数据后，核对邮件通知队列，避免重发历史邮件；不同项目版本和实际灾备环境仍须先演练。

```bash
sudo leiblog uninstall
sudo leiblog uninstall --purge
```

前者只删除容器，保留目录和数据卷；`--purge` 会永久删除目录和本项目全部数据卷（包含 TLS 证书），需要额外确认。不要使用此命令切换旧项目。

## 代理和上线验收

- 前台与 API 同域；生产前端默认使用相对 `/api` 地址，避免访问内部 `:3000`。`/admin/*` 刷新会返回后台入口，不是前台 HTML。
- 静态 HTML 禁缓存并配置 CSP、HSTS、防嵌入和 no-sniff；带 hash 的静态资源长期缓存。`/uploads` 继续由 API 返回独立的 sandbox 策略。
- Caddy 默认不信任客户端提供的代理头。若使用 Cloudflare，使用 Full (strict)，不要使用 Flexible。未配置可信 CDN 网段时，限流/位置看到的是 CDN 节点而非访客 IP；按官方 CIDR 列表配置 Caddy 的 `trusted_proxies` 和 `trusted_proxies_strict`，不要直接信任任意 `CF-Connecting-IP`。参考 [Caddy 代理文档](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy)。
- 启动依赖使用健康检查与 `service_healthy`，不是只判断容器存在。参考 [Docker Compose 启动顺序](https://docs.docker.com/compose/how-tos/startup-order)。
- 验收首页、后台刷新、登录、ALTCHA、注册/验证码、邮件投递、评论、图片上传、图片预览、OAuth 回跳和备份恢复。观察磁盘、内存、API 错误和备份是否可恢复。
- 本次本地验证不替代实际公网证书签发、DNS、CDN、浏览器和外部邮件/OAuth 服务验收。

## 本地复现检查

```bash
bash deploy/test-script.sh
./check.sh
cd blog-server && bun run test:security
cd .. && bash deploy/test-production.sh
```

最后一项使用随机测试项目名、测试数据库、随机本地 TLS 端口和内部测试证书，构建真实生产镜像，检查路由、CSP、健康、非 root、并发迁移/初始化及备份恢复，结束时删除测试容器和数据卷。需要 Docker、联网下载构建依赖及足够磁盘；不会连接现有业务数据库或发送真实邮件。
