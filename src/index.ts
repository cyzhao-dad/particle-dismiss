/**
 * particle-dismiss — peel a DOM element away with a CSS mask wave, leaving a
 * particle burst in its place.
 *
 * Copyright 2026 zhaochen <453157936@qq.com>
 * SPDX-License-Identifier: Apache-2.0
 * Licensed under the Apache License, Version 2.0. See LICENSE.
 *
 * Public barrel — this is the supported surface. Everything not exported here
 * is internal and may change between minor versions without notice.
 *
 *   import { createPeelCloser } from "particle-dismiss";
 */

export { peelElement, createPeelCloser } from "./api.js";
export { cancelAllPeels } from "./renderer.js";
export { PEEL_DEFAULTS, MOTION_PRESETS, listMotions, resolvePeelDirection } from "./config.js";

export type {
  DirectionOption,
  MotionId,
  MotionOption,
  MotionPreset,
  MotionStyle,
  PeelCloser,
  PeelOptions,
  PeelResult,
} from "./types.js";
