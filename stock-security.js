/* Allow only harmless presentation preferences in settings backups. */
(function () {
  'use strict';
  var enums = {mk_theme:['auto','light','dark'],mk_cv:['us','kr'],mk_save:['0','1'],mk_one:['0','1'],mk_noev:['0','1'],mk_sort:['o','d','a']};
  function valid(k,v) {
    if (typeof v !== 'string' || v.length > 150) return false;
    if (Object.prototype.hasOwnProperty.call(enums,k)) return enums[k].indexOf(v) !== -1;
    if (/^mk_sort_[A-Za-z0-9_-]{1,40}$/.test(k)) return ['o','d','a'].indexOf(v)!==-1;
    return /^mk_(?:m|f)_[A-Za-z0-9_가-힣 ·&()\-]{1,60}$/.test(k) && /^[01]$/.test(v);
  }
  window.MK_STOCK_PREFS = Object.freeze({valid:valid});
  // Retire the legacy persistent statistics credential; never send it.
  try { localStorage.removeItem('mk_stats_key'); } catch (_) {}
})();
