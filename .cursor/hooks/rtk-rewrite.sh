#!/usr/bin/env bash
set -euo pipefail

payload="$(cat || true)"

# If Cursor sent nothing, do nothing.
if [ -z "${payload}" ]; then
  printf '{}\n'
  exit 0
fi

# Delegate rewrite logic to RTK itself.
# If RTK decides no rewrite is needed, it should pass through unchanged.
if command -v rtk >/dev/null 2>&1; then
  printf '%s' "$payload" | rtk rewrite
else
  printf '%s\n' "$payload"
fi