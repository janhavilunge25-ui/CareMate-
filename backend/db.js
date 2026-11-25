'use strict';
/* Database layer: SQLite through Node's built-in node:sqlite (Node 22.5+). No npm install needed. */
const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'caremate.db');
if (DB_PATH !== ':memory:') fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));

const sha = s => crypto.createHash('sha256').update(s).digest('hex');
const tx = fn => { db.exec('BEGIN'); try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; } };

/* ---------- passwords ---------- */
function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  return { salt, hash: crypto.scryptSync(password, salt, 64).toString('hex') };
}
function verifyPassword(password, salt, hash) {
  const a = Buffer.from(crypto.scryptSync(password, salt, 64).toString('hex'));
  const b = Buffer.from(hash);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/* ---------- users + sessions ---------- */
const q = {
  userByEmail: db.prepare('SELECT * FROM users WHERE email = ?'),
  userById:    db.prepare('SELECT id, name, email, created_at FROM users WHERE id = ?'),
  addUser:     db.prepare('INSERT INTO users (name, email, password_hash, salt) VALUES (?, ?, ?, ?)'),
  addSession:  db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)'),
  session:     db.prepare('SELECT user_id, expires_at FROM sessions WHERE token_hash = ?'),
  delSession:  db.prepare('DELETE FROM sessions WHERE token_hash = ?'),
  purge:       db.prepare('DELETE FROM sessions WHERE expires_at < ?'),
  delUser:     db.prepare('DELETE FROM users WHERE id = ?'),

  getProfile:  db.prepare('SELECT data FROM profiles WHERE user_id = ?'),
  setProfile:  db.prepare(`INSERT INTO profiles (user_id, data) VALUES (?, ?)
                           ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated_at = datetime('now')`),
  getPlan:     db.prepare('SELECT goals, saved_at FROM plans WHERE user_id = ?'),
  setPlan:     db.prepare(`INSERT INTO plans (user_id, goals) VALUES (?, ?)
                           ON CONFLICT(user_id) DO UPDATE SET goals = excluded.goals, saved_at = datetime('now')`),
  getLog:      db.prepare('SELECT day, water, meals, yoga, calm FROM daily_log WHERE user_id = ? AND day >= ? AND day <= ? ORDER BY day'),
  setDay:      db.prepare(`INSERT INTO daily_log (user_id, day, water, meals, yoga, calm) VALUES (?, ?, ?, ?, ?, ?)
                           ON CONFLICT(user_id, day) DO UPDATE SET water = excluded.water, meals = excluded.meals,
                           yoga = excluded.yoga, calm = excluded.calm, updated_at = datetime('now')`),
  getRem:      db.prepare('SELECT data FROM reminders WHERE user_id = ?'),
  setRem:      db.prepare(`INSERT INTO reminders (user_id, data) VALUES (?, ?)
                           ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated_at = datetime('now')`),
  getKv:       db.prepare('SELECT key, value FROM user_kv WHERE user_id = ?'),
  setKv:       db.prepare(`INSERT INTO user_kv (user_id, key, value) VALUES (?, ?, ?)
                           ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value`),
  adminUsers:  db.prepare(`SELECT u.id, u.name, u.email, u.created_at AS createdAt,
                             p.data AS profile, p.updated_at AS profileUpdated, pl.goals AS goals,
                             (SELECT MAX(updated_at) FROM daily_log WHERE user_id = u.id) AS lastLog
                           FROM users u LEFT JOIN profiles p ON p.user_id = u.id LEFT JOIN plans pl ON pl.user_id = u.id
                           ORDER BY u.id DESC`),
  wipe: ['profiles', 'plans', 'daily_log', 'reminders', 'user_kv'].map(t => db.prepare(`DELETE FROM ${t} WHERE user_id = ?`))
};

const parse = (s, fallback) => { try { return JSON.parse(s); } catch (e) { return fallback; } };

module.exports = {
  db, tx,
  createUser(name, email, password) {
    const { salt, hash } = hashPassword(password);
    const r = q.addUser.run(name, email, hash, salt);
    return Number(r.lastInsertRowid);
  },
  findByEmail: email => q.userByEmail.get(email),
  findById: id => q.userById.get(id),
  verifyPassword,

  createSession(userId, days) {
    q.purge.run(Date.now());
    const token = crypto.randomBytes(32).toString('hex');
    q.addSession.run(sha(token), userId, Date.now() + days * 864e5);
    return token;
  },
  userFromToken(token) {
    if (!token) return null;
    const s = q.session.get(sha(token));
    if (!s || s.expires_at < Date.now()) return null;
    return q.userById.get(s.user_id) || null;
  },
  endSession: token => { if (token) q.delSession.run(sha(token)); },
  deleteUser: id => q.delUser.run(id),

  getProfile: id => { const r = q.getProfile.get(id); return r ? parse(r.data, null) : null; },
  setProfile: (id, obj) => q.setProfile.run(id, JSON.stringify(obj)),
  getPlan: id => { const r = q.getPlan.get(id); return r ? { goals: parse(r.goals, []), savedAt: r.saved_at } : null; },
  setPlan: (id, goals) => q.setPlan.run(id, JSON.stringify(goals)),

  /* log is returned in the same shape the website already uses: { "2026-11-24": { water, meals, yoga, calm } } */
  getLog(id, from = '0000-01-01', to = '9999-12-31') {
    const out = {};
    for (const r of q.getLog.all(id, from, to)) out[r.day] = { water: r.water, meals: r.meals, yoga: r.yoga, calm: r.calm };
    return out;
  },
  setDays: (id, days) => tx(() => { for (const [d, v] of days) q.setDay.run(id, d, v.water, v.meals, v.yoga, v.calm); }),

  getReminders: id => { const r = q.getRem.get(id); return r ? parse(r.data, null) : null; },
  setReminders: (id, arr) => q.setRem.run(id, JSON.stringify(arr)),
  getKv: id => Object.fromEntries(q.getKv.all(id).map(r => [r.key, r.value])),
  setKv: (id, key, value) => q.setKv.run(id, key, String(value)),

  /* Admin only (the route checks ADMIN_EMAIL). Never returns password hashes or session tokens. */
  adminList: () => q.adminUsers.all().map(r => {
    const p = parse(r.profile, null) || {}, g = parse(r.goals, null) || p.goals || [];
    return { id: r.id, name: r.name, email: r.email, createdAt: r.createdAt, age: p.age || '', gender: p.gender || '', condition: p.condition || '',
             foodPref: p.foodPref || '', goals: g, hasProfile: !!r.profile, lastActive: r.lastLog || r.profileUpdated || r.createdAt };
  }),

  wipeData: id => tx(() => q.wipe.forEach(s => s.run(id)))
};
