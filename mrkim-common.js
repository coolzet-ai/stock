const $=s=>document.querySelector(s);
const PERKO={d:'일간',w:'주간',m:'월간',y:'연간'};
const curPer={us:'d',tick:'d',cap:'d',lev:'d',cf:'d',coin:'d'};
const fmt=n=>n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const sign=v=>(v>0?'+':'')+v.toFixed(2)+'%';
const cls=v=>v>0?'up':(v<0?'down':'');

function label(v){
  if(v<25)return['극단적 공포','#ff4d4f'];
  if(v<45)return['공포','#ff8a00'];
  if(v<=55)return['중립','#9fb0c9'];
  if(v<=75)return['탐욕','#a3e635'];
  return['극단적 탐욕','#22c55e'];
}
function paint(pre,v,note){
  const [t,c]=label(v);
  $('#'+pre+'-val').textContent=Math.round(v);
  $('#'+pre+'-state').textContent=t;
  const d=$('#'+pre+'-dial');
  d.style.setProperty('--p',v+'%'); d.style.setProperty('--g',c);
  $('#'+pre+'-state').style.color=c;
  if(note)$('#'+pre+'-note').textContent=note;
  const kc=document.getElementById(pre+'-kimcomment');
  if(kc){
    const ACTION={'극단적 공포':'매수 시작','공포':'매수 시작','중립':'관망','탐욕':'매수 금지','극단적 탐욕':'매수 금지'};
    kc.textContent=t+' — '+(ACTION[t]||'—');
    kc.style.color=c;
    kc.style.background=c+'26';
    kc.style.border='1px solid '+c+'55';
  }
}
function bars(pre,arr,labels,tickEvery){
  const el=$('#'+pre+'-bars'); el.innerHTML='';
  arr.forEach((v,i)=>{
    const it=document.createElement('i');
    it.style.height=Math.max(8,v)+'%'; it.style.background=label(v)[1]+'aa';
    if(labels&&labels[i]) it.title=labels[i]+' · '+Math.round(v)+'점';
    el.appendChild(it);
  });
  const tr=document.getElementById(pre+'-trend');
  if(tr) tr.innerHTML=trendSVG(arr);
  const lb=document.getElementById(pre+'-bars-labels');
  if(lb){
    if(labels&&labels.length){
      const every=tickEvery||1;
      lb.innerHTML=labels.map((txt,i)=>'<span>'+((i%every===0||i===labels.length-1)?txt:'')+'</span>').join('');
      lb.style.display='flex';
    }else{
      lb.innerHTML=''; lb.style.display='none';
    }
  }
}

/* ---- 스파크라인(추세) SVG 생성 ---- */
function buildPath(arr,vbW,vbH,pad){
  const min=Math.min(...arr), max=Math.max(...arr), range=(max-min)||1;
  const step=(vbW-2*pad)/(arr.length-1);
  const pts=arr.map((v,i)=>[pad+i*step, vbH-pad-((v-min)/range)*(vbH-2*pad)]);
  return pts.map((p,i)=>(i===0?'M':'L')+p[0].toFixed(1)+','+p[1].toFixed(1)).join(' ');
}
/* 테이블 셀용 소형 스파크라인 (상승/하락 색상) */
function sparkSVG(arr){
  if(!arr||arr.length<2) return '';
  const w=90,h=28,pad=2;
  const d=buildPath(arr,w,h,pad);
  const color=(arr[arr.length-1]>=arr[0])?'var(--up)':'var(--down)';
  return '<svg viewBox="0 0 '+w+' '+h+'" width="'+w+'" height="'+h+'" preserveAspectRatio="none">'+
         '<path d="'+d+'" fill="none" stroke="'+color+'" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
}
/* 공포탐욕지수 카드용 대형 추세선 (전체 너비, 강조색) */
function trendSVG(arr){
  if(!arr||arr.length<2) return '';
  const w=200,h=44,pad=3;
  const d=buildPath(arr,w,h,pad);
  return '<svg viewBox="0 0 '+w+' '+h+'" preserveAspectRatio="none">'+
         '<path d="'+d+'" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
}
/* 실시간 데이터가 없을 때, 일/주/월/연 등락률로부터 근사 추세를 역산.
   선택된 기간(p)에 따라 서로 다른 길이·모양의 곡선을 반환해 탭 전환 시 그림이 바뀌도록 한다. */
function fallbackSeries(b,p){
  const now=b.px;
  const back=pct=>now/(1+pct/100);
  switch(p){
    case 'd': return [back(b.d), now];
    case 'w': return [back(b.w), back(b.d), now];
    case 'm': return [back(b.m), back(b.w), back(b.d), now];
    case 'y':
    default:  return [back(b.y), back(b.m), back(b.w), back(b.d), now];
  }
}

/* ===================== 가상화폐 (구 misujukim-crypto.html 통합) =====================
   alternative.me / CoinGecko 는 CORS 를 직접 허용하므로 프록시 없이 바로 호출한다. */
const fmtCoin=n=>n>=1000?n.toLocaleString('en-US',{maximumFractionDigits:0}):n.toLocaleString('en-US',{maximumFractionDigits:n>=1?2:4});
function avg(a){return a.reduce((x,y)=>x+y,0)/a.length;}
async function fetchJSON(url,ms){
  const c=new AbortController(), t=setTimeout(()=>c.abort(),ms||8000);
  try{
    const r=await fetch(url,{signal:c.signal});
    clearTimeout(t);
    if(!r.ok) throw new Error('HTTP '+r.status);
    return await r.json();
  }catch(e){ clearTimeout(t); throw e; }
}

/* 네트워크 실패 시 표시할 크립토 공포탐욕지수 스냅샷 (근사치 · 자주 갱신 필요) */
const CF_BASE={d:54, w:58, m:62, y:57};
const CF_BARS=[48,52,55,60,58,54,50,46,49,53,57,61,59,55,51,47,50,54,58,62,60,56,52,54];
let cfData=[];
async function loadCF(){
  try{
    const j=await fetchJSON('https://api.alternative.me/fng/?limit=400&format=json',9000);
    cfData=j.data.map(d=>({v:+d.value,t:+d.timestamp}));
  }catch(e){ cfData=[]; }
  renderCF(curPer.cf);
}
function renderCF(p){
  if(!cfData.length){
    const v=CF_BASE[p];
    paint('cf',v,'네트워크 연결 실패 — 근사 스냅샷 표시 중');
    const fbSeries={d:[CF_BASE.m,CF_BASE.d], w:[CF_BASE.y,CF_BASE.m,CF_BASE.w,CF_BASE.d],
                     m:[CF_BASE.y,CF_BASE.m,CF_BASE.w,CF_BASE.d], y:[CF_BASE.y,CF_BASE.m,CF_BASE.w,CF_BASE.d]}[p]||CF_BARS;
    bars('cf', fbSeries.length>1?fbSeries:CF_BARS);
    document.getElementById('cf-per').textContent='· '+{d:'일간',w:'주간',m:'월간',y:'연간'}[p];
    document.getElementById('cf-comment').textContent='실시간 연동에 실패하여 근사 스냅샷을 표시하고 있습니다('+Math.round(v)+'점, '+label(v)[0]+' 구간).';
    return;
  }
  const n={d:1,w:7,m:30,y:365}[p], v=avg(cfData.slice(0,n).map(x=>x.v));
  const prev=cfData.slice(n,n*2).map(x=>x.v);
  const note=prev.length?'직전 기간 대비 '+sign(v-avg(prev)).replace('%','p'):'—';
  paint('cf',v,note);
  document.getElementById('cf-per').textContent='· '+{d:'일간',w:'주간',m:'월간',y:'연간'}[p];
  const step=Math.max(1,Math.floor(n/24));
  bars('cf',cfData.slice(0,Math.min(cfData.length,n*1)).filter((_,i)=>i%step===0).slice(0,24).reverse().map(x=>x.v));
  document.getElementById('cf-comment').textContent='최근 '+{d:'24시간',w:'7일',m:'30일',y:'1년'}[p]+' 평균 심리는 '+Math.round(v)+'점('+label(v)[0]+') 구간입니다.';
}

/* CoinGecko 무료(키 없음) 호출은 분당 허용 횟수가 낮아 방문자가 몰리거나 자동 새로고침이
   겹치면 429(레이트리밋)로 실패해 폴백 스냅샷만 계속 보일 수 있습니다.
   coingecko.com/ko/developers/dashboard 에서 무료 Demo API 키를 발급받아 아래에
   넣으면 분당 허용 횟수가 크게 늘어나 안정적으로 표시됩니다(키 없이도 동작은 함). */
const CG_KEY='';
function cgURL(path){
  return 'https://api.coingecko.com/api/v3'+path+(CG_KEY?(path.includes('?')?'&':'?')+'x_cg_demo_api_key='+CG_KEY:'');
}
const COIN_WEBSITE={bitcoin:'https://bitcoin.org',ethereum:'https://ethereum.org',solana:'https://solana.com',ripple:'https://xrpl.org'};
const COIN_BASE={
  bitcoin :{px:112000, d:0.5, w:3.0,  m:8.0,  y:45.0, mcap:2200000000000},
  ethereum:{px:4200,   d:0.8, w:4.0,  m:10.0, y:30.0, mcap:505000000000},
  solana  :{px:210,    d:1.0, w:5.0,  m:12.0, y:40.0, mcap:110000000000},
  ripple  :{px:2.80,   d:0.3, w:2.0,  m:5.0,  y:60.0, mcap:160000000000}
};
/* sparkline=true 는 CoinGecko 호출 비용이 커서 매 새로고침(60초)마다 요청하면 레이트리밋에
   더 쉽게 걸린다. 7일 추세선은 자주 바뀌지 않으므로 10분에 한 번만 sparkline 을 새로 받고,
   나머지 새로고침에서는 캐시된 스파크라인을 재사용한다. */
let coinData=null;
const sparklineCache={};
let lastSparklineAt=0;
async function loadCoin(){
  const base=cgURL('/coins/markets?vs_currency=usd&ids=bitcoin,ethereum,solana,ripple&price_change_percentage=24h,7d,30d,1y');
  const needSparkline=(Date.now()-lastSparklineAt)>10*60*1000 || !Object.keys(sparklineCache).length;
  try{
    const arr=await fetchJSON(needSparkline?base+'&sparkline=true':base,9000);
    coinData={};
    arr.forEach(c=>{
      coinData[c.id]=c;
      if(c.sparkline_in_7d&&c.sparkline_in_7d.price) sparklineCache[c.id]=c.sparkline_in_7d.price;
    });
    if(needSparkline) lastSparklineAt=Date.now();
  }catch(e1){
    try{
      const arr=await fetchJSON(base,9000); // sparkline 없이 1회 재시도(요청 비용을 낮춰 레이트리밋 완화)
      coinData={}; arr.forEach(c=>coinData[c.id]=c);
    }catch(e2){
      coinData=null; // 완전 실패 → 폴백 스냅샷 사용
    }
  }
  renderCoin(curPer.coin);
  renderMcapChart();
}
function renderCoin(p){
  const key={d:'price_change_percentage_24h_in_currency',w:'price_change_percentage_7d_in_currency',
             m:'price_change_percentage_30d_in_currency',y:'price_change_percentage_1y_in_currency'}[p];
  document.querySelectorAll('#coin-tbl tbody tr').forEach(tr=>{
    const id=tr.dataset.c, c=coinData&&coinData[id];
    const px=tr.querySelector('.px'), ch=tr.querySelector('.ch'), sp=tr.querySelector('.spark');
    if(!c){
      const b=COIN_BASE[id]; if(!b){ px.textContent='--'; ch.textContent='--'; if(sp)sp.innerHTML=''; return; }
      px.textContent='$'+fmtCoin(b.px);
      ch.textContent=sign(b[p]); ch.className='num ch chg '+cls(b[p]);
      if(sp) sp.innerHTML=sparkSVG(fallbackSeries(b,p));
      return;
    }
    px.textContent='$'+fmtCoin(c.current_price);
    const v=c[key];
    ch.textContent=(v==null)?'—':sign(v); ch.className='num ch chg '+cls(v||0);
    const prices=(c.sparkline_in_7d||{}).price||sparklineCache[id];
    if(sp) sp.innerHTML=prices?sparkSVG(prices):sparkSVG(fallbackSeries(COIN_BASE[id]||{px:c.current_price,d:0,w:0,m:0,y:0},p));
  });
}

/* BTC·ETH·SOL·XRP 4종 시가총액 비중 시각화 */
const COIN_COLOR={bitcoin:'#f7931a',ethereum:'#627eea',solana:'#14f195',ripple:'#00aae4'};
const COIN_LABEL={bitcoin:'BTC',ethereum:'ETH',solana:'SOL',ripple:'XRP'};
/* 시가총액 비중(%) 막대+범례 — US/코스피/코스닥 TOP10 공용 렌더러 */
const CAP_COLORS10=['#ffb020','#ff8a00','#3d9dff','#22c55e','#a3e635','#ff4d4f','#9fb0c9','#c084fc','#f472b6','#2dd4bf'];
function renderCapShareChart(elId, entries){
  const el=document.getElementById(elId); if(!el) return;
  const sorted=entries.slice().sort((a,b)=>b.cap-a.cap);
  const total=sorted.reduce((s,x)=>s+x.cap,0)||1;
  const bars=sorted.map((e,i)=>{
    const pct=e.cap/total*100;
    return '<div style="width:'+pct.toFixed(2)+'%;background:'+CAP_COLORS10[i%10]+'" title="'+e.label+' '+pct.toFixed(1)+'%"></div>';
  }).join('');
  const legend=sorted.map((e,i)=>{
    const pct=e.cap/total*100;
    return '<span style="display:inline-flex;align-items:center;gap:6px;margin:0 14px 6px 0;font-size:12px;color:var(--tx2)">'+
      '<i style="width:9px;height:9px;border-radius:2px;background:'+CAP_COLORS10[i%10]+';display:inline-block"></i>'+
      e.label+' '+pct.toFixed(1)+'%</span>';
  }).join('');
  el.innerHTML='<div style="display:flex;height:20px;border-radius:6px;overflow:hidden">'+bars+'</div>'+
    '<div style="margin-top:10px;display:flex;flex-wrap:wrap">'+legend+'</div>';
}
/* 시가총액 스냅샷 (근사치 · US는 USD 조 단위, 코스피/코스닥은 원화 조 단위 — 단위가 달라도 비중 계산에는 무관) */
const US_CAP_DATA=[
  {label:'NVDA',cap:5.5},{label:'AAPL',cap:4.7},{label:'GOOGL',cap:4.1},{label:'MSFT',cap:3.7},{label:'AMZN',cap:2.8},
  {label:'AVGO',cap:1.6},{label:'META',cap:1.6},{label:'TSLA',cap:1.4},{label:'TSM',cap:1.2},{label:'SPCX',cap:0.4}
];
const KRCAP_CAP_DATA=[
  {label:'삼성전자',cap:1673.7},{label:'SK하이닉스',cap:1323.7},{label:'SK스퀘어',cap:143.7},{label:'삼성전기',cap:105.8},{label:'현대차',cap:89.2},
  {label:'LG에너지솔루션',cap:84.2},{label:'삼성바이오로직스',cap:65.5},{label:'KB금융',cap:63.1},{label:'삼성생명',cap:61.5},{label:'삼성물산',cap:59.8}
];
const KRKQ_CAP_DATA=[
  {label:'알테오젠',cap:19.3},{label:'에코프로',cap:11.8},{label:'에코프로비엠',cap:11.6},{label:'주성엔지니어링',cap:10.3},{label:'레인보우로보틱스',cap:8.7},
  {label:'원익IPS',cap:5.8},{label:'이오테크닉스',cap:5.6},{label:'리노공업',cap:5.3},{label:'심텍',cap:5.1},{label:'로보티즈',cap:4.7}
];

function renderMcapChart(){
  const el=document.getElementById('mcap-chart'); if(!el) return;
  const ids=['bitcoin','ethereum','solana','ripple'].map(id=>{
    const c=coinData&&coinData[id];
    const cap=(c&&c.market_cap)?c.market_cap:(COIN_BASE[id]?COIN_BASE[id].mcap:0);
    return {id, cap};
  }).sort((a,b)=>b.cap-a.cap);
  const total=ids.reduce((s,x)=>s+x.cap,0)||1;
  const bars=ids.map(({id,cap})=>{
    const pct=cap/total*100;
    return '<div style="width:'+pct.toFixed(2)+'%;background:'+COIN_COLOR[id]+'" title="'+COIN_LABEL[id]+' '+pct.toFixed(1)+'%"></div>';
  }).join('');
  const legend=ids.map(({id,cap})=>{
    const pct=cap/total*100;
    return '<span style="display:inline-flex;align-items:center;gap:6px;margin-right:16px;font-size:12.5px;color:var(--tx2)">'+
      '<i style="width:10px;height:10px;border-radius:2px;background:'+COIN_COLOR[id]+';display:inline-block"></i>'+
      COIN_LABEL[id]+' '+pct.toFixed(1)+'%</span>';
  }).join('');
  el.innerHTML='<div style="display:flex;height:22px;border-radius:6px;overflow:hidden">'+bars+'</div>'+
    '<div style="margin-top:10px">'+legend+'</div>';
}

/* ================= 미국 데이터: Yahoo Finance 연계 =================
   [중요] Yahoo / CNN 모두 응답에 CORS 허용 헤더를 주지 않으므로
   브라우저에서 직접 호출하면 반드시 차단된다. 아래 PROXY 를 통해 호출한다.
   PROXY_BASE 에 본인 Cloudflare Worker 주소를 넣으면 가장 안정적이며,
   비워두면 공개 프록시를 순차 시도한다(무료 서비스라 간헐적 실패 가능). */
const PROXY_BASE='https://ai.coolzet.workers.dev/?url=';
const PROXIES=[
  u=>PROXY_BASE?PROXY_BASE+encodeURIComponent(u):null,
  u=>'https://api.allorigins.win/raw?url='+encodeURIComponent(u),
  u=>'https://api.codetabs.com/v1/proxy?quest='+encodeURIComponent(u),
  u=>'https://thingproxy.freeboard.io/fetch/'+u
].filter(Boolean);

async function getJSON(url){
  for(const p of PROXIES){
    const target=p(url); if(!target) continue;
    try{
      const c=new AbortController(), t=setTimeout(()=>c.abort(),9000);
      const r=await fetch(target,{signal:c.signal}); clearTimeout(t);
      if(!r.ok) continue;
      const j=await r.json();
      if(j) return j;
    }catch(e){}
  }
  return null;
}
/* Yahoo 일봉 종가 배열 */
async function yclose(sym,range){
  const j=await getJSON('https://query1.finance.yahoo.com/v8/finance/chart/'+
      encodeURIComponent(sym)+'?range='+(range||'1y')+'&interval=1d');
  try{
    const q=j.chart.result[0].indicators.quote[0].close.filter(x=>x!=null);
    return q.length>30?q:null;
  }catch(e){ return null; }
}

/* ================= 시가총액 TOP10 순위 변동 이력 =================
   전월(2026-08-01 스냅샷 기준) 순위 근사치. 운영 시 월간 리포트 작성 때 갱신하세요. */
const RANK_PREV={NVDA:1, AAPL:3, GOOGL:2, MSFT:4, AMZN:5, TSM:7, SPCX:6, AVGO:8, META:10, TSLA:9};
function applyRankHistory(){
  document.querySelectorAll('#cap-tbl tbody tr').forEach(tr=>{
    const t=tr.dataset.t, prev=RANK_PREV[t]; if(!prev)return;
    const rankTd=tr.querySelector('td.mut'); if(!rankTd)return;
    const cur=parseInt(rankTd.textContent,10); if(isNaN(cur))return;
    let arrow='–', color='var(--tx2)';
    if(prev>cur){ arrow='↑'; color='var(--ok)'; }      // 전월보다 순위 상승(개선)
    else if(prev<cur){ arrow='↓'; color='var(--up)'; } // 전월보다 순위 하락
    rankTd.innerHTML=cur+' <span style="font-size:11px;color:'+color+'">('+arrow+prev+')</span>';
  });
}

/* ================= 주식시장 주요 이벤트 (월별, 2026년) =================
   FOMC/CPI/고용보고서/PCE 는 연준·BLS·BEA 공식 발표 일정 기준(2026-09 기준 확인).
   PCE 10~12월은 발표일이 아직 공식 공지되지 않아 통상 일정 기준 추정치입니다. */
const FED_URL='https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm';
const BLS_CPI='https://www.bls.gov/schedule/news_release/cpi.htm';
const BLS_NFP='https://www.bls.gov/schedule/news_release/empsit.htm';
const BEA_PCE='https://www.bea.gov/data/income-saving/personal-income-and-outlays';
const NYSE_CAL='https://nyse.com/trade/hours-calendars';
const SPDJI_URL='https://www.spglobal.com/spdji/en/index-family/us-equity/sp-us-indices/';
const NDX_URL='https://indexes.nasdaq.com/';

const MONTH_EVENTS={
  1:[
    {d:1,t:'신정(New Year\u2019s Day) — 증시 휴장',c:'전일 휴장',g:'h',s:NYSE_CAL,hol:1},
    {d:9,t:'고용보고서(2025년 12월)',c:'경기 체력 점검',g:'h',s:BLS_NFP},
    {d:13,t:'CPI 소비자물가지수(12월)',c:'인플레이션·금리 기대',g:'h',s:BLS_CPI},
    {d:19,t:'MLK Day — 증시 휴장',c:'전일 휴장',g:'h',s:NYSE_CAL,hol:1},
    {d:20,t:'나스닥100 특별 변경: Walmart(WMT) 편입 · AstraZeneca(AZN) 편출',c:'정기 분기 일정 외 특별 리밸런싱',g:'m',s:NDX_URL},
    {d:27,t:'FOMC 회의 1일차',c:'금리 정책 논의',g:'l',s:FED_URL},
    {d:28,t:'FOMC 금리결정 발표',c:'금리 경로, 지수 변동성 최대',g:'h',s:FED_URL}
  ],
  2:[
    {d:11,t:'고용보고서(1월)',c:'경기 체력 점검',g:'h',s:BLS_NFP},
    {d:13,t:'CPI 소비자물가지수(1월)',c:'인플레이션·금리 기대',g:'h',s:BLS_CPI},
    {d:16,t:'Presidents\u2019 Day — 증시 휴장',c:'전일 휴장',g:'h',s:NYSE_CAL,hol:1}
  ],
  3:[
    {d:6,t:'고용보고서(2월)',c:'경기 체력 점검',g:'h',s:BLS_NFP},
    {d:11,t:'CPI 소비자물가지수(2월)',c:'인플레이션·금리 기대',g:'h',s:BLS_CPI},
    {d:13,t:'PCE 물가지수(1월, 지연 발표)',c:'연준 선호 물가지표',g:'m',s:BEA_PCE},
    {d:17,t:'FOMC 회의 1일차',c:'금리 정책 논의',g:'l',s:FED_URL},
    {d:18,t:'FOMC 금리결정 발표 · 점도표(SEP)',c:'분기 경제전망 포함',g:'h',s:FED_URL},
    {d:20,t:'분기 네 마녀의 날(선물·옵션 동시만기)',c:'수급 왜곡, 변동성 확대',g:'m',s:NDX_URL},
    {d:23,t:'S&P500·나스닥100 분기 리밸런싱 효과일',c:'지수 구성 변경분 반영',g:'m',s:SPDJI_URL}
  ],
  4:[
    {d:3,t:'고용보고서(3월)',c:'경기 체력 점검',g:'h',s:BLS_NFP},
    {d:3,t:'Good Friday — 증시 휴장',c:'전일 휴장',g:'h',s:NYSE_CAL,hol:1},
    {d:9,t:'PCE 물가지수(2월, 지연 발표)',c:'연준 선호 물가지표',g:'m',s:BEA_PCE},
    {d:10,t:'CPI 소비자물가지수(3월)',c:'인플레이션·금리 기대',g:'h',s:BLS_CPI},
    {d:28,t:'FOMC 회의 1일차',c:'금리 정책 논의',g:'l',s:FED_URL},
    {d:29,t:'FOMC 금리결정 발표',c:'금리 경로, 지수 변동성 최대',g:'h',s:FED_URL},
    {d:30,t:'PCE 물가지수(3월)',c:'연준 선호 물가지표',g:'m',s:BEA_PCE}
  ],
  5:[
    {d:8,t:'고용보고서(4월)',c:'경기 체력 점검',g:'h',s:BLS_NFP},
    {d:12,t:'CPI 소비자물가지수(4월)',c:'인플레이션·금리 기대',g:'h',s:BLS_CPI},
    {d:25,t:'Memorial Day — 증시 휴장',c:'전일 휴장',g:'h',s:NYSE_CAL,hol:1},
    {d:28,t:'PCE 물가지수(4월)',c:'연준 선호 물가지표',g:'m',s:BEA_PCE}
  ],
  6:[
    {d:5,t:'고용보고서(5월)',c:'경기 체력 점검',g:'h',s:BLS_NFP},
    {d:10,t:'CPI 소비자물가지수(5월)',c:'인플레이션·금리 기대',g:'h',s:BLS_CPI},
    {d:16,t:'FOMC 회의 1일차',c:'금리 정책 논의',g:'l',s:FED_URL},
    {d:17,t:'FOMC 금리결정 발표 · 점도표(SEP)',c:'분기 경제전망 포함',g:'h',s:FED_URL},
    {d:19,t:'분기 네 마녀의 날 · Juneteenth 증시 휴장',c:'변동성 확대 · 전일 휴장',g:'h',s:NYSE_CAL},
    {d:22,t:'S&P500 변경: Marvell(MRVL)·Flex(FLEX) 편입 / Pool Corp(POOL)·Campbell\u2019s(CPB) 편출',c:'분기 리밸런싱',g:'m',s:SPDJI_URL},
    {d:22,t:'나스닥100 변경: Astera Labs·CoreWeave·Nebius·Rocket Lab·Teradyne 편입 / Charter·Cognizant·Insmed·Verisk·Zscaler 편출',c:'분기 리밸런싱',g:'m',s:NDX_URL},
    {d:25,t:'PCE 물가지수(5월)',c:'연준 선호 물가지표',g:'m',s:BEA_PCE}
  ],
  7:[
    {d:2,t:'고용보고서(6월)',c:'경기 체력 점검',g:'h',s:BLS_NFP},
    {d:3,t:'Independence Day(대체휴일) — 증시 휴장',c:'전일 휴장',g:'h',s:NYSE_CAL,hol:1},
    {d:7,t:'나스닥100 특별 편입: SpaceX(SPCX)',c:'IPO 후 15거래일만에 초고속 편입',g:'m',s:NDX_URL},
    {d:14,t:'CPI 소비자물가지수(6월)',c:'인플레이션·금리 기대',g:'h',s:BLS_CPI},
    {d:28,t:'FOMC 회의 1일차',c:'금리 정책 논의',g:'l',s:FED_URL},
    {d:29,t:'FOMC 금리결정 발표',c:'금리 경로, 지수 변동성 최대',g:'h',s:FED_URL},
    {d:30,t:'PCE 물가지수(6월)',c:'연준 선호 물가지표',g:'m',s:BEA_PCE}
  ],
  8:[
    {d:7,t:'고용보고서(7월)',c:'경기 체력 점검',g:'h',s:BLS_NFP},
    {d:12,t:'CPI 소비자물가지수(7월)',c:'인플레이션·금리 기대',g:'h',s:BLS_CPI},
    {d:26,t:'PCE 물가지수(7월)',c:'연준 선호 물가지표',g:'m',s:BEA_PCE}
  ],
  9:[
    {d:4,t:'고용보고서(8월)',c:'경기 체력 점검',g:'h',s:BLS_NFP},
    {d:7,t:'Labor Day — 증시 휴장',c:'전일 휴장',g:'h',s:NYSE_CAL,hol:1},
    {d:11,t:'CPI 소비자물가지수(8월)',c:'인플레이션·금리 기대',g:'h',s:BLS_CPI},
    {d:15,t:'FOMC 회의 1일차',c:'금리 정책 논의',g:'l',s:FED_URL},
    {d:16,t:'FOMC 금리결정 발표 · 점도표(SEP)',c:'분기 경제전망 포함',g:'h',s:FED_URL},
    {d:18,t:'분기 네 마녀의 날(선물·옵션 동시만기)',c:'수급 왜곡, 변동성 확대',g:'m',s:NDX_URL},
    {d:21,t:'S&P500 변경: Bloom Energy(BE)·Everpure(P)·Illumina(ILMN) 편입 / Molson Coors(TAP)·Trade Desk(TTD)·Builders FirstSource(BLDR) 편출',c:'분기 리밸런싱',g:'m',s:SPDJI_URL},
    {d:21,t:'S&P100 변경: Dell(DELL)·Palo Alto Networks(PANW)·Arista(ANET)·SanDisk(SNDK) 편입 / Honeywell Aerospace·Nike(NKE)·Simon Property(SPG)·Colgate(CL) 편출',c:'S&P100 리밸런싱',g:'l',s:SPDJI_URL},
    {d:30,t:'PCE 물가지수(8월)',c:'연준 선호 물가지표',g:'m',s:BEA_PCE}
  ],
  10:[
    {d:2,t:'고용보고서(9월)',c:'경기 체력 점검',g:'h',s:BLS_NFP},
    {d:12,t:'Columbus Day — 채권시장 휴장(주식시장 정상거래)',c:'채권시장만 휴장',g:'l',s:NYSE_CAL,hol:1},
    {d:14,t:'CPI 소비자물가지수(9월)',c:'인플레이션·금리 기대',g:'h',s:BLS_CPI},
    {d:27,t:'FOMC 회의 1일차',c:'금리 정책 논의',g:'l',s:FED_URL},
    {d:28,t:'FOMC 금리결정 발표',c:'금리 경로, 지수 변동성 최대',g:'h',s:FED_URL},
    {d:30,t:'PCE 물가지수(9월, 추정)',c:'연준 선호 물가지표 · 정확한 날짜는 출처 확인',g:'m',s:BEA_PCE}
  ],
  11:[
    {d:6,t:'고용보고서(10월)',c:'경기 체력 점검',g:'h',s:BLS_NFP},
    {d:10,t:'CPI 소비자물가지수(10월)',c:'인플레이션·금리 기대',g:'h',s:BLS_CPI},
    {d:11,t:'Veterans Day — 채권시장 휴장(주식시장 정상거래)',c:'채권시장만 휴장',g:'l',s:NYSE_CAL,hol:1},
    {d:25,t:'PCE 물가지수(10월, 추정)',c:'연준 선호 물가지표 · 정확한 날짜는 출처 확인',g:'m',s:BEA_PCE},
    {d:26,t:'Thanksgiving Day — 증시 휴장',c:'전일 휴장',g:'h',s:NYSE_CAL,hol:1},
    {d:27,t:'추수감사절 다음날 — 조기폐장(오후 1시 ET)',c:'거래시간 단축',g:'m',s:NYSE_CAL,hol:1}
  ],
  12:[
    {d:4,t:'고용보고서(11월)',c:'경기 체력 점검',g:'h',s:BLS_NFP},
    {d:8,t:'FOMC 회의 1일차',c:'금리 정책 논의',g:'l',s:FED_URL},
    {d:9,t:'FOMC 금리결정 발표 · 점도표(SEP) · 올해 마지막 회의',c:'분기 경제전망 포함',g:'h',s:FED_URL},
    {d:10,t:'CPI 소비자물가지수(11월)',c:'인플레이션·금리 기대',g:'h',s:BLS_CPI},
    {d:18,t:'분기 네 마녀의 날(선물·옵션 동시만기)',c:'수급 왜곡, 변동성 확대',g:'m',s:NDX_URL},
    {d:21,t:'나스닥100 연간 재조정 효과일',c:'편입·편출 종목은 12월 중 별도 발표 예정',g:'m',s:NDX_URL},
    {d:23,t:'PCE 물가지수(11월, 추정)',c:'연준 선호 물가지표 · 정확한 날짜는 출처 확인',g:'m',s:BEA_PCE},
    {d:24,t:'크리스마스 이브 — 조기폐장(오후 1시 ET)',c:'거래시간 단축',g:'m',s:NYSE_CAL,hol:1},
    {d:25,t:'Christmas Day — 증시 휴장',c:'전일 휴장',g:'h',s:NYSE_CAL,hol:1}
  ]
};

function renderEvents(m){
  const tbody=document.getElementById('events-tbl'); if(!tbody)return;
  const all=(MONTH_EVENTS[m]||[]).slice().sort((a,b)=>a.d-b.d);
  const arr=all.filter(e=>!e.hol);
  const holidays=all.filter(e=>e.hol);
  if(!arr.length){ tbody.innerHTML='<tr><td class="mut" colspan="5">해당 월 일정 준비 중입니다.</td></tr>'; }
  else{
    const TAGLABEL={h:'최상',m:'중',l:'참고'}, TAGCLASS={h:'t-h',m:'t-m',l:'t-l'};
    tbody.innerHTML=arr.map(e=>{
      const ds='2026-'+String(m).padStart(2,'0')+'-'+String(e.d).padStart(2,'0');
      return '<tr'+(e.g==='h'?' class="ev-hi"':'')+'><td class="mut">'+ds+'</td><td><b>'+e.t+'</b></td><td class="mut">'+e.c+'</td>'+
        '<td><span class="tag '+TAGCLASS[e.g]+'">'+TAGLABEL[e.g]+'</span></td>'+
        '<td class="ev-src"><a href="'+e.s+'" target="_blank" rel="noopener" title="출처 보기">+</a></td></tr>';
    }).join('');
  }
  const htbody=document.getElementById('holidays-tbl');
  if(htbody){
    if(!holidays.length){ htbody.innerHTML='<tr><td class="mut" colspan="3">해당 월 휴장일이 없습니다.</td></tr>'; }
    else{
      htbody.innerHTML=holidays.map(e=>{
        const ds='2026-'+String(m).padStart(2,'0')+'-'+String(e.d).padStart(2,'0');
        const kind=e.c==='전일 휴장'?'휴장':(e.c.indexOf('채권시장')>-1?'채권시장만 휴장':'조기 폐장');
        return '<tr><td class="mut">'+ds+'</td><td><b>'+e.t+'</b></td>'+
          '<td><span class="tag t-close">'+kind+'</span></td></tr>';
      }).join('');
    }
  }
}

/* ================= 한국 주식시장 주요 이벤트 (2026년) =================
   한국은행 기준금리 결정일(8회)은 한국은행 2026년 정기회의 일정 공식 발표 기준.
   코스피200 옵션 만기일은 매월 둘째 목요일(KRX 관행)로 계산. 그 외 세부 지표
   (CPI·고용 등) 발표일은 추후 확인 후 추가 예정. */
const BOK_URL='https://www.bok.or.kr/portal/main/main.do';
const KRX_URL='https://www.krx.co.kr/';
const KR_MONTH_EVENTS={
  1: [{d:15,t:'한국은행 기준금리 결정(금통위)',c:'통화정책방향, 원화자산 변동성 확대',g:'h',s:BOK_URL},
      {d:8, t:'코스피200 옵션 만기일',c:'월간 옵션 동시만기, 단기 변동성 확대',g:'m',s:KRX_URL}],
  2: [{d:26,t:'한국은행 기준금리 결정(금통위)',c:'통화정책방향, 원화자산 변동성 확대',g:'h',s:BOK_URL},
      {d:12,t:'코스피200 옵션 만기일',c:'월간 옵션 동시만기, 단기 변동성 확대',g:'m',s:KRX_URL}],
  3: [{d:12,t:'코스피200 옵션 만기일',c:'월간 옵션 동시만기, 단기 변동성 확대',g:'m',s:KRX_URL}],
  4: [{d:10,t:'한국은행 기준금리 결정(금통위)',c:'통화정책방향, 원화자산 변동성 확대',g:'h',s:BOK_URL},
      {d:9, t:'코스피200 옵션 만기일',c:'월간 옵션 동시만기, 단기 변동성 확대',g:'m',s:KRX_URL}],
  5: [{d:28,t:'한국은행 기준금리 결정(금통위)',c:'통화정책방향, 원화자산 변동성 확대',g:'h',s:BOK_URL},
      {d:14,t:'코스피200 옵션 만기일',c:'월간 옵션 동시만기, 단기 변동성 확대',g:'m',s:KRX_URL}],
  6: [{d:11,t:'코스피200 옵션 만기일',c:'월간 옵션 동시만기, 단기 변동성 확대',g:'m',s:KRX_URL},
      {d:15,t:'코스피200·코스닥150 정기변경 효과일',c:'ETF·인덱스펀드 패시브 수급 변화(2026년 6월 12일 장마감 후 반영 확정)',g:'h',s:KRX_URL}],
  7: [{d:16,t:'한국은행 기준금리 결정(금통위)',c:'통화정책방향, 원화자산 변동성 확대',g:'h',s:BOK_URL},
      {d:9, t:'코스피200 옵션 만기일',c:'월간 옵션 동시만기, 단기 변동성 확대',g:'m',s:KRX_URL}],
  8: [{d:27,t:'한국은행 기준금리 결정(금통위)',c:'통화정책방향, 원화자산 변동성 확대',g:'h',s:BOK_URL},
      {d:13,t:'코스피200 옵션 만기일',c:'월간 옵션 동시만기, 단기 변동성 확대',g:'m',s:KRX_URL}],
  9: [{d:10,t:'코스피200 옵션 만기일',c:'월간 옵션 동시만기, 단기 변동성 확대',g:'m',s:KRX_URL}],
  10:[{d:22,t:'한국은행 기준금리 결정(금통위)',c:'통화정책방향, 원화자산 변동성 확대',g:'h',s:BOK_URL},
      {d:8, t:'코스피200 옵션 만기일',c:'월간 옵션 동시만기, 단기 변동성 확대',g:'m',s:KRX_URL}],
  11:[{d:26,t:'한국은행 기준금리 결정(금통위)',c:'통화정책방향, 원화자산 변동성 확대',g:'h',s:BOK_URL},
      {d:12,t:'코스피200 옵션 만기일',c:'월간 옵션 동시만기, 단기 변동성 확대',g:'m',s:KRX_URL}],
  12:[{d:10,t:'코스피200 옵션 만기일',c:'월간 옵션 동시만기, 단기 변동성 확대',g:'m',s:KRX_URL},
      {d:11,t:'코스피200·코스닥150 정기변경(예상)',c:'ETF·인덱스펀드 패시브 수급 변화 · 정확한 반영일은 KRX 공지 확인 필요',g:'m',s:KRX_URL}]
};
/* KRX 공식 2026년 휴장일 (설날·추석 연휴, 대체공휴일, 근로자의 날, 연말 휴장 등 포함) */
const KR_HOLIDAYS={
  1: [{d:1, t:'신정'}],
  2: [{d:16,t:'설날 연휴'},{d:17,t:'설날'},{d:18,t:'설날 연휴'}],
  3: [{d:2, t:'삼일절 대체공휴일'}],
  5: [{d:1, t:'근로자의 날'},{d:5,t:'어린이날'},{d:25,t:'부처님오신날 대체공휴일'}],
  6: [{d:3, t:'전국동시지방선거'}],
  7: [{d:17,t:'제헌절'}],
  8: [{d:17,t:'광복절 대체공휴일'}],
  9: [{d:24,t:'추석 연휴'},{d:25,t:'추석'}],
  10:[{d:5, t:'개천절 대체공휴일'},{d:9,t:'한글날'}],
  12:[{d:25,t:'성탄절'},{d:31,t:'연말 휴장'}]
};
function renderKrEvents(m){
  const tbody=document.getElementById('kr-events-tbl');
  if(tbody){
    const arr=(KR_MONTH_EVENTS[m]||[]).slice().sort((a,b)=>a.d-b.d);
    if(!arr.length){ tbody.innerHTML='<tr><td class="mut" colspan="5">해당 월 일정이 없습니다.</td></tr>'; }
    else{
      const TAGLABEL={h:'최상',m:'중',l:'참고'}, TAGCLASS={h:'t-h',m:'t-m',l:'t-l'};
      tbody.innerHTML=arr.map(e=>{
        const ds='2026-'+String(m).padStart(2,'0')+'-'+String(e.d).padStart(2,'0');
        return '<tr'+(e.g==='h'?' class="ev-hi"':'')+'><td class="mut">'+ds+'</td><td><b>'+e.t+'</b></td><td class="mut">'+e.c+'</td>'+
          '<td><span class="tag '+TAGCLASS[e.g]+'">'+TAGLABEL[e.g]+'</span></td>'+
          '<td class="ev-src"><a href="'+e.s+'" target="_blank" rel="noopener" title="출처 보기">+</a></td></tr>';
      }).join('');
    }
  }
  const htbody=document.getElementById('kr-holidays-tbl');
  if(htbody){
    const hs=(KR_HOLIDAYS[m]||[]).slice().sort((a,b)=>a.d-b.d);
    if(!hs.length){ htbody.innerHTML='<tr><td class="mut" colspan="3">해당 월 휴장일이 없습니다.</td></tr>'; }
    else{
      htbody.innerHTML=hs.map(e=>{
        const ds='2026-'+String(m).padStart(2,'0')+'-'+String(e.d).padStart(2,'0');
        return '<tr><td class="mut">'+ds+'</td><td><b>'+e.t+'</b></td><td><span class="tag t-close">휴장</span></td></tr>';
      }).join('');
    }
  }
}

/* ================= 가상화폐 이벤트 (2026년, 날짜 특정 가능한 것만) =================
   FOMC는 미국 주식 이벤트와 동일 일정(위험자산 전반에 영향) · 옵션 만기는 디리비트
   매월 마지막 금요일 관행으로 계산. 그 외 ETF 자금 흐름·업그레이드 등 '수시' 이벤트는
   특정 날짜가 없어 별도의 상시 모니터링 표로 분리했습니다. */
const DERIBIT_URL='https://www.deribit.com/options';
const CRYPTO_MONTH_EVENTS={
  1: [{d:28,t:'FOMC · 미국 금리 결정',c:'위험자산 유동성 전반(암호화폐 포함)',g:'h',s:FED_URL},
      {d:30,t:'옵션 만기(디리비트)',c:'단기 변동성 확대',g:'m',s:DERIBIT_URL}],
  2: [{d:27,t:'옵션 만기(디리비트)',c:'단기 변동성 확대',g:'m',s:DERIBIT_URL}],
  3: [{d:18,t:'FOMC · 미국 금리 결정 · 점도표(SEP)',c:'위험자산 유동성 전반(암호화폐 포함)',g:'h',s:FED_URL},
      {d:27,t:'옵션 만기(디리비트)',c:'단기 변동성 확대',g:'m',s:DERIBIT_URL}],
  4: [{d:24,t:'옵션 만기(디리비트)',c:'단기 변동성 확대',g:'m',s:DERIBIT_URL},
      {d:29,t:'FOMC · 미국 금리 결정',c:'위험자산 유동성 전반(암호화폐 포함)',g:'h',s:FED_URL}],
  5: [{d:29,t:'옵션 만기(디리비트)',c:'단기 변동성 확대',g:'m',s:DERIBIT_URL}],
  6: [{d:17,t:'FOMC · 미국 금리 결정 · 점도표(SEP)',c:'위험자산 유동성 전반(암호화폐 포함)',g:'h',s:FED_URL},
      {d:26,t:'옵션 만기(디리비트)',c:'단기 변동성 확대',g:'m',s:DERIBIT_URL}],
  7: [{d:29,t:'FOMC · 미국 금리 결정',c:'위험자산 유동성 전반(암호화폐 포함)',g:'h',s:FED_URL},
      {d:31,t:'옵션 만기(디리비트)',c:'단기 변동성 확대',g:'m',s:DERIBIT_URL}],
  8: [{d:28,t:'옵션 만기(디리비트)',c:'단기 변동성 확대',g:'m',s:DERIBIT_URL}],
  9: [{d:16,t:'FOMC · 미국 금리 결정 · 점도표(SEP)',c:'위험자산 유동성 전반(암호화폐 포함)',g:'h',s:FED_URL},
      {d:25,t:'옵션 만기(디리비트)',c:'단기 변동성 확대',g:'m',s:DERIBIT_URL}],
  10:[{d:28,t:'FOMC · 미국 금리 결정',c:'위험자산 유동성 전반(암호화폐 포함)',g:'h',s:FED_URL},
      {d:30,t:'옵션 만기(디리비트)',c:'단기 변동성 확대',g:'m',s:DERIBIT_URL}],
  11:[{d:27,t:'옵션 만기(디리비트)',c:'단기 변동성 확대',g:'m',s:DERIBIT_URL}],
  12:[{d:9, t:'FOMC · 미국 금리 결정 · 점도표(SEP) · 올해 마지막 회의',c:'위험자산 유동성 전반(암호화폐 포함)',g:'h',s:FED_URL},
      {d:25,t:'옵션 만기(디리비트)',c:'단기 변동성 확대 · 크리스마스와 겹침(암호화폐 시장은 24시간 운영)',g:'m',s:DERIBIT_URL}]
};
function renderCryptoEvents(m){
  const tbody=document.getElementById('crypto-events-tbl'); if(!tbody)return;
  const arr=(CRYPTO_MONTH_EVENTS[m]||[]).slice().sort((a,b)=>a.d-b.d);
  if(!arr.length){ tbody.innerHTML='<tr><td class="mut" colspan="5">해당 월 일정이 없습니다.</td></tr>'; return; }
  const TAGLABEL={h:'최상',m:'중',l:'참고'}, TAGCLASS={h:'t-h',m:'t-m',l:'t-l'};
  tbody.innerHTML=arr.map(e=>{
    const ds='2026-'+String(m).padStart(2,'0')+'-'+String(e.d).padStart(2,'0');
    return '<tr'+(e.g==='h'?' class="ev-hi"':'')+'><td class="mut">'+ds+'</td><td><b>'+e.t+'</b></td><td class="mut">'+e.c+'</td>'+
      '<td><span class="tag '+TAGCLASS[e.g]+'">'+TAGLABEL[e.g]+'</span></td>'+
      '<td class="ev-src"><a href="'+e.s+'" target="_blank" rel="noopener" title="출처 보기">+</a></td></tr>';
  }).join('');
}

/* ---- 네트워크 실패 시 사용할 실측 기준값 (Yahoo Finance 최근 종가 기준) ----
   운영 시 주간 리포트 작성할 때 함께 갱신하면 폴백 정확도가 유지됩니다. */
const BASE={
  QLD :{px:90.68, d:0.33,  w:0.57,  m:0.61,  y:43.30},
  USD :{px:88.80, d:4.26,  w:7.22,  m:-1.92, y:111.66},
  SCHD:{px:34.80, d:-0.80, w:-0.29, m:3.26,  y:25.90},
  /* 시가총액 TOP10 (2026-09-04 스냅샷 기준, w=최근 7일 추세 근사) */
  NVDA :{px:230.36, d:1.20,  w:5.90,  m:12.0, y:45.0},
  AAPL :{px:319.97, d:0.10,  w:0.10,  m:2.0,  y:15.0},
  GOOGL:{px:338.46, d:-0.50, w:-2.40, m:-3.0, y:25.0},
  MSFT :{px:499.70, d:-0.50, w:-2.70, m:-1.0, y:10.0},
  AMZN :{px:258.51, d:-0.60, w:-3.00, m:-2.0, y:8.0},
  TSM  :{px:428.91, d:0.50,  w:2.70,  m:5.0,  y:30.0},
  SPCX :{px:147.94, d:1.00,  w:4.60,  m:8.0,  y:30.0},
  AVGO :{px:357.89, d:-0.60, w:-3.00, m:-2.0, y:40.0},
  META :{px:616.77, d:1.30,  w:6.70,  m:10.0, y:20.0},
  TSLA :{px:354.08, d:0.30,  w:1.50,  m:5.0,  y:60.0},
  /* 레버리지 ETF (변동성이 매우 커서 근사치 · 운영 시 자주 갱신 필요) */
  TQQQ:{px:63.99,  d:-3.48,  w:-5.24,  m:-12.70, y:45.70},
  UPRO:{px:136.38, d:0.08,   w:-1.51,  m:1.22,   y:38.87},
  UDOW:{px:67.30,  d:-3.01,  w:-2.0,   m:1.0,    y:25.0},
  TECL:{px:185.50, d:-3.03,  w:-5.0,   m:-10.0,  y:50.0},
  BULZ:{px:29.59,  d:1.93,   w:-5.0,   m:14.35,  y:58.03},
  SOXL:{px:136.79, d:-13.15, w:0.97,   m:-40.41, y:430.61},
  KORU:{px:23.47,  d:13.44,  w:20.0,   m:40.16,  y:425.11},
  /* 코스피 시가총액 TOP10 (2026-09-11 기준 실측 스냅샷, w/m/y는 일간 등락률 기준 근사) */
  '005930.KS':{px:259500, d:-3.53, w:-3.53, m:-3.53, y:0},
  '000660.KS':{px:1812000,d:-2.21, w:-2.21, m:-2.21, y:0},
  '402340.KS':{px:1089000,d:-4.05, w:-4.05, m:-4.05, y:0},
  '009150.KS':{px:1400000,d:0,     w:0,     m:0,     y:0},
  '005380.KS':{px:382500, d:-1.67, w:-1.67, m:-1.67, y:0},
  '373220.KS':{px:360000, d:-1.37, w:-1.37, m:-1.37, y:0},
  '207940.KS':{px:1415000,d:-0.56, w:-0.56, m:-0.56, y:0},
  '105560.KS':{px:177900, d:2.60,  w:2.60,  m:2.60,  y:0},
  '032830.KS':{px:307500, d:-0.65, w:-0.65, m:-0.65, y:0},
  '028260.KS':{px:367000, d:-3.29, w:-3.29, m:-3.29, y:0},
  /* 코스닥 시가총액 TOP10 (2026-09-10 기준 실측 스냅샷, w/m/y는 일간 등락률 기준 근사) */
  '196170.KQ':{px:277000, d:-0.89, w:-0.89, m:-0.89, y:0},
  '086520.KQ':{px:86900,  d:0.12,  w:0.12,  m:0.12,  y:0},
  '247540.KQ':{px:118700, d:3.31,  w:3.31,  m:3.31,  y:0},
  '036930.KQ':{px:221000, d:7.02,  w:7.02,  m:7.02,  y:0},
  '277810.KQ':{px:449000, d:0.79,  w:0.79,  m:0.79,  y:0},
  '240810.KQ':{px:118800, d:-1.08, w:-1.08, m:-1.08, y:0},
  '039030.KQ':{px:455000, d:-3.19, w:-3.19, m:-3.19, y:0},
  '058470.KQ':{px:69300,  d:-1.14, w:-1.14, m:-1.14, y:0},
  '222800.KQ':{px:133900, d:0.98,  w:0.98,  m:0.98,  y:0},
  '108490.KQ':{px:323500, d:4.35,  w:4.35,  m:4.35,  y:0}
};
/* ================= 미국 공포탐욕지수: CNN 공식 데이터 =================
   CNN 페이지가 실제로 읽는 내부 엔드포인트를 그대로 사용한다.
     https://production.dataviz.cnn.io/index/fearandgreed/graphdata
   단, 이 엔드포인트는 Referer/Origin 헤더가 cnn.com 이 아니면
   HTTP 418("You're a bot") 로 차단한다. 공개 프록시는 이 헤더를 붙여주지
   못하므로, 반드시 함께 제공된 cors-proxy-worker.js 를 배포하고
   위쪽 PROXY_BASE 에 그 주소를 넣어야 공식 수치가 표시된다. */
const CNN_URL='https://production.dataviz.cnn.io/index/fearandgreed/graphdata';

/* 프록시 미설정/실패 시 표시할 CNN 실측 스냅샷 (2026-09-10 기준 — 라이브 연동 실패 시에만 사용) */
const FG_BASE={d:33.3, w:47.5, m:64.4, y:57.9, prev:38.2, official:true};
const FG_BARS=[65,64,60,62,66,64,59,55,57,51,55,55,60,54,57,54,49,45,46,48,45,39,38,33];
/* CNN 7개 세부지표 스냅샷 */
const FG_SUB=[['시장 모멘텀',36.6],['주가 강도',12.6],['주가 폭',46.4],
              ['풋/콜 옵션',45.2],['시장 변동성',50],['정크본드 수요',76.2],['안전자산 선호',26]];

let FGdata=null;   // CNN 원본 JSON
async function loadUS(){
  FGdata=await getJSON(CNN_URL);
  renderUS(curPer.us);
}
/* 세부지표별 원문(근거 데이터) 출처 */
const SUBSRC={
  '시장 모멘텀':'https://www.spglobal.com/spdji/en/indices/equity/sp-500/',
  '주가 강도':'https://www.wsj.com/market-data/stocks/marketsdiary',
  '주가 폭':'https://www.wsj.com/market-data/stocks/marketsdiary',
  '풋/콜 옵션':'https://www.cboe.com/us/options/market_statistics/daily/',
  '시장 변동성':'https://www.cboe.com/tradable_products/vix/',
  '정크본드 수요':'https://fred.stlouisfed.org/series/BAMLH0A0HYM2',
  '안전자산 선호':'https://fred.stlouisfed.org/series/DGS10'
};
/* CNN 지표 라벨 (공식 구간과 동일하게 매핑) */
function subTable(rows,src){
  const el=$('#us-sub'); if(!el)return;
  el.innerHTML=rows.map(([n,v])=>{
    const link=SUBSRC[n];
    const label_=link?'<a href="'+link+'" target="_blank" rel="noopener">'+n+' ↗</a>':n;
    return '<tr><td>'+label_+'</td><td class="num">'+v.toFixed(1)+'</td>'+
    '<td class="num"><span class="tag '+(v<45?'t-h':v<=55?'t-l':'t-m')+'">'+label(v)[0]+'</span></td></tr>';
  }).join('');
  $('#us-src').textContent=src;
}
function renderUS(p){
  $('#us-per').textContent='· '+PERKO[p];
  if(!FGdata){                                    // 폴백 (CNN 실측 스냅샷)
    const v=FG_BASE[p];
    paint('us',v,'전일 '+FG_BASE.prev.toFixed(0)+'점 → 현재 '+FG_BASE.d.toFixed(0)+'점');
    /* 폴백도 기간 탭에 따라 다른 근사 곡선을 보여준다 */
    const fbSeries={d:[FG_BASE.prev,FG_BASE.d], w:[FG_BASE.m,FG_BASE.w,FG_BASE.d],
                     m:[FG_BASE.y,FG_BASE.m,FG_BASE.w,FG_BASE.d], y:[FG_BASE.y,FG_BASE.m,FG_BASE.w,FG_BASE.d]}[p]||FG_BARS;
    bars('us', fbSeries.length>1?fbSeries:FG_BARS);
    subTable(FG_SUB,'CNN 공식 스냅샷 (프록시 미설정 — 실시간 아님)');
    return;
  }
  const f=FGdata.fear_and_greed;
  /* CNN 이 제공하는 기간별 공식 값을 그대로 사용 — 임의 재계산하지 않는다 */
  const v={d:f.score, w:f.previous_1_week, m:f.previous_1_month, y:f.previous_1_year}[p];
  const note={
    d:'전일 종료 '+f.previous_close.toFixed(0)+'점 → 현재 '+f.score.toFixed(0)+'점',
    w:'1주 전 값 · 현재 대비 '+sign(f.score-f.previous_1_week).replace('%','p'),
    m:'1개월 전 값 · 현재 대비 '+sign(f.score-f.previous_1_month).replace('%','p'),
    y:'1년 전 값 · 현재 대비 '+sign(f.score-f.previous_1_year).replace('%','p')
  }[p];
  paint('us',v,note);

  /* 막대·추세선: 주간/월간은 일자별, 연간은 월별로 구분해서 보여준다 */
  const hist=(FGdata.fear_and_greed_historical||{}).data||[];
  const tsToDate=ts=>{ const n=+ts; return new Date(n>1e12?n:n*1000); };
  if(hist.length>0){
    if(p==='y'){
      const byMonth=[], map={};
      hist.forEach(x=>{
        const dt=tsToDate(x.x); const key=dt.getFullYear()+'-'+(dt.getMonth()+1);
        if(!map[key]){ map[key]={sum:0,n:0,label:(dt.getMonth()+1)+'월'}; byMonth.push(map[key]); }
        map[key].sum+=x.y; map[key].n++;
      });
      const last=byMonth.slice(-12);
      const vals=last.map(o=>o.sum/o.n), labels=last.map(o=>o.label);
      bars('us', vals.length>1?vals:FG_BARS, vals.length>1?labels:null, 1);
    }else{
      const WIN={d:10,w:7,m:30}[p]||10;
      const recent=hist.slice(-Math.min(hist.length,WIN));
      const vals=recent.map(x=>x.y);
      const labels=recent.map(x=>{ const dt=tsToDate(x.x); return (dt.getMonth()+1)+'/'+dt.getDate(); });
      const tickEvery=p==='m'?5:1; // 월간은 5일 간격으로 표기(과밀 방지), 막대에 마우스오버하면 날짜별 정확한 값 확인 가능
      bars('us', vals.length>1?vals:FG_BARS, (p==='w'||p==='m')&&vals.length>1?labels:null, tickEvery);
    }
  }else bars('us',FG_BARS);

  /* CNN 7개 세부지표 */
  const M=[['시장 모멘텀','market_momentum_sp125'],['주가 강도','stock_price_strength'],
           ['주가 폭','stock_price_breadth'],['풋/콜 옵션','put_call_options'],
           ['시장 변동성','market_volatility_vix'],['정크본드 수요','junk_bond_demand'],
           ['안전자산 선호','safe_haven_demand']];
  const rows=M.filter(([,k])=>FGdata[k]&&FGdata[k].score!=null)
              .map(([n,k])=>[n,+FGdata[k].score]);
  if(rows.length) subTable(rows,'CNN 공식 실시간 · '+
      new Date(f.timestamp).toLocaleString('ko-KR'));
}

/* ---- 티커 시세: Yahoo Finance (그룹별: tick=QLD·USD·SCHD, cap=시가총액TOP10, lev=레버리지ETF) ---- */
const fmtWon=v=>Math.round(v).toLocaleString('ko-KR');
const TICKGROUPS={
  tick:{table:'tick-tbl', list:['QLD','USD','SCHD']},
  cap: {table:'cap-tbl',  list:['NVDA','AAPL','GOOGL','MSFT','AMZN','TSM','SPCX','AVGO','META','TSLA']},
  lev: {table:'lev-tbl',  list:['TQQQ','UPRO','UDOW','TECL','BULZ','SOXL','KORU']},
  krcap:{table:'krcap-tbl', list:['005930.KS','000660.KS','402340.KS','009150.KS','005380.KS','373220.KS','207940.KS','105560.KS','032830.KS','028260.KS'], cur:'₩', fmt:fmtWon},
  krkq: {table:'krkq-tbl',  list:['196170.KQ','086520.KQ','247540.KQ','036930.KQ','277810.KQ','240810.KQ','039030.KQ','058470.KQ','222800.KQ','108490.KQ'], cur:'₩', fmt:fmtWon}
};
const tickData={};
async function loadTickGroup(g){
  const list=TICKGROUPS[g].list;
  await Promise.all(list.map(async t=>{
    if(tickData[t]===undefined) tickData[t]=await yclose(t,'1y');
  }));
  renderTick(g,curPer[g]);
}
function renderTick(g,p){
  const cfg=TICKGROUPS[g]; if(!cfg)return;
  const cur=cfg.cur||'$', f=cfg.fmt||fmt;
  const n={d:1,w:5,m:21,y:252}[p];
  document.querySelectorAll('#'+cfg.table+' tbody tr').forEach(tr=>{
    const t=tr.dataset.t, d=tickData[t];
    const px=tr.querySelector('.px'), ch=tr.querySelector('.ch'), sp=tr.querySelector('.spark');
    if(!d||d.length<2){
      const b=BASE[t];
      if(!b){ px.textContent='--'; ch.textContent='--'; if(sp) sp.innerHTML=''; return; }
      px.textContent=cur+f(b.px);
      ch.textContent=sign(b[p]); ch.className='num ch chg '+cls(b[p]);
      if(sp) sp.innerHTML=sparkSVG(fallbackSeries(b,p));
      return;
    }
    const last=d[d.length-1];
    const base=(p==='y')?d[0]:d[Math.max(0,d.length-1-n)];
    const v=(last/base-1)*100;
    px.textContent=cur+f(last);
    ch.textContent=sign(v); ch.className='num ch chg '+cls(v);
    if(sp){
      const win={d:10,w:20,m:60,y:252}[p]||15;
      const pts=d.slice(-Math.min(d.length, win));
      sp.innerHTML=sparkSVG(pts);
    }
  });
}

/* ---- 탭 ---- */
document.querySelectorAll('.tabs').forEach(box=>{
  box.addEventListener('click',e=>{
    const b=e.target.closest('button'); if(!b)return;
    box.querySelectorAll('button').forEach(x=>x.classList.remove('on'));
    b.classList.add('on');
    const g=box.dataset.group,p=b.dataset.p;
    curPer[g]=p;
    if(TICKGROUPS[g]) renderTick(g,p);
    else if(g==='us') renderUS(p);
    else if(g==='cf') renderCF(p);
    else if(g==='coin') renderCoin(p);
  });
});

/* ===================== 매매김군 백테스트 엔진 =====================
   실제 Yahoo 종가·배당 데이터와 CNN 공포탐욕지수 히스토리로 계산합니다(가상 수치 아님).
   PROXY_BASE 미설정 시 이 데이터들도 연동에 실패할 수 있습니다. */
const TRADE_TICKERS=['QLD','USD','SCHD'];
const BACKTEST_START_TS=Math.floor(new Date('2026-01-01T00:00:00Z').getTime()/1000);

/* ===================== 한국지수 공포탐욕지수 =====================
   미국지수와 동일한 CNN 7개 세부지표 방식으로 설계했으나, 시장 모멘텀(1번)만
   무료 공개 데이터(Yahoo KOSPI)로 계산 가능합니다. 나머지 6개(주가 강도·주가 폭·
   풋/콜옵션·VKOSPI·안전자산 수요·정크본드 수요)는 KRX 정보데이터시스템·KOFIA
   채권정보센터의 시장 전체 통계·파생상품·채권 유통수익률 데이터가 필요한데,
   이 데이터들은 무료로 CORS 연동 가능한 공개 API가 없어(회원가입 후 유상 제공
   또는 화면 스크래핑만 가능) 실시간 연동이 불가능합니다. 정확성을 위해 이 6개는
   가짜 수치를 만들지 않고 '준비중'으로 명시합니다. */
async function loadKR(){
  const closes=await yclose('^KS11','1y');
  if(!closes || closes.length<126){ renderKR(null); return; }
  const last=closes[closes.length-1];
  const ma125=closes.slice(-125).reduce((a,b)=>a+b,0)/125;
  const ratio=(last-ma125)/ma125;
  const clipped=Math.max(-0.15,Math.min(0.15,ratio));
  const score=((clipped+0.15)/0.30)*100;
  renderKR({score, last, ma125, ratio});
}
function renderKR(d){
  const valEl=document.getElementById('kr-val'), stateEl=document.getElementById('kr-state'),
        dialEl=document.getElementById('kr-dial'), detailEl=document.getElementById('kr-detail');
  if(!d){
    if(stateEl) stateEl.textContent='연동 실패';
    if(detailEl) detailEl.textContent='코스피(^KS11) 데이터를 가져오지 못했습니다 · PROXY_BASE 설정을 확인해주세요.';
    renderKRSub(null);
    return;
  }
  const [t,c]=label(d.score);
  if(valEl) valEl.textContent=Math.round(d.score);
  if(stateEl){ stateEl.textContent=t; stateEl.style.color=c; }
  if(dialEl){ dialEl.style.setProperty('--p',d.score+'%'); dialEl.style.setProperty('--g',c); }
  if(detailEl) detailEl.textContent='코스피 '+d.last.toFixed(1)+' · 125일 이동평균 '+d.ma125.toFixed(1)+
      ' · 이격도 '+(d.ratio*100>=0?'+':'')+(d.ratio*100).toFixed(1)+'%';
  renderKRSub(d.score);
}
function renderKRSub(momentumScore){
  const el=document.getElementById('kr-sub'); if(!el) return;
  const rows=[
    ['1. 시장 모멘텀 (코스피 vs 125일 이평)', momentumScore],
    ['2. 주가 강도 (52주 신고가/신저가 비율)', null],
    ['3. 주가 폭 (상승/하락 거래량 비율)', null],
    ['4. 풋/콜 옵션 비율 (KOSPI200)', null],
    ['5. 시장 변동성 (VKOSPI)', null],
    ['6. 안전자산 수요 (코스피 vs 국고채)', null],
    ['7. 정크본드 수요 (AA-/BBB- 스프레드)', null]
  ];
  el.innerHTML=rows.map(([n,v])=>{
    if(v==null) return '<tr><td>'+n+'</td><td class="num mut">--</td><td class="num"><span class="tag t-l">준비중</span></td></tr>';
    const [t,c]=label(v);
    return '<tr><td>'+n+'</td><td class="num">'+v.toFixed(1)+'</td>'+
      '<td class="num"><span class="tag '+(v<45?'t-h':v<=55?'t-l':'t-m')+'">'+t+'</span></td></tr>';
  }).join('');
}

/* 현재 기준 USD/KRW 환율 (Yahoo KRW=X) — 백테스트 원금·배당금 원화 병기용 */
let usdKrwRate=null;
async function loadFxRate(){
  const closes=await yclose('KRW=X','3mo');
  if(closes && closes.length) usdKrwRate=closes[closes.length-1];
}
function fmtKRW(usd){
  if(usdKrwRate==null) return null;
  return '₩'+Math.round(usd*usdKrwRate).toLocaleString('ko-KR');
}

async function yDailySeries(sym){
  const j=await getJSON('https://query1.finance.yahoo.com/v8/finance/chart/'+encodeURIComponent(sym)+
      '?period1='+BACKTEST_START_TS+'&period2='+Math.floor(Date.now()/1000)+'&interval=1d&events=div');
  try{
    const r=j.chart.result[0];
    const ts=r.timestamp||[];
    const closes=r.indicators.quote[0].close;
    const series=[];
    for(let i=0;i<ts.length;i++){ if(closes[i]!=null) series.push({t:ts[i]*1000, close:closes[i]}); }
    const divRaw=(r.events&&r.events.dividends)||{};
    const dividends=Object.values(divRaw).map(d=>({t:d.date*1000, amount:d.amount}));
    if(!series.length) return null;
    return {series, dividends};
  }catch(e){ return null; }
}
async function fgDailyHistory(){
  const j=await getJSON(CNN_URL);
  try{
    const hist=(j.fear_and_greed_historical||{}).data||[];
    const out=hist.map(x=>({t:(+x.x)>1e12?+x.x:(+x.x)*1000, score:+x.y})).sort((a,b)=>a.t-b.t);
    return out.length?out:null;
  }catch(e){ return null; }
}

async function runTradeBacktest(){
  const [qld,usd,schd,fg]=await Promise.all([
    yDailySeries('QLD'), yDailySeries('USD'), yDailySeries('SCHD'), fgDailyHistory()
  ]);
  const missing=[];
  if(!qld) missing.push('QLD 시세(Yahoo)');
  if(!usd) missing.push('USD 시세(Yahoo)');
  if(!schd) missing.push('SCHD 시세(Yahoo)');
  if(!fg) missing.push('공포탐욕지수 히스토리(CNN)');
  if(missing.length) return {error:missing};

  const data={QLD:qld, USD:usd, SCHD:schd};
  const tradingTs=qld.series.map(p=>p.t).slice().sort((a,b)=>a-b);
  if(!tradingTs.length) return {error:['QLD 시세(거래일 없음)']};

  const priceMap={};
  TRADE_TICKERS.forEach(t=>{ priceMap[t]={}; data[t].series.forEach(p=>{ priceMap[t][p.t]=p.close; }); });

  const divMap={};
  TRADE_TICKERS.forEach(t=>{
    divMap[t]={};
    data[t].dividends.forEach(d=>{
      let mapped=tradingTs.find(ts=>ts>=d.t);
      if(mapped==null) mapped=tradingTs[tradingTs.length-1];
      divMap[t][mapped]=(divMap[t][mapped]||0)+d.amount;
    });
  });

  function scoreAt(ts){
    let ans=fg.length?fg[0].score:50;
    for(let i=0;i<fg.length;i++){ if(fg[i].t<=ts) ans=fg[i].score; else break; }
    return ans;
  }

  /* 매주 금요일(휴장이면 다음 거래일) 매수일 집합 */
  const fridayBuyDays=new Set();
  {
    const f=new Date(BACKTEST_START_TS*1000);
    while(f.getUTCDay()!==5) f.setUTCDate(f.getUTCDate()+1);
    const lastTs=tradingTs[tradingTs.length-1];
    let guard=0;
    while(f.getTime()<=lastTs && guard<300){
      const target=f.getTime();
      const buy=tradingTs.find(ts=>ts>=target);
      if(buy!=null) fridayBuyDays.add(buy);
      f.setUTCDate(f.getUTCDate()+7);
      guard++;
    }
  }

  let shares={QLD:0,USD:0,SCHD:0};
  let cumCost=0, cumDividend=0, buyCount=0;
  const monthly={};
  const curve=[];
  let prevMonthKey=null, monthStartValue=0, monthStartCost=0;

  tradingTs.forEach(ts=>{
    const d=new Date(ts);
    const mk=d.getUTCFullYear()+'-'+String(d.getUTCMonth()+1).padStart(2,'0');
    if(mk!==prevMonthKey){
      monthly[mk]={buys:0, dividends:0, startValue:monthStartValue, startCost:monthStartCost, endValue:0, endCost:0, peak:monthStartValue||0, mdd:0};
      prevMonthKey=mk;
    }
    TRADE_TICKERS.forEach(t=>{
      const dv=divMap[t][ts];
      if(dv && shares[t]>0){ const amt=dv*shares[t]; cumDividend+=amt; monthly[mk].dividends+=amt; }
    });
    const score=scoreAt(ts);
    let qty=0;
    if(score<25) qty=4;
    else if(fridayBuyDays.has(ts)){
      if(score<45) qty=2;
      else if(score<=55) qty=1;
      else qty=0;
    }
    if(qty>0){
      let bought=false;
      TRADE_TICKERS.forEach(t=>{
        const px=priceMap[t][ts]; if(px==null) return;
        shares[t]+=qty; cumCost+=px*qty; bought=true;
      });
      if(bought){ buyCount++; monthly[mk].buys++; }
    }
    let value=0;
    TRADE_TICKERS.forEach(t=>{ const px=priceMap[t][ts]; if(px!=null) value+=shares[t]*px; });
    curve.push({t:ts, cost:cumCost, value});
    const mObj=monthly[mk];
    mObj.endValue=value; mObj.endCost=cumCost;
    mObj.peak=Math.max(mObj.peak,value);
    if(mObj.peak>0){ const dd=(mObj.peak-value)/mObj.peak; if(dd>mObj.mdd) mObj.mdd=dd; }
    monthStartValue=value; monthStartCost=cumCost;
  });

  /* 다음 예상 배당: 종목별 최근 두 배당의 간격·금액과 현재 보유 수량으로 단순 추정 */
  let nextDiv=null;
  TRADE_TICKERS.forEach(t=>{
    const divs=data[t].dividends.slice().sort((a,b)=>a.t-b.t);
    if(divs.length<2 || shares[t]<=0) return;
    const last=divs[divs.length-1], prev=divs[divs.length-2];
    const interval=last.t-prev.t;
    if(interval<=0) return;
    const nextDate=last.t+interval;
    const nextAmt=last.amount*shares[t];
    if(!nextDiv || nextDate<nextDiv.date) nextDiv={date:nextDate, amount:nextAmt, ticker:t};
    else if(nextDiv && Math.abs(nextDate-nextDiv.date)<3*86400000) nextDiv.amount+=nextAmt; // 비슷한 시기면 합산
  });

  return {curve, monthly, buyCount, cumDividend, finalCost:cumCost, finalValue:curve.length?curve[curve.length-1].value:0, nextDiv};
}

function fmtUSD(n){ return '$'+Math.round(n).toLocaleString('en-US'); }

function renderBacktest(res){
  const statusEl=document.getElementById('bt-status');
  if(!res || res.error || !res.curve || !res.curve.length){
    const reason=(res&&res.error)?res.error.join(', ')+' 연동 실패':'알 수 없는 오류';
    if(statusEl) statusEl.textContent='⚠ '+reason+' — PROXY_BASE에 설정한 Worker 주소가 살아있는지, 코드가 정확히 배포됐는지 확인해주세요.';
    return;
  }
  if(statusEl) statusEl.textContent='2026-01-01 ~ '+new Date(res.curve[res.curve.length-1].t).toLocaleDateString('ko-KR')+' 실제 시세 기준 계산 결과입니다.';

  const bc=document.getElementById('bt-buycount'); if(bc) bc.textContent=res.buyCount+'회';
  const costEl=document.getElementById('bt-cost'); if(costEl) costEl.textContent=fmtUSD(res.finalCost);
  const costKrwEl=document.getElementById('bt-cost-krw');
  if(costKrwEl){ const krw=fmtKRW(res.finalCost); costKrwEl.textContent=krw?'원화 환산 '+krw:'환율 연동 실패로 원화 환산 불가'; }
  const dv=document.getElementById('bt-dividend'); if(dv) dv.textContent=fmtUSD(res.cumDividend);
  const dvKrwEl=document.getElementById('bt-dividend-krw');
  if(dvKrwEl){ const krw=fmtKRW(res.cumDividend); dvKrwEl.textContent=(krw?'원화 환산 '+krw+' · ':'')+'보유 종목 합산, 세전 기준'; }
  const roi=res.finalCost>0?(res.finalValue/res.finalCost-1)*100:0;
  const roiEl=document.getElementById('bt-roi');
  if(roiEl){
    roiEl.textContent=(roi>=0?'+':'')+roi.toFixed(1)+'%';
    roiEl.className='big '+(roi>=0?'up':'down');
  }
  const roiSub=document.getElementById('bt-roi-sub');
  if(roiSub) roiSub.textContent='원금 '+fmtUSD(res.finalCost)+' · 평가금 '+fmtUSD(res.finalValue);

  /* 현재 평가수익금 = 평가금 - 누적원금 */
  const profitAmt=res.finalValue-res.finalCost;
  const profitEl=document.getElementById('bt-profit');
  if(profitEl){
    profitEl.textContent=(profitAmt>=0?'+':'-')+fmtUSD(Math.abs(profitAmt));
    profitEl.className='big '+(profitAmt>=0?'up':'down');
  }
  const profitKrwEl=document.getElementById('bt-profit-krw');
  if(profitKrwEl){
    const krw=fmtKRW(Math.abs(profitAmt));
    profitKrwEl.textContent=krw?'원화 환산 '+(profitAmt>=0?'+':'-')+krw:'평가금 - 누적원금';
  }

  /* 수익률 곡선 SVG */
  const curveEl=document.getElementById('bt-curve');
  if(curveEl){
    const w=700,h=220,pad=30;
    const all=res.curve.map(p=>p.cost).concat(res.curve.map(p=>p.value));
    const min=Math.min(...all,0), max=Math.max(...all,1);
    const n=res.curve.length;
    const stepX=n>1?(w-2*pad)/(n-1):0;
    const yOf=v=>h-pad-((v-min)/((max-min)||1))*(h-2*pad);
    const ptsCost=res.curve.map((p,i)=>[pad+i*stepX,yOf(p.cost)]);
    const ptsVal=res.curve.map((p,i)=>[pad+i*stepX,yOf(p.value)]);
    const pathOf=pts=>pts.map((p,i)=>(i===0?'M':'L')+p[0].toFixed(1)+','+p[1].toFixed(1)).join(' ');
    const profit=res.finalValue>=res.finalCost;
    const areaPath=ptsVal.length?pathOf(ptsVal)+' L'+ptsVal[ptsVal.length-1][0].toFixed(1)+','+(h-pad)+
        ' L'+ptsVal[0][0].toFixed(1)+','+(h-pad)+' Z':'';
    curveEl.innerHTML=
      '<svg viewBox="0 0 '+w+' '+h+'" style="width:100%;height:220px;display:block">'+
      '<path d="'+areaPath+'" fill="'+(profit?'rgba(255,77,79,.12)':'rgba(61,157,255,.12)')+'" stroke="none"/>'+
      '<path d="'+pathOf(ptsCost)+'" fill="none" stroke="var(--tx2)" stroke-width="1.5" stroke-dasharray="4 3"/>'+
      '<path d="'+pathOf(ptsVal)+'" fill="none" stroke="'+(profit?'var(--up)':'var(--down)')+'" stroke-width="2.2"/>'+
      '</svg>'+
      '<div class="mut" style="margin-top:6px;font-size:12px">점선: 누적 원금 · 굵은 선: 평가금('+(profit?'수익 구간 강조':'손실 구간 강조')+')</div>';
  }

  /* 월별 매매기록: 투입원금·누적원금·매수횟수·MDD·월 수익금·월 수익률·연환산 순 */
  const months=Object.keys(res.monthly).sort();
  const trEl=document.getElementById('bt-monthly-return');
  if(trEl){
    trEl.innerHTML=months.map(mk=>{
      const m=res.monthly[mk];
      const contrib=m.endCost-m.startCost;
      const denom=m.startValue+contrib;
      const profitYen=m.endValue-m.startValue-contrib;
      const mret=denom>0?profitYen/denom:0;
      const ann=(Math.pow(1+mret,12)-1)*100;
      const mddPct=(m.mdd||0)*100;
      return '<tr><td>'+mk+'</td>'+
        '<td class="num">'+fmtUSD(contrib)+'</td>'+
        '<td class="num">'+fmtUSD(m.endCost)+'</td>'+
        '<td class="num">'+m.buys+'회</td>'+
        '<td class="num down">-'+mddPct.toFixed(1)+'%</td>'+
        '<td class="num '+(profitYen>=0?'up':'down')+'">'+(profitYen>=0?'+':'-')+fmtUSD(Math.abs(profitYen))+'</td>'+
        '<td class="num '+(mret>=0?'up':'down')+'">'+(mret*100>=0?'+':'')+(mret*100).toFixed(2)+'%</td>'+
        '<td class="num '+(ann>=0?'up':'down')+'">'+(ann>=0?'+':'')+ann.toFixed(1)+'%</td></tr>';
    }).join('');
  }

  /* 월별 배당금: 배당이 있었던 달만 표시, 누적 배당금 병기 */
  const divEl=document.getElementById('bt-monthly-div');
  if(divEl){
    const divMonths=months.filter(mk=>res.monthly[mk].dividends>0);
    let running=0;
    divEl.innerHTML=divMonths.length?divMonths.map(mk=>{
      const m=res.monthly[mk];
      running+=m.dividends;
      return '<tr><td>'+mk+'</td><td class="num">'+fmtUSD(m.dividends)+'</td><td class="num">'+fmtUSD(running)+'</td></tr>';
    }).join(''):'<tr><td class="mut" colspan="3">배당이 발생한 달이 없습니다.</td></tr>';
  }

  /* 다음 예상 배당 */
  const nextDivEl=document.getElementById('bt-next-div');
  if(nextDivEl){
    if(res.nextDiv){
      const d=new Date(res.nextDiv.date);
      nextDivEl.textContent='예상 배당시기: '+d.toLocaleDateString('ko-KR')+' 경 · 예상 배당금: '+fmtUSD(res.nextDiv.amount);
    }else{
      nextDivEl.textContent='배당 이력이 부족해 다음 배당을 추정할 수 없습니다.';
    }
  }
}

async function loadTradeBacktest(){
  const [res]=await Promise.all([runTradeBacktest(), loadFxRate()]);
  renderBacktest(res);
}


/* ---- 네이버포인트 선물하기: 아이디를 직접 지정하는 공개 링크가 없어(네이버페이 앱 내 검색으로만 선물 가능),
   버튼 클릭 시 아이디를 클립보드에 복사해주는 방식으로 구현 ---- */
const naverBtn=document.getElementById('naver-gift-btn');
if(naverBtn){
  naverBtn.addEventListener('click',async()=>{
    const id='coolzet';
    try{ await navigator.clipboard.writeText(id); }catch(e){}
    const orig=naverBtn.textContent;
    naverBtn.textContent='ID 복사됨: '+id;
    setTimeout(()=>{ naverBtn.textContent=orig; },1800);
  });
}

/* ---- 에잇퍼센트 추천인코드 복사 ---- */
const p2pBtn=document.getElementById('p2p-code-btn');
if(p2pBtn){
  p2pBtn.addEventListener('click',async()=>{
    const code='0OH1UN';
    try{ await navigator.clipboard.writeText(code); }catch(e){}
    const orig=p2pBtn.textContent;
    p2pBtn.textContent='복사됨: '+code;
    setTimeout(()=>{ p2pBtn.textContent=orig; },1800);
  });
}