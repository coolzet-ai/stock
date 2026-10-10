(function(){
 'use strict';
 var selector='.fold-btn,.m-fold-btn,.fold-all button,.ev-tg,.cal-more-btn,.ev-more-btn,.lead-pc,.my-more';
 function sync(){document.querySelectorAll(selector).forEach(function(b){b.classList.add('stock-disclosure-button');var html=b.innerHTML.replace(/➕/g,'＋').replace(/➖/g,'−').replace(/▴|▲/g,'−').replace(/▾|▼/g,'＋');if(b.innerHTML!==html)b.innerHTML=html;if(b.classList.contains('m-fold-btn')){var card=b.closest('.m-fold'),state=String(!!(card&&card.classList.contains('m-open')));if(b.getAttribute('aria-expanded')!==state)b.setAttribute('aria-expanded',state);}});}
 sync();var timer;new MutationObserver(function(){clearTimeout(timer);timer=setTimeout(sync,40);}).observe(document.body,{childList:true,subtree:true});
})();
