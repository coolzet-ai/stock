(function(){
 'use strict';var page=location.pathname.split('/').pop().replace('.html','');
 if(!/^(bond|crypto|finprod|ipo|p2p|fx|trade|mrkim-signal)$/.test(page))return;
 var main=document.querySelector('main');if(!main)return;document.body.classList.add('other-standard');
 var statusObserver,statusNode,pending;
 function permit(fn){if(window.MK_REQUEST_DETAIL)window.MK_REQUEST_DETAIL(fn);else fn();}
 function setAll(open){
  main.querySelectorAll('h2.fold-h,.market-fold-h').forEach(function(h){if(typeof h._set==='function')h._set(open);});
  main.querySelectorAll('.cross-fold').forEach(function(c){c.classList.toggle('cross-open',open);c.classList.toggle('m-open',open);var b=c.querySelector('.m-fold-btn');if(b){b.setAttribute('aria-expanded',String(open));b.textContent=open?'접기 −':'펼치기 ＋';}});
  main.querySelectorAll('.scard [data-sc]').forEach(function(b){var c=document.getElementById(b.dataset.sc);if(c&&c.classList.contains('open')!==open)b.click();});
  main.querySelectorAll('.ipo-detail').forEach(function(d){d.classList.toggle('open',open);var card=d.closest('.ipo-card'),b=card&&card.querySelector('.v90-ipo-fold');if(b){b.setAttribute('aria-expanded',String(open));b.textContent=open?'접기 −':'펼치기 ＋';}});
  main.querySelectorAll('details').forEach(function(d){if(!d.closest('#pro-toc,.v86-menu,.market-nav'))d.open=open;});
 }
 function requestAll(open){if(open)permit(function(){setAll(true);});else setAll(false);}
 function controls(){
  var status=document.getElementById('pro-status');if(!status){status=document.createElement('div');status.id='pro-status';status.setAttribute('aria-label','화면 관리');status.innerHTML='<span class="v90-source-note">갱신 시각·출처는 항목별 표시</span>';var head=document.querySelector('.v86-page-head,.hero');if(head)head.after(status);else main.prepend(status);}
  var actions=document.querySelector('.v90-actions');if(!actions){actions=document.createElement('div');actions.className='v90-actions';status.append(actions);}
  [['reload','다시 불러오기','↻'],['close','모두 접기','−'],['open','모두 펼치기','＋']].forEach(function(s){if(actions.querySelector('[data-other-action="'+s[0]+'"]'))return;var b=document.createElement('button');b.type='button';b.dataset.otherAction=s[0];b.dataset.mobileIcon=s[2];b.setAttribute('aria-label',s[1]);b.title=s[1];var t=document.createElement('span');t.textContent=s[1];b.append(t);b.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();if(s[0]==='reload')location.reload();else requestAll(s[0]==='open');});actions.append(b);});
  main.querySelectorAll('.market-actions button,.cross-status-actions button,.fold-all button,#pro-status button').forEach(function(b){if(b.dataset.otherAction)return;if(/모두 접기|모두 펼치기|다시 불러오기|새로고침/.test(b.textContent+' '+b.getAttribute('aria-label')))b.remove();});
  if(statusNode!==status){if(statusObserver)statusObserver.disconnect();statusNode=status;statusObserver=new MutationObserver(controls);statusObserver.observe(status,{childList:true});}
 }
 function tables(){
  main.querySelectorAll('table').forEach(function(t){
   var heads=Array.from(t.querySelectorAll('thead tr:last-child th'));if(!heads.length)return;
   if(!t.closest('.scroll')){var wrap=document.createElement('div');wrap.className='scroll v90-table-wrap';wrap.tabIndex=0;wrap.setAttribute('aria-label','표 내용');t.before(wrap);wrap.append(t);}
   if(!t.closest('#unified-tools')){t.classList.add('v90-table');if(heads.length>4)t.classList.add('v90-wide');t.classList.add('v90-mobile-cards');}
   heads.forEach(function(h){h.setAttribute('scope','col');});
   Array.from(t.tBodies).forEach(function(tb){Array.from(tb.rows).forEach(function(r){var col=0;Array.from(r.cells).forEach(function(c){if(c.colSpan===1){var label=heads[col]&&heads[col].textContent.trim().replace(/\s+/g,' ');if(label&&c.dataset.label!==label)c.dataset.label=label;if(label&&/가격|현재가|종가|금액|금리|수익률|등락|환율|진입|청산/.test(label))c.classList.add('v90-number');}col+=c.colSpan;});});});
  });
 }
 function ipo(){main.querySelectorAll('.ipo-card').forEach(function(card){var head=card.querySelector('.ipo-head'),detail=card.querySelector('.ipo-detail');if(!head||!detail||card.querySelector('.v90-ipo-fold'))return;var b=document.createElement('button');b.type='button';b.className='v90-ipo-fold';b.textContent=detail.classList.contains('open')?'접기 −':'펼치기 ＋';b.setAttribute('aria-expanded',String(detail.classList.contains('open')));if(detail.id)b.setAttribute('aria-controls',detail.id);b.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();var open=!detail.classList.contains('open'),run=function(){detail.classList.toggle('open',open);b.textContent=open?'접기 −':'펼치기 ＋';b.setAttribute('aria-expanded',String(open));};if(open)permit(run);else run();});head.append(b);new MutationObserver(function(){var on=detail.classList.contains('open');b.textContent=on?'접기 −':'펼치기 ＋';b.setAttribute('aria-expanded',String(on));}).observe(detail,{attributes:true,attributeFilter:['class']});});}
 function repair(){
  controls();tables();ipo();
  var brief=document.getElementById('pro-brief'),toc=document.getElementById('pro-toc'),status=document.getElementById('pro-status');if(toc){var anchor=brief||status;if(anchor&&anchor.nextElementSibling!==toc)anchor.after(toc);}
  var help=main.querySelector('.market-help,.cross-home-guide'),tools=document.getElementById('unified-tools');if(page==='crypto'&&tools&&help&&tools.nextElementSibling!==help)tools.after(help);
  if(page!=='crypto')main.querySelectorAll('#unified-tools,.market-return-tools,.unified-invest-link').forEach(function(n){n.remove();});
  var dial=document.getElementById('cf-dial');if(dial){var card=dial.closest('.card');if(!card)return;card.classList.add('v90-gauge-card');var insights=card.querySelector('.stock-insights-details'),summary=insights&&insights.querySelector('summary');if(summary&&insights.firstElementChild!==summary)insights.prepend(summary);var gauge=card.querySelector('.stock-gauge');if(gauge){gauge.href='https://alternative.me/crypto/fear-and-greed-index/';gauge.setAttribute('aria-label','가상화폐 공포탐욕지수 · Alternative.me');}}
  var nav=document.getElementById('pro-toc');if(nav)nav.querySelectorAll('.v86-menu').forEach(function(menu){if(menu.parentElement.tagName==='DETAILS')menu.parentElement.classList.add('v90-nav-group');});
 }
 repair();new MutationObserver(function(records){if(records.every(function(r){return r.target.closest&&r.target.closest('#pro-toc');}))return;if(pending)return;pending=setTimeout(function(){pending=null;repair();},200);}).observe(main,{childList:true,subtree:true});
 window.MK_OTHER_FOLD_ALL=requestAll;
})();
