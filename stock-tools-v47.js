(function(){
 'use strict';
 var personal=document.querySelector('.stock-personal-details'),brief=document.getElementById('pro-brief');if(!personal||!brief)return;
 var hub=document.createElement('section');hub.className='stock-tools-hub';hub.setAttribute('aria-labelledby','stock-tools-title');
 hub.innerHTML='<div class="stock-tools-heading"><h2 id="stock-tools-title">내 투자 도구</h2><span>저장 정보는 이 브라우저에서 관리</span></div><nav class="stock-tools-links" aria-label="내 투자 도구 바로가기"><button type="button" data-tool="my-wl">관심종목</button><button type="button" data-tool="mk-acct">내 계좌</button><button type="button" data-tool="mk-cmp">종목 비교</button></nav>';
 var toc=document.getElementById('pro-toc');(toc||brief).after(hub);hub.appendChild(personal);
 function syncDisclosure(){personal.querySelector('summary').textContent=personal.open?'투자 도구 접기':'투자 도구 열기';}
 syncDisclosure();personal.addEventListener('toggle',function(){syncDisclosure();if(personal.open&&!hub.querySelector('[aria-current]')){hub.querySelector('[data-tool="my-wl"]').click();}});
 ['my-wl','mk-acct','mk-cmp','mk-eve'].forEach(function(id){var e=document.getElementById(id);if(e)personal.appendChild(e);});
 var icons={
  'my-wl':['내 관심종목','<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9z"/>'],
  'mk-acct':['내 계좌 · 손익·비중','<path d="M4 6h15v14H4zM4 6V4h13v2m-3 6h7v5h-7z"/>'],
  'mk-cmp':['종목 비교','<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>']
 };
 Object.keys(icons).forEach(function(id){var h=document.querySelector('#'+id+' h3>span:first-child');if(!h)return;h.textContent=icons[id][0];var svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('class','stock-tool-icon');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');svg.innerHTML=icons[id][1];h.prepend(svg);});
 var pending=null;
 hub.querySelector('.stock-tools-links').addEventListener('click',function(e){var b=e.target.closest('button[data-tool]');if(!b)return;var target=document.getElementById(b.dataset.tool);if(!target)return;
  personal.open=true; ['my-wl','mk-acct','mk-cmp','mk-eve'].forEach(function(id){var panel=document.getElementById(id);if(panel)panel.hidden=id!==b.dataset.tool;});
  if(target.classList.contains('m-fold')&&!target.classList.contains('m-open')){var fold=target.querySelector('.m-fold-btn');if(fold)fold.click();}
  hub.querySelectorAll('[data-tool]').forEach(function(x){var on=x===b;x.classList.toggle('on',on);if(on)x.setAttribute('aria-current','true');else x.removeAttribute('aria-current');});
  if(pending)clearTimeout(pending);hub.querySelectorAll('.stock-tool-selected').forEach(function(x){x.classList.remove('stock-tool-selected');});target.classList.add('stock-tool-selected');pending=setTimeout(function(){target.classList.remove('stock-tool-selected');},1800);
  target.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
 });
 function fields(selector,names){var form=document.querySelector(selector);if(!form)return;var fields=form.querySelectorAll('input:not([type=hidden])');fields.forEach(function(input,i){if(!names[i])return;var label=document.createElement('label');label.className='stock-tool-field';var span=document.createElement('span');span.textContent=names[i];input.before(label);label.appendChild(span);label.appendChild(input);});}
 var note=document.querySelector('#mk-acct>p.mut');if(note){var extra=document.createElement('details');extra.className='stock-tools-note';var title=document.createElement('summary');title.textContent='계산 기준·데이터 안내';extra.appendChild(title);note.before(extra);extra.appendChild(note);}
 fields('#my-wl .my-add',['종목 티커']);fields('#mk-acct .ac-add',['종목 티커','보유 수량','평균단가 ($)']);fields('#mk-cmp .cm-f',['비교 종목 1','비교 종목 2','비교 종목 3']);
 if(toc){
  var links=Array.from(toc.querySelectorAll('a'));
  var groups=[['시장지표',['공탐','섹터','내부지표','지수비교']],['종목분석',['김군 관심종목','시총 TOP10','레버리지','소셜','유니콘','이벤트','편입·편출']]];
  groups.forEach(function(group){var d=document.createElement('details');d.className='stock-nav-group';var summary=document.createElement('summary');summary.textContent=group[0];d.appendChild(summary);var list=document.createElement('div');d.appendChild(list);links.filter(function(a){return group[1].indexOf(a.textContent.trim())>=0;}).forEach(function(a){list.appendChild(a);});toc.appendChild(d);});
  var investment=document.createElement('button');investment.type='button';investment.className='stock-nav-invest';investment.textContent='내 투자';investment.addEventListener('click',function(){hub.querySelector('[data-tool="my-wl"]').click();});toc.appendChild(investment);
  var calendar=links.find(function(a){return a.textContent.trim()==='일정';});if(calendar)toc.appendChild(calendar);
  toc.addEventListener('click',function(e){if(e.target.closest('.stock-nav-group a'))e.target.closest('.stock-nav-group').open=false;});
 }
})();
