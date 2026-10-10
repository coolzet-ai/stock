(function(){
 'use strict';
 if(!document.body.classList.contains('stock-v2'))return;
 document.body.classList.add('stock-content-protected');
 function editable(target){return !!(target&&target.closest&&target.closest('input,textarea,[contenteditable=""],[contenteditable="true"]'));}
 var notice=document.createElement('div');notice.className='stock-protection-notice';notice.setAttribute('role','status');notice.setAttribute('aria-live','polite');notice.hidden=true;document.body.appendChild(notice);var timer;
 function block(event){if(editable(event.target))return;event.preventDefault();clearTimeout(timer);notice.textContent='본문 복사·드래그는 제한됩니다. 공유 시 페이지 링크와 출처를 표시해 주세요.';notice.hidden=false;timer=setTimeout(function(){notice.hidden=true;},2400);}
 ['copy','cut','paste','dragstart','drop','contextmenu'].forEach(function(type){document.addEventListener(type,block,true);});
 document.addEventListener('selectstart',function(event){if(!editable(event.target))event.preventDefault();},true);
 document.addEventListener('keydown',function(event){if(editable(event.target))return;if((event.ctrlKey||event.metaKey)&&['a','c','x','v'].indexOf(event.key.toLowerCase())>=0)block(event);});
 var stamp=document.createElement('aside');stamp.className='stock-source-stamp';stamp.setAttribute('aria-label','출처 및 권리 안내');
 var source=document.createElement('a');source.href='https://coolzet-ai.github.io/stock/stock.html';source.textContent='출처: Mr.Kim Signal · coolzet-ai.github.io/stock';
 var rights=document.createElement('span');rights.textContent='© Mr.Kim Signal 구성·해설 · 데이터 권리: 각 제공처';stamp.append(source,rights);document.body.appendChild(stamp);
 var mark=document.createElement('div');mark.className='stock-capture-watermark';mark.setAttribute('aria-hidden','true');document.body.appendChild(mark);
 document.querySelectorAll('img').forEach(function(img){img.draggable=false;});
})();
