#!/usr/bin/env bash

set -Eeuo pipefail

LEIBLOG_SCRIPT_VERSION="0.1.2"
LEIBLOG_BASE_DIR="${LEIBLOG_BASE_DIR:-/var/leiblog}"
LEIBLOG_PROJECT_NAME="${LEIBLOG_PROJECT_NAME:-leiblog}"
LEIBLOG_REPO_BRANCH="${LEIBLOG_REPO_BRANCH:-cloud-server}"
LEIBLOG_REPO_ARCHIVE_URL="${LEIBLOG_REPO_ARCHIVE_URL:-https://github.com/taolei05/LeiBlog/archive/refs/heads/${LEIBLOG_REPO_BRANCH}.tar.gz}"
LEIBLOG_HTTP_PORT="${LEIBLOG_HTTP_PORT:-80}"
LEIBLOG_SITE_URL="${LEIBLOG_SITE_URL:-}"
LEIBLOG_INSTALL_DOCKER="${LEIBLOG_INSTALL_DOCKER:-1}"

COMPOSE_FILE="${LEIBLOG_BASE_DIR}/docker-compose.yml"
ENV_FILE="${LEIBLOG_BASE_DIR}/.env"
SOURCE_DIR="${LEIBLOG_BASE_DIR}/source"
BACKUP_DIR="${LEIBLOG_BASE_DIR}/backups"
UPLOADS_DIR="${LEIBLOG_BASE_DIR}/uploads"

red='\033[0;31m'
green='\033[0;32m'
yellow='\033[0;33m'
plain='\033[0m'

info() {
  echo -e "${green}>${plain} $*"
}

warn() {
  echo -e "${yellow}!${plain} $*"
}

die() {
  echo -e "${red}错误:${plain} $*" >&2
  exit 1
}

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

require_root() {
  [[ "${EUID}" -eq 0 ]] || die "必须使用 root 用户运行此脚本"
}

install_packages() {
  local packages=("$@")

  if command_exists apt-get; then
    apt-get update
    DEBIAN_FRONTEND=noninteractive apt-get install -y "${packages[@]}"
    return
  fi

  if command_exists dnf; then
    dnf install -y "${packages[@]}"
    return
  fi

  if command_exists yum; then
    yum install -y "${packages[@]}"
    return
  fi

  if command_exists pacman; then
    pacman -Sy --noconfirm "${packages[@]}"
    return
  fi

  die "未找到支持的包管理器，请先安装：${packages[*]}"
}

ensure_base_tools() {
  local missing=()
  for binary in curl tar openssl; do
    command_exists "${binary}" || missing+=("${binary}")
  done

  if [[ "${#missing[@]}" -gt 0 ]]; then
    info "安装基础依赖：${missing[*]}"
    install_packages ca-certificates "${missing[@]}"
  fi
}

ensure_docker() {
  if command_exists docker; then
    return
  fi

  if [[ "${LEIBLOG_INSTALL_DOCKER}" != "1" ]]; then
    die "未找到 Docker。设置 LEIBLOG_INSTALL_DOCKER=1 允许脚本自动安装，或先手动安装 Docker"
  fi

  info "安装 Docker"
  curl -fsSL https://get.docker.com | sh

  if command_exists systemctl; then
    systemctl enable docker >/dev/null 2>&1 || true
    systemctl start docker >/dev/null 2>&1 || true
  elif command_exists service; then
    service docker start >/dev/null 2>&1 || true
  fi

  command_exists docker || die "Docker 安装失败"
}

ensure_compose() {
  docker compose version >/dev/null 2>&1 || die "未找到 Docker Compose v2，请升级 Docker 或安装 compose 插件"
}

compose() {
  (cd "${LEIBLOG_BASE_DIR}" && docker compose --project-name "${LEIBLOG_PROJECT_NAME}" -f "${COMPOSE_FILE}" "$@")
}

secret_hex() {
  openssl rand -hex "$1"
}

trim_trailing_slash() {
  local value="$1"
  echo "${value%/}"
}

detect_public_site_url() {
  local ip
  ip="$(curl -fsS --max-time 5 https://api.ipify.org 2>/dev/null || true)"

  if [[ -z "${ip}" ]] && command_exists hostname; then
    ip="$(hostname -I 2>/dev/null | awk '{print $1}' || true)"
  fi

  if [[ -z "${ip}" ]]; then
    ip="127.0.0.1"
  fi

  echo "http://${ip}"
}

resolve_site_url() {
  local default_url input
  default_url="$(detect_public_site_url)"

  if [[ -z "${LEIBLOG_SITE_URL}" && -t 0 ]]; then
    read -r -p "请输入站点访问地址 [${default_url}]: " input
    LEIBLOG_SITE_URL="${input:-${default_url}}"
  fi

  if [[ -z "${LEIBLOG_SITE_URL}" ]]; then
    LEIBLOG_SITE_URL="${default_url}"
  fi

  LEIBLOG_SITE_URL="$(trim_trailing_slash "${LEIBLOG_SITE_URL}")"

  case "${LEIBLOG_SITE_URL}" in
    http://* | https://*) ;;
    *) die "LEIBLOG_SITE_URL 必须是 http:// 或 https:// 开头的绝对地址" ;;
  esac
}

prepare_directories() {
  mkdir -p "${LEIBLOG_BASE_DIR}" "${BACKUP_DIR}" "${UPLOADS_DIR}"
  chmod 750 "${LEIBLOG_BASE_DIR}" "${BACKUP_DIR}"
  chmod 755 "${UPLOADS_DIR}"
}

write_env_if_missing() {
  if [[ -f "${ENV_FILE}" ]]; then
    info "保留已有环境变量：${ENV_FILE}"
    return
  fi

  resolve_site_url

  local postgres_password redis_password app_secret jwt_secret setup_token
  postgres_password="$(secret_hex 24)"
  redis_password="$(secret_hex 24)"
  app_secret="$(secret_hex 32)"
  jwt_secret="$(secret_hex 32)"
  setup_token="$(secret_hex 24)"

  cat >"${ENV_FILE}" <<EOF
TZ=Asia/Shanghai
HTTP_PORT=${LEIBLOG_HTTP_PORT}
SITE_URL=${LEIBLOG_SITE_URL}
VITE_API_BASE_URL=${LEIBLOG_SITE_URL}/api

POSTGRES_USER=leiblog
POSTGRES_PASSWORD=${postgres_password}
POSTGRES_DB=lei_blog

REDIS_PASSWORD=${redis_password}

APP_ENV=production
APP_HOST=0.0.0.0
APP_PORT=3000
CORS_ORIGINS=${LEIBLOG_SITE_URL}
OPENAPI_ENABLED=false
SETUP_TOKEN=${setup_token}

DATABASE_MAX_CONNECTIONS=10
APP_SECRET_KEY=${app_secret}
JWT_SECRET=${jwt_secret}
UPLOADS_DIR=/data/uploads
UPLOADS_URL_PREFIX=/uploads
UPLOAD_MAX_FILE_SIZE_BYTES=52428800
EOF

  chmod 600 "${ENV_FILE}"
}

load_env_file() {
  [[ -f "${ENV_FILE}" ]] || die "未找到环境变量文件：${ENV_FILE}"
  set -a
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
  set +a
}

fetch_source() {
  local tmp_dir new_source old_source
  tmp_dir="$(mktemp -d)"
  new_source="${LEIBLOG_BASE_DIR}/source.new"
  old_source="${LEIBLOG_BASE_DIR}/source.previous"

  info "下载 LeiBlog 源码：${LEIBLOG_REPO_ARCHIVE_URL}"
  curl -fL "${LEIBLOG_REPO_ARCHIVE_URL}" -o "${tmp_dir}/source.tar.gz"

  rm -rf "${new_source}"
  mkdir -p "${new_source}"
  tar -xzf "${tmp_dir}/source.tar.gz" --strip-components=1 -C "${new_source}"

  rm -rf "${old_source}"
  if [[ -d "${SOURCE_DIR}" ]]; then
    mv "${SOURCE_DIR}" "${old_source}"
  fi
  mv "${new_source}" "${SOURCE_DIR}"
  rm -rf "${tmp_dir}" "${old_source}"
}

write_runtime_files() {
  [[ -d "${SOURCE_DIR}/blog-server" ]] || die "源码缺少 blog-server"
  [[ -d "${SOURCE_DIR}/blog-client" ]] || die "源码缺少 blog-client"

  cat >"${SOURCE_DIR}/blog-server/Dockerfile.leiblog" <<'EOF'
FROM oven/bun:1.3.14

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

COPY . .

ENV APP_ENV=production
EXPOSE 3000

CMD ["sh", "-lc", "bun run db:migrate && bun run start"]
EOF

  cat >"${SOURCE_DIR}/blog-client/Dockerfile.leiblog" <<'EOF'
FROM oven/bun:1.3.14 AS build

ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends git \
  && rm -rf /var/lib/apt/lists/*

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun --bun ./node_modules/.bin/vp build

FROM nginx:1.27-alpine

COPY nginx.leiblog.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EOF

  cat >"${SOURCE_DIR}/blog-client/nginx.leiblog.conf" <<'EOF'
server {
  listen 80;
  server_name _;
  client_max_body_size 50m;

  root /usr/share/nginx/html;
  index index.html;

  location = /api {
    proxy_pass http://api:3000/api;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  location /api/ {
    proxy_pass http://api:3000/api/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  location /uploads/ {
    proxy_pass http://api:3000/uploads/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  location / {
    try_files $uri $uri/ /index.html;
  }
}
EOF
}

write_compose_file() {
  cat >"${COMPOSE_FILE}" <<'EOF'
services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      TZ: ${TZ}
      PGTZ: ${TZ}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    command: ["postgres", "-c", "timezone=Asia/Shanghai"]
    volumes:
      - ./data/postgres:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 5s
      timeout: 5s
      retries: 20

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: ["redis-server", "--appendonly", "yes", "--requirepass", "${REDIS_PASSWORD}"]
    volumes:
      - ./data/redis:/data
    healthcheck:
      test: ["CMD-SHELL", "redis-cli -a ${REDIS_PASSWORD} ping | grep PONG"]
      interval: 5s
      timeout: 5s
      retries: 20

  api:
    build:
      context: ./source/blog-server
      dockerfile: Dockerfile.leiblog
    image: leiblog-api:local
    restart: unless-stopped
    environment:
      TZ: ${TZ}
      APP_ENV: ${APP_ENV}
      APP_HOST: ${APP_HOST}
      APP_PORT: ${APP_PORT}
      CORS_ORIGINS: ${CORS_ORIGINS}
      OPENAPI_ENABLED: ${OPENAPI_ENABLED}
      SETUP_TOKEN: ${SETUP_TOKEN}
      DATABASE_URL: postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
      DATABASE_MAX_CONNECTIONS: ${DATABASE_MAX_CONNECTIONS}
      REDIS_URL: redis://:${REDIS_PASSWORD}@redis:6379
      APP_SECRET_KEY: ${APP_SECRET_KEY}
      JWT_SECRET: ${JWT_SECRET}
      UPLOADS_DIR: ${UPLOADS_DIR}
      UPLOADS_URL_PREFIX: ${UPLOADS_URL_PREFIX}
      UPLOAD_MAX_FILE_SIZE_BYTES: ${UPLOAD_MAX_FILE_SIZE_BYTES}
    volumes:
      - ./uploads:/data/uploads
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

  web:
    build:
      context: ./source/blog-client
      dockerfile: Dockerfile.leiblog
      args:
        VITE_API_BASE_URL: ${VITE_API_BASE_URL}
    image: leiblog-web:local
    restart: unless-stopped
    ports:
      - "${HTTP_PORT}:80"
    depends_on:
      - api
EOF
}

install_leiblog() {
  require_root
  ensure_base_tools
  ensure_docker
  ensure_compose
  prepare_directories
  write_env_if_missing
  fetch_source
  write_runtime_files
  write_compose_file

  info "构建并启动 LeiBlog"
  compose build --pull
  compose up -d --remove-orphans

  print_install_result
}

update_leiblog() {
  require_root
  ensure_base_tools
  ensure_docker
  ensure_compose
  prepare_directories
  [[ -f "${ENV_FILE}" ]] || die "尚未安装 LeiBlog，请先执行 install"
  fetch_source
  write_runtime_files
  write_compose_file

  info "重建并更新 LeiBlog"
  compose build --pull
  compose up -d --remove-orphans
}

start_leiblog() {
  require_root
  ensure_docker
  ensure_compose
  [[ -f "${COMPOSE_FILE}" ]] || die "未找到 compose 文件，请先执行 install"
  compose up -d
}

stop_leiblog() {
  require_root
  ensure_docker
  ensure_compose
  [[ -f "${COMPOSE_FILE}" ]] || die "未找到 compose 文件，请先执行 install"
  compose stop
}

restart_leiblog() {
  require_root
  ensure_docker
  ensure_compose
  [[ -f "${COMPOSE_FILE}" ]] || die "未找到 compose 文件，请先执行 install"
  compose restart
}

show_logs() {
  require_root
  ensure_docker
  ensure_compose
  [[ -f "${COMPOSE_FILE}" ]] || die "未找到 compose 文件，请先执行 install"
  compose logs -f --tail=200 "${@:2}"
}

show_status() {
  require_root
  ensure_docker
  ensure_compose
  [[ -f "${COMPOSE_FILE}" ]] || die "未找到 compose 文件，请先执行 install"
  compose ps
}

backup_leiblog() {
  require_root
  ensure_base_tools
  ensure_docker
  ensure_compose
  [[ -f "${COMPOSE_FILE}" ]] || die "未找到 compose 文件，请先执行 install"
  load_env_file

  local timestamp tmp_dir backup_file
  timestamp="$(date +"%Y%m%d%H%M%S")"
  tmp_dir="$(mktemp -d)"
  backup_file="${BACKUP_DIR}/leiblog-backup-${timestamp}.tar.gz"

  mkdir -p "${BACKUP_DIR}" "${UPLOADS_DIR}"

  info "导出 PostgreSQL 数据"
  compose exec -T postgres pg_dump -U "${POSTGRES_USER}" "${POSTGRES_DB}" >"${tmp_dir}/postgres.sql"

  info "打包数据库、上传文件和环境配置"
  tar -czf "${backup_file}" \
    -C "${tmp_dir}" postgres.sql \
    -C "${LEIBLOG_BASE_DIR}" .env docker-compose.yml uploads

  rm -rf "${tmp_dir}"
  chmod 600 "${backup_file}"
  echo -e "${green}备份完成:${plain} ${backup_file}"
}

confirm_dangerous_action() {
  local message="$1"
  if [[ "${LEIBLOG_FORCE:-0}" == "1" ]]; then
    return
  fi

  if [[ ! -t 0 ]]; then
    die "${message}。非交互环境请设置 LEIBLOG_FORCE=1"
  fi

  local input
  read -r -p "${message}，请输入 YES 继续: " input
  [[ "${input}" == "YES" ]] || die "已取消"
}

restore_leiblog() {
  require_root
  ensure_base_tools
  ensure_docker
  ensure_compose

  local backup_file="${2:-}"
  [[ -n "${backup_file}" ]] || die "请提供备份文件路径：${0} restore /path/to/backup.tar.gz"
  [[ -f "${backup_file}" ]] || die "备份文件不存在：${backup_file}"

  confirm_dangerous_action "恢复会覆盖当前数据库、上传文件和环境配置"

  local tmp_dir
  tmp_dir="$(mktemp -d)"
  tar -xzf "${backup_file}" -C "${tmp_dir}"

  [[ -f "${tmp_dir}/postgres.sql" ]] || die "备份缺少 postgres.sql"
  [[ -f "${tmp_dir}/.env" ]] || die "备份缺少 .env"
  [[ -f "${tmp_dir}/docker-compose.yml" ]] || die "备份缺少 docker-compose.yml"

  mkdir -p "${LEIBLOG_BASE_DIR}"
  cp "${tmp_dir}/.env" "${ENV_FILE}"
  cp "${tmp_dir}/docker-compose.yml" "${COMPOSE_FILE}"
  chmod 600 "${ENV_FILE}"
  load_env_file

  compose stop api web >/dev/null 2>&1 || true
  compose up -d postgres redis

  info "恢复 PostgreSQL 数据"
  compose exec -T postgres dropdb -U "${POSTGRES_USER}" --if-exists "${POSTGRES_DB}"
  compose exec -T postgres createdb -U "${POSTGRES_USER}" "${POSTGRES_DB}"
  compose exec -T postgres psql -U "${POSTGRES_USER}" "${POSTGRES_DB}" <"${tmp_dir}/postgres.sql"

  rm -rf "${UPLOADS_DIR}"
  if [[ -d "${tmp_dir}/uploads" ]]; then
    cp -a "${tmp_dir}/uploads" "${UPLOADS_DIR}"
  else
    mkdir -p "${UPLOADS_DIR}"
  fi
  chmod 755 "${UPLOADS_DIR}"

  rm -rf "${tmp_dir}"
  compose up -d --remove-orphans
  echo -e "${green}恢复完成${plain}"
}

uninstall_leiblog() {
  require_root
  ensure_docker
  ensure_compose
  [[ -f "${COMPOSE_FILE}" ]] || die "未找到 compose 文件"

  confirm_dangerous_action "卸载会停止并删除 LeiBlog 容器，但默认保留 ${LEIBLOG_BASE_DIR} 数据目录"
  compose down --remove-orphans

  if [[ "${2:-}" == "--purge" ]]; then
    confirm_dangerous_action "将永久删除 ${LEIBLOG_BASE_DIR}"
    rm -rf "${LEIBLOG_BASE_DIR}"
  fi
}

print_install_result() {
  load_env_file
  echo
  echo -e "${green}LeiBlog 已启动${plain}"
  echo -e "访问地址：${yellow}${SITE_URL}${plain}"
  echo -e "初始化地址：${yellow}${SITE_URL}/admin/setup${plain}"
  echo -e "SETUP_TOKEN：${yellow}${SETUP_TOKEN}${plain}"
  echo -e "配置文件：${ENV_FILE}"
  echo -e "备份目录：${BACKUP_DIR}"
}

show_usage() {
  cat <<EOF
LeiBlog 部署脚本 ${LEIBLOG_SCRIPT_VERSION}

用法:
  leiblog.sh install              安装或重新生成部署
  leiblog.sh update               拉取部署分支最新源码并重建服务
  leiblog.sh start                启动服务
  leiblog.sh stop                 停止服务
  leiblog.sh restart              重启服务
  leiblog.sh status               查看容器状态
  leiblog.sh logs [service]       查看日志，可选服务名：web/api/postgres/redis
  leiblog.sh backup               备份数据库、上传文件和环境配置
  leiblog.sh restore <file>       从备份恢复
  leiblog.sh uninstall [--purge]  卸载服务，--purge 会删除数据目录

常用环境变量:
  LEIBLOG_SITE_URL=https://example.com
  LEIBLOG_HTTP_PORT=80
  LEIBLOG_BASE_DIR=/var/leiblog
  LEIBLOG_REPO_BRANCH=cloud-server
  LEIBLOG_REPO_ARCHIVE_URL=https://github.com/taolei05/LeiBlog/archive/refs/heads/cloud-server.tar.gz
  LEIBLOG_FORCE=1

一键安装示例:
  curl -fsSL https://raw.githubusercontent.com/taolei05/LeiBlog/cloud-server/deploy/leiblog.sh | bash -s -- install

指定域名安装:
  curl -fsSL https://raw.githubusercontent.com/taolei05/LeiBlog/cloud-server/deploy/leiblog.sh \\
    | LEIBLOG_SITE_URL=https://example.com bash -s -- install
EOF
}

main() {
  local command_name="${1:-help}"

  case "${command_name}" in
    install)
      install_leiblog
      ;;
    update)
      update_leiblog
      ;;
    start)
      start_leiblog
      ;;
    stop)
      stop_leiblog
      ;;
    restart)
      restart_leiblog
      ;;
    status)
      show_status
      ;;
    logs | log)
      show_logs "$@"
      ;;
    backup)
      backup_leiblog
      ;;
    restore)
      restore_leiblog "$@"
      ;;
    uninstall)
      uninstall_leiblog "$@"
      ;;
    help | -h | --help)
      show_usage
      ;;
    *)
      show_usage
      die "未知命令：${command_name}"
      ;;
  esac
}

main "$@"
