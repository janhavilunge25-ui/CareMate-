/* CareMate password screens: "Forgot password?" on the login box and "Change password" in Settings.
   Uses the server (api.js). Exposes CareMatePassword.openForgot() and CareMatePassword.openChange(). */
(function () {
  'use strict';
  var API = function () { return window.CareMateAPI; };
  var m = null, body, onClose = null;

  function build() {
    if (m) return;
    m = document.createElement('div'); m.className = 'pw-modal'; m.hidden = true;
    m.innerHTML = '<div class="pw-card" role="dialog" aria-modal="true" aria-labelledby="pwT"><button type="button" class="pw-x" aria-label="Close"><i class="fa-solid fa-xmark"></i></button><h3 id="pwT"></h3><div class="pw-body"></div></div>';
    document.body.appendChild(m); body = m.querySelector('.pw-body');
    m.addEventListener('click', function (e) { if (e.target === m || e.target.closest('.pw-x')) close(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !m.hidden) close(); });
  }
  function close() { if (!m) return; m.hidden = true; document.body.classList.remove('pw-open'); if (onClose) { var f = onClose; onClose = null; f(); } }
  function open(title, html) { build(); m.querySelector('#pwT').textContent = title; body.innerHTML = html; m.hidden = false; document.body.classList.add('pw-open'); var f = body.querySelector('input'); if (f) setTimeout(function () { f.focus(); }, 50); }
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var field = function (id, label, type, extra) {
    return '<label class="pw-f"><span>' + label + '</span><span class="pw-in"><input id="' + id + '" type="' + type + '" ' + (extra || '') + '>' +
      (type === 'password' ? '<button type="button" class="pw-eye" data-for="' + id + '" aria-label="Show password"><i class="fa-solid fa-eye"></i></button>' : '') + '</span></label>';
  };
  function wireEyes() {
    body.querySelectorAll('.pw-eye').forEach(function (b) { b.addEventListener('click', function () {
      var i = document.getElementById(b.dataset.for), show = i.type === 'password'; i.type = show ? 'text' : 'password';
      b.firstChild.className = 'fa-solid ' + (show ? 'fa-eye-slash' : 'fa-eye'); b.setAttribute('aria-label', show ? 'Hide password' : 'Show password'); }); });
  }
  var msg = function (t, ok) { var e = body.querySelector('.pw-msg'); e.textContent = t || ''; e.className = 'pw-msg' + (ok ? ' ok' : ''); e.setAttribute('role', ok ? 'status' : 'alert'); };
  function busy(btn, on, label) { btn.disabled = on; btn.innerHTML = on ? '<i class="fa-solid fa-circle-notch fa-spin"></i> Please wait' : label; }
  function explain(r) {
    if (r.offline) return 'Cannot reach the server. Check your internet and try again.';
    return r.error || 'Something went wrong. Please try again.';
  }
  var emailOk = function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); };

  /* ---------- Forgot password: email -> code + new password ---------- */
  function openForgot(prefill) {
    open('Forgot password?',
      '<p class="pw-sub">Enter your account email. We will send you a 6-digit code.</p>' +
      field('pwEmail', 'Email', 'email', 'autocomplete="email" inputmode="email"') +
      '<p class="pw-msg"></p><button type="button" class="pw-btn" id="pwSend">Send code</button>');
    var em = body.querySelector('#pwEmail'); if (prefill) em.value = prefill;
    var btn = body.querySelector('#pwSend');
    em.addEventListener('keydown', function (e) { if (e.key === 'Enter') btn.click(); });
    btn.addEventListener('click', async function () {
      var email = em.value.trim(); if (!emailOk(email)) { msg('Enter a valid email address.'); return; }
      busy(btn, true); var r = API() ? await API().request('POST', '/api/forgot', { email: email }) : { offline: true };
      if (!r.ok) { busy(btn, false, 'Send code'); msg(explain(r)); return; }
      openReset(email);
    });
  }
  function openReset(email) {
    open('Enter the code',
      '<p class="pw-sub">If an account exists for <b>' + esc(email) + '</b>, a code is on its way. It works for 15 minutes. Check Spam too.</p>' +
      field('pwCode', '6-digit code', 'text', 'inputmode="numeric" maxlength="6" autocomplete="one-time-code"') +
      field('pwNew', 'New password', 'password', 'autocomplete="new-password"') +
      field('pwNew2', 'Confirm new password', 'password', 'autocomplete="new-password"') +
      '<p class="pw-msg"></p><button type="button" class="pw-btn" id="pwGo">Change password</button><button type="button" class="pw-link" id="pwAgain">Send a new code</button>');
    wireEyes();
    var btn = body.querySelector('#pwGo');
    body.querySelector('#pwAgain').addEventListener('click', function () { openForgot(email); });
    btn.addEventListener('click', async function () {
      var code = body.querySelector('#pwCode').value.trim(), p1 = body.querySelector('#pwNew').value, p2 = body.querySelector('#pwNew2').value;
      if (!/^\d{6}$/.test(code)) { msg('Enter the 6-digit code from the email.'); return; }
      if (p1.length < 6) { msg('Password must be at least 6 characters.'); return; }
      if (p1 !== p2) { msg('Passwords do not match.'); return; }
      busy(btn, true); var r = await API().request('POST', '/api/reset', { email: email, code: code, password: p1 });
      if (!r.ok) { busy(btn, false, 'Change password'); msg(explain(r)); return; }
      body.innerHTML = '<p class="pw-done"><i class="fa-solid fa-circle-check"></i></p><p class="pw-sub">Your password was changed. Please log in with your new password.</p><button type="button" class="pw-btn" id="pwOk">Back to login</button>';
      body.querySelector('#pwOk').addEventListener('click', close);
      var le = document.querySelector('.form-box.login input[name="email"]'); if (le) le.value = email;
    });
  }

  /* ---------- Change password (logged in) ---------- */
  function openChange() {
    if (!API() || !API().loggedIn()) {
      open('Change password', '<p class="pw-sub">Password change works for accounts that are signed in to the CareMate server. Please log out and log in again while online, then try again.</p><button type="button" class="pw-btn" id="pwOk">OK</button>');
      body.querySelector('#pwOk').addEventListener('click', close); return;
    }
    open('Change password',
      field('pwCur', 'Current password', 'password', 'autocomplete="current-password"') +
      field('pwNew', 'New password', 'password', 'autocomplete="new-password"') +
      field('pwNew2', 'Confirm new password', 'password', 'autocomplete="new-password"') +
      '<p class="pw-msg"></p><button type="button" class="pw-btn" id="pwGo">Change password</button><button type="button" class="pw-link" id="pwForgot">I forgot my current password</button>');
    wireEyes();
    var btn = body.querySelector('#pwGo');
    body.querySelector('#pwForgot').addEventListener('click', function () {
      var u = {}; try { u = JSON.parse(localStorage.getItem('careMateUser') || '{}') || {}; } catch (e) {}
      openForgot(u.email || '');
    });
    btn.addEventListener('click', async function () {
      var cur = body.querySelector('#pwCur').value, p1 = body.querySelector('#pwNew').value, p2 = body.querySelector('#pwNew2').value;
      if (!cur) { msg('Enter your current password.'); return; }
      if (p1.length < 6) { msg('New password must be at least 6 characters.'); return; }
      if (p1 !== p2) { msg('Passwords do not match.'); return; }
      if (p1 === cur) { msg('Please choose a password different from the current one.'); return; }
      busy(btn, true); var r = await API().request('POST', '/api/change-password', { current: cur, password: p1 });
      if (!r.ok) { busy(btn, false, 'Change password'); msg(explain(r)); return; }
      body.innerHTML = '<p class="pw-done"><i class="fa-solid fa-circle-check"></i></p><p class="pw-sub">Your password was changed. Other devices were signed out.</p><button type="button" class="pw-btn" id="pwOk">Done</button>';
      body.querySelector('#pwOk').addEventListener('click', close);
    });
  }

  window.CareMatePassword = { openForgot: openForgot, openChange: openChange };

  /* the "Forgot password?" link in the login box */
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('.remember-forgot a');
    if (!a) return; e.preventDefault(); e.stopImmediatePropagation();
    var le = document.querySelector('.form-box.login input[name="email"]');
    openForgot(le ? le.value.trim() : '');
  }, true);
})();
