'use strict';
/*
 * CareMate backend. Zero dependencies: Node 22.5+ only.
 *   npm start   ->  http://localhost:3000   (serves the website AND the /api routes)
 *
 * API (JSON in, JSON out; send  Authorization: Bearer <token>  on protected routes)
 *   POST   /api/register      { name, email, password }       -> { token, user, data }
 *   POST   /api/login         { email, password }             -> { token, user, data }
 *   POST   /api/logout                                        -> { ok }
 *   GET    /api/me                                            -> { user }
 *   GET    /api/sync                                          -> { profile, plan, log, reminders, kv }
 *   GET    /api/profile        PUT /api/profile   { ...profile answers }
 *   GET    /api/plan           PUT /api/plan      { goals: [...] }
 *   GET    /api/log?from=&to=  PUT /api/log       { log: { "YYYY-MM-DD": { water, meals, yoga, calm } } }
 *   PUT    /api/log/:day       { water, meals, yoga, calm }
 *   GET    /api/dashboard                                     -> today's goals + week/month report (server-side)
 *   GET    /api/reminders      PUT /api/reminders { reminders: [...] }
 *   PUT    /api/kv/:key        { value }
 *   DELETE /api/data                                          -> wipes profile, plan, log, reminders
 *   DELETE /api/me                                            -> deletes the account
 *   POST   /api/chat          { messages: [{role,text}], context }   -> { reply, followUps, urgent }   (needs ANTHROPIC_API_KEY)
 *   GET    /api/health
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const store = require('./db');

const PORT = +process.env.PORT || 3000;
const SESSION_DAYS = +process.env.SESSION_DAYS || 30;
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';          // tokens are sent in a header, not cookies
const SITE_ROOT = path.resolve(__dirname, '..');
const MAX_BODY = 200 * 1024;
/* Owner access: set ADMIN_EMAIL (comma separated for more than one) in Render > Environment. Only these accounts can open /admin.html data. */
const ADMIN_EMAILS = String(process.env.ADMIN_EMAIL || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean);
const isAdmin = u => !!u && ADMIN_EMAILS.includes(String(u.email).toLowerCase());

/* ---------- helpers ---------- */
class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
const bad = (m, s = 400) => { throw new HttpError(s, m); };

const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.webp': 'image/webp', '.json': 'application/json', '.mp3': 'audio/mpeg' };

function send(res, status, body, extra = {}) {
  const json = typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  res.writeHead(status, Object.assign({
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': CORS_ORIGIN,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store'
  }, extra));
  res.end(json);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size > MAX_BODY) { reject(new HttpError(413, 'Request too large.')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try { const v = JSON.parse(Buffer.concat(chunks).toString('utf8')); resolve(v && typeof v === 'object' ? v : {}); }
      catch (e) { reject(new HttpError(400, 'Body must be valid JSON.')); }
    });
    req.on('error', reject);
  });
}

/* login/register brute-force guard: 10 tries per 15 minutes per IP */
const hits = new Map();
function throttle(ip) {
  const now = Date.now(), list = (hits.get(ip) || []).filter(t => now - t < 15 * 60e3);
  if (list.length >= 10) bad('Too many attempts. Please wait a few minutes and try again.', 429);
  list.push(now); hits.set(ip, list);
}
setInterval(() => { const now = Date.now(); for (const [k, v] of hits) if (!v.some(t => now - t < 15 * 60e3)) hits.delete(k); }, 10 * 60e3).unref();

/* ---------- validation ---------- */
const emailOk = v => typeof v === 'string' && v.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const int = (v, min, max) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : 0; };
const dayOk = d => /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d + 'T00:00:00Z'));
const cleanDay = v => ({ water: int(v && v.water, 0, 40), meals: int(v && v.meals, 0, 10), yoga: int(v && v.yoga, 0, 1), calm: int(v && v.calm, 0, 1) });
const GOALS = ['diet', 'yoga', 'meditation', 'dietitian'];

const publicUser = u => ({ id: u.id, name: u.name, email: u.email, admin: isAdmin(u) });
function snapshot(id) {
  return { profile: store.getProfile(id), plan: store.getPlan(id), log: store.getLog(id), reminders: store.getReminders(id), kv: store.getKv(id) };
}

/* ---------- dashboard maths (same rules as the website) ---------- */
const dkey = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
function dashboard(id, tzOffsetMin) {
  const profile = store.getProfile(id) || {}, goals = (profile.goals && profile.goals.length) ? profile.goals : (store.getPlan(id) || {}).goals || [];
  const water = Math.min(20, Math.max(1, parseInt(profile.waterGoal, 10) || 8));
  const defs = [{ id: 'water', target: water }];
  if (goals.includes('diet')) defs.push({ id: 'meals', target: 5 });
  if (goals.includes('yoga')) defs.push({ id: 'yoga', target: 1 });
  if (goals.includes('meditation')) defs.push({ id: 'calm', target: 1 });
  const log = store.getLog(id);
  const now = new Date(Date.now() - (Number.isFinite(tzOffsetMin) ? tzOffsetMin : 0) * 60e3);    // client's local "today"
  const today = new Date(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()), tk = dkey(today);
  const used = k => log[k] && Object.values(log[k]).some(v => v > 0);
  const first = Object.keys(log).filter(used).sort()[0] || tk;
  const pctOf = k => (k < first || k > tk) ? null : defs.reduce((s, d) => s + Math.min(1, ((log[k] || {})[d.id] || 0) / d.target), 0) / defs.length;
  let streak = 0, d = today; if (pctOf(dkey(d)) !== 1) d = addDays(d, -1);
  while (pctOf(dkey(d)) === 1) { streak++; d = addDays(d, -1); }
  let best = 0, run = 0;
  for (let c = new Date(first + 'T00:00:00'); dkey(c) <= tk; c = addDays(c, 1)) { if (pctOf(dkey(c)) === 1) { run++; best = Math.max(best, run); } else run = 0; }
  const range = n => Array.from({ length: n }, (_, i) => { const k = dkey(addDays(today, i - (n - 1))); const p = pctOf(k); return { day: k, percent: p === null ? null : Math.round(p * 100), water: (log[k] || {}).water || 0 }; });
  const sum = arr => { const t = arr.filter(x => x.percent !== null); return { averagePercent: t.length ? Math.round(t.reduce((s, x) => s + x.percent, 0) / t.length) : 0, perfectDays: t.filter(x => x.percent === 100).length, trackedDays: t.length, glassesOfWater: arr.reduce((s, x) => s + x.water, 0) }; };
  const week = range(7), month = range(30), t = log[tk] || {};
  return {
    today: { day: tk, percent: Math.round((pctOf(tk) || 0) * 100), goals: defs.map(g => ({ id: g.id, done: t[g.id] || 0, target: g.target })) },
    streak, bestStreak: best, week: { days: week, ...sum(week) }, month: { days: month, ...sum(month) }
  };
}


/* ---------- AI chat (optional: needs ANTHROPIC_API_KEY, otherwise the website uses its built-in answers) ---------- */
const CHAT_MODEL = process.env.CHAT_MODEL || 'claude-sonnet-5-5';
const aiBase = () => (process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com').replace(/\/+$/, '');
const EMERGENCY = /chest pain|cannot breathe|can'?t breathe|trouble breathing|difficulty breathing|short(ness)? of breath|heart attack|stroke|face (is )?drooping|suicid|kill myself|end my life|want to die|self[- ]?harm|overdose|unconscious|not waking|seizure|fit(s)? now|severe bleeding|heavy bleeding|poison|swallowed (a )?(battery|poison|chemical)/i;
const EMERGENCY_REPLY = 'This could be serious. Please call 112 or 108 now, or go to the nearest hospital or ask someone nearby to take you. I cannot assess emergencies, and getting help right away matters most. If you are thinking of harming yourself, please call a helpline or tell someone you trust straight away.';
const SYSTEM_PROMPT = `You are the CareMate helper, a friendly wellness guide inside an Indian health and wellness web app (diet, yoga, meditation, water, daily habits).
Rules you always follow:
- Give general wellness and lifestyle information only. Never diagnose, never say the user has or does not have a condition, and never interpret test results as a verdict.
- Never recommend, change or stop a medicine or supplement dose. For medicines, supplements, tests or treatment questions, say to ask their doctor or pharmacist.
- For anything that could be an emergency (chest pain, trouble breathing, stroke signs, heavy bleeding, fainting, seizures, thoughts of self-harm, pregnancy danger signs, a very unwell child), tell them to call 112 or 108 or go to the nearest hospital now.
- Use simple, warm language and Indian food examples. Keep replies under 120 words.
- When one short question would help you personalise the answer (for example food preference, how long the problem has lasted, activity level), ask just one, unless the user already told you.
- If asked who made, developed or owns CareMate, answer: CareMate was developed by Janhavi Lunge and her team.
- If the question is not about health or wellness, kindly steer back to wellness topics.
- Reply ONLY as JSON, no other text: {"reply":"...","follow_ups":["..."]} with 0 to 3 follow_ups. Each follow-up is under 8 words and is something the user could tap to say next.`;

const chatHits = new Map();                                   // per user: max 30 messages an hour
function chatThrottle(uid) {
  const now = Date.now(), list = (chatHits.get(uid) || []).filter(t => now - t < 3600e3);
  if (list.length >= 30) bad('You have reached the hourly chat limit. Please try again a little later.', 429);
  list.push(now); chatHits.set(uid, list);
}
const clip = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);

async function chat(uid, body) {
  const msgs = (Array.isArray(body.messages) ? body.messages : []).slice(-10)
    .map(m => ({ role: m && m.role === 'assistant' ? 'assistant' : 'user', content: clip(m && m.text, 600) })).filter(m => m.content);
  if (!msgs.length || msgs[msgs.length - 1].role !== 'user') bad('Please type a question.');
  const last = msgs[msgs.length - 1].content;
  if (EMERGENCY.test(last)) return { reply: EMERGENCY_REPLY, followUps: [], urgent: true };
  if (!process.env.ANTHROPIC_API_KEY) bad('AI chat is not set up on this server.', 503);
  chatThrottle(uid);

  const c = body.context && typeof body.context === 'object' ? body.context : {};
  const ctx = `User context (may be incomplete): health focus: ${clip(c.condition, 60) || 'not given'}; food preference: ${clip(c.food, 20) || 'not given'}; age group: ${clip(c.ageGroup, 20) || 'not given'}.`;
  let res;
  try {
    res = await fetch(aiBase() + '/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: CHAT_MODEL, max_tokens: 500, system: SYSTEM_PROMPT + '\n' + ctx, messages: msgs }),
      signal: AbortSignal.timeout(20000)
    });
  } catch (e) { bad('The assistant is not reachable right now.', 502); }
  if (!res.ok) bad('The assistant is not available right now.', 502);
  const data = await res.json().catch(() => ({}));
  const text = ((data.content || []).find(b => b.type === 'text') || {}).text || '';
  let out; try { out = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)); } catch (e) { out = { reply: text }; }
  const reply = clip(out.reply, 1200);
  if (!reply) bad('The assistant did not answer. Please try again.', 502);
  const followUps = (Array.isArray(out.follow_ups) ? out.follow_ups : []).map(x => clip(x, 60)).filter(Boolean).slice(0, 3);
  return { reply, followUps, urgent: EMERGENCY.test(reply) && /112|108/.test(reply) };
}


/* ---------- password reset (6-digit code sent by email) ----------
   Email is sent through EmailJS (the same account the Contact form uses). In Render > Environment set:
     EMAILJS_RESET_TEMPLATE_ID (required). Optional: EMAILJS_SERVICE_ID, EMAILJS_PUBLIC_KEY (default to the Contact form's), EMAILJS_PRIVATE_KEY.
   In EmailJS > Account > Security tick "Allow EmailJS API for non-browser applications".
   The template can use {{to_email}}, {{to_name}}, {{code}} and {{minutes}}. */
const crypto = require('node:crypto');
const resets = new Map();                                   // email -> { hash, exp, tries }
const RESET_MIN = 15;
const sha256 = x => crypto.createHash('sha256').update(x).digest('hex');
async function sendResetEmail(user, code) {
  const e = process.env;
  /* Uses EMAILJS_RESET_TEMPLATE_ID if you made a special template; otherwise reuses the Contact form's template
     (its "To Email" must be {{to_email}} in EmailJS so the code goes to the user). */
  const tpl = e.EMAILJS_RESET_TEMPLATE_ID || 'template_7n6qpik';
  const text = 'Your CareMate password reset code is ' + code + '. It works for ' + RESET_MIN + ' minutes. If you did not ask for this, you can ignore this email.';
  const payload = { service_id: e.EMAILJS_SERVICE_ID || 'service_4h46t3y', template_id: tpl, user_id: e.EMAILJS_PUBLIC_KEY || 'MG6nTVi7clYTBAYfh',
    template_params: { to_email: user.email, to_name: user.name, code, minutes: RESET_MIN,
      from_name: 'CareMate', name: 'CareMate', user_name: 'CareMate', topic: 'Password reset', title: 'Password reset',
      subject: 'Your CareMate password reset code', message: text } };
  if (e.EMAILJS_PRIVATE_KEY) payload.accessToken = e.EMAILJS_PRIVATE_KEY;
  const r = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
    method: 'POST', headers: { 'content-type': 'application/json' }, signal: AbortSignal.timeout(15000), body: JSON.stringify(payload)
  });
  if (!r.ok) { console.log('[CareMate] EmailJS refused the reset email: ' + r.status + ' ' + (await r.text().catch(() => ''))); throw new Error('EmailJS ' + r.status); }
  return true;
}

/* ---------- routes ---------- */
async function api(req, res, url) {
  const route = req.method + ' ' + url.pathname.replace(/\/+$/, '');
  const ip = req.socket.remoteAddress || 'x';
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  const authed = () => store.userFromToken(token) || bad('Please log in again.', 401);

  if (route === 'GET /api/health') return send(res, 200, { ok: true });

  if (route === 'POST /api/register') {
    throttle(ip);
    const b = await readJson(req), name = String(b.name || '').trim(), email = String(b.email || '').trim().toLowerCase(), pw = String(b.password || '');
    if (name.length < 2 || name.length > 80) bad('Please enter your name.');
    if (!emailOk(email)) bad('Enter a valid email address.');
    if (pw.length < 6 || pw.length > 128) bad('Password must be at least 6 characters.');
    if (store.findByEmail(email)) bad('An account with this email already exists. Try logging in.', 409);
    const id = store.createUser(name, email, pw);
    return send(res, 201, { token: store.createSession(id, SESSION_DAYS), user: publicUser(store.findById(id)), data: snapshot(id) });
  }

  if (route === 'POST /api/login') {
    throttle(ip);
    const b = await readJson(req), email = String(b.email || '').trim().toLowerCase(), pw = String(b.password || '');
    const u = emailOk(email) && pw ? store.findByEmail(email) : null;
    if (!u || !store.verifyPassword(pw, u.salt, u.password_hash)) bad('Incorrect email or password.', 401);
    return send(res, 200, { token: store.createSession(u.id, SESSION_DAYS), user: publicUser(u), data: snapshot(u.id) });
  }

  if (route === 'POST /api/forgot') {
    throttle(ip);
    const b = await readJson(req), email = String(b.email || '').trim().toLowerCase();
    if (!emailOk(email)) bad('Enter a valid email address.');
    const u = store.findByEmail(email);
    if (u) {                                                          // same answer whether or not the account exists
      const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
      resets.set(email, { hash: sha256(email + ':' + code), exp: Date.now() + RESET_MIN * 60e3, tries: 0 });
      try { if (!(await sendResetEmail(u, code)) && process.env.DEV_RESET_LOG !== '1') bad('Password reset email is not set up on this server yet. Please contact the CareMate team.', 503); }
      catch (e) { if (e instanceof HttpError) throw e; resets.delete(email); bad('We could not send the email right now. Please try again in a few minutes.', 502); }
    }
    return send(res, 200, { ok: true });
  }

  if (route === 'POST /api/reset') {
    throttle(ip);
    const b = await readJson(req), email = String(b.email || '').trim().toLowerCase(), code = String(b.code || '').trim(), pw = String(b.password || '');
    if (pw.length < 6 || pw.length > 128) bad('Password must be at least 6 characters.');
    const r = resets.get(email), u = r && store.findByEmail(email);
    if (!r || !u || r.exp < Date.now()) { resets.delete(email); bad('That code has expired. Please ask for a new one.', 400); }
    if (++r.tries > 5) { resets.delete(email); bad('Too many wrong codes. Please ask for a new one.', 429); }
    const a = Buffer.from(sha256(email + ':' + code)), c = Buffer.from(r.hash);
    if (a.length !== c.length || !crypto.timingSafeEqual(a, c)) bad('That code is not correct.', 400);
    resets.delete(email);
    store.setPassword(u.id, pw);
    return send(res, 200, { ok: true });
  }

  if (route === 'POST /api/logout') { store.endSession(token); return send(res, 200, { ok: true }); }

  /* everything below needs a valid token */
  if (!url.pathname.startsWith('/api/')) bad('Not found.', 404);
  if (req.method === 'OPTIONS') return send(res, 204, '');
  const user = authed(), uid = user.id;

  /* ----- owner view: every other route only ever returns the logged-in user's OWN data ----- */
  if (url.pathname.startsWith('/api/admin/')) {
    if (!isAdmin(user)) bad('Not found.', 404);                      // 404 so normal users cannot even tell it exists
    if (route === 'GET /api/admin/users') return send(res, 200, { users: store.adminList() });
    const one = url.pathname.match(/^\/api\/admin\/users\/(\d{1,12})$/);
    if (req.method === 'GET' && one) {
      const target = store.findById(+one[1]); if (!target) bad('User not found.', 404);
      const log = store.getLog(target.id), days = Object.keys(log).sort().slice(-30);
      return send(res, 200, { user: { id: target.id, name: target.name, email: target.email, createdAt: target.created_at },
        profile: store.getProfile(target.id), plan: store.getPlan(target.id), recentLog: Object.fromEntries(days.map(k => [k, log[k]])) });
    }
    bad('Not found.', 404);
  }

  if (route === 'POST /api/change-password') {
    throttle(ip);
    const b = await readJson(req), cur = String(b.current || ''), pw = String(b.password || '');
    const full = store.findByEmail(user.email);
    if (!full || !store.verifyPassword(cur, full.salt, full.password_hash)) bad('Your current password is not correct.', 401);
    if (pw.length < 6 || pw.length > 128) bad('New password must be at least 6 characters.');
    if (pw === cur) bad('Please choose a password different from the current one.');
    store.setPassword(uid, pw, token);
    return send(res, 200, { ok: true });
  }

  if (route === 'GET /api/me') return send(res, 200, { user: publicUser(user) });
  if (route === 'GET /api/sync') return send(res, 200, snapshot(uid));

  if (route === 'GET /api/profile') return send(res, 200, { profile: store.getProfile(uid) });
  if (route === 'PUT /api/profile') {
    const b = await readJson(req);
    if (Array.isArray(b)) bad('Profile must be an object.');
    store.setProfile(uid, b);
    if (Array.isArray(b.goals)) store.setPlan(uid, b.goals.filter(g => GOALS.includes(g)));
    return send(res, 200, { ok: true });
  }

  if (route === 'GET /api/plan') return send(res, 200, { plan: store.getPlan(uid) });
  if (route === 'PUT /api/plan') {
    const b = await readJson(req);
    if (!Array.isArray(b.goals)) bad('goals must be a list.');
    store.setPlan(uid, b.goals.filter(g => GOALS.includes(g)));
    return send(res, 200, { ok: true });
  }

  if (route === 'GET /api/log') {
    const from = url.searchParams.get('from') || undefined, to = url.searchParams.get('to') || undefined;
    if ((from && !dayOk(from)) || (to && !dayOk(to))) bad('from/to must look like 2026-11-24.');
    return send(res, 200, { log: store.getLog(uid, from, to) });
  }
  if (route === 'PUT /api/log') {
    const b = await readJson(req), entries = Object.entries(b.log || {});
    if (entries.length > 400) bad('Too many days in one request.');
    const days = entries.filter(([d]) => dayOk(d)).map(([d, v]) => [d, cleanDay(v)]);
    store.setDays(uid, days);
    return send(res, 200, { ok: true, saved: days.length });
  }
  const one = req.method === 'PUT' && url.pathname.match(/^\/api\/log\/(\d{4}-\d{2}-\d{2})$/);
  if (one) {
    if (!dayOk(one[1])) bad('Invalid date.');
    const v = cleanDay(await readJson(req)); store.setDays(uid, [[one[1], v]]);
    return send(res, 200, { ok: true, day: one[1], entry: v });
  }

  if (route === 'POST /api/chat') return send(res, 200, await chat(uid, await readJson(req)));

  if (route === 'GET /api/dashboard') return send(res, 200, dashboard(uid, parseInt(url.searchParams.get('tz'), 10)));

  if (route === 'GET /api/reminders') return send(res, 200, { reminders: store.getReminders(uid) });
  if (route === 'PUT /api/reminders') {
    const b = await readJson(req);
    if (!Array.isArray(b.reminders) || b.reminders.length > 100) bad('reminders must be a list of up to 100.');
    store.setReminders(uid, b.reminders);
    return send(res, 200, { ok: true });
  }

  const kv = req.method === 'PUT' && url.pathname.match(/^\/api\/kv\/([A-Za-z0-9_-]{1,40})$/);
  if (kv) { const b = await readJson(req); store.setKv(uid, kv[1], String(b.value ?? '').slice(0, 2000)); return send(res, 200, { ok: true }); }

  if (route === 'DELETE /api/data') { store.wipeData(uid); return send(res, 200, { ok: true }); }
  if (route === 'DELETE /api/me') { store.deleteUser(uid); return send(res, 200, { ok: true }); }

  bad('Not found.', 404);
}

/* ---------- static website (so http://localhost:3000 just works) ----------
   Speed: files are compressed (brotli/gzip, kept in memory) and cached by the browser, so the site opens fast on slow mobile data. */
const zlib = require('node:zlib');
const COMPRESSIBLE = new Set(['.html', '.css', '.js', '.svg', '.json']);
const LONG_CACHE = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.mp3']);
const fileCache = new Map();          // path -> { mtime, size, raw, br, gz, etag }

function serveStatic(req, res, url) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { error: 'Method not allowed.' });
  let rel; try { rel = decodeURIComponent(url.pathname); } catch (e) { return send(res, 400, { error: 'Bad path.' }); }
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.resolve(SITE_ROOT, '.' + rel);
  const inside = file.startsWith(SITE_ROOT + path.sep);
  const hidden = path.relative(SITE_ROOT, file).split(path.sep).some(p => p.startsWith('.') || p === 'backend' || p === 'node_modules');
  const ext = path.extname(file).toLowerCase(), type = MIME[ext];
  if (!inside || hidden || !type) return send(res, 404, { error: 'Not found.' });
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return send(res, 404, { error: 'Not found.' });
    let c = fileCache.get(file);
    const fresh = c && c.mtime === st.mtimeMs && c.size === st.size;
    const headers = {
      'Content-Type': type, 'Vary': 'Accept-Encoding', 'X-Frame-Options': 'SAMEORIGIN', 'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Cache-Control': LONG_CACHE.has(ext) ? 'public, max-age=604800, stale-while-revalidate=86400' : 'no-cache'
    };
    const finish = entry => {
      headers.ETag = entry.etag;
      if (req.headers['if-none-match'] === entry.etag) return send(res, 304, '', headers);
      const ae = String(req.headers['accept-encoding'] || '');
      let body = entry.raw;
      if (COMPRESSIBLE.has(ext)) { if (/\bbr\b/.test(ae)) { body = entry.br; headers['Content-Encoding'] = 'br'; } else if (/\bgzip\b/.test(ae)) { body = entry.gz; headers['Content-Encoding'] = 'gzip'; } }
      headers['Content-Length'] = body.length;
      if (req.method === 'HEAD') return send(res, 200, '', headers);
      send(res, 200, body, headers);
    };
    if (fresh) return finish(c);
    fs.readFile(file, (e2, buf) => {
      if (e2) return send(res, 404, { error: 'Not found.' });
      c = { mtime: st.mtimeMs, size: st.size, raw: buf, etag: '"' + st.size.toString(16) + '-' + Math.round(st.mtimeMs).toString(16) + '"' };
      if (COMPRESSIBLE.has(ext)) { c.gz = zlib.gzipSync(buf, { level: 9 }); c.br = zlib.brotliCompressSync(buf, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 9 } }); }
      fileCache.set(file, c); finish(c);
    });
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname.startsWith('/api/')) {
      if (req.method === 'OPTIONS') return send(res, 204, '');
      return await api(req, res, url);
    }
    serveStatic(req, res, url);
  } catch (e) {
    if (e instanceof HttpError) return send(res, e.status, { error: e.message });
    console.error(e); send(res, 500, { error: 'Something went wrong on our side. Please try again.' });
  }
});

/* ---------- owner recovery: reset the admin password from Render (no email needed) ----------
   Render > Environment: add ADMIN_RESET_PASSWORD = a new password (6+ characters), redeploy, log in,
   then DELETE the variable again. Works for the first ADMIN_EMAIL (or ADMIN_RESET_EMAIL if you set it). */
(function adminRecovery() {
  const pw = process.env.ADMIN_RESET_PASSWORD;
  if (!pw) return;
  const email = String(process.env.ADMIN_RESET_EMAIL || ADMIN_EMAIL[0] || '').trim().toLowerCase();
  if (!emailOk(email) || !ADMIN_EMAIL.includes(email)) { console.log('[CareMate] ADMIN_RESET_PASSWORD ignored: the email must be listed in ADMIN_EMAIL.'); return; }
  if (pw.length < 6 || pw.length > 128) { console.log('[CareMate] ADMIN_RESET_PASSWORD ignored: use 6 to 128 characters.'); return; }
  try {
    const u = store.findByEmail(email);
    if (u) { store.setPassword(u.id, pw); console.log('[CareMate] Admin password reset for ' + email + '. Now delete ADMIN_RESET_PASSWORD in Render.'); }
    else { store.createUser('Admin', email, pw); console.log('[CareMate] Admin account created for ' + email + '. Now delete ADMIN_RESET_PASSWORD in Render.'); }
  } catch (e) { console.log('[CareMate] Admin reset failed: ' + e.message); }
})();

if (require.main === module) server.listen(PORT, () => console.log(`CareMate running at http://localhost:${PORT}`));
module.exports = server;
