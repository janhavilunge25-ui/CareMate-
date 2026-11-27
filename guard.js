/* CareMate page guard (profile page). Loaded FIRST in <head>.
 * 1) Not logged in (or all data deleted)  -> go to the index (home) page, never show the profile form.
 * 2) App / bookmark / typed-address opens the profile page directly -> go to the index (home) page first.
 * 3) Logged out in another tab, or page restored from the back/forward cache -> leave the profile page.
 */
(function () {
  'use strict';
  var HOME = 'index.html';
  function user() { try { return JSON.parse(localStorage.getItem('careMateUser') || 'null'); } catch (e) { return null; } }
  function loggedIn() { var u = user(); return !!(u && (u.email || u.name)); }
  function goHome() { document.documentElement.style.visibility = 'hidden'; location.replace(HOME); }

  /* hide the page until we know it is allowed, so no saved data flashes on screen */
  if (!loggedIn()) { goHome(); return; }

  var nav = (performance.getEntriesByType && performance.getEntriesByType('navigation')[0]) || null;
  var fromSite = false;
  try { fromSite = !!document.referrer && new URL(document.referrer).origin === location.origin; } catch (e) {}
  var fresh = !nav || nav.type === 'navigate';
  if (fresh && !fromSite && !location.hash) { goHome(); return; }       // opened directly: start from the home page

  window.addEventListener('pageshow', function (e) { if (e.persisted && !loggedIn()) goHome(); });
  window.addEventListener('storage', function (e) { if ((e.key === 'careMateUser' || e.key === null) && !loggedIn()) goHome(); });
})();
