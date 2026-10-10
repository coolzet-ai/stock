(function(){
 'use strict';
 var selector='#my-wl .my-add input,#ac-t,#mk-cmp .cm-f input';
 function normalize(input){
  if(!input.matches(selector)||input.dataset.composing==='1')return;
  var value=input.value,start=input.selectionStart,end=input.selectionEnd,next=value.replace(/[a-z]/g,function(c){return c.toUpperCase();});
  if(value!==next){input.value=next;if(start!==null)input.setSelectionRange(start,end);}
  input.autocapitalize='characters';input.spellcheck=false;input.setAttribute('autocorrect','off');
 }
 document.addEventListener('input',function(e){if(e.target instanceof HTMLInputElement)normalize(e.target);},true);
 document.addEventListener('compositionstart',function(e){if(e.target.matches(selector))e.target.dataset.composing='1';},true);
 document.addEventListener('compositionend',function(e){if(e.target.matches(selector)){delete e.target.dataset.composing;normalize(e.target);}},true);
 document.addEventListener('focusin',function(e){if(e.target instanceof HTMLInputElement)normalize(e.target);});
 document.querySelectorAll(selector).forEach(normalize);
 var sub=document.getElementById('us-sub-note');if(sub){var caption=document.createElement('p');caption.className='stock-score-caption';caption.textContent='막대와 점수는 CNN 환산점수(0~100)입니다. 수익률·풋콜비율 등 원자료의 단위와 다릅니다.';sub.before(caption);}
 var account=document.getElementById('mk-acct');if(account){var privacy=document.createElement('p');privacy.className='stock-privacy';privacy.textContent='공용 기기에서는 계좌 정보를 저장하지 마세요. 이 사이트의 다른 페이지에서도 브라우저 저장 정보에 접근할 수 있습니다. ';var clear=document.createElement('button');clear.type='button';clear.textContent='저장된 계좌 정보 삭제';var armed=false,timer;clear.addEventListener('click',function(){if(!armed){armed=true;clear.textContent='다시 누르면 계좌 전체 삭제';timer=setTimeout(function(){armed=false;clear.textContent='저장된 계좌 정보 삭제';},5000);return;}clearTimeout(timer);localStorage.removeItem('mk_hold');sessionStorage.removeItem('mk_hold');localStorage.removeItem('stock_account_persist');localStorage.removeItem('mk_levcap');location.reload();});privacy.appendChild(clear);account.appendChild(privacy);}

})();
