import { NODE_COUNT, STARS, MOUNTAIN_FLAT, MOUNTAIN_RIDGE, CHAPTER_LAYOUTS } from "./layouts.js";

const NS = "http://www.w3.org/2000/svg";
const el = (name, attrs) => {
  const node = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
};

// 主节点两两连线的索引对。连线是派生物:它的可见度由 linkStrength 与
// 两端节点各自的不透明度共同决定,不单独持有状态。
const LINKS = [];
for (let i = 0; i < NODE_COUNT; i += 1) {
  for (let j = i + 1; j < NODE_COUNT; j += 1) LINKS.push([i, j]);
}

export function createFieldScene() {
  const svg = el("svg", {
    class: "field-scene",
    "aria-hidden": "true",
    preserveAspectRatio: "none",
  });

  const gStars = el("g", { class: "field-scene__stars" });
  const gLinks = el("g", { class: "field-scene__links" });
  const gTrajectory = el("g", { class: "field-scene__trajectory" });
  const gMountain = el("g", { class: "field-scene__mountain" });
  const gNodes = el("g", { class: "field-scene__nodes" });
  // 绘制顺序即层次:星群最远,节点最近。
  svg.append(gStars, gMountain, gTrajectory, gLinks, gNodes);

  const starEls = STARS.map(() => {
    const c = el("circle", { r: 1, cx: 0, cy: 0 });
    gStars.append(c);
    return c;
  });

  const linkEls = LINKS.map(() => {
    const l = el("line", { x1: 0, y1: 0, x2: 0, y2: 0 });
    gLinks.append(l);
    return l;
  });

  const trajectoryEl = el("path", { d: "", fill: "none" });
  gTrajectory.append(trajectoryEl);

  const mountainEl = el("path", { d: "", fill: "none" });
  gMountain.append(mountainEl);

  const nodeEls = Array.from({ length: NODE_COUNT }, () => {
    const g = el("g", {});
    const halo = el("circle", { class: "halo", r: 0, cx: 0, cy: 0 });
    const core = el("circle", { class: "core", r: 0, cx: 0, cy: 0 });
    g.append(halo, core);
    gNodes.append(g);
    return { g, halo, core };
  });

  // ---- 唯一状态源 ----
  // 这个对象是场景的全部真相。master timeline 只补间它,render 只读它。
  // 任何其他地方都不得直接写 SVG 属性(单一写者)。
  const state = {
    nodes: CHAPTER_LAYOUTS.who.nodes.map((n) => ({ ...n })),
    linkStrength: CHAPTER_LAYOUTS.who.linkStrength,
    trajectory: CHAPTER_LAYOUTS.who.trajectory,
    mountain: CHAPTER_LAYOUTS.who.mountain,
    starDensity: CHAPTER_LAYOUTS.who.starDensity,
    // 指针位移(归一化偏移量),由指针层写入,参与渲染但不参与滚动补间
    pointerX: 0,
    pointerY: 0,
    parallax: 0,
  };

  let W = 0;
  let H = 0;
  let S = 0; // 短边,半径基准

  function resize() {
    W = window.innerWidth;
    H = window.innerHeight;
    S = Math.min(W, H);
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.setAttribute("width", W);
    svg.setAttribute("height", H);
  }

  const px = (n) => n.x * W + state.pointerX * (n.r / 0.02) * 6;
  const py = (n) => n.y * H + state.pointerY * (n.r / 0.02) * 6;

  // 渲染钩子:锚定层挂在这里,与 SVG 写入同处一个 tick,
  // 因此文字与节点不可能错开一帧。
  const renderHooks = [];

  function render() {
    // 星群:亮度随 starDensity,位置带极轻微滚动视差
    for (let i = 0; i < STARS.length; i += 1) {
      const s = STARS[i];
      const c = starEls[i];
      c.setAttribute("cx", s.x * W + state.pointerX * s.depth * 10);
      c.setAttribute("cy", s.y * H - state.parallax * s.depth * 40);
      c.setAttribute("r", s.r * S);
      c.setAttribute("opacity", (0.25 + s.phase * 0.75) * state.starDensity);
    }

    // 主节点
    for (let i = 0; i < NODE_COUNT; i += 1) {
      const n = state.nodes[i];
      const x = px(n);
      const y = py(n);
      const r = n.r * S;
      const { halo, core, g } = nodeEls[i];
      g.setAttribute("opacity", n.o);
      core.setAttribute("cx", x);
      core.setAttribute("cy", y);
      core.setAttribute("r", r * 0.32);
      halo.setAttribute("cx", x);
      halo.setAttribute("cy", y);
      halo.setAttribute("r", r);
    }

    // 连线:强度 × 两端可见度
    for (let k = 0; k < LINKS.length; k += 1) {
      const [i, j] = LINKS[k];
      const a = state.nodes[i];
      const b = state.nodes[j];
      const line = linkEls[k];
      line.setAttribute("x1", px(a));
      line.setAttribute("y1", py(a));
      line.setAttribute("x2", px(b));
      line.setAttribute("y2", py(b));
      line.setAttribute("opacity", state.linkStrength * a.o * b.o * 0.42);
    }

    // 轨迹:按节点顺序穿过所有可见节点的平滑折线
    if (state.trajectory > 0.001) {
      let d = "";
      for (let i = 0; i < NODE_COUNT; i += 1) {
        const n = state.nodes[i];
        d += `${i === 0 ? "M" : "L"}${px(n).toFixed(1)} ${py(n).toFixed(1)}`;
      }
      trajectoryEl.setAttribute("d", d);
    }
    // 可见穿字治理：轨迹几何不变，透明度上限 0.5 → 0.38，
    // 配合正文同底晕影（typography.css）让线在字形处视觉上退出。
    trajectoryEl.setAttribute("opacity", state.trajectory * 0.38);

    // 山脊:平线 ↔ 山形逐点补间
    const m = state.mountain;
    let md = "";
    for (let i = 0; i < MOUNTAIN_RIDGE.length; i += 1) {
      const [fx, fy] = MOUNTAIN_FLAT[i];
      const [rx, ry] = MOUNTAIN_RIDGE[i];
      const x = (fx + (rx - fx) * m) * W;
      const y = (fy + (ry - fy) * m) * H;
      md += `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    }
    mountainEl.setAttribute("d", md);
    mountainEl.setAttribute("opacity", m * 0.55);

    for (let i = 0; i < renderHooks.length; i += 1) renderHooks[i](px, py);
  }

  resize();
  render();

  return {
    svg,
    state,
    render,
    resize,
    addRenderHook: (hook) => renderHooks.push(hook),
  };
}
