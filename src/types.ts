/**
 * Shared types for particle-dismiss.
 *
 * Kept dependency-free so every other module can import types without
 * creating cycles.
 *
 * Copyright 2026 zhaochen <453157936@qq.com>
 * SPDX-License-Identifier: Apache-2.0
 * Licensed under the Apache License, Version 2.0. See LICENSE.
 */

export type MotionId = "drift" | "spiral" | "scatter" | "cascade" | "vortex" | "ribbon";

export type MotionOption = MotionId | "random" | (string & {});

export type DirectionOption = number | "auto" | "random";

export interface MotionStyle {
  flow: number;
  radial: number;
  spiral: number;
  spiralTurns: number;
  sCurve: number;
  gravity: number;
  compress: number;
  spread: number;
}

export type MotionPreset = Readonly<MotionStyle & { label: string }>;

export interface PeelOptions {
  motion?: MotionOption;
  direction?: DirectionOption;
  speed?: number;
  density?: number;
  turbulence?: number;
  bend?: number;
  size?: number;
  spray?: number;
  morph?: number;
  scale?: number;
  maxParticles?: number;
  peelMs?: number;
  lifeMs?: number;
  peelLeadInMs?: number;
  birthJitterMs?: number;
  bottomSweepMs?: number;
  peelTailFadeMs?: number;
  peelSpawnScale?: number;
  paleSpawnScale?: number;
  motionStyle?: Partial<MotionStyle> | null;
  onHide?: () => void;
  hide?: () => void;
}

export interface ResolvedOptions extends PeelOptions {
  motion: MotionId;
  speed: number;
  style: MotionStyle;
  direction: DirectionOption;
  peelMs: number;
  lifeMs: number;
  peelLeadInMs: number;
  birthJitterMs: number;
  bottomSweepMs: number;
  peelTailFadeMs: number;
  spray: number;
}

export interface Particle {
  originX: number;
  originY: number;
  offsetX: number;
  offsetY: number;
  waveLead: number;
  waveTail: number;
  morph: number;
  isPale: boolean;
  style: MotionStyle;
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
  size: number;
  born: number;
  start: number;
  peelEnd?: number;
  peelTailFadeMs?: number;
  birthDelayMs: number;
  r: number;
  g: number;
  b: number;
}

export interface PeelState {
  direction: number;
  peelMs: number;
  peelLeadInMs: number;
  element?: HTMLElement;
}

export interface PeelRun {
  particles: Particle[];
  resolve: (result: PeelResult) => void;
  particleCount: number;
  peel: PeelState;
  t0: number;
  peelTailFadeMs: number;
}

export interface PeelResult {
  cancelled: boolean;
  particleCount: number;
}

export interface ElementSnapshot {
  canvas: HTMLCanvasElement;
  w: number;
  h: number;
  scale: number;
}

export interface PeelCloser {
  readonly isClosing: boolean;
  abort(): void;
  close(el: HTMLElement, options?: PeelOptions): Promise<void>;
}