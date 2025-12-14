#!/usr/bin/env bash
set -euo pipefail

git diff --cached --check

if [[ ! -f package.json ]]; then
  exit 0
fi

if command -v npm >/dev/null 2>&1; then
  npm pkg fix || true
fi

lint_staged="$(node -e 'const fs=require("fs"); const pkg=JSON.parse(fs.readFileSync("package.json","utf8")); const deps={...(pkg.dependencies||{}),...(pkg.devDependencies||{})}; const enabled=("lint-staged" in deps) || (pkg["lint-staged"]!=null); process.stdout.write(enabled?"true":"false");' 2>/dev/null || echo false)"

if [[ "$lint_staged" == "true" ]]; then
  if [[ -x ./node_modules/.bin/lint-staged ]]; then
    ./node_modules/.bin/lint-staged
  elif command -v pnpm >/dev/null 2>&1; then
    pnpm exec lint-staged
  elif command -v npm >/dev/null 2>&1; then
    npm exec -- lint-staged
  else
    npx -y lint-staged
  fi
else
  prettier_cmd=()
  if [[ -x ./node_modules/.bin/prettier ]]; then
    prettier_cmd=(./node_modules/.bin/prettier)
  elif command -v pnpm >/dev/null 2>&1; then
    prettier_cmd=(pnpm exec prettier)
  elif command -v npm >/dev/null 2>&1; then
    prettier_cmd=(npm exec -- prettier)
  else
    prettier_cmd=(npx -y prettier)
  fi

  if IFS= read -r -d '' _ < <(git diff --cached --name-only --diff-filter=ACMR -z); then
    git diff --cached --name-only --diff-filter=ACMR -z \
      | xargs -0 -I{} sh -c 'test -L "$1" || printf "%s\0" "$1"' _ {} \
      | xargs -0 -- "${prettier_cmd[@]}" --write --ignore-unknown --log-level warn --

    git update-index --again
  fi
fi

run_script() {
  local script_name="$1"
  if node -e 'const fs=require("fs"); const pkg=JSON.parse(fs.readFileSync("package.json","utf8")); const scripts=pkg.scripts||{}; process.exit(scripts[process.argv[1]]?0:1);' "$script_name"; then
    if command -v pnpm >/dev/null 2>&1; then
      pnpm -s run "$script_name"
    elif command -v npm >/dev/null 2>&1; then
      npm run --silent "$script_name"
    else
      echo "No package manager available to run script: $script_name" >&2
      exit 1
    fi
  fi
}

run_script "knip"
run_script "typecheck"
run_script "lint"
run_script "fta:check"
run_script "test"

changed_ts="$(git diff --cached --name-only --diff-filter=ACMR | grep -E '^src/.*\\.ts$' | head -n 1 || true)"
if [[ -n "$changed_ts" ]]; then
  run_script "build:check"
fi

if command -v yamllint >/dev/null 2>&1; then
  run_script "lint:yaml"
fi

if command -v ansible-lint >/dev/null 2>&1; then
  run_script "lint:ansible"
fi
