/**
 * Rendering layer: the shared FX canvas, the CSS mask peel over live DOM,
 * per-particle drawing, and the RAF scheduler that drives concurrent runs.
 *
 * Copyright 2026 zhaochen <453157936@qq.com>
 * SPDX-License-Identifier: Apache-2.0
 * Licensed under the Apache License, Version 2.0. See LICENSE.
 */

import {
  FX_CANVAS_Z,
  PEEL_TAIL_FADE_MS,
  PEEL_MS,
  PEEL_LEAD_IN_MS,
  PEEL_OVERSHOOT,
} from "./config.js";
import { integrateParticle } from "./particles.js";
import type { PeelResult, PeelRun, Particle, PeelState } from "./types.js";

let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let width = 0;
let height = 0;
let dpr = 1;
let resizeBound = false;

export function getDpr(): number {
  return dpr;
}

export function getFxContext(): CanvasRenderingContext2D | null {
  return ctx;
}

export function getViewport(): { w: number; h: number } {
  return { w: width, h: height };
}

export function resizeFxCanvas(): void {
  if (!canvas || !ctx) return;
  dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
  width = globalThis.innerWidth;
  height = globalThis.innerHeight;
  const nextW = Math.floor(width * dpr);
  const nextH = Math.floor(height * dpr);
  if (canvas.width !== nextW || canvas.height !== nextH) {
    canvas.width = nextW;
    canvas.height = nextH;
  }
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

export function ensureFxCanvas(): void {
  if (!canvas?.isConnected) {
    canvas = document.createElement("canvas");
    canvas.id = "domParticlePeelFx";
    canvas.setAttribute("aria-hidden", "true");
    Object.assign(canvas.style, {
      position: "fixed",
      inset: "0",
      zIndex: String(FX_CANVAS_Z),
      pointerEvents: "none",
      display: "none",
    });
    document.body.append(canvas);
    ctx = canvas.getContext("2d", { alpha: true });
    resizeFxCanvas();
    if (!resizeBound) {
      resizeBound = true;
      globalThis.addEventListener("resize", resizeFxCanvas);
    }
  }
  if (canvas) canvas.style.display = "block";
}

export function hideFxCanvas(): void {
  if (canvas) canvas.style.display = "none";
  if (ctx) ctx.clearRect(0, 0, width, height);
}

function clearFxCanvas(): void {
  ctx?.clearRect(0, 0, width, height);
}

export function destroyFxCanvas(): void {
  canvas?.remove();
  canvas = null;
  ctx = null;
  width = 0;
  height = 0;
}

export const PEEL_MASK_RESET: Record<string, string> = {
  maskImage: "",
  webkitMaskImage: "",
  maskSize: "",
  webkitMaskSize: "",
  maskRepeat: "",
  webkitMaskRepeat: "",
};

const FEATHER = 0.08;

const WAVE_PROGRESS_CLAMP = PEEL_OVERSHOOT;

function toElement(target: HTMLElement | PeelState | null | undefined): HTMLElement | null {
  if (!target) return null;
  if (target instanceof HTMLElement) return target;
  return target.element ?? null;
}

export function clearDomPeel(target: HTMLElement | PeelState | null | undefined): void {
  const el = toElement(target);
  if (el) Object.assign(el.style, PEEL_MASK_RESET);
}

export function hideElementSoft(el: HTMLElement | null | undefined): void {
  if (el) el.style.visibility = "hidden";
}

export function resetElChrome(el: HTMLElement | null | undefined): void {
  if (!el) return;
  el.style.visibility = "";
  el.style.pointerEvents = "";
}

export function applyPeelMask(
  peel: PeelState,
  now: number,
  t0: number,
): void {
  const el = peel.element;
  if (!el?.isConnected) return;

  const peelMs = peel.peelMs ?? PEEL_MS;
  const leadIn = peel.peelLeadInMs ?? PEEL_LEAD_IN_MS;
  const wave = Math.min(WAVE_PROGRESS_CLAMP, Math.max(0, now - t0 - leadIn) / peelMs);

  if (wave <= 0.0005) {
    clearDomPeel(el);
    return;
  }
  if (wave >= PEEL_OVERSHOOT) {
    hideElementSoft(el);
    clearDomPeel(el);
    return;
  }

  const edgeIn = Math.max(0, wave - FEATHER);
  const edgeOut = Math.min(1, wave + FEATHER);
  const cssDeg = (peel.direction ?? 0) + 90;
  const stops = ["rgba(0,0,0,0) 0%"];
  if (edgeIn > 0.002) stops.push(`rgba(0,0,0,0) ${(edgeIn * 100).toFixed(2)}%`);
  if (edgeOut < 0.998 && edgeOut > edgeIn + 0.002) {
    stops.push(`rgba(0,0,0,1) ${(edgeOut * 100).toFixed(2)}%`);
  }
  stops.push("rgba(0,0,0,1) 100%");

  const gradient = `linear-gradient(${cssDeg}deg, ${stops.join(", ")})`;
  Object.assign(el.style, {
    maskImage: gradient,
    webkitMaskImage: gradient,
    maskSize: "100% 100%",
    webkitMaskSize: "100% 100%",
    maskRepeat: "no-repeat",
    webkitMaskRepeat: "no-repeat",
  });
}

export function isPeelComplete(
  peel: PeelState,
  now: number,
  t0: number,
  peelTailFadeMs?: number,
): boolean {
  const leadIn = peel.peelLeadInMs ?? PEEL_LEAD_IN_MS;
  const fade = peelTailFadeMs ?? PEEL_TAIL_FADE_MS;
  return now - t0 >= leadIn + (peel.peelMs ?? PEEL_MS) * PEEL_OVERSHOOT + fade;
}

export type DrawState = "waiting" | "live" | "done";

export function drawParticle(p: Particle, now: number): DrawState {
  if (now < p.born) return "waiting";
  if (p.start < 0) p.start = now;

  const lifeK = (now - p.start) / p.lifeMs;
  if (lifeK >= 1) return "done";

  const context = getFxContext();
  if (!context) return "done";

  const pose = integrateParticle(p, lifeK, now - p.start);
  let fade = pose.fade;

  if (p.peelEnd != null && now >= p.peelEnd) {
    const tailFadeMs = p.peelTailFadeMs ?? PEEL_TAIL_FADE_MS;
    const tailK = tailFadeMs <= 0 ? 1 : (now - p.peelEnd) / tailFadeMs;
    if (tailK >= 1) return "done";
    fade *= 1 - tailK;
  }

  context.globalAlpha = fade * p.alpha;
  context.save();
  context.translate(pose.x, pose.y);
  context.rotate(Math.atan2(pose.hy, pose.hx));
  context.beginPath();
  context.ellipse(0, 0, pose.rx, pose.ry, 0, 0, Math.PI * 2);
  context.fillStyle = `rgb(${p.r},${p.g},${p.b})`;
  context.fill();
  context.restore();

  return "live";
}

let activePeels: PeelRun[] = [];
let rafId = 0;

export function activePeelCount(): number {
  return activePeels.length;
}

function stopFrameLoop(): void {
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = 0;
  }
}

function finishPeel(
  peel: PeelRun,
  result: PeelResult,
  { hide = true }: { hide?: boolean } = {},
): void {
  clearDomPeel(peel.peel);
  if (hide) hideElementSoft(peel.peel.element);
  peel.resolve(result);
}

function finishAllPeels(result?: PeelResult): void {
  const peels = activePeels;
  activePeels = [];
  hideFxCanvas();
  for (const peel of peels) {
    finishPeel(
      peel,
      result ?? { cancelled: true, particleCount: peel.particleCount },
    );
  }
}

export function cancelPeelsForElement(el: HTMLElement): void {
  if (!el || !activePeels.length) return;

  const kept: PeelRun[] = [];
  const dropped: PeelRun[] = [];
  for (const peel of activePeels) {
    (peel.peel.element === el ? dropped : kept).push(peel);
  }
  if (!dropped.length) return;

  activePeels = kept;
  for (const peel of dropped) {
    finishPeel(peel, { cancelled: true, particleCount: peel.particleCount }, { hide: false });
  }
  if (!activePeels.length) {
    stopFrameLoop();
    hideFxCanvas();
  }
}

function syncPeelMasks(now: number): void {
  for (const peel of activePeels) {
    if (peel.peel && peel.t0 != null) {
      try {
        applyPeelMask(peel.peel, now, peel.t0);
      } catch {}
    }
  }
}

function renderFrame(now: number): void {
  rafId = 0;
  const context = getFxContext();
  if (!context) {
    finishAllPeels({ cancelled: true, particleCount: 0 });
    return;
  }

  try {
    clearFxCanvas();
    let keepGoing = false;
    const finished: PeelRun[] = [];

    for (const peel of activePeels) {
      if (peel.peel && peel.t0 != null) {
        try {
          applyPeelMask(peel.peel, now, peel.t0);
        } catch (error) {
          console.warn("[particle-dismiss] peel mask failed", error);
        }
      }

      let live = 0;
      let waiting = 0;
      for (const p of peel.particles) {
        const state = drawParticle(p, now);
        if (state === "waiting") waiting++;
        else if (state === "live") live++;
      }

      if (live === 0 && waiting === 0 && isPeelComplete(peel.peel, now, peel.t0, peel.peelTailFadeMs)) {
        finished.push(peel);
      } else {
        keepGoing = true;
      }
    }
    context.globalAlpha = 1;

    for (const peel of finished) {
      const i = activePeels.indexOf(peel);
      if (i >= 0) activePeels.splice(i, 1);
      finishPeel(peel, { cancelled: false, particleCount: peel.particleCount });
    }

    if (keepGoing || activePeels.length > 0) {
      rafId = requestAnimationFrame(renderFrame);
    } else {
      hideFxCanvas();
    }
  } catch (error) {
    console.warn("[particle-dismiss] frame failed", error);
    if (activePeels.length > 0) rafId = requestAnimationFrame(renderFrame);
  }
}

function startFrameLoop(now?: number): void {
  if (rafId) {
    if (now != null) syncPeelMasks(now);
    return;
  }
  if (now != null) renderFrame(now);
  else rafId = requestAnimationFrame(renderFrame);
}

export function addPeel(peel: PeelRun, now: number): void {
  activePeels.push(peel);
  startFrameLoop(now);
}

export function cancelAllPeels(): void {
  stopFrameLoop();
  if (activePeels.length) finishAllPeels({ cancelled: true, particleCount: 0 });
}

export function restoreElement(el: HTMLElement): void {
  clearDomPeel(el);
  resetElChrome(el);
}
