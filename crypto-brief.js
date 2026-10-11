/* 가상화폐: 미국주식과 같은 "오늘의 시장 요약 · 바로가기 · 시장 한눈에 보기" 구성.
   값은 이 페이지가 이미 불러온 공포탐욕·코인 시세·일정 DOM에서만 읽으며, 없으면 "--"로 두고 임의 값을 만들지 않는다. */
(function(){'use strict';
if(!/\/crypto(\.html)?$/.test(location.pathname)&&!document.getElementById('crypto'))return;
var d=document,$=function(s,r){return(r||d).querySelector(s)};
function txt(e){return e?(e.textContent||'').replace(/\s+/g,' ').trim():''}
function coin(id){var r=$('#coin-tbl .wl-row[data-c="'+id+'"]');if(!r)return null;var q=txt($('.wl-quote',r)),m=q.match(/^(\$?[\d,\.]+)\s*([▲▼]?)\s*([+\-−]?[\d\.]+)%/);var nm=txt($('.wl-tag',r)).replace(/(과열 주의|극단적 거품|보유|중립|주의|저평가|바닥|거품).*$/,'').trim();var sym=txt($('.wl-name a',r))||'';if(!m)return {n:nm,s:sym,p:q,pct:NaN};var pct=parseFloat(m[3].replace('−','-'));if(m[2]==='▼'&&pct>0)pct=-pct;return {n:nm,s:sym,p:m[1],pct:pct}}
function pctHtml(c){if(!c||!isFinite(c.pct))return '';var up=c.pct>=0;return '<span style="color:'+(up?'#B42318':'#1D4ED8')+'">'+(up?'▲ +':'▼ ')+Math.abs(c.pct).toFixed(2)+'%</span>'}
function nextEv(){var e=$('#cry-next-event');if(!e)return null;var row=$('.nev-row',e);if(!row)return null;var tag=txt($('.tag',row)),t=txt($('div[style*="font-weight:800"]',row)),when=txt($('.mut',row)).split('·')[0].trim();return t?{t:t,dd:tag,when:when}:null}
var ZC=['#C42318','#B54708','#475467','#3F7D20','#0B6B3A'];
function build(){
 var wrap=$('#crypto>.wrap')||$('#crypto .wrap');if(!wrap||$('#pro-brief'))return;
 var br=d.createElement('div');br.id='pro-brief';br.setAttribute('aria-label','오늘의 시장 요약');
 br.innerHTML='<div class="pb-hd"><b>오늘의 시장 요약</b><span class="pb-sub">핵심 4가지를 한눈에 · 각 칸을 누르면 상세로 이동</span></div><p class="pb-line" id="pb-line">시장 상태를 불러오는 중…</p><div class="pb-grid">'+
  '<a class="pb-c" href="#cr-top" data-go="#cr-top"><small>가상화폐 공포탐욕</small><b id="pb-fg">--</b><span id="pb-fg2"></span></a>'+
  '<a class="pb-c" href="#coin-tbl" data-go="#coin-tbl"><small>비트코인</small><b id="pb-btc">--</b><span id="pb-btc2"></span></a>'+
  '<a class="pb-c" href="#coin-tbl" data-go="#coin-tbl"><small>이더리움</small><b id="pb-eth">--</b><span id="pb-eth2"></span></a>'+
  '<a class="pb-c" href="#cry-next-event" data-go="#cry-next-event"><small>다음 주요 일정</small><b id="pb-ev">--</b><span id="pb-ev2"></span></a></div>';
 wrap.prepend(br);
 br.addEventListener('click',function(e){var a=e.target.closest('a[data-go]');if(!a)return;e.preventDefault();var t=$(a.dataset.go);if(!t)return;var det=t.closest('details');if(det)det.open=true;var h=(d.querySelector('header')||{}).offsetHeight||0;window.scrollTo({top:Math.max(0,t.getBoundingClientRect().top+scrollY-h-12),behavior:'smooth'})});
 /* 시장 한눈에 보기 */
 var pu=d.createElement('div');pu.className='pulse m-fold';pu.id='cr-pulse';
 pu.innerHTML='<h3><span>시장 한눈에 보기 <small id="pu-sub">코인 시세 · 최근 등락</small></span><button type="button" class="m-fold-btn" aria-expanded="false"><em>펼치기</em> +</button></h3><div class="v105-pulse-body" hidden></div>';
 br.after(pu);
 var h3=$('h3',pu),btn=$('.m-fold-btn',pu),body=$('.v105-pulse-body',pu);
 h3.addEventListener('click',function(){var on=body.hidden;body.hidden=!on;pu.classList.toggle('m-open',on);btn.setAttribute('aria-expanded',String(on));$('em',btn).textContent=on?'접기':'펼치기';btn.lastChild.textContent=on?' −':' +'});
 /* 바로가기 */
 var toc=d.createElement('nav');toc.id='cr-toc';toc.className='v105-toc';toc.setAttribute('aria-label','바로가기');
 var L=[['요약','#pro-brief'],['시장 한눈에','#cr-pulse'],['공탐지수','#cr-top'],['코인 가격','#coin-tbl'],['일정','#cry-next-event'],['내 투자','#unified-tools']];
 toc.innerHTML=L.map(function(x){return '<a href="'+x[1]+'">'+x[0]+'</a>'}).join('');
 br.after(toc);
 toc.addEventListener('click',function(e){var a=e.target.closest('a');if(!a)return;e.preventDefault();var t=$(a.getAttribute('href'));if(!t)return;var det=t.closest('details');if(det)det.open=true;var h=(d.querySelector('header')||{}).offsetHeight||0;window.scrollTo({top:Math.max(0,t.getBoundingClientRect().top+scrollY-h-12),behavior:'smooth'})});
}
function fill(){
 var v=parseFloat(txt($('#cf-val'))),s=txt($('#cf-state')),P=[];
 if(isFinite(v)){var z=v<25?0:v<45?1:v<=55?2:v<=75?3:4,lab=(s&&s.indexOf('불러')<0)?s:['극단적 공포','공포','중립','탐욕','극단적 탐욕'][z],b=$('#pb-fg');if(b){b.textContent=Math.round(v)+' · '+lab;b.style.color=ZC[z]}var f2=$('#pb-fg2');if(f2)f2.textContent='Alternative.me 기준 · 0 공포 ~ 100 탐욕';P.push('공포탐욕 '+Math.round(v)+' <em>'+lab+'</em>')}
 [['bitcoin','btc','비트코인'],['ethereum','eth','이더리움']].forEach(function(x){var c=coin(x[0]),b=$('#pb-'+x[1]),b2=$('#pb-'+x[1]+'2');if(c&&b&&c.p){b.textContent=c.p;if(b2)b2.innerHTML=pctHtml(c);if(isFinite(c.pct))P.push(x[2]+' <em>'+(c.pct>=0?'+':'')+c.pct.toFixed(2)+'%</em>')}});
 var ne=nextEv();if(ne){var b=$('#pb-ev'),b2=$('#pb-ev2');if(b)b.textContent=ne.t;if(b2)b2.textContent=ne.dd+' · '+ne.when;P.push('다음 일정 <em>'+ne.t+' '+ne.dd+'</em>')}
 var pl=$('#pb-line');if(pl){var nh=P.length?P.map(function(x){return '<span class="pb-seg">'+x+'</span>'}).join('')+'<span class="pb-note">참고용 요약 · 투자 권유 아님</span>':'시장 상태를 불러오는 중…';if(pl._h!==nh){pl._h=nh;pl.innerHTML=nh}}
 /* 히트맵 타일: 시세를 읽을 수 있는 코인만 */
 var body=$('#cr-pulse .v105-pulse-body');if(body){var rows=Array.prototype.slice.call(d.querySelectorAll('#coin-tbl .wl-row[data-c]')),cs=rows.map(function(r){return coin(r.dataset.c)}).filter(function(c){return c&&isFinite(c.pct)});
  if(cs.length){var up=cs.filter(function(c){return c.pct>0}).length,dn=cs.filter(function(c){return c.pct<0}).length,fl=cs.length-up-dn,n=cs.length;
   var html='<div class="breadth"><i style="width:'+up/n*100+'%;background:var(--up,#d92d20)"></i><i style="width:'+fl/n*100+'%;background:#aaa"></i><i style="width:'+dn/n*100+'%;background:var(--down,#2563eb)"></i></div><div class="bl"><span style="color:var(--up,#d92d20)">▲ 상승 '+up+'</span><span>보합 '+fl+'</span><span style="color:var(--down,#2563eb)">하락 '+dn+' ▼</span></div><div class="v105-hm">'+cs.map(function(c){var a=Math.min(1,Math.abs(c.pct)/5);var col=c.pct>=0?'217,45,32':'37,99,235';return '<div class="v105-tl" style="background:rgba('+col+','+(0.10+a*0.28).toFixed(2)+');border-color:rgba('+col+',.45)"><span>'+c.n+'</span><b>'+c.p+'</b><small style="color:'+(c.pct>=0?'#B42318':'#1D4ED8')+'">'+(c.pct>=0?'▲ +':'▼ ')+Math.abs(c.pct).toFixed(2)+'%</small></div>'}).join('')+'</div>';
   if(body._h!==html){body._h=html;body.innerHTML=html}
   var sub=$('#pu-sub');if(sub)sub.textContent=n+'개 코인 기준 · 최근 시세 등락'}}
}
function start(){build();fill();var k=0;var iv=setInterval(function(){build();fill();if(++k>40)clearInterval(iv)},1500);setInterval(fill,20000)}
if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',function(){setTimeout(start,1200)});else setTimeout(start,1200);
})();
