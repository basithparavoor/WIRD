// common.js  (replace existing file)
// Utilities shared across pages: storage keys, scheduling, notification helpers.

const LS_KEYS = {
  adkars: 'adkars_v2',              // bumped schema to support days/time/notify
  prev: 'prev_uncompleted_v1',
  lastReset: 'last_reset_date_v1',
  theme: 'theme_v1',
  fontScale: 'font_scale_v1',
  fired: 'notify_fired_v1'          // notifications already fired today
};

const WEEKDAYS = ['sun','mon','tue','wed','thu','fri','sat'];

function todayStr(d=new Date()){
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}
function yesterdayStr(){
  const d = new Date();
  d.setDate(d.getDate()-1);
  return todayStr(d);
}
function weekdayIndex(date=new Date()){
  return date.getDay(); // 0=Sun ... 6=Sat
}

// load/save adkars with safe defaults
function loadAdkars(){
  try {
    const raw = localStorage.getItem(LS_KEYS.adkars);
    const list = raw ? JSON.parse(raw) : [];
    // normalize older items
    for (const it of list){
      if(!('days' in it)) it.days = ['every'];
      if(!('time' in it)) it.time = '';
      if(!('notify' in it)) it.notify = false;
      if(!('category' in it)) it.category = it.category || 'daily';
      if(!('type' in it)) it.type = it.type || 'task';
    }
    return list;
  } catch(e){ return []; }
}
function saveAdkars(list){ localStorage.setItem(LS_KEYS.adkars, JSON.stringify(list)); }

// Reset logic executed once per day (on page load)
function ensureResetMulti(){
  const last = localStorage.getItem(LS_KEYS.lastReset);
  const today = todayStr();
  if(last === today) return;
  const adkars = loadAdkars();
  const prev = [];
  const remaining = [];
  const y = yesterdayStr();
  for(const it of adkars){
    // move uncompleted items dated exactly yesterday to prev
    if(!it.completed && it.date === y){
      prev.push(it);
    }
    // completed items clear at midnight, others remain for today if their date is today or schedule indicates
    if(it.completed){
      // skip (clear)
    } else {
      // We keep items, but if they were created for a specific date, you may want different logic.
      remaining.push(it);
    }
  }
  if(prev.length) localStorage.setItem(LS_KEYS.prev, JSON.stringify(prev));
  else localStorage.removeItem(LS_KEYS.prev);
  localStorage.setItem(LS_KEYS.lastReset, today);
  saveAdkars(remaining);
  // clear today's fired notifications marker so notifications can re-fire tomorrow
  localStorage.removeItem(LS_KEYS.fired);
}

// theme + font
function applyThemeFromStorage(){
  const t = localStorage.getItem(LS_KEYS.theme) || 'dark';
  if(t === 'light') document.documentElement.classList.add('light');
  else document.documentElement.classList.remove('light');
}
function applyFontFromStorage(){
  const fs = parseFloat(localStorage.getItem(LS_KEYS.fontScale) || '1');
  document.documentElement.style.setProperty('--font-scale', fs);
}

// small safe-escape
function escapeHtml(s){
  return String(s || '')
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;');
}

// Scheduling helpers
function isForToday(item, now=new Date()){
  // item.days: ['every'] or ['mon','fri',...]
  if(item.days && !item.days.includes('every')){
    const w = WEEKDAYS[weekdayIndex(now)];
    return item.days.includes(w);
  }
  return true;
}
function timeToMinutes(t){ // "HH:MM" -> total minutes or null
  if(!t || !/^\d{1,2}:\d{2}$/.test(t)) return null;
  const [h,m] = t.split(':').map(n=>parseInt(n,10));
  if(isNaN(h)||isNaN(m)) return null;
  return h*60+m;
}
function minutesNow(now=new Date()){
  return now.getHours()*60 + now.getMinutes();
}

// Notification helpers
async function ensureNotificationSetup(){
  try{
    if('serviceWorker' in navigator){
      navigator.serviceWorker.register('sw.js').catch(()=>{ /* ignore */ });
    }
    // do not auto-request permission here; pages call requestNotifyPermission() explicitly when needed
    return 'Notification' in window;
  }catch(e){ return false; }
}
async function requestNotifyPermission(){
  if(!('Notification' in window)) { alert('Notifications not supported by this browser.'); return false; }
  if(Notification.permission === 'granted') return true;
  if(Notification.permission === 'denied'){ alert('Notifications are blocked for this site in browser settings.'); return false; }
  const res = await Notification.requestPermission();
  return res === 'granted';
}
function fireNotification(title, body){
  try{
    if(Notification.permission !== 'granted') return;
    const options = { body, icon: 'icons/192.png', badge: 'icons/192.png' };
    if(navigator.serviceWorker && navigator.serviceWorker.ready){
      navigator.serviceWorker.ready.then(reg => reg.showNotification(title, options)).catch(()=>new Notification(title, options));
    }else{
      new Notification(title, options);
    }
  }catch(e){}
}

// Ticker to fire notifications while a page is open (checks every 60s)
function startNotifyTicker(){
  if(!('Notification' in window)) return;
  const tick = ()=>{
    if(Notification.permission !== 'granted') return;
    const now = new Date();
    const nowMin = minutesNow(now);
    const today = todayStr(now);
    const firedRaw = localStorage.getItem(LS_KEYS.fired) || '[]';
    const fired = new Set(JSON.parse(firedRaw));
    const items = loadAdkars().filter(it =>
      !it.completed &&
      // either created/assigned for today or general scheduled for every day / weekday
      (it.date === today || isForToday(it, now)) &&
      it.notify && it.time
    );
    for(const it of items){
      const tmin = timeToMinutes(it.time);
      if(tmin === null) continue;
      const key = it.id + '@' + today;
      if(nowMin >= tmin && !fired.has(key)){
        fireNotification(it.title, it.details ? it.details.slice(0,120)+'…' : 'Time for this adkar.');
        fired.add(key);
      }
    }
    localStorage.setItem(LS_KEYS.fired, JSON.stringify(Array.from(fired)));
  };
  tick();
  setInterval(tick, 60*1000);
}

// Run initializers on load
ensureResetMulti();
applyThemeFromStorage();
applyFontFromStorage();
ensureNotificationSetup(); // registers SW if possible

// Export utilities for pages
window.AdkarUtils = {
  LS_KEYS, WEEKDAYS, todayStr, yesterdayStr, isForToday, timeToMinutes, minutesNow,
  requestNotifyPermission, startNotifyTicker, loadAdkars, saveAdkars, escapeHtml
};
