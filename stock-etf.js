/* 관심종목(ETF) 행의 가운데 빈 공간(종목 아이콘·이름이 있는 wl-info 영역) 클릭 시 주요
   보유종목(티커별 가중치)·섹터 가중치를 펼쳐 보여준다. wl-info 안의 링크(종목명)를 눌렀을 때는
   원래 링크 이동이 우선이라 여기서는 토글하지 않는다. */
const etfHoldLoaded={};
async function toggleEtfHoldings(ticker, ev){
  if(ev && ev.target && ev.target.closest && ev.target.closest('a')) return;
  const el=document.getElementById('etf-hold-'+ticker);
  if(!el) return;
  if(el.style.display==='none'){
    el.style.display='block';
    if(!etfHoldLoaded[ticker]){
      el.innerHTML='<p class="mut" style="font-size:12.5px">Yahoo Finance에서 불러오는 중…</p>';
      const data=await loadEtfHoldings(ticker);
      let lev='';
      try{ if(typeof LEV_META!=='undefined'&&LEV_META[ticker]) lev=await renderLevPanel(ticker,data); }catch(e){ console.warn('레버리지 패널 실패',e); }
      el.innerHTML=lev+renderEtfHoldings(data);
      etfHoldLoaded[ticker]=true;
    }
  }else{
    el.style.display='none';
  }
}
