import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { STARS } from "../scene/layouts.js";

/*
 * 星群成框 / 文本星尘（ConstellationPanel）。
 *
 * 隐喻:思想被阅读时形成语言;离开语言后重新回到星群。
 *
 * 架构约束(与 DESIGN.md 的单一写者原则一致):
 * - 主节点与滚动场景由 master-timeline 独占;本模块只使用一条独立的
 *   "星群交互覆盖"通道(星群本身不参与滚动 morph,无抢写风险)。
 * - 框线 / 玻璃 / 文本 / 星尘全部是 beliefs 章节的本地层,随章节一起滚走,
 *   不使用 position: fixed,不污染其它章节。
 * - <details> 原生语义保留:脚本不可用时展开仍然工作(渐进增强)。
 *
 * 状态机:
 *   IDLE → FORMING → READING → DISSOLVING → RESIDUE → REASSEMBLING → READING
 *   FORMING / READING 离开章节 → FAST_COLLAPSING → RESIDUE
 */

const BELIEF_ID = "goodwill";

// 逃逸关键词:关闭时其余连接性文字先淡出,这些词逃出并碎裂为星尘。
// 全部来自原文,不新增文案。
const KEYWORDS = ["善意", "关键时刻", "选择", "资历", "经验", "职位", "收入"];

// 粒子预算:单条信念 10–18 颗,移动端减约 30%。
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
  const section = document.getElementById("beliefs");
  const details = section?.querySelector(".source-note");
  const summary = details?.querySelector("summary");
  if (!section || !details || !summary) return null;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isMobile = () => window.innerWidth < 840;

  // ---------- 状态机 ----------
  let panelState = "IDLE";
  let activeTl = null; // 当前可取消的时间线(单一写者)
  let cornerStars = []; // 被征用的星索引
  let particles = []; // residue 粒子记录
  let residueShown = false;

  const killActive = () => {
    if (activeTl) {
      activeTl.kill();
      activeTl = null;
    }
  };

  // ---------- DOM 构建(面板与残响层都是章节本地层) ----------
  const panel = document.createElement("aside");
  panel.className = "belief-panel";
  panel.id = "belief-panel";
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
      <span class="belief-panel__kicker">Belief / Lived Truth</span>
      <h3 class="belief-panel__title"><span class="belief-panel__line">善意，</span><span class="belief-panel__line">不是一种履历。</span></h3>
      <div class="belief-panel__body-slot"></div>
      <p class="belief-panel__close-hint">再次点击收起</p>
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
    const rand = seededRandom(hashString(`${BELIEF_ID}:split`));
    // 按句号拆行,逐行成 <span>;关键词包 token,并预置逃逸漂移量。
    const sentences = sourceBody.textContent.split(/(?<=。)/).filter((s) => s.trim());
    sentences.forEach((sentence) => {
      const line = document.createElement("span");
      line.className = "belief-panel__line";
      let rest = sentence;
      while (rest.length) {
        let hit = null;
        let hitIndex = rest.length;
        for (const kw of KEYWORDS) {
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
  summary.setAttribute("aria-controls", "belief-panel");

  const frame = panel.querySelector(".belief-panel__frame");
  const glass = panel.querySelector(".belief-panel__glass");
  const edges = [...panel.querySelectorAll(".belief-panel__edge")];
  const corners = [...panel.querySelectorAll(".belief-panel__corner")];
  const titleLines = [...panel.querySelectorAll(".belief-panel__title .belief-panel__line")];
  const bodyLines = [...panel.querySelectorAll(".belief-panel__body .belief-panel__line")];
  const tokens = [...panel.querySelectorAll(".belief-token")];
  const kicker = panel.querySelector(".belief-panel__kicker");
  const allText = [kicker, ...titleLines, ...bodyLines];

  // ---------- 几何:面板位置与四角坐标 ----------
  // 四角允许 1–2% 不对称,第一个角为 source corner(亮度稍高)。
  const ASYM = [
    { dx: 0.012, dy: 0.018 },
    { dx: -0.008, dy: -0.006 },
    { dx: 0.006, dy: -0.014 },
    { dx: -0.015, dy: 0.008 },
  ];

  function panelBox() {
    // resize 防抖结束时视口可能刚变化,先强制 reflow 再取矩形,避免用旧几何算出越界位置
    void section.offsetWidth;
    const secRect = section.getBoundingClientRect();
    const copy = section.querySelector(".story-copy");
    const copyRect = copy?.getBoundingClientRect();
    const vw = window.innerWidth;
    const width = Math.min(isMobile() ? vw * 0.88 : Math.min(620, vw * 0.42), secRect.width * 0.92);
    let left;
    if (copyRect && !isMobile()) {
      left = copyRect.left - secRect.left + (copyRect.width - width) / 2;
    } else {
      left = (secRect.width - width) / 2;
    }
    left = Math.max(16, Math.min(left, Math.max(16, secRect.width - width - 16)));
    const top = copyRect
      ? copyRect.top - secRect.top + copyRect.height * 0.16
      : secRect.height * 0.3;
    return { left, top, width };
  }

  function layoutPanel() {
    const { left, top, width } = panelBox();
    // 绝对定位的包含块是章节的 padding box 边缘(border 内缘),
    // 与 getBoundingClientRect 的 border box 原点一致,可直接使用。
    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
    panel.style.width = `${width}px`;
    // 先让内容撑起高度(测量态),再定框
    panel.classList.add("is-measuring");
    const height = panel.offsetHeight;
    panel.classList.remove("is-measuring");
    panel.style.height = `${height}px`;
    frame.setAttribute("viewBox", `0 0 ${width} ${height}`);
    frame.setAttribute("width", width);
    frame.setAttribute("height", height);

    const pts = ASYM.map((a, i) => [
      width * (i % 2 === 0 ? 0 + a.dx : 1 + a.dx),
      height * (i < 2 ? 0 + a.dy : 1 + a.dy),
    ]);
    corners.forEach((c, i) => {
      c.setAttribute("cx", pts[i][0]);
      c.setAttribute("cy", pts[i][1]);
    });
    for (let i = 0; i < 4; i += 1) {
      const [x1, y1] = pts[i];
      const [x2, y2] = pts[(i + 1) % 4];
      edges[i].setAttribute("d", `M${x1} ${y1} L${x2} ${y2}`);
      edges[i].style.strokeDasharray = "none";
      edges[i].style.strokeDashoffset = "0";
    }
    return { left, top, width, height, pts };
  }

  // 章节本地角点 → 视口坐标(星群覆盖层使用视口坐标)
  function cornerTargets(box) {
    const secRect = section.getBoundingClientRect();
    return box.pts.map(([x, y]) => ({
      x: secRect.left + box.left + x,
      y: secRect.top + box.top + y,
      o: 0.95,
    }));
  }

  // seeded:同一条信念永远征用同一批星
  function pickCornerStars() {
    const rand = seededRandom(hashString(`${BELIEF_ID}:stars`));
    const picked = new Set();
    while (picked.size < 4) picked.add(Math.floor(rand() * STARS.length));
    return [...picked];
  }

  function setStarOverrides(targets) {
    const ov = scene.state.interaction.starOverrides;
    ov.clear();
    cornerStars.forEach((idx, i) => ov.set(idx, targets[i]));
  }

  // ---------- 残响星尘:seeded、章节本地、可重组 ----------
  // home:文字碎裂时的出生位(面板框内);scatter:停驻在章节背景的位置。
  function buildParticles(box) {
    residueLayer.innerHTML = "";
    particles = [];
    const secRect = section.getBoundingClientRect();
    const count = isMobile() ? PARTICLE_COUNT_MOBILE : PARTICLE_COUNT_DESKTOP;
    const rand = seededRandom(hashString(`${BELIEF_ID}:residue`));
    for (let i = 0; i < count; i += 1) {
      const el = document.createElement("span");
      el.className = "belief-residue";
      const size = 2 + rand() * 3.6;
      el.style.width = `${size}px`;
      el.style.height = `${size}px`;
      const home = {
        x: box.left + 20 + rand() * (box.width - 40),
        y: box.top + 20 + rand() * Math.max(80, box.height - 40),
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
    // 上一轮(逃逸/快收)留下的内联痕迹必须清掉,否则文字永远停在飞走的位置,
    // 面板也可能带着上一轮 tween 残留的 transform 偏出几何位置。
    gsap.set(tokens, { clearProps: "opacity,transform" });
    gsap.set(allText, { clearProps: "opacity,transform" });
    gsap.set(panel, { clearProps: "transform" });
    // 注意:类名必须用 classList 维护。GSAP 的 className:"+=x" 会把字面量当类名追加,
    // 曾经污染类列表导致 .belief-panel 选择器失配、position 回退。
    panel.classList.remove("is-escaping", "+=is-escaping");
  }

  // ---------- 时间线工厂 ----------
  function buildFormTimeline(box, targets) {
    killActive();
    resetForForm();
    panelState = "FORMING";
    section.classList.add("belief-panel-live");

    // 边线预置:满长 dash + 满偏移 = 不可见,稍后逐边画出生长感
    edges.forEach((edge) => {
      const len = edge.getTotalLength();
      edge.style.strokeDasharray = `${len}`;
      edge.style.strokeDashoffset = `${len}`;
    });
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
      // 星群飞向四角(覆盖权重 0→1)
      .to(
        scene.state.interaction,
        {
          weight: 1,
          duration: 0.62,
          ease: "power3.inOut",
          onStart: () => setStarOverrides(targets),
          onUpdate: () => scene.render(),
        },
        0.08
      )
      .to(corners, { opacity: 1, duration: 0.3, stagger: 0.05, ease: "power2.out" }, 0.42)
      // 框线逐边生长并闭合
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
        panel.classList.remove("is-open", "is-escaping", "+=is-escaping");
        setExpanded(false);
        section.classList.remove("belief-panel-live");
        scene.state.interaction.weight = 0;
        scene.state.interaction.starOverrides.clear();
        scene.render();
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
      // 4) 星尘在文字消失前出现,从出生位散向章节背景
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
      // 6) 星群归位(权重回 0)
      .to(
        scene.state.interaction,
        { weight: 0, duration: 0.4, ease: "power2.inOut", onUpdate: () => scene.render() },
        0.58
      );
    return tl;
  }

  function buildReassembleTimeline(box, targets) {
    killActive();
    resetForForm();
    panelState = "REASSEMBLING";
    section.classList.add("belief-panel-live");

    edges.forEach((edge) => {
      const len = edge.getTotalLength();
      edge.style.strokeDasharray = `${len}`;
      edge.style.strokeDashoffset = `${len}`;
    });
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
      scene.state.interaction,
      {
        weight: 1,
        duration: 0.5,
        ease: "power3.inOut",
        onStart: () => setStarOverrides(targets),
        onUpdate: () => scene.render(),
      },
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

  // 快速收起:章节离场时的缩短版仪式(≤400ms),不播完整关闭。
  function buildFastCollapseTimeline() {
    killActive();
    panelState = "FAST_COLLAPSING";
    const tl = gsap.timeline({
      onComplete: () => {
        panelState = "RESIDUE";
        residueShown = true;
        panel.classList.remove("is-open", "is-escaping", "+=is-escaping");
        setExpanded(false);
        section.classList.remove("belief-panel-live");
        gsap.set(tokens, { clearProps: "opacity,transform" });
        gsap.set(panel, { clearProps: "opacity,transform" });
        // 星尘直接落位停驻
        particles.forEach((p) => {
          gsap.set(p.el, { x: p.scatter.x, y: p.scatter.y, opacity: p.opacity });
        });
        scene.state.interaction.weight = 0;
        scene.state.interaction.starOverrides.clear();
        scene.render();
        activeTl = null;
      },
    });
    activeTl = tl;
    tl.to(panel, { opacity: 0, duration: 0.28, ease: "power1.in" }, 0).to(
      scene.state.interaction,
      { weight: 0, duration: 0.28, ease: "power1.in", onUpdate: () => scene.render() },
      0
    );
    return tl;
  }

  // ---------- reduced-motion:无运动的稳定形态 ----------
  function openStatic() {
    panelState = "READING";
    residueShown = false;
    panel.classList.add("is-open", "is-static");
    section.classList.add("belief-panel-live");
    setExpanded(true);
    gsap.set(panel, { opacity: 1 });
    gsap.set(allText, { opacity: 1, y: 0 });
    gsap.set(glass, { opacity: 1, scale: 1 });
    edges.forEach((edge) => {
      edge.style.strokeDasharray = "none";
      edge.style.strokeDashoffset = "0";
    });
    gsap.set(edges, { opacity: 0.9 });
    gsap.set(corners, { opacity: 1 });
    gsap.set(particles.map((p) => p.el), { opacity: 0 });
  }

  function closeStatic() {
    panelState = "RESIDUE";
    residueShown = true;
    panel.classList.remove("is-open", "is-static", "is-escaping", "+=is-escaping");
    setExpanded(false);
    section.classList.remove("belief-panel-live");
    gsap.set(panel, { opacity: 0 });
    // 残响直接放到最终位置,不做飞行
    particles.forEach((p) => {
      gsap.set(p.el, { x: p.scatter.x, y: p.scatter.y, opacity: p.opacity });
    });
  }

  // ---------- 入口 ----------
  function open() {
    const box = layoutPanel();
    if (!particles.length) buildParticles(box);
    const targets = cornerTargets(box);
    cornerStars = pickCornerStars();
    if (reduceMotion) {
      openStatic();
      return;
    }
    panel.classList.add("is-open");
    setExpanded(true);
    gsap.set(panel, { opacity: 1 });
    if (residueShown) {
      buildReassembleTimeline(box, targets);
    } else {
      buildFormTimeline(box, targets);
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

  // ---------- 滚动协调:离场即快速收起,控制权交还主时间线 ----------
  ScrollTrigger.create({
    trigger: section,
    start: "top bottom-=6%",
    end: "bottom top+=6%",
    onToggle: ({ isActive }) => {
      if (
        !isActive &&
        (panelState === "READING" || panelState === "FORMING" || panelState === "REASSEMBLING")
      ) {
        close("leave");
      }
    },
  });

  // ---------- resize:重算几何与散点位置 ----------
  let resizeTimer = null;
  window.addEventListener(
    "resize",
    () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (panelState !== "READING" && panelState !== "RESIDUE") return;
        const box = layoutPanel();
        if (panelState === "READING" && !reduceMotion) {
          setStarOverrides(cornerTargets(box));
          scene.render();
        }
        if (!particles.length) return;
        // 散点按新的章节尺寸重排(确定性让位于正确性,允许重新随机)
        const secRect = section.getBoundingClientRect();
        const rand = seededRandom(hashString(`${BELIEF_ID}:resize:${Date.now()}`));
        particles.forEach((p) => {
          rand(); // size 占位,保持与生成期一致的消费节奏
          p.home = {
            x: box.left + 20 + rand() * (box.width - 40),
            y: box.top + 20 + rand() * Math.max(80, box.height - 40),
          };
          p.scatter = {
            x: 24 + rand() * (secRect.width - 48),
            y: secRect.height * (0.08 + rand() * 0.84),
          };
          if (residueShown) gsap.set(p.el, { x: p.scatter.x, y: p.scatter.y });
        });
      }, 250);
    },
    { passive: true }
  );

  return {
    get state() {
      return panelState;
    },
    destroy() {
      killActive();
      panel.remove();
      residueLayer.remove();
    },
  };
}
