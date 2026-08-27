import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

// 锚定:把原本散落在各章的"装饰图节点文字"绑定到场景的主节点上,
// 让它们随主时间线一起移动。文字仍然是 DOM(可读、可选、可被朗读),
// 只是位置改由场景驱动。
//
// 单一写者:这里只写 --anchor-x / --anchor-y 两个 CSS 变量,
// transform 本身仍是样式表里唯一的一条声明,因此锚定文字的其它
// transform 交互(如 hover)可以与锚定位移安全组合,不会互相覆盖。

// who 章刻意不在此列:首屏的 .field-stage 本身就是"轨道"最恰当的 DOM 表达,
// 且承担可点击的信号选择与 aria-live 说明。锚定它会牵动展开卡片的定位、
// hover 位移与命中区域,收益不抵风险。首屏改由场景节点降低亮度来退居背景。
const GROUPS = [
  { section: "person", selector: ".map-point", nodes: [0, 1, 2, 3] },
  { section: "journey", selector: ".trajectory-step", nodes: [0, 1, 2, 3] },
  { section: "beliefs", selector: ".belief-node", nodes: [0, 1, 2, 3] },
  { section: "beliefs", selector: ".belief-field__core", nodes: [4] },
  { section: "organization", selector: ".map-point", nodes: [0, 1, 2, 3] },
  { section: "future", selector: ".trajectory-step", nodes: [0, 1, 2, 3] },
];

// 锚定只在有足够横向空间时启用。窄屏保持常规文档流——固定定位的
// 文字在 390px 下必然互相重叠,可读性优先于视觉一致性。
export const ANCHOR_MIN_WIDTH = 1024;

// 当前活动的锚定实例(至多一个)。模块级导出供只读消费者使用。
let current = null;

// 只读接口:主节点 i 的当前视口坐标。用渲染帧内保存的 px / py 换算,
// 与 SVG 节点同处一个数据源,因此读到的就是节点此刻的位置。
// 锚定不可用(窄屏 / reduced-motion / 无 JS)时返回 null,调用方自行回退。
export function getNodeViewport(nodeIndex) {
  if (!current) return null;
  return current.getNodeViewport(nodeIndex);
}

export function createAnchors(scene) {
  const entries = [];
  const triggers = [];
  // 最近一帧的坐标换算函数,由 render 钩子写入,供 getNodeViewport 复用。
  let latestPx = null;
  let latestPy = null;

  GROUPS.forEach((group) => {
    const section = document.getElementById(group.section);
    if (!section) return;
    const els = [...section.querySelectorAll(group.selector)];
    if (!els.length) return;

    const groupEls = [];
    els.forEach((el, i) => {
      const nodeIndex = group.nodes[i];
      if (nodeIndex === undefined) return;
      // 若揭示层的瀑布在场景 chunk 就位前已经跑过(用户快速下滚),它会留下
      // 内联 opacity/transform。锚定接管这两个属性,因此必须先停掉那些补间
      // 并清除其内联痕迹,否则内联样式会永久压过 .is-live。
      gsap.killTweensOf(el);
      gsap.set(el, { clearProps: "opacity,transform" });

      el.classList.add("is-anchored");
      entries.push({ el, nodeIndex, flipped: false });
      groupEls.push(el);
    });

    if (!groupEls.length) return;

    // 章节严格接力:以视口中线为界,section 顶部过中线时接管、底部过中线时
    // 交出。由于每章高度不小于一屏,任意时刻至多一章活动,不会出现两章的
    // 锚定文字同时压在同一批节点上。
    triggers.push(
      ScrollTrigger.create({
        trigger: section,
        start: "top center",
        end: "bottom center",
        onToggle: ({ isActive }) => {
          groupEls.forEach((el) => el.classList.toggle("is-live", isActive));
        },
      })
    );
  });

  // 节点越过这条竖线后,文字翻到节点左侧,否则会被右边缘裁切。
  const FLIP_AT = 0.58;

  // 由 scene.render 每帧调用一次,与 SVG 写入同处一个 tick。
  function apply(px, py) {
    latestPx = px;
    latestPy = py;
    for (let i = 0; i < entries.length; i += 1) {
      const { el, nodeIndex, flipped } = entries[i];
      const n = scene.state.nodes[nodeIndex];
      el.style.setProperty("--anchor-x", `${px(n).toFixed(1)}px`);
      el.style.setProperty("--anchor-y", `${py(n).toFixed(1)}px`);

      // class 写入有成本,只在跨过阈值时切换,不每帧无条件调用。
      const shouldFlip = n.x > FLIP_AT;
      if (shouldFlip !== flipped) {
        entries[i].flipped = shouldFlip;
        el.classList.toggle("anchor-flip", shouldFlip);
      }
    }
  }

  function getNodeViewport(nodeIndex) {
    const n = scene.state.nodes[nodeIndex];
    if (!n || !latestPx) return null;
    return { x: latestPx(n), y: latestPy(n) };
  }

  function destroy() {
    triggers.forEach((t) => t.kill());
    entries.forEach(({ el }) => {
      el.classList.remove("is-anchored", "is-live");
      el.style.removeProperty("--anchor-x");
      el.style.removeProperty("--anchor-y");
    });
    entries.length = 0;
    triggers.length = 0;
    latestPx = null;
    latestPy = null;
    if (current === api) current = null;
  }

  const api = { apply, destroy, getNodeViewport, count: entries.length };
  current = api;
  return api;
}
