# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
See [Conventional Commits](https://www.conventionalcommits.org/) for commit guidelines.

## [Unreleased]

### Added
- `turbo-boost-gauge` spec (vehicle-systems, draft): physics-accurate turbo boost gauge simulation modeled on the Nissan Z VR30DDTT (Garrett MGT14446LKSZ twin-turbos). Covers four operating phases (VACUUM, SPOOLING, BOOSTING, DROPPING), multiplicative exhaust-energy model (RPM × throttle), asymmetric first-order RC filter with energy-scaled spool tau, electronic wastegate high-RPM taper above 5,000 RPM, and overshoot spike. No BOV — recirculation valve modeled. Data sources: STILLEN VR30 turbo analysis, EcuTek boost control docs, NissanZClub owner logs. Includes `nissan-z-vr30ddtt`, `generic-twin-scroll`, and `single-turbo` variants.
- `examples/turbo-gauge-demo.html`: interactive single-file HTML demo with INI-driven car configs and car-switcher dropdown. Includes INI parser and `iniToCfg` mapper. Boots from `nissan-z-vr30ddtt`, switchable to `subaru-wrx-sti-ej257` live with full state/gauge reset.
- `data/cars/nissan-z-vr30ddtt.ini`: per-car turbo config for the RZ34 Z. Mirrors format used by Assetto Corsa and other sim titles — human-editable, section-based, semicolon comments.
- `data/cars/subaru-wrx-sti-ej257.ini`: second reference car (single large turbo, atmospheric BOV, pneumatic wastegate). Demonstrates different lag profile, lower MIN_THROTTLE, and bigger overshoot spike vs the twin-turbo Z.

## [0.1.0] - 2026-06-05

### Added
- Project foundation: `README.md`, `AGENTS.md` (engineering standards) + `CLAUDE.md` pointer, `CONTRIBUTING.md`, `LICENSE` (MIT), `ROADMAP.md`.
- `SPEC-FORMAT.md` — the BGL meta-spec (frontmatter schema, required sections, authoring conventions) — and `TEMPLATE.bgl.md`.
- Three seed specs forming a real dependency graph:
  - `inventory` (core-systems, root, required by `crafting`).
  - `crafting` (progression, depends on `inventory`, reuses its operations).
  - `save-system` (core-systems, generic participant-based persistence).
- Zero-dependency Node tooling in `tools/`: shared `frontmatter.mjs` parser and `constants.mjs`, `validate.mjs` (format + dependency-graph linter), `build-registry.mjs` (generates `registry.json` with skip-write caching), and `node:test` suites.
- `examples/USAGE.md` — prompt patterns for consuming specs with AI agents.

[Unreleased]: https://example.com/compare/v0.1.0...HEAD
[0.1.0]: https://example.com/releases/v0.1.0
