import { test } from "node:test";
import assert from "node:assert/strict";

import {
  validateSpecData,
  validateSpecFile,
  checkGraph,
  walkSpecs,
  SPECS_DIR,
} from "./validate.mjs";
import { REQUIRED_SECTIONS } from "./constants.mjs";

function validData(overrides = {}) {
  return {
    id: "demo",
    title: "Demo",
    version: "1.0.0",
    specFormatVersion: 1,
    category: "core-systems",
    status: "stable",
    tags: ["demo", "example"],
    dependsOn: [],
    requiredBy: [],
    variants: [],
    ...overrides,
  };
}

function bodyWithAllSections() {
  return REQUIRED_SECTIONS.map((s) => `## ${s}\ncontent\n`).join("\n");
}

const LOC = { stem: "demo", parentDir: "core-systems" };

test("a well-formed spec produces no errors", () => {
  const { errors } = validateSpecData({ data: validData(), body: bodyWithAllSections(), ...LOC });
  assert.deepEqual(errors, []);
});

test("missing frontmatter key is reported", () => {
  const data = validData();
  delete data.tags;
  const { errors } = validateSpecData({ data, body: bodyWithAllSections(), ...LOC });
  assert.ok(errors.some((e) => /missing frontmatter key 'tags'/.test(e)));
});

test("bad semver is reported", () => {
  const { errors } = validateSpecData({ data: validData({ version: "1.0" }), body: bodyWithAllSections(), ...LOC });
  assert.ok(errors.some((e) => /version.*semver/.test(e)));
});

test("id must equal filename stem", () => {
  const { errors } = validateSpecData({ data: validData({ id: "other" }), body: bodyWithAllSections(), stem: "demo", parentDir: "core-systems" });
  assert.ok(errors.some((e) => /must equal filename stem/.test(e)));
});

test("category must equal parent folder", () => {
  const { errors } = validateSpecData({ data: validData({ category: "wrong" }), body: bodyWithAllSections(), ...LOC });
  assert.ok(errors.some((e) => /must equal parent folder/.test(e)));
});

test("invalid status is reported", () => {
  const { errors } = validateSpecData({ data: validData({ status: "final" }), body: bodyWithAllSections(), ...LOC });
  assert.ok(errors.some((e) => /status 'final'/.test(e)));
});

test("missing required section is reported", () => {
  const body = REQUIRED_SECTIONS.filter((s) => s !== "Events").map((s) => `## ${s}\nx\n`).join("\n");
  const { errors } = validateSpecData({ data: validData(), body, ...LOC });
  assert.ok(errors.some((e) => /missing required section '## Events'/.test(e)));
});

test("out-of-order sections are reported", () => {
  const reordered = [...REQUIRED_SECTIONS];
  [reordered[0], reordered[1]] = [reordered[1], reordered[0]];
  const body = reordered.map((s) => `## ${s}\nx\n`).join("\n");
  const { errors } = validateSpecData({ data: validData(), body, ...LOC });
  assert.ok(errors.some((e) => /out of order/.test(e)));
});

test("checkGraph passes for reciprocal edges", () => {
  const nodes = [
    { id: "inventory", dependsOn: [], requiredBy: ["crafting"] },
    { id: "crafting", dependsOn: ["inventory"], requiredBy: [] },
  ];
  assert.deepEqual(checkGraph(nodes), []);
});

test("checkGraph flags a non-reciprocal edge", () => {
  const nodes = [
    { id: "inventory", dependsOn: [], requiredBy: [] },
    { id: "crafting", dependsOn: ["inventory"], requiredBy: [] },
  ];
  const errors = checkGraph(nodes);
  assert.ok(errors.some((e) => /does not list 'crafting' in requiredBy/.test(e)));
});

test("checkGraph flags an unknown dependency", () => {
  const errors = checkGraph([{ id: "crafting", dependsOn: ["ghost"], requiredBy: [] }]);
  assert.ok(errors.some((e) => /unknown spec 'ghost'/.test(e)));
});

test("every shipped spec passes validation and the graph is consistent", () => {
  const files = walkSpecs(SPECS_DIR);
  assert.ok(files.length >= 3, "expected at least the three seed specs");
  const nodes = [];
  for (const file of files) {
    const { errors, node } = validateSpecFile(file);
    assert.deepEqual(errors, [], `${file}: ${errors.join("; ")}`);
    nodes.push(node);
  }
  assert.deepEqual(checkGraph(nodes), []);
});
