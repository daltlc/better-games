---
id: my-feature                 # kebab-case, unique, MUST equal this file's stem
title: My Feature              # human-readable display name
version: 0.1.0                 # SemVer for this spec's contracts
specFormatVersion: 1          # meta-format version (see SPEC-FORMAT.md)
category: core-systems        # MUST equal the parent folder under specs/
status: draft                 # draft | stable | deprecated
tags: [example, replace-me]
dependsOn: []                 # spec ids this builds on (must be reciprocal)
requiredBy: []                # spec ids that build on this (must be reciprocal)
variants: []                  # supported variants, or [] if none
---

## Overview

<!-- What is this feature? One or two paragraphs. Then state explicitly what it does NOT do. -->

## Agent Instructions

<!-- Directives for an AI (and a useful checklist for humans):
     - Implement as pure logic; emit events / return results, never touch UI directly.
     - Every operation returns a typed result (success/failure + reason).
     - Reference data by string id into a host-owned registry.
     - Ask the host for its schema before generating registry code.
     - Per-stack idioms (TS hook / C# component / GDScript autoload / Lua module).
     - Generate tests from the Test Cases section unless the user opts out. -->

## Data Contracts

<!-- Language-neutral pseudo-types. Example:

```
MyType {
  id: string
  count: number        // >= 0
  meta?: Record<string, any>
}
```
-->

## Core Operations

<!-- For each operation: a pseudocode signature, numbered logic steps, and edge cases.

### 1. Do Thing
**Signature:** `doThing(state, input) -> OperationResult<Output>`
**Logic:**
1. ...
**Edge Cases:**
- ...
-->

## Events

<!-- Table of emitted events and payloads. Delivered via the host's event system.

| Event | Payload |
|---|---|
| `THING_DONE` | `{ ... }` |
-->

## Variants

<!-- Each supported variant and how it changes the rules. Use a table or list. -->

## Integration Hooks

<!-- What the host project must provide: registry, persistence, event bus, UI subscription, etc. -->

## Persistence

<!-- JSON-safe serialized shape + a versioned migration stub (migrateX(serialized, from, to)). -->

## Test Cases

<!-- Concrete, verifiable cases any correct implementation must pass. Bullet list. -->

## Known Limitations & Notes

<!-- Boundaries, and SOFT cross-references to sibling specs by id (these do NOT go in dependsOn). -->
