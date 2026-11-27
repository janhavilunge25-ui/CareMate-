/* Shared theme + settings for every page. Dark mode is applied to the whole page so every word stays readable. */
(function () {
  let S = {}; try { S = JSON.parse(localStorage.getItem('careMateSettings') || '{}') || {}; } catch (e) {}
  window.cmSettings = S;
  const root = document.documentElement;
  window.cmApply = function () {
    const dark = S.theme === 'dark' || (S.theme === 'auto' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    root.dataset.theme = dark ? 'dark' : 'light'; root.dataset.fs = S.fs || 'md';
    root.classList.toggle('st-hide-quote', S.quote === false); root.classList.toggle('st-calm', !!S.calm);
    document.querySelectorAll('.pf-theme i').forEach(i => { i.className = 'fa-solid ' + (dark ? 'fa-sun' : 'fa-moon'); });
  };
  window.cmSave = function () { try { localStorage.setItem('careMateSettings', JSON.stringify(S)); } catch (e) {} window.cmApply(); };
  window.cmToggleTheme = function () { S.theme = root.dataset.theme === 'dark' ? 'light' : 'dark'; window.cmSave(); };
  window.cmApply();
  document.addEventListener('DOMContentLoaded', function () {
    /* home page: add the theme button to the menu */
    const ul = document.querySelector('header nav ul');
    if (ul && !document.querySelector('.pf-theme')) {
      const li = document.createElement('li'), b = document.createElement('button');
      b.type = 'button'; b.className = 'pf-ico pf-theme'; b.setAttribute('aria-label', 'Switch light or dark theme'); b.title = 'Light / dark theme';
      b.innerHTML = '<i class="fa-solid fa-moon"></i>'; b.addEventListener('click', window.cmToggleTheme);
      li.appendChild(b); ul.insertBefore(li, ul.firstChild);
    }
    window.cmApply();
  });
})();

/* ---- Soft reminder sounds (synthesised, no files needed) + user's own music ---- */
(function () {
  const TONES = {
    chime: { name: 'Soft chime',   notes: [[784, 0], [988, .25], [1175, .5]], type: 'sine', len: 1.4 },
    bells: { name: 'Gentle bells', notes: [[659, 0], [523, .35], [784, .7]],  type: 'triangle', len: 1.8 },
    harp:  { name: 'Calm harp',    notes: [[392, 0], [494, .18], [587, .36], [784, .54]], type: 'sine', len: 1.6 },
    drop:  { name: 'Water drop',   notes: [[880, 0], [660, .22]], type: 'sine', len: 1.0 }
  };
  window.cmTones = TONES;
  let ctx = null, cur = null;
  window.cmStopTone = function () { try { if (cur) { cur.pause(); cur = null; } } catch (e) {} };
  window.cmPlayTone = function (id) {
    const S = window.cmSettings || {};
    id = id || S.tone || 'chime';
    if (id === 'off') return;
    window.cmStopTone();
    try {
      if (id === 'custom') {
        if (!S.toneData) id = 'chime';
        else { cur = new Audio(S.toneData); cur.volume = .7; cur.play().catch(function () {}); setTimeout(window.cmStopTone, 15000); return; }
      }
      const T = TONES[id] || TONES.chime, AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = ctx || new AC(); if (ctx.state === 'suspended') ctx.resume();
      const t0 = ctx.currentTime + .02;
      T.notes.forEach(function (n) {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = T.type; o.frequency.value = n[0];
        g.gain.setValueAtTime(0, t0 + n[1]);
        g.gain.linearRampToValueAtTime(.22, t0 + n[1] + .04);
        g.gain.exponentialRampToValueAtTime(.0008, t0 + n[1] + T.len * .7);
        o.connect(g); g.connect(ctx.destination);
        o.start(t0 + n[1]); o.stop(t0 + n[1] + T.len);
      });
    } catch (e) {}
  };
})();


/* ---- Reminder notifications: works on phones (Android needs the service worker) and desktop ---- */
(function () {
  window.cmNotifyOn = function () {
    var S = window.cmSettings || {};
    return S.notify !== false && 'Notification' in window && Notification.permission === 'granted';
  };
  window.cmNotify = function (body) {
    if (!window.cmNotifyOn()) return;
    var opts = { body: body, icon: 'logo-small.png', tag: 'caremate-' + body, renotify: true, vibrate: [200, 100, 200] };
    var fallback = function () { try { new Notification('CareMate', opts); } catch (e) {} };
    try {
      if (navigator.serviceWorker && navigator.serviceWorker.getRegistration) {
        navigator.serviceWorker.getRegistration().then(function (r) { r ? r.showNotification('CareMate', opts) : fallback(); }).catch(fallback);
      } else fallback();
    } catch (e) { fallback(); }
  };
  /* ask for permission, then say whether reminders can pop up. cb(true/false, message) */
  window.cmEnableNotify = function (cb) {
    var S = window.cmSettings || {};
    if (!('Notification' in window)) { cb(false, 'This browser cannot show notifications. Reminders will show inside the app and play a sound.'); return; }
    var fired = false;
    var done = function (p) {
      if (fired) return; fired = true;
      if (p === 'granted') { S.notify = true; window.cmSave(); cb(true, 'Reminder notifications are on.'); window.cmNotify('Reminders are on. This is a test.'); }
      else { cb(false, 'Notifications are blocked. Allow them for this site in your browser settings, then try again.'); }
    };
    if (Notification.permission === 'granted') return done('granted');
    if (Notification.permission === 'denied') return done('denied');
    var r = Notification.requestPermission(function (p) { done(p); });
    if (r && r.then) r.then(done);
  };
})();
