import { setupGsap, prefersReducedMotion } from "../motion/gsap-setup.js";
import { createFieldScene } from "./field-scene.js";
import { createMasterTimeline, renderStaticFrame } from "./master-timeline.js";

// 常驻场景层入口。场景是"世界",不是逐屏装饰:它在 Hero 就存在,
// 一直活到结尾,由主时间线连续 morph。
export function initScene() {
  setupGsap();

  const scene = createFieldScene();
  // 插到 body 最前:SVG 为 z-index 0 的定位元素,正文区为 z-index auto,
  // 同层按 DOM 顺序绘制,因此场景恒在文字之下。不使用负 z-index。
  document.body.insertBefore(scene.svg, document.body.firstChild);
  document.documentElement.classList.add("scene-ready");

  if (prefersReducedMotion()) {
    renderStaticFrame(scene);
    return scene;
  }

  createMasterTimeline(scene);
  return scene;
}
