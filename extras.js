/* Profile page extras: back button, women-only conditions, privacy & security (PIN lock, idle lock, delete data) */
(function () {
  const $ = id => document.getElementById(id);
  const WOMEN = ['pcod', 'pcos', 'pregnancy'];

  /* Back: from the plan go to the form, from the form go to the home page */
  const back = $('pfBack');
  if (back) back.addEventListener('click', () => {
    const card = $('cmCard');
    if (card && !card.hidden) CareMatePlan.hide(); else window.location.href = 'index.html';
  });

  /* Men do not see PCOD, PCOS or pregnancy */
  const g = $('gender'), c = $('condition');
  function filterConditions() {
    if (!g || !c) return;
    const male = g.value === 'Male';
    Array.from(c.options).forEach(o => { if (WOMEN.includes(o.value)) { o.hidden = male; o.disabled = male; } });
    if (male && WOMEN.includes(c.value)) c.value = '';
  }
  if (g) { g.addEventListener('change', filterConditions); filterConditions(); }

  /* Returning user: open the saved plan straight away (from the home page "Continue" button) */
  try {
    const sp = JSON.parse(localStorage.getItem('careMateProfile') || 'null');
    if (location.hash === '#plan' && sp && sp.goals && sp.goals.length) setTimeout(() => CareMatePlan.show(sp), 0);
  } catch (e) {}

  /* App-style bottom bar: Home, Plan, +, Care, Profile */
  const nav = document.createElement('nav'); nav.className = 'bn'; nav.setAttribute('aria-label', 'Quick menu');
  nav.innerHTML = '<a href="index.html" data-home><i class="fa-solid fa-house"></i>Home</a><button type="button" data-a="plan"><i class="fa-solid fa-chart-pie"></i>Plan</button><button type="button" class="plus" data-a="plus" aria-label="Quick actions"><i class="fa-solid fa-plus"></i></button><button type="button" data-a="care"><i class="fa-solid fa-user-doctor"></i>Care</button><button type="button" data-a="shop"><i class="fa-solid fa-basket-shopping"></i>Shopping</button>';
  const pop = document.createElement('div'); pop.className = 'bn-pop'; pop.hidden = true;
  pop.innerHTML = '<button type="button" data-p="water"><i class="fa-solid fa-droplet"></i> Add a glass of water</button><button type="button" data-p="protein"><i class="fa-solid fa-egg"></i> Protein guide</button><button type="button" data-p="portion"><i class="fa-solid fa-scale-balanced"></i> Portion guide</button>';
  document.body.append(nav, pop);
  /* One-tap water: +1 glass for today. Works from any screen and shows up in Today's goals and the report. */
  function addWater() {
    const btn = document.querySelector('[data-act="inc"][data-id="water"]');
    if (btn) { btn.click(); return; }                                     // the plan is open: use its own counter
    const d = new Date(), k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    let log = {}, prof = {};
    try { log = JSON.parse(localStorage.getItem('careMateLog') || '{}') || {}; prof = JSON.parse(localStorage.getItem('careMateProfile') || '{}') || {}; } catch (e) {}
    const goal = Math.min(20, Math.max(1, parseInt(prof.waterGoal, 10) || 8)), day = log[k] || (log[k] = {});
    day.water = Math.min(goal + 4, (day.water || 0) + 1);
    try { localStorage.setItem('careMateLog', JSON.stringify(log)); } catch (e) {}
    CareMatePlan.say('Water: ' + day.water + ' of ' + goal + ' glasses');
  }
  const planOpen = () => { const c = $('cmCard'); return c && !c.hidden; };
  /* ---- Bottom sheet used by the Care and Shopping buttons ---- */
  const sheet = document.createElement('div'); sheet.className = 'bn-sheet'; sheet.hidden = true;
  sheet.innerHTML = '<div class="bn-sh-bg" data-sh="x"></div><div class="bn-sh-card" role="dialog" aria-modal="true" aria-labelledby="bnShT"><div class="bn-sh-head"><h3 id="bnShT"></h3><button type="button" class="bn-sh-x" data-sh="x" aria-label="Close"><i class="fa-solid fa-xmark"></i></button></div><div class="bn-sh-body"></div></div>';
  document.body.append(sheet);
  const shBody = sheet.querySelector('.bn-sh-body'), shTitle = sheet.querySelector('#bnShT');
  let shFrom = null;
  function openSheet(title, fill) { shFrom = document.activeElement; shTitle.textContent = title; shBody.innerHTML = ''; fill(shBody); sheet.hidden = false; sheet.querySelector('.bn-sh-x').focus(); }
  function closeSheet() { sheet.hidden = true; shBody.onchange = shBody.onclick = null; if (shFrom && shFrom.focus) shFrom.focus(); }
  sheet.addEventListener('click', e => { if (e.target.closest('[data-sh="x"]')) closeSheet(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !sheet.hidden) closeSheet(); });
  const WA = '919096066204', PHONE = '+919096066204';
  function careSheet(box) {
    const tab = document.querySelector('.cm-tab[data-id="dietitian"]');
    box.innerHTML = '<p class="bn-sh-sub">Choose how you would like help.</p>' +
      '<button type="button" class="bn-opt" data-c="chat"><i class="fa-solid fa-comment-dots"></i><span><b>Ask the CareMate helper</b><small>Quick answers about food, yoga and your plan</small></span></button>' +
      '<a class="bn-opt" href="https://wa.me/' + WA + '?text=' + encodeURIComponent('Hello, I have a question from CareMate.') + '" target="_blank" rel="noopener"><i class="fa-brands fa-whatsapp"></i><span><b>Message the dietitian</b><small>WhatsApp, for diet questions</small></span></a>' +
      '<a class="bn-opt" href="tel:' + PHONE + '"><i class="fa-solid fa-phone"></i><span><b>Call the dietitian</b><small>9096 066 204</small></span></a>' +
      (tab && planOpen() ? '<button type="button" class="bn-opt" data-c="tab"><i class="fa-solid fa-user-doctor"></i><span><b>Open my Care tab</b><small>Contact details and a ready message</small></span></button>' : '') +
      '<p class="bn-sh-warn"><i class="fa-solid fa-triangle-exclamation"></i> In an emergency call 112 or 108 right away. CareMate does not give emergency or diagnostic advice.</p>';
    box.onclick = e => {
      const b = e.target.closest('[data-c]'); if (!b) return;
      closeSheet();
      if (b.dataset.c === 'chat') document.querySelector('.cb-fab').click();
      if (b.dataset.c === 'tab' && tab) tab.click();
    };
  }
  nav.addEventListener('click', ev => { const b = ev.target.closest('[data-a]'); if (!b) return; pop.hidden = b.dataset.a === 'plus' ? !pop.hidden : true;
    const a = b.dataset.a;
    if (a === 'plan') { if (planOpen()) window.scrollTo({ top: 0, behavior: 'smooth' }); else document.querySelector('#profileForm button[type=submit]').click(); }
    if (a === 'care') openSheet('Care', careSheet);
    if (a === 'shop') openSheet('Weekly shopping list', box => window.cmShopping ? cmShopping.render(box) : (box.textContent = 'Shopping list is not available.')); });
  pop.addEventListener('click', ev => { const b = ev.target.closest('[data-p]'); if (!b) return; pop.hidden = true;
    if (b.dataset.p === 'water') addWater();
    if (b.dataset.p === 'protein') openSheet('Protein guide', box => window.cmGuides ? cmGuides.render('protein', box) : (box.textContent = 'Not available.'));
    if (b.dataset.p === 'portion') openSheet('Portion guide', box => window.cmGuides ? cmGuides.render('portion', box) : (box.textContent = 'Not available.')); });

  /* ---- Settings panel + header buttons ---- */
  const S = window.cmSettings, right = document.querySelector('.pf-right');
  if (right) {
    const mk = (cls, ic, label, fn) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'pf-ico ' + cls; b.setAttribute('aria-label', label); b.title = label; b.innerHTML = '<i class="fa-solid ' + ic + '"></i>'; b.addEventListener('click', fn); right.insertBefore(b, right.firstChild); };
    const av = document.createElement('button'); av.type = 'button'; av.className = 'pf-dp'; av.setAttribute('aria-label', 'My profile and settings'); av.title = 'My profile & settings'; av.addEventListener('click', () => openSettings()); right.appendChild(av);
    mk('pf-theme', 'fa-moon', 'Switch light or dark theme', () => window.cmToggleTheme());
  }
  window.cmApply();
  const sp = document.createElement('div'); sp.className = 'sec-panel st-card'; sp.hidden = true;
  sp.innerHTML = '<div class="sec-card" role="dialog" aria-modal="true" aria-label="Settings"><div class="st-top"><h3><i class="fa-solid fa-gear"></i> Settings</h3><button type="button" class="st-x" data-g="x" aria-label="Close settings"><i class="fa-solid fa-xmark"></i></button></div>' +
    '<div class="st-me"><button type="button" class="st-dp" data-g="dpmenu" aria-label="Change profile photo"><span class="st-dpimg"></span><span class="st-cam"><i class="fa-solid fa-camera"></i></span></button>' +
    '<div class="st-who"><b id="stName">Your name</b><small id="stId">ID</small></div></div>' +
    '<div class="st-dpm" hidden><button type="button" data-g="gal"><i class="fa-solid fa-image"></i> Choose from gallery</button><button type="button" data-g="cam"><i class="fa-solid fa-camera"></i> Take photo</button><button type="button" data-g="del" class="st-del"><i class="fa-solid fa-trash"></i> Remove photo</button></div>' +
    '<input type="file" id="stGal" accept="image/*" hidden><input type="file" id="stCam" accept="image/*" capture="user" hidden>' +
    '<label class="st-lab" for="stNameIn">Name</label><input id="stNameIn" class="st-in" maxlength="40" autocomplete="name">' +
    '<div class="st-h">Reminders</div>' +
    '<div class="st-row"><span>Reminder notifications</span><button type="button" class="st-sw" data-t="notify" aria-label="Reminder notifications"></button></div>' +
    '<small class="st-note" id="stNotifyMsg" role="status"></small>' +
    '<div class="st-row"><span>Reminder sound</span><select id="stTone" class="st-in st-sel" aria-label="Reminder sound"></select></div>' +
    '<div class="st-tbtns"><button type="button" data-g="play"><i class="fa-solid fa-play"></i> Preview</button><button type="button" data-g="music"><i class="fa-solid fa-music"></i> Use my own music</button></div>' +
    '<small class="st-note" id="stMusicNote"></small><input type="file" id="stMusic" accept="audio/*" hidden>' +
    '<div class="st-h">Comfort</div>' +
    '<div class="st-row"><span>Daily motivation quote</span><button type="button" class="st-sw" data-t="quote" aria-label="Daily quote"></button></div>' +
    '<div class="st-row"><span>Reduce animations</span><button type="button" class="st-sw" data-t="calm" aria-label="Reduce animations"></button></div>' +
    '<button type="button" class="act" data-g="edit"><i class="fa-solid fa-user-pen"></i> Edit my profile</button>' +
    '<button type="button" class="act" data-g="sec"><i class="fa-solid fa-shield-halved"></i> Privacy &amp; PIN lock</button>' +
    '<button type="button" class="act" data-g="pw"><i class="fa-solid fa-key"></i> Change password</button>' +
    '<button type="button" class="act" data-g="wa"><i class="fa-brands fa-whatsapp"></i> Message the dietitian</button>' +
    '<button type="button" class="act" data-g="out"><i class="fa-solid fa-arrow-right-from-bracket"></i> Log out</button>' +
    '<button type="button" class="danger" data-g="wipe">Delete all my data</button><button type="button" class="ghost" data-g="x">Close</button></div>';
  document.body.appendChild(sp);
  const on = k => k === 'quote' ? S.quote !== false : k === 'notify' ? S.notify !== false : !!S[k];
  const getU = () => { try { return JSON.parse(localStorage.getItem('careMateUser') || 'null') || {}; } catch (e) { return {}; } };
  const putU = u => { try { localStorage.setItem('careMateUser', JSON.stringify(u)); } catch (e) {} };
  const uid = () => getU().email || 'Not set';
  const toneSel = sp.querySelector('#stTone');
  toneSel.innerHTML = Object.keys(window.cmTones).map(k => '<option value="' + k + '">' + window.cmTones[k].name + '</option>').join('') + '<option value="custom">My own music</option><option value="off">Silent</option>';
  function paintHeaderDp() {
    const nm = (getU().name || '?');
    document.querySelectorAll('.pf-dp').forEach(b => { b.style.backgroundImage = S.dp ? 'url(' + S.dp + ')' : ''; b.textContent = S.dp ? '' : nm.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase(); });
  }
  function paintSettings() {
    const u = getU(), nm = (u.name || 'Your name');
    sp.querySelector('#stName').textContent = nm; sp.querySelector('#stId').textContent = 'User ID: ' + uid();
    if (document.activeElement !== sp.querySelector('#stNameIn')) sp.querySelector('#stNameIn').value = u.name || '';
    const im = sp.querySelector('.st-dpimg');
    if (S.dp) { im.style.backgroundImage = 'url(' + S.dp + ')'; im.textContent = ''; }
    else { im.style.backgroundImage = ''; im.textContent = nm.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?'; }
    sp.querySelector('[data-g=del]').hidden = !S.dp;
    paintHeaderDp();
    toneSel.value = (S.tone === 'custom' && !S.toneData) ? 'chime' : (S.tone || 'chime');
    sp.querySelector('#stMusicNote').textContent = S.toneData ? 'Your music: ' + (S.toneName || 'selected') : 'Pick any short song or tune from your device (up to 1.5 MB).';
    sp.querySelectorAll('.st-sw').forEach(b => b.setAttribute('aria-pressed', on(b.dataset.t)));
    const nm2 = sp.querySelector('#stNotifyMsg');
    if (nm2 && !nm2._keep) nm2.textContent = S.notify === false ? 'Reminders are OFF. Nothing will ring or pop up.' :
      !('Notification' in window) ? 'Reminders ON: they ring inside the app. This browser cannot show pop-up notifications.' :
      Notification.permission === 'granted' ? 'Reminders are ON: pop-up notification, sound and vibration.' :
      Notification.permission === 'denied' ? 'Reminders ON in the app, but pop-ups are blocked. Allow notifications for this site in your browser settings.' :
      'Reminders ON in the app. Tap the switch off and on again to allow pop-up notifications.';
  }
  /* resize a chosen photo to a small square so it fits in storage */
  function readDp(file) {
    if (!file) return;
    const fr = new FileReader();
    fr.onload = () => { const img = new Image(); img.onload = () => {
      const n = 256, c = document.createElement('canvas'); c.width = c.height = n;
      const m = Math.min(img.width, img.height), x = c.getContext('2d');
      x.drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, n, n);
      S.dp = c.toDataURL('image/jpeg', .82); window.cmSave(); sp.querySelector('.st-dpm').hidden = true; paintSettings();
    }; img.src = fr.result; };
    fr.readAsDataURL(file);
  }
  /* live camera: opens the device camera, shows a preview, and the Capture button takes the photo */
  const cam = document.createElement('div'); cam.className = 'cam-modal'; cam.hidden = true;
  cam.innerHTML = '<div class="cam-box" role="dialog" aria-modal="true" aria-label="Take photo"><video playsinline muted autoplay></video><p class="cam-msg" aria-live="polite"></p><div class="cam-btns"><button type="button" data-c="snap"><i class="fa-solid fa-camera"></i> Capture</button><button type="button" data-c="x" class="ghost">Cancel</button></div></div>';
  document.body.appendChild(cam);
  const vid = cam.querySelector('video'), camMsg = cam.querySelector('.cam-msg');
  let stream = null;
  function stopCam() { if (stream) stream.getTracks().forEach(t => t.stop()); stream = null; vid.srcObject = null; cam.hidden = true; }
  function startCam() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { sp.querySelector('#stCam').click(); return; }
    camMsg.textContent = 'Starting camera… please allow camera access.'; cam.hidden = false;
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false }).then(st => {
      stream = st; vid.srcObject = st; vid.play().catch(() => {}); camMsg.textContent = 'Look at the camera and press Capture.';
    }).catch(() => { cam.hidden = true; sp.querySelector('#stCam').click(); });   /* no permission / no camera: use the phone's own camera app */
  }
  cam.addEventListener('click', ev => {
    const c = ev.target.closest('[data-c]'); if (!c) return;
    if (c.dataset.c === 'x') { stopCam(); return; }
    if (!vid.videoWidth) { camMsg.textContent = 'Camera is not ready yet…'; return; }
    const n = 256, cv = document.createElement('canvas'); cv.width = cv.height = n;
    const m = Math.min(vid.videoWidth, vid.videoHeight);
    const x = cv.getContext('2d'); x.translate(n, 0); x.scale(-1, 1);       /* un-mirror like a normal selfie */
    x.drawImage(vid, (vid.videoWidth - m) / 2, (vid.videoHeight - m) / 2, m, m, 0, 0, n, n);
    S.dp = cv.toDataURL('image/jpeg', .85); window.cmSave(); stopCam(); sp.querySelector('.st-dpm').hidden = true; paintSettings();
  });
  sp.querySelector('#stGal').addEventListener('change', e => { readDp(e.target.files[0]); e.target.value = ''; });
  sp.querySelector('#stCam').addEventListener('change', e => { readDp(e.target.files[0]); e.target.value = ''; });
  sp.querySelector('#stMusic').addEventListener('change', e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    const note = sp.querySelector('#stMusicNote');
    if (f.size > 1.5 * 1024 * 1024) { note.textContent = 'That file is too big. Please pick one under 1.5 MB.'; return; }
    const fr = new FileReader(); fr.onload = () => { S.toneData = fr.result; S.toneName = f.name; S.tone = 'custom'; window.cmSave(); paintSettings(); window.cmPlayTone('custom'); };
    fr.readAsDataURL(f);
  });
  toneSel.addEventListener('change', () => {
    if (toneSel.value === 'custom' && !S.toneData) { sp.querySelector('#stMusic').click(); paintSettings(); return; }
    S.tone = toneSel.value; window.cmSave(); window.cmPlayTone();
  });
  sp.querySelector('#stNameIn').addEventListener('input', e => { const u = getU(), v = e.target.value.trim(); if (v) { u.name = v; putU(u); sp.querySelector('#stName').textContent = v; } });
  function openSettings() { paintSettings(); sp.querySelector('.st-dpm').hidden = true; sp.hidden = false; }
  window.openSettings = openSettings;
  document.addEventListener('keydown', e => { if (e.key !== 'Escape') return; if (!cam.hidden) stopCam(); else if (!sp.hidden) sp.hidden = true; });
  paintHeaderDp();
  sp.addEventListener('click', ev => {
    if (ev.target === sp) { sp.hidden = true; return; }
    const t = ev.target.closest('[data-t]'), g = ev.target.closest('[data-g]');
    if (t) { const k = t.dataset.t;
      if (k === 'notify') {
        const note = sp.querySelector('#stNotifyMsg');
        if (S.notify !== false) { S.notify = false; window.cmSave(); paintSettings(); }                 // switch OFF
        else {                                                                                            // switch ON, then ask the phone for permission
          S.notify = true; window.cmSave(); paintSettings();
          if (window.cmEnableNotify) window.cmEnableNotify(function (ok, text) { if (note) { note._keep = true; note.textContent = ok ? 'Reminders are ON: pop-up notification, sound and vibration. A test was sent.' : 'Reminders ON in the app. ' + text; } S.notify = true; window.cmSave(); paintSettings(); if (!ok && window.cmPlayTone) window.cmPlayTone(); setTimeout(function () { if (note) note._keep = false; }, 6000); });
        }
      }
      else { S[k] = k === 'quote' ? !(S.quote !== false) : !S[k]; window.cmSave(); paintSettings(); } }
    if (g) { const a = g.dataset.g;
      if (a === 'dpmenu') { const m = sp.querySelector('.st-dpm'); m.hidden = !m.hidden; return; }
      if (a === 'gal') { sp.querySelector('#stGal').click(); return; }
      if (a === 'cam') { startCam(); return; }
      if (a === 'del') { delete S.dp; window.cmSave(); sp.querySelector('.st-dpm').hidden = true; paintSettings(); return; }
      if (a === 'play') { window.cmPlayTone(); return; }
      if (a === 'music') { sp.querySelector('#stMusic').click(); return; }
      sp.hidden = a === 'x' || a === 'pw' || a === 'edit' || a === 'sec' || a === 'wa' || a === 'out' || a === 'wipe' || sp.hidden;
      if (a === 'edit') { if (!$('cmCard').hidden) CareMatePlan.hide(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
      if (a === 'pw' && window.CareMatePassword) CareMatePassword.openChange();
      if (a === 'sec') $('pfSecure').click();
      if (a === 'wa') window.open('https://wa.me/919096066204?text=' + encodeURIComponent('Hello, I have a question from CareMate.'), '_blank', 'noopener');
      if (a === 'out') { try { localStorage.removeItem('careMateUser'); } catch (e) {} window.location.replace('index.html'); }
      if (a === 'wipe') $('secWipe').click(); }
  });
  if (window.matchMedia) window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => window.cmApply());

  /* ---- Security ---- */
  const K = 'careMatePin', ls = {
    get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} },
    del: k => { try { localStorage.removeItem(k); } catch (e) {} }
  };
  const hash = async pin => {
    const b = new TextEncoder().encode('caremate:' + pin);
    return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', b))).map(x => x.toString(16).padStart(2, '0')).join('');
  };

  const lock = document.createElement('div');
  lock.className = 'sec-lock'; lock.hidden = true;
  lock.innerHTML = '<i class="fa-solid fa-lock" style="font-size:30px"></i><h2 id="secT" style="margin:0">Welcome back</h2><p id="secS" style="margin:0;opacity:.85">Enter your 4-digit PIN</p><div class="sec-dots"><i></i><i></i><i></i><i></i></div><div class="sec-err" id="secE" role="alert"></div><div class="sec-pad" id="secPad"></div>';
  document.body.appendChild(lock);
  const pad = lock.querySelector('#secPad');
  ['1','2','3','4','5','6','7','8','9','⌫','0','✕'].forEach(k => { const b = document.createElement('button'); b.type = 'button'; b.textContent = k; b.dataset.k = k; pad.appendChild(b); });

  let buf = '', mode = 'unlock', first = '', done = null;
  const paint = () => lock.querySelectorAll('.sec-dots i').forEach((d, i) => d.classList.toggle('on', i < buf.length));
  function ask(m, title, sub, cb) { mode = m; buf = ''; done = cb; $('secT').textContent = title; $('secS').textContent = sub; $('secE').textContent = ''; paint(); lock.hidden = false; }
  pad.addEventListener('click', async e => {
    const k = e.target.dataset.k; if (!k) return;
    if (k === '✕') { if (mode !== 'unlock') lock.hidden = true; return; }
    if (k === '⌫') buf = buf.slice(0, -1); else if (buf.length < 4) buf += k;
    paint(); if (buf.length < 4) return;
    const h = await hash(buf);
    if (mode === 'unlock') { if (h === ls.get(K)) { lock.hidden = true; } else { $('secE').textContent = 'Wrong PIN. Try again.'; } }
    else if (mode === 'remove') { if (h === ls.get(K)) { ls.del(K); lock.hidden = true; CareMatePlan.say('PIN lock removed'); } else { $('secE').textContent = 'Wrong PIN. Try again.'; } }
    else if (mode === 'set1') { first = buf; ask('set2', 'Confirm your PIN', 'Enter the same PIN again', done); return; }
    else if (mode === 'set2') { if (buf === first) { ls.set(K, h); lock.hidden = true; if (done) done('PIN lock is on'); } else { ask('set1', 'Set a PIN', 'The PINs did not match. Try again', done); $('secE').textContent = 'PINs did not match.'; return; } }
    buf = ''; setTimeout(paint, 150);
  });

  if (ls.get(K)) ask('unlock', 'Welcome back', 'Enter your 4-digit PIN');
  let idle; const arm = () => { clearTimeout(idle); if (ls.get(K)) idle = setTimeout(() => ask('unlock', 'Locked for your privacy', 'Enter your PIN to continue'), 10 * 60 * 1000); };
  ['click', 'keydown', 'touchstart', 'mousemove'].forEach(ev => document.addEventListener(ev, arm, { passive: true })); arm();

  /* Privacy & security panel */
  const panel = document.createElement('div');
  panel.className = 'sec-panel'; panel.hidden = true;
  panel.innerHTML = '<div class="sec-card" role="dialog" aria-modal="true" aria-label="Privacy and security"><h3><i class="fa-solid fa-shield-halved"></i> Privacy &amp; security</h3><p class=\"pv-lead\">Your profile is securely synced to your account. You can delete your data anytime.</p><div class=\"pv\"><div><b><i class=\"fa-solid fa-mobile-screen\"></i> On this device</b><span>A fast local copy of your profile, plan, goals and reminders. Your profile picture, PIN lock and settings stay here only.</span></div><div><b><i class=\"fa-solid fa-cloud\"></i> In your account</b><span>When you are logged in, your profile, plan, daily goals and reminders are saved on the CareMate server so they follow you to other devices. Only you and the CareMate owner (admin) can see them. No other user can.</span></div><div><b><i class=\"fa-solid fa-lock\"></i> How it is protected</b><span>Passwords are stored scrambled (hashed), never as plain text. Logins use a private session code that expires, and repeated wrong passwords are blocked. Use the https:// address of the site so data is encrypted in transit.</span></div><div><b><i class=\"fa-solid fa-comments\"></i> Chat helper</b><span>When you are logged in, questions you type in the helper are sent to our AI service to write an answer. Only your question and a few basics (health focus, food preference, age group) are sent, never your name or email.</span></div><div><b><i class=\"fa-solid fa-trash-can\"></i> You are in control</b><span>Delete all my data removes everything from this device and from your account. Logging out clears the local copy from this device.</span></div></div><p class=\"pv-small\">Add a PIN so nobody else can open your plan on this device.</p><button type="button" id="secSet"></button><button type="button" class="danger" id="secWipe">Delete all my data</button><button type="button" class="ghost" id="secClose">Close</button></div>';
  document.body.appendChild(panel);
  const label = () => { $('secSet').textContent = ls.get(K) ? 'Remove PIN lock' : 'Set a 4-digit PIN lock'; };
  const open = $('pfSecure');
  if (open) open.addEventListener('click', () => { label(); panel.hidden = false; });
  $('secClose').addEventListener('click', () => { panel.hidden = true; });
  panel.addEventListener('click', e => { if (e.target === panel) panel.hidden = true; });
  $('secSet').addEventListener('click', () => {
    panel.hidden = true;
    if (ls.get(K)) { ask('remove', 'Remove PIN lock', 'Enter your current PIN', null); return; }
    ask('set1', 'Set a PIN', 'Choose 4 digits', m => CareMatePlan.say(m));
  });
  $('secWipe').addEventListener('click', async () => {
    if (!confirm('Delete your profile, plan, progress, reminders and PIN? This also removes them from your account.')) return;
    const btn = $('secWipe'); btn.disabled = true; const t0 = btn.textContent; btn.textContent = 'Deleting…';
    const ok = window.CareMateAPI ? await CareMateAPI.wipeRemote() : true;
    btn.disabled = false; btn.textContent = t0;
    if (!ok) { alert('We could not reach the server, so your account data was NOT deleted. Please check your internet and try again.'); return; }
    try { Object.keys(localStorage).filter(k => k.indexOf('careMate') === 0).forEach(k => localStorage.removeItem(k)); } catch (e) {}
    try { sessionStorage.clear(); } catch (e) {}
    window.location.replace('index.html');
  });
})();

/* Health profile page: live snapshot (completion ring, BMI, water goal) + scroll reveal */
(function () {
  const form = document.getElementById('profileForm'); if (!form) return;
  const $ = id => document.getElementById(id);
  const ring = $('pfRing'), pct = $('pfPct'), pctTxt = $('pfPctTxt'), bmi = $('pfBmi'), bmiTxt = $('pfBmiTxt'), mark = $('pfMark'), drops = $('pfDrops'), gl = $('pfGl');
  if (!ring) return;
  const C = 2 * Math.PI * 18;
  let shown = 0, raf;
  function tween(to) {
    cancelAnimationFrame(raf); const from = shown, t0 = performance.now();
    (function step(t) { const k = Math.min(1, (t - t0) / 600); shown = Math.round(from + (to - from) * k); pct.textContent = shown + '%'; if (k < 1) raf = requestAnimationFrame(step); })(t0);
  }
  function update() {
    const ids = ['fullName', 'age', 'weight', 'height', 'gender', 'activity', 'condition', 'foodPref'];
    const done = ids.filter(i => { const e = $(i); return e && String(e.value).trim() !== ''; }).length;
    const p = Math.round(done / ids.length * 100);
    ring.style.strokeDashoffset = C * (1 - p / 100); tween(p);
    pctTxt.textContent = p === 100 ? 'All set. Get your plan!' : p >= 60 ? 'Almost there' : p > 0 ? 'Nice start' : "Let's begin";

    const w = parseFloat($('weight').value), h = parseFloat($('height').value) / 100;
    if (w > 0 && h > 0.5) {
      const b = w / (h * h); bmi.textContent = b.toFixed(1);
      bmiTxt.textContent = b < 18.5 ? 'Underweight range' : b < 25 ? 'Healthy range' : b < 30 ? 'Overweight range' : 'Obese range';
      mark.style.left = Math.max(0, Math.min(100, (b - 15) / 20 * 100)) + '%';
    } else { bmi.textContent = '--'; bmiTxt.textContent = 'Add weight & height'; mark.style.left = '0%'; }

    const n = parseInt($('waterGoal').value, 10) || 8; gl.textContent = n;
    drops.innerHTML = ''; for (let i = 0; i < n; i++) { const d = document.createElement('i'); d.className = 'fa-solid fa-droplet on'; d.style.animationDelay = (i * 40) + 'ms'; drops.append(d); }
  }
  form.addEventListener('input', update); form.addEventListener('change', update);
  update(); setTimeout(update, 400); /* second pass picks up any saved values */

  /* reveal blocks as they scroll into view */
  const items = form.querySelectorAll('.pf-group, .form-grid, .select-box.full, .goals-box, .textarea-box, #profileForm > .btn, .pf-note');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { const t = e.target; t.classList.add('in'); io.unobserve(t); setTimeout(() => { t.classList.remove('pf-rv', 'in'); t.style.transitionDelay = ''; }, 900); } }), { threshold: .08 });
    items.forEach((el, i) => { el.classList.add('pf-rv'); el.style.transitionDelay = (i % 3) * 70 + 'ms'; io.observe(el); });
  }
})();

/* keep the sticky "Your areas" bar just under the header, whatever height the header has on this phone */
(function () {
  const set = () => { const h = document.querySelector('header'); if (h) document.documentElement.style.setProperty('--cm-hdr', (h.getBoundingClientRect().height + 6) + 'px'); };
  set(); window.addEventListener('resize', set); window.addEventListener('load', set); setTimeout(set, 600);
  /* keep the tapped area button fully visible in the swipe row */
  document.addEventListener('click', e => { const t = e.target.closest && e.target.closest('.cm-tab'); if (t && t.scrollIntoView) setTimeout(() => t.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' }), 30); });
})();
