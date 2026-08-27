import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { STARS } from "../scene/layouts.js";
import { getNodeViewport, ANCHOR_MIN_WIDTH } from "../scene/anchors.js";

/*
 * 星群成框 / 文本星尘（ConstellationPanel）—— Controller + 双实例。
 *
 * 隐喻:思想被阅读时形成语言;离开语言后重新回到星群。
 * 两个实例共用一套仪式:person「展开一段觉察」、beliefs「展开另一条信念」。
 *
 * 几何模型（单一写者）:
 *   resolved corner = baseCorner + panelDelta
 *   - baseCorner:锚定模式取场景主节点视口坐标（anchors.getNodeViewport）,
 *     窄屏未锚定才取 DOM 静态布局的 rect;
 *   - panelDelta:每角 {dx, dy} 的 JS 中间对象,由 GSAP 补间,
 *     onUpdate 统一写四处消费者——
 *       1. 角注记的 --panel-dx/--panel-dy（锚定规则在样式表里与 --anchor 相加）
 *       2. interaction 覆盖通道（星群飞向同一 resolved 位置）
 *       3. frame SVG 端点（章节本地）
 *       4. 面板容器自身的 left/top/宽高
 *
 * 架构约束(与 DESIGN.md 的单一写者原则一致):
 * - 主节点与滚动场景由 master-timeline 独占;本模块只使用独立的
 *   "星群交互覆盖"通道(星群本身不参与滚动 morph,无抢写风险)。
 * - 框线 / 玻璃 / 文本 / 星尘全部是章节的本地层,随章节一起滚走。
 * - <details> 原生语义保留:脚本不可用时展开仍然工作(渐进增强)。
 *
 * 状态机:
 *   IDLE → FORMING → READING → DISSOLVING → RESIDUE → REASSEMBLING → READING
 *   FORMING / READING / REASSEMBLING 离场或滚动超限 → FAST_COLLAPSING → RESIDUE
 */

// 双实例配置。标题均为占位文案,可一句话替换（见自查报告）。
const INSTANCES = [
  {
    id: "awareness",
    sectionId: "person",
    cornerSelector: ".map-point",
    kicker: "Awareness / Lived Truth",
    titleLines: ["觉察，", "是找回，不是抵达。"],
    keywords: ["找回", "纯真", "智慧", "惊鸿一瞥"],
  },
  {
    id: "goodwill",
    sectionId: "beliefs",
    cornerSelector: ".belief-node",
    kicker: "Belief / Lived Truth",
    titleLines: ["善意，", "不是一种履历。"],
    keywords: ["善意", "关键时刻", "选择", "资历", "经验", "职位", "收入"],
  },
];

// 展开态:允许被 Esc / 滚动守卫 / 离场触发收起的状态。
const OPEN_STATES = new Set(["FORMING", "READING", "REASSEMBLING"]);
// 可视态:面板占据几何、需要随场景渲染同步的状态。
const VISIBLE_STATES = new Set(["FORMING", "READING", "REASSEMBLING", "DISSOLVING", "FAST_COLLAPSING"]);

// 第 4 点:fixed 角注记与 section-local 框在滚动下必然脱节,
// 展开后滚动超过该阈值立即 fast collapse——"展开时禁止边滚边读"。
const SCROLL_LIMIT = 12;

// 粒子预算:单实例 10–18 颗,移动端减约 30%。
const PARTICLE_COUNT_DESKTOP = 14;
const PARTICLE_COUNT_MOBILE = 10;

function hashString(value) {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seededRandom(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function createConstellationPanel(scene) {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isMobile = () => window.innerWidth < 840;

  // ---------- Controller:任一时刻至多一个活动实例,一套全局监听 ----------
  const controller = { active: null };

  // 几何写者的每帧同步钩子:场景每次 render 后把打开中的面板几何对齐到
  // 当前节点位置（与锚定文字同处一个 tick,不可能错开一帧）。
  scene.addRenderHook(() => {
    const inst = controller.active;
    if (inst && VISIBLE_STATES.has(inst.state)) inst.syncFrame();
  });

  // Esc 关闭当前活动实例。
  const onKeyDown = (event) => {
    if (event.key !== "Escape") return;
    const inst = controller.active;
    if (inst && OPEN_STATES.has(inst.state)) inst.close("user");
  };
  document.addEventListener("keydown", onKeyDown);

  // 滚动守卫:展开期间滚动超过阈值立即 fast collapse（ScrollTrigger 只是兜底）。
  const onScroll = () => {
    const inst = controller.active;
    if (!inst || !OPEN_STATES.has(inst.state)) return;
    if (Math.abs(window.scrollY - inst.openScrollY) > SCROLL_LIMIT) inst.close("leave");
  };
  window.addEventListener("scroll", onScroll, { passive: true });

  // resize:跨越锚定断点 → 先立即就地收拢（无动画）,随后 index.js 既有的
  // 防抖才会切换锚定模式;同宽度段内的普通 resize 防抖重算几何。
  let anchoredMode = window.innerWidth >= ANCHOR_MIN_WIDTH;
  let resizeTimer = null;
  const onResize = () => {
    const nowAnchored = window.innerWidth >= ANCHOR_MIN_WIDTH;
    if (nowAnchored !== anchoredMode) {
      anchoredMode = nowAnchored;
      if (controller.active) controller.active.collapseImmediate();
    }
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => controller.active?.relayout(), 250);
  };
  window.addEventListener("resize", onResize, { passive: true });

  // ---------- 实例工厂 ----------
  function createInstance(cfg) {
    const section = document.getElementById(cfg.sectionId);
    const details = section?.querySelector(".source-note");
    const summary = details?.querySelector("summary");
    if (!section || !details || !summary) return null;

    // 角注记:只跟随四角,不是几何真源。
    const cornerEls = [...section.querySelectorAll(cfg.cornerSelector)].slice(0, 4);

    let panelState = "IDLE";
    let activeTl = null; // 当前可取消的时间线(单一写者)
    let cornerStars = []; // 被征用的星索引
    let particles = []; // residue 粒子记录
    let residueShown = false;
    let openScrollY = 0;
    let contentHeight = 0;

    // 四角几何:基准位(视口坐标)+ 每角位移。任一帧只有 syncFrame 解析它。
    const deltas = [0, 1, 2, 3].map(() => ({ dx: 0, dy: 0 }));
    let bases = [];

    const killActive = () => {
      if (activeTl) {
        activeTl.kill();
        activeTl = null;
      }
    };

    // ---------- DOM 构建(面板与残响层都是章节本地层) ----------
    const panel = document.createElement("aside");
    panel.className = "belief-panel";
    panel.id = `belief-panel-${cfg.id}`;
    panel.setAttribute("aria-hidden", "true");
    panel.innerHTML = `
      <svg class="belief-panel__frame" aria-hidden="true" preserveAspectRatio="none">
        <path class="belief-panel__edge" />
        <path class="belief-panel__edge" />
        <path class="belief-panel__edge" />
        <path class="belief-panel__edge" />
        <circle class="belief-panel__corner is-source" r="3.4" />
        <circle class="belief-panel__corner" r="3" />
        <circle class="belief-panel__corner" r="3" />
        <circle class="belief-panel__corner" r="3" />
      </svg>
      <div class="belief-panel__glass"></div>
      <div class="belief-panel__content">
        <span class="belief-panel__kicker">${cfg.kicker}</span>
        <h3 class="belief-panel__title">${cfg.titleLines
          .map((line) => `<span class="belief-panel__line">${line}</span>`)
          .join("")}</h3>
        <div class="belief-panel__body-slot"></div>
        <button class="belief-panel__close" type="button">收起 −</button>
      </div>`;
    section.append(panel);

    const residueLayer = document.createElement("div");
    residueLayer.className = "belief-residue-layer";
    residueLayer.setAttribute("aria-hidden", "true");
    section.append(residueLayer);

    // 正文接管:把原 <details> 里的正文移入面板并做关键词切分。
    // 移动只发生在增强初始化之后——无脚本时 <details> 保持原样可用。
    const sourceBody = details.querySelector(".source-note__body");
    const bodySlot = panel.querySelector(".belief-panel__body-slot");
    if (sourceBody) {
      const p = document.createElement("p");
      p.className = "belief-panel__body";
      const rand = seededRandom(hashString(`${cfg.id}:split`));
      // 按句号拆行,逐行成 <span>;关键词包 token,并预置逃逸漂移量。
      const sentences = sourceBody.textContent.split(/(?<=。)/).filter((s) => s.trim());
      sentences.forEach((sentence) => {
        const line = document.createElement("span");
        line.className = "belief-panel__line";
        let rest = sentence;
        while (rest.length) {
          let hit = null;
          let hitIndex = rest.length;
          for (const kw of cfg.keywords) {
            const at = rest.indexOf(kw);
            if (at !== -1 && at < hitIndex) {
              hitIndex = at;
              hit = kw;
            }
          }
          if (hit === null) {
            line.append(document.createTextNode(rest));
            break;
          }
          if (hitIndex > 0) line.append(document.createTextNode(rest.slice(0, hitIndex)));
          const token = document.createElement("b");
          token.className = "belief-token";
          token.textContent = hit;
          token.style.setProperty("--drift-x", `${(rand() - 0.5) * 220}px`);
          token.style.setProperty("--drift-y", `${-40 - rand() * 150}px`);
          token.style.setProperty("--drift-r", `${(rand() - 0.5) * 34}deg`);
          line.append(token);
          rest = rest.slice(hitIndex + hit.length);
        }
        p.append(line);
      });
      bodySlot.append(p);
      sourceBody.remove(); // 文本已迁移,避免屏幕阅读器重复朗读
    }

    summary.setAttribute("aria-expanded", "false");
    summary.setAttribute("aria-controls", panel.id);

    const frame = panel.querySelector(".belief-panel__frame");
    const glass = panel.querySelector(".belief-panel__glass");
    const edges = [...panel.querySelectorAll(".belief-panel__edge")];
    const corners = [...panel.querySelectorAll(".belief-panel__corner")];
    const titleLines = [...panel.querySelectorAll(".belief-panel__title .belief-panel__line")];
    const bodyLines = [...panel.querySelectorAll(".belief-panel__body .belief-panel__line")];
    const tokens = [...panel.querySelectorAll(".belief-token")];
    const kicker = panel.querySelector(".belief-panel__kicker");
    const closeButton = panel.querySelector(".belief-panel__close");
    const allText = [kicker, ...titleLines, ...bodyLines];

    // ---------- 几何:基准位、位移预算与唯一解析函数 ----------
    const isAnchored = () => document.documentElement.classList.contains("scene-anchored");

    // 四角基准:锚定模式用场景主节点坐标（不用角注记的 rect——它们带
    // margin 与 anchor-flip 偏移,是文字标签不是几何点）;窄屏未锚定才用
    // DOM 静态布局的 rect 中心（减去当前位移,避免反馈循环）。
    function readBases() {
      if (isAnchored()) {
        const pts = cornerEls.map((_, i) => getNodeViewport(i));
        if (pts.every((pt) => pt)) return pts;
      }
      return cornerEls.map((el, i) => {
        const r = el.getBoundingClientRect();
        return {
          x: r.left + r.width / 2 - deltas[i].dx,
          y: r.top + r.height / 2 - deltas[i].dy,
        };
      });
    }

    // 第 3 点:位移预算优先。每个角沿质心方向外推一个预算长度——
    // 质心保持不变,框在预算内尽量撑开;预算不够就窄框多换行,
    // 不为卡片宽度拖走节点。
    function cornerBudget() {
      return Math.min(96, window.innerWidth * 0.07);
    }

    function computeTargetDeltas(base) {
      const cx = base.reduce((sum, b) => sum + b.x, 0) / base.length;
      const cy = base.reduce((sum, b) => sum + b.y, 0) / base.length;
      const budget = cornerBudget();
      return base.map((b) => {
        const vx = b.x - cx;
        const vy = b.y - cy;
        const len = Math.hypot(vx, vy) || 1;
        return { dx: (vx / len) * budget, dy: (vy / len) * budget };
      });
    }

    // 唯一几何解析:四处消费者全部从这一处取数。
    function syncFrame() {
      if (!bases.length) return;
      const resolved = bases.map((b, i) => ({ x: b.x + deltas[i].dx, y: b.y + deltas[i].dy }));

      // 1) 角注记跟随四角（--panel-dx/dy;锚定规则里与 --anchor 相加）。
      cornerEls.forEach((el, i) => {
        el.style.setProperty("--panel-dx", `${deltas[i].dx.toFixed(1)}px`);
        el.style.setProperty("--panel-dy", `${deltas[i].dy.toFixed(1)}px`);
      });

      // 2) interaction 覆盖通道:星群飞向同一 resolved 位置。
      const ov = scene.state.interaction.starOverrides;
      ov.clear();
      cornerStars.forEach((idx, i) => ov.set(idx, { x: resolved[i].x, y: resolved[i].y, o: 0.95 }));

      // 3) + 4) 面板本地几何与 frame 端点。
      const secRect = section.getBoundingClientRect();
      const local = resolved.map((pt) => ({ x: pt.x - secRect.left, y: pt.y - secRect.top }));
      const minX = Math.min(...local.map((p) => p.x));
      const minY = Math.min(...local.map((p) => p.y));
      const maxX = Math.max(...local.map((p) => p.x));
      const maxY = Math.max(...local.map((p) => p.y));
      const width = Math.max(maxX - minX, 200);
      // 高度由内容兜底:四角围出的四边形不够高时,以可读文本高度为准。
      const height = Math.max(maxY - minY, contentHeight);
      panel.style.left = `${minX}px`;
      panel.style.top = `${minY}px`;
      panel.style.width = `${width}px`;
      panel.style.height = `${height}px`;
      frame.setAttribute("viewBox", `0 0 ${width} ${height}`);
      const pts = local.map((p) => [p.x - minX, p.y - minY]);
      corners.forEach((c, i) => {
        c.setAttribute("cx", pts[i][0]);
        c.setAttribute("cy", pts[i][1]);
      });
      for (let i = 0; i < 4; i += 1) {
        const [x1, y1] = pts[i];
        const [x2, y2] = pts[(i + 1) % 4];
        edges[i].setAttribute("d", `M${x1} ${y1} L${x2} ${y2}`);
      }
    }

    // delta 补间的统一 onUpdate:写变量、同步几何、重渲染场景。
    function applyDeltaFrame() {
      syncFrame();
      scene.render();
    }

    function clearCornerVars() {
      cornerEls.forEach((el) => {
        el.style.removeProperty("--panel-dx");
        el.style.removeProperty("--panel-dy");
      });
    }

    function resetDeltas() {
      deltas.forEach((d) => {
        d.dx = 0;
        d.dy = 0;
      });
    }

    // 内容高度在打开时测一次（按最终框宽）,避免每帧强制回流。
    function measureContent(width) {
      panel.classList.add("is-measuring");
      panel.style.height = "auto";
      panel.style.width = `${Math.max(width, 220)}px`;
      const h = panel.offsetHeight;
      panel.classList.remove("is-measuring");
      return h;
    }

    // 边线预置:满长 dash + 满偏移 = 不可见,稍后逐边画出生长感。
    function primeEdges() {
      edges.forEach((edge) => {
        const len = edge.getTotalLength();
        edge.style.strokeDasharray = `${len}`;
        edge.style.strokeDashoffset = `${len}`;
      });
    }

    function fullEdges() {
      edges.forEach((edge) => {
        edge.style.strokeDasharray = "none";
        edge.style.strokeDashoffset = "0";
      });
    }

    // seeded:同一条信念永远征用同一批星
    function pickCornerStars() {
      const rand = seededRandom(hashString(`${cfg.id}:stars`));
      const picked = new Set();
      while (picked.size < 4) picked.add(Math.floor(rand() * STARS.length));
      return [...picked];
    }

    // ---------- 残响星尘:seeded、章节本地、可重组 ----------
    // box:最终框的章节本地坐标。home:出生位(框内);scatter:停驻位(章节背景)。
    function buildParticles(box) {
      residueLayer.innerHTML = "";
      particles = [];
      const secRect = section.getBoundingClientRect();
      const count = isMobile() ? PARTICLE_COUNT_MOBILE : PARTICLE_COUNT_DESKTOP;
      const rand = seededRandom(hashString(`${cfg.id}:residue`));
      for (let i = 0; i < count; i += 1) {
        const el = document.createElement("span");
        el.className = "belief-residue";
        const size = 2 + rand() * 3.6;
        el.style.width = `${size}px`;
        el.style.height = `${size}px`;
        const home = {
          x: box.x + 20 + rand() * Math.max(20, box.width - 40),
          y: box.y + 20 + rand() * Math.max(80, box.height - 40),
        };
        const scatter = {
          x: 24 + rand() * (secRect.width - 48),
          y: secRect.height * (0.08 + rand() * 0.84),
        };
        const rec = {
          el,
          home,
          scatter,
          opacity: 0.25 + rand() * 0.5,
          delay: rand() * 0.22,
        };
        particles.push(rec);
        gsap.set(el, { x: home.x, y: home.y, opacity: 0 });
        residueLayer.append(el);
      }
    }

    // ---------- 无障碍与状态同步 ----------
    function setExpanded(open) {
      summary.setAttribute("aria-expanded", String(open));
      details.classList.toggle("is-open", open);
      panel.setAttribute("aria-hidden", String(!open));
    }

    function resetForForm() {
      // 上一轮(逃逸/快收)留下的内联痕迹必须清掉,否则文字永远停在飞走的位置。
      gsap.set(tokens, { clearProps: "opacity,transform" });
      gsap.set(allText, { clearProps: "opacity,transform" });
      gsap.set(panel, { clearProps: "transform" });
      // 注意:类名必须用 classList 维护。
      panel.classList.remove("is-escaping");
    }

    // 关闭收尾:删变量、退类、权重归零、交还控制权。
    function finishClose() {
      resetDeltas();
      clearCornerVars();
      panel.classList.remove("is-open", "is-escaping");
      setExpanded(false);
      section.classList.remove("belief-panel-live");
      scene.state.interaction.weight = 0;
      scene.state.interaction.starOverrides.clear();
      scene.render();
      if (controller.active === instance) controller.active = null;
    }

    // ---------- 时间线工厂 ----------
    function buildFormTimeline(targetDeltas) {
      killActive();
      resetForForm();
      panelState = "FORMING";
      primeEdges();
      gsap.set(corners, { opacity: 0 });
      gsap.set(glass, { opacity: 0, scale: 0.985 });
      gsap.set(allText, { opacity: 0, y: 14 });

      const tl = gsap.timeline({
        onComplete: () => {
          panelState = "READING";
          activeTl = null;
        },
      });
      activeTl = tl;

      tl.fromTo(
        summary,
        { scale: 1 },
        { scale: 1.06, duration: 0.14, yoyo: true, repeat: 1, ease: "power2.out" },
        0
      )
        // 四角 delta 生长:节点、框线、面板几何由同一对象驱动
        .to(
          deltas,
          {
            dx: (i) => targetDeltas[i].dx,
            dy: (i) => targetDeltas[i].dy,
            duration: 0.62,
            ease: "power3.inOut",
            onUpdate: applyDeltaFrame,
          },
          0.08
        )
        // 星群同步飞向四角(覆盖权重 0→1)
        .to(
          scene.state.interaction,
          { weight: 1, duration: 0.62, ease: "power3.inOut", onUpdate: () => scene.render() },
          0.08
        )
        .to(corners, { opacity: 1, duration: 0.3, stagger: 0.05, ease: "power2.out" }, 0.42)
        // 框线逐边生長并闭合
        .to(
          edges,
          { opacity: 0.9, strokeDashoffset: 0, duration: 0.42, stagger: 0.09, ease: "power2.inOut" },
          0.46
        )
        // 玻璃凝结(晚于框线闭合过半)
        .to(glass, { opacity: 1, scale: 1, duration: 0.38, ease: "power2.out" }, 0.78)
        // 文本:kicker → 标题分行 → 正文逐句
        .to(kicker, { opacity: 0.85, y: 0, duration: 0.3, ease: "power2.out" }, 0.62)
        .to(titleLines, { opacity: 1, y: 0, duration: 0.42, stagger: 0.14, ease: "power2.out" }, 0.7)
        .to(bodyLines, { opacity: 1, y: 0, duration: 0.4, stagger: 0.13, ease: "power2.out" }, 0.94);
      return tl;
    }

    function buildDissolveTimeline() {
      killActive();
      panelState = "DISSOLVING";
      // 粒子回到出生位(面板内),等待随文字碎裂散开
      particles.forEach((p) => gsap.set(p.el, { x: p.home.x, y: p.home.y, opacity: 0 }));

      const tl = gsap.timeline({
        onComplete: () => {
          panelState = "RESIDUE";
          residueShown = true;
          finishClose();
          activeTl = null;
        },
      });
      activeTl = tl;

      // 1) 玻璃消散(两段,不闪没)
      tl.to(glass, { opacity: 0.35, duration: 0.26, ease: "power1.inOut" }, 0)
        .to(glass, { opacity: 0, duration: 0.22, ease: "power1.in" }, 0.26)
        // 2) 连接性文字先退(整行降透明,留下 token 独自逃逸)
        .to(kicker, { opacity: 0, duration: 0.2 }, 0.06)
        .to(titleLines, { opacity: 0, y: -10, duration: 0.26, stagger: 0.05 }, 0.1)
        .to(bodyLines, { opacity: 0.25, duration: 0.24 }, 0.12)
        // 3) 关键词逃逸(容器切外溢,各 token 按自己的漂移变量飞出)
        .call(() => panel.classList.add("is-escaping"), null, 0.2)
        .to(
          tokens,
          {
            opacity: 0,
            x: (i, el) => el.style.getPropertyValue("--drift-x"),
            y: (i, el) => el.style.getPropertyValue("--drift-y"),
            rotate: (i, el) => el.style.getPropertyValue("--drift-r"),
            duration: 0.52,
            stagger: 0.045,
            ease: "power2.in",
          },
          0.22
        )
        // 4) 星尘在字消失前出现,从出生位散向章节背景
        .to(
          particles.map((p) => p.el),
          {
            x: (i) => particles[i].scatter.x,
            y: (i) => particles[i].scatter.y,
            opacity: (i) => particles[i].opacity,
            duration: 0.55,
            stagger: 0.03,
            ease: "power2.out",
          },
          0.34
        )
        // 5) 框线退场、四角熄灭
        .to(edges, { opacity: 0, duration: 0.3, stagger: 0.04 }, 0.5)
        .to(corners, { opacity: 0, duration: 0.3, stagger: 0.04 }, 0.56)
        // 6) delta 归零、星群归位:节点回到当前锚定位,无需补间回旧坐标
        .to(
          deltas,
          { dx: 0, dy: 0, duration: 0.4, ease: "power2.inOut", onUpdate: applyDeltaFrame },
          0.58
        )
        .to(
          scene.state.interaction,
          { weight: 0, duration: 0.4, ease: "power2.inOut", onUpdate: () => scene.render() },
          0.58
        );
      return tl;
    }

    function buildReassembleTimeline(targetDeltas) {
      killActive();
      resetForForm();
      panelState = "REASSEMBLING";
      primeEdges();
      gsap.set(corners, { opacity: 0 });
      gsap.set(glass, { opacity: 0, scale: 0.985 });
      gsap.set(allText, { opacity: 0, y: 14 });

      const tl = gsap.timeline({
        onComplete: () => {
          panelState = "READING";
          residueShown = false;
          activeTl = null;
        },
      });
      activeTl = tl;

      tl.to(
        deltas,
        {
          dx: (i) => targetDeltas[i].dx,
          dy: (i) => targetDeltas[i].dy,
          duration: 0.5,
          ease: "power3.inOut",
          onUpdate: applyDeltaFrame,
        },
        0
      )
        .to(
          scene.state.interaction,
          { weight: 1, duration: 0.5, ease: "power3.inOut", onUpdate: () => scene.render() },
          0
        )
        // 星尘先被"吸引"提亮,再收回出生位并融入文字
        .to(
          particles.map((p) => p.el),
          { opacity: (i) => Math.min(1, particles[i].opacity + 0.3), duration: 0.18 },
          0
        )
        .to(
          particles.map((p) => p.el),
          {
            x: (i) => particles[i].home.x,
            y: (i) => particles[i].home.y,
            opacity: 0,
            duration: 0.44,
            stagger: 0.02,
            ease: "power2.in",
          },
          0.12
        )
        .to(corners, { opacity: 1, duration: 0.24, stagger: 0.04 }, 0.2)
        .to(
          edges,
          { opacity: 0.9, strokeDashoffset: 0, duration: 0.34, stagger: 0.07, ease: "power2.inOut" },
          0.26
        )
        .to(glass, { opacity: 1, scale: 1, duration: 0.3, ease: "power2.out" }, 0.44)
        .to(kicker, { opacity: 0.85, y: 0, duration: 0.24 }, 0.42)
        .to(titleLines, { opacity: 1, y: 0, duration: 0.32, stagger: 0.1 }, 0.46)
        .to(bodyLines, { opacity: 1, y: 0, duration: 0.3, stagger: 0.1 }, 0.56);
      return tl;
    }

    // 快速收起:离场 / 滚动超限的缩短版仪式(≤400ms),不播完整关闭。
    function buildFastCollapseTimeline() {
      killActive();
      panelState = "FAST_COLLAPSING";
      const tl = gsap.timeline({
        onComplete: () => {
          panelState = "RESIDUE";
          residueShown = true;
          gsap.set(tokens, { clearProps: "opacity,transform" });
          gsap.set(panel, { clearProps: "opacity,transform" });
          // 星尘直接落位停驻
          particles.forEach((p) => {
            gsap.set(p.el, { x: p.scatter.x, y: p.scatter.y, opacity: p.opacity });
          });
          finishClose();
          activeTl = null;
        },
      });
      activeTl = tl;
      tl.to(panel, { opacity: 0, duration: 0.28, ease: "power1.in" }, 0)
        .to(
          scene.state.interaction,
          { weight: 0, duration: 0.28, ease: "power1.in", onUpdate: () => scene.render() },
          0
        )
        .to(
          deltas,
          { dx: 0, dy: 0, duration: 0.28, ease: "power1.in", onUpdate: applyDeltaFrame },
          0
        );
      return tl;
    }

    // ---------- reduced-motion:无运动的稳定形态 ----------
    function openStatic(targetDeltas) {
      panelState = "READING";
      residueShown = false;
      targetDeltas.forEach((t, i) => {
        deltas[i].dx = t.dx;
        deltas[i].dy = t.dy;
      });
      syncFrame();
      panel.classList.add("is-open", "is-static");
      section.classList.add("belief-panel-live");
      setExpanded(true);
      gsap.set(panel, { opacity: 1 });
      gsap.set(allText, { opacity: 1, y: 0 });
      gsap.set(glass, { opacity: 1, scale: 1 });
      fullEdges();
      gsap.set(edges, { opacity: 0.9 });
      gsap.set(corners, { opacity: 1 });
      gsap.set(particles.map((p) => p.el), { opacity: 0 });
      // reduced-motion 下不征用星群(场景本就静止,覆盖只会留下孤点)
      scene.state.interaction.weight = 0;
      scene.state.interaction.starOverrides.clear();
      scene.render();
    }

    function closeStatic() {
      panelState = "RESIDUE";
      residueShown = true;
      panel.classList.remove("is-open", "is-static", "is-escaping");
      // 残响直接放到最终位置,不做飞行
      particles.forEach((p) => {
        gsap.set(p.el, { x: p.scatter.x, y: p.scatter.y, opacity: p.opacity });
      });
      finishClose();
    }

    // ---------- 入口 ----------
    function open() {
      // 双开守卫:另一实例若开着,先收起前者。
      if (controller.active && controller.active !== instance) {
        controller.active.collapseImmediate();
      }
      controller.active = instance;
      openScrollY = window.scrollY;

      bases = readBases();
      const targetDeltas = computeTargetDeltas(bases);
      // 内容高度按最终框宽测一次,展开期间只复用,不逐帧回流。
      const finalPts = bases.map((b, i) => ({ x: b.x + targetDeltas[i].dx, y: b.y + targetDeltas[i].dy }));
      const finalW = Math.max(...finalPts.map((p) => p.x)) - Math.min(...finalPts.map((p) => p.x));
      contentHeight = measureContent(finalW);

      cornerStars = pickCornerStars();
      resetDeltas();
      syncFrame(); // delta 为 0:覆盖与框先对齐到节点基准位

      if (!particles.length) {
        const secRect = section.getBoundingClientRect();
        const xs = finalPts.map((p) => p.x - secRect.left);
        const ys = finalPts.map((p) => p.y - secRect.top);
        buildParticles({
          x: Math.min(...xs),
          y: Math.min(...ys),
          width: Math.max(...xs) - Math.min(...xs),
          height: Math.max(...ys) - Math.min(...ys),
        });
      }

      if (reduceMotion) {
        openStatic(targetDeltas);
        return;
      }
      panel.classList.add("is-open");
      setExpanded(true);
      section.classList.add("belief-panel-live");
      gsap.set(panel, { opacity: 1 });
      if (residueShown) {
        buildReassembleTimeline(targetDeltas);
      } else {
        buildFormTimeline(targetDeltas);
      }
    }

    function close(reason) {
      if (reduceMotion) {
        closeStatic();
        return;
      }
      if (reason === "leave") {
        buildFastCollapseTimeline();
      } else {
        buildDissolveTimeline();
      }
    }

    // 立即就地收拢(无动画):另一实例双开让位 / resize 跨越断点时使用。
    // 因采用变量方案,不存在 inline transform 残留;粒子几何已过时,清空待重建。
    function collapseImmediate() {
      killActive();
      panelState = "RESIDUE";
      residueShown = true;
      gsap.set(tokens, { clearProps: "opacity,transform" });
      gsap.set(allText, { clearProps: "opacity,transform" });
      gsap.set(panel, { clearProps: "opacity,transform" });
      particles = [];
      residueLayer.innerHTML = "";
      finishClose();
    }

    // resize（同宽度段）:重算几何与散点位置。
    function relayout() {
      if (panelState === "IDLE") return;
      bases = readBases();
      const secRect = section.getBoundingClientRect();
      if (particles.length && (panelState === "RESIDUE" || panelState === "DISSOLVING")) {
        // 散点按新的章节尺寸重排(确定性让位于正确性,允许重新随机)
        const rand = seededRandom(hashString(`${cfg.id}:resize:${Date.now()}`));
        particles.forEach((p) => {
          rand(); // size 占位,保持与生成期一致的消费节奏
          p.scatter = {
            x: 24 + rand() * (secRect.width - 48),
            y: secRect.height * (0.08 + rand() * 0.84),
          };
          if (residueShown) gsap.set(p.el, { x: p.scatter.x, y: p.scatter.y });
        });
      }
      if (VISIBLE_STATES.has(panelState)) syncFrame();
    }

    // ---------- 交互接线 ----------
    summary.addEventListener("click", (event) => {
      event.preventDefault(); // 接管 <details>,交给星群面板
      switch (panelState) {
        case "IDLE":
        case "RESIDUE":
          open();
          break;
        case "READING":
        case "FORMING":
        case "REASSEMBLING":
          close("user");
          break;
        default:
          break; // DISSOLVING / FAST_COLLAPSING 期间忽略,防止双时间线
      }
    });

    // 第 5 点:极弱的收起控件。
    closeButton.addEventListener("click", (event) => {
      event.stopPropagation();
      if (OPEN_STATES.has(panelState)) close("user");
    });

    // 玻璃空白区域点击关闭;正文/标题/关键词文本区不关闭;
    // 有选中文本时不关闭;交互元素事件不冒泡成 close。
    panel.addEventListener("click", (event) => {
      if (!OPEN_STATES.has(panelState)) return;
      const sel = window.getSelection();
      if (sel && sel.toString().trim()) return;
      const interactive = event.target.closest("button, a, summary");
      if (interactive) return;
      const inContent = event.target.closest(".belief-panel__content");
      // 命中内容容器自身(空白/内边距)→ 关闭;命中文字节点 → guard。
      if (inContent && inContent !== event.target) return;
      close("user");
    });

    // 兜底:滚出章节即快速收起(滚动守卫是主规则,这里是越界保险)。
    ScrollTrigger.create({
      trigger: section,
      start: "top bottom-=6%",
      end: "bottom top+=6%",
      onToggle: ({ isActive }) => {
        if (!isActive && OPEN_STATES.has(panelState)) {
          close("leave");
        }
      },
    });

    const instance = {
      get state() {
        return panelState;
      },
      get openScrollY() {
        return openScrollY;
      },
      open,
      close,
      collapseImmediate,
      relayout,
      syncFrame,
      destroy() {
        killActive();
        panel.remove();
        residueLayer.remove();
      },
    };
    return instance;
  }

  const instances = INSTANCES.map((cfg) => createInstance(cfg)).filter(Boolean);
  if (!instances.length) return null;

  return {
    get active() {
      return controller.active;
    },
    destroy() {
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      instances.forEach((inst) => inst.destroy());
    },
  };
}
