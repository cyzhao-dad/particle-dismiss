/**
 * Public API: one-shot {@link peelElement} and the re-entrant
 * {@link createPeelCloser} wrapper.
 *
 * Copyright 2026 zhaochen <453157936@qq.com>
 * SPDX-License-Identifier: Apache-2.0
 * Licensed under the Apache License, Version 2.0. See LICENSE.
 */

import { prefersReducedMotion, resolvePeelOptions, resolvePeelDirection, PEEL_OVERSHOOT } from "./config.js";
import { snapshotElement } from "./capture.js";
import { sampleParticles } from "./particles.js";
import {
  activePeelCount,
  addPeel,
  cancelPeelsForElement,
  clearDomPeel,
  ensureFxCanvas,
  resizeFxCanvas,
  getDpr,
  hideElementSoft,
  restoreElement,
} from "./renderer.js";
import type { PeelCloser, PeelOptions, PeelResult } from "./types.js";

export function peelElement(
  element: HTMLElement,
  options: PeelOptions = {},
): Promise<PeelResult> {
  const bail = (cancelled: boolean): Promise<PeelResult> => {
    options.onHide?.();
    return Promise.resolve({ cancelled, particleCount: 0 });
  };

  if (!(element instanceof HTMLElement)) {
    return Promise.resolve({ cancelled: true, particleCount: 0 });
  }
  if (prefersReducedMotion()) return bail(false);

  const rect = element.getBoundingClientRect();
  if (rect.width < 1 || rect.height < 1) return bail(true);

  ensureFxCanvas();
  resizeFxCanvas();

  const opts = resolvePeelOptions(options);
  if (opts.direction == null || opts.direction === "auto" || opts.direction === "random") {
    opts.direction = resolvePeelDirection(rect, opts.direction ?? "auto");
  }

  let snapshot;
  try {
    snapshot = snapshotElement(element, opts.scale);
  } catch (error) {
    console.warn("[particle-dismiss] element snapshot failed", error);
    return bail(true);
  }

  let sample;
  try {
    sample = sampleParticles(snapshot, rect, opts, getDpr());
  } catch (error) {
    console.warn("[particle-dismiss] particle sampling failed", error);
    return bail(true);
  }

  let particles = sample.particles;
  const maxParticles = opts.maxParticles ?? Infinity;
  if (particles.length > maxParticles) {
    const keepRate = maxParticles / particles.length;
    particles = particles.filter(() => Math.random() < keepRate);
  }
  if (!particles.length) return bail(false);

  return new Promise<PeelResult>((resolve) => {
    const startedAt = performance.now();
    const peelEndsAt =
      startedAt + opts.peelLeadInMs! + sample.peelState.peelMs * PEEL_OVERSHOOT;
    const peelTailFadeMs = opts.peelTailFadeMs!;

    for (const p of particles) {
      p.born = startedAt + p.birthDelayMs;
      p.start = -1;
      p.peelEnd = peelEndsAt;
      p.peelTailFadeMs = peelTailFadeMs;
    }
    sample.peelState.element = element;

    addPeel(
      {
        particles,
        resolve,
        particleCount: particles.length,
        peel: sample.peelState,
        t0: startedAt,
        peelTailFadeMs,
      },
      startedAt,
    );

    options.onHide?.();
  });
}

export function createPeelCloser(
  label = "element",
  defaults: PeelOptions = {},
): PeelCloser {
  let generation = 0;
  let closing = false;
  let activeElement: HTMLElement | null = null;

  return {
    get isClosing() {
      return closing;
    },

    abort(): void {
      generation++;
      closing = false;
      if (activeElement) {
        cancelPeelsForElement(activeElement);
        restoreElement(activeElement);
        activeElement = null;
      }
    },

    close(el: HTMLElement, options: PeelOptions = {}): Promise<void> {
      const { hide, ...peelOpts } = options;
      if (!el || el.hidden) return Promise.resolve();
      if (closing && activePeelCount() === 0) closing = false;
      if (closing) return Promise.resolve();

      closing = true;
      activeElement = el;
      const myGeneration = ++generation;
      const isCurrent = () => myGeneration === generation;

      return peelElement(el, {
        ...defaults,
        ...peelOpts,
        onHide: () => {
          if (!isCurrent()) return;
          el.style.pointerEvents = "none";
          hide?.();
        },
      })
        .catch((error) => {
          console.warn(`[particle-dismiss] ${label} 剥离动效失败`, error);
          if (isCurrent()) {
            clearDomPeel(el);
            hideElementSoft(el);
            el.style.pointerEvents = "none";
            hide?.();
          }
        })
        .finally(() => {
          if (!isCurrent()) return;
          closing = false;
          if (activeElement === el) activeElement = null;
          clearDomPeel(el);
          if (el.isConnected) el.hidden = true;
          restoreElement(el);
        })
        .then(() => undefined);
    },
  };
}