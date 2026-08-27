import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { setupGsap, prefersReducedMotion } from "./gsap-setup.js";

// 与 motion.css 中 .motion-ready .section-reveal > * 的 :not() 链保持一致:
// 列表类容器由下方的逐列表瀑布单独负责入场,不能再被章节级淡入驱动一次,
// 否则同一视觉区域会叠加两层错峰。
// .field-kicker/.field-title/.field-lead/.thought-thread 同理交给下方的标题链编排,
// 属性归属唯一:每个元素的 opacity/transform 只有一个写者。
const SECTION_REVEAL_FADE_SELECTOR =
  ".section-reveal > *:not(.field-markers):not(.field-map):not(.trajectory):not(.belief-field):not(.protocol-list):not(.witness-list):not(.evidence-list):not(.quiet-lines):not(.story-copy):not(.field-kicker):not(.field-title):not(.field-lead):not(.thought-thread)";

// 章节标题链编排的目标元素(按阅读顺序排列);.story-copy 整体作为触发单元。
const TITLE_CHAIN_SELECTOR =
  ".field-kicker, .field-title, .story-title, .field-lead, .field-stamp, .thought-thread";

const WATERFALL_LIST_SELECTOR =
  ".field-markers, .field-map, .trajectory, .belief-field, .protocol-list, .witness-list, .evidence-list, .quiet-lines";

const WATERFALL_ITEM_SELECTOR =
  ".field-marker, .belief-node, .protocol-item, .witness, .evidence-item, .quiet-line, .map-point, .trajectory-step";

function buildMotion(reduceMotion) {
  // 章节内容揭示:每章只触发一次,针对该章自己的 .section-reveal 子元素,
  // 因此错峰数量永远等于真实条目数(#invite 的第 5 个子元素也能被覆盖)。
  ScrollTrigger.batch(".field-section", {
    start: "top 72%",
    once: true,
    onEnter: (batch) => {
      batch.forEach((section) => {
        const targets = section.querySelectorAll(SECTION_REVEAL_FADE_SELECTOR);
        if (reduceMotion) {
          gsap.set(targets, { opacity: 1, y: 0 });
        } else {
          gsap.to(targets, { opacity: 1, y: 0, stagger: 0.07, duration: 0.64 });
        }
      });
    },
  });

  // 逐列表瀑布:与章节级揭示互不重叠(不是同一批节点),条目数自适应。
  document.querySelectorAll(WATERFALL_LIST_SELECTOR).forEach((list) => {
    if (!list.querySelector(WATERFALL_ITEM_SELECTOR)) return;
    ScrollTrigger.create({
      trigger: list,
      start: "top 85%",
      once: true,
      onEnter: () => {
        // 在触发时刻(而非创建时刻)才取条目,并排除已被场景锚定的元素:
        // 锚定层用 opacity 表达"本章是否活动",若这里再用 gsap.from 写一次
        // 内联 opacity,就会出现两个写者争同一属性——内联样式会永久压过
        // .is-live,锚定文字将再也不显示。属性归属必须唯一。
        const items = [...list.querySelectorAll(WATERFALL_ITEM_SELECTOR)].filter(
          (el) => !el.classList.contains("is-anchored")
        );
        if (!items.length) return;
        if (reduceMotion) {
          gsap.set(items, { clearProps: "opacity,transform" });
          return;
        }
        gsap.from(items, { opacity: 0, y: 14, stagger: 0.07, duration: 0.5 });
      },
    });
  });

  // 章节标题链编排:kicker → title → lead → stamp → 诗句按阅读顺序依次入场。
  // 触发单元取承载它们的容器(.story-copy、final-field 的 .section-reveal,
  // 以及 data-field——#change 章的 thought-thread 是 .data-field 的直接子元素,
  // 不在任何 .story-copy 内,漏掉它将永远隐藏);
  // 首次进入视口一次性揭示;锚定层接管的元素不在这些容器内,互不干扰。
  // 同一章节的 .data-field 与其内部 .story-copy 都会触发,但 gsap.to 终态一致,
  // 不构成双写者冲突。
  // start 取 92% 并补 onEnterBack:页面底部章节的触发线"top 92%"必须能被滚到,
  // 否则末页标题链永远不会揭示;回滚时也兑现,避免快速滚动跳过的章节残留隐藏态。
  const revealTitleChain = (batch, reduceMotion) => {
    batch.forEach((container) => {
      const targets = container.querySelectorAll(TITLE_CHAIN_SELECTOR);
      if (!targets.length) return;
      if (reduceMotion) {
        gsap.set(targets, { opacity: 1, y: 0 });
      } else {
        gsap.to(targets, { opacity: 1, y: 0, stagger: 0.09, duration: 0.72 });
      }
    });
  };
  ScrollTrigger.batch(".story-copy, .final-field .section-reveal, .data-field", {
    start: "top 92%",
    once: true,
    onEnter: (batch) => revealTitleChain(batch, reduceMotion),
    onEnterBack: (batch) => revealTitleChain(batch, reduceMotion),
  });

  // 装饰水印的极缓慢视差:仅 transform,随滚动轻微上浮,不做循环呼吸。
  if (!reduceMotion) {
    document.querySelectorAll(".section-mantra").forEach((mantra) => {
      gsap.fromTo(
        mantra,
        { yPercent: 5 },
        {
          yPercent: -5,
          ease: "none",
          scrollTrigger: {
            trigger: mantra.closest(".field-section") || mantra,
            start: "top bottom",
            end: "bottom top",
            scrub: 0.8,
          },
        }
      );
    });
  }

  // 指针光场:纯装饰,reduced-motion 下整段跳过。用 quickSetter 显式带 "px" 单位
  // 写 CSS 变量(quickTo 对自定义属性的单位推断不可靠),由普通对象承载补间值。
  if (!reduceMotion) {
    const root = document.documentElement;
    const pointer = { x: window.innerWidth * 0.52, y: window.innerHeight * 0.42 };
    const setX = gsap.quickSetter(root, "--pointer-x", "px");
    const setY = gsap.quickSetter(root, "--pointer-y", "px");
    const xTo = gsap.quickTo(pointer, "x", { duration: 0.5, ease: "power3", onUpdate: () => setX(pointer.x) });
    const yTo = gsap.quickTo(pointer, "y", { duration: 0.5, ease: "power3", onUpdate: () => setY(pointer.y) });
    window.addEventListener(
      "pointermove",
      (event) => {
        xTo(event.clientX);
        yTo(event.clientY);
      },
      { passive: true }
    );
  }
}

// 阅读位置信号(进度条与 35% 统计)是功能而非装饰:它们不依赖隐藏态,
// 且在 reduced-motion 下只换掉平滑跟随。因此与 motion-ready 事务分离,
// 独立提交、独立降级——入场动效失败不应连带杀掉阅读位置反馈。
export function initProgress() {
  const reduceMotion = prefersReducedMotion();
  try {
    setupGsap();
    gsap.context(() => {
      gsap.fromTo(
        "#progress",
        { scaleX: 0 },
        {
          scaleX: 1,
          ease: "none",
          scrollTrigger: {
            trigger: document.body,
            start: "top top",
            end: "bottom bottom",
            scrub: reduceMotion ? true : 0.3,
          },
        }
      );

      // "35%" 递增:HTML 中始终是真实终值,补间只是进入视口时的一次临时覆盖,
      // 不是数值的真源——脚本失败或 reduced-motion 下显示的都是正确终值。
      const bigStat = document.querySelector(".big-stat");
      if (bigStat) {
        const finalText = bigStat.textContent.trim();
        const finalValue = parseInt(finalText, 10);
        const suffix = finalText.replace(/^-?\d+/, "");
        if (!Number.isNaN(finalValue)) {
          ScrollTrigger.create({
            trigger: bigStat,
            start: "top 80%",
            once: true,
            onEnter: () => {
              if (reduceMotion) {
                bigStat.textContent = finalText;
                return;
              }
              const counter = { value: 0 };
              gsap.to(counter, {
                value: finalValue,
                duration: 0.9,
                ease: "power2.out",
                onUpdate: () => {
                  bigStat.textContent = Math.round(counter.value) + suffix;
                },
                onComplete: () => {
                  bigStat.textContent = finalText;
                },
              });
            },
          });
        }
      }
    });
  } catch (error) {
    console.warn("[motion] progress init failed, static values remain", error);
  }
}

export function initMotion() {
  const reduceMotion = prefersReducedMotion();

  // reduced-motion:不提交 motion-ready(隐藏态永不生效),内容保持静态可见。
  if (reduceMotion) return;

  // motion-ready 初始化事务:DOM 默认可见 → 注册全部动效 → 全部成功后
  // 最后一步才提交 motion-ready(隐藏态开关)。任一步抛错则回滚已注册的
  // trigger 且不提交,页面退回默认可见态——脚本失败永远不损失内容。
  let ctx;
  try {
    setupGsap();
    ctx = gsap.context(() => {
      buildMotion(false);
    });
  } catch (error) {
    if (ctx) ctx.revert();
    document.documentElement.classList.remove("motion-ready");
    console.warn("[motion] init failed, content stays fully visible", error);
    return;
  }
  document.documentElement.classList.add("motion-ready");
}
