/* ============================================================
   Excuse Generator — "Reasons to Stay In…"

   One giant serif excuse swaps on demand. The swap reuses the
   site's signature motion: the outgoing line blurs + lifts away
   (rolling R→L), then the incoming line settles in word-by-word
   (blur + rise + fade, L→R), staggered by index — the same
   treatment as the loader copy and the press pull-quotes.

   A shuffle-bag picks the next excuse so you never see the same
   one twice in a row and every excuse shows once before repeats.
   Rapid clicks are debounced to the current roll; the very last
   click always wins.
   ============================================================ */

const EXCUSES = [
  "Eating everything in the freezer",
  "The cat has a therapy appointment",
  "Had a sudden urge to write my memoir",
  "Trying to seduce the plumber",
  "Deep in the First Dates back catalogue",
  "So close to completing Tetris",
  "Getting my parallel-park practice in",
  "Practising walking in clogs",
  "Clueless is on iPlayer",
  "Halfway through a crochet tea cosy",
  "The dog is having a tantrum",
  "A tin of stroopwafels to finish",
  "Currently rebranding myself",
  "Locked in the larder, sadly",
  "Cutting myself a new fringe",
  "Developing a signature cocktail",
  "Pickling this year's cucumbers",
  "Waiting for the bread to prove",
  "The bed simply will not release me",
  "It is, technically, still Sunday",
];

const stage = document.querySelector("[data-excuse]");
const line = document.querySelector("[data-excuse-line]");
const btn = document.querySelector("[data-excuse-next]");
const collageImgs = [...document.querySelectorAll("[data-collage]")];

// Corner-collage image pool (lifestyle shots). Each swap draws one distinct
// image per frame so the four frames never duplicate within a round.
const IMAGES = [
  "assets/images/collage/c1.png",
  "assets/images/collage/c2.png",
  "assets/images/collage/c3.png",
  "assets/images/collage/c4.png",
  "assets/images/collage/c5.png",
  "assets/images/collage/c6.png",
  "assets/images/collage/c7.png",
  "assets/images/collage/c8.png",
];

const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Roll timings (kept in sync with the CSS transitions in excuse.css).
const OUT_MS = reduce ? 160 : 460; // exit blur/lift before the swap

let rolling = false;
let queued = false; // a click that landed mid-roll → run once more when free

/* ---------- Shuffle bag ----------
   Draw without replacement; reshuffle when empty, guarding against the
   just-seen excuse leading the fresh bag (no immediate repeat). */
let bag = [];
let last = 0; // the seeded excuse is index 0

function refillBag(exclude) {
  bag = EXCUSES.map((_, i) => i);
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  if (bag[bag.length - 1] === exclude) {
    // keep the last-drawn out of the front (we pop from the end)
    [bag[bag.length - 1], bag[0]] = [bag[0], bag[bag.length - 1]];
  }
}

function nextIndex() {
  if (!bag.length) refillBag(last);
  const i = bag.pop();
  last = i;
  return i;
}

/* ---------- Collage images ----------
   Draw one distinct image per frame from a shuffle bag; refill (reshuffled)
   when it runs low, and set them all in one go. */
let imgBag = [];
function drawImages(count) {
  const out = [];
  let guard = 0;
  while (out.length < count && guard++ < 100) {
    if (!imgBag.length) {
      imgBag = IMAGES.slice();
      for (let i = imgBag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [imgBag[i], imgBag[j]] = [imgBag[j], imgBag[i]];
      }
    }
    const pick = imgBag.pop();
    if (!out.includes(pick)) out.push(pick);
  }
  return out;
}

function setCollage() {
  if (!collageImgs.length) return;
  const picks = drawImages(collageImgs.length);
  collageImgs.forEach((img, i) => {
    img.src = picks[i] || picks[0];
  });
}

/* ---------- Collage scatter ----------
   Each swap re-places the four frames at random spots so the collage feels
   playful, one new arrangement per excuse. Constraints keep it premium:
   · each frame stays in its side band (left/right of a protected centre
     column), so nothing ever covers the excuse, eyebrow or CTA;
   · the two frames sharing a side must be vertically separated, so frames
     never overlap each other;
   · sizes jitter a little (±) around the comp's scale;
   · positions/widths are written as %/vw, so a window resize keeps the
     arrangement proportional.
   Runs while the frames are blurred out mid-swap, so they simply *reappear*
   somewhere new. First load keeps the designed comp arrangement. */
const collageFrames = [...document.querySelectorAll(".excuse-collage__frame")];

function scatterCollage() {
  if (!collageFrames.length) return;
  const rect = stage.getBoundingClientRect();
  const W = rect.width;
  const H = rect.height;
  if (W <= 760) return; // collage is hidden on mobile

  // Half-width of the protected centre column — measured from the freshly
  // painted heading (scatter runs right after paint), plus a breathing gap,
  // so the frames always clear the actual text at any width.
  const headEl = line.querySelector(".excuse__line-text");
  const headHalf = headEl ? headEl.getBoundingClientRect().width / 2 : W * 0.2;
  const halfSafe = Math.min(380, Math.max(headHalf + 24, W * 0.2));
  const inset = Math.max(24, W * 0.028);
  const topPad = 24;
  const bottomPad = 72; // clear of the pinned footnote
  const gap = 24; // minimum vertical gap between a side's two frames

  const sides = {
    left: collageFrames.filter(
      (f) =>
        f.classList.contains("excuse-collage__frame--tl") ||
        f.classList.contains("excuse-collage__frame--bl")
    ),
    right: collageFrames.filter(
      (f) =>
        f.classList.contains("excuse-collage__frame--tr") ||
        f.classList.contains("excuse-collage__frame--br")
    ),
  };

  for (const [side, pair] of Object.entries(sides)) {
    // Random stack order per round (which frame lands on top).
    if (Math.random() < 0.5) pair.reverse();

    // Sample sizes (jitter around the comp's ~13vw scale). Cap to the side
    // band's width so narrow desktops never push a frame into the heading,
    // then shrink both proportionally if a short viewport can't fit the pair.
    const bandW = W / 2 - halfSafe - inset;
    let hs = pair.map(() => {
      let w = Math.min(300, Math.max(130, W * (0.11 + Math.random() * 0.045)));
      w = Math.max(90, Math.min(w, bandW));
      return (w * 4) / 3;
    });
    const span = H - topPad - bottomPad;
    const needed = hs[0] + hs[1] + gap;
    if (needed > span) {
      const k = (span - gap) / (hs[0] + hs[1]);
      hs = hs.map((h) => h * k);
    }

    // Split the leftover slack into three random chunks (above / between /
    // below), which guarantees the pair never overlaps.
    const slack = Math.max(0, span - (hs[0] + hs[1] + gap));
    const a = Math.random() * slack;
    const b = Math.random() * slack;
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    const ys = [topPad + lo, topPad + lo + hs[0] + gap + (hi - lo)];

    pair.forEach((f, i) => {
      const h = hs[i];
      const w = (h * 3) / 4;
      const minX = side === "left" ? inset : W / 2 + halfSafe;
      const maxX = side === "left" ? W / 2 - halfSafe - w : W - inset - w;
      const x = minX + Math.random() * Math.max(0, maxX - minX);
      f.style.left = ((x / W) * 100).toFixed(2) + "%";
      f.style.top = ((ys[i] / H) * 100).toFixed(2) + "%";
      f.style.right = "auto";
      f.style.bottom = "auto";
      f.style.width = ((w / W) * 100).toFixed(2) + "vw";
    });
  }
}

/* ---------- Word splitting ----------
   Wrap each word in a span carrying its L→R index (--i) for the enter
   stagger and its R→L index (--out) for the exit stagger. */
function paint(text) {
  const words = text.split(/\s+/);
  const n = words.length;
  // Words live inside a single text block so `text-wrap: balance` (in the CSS)
  // can even out the line lengths — no orphan word, no stubby last line.
  const inner = document.createElement("span");
  inner.className = "excuse__line-text";
  words.forEach((w, i) => {
    const span = document.createElement("span");
    span.className = "excuse__word";
    span.textContent = w;
    span.style.setProperty("--i", i);
    span.style.setProperty("--out", n - 1 - i);
    inner.appendChild(span);
    if (i < n - 1) inner.appendChild(document.createTextNode(" "));
  });
  line.textContent = "";
  line.appendChild(inner);
}

function advance() {
  if (rolling) {
    queued = true;
    return;
  }
  rolling = true;
  btn.classList.add("is-busy");

  // Exit the current line + blur the collage out.
  line.classList.remove("is-in");
  line.classList.add("is-out");
  stage.classList.add("is-swapping");

  window.setTimeout(() => {
    // Swap the text + collage images while they're invisible, then settle in.
    // The frames also scatter to fresh random spots each round.
    paint(EXCUSES[nextIndex()]);
    setCollage();
    scatterCollage();
    line.classList.remove("is-out");
    stage.classList.remove("is-swapping");
    // Force a frame so the fresh words start from their pre-enter state.
    void line.offsetWidth;
    line.classList.add("is-in");

    btn.classList.remove("is-busy");
    rolling = false;

    if (queued) {
      queued = false;
      advance();
    }
  }, OUT_MS);
}

/* ---------- Init ----------
   The seeded excuse is already in the markup; wrap it and reveal it (plus the
   chrome) once, so the first paint mirrors every subsequent roll. */
function init() {
  paint(line.textContent.trim());
  setCollage();

  // Wait for the web fonts (Gerstner / Reckless Neue) before playing the
  // entrance. Otherwise the eyebrow + CTA render in the fallback font, then
  // swap to Gerstner mid-animation — the width change shifts them sideways and
  // the reveal reads as a "jump". The font promise resolves well after the
  // first paint, so the hidden (0) state is already committed and we can flip
  // the classes directly — the transitions run from there. (No rAF: after an
  // async gate its callbacks are throttled while the tab is backgrounded.)
  let revealed = false;
  const reveal = () => {
    if (revealed) return;
    revealed = true;
    // .is-intro carries the one-time quiz-entry intro transition (blur-to-sharp
    // + scale settle + directional drift + stagger); removed once it finishes so
    // later swaps use the quick steady-state crossfade. Longest piece ≈ 0.42s
    // stagger + 1.5s settle, so clear it at ~2.1s.
    stage.classList.add("is-intro");
    stage.classList.add("is-ready");
    line.classList.add("is-in");
    window.setTimeout(() => stage.classList.remove("is-intro"), 2100);
  };

  // Reveal once BOTH the fonts and the collage images are ready, so the
  // blur-to-sharp pull resolves onto a loaded photo (never the placeholder).
  const fontsReady =
    document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  const imagesReady = Promise.all(
    collageImgs.map((img) =>
      img.complete && img.naturalWidth
        ? Promise.resolve()
        : (img.decode ? img.decode() : Promise.resolve()).catch(() => {})
    )
  );
  Promise.all([fontsReady, imagesReady]).then(reveal);
  // Fallback so we always reveal even if a promise never settles.
  window.setTimeout(reveal, 1800);

  btn.addEventListener("click", advance);

  // Space / Enter anywhere (outside inputs) rolls another — keeps the toy
  // playful without hunting for the button.
  document.addEventListener("keydown", (e) => {
    const tag = (e.target.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea") return;
    if (e.code === "Space" || e.code === "Enter") {
      if (document.activeElement === btn && e.code === "Enter") return; // native click
      e.preventDefault();
      advance();
    }
  });
}

init();
