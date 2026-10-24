/* Mr.Kim Signal — 한국주식 전문 도구형 보강 (body.pro.kr 전용): 시세 띠 · 데이터 상태 띠 · 카드별 출처/갱신 · 한 줄 요약 · 목차 · 접근성 보정 */
(function(){
  if(!document.body||!document.body.classList.contains('pro')||!document.body.classList.contains('kr')) return;
  var pad2z=function(n){ return n<10?'0'+n:''+n; };
  var hhmm=function(d){ d=d||new Date(); return pad2z(d.getHours())+':'+pad2z(d.getMinutes()); };
  var fmt=function(v,d){ return v.toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d}); };
  var txt=function(id){ var e=document.getElementById(id); return e?(e.textContent||'').trim():''; };
  var num=function(t){ var m=(t||'').match(/-?[\d.]+/); return m?parseFloat(m[0]):NaN; };
  /* 기간 라벨 통일(1일·1주·1개월·1년) */
  if(typeof PERKO!=='undefined') Object.assign(PERKO,{d:'1일',w:'1주',m:'1개월',y:'1년'});
  /* 현재 페이지 메뉴 강조 */
  try{ var file=(location.pathname.split('/').pop()||'index.html'); document.querySelectorAll('#nav-menu a').forEach(function(a){ if((a.getAttribute('href')||'')===file) a.classList.add('on-page'); }); }catch(e){}
  async function quote(sym){
    try{
      var j=await getJSON('https://query1.finance.yahoo.com/v8/finance/chart/'+encodeURIComponent(sym)+'?range=5d&interval=1d');
      var r=j.chart.result[0], c=mkFillClose(r).filter(function(x){return x!=null;});
      var p=(r.meta&&r.meta.regularMarketPrice!=null)?r.meta.regularMarketPrice:c[c.length-1];
      var prev=c.length>=2?c[c.length-2]:null;
      if(prev==null||!isFinite(p)) return null;
      return {p:p,prev:prev,pct:(p/prev-1)*100,diff:p-prev};
    }catch(e){ return null; }
  }
  /* ===== 카드별 출처·갱신 시각 ===== */
  var MKT=window.MKT={meta:{},retry:{},last:{},
    line:function(id){ var c=document.getElementById(id); if(!c) return null;
      if(c.classList.contains('wl-list')){ var sc=c.closest('.scroll')||c, pl=sc.previousElementSibling; if(!pl||!pl.classList||!pl.classList.contains('src-line')){ pl=document.createElement('div'); pl.className='src-line'; sc.before(pl); } return pl; }
      var l=c.querySelector(':scope > .src-line'); if(!l){ l=document.createElement('div'); l.className='src-line'; var h=c.querySelector(':scope > h3'); if(h) h.after(l); else c.prepend(l); } return l; },
    set:function(id,st){ var l=MKT.line(id); if(!l) return; var m=MKT.meta[id]||'';
      if(st==='ok'){ MKT.last[id]=hhmm(); l.className='src-line'; l.innerHTML='<span>ⓘ 출처 · '+m+'</span><b>갱신 '+MKT.last[id]+'</b>'; }
      else { l.className='src-line fail'; l.innerHTML='<span>⚠ 갱신 실패 — '+(MKT.last[id]?'마지막 성공 '+MKT.last[id]+' 값을 표시 중입니다':'아직 성공한 갱신이 없어 값이 비어 있을 수 있습니다')+' · '+m+'</span>'; var b=document.createElement('button'); b.type='button'; b.textContent='다시 시도'; b.onclick=function(){ b.disabled=true; b.textContent='불러오는 중…'; (MKT.retry[id]||function(){ location.reload(); })(); }; l.appendChild(b); } }
  };
  ['krcap-tbl','krkq-tbl','krlev-tbl','kridx-tbl'].forEach(function(id){ MKT.meta[id]='Yahoo Finance · 지연 시세 가능'; });
  if(typeof window.loadTickGroup==='function'&&!window.__ltgWrapped){ window.__ltgWrapped=1; var __ltg=window.loadTickGroup;
    window.loadTickGroup=async function(g){ var r; try{ r=await __ltg.apply(this,arguments); }catch(e){ r=null; }
      try{ var G=(typeof TICKGROUPS!=='undefined')&&TICKGROUPS[g]; if(G&&G.table&&MKT.meta[G.table]&&document.getElementById(G.table)){ var n=0; G.list.forEach(function(t){ var d=(typeof tickData!=='undefined')&&tickData[t]; if(d&&d.length) n++; }); MKT.set(G.table,n?'ok':'fail'); MKT.retry[G.table]=function(){ G.list.forEach(function(t){ if(!(tickData[t]&&tickData[t].length)) delete tickData[t]; }); window.loadTickGroup(g); }; } }catch(e){}
      return r; }; }
  /* ===== ① 시세 띠 ===== */
  var TICK=[['^KS11','코스피',2],['^KQ11','코스닥',2],['^KS200','코스피200',2],['KRW=X','USD/KRW',1],['^GSPC','S&P 500',2],['^IXIC','나스닥',2],['^VIX','VIX',2],['CL=F','WTI',2],['GC=F','금',1]];
  var hd=document.querySelector('header'), Q={};
  if(hd){ var bar=document.createElement('div'); bar.id='pro-tick';
    bar.innerHTML='<div class="pt-live"><u></u>LIVE</div><div class="pt" id="pt-fg"><span>한국 공탐</span><b>--</b><i></i></div>'+TICK.map(function(t,i){ return '<div class="pt" id="pt-'+i+'"><span>'+t[1]+'</span><b>--</b><i></i></div>'; }).join('');
    hd.appendChild(bar); }
  var setFg=function(){ var el=document.getElementById('pt-fg'); if(!el) return; var n=num(txt('kr-val')), s=txt('kr-state'); if(isFinite(n)){ el.querySelector('b').textContent=Math.round(n); el.querySelector('i').textContent=(s&&s.indexOf('불러')<0)?s:''; } };
  async function loadTicks(){
    var res=await Promise.all(TICK.map(function(t){ return quote(t[0]); }));
    res.forEach(function(q,i){ var el=document.getElementById('pt-'+i); if(!el||!q) return; Q[TICK[i][0]]=q; var t=TICK[i], b=el.querySelector('b'), c=el.querySelector('i');
      b.textContent=fmt(q.p,t[2]); c.textContent=(q.pct>=0?'+':'')+fmt(q.pct,2)+'%'; c.className=q.pct>=0?'up':'down'; });
    setFg(); fillBrief();
  }
  /* ===== ② 데이터 상태 띠 ===== */
  if(hd){
    var st=document.createElement('div'); st.id='pro-status';
    st.innerHTML='<span class="ps-mk" id="ps-mk"></span><span class="ps-net" id="ps-net"></span><span class="ps-t" id="ps-t"></span><span class="ps-n">무료 공개 시세(Yahoo Finance·KRX·네이버·한국은행) 기반 · 지연·오류 가능 · 투자 판단 참고용</span><button type="button" id="ps-rf" title="새로고침" aria-label="새로고침">↻</button>';
    hd.after(st); document.getElementById('ps-rf').onclick=function(){ location.reload(); };
    var dtf=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Seoul',weekday:'short',hour:'numeric',minute:'numeric',hour12:false});
    var mkt=function(){ var p={}; dtf.formatToParts(new Date()).forEach(function(x){p[x.type]=x.value;}); var m=(parseInt(p.hour,10)%24)*60+parseInt(p.minute,10), wd=p.weekday;
      if(wd==='Sat'||wd==='Sun') return ['휴장(주말)','c'];
      if(m>=540&&m<930) return ['정규장 진행 중','o']; if(m>=480&&m<540) return ['장 시작 전 · 전일 종가 기준','p']; if(m>=930&&m<1260) return ['장 마감 · 종가 기준','c']; return ['장 마감','c']; };
    var upd=function(){
      var a=mkt(), mk=document.getElementById('ps-mk'); mk.className='ps-mk '+a[1]; mk.textContent='한국장 '+a[0]; mk.title='한국시간 기준 자동 계산(정규장 09:00~15:30). 마감 후 표시되는 현재가는 정규장 종가이며 시간외 단일가·NXT 시세는 반영하지 않습니다. 공휴일 휴장은 반영되지 않습니다.';
      var N=window.MK_NET||{log:[],lastOk:0}, lg=N.log.slice(-20), fails=lg.filter(function(x){return !x;}).length, ratio=lg.length?fails/lg.length:0, age=N.lastOk?(Date.now()-N.lastOk)/1000:null, cls, tx;
      if(!lg.length){ cls='w'; tx='데이터 확인 중'; } else if(age!=null&&age>600){ cls='r'; tx='갱신 지연 ('+Math.round(age/60)+'분 전 마지막 성공)'; }
      else if(ratio<=.15){ cls='g'; tx='데이터 정상'; } else if(ratio<=.5){ cls='w'; tx='일부 데이터 지연'; } else { cls='r'; tx='데이터 연결 불안정'; }
      var n=document.getElementById('ps-net'); n.className='ps-net '+cls; if(n.textContent!=='● '+tx) n.textContent='● '+tx;
      document.getElementById('ps-t').innerHTML=N.lastOk?'<span class="lbl">마지막 갱신 </span>'+hhmm(new Date(N.lastOk))+':'+pad2z(new Date(N.lastOk).getSeconds()):''; };
    upd(); setInterval(upd,5000);
    var watch=function(){ document.querySelectorAll('.mut,.pi-note').forEach(function(e){ if((e.textContent||'').trim()!=='불러오는 중…'||e.dataset.wd) return; e.dataset.wd='1';
      e.innerHTML='⚠ 데이터를 불러오지 못했습니다 (제공처 지연·차단 가능) <button type="button" class="net-retry">다시 시도</button>'; e.querySelector('button').onclick=function(){ location.reload(); }; e.classList.add('net-fail'); }); };
    setTimeout(watch,30000); setTimeout(watch,75000);
  }
  /* ===== ③ 한 줄 요약 · 목차 · 맨 위로 ===== */
  var wrap=document.querySelector('#kr-stock > .wrap'), fillBrief=function(){};
  var openAndGo=function(el){ if(!el) return; var h=el.closest&&el.closest('.fold-body'); if(h&&h.style.display==='none'){ var hh=h.previousElementSibling; if(hh&&hh._set) hh._set(true); }
    setTimeout(function(){ var off=(document.querySelector('header')?document.querySelector('header').offsetHeight:0)+44; var y=el.getBoundingClientRect().top+window.scrollY-off-8; window.scrollTo({top:Math.max(0,y),behavior:'smooth'}); if(el.focus){ el.setAttribute('tabindex','-1'); el.focus({preventScroll:true}); } },60); };
  if(wrap){
    var br=document.createElement('div'); br.id='pro-brief'; br.setAttribute('aria-label','오늘의 시장 요약');
    br.innerHTML='<div class="pb-hd"><b>오늘의 시장 요약</b><span class="pb-sub">핵심 4가지를 한눈에 · 각 칸을 누르면 상세로 이동</span></div><p class="pb-line" id="pb-line">시장 상태를 불러오는 중…</p><div class="pb-grid">'+
      '<a class="pb-c" href="#kr-card" data-go="#kr-card"><small>한국 공포탐욕</small><b id="pb-fg">--</b><span id="pb-fg2"></span></a>'+
      '<a class="pb-c" href="#kr-idxrel-card" data-go="h:코스피·코스닥"><small>코스피</small><b id="pb-ks">--</b><span id="pb-ks2"></span></a>'+
      '<a class="pb-c" href="#kr-corr-grid" data-go="h:코스피·코스닥"><small>원/달러 환율</small><b id="pb-fx">--</b><span id="pb-fx2"></span></a>'+
      '<a class="pb-c" href="#kr-events-tbl" data-go="h:주요 이벤트"><small>다음 주요 일정</small><b id="pb-ev">--</b><span id="pb-ev2"></span></a></div>';
    var lead=wrap.querySelector('.pg-lead'); if(lead) lead.after(br); else wrap.prepend(br);
    var ZC=['#C42318','#B54708','#475467','#3F7D20','#0B6B3A'], sgn=function(q){ return (q.pct>=0?'▲ +':'▼ ')+fmt(q.pct,2)+'%'; };
    var nextEv=function(){ try{ if(typeof KR_MONTH_EVENTS==='undefined') return null; var now=new Date(), today=new Date(now.getFullYear(),now.getMonth(),now.getDate()), best=null;
      Object.keys(KR_MONTH_EVENTS).forEach(function(k){ (KR_MONTH_EVENTS[k]||[]).forEach(function(ev){ if(ev.hol) return; var dt=new Date(now.getFullYear(),+k-1,ev.d); if(dt<today) return; if(!best||dt<best.dt) best={ev:ev,dt:dt,m:+k}; }); });
      if(!best) return null; var dd=Math.round((best.dt-today)/86400000); return {t:best.ev.t,when:best.m+'월 '+best.ev.d+'일',dd:dd===0?'오늘':'D-'+dd,c:best.ev.c}; }catch(e){ return null; } };
    fillBrief=function(){
      var v=num(txt('kr-val')), s=txt('kr-state'), P=[];
      if(isFinite(v)){ var z=v<25?0:v<45?1:v<=55?2:v<=75?3:4, b=document.getElementById('pb-fg'); b.textContent=Math.round(v)+' · '+(s&&s.indexOf('불러')<0?s:['극단적 공포','공포','중립','탐욕','극단적 탐욕'][z]); b.style.color=ZC[z]; document.getElementById('pb-fg2').textContent='코스피 기준 · 125일선 이격 등 7개 지표';
        P.push('공포탐욕 '+Math.round(v)+' <em>'+(s&&s.indexOf('불러')<0?s:['극단적 공포','공포','중립','탐욕','극단적 탐욕'][z])+'</em>'); }
      var ks=Q['^KS11']; if(ks){ document.getElementById('pb-ks').textContent=fmt(ks.p,2); var e2=document.getElementById('pb-ks2'); e2.innerHTML='<span style="color:'+(ks.pct>=0?'#B42318':'#1D4ED8')+'">'+sgn(ks)+'</span>'; P.push('코스피 <em>'+(ks.pct>=0?'+':'')+fmt(ks.pct,2)+'%</em>'); }
      var fx=Q['KRW=X']; if(fx){ document.getElementById('pb-fx').textContent=fmt(fx.p,1)+'원'; var e3=document.getElementById('pb-fx2'); e3.innerHTML='<span style="color:'+(fx.pct>=0?'#B42318':'#1D4ED8')+'">'+sgn(fx)+'</span>'; P.push('원/달러 <em>'+fmt(fx.p,0)+'원</em>'); }
      var ne=nextEv(); if(ne){ document.getElementById('pb-ev').textContent=ne.t; document.getElementById('pb-ev2').textContent=ne.dd+' · '+ne.when; P.push('다음 일정 <em>'+ne.t+' '+ne.dd+'</em>'); }
      var pl=document.getElementById('pb-line'); if(pl){ var nh=P.length?P.map(function(x){return '<span class="pb-seg">'+x+'</span>'}).join('')+'<span class="pb-note">참고용 요약 · 투자 권유 아님</span>':'시장 상태를 불러오는 중…'; if(pl._h!==nh){ pl._h=nh; pl.innerHTML=nh; } } };
    fillBrief(); setInterval(fillBrief,4000); [2500,6000,12000].forEach(function(t){ setTimeout(fillBrief,t); });
    br.addEventListener('click',function(e){ var a=e.target.closest('a.pb-c'); if(!a) return; e.preventDefault(); var t=a.getAttribute('data-go'), el;
      if(t.indexOf('h:')===0){ var k=t.slice(2); el=[].slice.call(document.querySelectorAll('h2.fold-h')).find(function(h){ return (h.textContent||'').replace(/\s+/g,' ').trim().indexOf(k)===0; }); if(el&&el._set) el._set(true); } else el=document.querySelector(t);
      if(el) openAndGo(el); });
    var toc=document.createElement('nav'); toc.id='pro-toc'; toc.setAttribute('aria-label','페이지 목차');
    var ITEMS=[['요약','#pro-brief'],['공탐','#kr-card'],['투자자 동향','h:투자자별'],['지수비교','h:코스피·코스닥'],['코스피 TOP10','h:시가총액 TOP10 (코스피)'],['코스닥 TOP10','h:시가총액 TOP10 (코스닥)'],['레버리지','h:레버리지'],['이벤트','h:주요 이벤트'],['편입·편출','h:KOSPI200']];
    toc.innerHTML=ITEMS.map(function(it,i){ return '<a href="#" data-i="'+i+'">'+it[0]+'</a>'; }).join('');
    var st2=document.getElementById('pro-status'); (st2||hd).after(toc);
    var place=function(){ if(!document.querySelector('header.hdr-off')) toc.style.top=(hd?hd.offsetHeight:0)+'px'; }; place(); window.addEventListener('resize',place); setTimeout(place,1500);
    toc.addEventListener('click',function(e){ var a=e.target.closest('a'); if(!a) return; e.preventDefault(); var t=ITEMS[+a.dataset.i][1], el;
      if(t.indexOf('h:')===0){ var k=t.slice(2); el=[].slice.call(document.querySelectorAll('h2.fold-h')).find(function(h){ return (h.textContent||'').replace(/\s+/g,' ').trim().indexOf(k)===0; }); if(el&&el._set) el._set(true); } else el=document.querySelector(t);
      if(el) openAndGo(el); });
    var up=document.createElement('button'); up.id='pro-top'; up.type='button'; up.setAttribute('aria-label','맨 위로'); up.textContent='↑ 맨 위로'; up.onclick=function(){ window.scrollTo({top:0,behavior:'smooth'}); }; document.body.appendChild(up);
    window.addEventListener('scroll',function(){ up.classList.toggle('on',window.scrollY>700); },{passive:true});
  }

  /* ===== 공탐 구간 막대 + 마커(미국주식과 동일) ===== */
  (function(){
    var dial=document.getElementById('kr-dial'); if(!dial||document.getElementById('pro-scale')) return;
    var box=dial.parentNode, sc=document.createElement('div'); sc.id='pro-scale';
    sc.innerHTML='<div class="bar"><i style="width:25%;background:#C2362B"></i><i style="width:20%;background:#E58A3A"></i><i style="width:10%;background:#C9CED4"></i><i style="width:20%;background:#5DA86B"></i><i style="width:25%;background:#1F7A4D"></i><span class="mk" id="pro-mk" style="left:0"><b id="pro-mkv">--</b></span></div>'+
      '<div class="tk" aria-hidden="true">'+[[0,'0'],[25,'25'],[45,'45'],[55,'55'],[75,'75'],[100,'100']].map(function(t){ return '<span style="left:'+t[0]+'%">'+t[1]+'</span>'; }).join('')+'</div>'+
      '<div class="lb">'+[[12.5,'극단적 공포'],[35,'공포'],[50,'중립'],[65,'탐욕'],[87.5,'극단적 탐욕']].map(function(t){ return '<span style="left:'+t[0]+'%">'+t[1]+'</span>'; }).join('')+'</div>';
    box.after(sc);
    var upd=function(){ var v=document.getElementById('kr-val'); if(!v) return; var n=parseFloat((v.textContent||'').replace(/[^\d.]/g,'')); var mk=document.getElementById('pro-mk'); if(mk&&isFinite(n)){ mk.style.left=Math.max(0,Math.min(100,n))+'%'; var mv=document.getElementById('pro-mkv'); if(mv) mv.textContent=Math.round(n); } };
    upd(); setInterval(upd,3000); setTimeout(upd,1200);
  })();
  loadTicks(); setInterval(loadTicks,60000); setInterval(setFg,3000); setTimeout(setFg,1500);
  /* ===== ④ 용어 툴팁(재무 패널 등) ===== */
  var GL=[['PSR','주가매출비율 = 시가총액 ÷ 매출. 낮을수록 매출 대비 저렴하다고 봅니다.'],['ROE','자기자본이익률. 주주 자본 대비 이익이며, 부채가 많으면 부풀려질 수 있습니다.'],['ROA','총자산이익률. 가진 자산으로 이익을 얼마나 효율적으로 내는지 봅니다.'],
    ['RSI','상대강도지수(14일). 30 이하 과매도, 70 이상 과열로 해석합니다.'],['EPS','주당순이익. 순이익 ÷ 발행주식 수입니다.'],['PER','주가수익비율 = 주가 ÷ 주당순이익. 높을수록 이익 대비 비싸다고 봅니다.'],['이격도','현재 지수가 이동평균선에서 얼마나 떨어져 있는지 나타내는 비율입니다.'],['풋/콜','풋옵션은 하락, 콜옵션은 상승에 거는 계약입니다. 풋이 많으면 공포 쪽입니다.']];
  var SKIP={A:1,BUTTON:1,SUMMARY:1,H3:1,ABBR:1,SCRIPT:1,STYLE:1,INPUT:1,TEXTAREA:1,SVG:1,TEXT:1};
  var gloss=function(){ document.querySelectorAll('[id^="fin-"],.lev-inv,#kr-sub-note').forEach(function(root){ if(root.offsetParent===null&&root.style.display==='none') return;
    GL.forEach(function(g){ if(root.querySelector('abbr.gl[data-k="'+g[0]+'"]')) return; var re=new RegExp('(^|[^A-Za-z가-힣])('+g[0].replace('/','\\/')+')(?![A-Za-z가-힣])'); var w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,null), n;
      while((n=w.nextNode())){ var p=n.parentNode; if(!p||SKIP[p.tagName.toUpperCase()]||p.closest('a,button,summary,h3,abbr,svg')) continue; var m=re.exec(n.nodeValue); if(!m) continue; var i=m.index+m[1].length, r=n.splitText(i); r.splitText(g[0].length); var ab=document.createElement('abbr'); ab.className='gl'; ab.tabIndex=0; ab.dataset.k=g[0]; ab.dataset.tip=g[1]; ab.textContent=r.nodeValue; r.parentNode.replaceChild(ab,r); break; } }); }); };
  setTimeout(gloss,5000); setInterval(gloss,6000);
  /* ===== ⑤ 접근성 보정 ===== */
  (function(){ var KEY={Enter:1,' ':1};
    var fix=function(){
      document.querySelectorAll('a[href^="javascript:"]:not([data-a11y])').forEach(function(a){ a.dataset.a11y='1'; a.setAttribute('role','button'); if(!a.hasAttribute('tabindex')) a.tabIndex=0; if(!a.getAttribute('aria-label')) a.setAttribute('aria-label',(a.getAttribute('title')||a.textContent||'').trim()||'버튼'); a.addEventListener('keydown',function(e){ if(KEY[e.key]){ e.preventDefault(); a.click(); } }); });
      document.querySelectorAll('.wl-actions a:not([data-a11y])').forEach(function(a){ a.dataset.a11y='1'; if(!a.getAttribute('aria-label')){ var t=a.getAttribute('title'); if(t) a.setAttribute('aria-label',t); } });
      document.querySelectorAll('table:not([data-a11y])').forEach(function(t){ t.dataset.a11y='1'; t.querySelectorAll('thead th:not([scope])').forEach(function(th){ th.setAttribute('scope','col'); });
        if(!t.querySelector('caption')&&!t.getAttribute('aria-label')){ var sec=t.closest('.card,section,.fold-body'); var hd2=sec&&(sec.querySelector('h3')||(sec.previousElementSibling&&sec.previousElementSibling.matches('h2')?sec.previousElementSibling:null)||sec.querySelector('h2')); if(hd2){ var tx=((hd2.querySelector&&hd2.querySelector('.fold-t'))||hd2).textContent.replace(/\s+/g,' ').trim(); if(tx) t.setAttribute('aria-label',tx+' 표'); } } });
      document.querySelectorAll('.wl-spark svg:not([aria-hidden])').forEach(function(sv){ sv.setAttribute('aria-hidden','true'); sv.setAttribute('focusable','false'); });
      document.querySelectorAll('img:not([alt])').forEach(function(im){ im.setAttribute('alt',''); });
      document.querySelectorAll('.tabs button,.seg button,.hm-t button').forEach(function(b){ b.setAttribute('aria-pressed',b.classList.contains('on')?'true':'false'); }); };
    var timer=null, sched=function(){ if(timer) return; timer=setTimeout(function(){ timer=null; fix(); },350); };
    fix(); new MutationObserver(sched).observe(document.body,{childList:true,subtree:true});
    document.addEventListener('click',function(e){ if(e.target.closest('.tabs,.seg,.hm-t')) setTimeout(fix,60); });
    var pn=document.getElementById('ps-net'); if(pn){ pn.setAttribute('role','status'); pn.setAttribute('aria-live','polite'); }
    var ps=document.getElementById('pro-status'); if(ps){ ps.setAttribute('role','region'); ps.setAttribute('aria-label','데이터 상태'); }
    var tk=document.getElementById('pro-tick'); if(tk){ tk.setAttribute('role','region'); tk.setAttribute('aria-label','주요 시세 띠'); tk.tabIndex=0; } })();
})();

/* 공탐 상태 글자색: 밝은 라임 등은 흰 배경 대비가 부족하므로 어둡게 보정 */
(function(){
  var MAP={'#a3e635':'#4D7C0F','#84cc16':'#4D7C0F','#22c55e':'#15803D','#facc15':'#A16207','#eab308':'#A16207','#f59e0b':'#B45309','#fbbf24':'#A16207'};
  function lum(h){var r=parseInt(h.substr(1,2),16),g=parseInt(h.substr(3,2),16),b=parseInt(h.substr(5,2),16);return (0.299*r+0.587*g+0.114*b)}
  function fix(el){ if(!el||el.__mkc) return; var c=(el.style.color||''); var m=c.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/); if(!m) return;
    var hx='#'+[m[1],m[2],m[3]].map(function(x){return ('0'+(+x).toString(16)).slice(-2)}).join('');
    var to=MAP[hx]; if(!to&&lum(hx)>110){ to='#'+[m[1],m[2],m[3]].map(function(x){return ('0'+Math.round(x*0.55).toString(16)).slice(-2)}).join(''); }
    if(to){ el.__mkc=1; el.style.color=to; setTimeout(function(){el.__mkc=0},0); } }
  function run(){ ['kr-state','kr-kimcomment'].forEach(function(id){ var e=document.getElementById(id); if(!e) return; fix(e); new MutationObserver(function(){fix(e)}).observe(e,{attributes:true,attributeFilter:['style']}); }); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',run); else run();
})();

/* KOSPI200 편입·편출 — 미국주식(지수 편입·편출)과 같은 구성: 기간 탭 옆에 편입+편출/편입/편출 구분 */
(function(){
  var host=document.getElementById('kridx-tbl'), per=document.querySelector('.tabs[data-group="kridx"]');
  if(!host||!per||per.parentElement.classList.contains('tabrow')) return;
  var wrap=document.createElement('div'); wrap.className='tabrow'; per.before(wrap); wrap.appendChild(per);
  var sel2=document.createElement('div'); sel2.className='seg ixf ixio'; sel2.setAttribute('role','group'); sel2.setAttribute('aria-label','편입·편출 구분');
  sel2.innerHTML='<button class="on" data-y="">편입+편출</button><button data-y="in">편입</button><button data-y="out">편출</button>';
  wrap.appendChild(sel2);
  var curT='', busy=false;
  var apply=function(){
    busy=true;
    Array.prototype.forEach.call(host.children,function(g){
      var lists=g.querySelectorAll('.wl-list'); if(!lists.length) return;
      var ci=0,co=0;
      lists.forEach(function(l){
        var lb0=l.previousElementSibling, typ=(lb0&&/편출/.test(lb0.textContent||''))?'out':'in';
        var n=l.querySelectorAll('.wl-row').length;
        if(typ==='out') co+=n; else ci+=n;
        var show=!curT||curT===typ; l.style.display=show?'':'none';
        if(lb0&&lb0.className!=='wl-list') lb0.style.display=show?'':'none';
        if(!show){ Array.prototype.forEach.call(l.children,function(c){ if(/^fin/.test(c.id||'')) c.style.display='none'; }); }
      });
      var shown=(!curT)?ci+co:(curT==='in'?ci:co); g.style.display=shown?'':'none';
      var sm=g.querySelector('.mut'); if(sm&&curT) sm.textContent='· 편입 '+ci+' · 편출 '+co;
    });
    var emp=document.getElementById('kridx-empty'); if(emp) emp.remove();
    if(curT&&!Array.prototype.some.call(host.children,function(g){return g.style.display!=='none'&&g.querySelector&&g.querySelector('.wl-list');})){ var d=document.createElement('div'); d.id='kridx-empty'; d.className='pi-note'; d.textContent='선택한 기간에 해당하는 편입·편출 종목이 없습니다.'; host.after(d); }
    busy=false;
  };
  sel2.addEventListener('click',function(e){ var b=e.target.closest('button'); if(!b) return; sel2.querySelectorAll('button').forEach(function(x){x.classList.toggle('on',x===b);}); curT=b.dataset.y; apply(); });
  new MutationObserver(function(){ if(!busy&&curT) apply(); }).observe(host,{childList:true});
})();
