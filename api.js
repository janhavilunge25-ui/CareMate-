/* CareMate API client + sync layer.
 *
 * - Talks to the backend in /backend (npm start). Open the site through http://localhost:3000.
 * - The pages keep using localStorage as a fast local copy. Whenever one of the synced keys changes,
 *   this file saves it to the database in the background (write-through).
 * - If the server cannot be reached the site keeps working on this device, and syncs next time.
 * Load this file BEFORE script.js.
 */
(function () {
  'use strict';
  const BASE = window.CAREMATE_API || (location.protocol === 'file:' ? 'http://localhost:3000' : '');
  const TOKEN = 'careMateToken', DIRTY = 'careMateDirty';
  const nativeSet = Storage.prototype.setItem, nativeGet = Storage.prototype.getItem, nativeDel = Storage.prototype.removeItem;
  const get = k => { try { return nativeGet.call(localStorage, k); } catch (e) { return null; } };
  const set = (k, v) => { try { nativeSet.call(localStorage, k, v); } catch (e) {} };
  const del = k => { try { nativeDel.call(localStorage, k); } catch (e) {} };
  const token = () => get(TOKEN);
  const json = (k, d) => { try { return JSON.parse(get(k) || 'null') ?? d; } catch (e) { return d; } };

  /* local key -> how to save it on the server */
  const SYNC = {
    careMateProfile:   () => ['PUT', '/api/profile',   json('careMateProfile', {})],
    careMatePlan:      () => ['PUT', '/api/plan',      { goals: (json('careMatePlan', {}) || {}).goals || [] }],
    careMateLog:       () => ['PUT', '/api/log',       { log: json('careMateLog', {}) }],
    careMateReminders: () => ['PUT', '/api/reminders', { reminders: json('careMateReminders', []) }],
    careMateWeek:      () => ['PUT', '/api/kv/week',   { value: get('careMateWeek') }]
  };
  const LOCAL_KEYS = Object.keys(SYNC);

  async function request(method, path, body) {
    const headers = { 'Content-Type': 'application/json' };
    if (token()) headers.Authorization = 'Bearer ' + token();
    let res;
    try { res = await fetch(BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), keepalive: true }); }
    catch (e) { return { offline: true }; }                                  // server not running / no internet
    const data = await res.json().catch(() => ({}));
    return res.ok ? { ok: true, data } : { status: res.status, error: data.error || 'Something went wrong. Please try again.' };
  }

  /* ---------- write-through ---------- */
  const timers = {};
  async function push(key) {
    if (!token() || !SYNC[key]) return;
    const [m, p, b] = SYNC[key]();
    const r = await request(m, p, b);
    if (r.status === 401) { expire(); return; }
    if (r.ok) { const d = json(DIRTY, []).filter(k => k !== key); d.length ? set(DIRTY, JSON.stringify(d)) : del(DIRTY); }
    else { const d = new Set(json(DIRTY, [])); d.add(key); set(DIRTY, JSON.stringify([...d])); }
  }
  Storage.prototype.setItem = function (k, v) {
    nativeSet.call(this, k, v);
    if (this === localStorage && SYNC[k] && token()) { clearTimeout(timers[k]); timers[k] = setTimeout(() => push(k), 500); }
  };
  Storage.prototype.removeItem = function (k) {
    nativeDel.call(this, k);
    if (this === localStorage && k === 'careMateUser') endSession();         // the pages' "Log out" removes this key
  };
  const flush = () => Promise.all(json(DIRTY, []).map(push));

  /* ---------- session ---------- */
  function clearLocal() { LOCAL_KEYS.forEach(del); del(DIRTY); }
  function endSession() {
    const t = token(); if (!t) return;
    fetch(BASE + '/api/logout', { method: 'POST', headers: { Authorization: 'Bearer ' + t }, keepalive: true }).catch(() => {});
    del(TOKEN); clearLocal();                                                // so the next person on this device starts clean
  }
  function expire() { del(TOKEN); del('careMateUser'); if (!sessionStorage.getItem('cmExpired')) { sessionStorage.setItem('cmExpired', '1'); location.reload(); } }

  /* copy the database snapshot into this device's local copy (does not trigger a push) */
  function hydrate(d, replace) {
    if (!d) return;
    const put = (k, v, has) => { if (has) set(k, typeof v === 'string' ? v : JSON.stringify(v)); else if (replace) del(k); };
    put('careMateProfile', d.profile, !!d.profile);
    put('careMatePlan', d.plan && { savedAt: d.plan.savedAt, goals: d.plan.goals }, !!d.plan);
    put('careMateLog', d.log, !!d.log && Object.keys(d.log).length > 0);
    put('careMateReminders', d.reminders, Array.isArray(d.reminders));
    put('careMateWeek', d.kv && d.kv.week, !!(d.kv && d.kv.week));
  }

  /* kind: 'login' | 'register'. Returns { ok, hasPlan } | { error } | { offline } */
  async function auth(kind, f) {
    const keepLocal = kind === 'register';                                   // a new account adopts what was filled in before signing up
    const r = await request('POST', '/api/' + kind, kind === 'login' ? { email: f.email, password: f.password } : f);
    if (!r.ok) return r;
    const { token: t, user, data } = r.data;
    const local = keepLocal ? Object.fromEntries(LOCAL_KEYS.map(k => [k, get(k)])) : null;
    clearLocal(); set(TOKEN, t); set('careMateUser', JSON.stringify({ name: user.name, email: user.email }));
    sessionStorage.removeItem('cmExpired');
    if (keepLocal) { LOCAL_KEYS.forEach(k => { if (local[k] !== null) set(k, local[k]); }); set(DIRTY, JSON.stringify(LOCAL_KEYS.filter(k => local[k] !== null))); flush(); }
    else hydrate(data, true);
    const p = json('careMateProfile', null);
    return { ok: true, hasPlan: !!(p && p.goals && p.goals.length) };
  }

  /* pull the latest from the server (other device, other tab) and tell the page */
  async function refresh() {
    if (!token()) return;
    await flush();
    const r = await request('GET', '/api/sync');
    if (r.status === 401) { expire(); return; }
    if (r.ok) { hydrate(r.data, false); document.dispatchEvent(new CustomEvent('caremate-synced')); }
  }

  /* "Delete all my data": removes it from the database too. Returns true when the server confirmed (or there is no account). */
  async function wipeRemote() {
    const t = token(); if (!t) return true;
    del(TOKEN);                                                              // stop write-through while wiping
    let ok = false;
    try {
      const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 20000);   // free hosting can take a while to wake up
      const r = await fetch(BASE + '/api/data', { method: 'DELETE', headers: { Authorization: 'Bearer ' + t }, signal: ctl.signal });
      clearTimeout(to); ok = r.ok;
    } catch (e) {}
    if (!ok) { set(TOKEN, t); return false; }                                // not deleted on the server: keep the session so they can retry
    fetch(BASE + '/api/logout', { method: 'POST', headers: { Authorization: 'Bearer ' + t }, keepalive: true }).catch(() => {});
    return true;
  }

  window.CareMateAPI = { auth, refresh, wipeRemote, request, loggedIn: () => !!token(), base: BASE };
  if (token()) { flush(); }
})();
