#!/usr/bin/env bash
# AOC-DOCS-001: verify CLAUDE.md, AGENTS.md, and docs/AI_AGENT_OPERATING_CONTRACT.md
# carry an identical shared AOC block, byte for byte.
set -euo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

BEGIN='<!-- AOC_SHARED_BEGIN v1 -->'
END='<!-- AOC_SHARED_END v1 -->'

extract() {
  local file="$1"
  awk -v b="$BEGIN" -v e="$END" '
    $0 == b { inside=1; print; next }
    $0 == e { if (inside) { print; inside=0 }; next }
    inside { print }
  ' "$file"
}

CLAUDE_BLOCK=$(extract CLAUDE.md)
AGENTS_BLOCK=$(extract AGENTS.md)
CANON_BLOCK=$(extract docs/AI_AGENT_OPERATING_CONTRACT.md)

if [ -z "$CLAUDE_BLOCK" ] || [ -z "$AGENTS_BLOCK" ] || [ -z "$CANON_BLOCK" ]; then
  echo "DOCS_PARITY_FAIL: shared AOC block missing in one of the three files" >&2
  echo "  CLAUDE.md block length: ${#CLAUDE_BLOCK}" >&2
  echo "  AGENTS.md block length: ${#AGENTS_BLOCK}" >&2
  echo "  docs/AI_AGENT_OPERATING_CONTRACT.md block length: ${#CANON_BLOCK}" >&2
  exit 1
fi

CLAUDE_SHA=$(printf '%s' "$CLAUDE_BLOCK" | shasum -a 256 | awk '{print $1}')
AGENTS_SHA=$(printf '%s' "$AGENTS_BLOCK" | shasum -a 256 | awk '{print $1}')
CANON_SHA=$(printf '%s'  "$CANON_BLOCK"  | shasum -a 256 | awk '{print $1}')

if [ "$CLAUDE_SHA" = "$AGENTS_SHA" ] && [ "$CLAUDE_SHA" = "$CANON_SHA" ]; then
  echo "AOC parity OK ($CLAUDE_SHA)"
  exit 0
fi

echo "DOCS_PARITY_FAIL:" >&2
echo "  CLAUDE.md  $CLAUDE_SHA" >&2
echo "  AGENTS.md  $AGENTS_SHA" >&2
echo "  canon      $CANON_SHA" >&2
echo "" >&2
echo "diff CLAUDE.md vs canon:" >&2
diff <(printf '%s' "$CLAUDE_BLOCK") <(printf '%s' "$CANON_BLOCK") >&2 || true
echo "" >&2
echo "diff AGENTS.md vs canon:" >&2
diff <(printf '%s' "$AGENTS_BLOCK") <(printf '%s' "$CANON_BLOCK") >&2 || true
exit 1
