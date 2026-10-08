/* 미국지수 시가총액 TOP10 재무비율·주가지표 — 한국주식 페이지의 "재무" 클릭식 토글과 동일한 방식.
   /us-fundamentals 는 10개 종목 전체를 한 번에 반환하므로(loadUsFundamentalsOnce, mrkim-common.js
   참고), 처음 "재무"를 누른 시점에 한 번만 불러와 캐시해두고 이후 클릭은 그 캐시에서 즉시 렌더링한다. */
const usFinLoaded={};
async function toggleUsFinancials(ticker,pre){
  const el=document.getElementById((pre||'fin-')+ticker);
  if(!el) return;
  if(el.style.display==='none'){
    el.style.display='block';
    if(!usFinLoaded[(pre||'')+ticker]){
      el.innerHTML='<p class="mut" style="font-size:12.5px">Yahoo Finance에서 불러오는 중…</p>';
      let item=null;
      if(US_FUND_NAME[ticker]||US_FUND_SET2.indexOf(ticker)>=0){ const cache=await loadUsFundamentalsOnce(US_FUND_SET2.indexOf(ticker)>=0?2:1); item=cache?cache[ticker]:null; }
      else item=await loadUsFundamentalOne(ticker);
      let techD=null;
      try{ techD=(typeof tickData!=='undefined'&&tickData[ticker])||await yclose(ticker,'1y'); }catch(e){}
      el.innerHTML=renderUsFinancialRatios(item, techD);
      usFinLoaded[(pre||'')+ticker]=true;
    }
  }else{
    el.style.display='none';
  }
}
