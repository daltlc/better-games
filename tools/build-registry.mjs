// Generates registry.json — the machine-readable catalog — from spec frontmatter.
// Reuses the shared parser and the validator's safe walker (DRY). Skips writing
// when the catalog content is unchanged (cheap caching), so reruns are no-ops.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { parseFrontmatter } from "./frontmatter.mjs";
import { walkSpecs, REPO_ROOT, SPECS_DIR } from "./validate.mjs";
import { SPEC_FORMAT_VERSION } from "./constants.mjs";

const REGISTRY_PATH = path.join(REPO_ROOT, "registry.json");

const CATALOG_FIELDS = [
  "id",
  "title",
  "version",
  "category",
  "status",
  "tags",
  "dependsOn",
  "requiredBy",
  "variants",
];

/** Build the array of catalog entries (deterministic order, sorted by id). */
export function buildEntries(specsDir = SPECS_DIR, repoRoot = REPO_ROOT) {
  const entries = [];
  for (const file of walkSpecs(specsDir)) {
    const parsed = parseFrontmatter(readFileSync(file, "utf8"));
    if (!parsed.ok) {
      throw new Error(`cannot build registry — ${path.relative(repoRoot, file)}: ${parsed.error}`);
    }
    const entry = {};
    for (const field of CATALOG_FIELDS) entry[field] = parsed.data[field];
    entry.path = path.relative(repoRoot, file).split(path.sep).join("/");
    entries.push(entry);
  }
  return entries.sort((a, b) => String(a.id).localeCompare(String(b.id)));
}

/** Build the full registry object (timestamp excluded from caching comparison). */
export function buildRegistry(specsDir = SPECS_DIR, repoRoot = REPO_ROOT) {
  return { specFormatVersion: SPEC_FORMAT_VERSION, specs: buildEntries(specsDir, repoRoot) };
}

function main() {
  const registry = buildRegistry();

  // Caching: only rewrite when the meaningful content (everything but the
  // generatedAt timestamp) actually changed.
  if (existsSync(REGISTRY_PATH)) {
    try {
      const prev = JSON.parse(readFileSync(REGISTRY_PATH, "utf8"));
      const { generatedAt: _omit, ...prevContent } = prev;
      if (JSON.stringify(prevContent) === JSON.stringify(registry)) {
        console.log(`registry.json unchanged (${registry.specs.length} specs).`);
        return;
      }
    } catch {
      // Unreadable/corrupt existing file — fall through and overwrite.
    }
  }

  const payload = { generatedAt: new Date().toISOString(), ...registry };
  writeFileSync(REGISTRY_PATH, JSON.stringify(payload, null, 2) + "\n");
  console.log(`Wrote registry.json (${registry.specs.length} specs).`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
