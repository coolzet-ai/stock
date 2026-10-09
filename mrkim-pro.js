/* Mr.Kim Signal — 전문 도구형 보강 (티커 띠 · 선형 구간 스케일 · 섹터 히트맵) · body.pro 전용 */
(function(){
  if(!document.body || !document.body.classList.contains('pro')) return;
  var US=!!(window.MK_CV&&window.MK_CV.us), UP=US?'#067647':'#D92D20', DN=US?'#C4281B':'#1D4ED8';

  /* 지연 로딩 도우미: 화면 가까이(기본 700px 이내) 오거나, 지정한 시간(delay ms)이 지나면 한 번만 실행.
     첫 화면(공탐·시세 띠)이 네트워크를 먼저 쓰도록 아래쪽 카드는 뒤로 미룬다. 데이터 절약 모드에서는 가까이 올 때만 실행. */
  window.MK_LAZY=function(el,fn,delay,margin){
    var done=false, run=function(){ if(done) return; done=true; if(el&&el.dataset) delete el.dataset.lazy; try{ fn(); }catch(e){ console.warn('지연 로딩 실패',e); } };
    if(el&&el.dataset) el.dataset.lazy='1';
    var save=false; try{ save=!!(window.MK_SAVE||localStorage.getItem('mk_save')==='1'); }catch(e){}
    if(el&&'IntersectionObserver' in window){
      var io=new IntersectionObserver(function(es){ if(es.some(function(x){return x.isIntersecting;})){ io.disconnect(); run(); } },{rootMargin:(margin==null?700:margin)+'px 0px'}); io.observe(el);
    } else { run(); return; }
    if(delay&&!save) setTimeout(run,delay);
  };

  /* 현재 페이지 메뉴 강조 */
  try{
    var file=(location.pathname.split('/').pop()||'index.html');
    document.querySelectorAll('#nav-menu a').forEach(function(a){ if((a.getAttribute('href')||'')===file) a.classList.add('on-page'); });
  }catch(e){}

  /* 공통 시세 조회 (Worker 프록시 경유 · mrkim-common.js 의 getJSON 재사용) */
  async function quote(sym){
    try{
      var j=await getJSON('https://query1.finance.yahoo.com/v8/finance/chart/'+encodeURIComponent(sym)+'?range=5d&interval=1d');
      var r=j.chart.result[0], c=mkFillClose(r).filter(function(x){return x!=null;});
      var p=(r.meta&&r.meta.regularMarketPrice!=null)?r.meta.regularMarketPrice:c[c.length-1];
      var prev=c.length>=2?c[c.length-2]:null;
      if(prev==null||!isFinite(p)) return null;
      return {p:p, prev:prev, pct:(p/prev-1)*100, diff:p-prev};
    }catch(e){ return null; }
  }
  function fmt(v,d){ return v.toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d}); }

  /* ⑩ 신뢰성: 데이터 상태 띠 · 카드별 출처/갱신 · 로딩 정체 감시 */
  var pad2z=function(n){ return n<10?'0'+n:''+n; };
  var hhmm=function(d){ d=d||new Date(); return pad2z(d.getHours())+':'+pad2z(d.getMinutes()); };
  var MKT=window.MKT={meta:{},retry:{},
    line:function(id){ var c=document.getElementById(id); if(!c) return null; if(c.classList.contains('wl-list')){ var sc=c.closest('.scroll')||c, pl=sc.previousElementSibling; if(!pl||!pl.classList||!pl.classList.contains('src-line')){ pl=document.createElement('div'); pl.className='src-line'; sc.before(pl); } return pl; } var l=c.querySelector(':scope > .src-line'); if(!l){ l=document.createElement('div'); l.className='src-line'; var h=c.querySelector(':scope > h3'); if(h) h.after(l); else c.prepend(l); } return l; },
    last:{},
    set:function(id,st){ var l=MKT.line(id); if(!l) return; var m=MKT.meta[id]||'';
      if(st==='ok'){ MKT.last[id]=hhmm(); l.className='src-line'; l.innerHTML='<span>ⓘ 출처 · '+m+'</span><b>갱신 '+MKT.last[id]+'</b>'; }
      else if(st==='static'){ l.className='src-line'; l.innerHTML='<span>ⓘ '+m+'</span>'; }
      else { l.className='src-line fail'; l.innerHTML='<span>⚠ 갱신 실패 — '+(MKT.last[id]?'마지막 성공 '+MKT.last[id]+' 값을 표시 중입니다':'아직 성공한 갱신이 없어 값이 비어 있을 수 있습니다')+' · '+m+'</span>'; var b=document.createElement('button'); b.type='button'; b.textContent='다시 시도'; b.onclick=function(){ b.disabled=true; b.textContent='불러오는 중…'; (MKT.retry[id]||function(){ location.reload(); })(); }; l.appendChild(b); } }
  };
  MKT.meta['tick-tbl']='Yahoo Finance · 지연 시세 가능'; MKT.meta['cap-tbl']='Yahoo Finance · 지연 시세 가능'; MKT.meta['lev-tbl']='Yahoo Finance · 지연 시세 가능'; MKT.meta['idxchg-tbl']='Yahoo Finance · 지연 시세 가능';
  if(typeof window.loadTickGroup==='function'&&!window.__ltgWrapped){ window.__ltgWrapped=1; var __ltg=window.loadTickGroup;
    window.loadTickGroup=async function(g){ var r; try{ r=await __ltg.apply(this,arguments); }catch(e){ r=null; }
      try{ var G=(typeof TICKGROUPS!=='undefined')&&TICKGROUPS[g]; if(G&&G.table&&MKT.meta[G.table]&&document.getElementById(G.table)){ var n=0; G.list.forEach(function(t){ var d=(typeof tickData!=='undefined')&&tickData[t]; if(d&&d.length) n++; }); MKT.set(G.table,n?'ok':'fail'); MKT.retry[G.table]=function(){ G.list.forEach(function(t){ if(!(tickData[t]&&tickData[t].length)) delete tickData[t]; }); window.loadTickGroup(g); }; } }catch(e){}
      return r; }; }
  MKT.meta['pro-sector']='Yahoo Finance(섹터 ETF) · 최대 15분 지연 가능';
  MKT.meta['pro-int']='Yahoo Finance · TradingView · 5분 주기';
  MKT.meta['pro-cal']='TradingView 경제캘린더 · 5분 캐시 · 일정은 변경될 수 있음';
  MKT.meta['pro-fwd']='CNN 공포탐욕지수 × SPY 종가 과거 통계(고정) · 과거 성과는 미래를 보장하지 않음';

  /* ① 티커 띠 */
  var TICK=[['^GSPC','S&P 500',2],['^IXIC','나스닥',2],['^DJI','다우',0],['^RUT','러셀2000',2],['^VIX','VIX',2],['DX-Y.NYB','달러인덱스',2],['^TNX','미10년',3,'%'],['CL=F','WTI',2],['GC=F','금',1],['BTC-USD','비트코인',0],['KRW=X','USD/KRW',1]];
  var hd=document.querySelector('header'), bar=null;
  if(hd){
    bar=document.createElement('div'); bar.id='pro-tick';
    bar.innerHTML='<div class="pt-live"><u></u>LIVE</div><div class="pt" id="pt-fg"><span>미국 공탐</span><b>--</b><i></i></div>'+
      TICK.map(function(t,i){ return '<div class="pt" id="pt-'+i+'"><span>'+t[1]+'</span><b>--</b><i></i></div>'; }).join('');
    hd.appendChild(bar);
  }
  function setFg(){
    var v=document.getElementById('us-val'), s=document.getElementById('us-state'), el=document.getElementById('pt-fg');
    if(!el||!v) return;
    var n=parseFloat((v.textContent||'').replace(/[^\d.]/g,''));
    if(isFinite(n)){ el.querySelector('b').textContent=Math.round(n); el.querySelector('i').textContent=(s&&s.textContent&&s.textContent.indexOf('불러')<0)?s.textContent.trim():''; }
  }
  async function loadTicks(){
    var res=await Promise.all(TICK.map(function(t){ return quote(t[0]); }));
    res.forEach(function(q,i){
      var el=document.getElementById('pt-'+i); if(!el||!q) return;
      var t=TICK[i], b=el.querySelector('b'), c=el.querySelector('i');
      b.textContent=fmt(q.p,t[2])+(t[3]||'');
      if(t[3]==='%'){ c.textContent=(q.diff>=0?'+':'')+fmt(q.diff*100,1)+'bp'; }
      else c.textContent=(q.pct>=0?'+':'')+fmt(q.pct,2)+'%';
      c.className=q.pct>=0?'up':'down';
    });
    setFg();
  }
  loadTicks(); setInterval(loadTicks,60000); setInterval(setFg,3000); setTimeout(setFg,1500);

  /* ② 선형 구간 스케일 (공탐 숫자 기준) */
  var fgtop=document.querySelector('#stock .fg-top');
  if(fgtop){
    var sc=document.createElement('div'); sc.id='pro-scale';
    sc.innerHTML='<div class="bar"><i style="width:25%;background:#C2362B"></i><i style="width:20%;background:#E58A3A"></i><i style="width:10%;background:#C9CED4"></i><i style="width:20%;background:#5DA86B"></i><i style="width:25%;background:#1F7A4D"></i><span class="mk" id="pro-mk" style="left:0"><b id="pro-mkv">--</b></span></div>'+
      '<div class="tk" aria-hidden="true">'+[[0,'0'],[25,'25'],[45,'45'],[55,'55'],[75,'75'],[100,'100']].map(function(t){ return '<span style="left:'+t[0]+'%">'+t[1]+'</span>'; }).join('')+'</div>'+
      '<div class="lb">'+[[12.5,'극단적 공포'],[35,'공포'],[50,'중립'],[65,'탐욕'],[87.5,'극단적 탐욕']].map(function(t){ return '<span style="left:'+t[0]+'%">'+t[1]+'</span>'; }).join('')+'</div>';
    fgtop.after(sc);
    var upd=function(){ var v=document.getElementById('us-val'); if(!v) return; var n=parseFloat((v.textContent||'').replace(/[^\d.]/g,'')); var mk=document.getElementById('pro-mk'); if(mk&&isFinite(n)){ mk.style.left=Math.max(0,Math.min(100,n))+'%'; var us=document.getElementById('us-state'); if(us){ us.style.color=['#C42318','#C2410C','#475467','#3F7D20','#0B6B3A'][n<25?0:n<45?1:n<=55?2:n<=75?3:4]; } var mv=document.getElementById('pro-mkv'); if(mv) mv.textContent=Math.round(n); } };
    var vv=document.getElementById('us-val'); if(vv){ new MutationObserver(upd).observe(vv,{childList:true,characterData:true,subtree:true}); }
    upd(); setInterval(upd,3000);
  }

  /* ③ 섹터 히트맵 (11개 GICS 섹터 ETF) */
  var SEC=[['XLK','기술'],['XLC','커뮤니케이션'],['XLY','경기소비재'],['XLF','금융'],['XLV','헬스케어'],['XLI','산업재'],['XLP','필수소비재'],['XLE','에너지'],['XLU','유틸리티'],['XLRE','부동산'],['XLB','소재']];
  var firstGrid=document.querySelector('#stock .grid');
  if(firstGrid){
    var card=document.createElement('div'); card.className='card'; card.id='pro-sector'; card.style.marginTop='12px';
    card.innerHTML='<h3><span>섹터 히트맵 · 11개 GICS 섹터</span><span class="mut" style="font-weight:400;font-size:11px">섹터 ETF(SPDR) 당일 등락</span></h3><div id="shm-sum" class="shm-sum"></div><div class="shm" id="shm"></div><div class="shm-note">색 = 당일 등락 (빨강 상승 · 파랑 하락) · 타일을 누르면 Finviz 차트로 이동합니다.</div>';
    firstGrid.after(card);
    var shm=card.querySelector('#shm');
    shm.innerHTML=SEC.map(function(s){ return '<a href="https://finviz.com/quote.ashx?t='+s[0]+'" target="_blank" rel="noopener" id="sh-'+s[0]+'" style="background:#F1F2F4"><span>'+s[1]+' <small>('+s[0]+')</small></span><em>--</em></a>'; }).join('');
    var mix=function(p){ var a=Math.min(1,Math.abs(p)/2.5), to=p>=0?(US?[6,118,71]:[217,45,32]):(US?[196,40,27]:[29,78,216]), f=.25+.75*a; return 'rgb('+Math.round(245+(to[0]-245)*f)+','+Math.round(246+(to[1]-246)*f)+','+Math.round(247+(to[2]-247)*f)+')'; };
    var loadSec=async function(){
      var res=await Promise.all(SEC.map(function(s){ return quote(s[0]); }));
      res.forEach(function(q,i){ var el=document.getElementById('sh-'+SEC[i][0]); if(!el||!q) return; var bgc=mix(q.pct); el.style.background=bgc; var rgbm=bgc.match(/\d+/g).map(Number), lum=(0.2126*Math.pow(rgbm[0]/255,2.2)+0.7152*Math.pow(rgbm[1]/255,2.2)+0.0722*Math.pow(rgbm[2]/255,2.2)); var darkTx=lum>0.2; el.style.color=darkTx?'#111418':'#fff'; el.dataset.dk=darkTx?'1':''; el.querySelector('em').textContent=(q.pct>=0?'▲ +':'▼ ')+Math.abs(q.pct).toFixed(2)+'%'; });
      var okq=res.filter(Boolean); MKT.set('pro-sector',okq.length?'ok':'fail'); var u=okq.filter(function(q){return q.pct>0;}).length, d=okq.filter(function(q){return q.pct<0;}).length, sm=document.getElementById('shm-sum');
      if(sm&&okq.length) sm.innerHTML='<div class="ss-bar"><i style="width:'+(u/okq.length*100)+'%;background:'+UP+'"></i><i style="width:'+((okq.length-u-d)/okq.length*100)+'%;background:#C9CED4"></i><i style="width:'+(d/okq.length*100)+'%;background:'+DN+'"></i></div><div class="ss-lb"><b style="color:'+UP+'">▲ 상승 '+u+'개</b><span>'+(okq.length-u-d?'보합 '+(okq.length-u-d)+'개':'')+'</span><b style="color:'+DN+'">하락 '+d+'개 ▼</b></div>';
    };
    MKT.retry['pro-sector']=loadSec; MK_LAZY(card,function(){ loadSec(); setInterval(loadSec,120000); },3000);
  }
  var FWD={"range": ["2019-05-31", "2026-09-10"], "hz": {"20": {"rows": [["극단적 공포", 229, 2.71, 3.04, 70.7, -22.2, 23.1], ["공포", 534, 1.56, 2.15, 71.3, -31.4, 13.8], ["중립", 327, 0.19, 1.06, 61.8, -29.1, 10.5], ["탐욕", 600, 0.75, 1.49, 64.8, -26.5, 7.7], ["극단적 탐욕", 117, 1.28, 1.88, 79.5, -5.8, 5.8]], "end": "2026-09-10"}, "40": {"rows": [["극단적 공포", 229, 5.28, 4.78, 76.4, -11.1, 31.0], ["공포", 530, 2.75, 3.51, 75.8, -18.7, 17.9], ["중립", 317, 0.86, 1.84, 66.2, -25.2, 12.4], ["탐욕", 594, 1.86, 3.13, 75.3, -32.2, 10.6], ["극단적 탐욕", 117, 0.1, 1.78, 60.7, -27.6, 9.6]], "end": "2026-08-12"}, "60": {"rows": [["극단적 공포", 229, 7.01, 6.53, 81.7, -9.0, 39.8], ["공포", 518, 3.56, 4.24, 74.9, -18.4, 19.2], ["중립", 316, 3.09, 4.5, 76.3, -17.6, 15.4], ["탐욕", 587, 3.4, 4.49, 78.4, -21.8, 12.8], ["극단적 탐욕", 117, -2.24, 1.67, 53.8, -30.6, 11.4]], "end": "2026-07-15"}, "80": {"rows": [["극단적 공포", 228, 7.35, 7.26, 75.4, -13.3, 43.9], ["공포", 500, 5.39, 6.29, 73.8, -16.0, 24.5], ["중립", 315, 4.54, 5.65, 81.0, -17.6, 20.6], ["탐욕", 587, 4.4, 6.39, 80.1, -28.9, 15.0], ["극단적 탐욕", 117, -2.07, -1.26, 39.3, -23.1, 12.3]], "end": "2026-06-15"}, "100": {"rows": [["극단적 공포", 228, 8.68, 8.56, 75.0, -16.6, 51.1], ["공포", 493, 6.24, 7.39, 78.5, -17.0, 32.2], ["중립", 313, 6.18, 8.13, 81.2, -20.0, 21.7], ["탐욕", 576, 5.2, 7.27, 78.0, -26.5, 18.6], ["극단적 탐욕", 117, 1.29, 2.64, 59.8, -19.8, 15.3]], "end": "2026-05-15"}, "200": {"rows": [["극단적 공포", 208, 12.77, 13.82, 68.8, -18.4, 67.5], ["공포", 470, 9.07, 10.49, 73.6, -23.0, 46.8], ["중립", 293, 11.19, 10.73, 81.9, -24.0, 35.5], ["탐욕", 540, 13.19, 14.41, 90.0, -25.3, 31.7], ["극단적 탐욕", 117, 13.86, 14.28, 96.6, -13.3, 24.9]], "end": "2025-12-19"}}, "rows": [["극단적 공포", 229, 2.71, 3.04, 70.7, -22.2, 23.1], ["공포", 534, 1.56, 2.15, 71.3, -31.4, 13.8], ["중립", 327, 0.19, 1.06, 61.8, -29.1, 10.5], ["탐욕", 600, 0.75, 1.49, 64.8, -26.5, 7.7], ["극단적 탐욕", 117, 1.28, 1.88, 79.5, -5.8, 5.8]]};

  /* ④ 시장 내부지표 · 구간별 이후 20거래일 성과 · 경제지표 */
  var anchor=document.getElementById('pro-sector')||firstGrid;
  if(anchor){
    var WORKER=PROXY_BASE.replace(/\?url=$/,'').replace(/\/+$/,'');
    var ZN=['극단적 공포','공포','중립','탐욕','극단적 탐욕'];
    var zoneOf=function(n){ return n<25?0:n<45?1:n<56?2:n<76?3:4; };
    var sg=function(v,d){ return (v>=0?'+':'')+v.toFixed(d==null?2:d); };

    var row=document.createElement('div'); row.className='pro-row';
    row.innerHTML=
      '<div class="card" id="pro-int"><h3><span>시장 내부지표 · 변동성 · 추세</span><span class="mut" style="font-weight:400;font-size:11px">Yahoo · TradingView</span></h3>'+
      '<div class="pi-sub">VIX 기간구조 <span id="vts-badge" class="vbadge">--</span></div>'+
      '<div id="vts" class="vts-wrap"></div><div class="vts-stats" id="vts-stats"></div><div class="pi-note" id="vts-note"></div>'+
      '<div class="pi-sub">지수 추세 (이동평균 대비 · 52주 고점 대비)</div>'+
      '<div id="pi-tr" class="trd"></div><div class="trd-lg"><span><i class="m m200"></i>200일선</span><span><i class="m m50"></i>50일선</span><span><i class="px"></i>현재가</span><span class="mut">막대 = 52주 저점 ~ 고점</span></div>'+
      '</div>'+
      '<div class="card" id="pro-fwd"><h3><span>공탐 구간별 이후 <span id="fwd-hn">20</span>거래일 성과</span><span class="mut" style="font-weight:400;font-size:11px" id="fwd-rg">S&amp;P500(SPY)</span></h3><div class="tabs fwd-tabs" id="fwd-tabs" role="group" aria-label="보유 기간 선택"><button class="on" data-h="20">20일</button><button data-h="40">40일</button><button data-h="60">60일</button><button data-h="80">80일</button><button data-h="100">100일</button><button data-h="200">200일</button></div><div id="fwd-body"></div></div>';
    anchor.after(row);

    /* ── 20거래일 성과 카드 ── */
    var curH='20';
    var renderFwd=function(){
      var vEl=document.getElementById('us-val'), cn=vEl?parseFloat((vEl.textContent||'').replace(/[^\d.]/g,'')):NaN, cz=isFinite(cn)?zoneOf(cn):-1;
      var H=curH, R=FWD.hz[H].rows, lo=0, hi=0;
      var hn=document.getElementById('fwd-hn'); if(hn) hn.textContent=H; var rg=document.getElementById('fwd-rg'); if(rg) rg.textContent='S&P500(SPY) · '+FWD.range[0]+' ~ '+FWD.hz[H].end;
      R.forEach(function(r){ lo=Math.min(lo,r[2]); hi=Math.max(hi,r[2]); });
      var zp=(-lo/(hi-lo||1))*100;
      var h='<div class="fwd-cur">'+(cz>=0?'현재 공탐 <b>'+Math.round(cn)+'</b> · <b>'+ZN[cz]+'</b> 구간 — 과거 이 구간의 이후 '+H+'거래일 평균 <b class="'+(R[cz][2]>=0?'up':'down')+'">'+sg(R[cz][2])+'%</b>, 상승확률 <b>'+R[cz][4].toFixed(1)+'%</b>':'현재 공탐 값을 불러오는 중…')+'</div>';
      var HS=['20','40','60','80','100','200']; h+='<div class="pi-sub">구간 × 보유기간 평균 수익률 (한눈에 비교)</div><table class="pi-tbl fwd-mx"><thead><tr><th>구간</th>'+HS.map(function(k){ return '<th'+(k===H?' class="on"':'')+'>'+k+'일</th>'; }).join('')+'</tr></thead><tbody>'+R.map(function(r,i){ return '<tr'+(i===cz?' class="cur"':'')+'><td><b>'+r[0]+'</b></td>'+HS.map(function(k){ var v=FWD.hz[k].rows[i][2]; return '<td class="'+(v>=0?'up':'down')+(k===H?' on':'')+'">'+sg(v,1)+'%</td>'; }).join('')+'</tr>'; }).join('')+'</tbody></table>';
      var wasOpen=!!document.querySelector('#fwd-body details.fwd-more[open]');
      h+='<details class="fwd-more"'+(wasOpen?' open':'')+'><summary>상세 보기 · 통계표 · 막대 · 수익률 범위</summary>';
      h+='<table class="pi-tbl"><thead><tr><th>구간</th><th>표본</th><th>평균</th><th>중앙값</th><th>상승확률</th><th>최악</th></tr></thead><tbody>'+
        R.map(function(r,i){ return '<tr'+(i===cz?' class="cur"':'')+'><td><b>'+r[0]+'</b></td><td>'+r[1]+'</td><td class="'+(r[2]>=0?'up':'down')+'">'+sg(r[2])+'%</td><td>'+sg(r[3])+'%</td><td>'+r[4].toFixed(1)+'%</td><td class="down">'+r[5].toFixed(1)+'%</td></tr>'; }).join('')+'</tbody></table>';
      h+='<div class="pi-sub">평균 수익률 · 상승확률</div><div class="fwd-bars">'+
        R.map(function(r,i){
          var w=Math.abs(r[2])/((hi-lo)||1)*100, left=r[2]>=0?zp:zp-w;
          return '<div class="fb'+(i===cz?' cur':'')+'"><span>'+r[0]+'</span><i class="fb-avg"><u class="zero" style="left:'+zp+'%"></u><u class="bar '+(r[2]>=0?'up':'down')+'" style="left:'+left+'%;width:'+w+'%"></u></i><b class="'+(r[2]>=0?'up':'down')+'">'+sg(r[2])+'%</b>'+
            '<i class="fb-win"><u class="half"></u><u class="bar" style="width:'+r[4]+'%"></u></i><b>'+r[4].toFixed(0)+'%</b></div>';
        }).join('')+'</div><div class="fb-legend"><span><i class="lg lg-a"></i>평균 수익률</span><span><i class="lg lg-w"></i>상승확률 (│ = 50%)</span></div>';
      var RL=Math.floor(Math.min.apply(null,R.map(function(r){return r[5];}))/5)*5, RH=Math.ceil(Math.max.apply(null,R.map(function(r){return r[6];}))/5)*5, rp=function(v){ return ((v-RL)/(RH-RL)*100); };
      h+='<div class="pi-sub">'+H+'거래일 수익률 범위 · 최악 ~ 최고 (● 평균)</div><div class="fwd-rng">'+
        R.map(function(r,i){ return '<div class="fr'+(i===cz?' cur':'')+'"><span>'+r[0]+'</span><i><u class="zero" style="left:'+rp(0)+'%"></u><u class="rng" style="left:'+rp(r[5])+'%;width:'+(rp(r[6])-rp(r[5]))+'%"></u><u class="dot" style="left:'+rp(r[2])+'%"></u></i><em>'+r[5].toFixed(0)+'% ~ +'+r[6].toFixed(0)+'%</em></div>'; }).join('')+'</div>';
      h+='</details>';
      /* 데이터에서 계산한 요약 */
      var bestA=R.reduce(function(a,r){return r[2]>a[2]?r:a;}), bestW=R.reduce(function(a,r){return r[4]>a[4]?r:a;}), worstD=R.reduce(function(a,r){return r[5]<a[5]?r:a;});
      var fn=R[0][1]+R[1][1], fa=(R[0][2]*R[0][1]+R[1][2]*R[1][1])/fn, fw=(R[0][4]*R[0][1]+R[1][4]*R[1][1])/fn;
      h+='<ul class="fwd-ins"><li>공포 이하(극단적 공포+공포) 합산: 평균 <b>'+sg(fa)+'%</b> · 상승확률 <b>'+fw.toFixed(1)+'%</b> (중립 '+R[2][4].toFixed(1)+'%)</li>'+
        '<li>평균 수익률이 가장 높은 구간 <b>'+bestA[0]+'</b> ('+sg(bestA[2])+'%), 상승확률이 가장 높은 구간 <b>'+bestW[0]+'</b> ('+bestW[4].toFixed(1)+'%)</li>'+
        '<li>최악 낙폭이 가장 컸던 구간은 <b>'+worstD[0]+'</b> ('+worstD[5].toFixed(1)+'%) — 평균이 좋아도 개별 시점의 손실 폭은 큽니다</li></ul>'+
        '<div class="pi-note">공탐 일별 값이 해당 구간이던 날의 종가 기준 이후 '+H+'거래일 수익률(배당 미포함)입니다. 날짜가 겹치는 표본이라 독립적인 횟수가 아니며, 과거 통계가 미래를 보장하지 않습니다.</div>';
      document.getElementById('fwd-body').innerHTML=h;
    };
    var fwdTabs=document.getElementById('fwd-tabs');
    if(fwdTabs) fwdTabs.addEventListener('click',function(e){ var b=e.target.closest('button'); if(!b) return; curH=b.dataset.h; fwdTabs.querySelectorAll('button').forEach(function(x){ x.classList.toggle('on',x===b); }); renderFwd(); });
    renderFwd(); setInterval(renderFwd,5000);

    /* ── 경제지표 카드 ── */
    var cal=document.createElement('div'); cal.className='card'; cal.id='pro-cal'; cal.style.marginTop='12px';
    cal.innerHTML='<h3><span>경제지표 · 핵심 일정</span><span class="mut" style="font-weight:400;font-size:11px">최상 일정 3건만 표시 · 나머지는 상세보기</span></h3>'+
      '<div id="cal-top"></div><div id="cal-body"><div class="pi-note">불러오는 중…</div></div><div id="cal-more"></div><div class="pi-note" id="pc-note"></div>';
    row.after(cal);
    var CAL={mode:'fallback',rows:[],open:false};
    var KOPPL={Powell:'파월',Waller:'월러',Musalem:'무살렘',Collins:'콜린스',Williams:'윌리엄스',Jefferson:'제퍼슨',Barr:'바',Bowman:'보먼',Cook:'쿡',Kashkari:'카시카리',Logan:'로건',Goolsbee:'굴즈비',Daly:'데일리',Bostic:'보스틱',Harker:'하커',Hammack:'해맥',Schmid:'슈미드',Barkin:'바킨',Mester:'메스터',Kugler:'쿠글러',Miran:'미란',Paulson:'폴슨',Bullard:'불라드',Evans:'에번스',Kaplan:'캐플런',Rosengren:'로젠그렌',Lagarde:'라가르드'};
    var KORULES=[
      [/^Fed Interest Rate Decision/i,'연준 기준금리 결정'],[/^FOMC Minutes/i,'FOMC 의사록'],[/^FOMC Press Conference/i,'FOMC 기자회견'],[/^FOMC Economic Projections/i,'FOMC 경제전망(점도표)'],[/^Fed Chair (\w+)/i,function(m){return '연준 의장 '+(KOPPL[m[1]]||m[1])+' 연설';}],
      [/^Fed (\w+) Speech/i,function(m){return '연준 '+(KOPPL[m[1]]||m[1])+' 연설';}],[/^Fed (\w+) Testimony/i,function(m){return '연준 '+(KOPPL[m[1]]||m[1])+' 의회 증언';}],[/^Beige Book/i,'베이지북'],[/^Philly Fed (Employment|New Orders|Prices Paid|CAPEX|Business Conditions)/i,function(m){return '필라델피아 연은 '+({employment:'고용',neworders:'신규주문',pricespaid:'지불물가',capex:'설비투자',businessconditions:'업황'})[m[1].toLowerCase().replace(/ /g,'')];}],[/^Fed Balance Sheet/i,'연준 대차대조표'],[/^Reserve Balances with Fed Banks/i,'연은 지급준비금'],[/^NY Fed Services Activity/i,'뉴욕 연은 서비스업지수'],[/^NY Fed Bill Purchases/i,'뉴욕 연은 단기국채 매입'],[/^Overall Net Capital Flows/i,'순자본 유입(TIC 전체)'],[/^WASDE Report/i,'WASDE 곡물수급전망'],[/^NOPA Crush/i,'NOPA 대두 압착량'],[/^Columbus Day/i,'콜럼버스 데이'],
      [/^Non ?Farm Payrolls/i,'비농업 고용(NFP)'],[/^Unemployment Rate/i,'실업률'],[/^Average Hourly Earnings/i,'평균 시간당 임금'],[/^Average Weekly Hours/i,'평균 주당 근로시간'],[/^Participation Rate/i,'경제활동참가율'],
      [/^Initial Jobless Claims/i,'신규 실업수당 청구'],[/^Continuing Jobless Claims/i,'연속 실업수당 청구'],[/^Jobless Claims 4-week/i,'실업수당 청구 4주 평균'],[/^ADP Employment Change Weekly/i,'ADP 주간 민간고용'],[/^ADP Employment Change/i,'ADP 민간고용'],[/^JOLTs? Job Openings/i,'JOLTS 구인건수'],[/^Challenger Job Cuts/i,'챌린저 감원'],[/^Nonfarm Productivity/i,'비농업 생산성'],[/^Unit Labor Costs/i,'단위노동비용'],[/^Employment Cost Index/i,'고용비용지수'],
      [/^Core Inflation Rate/i,'근원 소비자물가(근원 CPI)'],[/^Inflation Rate/i,'소비자물가(CPI)'],[/^Core CPI/i,'근원 CPI'],[/^CPI Trimmed-Mean/i,'CPI 절사평균'],[/^CPI Median/i,'CPI 중앙값'],[/^CPI/i,'소비자물가지수(CPI)'],
      [/^Core PPI/i,'근원 생산자물가(근원 PPI)'],[/^PPI Ex Food/i,'PPI(식품·에너지 제외)'],[/^PPI/i,'생산자물가(PPI)'],[/^Core PCE Price Index/i,'근원 PCE 물가지수'],[/^PCE Price Index/i,'PCE 물가지수'],[/^Personal Income/i,'개인소득'],[/^Personal Spending/i,'개인소비지출'],[/^Export Prices/i,'수출물가'],[/^Import Prices/i,'수입물가'],
      [/^GDP Growth Rate/i,'GDP 성장률'],[/^GDP Price Index/i,'GDP 물가지수'],[/^Atlanta Fed GDPNow/i,'애틀랜타 연은 GDPNow'],[/^GDP Deflator/i,'GDP 디플레이터'],[/^Gross Domestic Product/i,'GDP'],
      [/^ISM Manufacturing PMI/i,'ISM 제조업 PMI'],[/^ISM Services PMI/i,'ISM 서비스업 PMI'],[/^ISM Manufacturing Prices/i,'ISM 제조업 물가지수'],[/^ISM Manufacturing Employment/i,'ISM 제조업 고용'],[/^ISM Manufacturing New Orders/i,'ISM 제조업 신규주문'],[/^S&P Global Manufacturing PMI/i,'S&P글로벌 제조업 PMI'],[/^S&P Global Services PMI/i,'S&P글로벌 서비스업 PMI'],[/^S&P Global Composite PMI/i,'S&P글로벌 종합 PMI'],[/^Chicago PMI/i,'시카고 PMI'],
      [/^Philadelphia Fed Manufacturing/i,'필라델피아 연은 제조업지수'],[/^NY Empire State Manufacturing/i,'뉴욕 엠파이어스테이트 제조업지수'],[/^Richmond Fed Manufacturing/i,'리치먼드 연은 제조업지수'],[/^Kansas Fed Manufacturing/i,'캔자스시티 연은 제조업지수'],[/^Dallas Fed Manufacturing/i,'댈러스 연은 제조업지수'],[/^Industrial Production/i,'산업생산'],[/^Capacity Utilization/i,'설비가동률'],[/^Manufacturing Production/i,'제조업 생산'],
      [/^Michigan Consumer Sentiment/i,'미시간대 소비자심리지수'],[/^Michigan Inflation Expectations/i,'미시간대 기대인플레이션'],[/^Michigan 5 Year Inflation/i,'미시간대 5년 기대인플레이션'],[/^CB Consumer Confidence/i,'컨퍼런스보드 소비자신뢰지수'],[/^Consumer Confidence/i,'소비자신뢰지수'],[/^NFIB Business Optimism/i,'NFIB 소기업 낙관지수'],[/^CB Leading Index/i,'컨퍼런스보드 경기선행지수'],
      [/^Retail Sales Control Group/i,'소매판매(컨트롤 그룹)'],[/^Retail Sales Ex Autos/i,'소매판매(자동차 제외)'],[/^Retail Sales Ex Gas/i,'소매판매(자동차·휘발유 제외)'],[/^Retail Sales/i,'소매판매'],[/^Redbook/i,'레드북 소매판매'],[/^Durable Goods Orders Ex Transportation/i,'내구재 주문(운송 제외)'],[/^Durable Goods Orders/i,'내구재 주문'],[/^Core Durable Goods Orders/i,'근원 내구재 주문'],[/^Factory Orders/i,'공장재 주문'],[/^Business Inventories/i,'기업재고'],[/^Wholesale Inventories/i,'도매재고'],
      [/^Housing Starts/i,'주택착공'],[/^Building Permits/i,'건축허가'],[/^Existing Home Sales/i,'기존주택 매매'],[/^New Home Sales/i,'신규주택 매매'],[/^Pending Home Sales/i,'잠정주택 매매'],[/^NAHB Housing Market Index/i,'NAHB 주택시장지수'],[/^Case.?Shiller/i,'케이스-실러 주택가격'],[/^FHFA House Price/i,'FHFA 주택가격지수'],[/^MBA 30-Year Mortgage Rate/i,'MBA 30년 모기지 금리'],[/^MBA Mortgage Applications/i,'MBA 모기지 신청'],[/^MBA Mortgage Market Index/i,'MBA 모기지 시장지수'],[/^MBA Purchase Index/i,'MBA 주택구입 지수'],[/^MBA Mortgage Refinance/i,'MBA 재융자 지수'],
      [/^Trade Balance/i,'무역수지'],[/^Goods Trade Balance/i,'상품 무역수지'],[/^Current Account/i,'경상수지'],[/^Monthly Budget Statement/i,'월간 재정수지'],[/^Net Long-term TIC Flows/i,'해외 장기증권 순유입(TIC)'],[/^Foreign Bond Investment/i,'해외 채권 투자'],[/^Consumer Credit Change/i,'소비자신용 변동'],
      [/^API Crude Oil Stock Change/i,'API 원유 재고 변동'],[/^EIA Crude Oil Stocks Change/i,'EIA 원유 재고 변동'],[/^EIA Gasoline Stocks Change/i,'EIA 휘발유 재고 변동'],[/^EIA Distillate/i,'EIA 정제유 재고 변동'],[/^EIA Natural Gas Stocks Change/i,'EIA 천연가스 재고 변동'],[/^EIA Refinery Crude Runs/i,'EIA 정유시설 가동'],[/^EIA Cushing/i,'EIA 쿠싱 원유 재고'],[/^Baker Hughes Oil Rig Count/i,'베이커휴즈 원유 시추기 수'],[/^Baker Hughes Total Rig Count/i,'베이커휴즈 전체 시추기 수'],[/^Crude Oil Imports/i,'원유 수입'],
      [/^(\d+)-Year (Note|Bond) Auction/i,function(m){return m[1]+'년물 국채 입찰';}],[/^(\d+)-Month Bill Auction/i,function(m){return m[1]+'개월 단기국채 입찰';}],[/^(\d+)-Week Bill Auction/i,function(m){return m[1]+'주 단기국채 입찰';}],[/^(\d+)-Year TIPS Auction/i,function(m){return m[1]+'년물 물가연동채 입찰';}],[/^(\d+)-Year FRN Auction/i,function(m){return m[1]+'년물 변동금리채 입찰';}]
    ];
    var KOMOD=[[/\bMoM\b/i,'전월비'],[/\bYoY\b/i,'전년비'],[/\bQoQ\b/i,'전분기비'],[/\bPrel\b/i,'예비'],[/\bFinal\b/i,'확정'],[/\bFlash\b/i,'속보'],[/\bAdv\b/i,'속보치'],[/\b2nd Est\b/i,'2차 추정'],[/\b3rd Est\b/i,'3차 추정'],[/\bs\.a\b/i,'계절조정'],[/\bn\.s\.a\b/i,'비계절조정']];
    var koTitle=function(en){
      for(var i=0;i<KORULES.length;i++){ var m=en.match(KORULES[i][0]); if(m){ var base=typeof KORULES[i][1]==='function'?KORULES[i][1](m):KORULES[i][1], mods=[]; KOMOD.forEach(function(x){ if(x[0].test(en)) mods.push(x[1]); }); return base+(mods.length?' ('+mods.join('·')+')':''); } }
      return null;
    };
    var DOW=['일','월','화','수','목','금','토'], pad=function(n){return String(n).padStart(2,'0');};
    var fnum=function(v,e){ if(v==null) return '--'; var x=(Math.abs(v)>=1000?v.toLocaleString('en-US',{maximumFractionDigits:1}):(+v.toFixed(3)).toString()); return x+(e&&e.unit==='%'?'%':''); };
    var buildFallback=function(){
      var now=new Date(), today=new Date(now.getFullYear(),now.getMonth(),now.getDate()), lim=today.getTime()+30*86400000, L=[];
      try{ Object.keys(MONTH_EVENTS).forEach(function(mk){ (MONTH_EVENTS[mk]||[]).forEach(function(e){
        if(e.hol) return; var dt=new Date(now.getFullYear(),+mk-1,e.d); if(dt<today||dt.getTime()>lim) return;
        L.push({d:dt,time:'',imp:e.g==='h'?2:e.g==='m'?1:0,title:e.t,sub:e.c||'',link:e.s}); }); }); }catch(e){}
      L.sort(function(a,b){return a.d-b.d;}); return L;
    };
    var drawCal=function(){
      var body=document.getElementById('cal-body'); if(!body) return;
      var topEl=document.getElementById('cal-top'), nm=Date.now(), nx=null;
      CAL.rows.forEach(function(r){ if(!nx&&r.imp>=2&&r.d.getTime()>=nm-1800000) nx=r; });
      if(topEl){ if(nx){ var diff=nx.d.getTime()-nm, td=new Date(); td=new Date(td.getFullYear(),td.getMonth(),td.getDate()); var dd=Math.round((new Date(nx.d.getFullYear(),nx.d.getMonth(),nx.d.getDate())-td)/86400000);
          var cd=(CAL.mode==='live'&&diff>0&&diff<36e5*24)?(Math.floor(diff/36e5)+'시간 '+Math.floor(diff%36e5/6e4)+'분 후'):(dd===0?'오늘':'D-'+dd);
          topEl.innerHTML='<div class="cal-alert"><span class="ca-tag">최상 · 다음 일정</span><b>'+nx.title+(nx.period?' <small>'+nx.period+'</small>':'')+'</b><span class="ca-when">'+pad(nx.d.getMonth()+1)+'.'+pad(nx.d.getDate())+' ('+DOW[nx.d.getDay()]+')'+(nx.time?' '+nx.time:'')+'</span><em>'+cd+'</em></div>'; } else topEl.innerHTML=''; }
      var hiRows=CAL.rows.filter(function(r){ return r.imp>=2; }).slice(0,3), rest=CAL.rows.length-hiRows.length, rows=CAL.open?CAL.rows:hiRows;
      var mo=document.getElementById('cal-more');
      if(mo){ mo.innerHTML=rest>0?'<button type="button" class="cal-more-btn">'+(CAL.open?'접기 ▴':'상세보기 ▾ · 나머지 '+rest+'건')+'</button>':''; var bt=mo.querySelector('button'); if(bt) bt.onclick=function(){ CAL.open=!CAL.open; drawCal(); }; }
      if(!rows.length){ body.innerHTML='<div class="pi-note" style="padding:8px 0">기간 내 최상 일정이 없습니다.'+(rest>0?' 아래 상세보기에서 나머지 일정을 확인하세요.':'')+'</div>'; return; }
      var today=new Date(); today=new Date(today.getFullYear(),today.getMonth(),today.getDate());
      var nextIdx=-1, nowMs=Date.now();
      rows.forEach(function(r,i){ if(nextIdx<0&&r.d.getTime()>=nowMs-1800000) nextIdx=i; });
      var live=CAL.mode==='live', h='<div class="cal-list'+(live?'':' noval')+'"><div class="cal-hd"><span>시각</span><span>중요도</span><span>지표</span>'+(live?'<span>이전</span><span>예상</span><span>결과</span>':'')+'</div>', last='';
      rows.forEach(function(r,i){
        var k=r.d.getFullYear()+'-'+r.d.getMonth()+'-'+r.d.getDate();
        if(k!==last){ last=k; var dd=Math.round((new Date(r.d.getFullYear(),r.d.getMonth(),r.d.getDate())-today)/86400000);
          h+='<div class="cal-day"><b>'+pad(r.d.getMonth()+1)+'.'+pad(r.d.getDate())+' ('+DOW[r.d.getDay()]+')</b><em>'+(dd===0?'오늘':dd<0?'지남':'D-'+dd)+'</em></div>'; }
        var imp=r.imp>=2?'h':r.imp===1?'m':'l', dots='<span class="imp-dots imp-'+imp+'" title="'+(r.imp>=2?'높음':r.imp===1?'중간':'낮음')+'"><i></i><i></i><i></i></span>';
        var hiTag=r.imp>=2?'<s class="hi-tag">최상</s>':''; var ttl=r.link?'<a href="'+r.link+'" target="_blank" rel="noopener">'+r.title+'</a>':'<b>'+r.title+'</b>';
        var vals='';
        if(live){
          var tone='', badge='';
          if(r.actual!=null&&r.forecast!=null){ if(r.actual>r.forecast){tone='up';badge='<s class="bd up">상회</s>';} else if(r.actual<r.forecast){tone='down';badge='<s class="bd down">하회</s>';} else badge='<s class="bd">부합</s>'; }
          vals='<span class="cv" data-l="이전">'+fnum(r.prev,r)+'</span><span class="cv" data-l="예상">'+fnum(r.forecast,r)+'</span><span class="cv res '+tone+'" data-l="결과">'+(r.actual==null?'<em class="wait">대기</em>':'<b>'+fnum(r.actual,r)+'</b>'+badge)+'</span>';
        }
        h+='<div class="cal-row'+(i===nextIdx?' next':'')+(r.imp>=2?' hi':'')+'"><span class="ct">'+(r.time||'--:--')+'</span><span class="ci">'+dots+'</span><span class="cn">'+ttl+hiTag+(r.period?' <small>'+r.period+'</small>':'')+(r.sub?'<small class="cs">'+r.sub+'</small>':'')+'</span>'+vals+'</div>';
      });
      body.className=CAL.open?'open':''; body.innerHTML=h+'</div>';
    };
    CAL.rows=buildFallback(); drawCal();
    document.getElementById('pc-note').textContent='제목을 누르면 발표 기관 페이지로 이동합니다 · 예상·이전·결과는 집계 서버 연결 시 표시됩니다.';

    var wj=async function(path){ try{ var r=await fetch(WORKER+path,{signal:AbortSignal.timeout?AbortSignal.timeout(9000):undefined}); if(!r.ok){ window.MK_NET&&MK_NET.rec(false); return {err:'HTTP '+r.status}; } var j=await r.json(); var okj=j&&!j.error; window.MK_NET&&MK_NET.rec(!!okj); return okj?j:{err:(j&&j.error)||'빈 응답'}; }catch(e){ window.MK_NET&&MK_NET.rec(false); return {err:String(e.message||e)}; } };
    var loadEcon=async function(){
      var j=await wj('/us-econ?days=14');
      if(!j||j.err||!j.events||!j.events.length){ MKT.set('pro-cal','fail'); return; }
      var KEYRE=/FOMC|Fed Chair|Powell|Nonfarm|Unemployment Rate|Jobless Claims|GDP|PCE|ISM|Retail Sales MoM|Core Inflation|Inflation Rate/i;
      CAL.rows=j.events.map(function(e){
        var d=new Date(e.t); var k=new Date(d.getTime()+9*3600000);
        return {d:d,time:pad(k.getUTCHours())+':'+pad(k.getUTCMinutes()),imp:e.imp>=1?2:(KEYRE.test(e.title)?1:0),title:(koTitle(e.title)||e.title),sub:(koTitle(e.title)?e.title:''),period:e.period,unit:e.unit,actual:e.actual,forecast:e.forecast,prev:e.prev};
      }).sort(function(a,b){return a.d-b.d;});
      /* 표시 시각은 한국시간이지만 날짜 구분도 한국 기준으로 */
      CAL.rows.forEach(function(r){ var k=new Date(r.d.getTime()+9*3600000); r.d=new Date(k.getUTCFullYear(),k.getUTCMonth(),k.getUTCDate(),k.getUTCHours(),k.getUTCMinutes()); });
      CAL.mode='live'; drawCal(); MKT.set('pro-cal','ok');
      document.getElementById('pc-note').innerHTML='출처: TradingView 경제캘린더(집계 서버 경유, 5분 캐시) · 미국 · 시각은 한국시간(KST). 예상치는 발표가 임박해야 채워지는 항목이 많습니다. 결과가 예상보다 크면 <b style="color:var(--up)">상회(빨강)</b>, 작으면 <b style="color:var(--down)">하회(파랑)</b>입니다.';
    };
    MKT.retry['pro-cal']=loadEcon; MK_LAZY(cal,function(){ loadEcon(); setInterval(loadEcon,300000); },4200);

    /* ── VIX 기간구조 곡선 ── */
    var vixSvg=function(pts,st,cw){
      var W=Math.max(300,Math.min(560,cw||360)),H=136,L=18,Rr=18,T=26,B=26, vs=pts.map(function(p){return p.v;}), mn=Math.min.apply(null,vs), mx=Math.max.apply(null,vs), pad2=Math.max(1,(mx-mn)*.35);
      var y0=mn-pad2, y1=mx+pad2, X=function(i){return L+i*(W-L-Rr)/(pts.length-1);}, Y=function(v){return T+(1-(v-y0)/(y1-y0))*(H-T-B);};
      var col=st==='inv'?'#D92D20':st==='mix'?'#B7791F':'#0A6B48', line=pts.map(function(p,i){return (i?'L':'M')+X(i).toFixed(1)+' '+Y(p.v).toFixed(1);}).join(' ');
      var area=line+' L'+X(pts.length-1).toFixed(1)+' '+(H-B)+' L'+X(0).toFixed(1)+' '+(H-B)+' Z', sp=Y(pts[1].v);
      return '<svg viewBox="0 0 '+W+' '+H+'" class="vsvg" role="img" aria-label="VIX 기간구조 곡선"><line x1="'+L+'" x2="'+(W-Rr)+'" y1="'+(H-B)+'" y2="'+(H-B)+'" stroke="#D5D9DD"/>'+
        '<line x1="'+L+'" x2="'+(W-Rr)+'" y1="'+sp.toFixed(1)+'" y2="'+sp.toFixed(1)+'" stroke="#98A2B3" stroke-dasharray="3 3"/><text x="'+(W-Rr)+'" y="'+(sp-4).toFixed(1)+'" text-anchor="end" font-size="9" fill="#667085">현물 VIX '+pts[1].v.toFixed(1)+'</text>'+
        '<path d="'+area+'" fill="'+col+'" opacity=".10"/><path d="'+line+'" fill="none" stroke="'+col+'" stroke-width="2.2" stroke-linejoin="round"/>'+
        pts.map(function(p,i){ return '<circle cx="'+X(i).toFixed(1)+'" cy="'+Y(p.v).toFixed(1)+'" r="4" fill="#fff" stroke="'+col+'" stroke-width="2"/><text x="'+X(i).toFixed(1)+'" y="'+(Y(p.v)-9).toFixed(1)+'" text-anchor="middle" font-size="12" font-weight="700" font-family="JetBrains Mono,monospace" fill="#111418">'+p.v.toFixed(2)+'</text><text x="'+X(i).toFixed(1)+'" y="'+(H-9)+'" text-anchor="middle" font-size="10.5" fill="#667085">'+p.l+'</text>'; }).join('')+'</svg>';
    };

    async function hist(sym){
      try{
        var j=await getJSON('https://query1.finance.yahoo.com/v8/finance/chart/'+encodeURIComponent(sym)+'?range=1y&interval=1d');
        var r=j.chart.result[0], c=mkFillClose(r).filter(function(x){return x!=null;});
        var p=(r.meta&&r.meta.regularMarketPrice!=null)?r.meta.regularMarketPrice:c[c.length-1];
        if(c.length<60) return null;
        var avg=function(n){ var s=c.slice(-n); return s.reduce(function(a,b){return a+b;},0)/s.length; };
        return {p:p, m50:avg(50), m200:c.length>=200?avg(200):null, hi:Math.max.apply(null,c.concat([p])), lo:Math.min.apply(null,c.concat([p]))};
      }catch(e){ return null; }
    }
    var pc=function(a,b){ return (a/b-1)*100; };
    var cell=function(v){ return v==null?'<td class="mut">--</td>':'<td class="'+(v>=0?'up':'down')+'">'+sg(v,1)+'%</td>'; };
    var loadInt=async function(){
      var VS=[['^VIX9D','9일'],['^VIX','30일'],['^VIX3M','3개월'],['^VIX6M','6개월']];
      var vq=await Promise.all(VS.map(function(s){return quote(s[0]);}));
      var ok=vq.every(Boolean), box=document.getElementById('vts'), bd=document.getElementById('vts-badge'), stt=document.getElementById('vts-stats'), nt=document.getElementById('vts-note');
      if(ok){
        var v=vq.map(function(q){return q.p;}), inc=v[0]<=v[1]&&v[1]<=v[2]&&v[2]<=v[3], inv=v[0]>v[2]||v[1]>v[2], st=inv?'inv':(inc?'norm':'mix');
        box.innerHTML=vixSvg(VS.map(function(s,i){return {l:s[1],v:v[i]};}),st,box.clientWidth-14);
        bd.className='vbadge '+st; bd.textContent=st==='inv'?'역전 (백워데이션)':st==='norm'?'정상 (콘탱고)':'혼조';
        var sp=v[2]-v[1];
        stt.innerHTML='<div><span>3개월−30일 스프레드</span><b class="'+(sp>=0?'':'warn')+'">'+sg(sp)+'pt ('+sg(sp/v[1]*100,1)+'%)</b></div><div><span>9일 ÷ 30일</span><b class="'+(v[0]/v[1]>1?'warn':'')+'">'+(v[0]/v[1]).toFixed(2)+'</b></div><div><span>6개월−9일</span><b>'+sg(v[3]-v[0])+'pt</b></div>';
        nt.innerHTML='<div class="vts-def">※ <b>'+(st==='norm'?'콘탱고(정상)':st==='inv'?'백워데이션(역전)':'혼조')+'</b> : '+(st==='norm'?'만기가 길수록 VIX가 높은 평시 구조 — 시장이 당장은 안정적이라고 본다는 뜻입니다.':st==='inv'?'단기 VIX가 장기보다 높은 구조 — 당장의 불안이 크다는 경고 신호입니다.':'기간별 VIX 순서가 일정하지 않아 방향이 불분명한 상태입니다.')+'</div>'+(st==='inv'?'<b style="color:var(--up)">곡선이 우하향(역전)</b> — 단기 변동성이 중장기보다 높아 지금 당장의 불안이 크다는 신호입니다.':st==='norm'?'<b>곡선이 우상향(정상)</b> — 단기 &lt; 장기 순으로 올라가는 평시 구조입니다. 기울기가 가파를수록 시장은 안정적이지만 미래 변동성에 대한 보험료도 높게 매겨진 상태입니다.':'곡선이 일부 구간에서 꺾여 있어 방향이 뚜렷하지 않습니다.');
      } else { box.innerHTML='<div class="pi-note">VIX 기간구조 데이터를 불러오지 못했습니다.</div>'; bd.textContent='--'; }
      MKT.set('pro-int',ok?'ok':'fail');
      var IX=['SPY','QQQ','IWM','RSP'];
      var hs=await Promise.all(IX.map(hist));
      document.getElementById('pi-tr').innerHTML=IX.map(function(sy,i){ var h=hs[i];
        if(!h) return '<div class="tr-row"><div class="tr-hd"><b>'+sy+'</b><span class="mut">데이터 없음</span></div></div>';
        var rg=(h.hi-h.lo)||1, pos=function(v){ return Math.max(0,Math.min(100,(v-h.lo)/rg*100)); };
        var st=(h.m200&&h.p>h.m50&&h.m50>h.m200)?['정배열','up']:(h.m200&&h.p<h.m50&&h.m50<h.m200)?['역배열','down']:['혼조',''];
        var chip=function(l,v){ return v==null?'':'<span class="chip '+(v>=0?'up':'down')+'">'+l+' '+sg(v,1)+'%</span>'; };
        return '<div class="tr-row"><div class="tr-hd"><b>'+sy+'</b><span class="st '+st[1]+'">'+st[0]+'</span><span class="chips">'+chip('50일',pc(h.p,h.m50))+chip('200일',h.m200?pc(h.p,h.m200):null)+chip('고점',pc(h.p,h.hi))+'</span></div>'+
          '<div class="tr-bar"><i class="fill" style="width:'+pos(h.p)+'%"></i>'+(h.m200?'<u class="m m200" style="left:'+pos(h.m200)+'%"></u>':'')+'<u class="m m50" style="left:'+pos(h.m50)+'%"></u><u class="px" style="left:'+pos(h.p)+'%"></u></div>'+
          '<div class="tr-sc"><span>저점 '+fmt(h.lo,0)+'</span><span>고점 '+fmt(h.hi,0)+'</span></div></div>'; }).join('');
    };
    MKT.retry['pro-int']=loadInt; MK_LAZY(document.getElementById('pro-int'),function(){ loadInt(); setInterval(loadInt,300000); },3600);
  }

  /* ⑤ 지수 편입·편출 — 지수 선택(전체 / S&P500 / 나스닥100) */
  (function(){
    var host=document.getElementById('idxchg-tbl'), per=document.querySelector('.tabs[data-group="idxchg"]');
    if(!host||!per) return;
    var wrap=document.createElement('div'); wrap.className='tabrow'; per.before(wrap); wrap.appendChild(per);
    var sel=document.createElement('div'); sel.className='seg ixf';
    sel.innerHTML='<button class="on" data-x="">전체</button><button data-x="sp">S&amp;P500</button><button data-x="nq">나스닥100</button>';
    wrap.appendChild(sel);
    var sel2=document.createElement('div'); sel2.className='seg ixf ixio'; sel2.setAttribute('role','group'); sel2.setAttribute('aria-label','편입·편출 구분');
    sel2.innerHTML='<button class="on" data-y="">편입+편출</button><button data-y="in">편입</button><button data-y="out">편출</button>';
    wrap.appendChild(sel2);
    var cur='', curT='', busy=false;
    var apply=function(){
      busy=true;
      host.querySelectorAll('.wl-row').forEach(function(r){ var tag=r.querySelector('.ix'); var is=!cur||(tag&&tag.classList.contains('ix-'+cur)); r.style.display=is?'':'none'; var nx=r.nextElementSibling; if(nx&&/^finx/.test(nx.id||'')&&!is) nx.style.display='none'; });
      Array.prototype.forEach.call(host.children,function(g){
        var lists=g.querySelectorAll('.wl-list'); if(!lists.length) return;
        var cnt=[], typs=[];
        lists.forEach(function(l){ var lb0=l.previousElementSibling, typ=(lb0&&/편출/.test(lb0.textContent||''))?'out':'in'; var n=(curT&&curT!==typ)?0:l.querySelectorAll('.wl-row:not([style*="display: none"])').length; cnt.push(n); typs.push(typ); l.style.display=n?'':'none'; var lab=l.previousElementSibling; if(lab&&lab.className!=='wl-list') lab.style.display=n?'':'none'; });
        var tot=cnt.reduce(function(a,b){return a+b;},0); g.style.display=tot?'':'none';
        var sm=g.querySelector('.mut'); if(sm&&cnt.length>=1&&(cur||curT)) { var ci=0,co=0; typs.forEach(function(t,i){ if(t==='out') co+=cnt[i]; else ci+=cnt[i]; }); sm.textContent='· 편입 '+ci+' · 편출 '+co; }
      });
      var emp=document.getElementById('ixf-empty'); if(emp) emp.remove();
      if((cur||curT)&&!Array.prototype.some.call(host.children,function(g){return g.style.display!=='none'&&g.querySelector&&g.querySelector('.wl-list');})){ var d=document.createElement('div'); d.id='ixf-empty'; d.className='pi-note'; d.textContent='선택한 기간에 해당 지수의 편입·편출 종목이 없습니다.'; host.after(d); }
      busy=false;
    };
    sel.addEventListener('click',function(e){ var b=e.target.closest('button'); if(!b) return; sel.querySelectorAll('button').forEach(function(x){x.classList.toggle('on',x===b);}); cur=b.dataset.x; apply(); });
    sel2.addEventListener('click',function(e){ var b=e.target.closest('button'); if(!b) return; sel2.querySelectorAll('button').forEach(function(x){x.classList.toggle('on',x===b);}); curT=b.dataset.y; apply(); });
    new MutationObserver(function(){ if(!busy&&(cur||curT)) apply(); }).observe(host,{childList:true});
  })();

  /* ⑥ 김군코멘트 시각화 */
  (function(){
    var kc=document.getElementById('us-kimcomment'), row=document.querySelector('#stock .fg-row'); if(!kc||!row) return;
    var box=document.createElement('div'); box.id='pro-kc'; row.after(box);
    var ZC=['#C42318','#C2410C','#566074','#3F7D20','#0B6B3A'], ZN=['극단적 공포','공포','중립','탐욕','극단적 탐욕'], ACT=['매수 시작','매수 시작','관망','매수 금지','매수 금지'];
    var draw=function(){
      var v=document.getElementById('us-val'), n=v?parseFloat((v.textContent||'').replace(/[^\d.]/g,'')):NaN; if(!isFinite(n)) return;
      var nt=document.getElementById('us-note'), dl=nt?(nt.textContent||'').replace(/\s+/g,' ').trim():''; if(!/전일/.test(dl)) dl='';
      var z=n<25?0:n<45?1:n<=55?2:n<=75?3:4, a=ACT[z], pill=function(t,cls){ return '<span class="act '+cls+(a===t?' on':'')+'">'+t+'</span>'; };
      box.innerHTML='<div class="kc" style="--zc:'+ZC[z]+'"><div class="kc-l"><span class="kc-k">김군코멘트</span><div class="kc-t"><em>'+ZN[z]+'</em><i>→</i><b>'+a+'</b></div>'+(dl?'<div class="kc-d '+(/▲/.test(dl)?'up':/▼/.test(dl)?'down':'')+'">'+dl+'</div>':'')+'</div>'+
        '<div class="kc-r">'+pill('매수 시작','buy')+pill('관망','wait')+pill('매수 금지','stop')+'</div></div>';
    };
    var vv=document.getElementById('us-val'); if(vv) new MutationObserver(draw).observe(vv,{childList:true,characterData:true,subtree:true});
    draw(); setInterval(draw,3000);
  })();

  /* ⑦ 종목 재무 패널 · 레버리지 체크패널 후처리 (김군 판정 패턴: 색 제목 줄 · 좌우 균형 · 유의사항) */
  (function(){
    var DISC='<div class="fin-disc"><b>⚠ 투자 유의사항</b><span>이 화면의 등급·판정·지표 해석은 Yahoo Finance 데이터를 바탕으로 한 자체 계산 기준의 <u>참고 자료</u>이며, 특정 종목의 매수·매도를 권유하지 않습니다. 시세·재무 데이터는 제공처 사정에 따라 지연되거나 오차가 있을 수 있고, 투자에 대한 최종 판단과 책임은 투자자 본인에게 있습니다.</span></div>';
    var balance=function(host){
      var wr=null; host.querySelectorAll('div').forEach(function(c){ if(!wr&&c.children.length===2&&/flex-wrap:wrap/.test(c.getAttribute('style')||'')&&/flex:1 1 360px/.test(c.children[0].getAttribute('style')||'')) wr=c; });
      if(!wr) return;
      var c0=wr.children[0], c1=wr.children[1], cards=Array.prototype.slice.call(c0.children).concat(Array.prototype.slice.call(c1.children));
      if(cards.length<3) return;
      var hs=cards.map(function(c){ return c.offsetHeight+12; }), tot=hs.reduce(function(a,b){return a+b;},0), best=1, bd=1e9, acc=0;
      for(var i=0;i<cards.length-1;i++){ acc+=hs[i]; var d=Math.abs(tot/2-acc); if(d<bd){bd=d;best=i+1;} }
      cards.forEach(function(c,i){ (i<best?c0:c1).appendChild(c); });
      wr.classList.add('fin-cols'); c0.classList.add('fin-col'); c1.classList.add('fin-col');
    };
    var procFin=function(host){
      if(host.dataset.pro||!host.children.length||host.querySelector(':scope > p.mut')) return;
      if(!host.querySelector('div[style*="border-radius:12px"]')) return;
      host.dataset.pro='1'; balance(host);
      var d=document.createElement('div'); d.innerHTML=DISC; host.appendChild(d.firstChild);
    };
    var procLev=function(el){
      if(el.dataset.pro) return; el.dataset.pro='1';
      el.querySelectorAll('div[style*="font-size:11.5px;font-weight:800"]').forEach(function(h){
        var g=h.nextElementSibling; if(!g||!/grid/.test(g.getAttribute('style')||'')) return;
        var sec=document.createElement('div'); sec.className='lv-sec'; h.before(sec); h.className='lv-hd'; h.removeAttribute('style'); g.classList.add('lv-body'); sec.appendChild(h); sec.appendChild(g); if(g.children.length>4) sec.classList.add('wide');
      });
      var t=el.querySelector('div[style*="font-size:13px;font-weight:900"]'); if(t){ t.classList.add('lv-title'); t.removeAttribute('style'); }
      var tail=el.lastElementChild; if(tail&&/참고용이며 투자 권유가 아닙니다/.test(tail.textContent||'')){ tail.className='fin-disc'; tail.removeAttribute('style'); tail.innerHTML='<b>⚠ 투자 유의사항</b><span>레버리지 ETF는 일일 수익률을 추종해 장기 보유 시 복리 감쇠로 손실이 커질 수 있으며, 원금 전액 손실도 가능합니다. 이 패널은 Yahoo Finance 데이터와 자체 계산에 기반한 참고 자료로 투자 권유가 아니며, 투자 판단과 책임은 투자자 본인에게 있습니다.</span>'; }
    };
    var pending=false, scan=function(){
      pending=false;
      document.querySelectorAll('[id^="finx"],[id^="fin-"]').forEach(function(h){ if(h.style.display!=='none') procFin(h); });
      document.querySelectorAll('.lev-inv:not([data-pro])').forEach(procLev);
    };
    new MutationObserver(function(){ if(!pending){ pending=true; requestAnimationFrame(scan); } }).observe(document.body,{childList:true,subtree:true});
  })();

  /* ⑧ CNN 7개 세부지표 — 수치를 막대 바로 아래(마커 위치)에 표시 */
  (function(){
    var tb=document.getElementById('us-sub'); if(!tb) return;
    var busy=false, run=function(){
      if(busy) return; busy=true;
      tb.querySelectorAll('tr').forEach(function(tr){
        var bc=tr.querySelector('.sub-bar'), nb=tr.querySelector('td.num b'); if(!bc||!nb) return;
        var mk=bc.querySelector('i'), x=parseFloat((mk&&mk.style.left)||'50');
        var lab=bc.parentNode.querySelector('.sb-val'); if(!lab){ lab=document.createElement('span'); lab.className='sb-val'; bc.parentNode.appendChild(lab); }
        lab.textContent=nb.textContent; lab.style.left=Math.max(9,Math.min(91,isFinite(x)?x:50))+'%';
        tr.classList.add('sb-done');
      });
      busy=false;
    };
    new MutationObserver(function(){ if(!busy) run(); }).observe(tb,{childList:true});
    run();
  })();

  /* ⑨ 모바일 전용 접기/펼치기 (CSS가 700px 이하에서만 본문을 숨김) */
  (function(){
    function mf(card,key){
      if(!card||card.dataset.mf) return; var h=card.querySelector('h3'); if(!h) return;
      card.dataset.mf='1'; card.classList.add('m-fold');
      var b=document.createElement('button'); b.type='button'; b.className='m-fold-btn'; b.innerHTML='<em>펼치기</em> ➕';
      h.appendChild(b);
      var sk='mk_m_'+(card.id||key||'x'); var setO=function(o){ card.classList.toggle('m-open',o); b.innerHTML=o?'<em>접기</em> ➖':'<em>펼치기</em> ➕'; try{ localStorage.setItem(sk,o?'1':'0'); }catch(e){} };
      try{ if(localStorage.getItem(sk)==='1') setO(true); }catch(e){}
      var tg=function(){ setO(!card.classList.contains('m-open')); };
      h.addEventListener('click',function(e){ if(e.target.closest('a')) return; tg(); });
    }
    var cnn=document.getElementById('us-sub'); if(cnn){ var cc=cnn.closest('.card'); if(cc&&!cc.id) cc.id='pro-cnn'; mf(cc); }
    mf(document.getElementById('pro-int')); mf(document.getElementById('pro-fwd'));
  })();

  /* ⑩-b 데이터 상태 띠 + 정적 카드 + 로딩 정체 감시 */
  (function(){
    MKT.set('pro-fwd','static'); var fm=document.getElementById('pro-fwd'); if(fm){ var l=fm.querySelector('.src-line'); if(l) l.innerHTML='<span>ⓘ '+MKT.meta['pro-fwd']+' · 기준일 '+FWD.range[1]+'</span>'; }
    if(!hd) return;
    var st=document.createElement('div'); st.id='pro-status';
    st.innerHTML='<span class="ps-mk" id="ps-mk"></span><span class="ps-net" id="ps-net"></span><span class="ps-t" id="ps-t"></span><span class="ps-n">무료 공개 시세(Yahoo Finance·TradingView·CNN) 기반 · 지연·오류 가능 · 투자 판단 참고용</span><button type="button" id="ps-rf" title="새로고침" aria-label="새로고침">↻</button>';
    hd.after(st);
    document.getElementById('ps-rf').onclick=function(){ location.reload(); };
    var dtf=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',weekday:'short',hour:'numeric',minute:'numeric',hour12:false});
    var mkt=function(){ var p={}; dtf.formatToParts(new Date()).forEach(function(x){p[x.type]=x.value;}); var m=(parseInt(p.hour,10)%24)*60+parseInt(p.minute,10), wd=p.weekday;
      if(wd==='Sat'||wd==='Sun') return ['휴장(주말)','c'];
      if(m>=570&&m<960) return ['정규장 진행 중','o']; if(m>=240&&m<570) return ['프리마켓','p']; if(m>=960&&m<1200) return ['애프터마켓','p']; return ['장 마감','c']; };
    var upd=function(){
      var a=mkt(), mk=document.getElementById('ps-mk'); mk.className='ps-mk '+a[1]; mk.textContent='미국장 '+a[0]; mk.title='뉴욕시간 기준 자동 계산 · 공휴일 휴장은 반영되지 않습니다(휴장일에는 직전 종가가 표시됩니다).';
      var N=window.MK_NET||{log:[],lastOk:0}, lg=N.log.slice(-20), fails=lg.filter(function(x){return !x;}).length, ratio=lg.length?fails/lg.length:0, age=N.lastOk?(Date.now()-N.lastOk)/1000:null;
      var cls,txt;
      if(!lg.length){ cls='w'; txt='데이터 확인 중'; }
      else if(age!=null&&age>600){ cls='r'; txt='갱신 지연 ('+Math.round(age/60)+'분 전 마지막 성공)'; }
      else if(ratio<=.15){ cls='g'; txt='데이터 정상'; }
      else if(ratio<=.5){ cls='w'; txt='일부 데이터 지연'; }
      else { cls='r'; txt='데이터 연결 불안정'; }
      var n=document.getElementById('ps-net'); n.className='ps-net '+cls; if(n.textContent!=='● '+txt) n.textContent='● '+txt;
      var pt=document.getElementById('ps-t'); pt.className='ps-t'+(age!=null&&age>600?' r':age!=null&&age>300?' w':''); pt.title=age!=null&&age>300?'마지막으로 데이터를 받은 지 '+Math.round(age/60)+'분이 지났습니다. 새로고침(↻)을 눌러 보세요.':'';
      pt.innerHTML=N.lastOk?'<span class="lbl">마지막 갱신 </span>'+hhmm(new Date(N.lastOk))+':'+pad2z(new Date(N.lastOk).getSeconds()):'';
    };
    upd(); setInterval(upd,5000);
    /* 공포탐욕지수 카드: 14초가 지나도 값이 없으면 실패 안내 + 다시 시도 */
    setInterval(function(){
      var v=document.getElementById('us-val'), n=v?parseFloat((v.textContent||'').replace(/[^\d.]/g,'')):NaN, f=document.getElementById('fg-fail'), card=document.getElementById('us-card');
      if(isFinite(n)){ if(f) f.remove(); return; }
      if(!card||f||performance.now()<14000) return;
      f=document.createElement('p'); f.id='fg-fail'; f.className='net-fail'; f.setAttribute('role','alert');
      f.innerHTML='⚠ 공포탐욕지수를 불러오지 못했습니다 (CNN 응답 지연·차단 가능) <button type="button" class="net-retry">다시 시도</button>';
      var b=f.querySelector('button'); b.onclick=function(){ b.disabled=true; b.textContent='불러오는 중…'; try{ if(typeof loadUS==='function') loadUS(); else location.reload(); }catch(e){ location.reload(); } setTimeout(function(){ b.disabled=false; b.textContent='다시 시도'; },6000); };
      var src=card.querySelector('.fg-src'); if(src) src.after(f); else card.appendChild(f);
    },4000);
    /* "불러오는 중…"이 오래 남은 곳은 실패 안내 + 재시도 버튼으로 교체 */
    var watch=function(){
      document.querySelectorAll('.mut,.pi-note').forEach(function(e){
        if((e.textContent||'').trim()!=='불러오는 중…'||e.dataset.wd||e.closest('[data-lazy="1"]')) return; e.dataset.wd='1';
        e.innerHTML='⚠ 데이터를 불러오지 못했습니다 (제공처 지연·차단 가능) <button type="button" class="net-retry">다시 시도</button>';
        e.querySelector('button').onclick=function(){ location.reload(); }; e.classList.add('net-fail'); });
    };
    setTimeout(watch,30000); setTimeout(watch,75000);
  })();

  /* ⑪ 기획·UX: 한 줄 요약 · 목차 · 맨 위로 · 용어 툴팁 */
  (function(){
    var wrap=document.querySelector('#stock > .wrap'); if(!wrap) return;
    var txt=function(id){ var e=document.getElementById(id); return e?(e.textContent||'').trim():''; };
    /* 한 줄 요약 */
    var br=document.createElement('div'); br.id='pro-brief'; br.setAttribute('aria-label','오늘의 시장 요약');
    br.innerHTML='<div class="pb-hd"><b>오늘의 시장 요약</b><span class="pb-sub">핵심 4가지를 한눈에 · 각 칸을 누르면 상세로 이동</span></div><p class="pb-line" id="pb-line">시장 상태를 불러오는 중…</p><div class="pb-grid">'+
      '<a class="pb-c" href="#pro-kc" data-go="kc"><small>공포탐욕</small><b id="pb-fg">--</b><span id="pb-fg2"></span></a>'+
      '<a class="pb-c" href="#pro-int" data-go="int"><small>변동성(VIX)</small><b id="pb-vx">--</b><span id="pb-vx2"></span></a>'+
      '<a class="pb-c" href="#pro-cal" data-go="cal"><small>다음 주요 일정</small><b id="pb-ev">--</b><span id="pb-ev2"></span></a>'+
      '<a class="pb-c" href="#pro-sector" data-go="sec"><small>섹터 강세 · 약세</small><b id="pb-sc">--</b><span id="pb-sc2"></span></a></div></div><div id="pb-fut" hidden></div>';
    var stl=document.createElement('div'); stl.id='pb-state'; stl.setAttribute('role','status'); br.querySelector('.pb-hd').after(stl);
    var lead=wrap.querySelector('.pg-lead'); if(lead) lead.after(br); else wrap.prepend(br);
    var ZC=['#C42318','#B54708','#475467','#3F7D20','#0B6B3A'];
    var num=function(t){ var m=(t||'').match(/-?[\d.]+/); return m?parseFloat(m[0]):NaN; };

    /* ⑰ 장 마감 후 선물(S&P500·나스닥100·다우) — 정규장 종료 후/개장 전에만 시장 요약에 표시.
       기준: 직전 정규장 마감(미 동부 16:00) 시점의 선물 가격 대비 현재 선물 등락 + 마감 이후 15분봉 흐름 */
    var FUT=[['ES=F','S&P500 선물'],['NQ=F','나스닥100 선물'],['YM=F','다우 선물']];
    var nyp=function(ms){ try{ var f=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',hour12:false,weekday:'short',hour:'2-digit',minute:'2-digit'}).formatToParts(new Date(ms)), o={}; f.forEach(function(p){o[p.type]=p.value;}); return {w:o.weekday,h:(+o.hour)%24,m:+o.minute}; }catch(e){ return null; } };
    var usOpen=function(){ var n=nyp(Date.now()); if(!n) return false; if(n.w==='Sat'||n.w==='Sun') return false; var t=n.h*60+n.m; return t>=570&&t<960; };
    var futOne=async function(sym){
      try{
        var j=await getJSON('https://query1.finance.yahoo.com/v8/finance/chart/'+encodeURIComponent(sym)+'?range=5d&interval=15m');
        var r=j.chart.result[0], ts=r.timestamp||[], cl=r.indicators.quote[0].close||[], last=r.meta&&r.meta.regularMarketPrice;
        var ref=-1; for(var i=ts.length-1;i>=0;i--){ if(cl[i]==null) continue; var n=nyp(ts[i]*1000); if(n&&n.h===15&&n.m===45&&n.w!=='Sat'&&n.w!=='Sun'){ ref=i; break; } }
        if(ref<0||last==null) return null;
        var pts=[]; for(var k=ref;k<ts.length;k++) if(cl[k]!=null) pts.push(cl[k]);
        pts.push(last);
        return {p:last, ref:cl[ref], pct:(last/cl[ref]-1)*100, pts:pts};
      }catch(e){ return null; }
    };
    var futSpark=function(pts,col){
      if(pts.length<3) return ''; var W=70,H=34,mn=Math.min.apply(null,pts),mx=Math.max.apply(null,pts),rg=(mx-mn)||1;
      var d=pts.map(function(v,i){ return (i/(pts.length-1)*W).toFixed(1)+','+(H-2-(v-mn)/rg*(H-4)).toFixed(1); }).join(' ');
      return '<svg class="pf-sp" viewBox="0 0 '+W+' '+H+'" width="'+W+'" height="'+H+'" role="img" aria-label="정규장 마감 이후 선물 흐름"><polyline points="'+d+'" fill="none" stroke="'+col+'" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    };
    var futBusy=false, futT=0;
    var fillFut=async function(){
      var box=document.getElementById('pb-fut'); if(!box||futBusy) return;
      var open=usOpen();
      if(Date.now()-futT<55000&&!box.hidden&&box._open===open) return;
      futBusy=true;
      try{
        if(open){
          var SP=[['^GSPC','S&P500'],['^IXIC','나스닥 종합'],['^DJI','다우존스']];
          var rs=await Promise.all(SP.map(async function(f){ try{
            var j=await getJSON('https://query1.finance.yahoo.com/v8/finance/chart/'+encodeURIComponent(f[0])+'?range=1d&interval=5m');
            var r=j.chart.result[0], cl=(r.indicators.quote[0].close||[]).filter(function(x){return x!=null;}), p=r.meta.regularMarketPrice, pv=r.meta.chartPreviousClose;
            if(p==null||!pv) return null; return {p:p,pct:(p/pv-1)*100,pts:cl.concat([p])}; }catch(e){ return null; } }));
          if(!rs.some(Boolean)){ box.hidden=true; return; }
          var fm0=function(v){ return v.toLocaleString('en-US',{maximumFractionDigits:2}); };
          box.innerHTML='<div class="pf-hd"><b>📈 정규장 진행 중 · 미국 3대 지수</b><span>전일 종가 대비 · 장중 5분 흐름</span></div><div class="pf-grid">'+
            SP.map(function(f,i){ var d=rs[i]; if(!d) return '<div class="pf-c"><small>'+f[1]+'</small><b>--</b></div>'; var up=d.pct>=0, col=up?UP:DN;
              return '<div class="pf-c"><div class="pf-t"><small>'+f[1]+'</small><b>'+fm0(d.p)+'</b><span style="color:'+col+'">'+(up?'▲ +':'▼ ')+d.pct.toFixed(2)+'%</span></div>'+futSpark(d.pts,col)+'</div>'; }).join('')+
            '</div><p class="pf-note">장중 시세는 약 15분 지연될 수 있습니다. 출처: Yahoo Finance</p>';
          box.hidden=false; box._open=true; futT=Date.now(); window.__futLine=null;
          var s1=rs[0]; if(s1) window.__spotLine='S&amp;P500 <em>'+(s1.pct>=0?'+':'')+s1.pct.toFixed(2)+'%</em>';
          return;
        }
        window.__spotLine=null; box._open=false;
        var res=await Promise.all(FUT.map(function(f){ return futOne(f[0]); })), ok=res.filter(Boolean);
        if(!ok.length){ box.hidden=true; return; }
        var fm=function(v){ return v.toLocaleString('en-US',{maximumFractionDigits:2}); };
        var n=nyp(Date.now()), wk=n&&(n.w==='Sat'||n.w==='Sun');
        box.innerHTML='<div class="pf-hd"><b>🌙 '+(wk?'주말':'정규장 마감 후')+' 선물 흐름</b><span>정규장 마감(미 동부 16:00) 대비 · 다음 개장 방향 참고용</span></div><div class="pf-grid">'+
          FUT.map(function(f,i){ var d=res[i]; if(!d) return '<div class="pf-c"><small>'+f[1]+'</small><b>--</b></div>';
            var up=d.pct>=0, col=up?UP:DN;
            return '<div class="pf-c"><div class="pf-t"><small>'+f[1]+'</small><b>'+fm(d.p)+'</b><span style="color:'+col+'">'+(up?'▲ +':'▼ ')+d.pct.toFixed(2)+'%</span></div>'+futSpark(d.pts,col)+'</div>'; }).join('')+
          '</div><p class="pf-note">선물은 거의 24시간 거래되며 결제월 차이로 현물 지수와 가격이 다를 수 있어 등락률만 참고하세요. 출처: Yahoo Finance</p>';
        box.hidden=false; box._open=false; futT=Date.now();
        var pl=document.getElementById('pb-line');
        if(pl&&ok.length){ var s0=res[0]||ok[0]; window.__futLine=' · 선물 <em>S&amp;P '+(s0.pct>=0?'+':'')+s0.pct.toFixed(2)+'%</em>'; }
      }finally{ futBusy=false; }
    };
    window.__fillFut=fillFut;
    var fillBrief=function(){
      (function(){ var e=document.getElementById('pb-state'); if(!e) return; var n=nyp(Date.now()), wk=n&&(n.w==='Sat'||n.w==='Sun'), op=usOpen(), tm=hhmm();
        var h=op?'<i class="ps-d on"></i>🟢 정규장 진행 중 · 실시간 시세(약 15분 지연 가능)':wk?'<i class="ps-d"></i>🌙 주말 휴장 · 직전 금요일 종가 기준':'<i class="ps-d"></i>🌙 정규장 마감 · 종가 기준 · 선물은 아래 카드';
        h+='<span class="ps-t">확인 '+tm+'</span>'; if(e._h!==h){ e._h=h; e.innerHTML=h; } })();
      var v=num(txt('us-val'));
      if(isFinite(v)){ var z=v<25?0:v<45?1:v<=55?2:v<=75?3:4, ZN=['극단적 공포','공포','중립','탐욕','극단적 탐욕'], AC=['매수 시작 구간','매수 시작 구간','관망','매수 금지 구간','매수 금지 구간'];
        var b=document.getElementById('pb-fg'); b.textContent=Math.round(v)+' · '+ZN[z]; b.style.color=ZC[z]; b.parentNode.dataset.z=z; document.getElementById('pb-fg2').textContent='김군코멘트: '+AC[z]; }
      var vt=document.getElementById('pt-4'), vb=vt?vt.querySelector('b').textContent:'--', bd=txt('vts-badge');
      if(vb&&vb!=='--'){ document.getElementById('pb-vx').textContent=vb; document.getElementById('pb-vx2').textContent=bd&&bd!=='--'?'기간구조 '+bd:''; }
      var al=document.querySelector('#cal-top .cal-alert');
      if(al){ var t=al.querySelector('b'), w=al.querySelector('.ca-when'), c=al.querySelector('em'); document.getElementById('pb-ev').textContent=(t?t.firstChild.textContent:'').trim()||'--'; document.getElementById('pb-ev2').textContent=((c?c.textContent:'')+' · '+(w?w.textContent:'')).replace(/^ · /,''); }
      else if(document.getElementById('cal-body')&&document.querySelector('#cal-body .cal-row, #cal-body tr')){ document.getElementById('pb-ev').textContent='예정된 최상 일정 없음'; document.getElementById('pb-ev2').textContent=''; }
      var arr=[]; document.querySelectorAll('#shm a').forEach(function(a){ var em=a.querySelector('em'), sp=a.querySelector('span'); if(!em||!sp) return; var p=num(em.textContent.replace(/▼\s*/,'-').replace(/▲\s*/,'')); if(isFinite(p)) arr.push([sp.firstChild?sp.firstChild.textContent.trim():'',p]); });
      if(arr.length>3){ arr.sort(function(x,y){return y[1]-x[1];}); var h=arr[0], l=arr[arr.length-1], f=function(x){ return (x[1]>=0?'+':'')+x[1].toFixed(2)+'%'; };
        document.getElementById('pb-sc').innerHTML='<span style="color:'+UP+'">▲ '+h[0]+' '+f(h)+'</span>'; document.getElementById('pb-sc2').innerHTML='<span style="color:'+DN+'">▼ '+l[0]+' '+f(l)+'</span>'; }
      var pl=document.getElementById('pb-line'); if(pl){ var P=[], fv=num(txt('us-val')), vv=num(vb);
        if(isFinite(fv)){ var zz=fv<25?'극단적 공포':fv<45?'공포':fv<=55?'중립':fv<=75?'탐욕':'극단적 탐욕'; P.push('공포탐욕 '+Math.round(fv)+' <em>'+zz+'</em>'); }
        if(isFinite(vv)){ var vl=vv<15?'낮음':vv<20?'보통':vv<30?'높음':'매우 높음'; P.push('변동성 <em>'+vl+'</em> (VIX '+vv.toFixed(1)+')'); }
        var ev=(document.getElementById('pb-ev')||{}).textContent; if(ev&&ev!=='--'&&ev.indexOf('없음')<0){ var w=(document.getElementById('pb-ev2')||{}).textContent||''; var dm=w.match(/D[-+]?\d+/); P.push('다음 일정 <em>'+ev+(dm?' '+dm[0]:'')+'</em>'); }
        if(usOpen()){ if(window.__spotLine&&P.length) P.push('장중 '+window.__spotLine); } else if(window.__futLine&&P.length) P.push(window.__futLine.replace(/^ · /,'')); var nh=P.length?'오늘의 시장 상태: '+P.join(' · ')+' <span class="pb-note">· 참고용 요약이며 투자 권유가 아닙니다</span>':'시장 상태를 불러오는 중…';
        if(pl._h!==nh){ pl._h=nh; pl.innerHTML=nh; } }
    };
    fillBrief(); fillFut(); setInterval(fillFut,60000); setInterval(fillBrief,4000); [2500,6000,12000].forEach(function(t){ setTimeout(fillBrief,t); });
    var openAndGo=function(el){ if(!el) return; var h=el.closest&&el.closest('.fold-body'); if(h&&h.style.display==='none'){ var hh=h.previousElementSibling; if(hh&&hh._set) hh._set(true); } var mc=el.closest&&el.closest('.m-fold'); if(mc&&!mc.classList.contains('m-open')){ var bt=mc.querySelector('.m-fold-btn'); if(bt&&getComputedStyle(bt).display!=='none') bt.click(); } setTimeout(function(){ var off=(document.querySelector('header')?document.querySelector('header').offsetHeight:0)+44; var y=el.getBoundingClientRect().top+window.scrollY-off; window.scrollTo({top:y,behavior:'smooth'}); },60); };
    br.addEventListener('click',function(e){ var a=e.target.closest('a.pb-c'); if(!a) return; e.preventDefault(); openAndGo(document.querySelector(a.getAttribute('href'))); });
    /* 목차 */
    var toc=document.createElement('nav'); toc.id='pro-toc'; toc.setAttribute('aria-label','페이지 목차');
    var ITEMS=[['요약','#pro-brief'],['공탐','#us-card'],['섹터','#pro-sector'],['내부지표','#pro-int'],['일정','#pro-cal'],['지수비교','h:주요 지수 ETF'],['관심종목','h:김군 관심종목'],['시총 TOP10','h:시가총액'],['레버리지','h:레버리지'],['소셜','h:소셜 언급'],['유니콘','h:유니콘'],['이벤트','h:주요 이벤트'],['편입·편출','h:지수 편입']];
    toc.innerHTML=ITEMS.map(function(it,i){ return '<a href="#" data-i="'+i+'">'+it[0]+'</a>'; }).join('');
    var hd2=document.querySelector('header'), st2=document.getElementById('pro-status'); (st2||hd2).after(toc);
    var place=function(){ toc.style.top=(hd2?hd2.offsetHeight:0)+'px'; }; place(); window.addEventListener('resize',place); setTimeout(place,1500);
    toc.addEventListener('click',function(e){ var a=e.target.closest('a'); if(!a) return; e.preventDefault(); var t=ITEMS[+a.dataset.i][1], el;
      if(t.indexOf('h:')===0){ var k=t.slice(2); el=[].slice.call(document.querySelectorAll('h2.fold-h,#stock > .wrap > h2')).find(function(h){ return (h.textContent||'').replace(/\s+/g,' ').trim().indexOf(k)===0; }); if(el&&el._set) el._set(true); }
      else el=document.querySelector(t);
      if(el) openAndGo(el); });
    /* 맨 위로 */
    var up=document.createElement('button'); up.id='pro-top'; up.type='button'; up.setAttribute('aria-label','맨 위로'); up.textContent='↑ 맨 위로';
    up.onclick=function(){ window.scrollTo({top:0,behavior:'smooth'}); }; document.body.appendChild(up);
    window.addEventListener('scroll',function(){ up.classList.toggle('on',window.scrollY>700); },{passive:true});
    /* 용어 툴팁 */
    var GL=[['콘탱고','선물 만기가 길수록 가격(VIX)이 높은 평시 구조입니다.'],['백워데이션','단기 가격이 장기보다 높은 역전 구조로, 단기 불안이 크다는 신호입니다.'],
      ['PSR','주가매출비율 = 시가총액 ÷ 매출. 낮을수록 매출 대비 저렴하다고 봅니다.'],['PEG','PER ÷ 이익성장률. 1 미만이면 성장 대비 저평가로 보는 경향이 있습니다.'],
      ['ROA','총자산이익률. 가진 자산으로 이익을 얼마나 효율적으로 내는지 봅니다.'],['ROE','자기자본이익률. 주주 자본 대비 이익이며, 부채가 많으면 부풀려질 수 있습니다.'],
      ['RSI','상대강도지수(14일). 30 이하 과매도, 70 이상 과열로 해석합니다.'],['EPS','주당순이익. 순이익 ÷ 발행주식 수입니다.'],['PER','주가수익비율 = 주가 ÷ 주당순이익. 높을수록 이익 대비 비싸다고 봅니다.'],
      ['VIX','S&P500 옵션으로 계산한 향후 30일 기대 변동성. 흔히 공포지수라 부릅니다.'],['풋/콜','풋옵션은 하락, 콜옵션은 상승에 거는 계약입니다. 풋이 많으면 공포 쪽입니다.'],['정크본드','신용등급이 낮아 금리가 높은 위험 채권입니다.']];
    var ROOTS='#pro-int,#pro-fwd,#us-sub-note,#pro-sector,[id^="finx"],.lev-inv';
    var SKIP={A:1,BUTTON:1,SUMMARY:1,H3:1,ABBR:1,SCRIPT:1,STYLE:1,INPUT:1,TEXTAREA:1,SVG:1,TEXT:1};
    var gloss=function(){
      document.querySelectorAll(ROOTS).forEach(function(root){
        if(root.offsetParent===null&&root.style.display==='none') return;
        GL.forEach(function(g){
          if(root.querySelector('abbr.gl[data-k="'+g[0]+'"]')) return;
          var re=new RegExp('(^|[^A-Za-z가-힣])('+g[0].replace('/','\\/')+')(?![A-Za-z가-힣])');
          var w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,null), n;
          while((n=w.nextNode())){ var p=n.parentNode; if(!p||SKIP[p.tagName.toUpperCase()]||p.closest('a,button,summary,h3,abbr,svg')) continue; var m=re.exec(n.nodeValue); if(!m) continue;
            var i=m.index+m[1].length, r=n.splitText(i); r.splitText(g[0].length); var ab=document.createElement('abbr'); ab.className='gl'; ab.tabIndex=0; ab.dataset.k=g[0]; ab.dataset.tip=g[1]; ab.textContent=r.nodeValue; r.parentNode.replaceChild(ab,r); break; }
        });
      });
    };
    setTimeout(gloss,5000); setInterval(gloss,6000);
  })();

  /* ⑫ 내 관심종목 — 티커를 직접 추가·삭제(이 브라우저의 localStorage에만 저장) */
  (function(){
    var tbl=document.getElementById('tick-tbl'); if(!tbl||typeof TICKGROUPS==='undefined') return;
    var anchor=tbl.closest('.scroll')||tbl, KEY='mk_my_tickers', MAX=20, RE=/^[A-Z0-9.^=\-]{1,15}$/;
    var load=function(){ try{ var a=JSON.parse(localStorage.getItem(KEY)||'[]'); return Array.isArray(a)?a.filter(function(t){return RE.test(t);}).slice(0,MAX):[]; }catch(e){ return []; } };
    var save=function(a){ try{ localStorage.setItem(KEY,JSON.stringify(a)); }catch(e){} };
    var list=load(); TICKGROUPS.my={table:'my-tbl',list:list};
    var box=document.createElement('div'); box.className='card'; box.id='my-wl'; box.style.marginTop='16px';
    box.innerHTML='<h3><span>⭐ 내 관심종목</span><span class="mut" style="font-weight:400;font-size:11px">이 브라우저에만 저장 · 최대 '+MAX+'개</span></h3>'+
      '<form class="my-add" autocomplete="off"><input type="text" maxlength="15" placeholder="티커 입력 (예: AAPL · NVDA · BRK-B · 005930.KS)" aria-label="추가할 종목 티커"><button type="submit">＋ 추가</button></form>'+
      '<div class="my-msg" role="status"></div><div class="wl-list" id="my-tbl" style="margin-top:8px"></div>';
    var briefEl=document.getElementById('pro-brief'); box.style.marginTop='12px'; if(briefEl) briefEl.after(box); else anchor.after(box);
    var msg=box.querySelector('.my-msg'), inp=box.querySelector('input'), host=box.querySelector('#my-tbl');
    var say=function(t,bad){ msg.textContent=t||''; msg.className='my-msg'+(bad?' bad':''); };
    var rowHtml=function(t){
      var q=encodeURIComponent('$'+t+' from:trendspider');
      return '<div class="wl-row" data-t="'+t+'"><div class="wl-bar"></div><div class="wl-info"><div class="wl-tag">내 관심종목</div><div class="wl-name"><a href="https://finviz.com/quote.ashx?t='+t+'" target="_blank" rel="noopener">'+t+'</a></div></div><div class="wl-spark"></div><div class="wl-quote"><div class="px wl-price">--</div><div class="ch wl-pct">--</div><div class="wl-52w"></div></div>'+
        '<div class="wl-actions"><a href="https://finviz.com/quote.ashx?t='+t+'" target="_blank" rel="noopener" title="Finviz에서 '+t+' 상세 지표 보기">+</a><a href="https://x.com/search?q='+q+'&f=live" target="_blank" rel="noopener" class="ts-link" title="X 검색">X</a><a href="https://finance.yahoo.com/quote/'+t+'/news/" target="_blank" rel="noopener" class="news-link" title="최신 뉴스">N</a>'+
        '<button type="button" class="fin-btn" onclick="toggleUsFinancials(\''+t+'\',\'finmy-\')" title="재무비율·주가지표(Yahoo Finance)">재무</button><button type="button" class="my-del" data-t="'+t+'" title="목록에서 삭제" aria-label="'+t+' 삭제">✕</button></div></div>'+
        '<div id="finmy-'+t+'" style="display:none;padding:14px 16px;border-bottom:1px solid var(--line);background:var(--panel2)"></div>';
    };
    var paint=function(){
      TICKGROUPS.my.list=list;
      host.innerHTML=list.length?list.map(rowHtml).join(''):'<div class="my-empty">아직 추가한 종목이 없습니다. 위 입력칸에 티커를 입력하거나, <button type="button" class="my-ex">예시 5종목 한 번에 추가</button> (NVDA · AAPL · MSFT · TSLA · QQQ)</div>';
      host.classList.toggle('my-fold',list.length>5&&!host.classList.contains('my-all')); var mb=box.querySelector('.my-more'); if(mb) mb.style.display=list.length>5?'':'none';
      if(list.length) renderTick('my',(typeof curPer!=='undefined'&&curPer.tick)||'d');
    };
    var fetchAll=async function(){ await Promise.all(list.map(async function(t){ var d=await yclose(t,'1y'); if(d) tickData[t]=d; })); paint(); };
    box.querySelector('form').addEventListener('submit',async function(e){
      e.preventDefault(); var t=(inp.value||'').trim().toUpperCase();
      if(!t) return; if(!RE.test(t)){ say('티커 형식이 올바르지 않습니다. 영문·숫자 위주로 입력해 주세요.',1); return; }
      if(list.indexOf(t)>=0){ say(t+' 는 이미 목록에 있습니다.',1); return; }
      if(list.length>=MAX){ say('최대 '+MAX+'개까지 추가할 수 있습니다.',1); return; }
      say(t+' 시세 확인 중…'); var d=await yclose(t,'1y');
      if(!d){ say('"'+t+'" 시세를 찾지 못했습니다. 티커를 확인해 주세요(한국 종목은 005930.KS, 코스닥은 .KQ).',1); return; }
      tickData[t]=d; list.push(t); save(list); inp.value=''; say(t+' 추가 완료'); paint();
    });
    var more=document.createElement('button'); more.type='button'; more.className='my-more'; more.style.display='none'; more.textContent='전체 보기 ▾'; more.setAttribute('aria-expanded','false');
    more.onclick=function(){ var o=host.classList.toggle('my-all'); more.textContent=o?'접기 ▴':'전체 보기 ▾'; more.setAttribute('aria-expanded',o?'true':'false'); paint(); };
    host.after(more);
    var addMany=async function(arr){ say('시세 확인 중…'); for(var i=0;i<arr.length;i++){ var t=arr[i]; if(list.indexOf(t)>=0||list.length>=MAX) continue; var d=await yclose(t,'1y'); if(d){ tickData[t]=d; list.push(t); } } save(list); say('추가 완료 · '+list.length+'개'); paint(); };
    window.MK_MY_ADD=function(t){ t=String(t||'').trim().toUpperCase(); if(!RE.test(t)) return Promise.resolve(false); if(list.indexOf(t)>=0) return Promise.resolve(true); return addMany([t]).then(function(){ return list.indexOf(t)>=0; }); };
    host.addEventListener('click',function(e){ if(e.target.closest('.my-ex')){ addMany(['NVDA','AAPL','MSFT','TSLA','QQQ']); return; } });
    host.addEventListener('click',function(e){ var a=e.target.closest('.my-del'); if(!a) return; var t=a.dataset.t; list.splice(list.indexOf(t),1); save(list); say(t+' 삭제'); paint(); });
    document.addEventListener('click',function(e){ if(e.target.closest('.tabs[data-group="tick"] button')) setTimeout(function(){ if(list.length) renderTick('my',curPer.tick); },0); });
    paint(); if(list.length) fetchAll(); setInterval(function(){ if(list.length) fetchAll(); },300000);
  })();

  /* ⑬ 접근성 보정: 키보드·스크린리더용 속성을 동적 생성 요소에도 자동 부여 */
  (function(){
    var KEY={Enter:1,' ':1};
    var fix=function(){
      document.querySelectorAll('a[href^="javascript:"]:not([data-a11y])').forEach(function(a){ a.dataset.a11y='1'; a.setAttribute('role','button'); if(!a.hasAttribute('tabindex')) a.tabIndex=0; if(!a.getAttribute('aria-label')) a.setAttribute('aria-label',(a.getAttribute('title')||a.textContent||'').trim()||'버튼');
        a.addEventListener('keydown',function(e){ if(KEY[e.key]){ e.preventDefault(); a.click(); } }); });
      document.querySelectorAll('.wl-actions a:not([data-a11y])').forEach(function(a){ a.dataset.a11y='1'; if(!a.getAttribute('aria-label')){ var t=a.getAttribute('title'); if(t) a.setAttribute('aria-label',t); } });
      document.querySelectorAll('table:not([data-a11y])').forEach(function(t){ t.dataset.a11y='1';
        t.querySelectorAll('thead th:not([scope])').forEach(function(th){ th.setAttribute('scope','col'); });
        if(!t.querySelector('caption')&&!t.getAttribute('aria-label')){ var sec=t.closest('.card,section,.fold-body'); var hd=sec&&(sec.querySelector('h3')||(sec.previousElementSibling&&sec.previousElementSibling.matches('h2')?sec.previousElementSibling:null)||sec.querySelector('h2')); if(hd){ var tx=(hd.querySelector&&hd.querySelector('.fold-t')?hd.querySelector('.fold-t').textContent:hd.textContent).replace(/\s+/g,' ').trim(); if(tx) t.setAttribute('aria-label',tx+' 표'); } } });
      document.querySelectorAll('.wl-spark svg:not([aria-hidden])').forEach(function(sv){ sv.setAttribute('aria-hidden','true'); sv.setAttribute('focusable','false'); });
      document.querySelectorAll('img:not([alt])').forEach(function(im){ im.setAttribute('alt',''); });
      document.querySelectorAll('.tabs button,.seg button,.hm-t button').forEach(function(b){ b.setAttribute('aria-pressed',b.classList.contains('on')?'true':'false'); });
    };
    var timer=null, sched=function(){ if(timer) return; timer=setTimeout(function(){ timer=null; fix(); },350); };
    fix(); new MutationObserver(sched).observe(document.body,{childList:true,subtree:true});
    document.addEventListener('click',function(e){ if(e.target.closest('.tabs,.seg,.hm-t')) setTimeout(fix,60); });
    /* 상태 띠는 상태가 바뀔 때만 스크린리더에 알린다 */
    var pn=document.getElementById('ps-net'); if(pn){ pn.setAttribute('role','status'); pn.setAttribute('aria-live','polite'); }
    var ps=document.getElementById('pro-status'); if(ps){ ps.setAttribute('role','region'); ps.setAttribute('aria-label','데이터 상태'); }
    var tk=document.getElementById('pro-tick'); if(tk){ tk.setAttribute('role','region'); tk.setAttribute('aria-label','주요 시세 띠'); tk.tabIndex=0; }
  })();
})();
