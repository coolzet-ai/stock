/* 기간 라벨을 "1일·1주·1개월·1년"으로 통일(다른 페이지 표기는 그대로) */
if(typeof PERKO!=='undefined') Object.assign(PERKO,{d:'1일',w:'1주',m:'1개월',y:'1년'});
const evMonthTabs=document.getElementById('evmonth-tabs');
if(evMonthTabs){
  evMonthTabs.addEventListener('click',e=>{
    const b=e.target.closest('button'); if(!b)return;
    evMonthTabs.querySelectorAll('button').forEach(x=>x.classList.remove('on'));
    b.classList.add('on');
    renderEvents(+b.dataset.m);
  });
  const nowMonth=new Date().getMonth()+1;
  const defMonth=MONTH_EVENTS[nowMonth]?nowMonth:9;
  const defBtn=evMonthTabs.querySelector('button[data-m="'+defMonth+'"]');
  if(defBtn) defBtn.classList.add('on');
  renderEvents(defMonth);
}
renderNextEventBanner('us-next-event', MONTH_EVENTS, {excludeHoliday:true});


const now=new Date();
{ const _s=document.querySelector('#stamp'); if(_s) _s.textContent='최종 갱신 '+now.toLocaleString('ko-KR'); }
{ const _st=document.querySelector('#stamp-top'); if(_st) _st.innerHTML='<b>'+now.toLocaleDateString('ko-KR',{year:'numeric',month:'2-digit',day:'2-digit'})+'</b><span class="upd-word"> 업데이트</span>'; }

renderUS('d'); renderTick('tick','d'); renderTick('cap','d'); renderTick('lev','d');
renderCapShareChart('us-cap-chart', US_CAP_DATA);
applyRankHistory();
loadUS();
/* 시세 목록 3종은 첫 화면 데이터(공탐·시세 띠) 뒤로 미루고, 해당 섹션이 가까워지거나 펼쳐지면 즉시 불러온다 */
{ const L=window.MK_LAZY||((e,f)=>f());
  const host=id=>{ const e=document.getElementById(id); return e&&(e.closest('.fold-body')||e); };
  L(host('tick-tbl'),()=>loadTickGroup('tick'),5000);
  L(host('cap-tbl'),()=>{ fillUsRowStats('cap-tbl',1); loadTickGroup('cap').then(()=>renderCapRelCompare('us-caprel-chart','cap',US_CAP_DATA,curPer.caprel)); },5500);
  L(host('lev-tbl'),()=>loadTickGroup('lev'),6000); }
/* 접힌 섹션(지수 비교·상관관계 / 지수 편입·편출 / 유니콘)은 처음 펼칠 때 불러온다 — 아래 fold 스크립트의 지연 로딩 */
initKrwToggle('#krw-toggle');

