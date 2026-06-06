// Single source of truth for the BGL meta-format rules.
// Imported by the parser, validator, builder, and tests so nothing is duplicated.
// If you change these, update SPEC-FORMAT.md and bump SPEC_FORMAT_VERSION.

export const SPEC_FORMAT_VERSION = 1;

export const SPEC_FILE_EXT = ".bgl.md";

export const STATUS_VALUES = ["draft", "stable", "deprecated"];

// Frontmatter keys and the type each must have.
// kind: "string" | "number" | "semver" | "array"
export const FRONTMATTER_KEYS = [
  { key: "id", kind: "string" },
  { key: "title", kind: "string" },
  { key: "version", kind: "semver" },
  { key: "specFormatVersion", kind: "number" },
  { key: "category", kind: "string" },
  { key: "status", kind: "string" },
  { key: "tags", kind: "array" },
  { key: "dependsOn", kind: "array" },
  { key: "requiredBy", kind: "array" },
  { key: "variants", kind: "array" },
];

// Required level-2 (`## `) section headings, in required order.
export const REQUIRED_SECTIONS = [
  "Overview",
  "Agent Instructions",
  "Data Contracts",
  "Core Operations",
  "Events",
  "Variants",
  "Integration Hooks",
  "Persistence",
  "Test Cases",
  "Known Limitations & Notes",
];

export const SEMVER_RE = /^\d+\.\d+\.\d+$/;
export const KEBAB_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
