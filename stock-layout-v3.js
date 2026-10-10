/* US-only visual layout. Existing IDs, data objects and event handlers stay intact. */
(function(){
 'use strict';
 var wrap=document.querySelector('#stock > .wrap'),brief=document.getElementById('pro-brief');
 if(!wrap||!brief)return;var foldAll=document.querySelector('.fold-all');if(foldAll)brief.before(foldAll);
 function details(className,title){var d=document.createElement('details');d.className=className;var s=document.createElement('summary');s.textContent=title;d.appendChild(s);return d;}
 // Keep the live ticker available on demand; avoid an extra sticky toolbar.
 var market=details('stock-market-details','주요 지수·환율 시세 보기');
 var ticker=document.getElementById('pro-tick');if(ticker)market.appendChild(ticker);
 var status=document.getElementById('pro-status');if(status){status.hidden=true;market.appendChild(status);}
 if(ticker){var live=ticker.querySelector('.pt-live');if(live)live.textContent='● 주요 시세';var track=document.createElement('div');track.className='stock-ticker-track';while(ticker.firstChild)track.appendChild(ticker.firstChild);ticker.appendChild(track);}
 var state=document.querySelector('.stock-status');if(state)state.after(market);else brief.before(market);
 var session=document.createElement('span');session.className='stock-session';session.setAttribute('aria-label','미국 시장 상태');
 var head=brief.querySelector('.pb-hd');if(head)head.appendChild(session);
 function syncSession(){var e=document.querySelector('#pro-status .ps-mk');session.textContent=e?e.textContent:'미국 시장';}
 syncSession();if(status)new MutationObserver(syncSession).observe(status,{childList:true,subtree:true,characterData:true});
 // Put dense commentary and futures behind a native, keyboard-accessible disclosure.
 var more=details('stock-brief-details','시장 요약·선물 흐름 보기');
 ['pb-state','pb-line','pb-fut'].forEach(function(id){var e=document.getElementById(id);if(e)more.appendChild(e);});
 brief.appendChild(more);
 var desktop=window.matchMedia('(min-width:701px)');
 function syncDesktop(){document.querySelectorAll('.stock-market-details,.stock-insights-details').forEach(function(d){d.open=false;});}
 desktop.addEventListener('change',syncDesktop);setTimeout(syncDesktop,0);
 var toc=document.getElementById('pro-toc');if(toc){brief.after(toc);var search=toc.querySelector('.pt-s');if(search&&search.firstChild&&search.firstChild.nodeType===3){search.firstChild.textContent='';var icon=document.createElementNS('http://www.w3.org/2000/svg','svg');icon.setAttribute('viewBox','0 0 24 24');icon.setAttribute('class','stock-search-icon');icon.setAttribute('aria-hidden','true');icon.innerHTML='<circle cx="10" cy="10" r="6" fill="none" stroke="currentColor" stroke-width="2"/><path d="m15 15 6 6" stroke="currentColor" stroke-width="2"/>';search.prepend(icon);}}
 // Keep personal tools available below the primary market analytics.
 var personal=details('stock-personal-details','관심종목·계좌·종목 비교 도구');
 ['mk-eve','my-wl','mk-acct','mk-cmp'].forEach(function(id){var e=document.getElementById(id);if(e)personal.appendChild(e);});
 if(personal.children.length>1){var calendar=document.getElementById('pro-cal');if(calendar)calendar.after(personal);else wrap.appendChild(personal);}
 // Live gauge reads the original CNN value. Missing data is never replaced with a sample.
 var card=document.getElementById('us-card'),source=document.getElementById('us-val');
 if(card&&source){
  var h=card.querySelector('.fg-hd h3');if(h)Array.from(h.childNodes).forEach(function(n){if(n.nodeType===3)n.textContent=n.textContent.replace('🇺🇸','').trim();});
  var gauge=document.createElement('a');gauge.className='stock-gauge';gauge.href='https://www.cnn.com/markets/fear-and-greed';gauge.target='_blank';gauge.rel='noopener noreferrer';
  gauge.innerHTML='<svg viewBox="0 0 240 160" role="img" aria-label="공포탐욕지수 연결 중"><g class="sg-segments"></g><path class="sg-pointer" fill="currentColor" hidden></path><text class="sg-value" x="120" y="111" text-anchor="middle">—</text><text class="sg-label" x="120" y="137" text-anchor="middle">데이터 연결 중</text><text class="sg-edge" x="19" y="147" text-anchor="start">공포 0</text><text class="sg-edge" x="221" y="147" text-anchor="end">100 탐욕</text></svg>';
  var svg=gauge.querySelector('svg'),group=gauge.querySelector('.sg-segments'),colors=['#ef8e86','#f3c17a','#e7dba0','#9bd5ba','#4bb792'];
  function point(angle,r){return [120+Math.cos(angle)*r,119-Math.sin(angle)*r];}
  colors.forEach(function(color,i){var start=point(Math.PI-i*Math.PI/5-.02,94),end=point(Math.PI-(i+1)*Math.PI/5+.02,94),p=document.createElementNS('http://www.w3.org/2000/svg','path');p.setAttribute('d','M '+start.join(' ')+' A 94 94 0 0 1 '+end.join(' '));p.setAttribute('fill','none');p.setAttribute('stroke',color);p.setAttribute('stroke-width','17');group.appendChild(p);});
  card.querySelector('.fg-top').prepend(gauge);
  var insights=details('stock-insights-details','지수 해석·관련 일정 보기');
  ['pro-kc','fg-alert','us-next-event'].forEach(function(id){var e=document.getElementById(id);if(e)insights.appendChild(e);});
  card.appendChild(insights);
  function syncGauge(){
   var text=source.textContent.trim(),n=Number(text),ok=text!==''&&Number.isFinite(n)&&n>=0&&n<=100;
   gauge.querySelector('.sg-value').textContent=ok?String(Math.round(n)):'—';
   var label=ok?(n<25?'극단적 공포':n<45?'공포':n<=55?'중립':n<=75?'탐욕':'극단적 탐욕'):'데이터 연결 중';
   gauge.querySelector('.sg-label').textContent=label;svg.setAttribute('aria-label',ok?'공포탐욕지수 '+Math.round(n)+'점 · '+label:'공포탐욕지수 연결 중');
   var arrow=gauge.querySelector('.sg-pointer');arrow.style.display=ok?'':'none';
   if(ok){arrow.removeAttribute('hidden');var a=Math.PI*(1-n/100),tip=point(a,108),left=point(a-.065,82),right=point(a+.065,82);arrow.setAttribute('d','M '+tip.join(' ')+' L '+left.join(' ')+' L '+right.join(' ')+' Z');}
  }
  syncGauge();new MutationObserver(syncGauge).observe(source,{childList:true,subtree:true,characterData:true});
 }
 
 var icons=['<path d="M4 20V10h4v10m4 0V4h4v16m4 0v-7h-1"/>','<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9z"/>','<path d="M4 6h15v14H4zM4 6V4h13v2m-3 6h7v5h-7z"/>','<path d="M4 5h16v16H4zM4 10h16M8 3v4m8-4v4"/>','<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>'];
 document.querySelectorAll('#mk-tabbar .ti').forEach(function(el,i){el.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">'+icons[i]+'</svg>';});
 // Native disclosures must open when a direct anchor targets a contained tool.
 document.addEventListener('click',function(e){var a=e.target.closest('a[href^="#"]');if(!a)return;var id=a.getAttribute('href').slice(1),el=id&&document.getElementById(id);if(el){for(var p=el.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;}},true);
})();
