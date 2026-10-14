/**
 * DOM capture: CSS colour parsing + approximate element snapshotting.
 *
 * The snapshot is deliberately simple — no font metrics, no UA widget chrome,
 * no shadows. It only needs to supply plausible RGB where the real DOM is
 * visible; the visible element itself is peeled with a CSS mask.
 *
 * Copyright 2026 zhaochen <453157936@qq.com>
 * SPDX-License-Identifier: Apache-2.0
 * Licensed under the Apache License, Version 2.0. See LICENSE.
 */

import type { ElementSnapshot } from "./types.js";

export type Rgba = [number, number, number, number];

export function parseColor(input: string | null | undefined): Rgba | null {
  if (!input || input === "transparent" || input === "none") return null;
  const str = String(input).trim();

  if (str[0] === "#") {
    const h = str.slice(1);
    if (h.length === 3 || h.length === 4) {
      const r = parseInt(h[0]! + h[0]!, 16);
      const g = parseInt(h[1]! + h[1]!, 16);
      const b = parseInt(h[2]! + h[2]!, 16);
      const a = h.length === 4 ? parseInt(h[3]! + h[3]!, 16) : 255;
      if ([r, g, b, a].some((n) => Number.isNaN(n))) return null;
      return [r, g, b, a];
    }
    if (h.length === 6 || h.length === 8) {
      const r = parseInt(h.slice(0, 2), 16);
      const g = parseInt(h.slice(2, 4), 16);
      const b = parseInt(h.slice(4, 6), 16);
      const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) : 255;
      if ([r, g, b, a].some((n) => Number.isNaN(n))) return null;
      return [r, g, b, a];
    }
    return null;
  }

  const m = str.match(
    /rgba?\(\s*([\d.]+)[%]?[,\s/]+([\d.]+)[%]?[,\s/]+([\d.]+)[%]?(?:[,/\s]+([\d.]+%?))?\s*\)/i,
  );
  if (!m) return null;

  let a = 255;
  if (m[4] !== undefined) {
    a = String(m[4]).includes("%") ? parseFloat(m[4]) * 2.55 : parseFloat(m[4]) * 255;
  }
  return [
    Math.round(+m[1]),
    Math.round(+m[2]),
    Math.round(+m[3]),
    Math.round(a),
  ];
}

export function cssPaint(c: Rgba): string {
  if (c[3] >= 242) return `rgb(${c[0]},${c[1]},${c[2]})`;
  return `rgba(${c[0]},${c[1]},${c[2]},${(c[3] / 255).toFixed(3)})`;
}

export function extractColors(css: string | null | undefined): Rgba[] {
  const cols = css?.match(/rgba?\([^)]*\)|#[0-9a-fA-F]{3,8}\b/g) || [];
  const out: Rgba[] = [];
  for (const c of cols) {
    const p = parseColor(c);
    if (p && p[3] > 2) out.push(p);
  }
  return out;
}

const FALLBACK_PAINT = "rgb(18,28,48)";
const DEFAULT_ACCENT_COLOR: Rgba = [56, 189, 248, 255];

type FillStyle = string | CanvasGradient;

function makeGradient(
  g: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  css: string,
): FillStyle {
  const m = css.match(/(-?[\d.]+)deg/);
  const deg = m ? parseFloat(m[1]!) : 180;
  const rad = ((deg - 90) * Math.PI) / 180;
  const dx = Math.cos(rad);
  const dy = Math.sin(rad);
  const len = Math.abs(w * dx) + Math.abs(h * dy);

  const gr = g.createLinearGradient(
    x + w / 2 - (dx * len) / 2,
    y + h / 2 - (dy * len) / 2,
    x + w / 2 + (dx * len) / 2,
    y + h / 2 + (dy * len) / 2,
  );

  const parsed = extractColors(css);
  if (!parsed.length) return FALLBACK_PAINT;
  if (parsed.length === 1) {
    gr.addColorStop(0, cssPaint(parsed[0]!));
    gr.addColorStop(1, cssPaint(parsed[0]!));
  } else {
    parsed.forEach((p, i) => gr.addColorStop(i / (parsed.length - 1), cssPaint(p)));
  }
  return gr;
}

function baseFill(cs: CSSStyleDeclaration): string {
  if (cs.backgroundImage && /gradient/.test(cs.backgroundImage)) {
    const cols = extractColors(cs.backgroundImage);
    if (cols[0]) return cssPaint(cols[0]);
  }
  const bg = parseColor(cs.backgroundColor);
  if (bg && bg[3] > 2) return cssPaint(bg);
  return FALLBACK_PAINT;
}

function roundRect(
  g: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
): void {
  r = Math.min(Math.max(0, r), w / 2, h / 2);
  g.beginPath();
  if (!r) {
    g.rect(x, y, w, h);
    return;
  }
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function readRadius(cs: CSSStyleDeclaration, w: number, h: number): number {
  const basis = Math.min(w, h);
  const raw = cs.borderTopLeftRadius || "0";
  const token = String(raw).trim().split(/\s+/)[0];
  if (!token || token === "0") return 0;
  if (token.endsWith("%")) return (parseFloat(token) / 100) * basis;
  return parseFloat(token) || 0;
}

function fillBox(
  g: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, rad: number, style: FillStyle,
): void {
  if (w < 0.5 || h < 0.5) return;
  g.fillStyle = style;
  roundRect(g, x, y, w, h, rad);
  g.fill();
}

function stampInk(
  g: CanvasRenderingContext2D,
  node: Node,
  cs: CSSStyleDeclaration,
  x: number, y: number, w: number, h: number,
  originX: number, originY: number,
): void {
  const color = parseColor(cs.color);
  if (color && color[3] > 40) {
    const ink = `rgba(${color[0]},${color[1]},${color[2]},0.85)`;
    for (const child of node.childNodes) {
      if (child.nodeType !== 3 || !/\S/.test(child.nodeValue || "")) {
        continue;
      }
      try {
        const range = document.createRange();
        range.selectNodeContents(child);
        for (const box of range.getClientRects()) {
          if (box.width < 1 || box.height < 1) continue;
          g.fillStyle = ink;
          g.fillRect(box.left - originX, box.top - originY, box.width, box.height);
        }
      } catch {}
    }
  }

  if (!(node instanceof HTMLInputElement)) return;

  const accent = parseColor(cs.accentColor) ?? DEFAULT_ACCENT_COLOR;
  const aw = Math.max(10, Math.min(w || 14, 18));
  const ah = Math.max(10, Math.min(h || 14, 18));
  const ax = x + Math.max(0, (w - aw) * 0.5);
  const ay = y + Math.max(0, (h - ah) * 0.5);

  if (node.type === "checkbox") {
    fillBox(g, ax, ay, aw, ah, 3,
      node.checked ? `rgb(${accent[0]},${accent[1]},${accent[2]})` : "rgb(232,240,255)");
  } else if (node.type === "range" && w > 8) {
    const t = 4;
    fillBox(g, x, y + (h - t) * 0.5, w, t, t * 0.5, "rgba(255,255,255,0.2)");
    fillBox(g, x, y + (h - t) * 0.5, w * 0.45, t, t * 0.5,
      `rgb(${accent[0]},${accent[1]},${accent[2]})`);
  }
}

export function snapshotElement(el: HTMLElement, scale = 2): ElementSnapshot {
  const cssWidth = el.offsetWidth;
  const cssHeight = el.offsetHeight;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(cssWidth * scale));
  canvas.height = Math.max(1, Math.round(cssHeight * scale));
  const maybeContext = canvas.getContext("2d", { willReadFrequently: true });
  if (!maybeContext) throw new Error("[particle-dismiss] 2D context unavailable");
  const ctx: CanvasRenderingContext2D = maybeContext;
  ctx.scale(scale, scale);

  const rootRect = el.getBoundingClientRect();
  const originX = rootRect.left;
  const originY = rootRect.top;
  const rootStyle = getComputedStyle(el);
  const rootRadius = readRadius(rootStyle, cssWidth, cssHeight);

  ctx.clearRect(0, 0, cssWidth, cssHeight);
  ctx.save();
  roundRect(ctx, 0, 0, cssWidth, cssHeight, rootRadius);
  ctx.clip();
  fillBox(ctx, 0, 0, cssWidth, cssHeight, rootRadius, baseFill(rootStyle));

  function paint(node: Element): void {
    const style = getComputedStyle(node);
    if (style.display === "none" || style.visibility === "hidden") return;
    if (parseFloat(style.opacity) === 0) return;

    const r = node.getBoundingClientRect();
    let w = r.width;
    let h = r.height;
    if (node instanceof HTMLInputElement && (w < 4 || h < 4)) {
      w = Math.max(w, node.offsetWidth || 14);
      h = Math.max(h, node.offsetHeight || 14);
    }
    if (w < 0.5 || h < 0.5) return;

    const x = r.left - originX;
    const y = r.top - originY;
    const radius = readRadius(style, w, h);

    const background = parseColor(style.backgroundColor);
    if (background && background[3] > 2) {
      fillBox(ctx, x, y, w, h, radius, cssPaint(background));
    }
    if (style.backgroundImage && /gradient/.test(style.backgroundImage)) {
      fillBox(ctx, x, y, w, h, radius, makeGradient(ctx, x, y, w, h, style.backgroundImage));
    }

    stampInk(ctx, node, style, x, y, w, h, originX, originY);

    for (const ch of node.children) paint(ch);
  }

  for (const ch of el.children) paint(ch);
  stampInk(ctx, el, rootStyle, 0, 0, cssWidth, cssHeight, originX, originY);

  ctx.restore();
  return { canvas, w: cssWidth, h: cssHeight, scale };
}