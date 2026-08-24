// Manual dev-time placeholder audit. Not wired into any build/CI — run by hand before
// publishing: `node check-placeholders.mjs`. Zero dependencies.
//
// Checks that every field known to still hold demo/unverified content carries the exact
// canonical marker "DEMO / 待确认" (see the convention comment at the top of <body> in
// index.html). Deliberately narrow in scope: only checks the specific fields that
// convention actually governs (witness citations, the invite contact line), not a
// whole-document text scan — section kickers (e.g. "Identity / DEMO") and #statusText
// are a persistent "demo build" watermark, a different, intentionally-excluded category
// (see the convention comment), so a blanket scan would false-positive on them, on the
// convention comment's own explanatory text, and on ordinary prose sentences.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const html = readFileSync(path.join(dir, "index.html"), "utf8");

const CANONICAL = "DEMO / 待确认";

const REQUIRED_CONTEXTS = [
  { label: "witness citations", regex: /<cite>([^<]*)<\/cite>/g },
  { label: "contact-line spans", regex: /<div class="contact-line">([\s\S]*?)<\/div>/g },
];

const problems = [];

for (const { label, regex } of REQUIRED_CONTEXTS) {
  const matches = [...html.matchAll(regex)];
  if (!matches.length) {
    problems.push(`[missing] no matches found for ${label} — selector may be stale`);
    continue;
  }
  for (const m of matches) {
    const text = m[1];
    if (!text.includes(CANONICAL)) {
      problems.push(`[non-canonical] ${label}: "${text.trim()}" does not contain "${CANONICAL}"`);
    }
  }
}

if (problems.length) {
  console.log(`check-placeholders: ${problems.length} issue(s) found\n`);
  problems.forEach((p) => console.log(" - " + p));
  process.exitCode = 1;
} else {
  console.log('check-placeholders: all required fields carry the canonical "DEMO / 待确认" marker.');
}
