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
  var FWD={"range": ["2019-05-31", "2026-09-09"], "rows": [["극단적 공포", 229, 2.71, 3.04, 70.7, -22.2, 23.1], ["공포", 533, 1.56, 2.14, 71.3, -31.4, 13.8], ["중립", 327, 0.19, 1.06, 61.8, -29.1, 10.5], ["탐욕", 600, 0.75, 1.49, 64.8, -26.5, 7.7], ["극단적 탐욕", 117, 1.28, 1.88, 79.5, -5.8, 5.8]]};

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
      '<table class="pi-tbl"><thead><tr><th>ETF</th><th>50일선</th><th>200일선</th><th>52주 고점</th></tr></thead><tbody id="pi-tr"></tbody></table>'+
      '<div class="pi-sub">시장 폭 · NYSE+NASDAQ 보통주 (시총 3억$↑)</div><div id="pi-mb"><div class="pi-note">집계 불러오는 중…</div></div>'+
      '<div class="pi-sub">섹터 폭 (11개 섹터 ETF)</div><div class="pi-brd" id="pi-brd">--</div>'+
      '<div class="pi-note">Put/Call 비율은 무료 소스가 없어 제외했습니다.</div></div>'+
      '<div class="card" id="pro-fwd"><h3><span>공탐 구간별 이후 20거래일 성과</span><span class="mut" style="font-weight:400;font-size:11px">S&amp;P500(SPY) · '+FWD.range[0]+' ~ '+FWD.range[1]+'</span></h3><div id="fwd-body"></div></div>';
    anchor.after(row);

    /* ── 20거래일 성과 카드 ── */
    var renderFwd=function(){
      var vEl=document.getElementById('us-val'), cn=vEl?parseFloat((vEl.textContent||'').replace(/[^\d.]/g,'')):NaN, cz=isFinite(cn)?zoneOf(cn):-1;
      var R=FWD.rows, lo=0, hi=0;
      R.forEach(function(r){ lo=Math.min(lo,r[2]); hi=Math.max(hi,r[2]); });
      var zp=(-lo/(hi-lo||1))*100;
      var h='<div class="fwd-cur">'+(cz>=0?'현재 공탐 <b>'+Math.round(cn)+'</b> · <b>'+ZN[cz]+'</b> 구간 — 과거 이 구간의 이후 20거래일 평균 <b class="'+(R[cz][2]>=0?'up':'down')+'">'+sg(R[cz][2])+'%</b>, 상승확률 <b>'+R[cz][4].toFixed(1)+'%</b>':'현재 공탐 값을 불러오는 중…')+'</div>';
      h+='<table class="pi-tbl"><thead><tr><th>구간</th><th>표본</th><th>평균</th><th>중앙값</th><th>상승확률</th><th>최악</th></tr></thead><tbody>'+
        R.map(function(r,i){ return '<tr'+(i===cz?' class="cur"':'')+'><td><b>'+r[0]+'</b></td><td>'+r[1]+'</td><td class="'+(r[2]>=0?'up':'down')+'">'+sg(r[2])+'%</td><td>'+sg(r[3])+'%</td><td>'+r[4].toFixed(1)+'%</td><td class="down">'+r[5].toFixed(1)+'%</td></tr>'; }).join('')+'</tbody></table>';
      h+='<div class="pi-sub">평균 수익률 · 상승확률</div><div class="fwd-bars">'+
        R.map(function(r,i){
          var w=Math.abs(r[2])/((hi-lo)||1)*100, left=r[2]>=0?zp:zp-w;
          return '<div class="fb'+(i===cz?' cur':'')+'"><span>'+r[0]+'</span><i class="fb-avg"><u class="zero" style="left:'+zp+'%"></u><u class="bar '+(r[2]>=0?'up':'down')+'" style="left:'+left+'%;width:'+w+'%"></u></i><b class="'+(r[2]>=0?'up':'down')+'">'+sg(r[2])+'%</b>'+
            '<i class="fb-win"><u class="half"></u><u class="bar" style="width:'+r[4]+'%"></u></i><b>'+r[4].toFixed(0)+'%</b></div>';
        }).join('')+'</div><div class="fb-legend"><span><i class="lg lg-a"></i>평균 수익률</span><span><i class="lg lg-w"></i>상승확률 (│ = 50%)</span></div>';
      var RL=-35, RH=25, rp=function(v){ return ((v-RL)/(RH-RL)*100); };
      h+='<div class="pi-sub">20일 수익률 범위 · 최악 ~ 최고 (● 평균)</div><div class="fwd-rng">'+
        R.map(function(r,i){ return '<div class="fr'+(i===cz?' cur':'')+'"><span>'+r[0]+'</span><i><u class="zero" style="left:'+rp(0)+'%"></u><u class="rng" style="left:'+rp(r[5])+'%;width:'+(rp(r[6])-rp(r[5]))+'%"></u><u class="dot" style="left:'+rp(r[2])+'%"></u></i><em>'+r[5].toFixed(0)+'% ~ +'+r[6].toFixed(0)+'%</em></div>'; }).join('')+'</div>';
      /* 데이터에서 계산한 요약 */
      var bestA=R.reduce(function(a,r){return r[2]>a[2]?r:a;}), bestW=R.reduce(function(a,r){return r[4]>a[4]?r:a;}), worstD=R.reduce(function(a,r){return r[5]<a[5]?r:a;});
      var fn=R[0][1]+R[1][1], fa=(R[0][2]*R[0][1]+R[1][2]*R[1][1])/fn, fw=(R[0][4]*R[0][1]+R[1][4]*R[1][1])/fn;
      h+='<ul class="fwd-ins"><li>공포 이하(극단적 공포+공포) 합산: 평균 <b>'+sg(fa)+'%</b> · 상승확률 <b>'+fw.toFixed(1)+'%</b> (중립 '+R[2][4].toFixed(1)+'%)</li>'+
        '<li>평균 수익률이 가장 높은 구간 <b>'+bestA[0]+'</b> ('+sg(bestA[2])+'%), 상승확률이 가장 높은 구간 <b>'+bestW[0]+'</b> ('+bestW[4].toFixed(1)+'%)</li>'+
        '<li>최악 낙폭이 가장 컸던 구간은 <b>'+worstD[0]+'</b> ('+worstD[5].toFixed(1)+'%) — 평균이 좋아도 개별 시점의 손실 폭은 큽니다</li></ul>'+
        '<div class="pi-note">공탐 일별 값이 해당 구간이던 날의 종가 기준 이후 20거래일 수익률(배당 미포함)입니다. 날짜가 겹치는 표본이라 독립적인 횟수가 아니며, 과거 통계가 미래를 보장하지 않습니다.</div>';
      document.getElementById('fwd-body').innerHTML=h;
    };
    renderFwd(); setInterval(renderFwd,5000);

    /* ── 경제지표 카드 ── */
    var cal=document.createElement('div'); cal.className='card'; cal.id='pro-cal'; cal.style.marginTop='12px';
    cal.innerHTML='<h3><span>경제지표 · 핵심 일정</span><span class="cal-tabs" id="cal-tabs"><button class="on" data-f="hi">핵심만</button><button data-f="all">전체</button></span></h3>'+
      '<div id="cal-body"><div class="pi-note">불러오는 중…</div></div><div class="pi-note" id="pc-note"></div>';
    row.after(cal);
    var CAL={mode:'fallback',rows:[],f:'hi'};
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
      var rows=CAL.rows.filter(function(r){ return CAL.f==='all'||r.imp>=1; });
      if(CAL.mode==='live'&&CAL.f==='hi'&&!rows.length) rows=CAL.rows;
      if(!rows.length){ body.innerHTML='<div class="pi-note">표시할 일정이 없습니다.</div>'; return; }
      var today=new Date(); today=new Date(today.getFullYear(),today.getMonth(),today.getDate());
      var nextIdx=-1, nowMs=Date.now();
      rows.forEach(function(r,i){ if(nextIdx<0&&r.d.getTime()>=nowMs-1800000) nextIdx=i; });
      var live=CAL.mode==='live', h='<div class="cal-list'+(live?'':' noval')+'"><div class="cal-hd"><span>시각</span><span>중요도</span><span>지표</span>'+(live?'<span>이전</span><span>예상</span><span>결과</span>':'')+'</div>', last='';
      rows.forEach(function(r,i){
        var k=r.d.getFullYear()+'-'+r.d.getMonth()+'-'+r.d.getDate();
        if(k!==last){ last=k; var dd=Math.round((new Date(r.d.getFullYear(),r.d.getMonth(),r.d.getDate())-today)/86400000);
          h+='<div class="cal-day"><b>'+pad(r.d.getMonth()+1)+'.'+pad(r.d.getDate())+' ('+DOW[r.d.getDay()]+')</b><em>'+(dd===0?'오늘':dd<0?'지남':'D-'+dd)+'</em></div>'; }
        var imp=r.imp>=2?'h':r.imp===1?'m':'l', dots='<span class="imp-dots imp-'+imp+'" title="'+(r.imp>=2?'높음':r.imp===1?'중간':'낮음')+'"><i></i><i></i><i></i></span>';
        var ttl=r.link?'<a href="'+r.link+'" target="_blank" rel="noopener">'+r.title+'</a>':'<b>'+r.title+'</b>';
        var vals='';
        if(live){
          var tone='', badge='';
          if(r.actual!=null&&r.forecast!=null){ if(r.actual>r.forecast){tone='up';badge='<s class="bd up">상회</s>';} else if(r.actual<r.forecast){tone='down';badge='<s class="bd down">하회</s>';} else badge='<s class="bd">부합</s>'; }
          vals='<span class="cv" data-l="이전">'+fnum(r.prev,r)+'</span><span class="cv" data-l="예상">'+fnum(r.forecast,r)+'</span><span class="cv res '+tone+'" data-l="결과">'+(r.actual==null?'<em class="wait">대기</em>':'<b>'+fnum(r.actual,r)+'</b>'+badge)+'</span>';
        }
        h+='<div class="cal-row'+(i===nextIdx?' next':'')+(r.imp>=2?' hi':'')+'"><span class="ct">'+(r.time||'--:--')+'</span><span class="ci">'+dots+'</span><span class="cn">'+ttl+(r.period?' <small>'+r.period+'</small>':'')+(r.sub?'<small class="cs">'+r.sub+'</small>':'')+'</span>'+vals+'</div>';
      });
      body.innerHTML=h+'</div>';
    };
    document.getElementById('cal-tabs').addEventListener('click',function(e){ var b=e.target.closest('button'); if(!b) return; this.querySelectorAll('button').forEach(function(x){x.classList.toggle('on',x===b);}); CAL.f=b.dataset.f; drawCal(); });
    CAL.rows=buildFallback(); drawCal();
    document.getElementById('pc-note').textContent='제목을 누르면 발표 기관 페이지로 이동합니다 · 예상·이전·결과는 집계 서버 연결 시 표시됩니다.';

    var wj=async function(path){ try{ var r=await fetch(WORKER+path,{signal:AbortSignal.timeout?AbortSignal.timeout(9000):undefined}); if(!r.ok) return {err:'HTTP '+r.status}; var j=await r.json(); return j&&!j.error?j:{err:(j&&j.error)||'빈 응답'}; }catch(e){ return {err:String(e.message||e)}; } };
    var loadEcon=async function(){
      var j=await wj('/us-econ?days=14');
      if(!j||j.err||!j.events||!j.events.length) return;
      var KEYRE=/FOMC|Fed Chair|Powell|Nonfarm|Unemployment Rate|Jobless Claims|GDP|PCE|ISM|Retail Sales MoM|Core Inflation|Inflation Rate/i;
      CAL.rows=j.events.map(function(e){
        var d=new Date(e.t); var k=new Date(d.getTime()+9*3600000);
        return {d:d,time:pad(k.getUTCHours())+':'+pad(k.getUTCMinutes()),imp:e.imp>=1?2:(KEYRE.test(e.title)?1:0),title:e.title,period:e.period,unit:e.unit,actual:e.actual,forecast:e.forecast,prev:e.prev};
      }).sort(function(a,b){return a.d-b.d;});
      /* 표시 시각은 한국시간이지만 날짜 구분도 한국 기준으로 */
      CAL.rows.forEach(function(r){ var k=new Date(r.d.getTime()+9*3600000); r.d=new Date(k.getUTCFullYear(),k.getUTCMonth(),k.getUTCDate(),k.getUTCHours(),k.getUTCMinutes()); });
      CAL.mode='live'; drawCal();
      document.getElementById('pc-note').innerHTML='출처: TradingView 경제캘린더(집계 서버 경유, 5분 캐시) · 미국 · 시각은 한국시간(KST). 예상치는 발표가 임박해야 채워지는 항목이 많습니다. 결과가 예상보다 크면 <b style="color:var(--up)">상회(빨강)</b>, 작으면 <b style="color:var(--down)">하회(파랑)</b>입니다.';
    };
    loadEcon(); setInterval(loadEcon,300000);

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
        var r=j.chart.result[0], c=r.indicators.quote[0].close.filter(function(x){return x!=null;});
        var p=(r.meta&&r.meta.regularMarketPrice!=null)?r.meta.regularMarketPrice:c[c.length-1];
        if(c.length<60) return null;
        var avg=function(n){ var s=c.slice(-n); return s.reduce(function(a,b){return a+b;},0)/s.length; };
        return {p:p, m50:avg(50), m200:c.length>=200?avg(200):null, hi:Math.max.apply(null,c.concat([p]))};
      }catch(e){ return null; }
    }
    var pc=function(a,b){ return (a/b-1)*100; };
    var cell=function(v){ return v==null?'<td class="mut">--</td>':'<td class="'+(v>=0?'up':'down')+'">'+sg(v,1)+'%</td>'; };
    var loadMB=async function(){
      var el=document.getElementById('pi-mb'), j=await wj('/us-breadth');
      if(!el) return;
      if(!j||j.err||!j.all){ el.innerHTML='<div class="pi-note">집계 서버 응답 없음 ('+(j&&j.err?j.err:'알 수 없음')+') — Worker에 /us-breadth 가 배포돼 있는지 확인해주세요.</div>'; return; }
      var bar=function(lab,v,t,col){ return '<div class="brd"><span>'+lab+'</span><i><u style="width:'+(v/t*100).toFixed(1)+'%;background:'+col+'"></u></i><b>'+v.toLocaleString()+'</b></div>'; };
      var flat=Math.max(0,j.all-j.up-j.down), ad=j.down?(j.up/j.down):null;
      el.innerHTML=bar('상승',j.up,j.all,'#D92D20')+bar('하락',j.down,j.all,'#1D4ED8')+
        '<div class="brd"><span>A/D 비율</span><i></i><b>'+(ad==null?'--':ad.toFixed(2))+'</b></div>'+
        bar('50일선 위',j.a50,j.all,'#0A6B48')+bar('200일선 위',j.a200,j.all,'#0A6B48')+
        '<div class="brd"><span>52주 신고가</span><i></i><b style="color:#D92D20">'+j.nh+'</b></div>'+
        '<div class="brd"><span>52주 신저가</span><i></i><b style="color:#1D4ED8">'+j.nl+'</b></div>'+
        '<div class="pi-note">모집단 '+j.all.toLocaleString()+'개 · 보합 '+flat+'개 · 출처 TradingView 스캐너(5분 캐시)</div>';
    };
    loadMB(); setInterval(loadMB,300000);
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
        nt.innerHTML=st==='inv'?'<b style="color:var(--up)">곡선이 우하향(역전)</b> — 단기 변동성이 중장기보다 높아 지금 당장의 불안이 크다는 신호입니다.':st==='norm'?'<b>곡선이 우상향(정상)</b> — 단기 &lt; 장기 순으로 올라가는 평시 구조입니다. 기울기가 가파를수록 시장은 안정적이지만 미래 변동성에 대한 보험료도 높게 매겨진 상태입니다.':'곡선이 일부 구간에서 꺾여 있어 방향이 뚜렷하지 않습니다.';
      } else { box.innerHTML='<div class="pi-note">VIX 기간구조 데이터를 불러오지 못했습니다.</div>'; bd.textContent='--'; }
      var IX=['SPY','QQQ','IWM','RSP'];
      var hs=await Promise.all(IX.map(hist));
      document.getElementById('pi-tr').innerHTML=IX.map(function(s,i){ var h=hs[i];
        return h?'<tr><td><b>'+s+'</b></td>'+cell(pc(h.p,h.m50))+cell(h.m200?pc(h.p,h.m200):null)+cell(pc(h.p,h.hi))+'</tr>':'<tr><td><b>'+s+'</b></td><td class="mut">--</td><td class="mut">--</td><td class="mut">--</td></tr>'; }).join('');
      var sh=await Promise.all(SEC.map(function(s){return hist(s[0]);}));
      var ok2=sh.filter(Boolean), a50=ok2.filter(function(h){return h.p>h.m50;}).length, a200=ok2.filter(function(h){return h.m200&&h.p>h.m200;}).length;
      document.getElementById('pi-brd').innerHTML=ok2.length?'<div class="brd"><span>50일선 위</span><i><u style="width:'+(a50/ok2.length*100)+'%"></u></i><b>'+a50+' / '+ok2.length+'</b></div><div class="brd"><span>200일선 위</span><i><u style="width:'+(a200/ok2.length*100)+'%"></u></i><b>'+a200+' / '+ok2.length+'</b></div>':'--';
    };
    loadInt(); setInterval(loadInt,300000);
  }

  /* ⑤ 지수 편입·편출 — 지수 선택(전체 / S&P500 / 나스닥100) */
  (function(){
    var host=document.getElementById('idxchg-tbl'), per=document.querySelector('.tabs[data-group="idxchg"]');
    if(!host||!per) return;
    var wrap=document.createElement('div'); wrap.className='tabrow'; per.before(wrap); wrap.appendChild(per);
    var sel=document.createElement('div'); sel.className='seg ixf';
    sel.innerHTML='<button class="on" data-x="">전체</button><button data-x="sp">S&amp;P500</button><button data-x="nq">나스닥100</button>';
    wrap.appendChild(sel);
    var cur='', busy=false;
    var apply=function(){
      busy=true;
      host.querySelectorAll('.wl-row').forEach(function(r){ var tag=r.querySelector('.ix'); var is=!cur||(tag&&tag.classList.contains('ix-'+cur)); r.style.display=is?'':'none'; var nx=r.nextElementSibling; if(nx&&/^finx/.test(nx.id||'')&&!is) nx.style.display='none'; });
      Array.prototype.forEach.call(host.children,function(g){
        var lists=g.querySelectorAll('.wl-list'); if(!lists.length) return;
        var cnt=[];
        lists.forEach(function(l){ var n=l.querySelectorAll('.wl-row:not([style*="display: none"])').length; cnt.push(n); l.style.display=n?'':'none'; var lab=l.previousElementSibling; if(lab&&lab.className!=='wl-list') lab.style.display=n?'':'none'; });
        var tot=cnt.reduce(function(a,b){return a+b;},0); g.style.display=tot?'':'none';
        var sm=g.querySelector('.mut'); if(sm&&cnt.length>=1&&cur) sm.textContent='· 편입 '+(cnt[0]||0)+(cnt.length>1?' · 편출 '+cnt[1]:'');
      });
      var emp=document.getElementById('ixf-empty'); if(emp) emp.remove();
      if(cur&&!Array.prototype.some.call(host.children,function(g){return g.style.display!=='none'&&g.querySelector&&g.querySelector('.wl-list');})){ var d=document.createElement('div'); d.id='ixf-empty'; d.className='pi-note'; d.textContent='선택한 기간에 해당 지수의 편입·편출 종목이 없습니다.'; host.after(d); }
      busy=false;
    };
    sel.addEventListener('click',function(e){ var b=e.target.closest('button'); if(!b) return; sel.querySelectorAll('button').forEach(function(x){x.classList.toggle('on',x===b);}); cur=b.dataset.x; apply(); });
    new MutationObserver(function(){ if(!busy&&cur) apply(); }).observe(host,{childList:true});
  })();
})();
