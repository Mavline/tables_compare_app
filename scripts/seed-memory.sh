#!/usr/bin/env bash
# Seed .agent/memory.db with initial policies, decisions, claims, and entities
# for the table_compare project. Writes only to the typed tables and re-renders
# the generated_views. Does NOT touch index_docs, memory_vec, or embedding_meta —
# those get filled by `memgraph rebuild-index` once OPENAI_API_KEY is available.
#
# This script is idempotent: it skips inserts whose canonical key already exists.

set -euo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
DB="$ROOT/.agent/memory.db"

if [ ! -f "$DB" ]; then
  echo "ERROR: $DB does not exist. Bootstrap first." >&2
  exit 1
fi

NOW="$(date +%s)"

sqlite3 "$DB" <<SQL
BEGIN;

-- ============================================================================
-- Entities
-- ============================================================================
INSERT OR IGNORE INTO objects(object_type, created_at, updated_at)
  VALUES ('entity', $NOW, $NOW);
INSERT OR IGNORE INTO entities(
  object_id, entity_type, canonical_name, display_name, aliases_json, summary,
  status, first_seen_at, last_seen_at, created_at, updated_at
) SELECT last_insert_rowid(),
  'project', 'table_compare', 'BOM Comparison Tool',
  '["tables_compare_app","comparison_app","BOM Comparison Tool"]',
  'Browser-only React/TypeScript tool that diffs two Excel BOMs and exports a styled .xlsx report. Single-page CRA app, no backend.',
  'active', $NOW, $NOW, $NOW, $NOW
WHERE NOT EXISTS (SELECT 1 FROM entities WHERE canonical_name='table_compare');

INSERT OR IGNORE INTO objects(object_type, created_at, updated_at)
  VALUES ('entity', $NOW, $NOW);
INSERT OR IGNORE INTO entities(
  object_id, entity_type, canonical_name, display_name, aliases_json, summary,
  status, first_seen_at, last_seen_at, created_at, updated_at
) SELECT last_insert_rowid(),
  'module', 'src/App.tsx', 'MainContent + App',
  '["App.tsx","MainContent"]',
  '1392-line React component owning every state slot in the BOM pipeline (upload, sheet detection, hierarchy extraction, mapping, merge, range expansion, export).',
  'active', $NOW, $NOW, $NOW, $NOW
WHERE NOT EXISTS (SELECT 1 FROM entities WHERE canonical_name='src/App.tsx');

INSERT OR IGNORE INTO objects(object_type, created_at, updated_at)
  VALUES ('entity', $NOW, $NOW);
INSERT OR IGNORE INTO entities(
  object_id, entity_type, canonical_name, display_name, aliases_json, summary,
  status, first_seen_at, last_seen_at, created_at, updated_at
) SELECT last_insert_rowid(),
  'concept', 'reference_designator', 'Reference designator (RefDes)',
  '["RefDes","refdes","ref des"]',
  'PCB component placeholder (e.g. R1, C10). Carried as comma-separated lists with optional ranges like R1-R5. Domain rules in docs/BOM_DOMAIN.md.',
  'active', $NOW, $NOW, $NOW, $NOW
WHERE NOT EXISTS (SELECT 1 FROM entities WHERE canonical_name='reference_designator');

INSERT OR IGNORE INTO objects(object_type, created_at, updated_at)
  VALUES ('entity', $NOW, $NOW);
INSERT OR IGNORE INTO entities(
  object_id, entity_type, canonical_name, display_name, aliases_json, summary,
  status, first_seen_at, last_seen_at, created_at, updated_at
) SELECT last_insert_rowid(),
  'concept', 'bom_hierarchy', 'BOM hierarchy / outline level',
  '["outline level","grouping","Level_*"]',
  'Excel row outlineLevel preserved across the comparison. Extracted only via raw xl/worksheets/sheet1.xml; SheetJS drops it.',
  'active', $NOW, $NOW, $NOW, $NOW
WHERE NOT EXISTS (SELECT 1 FROM entities WHERE canonical_name='bom_hierarchy');

INSERT OR IGNORE INTO objects(object_type, created_at, updated_at)
  VALUES ('entity', $NOW, $NOW);
INSERT OR IGNORE INTO entities(
  object_id, entity_type, canonical_name, display_name, aliases_json, summary,
  status, first_seen_at, last_seen_at, created_at, updated_at
) SELECT last_insert_rowid(),
  'tool', 'memgraph_memory_codex', 'Memgraph memory plugin (Codex)',
  '["memgraph","memory-graph"]',
  'Repo-local memory CLI bootstrapped from sibling Doc_generating project. Home install at ~/.codex/skills/memory-graph/.',
  'active', $NOW, $NOW, $NOW, $NOW
WHERE NOT EXISTS (SELECT 1 FROM entities WHERE canonical_name='memgraph_memory_codex');

-- ============================================================================
-- Policies
-- ============================================================================
INSERT OR IGNORE INTO objects(object_type, created_at, updated_at)
  VALUES ('policy', $NOW, $NOW);
INSERT OR IGNORE INTO policies(
  object_id, policy_name, effective_from, source_file, status, policy_text, scope, created_at, updated_at
) SELECT last_insert_rowid(),
  'aoc-shared-block-parity', $NOW, 'docs/AI_AGENT_OPERATING_CONTRACT.md', 'active',
  'AOC-DOCS-001. The shared AOC block in CLAUDE.md, AGENTS.md, and docs/AI_AGENT_OPERATING_CONTRACT.md must be byte-identical. Run bash scripts/check-agent-docs.sh before any spec freeze, implementation, review, fixer pass, or approval. Parity failure blocks the task with DOCS_PARITY_FAIL.',
  'orchestration', $NOW, $NOW
WHERE NOT EXISTS (SELECT 1 FROM policies WHERE policy_name='aoc-shared-block-parity');

INSERT OR IGNORE INTO objects(object_type, created_at, updated_at)
  VALUES ('policy', $NOW, $NOW);
INSERT OR IGNORE INTO policies(
  object_id, policy_name, effective_from, source_file, status, policy_text, scope, created_at, updated_at
) SELECT last_insert_rowid(),
  'verify-in-browser-for-ui-changes', $NOW, 'docs/AI_AGENT_OPERATING_CONTRACT.md', 'active',
  'AOC-VERIFY-001. Any change to file upload, sheet selection, mapping, merge, reference-designator expansion, hierarchy preservation, or exported workbook must be exercised in a real browser with synthetic fixtures before reviewer handoff. tsc --noEmit and npm run build are necessary but not sufficient evidence.',
  'execution', $NOW, $NOW
WHERE NOT EXISTS (SELECT 1 FROM policies WHERE policy_name='verify-in-browser-for-ui-changes');

INSERT OR IGNORE INTO objects(object_type, created_at, updated_at)
  VALUES ('policy', $NOW, $NOW);
INSERT OR IGNORE INTO policies(
  object_id, policy_name, effective_from, source_file, status, policy_text, scope, created_at, updated_at
) SELECT last_insert_rowid(),
  'memory-write-discipline', $NOW, 'MEMORY_WRITE_RULES.md', 'active',
  'AOC-MEM-001. Never hand-edit objects, index_docs, memory_vec, or embedding_meta. Use the memgraph CLI for durable writes. scripts/seed-memory.sh is the only authorized direct-SQL seeder and writes only to typed tables. Never commit .agent/.',
  'memory', $NOW, $NOW
WHERE NOT EXISTS (SELECT 1 FROM policies WHERE policy_name='memory-write-discipline');

INSERT OR IGNORE INTO objects(object_type, created_at, updated_at)
  VALUES ('policy', $NOW, $NOW);
INSERT OR IGNORE INTO policies(
  object_id, policy_name, effective_from, source_file, status, policy_text, scope, created_at, updated_at
) SELECT last_insert_rowid(),
  'no-customer-bom-data', $NOW, 'docs/AI_AGENT_OPERATING_CONTRACT.md', 'active',
  'AOC-DATA-001. Customer BOMs may contain part numbers, prices, suppliers, and internal identifiers. Never log full row contents, paste customer files into memory, or commit them. Use synthetic fixtures under fixtures/.',
  'repo', $NOW, $NOW
WHERE NOT EXISTS (SELECT 1 FROM policies WHERE policy_name='no-customer-bom-data');

INSERT OR IGNORE INTO objects(object_type, created_at, updated_at)
  VALUES ('policy', $NOW, $NOW);
INSERT OR IGNORE INTO policies(
  object_id, policy_name, effective_from, source_file, status, policy_text, scope, created_at, updated_at
) SELECT last_insert_rowid(),
  'task-proof-loop', $NOW, 'CLAUDE.md', 'active',
  'For non-trivial work, freeze .agent/tasks/<TASK_ID>/spec.md with AC1..ACn before implementation. Build → evidence → fresh verifier → fixer if needed. Do not claim completion until every criterion is PASS. Fixers make the smallest defensible diff.',
  'execution', $NOW, $NOW
WHERE NOT EXISTS (SELECT 1 FROM policies WHERE policy_name='task-proof-loop');

-- ============================================================================
-- Decisions
-- ============================================================================
INSERT OR IGNORE INTO objects(object_type, created_at, updated_at)
  VALUES ('decision', $NOW, $NOW);
INSERT OR IGNORE INTO decisions(
  object_id, title, summary, decision_text, rationale, consequences,
  status, decided_at, valid_from, created_at, updated_at
) SELECT last_insert_rowid(),
  'Adopt repo-local memory.db via memgraph plugin',
  'Use .agent/memory.db with the v1 memory-graph schema as the project memory layer.',
  'Bootstrap via Doc_generating plugin (~/.codex/skills/memory-graph/.venv/bin/python3 Doc_generating/plugins/memgraph-memory-codex/scripts/bootstrap.py --target /Users/core/Projects/table_compare). Operate via home-installed Codex memgraph CLI for reads. Use scripts/seed-memory.sh for initial seeding only.',
  'Sibling Doc_generating project already uses this stack; reusing it avoids re-inventing schema, FTS, and vector indexing. Home install provides venv with sqlite-vec loaded.',
  'Future agents must use the memgraph CLI or the seed script; hand-edits to FTS/vec tables will desynchronize the index.',
  'active', $NOW, $NOW, $NOW, $NOW
WHERE NOT EXISTS (SELECT 1 FROM decisions WHERE title='Adopt repo-local memory.db via memgraph plugin');

INSERT OR IGNORE INTO objects(object_type, created_at, updated_at)
  VALUES ('decision', $NOW, $NOW);
INSERT OR IGNORE INTO decisions(
  object_id, title, summary, decision_text, rationale, consequences,
  status, decided_at, valid_from, created_at, updated_at
) SELECT last_insert_rowid(),
  'Mirror Doc_generating AOC discipline into a tailored v1',
  'Import the AOC discipline (parity, evidence-first, fresh reviewer, fixer scope) but drop Doc_generating-specific rules (Stripe, RLS, Supabase, CraftedTerms branding).',
  'CLAUDE.md, AGENTS.md, and docs/AI_AGENT_OPERATING_CONTRACT.md carry the same v1 AOC block. The block focuses on type-check, build, and real-browser verification because the project has no backend. AOC-DATA-001 replaces the legal/payment rules with a customer-BOM confidentiality rule.',
  'The project is one React page; the full Doc_generating ruleset would be heavyweight ceremony. Browser verification is the only meaningful evidence here.',
  'check-agent-docs.sh is now the parity gate. Adding rules requires updating all three copies and bumping the version label in the BEGIN/END markers.',
  'active', $NOW, $NOW, $NOW, $NOW
WHERE NOT EXISTS (SELECT 1 FROM decisions WHERE title='Mirror Doc_generating AOC discipline into a tailored v1');

INSERT OR IGNORE INTO objects(object_type, created_at, updated_at)
  VALUES ('decision', $NOW, $NOW);
INSERT OR IGNORE INTO decisions(
  object_id, title, summary, decision_text, rationale, consequences,
  status, decided_at, valid_from, created_at, updated_at
) SELECT last_insert_rowid(),
  'Keep merge contract: positional iteration + key match + filter on byte-equal pairs',
  'Do not refactor mergeTables into a pure key-based join without an explicit spec.',
  'mergeTables iterates up to max(len(left), len(right)). Left rows look up their right counterpart via the key map and emit Left.X / Right.X pairs. Unmatched right rows are appended. Rows where every active mapping pair is byte-equal after trim() are dropped.',
  'Customer Excel macros depend on the row order and column order in the exported file. Switching to a pure join would reorder rows and break those macros.',
  'A future spec may unlock a pure join, but it must explicitly cover the row-order acceptance criteria and produce browser-level evidence against a real-shaped fixture.',
  'active', $NOW, $NOW, $NOW, $NOW
WHERE NOT EXISTS (SELECT 1 FROM decisions WHERE title='Keep merge contract: positional iteration + key match + filter on byte-equal pairs');

-- ============================================================================
-- Claims (facts, constraints, gotchas)
-- ============================================================================
-- Gotcha: stale .cursorrules
INSERT OR IGNORE INTO objects(object_type, created_at, updated_at)
  VALUES ('claim', $NOW, $NOW);
INSERT INTO claims(
  object_id, entity_object_id, claim_type, statement, normalized_statement,
  status, confidence, recorded_at, created_at, updated_at
) SELECT last_insert_rowid(),
  (SELECT object_id FROM entities WHERE canonical_name='table_compare'),
  'gotcha',
  'src/.cursorrules describes a Vue/Pinia/Vite/Hono/Drizzle stack. The actual stack is React + CRA + react-scripts + ExcelJS/SheetJS. The file is dead inheritance and must not steer suggestions.',
  'cursorrules wrong stack vue pinia vite hono drizzle react cra',
  'active', 0.99, $NOW, $NOW, $NOW
WHERE NOT EXISTS (
  SELECT 1 FROM claims WHERE statement LIKE 'src/.cursorrules describes a Vue/Pinia/Vite/Hono/Drizzle stack%'
);

-- Gotcha: config-overrides.js dead code
INSERT OR IGNORE INTO objects(object_type, created_at, updated_at)
  VALUES ('claim', $NOW, $NOW);
INSERT INTO claims(
  object_id, entity_object_id, claim_type, statement, normalized_statement,
  status, confidence, recorded_at, created_at, updated_at
) SELECT last_insert_rowid(),
  (SELECT object_id FROM entities WHERE canonical_name='table_compare'),
  'gotcha',
  'config-overrides.js + customize-cra dependency exist but are unreferenced: package.json scripts call react-scripts directly, not react-app-rewired. The Babel proposal/transform plugins listed there are inactive.',
  'config-overrides customize-cra dead react-app-rewired unused',
  'active', 0.95, $NOW, $NOW, $NOW
WHERE NOT EXISTS (
  SELECT 1 FROM claims WHERE statement LIKE 'config-overrides.js + customize-cra dependency exist but are unreferenced%'
);

-- Gotcha: hierarchy hardcoded to sheet1
INSERT OR IGNORE INTO objects(object_type, created_at, updated_at)
  VALUES ('claim', $NOW, $NOW);
INSERT INTO claims(
  object_id, entity_object_id, claim_type, statement, normalized_statement,
  status, confidence, recorded_at, created_at, updated_at
) SELECT last_insert_rowid(),
  (SELECT object_id FROM entities WHERE canonical_name='bom_hierarchy'),
  'gotcha',
  'extractGroupingInfo always reads xl/worksheets/sheet1.xml. If the user selects a non-first sheet, hierarchy is read from the wrong sheet. Known bug; do not paper over it without a fix.',
  'hierarchy sheet1 hardcoded bug extractGroupingInfo',
  'active', 0.99, $NOW, $NOW, $NOW
WHERE NOT EXISTS (
  SELECT 1 FROM claims WHERE statement LIKE 'extractGroupingInfo always reads xl/worksheets/sheet1.xml%'
);

-- Gotcha: Tailwind not built
INSERT OR IGNORE INTO objects(object_type, created_at, updated_at)
  VALUES ('claim', $NOW, $NOW);
INSERT INTO claims(
  object_id, entity_object_id, claim_type, statement, normalized_statement,
  status, confidence, recorded_at, created_at, updated_at
) SELECT last_insert_rowid(),
  (SELECT object_id FROM entities WHERE canonical_name='table_compare'),
  'gotcha',
  'JSX uses Tailwind utility classes (text-3xl, font-bold, mb-6) but Tailwind itself is not in the build. The classes render as inert strings. Either add Tailwind or stop adding new utility classes.',
  'tailwind classes inert no build utility',
  'active', 0.9, $NOW, $NOW, $NOW
WHERE NOT EXISTS (
  SELECT 1 FROM claims WHERE statement LIKE 'JSX uses Tailwind utility classes%'
);

-- Constraint: RefDes prefix rule
INSERT OR IGNORE INTO objects(object_type, created_at, updated_at)
  VALUES ('claim', $NOW, $NOW);
INSERT INTO claims(
  object_id, entity_object_id, claim_type, statement, normalized_statement,
  status, confidence, recorded_at, created_at, updated_at
) SELECT last_insert_rowid(),
  (SELECT object_id FROM entities WHERE canonical_name='reference_designator'),
  'constraint',
  'expandRanges expands a dash only when both endpoints share the same alphabetic prefix. R1-R5 expands, R1-C5 passes through unchanged. Numbers can go forward or reverse; underscores are allowed in the prefix. Do not "fix" the mixed-prefix passthrough without a spec — legacy BOMs use such strings as literal part numbers.',
  'expandRanges prefix match alphabetic R1-R5 R1-C5 passthrough',
  'active', 0.99, $NOW, $NOW, $NOW
WHERE NOT EXISTS (
  SELECT 1 FROM claims WHERE statement LIKE 'expandRanges expands a dash only when both endpoints share the same alphabetic prefix%'
);

-- Constraint: Hebrew description fields
INSERT OR IGNORE INTO objects(object_type, created_at, updated_at)
  VALUES ('claim', $NOW, $NOW);
INSERT INTO claims(
  object_id, entity_object_id, claim_type, statement, normalized_statement,
  status, confidence, recorded_at, created_at, updated_at
) SELECT last_insert_rowid(),
  (SELECT object_id FROM entities WHERE canonical_name='src/App.tsx'),
  'constraint',
  'findDescriptionField includes Hebrew strings (תיאור, שם, כותרת) because at least one production customer ships BOMs in Hebrew. Do not strip the existing list; add new languages instead.',
  'description hebrew teur shem keret heuristic preserve',
  'active', 0.95, $NOW, $NOW, $NOW
WHERE NOT EXISTS (
  SELECT 1 FROM claims WHERE statement LIKE 'findDescriptionField includes Hebrew strings%'
);

-- Constraint: Two-pass filter
INSERT OR IGNORE INTO objects(object_type, created_at, updated_at)
  VALUES ('claim', $NOW, $NOW);
INSERT INTO claims(
  object_id, entity_object_id, claim_type, statement, normalized_statement,
  status, confidence, recorded_at, created_at, updated_at
) SELECT last_insert_rowid(),
  (SELECT object_id FROM entities WHERE canonical_name='src/App.tsx'),
  'constraint',
  'Equal-row filtering runs twice: once in mergeTables on Left./Right. columns (preview), once in downloadMergedFile on <fileId>_* columns (export). The export pass additionally exempts both-blank, both "--", and both "." pairs. Preview and export must stay in sync.',
  'two pass filter merge preview export blank dashdash dot',
  'active', 0.98, $NOW, $NOW, $NOW
WHERE NOT EXISTS (
  SELECT 1 FROM claims WHERE statement LIKE 'Equal-row filtering runs twice%'
);

-- Fact: tsc --noEmit is the correctness gate
INSERT OR IGNORE INTO objects(object_type, created_at, updated_at)
  VALUES ('claim', $NOW, $NOW);
INSERT INTO claims(
  object_id, entity_object_id, claim_type, statement, normalized_statement,
  status, confidence, recorded_at, created_at, updated_at
) SELECT last_insert_rowid(),
  (SELECT object_id FROM entities WHERE canonical_name='table_compare'),
  'fact',
  'There are no real tests yet. npm test exits 0 with "No tests found related to files changed since last commit." The current correctness gate is npx tsc --noEmit + npm run build + real-browser verification per AOC-VERIFY-001.',
  'no tests tsc noemit npm build browser verification gate',
  'active', 0.99, $NOW, $NOW, $NOW
WHERE NOT EXISTS (
  SELECT 1 FROM claims WHERE statement LIKE 'There are no real tests yet%'
);

-- Risk: target: es5
INSERT OR IGNORE INTO objects(object_type, created_at, updated_at)
  VALUES ('claim', $NOW, $NOW);
INSERT INTO claims(
  object_id, entity_object_id, claim_type, statement, normalized_statement,
  status, confidence, recorded_at, created_at, updated_at
) SELECT last_insert_rowid(),
  (SELECT object_id FROM entities WHERE canonical_name='table_compare'),
  'risk',
  'tsconfig.json sets target: es5 while runtime code relies on es2015+ features. CRA bypasses tsc emit via Babel, so today this is benign — but anyone running raw tsc to emit will produce unusable JS. Use tsc --noEmit only.',
  'tsconfig target es5 babel emit risk',
  'active', 0.9, $NOW, $NOW, $NOW
WHERE NOT EXISTS (
  SELECT 1 FROM claims WHERE statement LIKE 'tsconfig.json sets target: es5%'
);

-- ============================================================================
-- Re-render generated_views so session-context picks up the new policies.
-- ============================================================================
-- project_overview
UPDATE generated_views SET body = (
  WITH counts AS (SELECT object_type, count(*) AS n FROM objects GROUP BY object_type)
  SELECT 'title | body' || char(10) || group_concat(object_type || ' | ' || n, char(10))
  FROM counts
), generated_at = $NOW
WHERE view_name = 'project_overview';

-- active_decisions
UPDATE generated_views SET body = COALESCE((
  SELECT 'title | summary' || char(10) || group_concat(title || ' | ' || summary, char(10))
  FROM decisions WHERE status='active'
), 'title | summary'), generated_at = $NOW
WHERE view_name = 'active_decisions';

-- active_policies
UPDATE generated_views SET body = COALESCE((
  SELECT 'policy_name | scope | status | since' || char(10) ||
         group_concat(policy_name || ' | ' || scope || ' | ' || status || ' | ' || datetime(effective_from,'unixepoch'), char(10))
  FROM policies WHERE status IN ('active','locked')
), 'policy_name | scope | status | since'), generated_at = $NOW
WHERE view_name = 'active_policies';

-- known_gotchas
UPDATE generated_views SET body = COALESCE((
  SELECT 'statement | recorded' || char(10) ||
         group_concat(statement || ' | ' || datetime(recorded_at,'unixepoch'), char(10))
  FROM claims WHERE claim_type='gotcha' AND status='active'
), 'statement | recorded'), generated_at = $NOW
WHERE view_name = 'known_gotchas';

-- entity_index
UPDATE generated_views SET body = COALESCE((
  SELECT 'title | body' || char(10) ||
         group_concat(canonical_name || ' | ' || entity_type || ' | ' || status || ' | ' || summary, char(10))
  FROM entities ORDER BY entity_type, canonical_name
), 'title | body'), generated_at = $NOW
WHERE view_name = 'entity_index';

COMMIT;
SQL

echo "Seed completed."
echo ""
echo "Counts:"
sqlite3 "$DB" "SELECT 'entities ', count(*) FROM entities;"
sqlite3 "$DB" "SELECT 'policies ', count(*) FROM policies;"
sqlite3 "$DB" "SELECT 'decisions', count(*) FROM decisions;"
sqlite3 "$DB" "SELECT 'claims   ', count(*) FROM claims;"
echo ""
echo "When OPENAI_API_KEY is available, run:"
echo "  ~/.codex/skills/memory-graph/memgraph rebuild-index"
echo "to populate FTS and vector index for hybrid recall."
