/* Home page, logged-in users: replace the sample preview with the real "Today's goals" and "Your report".
 * Reads the same data as the profile page (careMateLog / careMateProfile), so ticks here show up there and in the database. */
(function () {
  'use strict';
  const wrap = document.getElementById('hpPreviewWrap');
  if (!wrap) return;
  const read = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v === null ? d : v; } catch (e) { return d; } };
  if (!read('careMateUser', null)) return;                       // not logged in: keep the labelled sample preview

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const dkey = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const readLog = () => read('careMateLog', {}) || {};
  const writeLog = l => { try { localStorage.setItem('careMateLog', JSON.stringify(l)); } catch (e) {} };   // api.js saves it to the database

  function defsFor() {
    const p = read('careMateProfile', {}) || {}, plan = read('careMatePlan', {}) || {};
    const goals = (p.goals && p.goals.length) ? p.goals : (plan.goals || []);
    const water = Math.min(20, Math.max(1, parseInt(p.waterGoal, 10) || 8));
    const defs = [{ id: 'water', label: 'Drink water', icon: 'fa-droplet', target: water, max: water + 4, unit: 'glasses', kind: 'step' }];
    if (goals.includes('diet'))       defs.push({ id: 'meals', label: 'Eat your planned meals', icon: 'fa-utensils', target: 5, max: 5, unit: 'meals', kind: 'auto' });
    if (goals.includes('yoga'))       defs.push({ id: 'yoga', label: 'Do your yoga', icon: 'fa-om', target: 1, max: 1, unit: '', kind: 'tog' });
    if (goals.includes('meditation')) defs.push({ id: 'calm', label: 'Take calm time', icon: 'fa-spa', target: 1, max: 1, unit: '', kind: 'tog' });
    return { p, goals, defs };
  }
  const dayPct = (e, defs) => defs.reduce((s, d) => s + Math.min(1, (e[d.id] || 0) / d.target), 0) / defs.length;

  function stats(defs) {
    const log = readLog(), today = new Date(), tk = dkey(today);
    const used = k => log[k] && Object.keys(log[k]).some(id => log[k][id] > 0);
    const first = Object.keys(log).filter(used).sort()[0] || tk;
    const pct = k => (k < first || k > tk) ? null : dayPct(log[k] || {}, defs);
    let streak = 0, d = today; if (pct(dkey(d)) !== 1) d = addDays(d, -1);
    while (pct(dkey(d)) === 1) { streak++; d = addDays(d, -1); }
    const range = n => Array.from({ length: n }, (_, i) => { const dt = addDays(today, i - (n - 1)), k = dkey(dt); return { dt, pct: pct(k), water: (log[k] && log[k].water) || 0 }; });
    const sum = arr => { const t = arr.filter(x => x.pct !== null); return { avg: t.length ? Math.round(t.reduce((s, x) => s + x.pct, 0) / t.length * 100) : 0, met: t.filter(x => x.pct === 1).length, tracked: t.length, water: arr.reduce((s, x) => s + x.water, 0) }; };
    return { todayPct: Math.round((pct(tk) || 0) * 100), today: log[tk] || {}, streak, any: Object.keys(log).some(used), range, sum };
  }

  let view = 'week';
  function html() {
    const { p, goals, defs } = defsFor(), s = stats(defs);
    const w = s.range(7), m = s.range(30), sm = s.sum(view === 'week' ? w : m), span = view === 'week' ? 'week' : 'month';
    const name = (((read('careMateUser', {}) || {}).name || p.fullName || '') + '').trim().split(' ')[0];
    const h = new Date().getHours(), greet = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
    const dateTxt = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
    const dayName = dt => dt.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

    const rows = defs.map(d => {
      const v = Math.min(d.max, s.today[d.id] || 0), pc = Math.min(100, Math.round(v / d.target * 100)), done = v >= d.target;
      const sub = d.kind === 'tog' ? (done ? 'Done for today' : 'Not done yet') : v + ' of ' + d.target + ' ' + d.unit + (d.kind === 'auto' ? ' · from your Diet Plan' : '');
      const ctl = d.kind === 'step'
        ? `<div class="cm-step"><button type="button" data-act="dec" data-id="${d.id}" aria-label="Remove one glass" ${v ? '' : 'disabled'}>&minus;</button><button type="button" data-act="inc" data-id="${d.id}" aria-label="Add one glass">+</button></div>`
        : d.kind === 'tog'
        ? `<button type="button" class="cm-gtog${done ? ' on' : ''}" data-act="tog" data-id="${d.id}" aria-pressed="${done}">${done ? '<i class="fa-solid fa-check"></i> Done' : 'Mark done'}</button>`
        : `<a class="cm-gtog" href="profile.html#plan">Open</a>`;
      return `<div class="cm-goal${done ? ' done' : ''}"><span class="cm-gic"><i class="fa-solid ${d.icon}"></i></span>
        <div class="cm-gtxt"><b>${d.label}</b><small>${sub}</small><div class="cm-gbar"><i style="width:${pc}%"></i></div></div>${ctl}</div>`;
    }).join('');

    const chart = view === 'week'
      ? `<div class="cm-bars" role="img" aria-label="Goals completed each day this week">${w.map((x, i) => {
          const v = x.pct === null ? 0 : Math.round(x.pct * 100);
          return `<div class="cm-bar${x.pct === null ? ' empty' : ''}${i === 6 ? ' today' : ''}" title="${dayName(x.dt)}: ${x.pct === null ? 'not tracked yet' : v + '%'}"><span class="cm-bv">${x.pct === null ? '–' : v + '%'}</span><div class="cm-bcol"><i style="height:${v}%"></i></div><em>${x.dt.toLocaleDateString('en-IN', { weekday: 'narrow' })}</em></div>`;
        }).join('')}</div>`
      : `<div class="cm-heat" role="img" aria-label="Goals completed each day this month">${m.map(x => {
          const v = x.pct === null ? -1 : Math.round(x.pct * 100), lv = v < 0 ? 'n' : v === 0 ? 0 : v < 40 ? 1 : v < 80 ? 2 : v < 100 ? 3 : 4;
          return `<i class="lv${lv}" title="${dayName(x.dt)}: ${v < 0 ? 'not tracked yet' : v + '%'}">${x.dt.getDate()}</i>`;
        }).join('')}</div>`;

    const saved = window.CareMateAPI && CareMateAPI.loggedIn() ? 'Saved to your account.' : 'Saved on this device only.';
    return `<section class="hp-live cm-card" aria-label="Your goals and report">
      <div class="hp-live-head">
        <div><h2>${greet}${name ? ', ' + esc(name) : ''}</h2><p>${dateTxt}</p></div>
        <div class="hp-live-chips">
          <span class="hp-live-chip ring"><i class="fa-solid fa-bullseye"></i> ${s.todayPct}% of today's goals</span>
          <span class="hp-live-chip"><i class="fa-solid fa-fire"></i> ${s.streak} day streak</span>
        </div>
      </div>
      ${goals.length ? '' : '<p class="hp-live-hint"><i class="fa-solid fa-circle-info"></i> You are tracking water only. <a href="profile.html">Set up your plan</a> to add diet, yoga and meditation goals.</p>'}
      <div class="cm-dgrid">
        <div class="cm-dcard">
          <h3><i class="fa-solid fa-bullseye"></i> Today's goals</h3>
          <p class="cm-dsub">${s.streak ? 'Finish every goal to keep your ' + s.streak + '-day streak going.' : 'Finish every goal today to start a streak.'}</p>
          ${rows}
        </div>
        <div class="cm-dcard">
          <div class="cm-dhead"><h3><i class="fa-solid fa-chart-column"></i> Your report</h3>
            <div class="cm-seg" role="tablist" aria-label="Report period">
              <button type="button" role="tab" data-act="view" data-v="week" aria-selected="${view === 'week'}" class="${view === 'week' ? 'on' : ''}">Weekly</button>
              <button type="button" role="tab" data-act="view" data-v="month" aria-selected="${view === 'month'}" class="${view === 'month' ? 'on' : ''}">Monthly</button>
            </div></div>
          ${chart}
          <div class="cm-rsum">
            <div><b>${sm.avg}%</b><span>Average</span></div>
            <div><b>${sm.met}</b><span>Perfect ${sm.met === 1 ? 'day' : 'days'}</span></div>
            <div><b>${sm.water}</b><span>Glasses of water</span></div>
          </div>
          <p class="cm-dsub">${s.any ? 'Based on the ' + sm.tracked + ' ' + (sm.tracked === 1 ? 'day' : 'days') + ' you have tracked this ' + span + '.' : 'Tick your first goal and this report starts filling in.'} ${saved}</p>
        </div>
      </div>
      ${window.CareMateProgress ? CareMateProgress.html(defs, readLog()) : ''}
      <div class="hp-live-foot"><a class="hp-btn primary" href="profile.html#plan">Open my full plan <i class="fa-solid fa-arrow-right"></i></a><small>Diet, yoga, meditation and reminders are in your plan.</small></div>
    </section>`;
  }

  function draw(focusSel) {
    wrap.innerHTML = html();
    const el = focusSel && wrap.querySelector(focusSel); if (el) el.focus();
  }

  wrap.addEventListener('click', e => {
    const b = e.target.closest('button[data-act]'); if (!b) return;
    const act = b.dataset.act, id = b.dataset.id;
    if (act === 'view') { view = b.dataset.v; draw('[data-act="view"][data-v="' + view + '"]'); return; }
    const def = defsFor().defs.find(d => d.id === id); if (!def) return;
    const log = readLog(), k = dkey(new Date()), day = log[k] || (log[k] = {});
    if (act === 'inc') day[id] = Math.min(def.max, (day[id] || 0) + 1);
    if (act === 'dec') day[id] = Math.max(0, (day[id] || 0) - 1);
    if (act === 'tog') day[id] = day[id] ? 0 : 1;
    writeLog(log);
    draw('[data-act="' + act + '"][data-id="' + id + '"]');
  });

  draw();
  document.addEventListener('caremate-synced', () => draw());      // newer data arrived from the account
  window.addEventListener('storage', () => draw());                 // changed in another tab
  window.addEventListener('pageshow', e => { if (e.persisted) draw(); });
  if (window.CareMateAPI) CareMateAPI.refresh();
})();
