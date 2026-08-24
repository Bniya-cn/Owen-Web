import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { setupGsap, prefersReducedMotion } from "./gsap-setup.js";

// 与 motion.css 中 .motion-ready .section-reveal > * 的 :not() 链保持一致:
// 列表类容器由下方的逐列表瀑布单独负责入场,不能再被章节级淡入驱动一次,
// 否则同一视觉区域会叠加两层错峰。
const SECTION_REVEAL_FADE_SELECTOR =
  ".section-reveal > *:not(.field-markers):not(.field-map):not(.trajectory):not(.belief-field):not(.protocol-list):not(.witness-list):not(.evidence-list):not(.quiet-lines)";

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

  // 进度条传达的是真实阅读位置而非装饰,因此在 reduced-motion 下保留,
  // 只把平滑跟随(scrub: 0.3)换成瞬时对齐(scrub: true)。
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

  // 逐列表瀑布:与章节级揭示互不重叠(不是同一批节点),条目数自适应。
  document.querySelectorAll(WATERFALL_LIST_SELECTOR).forEach((list) => {
    const items = list.querySelectorAll(WATERFALL_ITEM_SELECTOR);
    if (!items.length) return;
    ScrollTrigger.create({
      trigger: list,
      start: "top 85%",
      once: true,
      onEnter: () => {
        if (reduceMotion) {
          gsap.set(items, { clearProps: "opacity,transform" });
          return;
        }
        gsap.from(items, { opacity: 0, y: 14, stagger: 0.07, duration: 0.5 });
      },
    });
  });

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

export function initMotion() {
  setupGsap();

  // 只有确认动效层可用后才加这个类——它是 CSS 里"内容预置为隐藏"的开关。
  document.documentElement.classList.add("motion-ready");

  buildMotion(prefersReducedMotion());
}
