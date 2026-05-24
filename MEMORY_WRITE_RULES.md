# Memory Write Rules

This repository uses `.agent/memory.db` as the project's long-term memory. The schema is the standard `memory-graph` schema (SQLite + FTS5 + sqlite-vec) bootstrapped from the `memgraph-memory-codex` plugin maintained in the sibling `Doc_generating` project. The rules below define what to read and write and which sources have authority.

## Rule sources, in priority order

1. `docs/AI_AGENT_OPERATING_CONTRACT.md` (specifically `AOC-MEM-001`).
2. The Codex memory-graph plugin contract at `~/.codex/skills/memory-graph/SKILL.md`.
3. Project-local rules in `AGENTS.md` and `CLAUDE.md`.
4. Durable policies, decisions, and claims already written into `.agent/memory.db`.

If the database and a markdown note disagree, the database wins. Reconcile through `memgraph` rather than silently trusting the note.

## Authority

- `.agent/memory.db` is the project's source of truth for durable policies, decisions, claims, and entities.
- `docs/ARCHITECTURE.md` is the source of truth for code structure. If memory and code disagree, read the code, fix it or update memory, and record the resolution.
- `docs/BOM_DOMAIN.md` is the source of truth for domain semantics (reference designators, hierarchy, description detection).
- `README.md` is marketing copy. Do not derive memory entries from it without verifying against code.

## Read rules

Use the home-installed Codex memory-graph CLI:

```bash
~/.codex/skills/memory-graph/memgraph session-context           # snapshot
~/.codex/skills/memory-graph/memgraph recall "<query>"          # hybrid recall (needs OPENAI_API_KEY)
~/.codex/skills/memory-graph/memgraph policy <fragment>         # SQL policy search (no key needed)
~/.codex/skills/memory-graph/memgraph timeline                  # recent orchestration events
```

- At session start or before substantial work, run `memgraph session-context`.
- Before refactors, architecture changes, or domain edits, run `memgraph recall "<topic>"`.
- Before adopting or changing a project rule, check existing policies via `memgraph recall "<topic>" --type policy` or `memgraph policy <fragment>`.

When `OPENAI_API_KEY` is missing, vector recall is blocked but pure SQL reads still work.

## Write rules

Every durable write must go through the `memgraph` CLI so the typed table, FTS index, vector index, and embedding metadata stay synchronized:

| What                                                  | Command                                                            |
| ----------------------------------------------------- | ------------------------------------------------------------------ |
| Product or architecture decision                      | `memgraph write-decision`                                          |
| Requirement, constraint, risk, assumption, gotcha     | `memgraph write-claim`                                             |
| Project, subsystem, library, external system, alias   | `memgraph write-entity` / `memgraph alias-entity`                  |
| Adopted process or project rule                       | `memgraph write-policy`                                            |
| Relationship between durable records                  | `memgraph write-relation`                                          |

Workflow records (`open-wf`, `open-run`, `close-run`, …) are available but should only be opened when this project explicitly adopts multi-agent orchestration. For one-off tasks, use `.agent/tasks/<TASK_ID>/` files instead of run/tranche objects.

## Scripted seeding

`scripts/seed-memory.sh` drives the baseline entities, policies, decisions, and claims through the `memgraph` CLI, so FTS, sqlite-vec, and `embedding_meta` are populated inline with each write. The script:

- requires `OPENAI_API_KEY`. It auto-loads from `<repo>/.env` or from the sibling `Doc_generating/.env`; if neither resolves a key, it exits with a clear error;
- before re-writing, deletes the prior seed batch by canonical identifier (entity `canonical_name`, `policy_name`, decision title, claim statement prefix) inside a transaction with `PRAGMA foreign_keys = ON` so `ON DELETE CASCADE` actually fires;
- runs a defensive orphan sweep on `entities`, `policies`, `decisions`, and `claims` to recover from any earlier seed run that left rows without a parent `object`;
- writes one row at a time via `memgraph write-entity`, `write-policy`, `write-decision`, `write-claim` — never by direct SQL on those tables;
- is idempotent: re-running yields the same baseline without duplicates.

The direct-SQL portion is limited to the cleanup transaction; no row is ever inserted into `objects`, `index_docs`, `memory_vec`, or `embedding_meta` by hand. Any further memory work goes through the CLI.

## What must be remembered

- Domain rules that are easy to break (range expansion prefix matching, Hebrew description detection, two-pass filter, hierarchy from raw XML).
- Stack and tooling decisions (CRA, no Tailwind build, `config-overrides.js` unused, `tsc --noEmit` as the correctness gate).
- Refactor boundaries that customer output depends on (positional + keyed merge order, column order in export, cyan header styling).
- Non-trivial bugs and the fixes that closed them.
- Surprises in inherited code (stale `.cursorrules`, wrong Vue stack description, hardcoded `sheet1.xml`).
- User corrections that prevent repeated mistakes.

## What must not be remembered

- Customer part numbers, prices, supplier names, real BOM contents.
- API keys, tokens, environment values.
- Large pasted source material when a short summary plus file reference is enough.
- Transient command output without future reuse value.
- Speculation presented as fact — use `assumption`, `risk`, or `observation` claim types when certainty is limited.

## Technical invariants

- Schema is the v1 `memory-graph` schema (24 tables, FTS5, sqlite-vec with 512-dim embeddings, model `text-embedding-3-small`).
- Never hand-edit rows in `objects`, `index_docs`, `memory_vec`, or `embedding_meta`. Even `scripts/seed-memory.sh` only deletes rows directly; every insert goes through the CLI.
- Never write rows with mismatched embedding hashes or manually edited vector state.
- `.agent/` is gitignored; do not commit `.agent/memory.db`, backups, or extracted artifacts.

## Current scope

Single-developer, single-product, no multi-agent runs. The memory layer is used as durable notes plus seed policies and decisions. Open formal `runs` / `tranches` only if the project grows into multi-agent delivery cycles.
