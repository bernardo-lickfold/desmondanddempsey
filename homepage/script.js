// Smooth scroll + scroll-scrubbed header + parallax images.
// Ported from project Nuwa's useSmoothScroll / useParallax / useScrollScrub:
// Lenis drives the real scroll position (so getBoundingClientRect + scrollY stay
// in sync with the eased motion), and a single rAF loop damps each value toward
// its target — the header collapse (--nav-p) and every registered parallax image
// (hero + section-2 columns) — so everything feels weighted rather than locked
// 1:1. The hero additionally carries a velocity-driven vertical stretch.
import Lenis from "./assets/vendor/lenis.mjs";

const clamp01 = (n) => Math.min(1, Math.max(0, n));
const lerp = (a, b, t) => a + (b - a) * t;

const prefersReducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)"
).matches;

const root = document.documentElement;
const header = document.querySelector(".header");
const heroFrame = document.querySelector(".hero");
const heroImg = document.querySelector(".hero__img");

// Scroll (in px) over which the header scrubs from full (160px) to compact (54px).
const NAV_RANGE = 140;
// Max vertical travel of a parallax image (±value, Nuwa's amount). Lighter on
// mobile — see parallaxAmount().
const PARALLAX = 60;
const PARALLAX_MOBILE = 30;
// Pinned collection-tab images drift ±this on mobile (independent of the
// general parallax travel above). Kept small for a subtle drift.
const TAB_PARALLAX = 10;
// Shared per-frame damping ("the weight") — Nuwa's value. Lower = silkier/laggier.
const DAMPING = 0.08;

// Velocity-driven stretch (hero only): |Lenis velocity| → a tiny vertical scale
// that eases back to 1 when the scroll settles. VEL_MAX caps it at a few percent.
const VEL_K = 0.0004;
const VEL_MAX = 0.05;
const STRETCH_DAMPING = 0.15; // a touch snappier so the stretch reacts to flicks

function navProgressTarget() {
  return clamp01(window.scrollY / NAV_RANGE);
}

// Nuwa's useParallax math: offset the image by ±amount based on the host's pass
// through the viewport — 0 when its top meets the bottom of the viewport, 1 when
// its bottom meets the top.
function parallaxOffset(host, amount) {
  const rect = host.getBoundingClientRect();
  const vh = window.innerHeight;
  const progress = clamp01((vh - rect.top) / (vh + rect.height));
  return (progress - 0.5) * 2 * amount;
}

function setNav(p) {
  header.style.setProperty("--nav-p", p.toFixed(4));
}

// Lighter parallax travel on mobile.
const mobileMQ = window.matchMedia("(max-width: 768px)");
const parallaxAmount = () => (mobileMQ.matches ? PARALLAX_MOBILE : PARALLAX);

// ---- Collection tabs: pinned scroll-scrub (mobile only) ----
// The .tabs-scroller is 400vh; the section pins (sticky) for the inner ~300vh.
// Scroll progress 0→1 advances the active collection (data-active 0→3) and fills
// the bottom progress bar (--tab-progress). Ported from Nuwa's useScrollScrub.
const tabsSection = document.querySelector(".tabs-section");
const tabsScroller = document.querySelector(".tabs-scroller");
const TAB_COUNT = 4;
// Latest scrub progress (0→1 across the pin); read by the parallax loop so the
// pinned tab images can drift even though the sticky section's rect is frozen.
let tabScrub = 0;
function updateTabsScrub() {
  if (!tabsSection || !tabsScroller || !mobileMQ.matches) return;
  const pinDuration = tabsScroller.offsetHeight - window.innerHeight;
  if (pinDuration <= 0) return;
  const scrolled = clamp01(
    -tabsScroller.getBoundingClientRect().top / pinDuration
  );
  tabScrub = scrolled;
  tabsSection.style.setProperty("--tab-progress", scrolled.toFixed(4));
  const idx = Math.min(TAB_COUNT - 1, Math.floor(scrolled * TAB_COUNT));
  if (tabsSection.dataset.active !== String(idx)) {
    tabsSection.dataset.active = String(idx);
  }
}

// Per-collection parallax for a pinned tab image: each image drifts from
// −amount → +amount across its own segment, so at a crossfade the outgoing
// image is leaving (+) while the incoming arrives (−) — a smooth parallax cross.
function tabParallaxOffset(index, amount) {
  const local = clamp01(tabScrub * TAB_COUNT - index);
  return (local - 0.5) * 2 * amount;
}

// ---- Shop mega-menu (desktop) -------------------------------------------
// Clicking "Shop" toggles a panel that pushes the page down (CSS height anim).
// While open the nav is forced to its solid state (menuOpen → navT = 1).
let menuOpen = false;
const shopTrigger = document.querySelector(".nav-link--shop");
const megamenu = document.getElementById("shop-menu");

function setMenu(open) {
  if (!megamenu || !shopTrigger) return;
  menuOpen = open;
  megamenu.classList.toggle("is-open", open);
  shopTrigger.setAttribute("aria-expanded", String(open));
}

if (shopTrigger && megamenu) {
  shopTrigger.addEventListener("click", (e) => {
    e.preventDefault();
    setMenu(!menuOpen);
  });
  // Close on outside click, Escape, or as soon as the page is scrolled.
  document.addEventListener("click", (e) => {
    if (menuOpen && !megamenu.contains(e.target) && !shopTrigger.contains(e.target)) {
      setMenu(false);
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && menuOpen) setMenu(false);
  });
  window.addEventListener("wheel", () => menuOpen && setMenu(false), { passive: true });
  window.addEventListener("touchmove", () => menuOpen && setMenu(false), { passive: true });
}

// ---- UGC carousel -------------------------------------------------------
// Infinite auto-scrolling marquee of community shots. The CSS animates
// .ugc__track leftward by --ugc-shift (one copy's exact width) and wraps; here
// we clone enough WHOLE card-sets that there's always ≥ a viewport of cards past
// the wrap point, so the loop is seamless no matter the card count or width.
// Speed is constant (data-speed = px/sec). Pausing on hover is pure CSS; JS
// handles per-card video playback + mute.
function initUgc() {
  const ugc = document.querySelector(".ugc");
  const track = ugc && ugc.querySelector(".ugc__track");
  if (!track) return;

  const originals = Array.from(track.children);
  if (!originals.length) return;
  originals.forEach((n) => (n.dataset.ugcOriginal = "1"));

  const speed = Number(ugc.dataset.speed) || 40; // px per second
  const gapOf = () => {
    const s = getComputedStyle(track);
    return parseFloat(s.columnGap || s.gap) || 0;
  };

  // (Re)build the loop: strip old clones, measure one copy, clone whole sets
  // until the track covers viewport + one copy, then publish shift + duration.
  const build = () => {
    Array.from(track.children).forEach((c) => {
      if (!c.dataset.ugcOriginal) track.removeChild(c);
    });

    // One copy's advance = span of the original set + the gap bridging to the
    // next copy → the exact distance that lands clone-N where original-N began.
    const first = originals[0];
    const last = originals[originals.length - 1];
    const copyW = last.offsetLeft + last.offsetWidth - first.offsetLeft + gapOf();
    if (copyW <= 0) return;

    const target = window.innerWidth + copyW;
    let guard = 0;
    while (track.scrollWidth < target && guard < 20) {
      originals.forEach((node) => {
        const clone = node.cloneNode(true);
        delete clone.dataset.ugcOriginal;
        clone.setAttribute("aria-hidden", "true");
        clone.querySelectorAll("a, button").forEach((el) => (el.tabIndex = -1));
        track.appendChild(clone);
      });
      guard++;
    }

    ugc.style.setProperty("--ugc-shift", copyW.toFixed(2) + "px");
    ugc.style.setProperty("--ugc-duration", (copyW / speed).toFixed(2) + "s");

    wireVideos();
  };

  // Video cards (originals + clones): play on hover, reset on leave, mute toggle.
  // Guarded so rebuilds don't double-bind the originals.
  const wireVideos = () => {
    track.querySelectorAll('.ugc-card[data-media="video"]').forEach((card) => {
      if (card.dataset.ugcWired) return;
      card.dataset.ugcWired = "1";

      const video = card.querySelector(".ugc-card__video");
      if (!video) return;

      card.addEventListener("mouseenter", () => {
        const p = video.play();
        if (p && p.catch) p.catch(() => {}); // ignore autoplay/missing-source rejections
      });
      card.addEventListener("mouseleave", () => video.pause());

      const btn = card.querySelector(".ugc-card__mute");
      if (btn) {
        const sync = () => {
          btn.textContent = video.muted ? "Unmute" : "Mute";
          btn.setAttribute("aria-label", video.muted ? "Unmute video" : "Mute video");
          btn.setAttribute("aria-pressed", String(!video.muted));
        };
        sync(); // videos start muted so hover-playback is allowed → shows "Unmute"
        btn.addEventListener("click", (e) => {
          // Don't follow the card's product link when toggling sound.
          e.preventDefault();
          e.stopPropagation();
          video.muted = !video.muted;
          sync();
        });
      }
    });
  };

  build();

  // Card width is vw-based on mobile → re-measure & re-clone on resize (debounced).
  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(build, 200);
  });
}
initUgc();

// ---- Press slider -------------------------------------------------------
// Auto-advancing pull-quotes tied to the press logos. Each quote's words reveal
// L→R (the loading-intro treatment); the active logo drives the quote. It
// advances on its own; hovering a logo selects that quote and pauses the
// auto-advance (which resumes when the pointer leaves the logos).
function initPress() {
  const press = document.querySelector(".press");
  if (!press) return;
  const quotes = Array.from(press.querySelectorAll(".press__quote"));
  const logos = Array.from(press.querySelectorAll(".press__logo"));
  if (!quotes.length || !logos.length) return;

  // Start from a clean slate, then split each quote into per-word spans so they
  // can stagger in. (Remove is-active first so the split words start hidden.)
  quotes.forEach((q) => q.classList.remove("is-active"));
  logos.forEach((l) => l.classList.remove("is-active"));
  quotes.forEach((q) => {
    const words = q.textContent.trim().split(/\s+/);
    q.textContent = "";
    // Words live in an inner block: the quote itself is a flex box (to center),
    // and flex would drop the whitespace text nodes between the word spans — the
    // inner block keeps them in a normal text flow so the spaces render.
    const inner = document.createElement("span");
    inner.className = "press__quote-inner";
    words.forEach((w, i) => {
      const span = document.createElement("span");
      span.className = "press__word";
      span.style.setProperty("--i", i);
      span.textContent = w;
      inner.appendChild(span);
      if (i < words.length - 1) inner.appendChild(document.createTextNode(" "));
    });
    q.appendChild(inner);
  });

  let index = 0;
  const activate = (next) => {
    const target = ((next % quotes.length) + quotes.length) % quotes.length;
    quotes.forEach((q, i) => q.classList.toggle("is-active", i === target));
    logos.forEach((l, i) => {
      l.classList.toggle("is-active", i === target);
      l.setAttribute("aria-pressed", String(i === target));
    });
    index = target;
  };

  const INTERVAL = 4500;
  let timer = null;
  const start = () => {
    if (!prefersReducedMotion && timer == null) {
      timer = window.setInterval(() => activate(index + 1), INTERVAL);
    }
  };
  const stop = () => {
    if (timer != null) {
      window.clearInterval(timer);
      timer = null;
    }
  };

  // Hover / focus a logo → select its quote and pause; resume when leaving.
  logos.forEach((logo, i) => {
    logo.addEventListener("mouseenter", () => { stop(); activate(i); });
    logo.addEventListener("focus", () => { stop(); activate(i); });
    logo.addEventListener("click", (e) => { e.preventDefault(); activate(i); });
  });
  const logosWrap = press.querySelector(".press__logos");
  if (logosWrap) logosWrap.addEventListener("mouseleave", start);

  // Show the first quote, then begin auto-advancing (reduced motion → static).
  activate(0);
  start();
}
initPress();

// ---- Loading intro ------------------------------------------------------
// Choreographs the phases set up in styles.css. Scroll is locked for the
// duration so the reveal plays from the top, then handed back to Lenis.
const INTRO_PHASES = ["intro", "phase-copy", "phase-reveal", "intro-done"];

function clearIntro() {
  INTRO_PHASES.forEach((c) => root.classList.remove(c));
}

function runIntro(lenis) {
  // If the inline head script never tagged <html> (e.g. JS disabled mid-load),
  // there's nothing to play.
  if (!root.classList.contains("intro")) return;

  if (lenis) lenis.stop(); // lock scroll during the intro
  window.scrollTo(0, 0);

  const at = (ms, fn) => window.setTimeout(fn, ms);

  at(200, () => root.classList.add("phase-copy")); //   copy reveals word-by-word L→R, slower (lands ~2.05s)
  at(2200, () => root.classList.add("phase-reveal")); // background masks out ↑ right as the copy settles (1.5s, top ~3700)
  at(3150, () => root.classList.add("intro-done")); //  nav fades in (staggered) ~0.55s before the reveal reaches it
  at(4700, () => {
    clearIntro(); // back to the plain page
    if (lenis) lenis.start();
  });
}

// Reduced motion: no Lenis, no damping — track scroll directly so the header
// still collapses, just without easing or parallax drift. The intro is skipped.
if (prefersReducedMotion) {
  clearIntro();
  const apply = () => {
    setNav(menuOpen ? 1 : navProgressTarget());
    updateTabsScrub();
  };
  window.addEventListener("scroll", apply, { passive: true });
  apply();
} else {
  // lerp mode gives a slightly heavier, momentum-style glide vs. duration mode;
  // syncTouch carries the same eased feel to touch devices.
  const lenis = new Lenis({
    lerp: 0.09,
    smoothWheel: true,
    syncTouch: true,
  });

  // Register every parallax image: { host (tracked vs viewport), target (moved),
  // stretch (hero only) }. The hero combines parallax + velocity stretch.
  const parallax = [];
  const addParallax = (host, target, stretch) => {
    if (host && target) parallax.push({ host, target, stretch, cur: 0 });
  };
  addParallax(heroFrame, heroImg, true);
  document
    .querySelectorAll(".feature-col")
    .forEach((col) => addParallax(col, col.querySelector(".feature-col__media"), false));

  // Collection tabs: each stacked image carries its own collection index so the
  // pinned scrub can drift them per-segment (desktop falls back to host-based).
  document
    .querySelectorAll(".tab-img")
    .forEach((img, i) =>
      parallax.push({ host: tabsSection, target: img, stretch: false, cur: 0, tabIndex: i })
    );

  // Promo banner image (parallax on the full-bleed image).
  const promo = document.querySelector(".promo");
  addParallax(promo, promo && promo.querySelector(".promo__img"), false);

  let navCur = navProgressTarget();
  let stretchCur = 1;

  const frame = (time) => {
    lenis.raf(time);

    // Nav goes solid on scroll-in or while the shop menu is open. With no padding
    // collapse, this only crossfades the colours — the bar never resizes.
    const navT = menuOpen ? 1 : navProgressTarget();
    navCur = lerp(navCur, navT, DAMPING);
    if (Math.abs(navT - navCur) < 0.0004) navCur = navT;
    setNav(navCur);

    // Lenis scroll velocity → the hero's vertical stretch (eases back to 1).
    const v = lenis.velocity || 0;
    const stretchT = 1 + Math.min(Math.abs(v) * VEL_K, VEL_MAX);
    stretchCur = lerp(stretchCur, stretchT, STRETCH_DAMPING);

    // Scrub first so the pinned tab images read a fresh progress this frame.
    updateTabsScrub();

    const amount = parallaxAmount();
    for (const p of parallax) {
      // Pinned tab images drift from the scrub (their host rect is frozen while
      // sticky); everything else uses the viewport pass-through.
      const t =
        p.tabIndex != null && mobileMQ.matches
          ? tabParallaxOffset(p.tabIndex, TAB_PARALLAX)
          : parallaxOffset(p.host, amount);
      p.cur = lerp(p.cur, t, DAMPING);
      p.target.style.transform = p.stretch
        ? `translate3d(0, ${p.cur.toFixed(2)}px, 0) scaleY(${stretchCur.toFixed(4)})`
        : `translate3d(0, ${p.cur.toFixed(2)}px, 0)`;
    }

    requestAnimationFrame(frame);
  };

  setNav(navCur);
  requestAnimationFrame(frame);
  runIntro(lenis);
}
