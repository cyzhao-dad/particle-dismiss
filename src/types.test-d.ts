/**
 * Type-level smoke test — verified by `npm run typecheck`.
 * Compiles only; nothing here runs.
 *
 * Public surface is imported from the barrel; internal helpers are imported
 * from their own modules, mirroring how they are used inside the package.
 *
 * Copyright 2026 zhaochen <453157936@qq.com>
 * SPDX-License-Identifier: Apache-2.0
 * Licensed under the Apache License, Version 2.0. See LICENSE.
 */

import {
  createPeelCloser,
  peelElement,
  cancelAllPeels,
  listMotions,
  resolvePeelDirection,
  PEEL_DEFAULTS,
  MOTION_PRESETS,
} from "./index.js";

import type {
  DirectionOption,
  MotionId,
  MotionStyle,
  PeelCloser,
  PeelOptions,
  PeelResult,
} from "./index.js";

import { resolvePeelOptions, RANDOM_PEEL_ANGLES } from "./config.js";
import { parseColor, snapshotElement, type Rgba } from "./capture.js";
import {
  integrateParticle,
  sampleParticles,
  type ParticlePose,
  type ParticleSample,
} from "./particles.js";
import { applyPeelMask } from "./renderer.js";
import type { ElementSnapshot, Particle, PeelState } from "./types.js";

declare const panel: HTMLElement;

const closer: PeelCloser = createPeelCloser("panel");

await closer.close(panel, {
  motion: "spiral",
  size: 1.5,
  direction: 180,
  speed: 1.2,
  hide: () => {},
});

const chunky = createPeelCloser("toast", { size: 2, motionStyle: { gravity: 0 } });
const closing: boolean = chunky.isClosing;
chunky.abort();

const result: PeelResult = await peelElement(panel, { motion: "random" });
const particleCount: number = result.particleCount;
const cancelled: boolean = result.cancelled;

cancelAllPeels();

const autoAngle: number = resolvePeelDirection(panel.getBoundingClientRect(), "auto");
const randomAngle: number = resolvePeelDirection(panel.getBoundingClientRect(), "random");
const fixedAngle: number = resolvePeelDirection(undefined, 90);
const randomAngles: readonly number[] = RANDOM_PEEL_ANGLES;

const opts = resolvePeelOptions({ speed: 2, motion: "vortex" });
const style: MotionStyle = opts.style;
const peelMs: number = opts.peelMs;

const motions: { id: string; label: string }[] = listMotions();

const partial: PeelOptions = {
  motion: "cascade",
  direction: "random",
  density: 0.5,
  maxParticles: 12000,
  motionStyle: { spiralTurns: 2.6 },
  onHide: () => {},
};
void partial;

const dirFixed: DirectionOption = 270;
const dirAuto: DirectionOption = "auto";
const dirRand: DirectionOption = "random";
void [dirFixed, dirAuto, dirRand];

const known: MotionId = "ribbon";
void [known];

void [PEEL_DEFAULTS.size, MOTION_PRESETS.drift.spread];

declare const p: Particle;
void [p.originX, p.originY, p.r, p.g, p.b, p.lifeMs, p.size, p.alpha];

declare const pose: ParticlePose;
void [pose.x, pose.y, pose.fade, pose.rx, pose.ry];

declare const rgba: Rgba;
void rgba[0];

declare const peelState: PeelState;
declare const snapshot: ElementSnapshot;
void applyPeelMask;
void peelState;
void snapshot;
void snapshotElement;

const parsed: Rgba | null = parseColor("#abc4");
void parsed;

declare const sample: ParticleSample;
void sample.peelState.direction;
void sampleParticles;

const pose2: ParticlePose = integrateParticle(
  {
    originX: 0, originY: 0, dx: 1, dy: 0,
    endSpeed: 100, lifeMs: 900, seed: 0, bend: 0, size: 1,
  },
  0.5,
  450,
);
void pose2;

void [
  closing, particleCount, cancelled,
  autoAngle, randomAngle, fixedAngle, randomAngles,
  style, peelMs, motions,
];
