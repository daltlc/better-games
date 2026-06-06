# Contributing

Thanks for adding to the Better Games Library. Specs are the product — keep them rigorous, portable, and consistent. All work follows the standards in [`AGENTS.md`](AGENTS.md).

## Add or change a spec

1. **Start from the template.** Copy `TEMPLATE.bgl.md` to `specs/<category>/<id>.bgl.md`. The filename stem must equal the frontmatter `id` (kebab-case).
2. **Fill the frontmatter** per [`SPEC-FORMAT.md`](SPEC-FORMAT.md). Declare dependencies with `dependsOn`; they must be **reciprocal** (the other spec lists you in `requiredBy`).
3. **Write all ten required sections**, in order. Keep logic in **neutral pseudocode** — never a specific real language.
4. **Reuse, don't duplicate.** If your feature needs storage, depend on `inventory` and call its operations; don't redefine them. Soft references (mentioned in prose, not a build dependency) go in **Known Limitations & Notes**, not in `dependsOn`.
5. **Validate, test, and build:**
   ```sh
   cd tools
   npm test
   npm run validate
   npm run build      # regenerates ../registry.json
   ```
6. **Update docs in the same change:** the README catalog table, `CHANGELOG.md`, and the regenerated `registry.json`. A change that updates behavior but not its docs is incomplete.

## Versioning

- Bump a spec's `version` (SemVer) when its contracts change: PATCH for clarifications, MINOR for additive operations/fields, MAJOR for breaking contract changes.
- Bump `specFormatVersion` only when the **meta-format itself** changes — and then update `SPEC-FORMAT.md` and `tools/` together.

## Changelog & commits

- Record every notable change in `CHANGELOG.md` under `## [Unreleased]`, grouped Added / Changed / Fixed / Removed ([Keep a Changelog](https://keepachangelog.com/en/1.0.0/)).
- Use [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`. Example: `feat(spec): add loot spec depending on inventory`.

## Tooling changes

The validator/builder are zero-dependency Node ESM. Shared logic lives in `tools/frontmatter.mjs` and `tools/constants.mjs` — import them rather than duplicating. Any tooling change ships with `node:test` coverage and keeps file reads constrained to the repo root.
