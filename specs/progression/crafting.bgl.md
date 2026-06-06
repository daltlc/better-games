---
id: crafting
title: Crafting System
version: 1.0.0
specFormatVersion: 1
category: progression
status: stable
tags: [crafting, recipes, items, progression]
dependsOn: [inventory]
requiredBy: []
variants: [instant, timed, station-based, skill-gated]
---

## Overview

A general-purpose crafting system that turns input items into output items according to **recipes**. It deliberately **reuses the `inventory` spec** for all storage: ingredients are consumed via `inventory.removeItem` and outputs are produced via `inventory.addItem`. Crafting itself owns only recipe definitions, eligibility checks, and the craft transaction.

The crafting system is **pure logic** — it computes whether a craft is possible and what should change, returns a typed result, and emits events. It does not render a crafting UI and does not store items itself.

**This spec does NOT cover:** the item storage model (that's `inventory`), gameplay effects of crafted items, or a tech/skill tree (only a simple optional skill gate is included).

## Agent Instructions

- **Do not reimplement storage.** Depend on an existing `inventory` implementation and call its `removeItem` / `addItem` / `hasItem` / `getTotalQuantity`. If the host has no inventory yet, implement `inventory` first.
- Every operation returns a typed `CraftResult` — never silently fail.
- Recipes are referenced by string `recipeId` into a **host-owned recipe registry**, mirroring how the inventory references item definitions. Crafting stores no recipe definitions itself.
- A craft must be **atomic**: validate all ingredients first, then consume and produce; if any step fails, roll back so the inventory is unchanged.
- **Ask the host for its recipe schema and skill model** before generating registry code; do not invent fields beyond the contract below.
- Generate unit tests from the Test Cases section unless the user opts out.

## Data Contracts

```
// Registry entry — read-only, owned by the host.
Recipe {
  id: string                       // unique, e.g. "iron_sword"
  inputs: Ingredient[]             // consumed on craft
  outputs: Output[]                // produced on craft
  station?: string                 // required station id (station-based variant)
  requiredSkill?: { skill: string, level: number }  // skill-gated variant
  craftTimeMs?: number             // > 0 for the timed variant; absent/0 = instant
  metadata?: Record<string, any>   // category, unlock conditions, etc.
}

Ingredient {
  definitionId: string             // an inventory item definition id
  quantity: number                 // > 0
}

Output {
  definitionId: string
  quantity: number                 // > 0
  instanceData?: Record<string, any>  // forwarded to inventory.addItem
}

CraftResult {
  success: boolean
  data?: { recipeId: string, produced: Output[], consumed: Ingredient[] }
  error?: CraftError
}

CraftError =
  | "RECIPE_NOT_FOUND"
  | "MISSING_INGREDIENTS"
  | "OUTPUT_DOES_NOT_FIT"     // inventory full / over weight for the result
  | "WRONG_STATION"
  | "SKILL_TOO_LOW"
  | "INVENTORY_LOCKED"
```

## Core Operations

### 1. Can Craft
**Signature:** `canCraft(inventory, recipeId, context?) -> CraftResult`
where `context { station?: string, skills?: Record<string, number> }`.

**Logic:**
1. Resolve the `Recipe`; if missing → `RECIPE_NOT_FOUND`.
2. If `inventory.locked` → `INVENTORY_LOCKED`.
3. If `recipe.station` is set and `context.station` differs → `WRONG_STATION`.
4. If `recipe.requiredSkill` is set and `context.skills[skill] < level` → `SKILL_TOO_LOW`.
5. For each input, check `inventory.getTotalQuantity(definitionId) >= quantity`; if any short → `MISSING_INGREDIENTS`.
6. Pre-check that all outputs would fit (simulate `inventory.addItem` without mutating); if not → `OUTPUT_DOES_NOT_FIT`.
7. Return success (a dry run — no mutation, no events).

### 2. Craft
**Signature:** `craft(inventory, recipeId, context?) -> CraftResult`

**Logic:**
1. Run `canCraft`; if it fails, return its error unchanged.
2. **Consume** inputs: for each ingredient, remove `quantity` across matching stacks via `inventory.removeItem` (oldest/lowest slot first).
3. **Produce** outputs: for each output, `inventory.addItem(definitionId, quantity, instanceData?)`.
4. If any step fails mid-way (should be prevented by step 1, but guard anyway), **roll back** all changes so the inventory is unchanged, and return the error.
5. Emit `CRAFT_COMPLETED` with the consumed/produced lists.
6. Return success with `produced` and `consumed`.

**Edge Cases:**
- Ingredient spread across multiple stacks → consume across stacks until satisfied.
- Output that partially fits → treat as `OUTPUT_DOES_NOT_FIT` and roll back (no half-crafts).
- For the **timed** variant, `craft` starts the job and emits `CRAFT_STARTED`; consumption happens at start, production at completion. A cancel before completion refunds consumed inputs.

### 3. Query
- `getRecipe(recipeId) -> Recipe | null`
- `getCraftableRecipes(inventory, context?) -> Recipe[]`  // all recipes whose `canCraft` succeeds
- `getMissingIngredients(inventory, recipeId) -> Ingredient[]`  // shortfall per input

## Events

| Event | Payload |
|---|---|
| `CRAFT_STARTED` | `{ inventory, recipeId, consumed }` (timed variant) |
| `CRAFT_COMPLETED` | `{ inventory, recipeId, produced, consumed }` |
| `CRAFT_FAILED` | `{ inventory, recipeId, error }` |
| `CRAFT_CANCELLED` | `{ inventory, recipeId, refunded }` (timed variant) |

## Variants

| Variant | Description |
|---|---|
| `instant` | `craft` consumes and produces in one call (default; `craftTimeMs` absent/0). |
| `timed` | Craft takes `craftTimeMs`; consume at start, produce on completion, refund on cancel. |
| `station-based` | Recipe requires a matching `station` in `context` (forge, workbench). |
| `skill-gated` | Recipe requires `context.skills[skill] >= level`. |

## Integration Hooks

The host provides:

- **Inventory** — a working implementation of the `inventory` spec; crafting calls its operations.
- **Recipe Registry** — `recipeId -> Recipe` lookup. Crafting does not own recipe definitions.
- **Event Bus** — same mechanism the inventory uses; crafting adapts to it.
- **Skill/Stat source** (optional) — supplies `context.skills` for skill-gated recipes.
- **Timer/scheduler** (timed variant) — drives completion of in-progress crafts.

## Persistence

Instant crafting is stateless — there is nothing to persist beyond the inventory itself. Only the **timed** variant has state worth saving:

```
SerializedCraftQueue {
  version: number
  ownerId: string
  jobs: { recipeId: string, startedAt: number, completesAt: number, consumed: Ingredient[] }[]
}
```

Provide `migrateCraftQueue(serialized, fromVersion, toVersion)`. On load, resolve any jobs whose `completesAt` has already passed (produce their outputs) and resume the rest. Persist via the host's `save-system`.

## Test Cases

- `canCraft` with all ingredients present → success, no mutation.
- `canCraft` missing an ingredient → `MISSING_INGREDIENTS`, no mutation.
- `craft` success → inputs removed, outputs added, `CRAFT_COMPLETED` emitted.
- `craft` with ingredient spread across multiple stacks → consumed correctly across stacks.
- `craft` with a full inventory for the output → `OUTPUT_DOES_NOT_FIT`, inventory unchanged.
- `craft` at the wrong station → `WRONG_STATION`.
- `craft` with insufficient skill → `SKILL_TOO_LOW`.
- `craft` on a locked inventory → `INVENTORY_LOCKED`.
- Unknown recipe id → `RECIPE_NOT_FOUND`.
- Timed craft started then cancelled → consumed inputs refunded, `CRAFT_CANCELLED` emitted.
- `getCraftableRecipes` returns exactly the recipes whose `canCraft` succeeds.

## Known Limitations & Notes

- All storage behavior is defined by `inventory`; this spec only orchestrates recipes. Bugs in stacking/weight belong there, not here.
- No tech tree / recipe unlocking flow beyond the optional `requiredSkill` gate; a future `progression` spec can own unlocks.
- Economy (buying recipes/ingredients) is out of scope — see a future `shop` spec.
- Crafted-item gameplay effects are the host's concern, mirroring how `inventory` defers `ITEM_USED` effects.
