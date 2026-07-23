// Product page — Lenis smooth scroll + hero infinite carousel + card controls.
// Mirrors the homepage's approach: Lenis drives the real scroll position and a
// single rAF loop runs alongside it; the hero marquee is the same clone-and-
// translate technique as the homepage UGC carousel, sized in JS and animated in
// CSS so the loop stays seamless at any viewport width.
import Lenis from "./assets/vendor/lenis.mjs";

const prefersReducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)"
).matches;

const mobileMQ = window.matchMedia("(max-width: 768px)");

// ---- Hero infinite carousel --------------------------------------------
// A JS-driven marquee: a single rAF loop translates the track leftward at a
// slow constant drift, wrapping every copy-width so the loop is seamless. The
// user can grab it (mouse or touch) to drag it left/right; releasing a flick
// leaves momentum that decays back into the baseline drift. Clones are whole
// slide-sets so any wrap position stays fully covered.
const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

function initHeroCarousel() {
  const carousel = document.querySelector(".hero__carousel");
  const track = carousel && carousel.querySelector(".hero__track");
  if (!track) return;

  const originals = Array.from(track.children);
  if (!originals.length) return;
  originals.forEach((n) => (n.dataset.heroOriginal = "1"));

  // Baseline drift (px/sec). Slow = smoother; data-speed tunes it.
  const AUTO = prefersReducedMotion ? 0 : Number(carousel.dataset.speed) || 20;
  const FRICTION = 0.92; // momentum decay per 1/60s frame
  const MAX_VEL = 3600; // cap flick velocity (px/sec)

  const gapOf = () => {
    const s = getComputedStyle(track);
    return parseFloat(s.columnGap || s.gap) || 0;
  };

  let copyW = 0; // one copy's advance (span + bridging gap)
  let pos = 0; // current offset; transform is translateX(-pos), wrapped by copyW
  let vel = 0; // momentum velocity from dragging (px/sec), decays to 0

  // Mobile: no marquee — a swipeable scroll-snap slider with position dots.
  const dots = document.querySelector(".hero__dots");
  const buildDots = () => {
    if (!dots) return;
    dots.innerHTML = originals
      .map((_, i) => `<span class="hero__dot${i === 0 ? " is-active" : ""}"></span>`)
      .join("");
  };
  carousel.addEventListener(
    "scroll",
    () => {
      if (!mobileMQ.matches || !dots || !carousel.clientWidth) return;
      const i = Math.min(
        originals.length - 1,
        Math.round(carousel.scrollLeft / carousel.clientWidth)
      );
      Array.from(dots.children).forEach((d, j) =>
        d.classList.toggle("is-active", j === i)
      );
    },
    { passive: true }
  );

  const build = () => {
    // Reset to just the originals, then re-measure.
    Array.from(track.children).forEach((c) => {
      if (!c.dataset.heroOriginal) track.removeChild(c);
    });

    // Mobile: native scroll-snap does the work — no clones, no transform.
    if (mobileMQ.matches) {
      copyW = 0;
      track.style.transform = "";
      buildDots();
      return;
    }

    const first = originals[0];
    const last = originals[originals.length - 1];
    copyW = last.offsetLeft + last.offsetWidth - first.offsetLeft + gapOf();
    if (copyW <= 0) return;

    // Clone whole sets until the track covers a viewport + one full copy.
    const target = window.innerWidth + copyW;
    let guard = 0;
    while (track.scrollWidth < target && guard < 20) {
      originals.forEach((node) => {
        const clone = node.cloneNode(true);
        delete clone.dataset.heroOriginal;
        clone.setAttribute("aria-hidden", "true");
        clone.querySelectorAll("a, button").forEach((el) => (el.tabIndex = -1));
        track.appendChild(clone);
      });
      guard++;
    }
  };

  // ---- Drag (pointer = mouse + touch) ----
  let dragging = false;
  let lastX = 0;
  let lastMoveT = 0;
  let movedDist = 0; // total travel this gesture → distinguishes drag from click

  const onDown = (e) => {
    if (mobileMQ.matches) return; // native scroll owns the gesture on mobile
    dragging = true;
    carousel.classList.add("is-dragging");
    lastX = e.clientX;
    lastMoveT = performance.now();
    movedDist = 0;
    vel = 0; // grabbing cancels any momentum
    if (carousel.setPointerCapture) {
      try { carousel.setPointerCapture(e.pointerId); } catch (_) {}
    }
  };
  const onMove = (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX;
    lastX = e.clientX;
    movedDist += Math.abs(dx);
    pos -= dx; // drag right → content follows right
    // Track instantaneous velocity so a release carries momentum.
    const now = performance.now();
    const dt = Math.max(8, now - lastMoveT) / 1000;
    lastMoveT = now;
    vel = clamp(-dx / dt, -MAX_VEL, MAX_VEL);
  };
  const onUp = () => {
    if (!dragging) return;
    dragging = false;
    carousel.classList.remove("is-dragging");
  };

  carousel.addEventListener("pointerdown", onDown);
  window.addEventListener("pointermove", onMove, { passive: true });
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onUp);
  // Suppress the click that follows a real drag (so links don't fire on flick).
  track.addEventListener(
    "click",
    (e) => {
      if (movedDist > 6) { e.preventDefault(); e.stopPropagation(); }
    },
    true
  );
  // Kill the native image ghost-drag.
  track.addEventListener("dragstart", (e) => e.preventDefault());

  // ---- Animation loop ----
  let lastT = performance.now();
  const frame = (now) => {
    const dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;
    if (mobileMQ.matches) {
      // Scroll-snap slider mode — the marquee loop idles.
      requestAnimationFrame(frame);
      return;
    }
    if (!dragging) {
      pos += (AUTO + vel) * dt; // baseline drift + decaying momentum
      vel *= Math.pow(FRICTION, dt * 60);
      if (Math.abs(vel) < 0.5) vel = 0;
    }
    if (copyW > 0) pos = ((pos % copyW) + copyW) % copyW;
    track.style.transform = `translate3d(${(-pos).toFixed(2)}px, 0, 0)`;
    requestAnimationFrame(frame);
  };

  build();
  requestAnimationFrame(frame);

  // Images load after first layout → re-measure; ditto on resize.
  track.querySelectorAll("img").forEach((img) => {
    if (!img.complete) img.addEventListener("load", build, { once: true });
  });
  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(build, 200);
  });
}
initHeroCarousel();

// ---- Product card: swatch + size single-select -------------------------
// Within each group, clicking sets the active option (a simple radio-style
// toggle). The <details> accordion handles itself natively.
function initCardControls() {
  const singleSelect = (container, itemSelector) => {
    if (!container) return;
    const items = Array.from(container.querySelectorAll(itemSelector));
    items.forEach((item) => {
      item.addEventListener("click", (e) => {
        e.preventDefault();
        items.forEach((i) => i.classList.toggle("is-active", i === item));
      });
    });
  };

  singleSelect(document.querySelector(".pc__swatches"), ".pc__swatch");
  document
    .querySelectorAll(".pc__sizes")
    .forEach((group) => singleSelect(group, ".pc__size"));
}
initCardControls();

// ---- Add to cart ---------------------------------------------------------
// No size is pre-selected, so the CTA validates: missing sizes → the button
// relabels ("Select a size") and the incomplete size rows nudge; complete →
// the nav's Cart count ticks up and the button confirms ("Added to cart").
// Both states revert on their own; picking a size clears that row's error.
function initAddToCart() {
  const btn = document.querySelector(".pc__cart");
  if (!btn) return;
  const label = btn.querySelector("span:first-child");
  const originalLabel = label.textContent;
  const cartLink = document.querySelector(".nav-link--end");
  const lines = Array.from(document.querySelectorAll(".pc__line"));
  let cartCount = 0;
  let revertTimer;

  const reset = () => {
    btn.classList.remove("is-error", "is-added");
    label.textContent = originalLabel;
    lines.forEach((l) => l.querySelector(".pc__sizes").classList.remove("is-error"));
  };

  btn.addEventListener("click", () => {
    window.clearTimeout(revertTimer);
    const missing = lines.filter((l) => !l.querySelector(".pc__size.is-active"));
    if (missing.length) {
      missing.forEach((l) => {
        const group = l.querySelector(".pc__sizes");
        group.classList.remove("is-error");
        void group.offsetWidth; // restart the nudge on repeat clicks
        group.classList.add("is-error");
      });
      btn.classList.remove("is-error");
      void btn.offsetWidth;
      btn.classList.add("is-error");
      // Mobile shows a "Please select a size" bar above the sticky CTA
      // instead (CSS ::before), so the label stays put there.
      if (!mobileMQ.matches) {
        label.textContent = missing.length === lines.length ? "Select your sizes" : "Select a size";
      }
      // If the flagged size pickers are off-screen (e.g. the sticky CTA was
      // tapped deep down the page), glide back so the user can see what the
      // warning is pointing at.
      const first = missing[0];
      const r = first.getBoundingClientRect();
      const offScreen = r.top < 52 || r.bottom > window.innerHeight - 90;
      if (offScreen) {
        // Centre the missing line in the viewport
        const dest = Math.max(
          0,
          r.top + window.scrollY - (window.innerHeight - r.height) / 2
        );
        if (window.__lenis) window.__lenis.scrollTo(dest, { duration: 1 });
        else window.scrollTo({ top: dest, behavior: prefersReducedMotion ? "auto" : "smooth" });
      }
      revertTimer = window.setTimeout(reset, 2000);
    } else {
      cartCount++;
      if (cartLink) cartLink.textContent = `Cart (${cartCount})`;
      btn.classList.add("is-added");
      label.textContent = "Added to cart";
      revertTimer = window.setTimeout(reset, 1600);
    }
  });

  // Choosing a size resolves that row's error; when the last one resolves,
  // restore the button label right away instead of waiting out the timer.
  document.querySelectorAll(".pc__sizes .pc__size").forEach((b) =>
    b.addEventListener("click", () => {
      b.closest(".pc__sizes").classList.remove("is-error");
      if (
        btn.classList.contains("is-error") &&
        lines.every((l) => l.querySelector(".pc__size.is-active"))
      ) {
        window.clearTimeout(revertTimer);
        reset();
      }
    })
  );
}
initAddToCart();

// ---- Hero card accordion -------------------------------------------------
// JS-orchestrated enter/leave so BOTH directions animate (a native <details>
// snaps shut the instant [open] is removed, and the `name` grouping would
// snap the outgoing panel too). All motion is compositor-only transform +
// opacity, defined in styles.css; this just sequences the classes:
//   open:  [open] + .is-enter (parked low, invisible) → next frame, drop
//          .is-enter → panel rises, body trailing 60ms behind.
//   close: .is-leaving → eases back down → [open] removed after it lands.
function initCardAccordion() {
  const acc = document.querySelector(".pc__accordion");
  if (!acc) return;
  const items = Array.from(acc.querySelectorAll(".pc__acc-item"));
  const COVERED_MS = 310; // quick fade when an incoming panel covers the leaver
  const RETURN_MS = 520; // title travel (0.4s) + row fade-in (0.2s + 0.3s)

  // Closed-state geometry, captured while everything is shut: where each
  // item's title sits (the travel target) and each item's flow height (how
  // far rows below its slot must pre-shift while it's out of the flow).
  const accTop = acc.getBoundingClientRect().top;
  const closedTitleTop = items.map(
    (i) => i.querySelector("summary").getBoundingClientRect().top - accTop
  );
  const flowHeight = items.map((i) => i.getBoundingClientRect().height);

  // Every [open] item is absolute (out of the flow), so the in-flow rows sit
  // too high by the sum of the absent items' heights above them. Pin each row
  // back to its visual closed position so nothing beneath ever jumps — during
  // the enter fade, the close fade-in (which relies on it), and the switch
  // overlap where TWO items are briefly absent at once.
  const applyShifts = () => {
    items.forEach((row, j) => {
      if (row.open) return; // panels animate via class transforms, not inline
      let shift = 0;
      for (let k = 0; k < j; k++) if (items[k].open) shift += flowHeight[k];
      row.style.transform = shift ? `translateY(${shift.toFixed(1)}px)` : "";
    });
  };

  const cleanupClose = (item) => {
    item.open = false;
    item.classList.remove("is-leaving", "is-returning", "is-enter");
    item.style.removeProperty("--acc-return");
    item.style.transform = ""; // it may have been shifted while closed rows moved
    acc.classList.remove("is-restoring", "is-showing");
    applyShifts(); // recompute for whatever is still open (or clear all)
  };

  // covered=true → the panel is being replaced by an incoming one, so it just
  // fades down behind it. Otherwise: the title glides back to its own row and
  // the other rows fade in around it (pre-shifted to their post-swap spots so
  // the final frame is pixel-identical to the real closed layout).
  const closeItem = (item, covered) => {
    if (!item.open || item._accClosing) return;
    item._accClosing = true;
    if (covered) {
      item.classList.add("is-leaving");
      item._accTimer = window.setTimeout(() => {
        cleanupClose(item);
        item._accClosing = false;
      }, COVERED_MS);
      return;
    }
    const idx = items.indexOf(item);
    item.style.setProperty("--acc-return", closedTitleTop[idx].toFixed(1) + "px");
    item.classList.add("is-returning");
    acc.classList.add("is-restoring"); // rows: hidden, no transition
    applyShifts(); // (already in place since the open — idempotent)
    // Next frame: fade the rows in (CSS delay lets the title clear their path)
    item._accShowTimer = window.setTimeout(() => acc.classList.add("is-showing"), 30);
    item._accTimer = window.setTimeout(() => {
      cleanupClose(item); // one frame: title is home, rows are where flow puts them
      item._accClosing = false;
    }, RETURN_MS);
  };

  const openItem = (item) => {
    items.forEach((i) => i !== item && closeItem(i, true));
    if (item._accClosing) {
      // Re-opening mid-close: cancel the in-flight close entirely.
      window.clearTimeout(item._accTimer);
      window.clearTimeout(item._accShowTimer);
      const reopen = item.open; // cleanup clears [open]; we re-set it below
      cleanupClose(item);
      item._accClosing = false;
      if (reopen) item.open = true;
    }
    window.clearTimeout(item._accEnterTimer);
    item.classList.add("is-enter");
    item.open = true;
    // Pin the rows beneath to their visual closed positions the moment the
    // item leaves the flow — otherwise they jump up through the fading panel.
    applyShifts();
    // Double rAF: let the parked start state paint before releasing it,
    // otherwise the browser coalesces the frames and nothing transitions.
    const release = () => item.classList.remove("is-enter");
    requestAnimationFrame(() => requestAnimationFrame(release));
    // Fallback: rAF is suspended in hidden/throttled tabs — never leave the
    // panel parked invisible.
    item._accEnterTimer = window.setTimeout(release, 120);
  };

  items.forEach((item) => {
    item.querySelector("summary").addEventListener("click", (e) => {
      // Mobile: a standard in-place accordion — native toggle, eased by the
      // ::details-content transition in CSS. The overlay choreography (and
      // its desktop-measured geometry) stays out of the way entirely.
      if (mobileMQ.matches) return;
      e.preventDefault(); // we own the [open] attribute
      if (prefersReducedMotion) {
        items.forEach((i) => (i.open = i === item ? !item.open : false));
        return;
      }
      if (item.open && !item._accClosing) closeItem(item, false);
      else openItem(item);
    });
  });
}
initCardAccordion();

// ---- UGC carousel (ported from the homepage) ---------------------------
// Auto-scrolling marquee: clone whole card-sets until the track covers a
// viewport + one copy, then publish --ugc-shift (one copy's width) and
// --ugc-duration (shift / speed); the CSS keyframe translates and wraps.
// Videos play on hover with a mute toggle. Pausing on hover is pure CSS.
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

  const build = () => {
    Array.from(track.children).forEach((c) => {
      if (!c.dataset.ugcOriginal) track.removeChild(c);
    });

    if (mobileMQ.matches) {
      ugc.style.removeProperty("--ugc-shift");
      ugc.style.removeProperty("--ugc-duration");
      wireVideos();
      return;
    }

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

  // Video cards: play on hover, reset on leave, mute toggle. Guarded so
  // rebuilds don't double-bind the originals.
  const wireVideos = () => {
    track.querySelectorAll('.ugc-card[data-media="video"]').forEach((card) => {
      if (card.dataset.ugcWired) return;
      card.dataset.ugcWired = "1";
      const video = card.querySelector(".ugc-card__video");
      if (!video) return;

      card.addEventListener("mouseenter", () => {
        const p = video.play();
        if (p && p.catch) p.catch(() => {});
      });
      card.addEventListener("mouseleave", () => video.pause());

      const btn = card.querySelector(".ugc-card__mute");
      if (btn) {
        const sync = () => {
          btn.textContent = video.muted ? "Unmute" : "Mute";
          btn.setAttribute("aria-label", video.muted ? "Unmute video" : "Mute video");
          btn.setAttribute("aria-pressed", String(!video.muted));
        };
        sync();
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          video.muted = !video.muted;
          sync();
        });
      }
    });
  };

  build();

  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(build, 200);
  });
}
initUgc();

// ---- Trust bar ticker (mobile) ------------------------------------------
// Desktop: three static, evenly-spread highlights. Mobile: the track clones
// itself and scrolls as a seamless marquee (same shift-by-one-copy technique
// as the UGC carousel).
function initTicker() {
  const bar = document.querySelector(".trustbar");
  const trackEl = bar && bar.querySelector(".trustbar__track");
  if (!trackEl) return;
  const SPEED = 40; // px per second

  const build = () => {
    Array.from(bar.querySelectorAll(".trustbar__track"))
      .slice(1)
      .forEach((n) => n.remove());
    bar.style.removeProperty("--ticker-shift");
    bar.style.removeProperty("--ticker-duration");
    if (!mobileMQ.matches || prefersReducedMotion) return;

    const w = trackEl.offsetWidth; // one copy incl. its trailing gap padding
    if (w <= 0) return;
    let total = w;
    let guard = 0;
    while (total < window.innerWidth + w * 2 && guard < 10) {
      const clone = trackEl.cloneNode(true);
      clone.setAttribute("aria-hidden", "true");
      bar.appendChild(clone);
      total += w;
      guard++;
    }
    bar.style.setProperty("--ticker-shift", w.toFixed(1) + "px");
    bar.style.setProperty("--ticker-duration", (w / SPEED).toFixed(2) + "s");
  };

  build();
  mobileMQ.addEventListener("change", build);
  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(build, 200);
  });
}
initTicker();

// ---- Smooth scroll ------------------------------------------------------
// Reduced motion: skip Lenis entirely (native scroll, marquee frozen by CSS).
if (!prefersReducedMotion) {
  const lenis = new Lenis({
    lerp: 0.09,
    smoothWheel: true,
    syncTouch: true,
  });
  window.__lenis = lenis; // shared with initAddToCart's scroll-to-sizes
  const raf = (time) => {
    lenis.raf(time);
    requestAnimationFrame(raf);
  };
  requestAnimationFrame(raf);
}
