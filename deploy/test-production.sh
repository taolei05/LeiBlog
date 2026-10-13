#!/usr/bin/env bash
set -Eeuo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
temporary="$(mktemp -d)"
project="leiblog-production-test-$$"
compose() { docker compose --project-name "$project" --project-directory "$temporary" --env-file "$temporary/.env" -f "$temporary/docker-compose.yml" -f "$temporary/test-compose.yml" "$@"; }
cleanup() {
  local code=$?
  if [[ "$code" -ne 0 ]]; then compose logs --tail 80 api web >&2 || true; fi
  compose down --volumes --remove-orphans >/dev/null 2>&1 || true
  rm -rf "$temporary"
}
trap cleanup EXIT
umask 077
ln -s "$root" "$temporary/source"
mkdir "$temporary/uploads"
chmod 777 "$temporary/uploads"
cp "$root/deploy/compose.production.yml" "$temporary/docker-compose.yml"
printf '%s\n' "LEIBLOG_PROJECT_NAME=$project" 'SITE_HOST=blog.example.test' \
  'LEIBLOG_DEPLOYMENT_FORMAT=2' 'HTTP_PORT=80' 'HTTPS_PORT=443' \
  'PROXY_SUBNET=172.30.197.0/29' 'PROXY_IP=172.30.197.2' 'API_IP=172.30.197.3' \
  'POSTGRES_USER=leiblog_test' 'POSTGRES_DB=leiblog_test_production' \
  "POSTGRES_PASSWORD=$(openssl rand -hex 32)" "REDIS_PASSWORD=$(openssl rand -hex 32)" \
  "JWT_SECRET=$(openssl rand -hex 32)" "CONFIG_ENCRYPTION_SECRET=$(openssl rand -hex 32)" "ALTCHA_SECRET=$(openssl rand -hex 32)" \
  'ADMIN_BOOTSTRAP_USERNAME=testadmin' 'ADMIN_BOOTSTRAP_EMAIL=testadmin@example.test' \
  "ADMIN_BOOTSTRAP_PASSWORD=$(openssl rand -hex 24)" > "$temporary/.env"
printf '%s\n' \
  'services:' \
  '  api:' \
  '    networks: !override' \
  '      edge: {}' \
  '      data: {}' \
  '  web:' \
  '    ports: !override' \
  '      - "127.0.0.1::443"' \
  '    volumes:' \
  '      - ./test.Caddyfile:/etc/caddy/Caddyfile:ro' \
  '    networks: !override' \
  '      edge: {}' \
  'networks:' \
  '  edge:' \
  '    ipam: !reset {}' > "$temporary/test-compose.yml"
awk '/^\{\$SITE_HOST\} \{/ { print; print "    tls internal"; next } { print }' "$root/blog-client/Caddyfile" > "$temporary/test.Caddyfile"
printf '\n' >> "$temporary/test.Caddyfile"
compose config --quiet
compose build
compose up -d --wait --wait-timeout 240
compose exec -T web caddy validate --config /etc/caddy/Caddyfile
port="$(compose port web 443 | sed 's/.*://')"
url="https://blog.example.test:$port"
request() { curl --noproxy '*' --fail --silent --show-error --insecure --resolve "blog.example.test:$port:127.0.0.1" "$@"; }
request "$url/api/health" | grep -q '"ok":true'
home="$(request "$url/")"
admin="$(request "$url/admin/site-settings")"
[[ "$home" != "$admin" && "$admin" == *'<title>LeiBlog Admin</title>'* ]]
request --head "$url/" | grep -qi 'Content-Security-Policy:'
request --head "$url/admin/site-settings" | grep -qi 'Cache-Control: no-store'
request "$url/api/admin/setup/status" | grep -q '"requiresSetup":false'
count="$(compose exec -T postgres psql -U leiblog_test -d leiblog_test_production -Atc "SELECT count(*) FROM users WHERE role='admin'")"
[[ "$count" == 1 ]]
compose exec -T api bun -e "const r=await fetch('http://127.0.0.1:3000/api/admin/setup/initial',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}); if(r.status!==403)process.exit(1)"
compose exec -T postgres psql -v ON_ERROR_STOP=1 -U leiblog_test -d leiblog_test_production -c "DELETE FROM users WHERE username='testadmin'" >/dev/null
compose exec -T api bun -e 'import {runMigrations} from "./src/shared/db/migrate.ts"; import {ensureBootstrapAdmin} from "./src/admin/bootstrap.ts"; import {closeSql} from "./src/shared/db/postgres.ts"; await Promise.all([runMigrations(),runMigrations()]); await Promise.all([ensureBootstrapAdmin(),ensureBootstrapAdmin()]); await closeSql();'
count="$(compose exec -T postgres psql -U leiblog_test -d leiblog_test_production -Atc "SELECT count(*) FROM users WHERE role='admin'")"
[[ "$count" == 1 ]]
compose exec -T api bun -e 'import {env} from "./src/shared/env.ts"; if(env.publicSiteUrl!=="https://blog.example.test" || process.getuid()!==1000)process.exit(1);'
asset="$(printf '%s' "$admin" | sed -n 's/.*src="\(\/assets\/[^"]*\.js\)".*/\1/p' | head -1)"
[[ -n "$asset" ]]
request --head "$url$asset" | grep -qi 'immutable'
docker run --rm --network "${project}_edge" \
  --env "LEIBLOG_BASE_DIR=$temporary" --env "LEIBLOG_PROJECT_NAME=$project" \
  -v /var/run/docker.sock:/var/run/docker.sock -v "$temporary:$temporary" -v "$root:/repo:ro" \
  docker:cli sh -c 'apk add --no-cache bash curl tar openssl coreutils >/dev/null && bash /repo/deploy/test-operations.sh'
printf '%s\n' 'Production image, HTTPS, separate SPA routes, CSP, private services, non-root API and startup regression checks passed.'
