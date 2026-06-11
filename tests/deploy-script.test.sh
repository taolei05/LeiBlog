#!/usr/bin/env bash

set -Eeuo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
script_path="${repo_root}/deploy/leiblog.sh"
tmp_dir="$(mktemp -d)"
installed_command="${tmp_dir}/bin/leiblog"

trap 'rm -rf "${tmp_dir}"' EXIT

output="$(
  LEIBLOG_COMMAND_PATH="${installed_command}" \
    LEIBLOG_SCRIPT_URL="file://${script_path}" \
    bash "${script_path}" install-cli
)"

[[ -x "${installed_command}" ]]
cmp -s "${script_path}" "${installed_command}"
grep -Fq "${installed_command}" <<<"${output}"

usage="$(bash "${installed_command}" --help)"
grep -Fq "leiblog install-cli" <<<"${usage}"
grep -Fq "leiblog update" <<<"${usage}"

[[ "$(grep -c '^  refresh_cli_from_source$' "${script_path}")" -eq 2 ]]

echo "deploy script tests passed"
