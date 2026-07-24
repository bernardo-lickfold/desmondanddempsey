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
    paint(EXCUSES[nextIndex()]);
    setCollage();
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
    stage.classList.add("is-ready");
    line.classList.add("is-in");
  };
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(reveal);
  }
  // Fallback so we always reveal even if the font promise never settles.
  window.setTimeout(reveal, 1500);

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
