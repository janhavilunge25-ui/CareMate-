/* If nobody is logged in, leftover saved data from an earlier user is removed so it can never show up. Loaded first in <head>. */
(function () {
  try {
    var u = null; try { u = JSON.parse(localStorage.getItem('careMateUser') || 'null'); } catch (e) {}
    if (u && (u.email || u.name)) return;
    var re = /^careMate(Profile|Plan|Log|Reminders|Week|Dirty|Token|Done_|Meals_|Shop_|Fired)/;
    Object.keys(localStorage).filter(function (k) { return re.test(k); }).forEach(function (k) { localStorage.removeItem(k); });
    sessionStorage.removeItem('careMateFiredToday');
  } catch (e) {}
})();
