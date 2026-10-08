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
    shm.innerHTML=SEC.map(function(s){ return '<a href="https://finviz.com/quote.ashx?t='+s[0]+'" target="_blank" rel="noopener" id="sh-'+s[0]+'" style="background:#F1F2F4"><span>'+s[1]+' <small>('+s[0]+')</small></span><em>--</em></a>'; }).join('');
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
      '<div id="pi-tr" class="trd"></div><div class="trd-lg"><span><i class="m m200"></i>200일선</span><span><i class="m m50"></i>50일선</span><span><i class="px"></i>현재가</span><span class="mut">막대 = 52주 저점 ~ 고점</span></div>'+
      '</div>'+
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

    var wj=async function(path){ try{ var r=await fetch(WORKER+path,{signal:AbortSignal.timeout?AbortSignal.timeout(9000):undefined}); if(!r.ok) return {err:'HTTP '+r.status}; var j=await r.json(); return j&&!j.error?j:{err:(j&&j.error)||'빈 응답'}; }catch(e){ return {err:String(e.message||e)}; } };
    var loadEcon=async function(){
      var j=await wj('/us-econ?days=14');
      if(!j||j.err||!j.events||!j.events.length) return;
      var KEYRE=/FOMC|Fed Chair|Powell|Nonfarm|Unemployment Rate|Jobless Claims|GDP|PCE|ISM|Retail Sales MoM|Core Inflation|Inflation Rate/i;
      CAL.rows=j.events.map(function(e){
        var d=new Date(e.t); var k=new Date(d.getTime()+9*3600000);
        return {d:d,time:pad(k.getUTCHours())+':'+pad(k.getUTCMinutes()),imp:e.imp>=1?2:(KEYRE.test(e.title)?1:0),title:(koTitle(e.title)||e.title),sub:(koTitle(e.title)?e.title:''),period:e.period,unit:e.unit,actual:e.actual,forecast:e.forecast,prev:e.prev};
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
        nt.innerHTML=st==='inv'?'<b style="color:var(--up)">곡선이 우하향(역전)</b> — 단기 변동성이 중장기보다 높아 지금 당장의 불안이 크다는 신호입니다.':st==='norm'?'<b>곡선이 우상향(정상)</b> — 단기 &lt; 장기 순으로 올라가는 평시 구조입니다. 기울기가 가파를수록 시장은 안정적이지만 미래 변동성에 대한 보험료도 높게 매겨진 상태입니다.':'곡선이 일부 구간에서 꺾여 있어 방향이 뚜렷하지 않습니다.';
      } else { box.innerHTML='<div class="pi-note">VIX 기간구조 데이터를 불러오지 못했습니다.</div>'; bd.textContent='--'; }
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

  /* ⑥ 김군코멘트 시각화 */
  (function(){
    var kc=document.getElementById('us-kimcomment'), row=document.querySelector('#stock .fg-row'); if(!kc||!row) return;
    var box=document.createElement('div'); box.id='pro-kc'; row.after(box);
    var ZC=['#D92D20','#E8710A','#667085','#5BA33B','#15803D'], ZN=['극단적 공포','공포','중립','탐욕','극단적 탐욕'], ACT=['매수 시작','매수 시작','관망','매수 금지','매수 금지'];
    var draw=function(){
      var v=document.getElementById('us-val'), n=v?parseFloat((v.textContent||'').replace(/[^\d.]/g,'')):NaN; if(!isFinite(n)) return;
      var z=n<25?0:n<45?1:n<=55?2:n<=75?3:4, a=ACT[z], pill=function(t,cls){ return '<span class="act '+cls+(a===t?' on':'')+'">'+t+'</span>'; };
      box.innerHTML='<div class="kc" style="--zc:'+ZC[z]+'"><div class="kc-l"><span class="kc-k">김군코멘트</span><div class="kc-t"><em>'+ZN[z]+'</em><i>→</i><b>'+a+'</b></div></div>'+
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
})();
