#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
fixture_dir="$(mktemp -d)"
trap 'rm -rf "$fixture_dir"' EXIT
# shellcheck source=leiblog.sh
source "$root/deploy/leiblog.sh"

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
