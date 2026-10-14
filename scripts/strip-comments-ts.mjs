/**
 * One-off: remove every comment from a TS source EXCEPT the leading file
 * banner (the first JSDoc block, which carries Copyright / SPDX).
 *
 * Uses the TypeScript compiler API to locate comment ranges and its scanner
 * to locate tokens, so leading-comment/trivia ranges are exact — no hand-rolled
 * lexer, no risk of mangling strings / regex / template literals.
 */
import ts from "typescript";
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = process.argv[2] ? join(root, process.argv[2]) : join(root, "src");

/** Collect the exact [start, end) range of every comment in the file. */
function commentRanges(sf) {
  const text = sf.getFullText();
  const ranges = [];

  const walk = (node) => {
    // Full leading trivia of every node.
    const full = node.getFullStart();
    const start = node.getStart(sf, false);
    if (start > full) {
      for (const r of ts.getLeadingCommentRanges(text, full) ?? []) {
        if (r.end <= start) ranges.push([r.pos, r.end]);
      }
    }
    for (const r of ts.getTrailingCommentRanges(text, node.getEnd()) ?? []) {
      ranges.push([r.pos, r.end]);
    }
    ts.forEachChild(node, walk);
  };
  walk(sf);
  return ranges;
}

/** The leading banner: first JSDoc block starting at file top (ignoring BOM/ws). */
function bannerRange(sf, text) {
  const m = /^\uFEFF?\s*\/\*\*[\s\S]*?\*\//.exec(text);
  if (!m) return null;
  return [m.index, m.index + m[0].length];
}

function processFile(file) {
  const path = join(dir, file);
  const text = readFileSync(path, "utf8");
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TS);

  const banner = bannerRange(sf, text);
  const remove = [];

  const collect = (ranges) => {
    for (const [s, e] of ranges) {
      const isBanner =
        banner && s >= banner[0] && e <= banner[1];
      if (isBanner) continue;
      remove.push([s, e]);
    }
  };

  collect(commentRanges(sf));

  // Also grab comment trivia attached to syntax start/end positions.
  const text2 = text;
  const scanner = ts.createScanner(ts.ScriptTarget.ESNext, false, ts.LanguageVariant.Standard, text2);
  const scanComments = [];
  let tok = scanner.scan();
  while (tok !== ts.SyntaxKind.EndOfFileToken) {
    const s = scanner.getTokenPos();
    const e = scanner.getTextPos();
    const full = scanner.getTokenFullStart();
    for (const r of ts.getLeadingCommentRanges(text2, full) ?? []) {
      if (r.end <= s) scanComments.push([r.pos, r.end]);
    }
    tok = scanner.scan();
  }
  collect(scanComments);

  // Merge + dedupe, then delete right-to-left.
  remove.sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const r of remove) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([r[0], r[1]]);
  }

  // Widen a range to swallow the whole line when the line holds nothing but
  // that comment (plus its indentation) — otherwise deleting an inline JSDoc
  // block leaves an orphan blank line behind.
  const widened = merged.map(([s, e]) => {
    let ls = text.lastIndexOf("\n", s - 1) + 1;
    let le = text.indexOf("\n", e);
    if (le < 0) le = text.length;
    const lineHead = text.slice(ls, s);
    const lineTail = text.slice(e, le);
    if (/^[ \t]*$/.test(lineHead) && /^[ \t]*$/.test(lineTail)) {
      return [ls, le < text.length ? le + 1 : le];
    }
    return [s, e];
  });
  merged.length = 0;
  for (const r of widened) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([r[0], r[1]]);
  }

  let out = "";
  let cursor = 0;
  for (const [s, e] of merged) {
    if (s < cursor) continue;
    out += text.slice(cursor, s);
    cursor = e;
  }
  out += text.slice(cursor);

  // Whitespace tidy: strip trailing spaces, collapse blank runs.
  const cleaned = out
    .split("\n")
    .map((l) => l.replace(/[ \t]+$/, ""))
    .join("\n")
    .replace(/\n[ \t]*\n(?:[ \t]*\n)+/g, "\n\n");

  writeFileSync(path, cleaned);
  console.log(
    `${file}: ${text.split("\n").length} -> ${cleaned.split("\n").length} lines, ` +
      `${merged.length} comment ranges removed`,
  );
}

for (const f of readdirSync(dir).filter((x) => x.endsWith(".ts")).sort()) {
  processFile(f);
}
