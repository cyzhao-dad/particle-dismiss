/**
 * Zero-dependency static server for the demo page.
 *
 * index.html imports ./dist/index.js as an ES module, which browsers refuse to
 * load over file://. Run `npm run build` first, then `npm run serve`.
 *
 * Copyright 2026 zhaochen <453157936@qq.com>
 * SPDX-License-Identifier: Apache-2.0
 */
import { createServer } from "node:http";
import { createReadStream, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const port = Number(process.env.PORT) || 8080;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

function resolveFile(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0] || "/");
  const rel = normalize(decoded).replace(/^([/\\]|\.\.)+/, "");
  let filePath = join(root, rel);
  if (!filePath.startsWith(root)) return null;
  try {
    if (statSync(filePath).isDirectory()) filePath = join(filePath, "index.html");
    if (statSync(filePath).isFile()) return filePath;
  } catch {
    return null;
  }
  return null;
}

createServer((req, res) => {
  const filePath = resolveFile(req.url || "/");
  if (!filePath) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("404 Not Found");
    return;
  }
  res.writeHead(200, {
    "content-type": MIME[extname(filePath).toLowerCase()] ?? "application/octet-stream",
    "cache-control": "no-store",
  });
  createReadStream(filePath).pipe(res);
}).listen(port, () => {
  console.log(`particle-dismiss demo → http://localhost:${port}/`);
});
