import { test } from "node:test";
import assert from "node:assert/strict";

import { parseFrontmatter, extractH2Sections } from "./frontmatter.mjs";

const VALID = `---
id: inventory
title: Inventory System
version: 1.0.0
specFormatVersion: 1
status: stable
tags: [inventory, items, storage]
dependsOn: []
requiredBy: [crafting]
---

## Overview
body text
## Agent Instructions
more
`;

test("parses scalars, numbers, and inline arrays", () => {
  const r = parseFrontmatter(VALID);
  assert.equal(r.ok, true);
  assert.equal(r.data.id, "inventory");
  assert.equal(r.data.version, "1.0.0");
  assert.equal(r.data.specFormatVersion, 1);
  assert.deepEqual(r.data.tags, ["inventory", "items", "storage"]);
  assert.deepEqual(r.data.dependsOn, []);
  assert.deepEqual(r.data.requiredBy, ["crafting"]);
});

test("separates body from frontmatter", () => {
  const r = parseFrontmatter(VALID);
  assert.match(r.body, /## Overview/);
  assert.doesNotMatch(r.body, /id: inventory/);
});

test("strips trailing comments after values", () => {
  const r = parseFrontmatter(`---\nid: thing   # a comment\nstatus: draft\n---\nbody\n`);
  assert.equal(r.data.id, "thing");
  assert.equal(r.data.status, "draft");
});

test("fails on missing opening delimiter", () => {
  const r = parseFrontmatter("no frontmatter here");
  assert.equal(r.ok, false);
  assert.match(r.error, /opening/);
});

test("fails on missing closing delimiter", () => {
  const r = parseFrontmatter("---\nid: x\nstill going\n");
  assert.equal(r.ok, false);
  assert.match(r.error, /closing/);
});

test("fails on a non key:value line", () => {
  const r = parseFrontmatter("---\nthis has no colon\n---\nbody\n");
  assert.equal(r.ok, false);
});

test("extractH2Sections returns level-2 headings in order, ignoring h3", () => {
  const sections = extractH2Sections("## One\n### Nested\ntext\n## Two\n");
  assert.deepEqual(sections, ["One", "Two"]);
});
