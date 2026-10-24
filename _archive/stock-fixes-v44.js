(function(){
 'use strict';
 function disclosure(cls,label){var d=document.createElement('details');d.className=cls;var s=document.createElement('summary');s.textContent=label;d.appendChild(s);return d;}
 var trend=document.getElementById('us-trend');
 if(trend){var host=trend.parentElement,d=disclosure('stock-trend-details','최근 흐름 그래프 · 세부보기');host.before(d);d.appendChild(host);var media=matchMedia('(max-width:700px)');function sync(){d.open=!media.matches;}sync();media.addEventListener('change',sync);}
 document.querySelectorAll('#unicorn .uc-grid').forEach(function(c){var d=disclosure('stock-company-details','투자자·관련 뉴스 보기');['us','kr','news'].forEach(function(key){var e=c.querySelector('.uc-'+key);if(e)d.appendChild(e);});if(d.children.length>1)c.appendChild(d);});
 function buttons(){document.querySelectorAll('#my-wl .wl-actions .ts-link:not([data-stock-label])').forEach(function(a){a.dataset.stockLabel='1';a.textContent='X 검색';a.setAttribute('aria-label','X에서 관련 게시물 검색');});document.querySelectorAll('#my-wl .my-del:not([data-stock-label])').forEach(function(b){b.dataset.stockLabel='1';b.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 10v7m4-7v7"/></svg><span>삭제</span>';});}
 buttons();var watch=document.getElementById('my-wl');if(watch)new MutationObserver(buttons).observe(watch,{childList:true,subtree:true});
})();
