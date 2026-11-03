#!/usr/bin/env bash
set -euo pipefail

pnpm run typecheck
pnpm --filter @workspace/surrur-e-mann run test
pnpm run build
git diff --check

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Verification completed, but the working tree is modified." >&2
  git status --short
  exit 1
fi

echo "Typecheck, frontend tests, build, diff check, and clean-tree check passed."