// About page — smooth scroll + damped collage parallax.
// Same engine as the homepage (Lenis drives the real scroll, one rAF loop
// damps every value toward its target), applied to this page's two moving
// parts:
//   · every .plx collage image drifts vertically by its own data-plx amount
//     (± px, sign = direction) across its pass through the viewport —
//     mirroring the ±80/±120/±160 GSAP scroll-scrub on the live our-story page
//   · the full-bleed bands translate the oversized image inside a clipped
//     frame (the frame is the host, the image the target)
// The nav is locked solid in CSS (.header--about); we only toggle the
// hairline once the page scrolls.
import Lenis from "./assets/vendor/lenis.mjs";

const clamp01 = (n) => Math.min(1, Math.max(0, n));
const lerp = (a, b, t) => a + (b - a) * t;
// Remap a value from [inMin, inMax] into a clamped 0–1 (Nuwa's useScrollScrub).
const remap = (v, inMin, inMax) => clamp01((v - inMin) / (inMax - inMin));
// Ease-in-out cubic: slow start, fast middle, gentle settle.
const easeInOut = (t) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
// Smoothstep: same shape but half the peak velocity (mid-slope 1.5× vs the
// cubic's 3×) — scrubbed motion reads silky instead of sprinting mid-phase.
const smoothstep = (t) => t * t * (3 - 2 * t);

const prefersReducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)"
).matches;
// ?static[=y] — native scroll, no Lenis, no parallax, optionally starting
// scrolled to y px. Headless/preview environments pause rAF and only render
// the first paint, so layout is verified section-by-section with this flag.
const staticParam = new URLSearchParams(location.search).get("static");
const staticMode = staticParam != null;
if (staticMode && Number(staticParam) > 0) {
  window.scrollTo(0, Number(staticParam));
}

// Shared per-frame damping ("the weight") — same value as the homepage.
const DAMPING = 0.08;
// Travel of the image inside each full-bleed frame (the CSS gives
// .about-bleed__img ±80px of slack, so ≤80 always keeps the frame covered).
const BLEED = 40;
// Scrub phase boundaries within the pin's 0–1 progress (Nuwa's Statement):
// rise — the image floats up from its collage spot to the text block —
// then the expand to full screen, then a Ken Burns hold until release.
// The expand starts BEFORE the rise finishes: without the overlap the image
// decelerates to a dead stop at the landing and slowly restarts, a visible
// stall; overlapped, the growth picks up exactly as the travel settles and
// the whole thing reads as one continuous gesture.
// Windows are sized so the image always travels SLOWER than the scroll
// itself (rise ≈ 600px of movement over ≈ 830px of scroll at the 800
// reference) — matching the weighted, lagging feel of the page's parallax,
// where everything moves less than the finger.
const SCRUB_RISE_END = 0.4;
const SCRUB_EXPAND_START = 0.32;
// Expand finishes close to release (0.95, not 0.85) so the image barely holds
// full-screen before it starts scrolling away — the old longer hold made it
// stop dead, then jump to scroll speed on release, which read as stiff.
const SCRUB_EXPAND_END = 0.95;
// Lighter collage drift on mobile.
const mobileMQ = window.matchMedia("(max-width: 768px)");
const plxScale = () => (mobileMQ.matches ? 0.5 : 1);

// Homepage parallax math: ±amount over the host's pass through the viewport —
// 0 when its top meets the bottom of the viewport, 1 when its bottom exits.
// `applied` is the translate already on the host (collage images move
// themselves, so their rect must be corrected back to the resting position).
function parallaxOffset(host, amount, applied) {
  const rect = host.getBoundingClientRect();
  const vh = window.innerHeight;
  const progress = clamp01((vh - (rect.top - applied)) / (vh + rect.height));
  return (progress - 0.5) * 2 * amount;
}

// ---- Nav hairline ----
const header = document.querySelector(".header--about");
function syncScrolled() {
  header?.classList.toggle("is-scrolled", window.scrollY > 4);
}
window.addEventListener("scroll", syncScrolled, { passive: true });
syncScrolled();

// ---- Background videos ----
// Play the scrub's background clip only while it's near the viewport, so an
// off-screen 1080p loop doesn't decode for nothing (same pattern as the
// homepage UGC cards). preload="none" + poster means nothing downloads until
// it's close. Skipped under reduced motion — the poster still stands in.
if (!prefersReducedMotion && "IntersectionObserver" in window) {
  const videos = document.querySelectorAll("video.about-scrub__img");
  if (videos.length) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            const p = e.target.play();
            if (p && p.catch) p.catch(() => {}); // ignore autoplay rejections
          } else {
            e.target.pause();
          }
        });
      },
      // Start ~half a viewport early so it's already playing by the pin.
      { rootMargin: "50% 0px" }
    );
    videos.forEach((v) => io.observe(v));
  }
}

if (!prefersReducedMotion && !staticMode) {
  const lenis = new Lenis({
    lerp: 0.09,
    smoothWheel: true,
    syncTouch: true,
  });

  // Register the movers: collage images drift themselves (host === target,
  // amount from data-plx); bleed frames move the image within the clip.
  const parallax = [];
  document.querySelectorAll(".plx").forEach((el) => {
    const amount = Number(el.dataset.plx) || 0;
    if (amount) parallax.push({ host: el, target: el, amount, cur: 0 });
  });
  document.querySelectorAll(".about-bleed__frame").forEach((frame) => {
    const img = frame.querySelector(".about-bleed__img");
    if (img) parallax.push({ host: frame, target: img, amount: BLEED, cur: 0 });
  });

  // Pinned expand scrub — tag the track so the CSS drops its static fallback,
  // and damp the pin progress into the stage's --p2/--p3 each frame.
  const scrubTrack = document.querySelector(".about-scrub");
  const scrubStage = document.querySelector(".about-scrub__stage");
  // The Studio collage's side photos fade out as the scrub image rises.
  const scrubFaders = document.querySelectorAll(
    ".about-img--s2a, .about-img--s2b"
  );
  let scrubCur = 0;
  const scrubTarget = () => {
    const rect = scrubTrack.getBoundingClientRect();
    const distance = rect.height - window.innerHeight;
    return distance > 0 ? clamp01(-rect.top / distance) : 0;
  };
  if (scrubTrack && scrubStage) {
    scrubTrack.classList.add("is-scrubbed");
    scrubCur = scrubTarget(); // start settled (no load-time animation)
  }

  const frame = (time) => {
    lenis.raf(time);

    if (scrubTrack && scrubStage) {
      const t = scrubTarget();
      scrubCur = lerp(scrubCur, t, DAMPING);
      if (Math.abs(t - scrubCur) < 0.0004) scrubCur = t;
      const p1 = easeInOut(remap(scrubCur, 0, SCRUB_RISE_END));
      scrubStage.style.setProperty("--p", scrubCur.toFixed(4));
      scrubStage.style.setProperty("--p1", p1.toFixed(4));
      const p2 = smoothstep(remap(scrubCur, SCRUB_EXPAND_START, SCRUB_EXPAND_END));
      scrubStage.style.setProperty("--p2", p2.toFixed(4));
      // McAlpine-style expand: the frame grows to full screen via transform
      // scale (GPU-composited — no per-frame layout). Its resting size is
      // 360×203 at 1440 and scales with the page (--w), so the scale factors
      // divide the viewport by that same scaled base to still hit full screen.
      const scrubW = Math.max(1440, window.innerWidth);
      const baseW = scrubW * 0.25; // 360 at 1440
      const baseH = scrubW * 0.140972; // 203 at 1440
      scrubStage.style.setProperty(
        "--sx",
        (1 + (window.innerWidth / baseW - 1) * p2).toFixed(4)
      );
      scrubStage.style.setProperty(
        "--sy",
        (1 + (window.innerHeight / baseH - 1) * p2).toFixed(4)
      );
      scrubStage.style.setProperty(
        "--p3",
        remap(scrubCur, SCRUB_RISE_END, 1).toFixed(4)
      );
      // Exit parallax (McAlpine-style): once the pin releases and the
      // full-screen stage scrolls away, the inner video lags behind the frame
      // rather than scrolling with it 1:1 — a gentle drift that also softens
      // the hand-off out of the pin, since the image eases into motion instead
      // of jumping to scroll speed. --pe is 0 while pinned (stage top === 0),
      // ramping 0→1 as the stage scrolls up out of view. Read straight from
      // the (Lenis-eased) stage position, so it tracks scroll without a second
      // damping pass — parallax should follow the scroll, not lag it further.
      const stageTop = scrubStage.getBoundingClientRect().top;
      scrubStage.style.setProperty(
        "--pe",
        clamp01(-stageTop / window.innerHeight).toFixed(4)
      );
      // Side photos fade in step with the rise.
      scrubFaders.forEach((el) => (el.style.opacity = (1 - p1).toFixed(3)));
    }

    const scale = plxScale();
    for (const p of parallax) {
      const t = parallaxOffset(p.host, p.amount * scale, p.host === p.target ? p.cur : 0);
      p.cur = lerp(p.cur, t, DAMPING);
      p.target.style.transform = `translate3d(0, ${p.cur.toFixed(2)}px, 0)`;
    }

    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
