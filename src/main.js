import { initSectionStatus } from "./interactions/section-status.js";
import { initOrbitSignals } from "./interactions/orbit-signals.js";
import { initWorkProtocol } from "./interactions/work-protocol.js";

// 状态同步与交互层:功能性的,不属于动效。静态导入,任何情况下都必须工作。
initSectionStatus();
initOrbitSignals();
initWorkProtocol();

// 动效层:渐进增强。动态导入使其独立成 chunk(gsap 一并进入该 chunk),
// 加载或初始化失败时 html 拿不到 .motion-ready,内容停在完全可见的静态状态,
// 且上面的交互层不受影响——这比原先"vendor 全局脚本失败则整层失效"更稳。
import("./motion/reveal.js")
  .then(({ initMotion }) => initMotion())
  .catch((err) => console.warn("[v8.1] motion layer unavailable, page remains static:", err));

// 常驻场景层:与揭示层各自独立成 chunk、各自 catch。
// 场景失败时页面退回纯 DOM 版本,不影响文字、交互与揭示动效。
import("./scene/index.js")
  .then(({ initScene }) => initScene())
  .catch((err) => console.warn("[v8.1] scene layer unavailable, page remains flat:", err));
