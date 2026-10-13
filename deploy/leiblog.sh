#!/usr/bin/env bash
set -Eeuo pipefail

LEIBLOG_SCRIPT_VERSION="0.3.2"
LEIBLOG_BASE_DIR="${LEIBLOG_BASE_DIR:-/var/leiblog}"
LEIBLOG_PROJECT_NAME="${LEIBLOG_PROJECT_NAME:-leiblog}"
LEIBLOG_REPO_BRANCH="${LEIBLOG_REPO_BRANCH:-main}"
LEIBLOG_REPO_ARCHIVE_URL="${LEIBLOG_REPO_ARCHIVE_URL:-https://github.com/taolei05/LeiBlog/archive/refs/heads/${LEIBLOG_REPO_BRANCH}.tar.gz}"
LEIBLOG_SCRIPT_URL="${LEIBLOG_SCRIPT_URL:-https://raw.githubusercontent.com/taolei05/LeiBlog/${LEIBLOG_REPO_BRANCH}/deploy/leiblog.sh}"
LEIBLOG_COMMAND_PATH="${LEIBLOG_COMMAND_PATH:-/usr/local/bin/leiblog}"
COMPOSE_FILE="${LEIBLOG_BASE_DIR}/docker-compose.yml"
ENV_FILE="${LEIBLOG_BASE_DIR}/.env"
SOURCE_DIR="${LEIBLOG_BASE_DIR}/source"
BACKUP_DIR="${LEIBLOG_BASE_DIR}/backups"
UPLOADS_DIR="${LEIBLOG_BASE_DIR}/uploads"

info() { printf '> %s\n' "$*"; }
die() { printf '错误: %s\n' "$*" >&2; exit 1; }
require_root() {
  [[ "$EUID" -eq 0 ]] || die "请使用 sudo 或 root 运行"
  [[ "$(uname -s)" == Linux ]] || die "生产部署支持 Linux；本机开发请使用 start.sh"
}
validate_base_dir() {
  [[ "$LEIBLOG_BASE_DIR" =~ ^/[A-Za-z0-9._/-]+/[A-Za-z0-9._-]+$ ]] || die "部署目录必须是专用的绝对路径"
  case "$LEIBLOG_BASE_DIR" in /usr/local|/var/lib|/var/log|/etc/*|/proc/*|/sys/*|/dev/*|*/../*|*/./*) die "拒绝使用系统目录或非规范路径";; esac
  [[ ! -L "$LEIBLOG_BASE_DIR" ]] || die "部署目录不能是符号链接"
  if command -v realpath >/dev/null && [[ "$(uname -s)" == Linux ]]; then
    [[ "$(realpath -m "$LEIBLOG_BASE_DIR")" == "$LEIBLOG_BASE_DIR" ]] || die "部署目录的父级不能是符号链接"
  fi
}
validate_domain_name() {
  [[ "$1" =~ ^[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$ ]] || die "请输入纯域名，不含协议、端口、路径或通配符"
  [[ ${#1} -le 253 ]] || die "域名过长"
}
ensure_tools() {
  local missing=() binary
  for binary in curl tar openssl flock realpath; do command -v "$binary" >/dev/null || missing+=("$binary"); done
  if [[ ${#missing[@]} -gt 0 ]]; then
    if command -v apt-get >/dev/null; then
      apt-get update
      DEBIAN_FRONTEND=noninteractive apt-get install -y ca-certificates curl tar openssl util-linux coreutils
    elif command -v dnf >/dev/null; then
      dnf install -y ca-certificates curl tar openssl util-linux coreutils
    else die "请先安装 curl、GNU tar、openssl、flock 和 realpath"; fi
  fi
  tar --version | head -1 | grep -q 'GNU tar' || die "需要 GNU tar"
}
ensure_docker() {
  if ! command -v docker >/dev/null; then
    [[ "${LEIBLOG_INSTALL_DOCKER:-1}" == 1 ]] || die "请先安装 Docker 和 Compose v2"
    local installer
    installer="$(mktemp)"
    curl --fail --silent --show-error --location --proto '=https' https://get.docker.com -o "$installer"
    bash -n "$installer"
    sh "$installer"
    rm -f "$installer"
    systemctl enable --now docker
  fi
  docker info >/dev/null 2>&1 || die "Docker 服务未运行"
  docker compose version >/dev/null 2>&1 || die "需要 Docker Compose v2，且支持 up --wait"
}
load_env_file() {
  local file="${1:-$ENV_FILE}" line key value
  [[ -f "$file" && ! -L "$file" ]] || die "配置文件不存在或是符号链接: $file"
  grep -q '^LEIBLOG_DEPLOYMENT_FORMAT=2$' "$file" || die "这不是新项目部署配置；禁止覆盖旧项目，请使用不同的 LEIBLOG_BASE_DIR 和 LEIBLOG_PROJECT_NAME"
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ -z "$line" || "$line" == \#* ]] && continue
    [[ "$line" == *=* ]] || die "无效配置行"
    key="${line%%=*}"; value="${line#*=}"
    case "$key" in
      LEIBLOG_DEPLOYMENT_FORMAT|LEIBLOG_PROJECT_NAME|SITE_HOST|HTTP_PORT|HTTPS_PORT|PROXY_SUBNET|PROXY_IP|API_IP|POSTGRES_USER|POSTGRES_DB|POSTGRES_PASSWORD|REDIS_PASSWORD|JWT_SECRET|CONFIG_ENCRYPTION_SECRET|ALTCHA_SECRET|SETUP_TOKEN|ADMIN_BOOTSTRAP_USERNAME|ADMIN_BOOTSTRAP_EMAIL|ADMIN_BOOTSTRAP_PASSWORD) ;;
      *) die "未知配置字段: $key";;
    esac
    [[ "$value" =~ ^[A-Za-z0-9@:/.,_+=-]*$ ]] || die "配置只支持未经引号包裹的单行安全值: $key"
    printf -v "$key" '%s' "$value"
    export "${key?}"
  done < "$file"
}
validate_env() {
  validate_domain_name "${SITE_HOST:-}"
  [[ "${LEIBLOG_PROJECT_NAME:-}" =~ ^[a-z][a-z0-9_-]{1,40}$ ]] || die "无效 Compose 项目名"
  local key value seen=':'
  for key in POSTGRES_PASSWORD REDIS_PASSWORD JWT_SECRET CONFIG_ENCRYPTION_SECRET ALTCHA_SECRET; do
    value="${!key:-}"
    [[ "$value" =~ ^[a-f0-9]{64}$ ]] || die "$key 必须是独立随机生成的 64 位十六进制值"
    [[ "$seen" != *":$value:"* ]] || die "生产密钥不能复用: $key"
    seen="$seen$value:"
  done
  [[ "$JWT_SECRET" != "$CONFIG_ENCRYPTION_SECRET" && "$JWT_SECRET" != "$ALTCHA_SECRET" && "$CONFIG_ENCRYPTION_SECRET" != "$ALTCHA_SECRET" ]] || die "应用密钥不能复用"
  for key in HTTP_PORT HTTPS_PORT; do
    value="${!key:-}"
    [[ "$value" =~ ^[1-9][0-9]{0,4}$ && "$value" -le 65535 ]] || die "无效端口: $key"
  done
  [[ "$HTTP_PORT" != "$HTTPS_PORT" ]] || die "HTTP 与 HTTPS 端口不能相同"
  PUBLIC_SITE_ORIGIN="https://$SITE_HOST"
  [[ "$HTTPS_PORT" == 443 ]] || PUBLIC_SITE_ORIGIN="$PUBLIC_SITE_ORIGIN:$HTTPS_PORT"
  export PUBLIC_SITE_ORIGIN
  [[ "${POSTGRES_USER:-}" =~ ^[a-z][a-z0-9_]{1,40}$ && "${POSTGRES_DB:-}" =~ ^[a-z][a-z0-9_]{1,40}$ ]] || die "无效 PostgreSQL 用户或库名"
  [[ -z "${SETUP_TOKEN:-}" || "$SETUP_TOKEN" =~ ^[a-f0-9]{48}$ ]] || die "初始化令牌必须是独立随机生成的 48 位十六进制值"
  [[ "${PROXY_SUBNET:-}" =~ ^[0-9.]+/[0-9]+$ && "${PROXY_IP:-}" =~ ^[0-9.]+$ && "${API_IP:-}" =~ ^[0-9.]+$ ]] || die "无效代理网段"
  [[ "$PROXY_IP" != "$API_IP" ]] || die "代理和 API 的地址不能相同"
}
compose() {
  load_env_file
  validate_env
  docker compose --project-name "$LEIBLOG_PROJECT_NAME" --project-directory "$LEIBLOG_BASE_DIR" --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}
assert_instance() {
  local directory
  while IFS= read -r directory; do
    [[ -z "$directory" || "$directory" == "$LEIBLOG_BASE_DIR" ]] || die "Compose 项目名已被另一个部署目录占用: $directory"
  done < <(docker ps -a --filter "label=com.docker.compose.project=$LEIBLOG_PROJECT_NAME" --format '{{.Label "com.docker.compose.project.working_dir"}}')
}
upsert_env_value() {
  local key="$1" value="$2" file="${3:-$ENV_FILE}" temporary
  temporary="$(mktemp "${file}.XXXXXX")"
  awk -v key="$key" -v value="$value" 'BEGIN { found=0 } index($0,key "=")==1 { print key "=" value; found=1; next } { print } END { if(!found) print key "=" value }' "$file" > "$temporary"
  chmod 600 "$temporary"
  mv "$temporary" "$file"
}
prompt_domain() {
  local domain="${1:-${LEIBLOG_SITE_HOST:-}}"
  if [[ -z "$domain" && -t 0 ]]; then read -r -p '站点域名（必须已解析到服务器）: ' domain; fi
  validate_domain_name "$domain"
  printf '%s\n' "$domain"
}
write_env_if_missing() {
  [[ ! -f "$ENV_FILE" ]] || return 0
  local domain
  domain="$(prompt_domain "${1:-}")"
  umask 077
  printf '%s\n' \
    'LEIBLOG_DEPLOYMENT_FORMAT=2' "LEIBLOG_PROJECT_NAME=$LEIBLOG_PROJECT_NAME" "SITE_HOST=$domain" \
    "HTTP_PORT=${LEIBLOG_HTTP_PORT:-80}" "HTTPS_PORT=${LEIBLOG_HTTPS_PORT:-443}" \
    "PROXY_SUBNET=${LEIBLOG_PROXY_SUBNET:-172.30.197.0/29}" "PROXY_IP=${LEIBLOG_PROXY_IP:-172.30.197.2}" "API_IP=${LEIBLOG_API_IP:-172.30.197.3}" \
    'POSTGRES_USER=leiblog' 'POSTGRES_DB=leiblog' \
    "POSTGRES_PASSWORD=$(openssl rand -hex 32)" "REDIS_PASSWORD=$(openssl rand -hex 32)" \
    "JWT_SECRET=$(openssl rand -hex 32)" "CONFIG_ENCRYPTION_SECRET=$(openssl rand -hex 32)" "ALTCHA_SECRET=$(openssl rand -hex 32)" \
    "SETUP_TOKEN=$(openssl rand -hex 24)" > "$ENV_FILE"
  load_env_file; validate_env
  chmod 600 "$ENV_FILE"
}
validate_archive() {
  local archive="$1" kind="$2" listing names expanded maximum="${LEIBLOG_MAX_ARCHIVE_BYTES:-10737418240}"
  [[ "$maximum" =~ ^[1-9][0-9]{0,11}$ ]] || die "无效归档大小上限"
  listing="$(tar --numeric-owner -tvzf "$archive" | awk 'NR>100000 { exit 1 } { print }')" || die "无法读取归档，或文件数超过上限"
  [[ -n "$listing" ]] || die "归档为空"
  printf '%s\n' "$listing" | awk 'substr($0,1,1)!="-" && substr($0,1,1)!="d" { bad=1 } END { exit bad }' || die "归档含链接或特殊文件"
  expanded="$(printf '%s\n' "$listing" | awk '{ sum += $3 } END { printf "%.0f", sum }')"
  [[ "$expanded" -le "$maximum" ]] || die "归档解压大小超过上限"
  ARCHIVE_EXPANDED_BYTES="$expanded"
  names="$(tar -tzf "$archive")"
  local name
  while IFS= read -r name; do
    [[ "$name" != /* && "$name" != *\\* ]] || die "归档路径不安全"
    case "/$name/" in */../*) die "归档含目录穿越";; esac
    if [[ "$kind" == backup ]]; then
      case "$name" in database.dump|.env|docker-compose.yml|manifest.txt|uploads|uploads/|uploads/*) ;;
        *) die "备份包含未知文件: $name";;
      esac
    fi
  done <<< "$names"
}
validate_source() {
  local directory="$1" file
  for file in blog-server/src/app.ts blog-server/src/shared/env.ts blog-client/Dockerfile blog-client/Caddyfile deploy/compose.production.yml deploy/leiblog.sh; do
    [[ -f "$directory/$file" && ! -L "$directory/$file" ]] || die "源码不是可部署的新项目，缺少 $file；请先将本次修改推送到部署分支"
  done
  bash -n "$directory/deploy/leiblog.sh"
}
fetch_source() (
  local temporary archive
  temporary="$(mktemp -d "${LEIBLOG_BASE_DIR}/.fetch.XXXXXX")"
  trap 'rm -rf "$temporary"' EXIT
  archive="$temporary/source.tar.gz"
  mkdir "$temporary/source"
  if [[ -n "${LEIBLOG_SOURCE_DIR:-}" ]]; then
    validate_source "$LEIBLOG_SOURCE_DIR"
    tar --exclude=node_modules --exclude=dist --exclude=.git --exclude=.sl --exclude=.env --exclude='.env.*' --exclude=uploads --exclude=output --exclude=coverage --exclude='.DS_Store' \
      -czf "$archive" -C "$LEIBLOG_SOURCE_DIR" .
    validate_archive "$archive" source
    tar --no-same-owner --no-same-permissions -xzf "$archive" -C "$temporary/source"
  else
    [[ "$LEIBLOG_REPO_ARCHIVE_URL" == https://* ]] || die "源码下载必须使用 HTTPS"
    info "下载部署源码: $LEIBLOG_REPO_ARCHIVE_URL"
    curl --fail --location --proto '=https' --retry 3 --max-time 300 "$LEIBLOG_REPO_ARCHIVE_URL" -o "$archive"
    validate_archive "$archive" source
    tar --no-same-owner --no-same-permissions -xzf "$archive" --strip-components=1 -C "$temporary/source"
  fi
  validate_source "$temporary/source"
  [[ ! -d "$SOURCE_DIR" ]] || mv "$SOURCE_DIR" "${LEIBLOG_BASE_DIR}/source.previous.$(date +%s).$$"
  mv "$temporary/source" "$SOURCE_DIR"
  install -m 600 "$SOURCE_DIR/deploy/compose.production.yml" "$COMPOSE_FILE"
)
install_cli_file() {
  local file="$1"
  bash -n "$file"
  grep -q 'LEIBLOG_DEPLOYMENT_FORMAT=2' "$file" || die "拒绝安装旧项目的部署脚本"
  [[ "$(readlink -f "$file")" != "$(readlink -m "$LEIBLOG_COMMAND_PATH")" ]] || return 0
  install -m 755 "$file" "$LEIBLOG_COMMAND_PATH"
}
install_cli_command() {
  require_root; ensure_tools
  if [[ -f "${BASH_SOURCE[0]}" && "${BASH_SOURCE[0]}" != /dev/* && "$(readlink -f "${BASH_SOURCE[0]}")" != "$(readlink -m "$LEIBLOG_COMMAND_PATH")" ]]; then
    install_cli_file "${BASH_SOURCE[0]}"
  else
    local temporary
    temporary="$(mktemp)"
    [[ "$LEIBLOG_SCRIPT_URL" == https://* ]] || die "脚本下载必须使用 HTTPS"
    curl --fail --location --proto '=https' "$LEIBLOG_SCRIPT_URL" -o "$temporary"
    install_cli_file "$temporary"
    rm -f "$temporary"
  fi
  info "全局命令已安装: $LEIBLOG_COMMAND_PATH"
}
start_services() {
  compose config --quiet
  compose up -d --wait --wait-timeout 180 --remove-orphans
}
check_public_site() {
  load_env_file
  local origin="https://${SITE_HOST}" home admin
  [[ "$HTTPS_PORT" == 443 ]] || origin="$origin:$HTTPS_PORT"
  curl --fail --silent --show-error --retry 10 --retry-delay 3 --retry-all-errors --max-time 10 "$origin/api/health" >/dev/null
  home="$(curl --fail --silent --show-error --max-time 10 "$origin/")"
  admin="$(curl --fail --silent --show-error --max-time 10 "$origin/admin/site-settings")"
  [[ "$home" != "$admin" && "$admin" == *'<title>LeiBlog Admin</title>'* ]] || die "前后台路由入口检查失败"
  info "HTTPS、API 健康及前后台路由检查通过: $origin"
}
backup_before_deployment() {
  [[ -f "$COMPOSE_FILE" ]] || return 0
  local containers volumes
  containers="$(compose ps --all --quiet postgres)" || die "无法检查已有数据库容器，拒绝跳过备份"
  volumes="$(docker volume ls --quiet --filter "label=com.docker.compose.project=$LEIBLOG_PROJECT_NAME" --filter 'label=com.docker.compose.volume=postgres-data')" || die "无法检查已有数据库卷，拒绝跳过备份"
  if [[ -z "$containers" && -z "$volumes" ]]; then
    info "尚未创建数据库容器或数据卷，保留配置并继续首次安装"
    return 0
  fi
  compose up -d --no-deps --wait --wait-timeout 180 postgres || die "无法启动已有数据库，请先修复后再备份"
  backup_leiblog || die "部署前备份失败"
}
backup_leiblog() (
  local temporary backup='' running resume=0 completed=0
  temporary="$(mktemp -d "${LEIBLOG_BASE_DIR}/.backup.XXXXXX")" || die "无法创建备份暂存目录"
  trap 'rm -rf "$temporary"; if [[ "$completed" == 0 && -n "$backup" ]]; then rm -f "$backup" "${backup}.partial"; fi; if [[ "$resume" == 1 ]]; then compose start api >/dev/null; fi' EXIT
  running="$(compose ps --status running --quiet api)" || die "无法检查 API 状态，备份已中止"
  if [[ -n "$running" ]]; then resume=1; compose stop api || die "无法停止 API，备份已中止"; fi
  load_env_file
  compose exec -T postgres pg_dump --format=custom --no-owner -U "$POSTGRES_USER" "$POSTGRES_DB" > "$temporary/database.dump" || die "数据库导出失败，未生成备份"
  printf 'LEIBLOG_BACKUP_FORMAT=2\n' > "$temporary/manifest.txt" || die "无法写入备份清单"
  backup="$(mktemp --suffix=.tar.gz "${BACKUP_DIR}/leiblog-backup-$(date +%Y%m%d-%H%M%S)-XXXXXX")" || die "无法创建备份文件"
  tar -czf "${backup}.partial" -C "$temporary" database.dump manifest.txt -C "$LEIBLOG_BASE_DIR" .env docker-compose.yml uploads || die "备份归档失败"
  chmod 600 "${backup}.partial" || die "无法设置备份权限"
  mv "${backup}.partial" "$backup" || die "无法保存完整备份"
  completed=1
  info "备份完成（包含加密密钥和个人数据，请妥善保护）: $backup"
)
confirm_dangerous_action() {
  [[ "${LEIBLOG_FORCE:-0}" != 1 ]] || return 0
  [[ -t 0 ]] || die "$1；非交互模式需明确设置 LEIBLOG_FORCE=1"
  local answer
  read -r -p "$1，输入 YES 继续: " answer
  [[ "$answer" == YES ]] || die "已取消"
}
restore_leiblog() (
  local backup="${1:-}" temporary committed=0 swapped=0 stopped=0 ready=0 key value
  [[ -f "$backup" && ! -L "$backup" ]] || die "请提供受信任的备份文件"
  validate_archive "$backup" backup
  local available
  available="$(df -Pk "$LEIBLOG_BASE_DIR" | awk 'END { printf "%.0f", $4*1024 }')"
  [[ "$available" -gt $((ARCHIVE_EXPANDED_BYTES * 2 + 536870912)) ]] || die "磁盘空闲空间不足以安全暂存恢复文件"
  temporary="$(mktemp -d "${LEIBLOG_BASE_DIR}/.restore.XXXXXX")"
  trap 'if [[ "$committed" == 0 && "$swapped" == 1 ]]; then rm -rf "$UPLOADS_DIR"; mv "$temporary/previous-uploads" "$UPLOADS_DIR"; cp "$temporary/previous.env" "$ENV_FILE"; fi; if [[ "$stopped" == 1 && ( "$committed" == 0 || "$ready" == 1 ) ]]; then compose start api web >/dev/null || true; fi; rm -rf "$temporary"' EXIT
  tar --no-same-owner --no-same-permissions -xzf "$backup" -C "$temporary"
  grep -qx 'LEIBLOG_BACKUP_FORMAT=2' "$temporary/manifest.txt" || die "不支持旧项目备份或未知备份版本"
  [[ -s "$temporary/database.dump" && -d "$temporary/uploads" ]] || die "备份缺少数据库或媒体"
  (load_env_file "$temporary/.env"; validate_env)
  confirm_dangerous_action "恢复会覆盖业务数据库和媒体、撤销会话，请确认备份来自可信来源"
  backup_leiblog
  cp "$ENV_FILE" "$temporary/previous.env"
  cp "$ENV_FILE" "$temporary/restored.env"
  for key in JWT_SECRET CONFIG_ENCRYPTION_SECRET ALTCHA_SECRET; do
    value="$(awk -F= -v key="$key" '$1==key { print $2 }' "$temporary/.env")"
    upsert_env_value "$key" "$value" "$temporary/restored.env"
  done
  chown -R 1000:1000 "$temporary/uploads"
  chmod 750 "$temporary/uploads"
  compose stop api web
  stopped=1
  mv "$UPLOADS_DIR" "$temporary/previous-uploads"
  swapped=1
  mv "$temporary/uploads" "$UPLOADS_DIR"
  install -m 600 "$temporary/restored.env" "$ENV_FILE"
  load_env_file
  if ! compose exec -T postgres pg_restore --clean --if-exists --single-transaction --exit-on-error --no-owner -U "$POSTGRES_USER" -d "$POSTGRES_DB" < "$temporary/database.dump"; then
    die "数据库恢复失败，事务已回滚，将恢复原媒体和配置"
  fi
  committed=1
  compose exec -T postgres psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c \
    'BEGIN; UPDATE auth_sessions SET revoked_at=now(); UPDATE email_verification_codes SET consumed_at=now(); DELETE FROM oauth_login_states; COMMIT;'
  compose exec -T redis redis-cli FLUSHDB >/dev/null
  ready=1
  start_services
  check_public_site
  info "恢复完成；请重新登录，并核对邮件队列、R2 媒体和第三方配置"
)
deploy_release() {
  local domain="${2:-}"
  write_env_if_missing "$domain"
  load_env_file
  if [[ -z "${SETUP_TOKEN:-}" ]]; then upsert_env_value SETUP_TOKEN "$(openssl rand -hex 24)"; fi
  load_env_file; validate_env; assert_instance
  backup_before_deployment
  fetch_source
  compose build --pull
  start_services
  check_public_site
  install_cli_file "$SOURCE_DIR/deploy/leiblog.sh"
  info "后台地址: https://${SITE_HOST}/admin"
  local count
  count="$(compose exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "SELECT count(*) FROM users WHERE role='admin'")"
  if [[ "$count" == 0 ]]; then
    info "初始化地址: ${PUBLIC_SITE_ORIGIN}/admin/setup"
    info "SETUP_TOKEN: $SETUP_TOKEN"
  fi
}
show_usage() {
  printf '%s\n' "LeiBlog 新项目生产部署 $LEIBLOG_SCRIPT_VERSION" \
    '用法: leiblog <命令>' \
    '  install-cli                  安装全局命令' \
    '  install [domain]             首次安装，同一域名自动 HTTPS' \
    '  update [--domain [domain]]    先备份，再获取源码、构建和检查服务' \
    '  domain [domain]              修改 HTTPS 域名' \
    '  start | stop | restart       管理服务' \
    '  status | logs [service]      查看状态或日志（web/api/postgres/redis）' \
    '  doctor                       检查配置、容器、HTTPS 与页面入口' \
    '  backup | restore <file>      备份或恢复新项目数据' \
    '  uninstall [--purge]          停止服务；--purge 永久删除数据' \
    '默认目录 /var/leiblog；安装后通过 /admin/setup 和 SETUP_TOKEN 创建管理员。' \
    '可配置 LEIBLOG_BASE_DIR、LEIBLOG_PROJECT_NAME、LEIBLOG_SOURCE_DIR、LEIBLOG_REPO_ARCHIVE_URL。' \
    '禁止在旧项目的部署目录和 Compose 项目名上直接安装。'
}
main() {
  trap 'printf "部署失败，行号 %s，退出码 %s；请检查上方输出及 leiblog logs。\n" "$LINENO" "$?" >&2' ERR
  local command="${1:-help}" domain
  shift || true
  case "$command" in help|-h|--help) show_usage; return;; install-cli) install_cli_command; return;; esac
  case "$command" in install|update|domain|start|stop|restart|status|logs|log|doctor|backup|restore|uninstall) ;; *) show_usage; die "未知命令: $command";; esac
  require_root; validate_base_dir; ensure_tools; ensure_docker
  local path
  for path in "$SOURCE_DIR" "$BACKUP_DIR" "$UPLOADS_DIR" "$COMPOSE_FILE"; do
    [[ ! -L "$path" ]] || die "拒绝使用符号链接部署路径: $path"
  done
  if [[ -f "$ENV_FILE" ]]; then load_env_file; validate_env; assert_instance; fi
  [[ ! -f "$COMPOSE_FILE" || -f "$ENV_FILE" ]] || die "发现无配置的现有部署，拒绝覆盖"
  [[ "$LEIBLOG_PROJECT_NAME" =~ ^[a-z][a-z0-9_-]{1,40}$ ]] || die "无效 Compose 项目名"
  exec 8> "/var/lock/leiblog-${LEIBLOG_PROJECT_NAME}.lock"
  flock -n 8 || die "同名部署任务正在运行"
  umask 077
  mkdir -p "$LEIBLOG_BASE_DIR" "$BACKUP_DIR" "$UPLOADS_DIR"
  chmod 750 "$LEIBLOG_BASE_DIR" "$BACKUP_DIR"
  exec 9> "$LEIBLOG_BASE_DIR/.deploy.lock"
  flock -n 9 || die "另一个部署或备份任务正在运行"
  case "$command" in
    install) chown 1000:1000 "$UPLOADS_DIR"; chmod 750 "$UPLOADS_DIR"; deploy_release install "${1:-}";;
    update)
      [[ -f "$ENV_FILE" && -f "$COMPOSE_FILE" ]] || die "请先安装"
      load_env_file; validate_env; assert_instance
      if [[ "${1:-}" == --domain ]]; then
        backup_before_deployment
        domain="$(prompt_domain "${2:-}")"; upsert_env_value SITE_HOST "$domain"
      elif [[ $# -gt 0 ]]; then die "未知 update 参数"; fi
      deploy_release update;;
    *)
      [[ -f "$COMPOSE_FILE" ]] || die "请先安装"
      load_env_file; validate_env; assert_instance
      case "$command" in
        domain) backup_leiblog; domain="$(prompt_domain "${1:-}")"; upsert_env_value SITE_HOST "$domain"; start_services; check_public_site;;
        start) start_services;;
        stop) compose stop;;
        restart) compose restart; start_services;;
        status) compose ps;;
        logs|log) compose logs --follow --tail 200 "$@";;
        doctor) compose config --quiet; compose ps; check_public_site;;
        backup) backup_leiblog;;
        restore) restore_leiblog "${1:-}";;
        uninstall)
          [[ $# -eq 0 || ( $# -eq 1 && "$1" == --purge ) ]] || die "未知卸载参数"
          confirm_dangerous_action '停止并移除容器，默认保留数据'
          if [[ "${1:-}" == --purge ]]; then
            confirm_dangerous_action "永久删除 $LEIBLOG_BASE_DIR 以及本项目数据卷"
            compose down --volumes --remove-orphans; rm -rf "$LEIBLOG_BASE_DIR"
          else compose down --remove-orphans; fi;;
        *) show_usage; die "未知命令: $command";;
      esac;;
  esac
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then main "$@"; fi
