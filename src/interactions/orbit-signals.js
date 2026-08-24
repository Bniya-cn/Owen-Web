// Hero 信号场节点:单选揭示。与工作协议选择器共用同一套单选语法。
// 圆环涟漪是一次性 CSS keyframe(600ms),不是循环脉冲;reduced-motion
// 已由全局样式把 animation-duration 压到近零,此处无需额外分支。
export function initOrbitSignals() {
  const orbit = document.querySelector(".field-orbit");
  const note = document.querySelector(".field-orbit__note");
  const nodes = [...document.querySelectorAll(".field-node")];
  if (!nodes.length) return;

  let pulseTimer = null;

  nodes.forEach((node) => {
    node.addEventListener("click", () => {
      nodes.forEach((candidate) => {
        const active = candidate === node;
        candidate.classList.toggle("is-active", active);
        candidate.setAttribute("aria-pressed", String(active));
      });

      if (note) {
        note.textContent = node.dataset.note || "";
        note.classList.add("is-shown");
      }

      if (orbit) {
        orbit.classList.remove("is-pulsing");
        // 强制回流,使重复点击能重新触发同一段动画
        void orbit.offsetWidth;
        orbit.classList.add("is-pulsing");
        clearTimeout(pulseTimer);
        pulseTimer = setTimeout(() => orbit.classList.remove("is-pulsing"), 650);
      }
    });
  });
}
