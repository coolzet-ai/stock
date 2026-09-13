const $=s=>document.querySelector(s);
const PERKO={d:'일간',w:'주간',m:'월간',y:'연간'};
const curPer={us:'d',tick:'d',cap:'d',lev:'d',cf:'d',coin:'d',fx:'d',krcap:'d',krkq:'d'};
const fmt=n=>n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const sign=v=>(v>0?'+':'')+v.toFixed(2)+'%';
const arrowSign=v=>(v>0?'▲':(v<0?'▼':'—'))+' '+Math.abs(v).toFixed(2)+'%';
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
    console.warn('CoinGecko 1차 실패(sparkline 포함):', e1.message);
    try{
      const arr=await fetchJSON(base,9000); // sparkline 없이 1회 재시도(요청 비용을 낮춰 레이트리밋 완화)
      coinData={}; arr.forEach(c=>coinData[c.id]=c);
    }catch(e2){
      console.warn('CoinGecko 2차 실패 → 폴백 스냅샷 사용:', e2.message);
      coinData=null; // 완전 실패 → 폴백 스냅샷 사용
    }
  }
  renderCoin(curPer.coin);
  renderMcapChart();
}
/* 추세(스파크라인)를 선택한 기간(일/주/월/연)에 맞춰 가져오기 위한 캐시.
   CoinGecko coins/markets 는 7일 스파크라인만 제공하므로, 다른 기간은
   coins/{id}/market_chart 를 기간별로 별도 호출해서 채운다(코인·기간 조합별 1회만 호출 후 캐시). */
const coinTrendCache={};
async function loadCoinTrend(period){
  const days={d:1,w:7,m:30,y:365}[period];
  if(period==='w') return; // 7일은 coins/markets의 sparkline_in_7d 로 이미 충분
  const ids=['bitcoin','ethereum','solana','ripple'];
  await Promise.all(ids.map(async id=>{
    const key=id+'_'+period;
    if(coinTrendCache[key]) return;
    try{
      const j=await fetchJSON(cgURL('/coins/'+id+'/market_chart?vs_currency=usd&days='+days),9000);
      const prices=(j.prices||[]).map(p=>p[1]);
      if(prices.length>1) coinTrendCache[key]=prices;
    }catch(e){ /* 실패 시 캐시 없음 → 폴백 사용 */ }
  }));
}
function renderCoin(p){
  const key={d:'price_change_percentage_24h_in_currency',w:'price_change_percentage_7d_in_currency',
             m:'price_change_percentage_30d_in_currency',y:'price_change_percentage_1y_in_currency'}[p];
  document.querySelectorAll('#coin-tbl .wl-row').forEach(row=>{
    const id=row.dataset.c, c=coinData&&coinData[id];
    const px=row.querySelector('.px'), ch=row.querySelector('.ch'), bar=row.querySelector('.wl-bar');
    if(!c){
      const b=COIN_BASE[id];
      if(!b){
        if(px){ px.textContent='--'; px.className='px wl-price'; }
        if(ch){ ch.textContent='--'; ch.className='ch wl-pct'; }
        if(bar) bar.className='wl-bar';
        return;
      }
      const dir=cls(b[p]);
      if(px){ px.textContent='$'+fmtCoin(b.px); px.className='px wl-price '+dir; }
      if(ch){ ch.textContent=arrowSign(b[p]); ch.className='ch wl-pct '+dir; }
      if(bar) bar.className='wl-bar '+dir;
      return;
    }
    if(px) px.textContent='$'+fmtCoin(c.current_price);
    const v=c[key];
    if(v==null){
      if(px) px.className='px wl-price';
      if(ch){ ch.textContent='--'; ch.className='ch wl-pct'; }
      if(bar) bar.className='wl-bar';
      return;
    }
    const dir=cls(v);
    if(px) px.className='px wl-price '+dir;
    if(ch){ ch.textContent=arrowSign(v); ch.className='ch wl-pct '+dir; }
    if(bar) bar.className='wl-bar '+dir;
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
  const errors=[];
  for(const p of PROXIES){
    const target=p(url); if(!target) continue;
    try{
      const c=new AbortController(), t=setTimeout(()=>c.abort(),5000);
      const r=await fetch(target,{signal:c.signal}); clearTimeout(t);
      if(!r.ok){ errors.push(target.split('?')[0]+' → HTTP '+r.status); continue; }
      const j=await r.json();
      if(j) return j;
      errors.push(target.split('?')[0]+' → 빈 응답');
    }catch(e){ errors.push(target.split('?')[0]+' → '+e.message); }
  }
  console.warn('getJSON 전체 실패('+url+'):', errors);
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
  tick:{table:'tick-tbl', list:['QLD','USD','SCHD','DRAM','RAM','GLDM','SLVP']},
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
  document.querySelectorAll('#'+cfg.table+' .wl-row').forEach(row=>{
    const t=row.dataset.t, d=tickData[t];
    const px=row.querySelector('.px'), ch=row.querySelector('.ch'), bar=row.querySelector('.wl-bar'), sp=row.querySelector('.wl-spark');
    if(!d||d.length<2){
      const b=BASE[t];
      if(!b){
        if(px){ px.textContent='--'; px.className='px wl-price'; }
        if(ch){ ch.textContent='--'; ch.className='ch wl-pct'; }
        if(bar) bar.className='wl-bar';
        if(sp) sp.innerHTML='';
        return;
      }
      const dir=cls(b[p]);
      if(px){ px.textContent=cur+f(b.px); px.className='px wl-price '+dir; }
      if(ch){ ch.textContent=arrowSign(b[p]); ch.className='ch wl-pct '+dir; }
      if(bar) bar.className='wl-bar '+dir;
      if(sp) sp.innerHTML=sparkSVG(fallbackSeries(b,p));
      return;
    }
    const last=d[d.length-1];
    const base=(p==='y')?d[0]:d[Math.max(0,d.length-1-n)];
    const v=(last/base-1)*100;
    if(px) px.textContent=cur+f(last);
    if(!isFinite(v)){
      console.warn('등락률 계산 실패('+t+'):', {last, base, d_length:d.length, n});
      if(px) px.className='px wl-price';
      if(ch){ ch.textContent='--'; ch.className='ch wl-pct'; }
      if(bar) bar.className='wl-bar';
      if(sp) sp.innerHTML='';
      return;
    }
    const dir=cls(v);
    if(px) px.className='px wl-price '+dir;
    if(ch){ ch.textContent=arrowSign(v); ch.className='ch wl-pct '+dir; }
    if(bar) bar.className='wl-bar '+dir;
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
    else if(g==='fx') renderFxWatchlist(p);
  });
});

/* ===================== 매매김군 백테스트 엔진 =====================
   실제 Yahoo 종가·배당 데이터와 CNN 공포탐욕지수 히스토리로 계산합니다(가상 수치 아님).
   PROXY_BASE 미설정 시 이 데이터들도 연동에 실패할 수 있습니다. */
const TRADE_TICKERS=['QLD','USD','SCHD'];
let BACKTEST_START_YEAR=2026; // 2022~2026 중 선택 — 트레이드 탭의 연도 선택 버튼으로 변경됨
let BACKTEST_START_TS=Math.floor(new Date(BACKTEST_START_YEAR+'-01-01T00:00:00Z').getTime()/1000);

/* ===================== 한국지수 공포탐욕지수 =====================
   미국지수와 동일한 CNN 7개 세부지표 방식으로 설계했으나, 시장 모멘텀(1번)만
   무료 공개 데이터(Yahoo KOSPI)로 계산 가능합니다. 나머지 6개(주가 강도·주가 폭·
   풋/콜옵션·VKOSPI·안전자산 수요·정크본드 수요)는 KRX 정보데이터시스템·KOFIA
   채권정보센터의 시장 전체 통계·파생상품·채권 유통수익률 데이터가 필요한데,
   이 데이터들은 무료로 CORS 연동 가능한 공개 API가 없어(회원가입 후 유상 제공
   또는 화면 스크래핑만 가능) 실시간 연동이 불가능합니다. 정확성을 위해 이 6개는
   가짜 수치를 만들지 않고 '준비중'으로 명시합니다. */
/* ===================== 한국은행 ECOS 연동 (6번·7번 지표) =====================
   통계표 817Y002(시장금리, 일별) · 국고채(3년)/국고채(10년)/회사채(3년,AA-)/회사채(3년,BBB-)
   인증키·항목코드 설정 완료. CORS가 막혀 있으면 getJSON의 PROXY_BASE 경유로 자동 우회된다
   (cors-proxy-worker.js ALLOW 목록에 ecos.bok.or.kr 이미 등록됨). */
const ECOS_KEY='63MKYWEJT6RYCZ59IHTU';
const ECOS_STAT_MARKET_RATE='060Y001'; // 시장금리, 일별 — 제공된 항목코드(010200000 등)와 매칭되는 실제 통계표
const ECOS_ITEM={
  treasury3y:'010200000',   // 국고채(3년)
  treasury10y:'010210000',  // 국고채(10년)
  corpAA:'010300000',       // 회사채(3년,AA-)
  corpBBB:'010320000'       // 회사채(3년,BBB-)
};

async function ecosSeries(itemCode, days){
  if(!ECOS_KEY || !itemCode) return null;
  const end=new Date(), start=new Date(); start.setDate(end.getDate()-(days||60));
  const fmt8=d=>d.getFullYear()+String(d.getMonth()+1).padStart(2,'0')+String(d.getDate()).padStart(2,'0');
  const url='https://ecos.bok.or.kr/api/StatisticSearch/'+ECOS_KEY+'/json/kr/1/200/'+
      ECOS_STAT_MARKET_RATE+'/D/'+fmt8(start)+'/'+fmt8(end)+'/'+itemCode;
  try{
    const j=await getJSON(url);
    if(j.RESULT){ console.warn('ECOS 오류('+itemCode+'):', j.RESULT.MESSAGE||j.RESULT); return null; }
    const rows=(j.StatisticSearch||{}).row||[];
    if(!rows.length){ console.warn('ECOS 빈 응답('+itemCode+') — 통계표/항목코드 확인 필요:', j); return null; }
    return rows.map(r=>({t:r.TIME, v:+r.DATA_VALUE})).filter(r=>isFinite(r.v)).sort((a,b)=>a.t.localeCompare(b.t));
  }catch(e){ console.warn('ECOS 호출 실패('+itemCode+'):', e); return null; }
}

async function loadEcosIndicators(){
  if(!ECOS_KEY || !ECOS_ITEM.treasury3y || !ECOS_ITEM.corpAA || !ECOS_ITEM.corpBBB){
    return null; // 설정 미완료 — 위 안내 참고
  }
  const [t3y, aa, bbb] = await Promise.all([
    ecosSeries(ECOS_ITEM.treasury3y, 40),
    ecosSeries(ECOS_ITEM.corpAA, 40),
    ecosSeries(ECOS_ITEM.corpBBB, 40)
  ]);
  const result={};
  /* 7. 정크본드 수요: 신용스프레드 = BBB- 금리 - AA- 금리. 스프레드가 좁을수록(위험선호) 탐욕, 벌어질수록 공포 */
  if(aa && bbb && aa.length && bbb.length){
    const spread=bbb[bbb.length-1].v - aa[aa.length-1].v;
    // 스프레드 0.5%p~3.0%p 를 공포~탐욕 0~100으로 역매핑(좁을수록 탐욕)
    const clipped=Math.max(0.5,Math.min(3.0,spread));
    result.creditSpread=spread;
    result.creditScore=100-((clipped-0.5)/2.5)*100;
  }
  /* 6. 안전자산 수요: 코스피 20일 수익률 - 국고채(3년) 20일 수익률(금리 변화분으로 근사) */
  if(t3y && t3y.length>20){
    const kospi=await yclose('^KS11','2mo');
    if(kospi && kospi.length>20){
      const kospiRet=(kospi[kospi.length-1]/kospi[kospi.length-21]-1)*100;
      const bondRet=t3y[t3y.length-1].v - t3y[t3y.length-21>=0?t3y.length-21:0].v; // %p 변화(수익률 근사)
      const gap=kospiRet-(-bondRet); // 채권금리 하락(=채권가격 상승)이 안전자산 선호를 의미하므로 부호 반전
      const clipped=Math.max(-10,Math.min(10,gap));
      result.safeHavenGap=gap;
      result.safeHavenScore=((clipped+10)/20)*100;
    }
  }
  return result;
}

/* ===================== KRX Open API 연동 (4번·5번 지표) =====================
   AUTH_KEY 는 HTTP 헤더로만 전달되어(URL 파라미터 아님) 반드시 Worker(PROXY_BASE)를
   거쳐야 합니다 — 키는 Worker 안에만 있고 이 파일에는 없습니다.
   [주의] 실제 응답 스키마(OutBlock_1의 필드명)를 직접 확인하지 못한 상태라 여러
   후보 필드명을 순서대로 시도합니다. 콘솔에 경고가 뜨면 알려주시면 정확한 필드명으로
   교정하겠습니다. */
function fmtYmd(d){ return d.getFullYear()+String(d.getMonth()+1).padStart(2,'0')+String(d.getDate()).padStart(2,'0'); }
function pick(row, keys){
  for(const k of keys){ if(row[k]!=null && row[k]!=='') return row[k]; }
  return null;
}
async function krxJSON(path, basDd){
  const url='https://data-dbg.krx.co.kr/svc/apis/'+path+'?basDd='+basDd;
  try{
    const j=await getJSON(url);
    if(j.OutBlock_1) return j.OutBlock_1;
    console.warn('KRX 응답에 OutBlock_1 없음('+path+'):', j);
    return null;
  }catch(e){ console.warn('KRX 호출 실패('+path+'):', e); return null; }
}
async function krxJSONRecent(path, maxBack){
  /* 휴장일이면 데이터가 없을 수 있어 최근 거래일까지 며칠 소급 시도 */
  for(let i=0;i<(maxBack||5);i++){
    const d=new Date(); d.setDate(d.getDate()-i);
    const rows=await krxJSON(path, fmtYmd(d));
    if(rows && rows.length) return rows;
  }
  return null;
}
/* 2번(주가 강도)·3번(주가 폭): Worker의 Cron Trigger가 매일 1회 계산해 KV에 저장한
   결과를 /kr-breadth 에서 그대로 읽어온다(전종목 배치 집계라 브라우저에서 직접 계산 불가).
   [설정 필요] Worker에 KV 바인딩(KR_KV)과 Cron Trigger를 추가해야 값이 채워집니다. */
async function loadKrBreadth(){
  if(!PROXY_BASE) return null;
  try{
    const origin=PROXY_BASE.replace(/\?url=$/,'');
    const r=await fetch(origin+'kr-breadth',{signal:AbortSignal.timeout?AbortSignal.timeout(8000):undefined});
    if(!r.ok) return null;
    const j=await r.json();
    return (j && j.date) ? j : null;
  }catch(e){ console.warn('주가강도/폭(kr-breadth) 호출 실패:', e); return null; }
}

/* 금융상품 페이지 — 증권·은행·카드 이벤트 (Worker가 24시간마다 수집해둔 결과를 그대로 읽음) */
async function loadFinEvents(){
  const statusEl=document.getElementById('fin-events-status');
  if(!PROXY_BASE){
    if(statusEl) statusEl.textContent='⚠ PROXY_BASE가 설정되어 있지 않아 이벤트를 불러올 수 없습니다.';
    return;
  }
  try{
    const origin=PROXY_BASE.replace(/\?url=$/,'');
    const r=await fetch(origin+'fin-events',{signal:AbortSignal.timeout?AbortSignal.timeout(8000):undefined});
    const data=r.ok?await r.json():null;
    renderFinEvents(data);
  }catch(e){
    console.warn('금융상품 이벤트 로딩 실패:', e);
    renderFinEvents(null);
  }
}
function renderFinEvents(data){
  const statusEl=document.getElementById('fin-events-status');
  const tbodies={증권:document.getElementById('fin-ev-sec'), 은행:document.getElementById('fin-ev-bank'), 카드:document.getElementById('fin-ev-card')};
  if(!data || !data.byCat){
    if(statusEl) statusEl.textContent='⚠ 이벤트 목록을 가져오지 못했습니다 — Worker(/fin-events)가 배포되어 있고 스케줄러가 한 번 이상 실행됐는지 확인해주세요.';
    Object.values(tbodies).forEach(tb=>{ if(tb) tb.innerHTML='<tr><td class="mut" colspan="4">불러오지 못했습니다</td></tr>'; });
    return;
  }
  if(statusEl){
    const updated=data.updatedAt?new Date(data.updatedAt).toLocaleString('ko-KR'):'알 수 없음';
    statusEl.textContent='최근 수집: '+updated+(data.failedSources&&data.failedSources.length?' · 수집 실패 '+data.failedSources.length+'곳':'');
  }
  Object.keys(tbodies).forEach(cat=>{
    const tb=tbodies[cat]; if(!tb) return;
    const rows=(data.byCat[cat]||[]);
    if(!rows.length){ tb.innerHTML='<tr><td class="mut" colspan="4">표시할 이벤트가 없습니다</td></tr>'; return; }
    tb.innerHTML=rows.map(ev=>{
      const dstr=ev.deadlineTs?new Date(ev.deadlineTs).toLocaleDateString('ko-KR',{month:'2-digit',day:'2-digit'})+'까지':'상시';
      const stars='★'.repeat(ev.star||1)+'☆'.repeat(3-(ev.star||1));
      return '<tr><td>'+ev.source+'</td><td><a href="'+ev.url+'" target="_blank" rel="noopener" style="color:inherit;text-decoration:none">'+ev.title+'</a></td>'+
        '<td class="mut" style="white-space:nowrap">'+dstr+'</td><td style="text-align:center;color:var(--accent)">'+stars+'</td></tr>';
    }).join('');
  });
}

/* ===================== 환율 페이지 — 김군 관심 화폐(USD·JPY·CNY·EUR·CHF·BRL) =====================
   원화(KRW) 기준 교차환율을 Yahoo Finance 티커로 받는다. USD·JPY·EUR·CHF는 XXXKRW=X 직접
   교차 티커가 존재하지만, CNY·BRL은 Yahoo에 해당 직접 교차 티커가 없어(조회 실패) 대신
   달러를 다리 삼아(USD/KRW ÷ USD/XXX = XXX/KRW) 두 개의 실제 존재하는 티커(KRW=X, CNY=X,
   BRL=X — 전부 표준 Yahoo 통화 티커)를 조합해 계산한다. */
const FX_META={
  'KRW=X':   {name:'미국 달러', code:'USD', flag:'🇺🇸', url:'https://www.federalreserve.gov'},
  'JPYKRW=X':{name:'일본 엔',   code:'JPY', flag:'🇯🇵', url:'https://www.boj.or.jp'},
  'CNY_BRIDGE':{name:'중국 위안', code:'CNY', flag:'🇨🇳', url:'http://www.pbc.gov.cn', bridge:'CNY=X'},
  'EURKRW=X':{name:'유로',     code:'EUR', flag:'🇪🇺', url:'https://www.ecb.europa.eu'},
  'CHFKRW=X':{name:'스위스 프랑', code:'CHF', flag:'🇨🇭', url:'https://www.snb.ch'},
  'BRL_BRIDGE':{name:'브라질 헤알', code:'BRL', flag:'🇧🇷', url:'https://www.bcb.gov.br', bridge:'BRL=X'}
};
const FX_LIST=Object.keys(FX_META);
const fxData={};

/* USD/KRW(krwCloses)와 USD/XXX(otherCloses) 두 시계열을 날짜 정렬 없이(둘 다 최신순으로
   끝에서부터 정렬돼 있으므로) 끝을 맞춰 XXX/KRW = (USD/KRW) ÷ (USD/XXX) 로 나눈다.
   완벽한 거래일 정렬은 아니지만 FX는 거의 매일 데이터가 있어 근사 오차가 작다. */
function combineFxBridge(krwCloses, otherCloses){
  if(!krwCloses || !otherCloses) return null;
  const n=Math.min(krwCloses.length, otherCloses.length);
  if(n<30) return null;
  const k=krwCloses.slice(-n), o=otherCloses.slice(-n);
  const out=[];
  for(let i=0;i<n;i++){
    if(o[i]) out.push(k[i]/o[i]);
  }
  return out.length>30?out:null;
}

/* RSI(14, 단순평균 기반 — 와일더 스무딩 아님, 참고용 근사치) */
function calcRSI(closes, period){
  period=period||14;
  if(!closes||closes.length<period+1) return null;
  const slice=closes.slice(-(period+1));
  let gains=0, losses=0;
  for(let i=1;i<slice.length;i++){
    const diff=slice[i]-slice[i-1];
    if(diff>=0) gains+=diff; else losses-=diff;
  }
  const avgGain=gains/period, avgLoss=losses/period;
  if(avgLoss===0) return avgGain===0?50:100;
  const rs=avgGain/avgLoss;
  return 100-(100/(1+rs));
}

async function loadFxWatchlist(){
  await Promise.all(FX_LIST.map(async key=>{
    if(fxData[key]) return;
    const meta=FX_META[key];
    if(meta.bridge){
      const [krw, other]=await Promise.all([yclose('KRW=X','2y'), yclose(meta.bridge,'2y')]);
      fxData[key]=combineFxBridge(krw, other);
    }else{
      fxData[key]=await yclose(key,'2y'); // 200일선 계산에 넉넉한 기간 확보
    }
  }));
  renderFxWatchlist(curPer.fx||'d');
}

function renderFxWatchlist(p){
  const n={d:1,w:5,m:21,y:252}[p]||1;
  const tbody=document.getElementById('fx-tbl');
  if(!tbody) return;
  tbody.innerHTML=FX_LIST.map(sym=>{
    const meta=FX_META[sym];
    const closes=fxData[sym];
    const linkTag='<a href="'+meta.url+'" target="_blank" rel="noopener" title="'+meta.name+' 발행 중앙은행 공식 사이트" style="margin-left:5px;text-decoration:none">🔗</a>';
    const finvizUrl='https://finviz.com/forex_charts.ashx?t='+meta.code+'USD';
    const nameCell='<td>'+meta.flag+' <a href="'+finvizUrl+'" target="_blank" rel="noopener" style="color:inherit;text-decoration:underline" title="Finviz에서 '+meta.code+' 상세 차트 보기">'+meta.name+'</a> <span class="mut">('+meta.code+'/KRW)</span>'+linkTag+'</td>';
    if(!closes || closes.length<2){
      return '<tr>'+nameCell+'<td class="mut" colspan="5">데이터 없음</td></tr>';
    }
    const last=closes[closes.length-1];
    const base=closes[Math.max(0,closes.length-1-n)];
    const chg=(last/base-1)*100;
    if(!isFinite(chg)){
      return '<tr>'+nameCell+'<td class="mut" colspan="5">계산 실패</td></tr>';
    }
    const dir=chg>=0?'up':'down';
    const ma200Src=closes.slice(-200);
    const ma200=ma200Src.length>=50?ma200Src.reduce((a,b)=>a+b,0)/ma200Src.length:null; // 데이터 부족 시(신규 상장 등) null
    const disp=ma200!=null?((last/ma200-1)*100):null;
    const above200=ma200!=null?(last>=ma200):null;
    const rsi=calcRSI(closes,14);
    const decimals=last<50?2:(last<500?1:0);
    const priceStr='₩'+last.toLocaleString('ko-KR',{minimumFractionDigits:decimals,maximumFractionDigits:decimals});
    const rsiTxt=rsi!=null?rsi.toFixed(1):'--';
    const rsiNote=rsi!=null?(rsi>=70?' <span class="mut" style="font-size:11px">(과매수)</span>':rsi<=30?' <span class="mut" style="font-size:11px">(과매도)</span>':''):'';
    const ma200Badge=above200==null?'<span class="mut">--</span>'
      :(above200?'<span class="tag" style="background:rgba(255,77,79,.15);color:var(--up)">200일선 위</span>'
                :'<span class="tag" style="background:rgba(61,157,255,.15);color:var(--down)">200일선 아래</span>');
    return '<tr>'+nameCell+
      '<td class="num">'+priceStr+'</td>'+
      '<td class="num '+dir+'">'+(chg>=0?'+':'')+chg.toFixed(2)+'%</td>'+
      '<td class="num">'+rsiTxt+rsiNote+'</td>'+
      '<td class="num">'+(disp!=null?(disp>=0?'+':'')+disp.toFixed(2)+'%':'--')+'</td>'+
      '<td style="text-align:center">'+ma200Badge+'</td></tr>';
  }).join('');
}

/* ===================== 전자공시(OpenDART) 연동 — 손익계산서 3년 시각화 =====================
   crtfc_key는 Worker가 서버 쪽에서 자동으로 붙여주므로 클라이언트 코드에는 없다.
   DART는 종목코드(005930)가 아니라 자체 corp_code(8자리)를 쓰는데, 이 매핑은 손으로
   찾아 넣지 않고 Worker의 /dart-corp 엔드포인트에 물어봐서 자동으로 받아온다(Worker가
   DART corpCode.xml 전체를 받아 캐시해두고 응답한다). 페이지에서 여러 종목을 한 번에
   조회하면 아래 캐시에 저장되어 같은 세션에서는 재요청하지 않는다. */
const dartCorpCodeCache={};
async function resolveDartCorpCodes(stockCodes){
  const need=stockCodes.filter(c=>!(c in dartCorpCodeCache));
  if(need.length && PROXY_BASE){
    try{
      const origin=PROXY_BASE.replace(/\?url=$/,'');
      const r=await fetch(origin+'dart-corp?codes='+need.join(','),{signal:AbortSignal.timeout?AbortSignal.timeout(8000):undefined});
      if(r.ok){
        const j=await r.json();
        need.forEach(c=>{ dartCorpCodeCache[c]=j[c]||null; });
      }
    }catch(e){ console.warn('DART corp_code 해석 실패:', e); }
  }
  return stockCodes.map(c=>dartCorpCodeCache[c]||null);
}

/* bsns_year의 사업보고서(reprt_code=11011, 사업보고서) 단일회사 전체 재무제표 중
   손익계산서 핵심 항목(매출액·영업이익·당기순이익)만 추출 */
async function dartFinancialYear(corpCode, year){
  const url='https://opendart.fss.or.kr/api/fnlttSinglAcnt.json?corp_code='+corpCode+'&bsns_year='+year+'&reprt_code=11011';
  try{
    const j=await getJSON(url);
    if(!j || j.status!=='000' || !Array.isArray(j.list)){
      console.warn('DART 재무제표 실패('+corpCode+','+year+'):', j&&j.message);
      return null;
    }
    const pick=nm=>{
      const row=j.list.find(r=>r.account_nm===nm && r.fs_div==='CFS') // 연결재무제표 우선
             || j.list.find(r=>r.account_nm===nm); // 없으면 개별재무제표
      return row?(+row.thstrm_amount.replace(/,/g,'')):null;
    };
    return { year, revenue:pick('매출액'), opProfit:pick('영업이익'), netProfit:pick('당기순이익') };
  }catch(e){ console.warn('DART 호출 실패('+corpCode+','+year+'):', e); return null; }
}

/* 최근 3개 사업연도 손익계산서를 한 번에(전년도까지 확정 발표된 연도 기준) */
async function dartFinancials3Y(stockCode){
  const [corpCode]=await resolveDartCorpCodes([stockCode]);
  if(!corpCode) return null;
  const thisYear=new Date().getFullYear();
  const years=[thisYear-3, thisYear-2, thisYear-1]; // 최근 확정 3개년(올해는 아직 사업보고서 미제출)
  const results=await Promise.all(years.map(y=>dartFinancialYear(corpCode, y)));
  const valid=results.filter(Boolean);
  return valid.length?valid:null;
}

/* 손익계산서 3년 막대그래프(매출액·영업이익·당기순이익) — 반환된 HTML 문자열을 그대로 넣어 쓴다 */
function renderFinancialsChart(data){
  if(!data || !data.length) return '<p class="mut" style="font-size:12.5px">재무제표 데이터를 가져오지 못했습니다.</p>';
  const w=320,barH=22,gap=6,leftLabelW=90;
  const metrics=[['매출액','revenue','var(--tx)'],['영업이익','opProfit','var(--up)'],['당기순이익','netProfit','#2dd4bf']];
  const allVals=data.flatMap(d=>metrics.map(([,k])=>d[k]||0));
  const maxV=Math.max(...allVals,1);
  const fmtOk=v=>{
    if(v==null) return '--';
    const eok=v/100000000; // 원 → 억원
    return eok.toFixed(0)+'억';
  };
  let rows='';
  data.forEach(d=>{
    rows+='<div style="margin-bottom:10px"><div class="mut" style="font-size:11.5px;margin-bottom:4px">'+d.year+'년</div>';
    metrics.forEach(([label,key,color])=>{
      const v=d[key]||0;
      const pct=Math.max(2,(Math.abs(v)/maxV)*100);
      rows+='<div style="display:flex;align-items:center;gap:8px;margin-bottom:3px">'+
        '<span style="width:'+leftLabelW+'px;font-size:11px;color:var(--tx2);flex:none">'+label+'</span>'+
        '<div style="flex:1;background:var(--panel2);border-radius:4px;overflow:hidden;height:'+barH+'px">'+
          '<div style="width:'+pct.toFixed(1)+'%;height:100%;background:'+color+'"></div>'+
        '</div>'+
        '<span style="width:64px;text-align:right;font-size:11.5px;font-weight:700;flex:none">'+fmtOk(v)+'</span>'+
      '</div>';
    });
    rows+='</div>';
  });
  return '<div style="max-width:'+w+'px">'+rows+'</div>';
}

async function loadKrxIndicators(){
  const result={};
  /* 5. 시장 변동성(VKOSPI): kospi_dd_trd(KOSPI 시리즈 지수)에서 이름으로 검색 */
  try{
    const idxRows=await krxJSONRecent('idx/kospi_dd_trd', 5);
    if(idxRows){
      const row=idxRows.find(r=>{
        const name=pick(r,['IDX_NM','IDX_IND_NM','ISU_NM','IDX_NM_KOR'])||'';
        return name.includes('변동성');
      });
      if(row){
        const val=+pick(row,['CLSPRC_IDX','TDD_CLSPRC','CLSPRC','IDX_CLSPRC']);
        if(isFinite(val)){
          result.vkospi=val;
          // VKOSPI 10~45 를 탐욕(100)~공포(0)로 역매핑(높을수록 공포)
          const clipped=Math.max(10,Math.min(45,val));
          result.vkospiScore=100-((clipped-10)/35)*100;
        }
      }else{
        console.warn('KRX kospi_dd_trd 응답에서 VKOSPI 행을 찾지 못함(지수명 필드 확인 필요):', idxRows[0]);
      }
    }
  }catch(e){ console.warn('VKOSPI 계산 실패:', e); }

  /* 4. 풋/콜 비율: eqsop_bydd_trd(주식옵션 일별매매정보) — 개별주식옵션 합산 기준
     (KOSPI200 지수옵션이 아닌 개별 종목 옵션이라 CNN 방식과 완전히 동일하진 않음) */
  try{
    const optRows=await krxJSONRecent('drv/eqsop_bydd_trd', 5);
    if(optRows && optRows.length){
      let callVol=0, putVol=0;
      optRows.forEach(r=>{
        const kind=(pick(r,['RGHT_TP_NM','RGHT_TP_CD','OPT_TP_NM'])||'').toUpperCase();
        const vol=+pick(r,['ACC_TRDVOL','TRDVOL','TRD_VOL'])||0;
        if(kind.includes('콜')||kind.includes('CALL')) callVol+=vol;
        else if(kind.includes('풋')||kind.includes('PUT')) putVol+=vol;
      });
      if(callVol>0){
        const ratio=putVol/callVol;
        result.putCallRatio=ratio;
        // 풋/콜 0.5~2.0 를 탐욕(100)~공포(0)로 역매핑(높을수록 공포)
        const clipped=Math.max(0.5,Math.min(2.0,ratio));
        result.putCallScore=100-((clipped-0.5)/1.5)*100;
      }else{
        console.warn('KRX eqsop_bydd_trd 응답에서 콜/풋 구분 실패(필드명 확인 필요):', optRows[0]);
      }
    }
  }catch(e){ console.warn('풋/콜 비율 계산 실패:', e); }

  return result;
}

/* [로딩 지연 개선] 예전에는 Promise.all로 4개 소스를 전부 기다린 뒤 한꺼번에 그렸다.
   ECOS·KRX 는 공개 프록시 폴백을 여러 번 시도하다 보니(각 5초 타임아웃 x 여러 프록시)
   전체 응답까지 10~20초씩 걸리는 경우가 있었고, 그 사이 1번(시장 모멘텀, Yahoo 코스피
   종가만 있으면 계산 가능)까지 같이 멈춰 있었다. 이제는 1번을 별도로 즉시 계산해서
   먼저 표시하고, 2~7번(ECOS·KRX·주가강도폭)은 도착하는 대로 각자 갱신한다 — 값이
   아직 없는 항목은 renderKRSub가 자동으로 "준비중"으로 표시한다. */
let lastKrMomentumScore=null;
async function loadKR(){
  let ecosData=null, krxData=null, breadthData=null;
  renderKRSub(null, null, null, null); // 뼈대부터 즉시 그려서 "불러오는 중" 상태를 없앤다

  const bg=(p, assign)=>p.then(v=>{ assign(v); renderKRSub(lastKrMomentumScore, ecosData, krxData, breadthData); })
                        .catch(e=>{ console.warn('한국 공포탐욕 세부지표 로딩 실패:', e); });
  const ecosP=bg(loadEcosIndicators(), v=>ecosData=v);
  const krxP=bg(loadKrxIndicators(), v=>krxData=v);
  const breadthP=bg(loadKrBreadth(), v=>breadthData=v);

  const closes=await yclose('^KS11','1y');
  if(!closes || closes.length<126){ renderKR(null, ecosData, krxData, breadthData); await Promise.allSettled([ecosP,krxP,breadthP]); return; }
  const last=closes[closes.length-1];
  const ma125=closes.slice(-125).reduce((a,b)=>a+b,0)/125;
  const ratio=(last-ma125)/ma125;
  if(!isFinite(ratio)){ renderKR(null, ecosData, krxData, breadthData); await Promise.allSettled([ecosP,krxP,breadthP]); return; }
  const clipped=Math.max(-0.15,Math.min(0.15,ratio));
  const score=((clipped+0.15)/0.30)*100;
  lastKrMomentumScore=score;
  renderKR({score, last, ma125, ratio}, ecosData, krxData, breadthData);
  await Promise.allSettled([ecosP,krxP,breadthP]); // 이미 각자 도착 시점에 화면을 갱신했으므로 여기선 대기만
}
function renderKR(d, ecos, krx, breadth){
  const valEl=document.getElementById('kr-val'), stateEl=document.getElementById('kr-state'),
        dialEl=document.getElementById('kr-dial'), detailEl=document.getElementById('kr-detail');
  if(!d){
    if(stateEl) stateEl.textContent='연동 실패';
    if(detailEl) detailEl.textContent='코스피(^KS11) 데이터를 가져오지 못했습니다 · PROXY_BASE 설정을 확인해주세요.';
    renderKRSub(null, ecos, krx, breadth);
    return;
  }
  const [t,c]=label(d.score);
  if(valEl) valEl.textContent=Math.round(d.score);
  if(stateEl){ stateEl.textContent=t; stateEl.style.color=c; }
  if(dialEl){ dialEl.style.setProperty('--p',d.score+'%'); dialEl.style.setProperty('--g',c); }
  if(detailEl) detailEl.textContent='코스피 '+d.last.toFixed(1)+' · 125일 이동평균 '+d.ma125.toFixed(1)+
      ' · 이격도 '+(d.ratio*100>=0?'+':'')+(d.ratio*100).toFixed(1)+'%';
  renderKRSub(d.score, ecos, krx, breadth);
}
function renderKRSub(momentumScore, ecos, krx, breadth){
  const el=document.getElementById('kr-sub'); if(!el) return;
  const strengthNote=breadth&&breadth.strength?' ('+breadth.strength.daysAccumulated+'일 누적, '+breadth.market+')':'';
  const rows=[
    ['1. 시장 모멘텀 (코스피 vs 125일 이평)', momentumScore],
    ['2. 주가 강도 (52주 신고가/신저가 비율)'+strengthNote, breadth&&breadth.strength?breadth.strength.score:null],
    ['3. 주가 폭 (상승/하락 거래량 비율)', breadth&&breadth.breadth?breadth.breadth.score:null],
    ['4. 풋/콜 옵션 비율 (개별주식옵션 합산)', krx&&krx.putCallScore!=null?krx.putCallScore:null],
    ['5. 시장 변동성 (VKOSPI)', krx&&krx.vkospiScore!=null?krx.vkospiScore:null],
    ['6. 안전자산 수요 (코스피 vs 국고채)', ecos&&ecos.safeHavenScore!=null?ecos.safeHavenScore:null],
    ['7. 정크본드 수요 (AA-/BBB- 스프레드)', ecos&&ecos.creditScore!=null?ecos.creditScore:null]
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

/* ===== 미국주식·비트코인 등 달러 표시 가격에 원화 병기 옵션 =====
   가격 텍스트를 하나하나 다시 만드는 대신, 이미 화면에 "$1,234.56" 형태로 그려진
   .wl-price 요소를 스캔해 원화를 괄호로 덧붙이는 방식이라 stock.html·crypto.html의
   기존 렌더링 함수(renderTick·renderCoin 등)를 건드리지 않고도 어디서나 동작한다.
   가격은 주기적으로 갱신되므로 MutationObserver로 텍스트가 바뀔 때마다 다시 적용한다. */
let krwDisplayOn=false;
function applyKrwDisplayToEl(el){
  if(!el) return;
  const current=el.textContent;
  let raw;
  if(/^\$[\d,.]+$/.test(current)){
    raw=current; // renderTick/renderCoin이 방금 새로 그린 순수 달러 텍스트 → 새 원본으로 채택
  }else if(el.dataset.usdText!=null){
    raw=el.dataset.usdText; // 이미 원화가 붙은 상태(우리가 만든 mutation) → 저장해둔 원본 재사용
  }else{
    return; // '--' 등 인식 불가 텍스트는 건드리지 않음
  }
  el.dataset.usdText=raw;
  const target=(krwDisplayOn && usdKrwRate!=null)
    ? (()=>{ const usd=parseFloat(raw.replace(/[$,]/g,'')); if(!isFinite(usd)) return raw; const krw=fmtKRW(usd); return krw?raw+' ('+krw+')':raw; })()
    : raw;
  if(current!==target) el.textContent=target; // 값이 같으면 쓰지 않아 MutationObserver 자기호출 루프를 끊는다
}
function applyKrwDisplayAll(){
  document.querySelectorAll('.wl-price').forEach(applyKrwDisplayToEl);
}
function initKrwToggle(toggleSelector){
  const toggle=document.querySelector(toggleSelector);
  if(!toggle) return;
  loadFxRate().then(applyKrwDisplayAll);
  toggle.addEventListener('change',()=>{ krwDisplayOn=toggle.checked; applyKrwDisplayAll(); });
  const obs=new MutationObserver(muts=>{
    const touched=new Set();
    muts.forEach(m=>{
      const el=m.target.nodeType===1?m.target:m.target.parentElement;
      const priceEl=el&&el.closest?el.closest('.wl-price'):null;
      if(priceEl) touched.add(priceEl);
    });
    touched.forEach(applyKrwDisplayToEl);
  });
  document.querySelectorAll('.wl-price').forEach(el=>{
    obs.observe(el,{childList:true,characterData:true,subtree:true});
  });
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
/* 사용자가 제공한 공포탐욕지수 원본 xlsx(2021-03-01~2026-09-11, CNN 공식 데이터 기반)에서
   2022-01-01 이후분(1,176개 거래일)을 검증된 값으로 전부 내장했다. 백테스트가 선택 가능한
   2022~2026년 시작 옵션을 이 구간이 전부 커버하므로, 백테스트용 공포탐욕지수는
   더 이상 라이브 CNN 연동에 의존하지 않는다(실패해도 항상 정확한 값 사용, 겹치는 날짜는
   이 xlsx 값이 우선). 대시보드 상단의 실시간 현재 지수 표시만 별도로 라이브 데이터를 쓴다. */
const FG_XLS_DATA=[["2022-01-03",65.23],["2022-01-04",64.26],["2022-01-05",51.03],["2022-01-06",52.14],["2022-01-07",49.26],["2022-01-10",51.14],["2022-01-11",56.11],["2022-01-12",55.94],["2022-01-13",52.17],["2022-01-14",55.8],["2022-01-18",53.71],["2022-01-19",44.83],["2022-01-20",39.14],["2022-01-21",26.73],["2022-01-24",23.13],["2022-01-25",20.89],["2022-01-26",19.51],["2022-01-27",18.6],["2022-01-28",23.86],["2022-01-31",29.2],["2022-02-01",30.8],["2022-02-02",28.8],["2022-02-03",26.06],["2022-02-04",27.6],["2022-02-07",27.91],["2022-02-08",28.94],["2022-02-09",32.66],["2022-02-10",33.6],["2022-02-11",28.49],["2022-02-14",25.69],["2022-02-15",29.97],["2022-02-16",32.09],["2022-02-17",32.46],["2022-02-18",29.51],["2022-02-22",28.77],["2022-02-23",18.81],["2022-02-24",21.23],["2022-02-25",28.14],["2022-02-28",25.47],["2022-03-01",22.97],["2022-03-02",17.83],["2022-03-03",21.73],["2022-03-04",18.17],["2022-03-07",16.9],["2022-03-08",16.67],["2022-03-09",18.03],["2022-03-10",17.96],["2022-03-11",19.06],["2022-03-14",17.5],["2022-03-15",21.86],["2022-03-16",25.26],["2022-03-17",33.63],["2022-03-18",38.43],["2022-03-21",40.97],["2022-03-22",44.54],["2022-03-23",45.2],["2022-03-24",46.91],["2022-03-25",49.37],["2022-03-28",51.26],["2022-03-29",52.71],["2022-03-30",52.8],["2022-03-31",59.2],["2022-04-01",59.8],["2022-04-04",61.66],["2022-04-05",47.91],["2022-04-06",46.4],["2022-04-07",46.83],["2022-04-08",46.09],["2022-04-11",43.4],["2022-04-12",42.06],["2022-04-13",41.8],["2022-04-14",39.86],["2022-04-18",37.6],["2022-04-19",39.63],["2022-04-20",43.31],["2022-04-21",38.94],["2022-04-22",31.63],["2022-04-25",29.97],["2022-04-26",17.9],["2022-04-27",16.27],["2022-04-28",24.26],["2022-04-29",14.33],["2022-05-02",13.27],["2022-05-03",30.49],["2022-05-04",22.4],["2022-05-05",13.13],["2022-05-06",12.24],["2022-05-09",8.19],["2022-05-10",7.4],["2022-05-11",4.03],["2022-05-12",3.2],["2022-05-13",11.29],["2022-05-16",11.74],["2022-05-17",15.2],["2022-05-18",6.6],["2022-05-19",13.71],["2022-05-20",12.66],["2022-05-23",17.89],["2022-05-24",16.0],["2022-05-25",17.57],["2022-05-26",24.11],["2022-05-27",29.54],["2022-05-31",40.06],["2022-06-01",40.6],["2022-06-02",44.83],["2022-06-03",35.46],["2022-06-06",42.8],["2022-06-07",45.63],["2022-06-08",48.11],["2022-06-09",47.06],["2022-06-10",40.0],["2022-06-13",25.09],["2022-06-14",20.53],["2022-06-15",29.26],["2022-06-16",17.7],["2022-06-17",16.93],["2022-06-21",19.73],["2022-06-22",26.89],["2022-06-23",26.74],["2022-06-24",30.86],["2022-06-27",30.77],["2022-06-28",28.14],["2022-06-29",26.54],["2022-06-30",24.37],["2022-07-01",24.57],["2022-07-05",22.17],["2022-07-06",22.83],["2022-07-07",27.6],["2022-07-08",31.34],["2022-07-11",30.37],["2022-07-12",30.31],["2022-07-13",27.29],["2022-07-14",26.51],["2022-07-15",33.29],["2022-07-18",35.89],["2022-07-19",39.31],["2022-07-20",44.09],["2022-07-21",48.2],["2022-07-22",42.43],["2022-07-25",42.2],["2022-07-26",42.0],["2022-07-27",46.63],["2022-07-28",48.49],["2022-07-29",52.4],["2022-08-01",59.09],["2022-08-02",57.37],["2022-08-03",60.26],["2022-08-04",61.51],["2022-08-05",63.31],["2022-08-08",64.74],["2022-08-09",64.46],["2022-08-10",65.11],["2022-08-11",65.83],["2022-08-12",68.03],["2022-08-15",66.83],["2022-08-16",67.94],["2022-08-17",67.14],["2022-08-18",66.37],["2022-08-19",63.71],["2022-08-22",60.31],["2022-08-23",57.43],["2022-08-24",57.51],["2022-08-25",58.26],["2022-08-26",55.74],["2022-08-29",54.29],["2022-08-30",49.8],["2022-08-31",52.09],["2022-09-01",49.37],["2022-09-02",42.46],["2022-09-06",40.63],["2022-09-07",39.63],["2022-09-08",40.37],["2022-09-09",43.8],["2022-09-12",47.6],["2022-09-13",36.63],["2022-09-14",41.89],["2022-09-15",40.66],["2022-09-16",35.29],["2022-09-19",36.31],["2022-09-20",36.11],["2022-09-21",27.21],["2022-09-22",24.49],["2022-09-23",21.69],["2022-09-26",17.63],["2022-09-27",16.51],["2022-09-28",17.03],["2022-09-29",13.26],["2022-09-30",16.46],["2022-10-03",20.39],["2022-10-04",27.89],["2022-10-05",29.71],["2022-10-06",23.14],["2022-10-07",19.67],["2022-10-10",19.4],["2022-10-11",16.89],["2022-10-12",15.94],["2022-10-13",19.37],["2022-10-14",16.46],["2022-10-17",23.4],["2022-10-18",28.8],["2022-10-19",29.43],["2022-10-20",39.09],["2022-10-21",43.74],["2022-10-24",47.23],["2022-10-25",51.37],["2022-10-26",53.8],["2022-10-27",54.57],["2022-10-28",57.11],["2022-10-31",64.06],["2022-11-01",63.51],["2022-11-02",55.29],["2022-11-03",55.51],["2022-11-04",56.51],["2022-11-07",59.66],["2022-11-08",57.94],["2022-11-09",54.0],["2022-11-10",60.34],["2022-11-11",63.74],["2022-11-14",62.69],["2022-11-15",66.91],["2022-11-16",65.09],["2022-11-17",61.49],["2022-11-18",60.34],["2022-11-21",60.97],["2022-11-22",60.8],["2022-11-23",64.26],["2022-11-25",63.09],["2022-11-28",59.74],["2022-11-29",58.17],["2022-11-30",73.97],["2022-12-01",75.6],["2022-12-02",68.14],["2022-12-05",65.09],["2022-12-06",61.83],["2022-12-07",58.43],["2022-12-08",55.69],["2022-12-09",52.09],["2022-12-12",57.2],["2022-12-13",59.17],["2022-12-14",60.94],["2022-12-15",60.14],["2022-12-16",44.14],["2022-12-19",39.97],["2022-12-20",38.31],["2022-12-21",38.54],["2022-12-22",37.0],["2022-12-23",39.51],["2022-12-27",39.94],["2022-12-28",35.51],["2022-12-29",37.14],["2022-12-30",36.51],["2023-01-03",36.6],["2023-01-04",39.86],["2023-01-05",44.17],["2023-01-06",45.71],["2023-01-09",47.2],["2023-01-10",49.66],["2023-01-11",54.23],["2023-01-12",56.69],["2023-01-13",61.31],["2023-01-17",64.14],["2023-01-18",58.43],["2023-01-19",55.43],["2023-01-20",58.54],["2023-01-23",63.6],["2023-01-24",63.0],["2023-01-25",63.89],["2023-01-26",68.03],["2023-01-27",69.2],["2023-01-30",67.46],["2023-01-31",70.34],["2023-02-01",82.17],["2023-02-02",75.2],["2023-02-03",76.14],["2023-02-06",75.91],["2023-02-07",76.34],["2023-02-08",74.63],["2023-02-09",72.63],["2023-02-10",72.49],["2023-02-13",71.83],["2023-02-14",73.26],["2023-02-15",73.66],["2023-02-16",70.71],["2023-02-17",69.49],["2023-02-21",65.91],["2023-02-22",64.17],["2023-02-23",62.66],["2023-02-24",60.66],["2023-02-27",61.23],["2023-02-28",61.2],["2023-03-01",65.91],["2023-03-02",52.46],["2023-03-03",55.69],["2023-03-06",55.26],["2023-03-07",48.51],["2023-03-08",49.83],["2023-03-09",37.54],["2023-03-10",26.89],["2023-03-13",23.36],["2023-03-14",25.09],["2023-03-15",22.69],["2023-03-16",32.57],["2023-03-17",27.0],["2023-03-20",30.43],["2023-03-21",43.49],["2023-03-22",41.03],["2023-03-23",38.34],["2023-03-24",37.71],["2023-03-27",40.2],["2023-03-28",39.6],["2023-03-29",41.46],["2023-03-30",45.23],["2023-03-31",49.49],["2023-04-03",61.49],["2023-04-04",50.23],["2023-04-05",52.63],["2023-04-06",55.26],["2023-04-10",57.91],["2023-04-11",58.49],["2023-04-12",60.74],["2023-04-13",63.17],["2023-04-14",65.71],["2023-04-17",67.09],["2023-04-18",65.49],["2023-04-19",67.26],["2023-04-20",64.06],["2023-04-21",63.51],["2023-04-24",63.49],["2023-04-25",57.06],["2023-04-26",52.4],["2023-04-27",58.31],["2023-04-28",59.43],["2023-05-01",59.43],["2023-05-02",55.51],["2023-05-03",54.63],["2023-05-04",49.6],["2023-05-05",53.89],["2023-05-08",57.14],["2023-05-09",59.57],["2023-05-10",59.97],["2023-05-11",59.06],["2023-05-12",57.34],["2023-05-15",57.26],["2023-05-16",55.29],["2023-05-17",60.26],["2023-05-18",64.91],["2023-05-19",65.46],["2023-05-22",67.86],["2023-05-23",65.8],["2023-05-24",61.83],["2023-05-25",62.69],["2023-05-26",65.71],["2023-05-30",66.09],["2023-05-31",64.17],["2023-06-01",68.06],["2023-06-02",75.43],["2023-06-05",69.49],["2023-06-06",73.51],["2023-06-07",74.46],["2023-06-08",75.77],["2023-06-09",76.97],["2023-06-12",78.06],["2023-06-13",79.63],["2023-06-14",79.63],["2023-06-15",80.89],["2023-06-16",81.26],["2023-06-20",80.11],["2023-06-21",80.11],["2023-06-22",80.06],["2023-06-23",75.71],["2023-06-26",73.46],["2023-06-27",75.49],["2023-06-28",76.51],["2023-06-29",79.2],["2023-06-30",79.49],["2023-07-03",82.23],["2023-07-05",79.26],["2023-07-06",77.91],["2023-07-07",77.69],["2023-07-10",76.69],["2023-07-11",78.29],["2023-07-12",78.17],["2023-07-13",79.4],["2023-07-14",79.8],["2023-07-17",80.03],["2023-07-18",81.69],["2023-07-19",82.34],["2023-07-20",80.86],["2023-07-21",81.03],["2023-07-24",82.51],["2023-07-25",81.23],["2023-07-26",80.6],["2023-07-27",77.66],["2023-07-28",76.91],["2023-07-31",77.63],["2023-08-01",77.34],["2023-08-02",77.34],["2023-08-03",73.63],["2023-08-04",64.5],["2023-08-07",72.06],["2023-08-08",69.2],["2023-08-09",67.31],["2023-08-10",66.34],["2023-08-11",65.03],["2023-08-14",66.29],["2023-08-15",54.5],["2023-08-16",49.49],["2023-08-17",46.14],["2023-08-18",43.66],["2023-08-21",43.49],["2023-08-22",43.44],["2023-08-23",50.17],["2023-08-24",40.59],["2023-08-25",47.03],["2023-08-28",45.29],["2023-08-29",49.17],["2023-08-30",50.43],["2023-08-31",52.94],["2023-09-01",55.03],["2023-09-05",59.09],["2023-09-06",56.71],["2023-09-07",53.63],["2023-09-08",51.91],["2023-09-11",52.2],["2023-09-12",51.4],["2023-09-13",51.4],["2023-09-14",54.43],["2023-09-15",52.03],["2023-09-18",49.49],["2023-09-19",49.94],["2023-09-20",48.29],["2023-09-21",37.16],["2023-09-22",33.16],["2023-09-25",38.43],["2023-09-26",24.23],["2023-09-27",22.83],["2023-09-28",29.0],["2023-09-29",28.4],["2023-10-02",28.31],["2023-10-03",20.53],["2023-10-04",20.99],["2023-10-05",20.33],["2023-10-06",27.71],["2023-10-09",29.26],["2023-10-10",32.31],["2023-10-11",34.34],["2023-10-12",35.69],["2023-10-13",26.27],["2023-10-16",35.74],["2023-10-17",39.14],["2023-10-18",30.57],["2023-10-19",29.54],["2023-10-20",22.86],["2023-10-23",25.84],["2023-10-24",33.49],["2023-10-25",25.21],["2023-10-26",22.71],["2023-10-27",21.61],["2023-10-30",29.2],["2023-10-31",30.14],["2023-11-01",32.17],["2023-11-02",37.69],["2023-11-03",36.11],["2023-11-06",38.91],["2023-11-07",39.63],["2023-11-08",39.77],["2023-11-09",41.0],["2023-11-10",41.46],["2023-11-13",39.89],["2023-11-14",46.6],["2023-11-15",52.54],["2023-11-16",55.06],["2023-11-17",58.86],["2023-11-20",61.29],["2023-11-21",61.17],["2023-11-22",65.06],["2023-11-24",66.86],["2023-11-27",65.31],["2023-11-28",65.09],["2023-11-29",63.29],["2023-11-30",64.37],["2023-12-01",64.51],["2023-12-04",63.71],["2023-12-05",65.14],["2023-12-06",63.97],["2023-12-07",66.14],["2023-12-08",65.94],["2023-12-11",67.29],["2023-12-12",67.89],["2023-12-13",67.54],["2023-12-14",70.54],["2023-12-15",69.46],["2023-12-18",70.49],["2023-12-19",82.97],["2023-12-20",75.57],["2023-12-21",77.0],["2023-12-22",79.74],["2023-12-26",81.94],["2023-12-27",81.17],["2023-12-28",81.26],["2023-12-29",80.71],["2024-01-02",79.71],["2024-01-03",76.71],["2024-01-04",78.69],["2024-01-05",75.77],["2024-01-08",76.17],["2024-01-09",75.69],["2024-01-10",76.37],["2024-01-11",74.66],["2024-01-12",73.09],["2024-01-16",72.29],["2024-01-17",57.21],["2024-01-18",66.46],["2024-01-19",72.83],["2024-01-22",72.86],["2024-01-23",70.26],["2024-01-24",72.49],["2024-01-25",73.23],["2024-01-26",73.8],["2024-01-29",74.11],["2024-01-30",74.23],["2024-01-31",64.11],["2024-02-01",72.34],["2024-02-02",74.6],["2024-02-05",73.31],["2024-02-06",73.2],["2024-02-07",73.77],["2024-02-08",74.6],["2024-02-09",75.43],["2024-02-12",75.83],["2024-02-13",66.74],["2024-02-14",67.51],["2024-02-15",73.86],["2024-02-16",73.49],["2024-02-20",63.74],["2024-02-21",63.7],["2024-02-22",73.94],["2024-02-23",73.34],["2024-02-26",71.91],["2024-02-27",75.77],["2024-02-28",76.77],["2024-02-29",77.46],["2024-03-01",76.83],["2024-03-04",79.23],["2024-03-05",76.11],["2024-03-06",72.54],["2024-03-07",73.86],["2024-03-08",70.03],["2024-03-11",62.77],["2024-03-12",72.2],["2024-03-13",71.77],["2024-03-14",70.4],["2024-03-15",68.63],["2024-03-18",70.74],["2024-03-19",70.86],["2024-03-20",69.63],["2024-03-21",71.37],["2024-03-22",69.51],["2024-03-25",67.43],["2024-03-26",67.91],["2024-03-27",69.77],["2024-03-28",68.77],["2024-04-01",71.26],["2024-04-02",71.14],["2024-04-03",69.4],["2024-04-04",53.8],["2024-04-05",58.1],["2024-04-08",64.03],["2024-04-09",59.63],["2024-04-10",49.67],["2024-04-11",56.66],["2024-04-12",45.01],["2024-04-15",38.4],["2024-04-16",35.11],["2024-04-17",31.16],["2024-04-18",30.4],["2024-04-19",27.67],["2024-04-22",34.17],["2024-04-23",36.57],["2024-04-24",37.49],["2024-04-25",39.09],["2024-04-26",40.51],["2024-04-29",42.43],["2024-04-30",40.54],["2024-05-01",40.51],["2024-05-02",42.23],["2024-05-03",43.26],["2024-05-06",39.0],["2024-05-07",37.17],["2024-05-08",38.17],["2024-05-09",42.23],["2024-05-10",46.03],["2024-05-13",48.11],["2024-05-14",55.29],["2024-05-15",59.37],["2024-05-16",62.31],["2024-05-17",62.8],["2024-05-20",60.43],["2024-05-21",59.43],["2024-05-22",58.51],["2024-05-23",52.37],["2024-05-24",51.74],["2024-05-28",54.69],["2024-05-29",49.97],["2024-05-30",45.09],["2024-05-31",48.43],["2024-06-03",45.49],["2024-06-04",47.63],["2024-06-05",51.14],["2024-06-06",45.31],["2024-06-07",43.4],["2024-06-10",44.74],["2024-06-11",44.4],["2024-06-12",46.57],["2024-06-13",44.57],["2024-06-14",41.11],["2024-06-17",43.29],["2024-06-18",41.29],["2024-06-20",38.71],["2024-06-21",39.06],["2024-06-24",37.77],["2024-06-25",37.29],["2024-06-26",40.89],["2024-06-27",45.51],["2024-06-28",44.31],["2024-07-01",47.94],["2024-07-02",49.74],["2024-07-03",48.37],["2024-07-05",49.71],["2024-07-08",51.06],["2024-07-09",50.57],["2024-07-10",54.6],["2024-07-11",49.4],["2024-07-12",54.37],["2024-07-15",57.74],["2024-07-16",57.03],["2024-07-17",46.11],["2024-07-18",45.94],["2024-07-19",43.0],["2024-07-22",48.43],["2024-07-23",46.86],["2024-07-24",38.61],["2024-07-25",39.07],["2024-07-26",42.54],["2024-07-29",42.07],["2024-07-30",40.8],["2024-07-31",46.89],["2024-08-01",42.69],["2024-08-02",41.39],["2024-08-05",33.06],["2024-08-06",19.01],["2024-08-07",16.56],["2024-08-08",17.66],["2024-08-09",24.09],["2024-08-12",23.8],["2024-08-13",25.51],["2024-08-14",26.43],["2024-08-15",32.37],["2024-08-16",33.74],["2024-08-19",39.89],["2024-08-20",44.69],["2024-08-21",50.23],["2024-08-22",46.77],["2024-08-23",51.57],["2024-08-26",52.94],["2024-08-27",52.29],["2024-08-28",51.09],["2024-08-29",56.06],["2024-08-30",60.31],["2024-09-03",56.34],["2024-09-04",56.63],["2024-09-05",50.63],["2024-09-06",39.34],["2024-09-09",41.97],["2024-09-10",39.69],["2024-09-11",43.09],["2024-09-12",42.97],["2024-09-13",48.63],["2024-09-16",50.31],["2024-09-17",54.63],["2024-09-18",55.17],["2024-09-19",63.8],["2024-09-20",61.2],["2024-09-23",63.86],["2024-09-24",66.43],["2024-09-25",65.74],["2024-09-26",70.74],["2024-09-27",67.31],["2024-09-30",73.69],["2024-10-01",70.31],["2024-10-02",70.57],["2024-10-03",69.43],["2024-10-04",71.4],["2024-10-07",70.83],["2024-10-08",71.17],["2024-10-09",71.14],["2024-10-10",70.29],["2024-10-11",71.66],["2024-10-14",74.23],["2024-10-15",71.14],["2024-10-16",69.03],["2024-10-17",68.57],["2024-10-18",72.43],["2024-10-21",69.8],["2024-10-22",70.37],["2024-10-23",63.2],["2024-10-24",62.94],["2024-10-25",58.74],["2024-10-28",60.86],["2024-10-29",60.06],["2024-10-30",57.2],["2024-10-31",40.46],["2024-11-01",50.49],["2024-11-04",42.43],["2024-11-05",43.54],["2024-11-06",44.0],["2024-11-07",59.06],["2024-11-08",59.43],["2024-11-11",66.6],["2024-11-12",66.71],["2024-11-13",66.31],["2024-11-14",60.31],["2024-11-15",51.2],["2024-11-18",50.29],["2024-11-19",49.51],["2024-11-20",49.51],["2024-11-21",56.6],["2024-11-22",60.71],["2024-11-25",62.89],["2024-11-26",65.91],["2024-11-27",64.4],["2024-11-29",65.0],["2024-12-02",65.31],["2024-12-03",59.57],["2024-12-04",57.49],["2024-12-05",54.91],["2024-12-06",52.14],["2024-12-09",49.26],["2024-12-10",46.97],["2024-12-11",49.2],["2024-12-12",47.11],["2024-12-13",49.11],["2024-12-16",56.06],["2024-12-17",51.4],["2024-12-18",33.13],["2024-12-19",19.51],["2024-12-20",27.6],["2024-12-23",30.14],["2024-12-24",34.51],["2024-12-26",34.17],["2024-12-27",33.83],["2024-12-30",28.6],["2024-12-31",26.31],["2025-01-02",24.31],["2025-01-03",28.89],["2025-01-06",33.77],["2025-01-07",34.31],["2025-01-08",31.91],["2025-01-10",25.63],["2025-01-13",25.34],["2025-01-14",25.14],["2025-01-15",27.43],["2025-01-16",27.34],["2025-01-17",36.03],["2025-01-21",39.91],["2025-01-22",41.63],["2025-01-23",43.69],["2025-01-24",45.8],["2025-01-27",37.97],["2025-01-28",40.63],["2025-01-29",42.4],["2025-01-30",45.91],["2025-01-31",43.77],["2025-02-03",37.4],["2025-02-04",37.14],["2025-02-05",38.63],["2025-02-06",39.69],["2025-02-07",38.37],["2025-02-10",44.71],["2025-02-11",45.4],["2025-02-12",41.37],["2025-02-13",46.6],["2025-02-14",43.69],["2025-02-18",46.8],["2025-02-19",47.63],["2025-02-20",44.23],["2025-02-21",36.97],["2025-02-24",29.54],["2025-02-25",24.2],["2025-02-26",21.26],["2025-02-27",12.76],["2025-02-28",20.66],["2025-03-03",12.34],["2025-03-04",11.04],["2025-03-05",11.51],["2025-03-06",17.2],["2025-03-07",17.64],["2025-03-10",17.07],["2025-03-11",15.11],["2025-03-12",15.91],["2025-03-13",15.19],["2025-03-14",22.06],["2025-03-17",22.57],["2025-03-18",22.23],["2025-03-19",21.6],["2025-03-20",21.69],["2025-03-21",22.69],["2025-03-24",25.4],["2025-03-25",29.29],["2025-03-26",28.89],["2025-03-27",28.34],["2025-03-28",26.37],["2025-03-31",21.11],["2025-04-01",19.57],["2025-04-02",22.6],["2025-04-03",12.14],["2025-04-04",5.39],["2025-04-07",4.0],["2025-04-08",2.9],["2025-04-09",9.5],["2025-04-10",5.61],["2025-04-11",8.39],["2025-04-14",12.34],["2025-04-15",13.11],["2025-04-16",11.14],["2025-04-17",16.06],["2025-04-21",12.37],["2025-04-22",13.6],["2025-04-23",21.54],["2025-04-24",24.09],["2025-04-25",34.51],["2025-04-28",32.14],["2025-04-29",32.74],["2025-04-30",32.37],["2025-05-01",41.26],["2025-05-02",38.29],["2025-05-05",53.06],["2025-05-06",54.66],["2025-05-07",54.14],["2025-05-08",57.66],["2025-05-09",60.03],["2025-05-12",64.49],["2025-05-13",68.2],["2025-05-14",70.4],["2025-05-15",69.14],["2025-05-16",70.6],["2025-05-19",69.74],["2025-05-20",69.17],["2025-05-21",66.23],["2025-05-22",66.8],["2025-05-23",64.09],["2025-05-27",65.74],["2025-05-28",64.74],["2025-05-29",64.46],["2025-05-30",61.91],["2025-06-02",62.43],["2025-06-03",54.57],["2025-06-04",54.89],["2025-06-05",57.97],["2025-06-06",61.77],["2025-06-09",63.43],["2025-06-10",64.0],["2025-06-11",64.2],["2025-06-12",64.6],["2025-06-13",59.54],["2025-06-16",61.11],["2025-06-17",57.43],["2025-06-18",54.29],["2025-06-20",54.51],["2025-06-23",56.6],["2025-06-24",57.89],["2025-06-25",59.26],["2025-06-26",63.0],["2025-06-27",64.8],["2025-06-30",69.23],["2025-07-01",67.54],["2025-07-02",63.71],["2025-07-03",77.63],["2025-07-07",75.09],["2025-07-08",74.63],["2025-07-09",75.91],["2025-07-10",76.97],["2025-07-11",75.26],["2025-07-14",76.11],["2025-07-15",73.49],["2025-07-16",72.94],["2025-07-17",74.17],["2025-07-18",73.94],["2025-07-21",73.29],["2025-07-22",73.89],["2025-07-23",76.37],["2025-07-24",75.26],["2025-07-25",74.66],["2025-07-28",73.8],["2025-07-29",70.63],["2025-07-30",68.03],["2025-07-31",63.71],["2025-08-01",49.8],["2025-08-04",56.89],["2025-08-05",55.03],["2025-08-06",55.31],["2025-08-07",54.71],["2025-08-08",58.37],["2025-08-11",57.63],["2025-08-12",62.26],["2025-08-13",63.34],["2025-08-14",63.26],["2025-08-15",63.54],["2025-08-18",64.2],["2025-08-19",59.89],["2025-08-20",55.91],["2025-08-21",52.6],["2025-08-22",55.54],["2025-08-25",53.94],["2025-08-26",55.4],["2025-08-27",59.11],["2025-08-28",64.43],["2025-08-29",61.54],["2025-09-02",62.46],["2025-09-03",61.37],["2025-09-04",61.17],["2025-09-05",58.69],["2025-09-08",58.23],["2025-09-09",57.94],["2025-09-10",57.94],["2025-09-11",60.34],["2025-09-12",61.34],["2025-09-15",64.46],["2025-09-16",64.37],["2025-09-17",63.77],["2025-09-18",66.54],["2025-09-19",66.23],["2025-09-22",66.51],["2025-09-23",56.77],["2025-09-24",54.57],["2025-09-25",50.66],["2025-09-26",51.29],["2025-09-29",50.97],["2025-09-30",51.4],["2025-10-01",52.49],["2025-10-02",54.54],["2025-10-03",52.57],["2025-10-06",53.97],["2025-10-07",51.86],["2025-10-08",52.94],["2025-10-09",48.63],["2025-10-10",30.14],["2025-10-13",29.74],["2025-10-14",28.29],["2025-10-15",27.41],["2025-10-16",23.11],["2025-10-17",22.33],["2025-10-20",29.86],["2025-10-21",28.54],["2025-10-22",26.37],["2025-10-23",27.57],["2025-10-24",32.46],["2025-10-27",37.34],["2025-10-28",39.34],["2025-10-29",42.11],["2025-10-30",37.06],["2025-10-31",34.46],["2025-11-03",32.6],["2025-11-04",20.94],["2025-11-05",23.06],["2025-11-06",24.34],["2025-11-07",20.43],["2025-11-10",29.94],["2025-11-11",30.46],["2025-11-12",34.57],["2025-11-13",24.54],["2025-11-14",22.06],["2025-11-17",11.64],["2025-11-18",8.9],["2025-11-19",7.86],["2025-11-20",5.17],["2025-11-21",5.66],["2025-11-24",13.69],["2025-11-25",15.03],["2025-11-26",17.66],["2025-11-28",21.77],["2025-12-01",22.09],["2025-12-02",23.26],["2025-12-03",24.77],["2025-12-04",36.03],["2025-12-05",38.14],["2025-12-08",40.77],["2025-12-09",40.94],["2025-12-10",36.37],["2025-12-11",43.74],["2025-12-12",39.29],["2025-12-15",49.31],["2025-12-16",46.4],["2025-12-17",37.69],["2025-12-18",42.37],["2025-12-19",44.2],["2025-12-22",54.89],["2025-12-23",58.57],["2025-12-24",58.0],["2025-12-26",54.86],["2025-12-29",47.89],["2025-12-30",46.11],["2025-12-31",43.26],["2026-01-02",45.23],["2026-01-05",47.6],["2026-01-06",52.86],["2026-01-07",48.57],["2026-01-08",48.37],["2026-01-09",54.11],["2026-01-12",58.0],["2026-01-13",59.09],["2026-01-14",58.63],["2026-01-15",63.66],["2026-01-16",63.77],["2026-01-20",50.86],["2026-01-21",53.86],["2026-01-22",54.77],["2026-01-23",54.89],["2026-01-26",57.66],["2026-01-27",64.97],["2026-01-28",65.54],["2026-01-29",63.83],["2026-01-30",58.6],["2026-02-02",63.4],["2026-02-03",43.34],["2026-02-04",47.23],["2026-02-05",34.94],["2026-02-06",45.37],["2026-02-09",48.49],["2026-02-10",47.23],["2026-02-11",49.91],["2026-02-12",36.36],["2026-02-13",33.84],["2026-02-17",33.31],["2026-02-18",34.16],["2026-02-19",34.4],["2026-02-20",42.34],["2026-02-23",32.54],["2026-02-24",40.26],["2026-02-25",43.14],["2026-02-26",42.91],["2026-02-27",41.17],["2026-03-02",34.29],["2026-03-03",31.63],["2026-03-04",33.07],["2026-03-05",31.63],["2026-03-06",25.26],["2026-03-09",22.23],["2026-03-10",20.27],["2026-03-11",18.31],["2026-03-13",16.67],["2026-03-16",23.91],["2026-03-17",22.89],["2026-03-18",13.61],["2026-03-19",18.31],["2026-03-20",8.4],["2026-03-23",11.63],["2026-03-24",10.36],["2026-03-25",16.54],["2026-03-26",10.26],["2026-03-27",8.17],["2026-03-30",5.77],["2026-03-31",14.89],["2026-04-01",15.86],["2026-04-02",18.29],["2026-04-06",21.86],["2026-04-07",21.57],["2026-04-08",29.17],["2026-04-09",33.8],["2026-04-10",38.06],["2026-04-13",40.97],["2026-04-14",47.26],["2026-04-15",56.2],["2026-04-16",61.49],["2026-04-17",68.57],["2026-04-20",69.97],["2026-04-21",67.57],["2026-04-22",68.46],["2026-04-23",66.17],["2026-04-24",65.4],["2026-04-27",66.29],["2026-04-28",67.43],["2026-04-29",66.23],["2026-04-30",69.51],["2026-05-01",71.17],["2026-05-04",66.89],["2026-05-05",67.26],["2026-05-06",68.74],["2026-05-07",67.29],["2026-05-08",67.29],["2026-05-11",66.63],["2026-05-12",65.69],["2026-05-13",64.97],["2026-05-14",65.91],["2026-05-15",63.23],["2026-05-18",62.09],["2026-05-19",59.26],["2026-05-20",60.51],["2026-05-21",57.51],["2026-05-22",58.23],["2026-05-26",59.83],["2026-05-27",60.63],["2026-05-28",60.71],["2026-05-29",60.46],["2026-06-01",59.46],["2026-06-02",56.97],["2026-06-03",54.63],["2026-06-04",54.57],["2026-06-05",41.86],["2026-06-08",39.37],["2026-06-09",33.77],["2026-06-10",27.29],["2026-06-11",29.69],["2026-06-12",33.51],["2026-06-15",40.14],["2026-06-16",39.51],["2026-06-17",32.94],["2026-06-18",37.34],["2026-06-22",33.94],["2026-06-23",28.46],["2026-06-24",26.46],["2026-06-25",25.43],["2026-06-26",24.66],["2026-06-29",26.86],["2026-06-30",29.97],["2026-07-01",31.63],["2026-07-02",32.54],["2026-07-06",41.66],["2026-07-07",39.77],["2026-07-08",38.63],["2026-07-09",44.71],["2026-07-10",46.83],["2026-07-13",40.86],["2026-07-14",41.06],["2026-07-15",44.43],["2026-07-16",41.86],["2026-07-17",37.0],["2026-07-20",36.0],["2026-07-21",42.77],["2026-07-22",44.43],["2026-07-23",40.86],["2026-07-24",40.77],["2026-07-27",38.23],["2026-07-28",37.14],["2026-07-29",25.56],["2026-07-30",38.11],["2026-07-31",39.57],["2026-08-03",46.14],["2026-08-04",58.97],["2026-08-05",60.23],["2026-08-06",59.69],["2026-08-07",65.14],["2026-08-10",64.37],["2026-08-11",60.09],["2026-08-12",61.69],["2026-08-13",66.11],["2026-08-14",64.31],["2026-08-17",59.14],["2026-08-18",54.63],["2026-08-19",56.63],["2026-08-20",51.37],["2026-08-21",54.66],["2026-08-24",54.97],["2026-08-25",59.6],["2026-08-26",53.94],["2026-08-27",57.31],["2026-08-28",53.74],["2026-08-31",49.2],["2026-09-01",44.86],["2026-09-02",46.06],["2026-09-03",47.51],["2026-09-04",45.23],["2026-09-08",39.14],["2026-09-09",38.2],["2026-09-10",32.2],["2026-09-11",33.34]];

async function fgDailyHistory(){
  const xlsPoints=FG_XLS_DATA.map(([d,v])=>({t:new Date(d+'T00:00:00Z').getTime(), score:v}));
  let livePoints=[];
  try{
    const j=await getJSON(CNN_URL);
    const hist=(j.fear_and_greed_historical||{}).data||[];
    livePoints=hist.map(x=>({t:(+x.x)>1e12?+x.x:(+x.x)*1000, score:+x.y}));
  }catch(e){ console.warn('CNN 히스토리 연동 실패, xlsx 검증 구간만 사용:', e.message); }
  const merged={};
  livePoints.forEach(p=>{ merged[p.t]=p; });
  xlsPoints.forEach(p=>{ merged[p.t]=p; }); // 겹치는 날짜는 xlsx 값이 우선(검증된 값)
  const out=Object.values(merged).sort((a,b)=>a.t-b.t);
  return out.length?out:null;
}

async function runTradeBacktest(opts){
  opts = opts || {};
  const principalRecoveryMode = !!opts.principalRecovery;
  const dualSniperMode = !!opts.dualSniper;
  const [qld,usd,schd,qqq,tqqq,fg]=await Promise.all([
    yDailySeries('QLD'), yDailySeries('USD'), yDailySeries('SCHD'), yDailySeries('QQQ'), yDailySeries('TQQQ'), fgDailyHistory()
  ]);
  const missing=[];
  if(!qld) missing.push('QLD 시세(Yahoo)');
  if(!usd) missing.push('USD 시세(Yahoo)');
  if(!schd) missing.push('SCHD 시세(Yahoo)');
  if(!fg) missing.push('공포탐욕지수 히스토리(CNN)');
  if(missing.length) return {error:missing};
  /* QQQ/TQQQ 실패는 벤치마크 비교선만 못 그리는 것이라 백테스트 자체를 막지는 않는다 */

  const data={QLD:qld, USD:usd, SCHD:schd};
  const tradingTs=qld.series.map(p=>p.t).slice().sort((a,b)=>a-b);
  if(!tradingTs.length) return {error:['QLD 시세(거래일 없음)']};

  const priceMap={};
  TRADE_TICKERS.forEach(t=>{ priceMap[t]={}; data[t].series.forEach(p=>{ priceMap[t][p.t]=p.close; }); });
  const qqqPriceMap={}, tqqqPriceMap={};
  if(qqq) qqq.series.forEach(p=>{ qqqPriceMap[p.t]=p.close; });
  if(tqqq) tqqq.series.forEach(p=>{ tqqqPriceMap[p.t]=p.close; });

  function buildDivMap(dividends){
    const m={};
    (dividends||[]).forEach(d=>{
      let mapped=tradingTs.find(ts=>ts>=d.t);
      if(mapped==null) mapped=tradingTs[tradingTs.length-1];
      m[mapped]=(m[mapped]||0)+d.amount;
    });
    return m;
  }
  const divMap={};
  TRADE_TICKERS.forEach(t=>{ divMap[t]=buildDivMap(data[t].dividends); });
  const qqqDivMap=qqq?buildDivMap(qqq.dividends):{};
  const tqqqDivMap=tqqq?buildDivMap(tqqq.dividends):{};

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

  /* 연말 리밸런싱 대상일: 데이터 범위 안에서 "완결된" 연도의 마지막 거래일만(마지막 해는 아직
     연말이 지나지 않았을 수 있어 제외) — 투자기간이 1년을 넘는 경우에만 자연히 1개 이상 생긴다 */
  const yearMaxTs={};
  tradingTs.forEach(ts=>{ const y=new Date(ts).getUTCFullYear(); if(!yearMaxTs[y]||ts>yearMaxTs[y]) yearMaxTs[y]=ts; });
  const datasetLastTs=tradingTs[tradingTs.length-1];
  const rebalanceDays=new Set();
  Object.values(yearMaxTs).forEach(ts=>{ if(ts!==datasetLastTs) rebalanceDays.add(ts); });
  const REBAL_TARGET={QLD:0.40, USD:0.40, SCHD:0.20};

  let shares={QLD:0,USD:0,SCHD:0};
  let cumCost=0, cumDividend=0, buyCount=0;
  const monthly={};
  const curve=[];
  let prevMonthKey=null, monthStartValue=0, monthStartCost=0;
  /* 벤치마크: 실제 전략이 그날 지출한 것과 동일한 금액을 QQQ/QLD/TQQQ 단독매수에 썼다면 가정 */
  let bmQqqShares=0, bmQldShares=0, bmTqqqShares=0;
  let bmQqqDiv=0, bmQldDiv=0, bmTqqqDiv=0;
  let globalPeak=0; /* 낙폭(underwater) 그래프용 — 리셋되지 않는 전체 기간 누적 최고점(배당 포함 총수익 기준) */
  let bmQldPeak=0, bmTqqqPeak=0, bmQqqPeak=0; /* QQQ·QLD·TQQQ 단독매수 벤치마크의 낙폭 계산용 최고점 */
  let principalRecoveredTs=null; /* 누적 배당금만으로 누적원금을 회수한 첫 거래일(데이터 구간 내에서 도달 못하면 null) */

  /* [옵션] 원금 100% 회수: 평가금이 "현재 순원금(=누적원금-기존 회수금)"의 2배에 도달할 때마다
     그 순원금만큼 비례 매도해 현금화하고(recoveredCash) 남은 평가금으로 동일 조건 매수를
     계속한다. 조건이 다시 충족되면 몇 번이든 반복(차수별 기록)된다. */
  let recoveredCash=0;
  const recoveryEvents=[]; // {t, amount, round}

  /* [옵션] 듀얼스나이퍼: 기본 전략(QLD/USD/SCHD, 배당 포함)만의 낙폭이 15%를 넘으면 매일
     TQQQ 5,000달러, 30%를 넘으면 매일 TQQQ 10,000달러를 추가 매수한다(중복이 아니라 구간
     교체). 15% 미만으로 회복하면 매수를 멈춘다. 이 TQQQ 포지션은 연말 리밸런싱에서 제외된다.
     포지션 수익률이 200%에 도달하면 잔고의 25%를 매도하고, 이후 100%p 구간마다(300%,400%…)
     다시 잔고의 25%씩 매도한다(매도분 원가도 비례 차감). */
  let basePeak=0, sniperShares=0, sniperCost=0, sniperRealizedCash=0, sniperNextSellPct=200;

  tradingTs.forEach(ts=>{
    const d=new Date(ts);
    const mk=d.getUTCFullYear()+'-'+String(d.getUTCMonth()+1).padStart(2,'0');
    if(mk!==prevMonthKey){
      monthly[mk]={buys:0, dividends:0, startValue:monthStartValue, startCost:monthStartCost, endValue:0, endCost:0, peak:monthStartValue||0, mdd:0, divEvents:[]};
      prevMonthKey=mk;
    }
    { let dayDivAmt=0;
      TRADE_TICKERS.forEach(t=>{
        const dv=divMap[t][ts];
        if(dv && shares[t]>0){ const amt=dv*shares[t]; cumDividend+=amt; monthly[mk].dividends+=amt; dayDivAmt+=amt; }
      });
      if(dayDivAmt>0) monthly[mk].divEvents.push({t:ts, amount:dayDivAmt});
    }
    /* 벤치마크 배당도 동일하게 누적(총수익 비교를 위해) */
    { const dv=qqqDivMap[ts]; if(dv && bmQqqShares>0) bmQqqDiv+=dv*bmQqqShares; }
    { const dv=divMap.QLD[ts]; if(dv && bmQldShares>0) bmQldDiv+=dv*bmQldShares; }
    { const dv=tqqqDivMap[ts]; if(dv && bmTqqqShares>0) bmTqqqDiv+=dv*bmTqqqShares; }

    const score=scoreAt(ts);
    let qty=0;
    if(score<25) qty=4;
    else if(fridayBuyDays.has(ts)){
      if(score<45) qty=2;
      else if(score<=55) qty=1;
      else qty=0;
    }
    let dailySpend=0;
    if(qty>0){
      let bought=false;
      TRADE_TICKERS.forEach(t=>{
        const px=priceMap[t][ts]; if(px==null) return;
        shares[t]+=qty; cumCost+=px*qty; dailySpend+=px*qty; bought=true;
      });
      if(bought){ buyCount++; monthly[mk].buys++; }
    }
    if(dailySpend>0){
      const qqqPx=qqqPriceMap[ts]; if(qqqPx) bmQqqShares+=dailySpend/qqqPx;
      const qldPx=priceMap.QLD[ts]; if(qldPx) bmQldShares+=dailySpend/qldPx;
      const tqqqPx=tqqqPriceMap[ts]; if(tqqqPx) bmTqqqShares+=dailySpend/tqqqPx;
    }

    let value=0;
    TRADE_TICKERS.forEach(t=>{ const px=priceMap[t][ts]; if(px!=null) value+=shares[t]*px; });

    /* 연말 리밸런싱: 보유 3종목 시가(배당 제외)를 QLD 40% · USD 40% · SCHD 20% 로 재배분
       (스나이퍼 TQQQ 포지션은 이 로직과 완전히 분리되어 있어 자연히 제외된다) */
    if(rebalanceDays.has(ts) && value>0){
      TRADE_TICKERS.forEach(t=>{
        const px=priceMap[t][ts]; if(px==null) return;
        shares[t]=(value*REBAL_TARGET[t])/px;
      });
      value=0;
      TRADE_TICKERS.forEach(t=>{ const px=priceMap[t][ts]; if(px!=null) value+=shares[t]*px; });
    }

    const tqqqPxNow0=tqqqPriceMap[ts];

    /* 듀얼스나이퍼: 기본 전략(QLD/USD/SCHD, 배당 포함)만의 낙폭으로 매수 트리거 판단 */
    const baseTotal=value+cumDividend;
    basePeak=Math.max(basePeak,baseTotal);
    const baseDD=basePeak>0?(basePeak-baseTotal)/basePeak*100:0;
    if(dualSniperMode){
      const tqDiv=tqqqDivMap[ts];
      if(tqDiv && sniperShares>0){ const amt=tqDiv*sniperShares; cumDividend+=amt; monthly[mk].dividends+=amt; monthly[mk].divEvents.push({t:ts, amount:amt}); }
      let sniperBuy=0;
      if(baseDD>30) sniperBuy=10000;
      else if(baseDD>15) sniperBuy=5000;
      if(sniperBuy>0 && tqqqPxNow0){
        sniperShares+=sniperBuy/tqqqPxNow0;
        sniperCost+=sniperBuy;
        cumCost+=sniperBuy; // 실제 투입 자금이므로 누적원금에 포함
      }
      /* 스나이퍼 매도: 포지션 수익률이 다음 임계치(200%→300%→400%…)에 도달하면 잔고의 25% 매도 */
      if(sniperShares>0 && tqqqPxNow0 && sniperCost>0){
        const sniperValueChk=sniperShares*tqqqPxNow0;
        const sniperProfitPct=(sniperValueChk/sniperCost-1)*100;
        if(sniperProfitPct>=sniperNextSellPct){
          const soldShares=sniperShares*0.25;
          const soldValue=soldShares*tqqqPxNow0;
          sniperShares-=soldShares;
          sniperCost*=0.75; // 매도분만큼 원가도 비례 차감(잔여 포지션 평단가 유지)
          sniperRealizedCash+=soldValue;
          sniperNextSellPct+=100;
        }
      }
    }

    /* 원금 100% 회수: 포트폴리오 시작 시점 기준으로 딱 1회만 수행한다고 가정한다.
       평가금(배당 포함)이 최초 순원금의 2배에 처음 도달하는 순간, 그 순원금만큼 비례
       매도해 현금화한다(스나이퍼 TQQQ 포지션은 건드리지 않음). 이후에는 다시 조건이
       충족되어도 재실행하지 않는다. */
    if(principalRecoveryMode && recoveryEvents.length===0){
      const netCost=cumCost-recoveredCash;
      if(netCost>0 && value>0 && (value+cumDividend)>=2*netCost){
        const sellRatio=Math.min(1, netCost/value);
        TRADE_TICKERS.forEach(t=>{ shares[t]*=(1-sellRatio); });
        value-=netCost;
        recoveredCash+=netCost;
        recoveryEvents.push({t:ts, amount:netCost, round:1});
      }
    }

    const sniperValueNow=tqqqPxNow0?sniperShares*tqqqPxNow0:0;
    const displayCost=cumCost-recoveredCash; // 회수한 원금은 더 이상 투입원금으로 잡지 않는다
    const totalValue=value+cumDividend+recoveredCash+sniperValueNow+sniperRealizedCash; // 평가금(배당·회수현금·스나이퍼 포함 총수익)
    const qqqPxNow=qqqPriceMap[ts], qldPxNow=priceMap.QLD[ts], tqqqPxNow=tqqqPxNow0;
    globalPeak=Math.max(globalPeak,totalValue);
    const dd=globalPeak>0?(globalPeak-totalValue)/globalPeak*100:0;

    /* QLD·TQQQ 단독매수 벤치마크의 낙폭(MDD)도 전략과 같은 방식(총수익 기준, 리셋 없는
       전체 기간 최고점 대비)으로 계산해 나란히 비교할 수 있게 한다 */
    const bmQldValue=qldPxNow!=null?(bmQldShares*qldPxNow+bmQldDiv):null;
    const bmTqqqValue=tqqqPxNow!=null?(bmTqqqShares*tqqqPxNow+bmTqqqDiv):null;
    const bmQqqValue=qqqPxNow!=null?(bmQqqShares*qqqPxNow+bmQqqDiv):null;
    if(bmQldValue!=null) bmQldPeak=Math.max(bmQldPeak,bmQldValue);
    if(bmTqqqValue!=null) bmTqqqPeak=Math.max(bmTqqqPeak,bmTqqqValue);
    if(bmQqqValue!=null) bmQqqPeak=Math.max(bmQqqPeak,bmQqqValue);
    const bmQldDD=(bmQldValue!=null && bmQldPeak>0)?(bmQldPeak-bmQldValue)/bmQldPeak*100:null;
    const bmTqqqDD=(bmTqqqValue!=null && bmTqqqPeak>0)?(bmTqqqPeak-bmTqqqValue)/bmTqqqPeak*100:null;
    const bmQqqDD=(bmQqqValue!=null && bmQqqPeak>0)?(bmQqqPeak-bmQqqValue)/bmQqqPeak*100:null;

    /* 누적원금 회수 시점: 원금 대비 수익률(평가금 기준) 100% 달성 시점 — 평가금(배당 포함)이
       그 시점까지의 누적원금의 2배에 처음 도달한 날 */
    if(principalRecoveredTs==null && cumCost>0 && totalValue>=2*cumCost) principalRecoveredTs=ts;

    curve.push({
      t:ts, cost:displayCost, value:totalValue, dd, cumDividend,
      bmQqq: qqqPxNow!=null?(bmQqqShares*qqqPxNow+bmQqqDiv):null,
      bmQld: bmQldValue, bmTqqq: bmTqqqValue,
      bmQldDD, bmTqqqDD, bmQqqDD,
      rebalanced: rebalanceDays.has(ts)
    });
    const mObj=monthly[mk];
    mObj.endValue=totalValue; mObj.endCost=displayCost;
    mObj.peak=Math.max(mObj.peak,totalValue);
    if(mObj.peak>0){ const mdd_=(mObj.peak-totalValue)/mObj.peak; if(mdd_>mObj.mdd) mObj.mdd=mdd_; }
    monthStartValue=totalValue; monthStartCost=displayCost;
  });

  /* 연도별 집계(월별 데이터를 연 단위로 묶음) */
  const yearly={};
  Object.keys(monthly).sort().forEach(mk=>{
    const y=mk.slice(0,4);
    if(!yearly[y]) yearly[y]={startValue:monthly[mk].startValue, startCost:monthly[mk].startCost, endValue:0, endCost:0, dividends:0, buys:0};
    yearly[y].endValue=monthly[mk].endValue;
    yearly[y].endCost=monthly[mk].endCost;
    yearly[y].dividends+=monthly[mk].dividends;
    yearly[y].buys+=monthly[mk].buys;
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

  /* 연간 예상 수령 배당금: 현재 보유 수량 × 최근 12개월간 종목별 배당(주당) 합계 */
  const lastTs=tradingTs.length?tradingTs[tradingTs.length-1]:Date.now();
  const oneYearAgoTs=lastTs-365*86400000;
  let annualDividendEst=0;
  TRADE_TICKERS.forEach(t=>{
    if(shares[t]<=0) return;
    const perShare12m=(data[t].dividends||[]).filter(d=>d.t>oneYearAgoTs && d.t<=lastTs).reduce((s,d)=>s+d.amount,0);
    annualDividendEst+=perShare12m*shares[t];
  });

  return {
    curve, monthly, yearly, buyCount, cumDividend,
    finalCost:cumCost-recoveredCash, finalValue:curve.length?curve[curve.length-1].value:0,
    nextDiv, didRebalance:rebalanceDays.size>0,
    annualDividendEst, principalRecoveredTs,
    principalRecoveryMode, dualSniperMode, recoveredCash, recoveryEvents,
    sniperCost, sniperShares, sniperRealizedCash
  };
}

function fmtUSD(n){ return '$'+Math.round(n).toLocaleString('en-US'); }

/* 낙폭 15% 이상 구간에 실제 어떤 사건이 있었는지 참고용으로 매칭한다. 추측으로 날짜를
   끼워 맞추지 않기 위해, 실제로 널리 보도된 시장 충격 구간만 아래 표에 등록해두고
   구간이 겹치지 않으면 "특정 사건과 자동 매칭되지 않음"이라고 솔직하게 표시한다. */
const MARKET_STRESS_TIMELINE=[
  {start:'2022-01-01', end:'2022-10-31', label:'2022년 연준 고강도 금리인상·인플레이션 쇼크',
   note:'연준이 인플레이션을 잡기 위해 자이언트 스텝(75bp)을 포함한 공격적 금리인상을 이어가며\n성장주·반도체가 한 해 내내 큰 폭으로 조정받았던 구간입니다.'},
  {start:'2022-11-01', end:'2022-12-31', label:'2022년 말 긴축 장기화 우려·FTX 파산 여파',
   note:'연준의 긴축 기조가 예상보다 오래갈 것이라는 우려가 이어졌고,\n11월 FTX 파산으로 위험자산 전반의 투자심리가 위축됐던 구간입니다.'},
  {start:'2023-03-01', end:'2023-03-31', label:'2023년 3월 미국 지역은행 위기(SVB 등)',
   note:'실리콘밸리은행(SVB) 등 지역은행 파산을 계기로\n금융시스템 리스크 우려가 번지며 단기간 급락이 발생했던 구간입니다.'},
  {start:'2023-08-01', end:'2023-10-31', label:'2023년 가을 미국 국채금리 급등(고금리 장기화 우려)',
   note:'미 10년물 국채금리가 급등하며 "higher for longer"(고금리 장기화) 우려가 커졌고,\n밸류에이션 부담이 큰 성장주·반도체가 조정받았던 구간입니다.'},
  {start:'2024-04-01', end:'2024-04-30', label:'2024년 4월 금리인하 지연 실망 조정',
   note:'예상보다 미뤄지는 연준의 금리인하 시점에 시장이 실망하며\n기술주 중심으로 단기 조정이 나타났던 구간입니다.'},
  {start:'2024-07-15', end:'2024-08-20', label:'2024년 8월 엔캐리트레이드 청산 쇼크',
   note:'일본은행 금리인상과 엔화 강세로 엔캐리트레이드 청산 우려가 커지며(8월 5일 전후)\n글로벌 증시, 특히 반도체주가 급락했던 구간입니다.'},
  {start:'2025-01-24', end:'2025-02-10', label:'2025년 1월 딥시크(DeepSeek) 쇼크',
   note:'중국 AI 스타트업 딥시크가 저비용으로 고성능 모델을 공개하며\n"빅테크의 대규모 AI 투자가 과도한 것 아니냐"는 우려가 불거졌고,\n1월 27일 하루 만에 엔비디아가 약 17%, 필라델피아 반도체지수가 약 9% 급락했던 구간입니다.'},
  {start:'2025-03-15', end:'2025-05-15', label:'2025년 4월 미국 상호관세 발표 쇼크',
   note:'미국의 전면적 상호관세 발표로 글로벌 무역전쟁 우려가 커지며\n증시 전반이 급락했던 구간입니다.'},
  {start:'2025-07-15', end:'2025-09-30', label:'2025년 여름 반도체 관세(무역확장법 232조) 우려',
   note:'반도체 수입품에 대한 별도 관세 부과 우려(최대 300% 언급)가 커지며\n반도체 업종 중심으로 조정이 나타났던 구간입니다.'}
];
function matchMarketStressEvent(troughTs){
  for(const ev of MARKET_STRESS_TIMELINE){
    if(troughTs>=new Date(ev.start+'T00:00:00Z').getTime() && troughTs<=new Date(ev.end+'T23:59:59Z').getTime()) return ev;
  }
  return null;
}
/* 정확히 겹치는 구간이 없을 때, 가장 날짜가 가까운 사건을 참고용으로 찾는다(정확한 매칭이 아님을 항상 명시) */
function nearestMarketStressEvent(troughTs){
  let best=null, bestDist=Infinity;
  MARKET_STRESS_TIMELINE.forEach(ev=>{
    const mid=(new Date(ev.start).getTime()+new Date(ev.end).getTime())/2;
    const dist=Math.abs(troughTs-mid);
    if(dist<bestDist){ bestDist=dist; best=ev; }
  });
  if(!best) return null;
  const days=Math.round(bestDist/86400000);
  return {ev:best, days};
}
/* dd(고점 대비 낙폭%)가 threshold 이상으로 올라간 구간을 찾아 시작·저점(최대낙폭)·종료(회복) 시점을 반환 */
function detectDrawdownEpisodes(curve, threshold){
  threshold=threshold||15;
  const episodes=[];
  let cur=null;
  curve.forEach(p=>{
    const dd=p.dd||0;
    if(!cur && dd>=threshold){
      cur={startTs:p.t, troughTs:p.t, troughDD:dd, endTs:null};
    }else if(cur){
      if(dd>cur.troughDD){ cur.troughDD=dd; cur.troughTs=p.t; }
      if(dd<3){ cur.endTs=p.t; episodes.push(cur); cur=null; }
    }
  });
  if(cur) episodes.push(cur); // 데이터 마지막까지 회복이 안 된 채 끝난 경우
  return episodes;
}

function renderBacktest(res){
  const statusEl=document.getElementById('bt-status');
  if(!res || res.error || !res.curve || !res.curve.length){
    const reason=(res&&res.error)?res.error.join(', ')+' 연동 실패':'알 수 없는 오류';
    if(statusEl) statusEl.textContent='⚠ '+reason+' — PROXY_BASE에 설정한 Worker 주소가 살아있는지, 코드가 정확히 배포됐는지 확인해주세요.';
    return;
  }
  if(statusEl) statusEl.textContent=BACKTEST_START_YEAR+'-01-01 ~ '+new Date(res.curve[res.curve.length-1].t).toLocaleDateString('ko-KR')+' 실제 시세 기준 계산 결과입니다.';

  const rebalNoteEl=document.getElementById('bt-rebal-note');
  if(rebalNoteEl) rebalNoteEl.textContent=res.didRebalance
    ? '📌 투자기간 1년 초과 시 리밸런싱이 반영되었습니다.'
    : '';

  function fmtUSDKRW(usd){
    if(!krwDisplayOn) return fmtUSD(usd); // 토글이 꺼져 있으면 달러만(stock.html·crypto.html과 동일 구조)
    const krw=fmtKRW(usd);
    return krw ? fmtUSD(usd)+' ('+krw+')' : fmtUSD(usd);
  }

  const optSummaryEl=document.getElementById('bt-opt-summary');
  if(optSummaryEl){
    const parts=[];
    if(res.principalRecoveryMode){
      parts.push(res.recoveredCash>0
        ? '원금 100% 회수: '+fmtUSDKRW(res.recoveredCash)+' 현금화됨(1회성)'
        : '원금 100% 회수: 아직 조건(평가금 ≥ 순원금의 2배)에 도달하지 않았습니다');
    }
    if(res.dualSniperMode){
      const sniperTotal=res.sniperCost>0||res.sniperRealizedCash>0;
      parts.push(sniperTotal
        ? '듀얼스나이퍼: 추가 매수 '+fmtUSDKRW(res.sniperCost)+' 집행됨'+(res.sniperRealizedCash>0?' · 실현 '+fmtUSDKRW(res.sniperRealizedCash):'')
        : '듀얼스나이퍼: 아직 매수 조건이 발동하지 않았습니다');
    }
    optSummaryEl.textContent=parts.join(' · ');
  }

  /* 수익실현금 카드 — 원금 100% 회수 옵션이 켜져 있을 때만 표시, 차수별 내역 나열 */
  const realizedCardEl=document.getElementById('bt-realized-card');
  if(realizedCardEl){
    if(res.principalRecoveryMode){
      realizedCardEl.style.display='';
      const realizedEl=document.getElementById('bt-realized');
      if(realizedEl) realizedEl.textContent=fmtUSDKRW(res.recoveredCash);
      const roundsEl=document.getElementById('bt-realized-rounds');
      if(roundsEl){
        if(!res.recoveryEvents.length){
          roundsEl.textContent='아직 회수된 차수가 없습니다.';
        }else if(res.recoveryEvents.length>20){
          const last=res.recoveryEvents.slice(-10);
          roundsEl.innerHTML='총 '+res.recoveryEvents.length+'차 발생(강한 상승장에서는 원금이 빠르게 줄어들며 소액 회수가 반복될 수 있습니다) · 최근 10건만 표시<br>'+
            last.map(ev=>ev.round+'차: '+new Date(ev.t).toLocaleDateString('ko-KR')+' · '+fmtUSDKRW(ev.amount)).join('<br>');
        }else{
          roundsEl.innerHTML=res.recoveryEvents.map(ev=>ev.round+'차: '+new Date(ev.t).toLocaleDateString('ko-KR')+' · '+fmtUSDKRW(ev.amount)).join('<br>');
        }
      }
    }else{
      realizedCardEl.style.display='none';
    }
  }

  const bc=document.getElementById('bt-buycount'); if(bc) bc.textContent=res.buyCount+'회';
  const totalValueEl=document.getElementById('bt-total-value'); if(totalValueEl) totalValueEl.textContent=fmtUSDKRW(res.finalValue);
  const costEl=document.getElementById('bt-cost'); if(costEl) costEl.textContent=fmtUSDKRW(res.finalCost);
  const dv=document.getElementById('bt-dividend'); if(dv) dv.textContent=fmtUSDKRW(res.cumDividend);

  /* 원금 대비 배당률 = 누적 배당금 ÷ 누적원금 */
  const divYieldEl=document.getElementById('bt-div-yield');
  if(divYieldEl){
    const dy=res.finalCost>0?(res.cumDividend/res.finalCost*100):0;
    divYieldEl.textContent=dy.toFixed(2)+'%';
  }

  /* 연간 예상 수령 배당금(현재 보유 수량 × 최근 12개월 배당 기준) */
  const annualDivEl=document.getElementById('bt-annual-dividend');
  if(annualDivEl) annualDivEl.textContent=fmtUSDKRW(res.annualDividendEst||0);

  /* 누적원금 회수 시점 — 원금 대비 수익률(평가금 기준) 100% 달성 시점. 데이터 구간 내에서
     이미 도달했으면 그 날짜와 최초 투자일로부터 며칠 걸렸는지(D+일수)를 함께 표시하고,
     아직이면 현재까지의 연환산 수익률(CAGR)로 계속 간다고 가정했을 때 평가금이 원금의
     2배에 도달하는 시점을 단순 추정한다. */
  const recoveryEl=document.getElementById('bt-recovery-date');
  const recoveryCardEl=recoveryEl?recoveryEl.closest('.card'):null;
  const firstTs=res.curve[0].t, lastTs=res.curve[res.curve.length-1].t;
  const dayCount=(a,b)=>Math.round((b-a)/86400000);
  if(recoveryEl){
    if(recoveryCardEl) recoveryCardEl.style.cssText='';
    if(res.principalRecoveredTs){
      const days=dayCount(firstTs,res.principalRecoveredTs);
      recoveryEl.innerHTML=new Date(res.principalRecoveredTs).toLocaleDateString('ko-KR')+' 도달<br>(D+'+days.toLocaleString('ko-KR')+'일)';
      recoveryEl.className='big up';
      if(recoveryCardEl) recoveryCardEl.style.cssText='border:2px solid var(--up);background:rgba(255,77,79,.08)';
    }else if(res.finalValue>=2*res.finalCost){
      const days=dayCount(firstTs,lastTs);
      recoveryEl.innerHTML='도달<br>(D+'+days.toLocaleString('ko-KR')+'일)';
      recoveryEl.className='big up';
      if(recoveryCardEl) recoveryCardEl.style.cssText='border:2px solid var(--up);background:rgba(255,77,79,.08)';
    }else{
      const years=(lastTs-firstTs)/(365*86400000);
      const ratio=res.finalCost>0?res.finalValue/res.finalCost:0;
      const cagr=(years>0.1 && ratio>0)?Math.pow(ratio,1/years)-1:null;
      const elapsedDays=dayCount(firstTs,lastTs);
      if(cagr!=null && cagr>0){
        const extraYears=Math.log(2/ratio)/Math.log(1+cagr);
        if(isFinite(extraYears) && extraYears>0 && extraYears<100){
          const projected=new Date(lastTs);
          projected.setDate(projected.getDate()+Math.round(extraYears*365));
          const totalDays=dayCount(firstTs,projected.getTime());
          recoveryEl.innerHTML='약 '+projected.toLocaleDateString('ko-KR')+' 예상<br>(현재 D+'+elapsedDays.toLocaleString('ko-KR')+'일 경과, 목표 D+'+totalDays.toLocaleString('ko-KR')+'일)';
          recoveryEl.className='big mut';
        }else{
          recoveryEl.innerHTML='추정 불가<br>(현재 D+'+elapsedDays.toLocaleString('ko-KR')+'일 경과)';
          recoveryEl.className='big mut';
        }
      }else{
        recoveryEl.innerHTML='추정 불가(현재 수익률이 마이너스이거나 데이터 부족)<br>(D+'+elapsedDays.toLocaleString('ko-KR')+'일 경과)';
        recoveryEl.className='big mut';
      }
    }
  }
  const recoverySubEl=document.getElementById('bt-recovery-sub');
  if(recoverySubEl) recoverySubEl.textContent=res.principalRecoveredTs
    ? '실제 도달 시점(평가금이 원금의 2배를 처음 넘어선 날, 원금 대비 수익률 100%)'
    : '지금까지의 연환산 수익률(CAGR)이 그대로 이어진다고 가정한 단순 추정치';

  const roi=res.finalCost>0?(res.finalValue/res.finalCost-1)*100:0;
  const roiEl=document.getElementById('bt-roi');
  if(roiEl){
    roiEl.textContent=(roi>=0?'+':'')+roi.toFixed(1)+'%';
    roiEl.className='big '+(roi>=0?'up':'down');
  }
  const roiSub=document.getElementById('bt-roi-sub');
  if(roiSub) roiSub.innerHTML='원금 '+fmtUSDKRW(res.finalCost)+'<br>· 평가금 '+fmtUSDKRW(res.finalValue);

  /* 현재 평가수익금(배당 포함) = 평가금 - 누적원금 */
  const profitAmt=res.finalValue-res.finalCost;
  const profitEl=document.getElementById('bt-profit');
  if(profitEl){
    profitEl.textContent=(profitAmt>=0?'+':'-')+fmtUSDKRW(Math.abs(profitAmt));
    profitEl.className='big '+(profitAmt>=0?'up':'down');
  }
  const profitKrwEl=document.getElementById('bt-profit-krw');
  if(profitKrwEl) profitKrwEl.textContent='평가금(배당포함) - 누적원금';

  /* 수익률 곡선 SVG */
  const curveEl=document.getElementById('bt-curve');
  if(curveEl){
    const w=700,h=240,padL=56,padR=56,padTop=10,padBottom=36;
    const bmQqqVals=res.curve.map(p=>p.bmQqq).filter(v=>v!=null);
    const bmQldVals=res.curve.map(p=>p.bmQld).filter(v=>v!=null);
    const bmTqqqVals=res.curve.map(p=>p.bmTqqq).filter(v=>v!=null);
    const all=res.curve.map(p=>p.cost).concat(res.curve.map(p=>p.value)).concat(bmQqqVals).concat(bmQldVals).concat(bmTqqqVals);
    const min=Math.min(...all,0), max=Math.max(...all,1);
    const n=res.curve.length;
    const stepX=n>1?(w-padL-padR)/(n-1):0;
    const yOf=v=>h-padBottom-((v-min)/((max-min)||1))*(h-padTop-padBottom);
    const ptsCost=res.curve.map((p,i)=>[padL+i*stepX,yOf(p.cost)]);
    const ptsVal=res.curve.map((p,i)=>[padL+i*stepX,yOf(p.value)]);
    const ptsQqq=res.curve.map((p,i)=>p.bmQqq!=null?[padL+i*stepX,yOf(p.bmQqq)]:null).filter(Boolean);
    const ptsQld=res.curve.map((p,i)=>p.bmQld!=null?[padL+i*stepX,yOf(p.bmQld)]:null).filter(Boolean);
    const ptsTqqq=res.curve.map((p,i)=>p.bmTqqq!=null?[padL+i*stepX,yOf(p.bmTqqq)]:null).filter(Boolean);
    const pathOf=pts=>pts.map((p,i)=>(i===0?'M':'L')+p[0].toFixed(1)+','+p[1].toFixed(1)).join(' ');
    const profit=res.finalValue>=res.finalCost;
    const areaPath=ptsVal.length?pathOf(ptsVal)+' L'+ptsVal[ptsVal.length-1][0].toFixed(1)+','+(h-padBottom)+
        ' L'+ptsVal[0][0].toFixed(1)+','+(h-padBottom)+' Z':'';

    /* 기간 중 최고 수익률(원금 대비 평가금, 배당 포함) 시점 탐색 */
    let maxRoi=-Infinity, maxRoiTs=null;
    res.curve.forEach(p=>{
      if(p.cost>0){
        const r=(p.value/p.cost-1)*100;
        if(r>maxRoi){ maxRoi=r; maxRoiTs=p.t; }
      }
    });
    if(maxRoi===-Infinity) maxRoi=0;

    /* 좌우 Y축 눈금(4단계) — 금액 기준선 */
    let yAxis='';
    const tickN=4;
    for(let ti=0;ti<=tickN;ti++){
      const val=min+(max-min)*(ti/tickN);
      const y=yOf(val);
      const lbl=fmtUSD(val);
      yAxis+='<line x1="'+padL+'" y1="'+y.toFixed(1)+'" x2="'+(w-padR)+'" y2="'+y.toFixed(1)+'" stroke="var(--line)" stroke-width="1" stroke-dasharray="2 3" opacity="0.45"/>';
      yAxis+='<text x="'+(padL-8)+'" y="'+(y+3).toFixed(1)+'" font-size="9.5" fill="var(--tx2)" text-anchor="end">'+lbl+'</text>';
      yAxis+='<text x="'+(w-padR+8)+'" y="'+(y+3).toFixed(1)+'" font-size="9.5" fill="var(--tx2)" text-anchor="start">'+lbl+'</text>';
    }

    /* 월별 세로 점선 + 라벨: 2년(24개월) 초과 시에는 라벨이 겹쳐 깨지므로 몇 개월 단위로만 표시 */
    let gridLines='', monthLabels='';
    let prevMk=null, monthIdx=0;
    const monthMarks=[];
    res.curve.forEach((p,i)=>{
      const d=new Date(p.t);
      const mk=d.getUTCFullYear()+'-'+String(d.getUTCMonth()+1).padStart(2,'0');
      if(mk!==prevMk){ monthMarks.push({i,d}); prevMk=mk; }
    });
    const totalMonths=monthMarks.length;
    const labelEvery=totalMonths>24?3:(totalMonths>12?2:1); // 2년 초과: 3개월마다, 1~2년: 2개월마다, 1년 이하: 매월
    monthMarks.forEach((m,idx)=>{
      const x=(padL+m.i*stepX).toFixed(1);
      gridLines+='<line x1="'+x+'" y1="'+padTop+'" x2="'+x+'" y2="'+(h-padBottom)+'" stroke="var(--line)" stroke-width="1" stroke-dasharray="3 3" opacity="'+(idx%labelEvery===0?1:0.35)+'"/>';
      if(idx%labelEvery===0){
        const lbl=(m.d.getUTCMonth()===0)?(m.d.getUTCFullYear()+"'"):(m.d.getUTCMonth()+1)+'월';
        monthLabels+='<text x="'+x+'" y="'+(h-padBottom+16)+'" font-size="10" fill="var(--tx2)" text-anchor="start">'+lbl+'</text>';
      }
    });

    curveEl.innerHTML=
      '<svg viewBox="0 0 '+w+' '+h+'" style="width:100%;height:240px;display:block">'+
      yAxis+
      gridLines+
      '<path d="'+areaPath+'" fill="'+(profit?'rgba(255,77,79,.12)':'rgba(61,157,255,.12)')+'" stroke="none"/>'+
      (ptsQqq.length?'<path d="'+pathOf(ptsQqq)+'" fill="none" stroke="#2dd4bf" stroke-width="1.6" stroke-dasharray="6 3"/>':'')+
      (ptsQld.length?'<path d="'+pathOf(ptsQld)+'" fill="none" stroke="#c084fc" stroke-width="1.6" stroke-dasharray="6 3"/>':'')+
      (ptsTqqq.length?'<path d="'+pathOf(ptsTqqq)+'" fill="none" stroke="#facc15" stroke-width="1.6" stroke-dasharray="6 3"/>':'')+
      '<path d="'+pathOf(ptsCost)+'" fill="none" stroke="var(--tx2)" stroke-width="1.5" stroke-dasharray="4 3"/>'+
      '<path d="'+pathOf(ptsVal)+'" fill="none" stroke="'+(profit?'var(--up)':'var(--down)')+'" stroke-width="2.2"/>'+
      monthLabels+
      '</svg>'+
      '<div class="mut" style="margin-top:8px;font-size:12.5px">기간 중 최고 수익률: <b style="color:var(--up)">+'+maxRoi.toFixed(1)+'%</b>'+(maxRoiTs?' ('+new Date(maxRoiTs).toLocaleDateString('ko-KR')+')':'')+'</div>'+
      '<div style="display:flex;flex-wrap:wrap;gap:10px 18px;margin-top:6px;font-size:12px;color:var(--tx2);min-width:0">'+
      '<span style="white-space:nowrap"><span style="color:'+(profit?'var(--up)':'var(--down)')+'">■</span> 평가금(배당포함, 실제 전략)</span>'+
      '<span style="white-space:nowrap"><span style="color:var(--tx2)">┄</span> 누적 원금</span>'+
      '<span style="white-space:nowrap"><span style="color:#2dd4bf">┄</span> 동일 금액 QQQ(배당포함)</span>'+
      '<span style="white-space:nowrap"><span style="color:#c084fc">┄</span> 동일 금액 QLD(배당포함)</span>'+
      '<span style="white-space:nowrap"><span style="color:#facc15">┄</span> 동일 금액 TQQQ(배당포함)</span>'+
      '</div>';
  }

  /* 낙폭(underwater) 그래프 — 전체 기간 누적 최고점 대비 낙폭(%)을 아래로 그린다 */
  const ddEl=document.getElementById('bt-drawdown');
  if(ddEl){
    const w=700,h=110,padL=56,padR=56,padTop=10;
    const n=res.curve.length;
    const stepX=n>1?(w-padL-padR)/(n-1):0;
    const qldDDVals=res.curve.map(p=>p.bmQldDD).filter(v=>v!=null);
    const tqqqDDVals=res.curve.map(p=>p.bmTqqqDD).filter(v=>v!=null);
    const qqqDDVals=res.curve.map(p=>p.bmQqqDD).filter(v=>v!=null);
    const maxDD=Math.max(...res.curve.map(p=>p.dd||0), ...qldDDVals, ...tqqqDDVals, ...qqqDDVals, 1);
    const yOf=v=>padTop+ (v/maxDD)*(h-padTop-14);
    const pts=res.curve.map((p,i)=>[padL+i*stepX, yOf(p.dd||0)]);
    const ptsQldDD=res.curve.map((p,i)=>p.bmQldDD!=null?[padL+i*stepX,yOf(p.bmQldDD)]:null).filter(Boolean);
    const ptsTqqqDD=res.curve.map((p,i)=>p.bmTqqqDD!=null?[padL+i*stepX,yOf(p.bmTqqqDD)]:null).filter(Boolean);
    const ptsQqqDD=res.curve.map((p,i)=>p.bmQqqDD!=null?[padL+i*stepX,yOf(p.bmQqqDD)]:null).filter(Boolean);
    const pathOf=pts=>pts.map((p,i)=>(i===0?'M':'L')+p[0].toFixed(1)+','+p[1].toFixed(1)).join(' ');
    const areaPath=pts.length?pathOf(pts)+' L'+pts[pts.length-1][0].toFixed(1)+','+padTop+' L'+pts[0][0].toFixed(1)+','+padTop+' Z':'';
    const worstDD=maxDD.toFixed(1);
    const worstQldDD=qldDDVals.length?Math.max(...qldDDVals).toFixed(1):null;
    const worstTqqqDD=tqqqDDVals.length?Math.max(...tqqqDDVals).toFixed(1):null;
    const worstQqqDD=qqqDDVals.length?Math.max(...qqqDDVals).toFixed(1):null;

    /* 좌우 Y축 눈금(0%, 중간, 최대낙폭%) */
    let yAxis='';
    const tickN=3;
    for(let ti=0;ti<=tickN;ti++){
      const val=(maxDD*ti/tickN);
      const y=yOf(val);
      const lbl='-'+val.toFixed(1)+'%';
      yAxis+='<line x1="'+padL+'" y1="'+y.toFixed(1)+'" x2="'+(w-padR)+'" y2="'+y.toFixed(1)+'" stroke="var(--line)" stroke-width="1" stroke-dasharray="2 3" opacity="0.45"/>';
      yAxis+='<text x="'+(padL-8)+'" y="'+(y+3).toFixed(1)+'" font-size="9.5" fill="var(--tx2)" text-anchor="end">'+lbl+'</text>';
      yAxis+='<text x="'+(w-padR+8)+'" y="'+(y+3).toFixed(1)+'" font-size="9.5" fill="var(--tx2)" text-anchor="start">'+lbl+'</text>';
    }

    ddEl.innerHTML=
      '<svg viewBox="0 0 '+w+' '+h+'" style="width:100%;height:110px;display:block">'+
      yAxis+
      '<path d="'+areaPath+'" fill="rgba(255,77,79,.18)" stroke="none"/>'+
      '<path d="'+pathOf(pts)+'" fill="none" stroke="var(--up)" stroke-width="1.8"/>'+
      (ptsQldDD.length?'<path d="'+pathOf(ptsQldDD)+'" fill="none" stroke="#c084fc" stroke-width="1.4" stroke-dasharray="5 3"/>':'')+
      (ptsTqqqDD.length?'<path d="'+pathOf(ptsTqqqDD)+'" fill="none" stroke="#facc15" stroke-width="1.4" stroke-dasharray="5 3"/>':'')+
      (ptsQqqDD.length?'<path d="'+pathOf(ptsQqqDD)+'" fill="none" stroke="#2dd4bf" stroke-width="1.4" stroke-dasharray="5 3"/>':'')+
      '</svg>'+
      '<div class="mut" style="margin-top:4px;font-size:12px">전략 최대 -'+worstDD+'%'+
      (worstQqqDD!=null?' · QQQ 단독매수 최대 -'+worstQqqDD+'%':'')+
      (worstQldDD!=null?' · QLD 단독매수 최대 -'+worstQldDD+'%':'')+
      (worstTqqqDD!=null?' · TQQQ 단독매수 최대 -'+worstTqqqDD+'%':'')+'</div>'+
      '<div style="display:flex;flex-wrap:wrap;gap:10px 18px;margin-top:6px;font-size:12px;color:var(--tx2)">'+
      '<span style="white-space:nowrap"><span style="color:var(--up)">■</span> 전략(배당 포함 평가금 기준)</span>'+
      '<span style="white-space:nowrap"><span style="color:#2dd4bf">┄</span> QQQ 단독매수</span>'+
      '<span style="white-space:nowrap"><span style="color:#c084fc">┄</span> QLD 단독매수</span>'+
      '<span style="white-space:nowrap"><span style="color:#facc15">┄</span> TQQQ 단독매수</span>'+
      '</div>';

    /* 연도별 최고 낙폭 박스 — 전략·QQQ·QLD·TQQQ 를 연도마다 나란히 비교 */
    const ddYearBoxEl=document.getElementById('bt-drawdown-yearly');
    if(ddYearBoxEl){
      const byYear={};
      res.curve.forEach(p=>{
        const y=new Date(p.t).getUTCFullYear();
        if(!byYear[y]) byYear[y]={strategy:0, qqq:0, qld:0, tqqq:0};
        byYear[y].strategy=Math.max(byYear[y].strategy, p.dd||0);
        if(p.bmQqqDD!=null) byYear[y].qqq=Math.max(byYear[y].qqq, p.bmQqqDD);
        if(p.bmQldDD!=null) byYear[y].qld=Math.max(byYear[y].qld, p.bmQldDD);
        if(p.bmTqqqDD!=null) byYear[y].tqqq=Math.max(byYear[y].tqqq, p.bmTqqqDD);
      });
      const years=Object.keys(byYear).sort();
      ddYearBoxEl.innerHTML='<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px">'+
        years.map(y=>{
          const d=byYear[y];
          return '<div style="border:1px solid var(--line);border-radius:10px;padding:10px 12px">'+
            '<div style="font-weight:800;font-size:13px;margin-bottom:6px">'+y+'년</div>'+
            '<div style="font-size:11.5px;color:var(--tx2);line-height:1.9">'+
            '<span style="color:var(--up)">■</span> 전략 -'+d.strategy.toFixed(1)+'%<br>'+
            '<span style="color:#2dd4bf">■</span> QQQ -'+d.qqq.toFixed(1)+'%<br>'+
            '<span style="color:#c084fc">■</span> QLD -'+d.qld.toFixed(1)+'%<br>'+
            '<span style="color:#facc15">■</span> TQQQ -'+d.tqqq.toFixed(1)+'%'+
            '</div></div>';
        }).join('')+'</div>';
    }
  }

  /* 낙폭 15% 이상이었던 구간 각주 — 실제 계산된 시점(res.curve)을 바탕으로 자동 탐지하고,
     널리 알려진 시장 충격 시기와 겹치면 참고 설명을 붙인다. 정확히 겹치는 사건이 없으면
     가장 가까운 시기의 사건을 "참고용(정확한 매칭 아님)"으로 대신 보여준다. */
  const ddEventsEl=document.getElementById('bt-drawdown-events');
  if(ddEventsEl){
    const episodes=detectDrawdownEpisodes(res.curve, 15);
    if(!episodes.length){
      ddEventsEl.innerHTML='<p class="mut" style="font-size:12px">이 백테스트 구간에는 낙폭이 15% 이상으로 커진 시점이 없었습니다.</p>';
    }else{
      const byYear={};
      episodes.forEach(ep=>{
        const y=new Date(ep.troughTs).getUTCFullYear();
        if(!byYear[y]) byYear[y]=[];
        byYear[y].push(ep);
      });
      const years=Object.keys(byYear).sort();
      ddEventsEl.innerHTML='<p class="mut" style="font-size:12px;margin-bottom:8px">⚠ 낙폭 15% 이상 구간 — 시점과 관련 이벤트(연도별)</p>'+
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px">'+
        years.map(y=>{
          const epsHtml=byYear[y].map(ep=>{
            const troughDate=new Date(ep.troughTs).toLocaleDateString('ko-KR');
            const startDate=new Date(ep.startTs).toLocaleDateString('ko-KR');
            const endDate=ep.endTs?new Date(ep.endTs).toLocaleDateString('ko-KR'):'아직 회복 전(데이터 마지막 날 기준)';
            const exact=matchMarketStressEvent(ep.troughTs);
            let titleHtml, noteHtml;
            if(exact){
              titleHtml='<b style="color:var(--up)">'+exact.label+'</b>';
              noteHtml=exact.note.split('\n').join('<br>');
            }else{
              const near=nearestMarketStressEvent(ep.troughTs);
              if(near){
                titleHtml='<b style="color:var(--up)">'+near.ev.label+'</b> <span class="mut" style="font-weight:400">(약 '+near.days+'일 차이 · 참고용, 정확한 매칭 아님)</span>';
                noteHtml=near.ev.note.split('\n').join('<br>');
              }else{
                titleHtml='<b style="color:var(--up)">특정 사건과 자동 매칭되지 않음</b>';
                noteHtml='그 시기 증시 뉴스를 직접 확인해보세요.';
              }
            }
            return '<div style="margin-top:8px;padding-left:10px;border-left:2px solid var(--down)">'+
              startDate+' ~ '+endDate+' · 최대 낙폭 -'+ep.troughDD.toFixed(1)+'%(저점 '+troughDate+')<br>'+titleHtml+'<br>'+noteHtml+'</div>';
          }).join('');
          return '<div style="border:1px solid var(--line);border-radius:10px;padding:12px 14px">'+
            '<div style="font-weight:800;font-size:13px">'+y+'년</div>'+
            '<div class="mut" style="font-size:12px">'+epsHtml+'</div></div>';
        }).join('')+
        '</div>';
    }
  }

  /* 연도별 수익률 */
  const yearlyEl=document.getElementById('bt-yearly-return');
  if(yearlyEl){
    const years=Object.keys(res.yearly||{}).sort();
    const yretList=years.map(y=>{
      const yr=res.yearly[y];
      const contrib=yr.endCost-yr.startCost;
      const denom=yr.startValue+contrib;
      const profitYen=yr.endValue-yr.startValue-contrib;
      return denom>0?profitYen/denom*100:0;
    });
    const bestYret=Math.max(...yretList), worstYret=Math.min(...yretList);
    yearlyEl.innerHTML=years.map((y,i)=>{
      const yr=res.yearly[y];
      const contrib=yr.endCost-yr.startCost;
      const yret=yretList[i];
      const isBest=yret===bestYret && yretList.length>1;
      const isWorst=yret===worstYret && yretList.length>1;
      const rowBg='background:'+(yret>=0?'rgba(255,77,79,':'rgba(61,157,255,')+Math.min(Math.abs(yret)/40,1)*0.22+')';
      const badge=isBest?' <span class="tag" style="background:rgba(255,176,32,.18);color:var(--accent)">최고</span>':isWorst?' <span class="tag" style="background:rgba(61,157,255,.15);color:var(--down)">최저</span>':'';
      return '<tr style="'+rowBg+'"><td>'+y+badge+'</td>'+
        '<td class="num">'+fmtUSDKRW(contrib)+'</td>'+
        '<td class="num">'+fmtUSDKRW(yr.endCost)+'</td>'+
        '<td class="num">'+yr.buys+'회</td>'+
        '<td class="num">'+fmtUSDKRW(yr.dividends)+'</td>'+
        '<td class="num '+(yret>=0?'up':'down')+'">'+(yret>=0?'+':'')+yret.toFixed(1)+'%</td></tr>';
    }).join('');
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
        '<td class="num">'+fmtUSDKRW(contrib)+'</td>'+
        '<td class="num">'+fmtUSDKRW(m.endCost)+'</td>'+
        '<td class="num">'+m.buys+'회</td>'+
        '<td class="num down">-'+mddPct.toFixed(1)+'%</td>'+
        '<td class="num '+(profitYen>=0?'up':'down')+'">'+(profitYen>=0?'+':'-')+fmtUSDKRW(Math.abs(profitYen))+'</td>'+
        '<td class="num '+(mret>=0?'up':'down')+'">'+(mret*100>=0?'+':'')+(mret*100).toFixed(2)+'%</td>'+
        '<td class="num '+(ann>=0?'up':'down')+'">'+(ann>=0?'+':'')+ann.toFixed(1)+'%</td></tr>';
    }).join('');
  }

  /* 월별 배당금 → 날짜별 배당금 지급 내역(매매기록과 동일하게 펼침 없이 한 줄씩 표시) */
  const divEl=document.getElementById('bt-monthly-div');
  if(divEl){
    const allEvents=[];
    months.forEach(mk=>{
      (res.monthly[mk].divEvents||[]).forEach(ev=>allEvents.push(ev));
    });
    allEvents.sort((a,b)=>a.t-b.t);
    let running=0;
    divEl.innerHTML=allEvents.length?allEvents.map(ev=>{
      running+=ev.amount;
      return '<tr><td>'+new Date(ev.t).toLocaleDateString('ko-KR')+'</td>'+
        '<td class="num">'+fmtUSDKRW(ev.amount)+'</td><td class="num">'+fmtUSDKRW(running)+'</td></tr>';
    }).join(''):'<tr><td class="mut" colspan="3">배당이 발생한 날이 없습니다.</td></tr>';
  }

  /* 다음 예상 배당 */
  const nextDivEl=document.getElementById('bt-next-div');
  if(nextDivEl){
    if(res.nextDiv){
      const d=new Date(res.nextDiv.date);
      nextDivEl.textContent='예상 배당시기: '+d.toLocaleDateString('ko-KR')+' 경 · 예상 배당금: '+fmtUSDKRW(res.nextDiv.amount);
    }else{
      nextDivEl.textContent='배당 이력이 부족해 다음 배당을 추정할 수 없습니다.';
    }
  }
}

let lastBacktestResult=null;
async function loadTradeBacktest(){
  const statusEl=document.getElementById('bt-status');
  if(statusEl) statusEl.textContent=BACKTEST_START_YEAR+'년 1월 1일부터 데이터를 불러와 다시 계산하는 중…';
  const opts={
    principalRecovery: !!(document.getElementById('bt-opt-recovery')||{}).checked,
    dualSniper: !!(document.getElementById('bt-opt-sniper')||{}).checked
  };
  const [res]=await Promise.all([runTradeBacktest(opts), loadFxRate()]);
  lastBacktestResult=res;
  renderBacktest(res);
}

/* 원금 100% 회수·듀얼스나이퍼 체크박스 — 조건 자체가 바뀌므로 표시만 다시 그리지 않고
   전체를 재계산한다 */
function initTradeOptionCheckboxes(){
  ['bt-opt-recovery','bt-opt-sniper'].forEach(id=>{
    const el=document.getElementById(id);
    if(el) el.addEventListener('change', loadTradeBacktest);
  });
}

/* stock.html·crypto.html의 "원화 표시" 토글과 동일 구조 — krwDisplayOn 플래그만 켜고
   이미 계산해둔 결과(lastBacktestResult)를 다시 그린다(재계산 없이 즉시 반영) */
function initTradeKrwToggle(sel){
  const toggle=document.querySelector(sel);
  if(!toggle) return;
  toggle.addEventListener('change',()=>{
    krwDisplayOn=toggle.checked;
    if(lastBacktestResult) renderBacktest(lastBacktestResult);
  });
}

/* 연도 선택 버튼(2024/2025/2026년부터) — 클릭 시 시작일을 바꾸고 백테스트 전체를 다시 계산 */
function setBacktestYear(year){
  if(BACKTEST_START_YEAR===year) return;
  BACKTEST_START_YEAR=year;
  BACKTEST_START_TS=Math.floor(new Date(year+'-01-01T00:00:00Z').getTime()/1000);
  const btns=document.querySelectorAll('#bt-year-tabs button');
  btns.forEach(b=>b.classList.toggle('on', +b.dataset.year===year));
  loadTradeBacktest();
}
const btYearTabs=document.getElementById('bt-year-tabs');
if(btYearTabs){
  btYearTabs.addEventListener('click',e=>{
    const b=e.target.closest('button'); if(!b) return;
    setBacktestYear(+b.dataset.year);
  });
}


/* ---- 네이버포인트 선물하기: 클릭 시 ID 복사 + 알림 후 새 창으로 이동(기본 링크 동작 유지) ---- */
const naverGiftLink=document.getElementById('naver-gift-link');
if(naverGiftLink){
  naverGiftLink.addEventListener('click',async()=>{
    try{ await navigator.clipboard.writeText('coolzet'); }catch(e){}
    alert('아이디 coolzet 복사되었습니다.');
  });
}

/* ---- 모바일 상단 메뉴 토글 ---- */
const navToggle=document.getElementById('nav-toggle');
const navMenu=document.getElementById('nav-menu');
if(navToggle && navMenu){
  navToggle.addEventListener('click',()=>{ navMenu.classList.toggle('open'); });
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