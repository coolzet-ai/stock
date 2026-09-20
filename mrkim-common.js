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
/* [변경] 연도 선택 버튼 대신 날짜를 직접 입력받는다. 데이터가 있는 범위(임베딩된 공포탐욕지수
   구간)로만 입력을 제한한다 — 그보다 이전 날짜를 고르면 그 이전 구간의 공포탐욕 점수를 알 수
   없어 매수 판단 자체가 불가능하다. */
const BACKTEST_MIN_DATE='2022-01-03';
function backtestMaxDate(){ return new Date().toISOString().slice(0,10); } // 오늘(항상 최신 기준)
let BACKTEST_START_DATE='2026-01-01';
let BACKTEST_START_TS=Math.floor(new Date(BACKTEST_START_DATE+'T00:00:00Z').getTime()/1000);

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
      :(above200?'<span class="tag" style="background:rgba(200,32,20,.15);color:var(--up)">200일선 위</span>'
                :'<span class="tag" style="background:rgba(26,111,168,.15);color:var(--down)">200일선 아래</span>');
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
const FG_XLS_DATA=[["2011-01-03",68.0],["2011-01-04",68.0],["2011-01-05",67.0],["2011-01-06",64.0],["2011-01-07",63.0],["2011-01-10",58.0],["2011-01-11",58.0],["2011-01-12",58.0],["2011-01-13",58.0],["2011-01-14",60.0],["2011-01-18",56.0],["2011-01-19",55.0],["2011-01-20",54.0],["2011-01-21",47.0],["2011-01-24",45.0],["2011-01-25",43.0],["2011-01-26",43.0],["2011-01-27",43.0],["2011-01-28",43.0],["2011-01-31",41.0],["2011-02-01",41.0],["2011-02-02",46.0],["2011-02-03",47.0],["2011-02-04",49.0],["2011-02-07",56.0],["2011-02-08",56.0],["2011-02-09",56.0],["2011-02-10",56.0],["2011-02-11",56.0],["2011-02-14",61.0],["2011-02-15",61.0],["2011-02-16",61.0],["2011-02-17",61.0],["2011-02-18",56.0],["2011-02-22",42.0],["2011-02-23",42.0],["2011-02-24",42.0],["2011-02-25",42.0],["2011-02-28",43.0],["2011-03-01",43.0],["2011-03-02",42.0],["2011-03-03",41.0],["2011-03-04",39.0],["2011-03-07",35.0],["2011-03-08",27.0],["2011-03-09",26.0],["2011-03-10",26.0],["2011-03-11",26.0],["2011-03-14",13.0],["2011-03-15",13.0],["2011-03-16",11.0],["2011-03-17",9.0],["2011-03-18",9.0],["2011-03-21",14.0],["2011-03-22",15.0],["2011-03-23",16.0],["2011-03-24",16.0],["2011-03-25",19.0],["2011-03-28",23.0],["2011-03-29",23.0],["2011-03-30",24.0],["2011-03-31",24.0],["2011-04-01",27.0],["2011-04-04",31.0],["2011-04-05",35.0],["2011-04-06",37.0],["2011-04-07",37.0],["2011-04-08",37.0],["2011-04-11",34.0],["2011-04-12",33.0],["2011-04-13",33.0],["2011-04-14",30.0],["2011-04-15",28.0],["2011-04-18",24.0],["2011-04-19",24.0],["2011-04-20",25.0],["2011-04-21",30.0],["2011-04-25",35.0],["2011-04-26",36.0],["2011-04-27",37.0],["2011-04-28",37.0],["2011-04-29",41.0],["2011-05-02",36.0],["2011-05-03",31.0],["2011-05-04",30.0],["2011-05-05",29.0],["2011-05-06",27.0],["2011-05-09",28.0],["2011-05-10",31.0],["2011-05-11",31.0],["2011-05-12",32.0],["2011-05-13",32.0],["2011-05-16",27.0],["2011-05-17",27.0],["2011-05-18",25.0],["2011-05-19",23.0],["2011-05-20",22.0],["2011-05-23",16.0],["2011-05-24",13.0],["2011-05-25",13.0],["2011-05-26",15.0],["2011-05-27",16.0],["2011-05-31",16.0],["2011-06-01",15.0],["2011-06-02",12.0],["2011-06-03",9.0],["2011-06-06",6.0],["2011-06-07",6.0],["2011-06-08",6.0],["2011-06-09",6.0],["2011-06-10",5.0],["2011-06-13",6.0],["2011-06-14",5.0],["2011-06-15",5.0],["2011-06-16",6.0],["2011-06-17",7.0],["2011-06-20",9.0],["2011-06-21",9.0],["2011-06-22",10.0],["2011-06-23",10.0],["2011-06-24",11.0],["2011-06-27",25.0],["2011-06-28",29.0],["2011-06-29",30.0],["2011-06-30",32.0],["2011-07-01",34.0],["2011-07-05",51.0],["2011-07-06",52.0],["2011-07-07",48.0],["2011-07-08",43.0],["2011-07-11",35.0],["2011-07-12",31.0],["2011-07-13",31.0],["2011-07-14",31.0],["2011-07-15",32.0],["2011-07-18",44.0],["2011-07-19",44.0],["2011-07-20",47.0],["2011-07-21",48.0],["2011-07-22",51.0],["2011-07-25",38.0],["2011-07-26",35.0],["2011-07-27",27.0],["2011-07-28",27.0],["2011-07-29",16.0],["2011-08-01",10.0],["2011-08-02",8.0],["2011-08-03",2.0],["2011-08-04",5.0],["2011-08-05",5.0],["2011-08-08",1.0],["2011-08-09",2.0],["2011-08-10",2.0],["2011-08-11",3.0],["2011-08-12",6.0],["2011-08-15",7.0],["2011-08-16",11.0],["2011-08-17",7.0],["2011-08-18",7.0],["2011-08-19",6.0],["2011-08-22",7.0],["2011-08-23",9.0],["2011-08-24",8.0],["2011-08-25",11.0],["2011-08-26",12.0],["2011-08-29",22.0],["2011-08-30",22.0],["2011-08-31",28.0],["2011-09-01",26.0],["2011-09-02",26.0],["2011-09-06",27.0],["2011-09-07",28.0],["2011-09-08",25.0],["2011-09-09",25.0],["2011-09-12",31.0],["2011-09-13",31.0],["2011-09-14",31.0],["2011-09-15",33.0],["2011-09-16",38.0],["2011-09-19",39.0],["2011-09-20",32.0],["2011-09-21",31.0],["2011-09-22",28.0],["2011-09-23",28.0],["2011-09-26",26.0],["2011-09-27",25.0],["2011-09-28",27.0],["2011-09-29",23.0],["2011-09-30",22.0],["2011-10-03",20.0],["2011-10-04",23.0],["2011-10-05",27.0],["2011-10-06",33.0],["2011-10-07",31.0],["2011-10-10",41.0],["2011-10-11",41.0],["2011-10-12",42.0],["2011-10-13",42.0],["2011-10-14",41.0],["2011-10-17",48.0],["2011-10-18",48.0],["2011-10-19",48.0],["2011-10-20",54.0],["2011-10-21",66.0],["2011-10-24",62.0],["2011-10-25",62.0],["2011-10-26",71.0],["2011-10-27",67.0],["2011-10-28",66.0],["2011-10-31",62.0],["2011-11-01",62.0],["2011-11-02",62.0],["2011-11-03",63.0],["2011-11-04",60.0],["2011-11-07",65.0],["2011-11-08",65.0],["2011-11-09",59.0],["2011-11-10",60.0],["2011-11-11",60.0],["2011-11-14",54.0],["2011-11-15",54.0],["2011-11-16",55.0],["2011-11-17",52.0],["2011-11-18",46.0],["2011-11-21",43.0],["2011-11-22",41.0],["2011-11-23",39.0],["2011-11-25",51.0],["2011-11-28",57.0],["2011-11-29",62.0],["2011-11-30",67.0],["2011-12-01",61.0],["2011-12-02",67.0],["2011-12-05",66.0],["2011-12-06",66.0],["2011-12-07",66.0],["2011-12-08",66.0],["2011-12-09",65.0],["2011-12-12",62.0],["2011-12-13",56.0],["2011-12-14",61.0],["2011-12-15",61.0],["2011-12-16",60.0],["2011-12-19",74.0],["2011-12-20",74.0],["2011-12-21",74.0],["2011-12-22",78.0],["2011-12-23",77.0],["2011-12-27",75.0],["2011-12-28",75.0],["2011-12-29",75.0],["2011-12-30",75.0],["2012-01-03",77.0],["2012-01-04",77.0],["2012-01-05",78.0],["2012-01-06",78.0],["2012-01-09",81.0],["2012-01-10",82.0],["2012-01-11",83.0],["2012-01-12",83.0],["2012-01-13",83.0],["2012-01-17",88.0],["2012-01-18",90.0],["2012-01-19",89.0],["2012-01-20",88.0],["2012-01-23",87.0],["2012-01-24",87.0],["2012-01-25",84.0],["2012-01-26",82.0],["2012-01-27",82.0],["2012-01-30",82.0],["2012-01-31",85.0],["2012-02-01",87.0],["2012-02-02",88.0],["2012-02-03",88.0],["2012-02-06",88.0],["2012-02-07",86.0],["2012-02-08",86.0],["2012-02-09",85.0],["2012-02-10",83.0],["2012-02-13",83.0],["2012-02-14",81.0],["2012-02-15",82.0],["2012-02-16",81.0],["2012-02-17",80.0],["2012-02-21",79.0],["2012-02-22",78.0],["2012-02-23",79.0],["2012-02-24",79.0],["2012-02-27",75.0],["2012-02-28",75.0],["2012-02-29",72.0],["2012-03-01",70.0],["2012-03-02",68.0],["2012-03-05",66.0],["2012-03-06",63.0],["2012-03-07",62.0],["2012-03-08",63.0],["2012-03-09",70.0],["2012-03-12",74.0],["2012-03-13",79.0],["2012-03-14",79.0],["2012-03-15",79.0],["2012-03-16",77.0],["2012-03-19",73.0],["2012-03-20",73.0],["2012-03-21",71.0],["2012-03-22",66.0],["2012-03-23",71.0],["2012-03-26",66.0],["2012-03-27",66.0],["2012-03-28",62.0],["2012-03-29",62.0],["2012-03-30",63.0],["2012-04-02",63.0],["2012-04-03",61.0],["2012-04-04",63.0],["2012-04-05",55.0],["2012-04-09",46.0],["2012-04-10",39.0],["2012-04-11",39.0],["2012-04-12",38.0],["2012-04-13",38.0],["2012-04-16",37.0],["2012-04-17",37.0],["2012-04-18",36.0],["2012-04-19",35.0],["2012-04-20",35.0],["2012-04-23",34.0],["2012-04-24",34.0],["2012-04-25",38.0],["2012-04-26",40.0],["2012-04-27",41.0],["2012-04-30",43.0],["2012-05-01",42.0],["2012-05-02",42.0],["2012-05-03",41.0],["2012-05-04",41.0],["2012-05-07",38.0],["2012-05-08",32.0],["2012-05-09",32.0],["2012-05-10",32.0],["2012-05-11",25.0],["2012-05-14",23.0],["2012-05-15",20.0],["2012-05-16",14.0],["2012-05-17",12.0],["2012-05-18",12.0],["2012-05-21",16.0],["2012-05-22",15.0],["2012-05-23",15.0],["2012-05-24",14.0],["2012-05-25",13.0],["2012-05-29",14.0],["2012-05-30",12.0],["2012-05-31",10.0],["2012-06-01",10.0],["2012-06-04",14.0],["2012-06-05",14.0],["2012-06-06",15.0],["2012-06-07",16.0],["2012-06-08",19.0],["2012-06-11",20.0],["2012-06-12",22.0],["2012-06-13",19.0],["2012-06-14",27.0],["2012-06-15",35.0],["2012-06-18",36.0],["2012-06-19",36.0],["2012-06-20",36.0],["2012-06-21",33.0],["2012-06-22",33.0],["2012-06-25",39.0],["2012-06-26",41.0],["2012-06-27",41.0],["2012-06-28",48.0],["2012-06-29",53.0],["2012-07-02",56.0],["2012-07-03",59.0],["2012-07-05",55.0],["2012-07-06",51.0],["2012-07-09",46.0],["2012-07-10",48.0],["2012-07-11",44.0],["2012-07-12",44.0],["2012-07-13",45.0],["2012-07-16",48.0],["2012-07-17",52.0],["2012-07-18",52.0],["2012-07-19",51.0],["2012-07-20",51.0],["2012-07-23",47.0],["2012-07-24",41.0],["2012-07-25",51.0],["2012-07-26",55.0],["2012-07-27",61.0],["2012-07-30",57.0],["2012-07-31",55.0],["2012-08-01",55.0],["2012-08-02",49.0],["2012-08-03",63.0],["2012-08-06",71.0],["2012-08-07",70.0],["2012-08-08",73.0],["2012-08-09",75.0],["2012-08-10",70.0],["2012-08-13",75.0],["2012-08-14",74.0],["2012-08-15",72.0],["2012-08-16",78.0],["2012-08-17",79.0],["2012-08-20",75.0],["2012-08-21",74.0],["2012-08-22",74.0],["2012-08-23",72.0],["2012-08-24",70.0],["2012-08-27",68.0],["2012-08-28",68.0],["2012-08-29",63.0],["2012-08-30",63.0],["2012-08-31",59.0],["2012-09-04",71.0],["2012-09-05",74.0],["2012-09-06",76.0],["2012-09-07",83.0],["2012-09-10",78.0],["2012-09-11",86.0],["2012-09-12",84.0],["2012-09-13",91.0],["2012-09-14",93.0],["2012-09-17",92.0],["2012-09-18",92.0],["2012-09-19",92.0],["2012-09-20",93.0],["2012-09-21",93.0],["2012-09-24",81.0],["2012-09-25",81.0],["2012-09-26",70.0],["2012-09-27",76.0],["2012-09-28",71.0],["2012-10-01",72.0],["2012-10-02",75.0],["2012-10-03",76.0],["2012-10-04",77.0],["2012-10-05",78.0],["2012-10-08",72.0],["2012-10-09",66.0],["2012-10-10",59.0],["2012-10-11",56.0],["2012-10-12",56.0],["2012-10-15",54.0],["2012-10-16",63.0],["2012-10-17",61.0],["2012-10-18",53.0],["2012-10-19",56.0],["2012-10-22",56.0],["2012-10-23",42.0],["2012-10-24",45.0],["2012-10-25",41.0],["2012-10-26",40.0],["2012-10-31",45.0],["2012-11-01",50.0],["2012-11-02",50.0],["2012-11-05",46.0],["2012-11-06",47.0],["2012-11-07",45.0],["2012-11-08",40.0],["2012-11-09",39.0],["2012-11-12",35.0],["2012-11-13",37.0],["2012-11-14",31.0],["2012-11-15",28.0],["2012-11-16",28.0],["2012-11-19",38.0],["2012-11-20",42.0],["2012-11-21",39.0],["2012-11-23",47.0],["2012-11-26",47.0],["2012-11-27",49.0],["2012-11-28",49.0],["2012-11-29",52.0],["2012-11-30",50.0],["2012-12-03",45.0],["2012-12-04",45.0],["2012-12-05",45.0],["2012-12-06",45.0],["2012-12-07",51.0],["2012-12-10",55.0],["2012-12-11",55.0],["2012-12-12",58.0],["2012-12-13",60.0],["2012-12-14",57.0],["2012-12-17",64.0],["2012-12-18",67.0],["2012-12-19",64.0],["2012-12-20",59.0],["2012-12-21",56.0],["2012-12-24",51.0],["2012-12-26",58.0],["2012-12-27",58.0],["2012-12-28",66.0],["2012-12-31",66.0],["2013-01-02",68.0],["2013-01-03",69.0],["2013-01-04",82.0],["2013-01-07",82.0],["2013-01-08",80.0],["2013-01-09",81.0],["2013-01-10",85.0],["2013-01-11",85.0],["2013-01-14",86.0],["2013-01-15",89.0],["2013-01-16",85.0],["2013-01-17",86.0],["2013-01-18",89.0],["2013-01-22",89.0],["2013-01-23",92.0],["2013-01-24",92.0],["2013-01-25",91.0],["2013-01-28",93.0],["2013-01-29",94.0],["2013-01-30",93.0],["2013-01-31",89.0],["2013-02-01",88.0],["2013-02-04",80.0],["2013-02-05",88.0],["2013-02-06",81.0],["2013-02-07",85.0],["2013-02-08",83.0],["2013-02-11",82.0],["2013-02-12",82.0],["2013-02-13",83.0],["2013-02-14",87.0],["2013-02-15",84.0],["2013-02-19",81.0],["2013-02-20",79.0],["2013-02-21",68.0],["2013-02-22",78.0],["2013-02-25",62.0],["2013-02-26",61.0],["2013-02-27",56.0],["2013-02-28",61.0],["2013-03-01",60.0],["2013-03-04",60.0],["2013-03-05",71.0],["2013-03-06",69.0],["2013-03-07",73.0],["2013-03-08",82.0],["2013-03-11",79.0],["2013-03-12",77.0],["2013-03-13",77.0],["2013-03-14",79.0],["2013-03-15",77.0],["2013-03-18",70.0],["2013-03-19",73.0],["2013-03-20",69.0],["2013-03-21",69.0],["2013-03-22",69.0],["2013-03-25",70.0],["2013-03-26",68.0],["2013-03-27",70.0],["2013-03-28",72.0],["2013-04-01",63.0],["2013-04-02",63.0],["2013-04-03",59.0],["2013-04-04",55.0],["2013-04-05",52.0],["2013-04-08",53.0],["2013-04-09",56.0],["2013-04-10",56.0],["2013-04-11",57.0],["2013-04-12",57.0],["2013-04-15",41.0],["2013-04-16",52.0],["2013-04-17",47.0],["2013-04-18",35.0],["2013-04-19",41.0],["2013-04-22",42.0],["2013-04-23",46.0],["2013-04-24",48.0],["2013-04-25",53.0],["2013-04-26",53.0],["2013-04-29",60.0],["2013-04-30",61.0],["2013-05-01",62.0],["2013-05-02",63.0],["2013-05-03",64.0],["2013-05-06",73.0],["2013-05-07",78.0],["2013-05-08",77.0],["2013-05-09",76.0],["2013-05-10",77.0],["2013-05-13",80.0],["2013-05-14",86.0],["2013-05-15",87.0],["2013-05-16",85.0],["2013-05-17",91.0],["2013-05-20",83.0],["2013-05-21",83.0],["2013-05-22",83.0],["2013-05-23",80.0],["2013-05-24",75.0],["2013-05-28",67.0],["2013-05-29",66.0],["2013-05-30",72.0],["2013-05-31",60.0],["2013-06-03",55.0],["2013-06-04",48.0],["2013-06-05",32.0],["2013-06-06",34.0],["2013-06-07",40.0],["2013-06-10",34.0],["2013-06-11",31.0],["2013-06-12",30.0],["2013-06-13",30.0],["2013-06-14",29.0],["2013-06-17",24.0],["2013-06-18",24.0],["2013-06-19",21.0],["2013-06-20",19.0],["2013-06-21",19.0],["2013-06-24",18.0],["2013-06-25",19.0],["2013-06-26",20.0],["2013-06-27",21.0],["2013-06-28",22.0],["2013-07-01",25.0],["2013-07-02",29.0],["2013-07-03",30.0],["2013-07-05",38.0],["2013-07-08",40.0],["2013-07-09",48.0],["2013-07-10",49.0],["2013-07-11",51.0],["2013-07-12",61.0],["2013-07-15",60.0],["2013-07-16",62.0],["2013-07-17",57.0],["2013-07-18",62.0],["2013-07-19",68.0],["2013-07-22",63.0],["2013-07-23",65.0],["2013-07-24",64.0],["2013-07-25",62.0],["2013-07-26",64.0],["2013-07-29",59.0],["2013-07-30",62.0],["2013-07-31",61.0],["2013-08-01",68.0],["2013-08-02",62.0],["2013-08-05",61.0],["2013-08-06",54.0],["2013-08-07",47.0],["2013-08-08",52.0],["2013-08-09",44.0],["2013-08-12",50.0],["2013-08-13",50.0],["2013-08-14",46.0],["2013-08-15",43.0],["2013-08-16",39.0],["2013-08-19",32.0],["2013-08-20",26.0],["2013-08-21",26.0],["2013-08-22",32.0],["2013-08-23",27.0],["2013-08-26",25.0],["2013-08-27",18.0],["2013-08-28",24.0],["2013-08-29",23.0],["2013-08-30",20.0],["2013-09-03",17.0],["2013-09-04",28.0],["2013-09-05",33.0],["2013-09-06",36.0],["2013-09-09",43.0],["2013-09-10",52.0],["2013-09-11",47.0],["2013-09-12",46.0],["2013-09-13",48.0],["2013-09-16",50.0],["2013-09-17",54.0],["2013-09-18",56.0],["2013-09-19",62.0],["2013-09-20",57.0],["2013-09-23",49.0],["2013-09-24",48.0],["2013-09-25",47.0],["2013-09-26",39.0],["2013-09-27",41.0],["2013-09-30",35.0],["2013-10-01",40.0],["2013-10-02",35.0],["2013-10-03",29.0],["2013-10-04",34.0],["2013-10-07",27.0],["2013-10-08",20.0],["2013-10-09",29.0],["2013-10-10",35.0],["2013-10-11",31.0],["2013-10-14",39.0],["2013-10-15",39.0],["2013-10-16",46.0],["2013-10-17",48.0],["2013-10-18",56.0],["2013-10-21",53.0],["2013-10-22",55.0],["2013-10-23",61.0],["2013-10-24",62.0],["2013-10-25",62.0],["2013-10-28",64.0],["2013-10-29",64.0],["2013-10-30",64.0],["2013-10-31",66.0],["2013-11-01",67.0],["2013-11-04",68.0],["2013-11-05",68.0],["2013-11-06",68.0],["2013-11-07",68.0],["2013-11-08",68.0],["2013-11-11",67.0],["2013-11-12",69.0],["2013-11-13",70.0],["2013-11-14",70.0],["2013-11-15",71.0],["2013-11-18",71.0],["2013-11-19",67.0],["2013-11-20",68.0],["2013-11-21",68.0],["2013-11-22",68.0],["2013-11-25",66.0],["2013-11-26",64.0],["2013-11-27",67.0],["2013-11-29",70.0],["2013-12-02",66.0],["2013-12-03",65.0],["2013-12-04",65.0],["2013-12-05",57.0],["2013-12-06",63.0],["2013-12-09",53.0],["2013-12-10",52.0],["2013-12-11",51.0],["2013-12-12",43.0],["2013-12-13",38.0],["2013-12-16",45.0],["2013-12-17",38.0],["2013-12-18",49.0],["2013-12-19",50.0],["2013-12-20",52.0],["2013-12-23",61.0],["2013-12-24",66.0],["2013-12-26",63.0],["2013-12-27",72.0],["2013-12-30",70.0],["2013-12-31",77.0],["2014-01-02",71.0],["2014-01-03",66.0],["2014-01-06",64.0],["2014-01-07",67.0],["2014-01-08",64.0],["2014-01-09",68.0],["2014-01-10",66.0],["2014-01-13",61.0],["2014-01-14",68.0],["2014-01-15",65.0],["2014-01-16",63.0],["2014-01-17",59.0],["2014-01-21",62.0],["2014-01-22",45.0],["2014-01-23",46.0],["2014-01-24",27.0],["2014-01-27",25.0],["2014-01-28",29.0],["2014-01-29",20.0],["2014-01-30",18.0],["2014-01-31",20.0],["2014-02-03",13.0],["2014-02-04",15.0],["2014-02-05",20.0],["2014-02-06",17.0],["2014-02-07",22.0],["2014-02-10",28.0],["2014-02-11",29.0],["2014-02-12",32.0],["2014-02-13",32.0],["2014-02-14",30.0],["2014-02-18",42.0],["2014-02-19",39.0],["2014-02-20",45.0],["2014-02-21",48.0],["2014-02-24",55.0],["2014-02-25",57.0],["2014-02-26",58.0],["2014-02-27",62.0],["2014-02-28",56.0],["2014-03-03",63.0],["2014-03-04",66.0],["2014-03-05",78.0],["2014-03-06",80.0],["2014-03-07",81.0],["2014-03-10",81.0],["2014-03-11",76.0],["2014-03-12",57.0],["2014-03-13",49.0],["2014-03-14",44.0],["2014-03-17",49.0],["2014-03-18",51.0],["2014-03-19",53.0],["2014-03-20",54.0],["2014-03-21",56.0],["2014-03-24",49.0],["2014-03-25",43.0],["2014-03-26",43.0],["2014-03-27",34.0],["2014-03-28",36.0],["2014-03-31",50.0],["2014-04-01",51.0],["2014-04-02",53.0],["2014-04-03",51.0],["2014-04-04",49.0],["2014-04-07",35.0],["2014-04-08",34.0],["2014-04-09",31.0],["2014-04-10",31.0],["2014-04-11",21.0],["2014-04-14",23.0],["2014-04-15",23.0],["2014-04-16",28.0],["2014-04-17",28.0],["2014-04-21",38.0],["2014-04-22",40.0],["2014-04-23",40.0],["2014-04-24",39.0],["2014-04-25",35.0],["2014-04-28",34.0],["2014-04-29",34.0],["2014-04-30",33.0],["2014-05-01",30.0],["2014-05-02",32.0],["2014-05-05",34.0],["2014-05-06",34.0],["2014-05-07",33.0],["2014-05-08",33.0],["2014-05-09",42.0],["2014-05-12",45.0],["2014-05-13",39.0],["2014-05-14",38.0],["2014-05-15",28.0],["2014-05-16",28.0],["2014-05-19",26.0],["2014-05-20",21.0],["2014-05-21",29.0],["2014-05-22",36.0],["2014-05-23",37.0],["2014-05-27",40.0],["2014-05-28",42.0],["2014-05-29",42.0],["2014-05-30",45.0],["2014-06-02",58.0],["2014-06-03",66.0],["2014-06-04",66.0],["2014-06-05",81.0],["2014-06-06",81.0],["2014-06-09",89.0],["2014-06-10",90.0],["2014-06-11",88.0],["2014-06-12",83.0],["2014-06-13",85.0],["2014-06-16",87.0],["2014-06-17",88.0],["2014-06-18",94.0],["2014-06-19",95.0],["2014-06-20",95.0],["2014-06-23",93.0],["2014-06-24",83.0],["2014-06-25",83.0],["2014-06-26",77.0],["2014-06-27",76.0],["2014-06-30",87.0],["2014-07-01",87.0],["2014-07-02",87.0],["2014-07-03",86.0],["2014-07-07",68.0],["2014-07-08",74.0],["2014-07-09",62.0],["2014-07-10",56.0],["2014-07-11",57.0],["2014-07-14",59.0],["2014-07-15",56.0],["2014-07-16",55.0],["2014-07-17",32.0],["2014-07-18",46.0],["2014-07-21",37.0],["2014-07-22",38.0],["2014-07-23",39.0],["2014-07-24",42.0],["2014-07-25",34.0],["2014-07-28",34.0],["2014-07-29",31.0],["2014-07-30",26.0],["2014-07-31",10.0],["2014-08-01",5.0],["2014-08-04",5.0],["2014-08-05",5.0],["2014-08-06",5.0],["2014-08-07",5.0],["2014-08-08",10.0],["2014-08-11",7.0],["2014-08-12",8.0],["2014-08-13",13.0],["2014-08-14",16.0],["2014-08-15",14.0],["2014-08-18",26.0],["2014-08-19",31.0],["2014-08-20",37.0],["2014-08-21",36.0],["2014-08-22",37.0],["2014-08-25",35.0],["2014-08-26",36.0],["2014-08-27",33.0],["2014-08-28",33.0],["2014-08-29",41.0],["2014-09-02",48.0],["2014-09-03",48.0],["2014-09-04",47.0],["2014-09-05",50.0],["2014-09-08",47.0],["2014-09-09",42.0],["2014-09-10",45.0],["2014-09-11",44.0],["2014-09-12",43.0],["2014-09-15",38.0],["2014-09-16",37.0],["2014-09-17",42.0],["2014-09-18",37.0],["2014-09-19",36.0],["2014-09-22",22.0],["2014-09-23",18.0],["2014-09-24",17.0],["2014-09-25",8.0],["2014-09-26",13.0],["2014-09-29",11.0],["2014-09-30",12.0],["2014-10-01",7.0],["2014-10-02",3.0],["2014-10-03",5.0],["2014-10-06",5.0],["2014-10-07",6.0],["2014-10-08",4.0],["2014-10-09",3.0],["2014-10-10",1.0],["2014-10-13",0.0],["2014-10-14",2.0],["2014-10-15",1.0],["2014-10-16",2.0],["2014-10-17",7.0],["2014-10-20",5.0],["2014-10-21",7.0],["2014-10-22",8.0],["2014-10-23",11.0],["2014-10-24",13.0],["2014-10-27",16.0],["2014-10-28",21.0],["2014-10-29",25.0],["2014-10-30",31.0],["2014-10-31",32.0],["2014-11-03",40.0],["2014-11-04",40.0],["2014-11-05",49.0],["2014-11-06",49.0],["2014-11-07",55.0],["2014-11-10",57.0],["2014-11-11",58.0],["2014-11-12",56.0],["2014-11-13",54.0],["2014-11-14",53.0],["2014-11-17",53.0],["2014-11-18",54.0],["2014-11-19",55.0],["2014-11-20",59.0],["2014-11-21",59.0],["2014-11-24",62.0],["2014-11-25",62.0],["2014-11-26",63.0],["2014-11-28",59.0],["2014-12-01",55.0],["2014-12-02",55.0],["2014-12-03",59.0],["2014-12-04",59.0],["2014-12-05",61.0],["2014-12-08",55.0],["2014-12-09",46.0],["2014-12-10",41.0],["2014-12-11",37.0],["2014-12-12",31.0],["2014-12-15",22.0],["2014-12-16",19.0],["2014-12-17",21.0],["2014-12-18",33.0],["2014-12-19",33.0],["2014-12-22",43.0],["2014-12-23",45.0],["2014-12-24",47.0],["2014-12-26",48.0],["2014-12-29",47.0],["2014-12-30",47.0],["2014-12-31",45.0],["2015-01-02",37.0],["2015-01-05",30.0],["2015-01-06",21.0],["2015-01-07",21.0],["2015-01-08",28.0],["2015-01-09",29.0],["2015-01-12",30.0],["2015-01-13",29.0],["2015-01-14",30.0],["2015-01-15",30.0],["2015-01-16",26.0],["2015-01-20",25.0],["2015-01-21",28.0],["2015-01-22",32.0],["2015-01-23",31.0],["2015-01-26",28.0],["2015-01-27",28.0],["2015-01-28",26.0],["2015-01-29",26.0],["2015-01-30",25.0],["2015-02-02",30.0],["2015-02-03",46.0],["2015-02-04",42.0],["2015-02-05",50.0],["2015-02-06",52.0],["2015-02-09",52.0],["2015-02-10",54.0],["2015-02-11",61.0],["2015-02-12",64.0],["2015-02-13",73.0],["2015-02-17",77.0],["2015-02-18",79.0],["2015-02-19",77.0],["2015-02-20",80.0],["2015-02-23",77.0],["2015-02-24",75.0],["2015-02-25",77.0],["2015-02-26",78.0],["2015-02-27",74.0],["2015-03-02",74.0],["2015-03-03",66.0],["2015-03-04",66.0],["2015-03-05",65.0],["2015-03-06",58.0],["2015-03-09",58.0],["2015-03-10",52.0],["2015-03-11",44.0],["2015-03-12",46.0],["2015-03-13",39.0],["2015-03-16",42.0],["2015-03-17",40.0],["2015-03-18",39.0],["2015-03-19",43.0],["2015-03-20",43.0],["2015-03-23",48.0],["2015-03-24",44.0],["2015-03-25",44.0],["2015-03-26",37.0],["2015-03-27",36.0],["2015-03-30",37.0],["2015-03-31",37.0],["2015-04-01",35.0],["2015-04-02",40.0],["2015-04-06",43.0],["2015-04-07",48.0],["2015-04-08",48.0],["2015-04-09",56.0],["2015-04-10",56.0],["2015-04-13",60.0],["2015-04-14",60.0],["2015-04-15",60.0],["2015-04-16",57.0],["2015-04-17",57.0],["2015-04-20",55.0],["2015-04-21",59.0],["2015-04-22",59.0],["2015-04-23",64.0],["2015-04-24",66.0],["2015-04-27",59.0],["2015-04-28",61.0],["2015-04-29",61.0],["2015-04-30",53.0],["2015-05-01",61.0],["2015-05-04",61.0],["2015-05-05",58.0],["2015-05-06",58.0],["2015-05-07",53.0],["2015-05-08",58.0],["2015-05-11",53.0],["2015-05-12",49.0],["2015-05-13",55.0],["2015-05-14",57.0],["2015-05-15",57.0],["2015-05-18",62.0],["2015-05-19",62.0],["2015-05-20",64.0],["2015-05-21",64.0],["2015-05-22",60.0],["2015-05-26",50.0],["2015-05-27",47.0],["2015-05-28",47.0],["2015-05-29",43.0],["2015-06-01",40.0],["2015-06-02",43.0],["2015-06-03",45.0],["2015-06-04",44.0],["2015-06-05",40.0],["2015-06-08",36.0],["2015-06-09",36.0],["2015-06-10",37.0],["2015-06-11",41.0],["2015-06-12",30.0],["2015-06-15",26.0],["2015-06-16",27.0],["2015-06-17",26.0],["2015-06-18",34.0],["2015-06-19",30.0],["2015-06-22",42.0],["2015-06-23",49.0],["2015-06-24",36.0],["2015-06-25",34.0],["2015-06-26",33.0],["2015-06-29",8.0],["2015-06-30",11.0],["2015-07-01",18.0],["2015-07-02",16.0],["2015-07-06",13.0],["2015-07-07",13.0],["2015-07-08",9.0],["2015-07-09",12.0],["2015-07-10",14.0],["2015-07-13",24.0],["2015-07-14",24.0],["2015-07-15",30.0],["2015-07-16",30.0],["2015-07-17",34.0],["2015-07-20",34.0],["2015-07-21",25.0],["2015-07-22",20.0],["2015-07-23",15.0],["2015-07-24",15.0],["2015-07-27",7.0],["2015-07-28",17.0],["2015-07-29",21.0],["2015-07-30",21.0],["2015-07-31",20.0],["2015-08-03",24.0],["2015-08-04",28.0],["2015-08-05",21.0],["2015-08-06",18.0],["2015-08-07",10.0],["2015-08-10",9.0],["2015-08-11",12.0],["2015-08-12",9.0],["2015-08-13",11.0],["2015-08-14",11.0],["2015-08-17",14.0],["2015-08-18",13.0],["2015-08-19",13.0],["2015-08-20",8.0],["2015-08-21",8.0],["2015-08-24",3.0],["2015-08-25",9.0],["2015-08-26",12.0],["2015-08-27",13.0],["2015-08-28",14.0],["2015-08-31",14.0],["2015-09-01",9.0],["2015-09-02",13.0],["2015-09-03",11.0],["2015-09-04",10.0],["2015-09-08",13.0],["2015-09-09",13.0],["2015-09-10",15.0],["2015-09-11",14.0],["2015-09-14",13.0],["2015-09-15",16.0],["2015-09-16",16.0],["2015-09-17",16.0],["2015-09-18",18.0],["2015-09-21",23.0],["2015-09-22",31.0],["2015-09-23",31.0],["2015-09-24",22.0],["2015-09-25",18.0],["2015-09-28",15.0],["2015-09-29",13.0],["2015-09-30",21.0],["2015-10-01",18.0],["2015-10-02",24.0],["2015-10-05",31.0],["2015-10-06",36.0],["2015-10-07",37.0],["2015-10-08",42.0],["2015-10-09",43.0],["2015-10-12",41.0],["2015-10-13",35.0],["2015-10-14",35.0],["2015-10-15",41.0],["2015-10-16",45.0],["2015-10-19",47.0],["2015-10-20",51.0],["2015-10-21",50.0],["2015-10-22",55.0],["2015-10-23",59.0],["2015-10-26",61.0],["2015-10-27",69.0],["2015-10-28",69.0],["2015-10-29",71.0],["2015-10-30",70.0],["2015-11-02",73.0],["2015-11-03",73.0],["2015-11-04",72.0],["2015-11-05",73.0],["2015-11-06",71.0],["2015-11-09",67.0],["2015-11-10",66.0],["2015-11-11",63.0],["2015-11-12",55.0],["2015-11-13",45.0],["2015-11-16",50.0],["2015-11-17",48.0],["2015-11-18",53.0],["2015-11-19",52.0],["2015-11-20",54.0],["2015-11-23",53.0],["2015-11-24",58.0],["2015-11-25",59.0],["2015-11-27",58.0],["2015-11-30",58.0],["2015-12-01",60.0],["2015-12-02",55.0],["2015-12-03",49.0],["2015-12-04",58.0],["2015-12-07",47.0],["2015-12-08",38.0],["2015-12-09",35.0],["2015-12-10",36.0],["2015-12-11",24.0],["2015-12-14",29.0],["2015-12-15",35.0],["2015-12-16",44.0],["2015-12-17",34.0],["2015-12-18",29.0],["2015-12-21",32.0],["2015-12-22",36.0],["2015-12-23",42.0],["2015-12-24",42.0],["2015-12-28",44.0],["2015-12-29",51.0],["2015-12-30",47.0],["2015-12-31",45.0],["2016-01-04",40.0],["2016-01-05",41.0],["2016-01-06",34.0],["2016-01-07",25.0],["2016-01-08",17.0],["2016-01-11",18.0],["2016-01-12",17.0],["2016-01-13",14.0],["2016-01-14",18.0],["2016-01-15",10.0],["2016-01-19",11.0],["2016-01-20",9.0],["2016-01-21",13.0],["2016-01-22",14.0],["2016-01-25",15.0],["2016-01-26",18.0],["2016-01-27",19.0],["2016-01-28",21.0],["2016-01-29",27.0],["2016-02-01",27.0],["2016-02-02",23.0],["2016-02-03",25.0],["2016-02-04",25.0],["2016-02-05",17.0],["2016-02-08",14.0],["2016-02-09",20.0],["2016-02-10",16.0],["2016-02-11",18.0],["2016-02-12",24.0],["2016-02-16",34.0],["2016-02-17",45.0],["2016-02-18",47.0],["2016-02-19",50.0],["2016-02-22",51.0],["2016-02-23",51.0],["2016-02-24",49.0],["2016-02-25",54.0],["2016-02-26",57.0],["2016-02-29",53.0],["2016-03-01",64.0],["2016-03-02",66.0],["2016-03-03",69.0],["2016-03-04",71.0],["2016-03-07",73.0],["2016-03-08",70.0],["2016-03-09",71.0],["2016-03-10",71.0],["2016-03-11",75.0],["2016-03-14",73.0],["2016-03-15",73.0],["2016-03-16",75.0],["2016-03-17",78.0],["2016-03-18",79.0],["2016-03-21",78.0],["2016-03-22",78.0],["2016-03-23",70.0],["2016-03-24",66.0],["2016-03-28",64.0],["2016-03-29",68.0],["2016-03-30",71.0],["2016-03-31",73.0],["2016-04-01",78.0],["2016-04-04",74.0],["2016-04-05",67.0],["2016-04-06",77.0],["2016-04-07",66.0],["2016-04-08",68.0],["2016-04-11",64.0],["2016-04-12",68.0],["2016-04-13",71.0],["2016-04-14",72.0],["2016-04-15",70.0],["2016-04-18",75.0],["2016-04-19",75.0],["2016-04-20",76.0],["2016-04-21",74.0],["2016-04-22",74.0],["2016-04-25",70.0],["2016-04-26",72.0],["2016-04-27",72.0],["2016-04-28",69.0],["2016-04-29",63.0],["2016-05-02",71.0],["2016-05-03",63.0],["2016-05-04",57.0],["2016-05-05",58.0],["2016-05-06",61.0],["2016-05-09",60.0],["2016-05-10",67.0],["2016-05-11",60.0],["2016-05-12",61.0],["2016-05-13",54.0],["2016-05-16",62.0],["2016-05-17",53.0],["2016-05-18",55.0],["2016-05-19",51.0],["2016-05-20",56.0],["2016-05-23",54.0],["2016-05-24",65.0],["2016-05-25",73.0],["2016-05-26",74.0],["2016-05-27",78.0],["2016-05-31",75.0],["2016-06-01",78.0],["2016-06-02",79.0],["2016-06-03",75.0],["2016-06-06",80.0],["2016-06-07",81.0],["2016-06-08",80.0],["2016-06-09",79.0],["2016-06-10",61.0],["2016-06-13",53.0],["2016-06-14",50.0],["2016-06-15",50.0],["2016-06-16",51.0],["2016-06-17",53.0],["2016-06-20",62.0],["2016-06-21",67.0],["2016-06-22",57.0],["2016-06-23",77.0],["2016-06-24",42.0],["2016-06-27",37.0],["2016-06-28",47.0],["2016-06-29",60.0],["2016-06-30",64.0],["2016-07-01",71.0],["2016-07-05",67.0],["2016-07-06",70.0],["2016-07-07",69.0],["2016-07-08",78.0],["2016-07-11",83.0],["2016-07-12",88.0],["2016-07-13",86.0],["2016-07-14",90.0],["2016-07-15",89.0],["2016-07-18",91.0],["2016-07-19",87.0],["2016-07-20",90.0],["2016-07-21",85.0],["2016-07-22",86.0],["2016-07-25",85.0],["2016-07-26",85.0],["2016-07-27",82.0],["2016-07-28",82.0],["2016-07-29",79.0],["2016-08-01",77.0],["2016-08-02",77.0],["2016-08-03",81.0],["2016-08-04",80.0],["2016-08-05",86.0],["2016-08-08",84.0],["2016-08-09",80.0],["2016-08-10",74.0],["2016-08-11",80.0],["2016-08-12",75.0],["2016-08-15",81.0],["2016-08-16",77.0],["2016-08-17",76.0],["2016-08-18",78.0],["2016-08-19",77.0],["2016-08-22",72.0],["2016-08-23",76.0],["2016-08-24",69.0],["2016-08-25",66.0],["2016-08-26",63.0],["2016-08-29",64.0],["2016-08-30",64.0],["2016-08-31",61.0],["2016-09-01",62.0],["2016-09-02",65.0],["2016-09-06",65.0],["2016-09-07",65.0],["2016-09-08",70.0],["2016-09-09",43.0],["2016-09-12",58.0],["2016-09-13",35.0],["2016-09-14",33.0],["2016-09-15",43.0],["2016-09-16",43.0],["2016-09-19",44.0],["2016-09-20",45.0],["2016-09-21",56.0],["2016-09-22",60.0],["2016-09-23",54.0],["2016-09-26",41.0],["2016-09-27",45.0],["2016-09-28",51.0],["2016-09-29",37.0],["2016-09-30",49.0],["2016-10-03",45.0],["2016-10-04",43.0],["2016-10-05",51.0],["2016-10-06",53.0],["2016-10-07",51.0],["2016-10-10",57.0],["2016-10-11",43.0],["2016-10-12",45.0],["2016-10-13",34.0],["2016-10-14",41.0],["2016-10-17",33.0],["2016-10-18",40.0],["2016-10-19",39.0],["2016-10-20",38.0],["2016-10-21",43.0],["2016-10-24",53.0],["2016-10-25",48.0],["2016-10-26",43.0],["2016-10-27",46.0],["2016-10-28",32.0],["2016-10-31",30.0],["2016-11-01",21.0],["2016-11-02",17.0],["2016-11-03",14.0],["2016-11-04",14.0],["2016-11-07",33.0],["2016-11-08",33.0],["2016-11-09",43.0],["2016-11-10",45.0],["2016-11-11",48.0],["2016-11-14",53.0],["2016-11-15",63.0],["2016-11-16",60.0],["2016-11-17",63.0],["2016-11-18",61.0],["2016-11-21",67.0],["2016-11-22",67.0],["2016-11-23",70.0],["2016-11-25",72.0],["2016-11-28",70.0],["2016-11-29",71.0],["2016-11-30",73.0],["2016-12-01",71.0],["2016-12-02",71.0],["2016-12-05",75.0],["2016-12-06",77.0],["2016-12-07",83.0],["2016-12-08",85.0],["2016-12-09",87.0],["2016-12-12",87.0],["2016-12-13",88.0],["2016-12-14",86.0],["2016-12-15",86.0],["2016-12-16",84.0],["2016-12-19",82.0],["2016-12-20",79.0],["2016-12-21",74.0],["2016-12-22",71.0],["2016-12-23",66.0],["2016-12-27",70.0],["2016-12-28",64.0],["2016-12-29",64.0],["2016-12-30",58.0],["2017-01-03",71.0],["2017-01-04",71.0],["2017-01-05",68.0],["2017-01-06",70.0],["2017-01-09",66.0],["2017-01-10",62.0],["2017-01-11",61.0],["2017-01-12",55.0],["2017-01-13",57.0],["2017-01-17",57.0],["2017-01-18",56.0],["2017-01-19",53.0],["2017-01-20",54.0],["2017-01-23",49.0],["2017-01-24",54.0],["2017-01-25",62.0],["2017-01-26",57.0],["2017-01-27",59.0],["2017-01-30",53.0],["2017-01-31",54.0],["2017-02-01",53.0],["2017-02-02",51.0],["2017-02-03",60.0],["2017-02-06",56.0],["2017-02-07",56.0],["2017-02-08",61.0],["2017-02-09",69.0],["2017-02-10",69.0],["2017-02-13",74.0],["2017-02-14",79.0],["2017-02-15",80.0],["2017-02-16",78.0],["2017-02-17",77.0],["2017-02-21",83.0],["2017-02-22",80.0],["2017-02-23",75.0],["2017-02-24",68.0],["2017-02-27",71.0],["2017-02-28",64.0],["2017-03-01",81.0],["2017-03-02",75.0],["2017-03-03",74.0],["2017-03-06",69.0],["2017-03-07",70.0],["2017-03-08",62.0],["2017-03-09",62.0],["2017-03-10",66.0],["2017-03-13",64.0],["2017-03-14",51.0],["2017-03-15",53.0],["2017-03-16",51.0],["2017-03-17",45.0],["2017-03-20",42.0],["2017-03-21",36.0],["2017-03-22",32.0],["2017-03-23",30.0],["2017-03-24",30.0],["2017-03-27",29.0],["2017-03-28",34.0],["2017-03-29",34.0],["2017-03-30",43.0],["2017-03-31",47.0],["2017-04-03",46.0],["2017-04-04",46.0],["2017-04-05",43.0],["2017-04-06",43.0],["2017-04-07",40.0],["2017-04-10",37.0],["2017-04-11",31.0],["2017-04-12",28.0],["2017-04-13",25.0],["2017-04-17",30.0],["2017-04-18",30.0],["2017-04-19",30.0],["2017-04-20",34.0],["2017-04-21",35.0],["2017-04-24",39.0],["2017-04-25",46.0],["2017-04-26",48.0],["2017-04-27",50.0],["2017-04-28",50.0],["2017-05-01",49.0],["2017-05-02",51.0],["2017-05-03",47.0],["2017-05-04",45.0],["2017-05-05",47.0],["2017-05-08",49.0],["2017-05-09",50.0],["2017-05-10",61.0],["2017-05-11",63.0],["2017-05-12",62.0],["2017-05-15",64.0],["2017-05-16",66.0],["2017-05-17",45.0],["2017-05-18",43.0],["2017-05-19",49.0],["2017-05-22",50.0],["2017-05-23",45.0],["2017-05-24",54.0],["2017-05-25",57.0],["2017-05-26",58.0],["2017-05-30",53.0],["2017-05-31",50.0],["2017-06-01",58.0],["2017-06-02",57.0],["2017-06-05",58.0],["2017-06-06",55.0],["2017-06-07",55.0],["2017-06-08",55.0],["2017-06-09",54.0],["2017-06-12",55.0],["2017-06-13",55.0],["2017-06-14",52.0],["2017-06-15",52.0],["2017-06-16",50.0],["2017-06-19",57.0],["2017-06-20",48.0],["2017-06-21",42.0],["2017-06-22",50.0],["2017-06-23",52.0],["2017-06-26",53.0],["2017-06-27",48.0],["2017-06-28",60.0],["2017-06-29",47.0],["2017-06-30",49.0],["2017-07-03",54.0],["2017-07-05",57.0],["2017-07-06",44.0],["2017-07-07",49.0],["2017-07-10",46.0],["2017-07-11",41.0],["2017-07-12",47.0],["2017-07-13",54.0],["2017-07-14",64.0],["2017-07-17",67.0],["2017-07-18",62.0],["2017-07-19",74.0],["2017-07-20",76.0],["2017-07-21",73.0],["2017-07-24",72.0],["2017-07-25",81.0],["2017-07-26",78.0],["2017-07-27",73.0],["2017-07-28",70.0],["2017-07-31",70.0],["2017-08-01",65.0],["2017-08-02",67.0],["2017-08-03",59.0],["2017-08-04",64.0],["2017-08-07",63.0],["2017-08-08",61.0],["2017-08-09",54.0],["2017-08-10",31.0],["2017-08-11",28.0],["2017-08-14",39.0],["2017-08-15",36.0],["2017-08-16",34.0],["2017-08-17",19.0],["2017-08-18",17.0],["2017-08-21",15.0],["2017-08-22",23.0],["2017-08-23",19.0],["2017-08-24",22.0],["2017-08-25",27.0],["2017-08-28",29.0],["2017-08-29",28.0],["2017-08-30",35.0],["2017-08-31",43.0],["2017-09-01",50.0],["2017-09-05",35.0],["2017-09-06",41.0],["2017-09-07",38.0],["2017-09-08",38.0],["2017-09-11",53.0],["2017-09-12",63.0],["2017-09-13",68.0],["2017-09-14",68.0],["2017-09-15",77.0],["2017-09-18",80.0],["2017-09-19",81.0],["2017-09-20",79.0],["2017-09-21",73.0],["2017-09-22",70.0],["2017-09-25",65.0],["2017-09-26",67.0],["2017-09-27",78.0],["2017-09-28",79.0],["2017-09-29",85.0],["2017-10-02",89.0],["2017-10-03",92.0],["2017-10-04",91.0],["2017-10-05",95.0],["2017-10-06",92.0],["2017-10-09",84.0],["2017-10-10",85.0],["2017-10-11",83.0],["2017-10-12",77.0],["2017-10-13",73.0],["2017-10-16",78.0],["2017-10-17",78.0],["2017-10-18",82.0],["2017-10-19",83.0],["2017-10-20",90.0],["2017-10-23",85.0],["2017-10-24",87.0],["2017-10-25",75.0],["2017-10-26",71.0],["2017-10-27",73.0],["2017-10-30",74.0],["2017-10-31",65.0],["2017-11-01",72.0],["2017-11-02",69.0],["2017-11-03",66.0],["2017-11-06",68.0],["2017-11-07",58.0],["2017-11-08",54.0],["2017-11-09",54.0],["2017-11-10",54.0],["2017-11-13",53.0],["2017-11-14",49.0],["2017-11-15",36.0],["2017-11-16",50.0],["2017-11-17",44.0],["2017-11-20",50.0],["2017-11-21",54.0],["2017-11-22",54.0],["2017-11-24",59.0],["2017-11-27",51.0],["2017-11-28",64.0],["2017-11-29",67.0],["2017-11-30",73.0],["2017-12-01",70.0],["2017-12-04",64.0],["2017-12-05",63.0],["2017-12-06",60.0],["2017-12-07",60.0],["2017-12-08",64.0],["2017-12-11",62.0],["2017-12-12",66.0],["2017-12-13",67.0],["2017-12-14",66.0],["2017-12-15",68.0],["2017-12-18",74.0],["2017-12-19",73.0],["2017-12-20",72.0],["2017-12-21",68.0],["2017-12-22",66.0],["2017-12-26",64.0],["2017-12-27",61.0],["2017-12-28",62.0],["2017-12-29",53.0],["2018-01-02",63.0],["2018-01-03",67.0],["2018-01-04",72.0],["2018-01-05",75.0],["2018-01-08",75.0],["2018-01-09",76.0],["2018-01-10",75.0],["2018-01-11",77.0],["2018-01-12",79.0],["2018-01-16",75.0],["2018-01-17",75.0],["2018-01-18",72.0],["2018-01-19",80.0],["2018-01-22",79.0],["2018-01-23",78.0],["2018-01-24",78.0],["2018-01-25",77.0],["2018-01-26",79.0],["2018-01-29",68.0],["2018-01-30",62.0],["2018-01-31",61.0],["2018-02-01",58.0],["2018-02-02",40.0],["2018-02-05",17.0],["2018-02-06",18.0],["2018-02-07",16.0],["2018-02-08",8.0],["2018-02-09",10.0],["2018-02-12",12.0],["2018-02-13",13.0],["2018-02-14",11.0],["2018-02-15",15.0],["2018-02-16",18.0],["2018-02-20",17.0],["2018-02-21",18.0],["2018-02-22",15.0],["2018-02-23",18.0],["2018-02-26",20.0],["2018-02-27",17.0],["2018-02-28",12.0],["2018-03-01",8.0],["2018-03-02",10.0],["2018-03-05",14.0],["2018-03-06",26.0],["2018-03-07",20.0],["2018-03-08",20.0],["2018-03-09",44.0],["2018-03-12",40.0],["2018-03-13",36.0],["2018-03-14",30.0],["2018-03-15",21.0],["2018-03-16",19.0],["2018-03-19",14.0],["2018-03-20",15.0],["2018-03-21",16.0],["2018-03-22",9.0],["2018-03-23",7.0],["2018-03-26",8.0],["2018-03-27",7.0],["2018-03-28",6.0],["2018-03-29",8.0],["2018-04-02",7.0],["2018-04-03",9.0],["2018-04-04",11.0],["2018-04-05",13.0],["2018-04-06",9.0],["2018-04-09",12.0],["2018-04-10",17.0],["2018-04-11",17.0],["2018-04-12",22.0],["2018-04-13",23.0],["2018-04-16",25.0],["2018-04-17",28.0],["2018-04-18",32.0],["2018-04-19",32.0],["2018-04-20",38.0],["2018-04-23",40.0],["2018-04-24",33.0],["2018-04-25",38.0],["2018-04-26",42.0],["2018-04-27",40.0],["2018-04-30",42.0],["2018-05-01",42.0],["2018-05-02",38.0],["2018-05-03",32.0],["2018-05-04",40.0],["2018-05-07",44.0],["2018-05-08",41.0],["2018-05-09",49.0],["2018-05-10",54.0],["2018-05-11",55.0],["2018-05-14",54.0],["2018-05-15",52.0],["2018-05-16",55.0],["2018-05-17",55.0],["2018-05-18",52.0],["2018-05-21",56.0],["2018-05-22",59.0],["2018-05-23",54.0],["2018-05-24",48.0],["2018-05-25",44.0],["2018-05-29",34.0],["2018-05-30",42.0],["2018-05-31",43.0],["2018-06-01",52.0],["2018-06-04",55.0],["2018-06-05",58.0],["2018-06-06",65.0],["2018-06-07",62.0],["2018-06-08",63.0],["2018-06-11",65.0],["2018-06-12",65.0],["2018-06-13",63.0],["2018-06-14",63.0],["2018-06-15",61.0],["2018-06-18",61.0],["2018-06-19",53.0],["2018-06-20",57.0],["2018-06-21",52.0],["2018-06-22",53.0],["2018-06-25",42.0],["2018-06-26",47.0],["2018-06-27",36.0],["2018-06-28",39.0],["2018-06-29",34.0],["2018-07-02",35.0],["2018-07-03",32.0],["2018-07-05",33.0],["2018-07-06",40.0],["2018-07-09",47.0],["2018-07-10",49.0],["2018-07-11",41.0],["2018-07-12",49.0],["2018-07-13",47.0],["2018-07-16",45.0],["2018-07-17",49.0],["2018-07-18",56.0],["2018-07-19",50.0],["2018-07-20",53.0],["2018-07-23",58.0],["2018-07-24",64.0],["2018-07-25",70.0],["2018-07-26",72.0],["2018-07-27",67.0],["2018-07-30",64.0],["2018-07-31",66.0],["2018-08-01",66.0],["2018-08-02",68.0],["2018-08-03",71.0],["2018-08-06",72.0],["2018-08-07",73.0],["2018-08-08",74.0],["2018-08-09",70.0],["2018-08-10",60.0],["2018-08-13",56.0],["2018-08-14",58.0],["2018-08-15",46.0],["2018-08-16",51.0],["2018-08-17",54.0],["2018-08-20",55.0],["2018-08-21",61.0],["2018-08-22",61.0],["2018-08-23",59.0],["2018-08-24",68.0],["2018-08-27",77.0],["2018-08-28",74.0],["2018-08-29",78.0],["2018-08-30",73.0],["2018-08-31",71.0],["2018-09-04",67.0],["2018-09-05",62.0],["2018-09-06",53.0],["2018-09-07",52.0],["2018-09-10",56.0],["2018-09-11",59.0],["2018-09-12",59.0],["2018-09-13",72.0],["2018-09-14",73.0],["2018-09-17",67.0],["2018-09-18",73.0],["2018-09-19",71.0],["2018-09-20",74.0],["2018-09-21",75.0],["2018-09-24",70.0],["2018-09-25",64.0],["2018-09-26",53.0],["2018-09-27",48.0],["2018-09-28",47.0],["2018-10-01",49.0],["2018-10-02",45.0],["2018-10-03",51.0],["2018-10-04",43.0],["2018-10-05",33.0],["2018-10-08",28.0],["2018-10-09",23.0],["2018-10-10",8.0],["2018-10-11",5.0],["2018-10-12",11.0],["2018-10-15",11.0],["2018-10-16",13.0],["2018-10-17",14.0],["2018-10-18",12.0],["2018-10-19",14.0],["2018-10-22",16.0],["2018-10-23",12.0],["2018-10-24",6.0],["2018-10-25",9.0],["2018-10-26",7.0],["2018-10-29",7.0],["2018-10-30",10.0],["2018-10-31",7.0],["2018-11-01",6.0],["2018-11-02",8.0],["2018-11-05",9.0],["2018-11-06",12.0],["2018-11-07",25.0],["2018-11-08",29.0],["2018-11-09",18.0],["2018-11-12",11.0],["2018-11-13",10.0],["2018-11-14",7.0],["2018-11-15",10.0],["2018-11-16",10.0],["2018-11-19",8.0],["2018-11-20",7.0],["2018-11-21",13.0],["2018-11-23",9.0],["2018-11-26",17.0],["2018-11-27",19.0],["2018-11-28",23.0],["2018-11-29",23.0],["2018-11-30",22.0],["2018-12-03",32.0],["2018-12-04",20.0],["2018-12-06",15.0],["2018-12-07",11.0],["2018-12-10",9.0],["2018-12-11",8.0],["2018-12-12",10.0],["2018-12-13",11.0],["2018-12-14",8.0],["2018-12-17",10.0],["2018-12-18",8.0],["2018-12-19",8.0],["2018-12-20",5.0],["2018-12-21",3.0],["2018-12-24",2.0],["2018-12-26",4.0],["2018-12-27",8.0],["2018-12-28",12.0],["2018-12-31",12.0],["2019-01-02",12.0],["2019-01-03",10.0],["2019-01-04",16.0],["2019-01-07",19.0],["2019-01-08",24.0],["2019-01-09",27.0],["2019-01-10",31.0],["2019-01-11",30.0],["2019-01-14",28.0],["2019-01-15",31.0],["2019-01-16",38.0],["2019-01-17",44.0],["2019-01-18",51.0],["2019-01-22",51.0],["2019-01-23",55.0],["2019-01-24",58.0],["2019-01-25",58.0],["2019-01-28",55.0],["2019-01-29",55.0],["2019-01-30",58.0],["2019-01-31",60.0],["2019-02-01",61.0],["2019-02-04",64.0],["2019-02-05",64.0],["2019-02-06",65.0],["2019-02-07",62.0],["2019-02-08",61.0],["2019-02-11",62.0],["2019-02-12",67.0],["2019-02-13",67.0],["2019-02-14",65.0],["2019-02-15",70.0],["2019-02-19",68.0],["2019-02-20",70.0],["2019-02-21",68.0],["2019-02-22",69.0],["2019-02-25",70.0],["2019-02-26",70.0],["2019-02-27",72.0],["2019-02-28",72.0],["2019-03-01",72.0],["2019-03-04",66.0],["2019-03-05",66.0],["2019-03-06",63.0],["2019-03-07",59.0],["2019-03-08",55.0],["2019-03-11",59.0],["2019-03-12",58.0],["2019-03-13",60.0],["2019-03-14",60.0],["2019-03-15",65.0],["2019-03-18",65.0],["2019-03-19",67.0],["2019-03-20",62.0],["2019-03-21",68.0],["2019-03-22",59.0],["2019-03-25",56.0],["2019-03-26",54.0],["2019-03-27",51.0],["2019-03-28",48.0],["2019-03-29",49.0],["2019-04-01",54.0],["2019-04-02",56.0],["2019-04-03",62.0],["2019-04-04",70.0],["2019-04-05",74.0],["2019-04-08",74.0],["2019-04-09",70.0],["2019-04-10",69.0],["2019-04-11",68.0],["2019-04-12",74.0],["2019-04-15",68.0],["2019-04-16",70.0],["2019-04-17",71.0],["2019-04-18",70.0],["2019-04-22",71.0],["2019-04-23",75.0],["2019-04-24",70.0],["2019-04-25",71.0],["2019-04-26",72.0],["2019-04-29",71.0],["2019-04-30",66.0],["2019-05-01",62.0],["2019-05-02",59.0],["2019-05-03",60.0],["2019-05-06",55.0],["2019-05-07",40.0],["2019-05-08",42.0],["2019-05-09",40.0],["2019-05-10",44.0],["2019-05-13",32.0],["2019-05-14",35.0],["2019-05-15",35.0],["2019-05-16",39.0],["2019-05-17",36.0],["2019-05-20",34.0],["2019-05-21",34.0],["2019-05-22",32.0],["2019-05-23",28.0],["2019-05-24",27.0],["2019-05-28",25.0],["2019-05-29",23.0],["2019-05-30",24.0],["2019-05-31",24.0],["2019-06-03",23.0],["2019-06-04",26.0],["2019-06-05",29.0],["2019-06-06",29.0],["2019-06-07",32.0],["2019-06-10",37.0],["2019-06-11",36.0],["2019-06-12",34.0],["2019-06-13",39.0],["2019-06-14",38.0],["2019-06-17",37.0],["2019-06-18",44.0],["2019-06-19",42.0],["2019-06-20",45.0],["2019-06-21",50.0],["2019-06-24",50.0],["2019-06-25",44.0],["2019-06-26",48.0],["2019-06-27",47.0],["2019-06-28",50.0],["2019-07-01",55.0],["2019-07-02",56.0],["2019-07-03",63.0],["2019-07-05",61.0],["2019-07-08",59.0],["2019-07-09",56.0],["2019-07-10",58.0],["2019-07-11",62.0],["2019-07-12",64.0],["2019-07-15",57.0],["2019-07-16",55.0],["2019-07-17",47.0],["2019-07-18",47.0],["2019-07-19",44.0],["2019-07-22",44.0],["2019-07-23",50.0],["2019-07-24",57.0],["2019-07-25",55.0],["2019-07-26",60.0],["2019-07-29",58.0],["2019-07-30",53.0],["2019-07-31",48.0],["2019-08-01",43.0],["2019-08-02",36.0],["2019-08-05",22.0],["2019-08-06",27.0],["2019-08-07",25.0],["2019-08-08",25.0],["2019-08-09",25.0],["2019-08-12",23.0],["2019-08-13",27.0],["2019-08-14",21.0],["2019-08-15",19.0],["2019-08-16",20.0],["2019-08-19",26.0],["2019-08-20",23.0],["2019-08-21",25.0],["2019-08-22",25.0],["2019-08-23",18.0],["2019-08-26",19.0],["2019-08-27",16.0],["2019-08-28",18.0],["2019-08-29",26.0],["2019-08-30",23.0],["2019-09-03",25.0],["2019-09-04",28.0],["2019-09-05",39.0],["2019-09-06",35.0],["2019-09-09",45.0],["2019-09-10",55.0],["2019-09-11",57.0],["2019-09-12",65.0],["2019-09-13",68.0],["2019-09-16",67.0],["2019-09-17",66.0],["2019-09-18",66.0],["2019-09-19",63.0],["2019-09-20",58.0],["2019-09-23",59.0],["2019-09-24",54.0],["2019-09-25",59.0],["2019-09-26",57.0],["2019-09-27",52.0],["2019-09-30",54.0],["2019-10-01",48.0],["2019-10-02",34.0],["2019-10-03",29.0],["2019-10-04",32.0],["2019-10-07",30.0],["2019-10-08",29.0],["2019-10-09",30.0],["2019-10-10",36.0],["2019-10-11",42.0],["2019-10-14",42.0],["2019-10-15",42.0],["2019-10-16",47.0],["2019-10-17",50.0],["2019-10-18",50.0],["2019-10-21",56.0],["2019-10-22",59.0],["2019-10-23",55.0],["2019-10-24",57.0],["2019-10-25",62.0],["2019-10-28",67.0],["2019-10-29",71.0],["2019-10-30",75.0],["2019-10-31",72.0],["2019-11-01",80.0],["2019-11-04",86.0],["2019-11-05",89.0],["2019-11-06",88.0],["2019-11-07",91.0],["2019-11-08",91.0],["2019-11-11",89.0],["2019-11-12",88.0],["2019-11-13",87.0],["2019-11-14",83.0],["2019-11-15",87.0],["2019-11-18",83.0],["2019-11-19",80.0],["2019-11-20",74.0],["2019-11-21",70.0],["2019-11-22",69.0],["2019-11-25",70.0],["2019-11-26",69.0],["2019-11-27",78.0],["2019-11-29",78.0],["2019-12-02",74.0],["2019-12-03",63.0],["2019-12-04",67.0],["2019-12-05",67.0],["2019-12-06",70.0],["2019-12-09",68.0],["2019-12-10",65.0],["2019-12-11",61.0],["2019-12-12",74.0],["2019-12-13",75.0],["2019-12-16",82.0],["2019-12-17",85.0],["2019-12-18",87.0],["2019-12-19",90.0],["2019-12-20",91.0],["2019-12-23",92.0],["2019-12-24",91.0],["2019-12-26",93.0],["2019-12-27",91.0],["2019-12-30",90.0],["2019-12-31",93.0],["2020-01-02",97.0],["2020-01-03",93.0],["2020-01-06",93.0],["2020-01-07",89.0],["2020-01-08",92.0],["2020-01-09",93.0],["2020-01-10",91.0],["2020-01-13",90.0],["2020-01-14",90.0],["2020-01-15",86.0],["2020-01-16",89.0],["2020-01-17",89.0],["2020-01-21",81.0],["2020-01-22",74.0],["2020-01-23",68.0],["2020-01-24",62.0],["2020-01-27",47.0],["2020-01-28",53.0],["2020-01-29",52.0],["2020-01-30",56.0],["2020-01-31",44.0],["2020-02-03",46.0],["2020-02-04",55.0],["2020-02-05",60.0],["2020-02-06",63.0],["2020-02-07",57.0],["2020-02-10",57.0],["2020-02-11",56.0],["2020-02-12",60.0],["2020-02-13",58.0],["2020-02-14",55.0],["2020-02-18",51.0],["2020-02-19",53.0],["2020-02-20",49.0],["2020-02-21",44.0],["2020-02-24",29.0],["2020-02-25",22.0],["2020-02-26",21.0],["2020-02-27",13.0],["2020-02-28",10.0],["2020-03-02",12.0],["2020-03-03",10.0],["2020-03-04",15.0],["2020-03-05",9.0],["2020-03-06",6.0],["2020-03-09",3.0],["2020-03-10",6.0],["2020-03-11",4.0],["2020-03-12",2.0],["2020-03-13",5.0],["2020-03-16",3.0],["2020-03-17",5.0],["2020-03-18",5.0],["2020-03-19",7.0],["2020-03-20",8.0],["2020-03-23",5.0],["2020-03-24",13.0],["2020-03-25",17.0],["2020-03-26",22.0],["2020-03-27",23.0],["2020-03-30",25.0],["2020-03-31",25.0],["2020-04-01",22.0],["2020-04-02",22.0],["2020-04-03",22.0],["2020-04-06",32.0],["2020-04-07",26.0],["2020-04-08",33.0],["2020-04-09",43.0],["2020-04-13",36.0],["2020-04-14",45.0],["2020-04-15",41.0],["2020-04-16",42.0],["2020-04-17",44.0],["2020-04-20",41.0],["2020-04-21",40.0],["2020-04-22",41.0],["2020-04-23",40.0],["2020-04-24",39.0],["2020-04-27",43.0],["2020-04-28",41.0],["2020-04-29",46.0],["2020-04-30",47.0],["2020-05-01",42.0],["2020-05-04",44.0],["2020-05-05",44.0],["2020-05-06",40.0],["2020-05-07",41.0],["2020-05-08",45.0],["2020-05-11",44.0],["2020-05-12",38.0],["2020-05-13",38.0],["2020-05-14",39.0],["2020-05-15",39.0],["2020-05-18",49.0],["2020-05-19",47.0],["2020-05-20",53.0],["2020-05-21",52.0],["2020-05-22",50.0],["2020-05-26",51.0],["2020-05-27",54.0],["2020-05-28",50.0],["2020-05-29",52.0],["2020-06-01",58.0],["2020-06-02",58.0],["2020-06-03",61.0],["2020-06-04",62.0],["2020-06-05",66.0],["2020-07-09",53.0],["2020-07-10",59.0],["2020-07-13",53.0],["2020-07-14",62.0],["2020-07-15",63.0],["2020-07-16",62.0],["2020-07-17",63.0],["2020-07-20",66.0],["2020-07-21",65.0],["2020-07-22",65.0],["2020-07-23",68.0],["2020-07-24",63.0],["2020-07-27",66.0],["2020-07-28",62.0],["2020-07-29",65.0],["2020-07-30",61.0],["2020-07-31",65.0],["2020-08-03",67.0],["2020-08-04",68.0],["2020-08-05",70.0],["2020-08-06",74.0],["2020-08-07",72.0],["2020-08-10",75.0],["2020-08-11",71.0],["2020-08-12",74.0],["2020-08-13",72.0],["2020-08-14",72.0],["2020-08-17",71.0],["2020-08-18",70.0],["2020-08-19",68.0],["2020-08-20",70.0],["2020-08-21",70.0],["2020-08-24",73.0],["2020-08-25",74.0],["2020-08-26",75.0],["2020-08-27",76.0],["2020-08-28",78.0],["2020-08-31",74.0],["2020-09-01",77.0],["2020-09-02",78.0],["2020-09-03",58.0],["2020-09-04",59.0],["2020-09-08",54.0],["2020-09-09",66.0],["2020-09-10",59.0],["2020-09-11",58.0],["2020-09-14",59.0],["2020-09-15",59.0],["2020-09-16",56.0],["2020-09-17",53.0],["2020-09-18",52.0],["2020-09-21",51.0],["2020-09-22",52.0],["2020-09-23",46.0],["2020-09-24",48.0],["2020-09-25",49.0],["2020-09-28",50.0],["2020-09-29",44.0],["2020-09-30",45.0],["2020-10-01",41.0],["2020-10-02",40.0],["2020-10-05",45.0],["2020-10-06",44.0],["2020-10-07",51.0],["2020-10-08",53.0],["2020-10-09",55.0],["2020-10-12",60.0],["2020-10-13",56.0],["2020-10-14",55.0],["2020-10-15",59.0],["2020-10-16",62.0],["2020-10-19",59.0],["2020-10-20",58.0],["2020-10-21",63.0],["2020-10-22",69.0],["2020-10-23",67.0],["2020-10-26",44.0],["2020-10-27",47.0],["2020-10-28",33.0],["2020-10-29",33.0],["2020-10-30",29.0],["2020-11-02",25.0],["2020-11-03",32.0],["2020-11-04",36.0],["2020-11-05",41.0],["2020-11-06",40.0],["2020-11-09",54.0],["2020-11-10",58.0],["2020-11-11",66.0],["2020-11-12",55.0],["2020-11-13",59.0],["2020-11-16",71.0],["2020-11-17",67.0],["2020-11-18",63.0],["2020-11-19",64.0],["2020-11-20",62.0],["2020-11-23",75.0],["2020-11-24",88.0],["2020-11-25",91.0],["2020-11-27",92.0],["2020-11-30",88.0],["2020-12-01",85.0],["2020-12-02",87.0],["2020-12-03",85.0],["2020-12-04",89.0],["2020-12-07",88.0],["2020-12-08",82.0],["2020-12-09",80.0],["2020-12-10",77.0],["2020-12-11",76.0],["2020-12-14",69.0],["2020-12-15",69.0],["2020-12-16",69.0],["2020-12-17",71.0],["2020-12-18",63.0],["2020-12-21",63.0],["2020-12-22",59.0],["2020-12-23",57.0],["2020-12-24",54.0],["2020-12-28",54.0],["2020-12-29",52.0],["2020-12-30",50.0],["2020-12-31",51.0],["2021-01-04",52.0],["2021-01-05",53.0],["2021-01-06",59.0],["2021-01-07",66.0],["2021-01-08",71.0],["2021-01-11",65.0],["2021-01-12",69.0],["2021-01-13",70.0],["2021-01-14",67.0],["2021-01-15",60.0],["2021-01-19",61.0],["2021-01-20",69.0],["2021-01-21",63.0],["2021-01-22",69.0],["2021-01-25",66.0],["2021-01-26",62.0],["2021-01-27",40.0],["2021-01-28",45.0],["2021-01-29",38.0],["2021-02-01",43.4],["2021-02-02",60.47],["2021-02-03",59.2],["2021-02-04",61.07],["2021-02-05",68.0],["2021-02-08",72.87],["2021-02-09",75.4],["2021-02-10",75.27],["2021-02-11",76.0],["2021-02-12",77.67],["2021-02-16",73.93],["2021-02-17",70.2],["2021-02-18",62.53],["2021-02-19",56.24],["2021-02-22",52.48],["2021-02-23",50.56],["2021-02-24",63.8],["2021-02-25",46.16],["2021-02-26",53.52],["2021-03-01",58.52],["2021-03-02",50.32],["2021-03-03",43.84],["2021-03-04",37.8],["2021-03-05",41.52],["2021-03-08",39.08],["2021-03-09",43.36],["2021-03-10",45.56],["2021-03-11",50.48],["2021-03-12",53.72],["2021-03-15",56.52],["2021-03-16",54.8],["2021-03-17",57.87],["2021-03-18",52.33],["2021-03-19",50.83],["2021-03-22",50.7],["2021-03-23",41.8],["2021-03-24",37.67],["2021-03-25",37.83],["2021-03-26",37.57],["2021-03-29",39.57],["2021-03-30",42.03],["2021-03-31",44.57],["2021-04-01",46.4],["2021-04-05",54.57],["2021-04-06",53.5],["2021-04-07",52.53],["2021-04-08",48.1],["2021-04-09",47.5],["2021-04-12",43.43],["2021-04-13",43.63],["2021-04-14",39.97],["2021-04-15",47.17],["2021-04-16",51.3],["2021-04-19",45.27],["2021-04-20",42.87],["2021-04-21",49.63],["2021-04-22",46.7],["2021-04-23",47.7],["2021-04-26",50.53],["2021-04-27",54.8],["2021-04-28",52.4],["2021-04-29",56.17],["2021-04-30",46.53],["2021-05-03",47.57],["2021-05-04",43.47],["2021-05-05",43.03],["2021-05-06",43.93],["2021-05-07",48.17],["2021-05-10",44.93],["2021-05-11",42.03],["2021-05-12",26.77],["2021-05-13",34.43],["2021-05-14",36.0],["2021-05-17",36.37],["2021-05-18",34.03],["2021-05-19",32.33],["2021-05-20",32.3],["2021-05-21",29.43],["2021-05-24",29.5],["2021-05-25",26.67],["2021-05-26",28.13],["2021-05-27",30.3],["2021-05-28",31.57],["2021-06-01",35.4],["2021-06-02",42.13],["2021-06-03",40.8],["2021-06-04",41.9],["2021-06-07",44.47],["2021-06-08",46.47],["2021-06-09",48.53],["2021-06-10",48.9],["2021-06-11",51.23],["2021-06-14",54.17],["2021-06-15",52.67],["2021-06-16",44.8],["2021-06-17",42.03],["2021-06-18",31.6],["2021-06-21",32.47],["2021-06-22",32.8],["2021-06-23",33.27],["2021-06-24",36.9],["2021-06-25",41.63],["2021-06-28",41.43],["2021-06-29",39.83],["2021-06-30",38.0],["2021-07-01",38.67],["2021-07-02",38.67],["2021-07-06",33.3],["2021-07-07",33.1],["2021-07-08",26.97],["2021-07-09",31.0],["2021-07-12",31.7],["2021-07-13",31.27],["2021-07-14",29.53],["2021-07-15",27.33],["2021-07-16",26.9],["2021-07-19",8.98],["2021-07-20",20.07],["2021-07-21",24.2],["2021-07-22",24.33],["2021-07-23",28.3],["2021-07-26",30.9],["2021-07-27",27.17],["2021-07-28",27.47],["2021-07-29",29.23],["2021-07-30",25.77],["2021-08-02",25.1],["2021-08-03",29.53],["2021-08-04",28.63],["2021-08-05",29.63],["2021-08-06",31.87],["2021-08-09",32.07],["2021-08-10",34.83],["2021-08-11",37.93],["2021-08-12",43.13],["2021-08-13",47.13],["2021-08-16",44.87],["2021-08-17",31.7],["2021-08-18",18.2],["2021-08-19",14.88],["2021-08-20",23.87],["2021-08-23",30.43],["2021-08-24",34.4],["2021-08-25",36.03],["2021-08-26",36.83],["2021-08-27",47.47],["2021-08-30",47.87],["2021-08-31",47.23],["2021-09-01",43.13],["2021-09-02",44.17],["2021-09-03",44.07],["2021-09-07",41.7],["2021-09-08",38.57],["2021-09-09",33.8],["2021-09-10",20.6],["2021-09-13",28.27],["2021-09-14",24.8],["2021-09-15",31.2],["2021-09-16",31.5],["2021-09-17",17.93],["2021-09-20",11.1],["2021-09-21",11.45],["2021-09-22",20.03],["2021-09-23",24.5],["2021-09-24",23.83],["2021-09-27",24.77],["2021-09-28",12.47],["2021-09-29",12.48],["2021-09-30",9.97],["2021-10-01",18.33],["2021-10-04",9.5],["2021-10-05",18.77],["2021-10-06",20.07],["2021-10-07",24.6],["2021-10-08",25.27],["2021-10-11",25.9],["2021-10-12",22.7],["2021-10-13",24.1],["2021-10-14",31.83],["2021-10-15",43.63],["2021-10-18",46.57],["2021-10-19",53.4],["2021-10-20",56.57],["2021-10-21",60.2],["2021-10-22",59.5],["2021-10-25",62.97],["2021-10-26",63.03],["2021-10-27",58.33],["2021-10-28",64.4],["2021-10-29",65.43],["2021-11-01",66.13],["2021-11-02",68.27],["2021-11-03",72.2],["2021-11-04",72.43],["2021-11-05",73.6],["2021-11-08",74.53],["2021-11-09",77.17],["2021-11-10",73.09],["2021-11-11",72.23],["2021-11-12",74.0],["2021-11-15",71.63],["2021-11-16",72.49],["2021-11-17",69.2],["2021-11-18",70.14],["2021-11-19",62.77],["2021-11-22",60.0],["2021-11-23",60.37],["2021-11-24",56.94],["2021-11-26",31.26],["2021-11-29",38.11],["2021-11-30",24.77],["2021-12-01",25.36],["2021-12-02",22.93],["2021-12-03",20.16],["2021-12-06",21.26],["2021-12-07",37.89],["2021-12-08",41.31],["2021-12-09",36.86],["2021-12-10",42.0],["2021-12-13",35.4],["2021-12-14",31.54],["2021-12-15",37.8],["2021-12-16",33.57],["2021-12-17",32.51],["2021-12-20",29.43],["2021-12-21",34.03],["2021-12-22",39.54],["2021-12-23",50.49],["2021-12-27",56.4],["2021-12-28",62.97],["2021-12-29",64.03],["2021-12-30",63.97],["2021-12-31",62.54],["2022-01-03",65.23],["2022-01-04",64.26],["2022-01-05",51.03],["2022-01-06",52.14],["2022-01-07",49.26],["2022-01-10",51.14],["2022-01-11",56.11],["2022-01-12",55.94],["2022-01-13",52.17],["2022-01-14",55.8],["2022-01-18",53.71],["2022-01-19",44.83],["2022-01-20",39.14],["2022-01-21",26.73],["2022-01-24",23.13],["2022-01-25",20.89],["2022-01-26",19.51],["2022-01-27",18.6],["2022-01-28",23.86],["2022-01-31",29.2],["2022-02-01",30.8],["2022-02-02",28.8],["2022-02-03",26.06],["2022-02-04",27.6],["2022-02-07",27.91],["2022-02-08",28.94],["2022-02-09",32.66],["2022-02-10",33.6],["2022-02-11",28.49],["2022-02-14",25.69],["2022-02-15",29.97],["2022-02-16",32.09],["2022-02-17",32.46],["2022-02-18",29.51],["2022-02-22",28.77],["2022-02-23",18.81],["2022-02-24",21.23],["2022-02-25",28.14],["2022-02-28",25.47],["2022-03-01",22.97],["2022-03-02",17.83],["2022-03-03",21.73],["2022-03-04",18.17],["2022-03-07",16.9],["2022-03-08",16.67],["2022-03-09",18.03],["2022-03-10",17.96],["2022-03-11",19.06],["2022-03-14",17.5],["2022-03-15",21.86],["2022-03-16",25.26],["2022-03-17",33.63],["2022-03-18",38.43],["2022-03-21",40.97],["2022-03-22",44.54],["2022-03-23",45.2],["2022-03-24",46.91],["2022-03-25",49.37],["2022-03-28",51.26],["2022-03-29",52.71],["2022-03-30",52.8],["2022-03-31",59.2],["2022-04-01",59.8],["2022-04-04",61.66],["2022-04-05",47.91],["2022-04-06",46.4],["2022-04-07",46.83],["2022-04-08",46.09],["2022-04-11",43.4],["2022-04-12",42.06],["2022-04-13",41.8],["2022-04-14",39.86],["2022-04-18",37.6],["2022-04-19",39.63],["2022-04-20",43.31],["2022-04-21",38.94],["2022-04-22",31.63],["2022-04-25",29.97],["2022-04-26",17.9],["2022-04-27",16.27],["2022-04-28",24.26],["2022-04-29",14.33],["2022-05-02",13.27],["2022-05-03",30.49],["2022-05-04",22.4],["2022-05-05",13.13],["2022-05-06",12.24],["2022-05-09",8.19],["2022-05-10",7.4],["2022-05-11",4.03],["2022-05-12",3.2],["2022-05-13",11.29],["2022-05-16",11.74],["2022-05-17",15.2],["2022-05-18",6.6],["2022-05-19",13.71],["2022-05-20",12.66],["2022-05-23",17.89],["2022-05-24",16.0],["2022-05-25",17.57],["2022-05-26",24.11],["2022-05-27",29.54],["2022-05-31",40.06],["2022-06-01",40.6],["2022-06-02",44.83],["2022-06-03",35.46],["2022-06-06",42.8],["2022-06-07",45.63],["2022-06-08",48.11],["2022-06-09",47.06],["2022-06-10",40.0],["2022-06-13",25.09],["2022-06-14",20.53],["2022-06-15",29.26],["2022-06-16",17.7],["2022-06-17",16.93],["2022-06-21",19.73],["2022-06-22",26.89],["2022-06-23",26.74],["2022-06-24",30.86],["2022-06-27",30.77],["2022-06-28",28.14],["2022-06-29",26.54],["2022-06-30",24.37],["2022-07-01",24.57],["2022-07-05",22.17],["2022-07-06",22.83],["2022-07-07",27.6],["2022-07-08",31.34],["2022-07-11",30.37],["2022-07-12",30.31],["2022-07-13",27.29],["2022-07-14",26.51],["2022-07-15",33.29],["2022-07-18",35.89],["2022-07-19",39.31],["2022-07-20",44.09],["2022-07-21",48.2],["2022-07-22",42.43],["2022-07-25",42.2],["2022-07-26",42.0],["2022-07-27",46.63],["2022-07-28",48.49],["2022-07-29",52.4],["2022-08-01",59.09],["2022-08-02",57.37],["2022-08-03",60.26],["2022-08-04",61.51],["2022-08-05",63.31],["2022-08-08",64.74],["2022-08-09",64.46],["2022-08-10",65.11],["2022-08-11",65.83],["2022-08-12",68.03],["2022-08-15",66.83],["2022-08-16",67.94],["2022-08-17",67.14],["2022-08-18",66.37],["2022-08-19",63.71],["2022-08-22",60.31],["2022-08-23",57.43],["2022-08-24",57.51],["2022-08-25",58.26],["2022-08-26",55.74],["2022-08-29",54.29],["2022-08-30",49.8],["2022-08-31",52.09],["2022-09-01",49.37],["2022-09-02",42.46],["2022-09-06",40.63],["2022-09-07",39.63],["2022-09-08",40.37],["2022-09-09",43.8],["2022-09-12",47.6],["2022-09-13",36.63],["2022-09-14",41.89],["2022-09-15",40.66],["2022-09-16",35.29],["2022-09-19",36.31],["2022-09-20",36.11],["2022-09-21",27.21],["2022-09-22",24.49],["2022-09-23",21.69],["2022-09-26",17.63],["2022-09-27",16.51],["2022-09-28",17.03],["2022-09-29",13.26],["2022-09-30",16.46],["2022-10-03",20.39],["2022-10-04",27.89],["2022-10-05",29.71],["2022-10-06",23.14],["2022-10-07",19.67],["2022-10-10",19.4],["2022-10-11",16.89],["2022-10-12",15.94],["2022-10-13",19.37],["2022-10-14",16.46],["2022-10-17",23.4],["2022-10-18",28.8],["2022-10-19",29.43],["2022-10-20",39.09],["2022-10-21",43.74],["2022-10-24",47.23],["2022-10-25",51.37],["2022-10-26",53.8],["2022-10-27",54.57],["2022-10-28",57.11],["2022-10-31",64.06],["2022-11-01",63.51],["2022-11-02",55.29],["2022-11-03",55.51],["2022-11-04",56.51],["2022-11-07",59.66],["2022-11-08",57.94],["2022-11-09",54.0],["2022-11-10",60.34],["2022-11-11",63.74],["2022-11-14",62.69],["2022-11-15",66.91],["2022-11-16",65.09],["2022-11-17",61.49],["2022-11-18",60.34],["2022-11-21",60.97],["2022-11-22",60.8],["2022-11-23",64.26],["2022-11-25",63.09],["2022-11-28",59.74],["2022-11-29",58.17],["2022-11-30",73.97],["2022-12-01",75.6],["2022-12-02",68.14],["2022-12-05",65.09],["2022-12-06",61.83],["2022-12-07",58.43],["2022-12-08",55.69],["2022-12-09",52.09],["2022-12-12",57.2],["2022-12-13",59.17],["2022-12-14",60.94],["2022-12-15",60.14],["2022-12-16",44.14],["2022-12-19",39.97],["2022-12-20",38.31],["2022-12-21",38.54],["2022-12-22",37.0],["2022-12-23",39.51],["2022-12-27",39.94],["2022-12-28",35.51],["2022-12-29",37.14],["2022-12-30",36.51],["2023-01-03",36.6],["2023-01-04",39.86],["2023-01-05",44.17],["2023-01-06",45.71],["2023-01-09",47.2],["2023-01-10",49.66],["2023-01-11",54.23],["2023-01-12",56.69],["2023-01-13",61.31],["2023-01-17",64.14],["2023-01-18",58.43],["2023-01-19",55.43],["2023-01-20",58.54],["2023-01-23",63.6],["2023-01-24",63.0],["2023-01-25",63.89],["2023-01-26",68.03],["2023-01-27",69.2],["2023-01-30",67.46],["2023-01-31",70.34],["2023-02-01",82.17],["2023-02-02",75.2],["2023-02-03",76.14],["2023-02-06",75.91],["2023-02-07",76.34],["2023-02-08",74.63],["2023-02-09",72.63],["2023-02-10",72.49],["2023-02-13",71.83],["2023-02-14",73.26],["2023-02-15",73.66],["2023-02-16",70.71],["2023-02-17",69.49],["2023-02-21",65.91],["2023-02-22",64.17],["2023-02-23",62.66],["2023-02-24",60.66],["2023-02-27",61.23],["2023-02-28",61.2],["2023-03-01",65.91],["2023-03-02",52.46],["2023-03-03",55.69],["2023-03-06",55.26],["2023-03-07",48.51],["2023-03-08",49.83],["2023-03-09",37.54],["2023-03-10",26.89],["2023-03-13",23.36],["2023-03-14",25.09],["2023-03-15",22.69],["2023-03-16",32.57],["2023-03-17",27.0],["2023-03-20",30.43],["2023-03-21",43.49],["2023-03-22",41.03],["2023-03-23",38.34],["2023-03-24",37.71],["2023-03-27",40.2],["2023-03-28",39.6],["2023-03-29",41.46],["2023-03-30",45.23],["2023-03-31",49.49],["2023-04-03",61.49],["2023-04-04",50.23],["2023-04-05",52.63],["2023-04-06",55.26],["2023-04-10",57.91],["2023-04-11",58.49],["2023-04-12",60.74],["2023-04-13",63.17],["2023-04-14",65.71],["2023-04-17",67.09],["2023-04-18",65.49],["2023-04-19",67.26],["2023-04-20",64.06],["2023-04-21",63.51],["2023-04-24",63.49],["2023-04-25",57.06],["2023-04-26",52.4],["2023-04-27",58.31],["2023-04-28",59.43],["2023-05-01",59.43],["2023-05-02",55.51],["2023-05-03",54.63],["2023-05-04",49.6],["2023-05-05",53.89],["2023-05-08",57.14],["2023-05-09",59.57],["2023-05-10",59.97],["2023-05-11",59.06],["2023-05-12",57.34],["2023-05-15",57.26],["2023-05-16",55.29],["2023-05-17",60.26],["2023-05-18",64.91],["2023-05-19",65.46],["2023-05-22",67.86],["2023-05-23",65.8],["2023-05-24",61.83],["2023-05-25",62.69],["2023-05-26",65.71],["2023-05-30",66.09],["2023-05-31",64.17],["2023-06-01",68.06],["2023-06-02",75.43],["2023-06-05",69.49],["2023-06-06",73.51],["2023-06-07",74.46],["2023-06-08",75.77],["2023-06-09",76.97],["2023-06-12",78.06],["2023-06-13",79.63],["2023-06-14",79.63],["2023-06-15",80.89],["2023-06-16",81.26],["2023-06-20",80.11],["2023-06-21",80.11],["2023-06-22",80.06],["2023-06-23",75.71],["2023-06-26",73.46],["2023-06-27",75.49],["2023-06-28",76.51],["2023-06-29",79.2],["2023-06-30",79.49],["2023-07-03",82.23],["2023-07-05",79.26],["2023-07-06",77.91],["2023-07-07",77.69],["2023-07-10",76.69],["2023-07-11",78.29],["2023-07-12",78.17],["2023-07-13",79.4],["2023-07-14",79.8],["2023-07-17",80.03],["2023-07-18",81.69],["2023-07-19",82.34],["2023-07-20",80.86],["2023-07-21",81.03],["2023-07-24",82.51],["2023-07-25",81.23],["2023-07-26",80.6],["2023-07-27",77.66],["2023-07-28",76.91],["2023-07-31",77.63],["2023-08-01",77.34],["2023-08-02",77.34],["2023-08-03",73.63],["2023-08-04",64.5],["2023-08-07",72.06],["2023-08-08",69.2],["2023-08-09",67.31],["2023-08-10",66.34],["2023-08-11",65.03],["2023-08-14",66.29],["2023-08-15",54.5],["2023-08-16",49.49],["2023-08-17",46.14],["2023-08-18",43.66],["2023-08-21",43.49],["2023-08-22",43.44],["2023-08-23",50.17],["2023-08-24",40.59],["2023-08-25",47.03],["2023-08-28",45.29],["2023-08-29",49.17],["2023-08-30",50.43],["2023-08-31",52.94],["2023-09-01",55.03],["2023-09-05",59.09],["2023-09-06",56.71],["2023-09-07",53.63],["2023-09-08",51.91],["2023-09-11",52.2],["2023-09-12",51.4],["2023-09-13",51.4],["2023-09-14",54.43],["2023-09-15",52.03],["2023-09-18",49.49],["2023-09-19",49.94],["2023-09-20",48.29],["2023-09-21",37.16],["2023-09-22",33.16],["2023-09-25",38.43],["2023-09-26",24.23],["2023-09-27",22.83],["2023-09-28",29.0],["2023-09-29",28.4],["2023-10-02",28.31],["2023-10-03",20.53],["2023-10-04",20.99],["2023-10-05",20.33],["2023-10-06",27.71],["2023-10-09",29.26],["2023-10-10",32.31],["2023-10-11",34.34],["2023-10-12",35.69],["2023-10-13",26.27],["2023-10-16",35.74],["2023-10-17",39.14],["2023-10-18",30.57],["2023-10-19",29.54],["2023-10-20",22.86],["2023-10-23",25.84],["2023-10-24",33.49],["2023-10-25",25.21],["2023-10-26",22.71],["2023-10-27",21.61],["2023-10-30",29.2],["2023-10-31",30.14],["2023-11-01",32.17],["2023-11-02",37.69],["2023-11-03",36.11],["2023-11-06",38.91],["2023-11-07",39.63],["2023-11-08",39.77],["2023-11-09",41.0],["2023-11-10",41.46],["2023-11-13",39.89],["2023-11-14",46.6],["2023-11-15",52.54],["2023-11-16",55.06],["2023-11-17",58.86],["2023-11-20",61.29],["2023-11-21",61.17],["2023-11-22",65.06],["2023-11-24",66.86],["2023-11-27",65.31],["2023-11-28",65.09],["2023-11-29",63.29],["2023-11-30",64.37],["2023-12-01",64.51],["2023-12-04",63.71],["2023-12-05",65.14],["2023-12-06",63.97],["2023-12-07",66.14],["2023-12-08",65.94],["2023-12-11",67.29],["2023-12-12",67.89],["2023-12-13",67.54],["2023-12-14",70.54],["2023-12-15",69.46],["2023-12-18",70.49],["2023-12-19",82.97],["2023-12-20",75.57],["2023-12-21",77.0],["2023-12-22",79.74],["2023-12-26",81.94],["2023-12-27",81.17],["2023-12-28",81.26],["2023-12-29",80.71],["2024-01-02",79.71],["2024-01-03",76.71],["2024-01-04",78.69],["2024-01-05",75.77],["2024-01-08",76.17],["2024-01-09",75.69],["2024-01-10",76.37],["2024-01-11",74.66],["2024-01-12",73.09],["2024-01-16",72.29],["2024-01-17",57.21],["2024-01-18",66.46],["2024-01-19",72.83],["2024-01-22",72.86],["2024-01-23",70.26],["2024-01-24",72.49],["2024-01-25",73.23],["2024-01-26",73.8],["2024-01-29",74.11],["2024-01-30",74.23],["2024-01-31",64.11],["2024-02-01",72.34],["2024-02-02",74.6],["2024-02-05",73.31],["2024-02-06",73.2],["2024-02-07",73.77],["2024-02-08",74.6],["2024-02-09",75.43],["2024-02-12",75.83],["2024-02-13",66.74],["2024-02-14",67.51],["2024-02-15",73.86],["2024-02-16",73.49],["2024-02-20",63.74],["2024-02-21",63.7],["2024-02-22",73.94],["2024-02-23",73.34],["2024-02-26",71.91],["2024-02-27",75.77],["2024-02-28",76.77],["2024-02-29",77.46],["2024-03-01",76.83],["2024-03-04",79.23],["2024-03-05",76.11],["2024-03-06",72.54],["2024-03-07",73.86],["2024-03-08",70.03],["2024-03-11",62.77],["2024-03-12",72.2],["2024-03-13",71.77],["2024-03-14",70.4],["2024-03-15",68.63],["2024-03-18",70.74],["2024-03-19",70.86],["2024-03-20",69.63],["2024-03-21",71.37],["2024-03-22",69.51],["2024-03-25",67.43],["2024-03-26",67.91],["2024-03-27",69.77],["2024-03-28",68.77],["2024-04-01",71.26],["2024-04-02",71.14],["2024-04-03",69.4],["2024-04-04",53.8],["2024-04-05",58.1],["2024-04-08",64.03],["2024-04-09",59.63],["2024-04-10",49.67],["2024-04-11",56.66],["2024-04-12",45.01],["2024-04-15",38.4],["2024-04-16",35.11],["2024-04-17",31.16],["2024-04-18",30.4],["2024-04-19",27.67],["2024-04-22",34.17],["2024-04-23",36.57],["2024-04-24",37.49],["2024-04-25",39.09],["2024-04-26",40.51],["2024-04-29",42.43],["2024-04-30",40.54],["2024-05-01",40.51],["2024-05-02",42.23],["2024-05-03",43.26],["2024-05-06",39.0],["2024-05-07",37.17],["2024-05-08",38.17],["2024-05-09",42.23],["2024-05-10",46.03],["2024-05-13",48.11],["2024-05-14",55.29],["2024-05-15",59.37],["2024-05-16",62.31],["2024-05-17",62.8],["2024-05-20",60.43],["2024-05-21",59.43],["2024-05-22",58.51],["2024-05-23",52.37],["2024-05-24",51.74],["2024-05-28",54.69],["2024-05-29",49.97],["2024-05-30",45.09],["2024-05-31",48.43],["2024-06-03",45.49],["2024-06-04",47.63],["2024-06-05",51.14],["2024-06-06",45.31],["2024-06-07",43.4],["2024-06-10",44.74],["2024-06-11",44.4],["2024-06-12",46.57],["2024-06-13",44.57],["2024-06-14",41.11],["2024-06-17",43.29],["2024-06-18",41.29],["2024-06-20",38.71],["2024-06-21",39.06],["2024-06-24",37.77],["2024-06-25",37.29],["2024-06-26",40.89],["2024-06-27",45.51],["2024-06-28",44.31],["2024-07-01",47.94],["2024-07-02",49.74],["2024-07-03",48.37],["2024-07-05",49.71],["2024-07-08",51.06],["2024-07-09",50.57],["2024-07-10",54.6],["2024-07-11",49.4],["2024-07-12",54.37],["2024-07-15",57.74],["2024-07-16",57.03],["2024-07-17",46.11],["2024-07-18",45.94],["2024-07-19",43.0],["2024-07-22",48.43],["2024-07-23",46.86],["2024-07-24",38.61],["2024-07-25",39.07],["2024-07-26",42.54],["2024-07-29",42.07],["2024-07-30",40.8],["2024-07-31",46.89],["2024-08-01",42.69],["2024-08-02",41.39],["2024-08-05",33.06],["2024-08-06",19.01],["2024-08-07",16.56],["2024-08-08",17.66],["2024-08-09",24.09],["2024-08-12",23.8],["2024-08-13",25.51],["2024-08-14",26.43],["2024-08-15",32.37],["2024-08-16",33.74],["2024-08-19",39.89],["2024-08-20",44.69],["2024-08-21",50.23],["2024-08-22",46.77],["2024-08-23",51.57],["2024-08-26",52.94],["2024-08-27",52.29],["2024-08-28",51.09],["2024-08-29",56.06],["2024-08-30",60.31],["2024-09-03",56.34],["2024-09-04",56.63],["2024-09-05",50.63],["2024-09-06",39.34],["2024-09-09",41.97],["2024-09-10",39.69],["2024-09-11",43.09],["2024-09-12",42.97],["2024-09-13",48.63],["2024-09-16",50.31],["2024-09-17",54.63],["2024-09-18",55.17],["2024-09-19",63.8],["2024-09-20",61.2],["2024-09-23",63.86],["2024-09-24",66.43],["2024-09-25",65.74],["2024-09-26",70.74],["2024-09-27",67.31],["2024-09-30",73.69],["2024-10-01",70.31],["2024-10-02",70.57],["2024-10-03",69.43],["2024-10-04",71.4],["2024-10-07",70.83],["2024-10-08",71.17],["2024-10-09",71.14],["2024-10-10",70.29],["2024-10-11",71.66],["2024-10-14",74.23],["2024-10-15",71.14],["2024-10-16",69.03],["2024-10-17",68.57],["2024-10-18",72.43],["2024-10-21",69.8],["2024-10-22",70.37],["2024-10-23",63.2],["2024-10-24",62.94],["2024-10-25",58.74],["2024-10-28",60.86],["2024-10-29",60.06],["2024-10-30",57.2],["2024-10-31",40.46],["2024-11-01",50.49],["2024-11-04",42.43],["2024-11-05",43.54],["2024-11-06",44.0],["2024-11-07",59.06],["2024-11-08",59.43],["2024-11-11",66.6],["2024-11-12",66.71],["2024-11-13",66.31],["2024-11-14",60.31],["2024-11-15",51.2],["2024-11-18",50.29],["2024-11-19",49.51],["2024-11-20",49.51],["2024-11-21",56.6],["2024-11-22",60.71],["2024-11-25",62.89],["2024-11-26",65.91],["2024-11-27",64.4],["2024-11-29",65.0],["2024-12-02",65.31],["2024-12-03",59.57],["2024-12-04",57.49],["2024-12-05",54.91],["2024-12-06",52.14],["2024-12-09",49.26],["2024-12-10",46.97],["2024-12-11",49.2],["2024-12-12",47.11],["2024-12-13",49.11],["2024-12-16",56.06],["2024-12-17",51.4],["2024-12-18",33.13],["2024-12-19",19.51],["2024-12-20",27.6],["2024-12-23",30.14],["2024-12-24",34.51],["2024-12-26",34.17],["2024-12-27",33.83],["2024-12-30",28.6],["2024-12-31",26.31],["2025-01-02",24.31],["2025-01-03",28.89],["2025-01-06",33.77],["2025-01-07",34.31],["2025-01-08",31.91],["2025-01-10",25.63],["2025-01-13",25.34],["2025-01-14",25.14],["2025-01-15",27.43],["2025-01-16",27.34],["2025-01-17",36.03],["2025-01-21",39.91],["2025-01-22",41.63],["2025-01-23",43.69],["2025-01-24",45.8],["2025-01-27",37.97],["2025-01-28",40.63],["2025-01-29",42.4],["2025-01-30",45.91],["2025-01-31",43.77],["2025-02-03",37.4],["2025-02-04",37.14],["2025-02-05",38.63],["2025-02-06",39.69],["2025-02-07",38.37],["2025-02-10",44.71],["2025-02-11",45.4],["2025-02-12",41.37],["2025-02-13",46.6],["2025-02-14",43.69],["2025-02-18",46.8],["2025-02-19",47.63],["2025-02-20",44.23],["2025-02-21",36.97],["2025-02-24",29.54],["2025-02-25",24.2],["2025-02-26",21.26],["2025-02-27",12.76],["2025-02-28",20.66],["2025-03-03",12.34],["2025-03-04",11.04],["2025-03-05",11.51],["2025-03-06",17.2],["2025-03-07",17.64],["2025-03-10",17.07],["2025-03-11",15.11],["2025-03-12",15.91],["2025-03-13",15.19],["2025-03-14",22.06],["2025-03-17",22.57],["2025-03-18",22.23],["2025-03-19",21.6],["2025-03-20",21.69],["2025-03-21",22.69],["2025-03-24",25.4],["2025-03-25",29.29],["2025-03-26",28.89],["2025-03-27",28.34],["2025-03-28",26.37],["2025-03-31",21.11],["2025-04-01",19.57],["2025-04-02",22.6],["2025-04-03",12.14],["2025-04-04",5.39],["2025-04-07",4.0],["2025-04-08",2.9],["2025-04-09",9.5],["2025-04-10",5.61],["2025-04-11",8.39],["2025-04-14",12.34],["2025-04-15",13.11],["2025-04-16",11.14],["2025-04-17",16.06],["2025-04-21",12.37],["2025-04-22",13.6],["2025-04-23",21.54],["2025-04-24",24.09],["2025-04-25",34.51],["2025-04-28",32.14],["2025-04-29",32.74],["2025-04-30",32.37],["2025-05-01",41.26],["2025-05-02",38.29],["2025-05-05",53.06],["2025-05-06",54.66],["2025-05-07",54.14],["2025-05-08",57.66],["2025-05-09",60.03],["2025-05-12",64.49],["2025-05-13",68.2],["2025-05-14",70.4],["2025-05-15",69.14],["2025-05-16",70.6],["2025-05-19",69.74],["2025-05-20",69.17],["2025-05-21",66.23],["2025-05-22",66.8],["2025-05-23",64.09],["2025-05-27",65.74],["2025-05-28",64.74],["2025-05-29",64.46],["2025-05-30",61.91],["2025-06-02",62.43],["2025-06-03",54.57],["2025-06-04",54.89],["2025-06-05",57.97],["2025-06-06",61.77],["2025-06-09",63.43],["2025-06-10",64.0],["2025-06-11",64.2],["2025-06-12",64.6],["2025-06-13",59.54],["2025-06-16",61.11],["2025-06-17",57.43],["2025-06-18",54.29],["2025-06-20",54.51],["2025-06-23",56.6],["2025-06-24",57.89],["2025-06-25",59.26],["2025-06-26",63.0],["2025-06-27",64.8],["2025-06-30",69.23],["2025-07-01",67.54],["2025-07-02",63.71],["2025-07-03",77.63],["2025-07-07",75.09],["2025-07-08",74.63],["2025-07-09",75.91],["2025-07-10",76.97],["2025-07-11",75.26],["2025-07-14",76.11],["2025-07-15",73.49],["2025-07-16",72.94],["2025-07-17",74.17],["2025-07-18",73.94],["2025-07-21",73.29],["2025-07-22",73.89],["2025-07-23",76.37],["2025-07-24",75.26],["2025-07-25",74.66],["2025-07-28",73.8],["2025-07-29",70.63],["2025-07-30",68.03],["2025-07-31",63.71],["2025-08-01",49.8],["2025-08-04",56.89],["2025-08-05",55.03],["2025-08-06",55.31],["2025-08-07",54.71],["2025-08-08",58.37],["2025-08-11",57.63],["2025-08-12",62.26],["2025-08-13",63.34],["2025-08-14",63.26],["2025-08-15",63.54],["2025-08-18",64.2],["2025-08-19",59.89],["2025-08-20",55.91],["2025-08-21",52.6],["2025-08-22",55.54],["2025-08-25",53.94],["2025-08-26",55.4],["2025-08-27",59.11],["2025-08-28",64.43],["2025-08-29",61.54],["2025-09-02",62.46],["2025-09-03",61.37],["2025-09-04",61.17],["2025-09-05",58.69],["2025-09-08",58.23],["2025-09-09",57.94],["2025-09-10",57.94],["2025-09-11",60.34],["2025-09-12",61.34],["2025-09-15",64.46],["2025-09-16",64.37],["2025-09-17",63.77],["2025-09-18",66.54],["2025-09-19",66.23],["2025-09-22",66.51],["2025-09-23",56.77],["2025-09-24",54.57],["2025-09-25",50.66],["2025-09-26",51.29],["2025-09-29",50.97],["2025-09-30",51.4],["2025-10-01",52.49],["2025-10-02",54.54],["2025-10-03",52.57],["2025-10-06",53.97],["2025-10-07",51.86],["2025-10-08",52.94],["2025-10-09",48.63],["2025-10-10",30.14],["2025-10-13",29.74],["2025-10-14",28.29],["2025-10-15",27.41],["2025-10-16",23.11],["2025-10-17",22.33],["2025-10-20",29.86],["2025-10-21",28.54],["2025-10-22",26.37],["2025-10-23",27.57],["2025-10-24",32.46],["2025-10-27",37.34],["2025-10-28",39.34],["2025-10-29",42.11],["2025-10-30",37.06],["2025-10-31",34.46],["2025-11-03",32.6],["2025-11-04",20.94],["2025-11-05",23.06],["2025-11-06",24.34],["2025-11-07",20.43],["2025-11-10",29.94],["2025-11-11",30.46],["2025-11-12",34.57],["2025-11-13",24.54],["2025-11-14",22.06],["2025-11-17",11.64],["2025-11-18",8.9],["2025-11-19",7.86],["2025-11-20",5.17],["2025-11-21",5.66],["2025-11-24",13.69],["2025-11-25",15.03],["2025-11-26",17.66],["2025-11-28",21.77],["2025-12-01",22.09],["2025-12-02",23.26],["2025-12-03",24.77],["2025-12-04",36.03],["2025-12-05",38.14],["2025-12-08",40.77],["2025-12-09",40.94],["2025-12-10",36.37],["2025-12-11",43.74],["2025-12-12",39.29],["2025-12-15",49.31],["2025-12-16",46.4],["2025-12-17",37.69],["2025-12-18",42.37],["2025-12-19",44.2],["2025-12-22",54.89],["2025-12-23",58.57],["2025-12-24",58.0],["2025-12-26",54.86],["2025-12-29",47.89],["2025-12-30",46.11],["2025-12-31",43.26],["2026-01-02",45.23],["2026-01-05",47.6],["2026-01-06",52.86],["2026-01-07",48.57],["2026-01-08",48.37],["2026-01-09",54.11],["2026-01-12",58.0],["2026-01-13",59.09],["2026-01-14",58.63],["2026-01-15",63.66],["2026-01-16",63.77],["2026-01-20",50.86],["2026-01-21",53.86],["2026-01-22",54.77],["2026-01-23",54.89],["2026-01-26",57.66],["2026-01-27",64.97],["2026-01-28",65.54],["2026-01-29",63.83],["2026-01-30",58.6],["2026-02-02",63.4],["2026-02-03",43.34],["2026-02-04",47.23],["2026-02-05",34.94],["2026-02-06",45.37],["2026-02-09",48.49],["2026-02-10",47.23],["2026-02-11",49.91],["2026-02-12",36.36],["2026-02-13",33.84],["2026-02-17",33.31],["2026-02-18",34.16],["2026-02-19",34.4],["2026-02-20",42.34],["2026-02-23",32.54],["2026-02-24",40.26],["2026-02-25",43.14],["2026-02-26",42.91],["2026-02-27",41.17],["2026-03-02",34.29],["2026-03-03",31.63],["2026-03-04",33.07],["2026-03-05",31.63],["2026-03-06",25.26],["2026-03-09",22.23],["2026-03-10",20.27],["2026-03-11",18.31],["2026-03-13",16.67],["2026-03-16",23.91],["2026-03-17",22.89],["2026-03-18",13.61],["2026-03-19",18.31],["2026-03-20",8.4],["2026-03-23",11.63],["2026-03-24",10.36],["2026-03-25",16.54],["2026-03-26",10.26],["2026-03-27",8.17],["2026-03-30",5.77],["2026-03-31",14.89],["2026-04-01",15.86],["2026-04-02",18.29],["2026-04-06",21.86],["2026-04-07",21.57],["2026-04-08",29.17],["2026-04-09",33.8],["2026-04-10",38.06],["2026-04-13",40.97],["2026-04-14",47.26],["2026-04-15",56.2],["2026-04-16",61.49],["2026-04-17",68.57],["2026-04-20",69.97],["2026-04-21",67.57],["2026-04-22",68.46],["2026-04-23",66.17],["2026-04-24",65.4],["2026-04-27",66.29],["2026-04-28",67.43],["2026-04-29",66.23],["2026-04-30",69.51],["2026-05-01",71.17],["2026-05-04",66.89],["2026-05-05",67.26],["2026-05-06",68.74],["2026-05-07",67.29],["2026-05-08",67.29],["2026-05-11",66.63],["2026-05-12",65.69],["2026-05-13",64.97],["2026-05-14",65.91],["2026-05-15",63.23],["2026-05-18",62.09],["2026-05-19",59.26],["2026-05-20",60.51],["2026-05-21",57.51],["2026-05-22",58.23],["2026-05-26",59.83],["2026-05-27",60.63],["2026-05-28",60.71],["2026-05-29",60.46],["2026-06-01",59.46],["2026-06-02",56.97],["2026-06-03",54.63],["2026-06-04",54.57],["2026-06-05",41.86],["2026-06-08",39.37],["2026-06-09",33.77],["2026-06-10",27.29],["2026-06-11",29.69],["2026-06-12",33.51],["2026-06-15",40.14],["2026-06-16",39.51],["2026-06-17",32.94],["2026-06-18",37.34],["2026-06-22",33.94],["2026-06-23",28.46],["2026-06-24",26.46],["2026-06-25",25.43],["2026-06-26",24.66],["2026-06-29",26.86],["2026-06-30",29.97],["2026-07-01",31.63],["2026-07-02",32.54],["2026-07-06",41.66],["2026-07-07",39.77],["2026-07-08",38.63],["2026-07-09",44.71],["2026-07-10",46.83],["2026-07-13",40.86],["2026-07-14",41.06],["2026-07-15",44.43],["2026-07-16",41.86],["2026-07-17",37.0],["2026-07-20",36.0],["2026-07-21",42.77],["2026-07-22",44.43],["2026-07-23",40.86],["2026-07-24",40.77],["2026-07-27",38.23],["2026-07-28",37.14],["2026-07-29",25.56],["2026-07-30",38.11],["2026-07-31",39.57],["2026-08-03",46.14],["2026-08-04",58.97],["2026-08-05",60.23],["2026-08-06",59.69],["2026-08-07",65.14],["2026-08-10",64.37],["2026-08-11",60.09],["2026-08-12",61.69],["2026-08-13",66.11],["2026-08-14",64.31],["2026-08-17",59.14],["2026-08-18",54.63],["2026-08-19",56.63],["2026-08-20",51.37],["2026-08-21",54.66],["2026-08-24",54.97],["2026-08-25",59.6],["2026-08-26",53.94],["2026-08-27",57.31],["2026-08-28",53.74],["2026-08-31",49.2],["2026-09-01",44.86],["2026-09-02",46.06],["2026-09-03",47.51],["2026-09-04",45.23],["2026-09-08",39.14],["2026-09-09",38.2],["2026-09-10",32.2],["2026-09-11",32.69],["2026-09-14",31.0],["2026-09-15",27.97],["2026-09-16",27.31],["2026-09-17",28.29],["2026-09-18",29.11]];

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

/* ============ 추가매매법(떨어지면 매수·오르면 매도) — SOXL 6분할 티어 전략 ============
   [비공개] 실제 종목명(SOXL)과 티어 배분·매수/매도/손절 기준은 공개 화면에 노출하지 않는다.
   관리자 히든페이지에서만 정확한 수치를 확인할 수 있다. */
const ALT_PROFILES={
  defense:{ tiers:[5,10,15,20,25,25], buyPct:0.01, sellPct:0.01, stopDays:10, label:'수비' },
  neutral:{ tiers:[10,15,20,25,20,10], buyPct:0.01, sellPct:1.5, stopDays:10, label:'중립' },
  offense:{ tiers:[16.7,16.7,16.7,16.7,16.7,16.7], buyPct:0.1, sellPct:2, stopDays:12, label:'공격' }
};

async function runAltTradeBacktest(profile, baseCapital){
  const cfg=ALT_PROFILES[profile];
  if(!cfg) return {error:['알 수 없는 투자 성향']};
  const soxl=await yDailySeries('SOXL');
  if(!soxl) return {error:['기초자산 시세(Yahoo)']};
  const series=soxl.series.slice().sort((a,b)=>a.t-b.t);
  if(!series.length) return {error:['기초자산 시세(거래일 없음)']};

  /* 티어별로 배정된 자본금(고정) 안에서 반복 매수·매도한다. 매도로 남긴 손익은 그 티어의
     누적 실현손익(realizedPnL)으로 따로 쌓이고, 다음 매수는 항상 같은 배정 자본금을
     그대로 다시 쓴다(수익을 재투자해 포지션을 불리지 않는, 고정 배팅 방식). */
  const tiers=cfg.tiers.map(pct=>({
    pct, capital: baseCapital*pct/100,
    holding:false, shares:0, entryPrice:null, entryDay:null, refPrice:null,
    realizedPnL:0
  }));

  let buyCount=0, stopLossCount=0;
  const curve=[];
  const monthly={};
  const tradeLog=[]; // {t, tierPct, type:'buy'|'sell'|'stoploss', price, amount}
  let prevMonthKey=null, monthStartValue=baseCapital;
  let globalPeak=baseCapital;

  series.forEach((p,dayIdx)=>{
    const ts=p.t, price=p.close;
    const d=new Date(ts);
    const mk=d.getUTCFullYear()+'-'+String(d.getUTCMonth()+1).padStart(2,'0');
    if(mk!==prevMonthKey){
      monthly[mk]={buys:0, stopLosses:0, startValue:monthStartValue, endValue:0};
      prevMonthKey=mk;
    }

    tiers.forEach(t=>{
      if(t.refPrice==null) t.refPrice=price; // 첫날 기준가 설정

      if(!t.holding){
        if(price<=t.refPrice*(1-cfg.buyPct/100)){
          t.shares=t.capital/price;
          t.holding=true;
          t.entryPrice=price;
          t.entryDay=dayIdx;
          buyCount++; monthly[mk].buys++;
          tradeLog.push({t:ts, tierPct:t.pct, type:'buy', price, amount:t.capital});
        }
      }else{
        const daysHeld=dayIdx-t.entryDay;
        if(price>=t.entryPrice*(1+cfg.sellPct/100)){
          const proceeds=t.shares*price;
          const pnl=proceeds-t.capital;
          t.realizedPnL+=pnl;
          tradeLog.push({t:ts, tierPct:t.pct, type:'sell', price, amount:proceeds, entryT:series[t.entryDay].t, entryPrice:t.entryPrice, holdDays:daysHeld, pnl});
          t.holding=false; t.shares=0; t.refPrice=price;
        }else if(daysHeld>=cfg.stopDays){
          /* 손절: 그날 가격으로 매도해 손실 확정 후, 같은 날 즉시 같은 자본금으로 재매수한다
             ("손절일도 매수") — 현금이 하루도 비지 않도록 바로 다음 사이클을 시작한다. */
          const proceeds=t.shares*price;
          const pnl=proceeds-t.capital;
          t.realizedPnL+=pnl;
          stopLossCount++; monthly[mk].stopLosses++;
          tradeLog.push({t:ts, tierPct:t.pct, type:'stoploss', price, amount:proceeds, entryT:series[t.entryDay].t, entryPrice:t.entryPrice, holdDays:daysHeld, pnl});
          t.shares=t.capital/price;
          t.entryPrice=price; t.entryDay=dayIdx; t.refPrice=price;
          buyCount++; monthly[mk].buys++;
          tradeLog.push({t:ts, tierPct:t.pct, type:'buy', price, amount:t.capital});
        }
      }
    });

    let totalValue=0;
    tiers.forEach(t=>{ totalValue+=t.realizedPnL+(t.holding?t.shares*price:t.capital); });
    globalPeak=Math.max(globalPeak,totalValue);
    const dd=globalPeak>0?(globalPeak-totalValue)/globalPeak*100:0;
    curve.push({t:ts, value:totalValue, cost:baseCapital, dd});
    monthly[mk].endValue=totalValue;
    monthStartValue=totalValue;
  });

  const finalValue=curve.length?curve[curve.length-1].value:baseCapital;
  const totalRealizedPnL=tiers.reduce((s,t)=>s+t.realizedPnL,0);
  return {curve, monthly, buyCount, stopLossCount, baseCapital, finalValue, profile, tradeLog, totalRealizedPnL};
}

/* ============ 추가매매법(스나이퍼) — TQQQ·TECL·SOXL 3종목, 공포탐욕 점수 기반 ============
   [비공개] 실제 종목명과 매수·리밸런싱·매도 세부 기준은 공개 화면에 노출하지 않는다.
   관리자 히든페이지에서만 정확한 수치를 확인할 수 있다. */
const SNIPER_TICKERS=['TQQQ','TECL','SOXL'];
const SNIPER_REBAL_TARGET={TQQQ:0.30, TECL:0.35, SOXL:0.35};
async function runSniperTradeBacktest(){
  const [tqqq,tecl,soxl,fg]=await Promise.all([
    yDailySeries('TQQQ'), yDailySeries('TECL'), yDailySeries('SOXL'), fgDailyHistory()
  ]);
  const missing=[];
  if(!tqqq) missing.push('TQQQ 시세(Yahoo)');
  if(!tecl) missing.push('TECL 시세(Yahoo)');
  if(!soxl) missing.push('SOXL 시세(Yahoo)');
  if(!fg) missing.push('공포탐욕지수 히스토리(CNN)');
  if(missing.length) return {error:missing};

  const data={TQQQ:tqqq, TECL:tecl, SOXL:soxl};
  const tradingTs=tqqq.series.map(p=>p.t).slice().sort((a,b)=>a-b);
  if(!tradingTs.length) return {error:['TQQQ 시세(거래일 없음)']};

  const priceMap={};
  SNIPER_TICKERS.forEach(t=>{ priceMap[t]={}; data[t].series.forEach(p=>{ priceMap[t][p.t]=p.close; }); });

  function scoreAt(ts){
    let ans=fg.length?fg[0].score:50;
    for(let i=0;i<fg.length;i++){ if(fg[i].t<=ts) ans=fg[i].score; else break; }
    return ans;
  }

  /* 리밸런싱: 연말 마지막 거래일이 아니라 "그 다음 거래일"(새해 첫 거래일)에 실시한다 */
  const yearMaxTs={};
  tradingTs.forEach(ts=>{ const y=new Date(ts).getUTCFullYear(); if(!yearMaxTs[y]||ts>yearMaxTs[y]) yearMaxTs[y]=ts; });
  const datasetLastTs=tradingTs[tradingTs.length-1];
  const rebalanceDays=new Set();
  Object.values(yearMaxTs).forEach(ts=>{
    if(ts===datasetLastTs) return; // 아직 끝나지 않은 마지막 해는 제외
    const idx=tradingTs.indexOf(ts);
    if(idx>=0 && idx+1<tradingTs.length) rebalanceDays.add(tradingTs[idx+1]);
  });

  let shares={TQQQ:0,TECL:0,SOXL:0};
  let cumCost=0, buyCount=0;
  const monthly={};
  const curve=[];
  let prevMonthKey=null, monthStartValue=0, monthStartCost=0;
  let globalPeak=0;
  const tradeLog=[];
  const rebalanceLog=[];

  /* 자산별로 완전히 독립된 매도규칙 — 종목 하나가 200%/300%… 도달해도 다른 종목엔 영향 없음 */
  const sellState={}; SNIPER_TICKERS.forEach(t=>{ sellState[t]={cumCost:0, nextPct:200, realized:0}; });
  const sellEvents=[]; // {t, ticker, amount, type, pct}

  tradingTs.forEach(ts=>{
    const d=new Date(ts);
    const mk=d.getUTCFullYear()+'-'+String(d.getUTCMonth()+1).padStart(2,'0');
    if(mk!==prevMonthKey){
      monthly[mk]={buys:0, sold:0, startValue:monthStartValue, startCost:monthStartCost, endValue:0, endCost:0, peak:monthStartValue||0, mdd:0};
      prevMonthKey=mk;
    }

    const score=scoreAt(ts);
    let qty=0;
    if(score<=5) qty=30;
    else if(score<=10) qty=20;
    else if(score<=15) qty=10;

    if(qty>0){
      let bought=false;
      SNIPER_TICKERS.forEach(t=>{
        const px=priceMap[t][ts]; if(px==null) return;
        shares[t]+=qty; cumCost+=px*qty; sellState[t].cumCost+=px*qty; bought=true;
        tradeLog.push({t:ts, ticker:t, qty, price:px, amount:px*qty, score});
      });
      if(bought){ buyCount++; monthly[mk].buys++; }
    }

    let value=0;
    SNIPER_TICKERS.forEach(t=>{ const px=priceMap[t][ts]; if(px!=null) value+=shares[t]*px; });

    if(rebalanceDays.has(ts) && value>0){
      const beforeVals={}, priceAtRebal={};
      SNIPER_TICKERS.forEach(t=>{ const px=priceMap[t][ts]; beforeVals[t]=px!=null?shares[t]*px:0; priceAtRebal[t]=px; });
      SNIPER_TICKERS.forEach(t=>{
        const px=priceMap[t][ts]; if(px==null) return;
        shares[t]=(value*SNIPER_REBAL_TARGET[t])/px;
      });
      value=0;
      const afterVals={};
      SNIPER_TICKERS.forEach(t=>{ const px=priceMap[t][ts]; if(px!=null){ value+=shares[t]*px; afterVals[t]=shares[t]*px; } });
      rebalanceLog.push({t:ts, before:beforeVals, after:afterVals, priceAtRebal});
    }

    /* 자산별 독립 매도: 종목별 수익률 200% 최초 도달 시 그 종목 투자원금만큼 매도,
       이후 100%p 구간마다 그 종목 잔고의 25%씩 매도 */
    SNIPER_TICKERS.forEach(t=>{
      const px=priceMap[t][ts]; if(px==null) return;
      const tVal=shares[t]*px;
      const st=sellState[t];
      if(st.cumCost>0 && tVal>0){
        const pft=(tVal/st.cumCost-1)*100;
        if(pft>=st.nextPct){
          const isFirst=(st.nextPct===200);
          const sellRatio=isFirst?Math.min(1, st.cumCost/tVal):0.25;
          const sellAmt=tVal*sellRatio;
          shares[t]*=(1-sellRatio);
          st.cumCost*=(1-sellRatio);
          st.realized+=sellAmt;
          sellEvents.push({t:ts, ticker:t, amount:sellAmt, type:isFirst?'principal':'partial', pct:st.nextPct});
          monthly[mk].sold+=sellAmt;
          st.nextPct+=100;
        }
      }
    });

    value=0;
    SNIPER_TICKERS.forEach(t=>{ const px=priceMap[t][ts]; if(px!=null) value+=shares[t]*px; });

    const totalRealized=SNIPER_TICKERS.reduce((s,t)=>s+sellState[t].realized,0);
    const displayCost=cumCost-totalRealized;
    globalPeak=Math.max(globalPeak,value);
    const dd=globalPeak>0?(globalPeak-value)/globalPeak*100:0;

    curve.push({t:ts, cost:displayCost, value, dd});
    const mObj=monthly[mk];
    mObj.endValue=value; mObj.endCost=displayCost;
    mObj.peak=Math.max(mObj.peak,value);
    if(mObj.peak>0){ const mdd_=(mObj.peak-value)/mObj.peak; if(mdd_>mObj.mdd) mObj.mdd=mdd_; }
    monthStartValue=value; monthStartCost=displayCost;
  });

  const totalRealizedFinal=SNIPER_TICKERS.reduce((s,t)=>s+sellState[t].realized,0);
  const finalValue=curve.length?curve[curve.length-1].value:0;
  const finalCost=cumCost-totalRealizedFinal;

  return {curve, monthly, buyCount, finalCost, finalValue, tradeLog, rebalanceLog, sellEvents, totalRealized:totalRealizedFinal};
}

async function runTradeBacktest(opts){
  opts = opts || {};
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
  /* [벤치마크 매도 동기화] 전략이 기본 매도규칙으로 특정 금액을 현금화하면, "같은 돈을
     QQQ/QLD/TQQQ에 그대로 넣어뒀다면?" 비교도 공정하려면 그 시점에 벤치마크에서도 동일한
     달러 금액만큼 매도해야 한다. */
  function sellFromBenchmarks(dollarAmount, ts){
    const qqqPx=qqqPriceMap[ts], qldPx=priceMap.QLD[ts], tqqqPx=tqqqPriceMap[ts];
    if(qqqPx && bmQqqShares>0) bmQqqShares=Math.max(0, bmQqqShares-dollarAmount/qqqPx);
    if(qldPx && bmQldShares>0) bmQldShares=Math.max(0, bmQldShares-dollarAmount/qldPx);
    if(tqqqPx && bmTqqqShares>0) bmTqqqShares=Math.max(0, bmTqqqShares-dollarAmount/tqqqPx);
  }
  let bmQqqDiv=0, bmQldDiv=0, bmTqqqDiv=0;
  let globalPeak=0; /* 낙폭(underwater) 그래프용 — 리셋되지 않는 전체 기간 누적 최고점(배당 포함 총수익 기준) */
  let bmQldPeak=0, bmTqqqPeak=0, bmQqqPeak=0; /* QQQ·QLD·TQQQ 단독매수 벤치마크의 낙폭 계산용 최고점 */

  /* 기본 매매법에 내장된 매도 규칙(항상 작동): 정규 매수분 기준 수익률이 200%에 처음
     도달하면 투자원금만큼 매도하고, 이후 수익률 100%p 구간마다(300%,400%…) 잔고의 25%를
     추가로 매도한다. 매도분만큼 원가도 비례 차감. */
  let mainSellCumCost=0, mainSellNextPct=200, mainSellRealized=0;
  const mainSellEvents=[]; // {t, amount, type:'principal'|'partial', pct}

  /* [관리자 전용 상세 기록] 종목별 실제 매수 로그 — 화면에는 공개하지 않고 관리자 히든페이지에서만 사용 */
  const tradeLog=[]; // {t, ticker, qty, price, amount, score}
  const rebalanceLog=[]; // {t, before:{QLD,USD,SCHD}, after:{QLD,USD,SCHD}} — 관리자 히든페이지용

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
    /* 극심한 공포 구간: 지수가 낮아질수록 매일 매수량이 배로 늘어난다(5→32, 10→16, 15→8, 20→4).
       20~25 구간(과거 "극도공포 4주" 규칙)은 매일이 아니라 금요일에만 4주 매수. */
    if(score<=5) qty=32;
    else if(score<=10) qty=16;
    else if(score<=15) qty=8;
    else if(score<=20) qty=4;
    else if(score<25 && fridayBuyDays.has(ts)) qty=4;
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
        shares[t]+=qty; cumCost+=px*qty; mainSellCumCost+=px*qty; dailySpend+=px*qty; bought=true;
        tradeLog.push({t:ts, ticker:t, qty, price:px, amount:px*qty, score});
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

    /* 연말 리밸런싱: 보유 3종목 시가(배당 제외)를 QLD 40% · USD 40% · SCHD 20% 로 재배분 */
    if(rebalanceDays.has(ts) && value>0){
      const beforeVals={}, priceAtRebal={};
      TRADE_TICKERS.forEach(t=>{ const px=priceMap[t][ts]; beforeVals[t]=px!=null?shares[t]*px:0; priceAtRebal[t]=px; });
      TRADE_TICKERS.forEach(t=>{
        const px=priceMap[t][ts]; if(px==null) return;
        shares[t]=(value*REBAL_TARGET[t])/px;
      });
      value=0;
      const afterVals={};
      TRADE_TICKERS.forEach(t=>{ const px=priceMap[t][ts]; if(px!=null){ value+=shares[t]*px; afterVals[t]=shares[t]*px; } });
      rebalanceLog.push({t:ts, before:beforeVals, after:afterVals, priceAtRebal});
    }

    /* 기본 매매법 내장 매도 규칙: 수익률 200% 최초 도달 시 투자원금만큼 매도, 이후 100%p
       구간마다 잔고 25% 매도 */
    if(mainSellCumCost>0 && value>0){
      const pft=(value/mainSellCumCost-1)*100;
      if(pft>=mainSellNextPct){
        const isFirst=(mainSellNextPct===200);
        const sellRatio=isFirst?Math.min(1, mainSellCumCost/value):0.25;
        const sellAmt=value*sellRatio;
        TRADE_TICKERS.forEach(t=>{ shares[t]*=(1-sellRatio); });
        value-=sellAmt;
        mainSellCumCost*=(1-sellRatio);
        mainSellRealized+=sellAmt;
        mainSellEvents.push({t:ts, amount:sellAmt, type:isFirst?'principal':'partial', pct:mainSellNextPct});
        monthly[mk].mainSold=(monthly[mk].mainSold||0)+sellAmt;
        mainSellNextPct+=100;
        sellFromBenchmarks(sellAmt, ts); // 벤치마크도 동일 금액만큼 매도(공정 비교)
      }
    }

    const displayCost=cumCost-mainSellRealized; // 매도규칙으로 실현된 금액은 더 이상 투입원금으로 잡지 않는다
    /* 매도규칙으로 실현된 현금은 "인출해서 쓴 현금"으로 간주해 평가금에 더 이상 포함시키지
       않는다. 그래서 매도가 발생하는 순간 평가금 곡선이 실제로 팔린 금액만큼 한 단계
       내려가고, 그 뒤로는 남은(줄어든) 포지션만으로 계속 성장한다. */
    const totalValue=value+cumDividend; // 평가금(배당 포함, 실현된 현금은 제외)
    const qqqPxNow=qqqPriceMap[ts], qldPxNow=priceMap.QLD[ts], tqqqPxNow=tqqqPriceMap[ts];
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

    curve.push({
      t:ts, cost:displayCost, value:totalValue, dd, cumDividend, posValue:value,
      bmQqq: qqqPxNow!=null?(bmQqqShares*qqqPxNow+bmQqqDiv):null,
      bmQld: bmQldValue, bmTqqq: bmTqqqValue,
      bmQqqDivC: bmQqqDiv, bmQldDivC: bmQldDiv, bmTqqqDivC: bmTqqqDiv,
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
    if(!yearly[y]) yearly[y]={startValue:monthly[mk].startValue, startCost:monthly[mk].startCost, endValue:0, endCost:0, dividends:0, buys:0, mainSold:0};
    yearly[y].endValue=monthly[mk].endValue;
    yearly[y].endCost=monthly[mk].endCost;
    yearly[y].dividends+=monthly[mk].dividends;
    yearly[y].buys+=monthly[mk].buys;
    yearly[y].mainSold+=(monthly[mk].mainSold||0);
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

  const finalPrices={}; TRADE_TICKERS.forEach(t=>{ finalPrices[t]=priceMap[t][lastTs]; });

  return {
    curve, monthly, yearly, buyCount, cumDividend,
    finalCost:cumCost-mainSellRealized, finalValue:curve.length?curve[curve.length-1].value:0,
    finalPosValue:curve.length?curve[curve.length-1].posValue:0,
    nextDiv, didRebalance:rebalanceDays.size>0,
    annualDividendEst,
    tradeLog, rebalanceLog, finalPrices,
    mainSellRealized, mainSellEvents
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

/* 원금 100% 회수 이후 구간만 따로 떼어 "그 시점부터 0에서 다시 시작"한 것처럼 리베이스해
   보여준다 — 평가금 증감(전략 vs QQQ/QLD/TQQQ), 낙폭(그 시점부터 새로 계산), 누적 배당금.
   회수가 없으면 섹션 자체를 숨긴다. */
/* 작은 라인차트 하나를 그리는 범용 헬퍼 — 회수 전/후, 스나이퍼 차수별 비교 패널에서 재사용한다 */
function miniLineChart(seriesArr, opts){
  opts=opts||{};
  const w=opts.w||340, h=opts.h||180, padL=opts.padL!=null?opts.padL:40, padR=opts.padR!=null?opts.padR:8,
        padTop=opts.padTop!=null?opts.padTop:8, padBottom=opts.padBottom!=null?opts.padBottom:8, zeroLine=!!opts.zeroLine;
  const allVals=[];
  seriesArr.forEach(s=>s.values.forEach(v=>{ if(v!=null) allVals.push(v); }));
  if(zeroLine) allVals.push(0);
  if(!allVals.length) allVals.push(0,1);
  const min=Math.min(...allVals), max=Math.max(...allVals,min+1);
  const n=Math.max.apply(null,seriesArr.map(s=>s.values.length).concat([2]));
  const stepX=n>1?(w-padL-padR)/(n-1):0;
  const yOf=v=>h-padBottom-((v-min)/((max-min)||1))*(h-padTop-padBottom);
  const pathOf=arr=>{
    const pts=arr.map((v,i)=>v!=null?[padL+i*stepX,yOf(v)]:null).filter(Boolean);
    return pts.map((p,i)=>(i===0?'M':'L')+p[0].toFixed(1)+','+p[1].toFixed(1)).join(' ');
  };
  let svg='<svg viewBox="0 0 '+w+' '+h+'" style="width:100%;height:'+h+'px;display:block">';
  if(zeroLine) svg+='<line x1="'+padL+'" y1="'+yOf(0).toFixed(1)+'" x2="'+(w-padR)+'" y2="'+yOf(0).toFixed(1)+'" stroke="var(--line)" stroke-width="1" stroke-dasharray="2 3"/>';
  seriesArr.forEach(s=>{
    if(s.area){
      const pts=s.values.map((v,i)=>v!=null?[padL+i*stepX,yOf(v)]:null).filter(Boolean);
      if(pts.length){
        const areaPath=pathOf(s.values)+' L'+pts[pts.length-1][0].toFixed(1)+','+yOf(0).toFixed(1)+' L'+pts[0][0].toFixed(1)+','+yOf(0).toFixed(1)+' Z';
        svg+='<path d="'+areaPath+'" fill="'+s.area+'" stroke="none"/>';
      }
    }
    svg+='<path d="'+pathOf(s.values)+'" fill="none" stroke="'+s.color+'" stroke-width="'+(s.width||2)+'"'+(s.dashed?' stroke-dasharray="5 3"':'')+(s.opacity?' opacity="'+s.opacity+'"':'')+'/>';
  });
  svg+='</svg>';
  const legend=seriesArr.filter(s=>s.label).map(s=>
    '<span style="white-space:nowrap;font-size:11px;color:var(--tx2)"><span style="color:'+s.color+'">'+(s.dashed?'┄':'■')+'</span> '+s.label+'</span>'
  ).join('');
  return svg+(legend?'<div style="display:flex;flex-wrap:wrap;gap:6px 12px;margin-top:4px">'+legend+'</div>':'');
}

/* 원금 100% 회수 전/후, 그리고 듀얼스나이퍼 차수별 매도 전/후를 각각 절반씩 나란히 비교한다 */
function renderBacktest(res){
  const statusEl=document.getElementById('bt-status');
  if(!res || res.error || !res.curve || !res.curve.length){
    const reason=(res&&res.error)?res.error.join(', ')+' 연동 실패':'알 수 없는 오류';
    if(statusEl) statusEl.textContent='⚠ '+reason+' — PROXY_BASE에 설정한 Worker 주소가 살아있는지, 코드가 정확히 배포됐는지 확인해주세요.';
    return;
  }
  if(statusEl) statusEl.textContent=BACKTEST_START_DATE+' ~ '+new Date(res.curve[res.curve.length-1].t).toLocaleDateString('ko-KR')+' 실제 시세 기준 계산 결과입니다.';

  const rebalNoteEl=document.getElementById('bt-rebal-note');
  if(rebalNoteEl) rebalNoteEl.textContent=res.didRebalance
    ? '📌 투자기간 1년 초과 시 리밸런싱이 반영되었습니다.'
    : '';

  function fmtUSDKRW(usd){
    if(!krwDisplayOn) return fmtUSD(usd); // 토글이 꺼져 있으면 달러만(stock.html·crypto.html과 동일 구조)
    const krw=fmtKRW(usd);
    return krw ? fmtUSD(usd)+' ('+krw+')' : fmtUSD(usd);
  }

  const bc=document.getElementById('bt-buycount'); if(bc) bc.textContent=res.buyCount+'회';
  const totalValueEl=document.getElementById('bt-total-value');
  if(totalValueEl){
    totalValueEl.textContent=(res.finalPosValue!=null && isFinite(res.finalPosValue))?fmtUSDKRW(res.finalPosValue):'계산 실패';
  }
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

  /* 기본 매매법에 내장된 매도규칙(항상 작동) — 실현된 금액이 있으면 카드로 보여준다 */
  const mainCardEl2=document.getElementById('bt-realized-main-card');
  const hasMainRealized=res.mainSellEvents && res.mainSellEvents.length>0;
  const firstTs0=res.curve[0].t;
  const dayCount0=(a,b)=>Math.round((b-a)/86400000);
  if(mainCardEl2){
    if(hasMainRealized){
      mainCardEl2.style.display='';
      const mainEl2=document.getElementById('bt-realized-main');
      const mainDetailEl=document.getElementById('bt-realized-main-detail');
      if(mainEl2) mainEl2.textContent=fmtUSDKRW(res.mainSellRealized);
      if(mainDetailEl){
        mainDetailEl.innerHTML=res.mainSellEvents.map((s,i)=>
          '<b>'+(i+1)+'차('+(s.type==='principal'?'원금':s.pct+'%')+')</b> '+fmtUSDKRW(s.amount)+'<br><span style="font-size:11px">'+new Date(s.t).toLocaleDateString('ko-KR')+' (D+'+dayCount0(firstTs0,s.t).toLocaleString('ko-KR')+'일)</span>'
        ).join('<div style="margin:6px 0;border-top:1px dashed var(--line)"></div>');
      }
    }else{
      mainCardEl2.style.display='none';
    }
  }

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
  /* 평가금 곡선 패널 하나를 그린다 — 회수 전/후 두 패널이 완전히 동일한 축척(scaleMin~scaleMax)과
     동일한 벤치마크 정의를 쓰도록 공유해서, 나란히 놓았을 때 크기 비교가 왜곡되지 않게 한다. */
  /* 수익률·낙폭·배당 곡선 공통 — 연도가 바뀌는 지점마다 세로 구분선과 연도 라벨을 그린다 */
  function yearDividerLines(seg, padL, stepX, yTop, yBottom, labelY){
    let html='';
    let prevYear=null;
    seg.forEach((p,i)=>{
      const y=new Date(p.t).getUTCFullYear();
      if(prevYear!==null && y!==prevYear){
        const x=(padL+i*stepX).toFixed(1);
        html+='<line x1="'+x+'" y1="'+yTop+'" x2="'+x+'" y2="'+yBottom+'" stroke="var(--line)" stroke-width="1" stroke-dasharray="3 3" opacity="0.55"/>';
        if(labelY!=null) html+='<text x="'+(+x+3)+'" y="'+labelY+'" font-size="8.5" fill="var(--tx2)" text-anchor="start">'+y+'</text>';
      }
      prevYear=y;
    });
    return html;
  }

  function buildEquityPanel(seg, scaleMin, scaleMax, w, h, events){
    const padL=48,padR=14,padTop=10,padBottom=30;
    const n=seg.length;
    const stepX=n>1?(w-padL-padR)/(n-1):0;
    const yOf=v=>h-padBottom-((v-scaleMin)/((scaleMax-scaleMin)||1))*(h-padTop-padBottom);
    const ptsCost=seg.map((p,i)=>[padL+i*stepX,yOf(p.cost)]);
    const ptsVal=seg.map((p,i)=>[padL+i*stepX,yOf(p.value)]);
    const ptsQqq=seg.map((p,i)=>p.bmQqq!=null?[padL+i*stepX,yOf(p.bmQqq)]:null).filter(Boolean);
    const ptsQld=seg.map((p,i)=>p.bmQld!=null?[padL+i*stepX,yOf(p.bmQld)]:null).filter(Boolean);
    const ptsTqqq=seg.map((p,i)=>p.bmTqqq!=null?[padL+i*stepX,yOf(p.bmTqqq)]:null).filter(Boolean);
    const pathOf=pts=>pts.map((p,i)=>(i===0?'M':'L')+p[0].toFixed(1)+','+p[1].toFixed(1)).join(' ');
    const profit=seg[seg.length-1].value>=seg[seg.length-1].cost;
    const areaPath=ptsVal.length?pathOf(ptsVal)+' L'+ptsVal[ptsVal.length-1][0].toFixed(1)+','+(h-padBottom)+' L'+ptsVal[0][0].toFixed(1)+','+(h-padBottom)+' Z':'';
    let yAxis='';
    for(let ti=0;ti<=3;ti++){
      const val=scaleMin+(scaleMax-scaleMin)*(ti/3);
      const y=yOf(val);
      yAxis+='<line x1="'+padL+'" y1="'+y.toFixed(1)+'" x2="'+(w-padR)+'" y2="'+y.toFixed(1)+'" stroke="var(--line)" stroke-width="1" stroke-dasharray="2 3" opacity="0.4"/>';
      yAxis+='<text x="'+(padL-6)+'" y="'+(y+3).toFixed(1)+'" font-size="9" fill="var(--tx2)" text-anchor="end">'+fmtUSD(val)+'</text>';
    }
    let markers=yearDividerLines(seg, padL, stepX, padTop, h-padBottom, h-padBottom+11);

    return '<svg viewBox="0 0 '+w+' '+h+'" style="width:100%;height:'+h+'px;display:block">'+
      yAxis+markers+
      '<path d="'+areaPath+'" fill="'+(profit?'rgba(200,32,20,.12)':'rgba(26,111,168,.12)')+'" stroke="none"/>'+
      (ptsQqq.length?'<path d="'+pathOf(ptsQqq)+'" fill="none" stroke="#2dd4bf" stroke-width="1.4" stroke-dasharray="6 3"/>':'')+
      (ptsQld.length?'<path d="'+pathOf(ptsQld)+'" fill="none" stroke="#c084fc" stroke-width="1.4" stroke-dasharray="6 3"/>':'')+
      (ptsTqqq.length?'<path d="'+pathOf(ptsTqqq)+'" fill="none" stroke="#facc15" stroke-width="1.4" stroke-dasharray="6 3"/>':'')+
      '<path d="'+pathOf(ptsCost)+'" fill="none" stroke="var(--tx2)" stroke-width="1.3" stroke-dasharray="4 3"/>'+
      '<path d="'+pathOf(ptsVal)+'" fill="none" stroke="'+(profit?'var(--up)':'var(--down)')+'" stroke-width="2"/>'+
      '</svg>';
  }

  const curveEl=document.getElementById('bt-curve');
  const splitNoteEl=document.getElementById('bt-curve-split-note');
  if(curveEl){
    const bmQqqVals=res.curve.map(p=>p.bmQqq).filter(v=>v!=null);
    const bmQldVals=res.curve.map(p=>p.bmQld).filter(v=>v!=null);
    const bmTqqqVals=res.curve.map(p=>p.bmTqqq).filter(v=>v!=null);
    const all=res.curve.map(p=>p.cost).concat(res.curve.map(p=>p.value)).concat(bmQqqVals).concat(bmQldVals).concat(bmTqqqVals);
    const scaleMin=Math.min(...all,0), scaleMax=Math.max(...all,1);

    /* 기간 중 최고 수익률(원금 대비 평가금, 배당 포함) 시점 탐색 */
    let maxRoi=-Infinity, maxRoiTs=null;
    res.curve.forEach(p=>{
      if(p.cost>0){
        const r=(p.value/p.cost-1)*100;
        if(r>maxRoi){ maxRoi=r; maxRoiTs=p.t; }
      }
    });
    if(maxRoi===-Infinity) maxRoi=0;

    const legendHtml='<div style="display:flex;flex-direction:column;gap:5px;margin-top:8px;font-size:12px;color:var(--tx2);min-width:0">'+
      '<span style="white-space:nowrap"><span style="color:var(--up)">■</span> 평가금(배당포함)</span>'+
      '<span style="white-space:nowrap"><span style="color:var(--tx2)">┄</span> 누적 원금</span>'+
      '<span style="white-space:nowrap"><span style="color:#2dd4bf">┄</span> 동일 금액 QQQ(배당포함)</span>'+
      '<span style="white-space:nowrap"><span style="color:#c084fc">┄</span> 동일 금액 QLD(배당포함)</span>'+
      '<span style="white-space:nowrap"><span style="color:#facc15">┄</span> 동일 금액 TQQQ(배당포함)</span>'+
      '</div>';
    const roiSummary='<div class="mut" style="margin-top:8px;font-size:12.5px">기간 중 최고 수익률: <b style="color:var(--up)">+'+maxRoi.toFixed(1)+'%</b>'+(maxRoiTs?' ('+new Date(maxRoiTs).toLocaleDateString('ko-KR')+')':'')+'</div>';

    if(splitNoteEl) splitNoteEl.textContent='';
    curveEl.innerHTML=buildEquityPanel(res.curve,scaleMin,scaleMax,700,240,{})+roiSummary+legendHtml;
  }

  /* 낙폭(underwater) 그래프 — 전체 기간 누적 최고점 대비 낙폭(%)을 아래로 그린다 */
  function buildDrawdownPanel(seg, maxDD, w, h, rebase){
    const padL=48,padR=14,padTop=10;
    const n=seg.length;
    const stepX=n>1?(w-padL-padR)/(n-1):0;
    const yOf=v=>padTop+(v/maxDD)*(h-padTop-14);
    /* [회수 후 기준점 변경] rebase가 true면 그 구간 시작 시점을 새 최고점(0%)으로 놓고
       낙폭을 처음부터 다시 계산한다 — "0부터 시작"하는 것처럼 보이게 하기 위함이다. */
    const ddVals=rebase?(()=>{ let peak=0; return seg.map(p=>{ peak=Math.max(peak,p.value); return peak>0?(peak-p.value)/peak*100:0; }); })()
                        :seg.map(p=>p.dd||0);
    const pts=ddVals.map((v,i)=>[padL+i*stepX,yOf(v)]);
    const ptsQldDD=seg.map((p,i)=>p.bmQldDD!=null?[padL+i*stepX,yOf(p.bmQldDD)]:null).filter(Boolean);
    const ptsTqqqDD=seg.map((p,i)=>p.bmTqqqDD!=null?[padL+i*stepX,yOf(p.bmTqqqDD)]:null).filter(Boolean);
    const ptsQqqDD=seg.map((p,i)=>p.bmQqqDD!=null?[padL+i*stepX,yOf(p.bmQqqDD)]:null).filter(Boolean);
    const pathOf=pts=>pts.map((p,i)=>(i===0?'M':'L')+p[0].toFixed(1)+','+p[1].toFixed(1)).join(' ');
    const areaPath=pts.length?pathOf(pts)+' L'+pts[pts.length-1][0].toFixed(1)+','+padTop+' L'+pts[0][0].toFixed(1)+','+padTop+' Z':'';
    let yAxis='';
    for(let ti=0;ti<=3;ti++){
      const val=maxDD*ti/3;
      const y=yOf(val);
      yAxis+='<line x1="'+padL+'" y1="'+y.toFixed(1)+'" x2="'+(w-padR)+'" y2="'+y.toFixed(1)+'" stroke="var(--line)" stroke-width="1" stroke-dasharray="2 3" opacity="0.4"/>';
      yAxis+='<text x="'+(padL-6)+'" y="'+(y+3).toFixed(1)+'" font-size="9" fill="var(--tx2)" text-anchor="end">-'+val.toFixed(1)+'%</text>';
    }
    return '<svg viewBox="0 0 '+w+' '+h+'" style="width:100%;height:'+h+'px;display:block">'+
      yAxis+yearDividerLines(seg, padL, stepX, padTop, h-14, h-4)+
      '<path d="'+areaPath+'" fill="rgba(200,32,20,.18)" stroke="none"/>'+
      '<path d="'+pathOf(pts)+'" fill="none" stroke="var(--up)" stroke-width="1.6"/>'+
      (ptsQldDD.length?'<path d="'+pathOf(ptsQldDD)+'" fill="none" stroke="#c084fc" stroke-width="1.3" stroke-dasharray="5 3"/>':'')+
      (ptsTqqqDD.length?'<path d="'+pathOf(ptsTqqqDD)+'" fill="none" stroke="#facc15" stroke-width="1.3" stroke-dasharray="5 3"/>':'')+
      (ptsQqqDD.length?'<path d="'+pathOf(ptsQqqDD)+'" fill="none" stroke="#2dd4bf" stroke-width="1.3" stroke-dasharray="5 3"/>':'')+
      '</svg>';
  }

  const ddEl=document.getElementById('bt-drawdown');
  if(ddEl){
    const qldDDVals=res.curve.map(p=>p.bmQldDD).filter(v=>v!=null);
    const tqqqDDVals=res.curve.map(p=>p.bmTqqqDD).filter(v=>v!=null);
    const qqqDDVals=res.curve.map(p=>p.bmQqqDD).filter(v=>v!=null);
    const maxDD=Math.max(...res.curve.map(p=>p.dd||0), ...qldDDVals, ...tqqqDDVals, ...qqqDDVals, 1);
    const worstDD=maxDD.toFixed(1);
    const worstQldDD=qldDDVals.length?Math.max(...qldDDVals).toFixed(1):null;
    const worstTqqqDD=tqqqDDVals.length?Math.max(...tqqqDDVals).toFixed(1):null;
    const worstQqqDD=qqqDDVals.length?Math.max(...qqqDDVals).toFixed(1):null;
    const summary='<div class="mut" style="margin-top:4px;font-size:12px">전략 최대 -'+worstDD+'%'+
      (worstQqqDD!=null?' · QQQ 단독매수 최대 -'+worstQqqDD+'%':'')+
      (worstQldDD!=null?' · QLD 단독매수 최대 -'+worstQldDD+'%':'')+
      (worstTqqqDD!=null?' · TQQQ 단독매수 최대 -'+worstTqqqDD+'%':'')+'</div>';
    const ddLegend='<div style="display:flex;flex-direction:column;gap:5px;margin-top:6px;font-size:12px;color:var(--tx2)">'+
      '<span style="white-space:nowrap"><span style="color:var(--up)">■</span> 전략(배당 포함 평가금 기준)</span>'+
      '<span style="white-space:nowrap"><span style="color:#2dd4bf">┄</span> QQQ 단독매수</span>'+
      '<span style="white-space:nowrap"><span style="color:#c084fc">┄</span> QLD 단독매수</span>'+
      '<span style="white-space:nowrap"><span style="color:#facc15">┄</span> TQQQ 단독매수</span>'+
      '</div>';
    ddEl.innerHTML=buildDrawdownPanel(res.curve,maxDD,700,110,false)+summary+ddLegend;
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

  /* ---- 배당금 곡선(누적) — 기본전략 vs QQQ/QLD/TQQQ, 원금회수 시 전/후 동일 축척으로 분할 ---- */
  function buildDividendPanel(seg, scaleMax, w, h){
    const padL=48,padR=14,padTop=10,padBottom=26;
    const n=seg.length;
    const stepX=n>1?(w-padL-padR)/(n-1):0;
    const yOf=v=>h-padBottom-((v)/(scaleMax||1))*(h-padTop-padBottom);
    const pathOf=(arr)=>{
      const pts=arr.map((v,i)=>v!=null?[padL+i*stepX,yOf(v)]:null).filter(Boolean);
      return pts.map((p,i)=>(i===0?'M':'L')+p[0].toFixed(1)+','+p[1].toFixed(1)).join(' ');
    };
    let yAxis='';
    for(let ti=0;ti<=3;ti++){
      const val=scaleMax*ti/3;
      const y=yOf(val);
      yAxis+='<line x1="'+padL+'" y1="'+y.toFixed(1)+'" x2="'+(w-padR)+'" y2="'+y.toFixed(1)+'" stroke="var(--line)" stroke-width="1" stroke-dasharray="2 3" opacity="0.4"/>';
      yAxis+='<text x="'+(padL-6)+'" y="'+(y+3).toFixed(1)+'" font-size="9" fill="var(--tx2)" text-anchor="end">'+fmtUSD(val)+'</text>';
    }
    const div=seg.map(p=>p.cumDividend);
    const qqqDiv=seg.map(p=>p.bmQqqDivC!=null?p.bmQqqDivC:null);
    const qldDiv=seg.map(p=>p.bmQldDivC!=null?p.bmQldDivC:null);
    const tqqqDiv=seg.map(p=>p.bmTqqqDivC!=null?p.bmTqqqDivC:null);
    return '<svg viewBox="0 0 '+w+' '+h+'" style="width:100%;height:'+h+'px;display:block">'+
      yAxis+yearDividerLines(seg, padL, stepX, padTop, h-padBottom, h-padBottom+11)+
      (qqqDiv.some(v=>v!=null)?'<path d="'+pathOf(qqqDiv)+'" fill="none" stroke="#2dd4bf" stroke-width="1.4" stroke-dasharray="6 3"/>':'')+
      (qldDiv.some(v=>v!=null)?'<path d="'+pathOf(qldDiv)+'" fill="none" stroke="#c084fc" stroke-width="1.4" stroke-dasharray="6 3"/>':'')+
      (tqqqDiv.some(v=>v!=null)?'<path d="'+pathOf(tqqqDiv)+'" fill="none" stroke="#facc15" stroke-width="1.4" stroke-dasharray="6 3"/>':'')+
      '<path d="'+pathOf(div)+'" fill="none" stroke="var(--up)" stroke-width="2"/>'+
      '</svg>';
  }
  const divCurveEl=document.getElementById('bt-dividend-curve');
  if(divCurveEl){
    const allDivVals=res.curve.map(p=>p.cumDividend)
      .concat(res.curve.map(p=>p.bmQqqDivC).filter(v=>v!=null))
      .concat(res.curve.map(p=>p.bmQldDivC).filter(v=>v!=null))
      .concat(res.curve.map(p=>p.bmTqqqDivC).filter(v=>v!=null));
    const divScaleMax=Math.max(...allDivVals,1);
    const divLegend='<div style="display:flex;flex-direction:column;gap:5px;margin-top:6px;font-size:12px;color:var(--tx2)">'+
      '<span style="white-space:nowrap"><span style="color:var(--up)">■</span> 기본 전략 배당</span>'+
      '<span style="white-space:nowrap"><span style="color:#2dd4bf">┄</span> 동일 금액 QQQ 배당</span>'+
      '<span style="white-space:nowrap"><span style="color:#c084fc">┄</span> 동일 금액 QLD 배당</span>'+
      '<span style="white-space:nowrap"><span style="color:#facc15">┄</span> 동일 금액 TQQQ 배당</span>'+
      '</div>';
    divCurveEl.innerHTML=buildDividendPanel(res.curve,divScaleMax,700,200)+divLegend;
  }


  /* 연도별 수익률 */
  const yearlyEl=document.getElementById('bt-yearly-return');
  if(yearlyEl){
    const years=Object.keys(res.yearly||{}).sort();
    const yretList=years.map(y=>{
      const yr=res.yearly[y];
      const contrib=yr.endCost-yr.startCost; // [버그 수정] 위 월별 표와 동일한 이유로 recovered 보정을 제거
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
      const rowBg='background:'+(yret>=0?'rgba(200,32,20,':'rgba(26,111,168,')+Math.min(Math.abs(yret)/40,1)*0.22+')';
      const badge=isBest?' <span class="tag" style="background:rgba(0,117,74,.18);color:var(--accent)">최고</span>':isWorst?' <span class="tag" style="background:rgba(26,111,168,.15);color:var(--down)">최저</span>':'';
      return '<tr style="'+rowBg+'"><td>'+y+badge+(yr.mainSold?' <span class="mut" style="font-size:11px">💰 매도 발생</span>':'')+'</td>'+
        '<td class="num">'+fmtUSDKRW(contrib)+'</td>'+
        '<td class="num">'+fmtUSDKRW(yr.endCost)+'</td>'+
        '<td class="num">'+yr.buys+'회</td>'+
        '<td class="num">'+fmtUSDKRW(yr.dividends)+'</td>'+
        '<td class="num '+(yret>=0?'up':'down')+'">'+(yret>=0?'+':'')+yret.toFixed(1)+'%</td></tr>';
    }).join('');
  }

  /* 월별 매매기록: 투입원금·누적원금·매수횟수·MDD·월 평가금·월 수익금·월 수익률 순 */
  const months=Object.keys(res.monthly).sort();
  const trEl=document.getElementById('bt-monthly-return');
  if(trEl){
    trEl.innerHTML=months.map(mk=>{
      const m=res.monthly[mk];
      /* [버그 수정] 이 파일의 현재 설계는 회수·매도로 실현된 현금을 평가금(totalValue)에서
         아예 제외한다(더 이상 "인출해서 쓴 현금"으로 취급). 그 결과 회수/매도 이벤트 자체는
         원가와 평가금을 정확히 같은 금액만큼 같이 줄이므로, 보정 없이 단순 델타만 써도
         수익 계산이 이미 맞다 — 예전에는 평가금에 회수액을 포함시켰던 구조라 보정이
         필요했지만, 지금 구조에서 그 보정(+recovered)을 그대로 두면 회수·매도 자체가
         가짜 손실처럼 잡히는 반대 방향 버그가 생긴다(실제 계산으로 확인). */
      const contrib=m.endCost-m.startCost;
      const denom=m.startValue+contrib;
      const profitYen=m.endValue-m.startValue-contrib;
      const mret=denom>0?profitYen/denom:0;
      const mddPct=(m.mdd||0)*100;
      const rowStyle=m.mainSold?' style="background:rgba(0,117,74,.14)"':'';
      const evTag=m.mainSold?' <span class="mut" style="font-size:11px">💰 매도 발생</span>':'';
      return '<tr'+rowStyle+'><td>'+mk+evTag+'</td>'+
        '<td class="num">'+fmtUSDKRW(contrib)+'</td>'+
        '<td class="num">'+fmtUSDKRW(m.endCost)+'</td>'+
        '<td class="num">'+m.buys+'회</td>'+
        '<td class="num down">-'+mddPct.toFixed(1)+'%</td>'+
        '<td class="num">'+fmtUSDKRW(m.endValue)+'</td>'+
        '<td class="num '+(profitYen>=0?'up':'down')+'">'+(profitYen>=0?'+':'-')+fmtUSDKRW(Math.abs(profitYen))+'</td>'+
        '<td class="num '+(mret>=0?'up':'down')+'">'+(mret*100>=0?'+':'')+(mret*100).toFixed(2)+'%</td></tr>';
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

  renderAdminTables(res);
}

/* 관리자 히든페이지 — 종목별 세부 매매기록·듀얼스나이퍼 매매기록. 패스워드로 화면 표시 여부만
   가릴 뿐 실제 인증은 아니며(정적 사이트라 서버 검증 불가), 백테스트가 다시 돌 때마다
   패널이 열려 있든 아니든 항상 최신 데이터로 갱신해둔다. */
/* 공포탐욕 점수를 사람이 읽을 수 있는 상태로 표시(매수 조건의 실제 임계값과 동일한 구간) */
function fgScoreState(score){
  if(score==null) return '';
  if(score<25) return '극단적 공포';
  if(score<45) return '공포';
  if(score<=55) return '중립';
  return '탐욕';
}

/* 추가매매법(떨사오팔) 결과 렌더링 — 현재매매법과 같은 카드·차트 구조를 재사용한다 */
function renderAltBacktest(res){
  const statusEl=document.getElementById('bt2-status');
  if(!res || res.error || !res.curve || !res.curve.length){
    const reason=(res&&res.error)?res.error.join(', ')+' 연동 실패':'알 수 없는 오류';
    if(statusEl) statusEl.textContent='⚠ '+reason;
    const monthlyEl0=document.getElementById('bt2-monthly');
    if(monthlyEl0) monthlyEl0.innerHTML='<tr><td class="mut" colspan="5">⚠ 데이터를 불러오지 못해 계산할 수 없습니다('+reason+')</td></tr>';
    return;
  }
  if(statusEl) statusEl.textContent=BACKTEST_START_DATE+' ~ '+new Date(res.curve[res.curve.length-1].t).toLocaleDateString('ko-KR')+' 실제 시세 기준 계산 결과입니다.';

  function fmtUSDKRW2(usd){
    if(!krwDisplayOn) return fmtUSD(usd);
    const krw=fmtKRW(usd);
    return krw?fmtUSD(usd)+' ('+krw+')':fmtUSD(usd);
  }
  const capEl=document.getElementById('bt2-capital'); if(capEl) capEl.textContent=fmtUSDKRW2(res.baseCapital);
  const bcEl=document.getElementById('bt2-buycount'); if(bcEl) bcEl.textContent=res.buyCount+'회';
  const slEl=document.getElementById('bt2-stoploss'); if(slEl) slEl.textContent=res.stopLossCount+'회';
  const valEl=document.getElementById('bt2-value'); if(valEl) valEl.textContent=fmtUSDKRW2(res.finalValue);

  const profitAmt=res.finalValue-res.baseCapital;
  const profitEl=document.getElementById('bt2-profit');
  if(profitEl){
    profitEl.textContent=(profitAmt>=0?'+':'-')+fmtUSDKRW2(Math.abs(profitAmt));
    profitEl.className='big '+(profitAmt>=0?'up':'down');
  }
  /* [재검토 반영] "수익률"은 기본투자금 대비 총 평가금(미실현 포함) 기준이 아니라, 사용자가
     명시한 대로 "기본투자금 대비 수익실현금"으로 계산한다 — 실현수익률 카드와 같은 정의를
     쓰되, 여기서는 메인 지표로 강조해서 보여준다. */
  const roi=res.baseCapital>0?(res.totalRealizedPnL||0)/res.baseCapital*100:0;
  const roiEl=document.getElementById('bt2-roi');
  if(roiEl){
    roiEl.textContent=(roi>=0?'+':'')+roi.toFixed(1)+'%';
    roiEl.className='big '+(roi>=0?'up':'down');
  }

  /* 수익실현금 — 2배김군과 동일한 방식으로 매도(수익실현) 이벤트를 차수별로 나열한다.
     손절매도는 손실 확정이라 "수익 실현"이 아니므로 이 목록에서는 제외한다. */
  const realizedCardEl2=document.getElementById('bt2-realized-card');
  const sellOnly=(res.tradeLog||[]).filter(r=>r.type==='sell');
  if(realizedCardEl2){
    if(sellOnly.length){
      realizedCardEl2.style.display='';
      const realizedEl2=document.getElementById('bt2-realized');
      const detailEl2=document.getElementById('bt2-realized-detail');
      const totalSellAmt=sellOnly.reduce((s,r)=>s+r.amount,0);
      if(realizedEl2) realizedEl2.textContent=fmtUSDKRW2(totalSellAmt);
      if(detailEl2){
        const shown=sellOnly.slice(-20); // 너무 길어지지 않게 최근 20건만(전체는 관리자 페이지에서)
        detailEl2.innerHTML=(sellOnly.length>20?'최근 20건만 표시(전체 '+sellOnly.length+'건) · ':'')+
          shown.map((r,i)=>(sellOnly.length-shown.length+i+1)+'차: '+new Date(r.t).toLocaleDateString('ko-KR')+' · '+fmtUSDKRW2(r.amount)).join('<br>');
      }
    }else{
      realizedCardEl2.style.display='none';
    }
  }
  /* 실현수익률 — 확정된(매도·손절 포함) 손익만 기본투자금 대비 비율로 표시. 아직 보유 중인
     포지션의 평가손익은 포함하지 않는다(그건 "수익률" 카드가 이미 다룬다). */
  const realizedRoiEl=document.getElementById('bt2-realized-roi');
  if(realizedRoiEl){
    const rr=res.baseCapital>0?(res.totalRealizedPnL||0)/res.baseCapital*100:0;
    realizedRoiEl.textContent=(rr>=0?'+':'')+rr.toFixed(1)+'%';
    realizedRoiEl.className='big '+(rr>=0?'up':'down');
  }

  /* 월별 매매기록 — 혹시 모를 예외로 조용히 실패해 "계산 중…"에 멈춰 있는 것처럼 보이는
     일이 없도록 try/catch로 감싸고, 실패 시 원인을 화면에 바로 보여준다 */
  const monthlyEl=document.getElementById('bt2-monthly');
  if(monthlyEl){
    try{
      const months=Object.keys(res.monthly).sort();
      if(!months.length){
        monthlyEl.innerHTML='<tr><td class="mut" colspan="5">월별 데이터가 없습니다.</td></tr>';
      }else{
        monthlyEl.innerHTML=months.map(mk=>{
          const m=res.monthly[mk];
          const profitYen=m.endValue-m.startValue;
          const mret=m.startValue>0?profitYen/m.startValue*100:0;
          const rowStyle=m.stopLosses>0?' style="background:rgba(26,111,168,.12)"':'';
          return '<tr'+rowStyle+'><td>'+mk+(m.stopLosses>0?' <span class="mut" style="font-size:11px">🔵 손절 발생</span>':'')+'</td>'+
            '<td class="num">'+m.buys+'회</td>'+
            '<td class="num">'+m.stopLosses+'회</td>'+
            '<td class="num '+(profitYen>=0?'up':'down')+'">'+(profitYen>=0?'+':'-')+fmtUSDKRW2(Math.abs(profitYen))+'</td>'+
            '<td class="num '+(mret>=0?'up':'down')+'">'+(mret>=0?'+':'')+mret.toFixed(2)+'%</td></tr>';
        }).join('');
      }
    }catch(e){
      console.error('떨사오팔 월별 매매기록 렌더링 실패:', e);
      monthlyEl.innerHTML='<tr><td class="mut" colspan="5">⚠ 표시 중 오류가 발생했습니다: '+e.message+'</td></tr>';
    }
  }
}

/* 추가매매법(스나이퍼) 결과 렌더링 — 떨사오팔과 같은 카드·차트 구조를 재사용한다 */
function renderSniperBacktest(res){
  const statusEl=document.getElementById('bt3-status');
  if(!res || res.error || !res.curve || !res.curve.length){
    const reason=(res&&res.error)?res.error.join(', ')+' 연동 실패':'알 수 없는 오류';
    if(statusEl) statusEl.textContent='⚠ '+reason;
    return;
  }
  if(statusEl) statusEl.textContent=BACKTEST_START_DATE+' ~ '+new Date(res.curve[res.curve.length-1].t).toLocaleDateString('ko-KR')+' 실제 시세 기준 계산 결과입니다.';

  function fmtUSDKRW3(usd){
    if(!krwDisplayOn) return fmtUSD(usd);
    const krw=fmtKRW(usd);
    return krw?fmtUSD(usd)+' ('+krw+')':fmtUSD(usd);
  }
  const costEl=document.getElementById('bt3-cost'); if(costEl) costEl.textContent=fmtUSDKRW3(res.finalCost);
  const bcEl=document.getElementById('bt3-buycount'); if(bcEl) bcEl.textContent=res.buyCount+'회';
  const realizedEl=document.getElementById('bt3-realized'); if(realizedEl) realizedEl.textContent=res.totalRealized>0?fmtUSDKRW3(res.totalRealized):'--';
  const valEl=document.getElementById('bt3-value'); if(valEl) valEl.textContent=fmtUSDKRW3(res.finalValue);

  const profitAmt=res.finalValue-res.finalCost;
  const profitEl=document.getElementById('bt3-profit');
  if(profitEl){
    profitEl.textContent=(profitAmt>=0?'+':'-')+fmtUSDKRW3(Math.abs(profitAmt));
    profitEl.className='big '+(profitAmt>=0?'up':'down');
  }
  const roi=res.finalCost>0?(res.finalValue/res.finalCost-1)*100:0;
  const roiEl=document.getElementById('bt3-roi');
  if(roiEl){
    roiEl.textContent=(roi>=0?'+':'')+roi.toFixed(1)+'%';
    roiEl.className='big '+(roi>=0?'up':'down');
  }

  /* 수익률 곡선 */
  const curveEl=document.getElementById('bt3-curve');
  if(curveEl){
    const w=700,h=240,padL=56,padR=20,padTop=10,padBottom=30;
    const n=res.curve.length;
    const stepX=n>1?(w-padL-padR)/(n-1):0;
    const allVals=res.curve.map(p=>p.value).concat(res.curve.map(p=>p.cost));
    const scaleMin=Math.min(...allVals,0), scaleMax=Math.max(...allVals,1);
    const yOf=v=>h-padBottom-((v-scaleMin)/((scaleMax-scaleMin)||1))*(h-padTop-padBottom);
    const ptsVal=res.curve.map((p,i)=>[padL+i*stepX,yOf(p.value)]);
    const ptsCost=res.curve.map((p,i)=>[padL+i*stepX,yOf(p.cost)]);
    const pathOf=pts=>pts.map((p,i)=>(i===0?'M':'L')+p[0].toFixed(1)+','+p[1].toFixed(1)).join(' ');
    const profit=res.finalValue>=res.finalCost;
    const areaPath=ptsVal.length?pathOf(ptsVal)+' L'+ptsVal[ptsVal.length-1][0].toFixed(1)+','+(h-padBottom)+' L'+ptsVal[0][0].toFixed(1)+','+(h-padBottom)+' Z':'';
    let yAxis='';
    for(let ti=0;ti<=3;ti++){
      const val=scaleMin+(scaleMax-scaleMin)*(ti/3);
      const y=yOf(val);
      yAxis+='<line x1="'+padL+'" y1="'+y.toFixed(1)+'" x2="'+(w-padR)+'" y2="'+y.toFixed(1)+'" stroke="var(--line)" stroke-width="1" stroke-dasharray="2 3" opacity="0.4"/>';
      yAxis+='<text x="'+(padL-6)+'" y="'+(y+3).toFixed(1)+'" font-size="9" fill="var(--tx2)" text-anchor="end">'+fmtUSD(val)+'</text>';
    }
    const yearLines=yearDividerLines(res.curve, padL, stepX, padTop, h-padBottom, h-padBottom+11);
    curveEl.innerHTML='<svg viewBox="0 0 '+w+' '+h+'" style="width:100%;height:'+h+'px;display:block">'+
      yAxis+yearLines+
      '<path d="'+areaPath+'" fill="'+(profit?'rgba(167,139,250,.15)':'rgba(26,111,168,.12)')+'" stroke="none"/>'+
      '<path d="'+pathOf(ptsCost)+'" fill="none" stroke="var(--tx2)" stroke-width="1.3" stroke-dasharray="4 3"/>'+
      '<path d="'+pathOf(ptsVal)+'" fill="none" stroke="'+(profit?'#a78bfa':'var(--down)')+'" stroke-width="2"/>'+
      '</svg>'+
      '<div style="display:flex;flex-wrap:wrap;gap:10px 18px;margin-top:8px;font-size:12px;color:var(--tx2)">'+
      '<span><span style="color:'+(profit?'#a78bfa':'var(--down)')+'">■</span> 평가금</span>'+
      '<span><span style="color:var(--tx2)">┄</span> 누적 원금</span>'+
      '</div>';
  }

  /* 낙폭(고점 대비 하락폭) */
  const ddEl=document.getElementById('bt3-drawdown');
  if(ddEl){
    const w=700,h=110,padL=56,padR=20,padTop=10;
    const n=res.curve.length;
    const stepX=n>1?(w-padL-padR)/(n-1):0;
    const maxDD=Math.max(...res.curve.map(p=>p.dd||0),1);
    const yOf=v=>padTop+(v/maxDD)*(h-padTop-14);
    const pts=res.curve.map((p,i)=>[padL+i*stepX,yOf(p.dd||0)]);
    const pathOf=pts=>pts.map((p,i)=>(i===0?'M':'L')+p[0].toFixed(1)+','+p[1].toFixed(1)).join(' ');
    const areaPath=pts.length?pathOf(pts)+' L'+pts[pts.length-1][0].toFixed(1)+','+padTop+' L'+pts[0][0].toFixed(1)+','+padTop+' Z':'';
    let yAxis='';
    for(let ti=0;ti<=3;ti++){
      const val=maxDD*ti/3;
      const y=yOf(val);
      yAxis+='<line x1="'+padL+'" y1="'+y.toFixed(1)+'" x2="'+(w-padR)+'" y2="'+y.toFixed(1)+'" stroke="var(--line)" stroke-width="1" stroke-dasharray="2 3" opacity="0.4"/>';
      yAxis+='<text x="'+(padL-6)+'" y="'+(y+3).toFixed(1)+'" font-size="9" fill="var(--tx2)" text-anchor="end">-'+val.toFixed(1)+'%</text>';
    }
    const yearLines=yearDividerLines(res.curve, padL, stepX, padTop, h-14, h-4);
    ddEl.innerHTML='<svg viewBox="0 0 '+w+' '+h+'" style="width:100%;height:'+h+'px;display:block">'+
      yAxis+yearLines+
      '<path d="'+areaPath+'" fill="rgba(200,32,20,.18)" stroke="none"/>'+
      '<path d="'+pathOf(pts)+'" fill="none" stroke="var(--up)" stroke-width="1.6"/>'+
      '</svg>'+
      '<div class="mut" style="margin-top:4px;font-size:12px">최대 낙폭 -'+maxDD.toFixed(1)+'%</div>';
  }

  /* 월별 매매기록 */
  const monthlyEl=document.getElementById('bt3-monthly');
  if(monthlyEl){
    const months=Object.keys(res.monthly).sort();
    monthlyEl.innerHTML=months.map(mk=>{
      const m=res.monthly[mk];
      const contrib=m.endCost-m.startCost;
      const profitYen=m.endValue-m.startValue-contrib;
      const denom=m.startValue+contrib;
      const mret=denom>0?profitYen/denom*100:0;
      const rowStyle=m.sold>0?' style="background:rgba(167,139,250,.14)"':'';
      return '<tr'+rowStyle+'><td>'+mk+(m.sold>0?' <span class="mut" style="font-size:11px">💰 매도 발생</span>':'')+'</td>'+
        '<td class="num">'+fmtUSDKRW3(contrib)+'</td>'+
        '<td class="num">'+m.buys+'회</td>'+
        '<td class="num '+(profitYen>=0?'up':'down')+'">'+(profitYen>=0?'+':'-')+fmtUSDKRW3(Math.abs(profitYen))+'</td>'+
        '<td class="num '+(mret>=0?'up':'down')+'">'+(mret>=0?'+':'')+mret.toFixed(2)+'%</td></tr>';
    }).join('');
  }
}

/* 추가매매법(스나이퍼)의 자산별 매수·매도 기록 — 관리자 페이지 전용 */
function renderSniperAdminLog(res){
  const tbl=document.getElementById('bt-admin-tradelog');
  if(!tbl) return;
  const table=tbl.closest('table');
  const thead=table?table.querySelector('thead'):null;
  if(thead) thead.innerHTML='<tr><th>날짜</th><th>종목</th><th>구분</th><th class="num">가격</th><th class="num">금액</th><th class="num">공포탐욕</th></tr>';
  const buyRows=(res.tradeLog||[]).map(r=>({...r, kind:'buy'}));
  const sellRows=(res.sellEvents||[]).map(r=>({t:r.t, ticker:r.ticker, price:null, amount:r.amount, kind:r.type==='principal'?'principal':'partial'}));
  const rows=buyRows.concat(sellRows).sort((a,b)=>a.t-b.t).slice(-500);
  const typeLabel={buy:'매수', principal:'매도(원금)', partial:'매도(잔고25%)'};
  tbl.innerHTML=rows.length?rows.map(r=>{
    const cls=r.kind==='buy'?'':'up';
    return '<tr><td>'+new Date(r.t).toLocaleDateString('ko-KR')+'</td><td>'+r.ticker+'</td>'+
      '<td class="'+cls+'">'+(typeLabel[r.kind]||r.kind)+'</td>'+
      '<td class="num">'+(r.price!=null?fmtUSD(r.price):'<span class="mut">--</span>')+'</td>'+
      '<td class="num">'+fmtUSD(r.amount)+'</td>'+
      '<td class="num">'+(r.score!=null?r.score.toFixed(1):'<span class="mut">--</span>')+'</td></tr>';
  }).join(''):'<tr><td class="mut" colspan="6">데이터 없음</td></tr>';
}

function renderAdminTables(res){
  const tlBody=document.getElementById('bt-admin-tradelog');
  if(tlBody){
    const rows=(res.tradeLog||[]).slice(-500); // 너무 길어지지 않게 최근 500건만
    const cumQty={}, cumAmt={};
    tlBody.innerHTML=rows.length?rows.map(r=>{
      cumQty[r.ticker]=(cumQty[r.ticker]||0)+r.qty;
      cumAmt[r.ticker]=(cumAmt[r.ticker]||0)+r.amount;
      const state=fgScoreState(r.score);
      return '<tr><td>'+new Date(r.t).toLocaleDateString('ko-KR')+'</td><td>'+r.ticker+'</td>'+
      '<td class="num">'+r.qty+'</td><td class="num">'+cumQty[r.ticker].toLocaleString('ko-KR')+'</td>'+
      '<td class="num">'+fmtUSD(r.price)+'</td><td class="num">'+fmtUSD(r.amount)+'</td>'+
      '<td class="num">'+fmtUSD(cumAmt[r.ticker])+'</td>'+
      '<td class="num">'+(r.score!=null?r.score.toFixed(1):'--')+(state?' <span class="mut" style="font-size:11px">('+state+')</span>':'')+'</td></tr>';
    }).join(''):'<tr><td class="mut" colspan="8">데이터 없음</td></tr>';
  }
  const msBody=document.getElementById('bt-admin-mainsell');
  if(msBody){
    const rows=res.mainSellEvents||[];
    let cumMs=0;
    msBody.innerHTML=rows.length?rows.map(r=>{
      cumMs+=r.amount;
      return '<tr><td>'+new Date(r.t).toLocaleDateString('ko-KR')+'</td>'+
        '<td>'+(r.type==='principal'?'원금 매도':'잔고 25% 매도')+'</td>'+
        '<td class="num">'+fmtUSD(r.amount)+'</td>'+
        '<td class="num">'+fmtUSD(cumMs)+'</td>'+
        '<td class="num">'+r.pct+'%</td></tr>';
    }).join(''):'<tr><td class="mut" colspan="5">아직 매도 조건이 발동하지 않았습니다.</td></tr>';
  }
  const rbBody=document.getElementById('bt-admin-rebalance');
  if(rbBody){
    const rows=res.rebalanceLog||[];
    const lines=[];
    rows.forEach(r=>{
      TRADE_TICKERS.forEach(t=>{
        const before=r.before[t]||0, after=r.after[t]||0;
        const dir=after>before?'매수(비중 확대)':after<before?'매도(비중 축소)':'변동 없음';
        const cls=after>before?'up':after<before?'down':'';
        /* 평가: 그 리밸런싱 시점 가격 대비 현재(마지막 데이터일) 가격이 얼마나 움직였는지 —
           "비중을 늘린 쪽이 그 뒤 올랐으면 유리했다"는 식의 참고용 판단 재료(정밀한 손익 계산은 아님) */
        const pxThen=r.priceAtRebal?r.priceAtRebal[t]:null;
        const pxNow=res.finalPrices?res.finalPrices[t]:null;
        let evalTxt='<span class="mut">--</span>';
        if(pxThen!=null && pxNow!=null && pxThen>0){
          const chg=(pxNow/pxThen-1)*100;
          const goodCall=(after>before && chg>=0)||(after<before && chg<0);
          evalTxt='<span class="'+(chg>=0?'up':'down')+'">'+(chg>=0?'+':'')+chg.toFixed(1)+'%</span> <span class="mut" style="font-size:11px">('+(goodCall?'결과적으로 유리':'결과적으로 불리')+')</span>';
        }
        lines.push('<tr><td>'+new Date(r.t).toLocaleDateString('ko-KR')+'</td><td>'+t+'</td>'+
          '<td class="num">'+fmtUSD(before)+'</td><td class="num">'+fmtUSD(after)+'</td>'+
          '<td class="'+cls+'">'+dir+'</td><td>'+evalTxt+'</td></tr>');
      });
    });
    rbBody.innerHTML=lines.length?lines.join(''):'<tr><td class="mut" colspan="6">아직 리밸런싱이 발생하지 않았습니다(투자기간 1년 초과 시에만 발생).</td></tr>';
  }
}

/* 관리자 페이지 버튼 — 비밀번호(coolzet***) 확인 후에만 히든 섹션을 보여준다.
   클라이언트 사이드 체크일 뿐이라 실제 보안 기능은 아니며, 화면 노출만 막는 용도다.
   현재매매법·추가매매법 화면 양쪽에 각자 버튼이 있지만 같은 패널을 공유한다. */
const ADMIN_PASSWORD='coolzet***';
function initTradeAdminPanel(){
  const panel=document.getElementById('bt-admin-panel');
  if(!panel) return;
  const btnIds=['bt-admin-btn','bt-admin-btn-2','bt-admin-btn-3'];
  const allBtns=btnIds.map(id=>document.getElementById(id)).filter(Boolean);
  btnIds.forEach(btnId=>{
    const btn=document.getElementById(btnId);
    if(!btn) return;
    btn.addEventListener('click',()=>{
      if(panel.style.display!=='none'){
        panel.style.display='none';
        allBtns.forEach(b=>b.textContent='관리자 페이지');
        return;
      }
      const pw=prompt('관리자 비밀번호를 입력하세요');
      if(pw===null) return;
      if(pw===ADMIN_PASSWORD){
        panel.style.display='';
        allBtns.forEach(b=>b.textContent='관리자 페이지 닫기');
        if(btnId==='bt-admin-btn-2'){
          if(lastAltBacktestResult) renderAltAdminLog(lastAltBacktestResult);
        }else if(btnId==='bt-admin-btn-3'){
          if(lastSniperBacktestResult) renderSniperAdminLog(lastSniperBacktestResult);
        }else if(lastBacktestResult){
          renderAdminTables(lastBacktestResult);
        }
        panel.scrollIntoView({behavior:'smooth', block:'start'});
      }else{
        alert('비밀번호가 올바르지 않습니다.');
      }
    });
  });
}

/* 추가매매법(떨사오팔)의 티어별 매수·매도·손절 기록 — 기존 종목별 매매기록 표를 그대로
   재사용하되, 열 구성이 다르므로(종목 대신 티어%, 매수/매도/손절 구분 등) 헤더와 본문을
   이 전용 함수에서 새로 그린다. */
function renderAltAdminLog(res){
  const tbl=document.getElementById('bt-admin-tradelog');
  if(!tbl) return;
  const table=tbl.closest('table');
  const thead=table?table.querySelector('thead'):null;
  if(thead) thead.innerHTML='<tr><th>날짜</th><th>티어</th><th>구분</th><th class="num">가격</th><th class="num">금액</th></tr>';
  const rows=(res.tradeLog||[]).slice(-500);
  const typeLabel={buy:'매수', sell:'매도', stoploss:'손절매도'};
  tbl.innerHTML=rows.length?rows.map(r=>{
    const cls=r.type==='buy'?'':(r.type==='stoploss'?'down':'up');
    return '<tr><td>'+new Date(r.t).toLocaleDateString('ko-KR')+'</td><td>'+r.tierPct+'%</td>'+
      '<td class="'+cls+'">'+(typeLabel[r.type]||r.type)+'</td>'+
      '<td class="num">'+fmtUSD(r.price)+'</td>'+
      '<td class="num">'+fmtUSD(r.amount)+'</td></tr>';
  }).join(''):'<tr><td class="mut" colspan="5">데이터 없음</td></tr>';
}

let lastBacktestResult=null;
async function loadTradeBacktest(){
  const statusEl=document.getElementById('bt-status');
  if(statusEl) statusEl.textContent=BACKTEST_START_DATE+'부터 데이터를 불러와 다시 계산하는 중…';
  const [res]=await Promise.all([runTradeBacktest(), loadFxRate()]);
  lastBacktestResult=res;
  renderBacktest(res);
}

let lastAltBacktestResult=null;
let altProfile='defense', altCapital=10000;
async function loadAltTradeBacktest(){
  const statusEl=document.getElementById('bt2-status');
  if(statusEl) statusEl.textContent=BACKTEST_START_DATE+'부터 데이터를 불러와 다시 계산하는 중…';
  const [res]=await Promise.all([runAltTradeBacktest(altProfile, altCapital), loadFxRate()]);
  lastAltBacktestResult=res;
  renderAltBacktest(res);
}

let lastSniperBacktestResult=null;
async function loadSniperTradeBacktest(){
  const statusEl=document.getElementById('bt3-status');
  if(statusEl) statusEl.textContent=BACKTEST_START_DATE+'부터 데이터를 불러와 다시 계산하는 중…';
  const [res]=await Promise.all([runSniperTradeBacktest(), loadFxRate()]);
  lastSniperBacktestResult=res;
  renderSniperBacktest(res);
}

/* 매매법 선택 탭(2배김군/떨사오팔/스나이퍼) — 화면 전환만 하고, 각 매매법을 처음 열 때만
   데이터를 불러온다(불필요한 재계산 방지). 탭마다 고유 색상(주황/파랑/보라)을 배경에도
   반영해 지금 어떤 매매법을 보고 있는지 한눈에 구분되게 한다. */
let altLoaded=false, sniperLoaded=false;
const METHOD_COLORS={1:'var(--accent)', 2:'#3d9dff', 3:'#a78bfa'};
function initTradeMethodTabs(){
  const tabs=document.getElementById('bt-method-tabs');
  const wraps={1:document.getElementById('bt-method1-wrap'), 2:document.getElementById('bt-method2-wrap'), 3:document.getElementById('bt-method3-wrap')};
  if(!tabs || !wraps[1] || !wraps[2] || !wraps[3]) return;
  tabs.addEventListener('click', e=>{
    const b=e.target.closest('button'); if(!b) return;
    tabs.querySelectorAll('button').forEach(x=>{ x.classList.remove('on'); x.style.background=''; x.style.color=''; });
    b.classList.add('on');
    b.style.background=METHOD_COLORS[b.dataset.method];
    b.style.color='#ffffff';
    const m=b.dataset.method;
    Object.keys(wraps).forEach(k=>{ wraps[k].style.display=(k===m)?'':'none'; });
    if(m==='2' && !altLoaded){ altLoaded=true; loadAltTradeBacktest(); }
    if(m==='3' && !sniperLoaded){ sniperLoaded=true; loadSniperTradeBacktest(); }
  });
  // 초기 활성 탭 배경도 맞춰준다
  const onBtn=tabs.querySelector('button.on');
  if(onBtn){ onBtn.style.background=METHOD_COLORS[onBtn.dataset.method]; onBtn.style.color='#ffffff'; }
}

/* 추가매매법 전용 컨트롤 — 기본투자금 선택, 투자 성향(수비/중립/공격) 탭, 연도 탭 */
function initAltTradeControls(){
  const capSel=document.getElementById('bt2-capital-select');
  if(capSel){
    capSel.addEventListener('change', ()=>{
      altCapital=+capSel.value;
      loadAltTradeBacktest();
    });
  }
  const profTabs=document.getElementById('bt2-profile-tabs');
  if(profTabs){
    profTabs.addEventListener('click', e=>{
      const b=e.target.closest('button'); if(!b) return;
      profTabs.querySelectorAll('button').forEach(x=>x.classList.remove('on'));
      b.classList.add('on');
      altProfile=b.dataset.profile;
      loadAltTradeBacktest();
    });
  }

  /* 수익실현금 카드 클릭 → 티어·진입일·실현일·보유기간·손익 세부내역 모달 */
  const realizedCard=document.getElementById('bt2-realized-card');
  const modal=document.getElementById('bt2-realized-modal');
  const modalClose=document.getElementById('bt2-realized-modal-close');
  if(realizedCard && modal){
    realizedCard.addEventListener('click', ()=>{
      const body=document.getElementById('bt2-realized-modal-body');
      if(body){
        const events=(lastAltBacktestResult&&lastAltBacktestResult.tradeLog||[]).filter(r=>r.type==='sell'||r.type==='stoploss').sort((a,b)=>a.t-b.t);
        body.innerHTML=events.length?events.map(r=>{
          const holdTxt=r.holdDays!=null?r.holdDays+'일':'<span class="mut">--</span>';
          const pnlCls=r.pnl!=null?(r.pnl>=0?'up':'down'):'';
          const pnlTxt=r.pnl!=null?(r.pnl>=0?'+':'-')+fmtUSD(Math.abs(r.pnl)):'<span class="mut">--</span>';
          return '<tr><td>'+r.tierPct+'%'+(r.type==='stoploss'?' <span class="mut" style="font-size:10.5px">(손절)</span>':'')+'</td>'+
            '<td>'+(r.entryT!=null?new Date(r.entryT).toLocaleDateString('ko-KR'):'<span class="mut">--</span>')+'</td>'+
            '<td>'+new Date(r.t).toLocaleDateString('ko-KR')+'</td>'+
            '<td class="num">'+holdTxt+'</td>'+
            '<td class="num '+pnlCls+'">'+pnlTxt+'</td></tr>';
        }).join(''):'<tr><td class="mut" colspan="5">아직 실현된 거래가 없습니다.</td></tr>';
      }
      modal.style.display='flex';
    });
  }
  if(modalClose && modal){
    modalClose.addEventListener('click', ()=>{ modal.style.display='none'; });
  }
  if(modal){
    modal.addEventListener('click', e=>{ if(e.target===modal) modal.style.display='none'; });
  }
}

/* 추가매매법(스나이퍼) 전용 컨트롤 — 자체 옵션 없음(날짜 입력은 initBacktestDateInputs가 공통 처리) */
function initSniperTradeControls(){
}

/* stock.html·crypto.html의 "원화 표시" 토글과 동일 구조 — krwDisplayOn 플래그만 켜고
   이미 계산해둔 결과(lastBacktestResult)를 다시 그린다(재계산 없이 즉시 반영) */
function initTradeKrwToggle(sel){
  const toggle=document.querySelector(sel);
  if(!toggle) return;
  toggle.addEventListener('change',()=>{
    krwDisplayOn=toggle.checked;
    /* [버그 수정] 여기서 2배김군(method 1)만 다시 그리고 있어서, 떨사오팔·스나이퍼 화면을
       보고 있을 때 원화 표시를 켜도 반영되지 않고 있었다. 세 매매법 모두 이미 계산된 결과가
       있으면(altLoaded/sniperLoaded) 그 결과를 그대로 다시 그린다(재계산 없이 즉시 반영). */
    if(lastBacktestResult) renderBacktest(lastBacktestResult);
    if(altLoaded && lastAltBacktestResult) renderAltBacktest(lastAltBacktestResult);
    if(sniperLoaded && lastSniperBacktestResult) renderSniperBacktest(lastSniperBacktestResult);
  });
}

/* 날짜 직접입력 — 값이 바뀌면 시작일을 바꾸고 세 매매법 전체를 다시 계산한다.
   min/max 범위 밖의 값은 입력 자체가 막히지만(HTML min/max 속성), 혹시 모를 우회 입력에
   대비해 여기서도 한 번 더 범위를 강제로 맞춘다. */
function setBacktestDate(dateStr){
  const min=BACKTEST_MIN_DATE, max=backtestMaxDate();
  if(dateStr<min) dateStr=min;
  if(dateStr>max) dateStr=max;
  if(BACKTEST_START_DATE===dateStr) return;
  BACKTEST_START_DATE=dateStr;
  BACKTEST_START_TS=Math.floor(new Date(dateStr+'T00:00:00Z').getTime()/1000);
  ['bt-start-date','bt2-start-date','bt3-start-date'].forEach(id=>{
    const el=document.getElementById(id);
    if(el) el.value=dateStr;
  });
  loadTradeBacktest();
  if(altLoaded) loadAltTradeBacktest();
  if(sniperLoaded) loadSniperTradeBacktest();
}
/* 세 군데(2배김군·떨사오팔·스나이퍼)의 날짜 입력 필드에 min/max 제약과 change 이벤트를 건다 */
function initBacktestDateInputs(){
  ['bt-start-date','bt2-start-date','bt3-start-date'].forEach(id=>{
    const el=document.getElementById(id);
    if(!el) return;
    el.min=BACKTEST_MIN_DATE;
    el.max=backtestMaxDate();
    el.value=BACKTEST_START_DATE;
    /* 일부 모바일 브라우저는 네이티브 날짜 선택기에서 'change'를 놓치는 경우가 있어
       'change'·'input'·'blur' 세 가지 모두에 걸어 확실히 반영되게 한다(값이 실제로
       바뀌었을 때만 setBacktestDate 내부에서 재계산하므로 중복 실행 걱정은 없다) */
    const onPick=()=>{
      if(!el.value || !/^\d{4}-\d{2}-\d{2}$/.test(el.value)) return; // 미완성 입력 무시(직전 값 유지)
      setBacktestDate(el.value);
    };
    el.addEventListener('change', onPick);
    el.addEventListener('input', onPick);
    el.addEventListener('blur', onPick);
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