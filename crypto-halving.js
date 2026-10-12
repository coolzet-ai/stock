/* 가상화폐 글로벌 마켓 트렌드 카드 — 비트코인 반감기 사이클 시각화
   (1) 4차 반감기 이후 경과일 / 5차 반감기까지 남은 일수 진행 바
   (2) 반감기 기준 상승·하락 구간 차트 (BTC 일봉, 로그 스케일)
   (3) 비트코인 ↔ 이더리움·솔라나·리플 상관계수 (90일 / 4차 반감기 이후)
   5차 반감기 날짜는 블록 시간(10분) 기준 추정치이며 실제와 며칠 차이날 수 있다. */
(function(){
'use strict';
var DAY=86400000;
var HALV=[Date.UTC(2016,6,9),Date.UTC(2020,4,11),Date.UTC(2024,3,20)];   /* 2·3·4차 */
var H4=Date.UTC(2024,3,20,0,9,27), CYC=210000*600*1000, H5=H4+CYC;
var esc=function(s){return String(s).replace(/[&<>]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;'}[c]})};
var fmtD=function(t){var d=new Date(t);return d.getUTCFullYear()+'.'+String(d.getUTCMonth()+1).padStart(2,'0')+'.'+String(d.getUTCDate()).padStart(2,'0')};
var pct=function(v,sg){return (sg&&v>0?'+':'')+(v*100).toFixed(0)+'%'};

function mount(){
  var cm=document.getElementById('cf-comment');
  var card=cm&&cm.closest('.card');
  if(!card) return null;
  var box=document.getElementById('cry-hv');
  if(box) return box;
  box=document.createElement('div');
  box.id='cry-hv';
  box.className='hv2';
  card.appendChild(box);
  return box;
}
/* 진행 바·D-day 는 좌측(공포탐욕·일정) 카드 하단에 둬 두 카드 높이를 비슷하게 맞춘다 */
function mountP(){
  var ev=document.getElementById('cry-next-event');
  var card=ev&&ev.closest('.card');
  if(!card) return null;
  var box=document.getElementById('cry-hv-p');
  if(!box){ box=document.createElement('div'); box.id='cry-hv-p'; box.className='hv2'; card.appendChild(box); }
  return box;
}

function progressHTML(now){
  var el=Math.max(0,Math.floor((now-H4)/DAY)), left=Math.max(0,Math.ceil((H5-now)/DAY));
  var tot=Math.round(CYC/DAY), p=Math.min(1,Math.max(0,(now-H4)/CYC));
  return '<div class="hv2-sec"><div class="hv2-t">반감기 사이클 진행 <small>4차 → 5차 (약 '+tot.toLocaleString('ko-KR')+'일)</small></div>'+
    '<div class="hv2-pg"><i style="width:'+(p*100).toFixed(2)+'%"></i><b style="left:'+(p*100).toFixed(2)+'%"></b></div>'+
    '<div class="hv2-pgl"><span>4차 반감기<em>'+fmtD(H4)+'</em></span><span class="hv2-now">'+(p*100).toFixed(1)+'% 경과</span><span>5차 반감기(추정)<em>'+fmtD(H5)+'</em></span></div>'+
    '<div class="hv2-kpi"><div><em>4차 반감기 이후</em><b>'+el.toLocaleString('ko-KR')+'<small>일 경과</small></b></div>'+
    '<div><em>5차 반감기까지</em><b>D-'+left.toLocaleString('ko-KR')+'<small>일 남음</small></b></div></div></div>';
}

/* ---------- 데이터 ---------- */
function fetchDaily(sym,fromSec){
  var url='https://query1.finance.yahoo.com/v8/finance/chart/'+encodeURIComponent(sym)+'?period1='+fromSec+'&period2='+Math.floor(Date.now()/1000)+'&interval=1d';
  return getJSON(url).then(function(j){
    var x=j.chart.result[0], cl=x.indicators.quote[0].close, ts=x.timestamp, out=[];
    for(var i=0;i<ts.length;i++){ if(cl[i]!=null&&cl[i]>0) out.push([ts[i]*1000,cl[i]]); }
    return out.length>60?out:null;
  }).catch(function(){return null});
}

/* ---------- 상승·하락 구간 ---------- */
function cycles(btc,now){
  var res=[];
  for(var k=0;k<HALV.length;k++){
    var a=HALV[k], b=k+1<HALV.length?HALV[k+1]:now, cur=(k===HALV.length-1);
    var seg=btc.filter(function(r){return r[0]>=a&&r[0]<b});
    if(seg.length<30) continue;
    var base=seg[0][1], pk=seg[0];
    seg.forEach(function(r){if(r[1]>pk[1])pk=r});
    var after=seg.filter(function(r){return r[0]>=pk[0]}), tr=after[0];
    after.forEach(function(r){if(r[1]<tr[1])tr=r});
    var last=seg[seg.length-1];
    var falling=!cur||tr[0]>pk[0]&&last[1]<pk[1]*0.8;
    res.push({n:k+2,a:a,b:b,cur:cur,base:base,pk:pk,tr:tr,last:last,falling:falling});
  }
  return res;
}

function chartHTML(btc,now){
  var cy=cycles(btc,now); if(!cy.length) return '';
  var x0=HALV[0]-180*DAY, x1=H5+60*DAY, W=640,H=250,L=8,R=8,T=22,B=22;
  var lo=Infinity,hi=0; btc.forEach(function(r){if(r[0]>=x0){if(r[1]<lo)lo=r[1];if(r[1]>hi)hi=r[1];}});
  var ly0=Math.log(lo*0.85), ly1=Math.log(hi*1.15);
  var X=function(t){return L+(t-x0)/(x1-x0)*(W-L-R)}, Y=function(v){return T+(1-(Math.log(v)-ly0)/(ly1-ly0))*(H-T-B)};
  var s='<svg class="hv2-svg" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="비트코인 반감기 사이클 차트">';
  var bandY=T, bandH=H-T-B;
  cy.forEach(function(c){
    var rEnd=c.falling?c.pk[0]:c.last[0];
    s+='<rect x="'+X(c.a).toFixed(1)+'" y="'+bandY+'" width="'+Math.max(1,X(rEnd)-X(c.a)).toFixed(1)+'" height="'+bandH+'" class="hv2-up"/>';
    if(c.falling){
      var fEnd=c.cur?c.last[0]:c.tr[0];
      s+='<rect x="'+X(c.pk[0]).toFixed(1)+'" y="'+bandY+'" width="'+Math.max(1,X(fEnd)-X(c.pk[0])).toFixed(1)+'" height="'+bandH+'" class="hv2-dn"/>';
    }
  });
  /* 5차 반감기 이후 예상(미래) 영역 */
  s+='<rect x="'+X(now).toFixed(1)+'" y="'+bandY+'" width="'+Math.max(1,X(H5)-X(now)).toFixed(1)+'" height="'+bandH+'" class="hv2-fut"/>';
  var pts=[],step=Math.max(1,Math.floor(btc.length/260));
  btc.forEach(function(r,i){ if(r[0]>=x0&&(i%step===0||i===btc.length-1)) pts.push(X(r[0]).toFixed(1)+','+Y(r[1]).toFixed(1)); });
  s+='<polyline class="hv2-ln" points="'+pts.join(' ')+'"/>';
  HALV.concat([H5]).forEach(function(t,i){
    var n=i+2, est=(t===H5), x=X(t).toFixed(1);
    s+='<line x1="'+x+'" y1="'+(T-4)+'" x2="'+x+'" y2="'+(H-B)+'" class="hv2-hl'+(est?' est':'')+'"/>'+
       '<text x="'+x+'" y="11" text-anchor="'+(est?'end':'middle')+'" class="hv2-tx">'+n+'차'+(est?'(추정)':'')+'</text>';
  });
  cy.forEach(function(c){
    var px=X(c.pk[0]).toFixed(1), py=Y(c.pk[1]).toFixed(1);
    s+='<circle cx="'+px+'" cy="'+py+'" r="3.2" class="hv2-pk"/>';
  });
  var nx=X(now).toFixed(1), ny=Y(btc[btc.length-1][1]).toFixed(1);
  s+='<line x1="'+nx+'" y1="'+T+'" x2="'+nx+'" y2="'+(H-B)+'" class="hv2-today"/><circle cx="'+nx+'" cy="'+ny+'" r="4" class="hv2-dot"/>';
  for(var y=2016;y<=2028;y+=2){ var t=Date.UTC(y,0,1); if(t<x0||t>x1) continue; s+='<text x="'+X(t).toFixed(1)+'" y="'+(H-6)+'" text-anchor="middle" class="hv2-ax">'+y+'</text>'; }
  s+='</svg>';
  var rows='';
  cy.slice().reverse().forEach(function(c){
    var rise=c.pk[1]/c.base-1, rd=Math.round((c.pk[0]-c.a)/DAY);
    var fall=(c.cur?c.last[1]:c.tr[1])/c.pk[1]-1, fd=Math.round(((c.cur?c.last[0]:c.tr[0])-c.pk[0])/DAY);
    rows+='<div class="hv2-row"><b>'+c.n+'차 반감기'+(c.cur?' <u>현재</u>':'')+'</b>'+
      '<span class="u">▲ '+pct(rise,1)+' <em>'+rd+'일</em></span>'+
      (c.falling||!c.cur?'<span class="d">▼ '+pct(fall)+' <em>'+fd+'일'+(c.cur?' 진행':'')+'</em></span>':'<span class="n">고점 갱신 구간</span>')+'</div>';
  });
  return '<div class="hv2-sec"><div class="hv2-t">반감기 기준 상승·하락 구간 <small>BTC 일봉 · 로그 스케일</small></div>'+s+
    '<div class="hv2-lg"><i class="u"></i>상승(반감기→고점)<i class="d"></i>하락(고점→저점)<i class="f"></i>5차 반감기 전망 구간</div>'+
    '<div class="hv2-tbl">'+rows+'</div></div>';
}

/* ---------- 상관관계 ---------- */
function rets(arr,from){
  var m={},prev=null;
  arr.forEach(function(r){ var d=Math.round(r[0]/DAY); if(prev!=null&&r[0]>=from) m[d]=r[1]/prev-1; prev=r[1]; });
  return m;
}
function corr(a,b){
  var xs=[],ys=[]; for(var k in a){ if(b[k]!=null){xs.push(a[k]);ys.push(b[k]);} }
  var n=xs.length; if(n<20) return null;
  var mx=xs.reduce(function(p,c){return p+c},0)/n, my=ys.reduce(function(p,c){return p+c},0)/n, sxy=0,sxx=0,syy=0;
  for(var i=0;i<n;i++){ sxy+=(xs[i]-mx)*(ys[i]-my); sxx+=(xs[i]-mx)*(xs[i]-mx); syy+=(ys[i]-my)*(ys[i]-my); }
  return sxx&&syy?sxy/Math.sqrt(sxx*syy):null;
}
var COINS=[['ETH-USD','이더리움','#627eea'],['SOL-USD','솔라나','#9945ff'],['XRP-USD','리플','#23292f']];
function corrHTML(btc,others,now){
  var b90=rets(btc,now-90*DAY), bH=rets(btc,H4), rows='', any=false;
  COINS.forEach(function(c,i){
    var d=others[i]; if(!d) return;
    var c90=corr(b90,rets(d,now-90*DAY)), cH=corr(bH,rets(d,H4));
    if(c90==null&&cH==null) return;
    any=true;
    var bar=function(v,cls){ if(v==null) return '<div class="hv2-cb"><span class="hv2-cn">–</span></div>';
      var w=Math.max(2,Math.abs(v)*100);
      return '<div class="hv2-cb '+cls+'"><span class="hv2-trk"><i style="width:'+w.toFixed(0)+'%;background:'+c[2]+'"></i></span><span class="hv2-cn">'+v.toFixed(2)+'</span></div>'; };
    rows+='<div class="hv2-cr"><b><i style="background:'+c[2]+'"></i>'+c[1]+'</b>'+bar(c90,'a')+bar(cH,'b')+'</div>';
  });
  if(!any) return '';
  return '<div class="hv2-sec"><div class="hv2-t">비트코인과의 상관관계 <small>일간 수익률 · 1.0에 가까울수록 같이 움직임</small></div>'+
    '<div class="hv2-ch"><span></span><span>최근 90일</span><span>4차 반감기 이후</span></div>'+rows+'</div>';
}

function run(){
  var box=mount(); if(!box) return;
  var now=Date.now();
  var pb=mountP(); if(pb) pb.innerHTML=progressHTML(now);
  box.innerHTML=(pb?'':progressHTML(now))+'<div class="hv2-sec hv2-ld"><div class="hv2-t">반감기 기준 상승·하락 구간 · 상관관계</div><p class="mut">차트 데이터를 불러오는 중…</p></div>';
  if(typeof getJSON!=='function') return;
  var from=Math.floor((HALV[0]-190*DAY)/1000);
  Promise.all([fetchDaily('BTC-USD',from)].concat(COINS.map(function(c){return fetchDaily(c[0],Math.floor((H4-5*DAY)/1000))}))).then(function(r){
    var btc=r[0], html=pb?'':progressHTML(now);
    if(!btc){ html+='<div class="hv2-sec"><p class="mut">⚠ 비트코인 가격 데이터를 불러오지 못해 차트를 표시할 수 없습니다.</p></div>'; }
    else{
      try{html+=chartHTML(btc,now)}catch(e){}
      try{html+=corrHTML(btc,r.slice(1),now)}catch(e){}
      html+='<p class="hv2-note">과거 사이클 패턴 참고용이며 미래 수익을 보장하지 않습니다. 5차 반감기는 블록 생성 속도 기준 추정일입니다.</p>';
    }
    box.innerHTML=html;
  });
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',run); else run();
})();
