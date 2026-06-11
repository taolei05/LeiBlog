# LeiBlog 云服务器部署文档

本文档记录 LeiBlog 在云服务器上的生产部署、更新、运维和排障流程。当前生产部署脚本和源码默认使用 `cloud-server` 分支。

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
sudo curl -fsSL https://raw.githubusercontent.com/taolei05/LeiBlog/cloud-server/deploy/leiblog.sh \
  -o /usr/local/bin/leiblog
sudo chmod +x /usr/local/bin/leiblog
sudo leiblog --help
```

安装完成后，可以在任意目录直接使用 `leiblog`。使用 IP 部署时，将 `LEIBLOG_SITE_URL` 改成你的服务器访问地址：

```bash
sudo env LEIBLOG_SITE_URL=http://服务器ip leiblog install
```

使用域名部署时：

```bash
sudo env LEIBLOG_SITE_URL=https://域名 leiblog install
```

安装成功后终端会输出：

- 访问地址
- 初始化地址：`/admin/setup`
- `SETUP_TOKEN`
- 全局命令路径：`/usr/local/bin/leiblog`
- 环境变量文件路径：`/var/leiblog/.env`
- 备份目录：`/var/leiblog/backups`

请保存 `SETUP_TOKEN`，首次访问后台初始化页面会用到。

`install` 和 `update` 会自动使用 `cloud-server` 分支中的最新部署脚本刷新 `/usr/local/bin/leiblog`。已经部署过 LeiBlog 的服务器只需执行一次上面的全局命令安装步骤，后续即可使用短命令运维。

如果需要单独重新下载或修复全局命令，也可以执行：

```bash
sudo leiblog install-cli
```

如果全局命令已经丢失，使用远程脚本重新安装：

```bash
curl -fsSL https://raw.githubusercontent.com/taolei05/LeiBlog/cloud-server/deploy/leiblog.sh \
  | sudo bash -s -- install-cli
```

## 更新部署

常规更新命令：

```bash
sudo leiblog update
```

如果需要显式指定部署源码分支，使用：

```bash
sudo env LEIBLOG_REPO_BRANCH=cloud-server \
  LEIBLOG_REPO_ARCHIVE_URL=https://github.com/taolei05/LeiBlog/archive/refs/heads/cloud-server.tar.gz \
  LEIBLOG_SCRIPT_URL=https://raw.githubusercontent.com/taolei05/LeiBlog/cloud-server/deploy/leiblog.sh \
  leiblog update
```

更新会执行以下操作：

1. 下载 `cloud-server` 分支源码
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

当前部署脚本默认提供 HTTP 服务。生产环境建议在服务器前面加 HTTPS，可选方案：

- 使用云厂商负载均衡或 CDN 终止 HTTPS
- 使用 Nginx Proxy Manager
- 使用服务器上的 Caddy 或系统 Nginx 反向代理到本服务

如果使用 HTTPS 域名，`.env` 里的这些值要保持一致：

```bash
SITE_URL=https://域名
VITE_API_BASE_URL=https://域名/api
CORS_ORIGINS=https://域名
```

修改后执行：

```bash
sudo leiblog update
```

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
sudo env LEIBLOG_HTTP_PORT=8080 \
  LEIBLOG_SITE_URL=http://服务器ip:8080 \
  leiblog install
```

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
