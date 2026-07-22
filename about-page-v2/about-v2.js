// Our Story V2 — hover-driven chapter index + smooth scroll.
// Hovering (or focusing / clicking) a chapter on the left crossfades its
// description and image on the right. The active chapter persists until
// another is hovered — there's no revert-on-leave, so the section always
// shows a coherent state. Pure class toggles; the crossfade is CSS.
import Lenis from "./assets/vendor/lenis.mjs";

const prefersReducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)"
).matches;

// ---- Nav hairline: return the stroke once the page scrolls. ----
const header = document.querySelector(".header--v2");
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
  // Hover is the primary interaction; focus mirrors it for keyboard users;
  // click covers touch (no hover) and is a real activation.
  item.addEventListener("mouseenter", () => activate(i));
  item.addEventListener("focus", () => activate(i));
  item.addEventListener("click", () => activate(i));
});

// ---- Smooth scroll (the site's signature feel), reduced-motion aware. ----
if (!prefersReducedMotion) {
  const lenis = new Lenis({ lerp: 0.09, smoothWheel: true, syncTouch: true });
  const raf = (t) => {
    lenis.raf(t);
    requestAnimationFrame(raf);
  };
  requestAnimationFrame(raf);
}
