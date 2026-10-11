(function(){
 'use strict';
 if(!/\/kr-stock\.html$/.test(location.pathname))return;
 var main=document.querySelector('main');if(!main)return;
 document.body.classList.add('kr-standard');
 var observedStatus;
 function repairStatus(){
  var status=document.getElementById('pro-status');if(!status)return;
  var market=status.querySelector('.ps-mk'),network=status.querySelector('.ps-net');if(market)market.dataset.compact=/휴장/.test(market.textContent)?'휴장':/마감/.test(market.textContent)?'마감':'한국장';if(network)network.dataset.compact=/불안정|오류/.test(network.textContent)?'연결 확인':/누락|지연/.test(network.textContent)?'일부 누락':/정상/.test(network.textContent)?'정상':'확인 중';
  var actions=status.querySelector('.v87-status-actions');if(!actions){actions=document.createElement('div');actions.className='v87-status-actions';status.append(actions);}
  [['reload','다시 불러오기','↻'],['close','모두 접기','−'],['open','모두 펼치기','＋']].forEach(function(spec){if(actions.querySelector('[data-kr-action="'+spec[0]+'"]'))return;var b=document.createElement('button');b.type='button';b.dataset.krAction=spec[0];b.dataset.mobileIcon=spec[2];b.title=spec[1];b.setAttribute('aria-label',spec[1]);var label=document.createElement('span');label.className='v87-button-label';label.textContent=spec[1];b.append(label);b.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();if(spec[0]==='reload')location.reload();else if(window.MK_KR_FOLD_ALL)window.MK_KR_FOLD_ALL(spec[0]==='open');});actions.append(b);});
  status.querySelectorAll('button:not([data-kr-action])').forEach(function(b){if(/모두 접기|모두 펼치기|다시 불러오기|새로고침/.test(b.textContent+' '+b.getAttribute('aria-label')))b.remove();});
  if(observedStatus!==status){observedStatus=status;new MutationObserver(repairStatus).observe(status,{childList:true});}
 }
 function text(node,value){if(node&&node.textContent!==value)node.textContent=value;}
 function repair(){
  repairStatus();
  var head=document.querySelector('.v86-page-head');
  if(head&&!head.querySelector('.kr-page-subtitle')){var p=document.createElement('p');p.className='kr-page-subtitle';p.textContent='공포탐욕지수 · 투자자 동향 · 시가총액 · 경제일정';head.querySelector('h1').after(p);}
  var status=document.getElementById('pro-status');
  if(status){var market=status.querySelector('.ps-mk'),network=status.querySelector('.ps-net');if(market)market.dataset.compact=/휴장/.test(market.textContent)?'휴장':/마감/.test(market.textContent)?'마감':'한국장';if(network)network.dataset.compact=/불안정|오류/.test(network.textContent)?'연결 확인':/누락|지연/.test(network.textContent)?'일부 누락':/정상/.test(network.textContent)?'정상':'확인 중';}
  var card=document.getElementById('kr-card'),sub=document.getElementById('kr-sub');
  if(card){text(card.querySelector('h3'),'공포탐욕지수');text(card.querySelector('.fg-src'),'코스피 기준 자체 산출 · 0 극단적 공포 ~ 100 극단적 탐욕');
   var insight=card.querySelector('.stock-insights-details'),summary=insight&&insight.querySelector('summary');if(summary&&insight.firstElementChild!==summary)insight.prepend(summary);
   var breadth=document.getElementById('kr-breadth-flow');if(breadth&&!document.getElementById('kr-breadth-panel')){var details=document.createElement('details'),s=document.createElement('summary');details.id='kr-breadth-panel';details.className='kr-standard-panel cross-restricted';s.textContent='시장 내부지표 · 상승·하락 수급';s.addEventListener('click',function(e){if(details.open)return;if(window.MK_REQUEST_DETAIL){e.preventDefault();window.MK_REQUEST_DETAIL(function(){details.open=true;});}});details.append(s,breadth);card.closest('.grid').after(details);}
  }
  if(sub){var sc=sub.closest('.card');sc.id='kr-indicator-card';var h=sc.querySelector('h3'),label=h&&h.querySelector('span:not(.m-fold-btn span)');text(label,'한국 공포탐욕 7개 세부지표');var foot=sc.querySelector('p.mut');text(foot,'코스피·KRX 파생상품·한국은행 지표를 0~100점으로 환산합니다. 미수신 항목은 점수 계산에서 제외하며, 산식과 출처는 아래 설명에서 확인하세요.');}
  var tools=document.getElementById('unified-tools'),help=document.getElementById('guide');if(tools&&help&&tools.nextElementSibling!==help)tools.after(help);
  var resume=document.getElementById('mk-resume');if(resume&&help&&resume.previousElementSibling!==help)help.after(resume);
  main.querySelectorAll('.wl-row').forEach(function(row){var spark=row.querySelector('.wl-spark');if(spark)spark.setAttribute('aria-label','최근 가격 흐름');});
 }
 repair();var timer;new MutationObserver(function(records){if(records.every(function(r){return r.target.closest&&r.target.closest('#pro-toc');}))return;clearTimeout(timer);timer=setTimeout(repair,150);}).observe(main,{childList:true,subtree:true});
})();
(function(){
 'use strict';if(!/\/kr-stock\.html$/.test(location.pathname))return;
 function permit(fn){if(window.MK_REQUEST_DETAIL)window.MK_REQUEST_DETAIL(fn);else fn();}
 var indicator=document.getElementById('kr-indicator-card');if(indicator){indicator.classList.add('cross-open','m-open');var b=indicator.querySelector('.m-fold-btn');if(b){b.innerHTML='<em>접기</em> −';b.setAttribute('aria-expanded','true');}var grid=indicator.closest('.grid');if(grid)grid.classList.add('kr-sentiment-grid');}
 var tools=document.getElementById('unified-tools');if(tools)tools.classList.add('kr-tools-standard');
 var guide=document.getElementById('guide'),head=document.getElementById('guide-h');
 if(guide&&head&&!head.querySelector('.kr-help-button')){guide.classList.add('kr-guide-standard');var button=document.createElement('button');button.type='button';button.className='kr-help-button';button.textContent='Help ⓘ';button.setAttribute('aria-label','지표 읽는 법 · 용어 설명 펼치기');button.setAttribute('aria-expanded','false');head.append(button);var dl=guide.querySelector('.gl-list');if(dl){dl.id='kr-glossary-list';button.setAttribute('aria-controls',dl.id);}function isOpen(){return head.classList.contains('open');}function sync(){button.setAttribute('aria-expanded',String(isOpen()));}button.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();var open=!isOpen(),run=function(){if(typeof head._set==='function')head._set(open);else{head.classList.toggle('open',open);if(dl)dl.hidden=!open;}sync();};if(open)permit(run);else run();});new MutationObserver(sync).observe(head,{attributes:true,attributeFilter:['class']});sync();}
})();
