# AGENTS.md

Project-local rules for Codex CLI and any AGENTS.md-aware coding agent. Mirrors `CLAUDE.md` for the shared AOC block; agent-specific tooling notes live below.

## Source of Truth

- `docs/AI_AGENT_OPERATING_CONTRACT.md` is the canonical AOC. The block here is its mirror.
- `docs/ARCHITECTURE.md` is the current source of truth for how the BOM pipeline is wired.
- `docs/BOM_DOMAIN.md` documents reference-designator, hierarchy, and merge semantics.
- `AGENT_EXECUTION_CYCLES.md` is the supporting playbook for spec, evidence, reviewer, and fixer cycles.
- `MEMORY_WRITE_RULES.md` controls what and how to write into `.agent/memory.db`.
- `README.md` is marketing copy and overstates the system; do not derive product decisions from it without confirming with the user.

## Product Scope

A single-page browser tool. Two `.xlsx` files in, one styled `.xlsx` diff out. No backend, no auth, no data persistence beyond the React context for the current preview. Allowed surface:

- file upload + sheet selection;
- field mapping + key-field selection;
- reference-designator range expansion (one or two columns);
- preview table (first 10 rows);
- styled export via `ExcelJS`;
- About page.

Hard boundaries until the user explicitly reopens them:

- no server-side processing;
- no user accounts, no telemetry, no analytics calls;
- no automatic upload of customer files anywhere;
- no third-party APIs beyond the bundled `xlsx`/`exceljs`/`jszip`/`fast-xml-parser` libraries;
- do not log row contents — customer BOMs are sensitive.

## Stack and Commands

Stack: Create React App + react-scripts 5, React 18, TypeScript 4.4 (`strict: true`, `target: es5`), react-router-dom v7, ExcelJS, SheetJS (`xlsx`), JSZip, fast-xml-parser, file-saver, Radix UI primitives (`@radix-ui/react-label`, `@radix-ui/react-select`), `clsx`. Tailwind classes appear in code but Tailwind itself is not configured. `config-overrides.js` is present but unused by the package scripts.

```bash
npm install
npm start                          # http://localhost:3000
npm run build                      # production CRA bundle
npm test -- --watchAll=false       # currently no tests; exits cleanly
npx tsc --noEmit                   # primary correctness gate

bash scripts/check-agent-docs.sh   # AOC parity check (AOC-DOCS-001)
```

There is no `lint` script; CRA runs ESLint inside `start`/`build`. Tests do not yet exist.

## Memory

- Repo-local memory at `.agent/memory.db`.
- Detailed discipline: `MEMORY_WRITE_RULES.md`.
- Do not commit `.agent/` or `memory.db`.
- For pure SQL recall (`session-context`, `policy`, `timeline`), the home-installed Codex memory-graph skill works out of the box:

```bash
~/.codex/skills/memory-graph/memgraph session-context
~/.codex/skills/memory-graph/memgraph recall "reference designator expansion"
```

- For durable writes and hybrid recall, export `OPENAI_API_KEY`. If the key is missing, state that memory is read-only.
- Never hand-edit `objects`, `index_docs`, `memory_vec`, or `embedding_meta`. Seed scripts in `scripts/seed-memory.sh` write only to the typed tables and re-render `generated_views`.

## Surfagent Browser Verification

For UI-affecting changes, start the dev server and verify in a browser. Surfagent at `http://localhost:3456` (`~/.claude/SURFAGENT.md`) is the preferred driver. Record screenshots or DOM dumps as evidence. Do not commit Surfagent artifacts or `/tmp/surfagent-chrome`.

## Shared Agent Operating Contract

<!-- AOC_SHARED_BEGIN sha256:2bbc054fab40f9506afdd288e68aed2b38da072725a715b57ee7df45575a1530 -->

This Shared Agent Operating Contract (AOC) is binding for Claude, Codex, and any future coding agent working in this repository. Agent-specific sections may add tool mechanics, but they must not weaken, override, rename, or reinterpret these AOC rules.

### AOC-DOCS-001: Control Document Parity

The shared AOC block in `CLAUDE.md`, `AGENTS.md`, and `docs/AI_AGENT_OPERATING_CONTRACT.md` must be byte-identical. The `AOC_SHARED_BEGIN` marker carries the SHA-256 of the shared block body, and `bash scripts/check-agent-docs.sh` verifies both byte parity and the declared hash. This is Stage 0 for every spec freeze, implementation, review, fixer pass, or approval. Before any of those actions, the orchestrator must run:

```bash
bash scripts/check-agent-docs.sh
```

If parity or the declared hash fails, the task is blocked with `DOCS_PARITY_FAIL`. Do not implement, review, approve, commit, or write completion memory until the shared blocks are synchronized.

### AOC-DOCS-002: Source-Document Consistency

Instruction and source-of-truth changes must update every authoritative surface that depends on the same rule: `docs/AI_AGENT_OPERATING_CONTRACT.md`, `AGENTS.md`, `CLAUDE.md`, `AGENT_EXECUTION_CYCLES.md` when present, role-agent prompts, `MEMORY_WRITE_RULES.md`, and validation scripts. Reuse process discipline from neighboring repositories only after rewriting it for this repository's BOM comparison scope. Do not copy product-specific PRD, payment, auth, legal, or deployment rules from another project.

Execution state does not belong in source docs. Keep task artifacts under `.agent/tasks/<TASK_ID>/`, durable reusable memory in `.agent/memory.db`, and product/domain truth in the project source documents listed above.

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
2. load relevant memory recall from `.agent/memory.db` and read the affected source files and source-of-truth docs;
3. restate the narrow task and acceptance criteria;
4. split work into logical tasks with explicit acceptance criteria;
5. run the red-team spec gate under `AOC-SPEC-002` before implementation when a frozen spec is required;
6. implement the smallest safe change set per logical task; when subagents are used, run exactly one builder per logical task;
7. run required verification before reviewer handoff (see `AOC-VERIFY-001` and `AOC-VERIFY-002`);
8. obtain exactly one fresh adversarial reviewer when scope warrants review without violating `AOC-REVIEW-003`;
9. if review returns `FAIL` or `UNKNOWN`, run exactly one fixer under `AOC-FIX-001`;
10. rerun impacted verification before a fresh reviewer rechecks the fixer output;
11. repeat review/fix only until every criterion is `PASS` or report a blocker;
12. personally check logical correctness before final report;
13. report changed files, verification commands, residual risk, and acceptance status;
14. commit each accepted logical task as its own commit with the tracked file changes, unless the user explicitly tells the agent not to commit.

### AOC-SPEC-001: Acceptance Criteria Evidence Contract

Every acceptance criterion must include:

1. expected user-visible behavior;
2. production execution model (which file/function/handler enforces it);
3. explicit failure cases;
4. required evidence for each failure case;
5. relevant AOC rule IDs;
6. files and docs that must stay consistent (e.g., `docs/ARCHITECTURE.md`, `docs/BOM_DOMAIN.md`, README, fixtures, snapshots).

An acceptance criterion without failure cases is incomplete and must not be approved. A failure case may be marked `N/A` only with a specific justification recorded in the spec.

### AOC-SPEC-002: Red-Team Spec Gate

Before implementation starts on a frozen spec, the lead must adversarially review the spec and acceptance criteria. The red-team pass must ask how the implementation could appear to pass while violating the BOM merge contract, positional row order, key matching, reference-designator expansion, hierarchy preservation, selected-sheet behavior, description detection, export column order, export styling, sensitive-data boundary, or user-visible workflow. Missing adversarial cases must be added before builder handoff.

### AOC-VERIFY-001: Verification Gate

Required verification must run before reviewer handoff. The verification commands for this repository are:

```bash
npx tsc --noEmit            # type-check the entire src/
npm run build               # production CRA build, catches lint+runtime errors
npm test -- --watchAll=false  # only meaningful once tests exist
```

For docs-only or control-document changes, the minimum verification is:

```bash
bash scripts/check-agent-docs.sh
git diff --check
```

For any change that affects the user-visible Excel pipeline (file upload, sheet selection, mapping, merge, reference-designator expansion, hierarchy preservation, preview table, or exported workbook), the verifier must additionally:

- start the dev server with `npm start`;
- exercise the change in a real browser using representative synthetic `.xlsx` fixtures;
- inspect the preview and, when export behavior is affected, the generated workbook;
- record the inputs, observed output, artifact paths, and any console errors as evidence.

A type-check or build pass is not sufficient evidence for UI-affecting changes. If a verification step is impossible, evidence must record the blocker, residual risk, and a manual recipe.

### AOC-VERIFY-002: Production-Model Verification Rule

Tests and smoke checks must match the production execution model. Helper-level tests can support evidence, but they do not prove the browser-only BOM workflow unless the same code path is exercised through the UI or an explicitly equivalent harness.

For Excel pipeline changes:

- fixture data must be synthetic and small enough to inspect;
- fixture coverage must include the affected sheet selection, mapping, key-field, range-expansion, hierarchy, preview, or export path;
- exported-workbook claims require inspecting the generated `.xlsx` structure or visible workbook result, not only the in-memory row object;
- assertions must preserve row order, column order, filter semantics, and sensitive-data handling.

### AOC-EVID-001: Evidence Contract

Evidence must cite concrete proof: file paths with line ranges, exact commands, exit codes, output excerpts, console traces, screenshots when relevant, generated workbook paths, and artifact paths. Evidence must distinguish:

- static evidence (type-check, build, lint, code inspection);
- runtime evidence (executed commands, console logs, generated files);
- workbook evidence (fixture inputs, preview rows, exported `.xlsx` inspection);
- user-flow evidence (browser interaction with screenshots or DOM dumps).

Claims without reproducible evidence are `UNKNOWN`. Code inspection alone never closes a UI-affecting acceptance criterion.

### AOC-REVIEW-001: UNKNOWN Blocks Approval

Reviewer verdicts use only `PASS`, `FAIL`, or `UNKNOWN` per acceptance criterion. `UNKNOWN` blocks approval exactly like `FAIL` unless the lead and user explicitly accept the limitation in writing. A reviewer must not convert missing evidence into `PASS` based on builder narrative, code reading alone, or assumed behavior.

### AOC-REVIEW-002: Fresh Adversarial Reviewer

A reviewer that is invoked must be a fresh session, must not modify production code, and must judge against this AOC rather than agent-specific file names. Before review, the reviewer reruns or independently verifies `AOC-DOCS-001`. For every acceptance criterion the reviewer restates the production execution model, lists concrete failure scenarios, verifies evidence for each, verifies that tests match the production model, cites AOC rule IDs, and assigns `PASS`, `FAIL`, or `UNKNOWN`.

### AOC-REVIEW-003: No Agent-Initiated Claude Invocation

Claude, Claude Code, and Anthropic CLI sessions are peer orchestrators only when started by the user. Codex and other non-Claude agents must not launch, script, call, or delegate to Claude, Claude Code, Anthropic CLI, Claude reviewer tools, or Claude rework tools. If Claude review is useful or required, the agent must ask the user to hand the task to Claude and wait for user-provided results, or record reviewer handoff as blocked/`UNKNOWN` if the user does not provide it. This rule does not prevent a user-started Claude session from working directly in the repo as lead orchestrator under this AOC.

### AOC-FIX-001: Fixer Scope

A fixer reads only the frozen spec, `verdict.json`, and `problems.md`. It reconfirms each listed problem before editing, makes the smallest safe change set, regenerates impacted evidence, and stops without writing a final sign-off or a new review verdict.

### AOC-MEM-001: Memory Discipline

Repo-local memory lives at `.agent/memory.db` and follows `MEMORY_WRITE_RULES.md`. Do not hand-edit `objects`, `index_docs`, `memory_vec`, or `embedding_meta`. Use the memgraph CLI (or, when scripted seeding is unavoidable, write only to the typed tables `policies`, `decisions`, `claims`, `entities`, `relations` with matching `objects` rows, and rebuild the FTS/vector index afterwards). Never commit `.agent/memory.db` or anything else under `.agent/`.

Do not write work progress, blockers, evidence, or reviewer verdicts into source docs as a substitute for the task proof loop. Use `.agent/tasks/<TASK_ID>/` for execution artifacts and memgraph only for durable reusable policies, decisions, claims, entities, and relations.

### AOC-DATA-001: Sensitive Input Handling

Excel inputs may contain customer part numbers, prices, suppliers, and internal identifiers. Do not log full row contents or paste customer files into memory, commits, source docs, or shared logs. Use small synthetic fixtures committed under `fixtures/` when needed instead of real customer BOMs.

<!-- AOC_SHARED_END -->

## Engineering Rules

- Treat `src/App.tsx` as load-bearing. The merge contract (positional iteration + key match + filter on byte-equal mapped pairs) is the product. A refactor that changes row order in the export changes customer-visible output and is a breaking change.
- `extractGroupingInfo` reads the raw worksheet XML via JSZip; do not switch to a SheetJS-only path until you have proof that `outlineLevel` is recoverable through another channel.
- `expandRanges` only expands when both endpoints share an alphabetic prefix. Mixed-prefix ranges (`R1-C5`) pass through verbatim by design.
- `findDescriptionField` includes Hebrew strings. Adding a language means adding canonical names there, not stripping the existing list.
- Inline styles are pervasive. New components may use them or migrate to Tailwind, but do not introduce a third styling system.
- `config-overrides.js` is unreferenced. If you adopt it, also swap `react-scripts` for `react-app-rewired` in `package.json` scripts; otherwise delete it.

## Repo Task Proof Loop

For substantial features, refactors, bug fixes, and instruction/process changes:

1. Freeze `.agent/tasks/<TASK_ID>/spec.md` with `AC1`, `AC2`, ... before implementation.
2. Implement against those acceptance criteria.
3. Create `evidence.md`, `evidence.json`, and any raw artifacts (screenshots, exported `.xlsx`).
4. Run a fresh verification pass against the current code under `AOC-VERIFY-001`.
5. If verification is not `PASS`, write `problems.md`, apply the smallest safe fix, and reverify.

Required artifact shape and reviewer/fixer duties are in `AGENT_EXECUTION_CYCLES.md`. Keep execution artifacts in `.agent/tasks/<TASK_ID>/`; do not turn source docs into a progress log.

Installed Codex workflow agents:

- `.codex/agents/task-spec-freezer.toml`
- `.codex/agents/task-builder.toml`
- `.codex/agents/task-verifier.toml`
- `.codex/agents/task-fixer.toml`
