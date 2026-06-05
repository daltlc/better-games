---
id: save-system
title: Save System
version: 1.0.0
specFormatVersion: 1
category: core-systems
status: stable
tags: [persistence, save, load, serialization, migration]
dependsOn: []
requiredBy: []
variants: [single-slot, multi-slot, autosave, checkpoint]
---

## Overview

A general-purpose save system for serializing and restoring arbitrary game state. It coordinates a set of **save participants** (modules like inventory, crafting, player stats, world state), each of which contributes a named, versioned chunk to a single save payload. On load, each chunk is routed back to its participant, migrating older schema versions forward as needed.

The save system is **pure logic over a host-provided storage backend**. It does not assume a filesystem, a cloud API, or `localStorage` — the host injects a `StorageAdapter`. It never interprets the contents of a chunk; that is each participant's job.

**This spec does NOT cover:** the actual storage medium (host-injected), encryption/compression (optional host concern), or what each chunk means (owned by participants like `inventory`).

## Agent Instructions

- Implement as **pure logic**: take a `StorageAdapter` and a set of participants, return typed results, emit events. No direct disk/network calls of your own.
- Treat the save payload as an **envelope of opaque chunks**. Do not parse a participant's data — call its `serialize` / `deserialize` / `migrate` hooks.
- Every operation returns a typed `SaveResult` / `LoadResult` — never silently fail.
- **Versioning is mandatory.** Every chunk carries its own `version`. On load, if a chunk's version is older than the participant's current version, run the participant's migration chain; if newer, refuse and surface a clear error rather than corrupt state.
- **Ask the host** which storage backend and which participants exist before wiring anything; do not invent participant ids.
- Generate unit tests from the Test Cases section unless the user opts out.

## Data Contracts

```
SaveEnvelope {
  formatVersion: number              // version of THIS envelope format
  savedAt: number                    // epoch ms
  slotId: string                     // which save slot
  meta?: Record<string, any>         // playtime, location, screenshot key, ...
  chunks: Record<string, SaveChunk>  // participantId -> chunk
}

SaveChunk {
  participantId: string
  version: number                    // participant's schema version at save time
  data: any                          // opaque to the save system; JSON-safe
}

// Each module that wants to be saved registers one of these.
SaveParticipant {
  id: string                         // e.g. "inventory"
  version: number                    // current schema version
  serialize(): any                   // produce JSON-safe data
  deserialize(data: any): void       // apply data at current version
  migrate?(data: any, from: number, to: number): any  // upgrade old data
}

// Host-provided persistence backend.
StorageAdapter {
  read(slotId: string): string | null      // returns serialized envelope or null
  write(slotId: string, payload: string): void
  list(): string[]                          // available slotIds
  delete(slotId: string): void
}

SaveResult  { success: boolean, data?: { slotId: string, savedAt: number }, error?: SaveError }
LoadResult  { success: boolean, data?: SaveEnvelope, error?: SaveError }

SaveError =
  | "SLOT_NOT_FOUND"
  | "CORRUPT_DATA"
  | "UNKNOWN_PARTICIPANT"
  | "VERSION_TOO_NEW"        // chunk newer than the running participant
  | "MIGRATION_FAILED"
  | "STORAGE_ERROR"
```

## Core Operations

### 1. Save
**Signature:** `save(slotId, participants, adapter, meta?) -> SaveResult`

**Logic:**
1. For each participant, call `serialize()` and wrap it as a `SaveChunk` with the participant's current `version`.
2. Assemble a `SaveEnvelope` with `formatVersion`, `savedAt = now`, `slotId`, optional `meta`, and the chunk map.
3. Serialize the envelope to a JSON string and call `adapter.write(slotId, payload)`; on throw → `STORAGE_ERROR`.
4. Emit `GAME_SAVED`.
5. Return success with `{ slotId, savedAt }`.

### 2. Load
**Signature:** `load(slotId, participants, adapter) -> LoadResult`

**Logic:**
1. `adapter.read(slotId)`; if null → `SLOT_NOT_FOUND`.
2. Parse JSON; on failure → `CORRUPT_DATA`.
3. For each chunk:
   - Find the matching participant by `participantId`; if none → `UNKNOWN_PARTICIPANT` (or skip with a warning if the host allows partial loads).
   - If `chunk.version > participant.version` → `VERSION_TOO_NEW` (refuse — do not downgrade).
   - If `chunk.version < participant.version`: call `participant.migrate(data, chunk.version, participant.version)`; on throw → `MIGRATION_FAILED`.
   - Call `participant.deserialize(migratedData)`.
4. Emit `GAME_LOADED`.
5. Return success with the (migrated) envelope.

### 3. Slot Management
- `listSlots(adapter) -> string[]`
- `deleteSlot(slotId, adapter) -> SaveResult`  // emits `SLOT_DELETED`
- `getSlotMeta(slotId, adapter) -> Record<string, any> | null`  // read `meta` without full load

## Events

| Event | Payload |
|---|---|
| `GAME_SAVED` | `{ slotId, savedAt }` |
| `GAME_LOADED` | `{ slotId, savedAt }` |
| `SLOT_DELETED` | `{ slotId }` |
| `SAVE_FAILED` | `{ slotId, error }` |
| `LOAD_FAILED` | `{ slotId, error }` |

## Variants

| Variant | Description |
|---|---|
| `single-slot` | One fixed `slotId` (default for linear games). |
| `multi-slot` | Named/numbered slots the player chooses between. |
| `autosave` | Host triggers `save` on an interval or event; typically a reserved slot. |
| `checkpoint` | Saves at defined points; may keep a rolling set of recent slots. |

## Integration Hooks

The host provides:

- **StorageAdapter** — the actual read/write/list/delete backend (filesystem, `localStorage`, cloud, Roblox `DataStore`). The save system never touches storage directly.
- **Save Participants** — each module implementing the `SaveParticipant` interface. For example, the `inventory` spec's `SerializedInventory` + `migrateInventory` map directly onto `serialize` / `deserialize` / `migrate`.
- **Event Bus** — the host's event mechanism, which the save system adapts to.
- **Clock** — a `now()` source (injectable for deterministic tests).

## Persistence

The save system *is* the persistence layer, so "persistence" here means its own envelope format and how it evolves:

- `formatVersion` versions the **envelope shape itself** (independent of any chunk's `version`).
- Provide `migrateEnvelope(envelope, fromVersion, toVersion)` for envelope-level changes (e.g. renaming `chunks` or adding a checksum).
- Chunks remain opaque during envelope migration — only participants migrate chunk contents.

## Test Cases

- Save then load a single participant → state identical after round-trip.
- Save then load multiple participants → each chunk routed to the correct participant.
- Load a slot that does not exist → `SLOT_NOT_FOUND`.
- Load malformed JSON → `CORRUPT_DATA`.
- Load a chunk whose `version` < participant version → `migrate` invoked, then `deserialize`.
- Load a chunk whose `version` > participant version → `VERSION_TOO_NEW`, no mutation.
- Migration throwing → `MIGRATION_FAILED`, surfaced clearly.
- Unknown participant chunk → `UNKNOWN_PARTICIPANT` (or skipped with warning if partial loads enabled).
- `listSlots` reflects writes and deletes.
- `getSlotMeta` returns meta without invoking participant `deserialize`.
- Storage backend throwing on write → `STORAGE_ERROR`, `SAVE_FAILED` emitted.

## Known Limitations & Notes

- Encryption, compression, and checksums are optional and belong in the host's `StorageAdapter`, not here.
- This spec coordinates persistence but does not define any participant's data shape — e.g. `inventory` owns its `SerializedInventory` and migration logic (soft reference; not a hard dependency).
- Cloud sync / conflict resolution across devices is out of scope; the adapter abstraction is where such a backend would plug in.
- No automatic save scheduling — the `autosave` variant relies on the host to trigger `save`.
