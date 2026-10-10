/* Source: stock-bootstrap.js */
(function(){try{var d=document.documentElement,t=localStorage.getItem('mk_theme'),c=localStorage.getItem('mk_cv');if(t==='dark'||(t!=='light'&&window.matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches))d.setAttribute('data-theme','dark');if(c==='us')d.setAttribute('data-cv','us');window.MK_CV={us:c==='us'}}catch(e){window.MK_CV={us:false}}})()

;
/* Source: stock-security.js */
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

;
/* Source: stock-state-v65.js */
/* Shared network state for the badge and its description. No DOM dependencies. */
(function(){
 window.MK_FG_PHASE='loading';
 window.MK_DATA_STATUS=function(net,online,now,phase){
  var log=net&&Array.isArray(net.log)?net.log.slice(-20):[],age=net&&net.lastOk?now-net.lastOk:null;
  if(!online)return {code:'r',state:'error',text:'오프라인'};
  if(!log.length)return {code:'w',state:'loading',text:'데이터 확인 중'};
  var failures=log.filter(function(v){return !v;}).length;
  if(age===null||age>600000||failures/log.length>.5)return {code:'r',state:'error',text:'데이터 연결 오류'};
  if(failures||phase==='snapshot')return {code:'w',state:'partial',text:'일부 데이터 누락'};
  if(phase==='loading')return {code:'w',state:'partial',text:'일부 데이터 조회 중'};
  return {code:'g',state:'ok',text:'데이터 정상'};
 };
})();

;
