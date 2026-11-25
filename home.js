/* Home page: if you are already signed in, skip the login box and go straight to your plan. */
(function () {
  let user = null, prof = null;
  try { user = JSON.parse(localStorage.getItem('careMateUser') || 'null'); prof = JSON.parse(localStorage.getItem('careMateProfile') || 'null'); } catch (e) {}
  if (!user) return;
  const dest = prof && prof.goals && prof.goals.length ? 'profile.html#plan' : 'profile.html';
  const name = (user.name || (prof && prof.fullName) || '').split(' ')[0];
  document.addEventListener('click', e => {
    const t = e.target.closest('.login-btn,[data-open-login],[data-open-register]');
    if (!t) return;
    e.preventDefault(); e.stopImmediatePropagation(); window.location.href = dest;
  }, true);
  document.querySelectorAll('.login-btn').forEach(b => { b.textContent = 'My plan'; });
  document.querySelectorAll('[data-open-register]').forEach(b => { b.innerHTML = 'Continue to my plan <i class="fa-solid fa-arrow-right"></i>'; });
  const bar = document.createElement('div'); bar.className = 'wb';
  bar.innerHTML = '<span><i class="fa-solid fa-circle-check"></i> Welcome back' + (name ? ', <b></b>' : '') + '</span><a class="wb-go" href="' + dest + '">Continue to my plan <i class="fa-solid fa-arrow-right"></i></a>';
  if (name) bar.querySelector('b').textContent = name;
  document.body.appendChild(bar);
  setTimeout(() => { bar.style.transition = 'opacity .5s, transform .5s'; bar.style.opacity = '0'; bar.style.transform = 'translate(-50%, 20px)'; setTimeout(() => bar.remove(), 600); }, 15000);   /* shows for 15 seconds */
})();
