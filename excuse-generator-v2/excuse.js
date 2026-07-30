/* ============================================================
   Excuse Generator V2 — "Reasons to Stay In…" (jackpot reel)

   Click → the reel of excuses spins vertically and decelerates
   onto one, slot-machine style (its top and bottom edges fade
   softly while rolling, so excuses melt through the slot rather
   than being sliced). A beat after landing, a full-bleed photo
   fades up behind the text, which flips to paper. The next click
   clears the photo and rolls again.

   Shuffle bags drive both the excuses and the photos, so
   nothing repeats until its pool is exhausted. Clicks are
   ignored mid-spin; the reel always finishes its roll.
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

// Full-bleed landing photos (lifestyle shots shared with the homepage).
const IMAGES = [
  "assets/images/fullbleed/hero-v12.jpg",
  "assets/images/fullbleed/promo-summer.jpg",
  "assets/images/fullbleed/band-1.jpg",
  "assets/images/fullbleed/band-2.jpg",
  "assets/images/fullbleed/feature-left.jpg",
  "assets/images/fullbleed/feature-right.jpg",
  "assets/images/fullbleed/rest-lazy.jpg",
  "assets/images/fullbleed/rest-sunday.jpg",
  "assets/images/fullbleed/rest-about.jpg",
];

const stage = document.querySelector("[data-excuse]");
const reel = document.querySelector("[data-reel]");
const track = document.querySelector("[data-reel-track]");
const btn = document.querySelector("[data-excuse-next]");
const fullbleedImg = document.querySelector("[data-fullbleed-img]");

const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Roll shape: how many slots the reel travels and how long it takes.
// The curve matters as much as the duration. Sharper ease-outs (expo, cubic)
// creep through their last few pixels, so the reel LOOKS stopped long before
// the transition ends — and since the photo waits on transitionend, that dead
// tail reads as lag (expo@2400 left ~570ms of it, cubic@1800 ~220ms).
// This quad ease-out stays perceptibly in motion almost to the end: ~25ms of
// tail, and it still has ~23% of the travel left at the halfway mark, so it
// reads as rolling-then-arriving rather than rushing-then-creeping.
const SPIN_SLOTS = 11;
const SPIN_MS = 1700;
const SPIN_EASE = "cubic-bezier(0.25, 0.46, 0.45, 0.94)";
// Token beat so the photo's class lands on a separate frame from the settle;
// short enough to be imperceptible.
const IMAGE_DELAY_MS = 40;

/* ---------- Shuffle bags ---------- */
function makeBag(items) {
  let bag = [];
  let last = null;
  return () => {
    if (!bag.length) {
      bag = items.map((_, i) => i);
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
      }
      // No immediate repeat across a refill (we pop from the end).
      if (bag[bag.length - 1] === last) {
        [bag[bag.length - 1], bag[0]] = [bag[0], bag[bag.length - 1]];
      }
    }
    last = bag.pop();
    return items[last];
  };
}
const nextExcuse = makeBag(EXCUSES);
const nextImage = makeBag(IMAGES);

/* ---------- Reel helpers ---------- */
function makeItem(text) {
  const item = document.createElement("div");
  item.className = "excuse-reel__item";
  const span = document.createElement("span");
  span.className = "excuse-reel__text";
  span.textContent = text;
  item.appendChild(span);
  return item;
}

function currentText() {
  const span = track.querySelector(".excuse-reel__text");
  return span ? span.textContent : EXCUSES[0];
}

// Rebuild the track as [current, …fillers…, target] so the spin starts from
// the visible excuse and travels down to the new one. Fillers are drawn from
// the pool with no adjacent duplicates, so every excuse rolling past reads as
// a different one.
function buildTrack(from, target) {
  track.textContent = "";
  const seq = [from];
  while (seq.length < SPIN_SLOTS - 1) {
    const pick = EXCUSES[Math.floor(Math.random() * EXCUSES.length)];
    if (pick !== seq[seq.length - 1] && pick !== target) seq.push(pick);
  }
  seq.push(target);
  seq.forEach((t) => track.appendChild(makeItem(t)));
}

// Track offset that puts `item` dead-centre in the reel viewport. Items hug
// their text (a two-line excuse is shorter than a three-line one), so every
// position is measured rather than derived from a fixed slot height.
function centerOffset(item) {
  return -(item.offsetTop + item.offsetHeight / 2 - reel.clientHeight / 2);
}

// Park the resting excuse in the centre, no transition.
function centerAtRest() {
  const item = track.firstElementChild;
  if (!item) return;
  track.style.transition = "none";
  track.style.transform = `translate3d(0, ${centerOffset(item)}px, 0)`;
}

/* ---------- State machine: idle → spinning → landed → spinning… ---------- */
let state = "idle";
let landTimer = null;

function startSpin() {
  state = "spinning";
  btn.classList.add("is-busy");

  const target = nextExcuse();
  // Preload the landing photo during the spin so it pops fully sharp.
  fullbleedImg.src = nextImage();

  if (reduce) {
    // Reduced motion: no roll — swap the excuse, then show the photo.
    track.textContent = "";
    track.appendChild(makeItem(target));
    centerAtRest();
    land();
    return;
  }

  buildTrack(currentText(), target);

  // Roll from the current excuse centred to the target centred. Both ends are
  // measured, since items hug their text and so vary in height.
  const from = centerOffset(track.firstElementChild);
  const to = centerOffset(track.lastElementChild);

  track.style.transition = "none";
  track.style.transform = `translate3d(0, ${from}px, 0)`;
  void track.offsetHeight;
  stage.classList.add("is-spinning");
  track.style.transition = `transform ${SPIN_MS}ms ${SPIN_EASE}`;
  track.style.transform = `translate3d(0, ${to}px, 0)`;

  let landed = false;
  const settle = (e) => {
    // Only the track's own transform finishing counts — transitionend BUBBLES,
    // so any transition on a descendant would otherwise settle the reel early
    // and cut the spin short.
    if (e && (e.target !== track || e.propertyName !== "transform")) return;
    if (landed) return;
    landed = true;
    track.removeEventListener("transitionend", settle);
    // Collapse the track to just the landed excuse, re-centred, so the next
    // spin starts from a clean single-item state.
    track.textContent = "";
    track.appendChild(makeItem(target));
    centerAtRest();
    stage.classList.remove("is-spinning"); // drop the rolling edge fade
    landTimer = window.setTimeout(land, IMAGE_DELAY_MS);
  };
  track.addEventListener("transitionend", settle);
  window.setTimeout(settle, SPIN_MS + 200); // fallback if the event is missed
}

function land() {
  landTimer = null;
  stage.classList.add("is-landed");
  btn.classList.remove("is-busy");
  state = "landed";
}

function advance() {
  if (state === "spinning") return; // the reel always finishes its roll

  if (state === "landed" || landTimer) {
    // Clear the photo (and any pending photo reveal), then roll again after
    // a short beat so the fade-out visibly starts before the reel moves.
    if (landTimer) {
      window.clearTimeout(landTimer);
      landTimer = null;
    }
    stage.classList.remove("is-landed");
    state = "spinning"; // block double-clicks during the beat
    window.setTimeout(startSpin, reduce ? 0 : 200);
    return;
  }

  startSpin();
}

/* ---------- Init ---------- */
function init() {
  // Wait for the web fonts before the entrance so the eyebrow/CTA don't
  // shift when Gerstner swaps in (same gate as V1; no rAF after the async
  // gate — throttled callbacks can leave the page hidden).
  let revealed = false;
  const reveal = () => {
    if (revealed) return;
    revealed = true;
    // Centre the seeded excuse once the real font is measuring, then show.
    centerAtRest();
    stage.classList.add("is-ready");
  };
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(reveal);
  }
  window.setTimeout(reveal, 1500);

  // Re-centre when the reel's metrics change (font-size and wrapping both
  // shift with viewport width). Only while idle — mid-spin the transition owns
  // the transform.
  let resizeTimer = null;
  window.addEventListener("resize", () => {
    if (state === "spinning") return;
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(centerAtRest, 120);
  });

  btn.addEventListener("click", advance);

  // Space / Enter anywhere (outside inputs) rolls too.
  document.addEventListener("keydown", (e) => {
    const tag = (e.target.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea") return;
    if (e.code === "Space" || e.code === "Enter") {
      if (document.activeElement === btn && e.code === "Enter") return;
      e.preventDefault();
      advance();
    }
  });
}

init();
