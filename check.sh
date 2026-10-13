#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

bash "$project_dir/deploy/test-script.sh"

(
  cd "$project_dir/blog-server"
  bun run typecheck
  bun test src
  bun audit
)

(
  cd "$project_dir/blog-client"
  bun run check
  bun run test --run
  bun run build
  bun run test:production
  bun audit
)
