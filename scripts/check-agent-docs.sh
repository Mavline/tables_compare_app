#!/usr/bin/env bash
# AOC-DOCS-001: verify CLAUDE.md, AGENTS.md, and docs/AI_AGENT_OPERATING_CONTRACT.md
# carry an identical shared AOC block and that each marker declares the block hash.
set -euo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

END='<!-- AOC_SHARED_END -->'
FILES=(CLAUDE.md AGENTS.md docs/AI_AGENT_OPERATING_CONTRACT.md)

fail() {
  echo "DOCS_PARITY_FAIL: $*" >&2
  exit 1
}

declared_hash() {
  local file="$1"
  sed -nE 's/^<!-- AOC_SHARED_BEGIN sha256:([0-9a-f]{64}) -->$/\1/p' "$file" | head -n 1
}

extract_body() {
  local file="$1"
  awk '
    /^<!-- AOC_SHARED_BEGIN sha256:[0-9a-f]{64} -->$/ { inside=1; next }
    $0 == "<!-- AOC_SHARED_END -->" { if (inside) { inside=0 }; next }
    inside { print }
  ' "$file"
}

REFERENCE_FILE="${FILES[0]}"
REFERENCE_BODY="$(extract_body "$REFERENCE_FILE")"
REFERENCE_DECLARED="$(declared_hash "$REFERENCE_FILE")"

[ -n "$REFERENCE_BODY" ] || fail "shared AOC block missing in $REFERENCE_FILE"
[ -n "$REFERENCE_DECLARED" ] || fail "AOC_SHARED_BEGIN hash missing or malformed in $REFERENCE_FILE"

REFERENCE_COMPUTED="$(printf '%s' "$REFERENCE_BODY" | shasum -a 256 | awk '{print $1}')"

for file in "${FILES[@]}"; do
  body="$(extract_body "$file")"
  declared="$(declared_hash "$file")"
  [ -n "$body" ] || fail "shared AOC block missing in $file"
  [ -n "$declared" ] || fail "AOC_SHARED_BEGIN hash missing or malformed in $file"

  computed="$(printf '%s' "$body" | shasum -a 256 | awk '{print $1}')"
  if [ "$declared" != "$computed" ]; then
    fail "$file declares sha256:$declared, expected sha256:$computed"
  fi

  if [ "$body" != "$REFERENCE_BODY" ]; then
    echo "DOCS_PARITY_FAIL: AOC block differs between $REFERENCE_FILE and $file" >&2
    echo "" >&2
    diff <(printf '%s' "$REFERENCE_BODY") <(printf '%s' "$body") >&2 || true
    exit 1
  fi
done

echo "AOC parity OK ($REFERENCE_COMPUTED)"
