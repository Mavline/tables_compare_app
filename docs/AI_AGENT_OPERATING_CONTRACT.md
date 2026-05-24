# AI Agent Operating Contract (AOC)

Canonical, agent-independent rules for any coding agent working in this repository.

The block between `AOC_SHARED_BEGIN` and `AOC_SHARED_END` is mirrored verbatim into `CLAUDE.md` and `AGENTS.md`. The three copies must match byte for byte. Run `bash scripts/check-agent-docs.sh` before any spec freeze, implementation, review, fixer pass, or approval.

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

## Why this AOC exists in a small frontend repo

The repository is one React page, but the domain (BOM diffing for Order Management) is unforgiving: a silently wrong merge or a swallowed reference designator can lead to a manufacturing error downstream. The AOC keeps every agent on the same evidence-first cycle, so changes to the comparison core, range expansion, or hierarchy preservation must be proven in a real browser against real `.xlsx` files, not just compiled.
