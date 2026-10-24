/* Explicit allowed actions; never evaluate attribute strings as JavaScript. */
(function(){
 'use strict';
 document.addEventListener('click',function(event){
  var el=event.target.closest&&event.target.closest('[data-stock-click]');if(!el)return;
  var action=el.getAttribute('data-stock-click')||'',m;
  if((m=/^toggleUsFinancials\('([A-Z0-9.^=\-]{1,15})'(?:,'(fin(?:my|x\d+)?-)')?\)$/.exec(action))){event.preventDefault();if(typeof toggleUsFinancials==='function')toggleUsFinancials(m[1],m[2]);}
  else if((m=/^toggleEtfHoldings\('([A-Z0-9.^=\-]{1,15})',event\)$/.exec(action))){event.preventDefault();if(typeof toggleEtfHoldings==='function')toggleEtfHoldings(m[1],event);}
  else if((m=/^toggleMoreRows\('(cap[23]|krcap2|krkq2)'\)$/.exec(action))){event.preventDefault();if(typeof toggleMoreRows==='function')toggleMoreRows(m[1]);}
  else if((m=/^toggleFinancials\('(\d{6})'(?:,event)?\)$/.exec(action))){event.preventDefault();if(typeof toggleFinancials==='function')toggleFinancials(m[1],event);}
  else if(action==='toggleKrFundDetail()'){if(typeof toggleKrFundDetail==='function')toggleKrFundDetail();}
  else if(action==='toggleFinSavingsExpand()'){if(typeof toggleFinSavingsExpand==='function')toggleFinSavingsExpand();}
  else if((m=/^var e=document.querySelectorAll\('\.(fin-more-[a-z0-9-]+)'\);/.exec(action))){var open=el.dataset.o!=='1';document.querySelectorAll('.'+m[1]).forEach(function(row){row.style.display=open?'table-row':'none';});if(!el.dataset.closedText)el.dataset.closedText=el.textContent;el.dataset.o=open?'1':'0';el.textContent=open?'접기 ▲':el.dataset.closedText;}
 });
 document.addEventListener('change',function(event){var el=event.target,action=el.getAttribute&&el.getAttribute('data-stock-change'),m;if(action&&(m=/^relToggle\('([A-Za-z0-9_-]+)',(\d+),this.checked\)$/.exec(action))&&typeof relToggle==='function')relToggle(m[1],Number(m[2]),el.checked);});
 document.addEventListener('error',function(event){var el=event.target;if(!(el instanceof HTMLImageElement))return;var action=el.getAttribute('data-stock-error');if(action==="this.style.display='none'")el.style.display='none';else if(action==="this.parentNode.classList.add('noimg');this.remove()"){if(el.parentNode)el.parentNode.classList.add('noimg');el.remove();}},true);
})();
