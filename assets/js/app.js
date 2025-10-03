// ---------------- Core calendar config ----------------
const TZ = "America/Toronto";
const START_MONTH = 12; // December
const START_DAY = 1;    // Dec 1
const DAYS = 25;        // or 24 if preferred

// ---------------- Element refs ----------------
const $cal = document.getElementById("calendar");
const $modal = document.getElementById("modal");
const $modalTitle = document.getElementById("modalTitle");
const $modalContent = document.getElementById("modalContent");
const $close = $modal.querySelector(".close");
const $mark = $modal.querySelector(".mark-done");
const $share = $modal.querySelector(".share");
const $bgm = document.getElementById("bgm");
const $mute = document.getElementById("muteToggle");
const $snowBtn = document.getElementById("snowToggle");

let DAYS_DATA = [];
let currentDay = null;

// ---------------- State + helpers ----------------
const state = {
  done: new Set(JSON.parse(localStorage.getItem("advent_done")||"[]")),
  muted: JSON.parse(localStorage.getItem("advent_muted")||"true")
};

function todayInTZ(){
  const now = new Date();
  const str = now.toLocaleString("en-CA", { timeZone: TZ });
  return new Date(str);
}

function isUnlocked(day){
  const t = todayInTZ();
  const unlockDate = new Date(t.getFullYear(), START_MONTH-1, START_DAY + (day-1));
  return t >= unlockDate;
}

function save(){
  localStorage.setItem("advent_done", JSON.stringify([...state.done]));
  localStorage.setItem("advent_muted", JSON.stringify(state.muted));
}

// ---------------- Data loading ----------------
async function fetchDays(){
  const res = await fetch("data/days.json");
  DAYS_DATA = await res.json();
}

// ---------------- Render doors ----------------
function renderDoors(){
  $cal.innerHTML = "";
  for(let i=1;i<=DAYS;i++){
    const data = DAYS_DATA.find(d=>d.day===i) || {day:i,title:`Day ${i}`,html:"<p>Surprise awaits!</p>"};
    const unlocked = isUnlocked(i);
    const div = document.createElement("button");
    div.className = "door" + (unlocked ? "" : " locked") + (state.done.has(i) ? " done" : "");
    div.setAttribute("role","gridcell");
    div.setAttribute("aria-disabled", unlocked ? "false" : "true");
    div.dataset.day = i;
    div.innerHTML = `
      <div class="num">${i}</div>
      <div class="label">${data.title}</div>
    `;
    div.addEventListener("click", ()=> openDay(i, unlocked, data));
    $cal.appendChild(div);
  }
}

function openDay(i, unlocked, data){
  if(!unlocked) return;
  currentDay = i;
  $modalTitle.textContent = `Day ${i}: ${data.title}`;
  $modalContent.innerHTML = data.html + (data.cta ? `<p><a href="${data.cta.href}" target="_blank" rel="noopener">${data.cta.label}</a></p>`:"");
  $modal.showModal();
}

// ---------------- Modal + share ----------------
$close.addEventListener("click", ()=> $modal.close());
$mark.addEventListener("click", ()=>{
  if(currentDay){ state.done.add(currentDay); save(); renderDoors(); }
  $modal.close();
});
$share.addEventListener("click", async ()=>{
  if(!currentDay) return;
  const url = location.href.split("#")[0] + `#day=${currentDay}`;
  if(navigator.share){ await navigator.share({title:"Advent Calendar", text:`I opened Day ${currentDay}!`, url}); }
  else { navigator.clipboard.writeText(url); alert("Link copied!"); }
});

// ---------------- Music toggle ----------------
function applyMusic(){
  if(state.muted){ $bgm.pause(); $mute?.setAttribute("aria-pressed","false"); }
  else { $bgm.play().catch(()=>{}); $mute?.setAttribute("aria-pressed","true"); }
}
$mute?.addEventListener("click", ()=>{
  state.muted = !state.muted; save(); applyMusic();
});

// ---------------- Snowfall with pile (layered + shimmer + toggle + Dec default) ----------------
(() => {
  const canvas = document.getElementById("snowCanvas");
  if (!canvas || !$snowBtn) return;

  const ctx = canvas.getContext("2d");
  let rafId = null;

  // Default ON only in December (if no saved preference yet)
  const LS_KEY = "advent_snow";
  const isDecember = todayInTZ().getMonth() === 11;
  let snowEnabled = JSON.parse(localStorage.getItem(LS_KEY) ?? (isDecember ? "true" : "false"));

  // Flake layers for depth
  const layers = [
    { count: 60,  size:[0.7,1.6], speed:[0.25,0.6], drift:0.25, alpha:[0.15,0.35] },
    { count: 80,  size:[1.3,2.4], speed:[0.45,0.9], drift:0.45, alpha:[0.25,0.55] },
    { count: 70,  size:[2.0,3.4], speed:[0.8,1.4],  drift:0.65, alpha:[0.35,0.75] }
  ];
  let flakes = [];

  // Snow pile height-map across the bottom
  let cols = 160;             // columns in the height-map (performance-friendly)
  let pile = new Array(cols).fill(0); // heights in pixels
  let maxPileFrac = 0.35;     // max pile height as a fraction of canvas height

  function colWidth(){ return canvas.width / cols; }
  function xToCol(x){ 
    let c = Math.floor(x / colWidth());
    return Math.min(cols-1, Math.max(0, c));
  }

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    // Recreate flakes and reset pile (simplest + robust)
    seedFlakes();
    cols = Math.max(80, Math.min(240, Math.round(canvas.width / 10)));
    pile = new Array(cols).fill(0);
  }
  function rand(a,b){ return a + Math.random()*(b-a); }

  function seedFlakes(){
    flakes = [];
    for (const L of layers) {
      for (let i=0;i<L.count;i++){
        flakes.push({
          x: Math.random()*canvas.width,
          y: Math.random()*canvas.height,
          r: rand(L.size[0], L.size[1]),
          vy: rand(L.speed[0], L.speed[1]),
          drift: L.drift,
          alphaBase: rand(L.alpha[0], L.alpha[1]),
          twinkle: Math.random()*Math.PI*2,
          twinkleSpeed: rand(0.004, 0.012)
        });
      }
    }
  }

  function pileHeightAtX(x){
    // Sample height-map with simple linear interpolation between columns
    const c = xToCol(x);
    const cw = colWidth();
    const leftEdge = c * cw;
    const t = Math.min(1, Math.max(0, (x - leftEdge) / cw));
    const h0 = pile[c];
    const h1 = pile[Math.min(cols-1, c+1)];
    return h0*(1-t) + h1*t;
  }

  function depositAtX(x, amount){
    // Spread deposit to neighbor columns for a natural shape
    const c = xToCol(x);
    const spread = [0.5, 0.25, 0.125]; // center, 1-away, 2-away
    const maxH = canvas.height * maxPileFrac;

    function addTo(col, amt){
      if (col < 0 || col >= cols) return;
      pile[col] = Math.min(maxH, pile[col] + amt);
    }
    addTo(c, amount * spread[0]);
    addTo(c-1, amount * spread[1]);
    addTo(c+1, amount * spread[1]);
    addTo(c-2, amount * spread[2]);
    addTo(c+2, amount * spread[2]);

    // Gentle smoothing
    for (let i = Math.max(1, c-3); i <= Math.min(cols-2, c+3); i++){
      pile[i] = (pile[i-1] + pile[i] + pile[i+1]) / 3;
    }
  }

  function drawPile(){
    const hMax = canvas.height * maxPileFrac;

    // Draw gentle shadow for separation from background
    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,0.96)";
    ctx.shadowColor = "rgba(255,255,255,0.9)";
    ctx.shadowBlur = 12;

    ctx.beginPath();
    ctx.moveTo(0, canvas.height);
    // Trace the top contour of the pile
    const cw = colWidth();
    for(let i=0; i<cols; i++){
      const x = i * cw;
      const h = Math.min(hMax, pile[i]);
      ctx.lineTo(x, canvas.height - h);
    }
    ctx.lineTo(canvas.width, canvas.height);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Add a soft highlight near the ridge for depth
    ctx.save();
    ctx.globalAlpha = 0.25;
    const grad = ctx.createLinearGradient(0, canvas.height - hMax, 0, canvas.height);
    grad.addColorStop(0, "rgba(255,255,255,0.9)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = grad;

    ctx.beginPath();
    ctx.moveTo(0, canvas.height);
    for(let i=0; i<cols; i++){
      const x = i * cw;
      const h = Math.min(hMax, pile[i]);
      ctx.lineTo(x, canvas.height - h);
    }
    ctx.lineTo(canvas.width, canvas.height);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function draw(){
    ctx.clearRect(0,0,canvas.width,canvas.height);

    // Draw flakes and handle collisions/deposits
    for (const f of flakes){
      f.twinkle += f.twinkleSpeed;
      const a = f.alphaBase + Math.sin(f.twinkle)*0.15;

      // compute local pile height
      const localPile = pileHeightAtX(f.x);
      const groundY = canvas.height - localPile;

      // If flake hits the pile or the hard ground, deposit & respawn
      if (f.y + f.r >= groundY){
        depositAtX(f.x, f.r * 1.1); // deposit proportional to radius
        // Respawn flake at top
        f.y = -5;
        f.x = Math.random()*canvas.width;
      } else {
        // draw flake (glow + fill)
        ctx.save();
        ctx.globalAlpha = Math.max(0.05, Math.min(1, a));
        ctx.shadowColor = "rgba(255,255,255,0.9)";
        ctx.shadowBlur = f.r * 2.5;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r, 0, Math.PI*2);
        ctx.fillStyle = "rgba(255,255,255,1)";
        ctx.fill();
        ctx.restore();

        // update motion
        f.y += f.vy;
        f.x += Math.sin(f.y*0.015) * f.drift;
      }

      // recycle horizontally if drifting off-screen
      if (f.x < -10) f.x = canvas.width + 10;
      if (f.x > canvas.width + 10) f.x = -10;
    }

    // Draw the accumulated pile **after** flakes for layering
    drawPile();

    rafId = requestAnimationFrame(draw);
  }

  function start(){
    if (rafId) return;
    resize();
    rafId = requestAnimationFrame(draw);
    $snowBtn.setAttribute("aria-pressed","true");
  }
  function stop(){
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    ctx.clearRect(0,0,canvas.width,canvas.height);
    $snowBtn.setAttribute("aria-pressed","false");
  }

  function apply(){
    if (snowEnabled) start(); else stop();
    localStorage.setItem(LS_KEY, JSON.stringify(snowEnabled));
  }

  $snowBtn.addEventListener("click", () => {
    snowEnabled = !snowEnabled;
    apply();
  });
  window.addEventListener("resize", () => { if (rafId) resize(); });

  apply();
})();

// ---------------- Init ----------------
(async function init(){
  try{
    await fetchDays();
  }catch(e){ console.warn("days.json missing or invalid", e); }
  renderDoors();
  applyMusic();
})();