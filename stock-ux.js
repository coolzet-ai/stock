/* 모바일 UX 보강 — 스켈레톤 로딩, 데이터 절약 스위치, 표→카드, 탭 스와이프, 당겨서 새로고침, 소개문 접기, 서비스워커 등록 */
(function(){
  if(!document.body.classList.contains('pro')) return;
  var mq=window.matchMedia('(max-width:700px)');
  /* ===== 스켈레톤: "--" / "불러오는 중…" 자리표시를 반짝이는 틀로 ===== */
  var SK_SEL='.wl-price,.wl-pct,#us-val,#us-state,#us-kimcomment,.mut,td.mut,.px,.ch';
  var skel=function(){
    document.querySelectorAll(SK_SEL).forEach(function(e){
      var t=(e.textContent||'').trim(), ph=(t==='--'||t==='불러오는 중'||t==='불러오는 중…'||t==='불러오는 중...');
      if(ph&&e.children.length===0){ if(!e.classList.contains('skel')) e.classList.add('skel'); }
      else if(e.classList.contains('skel')) e.classList.remove('skel'); }); };
  var main=document.getElementById('main'), st=null;
  var sched=function(){ clearTimeout(st); st=setTimeout(function(){ skel(); cards(); },350); };
  if(main) new MutationObserver(sched).observe(main,{childList:true,subtree:true,characterData:true});
  skel();
  /* ===== 데이터 절약 스위치 ===== */
  var saveOn=!!window.MK_SAVE;
  var wire=function(){
    var rf=document.getElementById('ps-rf'); if(!rf||document.getElementById('ps-save')) return;
    var b=document.createElement('button'); b.type='button'; b.id='ps-save'; b.setAttribute('aria-pressed',saveOn?'true':'false');
    b.title='켜면 자동 갱신 주기가 3배 길어지고 로고 이미지를 불러오지 않습니다'; b.textContent=saveOn?'📶 절약 ON':'📶 절약';
    b.onclick=function(){ try{ localStorage.setItem('mk_save',saveOn?'0':'1'); }catch(e){} location.reload(); };
    rf.before(b); };
  wire(); [800,2500].forEach(function(t){ setTimeout(wire,t); });
  /* ===== 원/달러 표기 방식 버튼: 상단 '원화 표시' 체크박스를 새로고침 왼쪽 버튼으로 옮김 ===== */
  var wireKrw=function(){
    var rf=document.getElementById('ps-rf'), cb=document.getElementById('krw-toggle'); if(!rf||!cb||document.getElementById('ps-krw')) return;
    var b=document.createElement('button'); b.type='button'; b.id='ps-krw';
    var sync=function(){ var on=cb.checked; b.setAttribute('aria-pressed',on?'true':'false'); b.textContent=on?'$+₩ 병기':'$ 달러'; b.title=on?'달러 가격 옆에 원화를 괄호로 함께 표시 중 (누르면 달러만 표시)':'달러로만 표시 중 (누르면 원화를 괄호로 병기)'; };
    b.onclick=function(){ cb.checked=!cb.checked; cb.dispatchEvent(new Event('change')); sync(); };
    cb.addEventListener('change',sync); sync();
    rf.before(b); var lb=cb.closest('label'); if(lb) lb.style.display='none'; };
  wireKrw(); [800,2500].forEach(function(t){ setTimeout(wireKrw,t); });
  /* ===== 표 → 카드(모바일): 각 칸에 머리글을 data-label 로 달아 CSS가 카드로 보여준다 ===== */
  var cards=function(){
    ['holidays-tbl','kr-holidays-tbl'].forEach(function(id){ var tb=document.getElementById(id); if(!tb) return; var tbl=tb.closest('table'); if(!tbl) return;
      var hs=[].map.call(tbl.querySelectorAll('thead th'),function(th){ var n=th.firstChild; return (n&&n.nodeType===3?n.textContent:th.textContent).trim(); });
      tbl.classList.add('m-cards');
      tb.querySelectorAll('tr').forEach(function(tr){ [].forEach.call(tr.children,function(td,i){ if(td.colSpan>1) return; if(!td.getAttribute('data-label')&&hs[i]) td.setAttribute('data-label',hs[i]); }); }); }); };
  cards();
  /* ===== 소개문 접기(모바일) ===== */
  var lead=document.querySelector('.pg-lead');
  if(lead){ var lb=document.createElement('button'); lb.type='button'; lb.className='lead-more'; lb.setAttribute('aria-expanded','false'); lb.textContent='소개 더보기 ▾';
    lb.onclick=function(){ var o=lead.classList.toggle('m-lead-open'); lb.setAttribute('aria-expanded',o?'true':'false'); lb.textContent=o?'접기 ▴':'소개 더보기 ▾'; };
    lead.after(lb); }
  /* ===== 탭 좌우 스와이프(기간 변경) ===== */
  var MAP={'tick-tbl':'tick','cap-tbl':'cap','lev-tbl':'lev','idxchg-tbl':'idxchg','krcap-tbl':'krcap','krkq-tbl':'krkq','krlev-tbl':'krlev','kridx-tbl':'kridx'};
  Object.keys(MAP).forEach(function(id){ var list=document.getElementById(id); if(!list) return;
    var area=list.closest('.scroll')||list, g=MAP[id], x0=0,y0=0,t0=0,on=false;
    var tabs=function(){ return document.querySelector('.tabs[data-group="'+g+'"]'); };
    var tb=tabs(); if(tb&&!tb.nextElementSibling.classList.contains('swipe-hint')){ var h=document.createElement('div'); h.className='swipe-hint'; h.textContent='↔ 목록을 좌우로 밀면 기간이 바뀝니다'; tb.after(h); }
    area.addEventListener('touchstart',function(e){ if(!mq.matches||e.touches.length!==1) return; on=true; x0=e.touches[0].clientX; y0=e.touches[0].clientY; t0=Date.now(); },{passive:true});
    area.addEventListener('touchend',function(e){ if(!on) return; on=false; var c=e.changedTouches[0], dx=c.clientX-x0, dy=c.clientY-y0;
      if(Math.abs(dx)<70||Math.abs(dy)>45||Date.now()-t0>650) return;
      var t=tabs(); if(!t) return; var bs=[].slice.call(t.querySelectorAll('button')); var i=bs.findIndex(function(b){ return b.classList.contains('on'); }); if(i<0) return;
      var n=i+(dx<0?1:-1); if(n<0||n>=bs.length) return; bs[n].click(); },{passive:true}); });
  /* ===== 당겨서 새로고침(맨 위에서만) ===== */
  var ptr=document.createElement('div'); ptr.id='ptr'; ptr.setAttribute('aria-hidden','true'); ptr.textContent='↓ 당겨서 새로고침'; document.body.appendChild(ptr);
  var py=0, pull=0, act=false;
  document.addEventListener('touchstart',function(e){ act=mq.matches&&window.scrollY<=0&&e.touches.length===1; py=e.touches[0].clientY; pull=0; },{passive:true});
  document.addEventListener('touchmove',function(e){ if(!act) return; var d=e.touches[0].clientY-py; if(d<=0||window.scrollY>0){ pull=0; ptr.style.transform=''; ptr.classList.remove('on'); return; }
    pull=Math.min(d,110); ptr.classList.add('on'); ptr.style.transform='translateY('+(pull*0.6-40)+'px)'; ptr.textContent=pull>=80?'↑ 놓으면 새로고침':'↓ 당겨서 새로고침'; },{passive:true});
  document.addEventListener('touchend',function(){ if(!act) return; act=false; var go=pull>=80; ptr.classList.remove('on'); ptr.style.transform='';
    if(go){ ptr.textContent='새로고침 중…'; location.reload(); } pull=0; },{passive:true});

  /* ===== 하단 긴 글: 용어 가이드·데이터 안내를 모바일에서 접어 둔다 ===== */
  var acc=function(head,body){ if(!mq.matches) return; var btn=document.createElement('button'); btn.type='button'; btn.className='acc-btn'; btn.setAttribute('aria-expanded','false');
    while(head.firstChild) btn.appendChild(head.firstChild); head.appendChild(btn); head.classList.add('acc-h'); body.classList.add('acc-b');
    btn.addEventListener('click',function(){ var o=head.classList.toggle('acc-open'); btn.setAttribute('aria-expanded',o?'true':'false'); body.classList.toggle('acc-show',o); }); };
  document.querySelectorAll('.gl-list dt').forEach(function(dt){ var dd=dt.nextElementSibling; if(dd&&dd.tagName==='DD') acc(dt,dd); });
  var dn=document.querySelector('.data-notice');
  if(dn){ var hb=dn.querySelector('b'), wrap=document.createElement('div'); [].slice.call(dn.querySelectorAll('.dl')).forEach(function(x){ wrap.appendChild(x); }); dn.appendChild(wrap); if(hb){ var br=hb.nextElementSibling; if(br&&br.tagName==='BR') br.remove(); acc(hb,wrap); } }
  var pcn=document.getElementById('pc-note'); if(pcn) pcn.addEventListener('click',function(){ pcn.classList.toggle('open'); });
  /* ===== 홈 화면 추가(PWA) 서비스워커 ===== */
  if('serviceWorker' in navigator&&(location.protocol==='https:'||location.hostname==='localhost')){
    window.addEventListener('load',function(){ navigator.serviceWorker.register('sw.js').catch(function(){}); }); }

  /* ===== 유니콘 카드: 주제별(기업가치·손익·상장·미국/한국 투자자·뉴스) 줄맞춤 — 카드 내용을 구역으로 묶고 subgrid 로 같은 줄에 맞춘다 ===== */
  (function(){ var g=document.querySelector('#unicorn .grid'); if(!g||!CSS.supports||!CSS.supports('grid-template-rows','subgrid')) return;
    var cards=g.querySelectorAll(':scope > .card'); if(!cards.length) return;
    var KEYS=['name','val','est','pnl','ipo','us','kr','news'];
    cards.forEach(function(c){ if(c.dataset.ucs) return; c.dataset.ucs='1';
      var kids=Array.prototype.slice.call(c.children), secs={}, cur='name', n=0;
      kids.forEach(function(k){ var t=(k.textContent||'').trim(), st=k.getAttribute('style')||'';
        if(k.id&&/^unicorn-news/.test(k.id)) cur='news';
        else if(n===0) cur='name';
        else if(n===1&&/display:\s*grid/.test(st)) cur='val';
        else if(k.classList&&k.classList.contains('asof')) cur='est';
        else if(/^손익/.test(t)) cur='pnl';
        else if(/border-left/.test(st)||/^상장/.test(t)) cur='ipo';
        else if(/^주요 투자자\s*—\s*미국/.test(t)) cur='us';
        else if(/^주요 투자자\s*—\s*한국/.test(t)) cur='kr';
        else if(/^최근 뉴스/.test(t)) cur='news';
        n++; (secs[cur]=secs[cur]||[]).push(k); });
      KEYS.forEach(function(key){ var d=document.createElement('div'); d.className='uc-sec uc-'+key; (secs[key]||[]).forEach(function(k){ d.appendChild(k); }); c.appendChild(d); });
      c.classList.add('uc-grid'); });
    g.classList.add('uc-on'); })();

  /* ===== 종목 행 버튼(+ X N 재무) 의미 안내 ===== */
  (function(){ ['tick-tbl','cap-tbl','idxchg-tbl','lev-tbl'].forEach(function(id){ var h=document.getElementById(id); if(!h||h.previousElementSibling&&h.previousElementSibling.classList.contains('act-legend')) return;
    var p=document.createElement('p'); p.className='act-legend'; p.setAttribute('aria-label','종목 행 버튼 설명');
    p.innerHTML='<span class="al-t">버튼 안내</span><span><b>➕ +</b> 상세지표(Finviz)</span><span><b>🐦 X</b> X(트위터) 검색</span><span><b>📰 N</b> 최신 뉴스</span><span><b>📊 재무</b> 재무비율</span><span class="al-m">모바일은 가격 영역을 누르면 펼쳐집니다</span>';
    h.before(p); }); })();
})();
