// ================================
// CONFIG
// ================================
const TZ = "America/Toronto";
const START_MONTH = 12;

// Doors shown: 13–25
const START_DAY = 13;
const END_DAY = 25;

// Scramble order
const STABLE_SCRAMBLE = true;

// Secret preview mode trigger:
// Example: https://yoursite.com/?preview=1
function isPreviewFromURL() {
  const params = new URLSearchParams(window.location.search);
  return params.get("preview") === "1";
}
const PREVIEW_MODE = isPreviewFromURL();

// Build door list: [13, 14, ..., 25]
const DOOR_DAYS = Array.from(
  { length: END_DAY - START_DAY + 1 },
  (_, i) => START_DAY + i
);

// ================================
// ELEMENTS
// ================================
const $cal = document.getElementById("calendar");
const $modal = document.getElementById("modal");
const $modalTitle = document.getElementById("modalTitle");
const $modalContent = document.getElementById("modalContent");
const $close = $modal.querySelector(".close");
const $mark = $modal.querySelector(".mark-done");
const $share = $modal.querySelector(".share");
const $snowBtn = document.getElementById("snowToggle");

// ================================
// STATE
// ================================
let DAYS_DATA = [];
let currentDay = null;

const state = {
  done: new Set(JSON.parse(localStorage.getItem("advent_done") || "[]"))
};

function save() {
  localStorage.setItem("advent_done", JSON.stringify([...state.done]));
}

// ================================
// DATE HELPERS
// ================================
function todayInTZ() {
  const now = new Date();
  const str = now.toLocaleString("en-CA", { timeZone: TZ });
  return new Date(str);
}

function isUnlocked(day) {
  if (PREVIEW_MODE) return true; // ✅ unlock everything in preview mode
  const t = todayInTZ();
  const unlockDate = new Date(t.getFullYear(), START_MONTH - 1, day);
  return t >= unlockDate;
}

// ================================
// DATA
// ================================
async function fetchDays() {
  const res = await fetch("data/days.json");
  DAYS_DATA = await res.json();
}

// ================================
// SHUFFLE HELPERS
// ================================
function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Stable scramble: same order every refresh for everyone
function stableShuffle(array, seedStr) {
  let seed = 0;
  for (let i = 0; i < seedStr.length; i++) seed = (seed * 31 + seedStr.charCodeAt(i)) >>> 0;

  function rand() {
    seed ^= seed << 13; seed >>>= 0;
    seed ^= seed >> 17; seed >>>= 0;
    seed ^= seed << 5;  seed >>>= 0;
    return (seed >>> 0) / 4294967296;
  }

  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function getScrambledDays() {
  if (!STABLE_SCRAMBLE) return shuffle(DOOR_DAYS);

  // One seed for the site. You can change this value to reshuffle.
  // TIP: change "v1" to "v2" later if you want a new scramble order.
  const seed = "christmas-scramble-v1";
  return stableShuffle(DOOR_DAYS, seed);
}

// ================================
// IMAGE PATH
// ================================
function imagePathForDay(day) {
  const n = String(day).padStart(2, "0");
  return `assets/img/doors/Door${n}-Blue.png`;
}

// ================================
// PREVIEW BADGE
// ================================
function addPreviewBadge() {
  if (!PREVIEW_MODE) return;

  const badge = document.createElement("div");
  badge.textContent = "PREVIEW MODE (preview=1)";
  badge.style.position = "fixed";
  badge.style.left = "12px";
  badge.style.bottom = "12px";
  badge.style.zIndex = "9999";
  badge.style.padding = "8px 10px";
  badge.style.borderRadius = "12px";
  badge.style.background = "rgba(0,0,0,0.55)";
  badge.style.border = "1px solid rgba(255,255,255,0.25)";
  badge.style.color = "#fff";
  badge.style.fontSize = "0.85rem";
  badge.style.backdropFilter = "blur(6px)";
  document.body.appendChild(badge);
}

// ================================
// RENDER DOORS
// ================================
function renderDoors() {
  $cal.innerHTML = "";

  const scrambledDays = getScrambledDays();

  scrambledDays.forEach(day => {
    const data =
      DAYS_DATA.find(d => d.day === day) ||
      { day, title: `Day ${day}`, html: "<p>Surprise awaits!</p>" };

    const unlocked = isUnlocked(day);
    const imgSrc = imagePathForDay(day);

    const btn = document.createElement("button");
    btn.className =
      "door" +
      (unlocked ? "" : " locked") +
      (state.done.has(day) ? " done" : "");

    btn.dataset.day = day;
    btn.setAttribute("aria-disabled", unlocked ? "false" : "true");

    btn.innerHTML = `
      <div class="door-inner">
        <span class="day-badge">${day}</span>
        <div class="door-art">
          <img src="${imgSrc}" alt="Christmas door for day ${day}" loading="lazy">
        </div>
      </div>
    `;

    btn.addEventListener("click", () => openDay(day, unlocked, data));
    $cal.appendChild(btn);
  });
}

// ================================
// MODAL
// ================================
function openDay(day, unlocked, data) {
  if (!unlocked) return;

  currentDay = day;
  $modalTitle.textContent = `Day ${day}: ${data.title}`;
  $modalContent.innerHTML = data.html;
  $modal.showModal();
}

$close.addEventListener("click", () => $modal.close());

$mark.addEventListener("click", () => {
  if (currentDay) {
    state.done.add(currentDay);
    save();
    renderDoors();
  }
  $modal.close();
});

$share.addEventListener("click", async () => {
  if (!currentDay) return;

  const url = location.href.split("#")[0] + `#day=${currentDay}`;
  if (navigator.share) {
    await navigator.share({
      title: "Advent Calendar",
      text: `I opened Day ${currentDay}!`,
      url
    });
  } else {
    await navigator.clipboard.writeText(url);
    alert("Link copied!");
  }
});

// ================================
// SNOW TOGGLE (simple)
// ================================
(() => {
  const canvas = document.getElementById("snowCanvas");
  if (!canvas || !$snowBtn) return;

  const ctx = canvas.getContext("2d");
  let rafId = null;
  let snowEnabled = true;

  const flakes = Array.from({ length: 120 }, () => ({
    x: Math.random() * window.innerWidth,
    y: Math.random() * window.innerHeight,
    r: Math.random() * 2 + 0.5,
    s: Math.random() * 0.6 + 0.3
  }));

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "rgba(255,255,255,.85)";

    flakes.forEach(f => {
      f.y += f.s;
      if (f.y > canvas.height) f.y = -5;

      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
      ctx.fill();
    });

    rafId = requestAnimationFrame(draw);
  }

  function start() {
    resize();
    rafId = requestAnimationFrame(draw);
    $snowBtn.setAttribute("aria-pressed", "true");
  }

  function stop() {
    cancelAnimationFrame(rafId);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    $snowBtn.setAttribute("aria-pressed", "false");
  }

  $snowBtn.addEventListener("click", () => {
    snowEnabled = !snowEnabled;
    snowEnabled ? start() : stop();
  });

  window.addEventListener("resize", resize);
  start();
})();

// ================================
// INIT
// ================================
(async function init() {
  addPreviewBadge();

  try {
    await fetchDays();
  } catch (e) {
    console.warn("days.json missing or invalid", e);
  }

  renderDoors();
})();