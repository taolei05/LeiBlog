#!/usr/bin/env bash
set -euo pipefail

server_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
test_run_id="$(date +%s)-$$"
test_pg_container="leiblog-security-pg-$test_run_id"
test_redis_container="leiblog-security-redis-$test_run_id"

cleanup() {
  docker rm --force "$test_pg_container" "$test_redis_container" >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker run --detach --rm --name "$test_pg_container" --publish 127.0.0.1::5432 \
  --env POSTGRES_DB=leiblog_test_security --env POSTGRES_USER=leiblog_test \
  --env POSTGRES_PASSWORD=test-only-password postgres:17-alpine >/dev/null
docker run --detach --rm --name "$test_redis_container" --publish 127.0.0.1::6379 \
  redis:7-alpine redis-server --save '' --appendonly no >/dev/null

test_pg_port="$(docker inspect --format '{{(index (index .NetworkSettings.Ports "5432/tcp") 0).HostPort}}' "$test_pg_container")"
test_redis_port="$(docker inspect --format '{{(index (index .NetworkSettings.Ports "6379/tcp") 0).HostPort}}' "$test_redis_container")"

test_services_ready=false
for ((attempt = 0; attempt < 30; attempt++)); do
  if docker exec "$test_pg_container" pg_isready -h 127.0.0.1 -U leiblog_test -d leiblog_test_security >/dev/null 2>&1 &&
    docker exec "$test_redis_container" redis-cli ping >/dev/null 2>&1; then
    test_services_ready=true
    break
  fi
  sleep 1
done
if [[ "$test_services_ready" != true ]]; then
  printf '%s\n' 'Security test services did not become ready.' >&2
  exit 1
fi

cd "$server_dir"
export NODE_ENV=test
export AUTH_TEST_DATABASE_URL="postgres://leiblog_test:test-only-password@127.0.0.1:$test_pg_port/leiblog_test_security"
export AUTH_TEST_REDIS_URL="redis://127.0.0.1:$test_redis_port"
bun test tests/login-metadata.integration.test.ts
bun test tests/auth-security.integration.test.ts
bun test tests/comment-settings.integration.test.ts
bun test tests/email-notifications.integration.test.ts
bun test tests/subscriptions.integration.test.ts
