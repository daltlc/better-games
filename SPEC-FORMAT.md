# SPEC-FORMAT.md — The GFS Meta-Spec

This document defines the format every GameSpec (`*.gfs.md`) file must follow. The tooling in `tools/` enforces it mechanically (`npm run validate`). If you change this format, bump `specFormatVersion` and update `tools/validate.mjs` to match.

A GameSpec is a **pure, engine- and language-agnostic design** for one game feature. It tells an implementer *what* to build and *how it must behave* — never *which language or engine* to build it in.

---

## File location & naming

- Specs live under `specs/<category>/<id>.gfs.md`.
- The filename stem **must equal** the frontmatter `id` (e.g. `inventory.gfs.md` → `id: inventory`).
- `id` is **kebab-case**, lowercase, unique across the library.

---

## Frontmatter (required)

Every spec starts with a YAML frontmatter block delimited by `---`. All keys below are required unless marked optional. The parser supports a constrained subset: scalar strings/numbers and inline string arrays (`[a, b, c]`).

```yaml
---
id: inventory                 # kebab-case, unique, MUST equal filename stem
title: Inventory System       # human-readable display name
version: 1.0.0                 # SemVer for THIS spec's contracts
specFormatVersion: 1          # version of this meta-format the spec targets
category: core-systems        # MUST equal the parent folder name under specs/
status: stable                # one of: draft | stable | deprecated
tags: [inventory, items, storage, stacking, persistence]
dependsOn: []                 # spec ids this one builds on (reciprocal with requiredBy)
requiredBy: [crafting]        # spec ids that build on this one (reciprocal with dependsOn)
variants: [slot-based, grid-based, weight-based, unlimited, multi-bag]
---
```

### Field rules

| Field | Rule |
|---|---|
| `id` | kebab-case; equals filename stem; unique. |
| `title` | non-empty string. |
| `version` | valid SemVer `MAJOR.MINOR.PATCH`. |
| `specFormatVersion` | integer; current format version is `1`. |
| `category` | equals the parent directory under `specs/`. |
| `status` | `draft`, `stable`, or `deprecated`. |
| `tags` | non-empty array of kebab-case strings. |
| `dependsOn` | array of existing spec ids. Every id here must list this spec in *its* `requiredBy` (reciprocity). |
| `requiredBy` | array of existing spec ids. Every id here must list this spec in *its* `dependsOn` (reciprocity). |
| `variants` | array of strings (may be empty if the feature has no variants). |

**Reciprocity:** the dependency graph must be consistent in both directions. If `crafting.dependsOn` includes `inventory`, then `inventory.requiredBy` must include `crafting`. The validator fails otherwise. *Soft* references (mentioning another spec in prose without a hard build dependency) do **not** go in these arrays — put them in **Known Limitations & Notes** instead.

---

## Required body sections

Immediately after the frontmatter, the body must contain these `##` headings, **in this order**. The validator checks presence; authors are responsible for quality.

1. **`## Overview`** — what the feature is and, explicitly, what it does **not** do.
2. **`## Agent Instructions`** — directives for an AI implementing the spec (pure logic, typed results, ask the host for its schema, per-stack idioms). Written so a human can skim it too.
3. **`## Data Contracts`** — language-neutral type definitions (use a fenced pseudo-type block, not a real language).
4. **`## Core Operations`** — each operation with a pseudocode **signature**, numbered **logic** steps, and **edge cases**.
5. **`## Events`** — events the feature emits and their payloads, delivered through the host's event system (adapter, not imposed).
6. **`## Variants`** — the supported layout/behavior variants and how each changes the rules.
7. **`## Integration Hooks`** — what the spec expects the host project to provide (item registry, persistence, event bus, UI).
8. **`## Persistence`** — a JSON-safe serialization shape plus migration guidance (version field + `migrate…` stub).
9. **`## Test Cases`** — concrete, verifiable cases any correct implementation must pass.
10. **`## Known Limitations & Notes`** — boundaries and **soft** cross-references to sibling specs by id.

---

## Authoring conventions (every spec follows these)

- **Pure logic.** No UI/DOM/scene-graph mutation. Operations return data or emit events; the host renders.
- **Typed results, never silent failure.** Operations return a result object carrying success/failure + a reason code.
- **String-id references.** Items/recipes/etc. are referenced by string id into a **host-owned registry**. The spec stores *instances*, not *definitions*.
- **Prefer immutability.** Return new state rather than mutating in place, unless the target runtime makes that impractical (GDScript/Lua) — say so when relevant.
- **Adapter, don't impose.** Events, persistence, and registries are host-provided seams. The spec adapts to them.
- **Generate tests.** Implementers should produce tests from the Test Cases section unless the user opts out.
- **Pseudocode only.** Never write spec logic in a specific real language. Use neutral pseudo-types and pseudo-signatures so the spec ports anywhere.

---

## Validation

Run `npm run validate` (in `tools/`) before committing. It checks frontmatter keys/types, `id`==filename, SemVer, category==folder, presence and order of required sections, that every `dependsOn`/`requiredBy` id exists, and reciprocity of the dependency graph. See `tools/validate.mjs`.

To start a new spec, copy `TEMPLATE.gfs.md`.
