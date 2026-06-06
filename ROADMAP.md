# Roadmap

Forward-looking work for the Better Games Library. Two tracks: **content** (more specs) and **engineering** (the tooling that supports them). Tool-agnostic — no infrastructure/CI-CD assumptions.

## Content — upcoming specs

Planned, roughly in dependency order:

- `equipment` — equip/unequip slots; `dependsOn: inventory`.
- `loot` — drops & chest looting via `inventory.transferItem`; `dependsOn: inventory`.
- `shop` — buying/selling, currency; `dependsOn: inventory`.
- `quests` — objectives, state, rewards.
- `dialogue` — branching conversation trees.
- `health-combat` — health, damage, the `EffectsSystem` that consumes `ITEM_USED`.
- `progression` — XP, levels, and recipe/skill unlocks that gate `crafting`.

Each new spec must keep the dependency graph reciprocal and ship Test Cases.

## Engineering — code improvements

These apply to the `tools/` codebase as it grows.

- **DRY / modularity:** parsing and rule constants already live once in `frontmatter.mjs` / `constants.mjs`. Keep new tooling importing them rather than re-deriving.
- **Tests:** unit + integration suites exist (`node --test`), including a "every shipped spec validates" meta-test. Add a shared fixtures module if test setup starts repeating.
- **Naming / hygiene / consistency:** kebab-case `id` == filename is enforced; keep validator error messages in one consistent shape.
- **Caching / performance:** `build-registry.mjs` already skips writing when content is unchanged. If the library grows large, add an mtime/hash-keyed incremental parse so unchanged specs are not re-read.
- **Security:** file reads are constrained to the repo root (no path traversal) and frontmatter is parsed, never `eval`'d. Maintain this in any new tool.
- **Architecture:** treat `registry.json` as the stable seam for a future fetch/install CLI. Consider publishing a JSON Schema for both the frontmatter and `registry.json`.

## Explicitly N/A for this repo (recorded, not invented)

The standards in `AGENTS.md` mention database schema, ClickHouse-vs-MySQL, and image caching. This project is **static markdown + a zero-dependency Node toolchain** — there is no database, server, or image layer, so those items do not apply. They are listed here only so the standard is acknowledged rather than silently skipped. The relevant analogues (registry caching, incremental rebuilds, schema validation) are covered above.
