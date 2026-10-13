#!/usr/bin/env bash
set -Eeuo pipefail
trap 'printf "Operations test failed at line %s, exit %s\n" "$LINENO" "$?" >&2' ERR
[[ "${LEIBLOG_PROJECT_NAME:-}" == leiblog-production-test-* && -n "${LEIBLOG_BASE_DIR:-}" ]] || { echo 'This test requires an isolated production-test deployment.' >&2; exit 1; }
# shellcheck source=leiblog.sh
source /repo/deploy/leiblog.sh
compose() {
  load_env_file; validate_env
  docker compose --project-name "$LEIBLOG_PROJECT_NAME" --project-directory "$LEIBLOG_BASE_DIR" --env-file "$ENV_FILE" \
    -f "$COMPOSE_FILE" -f "$LEIBLOG_BASE_DIR/test-compose.yml" "$@"
}
check_public_site() {
  local ip
  ip="$(compose exec -T api getent hosts web | awk 'NR==1 { print $1 }')"
  curl --noproxy '*' --fail --silent --show-error --insecure --resolve "blog.example.test:443:$ip" --retry 5 --retry-all-errors \
    https://blog.example.test/api/health | grep -q '"ok":true'
}
umask 077
mkdir -p "$BACKUP_DIR"
[[ -L "$SOURCE_DIR" ]] && rm "$SOURCE_DIR"
LEIBLOG_SOURCE_DIR=/repo fetch_source
[[ ! -d "$SOURCE_DIR/blog-client/node_modules" && ! -f "$SOURCE_DIR/blog-server/.env" ]]
compose exec -T api bun -e "await Bun.write('/data/uploads/fixture.txt','original')"
backup_leiblog
backup="$(find "$BACKUP_DIR" -name '*.tar.gz' -type f | head -1)"
[[ -n "$backup" ]]
compose exec -T api bun -e "await Bun.write('/data/uploads/fixture.txt','changed')"
export LEIBLOG_FORCE=1
restore_leiblog "$backup"
[[ "$(compose exec -T api bun -e "console.log(await Bun.file('/data/uploads/fixture.txt').text())")" == original ]]
compose exec -T api bun -e "await Bun.write('/data/uploads/fixture.txt','before-failed-restore')"
mkdir "$LEIBLOG_BASE_DIR/corrupt-backup"
tar -xzf "$backup" -C "$LEIBLOG_BASE_DIR/corrupt-backup"
printf 'invalid database dump' > "$LEIBLOG_BASE_DIR/corrupt-backup/database.dump"
tar -czf "$LEIBLOG_BASE_DIR/corrupt.tar.gz" -C "$LEIBLOG_BASE_DIR/corrupt-backup" .env database.dump manifest.txt docker-compose.yml uploads
if restore_leiblog "$LEIBLOG_BASE_DIR/corrupt.tar.gz"; then
  echo 'A corrupt database dump was not rejected.' >&2; exit 1
fi
[[ "$(compose exec -T api bun -e "console.log(await Bun.file('/data/uploads/fixture.txt').text())")" == before-failed-restore ]]
load_env_file
[[ -n "$ADMIN_BOOTSTRAP_PASSWORD" ]] || { echo 'The test fixture password was unexpectedly lost.' >&2; exit 1; }
clear_bootstrap_password
load_env_file
[[ -z "$ADMIN_BOOTSTRAP_PASSWORD" ]]
count="$(compose exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "SELECT count(*) FROM users WHERE role='admin'")"
[[ "$count" == 1 ]]
printf '%s\n' 'Real deployment backup/restore, encryption-key preservation and bootstrap secret removal checks passed.'
