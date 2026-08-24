// 章节可见性同步:为进入视口的章节打上 .is-visible(驱动区块光晕),
// 并把右下角浮标更新为当前章节名。属于功能性状态同步,不依赖 GSAP,
// 也不受 prefers-reduced-motion 影响。
export function initSectionStatus() {
  const statusText = document.querySelector("#statusText");
  const sections = [...document.querySelectorAll(".field-section")];
  if (!sections.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        if (statusText) statusText.textContent = `${entry.target.dataset.label} / DEMO`;
      });
    },
    { threshold: 0.28 }
  );

  sections.forEach((section) => observer.observe(section));
}
