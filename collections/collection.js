// Collection page — smooth scroll only.
// The collection view is a flat product grid: no hero parallax, no pinned
// scroll-scrub, no loading intro. The navbar is locked solid in CSS
// (.header--collection), so all this needs is Lenis' eased momentum scroll —
// the same "weight" as the homepage — with a reduced-motion opt-out.
// Hover behaviour (image swap + swatch reveal) is pure CSS.
import Lenis from "./assets/vendor/lenis.mjs";

const prefersReducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)"
).matches;

// ---- Pinned toolbar ----
// The filter toolbar is sticky (top: 54px, under the fixed navbar). Once it
// reaches the nav and pins, flag the header so its bottom stroke returns —
// delineating the now-combined fixed bar from the content scrolling beneath.
// A plain scroll listener is enough (Lenis still drives real window scroll).
const NAV_H = 54;
const header = document.querySelector(".header--collection");
const toolbar = document.querySelector(".toolbar");
function syncPinned() {
  if (!header || !toolbar) return;
  const stuck = toolbar.getBoundingClientRect().top <= NAV_H + 0.5;
  header.classList.toggle("is-pinned", stuck);
}
window.addEventListener("scroll", syncPinned, { passive: true });
window.addEventListener("resize", syncPinned, { passive: true });
syncPinned();

// ---- Grid size toggle ----
// The "Grid Size" control switches the product grid between the default 4-up
// layout (cards with info below) and a dense 8-up layout of image-only tiles
// (.col-grid--8). Same cards, same markup — only the column count and the
// card's resting chrome change (handled in collection.css).
// "Grid Size" switches the product grid between 4-up and 8-up. Following
// Niksen's clean pattern, the column count lives in a CSS variable (--grid-cols)
// and the change is an instant, crisp snap — no crossfade. We only add
// .is-swapping for a single reflow so the per-card transitions are frozen while
// the resting state flips: otherwise the tag (always-on at 4-up, hover-only at
// 8-up) would fade over its 0.4s hover transition instead of snapping with the
// columns. Hover fades resume the moment .is-swapping is removed.
const gridToggle = document.querySelector("[data-grid-toggle]");
const grid = document.querySelector(".col-grid");
if (gridToggle && grid) {
  gridToggle.addEventListener("click", () => {
    grid.classList.add("is-swapping");
    const dense = grid.classList.toggle("col-grid--8");
    gridToggle.setAttribute("aria-pressed", String(dense));
    void grid.offsetHeight; // commit the snap with transitions frozen
    grid.classList.remove("is-swapping");
  });
}

// "View" swaps the grid's photography between on-model and clean product-only
// shots (.col-grid--product). Same instant, frozen-transition snap as Grid Size;
// composes with it. The image swap itself is handled in collection.css.
const viewToggle = document.querySelector("[data-view-toggle]");
if (viewToggle && grid) {
  viewToggle.addEventListener("click", () => {
    grid.classList.add("is-swapping");
    const product = grid.classList.toggle("col-grid--product");
    viewToggle.setAttribute("aria-pressed", String(product));
    void grid.offsetHeight; // commit the snap with transitions frozen
    grid.classList.remove("is-swapping");
  });
}

// ---- Filter & Sort drawer ----
// Slide-in drawer opened by the toolbar's "Filter & Sort" (desktop + mobile).
// Opening locks the background scroll (Lenis pauses). The body is a set of
// accordion sections; the prints/colours swatches and fabric/in-stock
// checkboxes are toggle-selectable. Reset clears them; Apply just closes
// (wiring the selections to the product grid isn't in scope yet).
const filterOpenBtn = document.querySelector("[data-filter-open]");
const filterPanel = document.querySelector(".filter-panel");
const filterBackdrop = document.querySelector(".filter-backdrop");

function openFilter() {
  if (!filterPanel || !filterBackdrop) return;
  filterBackdrop.hidden = false;
  // Force a reflow so the un-hidden backdrop can transition its opacity in.
  void filterBackdrop.offsetHeight;
  filterPanel.classList.add("is-open");
  filterBackdrop.classList.add("is-open");
  lenis?.stop();
  filterPanel.querySelector(".filter-panel__close")?.focus();
}
function closeFilter() {
  if (!filterPanel || !filterBackdrop) return;
  filterPanel.classList.remove("is-open");
  filterBackdrop.classList.remove("is-open");
  lenis?.start();
  // Hide the backdrop again once its fade-out has finished (matches the 0.6s
  // drawer transition).
  window.setTimeout(() => {
    if (!filterBackdrop.classList.contains("is-open")) filterBackdrop.hidden = true;
  }, 640);
}

if (filterOpenBtn && filterPanel) {
  filterOpenBtn.addEventListener("click", openFilter);
  document
    .querySelectorAll("[data-filter-close]")
    .forEach((el) => el.addEventListener("click", closeFilter));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeFilter();
  });

  // Build the prints grid (5 thumbnails cycled) and the colours grid.
  const PRINT_COUNT = 36;
  const COLORS = [
    "#1a2b4c", "#8fb3da", "#ffffff", "#1a2b4c", "#c9b896", "#2c2c2a",
    "#5f7052", "#d9c7a3", "#3b4a5a", "#b5463d", "#e8ddc8", "#4b5240",
    "#2c2c2a", "#d20101", "#f4d700", "#140803",
  ];
  const printsWrap = filterPanel.querySelector("[data-prints]");
  const colorsWrap = filterPanel.querySelector("[data-colors]");
  if (printsWrap) {
    for (let i = 0; i < PRINT_COUNT; i++) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "filter-swatch filter-swatch--print";
      b.dataset.print = String(i % 5); // print type 0-4 (see PRINT_COLORS)
      b.style.backgroundImage = `url("assets/images/collection/prints/print-${(i % 5) + 1}.png")`;
      b.setAttribute("aria-pressed", "false");
      printsWrap.appendChild(b);
    }
  }
  if (colorsWrap) {
    COLORS.forEach((hex) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "filter-swatch filter-swatch--color";
      b.style.background = hex;
      b.setAttribute("aria-pressed", "false");
      b.setAttribute("aria-label", hex);
      colorsWrap.appendChild(b);
    });
  }
  // ---- Linked prints & colours ----
  // Each print type (0-4) maps to the colour indices it contains. Selecting a
  // print (single-select) dims the other prints and narrows the colours to that
  // print's palette; the rest dim and go non-interactive. Colours themselves
  // are multi-select. Clicking the active print again clears the link.
  const printEls = [...printsWrap.querySelectorAll(".filter-swatch--print")];
  const colorEls = [...colorsWrap.querySelectorAll(".filter-swatch--color")];
  const PRINT_COLORS = {
    0: [9, 13, 10], // red geometric → red, red, cream
    1: [0, 3, 8],   // navy → navy, navy, slate
    2: [1, 2],      // light blue → light blue, white
    3: [2, 3],      // paisley → white, navy (the Figma example)
    4: [0, 4, 7],   // plaid → navy, tan, sand
  };
  let activePrint = null;

  function updateLinked() {
    if (!activePrint) {
      printEls.forEach((p) => p.classList.remove("is-dimmed"));
      colorEls.forEach((c) => c.classList.remove("is-dimmed"));
      return;
    }
    const allowed = new Set(PRINT_COLORS[Number(activePrint.dataset.print)] || []);
    printEls.forEach((p) => p.classList.toggle("is-dimmed", p !== activePrint));
    colorEls.forEach((c, i) => {
      const ok = allowed.has(i);
      c.classList.toggle("is-dimmed", !ok);
      if (!ok) {
        // a colour that isn't in the selected print can't stay selected
        c.classList.remove("is-selected");
        c.setAttribute("aria-pressed", "false");
      }
    });
  }

  printEls.forEach((print) => {
    print.addEventListener("click", () => {
      if (activePrint === print) {
        activePrint.classList.remove("is-active");
        activePrint = null;
      } else {
        activePrint?.classList.remove("is-active");
        activePrint = print;
        print.classList.add("is-active");
      }
      printEls.forEach((p) =>
        p.setAttribute("aria-pressed", String(p === activePrint))
      );
      updateLinked();
    });
  });

  colorEls.forEach((color) => {
    color.addEventListener("click", () => {
      const on = color.classList.toggle("is-selected");
      color.setAttribute("aria-pressed", String(on));
    });
  });

  // Accordion open/close.
  filterPanel.querySelectorAll("[data-acc-toggle]").forEach((head) => {
    head.addEventListener("click", () => {
      const acc = head.closest("[data-acc]");
      const open = acc.classList.toggle("is-open");
      head.setAttribute("aria-expanded", String(open));
    });
  });

  // Category section (mobile) — single-select, panel stays open.
  filterPanel.querySelectorAll(".filter-cat").forEach((cat) => {
    cat.addEventListener("click", (e) => {
      e.preventDefault();
      filterPanel
        .querySelector(".filter-cat.is-active")
        ?.classList.remove("is-active");
      cat.classList.add("is-active");
    });
  });

  // Reset: clear swatches, uncheck fabric/in-stock, category back to "All".
  filterPanel
    .querySelector("[data-filter-reset]")
    ?.addEventListener("click", () => {
      // colours: clear selection
      colorEls.forEach((c) => {
        c.classList.remove("is-selected");
        c.setAttribute("aria-pressed", "false");
      });
      // prints: clear the active print + linked dimming
      activePrint?.classList.remove("is-active");
      activePrint = null;
      printEls.forEach((p) => p.setAttribute("aria-pressed", "false"));
      updateLinked();
      // fabric + in-stock
      filterPanel
        .querySelectorAll(".fcheck__input")
        .forEach((c) => (c.checked = false));
      // category back to "All"
      const cats = filterPanel.querySelectorAll(".filter-cat");
      filterPanel
        .querySelector(".filter-cat.is-active")
        ?.classList.remove("is-active");
      cats[0]?.classList.add("is-active");
    });
}

let lenis = null;
if (!prefersReducedMotion) {
  lenis = new Lenis({
    lerp: 0.09,
    smoothWheel: true,
    syncTouch: true,
  });

  const frame = (time) => {
    lenis.raf(time);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
