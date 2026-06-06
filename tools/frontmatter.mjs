// Minimal, dependency-free parser for the constrained YAML frontmatter subset
// used by Better Games files. Supports scalar strings, numbers, and inline string
// arrays (`[a, b, c]`). This is the ONLY place frontmatter is parsed — the
// validator, registry builder, and tests all import it (DRY).

/**
 * Split a Better Games document into its frontmatter object and markdown body.
 * Returns { ok: true, data, body } or { ok: false, error } — never throws on
 * malformed input, so callers get a clean, reportable error.
 *
 * @param {string} content raw file contents
 * @returns {{ok: true, data: Record<string, any>, body: string} | {ok: false, error: string}}
 */
export function parseFrontmatter(content) {
  if (typeof content !== "string") {
    return { ok: false, error: "content must be a string" };
  }

  // Frontmatter must be the very first thing in the file.
  const normalized = content.replace(/^﻿/, ""); // strip BOM
  if (!normalized.startsWith("---")) {
    return { ok: false, error: "missing opening '---' frontmatter delimiter" };
  }

  const lines = normalized.split(/\r?\n/);
  // lines[0] is the opening '---'. Find the closing delimiter.
  let closingIndex = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === "---") {
      closingIndex = i;
      break;
    }
  }
  if (closingIndex === -1) {
    return { ok: false, error: "missing closing '---' frontmatter delimiter" };
  }

  const data = {};
  for (let i = 1; i < closingIndex; i++) {
    const raw = lines[i];
    if (raw.trim() === "") continue;

    const colon = raw.indexOf(":");
    if (colon === -1) {
      return { ok: false, error: `frontmatter line ${i + 1} is not 'key: value'` };
    }
    const key = raw.slice(0, colon).trim();
    if (key === "") {
      return { ok: false, error: `frontmatter line ${i + 1} has an empty key` };
    }
    const value = parseValue(stripComment(raw.slice(colon + 1)));
    data[key] = value;
  }

  const body = lines.slice(closingIndex + 1).join("\n");
  return { ok: true, data, body };
}

// Remove a trailing ` # comment` (whitespace before the hash) while leaving
// '#' that is part of a value untouched. Our schema has no '#' in values, so a
// whitespace-anchored strip is safe and keeps the template's annotations out.
function stripComment(s) {
  const m = s.match(/\s+#.*$/);
  return m ? s.slice(0, m.index) : s;
}

function parseValue(rawValue) {
  const v = rawValue.trim();

  // Inline array: [a, b, c]
  if (v.startsWith("[") && v.endsWith("]")) {
    const inner = v.slice(1, -1).trim();
    if (inner === "") return [];
    return inner.split(",").map((part) => unquote(part.trim())).filter((s) => s !== "");
  }

  // Number (integer or decimal)
  if (/^-?\d+(\.\d+)?$/.test(v)) {
    return Number(v);
  }

  return unquote(v);
}

function unquote(s) {
  if (s.length >= 2 && ((s[0] === '"' && s.at(-1) === '"') || (s[0] === "'" && s.at(-1) === "'"))) {
    return s.slice(1, -1);
  }
  return s;
}

/**
 * Extract the ordered list of level-2 (`## `) heading titles from a markdown body.
 * @param {string} body
 * @returns {string[]}
 */
export function extractH2Sections(body) {
  const sections = [];
  for (const line of body.split(/\r?\n/)) {
    const m = line.match(/^##\s+(.+?)\s*$/);
    if (m && !line.startsWith("###")) sections.push(m[1]);
  }
  return sections;
}
