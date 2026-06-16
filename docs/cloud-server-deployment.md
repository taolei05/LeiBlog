# LeiBlog 云服务器部署文档

本文档记录 LeiBlog 在云服务器上的生产部署、更新、运维和排障流程。当前生产部署脚本和源码默认使用 `main` 分支。

## 部署架构

一键部署脚本会在服务器上创建 `/var/leiblog` 目录，并使用 Docker Compose 启动以下服务：

- `web`：Nginx，提供前端静态文件，并反向代理 `/api` 和 `/uploads`
- `api`：Bun + Elysia 后端，启动时自动执行数据库迁移
- `postgres`：PostgreSQL 16，保存业务数据
- `redis`：Redis 7，保存限流、会话等运行时数据

默认只有 `web` 暴露 HTTP 端口到公网。PostgreSQL 和 Redis 不直接暴露公网，这是生产环境推荐做法。

## 服务器要求

推荐环境：

- Ubuntu 22.04/24.04 LTS
- 1 核 CPU 或更高
- 1 GB 内存可以运行，但构建更稳定建议 2 GB 内存或启用 swap
- 20 GB 以上磁盘
- root 权限或可使用 `sudo`
- 公网 IP 或已解析到服务器的域名

脚本会自动检查并安装基础依赖和 Docker。若服务器已经安装 Docker，会直接复用。

本文命令默认以普通用户执行并使用 `sudo` 提权；如果已经登录 `root` 用户，可以省略 `sudo`。

## 首次安装

先将部署脚本安装为全局命令：

```bash
sudo curl -fsSL https://raw.githubusercontent.com/taolei05/LeiBlog/main/deploy/leiblog.sh \
  -o /usr/local/bin/leiblog
sudo chmod +x /usr/local/bin/leiblog
sudo leiblog --help
```

安装完成后，可以在任意目录直接使用 `leiblog`。执行安装时，脚本会自动探测公网 IP 并提示确认站点访问地址；如果需要域名、IP:端口或其它地址，按提示输入即可：

```bash
sudo leiblog install
```

安装成功后终端会输出：

- 访问地址
- 初始化地址：`/admin/setup`
- `SETUP_TOKEN`
- 全局命令路径：`/usr/local/bin/leiblog`
- 环境变量文件路径：`/var/leiblog/.env`
- 备份目录：`/var/leiblog/backups`

请保存 `SETUP_TOKEN`，首次访问后台初始化页面会用到。

`install` 和 `update` 会自动使用 `main` 分支中的最新部署脚本刷新 `/usr/local/bin/leiblog`。已经部署过 LeiBlog 的服务器只需执行一次上面的全局命令安装步骤，后续即可使用短命令运维。

如果需要单独重新下载或修复全局命令，也可以执行：

```bash
sudo leiblog install-cli
```

如果全局命令已经丢失，使用远程脚本重新安装：

```bash
curl -fsSL https://raw.githubusercontent.com/taolei05/LeiBlog/main/deploy/leiblog.sh \
  | sudo bash -s -- install-cli
```

## 更新部署

常规更新命令：

```bash
sudo leiblog update
```

如果需要临时指定其它部署源码分支，使用：

```bash
sudo env LEIBLOG_REPO_BRANCH=<branch-name> \
  LEIBLOG_REPO_ARCHIVE_URL=https://github.com/taolei05/LeiBlog/archive/refs/heads/<branch-name>.tar.gz \
  LEIBLOG_SCRIPT_URL=https://raw.githubusercontent.com/taolei05/LeiBlog/<branch-name>/deploy/leiblog.sh \
  leiblog update
```

更新会执行以下操作：

1. 下载当前部署分支源码（默认 `main`）
2. 使用源码中的最新部署脚本刷新 `/usr/local/bin/leiblog`
3. 重新生成运行时 Dockerfile 和 Compose 文件
4. 重新构建 `api` 和 `web` 镜像
5. 使用新镜像启动容器
6. 后端启动时自动执行数据库迁移

## 验证部署结果

查看容器状态：

```bash
sudo leiblog status
```

或直接使用 Docker Compose：

```bash
sudo docker compose -p leiblog -f /var/leiblog/docker-compose.yml ps
```

检查当前前端入口文件：

```bash
curl -fsS http://服务器ip/ | grep -o 'assets/index-[^"]*\.js'
```

如果更新后仍然看到旧的 `index-*.js`，通常说明 `web` 镜像没有构建成功，或者浏览器缓存了旧页面。先看构建输出和容器状态，再强制刷新浏览器。

## 常用运维命令

启动：

```bash
sudo leiblog start
```

停止：

```bash
sudo leiblog stop
```

重启：

```bash
sudo leiblog restart
```

查看所有日志：

```bash
sudo leiblog logs
```

查看指定服务日志：

```bash
sudo leiblog logs api
```

可选服务名：

- `web`
- `api`
- `postgres`
- `redis`

## 环境变量

生产环境变量保存在：

```bash
/var/leiblog/.env
```

查看关键配置：

```bash
sudo sed -n '1,120p' /var/leiblog/.env
```

常见变量：

- `SITE_URL`：站点访问地址
- `VITE_API_BASE_URL`：前端访问 API 的地址
- `POSTGRES_USER`：数据库用户名
- `POSTGRES_PASSWORD`：数据库密码
- `POSTGRES_DB`：数据库名
- `REDIS_PASSWORD`：Redis 密码
- `APP_SECRET_KEY`：后端应用密钥
- `JWT_SECRET`：JWT 签名密钥
- `SETUP_TOKEN`：首次初始化后台时使用
- `CORS_ORIGINS`：允许跨域的来源
- `TRUSTED_PROXY_IPS`：可信反向代理 IP 或 CIDR；脚本默认 `172.16.0.0/12`，用于让后端信任 Docker Nginx 转发的真实访客 IP

注意事项：

- 不要提交 `/var/leiblog/.env`
- 不要把数据库和 Redis 端口直接暴露公网
- 修改 `.env` 后需要重启服务

```bash
sudo leiblog restart
```

## 数据目录

默认数据目录：

- PostgreSQL 数据：`/var/leiblog/data/postgres`
- Redis 数据：`/var/leiblog/data/redis`
- 上传文件：`/var/leiblog/uploads`
- 备份文件：`/var/leiblog/backups`
- 当前源码：`/var/leiblog/source`
- Compose 文件：`/var/leiblog/docker-compose.yml`

不要手动删除 `/var/leiblog/data` 和 `/var/leiblog/uploads`，否则会丢数据。

## 备份

创建备份：

```bash
sudo leiblog backup
```

备份文件会生成在：

```bash
/var/leiblog/backups
```

备份内容包括：

- PostgreSQL 导出的 `postgres.sql`
- `/var/leiblog/.env`
- `/var/leiblog/docker-compose.yml`
- `/var/leiblog/uploads`

建议在每次重要更新前先备份。

## 恢复

使用备份恢复：

```bash
sudo leiblog restore /var/leiblog/backups/leiblog-backup-YYYYMMDDHHMMSS.tar.gz
```

恢复会覆盖当前数据库、上传文件和环境配置。执行前确认备份文件正确。

## 数据库连接

PostgreSQL 默认不暴露公网。需要临时管理数据库时，推荐使用 Navicat 的 SSH 隧道功能。

服务器上查看数据库信息：

```bash
sudo grep -E '^(POSTGRES_USER|POSTGRES_PASSWORD|POSTGRES_DB)=' /var/leiblog/.env
sudo docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' leiblog-postgres-1
```

Navicat PostgreSQL 常规配置：

- 主机：PostgreSQL 容器 IP
- 端口：`5432`
- 用户名：`POSTGRES_USER`
- 密码：`POSTGRES_PASSWORD`
- 数据库：`POSTGRES_DB`

Navicat SSH 配置：

- SSH 主机：服务器 IP 或域名
- SSH 端口：`22`
- SSH 用户：例如 `root`
- SSH 密码或私钥：按服务器实际登录方式填写

Redis 不建议从本地管理工具直连。生产排障时优先通过服务器内的 `redis-cli` 验证。

```bash
sudo docker exec -it leiblog-redis-1 redis-cli -a "$(sudo grep '^REDIS_PASSWORD=' /var/leiblog/.env | cut -d= -f2-)" ping
```

返回 `PONG` 表示 Redis 正常。

## HTTPS 和域名

当前推荐直接使用长期正规方案：让源站自身提供 HTTPS，再将 Cloudflare 加密模式切到 `Full (strict)`。

当前脚本中的 `sudo leiblog domain` 已经会在设置域名后自动完成服务器侧步骤：

- 将 LeiBlog 切换到宿主机 `8080`
- 将站点地址写成 `https://域名`
- 安装并配置 Caddy
- 生成源站反向代理配置
- 校验并重载 Caddy
- 重建 `api/web` 服务

脚本不会自动操作 Cloudflare API，因此最后仍需要你在 Cloudflare 后台手动完成两步：

- 将域名记录切回 `已代理`（橙云）
- 将 `SSL/TLS -> Overview` 设置为 `Full (strict)`

### 长期正规方案：源站 443 + 证书 + Full (strict)

更正规的生产方案是让服务器自身也提供 HTTPS，再将 Cloudflare 加密模式切到 `Full (strict)`。

推荐做法：

1. 让 LeiBlog 容器改为监听宿主机 `8080`
2. 在宿主机使用 Caddy 或 Nginx 监听 `80/443`
3. 给域名签发并安装证书
4. 由 Caddy/Nginx 反向代理到 `127.0.0.1:8080`
5. 将 Cloudflare 加密模式切换到 `Full (strict)`

优点：

- 浏览器到 Cloudflare 是 HTTPS
- Cloudflare 到源站也是 HTTPS
- 更安全，也更符合正式生产环境的常规做法

证书有两种常见来源：

- 公网受信任证书，例如 Let's Encrypt
- Cloudflare Origin CA 证书

`Full (strict)` 要求源站证书有效且未过期。Cloudflare 官方文档允许使用公网 CA 证书或 Cloudflare Origin CA 证书。

如果使用 Cloudflare Origin CA，需要注意：

- 这种证书只用于 Cloudflare 到源站之间
- 如果你暂停 Cloudflare 代理或将记录改回仅 DNS，浏览器直连源站时会看到证书不受信任

如果你希望即使临时关闭 Cloudflare 代理，浏览器直连源站 HTTPS 也仍然正常，优先考虑使用 Caddy 自动申请公网受信任证书。

#### 推荐落地方式：Caddy + Let's Encrypt

下面是一套已经验证过的落地顺序，目标是：

- LeiBlog 继续运行在 Docker 中
- LeiBlog 对宿主机暴露 `8080`
- Caddy 在宿主机接管 `80/443`
- Caddy 自动申请并续期公网受信任证书
- Cloudflare 最终切换到 `Full (strict)`

#### 第 1 步：先把 Cloudflare 切回仅 DNS

在申请和验证源站证书前，先将 Cloudflare DNS 中主域名记录切回 `仅 DNS`（灰云）。

这样浏览器和证书签发服务会直接访问你的源站，避免把代理层和源站层的问题混在一起。

#### 第 2 步：让 LeiBlog 改为监听 8080

编辑：

```bash
sudo nano /var/leiblog/.env
```

至少确认这几项：

```bash
HTTP_PORT=8080
SITE_URL=https://域名
VITE_API_BASE_URL=https://域名/api
CORS_ORIGINS=https://域名
```

保存后执行：

```bash
sudo leiblog update
```

验证：

```bash
sudo grep '^HTTP_PORT=' /var/leiblog/.env
sudo ss -ltnp | grep ':8080'
curl -I http://127.0.0.1:8080
```

预期：

- `.env` 中显示 `HTTP_PORT=8080`
- 本机 `8080` 端口在监听
- `curl` 返回 `200 OK`

#### 第 3 步：安装 Caddy

Ubuntu / Debian 可直接安装：

```bash
sudo apt update
sudo apt install -y caddy
```

如果系统仓库中没有 `caddy`，按 Caddy 官方仓库方式安装后再继续。

#### 第 4 步：配置 Caddy 反向代理

编辑：

```bash
sudo nano /etc/caddy/Caddyfile
```

将整个文件内容替换为：

```caddy
taolei.net, www.taolei.net {
    encode zstd gzip
    reverse_proxy 127.0.0.1:8080
}
```

如果你只打算使用根域名，不需要 `www`，也可以只保留：

```caddy
taolei.net {
    encode zstd gzip
    reverse_proxy 127.0.0.1:8080
}
```

保存后验证配置并重载：

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl enable --now caddy
sudo systemctl reload caddy
sudo systemctl status caddy --no-pager
```

#### 第 5 步：放行 80 和 443

如果服务器启用了 `ufw`：

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw status
```

如果使用云厂商安全组，也要同时放行公网 `80/443`。

#### 第 6 步：先验证源站自己的 HTTPS

此时 Cloudflare 仍然应保持灰云，先直接验证源站。

执行：

```bash
curl -I http://127.0.0.1:8080
curl -I https://域名
```

预期：

- `http://127.0.0.1:8080` 返回 `200 OK`
- `https://域名` 返回 `200 OK`
- 返回头中出现 `server: Caddy`

如果这一步不通，不要切回橙云，先把源站证书和反代问题排完。

#### 第 7 步：切回 Cloudflare 代理并改为 Full (strict)

当灰云直连 `https://域名` 已经正常后，再回到 Cloudflare：

1. DNS 中将主域名记录切回 `已代理`（橙云）
2. 打开 `SSL/TLS -> Overview`
3. 将加密模式设置为 `Full (strict)`

这样最终链路是：

- 浏览器 -> Cloudflare：HTTPS
- Cloudflare -> 源站 Caddy：HTTPS
- Caddy -> LeiBlog：本机反向代理 `127.0.0.1:8080`

#### 第 8 步：最终验证

执行：

```bash
curl -I https://域名
```

浏览器访问：

```text
https://域名
```

如果站点可以正常打开，并且 Cloudflare `SSL/TLS` 已切换为 `Full (strict)`，说明长期方案已经完成。

#### 如果需要支持 www

除了 Caddy 配置中加入 `www` 外，还需要在 Cloudflare DNS 中为 `www` 添加记录。推荐：

- 类型：`CNAME`
- 名称：`www`
- 内容：主域名，例如 `taolei.net`

如果希望所有 `www` 请求统一跳转到根域名，可额外在 Cloudflare 或 Caddy 中配置重定向规则。

#### 可选方案：Cloudflare Origin CA

如果你只关心 Cloudflare 到源站这段 HTTPS，也可以不使用公网证书，而是改用 Cloudflare Origin CA 证书。

这种做法的特点是：

- 可以配合 `Full (strict)` 使用
- Cloudflare 到源站是受信任的 HTTPS
- 但浏览器直接访问源站时不会信任这个证书

因此：

- 如果你希望“关闭 Cloudflare 代理后，浏览器直连源站 HTTPS 仍然正常”，优先使用 Caddy 自动申请的公网证书
- 如果你确定站点永远只通过 Cloudflare 访问，Origin CA 也可以接受

## 常见问题

### 页面空白，控制台提示 Prism is not defined

先检查服务器当前返回的入口文件：

```bash
curl -fsS http://服务器ip/ | grep -o 'assets/index-[^"]*\.js'
```

如果仍是旧文件名，说明服务器还在跑旧 web 镜像。重新执行 update，并确认构建没有失败。

### update 时出现 exit code 137

`137` 通常表示构建进程被系统杀掉，常见原因是内存不足。

部署脚本已降低前端构建内存占用。如果仍失败，建议启用 2 GB swap：

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
free -h
```

然后重新执行 update。

### Docker 容器启动失败

查看状态：

```bash
sudo docker compose -p leiblog -f /var/leiblog/docker-compose.yml ps
```

查看日志：

```bash
sudo docker compose -p leiblog -f /var/leiblog/docker-compose.yml logs --tail=200 api
sudo docker compose -p leiblog -f /var/leiblog/docker-compose.yml logs --tail=200 web
sudo docker compose -p leiblog -f /var/leiblog/docker-compose.yml logs --tail=200 postgres
sudo docker compose -p leiblog -f /var/leiblog/docker-compose.yml logs --tail=200 redis
```

### IPGeolocation API Key 测试失败

如果 Resend 和 DeepL 测试正常，但 IPGeolocation 测试失败，先更新到最新部署脚本和后端镜像：

```bash
sudo leiblog update
```

更新后确认 `.env` 里有可信代理配置：

```bash
sudo grep '^TRUSTED_PROXY_IPS=' /var/leiblog/.env
```

默认应返回 `TRUSTED_PROXY_IPS=172.16.0.0/12`。最新脚本会在 `update` 时自动补齐这个变量；这个配置用于避免后端把 Docker Nginx 内网 IP 当成管理员真实登录 IP。

### 端口 80 被占用

检查占用：

```bash
sudo ss -ltnp | grep ':80'
```

如果不能释放 80 端口，可以用其他端口安装：

```bash
sudo env LEIBLOG_HTTP_PORT=8080 leiblog install
```

安装提示出现后，将站点访问地址输入为 `http://服务器ip:8080`。

### 忘记 SETUP_TOKEN

查看：

```bash
sudo grep '^SETUP_TOKEN=' /var/leiblog/.env
```

### 想完全卸载

仅停止并删除容器，保留数据目录：

```bash
sudo leiblog uninstall
```

删除容器和 `/var/leiblog` 数据目录：

```bash
sudo env LEIBLOG_FORCE=1 leiblog uninstall --purge
```

`--purge` 会永久删除数据，执行前务必确认已经备份。
