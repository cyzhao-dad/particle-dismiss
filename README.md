# particle-dismiss

[![npm version](https://img.shields.io/npm/v/particle-dismiss)](https://www.npmjs.com/package/particle-dismiss)
[![license](https://img.shields.io/badge/license-Apache--2.0-blue)](LICENSE)
[![minzipped size](https://img.shields.io/bundlephobia/minzip/particle-dismiss)](https://bundlephobia.com/package/particle-dismiss)

用一道 CSS mask 波把 DOM 元素剥离掉，原地化作粒子飞散。适合对话框、抽屉、Toast 的关闭动效。

零依赖、TypeScript、原生 ESM。压缩后约 16 KB，gzip 后约 6.8 KB。

**[在线演示](https://cyzhao-dad.github.io/particle-dismiss/)** · **[在 StackBlitz 打开](https://stackblitz.com/github/cyzhao-dad/particle-dismiss)**

```bash
npm install particle-dismiss
```

```js
import { createPeelCloser } from "particle-dismiss";

const closer = createPeelCloser("设置面板");

await closer.close(panelEl, {
  motion: "spiral",       // drift | spiral | scatter | cascade | vortex | ribbon
  size: 1.5,              // 粒子尺寸，推荐 1 / 1.5 / 2
  direction: "auto",      // "auto" | "random" | 角度（0=上, 90=右）
  hide: () => { /* 你的隐藏逻辑 */ },
});
```

不要在 `hide()` 里 `display: none` 或把元素移出 DOM。mask 剥离期间元素必须保持可见并仍在文档中。`prefers-reduced-motion` 命中时跳过粒子，隐藏回调照常执行。

## API

| API | 说明 |
|---|---|
| `createPeelCloser(label?, defaults?)` | 单面板关闭器，带 `isClosing` / `abort()` |
| `peelElement(el, options?)` | 一次性剥离，返回 `{ cancelled, particleCount }` |
| `cancelAllPeels()` | 取消全部进行中的剥离 |
| `listMotions()` | 返回 `{ id, label }[]` |
| `resolvePeelDirection(rect?, requested?)` | 把方向选项解析成角度 |
| `PEEL_DEFAULTS` / `MOTION_PRESETS` | 默认值与运动预设 |

类型从包名导入：`PeelOptions`、`PeelCloser`、`PeelResult`、`MotionStyle`、`MotionId`、`MotionOption`、`MotionPreset`、`DirectionOption`。完整选项见 `PEEL_DEFAULTS`（`src/config.ts`）。

## 开发

```bash
npm install
npm run build      # dist/index.js + dist/index.d.ts
npm run dev        # 监听编译
npm run typecheck
npm run serve      # http://localhost:8080（零依赖 Node 静态服务）
```

演示页引用 `dist/index.js`，改源码后需先 `build` 或开着 `dev`。`file://` 下 ES Module 会被拦截，请用上面的本地服务。

## 注意

- **取色是近似值。** 阴影、滤镜、伪元素、动画中间态可能和真实绘制不一致。
- **大面板容易卡。** 调大 `size` 时同步降低 `density` 或 `maxParticles`（默认 48000）。粒子数 × 面积决定填充率。
- **环境。** 需要 `canvas 2d`、`getBoundingClientRect`、CSS `mask-image`（含 `-webkit-`）。目标须为不小于 1×1 的 `HTMLElement`。

## 作者

**zhaochen** · [453157936@qq.com](mailto:453157936@qq.com)

## 打赏

一个为闺女赚学费的中年老登。库免费，觉得好用就扫下面的微信码，当给闺女添点学费。

<img src="https://raw.githubusercontent.com/cyzhao-dad/particle-dismiss/HEAD/assets/wechat-pay.jpg" alt="微信收款码" width="220" />

## License

**Apache License 2.0**，见 [LICENSE](LICENSE) 与 [NOTICE](NOTICE)。

Copyright 2026 zhaochen &lt;453157936@qq.com&gt;

### 二次分发需保留的声明

Apache-2.0 第 4 条要求：以源码或目标码形式再分发本作品或其衍生作品时，必须随附 `LICENSE` 与 `NOTICE` 全文，并在源码中保留所有版权、专利、商标与署名声明（修改过的文件还要标注「已修改」）。最小合规做法是保留以下三行：

```
particle-dismiss
Copyright 2026 zhaochen <453157936@qq.com>
Licensed under the Apache License, Version 2.0
```

第 6 条另行明确：本项目**不授予商标权**，不得使用项目名或作者姓名为衍生作品背书或推广。

每个源文件头部都已带版权行与 `SPDX-License-Identifier: Apache-2.0`，所以即使有人只拷走单个文件，声明也会跟着走。
