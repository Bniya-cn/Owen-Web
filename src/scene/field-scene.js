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
    // 章节交互覆盖（Temporary Chapter Morph）:展开阅读框时,原主节点与原连线
    // 本身重组成框——不新建任何框角/框边元素。唯一写者是信念面板模块。
    // nodeOverrides: nodeIndex -> { dx, dy, r, o, haloScale, haloOpacity }
    //   (dx/dy 为像素位移目标,与 weight 相乘后叠加到基础位上);
    // linkOverrides: linkIndex -> { opacity, drawProgress, growFrom }
    //   (逐边生长:端点向目标端按 drawProgress 插值);
    // 未覆盖的连线按 weight 退暗。渲染管线:
    //   base(master timeline) → override → weight 混合 → resolved。
    interaction: {
      weight: 0,
      nodeOverrides: new Map(),
      linkOverrides: new Map(),
      ambientStarWeight: 0,
    },
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

  // resolved 坐标缓冲:节点混合结果写在这里,连线与渲染钩子共用同一份数据,
  // 因此框线端点与节点中心不可能错开一帧。
  const resolvedX = new Float64Array(NODE_COUNT);
  const resolvedY = new Float64Array(NODE_COUNT);
  const nodeBaseX = (i) => {
    const n = state.nodes[i];
    return n.x * W + state.pointerX * (n.r / 0.02) * 6;
  };
  const nodeBaseY = (i) => {
    const n = state.nodes[i];
    return n.y * H + state.pointerY * (n.r / 0.02) * 6;
  };

  // 渲染钩子:锚定层挂在这里,与 SVG 写入同处一个 tick,
  // 因此文字与节点不可能错开一帧。
  const renderHooks = [];

  function render() {
    const iw = state.interaction.weight;
    const nodeOv = iw > 0.001 ? state.interaction.nodeOverrides : null;
    const linkOv = iw > 0.001 ? state.interaction.linkOverrides : null;

    // 星群:纯氛围层,不承担任何框结构。框形成时整体轻微提亮,
    // 与 residue 星尘形成呼应。
    const amb = state.interaction.ambientStarWeight;
    for (let i = 0; i < STARS.length; i += 1) {
      const s = STARS[i];
      const c = starEls[i];
      const x = s.x * W + state.pointerX * s.depth * 10;
      const y = s.y * H - state.parallax * s.depth * 40;
      const o = (0.25 + s.phase * 0.75) * state.starDensity * (1 + amb * 0.3);
      c.setAttribute("cx", x);
      c.setAttribute("cy", y);
      c.setAttribute("r", s.r * S);
      c.setAttribute("opacity", o);
    }

    // 主节点:resolved = mix(base, override, weight)。未覆盖的节点不受影响。
    for (let i = 0; i < NODE_COUNT; i += 1) {
      const n = state.nodes[i];
      const bx = nodeBaseX(i);
      const by = nodeBaseY(i);
      const ov = nodeOv ? nodeOv.get(i) : null;
      let x = bx;
      let y = by;
      let r = n.r * S;
      let o = n.o;
      let haloR = r;
      if (ov) {
        x = bx + ov.dx * iw;
        y = by + ov.dy * iw;
        r *= ov.r + (1 - ov.r) * (1 - iw);
        o += (ov.o - o) * iw;
        haloR = r * (1 + (ov.haloScale - 1) * iw);
      }
      resolvedX[i] = x;
      resolvedY[i] = y;
      const { halo, core, g } = nodeEls[i];
      g.setAttribute("opacity", o);
      core.setAttribute("cx", x);
      core.setAttribute("cy", y);
      core.setAttribute("r", r * 0.32);
      halo.setAttribute("cx", x);
      halo.setAttribute("cy", y);
      halo.setAttribute("r", haloR);
    }

    // 连线:基础强度 × 两端可见度。被覆盖的连线向框边状态混合并支持逐边生长;
    // 其余连线随 weight 退暗(不删除、不隐藏)。
    for (let k = 0; k < LINKS.length; k += 1) {
      const [i, j] = LINKS[k];
      const line = linkEls[k];
      const ov = linkOv ? linkOv.get(k) : null;
      let x1 = resolvedX[i];
      let y1 = resolvedY[i];
      let x2 = resolvedX[j];
      let y2 = resolvedY[j];
      let op = state.linkStrength * state.nodes[i].o * state.nodes[j].o * 0.42;
      if (ov) {
        const from = ov.growFrom === j ? j : i;
        const to = from === i ? j : i;
        const p = ov.drawProgress ?? 1;
        x1 = resolvedX[from];
        y1 = resolvedY[from];
        x2 = resolvedX[from] + (resolvedX[to] - resolvedX[from]) * p;
        y2 = resolvedY[from] + (resolvedY[to] - resolvedY[from]) * p;
        op += (ov.opacity - op) * iw;
      } else {
        op *= 1 - iw * 0.88;
      }
      line.setAttribute("x1", x1);
      line.setAttribute("y1", y1);
      line.setAttribute("x2", x2);
      line.setAttribute("y2", y2);
      line.setAttribute("opacity", op);
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

  // 按节点对找连线索引(无序对)。供章节交互覆盖选取 perimeter link。
  function getLinkIndex(i, j) {
    return LINKS.findIndex(([a, b]) => (a === i && b === j) || (a === j && b === i));
  }

  return {
    svg,
    state,
    render,
    resize,
    addRenderHook: (hook) => renderHooks.push(hook),
    getLinkIndex,
    getLink: (i, j) => linkEls[getLinkIndex(i, j)] ?? null,
    nodeBaseX,
    nodeBaseY,
    nodeEls,
    linkEls,
  };
}
