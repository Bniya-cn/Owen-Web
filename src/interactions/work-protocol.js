// 工作协议选择器:单选,并把连带说明写入对侧的 aria-live 区域。
// 初始状态由标记中带 .is-active 的那一项决定,保证说明区从不出现空状态。
export function initWorkProtocol() {
  const items = [...document.querySelectorAll(".protocol-item")];
  const note = document.querySelector(".protocol-note");
  if (!items.length) return;

  const select = (item) => {
    items.forEach((candidate) => {
      const active = candidate === item;
      candidate.classList.toggle("is-active", active);
      candidate.setAttribute("aria-pressed", String(active));
    });
    if (note) note.textContent = item.dataset.note || "";
  };

  items.forEach((item) => item.addEventListener("click", () => select(item)));

  const initial = items.find((item) => item.classList.contains("is-active"));
  if (initial) select(initial);
}
