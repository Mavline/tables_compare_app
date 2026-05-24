# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

A browser-only React/TypeScript tool that compares two Excel Bills of Materials (BOMs) for Order Management Engineers. All processing happens client-side: no backend, no API keys at runtime. Inputs are `.xlsx`/`.xls` files; the output is a styled `.xlsx` highlighting field-level and reference-designator-level differences. The README pitches "advanced documentation verification methods", but the implementation is a single-page CRA app — keep that gap in mind when reading product claims.

## Common commands

```bash
npm install                       # install dependencies (Node 14+)
npm start                         # dev server at http://localhost:3000 (react-scripts)
npm run build                     # production CRA bundle into build/
npm test -- --watchAll=false      # one-shot Jest (no test files yet — exits 0 with "No tests found")
npx tsc --noEmit                  # type-check the whole src/ without emitting; main correctness gate today

# Memory (.agent/memory.db must already exist; bootstrap once with the Doc_generating plugin)
sqlite3 .agent/memory.db "SELECT view_name, title FROM generated_views"     # quick sanity view
bash scripts/check-agent-docs.sh                                            # AOC parity check between CLAUDE.md / AGENTS.md / docs/AI_AGENT_OPERATING_CONTRACT.md
```

There is no lint script in `package.json`; CRA runs ESLint inside `npm start`/`npm run build`. `react-app-rewired` is **not** wired even though `config-overrides.js` exists — the scripts call `react-scripts` directly, so the Babel overrides in `config-overrides.js` are currently dead code. Treat it as a known gotcha rather than a contract.

## High-level architecture

```
src/index.tsx
└── BrowserRouter
    └── TableProvider               # context, only holds mergedData
        └── App
            ├── Navigation          # static / about links
            └── Routes
                ├── /         MainContent     (src/App.tsx, ~1390 lines)
                └── /about    About           (src/components/About.tsx)
```

`src/App.tsx` is the entire BOM pipeline in one component. Future refactors should split it, but until then keep the data-flow contract intact:

1. **Upload** (`handleFileUpload`) — reads two files via `FileReader → XLSX.read`. Resets all per-file state.
2. **Sheet detection** (`processSheet`) — scans the first 50 rows, picks the row with the most letter-containing cells as the header. Then re-parses with explicit `header:` to get typed rows. Deduplicates repeated column names with `-2`, `-3` suffixes.
3. **Hierarchy extraction** (`extractGroupingInfo`) — opens the same `.xlsx` as a ZIP via `JSZip`, parses `xl/worksheets/sheet1.xml` with `fast-xml-parser`, and reads `@_outlineLevel` per row. This is the only way to preserve Excel grouping; SheetJS drops outline level. Stored per file in `groupingStructure`.
4. **Field mapping** — when columns have different names in the two files (e.g., `PN` vs `Part Number`), the user adds `FieldMapping[]` pairs. Each mapping becomes `Left.<leftField>` / `Right.<rightField>` columns in the merged preview.
5. **Key field selection** — one column per file marks the row identity (typically Part Number).
6. **Merge** (`mergeTables`) — positional iteration up to `max(len(left), len(right))`:
   - for each left row, look up the right row by key and emit a paired result row;
   - if a right row has no key match in left, append it with empty `Left.*`;
   - rows where every active mapping pair is byte-equal are filtered out.
7. **Range expansion** (`expandRanges`) — if the user designates a column as the RefDes column (`columnToProcess` / `secondColumnToProcess`), strings like `R1-R5, C10` expand to `R1,R2,R3,R4,R5,C10`. Prefix must match across the dash; numbers can go forward or reverse; mismatched prefixes are left untouched.
8. **Export** (`downloadMergedFile`) — `ExcelJS` writes the result with cyan headers (`#B1F0F0`) and thin borders. RefDes columns get `Canceled_<field>` and `Added_<field>` diff columns. Column prefixes switch from `Left.`/`Right.` to the user-supplied `fileIds[0]`/`fileIds[1]`. A second filter pass drops rows where every renamed pair is empty/equal/`--`/`.`.

The description field is auto-detected by name in `findDescriptionField` against a hardcoded list including Hebrew strings (`תיאור`, `שם`, `כותרת`). When customers ship BOMs in a new language, add canonical names there.

## Domain rules that are easy to break

- **Hierarchy is rendered, not editable.** `groupingStructure[fileName][rowIndex]` is populated from raw XML against the *original* row index plus the header offset. Any change to row ordering after `processSheet` must keep this mapping consistent.
- **Reference designators are positional.** Range expansion compares only literal prefixes; `R1-C5` is intentionally not expanded. Do not "fix" that into something cleverer without confirming with the user — manufacturing relies on the exact string.
- **The merge is positional + keyed, not purely keyed.** Two BOMs of different lengths still iterate by index; a key match wins for the left row but right-only rows are appended at the end. Refactoring to a pure key-based merge would change the row order in customer-facing exports.
- **Description detection is heuristic.** The Hebrew literals matter — the previous owner used them in production.
- **Filtering happens twice.** Once in `mergeTables` (preview) on `Left.`/`Right.` columns, once in `downloadMergedFile` (export) on `<fileId>_*` columns. They must stay in sync or the downloaded file will diverge from the preview.

## Stale or surprising bits

- `src/.cursorrules` describes a Vue/Pinia/Vite/Hono/Drizzle stack. None of those are used. The file is a leftover and should not steer suggestions.
- `config-overrides.js` is unreferenced by package scripts.
- `target` in `tsconfig.json` is `es5` while `react-app-env.d.ts` and the runtime require `es2015+`; CRA compensates via Babel, but raw `tsc` may emit unusable JS — always use `tsc --noEmit`.
- Inline styles dominate (`backgroundColor: '#1C2128'` etc.); Tailwind classes appear but Tailwind itself is not configured. `tailwind-merge` and `clsx` are listed but only `clsx` is imported (via `src/lib/utils.ts`).
- The `RESET` button calls `window.location.reload()` after clearing state — there is no soft reset.

## Working with memory

This repo follows the memory-graph discipline documented in `MEMORY_WRITE_RULES.md` and `docs/AI_AGENT_OPERATING_CONTRACT.md`. The local database lives at `.agent/memory.db` (gitignored). Before non-trivial work, recall existing policies, decisions, and gotchas; after stable architecture or domain decisions, write them via the memgraph CLI rather than ad-hoc notes.

Pure SQL reads (`session-context`, `policy`, `timeline`) work without any external key. Hybrid vector recall and durable writes require `OPENAI_API_KEY`.

## Surfagent verification

When changing the file-upload, mapping, or export UI, verify in a real browser. Surfagent at `http://localhost:3456` (see `~/.claude/CLAUDE.md`) can drive the page. Do not commit Surfagent artifacts.

## Shared Agent Operating Contract

<!-- AOC_SHARED_BEGIN v1 -->

This Shared Agent Operating Contract (AOC) is binding for Claude, Codex, and any future coding agent working in this repository. Agent-specific sections may add tool mechanics, but they must not weaken, override, rename, or reinterpret these AOC rules.

### AOC-DOCS-001: Control Document Parity

The shared AOC block in `CLAUDE.md`, `AGENTS.md`, and `docs/AI_AGENT_OPERATING_CONTRACT.md` must be byte-identical. This is Stage 0 for every spec freeze, implementation, review, fixer pass, or approval. Before any of those actions, the orchestrator must run:

```bash
bash scripts/check-agent-docs.sh
```

If parity fails, the task is blocked with `DOCS_PARITY_FAIL`. Do not implement, review, approve, commit, or write completion memory until the shared blocks are synchronized.

### AOC-ORCH-001: Agent-Independent Orchestration

The active orchestrator may be Claude, Codex, or another coding agent. The active orchestrator must not treat its own control file as the only source of truth. At cycle start, the orchestrator must identify its active control file, load this shared AOC, verify parity with `AOC-DOCS-001`, and cite AOC rule IDs instead of file-specific rule names.

Invalid references:

- "`AGENTS.md` says ..."
- "`CLAUDE.md` says ..."

Valid references:

- `AOC-VERIFY-001 requires ...`
- `AOC-REVIEW-001 blocks approval because ...`

### AOC-ORCH-002: Required Cycle Flow

For every non-trivial task the lead orchestrator must:

1. pass Stage 0 control-document parity under `AOC-DOCS-001`;
2. load relevant memory recall from `.agent/memory.db` and read the affected source files;
3. restate the narrow task and acceptance criteria;
4. split work into logical tasks with explicit acceptance criteria;
5. implement the smallest safe change set per logical task;
6. run required verification before reviewer handoff (see `AOC-VERIFY-001`);
7. run a fresh adversarial reviewer when scope warrants it;
8. if review returns `FAIL` or `UNKNOWN`, run a single fixer pass under `AOC-FIX-001`;
9. rerun impacted verification before a fresh reviewer rechecks the fixer output;
10. report changed files, verification commands, residual risk, and acceptance status;
11. commit each accepted logical task as its own commit with the tracked file changes.

### AOC-SPEC-001: Acceptance Criteria Evidence Contract

Every acceptance criterion must include:

1. expected user-visible behavior;
2. production execution model (which file/function/handler enforces it);
3. explicit failure cases;
4. required evidence for each failure case;
5. relevant AOC rule IDs;
6. files and docs that must stay consistent (e.g., README, BOM_DOMAIN, snapshots).

An acceptance criterion without failure cases is incomplete and must not be approved. A failure case may be marked `N/A` only with a specific justification recorded in the spec.

### AOC-VERIFY-001: Verification Gate

Required verification must run before reviewer handoff. The verification commands for this repository are:

```bash
npx tsc --noEmit            # type-check the entire src/
npm run build               # production CRA build, catches lint+runtime errors
npm test -- --watchAll=false  # only meaningful once tests exist
```

For any change that affects the user-visible Excel pipeline (file upload, sheet selection, mapping, merge, reference-designator expansion, hierarchy preservation, exported workbook), the verifier must additionally:

- start the dev server with `npm start`;
- exercise the change in a real browser using representative `.xlsx` fixtures;
- record the inputs, observed output, and any console errors as evidence.

A type-check or build pass is not sufficient evidence for UI-affecting changes. If a verification step is impossible, evidence must record the blocker, residual risk, and a manual recipe.

### AOC-EVID-001: Evidence Contract

Evidence must cite concrete proof: file paths with line ranges, exact commands, exit codes, output excerpts, console traces, screenshots when relevant, and artifact paths. Evidence must distinguish:

- static evidence (type-check, build, lint, code inspection);
- runtime evidence (executed commands, console logs);
- user-flow evidence (browser interaction with screenshots or DOM dumps).

Claims without reproducible evidence are `UNKNOWN`. Code inspection alone never closes a UI-affecting acceptance criterion.

### AOC-REVIEW-001: UNKNOWN Blocks Approval

Reviewer verdicts use only `PASS`, `FAIL`, or `UNKNOWN` per acceptance criterion. `UNKNOWN` blocks approval exactly like `FAIL` unless the lead and user explicitly accept the limitation in writing. A reviewer must not convert missing evidence into `PASS` based on builder narrative, code reading alone, or assumed behavior.

### AOC-REVIEW-002: Fresh Adversarial Reviewer

A reviewer that is invoked must be a fresh session, must not modify production code, and must judge against this AOC rather than agent-specific file names. Before review, the reviewer reruns `AOC-DOCS-001`. For every acceptance criterion the reviewer restates the production execution model, lists concrete failure scenarios, verifies evidence for each, cites AOC rule IDs, and assigns `PASS`, `FAIL`, or `UNKNOWN`.

### AOC-FIX-001: Fixer Scope

A fixer reads only the frozen spec, the reviewer verdict, and `problems.md`. It reconfirms each listed problem before editing, makes the smallest safe change set, regenerates impacted evidence, and stops without writing a final sign-off or a new review verdict.

### AOC-MEM-001: Memory Discipline

Repo-local memory lives at `.agent/memory.db` and follows `MEMORY_WRITE_RULES.md`. Do not hand-edit `objects`, `index_docs`, `memory_vec`, or `embedding_meta`. Use the memgraph CLI (or, when scripted seeding is unavoidable, write only to the typed tables `policies`, `decisions`, `claims`, `entities`, `relations` with matching `objects` rows, and rebuild the FTS/vector index afterwards). Never commit `.agent/memory.db` or anything else under `.agent/`.

### AOC-DATA-001: Sensitive Input Handling

Excel inputs may contain customer part numbers, prices, suppliers, and internal identifiers. Do not log full row contents or paste customer files into memory, commits, or shared logs. Use small synthetic fixtures committed under `fixtures/` (when needed) instead of real customer BOMs.

<!-- AOC_SHARED_END v1 -->

## Collaboration style

- Ask before turning README marketing copy into binding product decisions.
- Keep changes scoped and reversible; the codebase has no tests yet, so unrelated rewrites are riskier than they look.
- Verify any user-visible change in a real browser, not by reading the diff.
- When something surprised you (stale `.cursorrules`, dead `config-overrides.js`, the Hebrew description heuristic), record it as a gotcha in memory so the next agent does not relearn it.

## Repo task proof loop

For non-trivial features, refactors, or bug fixes, follow `.agent/tasks/<TASK_ID>/`:

1. Freeze `spec.md` with `AC1`, `AC2`, ... before implementation.
2. Implement against those acceptance criteria.
3. Produce `evidence.md` and `evidence.json`.
4. Run a fresh verification pass against the current code and rerun the relevant checks under `AOC-VERIFY-001`.
5. If verification is not `PASS`, write `problems.md`, apply the smallest defensible fix, and reverify.

Hard rules:

- Do not claim completion unless every acceptance criterion is `PASS`.
- Verifiers judge current code and current command results, not prior chat claims.
- Fixers make the smallest defensible diff.

Installed workflow agents:

- `.claude/agents/task-spec-freezer.md`
- `.claude/agents/task-builder.md`
- `.claude/agents/task-verifier.md`
- `.claude/agents/task-fixer.md`
