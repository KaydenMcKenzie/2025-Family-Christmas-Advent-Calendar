// ================================
// CONFIG
// ================================
const TZ = "America/Toronto";
const START_MONTH = 12;

// Doors shown: 13–25
const START_DAY = 13;
const END_DAY = 25;

// Stable scramble order
const STABLE_SCRAMBLE = true;

// Secret preview:
// https://yoursite.com/?preview=1
function isPreviewFromURL() {
  const params = new URLSearchParams(window.location.search);
  return params.get("preview") === "1";
}
const PREVIEW_MODE = isPreviewFromURL();

// Build door list: [13..25]
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
  if (PREVIEW_MODE) return true;
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
// SHUFFLE
// ================================
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
  if (!STABLE_SCRAMBLE) return [...DOOR_DAYS].sort(() => Math.random() - 0.5);
  return stableShuffle(DOOR_DAYS, "christmas-scramble-v1");
}

// ================================
// IMAGE PATHS
// ================================

// Door-front images (your current naming)
function doorFrontPath(day) {
  const n = String(day).padStart(2, "0");
  return `assets/img/doors/Door${n}-Blue.png`;
}

// "Inside the door" image helper (supports many filename styles)
// Priority:
// 1) If days.json provides image path, use it.
// 2) Else fallback to assets/img/inside/day##.jpg or .png (if you want that pattern)
function insideImageFallback(day) {
  const n = String(day).padStart(2, "0");
  // you can change these defaults if you like:
  return `assets/img/inside/day${n}.jpg`;
}

// ================================
// PREVIEW BADGE
// ================================
function addPreviewBadge() {
  if (!PREVIEW_MODE) return;
  const badge = document.createElement("div");
  badge.textContent = "PREVIEW MODE (?preview=1)";
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
    const data = DAYS_DATA.find(d => d.day === day) || { day, title: `Day ${day}`, html: "<p>Surprise awaits!</p>" };
    const unlocked = isUnlocked(day);

    const btn = document.createElement("button");
    btn.className = "door" + (unlocked ? "" : " locked") + (state.done.has(day) ? " done" : "");
    btn.dataset.day = day;

    btn.innerHTML = `
      <div class="door-inner">
        <span class="day-badge">${day}</span>
        <div class="door-art">
          <img src="${doorFrontPath(day)}" alt="Christmas door for day ${day}" loading="lazy">
        </div>
      </div>
    `;

    btn.addEventListener("click", () => openDay(day, unlocked, data));
    $cal.appendChild(btn);
  });
}

// ================================
// MODAL CONTENT BUILDER
// Makes it work "like Halloween"
// ================================
function escapeAttr(s) {
  return String(s || "").replace(/"/g, "&quot;");
}

function buildModalHTML(day, data) {
  // If your days.json already has full HTML, use it directly
  if (data.html && typeof data.html === "string" && data.html.trim().length > 0) {
    return data.html;
  }

  // Otherwise support Halloween-style fields:
  // data.image OR data.img OR data.activityImage
  const img =
    data.image ||
    data.img ||
    data.activityImage ||
    insideImageFallback(day);

  const caption = data.caption || data.description || "";

  // Optional Halloween-style links/buttons
  const bonusHref = data.bonusHref || (data.bonus && data.bonus.href) || "";
  const bonusLabel = data.bonusLabel || (data.bonus && data.bonus.label) || "Daily Bonuses";

  const activityHref = data.activityHref || (data.activity && data.activity.href) || "";
  const activityLabel = data.activityLabel || (data.activity && data.activity.label) || "Go to activity";

  // Build HTML similar to your screenshot (big image + two buttons)
  const buttons = `
    <div style="display:flex; justify-content:space-between; gap:12px; margin-top:14px; flex-wrap:wrap;">
      ${bonusHref ? `<a href="${escapeAttr(bonusHref)}" target="_blank" rel="noopener"
        style="text-decoration:none; background:#ff8a00; color:#000; padding:12px 16px; border-radius:12px; font-weight:700; display:inline-block;">
        ${bonusLabel}
      </a>` : ""}

      ${activityHref ? `<a href="${escapeAttr(activityHref)}" target="_blank" rel="noopener"
        style="text-decoration:none; background:#ff8a00; color:#000; padding:12px 16px; border-radius:12px; font-weight:700; display:inline-block; margin-left:auto;">
        ${activityLabel}
      </a>` : ""}
    </div>
  `;

  return `
    <img src="${escapeAttr(img)}"
         alt="Day ${day} activity"
         style="max-width:100%; border-radius:14px; display:block; margin-bottom:12px;">
    ${caption ? `<p style="margin:0 0 8px 0;">${caption}</p>` : ""}
    ${bonusHref || activityHref ? buttons : ""}
  `;
}

function openDay(day, unlocked, data) {
  if (!unlocked) return;

  currentDay = day;
  // Default title style like your Halloween modal
  const title = data.modalTitle || data.title || `Day ${day} Activity`;
  $modalTitle.textContent = title;

  $modalContent.innerHTML = buildModalHTML(day, data);
  $modal.showModal();
}

// ================================
// MODAL BUTTONS (Mark done / Share)
// ================================
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
    await navigator.share({ title: "Advent Calendar", text: `I opened Day ${currentDay}!`, url });
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