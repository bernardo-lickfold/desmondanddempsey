// Quiz — Find Your Perfect Pyjama.
// A small state machine over the .quiz-step sections in quiz.html:
// entry → 4 questions → email gate → results.
// Answers score the four collections; the highest score wins and fills the
// results step. All tunable content (weights, copy, products) lives in the
// config objects up top so the mapping can change without touching the logic.

// ---- Recommendation config -------------------------------------------------
// Each answer adds points to one or more collections. Highest total wins;
// ties resolve by TIE_ORDER (most distinctive collection first).
const WEIGHTS = {
  sleep: {
    hot:     { essentials: 1, legacy: 1 },
    cold:    { heirloom: 1, classics: 1 },
    between: { classics: 1, essentials: 1 },
  },
  wear: {
    sleep:  { classics: 2 },
    lounge: { essentials: 2 },
    both:   { legacy: 1, heirloom: 1 },
  },
  fabric: {
    crisp:   { classics: 1, essentials: 1 },
    brushed: { heirloom: 2 },
    linen:   { legacy: 1, essentials: 1 },
  },
  look: {
    bold:   { legacy: 3 },
    quiet:  { classics: 3 },
    middle: { essentials: 2, heirloom: 1 },
  },
};
const TIE_ORDER = ["legacy", "heirloom", "classics", "essentials"];

const COLLECTIONS = {
  legacy: {
    name: "Legacy",
    copy: "The Legacy collection was practically made for you.",
    cta: "collection.html",
  },
  classics: {
    name: "Classics",
    copy: "The Classics collection was practically made for you.",
    cta: "collection.html",
  },
  essentials: {
    name: "Essentials",
    copy: "The Essentials collection was practically made for you.",
    cta: "collection.html",
  },
  heirloom: {
    name: "Heirloom",
    copy: "The Heirloom collection was practically made for you.",
    cta: "collection.html",
  },
};

// Result product rows — per collection, reusing the shared .pcard pattern
// (quiz.css turns the info block + tag into hover-only overlays, per the comp).
const PRODUCTS = {
  default: [
    { img: "assets/images/quiz/result-1.png", name: "Womens 402 Long Set Chambray Blue", price: "£95", tag: "" },
    { img: "assets/images/quiz/result-2.png", name: "Men Chambray Blue", price: "£95", tag: "New in" },
    { img: "assets/images/quiz/result-3.png", name: "Womens Fleur Nightie", price: "£120", tag: "" },
    { img: "assets/images/quiz/result-4.png", name: "Mens Gingham Short Set", price: "£85", tag: "" },
  ],
};

// Trait fragments for the personalised results line, keyed by answer.
const TRAITS = {
  sleep:  { hot: "Hot sleeper", cold: "Cold sleeper", between: "Easy sleeper" },
  wear:   { sleep: "strictly-for-bed", lounge: "all-day lounger", both: "sofa-to-sleep" },
  fabric: { crisp: "crisp cotton", brushed: "brushed cotton", linen: "light linen" },
  look:   { bold: "boldly printed", quiet: "quietly classic", middle: "a little of both" },
};

// ---- State -----------------------------------------------------------------
const STEPS = ["entry", "q-sleep", "q-wear", "q-fabric", "q-look", "email", "results"];
const QUESTION_STEPS = STEPS.filter((s) => s.startsWith("q-"));

const quiz = document.querySelector("[data-quiz]");
const stepEls = new Map(
  [...quiz.querySelectorAll(".quiz-step")].map((el) => [el.dataset.step, el])
);
const chrome = quiz.querySelector("[data-quiz-chrome]");
const stepLabel = quiz.querySelector("[data-quiz-step-label]");
const progressFill = quiz.querySelector("[data-quiz-progress]");

const answers = {}; // { sleep, wear, fabric, look } → chosen data-value
let current = "entry";

const prefersReducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)"
).matches;

// ---- Navigation ------------------------------------------------------------
function show(step, { push = true } = {}) {
  const from = stepEls.get(current);
  const to = stepEls.get(step);
  if (!to || from === to) return;

  from.classList.remove("is-active");
  to.classList.add("is-active");
  if (!prefersReducedMotion) {
    // One frame in the entering state so the fade+rise transition runs.
    to.classList.add("is-entering");
    requestAnimationFrame(() => requestAnimationFrame(() => to.classList.remove("is-entering")));
  }

  current = step;
  syncChrome();
  if (push) history.pushState({ step }, "", "#" + step);
  window.scrollTo(0, 0);

  if (step === "results") renderResults();
}

function syncChrome() {
  const qIndex = QUESTION_STEPS.indexOf(current);
  // Chrome (back + progress) exists only on the question steps (per the comp
  // the email gate carries no chrome at all).
  chrome.hidden = qIndex === -1;
  if (qIndex !== -1) {
    stepLabel.textContent =
      String(qIndex + 1).padStart(2, "0") + " / " + String(QUESTION_STEPS.length).padStart(2, "0");
    progressFill.style.width = ((qIndex + 1) / QUESTION_STEPS.length) * 100 + "%";
  }
}

function back() {
  const i = STEPS.indexOf(current);
  if (i > 0) show(STEPS[i - 1]);
}

// Browser back/forward mirrors the in-quiz steps. The hash is the source of
// truth: it is already updated when popstate fires, while e.state can be
// stale or null on some navigations (forced reloads, restored tabs).
window.addEventListener("popstate", (e) => {
  const step = location.hash.slice(1) || (e.state && e.state.step) || "entry";
  if (stepEls.has(step)) show(step, { push: false });
});

// ---- Scoring ---------------------------------------------------------------
function recommend() {
  const scores = { legacy: 0, classics: 0, essentials: 0, heirloom: 0 };
  for (const [question, value] of Object.entries(answers)) {
    const table = WEIGHTS[question] && WEIGHTS[question][value];
    if (!table) continue;
    for (const [collection, pts] of Object.entries(table)) scores[collection] += pts;
  }
  // Strict > while scanning in TIE_ORDER means earlier (more distinctive)
  // collections win ties.
  return TIE_ORDER.reduce((best, key) =>
    scores[key] > scores[best] ? key : best
  , TIE_ORDER[0]);
}

function traitLine() {
  const parts = [
    TRAITS.sleep[answers.sleep],
    TRAITS.wear[answers.wear],
    TRAITS.fabric[answers.fabric],
    TRAITS.look[answers.look],
  ].filter(Boolean);
  return parts.join(", ");
}

// ---- Results rendering -----------------------------------------------------
function renderResults() {
  const key = recommend();
  const c = COLLECTIONS[key];
  quiz.querySelector("[data-quiz-result-title]").textContent =
    "You’re " + (/^[aeiou]/i.test(c.name) ? "an " : "a ") + c.name + " sleeper.";
  const traits = traitLine();
  quiz.querySelector("[data-quiz-result-copy]").textContent =
    (traits ? traits + ". " : "") + c.copy;
  quiz.querySelector("[data-quiz-result-cta]").href = c.cta;

  const grid = quiz.querySelector("[data-quiz-result-grid]");
  const products = PRODUCTS[key] || PRODUCTS.default;
  grid.innerHTML = products
    .map(
      (p) => `
      <article class="pcard">
        <a class="pcard__link" href="#">
          <span class="pcard__media">
            <img src="${p.img}" alt="${p.name}" />
          </span>
          ${p.tag ? `<span class="pcard__tag">${p.tag}</span>` : ""}
          <span class="pcard__info">
            <span class="pcard__meta"><span class="pcard__name">${p.name}</span><span class="pcard__price">${p.price}</span></span>
          </span>
        </a>
      </article>`
    )
    .join("");
}

// ---- Email gate ------------------------------------------------------------
// Front-end stub: valid emails are kept in localStorage and announced via a
// CustomEvent so the future ESP integration (Klaviyo/Mailchimp) has one hook.
const emailForm = quiz.querySelector("[data-quiz-email-form]");
const emailError = quiz.querySelector("[data-quiz-email-error]");

emailForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const value = emailForm.email.value.trim();
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
  emailError.hidden = valid;
  if (!valid) return;
  try {
    localStorage.setItem("dd-quiz-email", value);
    localStorage.setItem("dd-quiz-answers", JSON.stringify(answers));
  } catch (err) {
    /* private mode — the quiz still works without persistence */
  }
  document.dispatchEvent(
    new CustomEvent("quiz:email", { detail: { email: value, answers: { ...answers } } })
  );
  show("results");
});

// ---- Wiring ----------------------------------------------------------------
quiz.querySelector("[data-quiz-start]").addEventListener("click", () => show(STEPS[1]));
quiz.querySelector("[data-quiz-back]").addEventListener("click", back);

// Option tiles: record the answer, mark the tile, advance after a beat so the
// selection state is seen (matches the Figma selected-tile treatment).
quiz.querySelectorAll(".quiz-step[data-question]").forEach((stepEl) => {
  const question = stepEl.dataset.question;
  stepEl.querySelectorAll(".quiz-option").forEach((option) => {
    option.addEventListener("click", () => {
      answers[question] = option.dataset.value;
      // Persist as we go so a mid-flow reload (or the email/results deep
      // links) can restore the sheet instead of scoring empty.
      try {
        localStorage.setItem("dd-quiz-answers", JSON.stringify(answers));
      } catch (err) {
        /* private mode — in-memory answers still work */
      }
      stepEl.querySelectorAll(".quiz-option").forEach((el) =>
        el.classList.toggle("is-selected", el === option)
      );
      const i = STEPS.indexOf(stepEl.dataset.step);
      setTimeout(() => show(STEPS[i + 1]), prefersReducedMotion ? 0 : 220);
    });
  });
});

// Deep-link support (#q-fabric etc.) — falls back to entry. A reloaded or
// shared link lands past the questions, so restore any saved answers first
// (results would otherwise score an empty sheet).
const initial = location.hash.slice(1);
if (initial && initial !== "entry" && stepEls.has(initial)) {
  try {
    const saved = JSON.parse(localStorage.getItem("dd-quiz-answers") || "{}");
    for (const [k, v] of Object.entries(saved)) if (WEIGHTS[k] && WEIGHTS[k][v]) answers[k] = v;
  } catch (err) {
    /* corrupt storage — start clean */
  }
  history.replaceState({ step: initial }, "", "#" + initial);
  show(initial, { push: false });
} else {
  history.replaceState({ step: "entry" }, "", "#entry");
  syncChrome();
}
