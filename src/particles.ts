/**
 * Particle system: spawn parameters, trajectory integration, and building a
 * particle list from a DOM colour map.
 *
 * Pure math — no DOM access beyond reading the snapshot bitmap.
 *
 * Copyright 2026 zhaochen <453157936@qq.com>
 * SPDX-License-Identifier: Apache-2.0
 * Licensed under the Apache License, Version 2.0. See LICENSE.
 */

import {
  PEEL_DEFAULTS,
  SIZE_UNIT,
  MOTION_PRESETS,
  PALE_SPAWN_SCALE,
  PEEL_SPAWN_SCALE,
  clamp01,
  resolvePeelDirection,
  smoothstep,
} from "./config.js";
import type {
  ElementSnapshot,
  MotionStyle,
  Particle,
  PeelState,
  ResolvedOptions,
} from "./types.js";

export interface ParticleProfile {
  speedMul: number;
  lifeMul: number;
  turbulenceAmp: number;
  bend: number;
  swayAmp: number;
  size: number;
}

export function rollParticleProfile(isPale: boolean): ParticleProfile {
  if (isPale) {
    return {
      speedMul: 1.05 + Math.random() * 0.2,
      lifeMul: 0.95 + Math.random() * 0.15,
      turbulenceAmp: 1.05,
      bend: 1,
      swayAmp: 0.75,
      size: 0.85 + Math.random() * 0.25,
    };
  }
  if (Math.random() < 0.38) {
    return {
      speedMul: 0.42 + Math.random() * 0.22,
      lifeMul: 1.45 + Math.random() * 0.35,
      turbulenceAmp: 0.75,
      bend: 0.7,
      swayAmp: 1.35,
      size: 1,
    };
  }
  return { speedMul: 1, lifeMul: 1, turbulenceAmp: 1, bend: 1, swayAmp: 1, size: 1 };
}

function spawnDirection(
  peelAngleDeg: number,
  style: MotionStyle,
  offsetX: number,
  offsetY: number,
): { dx: number; dy: number } {
  const flowRad = (peelAngleDeg * Math.PI) / 180;
  const spread = (Math.pow(Math.random(), 1.5) * 2 - 1) * (style.spread ?? 0.26);
  const flowX = Math.cos(flowRad + spread);
  const flowY = Math.sin(flowRad + spread);

  const len = Math.hypot(offsetX, offsetY) || 1;
  const radX = offsetX / len;
  const radY = offsetY / len;
  const tanX = -radY;
  const tanY = radX;

  const flowWeight = style.flow ?? 1;
  const radialWeight = style.radial ?? 0;
  const spinWeight = (style.spiral ?? 0) > 0.8 && radialWeight > 0.3 ? 0.55 : 0;
  const side = Math.random() < 0.5 ? 1 : -1;

  let dx = flowX * flowWeight + radX * radialWeight + tanX * spinWeight * side;
  let dy = flowY * flowWeight + radY * radialWeight + tanY * spinWeight * side;
  const dlen = Math.hypot(dx, dy) || 1;
  return { dx: dx / dlen, dy: dy / dlen };
}

export interface ParticleSpawn {
  dx: number;
  dy: number;
  endSpeed: number;
  seed: number;
  turbulenceAmp: number;
  bend: number;
  swayAmp: number;
  swaySign: number;
  alpha: number;
  lifeMs: number;
}

export function spawnParticle(
  peelAngleDeg: number,
  sprayK: number,
  bendK: number,
  lifeMs: number,
  style: MotionStyle,
  offsetX: number,
  offsetY: number,
): ParticleSpawn {
  const { dx, dy } = spawnDirection(peelAngleDeg, style, offsetX, offsetY);
  return {
    dx,
    dy,
    endSpeed: (180 + Math.pow(Math.random(), 0.7) * 480) * sprayK,
    seed: Math.random() * Math.PI * 2,
    turbulenceAmp: 1.1 + Math.random() * 1.3,
    bend: (Math.random() * 2 - 1) * (8 + Math.random() * 28) * bendK,
    swayAmp: (12 + Math.random() * 32) * bendK,
    swaySign: Math.random() < 0.5 ? 1 : -1,
    alpha: 1,
    lifeMs,
  };
}

export interface ParticlePose {
  x: number;
  y: number;
  hx: number;
  hy: number;
  fade: number;
  rx: number;
  ry: number;
}

export interface ParticleMotionInput {
  originX: number;
  originY: number;
  dx: number;
  dy: number;
  endSpeed: number;
  lifeMs: number;
  seed: number;
  bend: number;
  size: number;
  swayAmp?: number;
  swaySign?: number;
  turbulenceAmp?: number;
  morph?: number;
  waveTail?: number;
  offsetX?: number;
  offsetY?: number;
  isPale?: boolean;
  style?: MotionStyle;
}

export function integrateParticle(
  p: ParticleMotionInput,
  k: number,
  elapsed: number,
): ParticlePose {
  const morph = p.morph ?? 1;
  const waveTail = p.waveTail ?? 0.5;
  const style = p.style || MOTION_PRESETS.drift!;

  const paleBoost = p.isPale ? 1.08 + 0.12 * (1 - k) : 1;
  const tailStretch =
    (1 + morph * (0.75 * waveTail + 0.35 * waveTail * waveTail) * (1 - k * 0.2)) * paleBoost;

  const acc = 0.5 * p.endSpeed * (p.lifeMs / 1000);
  const s = acc * (0.4 * k + 0.6 * k * k) * tailStretch;

  let x = p.originX + p.dx * s;
  let y = p.originY + p.dy * s;

  const radial = style.radial ?? 0;
  if (radial > 0.01) {
    const r0 = Math.hypot(p.offsetX ?? 0, p.offsetY ?? 0) || 1;
    const push = s * radial * 0.35 * (0.4 + 0.6 * k);
    x += ((p.offsetX ?? 0) / r0) * push;
    y += ((p.offsetY ?? 0) / r0) * push;
  }

  const spiral = style.spiral ?? 0;
  if (spiral > 0.01) {
    const turns = style.spiralTurns ?? 1.2;
    const ang = p.seed + k * Math.PI * 2 * turns;
    const rad = spiral * (6 + s * 0.08) * (0.25 + 0.75 * k);
    x += Math.cos(ang) * rad;
    y += Math.sin(ang) * rad;
  }

  const sCurveK = style.sCurve ?? 1;
  const sway = (p.swayAmp ?? 0) * (p.swaySign ?? 1) * sCurveK;
  let sDeriv = 0;
  if (Math.abs(sway) > 0.5) {
    const sCurve = Math.sin(k * Math.PI * 2) * sway * (0.35 + 0.65 * k);
    x += -p.dy * sCurve;
    y += p.dx * sCurve;
    sDeriv = Math.cos(k * Math.PI * 2) * Math.PI * 2 * sway * 0.04;
  }

  const gravity = style.gravity ?? 0;
  if (gravity > 0.01) {
    y += 0.5 * gravity * 520 * k * k;
  }

  const compressAmt = (style.compress ?? 1) * morph;
  const compress =
    compressAmt * smoothstep(0.08, 0.4, k) * (1 - smoothstep(0.45, 0.75, k));
  if (compress > 0.01) {
    const cross = -p.dy * (x - p.originX) + p.dx * (y - p.originY);
    const pull = cross * 0.35 * compress * (0.45 + 0.55 * waveTail);
    x += p.dy * pull;
    y += -p.dx * pull;
  }

  const gust = Math.sin(Math.PI * Math.min(1, k)) * k;
  const off = p.bend * gust * (0.6 + 0.5 * waveTail);
  x += -p.dy * off;
  y += p.dx * off;

  const turbulenceAmp = p.turbulenceAmp ?? 0;
  if (turbulenceAmp > 0) {
    const w = Math.sin(elapsed * 0.0036 + p.seed) * turbulenceAmp * (1 - k) * (2.6 + 1.8 * waveTail);
    x += -p.dy * w;
    y += p.dx * w;
  }

  const fade = k < 0.68 ? 1 : Math.max(0, 1 - Math.pow((k - 0.68) / 0.32, 1.35));

  const stretch = morph * waveTail * (style.compress ?? 1) * smoothstep(0.05, 0.4, k);
  const rx = Math.max(0.35, p.size * 0.5 * (1 + 0.75 * stretch));
  const ry = Math.max(0.25, p.size * 0.5 * (1 - 0.4 * stretch));

  const hx = p.dx - p.dy * sDeriv;
  const hy = p.dy + p.dx * sDeriv + gravity * k * 0.35;

  return { x, y, hx, hy, fade, rx, ry };
}

export interface ParticleSample {
  particles: Particle[];
  peelState: PeelState;
}

const PALE_LUMINANCE = 0.68;
const MIN_OPACITY = 128;
const PALE_SAMPLE_RATE = 0.48;

export function sampleParticles(
  snapshot: ElementSnapshot,
  rect: DOMRect,
  opts: ResolvedOptions,
  devicePixelRatio = 1,
): ParticleSample {
  const {
    density = PEEL_DEFAULTS.density,
    turbulence = PEEL_DEFAULTS.turbulence,
    size = PEEL_DEFAULTS.size,
    spray = PEEL_DEFAULTS.spray,
    bend = PEEL_DEFAULTS.bend,
    morph = PEEL_DEFAULTS.morph,
    peelMs = PEEL_DEFAULTS.peelMs,
    lifeMs = PEEL_DEFAULTS.lifeMs,
    birthJitterMs = PEEL_DEFAULTS.birthJitterMs,
    bottomSweepMs = PEEL_DEFAULTS.bottomSweepMs,
    paleSpawnScale = PALE_SPAWN_SCALE,
    peelSpawnScale = PEEL_SPAWN_SCALE,
    style = MOTION_PRESETS.drift!,
    peelLeadInMs = PEEL_DEFAULTS.peelLeadInMs,
  } = opts;

  let direction = opts.direction;
  if (direction == null || direction === "auto" || direction === "random") {
    direction = resolvePeelDirection(rect, direction ?? "auto");
  }

  const canvas = snapshot.canvas;
  const pixelWidth = canvas.width;
  const pixelHeight = canvas.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("[particle-dismiss] cannot read snapshot pixels");
  const data = ctx.getImageData(0, 0, pixelWidth, pixelHeight).data;

  const step = Math.max(2, Math.round(1.5 * devicePixelRatio));

  const particles: Particle[] = [];
  const centreX = rect.left + rect.width * 0.5;
  const centreY = rect.top + rect.height * 0.5;
  const halfWidth = Math.max(1, rect.width * 0.5);
  const halfHeight = Math.max(1, rect.height * 0.5);

  const peelRad = (direction * Math.PI) / 180;
  const flowX = Math.cos(peelRad);
  const flowY = Math.sin(peelRad);
  const alongExtent = Math.max(1, Math.abs(flowX) * halfWidth + Math.abs(flowY) * halfHeight);

  const peelDurationMs = Math.max(120, peelMs);
  const morphK = clamp01(morph);

  for (let y = step >> 1; y < pixelHeight; y += step) {
    for (let x = step >> 1; x < pixelWidth; x += step) {
      const i = (y * pixelWidth + x) * 4;
      if (data[i + 3]! < MIN_OPACITY || Math.random() > density) continue;

      const pr = data[i]!;
      const pg = data[i + 1]!;
      const pb = data[i + 2]!;

      const lum = (pr * 0.299 + pg * 0.587 + pb * 0.114) / 255;
      const maxC = Math.max(pr, pg, pb);
      const minC = Math.min(pr, pg, pb);
      const sat = maxC === 0 ? 0 : (maxC - minC) / maxC;
      const isPale = lum > PALE_LUMINANCE && sat < 0.32;
      if (isPale && Math.random() > PALE_SAMPLE_RATE) continue;

      const u = x / pixelWidth;
      const v = y / pixelHeight;
      const originX = rect.left + u * rect.width;
      const originY = rect.top + v * rect.height;
      const offsetX = originX - centreX;
      const offsetY = originY - centreY;

      const waveLead = clamp01(((flowX * offsetX + flowY * offsetY) / alongExtent + 1) * 0.5);
      const waveTail = 1 - waveLead;

      const spawn = spawnParticle(direction, spray, bend, lifeMs, style, offsetX, offsetY);
      const profile = rollParticleProfile(isPale);
      const morphSpeed = 1 + morphK * (0.9 * waveTail - 0.4 * waveLead);

      particles.push({
        originX, originY, offsetX, offsetY, waveLead, waveTail,
        morph: morphK,
        isPale,
        style,
        dx: spawn.dx,
        dy: spawn.dy,
        endSpeed: spawn.endSpeed * morphSpeed * profile.speedMul,
        seed: spawn.seed,
        turbulenceAmp: spawn.turbulenceAmp * turbulence * profile.turbulenceAmp,
        bend: spawn.bend * profile.bend,
        swayAmp: spawn.swayAmp * profile.swayAmp * (0.85 + 0.3 * waveTail),
        swaySign: spawn.swaySign,
        alpha: spawn.alpha,
        lifeMs: spawn.lifeMs * profile.lifeMul,
        size: SIZE_UNIT * size * profile.size,
        start: -1,
        born: 0,
        birthDelayMs:
          waveLead * peelDurationMs * (isPale ? paleSpawnScale : peelSpawnScale) +
          Math.random() * birthJitterMs +
          v * bottomSweepMs * 0.35,
        r: pr, g: pg, b: pb,
      });
    }
  }

  return {
    particles,
    peelState: { direction, peelMs: peelDurationMs, peelLeadInMs },
  };
}