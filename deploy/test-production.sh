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
  # Restore tests create root-owned files; remove only this fixture through Docker.
  if docker image inspect docker:cli >/dev/null 2>&1; then
    docker run --rm --network none -v "$temporary:/cleanup" docker:cli \
      sh -c 'rm -rf /cleanup/* /cleanup/.[!.]* /cleanup/..?*' >/dev/null 2>&1 || true
  fi
  rm -rf "$temporary"
}
trap cleanup EXIT
umask 077
mkdir "$temporary/source"
# Match the restrictive permissions used by the production source downloader.
tar --exclude=node_modules --exclude=dist --exclude=.git --exclude=.sl --exclude=.env --exclude='.env.*' --exclude=uploads --exclude=output --exclude=coverage --exclude='.DS_Store' \
  -cf - -C "$root" . | tar -xf - -C "$temporary/source"
[[ "$(stat -c '%a' "$temporary/source/blog-server/package.json" 2>/dev/null || stat -f '%Lp' "$temporary/source/blog-server/package.json")" == 600 ]]
mkdir "$temporary/uploads"
chmod 777 "$temporary/uploads"
cp "$root/deploy/compose.production.yml" "$temporary/docker-compose.yml"
printf '%s\n' "LEIBLOG_PROJECT_NAME=$project" 'SITE_HOST=blog.example.test' \
  'LEIBLOG_DEPLOYMENT_FORMAT=2' 'HTTP_PORT=80' 'HTTPS_PORT=443' \
  'PROXY_SUBNET=172.30.197.0/29' 'PROXY_IP=172.30.197.2' 'API_IP=172.30.197.3' \
  'POSTGRES_USER=leiblog_test' 'POSTGRES_DB=leiblog_test_production' \
  "POSTGRES_PASSWORD=$(openssl rand -hex 32)" "REDIS_PASSWORD=$(openssl rand -hex 32)" \
  "JWT_SECRET=$(openssl rand -hex 32)" "CONFIG_ENCRYPTION_SECRET=$(openssl rand -hex 32)" "ALTCHA_SECRET=$(openssl rand -hex 32)" \
  "SETUP_TOKEN=$(openssl rand -hex 24)" > "$temporary/.env"
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
# Caddy cannot bypass the runner's file permissions after dropping capabilities.
chmod 644 "$temporary/test.Caddyfile"
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
request "$url/api/admin/setup/status" | grep -q '"requiresSetup":true'
request "$url/api/blog/settings" >/dev/null
empty_count() {
  compose exec -T postgres psql -U leiblog_test -d leiblog_test_production -Atc 'SELECT (SELECT count(*) FROM users) + (SELECT count(*) FROM site_settings) + (SELECT count(*) FROM auth_provider_settings) + (SELECT count(*) FROM media_folders) + (SELECT count(*) FROM articles) + (SELECT count(*) FROM article_categories) + (SELECT count(*) FROM article_tags) + (SELECT count(*) FROM article_contributors) + (SELECT count(*) FROM comments) + (SELECT count(*) FROM navigation_groups) + (SELECT count(*) FROM navigation_items) + (SELECT count(*) FROM media_assets)'
}
[[ "$(empty_count)" == 0 ]]
compose exec -T api bun -e 'import {runMigrations} from "./src/shared/db/migrate.ts"; import {closeSql} from "./src/shared/db/postgres.ts"; await Promise.all([runMigrations(),runMigrations()]); await closeSql();'
[[ "$(empty_count)" == 0 ]]
compose exec -T api bun -e "for(const path of ['initial','media']){for(const token of ['', 'wrong']){const r=await fetch('http://127.0.0.1:3000/api/admin/setup/'+path,{method:'POST',headers:{'Content-Type':'application/json','X-Setup-Token':token},body:'{}'});if(r.status!==403)process.exit(1)}}"
compose exec -T api bun -e 'import {env} from "./src/shared/env.ts"; const form=new FormData();form.set("file",new File([Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+cE+0AAAAASUVORK5CYII=","base64")],"test.png",{type:"image/png"}));form.set("folderSlug","avatars");const r=await fetch("http://127.0.0.1:3000/api/admin/setup/media",{method:"POST",headers:{"X-Setup-Token":env.setupToken},body:form});if(!r.ok)throw new Error("Upload failed");const {item}=await r.json();if(item.folderSlug!=="avatars")throw new Error("Lazy system folder upload failed");const url="http://127.0.0.1:3000"+item.accessUrl;const image=await fetch(url);if(!image.ok || !(image.headers.get("content-type")??"").startsWith("image/png") || (await image.arrayBuffer()).byteLength!==68)throw new Error("New upload is not immediately readable");const head=await fetch(url,{method:"HEAD"});if(!head.ok || head.headers.get("content-length")!=="68" || (await head.arrayBuffer()).byteLength!==0)throw new Error("Upload HEAD response does not match the file");'
setup_input='const input={admin:{name:"",username:"testadmin",email:"testadmin@example.test",password:"test-only-strong-password",avatarUrl:"",bio:"",tags:[],tagLocale:"zh-CN",socialLinks:[],blogUrl:"",commentEmailNotifications:false,newPostEmailNotifications:false},site:{siteName:"Test Blog",foundedAt:"2026-01-01 00:00",siteDescription:"",coverUrls:[],homepageCopy:"",lightLogoUrl:"",darkLogoUrl:"",faviconUrl:"",timeZone:"Asia/Shanghai"},basics:{seoTitle:"",seoDescription:"",seoKeywords:[],copyright:"",commentsEnabled:true,resendDomain:"",resendApiKey:"",deeplApiKey:"",ipGeolocationApiKey:""},filings:{icpRecords:[],policeRecordNumber:"",policeRecordUrl:""}};'
compose exec -T api bun -e "$setup_input"'import {env} from "./src/shared/env.ts"; const r=await fetch("http://127.0.0.1:3000/api/admin/setup/initial",{method:"POST",headers:{"Content-Type":"application/json","X-Setup-Token":env.setupToken},body:JSON.stringify(input)}); if(!r.ok)throw new Error("Token-protected setup failed: "+r.status);'
request "$url/api/admin/setup/status" | grep -q '"requiresSetup":false'
count="$(compose exec -T postgres psql -U leiblog_test -d leiblog_test_production -Atc "SELECT count(*) FROM users WHERE role='admin'")"
[[ "$count" == 1 ]]
compose exec -T api bun -e "$setup_input"'import {env} from "./src/shared/env.ts"; const r=await fetch("http://127.0.0.1:3000/api/admin/setup/initial",{method:"POST",headers:{"Content-Type":"application/json","X-Setup-Token":env.setupToken},body:JSON.stringify(input)}); if(r.status!==409)process.exit(1);'
compose exec -T postgres psql -v ON_ERROR_STOP=1 -U leiblog_test -d leiblog_test_production -c "DELETE FROM users WHERE username='testadmin'" >/dev/null
compose exec -T api bun -e "$setup_input"'import {completeInitialSetup} from "./src/admin/setup/service.ts"; import {closeSql} from "./src/shared/db/postgres.ts"; const results=await Promise.all([completeInitialSetup(input),completeInitialSetup(input)]); if(results.filter(r=>r.ok).length!==1)throw new Error("Concurrent setup failed"); await closeSql();'
count="$(compose exec -T postgres psql -U leiblog_test -d leiblog_test_production -Atc "SELECT count(*) FROM users WHERE role='admin'")"
[[ "$count" == 1 ]]
compose exec -T api bun -e 'import {env} from "./src/shared/env.ts"; if(env.publicSiteUrl!=="https://blog.example.test" || process.getuid()!==1000)process.exit(1);'
compose exec -T api bun -e 'const p=JSON.parse(await Bun.file("/app/package.json").text()); if(typeof p.scripts?.start!=="string")process.exit(1);'
asset="$(printf '%s' "$admin" | sed -n 's/.*src="\(\/assets\/[^"]*\.js\)".*/\1/p' | head -1)"
[[ -n "$asset" ]]
request --head "$url$asset" | grep -qi 'immutable'
docker run --rm --network "${project}_edge" \
  --env "LEIBLOG_BASE_DIR=$temporary" --env "LEIBLOG_PROJECT_NAME=$project" \
  -v /var/run/docker.sock:/var/run/docker.sock -v "$temporary:$temporary" -v "$root:/repo:ro" \
  docker:cli sh -c 'apk add --no-cache bash curl tar openssl coreutils >/dev/null && bash /repo/deploy/test-operations.sh'
printf '%s\n' 'Production image, HTTPS, separate SPA routes, CSP, private services, non-root API and startup regression checks passed.'
