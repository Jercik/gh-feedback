#!/usr/bin/env bash
set -euo pipefail

if (( $# == 0 )); then
  echo "Usage:" >&2
  echo "  commitlint.sh <commit-msg-file> [commitlint args...]" >&2
  echo "  commitlint.sh --last|--from <sha> --to <sha> [commitlint args...]" >&2
  exit 2
fi

# Build commitlint arguments
commitlint_args=()

if [[ "${1:-}" == --* ]]; then
  commitlint_args=("$@")
else
  commit_msg_path="$1"
  shift
  if [[ ! -f "$commit_msg_path" ]]; then
    echo "Commit message file not found: $commit_msg_path" >&2
    exit 2
  fi
  commitlint_args=(--edit "$commit_msg_path" "$@")
fi

# Add --verbose if not already present
has_verbose="false"
for arg in "${commitlint_args[@]}"; do
  if [[ "$arg" == "--verbose" ]]; then
    has_verbose="true"
    break
  fi
done
if [[ "$has_verbose" != "true" ]]; then
  commitlint_args+=(--verbose)
fi

# Run commitlint via npx with @commitlint/config-conventional.
# Extract the npx cache node_modules path from PATH and create a temp config
# with an absolute path to the config-conventional module.
npx -y -p @commitlint/cli -p @commitlint/config-conventional sh -c '
  set -e
  # Extract npx node_modules from PATH (first entry ending in .bin)
  npx_bin=$(echo "$PATH" | tr ":" "\n" | grep "/_npx/.*/.bin$" | head -1)
  npx_modules="${npx_bin%/.bin}"
  config_path="$npx_modules/@commitlint/config-conventional/lib/index.js"

  tmp_dir=$(mktemp -d)
  tmp_config="$tmp_dir/commitlint.config.cjs"
  trap "rm -rf \"$tmp_dir\"" EXIT

  echo "module.exports = { extends: [\"$config_path\"] };" > "$tmp_config"
  commitlint --config "$tmp_config" "$@"
' _ "${commitlint_args[@]}"
