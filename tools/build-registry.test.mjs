import { test } from "node:test";
import assert from "node:assert/strict";

import { buildRegistry, buildEntries } from "./build-registry.mjs";
import { SPEC_FORMAT_VERSION } from "./constants.mjs";

test("registry has the expected envelope and format version", () => {
  const reg = buildRegistry();
  assert.equal(reg.specFormatVersion, SPEC_FORMAT_VERSION);
  assert.ok(Array.isArray(reg.specs));
  assert.ok(reg.specs.length >= 3);
});

test("entries are sorted by id and carry the catalog fields", () => {
  const entries = buildEntries();
  const ids = entries.map((e) => e.id);
  assert.deepEqual(ids, [...ids].sort());
  for (const e of entries) {
    for (const field of ["id", "title", "version", "category", "status", "tags", "dependsOn", "requiredBy", "variants", "path"]) {
      assert.ok(field in e, `entry missing '${field}'`);
    }
    assert.match(e.path, /^specs\/.+\.gfs\.md$/);
  }
});

test("the inventory <-> crafting edge is reflected in the catalog", () => {
  const byId = Object.fromEntries(buildEntries().map((e) => [e.id, e]));
  assert.ok(byId.inventory.requiredBy.includes("crafting"));
  assert.ok(byId.crafting.dependsOn.includes("inventory"));
});
