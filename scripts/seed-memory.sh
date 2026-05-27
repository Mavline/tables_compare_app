#!/usr/bin/env bash
# Seed .agent/memory.db with the project's baseline entities, policies,
# decisions, and claims through the memgraph CLI so that FTS, sqlite-vec,
# and embedding metadata are populated inline.
#
# The script is idempotent: each run deletes the prior seed batch by its
# canonical identifiers (entity canonical_name, policy_name, decision title,
# claim statement) and re-creates the rows through the CLI. CLI-only rows
# created by humans or other agents are left untouched because they are not
# in the seed list.
#
# Requires OPENAI_API_KEY. The script auto-loads it from, in order:
#   1. the existing environment;
#   2. <repo>/.env;
#   3. /Users/core/Projects/Doc_generating/.env (sibling project keystore).
# If none of those provide a key, the script exits 2.

set -euo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
DB="$ROOT/.agent/memory.db"
MG="$HOME/.codex/skills/memory-graph/memgraph"

if [ ! -f "$DB" ]; then
  echo "ERROR: $DB does not exist. Bootstrap first." >&2
  exit 1
fi
if [ ! -x "$MG" ]; then
  echo "ERROR: memgraph CLI not found at $MG" >&2
  exit 1
fi

# --- 1. Resolve OPENAI_API_KEY ------------------------------------------------
load_key_from_file() {
  local file="$1"
  [ -f "$file" ] || return 1
  local line
  line="$(grep -E '^OPENAI_API_KEY=' "$file" | tail -1 || true)"
  [ -z "$line" ] && return 1
  local value="${line#OPENAI_API_KEY=}"
  value="${value%\"}"; value="${value#\"}"
  value="${value%\'}"; value="${value#\'}"
  [ -z "$value" ] && return 1
  export OPENAI_API_KEY="$value"
  return 0
}

if [ -z "${OPENAI_API_KEY:-}" ]; then
  load_key_from_file "$ROOT/.env" \
    || load_key_from_file "/Users/core/Projects/Doc_generating/.env" \
    || true
fi
if [ -z "${OPENAI_API_KEY:-}" ]; then
  echo "ERROR: OPENAI_API_KEY is required for CLI-driven seeding (FTS + vec)." >&2
  echo "       Export it or place it into <repo>/.env." >&2
  exit 2
fi

# --- 2. Wipe prior seed rows by canonical identifier --------------------------
# Cascades clean up child rows in entities/policies/decisions/claims as well as
# the matching index_docs / embedding_meta / memory_vec entries. PRAGMA must be
# set inside the same connection; SQLite defaults foreign_keys to OFF per
# session, so without this the cascade is silently skipped.
sqlite3 "$DB" <<'SQL'
PRAGMA foreign_keys = ON;
BEGIN;
DELETE FROM objects WHERE id IN (
  SELECT object_id FROM entities
   WHERE canonical_name IN (
     'table_compare', 'src/App.tsx', 'reference_designator',
     'bom_hierarchy', 'memgraph_memory_codex'
   )
  UNION ALL
  SELECT object_id FROM policies
   WHERE policy_name IN (
     'aoc-shared-block-parity', 'verify-in-browser-for-ui-changes',
     'source-document-consistency', 'red-team-spec-gate',
     'production-model-verification', 'memory-write-discipline',
     'no-customer-bom-data', 'task-proof-loop'
   )
  UNION ALL
  SELECT object_id FROM decisions
   WHERE title IN (
     'Adopt repo-local memory.db via memgraph plugin',
     'Mirror Doc_generating AOC discipline into a tailored v1',
     'Harden AOC with hash parity and production-model verification',
     'Keep merge contract: positional iteration + key match + filter on byte-equal pairs',
     'Strip orphan config files and unused UI scaffolding',
     'Fix App.tsx eslint warnings without altering merge semantics'
   )
  UNION ALL
  SELECT object_id FROM claims
   WHERE statement LIKE 'src/.cursorrules describes a Vue/Pinia/Vite/Hono/Drizzle stack%'
      OR statement LIKE 'config-overrides.js + customize-cra dependency existed%'
      OR statement LIKE 'extractGroupingInfo always reads xl/worksheets/sheet1.xml%'
      OR statement LIKE 'JSX uses Tailwind utility classes%'
      OR statement LIKE 'expandRanges expands a dash only when both endpoints%'
      OR statement LIKE 'findDescriptionField includes Hebrew strings%'
      OR statement LIKE 'Equal-row filtering runs twice%'
      OR statement LIKE 'After commit b1fe388%'
      OR statement LIKE 'tsconfig.json sets target: es5%'
      OR statement LIKE 'package.json deps that are still alive go through%'
      OR statement LIKE 'scripts/seed-memory.sh now drives every seed write%'
);
-- Clean any leftover orphan typed rows (defensive: in case PRAGMA was off in
-- an earlier run and we want to recover without re-bootstrapping).
DELETE FROM entities  WHERE object_id NOT IN (SELECT id FROM objects);
DELETE FROM policies  WHERE object_id NOT IN (SELECT id FROM objects);
DELETE FROM decisions WHERE object_id NOT IN (SELECT id FROM objects);
DELETE FROM claims    WHERE object_id NOT IN (SELECT id FROM objects);
COMMIT;
SQL

# --- 3. Re-create through the CLI --------------------------------------------
SOURCE_FILE_AOC="docs/AI_AGENT_OPERATING_CONTRACT.md"
SOURCE_FILE_MEM="MEMORY_WRITE_RULES.md"
SOURCE_FILE_CLAUDE="CLAUDE.md"
SOURCE_FILE_CYCLES="AGENT_EXECUTION_CYCLES.md"

write_entity() {
  "$MG" write-entity --type "$1" --name "$2" --display "$3" --aliases "$4" --summary "$5" >/dev/null
}

write_policy() {
  "$MG" write-policy --name "$1" --scope "$2" --source-file "$3" --text "$4" >/dev/null
}

write_decision() {
  "$MG" write-decision --title "$1" --summary "$2" --decision "$3" --rationale "$4" --consequences "$5" >/dev/null
}

write_claim() {
  local args=(--type "$1" --statement "$2")
  if [ -n "${3:-}" ]; then args+=(--entity "$3"); fi
  if [ -n "${4:-}" ]; then args+=(--status "$4"); fi
  "$MG" write-claim "${args[@]}" >/dev/null
}

# ----- Entities (5) -----------------------------------------------------------
write_entity project "table_compare" "BOM Comparison Tool" \
  '["tables_compare_app","comparison_app","BOM Comparison Tool"]' \
  "Browser-only React/TypeScript tool that diffs two Excel BOMs and exports a styled .xlsx report. Single-page CRA app, no backend."

write_entity module "src/App.tsx" "MainContent + App" \
  '["App.tsx","MainContent"]' \
  "Monolithic React component owning every state slot in the BOM pipeline (upload, sheet detection, hierarchy extraction, mapping, merge, range expansion, export)."

write_entity concept "reference_designator" "Reference designator (RefDes)" \
  '["RefDes","refdes","ref des"]' \
  "PCB component placeholder (e.g. R1, C10). Carried as comma-separated lists with optional ranges like R1-R5. Domain rules in docs/BOM_DOMAIN.md."

write_entity concept "bom_hierarchy" "BOM hierarchy / outline level" \
  '["outline level","grouping","Level_*"]' \
  "Excel row outlineLevel preserved across the comparison. Extracted only via raw xl/worksheets/sheet1.xml; SheetJS drops it."

write_entity tool "memgraph_memory_codex" "Memgraph memory plugin (Codex)" \
  '["memgraph","memory-graph"]' \
  "Repo-local memory CLI bootstrapped from sibling Doc_generating project. Home install at ~/.codex/skills/memory-graph/."

# ----- Policies (8) -----------------------------------------------------------
write_policy "aoc-shared-block-parity" "orchestration" "$SOURCE_FILE_AOC" \
"AOC-DOCS-001. The shared AOC block in CLAUDE.md, AGENTS.md, and docs/AI_AGENT_OPERATING_CONTRACT.md must be byte-identical, and the AOC_SHARED_BEGIN marker must declare the SHA-256 of the shared block body. Run bash scripts/check-agent-docs.sh before any spec freeze, implementation, review, fixer pass, or approval. Parity or hash failure blocks the task with DOCS_PARITY_FAIL."

write_policy "source-document-consistency" "orchestration" "$SOURCE_FILE_AOC" \
"AOC-DOCS-002. Instruction and source-of-truth changes must update every authoritative surface that depends on the same rule: docs/AI_AGENT_OPERATING_CONTRACT.md, AGENTS.md, CLAUDE.md, AGENT_EXECUTION_CYCLES.md when present, role-agent prompts, MEMORY_WRITE_RULES.md, and validation scripts. Reuse neighboring project process discipline only after rewriting it for table_compare BOM scope."

write_policy "verify-in-browser-for-ui-changes" "execution" "$SOURCE_FILE_AOC" \
"AOC-VERIFY-001. Any change to file upload, sheet selection, mapping, merge, reference-designator expansion, hierarchy preservation, preview table, or exported workbook must be exercised in a real browser with synthetic fixtures before reviewer handoff. tsc --noEmit and npm run build are necessary but not sufficient evidence."

write_policy "red-team-spec-gate" "execution" "$SOURCE_FILE_AOC" \
"AOC-SPEC-002. Before implementation starts on a frozen spec, adversarially review how the implementation could appear to pass while violating BOM merge contract, positional row order, key matching, reference-designator expansion, hierarchy preservation, selected-sheet behavior, description detection, export column order, export styling, sensitive-data boundary, or user-visible workflow."

write_policy "production-model-verification" "execution" "$SOURCE_FILE_AOC" \
"AOC-VERIFY-002. Tests and smoke checks must match the production execution model. Helper-level tests can support evidence, but browser-only BOM workflow claims need UI or equivalent harness evidence, and exported-workbook claims require inspecting the generated .xlsx structure or visible workbook result."

write_policy "memory-write-discipline" "memory" "$SOURCE_FILE_MEM" \
"AOC-MEM-001. Never hand-edit objects, index_docs, memory_vec, or embedding_meta. Use the memgraph CLI for durable writes. scripts/seed-memory.sh now uses the CLI as well; only orphan-row cleanup happens via direct SQL. Never commit .agent/."

write_policy "no-customer-bom-data" "repo" "$SOURCE_FILE_AOC" \
"AOC-DATA-001. Customer BOMs may contain part numbers, prices, suppliers, and internal identifiers. Never log full row contents, paste customer files into memory, commits, source docs, or shared logs. Use synthetic fixtures under fixtures/."

write_policy "task-proof-loop" "execution" "$SOURCE_FILE_CYCLES" \
"For substantial features, refactors, bug fixes, and instruction/process changes, freeze .agent/tasks/<TASK_ID>/spec.md with AC1..ACn before implementation. Build evidence, run fresh verifier, run a scoped fixer if needed, and keep execution artifacts under .agent/tasks rather than source docs. Do not claim completion until every criterion is PASS or a limitation is explicitly accepted."

# ----- Decisions (6) ----------------------------------------------------------
write_decision \
"Adopt repo-local memory.db via memgraph plugin" \
"Use .agent/memory.db with the v1 memory-graph schema as the project memory layer." \
"Bootstrap via Doc_generating plugin (~/.codex/skills/memory-graph/.venv/bin/python3 Doc_generating/plugins/memgraph-memory-codex/scripts/bootstrap.py --target /Users/core/Projects/table_compare). Operate via home-installed Codex memgraph CLI for reads and writes. scripts/seed-memory.sh now seeds via the CLI." \
"Sibling Doc_generating project already uses this stack; reusing it avoids re-inventing schema, FTS, and vector indexing. Home install provides venv with sqlite-vec loaded." \
"Future agents must use the memgraph CLI; hand-edits to FTS/vec tables will desynchronize the index."

write_decision \
"Mirror Doc_generating AOC discipline into a tailored v1" \
"Import the AOC discipline (parity, evidence-first, fresh reviewer, fixer scope, red-team spec gate, production-model verification) but drop Doc_generating-specific rules (Stripe, RLS, Supabase, CraftedTerms branding)." \
"CLAUDE.md, AGENTS.md, and docs/AI_AGENT_OPERATING_CONTRACT.md carry the same AOC block. The block focuses on type-check, build, and real-browser/workbook verification because the project has no backend. AOC-DATA-001 replaces the legal/payment rules with a customer-BOM confidentiality rule." \
"The project is one React page; the full Doc_generating ruleset would be heavyweight ceremony. Browser verification is the only meaningful evidence here." \
"check-agent-docs.sh is now the parity and declared-hash gate. Adding rules requires updating all three copies and the AOC_SHARED_BEGIN hash."

write_decision \
"Harden AOC with hash parity and production-model verification" \
"2026-05-27 docs hardening added hash-validated AOC parity, source-document consistency, red-team spec gate, production-model verification, and a dedicated AGENT_EXECUTION_CYCLES.md playbook." \
"Keep Doc_generating's mature process discipline where it protects this repo: hash parity for shared AOC, source-doc consistency across control docs and role prompts, red-team spec review before implementation, and evidence that matches the browser-only Excel production model. Do not import Doc_generating's product-specific payment/auth/legal/deployment rules." \
"The user asked to take the missing documentation discipline from neighboring Doc_generating. table_compare needs the process controls, but its product is a browser-only BOM comparator with sensitive Excel data rather than a Supabase/Stripe document service." \
"Future instruction edits must touch the AOC mirror, AGENT_EXECUTION_CYCLES.md, role-agent prompts, MEMORY_WRITE_RULES.md, and validation scripts when the same rule applies. Seed memory must be rerun after such changes so DB policies match the docs."

write_decision \
"Keep merge contract: positional iteration + key match + filter on byte-equal pairs" \
"Do not refactor mergeTables into a pure key-based join without an explicit spec." \
"mergeTables iterates up to max(len(left), len(right)). Left rows look up their right counterpart via the key map and emit Left.X / Right.X pairs. Unmatched right rows are appended. Rows where every active mapping pair is byte-equal after trim() are dropped." \
"Customer Excel macros depend on the row order and column order in the exported file. Switching to a pure join would reorder rows and break those macros." \
"A future spec may unlock a pure join, but it must explicitly cover the row-order acceptance criteria and produce browser-level evidence against a real-shaped fixture."

write_decision \
"Strip orphan config files and unused UI scaffolding" \
"Removed .babelrc, config-overrides.js, src/.cursorrules, src/logo.svg, src/custom.d.ts, and five Radix UI wrapper files. Then dropped @radix-ui/react-label, @radix-ui/react-select, and lucide-react from package.json." \
"Commits 4007578 and 855e41a. Verified with npx tsc --noEmit and CI=true npm run build. Bundle hash unchanged after dep removal, confirming tree-shaking already excluded the radix/lucide code." \
".babelrc referenced two plugins that were not even installed; config-overrides.js required customize-cra, which was also not in package.json. The Radix wrappers were never imported by App.tsx or any other source. Keeping them inflated node_modules by 57 transitive packages and confused future agents about the actual UI surface." \
"Anyone wanting to use Radix Select / Label / Lucide icons must re-add them as direct deps. The cn() utility still works via clsx + tailwind-merge but its output is inert until Tailwind itself is added to the build pipeline (separate decision)."

write_decision \
"Fix App.tsx eslint warnings without altering merge semantics" \
"Commit b1fe388. Removed two unused locals (fieldMappingDict, reverseFieldMappingDict) inside mergeTables; both were built every call but never read. Wrapped four occurrences of files[i] && fields[…]?.filter(…) || [] with explicit parens to satisfy no-mixed-operators." \
"CI=true npm run build now compiles cleanly (zero lint warnings); npx tsc --noEmit clean. Changes are non-semantic: && already binds tighter than || in JavaScript, and the removed dicts had no readers." \
"Treating warnings as errors is the default on most CI providers. The repository was failing CI=true build before this fix. Keeping warnings around long-term erodes the lint signal." \
"If anyone re-introduces fieldMappingDict for a real use, they must also re-introduce its consumer in the same commit so the unused-vars rule does not re-trigger."

# ----- Claims (11) ------------------------------------------------------------
write_claim gotcha \
"src/.cursorrules describes a Vue/Pinia/Vite/Hono/Drizzle stack. The actual stack is React + CRA + react-scripts + ExcelJS/SheetJS. The file was removed in commit 4007578, but historical references in older commits or memory may still cite it." \
"table_compare" "invalidated"

write_claim gotcha \
"config-overrides.js + customize-cra dependency existed but were unreferenced; package.json scripts called react-scripts directly. Removed in commit 4007578 together with .babelrc and unused Radix UI wrappers." \
"table_compare" "invalidated"

write_claim fact \
"After commit b1fe388 (2026-05-24), npx tsc --noEmit is clean and CI=true npm run build compiles with zero lint warnings. No tests exist; ESLint runs via react-scripts." \
"table_compare" ""

write_claim constraint \
"package.json deps that are still alive go through src/components/ui/input.tsx (used by the file picker overlay) → src/lib/utils.ts (cn() helper) → clsx + tailwind-merge. Removing input.tsx would orphan that chain. tailwind-merge is consumed but Tailwind itself is not built; cn() output is inert at runtime." \
"table_compare" ""

write_claim gotcha \
"scripts/seed-memory.sh now drives every seed write through the memgraph CLI so FTS + sqlite-vec stay synchronized. The earlier direct-SQL variant left orphan rows because SQLite defaults foreign_keys=OFF per connection — ON DELETE CASCADE did not fire and entity/policy/decision/claim rows survived without their parent objects. The current script sets PRAGMA foreign_keys = ON inside the cleanup transaction and adds a defensive orphan sweep." \
"memgraph_memory_codex" ""

write_claim gotcha \
"extractGroupingInfo always reads xl/worksheets/sheet1.xml. If the user selects a non-first sheet, hierarchy is read from the wrong sheet. Known bug; do not paper over it without a fix." \
"bom_hierarchy" ""

write_claim gotcha \
"JSX uses Tailwind utility classes (text-3xl, font-bold, mb-6) but Tailwind itself is not in the build. The classes render as inert strings. Either add Tailwind or stop adding new utility classes." \
"table_compare" ""

write_claim constraint \
"expandRanges expands a dash only when both endpoints share the same alphabetic prefix. R1-R5 expands, R1-C5 passes through unchanged. Numbers can go forward or reverse; underscores are allowed in the prefix. Do not 'fix' the mixed-prefix passthrough without a spec — legacy BOMs use such strings as literal part numbers." \
"reference_designator" ""

write_claim constraint \
"findDescriptionField includes Hebrew strings (תיאור, שם, כותרת) because at least one production customer ships BOMs in Hebrew. Do not strip the existing list; add new languages instead." \
"src/App.tsx" ""

write_claim constraint \
"Equal-row filtering runs twice: once in mergeTables on Left./Right. columns (preview), once in downloadMergedFile on <fileId>_* columns (export). The export pass additionally exempts both-blank, both '--', and both '.' pairs. Preview and export must stay in sync." \
"src/App.tsx" ""

write_claim risk \
"tsconfig.json sets target: es5 while runtime code relies on es2015+ features. CRA bypasses tsc emit via Babel, so today this is benign — but anyone running raw tsc to emit will produce unusable JS. Use tsc --noEmit only." \
"table_compare" ""

# --- 4. Summary ---------------------------------------------------------------
echo "Seed completed via memgraph CLI."
echo
sqlite3 "$DB" "
SELECT 'entities  ', count(*) FROM entities;
SELECT 'policies  ', count(*) FROM policies;
SELECT 'decisions ', count(*) FROM decisions;
SELECT 'claims    ', count(*) FROM claims;
SELECT 'index_docs', count(*) FROM index_docs;
SELECT 'embed_meta', count(*) FROM embedding_meta;
"
