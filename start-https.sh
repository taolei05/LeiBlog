#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

for command in bun mkcert; do
  if ! command -v "$command" >/dev/null 2>&1; then
    printf '%s\n' "$command is required. On macOS, install mkcert with: brew install mkcert" >&2
    exit 1
  fi
done

if (($# > 1)); then
  printf '%s\n' 'Usage: bash start-https.sh [LAN_IP]' >&2
  exit 1
fi

host="${1:-$(bun -e '
  import {networkInterfaces} from "node:os";
  for(const entries of Object.values(networkInterfaces())){
    for(const entry of entries??[]){
      if(!entry.internal&&entry.family==="IPv4"&&/^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(entry.address)){
        console.log(entry.address);process.exit(0);
      }
    }
  }
  process.exit(1);
')}"
bun -e 'import {isIP} from "node:net";const ip=process.argv[1];if(isIP(ip)!==4||!/^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip))throw new Error("Use a private LAN IPv4 address, for example 192.168.3.125.");' "$host"

umask 077
tls_dir="$HOME/.local/share/leiblog/dev-https"
export CAROOT="$tls_dir/ca"
mkdir -p "$CAROOT"
mkcert -cert-file "$tls_dir/server.pem" -key-file "$tls_dir/server-key.pem" "$host" localhost 127.0.0.1 ::1
chmod 600 "$tls_dir/server-key.pem"

export LEIBLOG_DEV_HTTPS_CERT="$tls_dir/server.pem"
export LEIBLOG_DEV_HTTPS_KEY="$tls_dir/server-key.pem"
export LEIBLOG_DEV_HOST="$host"
export LEIBLOG_REUSE_BACKEND=1
export VITE_API_BASE_URL=""

printf '\n%s\n' \
  "HTTPS: https://$host:5175/" \
  "Admin: https://$host:5175/admin/" \
  'Install only the public local CA certificate on each accessing device.' \
  'The CA private key must never leave this computer. No system trust store is changed by this script.'
if curl --fail --silent --max-time 2 "http://127.0.0.1:5174/__dev/leiblog-local-ca.crt" >/dev/null 2>&1; then
  printf '%s\n' "Public CA download: http://$host:5174/__dev/leiblog-local-ca.crt"
fi
bun -e 'import {X509Certificate} from "node:crypto";console.log("CA SHA-256: "+new X509Certificate(await Bun.file(process.argv[1]).arrayBuffer()).fingerprint256);' "$CAROOT/rootCA.pem"
exec bash "$ROOT_DIR/start.sh"
