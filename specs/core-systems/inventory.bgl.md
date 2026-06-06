---
id: inventory
title: Inventory System
version: 1.0.0
specFormatVersion: 1
category: core-systems
status: stable
tags: [inventory, items, storage, stacking, persistence]
dependsOn: []
requiredBy: [crafting]
variants: [slot-based, grid-based, weight-based, unlimited, multi-bag]
---

## Overview

A general-purpose inventory system for managing a collection of items belonging to an owner (player, chest, NPC, vendor). It supports slot-based or weight-based storage, item stacking, per-instance metadata, and event emission for every state change.

The inventory is **pure logic**. It does not render anything, does not know about your engine's scene graph, and does not own item definitions or save files. It exposes operations that return typed results and emit events; the host application renders and persists.

**This spec does NOT cover:** equipment slots (equip/unequip), crafting (see `crafting`), economy/shops beyond an optional `gold` field, or hotbar key-binding (a UI concern).

## Agent Instructions

> Read this before implementing.

- Implement the inventory as **pure logic** with no UI assumptions. Emit events or return result objects — never mutate DOM or engine scene nodes directly.
- Prefer **immutability**: return new state objects rather than mutating in place, unless the target runtime makes that impractical (GDScript, Lua) — in which case mutate but keep operations atomic.
- Every operation returns a **typed `OperationResult`** — success/failure plus a reason. Never silently fail.
- All item references use a **string `definitionId`** (e.g. `"iron_sword"`) into a host-owned **item registry**. The inventory stores `ItemInstance`s, not `ItemDefinition`s.
- **Ask the host for its item-definition schema** before generating registry code. Do not invent item fields beyond the contract below.
- Per-stack idioms: TypeScript/React → a `useInventory` hook over a reducer; Unity C# → a `ScriptableObject` registry + a `MonoBehaviour` inventory component with C# events; Godot → an `Autoload` singleton emitting signals; Roblox/Lua → a `ModuleScript` with `BindableEvent`s.
- Generate **unit tests** from the Test Cases section unless the user opts out.

## Data Contracts

```
// Registry entry — read-only, owned by the host.
ItemDefinition {
  id: string                       // unique key, e.g. "health_potion"
  name: string                     // display name
  description: string
  icon: string                     // asset path or key
  maxStackSize: number             // 1 = non-stackable
  weight: number                   // per unit; 0 = weightless
  tags: string[]                   // e.g. ["consumable", "potion", "quest"]
  metadata?: Record<string, any>   // extensible: damage, rarity, durability, ...
}

// Inventory entry — one stack or one unique item.
ItemInstance {
  instanceId: string               // unique per instance (UUID)
  definitionId: string             // points to an ItemDefinition
  quantity: number                 // >= 1
  slotIndex?: number               // present in slot/grid layouts
  instanceData?: Record<string, any> // per-instance overrides: durability, enchantments
}

InventoryState {
  ownerId: string                  // player / chest / NPC id
  slots: ItemInstance[]            // ordered, sparse allowed
  maxSlots: number                 // 0 = unlimited
  maxWeight: number                // 0 = no weight limit
  currentWeight: number            // computed from contents, not authoritative storage
  gold?: number                    // optional currency field
  locked: boolean                  // when true, reject all mutations
}

OperationResult<T> {
  success: boolean
  data?: T
  error?: InventoryError
}

InventoryError =
  | "INVENTORY_FULL"
  | "ITEM_NOT_FOUND"
  | "INSUFFICIENT_QUANTITY"
  | "STACK_LIMIT_EXCEEDED"
  | "WEIGHT_LIMIT_EXCEEDED"
  | "SLOT_OCCUPIED"
  | "INVENTORY_LOCKED"
  | "INVALID_QUANTITY"
```

## Core Operations

### 1. Add Item
**Signature:** `addItem(inventory, definitionId, quantity, instanceData?) -> OperationResult<AddResult>`
where `AddResult { instances: ItemInstance[], quantityAdded: number, quantityRejected: number }`.

**Logic:**
1. If `inventory.locked` → `INVENTORY_LOCKED`.
2. If `quantity <= 0` → `INVALID_QUANTITY`.
3. Look up the `ItemDefinition`; if missing → `ITEM_NOT_FOUND`.
4. If `maxWeight > 0`, compute how many units fit by weight: `fit = floor((maxWeight - currentWeight) / weight)` (weight 0 ⇒ unlimited by weight).
5. If `instanceData` is provided, treat as **non-stackable** (a unique instance) regardless of `maxStackSize`.
6. If stackable (`maxStackSize > 1`): fill existing same-`definitionId` stacks up to `maxStackSize`, then create new stacks for overflow.
7. If non-stackable (`maxStackSize == 1`): one slot with a fresh `instanceId` per unit.
8. When creating slots, if `maxSlots > 0` and no free slot remains → stop; remaining units are rejected.
9. Assign each new instance the first free `slotIndex`.
10. Recompute `currentWeight`; emit `ITEM_ADDED` (and `WEIGHT_CHANGED` if it changed). If nothing fit at all, additionally emit `INVENTORY_FULL`.
11. Return success with `quantityAdded` and `quantityRejected`.

**Edge Cases:**
- Partial add (weight/slots): add what fits, report `quantityRejected`. **Never silently drop items.** This is still `success: true` with a non-zero `quantityRejected`; callers inspect it.
- Zero units fit due to weight → `WEIGHT_LIMIT_EXCEEDED`; zero fit due to slots → `INVENTORY_FULL`.

### 2. Remove Item
**Signature:** `removeItem(inventory, instanceId, quantity) -> OperationResult<void>`

**Logic:**
1. If `inventory.locked` → `INVENTORY_LOCKED`.
2. If `quantity <= 0` → `INVALID_QUANTITY`.
3. Find the `ItemInstance`; if missing → `ITEM_NOT_FOUND`.
4. If `quantity > instance.quantity` → `INSUFFICIENT_QUANTITY`.
5. If `quantity == instance.quantity`: remove the slot entirely. Else: decrement `quantity`.
6. Recompute `currentWeight`; emit `ITEM_REMOVED` (and `WEIGHT_CHANGED` if changed).

### 3. Move Item (within an inventory)
**Signature:** `moveItem(inventory, instanceId, targetSlotIndex) -> OperationResult<void>`

**Logic:**
1. If `inventory.locked` → `INVENTORY_LOCKED`.
2. Find the source instance; if missing → `ITEM_NOT_FOUND`.
3. If `targetSlotIndex` is empty: move the instance there.
4. If occupied by the **same** `definitionId` and stackable: merge up to `maxStackSize`, leaving overflow in the source slot.
5. If occupied by a **different** item: swap the two slots.
6. Emit `ITEM_MOVED` with `{ fromSlot, toSlot }`.

### 4. Transfer Item (between inventories)
**Signature:** `transferItem(source, target, instanceId, quantity) -> OperationResult<void>`

**Logic:**
1. If either inventory is `locked` → `INVENTORY_LOCKED`.
2. **Pre-check** that `removeItem(source, …)` would succeed (do not mutate yet).
3. **Pre-check** that `addItem(target, …)` would succeed for the full `quantity` (no partial — transfers are all-or-nothing unless the host opts into partial).
4. Execute both **atomically**; if either fails, roll back so the source is unchanged.
5. Emit `ITEM_TRANSFERRED` on both inventories.

### 5. Use Item
**Signature:** `useItem(inventory, instanceId) -> OperationResult<UsePayload>`
where `UsePayload { instance: ItemInstance, definition: ItemDefinition }`.

**Logic:**
1. Resolve instance + definition; if missing → `ITEM_NOT_FOUND`.
2. Return the `UsePayload`. **Do not apply gameplay effects** — the host handles healing/equipping/etc.
3. If the definition's `tags` include `"consumable"`, call `removeItem(…, 1)` after building the payload.
4. Emit `ITEM_USED`.

> The inventory never implements game effects (healing, damage, buffs). Those belong in a separate `EffectsSystem` / `PlayerStats` module that listens for `ITEM_USED`.

### 6. Query
- `getItemByInstanceId(inventory, instanceId) -> ItemInstance | null`
- `getItemsByDefinitionId(inventory, definitionId) -> ItemInstance[]`
- `getItemsByTag(inventory, tag) -> ItemInstance[]`
- `getTotalQuantity(inventory, definitionId) -> number`
- `hasItem(inventory, definitionId, quantity?) -> boolean`
- `isEmpty(inventory) -> boolean`
- `isFull(inventory) -> boolean`

### 7. Sort Inventory
**Signature:** `sortInventory(inventory, strategy) -> OperationResult<InventoryState>`
**Strategies:** `"by-name" | "by-type" | "by-rarity" | "by-quantity" | "custom"`.
Returns a **new** `InventoryState` with reordered slots; does not mutate the original. Sort must be deterministic (stable tie-break by `definitionId` then `instanceId`).

## Events

Delivered through the host's event system (EventEmitter, C# events, Godot signals, Roblox `BindableEvent`).

| Event | Payload |
|---|---|
| `ITEM_ADDED` | `{ inventory, instances, quantityAdded }` |
| `ITEM_REMOVED` | `{ inventory, instanceId, quantityRemoved }` |
| `ITEM_MOVED` | `{ inventory, instanceId, fromSlot, toSlot }` |
| `ITEM_TRANSFERRED` | `{ sourceInventory, targetInventory, instanceId, quantity }` |
| `ITEM_USED` | `{ inventory, instance, definition }` |
| `INVENTORY_FULL` | `{ inventory }` |
| `INVENTORY_CLEARED` | `{ inventory }` |
| `WEIGHT_CHANGED` | `{ inventory, previousWeight, currentWeight }` |

## Variants

| Variant | Description |
|---|---|
| `slot-based` | Fixed number of indexed/named slots (default). |
| `grid-based` | 2D grid; items occupy multiple cells (Diablo / Resident Evil). `slotIndex` becomes an `(x, y, w, h)` placement; add/move must check footprint fit. |
| `weight-based` | No slot limit; capped by `maxWeight` only (Skyrim). Set `maxSlots = 0`. |
| `unlimited` | No slot and no weight limit (casual/mobile). `maxSlots = 0`, `maxWeight = 0`. |
| `multi-bag` | Inventory holds sub-containers (bags/pouches), each its own `InventoryState`; operations route to the active bag. |

## Integration Hooks

The host provides:

- **Item Registry** — `definitionId -> ItemDefinition` lookup. The inventory does not own definitions.
- **Persistence Layer** — serializes/deserializes `InventoryState` (see Persistence; pairs with the `save-system` spec).
- **Event Bus** — the inventory adapts to the host's event mechanism; it does not impose one.
- **UI Layer** — subscribes to events and re-renders. The inventory never calls UI directly.
- **ID generator** — a UUID source for new `instanceId`s.

## Persistence

`currentWeight` is recomputed on load, never trusted from disk.

```
SerializedInventory {
  version: number                  // schema version, for migration
  ownerId: string
  slots: SerializedItemInstance[]
  maxSlots: number
  maxWeight: number
  gold?: number
  locked: boolean
}
```

Provide `migrateInventory(serialized, fromVersion, toVersion) -> SerializedInventory`. On load, compare `serialized.version` to the current schema version; if older, run migration; if newer, warn and refuse rather than corrupt data. Hand the result to the `save-system` for actual read/write.

## Test Cases

- Add item to empty inventory → success.
- Add item exceeding slot limit → partial add reported, or `INVENTORY_FULL` when zero fit.
- Add item exceeding weight limit → partial add reported, or `WEIGHT_LIMIT_EXCEEDED` when zero fit.
- Add stackable item onto an existing matching stack → quantity increments, no new slot.
- Add stackable item past `maxStackSize` → splits into a new slot.
- Add with `instanceData` → forced unique instance even if stackable.
- Remove exact quantity → slot removed.
- Remove less than quantity → quantity decremented.
- Remove more than available → `INSUFFICIENT_QUANTITY`.
- Move to empty slot → success.
- Move stackable onto same item → merge respecting `maxStackSize`.
- Move onto a different item → swap.
- Transfer between two inventories → atomic; both update.
- Transfer failing on a full target → source unchanged.
- Use consumable → quantity decremented, `UsePayload` returned, `ITEM_USED` emitted.
- Locked inventory rejects every mutation with `INVENTORY_LOCKED`.
- Sort by name → deterministic order.
- Serialize → deserialize → state identical (with `currentWeight` recomputed).

## Known Limitations & Notes

- Equipment slots (equip/unequip) are out of scope — a future `equipment` spec should depend on this one.
- Crafting consumes ingredients via `removeItem` and produces output via `addItem` — see `crafting`.
- Loot drops / chest looting should use `transferItem` — a future `loot` spec.
- `gold` is a convenience field, not a full economy/shop system.
- Hotbar slot shortcuts are a UI concern, not an inventory concern.
