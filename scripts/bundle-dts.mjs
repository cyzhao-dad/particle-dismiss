/**
 * Roll per-module tsc .d.ts output into one self-contained dist/index.d.ts.
 *
 * Two things this must get right:
 *   1. Drop the relative imports between package modules — they no longer exist
 *      once everything lives in a single file.
 *   2. Keep the published surface identical to the runtime bundle. esbuild only
 *      exports what src/index.ts re-exports, and TypeScript treats EVERY
 *      top-level declaration in a .d.ts as an export regardless of the
 *      `export` keyword — so internal declarations must be dropped outright
 *      rather than merely de-exported.
 *
 * Copyright 2026 zhaochen <453157936@qq.com>
 * SPDX-License-Identifier: Apache-2.0
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const tmp = join(root, ".tmp-types");
const dist = join(root, "dist");

/** Dependency order: types has no local imports; others only import earlier modules. */
const MODULES = ["types", "config", "capture", "particles", "renderer", "api"];

function readPublicNames() {
  const text = readFileSync(join(root, "src/index.ts"), "utf8");
  const sf = ts.createSourceFile("index.ts", text, ts.ScriptTarget.Latest, true);
  const names = new Set();
  for (const st of sf.statements) {
    if (!ts.isExportDeclaration(st) || !st.exportClause) continue;
    if (!ts.isNamedExports(st.exportClause)) continue;
    for (const el of st.exportClause.elements) {
      const id = el.propertyName ?? el.name;
      if (ts.isIdentifier(id)) names.add(id.text);
    }
  }
  return names;
}

function stripRelativeImports(src) {
  return src
    .replace(/^import\s+type\s+[^;]+;\s*\n?/gm, "")
    .replace(/^import\s+[^;]+from\s+["']\.[^"']+["'];\s*\n?/gm, "");
}

function stripFileBanner(src) {
  return src.replace(/^\/\*\*[\s\S]*?Copyright[\s\S]*?\*\/\s*/m, "");
}

function declaredName(st, sf) {
  if (ts.isVariableStatement(st)) {
    const first = st.declarationList.declarations[0];
    return first ? first.name.getText(sf) : null;
  }
  return st.name && ts.isIdentifier(st.name) ? st.name.text : null;
}

function keepPublicOnly(body, publicNames, fileName) {
  const sf = ts.createSourceFile(fileName, body, ts.ScriptTarget.Latest, true);
  const kept = [];
  for (const st of sf.statements) {
    const name = declaredName(st, sf);
    if (!name || !publicNames.has(name)) continue;
    kept.push(body.slice(st.getFullStart(), st.getEnd()).trim());
  }
  return kept.join("\n\n");
}

const publicNames = readPublicNames();
const indexRaw = readFileSync(join(tmp, "index.d.ts"), "utf8");
const header = indexRaw.match(/^\/\*\*[\s\S]*?\*\//)?.[0] ?? "";

const parts = [header, ""];
for (const name of MODULES) {
  let body = readFileSync(join(tmp, `${name}.d.ts`), "utf8");
  body = stripRelativeImports(body);
  body = stripFileBanner(body).trim();
  body = keepPublicOnly(body, publicNames, `${name}.d.ts`);
  if (!body) continue;
  parts.push(`/* ${name} */`, body, "");
}

mkdirSync(dist, { recursive: true });
writeFileSync(join(dist, "index.d.ts"), `${parts.join("\n").trimEnd()}\n`);
rmSync(tmp, { recursive: true, force: true });
