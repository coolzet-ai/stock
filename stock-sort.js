/* 목록 정렬 — Yahoo Finance식: 기본순 / 등락률 높은순 / 낮은순 */
(function(){
  [['tick-tbl'],['cap-tbl'],['lev-tbl']].forEach(([id])=>{
    const list=document.getElementById(id); if(!list) return;
    const rows=[...list.querySelectorAll(':scope > .wl-row')]; if(rows.length<2) return;
    rows.forEach((r,i)=>r.dataset.o=i);
    const bar=document.createElement('div'); bar.className='srt';
    bar.innerHTML='<button data-s="o" class="on">기본순</button><button data-s="d">등락률 ↓</button><button data-s="a">등락률 ↑</button>';
    list.before(bar);
    const val=r=>{const c=r.querySelector('.ch'); if(!c) return 0; const m=c.textContent.match(/([\d.]+)\s*%/); return m?parseFloat(m[1])*(/▼|-|−/.test(c.textContent)?-1:1):0;};
    bar.addEventListener('click',e=>{const b=e.target.closest('button'); if(!b) return; bar.querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b));
      const k=b.dataset.s; const arr=[...list.querySelectorAll(':scope > .wl-row')];
      arr.sort((x,y)=>k==='o'?x.dataset.o-y.dataset.o:k==='d'?val(y)-val(x):val(x)-val(y)); arr.forEach(r=>list.appendChild(r)); });
  });
})();
