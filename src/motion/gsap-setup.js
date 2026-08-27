import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { CustomEase } from "gsap/CustomEase";

// 场景层与揭示层都需要 GSAP,但插件注册与全站默认缓动只应发生一次。
// 幂等:无论谁先加载完成,结果都相同。
let initialized = false;

export function setupGsap() {
  if (initialized) return gsap;
  gsap.registerPlugin(ScrollTrigger, CustomEase);
  CustomEase.create("field-ease", "0.2,0,0,1");
  gsap.defaults({ ease: "field-ease" });
  initialized = true;
  return gsap;
}

export const prefersReducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;
