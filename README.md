# GameSpec Library

A library of game feature specs that any developer, in any engine, can just use.

Most reusable game systems are locked to one engine. A Unity asset won't move to Godot. A Roblox module won't move to a web game. This library is the opposite. Each feature is a **spec**, not code. Read the spec, implement it in your stack. The hard stuff (edge cases, physics research, test cases, data contracts) is already done.

Think of it like a package registry where the packages are design docs instead of code you import.

---

## Live demo

The turbo boost gauge spec ships with an interactive demo. Try it here: **[gamespec-library demo](https://daltoncarr.github.io/gamespec-library)**

It simulates a real Nissan Z (RZ34) VR30DDTT boost gauge with physics validated against an actual car. You can switch car configs in the dropdown and feel the difference between the twin-turbo Z and a single-turbo WRX STI.

![Turbo Boost Gauge Demo](docs/preview.png)

---

## Catalog

| Spec | Category | Status |
|---|---|---|
| [`inventory`](specs/core-systems/inventory.gfs.md) | core-systems | stable |
| [`crafting`](specs/progression/crafting.gfs.md) | progression | stable |
| [`save-system`](specs/core-systems/save-system.gfs.md) | core-systems | stable |
| [`turbo-boost-gauge`](specs/vehicle-systems/turbo-boost-gauge.gfs.md) | vehicle-systems | draft |

Machine-readable version: [`registry.json`](registry.json)

Roadmap: `equipment`, `loot`, `shop`, `quests`, `dialogue`, `health-combat`, `vehicle-engine`. See [`ROADMAP.md`](ROADMAP.md).

---

## How to use a spec

### As a developer

1. Find the spec you want in the catalog above.
2. Read **Overview, Data Contracts, and Core Operations** like a design doc.
3. Implement it in your engine. Use the **Test Cases** section as your checklist.
4. If the spec has a `dependsOn` list, implement those first.

### With an AI agent

Paste the spec into your prompt and tell the agent what engine you're using:

> Implement the feature in `specs/vehicle-systems/turbo-boost-gauge.gfs.md` for my project. It uses **[your engine / language]**. Follow the Agent Instructions section. Generate unit tests from the Test Cases section.

More prompt patterns in [`examples/USAGE.md`](examples/USAGE.md). The interactive demo lives at [`docs/index.html`](docs/index.html).

---

## Car configs (vehicle-systems specs)

Vehicle specs separate the simulation logic from the car data. Each car has its own `.ini` file in `data/cars/` with the physics constants for that platform. Same format as Assetto Corsa and rFactor, so if you know how to mod those games this will feel familiar.

```
data/cars/nissan-z-vr30ddtt.ini       # Garrett twin-turbo, electronic wastegates, no BOV
data/cars/subaru-wrx-sti-ej257.ini    # Mitsubishi single-turbo, pneumatic WG, atmospheric BOV
```

To add a new car, drop a new `.ini` in `data/cars/` following the same section structure. The comments in the existing files explain what each constant does and where it came from.

---

## Tooling

```sh
cd tools
npm test          # run unit + integration tests
npm run validate  # lint every spec
npm run build     # regenerate registry.json
```

Zero runtime dependencies. No `npm install` needed.

---

## Repo layout

```
specs/           # feature specs grouped by category
data/cars/       # per-car INI configs for vehicle-systems specs
docs/            # GitHub Pages (index.html is the live demo)
examples/        # prompt patterns for AI agents
tools/           # validator, registry builder, tests
SPEC-FORMAT.md   # the meta-spec every .gfs.md conforms to
TEMPLATE.gfs.md  # copy this to start a new spec
registry.json    # generated catalog, do not hand-edit
```

---

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md) and [`AGENTS.md`](AGENTS.md) for standards.

MIT License. See [`LICENSE`](LICENSE).
