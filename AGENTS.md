# AGENTS.md

Canonical engineering standards and project conventions for **GameSpec Library (GFS)**.
This file governs **all contributors** — human or AI. `CLAUDE.md` simply points here.

---

## What this project is

A curated, versioned library of **engine-agnostic, language-agnostic game feature specifications** (`*.gfs.md`). Each spec is precise enough that any AI agent, model, or human can read it and implement that feature in their own stack (Unity/C#, Godot/GDScript, TS/React, Roblox/Lua, …). Specs are **pure design** — no shipped implementation code.

---

## Full stack

This project intentionally has a tiny stack. Documented here and in `README.md`:

| Layer | What | Where |
|---|---|---|
| **Content** | Markdown feature specs + docs, authored to `SPEC-FORMAT.md` | `specs/**/*.gfs.md` |
| **Schema / contract** | YAML frontmatter per spec → generated catalog | spec frontmatter → `registry.json` |
| **Tooling** | Node.js (ESM, **zero runtime deps**): shared parser, validator, registry builder | `tools/` |
| **Tests** | Node's built-in `node:test` + `node:assert` (zero-dep) | `tools/*.test.mjs` |
| **Consumer** | Humans (design doc) + AI agents (prompt patterns) | `examples/USAGE.md` |

There is **no database, server, frontend, or image layer**. Items that assume one (DB schema, ClickHouse-vs-MySQL, image caching) are **N/A** here — see `ROADMAP.md` where this is recorded rather than fabricated.

---

## Standing rule — keep everything in sync

> Whenever a feature is **added or modified**, update *in the same change*:
> 1. Code comments
> 2. Documentation & READMEs
> 3. The config/catalog surface (`registry.json` via `npm run build`, plus the README catalog table)
> 4. `CHANGELOG.md`

Docs and the changelog are **never** a follow-up task. A change that touches behavior but not its docs is incomplete.

---

## Versioning & history

- **SemVer** for the repo and for each spec's `version` frontmatter.
- `CHANGELOG.md` follows **[Keep a Changelog](https://keepachangelog.com/en/1.0.0/)** — an `## [Unreleased]` section plus dated releases, grouped Added / Changed / Fixed / Removed.
- Commits follow **[Conventional Commits](https://www.conventionalcommits.org/)**: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`.
- Bump a spec's `version` when its contracts change; bump `specFormatVersion` only when the meta-format itself changes.

---

## Code quality bar (applies to everything generated)

- **DRY:** shared logic lives in exactly one place. `tools/frontmatter.mjs` is the single parser imported by the validator, the builder, and the tests — never copy-paste parsing.
- **Modular & maintainable:** small focused modules, named constants over magic strings, clear boundaries.
- **Production-ready:** prefer clarity and stability over cleverness. Spending extra effort/tokens on robustness is an accepted tradeoff.
- **Every new chunk of code ships with:** tests, consistent naming, input validation, and deliberate attention to caching, performance, and security where applicable.
- **Self-contained only:** improvements stay inside the codebase — **no infrastructure assumptions, no CI/CD, no deployment config.** Exception: data/performance choices justified by real usage patterns (e.g. ClickHouse over MySQL, image caching) are allowed when they materially help — none currently apply here.

### Security & robustness specifics for the tooling
- File reads resolve **within the repo root only** (no path traversal).
- Never `eval` or execute frontmatter content; parse and type-check before use.
- Validator fails loud (non-zero exit) with a clear per-file message; nothing silently passes.

---

## Definition of done for a spec

A `*.gfs.md` is done when it: has complete, well-typed frontmatter; contains all required sections (see `SPEC-FORMAT.md`); declares reciprocal `dependsOn`/`requiredBy` edges; passes `npm run validate`; is included in a regenerated `registry.json`; and is recorded in `CHANGELOG.md`.

---

## Definition of done for tooling

Code is done when it: reuses shared modules (no duplication); has passing `node --test` coverage; validates inputs; reads files safely; and its behavior is reflected in `README.md` / `CONTRIBUTING.md` / `CHANGELOG.md`.
