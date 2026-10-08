/* 모바일(≤700px) 전용 보강: ① 헤더 자동 숨김 ④ 작은 글씨 12px 보정 ⑤ 종목 행 탭 펼침 */
(function(){
  if(!document.body.classList.contains('pro')) return;
  var mq=window.matchMedia('(max-width:700px)');
  /* ① 아래로 스크롤하면 헤더를 숨기고(목차만 고정), 위로 올리면 다시 보인다 */
  var hd=document.querySelector('header'), last=window.scrollY, hidden=false, tick=false;
  var setH=function(h){ if(h===hidden||!hd) return; hidden=h; hd.classList.toggle('m-hide',h);
    var t=document.getElementById('pro-toc'); if(t) t.style.top=h?'0px':hd.offsetHeight+'px'; };
  window.addEventListener('scroll',function(){ if(tick) return; tick=true; requestAnimationFrame(function(){ tick=false;
    if(!mq.matches){ setH(false); return; }
    var nt=document.querySelector('.nav-toggle'); if(nt&&nt.getAttribute('aria-expanded')==='true'){ setH(false); return; }
    var y=window.scrollY, d=y-last;
    if(y<120) setH(false); else if(d>8) setH(true); else if(d<-8) setH(false);
    if(Math.abs(d)>8) last=y; }); },{passive:true});
  /* ④ 본문성 글씨가 12px 미만이면 12px로 올린다(종목 행의 신호 배지 .tb 는 11px 허용) */
  var fixing=false, fixFonts=function(){
    if(!mq.matches||fixing) return; fixing=true;
    var root=document.getElementById('main')||document.body, els=root.querySelectorAll('*');
    for(var i=0;i<els.length;i++){ var e=els[i];
      if(e.dataset&&e.dataset.fs) continue;
      var has=false, c=e.childNodes; for(var k=0;k<c.length;k++){ if(c[k].nodeType===3&&c[k].textContent.trim().length>1){ has=true; break; } }
      if(!has||e.closest('svg')) continue;
      var fs=parseFloat(getComputedStyle(e).fontSize);
      if(fs<12){ e.style.fontSize=(e.classList.contains('tb')?Math.max(fs,11):12)+'px'; }
      e.dataset.fs='1'; }
    fixing=false; };
  var tm=null, later=function(){ clearTimeout(tm); tm=setTimeout(fixFonts,700); };
  [1200,3500,8000,15000].forEach(function(t){ setTimeout(fixFonts,t); });
  var mo=new MutationObserver(later); var mn=document.getElementById('main'); if(mn) mo.observe(mn,{childList:true,subtree:true});
  /* ⑤ 종목 행: 가격 영역을 누르면 지표 배지·52주·바로가기가 펼쳐진다 */
  var deco=function(){ if(!mq.matches) return;
    document.querySelectorAll('#main .wl-row .wl-quote:not([data-mx])').forEach(function(q){ q.setAttribute('data-mx','1'); q.setAttribute('role','button'); q.setAttribute('tabindex','0'); q.setAttribute('aria-expanded','false'); q.setAttribute('aria-label','상세 지표 펼치기'); }); };
  var toggle=function(q){ var r=q.closest('.wl-row'); if(!r) return; var on=r.classList.toggle('m-x'); q.setAttribute('aria-expanded',on?'true':'false'); q.setAttribute('aria-label',on?'상세 지표 접기':'상세 지표 펼치기'); setTimeout(fixFonts,100); };
  document.addEventListener('click',function(e){ if(!mq.matches) return; var q=e.target.closest&&e.target.closest('.wl-quote[data-mx]'); if(q&&!e.target.closest('a,button')) toggle(q); });
  document.addEventListener('keydown',function(e){ if((e.key==='Enter'||e.key===' ')&&e.target.matches&&e.target.matches('.wl-quote[data-mx]')){ e.preventDefault(); toggle(e.target); } });
  var mo2=new MutationObserver(function(){ clearTimeout(mo2._t); mo2._t=setTimeout(deco,300); }); if(mn) mo2.observe(mn,{childList:true,subtree:true});
  [800,2500,6000].forEach(function(t){ setTimeout(deco,t); });
})();
