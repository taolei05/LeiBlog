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
printf 'LEIBLOG_DEPLOYMENT_FORMAT=2\nADMIN_BOOTSTRAP_PASSWORD=\nSITE_HOST=blog.example.com\n' > "$fixture_dir/safe.env"
load_env_file "$fixture_dir/safe.env"
[[ "$SITE_HOST" == blog.example.com && -z "$ADMIN_BOOTSTRAP_PASSWORD" ]]
LEIBLOG_FORCE=1 confirm_dangerous_action 'fixture confirmation'
ENV_FILE="$fixture_dir/safe.env" write_env_if_missing
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
bash "$root/deploy/test-build-and-retry.sh"
printf '%s\n' 'Deployment script regression checks passed.'
