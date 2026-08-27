// Hero 信号舞台:单选展开 + 切换。
//
// 功能层(本文件)永远可用:点击切换 is-expanded / is-dimmed,并同步读屏
// 播报区。没有动效时由 CSS 直接完成形态切换(静态回退)。
//
// 增强路径:首次点击才懒加载 gsap + Flip(reduced-motion 时不加载)。
// Flip 运行期间给舞台加 .is-flipping 关闭 CSS transition,保证 transform /
// opacity 只有一个写者;动画结束立即撤掉,交互态仍归样式表。
export function initOrbitSignals() {
  const stage = document.querySelector(".field-stage");
  const live = document.querySelector(".field-stage__live");
  const cards = [...stage.querySelectorAll(".signal-card")];
  if (!stage || !cards.length) return;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  let motionPromise = null;
  function loadFlip() {
    if (reducedMotion.matches) return Promise.resolve(null);
    if (!motionPromise) {
      motionPromise = Promise.all([import("gsap"), import("gsap/Flip")])
        .then(([gsapMod, flipMod]) => {
          gsapMod.default.registerPlugin(flipMod.Flip);
          return { gsap: gsapMod.default, Flip: flipMod.Flip };
        })
        .catch(() => null);
    }
    return motionPromise;
  }

  // 状态同步:与动效无关,任何路径下都必须先走完这一步。
  function activate(card) {
    cards.forEach((candidate) => {
      const active = candidate === card;
      candidate.classList.toggle("is-expanded", active);
      candidate.classList.toggle("is-dimmed", !active);
      candidate.setAttribute("aria-pressed", String(active));
    });
    if (live) {
      const word = card.querySelector(".signal-card__word");
      const note = card.querySelector(".signal-card__note");
      live.textContent = `${word ? word.textContent : ""}。${note ? note.textContent : ""}`;
    }
  }

  // 艺术字逐字包裹(只做一次):gsap 用这些 span 做错峰入场;
  // 静态回退下它们继承终态样式,视觉无差。
  function splitArt(card) {
    const art = card.querySelector(".signal-card__art");
    if (!art || art.dataset.split) return art ? [...art.children] : [];
    const text = art.textContent;
    art.textContent = "";
    [...text].forEach((ch) => {
      const span = document.createElement("span");
      span.textContent = ch;
      art.appendChild(span);
    });
    art.dataset.split = "1";
    return [...art.children];
  }

  // 展开卡片内部文字的入场编排:逐字显影 → 英文字距收拢 → 说明上浮。
  // 时值整体压在卡片飞行的 0.78s 尾段之内,动作接力不叠层。
  function playDetail(card, gsap) {
    const chars = splitArt(card);
    if (chars.length) {
      gsap.fromTo(
        chars,
        { opacity: 0, y: 26, filter: "blur(10px)" },
        {
          opacity: 1,
          y: 0,
          filter: "blur(0px)",
          duration: 0.7,
          stagger: 0.1,
          delay: 0.32,
          ease: "power3.out",
          clearProps: "filter",
        }
      );
    }
    const en = card.querySelector(".signal-card__art-en");
    if (en) {
      gsap.fromTo(
        en,
        { opacity: 0, letterSpacing: "0.6em" },
        { opacity: 0.85, letterSpacing: "0.34em", duration: 0.8, delay: 0.5, ease: "power2.out" }
      );
    }
    const note = card.querySelector(".signal-card__note");
    if (note) {
      gsap.fromTo(
        note,
        { opacity: 0, y: 14 },
        { opacity: 1, y: 0, duration: 0.6, delay: 0.62, ease: "power2.out" }
      );
    }
  }

  function flipTo(card, { gsap, Flip }) {
    stage.classList.add("is-flipping");
    const state = Flip.getState(cards);
    activate(card);
    Flip.from(state, {
      targets: cards,
      duration: 0.78,
      ease: "power3.inOut",
      props: "opacity",
      zIndex: 4,
      onComplete: () => stage.classList.remove("is-flipping"),
    });
    playDetail(card, gsap);
  }

  cards.forEach((card) => {
    card.addEventListener("click", () => {
      if (card.classList.contains("is-expanded")) return;
      // 飞行中的舞台不接受新目标,避免中途叠一次 Flip 造成状态抖动。
      if (stage.classList.contains("is-flipping")) return;
      loadFlip().then((motion) => {
        // Promise 窗口内的重复点击已由 is-expanded 守卫挡掉。
        if (card.classList.contains("is-expanded")) return;
        if (motion) {
          flipTo(card, motion);
        } else {
          activate(card);
        }
      });
    });
  });
}
