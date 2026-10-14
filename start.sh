#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PIDS=()
DOCKER_START_TIMEOUT_SECONDS=120

cleanup() {
  local exit_code=$?

  if ((${#PIDS[@]} > 0)); then
    echo
    echo "Stopping LeiBlog development servers..."
    kill "${PIDS[@]}" 2>/dev/null || true
    wait "${PIDS[@]}" 2>/dev/null || true
  fi

  exit "$exit_code"
}

trap cleanup EXIT INT TERM

if ! command -v bun >/dev/null 2>&1; then
  echo "bun is required but was not found in PATH."
  exit 1
fi

ensure_docker_running() {
  if ! command -v docker >/dev/null 2>&1; then
    echo "Docker CLI is required but was not found in PATH."
    exit 1
  fi

  if docker info >/dev/null 2>&1; then
    echo "Docker is already running."
    return
  fi

  echo "Docker is not running. Starting local Docker..."

  if [[ "$(uname -s)" == "Darwin" ]]; then
    open -a Docker
  else
    echo "Please start Docker locally, then run this script again."
    exit 1
  fi

  local elapsed_seconds=0
  while ((elapsed_seconds < DOCKER_START_TIMEOUT_SECONDS)); do
    if docker info >/dev/null 2>&1; then
      echo "Docker is running."
      return
    fi

    sleep 2
    elapsed_seconds=$((elapsed_seconds + 2))
  done

  echo "Docker did not become ready within ${DOCKER_START_TIMEOUT_SECONDS}s."
  exit 1
}

ensure_docker_running

if [[ "${LEIBLOG_REUSE_BACKEND:-0}" == 1 ]] && bun -e 'const r=await fetch("http://127.0.0.1:3000/api/health",{signal:AbortSignal.timeout(2000)});const b=await r.json();if(!r.ok||b.ok!==true||b.services?.postgres!=="ok"||b.services?.redis!=="ok")process.exit(1);' >/dev/null 2>&1; then
  echo "Reusing the healthy local LeiBlog backend on port 3000."
else
  echo "Starting LeiBlog backend..."
  (cd "$ROOT_DIR/blog-server" && bun run dev) &
  PIDS+=("$!")
fi

echo "Starting LeiBlog frontend..."
(cd "$ROOT_DIR/blog-client" && bun run dev) &
PIDS+=("$!")

echo
echo "LeiBlog development servers are starting."
echo "Backend:  http://localhost:3000/"
if [[ -n "${LEIBLOG_DEV_HTTPS_CERT:-}" ]]; then
  echo "Frontend: https://${LEIBLOG_DEV_HOST:-localhost}:5175/"
else
  echo "Frontend: http://localhost:5174/"
fi
echo "Press Ctrl+C to stop both."
echo

while true; do
  for pid in "${PIDS[@]}"; do
    if ! kill -0 "$pid" 2>/dev/null; then
      wait "$pid"
      exit $?
    fi
  done

  sleep 1
done
