'use strict';
/* Smoke test: node --no-warnings test.js  (uses an in-memory database) */
process.env.DB_PATH = ':memory:';
const http = require('node:http');
const fakeAI = http.createServer((req, res) => { let b = ''; req.on('data', c => b += c); req.on('end', () => { const j = JSON.parse(b); res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify({ reply: 'Try dal and curd. (' + j.messages.length + ' msgs; ' + (j.system.includes('Never recommend') ? 'rules sent' : 'NO RULES') + ')', follow_ups: ['Do you eat eggs?'] }) }] })); }); });
const assert = require('node:assert');
const server = require('./server');

fakeAI.listen(0, () => { process.env.ANTHROPIC_BASE_URL = 'http://127.0.0.1:' + fakeAI.address().port; });
server.listen(0, async () => {
  const base = 'http://127.0.0.1:' + server.address().port;
  const call = async (method, p, body, token) => {
    const r = await fetch(base + p, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, body: await r.json().catch(() => ({})) };
  };
  const day = o => { const d = new Date(Date.now() - o * 864e5); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  try {
    assert.equal((await call('POST', '/api/register', { name: 'A', email: 'x', password: '1' })).status, 400);
    const reg = await call('POST', '/api/register', { name: 'Asha Patil', email: 'Asha@Example.com', password: 'secret1' });
    assert.equal(reg.status, 201); const t = reg.body.token;
    assert.equal((await call('POST', '/api/register', { name: 'Asha', email: 'asha@example.com', password: 'secret1' })).status, 409);
    assert.equal((await call('POST', '/api/login', { email: 'asha@example.com', password: 'wrong!!' })).status, 401);
    const login = await call('POST', '/api/login', { email: 'asha@example.com', password: 'secret1' });
    assert.equal(login.status, 200); assert.equal(login.body.user.name, 'Asha Patil');
    assert.equal((await call('GET', '/api/me')).status, 401);

    assert.equal((await call('PUT', '/api/profile', { fullName: 'Asha Patil', waterGoal: '8', goals: ['diet', 'yoga', 'bogus'] }, t)).status, 200);
    assert.deepEqual((await call('GET', '/api/plan', null, t)).body.plan.goals, ['diet', 'yoga']);

    await call('PUT', '/api/log', { log: { [day(1)]: { water: 8, meals: 5, yoga: 1 }, [day(0)]: { water: 99, meals: 2, yoga: 0 }, 'nope': { water: 1 } } }, t);
    const log = (await call('GET', '/api/log', null, t)).body.log;
    assert.equal(Object.keys(log).length, 2); assert.equal(log[day(0)].water, 40);            // clamped
    const dash = (await call('GET', '/api/dashboard?tz=' + new Date().getTimezoneOffset(), null, t)).body;
    assert.equal(dash.streak, 1); assert.equal(dash.week.days.length, 7);

    await call('PUT', '/api/reminders', { reminders: [{ label: 'Walk', time: '07:00' }] }, t);
    const sync = (await call('GET', '/api/sync', null, t)).body;
    assert.equal(sync.reminders[0].label, 'Walk'); assert.equal(sync.profile.fullName, 'Asha Patil');

    assert.equal((await call('GET', '/backend/db.js')).status, 404);                          // source is not served
    assert.equal((await call('GET', '/index.html')).status, 200);
    // chat: no key -> 503 (site falls back to built-in answers); emergency -> never goes to the model; key set -> JSON reply
    const ask = text => call('POST', '/api/chat', { messages: [{ role: 'user', text }], context: { condition: 'Diabetes', food: 'veg' } }, t);
    assert.equal((await ask('what should I eat')).status, 503);
    assert.equal((await call('POST', '/api/chat', { messages: [{ role: 'user', text: 'hi' }] })).status, 401);
    process.env.ANTHROPIC_API_KEY = 'test-key';
    const em = await ask('I have chest pain and cannot breathe'); assert.equal(em.body.urgent, true);
    const ok = await ask('what should I eat'); assert.equal(ok.status, 200); assert.match(ok.body.reply, /rules sent/); assert.deepEqual(ok.body.followUps, ['Do you eat eggs?']);
    await call('DELETE', '/api/data', null, t);
    assert.equal((await call('GET', '/api/sync', null, t)).body.profile, null);
    await call('POST', '/api/logout', null, t);
    assert.equal((await call('GET', '/api/me', null, t)).status, 401);
    console.log('All API checks passed');
  } catch (e) { console.error('FAILED:', e.message); process.exitCode = 1; }
  server.close(); fakeAI.close(); process.exit(process.exitCode || 0);
});
