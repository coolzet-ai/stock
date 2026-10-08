(function(){
const q=(id)=>[...document.querySelectorAll('#'+id+' .wl-row')].map(r=>{const c=r.querySelector('.ch'),p=r.querySelector('.px');if(!c||!p)return null;const m=c.textContent.match(/([\d.]+)\s*%/);if(!m)return null;const rm=(r.querySelector('.wl-tag')||{textContent:''}).textContent.match(/^(\d+)위/);return{t:r.dataset.t,rk:rm?+rm[1]:0,px:p.textContent,v:parseFloat(m[1])*(/▼|-|−/.test(c.textContent)?-1:1)}}).filter(Boolean);
function col(v){const a=Math.min(Math.abs(v)/4,1);const L=v>=0?[200,32,20]:[26,111,168];const g=[110,118,112];const c=L.map((x,i)=>Math.round(g[i]+(x-g[i])*(.35+.65*a)));return 'rgb('+c+')'}
let mode='cap';
const MOV={up:null,dn:null};
async function loadMov(){
  for(const [k,id] of [['up','day_gainers'],['dn','day_losers']]){
    try{
      const j=await getJSON('https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved?formatted=false&scrIds='+id+'&count=50');
      const qs=j.finance.result[0].quotes.filter(x=>x.quoteType==='EQUITY'&&x.regularMarketPrice>=2&&(x.marketCap||0)>=3e8&&x.regularMarketChangePercent!=null);
      MOV[k]=qs.slice(0,10).map(x=>({t:x.symbol,nm:x.symbol,rk:0,px:'$'+x.regularMarketPrice.toFixed(2),v:x.regularMarketChangePercent}));
    }catch(e){ if(!MOV[k]) MOV[k]=[]; }
  }
  draw();
}
setTimeout(loadMov,1500);setInterval(loadMov,90000);

function draw(){
  let all=[].concat(q('cap-tbl'),q('tick-tbl'),q('lev-tbl'));
 if(!all.length)return;
 let p=document.querySelector('.pulse');
 if(!p){p=document.createElement('div');p.className='pulse';const bar=document.querySelector('.fold-all');bar.before(p);p.addEventListener('click',e=>{const b=e.target.closest('[data-m]');if(b){mode=b.dataset.m;draw()}})}
 const KEY=['TQQQ','SOXL','TECL','QLD','USD','SCHD'];
 const kb=(ti,ks)=>{const a=ks.map(k=>all.find(x=>x.t===k)).filter(Boolean);return a.length?'<div class="hm-k"><h4>'+ti+' <small>'+ks.join(' · ')+'</small></h4><div class="hm">'+a.map(x=>'<div class="tl" style="--c:'+col(x.v)+'"><span>★ '+x.t+'</span><small style="background:'+col(x.v)+'"><b>'+x.px+'</b><b class="hm-chg">'+(x.v>=0?'▲ +':'▼ ')+Math.abs(x.v).toFixed(2)+'%</b></small></div>').join('')+'</div></div>':''};
 const rows=(mode==='up'||mode==='dn')?(MOV[mode]||[]):mode==='cap'?q('cap-tbl'):mode==='tick'?q('tick-tbl'):q('lev-tbl');const g5=(mode==='cap'||mode==='up'||mode==='dn');
 const up=all.filter(x=>x.v>0).length,dn=all.filter(x=>x.v<0).length,fl=all.length-up-dn;
 p.innerHTML='<h3>시장 한눈에 보기 <small>'+all.length+'개 종목 기준 · 실시간 등락 히트맵</small></h3>'+
 '<div class="breadth"><i style="width:'+up/all.length*100+'%;background:var(--up)"></i><i style="width:'+fl/all.length*100+'%;background:#aaa"></i><i style="width:'+dn/all.length*100+'%;background:var(--down)"></i></div>'+
 '<div class="bl"><span style="color:var(--up)">▲ 상승 '+up+'</span><span style="color:var(--tx2)">보합 '+fl+'</span><span style="color:var(--down)">하락 '+dn+' ▼</span></div>'+
 '<div class="hm-kw">'+kb('🔥 3배 핵심 3종',['TQQQ','SOXL','TECL'])+kb('🎯 김군 핵심 3종',['QLD','USD','SCHD'])+'</div>'+
 '<div class="hm-t"><button data-m="cap" class="'+(mode==='cap'?'on':'')+'">시가총액 TOP10</button><button data-m="tick" class="'+(mode==='tick'?'on':'')+'">관심종목</button><button data-m="lev" class="'+(mode==='lev'?'on':'')+'">레버리지 ETF</button><button data-m="up" class="'+(mode==='up'?'on':'')+'">🚀 급등주</button><button data-m="dn" class="'+(mode==='dn'?'on':'')+'">📉 급락주</button></div>'+
 (rows.length||(mode!=='up'&&mode!=='dn')?'':'<p class="mut" style="font-size:12.5px;margin:8px 0">'+(MOV[mode]===null?'급등·급락 종목을 불러오는 중입니다…':'조건(주가 $2 이상·시총 3억달러 이상)에 맞는 종목이 없습니다.')+'</p>')+'<div class="hm '+(g5?'hm-g5':'')+'">'+rows.map((x,i)=>'<div class="tl '+((mode==='cap'&&(i<3||i>=7))?'st ':'')+(mode==='cap'&&i<3?'big ':'')+(KEY.indexOf(x.t)>=0?'star':'')+'" style="--c:'+col(x.v)+'"><span style="--n:'+String(x.t).length+'">'+(mode==='cap'&&x.rk>0&&x.rk<=10?['','🥇','🥈','🥉','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟'][x.rk]+' ':'')+x.t+'</span><small style="background:'+col(x.v)+'"><b>'+x.px+'</b><b class="hm-chg">'+(x.v>=0?'▲ +':'▼ ')+Math.abs(x.v).toFixed(2)+'%</b></small></div>').join('')+'</div>'+
 '<div class="hm-l">-4%<i style="background:'+col(-4)+'"></i><i style="background:'+col(-1)+'"></i><i style="background:'+col(0.01)+'"></i><i style="background:'+col(1)+'"></i><i style="background:'+col(4)+'"></i>+4%</div>';
}
setTimeout(draw,5000);setInterval(draw,20000);
})();
