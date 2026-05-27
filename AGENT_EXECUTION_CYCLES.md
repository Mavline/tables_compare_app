# Agent Execution Cycles

Status: Supporting playbook for applying the Shared Agent Operating Contract in this repository.

## Authority

Agents must treat `docs/ARCHITECTURE.md` as the source of truth for code structure and `docs/BOM_DOMAIN.md` as the source of truth for BOM semantics. `README.md` is marketing copy and does not override the implementation, architecture doc, domain doc, or user instructions.

Core orchestration, specification, evidence, verification, review, and approval rules come from the Shared Agent Operating Contract embedded identically in `AGENTS.md`, `CLAUDE.md`, and `docs/AI_AGENT_OPERATING_CONTRACT.md`. This file is supporting detail; it must not weaken or reinterpret AOC rule IDs.

## Lead Orchestrator Protocol

Any invoked coding agent is the lead orchestrator for that session.

The lead orchestrator must:

0. Run Stage 0 control-document parity:

   ```bash
   bash scripts/check-agent-docs.sh
   ```

   If it fails, report `DOCS_PARITY_FAIL` and stop.

1. Read `docs/AI_AGENT_OPERATING_CONTRACT.md`.
2. Read `docs/ARCHITECTURE.md` and `docs/BOM_DOMAIN.md` for any code, UX, or pipeline work.
3. Run repo-local memory context and targeted recall when available.
4. Restate the narrow task before implementation.
5. Split work into logical tasks with explicit acceptance criteria that satisfy `AOC-SPEC-001`.
6. Run the red-team spec gate required by `AOC-SPEC-002` when a frozen spec is required.
7. Implement the smallest safe change set for each logical task.
8. Run required verification before reviewer handoff. UI and Excel-pipeline changes require real browser verification and synthetic `.xlsx` fixtures unless impossible; impossible tests must be documented with the blocker, residual risk, and manual-test recipe.
9. Run a fresh reviewer when scope warrants review.
10. Require reviewer output to judge every acceptance criterion as `PASS`, `FAIL`, or `UNKNOWN`.
11. If any criterion is not `PASS`, run exactly one fixer, then rerun impacted verification before a fresh verifier pass.
12. Repeat only until `PASS` or report a blocker.
13. Personally check logical correctness before final report.
14. Commit each accepted logical task that changes tracked files unless the user explicitly tells the agent not to commit. Do not batch unrelated accepted tasks into one catch-all commit.
15. Report changed files, verification commands, remaining risks, and acceptance status.

## Required Proof Artifacts

For every non-trivial cycle, keep proof artifacts under:

```text
.agent/tasks/<TASK_ID>/
  spec.md
  evidence.md
  evidence.json
  raw/
    tsc.txt
    build.txt
    test.txt
    browser-read.json
    screenshot-1.png
    exported-workbook.xlsx
  verdict.json
  problems.md
```

`.agent/` is memory and proof infrastructure and must not be committed.

## Builder Rules

Builder:

- writes code, tests, fixtures, docs, and evidence only for the assigned task;
- avoids broad refactors;
- does not modify unrelated user changes;
- does not write final sign-off;
- does not write `verdict.json` or `problems.md`;
- packages evidence after implementation when asked;
- lists changed files and checks run.

## Reviewer Rules

Reviewer:

- must be a fresh session;
- must not modify production code;
- must verify Stage 0 control-document parity before review;
- must review against the Shared Agent Operating Contract and cite AOC rule IDs;
- checks actual repo state, not builder narrative;
- verifies that evidence matches the production execution model;
- reruns relevant commands when possible;
- writes `verdict.json`;
- writes `problems.md` if any criterion is not `PASS`.

`verdict.json` must include:

```json
{
  "task_id": "<TASK_ID>",
  "overall_verdict": "PASS",
  "criteria": [
    {
      "id": "AC1",
      "status": "PASS",
      "reason": "Current repo state proves the criterion."
    }
  ],
  "commands_run": [],
  "artifacts_used": []
}
```

Allowed statuses: `PASS`, `FAIL`, `UNKNOWN`.

`UNKNOWN` blocks approval under `AOC-REVIEW-001`.

## Fixer Rules

Fixer:

- reads only `spec.md`, `verdict.json`, and `problems.md`;
- reconfirms each listed issue before editing;
- applies the smallest safe fix set;
- avoids regressing passing criteria;
- regenerates evidence artifacts for impacted criteria;
- does not write `verdict.json`;
- stops without final sign-off.

## Problems File Requirements

For every non-`PASS` criterion, `problems.md` must include:

- criterion id and text;
- status;
- why it is not proven;
- minimal reproduction steps;
- expected vs actual;
- affected files;
- smallest safe fix;
- corrective hint in 1-3 sentences.

## Memory Discipline

At session start or before non-trivial work:

```bash
~/.codex/skills/memory-graph/memgraph session-context
```

Before implementation, refactors, architecture changes, domain changes, or ambiguous decisions:

```bash
~/.codex/skills/memory-graph/memgraph recall "<query>"
```

If `OPENAI_API_KEY` is missing, hybrid recall and durable writes are blocked; pure SQL reads such as `session-context` and `policy` may still be used. After an accepted decision, gotcha, policy change, or architecture change, write memory through the memgraph CLI when writes are available. Do not hand-edit `.agent/memory.db`.

## Browser Verification

For user-visible behavior, use Surfagent or another real browser verification path. Static review alone is not enough for UX claims.

Recon/action/read loop for Surfagent:

1. Start or verify Surfagent.
2. `POST /recon` before click/fill/scroll/dispatch.
3. Act with current selectors.
4. `POST /read` to verify result.
5. Recon again after navigation.

Stop Surfagent when no longer needed.

## BOM And Excel Cycles

For file upload, sheet selection, mapping, merge, reference-designator expansion, hierarchy preservation, preview, or export work:

- use small synthetic fixtures under `fixtures/` when committed fixtures are needed;
- do not use real customer BOMs;
- exercise the affected path through the browser;
- inspect preview rows for UI-facing behavior;
- inspect the generated workbook for export-facing behavior;
- preserve positional row order, key matching, two-pass filtering, hierarchy columns, RefDes diff columns, and output column order unless the frozen spec explicitly changes them.

## Final Review Gate

A task is not accepted until:

- `bash scripts/check-agent-docs.sh` passes;
- all required `AOC-VERIFY-001` checks pass or have documented blockers accepted by the user;
- UI or Excel-pipeline changes have browser/workbook evidence;
- every acceptance criterion is `PASS`, or the limitation has been explicitly accepted in writing.
