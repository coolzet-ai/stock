/* Mr.Kim Signal — 전문 도구형 보강 (티커 띠 · 선형 구간 스케일 · 섹터 히트맵) · body.pro 전용 */
(function(){
  if(!document.body || !document.body.classList.contains('pro')) return;
  var UP='#D92D20', DN='#1D4ED8';

  /* 현재 페이지 메뉴 강조 */
  try{
    var file=(location.pathname.split('/').pop()||'index.html');
    document.querySelectorAll('#nav-menu a').forEach(function(a){ if((a.getAttribute('href')||'')===file) a.classList.add('on-page'); });
  }catch(e){}

  /* 공통 시세 조회 (Worker 프록시 경유 · mrkim-common.js 의 getJSON 재사용) */
  async function quote(sym){
    try{
      var j=await getJSON('https://query1.finance.yahoo.com/v8/finance/chart/'+encodeURIComponent(sym)+'?range=5d&interval=1d');
      var r=j.chart.result[0], c=r.indicators.quote[0].close.filter(function(x){return x!=null;});
      var p=(r.meta&&r.meta.regularMarketPrice!=null)?r.meta.regularMarketPrice:c[c.length-1];
      var prev=c.length>=2?c[c.length-2]:null;
      if(prev==null||!isFinite(p)) return null;
      return {p:p, prev:prev, pct:(p/prev-1)*100, diff:p-prev};
    }catch(e){ return null; }
  }
  function fmt(v,d){ return v.toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d}); }

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
    sc.innerHTML='<div class="bar"><i style="width:25%;background:#C2362B"></i><i style="width:20%;background:#E58A3A"></i><i style="width:11%;background:#C9CED4"></i><i style="width:20%;background:#5DA86B"></i><i style="width:24%;background:#1F7A4D"></i><span class="mk" id="pro-mk" style="left:0"></span></div>'+
      '<div class="tk"><span>0</span><span>25</span><span>45</span><span>55</span><span>75</span><span>100</span></div>'+
      '<div class="lb"><span>극단적 공포</span><span>공포</span><span>중립</span><span>탐욕</span><span>극단적 탐욕</span></div>';
    fgtop.after(sc);
    var upd=function(){ var v=document.getElementById('us-val'); if(!v) return; var n=parseFloat((v.textContent||'').replace(/[^\d.]/g,'')); var mk=document.getElementById('pro-mk'); if(mk&&isFinite(n)) mk.style.left=Math.max(0,Math.min(100,n))+'%'; };
    var vv=document.getElementById('us-val'); if(vv){ new MutationObserver(upd).observe(vv,{childList:true,characterData:true,subtree:true}); }
    upd(); setInterval(upd,3000);
  }

  /* ③ 섹터 히트맵 (11개 GICS 섹터 ETF) */
  var SEC=[['XLK','기술'],['XLC','커뮤니케이션'],['XLY','경기소비재'],['XLF','금융'],['XLV','헬스케어'],['XLI','산업재'],['XLP','필수소비재'],['XLE','에너지'],['XLU','유틸리티'],['XLRE','부동산'],['XLB','소재']];
  var firstGrid=document.querySelector('#stock .grid');
  if(firstGrid){
    var card=document.createElement('div'); card.className='card'; card.id='pro-sector'; card.style.marginTop='12px';
    card.innerHTML='<h3><span>섹터 히트맵 · 11개 GICS 섹터</span><span class="mut" style="font-weight:400;font-size:11px">섹터 ETF(SPDR) 당일 등락</span></h3><div class="shm" id="shm"></div><div class="shm-note">색 = 당일 등락 (빨강 상승 · 파랑 하락) · 타일을 누르면 Finviz 차트로 이동합니다.</div>';
    firstGrid.after(card);
    var shm=card.querySelector('#shm');
    shm.innerHTML=SEC.map(function(s){ return '<a href="https://finviz.com/quote.ashx?t='+s[0]+'" target="_blank" rel="noopener" id="sh-'+s[0]+'" style="background:#F1F2F4"><span>'+s[1]+'</span><em>--</em></a>'; }).join('');
    var mix=function(p){ var a=Math.min(1,Math.abs(p)/2.5), to=p>=0?[217,45,32]:[29,78,216], f=.25+.75*a; return 'rgb('+Math.round(245+(to[0]-245)*f)+','+Math.round(246+(to[1]-246)*f)+','+Math.round(247+(to[2]-247)*f)+')'; };
    var loadSec=async function(){
      var res=await Promise.all(SEC.map(function(s){ return quote(s[0]); }));
      res.forEach(function(q,i){ var el=document.getElementById('sh-'+SEC[i][0]); if(!el||!q) return; el.style.background=mix(q.pct); el.style.color=Math.abs(q.pct)>1?'#fff':'#111418'; el.querySelector('em').textContent=(q.pct>=0?'+':'')+q.pct.toFixed(2)+'%'; });
    };
    loadSec(); setInterval(loadSec,120000);
  }
  var FWD={"range": ["2019-05-31", "2026-09-09"], "rows": [["극단적 공포", 229, 2.71, 3.04, 70.7, -22.2], ["공포", 533, 1.56, 2.14, 71.3, -31.4], ["중립", 327, 0.19, 1.06, 61.8, -29.1], ["탐욕", 600, 0.75, 1.49, 64.8, -26.5], ["극단적 탐욕", 117, 1.28, 1.88, 79.5, -5.8]]};

  /* ④ 시장 내부지표 · 구간별 이후 20거래일 성과 · 핵심 일정 */
  var anchor=document.getElementById('pro-sector')||firstGrid;
  if(anchor){
    var row=document.createElement('div'); row.className='pro-row';
    row.innerHTML=
      '<div class="card" id="pro-int"><h3><span>시장 내부지표 · 변동성 · 추세</span><span class="mut" style="font-weight:400;font-size:11px">Yahoo 일봉 계산</span></h3>'+
      '<div class="pi-sub">VIX 기간구조</div><div class="vts" id="vts"></div><div class="pi-note" id="vts-note"></div>'+
      '<div class="pi-sub">지수 추세 (이동평균 대비 · 52주 고점 대비)</div>'+
      '<table class="pi-tbl"><thead><tr><th>ETF</th><th>50일선</th><th>200일선</th><th>52주 고점</th></tr></thead><tbody id="pi-tr"></tbody></table>'+
      '<div class="pi-sub">시장 폭 · NYSE+NASDAQ 보통주 (시총 3억$↑)</div><div id="pi-mb"><div class="pi-note">집계 불러오는 중…</div></div>'+
      '<div class="pi-sub">섹터 폭 (11개 섹터 ETF)</div><div class="pi-brd" id="pi-brd">--</div>'+
      '<div class="pi-note">출처: TradingView 스캐너(Worker 경유), 5분 캐시. Put/Call 비율은 무료 소스가 없어 제외했습니다.</div></div>'+
      '<div class="card" id="pro-fwd"><h3><span>공탐 구간별 이후 20거래일 성과</span><span class="mut" style="font-weight:400;font-size:11px">S&amp;P500(SPY) · '+FWD.range[0]+' ~ '+FWD.range[1]+'</span></h3>'+
      '<table class="pi-tbl"><thead><tr><th>구간</th><th>표본</th><th>평균</th><th>중앙값</th><th>상승확률</th><th>최악</th></tr></thead><tbody>'+
      FWD.rows.map(function(r){ var cl=r[2]>=0?'up':'down'; return '<tr><td><b>'+r[0]+'</b></td><td>'+r[1]+'</td><td class="'+cl+'">'+(r[2]>=0?'+':'')+r[2].toFixed(2)+'%</td><td>'+(r[3]>=0?'+':'')+r[3].toFixed(2)+'%</td><td>'+r[4].toFixed(1)+'%</td><td class="down">'+r[5].toFixed(1)+'%</td></tr>'; }).join('')+
      '</tbody></table><div class="pi-note">공탐 지수 일별 값이 해당 구간이던 날의 종가 기준, 이후 20거래일 수익률입니다. 인접한 날짜가 겹치는 표본이라 독립적인 횟수가 아니며, 과거 통계가 미래를 보장하지 않습니다. 배당 미포함.</div></div>';
    anchor.after(row);

    var cal=document.createElement('div'); cal.className='card'; cal.id='pro-cal'; cal.style.marginTop='12px';
    cal.innerHTML='<h3><span>경제지표 · 핵심 일정</span><span class="mut" style="font-weight:400;font-size:11px">시각은 한국시간(KST)</span></h3><div class="scroll"><table class="pi-tbl cal"><thead><tr><th>날짜</th><th>D-day</th><th>중요도</th><th>이벤트</th><th>시장 의미</th></tr></thead><tbody id="pc-tb"></tbody></table></div><div class="pi-note" id="pc-note">제목을 누르면 발표 기관 페이지로 이동합니다.</div>';
    row.after(cal);
    (function(){
      try{
        var now=new Date(), today=new Date(now.getFullYear(),now.getMonth(),now.getDate()), lim=today.getTime()+30*86400000, L=[];
        Object.keys(MONTH_EVENTS).forEach(function(mk){ (MONTH_EVENTS[mk]||[]).forEach(function(e){
          if(e.hol) return; var dt=new Date(now.getFullYear(),+mk-1,e.d); if(dt<today||dt.getTime()>lim) return; L.push({e:e,dt:dt,m:+mk}); }); });
        L.sort(function(a,b){return a.dt-b.dt;});
        var IMP={h:['최상','h'],m:['중','m'],l:['참고','l']};
        document.getElementById('pc-tb').innerHTML=L.length?L.map(function(x){
          var n=Math.round((x.dt-today)/86400000), im=IMP[x.e.g]||IMP.l;
          return '<tr><td class="mono">'+String(x.m).padStart(2,'0')+'.'+String(x.e.d).padStart(2,'0')+'</td><td class="mono">'+(n===0?'오늘':'D-'+n)+'</td><td><span class="imp imp-'+im[1]+'">'+im[0]+'</span></td><td><a href="'+x.e.s+'" target="_blank" rel="noopener">'+x.e.t+'</a></td><td class="mut">'+(x.e.c||'')+'</td></tr>';
        }).join(''):'<tr><td colspan="5" class="mut">향후 30일 내 등록된 일정이 없습니다.</td></tr>';
      }catch(e){}
    })();

    async function hist(sym){
      try{
        var j=await getJSON('https://query1.finance.yahoo.com/v8/finance/chart/'+encodeURIComponent(sym)+'?range=1y&interval=1d');
        var r=j.chart.result[0], c=r.indicators.quote[0].close.filter(function(x){return x!=null;});
        var p=(r.meta&&r.meta.regularMarketPrice!=null)?r.meta.regularMarketPrice:c[c.length-1];
        if(c.length<60) return null;
        var avg=function(n){ var s=c.slice(-n); return s.reduce(function(a,b){return a+b;},0)/s.length; };
        return {p:p, m50:avg(50), m200:c.length>=200?avg(200):null, hi:Math.max.apply(null,c.concat([p]))};
      }catch(e){ return null; }
    }
    var pc=function(a,b){ return (a/b-1)*100; };
    var cell=function(v){ return v==null?'<td class="mut">--</td>':'<td class="'+(v>=0?'up':'down')+'">'+(v>=0?'+':'')+v.toFixed(1)+'%</td>'; };
    var loadInt=async function(){
      /* VIX 기간구조 */
      var VS=[['^VIX9D','9일'],['^VIX','30일'],['^VIX3M','3개월'],['^VIX6M','6개월']];
      var vq=await Promise.all(VS.map(function(s){return quote(s[0]);}));
      document.getElementById('vts').innerHTML=VS.map(function(s,i){ var q=vq[i]; return '<div class="vt"><span>'+s[1]+'</span><b>'+(q?q.p.toFixed(2):'--')+'</b></div>'; }).join('');
      var a=vq[0],b=vq[1],c3=vq[2], note='';
      if(a&&b&&c3){
        if(a.p>c3.p||b.p>c3.p) note='<b style="color:var(--up)">역전(백워데이션)</b> — 단기 변동성이 중장기보다 높아 단기 스트레스 신호입니다.';
        else note='<b>정상(콘탱고)</b> — 단기 &lt; 장기 순으로 우상향, 평시 구조입니다.';
      }
      document.getElementById('vts-note').innerHTML=note;
      /* 지수 추세 */
      var IX=['SPY','QQQ','IWM','RSP'];
      var hs=await Promise.all(IX.map(hist));
      document.getElementById('pi-tr').innerHTML=IX.map(function(s,i){ var h=hs[i];
        return h?'<tr><td><b>'+s+'</b></td>'+cell(pc(h.p,h.m50))+cell(h.m200?pc(h.p,h.m200):null)+cell(pc(h.p,h.hi))+'</tr>':'<tr><td><b>'+s+'</b></td><td class="mut">--</td><td class="mut">--</td><td class="mut">--</td></tr>'; }).join('');
      /* 섹터 폭 */
      var sh=await Promise.all(SEC.map(function(s){return hist(s[0]);}));
      var ok=sh.filter(Boolean), a50=ok.filter(function(h){return h.p>h.m50;}).length, a200=ok.filter(function(h){return h.m200&&h.p>h.m200;}).length;
      document.getElementById('pi-brd').innerHTML=ok.length?'<div class="brd"><span>50일선 위</span><i><u style="width:'+(a50/ok.length*100)+'%"></u></i><b>'+a50+' / '+ok.length+'</b></div><div class="brd"><span>200일선 위</span><i><u style="width:'+(a200/ok.length*100)+'%"></u></i><b>'+a200+' / '+ok.length+'</b></div>':'--';
    };
    loadInt(); setInterval(loadInt,300000);

    /* 시장 폭 + 경제지표 (Worker → TradingView) */
    var WORKER=PROXY_BASE.replace(/\?url=$/,'');
    var wj=async function(path){ try{ var r=await fetch(WORKER+path,{signal:AbortSignal.timeout?AbortSignal.timeout(9000):undefined}); if(!r.ok) return null; var j=await r.json(); return j&&!j.error?j:null; }catch(e){ return null; } };
    var loadMB=async function(){
      var el=document.getElementById('pi-mb'), j=await wj('/us-breadth');
      if(!el) return;
      if(!j||!j.all){ el.innerHTML='<div class="pi-note">집계 서버(Worker) 재배포 후 표시됩니다.</div>'; return; }
      var bar=function(lab,v,t,col){ return '<div class="brd"><span>'+lab+'</span><i><u style="width:'+(v/t*100).toFixed(1)+'%;background:'+col+'"></u></i><b>'+v.toLocaleString()+'</b></div>'; };
      var flat=Math.max(0,j.all-j.up-j.down), ad=j.down?(j.up/j.down):null;
      el.innerHTML=bar('상승',j.up,j.all,'#D92D20')+bar('하락',j.down,j.all,'#1D4ED8')+
        '<div class="brd"><span>A/D 비율</span><i></i><b>'+(ad==null?'--':ad.toFixed(2))+'</b></div>'+
        bar('50일선 위',j.a50,j.all,'#0A6B48')+bar('200일선 위',j.a200,j.all,'#0A6B48')+
        '<div class="brd"><span>52주 신고가</span><i></i><b style="color:#D92D20">'+j.nh+'</b></div>'+
        '<div class="brd"><span>52주 신저가</span><i></i><b style="color:#1D4ED8">'+j.nl+'</b></div>'+
        '<div class="pi-note">모집단 '+j.all.toLocaleString()+'개 · 보합 '+flat+'개 · 장중에는 실시간에 가까운 값이며 지연될 수 있습니다.</div>';
    };
    loadMB(); setInterval(loadMB,300000);

    var fnum=function(v,e){ if(v==null) return '--'; var u=e.unit||''; var x=(Math.abs(v)>=1000?v.toLocaleString('en-US',{maximumFractionDigits:1}):(+v.toFixed(3)).toString()); return x+(u==='%'||u==='%'?'%':''); };
    var loadEcon=async function(){
      var j=await wj('/us-econ?days=14'), tb=document.getElementById('pc-tb'), note=document.getElementById('pc-note');
      if(!j||!j.events||!j.events.length) return; /* 실패 시 기존 이벤트 달력 표 유지 */
      var ev=j.events.filter(function(e){ return e.imp>=1 || /FOMC|Fed Chair|Powell|Nonfarm|Unemployment|Jobless Claims|GDP|PCE|ISM|Retail Sales MoM|Core Inflation/i.test(e.title); });
      if(!ev.length) return;
      ev.sort(function(x,y){return new Date(x.t)-new Date(y.t);});
      var th=document.querySelector('#pro-cal thead tr');
      if(th) th.innerHTML='<th>일시(KST)</th><th>중요도</th><th>지표</th><th>이전</th><th>예상</th><th>결과</th>';
      var pad=function(n){return String(n).padStart(2,'0');};
      tb.innerHTML=ev.map(function(e){
        var d=new Date(new Date(e.t).getTime()+9*3600000), ds=pad(d.getUTCMonth()+1)+'.'+pad(d.getUTCDate())+' '+pad(d.getUTCHours())+':'+pad(d.getUTCMinutes());
        var hi=e.imp>=1, a=e.actual, f=e.forecast, tone='';
        if(a!=null&&f!=null) tone=a>f?'up':(a<f?'down':'');
        return '<tr><td class="mono">'+ds+'</td><td><span class="imp '+(hi?'imp-h':'imp-l')+'">'+(hi?'높음':'보통')+'</span></td><td><b>'+e.title+'</b>'+(e.period?' <span class="mut">'+e.period+'</span>':'')+'</td><td class="mono">'+fnum(e.prev,e)+'</td><td class="mono">'+fnum(f,e)+'</td><td class="mono '+tone+'"><b>'+fnum(a,e)+'</b></td></tr>';
      }).join('');
      if(note) note.innerHTML='출처: TradingView 경제캘린더(Worker 경유, 5분 캐시) · 미국 · 향후 14일. 예상치는 발표 임박 시점에 채워지는 경우가 많습니다. 결과가 예상보다 크면 빨강, 작으면 파랑으로 표시합니다.';
    };
    loadEcon(); setInterval(loadEcon,300000);

  }
})();
