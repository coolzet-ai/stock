/* 섹션 접기/펼치기 — 동일한 제목 바(폰트 20px·줄간격 1.4), 좌측 포인트 선, 요약 칩, 펼치기/접기 버튼. 기본은 접힘 */
(function(){
  const SUM={
    '주요 지수 ETF 상대수익률 비교':()=>'지수 5종 · 그래프 + 상관관계',
    '김군 관심종목':()=>document.querySelectorAll('#tick-tbl .wl-row').length+'종목',
    '시가총액 TOP10':()=>'TOP10 (+11~20위)',
    '레버리지 ETF':()=>document.querySelectorAll('#lev-tbl .wl-row').length+'종목',
    '유니콘 기업':()=>document.querySelectorAll('#unicorn .card').length+'개사',
    '주요 이벤트 일정':()=>'월별 일정 · 휴장일',
    '지수 편입 · 편출 종목':()=>document.querySelectorAll('#idxchg-tbl .wl-row').length+'종목 · S&P500·나스닥100'
  };
  function fold(h2){
    if(!h2||h2.dataset.fold) return; h2.dataset.fold='1';
    const nodes=[]; let n=h2.nextElementSibling;
    while(n && n.tagName!=='H2'){ nodes.push(n); n=n.nextElementSibling; }
    const box=document.createElement('div'); box.className='fold-body'; h2.after(box); nodes.forEach(x=>box.appendChild(x));
    const title=h2.textContent.replace(/\s+/g,' ').trim();
    const key=Object.keys(SUM).find(k=>title.indexOf(k)===0);
    h2.className='fold-h'; h2.removeAttribute('style'); h2.id=h2.id||''; 
    const flag=(title.indexOf('🇺🇸')>=0||key)?' 🇺🇸':'';
    h2.innerHTML='<span class="fold-t">'+(key||title)+flag+'</span><span class="fold-sum"></span><span class="fold-btn"><em>펼치기</em> ➕</span>';
    h2.setAttribute('role','button'); h2.setAttribute('aria-expanded','false'); h2.tabIndex=0;
    const sum=h2.querySelector('.fold-sum'), btn=h2.querySelector('.fold-btn');
    const LST={'김군 관심종목':'tick-tbl','시가총액 TOP10':'cap-tbl','레버리지 ETF':'lev-tbl'};
    const movers=id=>{ const a=[]; document.querySelectorAll('#'+id+' .wl-row').forEach(r=>{ const c=r.querySelector('.ch'); if(!c) return; const m=c.textContent.match(/([\d.]+)\s*%/); if(!m) return; const v=parseFloat(m[1])*(/▼|-|−/.test(c.textContent)?-1:1); a.push([r.dataset.t,v]); }); if(a.length<2) return ''; a.sort((x,y)=>y[1]-x[1]); const u=a[0],d=a[a.length-1]; const f=x=>(x[1]>=0?'▲':'▼')+Math.abs(x[1]).toFixed(2)+'%'; return '<span class="mv"><span class="mv-l">'+a.length+'종목</span><span class="mv-u">'+u[0]+' '+f(u)+'</span><span class="mv-d">'+d[0]+' '+f(d)+'</span></span>'; };
    const refresh=()=>{ const id=LST[key]; const h=id?movers(id):''; if(h) sum.innerHTML=h; else sum.textContent=key?SUM[key]():''; };
    refresh(); [1500,4000,9000].forEach(t=>setTimeout(refresh,t)); setInterval(refresh,15000);
    const SK='mk_f_'+(key||title); const set=open=>{ try{ localStorage.setItem(SK,open?'1':'0'); }catch(e){} box.style.display=open?'block':'none'; btn.innerHTML=open?'<em>접기</em> ➖':'<em>펼치기</em> ➕'; h2.setAttribute('aria-expanded',open?'true':'false'); h2.classList.toggle('open',open); refresh(); };
    let init=false; try{ init=localStorage.getItem(SK)==='1'; }catch(e){}
    set(init);
    const tg=e=>{ if(e.target.closest('a')) return; set(box.style.display==='none'); };
    h2.addEventListener('click',tg); h2.addEventListener('keydown',e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); tg(e);} });
    h2._set=set;
  }
  document.querySelectorAll('#stock > .wrap > h2, #unicorn > .wrap > h2, #events > .wrap > h2').forEach(fold);
  const all=[...document.querySelectorAll('h2.fold-h')];
  if(all[0]){ const bar=document.createElement('div'); bar.className='fold-all'; bar.innerHTML='<button type="button" data-o="1">모두 펼치기 ➕</button><button type="button" data-o="0">모두 접기 ➖</button>'; all[0].before(bar); bar.addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b) return; all.forEach(h=>h._set(b.dataset.o==='1')); }); }
  const openByHash=()=>{ const h=location.hash&&document.querySelector(location.hash); if(h&&h._set) h._set(true); };
  openByHash(); window.addEventListener('hashchange',openByHash);
  /* 지연 로딩: 섹션을 처음 펼칠 때(또는 저장된 상태가 '펼침'일 때) 해당 데이터를 불러온다 */
  [['주요 지수 ETF',()=>{ loadIdxRelUS(); loadUSCorr(); }],['지수 편입',()=>loadTickGroup('idxchg')],['유니콘',()=>loadUnicornNews()]].forEach(([k,fn])=>{
    let done=false; const run=()=>{ if(done) return; done=true; try{ fn(); }catch(e){ console.warn('지연 로딩 실패',k,e); } };
    const h=all.find(x=>{ const t=x.querySelector('.fold-t'); return t&&t.textContent.trim().indexOf(k)===0; });
    if(!h){ run(); return; }
    if(h.classList.contains('open')) run();
    else new MutationObserver(()=>{ if(h.classList.contains('open')) run(); }).observe(h,{attributes:true,attributeFilter:['class']});
  });
})();
