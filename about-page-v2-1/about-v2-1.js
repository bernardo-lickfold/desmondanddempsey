// Our Story V2.1 — hover-driven chapter index + smooth scroll.
// Same interaction as V2: hovering (or focusing / clicking) a chapter
// crossfades its description and the full-bleed image. Pure class toggles;
// the crossfade + appear is CSS.
import Lenis from "./assets/vendor/lenis.mjs";

const prefersReducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)"
).matches;

// ---- Nav hairline ----
const header = document.querySelector(".header--v21");
const syncScrolled = () =>
  header && header.classList.toggle("is-scrolled", window.scrollY > 4);
window.addEventListener("scroll", syncScrolled, { passive: true });
syncScrolled();

// ---- Chapter index ----
const items = [...document.querySelectorAll(".filters__item")];
const panels = [...document.querySelectorAll(".filters__panel")];
const imgs = [...document.querySelectorAll(".filters__img")];

let active = 0;
function activate(i) {
  if (i === active) return;
  active = i;
  items.forEach((el, n) => {
    const on = n === i;
    el.classList.toggle("is-active", on);
    el.setAttribute("aria-selected", String(on));
  });
  panels.forEach((el, n) => el.classList.toggle("is-active", n === i));
  imgs.forEach((el, n) => el.classList.toggle("is-active", n === i));
}

items.forEach((item, i) => {
  item.addEventListener("mouseenter", () => activate(i));
  item.addEventListener("focus", () => activate(i));
  item.addEventListener("click", () => activate(i));
});

// ---- Smooth scroll ----
if (!prefersReducedMotion) {
  const lenis = new Lenis({ lerp: 0.09, smoothWheel: true, syncTouch: true });
  const raf = (t) => {
    lenis.raf(t);
    requestAnimationFrame(raf);
  };
  requestAnimationFrame(raf);
}
