/**
 * Configuration: tuning constants, motion presets, option resolution, and
 * direction helpers. Dependency-free — this is the base of the module graph.
 *
 * Copyright 2026 zhaochen <453157936@qq.com>
 * SPDX-License-Identifier: Apache-2.0
 * Licensed under the Apache License, Version 2.0. See LICENSE.
 */

import type { DirectionOption, MotionId, MotionPreset, MotionStyle, PeelOptions, ResolvedOptions } from "./types.js";

export const BIRTH_JITTER_MS = 74;
export const BOTTOM_SWEEP_MS = 46;
export const PEEL_MS = 1800;
export const PEEL_LEAD_IN_MS = 200;
export const PEEL_SPAWN_SCALE = 0.96;
export const PALE_SPAWN_SCALE = 0.72;
export const PARTICLE_LIFE_MS = 900;
export const PEEL_TAIL_FADE_MS = 180;
export const SIZE_UNIT = 1;
export const DEFAULT_MAX_PARTICLES = 48000;
export const FX_CANVAS_Z = 10090;
export const PEEL_OVERSHOOT = 1.12;

export const TOTAL_DURATION_MS =
  PEEL_LEAD_IN_MS + PEEL_MS + PEEL_TAIL_FADE_MS + BIRTH_JITTER_MS + BOTTOM_SWEEP_MS;

export const RANDOM_PEEL_ANGLES: readonly number[] = Object.freeze([
  180, 200, 225, 250, 270, 290, 315, 340, 0, 45,
]);

export const MOTION_PRESETS: Readonly<Record<string, MotionPreset>> = Object.freeze({
  drift: Object.freeze({
    label: "飘散挤压",
    flow: 1, radial: 0, spiral: 0, spiralTurns: 0,
    sCurve: 1, gravity: 0, compress: 1, spread: 0.26,
  }),
  spiral: Object.freeze({
    label: "螺旋",
    flow: 1, radial: 0.15, spiral: 1.15, spiralTurns: 1.35,
    sCurve: 0.35, gravity: 0, compress: 0.55, spread: 0.32,
  }),
  scatter: Object.freeze({
    label: "四散",
    flow: 0.35, radial: 1, spiral: 0, spiralTurns: 0,
    sCurve: 0.25, gravity: 0.15, compress: 0.2, spread: 0.85,
  }),
  cascade: Object.freeze({
    label: "坠落",
    flow: 0.75, radial: 0.1, spiral: 0, spiralTurns: 0,
    sCurve: 0.55, gravity: 1.35, compress: 0.4, spread: 0.4,
  }),
  vortex: Object.freeze({
    label: "漩涡",
    flow: 0.2, radial: 0.55, spiral: 1.7, spiralTurns: 2.1,
    sCurve: 0.15, gravity: 0, compress: 0.1, spread: 0.5,
  }),
  ribbon: Object.freeze({
    label: "丝带",
    flow: 1, radial: 0, spiral: 0, spiralTurns: 0,
    sCurve: 1.85, gravity: 0.05, compress: 0.85, spread: 0.18,
  }),
});

export const MOTION_IDS: readonly MotionId[] = Object.freeze(
  Object.keys(MOTION_PRESETS) as MotionId[],
);

export const PEEL_DEFAULTS = Object.freeze({
  motion: "random" as const,
  speed: 1,
  density: 1,
  turbulence: 1.05,
  bend: 1.1,
  size: 1.5,
  spray: 2.15,
  direction: "auto" as const,
  morph: 1,
  peelMs: PEEL_MS,
  lifeMs: PARTICLE_LIFE_MS,
  peelLeadInMs: PEEL_LEAD_IN_MS,
  birthJitterMs: BIRTH_JITTER_MS,
  bottomSweepMs: BOTTOM_SWEEP_MS,
  peelTailFadeMs: PEEL_TAIL_FADE_MS,
  peelSpawnScale: PEEL_SPAWN_SCALE,
  paleSpawnScale: PALE_SPAWN_SCALE,
  scale: 2,
  maxParticles: DEFAULT_MAX_PARTICLES,
  motionStyle: null,
});

export function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

export function scaleTime(ms: number | undefined, inv: number, min: number): number {
  return Math.max(min, (ms ?? min) * inv);
}

export function pickMotionId(motion?: string): MotionId {
  if (motion && motion in MOTION_PRESETS) {
    return motion as MotionId;
  }
  return MOTION_IDS[(Math.random() * MOTION_IDS.length) | 0]!;
}

export function listMotions(): { id: string; label: string }[] {
  return [
    { id: "random", label: "随机" },
    ...MOTION_IDS.map((id) => ({ id, label: MOTION_PRESETS[id]!.label })),
  ];
}

export function resolvePeelDirection(
  rect?: { left?: number; width?: number },
  requested: DirectionOption = "auto",
): number {
  if (typeof requested === "number" && Number.isFinite(requested)) {
    return ((requested % 360) + 360) % 360;
  }
  if (requested === "random") {
    return RANDOM_PEEL_ANGLES[(Math.random() * RANDOM_PEEL_ANGLES.length) | 0]!;
  }
  const viewportWidth = globalThis.innerWidth || 1;
  const centreX = (rect?.left ?? 0) + (rect?.width ?? 0) * 0.5;
  return centreX <= viewportWidth - centreX ? 225 : 315;
}

export function prefersReducedMotion(): boolean {
  try {
    return globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;
  } catch {
    return false;
  }
}

export function resolvePeelOptions(options: PeelOptions = {}): ResolvedOptions {
  const requested = options.motion ?? PEEL_DEFAULTS.motion;
  const name = pickMotionId(requested);
  const preset: MotionStyle = MOTION_PRESETS[name] ?? MOTION_PRESETS.drift!;

  const merged = { ...PEEL_DEFAULTS, ...options, motion: name };
  const style: MotionStyle = {
    ...preset,
    ...(merged.motionStyle && typeof merged.motionStyle === "object" ? merged.motionStyle : null),
  };

  const speed = Math.max(0.25, Math.min(4, Number(merged.speed) || 1));
  const inv = 1 / speed;

  return {
    ...merged,
    style,
    speed,
    peelMs: scaleTime(merged.peelMs, inv, 80),
    lifeMs: scaleTime(merged.lifeMs, inv, 120),
    peelLeadInMs: scaleTime(merged.peelLeadInMs, inv, 0),
    birthJitterMs: scaleTime(merged.birthJitterMs, inv, 0),
    bottomSweepMs: scaleTime(merged.bottomSweepMs, inv, 0),
    peelTailFadeMs: scaleTime(merged.peelTailFadeMs, inv, 40),
    spray: merged.spray * (speed < 1 ? speed : 0.85 + 0.15 * speed),
  };
}