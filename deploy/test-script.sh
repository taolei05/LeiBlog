#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
fixture_dir="$(mktemp -d)"
trap 'rm -rf "$fixture_dir"' EXIT
# shellcheck source=leiblog.sh
source "$root/deploy/leiblog.sh"
expect_failure() { if ("$@") >/dev/null 2>&1; then printf 'Expected failure: %s\n' "$*" >&2; exit 1; fi; }
validate_domain_name blog.example.com
for domain in 'https://example.com' 'example.com/path' 'example.com:443' '*.example.com' '-bad.example.com' 'example.com;touch'; do
  expect_failure validate_domain_name "$domain"
done
LEIBLOG_BASE_DIR=/
expect_failure validate_base_dir
export LEIBLOG_BASE_DIR=/var/leiblog
validate_base_dir
# The fixture must retain a literal command substitution.
# shellcheck disable=SC2016
printf 'LEIBLOG_DEPLOYMENT_FORMAT=2\nJWT_SECRET=$(touch %s/canary)\n' "$fixture_dir" > "$fixture_dir/unsafe.env"
expect_failure load_env_file "$fixture_dir/unsafe.env"
[[ ! -f "$fixture_dir/canary" ]]
printf 'APP_ENV=production\n' > "$fixture_dir/legacy.env"
expect_failure load_env_file "$fixture_dir/legacy.env"
printf 'LEIBLOG_DEPLOYMENT_FORMAT=2\nSETUP_TOKEN=\nSITE_HOST=blog.example.com\n' > "$fixture_dir/safe.env"
load_env_file "$fixture_dir/safe.env"
[[ "$SITE_HOST" == blog.example.com && -z "$SETUP_TOKEN" ]]
LEIBLOG_FORCE=1 confirm_dangerous_action 'fixture confirmation'
ENV_FILE="$fixture_dir/safe.env" write_env_if_missing
(
  LEIBLOG_BASE_DIR="$fixture_dir"
  ENV_FILE="$fixture_dir/fresh.env"
  write_env_if_missing blog.example.com
  [[ "$SETUP_TOKEN" =~ ^[a-f0-9]{48}$ ]]
  ! grep -q 'ADMIN_BOOTSTRAP' "$ENV_FILE"
  [[ ! -e "$fixture_dir/bootstrap-credentials.txt" ]]
)
mkdir "$fixture_dir/uploads"
printf 'test' > "$fixture_dir/uploads/image.png"
tar -czf "$fixture_dir/safe.tar.gz" -C "$fixture_dir" uploads
validate_archive "$fixture_dir/safe.tar.gz" backup
ln -s /etc/passwd "$fixture_dir/uploads/link"
tar -czf "$fixture_dir/link.tar.gz" -C "$fixture_dir" uploads
expect_failure validate_archive "$fixture_dir/link.tar.gz" backup
tar -czf "$fixture_dir/unknown.tar.gz" -C "$fixture_dir" safe.env
expect_failure validate_archive "$fixture_dir/unknown.tar.gz" backup
expect_failure validate_source "$root/blog-server"
validate_source "$root"
bash -n "$root/deploy/leiblog.sh"

if ! grep -qx 'RUN bun --bun run build' "$root/blog-client/Dockerfile" ||
  grep -Eq '^RUN .*bun .*run (check|test)( |$)' "$root/blog-client/Dockerfile"; then
  printf '%s\n' 'Production builds must not run development lint/test tools.' >&2
  exit 1
fi
grep -q 'bun run check' "$root/check.sh"
grep -q 'bun run test --run' "$root/check.sh"
grep -q 'run: ./check.sh' "$root/.github/workflows/check.yml"

assert_backup_plan() {
  local container_value="$1" volume_value="$2" expected="$3" actual
  compose() {
    case "$*" in
      'ps --all --quiet postgres') printf '%s' "$container_value";;
      'up -d --no-deps --wait --wait-timeout 180 postgres') printf 'start\n';;
      *) return 98;;
    esac
  }
  docker() {
    [[ "$*" == "volume ls --quiet --filter label=com.docker.compose.project=$LEIBLOG_PROJECT_NAME --filter label=com.docker.compose.volume=postgres-data" ]] || return 98
    printf '%s' "$volume_value"
  }
  backup_leiblog() { printf 'backup\n'; }
  info() { :; }
  actual="$(backup_before_deployment)"
  [[ "$actual" == "$expected" ]] || {
    printf 'Unexpected backup plan: %s\n' "$actual" >&2
    exit 1
  }
}

COMPOSE_FILE="$fixture_dir/missing-compose.yml"
assert_backup_plan '' '' ''
COMPOSE_FILE="$fixture_dir/docker-compose.yml"
touch "$COMPOSE_FILE"
assert_backup_plan '' '' ''
assert_backup_plan 'existing-container' '' $'start\nbackup'
assert_backup_plan '' 'retained-volume' $'start\nbackup'
assert_backup_plan 'existing-container' 'retained-volume' $'start\nbackup'
if (
  compose() { return 1; }
  backup_before_deployment
) >/dev/null 2>&1; then
  printf '%s\n' 'Failed database discovery must block deployment.' >&2
  exit 1
fi
if (
  compose() { :; }
  docker() { return 1; }
  backup_before_deployment
) >/dev/null 2>&1; then
  printf '%s\n' 'Failed volume discovery must block deployment.' >&2
  exit 1
fi
if (
  # shellcheck source=leiblog.sh
  source "$root/deploy/leiblog.sh"
  LEIBLOG_BASE_DIR="$fixture_dir"
  BACKUP_DIR="$fixture_dir"
  load_env_file() { POSTGRES_USER=fixture; POSTGRES_DB=fixture; }
  compose() {
    case "$1" in
      ps) return 0;;
      *) return 1;;
    esac
  }
  backup_leiblog
) >/dev/null 2>&1; then
  printf '%s\n' 'A failed database dump must never produce a successful backup.' >&2
  exit 1
fi
printf '%s\n' 'Production build and interrupted-install retry checks passed.'
printf '%s\n' 'Deployment script regression checks passed.'
