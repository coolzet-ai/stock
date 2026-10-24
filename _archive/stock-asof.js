/* 데이터 기준일·갱신 주기 표시 — <p class="asof" data-asof="YYYY-MM[-DD]" data-label=".." data-cycle=".."> 를 같은 형식으로 렌더링.
   n개월 전 자료로 표시하고 3개월 이상 지나면 주황색 "갱신 필요" 배지를 붙입니다. */
(function(){
  var now=new Date();
  var fmt=function(a){ var p=a.split('-'); return p[0]+'.'+p[1]+(p[2]?'.'+p[2]:''); };
  var age=function(a){
    var p=a.split('-').map(Number), d=new Date(p[0],p[1]-1,p[2]||1);
    var days=Math.floor((now-d)/86400000), mon=(now.getFullYear()-p[0])*12+(now.getMonth()-(p[1]-1));
    if(p[2]&&now.getDate()<p[2]) mon-=1;
    if(mon<0) mon=0;
    var txt= mon>=1 ? mon+'개월 전 자료' : (days>=7 ? Math.floor(days/7)+'주 전 자료' : (days>=1 ? days+'일 전 자료' : '오늘 자료'));
    return {txt:txt, old:mon>=3, mon:mon};
  };
  var esc=function(t){ return String(t).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); };
  document.querySelectorAll('.asof').forEach(function(el){
    var link=el.querySelector('a'), a=el.getAttribute('data-asof'), lb=el.getAttribute('data-label')||'데이터', cy=el.getAttribute('data-cycle')||'';
    var h='';
    if(el.classList.contains('est')) h+='<span class="ao-b ao-e">추정·비공식</span>';
    if(a){ var g=age(a); h+='<span class="ao-b'+(g.old?' old':'')+'">'+esc(lb)+' 기준 '+fmt(a)+' · '+g.txt+(g.old?' · 갱신 필요':'')+'</span>'; }
    else h+='<span class="ao-b">'+esc(lb)+'</span>';
    if(cy) h+='<span>갱신: '+esc(cy)+'</span>';
    var nx=el.getAttribute('data-next');
    if(nx) h+='<span class="ao-n">다음 갱신 예정 '+esc(nx)+'</span>';
    var fb=(window.MK_CFG&&window.MK_CFG.updateRequestUrl)||'';
    if(fb && /^https:\/\//.test(fb) && (a||nx)) h+='<a class="ao-r" href="'+esc(fb)+'" target="_blank" rel="noopener">갱신 요청</a>';
    el.innerHTML=h; if(link) el.appendChild(link);
  });
  /* 갱신 요청 링크: 페이지에서 window.MK_CFG={updateRequestUrl:'https://…'} 로 지정하면 표시(미지정 시 숨김). */
  /* 정적 공탐 문구는 라이브 값이 뜨면 숨김(검색 봇·미리보기용) */
  var st=document.getElementById('static-fg');
  if(st){ var t=0, iv=setInterval(function(){ var v=document.getElementById('us-val'); if(v&&/\d/.test(v.textContent||'')){ st.hidden=true; clearInterval(iv); } if(++t>40) clearInterval(iv); },500); }
})();
