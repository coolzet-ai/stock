(function(){
 'use strict';
 var lead=document.querySelector('.pg-lead'); if(!lead)return;
 var box=document.createElement('div');box.className='stock-status';box.dataset.state='loading';
 var label=document.createElement('p'); label.textContent='데이터 연결을 확인하고 있습니다. 공개 시세는 지연될 수 있습니다.';
 label.setAttribute('role','status');label.setAttribute('aria-live','polite');
 var retry=document.createElement('button');retry.type='button';retry.textContent='다시 불러오기';retry.addEventListener('click',function(){location.reload();});
 box.append(label,retry);lead.after(box);
 var lastMessage=''; var begun=Date.now();
 function update(){
  var net=window.MK_NET, text, state;
  if(!navigator.onLine){state='error';text='오프라인입니다. 표시된 값은 최신 데이터가 아닐 수 있습니다.';}
  else if(net&&net.lastOk){
   var age=Date.now()-net.lastOk, failed=net.log.slice(-4).length===4&&net.log.slice(-4).every(function(x){return !x;});
   state=failed||age>180000?'error':'ok';
   text=(state==='ok'?'일부 데이터 연결됨':'일부 데이터 갱신 지연')+' · 최근 성공한 요청 '+new Date(net.lastOk).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})+' · 카드별 기준시각을 확인하세요.';
  }else if(Date.now()-begun>20000){state='error';text='데이터를 불러오지 못했습니다. 네트워크를 확인하거나 다시 불러와 주세요.';}
  else{state='loading';text='데이터 연결을 확인하고 있습니다. 공개 시세는 지연될 수 있습니다.';}
  var market=document.querySelector('#pro-status .ps-mk');if(market)text=market.textContent.trim()+' · '+text;
  box.dataset.state=state;if(lastMessage!==text){label.textContent=text;lastMessage=text;}
 }
 update();setInterval(update,5000);window.addEventListener('online',update);window.addEventListener('offline',update);
})();
