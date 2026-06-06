---
id: turbo-boost-gauge
title: Turbo Boost Gauge
version: 0.1.0
specFormatVersion: 1
category: vehicle-systems
status: draft
tags: [turbo, boost, gauge, vehicle, physics, simulation, pressure, forced-induction]
dependsOn: []
requiredBy: []
variants: [nissan-z-vr30ddtt, generic-twin-scroll, single-turbo]
---

## Overview

A physics-accurate turbo boost gauge simulation for turbocharged vehicles. Models the real
behavior of a turbocharger as a first-order dynamic system: intake manifold pressure is driven
by exhaust energy, gated by a boost threshold RPM, regulated by a wastegate at a target
pressure, and vented on throttle release via a recirculation valve (not a BOV).

The simulation is designed against the **Nissan Z (RZ34) VR30DDTT** (3.0 L twin-turbo V6,
Garrett MGT14446LKSZ turbos, 400 hp) as its reference variant, but the constants are fully
configurable for any turbocharged platform.

**Key VR30DDTT hardware facts that affect simulation design:**
- **No blow-off valve (BOV)** — the VR30DDTT uses a recirculation valve only (confirmed by
  EcuTek boost control documentation). Pressure vents via throttle body control and
  recirculation; the characteristic BOV "pssh" is absent on stock cars.
- **Electronic wastegates** — position-controlled, not duty-cycle pneumatic. Enables
  precise per-RPM boost shaping and a programmed taper above 5,000 RPM on the stock tune.
- **Gauge range −15 to +20 psi** — the stock Nissan Z gauge is a full-range instrument.
  The needle rests at approximately **−10 psi** at idle (manifold vacuum), not at 0.

The `vacuumPsi` config field captures the idle floor: `−10.0` for the stock Nissan Z;
`0.0` for a boost-only gauge with no vacuum display.

**Five distinct phases replace the binary on/off model used by most games:**

| Phase | Description |
|---|---|
| `VACUUM` | Idle, light throttle, or below boost-threshold RPM. Gauge reads 0 (OEM) or negative (full-range aftermarket). |
| `SPOOLING` | Throttle open, above threshold. Boost builds exponentially toward target. |
| `BOOSTING` | At target pressure. Wastegate opens; gauge holds a regulated plateau with a brief initial spike. |
| `DROPPING` | Throttle released while pressurized. BOV fires; gauge collapses rapidly. |

**This spec does NOT cover:** engine power output calculation, turbo wheel speed (abstracted by
the first-order model), heat/cooling effects on spool, overboost protection or turbo failure
states, gear-change effects on boost, or audio cues (note: the VR30DDTT has no BOV "pssh" —
audio would be turbo whistle and recirculation valve only). Soft references to a future
`vehicle-engine` spec where power delivery lives.

## Agent Instructions

> Read this before implementing.

- Implement as **pure logic**. The spec returns numeric state every frame; the host maps that
  to a needle angle, a dial texture, or a debug readout. Never touch UI directly.
- The core algorithm is a **first-order RC filter** (exponential approach) with **asymmetric
  time constants**: spool-up is slow (turbine inertia), drop is fast (BOV dumps pressure).
- Every operation returns a **typed `OperationResult`** — success/failure plus a reason code.
  Never silently fail or clamp without reporting.
- `update` must be called **once per frame** with an accurate `dt` (delta time in seconds).
  Do not accumulate multiple ticks into one call; precision degrades.
- Use `exp(-dt / tau)` for the overshoot decay — do **not** use a linear approximation; the
  curve shape matters perceptually.
- All numeric constants come from **`TurboConfig`** — never hardcode them. The `variants`
  section provides reference values for each supported platform.
- Per-stack idioms: TypeScript → a `useTurboGauge` hook returning `TurboState` each frame;
  Unity C# → a `TurboGaugeSystem` `MonoBehaviour` with `Update(float dt)`; Godot →
  `_process(delta)` in an `Autoload`; Roblox/Lua → a `RunService.Heartbeat` connection.
- Generate **unit tests** from the Test Cases section unless the user opts out.

## Data Contracts

```
BoostPhase =
  | "VACUUM"       // idle / below threshold / light throttle
  | "SPOOLING"     // building toward target
  | "BOOSTING"     // at target, wastegate regulating
  | "DROPPING"     // BOV active, pressure collapsing

TurboConfig {
  // RPM gating — exhaust mass flow must be above threshold to spin turbine
  boostThresholdRpm: number      // below this, no spool (VR30DDTT: 2500 — owner: "under 3K = reserved")
  boostFullRpm: number           // WOT full boost achievable above this RPM (VR30DDTT: 3500)

  // Pressure limits (psi gauge)
  targetBoostPsi: number         // regulated plateau (VR30DDTT: 15.0)
  vacuumPsi: number              // gauge floor at idle; negative = full-range gauge (VR30DDTT: -10.0)
  maxOvershootPsi: number        // spike magnitude above target on hard spool (VR30DDTT: 2.2)

  // Time constants (seconds) — govern the first-order RC filter
  baseSpoolTau: number           // spool tau at max exhaust energy (WOT, high RPM) (VR30DDTT: 0.45)
                                 // Effective tau scales up at partial load: tau = base / sqrt(exhaustEnergy)
  wastegateSettleTau: number     // overshoot decay rate after spike (VR30DDTT: 0.25)
  recirculationTau: number       // pressure drop tau on throttle lift — recirculation valve,
                                 // NOT a BOV (VR30DDTT has no BOV); still fast (VR30DDTT: 0.12)

  // Throttle gating — ECU actively commands wastegate open below this TPS
  minThrottleForSpool: number    // below this fraction, throttleFactor = 0 (VR30DDTT: 0.65)
                                 // This is not purely turbine physics — the electronic wastegate
                                 // is commanded open by the ECU below ~65% TPS regardless of RPM,
                                 // preventing boost buildup intentionally (smooth part-throttle delivery).
                                 // Real-world: ~nothing below 70% throttle, first noticeable at ~75%.
}

TurboState {
  boostPsi: number               // current gauge reading (psi gauge)
  phase: BoostPhase
  overshootEnergy: number        // remaining spike above target (decays → 0 after spool)
  prevBoostPsi: number           // previous frame reading (for transition detection)
}

TurboInput {
  rpm: number                    // current engine RPM (>= 0)
  throttle: number               // normalized throttle position [0.0, 1.0]
  dt: number                     // elapsed time since last update in seconds (> 0)
}

TurboUpdateResult {
  state: TurboState
  events: TurboEvent[]           // zero or more events emitted this frame
}

TurboEvent =
  | { type: "BOOST_THRESHOLD_CROSSED" }   // phase entered SPOOLING
  | { type: "BOOST_TARGET_REACHED" }      // phase entered BOOSTING
  | { type: "BOOST_SPIKE"; peakPsi: number }  // overshoot triggered; peakPsi is projected peak
  | { type: "PRESSURE_DROP" }                 // phase entered DROPPING
  | { type: "BOOST_LOST" }               // phase returned to VACUUM

OperationResult<T> {
  success: boolean
  data?: T
  error?: TurboError
}

TurboError =
  | "INVALID_DT"           // dt <= 0
  | "INVALID_RPM"          // rpm < 0
  | "INVALID_THROTTLE"     // throttle outside [0.0, 1.0]
  | "CONFIG_INVALID"       // config values are inconsistent (e.g. vacuumPsi >= targetBoostPsi)
```

## Core Operations

### 1. Initialize
**Signature:** `initialize(config) -> OperationResult<TurboState>`

**Logic:**
1. Validate `config`: `targetBoostPsi > 0`, `vacuumPsi < targetBoostPsi`,
   all tau values `> 0`, `boostThresholdRpm < boostFullRpm`, `throttleDeadband < throttleFullBoost`.
   If any fail → `CONFIG_INVALID`. (`vacuumPsi` may be 0 or negative — both are valid.)
2. Return initial state: `boostPsi = config.vacuumPsi`, `phase = "VACUUM"`,
   `overshootEnergy = 0`, `prevBoostPsi = config.vacuumPsi`.

### 2. Update
**Signature:** `update(state, config, input) -> OperationResult<TurboUpdateResult>`

**Logic:**
1. Validate inputs: `input.dt > 0` → else `INVALID_DT`; `input.rpm >= 0` → else `INVALID_RPM`;
   `input.throttle in [0,1]` → else `INVALID_THROTTLE`.
2. Compute **exhaust energy** — the combined RPM+throttle load driving the turbine.
   Both factors must be high simultaneously; neither alone is sufficient:
   ```
   rpmFactor      = clamp((input.rpm - config.boostThresholdRpm)
                          / (config.boostFullRpm - config.boostThresholdRpm),
                          0.0, 1.0)
   throttleFactor = clamp((input.throttle - config.minThrottleForSpool)
                          / (1.0 - config.minThrottleForSpool),
                          0.0, 1.0)
   exhaustEnergy  = rpmFactor * throttleFactor   // MULTIPLICATIVE — range 0→1
   ```
   This is why the VR30DDTT feels reserved below 3,000 RPM even at moderate throttle:
   a low `rpmFactor` multiplied by any `throttleFactor` keeps `exhaustEnergy` near zero.

3. Apply **high-RPM taper** — electronic wastegate opens partially above 5,000 RPM
   on the stock VR30 tune (STILLEN analysis: holding boost past 5K adds heat without
   power gain at the stock turbo's efficiency range):
   ```
   rpmTaper = (input.rpm > 5000)
       ? 1.0 - clamp((input.rpm - 5000) / 1800, 0.0, 1.0) * 0.35
       : 1.0
   ```

4. Determine **boost target** for this frame:
   ```
   if exhaustEnergy < 0.02:
       boostTarget = config.vacuumPsi          // below spool threshold → stay in vacuum
   else:
       boostTarget = config.targetBoostPsi * pow(exhaustEnergy, 0.8) * rpmTaper
   ```
   The `pow(exhaustEnergy, 0.8)` curve makes boost build non-linearly — slow at first,
   accelerating as both RPM and throttle climb together.

5. Select **effective time constant** — spool tau scales with available exhaust energy
   (low energy → slow spool → barely perceptible gauge movement at light load):
   ```
   effectiveSpoolTau = (exhaustEnergy > 0.02)
       ? config.baseSpoolTau / sqrt(exhaustEnergy)
       : 999   // effectively frozen
   tau = (boostTarget > state.boostPsi) ? effectiveSpoolTau : config.recirculationTau
   ```
6. Apply **first-order exponential filter** (models turbine rotational inertia):
   ```
   rate = (boostTarget - state.boostPsi) / tau
   nextBoost = state.boostPsi + rate * input.dt
   ```
7. Handle **overshoot spike** — triggered once when phase transitions from VACUUM into SPOOLING
   (i.e. boost starts building from the idle floor, regardless of whether that floor is 0 or negative):
   ```
   if state.phase == "VACUUM" AND newPhase == "SPOOLING":
       nextOvershootEnergy = config.maxOvershootPsi   // spike initialized
       emit BOOST_SPIKE { peakPsi: config.targetBoostPsi + config.maxOvershootPsi }
   else:
       // Decay existing spike with its own time constant
       nextOvershootEnergy = state.overshootEnergy
                             * exp(-input.dt / config.wastegateSettleTau)
       if nextOvershootEnergy < 0.01: nextOvershootEnergy = 0.0
   nextBoost = nextBoost + nextOvershootEnergy
   ```
8. **Clamp** to physical range:
   ```
   nextBoost = clamp(nextBoost,
                     config.vacuumPsi,
                     config.targetBoostPsi + config.maxOvershootPsi)
   ```
9. Determine **new phase** and collect **phase-transition events**:
   ```
   if boostTarget == config.vacuumPsi AND nextBoost <= config.vacuumPsi + 0.1:
       newPhase = "VACUUM"
       if state.phase != "VACUUM": emit BOOST_LOST
   else if nextBoost < config.targetBoostPsi - 0.5:
       newPhase = (boostTarget > config.vacuumPsi) ? "SPOOLING" : "DROPPING"
       if state.phase == "VACUUM" AND newPhase == "SPOOLING": emit BOOST_THRESHOLD_CROSSED
       if state.phase in ["BOOSTING","SPOOLING"] AND newPhase == "DROPPING": emit PRESSURE_DROP
   else:
       newPhase = "BOOSTING"
       if state.phase == "SPOOLING": emit BOOST_TARGET_REACHED
   ```
10. Return `TurboUpdateResult` with the new state and collected events.

**Edge Cases:**
- `dt` large (e.g., frame spike or paused game): boost can jump discontinuously. Hosts should
  cap `dt` to ~100 ms before calling `update` to prevent unrealistic jumps.
- Throttle snap to WOT at 4,000 RPM: boost is already above threshold → no cold-spool lag,
  spike fires immediately on the first crossing from vacuum.
- Throttle feathering below `throttleFullBoost`: partial boost plateau at
  `targetBoostPsi * throttleScale`; wastegate does not open fully.

### 3. Get Needle Position
**Signature:** `getNeedlePosition(state, config) -> number`

Maps current `boostPsi` to a normalized needle position for the host to render.

**Logic:**
```
range = config.targetBoostPsi - config.vacuumPsi
position = (state.boostPsi - config.vacuumPsi) / range
return clamp(position, 0.0, 1.0 + config.maxOvershootPsi / range)
```

- `0.0` = gauge at rest / idle floor (0 psi for OEM gauges; full vacuum for full-range aftermarket).
- `1.0` = gauge at regulated boost target (the normal "full boost" mark).
- `> 1.0` = spike overshoot past the target mark (needle briefly into the red zone).

The host maps this `[0, 1.2ish]` float to a rotation angle or a fill level.

## Events

Delivered through the host's event system (EventEmitter, C# events, Godot signals,
Roblox `BindableEvent`). Events are returned from `update` in `TurboUpdateResult.events`;
the host dispatches them — the spec does not own the event bus.

| Event | Payload | When |
|---|---|---|
| `BOOST_THRESHOLD_CROSSED` | `{}` | Phase transitions `VACUUM → SPOOLING` |
| `BOOST_TARGET_REACHED` | `{}` | Phase transitions `SPOOLING → BOOSTING` |
| `BOOST_SPIKE` | `{ peakPsi: number }` | Overshoot energy initialized (vacuum→boost crossing) |
| `PRESSURE_DROP` | `{}` | Phase transitions `SPOOLING/BOOSTING → DROPPING` |
| `BOOST_LOST` | `{}` | Phase returns to `VACUUM` from any other phase |

At most one of each event fires per frame. Multiple simultaneous transitions within a single
`update` call are not physically possible given realistic `dt` values.

## Variants

| Variant | `boostThresholdRpm` | `boostFullRpm` | `targetBoostPsi` | `baseSpoolTau` | `recirculationTau` | `minThrottleForSpool` | `maxOvershootPsi` | Notes |
|---|---|---|---|---|---|---|---|---|
| `nissan-z-vr30ddtt` | 2500 | 3500 | 15.0 | 0.45 | 0.12 | 0.65 | 2.2 | Garrett MGT14446LKSZ twin-turbos. No BOV — recirculation valve only. Electronic wastegates commanded open below ~65% TPS (ECU-controlled, not just turbine physics). 5K+ RPM taper. `vacuumPsi = -10.0`. Gauge: −15 to +20 psi. Validated against real-world Z driving: ~nothing below 70% throttle, noticeable at ~75%. Data: STILLEN VR30 analysis, EcuTek boost control docs, NissanZClub owner logs. |
| `generic-twin-scroll` | 2000 | 3200 | 14.0 | 0.65 | 0.15 | 0.25 | 1.8 | Larger twin-scroll, slightly more lag. `vacuumPsi = -10.0`. Has BOV. |
| `single-turbo` | 2500 | 4200 | 18.0 | 1.10 | 0.18 | 0.20 | 3.5 | Single large turbo; pronounced lag, big spike, higher target. `vacuumPsi = -10.0`. Has BOV. |

## Integration Hooks

The host project must provide:

- **Engine RPM** — authoritative RPM value each frame (from vehicle physics, an engine sim,
  or a scripted curve). The spec reads it via `TurboInput`; it does not derive RPM itself.
- **Throttle Position** — normalized `[0,1]` signal from player input or an AI controller.
- **Delta Time** — frame elapsed time in seconds. Host should clamp to ≤ 0.1 s before passing.
- **Event Bus** — the spec returns events in the result; the host dispatches them to any
  listeners (UI animations, audio, telemetry).
- **Gauge Renderer** — subscribes to `state.boostPsi` / `getNeedlePosition` and drives the
  needle. The spec never touches rendering directly.
- **Config Source** — the host selects a variant config or builds a custom one. The spec
  accepts it at `initialize` and at each `update` (config changes take effect next frame).

## Persistence

`TurboState` is **transient** — it resets to `initialize(config)` on every game load or
vehicle spawn. There is nothing worth serializing: the gauge always starts at rest (needle at
`vacuumPsi`) and reaches steady state within a few seconds of gameplay.

`TurboConfig` (custom tuning presets) **is** serializable if the host wants to let players
save a tuned setup:

```json
{
  "version": 1,
  "id": "turbo-boost-gauge-config",
  "config": {
    "boostThresholdRpm": 2500,
    "boostFullRpm": 3500,
    "targetBoostPsi": 15.0,
    "vacuumPsi": -10.0,
    "maxOvershootPsi": 2.2,
    "baseSpoolTau": 0.45,
    "wastegateSettleTau": 0.25,
    "recirculationTau": 0.12,
    "minThrottleForSpool": 0.65
  }
}
```

Provide `migrateTurboConfig(serialized, fromVersion, toVersion) -> serialized`. On load, if
`serialized.version` is older than the current schema, run the migration. If newer, warn and
refuse rather than apply unknown fields silently.

## Test Cases

**Initialization**
- `initialize` with valid config → `boostPsi == config.vacuumPsi`, `phase == "VACUUM"`.
- `initialize` with `vacuumPsi >= targetBoostPsi` → `CONFIG_INVALID`.
- `initialize` with `targetBoostPsi <= 0` → `CONFIG_INVALID`.
- `initialize` with `spoolTau <= 0` → `CONFIG_INVALID`.

**Phase: VACUUM**
- `update` with `rpm = 0`, `throttle = 1.0` → `boostTarget == vacuumPsi`; boost stays at vacuum.
- `update` with `rpm = 5000`, `throttle = 0.05` (below deadband) → boost stays at vacuum.
- `update` many frames with `rpm < boostThresholdRpm`, WOT → boost stays at `vacuumPsi`, never climbs toward target.

**Phase: SPOOLING**
- `update` with `rpm = 2000`, `throttle = 1.0` and initial `boostPsi == vacuumPsi` →
  boost increases each frame; `phase == "SPOOLING"`.
- After crossing threshold: `BOOST_THRESHOLD_CROSSED` emitted exactly once.
- Boost approaches `targetBoostPsi` asymptotically — never jumps past it (before overshoot).
- Partial throttle `0.5` at full RPM → boost plateau is `targetBoostPsi * (0.5 / 0.70)`, not full target.

**Phase: BOOSTING (wastegate + overshoot)**
- When phase transitions VACUUM → SPOOLING for the first time: `overshootEnergy == maxOvershootPsi`,
  `BOOST_SPIKE` emitted with correct `peakPsi`. Trigger is phase-transition based, not tied to crossing 0 psi.
- `overshootEnergy` decays by `exp(-dt / wastegateSettleTau)` each frame.
- After ≥ 5× `wastegateSettleTau` has elapsed: `overshootEnergy < 0.01`.
- `BOOST_TARGET_REACHED` emitted exactly once, when phase transitions `SPOOLING → BOOSTING`.

**Phase: DROPPING (BOV)**
- Throttle released from `BOOSTING` → `PRESSURE_DROP` emitted, `phase == "DROPPING"`.
- Drop uses `bovTau`, spool uses `spoolTau`; drop must be faster: `bovTau < spoolTau`.
- After drop: boost returns to `vacuumPsi`; `BOOST_LOST` emitted.

**Needle Position**
- `getNeedlePosition` when `boostPsi == vacuumPsi` → `0.0`.
- `getNeedlePosition` when `boostPsi == targetBoostPsi` → `1.0`.
- `getNeedlePosition` when `boostPsi == targetBoostPsi + maxOvershootPsi` → `> 1.0`.

**Input Validation**
- `update` with `dt = 0` → `INVALID_DT`.
- `update` with `dt < 0` → `INVALID_DT`.
- `update` with `rpm = -1` → `INVALID_RPM`.
- `update` with `throttle = 1.5` → `INVALID_THROTTLE`.

## Known Limitations & Notes

- **Turbine wheel speed is abstracted.** The first-order filter models the net effect of
  rotor inertia and exhaust energy without tracking actual turbo RPM (50,000–200,000 RPM).
  A future spec could model shaft dynamics explicitly for applications that need it.
- **Heat and thermal effects are out of scope.** Real turbos spool faster when hot; this spec
  uses constant time constants regardless of thermal state.
- **Overboost protection** (ECU boost cut, safety fuel cut) is not modeled. If a host needs
  it, they should cap `targetBoostPsi` in the config or apply a separate override layer.
- **No gear-shift transient.** On cars with a BOV, boost collapses mid-shift. On the VR30DDTT
  (no BOV), the ECU controls MAP via throttle body position, and over-boost during gearshifts
  is a known susceptibility (per EcuTek docs). The host can approximate this by momentarily
  setting `throttle = 0` on gear change; the recirculation valve drop will follow.
- Soft reference: a future `vehicle-engine` spec should own power-delivery curves and query
  `TurboState.boostPsi` to scale torque output. This spec does not output torque or power.
- Soft reference: a future `vehicle-audio` spec should listen for `PRESSURE_DROP` and
  `BOOST_SPIKE` events to trigger turbo sound cues.
