// Validates every Better Games under specs/ against the BGL meta-format.
// Exits non-zero (and prints a clear per-file report) if anything fails.
// Exposes pure functions so the test suite can exercise the rules directly.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { parseFrontmatter, extractH2Sections } from "./frontmatter.mjs";
import {
  FRONTMATTER_KEYS,
  REQUIRED_SECTIONS,
  STATUS_VALUES,
  SPEC_FORMAT_VERSION,
  SPEC_FILE_EXT,
  SEMVER_RE,
  KEBAB_RE,
} from "./constants.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(HERE, "..");
export const SPECS_DIR = path.join(REPO_ROOT, "specs");

/** Recursively collect *.bgl.md files, refusing to escape `root` (no traversal). */
export function walkSpecs(dir, root = dir) {
  const resolvedRoot = path.resolve(root);
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = path.resolve(dir, entry);
    if (!full.startsWith(resolvedRoot + path.sep) && full !== resolvedRoot) continue;
    if (statSync(full).isDirectory()) {
      out.push(...walkSpecs(full, resolvedRoot));
    } else if (full.endsWith(SPEC_FILE_EXT)) {
      out.push(full);
    }
  }
  return out.sort();
}

function typeOk(kind, value) {
  switch (kind) {
    case "string":
      return typeof value === "string" && value.trim() !== "";
    case "number":
      return typeof value === "number" && Number.isFinite(value);
    case "semver":
      return typeof value === "string" && SEMVER_RE.test(value);
    case "array":
      return Array.isArray(value);
    default:
      return false;
  }
}

/**
 * Validate one parsed spec. Pure: takes the data + body + locator info, returns
 * { errors: string[], node }. `node` feeds the cross-spec graph check.
 */
export function validateSpecData({ data, body, stem, parentDir }) {
  const errors = [];

  // 1. Frontmatter keys present and well-typed.
  for (const { key, kind } of FRONTMATTER_KEYS) {
    if (!(key in data)) {
      errors.push(`missing frontmatter key '${key}'`);
      continue;
    }
    if (!typeOk(kind, data[key])) {
      errors.push(`frontmatter key '${key}' must be a ${kind}`);
    }
  }

  // 2. id rules.
  if (typeof data.id === "string") {
    if (!KEBAB_RE.test(data.id)) errors.push(`id '${data.id}' must be kebab-case`);
    if (data.id !== stem) errors.push(`id '${data.id}' must equal filename stem '${stem}'`);
  }

  // 3. status enum.
  if (data.status !== undefined && !STATUS_VALUES.includes(data.status)) {
    errors.push(`status '${data.status}' must be one of ${STATUS_VALUES.join(", ")}`);
  }

  // 4. specFormatVersion matches the current meta-format.
  if (typeof data.specFormatVersion === "number" && data.specFormatVersion !== SPEC_FORMAT_VERSION) {
    errors.push(`specFormatVersion ${data.specFormatVersion} != current ${SPEC_FORMAT_VERSION}`);
  }

  // 5. category equals the parent folder.
  if (typeof data.category === "string" && parentDir && data.category !== parentDir) {
    errors.push(`category '${data.category}' must equal parent folder '${parentDir}'`);
  }

  // 6. tags non-empty array of kebab strings.
  if (Array.isArray(data.tags)) {
    if (data.tags.length === 0) errors.push("tags must not be empty");
    for (const t of data.tags) {
      if (typeof t !== "string" || !KEBAB_RE.test(t)) errors.push(`tag '${t}' must be a kebab-case string`);
    }
  }

  // 7. Required sections present and in order.
  const found = extractH2Sections(body);
  let lastIndex = -1;
  for (const section of REQUIRED_SECTIONS) {
    const at = found.indexOf(section);
    if (at === -1) {
      errors.push(`missing required section '## ${section}'`);
    } else if (at < lastIndex) {
      errors.push(`section '## ${section}' is out of order`);
    } else {
      lastIndex = at;
    }
  }

  const node = {
    id: typeof data.id === "string" ? data.id : stem,
    dependsOn: Array.isArray(data.dependsOn) ? data.dependsOn : [],
    requiredBy: Array.isArray(data.requiredBy) ? data.requiredBy : [],
  };
  return { errors, node };
}

/** Read + parse + validate a single file path. */
export function validateSpecFile(filePath) {
  const stem = path.basename(filePath).slice(0, -SPEC_FILE_EXT.length);
  const parentDir = path.basename(path.dirname(filePath));
  const parsed = parseFrontmatter(readFileSync(filePath, "utf8"));
  if (!parsed.ok) {
    return { errors: [`frontmatter: ${parsed.error}`], node: { id: stem, dependsOn: [], requiredBy: [] } };
  }
  return validateSpecData({ data: parsed.data, body: parsed.body, stem, parentDir });
}

/** Cross-spec dependency graph checks: ids exist + edges are reciprocal. */
export function checkGraph(nodes) {
  const errors = [];
  const ids = new Set(nodes.map((n) => n.id));
  const byId = new Map(nodes.map((n) => [n.id, n]));

  for (const n of nodes) {
    for (const dep of n.dependsOn) {
      if (dep === n.id) errors.push(`${n.id}: dependsOn itself`);
      else if (!ids.has(dep)) errors.push(`${n.id}: dependsOn unknown spec '${dep}'`);
      else if (!byId.get(dep).requiredBy.includes(n.id)) {
        errors.push(`${n.id}: dependsOn '${dep}' but '${dep}' does not list '${n.id}' in requiredBy`);
      }
    }
    for (const req of n.requiredBy) {
      if (req === n.id) errors.push(`${n.id}: requiredBy itself`);
      else if (!ids.has(req)) errors.push(`${n.id}: requiredBy unknown spec '${req}'`);
      else if (!byId.get(req).dependsOn.includes(n.id)) {
        errors.push(`${n.id}: requiredBy '${req}' but '${req}' does not list '${n.id}' in dependsOn`);
      }
    }
  }
  return errors;
}

function main() {
  const files = walkSpecs(SPECS_DIR);
  const nodes = [];
  let failed = 0;

  for (const file of files) {
    const rel = path.relative(REPO_ROOT, file);
    const { errors, node } = validateSpecFile(file);
    nodes.push(node);
    if (errors.length) {
      failed++;
      console.error(`FAIL ${rel}`);
      for (const e of errors) console.error(`     - ${e}`);
    } else {
      console.log(`ok   ${rel}`);
    }
  }

  const graphErrors = checkGraph(nodes);
  if (graphErrors.length) {
    failed++;
    console.error("FAIL dependency graph");
    for (const e of graphErrors) console.error(`     - ${e}`);
  }

  if (failed) {
    console.error(`\n${failed} check(s) failed.`);
    process.exit(1);
  }
  console.log(`\nAll ${files.length} spec(s) valid.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
