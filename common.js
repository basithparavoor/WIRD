// common utilities for multi-page Adkar app
const LS_KEYS = {
  adkars: 'adkars_v1',
  prev: 'prev_uncompleted_v1',
  lastReset: 'last_reset_date_v1',
  theme: 'theme_v1',
  fontScale: 'font_scale_v1'
};

function todayStr(d=new Date()){
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}
function yesterdayStr(){
  const d = new Date();
  d.setDate(d.getDate()-1);
  return todayStr(d);
}

function loadAdkars(){
  try { return JSON.parse(localStorage.getItem(LS_KEYS.adkars) || '[]'); } catch(e){ return []; }
}
function saveAdkars(list){ localStorage.setItem(LS_KEYS.adkars, JSON.stringify(list)); }

// Reset logic: run on each page load
function ensureResetMulti(){
  const last = localStorage.getItem(LS_KEYS.lastReset);
  const today = todayStr();
  if(last === today) return;
  const adkars = loadAdkars();
  // move uncompleted items dated exactly yesterday to prev
  const prev = [];
  const remaining = [];
  const y = yesterdayStr();
  for(const it of adkars){
    if(!it.completed && it.date === y){
      prev.push(it);
    }
    // completed items clear at midnight
    if(it.completed){
      // skip (clear)
    } else {
      remaining.push(it);
    }
  }
  if(prev.length) localStorage.setItem(LS_KEYS.prev, JSON.stringify(prev));
  else localStorage.removeItem(LS_KEYS.prev);
  localStorage.setItem(LS_KEYS.lastReset, today);
  saveAdkars(remaining);
}

// Theme handling
function applyThemeFromStorage(){
  const t = localStorage.getItem(LS_KEYS.theme) || 'dark';
  if(t === 'light') document.documentElement.classList.add('light');
  else document.documentElement.classList.remove('light');
}

// font size
function applyFontFromStorage(){
  const fs = parseFloat(localStorage.getItem(LS_KEYS.fontScale) || '1');
  document.documentElement.style.setProperty('--font-scale', fs);
}

// small escape
function escapeHtml(s){
  return String(s)
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;');
}

// call on load
ensureResetMulti();
applyThemeFromStorage();
applyFontFromStorage();
