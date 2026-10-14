# Changelog

本项目的所有重要变更都记录在此文件。

格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

## [1.0.0] - 2026-10-13

首个版本。

### 新增

- `createPeelCloser(label?, defaults?)` —— 单面板关闭器，带 `isClosing` 与 `abort()`
- `peelElement(el, options?)` —— 一次性剥离，返回 `{ cancelled, particleCount }`
- `cancelAllPeels()` —— 取消全部进行中的剥离
- `listMotions()` / `resolvePeelDirection(rect?, requested?)`
- `PEEL_DEFAULTS` / `MOTION_PRESETS` —— 默认值与运动预设
- 六种运动预设：`drift` / `spiral` / `scatter` / `cascade` / `vortex` / `ribbon`
- CSS `mask-image` 波前剥离真实 DOM，快照取色后原地生成粒子
- `prefers-reduced-motion` 命中时跳过粒子，隐藏回调照常执行

[Unreleased]: https://github.com/cyzhao-dad/particle-dismiss/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/cyzhao-dad/particle-dismiss/releases/tag/v1.0.0
