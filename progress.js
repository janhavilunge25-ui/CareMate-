/* CareMate progress helpers: "this week by goal" sentences + achievement badges.
 * Used by the plan dashboard (script.js) and the home page (home-dash.js). Pure functions, no storage of its own. */
window.CareMateProgress = (function () {
  'use strict';
  const dkey = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const WORDS = {
    water: n => `You completed ${n} out of 7 daily water goals this week.`,
    meals: n => `You ate all your planned meals on ${n} out of 7 days this week.`,
    yoga:  n => `You did your yoga on ${n} out of 7 days this week.`,
    calm:  n => `You took calm time on ${n} out of 7 days this week.`
  };

  function compute(defs, log) {
    log = log || {};
    const today = new Date(), tk = dkey(today);
    const hit = (k, d) => ((log[k] || {})[d.id] || 0) >= d.target;
    const pct = k => defs.reduce((s, d) => s + Math.min(1, (((log[k] || {})[d.id]) || 0) / d.target), 0) / defs.length;
    const used = k => log[k] && Object.keys(log[k]).some(id => log[k][id] > 0);
    const keys = Object.keys(log).filter(used).sort(), first = keys[0] || tk;

    const week = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
    const goals = defs.map(d => {
      const days = week.map(dt => { const k = dkey(dt); return { k, dt, hit: hit(k, d), future: false }; });
      return { def: d, days, count: days.filter(x => x.hit).length };
    });
    const perfectWeek = week.filter(dt => pct(dkey(dt)) === 1).length;

    let best = 0, run = 0, cur = 0;
    for (let c = new Date(first + 'T00:00:00'); dkey(c) <= tk; c = addDays(c, 1)) {
      if (pct(dkey(c)) === 1) { run++; best = Math.max(best, run); } else run = 0;
    }
    let d = today; if (pct(dkey(d)) !== 1) d = addDays(d, -1);
    while (dkey(d) >= first && pct(dkey(d)) === 1) { cur++; d = addDays(d, -1); }

    const g = id => goals.find(x => x.def.id === id);
    const badges = [
      { icon: 'fa-seedling', title: 'First step',       desc: 'Log your first goal.',                        ok: keys.length > 0 },
      { icon: 'fa-fire',     title: '3-day streak',     desc: 'Finish every goal 3 days in a row.',          ok: best >= 3 },
      { icon: 'fa-fire-flame-curved', title: '7-day streak', desc: 'Finish every goal 7 days in a row.',     ok: best >= 7 },
      { icon: 'fa-medal',    title: '30-day streak',    desc: 'Finish every goal 30 days in a row.',         ok: best >= 30 },
      { icon: 'fa-star',     title: 'Perfect week',     desc: 'Finish every goal on all 7 days of a week.',  ok: perfectWeek === 7 }
    ];
    if (g('water')) badges.push({ icon: 'fa-droplet', title: 'Hydration hero', desc: 'Reach your water goal on 5 of the last 7 days.', ok: g('water').count >= 5 });
    if (g('meals')) badges.push({ icon: 'fa-utensils', title: 'Meal master', desc: 'Eat all planned meals on 5 of the last 7 days.', ok: g('meals').count >= 5 });
    if (g('yoga'))  badges.push({ icon: 'fa-om', title: 'Yoga habit', desc: 'Do your yoga on 5 of the last 7 days.', ok: g('yoga').count >= 5 });
    if (g('calm'))  badges.push({ icon: 'fa-spa', title: 'Calm mind', desc: 'Take calm time on 5 of the last 7 days.', ok: g('calm').count >= 5 });
    return { goals, badges, current: cur, best };
  }

  function html(defs, log) {
    const r = compute(defs, log), earned = r.badges.filter(b => b.ok).length;
    const rows = r.goals.map(x => `<div class="pg-row">
        <span class="pg-ic"><i class="fa-solid ${esc(x.def.icon)}"></i></span>
        <div class="pg-tx"><p>${esc((WORDS[x.def.id] || (n => `You reached this goal on ${n} out of 7 days this week.`))(x.count))}</p>
          <div class="pg-dots" role="img" aria-label="${x.count} of 7 days">${x.days.map(d => `<i class="${d.hit ? 'on' : ''}" title="${esc(d.dt.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' }))}: ${d.hit ? 'goal reached' : 'not reached'}"></i>`).join('')}</div></div>
        <b class="pg-n">${x.count}/7</b></div>`).join('');
    const badges = r.badges.map(b => `<div class="pg-badge${b.ok ? ' on' : ''}" title="${esc(b.desc)}">
        <span><i class="fa-solid ${esc(b.icon)}"></i></span><b>${esc(b.title)}</b><small>${b.ok ? 'Earned' : esc(b.desc)}</small></div>`).join('');
    return `<div class="pg-wrap">
      <div class="pg-card"><h3><i class="fa-solid fa-chart-simple"></i> This week, goal by goal</h3>${rows}</div>
      <div class="pg-card"><h3><i class="fa-solid fa-trophy"></i> Achievements <small>${earned} of ${r.badges.length}</small></h3><div class="pg-badges">${badges}</div></div>
    </div>`;
  }
  return { compute, html };
})();
