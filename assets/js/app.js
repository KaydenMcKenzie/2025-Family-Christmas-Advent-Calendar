const TZ = "America/Toronto";
const START_MONTH = 12; // December
const START_DAY = 1;    // Dec 1
const DAYS = 25;        // Or 24 if desired

const $cal = document.getElementById("calendar");
const $modal = document.getElementById("modal");
const $modalTitle = document.getElementById("modalTitle");
const $modalContent = document.getElementById("modalContent");
const $close = $modal.querySelector(".close");
const $mark = $modal.querySelector(".mark-done");
const $share = $modal.querySelector(".share");
const $bgm = document.getElementById("bgm");
const $mute = document.getElementById("muteToggle");

let DAYS_DATA = [];
let currentDay = null;

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

async function fetchDays(){
  const res = await fetch("data/days.json");
  DAYS_DATA = await res.json();
}

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

function applyMusic(){
  if(state.muted){ $bgm.pause(); $mute.setAttribute("aria-pressed","false"); }
  else { $bgm.play().catch(()=>{}); $mute.setAttribute("aria-pressed","true"); }
}
$mute.addEventListener("click", ()=>{
  state.muted = !state.muted; save(); applyMusic();
});

(async function init(){
  try{
    await fetchDays();
  }catch(e){ console.warn("days.json missing or invalid", e); }
  renderDoors();
  applyMusic();
})();