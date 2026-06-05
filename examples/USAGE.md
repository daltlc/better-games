# Using GameSpecs

A GameSpec is a portable design. Here is how to turn one into a working implementation — by hand or with an AI agent.

## The general prompt pattern

Give your agent the spec file plus your stack and constraints:

> Implement the feature described in `<path-to-spec>.gfs.md` for my project.
> - Stack: **<engine / language>**.
> - Follow the spec's **Agent Instructions** section exactly.
> - Treat the **Data Contracts** as the source of truth; do not invent fields.
> - Before generating any registry code, **ask me for my item/recipe schema**.
> - Generate unit tests from the **Test Cases** section.
> - Implement anything listed in `dependsOn` first (or tell me if it already exists).

Keep the inventory pure logic — it should return results and emit events, never touch your UI directly.

## Per-stack idioms

The specs are engine-agnostic, but here is how each typically lands:

| Stack | Shape |
|---|---|
| **TypeScript / React** | A reducer + a `useInventory()` hook; events via an `EventEmitter` or context callback. |
| **Unity / C#** | A `ScriptableObject` item registry + a `MonoBehaviour` inventory component exposing C# `event`s. |
| **Godot / GDScript** | An `Autoload` singleton emitting `signal`s; item definitions as `Resource`s. |
| **Roblox / Lua** | A `ModuleScript` holding state with `BindableEvent`s for the event bus. |

## Worked example — inventory in Godot

> Implement `specs/core-systems/inventory.gfs.md` for my Godot 4 / GDScript project.
> Use the `slot-based` variant with `maxSlots = 30` and `maxWeight = 0` (no weight limit).
> Make it an Autoload singleton named `Inventory` that emits signals matching the spec's Events table (`item_added`, `item_removed`, …). Item definitions are `Resource` files in `res://items/`; I'll give you the fields. Generate GUT tests from the Test Cases section.

A correct result will:
- Store `ItemInstance`s (not definitions) keyed by a generated `instanceId`.
- Return a result object (`{ success, data, error }`) from `add_item` / `remove_item` / etc. — never silently fail.
- Emit the spec's signals on every state change.
- Recompute `current_weight` on load rather than trusting the saved value.
- Pass every case in the spec's **Test Cases** section.

## Composing specs

Specs reuse each other. To build crafting:

1. Implement `inventory` first (it's `crafting`'s only `dependsOn`).
2. Implement `crafting` so `craft()` consumes ingredients via `inventory.remove_item` and produces output via `inventory.add_item` — do **not** reimplement storage.
3. To persist either, implement `save-system` and register your inventory as a `SaveParticipant` (its `SerializedInventory` + `migrateInventory` map onto `serialize` / `deserialize` / `migrate`).

## Verifying an implementation

The **Test Cases** section of each spec is the acceptance checklist. Ask your agent to generate tests from it, run them, and only consider the feature done when they pass — exactly as a human implementer would.
