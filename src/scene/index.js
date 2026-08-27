import { setupGsap, prefersReducedMotion } from "../motion/gsap-setup.js";
import { createFieldScene } from "./field-scene.js";
import { createMasterTimeline, renderStaticFrame } from "./master-timeline.js";
import { createAnchors, ANCHOR_MIN_WIDTH } from "./anchors.js";

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

  // 锚定只在横向空间足够时启用。窄屏下固定定位的文字必然互相重叠,
  // 可读性优先——那里保持原有的常规文档流。
  let anchors = null;
  // 只注册一次 hook,由闭包读取当前的 anchors——否则反复跨越断点
  // resize 会不断往渲染钩子数组里追加,越滚越慢。
  scene.addRenderHook((px, py) => {
    if (anchors) anchors.apply(px, py);
  });

  const syncAnchorMode = () => {
    const shouldAnchor = window.innerWidth >= ANCHOR_MIN_WIDTH;
    if (shouldAnchor && !anchors) {
      anchors = createAnchors(scene);
      document.documentElement.classList.add("scene-anchored");
      scene.render();
    } else if (!shouldAnchor && anchors) {
      document.documentElement.classList.remove("scene-anchored");
      anchors.destroy();
      anchors = null;
      scene.render();
    }
  };

  syncAnchorMode();

  let resizeTimer = null;
  window.addEventListener(
    "resize",
    () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(syncAnchorMode, 260);
    },
    { passive: true }
  );

  return scene;
}
