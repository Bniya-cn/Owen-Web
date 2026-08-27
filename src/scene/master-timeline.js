import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { CHAPTER_LAYOUTS, CHAPTER_ORDER, NODE_COUNT } from "./layouts.js";

// 一条主时间线驱动整个场景:章节不再各自触发 once 动画,而是作为
// 这条时间线上的 waypoint。scrub 让滚动直接等于时间轴位置,因此
// 前后章节之间是连续 morph,而不是各自淡入。

const FIELDS = ["linkStrength", "trajectory", "mountain", "starDensity"];

// 各章"到位"的滚动进度:该章顶部滚到视口顶部时。用实际几何而非均分,
// 否则内容多的长章节会在滚动早期就 morph 完,后半程完全静止。
function chapterMarks() {
  const doc = document.documentElement;
  const total = Math.max(1, doc.scrollHeight - window.innerHeight);
  return CHAPTER_ORDER.map((id) => {
    const section = document.getElementById(id);
    if (!section) return null;
    return Math.min(1, Math.max(0, section.offsetTop / total));
  });
}

export function createMasterTimeline(scene) {
  const { state, render } = scene;
  let tl = null;

  function build() {
    const marks = chapterMarks();
    if (marks.some((m) => m === null)) return null;

    const timeline = gsap.timeline({
      defaults: { ease: "none" },
      // 场景的每一次推进都只经由这里渲染一次——没有第二个写入者。
      onUpdate: () => {
        state.parallax = timeline.progress();
        render();
      },
      scrollTrigger: {
        trigger: document.body,
        start: "top top",
        end: "bottom bottom",
        scrub: 1,
      },
    });

    for (let i = 1; i < CHAPTER_ORDER.length; i += 1) {
      const layout = CHAPTER_LAYOUTS[CHAPTER_ORDER[i]];
      const from = marks[i - 1];
      const duration = Math.max(0.004, marks[i] - from);

      for (let k = 0; k < NODE_COUNT; k += 1) {
        const target = layout.nodes[k];
        timeline.to(state.nodes[k], { ...target, duration }, from);
      }

      const scalars = { duration };
      FIELDS.forEach((f) => {
        scalars[f] = layout[f];
      });
      timeline.to(state, scalars, from);
    }

    return timeline;
  }

  tl = build();

  // 视口尺寸变化会改变章节高度,marks 随之失效,因此重建整条时间线。
  // 防抖到 250ms,避免拖拽窗口时反复重建。
  let resizeTimer = null;
  const onResize = () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      scene.resize();
      if (tl) {
        tl.scrollTrigger?.kill();
        tl.kill();
      }
      tl = build();
      ScrollTrigger.refresh();
      render();
    }, 250);
  };
  window.addEventListener("resize", onResize, { passive: true });

  return {
    get timeline() {
      return tl;
    },
  };
}

// reduced-motion 下不建时间线:场景静止在"网络"这一中性帧。
// 它仍然提供空间感与世界感,但不产生任何运动。
export function renderStaticFrame(scene) {
  const layout = CHAPTER_LAYOUTS.organization;
  layout.nodes.forEach((n, i) => Object.assign(scene.state.nodes[i], n));
  FIELDS.forEach((f) => {
    scene.state[f] = layout[f];
  });
  scene.render();
}
