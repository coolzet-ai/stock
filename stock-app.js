/* Source: stock-gate-legacy.js */
/* Mr.Kim Signal — 페이지 이동 암호 잠금
   · 각 페이지에 들어올 때마다 이용 암호를 묻는다(같은 페이지 새로고침은 재입력 없음, 다른 페이지로 이동하면 다시 입력).
   · "관리자 암호"를 입력하면 이 기기에서는 잠금 기능 자체가 꺼지고 페이지 하단에 '관리자 모드' 배지가 표시된다(localStorage). 다시 켜려면 주소 뒤에 ?gate=on 을 붙여 접속.
   · 암호는 평문이 아니라 SHA-256 해시로만 저장한다. gate-setup.html에서 해시를 만들어 아래 두 줄에 붙여넣는다.
   · 두 값이 비어 있으면 잠금은 동작하지 않는다.
   ※ 정적 웹페이지의 브라우저 측 잠금이라 '가벼운 접근 제한' 용도입니다(소스 보기·직접 파일 접근까지 막는 서버 보안은 아님). */
(function(){
  var USER_HASH  = 'c9a89417627c8ea81e2cc8cf31a415d7622cfc28c25846c7bfad15d071cc0e8d';   // ← gate-setup.html 에서 만든 "이용 암호" 해시
  var ADMIN_HASH = '52628b021df0963d0ed51ecbd523544f9a2890373e90b17e79a4168d03dfe690';   // ← gate-setup.html 에서 만든 "관리자 암호" 해시
  var SALT='mk|';
  try{ if(/[?&]gate=on\b/.test(location.search)) localStorage.removeItem('mk_gate_off'); }catch(e){}
  /* 관리자 모드 표시: 관리자 암호로 잠금이 꺼진 기기에서는 페이지 맨 아래(푸터)에 관리자 모드 배지를 보여준다. */
  function showAdminBar(){
    if(document.getElementById('mk-admin-bar')) return;
    var b=document.createElement('div'); b.id='mk-admin-bar';
    b.style.cssText='margin:18px 0 0;padding:10px 14px;border:2px solid #7c3aed;border-radius:12px;background:rgba(124,58,237,.10);color:#6d28d9;font-size:13px;font-weight:800;display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:8px 12px;text-align:center';
    b.innerHTML='<span>🛠 관리자 모드 · 암호 잠금이 해제된 기기입니다</span><button type="button" style="border:1.5px solid #7c3aed;background:transparent;color:inherit;border-radius:8px;padding:4px 10px;font-size:12px;font-weight:800;cursor:pointer">관리자 모드 해제</button>';
    b.querySelector('button').onclick=function(){ try{localStorage.removeItem('mk_gate_off');}catch(e){} b.remove();location.reload(); };
    var f=document.querySelector('footer .wrap')||document.querySelector('footer')||document.body;
    f.appendChild(b);
  }
  function adminBarLater(){ if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',showAdminBar); else showAdminBar(); }
  if(!USER_HASH) return;
  try{ if(localStorage.getItem('mk_gate_off')==='1'){ adminBarLater(); return; } }catch(e){}
  var page=(location.pathname.split('/').pop()||'index.html');
  var FREE={'stock.html':1,'kr-stock.html':1}, isFree=!!FREE[page];
  try{ if(!isFree && sessionStorage.getItem('mk_ok')===page) return; }catch(e){}

  /* SHA-256 (crypto.subtle 사용 불가 환경용 순수 JS 대체 포함) */
  function sha256js(msg){
    function r(n,x){return (x>>>n)|(x<<(32-n));}
    var K=[],H=[1779033703,3144134277,1013904242,2773480762,1359893119,2600822924,528734635,1541459225],p=2,c=0;
    while(c<64){var ok=true;for(var d=2;d*d<=p;d++)if(p%d===0){ok=false;break;}if(ok){K[c]=(Math.pow(p,1/3)*4294967296)|0;c++;}p++;}
    var b=unescape(encodeURIComponent(msg)),l=b.length,w=[],i,j;
    for(i=0;i<l;i++)w[i>>2]|=b.charCodeAt(i)<<(24-(i%4)*8);
    w[l>>2]|=0x80<<(24-(l%4)*8);w[(((l+8)>>6)+1)*16-1]=l*8;
    for(i=0;i<w.length;i+=16){var a=H.slice(0),W=[];
      for(j=0;j<64;j++){
        if(j<16)W[j]=w[i+j]|0;else{var s0=r(7,W[j-15])^r(18,W[j-15])^(W[j-15]>>>3),s1=r(17,W[j-2])^r(19,W[j-2])^(W[j-2]>>>10);W[j]=(W[j-16]+s0+W[j-7]+s1)|0;}
        var S1=r(6,a[4])^r(11,a[4])^r(25,a[4]),ch=(a[4]&a[5])^(~a[4]&a[6]),t1=(a[7]+S1+ch+K[j]+W[j])|0,
            S0=r(2,a[0])^r(13,a[0])^r(22,a[0]),mj=(a[0]&a[1])^(a[0]&a[2])^(a[1]&a[2]),t2=(S0+mj)|0;
        a=[(t1+t2)|0,a[0],a[1],a[2],(a[3]+t1)|0,a[4],a[5],a[6]];
      }
      for(j=0;j<8;j++)H[j]=(H[j]+a[j])|0;
    }
    return H.map(function(x){return ('00000000'+(x>>>0).toString(16)).slice(-8);}).join('');
  }
  function sha256(msg){
    try{
      if(window.crypto&&crypto.subtle&&window.TextEncoder){
        return crypto.subtle.digest('SHA-256',new TextEncoder().encode(msg)).then(function(buf){
          return Array.prototype.map.call(new Uint8Array(buf),function(x){return ('0'+x.toString(16)).slice(-2);}).join('');});
      }
    }catch(e){}
    return Promise.resolve(sha256js(msg));
  }

  /* 잠금 화면 */
  if(!isFree){
    var hide=document.createElement('style');
    hide.id='mk-gate-hide';
    hide.textContent='html{overflow:hidden!important}body{visibility:hidden!important}';
    document.documentElement.appendChild(hide);
  }
  function unlock(){
    var o=document.getElementById('mk-gate'); if(o) o.remove();
    var h=document.getElementById('mk-gate-hide'); if(h) h.remove();
  }
  function build(opt){
    opt=opt||{}; if(document.getElementById('mk-gate')) return;
    var o=document.createElement('div'); o.id='mk-gate'; if(opt.modal) o.className='modal';
    o.innerHTML='<style>#mk-gate{position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;padding:20px;background:#f4f6f5;color:#1b1f1d;font-family:-apple-system,BlinkMacSystemFont,"Pretendard","Noto Sans KR",sans-serif}'+
      '#mk-gate .bx{width:100%;max-width:340px;background:#fff;border:1px solid #dfe5e1;border-radius:16px;padding:26px 22px;text-align:center;box-shadow:0 10px 30px rgba(0,0,0,.12)}'+
      '#mk-gate h1{font-size:18px;margin:0 0 4px;font-weight:900}#mk-gate p{font-size:12.5px;opacity:.7;margin:0 0 16px}'+
      '#mk-gate input{width:100%;box-sizing:border-box;padding:12px;border:1.5px solid #cfd8d3;border-radius:10px;font-size:16px;text-align:center;margin-bottom:10px}'+
      '#mk-gate button{width:100%;padding:12px;border:0;border-radius:10px;background:#00754a;color:#fff;font-size:15px;font-weight:800;cursor:pointer}'+
      '#mk-gate .gd{margin:-4px 0 14px;padding:12px;border-radius:10px;background:rgba(0,117,74,.10);border:1px solid rgba(0,117,74,.3);font-size:12.5px;line-height:1.6}'+
      '#mk-gate .gd .id{display:block;text-decoration:none;cursor:pointer;margin-top:10px;padding:8px 10px;border-radius:10px;background:#00754a;color:#fff;font-size:12px;line-height:1.3;box-shadow:0 0 0 3px rgba(0,117,74,.22)}#mk-gate .gd .id i{font-style:normal;display:block}#mk-gate .gd .id em{display:block;font-style:normal;font-size:11.5px;font-weight:700;margin-top:4px;opacity:.9}#mk-gate .gd .id b{display:block;margin-top:3px;font-size:22px;font-weight:900;letter-spacing:1.5px}'+
      '#mk-gate .er{color:#d93025;font-size:12.5px;min-height:18px;margin-top:8px}'+
      '@media(prefers-color-scheme:dark){#mk-gate{background:#0f1311!important;color:#eef2ef!important}#mk-gate .bx{background:#171d1a!important;border-color:#2a332e!important;color:#eef2ef!important;box-shadow:0 10px 30px rgba(0,0,0,.5)!important}#mk-gate h1,#mk-gate p,#mk-gate .gd{color:#eef2ef!important}#mk-gate .gd{background:rgba(0,200,120,.12)!important;border-color:rgba(0,200,120,.35)!important}#mk-gate input{background:#0f1311!important;color:#eef2ef!important;border-color:#2f3a34!important}#mk-gate input::placeholder{color:#8a948e}#mk-gate .er{color:#ff7b72}}'+
      ':root[data-theme="dark"] #mk-gate{background:#0f1311!important;color:#eef2ef!important}:root[data-theme="dark"] #mk-gate .bx{background:#171d1a!important;border-color:#2a332e!important;color:#eef2ef!important}:root[data-theme="dark"] #mk-gate h1,:root[data-theme="dark"] #mk-gate p,:root[data-theme="dark"] #mk-gate .gd{color:#eef2ef!important}:root[data-theme="dark"] #mk-gate input{background:#0f1311!important;color:#eef2ef!important;border-color:#2f3a34!important}'+
      '#mk-gate.modal{background:rgba(0,0,0,.55)!important;backdrop-filter:blur(2px)}:root[data-theme] #mk-gate.modal{background:rgba(0,0,0,.55)!important}#mk-gate .cl{display:none;margin-top:10px;background:transparent!important;color:inherit!important;border:1px solid rgba(128,128,128,.4)!important;font-weight:700!important;font-size:13px!important;padding:9px!important}#mk-gate.modal .cl{display:block}#mk-gate .ms{display:none;font-size:12px;margin:-6px 0 12px;font-weight:700;color:#00754a}#mk-gate.modal .ms{display:block}'+
      '</style>'+
      '<form class="bx" autocomplete="off"><h1>🔒 Mr.Kim Signal</h1><p>'+(opt.modal?(opt.msg||'계속하려면 암호를 입력해 주세요'):'이 페이지에 들어가려면 암호를 입력해 주세요')+'</p>'+
      '<div class="gd">💌 <b>네이버포인트를 선물</b>하시고<br><b>쪽지</b>를 보내면 암호를 알려드립니다.<a class="id" id="mk-gate-gift" href="https://pay.naver.com/point-gift/send?rUrl=https%3A%2F%2Fpoint.pay.naver.com%2Fpointshistory%2Flist%3Fcategory%3Dall&inflowType=NPAY&sessionId=8l9jju8aocn" target="_blank" rel="noopener"><i>네이버포인트 선물 ID</i><b>coolzet</b><em>눌러서 바로 선물하기 ›</em></a></div>'+
      '<input type="password" id="mk-gate-pw" placeholder="암호" autocomplete="current-password" autofocus>'+
      '<button type="submit">확인</button><button type="button" class="cl" id="mk-gate-cl">닫기</button><div class="er" id="mk-gate-er"></div></form>';
    document.documentElement.appendChild(o);
    var fails=0,busy=false, f=o.querySelector('form'), inp=o.querySelector('#mk-gate-pw'), er=o.querySelector('#mk-gate-er');
    setTimeout(function(){try{inp.focus();}catch(e){}},50);
    var cl=o.querySelector('#mk-gate-cl'); if(cl) cl.addEventListener('click',function(){ o.remove(); });
    if(opt.modal){ o.addEventListener('mousedown',function(e){ if(e.target===o) o.remove(); }); document.addEventListener('keydown',function esc(e){ if(e.key==='Escape'){ o.remove(); document.removeEventListener('keydown',esc); } }); }
    var gl=o.querySelector('#mk-gate-gift');
    if(gl) gl.addEventListener('click',function(){
      try{ navigator.clipboard.writeText('coolzet'); }catch(e){}
      var em=gl.querySelector('em'); if(em){ em.textContent='아이디 coolzet 복사됨 · 선물 페이지로 이동합니다'; setTimeout(function(){ em.textContent='눌러서 바로 선물하기 ›'; },2500); }
    });
    f.addEventListener('submit',function(ev){
      ev.preventDefault(); if(busy) return;
      var v=inp.value; if(!v) return;
      busy=true;
      sha256(SALT+v).then(function(h){
        if(ADMIN_HASH&&h===ADMIN_HASH){ try{localStorage.setItem('mk_gate_off','1');}catch(e){} unlock(); adminBarLater(); if(opt.onOk) opt.onOk(true); return; }
        if(h===USER_HASH){ if(!opt.modal){ try{sessionStorage.setItem('mk_ok',page);}catch(e){} } unlock(); if(opt.onOk) opt.onOk(false); return; }
        fails++; inp.value=''; er.textContent='암호가 맞지 않습니다'+(fails>=5?' · 잠시 후 다시 시도해 주세요':'');
        setTimeout(function(){busy=false;},fails>=5?5000:300); return;
      }).then(function(){ if(document.getElementById('mk-gate')) return; busy=false; });
    });
  }
  if(!isFree){
    if(document.body) build(); else document.addEventListener('DOMContentLoaded',function(){ build(); });
    return;
  }
  /* ===== 미국주식·한국주식(기본 화면): 암호 없이 보여주되 '상세보기'나 다른 메뉴 이동 시에만 팝업 ===== */
  var detailOk=false;
  window.MK_REQUEST_DETAIL=function(done){var admin=false;try{admin=localStorage.getItem('mk_gate_off')==='1';}catch(e){}if(detailOk||admin){done();return;}build({modal:true,msg:'펼치려면 암호를 입력해 주세요',onOk:function(){detailOk=true;done();}});};
  var DETAIL_SEL='.wl-info,.wl-spark,[data-stock-click*="toggle"],[data-stock-click*="Detail"],[data-stock-click*="detail"]';
  function isDetail(el){
    if(el.closest(DETAIL_SEL)) return true;
    if(el.closest('.m-fold:not(.m-open)>h3')) return true;
    if(el.closest('details:not([open])>summary')&&!el.closest('.stock-nav-group')) return true;
    if(el.closest('.fold-h:not(.open)')||el.closest('.fold-all button[data-o="1"]')) return true; /* 제목 우측 펼치기·모두 펼치기 */
    var b=el.closest('button,a,summary,[role="button"]');
    return !!(b && /상세/.test(b.textContent||'') && !b.closest('#mk-gate'));
  }
  document.addEventListener('click',function(e){
    if(!e.isTrusted && e.__mkReplay) return;
    var t=e.target; if(!t||!t.closest) return;
    if(t.closest('#mk-gate')||t.closest('#mk-admin-bar')) return;
    try{ if(localStorage.getItem('mk_gate_off')==='1') return; }catch(x){}
    /* 1) 다른 메뉴(페이지)로 이동 */
    var a=t.closest('a[href]');
    if(a){
      var href=a.getAttribute('href')||'';
      if(!/^(#|javascript:|mailto:|tel:)/i.test(href)){
        var u; try{ u=new URL(a.href,location.href); }catch(x){ u=null; }
        if(u && u.origin===location.origin){
          var file=(u.pathname.split('/').pop()||'index.html');
          if(/\.html?$/i.test(file) && !FREE[file] && file!==page && (a.target||'_self')!=='_blank'){
            e.preventDefault(); e.stopPropagation();
            build({modal:true,msg:'다른 메뉴로 이동하려면 암호를 입력해 주세요',onOk:function(admin){
              if(!admin){ try{sessionStorage.setItem('mk_ok',file);}catch(x){} }
              location.href=a.href;
            }});
            return;
          }
        }
      }
    }
    /* 2) 상세보기(행 상세·펀드 상세 등) */
    if(!detailOk && isDetail(t)){
      var link=t.closest('a[href]'); if(link && /^https?:/i.test(link.href) && new URL(link.href).origin!==location.origin) return; /* 외부 링크는 그대로 */
      e.preventDefault(); e.stopPropagation(); if(e.stopImmediatePropagation) e.stopImmediatePropagation();
      build({modal:true,msg:'상세보기는 암호가 필요합니다',onOk:function(){
        detailOk=true;
        setTimeout(function(){ try{ t.click(); }catch(x){} },30);
      }});
    }
  },true);
})();

/* 저작권 고지(모든 페이지 푸터) + 관리자 모드 사용량 모니터(Worker /health · /ev-stats) */
(function(){
  var W='https://ai.coolzet.workers.dev/';
  function esc(t){ return String(t).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }
  function notice(){
    if(document.getElementById('mk-copy')) return;
    var f=document.querySelector('footer .wrap')||document.querySelector('footer'); if(!f) return;
    var d=document.createElement('p'); d.id='mk-copy'; d.className='mut';
    d.style.cssText='margin:10px 0 0;font-size:11.5px;line-height:1.55';
    d.textContent='© '+new Date().getFullYear()+' Mr.Kim Signal · 본 사이트의 구성·분석 지표·문구를 무단으로 복제·배포·상업적으로 이용할 수 없습니다. 시세·공시 데이터의 저작권은 각 제공처에 있으며 투자 권유가 아닙니다.';
    f.appendChild(d);
  }
  function run(){ notice(); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',run); else run();
  setTimeout(run,1500); setTimeout(run,4000);
})();

;
/* Source: stock-events-v48.js */
/* Explicit allowed actions; never evaluate attribute strings as JavaScript. */
(function(){
 'use strict';
 document.addEventListener('click',function(event){
  var el=event.target.closest&&event.target.closest('[data-stock-click]');if(!el)return;
  var action=el.getAttribute('data-stock-click')||'',m;
  if((m=/^toggleUsFinancials\('([A-Z0-9.^=\-]{1,15})'(?:,'(fin(?:my|x\d+)?-)')?\)$/.exec(action))){event.preventDefault();if(typeof toggleUsFinancials==='function')toggleUsFinancials(m[1],m[2]);}
  else if((m=/^toggleEtfHoldings\('([A-Z0-9.^=\-]{1,15})',event\)$/.exec(action))){event.preventDefault();if(typeof toggleEtfHoldings==='function')toggleEtfHoldings(m[1],event);}
  else if((m=/^toggleMoreRows\('(cap[23]|krcap2|krkq2)'\)$/.exec(action))){event.preventDefault();if(typeof toggleMoreRows==='function')toggleMoreRows(m[1]);}
  else if((m=/^toggleFinancials\('(\d{6})'(?:,event)?\)$/.exec(action))){event.preventDefault();if(typeof toggleFinancials==='function')toggleFinancials(m[1],event);}
  else if(action==='toggleKrFundDetail()'){if(typeof toggleKrFundDetail==='function')toggleKrFundDetail();}
  else if(action==='toggleFinSavingsExpand()'){if(typeof toggleFinSavingsExpand==='function')toggleFinSavingsExpand();}
  else if((m=/^var e=document.querySelectorAll\('\.(fin-more-[a-z0-9-]+)'\);/.exec(action))){var open=el.dataset.o!=='1';document.querySelectorAll('.'+m[1]).forEach(function(row){row.style.display=open?'table-row':'none';});if(!el.dataset.closedText)el.dataset.closedText=el.textContent;el.dataset.o=open?'1':'0';el.textContent=open?'접기 ▲':el.dataset.closedText;}
 });
 document.addEventListener('change',function(event){var el=event.target,action=el.getAttribute&&el.getAttribute('data-stock-change'),m;if(action&&(m=/^relToggle\('([A-Za-z0-9_-]+)',(\d+),this.checked\)$/.exec(action))&&typeof relToggle==='function')relToggle(m[1],Number(m[2]),el.checked);});
 document.addEventListener('error',function(event){var el=event.target;if(!(el instanceof HTMLImageElement))return;var action=el.getAttribute('data-stock-error');if(action==="this.style.display='none'")el.style.display='none';else if(action==="this.parentNode.classList.add('noimg');this.remove()"){if(el.parentNode)el.parentNode.classList.add('noimg');el.remove();}},true);
})();

;
/* Source: stock-protection-v48.js */
(function(){
 'use strict';
 if(!document.body.classList.contains('stock-v2'))return;
 document.body.classList.add('stock-content-protected');
 function editable(target){return !!(target&&target.closest&&target.closest('input,textarea,[contenteditable=""],[contenteditable="true"]'));}
 var notice=document.createElement('div');notice.className='stock-protection-notice';notice.setAttribute('role','status');notice.setAttribute('aria-live','polite');notice.hidden=true;document.body.appendChild(notice);var timer;
 function block(event){if(editable(event.target))return;event.preventDefault();clearTimeout(timer);notice.textContent='본문 복사·드래그는 제한됩니다. 공유 시 페이지 링크와 출처를 표시해 주세요.';notice.hidden=false;timer=setTimeout(function(){notice.hidden=true;},2400);}
 ['copy','cut','paste','dragstart','drop','contextmenu'].forEach(function(type){document.addEventListener(type,block,true);});
 document.addEventListener('selectstart',function(event){if(!editable(event.target))event.preventDefault();},true);
 document.addEventListener('keydown',function(event){if(editable(event.target))return;if((event.ctrlKey||event.metaKey)&&['a','c','x','v'].indexOf(event.key.toLowerCase())>=0)block(event);});
 var stamp=document.createElement('aside');stamp.className='stock-source-stamp';stamp.setAttribute('aria-label','출처 및 권리 안내');
 var source=document.createElement('a');source.href='https://coolzet-ai.github.io/stock/stock.html';source.textContent='출처: Mr.Kim Signal · coolzet-ai.github.io/stock';
 var rights=document.createElement('span');rights.textContent='© Mr.Kim Signal 구성·해설 · 데이터 권리: 각 제공처';stamp.append(source,rights);(document.querySelector('footer')||document.body).appendChild(stamp);
 function measureBottom(){
  var tabs=document.getElementById('mk-tabbar'), rect=tabs&&tabs.getBoundingClientRect();
  var tabHeight=tabs&&getComputedStyle(tabs).display!=='none'?rect.height:0;
  document.documentElement.style.setProperty('--stock-tabs-height',tabHeight+'px');
  document.documentElement.style.setProperty('--stock-stamp-height',stamp.getBoundingClientRect().height+'px');
 }
 if(window.ResizeObserver){var ro=new ResizeObserver(measureBottom);ro.observe(stamp);var tabs=document.getElementById('mk-tabbar');if(tabs)ro.observe(tabs);}
 window.addEventListener('resize',measureBottom);if(window.visualViewport){window.visualViewport.addEventListener('resize',measureBottom);window.visualViewport.addEventListener('scroll',measureBottom);}if(document.fonts)document.fonts.ready.then(measureBottom);measureBottom();

 var originalGift=document.getElementById('naver-gift-link');
 if(originalGift){var gift=document.createElement('a');gift.id='stock-gift';gift.href=originalGift.href;gift.target='_blank';gift.rel='noopener noreferrer';gift.setAttribute('aria-label','네이버페이 포인트 선물하기');gift.title='네이버페이 포인트 선물하기';gift.textContent='🎁';document.body.appendChild(gift);}
 var mark=document.createElement('div');mark.className='stock-capture-watermark';mark.setAttribute('aria-hidden','true');mark.textContent='Mr.Kim Signal · coolzet-ai.github.io';(document.querySelector('footer')||document.body).appendChild(mark);
 document.querySelectorAll('img').forEach(function(img){img.draggable=false;});
})();

;
/* Source: stock-common-v2.js */
function stockEscape(value){return String(value==null?'':value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function stockSafeURL(value){try{const u=new URL(String(value));return u.protocol==='https:'&&!u.username&&!u.password?stockEscape(u.href):'#';}catch(_){return '#';}}
/* 방문자 화면에는 개발용 진단 문구를 숨기고, 관리자 모드(mk_gate_off)에서만 대괄호로 덧붙인다 */
const devHint=m=>{ try{ return localStorage.getItem('mk_gate_off')==='1'?' ['+m+']':''; }catch(e){ return ''; } };
/* ===== 성능 보강(공통) =====
   1) 탭이 백그라운드(document.hidden)일 때는 주기 갱신(setInterval)을 건너뛴다 — 요청·배터리 절약.
   2) getJSON: 같은 URL은 45초간 결과 재사용(여러 위젯이 같은 시세를 중복 요청하는 것을 줄임) + 동시 요청 6개로 제한. */
(function(){
  if(window.__mkPerf) return; window.__mkPerf=1;
  var _si=window.setInterval.bind(window);
  /* 데이터 절약 모드: 사용자가 켰거나(mk_save=1), 브라우저가 데이터 절약·저속망(2G/3G)을 알리면 자동 갱신 주기를 3배로 */
  var __save=false; try{ var __sv=localStorage.getItem('mk_save'); __save=__sv==='1'; if(__sv===null){ var __cn=navigator.connection; if(__cn&&(__cn.saveData||/^(slow-2g|2g|3g)$/.test(__cn.effectiveType||''))) __save=true; } }catch(e){}
  window.MK_SAVE=__save; if(__save) document.documentElement.classList.add('mk-save');
  window.setInterval=function(fn,ms){ var a=Array.prototype.slice.call(arguments,2);
    if(typeof fn!=='function'||!(ms>=2000)) return _si.apply(null,arguments);
    if(__save&&ms<600000) ms=ms*3;
    return _si(function(){ if(document.hidden) return; fn.apply(null,a); },ms); };
})();
const __JC=new Map(), __JP=new Map(); let __jActive=0; const __jQ=[];
function __jSlot(){ return new Promise(function(res){ if(__jActive<6){ __jActive++; res(); } else __jQ.push(res); }); }
function __jFree(){ var n=__jQ.shift(); if(n) n(); else __jActive--; }
/* 상단 여백 축소: 메뉴↔제목, 제목↔첫 박스 간격 */
(function(){ try{ const st=document.createElement('style'); st.id='mk-toptight';
  st.textContent='main>section:first-of-type{padding-top:18px!important}main>section:first-of-type .sec-h{margin-bottom:0}main>section:first-of-type .sec-h .sub{margin-bottom:10px}@media(max-width:700px){main>section:first-of-type{padding-top:12px!important}}';
  document.head.appendChild(st);}catch(e){} })();
/* 모바일: 한글을 어절(띄어쓰기) 단위로 줄바꿈. 너무 긴 단어만 예외적으로 잘라 가로 넘침을 막는다 */
(function(){ try{ const st=document.createElement('style'); st.id='mk-wordbreak';
  st.textContent='@media(max-width:700px){body,body *{word-break:keep-all;overflow-wrap:break-word}}';
  document.head.appendChild(st);}catch(e){} })();
const $=s=>document.querySelector(s);
const PERKO={d:'일간',w:'주간',m:'월간',y:'연간'};
const curPer={kridx:'d',idxchg:'d',cap2:'d',krcap2:'d',krkq2:'d',us:'d',tick:'d',cap:'d',lev:'d',cf:'d',coin:'d',fx:'d',krcap:'d',krkq:'d',krlev:'d',
  usrel:'3m',caprel:'3m',krrel:'3m',krcaprel:'3m',cryrel:'3m'};
const fmt=n=>n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const sign=v=>(v>0?'+':'')+v.toFixed(2)+'%';
const arrowSign=v=>(v>0?'▲ +':(v<0?'▼ −':'— '))+Math.abs(v).toFixed(2)+'%';
const cls=v=>v>0?'up':(v<0?'down':'');

function zoneTag(t){const m={'극단적 공포':'#D92D20','공포':'#C2570C','중립':'#64748B','탐욕':'#4D7C0F','극단적 탐욕':'#15803D'};return '<span class="tag" style="background:'+(m[t]||'#64748B')+';color:#fff;font-weight:800;padding:2px 8px">'+t+'</span>';}
function label(v){
  v=Math.round(v); /* 화면에 보이는 정수 점수 기준으로 구간 판정(45 이상=중립) */
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
  if(tr){tr.innerHTML=trendSVG(arr);if(pre==='us'&&arr.length){const meta=document.createElement('div');meta.className='stock-trend-labels';[labels&&labels[0]||'기간 시작',labels&&labels[labels.length-1]||'최근', '최근 '+Number(arr[arr.length-1]).toFixed(1)+'점'].forEach(text=>{const span=document.createElement('span');span.textContent=text;meta.appendChild(span);});tr.appendChild(meta);}}
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

/* 코인 기술 지표(5일선·200일선·RSI 배지 + 코인명 앞 신호등) — Yahoo 1년 일봉(BTC-USD 등)으로 계산 */
const COIN_YSYM={bitcoin:'BTC-USD',ethereum:'ETH-USD',solana:'SOL-USD',ripple:'XRP-USD'};
const COIN_TECH={};
async function loadCoinTech(){
  const rows=Array.from(document.querySelectorAll('#coin-tbl .wl-row'));
  await Promise.all(rows.map(async row=>{
    const id=row.dataset.c, sym=COIN_YSYM[id]; if(!sym) return;
    try{
      if(!COIN_TECH[id]) COIN_TECH[id]=await yclose(sym,'1y');
      if(COIN_TECH[id]) renderTickBadges(row, COIN_TECH[id]);
    }catch(e){ console.warn('코인 기술지표 실패',id,e); }
  }));
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
    return '<span style="display:inline-flex;align-items:center;gap:6px;margin:0 14px 8px 0;font-size:13px;color:var(--tx2)">'+
      '<i style="width:9px;height:9px;border-radius:2px;background:'+CAP_COLORS10[i%10]+';display:inline-block"></i>'+
      e.label+' '+pct.toFixed(1)+'%</span>';
  }).join('');
  el.innerHTML='<div style="display:flex;height:20px;border-radius:6px;overflow:hidden">'+bars+'</div>'+
    '<div class="cap-lg" style="margin-top:10px;display:flex;flex-wrap:wrap">'+legend+'</div>';
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

/* ================= 상대수익률 비교 차트 (raoni.xyz 스타일 시각화 구체화) =================
   여러 종목·지수의 첫 값을 100으로 맞춰(rebase) 정규화하면, 절대 가격 단위가 달라도
   기간 내 상대적인 강약(어느 자산이 더 잘 버텼는지)을 한 차트에서 바로 비교할 수 있다.
   기존 yclose()로 이미 받아온 종가 배열과 miniLineChart()를 그대로 재사용한다.
   [로딩 안정성] 새 차트들이 같은 티커(SPY·^KS11·005930.KS 등)를 중복으로 프록시 호출하면
   무료 프록시가 동시 요청에 실패하기 쉬워, RELCACHE 하나를 모든 신규 차트가 공유하고
   이미 tickData(관심종목/TOP10 카드)에 있는 티커는 재요청하지 않는다. */
const RELCACHE={};
async function relFetch(t, range){
  if(tickData[t]) return tickData[t];
  if(RELCACHE[t]!==undefined) return RELCACHE[t];
  RELCACHE[t]=await yclose(t, range||'1y');
  return RELCACHE[t];
}
function rebase100(arr){
  if(!arr) return null;
  const first=arr.find(v=>v!=null);
  if(!first) return null;
  return arr.map(v=>v!=null?+(v/first*100).toFixed(3):null);
}
const REL_PERIOD_DAYS={'1m':21,'3m':63,'6m':126,'1y':252};
/* [상호작용] 평상시에는 모든 선을 흐릿하게(REL_DIM_OPACITY) 그리다가, 마우스를 선 근처/범례에
   올리면 그 종목만 진하고 굵게 강조한다. 범례의 체크박스를 해제하면 그 종목은 차트에서 빠지고
   (세로축 범위도 남은 종목 기준으로 다시 맞춘다), 기간 탭을 바꿔도 해제 상태가 유지된다. */
const REL_DIM_OPACITY=0.42;
const REL_HIDDEN={};   // elId -> {종목라벨: true}  (체크 해제된 종목)
const REL_LAST={};     // elId -> 마지막으로 그린 입력(체크박스 토글 시 재요청 없이 다시 그리기 위해 보관)
function relReturnChart(elId, series, loaded, opts){
  const el=document.getElementById(elId); if(!el) return;
  const built=series.map(s=>{
    const reb=s.values?rebase100(s.values):null;
    let last=null;
    if(reb) for(let i=reb.length-1;i>=0;i--){ if(reb[i]!=null){ last=reb[i]; break; } }
    const chg=last!=null?last-100:null;
    return {values:reb||[], color:s.color, width:s.width||2.2, key:s.label,
      chg:chg, label:s.label+(chg!=null?' '+sign(chg):' --')};
  }).filter(s=>s.values.length>1);
  if(!built.length){
    el.innerHTML=loaded
      ? '<p class="mut" style="font-size:12.5px">⚠ 데이터 연동 실패 — 프록시 응답이 없습니다. 새로고침해도 안 뜨면 콘솔(F12) 경고를 확인해주세요.</p>'
      : '<p class="mut" style="font-size:12.5px">불러오는 중…</p>';
    return;
  }
  REL_LAST[elId]={built:built, daily:!!(opts&&opts.daily)};
  relPaint(elId);
}
function relToggle(elId, bi, checked){
  const st=REL_LAST[elId]; if(!st) return;
  const hidden=REL_HIDDEN[elId]||(REL_HIDDEN[elId]={});
  const key=st.built[bi].key;
  if(checked) delete hidden[key]; else hidden[key]=true;
  relPaint(elId);
}
function relPaint(elId){
  const el=document.getElementById(elId), st=REL_LAST[elId]; if(!el||!st) return;
  const hidden=REL_HIDDEN[elId]||{};
  const built=st.built;
  const vis=built.filter(s=>!hidden[s.key]);
  // 가로축 날짜 라벨 — yclose()가 실제 거래일 타임스탬프를 주지 않으므로, 영업일수(1주=5거래일)로
  // 역산한 근사 날짜를 쓴다(참고용 표시로 충분 — 휴장일 등으로 하루이틀 오차가 있을 수 있다).
  const n=Math.max.apply(null,built.map(s=>s.values.length).concat([2]));
  const today=new Date();
  function calDate(i){
    const d=new Date(today.getTime()-Math.round((n-1-i)*(st.daily?1:7/5))*86400000);
    return (d.getMonth()+1)+'/'+d.getDate();
  }
  const mid=Math.floor((n-1)/2);
  const xLabels=[{i:0,text:calDate(0),anchor:'start'},{i:mid,text:calDate(mid),anchor:'middle'},{i:n-1,text:calDate(n-1),anchor:'end'}];
  // 범례는 직접 그리므로(체크박스) 차트에는 label을 넘기지 않는다
  const plain=vis.map(s=>({values:s.values, color:s.color, width:s.width, opacity:REL_DIM_OPACITY}));
  const chartHtml=vis.length
    ? miniLineChart(plain,{h:260,padL:54,padR:10,padTop:14,padBottom:22,
        axis:true, axisFmt:v=>(v-100>=0?'+':'')+(v-100).toFixed(1)+'%', xLabels})
    : '<p class="mut" style="font-size:12.5px;padding:60px 0;text-align:center">표시할 종목을 아래 범례에서 체크해주세요.</p>';
  const chips=built.map((s,bi)=>{
    const off=!!hidden[s.key];
    return '<label class="rel-chip" data-bi="'+bi+'" style="display:inline-flex;align-items:center;gap:5px;margin:0 14px 8px 0;font-size:13px;cursor:pointer;'+
        'color:'+(off?'var(--tx2)':'var(--tx)')+';opacity:'+(off?'.5':'1')+'">'+
      '<input type="checkbox" '+(off?'':'checked')+' data-stock-change="relToggle(\''+elId+'\','+bi+',this.checked)" style="margin:0;accent-color:'+s.color+'">'+
      '<i style="width:12px;height:3px;border-radius:2px;background:'+s.color+';display:inline-block"></i>'+
      '<span>'+s.label+'</span></label>';
  }).join('');
  el.innerHTML=
    '<div class="rel-readout mut" style="font-size:12.5px;min-height:18px;margin-bottom:4px"></div>'+
    chartHtml+
    '<div class="rel-chips" style="margin-top:8px;display:flex;flex-wrap:wrap">'+chips+'</div>';
  const svg=el.querySelector('svg.mlc');
  if(!svg) return;
  const g=k=>+svg.getAttribute('data-'+k);
  const W=g('w'),H=g('h'),padL=g('padl'),padR=g('padr'),padT=g('padt'),padB=g('padb'),mn=g('min'),mx=g('max'),nn=g('n');
  const stepX=nn>1?(W-padL-padR)/(nn-1):0;
  const yOf=v=>H-padB-((v-mn)/((mx-mn)||1))*(H-padT-padB);
  const paths=Array.from(svg.querySelectorAll('path.mlc-s'));
  const readout=el.querySelector('.rel-readout');
  const defText=readout.textContent;
  const NS='http://www.w3.org/2000/svg';
  const guide=document.createElementNS(NS,'line');
  guide.setAttribute('y1',padT); guide.setAttribute('y2',H-padB);
  guide.setAttribute('stroke','var(--tx2)'); guide.setAttribute('stroke-width','1'); guide.setAttribute('stroke-dasharray','3 3');
  guide.style.display='none'; svg.appendChild(guide);
  const dot=document.createElementNS(NS,'circle'); dot.setAttribute('r','4'); dot.style.display='none'; svg.appendChild(dot);
  function highlight(k,i){
    paths.forEach((p,idx)=>{
      const base=vis[idx].width||2.2;
      if(k<0){ p.setAttribute('opacity',REL_DIM_OPACITY); p.setAttribute('stroke-width',base); }
      else if(idx===k){ p.setAttribute('opacity',1); p.setAttribute('stroke-width',base+1.3); p.parentNode.appendChild(p); }
      else { p.setAttribute('opacity',0.12); p.setAttribute('stroke-width',base); }
    });
    el.querySelectorAll('.rel-chip').forEach(c=>{
      const s=built[+c.dataset.bi];
      const idx=vis.indexOf(s);
      c.style.fontWeight=(k>=0 && idx===k)?'800':'400';
    });
    if(k<0){ readout.textContent=defText; guide.style.display='none'; dot.style.display='none'; return; }
    const s=vis[k], v=s.values[i];
    readout.innerHTML='<b style="color:'+s.color+'">'+s.key+'</b> · '+calDate(i)+' · '+(v!=null?sign(v-100):'--')+' (기간 시작=100 대비)';
    guide.setAttribute('x1',padL+i*stepX); guide.setAttribute('x2',padL+i*stepX); guide.style.display='';
    if(v!=null){ dot.setAttribute('cx',padL+i*stepX); dot.setAttribute('cy',yOf(v)); dot.setAttribute('fill',s.color); dot.style.display=''; }
    else dot.style.display='none';
  }
  svg.style.cursor='crosshair';
  svg.addEventListener('mousemove',ev=>{
    const r=svg.getBoundingClientRect(); if(!r.width) return;
    const vx=(ev.clientX-r.left)/r.width*W, vy=(ev.clientY-r.top)/r.height*H;
    const i=Math.max(0,Math.min(nn-1,Math.round((vx-padL)/(stepX||1))));
    let best=-1, bd=1e9;
    vis.forEach((s,k)=>{ const v=s.values[i]; if(v==null) return; const d=Math.abs(yOf(v)-vy); if(d<bd){ bd=d; best=k; } });
    highlight(best,i);
  });
  svg.addEventListener('mouseleave',()=>highlight(-1));
  // 범례에 마우스를 올려도 해당 종목 강조
  el.querySelectorAll('.rel-chip').forEach(c=>{
    c.addEventListener('mouseenter',()=>{
      const k=vis.indexOf(built[+c.dataset.bi]);
      if(k>=0) highlight(k, vis[k].values.length-1);
    });
    c.addEventListener('mouseleave',()=>highlight(-1));
  });
}
/* 시가총액 TOP10 카드(cap/krcap)의 순위·색상 순서를 그대로 상대수익률 비교 시리즈로 변환 */
function capRelDefsFromGroup(group, capData){
  const cfg=TICKGROUPS[group]; if(!cfg) return [];
  return cfg.list.map((t,i)=>({t, label:(capData[i]?capData[i].label:t), color:CAP_COLORS10[i%10]}));
}
function renderCapRelCompare(elId, group, capData, period){
  const defs=capRelDefsFromGroup(group, capData);
  const days=REL_PERIOD_DAYS[period]||126;
  const series=defs.map(d=>({label:d.label, color:d.color, values:tickData[d.t]?tickData[d.t].slice(-days):null}));
  relReturnChart(elId, series, true);
}

/* 미국 주요 지수 ETF 상대수익률 비교 (S&P500·나스닥100·다우존스·러셀2000·반도체) */
const IDXREL_DEFS_US=[
  {t:'SPY', label:'S&P500(SPY)', color:'#ffb020'},
  {t:'QQQ', label:'나스닥100(QQQ)', color:'#3d9dff'},
  {t:'DIA', label:'다우존스(DIA)', color:'#22c55e'},
  {t:'IWM', label:'러셀2000(IWM)', color:'#ff4d4f'},
  {t:'SOXX', label:'반도체(SOXX)', color:'#c084fc'}
];
async function loadIdxRelUS(){
  await Promise.all(IDXREL_DEFS_US.map(d=>relFetch(d.t,'1y')));
  renderIdxRelUS(curPer.usrel);
}
function renderIdxRelUS(period){
  const days=REL_PERIOD_DAYS[period]||126;
  const series=IDXREL_DEFS_US.map(d=>{
    const c=tickData[d.t]||RELCACHE[d.t];
    return {label:d.label, color:d.color, values:c?c.slice(-days):null};
  });
  relReturnChart('us-idxrel-chart', series, true);
}

/* 한국 지수·대표종목 상대수익률 비교 (코스피·코스닥·삼성전자·SK하이닉스) */
const IDXREL_DEFS_KR=[
  {t:'^KS11', label:'코스피(KOSPI)', color:'#ffb020'},
  {t:'^KQ11', label:'코스닥(KOSDAQ)', color:'#3d9dff'},
  {t:'005930.KS', label:'삼성전자', color:'#22c55e'},
  {t:'000660.KS', label:'SK하이닉스', color:'#ff4d4f'}
];
async function loadIdxRelKR(){
  await Promise.all(IDXREL_DEFS_KR.map(d=>relFetch(d.t,'1y')));
  renderIdxRelKR(curPer.krrel);
}
function renderIdxRelKR(period){
  const days=REL_PERIOD_DAYS[period]||126;
  const series=IDXREL_DEFS_KR.map(d=>{
    const c=tickData[d.t]||RELCACHE[d.t];
    return {label:d.label, color:d.color, values:c?c.slice(-days):null};
  });
  relReturnChart('kr-idxrel-chart', series, true);
}


/* ===================== 가상화폐 — Npay 증권 글로벌 마켓 트렌드 + 4대 코인 상대수익률 ===================== */
function cryGaugeSvg(v){
  // 반원 게이지(0~100, 보라→빨강). 바늘 대신 현재값 위치에 흰 점을 찍는다.
  const cx=80, cy=84, r=62, a=Math.PI*(1-Math.max(0,Math.min(100,v))/100);
  const pt=(ang,rad)=>[cx+rad*Math.cos(ang), cy-rad*Math.sin(ang)];
  const stops=['#8e5cf0','#6a7df0','#3fb6a8','#f0b429','#ef7a2f','#e5332a'];
  let segs='';
  const N=stops.length;
  for(let i=0;i<N;i++){
    const a0=Math.PI*(1-i/N), a1=Math.PI*(1-(i+1)/N);
    const [x0,y0]=pt(a0,r), [x1,y1]=pt(a1,r);
    segs+='<path d="M'+x0.toFixed(1)+' '+y0.toFixed(1)+' A'+r+' '+r+' 0 0 1 '+x1.toFixed(1)+' '+y1.toFixed(1)+'" stroke="'+stops[i]+'" stroke-width="16" fill="none"/>';
  }
  const [px,py]=pt(a,r);
  return '<svg viewBox="0 0 160 100" style="width:100%;max-width:190px;display:block;margin:0 auto">'+segs+
    '<circle cx="'+px.toFixed(1)+'" cy="'+py.toFixed(1)+'" r="6" fill="#fff" stroke="#999" stroke-width="1.5"/>'+
    '<text x="80" y="76" text-anchor="middle" font-size="30" font-weight="800" fill="var(--tx)">'+v+'</text>'+
    '<text x="80" y="94" text-anchor="middle" font-size="13" font-weight="800" fill="var(--tx2)" id="cry-fg-lbl"></text>'+
    '<text x="4" y="99" font-size="11" font-weight="700" fill="var(--tx2)">0</text><text x="128" y="99" font-size="11" font-weight="700" fill="var(--tx2)">100</text></svg>';
}
function renderCryptoGlobalTrend(d){
  const el=document.getElementById('cry-global-trend'); if(!el) return;
  if(!d||!d.fearAndGreed){
    el.innerHTML='<p class="mut" style="font-size:12.5px">⚠ 글로벌 마켓 트렌드를 일시적으로 불러오지 못했습니다. 잠시 후 새로고침해 주세요.'+devHint('/coin-global-trend 라우트 배포 확인')+'</p>';
    return;
  }
  const fg=d.fearAndGreed, gl=d.gainersLosers||{}, dom=d.coinDominance||{}, alt=d.altcoinSeasonIndex;
  const tot=(gl.gainersCount||0)+(gl.flatCount||0)+(gl.losersCount||0)||1;
  const wUp=(gl.gainersCount||0)/tot*100, wFlat=(gl.flatCount||0)/tot*100, wDn=(gl.losersCount||0)/tot*100;
  const btc=dom.btcDominance||0, eth=dom.ethDominance||0, oth=dom.othersDominance||0;
  const colBox='flex:1 1 200px;min-width:190px;padding:4px 16px;border-left:1px solid var(--line)';
  const row=(c,l,v,vc)=>'<div style="display:flex;justify-content:space-between;align-items:center;font-size:13.5px;margin-top:10px"><span style="display:inline-flex;align-items:center;gap:7px"><i style="width:8px;height:8px;border-radius:50%;background:'+c+';display:inline-block"></i>'+l+'</span><b style="color:'+vc+'">'+Number(v).toLocaleString('ko-KR')+'</b></div>';
  const altPos=Math.max(2,Math.min(98,alt||0));
  el.innerHTML='<div style="display:flex;flex-wrap:wrap;gap:12px 0">'+
    '<div style="flex:1 1 190px;min-width:180px;padding:4px 16px 4px 0">'+
      '<div style="font-size:13px;font-weight:800">공포·탐욕지수</div>'+cryGaugeSvg(fg.value)+'</div>'+
    '<div style="'+colBox+'">'+
      '<div style="display:flex;justify-content:space-between;font-size:13px;font-weight:800"><span>상승 자산 비중</span><span style="font-size:15px">'+(gl.gainersRatio!=null?gl.gainersRatio.toFixed(2):wUp.toFixed(2))+'%</span></div>'+
      '<div style="display:flex;height:5px;margin-top:10px;border-radius:3px;overflow:hidden"><div style="width:'+wUp+'%;background:var(--up)"></div><div style="width:'+wFlat+'%;background:#aaa"></div><div style="width:'+wDn+'%;background:var(--down)"></div></div>'+
      row('var(--up)','상승',gl.gainersCount||0,'var(--up)')+row('#999','보합',gl.flatCount||0,'var(--tx2)')+row('var(--down)','하락',gl.losersCount||0,'var(--down)')+
    '</div>'+
    '<div style="'+colBox+'">'+
      '<div style="display:flex;justify-content:space-between;font-size:13px;font-weight:800"><span>비트코인 도미넌스</span><span style="font-size:15px">'+btc.toFixed(2)+'%</span></div>'+
      '<div style="display:flex;height:22px;margin-top:10px;border-radius:5px;overflow:hidden;font-size:0"><div style="width:'+btc+'%;background:#f7931a"></div><div style="width:'+eth+'%;background:#627eea"></div><div style="width:'+oth+'%;background:#c9c9c9"></div></div>'+
      '<div style="margin-top:8px;font-size:12px;color:var(--tx2);display:flex;flex-wrap:wrap;gap:4px 12px">'+
        '<span><i style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#f7931a"></i> 비트코인 '+btc.toFixed(1)+'%</span>'+
        '<span><i style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#627eea"></i> 이더리움 '+eth.toFixed(1)+'%</span>'+
        '<span><i style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#c9c9c9"></i> 기타 '+oth.toFixed(1)+'%</span></div>'+
      '<div style="display:flex;justify-content:space-between;font-size:13px;font-weight:800;margin-top:18px"><span>알트코인 시즌 지수</span><span style="font-size:15px">'+(alt!=null?alt:'--')+'<span style="font-weight:400;color:var(--tx2)">/100</span></span></div>'+
      '<div style="position:relative;height:8px;margin-top:10px;border-radius:4px;background:linear-gradient(90deg,#f7931a 0,#f7931a 25%,#f5a623 25%,#f5a623 75%,#c9c9c9 75%)"><i style="position:absolute;left:'+altPos+'%;top:-2px;width:12px;height:12px;margin-left:-6px;border-radius:50%;background:#fff;border:2px solid #888"></i></div>'+
      '<div style="display:flex;justify-content:space-between;font-size:11.5px;color:var(--tx2);margin-top:6px"><span>비트코인 시즌</span><span>알트코인 시즌</span></div>'+
    '</div>'+
  '</div>';
  const lbl=document.getElementById('cry-fg-lbl'); if(lbl) lbl.textContent=fg.valueClassification||'';
}
async function loadCryptoGlobalTrend(){
  if(!PROXY_BASE){ renderCryptoGlobalTrend(null); return; }
  try{
    const origin=PROXY_BASE.replace(/\?url=$/,'');
    const r=await fetch(origin+'coin-global-trend',{signal:AbortSignal.timeout?AbortSignal.timeout(15000):undefined});
    renderCryptoGlobalTrend(r.ok?await r.json():null);
  }catch(e){ console.warn('coin-global-trend 실패:',e.message); renderCryptoGlobalTrend(null); }
}

/* 4대 코인 상대수익률 비교 — 코인은 24시간·365일 거래라 달력일 기준(1개월=30일 등)으로 자른다 */
const CRYREL_DEFS=[
  {t:'BTC-USD', label:'비트코인(BTC)', color:'#f7931a'},
  {t:'ETH-USD', label:'이더리움(ETH)', color:'#627eea'},
  {t:'SOL-USD', label:'솔라나(SOL)', color:'#14c98a'},
  {t:'XRP-USD', label:'리플(XRP)', color:'#00aae4'}
];
const CRYREL_DAYS={'1m':30,'3m':90,'6m':180,'1y':365};
async function loadCryptoRel(){
  await Promise.all(CRYREL_DEFS.map(d=>relFetch(d.t,'1y')));
  renderCryptoRel(curPer.cryrel);
}
function renderCryptoRel(period){
  const days=CRYREL_DAYS[period]||90;
  const series=CRYREL_DEFS.map(d=>{
    const c=tickData[d.t]||RELCACHE[d.t];
    return {label:d.label, color:d.color, values:c?c.slice(-days):null};
  });
  relReturnChart('cry-rel-chart', series, true, {daily:true});
}

/* 이벤트 캘린더(MONTH_EVENTS/KR_MONTH_EVENTS)에서 오늘 이후 가장 가까운 일정을 찾아
   상단에 "다음 이벤트" 배너로 보여준다. hol:1(휴장일)은 opts.excludeHoliday로 제외 가능. */
function renderNextEventBanner(elId, monthEvents, opts){
  const el=document.getElementById(elId); if(!el) return;
  opts=opts||{};
  const now=new Date();
  const today=new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const list=[];
  Object.keys(monthEvents).forEach(mKey=>{
    const m=+mKey;
    (monthEvents[mKey]||[]).forEach(ev=>{
      if(opts.excludeHoliday && ev.hol) return;
      const dt=new Date(now.getFullYear(), m-1, ev.d);
      if(dt<today) return;
      list.push({ev, m, dt});
    });
  });
  list.sort((a,b)=>a.dt-b.dt);
  const lim=new Date(today.getTime()+30*86400000);
  let shown=list.filter(x=>x.dt<=lim).slice(0,6);
  if(!shown.length) shown=list.slice(0,1);
  if(!shown.length){ el.style.display='none'; return; }
  const row=(x,first)=>{
    const dday=Math.round((x.dt-today)/86400000), dtext=dday===0?'오늘':'D-'+dday;
    const gc={h:'var(--up)',m:'var(--accent)',l:'var(--tx2)'}[x.ev.g]||'var(--tx2)';
    return '<div class="nev-row nev-'+(x.ev.g||'l')+'" style="display:flex;align-items:center;gap:12px;'+(first?'':'padding-top:10px;margin-top:10px;border-top:1px dashed var(--line);')+'">'+
      '<span class="tag" style="background:'+gc+';color:#fff;flex:none;min-width:44px;text-align:center">'+dtext+'</span>'+
      '<div style="flex:1;min-width:0"><div style="font-weight:800;font-size:14px;line-height:1.4">'+x.ev.t+'</div>'+
      '<div class="mut" style="font-size:12px;margin-top:2px;line-height:1.4">'+x.m+'월 '+x.ev.d+'일 · '+x.ev.c+'</div></div>'+
      (x.ev.s?'<a href="'+x.ev.s+'" target="_blank" rel="noopener" class="mut" style="font-size:12px;text-decoration:underline;flex:none">출처</a>':'')+'</div>';
  };
  const rest=shown.slice(1);
  el.style.display='block';
  el.innerHTML='<div class="nev-hd" style="font-size:12.5px;font-weight:900;color:var(--accent);margin-bottom:8px">📅 주요 일정</div>'+row(shown[0],true)+
    (rest.length?'<div class="ev-more" style="display:none">'+rest.map(x=>row(x,false)).join('')+'</div>'+
      '<button type="button" class="ev-more-btn cal-more-btn" style="margin-top:10px;width:100%;padding:7px 10px;border:1px solid var(--line);border-radius:10px;background:var(--panel2);color:var(--accent);font-weight:800;font-size:12.5px;cursor:pointer">자세히 보기 ▾ (+'+rest.length+'건)</button>':'');
  const b=el.querySelector('.ev-more-btn');
  if(b) b.onclick=function(){ const m=el.querySelector('.ev-more'); const o=m.style.display==='none'; m.style.display=o?'block':'none'; b.textContent=o?'접기 ▴':'자세히 보기 ▾ (+'+rest.length+'건)'; };
}

/* 한국 수급 플로우 시각화 — Worker가 코스피·코스닥 전종목을 집계한 상승/하락 거래대금 비율과
   52주 신고가/신저가 종목수를, 숫자(스코어) 하나로만 보여주던 기존 표에 더해 막대그래프로도
   보여준다(raoni.xyz의 수급 흐름 표시를 참고해 구체화). */
function renderBreadthFlow(elId, breadth){
  const el=document.getElementById(elId); if(!el) return;
  if(!breadth || (!breadth.breadth && !breadth.strength)){
    el.innerHTML='<p class="mut" style="font-size:12px">코스피·코스닥 전종목 수급 데이터 준비 중입니다. 하루 1회 집계되며 곧 표시됩니다.</p>';
    return;
  }
  let html='<div style="font-size:13px;font-weight:800;margin-bottom:10px">📊 시장 수급 현황 <span class="mut" style="font-weight:400;font-size:11.5px">(7개 지표 중 2·3번 근거)</span></div>';
  if(breadth.breadth){
    const {advVol,declVol}=breadth.breadth;
    const total=(advVol||0)+(declVol||0)||1;
    const advPct=(advVol||0)/total*100, declPct=100-advPct;
    html+='<div style="margin-bottom:14px">'+
      '<div style="display:flex;justify-content:space-between;font-size:12px;color:var(--tx2);margin-bottom:5px">'+
        '<span style="color:var(--up);font-weight:700">▲ 상승종목 거래대금 '+advPct.toFixed(1)+'%</span>'+
        '<span style="color:var(--down);font-weight:700">▼ 하락종목 거래대금 '+declPct.toFixed(1)+'%</span></div>'+
      '<div style="display:flex;height:18px;border-radius:9px;overflow:hidden;background:var(--panel)">'+
        '<div style="width:'+advPct.toFixed(2)+'%;background:var(--up)"></div>'+
        '<div style="width:'+declPct.toFixed(2)+'%;background:var(--down)"></div>'+
      '</div></div>';
  }
  if(breadth.strength){
    const {highs,lows}=breadth.strength;
    const total=(highs||0)+(lows||0)||1;
    const hiPct=(highs||0)/total*100, loPct=100-hiPct;
    html+='<div>'+
      '<div style="display:flex;justify-content:space-between;font-size:12px;color:var(--tx2);margin-bottom:5px">'+
        '<span style="color:var(--ok);font-weight:700">52주 신고가 '+(highs||0)+'종목 ('+hiPct.toFixed(1)+'%)</span>'+
        '<span style="color:var(--tx2);font-weight:700">52주 신저가 '+(lows||0)+'종목 ('+loPct.toFixed(1)+'%)</span></div>'+
      '<div style="display:flex;height:18px;border-radius:9px;overflow:hidden;background:var(--panel)">'+
        '<div style="width:'+hiPct.toFixed(2)+'%;background:var(--ok)"></div>'+
        '<div style="width:'+loPct.toFixed(2)+'%;background:#5b6b85"></div>'+
      '</div></div>';
  }
  el.innerHTML=html;
}

/* ================= 한국지수 "투자자 동향" / "증시자금동향" (Npay 증권) =================
   stock.naver.com(Npay 증권)이 공개하는 지수별 투자자 순매수와 증시자금 추이를
   Worker(/kr-investor-trend, /kr-investor-history, /kr-market-deposit)가 CORS 중계해준다.
   - 투자자 동향: 1일(네이버 공식 요약값) / 1주·1개월·3개월(일별 이력을 합산한 누적 순매수)
   - 막대는 0을 정중앙에 둔 위·아래 대칭 축(세로 범례)으로 순매수(▲ 빨강)·순매도(▼ 파랑)를 구분한다.
   - 증시자금동향: 5개 지표 카드마다 가로(날짜)·세로(금액) 범례를 가진 추이선을 그린다. */
let krInvestorMarket='KOSPI';
let krInvestorPeriod='1d';   // '1d'|'1w'|'1m'|'3m'
let krDepositPeriod='3m';    // '1w'|'1m'|'3m'
let krDepositRows=null;
const KR_FLOW_DAYS={'1w':5,'1m':21,'3m':63};
const KR_PERIOD_LABEL={'1d':'1일','1w':'1주','1m':'1개월','3m':'3개월'};
const KR_INV_HIST={};        // market -> {t:타임스탬프, rows:[...]}
function krOrigin(){ return PROXY_BASE.replace(/\?url=$/,''); }
async function loadKrInvestorTrend(market){
  try{
    const r=await fetch(krOrigin()+'kr-investor-trend?market='+market,{signal:AbortSignal.timeout?AbortSignal.timeout(10000):undefined});
    if(!r.ok) return null;
    const j=await r.json();
    return (j && j.bizdate)?j:null;
  }catch(e){ console.warn('투자자 동향 로딩 실패:', e); return null; }
}
async function loadKrInvestorHistory(market){
  const c=KR_INV_HIST[market];
  if(c && Date.now()-c.t<5*60*1000) return c.rows;
  try{
    const r=await fetch(krOrigin()+'kr-investor-history?market='+market+'&size=70',{signal:AbortSignal.timeout?AbortSignal.timeout(15000):undefined});
    if(!r.ok) return null;
    const j=await r.json();
    if(!Array.isArray(j)||!j.length) return null;
    KR_INV_HIST[market]={t:Date.now(), rows:j};
    return j;
  }catch(e){ console.warn('투자자 동향 이력 로딩 실패:', e); return null; }
}
function parseKrAmt(s){ // "+2,654" / "-986" 같은 네이버 표기 문자열 → 숫자(억원)
  if(s==null) return null;
  const n=Number(String(s).replace(/,/g,''));
  return isFinite(n)?n:null;
}
function fmtKrDate(bizdate){
  return bizdate?String(bizdate).replace(/^(\d{4})(\d{2})(\d{2})$/,'$1. $2. $3.'):'';
}
function fmtKrMD(bizdate){
  const m=/^(\d{4})(\d{2})(\d{2})$/.exec(String(bizdate||'')); return m?(+m[2])+'/'+(+m[3]):'';
}
/* 억원 단위 값을 읽기 쉽게: 1만억 이상은 조 단위로 */
function fmtEok(v, signed){
  if(v==null||!isFinite(v)) return '--';
  const a=Math.abs(v), s=v<0?'-':(signed&&v>0?'+':'');
  if(a>=10000) return s+(a/10000).toFixed(a>=100000?1:2)+'조';
  return s+Math.round(a).toLocaleString('ko-KR')+'억';
}
/* 0을 정중앙에 둔 대칭 세로 막대 — 위=순매수(빨강), 아래=순매도(파랑), 세로축 범례 5눈금 */
function krDivergingBars(bars){
  const W=340,H=256,padL=62,padR=12,padT=32,padB=38;
  const maxAbs=Math.max(1,...bars.map(b=>Math.abs(b.v||0)));
  const mag=Math.pow(10,Math.floor(Math.log10(maxAbs)));
  let M=mag*10;
  for(const c of [1,1.5,2,2.5,3,4,5,6,8,10]){ if(c*mag>=maxAbs*1.3){ M=c*mag; break; } }
  const plotH=H-padT-padB;
  const yOf=v=>padT+(M-v)/(2*M)*plotH;
  const y0=yOf(0);
  let svg='<svg viewBox="0 0 '+W+' '+H+'" style="width:100%;height:auto;max-width:560px;display:block;margin:0 auto">';
  // 눈금선 + 세로 범례
  [M,M/2,0,-M/2,-M].forEach(t=>{
    const y=yOf(t);
    svg+='<line x1="'+padL+'" y1="'+y.toFixed(1)+'" x2="'+(W-padR)+'" y2="'+y.toFixed(1)+'" stroke="'+(t===0?'var(--tx2)':'var(--line)')+'" stroke-width="'+(t===0?1.4:1)+'"'+(t===0?'':' stroke-dasharray="2 3"')+'/>';
    svg+='<text x="'+(padL-6)+'" y="'+(y+3).toFixed(1)+'" text-anchor="end" font-size="11.5" fill="var(--tx2)"'+(t===0?' font-weight="800"':' font-weight="600"')+'>'+(t===0?'0':fmtEok(t,true))+'</text>';
  });
  svg+='<text x="'+(padL-6)+'" y="'+(padT-16)+'" text-anchor="end" font-size="11.5" fill="var(--up)" font-weight="800">▲ 순매수</text>';
  svg+='<text x="'+(padL-6)+'" y="'+(H-padB+18)+'" text-anchor="end" font-size="11.5" fill="var(--down)" font-weight="800">▼ 순매도</text>';
  const slot=(W-padL-padR)/bars.length, bw=slot*0.42;
  bars.forEach((b,i)=>{
    const cx=padL+slot*(i+0.5);
    if(b.v==null){
      svg+='<text x="'+cx+'" y="'+(y0-6)+'" text-anchor="middle" font-size="11" fill="var(--tx2)">--</text>';
    }else{
      const y=yOf(b.v), up=b.v>=0, col=up?'var(--up)':'var(--down)';
      svg+='<rect x="'+(cx-bw/2).toFixed(1)+'" y="'+Math.min(y,y0).toFixed(1)+'" width="'+bw.toFixed(1)+'" height="'+Math.max(1,Math.abs(y-y0)).toFixed(1)+'" rx="3" fill="'+col+'"/>';
      svg+='<text x="'+cx.toFixed(1)+'" y="'+(up?y-5:y+13).toFixed(1)+'" text-anchor="middle" font-size="12.5" font-weight="800" fill="'+col+'">'+fmtEok(b.v,true)+'</text>';
    }
    svg+='<text x="'+cx.toFixed(1)+'" y="'+(H-8)+'" text-anchor="middle" font-size="13" font-weight="700" fill="var(--tx)">'+b.name+'</text>';
  });
  return svg+'</svg>';
}
function renderKrInvestorBlock(title, bars, series, xLabels, lampsHtml){
  const el=document.getElementById('kr-investor-trend'); if(!el) return;
  let html=(lampsHtml||'')+'<div class="mut" style="font-size:11.5px;margin-bottom:6px">'+title+' · 단위 억원(1만억 이상은 조)</div>'+krDivergingBars(bars);
  if(series){
    html+='<div class="mut" style="font-size:11.5px;margin:14px 0 4px">기간 중 누적 순매수 추이 (0선 위=누적 매수 우위, 아래=매도 우위)</div>'+
      miniLineChart(series,{h:170,padL:52,padR:8,padTop:12,padBottom:18,zeroLine:true,axis:true,axisFmt:v=>fmtEok(v,true),xLabels:xLabels});
  }
  el.innerHTML=html;
}
/* 투자자 주체별 신호등 — 선택한 기간과 무관하게 최근 5영업일 누적 + 당일 순매수 방향으로 판정한다
   (둘 다 순매수=🟢 순매수 우위 / 둘 다 순매도=🔴 순매도 우위 / 엇갈림=🟡 혼조) */
function krInvestorLamps(h){
  if(!h||h.length<5) return '';
  const rows5=h.slice(-5), today=h[h.length-1];
  const defs=[['개인','personal'],['외국인','foreign'],['기관','institutional']];
  const cells=[], head=[];
  defs.forEach(([nm,k])=>{
    const s5=rows5.reduce((a,r)=>a+(r[k]||0),0), t=today[k]||0;
    const lv=(s5>0&&t>0)?{i:'🟢',t:'순매수 우위',c:'var(--up)'}:(s5<0&&t<0)?{i:'🔴',t:'순매도 우위',c:'var(--down)'}:{i:'🟡',t:'혼조',c:'var(--tx2)'};
    head.push(nm+' <em style="color:'+lv.c+'">'+lv.t+'</em>');
    cells.push('<div class="kr-sc" style="--c:'+lv.c+'" title="최근 5영업일 누적 '+fmtEok(s5)+' / 당일 '+fmtEok(t)+'\n둘 다 순매수 🟢 · 둘 다 순매도 🔴 · 엇갈림 🟡"><small>'+nm+'</small><b>'+lv.i+' '+lv.t+'</b><span>5일 '+fmtEok(s5,true)+' · 당일 '+fmtEok(t,true)+'</span></div>');
  });
  return '<div class="kr-sum"><p class="kr-sline"><b>핵심 요약</b> 최근 5영업일 · '+head.join(' · ')+'</p><div class="kr-sg kr-sg3">'+cells.join('')+'</div></div>';
}
async function refreshKrInvestor(){
  const el=document.getElementById('kr-investor-trend'); if(!el) return;
  const m=krInvestorMarket, p=krInvestorPeriod;
  el.innerHTML='<p class="mut" style="font-size:12.5px">불러오는 중…</p>';
  const NOTE='<p class="mut" style="font-size:12.5px">투자자 동향 데이터를 일시적으로 가져오지 못했습니다. 잠시 후 다시 확인해 주세요.'+devHint('/kr-investor-trend, /kr-investor-history 배포 확인')+'</p>';
  if(p==='1d'){
    let t=await loadKrInvestorTrend(m);
    let bars=null, date=null;
    if(t){ bars=[{name:'개인',v:parseKrAmt(t.personal)},{name:'외국인',v:parseKrAmt(t.foreign)},{name:'기관',v:parseKrAmt(t.institutional)}]; date=t.bizdate; }
    else{
      const h=await loadKrInvestorHistory(m);
      if(h && h.length){ const r=h[h.length-1]; bars=[{name:'개인',v:r.personal},{name:'외국인',v:r.foreign},{name:'기관',v:r.institutional}]; date=r.bizdate; }
    }
    if(!bars){ el.innerHTML=NOTE; return; }
    const h1=await loadKrInvestorHistory(m);
    renderKrInvestorBlock(fmtKrDate(date)+' 기준 당일 순매수', bars, null, null, krInvestorLamps(h1));
    return;
  }
  const h=await loadKrInvestorHistory(m);
  if(!h || !h.length){ el.innerHTML=NOTE; return; }
  const rows=h.slice(-KR_FLOW_DAYS[p]);
  const sum=k=>rows.reduce((s,r)=>s+(r[k]||0),0);
  const bars=[{name:'개인',v:sum('personal')},{name:'외국인',v:sum('foreign')},{name:'기관',v:sum('institutional')}];
  const cum=k=>{ let s=0; return rows.map(r=>(s+=(r[k]||0))); };
  const series=[{values:cum('personal'),color:'#f59e0b',width:2,label:'개인'},
                {values:cum('foreign'),color:'#3d9dff',width:2,label:'외국인'},
                {values:cum('institutional'),color:'#16a34a',width:2,label:'기관'}];
  const n=rows.length, mid=Math.floor((n-1)/2);
  const xl=[{i:0,text:fmtKrMD(rows[0].bizdate),anchor:'start'},{i:mid,text:fmtKrMD(rows[mid].bizdate),anchor:'middle'},{i:n-1,text:fmtKrMD(rows[n-1].bizdate),anchor:'end'}];
  renderKrInvestorBlock('최근 '+KR_PERIOD_LABEL[p]+'('+n+'영업일, '+fmtKrDate(rows[0].bizdate)+' ~ '+fmtKrDate(rows[n-1].bizdate)+') 누적 순매수', bars, series, xl, krInvestorLamps(h));
}
function setKrInvestorMarket(market){
  krInvestorMarket=market;
  document.querySelectorAll('.kr-investor-market-btn').forEach(b=>b.classList.toggle('on', b.dataset.m===market));
  refreshKrInvestor();
}
function setKrInvestorPeriod(p){
  krInvestorPeriod=p;
  document.querySelectorAll('.kr-investor-period-btn').forEach(b=>b.classList.toggle('on', b.dataset.p===p));
  refreshKrInvestor();
}

async function loadKrMarketDeposit(size){
  try{
    const r=await fetch(krOrigin()+'kr-market-deposit?size='+(size||70),{signal:AbortSignal.timeout?AbortSignal.timeout(12000):undefined});
    if(!r.ok) return null;
    const j=await r.json();
    return (Array.isArray(j)&&j.length)?j:null;
  }catch(e){ console.warn('증시자금동향 로딩 실패:', e); return null; }
}
function setKrDepositPeriod(p){
  krDepositPeriod=p;
  document.querySelectorAll('.kr-deposit-period-btn').forEach(b=>b.classList.toggle('on', b.dataset.p===p));
  renderKrMarketDeposit(krDepositRows);
}
function renderKrMarketDeposit(rows){
  const el=document.getElementById('kr-market-deposit'); if(!el) return;
  if(!rows || !rows.length){
    el.innerHTML='<p class="mut" style="font-size:12.5px">증시자금동향 데이터를 일시적으로 가져오지 못했습니다. 잠시 후 다시 확인해 주세요.'+devHint('/kr-market-deposit 배포 확인')+'</p>';
    return;
  }
  const win=rows.slice(-(KR_FLOW_DAYS[krDepositPeriod]+1)); // 기간 시작 기준점 1개 포함
  const last=win[win.length-1], first=win[0];
  const metrics=[
    ['고객예탁금','customerDeposit','customerDepositDiff'],
    ['신용잔고','creditLoan','creditLoanDiff'],
    ['주식형펀드','stockFund','stockFundDiff'],
    ['혼합형펀드','mixedFund','mixedFundDiff'],
    ['채권형펀드','bondFund','bondFundDiff']
  ];
  const n=win.length, mid=Math.floor((n-1)/2);
  const xl=[{i:0,text:fmtKrMD(first.bizdate),anchor:'start'},{i:mid,text:fmtKrMD(win[mid].bizdate),anchor:'middle'},{i:n-1,text:fmtKrMD(last.bizdate),anchor:'end'}];
  // 3개월 추이 신호등 — 선택한 기간과 무관하게 항상 최근 3개월 변화율로 판정한다
  const win3=rows.slice(-((KR_FLOW_DAYS['3m']||62)+1));
  function lampFor(key){
    const f0=win3[0][key], l0=win3[win3.length-1][key];
    if(!f0||l0==null||win3.length<10) return null;
    const ch=(l0-f0)/f0*100;
    let lv;
    if(key==='customerDeposit'){
      lv=ch>=5?{i:'🟢',t:'유입 증가',c:'var(--up)'}:ch<=-5?{i:'🔴',t:'유출 감소',c:'var(--down)'}:{i:'🟡',t:'보합권',c:'var(--tx2)'};
    }else{
      lv=ch>=8?{i:'🔴',t:'과열 주의',c:'var(--up)'}:ch<=-3?{i:'🟢',t:'부담 완화',c:'var(--down)'}:{i:'🟡',t:'보합권',c:'var(--tx2)'};
    }
    const rule=key==='customerDeposit'
      ?'고객예탁금 3개월 변화율 기준: +5% 이상 🟢(대기자금 유입) / -5% 이하 🔴(자금 이탈) / 그 외 🟡'
      :'신용잔고 3개월 변화율 기준: +8% 이상 🔴(빚투 과열) / -3% 이하 🟢(레버리지 부담 완화) / 그 외 🟡';
    return {ch:ch, lv:lv, rule:rule};
  }
  function card(name,key,diffKey,withLamp){
    const v=last[key], diff=last[diffKey];
    const values=win.map(r=>r[key]);
    const nums=values.filter(x=>x!=null);
    const lo=Math.min(...nums), hi=Math.max(...nums);
    const dec=((hi-lo)/10000<1)?2:1;
    const fmtAx=x=>x>=10000?(x/10000).toFixed(dec)+'조':Math.round(x).toLocaleString('ko-KR');
    const diffUp=(diff!=null && diff>=0);
    const diffColor=diff==null?'var(--tx2)':(diffUp?'var(--up)':'var(--down)');
    const diffText=diff==null?'--':(diffUp?'▲':'▼')+Math.abs(diff).toLocaleString('ko-KR');
    const pChg=(first[key]&&v!=null)?(v-first[key])/first[key]*100:null;
    const pCol=pChg==null?'var(--tx2)':(pChg>=0?'var(--up)':'var(--down)');
    return '<div style="padding:10px 12px;background:var(--panel2);border-radius:10px">'+
      '<div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px">'+
        '<span style="font-size:12px;color:var(--tx2);font-weight:700">'+name+'</span>'+
        '<span style="font-size:11px;color:'+pCol+';font-weight:700">'+KR_PERIOD_LABEL[krDepositPeriod]+' '+(pChg==null?'--':(pChg>=0?'+':'')+pChg.toFixed(2)+'%')+'</span></div>'+
      '<div style="font-weight:800;font-size:16px">'+(v!=null?v.toLocaleString('ko-KR'):'--')+'<span style="font-size:11px;font-weight:400;color:var(--tx2)"> 억</span>'+
        ' <span style="font-size:12px;color:'+diffColor+';font-weight:700">'+diffText+'</span></div>'+
      miniLineChart([{values:values, color:(pChg!=null&&pChg>=0?'var(--up)':'var(--down)'), width:1.8}],
        {w:300,h:120,padL:46,padR:8,padTop:8,padBottom:18,axis:true,axisFmt:fmtAx,xLabels:xl})+
    '</div>';
  }
  const grid='display:grid;grid-template-columns:repeat(auto-fit,minmax(270px,1fr));gap:14px';
  function lampBox(name,key){
    const L=lampFor(key); if(!L) return '';
    return '<div class="kr-sc" style="--c:'+L.lv.c+'" title="'+L.rule+'"><small>'+name+'</small><b>'+L.lv.i+' '+L.lv.t+'</b><span>3개월 '+(L.ch>=0?'+':'')+L.ch.toFixed(1)+'%</span></div>';
  }
  const _l1=lampFor('customerDeposit'), _l2=lampFor('creditLoan');
  const lampTop='<div class="kr-sum"><p class="kr-sline"><b>핵심 요약</b> 최근 3개월 · '+(_l1?'고객예탁금 <em style="color:'+_l1.lv.c+'">'+_l1.lv.t+'</em>':'')+(_l1&&_l2?' · ':'')+(_l2?'신용잔고 <em style="color:'+_l2.lv.c+'">'+_l2.lv.t+'</em>':'')+'</p><div class="kr-sg kr-sg2">'+lampBox('고객예탁금','customerDeposit')+lampBox('신용잔고','creditLoan')+'</div></div>';
  el.innerHTML=lampTop+'<div class="mut" style="font-size:11.5px;margin-bottom:10px">'+fmtKrDate(last.bizdate)+' 기준 · 최근 '+KR_PERIOD_LABEL[krDepositPeriod]+' 추이 · 단위 억원(1만억=1조) · 세로축=금액, 가로축=날짜 · 신호등은 최근 3개월 변화 기준</div>'+
    '<div style="'+grid+'">'+card('고객예탁금','customerDeposit','customerDepositDiff',true)+card('신용잔고','creditLoan','creditLoanDiff',true)+'</div>'+
    '<div style="margin-top:14px"><button type="button" data-stock-click="toggleKrFundDetail()" style="cursor:pointer;border:1px solid var(--line);background:var(--panel);color:var(--tx);border-radius:8px;padding:7px 14px;font-size:12.5px;font-weight:700">'+
      '펀드상세보기 '+(krFundOpen?'▲':'▼')+'</button> <span class="mut" style="font-size:11.5px">주식형·혼합형·채권형 펀드</span></div>'+
    (krFundOpen?'<div style="'+grid+';margin-top:12px">'+card('주식형펀드','stockFund','stockFundDiff',false)+card('혼합형펀드','mixedFund','mixedFundDiff',false)+card('채권형펀드','bondFund','bondFundDiff',false)+'</div>':'');
}
let krFundOpen=false;
function toggleKrFundDetail(){ krFundOpen=!krFundOpen; renderKrMarketDeposit(krDepositRows); }
async function loadKrFundFlow(){
  const depositEl=document.getElementById('kr-market-deposit');
  if(depositEl) depositEl.innerHTML='<p class="mut" style="font-size:12.5px">불러오는 중…</p>';
  refreshKrInvestor();
  krDepositRows=await loadKrMarketDeposit(70);
  renderKrMarketDeposit(krDepositRows);
}

/* ================= 자산간 상관관계 (야선지지 매크로 대시보드 스타일 시각화 구체화) =================
   지수·금리·환율·원자재 등 서로 다른 자산의 일간 수익률로 피어슨 상관계수를 계산해,
   숫자 하나가 아니라 -1~+1 구간을 양방향으로 채우는 막대로 보여준다. avg()·yclose()를 재사용한다. */
function pctReturns(closes){
  const r=[];
  for(let i=1;i<closes.length;i++){
    r.push((closes[i]!=null && closes[i-1])?closes[i]/closes[i-1]-1:null);
  }
  return r;
}
function pearsonCorr(a,b){
  const n=Math.min(a.length,b.length);
  const xs=[],ys=[];
  for(let i=0;i<n;i++){ if(a[i]!=null&&b[i]!=null){ xs.push(a[i]); ys.push(b[i]); } }
  if(xs.length<10) return null;
  const mx=avg(xs), my=avg(ys);
  let num=0,dx2=0,dy2=0;
  for(let i=0;i<xs.length;i++){ const dx=xs[i]-mx, dy=ys[i]-my; num+=dx*dy; dx2+=dx*dx; dy2+=dy*dy; }
  const den=Math.sqrt(dx2*dy2);
  return den?num/den:null;
}
function corrColor(r){
  if(r==null) return 'var(--tx2)';
  if(r>=0.5) return 'var(--ok)';
  if(r>=0.2) return '#8fd19e';
  if(r>-0.2) return 'var(--tx2)';
  if(r>-0.5) return '#7cc4ff';
  return 'var(--down)';
}
async function loadCorrSeries(tickers){
  await Promise.all(tickers.map(t=>relFetch(t,'6mo')));
}
function renderCorrGrid(elId, pairs){
  const el=document.getElementById(elId); if(!el) return;
  const rows=pairs.map(p=>{
    const ca=tickData[p.a.t]||RELCACHE[p.a.t], cb=tickData[p.b.t]||RELCACHE[p.b.t];
    if(!ca||!cb) return {p, r:null};
    const ra=pctReturns(ca.slice(-91)), rb=pctReturns(cb.slice(-91));
    return {p, r:pearsonCorr(ra,rb)};
  });
  if(rows.every(({r})=>r==null)){
    el.innerHTML='<p class="mut" style="font-size:12.5px">⚠ 데이터 연동 실패 — 프록시 응답이 없습니다. 새로고침해도 안 뜨면 콘솔(F12) 경고를 확인해주세요.</p>';
    return;
  }
  const interp=r=>{ if(r==null) return ['—','#64748B'];
    const a=Math.abs(r), dir=r>=0?'양':'음';
    if(a>=.7) return ['강한 '+dir+'의 상관',r>=0?'#0A6B48':'#D92D20'];
    if(a>=.4) return ['뚜렷한 '+dir+'의 상관',r>=0?'#2E8B6A':'#C2570C'];
    if(a>=.2) return ['약한 '+dir+'의 상관','#B7791F'];
    return ['거의 무관','#64748B']; };
  const body=rows.map(({p,r},i)=>{
    const pct=r==null?50:((r+1)/2*100);
    const col=corrColor(r), ip=interp(r);
    const barStyle=(r!=null&&r>=0)
      ? 'left:50%;width:'+Math.max(0,pct-50).toFixed(1)+'%'
      : 'right:50%;width:'+Math.max(0,50-pct).toFixed(1)+'%';
    return '<tr style="border-top:1px solid var(--line)">'+
      '<td style="padding:12px 6px;font-size:14px;font-weight:800;color:var(--tx);white-space:nowrap"><span style="display:inline-block;width:20px;height:20px;line-height:20px;text-align:center;border-radius:50%;background:#0A6B48;color:#fff;font-size:11px;margin-right:6px">'+(i+1)+'</span><span class="cr-a">'+p.a.label+' <span style="color:var(--tx2);font-weight:600">↔</span></span> <span class="cr-b">'+p.b.label+'</span></td>'+
      '<td class="corr-bar" style="padding:12px 10px;width:34%;min-width:110px"><div style="height:12px;border-radius:6px;background:var(--panel2);border:1px solid var(--line);position:relative">'+
        '<div style="position:absolute;left:50%;top:-3px;bottom:-3px;width:2px;background:#111418;opacity:.55"></div>'+
        '<div style="position:absolute;top:0;bottom:0;'+barStyle+';background:'+col+';border-radius:6px"></div></div></td>'+
      '<td style="padding:12px 6px;text-align:right;white-space:nowrap"><b style="display:block;font-size:17px;font-family:\'JetBrains Mono\',monospace;color:'+col+'">'+(r==null?'--':(r>=0?'+':'−')+Math.abs(r).toFixed(2))+'</b>'+
        '<span style="display:inline-block;margin-top:3px;padding:1px 8px;border-radius:999px;background:'+ip[1]+';color:#fff;font-size:11px;font-weight:700">'+ip[0]+'</span></td></tr>';
  }).join('');
  el.innerHTML='<style>@media(max-width:600px){#'+elId+' table{table-layout:fixed}#'+elId+' td,#'+elId+' th{padding-left:3px!important;padding-right:3px!important}#'+elId+' td:first-child{white-space:normal!important;font-size:12px!important;line-height:1.35;width:36%}#'+elId+' td:first-child span:first-child{width:16px!important;height:16px!important;line-height:16px!important;font-size:10px!important;margin-right:3px!important}#'+elId+' .corr-bar{width:26%!important;min-width:0!important}#'+elId+' td:last-child{white-space:normal!important;width:38%}#'+elId+' td:last-child b{font-size:15px!important}#'+elId+' td:last-child span{font-size:10px!important;padding:1px 5px!important;white-space:nowrap}}</style>'+'<div style="overflow-x:auto" tabindex="0" role="region" aria-label="자산간 상관관계 표"><table style="width:100%;border-collapse:collapse"><thead><tr style="background:var(--panel2)"><th style="text-align:left;padding:8px 6px;font-size:12px;color:var(--tx2)">자산 쌍</th><th style="padding:8px 10px;font-size:12px;color:var(--tx2)"><span style="display:flex;justify-content:space-between"><span>−1 반대</span><span>0</span><span>+1 동행</span></span></th><th style="text-align:right;padding:8px 6px;font-size:12px;color:var(--tx2)">상관계수</th></tr></thead><tbody>'+body+'</tbody></table></div>'+
    '<div style="margin-top:10px;padding:8px 10px;border-radius:8px;background:var(--panel2);border-left:4px solid #0A6B48;font-size:12px;line-height:1.55;color:var(--tx)">최근 90거래일 일간 수익률 기준 피어슨 상관계수입니다. +1에 가까울수록 같은 방향, −1에 가까울수록 반대 방향으로 움직이는 경향이며, 참고용 통계치로 인과관계를 의미하지 않습니다.</div>';
}

/* 미국지수 페이지: S&P500 vs VIX·금·달러인덱스·비트코인 상관관계 */
const US_CORR_PAIRS=[
  {a:{t:'SPY',label:'S&P500'}, b:{t:'^VIX',label:'VIX(변동성)'}},
  {a:{t:'SPY',label:'S&P500'}, b:{t:'GLD',label:'금(GLD)'}},
  {a:{t:'SPY',label:'S&P500'}, b:{t:'DX-Y.NYB',label:'달러인덱스'}},
  {a:{t:'SPY',label:'S&P500'}, b:{t:'BTC-USD',label:'비트코인'}}
];
async function loadUSCorr(){
  const tickers=[...new Set(US_CORR_PAIRS.flatMap(p=>[p.a.t,p.b.t]))];
  await loadCorrSeries(tickers);
  renderCorrGrid('us-corr-grid', US_CORR_PAIRS);
}

/* 한국지수 페이지: 코스피 vs 원/달러 환율·S&P500·VIX·반도체(SOXX) 상관관계 */
const KR_CORR_PAIRS=[
  {a:{t:'^KS11',label:'코스피'}, b:{t:'KRW=X',label:'원/달러 환율'}},
  {a:{t:'^KS11',label:'코스피'}, b:{t:'SPY',label:'S&P500'}},
  {a:{t:'^KS11',label:'코스피'}, b:{t:'^VIX',label:'VIX(변동성)'}},
  {a:{t:'^KS11',label:'코스피'}, b:{t:'SOXX',label:'반도체(SOXX)'}}
];
async function loadKRCorr(){
  const tickers=[...new Set(KR_CORR_PAIRS.flatMap(p=>[p.a.t,p.b.t]))];
  await loadCorrSeries(tickers);
  renderCorrGrid('kr-corr-grid', KR_CORR_PAIRS);
}

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
  /* [보안] 공개 프록시(allorigins·codetabs·thingproxy) 폴백 제거 — 응답이 변조되면 화면(innerHTML)에 그대로 들어갈 수 있어 자체 Worker 만 사용한다 */
].filter(Boolean);

window.MK_NET=window.MK_NET||{log:[],lastOk:0,rec:function(ok){this.log.push(ok?1:0);if(this.log.length>24)this.log.shift();if(ok)this.lastOk=Date.now();}};
async function getJSON(url){
  const hit=__JC.get(url); if(hit&&Date.now()-hit.t<45000) return hit.j;
  if(__JP.has(url)) return __JP.get(url);
  const pr=(async function(){ await __jSlot(); try{ const j=await __getJSON(url); if(j){ __JC.set(url,{t:Date.now(),j:j}); if(__JC.size>400) __JC.delete(__JC.keys().next().value); } return j; } finally{ __jFree(); __JP.delete(url); } })();
  __JP.set(url,pr); return pr;
}
async function __getJSON(url){
  const errors=[];
  /* 자체 Worker 하나만 쓰므로(공개 프록시 폴백 제거) 느린 응답·일시 제한(429/5xx)에는 1회 더 시도한다.
     DART·ECOS·KRX 는 첫 호출이 오래 걸릴 수 있어 대기 시간을 늘린다. */
  const slow=/opendart\.fss|ecos\.bok|krx\.co\.kr|stock\.naver/.test(url), TMO=slow?15000:8000;
  for(const p of PROXIES){
    const target=p(url); if(!target) continue;
    for(let att=0;att<2;att++){
      let retry=false;
      try{
        const c=new AbortController(), t=setTimeout(()=>c.abort(),TMO);
        const r=await fetch(target,{signal:c.signal}); clearTimeout(t);
        if(!r.ok){ errors.push(target.split('?')[0]+' → HTTP '+r.status); retry=(r.status===429||r.status>=500); }
        else{
          const j=await r.json();
          if(j){ MK_NET.rec(true); return j; }
          errors.push(target.split('?')[0]+' → 빈 응답');
        }
      }catch(e){ errors.push(target.split('?')[0]+' → '+e.message); retry=true; }
      if(!retry) break;
      await new Promise(rs=>setTimeout(rs,att===0?1200:0));
    }
  }
  console.warn('getJSON 전체 실패('+url+'):', errors);
  MK_NET.rec(false);
  return null;
}
/* Yahoo 일봉 종가 배열 */
/* Yahoo 일봉 종가: 같은 시점(40ms)에 요청된 3개 이상의 종목은 Worker의 /yq 로 한 번에 묶어 받는다.
   묶음 요청이 실패하거나 일부 종목이 비면 기존 개별 요청으로 자동 대체한다. */
/* [종가 보정] Yahoo는 장 마감 직후 일봉의 마지막 close를 null로 내려주는 경우가 있다(meta.regularMarketPrice에는 종가가 있음).
   null을 그냥 버리면 하루 전 종가가 '최신'으로 표시되므로, 마지막 봉이 null이면 meta의 정규장 종가로 채운다. */
function mkFillClose(r){
  var q=((r.indicators&&r.indicators.quote&&r.indicators.quote[0]&&r.indicators.quote[0].close)||[]).slice(), ts=r.timestamp||[], m=r.meta||{}, n=q.length;
  if(n&&q[n-1]==null&&m.regularMarketPrice!=null&&ts[n-1]&&m.regularMarketTime>=ts[n-1]) q[n-1]=m.regularMarketPrice;
  return q;
}
window.mkFillClose=mkFillClose;
const __YQ={q:[],t:null,bad:0};
async function __ycloseOne(sym,range){
  const j=await getJSON('https://query1.finance.yahoo.com/v8/finance/chart/'+
      encodeURIComponent(sym)+'?range='+(range||'1y')+'&interval=1d');
  try{
    const q=mkFillClose(j.chart.result[0]).filter(x=>x!=null);
    return q.length>30?q:null;
  }catch(e){ return null; }
}
async function __yqFlush(){
  const batch=__YQ.q.splice(0); __YQ.t=null; if(!batch.length) return;
  const byR={}; batch.forEach(b=>{ (byR[b.range]=byR[b.range]||[]).push(b); });
  for(const range in byR){
    const items=byR[range], syms=[...new Set(items.map(b=>b.sym))];
    let data=null;
    if(syms.length>=3 && __YQ.bad<3 && /^(1d|5d|1mo|3mo|6mo|1y|2y|5y|10y|ytd|max)$/.test(range) && typeof PROXY_BASE!=='undefined' && PROXY_BASE){
      try{
        const origin=PROXY_BASE.replace(/\?url=$/,'').replace(/\/+$/,'');
        const r=await fetch(origin+'/yq?range='+range+'&symbols='+encodeURIComponent(syms.slice(0,30).join(',')),{signal:AbortSignal.timeout?AbortSignal.timeout(12000):undefined});
        if(r.ok){ data=await r.json(); window.MK_NET&&MK_NET.rec(true); __YQ.bad=0; } else { __YQ.bad++; window.MK_NET&&MK_NET.rec(false); }
      }catch(e){ __YQ.bad++; window.MK_NET&&MK_NET.rec(false); }
    }
    await Promise.all(items.map(async b=>{
      let v=data&&data[b.sym.toUpperCase()];
      if(v&&v.length>30) return b.res(v);
      b.res(await __ycloseOne(b.sym,range));
    }));
  }
}
function yclose(sym,range){
  return new Promise(res=>{
    __YQ.q.push({sym:sym,range:range||'1y',res:res});
    if(!__YQ.t) __YQ.t=setTimeout(__yqFlush,40);
  });
}
/* yclose()는 종가만 반환해(null 필터링까지 해서) 인덱스와 실제 날짜가 어긋난다 — 공모주
   동종업체 상대수익률 차트에서 "상장일 기준점"을 정확한 위치에 표시하려면 날짜가 함께
   필요해 별도 함수로 둔다(다른 곳에서 쓰는 yclose/relFetch는 그대로 둔다). null(휴장/결측)은
   버리지 않고 두 배열의 길이를 맞춰 인덱스 정합성을 유지한다. */
async function yCloseWithDates(sym,range){
  const j=await getJSON('https://query1.finance.yahoo.com/v8/finance/chart/'+
      encodeURIComponent(sym)+'?range='+(range||'1y')+'&interval=1d');
  try{
    const ts=j.chart.result[0].timestamp;
    const closes=mkFillClose(j.chart.result[0]);
    if(!ts || !closes || ts.length<30) return null;
    const dates=ts.map(t=>new Date(t*1000).toISOString().slice(0,10));
    return {dates, closes};
  }catch(e){ return null; }
}
/* "2026.01.30" · "2026/01/30" · "2026년 01월 30일" · "2026-01-30" 등 사이트마다 다른
   상장일 표기에서 연/월/일 숫자만 뽑아 Date로 만든다. "미정"처럼 날짜가 아니면 null. */
function parseKrDate(str){
  if(!str) return null;
  const m=String(str).match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
  if(!m) return null;
  const d=new Date(+m[1], +m[2]-1, +m[3]);
  return isNaN(d.getTime())?null:d;
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


function mkDday(y,m,d){
  const kst=new Date(Date.now()+9*3600*1000);
  const t0=Date.UTC(kst.getUTCFullYear(),kst.getUTCMonth(),kst.getUTCDate());
  const n=Math.round((Date.UTC(y,m-1,d)-t0)/86400000);
  if(n===0)return '<span class="tag dd-now">오늘</span>';
  if(n>0)return '<span class="tag dd-fut">D-'+n+'</span>';
  return '<span class="tag dd-past">D+'+(-n)+' 종료</span>';
}
function renderEvents(m){
  const tbody=document.getElementById('events-tbl'); if(!tbody)return;
  const all=(MONTH_EVENTS[m]||[]).slice().sort((a,b)=>a.d-b.d);
  const arr=all.filter(e=>!e.hol);
  const holidays=all.filter(e=>e.hol);
  if(!arr.length){ tbody.innerHTML='<tr><td class="mut" colspan="3">해당 월 일정 준비 중입니다.</td></tr>'; }
  else{
    const IMP={h:['🔴','최상'],m:['🟡','중'],l:['⚪','참고']};
    tbody.innerHTML=arr.map(e=>{
      const ds=String(m).padStart(2,'0')+'.'+String(e.d).padStart(2,'0');
      const im=IMP[e.g]||IMP.l;
      return '<tr'+(e.g==='h'?' class="ev-hi"':'')+'><td class="mut">'+ds+'</td><td><span class="ev-i" title="중요도 '+im[1]+'">'+im[0]+'</span><a class="ev-a" href="'+e.s+'" target="_blank" rel="noopener" title="출처 보기">'+e.t+'</a></td><td class="mut">'+e.c+'</td></tr>';
    }).join('');
  }
  const htbody=document.getElementById('holidays-tbl');
  if(htbody){
    if(!holidays.length){ htbody.innerHTML='<tr><td class="mut" colspan="4">해당 월 휴장일이 없습니다.</td></tr>'; }
    else{
      htbody.innerHTML=holidays.map(e=>{
        const ds=String(m).padStart(2,'0')+'.'+String(e.d).padStart(2,'0');
        const kind=e.c==='전일 휴장'?'휴장':(e.c.indexOf('채권시장')>-1?'채권시장만 휴장':'조기 폐장');
        return '<tr><td class="mut">'+ds+'</td><td><b>'+e.t+'</b></td>'+
          '<td><span class="tag t-close">'+kind+'</span></td><td>'+mkDday(2026,m,e.d)+'</td></tr>';
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
    if(!arr.length){ tbody.innerHTML='<tr><td class="mut" colspan="3">해당 월 일정이 없습니다.</td></tr>'; }
    else{
      const IMP={h:['🔴','최상'],m:['🟡','중'],l:['⚪','참고']};
      tbody.innerHTML=arr.map(e=>{
        const ds=String(m).padStart(2,'0')+'.'+String(e.d).padStart(2,'0');
        const im=IMP[e.g]||IMP.l;
        return '<tr'+(e.g==='h'?' class="ev-hi"':'')+'><td class="mut">'+ds+'</td><td><span class="ev-i" title="중요도 '+im[1]+'">'+im[0]+'</span><a class="ev-a" href="'+e.s+'" target="_blank" rel="noopener" title="출처 보기">'+e.t+'</a></td><td class="mut">'+e.c+'</td></tr>';
      }).join('');
    }
  }
  const htbody=document.getElementById('kr-holidays-tbl');
  if(htbody){
    const hs=(KR_HOLIDAYS[m]||[]).slice().sort((a,b)=>a.d-b.d);
    if(!hs.length){ htbody.innerHTML='<tr><td class="mut" colspan="4">해당 월 휴장일이 없습니다.</td></tr>'; }
    else{
      htbody.innerHTML=hs.map(e=>{
        const ds=String(m).padStart(2,'0')+'.'+String(e.d).padStart(2,'0');
        return '<tr><td class="mut">'+ds+'</td><td><b>'+e.t+'</b></td><td><span class="tag t-close">휴장</span></td><td>'+mkDday(2026,m,e.d)+'</td></tr>';
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
  if(!arr.length){ tbody.innerHTML='<tr><td class="mut" colspan="3">해당 월 일정이 없습니다.</td></tr>'; return; }
  const IMP={h:['🔴','최상'],m:['🟡','중'],l:['⚪','참고']};
  tbody.innerHTML=arr.map(e=>{
    const ds=String(m).padStart(2,'0')+'.'+String(e.d).padStart(2,'0');
    const im=IMP[e.g]||IMP.l;
    return '<tr'+(e.g==='h'?' class="ev-hi"':'')+'><td class="mut">'+ds+'</td><td><span class="ev-i" title="중요도 '+im[1]+'">'+im[0]+'</span><a class="ev-a" href="'+e.s+'" target="_blank" rel="noopener" title="출처 보기">'+e.t+'</a></td><td class="mut">'+e.c+'</td></tr>';
  }).join('');
}

/* ---- 네트워크 실패 시 사용할 실측 기준값 (Yahoo Finance 최근 종가 기준) ----
   운영 시 주간 리포트 작성할 때 함께 갱신하면 폴백 정확도가 유지됩니다. */
const BASE={
  QLD :{px:90.68, d:0.33,  w:0.57,  m:0.61,  y:43.30},
  USD :{px:88.80, d:4.26,  w:7.22,  m:-1.92, y:111.66},
  SCHD:{px:34.80, d:-0.80, w:-0.29, m:3.26,  y:25.90},
  ROM :{px:70.00, d:0, w:0, m:0, y:0},
  JEPQ:{px:58.00, d:0, w:0, m:0, y:0},
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
  window.MK_FG_PHASE='loading';
  FGdata=await getJSON(CNN_URL);
  if(!FGdata||!FGdata.fear_and_greed||!Number.isFinite(FGdata.fear_and_greed.score))FGdata=null;
  window.MK_FG_PHASE=FGdata?'live':'snapshot';
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
const US_SUBDESC={
  '시장 모멘텀':'S&P500 지수가 125일 이동평균보다 얼마나 높은지 측정합니다. 이평선 위로 멀리 올라 있을수록 탐욕, 아래로 내려갈수록 공포입니다.',
  '주가 강도':'NYSE에서 52주 신고가를 낸 종목 수와 신저가를 낸 종목 수의 비율입니다. 신고가 종목이 많을수록 탐욕입니다.',
  '주가 폭':'상승 종목 거래량과 하락 종목 거래량의 차이(맥클레런 거래량 지수)입니다. 상승 종목에 거래량이 몰릴수록 탐욕입니다.',
  '풋/콜 옵션':'최근 5일 평균 풋옵션/콜옵션 거래량 비율입니다. 풋(하락 베팅)이 많으면 공포, 콜(상승 베팅)이 많으면 탐욕입니다.',
  '시장 변동성':'VIX가 50일 이동평균 대비 얼마나 높은지입니다. VIX가 높을수록(불안이 클수록) 공포입니다.',
  '정크본드 수요':'투기등급(정크) 채권과 국채 간 수익률 격차입니다. 격차가 좁을수록 위험자산 선호가 강해 탐욕입니다.',
  '안전자산 선호':'최근 20거래일 주식 수익률과 국채 수익률의 차이입니다. 국채가 주식보다 강할수록 안전자산 쏠림(공포)입니다.'
};
const US_SUBTBL={
  '시장 모멘텀':['S&P500 지수와 125일 이동평균의 격차','이평선 위로 멀리 올라 있을수록 탐욕 · 아래로 내려갈수록 공포'],
  '주가 강도':['NYSE 52주 신고가 종목 수 ÷ 신저가 종목 수','신고가 종목이 많을수록 탐욕'],
  '주가 폭':['상승 종목 거래량과 하락 종목 거래량의 차이(맥클레런 거래량 지수)','상승 종목에 거래량이 몰릴수록 탐욕'],
  '풋/콜 옵션':['최근 5일 평균 풋옵션 ÷ 콜옵션 거래량 비율','풋(하락 베팅)이 많으면 공포 · 콜(상승 베팅)이 많으면 탐욕'],
  '시장 변동성':['VIX와 50일 이동평균의 격차','VIX가 높을수록(불안이 클수록) 공포'],
  '정크본드 수요':['투기등급(정크) 채권과 국채의 수익률 격차','격차가 좁을수록 위험자산 선호가 강해 탐욕'],
  '안전자산 선호':['최근 20거래일 주식 수익률과 국채 수익률의 차이','국채가 주식보다 강할수록 안전자산 쏠림(공포)']
};
const SUB_NUM=['①','②','③','④','⑤','⑥','⑦'];
function subBarCell(v){ const x=Math.max(0,Math.min(100,v)); return '<div class="sub-bar"><i style="left:'+x.toFixed(1)+'%"></i></div>'; }
function subTable(rows,src){
  const el=$('#us-sub'); if(!el)return;
  el.innerHTML=rows.map(([n,v],i)=>{
    const link=SUBSRC[n];
    const label_='<span class="sub-no">'+(i+1)+'</span><span class="sub-nm">'+(link?'<a href="'+link+'" target="_blank" rel="noopener">'+n+'</a>':n)+'</span>';
    const [tl,tc]=label(v);
    return '<tr><td class="sub-lab" style="white-space:nowrap">'+label_+'</td><td style="width:24%;min-width:48px">'+subBarCell(v)+'</td>'+
    '<td class="num" style="white-space:nowrap;line-height:1.5"><b>'+v.toFixed(1)+'</b><br>'+zoneTag(tl)+'</td></tr>';
  }).join('');
  $('#us-src').textContent=src;
  const nEl=document.getElementById('us-sub-note');
  if(nEl) nEl.innerHTML='<details><summary style="cursor:pointer;font-weight:800;color:var(--accent)">지표 설명 자세히 보기</summary><div style="margin-top:6px"><div class="scroll"><table class="subdesc-tbl"><thead><tr><th>#</th><th>지표명</th><th>측정 내용</th><th>읽는 법</th></tr></thead><tbody>'+rows.map(([n],i)=>{const d=US_SUBTBL[n]||[US_SUBDESC[n]||'',''];return '<tr><td class="sd-no"><span class="sub-no">'+(i+1)+'</span></td><td class="sd-nm"><b>'+n+'</b></td><td>'+d[0]+'</td><td>'+d[1]+'</td></tr>';}).join('')+'</tbody></table></div><span style="opacity:.8;font-size:11.5px;display:block;margin-top:6px">막대: 왼쪽 극단적 공포(0) ~ 오른쪽 극단적 탐욕(100) · 검은 표시가 현재 점수</span></div></details>';
}
function renderUS(p){
  $('#us-per').textContent='· '+PERKO[p];
  if(!FGdata && window.MK_FG_PHASE==='loading'){
    const v=document.getElementById('us-val');if(v)v.textContent='—';
    const lbl=document.getElementById('us-state');if(lbl)lbl.textContent='조회 중';
    const note=document.getElementById('us-note');if(note)note.textContent='공포탐욕 데이터를 조회하고 있습니다.';
    return;
  }
  if(!FGdata){                                    // 폴백 (CNN 실측 스냅샷)
    const v=FG_BASE[p];
    paint('us',v,'전일 대비 '+(FG_BASE.d>=FG_BASE.prev?'▲ ':'▼ ')+Math.abs(FG_BASE.d-FG_BASE.prev).toFixed(1)+'p ('+FG_BASE.prev.toFixed(0)+'점 → '+FG_BASE.d.toFixed(0)+'점)');
    /* 폴백도 기간 탭에 따라 다른 근사 곡선을 보여준다 */
    const fbSeries={d:[FG_BASE.prev,FG_BASE.d], w:[FG_BASE.m,FG_BASE.w,FG_BASE.d],
                     m:[FG_BASE.y,FG_BASE.m,FG_BASE.w,FG_BASE.d], y:[FG_BASE.y,FG_BASE.m,FG_BASE.w,FG_BASE.d]}[p]||FG_BARS;
    bars('us', fbSeries.length>1?fbSeries:FG_BARS);
    subTable(FG_SUB,'CNN 저장자료 · 2026-09-10 기준 · 최신 조회 실패');
    return;
  }
  const f=FGdata.fear_and_greed;
  /* CNN 이 제공하는 기간별 공식 값을 그대로 사용 — 임의 재계산하지 않는다 */
  const v={d:f.score, w:f.previous_1_week, m:f.previous_1_month, y:f.previous_1_year}[p];
  const dl=x=>{ const d=f.score-x; return (d>=0?'▲ ':'▼ ')+Math.abs(d).toFixed(1)+'p'; };
  const note={
    d:'전일 대비 '+dl(f.previous_close)+' ('+f.previous_close.toFixed(0)+'점 → '+f.score.toFixed(0)+'점)',
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
  tick:{table:'tick-tbl', list:['QLD','USD','ROM','SCHD','JEPQ','DRAM','RAM','GLDM','SLVP','SPMO']},
  cap: {table:'cap-tbl',  list:['NVDA','AAPL','GOOGL','MSFT','AMZN','TSM','SPCX','AVGO','META','TSLA']},
  cap2:{table:'cap2-tbl', list:['MU','BRK-B','AMD','LLY','JPM','WMT','V','XOM','INTC','JNJ']},
  cap3:{table:'cap3-tbl', list:['MA','ABBV','CSCO','BAC','AMAT','COST','CAT','CVX','UNH','LRCX']},
  krcap2:{table:'krcap2-tbl', list:['012450.KS','034020.KS','055550.KS','006400.KS','329180.KS','000270.KS','034730.KS','068270.KS','066570.KS','086790.KS'], cur:'₩', fmt:fmtWon},
  krkq2:{table:'krkq2-tbl', list:['028300.KQ','000250.KQ','403870.KQ','319660.KQ','095340.KQ','440110.KQ','031980.KQ','084370.KQ','067310.KQ','131290.KQ'], cur:'₩', fmt:fmtWon},
  idxchg:{table:'idxchg-tbl', list:['ILMN','BE','TTD','BLDR','TAP','FERG','RDDT','EA','AVB','CRWV','MRVL','NBIS','ALAB','RKLB','TER','FLEX','POOL','CPB']},
  lev: {table:'lev-tbl',  list:['TQQQ','UPRO','HIBL','UDOW','TECL','BULZ','SOXL','SMHU','FNGU','WEBL','DFEN','FAS','LABU','KORU','YINN','INDL','GDXU','TNA','TMF','DRN']},
  kridx:{table:'kridx-tbl', list:['267270.KS','000990.KS','483650.KS','456040.KS','006360.KS','004490.KS','114090.KS','005250.KS','082740.KS','007660.KS','034230.KS','062040.KS','064400.KS','307950.KS','002030.KS','010620.KS','012630.KS','489790.KS','145720.KS','039130.KS','003620.KS','002710.KS','010060.KS'], cur:'₩', fmt:fmtWon},
  krcap:{table:'krcap-tbl', list:['005930.KS','000660.KS','402340.KS','009150.KS','005380.KS','373220.KS','207940.KS','105560.KS','032830.KS','028260.KS'], cur:'₩', fmt:fmtWon},
  krlev:{table:'krlev-tbl', list:['122630.KS','243880.KS','494310.KS','0080Y0.KS','233740.KS','0193T0.KS','0193W0.KS'], cur:'₩', fmt:fmtWon},
  krkq: {table:'krkq-tbl',  list:['196170.KQ','086520.KQ','247540.KQ','036930.KQ','277810.KQ','240810.KQ','039030.KQ','058470.KQ','222800.KQ','108490.KQ'], cur:'₩', fmt:fmtWon}
};
/* ===== PC 화면: 종목명과 스파크라인 사이 핵심 지표(매출액증가율·영업이익증가율·PER·EPS(TTM)·EPS(Fwd)·PSR) ===== */
function injectRowStatCss(){
  if(document.getElementById('rowstat-css')) return;
  const st=document.createElement('style'); st.id='rowstat-css';
  st.textContent='.wl-stats{display:none;flex:none;grid-template-columns:66px 80px 48px 70px 76px 50px;gap:2px 4px;width:418px;text-align:center;padding:0 4px;box-sizing:border-box}'+
    '@media(min-width:1000px){.wl-stats{display:grid}}'+
    '.wl-stats>div{min-width:0;overflow:hidden}.wl-stats .k{font-size:10px;color:var(--tx2);white-space:nowrap}.wl-stats .v{font-size:12.5px;font-weight:800;white-space:nowrap;font-variant-numeric:tabular-nums;min-height:1.25em}';
  document.head.appendChild(st);
}
function rowStatsHtml(o){
  /* 값이 없는 지표는 칸 자체를 만들지 않는다(— 표시 금지) */
  const has=v=>v!=null&&!isNaN(v);
  const pc=v=>'<span style="color:'+(v>=0?'var(--up)':'var(--down)')+'">'+(v>=0?'+':'')+v.toFixed(1)+'%</span>';
  const cell=(k,v)=>'<div><div class="k">'+k+'</div><div class="v">'+(v==null?'&nbsp;':v)+'</div></div>';
  /* 칸 위치(열 폭)는 고정하고, 값이 없는 지표는 값을 비워 둔다(임의 값·— 표시 없음) — 행마다 글자가 겹치거나 밀리지 않게 */
  const cs=[
    cell('매출증가율',has(o.rg)?pc(o.rg):null),
    cell('영업이익증가율',has(o.og)?pc(o.og):null),
    cell('PER',has(o.per)?o.per.toFixed(1):null),
    cell('EPS(TTM)',has(o.eps)?(o.kr?Math.round(o.eps).toLocaleString('ko-KR'):o.eps.toFixed(2)):null),
    cell('EPS(Fwd)',has(o.feps)?(o.kr?Math.round(o.feps).toLocaleString('ko-KR'):o.feps.toFixed(2)):null),
    cell('PSR',has(o.psr)?o.psr.toFixed(2):null)];
  if(![o.rg,o.og,o.per,o.eps,o.feps,o.psr].some(has)) return '';
  return cs.join('');
}
function putRowStats(row,o){
  injectRowStatCss();
  let box=row.querySelector('.wl-stats');
  if(!box){ box=document.createElement('div'); box.className='wl-stats'; const info=row.querySelector('.wl-info'); if(info) info.after(box); else return; }
  const h=rowStatsHtml(o); if(!h){ box.remove(); return; } box.innerHTML=h;
}
async function fillUsRowStats(tableId,set){
  if(window.innerWidth<1000) return;
  const map=await loadUsFundamentalsOnce(set); if(!map) return;
  document.querySelectorAll('#'+tableId+' .wl-row').forEach(row=>{
    const it=map[row.dataset.t]; if(!it) return;
    putRowStats(row,{rg:it.revenueGrowth!=null?it.revenueGrowth*100:null, og:it.earningsGrowth!=null?it.earningsGrowth*100:null, per:it.trailingPE, eps:it.trailingEps, feps:it.forwardEps, psr:it.psr});
  });
}
const KR_STAT_CACHE={};
async function krStatsLite(code){
  if(KR_STAT_CACHE[code]) return KR_STAT_CACHE[code];
  const [corp]=await resolveDartCorpCodes([code]);
  const out={kr:true};
  if(corp){
    const y=new Date().getFullYear()-1;
    const [fin,gr,eps,cons]=await Promise.all([dartFinancialYear(corp,y),dartGrowthIndicators(corp,y),dartEps(corp,y),krConsensusEst(code)]);
    out.rg=gr?gr.revenueGrowth:null; out.og=gr?gr.opProfitGrowth:null; out.eps=eps;
    const nmx=(typeof KR_TOP10_NAME_BY_CODE!=='undefined')?KR_TOP10_NAME_BY_CODE[code]:null;
    const cap=nmx?findKrMarketCapByName(nmx):null;
    if(cap!=null&&fin&&fin.revenue) out.psr=cap*1e12/fin.revenue;
    if(eps>0&&cons&&cons.est&&cons.est.length&&cons.lastAct&&cons.lastAct.netProfit>0&&cons.est[0].netProfit!=null){
      out.feps=eps*(cons.est[0].netProfit/1e8/cons.lastAct.netProfit);
    }
  }
  KR_STAT_CACHE[code]=out; return out;
}
async function fillKrRowStats(tableId){
  if(window.innerWidth<1000) return;
  const rows=Array.from(document.querySelectorAll('#'+tableId+' .wl-row'));
  await resolveDartCorpCodes(rows.map(r=>(r.dataset.t||'').split('.')[0]));
  let idx=0;
  async function worker(){
    while(idx<rows.length){
      const row=rows[idx++], code=(row.dataset.t||'').split('.')[0];
      try{
        const o=Object.assign({},await krStatsLite(code));
        const d=tickData[row.dataset.t];
        o.per=(d&&d.length&&o.eps>0)?d[d.length-1]/o.eps:null;
        putRowStats(row,o);
      }catch(e){ console.warn('KR 행 지표 실패',code,e); }
    }
  }
  await Promise.all([worker(),worker(),worker()]);
}
/* ===== 시가총액 11~20위 "더 보기" — 클릭 시 행 생성 + 시세 로딩 ===== */
const MORE_LOADED={};
const US_MORE=[['MU','마이크론'],['BRK-B','버크셔해서웨이'],['AMD','AMD'],['LLY','일라이릴리'],['JPM','JP모건'],['WMT','월마트'],['V','비자'],['XOM','엑슨모빌'],['INTC','인텔'],['JNJ','존슨앤드존슨']];
/* 21~30위: americancompanies.com 시가총액 순위(2026-10-08 기준) 중 11~20위 목록에 없는 종목을 순서대로 */
const US_MORE3=[['MA','마스터카드'],['ABBV','애브비'],['CSCO','시스코'],['BAC','뱅크오브아메리카'],['AMAT','어플라이드머티리얼즈'],['COST','코스트코'],['CAT','캐터필러'],['CVX','셰브론'],['UNH','유나이티드헬스'],['LRCX','램리서치']];
const KRCAP_MORE=[['012450','KS','한화에어로스페이스',53.3],['034020','KS','두산에너빌리티',52.1],['055550','KS','신한지주',48.7],['006400','KS','삼성SDI',46.2],['329180','KS','HD현대중공업',44.2],['000270','KS','기아',44.0],['034730','KS','SK',42.5],['068270','KS','셀트리온',42.4],['066570','KS','LG전자',37.9],['086790','KS','하나금융지주',35.0]];
const KRKQ_MORE=[['028300','KQ','HLB',6.3],['000250','KQ','삼천당제약',5.8],['403870','KQ','HPSP',5.7],['319660','KQ','피에스케이',4.5],['095340','KQ','ISC',4.4],['440110','KQ','파두',4.3],['031980','KQ','피에스케이홀딩스',4.3],['084370','KQ','유진테크',4.1],['067310','KQ','하나마이크론',3.5],['131290','KQ','티에스이',3.4]];
function moreRowsHtml(g){
  const act=(links)=>'<div class="wl-actions">'+links+'</div>';
  if(g==='cap2'||g==='cap3') return (g==='cap3'?US_MORE3:US_MORE).map((r,i)=>{
    const t=r[0], q=encodeURIComponent('$'+t+' from:trendspider');
    return '<div class="wl-row" data-t="'+t+'"><div class="wl-bar"></div><div class="wl-info"><div class="wl-tag">'+((g==='cap3'?21:11)+i)+'위 · '+r[1]+'</div><div class="wl-name"><a href="https://finviz.com/quote.ashx?t='+t+'" target="_blank" rel="noopener">'+t+'</a></div></div><div class="wl-spark"></div><div class="wl-quote"><div class="px wl-price">--</div><div class="ch wl-pct">--</div><div class="wl-52w"></div></div>'+
      act('<a href="https://finviz.com/quote.ashx?t='+t+'" target="_blank" rel="noopener" title="Finviz에서 '+t+' 상세 지표 보기">+</a><a href="https://x.com/search?q='+q+'&f=live" target="_blank" rel="noopener" class="ts-link" title="X에서 TrendSpider의 '+t+' 관련 게시물 검색">X</a><a href="https://finance.yahoo.com/quote/'+t+'/news/" target="_blank" rel="noopener" class="news-link" title="'+t+' 관련 최신 뉴스 보기">N</a><button type="button" class="fin-btn" data-stock-click="toggleUsFinancials(\''+t+'\')" title="재무비율·주가지표(Yahoo Finance)">재무</button>')+'</div>'+
      '<div id="fin-'+t+'" style="display:none;padding:14px 16px;border-bottom:1px solid var(--line);background:var(--panel2)"></div>';
  }).join('');
  const arr=g==='krcap2'?KRCAP_MORE:KRKQ_MORE;
  return arr.map((r,i)=>{
    const c=r[0], rank=g==='krcap2'?11+i:11+i;
    return '<div class="wl-row" data-t="'+c+'.'+r[1]+'"><div class="wl-bar"></div><div class="wl-info" data-stock-click="toggleFinancials(\''+c+'\',event)" style="cursor:pointer" title="빈 공간을 누르면 재무정보가 열립니다"><div class="wl-tag">'+rank+'위 · '+c+'</div><div class="wl-name"><a href="https://m.irgo.co.kr/IR-COMP/'+c+'" target="_blank" rel="noopener" title="'+r[2]+' IR 페이지 (IRGO)">'+r[2]+'</a></div></div><div class="wl-spark"></div><div class="wl-quote"><div class="px wl-price">--</div><div class="ch wl-pct">--</div><div class="wl-52w"></div></div>'+
      act('<a href="https://finance.naver.com/item/main.naver?code='+c+'" target="_blank" rel="noopener" title="네이버 증권에서 상세 지표 보기">+</a><a href="https://finance.yahoo.com/quote/'+c+'.'+r[1]+'/news/" target="_blank" rel="noopener" class="news-link" title="관련 최신 뉴스 보기">N</a><a href="#" data-stock-click="toggleFinancials(\''+c+'\')" style="color:#facc15" title="손익계산서(최근 5년 + 올해 예상, DART 전자공시)">재무</a>')+'</div>'+
      '<div id="fin-'+c+'" style="display:none;padding:14px 16px;border-bottom:1px solid var(--line);background:var(--panel2)"></div>';
  }).join('');
}
async function toggleMoreRows(g){
  const wrap=document.getElementById(g+'-wrap'), btn=document.getElementById(g+'-btn'); if(!wrap) return;
  const open=wrap.style.display!=='none';
  if(open){ wrap.style.display='none'; if(btn) btn.textContent=(g==='cap3'?'21~30위':'11~20위')+' 더 보기 ▾'; return; }
  wrap.style.display='block'; if(btn) btn.textContent=(g==='cap3'?'21~30위':'11~20위')+' 접기 ▴';
  if(!MORE_LOADED[g]){
    MORE_LOADED[g]=true;
    const tbl=document.getElementById(TICKGROUPS[g].table);
    tbl.innerHTML=moreRowsHtml(g);
    curPer[g]=curPer[g.replace(/[23]$/,'')]||'d';
    await loadTickGroup(g);
    if(g==='cap2') fillUsRowStats('cap2-tbl',2); else if(g==='cap3') fillUsRowStats('cap3-tbl',3); else fillKrRowStats(TICKGROUPS[g].table);
  }
}
const tickData={};
async function loadTickGroup(g){
  const list=TICKGROUPS[g].list;
  await Promise.all(list.map(async t=>{
    if(tickData[t]===undefined) tickData[t]=await yclose(t,'1y');
  }));
  renderTick(g,curPer[g]);
}
/* 52주(최근 1년 종가 데이터) 범위 내 현재가 위치를 얇은 바+점으로 표시한다. tickData가
   이미 1년치 종가를 갖고 있어(loadTickGroup) 별도 네트워크 호출 없이 그 배열의 최저/최고로
   계산한다 — "52주"는 근사치(거래일 기준 최근 1년)다. */
function render52wBar(el, d, last, cur, f){
  if(!el) return;
  if(!d || d.length<30){ el.innerHTML=''; return; }
  const lo=Math.min.apply(null,d), hi=Math.max.apply(null,d);
  if(!(hi>lo)){ el.innerHTML=''; return; }
  const pos=Math.max(0,Math.min(100,((last-lo)/(hi-lo))*100));
  el.innerHTML='<div title="52주 범위 '+cur+f(lo)+' ~ '+cur+f(hi)+' · 현재 위치 '+pos.toFixed(0)+'%" '+
    'style="width:100%;max-width:76px;margin-left:auto;height:4px;border-radius:2px;'+
    'background:linear-gradient(90deg,var(--down),var(--line) 50%,var(--up));position:relative">'+
    '<i style="position:absolute;top:-2.5px;left:'+pos.toFixed(1)+'%;width:9px;height:9px;border-radius:50%;'+
    'background:var(--tx);border:1.5px solid var(--panel);transform:translateX(-50%);display:block"></i></div>';
}
/* ===== 티커 옆 기술지표 아이콘: 5일선·200일선 위/아래 + RSI(14) =====
   tickData(최근 1년 일봉 종가)로 계산하므로 별도 네트워크 호출이 없다. 200일선은 최소 200거래일이
   필요해 데이터가 부족하면(신규 상장 등) 해당 아이콘만 생략한다. RSI는 Wilder 평활 방식. */
function smaLast(d,n){
  if(!d||d.length<n) return null;
  let s=0; for(let i=d.length-n;i<d.length;i++) s+=d[i];
  return s/n;
}
function rsiLast(d,n){
  n=n||14;
  if(!d||d.length<n+1) return null;
  let g=0,l=0;
  for(let i=1;i<=n;i++){ const c=d[i]-d[i-1]; if(c>=0) g+=c; else l-=c; }
  g/=n; l/=n;
  for(let i=n+1;i<d.length;i++){
    const c=d[i]-d[i-1];
    g=(g*(n-1)+(c>0?c:0))/n; l=(l*(n-1)+(c<0?-c:0))/n;
  }
  if(l===0) return 100;
  return 100-100/(1+g/l);
}
/* ===== 내부 자체 저평가·중립·고평가 신호등 (5일선·200일선 이격 + RSI 점수합) =====
   ① RSI(14): ≤30 -2 / ≤40 -1 / <60 0 / <70 +1 / ≥70 +2
   ② 200일선 이격률: ≤-10% -2 / ≤-3% -1 / <+10% 0 / <+25% +1 / ≥+25% +2   (장기 과열·침체)
   ③ 5일선 이격률: ≤-4% -1 / <+4% 0 / ≥+4% +1                              (단기 과열·침체, 가중치 작음)
   합계 -5~+5 : ≤-2 저평가(🟢) / -1~+1 중립(🟡) / ≥+2 고평가(🔴)
   200거래일 미만 종목은 ②를 생략하고 나머지 점수만 합산한다. 투자 권유가 아닌 참고용 내부 지표다. */
function valuationSignal(d,minLen){
  if(!d||d.length<(minLen||30)) return null;
  const last=d[d.length-1];
  const r=rsiLast(d,14); if(r==null) return null;
  let sr=r<=30?-2:r<=40?-1:r<60?0:r<70?1:2;
  const m200=smaLast(d,200), m5=smaLast(d,5);
  let s200=0, g200=null;
  if(m200!=null){ g200=(last/m200-1)*100; s200=g200<=-10?-2:g200<=-3?-1:g200<10?0:g200<25?1:2; }
  const g5=(last/m5-1)*100;
  const s5=g5<=-4?-1:g5<4?0:1;
  const total=sr+s200+s5;
  const lv=total<=-2?{k:'low',icon:'🟢',label:'저평가'}:total>=2?{k:'high',icon:'🔴',label:'고평가'}:{k:'mid',icon:'🟡',label:'중립'};
  const fmtS=v=>(v>0?'+':'')+v;
  const tip='[자체 판정] '+lv.label+' (점수 '+fmtS(total)+')\n'+
    'RSI '+r.toFixed(0)+' → '+fmtS(sr)+'\n'+
    (g200!=null?'200일선 이격 '+(g200>=0?'+':'')+g200.toFixed(1)+'% → '+fmtS(s200)+'\n':'200일선 데이터 부족 → 제외\n')+
    '5일선 이격 '+(g5>=0?'+':'')+g5.toFixed(1)+'% → '+fmtS(s5)+'\n'+
    '※ 5일선·200일선·RSI 기반 참고용 지표(투자 권유 아님)';
  return {total:total, level:lv.k, icon:lv.icon, label:lv.label, tip:tip};
}
function techBadgesHtml(d,minLen){
  if(!d||d.length<(minLen||30)) return '';
  const last=d[d.length-1];
  const mk=(n)=>{
    const m=smaLast(d,n); if(m==null) return '';
    const up=last>=m, gap=(last/m-1)*100;
    return '<span class="tb '+(up?'tb-up':'tb-dn')+'" title="'+n+'일 이동평균선 '+(up?'위':'아래')+' (이격 '+(gap>=0?'+':'')+gap.toFixed(1)+'%)">'+n+(up?'▲':'▼')+'</span>';
  };
  const r=rsiLast(d,14);
  let rs='';
  if(r!=null){
    const cl=r>=70?'tb-hot':(r<=30?'tb-cold':'tb-mid');
    const tip=r>=70?'과매수 구간(70 이상)':(r<=30?'과매도 구간(30 이하)':'중립 구간(30~70)');
    rs='<span class="tb '+cl+'" title="RSI(14) '+r.toFixed(1)+' · '+tip+'">RSI '+Math.round(r)+(r>=70?'🔥':(r<=30?'🧊':''))+'</span>';
  }
  return mk(5)+mk(200)+rs;
}
function injectTechBadgeCss(){
  if(document.getElementById('tb-css')) return;
  const st=document.createElement('style'); st.id='tb-css';
  st.textContent='.wl-name{white-space:normal!important;overflow:visible!important}'+
    '.wl-sig{display:inline-block;margin-right:6px;font-size:14px;line-height:1;cursor:help;vertical-align:middle}'+
    '.wl-ind{display:inline-flex;flex-wrap:wrap;gap:4px;margin-left:8px;vertical-align:middle}'+
    '@media(max-width:560px){.wl-ind{display:flex;flex-wrap:nowrap;gap:3px;margin-left:0;margin-top:5px}.tb{font-size:9.5px;padding:3px 4px;letter-spacing:-.3px}}'+
    '@media(max-width:380px){.wl-ind{gap:2px}.tb{font-size:8.5px;padding:3px 3px;letter-spacing:-.4px}}'+
    '.tb{display:inline-block;font-size:10.5px;font-weight:800;line-height:1;padding:3px 6px;border-radius:5px;white-space:nowrap;cursor:help}'+
    '.tb-up{background:rgba(200,32,20,.13);color:var(--up)}'+
    '.tb-dn{background:rgba(26,111,168,.14);color:var(--down)}'+
    '.tb-mid{background:rgba(0,0,0,.08);color:var(--tx2)}'+
    '.tb-hot{background:rgba(200,32,20,.2);color:var(--up)}'+
    '.tb-cold{background:rgba(26,111,168,.2);color:var(--down)}';
  document.head.appendChild(st);
}
/* 레버리지 ETF: 2일 이상 연속 하락 → "N연하", 연속 하락 구간 누적 하락률(종가 기준) 30% 초과 → "급락" */
function levDropBadges(d){
  if(!d||d.length<4) return '';
  let n=0,i=d.length-1;
  while(i>0&&d[i]<d[i-1]){ n++; i--; }
  if(n<1) return '';
  const cum=(1-d[d.length-1]/d[i])*100;
  let h='';
  const st='color:#fff;';
  if(n===2) h+='<span class="tb tb-streak s2" style="background:#E4E7EC;color:#344054;font-weight:800" title="2거래일 연속 하락 (누적 −'+cum.toFixed(1)+'%)">2연하</span>';
  if(n>=3) h+='<span class="tb tb-streak'+(n>=4?' s4':' s3')+'" style="'+st+'background:'+(n>=4?'#7E22CE':'#C2410C')+';box-shadow:0 0 0 2px '+(n>=4?'rgba(126,34,206,.28)':'rgba(194,65,12,.28)')+';font-weight:800" title="'+n+'거래일 연속 하락 (누적 −'+cum.toFixed(1)+'%)">'+n+'연하</span>';
  if(cum>30) h+='<span class="tb" style="'+st+'background:#dc2626" title="연속 하락 구간 종가 기준 누적 −'+cum.toFixed(1)+'% (30% 초과)">급락 −'+cum.toFixed(0)+'%</span>';
  return h;
}
function levStreakN(d){ if(!d||d.length<4) return 0; let n=0,i=d.length-1; while(i>0&&d[i]<d[i-1]){ n++; i--; } return n; }
function renderTickBadges(row,d){
  const nm=row.querySelector('.wl-name'); if(!nm) return;
  injectTechBadgeCss();
  let box=nm.querySelector('.wl-ind');
  const html=techBadgesHtml(d);
  if(!html){ if(box) box.remove(); return; }
  if(!box){ box=document.createElement('span'); box.className='wl-ind'; nm.appendChild(box); }
  box.innerHTML=html+(row.closest('#lev-tbl,#krlev-tbl')?levDropBadges(d):'');
  if(row.closest('#lev-tbl,#krlev-tbl')){ const sn=levStreakN(d); row.classList.toggle('st3',sn===3); row.classList.toggle('st4',sn>=4); }
  // 티커명 앞 신호등
  let sg=nm.querySelector('.wl-sig');
  const sig=valuationSignal(d);
  if(!sig){ if(sg) sg.remove(); return; }
  if(!sg){ sg=document.createElement('span'); sg.className='wl-sig'; nm.insertBefore(sg,nm.firstChild); }
  sg.textContent=sig.icon; sg.title=sig.tip;
}
function renderTick(g,p){
  const cfg=TICKGROUPS[g]; if(!cfg)return;
  const cur=cfg.cur||'$', f=cfg.fmt||fmt;
  const n={d:1,w:5,m:21,y:252}[p];
  document.querySelectorAll('#'+cfg.table+' .wl-row').forEach(row=>{
    const t=row.dataset.t, d=tickData[t];
    const px=row.querySelector('.px'), ch=row.querySelector('.ch'), bar=row.querySelector('.wl-bar'), sp=row.querySelector('.wl-spark'), w52=row.querySelector('.wl-52w');
    if(!d||d.length<2){
      row.dataset.quoteState=d===null?'error':'loading';
      if(px){px.textContent='—';px.className='px wl-price';}
      if(ch){ch.textContent=d===null?'조회 실패':'조회 중';ch.className='ch wl-pct';}
      if(bar)bar.className='wl-bar';if(sp)sp.innerHTML='';if(w52)w52.innerHTML='';
      return;
    }
    row.dataset.quoteState='ready';
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
      if(w52) w52.innerHTML='';
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
    render52wBar(w52, d, last, cur, f);
    renderTickBadges(row,d);
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
    if(TICKGROUPS[g]){ renderTick(g,p); if(TICKGROUPS[g+'2']&&MORE_LOADED[g+'2']){ curPer[g+'2']=p; renderTick(g+'2',p); } if(TICKGROUPS[g+'3']&&MORE_LOADED[g+'3']){ curPer[g+'3']=p; renderTick(g+'3',p); } }
    else if(g==='us') renderUS(p);
    else if(g==='cf') renderCF(p);
    else if(g==='coin') renderCoin(p);
    else if(g==='fx') renderFxWatchlist(p);
    else if(g==='usrel') renderIdxRelUS(p);
    else if(g==='caprel') renderCapRelCompare('us-caprel-chart','cap',US_CAP_DATA,p);
    else if(g==='krrel') renderIdxRelKR(p);
    else if(g==='krcaprel') renderCapRelCompare('krcap-caprel-chart','krcap',KRCAP_CAP_DATA,p);
    else if(g==='cryrel') renderCryptoRel(p);
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
const ECOS_STAT_MARKET_RATE='817Y002'; // 시장금리, 일별 — 항목코드(010200000 등)와 실제로 매칭 확인된 통계표(2026-09-28 직접 검증)
const ECOS_ITEM={
  treasury3y:'010200000',   // 국고채(3년)
  treasury10y:'010210000',  // 국고채(10년)
  corpAA:'010300000',       // 회사채(3년,AA-)
  corpBBB:'010320000'       // 회사채(3년,BBB-)
};

/* [2026-09-28] getJSON()의 공개 프록시 폴백(allorigins/codetabs/thingproxy)이 ecos.bok.or.kr에
   대해 간헐적으로 막히거나 느려서, t3y·AA·BBB 3개를 Promise.all로 동시에 부를 때 셋 중
   하나만 랜덤하게 실패하는 경우가 있었다(6번은 되는데 7번만 '준비중'으로 뜨는 현상의 원인).
   ECOS는 KRX와 달리 헤더 없는 공개 API라 Worker가 굳이 아니어도 되지만, 안정성을 위해
   Worker로 먼저 시도하고 실패하면 한 번 더 재시도(짧은 지연 후) — 공개 프록시로는 폴백하지 않는다. */
async function ecosSeries(itemCode, days){
  if(!ECOS_KEY || !itemCode) return null;
  const end=new Date(), start=new Date(); start.setDate(end.getDate()-(days||60));
  const fmt8=d=>d.getFullYear()+String(d.getMonth()+1).padStart(2,'0')+String(d.getDate()).padStart(2,'0');
  const url='https://ecos.bok.or.kr/api/StatisticSearch/'+ECOS_KEY+'/json/kr/1/200/'+
      ECOS_STAT_MARKET_RATE+'/D/'+fmt8(start)+'/'+fmt8(end)+'/'+itemCode;
  const attempt=async()=>{
    const target=PROXY_BASE?PROXY_BASE+encodeURIComponent(url):url;
    const c=new AbortController(), t=setTimeout(()=>c.abort(),10000);
    try{
      const r=await fetch(target,{signal:c.signal}); clearTimeout(t);
      if(!r.ok) return null;
      const j=await r.json();
      if(j.RESULT){ console.warn('ECOS 오류('+itemCode+'):', j.RESULT.MESSAGE||j.RESULT); return null; }
      const rows=(j.StatisticSearch||{}).row||[];
      if(!rows.length){ console.warn('ECOS 빈 응답('+itemCode+') — 통계표/항목코드 확인 필요:', j); return null; }
      return rows.map(r2=>({t:r2.TIME, v:+r2.DATA_VALUE})).filter(r2=>isFinite(r2.v)).sort((a,b)=>a.t.localeCompare(b.t));
    }catch(e){ clearTimeout(t); console.warn('ECOS 호출 실패('+itemCode+'):', e); return null; }
  };
  let res=await attempt();
  if(!res){ await new Promise(r=>setTimeout(r,600)); res=await attempt(); }
  return res;
}

async function loadEcosIndicators(){
  if(!ECOS_KEY || !ECOS_ITEM.treasury3y || !ECOS_ITEM.corpAA || !ECOS_ITEM.corpBBB){
    return null; // 설정 미완료 — 위 안내 참고
  }
  const [t3y, aa, bbb] = await Promise.all([
    ecosSeries(ECOS_ITEM.treasury3y, 90),
    ecosSeries(ECOS_ITEM.corpAA, 90),
    ecosSeries(ECOS_ITEM.corpBBB, 90)
  ]);
  const result={};
  /* 7. 정크본드 수요: 신용스프레드 = BBB- 금리 - AA- 금리. 스프레드가 좁을수록(위험선호) 탐욕, 벌어질수록 공포.
     [계산값 보정 — 2026-09-28 실측] 한국 회사채(3년) AA-/BBB- 스프레드는 미국 IG/HY 스프레드와
     스케일이 전혀 달라 항상 5.7~5.9%p 근처에서 움직인다(등급 체계상 BBB-가 사실상 투기등급에
     가까운 취급을 받기 때문). 기존 0.5~3.0%p 고정 구간으로는 매일 스프레드가 구간 최댓값을
     넘어서 점수가 계속 0(공포 고정)으로 나오는 문제가 있었다. 절대 구간 대신 최근 90일 스프레드의
     최소~최대 범위 내 상대 위치(percentile)로 정규화해 어떤 절대 수준에서도 스스로 보정되게 한다
     (좁을수록=범위 내 최소에 가까울수록 탐욕, 넓을수록=최대에 가까울수록 공포). */
  if(aa && bbb && aa.length && bbb.length){
    const bbbByDate={}; bbb.forEach(r=>bbbByDate[r.t]=r.v);
    const spreadSeries=aa.filter(r=>bbbByDate[r.t]!=null).map(r=>({t:r.t, v:bbbByDate[r.t]-r.v}));
    if(spreadSeries.length){
      const vals=spreadSeries.map(r=>r.v);
      const spread=vals[vals.length-1];
      const lo=Math.min(...vals), hi=Math.max(...vals);
      result.creditSpread=spread;
      result.creditScore=(hi>lo)?((hi-spread)/(hi-lo))*100:50;
    }
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
/* [2026-09-28 발견/수정] KRX는 AUTH_KEY 헤더가 필수라 Worker(PROXY_BASE)를 거쳐야만
   응답할 수 있다 — getJSON()의 공개 프록시 폴백(allorigins/codetabs/thingproxy)은 그
   헤더를 넣어줄 수 없어 KRX 호출에는 애초에 성공할 수 없는데도, 기존 코드는 매 요청마다
   이 3개를 전부 5초씩 타임아웃날 때까지 시도했다. 게다가 미승인 카테고리(401)는 어떤
   날짜로 바꿔도 절대 통과되지 않는데 krxJSONRecent가 이를 구분 못 해 10일치를 전부
   반복 시도했다 — 결과적으로 미승인 API 하나당 최대 4프록시×5초×10일=200초 가까이
   걸려 사실상 영구 로딩(화면엔 "준비중")으로 보였다. 이제 KRX 호출은 Worker로 직접
   1회만 붙고, 401(미승인)이면 즉시 포기해서 다른 날짜/프록시를 반복하지 않는다. */
async function krxJSON(path, basDd){
  if(!PROXY_BASE) return null;
  const url='https://data-dbg.krx.co.kr/svc/apis/'+path+'?basDd='+basDd;
  try{
    const c=new AbortController(), t=setTimeout(()=>c.abort(),8000);
    const r=await fetch(PROXY_BASE+encodeURIComponent(url),{signal:c.signal});
    clearTimeout(t);
    let j=null; try{ j=await r.json(); }catch(_){}
    if(j && j.respCode==='401'){
      console.warn('KRX 미승인 카테고리('+path+') — data-dbg.krx.co.kr 포털에서 해당 API 신청 필요:', j.respMsg);
      const err=new Error('KRX_UNAUTHORIZED'); err.krxUnauthorized=true; throw err;
    }
    if(!r.ok){ console.warn('KRX 호출 실패('+path+'):', r.status, j); return null; }
    if(j && j.OutBlock_1) return j.OutBlock_1;
    console.warn('KRX 응답에 OutBlock_1 없음('+path+'):', j);
    return null;
  }catch(e){
    if(e && e.krxUnauthorized) throw e;
    console.warn('KRX 호출 실패('+path+'):', e); return null;
  }
}
async function krxJSONRecent(path, maxBack){
  /* KRX Open API는 최근 2~4거래일치가 아직 집계되지 않아 비어있는 경우가 많다(2026-09-28
     직접 검증: 금요일치도 비어있고 화요일치부터 정상). 휴장일까지 겹치면 5일로는 부족할 수
     있어 기본을 10일로 늘려 최근 거래일까지 확실히 소급한다. 단 401(미승인)이면 날짜를
     바꿔도 의미가 없으므로 즉시 중단한다. */
  for(let i=0;i<(maxBack||10);i++){
    const d=new Date(); d.setDate(d.getDate()-i);
    let rows;
    try{ rows=await krxJSON(path, fmtYmd(d)); }
    catch(e){ if(e && e.krxUnauthorized) return null; throw e; }
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

/* 3번(주가 폭)은 당일 KRX 전종목 일별매매정보 한 번(코스피 sto/stk_bydd_trd + 코스닥
   sto/ksq_bydd_trd)만 호출하면 계산 가능하다 — 여러 날치 이력이 필요한 2번(52주
   신고가/신저가)과 달리 Worker Cron/KV 없이도 브라우저에서 직접 계산할 수 있다.
   [2026-09-28 실측] sto/stk_bydd_trd(코스피, 이미 승인됨) 한 번에 942개 종목 전체가
   한 응답으로 온다. sto/ksq_bydd_trd(코스닥)는 별도 카테고리 승인이 필요 — 미승인 시
   401을 반환하므로 코스피만으로 계산하고 market 표시에 반영한다. */
async function loadKrBreadthDirect(){
  try{
    const [kospiRows, kosdaqRows]=await Promise.all([
      krxJSONRecent('sto/stk_bydd_trd', 10),
      krxJSONRecent('sto/ksq_bydd_trd', 10).catch(()=>null)
    ]);
    const rows=[].concat(kospiRows||[], kosdaqRows||[]);
    if(!rows.length) return null;
    let advVal=0, declVal=0;
    rows.forEach(r=>{
      const fluc=+pick(r,['FLUC_RT']);
      const val=+pick(r,['ACC_TRDVAL'])||0;
      if(!isFinite(fluc)) return;
      if(fluc>0) advVal+=val; else if(fluc<0) declVal+=val;
    });
    const total=advVal+declVal;
    if(!total) return null;
    const market='KOSPI'+(kosdaqRows&&kosdaqRows.length?'+KOSDAQ':'(코스닥 미승인)');
    return {breadth:{advVol:advVal, declVol:declVal, score:(advVal/total)*100}, market, date: pick(rows[0],['BAS_DD'])};
  }catch(e){ console.warn('주가폭(직접 계산) 실패:', e); return null; }
}

/* P2P 페이지 — 에잇퍼센트 오픈예정 상품 목록 (Worker /p2p-8percent) */
async function loadP2pOpenSoon(){
  const box=document.getElementById('p2p-open-list'), st=document.getElementById('p2p-open-status');
  if(!box) return;
  const note=(ic,t,d,tone)=>'<div class="mk-note '+(tone||'')+'" role="status"><span class="mk-note-ic" aria-hidden="true">'+ic+'</span><div><b>'+t+'</b><p>'+d+'</p></div></div>';
  const fail=m=>{ if(st) st.textContent=''; box.innerHTML=/없습니다/.test(m)&&!/불러오지/.test(m)?note('📭','현재 오픈예정인 상품이 없습니다','새 상품이 올라오면 이 목록에 자동으로 표시됩니다. 공식 사이트에서 직접 확인할 수도 있어요.'):note('⚠','오픈예정 상품을 불러오지 못했습니다','잠시 후 새로고침하거나 에잇퍼센트 공식 사이트에서 직접 확인해 주세요. 연결이 일시적으로 지연됐을 수 있습니다.','warn'); };
  if(!PROXY_BASE){ fail('⚠ PROXY_BASE가 설정되어 있지 않습니다.'); return; }
  try{
    const origin=PROXY_BASE.replace(/\?url=$/,'');
    const r=await fetch(origin+'p2p-8percent',{signal:AbortSignal.timeout?AbortSignal.timeout(15000):undefined});
    const d=r.ok?await r.json():null;
    if(!d){ fail('⚠ 오픈예정 상품을 불러오지 못했습니다. 공식 사이트에서 확인해 주세요.'); return; }
    if(!d.items||!d.items.length){ fail('현재 오픈예정인 상품이 없습니다.'); return; }
    const esc=t=>String(t==null?'':t).replace(/[<>&"]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]));
    const eok=v=>v>=1e8?(v/1e8).toFixed(1).replace(/\.0$/,'')+'억원':Math.round(v/1e4).toLocaleString('ko-KR')+'만원';
    const fmtDt=iso=>{ if(!iso) return '—'; const m=String(iso).match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/); return m?(+m[2])+'/'+(+m[3])+' '+m[4]+':'+m[5]:'—'; };
    const GC={'A+':'#1fa463','A':'#1fa463','A-':'#4fa383','B+':'#8a6500','B':'#8a6500','B-':'#d98a00'};
    /* ===== 김군 자체 종합평가(100점) — 에잇 등급 · LTV · 채권순위 · 담보여유금 · 차주(신용·소득·연체) 통합 산출 =====
       등급 25 + LTV 20 + 채권순위 10 + 담보여유금 15 + 차주 신용 15 + 소득 대비 이자부담 10 + 연체 5.
       증권계좌담보는 LTV 항목(20점)을 제외하고 80점 만점을 100점으로 환산. 연체·체납 이력이 있으면 최고 B등급.
       S ≥85 · A ≥75 · B ≥65 · C ≥55 · D 미만 (공식 등급이 아닌 참고 지표) */
    const selfEval=x=>{
      const P=[]; const add=(k,v,mx)=>P.push({k,v,mx});
      add('에잇 등급',{'A+':25,'A':22,'A-':19,'B+':15,'B':12,'B-':9}[x.grade]||5,25);
      let fr=null;
      if(x.appraised!=null){
        const l=x.ltv!=null?Number(x.ltv):null;
        if(l!=null) add('LTV',l<=30?20:l<=40?17:l<=50?13:l<=60?8:l<=65?5:2,20);
        if(x.priorAmount>0){ const r=x.priorAmount/x.appraised; add('채권순위(후순위)',r<=.3?6:r<=.5?4:2,10); } else add('채권순위(선순위)',10,10);
        fr=Math.max(0,x.appraised-(x.priorLoan||0)-x.amount)/x.appraised;
      }else if(x.acctValue!=null){
        add('채권순위(선순위)',10,10); fr=Math.max(0,x.acctValue-x.amount)/x.acctValue;
      }
      if(fr!=null) add('담보여유금',fr>=.7?15:fr>=.6?12:fr>=.5?9:fr>=.4?5:2,15);
      if(x.kcbGrade!=null) add('차주 신용',x.kcbGrade<=2?15:x.kcbGrade===3?13:x.kcbGrade===4?10:x.kcbGrade===5?7:x.kcbGrade===6?4:1,15);
      if(x.income) add('소득 대비 이자',(()=>{const rr=x.amount*(x.rate||0)/100/12/x.income;return rr<=.1?10:rr<=.2?8:rr<=.35?5:2;})(),10); else if(x.age!=null) add('소득 대비 이자',5,10);
      if(x.clean!=null) add('연체·체납',x.clean?5:0,5);
      const sum=P.reduce((a,b)=>a+b.v,0), mx=P.reduce((a,b)=>a+b.mx,0);
      if(mx<60||x.kcbGrade==null) return null;
      const score=Math.round(sum/mx*100);
      let g=score>=85?'S':score>=75?'A':score>=65?'B':score>=55?'C':'D';
      const capped=x.clean===false&&(g==='S'||g==='A'); if(capped) g='B';
      return {score,g,P,capped};
    };
    d.items.forEach(x=>{ x.ev=selfEval(x); });
    const byRate=(a,b)=>(b.rate||0)-(a.rate||0);
    const sList=d.items.filter(x=>x.ev&&x.ev.g==='S').sort((a,b)=>b.ev.score-a.ev.score||byRate(a,b)); const sRank=new Map(sList.map((x,i)=>[x.id,i+1]));
    const chip=(t,bg,fg)=>'<span style="display:inline-block;font-size:11px;font-weight:800;padding:1px 8px;border-radius:99px;background:'+bg+';color:'+fg+';white-space:nowrap">'+t+'</span>';
    const GE={S:'#6d28d9',A:'#14804a',B:'#8a6500',C:'#a85f00',D:'#c4251c'};
    const cell=(k,v,sub,bar,bc)=>'<div style="min-width:0"><div class="mut" style="font-size:12px">'+k+'</div><div style="font-size:14px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+v+'</div>'+
      '<div style="height:4px;border-radius:2px;background:var(--panel);margin-top:2px;overflow:hidden">'+(bar!=null?'<i style="display:block;height:4px;width:'+Math.max(0,Math.min(100,bar))+'%;background:'+bc+'"></i>':'')+'</div><div class="mut" style="font-size:11.5px;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+(sub||'&nbsp;')+'</div></div>';
    const card=x=>{
      const S=sRank.has(x.id), hi=x.grade==='A+'||S, AC=S?'#7c3aed':'#1fa463';
      const estate=x.appraised!=null, stock=x.acctValue!=null;
      const m=String(x.title||'').match(/^(.*?\d+호)\s*(.*)$/);
      const head=m?m[1]:x.title, tail=m?m[2]:'';
      const ltv=x.ltv!=null?Number(x.ltv):null;
      const lc=ltv==null?'var(--tx2)':ltv<=50?'#1fa463':ltv<=65?'#8a6500':'#e5332a';
      const badge=S?'<b style="font-size:11.5px;color:#fff;background:linear-gradient(135deg,#7c3aed,#c026d3);border-radius:8px;padding:1px 8px">S <small style="font-weight:700;opacity:.85">(에잇 '+esc(x.grade)+')</small></b>':
        (x.grade?'<b style="font-size:11.5px;color:#fff;background:'+(GC[x.grade]||'#888')+';border-radius:8px;padding:1px 8px">'+esc(x.grade)+'</b>':'');
      let chips='';
      if(estate) chips+=(x.priorAmount>0?chip('후순위','rgba(229,51,42,.14)','#c4281f'):chip('선순위','rgba(31,164,99,.16)','#12804a'))+' ';
      else if(stock) chips+=chip('선순위','rgba(31,164,99,.16)','#12804a')+' ';
      if(x.reason) chips+=chip('🎯 '+esc(x.reason),'var(--panel)','var(--tx)');
      /* 2×2 핵심 정보 */
      let c1,c2;
      if(estate){
        const free=Math.max(0,x.appraised-(x.priorLoan||0)-x.amount), pct=free/x.appraised*100;
        c1=cell('LTV',ltv!=null?'<span style="color:'+lc+'">'+ltv+'%</span>':'—',x.priorAmount>0?'선순위 '+eok(x.priorAmount):'감정가 '+eok(x.appraised),ltv,lc);
        c2=cell('담보여유금',eok(free)+' <small style="color:#1fa463">('+pct.toFixed(0)+'%)</small>','감정가 '+eok(x.appraised)+' 대비',pct,'#1fa463');
      }else if(stock){
        const free=Math.max(0,x.acctValue-x.amount), pct=free/x.acctValue*100;
        c1=cell('담보유지비율',x.maintain?x.maintain+'%':'—',esc(x.broker||''),null);
        c2=cell('담보여유금',eok(free)+' <small style="color:#1fa463">('+pct.toFixed(0)+'%)</small>','계좌평가 '+eok(x.acctValue)+' 대비',pct,'#1fa463');
      }else{ c1=cell('LTV',ltv!=null?ltv+'%':'—','',ltv,lc); c2=cell('담보여유금','—','',null); }
      const inc=(x.income!=null&&isFinite(+x.income))?(x.income/1e4).toLocaleString('ko-KR',{maximumFractionDigits:0})+'만':'—';
      const c3=cell('차주 나이·월소득',(x.age!=null?x.age+'세':'—')+' · '+inc,'',null);
      const kc=x.kcbGrade!=null?'<span style="color:'+(x.kcbGrade<=3?'#1fa463':x.kcbGrade<=5?'#8a6500':'#e5332a')+'">KCB '+x.kcbGrade+'등급</span>':'—';
      const c4=cell('신용 · 연체',kc+' · '+(x.clean==null?'—':x.clean?'<span style="color:#1fa463">무연체</span>':'<span style="color:#e5332a">연체이력</span>'),x.kcbScore?x.kcbScore+'점':'',null);
      /* 김군 평가 (근거는 카드 위에 겹쳐 열려 카드 높이에 영향 없음) */
      const ev=x.ev?'<details class="p2p-ev" style="position:relative"><summary style="cursor:pointer;list-style:none;display:flex;align-items:center;gap:6px;padding:4px 8px;border-radius:8px;border:1.5px solid '+GE[x.ev.g]+';background:var(--panel)"><b style="color:#fff;background:'+GE[x.ev.g]+';border-radius:6px;padding:0 7px;font-size:12px">김군 평가 '+x.ev.g+'</b><b style="font-size:13.5px">'+x.ev.score+'점</b>'+(x.ev.capped?'<span style="font-size:10.5px;color:#e5332a;font-weight:800">연체→B상한</span>':'')+'<span class="mut" style="margin-left:auto;font-size:10.5px">근거 ▾</span></summary>'+
        '<div style="position:absolute;left:0;right:0;top:100%;z-index:5;margin-top:3px;padding:6px 10px 8px;border-radius:9px;border:1.5px solid '+GE[x.ev.g]+';background:var(--panel2);box-shadow:0 8px 24px rgba(0,0,0,.28)">'+x.ev.P.map(p=>'<div style="display:flex;align-items:center;gap:6px;font-size:11.5px;margin-top:4px"><span style="flex:none;width:92px" class="mut">'+p.k+'</span><span style="flex:1;height:6px;border-radius:3px;background:var(--panel);overflow:hidden"><i style="display:block;height:6px;width:'+(p.v/p.mx*100)+'%;background:'+(p.v/p.mx>=.75?'#1fa463':p.v/p.mx>=.45?'#8a6500':'#e5332a')+'"></i></span><b style="flex:none;width:38px;text-align:right">'+p.v+'/'+p.mx+'</b></div>').join('')+'</div></details>':'<div style="height:30px"></div>';
      const schOpen='<div class="p2p-open"><span>⏰ 오픈</span><b>'+fmtDt(x.openAt)+'</b>'+(x.reservationStart?'<em>📝 예약 '+fmtDt(x.reservationStart)+' ~ '+fmtDt(x.reservationClose)+'</em>':'')+'</div>';
      const borderC=S?'#7c3aed':hi?'#1fa463':'var(--line)';
      return '<a class="p2p-card'+(S?' is-s':hi?' is-hi':'')+'" href="'+esc(x.url)+'" target="_blank" rel="noopener" style="border-color:'+borderC+'">'+
        '<div class="p2p-r1"><span>'+esc(x.category)+(x.reservationOpen?' · <b style="color:var(--up)">예약중</b>':'')+(S?' · <b style="color:#7c3aed">⭐ 우선 '+sRank.get(x.id)+'순위</b>':'')+'</span>'+badge+'</div>'+
        '<div class="p2p-r2"><div class="p2p-hd" style="color:'+(hi?AC:'var(--tx)')+'">'+esc(head)+'</div><div class="p2p-tl" title="'+esc(tail)+'">'+esc(tail)+'&nbsp;</div></div>'+
        '<div class="p2p-r3"><div class="p2p-yield"><small>연 수익률</small><b>'+(x.rate!=null?x.rate.toFixed(1)+'<i>%</i>':'—')+'</b></div>'+
          '<div class="p2p-kv"><div><span>기간</span><b>'+(x.months?x.months+'개월':'—')+'</b></div><div><span>모집</span><b>'+(x.amount?eok(x.amount):'—')+'</b></div></div></div>'+
        schOpen.replace(/<em>.*?<\/em>/,'')+
        '<button type="button" class="p2p-dt-btn" aria-expanded="false">상세보기 ▾</button>'+
        '<div class="p2p-dt"><div class="p2p-chips">'+chips+'</div><div class="p2p-g4">'+c1+c2+c3+c4+'</div>'+(schOpen.match(/<em>.*?<\/em>/)?'<div class="p2p-res">'+schOpen.match(/<em>(.*?)<\/em>/)[1]+'</div>':'')+ev+'</div></a>';
    };
    const gridS='display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));align-items:start;gap:12px;margin-top:8px';
    const SECS=[['부동산담보','🏠 부동산담보 상품'],['증권계좌담보','📈 증권계좌담보 상품'],['개인신용','💳 개인신용 상품']];
    let html='', secIdx=0;
    const mobP2p=!!(window.matchMedia&&window.matchMedia('(max-width:700px)').matches); let budgetP2p=3;
    SECS.forEach(([cat,title])=>{
      const items=d.items.filter(x=>x.category===cat); if(!items.length) return;
      const isTop=x=>x.grade==='A+'||sRank.has(x.id);
      let top=items.filter(isTop).sort((a,b)=>(sRank.has(b.id)-sRank.has(a.id))||(sRank.has(a.id)&&sRank.has(b.id)?sRank.get(a.id)-sRank.get(b.id):byRate(a,b)));
      let rest=items.filter(x=>!isTop(x)).sort(byRate); const id='p2p-more-'+(secIdx++);
      /* 모바일: 전체 합쳐 상품 최대 3개만 먼저 보이고(우선순위 순) 나머지는 "상세보기"로 펼침 */
      if(mobP2p){ const all=top.concat(rest), n=Math.min(budgetP2p,all.length); top=all.slice(0,n); rest=all.slice(n); budgetP2p-=n; }
      html+='<h3 style="font-size:16px;margin:22px 0 4px;font-weight:900">'+title+' <span class="mut" style="font-weight:600;font-size:12.5px">('+items.length+'건 · S급·A+ 우선, 연 수익률 높은 순)</span></h3>'+
        (top.length?'<div style="'+gridS+'">'+top.map(card).join('')+'</div>':(mobP2p?'':'<p class="mut" style="font-size:12.5px;margin-top:8px">A+ 등급 오픈예정 상품이 없습니다.</p>'))+
        (rest.length?'<div style="text-align:center;margin-top:12px"><button type="button" class="btn sm p2p-more-btn" data-t="'+id+'" data-n="'+rest.length+'" style="padding:6px 18px">상세보기 ▼ (나머지 '+rest.length+'건)</button></div><div id="'+id+'" style="display:none"><div style="'+gridS+'">'+rest.map(card).join('')+'</div></div>':'');
    });
    if(st) st.textContent='총 '+d.items.length+'건'+((d.updated&&!isNaN(new Date(d.updated)))?' · '+new Date(d.updated).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})+' 기준':'');
    box.innerHTML=html+'<p class="mut" style="font-size:11.5px;margin:14px 0 0;line-height:1.55">⭐ 김군 평가는 자체 종합점수(100점)입니다 — 에잇 등급 25 · LTV 20 · 채권순위 10 · 담보여유금 15 · 차주 신용 15 · 소득 대비 이자 10 · 연체 5 (S≥85, A≥75, B≥65, C≥55, 증권계좌는 LTV 제외 환산, 연체 이력은 최고 B). S급 현재 '+sList.length+'건. 공식 등급이 아니며 투자 권유가 아닙니다.<br>담보여유금 = 감정가 − 선순위 대출 − 본 대출(증권계좌는 계좌평가액 − 대출)로 계산한 참고값입니다.</p>';
    box.onclick=function(e){
      const db=e.target.closest('.p2p-dt-btn'); if(db){ e.preventDefault(); const cd=db.closest('.p2p-card'), o=!cd.classList.contains('open'); cd.classList.toggle('open',o); db.setAttribute('aria-expanded',String(o)); db.textContent=o?'접기 ▴':'상세보기 ▾'; return; }
      const ev=e.target.closest('.p2p-ev'); if(ev){ e.preventDefault(); if(e.target.closest('summary')) ev.open=!ev.open; return; }
      const mb=e.target.closest('.p2p-more-btn');
      if(mb){ const m=document.getElementById(mb.dataset.t); const o=m.style.display==='none'; m.style.display=o?'block':'none'; mb.textContent=o?'접기 ▲':'상세보기 ▼ (나머지 '+mb.dataset.n+'건)'; return; }
    };
  }catch(e){ console.warn('P2P 오픈예정 실패',e); fail('⚠ 오픈예정 상품을 불러오지 못했습니다.'); }
}

/* 금융상품 페이지 — 카드고릴라 인기카드 Top10 (Worker /card-top10) */
async function loadCardTop(){
  const box=document.getElementById('fin-card-top'), st=document.getElementById('fin-card-status');
  if(!box) return;
  const fail=msg=>{ if(st) st.textContent=msg; };
  if(!PROXY_BASE){ fail('⚠ PROXY_BASE가 설정되어 있지 않습니다.'); return; }
  try{
    const origin=PROXY_BASE.replace(/\?url=$/,'');
    const r=await fetch(origin+'card-top10',{signal:AbortSignal.timeout?AbortSignal.timeout(15000):undefined});
    let d=r.ok?await r.json():null;
    if(!d||!d.items||!d.items.length){
      /* Worker가 카드고릴라에서 빈 응답을 받는 경우를 위한 대체: 같은 폴더의 card-top10.json([{rank,name,corp,annualFee,img}])을 읽는다 */
      try{ const r2=await fetch('card-top10.json?_='+Date.now()); if(r2.ok){ const j2=await r2.json(); const it=Array.isArray(j2)?j2:(j2.items||[]); if(it.length) d={items:it,date:(j2&&j2.date)||''}; } }catch(e){}
    }
    if(!d||!d.items||!d.items.length){ fail('⚠ 카드고릴라 Top10을 가져오지 못했습니다(카드고릴라 서버가 자동 조회에 빈 응답을 줍니다). 아래 바로가기로 확인해 주세요.'); return; }
    if(st) st.textContent='카드고릴라 인기순위'+(d.date?' · '+d.date+' 기준':'');
    const esc=t=>String(t==null?'':t).replace(/[<>&"]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]));
    const cardUrl=x=>x.idx?'https://www.card-gorilla.com/card/detail/'+encodeURIComponent(x.idx):'https://www.card-gorilla.com/search?keyword='+encodeURIComponent(x.name||'');
    const imgUrl=u=>{ u=String(u||''); return u.indexOf('//')===0?'https:'+u:u; };
    box.innerHTML='<div class="cg-list">'+d.items.map(x=>
      '<a class="cg-item" href="'+esc(cardUrl(x))+'" target="_blank" rel="noopener" title="'+esc(x.name)+' 카드 안내 페이지로 이동">'+
      '<b class="cg-rk'+(x.rank<=3?' top':'')+'">'+esc(x.rank)+'</b>'+
      '<span class="cg-img">'+(x.img?'<img src="'+esc(imgUrl(x.img))+'" alt="'+esc(x.name)+' 카드 이미지" loading="lazy" referrerpolicy="no-referrer" data-stock-error="this.parentNode.classList.add(\'noimg\');this.remove()">':'')+'<i aria-hidden="true">'+esc(String(x.corp||x.name||'').slice(0,2))+'</i></span>'+
      '<span class="cg-tx"><span class="cg-nm">'+esc(x.name)+'</span>'+
      '<span class="cg-sub">'+esc(x.corp)+(x.annualFee?' · 연회비 '+esc(x.annualFee):'')+'</span></span>'+
      '<span class="cg-go" aria-hidden="true">›</span></a>').join('')+'</div>'+(d.items.length>3?'<button type="button" class="cg-more" aria-expanded="false">상세보기 ▾ · 나머지 '+(d.items.length-3)+'개</button>':'');
    const cgl=box.querySelector('.cg-list'), cgb=box.querySelector('.cg-more');
    if(cgb){ cgl.classList.add('cg-fold'); cgb.addEventListener('click',()=>{ const o=cgl.classList.toggle('cg-fold')===false; cgb.setAttribute('aria-expanded',o); cgb.textContent=o?'접기 ▴':'상세보기 ▾ · 나머지 '+(d.items.length-3)+'개'; }); }
  }catch(e){ console.warn('카드 Top10 실패',e); fail('⚠ 카드고릴라 Top10을 가져오지 못했습니다.'); }
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
    if(statusEl) statusEl.textContent='⚠ 이벤트 목록을 일시적으로 가져오지 못했습니다. 잠시 후 새로고침해 주세요.'+devHint('/fin-events 배포·스케줄러 실행 확인');
    Object.values(tbodies).forEach(tb=>{ if(tb) tb.innerHTML='<tr><td class="mut" colspan="3">불러오지 못했습니다</td></tr>'; });
    return;
  }
  if(statusEl){
    const updated=data.updatedAt?new Date(data.updatedAt).toLocaleString('ko-KR'):'알 수 없음';
    statusEl.textContent='최근 수집: '+updated+(data.failedSources&&data.failedSources.length?' · 수집 실패 '+data.failedSources.length+'곳':'');
  }
  Object.keys(tbodies).forEach(cat=>{
    const tb=tbodies[cat]; if(!tb) return;
    const rows=(data.byCat[cat]||[]);
    if(!rows.length){ tb.innerHTML='<tr><td class="mut" colspan="3">표시할 이벤트가 없습니다</td></tr>'; return; }
    const esc=t=>String(t==null?'':t).replace(/[<>&"]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]));
    const rowHtml=ev=>{
      const dstr=ev.deadlineTs?new Date(ev.deadlineTs).toLocaleDateString('ko-KR',{month:'2-digit',day:'2-digit'})+'까지':'상시·미표기';
      const st=ev.star||1, stars='★'.repeat(st)+'☆'.repeat(3-st), hi=st>=3;
      const home=FIN_SITE[ev.source];
      return '<tr style="'+(hi?'background:rgba(229,51,42,.08);box-shadow:inset 3px 0 0 #e5332a':'')+'">'+
        '<td style="white-space:nowrap;font-weight:'+(hi?800:500)+'">'+esc(ev.source)+(home?' <a href="'+home+'" target="_blank" rel="noopener" title="'+esc(ev.source)+' 공식 사이트(이벤트 메뉴)로 이동" style="text-decoration:none">🔗</a>':'')+'</td>'+
        '<td><a href="'+esc(ev.url)+'" target="_blank" rel="noopener" style="color:inherit;text-decoration:'+(hi?'underline':'none')+';font-weight:'+(hi?800:500)+'">'+esc(ev.title)+'</a></td>'+
        '<td style="text-align:center;color:'+(hi?'#e5332a':'var(--accent)')+';white-space:nowrap">'+stars+'</td></tr>';
    };
    const top=rows.filter(e=>(e.star||1)>=3), rest=rows.filter(e=>(e.star||1)<3);
    let html=top.length?top.map(rowHtml).join(''):'<tr><td class="mut" colspan="3">★★★ 이벤트가 없습니다'+(rest.length?' — 아래 상세보기에서 나머지 '+rest.length+'건을 확인하세요':'')+'</td></tr>';
    if(rest.length){
      const id='fin-more-'+cat;
      html+='<tr><td colspan="3" style="text-align:center"><button type="button" class="btn sm" style="padding:6px 16px" data-stock-click="var e=document.querySelectorAll(\'.'+id+'\');var o=this.dataset.o!==\'1\';e.forEach(function(x){x.style.display=o?\'table-row\':\'none\'});this.dataset.o=o?\'1\':\'0\';this.textContent=o?\'접기 ▲\':\'상세보기 ▼ (나머지 '+rest.length+'건)\'">상세보기 ▼ (나머지 '+rest.length+'건)</button></td></tr>'+
        rest.map(ev=>rowHtml(ev).replace('<tr style="','<tr class="'+id+'" style="display:none;')).join('');
    }
    tb.innerHTML=html;
  });
}
const FIN_SITE={'NH투자증권':'https://www.nhqv.com/','미래에셋증권':'https://securities.miraeasset.com/','삼성증권':'https://www.samsungpop.com/','KB증권':'https://www.kbsec.com/','한국투자증권':'https://securities.koreainvestment.com/','키움증권':'https://www.kiwoom.com/','신한투자증권':'https://www.shinhansec.com/','하나증권':'https://www.hanaw.com/','대신증권':'https://www.daishin.com/','토스증권':'https://www.tossinvest.com/','카카오페이증권':'https://www.kakaopaysec.com/','유안타증권':'https://www.myasset.com/','메리츠증권':'https://home.imeritz.com/',
 '토스뱅크':'https://www.tossbank.com/','카카오뱅크':'https://www.kakaobank.com/','케이뱅크':'https://www.kbanknow.com/','KB국민은행':'https://www.kbstar.com/','국민은행':'https://www.kbstar.com/','신한은행':'https://www.shinhan.com/','하나은행':'https://www.kebhana.com/','우리은행':'https://www.wooribank.com/','NH농협은행':'https://banking.nonghyup.com/','농협은행':'https://banking.nonghyup.com/','IBK기업은행':'https://www.ibk.co.kr/','기업은행':'https://www.ibk.co.kr/','SC제일은행':'https://www.standardchartered.co.kr/','iM뱅크':'https://www.imbank.co.kr/',
 '신한카드':'https://www.shinhancard.com/','삼성카드':'https://www.samsungcard.com/','KB국민카드':'https://card.kbcard.com/','국민카드':'https://card.kbcard.com/','현대카드':'https://www.hyundaicard.com/','롯데카드':'https://www.lottecard.co.kr/','우리카드':'https://pc.wooricard.com/','하나카드':'https://www.hanacard.co.kr/','BC카드':'https://www.bccard.com/','NH농협카드':'https://card.nonghyup.com/','농협카드':'https://card.nonghyup.com/'};

/* ===================== 금융상품 페이지 — 예금·적금 금리비교(야선지지 스타일) =====================
   금융감독원 "금융상품한눈에" 오픈API를 Worker(/fin-savings)가 은행+저축은행 전체를 모아 12개월
   최고우대금리 기준으로 정렬해 KV에 6시간 캐시해둔 결과를 그대로 받아 표로 렌더링한다.
   [설정 필요] Worker에 finlife.fss.or.kr 인증키(FSS_SAVINGS_KEY)가 있어야 값이 채워진다. */
const finSavingsData={ deposit:null, saving:null };
let finSavingsGroup='전체'; // '전체' | '은행' | '저축은행'
let finSavingsType='deposit'; // 'deposit'(정기예금) | 'saving'(적금)

async function loadFinSavings(){
  const statusEl=document.getElementById('fin-savings-status');
  if(!PROXY_BASE){
    if(statusEl) statusEl.textContent='⚠ PROXY_BASE가 설정되어 있지 않아 예금·적금 금리를 불러올 수 없습니다.';
    return;
  }
  const LSK='mk_fin_savings_v1';
  const apply=(data,cached)=>{
    finSavingsData.deposit=data.deposit||[];
    finSavingsData.saving=data.saving||[];
    if(statusEl){
      const updated=data.updated?new Date(data.updated).toLocaleString('ko-KR'):'알 수 없음';
      statusEl.textContent='자료: 금융감독원 금융상품통합비교공시(금융상품한눈에) · 최근 수집 '+updated+' · 12개월 기준 최고우대금리순'+(cached?' · 최신 데이터 확인 중…':'')+(data.stale?' · ⚠ 금융감독원 서비스 점검으로 마지막 수집 데이터를 표시합니다':'');
    }
  };
  /* 직전에 받은 데이터를 먼저 보여주고(즉시 표시), 서버 응답이 오면 최신으로 교체 */
  let shown=false;
  try{ const c=JSON.parse(localStorage.getItem(LSK)||'null'); if(c&&((c.deposit&&c.deposit.length)||(c.saving&&c.saving.length))){ apply(c,true); shown=true; try{ renderFinSavings(); }catch(e){} } }catch(e){}
  if(!shown&&statusEl) statusEl.textContent='예금·적금 금리를 불러오는 중… (서버 캐시가 비어 있으면 처음 한 번은 최대 1분 걸릴 수 있습니다)';
  try{
    const origin=PROXY_BASE.replace(/\?url=$/,'');
    const r=await fetch(origin+'fin-savings',{signal:AbortSignal.timeout?AbortSignal.timeout(80000):undefined});
    const data=r.ok?await r.json():null;
    if(data && ((data.deposit&&data.deposit.length) || (data.saving&&data.saving.length))){
      apply(data,false);
      try{ localStorage.setItem(LSK,JSON.stringify(data)); }catch(e){}
    }else{
      finSavingsData.deposit=finSavingsData.deposit&&finSavingsData.deposit.length?finSavingsData.deposit:[];
      finSavingsData.saving=finSavingsData.saving&&finSavingsData.saving.length?finSavingsData.saving:[];
      finSavingsFail=(data&&data.diag&&data.diag.length)?data.diag.join(' / '):'서버가 빈 목록을 돌려줬습니다';
      if(!shown&&statusEl) statusEl.textContent=(/점검|중단/.test(finSavingsFail)?'⚠ 금융감독원(금융상품한눈에) 서비스 점검으로 일시적으로 금리를 불러올 수 없습니다. 점검 종료 후 자동으로 표시됩니다.':'⚠ 예금·적금 금리를 일시적으로 가져오지 못했습니다. 잠시 후 새로고침해 주세요.')+devHint(finSavingsFail||'Worker 최신본 재배포 후 원인 표시');
    }
  }catch(e){
    console.warn('예금·적금 금리 로딩 실패:', e);
    finSavingsData.deposit=finSavingsData.deposit&&finSavingsData.deposit.length?finSavingsData.deposit:[];
    finSavingsData.saving=finSavingsData.saving&&finSavingsData.saving.length?finSavingsData.saving:[];
    finSavingsFail='서버 응답 지연 또는 연결 실패('+(e&&e.name||'error')+')';
    if(!shown&&statusEl) statusEl.textContent='⚠ 예금·적금 금리를 가져오지 못했습니다. 잠시 후 새로고침해 주세요.';
  }
  renderFinSavings();
}

/* ===================== 미국주식 시가총액 TOP10 — 재무비율·주가지표 =====================
   Worker(/us-fundamentals)가 Yahoo Finance quoteSummary를 종목별로 모아 KV에 6시간 캐시해둔 결과를
   그대로 받아 표로 렌더링한다. ETF(관심종목 워치리스트)는 회사 재무제표가 없어 대상에서 제외되고,
   시가총액 TOP10 개별 종목만 대상이다. 일부 종목은 Yahoo가 간헐적으로 401(Invalid Crumb)을 반환해
   값이 비어 있을 수 있으므로 그런 경우 "—"로 표시한다. */
const US_FUND_NAME={NVDA:'엔비디아',AAPL:'애플',GOOGL:'알파벳(구글)',MSFT:'마이크로소프트',AMZN:'아마존',TSM:'TSMC',SPCX:'스페이스X',AVGO:'브로드컴',META:'메타 플랫폼스',TSLA:'테슬라'};
const US_FUND_SET2=['MU','BRK-B','AMD','LLY','JPM','WMT','V','XOM','INTC','JNJ'];
async function loadUsFundamentals(){
  const statusEl=document.getElementById('us-fund-status');
  const bodyEl=document.getElementById('us-fund-tbl');
  if(!PROXY_BASE){ if(statusEl) statusEl.textContent='⚠ PROXY_BASE가 설정되어 있지 않아 재무비율을 불러올 수 없습니다.'; return; }
  try{
    const origin=PROXY_BASE.replace(/\?url=$/,'');
    const r=await fetch(origin+'us-fundamentals',{signal:AbortSignal.timeout?AbortSignal.timeout(20000):undefined});
    const data=r.ok?await r.json():null;
    if(data && Array.isArray(data.items) && data.items.length){
      renderUsFundamentals(data.items);
      if(statusEl){
        const updated=data.updated?new Date(data.updated).toLocaleString('ko-KR'):'알 수 없음';
        statusEl.textContent='자료: Yahoo Finance · 최근 수집 '+updated+' · 매출액증가율·영업이익증가율은 전년 동기 대비(YoY), EPS는 TTM/향후 12개월 컨센서스, PSR은 최근 12개월 기준';
      }
    }else{
      if(bodyEl) bodyEl.innerHTML='<tr><td colspan="6" class="mut">재무비율을 가져오지 못했습니다</td></tr>';
      if(statusEl) statusEl.textContent='⚠ 재무비율을 일시적으로 가져오지 못했습니다. 잠시 후 새로고침해 주세요.'+devHint('/us-fundamentals 배포 확인');
    }
  }catch(e){
    console.warn('미국주식 재무비율 로딩 실패:', e);
    if(bodyEl) bodyEl.innerHTML='<tr><td colspan="6" class="mut">재무비율을 가져오지 못했습니다</td></tr>';
    if(statusEl) statusEl.textContent='⚠ 재무비율을 가져오지 못했습니다.';
  }
}
function usFundPct(v){ return (v==null||isNaN(v)) ? '—' : ((v*100>=0?'+':'')+(v*100).toFixed(1)+'%'); }
function usFundNum(v,d){ return (v==null||isNaN(v)) ? '—' : v.toFixed(d==null?2:d); }

/* 미국지수 페이지의 "재무" 클릭식 토글(한국지수 페이지와 동일한 UX)에서 쓴다. /us-fundamentals가
   10개 종목을 한 번에 반환하므로, 첫 클릭에서 한 번만 요청해 ticker→데이터 맵으로 캐시해두고
   이후 클릭은 네트워크 요청 없이 캐시에서 즉시 렌더링한다(동시에 여러 번 눌러도 요청은 1번만
   나가도록 Promise 자체를 캐시). */
const usFundCaches={}, usFundPromises={};
async function loadUsFundamentalsOnce(set){
  set=set===3?3:set===2?2:1;
  if(usFundCaches[set]) return usFundCaches[set];
  if(usFundPromises[set]) return usFundPromises[set];
  usFundPromises[set]=(async()=>{
    if(!PROXY_BASE) return null;
    try{
      const origin=PROXY_BASE.replace(/\?url=$/,'');
      // [버그 대응] Cron으로 미리 캐시가 안 채워진 최초(cold) 요청은 Worker가 Yahoo 인증부터
      // 10개 종목 조회까지 순서대로 처리해 20초를 넘기는 경우가 있어(재무 버튼이 "불러오는 중"에서
      // 멈춰 보이던 원인 중 하나) 타임아웃을 30초로 늘렸다.
      const r=await fetch(origin+'us-fundamentals'+(set>=2?'?set='+set:''),{signal:AbortSignal.timeout?AbortSignal.timeout(30000):undefined});
      const data=r.ok?await r.json():null;
      if(data && Array.isArray(data.items)){
        const map={};
        data.items.forEach(it=>{ map[it.ticker]=it; });
        usFundCaches[set]=map;
        return map;
      }
    }catch(e){
      console.warn('미국주식 재무비율 로딩 실패:', e);
    }
    usFundPromises[set]=null; // 실패 시 다음 클릭에서 다시 시도할 수 있게 프로미스 캐시는 남기지 않는다
    return null;
  })();
  return usFundPromises[set];
}

/* 지수 편입·편출 등 TOP10 밖 종목: Worker /us-fundamental-one 에서 종목별로 받아온다 */
const usFundOne={};
async function loadUsFundamentalOne(t){
  for(const k of [1,2,3]){ if(usFundCaches[k]&&usFundCaches[k][t]) return usFundCaches[k][t]; }
  if(usFundOne[t]) return usFundOne[t];
  usFundOne[t]=(async()=>{
    if(!PROXY_BASE) return null;
    try{
      const origin=PROXY_BASE.replace(/\?url=$/,'');
      const r=await fetch(origin+'us-fundamental-one?t='+encodeURIComponent(t),{signal:AbortSignal.timeout?AbortSignal.timeout(30000):undefined});
      const d=r.ok?await r.json():null;
      if(d&&!d.error&&d.ticker) return d;
    }catch(e){ console.warn('종목 재무 로딩 실패',t,e); }
    usFundOne[t]=null; return null;
  })();
  return usFundOne[t];
}
/* ===================== "김군 판정" — 저평가·관망·고평가 3단계 간이 밸류에이션 =====================
   미국지수(Yahoo, PER/PSR 다 있음)와 한국지수(DART, PER은 없고 PSR만 있음)에서 공통으로 쓸 수
   있도록 매출액증가율(%)·PSR 두 지표만으로 채점한다(두 페이지의 판정 기준을 동일하게 맞추기
   위해 미국지수도 PER은 이 판정에서 제외). 어디까지나 성장성·밸류에이션의 방향성만 보는 간이
   지표라 "투자 권유"가 아님을 항상 함께 표기한다. */
/* 기술적 지표(RSI·200일선·5일선) 3종을 김군 판정용 점수(+1 저평가 쪽 / 0 / -1 고평가 쪽)로 환산 */
function kimTechParts(d){
  if(!d||d.length<30) return null;
  const last=d[d.length-1];
  const r=rsiLast(d,14); if(r==null) return null;
  const sgn=v=>v>0?-1:v<0?1:0;   // valuationSignal의 점수(음수=저평가)를 판정 점수(+1=저평가)로 뒤집는다
  const sr=r<=30?-2:r<=40?-1:r<60?0:r<70?1:2;
  const parts=[{grp:'기술', txt:'RSI(14) '+r.toFixed(0)+(r<=40?' — 과매도권(저평가 쪽)':r>=60?' — 과열권(고평가 쪽)':' — 중립권'), pt:sgn(sr)}];
  const m200=smaLast(d,200);
  if(m200!=null){
    const g=(last/m200-1)*100;
    const s=g<=-10?-2:g<=-3?-1:g<10?0:g<25?1:2;
    parts.push({grp:'기술', txt:'200일선 대비 '+(g>=0?'+':'')+g.toFixed(1)+'%'+(g<=-3?' — 장기 이평 아래(저평가 쪽)':g>=10?' — 장기 이평 크게 위(고평가 쪽)':' — 장기 추세 부근'), pt:sgn(s)});
  }
  const m5=smaLast(d,5);
  if(m5!=null){
    const g=(last/m5-1)*100;
    const s=g<=-4?-1:g<4?0:1;
    parts.push({grp:'기술', txt:'5일선 대비 '+(g>=0?'+':'')+g.toFixed(1)+'%'+(g<=-4?' — 단기 급락(눌림)':g>=4?' — 단기 급등(과열)':' — 단기 보합권'), pt:sgn(s)});
  }
  return parts;
}
/* 김군 판정 — 재무(매출액증가율·PSR) + 기술(RSI·200일선·5일선) 복합 평가.
   기술 데이터가 있으면 합산 점수 ±2 이상일 때 저평가/고평가, 없으면 기존처럼 ±1 기준. */
function kimValuationVerdict(growthPct, psr, techD, extra){
  const tech=kimTechParts(techD);
  if(growthPct==null && psr==null && !tech && !(extra&&extra.length)) return null;
  let fin=0;
  const reasons=[];
  if(growthPct!=null){
    if(growthPct>=15){ fin+=1; reasons.push({grp:'재무', txt:'매출액증가율 '+(growthPct>=0?'+':'')+growthPct.toFixed(1)+'% — 성장세 양호', pt:+1}); }
    else if(growthPct<=0){ fin-=1; reasons.push({grp:'재무', txt:'매출액증가율 '+growthPct.toFixed(1)+'% — 역성장', pt:-1}); }
    else reasons.push({grp:'재무', txt:'매출액증가율 +'+growthPct.toFixed(1)+'% — 보통', pt:0});
  }
  if(psr!=null){
    if(psr>0 && psr<2){ fin+=1; reasons.push({grp:'재무', txt:'PSR '+psr.toFixed(2)+'배 — 매출 대비 저평가 구간', pt:+1}); }
    else if(psr>8){ fin-=1; reasons.push({grp:'재무', txt:'PSR '+psr.toFixed(2)+'배 — 매출 대비 고평가 구간', pt:-1}); }
    else reasons.push({grp:'재무', txt:'PSR '+psr.toFixed(2)+'배 — 보통', pt:0});
  }
  (extra||[]).forEach(e=>{ fin+=e.pt; reasons.push(e); });
  let tscore=0;
  if(tech){ tech.forEach(t=>{ tscore+=t.pt; reasons.push(t); }); }
  const score=fin+tscore, th=tech?2:1;
  const base={score:score, fin:fin, tech:tscore, hasTech:!!tech, hasFin:(growthPct!=null||psr!=null||!!(extra&&extra.length)), reasons:reasons};
  if(score>=th) return Object.assign({label:'저평가', color:'var(--accent)', idx:0}, base);
  if(score<=-th) return Object.assign({label:'고평가', color:'var(--up)', idx:2}, base);
  return Object.assign({label:'관망', color:'var(--gold)', idx:1}, base);
}
/* 3단 게이지(저평가 | 관망 | 고평가) — 해당 구간만 진하게 채우고 ▼ 마커로 현재 위치를 표시,
   판정에 반영된 근거(지표별 +1/0/-1점)를 함께 보여준다. */
function renderKimVerdictBig(growthPct, psr, techD, extra){
  const v=kimValuationVerdict(growthPct, psr, techD, extra);
  if(!v) return '';
  const segs=[['저평가','#0A6B48'],['관망','#B7791F'],['고평가','#D92D20']];
  const main=segs[v.idx][1];
  const bar='<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:14px;width:100%;box-sizing:border-box;border-radius:12px;background:var(--panel);border:1px solid var(--line)">'+
    '<div role="img" aria-label="신호등: 현재 판정 '+segs[v.idx][0]+'" style="display:flex;justify-content:center;gap:14px">'+
    segs.map(([nm,c],i)=>{const on=(i===v.idx);
      return '<div style="width:64px;text-align:center"><div style="height:58px;display:flex;align-items:center;justify-content:center;border-radius:14px;background:#1A1D21;box-shadow:inset 0 2px 6px rgba(0,0,0,.6)"><i style="display:block;width:'+(on?42:30)+'px;height:'+(on?42:30)+'px;border-radius:50%;background:'+(on?'radial-gradient(circle at 35% 30%,#fff9 0,'+c+' 38%,'+c+' 100%)':'#3A3F45')+';'+(on?'box-shadow:0 0 0 3px '+c+'55,0 0 18px 4px '+c+'99':'box-shadow:inset 0 2px 4px rgba(0,0,0,.6)')+'"></i></div>'+
      '<div style="margin-top:6px;font-size:13px;line-height:1.2;font-weight:'+(on?900:600)+';color:'+(on?c:'var(--tx2)')+'">'+nm+'</div></div>';}).join('')+'</div>'+
    '<div style="width:100%;text-align:center;padding-top:8px;border-top:1px dashed var(--line)"><div style="font-size:11.5px;font-weight:700;color:var(--tx2)">현재 판정</div>'+
    '<div style="font-size:34px;line-height:1.2;font-weight:900;color:'+main+';letter-spacing:-1px">'+segs[v.idx][0]+'</div></div></div>';
  let lastGrp='';
  const fmtP=n=>(n>0?'+':n<0?'−':'')+Math.abs(n)+'점';
  const chipP=pt=>{const c=pt>0?'#0A6B48':pt<0?'#D92D20':'#64748B';return '<b style="flex:none;min-width:42px;text-align:center;padding:2px 8px;border-radius:999px;background:'+c+';color:#fff;font-size:12px">'+(pt>0?'+1':pt<0?'−1':'0')+'점</b>';};
  const reasons=v.reasons.map(r=>{
    let h='';
    if(r.grp && r.grp!==lastGrp){
      lastGrp=r.grp;
      const sub=r.grp==='재무'?v.fin:v.tech;
      h='<div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;padding:6px 10px;border-radius:8px;background:var(--panel);border-left:4px solid '+main+';font-size:12px;font-weight:800;color:var(--tx)"><span>'+(r.grp==='재무'?'📊 재무 평가':'📈 기술 평가 (RSI·200일선·5일선)')+'</span><span style="color:'+main+'">소계 '+fmtP(sub)+'</span></div>';
    }
    return h+'<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:12.5px;padding:6px 4px;border-bottom:1px solid var(--line)"><span style="color:var(--tx)">'+r.txt+'</span>'+chipP(r.pt)+'</div>';
  }).join('');
  const totalLine='<div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;padding:10px 14px;border-radius:10px;background:'+main+';color:#fff;font-weight:900"><span style="font-size:13px">종합 점수'+(v.hasTech?' <span style="font-weight:600;opacity:.9">(재무 '+fmtP(v.fin)+' + 기술 '+fmtP(v.tech)+')</span>':'')+'</span><span style="font-size:20px">'+fmtP(v.score)+'</span></div>';
  return '<div style="margin-top:14px;border:2px solid '+main+';border-radius:12px;overflow:hidden;background:var(--panel2)">'+
    '<div style="background:'+main+';color:#fff;padding:7px 14px;font-weight:800;font-size:13px">김군 판정</div>'+
    '<div style="padding:14px">'+
      '<div style="display:flex;align-items:stretch">'+bar+'</div>'+
      '<div style="margin-top:8px">'+reasons+totalLine+'</div>'+
      '<div style="margin-top:10px;padding:8px 10px;border-radius:8px;background:rgba(183,121,31,.12);border:1px solid rgba(183,121,31,.45);color:var(--tx);font-size:11.5px;line-height:1.5">⚠ '+(v.hasTech?'재무(매출액증가율·PSR) + 기술(RSI·200일선·5일선) 복합 판정':'매출액증가율·PSR 기준 간이 판정')+' · 참고용이며 투자 권유가 아닙니다.</div>'+usVerdictFormulaHtml()+
    '</div></div>';
}
function renderKimVerdictBadge(growthPct, psr, techD){
  const v=kimValuationVerdict(growthPct, psr, techD);
  if(!v) return '';
  const segs=[['저평가','var(--accent)'],['관망','var(--gold)'],['고평가','var(--up)']];
  const lampOn=v.idx===0?'g':v.idx===1?'y':'r';   // 저평가=초록, 관망=노랑, 고평가=빨강
  const lampCol={g:'#1fa463',y:'#f0b429',r:'#e5332a'};
  const lamp=['r','y','g'].map(c=>'<i style="display:block;width:16px;height:16px;border-radius:50%;background:'+(c===lampOn?lampCol[c]:'var(--line)')+';opacity:'+(c===lampOn?1:.5)+';'+(c===lampOn?'box-shadow:0 0 9px '+lampCol[c]+';':'')+'"></i>').join('');
  const bar=segs.map(([nm,c],i)=>{
    const on=(i===v.idx);
    return '<div style="flex:1;text-align:center;padding:10px 0;font-size:'+(on?16:13)+'px;font-weight:'+(on?900:600)+';'+
      'background:'+(on?c:c+'1f')+';color:'+(on?'#fff':c)+';'+(i===0?'border-radius:10px 0 0 10px;':'')+(i===2?'border-radius:0 10px 10px 0;':'')+
      (on?'box-shadow:0 0 0 3px '+c+'55;position:relative;z-index:1':'')+'">'+nm+'</div>';
  }).join('');
  const reasons=v.reasons.map(r=>
    '<div style="display:flex;justify-content:space-between;gap:8px;font-size:12.5px;margin-top:5px">'+
      '<span class="mut">'+r.txt+'</span>'+
      '<b style="color:'+(r.pt>0?'var(--accent)':r.pt<0?'var(--up)':'var(--tx2)')+';flex:none">'+(r.pt>0?'+1':r.pt<0?'−1':'0')+'점</b></div>'
  ).join('');
  return '<div style="margin-top:16px;padding:16px 18px;border:2.5px solid '+v.color+';border-radius:14px;background:var(--panel2)">'+
    '<div style="display:flex;align-items:center;gap:14px;margin-bottom:14px">'+
      '<div style="display:flex;flex-direction:column;gap:5px;padding:7px 6px;border-radius:12px;background:rgba(0,0,0,.08)">'+lamp+'</div>'+
      '<div><div style="font-weight:800;font-size:14px;color:var(--tx2)">김군 판정</div>'+
      '<div style="font-weight:900;font-size:30px;line-height:1.15;color:'+v.color+'">'+v.label+'</div></div></div>'+
    '<div style="display:flex">'+bar+'</div>'+
    '<div style="margin-top:12px">'+reasons+'</div>'+
    '<div class="mut" style="font-size:11px;margin-top:8px">매출액증가율·PSR 기준 간이 판정(참고용 · 투자 권유 아님)</div></div>';
}

/* ===== 미국 종목 투자자 패널: 4축 점검 · EPS×PER · PEG · ROA vs ROE · 팩터 등급 · 김군 판정 ===== */
function usLamp(level){ // g/y/r → 뱃지
  const m={g:['양호','#1fa463'],y:['보통','#f0b429'],r:['주의','#e5332a'],n:['—','#8a8a8a']}[level]||['—','#8a8a8a'];
  return '<span style="display:inline-block;min-width:38px;text-align:center;font-size:10.5px;font-weight:800;padding:2px 7px;border-radius:6px;color:#fff;background:'+m[1]+'">'+m[0]+'</span>';
}

/* 판정·등급 산식 공개(접이식) — 신뢰성 고지용 */
function usVerdictFormulaHtml(){
  const li=t=>'<li style="margin:2px 0">'+t+'</li>';
  return '<details style="margin-top:8px;border:1px solid var(--line);border-radius:8px;background:var(--panel)"><summary style="cursor:pointer;padding:8px 10px;font-size:12px;font-weight:800;color:var(--tx)">📐 판정 산식 보기</summary>'+
    '<div style="padding:2px 12px 10px;font-size:12px;line-height:1.55;color:var(--tx)"><ul style="margin:6px 0 0;padding-left:18px">'+
    li('<b>재무</b> · 매출액증가율 15%↑ +1 / 0% 이하 −1 / 그 외 0')+
    li('<b>재무</b> · PSR 2배 미만 +1 / 8배 초과 −1 / 그 외 0 (그 밖의 추가 근거가 있으면 해당 점수 합산)')+
    li('<b>기술</b> · RSI(14) 과매도권 쪽 +, 과열권 쪽 − (최대 ±2) / 200일선 대비 이격 −10%↓ +2 ~ +25%↑ −2 / 5일선 대비 ±4% 이상이면 ±1')+
    li('<b>종합</b> · 기술 지표가 있으면 합계 +2 이상 <b>저평가</b>, −2 이하 <b>고평가</b>, 그 사이 <b>관망</b> (재무만 있으면 ±1 기준)')+
    '</ul><div style="margin-top:6px;color:var(--tx2)">한계: 업종 평균·성장 지속성·시장 상황은 반영하지 않는 단순 규칙이며, 데이터가 없는 항목은 계산에서 빠집니다. 저평가/고평가는 투자 의견이 아니라 규칙상 분류입니다.</div></div></details>';
}
function usGradeFormulaHtml(){
  const li=t=>'<li style="margin:2px 0">'+t+'</li>';
  return '<details style="margin-top:8px;border:1px solid var(--line);border-radius:8px;background:var(--panel)"><summary style="cursor:pointer;padding:8px 10px;font-size:12px;font-weight:800;color:var(--tx)">📐 등급 산식 보기</summary>'+
    '<div style="padding:2px 12px 10px;font-size:12px;line-height:1.55;color:var(--tx)"><ul style="margin:6px 0 0;padding-left:18px">'+
    li('<b>밸류</b> · PEG 1 미만 90 / 1.5 미만 70 / 2 미만 50 / 그 외 25 (PEG 없으면 PER 15·25·40 기준) + PSR 2·5·10 기준의 평균')+
    li('<b>성장</b> · 매출증가율 30%↑ 95 / 15%↑ 80 / 5%↑ 60 / 0%↑ 45 / 그 외 20')+
    li('<b>수익성</b> · 영업이익률 30%↑ 95 / 20%↑ 85 / 10%↑ 65 / 0%↑ 45 / 그 외 20')+
    li('<b>모멘텀</b> · 최근 1년 수익률 50%↑ 90 / 20%↑ 75 / 0%↑ 55 / −20%↑ 40 / 그 외 20')+
    li('<b>이익수정</b> · 올해 EPS 추정치 90일 변화 +5%↑ 90 ~ −5%↓ 20 (없으면 상향/하향 건수)')+
    li('<b>등급</b> · 80점↑ A, 65↑ B, 50↑ C, 35↑ D, 미만 F · 종합은 가용 항목 평균')+
    '</ul><div style="margin-top:6px;color:var(--tx2)">절대 기준을 자체 설정한 값으로 Seeking Alpha 등 외부 평가와 무관하며, 업종별 차이를 보정하지 않습니다. 데이터 출처(Yahoo Finance)의 지연·오류가 그대로 반영될 수 있습니다.</div></div></details>';
}
function usGradeOf(score){
  if(score==null) return {g:'—',c:'var(--tx2)'};
  if(score>=80) return {g:'A',c:'#0A6B48'};
  if(score>=65) return {g:'B',c:'#2E8B6A'};
  if(score>=50) return {g:'C',c:'#B7791F'};
  if(score>=35) return {g:'D',c:'#C2570C'};
  return {g:'F',c:'#e5332a'};
}
function usFactorScores(it, techD){
  const rg=it.revenueGrowth!=null?it.revenueGrowth*100:null, om=it.operatingMargins!=null?it.operatingMargins*100:null;
  const sc={};
  // 밸류: PEG(우선) 또는 선행/후행 PER, PSR 평균
  const vs=[];
  const peg=usPeg(it).v;
  if(peg!=null) vs.push(peg<1?90:peg<1.5?70:peg<2?50:25);
  else { const pe=it.forwardPE||it.trailingPE; if(pe!=null&&pe>0) vs.push(pe<15?90:pe<25?70:pe<40?50:25); }
  if(it.psr!=null&&it.psr>0) vs.push(it.psr<2?90:it.psr<5?70:it.psr<10?45:25);
  sc.value=vs.length?vs.reduce((a,b)=>a+b,0)/vs.length:null;
  sc.growth=rg==null?null:rg>=30?95:rg>=15?80:rg>=5?60:rg>=0?45:20;
  sc.profit=om==null?null:om>=30?95:om>=20?85:om>=10?65:om>=0?45:20;
  if(techD&&techD.length>30){ const r1=(techD[techD.length-1]/techD[0]-1)*100; sc.momentum=r1>=50?90:r1>=20?75:r1>=0?55:r1>=-20?40:20; } else sc.momentum=null;
  const t=it.trend||{};
  if(t.epsNow!=null&&t.eps90!=null&&t.eps90!==0){ const ch=(t.epsNow/t.eps90-1)*100; sc.revision=ch>=5?90:ch>=1?75:ch>=-1?55:ch>=-5?40:20; }
  else if(t.up30!=null||t.down30!=null){ const u=t.up30||0,d=t.down30||0; sc.revision=u>d?75:u<d?35:55; }
  else sc.revision=null;
  return sc;
}
function usPeg(it){
  if(it.pegRatio!=null&&it.pegRatio>0) return {v:it.pegRatio, fwd:false};
  const g5=it.trend&&it.trend.growth5y;
  if(it.forwardPE!=null&&it.forwardPE>0&&g5!=null&&g5>0) return {v:it.forwardPE/(g5*100), fwd:true};
  return {v:null};
}

/* 김군 등급(A~D) 카드 — Seeking Alpha 'Quant Rating'식: 종합 등급 + 5개 팩터 미니 등급 + 근거 3줄 */
function kimGradeCard(it, techD, opt){
  opt=opt||{};
  if(!it) return '';
  const fs=usFactorScores(it,techD);
  const NM={value:'밸류',growth:'성장',profit:'수익성',momentum:'모멘텀',revision:'이익수정'};
  const keys=Object.keys(NM).filter(k=>fs[k]!=null);
  if(keys.length<3) return '';
  const avg=keys.reduce((a,k)=>a+fs[k],0)/keys.length;
  const G=avg>=75?{g:'A',c:'#1fa463',m:'전반적으로 강한 종목'}:avg>=60?{g:'B',c:'#4fa383',m:'양호 — 일부 보완점 확인'}:avg>=45?{g:'C',c:'#f0b429',m:'평범 — 선별적 접근'}:{g:'D',c:'#e5832a',m:'약세 — 보수적 접근'};
  const sorted=keys.slice().sort((a,b)=>fs[b]-fs[a]);
  const best=sorted[0], worst=sorted[sorted.length-1];
  const rg=it.revenueGrowth, om=it.operatingMargins, peg=usPeg(it).v, t=it.trend||{};
  const pc=v=>(v>=0?'+':'')+(v*100).toFixed(1)+'%';
  let r1=null; if(techD&&techD.length>30) r1=(techD[techD.length-1]/techD[0]-1)*100;
  const D={
    value:()=>peg!=null?'PEG '+peg.toFixed(2)+(peg<1?' — 성장 대비 저평가':peg<=1.5?' — 무난한 수준':' — 성장 대비 부담')+(it.psr!=null?' · PSR '+it.psr.toFixed(1)+(it.psr>=10?'배로 매출 대비 부담':it.psr>=5?'배(다소 높음)':'배'):''):(it.psr!=null?'PSR '+it.psr.toFixed(1)+'배':'밸류에이션 지표'),
    growth:()=>'매출증가율 '+(rg==null?'—':pc(rg))+(rg!=null?(rg>=0.15?' — 고성장':rg>=0.05?' — 완만한 성장':rg>=0?' — 정체':' — 역성장'):''),
    profit:()=>'영업이익률 '+(om==null?'—':(om*100).toFixed(1)+'%')+(om!=null?(om>=0.2?' — 높은 수익성':om>=0.1?' — 보통':om>=0?' — 낮은 편':' — 적자'):''),
    momentum:()=>'최근 1년 '+(r1==null?'—':(r1>=0?'+':'')+r1.toFixed(1)+'%')+(r1!=null?(r1>=20?' — 강한 추세':r1>=0?' — 완만한 상승':' — 하락 추세'):''),
    revision:()=>'애널리스트 이익 추정 '+(fs.revision>=75?'상향 추세':fs.revision<=40?'하향 추세':'보합')
  };
  const chip=k=>{const g=usGradeOf(fs[k]);const sc=fs[k]==null?'—':Math.round(fs[k]);return '<div style="text-align:center;padding:8px 2px 7px;border-radius:10px;background:var(--panel);border:1.5px solid '+g.c+'"><b style="display:block;width:34px;margin:0 auto;padding:3px 0;border-radius:8px;background:'+g.c+';color:#fff;font-size:20px;line-height:1.1;font-weight:900">'+g.g+'</b><span style="display:block;margin-top:5px;font-size:13px;font-weight:800;color:var(--tx);white-space:nowrap">'+NM[k]+'</span><span style="display:block;font-size:12px;font-weight:700;color:'+g.c+'">'+sc+'점</span></div>';};
  const line=(ic,lb,tx,col)=>'<div style="display:flex;gap:8px;align-items:flex-start;font-size:12.5px;margin-top:7px"><span style="flex:none;font-weight:900;color:'+col+';min-width:52px;white-space:nowrap">'+ic+' '+lb+'</span><span>'+tx+'</span></div>';
  const pos=Math.max(2,Math.min(98,avg));
  return '<div style="margin-top:12px;padding:14px 16px;border:1px solid var(--line);border-radius:14px;background:var(--panel2);border-left:5px solid '+G.c+'">'+
    '<div style="display:flex;align-items:center;gap:14px"><div style="flex:none;width:68px;height:68px;border-radius:16px;background:'+G.c+';color:#fff;display:flex;align-items:center;justify-content:center;font-size:40px;font-weight:900;box-shadow:0 4px 14px '+G.c+'66">'+G.g+'</div>'+
    '<div style="min-width:0;flex:1"><div style="font-size:12px;font-weight:800;color:var(--tx2)">김군 등급 · 종합 '+Math.round(avg)+'점</div><div style="font-size:16px;font-weight:900;margin-top:2px">'+G.m+'</div>'+
    '<div style="position:relative;height:8px;border-radius:4px;margin-top:8px;background:linear-gradient(90deg,#e5832a 0 45%,#f0b429 45% 60%,#4fa383 60% 75%,#1fa463 75% 100%)"><span style="position:absolute;left:'+pos+'%;top:-4px;width:4px;height:16px;border-radius:2px;background:#111;transform:translateX(-50%)"></span></div>'+
    '<div style="display:flex;justify-content:space-between;font-size:9.5px;color:var(--tx2);margin-top:2px"><span>D</span><span>C</span><span>B</span><span>A</span></div></div></div>'+
    '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(56px,1fr));gap:6px;margin-top:12px">'+keys.map(chip).join('')+'</div>'+
    '<div style="margin-top:8px;padding-top:6px;border-top:1px dashed var(--line)">'+
    line('👍','강점','<b>'+NM[best]+' '+usGradeOf(fs[best]).g+'</b> · '+D[best](),'#1fa463')+
    line('⚠','주의','<b>'+NM[worst]+' '+usGradeOf(fs[worst]).g+'</b> · '+D[worst](),'#e5332a')+
    line('📌','결론',G.g==='A'||G.g==='B'?'강점이 약점을 앞섭니다. 밸류·추세를 확인하며 분할 접근을 고려할 수 있습니다.':G.g==='C'?'강점과 약점이 엇갈립니다. 약점 지표가 개선되는지 지켜볼 구간입니다.':'약점이 두드러집니다. 비중을 줄이거나 관망이 낫습니다.','var(--accent)')+'</div>'+
    '<div class="mut" style="font-size:10.5px;margin-top:8px">자체 계산 절대 기준 등급(Seeking Alpha 공식 등급 아님) · 참고용이며 투자 권유가 아닙니다.</div>'+usGradeFormulaHtml()+'</div>';
}

function renderUsFinancialRatiosClassic(it, techD, opt){
  opt=opt||{};
  const won=opt.cur==='won';
  const mny=v=>v==null?'—':(won?Math.round(v).toLocaleString('ko-KR')+'원':'$'+v.toFixed(2));
  if(!it || (it.revenueGrowth==null && it.earningsGrowth==null && it.trailingEps==null && it.forwardEps==null && it.psr==null && it.trailingPE==null)){
    return '<p class="mut" style="font-size:11.5px;margin-top:6px">재무비율·주가지표 데이터를 가져오지 못했습니다.</p>';
  }
  const rg=it.revenueGrowth, eg=it.earningsGrowth;
  const rgColor=rg==null?'var(--tx2)':(rg>=0?'var(--up)':'var(--down)');
  const egColor=eg==null?'var(--tx2)':(eg>=0?'var(--up)':'var(--down)');
  const card=(title,inner,extra)=>'<div style="margin-top:12px;padding:12px 14px;border:1px solid var(--line);border-radius:12px;background:var(--panel2)'+(extra||'')+'"><div style="font-size:12.5px;font-weight:900;margin-bottom:8px">'+title+'</div>'+inner+'</div>';
  const pc=v=>v==null?'—':(v*100).toFixed(1)+'%';
  const n2=(v,d)=>v==null?'—':v.toFixed(d==null?2:d);
  // ① 4축
  const gLv=rg==null?'n':rg>=0.15?'g':rg>0?'y':'r';
  const om=it.operatingMargins;
  const pLv=om==null?'n':om>=0.2?'g':om>=0.08?'y':'r';
  const roa=it.roa;
  const eLv=roa==null?'n':roa>=0.10?'g':roa>=0.04?'y':'r';
  const de=it.debtToEquity, cr=it.currentRatio;
  const dLv=de==null?'n':de<=80?'g':de<=150?'y':'r', cLv=cr==null?'n':cr>=1.5?'g':cr>=1?'y':'r';
  const sLv=(dLv==='n'&&cLv==='n')?'n':['r','y','g'].find(x=>dLv===x||cLv===x)||'y';
  const axes=[['성장성',gLv,'매출증가율 '+(rg==null?'—':(rg>=0?'+':'')+(rg*100).toFixed(1)+'%')+' · 이익증가율 '+(eg==null?'—':(eg>=0?'+':'')+(eg*100).toFixed(1)+'%')],
    ['수익성',pLv,'영업이익률 '+pc(om)+' · 순이익률 '+pc(it.profitMargins)],
    ['효율성',eLv,'ROA '+pc(roa)+(it.freeCashflow!=null?' · FCF '+(it.freeCashflow>=0?'흑자':'적자'):'')],
    ['안정성',sLv,'부채비율 '+(de==null?'—':de.toFixed(0)+'%')+' · 유동비율 '+n2(cr,1)]];
  const axHtml=axes.map(a=>'<div style="display:flex;align-items:center;gap:8px;margin:6px 0;font-size:12.5px"><b style="width:50px;flex:none">'+a[0]+'</b>'+usLamp(a[1])+'<span class="mut" style="font-size:11.5px">'+a[2]+'</span></div>').join('');
  // ② EPS × PER
  const eps=it.trailingEps, pe=it.trailingPE, px=it.price;
  let epsHtml='';
  if(eps!=null||pe!=null){
    epsHtml='<div style="display:flex;align-items:center;justify-content:center;gap:8px;font-size:15px;font-weight:900;flex-wrap:wrap"><span>EPS '+mny(eps)+'</span><span class="mut">×</span><span>PER '+n2(pe,1)+'배</span>'+(px!=null?'<span class="mut">=</span><span style="color:var(--accent)">'+mny(px)+'</span>':'')+'</div>'+
      '<div class="mut" style="margin-top:8px;text-align:center;font-size:11.5px">'+(it.forwardEps!=null&&eps!=null?(it.forwardEps>eps?'선행 EPS '+mny(it.forwardEps)+' &gt; TTM → 시장이 이익 성장을 기대 중':'선행 EPS '+mny(it.forwardEps)+' ≤ TTM → 이익 성장 기대 약함'):'')+(it.forwardPE!=null?' · 선행 PER '+n2(it.forwardPE,1)+'배':'')+'</div>';
  }
  // ③ PEG
  const pg=usPeg(it);
  let pegHtml='';
  if(pg.v!=null){
    const v=pg.v, lv=v<0.9?'g':v<=1.1?'y':'r', txt=v<0.9?'성장 대비 저평가':v<=1.1?'적정 수준':'성장 대비 고평가';
    const pos=Math.max(2,Math.min(98,v/2*100));
    pegHtml='<div style="display:flex;justify-content:space-between;align-items:center"><b style="font-size:24px;color:'+(lv==='g'?'#1fa463':lv==='y'?'#8a6500':'#e5332a')+'">'+v.toFixed(2)+'</b>'+usLamp(lv).replace(/>(양호|보통|주의)</,'>'+txt+'<').replace('min-width:38px','')+'</div>'+
      '<div style="display:flex;height:10px;border-radius:5px;overflow:hidden;margin-top:6px;opacity:.85"><i style="flex:.9;background:#1fa463"></i><i style="flex:.2;background:#f0b429"></i><i style="flex:.9;background:#e5332a"></i></div>'+
      '<div style="position:relative;height:12px"><span style="position:absolute;left:'+pos+'%;transform:translateX(-50%);font-size:10px">▲</span></div>'+
      '<div class="mut" style="display:flex;justify-content:space-between;font-size:10.5px"><span>0</span><span>1 적정</span><span>2+</span></div>'+
      '<div class="mut" style="margin-top:6px;font-size:11px">'+(opt.pegNote?opt.pegNote:pg.fwd?'PEG-FWD(근사) = 선행 PER '+n2(it.forwardPE,1)+' ÷ 향후5년 예상성장 '+(it.trend.growth5y*100).toFixed(0)+'% <span style="border:1px dashed var(--tx2);border-radius:5px;padding:0 4px;font-size:10px">근사치</span>':'Yahoo 제공 PEG(5년 예상 이익성장 기준)')+' · &lt;1 저평가 · 1 적정 · &gt;1 고평가</div>';
  }
  // ④ ROA vs ROE
  let roaHtml='';
  if(roa!=null||it.roe!=null){
    const roe=it.roe, mx=Math.max(Math.abs(roa||0),Math.abs(roe||0),0.01);
    const bar=(nm,v,col)=>v==null?'':'<div style="display:flex;align-items:center;gap:8px;margin:6px 0;font-size:12px"><span style="width:34px">'+nm+'</span><div style="flex:1;height:9px;border-radius:5px;background:var(--panel)"><div style="height:9px;border-radius:5px;width:'+Math.max(2,Math.min(100,Math.abs(v)/mx*100))+'%;background:'+col+'"></div></div><b style="width:52px;text-align:right;color:'+(v<0?'var(--down)':'inherit')+'">'+(v*100).toFixed(1)+'%</b></div>';
    const ratio=(roa>0&&roe!=null)?roe/roa:null;
    roaHtml=bar('ROA',roa,'var(--accent)')+bar('ROE',roe,'var(--gold)')+
      '<div class="mut" style="font-size:11px;margin-top:4px">'+(ratio!=null?'ROE가 ROA의 '+ratio.toFixed(1)+'배 → '+(ratio>=3?'⚠ 부채·자사주 매입 영향으로 ROE가 부풀려졌을 수 있어 ROA를 함께 보세요':'자본 구조가 과도한 레버리지는 아님'):'')+'<br>제조업·자산 중심은 ROA, 비슷한 부채 구조끼리 주주환원 비교는 ROE</div>';
  }
  // ⑤ 팩터 등급
  const fs=usFactorScores(it,techD);
  const gd=(nm,v)=>{const g=usGradeOf(v);const sc=v==null?'—':Math.round(v);return '<div style="text-align:center;border-radius:10px;border:1.5px solid '+g.c+';background:var(--panel);overflow:hidden"><div style="background:'+g.c+';color:#fff;padding:3px 0;font-size:11px;font-weight:800">'+nm+'</div><div style="padding:8px 0 2px"><b style="display:block;font-size:26px;line-height:1;font-weight:900;color:'+g.c+'">'+g.g+'</b></div><div style="font-size:11px;font-weight:700;padding-bottom:7px;color:var(--tx2)">'+sc+'점</div></div>';};
  const factorHtml='<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:6px">'+gd('밸류',fs.value)+gd('성장',fs.growth)+gd('수익성',fs.profit)+gd('모멘텀',fs.momentum)+gd('이익수정',fs.revision)+'</div>'+
    '<div class="mut" style="font-size:10.5px;margin-top:6px">자체 계산 절대 기준 등급(씨킹알파 공식 등급 아님) · 이익수정 = 올해 EPS 추정치 90일 변화(또는 상향/하향 건수)</div>';
  // 배당정보 (배당성향 도넛·배당수익률·연간 배당금·5년 성장률)
  let divHtml='';
  const dv=it.div, dh=it.divHist||{};
  if(dv && (dv.rate||dv.yield||dv.payout!=null)){
    const po=dv.payout;
    let donut='';
    if(po!=null && po>=0){
      const p=Math.min(1,po), R=34, C=2*Math.PI*R;
      donut='<div style="text-align:center"><svg width="96" height="96" viewBox="0 0 96 96"><circle cx="48" cy="48" r="'+R+'" fill="none" stroke="var(--line)" stroke-width="14"/>'+
        '<circle cx="48" cy="48" r="'+R+'" fill="none" stroke="var(--accent)" stroke-width="14" stroke-dasharray="'+(C*p).toFixed(1)+' '+C.toFixed(1)+'" transform="rotate(-90 48 48)"/>'+
        '<text x="48" y="53" text-anchor="middle" font-size="15" font-weight="900" fill="currentColor">'+(po*100).toFixed(1)+'%</text></svg>'+
        '<div class="mut" style="font-size:10.5px">배당성향 <span style="color:var(--accent)">●</span> · 유보 <span style="color:var(--line)">●</span></div></div>';
    }
    const yl=dv.yield!=null?dv.yield*100:null, av=dv.avg5y;
    const yBar=yl!=null?'<div style="margin-top:4px"><div style="font-size:20px;font-weight:900">'+yl.toFixed(2)+'%</div>'+
      (av!=null?'<div class="mut" style="font-size:10.5px">5년 평균 '+av.toFixed(2)+'% 대비 '+(yl>av?'높음':'낮음')+'</div>':'')+'</div>':'<div class="mut">—</div>';
    const g5=dh.growth5;
    const gTxt=g5==null?'—':'<b style="color:'+(g5>=0?'var(--up)':'var(--down)')+'">'+(g5>=0?'+':'')+(g5*100).toFixed(1)+'%</b> <span class="mut" style="font-size:10.5px">('+(dh.growthYears||5)+'년 누적)</span>';
    const cellS='padding:8px 10px;border:1px solid var(--line);border-radius:10px;background:var(--panel)';
    divHtml='<div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:center">'+donut+
      '<div style="flex:1 1 200px;display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px">'+
      '<div style="'+cellS+'"><span class="mut" style="font-size:10.5px">배당수익률</span>'+yBar+'</div>'+
      '<div style="'+cellS+'"><span class="mut" style="font-size:10.5px">연간 배당금</span><div style="font-size:20px;font-weight:900;margin-top:4px">'+mny(dv.rate!=null?dv.rate:dh.lastAnnual)+'</div>'+(dh.freq?'<div class="mut" style="font-size:10.5px">'+dh.freq+' 배당'+(dh.lastAmt!=null?' · 회당 '+mny(dh.lastAmt):'')+'</div>':'')+'</div>'+
      '<div style="'+cellS+';grid-column:span 2"><span class="mut" style="font-size:10.5px">배당 성장률</span> '+gTxt+'</div></div></div>'+
      '<div class="mut" style="font-size:10.5px;margin-top:6px">'+(po!=null?'이익의 '+(po*100).toFixed(0)+'%를 배당, 나머지는 유보 · ':'')+(po!=null&&po>0.8?'⚠ 배당성향이 높아 성장 투자 여력은 제한적 · ':'')+(won?'DART 배당에 관한 사항 기준':'Yahoo Finance 기준')+'</div>';
  } else if(it.div){
    divHtml='<div class="mut" style="font-size:11.5px">배당을 지급하지 않거나 정보가 없습니다.</div>';
  }
  // ⑥ 김군 판정 — 재무 + 기술 + PEG·이익수정
  const extra=[];
  if(pg.v!=null) extra.push({grp:'재무', txt:'PEG '+pg.v.toFixed(2)+(pg.v<0.9?' — 성장 대비 저평가':pg.v<=1.1?' — 적정':' — 성장 대비 고평가'), pt:pg.v<0.9?1:pg.v<=1.1?0:-1});
  if(fs.revision!=null) extra.push({grp:'재무', txt:'애널리스트 이익 추정 '+(fs.revision>=75?'상향 추세':fs.revision<=40?'하향 추세':'보합'), pt:fs.revision>=75?1:fs.revision<=40?-1:0});
  return '<div style="margin-top:10px;padding-top:8px;border-top:1px solid var(--line)">'+
    '<div class="mut" style="font-size:11.5px;margin-bottom:6px;text-align:center;font-weight:700">'+(opt.title||'재무비율 · 주가지표(Yahoo Finance 기준)')+'</div>'+
    kimGradeCard(it,techD,opt)+
    '<div style="display:flex;flex-wrap:wrap;gap:0 24px;align-items:flex-start"><div style="flex:1 1 360px;min-width:0">'+
    ((window.innerWidth>=1000)?'':'<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px 12px;font-size:13px;text-align:center;padding:12px 14px;border:1px solid var(--line);border-radius:12px;background:var(--panel2)">'+
      '<div><span class="mut" style="font-size:10.5px">매출액증가율</span><br><b style="color:'+rgColor+'">'+usFundPct(rg)+'</b></div>'+
      '<div><span class="mut" style="font-size:10.5px">'+(opt.ogLabel||'영업이익증가율※')+'</span><br><b style="color:'+egColor+'">'+usFundPct(eg)+'</b></div>'+
      '<div><span class="mut" style="font-size:10.5px">PER</span><br><b>'+usFundNum(it.trailingPE,1)+'</b></div>'+
      '<div><span class="mut" style="font-size:10.5px">EPS(TTM)</span><br><b>'+(won?mny(it.trailingEps):usFundNum(it.trailingEps))+'</b></div>'+
      '<div><span class="mut" style="font-size:10.5px">'+(opt.fwdLabel||'EPS(Fwd)')+'</span><br><b>'+(opt.fwdShow?opt.fwdShow:usFundNum(it.forwardEps))+'</b></div>'+
      '<div><span class="mut" style="font-size:10.5px">PSR</span><br><b>'+usFundNum(it.psr)+'</b></div>'+
    '</div>')+
    card('① 4축 점검 — 성장성·수익성·효율성·안정성',axHtml)+
    (epsHtml?card('② 주가 = EPS × PER',epsHtml):'')+
    (pegHtml?card('③ PEG (성장 대비 PER)',pegHtml):'')+
    (roaHtml?card('④ ROA vs ROE — 자본 효율',roaHtml):'')+
    card('⑤ 팩터 등급 (자체 계산)',factorHtml)+
    '</div><div style="flex:1 1 360px;min-width:0">'+
    (divHtml?card('배당정보',divHtml):'')+
    renderKimVerdictBig(rg==null?null:rg*100, it.psr, techD, extra)+
    '</div></div>'+
    '<div class="mut" style="font-size:10.5px;margin-top:8px">'+(opt.foot||'※ 영업이익증가율은 Yahoo가 분기 이익 성장률로만 제공해 근사치입니다. 참고용이며 투자 권유가 아닙니다.')+'</div></div>';
}


/* ===== 재무 박스 v2: 한 화면에 핵심만(등급·판정·지표 타일·4축·밸류) + 상세 근거는 접기 ===== */
function injectFinCss(){
  if(document.getElementById('fv2-css')) return;
  const st=document.createElement('style'); st.id='fv2-css';
  st.textContent='.fv2{max-width:none;width:100%;margin:6px 0 4px;min-width:0}'+
  '.fv2{width:auto!important;box-sizing:border-box}.fv2>:not(.fv2-t){margin-left:14px!important;margin-right:14px!important}.fv2>.fv2-t{margin-bottom:10px}@media(max-width:700px){.fv2>:not(.fv2-t){margin-left:10px!important;margin-right:10px!important}}'+
  '.fv2 .fv2-t{display:flex;align-items:center;gap:6px;font-size:12px;font-weight:800;color:var(--tx2);margin:0 0 6px}'+
  '.fv2 .fv2-top{display:grid;grid-template-columns:auto 1fr auto;gap:10px 12px;align-items:center;padding:10px 12px;border:1px solid var(--line);border-radius:6px;background:var(--panel)}.fv2 .fv2-top .fv2-f{grid-column:1/-1;margin-top:2px;padding-top:8px;border-top:1px dashed var(--line)}'+
  '.fv2 .fv2-g{width:54px;height:54px;border-radius:10px;color:#fff;display:flex;align-items:center;justify-content:center;font-size:32px;font-weight:900}'+
  '.fv2 .fv2-gi b{display:block;font-size:15px;font-weight:900}.fv2 .fv2-gi small{display:block;font-size:12px;color:var(--tx2);margin-top:1px}'+
  '.fv2 .fv2-gi .l{display:block;font-size:12.5px;margin-top:3px;line-height:1.45}'+
  '.fv2 .fv2-v{text-align:center;padding:6px 14px;border-radius:8px;background:var(--panel2,#F6F8F7);min-width:96px}'+
  '.fv2 .fv2-v small{display:block;font-size:11.5px;color:var(--tx2);font-weight:700}.fv2 .fv2-v b{display:block;font-size:24px;line-height:1.2;font-weight:900;letter-spacing:-1px}.fv2 .fv2-v i{display:block;font-style:normal;font-size:11.5px;color:var(--tx2)}'+
  '.fv2 .fv2-row{display:grid;gap:6px;margin-top:8px}'+
  '.fv2 .fv2-f{grid-template-columns:repeat(5,minmax(0,1fr))}.fv2 .fv2-m{grid-template-columns:repeat(6,minmax(0,1fr))}.fv2 .fv2-a{grid-template-columns:repeat(4,minmax(0,1fr))}.fv2 .fv2-3{grid-template-columns:repeat(3,minmax(0,1fr))}'+
  '.fv2 .fv2-c{min-width:0;padding:6px 8px;border:1px solid var(--line);border-radius:6px;background:var(--panel2,#F6F8F7)}'+
  '.fv2 .fv2-c small{display:block;font-size:11.5px;color:var(--tx2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'+
  '.fv2 .fv2-c b{display:block;font-size:16px;font-weight:900;line-height:1.3;font-variant-numeric:tabular-nums;white-space:nowrap}'+
  '.fv2 .fv2-c em{display:block;font-style:normal;font-size:11.5px;color:var(--tx2);margin-top:1px;line-height:1.35}'+
  '.fv2 .fv2-fc{display:flex;align-items:center;gap:7px;padding:5px 8px}.fv2 .fv2-fc .gl{flex:none;width:28px;height:28px;border-radius:6px;color:#fff;font-weight:900;font-size:17px;display:flex;align-items:center;justify-content:center}.fv2 .fv2-fc div{min-width:0}.fv2 .fv2-fc small{font-size:12px;font-weight:800;color:var(--tx)}.fv2 .fv2-fc span{display:block;font-size:11.5px;color:var(--tx2)}'+
  '.fv2 .fv2-ac{display:flex;align-items:center;gap:6px;padding:5px 8px}.fv2 .fv2-ac i{flex:none;width:10px;height:10px;border-radius:50%}.fv2 .fv2-ac b{font-size:13px;white-space:nowrap}.fv2 .fv2-ac span{font-size:11.5px;color:var(--tx2);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'+
  '.fv2 .fv2-bar{height:7px;border-radius:4px;background:var(--line);margin-top:4px;overflow:hidden;position:relative}.fv2 .fv2-bar i{display:block;height:100%}'+
  '.fv2 details{margin-top:8px;border:1px solid var(--line);border-radius:6px;background:var(--panel)}.fv2 summary{cursor:pointer;padding:8px 12px;font-size:12.5px;font-weight:800}'+
  '.fv2 .fv2-rs{padding:2px 12px 10px;display:grid;grid-template-columns:1fr 1fr;gap:2px 20px}.fv2 .fv2-rs div{display:flex;justify-content:space-between;gap:8px;font-size:12.5px;padding:4px 0;border-bottom:1px solid var(--line)}.fv2 .fv2-rs b{flex:none}'+
  '.fv2 .fv2-ft{margin:8px 0 0;font-size:11px;color:var(--tx2);line-height:1.5}'+
  '@media(max-width:700px){.fv2 .fv2-top{grid-template-columns:auto 1fr;padding:8px 10px}.fv2 .fv2-v{grid-column:1/-1;display:flex;align-items:baseline;justify-content:center;gap:8px;padding:5px 10px}.fv2 .fv2-v b{font-size:20px}'+
  '.fv2 .fv2-f{grid-template-columns:repeat(3,minmax(0,1fr))}.fv2 .fv2-m{grid-template-columns:repeat(3,minmax(0,1fr))}.fv2 .fv2-a{grid-template-columns:repeat(2,minmax(0,1fr))}.fv2 .fv2-3{grid-template-columns:minmax(0,1fr)}.fv2 .fv2-rs{grid-template-columns:1fr}.fv2 .fv2-c b{font-size:15px}.fv2 .fv2-ac{flex-wrap:wrap;gap:2px 6px}.fv2 .fv2-ac span{flex:1 0 100%}.fv2 .fv2-g{width:46px;height:46px;font-size:27px}}';
  document.head.appendChild(st);
}
function usFinCompact(it, techD, opt){
  opt=opt||{}; injectFinCss();
  const won=opt.cur==='won';
  const mny=v=>v==null?'—':(won?Math.round(v).toLocaleString('ko-KR')+'원':'$'+v.toFixed(2));
  const pc=v=>v==null?'—':(v*100).toFixed(1)+'%';
  const spc=v=>v==null?'—':(v>=0?'+':'')+(v*100).toFixed(1)+'%';
  const n2=(v,d)=>v==null?'—':v.toFixed(d==null?2:d);
  const rg=it.revenueGrowth, eg=it.earningsGrowth, om=it.operatingMargins, roa=it.roa, roe=it.roe, de=it.debtToEquity, cr=it.currentRatio;
  const col=v=>v==null?'var(--tx2)':(v>=0?'var(--up)':'var(--down)');
  const LC={g:'#1fa463',y:'#f0b429',r:'#e5332a',n:'#98A2B3'}, LN={g:'양호',y:'보통',r:'주의',n:'—'};
  // 등급
  const fs=usFactorScores(it,techD), NM={value:'밸류',growth:'성장',profit:'수익성',momentum:'모멘텀',revision:'이익수정'};
  const keys=Object.keys(NM).filter(k=>fs[k]!=null);
  let top='', gradeKeys=keys;
  if(keys.length>=3){
    const avg=keys.reduce((a,k)=>a+fs[k],0)/keys.length;
    const G=avg>=75?{g:'A',c:'#1fa463',m:'전반적으로 강한 종목'}:avg>=60?{g:'B',c:'#4fa383',m:'양호 — 일부 보완점 확인'}:avg>=45?{g:'C',c:'#d99a00',m:'평범 — 선별적 접근'}:{g:'D',c:'#e5832a',m:'약세 — 보수적 접근'};
    const sorted=keys.slice().sort((a,b)=>fs[b]-fs[a]), best=sorted[0], worst=sorted[sorted.length-1];
    const gl=k=>NM[k]+' '+usGradeOf(fs[k]).g;
    const pg0=usPeg(it).v;
    const v=kimValuationVerdict(rg==null?null:rg*100, it.psr, techD, (function(){ const e=[]; if(pg0!=null) e.push({grp:'재무', txt:'PEG '+pg0.toFixed(2)+(pg0<0.9?' — 성장 대비 저평가':pg0<=1.1?' — 적정':' — 성장 대비 고평가'), pt:pg0<0.9?1:pg0<=1.1?0:-1}); if(fs.revision!=null) e.push({grp:'재무', txt:'애널리스트 이익 추정 '+(fs.revision>=75?'상향 추세':fs.revision<=40?'하향 추세':'보합'), pt:fs.revision>=75?1:fs.revision<=40?-1:0}); return e; })());
    const vc=v?({0:'#0A6B48',1:'#B7791F',2:'#D92D20'})[v.idx]:'var(--tx2)';
    top='<div class="fv2-top"><div class="fv2-g" style="background:'+G.c+'">'+G.g+'</div><div class="fv2-gi"><b>김군 등급 · 종합 '+Math.round(avg)+'점</b><small>'+G.m+'</small><span class="l">👍 <b style="display:inline;font-size:12.5px;color:#0A6B48">'+gl(best)+'</b> · ⚠ <b style="display:inline;font-size:12.5px;color:#B42318">'+gl(worst)+'</b></span></div>'+
      (v?'<div class="fv2-v" title="재무 '+(v.fin>=0?'+':'')+v.fin+' · 기술 '+(v.tech>=0?'+':'')+v.tech+'"><small>김군 판정</small><b style="color:'+vc+'">'+v.label+'</b><i>재무 '+(v.fin>=0?'+':'')+v.fin+' · 기술 '+(v.hasTech?(v.tech>=0?'+':'')+v.tech:'—')+'</i></div>':'')+'@@FAC@@</div>';
    window.__fv2v=v;
  }
  const fac=keys.length?'<div class="fv2-row fv2-f">'+keys.map(k=>{const g=usGradeOf(fs[k]);return '<div class="fv2-c fv2-fc"><span class="gl" style="background:'+g.c+'">'+g.g+'</span><div><small>'+NM[k]+'</small><span>'+Math.round(fs[k])+'점</span></div></div>';}).join('')+'</div>':'';
  const tile=(l,v,c,sub)=>'<div class="fv2-c"><small>'+l+'</small><b'+(c?' style="color:'+c+'"':'')+'>'+v+'</b>'+(sub?'<em>'+sub+'</em>':'')+'</div>';
  const met='<div class="fv2-row fv2-m">'+tile('매출증가율',spc(rg),col(rg))+tile(opt.ogLabel||'영업이익증가율※',spc(eg),col(eg))+tile('PER',usFundNum(it.trailingPE,1))+tile('EPS(TTM)',won?mny(it.trailingEps):usFundNum(it.trailingEps))+tile(opt.fwdLabel||'EPS(Fwd)',opt.fwdShow?opt.fwdShow:usFundNum(it.forwardEps))+tile('PSR',usFundNum(it.psr))+'</div>';
  // 4축
  const gLv=rg==null?'n':rg>=0.15?'g':rg>0?'y':'r', pLv=om==null?'n':om>=0.2?'g':om>=0.08?'y':'r', eLv=roa==null?'n':roa>=0.10?'g':roa>=0.04?'y':'r';
  const dLv=de==null?'n':de<=80?'g':de<=150?'y':'r', cLv=cr==null?'n':cr>=1.5?'g':cr>=1?'y':'r';
  const sLv=(dLv==='n'&&cLv==='n')?'n':['r','y','g'].find(x=>dLv===x||cLv===x)||'y';
  const ax=[['성장성',gLv,'매출 '+spc(rg)],['수익성',pLv,'영업이익률 '+pc(om)],['효율성',eLv,'ROA '+pc(roa)],['안정성',sLv,'부채 '+(de==null?'—':de.toFixed(0)+'%')]];
  const axH='<div class="fv2-row fv2-a">'+ax.map(a=>'<div class="fv2-c fv2-ac" title="'+a[0]+' '+LN[a[1]]+' · '+a[2]+'"><i style="background:'+LC[a[1]]+'"></i><b>'+a[0]+' '+LN[a[1]]+'</b><span>'+a[2]+'</span></div>').join('')+'</div>';
  // 밸류 3종
  const eps=it.trailingEps, pe=it.trailingPE, px=it.price, pg=usPeg(it);
  let c1='', c2='', c3='';
  if(eps!=null||pe!=null) c1='<div class="fv2-c"><small>주가 = EPS × PER</small><b>'+mny(eps)+' × '+n2(pe,1)+'배</b><em>'+(px!=null?'= '+mny(px)+' · ':'')+(it.forwardEps!=null&&eps!=null?(it.forwardEps>eps?'선행 EPS가 더 높음(성장 기대)':'선행 EPS 정체'):'')+'</em></div>';
  if(pg.v!=null){ const v=pg.v, lv=v<0.9?'g':v<=1.1?'y':'r', pos=Math.max(2,Math.min(98,v/2*100));
    c2='<div class="fv2-c"><small>PEG'+(pg.fwd?'(근사)':'')+' · 현재 위치</small><b style="color:'+({g:'#0A6B48',y:'#8A5A00',r:'#B42318'})[lv]+'">'+v.toFixed(2)+' <span style="font-size:12px">'+(v<0.9?'저평가':v<=1.1?'적정':'고평가')+'</span></b><div style="position:relative;padding-bottom:16px"><div class="fv2-bar" style="height:9px;background:linear-gradient(90deg,#1fa463 0 45%,#f0b429 45% 55%,#e5332a 55% 100%)"></div><span style="position:absolute;left:'+pos+'%;top:9px;transform:translateX(-50%);font-size:13px;line-height:1;color:var(--tx)" aria-hidden="true">▲</span><span style="position:absolute;left:0;bottom:0;font-size:10.5px;color:var(--tx2)">0</span><span style="position:absolute;left:50%;bottom:0;transform:translateX(-50%);font-size:10.5px;color:var(--tx2)">1 적정</span><span style="position:absolute;right:0;bottom:0;font-size:10.5px;color:var(--tx2)">2+</span></div></div>'; }
  if(roa!=null||roe!=null){ const mx=Math.max(Math.abs(roa||0),Math.abs(roe||0),0.01), br=(n,v,cl)=>v==null?'':'<div style="display:flex;align-items:center;gap:6px;font-size:12px;margin-top:3px"><span style="width:30px">'+n+'</span><div class="fv2-bar" style="flex:1;margin:0"><i style="width:'+Math.max(2,Math.abs(v)/mx*100).toFixed(0)+'%;background:'+cl+'"></i></div><b style="font-size:12.5px;width:48px;text-align:right">'+pc(v)+'</b></div>';
    c3='<div class="fv2-c"><small>ROA vs ROE'+((roa>0&&roe!=null&&roe/roa>=3)?' · ⚠ 부채 영향':'')+'</small>'+br('ROA',roa,'var(--accent)')+br('ROE',roe,'var(--gold)')+'</div>'; }
  const val=(c1||c2||c3)?'<div class="fv2-row fv2-3">'+c1+c2+c3+'</div>':'';
  // 배당 한 줄
  const dv=it.div, dh=it.divHist||{};
  let dvH='';
  if(dv&&(dv.rate||dv.yield||dv.payout!=null)) dvH='<div class="fv2-row"><div class="fv2-c"><small>배당</small><b style="font-size:14px">수익률 '+(dv.yield!=null?(dv.yield*100).toFixed(2)+'%':'—')+' · 연 '+mny(dv.rate!=null?dv.rate:dh.lastAnnual)+(dv.payout!=null?' · 성향 '+(dv.payout*100).toFixed(0)+'%':'')+(dh.growth5!=null?' · 성장 '+(dh.growth5>=0?'+':'')+(dh.growth5*100).toFixed(0)+'%':'')+'</b></div></div>';
  // 상세
  const v=window.__fv2v; window.__fv2v=null;
  const rs=(v&&v.reasons||[]).map(r=>'<div><span>'+r.txt+'</span><b style="color:'+(r.pt>0?'var(--accent)':r.pt<0?'var(--up)':'var(--tx2)')+'">'+(r.pt>0?'+1':r.pt<0?'−1':'0')+'점</b></div>').join('');
  const more=rs?'<details><summary>📋 판정 근거 · 산식 보기</summary><div class="fv2-rs">'+rs+'</div><div style="padding:0 12px 10px">'+usVerdictFormulaHtml()+usGradeFormulaHtml()+'</div></details>':'';
  return '<div class="fv2"><div class="fv2-t">'+(opt.title||'재무비율 · 주가지표(Yahoo Finance 기준)')+'</div>'+(top?top.replace('@@FAC@@',fac):fac)+(opt.hideSix?'':met)+axH+val+dvH+more+
    '<p class="fv2-ft">'+(opt.foot||'※ 영업이익증가율은 Yahoo가 분기 이익 성장률로만 제공해 근사치입니다. 자체 계산 기준의 참고 자료이며 투자 권유가 아닙니다.')+'</p></div>';
}
function renderUsFinancialRatios(it, techD, opt){
  opt=opt||{};
  if(!it || (it.revenueGrowth==null && it.earningsGrowth==null && it.trailingEps==null && it.forwardEps==null && it.psr==null && it.trailingPE==null))
    return renderUsFinancialRatiosClassic(it,techD,opt);
  try{ return usFinCompact(it,techD,opt); }catch(e){ console.warn('재무 박스 v2 실패, 기존 형식 사용',e); return renderUsFinancialRatiosClassic(it,techD,opt); }
}

/* ===================== 관심종목(ETF) — 주요 보유종목·섹터 가중치 =====================
   Worker(/etf-holdings?ticker=)가 Yahoo Finance quoteSummary(topHoldings)를 종목별로 온디맨드
   조회해 24시간 KV 캐시해둔 결과를 그대로 받는다. 클릭한 종목만 불러오면 되므로(7개 전부를
   미리 받아둘 필요 없음) 종목별로 개별 캐시한다. */
function mkStamp(el,d){
  const p=n=>String(n).padStart(2,'0');
  el.classList.add('upd-pill'); el.title='이 페이지 데이터를 마지막으로 불러온 시각';
  el.innerHTML='<i class="upd-dot" aria-hidden="true"></i><span><span class="upd-d"><span class="upd-y">'+d.getFullYear()+'.</span>'+p(d.getMonth()+1)+'.'+p(d.getDate())+'</span> <span class="upd-t">'+p(d.getHours())+':'+p(d.getMinutes())+'</span><span class="upd-word"> 업데이트</span></span>';
}
const ETF_HOLD_CACHE={};
async function loadEtfHoldings(ticker){
  if(ETF_HOLD_CACHE[ticker]) return ETF_HOLD_CACHE[ticker];
  if(!PROXY_BASE) return null;
  try{
    const origin=PROXY_BASE.replace(/\?url=$/,'');
    const r=await fetch(origin+'etf-holdings?ticker='+encodeURIComponent(ticker),{signal:AbortSignal.timeout?AbortSignal.timeout(20000):undefined});
    const data=r.ok?await r.json():null;
    if(data){ ETF_HOLD_CACHE[ticker]=data; return data; }
  }catch(e){ console.warn('ETF 보유종목 로딩 실패:', e); }
  return null;
}
/* 스왑 기반 레버리지 ETF(SOXL 등)는 Yahoo가 보유종목을 비워 보내므로, 기초 ETF의 구성으로 대신 보여준다 */
async function loadEtfHoldingsFull(ticker){
  const d=await loadEtfHoldings(ticker);
  const m=(typeof LEV_META!=='undefined')?LEV_META[ticker]:null;
  if(!m||m.kr||(d&&d.holdings&&d.holdings.length)) return d;
  const u=await loadEtfHoldings(m.u);
  if(!u||!u.holdings||!u.holdings.length) return d;
  const base=d||{ticker:ticker,holdings:[],sectors:[],info:null};
  const info=Object.assign({},base.info||{},{pe:u.info&&u.info.pe,pb:u.info&&u.info.pb});
  return Object.assign({},base,{holdings:u.holdings,sectors:(base.sectors&&base.sectors.length>1)?base.sectors:u.sectors,info:info,viaUnderlying:m.u});
}
const ETF_SECTOR_NAME={
  realestate:'부동산', consumer_cyclical:'경기소비재', basic_materials:'소재',
  consumer_defensive:'필수소비재', technology:'기술', communication_services:'통신서비스',
  financial_services:'금융', utilities:'유틸리티', industrials:'산업재',
  energy:'에너지', healthcare:'헬스케어'
};

/* ===================== 레버리지 ETF — 최고의 투자자 관점 체크패널 =====================
   etfdb.com은 Cloudflare 봇 차단(403)으로 서버에서 가져올 수 없어, 같은 성격의 핵심 지표를
   Yahoo(보수·순자산·배당·베타·보유종목)와 시세(1년 일봉) 계산으로 대신 만든다. */
const LEV_META={
  TQQQ:{u:'QQQ', L:3, nm:'나스닥100 3배'},
  UPRO:{u:'SPY', L:3, nm:'S&P500 3배'},
  UDOW:{u:'DIA', L:3, nm:'다우30 3배'},
  TECL:{u:'XLK', L:3, nm:'기술섹터 3배'},
  BULZ:{u:'QQQ', L:3, nm:'FANG+ 3배(ETN, 기초 대용 QQQ)'},
  SOXL:{u:'SOXX',L:3, nm:'반도체 3배'},
  SMHU:{u:'SMH', L:3, nm:'반도체 3배(ETN, 기초 대용 SMH)'},
  FNGU:{u:'QQQ', L:3, nm:'FANG+ 3배(ETN, 기초 대용 QQQ)'},
  WEBL:{u:'FDN', L:3, nm:'인터넷 3배'},
  DFEN:{u:'ITA', L:3, nm:'항공우주·방산 3배'},
  FAS:{u:'XLF', L:3, nm:'금융 3배'},
  LABU:{u:'XBI', L:3, nm:'바이오텍 3배'},
  HIBL:{u:'SPHB',L:3, nm:'S&P500 고베타 3배'},
  KORU:{u:'EWY', L:3, nm:'한국 3배'},
  YINN:{u:'FXI', L:3, nm:'중국 3배(기초 대용 FXI)'},
  INDL:{u:'INDA',L:2,nm:'인도 2배(기초 대용 INDA)'},
  TNA:{u:'IWM',L:3,nm:'미국 소형주 3배'},
  TMF:{u:'TLT',L:3,nm:'미국 장기국채 3배'},
  DRN:{u:'IYR',L:3,nm:'미국 부동산 3배(기초 대용 IYR)'},
  GDXU:{u:'GDX', L:3, nm:'금광 3배(ETN, 기초 대용 GDX)'},
  '122630.KS':{u:'^KS200',L:2,nm:'코스피200 2배',kr:1},
  '243880.KS':{u:'139260.KS',L:2,nm:'코스피200 IT 2배(기초 대용 TIGER 200IT)',kr:1},
  '494310.KS':{u:'091160.KS',L:2,nm:'반도체 2배(기초 대용 KODEX 반도체)',kr:1},
  '0080Y0.KS':{u:'466920.KS',L:2,nm:'조선 TOP3 플러스 2배(기초 대용 SOL 조선TOP3플러스)',kr:1},
  '233740.KS':{u:'229200.KS',L:2,nm:'코스닥150 2배(기초 대용 KODEX 코스닥150)',kr:1},
  '0193T0.KS':{u:'000660.KS',L:2,nm:'SK하이닉스 단일종목 2배',kr:1},
  '0193W0.KS':{u:'005930.KS',L:2,nm:'삼성전자 단일종목 2배',kr:1}
};
const LEV_UND_CACHE={};
function levStats(etf, und, L){
  if(!etf||etf.length<30) return null;
  const rets=a=>{const r=[];for(let i=1;i<a.length;i++) r.push(a[i]/a[i-1]-1);return r;};
  const re=rets(etf);
  const mean=re.reduce((x,y)=>x+y,0)/re.length;
  const vol=Math.sqrt(re.reduce((x,y)=>x+(y-mean)*(y-mean),0)/re.length)*Math.sqrt(252)*100;
  let peak=etf[0], mdd=0;
  etf.forEach(v=>{ if(v>peak) peak=v; const dd=(v/peak-1)*100; if(dd<mdd) mdd=dd; });
  const cur=(etf[etf.length-1]/peak-1)*100;
  const ret1y=(etf[etf.length-1]/etf[0]-1)*100;
  const worstDay=Math.min.apply(null,re)*100;
  const out={vol:vol,mdd:mdd,fromPeak:cur,ret1y:ret1y,worstDay:worstDay,decay:L*(L-1)/2*Math.pow(vol/L/100,2)*100};
  if(und&&und.length>30){
    const n=Math.min(etf.length,und.length);
    const u=und.slice(-n), e=etf.slice(-n);
    const ur=rets(u);
    let ideal=1; ur.forEach(r=>{ ideal*=(1+L*r); });
    out.undRet=(u[u.length-1]/u[0]-1)*100;
    out.simple=L*out.undRet;
    out.ideal=(ideal-1)*100;
    out.actual=(e[e.length-1]/e[0]-1)*100;
    out.undWorst=Math.min.apply(null,ur)*100;
  }
  return out;
}
function levInvestorHtml(ticker, info, etfD, undD){
  const m=LEV_META[ticker]; if(!m) return '';
  const st=levStats(etfD, undD, m.L);
  const f1=v=>v==null?'—':(v>=0?'+':'')+v.toFixed(1)+'%';
  const colr=v=>v==null?'var(--tx2)':v>=0?'var(--up)':'var(--down)';
  const money=v=>v==null?'—':(v>=1e9?'$'+(v/1e9).toFixed(2)+'B':'$'+(v/1e6).toFixed(0)+'M');
  const cell=(k,v,sub,c)=>'<div style="padding:10px 12px;border-radius:10px;background:var(--panel);border:1px solid var(--line)"><div class="mut" style="font-size:11px">'+k+'</div><div style="font-size:17px;font-weight:900;color:'+(c||'var(--tx)')+';margin-top:2px">'+v+'</div>'+(sub?'<div class="mut" style="font-size:10.5px;margin-top:2px">'+sub+'</div>':'')+'</div>';
  let h='<div style="margin-bottom:14px"><div style="font-size:13px;font-weight:900;margin-bottom:8px">🧭 투자자 체크패널 — '+ticker+' <span class="mut" style="font-weight:600">('+m.nm+' · 기초 '+m.u+')</span></div>';
  // 1) 비용·규모
  const exp=info&&info.expenseRatio, aum=info&&info.totalAssets;
  if(!m.kr) h+='<div style="font-size:11.5px;font-weight:800;color:var(--tx2);margin:6px 0">① 비용 · 규모 · 유동성</div><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px">'+
    cell('총보수(연)',exp!=null?(exp*100).toFixed(2)+'%':'—',exp!=null?'1억 보유 시 연 '+Math.round(exp*1e8/10000).toLocaleString('ko-KR')+'만원':'',exp!=null&&exp>=0.01?'var(--up)':null)+
    cell('순자산(AUM)',money(aum),aum!=null?(aum>=1e9?'규모 충분 · 청산 위험 낮음':aum>=2e8?'보통':'소형 · 상장폐지 위험 점검'):'',null)+
    cell('배당수익률',info&&info.yield!=null?(info.yield*100).toFixed(2)+'%':'—','레버리지는 배당이 작음',null)+
    cell('베타(3년)',info&&info.beta3y!=null?info.beta3y.toFixed(2):'—','시장 대비 민감도',null)+'</div>';
  if(st){
    // 2) 위험
    h+='<div style="font-size:11.5px;font-weight:800;color:var(--tx2);margin:12px 0 6px">② 위험 (최근 1년 실측)</div><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px">'+
      cell('연환산 변동성',st.vol.toFixed(0)+'%','일간 수익률 표준편차×√252',st.vol>=80?'var(--up)':null)+
      cell('최대 낙폭(MDD)',st.mdd.toFixed(1)+'%','1년 내 고점→저점','var(--down)')+
      cell('현재 고점 대비',st.fromPeak.toFixed(1)+'%',st.fromPeak<=-30?'깊은 조정 구간 · 분할 접근':st.fromPeak>=-5?'고점 부근 · 추격 주의':'',colr(st.fromPeak))+
      cell('최악의 하루',st.worstDay.toFixed(1)+'%','기초 −'+(100/m.L).toFixed(0)+'% 일간 하락 시 전손',st.worstDay<=-15?'var(--down)':null)+
      cell('MDD 본전에 필요한 상승',st.mdd<0&&st.mdd>-100?'+'+((1/(1+st.mdd/100)-1)*100).toFixed(0)+'%':'—','저점에서 고점 회복까지 필요한 상승률','var(--up)')+
      cell('지금 고점까지 필요한 상승',st.fromPeak<0&&st.fromPeak>-100?'+'+((1/(1+st.fromPeak/100)-1)*100).toFixed(0)+'%':'고점 부근','현재가 → 1년 고점 회복',st.fromPeak<=-30?'var(--up)':null)+'</div>'+
      (m.L>=3?'<div class="mut" style="font-size:11.5px;margin-top:8px;line-height:1.55;font-weight:700">⚠ '+m.L+'배 상품은 하락폭이 클수록 회복에 훨씬 큰 상승이 필요하고, 횡보만 해도 복리 감쇠로 손실이 쌓입니다. 장기 보유보다 단기·비중 제한 상품입니다.'+(/^(SMHU|FNGU|GDXU)$/.test(ticker)?' 이 종목은 ETN으로 발행사 신용위험이 추가됩니다.':'')+'</div>':'');
    // 3) 레버리지 구조 비용
    h+='<div style="font-size:11.5px;font-weight:800;color:var(--tx2);margin:12px 0 6px">③ 레버리지 구조 — 복리 감쇠 점검</div><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px">';
    if(st.undRet!=null){
      h+=cell('기초 '+m.u+' 1년',f1(st.undRet),'',colr(st.undRet))+
         cell(m.L+'배 단순 환산',f1(st.simple),'기초×'+m.L,colr(st.simple))+
         cell('일일 '+m.L+'배 이상치',f1(st.ideal),'매일 리셋 복리 계산',colr(st.ideal))+
         cell('실제 '+ticker+' 1년',f1(st.actual),'운용보수·추적오차 포함',colr(st.actual));
    }else{
      h+=cell('실제 '+ticker+' 1년',f1(st.ret1y),'',colr(st.ret1y));
    }
    h+=cell('횡보장 연 감쇠 추정','−'+st.decay.toFixed(1)+'%','변동성이 클수록 커짐(L(L−1)/2·σ²)','var(--down)')+'</div>';
    if(st.undRet!=null){
      const gap=st.actual-st.simple;
      h+='<div class="mut" style="font-size:11.5px;margin-top:8px;line-height:1.55">💡 기초가 1년간 '+f1(st.undRet)+'일 때 단순히 '+m.L+'배를 곱하면 '+f1(st.simple)+'이지만 실제는 '+f1(st.actual)+'입니다(차이 '+f1(gap)+'p). '+(gap<0?'변동성이 큰 구간일수록 복리 감쇠로 장기 보유 수익이 단순 환산보다 낮아집니다.':'추세가 한 방향으로 이어진 구간에서는 복리 효과로 단순 환산보다 높을 수 있으나 되돌림 시 반대로 작동합니다.')+'</div>';
    }
  }
  // 4) 구성
  const hl=(info&&info._holds)||[];
  h+='</div>';
  return h;
}
function levConcentrationHtml(data){
  if(!data||!data.holdings||!data.holdings.length) return '';
  const hs=data.holdings.map(x=>x.pct||0).sort((a,b)=>b-a);
  const top3=hs.slice(0,3).reduce((x,y)=>x+y,0)*100, top10=hs.slice(0,10).reduce((x,y)=>x+y,0)*100;
  const info=data.info||{};
  const lvl=top10>=60?'집중도 높음':top10>=40?'보통':'분산';
  let h='<div style="font-size:11.5px;font-weight:800;color:var(--tx2);margin:6px 0">④ 구성 집중도 · 밸류에이션</div><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;margin-bottom:14px">'+
   '<div style="padding:10px 12px;border-radius:10px;background:var(--panel);border:1px solid var(--line)"><div class="mut" style="font-size:11px">상위 3종목 합</div><div style="font-size:17px;font-weight:900">'+top3.toFixed(1)+'%</div></div>'+
   '<div style="padding:10px 12px;border-radius:10px;background:var(--panel);border:1px solid var(--line)"><div class="mut" style="font-size:11px">상위 10종목 합</div><div style="font-size:17px;font-weight:900">'+top10.toFixed(1)+'%</div><div class="mut" style="font-size:10.5px">'+lvl+'</div></div>'+
   '<div style="padding:10px 12px;border-radius:10px;background:var(--panel);border:1px solid var(--line)"><div class="mut" style="font-size:11px">보유종목 평균 PER</div><div style="font-size:17px;font-weight:900">'+(info.pe!=null&&info.pe>0?(info.pe<1?1/info.pe:info.pe).toFixed(1):'—')+'</div><div class="mut" style="font-size:10.5px">PBR '+(info.pb!=null&&info.pb>0?(info.pb<1?1/info.pb:info.pb).toFixed(1):'—')+'</div></div>'+
   '</div>';
  return h;
}
const LEV_TICKERS=Object.keys(LEV_META);

/* ===== 투자자 체크패널 v2 — 작은 타일 + 핵심 경고 칩으로 한눈에(박스 크기 축소) ===== */
function injectLevCss(){
  if(document.getElementById('lv2-css')) return;
  const st=document.createElement('style'); st.id='lv2-css';
  st.textContent='.lv2{margin:0 0 10px;min-width:0;max-width:100%}'+
  '.lv2 .lv2-hd{display:flex;flex-wrap:wrap;align-items:baseline;gap:2px 8px;padding:7px 12px;background:#0A6B48;color:#fff;border-radius:4px 4px 0 0;font-size:13.5px;font-weight:800}'+
  '.lv2 .lv2-hd small{font-size:11.5px;font-weight:500;color:#CFE9DC}'+
  '.lv2 .lv2-fl{display:flex;flex-wrap:wrap;gap:5px;padding:8px 10px;border:1px solid var(--line);border-top:0;background:var(--panel2,#F6F8F7)}'+
  '.lv2 .lv2-fl span{font-size:12px;font-weight:800;padding:3px 9px;border-radius:12px;background:var(--panel,#fff);border:1px solid var(--line);white-space:nowrap}'+
  '.lv2 .lv2-fl .w{border-color:#E0A33A;background:#FFF4DC;color:#7A4A00}.lv2 .lv2-fl .b{border-color:#E08585;background:#FDECEC;color:#9B1C1C}.lv2 .lv2-fl .g{border-color:#7DB89A;background:#E6F4EC;color:#0A5B3A}'+
  '.lv2 .lv2-gs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;margin-top:8px;align-items:stretch}'+
  '.lv2 .lv2-g{min-width:0;border:1px solid var(--line);border-radius:4px;background:var(--panel,#fff);padding:0;overflow:hidden;display:flex;flex-direction:column}.lv2 .lv2-g>.lv2-t{margin:0 9px 4px;width:calc(100% - 18px)}.lv2 .lv2-g>.lv2-tip{margin:8px 12px}'+
  '.lv2 .lv2-g.wide{grid-column:auto}'+
  '.lv2 .lv2-t th,.lv2 .lv2-t td{display:table-cell!important}'+
  '.lv2 .lv2-t{width:100%;border-collapse:collapse}.lv2 .lv2-t th{text-align:left;font-size:12px;font-weight:700;padding:5px 4px 5px 0;border-top:1px solid var(--line);vertical-align:middle;color:var(--tx)}.lv2 .lv2-t tr:first-child th,.lv2 .lv2-t tr:first-child td{border-top:0}.lv2 .lv2-t th small{display:block;font-size:10.5px;font-weight:400;color:var(--tx2);line-height:1.3;margin-top:1px}.lv2 .lv2-bar{display:block;height:4px;border-radius:2px;background:var(--line);margin-top:4px;overflow:hidden}.lv2 .lv2-bar b{display:block;height:100%;border-radius:2px;background:#0A6B48}.lv2 .lv2-bar.r b{background:#C0392B}.lv2 .lv2-bar.o b{background:#D98A00}.lv2 .lv2-bar.u b{background:#2F6FB8}.lv2 .lv2-t td{text-align:right;font-size:14px;font-weight:900;padding:5px 0 5px 6px;border-top:1px solid var(--line);white-space:nowrap;font-variant-numeric:tabular-nums;vertical-align:middle}'+
  '.lv2 .lv2-g h4{margin:0;padding:6px 9px;font-size:12.5px;font-weight:800;color:var(--tx);background:var(--panel2,#F6F8F7);border-bottom:1px solid var(--line);border-left:4px solid #0A6B48}.lv2 .lv2-g.c2 h4{border-left-color:#C0392B}.lv2 .lv2-g.c3 h4{border-left-color:#D98A00}.lv2 .lv2-g.c4 h4{border-left-color:#2F6FB8}'+
  '.lv2 .lv2-k{display:grid;grid-template-columns:repeat(auto-fit,minmax(84px,1fr));gap:5px}'+
  '.lv2 .lv2-k>div{min-width:0;padding:5px 7px;border-radius:4px;background:var(--panel2,#F6F8F7)}'+
  '.lv2 .lv2-k small{display:block;font-size:10.5px;color:var(--tx2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'+
  '.lv2 .lv2-k b{display:block;font-size:15px;font-weight:900;line-height:1.25;font-variant-numeric:tabular-nums;white-space:nowrap}'+
  '.lv2 .lv2-tip{margin:8px 0 0;font-size:12px;line-height:1.55;color:var(--tx2)}'+
  '.lv2 .lv2-ft{margin:6px 0 0;font-size:10.5px;color:var(--tx2);line-height:1.5}'+
  '@media(max-width:1000px){.lv2 .lv2-gs{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:700px){.lv2 .lv2-gs{grid-template-columns:minmax(0,1fr);gap:6px}.lv2 .lv2-k{grid-template-columns:repeat(3,minmax(0,1fr));gap:4px}.lv2 .lv2-k>div{padding:4px 6px}.lv2 .lv2-k small{font-size:10px}.lv2 .lv2-k b{font-size:13.5px}.lv2 .lv2-hd{padding:6px 10px;font-size:14px}.lv2 .lv2-fl{padding:6px 8px;gap:4px}.lv2 .lv2-fl span{font-size:11.5px;padding:2px 8px;white-space:normal}}';
  document.head.appendChild(st);
}
function levPanelHtml(ticker, data, etfD, undD){
  const m=LEV_META[ticker]; if(!m) return '';
  injectLevCss();
  const info=(data&&data.info)||null, st=levStats(etfD, undD, m.L);
  const f1=v=>v==null?'—':(v>=0?'+':'')+v.toFixed(1)+'%';
  const colr=v=>v==null?'':v>=0?'color:var(--up)':'color:var(--down)';
  const money=v=>v==null?'—':(v>=1e9?'$'+(v/1e9).toFixed(1)+'B':'$'+(v/1e6).toFixed(0)+'M');
  const bar=(p,c)=>p==null||!isFinite(p)?'':'<i class="lv2-bar '+(c||'')+'"><b style="width:'+Math.max(2,Math.min(100,p)).toFixed(0)+'%"></b></i>';
  const k=(l,v,tip,sty,bp,bc)=>'<tr><th scope="row">'+l+(tip?'<small>'+tip+'</small>':'')+bar(bp,bc)+'</th><td style="'+(sty||'')+'">'+v+'</td></tr>';
  const fl=[]; const flag=(t,c)=>fl.push('<span class="'+c+'">'+t+'</span>');
  let g='';
  const exp=info&&info.expenseRatio, aum=info&&info.totalAssets;
  if(!m.kr){
    if(exp==null&&aum==null&&(!info||(info.yield==null&&info.beta3y==null))) g+='<section class="lv2-g"><h4>① 비용 · 규모</h4><p class="lv2-tip">총보수·순자산 정보를 Yahoo에서 받지 못했습니다. 잠시 후 다시 열어보거나 운용사 페이지를 확인해 주세요.</p></section>'; else
    g+='<section class="lv2-g c1"><h4>① 비용 · 규모</h4><table class="lv2-t"><tbody>'+
      k('총보수(연)',exp!=null?(exp*100).toFixed(2)+'%':'—',exp!=null?'1억 보유 시 연 '+Math.round(exp*1e4).toLocaleString('ko-KR')+'만원':'',exp!=null&&exp>=0.01?'color:var(--up)':'')+
      k('순자산',money(aum),aum!=null?(aum>=1e9?'규모 충분 · 청산 위험 낮음':aum>=2e8?'보통':'소형 · 상장폐지 위험 점검'):'')+
      k('배당률',info&&info.yield!=null?(info.yield*100).toFixed(2)+'%':'—','레버리지는 배당이 작음')+
      k('베타(3년)',info&&info.beta3y!=null?info.beta3y.toFixed(2):'—','시장 대비 민감도')+'</tbody></table></section>';
    if(exp!=null&&exp>=0.01) flag('보수 '+(exp*100).toFixed(2)+'% 높음','w');
    if(aum!=null&&aum<2e8) flag('소형 ETF · 청산 위험 점검','b');
  }
  if(st){
    g+='<section class="lv2-g c2"><h4>② 위험 (최근 1년)</h4><table class="lv2-t"><tbody>'+
      k('변동성(연)',st.vol.toFixed(0)+'%','일간 수익률 표준편차×√252',st.vol>=80?'color:var(--up)':'',st.vol/2,st.vol>=80?'r':'o')+
      k('최대낙폭',st.mdd.toFixed(1)+'%','1년 내 고점→저점','color:var(--down)',-st.mdd,'r')+
      k('고점 대비',st.fromPeak.toFixed(1)+'%',st.fromPeak<=-30?'깊은 조정 구간':st.fromPeak>=-5?'고점 부근':'',colr(st.fromPeak),-st.fromPeak,st.fromPeak<=-30?'r':'o')+
      k('최악의 하루',st.worstDay.toFixed(1)+'%','기초 −'+(100/m.L).toFixed(0)+'% 일간 하락 시 전손',st.worstDay<=-15?'color:var(--down)':'')+
      k('MDD 회복 필요',st.mdd<0&&st.mdd>-100?'+'+((1/(1+st.mdd/100)-1)*100).toFixed(0)+'%':'—','저점에서 직전 고점까지 회복에 필요한 상승률','color:var(--up)')+
      k('고점 회복 필요',st.fromPeak<0&&st.fromPeak>-100?'+'+((1/(1+st.fromPeak/100)-1)*100).toFixed(0)+'%':'고점 부근','현재가에서 1년 고점까지 필요한 상승률',st.fromPeak<=-30?'color:var(--up)':'')+'</tbody></table></section>';
    if(st.vol>=80) flag('변동성 '+st.vol.toFixed(0)+'% 매우 높음','b');
    if(st.fromPeak<=-30) flag('고점 대비 '+st.fromPeak.toFixed(0)+'% 깊은 조정','w'); else if(st.fromPeak>=-5) flag('고점 부근 · 추격 주의','w');
    g+='<section class="lv2-g c3"><h4>③ 레버리지 구조 · 복리 감쇠</h4><table class="lv2-t"><tbody>'+
      (st.undRet!=null?
        k('기초 '+m.u,f1(st.undRet),'기초 자산 1년 수익률',colr(st.undRet))+k(m.L+'배 단순',f1(st.simple),'기초×'+m.L,colr(st.simple))+k('일일 '+m.L+'배',f1(st.ideal),'매일 리셋 복리 계산',colr(st.ideal))+k('실제 '+ticker,f1(st.actual),'운용보수·추적오차 포함',colr(st.actual))
        :k('실제 '+ticker,f1(st.ret1y),'',colr(st.ret1y)))+
      k('횡보 감쇠(연)','−'+st.decay.toFixed(1)+'%','변동성이 클수록 커짐 L(L−1)/2·σ²','color:var(--down)')+'</tbody></table></section>';
    if(st.undRet!=null){ const gap=st.actual-st.simple; if(gap<-5) flag('단순 '+m.L+'배보다 '+f1(gap)+'p 낮음(복리 감쇠)','w'); }
  }
  const hs=(data&&data.holdings&&data.holdings.length)?data.holdings.map(x=>x.pct||0).sort((a,b)=>b-a):null;
  if(hs){
    const top3=hs.slice(0,3).reduce((x,y)=>x+y,0)*100, top10=hs.slice(0,10).reduce((x,y)=>x+y,0)*100, inf=(data&&data.info)||{};
    const lvl=top10>=60?'집중도 높음':top10>=40?'보통':'분산';
    const pe=inf.pe!=null&&inf.pe>0?(inf.pe<1?1/inf.pe:inf.pe).toFixed(1):'—', pb=inf.pb!=null&&inf.pb>0?(inf.pb<1?1/inf.pb:inf.pb).toFixed(1):'—';
    g+='<section class="lv2-g c4"><h4>④ 구성 집중도 · 밸류에이션</h4><table class="lv2-t"><tbody>'+k('상위 3종목',top3.toFixed(1)+'%','보유 비중 상위 3개 합계','',top3,'u')+k('상위 10종목',top10.toFixed(1)+'%','상위 10개 합계 · '+lvl,'',top10,top10>=60?'o':'u')+k('집중도',lvl,'60%↑ 높음 · 40%↑ 보통')+k('평균 PER',pe,'보유종목 평균')+k('평균 PBR',pb,'보유종목 평균')+'</tbody></table></section>';
    if(top10>=60) flag('상위 10종목 '+top10.toFixed(0)+'% 집중','w');
  }
  if(m.L>=3) flag(m.L+'배 상품 · 비중 제한 필요','w');
  if(/^(SMHU|FNGU|GDXU)$/.test(ticker)) flag('ETN · 발행사 신용위험','b');
  if(!fl.length) flag('특이 경고 없음','g');
  let tip='';
  if(st&&st.undRet!=null){ const gap=st.actual-st.simple;
    tip='<p class="lv2-tip">💡 기초가 1년간 '+f1(st.undRet)+'일 때 단순 '+m.L+'배는 '+f1(st.simple)+', 실제는 '+f1(st.actual)+'입니다(차이 '+f1(gap)+'p). '+(gap<0?'변동성이 큰 구간일수록 복리 감쇠로 장기 보유 수익이 단순 환산보다 낮아집니다.':'추세가 한 방향으로 이어진 구간에서는 복리 효과가 오히려 수익을 키울 수 있습니다.')+'</p>'; }
  return '<div class="lv2" data-pro="1"><div class="lv2-hd">🧭 투자자 체크패널 — '+ticker+'<small>'+m.nm+' · 기초 '+m.u+'</small></div><div class="lv2-fl" aria-label="핵심 경고">'+fl.join('')+'</div><div class="lv2-gs">'+g+'</div>'+tip+
    '<p class="lv2-ft">⚠ 레버리지 ETF는 장기 보유 시 복리 감쇠로 손실이 커질 수 있으며 원금 전액 손실도 가능합니다. Yahoo Finance 데이터와 자체 계산에 기반한 참고 자료로 투자 권유가 아닙니다.</p></div>';
}
async function renderLevPanel(ticker, data){
  const m=LEV_META[ticker]; if(!m) return '';
  let etfD=null, undD=null;
  try{ etfD=(typeof tickData!=='undefined'&&tickData[ticker])||await yclose(ticker,'1y'); }catch(e){}
  try{ if(LEV_UND_CACHE[m.u]===undefined) LEV_UND_CACHE[m.u]=await yclose(m.u,'1y'); undD=LEV_UND_CACHE[m.u]; }catch(e){}
  return levPanelHtml(ticker,data,etfD,undD);
}

function renderEtfHoldings(data){
  if(!data || !Array.isArray(data.holdings) || !Array.isArray(data.sectors) || (!data.holdings.length && !data.sectors.length)){
    return '<p class="mut" style="font-size:12.5px">보유종목·섹터 정보를 가져오지 못했습니다(개별주 ETN이거나 Yahoo가 이 상품의 구성정보를 제공하지 않을 수 있습니다).</p>';
  }
  const pct=v=>(v*100).toFixed(1)+'%';
  const COLS=['#0A6B48','#1F8A5F','#3FA37A','#66B896','#8CCBB0'];
  let html='<div class="eh2" style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:20px">';
  if(data.holdings.length){
    const hs=data.holdings.slice(0,10), mx=Math.max.apply(null,hs.map(x=>x.pct||0))||1, sum=hs.reduce((a,x)=>a+(x.pct||0),0), top3=hs.slice(0,3).reduce((a,x)=>a+(x.pct||0),0);
    html+='<div><div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px;margin-bottom:6px"><b style="font-size:13px">주요 보유종목 TOP'+hs.length+(data.viaUnderlying?' <span class="mut" style="font-weight:600;font-size:11.5px">(기초 '+stockEscape(data.viaUnderlying)+' 구성 기준)</span>':'')+'</b><span class="mut" style="font-size:12px">상위10 합계 <b style="color:var(--tx)">'+pct(sum)+'</b> · 상위3 <b style="color:var(--tx)">'+pct(top3)+'</b></span></div>'+
      /* 누적 비중 띠: 종목별 실제 비중 비율대로 */
      '<div role="img" aria-label="상위 10종목 누적 비중 '+pct(sum)+'" style="display:flex;height:12px;border-radius:6px;overflow:hidden;background:var(--line);margin-bottom:8px">'+
        hs.map((h,i)=>'<i title="'+stockEscape(h.symbol||'')+' '+pct(h.pct||0)+'" style="display:block;width:'+((h.pct||0)*100).toFixed(2)+'%;background:'+COLS[Math.min(4,Math.floor(i/2))]+';border-right:1px solid var(--panel2)"></i>').join('')+'</div>';
    hs.forEach((h,i)=>{
      const w=Math.max(2,(h.pct||0)/mx*100);
      html+='<div style="display:flex;align-items:center;gap:8px;margin-bottom:5px;font-size:12.5px">'+
        '<span style="width:16px;flex:none;text-align:right;color:var(--tx2);font-size:11.5px">'+(i+1)+'</span>'+
        '<span style="width:54px;flex:none;font-weight:800">'+stockEscape(h.symbol||'')+'</span>'+
        '<div style="flex:1;min-width:0;background:var(--panel);border-radius:3px;overflow:hidden;height:16px"><div style="width:'+w.toFixed(1)+'%;height:100%;background:'+COLS[Math.min(4,Math.floor(i/2))]+'"></div></div>'+
        '<span style="width:46px;text-align:right;flex:none;font-weight:800;font-variant-numeric:tabular-nums">'+pct(h.pct)+'</span></div>';
    });
    html+='<div class="mut" style="font-size:11px;margin-top:4px">막대 길이 = 비중 크기 비교(1위 기준) · 위 띠는 실제 비중 비율</div></div>';
  }else html+='<div></div>';
  if(data.sectors.length){
    const ss=data.sectors.filter(s=>(s.pct||0)>=0.0005).slice(0,10), maxPct=Math.max.apply(null,ss.map(s=>s.pct||0));
    html+='<div><div style="margin-bottom:6px"><b style="font-size:13px">섹터 가중치</b></div>';
    ss.forEach(s=>{
      const w=maxPct>0?Math.max(2,(s.pct/maxPct)*100):2;
      html+='<div style="display:flex;align-items:center;gap:8px;margin-bottom:5px;font-size:12.5px">'+
        '<span style="width:76px;flex:none">'+stockEscape(ETF_SECTOR_NAME[s.key]||s.key)+'</span>'+
        '<div style="flex:1;min-width:0;background:var(--panel);border-radius:3px;overflow:hidden;height:16px"><div style="width:'+w.toFixed(1)+'%;height:100%;background:var(--gold)"></div></div>'+
        '<span style="width:46px;text-align:right;flex:none;font-weight:800;font-variant-numeric:tabular-nums">'+pct(s.pct)+'</span></div>';
    });
    html+='</div>';
  }else html+='<div></div>';
  html+='</div><style>@media(max-width:700px){.eh2{grid-template-columns:minmax(0,1fr)!important}}</style><div class="mut" style="font-size:11px;margin-top:6px">출처: Yahoo Finance · 보유 구성은 운용사가 주기적으로 갱신합니다</div>';
  return html;
}

function renderUsFundamentals(items){
  const el=document.getElementById('us-fund-tbl');
  if(!el) return;
  el.innerHTML=items.map(it=>{
    const rg=usFundPct(it.revenueGrowth), eg=usFundPct(it.earningsGrowth);
    const rgColor=it.revenueGrowth==null?'var(--tx2)':(it.revenueGrowth>=0?'var(--up)':'var(--down)');
    const egColor=it.earningsGrowth==null?'var(--tx2)':(it.earningsGrowth>=0?'var(--up)':'var(--down)');
    return '<tr><td style="font-weight:700">'+stockEscape(it.ticker)+' <span class="mut" style="font-weight:400;font-size:12px">'+(US_FUND_NAME[it.ticker]||'')+'</span></td>'+
      '<td style="text-align:right;color:'+rgColor+'">'+rg+'</td>'+
      '<td style="text-align:right;color:'+egColor+'">'+eg+'</td>'+
      '<td style="text-align:right">'+usFundNum(it.trailingEps)+' / '+usFundNum(it.forwardEps)+'</td>'+
      '<td style="text-align:right">'+usFundNum(it.psr)+'</td>'+
      '<td style="text-align:right">'+usFundNum(it.trailingPE,1)+'</td></tr>';
  }).join('');
}

/* ===================== 미국지수 페이지 "유니콘 기업" 섹션 — 최근 뉴스 =====================
   Worker(/unicorn-news)가 Google News RSS를 회사별로 모아 KV에 6시간 캐시해둔 결과를 그대로
   받아 각 카드 하단의 뉴스 리스트를 채운다. 카드가 정적 마크업이라 회사키→컨테이너id 매핑을 고정한다. */
const UNICORN_NEWS_CONTAINERS={anthropic:'unicorn-news-anthropic',openai:'unicorn-news-openai',databricks:'unicorn-news-databricks',xai:'unicorn-news-xai'};
async function loadUnicornNews(){
  if(!PROXY_BASE) return;
  try{
    const origin=PROXY_BASE.replace(/\?url=$/,'');
    const r=await fetch(origin+'unicorn-news',{signal:AbortSignal.timeout?AbortSignal.timeout(35000):undefined});
    const data=r.ok?await r.json():null;
    if(data && data.news && Object.keys(data.news).some(k=>(data.news[k]||[]).length)) renderUnicornNews(data.news);
    else if(data && data.news && !loadUnicornNews._r){ loadUnicornNews._r=1; renderUnicornNews(data.news); setTimeout(loadUnicornNews,20000); }
    else Object.values(UNICORN_NEWS_CONTAINERS).forEach(id=>{const el=document.getElementById(id); if(el) el.innerHTML='<div class="mut" style="font-size:11.5px">뉴스를 가져오지 못했습니다</div>';});
  }catch(e){
    console.warn('유니콘 기업 최근 뉴스 로딩 실패:', e);
    Object.values(UNICORN_NEWS_CONTAINERS).forEach(id=>{const el=document.getElementById(id); if(el) el.innerHTML='<div class="mut" style="font-size:11.5px">뉴스를 가져오지 못했습니다</div>';});
  }
}
function unicornNewsAgo(pubDate){
  if(!pubDate) return '';
  const d=new Date(pubDate);
  if(isNaN(d.getTime())) return '';
  const diffH=Math.max(0,Math.round((Date.now()-d.getTime())/3600000));
  if(diffH<1) return '방금 전';
  if(diffH<24) return diffH+'시간 전';
  return Math.round(diffH/24)+'일 전';
}
function renderUnicornNews(newsByKey){
  Object.keys(UNICORN_NEWS_CONTAINERS).forEach(key=>{
    const el=document.getElementById(UNICORN_NEWS_CONTAINERS[key]);
    if(!el) return;
    const items=newsByKey[key]||[];
    if(!items.length){ el.innerHTML='<div class="mut" style="font-size:11.5px">최근 뉴스가 없습니다</div>'; return; }
    el.innerHTML=items.map(it=>
      '<div style="margin-top:5px;font-size:12px;line-height:1.35"><a href="'+stockSafeURL(it.url)+'" target="_blank" rel="noopener" class="news-link" style="text-decoration:none">'+stockEscape(it.title)+'</a>'+
      '<span class="mut" style="font-size:10.5px"> · '+stockEscape(it.source||'')+(it.pubDate?' · '+unicornNewsAgo(it.pubDate):'')+'</span></div>'
    ).join('');
  });
}

/* 미국지수·한국지수 페이지의 "관심종목" 모바일 워치리스트(.wl-list/.wl-row)와 동일한 패턴 —
   좁은 화면에서 표(table)의 셀 줄바꿈으로 가독성이 떨어지는 문제를 피하기 위해 행 카드형으로 렌더링.
   정기예금/적금 탭으로 하나만 골라서 보고, 은행/저축은행 필터를 그 위에 추가로 적용한다. */
// 목록(이미 Worker에서 금리 내림차순 정렬됨)이 길어 기본은 금리 Top3만 보여주고,
// "더보기" 클릭 시에만 나머지(최대 30개)를 펼친다. 탭/필터를 바꾸면 다시 Top3부터 시작한다.
let finSavingsExpanded=false, finSavingsFail='';
function renderFinSavingsTable(listId, list){
  const el=document.getElementById(listId);
  if(!el) return;
  if(!list){ el.innerHTML='<div class="fs-row"><span class="mut">불러오는 중…</span></div>'; return; }
  const filtered=finSavingsGroup==='전체'?list:list.filter(it=>it.group===finSavingsGroup);
  if(!filtered.length){ el.innerHTML='<div class="fs-row"><span class="mut">'+(list.length?'이 분류에 표시할 상품이 없습니다':'표시할 금리 데이터가 없습니다'+devHint(finSavingsFail.replace(/</g,'&lt;')))+'</span></div>'; return; }
  const capped=filtered.slice(0,30);
  const showCount=finSavingsExpanded?capped.length:Math.min(capped.length,3);
  const rowsHtml=capped.slice(0,showCount).map(it=>{
    const rsrv=it.rsrvType?' · '+it.rsrvType:'';
    const barCls=it.group==='은행'?'bank':'saving';
    return '<div class="fs-row">'+
      '<div class="fs-bar '+barCls+'"></div>'+
      '<div class="fs-info">'+
        '<div class="fs-co">'+it.group+' · '+it.company+'</div>'+
        '<div class="fs-name">'+it.product+'</div>'+
        '<div class="fs-meta">'+(it.term!=null?it.term+'개월':'--')+rsrv+'</div>'+
      '</div>'+
      '<div class="fs-rate">'+
        '<div class="max">'+(it.maxRate!=null?it.maxRate.toFixed(2)+'%':'--')+'</div>'+
        '<div class="base">기본 '+(it.baseRate!=null?it.baseRate.toFixed(2)+'%':'--')+'</div>'+
      '</div>'+
    '</div>';
  }).join('');
  let moreBtn='';
  if(capped.length>3){
    moreBtn=finSavingsExpanded
      ? '<button class="btn ghost sm" style="width:100%;margin-top:8px" data-stock-click="toggleFinSavingsExpand()">접기</button>'
      : '<button class="btn ghost sm" style="width:100%;margin-top:8px" data-stock-click="toggleFinSavingsExpand()">금리 Top3 외 '+(capped.length-3)+'개 자세히 보기</button>';
  }
  el.innerHTML=rowsHtml+moreBtn;
}
function toggleFinSavingsExpand(){
  finSavingsExpanded=!finSavingsExpanded;
  renderFinSavings();
}

function renderFinSavings(){
  const list=finSavingsType==='saving'?finSavingsData.saving:finSavingsData.deposit;
  renderFinSavingsTable('fin-savings-list', list);
  const typeBtns=document.querySelectorAll('#fin-savings-type button');
  typeBtns.forEach(b=>b.classList.toggle('on', b.dataset.t===finSavingsType));
  const groupBtns=document.querySelectorAll('#fin-savings-group button');
  groupBtns.forEach(b=>b.classList.toggle('on', b.dataset.g===finSavingsGroup));
}

function setFinSavingsGroup(g){
  finSavingsGroup=g;
  finSavingsExpanded=false;
  renderFinSavings();
}
function setFinSavingsType(t){
  finSavingsType=t;
  finSavingsExpanded=false;
  renderFinSavings();
}

/* ===================== 공모주 페이지 — 38.co.kr 실시간 연동 =====================
   Worker(/ipo-list)가 38.co.kr을 서버에서 긁어 종목별 기관경쟁률·의무보유확약·공모가 등을
   집계해 KV에 캐시해둔 결과를 그대로 받아, ipo.html의 기존 IPO_DATA(월별 하드코딩 객체)와
   동일한 스키마로 변환한다 — ipo.html의 ipoVerdict()·renderIpoList()는 수정 없이 재사용. */
function ipoDeriveMonth(item){
  const raw=item.listDate||item.subscDate||item.predictDate||'';
  // "2026.09.30"/"2026/10/01 ~ 10/02"처럼 연도가 포함된 형식을 먼저 시도(그렇지 않으면
  // "2026.09.30"의 "26.09"를 월=26으로 잘못 읽는 문제가 생긴다).
  let m=raw.match(/\d{4}[.\/](\d{1,2})[.\/]\d{1,2}/);
  if(m) return parseInt(m[1],10);
  // "09/28~10/02"·"10/12~10/13"처럼 연도 없이 월/일만 있는 형식(수요예측·공모청약 목록)
  m=raw.match(/(?:^|\D)(\d{1,2})[.\/]\d{1,2}/);
  return m?parseInt(m[1],10):null;
}
function ipoFormatOfferFinal(item){
  if(item.offerPriceFinal==null) return null;
  const finalNum=parseFloat(String(item.offerPriceFinal).replace(/[^\d.]/g,''));
  const band=(item.offerPriceBand||'').match(/([\d,]+)\s*~\s*([\d,]+)/);
  let suffix='';
  if(band && isFinite(finalNum)){
    const lo=parseFloat(band[1].replace(/,/g,'')), hi=parseFloat(band[2].replace(/,/g,''));
    if(finalNum>=hi) suffix=' (밴드 상단 확정)';
    else if(finalNum<=lo) suffix=' (밴드 하단 확정)';
    else suffix=' (밴드 내 확정)';
  }
  return item.offerPriceFinal.trim()+suffix;
}
/* "1741.48:1 (비례 3483:1)" → "1,741.48:1 (비례 3,483:1)" — 숫자에 천단위 구분을 넣어 읽기 쉽게 한다 */
function ipoFormatSubRatio(txt){
  if(!txt) return null;
  const t=String(txt).trim();
  if(!/\d/.test(t)) return null;
  return t.replace(/\d[\d,]*(?:\.\d+)?/g,m=>{
    const n=parseFloat(m.replace(/,/g,''));
    if(!isFinite(n)) return m;
    const dec=(m.split('.')[1]||'').length;
    return n.toLocaleString('ko-KR',{minimumFractionDigits:dec,maximumFractionDigits:dec});
  });
}
/* 단계(stage)를 날짜로 다시 계산한다 — Worker가 구버전이거나 캐시가 낡아도 청약예정·청약중·청약완료·상장완료가
   오늘(한국시간) 기준으로 정확히 구분되도록, 서버가 준 stage는 "참고"만 하고 날짜를 우선한다. */
function ipoDeriveStage(raw){
  const now=new Date(Date.now()+9*3600*1000);
  const yy=now.getUTCFullYear();
  const todayNum=yy*10000+(now.getUTCMonth()+1)*100+now.getUTCDate();
  let stage=raw.stage||null;
  const lm=String(raw.listDate||'').match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
  if(lm){
    const ln=(+lm[1])*10000+(+lm[2])*100+(+lm[3]);
    if(ln<=todayNum) return '신규상장';
    if(stage==='신규상장'||stage==='상장예정') stage='청약완료';
  }else if(stage==='신규상장' && !raw.listDate){
    return stage;
  }
  const sm=String(raw.subscDate||'').match(/(?:(\d{4})[\/.])?(\d{1,2})[\/.](\d{1,2})\s*~\s*(?:(\d{4})[\/.])?(\d{1,2})[\/.](\d{1,2})/);
  if(sm && stage!=='수요예측'){
    const y1=+(sm[1]||yy), y2=+(sm[4]||sm[1]||yy);
    const sN=y1*10000+(+sm[2])*100+(+sm[3]), eN=y2*10000+(+sm[5])*100+(+sm[6]);
    if(todayNum<sN) return '청약예정';
    if(todayNum<=eN) return '청약중';
    return '청약완료';
  }
  if(stage==='상장예정') return '청약완료';
  return stage;
}
function ipoBuildItem(raw){
  raw=Object.assign({},raw,{stage:ipoDeriveStage(raw)});
  const offerPriceFinal=ipoFormatOfferFinal(raw);
  // [버그 수정] 코스피/코스닥 "이전상장"(코넥스→코스닥, 코스닥→코스피 등)은 일반공모(청약) 절차
  // 자체가 없는 경우가 많아 기관경쟁률·청약경쟁률·수요예측일 등이 원래부터 존재하지 않는다.
  // 이걸 구분 안 하면 "데이터를 못 가져온 것"처럼(계속 '미정'/'수요예측 전') 보여 로딩 실패로
  // 오해하기 쉬웠다 — market 문구로 이전상장 여부를 판별해 안내 문구를 다르게 준다.
  const isTransfer=/이전상장/.test(raw.market||'');
  const stageNote=isTransfer?'일반공모 없음(이전상장)':raw.stage==='청약중'?'수요예측 결과 미집계(38.co.kr 반영 대기)':raw.stage==='수요예측'?'수요예측 진행중':(raw.stage==='상장예정'||raw.stage==='청약완료'||raw.stage==='청약예정')?'수요예측 결과 미집계':raw.stage==='신규상장'?'미집계':null;
  const descParts=[];
  if(raw.subRatioText) descParts.push('개인 청약경쟁률 '+raw.subRatioText);
  if(raw.totalShares) descParts.push('총공모주식수 '+raw.totalShares);
  if(raw.parValue) descParts.push('액면가 '+raw.parValue);
  if(isTransfer && !descParts.length) descParts.push('이전상장 종목은 일반공모 절차가 없어 수요예측·청약경쟁률 정보가 제공되지 않습니다');
  return {
    no: raw.no||null, // 38.co.kr 상세페이지 id — 동종업체 비교(/ipo-peer) 조회용
    name: raw.name,
    market: raw.market||(raw.isTransfer?'':'시장 미확인'),
    stage: raw.stage||null, // '수요예측'·'청약중'·'상장예정'·'신규상장(=상장완료)' — 카드에 진행 상태 배지를 표시하기 위해 전달
    isTransfer: isTransfer,
    stockCode: raw.stockCode||null,
    lockupSchedule: raw.lockupSchedule||null,
    predictPeriod: raw.predictPeriod||null, payDate: raw.payDate||null, refundDate: raw.refundDate||null,
    offerAmount: raw.offerAmount||null, allocInst: raw.allocInst||null, allocRetail: raw.allocRetail||null,
    subscDate: isTransfer ? '해당없음(이전상장)' : (raw.subscDate || (raw.stage==='신규상장'?'청약 종료':(raw.predictDate?('수요예측 '+raw.predictDate):'미정'))),
    subRatio: ipoFormatSubRatio(raw.subRatioText)||(raw.stage==='청약중'?'청약 종료 후 발표':raw.stage==='청약완료'?'집계 중':(raw.stage==='수요예측'||raw.stage==='청약예정')?'청약 전':null),
    listDate: raw.listDate||'미정',
    underwriter: raw.underwriter||'미정',
    offerPriceBand: raw.offerPriceBand||null,
    offerPriceFinal: offerPriceFinal,
    instRatio: raw.instRatio,
    instCount: raw.instRatio!=null ? (raw.instRatio.toLocaleString('ko-KR')+':1') : (stageNote||'수요예측 전'),
    topBandRatio: null,
    lockupRatio: raw.lockupRatio!=null ? raw.lockupRatio.toFixed(2)+'%' : null,
    floatRatio: raw.isSpac ? '해당없음(스팩)' : (raw.floatRatio!=null ? raw.floatRatio.toFixed(2)+'%' : null), // ipostock.co.kr 보강(유통가능주식÷공모후 발행주식)
    refundRight: null,
    desc: descParts.length?descParts.join(' · '):'상세 정보 준비 중',
    sourceUrl: raw.sourceUrl
  };
}
function buildIpoDataFromApi(items){
  const grouped={};
  (items||[]).forEach(raw=>{
    const m=ipoDeriveMonth(raw);
    if(!m) return;
    (grouped[m]=grouped[m]||[]).push(ipoBuildItem(raw));
  });
  return grouped;
}
async function loadIpoListLive(onCached,opts){
  if(!PROXY_BASE) return null;
  const LSK='mk_ipo_list_v1';
  /* 직전에 성공한 응답을 브라우저에 저장해 두었다가 먼저 보여준다(서버가 느려도 즉시 표시, 이후 최신 데이터로 교체). */
  try{
    const c=JSON.parse(localStorage.getItem(LSK)||'null');
    if(c&&c.items&&c.items.length&&typeof onCached==='function') onCached({updated:c.updated,grouped:buildIpoDataFromApi(c.items),cached:true});
  }catch(e){}
  const origin=PROXY_BASE.replace(/\?url=$/,'');
  const once=async(ms)=>{
    const r=await fetch(origin+'ipo-list'+(opts&&opts.force?'?refresh=1&_='+Date.now():''),{signal:AbortSignal.timeout?AbortSignal.timeout(ms):undefined});
    if(!r.ok) throw new Error('HTTP '+r.status);
    const j=await r.json();
    if(!j||!j.items||!j.items.length) throw new Error('empty');
    return j;
  };
  try{
    let j;
    /* 서버 캐시가 있으면 즉시 응답한다. 일반 조회는 30초, 강제 새로고침은 서버가 다시 집계하므로 90초까지 기다린다. */
    j=await once(opts&&opts.force?90000:30000);
    try{ localStorage.setItem(LSK,JSON.stringify({updated:j.updated,items:j.items})); }catch(e){}
    return { updated: j.updated, grouped: buildIpoDataFromApi(j.items) };
  }catch(e){ console.warn('공모주(38.co.kr) 연동 실패:', e); return null; }
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
  injectTechBadgeCss();
  tbody.innerHTML=FX_LIST.map(sym=>{
    const meta=FX_META[sym];
    const closes=fxData[sym];
    const linkTag='<a href="'+meta.url+'" target="_blank" rel="noopener" title="'+meta.name+' 발행 중앙은행 공식 사이트" style="margin-left:5px;text-decoration:none">🔗</a>';
    const finvizUrl='https://finviz.com/forex_charts.ashx?t='+meta.code+'USD';
    /* 통화명 앞 신호등(저평가 🟢·중립 🟡·고평가 🔴) + 뒤에 5일선·200일선·RSI 이모티콘 배지 */
    const sig=valuationSignal(closes);
    const sigTag=sig?'<span class="wl-sig" title="'+sig.tip.replace(/"/g,'&quot;')+'">'+sig.icon+'</span>':'';
    const badges=techBadgesHtml(closes);
    const nameCell='<td>'+sigTag+meta.flag+' <a href="'+finvizUrl+'" target="_blank" rel="noopener" style="color:inherit;font-weight:800;text-decoration:underline" title="Finviz에서 '+meta.code+' 상세 차트 보기">'+meta.name+'</a> <span class="mut">('+meta.code+'/KRW)</span>'+linkTag+
      (badges?'<span class="wl-ind">'+badges+'</span>':'')+'</td>';
    if(!closes || closes.length<2){
      return '<tr>'+nameCell+'<td class="mut" colspan="2">데이터 없음</td></tr>';
    }
    const last=closes[closes.length-1];
    const base=closes[Math.max(0,closes.length-1-n)];
    const chg=(last/base-1)*100;
    if(!isFinite(chg)){
      return '<tr>'+nameCell+'<td class="mut" colspan="2">계산 실패</td></tr>';
    }
    const dir=chg>=0?'up':'down';
    const decimals=last<50?2:(last<500?1:0);
    const priceStr='₩'+last.toLocaleString('ko-KR',{minimumFractionDigits:decimals,maximumFractionDigits:decimals});
    const sw={d:5,w:21,m:63,y:252}[p]||5;
    const spark=sparkSVG(closes.slice(-(sw+1)));
    return '<tr>'+nameCell+
      '<td class="num"><span class="fx-pc" style="display:inline-flex;align-items:center;gap:10px;justify-content:flex-end"><span style="display:inline-block;line-height:0">'+spark+'</span><span>'+priceStr+'</span></span></td>'+
      '<td class="num '+dir+'">'+(chg>=0?'+':'')+chg.toFixed(2)+'%</td></tr>';
  }).join('');
}

/* ===================== 전자공시(OpenDART) 연동 — 손익계산서 3년 시각화 =====================
   crtfc_key는 Worker가 서버 쪽에서 자동으로 붙여주므로 클라이언트 코드에는 없다.
   DART는 종목코드(005930)가 아니라 자체 corp_code(8자리)를 쓰는데, 이 매핑은 손으로
   찾아 넣지 않고 Worker의 /dart-corp 엔드포인트에 물어봐서 자동으로 받아온다(Worker가
   DART corpCode.xml 전체를 받아 캐시해두고 응답한다). 페이지에서 여러 종목을 한 번에
   조회하면 아래 캐시에 저장되어 같은 세션에서는 재요청하지 않는다. */
const dartCorpCodeCache={};
/* OpenDART 고유번호 목록(corpCode.xml)이 '시스템 점검'(status 800) 등으로 일시 중단되면 종목코드→corp_code 변환이 통째로 실패한다.
   그때를 대비해 주요 종목만 임시 대체표를 두되, 잘못 매칭되면 엉뚱한 회사 재무가 나오므로 DART 응답의 stock_code 로 반드시 검증한 뒤에만 쓴다. */
const DART_FALLBACK={'005930':'00126380','000660':'00164779','005380':'00164742','035420':'00266961','035720':'00258801','373220':'01515323','207940':'00877059','000270':'00106641','105560':'00688996'};
async function dartVerifyCorp(code,corp){
  try{
    const j=await getJSON('https://opendart.fss.or.kr/api/fnlttSinglAcnt.json?corp_code='+corp+'&bsns_year='+(new Date().getFullYear()-1)+'&reprt_code=11011');
    return !!(j&&j.status==='000'&&Array.isArray(j.list)&&j.list.length&&j.list[0].stock_code===code);
  }catch(e){ return false; }
}
const dartCorpInflight=new Map();
async function resolveDartCorpCodes(stockCodes){
  /* 같은 종목코드를 동시에 여러 곳에서 요청해도 Worker 호출은 한 번만 하도록 진행 중인 요청을 공유한다 */
  const pend=[...new Set(stockCodes.map(c=>dartCorpInflight.get(c)).filter(Boolean))];
  if(pend.length) await Promise.all(pend);
  const need=stockCodes.filter(c=>!(c in dartCorpCodeCache));
  if(need.length){
    const pr=resolveDartCorpCodesRaw(need);
    need.forEach(c=>dartCorpInflight.set(c,pr));
    try{ await pr; }finally{ need.forEach(c=>dartCorpInflight.delete(c)); }
  }
  return stockCodes.map(c=>dartCorpCodeCache[c]||null);
}
async function resolveDartCorpCodesRaw(stockCodes){
  const need=stockCodes.filter(c=>!(c in dartCorpCodeCache));
  if(need.length && PROXY_BASE){
    const origin=PROXY_BASE.replace(/\?url=$/,'');
    let j=null;
    for(let t=0;t<2&&!j;t++){
      try{
        const r=await fetch(origin+'dart-corp?codes='+need.join(','),{signal:AbortSignal.timeout?AbortSignal.timeout(25000):undefined});
        const x=r.ok?await r.json():null; if(x&&!x.error) j=x; else if(x&&x.error) console.warn('DART corp_code 서버 응답:',x.error);
      }catch(e){ console.warn('DART corp_code 해석 실패:', e); }
    }
    if(j) need.forEach(c=>{ dartCorpCodeCache[c]=j[c]||null; });
    else await Promise.all(need.map(async c=>{ const f=DART_FALLBACK[c]; if(f&&await dartVerifyCorp(c,f)) dartCorpCodeCache[c]=f; }));
  }
  return stockCodes.map(c=>dartCorpCodeCache[c]||null);
}

/* 공모주(IPO) 목록·동종업체는 아직(또는 처음부터) 6자리 종목코드를 갖고 있지 않아(38.co.kr
   데이터에 종목코드가 없음) 회사명으로 corp_code/종목코드를 찾는다. Worker가 각 이름에 대해
   {corpCode, stockCode} 쌍을 돌려준다(stockCode는 이미 상장된 동종업체 주가 조회용). */
const dartCorpCodeByNameCache={};
async function resolveDartByName(names){
  const need=names.filter(n=>!(n in dartCorpCodeByNameCache));
  if(need.length && PROXY_BASE){
    try{
      const origin=PROXY_BASE.replace(/\?url=$/,'');
      const r=await fetch(origin+'dart-corp?names='+need.map(encodeURIComponent).join(','),{signal:AbortSignal.timeout?AbortSignal.timeout(25000):undefined});
      if(r.ok){
        const j=await r.json();
        const byName=j.byName||{};
        need.forEach(n=>{ dartCorpCodeByNameCache[n]=byName[n]||null; });
      }
    }catch(e){ console.warn('DART corp_code(회사명) 해석 실패:', e); }
  }
  return names.map(n=>dartCorpCodeByNameCache[n]||null); // 각 항목: {corpCode, stockCode} | null
}
async function resolveDartCorpCodesByName(names){
  const rows=await resolveDartByName(names);
  return rows.map(r=>r?r.corpCode:null);
}

/* bsns_year의 사업보고서(reprt_code=11011, 사업보고서) 단일회사 전체 재무제표 중
   손익계산서 핵심 항목(매출액·영업이익·당기순이익)만 추출 */
async function dartFinancialYear(corpCode, year){
  /* 연간 사업보고서 수치는 거의 안 바뀌므로 브라우저에 24시간 저장해 두고 재사용한다(Worker 호출 수 절감) */
  const CK='mk_dfy_'+corpCode+'_'+year;
  try{ const c=JSON.parse(localStorage.getItem(CK)||'null'); if(c&&c.t&&Date.now()-c.t<864e5&&c.v) return c.v; }catch(e){}
  const v=await dartFinancialYearRaw(corpCode,year);
  if(v){ try{ localStorage.setItem(CK,JSON.stringify({t:Date.now(),v:v})); }catch(e){} }
  return v;
}
async function dartFinancialYearRaw(corpCode, year){
  const url='https://opendart.fss.or.kr/api/fnlttSinglAcnt.json?corp_code='+corpCode+'&bsns_year='+year+'&reprt_code=11011';
  try{
    const j=await getJSON(url);
    if(!j || j.status!=='000' || !Array.isArray(j.list)){
      console.warn('DART 재무제표 실패('+corpCode+','+year+'):', j&&j.message);
      return null;
    }
    // [버그 수정] 적자 기업은 계정명이 "당기순이익(손실)"·"영업손실" 등으로 오거나 금액이 "-1,234"/"△1,234"
    // 형태라 예전 정확일치(===) + 단순 숫자변환이 실패해 null/NaN → 막대가 사라지거나 양수처럼 그려졌다.
    // 계정명 후보를 여러 개 허용하고, 괄호음수·△·▲·"-" 표기를 모두 음수로 해석한다.
    const parseAmt=str=>{
      if(str==null) return null;
      let t=String(str).trim();
      if(!t||t==='-') return null;
      let neg=false;
      if(/^[\(△▲-]/.test(t)||/\)$/.test(t)) neg=true;
      t=t.replace(/[^0-9.]/g,'');
      if(!t) return null;
      const n=parseFloat(t);
      return isFinite(n)?(neg?-n:n):null;
    };
    const pick=names=>{
      const ok=r=>names.some(nm=>r.account_nm===nm || (r.account_nm||'').replace(/\s/g,'').indexOf(nm)===0);
      const row=j.list.find(r=>ok(r) && r.fs_div==='CFS' && parseAmt(r.thstrm_amount)!=null) // 연결재무제표 우선
             || j.list.find(r=>ok(r) && parseAmt(r.thstrm_amount)!=null); // 없으면 개별재무제표
      return row?parseAmt(row.thstrm_amount):null;
    };
    return { year, revenue:pick(['매출액','수익(매출액)','영업수익']), opProfit:pick(['영업이익','영업손실','영업손익']), netProfit:pick(['당기순이익','당기순손실','당기순손익']),
      assets:pick(['자산총계']), debt:pick(['부채총계']), equity:pick(['자본총계']) };
  }catch(e){ console.warn('DART 호출 실패('+corpCode+','+year+'):', e); return null; }
}

/* 최근 3개 사업연도 손익계산서를 한 번에(전년도까지 확정 발표된 연도 기준) */
async function dartFinancials3Y(stockCode){
  /* 1순위: Worker /dart-fin 한 번 호출(서버에서 5개 연도를 모아 캐시). 실패하면 아래 기존 방식(브라우저가 연도별로 호출)으로 대체 */
  try{
    if(PROXY_BASE){
      const origin=PROXY_BASE.replace(/\?url=$/,'');
      const r=await fetch(origin+'dart-fin?code='+encodeURIComponent(stockCode),{signal:AbortSignal.timeout?AbortSignal.timeout(30000):undefined});
      const j=await r.json().catch(function(){return null;});
      if(j&&Array.isArray(j.fin)&&j.fin.length){ window.__dartDown=false; return j.fin; }
      if(j&&/^DART_DOWN:/.test(j.error||'')){ window.__dartDown=true; return null; }
    }
  }catch(e){ console.warn('dart-fin 실패, 기존 방식으로 대체:',e); }
  const [corpCode]=await resolveDartCorpCodes([stockCode]);
  if(!corpCode) return null;
  const thisYear=new Date().getFullYear();
  const years=[thisYear-5, thisYear-4, thisYear-3, thisYear-2, thisYear-1]; // 최근 확정 5개년(올해는 아직 사업보고서 미제출)
  const results=await Promise.all(years.map(y=>dartFinancialYear(corpCode, y)));
  const valid=results.filter(Boolean);
  return valid.length?valid:null;
}


/* 국내 종목 증권사 컨센서스(올해 예상 매출·영업이익·순이익) — Worker /kr-consensus (네이버 증권). 원 단위로 환산해 반환 */
async function krConsensusEst(stockCode){
  if(!PROXY_BASE) return null;
  try{
    const origin=PROXY_BASE.replace(/\?url=$/,'');
    const r=await fetch(origin+'kr-consensus?code='+encodeURIComponent(stockCode),{signal:AbortSignal.timeout?AbortSignal.timeout(12000):undefined});
    if(!r.ok) return null;
    const j=await r.json();
    const est=(j.years||[]).filter(y=>y.est);
    if(!est.length) return null;
    const act=(j.years||[]).filter(y=>!y.est);
    const E=1e8;
    const conv=y=>({year:String(y.key).slice(0,4)+'E', est:true, revenue:y.revenue!=null?y.revenue*E:null, opProfit:y.opProfit!=null?y.opProfit*E:null, netProfit:y.netProfit!=null?y.netProfit*E:null});
    return {est:est.map(conv), lastAct:act.length?act[act.length-1]:null};
  }catch(e){ console.warn('컨센서스 조회 실패:',e); return null; }
}

/* 성장성지표(전년동기대비 증가율) — DART가 매출액증가율(YoY)·영업이익증가율(YoY)을
   fnlttSinglIndx(idx_cl_code=M230000, 성장성지표)로 직접 제공해 3년 손익 데이터로 직접
   계산하지 않고 이 값을 그대로 사용한다(DART 자체 산식과 100% 일치시키기 위함). */
async function dartGrowthIndicators(corpCode, year){
  const url='https://opendart.fss.or.kr/api/fnlttSinglIndx.json?corp_code='+corpCode+'&bsns_year='+year+'&reprt_code=11011&idx_cl_code=M230000';
  try{
    const j=await getJSON(url);
    if(!j || j.status!=='000' || !Array.isArray(j.list)) return null;
    const pick=nm=>{ const row=j.list.find(r=>r.idx_nm===nm); return (row && row.idx_val!=null && row.idx_val!=='')?parseFloat(row.idx_val):null; };
    return { revenueGrowth:pick('매출액증가율(YoY)'), opProfitGrowth:pick('영업이익증가율(YoY)') };
  }catch(e){ console.warn('DART 성장성지표 실패('+corpCode+','+year+'):', e); return null; }
}

/* 주당순이익(EPS) — alotMatter.json(배당에 관한 사항)의 "(연결)주당순이익(원)" 항목을 우선
   사용하고, 연결 재무제표가 없는(비지주) 종목은 개별 기준 "주당순이익(원)"으로 대체한다. */
async function dartEps(corpCode, year){
  const url='https://opendart.fss.or.kr/api/alotMatter.json?corp_code='+corpCode+'&bsns_year='+year+'&reprt_code=11011';
  try{
    const j=await getJSON(url);
    if(!j || j.status!=='000' || !Array.isArray(j.list)) return null;
    const row=j.list.find(r=>r.se && r.se.indexOf('주당순이익')>=0 && r.se.indexOf('(연결)')>=0)
           || j.list.find(r=>r.se && r.se.indexOf('주당순이익')>=0);
    if(!row || !row.thstrm) return null;
    const v=parseFloat(String(row.thstrm).replace(/,/g,''));
    return isNaN(v)?null:v;
  }catch(e){ console.warn('DART EPS 조회 실패('+corpCode+','+year+'):', e); return null; }
}

/* 배당정보 — alotMatter: 현금배당성향(%), 주당 현금배당금(원, 보통주), 현금배당수익률(%).
   사업연도 Y 조회 시 당기·전기·전전기가 오므로 Y와 Y-3을 조회하면 Y-5~Y 6개년이 모여 5년 성장률을 계산할 수 있다. */
async function dartDividend(corpCode, year){
  const get=async y=>{
    try{
      const j=await getJSON('https://opendart.fss.or.kr/api/alotMatter.json?corp_code='+corpCode+'&bsns_year='+y+'&reprt_code=11011');
      return (j&&j.status==='000'&&Array.isArray(j.list))?j.list:null;
    }catch(e){ return null; }
  };
  const num=v=>{ if(v==null) return null; const x=parseFloat(String(v).replace(/,/g,'')); return isNaN(x)?null:x; };
  const [l0,l3]=await Promise.all([get(year),get(year-3)]);
  if(!l0) return null;
  const find=(list,kw,pref)=>{ if(!list) return null;
    const rows=list.filter(r=>r.se&&r.se.indexOf(kw)>=0);
    return rows.find(r=>pref&&r.stock_knd&&r.stock_knd.indexOf(pref)>=0)||rows.find(r=>r.se.indexOf('(연결)')>=0)||rows[0]||null; };
  const dps0=find(l0,'주당 현금배당금','보통'), pay0=find(l0,'현금배당성향'), yld0=find(l0,'현금배당수익률','보통');
  const dps3=find(l3,'주당 현금배당금','보통');
  const byYear={};
  if(dps0){ byYear[year]=num(dps0.thstrm); byYear[year-1]=num(dps0.frmtrm); byYear[year-2]=num(dps0.lwfr); }
  if(dps3){ byYear[year-3]=num(dps3.thstrm); byYear[year-4]=num(dps3.frmtrm); byYear[year-5]=num(dps3.lwfr); }
  const cur=byYear[year];
  let growth5=null, gy=0;
  for(const k of [5,4,3,2,1]){ const b=byYear[year-k]; if(cur!=null&&b>0){ growth5=cur/b-1; gy=k; break; } }
  const payout=pay0?num(pay0.thstrm):null, yld=yld0?num(yld0.thstrm):null;
  if(cur==null&&payout==null&&yld==null) return null;
  return { year, dps:cur, payout:payout==null?null:payout/100, yield:yld==null?null:yld/100, growth5, growthYears:gy, hist:byYear };
}

/* 시가총액 TOP10 카드(KRCAP_CAP_DATA/KRKQ_CAP_DATA)는 회사명→시가총액(조원)만 갖고 있어,
   PSR(주가매출비율=시가총액/매출액) 계산에 종목명으로 역매칭한다. */
function findKrMarketCapByName(name){
  const all=KRCAP_CAP_DATA.concat(KRKQ_CAP_DATA, KRCAP_MORE.map(r=>({label:r[2],cap:r[3]})), KRKQ_MORE.map(r=>({label:r[2],cap:r[3]})));
  const row=all.find(r=>r.label===name);
  return row?row.cap:null; // 단위: 조원
}

/* 최근 3년 손익 + 최신연도 성장률·EPS·PSR을 한 번에 모아 반환.
   stockName을 넘기면 PSR도 함께 계산(시가총액 스냅샷 매칭용), 없으면 PSR은 생략. */
async function dartFinancialsWithRatios(stockCode, stockName){
  const [corpCode]=await resolveDartCorpCodes([stockCode]);
  const fin3y=await dartFinancials3Y(stockCode);
  if(!corpCode || !fin3y || !fin3y.length) return { fin3y, growth:null, eps:null, psr:null, dividend:null };
  const latestYear=fin3y[fin3y.length-1].year;
  const [growth, eps, dividend]=await Promise.all([ dartGrowthIndicators(corpCode, latestYear), dartEps(corpCode, latestYear), dartDividend(corpCode, latestYear) ]);
  let psr=null;
  if(stockName){
    const capJo=findKrMarketCapByName(stockName); // 조원
    const revenue=fin3y[fin3y.length-1].revenue; // 원
    if(capJo!=null && revenue) psr=(capJo*1e12)/revenue;
  }
  return { fin3y, growth, eps, psr, dividend };
}

/* 공모주(IPO) 상장종목용 — 종목코드가 아직 없어 회사명으로 corp_code를 찾는다.
   막 상장한 종목은 아직 사업보고서(연간)를 못 냈을 수 있어 최근 3년이 다 안 채워질 수 있다.
   PSR은 상장 직후 실제 유통주식수/시가총액을 신뢰성 있게 구하기 어려워 제공하지 않는다
   (동종업체 비교 카드에서 시가총액 대비 밸류에이션은 별도로 안내). */
/* 38.co.kr "5.요약재무제표"(증권신고서 발췌) 대체 자료 — DART 사업보고서가 아직 없는 신규 상장 종목용 */
async function ipoSummaryFinFallback(no){
  if(!PROXY_BASE||!no) return null;
  try{
    const origin=PROXY_BASE.replace(/\?url=$/,'');
    const r=await fetch(origin+'ipo-fin?no='+encodeURIComponent(no),{signal:AbortSignal.timeout?AbortSignal.timeout(15000):undefined});
    if(!r.ok) return null;
    const j=await r.json();
    const per=j&&j.fin&&j.fin.periods;
    if(!per||!per.length) return null;
    const fin3y=per.slice().reverse().map(p=>({year:p.label,revenue:p.revenue,opProfit:p.opProfit,netProfit:p.netProfit}))
      .filter(p=>p.revenue!=null||p.opProfit!=null||p.netProfit!=null);
    if(!fin3y.length) return null;
    // 성장률: 연간(라벨이 4자리 연도뿐인) 데이터 중 최근 두 해로 계산
    const full=fin3y.filter(p=>/^\d{4}$/.test(String(p.year)));
    let growth=null;
    if(full.length>=2){
      const a=full[full.length-2], b=full[full.length-1];
      const g=(x,y)=>(x!=null&&y!=null&&x>0)?(y/x-1)*100:null;
      growth={revenueGrowth:g(a.revenue,b.revenue), opProfitGrowth:g(a.opProfit,b.opProfit)};
    }
    return {fin3y, growth, eps:null, psr:null, notFound:false, source:'38'};
  }catch(e){ console.warn('요약재무제표 대체 조회 실패:',e); return null; }
}
async function dartFinancialsForIpoCompany(companyName, no){
  const [corpCode]=await resolveDartCorpCodesByName([companyName]);
  if(!corpCode){
    const fb=await ipoSummaryFinFallback(no);
    return fb||{ fin3y:null, growth:null, eps:null, psr:null, notFound:true };
  }
  const thisYear=new Date().getFullYear();
  const years=[thisYear-2, thisYear-1, thisYear];
  const results=await Promise.all(years.map(y=>dartFinancialYear(corpCode, y)));
  const fin3y=results.filter(r=>r && (r.revenue!=null||r.opProfit!=null||r.netProfit!=null));
  if(!fin3y.length){
    const fb=await ipoSummaryFinFallback(no);
    return fb||{ fin3y:null, growth:null, eps:null, psr:null, notFound:false };
  }
  const latestYear=fin3y[fin3y.length-1].year;
  const [growth, eps, dividend]=await Promise.all([ dartGrowthIndicators(corpCode, latestYear), dartEps(corpCode, latestYear), dartDividend(corpCode, latestYear) ]);
  return { fin3y, growth, eps, psr:null, notFound:false };
}

/* ===================== 공모주 상세 — 동종업체와의 재무정보 비교 =====================
   Worker(/ipo-peer?no=)가 38.co.kr 상세페이지의 "6.동종업체와의 재무정보 비교" 표(증권신고서
   발췌)를 그대로 파싱해 돌려준다. 종목별로 KV에 24시간 캐시돼 있어 매번 새로 파싱하지 않는다. */
async function loadIpoPeerComparison(no){
  if(!PROXY_BASE || !no) return null;
  try{
    const origin=PROXY_BASE.replace(/\?url=$/,'');
    const r=await fetch(origin+'ipo-peer?no='+encodeURIComponent(no),{signal:AbortSignal.timeout?AbortSignal.timeout(15000):undefined});
    if(!r.ok) return null;
    const j=await r.json();
    return j&&j.peer?j.peer:null;
  }catch(e){ console.warn('IPO 동종업체 비교 로딩 실패:', e); return null; }
}
/* 표의 값 단위는 38.co.kr 증권신고서 발췌 표를 그대로 따르며 대개 천원 단위다("(단위: 천원)"
   문구가 basis 위에 있으나 파서가 별도 필드로 넘기지 않아, 값 크기로 억원 환산 여부를 짐작하지
   않고 원안 그대로 "천원" 단위 표기를 유지한다 — 오해를 막기 위해 표 상단에 명시). */
function renderIpoPeerTable(peer){
  if(!peer || !peer.rows || !peer.rows.length) return '<p class="mut" style="font-size:12.5px">동종업체 비교 자료를 찾지 못했습니다(증권신고서에 해당 항목이 없거나 아직 미제출, 스팩은 해당 없음).</p>';
  const unit=peer.unit||'천원';
  const toEok=v=>v==null?null:(unit==='백만원'?v/100:unit==='천원'?v/100000:unit==='원'?v/1e8:v); // 억원 환산
  const find=re=>peer.rows.find(r=>re.test(r.label.replace(/[\[\]\s]/g,'')) && !/지배/.test(r.label));
  const pick=(re)=>{ const r=find(re); return r?r.values.map(toEok):null; };
  const rev=pick(/^매출액/), op=pick(/^영업이익/), np=pick(/^당기순이익/), asset=pick(/^자산총계/), debt=pick(/^부채총계/), eq=pick(/^자본총계/);
  const ratio=(a,b)=>(a&&b)?a.map((x,i)=>(x!=null&&b[i])?x/b[i]*100:null):null;
  const metrics=[
    {t:'매출액',v:rev,u:'억원'},{t:'영업이익',v:op,u:'억원'},{t:'당기순이익',v:np,u:'억원'},
    {t:'영업이익률',v:ratio(op,rev),u:'%'},{t:'순이익률',v:ratio(np,rev),u:'%'},
    {t:'부채비율',v:ratio(debt,eq),u:'%',low:true},{t:'자산총계',v:asset,u:'억원'}
  ].filter(m=>m.v&&m.v.some(x=>x!=null));
  const names=peer.companies;
  const fmtV=(x,u)=>x==null?'—':(u==='%'?x.toFixed(1)+'%':(Math.abs(x)>=10000?(x/10000).toFixed(2)+'조':Math.round(x).toLocaleString('ko-KR')+'억'));
  const fmt=v=>v==null?'—':v.toLocaleString('ko-KR');
  // 통합 대시보드 표: 행=회사(★공모기업 + 동종업체), 열=재무 항목 + 주가(1년 수익률·이평·RSI). 열별 1위 하이라이트
  const best=metrics.map(m=>{
    let bi=-1, bv=null;
    m.v.forEach((x,i)=>{ if(x==null) return; if(bv==null||(m.low?x<bv:x>bv)){ bv=x; bi=i; } });
    return bi;
  });
  const myRank=metrics.map(m=>{
    const arr=m.v.map((x,i)=>({x,i})).filter(o=>o.x!=null).sort((a,b)=>m.low?a.x-b.x:b.x-a.x);
    const r=arr.findIndex(o=>o.i===0); return r<0?null:{r:r+1,n:arr.length};
  });
  const wins=myRank.filter(o=>o&&o.r===1).length, cnt=myRank.filter(Boolean).length;
  const mx=metrics.map(m=>Math.max.apply(null,m.v.filter(x=>x!=null&&x>0).concat(0.0001)));
  const th=m=>'<th style="text-align:right;white-space:nowrap;font-size:12px;padding:8px 10px">'+m.t+(m.u==='%'?'':'<br><span style="font-weight:400;font-size:10.5px;color:var(--tx2)">억원</span>')+(m.low?'<br><span style="font-weight:400;font-size:10.5px;color:var(--tx2)">낮을수록↑</span>':'')+'</th>';
  const stick='position:sticky;left:0;background:var(--panel);z-index:1;';
  const head='<tr><th style="text-align:left;'+stick+'font-size:12px;padding:8px 10px">회사</th>'+metrics.map(th).join('')+
    '<th style="text-align:right;white-space:nowrap;font-size:12px;padding:8px 10px">1년 수익률<br><span style="font-weight:400;font-size:10.5px;color:var(--tx2)">주가</span></th>'+
    '<th style="text-align:left;white-space:nowrap;font-size:12px;padding:8px 10px">5·200일선 · RSI<br><span style="font-weight:400;font-size:10.5px;color:var(--tx2)">기술지표</span></th></tr>';
  const rowsHtml=names.map((nm,i)=>{
    const me=(i===0);
    const label=(me?'★ ':'')+nm.replace(/^동사.*/,'공모기업');
    const cells=metrics.map((m,mi)=>{
      const x=m.v[i], neg=x!=null&&x<0, isBest=best[mi]===i&&m.v.filter(v=>v!=null).length>1;
      return '<td style="text-align:right;white-space:nowrap;padding:8px 10px;font-weight:'+(isBest||me?800:500)+';color:'+(neg?'var(--down)':'var(--tx)')+';'+((x!=null&&x>0)?'background:linear-gradient(90deg,'+(isBest?'rgba(0,117,74,.28)':'rgba(0,117,74,.11)')+' '+Math.max(4,x/mx[mi]*100).toFixed(0)+'%,transparent 0);':'')+'">'+fmtV(x,m.u)+(isBest?' <span title="비교 대상 중 1위" style="font-size:10px">🏆</span>':'')+'</td>';
    }).join('');
    const pxCells=me
      ? '<td style="text-align:right;padding:8px 10px" class="mut">—</td><td style="padding:8px 10px" class="mut">미상장/신규</td>'
      : '<td data-peerpx="'+nm.replace(/"/g,'')+'" data-col="ret" style="text-align:right;white-space:nowrap;padding:8px 10px" class="mut">…</td><td data-peerpx="'+nm.replace(/"/g,'')+'" data-col="tech" style="white-space:nowrap;padding:8px 10px" class="mut">…</td>';
    return '<tr style="'+(me?'background:rgba(0,117,74,.07);':'')+'border-top:1px solid var(--line)"><td style="'+stick+(me?'background:var(--panel2);':'')+'font-weight:'+(me?900:600)+';color:'+(me?'var(--accent)':'var(--tx)')+';white-space:nowrap;padding:8px 10px;font-size:12.5px">'+label+'</td>'+cells+pxCells+'</tr>';
  }).join('');
  const rankStrip='<div class="ipo-rk">'+metrics.map((m,mi)=>{
    const r=myRank[mi]; if(!r) return '';
    return '<div class="'+(r.r===1?'g1':r.r<=Math.ceil(r.n/2)?'g2':'g3')+'"><small>'+m.t+'</small><b>'+r.r+'<em>/'+r.n+'위</em></b></div>';
  }).join('')+'</div>';
  const rawHead='<tr><th>구분</th>'+names.map(c=>'<th style="text-align:right">'+c+'</th>').join('')+'</tr>';
  const rawBody=peer.rows.map(r=>'<tr><td>'+r.label.replace(/[\[\]]/g,'')+'</td>'+r.values.map(v=>'<td style="text-align:right">'+fmt(v)+'</td>').join('')+'</tr>').join('');
  return '<div class="ipo-fp"><div class="hd"><b>🏢 동종업체 재무비교</b><span>★=공모기업 · 🏆=열별 1위 · 억원 환산 · 출처 증권신고서(38.co.kr)'+(cnt?' · <em>1위 '+wins+'/'+cnt+'개 항목</em>':'')+'</span></div><div class="bd">'+
    rankStrip+
    '<div class="scroll ipo-pt"><table class="ipo-pt-t"><thead>'+head+'</thead><tbody>'+rowsHtml+'</tbody></table></div>'+
    '<details class="ipo-raw"><summary>원본 표 보기('+unit+')</summary><div class="scroll"><table><thead>'+rawHead+'</thead><tbody>'+rawBody+'</tbody></table></div></details></div></div>';
}

/* 동종업체(피어) 주가 정보 시각화 — 회사명으로 종목코드를 찾아(DART corp_code 맵의 stockCode)
   상대수익률(rebase 100) 차트를 그린다. 코스피/코스닥 구분을 모르므로 .KS를 먼저 시도하고
   실패하면 .KQ로 재시도한다. "동사"(공모기업 본인)는 아직 미상장이라 제외한다. */
async function tryKrTicker(stockCode){
  let r=await yCloseWithDates(stockCode+'.KS','1y');
  if(r && r.closes.some(v=>v!=null)) return {ticker:stockCode+'.KS', dates:r.dates, closes:r.closes};
  r=await yCloseWithDates(stockCode+'.KQ','1y');
  if(r && r.closes.some(v=>v!=null)) return {ticker:stockCode+'.KQ', dates:r.dates, closes:r.closes};
  return null;
}
/* listDateStr: 공모기업(동사) 본인의 상장일(item.listDate, ipo.html에서 전달) — 동사는 아직
   신규상장이라 상대수익률 계열에는 없지만(또는 상장했어도 1년치 데이터가 짧아 비교가 무의미),
   "이 날짜를 기준으로 동종업체들이 어떻게 움직였는지" 보여주기 위해 차트에 기준선으로 표시한다. */
function peerPxDone(el){ try{ el.parentNode.querySelectorAll('[data-peerpx]').forEach(td=>{ if(td.textContent==='…'){ td.className='mut'; td.textContent='—'; } }); }catch(e){} }
async function renderIpoPeerPriceChart(elId, peer, listDateStr){
  const el=document.getElementById(elId);
  if(!el) return;
  if(!peer || !peer.companies || peer.companies.length<2){ el.innerHTML=''; return; }
  const peerNames=peer.companies.slice(1); // 첫 번째는 "동사"(공모기업 본인) — 미상장이라 제외
  el.innerHTML='<p class="mut" style="font-size:12px">동종업체 주가를 불러오는 중…</p>';
  try{
    const resolved=await resolveDartByName(peerNames);
    const palette=['var(--accent)','var(--up)','var(--down)','var(--gold)','#7c3aed'];
    const series=[]; const pxByName={};
    let masterDates=null; // 기준선 위치 계산용 — 가장 먼저 확보된 종목의 거래일 캘린더를 그대로 쓴다
    for(let k=0;k<peerNames.length;k++){
      const info=resolved[k];
      if(!info || !info.stockCode) continue;
      const got=await tryKrTicker(info.stockCode);
      if(got){
        series.push({label:peerNames[k], values:rebase100(got.closes), color:palette[series.length%palette.length], width:2});
        pxByName[peerNames[k]]=got.closes.filter(v=>v!=null);
        if(!masterDates) masterDates=got.dates;
      }
    }
    try{
      const box=el.parentNode;
      Object.keys(pxByName).forEach(nm=>{
        const cl=pxByName[nm], ret=(cl[cl.length-1]/cl[0]-1)*100, sig=valuationSignal(cl,15);
        box.querySelectorAll('[data-peerpx="'+nm.replace(/"/g,'')+'"]').forEach(td=>{
          if(td.dataset.col==='ret'){ td.className=''; td.innerHTML='<b style="color:'+(ret>=0?'var(--up)':'var(--down)')+'">'+(ret>=0?'+':'')+ret.toFixed(1)+'%</b>'; }
          else { td.className=''; injectTechBadgeCss(); td.innerHTML=(sig?'<span class="wl-sig" title="'+sig.tip.replace(/"/g,'&quot;')+'">'+sig.icon+'</span>':'')+'<span class="wl-ind" style="margin-left:2px">'+techBadgesHtml(cl,15)+'</span>'; }
        });
      });
    }catch(e){ console.warn('동종업체 표 주가 채우기 실패',e); }
    peerPxDone(el);
    if(!series.length){ el.innerHTML='<p class="mut" style="font-size:12px">동종업체 주가 데이터를 찾지 못했습니다(비상장이거나 종목코드 매칭 실패).</p>'; return; }
    // 상장일을 거래일 캘린더에서 찾아(당일이 휴장이면 그 이후 첫 거래일로) 기준선 인덱스를 구한다.
    // 조회 기간(최근 1년) 밖의 날짜(너무 과거이거나 아직 상장 전)면 그래프에 표시할 위치가
    // 없으므로 기준선을 그리지 않는다.
    let vLine=null;
    const listDate=parseKrDate(listDateStr);
    if(listDate && masterDates && masterDates.length){
      const listIso=listDate.toISOString().slice(0,10);
      if(listIso>=masterDates[0] && listIso<=masterDates[masterDates.length-1]){
        const idx=masterDates.findIndex(d=>d>=listIso);
        if(idx>=0) vLine={i:idx, label:'상장일('+listDate.toLocaleDateString('ko-KR')+')', color:'var(--gold)'};
      }
    }
    el.innerHTML='<div class="mut" style="font-size:11px;margin-bottom:6px">최근 1년 상대수익률(첫날=100) · 동종업체(이미 상장된 회사)만 표시'+(vLine?' · 세로 점선은 공모기업 상장일':'')+'</div>'+
      miniLineChart(series,{h:180,padL:40,padR:8,padTop:14,padBottom:10,axis:true,axisFmt:v=>(v-100>=0?'+':'')+(v-100).toFixed(0)+'%',vLine});
  }catch(e){
    console.warn('동종업체 주가 로딩 실패:', e);
    peerPxDone(el);
    el.innerHTML='<p class="mut" style="font-size:12px">동종업체 주가를 가져오지 못했습니다.</p>';
  }
}

/* 손익계산서 3년 시각화 — 연도별 묶음 세로막대(매출액·영업이익·당기순이익). 적자(음수)는 0선 아래로
   내려가고 "적자" 표시가 붙으며, 세로축(금액)·가로축(연도) 범례와 3년 변화 요약표를 함께 그린다.
   data: [{year, revenue, opProfit, netProfit}] (원 단위) */
const FIN_METRICS=[['매출액','revenue','#3d9dff'],['영업이익','opProfit','#f59e0b'],['당기순이익','netProfit','#16a34a']];
function finNiceStep(x){
  const mag=Math.pow(10,Math.floor(Math.log10(x||1)));
  for(const c of [1,2,2.5,5,10]){ if(c*mag>=x) return c*mag; }
  return 10*mag;
}
function finChange(first, last){ // 3년 변화 라벨 {txt,color}
  if(first==null||last==null) return {txt:'—',color:'var(--tx2)'};
  if(first>0 && last>0){ const p=(last-first)/first*100; return {txt:(p>=0?'+':'')+p.toFixed(0)+'%', color:p>=0?'var(--up)':'var(--down)'}; }
  if(first<=0 && last>0) return {txt:'흑자전환', color:'var(--up)'};
  if(first>0 && last<=0) return {txt:'적자전환', color:'var(--down)'};
  return last>first?{txt:'적자 축소',color:'var(--tx2)'}:{txt:'적자 확대',color:'var(--down)'};
}
/* 한 묶음의 지표(metrics)를 연도별 세로막대로 그린 SVG. 매출액은 이익보다 훨씬 커서 한 축에 같이 그리면
   영업이익·순이익(특히 적자)이 점처럼 보이므로, 아래 renderFinancialsChart에서 매출 차트와 이익 차트를
   각자의 세로축으로 따로 그린다. */
function finSvg(data, metrics, H){
  const eok=v=>v==null?null:v/100000000; // 원 → 억원
  const vals=[];
  data.forEach(d=>metrics.forEach(([,k])=>{ const e=eok(d[k]); if(e!=null&&isFinite(e)) vals.push(e); }));
  if(!vals.length) return '';
  const hi=Math.max(0,...vals), lo=Math.min(0,...vals);
  const step=finNiceStep((hi-lo)/4||1);
  const yMax=Math.ceil(hi/step)*step, yMin=Math.floor(lo/step)*step;
  const WIDE=(typeof window!=='undefined'&&window.innerWidth>=1100), W=WIDE?640:360,padL=WIDE?72:60,padR=8,padT=metrics.length>1?24:16,padB=26;
  const yOf=v=>padT+(yMax-v)/((yMax-yMin)||1)*(H-padT-padB);
  const y0=yOf(0);
  let svg='<svg viewBox="0 0 '+W+' '+H+'" style="width:100%;height:auto;display:block">';
  for(let t=yMin;t<=yMax+step/2;t+=step){
    const y=yOf(t);
    svg+='<line x1="'+padL+'" y1="'+y.toFixed(1)+'" x2="'+(W-padR)+'" y2="'+y.toFixed(1)+'" stroke="var(--line)" stroke-width="1" stroke-dasharray="2 3"/>';
    svg+='<text x="'+(padL-6)+'" y="'+(y+3).toFixed(1)+'" text-anchor="end" font-size="11.5" font-weight="600" fill="var(--tx2)">'+(Math.abs(t)<1e-9?'0':fmtEok(t,false))+'</text>';
  }
  svg+='<line x1="'+padL+'" y1="'+y0.toFixed(1)+'" x2="'+(W-padR)+'" y2="'+y0.toFixed(1)+'" stroke="var(--tx2)" stroke-width="1.4"/>';
  const slot=(W-padL-padR)/data.length, gw=slot*(metrics.length>1?0.86:0.7), bw=gw/metrics.length;
  data.forEach((d,gi)=>{
    const gx=padL+slot*gi+(slot-gw)/2;
    metrics.forEach(([nm,k,col],mi)=>{
      const e=eok(d[k]); if(e==null||!isFinite(e)) return;
      const y=yOf(e), x=gx+bw*mi, neg=e<0;
      svg+='<rect x="'+(x+1).toFixed(1)+'" y="'+Math.min(y,y0).toFixed(1)+'" width="'+(bw-2).toFixed(1)+'" height="'+Math.max(1.5,Math.abs(y-y0)).toFixed(1)+'" rx="2" fill="'+col+'"'+(d.est?' fill-opacity=".38" stroke="'+col+'" stroke-width="1.3" stroke-dasharray="3 2"':(neg?' fill-opacity=".55" stroke="'+col+'" stroke-width="1.2" stroke-dasharray="3 2"':''))+'><title>'+d.year+(d.est?' (증권사 컨센서스 예상) ':'년 ')+nm+' '+fmtEok(e,true)+(neg?' (적자)':'')+'</title></rect>';
      svg+='<text x="'+(x+bw/2).toFixed(1)+'" y="'+(neg?y+11+(mi%2?10:0):y-3-(mi%2?10:0)).toFixed(1)+'" text-anchor="middle" font-size="'+(metrics.length>1?(data.length>4?10.5:11):(data.length>4?10.5:11.5))+'" font-weight="800" fill="'+(neg?'var(--down)':'var(--tx2)')+'">'+(neg&&metrics.length===1?'적자 ':'')+(metrics.length>1?fmtEok(e,false).replace(/억$/,''):fmtEok(e,false))+'</text>';
    });
    svg+='<text x="'+(padL+slot*(gi+0.5)).toFixed(1)+'" y="'+(H-7)+'" text-anchor="middle" font-size="'+(data.length>4?11.5:12.5)+'" font-weight="700" fill="'+(d.est?'var(--accent)':'var(--tx)')+'">'+d.year+(d.est?'':'년')+'</text>';
  });
  return svg+'</svg>';
}
function renderFinancialsChart(data, split){
  if(!data || !data.length) return '<p class="mut" style="font-size:12.5px">재무제표 데이터를 가져오지 못했습니다.</p>';
  const eok=v=>v==null?null:v/100000000;
  const WIDEH=(typeof window!=='undefined'&&window.innerWidth>=1100);
  const revSvg=finSvg(data,[FIN_METRICS[0]],WIDEH?190:165);
  const profSvg=finSvg(data,[FIN_METRICS[1],FIN_METRICS[2]],WIDEH?250:215);
  if(!revSvg && !profSvg) return '<p class="mut" style="font-size:12.5px">재무제표 데이터를 가져오지 못했습니다.</p>';
  const lg=(nm,col)=>'<span style="display:inline-flex;align-items:center;gap:5px;margin-right:14px;font-size:13px;font-weight:600;color:var(--tx2)"><i style="width:11px;height:11px;border-radius:2px;background:'+col+';display:inline-block"></i>'+nm+'</span>';
  const svg=(revSvg?'<div style="margin-bottom:2px">'+lg('매출액',FIN_METRICS[0][2])+'</div>'+revSvg:'')+
    (profSvg?'<div style="margin:8px 0 2px">'+lg('영업이익',FIN_METRICS[1][2])+lg('당기순이익',FIN_METRICS[2][2])+'<span style="font-size:12px;color:var(--down)">점선 막대 = 적자(0선 아래) · 막대 위 숫자 단위: 억원</span></div>'+profSvg:'');
  const legend='';
  // 한눈에 보는 요약표: 연도별 값 + 3년 변화 + 영업이익률
  const th='<tr><th style="text-align:left">항목(억원)</th>'+data.map(d=>'<th style="text-align:right;'+(d.est?'color:var(--accent)':'')+'">'+d.year+'</th>').join('')+'<th style="text-align:right">변화</th></tr>';
  const valCell=v=>{ const e=eok(v); return e==null?'<td style="text-align:right" class="mut">—</td>':'<td style="text-align:right;font-weight:700;'+(e<0?'color:var(--down)':'')+'">'+fmtEok(e,false)+'</td>'; };
  const rows=FIN_METRICS.map(([nm,k,col])=>{
    const arr=data.filter(d=>!d.est).map(d=>d[k]).filter(v=>v!=null);
    const ch=finChange(arr.length>1?arr[0]:null, arr.length>1?arr[arr.length-1]:null);
    return '<tr><td><i style="width:8px;height:8px;border-radius:2px;background:'+col+';display:inline-block;margin-right:5px"></i>'+nm+'</td>'+
      data.map(d=>valCell(d[k])).join('')+'<td style="text-align:right;font-weight:800;color:'+ch.color+'">'+ch.txt+'</td></tr>';
  }).join('');
  const marginRow='<tr><td class="mut">영업이익률</td>'+data.map(d=>{
    const m=(d.revenue&&d.opProfit!=null)?d.opProfit/d.revenue*100:null;
    return '<td style="text-align:right;'+(m!=null&&m<0?'color:var(--down)':'')+'">'+(m==null?'—':m.toFixed(1)+'%')+'</td>';
  }).join('')+'<td></td></tr>';
  let estNote='';
  const ed=data.find(d=>d.est), lastA=data.filter(d=>!d.est).slice(-1)[0];
  if(ed&&lastA){
    const g=(a,b)=>(a!=null&&b!=null&&a>0)?((b/a-1)*100):null;
    const gr=g(lastA.revenue,ed.revenue), go=g(lastA.opProfit,ed.opProfit);
    const chip=(nm,v)=>v==null?'':'<span style="display:inline-block;margin-right:12px"><span class="mut">'+nm+'</span> <b style="color:'+(v>=0?'var(--up)':'var(--down)')+'">'+(v>=0?'+':'')+v.toFixed(1)+'%</b></span>';
    estNote='<div style="margin-top:8px;padding:8px 12px;border-radius:10px;background:rgba(0,117,74,.08);font-size:12px">📈 <b>'+ed.year.replace('E','')+'년 예상(컨센서스)</b> 전년 대비 '+chip('매출액',gr)+chip('영업이익',go)+'<div class="mut" style="font-size:10.5px;margin-top:3px">점선 연한 막대·E = 증권사 추정 평균(네이버 증권/FnGuide). 추정치는 실제와 다를 수 있으며 투자 권유가 아닙니다.</div></div>';
  }
  const tbl='<div class="scroll" style="margin-top:8px"><table style="font-size:12px;white-space:nowrap"><thead>'+th+'</thead><tbody>'+rows+marginRow+'</tbody></table></div>'+estNote;
  if(split) return {svg:svg, table:tbl};
  return svg+tbl;
}

/* 0을 중앙으로 한 증가율 막대(±clip% 에서 잘림) */
function finDivBar(v, clip){
  if(v==null) return '<div class="mut" style="font-size:11px">—</div>';
  const w=Math.min(Math.abs(v),clip)/clip*50, col=v>=0?'var(--up)':'var(--down)';
  return '<div style="position:relative;height:10px;background:var(--panel2);border-radius:5px;overflow:hidden">'+
    '<div style="position:absolute;left:50%;top:0;bottom:0;width:1.5px;background:var(--tx2);z-index:1"></div>'+
    '<div style="position:absolute;top:0;bottom:0;'+(v>=0?'left:50%':'right:50%')+';width:'+w.toFixed(1)+'%;background:'+col+'"></div></div>'+
    '<div style="display:flex;justify-content:space-between;font-size:9px;color:var(--tx2);margin-top:2px"><span>−'+clip+'%</span><span>0</span><span>+'+clip+'%</span></div>';
}
/* PSR 구간 바: 0~2 저평가, 2~8 보통, 8~12+ 고평가 */
function finPsrBar(psr){
  if(psr==null) return '<div class="mut" style="font-size:11px">—</div>';
  const MAX=12, pos=Math.max(0,Math.min(MAX,psr))/MAX*100;
  return '<div style="position:relative;height:10px;border-radius:5px;overflow:hidden;display:flex">'+
      '<div style="width:'+(2/MAX*100)+'%;background:var(--accent);opacity:.55"></div>'+
      '<div style="width:'+(6/MAX*100)+'%;background:var(--gold);opacity:.55"></div>'+
      '<div style="flex:1;background:var(--up);opacity:.55"></div></div>'+
    '<div style="position:relative;height:8px"><div style="position:absolute;left:'+pos.toFixed(1)+'%;top:0;transform:translateX(-50%);font-size:9px;color:var(--tx);line-height:8px">▲</div></div>'+
    '<div style="display:flex;justify-content:space-between;font-size:9px;color:var(--tx2)"><span>0</span><span>2 저평가↑</span><span>8 고평가↓</span><span>12+</span></div>';
}
/* 재무비율(매출액증가율·영업이익증가율) + 주가지표(EPS·PSR) 시각화 + 김군 판정 — 오른쪽 패널용 */
function renderFinancialRatios(ratios, noVerdict){
  if(!ratios) return '';
  const g=ratios.growth, eps=ratios.eps, psr=ratios.psr;
  if(g==null && eps==null && psr==null) return '<p class="mut" style="font-size:11.5px">재무비율·주가지표 데이터를 가져오지 못했습니다.</p>';
  const pctStr=v=>(v==null)?'—':((v>=0?'+':'')+v.toFixed(1)+'%');
  const pctColor=v=>(v==null)?'var(--tx2)':(v>=0?'var(--up)':'var(--down)');
  const rg=g?g.revenueGrowth:null, og=g?g.opProfitGrowth:null;
  const row=(label,valHtml,visual)=>'<div style="margin-bottom:12px"><div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:5px"><span class="mut" style="font-size:11.5px">'+label+'</span>'+valHtml+'</div>'+visual+'</div>';
  const epsHtml=eps==null?'<b>—</b>':'<b style="color:'+(eps<0?'var(--down)':'var(--tx)')+'">'+eps.toLocaleString()+'원'+(eps<0?' <span style="font-size:10.5px">(적자)</span>':'')+'</b>';
  return '<div>'+
    '<div class="mut" style="font-size:11px;margin-bottom:10px">재무비율 · 주가지표(최신 사업연도, DART 성장성지표 기준)</div>'+
    row('매출액증가율(YoY)','<b style="color:'+pctColor(rg)+'">'+pctStr(rg)+'</b>',finDivBar(rg,60))+
    row('영업이익증가율(YoY)','<b style="color:'+pctColor(og)+'">'+pctStr(og)+'</b>',finDivBar(og,100))+
    row('EPS(주당순이익)',epsHtml,'')+
    row('PSR(주가매출비율)','<b>'+(psr==null?'—':psr.toFixed(2)+'배')+'</b>',finPsrBar(psr))+
    (noVerdict?'':renderKimVerdictBadge(rg, psr, ratios.techD))+'</div>';
}
/* 한국지수·공모주 공용 재무 패널: 왼쪽=손익 3년 시각화, 오른쪽=재무비율·주가지표·김군 판정 */
/* 한국 종목 투자자 패널 — 미국 패널(4축·EPS×PER·PEG·ROA/ROE·팩터·김군판정)과 같은 방식.
   DART 손익·재무상태(자산·부채·자본) + 컨센서스(올해 E) + 종가로 계산한다. */
function krInvestorPanel(fin, ratios){
  try{
    const arr=(fin||[]).filter(x=>x&&!x.est), est=(fin||[]).find(x=>x&&x.est);
    const last=arr[arr.length-1]; if(!last) return '';
    const techD=ratios.techD, px=(techD&&techD.length)?techD[techD.length-1]:null;
    const g=ratios.growth||{};
    const div=(a,b)=>(a!=null&&b)?a/b:null;
    const eps=ratios.eps;
    const per=(px!=null&&eps>0)?px/eps:null;
    let gEst=null, gNote='';
    if(est&&last.netProfit>0&&est.netProfit!=null){ gEst=est.netProfit/last.netProfit-1; gNote='올해 컨센서스 순이익 증가율 '+(gEst*100).toFixed(0)+'%'; }
    else if(g.opProfitGrowth!=null&&g.opProfitGrowth>0){ gEst=g.opProfitGrowth/100; gNote='최근 영업이익증가율 '+g.opProfitGrowth.toFixed(0)+'%'; }
    const fEps=(eps>0&&gEst!=null)?eps*(1+gEst):null;
    const it={
      revenueGrowth:g.revenueGrowth!=null?g.revenueGrowth/100:null,
      earningsGrowth:g.opProfitGrowth!=null?g.opProfitGrowth/100:null,
      trailingEps:eps, forwardEps:fEps, trailingPE:per, forwardPE:(fEps&&px)?px/fEps:null,
      psr:ratios.psr, roa:div(last.netProfit,last.assets), roe:div(last.netProfit,last.equity),
      operatingMargins:div(last.opProfit,last.revenue), profitMargins:div(last.netProfit,last.revenue),
      debtToEquity:last.debt!=null&&last.equity?last.debt/last.equity*100:null, currentRatio:null, freeCashflow:null,
      price:px, pegRatio:null, trend:{growth5y:(gEst!=null&&gEst>0)?gEst:null}
    };
    const dv=ratios.dividend;
    it.div={};
    if(dv){
      it.div={yield:dv.yield, rate:dv.dps, payout:dv.payout, avg5y:null};
      it.divHist={growth5:dv.growth5, growthYears:dv.growthYears, lastAnnual:dv.dps, lastYear:dv.year, freq:null};
    }
    return renderUsFinancialRatios(it, techD, {cur:'won', hideSix:true, title:'투자자 패널 · '+last.year+'년 사업보고서(DART) 기준', ogLabel:'영업이익증가율', fwdLabel:'EPS(예상)',
      pegNote:'PEG(근사) = 예상 PER ÷ '+(gNote||'이익 성장률')+' · &lt;1 저평가 · 1 적정 · &gt;1 고평가',
      foot:'※ ROA·ROE·부채비율은 DART 연결(없으면 개별) 재무제표, 예상 EPS는 컨센서스 순이익 증가율을 현재 EPS에 적용한 근사치입니다. 유동비율·FCF·이익수정은 제공되지 않아 제외했습니다. 참고용이며 투자 권유가 아닙니다.'});
  }catch(e){ console.warn('KR 투자자 패널 실패',e); return ''; }
}
function renderFinancialsPanel(fin3y, ratios, headNote, footNote){
  const hasR=!!(ratios&&(ratios.growth!=null||ratios.eps!=null||ratios.psr!=null));
  const rat=hasR?renderFinancialRatios(ratios,true):'';
  const body=(function(){
    const pc=(typeof window!=='undefined'&&window.innerWidth>=1000);
    if(pc){
      const sp=renderFinancialsChart(fin3y,true);
      if(sp&&sp.svg!=null){
        return '<div class="ipo-fp-cols"><div class="ipo-fp-l">'+sp.svg+'</div><div class="ipo-fp-r">'+sp.table+(rat?'<div class="ipo-fp-rat">'+rat+'</div>':'')+'</div></div>';
      }
    }
    return '<div class="ipo-fp-cols"><div class="ipo-fp-l">'+renderFinancialsChart(fin3y)+'</div>'+(rat?'<div class="ipo-fp-r">'+rat+'</div>':'')+'</div>';
  })();
  return '<div class="ipo-fp"><div class="hd"><b>📊 재무 요약</b><span>'+headNote+'</span></div><div class="bd">'+body+
    (hasR?krInvestorPanel(fin3y,ratios):'<p class="ipo-nodata">재무비율·주가지표(EPS·PSR)는 DART 성장성지표가 아직 없는 신규 종목이라 표시하지 않습니다.</p>')+
    (footNote?'<p class="mut" style="font-size:11px;margin-top:8px">'+footNote+'</p>':'')+'</div></div>';
}

async function loadKrxIndicators(){
  const result={};
  /* 5. 시장 변동성(VKOSPI): idx/drvprod_dd_trd(파생상품지수 시세정보) — IDX_CLSS='옵션지수',
     IDX_NM='코스피 200 변동성지수' 행이 VKOSPI (2026-09-28 직접 검증, CLSPRC_IDX=42.98 형태로 확인).
     '변동성매칭 양매도지수'/'변동성추세 추종 양매도지수' 등 이름에 '변동성'이 들어간 다른 지수와
     혼동되지 않도록 정확한 지수명으로 매칭한다. */
  try{
    const idxRows=await krxJSONRecent('idx/drvprod_dd_trd', 10);
    if(idxRows){
      const row=idxRows.find(r=>{
        const name=pick(r,['IDX_NM','IDX_IND_NM','ISU_NM','IDX_NM_KOR'])||'';
        return name.trim()==='코스피 200 변동성지수';
      }) || idxRows.find(r=>{
        const name=pick(r,['IDX_NM','IDX_IND_NM','ISU_NM','IDX_NM_KOR'])||'';
        return /^코스피\s*200\s*변동성지수$/.test(name.trim());
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
        console.warn('KRX drvprod_dd_trd 응답에서 VKOSPI(코스피 200 변동성지수) 행을 찾지 못함:', idxRows[0]);
      }
    }
  }catch(e){ console.warn('VKOSPI 계산 실패:', e); }

  /* 4. 풋/콜 비율: opt_bydd_trd(옵션 일별매매정보(주식옵션외)) — KOSPI200 지수옵션 기준으로 교체.
     [2026-09-28] 기존엔 개별주식옵션(eqsop_bydd_trd) 합산이라 CNN 원본(지수옵션) 방식과
     달랐는데, opt_bydd_trd 카테고리 승인 후 실데이터로 확인해보니 PROD_NM 필드에
     '코스피200 옵션'(정규월물) · '코스피200 위클리(목/월) 옵션' · '미니코스피200 옵션' ·
     '코스닥150 옵션' 등이 섞여 있다. PROD_NM이 '코스피200'으로 시작하는 행(정규월물+위클리,
     미니/코스닥 제외)만 합산 — 위클리 포함이 3거래일 실측 기준 변동성이 더 작고 안정적이었다
     (정규월물만 쓰면 0.68~0.94로 더 들쭉날쭉, 위클리 포함 시 0.76~0.79로 안정).
     RGHT_TP_NM='CALL'|'PUT'(영문 대문자), ACC_TRDVOL=거래량. */
  try{
    const optRows=await krxJSONRecent('drv/opt_bydd_trd', 10);
    if(optRows && optRows.length){
      let callVol=0, putVol=0;
      optRows.forEach(r=>{
        const prod=pick(r,['PROD_NM'])||'';
        if(!prod.startsWith('코스피200')) return; // 미니코스피200·코스닥150 옵션 제외
        const kind=(pick(r,['RGHT_TP_NM','RGHT_TP_CD','OPT_TP_NM'])||'').toUpperCase();
        const vol=+pick(r,['ACC_TRDVOL','TRDVOL','TRD_VOL'])||0;
        if(kind.includes('콜')||kind.includes('CALL')) callVol+=vol;
        else if(kind.includes('풋')||kind.includes('PUT')) putVol+=vol;
      });
      if(callVol>0){
        const ratio=putVol/callVol;
        result.putCallRatio=ratio;
        // 풋/콜 0.5~1.5 를 탐욕(100)~공포(0)로 역매핑(높을수록 공포)
        const clipped=Math.max(0.5,Math.min(1.5,ratio));
        result.putCallScore=100-((clipped-0.5)/1.0)*100;
      }else{
        console.warn('KRX opt_bydd_trd 응답에서 코스피200 옵션 콜/풋 구분 실패(필드명 확인 필요):', optRows[0]);
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
let lastKrMomentumScore=null, lastKrMomentumData=null;
/* [로직 변경 — 2026-09-28] 예전에는 상단 큰 게이지가 1번(모멘텀) 하나만 반영하는
   "모멘텀 기반 근사 지수"였다(2~7번은 표 아래 세부지표에만 표시되고 도착해도 게이지에는
   반영 안 됨). 이제 4·5·6·7번이 실제로 계산되고 있으므로, 게이지도 CNN 방식처럼 7개
   세부지표 중 현재 값이 있는 항목들의 단순평균으로 계산해 도착하는 대로 갱신한다
   (2·3번은 KV/Cron 설정 전까지 계속 평균에서 제외됨 — 몇 개가 반영됐는지 kr-note에 표시). */
function computeKRComposite(momentumScore, ecos, krx, breadth){
  const vals=[
    momentumScore,
    breadth&&breadth.strength?breadth.strength.score:null,
    breadth&&breadth.breadth?breadth.breadth.score:null,
    krx&&krx.putCallScore!=null?krx.putCallScore:null,
    krx&&krx.vkospiScore!=null?krx.vkospiScore:null,
    ecos&&ecos.safeHavenScore!=null?ecos.safeHavenScore:null,
    ecos&&ecos.creditScore!=null?ecos.creditScore:null
  ].filter(v=>v!=null && isFinite(v));
  if(!vals.length) return null;
  return {avg: vals.reduce((a,b)=>a+b,0)/vals.length, count: vals.length};
}
async function loadKR(){
  let ecosData=null, krxData=null, breadthData=null;
  renderKRSub(null, null, null, null); // 뼈대부터 즉시 그려서 "불러오는 중" 상태를 없앤다

  const bg=(p, assign)=>p.then(v=>{ assign(v); renderKR(lastKrMomentumData, ecosData, krxData, breadthData); })
                        .catch(e=>{ console.warn('한국 공포탐욕 세부지표 로딩 실패:', e); });
  const ecosP=bg(loadEcosIndicators(), v=>ecosData=v);
  const krxP=bg(loadKrxIndicators(), v=>krxData=v);
  /* breadth: KV(2번 52주 신고가/신저가 · Cron 집계 필요)와 직접계산(3번 상승/하락 거래대금 ·
     즉시 가능)을 합친다. KV가 아직 비어있어도(Cron 미설정) 3번은 이 direct 호출만으로 채워진다. */
  const breadthP=bg(Promise.all([loadKrBreadth(), loadKrBreadthDirect()]).then(([kv, direct])=>{
    if(!kv && !direct) return null;
    return Object.assign({}, kv||{}, direct||{}, {
      breadth: (direct&&direct.breadth) || (kv&&kv.breadth) || null,
      strength: (kv&&kv.strength) || null,
      market: (kv&&kv.market) || (direct&&direct.market) || null
    });
  }), v=>breadthData=v);

  const closes=await yclose('^KS11','1y');
  if(!closes || closes.length<126){ renderKR(null, ecosData, krxData, breadthData); await Promise.allSettled([ecosP,krxP,breadthP]); return; }
  const last=closes[closes.length-1];
  const ma125=closes.slice(-125).reduce((a,b)=>a+b,0)/125;
  const ratio=(last-ma125)/ma125;
  if(!isFinite(ratio)){ renderKR(null, ecosData, krxData, breadthData); await Promise.allSettled([ecosP,krxP,breadthP]); return; }
  const clipped=Math.max(-0.15,Math.min(0.15,ratio));
  const score=((clipped+0.15)/0.30)*100;
  lastKrMomentumScore=score;
  lastKrMomentumData={score, last, ma125, ratio, chg:(closes.length>1?(last/closes[closes.length-2]-1)*100:null)};
  renderKR(lastKrMomentumData, ecosData, krxData, breadthData);
  await Promise.allSettled([ecosP,krxP,breadthP]); // 이미 각자 도착 시점에 화면을 갱신했으므로 여기선 대기만
}
function renderKR(d, ecos, krx, breadth){
  const valEl=document.getElementById('kr-val'), stateEl=document.getElementById('kr-state'),
        dialEl=document.getElementById('kr-dial'), detailEl=document.getElementById('kr-detail'),
        noteEl=document.getElementById('kr-note');
  if(!d){
    if(stateEl) stateEl.textContent='연동 실패';
    if(detailEl) detailEl.textContent='코스피(^KS11) 데이터를 가져오지 못했습니다 · PROXY_BASE 설정을 확인해주세요.';
    renderKRSub(null, ecos, krx, breadth);
    return;
  }
  const composite=computeKRComposite(d.score, ecos, krx, breadth);
  const gaugeScore=composite?composite.avg:d.score;
  const [t,c]=label(gaugeScore);
  if(valEl) valEl.textContent=Math.round(gaugeScore);
  if(stateEl){ stateEl.textContent=t; stateEl.style.color=c; }
  if(dialEl){ dialEl.style.setProperty('--p',gaugeScore+'%'); dialEl.style.setProperty('--g',c); }
  if(noteEl){ const cg=d.chg!=null?('코스피 전일 대비 '+(d.chg>=0?'▲ ':'▼ ')+Math.abs(d.chg).toFixed(2)+'%<br>'):''; noteEl.innerHTML=cg+(composite?('7개 지표 중 '+composite.count+'/7 반영 평균'):'125일 이평 이격도 기준'); }
  if(detailEl) detailEl.textContent='코스피 '+d.last.toFixed(1)+' · 125일 이동평균 '+d.ma125.toFixed(1)+
      ' · 이격도 '+(d.ratio*100>=0?'+':'')+(d.ratio*100).toFixed(1)+'%'+
      (composite?' · 모멘텀 단독점수 '+Math.round(d.score):'');
  // 김군코멘트 — 미국지수(paint())와 동일한 상태→행동 매핑·배지 스타일을 그대로 재사용한다.
  const kc=document.getElementById('kr-kimcomment');
  if(kc){
    const ACTION={'극단적 공포':'매수 시작','공포':'매수 시작','중립':'관망','탐욕':'매수 금지','극단적 탐욕':'매수 금지'};
    kc.textContent=t+' — '+(ACTION[t]||'—');
    kc.style.color=c;
    kc.style.background=c+'26';
    kc.style.border='1px solid '+c+'55';
  }
  renderKRSub(d.score, ecos, krx, breadth);
}
/* 7개 세부지표 설명 — 표 항목명 옆 ⓘ 아이콘에 마우스를 올리면(모바일은 탭하면) 나오는 툴팁.
   각 지표가 "무엇을, 어떻게 계산하는지"와 "어느 쪽이 탐욕/공포인지"를 담아 표만 봐서는
   알기 어려운 계산 방식을 설명한다. */
const KR_SUBDESC={
  '1':'코스피 지수가 125일(약 6개월) 이동평균보다 얼마나 높은지/낮은지를 측정합니다. 이동평균보다 많이 올라 있을수록 탐욕, 많이 내려가 있을수록 공포로 해석합니다.',
  '2':'코스피+코스닥 전종목 중 52주(약 1년) 신고가를 기록한 종목 수와 52주 신저가를 기록한 종목 수의 비율입니다. 신고가 종목이 신저가 종목보다 많을수록 탐욕입니다. ※ Worker가 매일 종가를 누적해 자체 계산하는 구조라, 누적 기간이 짧을 때는 실제 52주 기준과 오차가 있을 수 있습니다(위 "N일 누적" 참고).',
  '3':'코스피+코스닥 전종목의 상승종목 거래대금 합과 하락종목 거래대금 합의 비율입니다. 상승하는 종목 쪽으로 거래대금이 많이 몰릴수록(자금이 위험자산을 쫓아갈수록) 탐욕입니다.',
  '4':'KOSPI200 지수옵션(정규월물+위클리)의 풋옵션·콜옵션 거래량 비율입니다. 콜옵션(상승 베팅) 거래가 상대적으로 많으면(풋/콜비가 낮으면) 탐욕, 풋옵션(하락 베팅·헤지) 거래가 많으면 공포입니다.',
  '5':'VKOSPI는 KOSPI200 옵션 가격에서 역산한 "향후 변동성에 대한 시장의 기대치"로, 미국 VIX의 한국판입니다. 낮을수록 투자자들이 시장을 안정적으로 보고 있다는 뜻(탐욕), 높을수록 불안감이 크다는 뜻(공포)입니다.',
  '6':'최근 20거래일간 코스피 수익률과 국고채(3년) 금리 변화를 비교합니다. 주식 대신 국채(안전자산)로 자금이 이동하는 신호가 강할수록 공포, 주식을 선호할수록 탐욕입니다.',
  '7':'신용등급이 낮은 회사채(BBB-)와 우량 회사채(AA-) 간 금리차(신용스프레드)입니다. 스프레드가 최근 평소 수준보다 좁아지면(위험자산도 서슴없이 사들이는 분위기) 탐욕, 벌어지면(안전한 채권만 찾는 분위기) 공포로 해석합니다.'
};
function krSubLabel(num, text){
  return text;
  const desc=KR_SUBDESC[num];
  if(!desc) return text;
  return text+' <span class="mut" title="'+desc.replace(/"/g,'&quot;')+'" style="cursor:help;font-weight:700;border:1px solid var(--line);border-radius:50%;width:14px;height:14px;display:inline-flex;align-items:center;justify-content:center;font-size:10px;vertical-align:middle;margin-left:2px">ⓘ</span>';
}
function krLab(num,n){ return '<span class="sub-no">'+num+'</span><span class="sub-nm">'+String(n).replace(/^\d+\.\s*/,'')+'</span>'; }
function renderKRSub(momentumScore, ecos, krx, breadth){
  const el=document.getElementById('kr-sub'); if(!el) return;
  const strengthNote=breadth&&breadth.strength?' ('+breadth.strength.daysAccumulated+'일 누적, '+breadth.market+')':'';
  const rows=[
    ['1', krSubLabel('1','1. 시장 모멘텀'), momentumScore],
    ['2', krSubLabel('2','2. 주가 강도'), breadth&&breadth.strength?breadth.strength.score:null],
    ['3', krSubLabel('3','3. 주가 폭'), breadth&&breadth.breadth?breadth.breadth.score:null],
    ['4', krSubLabel('4','4. 풋/콜 옵션'), krx&&krx.putCallScore!=null?krx.putCallScore:null],
    ['5', krSubLabel('5','5. 시장 변동성'), krx&&krx.vkospiScore!=null?krx.vkospiScore:null],
    ['6', krSubLabel('6','6. 안전자산 수요'), ecos&&ecos.safeHavenScore!=null?ecos.safeHavenScore:null],
    ['7', krSubLabel('7','7. 정크본드 수요'), ecos&&ecos.creditScore!=null?ecos.creditScore:null]
  ];
  const _pend=rows.filter(r=>r[2]==null);
  el.innerHTML=rows.filter(r=>r[2]!=null).map(([num,n,v])=>{
    if(v==null) return '<tr><td class="sub-lab" style="white-space:nowrap">'+krLab(num,n)+'</td><td style="width:24%;min-width:48px"><div class="sub-bar" style="opacity:.25"></div></td><td class="num" style="white-space:nowrap;line-height:1.5"><b class="mut">--</b><br><span class="tag t-l">준비중</span></td></tr>';
    const [t,c]=label(v);
    const xv=Math.max(9,Math.min(91,v));
    return '<tr class="sb-done"><td class="sub-lab" style="white-space:nowrap">'+krLab(num,n)+'</td><td style="width:24%;min-width:48px">'+subBarCell(v)+'<span class="sb-val" style="left:'+xv.toFixed(1)+'%">'+v.toFixed(1)+'</span></td>'+
      '<td class="num" style="white-space:nowrap;line-height:1.5"><b>'+v.toFixed(1)+'</b><br>'+zoneTag(t)+'</td></tr>';
  }).join('');
  if(_pend.length) el.innerHTML+='<tr class="sb-pending"><td colspan="3"><b>준비중 '+_pend.length+'개</b> · '+_pend.map(r=>r[0]+'번 '+String(r[1]).replace(/^\d+\.\s*/,'').replace(/<[^>]*>/g,'')).join(' · ')+'</td></tr>';
  const kn=document.getElementById('kr-sub-note');
  if(kn) kn.innerHTML='<details><summary style="cursor:pointer;font-weight:800;color:var(--accent)">지표 설명 자세히 보기</summary><div style="margin-top:6px">'+['1','2','3','4','5','6','7'].map(k=>SUB_NUM[+k-1]+' '+KR_SUBDESC[k]).join('<br>')+'<br><span style="opacity:.8">막대: 왼쪽 극단적 공포(0) ~ 오른쪽 극단적 탐욕(100) · 검은 표시가 현재 점수</span></div></details>';
  renderBreadthFlow('kr-breadth-flow', breadth);
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
  const [qld,usd,schd,qqq,tqqq,fg,soxl]=await Promise.all([
    yDailySeries('QLD'), yDailySeries('USD'), yDailySeries('SCHD'), yDailySeries('QQQ'), yDailySeries('TQQQ'), fgDailyHistory(), yDailySeries('SOXL')
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
  const qqqPriceMap={}, tqqqPriceMap={}, soxlPriceMap={};
  if(qqq) qqq.series.forEach(p=>{ qqqPriceMap[p.t]=p.close; });
  if(tqqq) tqqq.series.forEach(p=>{ tqqqPriceMap[p.t]=p.close; });
  if(soxl) soxl.series.forEach(p=>{ soxlPriceMap[p.t]=p.close; });

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
  const soxlDivMap=soxl?buildDivMap(soxl.dividends):{};

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
  let cumCost=0, baseCumCost=0, cumDividend=0, buyCount=0;
  const monthly={};
  const curve=[];
  let prevMonthKey=null, monthStartValue=0, monthStartCost=0;
  /* 벤치마크: 실제 전략이 그날 지출한 것과 동일한 금액을 QQQ/QLD/TQQQ 단독매수에 썼다면 가정 */
  let bmQqqShares=0, bmQldShares=0, bmTqqqShares=0;
  /* [벤치마크 매도 동기화] 전략이 원금 100% 회수나 듀얼스나이퍼 매도로 특정 금액을 현금화하면,
     "같은 돈을 QQQ/QLD/TQQQ에 그대로 넣어뒀다면?" 비교도 공정하려면 그 시점에 벤치마크에서도
     동일한 달러 금액만큼 매도해야 한다. 그렇지 않으면 벤치마크는 계속 전액 투자 상태로 남아
     실제 전략(현금화로 위험 노출이 줄어든 상태)과 비교가 어긋난다. */
  function sellFromBenchmarks(dollarAmount, ts){
    const qqqPx=qqqPriceMap[ts], qldPx=priceMap.QLD[ts], tqqqPx=tqqqPriceMap[ts];
    if(qqqPx && bmQqqShares>0) bmQqqShares=Math.max(0, bmQqqShares-dollarAmount/qqqPx);
    if(qldPx && bmQldShares>0) bmQldShares=Math.max(0, bmQldShares-dollarAmount/qldPx);
    if(tqqqPx && bmTqqqShares>0) bmTqqqShares=Math.max(0, bmTqqqShares-dollarAmount/tqqqPx);
  }
  let bmQqqDiv=0, bmQldDiv=0, bmTqqqDiv=0;
  let globalPeak=0; /* 낙폭(underwater) 그래프용 — 리셋되지 않는 전체 기간 누적 최고점(배당 포함 총수익 기준) */
  let bmQldPeak=0, bmTqqqPeak=0, bmQqqPeak=0; /* QQQ·QLD·TQQQ 단독매수 벤치마크의 낙폭 계산용 최고점 */

  /* [옵션] 원금 100% 회수: 포트폴리오 매수 첫 시작 시점 기준으로 딱 1회만 수행한다고 가정한다.
     평가금(배당 포함)이 최초 원금의 2배에 처음 도달하는 순간, 그 원금만큼 비례 매도해
     현금화하고(recoveredCash) 남은 평가금으로 동일 조건 매수를 계속한다. 이후 조건이 다시
     충족되어도 재실행하지 않는다(실제 트리거는 아래 day loop에서 recoveryEvents.length===0
     조건으로 강제한다). */
  let recoveredCash=0;
  const recoveryEvents=[]; // 항상 0개 또는 1개 — {t, amount, round:1}

  /* [관리자 전용 상세 기록] 종목별 실제 매수 로그 — 화면에는 공개하지 않고 관리자 히든페이지에서만 사용 */
  const tradeLog=[]; // {t, ticker, qty, price, amount, score}
  const rebalanceLog=[]; // {t, before:{QLD,USD,SCHD}, after:{QLD,USD,SCHD}} — 관리자 히든페이지용

  /* [원금 100% 회수 옵션] "회수하지 않았다면?" 시나리오를 비교용으로 나란히 시뮬레이션한다.
     매수·배당·리밸런싱 규칙은 완전히 동일하게 적용하되, 회수 매도만 절대 실행하지 않는다.
     principalRecoveryMode가 꺼져 있으면 recoveryEvents가 항상 비어 있어 shares2는 shares와
     끝까지 동일하게 흘러간다(계산은 하되 화면에는 옵션이 켜져 있을 때만 표시). */
  let shares2={QLD:0,USD:0,SCHD:0}, cumCost2=0, cumDividend2=0, value2=0;

  /* [옵션] 듀얼스나이퍼 매수 조건: 미국지수 공포탐욕 점수 기준으로 SOXL을 단계적으로 매수한다.
     점수 25 미만이면 매주 금요일 2,500달러, 20 미만이면 매주 금요일 5,000달러, 15 미만이면
     매주 금요일 7,500달러, 10 미만이면 매일 10,000달러(중복이 아니라 구간 교체 — 가장 낮은
     점수 구간이 우선 적용됨). 이 SOXL 포지션은 연말 리밸런싱에서 완전히 제외된다.
     매도 조건은 이전과 동일: 포지션 수익률이 +200%에 처음 도달하면 잔고의 50%를 매도하고,
     이후 +100%p 구간마다(300%,400%…) 잔고의 25%씩 매도한다(매도분 원가도 비례 차감). */
  let sniperShares=0, sniperCost=0, sniperRealizedCash=0, sniperNextSellPct=200, sniperSellCount=0;
  let lastSniperValue=0;
  const sniperLog=[]; // {t, type:'buy'|'sell', qty, price, amount} — 관리자 히든페이지용
  const monthlySniper={}; // mk -> {buys, spend, sells:[{t,amount}]}

  tradingTs.forEach(ts=>{
    const d=new Date(ts);
    const mk=d.getUTCFullYear()+'-'+String(d.getUTCMonth()+1).padStart(2,'0');
    if(mk!==prevMonthKey){
      monthly[mk]={buys:0, dividends:0, startValue:monthStartValue, startCost:monthStartCost, endValue:0, endCost:0, peak:monthStartValue||0, mdd:0, divEvents:[]};
      monthlySniper[mk]={buys:0, spend:0, sells:[]};
      prevMonthKey=mk;
    }
    { let dayDivAmt=0;
      TRADE_TICKERS.forEach(t=>{
        const dv=divMap[t][ts];
        if(dv && shares[t]>0){ const amt=dv*shares[t]; cumDividend+=amt; monthly[mk].dividends+=amt; dayDivAmt+=amt; }
        if(dv && shares2[t]>0){ cumDividend2+=dv*shares2[t]; } // 회수 안 했을 시나리오도 동일하게 배당 누적
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
        shares[t]+=qty; cumCost+=px*qty; baseCumCost+=px*qty; dailySpend+=px*qty; bought=true;
        tradeLog.push({t:ts, ticker:t, qty, price:px, amount:px*qty, score});
        shares2[t]+=qty; cumCost2+=px*qty; // "회수 안 했다면" 시나리오도 동일하게 매수
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
       (스나이퍼 SOXL 포지션은 이 로직과 완전히 분리되어 있어 자연히 제외된다) */
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
    /* "회수 안 했다면" 시나리오도 동일한 리밸런싱 규칙을 적용 */
    { let value2now=0;
      TRADE_TICKERS.forEach(t=>{ const px=priceMap[t][ts]; if(px!=null) value2now+=shares2[t]*px; });
      if(rebalanceDays.has(ts) && value2now>0){
        TRADE_TICKERS.forEach(t=>{
          const px=priceMap[t][ts]; if(px==null) return;
          shares2[t]=(value2now*REBAL_TARGET[t])/px;
        });
        value2now=0;
        TRADE_TICKERS.forEach(t=>{ const px=priceMap[t][ts]; if(px!=null) value2now+=shares2[t]*px; });
      }
      value2=value2now;
    }

    const soxlPxNow0=soxlPriceMap[ts];

    if(dualSniperMode){
      const soxlDiv=soxlDivMap[ts];
      if(soxlDiv && sniperShares>0){ const amt=soxlDiv*sniperShares; cumDividend+=amt; monthly[mk].dividends+=amt; monthly[mk].divEvents.push({t:ts, amount:amt}); }
      /* 공포탐욕 점수 기준 — 가장 낮은(가장 공포스러운) 구간이 우선 적용된다 */
      let sniperBuy=0;
      if(score<10){ sniperBuy=10000; } // 매일
      else if(fridayBuyDays.has(ts)){
        if(score<15) sniperBuy=7500;
        else if(score<20) sniperBuy=5000;
        else if(score<25) sniperBuy=2500;
      }
      if(sniperBuy>0 && soxlPxNow0){
        sniperShares+=sniperBuy/soxlPxNow0;
        sniperCost+=sniperBuy;
        cumCost+=sniperBuy; // 실제 투입 자금이므로 누적원금에 포함
        sniperLog.push({t:ts, type:'buy', qty:sniperBuy/soxlPxNow0, price:soxlPxNow0, amount:sniperBuy, score});
        monthlySniper[mk].buys++; monthlySniper[mk].spend+=sniperBuy;
      }
      /* 스나이퍼 매도: 포지션 수익률이 +200%에 처음 도달하면 잔고의 50%, 이후 +100%p 구간마다(300%,400%…) 잔고의 25%씩 매도 */
      if(sniperShares>0 && soxlPxNow0 && sniperCost>0){
        const sniperValueChk=sniperShares*soxlPxNow0;
        const sniperProfitPct=(sniperValueChk/sniperCost-1)*100;
        if(sniperProfitPct>=sniperNextSellPct){
          const sellFrac=sniperSellCount===0?0.5:0.25;
          const soldShares=sniperShares*sellFrac;
          const soldValue=soldShares*soxlPxNow0;
          const costBasisSold=sniperCost*sellFrac; // 매도분에 해당하는 원가(수익금 계산용)
          sniperShares-=soldShares;
          sniperCost*=(1-sellFrac); // 매도분만큼 원가도 비례 차감(잔여 포지션 평단가 유지)
          sniperRealizedCash+=soldValue;
          sniperNextSellPct+=100;
          sniperSellCount++;
          sniperLog.push({t:ts, type:'sell', qty:soldShares, price:soxlPxNow0, amount:soldValue, profit:soldValue-costBasisSold});
          monthlySniper[mk].sells.push({t:ts, amount:soldValue});
          sellFromBenchmarks(soldValue, ts); // 벤치마크도 동일 금액만큼 매도(공정 비교)
        }
      }
    }

    /* 원금 100% 회수: 포트폴리오 시작 시점 기준으로 딱 1회만 수행한다고 가정한다.
       평가금(배당 포함)이 최초 순원금의 2배에 처음 도달하는 순간, 그 순원금만큼 비례
       매도해 현금화한다(스나이퍼 SOXL 포지션은 건드리지 않음). 이후에는 다시 조건이
       충족되어도 재실행하지 않는다. */
    if(principalRecoveryMode && recoveryEvents.length===0){
      const netCost=baseCumCost-recoveredCash; // [반영] 듀얼스나이퍼 매수원금은 제외하고 기본매수조건 원금만으로 판단
      if(netCost>0 && value>0 && (value+cumDividend)>=2*netCost){
        /* [버그 수정] 배당이 누적돼 "평가금+배당≥원금의 2배" 조건은 충족되지만 포지션 시가(value)
           자체는 원금(netCost)에 못 미치는 경우, 예전 코드는 그래도 netCost 전액을 매도한 것처럼
           처리해 value가 음수로 내려가는 계산 오류가 있었다. 실제로 현금화할 수 있는 금액은
           포지션 시가를 넘을 수 없으므로 min(netCost, value)로 상한을 둔다. */
        const cashOut=Math.min(netCost, value);
        const sellRatio=value>0?cashOut/value:0;
        TRADE_TICKERS.forEach(t=>{ shares[t]*=(1-sellRatio); });
        value-=cashOut;
        recoveredCash+=cashOut;
        recoveryEvents.push({t:ts, amount:cashOut, round:1});
        monthly[mk].recovered=(monthly[mk].recovered||0)+cashOut; // 이번 달 원금 회수액(월별 수익 계산 보정용)
        sellFromBenchmarks(cashOut, ts); // 벤치마크도 동일 금액만큼 매도(공정 비교)
      }
    }

    // [버그 수정] 듀얼스나이퍼 포지션은 SOXL로 매수·매도되는데(soxlPxNow0), 여기서는 존재하지 않는
    // tqqqPxNow0 변수를 참조해 매 계산마다 ReferenceError로 백테스트 전체가 중단되고 있었다
    // ("00년 1월 1일부터 데이터를 불러와 다시 계산하는 중…"에서 멈춰 화면에 아무것도 안 뜨는 원인).
    const sniperValueNow=soxlPxNow0?sniperShares*soxlPxNow0:0;
    lastSniperValue=sniperValueNow;
    const displayCost=cumCost-recoveredCash-sniperRealizedCash; // 회수한 원금·듀얼스나이퍼 실현액은 더 이상 투입원금으로 잡지 않는다
    /* [재검토 반영] 원금 회수・듀얼스나이퍼 매도 둘 다 "인출해서 쓴 현금"으로 간주해 이 시점부터는
       포트폴리오 평가금에 더 이상 포함시키지 않는다(recoveredCash·sniperRealizedCash 모두
       totalValue에서 제외). 그래서 두 이벤트 중 무엇이 발생하든 그 순간 평가금 곡선이 실제로
       팔린 금액만큼 한 단계 내려가고, 그 뒤로는 남은(줄어든) 포지션만으로 계속 성장한다. */
    const totalValue=value+cumDividend+sniperValueNow; // 평가금(배당 포함, 회수·실현된 현금은 모두 제외)
    // [버그 수정] "TQQQ 단독매수" 벤치마크 비교선은 실제 TQQQ 시세가 필요한데, 위와 같은 이유로
    // 존재하지 않는 tqqqPxNow0(예전 변수명 잔재)를 재사용하고 있었다 — TQQQ 시세 조회로 교체.
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
      t:ts, cost:displayCost, value:totalValue, dd, cumDividend, posValue:value, sniperVal:sniperValueNow,
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
    if(!yearly[y]) yearly[y]={startValue:monthly[mk].startValue, startCost:monthly[mk].startCost, endValue:0, endCost:0, dividends:0, buys:0, recovered:0};
    yearly[y].endValue=monthly[mk].endValue;
    yearly[y].endCost=monthly[mk].endCost;
    yearly[y].dividends+=monthly[mk].dividends;
    yearly[y].buys+=monthly[mk].buys;
    yearly[y].recovered+=(monthly[mk].recovered||0);
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

  /* [원금 100% 회수 옵션] "회수하지 않았다면?" 시나리오의 최종값들 — 실제 결과와 비교(diff)용.
     principalRecoveryMode가 꺼져 있거나 회수가 일어나지 않았으면 실제값과 동일해 diff가 0이 된다. */
  let annualDividendEst2=0;
  TRADE_TICKERS.forEach(t=>{
    if(shares2[t]<=0) return;
    const perShare12m=(data[t].dividends||[]).filter(d=>d.t>oneYearAgoTs && d.t<=lastTs).reduce((s,d)=>s+d.amount,0);
    annualDividendEst2+=perShare12m*shares2[t];
  });
  const noRecoveryTotalValue=value2+cumDividend2+lastSniperValue; // 실제 평가금과 동일하게 스나이퍼 실현 현금은 제외(둘 다 "인출한 현금"으로 취급)

  const finalPrices={}; TRADE_TICKERS.forEach(t=>{ finalPrices[t]=priceMap[t][lastTs]; });

  return {
    curve, monthly, yearly, buyCount, cumDividend,
    finalCost:cumCost-recoveredCash-sniperRealizedCash, finalValue:curve.length?curve[curve.length-1].value:0,
    finalPosValue:curve.length?curve[curve.length-1].posValue:0,
    nextDiv, didRebalance:rebalanceDays.size>0,
    annualDividendEst,
    principalRecoveryMode, dualSniperMode, recoveredCash, recoveryEvents,
    sniperCost, sniperShares, sniperRealizedCash, sniperLog, monthlySniper, tradeLog, rebalanceLog, finalPrices,
    noRecoveryCost:cumCost2, noRecoveryDividend:cumDividend2,
    noRecoveryAnnualDividendEst:annualDividendEst2, noRecoveryTotalValue
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
  const w=opts.w||340, h=opts.h||180, zeroLine=!!opts.zeroLine;
  // [시인성] 축 글자는 HTML 오버레이(px 고정)로 그려 가로 늘림 왜곡을 없애고, 글자가 들어갈 여백을 확보한다
  let padL=opts.padL!=null?opts.padL:40, padR=opts.padR!=null?opts.padR:8,
      padTop=opts.padTop!=null?opts.padTop:8, padBottom=opts.padBottom!=null?opts.padBottom:8;
  if(opts.axis){ padL=Math.max(padL,54); padTop=Math.max(padTop,12); if((opts.xLabels||[]).length) padBottom=Math.max(padBottom,22); }
  let ovl='';
  const pctX=x=>(x/w*100).toFixed(2)+'%';
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
  // preserveAspectRatio="none": 기본값(xMidYMid meet)은 viewBox 가로세로비(w:h)를 유지하려고
  // 실제 컨테이너보다 훨씬 좁은 폭으로 그림을 가운데에 레터박스 처리해버려, 카드 폭이 넓을수록
  // 곡선이 화면 가운데의 좁은 영역에만 몰려 보이는 문제가 있었다. none으로 폭 전체를 채운다.
  // data-* 속성: 상대수익률 차트 등에서 마우스 좌표→값을 역산해 가까운 선을 강조할 때 쓴다
  let svg='<svg class="mlc" viewBox="0 0 '+w+' '+h+'" preserveAspectRatio="none" style="width:100%;height:'+h+'px;display:block"'+
    ' data-w="'+w+'" data-h="'+h+'" data-padl="'+padL+'" data-padr="'+padR+'" data-padt="'+padTop+'" data-padb="'+padBottom+
    '" data-min="'+min+'" data-max="'+max+'" data-n="'+n+'">';
  if(zeroLine) svg+='<line x1="'+padL+'" y1="'+yOf(0).toFixed(1)+'" x2="'+(w-padR)+'" y2="'+yOf(0).toFixed(1)+'" stroke="var(--line)" stroke-width="1" stroke-dasharray="2 3"/>';
  if(opts.axis){
    // 세로축: 최고/중간/최저 3개 지점에 보조선+값 라벨(axisFmt로 서식 지정, 기본은 소수 1자리)
    const fmtY=opts.axisFmt||(v=>v.toFixed(1));
    const ticks=(max>min)?[max,(max+min)/2,min]:[max];
    ticks.forEach(v=>{
      const y=yOf(v);
      svg+='<line x1="'+padL+'" y1="'+y.toFixed(1)+'" x2="'+(w-padR)+'" y2="'+y.toFixed(1)+'" stroke="var(--line)" stroke-width="1" stroke-dasharray="2 3"/>';
      ovl+='<span style="position:absolute;top:'+(y-7).toFixed(1)+'px;right:'+(100-(padL-6)/w*100).toFixed(2)+'%;font-size:11.5px;line-height:14px;font-weight:600;color:var(--tx2);white-space:nowrap">'+fmtY(v)+'</span>';
    });
    // 가로축: 전달받은 xLabels(시작/중간/끝 등) 위치에 날짜 라벨
    (opts.xLabels||[]).forEach(lb=>{
      const x=padL+lb.i*stepX;
      const an=lb.anchor||'middle';
      ovl+='<span style="position:absolute;top:'+(h-padBottom+4)+'px;left:'+pctX(x)+';transform:translateX('+(an==='end'?'-100%':an==='start'?'0':'-50%')+');font-size:11.5px;line-height:14px;font-weight:600;color:var(--tx2);white-space:nowrap">'+lb.text+'</span>';
    });
  }
  // 특정 인덱스에 세로 점선 기준선(예: 공모주 동종업체 비교에서 공모기업의 실제 상장일 위치)
  if(opts.vLine){
    const vx=(padL+opts.vLine.i*stepX).toFixed(1);
    const vColor=opts.vLine.color||'var(--tx2)';
    svg+='<line x1="'+vx+'" y1="'+padTop+'" x2="'+vx+'" y2="'+(h-padBottom)+'" stroke="'+vColor+'" stroke-width="1.5" stroke-dasharray="4 3"/>';
    if(opts.vLine.label){
      const nearRightEdge=(opts.vLine.i/(n-1||1))>0.6;
      ovl+='<span style="position:absolute;top:'+(padTop+1)+'px;left:'+pctX(+vx)+';transform:translateX('+(nearRightEdge?'calc(-100% - 5px)':'5px')+');font-size:11.5px;line-height:14px;font-weight:800;color:'+vColor+';white-space:nowrap">'+opts.vLine.label+'</span>';
    }
  }
  seriesArr.forEach((s,si)=>{
    if(s.area){
      const pts=s.values.map((v,i)=>v!=null?[padL+i*stepX,yOf(v)]:null).filter(Boolean);
      if(pts.length){
        const areaPath=pathOf(s.values)+' L'+pts[pts.length-1][0].toFixed(1)+','+yOf(0).toFixed(1)+' L'+pts[0][0].toFixed(1)+','+yOf(0).toFixed(1)+' Z';
        svg+='<path d="'+areaPath+'" fill="'+s.area+'" stroke="none"/>';
      }
    }
    svg+='<path class="mlc-s" data-si="'+si+'" d="'+pathOf(s.values)+'" fill="none" vector-effect="non-scaling-stroke" stroke="'+s.color+'" stroke-width="'+(s.width||2)+'"'+(s.dashed?' stroke-dasharray="5 3"':'')+(s.opacity?' opacity="'+s.opacity+'"':'')+'/>';
  });
  svg+='</svg>';
  if(ovl) svg='<div style="position:relative">'+svg+ovl.replace(/<span style="/g,'<span style="pointer-events:none;')+'</div>';
  const legend=seriesArr.filter(s=>s.label).map(s=>
    '<span style="white-space:nowrap;font-size:12.5px;color:var(--tx2)"><span style="color:'+s.color+'">'+(s.dashed?'┄':'■')+'</span> '+s.label+'</span>'
  ).join('');
  return svg+(legend?'<div style="display:flex;flex-wrap:wrap;gap:6px 12px;margin-top:4px">'+legend+'</div>':'');
}

/* 원금 100% 회수 전/후, 그리고 듀얼스나이퍼 차수별 매도 전/후를 각각 절반씩 나란히 비교한다 */
function renderPostRecoveryCharts(res){
  function fmtUSDKRW2(usd){
    if(!krwDisplayOn) return fmtUSD(usd);
    const krw=fmtKRW(usd);
    return krw?fmtUSD(usd)+' ('+krw+')':fmtUSD(usd);
  }
  /* ---- 듀얼스나이퍼 차수별(1차/2차…) 매도 전/후 비교 — SOXL 스나이퍼 포지션 가치만 비교 ---- */
  const sniperSection=document.getElementById('bt-sniper-rounds-section');
  const sniperChartsEl=document.getElementById('bt-sniper-rounds-charts');
  const sells=(res.sniperLog||[]).filter(l=>l.type==='sell');
  if(sniperSection && sniperChartsEl){
    if(!sells.length){ sniperSection.style.display='none'; }
    else{
      sniperSection.style.display='';
      let html='';
      sells.forEach((s,i)=>{
        const sellIdx=res.curve.findIndex(p=>p.t>=s.t);
        let prevIdx=i===0?0:res.curve.findIndex(p=>p.t>=sells[i-1].t);
        if(prevIdx<0) prevIdx=0;
        let nextIdx=(i+1<sells.length)?res.curve.findIndex(p=>p.t>=sells[i+1].t):res.curve.length-1;
        if(nextIdx<0) nextIdx=res.curve.length-1;
        if(sellIdx<0) return;
        const beforeSeg=res.curve.slice(prevIdx, sellIdx+1);
        const afterSeg=res.curve.slice(sellIdx, nextIdx+1);
        const rebase=(seg)=>{ const b=seg[0].sniperVal||0; return seg.map(p=>(p.sniperVal||0)-b); };
        html+='<div class="card" style="margin-top:10px">'+
          '<div class="mut" style="font-size:12px;margin-bottom:6px"><b>'+(i+1)+'차 매도</b> · '+new Date(s.t).toLocaleDateString('ko-KR')+' · '+fmtUSDKRW2(s.amount)+' 실현</div>'+
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px" class="fx-2col">'+
          '<div><div class="mut" style="font-size:11px;margin-bottom:4px">이번 매도 전</div>'+miniLineChart([{values:rebase(beforeSeg), color:'#facc15', width:2, zeroLine:true}],{h:140,zeroLine:true})+'</div>'+
          '<div><div class="mut" style="font-size:11px;margin-bottom:4px">이번 매도 후</div>'+miniLineChart([{values:rebase(afterSeg), color:'#facc15', width:2, zeroLine:true}],{h:140,zeroLine:true})+'</div>'+
          '</div></div>';
      });
      sniperChartsEl.innerHTML=html;
    }
  }
}

function renderBacktest(res){
  const statusEl=document.getElementById('bt-status');
  if(!res || res.error || !res.curve || !res.curve.length){
    const reason=(res&&res.error)?res.error.join(', ')+' 연동 실패':'알 수 없는 오류';
    if(statusEl) statusEl.textContent='⚠ '+reason+' 잠시 후 새로고침해 주세요.'+devHint('PROXY_BASE Worker 주소·배포 확인');
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

  /* 수익실현금 — 원금 100% 회수와 듀얼스나이퍼는 서로 다른 카드로 완전히 분리해서 보여준다.
     원금회수 옵션은 켰지만 아직 조건에 도달하지 못했으면(짧은 기간으로 테스트 중 등),
     현재까지의 연환산 수익률(CAGR)로 추정한 예상 회수시점·D-DAY를 대신 보여준다. */
  const recoveryCardEl2=document.getElementById('bt-realized-recovery-card');
  const sniperCardEl2=document.getElementById('bt-realized-sniper-card');
  const hasRecoveryRealized=res.recoveryEvents && res.recoveryEvents.length>0;
  const hasSniperRealized=res.sniperRealizedCash>0;
  const showProjected=res.principalRecoveryMode && !hasRecoveryRealized;
  const firstTs0=res.curve[0].t, lastTs0=res.curve[res.curve.length-1].t;
  const dayCount0=(a,b)=>Math.round((b-a)/86400000);

  if(recoveryCardEl2){
    if(hasRecoveryRealized || showProjected){
      recoveryCardEl2.style.display='';
      const recoveryBlockEl=document.getElementById('bt-realized-recovery-block');
      const projectedBlockEl=document.getElementById('bt-realized-recovery-projected-block');
      if(hasRecoveryRealized){
        if(recoveryBlockEl) recoveryBlockEl.style.display='';
        if(projectedBlockEl) projectedBlockEl.style.display='none';
        const ev=res.recoveryEvents[0];
        const recoveryEl2=document.getElementById('bt-realized-recovery');
        const detailEl=document.getElementById('bt-realized-recovery-detail');
        if(recoveryEl2) recoveryEl2.textContent=fmtUSDKRW(ev.amount);
        if(detailEl) detailEl.innerHTML=new Date(ev.t).toLocaleDateString('ko-KR')+' (D+'+dayCount0(firstTs0,ev.t).toLocaleString('ko-KR')+'일)';
      }else if(recoveryBlockEl){ recoveryBlockEl.style.display='none'; }
      if(showProjected){
        if(projectedBlockEl) projectedBlockEl.style.display='';
        const projectedEl=document.getElementById('bt-realized-recovery-projected');
        const years=(lastTs0-firstTs0)/(365*86400000);
        const ratio=res.finalCost>0?res.finalValue/res.finalCost:0;
        const cagr=(years>0.1 && ratio>0)?Math.pow(ratio,1/years)-1:null;
        if(projectedEl){
          if(cagr!=null && cagr>0 && ratio<2){
            const extraYears=Math.log(2/ratio)/Math.log(1+cagr);
            if(isFinite(extraYears) && extraYears>0 && extraYears<100){
              const projectedDate=new Date(lastTs0);
              projectedDate.setDate(projectedDate.getDate()+Math.round(extraYears*365));
              const dday=Math.round(extraYears*365);
              projectedEl.innerHTML='예상 회수시점<br><b>'+projectedDate.toLocaleDateString('ko-KR')+'</b> <span class="mut">(D-'+dday.toLocaleString('ko-KR')+'일)</span>';
            }else{
              projectedEl.innerHTML='추정 불가(현재 페이스로는 100년 내 도달 예상 어려움)';
            }
          }else{
            projectedEl.innerHTML='추정 불가(현재 수익률이 마이너스이거나 데이터가 부족합니다)';
          }
        }
      }else if(projectedBlockEl){ projectedBlockEl.style.display='none'; }
    }else{
      recoveryCardEl2.style.display='none';
    }
  }

  if(sniperCardEl2){
    if(hasSniperRealized){
      sniperCardEl2.style.display='';
      const sniperBlockEl=document.getElementById('bt-realized-sniper-block');
      if(sniperBlockEl) sniperBlockEl.style.display='';
      const sniperEl2=document.getElementById('bt-realized-sniper');
      const sniperDetailEl=document.getElementById('bt-realized-sniper-detail');
      if(sniperEl2) sniperEl2.textContent=fmtUSDKRW(res.sniperRealizedCash);
      const sniperSells=(res.sniperLog||[]).filter(l=>l.type==='sell');
      if(sniperDetailEl){
        sniperDetailEl.innerHTML=sniperSells.length
          ? sniperSells.map((s,i)=>'<b>'+(i+1)+'차</b> '+fmtUSDKRW(s.amount)+'<br><span style="font-size:11px">'+new Date(s.t).toLocaleDateString('ko-KR')+' (D+'+dayCount0(firstTs0,s.t).toLocaleString('ko-KR')+'일)</span>').join('<div style="margin:6px 0;border-top:1px dashed var(--line)"></div>')
          : '';
      }
    }else{
      sniperCardEl2.style.display='none';
    }
  }

  const bc=document.getElementById('bt-buycount'); if(bc) bc.textContent=res.buyCount+'회';
  const totalValueEl=document.getElementById('bt-total-value');
  if(totalValueEl){
    totalValueEl.textContent=(res.finalPosValue!=null && isFinite(res.finalPosValue))?fmtUSDKRW(res.finalPosValue):'계산 실패';
  }
  const costEl=document.getElementById('bt-cost'); if(costEl) costEl.textContent=fmtUSDKRW(res.finalCost);
  const dv=document.getElementById('bt-dividend'); if(dv) dv.textContent=fmtUSDKRW(res.cumDividend);

  /* [원금 100% 회수 옵션] 실제로 회수가 일어났을 때만, "회수 안 했다면?" 시나리오와 비교한
     차이를 각 카드 아래에 작게 보여준다(회수가 없었으면 diff가 0이라 자동으로 표시 안 됨). */
  /* [문구·시각화 개선] "회수 안 했다면"은 지금과 달리 원금을 계속 그대로 투자한(전액 미실현
     상태를 유지한) 가상의 시나리오다. 그냥 회색 텍스트 한 줄로만 보여주던 것을, 어떤 값인지
     헷갈리지 않도록 라벨을 명확히 하고(전액 미실현 유지 시), 점선 박스로 시각적으로 구분해
     차이(+/-)를 색상과 함께 눈에 띄게 표시한다. */
  /* [문구·시각화 개선] "회수 안 했다면"이라는 단정적 문구 대신 "계속 투자했다면(비교)"으로
     톤을 낮췄고, 금액·차이를 줄로 나눠 표시한다. 누적원금·배당금 비교는 성과 평가가 아니라
     단순 회계상 차이라 up/down(적/청) 색을 넣지 않는다 — 원금을 회수해서 누적원금이 줄어든
     것은 "나쁜 결과"가 아닌데 빨간색을 넣으면 마치 손해처럼 보이는 문제가 있었다. */
  function diffNote(actual, counterfactual, elId, neutral){
    const el=document.getElementById(elId);
    if(!el) return;
    const diff=actual-counterfactual;
    if(!hasRecoveryRealized || Math.abs(diff)<0.5){ el.innerHTML=''; return; }
    const dir=neutral?'':(diff>=0?'up':'down');
    el.innerHTML='<div style="margin-top:8px;padding:7px 10px;border-radius:8px;border:1px dashed var(--line);background:rgba(159,176,201,.06)">'+
      '<div class="mut" style="font-size:10.5px">계속 투자했다면(비교)</div>'+
      '<div style="font-size:12.5px;margin-top:4px">'+fmtUSDKRW(counterfactual)+'</div>'+
      '<div style="font-size:11.5px;margin-top:2px" class="'+dir+'">차이 '+(diff>=0?'+':'-')+fmtUSDKRW(Math.abs(diff))+'</div>'+
      '</div>';
  }
  diffNote(res.finalCost, res.noRecoveryCost, 'bt-cost-diff', true);
  diffNote(res.cumDividend, res.noRecoveryDividend, 'bt-dividend-diff', true);
  diffNote(res.annualDividendEst||0, res.noRecoveryAnnualDividendEst||0, 'bt-annual-dividend-diff', true);

  /* 원금 대비 배당률 = 누적 배당금 ÷ 누적원금 */
  const divYieldEl=document.getElementById('bt-div-yield');
  if(divYieldEl){
    const dy=res.finalCost>0?(res.cumDividend/res.finalCost*100):0;
    divYieldEl.textContent=dy.toFixed(2)+'%';
  }

  /* 연간 예상 수령 배당금(현재 보유 수량 × 최근 12개월 배당 기준) */
  const annualDivEl=document.getElementById('bt-annual-dividend');
  if(annualDivEl) annualDivEl.textContent=fmtUSDKRW(res.annualDividendEst||0);



  const roi=res.finalCost>0?(res.finalValue/res.finalCost-1)*100:0;
  const roiEl=document.getElementById('bt-roi');
  if(roiEl){
    roiEl.textContent=(roi>=0?'+':'')+roi.toFixed(1)+'%';
    roiEl.className='big '+(roi>=0?'up':'down');
  }
  const roiSub=document.getElementById('bt-roi-sub');
  if(roiSub) roiSub.innerHTML='원금 '+fmtUSDKRW(res.finalCost)+'<br>· 평가금 '+fmtUSDKRW(res.finalValue);
  { const roiDiffEl=document.getElementById('bt-roi-diff');
    if(roiDiffEl){
      const roi2=res.noRecoveryCost>0?(res.noRecoveryTotalValue/res.noRecoveryCost-1)*100:0;
      const diff=roi-roi2;
      const dir2=diff>=0?'up':'down';
      roiDiffEl.innerHTML=(hasRecoveryRealized && Math.abs(diff)>=0.1)
        ? '<div style="margin-top:8px;padding:7px 10px;border-radius:8px;border:1px dashed var(--line);background:rgba(159,176,201,.06)">'+
          '<div class="mut" style="font-size:10.5px">계속 투자했다면(비교)</div>'+
          '<div style="font-size:12.5px;margin-top:4px">'+(roi2>=0?'+':'')+roi2.toFixed(1)+'%p</div>'+
          '<div style="font-size:11.5px;margin-top:2px" class="'+dir2+'">차이 '+(diff>=0?'+':'')+diff.toFixed(1)+'%p</div>'+
          '</div>'
        : '';
    }
  }

  /* 현재 평가수익금(배당 포함) = 평가금 - 누적원금. 원금이 이미 회수됐으면 "수익실현금" 카드와
     내용이 겹치므로 이 카드는 숨긴다. */
  const profitCardEl=document.getElementById('bt-profit-card');
  if(profitCardEl) profitCardEl.style.display=hasRecoveryRealized?'none':'';
  const profitAmt=res.finalValue-res.finalCost;
  const profitEl=document.getElementById('bt-profit');
  if(profitEl){
    profitEl.textContent=(profitAmt>=0?'+':'-')+fmtUSDKRW(Math.abs(profitAmt));
    profitEl.className='big '+(profitAmt>=0?'up':'down');
  }
  const profitKrwEl=document.getElementById('bt-profit-krw');
  if(profitKrwEl) profitKrwEl.textContent='평가금(배당포함) - 누적원금';
  diffNote(profitAmt, res.noRecoveryTotalValue-res.noRecoveryCost, 'bt-profit-diff');

  /* 수익률 곡선 SVG */
  /* 평가금 곡선 패널 하나를 그린다 — 회수 전/후 두 패널이 완전히 동일한 축척(scaleMin~scaleMax)과
     동일한 벤치마크 정의를 쓰도록 공유해서, 나란히 놓았을 때 크기 비교가 왜곡되지 않게 한다. */
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
    let markers='';
    (events.sniperSells||[]).forEach((sl,i)=>{
      const idx=seg.findIndex(p=>p.t>=sl.t);
      if(idx>=0){
        const x=(padL+idx*stepX).toFixed(1);
        markers+='<line x1="'+x+'" y1="'+padTop+'" x2="'+x+'" y2="'+(h-padBottom)+'" stroke="#facc15" stroke-width="1.6" stroke-dasharray="3 2"/>'+
          '<text x="'+x+'" y="'+(h-padBottom-3)+'" font-size="8.5" fill="#facc15" text-anchor="middle">'+(events.sniperOffset?events.sniperOffset+i:i+1)+'차</text>';
      }
    });
    return '<svg viewBox="0 0 '+w+' '+h+'" style="width:100%;height:'+h+'px;display:block">'+
      yAxis+markers+
      '<path d="'+areaPath+'" fill="'+(profit?'rgba(255,77,79,.12)':'rgba(61,157,255,.12)')+'" stroke="none"/>'+
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

    /* 기간 중 최고 수익률(원금 대비 평가금, 배당 포함) 시점 탐색 — 전체 기간 기준, 분할 여부와 무관 */
    let maxRoi=-Infinity, maxRoiTs=null;
    res.curve.forEach(p=>{
      if(p.cost>0){
        const r=(p.value/p.cost-1)*100;
        if(r>maxRoi){ maxRoi=r; maxRoiTs=p.t; }
      }
    });
    if(maxRoi===-Infinity) maxRoi=0;

    const hasRec=res.recoveryEvents && res.recoveryEvents.length>0;
    const recIdx=hasRec?res.curve.findIndex(p=>p.t>=res.recoveryEvents[0].t):-1;
    const sniperSells=(res.sniperLog||[]).filter(l=>l.type==='sell');

    const legendHtml='<div style="display:flex;flex-direction:column;gap:5px;margin-top:8px;font-size:12px;color:var(--tx2);min-width:0">'+
      '<span style="white-space:nowrap"><span style="color:var(--up)">■</span> 평가금(배당포함)</span>'+
      '<span style="white-space:nowrap"><span style="color:var(--tx2)">┄</span> 누적 원금</span>'+
      '<span style="white-space:nowrap"><span style="color:#2dd4bf">┄</span> 동일 금액 QQQ(배당포함)</span>'+
      '<span style="white-space:nowrap"><span style="color:#c084fc">┄</span> 동일 금액 QLD(배당포함)</span>'+
      '<span style="white-space:nowrap"><span style="color:#facc15">┄</span> 동일 금액 TQQQ(배당포함)</span>'+
      (sniperSells.length?'<span style="white-space:nowrap"><span style="color:#facc15">┊</span> 듀얼스나이퍼 매도(차수별)</span>':'')+
      '</div>';
    const roiSummary='<div class="mut" style="margin-top:8px;font-size:12.5px">기간 중 최고 수익률: <b style="color:var(--up)">+'+maxRoi.toFixed(1)+'%</b>'+(maxRoiTs?' ('+new Date(maxRoiTs).toLocaleDateString('ko-KR')+')':'')+'</div>';

    if(hasRec && recIdx>0 && recIdx<res.curve.length-1){
      if(splitNoteEl) splitNoteEl.textContent='— 원금 회수 시점 기준 전/후로 나눠 표시(같은 축척)';
      const pre=res.curve.slice(0,recIdx+1), post=res.curve.slice(recIdx);
      const evT=res.recoveryEvents[0].t;
      const preSells=sniperSells.filter(s=>s.t<=evT);
      const postSells=sniperSells.filter(s=>s.t>=evT);
      curveEl.innerHTML='<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px" class="fx-2col">'+
        '<div><div class="mut" style="font-size:11px;margin-bottom:4px;font-weight:700">회수 전</div>'+buildEquityPanel(pre,scaleMin,scaleMax,340,220,{sniperSells:preSells})+'</div>'+
        '<div><div class="mut" style="font-size:11px;margin-bottom:4px;font-weight:700">회수 후</div>'+buildEquityPanel(post,scaleMin,scaleMax,340,220,{sniperSells:postSells, sniperOffset:preSells.length+1})+'</div>'+
        '</div>'+roiSummary+legendHtml;
    }else{
      if(splitNoteEl) splitNoteEl.textContent='';
      curveEl.innerHTML=buildEquityPanel(res.curve,scaleMin,scaleMax,700,240,{sniperSells})+roiSummary+legendHtml;
    }
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
      yAxis+
      '<path d="'+areaPath+'" fill="rgba(255,77,79,.18)" stroke="none"/>'+
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
    const hasRecDD=res.recoveryEvents && res.recoveryEvents.length>0;
    const recIdxDD=hasRecDD?res.curve.findIndex(p=>p.t>=res.recoveryEvents[0].t):-1;
    if(hasRecDD && recIdxDD>0 && recIdxDD<res.curve.length-1){
      const preDD=res.curve.slice(0,recIdxDD+1), postDD=res.curve.slice(recIdxDD);
      /* 회수 후 패널은 0%부터 다시 시작하므로, 축 스케일도 그 구간에서 실제로 필요한 만큼(전체
         스케일과 그 구간 자체 최대낙폭 중 더 큰 값)으로 잡아 값이 잘리지 않게 한다 */
      let postPeak=0; const postDDVals=postDD.map(p=>{ postPeak=Math.max(postPeak,p.value); return postPeak>0?(postPeak-p.value)/postPeak*100:0; });
      const postMaxDD=Math.max(maxDD, ...postDDVals, 1);
      ddEl.innerHTML='<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px" class="fx-2col">'+
        '<div><div class="mut" style="font-size:11px;margin-bottom:4px;font-weight:700">회수 전</div>'+buildDrawdownPanel(preDD,maxDD,340,110,false)+'</div>'+
        '<div><div class="mut" style="font-size:11px;margin-bottom:4px;font-weight:700">회수 후(0%부터 재시작)</div>'+buildDrawdownPanel(postDD,postMaxDD,340,110,true)+'</div>'+
        '</div>'+summary+ddLegend;
    }else{
      ddEl.innerHTML=buildDrawdownPanel(res.curve,maxDD,700,110,false)+summary+ddLegend;
    }
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
      yAxis+
      (qqqDiv.some(v=>v!=null)?'<path d="'+pathOf(qqqDiv)+'" fill="none" stroke="#2dd4bf" stroke-width="1.4" stroke-dasharray="6 3"/>':'')+
      (qldDiv.some(v=>v!=null)?'<path d="'+pathOf(qldDiv)+'" fill="none" stroke="#c084fc" stroke-width="1.4" stroke-dasharray="6 3"/>':'')+
      (tqqqDiv.some(v=>v!=null)?'<path d="'+pathOf(tqqqDiv)+'" fill="none" stroke="#facc15" stroke-width="1.4" stroke-dasharray="6 3"/>':'')+
      '<path d="'+pathOf(div)+'" fill="none" stroke="var(--accent)" stroke-width="2"/>'+
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
      '<span style="white-space:nowrap"><span style="color:var(--accent)">■</span> 기본전략(QLD/USD/SCHD) 배당</span>'+
      '<span style="white-space:nowrap"><span style="color:#2dd4bf">┄</span> 동일 금액 QQQ 배당</span>'+
      '<span style="white-space:nowrap"><span style="color:#c084fc">┄</span> 동일 금액 QLD 배당</span>'+
      '<span style="white-space:nowrap"><span style="color:#facc15">┄</span> 동일 금액 TQQQ 배당</span>'+
      '</div>';
    const hasRecDiv=res.recoveryEvents && res.recoveryEvents.length>0;
    const recIdxDiv=hasRecDiv?res.curve.findIndex(p=>p.t>=res.recoveryEvents[0].t):-1;
    if(hasRecDiv && recIdxDiv>0 && recIdxDiv<res.curve.length-1){
      const preDiv=res.curve.slice(0,recIdxDiv+1), postDiv=res.curve.slice(recIdxDiv);
      divCurveEl.innerHTML='<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px" class="fx-2col">'+
        '<div><div class="mut" style="font-size:11px;margin-bottom:4px;font-weight:700">회수 전</div>'+buildDividendPanel(preDiv,divScaleMax,340,180)+'</div>'+
        '<div><div class="mut" style="font-size:11px;margin-bottom:4px;font-weight:700">회수 후</div>'+buildDividendPanel(postDiv,divScaleMax,340,180)+'</div>'+
        '</div>'+divLegend;
    }else{
      divCurveEl.innerHTML=buildDividendPanel(res.curve,divScaleMax,700,200)+divLegend;
    }
  }

  renderPostRecoveryCharts(res);

  /* 연도별 수익률 */
  const yearlyEl=document.getElementById('bt-yearly-return');
  if(yearlyEl){
    const years=Object.keys(res.yearly||{}).sort();
    const yretList=years.map(y=>{
      const yr=res.yearly[y];
      const contrib=(yr.endCost-yr.startCost)+(yr.recovered||0); // 원금 회수분은 신규 매수의 반대가 아니므로 보정
      const denom=yr.startValue+contrib;
      const profitYen=yr.endValue-yr.startValue-contrib;
      return denom>0?profitYen/denom*100:0;
    });
    const bestYret=Math.max(...yretList), worstYret=Math.min(...yretList);
    yearlyEl.innerHTML=years.map((y,i)=>{
      const yr=res.yearly[y];
      const contrib=(yr.endCost-yr.startCost)+(yr.recovered||0);
      const yret=yretList[i];
      const isBest=yret===bestYret && yretList.length>1;
      const isWorst=yret===worstYret && yretList.length>1;
      const rowBg='background:'+(yret>=0?'rgba(255,77,79,':'rgba(61,157,255,')+Math.min(Math.abs(yret)/40,1)*0.22+')';
      const badge=isBest?' <span class="tag" style="background:rgba(255,176,32,.18);color:var(--accent)">최고</span>':isWorst?' <span class="tag" style="background:rgba(61,157,255,.15);color:var(--down)">최저</span>':'';
      return '<tr style="'+rowBg+'"><td>'+y+badge+(yr.recovered?' <span class="mut" style="font-size:11px">(원금 회수 발생)</span>':'')+'</td>'+
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
      /* endCost는 "누적원금(회수분 제외)" 표시용이라 회수가 있었던 달은 원가 델타가 실제
         매수 여부와 무관하게 확 줄어든다. 그 달의 "진짜 신규 매수액"과 "진짜 수익"을
         구하려면 회수액만큼 다시 더해줘야 한다(회수는 신규 매수의 반대가 아니라 별개의
         현금 인출이므로). */
      const contrib=(m.endCost-m.startCost)+(m.recovered||0);
      const denom=m.startValue+contrib;
      const profitYen=m.endValue-m.startValue-contrib;
      const mret=denom>0?profitYen/denom:0;
      const mddPct=(m.mdd||0)*100;
      const rowStyle=m.recovered?' style="background:rgba(255,176,32,.14)"':'';
      return '<tr'+rowStyle+'><td>'+mk+(m.recovered?' <span class="mut" style="font-size:11px">💰 원금 회수 발생</span>':'')+'</td>'+
        '<td class="num">'+fmtUSDKRW(contrib)+'</td>'+
        '<td class="num">'+fmtUSDKRW(m.endCost)+'</td>'+
        '<td class="num">'+m.buys+'회</td>'+
        '<td class="num down">-'+mddPct.toFixed(1)+'%</td>'+
        '<td class="num">'+fmtUSDKRW(m.endValue)+'</td>'+
        '<td class="num '+(profitYen>=0?'up':'down')+'">'+(profitYen>=0?'+':'-')+fmtUSDKRW(Math.abs(profitYen))+'</td>'+
        '<td class="num '+(mret>=0?'up':'down')+'">'+(mret*100>=0?'+':'')+(mret*100).toFixed(2)+'%</td></tr>';
    }).join('');
  }

  /* 듀얼스나이퍼 월별 매매기록 — 옵션이 켜져 있을 때만 표시 */
  const sniperSectionEl=document.getElementById('bt-sniper-monthly-section');
  if(sniperSectionEl){
    if(res.dualSniperMode && res.monthlySniper){
      sniperSectionEl.style.display='';
      const sTbody=document.getElementById('bt-sniper-monthly');
      const sMonths=Object.keys(res.monthlySniper).sort().filter(mk=>{
        const s=res.monthlySniper[mk]; return s.buys>0 || s.sells.length>0;
      });
      let cumSniperSpend=0;
      if(sTbody){
        sTbody.innerHTML=sMonths.length?sMonths.map(mk=>{
          const s=res.monthlySniper[mk];
          cumSniperSpend+=s.spend;
          const rowStyle=s.sells.length?' style="background:rgba(255,176,32,.14)"':'';
          const sellTxt=s.sells.length
            ? s.sells.map(sl=>fmtUSDKRW(sl.amount)+' ('+new Date(sl.t).toLocaleDateString('ko-KR')+')').join(', ')
            : '<span class="mut">--</span>';
          return '<tr'+rowStyle+'><td>'+mk+(s.sells.length?' <span class="mut" style="font-size:11px">💰 매도 발생</span>':'')+'</td>'+
            '<td class="num">'+fmtUSDKRW(cumSniperSpend)+'</td>'+
            '<td class="num">'+s.buys+'회</td>'+
            '<td>'+sellTxt+'</td></tr>';
        }).join(''):'<tr><td class="mut" colspan="4">아직 매수·매도 조건이 발동한 달이 없습니다.</td></tr>';
      }
    }else{
      sniperSectionEl.style.display='none';
    }
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
  score=Math.round(score);
  if(score<25) return '극단적 공포';
  if(score<45) return '공포';
  if(score<=55) return '중립';
  return '탐욕';
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
  const slBody=document.getElementById('bt-admin-sniperlog');
  if(slBody){
    const rows=res.sniperLog||[];
    let cumQty2=0, cumAmt2=0;
    slBody.innerHTML=rows.length?rows.map(r=>{
      if(r.type==='buy'){ cumQty2+=r.qty; cumAmt2+=r.amount; }
      else{ cumQty2-=r.qty; }
      return '<tr><td>'+new Date(r.t).toLocaleDateString('ko-KR')+'</td><td class="'+(r.type==='sell'?'up':'')+'">'+(r.type==='buy'?'매수':'매도')+'</td>'+
      '<td class="num">'+r.qty.toFixed(2)+'</td><td class="num">'+cumQty2.toFixed(2)+'</td>'+
      '<td class="num">'+fmtUSD(r.price)+'</td>'+
      '<td class="num">'+(r.type==='buy'?fmtUSD(r.amount):'<span class="mut">--</span>')+'</td>'+
      '<td class="num">'+(r.type==='buy'?fmtUSD(cumAmt2):'<span class="mut">--</span>')+'</td>'+
      '<td class="num '+(r.type==='sell'?'up':'')+'">'+(r.type==='sell' && r.profit!=null?(r.profit>=0?'+':'-')+fmtUSD(Math.abs(r.profit)):'<span class="mut">--</span>')+'</td></tr>';
    }).join(''):'<tr><td class="mut" colspan="8">듀얼스나이퍼 옵션이 꺼져 있거나 아직 매매 기록이 없습니다.</td></tr>';
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
   클라이언트 사이드 체크일 뿐이라 실제 보안 기능은 아니며, 화면 노출만 막는 용도다. */
const ADMIN_PASSWORD='coolzet!!!';
function initTradeAdminPanel(){
  const btn=document.getElementById('bt-admin-btn');
  const panel=document.getElementById('bt-admin-panel');
  if(!btn || !panel) return;
  btn.addEventListener('click',()=>{
    if(panel.style.display!=='none'){ panel.style.display='none'; btn.textContent='관리자 페이지'; return; }
    const pw=prompt('관리자 비밀번호를 입력하세요');
    if(pw===null) return;
    if(pw===ADMIN_PASSWORD){
      panel.style.display='';
      btn.textContent='관리자 페이지 닫기';
      if(lastBacktestResult) renderAdminTables(lastBacktestResult);
      panel.scrollIntoView({behavior:'smooth', block:'start'});
    }else{
      alert('비밀번호가 올바르지 않습니다.');
    }
  });
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
  navToggle.addEventListener('click',()=>{ const o=navMenu.classList.toggle('open'); navToggle.setAttribute('aria-expanded',o?'true':'false'); navToggle.setAttribute('aria-label',o?'메뉴 닫기':'메뉴 열기'); });
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

/* ===== 공모주 상장완료 종목 시세 시각화 (한국지수 종목과 동일한 스파크라인·등락률·최고/최저) =====
   Yahoo 일봉(.KQ/.KS 순차 시도). 상장 직후라 데이터가 30개 미만이어도 표시한다.
   상장 1년 미만이면 '상장 후', 1년 이상이면 '52주' 최고/최저. */
async function ipoQuoteFetch(code, market, name){
  /* 1순위: Worker(/ipo-quote, 네이버 일봉) — 스팩·신규상장 포함 국내 전 종목. 종목코드가 없으면 종목명으로 찾는다. */
  try{
    const base=PROXY_BASE.replace(/\?url=$/,'');
    const r=await fetch(base+'/ipo-quote?code='+encodeURIComponent(code||'')+'&name='+encodeURIComponent(name||''));
    if(r.ok){ const j=await r.json(); if(j&&j.rows&&j.rows.length>=1) return {sym:j.code, rows:j.rows}; }
  }catch(e){}
  /* 2순위: Yahoo 일봉(.KQ/.KS) */
  if(!code) return null;
  const order=/코스닥/.test(market||'')?['.KQ','.KS']:['.KS','.KQ'];
  for(const suf of order){
    const j=await getJSON('https://query1.finance.yahoo.com/v8/finance/chart/'+code+suf+'?range=1y&interval=1d');
    try{
      const r=j.chart.result[0], q=r.indicators.quote[0], ts=r.timestamp;
      const rows=[];
      for(let i=0;i<ts.length;i++){ if(q.close[i]!=null) rows.push({o:q.open&&q.open[i]!=null?q.open[i]:q.close[i],c:q.close[i],h:q.high&&q.high[i]!=null?q.high[i]:q.close[i],l:q.low&&q.low[i]!=null?q.low[i]:q.close[i],t:ts[i]}); }
      if(rows.length>=1) return {sym:code+suf, rows:rows};
    }catch(e){}
  }
  return null;
}


/* 청약 전·진행 중 종목 일정 D-day 시각화: 수요예측 → 청약 → 환불/납입 → 상장 타임라인 */
function ipoParseRange(txt, defY){
  const t=String(txt||'');
  const m=t.match(/(?:(\d{4})\s*[\/.\-]\s*)?(\d{1,2})\s*[\/.\-]\s*(\d{1,2})(?:[^\d~]*~[^\d]*(?:(\d{4})\s*[\/.\-]\s*)?(?:(\d{1,2})\s*[\/.\-]\s*)?(\d{1,2}))?/);
  if(!m) return null;
  const y1=+(m[1]||defY), mo1=+m[2], d1=+m[3];
  const s=new Date(y1,mo1-1,d1);
  let e=s;
  if(m[6]){ const y2=+(m[4]||y1), mo2=m[5]?+m[5]:mo1; e=new Date(y2,mo2-1,+m[6]); }
  return {s:s,e:e};
}
function ipoScheduleHtml(item){
  const now=new Date(Date.now()+(new Date().getTimezoneOffset()+540)*60000); now.setHours(0,0,0,0);
  const yy=now.getFullYear();
  const sub=ipoParseRange(item.subscDate,yy);
  const pre=ipoParseRange(item.predictPeriod||'',yy);
  const ref=ipoParseRange(item.refundDate||'',yy);
  const pay=ipoParseRange(item.payDate||'',yy);
  const lst=ipoParseRange(item.listDate||'',yy);
  const steps=[];
  if(pre) steps.push({nm:'수요예측',a:pre.s,b:pre.e,ic:'📋'});
  if(sub) steps.push({nm:'청약',a:sub.s,b:sub.e,ic:'✍️'});
  if(ref||pay){ const r=ref||pay; steps.push({nm:'환불·납입',a:r.s,b:r.e,ic:'💳'}); }
  if(lst) steps.push({nm:'상장',a:lst.s,b:lst.s,ic:'🔔'});
  if(!steps.length) return '';
  const dd=d=>Math.round((d-now)/86400000);
  const f=d=>(d.getMonth()+1)+'/'+d.getDate();
  steps.forEach(st=>{
    const ds=dd(st.a), de=dd(st.b);
    st.state= de<0?'done': ds<=0?'now':'next';
    st.ds=ds; st.de=de;
  });
  const nxt=steps.find(st=>st.state==='now')||steps.find(st=>st.state==='next');
  let pill='';
  if(nxt){
    const now_=nxt.state==='now';
    const cls=now_?'now':(nxt.ds<=3?'soon':'next');
    pill='<div class="ips-pill '+cls+'"><small>'+nxt.ic+' '+nxt.nm+(now_?' 진행 중':'')+'</small><b>'+(now_?(nxt.de===0?'오늘 마감':'D-'+nxt.de+' 마감'):(nxt.ds===0?'D-DAY':'D-'+nxt.ds))+'</b></div>';
  }
  const line=steps.map(st=>{
    const dtxt=st.state==='done'?'완료':st.state==='now'?'진행 중':'D-'+st.ds;
    return '<div class="ips-st '+st.state+'"><i></i><span>'+st.nm+'</span><em>'+f(st.a)+(st.b>st.a?'~'+f(st.b):'')+'</em><b>'+dtxt+'</b></div>';
  }).join('');
  return '<div class="ips">'+pill+'<div class="ips-tl">'+line+'</div></div>'+ipoSubscribeInfoHtml(item);
}
function ipoSubscribeInfoHtml(item){
  const num=t=>{ const m=String(t||'').match(/\d[\d,]*/); return m?parseInt(m[0].replace(/,/g,''),10):null; };
  const price=num(item.offerPriceFinal)||num(item.offerPriceBand);
  const r=item.subRule||{};
  const minSh=r.minShares||10, rate=r.marginRate!=null?r.marginRate:50;
  const won=n=>Math.round(n).toLocaleString('ko-KR')+'원';
  const uw=item.underwriter?String(item.underwriter).replace(/\s*[,/]\s*/g,' · '):'미정';
  const kv=(k,v,sub)=>'<div><small>'+k+'</small><b>'+v+'</b>'+(sub?'<em>'+sub+'</em>':'')+'</div>';
  return '<div class="ips-info">'+kv('주간사',uw)+kv('최소청약',minSh.toLocaleString('ko-KR')+'주',r.minShares?'공고 기준':'통상 단위')+
    kv('필요 증거금',price?won(price*minSh*rate/100):'공모가 확정 후',price?'증거금 '+rate+'% · 주문 '+won(price*minSh):'증거금율 '+rate+'%')+(r.maxShares?kv('청약 한도',r.maxShares+'주'):'')+'</div>';
}

/* 보호예수 해제 일정(상장일 기준 15일·1개월·3개월·6개월…) — 경과(해제 완료)/예정(D-day) 시각화 */
function ipoLockupHtml(sched, listDate, lockRatio, qrows, offer){
  if(!sched||!sched.length){
    const lr=parseFloat(String(lockRatio==null?'':lockRatio).replace(/[^\d.]/g,''));
    return '<div style="margin-top:2px"><div style="font-size:11px;color:var(--tx2);margin-bottom:5px">🔒 보호예수·의무보유확약</div>'+
      (isFinite(lr)?'<div style="display:flex;align-items:center;gap:8px;font-size:12.5px"><span>기관 의무보유확약</span><div style="flex:1;height:10px;border-radius:5px;background:var(--panel2);max-width:260px"><div style="height:10px;border-radius:5px;width:'+Math.min(100,lr)+'%;background:var(--accent)"></div></div><b>'+lr.toFixed(2)+'%</b></div>':'')+
      '<div class="mut" style="font-size:11px;margin-top:4px">1·3·6개월 해제 일정(ipostock 주주구성)을 가져오지 못했습니다. 잠시 후 다시 확인해 주세요.</div></div>';
  }
  const m=String(listDate||'').match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
  if(!m) return '';
  const base=new Date(+m[1],+m[2]-1,+m[3]);
  const now=new Date(Date.now()+ (new Date().getTimezoneOffset()+540)*60000); now.setHours(0,0,0,0);
  const fmtSh=n=>n>=10000?(Math.round(n/100)/100).toLocaleString('ko-KR')+'만주':n.toLocaleString('ko-KR')+'주';
  const maxPct=Math.max.apply(null,sched.map(o=>o.pct))||1;
  const chips=sched.map(o=>{
    const isMax=o.pct===maxPct;
    const d=new Date(base.getTime());
    if(o.months) d.setMonth(d.getMonth()+o.months); else d.setDate(d.getDate()+o.days);
    const diff=Math.round((d-now)/86400000);
    const done=diff<=0;
    const col=done?'var(--tx2)':(diff<=14?'var(--up)':'var(--accent)');
    const ds=(d.getMonth()+1)+'/'+d.getDate();
    // 해제일 종가·공모가 대비 수익률 (해제일이 지난 경우: 해제일 이전 마지막 거래일 종가)
    let cl=null;
    if(done&&qrows&&qrows.length){
      const lim=Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())/1000+86400-1;
      for(let i=qrows.length-1;i>=0;i--){ if(qrows[i].t<=lim){ cl=qrows[i].c; break; } }
    }
    const cr=(cl!=null&&offer)?(cl/offer-1)*100:null;
    const priceLine=done
      ? (cl!=null?'<div style="font-size:11.5px;margin-top:3px;white-space:nowrap">종가 <b>'+cl.toLocaleString('ko-KR')+'원</b>'+(cr!=null?'<br><b style="color:'+(cr>=0?'var(--up)':'var(--down)')+'">공모가比 '+(cr>=0?'+':'')+cr.toFixed(1)+'%</b>':'')+'</div>':'<div style="font-size:11px;color:var(--tx2);margin-top:3px">종가 —</div>')
      : '<div style="font-size:11px;color:var(--tx2);margin-top:3px">종가 해제 후 표시</div>';
    return '<div style="flex:1 1 118px;min-width:118px;padding:7px 8px;border-radius:10px;border:'+(isMax?'2.5px solid #f0a400':'1.5px solid '+(done?'var(--line)':col))+';background:'+(isMax?'rgba(240,164,0,.12)':done?'rgba(127,127,127,.08)':'var(--panel)')+';opacity:'+(done?.9:1)+'">'+
      '<div style="display:flex;justify-content:space-between;align-items:center;gap:4px;white-space:nowrap"><b style="font-size:12.5px">'+o.label+(isMax?' <span style="font-size:11px;color:#c77d00">🔥최대</span>':'')+'</b>'+
        '<span style="font-size:10.5px;font-weight:800;color:'+(done?'var(--tx2)':'#fff')+';background:'+(done?'transparent':col)+';border-radius:8px;padding:1px 6px">'+(done?'✓ 경과':'D-'+diff)+'</span></div>'+
      '<div style="font-size:13px;font-weight:800;margin-top:3px;color:'+col+';white-space:nowrap">'+fmtSh(o.shares)+'</div>'+
      '<div style="font-size:12px;font-weight:700;color:'+col+'">('+o.pct.toFixed(2)+'%)</div>'+
      '<div style="height:5px;border-radius:3px;background:var(--panel2);margin:4px 0 3px"><div style="height:5px;border-radius:3px;width:'+Math.min(100,o.pct/maxPct*100).toFixed(0)+'%;background:'+(isMax?'#f0a400':col)+'"></div></div>'+
      '<div style="font-size:10.5px;color:var(--tx2)">해제일 '+d.getFullYear()+'/'+ds+'</div>'+priceLine+'</div>';
  }).join('');
  // 일자별 타임라인: 상장일 ~ 마지막 해제일, 해제 시점마다 마커(경과=회색, 예정=색)와 해제 비율
  const pts=sched.map(o=>{ const d=new Date(base.getTime()); if(o.months) d.setMonth(d.getMonth()+o.months); else d.setDate(d.getDate()+o.days); return {o:o,d:d,off:Math.round((d-base)/86400000)}; });
  const span=Math.max(1,pts[pts.length-1].off), todayOff=Math.max(0,Math.min(span,Math.round((now-base)/86400000)));
  const totalPct=sched.reduce((a,o)=>a+o.pct,0);
  const tl='<div style="position:relative;height:46px;margin:6px 10px 4px">'+
    '<div style="position:absolute;left:0;right:0;top:20px;height:6px;border-radius:3px;background:var(--panel2)"></div>'+
    '<div style="position:absolute;left:0;top:20px;height:6px;border-radius:3px;background:var(--accent);width:'+(todayOff/span*100).toFixed(1)+'%"></div>'+
    pts.map(pt=>{ const x=pt.off/span*100, done=pt.d<=now; const diff=Math.round((pt.d-now)/86400000);
      return '<div style="position:absolute;left:'+x.toFixed(1)+'%;top:0;transform:translateX(-50%);text-align:center;white-space:nowrap">'+
        '<div style="font-size:10px;font-weight:800;color:'+(done?'var(--tx2)':'var(--up)')+'">'+pt.o.label+'</div>'+
        '<i style="display:block;width:12px;height:12px;border-radius:50%;margin:3px auto 0;background:'+(done?'var(--tx2)':'var(--up)')+';border:2px solid var(--panel)"></i>'+
        '<div style="font-size:9.5px;color:var(--tx2);margin-top:2px">'+(done?'해제':'D-'+diff)+'</div></div>'; }).join('')+
    '</div>';
  return '<div style="flex:1 1 100%;margin-top:2px"><div style="font-size:11px;color:var(--tx2);margin-bottom:5px">🔒 보호예수 해제 일정 (상장일 '+(base.getMonth()+1)+'/'+base.getDate()+' 기준 · 경과/예정 · 보호예수 합계 '+totalPct.toFixed(1)+'%)</div>'+
    '<div style="display:flex;flex-wrap:wrap;gap:6px">'+chips+'</div></div>';
}
/* 상장일 이후 시세 분석 — 공모가 대비 최고가 수익률, 상한가(전일比 +29.5%↑, 상장일은 공모가×4 근접) 일수, 상장일 공모가 대비 등락 */
function ipoQuoteStats(rows, offer, listDate){
  const m=String(listDate||'').match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
  let r=rows;
  if(m){
    const ld=Date.UTC(+m[1],+m[2]-1,+m[3])/1000;
    const cut=rows.filter(x=>x.t>=ld-3600*12);
    if(cut.length) r=cut;
  }
  const first=r[0];
  const st={rows:r, firstDay:null, maxHigh:Math.max.apply(null,r.map(x=>x.h)), limitUp:0, flags:[]};
  r.forEach((x,i)=>{
    const prev=i>0?r[i-1].c:null;
    let lim=false;
    if(i===0){ if(offer) lim = x.c>=offer*3.95; }
    else lim = x.c/prev-1>=0.295;
    if(lim) st.limitUp++;
    st.flags.push({lim:lim, chg:prev?(x.c/prev-1)*100:(offer?(x.c/offer-1)*100:0)});
  });
  if(offer&&first){ st.firstDay={open:first.o!=null?first.o:first.c, close:first.c}; }
  st.offer=offer||null;
  return st;
}
/* 카드 머리(종목명과 추천 판단 사이) 가운데: 현재가·등락률 + 스파크라인 (한국지수 표와 같은 표기) */
function ipoQuoteMidHtml(d){
  const rows=d.rows, closes=rows.map(r=>r.c), last=closes[closes.length-1], prev=closes.length>1?closes[closes.length-2]:last;
  const chg=(last/prev-1)*100, up=chg>=0, col=up?'var(--up)':'var(--down)';
  return '<div style="text-align:right"><div style="font-size:19px;font-weight:900;line-height:1.1">'+fmtWon(last)+'</div>'+
    '<div style="font-size:12.5px;font-weight:800;color:'+col+'">'+(up?'▲ +':'▼ ')+chg.toFixed(2)+'%</div></div>'+sparkSVG(closes.slice(-30));
}
function injectIpoQuoteCss(){
  if(document.getElementById('ipoq-css')) return;
  const st=document.createElement('style'); st.id='ipoq-css';
  st.textContent='.ipq{display:grid;gap:10px;min-width:0}'+
  '.ipq-kpi{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}'+
  '.ipq-kpi>div{min-width:0;padding:10px 12px;border:1px solid var(--line);border-left:4px solid var(--line);border-radius:8px;background:var(--panel)}'+
  '.ipq-kpi>div.up{border-left-color:var(--up)}.ipq-kpi>div.dn{border-left-color:var(--down)}'+
  '.ipq-kpi small{display:block;font-size:11.5px;color:var(--tx2);white-space:nowrap}'+
  '.ipq-kpi b{display:block;font-size:19px;font-weight:900;line-height:1.3;white-space:nowrap}'+
  '.ipq-kpi em{display:block;font-style:normal;font-size:11.5px;color:var(--tx2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'+
  '.ipq-cols{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);gap:10px;align-items:start}'+
  '.ipq-rt{display:grid;gap:10px;min-width:0}'+
  '.ipq-p{min-width:0;border:1px solid var(--line);border-radius:8px;background:var(--panel);overflow:hidden}'+
  '.ipq-p>h5{margin:0;padding:7px 12px;font-size:12.5px;font-weight:800;background:var(--panel2);border-bottom:1px solid var(--line);display:flex;justify-content:space-between;align-items:center;gap:8px}'+
  '.ipq-p>h5 span{font-weight:500;color:var(--tx2);font-size:11.5px}'+
  '.ipq-p>.b{padding:10px 12px}'+
  '.ipq-br{display:grid;grid-template-columns:78px minmax(0,1fr) 92px;gap:8px;align-items:center;padding:5px 0}'+
  '.ipq-br+.ipq-br{border-top:1px dashed var(--line)}'+
  '.ipq-br .k{font-size:12px;color:var(--tx2);font-weight:700;white-space:nowrap}'+
  '.ipq-br .tr{position:relative;height:14px;background:var(--panel2);border-radius:3px}'+
  '.ipq-br .tr b{position:absolute;top:2px;bottom:2px;border-radius:2px;min-width:2px}'+
  '.ipq-br .tr i{position:absolute;top:-2px;bottom:-2px;width:0;border-left:2px solid var(--tx2)}'+
  '.ipq-br .v{text-align:right;font-size:14px;font-weight:900;white-space:nowrap}'+
  '.ipq-br .v small{display:block;font-size:10.5px;font-weight:500;color:var(--tx2)}'+
  '.ipq-pos{position:relative;height:12px;border-radius:6px;background:linear-gradient(90deg,var(--down),var(--gold),var(--up))}'+
  '.ipq-pos i{position:absolute;top:-4px;width:5px;height:20px;border-radius:2px;background:var(--tx);transform:translateX(-50%)}'+
  '.ipq-lbl{display:flex;justify-content:space-between;gap:6px;font-size:12px;margin-top:8px;color:var(--tx2);white-space:nowrap}'+
  '.ipq-note{font-size:11.5px;color:var(--tx2);margin-top:6px;line-height:1.5}'+
  '.ipq-strip{display:flex;gap:2px;flex-wrap:wrap}.ipq-strip i{width:10px;height:18px;border-radius:2px;display:block}'+
  '@media(max-width:700px){.ipq-kpi{grid-template-columns:1fr 1fr}.ipq-kpi>div:last-child{grid-column:1/-1}.ipq-cols{grid-template-columns:minmax(0,1fr)}.ipq-br{grid-template-columns:70px minmax(0,1fr) 84px}}';
  document.head.appendChild(st);
}
function ipoQuoteHtml(d, offer, listDate){
  injectIpoQuoteCss();
  const st=ipoQuoteStats(d.rows, offer, listDate);
  const rows=st.rows, closes=rows.map(r=>r.c), last=closes[closes.length-1];
  const hi=Math.max.apply(null,rows.map(r=>r.h)), lo=Math.min.apply(null,rows.map(r=>r.l));
  const pos=hi>lo?Math.max(0,Math.min(100,(last-lo)/(hi-lo)*100)):50;
  const spanDays=(rows[rows.length-1].t-rows[0].t)/86400;
  const lbl=spanDays<340?'상장 후':'52주';
  const fromHi=(last/hi-1)*100;
  const pc=v=>(v>=0?'+':'')+v.toFixed(1)+'%';
  const cc=v=>v>=0?'var(--up)':'var(--down)';
  const shown=st.flags.slice(-45);
  const upDays=st.flags.filter(f=>f.chg>0.05).length, dnDays=st.flags.filter(f=>f.chg<-0.05).length;
  const strip='<div class="ipq-strip">'+shown.map(f=>{
    const bg=f.lim?'#c4251c':f.chg>0.05?'rgba(229,51,42,.32)':f.chg<-0.05?'rgba(26,111,168,.4)':'rgba(127,127,127,.28)';
    return '<i title="'+f.chg.toFixed(1)+'%" style="background:'+bg+(f.lim?';box-shadow:0 0 5px #e5332a99':'')+'"></i>';
  }).join('')+'</div>';
  let kpi='', bars='';
  if(offer&&st.firstDay){
    const o=st.firstDay.open, c=st.firstDay.close;
    const now=(last/offer-1)*100, p=(c/offer-1)*100, po=(o/offer-1)*100, peak=(st.maxHigh/offer-1)*100;
    let hiIdx=0; rows.forEach((r,ix)=>{ if(r.h>=st.maxHigh) hiIdx=ix; });
    const dN=Math.round((rows[hiIdx].t-rows[0].t)/86400);
    kpi='<div class="ipq-kpi"><div><small>공모가</small><b>'+fmtWon(offer)+'</b><em>상장 기준가</em></div>'+
      '<div class="'+(now>=0?'up':'dn')+'"><small>현재 수익률</small><b style="color:'+cc(now)+'">'+pc(now)+'</b><em>현재가 '+fmtWon(last)+'</em></div>'+
      '<div class="'+(peak>=0?'up':'dn')+'"><small>최고가 (상장 D+'+dN+')</small><b>'+fmtWon(st.maxHigh)+'</b><em style="color:'+cc(peak)+'">공모가 대비 '+pc(peak)+'</em></div></div>';
    const items=[['시초가 마감',po,o],['종가 마감',p,c],['현재',now,last],['상장 후 최고',peak,st.maxHigh]];
    const vals=items.map(x=>x[1]), mn=Math.min.apply(null,vals.concat(0)), mx=Math.max.apply(null,vals.concat(0)), sp=(mx-mn)||1, z=(0-mn)/sp*100;
    bars='<div class="ipq-p"><h5>공모가 대비 수익률 <span>0선 = 공모가</span></h5><div class="b">'+items.map(it=>{
      const v=it[1], l=Math.min(z,(v-mn)/sp*100), w=Math.abs(v)/sp*100;
      return '<div class="ipq-br"><span class="k">'+it[0]+'</span><div class="tr"><i style="left:'+z.toFixed(1)+'%"></i><b style="left:'+l.toFixed(1)+'%;width:'+w.toFixed(1)+'%;background:'+cc(v)+'"></b></div><span class="v" style="color:'+cc(v)+'">'+pc(v)+'<small>'+fmtWon(it[2])+'</small></span></div>';
    }).join('')+'</div></div>';
  }
  const posBox='<div class="ipq-p"><h5>📊 '+lbl+' 최저 ~ 최고 위치 <span>범위 내 '+pos.toFixed(0)+'%</span></h5><div class="b"><div class="ipq-pos"><i style="left:'+pos.toFixed(1)+'%"></i></div>'+
    '<div class="ipq-lbl"><span>최저 '+fmtWon(lo)+'</span><span>최고 '+fmtWon(hi)+'</span></div><div class="ipq-note">고점 대비 '+fromHi.toFixed(1)+'%</div></div></div>';
  const limBox='<div class="ipq-p"><h5>🔺 상한가 일수 · 일별 변화 <span style="font-size:15px;font-weight:900;color:'+(st.limitUp?'var(--up)':'var(--tx2)')+'">'+st.limitUp+'일</span></h5><div class="b">'+strip+
    '<div class="ipq-note">상장 후 '+st.flags.length+'거래일 · <span style="color:var(--up)">상승 '+upDays+'일</span> · <span style="color:var(--down)">하락 '+dnDays+'일</span> · 진한 빨강=상한가</div></div></div>';
  return '<div class="ipq">'+kpi+'<div class="ipq-cols">'+(bars||'')+'<div class="ipq-rt">'+posBox+limBox+'</div></div></div>';
}
const IPOQ_CACHE={};
async function hydrateIpoQuotes(){
  const els=document.querySelectorAll('[data-ipoq]');
  for(const el of els){
    const offer=(function(){ const mm=String(el.getAttribute('data-offer')||'').match(/\d[\d,]*/); return mm?parseInt(mm[0].replace(/,/g,''),10):null; })();
    let code=el.getAttribute('data-ipoq'); const mk=el.getAttribute('data-mk'), nm=el.getAttribute('data-nm');
    try{
      const ck=code||nm; if(!(ck in IPOQ_CACHE)) IPOQ_CACHE[ck]=await ipoQuoteFetch(code,mk,nm);
      const d=IPOQ_CACHE[ck];
      let lk=''; try{
        let sched=JSON.parse(el.getAttribute('data-lock')||'null');
        if((!sched||!sched.length)&&PROXY_BASE&&nm){
          try{ const o=PROXY_BASE.replace(/\?url=$/,''); const rr=await fetch(o+'ipo-lockup?name='+encodeURIComponent(nm),{signal:AbortSignal.timeout?AbortSignal.timeout(20000):undefined}); const jj=rr.ok?await rr.json():null; if(jj&&jj.schedule) sched=jj.schedule; }catch(e){}
        }
        lk=ipoLockupHtml(sched, el.getAttribute('data-ld'), el.getAttribute('data-lr'), d&&d.rows, offer);
      }catch(e){}
      try{ if(d&&offer){ const stt=ipoQuoteStats(d.rows,offer,el.getAttribute('data-ld')); const nmEl=el.closest('.ipo-card')&&el.closest('.ipo-card').querySelector('.ipo-name'); if(nmEl&&stt.firstDay&&stt.firstDay.close<offer&&!nmEl.parentNode.querySelector('.ipo-below')){ const b=document.createElement('span'); b.className='ipo-market ipo-below'; b.style.cssText='background:rgba(26,111,168,.15);color:var(--down);font-weight:800'; b.textContent='공모가 하회'; nmEl.parentNode.insertBefore(b,nmEl.parentNode.querySelector('.ipo-dates')); } } }catch(e){}
      try{
        if(d&&d.rows&&d.rows.length>=6){
          const cl=d.rows.map(r=>r.c), nmEl2=el.closest('.ipo-card')&&el.closest('.ipo-card').querySelector('.ipo-name');
          if(nmEl2&&!nmEl2.parentNode.querySelector('.wl-ind')){
            injectTechBadgeCss();
            const html=techBadgesHtml(cl,6), sig=valuationSignal(cl,15);
            if(html){ const box=document.createElement('span'); box.className='wl-ind'; box.style.marginLeft='8px'; box.innerHTML=html; nmEl2.parentNode.insertBefore(box,nmEl2.nextSibling); }
            if(sig){ const sg=document.createElement('span'); sg.className='wl-sig'; sg.textContent=sig.icon; sg.title=sig.tip; nmEl2.parentNode.insertBefore(sg,nmEl2); }
          }
        }
      }catch(e){}
      try{ const midEl=el.closest('.ipo-card')&&el.closest('.ipo-card').querySelector('.ipo-mid'); if(midEl&&d) midEl.innerHTML=ipoQuoteMidHtml(d); }catch(e){}
      el.innerHTML=(d?ipoQuoteHtml(d,offer,el.getAttribute('data-ld')):'<span class="mut" style="font-size:11.5px">시세를 불러오지 못했습니다.</span>')+(lk?'<div style="margin-top:10px">'+lk+'</div>':'');
    }catch(e){ el.innerHTML='<span class="mut" style="font-size:11.5px">시세를 불러오지 못했습니다.</span>'; }
  }
}

/* ================= 가상화폐: 공포탐욕지수 추이 차트 / 코인 스파크라인 / 레인보우 차트 ================= */
(function(){
  if(!document.getElementById('cf-trend')) return;
  const $q=s=>document.querySelector(s);
  const fmtD=ts=>{const d=new Date(ts*1000);return (d.getMonth()+1)+'.'+String(d.getDate()).padStart(2,'0');};
  const fmtFull=ts=>{const d=new Date(ts*1000);return d.getFullYear()+'.'+String(d.getMonth()+1).padStart(2,'0')+'.'+String(d.getDate()).padStart(2,'0');};

  /* ---- 1) 공포·탐욕지수 추이 차트 ---- */
  const ZONES=[[0,25,'#ff4d4f','극단적 공포'],[25,45,'#ff8a00','공포'],[45,55,'#9aa4b2','중립'],[55,75,'#7bc043','탐욕'],[75,100,'#22a34a','극단적 탐욕']];
  function drawCFChart(p){
    const el=document.getElementById('cf-trend'); if(!el||!cfData||!cfData.length) return;
    const days={d:30,w:90,m:180,y:365}[p]||90;
    const arr=cfData.slice(0,days).slice().reverse();
    if(arr.length<2) return;
    const W=640,H=230,L=34,R=10,T=10,B=24,cw=W-L-R,ch=H-T-B;
    const X=i=>L+i*cw/(arr.length-1), Y=v=>T+ch-(v/100)*ch;
    let s='<svg viewBox="0 0 '+W+' '+H+'" style="width:100%;height:auto;display:block;touch-action:pan-y">';
    ZONES.forEach(z=>{s+='<rect x="'+L+'" y="'+Y(z[1]).toFixed(1)+'" width="'+cw+'" height="'+((z[1]-z[0])/100*ch).toFixed(1)+'" fill="'+z[2]+'" opacity=".13"/>';});
    [0,25,50,75,100].forEach(v=>{s+='<line x1="'+L+'" x2="'+(W-R)+'" y1="'+Y(v)+'" y2="'+Y(v)+'" stroke="var(--line)" stroke-width="1"/><text x="'+(L-6)+'" y="'+(Y(v)+4)+'" text-anchor="end" font-size="11" fill="var(--tx2)">'+v+'</text>';});
    const n=Math.min(5,arr.length);
    for(let k=0;k<n;k++){const i=Math.round(k*(arr.length-1)/(n-1));s+='<text x="'+X(i).toFixed(1)+'" y="'+(H-6)+'" text-anchor="'+(k===0?'start':k===n-1?'end':'middle')+'" font-size="11" fill="var(--tx2)">'+fmtD(arr[i].t)+'</text>';}
    const d=arr.map((x,i)=>(i?'L':'M')+X(i).toFixed(1)+','+Y(x.v).toFixed(1)).join(' ');
    const last=arr[arr.length-1];
    s+='<path d="'+d+'" fill="none" stroke="var(--accent)" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>'+
       '<circle cx="'+X(arr.length-1)+'" cy="'+Y(last.v)+'" r="4.5" fill="'+label(last.v)[1]+'" stroke="#fff" stroke-width="1.5"/>'+
       '<g id="cf-hv" style="display:none"><line y1="'+T+'" y2="'+(T+ch)+'" stroke="var(--tx2)" stroke-dasharray="3 3"/><circle r="4.5" fill="var(--accent)" stroke="#fff" stroke-width="1.5"/></g></svg>';
    el.innerHTML='<div id="cf-ro" class="mut" style="font-size:12.5px;min-height:18px;margin-bottom:4px;font-weight:700">'+fmtFull(last.t)+' · <b style="color:'+label(last.v)[1]+'">'+last.v+'점 '+label(last.v)[0]+'</b> <span style="font-weight:400">(터치·마우스로 날짜별 확인 · '+arr.length+'일)</span></div>'+s;
    const svg=el.querySelector('svg'),hv=el.querySelector('#cf-hv'),ro=el.querySelector('#cf-ro');
    const mv=e=>{const r=svg.getBoundingClientRect();const x=((e.clientX-r.left)/r.width)*W;let i=Math.round((x-L)/cw*(arr.length-1));i=Math.max(0,Math.min(arr.length-1,i));const a=arr[i];
      hv.style.display='';hv.querySelector('line').setAttribute('x1',X(i));hv.querySelector('line').setAttribute('x2',X(i));hv.querySelector('circle').setAttribute('cx',X(i));hv.querySelector('circle').setAttribute('cy',Y(a.v));
      ro.innerHTML=fmtFull(a.t)+' · <b style="color:'+label(a.v)[1]+'">'+a.v+'점 '+label(a.v)[0]+'</b>';};
    svg.addEventListener('pointermove',mv);svg.addEventListener('pointerdown',mv);
  }
  const _renderCF=renderCF;
  renderCF=function(p){ _renderCF(p); try{drawCFChart(p);}catch(e){console.warn('FNG 차트 실패',e);} };

  /* ---- 2) 코인 스파크라인 (미국주식과 동일: 가격 왼쪽 64px 미니 차트) ---- */
  function drawSparks(p){
    document.querySelectorAll('#coin-tbl .wl-row').forEach(row=>{
      const id=row.dataset.c, sp=row.querySelector('.wl-spark'); if(!sp) return;
      const sc=sparklineCache[id], tc=(typeof COIN_TECH!=='undefined')&&COIN_TECH[id];
      let pts=null;
      if(p==='d'&&sc&&sc.length>24) pts=sc.slice(-24);
      else if(p==='w'&&sc&&sc.length>7) pts=sc;
      else if(p==='m'&&tc&&tc.length>30) pts=tc.slice(-30);
      else if(p==='y'&&tc&&tc.length>30) pts=tc;
      if(!pts){ const b=COIN_BASE[id]; pts=b?fallbackSeries(b,p):null; }
      sp.innerHTML=pts?sparkSVG(pts):'';
    });
  }
  const _renderCoin=renderCoin;
  renderCoin=function(p){ _renderCoin(p); try{drawSparks(p);}catch(e){} };
  const _loadTech=loadCoinTech;
  loadCoinTech=function(){ return _loadTech().then(()=>drawSparks(curPer.coin)); };

  /* ---- 3) 레인보우 차트 (코인 행 여백 클릭) ----
     로그 회귀: ln(가격) = a + b·ln(경과일). 잔차 표준편차(σ) 기준 9개 색 밴드.
     BTC는 제네시스(2009-01-03) 기준, 나머지는 상장 데이터 시작 180일 전 기준(근사). 투자 권유 아님. */
  const RB=[['#2563eb','대폭 할인'],['#06b6d4','매수'],['#22c55e','축적'],['#84cc16','아직 저렴'],['#facc15','보유'],['#fb923c','과열 주의'],['#f97316','FOMO'],['#dc2626','매도 구간'],['#b91c1c','극단적 거품']];
  const RB_EDGE=[-1.75,-1.25,-.75,-.25,.25,.75,1.25,1.75];
  const RB_NAME={bitcoin:'비트코인',ethereum:'이더리움',solana:'솔라나',ripple:'리플(XRP)'};
  const rbCache={};
  async function rbData(id){
    if(rbCache[id]) return rbCache[id];
    /* range=max 는 Yahoo가 월 단위로만 내려주므로 period1/period2 로 일봉 전체를 요청 → 실패 시 월봉 사용 */
    let r=null;
    try{
      const j=await getJSON('https://query1.finance.yahoo.com/v8/finance/chart/'+encodeURIComponent(COIN_YSYM[id])+'?period1=1262304000&period2='+Math.floor(Date.now()/1000)+'&interval=1d');
      const x=j.chart.result[0], cl=x.indicators.quote[0].close;
      if(x.timestamp&&x.timestamp.length>200) r={dates:x.timestamp.map(t=>new Date(t*1000).toISOString().slice(0,10)),closes:cl};
    }catch(e){}
    if(!r) r=await yCloseWithDates(COIN_YSYM[id],'max');
    if(!r) return null;
    const dates=[],px=[];
    r.closes.forEach((c,i)=>{ if(c!=null&&c>0){dates.push(r.dates[i]);px.push(c);} });
    if(px.length<60) return null;
    const t0=(id==='bitcoin')?Date.UTC(2009,0,3):(Date.parse(dates[0])-180*86400000);
    const xs=dates.map(d=>Math.log((Date.parse(d)-t0)/86400000)), ys=px.map(Math.log);
    const n=xs.length, mx=xs.reduce((a,b)=>a+b)/n, my=ys.reduce((a,b)=>a+b)/n;
    let sxy=0,sxx=0; for(let i=0;i<n;i++){sxy+=(xs[i]-mx)*(ys[i]-my);sxx+=(xs[i]-mx)**2;}
    const b=sxy/sxx, a=my-b*mx;
    const sd=Math.sqrt(ys.reduce((s,y,i)=>s+(y-(a+b*xs[i]))**2,0)/n);
    return rbCache[id]={dates,px,xs,a,b,sd};
  }
  function rbSVG(D,id){
    const W=640,H=320,L=52,R=10,T=10,B=26,cw=W-L-R,ch=H-T-B, n=D.px.length;
    const fit=i=>D.a+D.b*D.xs[i];
    const lo=Math.min(...D.px.map((p,i)=>Math.min(Math.log(p),fit(i)-2.4*D.sd))), hi=Math.max(...D.px.map((p,i)=>Math.max(Math.log(p),fit(i)+2.4*D.sd)));
    const X=i=>L+i*cw/(n-1), Y=v=>T+ch-((v-lo)/(hi-lo))*ch;
    const E=[-2.4].concat(RB_EDGE,[2.4]);
    let s='<svg viewBox="0 0 '+W+' '+H+'" style="width:100%;height:auto;display:block;touch-action:pan-y">';
    for(let k=0;k<9;k++){
      let up='',dn='';
      for(let i=0;i<n;i+=Math.max(1,Math.floor(n/160))){up+=(up?'L':'M')+X(i).toFixed(1)+','+Y(fit(i)+E[k+1]*D.sd).toFixed(1);}
      for(let i=n-1;i>=0;i-=Math.max(1,Math.floor(n/160))){dn+='L'+X(i).toFixed(1)+','+Y(fit(i)+E[k]*D.sd).toFixed(1);}
      s+='<path d="'+up+dn+'Z" fill="'+RB[k][0]+'" opacity=".55"/>';
    }
    const ticks=[]; for(let e=Math.ceil(lo/Math.LN10*2)/2;e<=hi/Math.LN10;e+=0.5){ if(Number.isInteger(e)||true) ticks.push(e); }
    const pickT=[]; for(let e=Math.ceil(lo/Math.LN10);e<=Math.floor(hi/Math.LN10);e++) pickT.push(e);
    pickT.forEach(e=>{const y=Y(e*Math.LN10);const v=Math.pow(10,e);s+='<line x1="'+L+'" x2="'+(W-R)+'" y1="'+y+'" y2="'+y+'" stroke="var(--line)" stroke-width=".8" opacity=".7"/><text x="'+(L-5)+'" y="'+(y+4)+'" text-anchor="end" font-size="11" fill="var(--tx2)">$'+(v>=1000?(v/1000)+'k':v)+'</text>';});
    const yrs=[]; D.dates.forEach((d,i)=>{ if(d.slice(5,10)==='01-01'||i===0) yrs.push([i,d.slice(0,4)]); });
    let lastX=-99; yrs.forEach(([i,y])=>{ const x=X(i); if(x-lastX>46){ s+='<text x="'+x.toFixed(1)+'" y="'+(H-7)+'" text-anchor="middle" font-size="11" fill="var(--tx2)">'+y+'</text>'; lastX=x; }});
    const HALV=[['2012-11-28','1차'],['2016-07-09','2차'],['2020-05-11','3차'],['2024-04-20','4차']];
    HALV.forEach(([hd,nm])=>{
      const i=D.dates.findIndex(d=>d>=hd); if(i<0||(i===0&&D.dates[0]>hd)) return;
      const x=X(i).toFixed(1), right=(+x>W-70);
      s+='<line x1="'+x+'" x2="'+x+'" y1="'+T+'" y2="'+(T+ch)+'" stroke="var(--tx)" stroke-width="1.4" stroke-dasharray="5 4" opacity=".75"/>'+
         '<text x="'+(right?+x-4:+x+4)+'" y="'+(T+11)+'" text-anchor="'+(right?'end':'start')+'" font-size="10.5" font-weight="800" fill="var(--tx)" stroke="var(--panel)" stroke-width="3" paint-order="stroke">⛏ 반감기 '+nm+' · '+hd.slice(2,7).replace('-','.')+'</text>';
    });
    const dd=D.px.map((p,i)=>(i?'L':'M')+X(i).toFixed(1)+','+Y(Math.log(p)).toFixed(1)).join(' ');
    s+='<path d="'+dd+'" fill="none" stroke="var(--tx)" stroke-width="1.8" stroke-linejoin="round"/>'+
       '<g class="rb-hv" style="display:none"><line y1="'+T+'" y2="'+(T+ch)+'" stroke="var(--tx)" stroke-dasharray="3 3"/><circle r="4.5" fill="var(--tx)" stroke="#fff" stroke-width="1.5"/></g></svg>';
    return {svg:s,X,Y,W,L,cw};
  }
  function rbZone(D,i){ const z=(Math.log(D.px[i])-(D.a+D.b*D.xs[i]))/D.sd; let k=0; while(k<8&&z>RB_EDGE[k]) k++; return [k,z]; }
  async function openRainbow(row){
    const id=row.dataset.c;
    let pn=row.nextElementSibling;
    if(pn&&pn.classList.contains('wl-rb')&&!pn.classList.contains('wl-etf')){ pn.remove(); row.classList.remove('rb-open'); return; }
    document.querySelectorAll('#coin-tbl .wl-rb').forEach(e=>e.remove()); document.querySelectorAll('#coin-tbl .rb-open').forEach(e=>e.classList.remove('rb-open'));
    pn=document.createElement('div'); pn.className='wl-rb'; pn.innerHTML='<div class="mut" style="font-size:12.5px">'+RB_NAME[id]+' 레인보우 차트 불러오는 중…</div>';
    row.after(pn); row.classList.add('rb-open');
    let D=null; try{ D=await rbData(id); }catch(e){}
    if(!pn.isConnected) return;
    if(!D){ pn.innerHTML='<div class="mut" style="font-size:12.5px">가격 이력을 불러오지 못했습니다. 잠시 후 다시 눌러 주세요.</div>'; return; }
    const g=rbSVG(D,id), n=D.px.length;
    const cur=rbZone(D,n-1);
    const legend=RB.map((r,k)=>'<span class="rb-lg'+(k===cur[0]?' on':'')+'"><i style="background:'+r[0]+'"></i>'+r[1]+'</span>').join('');
    pn.innerHTML='<div style="font-weight:800;font-size:14px;margin-bottom:4px">🌈 '+RB_NAME[id]+' 레인보우 가격 차트 <span class="mut" style="font-weight:400;font-size:12px">(로그 스케일 · '+D.dates[0].slice(0,4)+'년~현재 · 점선=비트코인 반감기)</span></div>'+
      '<div class="rb-ro mut" style="font-size:12.5px;min-height:18px;margin-bottom:4px;font-weight:700"></div>'+g.svg+
      '<div class="rb-legend">'+legend+'</div>'+
      '<p class="mut" style="font-size:11.5px;margin:8px 0 0;line-height:1.5">현재 가격은 <b style="color:var(--tx)">'+RB[cur[0]][1]+'</b> 밴드(회귀선 대비 '+(cur[1]>=0?'+':'')+cur[1].toFixed(2)+'σ)에 있습니다. 이 차트는 Yahoo 일봉 전체 이력에 로그 회귀를 적용해 직접 계산한 근사 모델이며'+(id==='bitcoin'?'':' (비트코인 외 코인은 상장 이력이 짧아 신뢰도가 낮습니다)')+', 투자 권유가 아닙니다. 참고: <a href="https://coinmarketcap.com/ko/charts/crypto-market-cycle-indicators/" target="_blank" rel="noopener">CoinMarketCap 사이클 지표</a></p>';
    const svg=pn.querySelector('svg'),hv=pn.querySelector('.rb-hv'),ro=pn.querySelector('.rb-ro');
    const show=i=>{const z=rbZone(D,i);ro.innerHTML=D.dates[i].replace(/-/g,'.')+' · $'+fmtCoin(D.px[i])+' · <b style="color:'+RB[z[0]][0]+'">'+RB[z[0]][1]+'</b>';};
    show(n-1);
    const mv=e=>{const r=svg.getBoundingClientRect();const x=((e.clientX-r.left)/r.width)*g.W;let i=Math.round((x-g.L)/g.cw*(n-1));i=Math.max(0,Math.min(n-1,i));
      hv.style.display='';hv.querySelector('line').setAttribute('x1',g.X(i));hv.querySelector('line').setAttribute('x2',g.X(i));hv.querySelector('circle').setAttribute('cx',g.X(i));hv.querySelector('circle').setAttribute('cy',g.Y(Math.log(D.px[i])));show(i);};
    svg.addEventListener('pointermove',mv);svg.addEventListener('pointerdown',mv);
  }
  const tbl=document.getElementById('coin-tbl');
  if(tbl) tbl.addEventListener('click',e=>{
    if(e.target.closest('a,.wl-rb,button')) return;
    const row=e.target.closest('.wl-row'); if(!row||!row.dataset.c) return;
    openRainbow(row);
  });
  /* 종목명 옆: 레인보우 현재 구간 단계 이모티콘 (마우스를 올리면/길게 누르면 구간명 표시) */
  const rbZoneNow={};
  function applyRbBadges(){
    document.querySelectorAll('#coin-tbl .wl-row[data-c]').forEach(row=>{
      const z=rbZoneNow[row.dataset.c]; if(z==null) return;
      const tg=row.querySelector('.wl-tag'); if(!tg) return;
      /* 한글 코인명 볼드 */
      tg.style.fontWeight='800'; tg.style.color='var(--tx)'; tg.style.fontSize='13px';
      let b=tg.querySelector('.rb-badge');
      if(!b){ b=document.createElement('span'); b.className='rb-badge'; tg.appendChild(b); }
      const c=RB[z][0];
      b.style.cssText='margin-left:6px;display:inline-block;font-size:10.5px;font-weight:800;line-height:1;padding:3px 7px;border-radius:999px;white-space:nowrap;vertical-align:middle;color:#fff;background:'+c+((z>=1&&z<=6)?';color:#1a1200!important':'');
      b.textContent=RB[z][1]; b.title='레인보우 현재 구간: '+RB[z][1];
    });
  }
  (async function(){
    for(const id of Object.keys(RB_NAME)){
      try{ const D=await rbData(id); if(D){ rbZoneNow[id]=rbZone(D,D.px.length-1)[0]; applyRbBadges(); } }catch(e){}
    }
  })();
  const _rc2=renderCoin; renderCoin=function(p){ _rc2(p); try{applyRbBadges();}catch(e){} };
})();

/* ================= 가상화폐: ETF 순유입 차트 (코인 행 오른쪽 + 버튼) =================
   출처: CoinMarketCap ETF 순유입 차트 데이터. CORS 미허용이라 Worker 프록시(api.coinmarketcap.com 허용 필요)로 호출. */
(function(){
  const tbl=document.getElementById('coin-tbl'); if(!tbl) return;
  const CAT={bitcoin:'BTC',ethereum:'ETH',solana:'SOL',ripple:'XRP'};
  const NAME={bitcoin:'비트코인',ethereum:'이더리움',solana:'솔라나',ripple:'리플(XRP)'};
  const PAGE={bitcoin:'bitcoin',ethereum:'ethereum',solana:'solana',ripple:'xrp'};
  const RNG=[['30d','30일 · 일별'],['1y','1년 · 주별'],['all','전체 · 월별']];
  const cache={};
  const fmtM=v=>{const a=Math.abs(v),s=v<0?'-':'+';return s+'$'+(a>=1e9?(a/1e9).toFixed(2)+'B':a>=1e6?(a/1e6).toFixed(1)+'M':a>=1e3?(a/1e3).toFixed(0)+'K':a.toFixed(0));};
  const fmtDt=t=>{const d=new Date(+t);return d.getUTCFullYear()+'.'+String(d.getUTCMonth()+1).padStart(2,'0')+'.'+String(d.getUTCDate()).padStart(2,'0');};
  async function load(id,r){
    const k=id+r; if(cache[k]) return cache[k];
    const j=await getJSON('https://api.coinmarketcap.com/data-api/v3/etf/overview/netflow/chart?category='+CAT[id]+'&range='+r);
    const pts=j&&j.data&&j.data.points;
    if(!pts||!pts.length) return null;
    return cache[k]=pts.map(p=>({t:p.timestamp,v:+p.value})).sort((a,b)=>a.t-b.t);
  }
  function chart(pts){
    const W=640,H=250,L=58,R=8,T=10,B=24,cw=W-L-R,ch=H-T-B,n=pts.length;
    const mx=Math.max(...pts.map(p=>Math.abs(p.v)),1), Y=v=>T+ch/2-(v/mx)*(ch/2), bw=cw/n;
    let s='<svg viewBox="0 0 '+W+' '+H+'" style="width:100%;height:auto;display:block;touch-action:pan-y">';
    [-1,-.5,0,.5,1].forEach(f=>{const y=Y(f*mx);s+='<line x1="'+L+'" x2="'+(W-R)+'" y1="'+y+'" y2="'+y+'" stroke="var(--line)" stroke-width="'+(f===0?1.4:.8)+'"/><text x="'+(L-5)+'" y="'+(y+4)+'" text-anchor="end" font-size="10.5" fill="var(--tx2)">'+(f===0?'0':fmtM(f*mx).replace('+',''))+'</text>';});
    pts.forEach((p,i)=>{const h=Math.abs(p.v)/mx*(ch/2),y=p.v>=0?Y(p.v):Y(0);s+='<rect data-i="'+i+'" x="'+(L+i*bw+bw*.12).toFixed(1)+'" y="'+y.toFixed(1)+'" width="'+(bw*.76).toFixed(1)+'" height="'+Math.max(h,1).toFixed(1)+'" fill="'+(p.v>=0?'var(--up)':'var(--down)')+'" rx="1.5"/>';});
    const m=Math.min(5,n);for(let k=0;k<m;k++){const i=m===1?0:Math.round(k*(n-1)/(m-1));const d=new Date(+pts[i].t);s+='<text x="'+(L+i*bw+bw/2).toFixed(1)+'" y="'+(H-6)+'" text-anchor="'+(k===0?'start':k===m-1?'end':'middle')+'" font-size="10.5" fill="var(--tx2)">'+(d.getUTCFullYear()%100)+'.'+(d.getUTCMonth()+1)+'.'+d.getUTCDate()+'</text>';}
    return s+'</svg>';
  }
  async function paint(pn,id,r){
    const box=pn.querySelector('.etf-body'); box.innerHTML='<div class="mut" style="font-size:12.5px">불러오는 중…</div>';
    pn.querySelectorAll('.etf-r').forEach(b=>b.classList.toggle('on',b.dataset.r===r));
    let pts=null; try{pts=await load(id,r);}catch(e){}
    if(!pn.isConnected) return;
    if(!pts){box.innerHTML='<div class="mut" style="font-size:12.5px;line-height:1.55">ETF 순유입 데이터를 일시적으로 불러오지 못했습니다.'+devHint('Worker에 api.coinmarketcap.com 허용 재배포')+' 원문: <a href="https://coinmarketcap.com/ko/etf/'+PAGE[id]+'/" target="_blank" rel="noopener">CoinMarketCap '+NAME[id]+' ETF</a></div>';return;}
    const sum=pts.reduce((a,p)=>a+p.v,0), last=pts[pts.length-1], inn=pts.filter(p=>p.v>0).length;
    box.innerHTML='<div class="etf-ro mut" style="font-size:12.5px;min-height:18px;margin-bottom:4px;font-weight:700"></div>'+chart(pts)+
      '<div class="etf-sum"><span>기간 합계 <b class="'+(sum>=0?'up':'down')+'">'+fmtM(sum)+'</b></span><span>최근 <b class="'+(last.v>=0?'up':'down')+'">'+fmtM(last.v)+'</b> ('+fmtDt(last.t)+')</span><span>순유입 '+inn+' / 순유출 '+(pts.length-inn)+'</span></div>';
    const ro=box.querySelector('.etf-ro'),show=p=>{ro.innerHTML=fmtDt(p.t)+' · <b style="color:var(--'+(p.v>=0?'up':'down')+')">'+fmtM(p.v)+'</b>';};show(last);
    box.querySelectorAll('rect').forEach(el=>{const h=()=>show(pts[+el.dataset.i]);el.addEventListener('pointerenter',h);el.addEventListener('pointerdown',h);});
  }
  function open(row){
    const id=row.dataset.c; let nx=row.nextElementSibling;
    if(nx&&nx.classList.contains('wl-etf')){nx.remove();row.classList.remove('rb-open');row.querySelector('.etf-plus').textContent='+';return;}
    tbl.querySelectorAll('.wl-rb').forEach(e=>e.remove());tbl.querySelectorAll('.rb-open').forEach(e=>e.classList.remove('rb-open'));tbl.querySelectorAll('.etf-plus').forEach(e=>e.textContent='+');
    const pn=document.createElement('div');pn.className='wl-rb wl-etf';
    pn.innerHTML='<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:6px"><div style="font-weight:800;font-size:14px">💧 '+NAME[id]+' 현물 ETF 순유입</div><div class="etf-rs">'+RNG.map(r=>'<button type="button" class="etf-r" data-r="'+r[0]+'">'+r[1]+'</button>').join('')+'</div></div><div class="etf-body"></div>'+
      '<p class="mut" style="font-size:11.5px;margin:8px 0 0;line-height:1.5">빨강=순유입, 파랑=순유출 · 출처: <a href="https://coinmarketcap.com/ko/etf/'+PAGE[id]+'/" target="_blank" rel="noopener">CoinMarketCap ETF</a></p>';
    row.after(pn);row.classList.add('rb-open');row.querySelector('.etf-plus').textContent='−';
    pn.addEventListener('click',e=>{const b=e.target.closest('.etf-r');if(b)paint(pn,id,b.dataset.r);});
    paint(pn,id,'30d');
  }
  tbl.addEventListener('click',e=>{const a=e.target.closest('.etf-plus');if(!a)return;e.preventDefault();open(a.closest('.wl-row'));});
})();

/* ================= 가상화폐: 소셜 언급 (센티먼트 · 토큰 소셜 순위) — CoinGecko(CORS 허용) =================
   센티먼트 = CoinGecko 커뮤니티 강세/약세 투표 비율, 소셜 순위 = CoinGecko 트렌딩(검색·관심도) 순위 */
(function(){
  const sent=document.getElementById('soc-sent'), rank=document.getElementById('soc-rank'); if(!sent||!rank) return;
  const IDS=[['bitcoin','BTC'],['ethereum','ETH'],['solana','SOL'],['ripple','XRP']];
  const state=v=>v>=65?['강세 우위','var(--up)']:v>=55?['약간 강세','var(--up)']:v>45?['중립','var(--tx2)']:v>35?['약간 약세','var(--down)']:['약세 우위','var(--down)'];
  async function loadSent(){
    const res=await Promise.all(IDS.map(async([id,sym])=>{
      try{const j=await fetchJSON(cgURL('/coins/'+id+'?localization=false&tickers=false&market_data=false&community_data=false&developer_data=false&sparkline=false'),9000);
        return {sym,up:j.sentiment_votes_up_percentage,dn:j.sentiment_votes_down_percentage};}catch(e){return {sym,up:null};}
    }));
    const ok=res.filter(r=>r.up!=null);
    if(!ok.length){ sent.innerHTML='<p class="mut" style="font-size:12.5px">센티먼트 데이터를 불러오지 못했습니다(CoinGecko 호출 제한). 잠시 후 새로고침해 주세요.</p>'; return; }
    const avg=ok.reduce((a,r)=>a+r.up,0)/ok.length, st=state(avg);
    sent.innerHTML='<div class="soc-big"><b style="color:'+st[1]+'">'+st[0]+'</b><span class="mut">4종 평균 강세 '+avg.toFixed(1)+'%</span></div>'+
      '<div class="soc-bar" style="margin-bottom:12px"><i style="width:'+avg.toFixed(1)+'%;background:var(--up)"></i><i style="width:'+(100-avg).toFixed(1)+'%;background:var(--down)"></i></div>'+
      res.map(r=>r.up==null?'<div class="soc-row"><span class="soc-nm">'+r.sym+'</span><span class="mut">--</span></div>':
        '<div class="soc-row"><span class="soc-nm">'+r.sym+'</span><div class="soc-bar"><i style="width:'+r.up+'%;background:var(--up)"></i><i style="width:'+(r.dn!=null?r.dn:100-r.up)+'%;background:var(--down)"></i></div><span class="soc-v"><span style="color:var(--up)">'+r.up.toFixed(0)+'%</span> / <span style="color:var(--down)">'+(r.dn!=null?r.dn:100-r.up).toFixed(0)+'%</span></span></div>').join('')+
      '<p class="mut" style="font-size:11.5px;margin:10px 0 0;line-height:1.5"><span style="color:var(--up)">■</span> 강세 투표 <span style="color:var(--down)">■</span> 약세 투표 · CoinGecko 커뮤니티 투표 기준(참여자 표본이라 참고용)</p>';
  }
  async function loadRank(){
    let coins=null;
    try{ const j=await fetchJSON(cgURL('/search/trending'),9000); coins=(j.coins||[]).map(x=>x.item); }catch(e){}
    if(!coins||!coins.length){ rank.innerHTML='<p class="mut" style="font-size:12.5px">소셜 순위를 불러오지 못했습니다(CoinGecko 호출 제한). 잠시 후 새로고침해 주세요.</p>'; return; }
    const n=coins.length;
    rank.innerHTML=coins.map((c,i)=>{
      const pc=c.data&&c.data.price_change_percentage_24h&&c.data.price_change_percentage_24h.usd;
      const w=Math.max(8,(n-i)/n*100);
      return '<div class="soc-row"><span class="soc-rk'+(i<3?' top':'')+'">'+(i+1)+'</span><span class="soc-nm" style="width:auto;min-width:64px;max-width:96px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="'+c.name+'">'+c.symbol+'</span>'+
        '<div class="soc-bar"><i style="width:'+w.toFixed(0)+'%;background:var(--accent);opacity:'+(0.45+0.55*(n-i)/n).toFixed(2)+'"></i></div>'+
        '<span class="soc-v soc-ch '+(pc>=0?'up':'down')+'">'+(pc==null?'--':(pc>=0?'▲ +':'▼ ')+pc.toFixed(1)+'%')+'</span></div>';
    }).join('')+'<p class="mut" style="font-size:11.5px;margin:10px 0 0;line-height:1.5">막대 길이 = 관심도 순위(길수록 상위) · 오른쪽은 24시간 가격 등락 · CoinGecko 트렌딩 기준</p>';
  }
  loadSent(); loadRank();
  setInterval(()=>{loadSent();loadRank();},300000);
})();

/* ===================== 시총 TOP30 — 실적 발표 D-day 칩 + 회사 IR 사이트 링크 =====================
   Worker(/earnings)가 Yahoo calendarEvents의 '다음 실적 발표 예정일'을 내려준다(추정일 포함 가능).
   칩을 누르면 해당 회사 IR(실적 자료) 사이트가 새 탭으로 열린다. 값이 없으면 칩을 만들지 않는다(임의 날짜 표시 금지). */
const EARN_IR={
  NVDA:'https://investor.nvidia.com/', AAPL:'https://investor.apple.com/', GOOGL:'https://abc.xyz/investor/', MSFT:'https://www.microsoft.com/en-us/investor',
  AMZN:'https://ir.aboutamazon.com/', TSM:'https://investor.tsmc.com/', AVGO:'https://investors.broadcom.com/', META:'https://investor.atmeta.com/',
  TSLA:'https://ir.tesla.com/', MU:'https://investors.micron.com/', 'BRK-B':'https://www.berkshirehathaway.com/reports.html', AMD:'https://ir.amd.com/',
  LLY:'https://investor.lilly.com/', JPM:'https://www.jpmorganchase.com/ir', WMT:'https://stock.walmart.com/', V:'https://investor.visa.com/',
  XOM:'https://corporate.exxonmobil.com/investors', INTC:'https://www.intc.com/', JNJ:'https://www.investor.jnj.com/', MA:'https://investor.mastercard.com/',
  ABBV:'https://investors.abbvie.com/', CSCO:'https://investor.cisco.com/', BAC:'https://investor.bankofamerica.com/', AMAT:'https://ir.appliedmaterials.com/',
  COST:'https://investor.costco.com/', CAT:'https://investors.caterpillar.com/', CVX:'https://www.chevron.com/investors', UNH:'https://www.unitedhealthgroup.com/investors',
  LRCX:'https://investor.lamresearch.com/'
};
const EARN_LIST=['NVDA','AAPL','GOOGL','MSFT','AMZN','TSM','SPCX','AVGO','META','TSLA','MU','BRK-B','AMD','LLY','JPM','WMT','V','XOM','INTC','JNJ','MA','ABBV','CSCO','BAC','AMAT','COST','CAT','CVX','UNH','LRCX'];
let EARN_DATA=null, NEWS_DATA=null, DIV_DATA=null;
function injectEarnCss(){
  if(document.getElementById('er-css')) return;
  const st=document.createElement('style'); st.id='er-css';
  st.textContent='.wl-er{margin-top:3px;line-height:1}.er-b{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:99px;border:1px solid #D0D5DD;background:#F2F4F7;color:#344054;font-size:11.5px;font-weight:800;text-decoration:none;white-space:nowrap;font-variant-numeric:tabular-nums}'+
  '.er-b:hover{filter:brightness(.96);text-decoration:underline}.er-b.soon{background:#FEF0C7;border-color:#F5C35A;color:#7A4B00}.er-b.hot{background:#FEE4E2;border-color:#F4A6A0;color:#912018}.er-b.done{background:#D1FADF;border-color:#7ED9A4;color:#05603A}'+
  '.wl-er{display:flex;flex-wrap:wrap;gap:4px 6px;align-items:center}.er-n{display:inline-flex;align-items:center;gap:4px;max-width:100%;padding:2px 8px;border-radius:99px;border:1px solid #D0D5DD;background:#fff;color:#344054;font-size:11.5px;font-weight:700;text-decoration:none;min-width:0}.er-n span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:340px}.er-n em{font-style:normal;font-weight:500;color:#475467;white-space:nowrap}.er-n:hover{text-decoration:underline}.er-n.up{background:#FEF3F2;border-color:#F4A6A0;color:#912018}.er-n.down{background:#EFF4FF;border-color:#A4BCFD;color:#1D3FA6}'+
  'html[data-cv="us"] .er-n.up{background:#ECFDF3;border-color:#7ED9A4;color:#05603A}html[data-cv="us"] .er-n.down{background:#FEF3F2;border-color:#F4A6A0;color:#912018}'+
  '.wl-tag.has-tc{display:flex;flex-wrap:wrap;align-items:center;gap:3px 6px}.wl-tc{display:inline-flex;flex-wrap:wrap;gap:4px;align-items:center}'+
  '.dv-b{display:inline-flex;align-items:center;padding:2px 8px;border-radius:99px;border:1px solid #BDB4FE;background:#F4F3FF;color:#3E1C96;font-size:11.5px;font-weight:800;text-decoration:none;white-space:nowrap;font-variant-numeric:tabular-nums;line-height:1.2}'+
  '.dv-b.soon{background:#EBE9FE;border-color:#9B8AFB;color:#32177A}.dv-b.past{background:#F2F4F7;border-color:#D0D5DD;color:#475467;font-weight:700}.dv-b:hover{text-decoration:underline}'+
  'html[data-theme="dark"] .dv-b{background:#2a2350;border-color:#6a5acd;color:#D9D6FE}html[data-theme="dark"] .dv-b.past{background:#2b3139;border-color:#3d4650;color:#C7CED6}html[data-theme="dark"] .dv-b.soon{background:#352a6b;color:#EBE9FE}'+
  '@media(max-width:560px){.er-b,.dv-b{font-size:10.5px;padding:2px 6px}.er-n{font-size:10.5px;padding:2px 6px}.er-n span{max-width:190px}.er-n em{display:none}}';
  document.head.appendChild(st);
}
function earnDays(ts){
  const ny=s=>{const p={};new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(s).forEach(x=>p[x.type]=x.value);return Date.UTC(+p.year,+p.month-1,+p.day)/864e5;};
  return Math.round(ny(new Date(ts*1000))-ny(new Date()));
}
function applyEarnBadges(){
  if(!EARN_DATA&&!NEWS_DATA&&!DIV_DATA) return;
  injectEarnCss();
  const enabled=k=>typeof window.MK_CHIP_ENABLED==='function'?window.MK_CHIP_ENABLED(k):true;
  const esc=s=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const fd=(ts)=>new Date(ts*1000).toLocaleDateString('ko-KR',{timeZone:'America/New_York',month:'long',day:'numeric'});
  document.querySelectorAll('#cap-tbl .wl-row,#cap2-tbl .wl-row,#cap3-tbl .wl-row,#tick-tbl .wl-row,#lev-tbl .wl-row').forEach(row=>{
    const t=row.dataset.t, info=row.querySelector('.wl-info'); if(!info) return;
    const isCap=!!row.closest('#cap-tbl,#cap2-tbl,#cap3-tbl');
    /* 이름 옆 칩: 실적 D-day(시총 종목) + 배당락일·배당률 */
    let tc='';
    const e=isCap&&EARN_DATA&&EARN_DATA[t];
    if(enabled('er')&&e&&e.ts){
      const d=earnDays(e.ts);
      if(d>=-3){
        const rng=e.ts2&&e.ts2!==e.ts?' ~ '+fd(e.ts2):'';
        const cls=d<0?'done':d<=3?'hot':d<=14?'soon':'', label=d<0?'📋 실적 발표 D+'+(-d):d===0?'🔥 실적 발표 D-DAY':(d<=3?'🔔 ':'📣 ')+'실적 D-'+d;
        const url=EARN_IR[t]||('https://finance.yahoo.com/quote/'+encodeURIComponent(t)+'/analysis/');
        tc+='<a class="er-b '+cls+'" href="'+url+'" target="_blank" rel="noopener" title="다음 실적 발표 '+fd(e.ts)+rng+' (미국 현지 기준 · 회사 확정 전에는 추정일) · 누르면 '+t+' '+(EARN_IR[t]?'IR 사이트':'Yahoo 실적 분석')+'로 이동">'+label+'</a>';
      }
    }
    const dv=DIV_DATA&&DIV_DATA[t];
    if(enabled('dv')&&dv&&dv.ex){
      const d=earnDays(dv.ex);
      if(d>=0){
        const tip='배당락일 '+fd(dv.ex)+' (미국 현지 기준)'+(dv.pay?' · 지급일 '+fd(dv.pay):'')+' · 누르면 Yahoo 배당 이력으로 이동';
        tc+='<a class="dv-b'+(d<=7?' soon':'')+'" href="https://finance.yahoo.com/quote/'+encodeURIComponent(t)+'/history/?filter=div" target="_blank" rel="noopener" title="'+esc(tip)+'">💰 배당락 '+(d===0?'오늘':'D-'+d)+'</a>';
      }
    }
    const tag=info.querySelector('.wl-tag');
    let tbox=info.querySelector('.wl-tc');
    if(!tc){ if(tbox) tbox.remove(); }
    else{
      if(!tbox){ tbox=document.createElement('span'); tbox.className='wl-tc'; const nm=info.querySelector('.wl-name'); if(nm) nm.after(tbox); else info.appendChild(tbox); }
      if(tbox.innerHTML!==tc) tbox.innerHTML=tc;
    }
    /* 뉴스 칩은 이름 아래 */
    let html='';
    const n=enabled('nw')&&isCap&&NEWS_DATA&&NEWS_DATA[t];
    if(n&&n.url&&n.title){
      const ic=n.dir==='up'?'📈':n.dir==='down'?'📉':'🗞';
      const when=n.pubDate?new Date(n.pubDate).toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}):'';
      html+='<a class="er-n '+(['up','down'].includes(n.dir)?n.dir:'')+'" href="'+stockSafeURL(n.url)+'" target="_blank" rel="noopener nofollow" title="'+esc(n.title)+' — '+esc(n.source)+(when?' · '+when:'')+' (최근 2일 · 급등락·실적·규제 키워드 기사 · 누르면 원문 기사로 이동)">'+ic+' <span>'+esc(n.title)+'</span><em>'+esc(n.source)+'</em></a>';
    }
    if(enabled('nw')&&!html&&isCap&&NEWS_DATA){ /* 자동 수집 기사가 없으면 뉴스 검색 링크로 대체(누르면 최신 기사 목록 열림) */
      html='<a class="er-n ns" href="https://news.google.com/search?q='+encodeURIComponent(t+' 주가 when:2d')+'&hl=ko&gl=KR&ceid=KR:ko" target="_blank" rel="noopener nofollow" title="'+esc(t)+' 최신 뉴스 검색(Google 뉴스) — 자동 수집된 기사가 아직 없습니다">🗞 <span>'+esc(t)+' 최신 뉴스 검색 ↗</span></a>';
    }
    let box=info.querySelector('.wl-er');
    if(!html){ if(box) box.remove(); return; }
    if(!box){ box=document.createElement('div'); box.className='wl-er'; }
    if(info.lastElementChild!==box) info.appendChild(box);
    if(box.innerHTML!==html) box.innerHTML=html;
  });
  try{ updateActionLine(); }catch(e){}
}
async function loadDivs(){
  if(!PROXY_BASE) return;
  const syms=[...new Set([...TICKGROUPS.cap.list,...TICKGROUPS.cap2.list,...TICKGROUPS.cap3.list,...TICKGROUPS.tick.list,...TICKGROUPS.lev.list])];
  const origin=PROXY_BASE.replace(/\?url=$/,'');
  DIV_DATA=DIV_DATA||{};
  try{
    for(let i=0;i<syms.length;i+=20){
      const r=await fetch(origin+'divs?symbols='+syms.slice(i,i+20).map(encodeURIComponent).join(','),{signal:AbortSignal.timeout?AbortSignal.timeout(25000):undefined});
      const j=r.ok?await r.json():null; if(j&&!j.error) Object.assign(DIV_DATA,j);
    }
    applyEarnBadges(); mkMiss('div','배당',!Object.keys(DIV_DATA).length);
  }catch(e){ console.warn('배당 정보 로딩 실패:',e); mkMiss('div','배당',true); }
}
async function loadCapNews(){
  if(!PROXY_BASE||!document.getElementById('cap-tbl')) return;
  try{
    const origin=PROXY_BASE.replace(/\?url=$/,'');
    const r=await fetch(origin+'cap-news?tickers='+EARN_LIST.map(encodeURIComponent).join(','),{signal:AbortSignal.timeout?AbortSignal.timeout(25000):undefined});
    const j=r.ok?await r.json():null;
    if(j&&!j.error){ NEWS_DATA=j; applyEarnBadges(); mkMiss('news','뉴스',false); } else { NEWS_DATA={}; applyEarnBadges(); mkMiss('news','뉴스',true); }
  }catch(e){ console.warn('핵심 뉴스 로딩 실패:',e); NEWS_DATA={}; applyEarnBadges(); mkMiss('news','뉴스',true); }
}
async function loadEarnings(){
  if(!PROXY_BASE||!document.getElementById('cap-tbl')) return;
  try{
    const origin=PROXY_BASE.replace(/\?url=$/,'');
    const r=await fetch(origin+'earnings?tickers='+EARN_LIST.map(encodeURIComponent).join(','),{signal:AbortSignal.timeout?AbortSignal.timeout(20000):undefined});
    const j=r.ok?await r.json():null;
    if(j&&!j.error){ EARN_DATA=j; applyEarnBadges(); mkMiss('earn','실적일',!Object.keys(j).length); } else mkMiss('earn','실적일',true);
  }catch(e){ console.warn('실적 발표일 로딩 실패:',e); mkMiss('earn','실적일',true); }
}
if(document.getElementById('cap-tbl')){
  setTimeout(loadEarnings,1200); setTimeout(loadCapNews,1800); setTimeout(loadDivs,2200);
  /* 시총 TOP30: 실적·배당락·뉴스 표시 설정/해제 버튼 (기존 .tabs 모양을 그대로 사용 · CSS 파일과 무관하게 동작) */
  (function(){
    const tb=document.getElementById('cap-tbl'); if(!tb) return;
    const tabs=document.querySelector('.tabs[data-group="cap"]'); if(!tabs||document.getElementById('cap-chip-set')) return;
    const K=[['er','📅 실적'],['dv','💰 배당락'],['nw','📰 뉴스']];
    const state={}; K.forEach(k=>{ try{ state[k[0]]=localStorage.getItem('mk_chip_'+k[0])!=='0'; }catch(e){ state[k[0]]=true; } });
    const get=k=>state[k];
    window.MK_CHIP_ENABLED=get;
    if(!document.getElementById('cap-chip-css')){ const st=document.createElement('style'); st.id='cap-chip-css';
      st.textContent=':is(#cap-tbl,#cap2-tbl,#cap3-tbl,#tick-tbl,#lev-tbl).hide-er .er-b,:is(#cap-tbl,#cap2-tbl,#cap3-tbl,#tick-tbl,#lev-tbl).hide-dv .dv-b,:is(#cap-tbl,#cap2-tbl,#cap3-tbl,#tick-tbl,#lev-tbl).hide-nw .er-n{display:none!important}#cap-chip-set{display:flex!important;align-items:center;gap:6px;margin:0 0 8px}#cap-chip-set button{cursor:pointer}';
      document.head.appendChild(st); }
    const bar=document.createElement('div'); bar.id='cap-chip-set'; bar.className='stock-chip-controls'; bar.setAttribute('role','group'); bar.setAttribute('aria-label','시총 종목 표시 항목 설정');
    bar.innerHTML=K.map(k=>'<button type="button" data-k="'+k[0]+'">'+k[1]+'</button>').join('');
    tabs.after(bar);
    const apply=()=>{ ['cap-tbl','cap2-tbl','cap3-tbl','tick-tbl','lev-tbl'].forEach(id=>{ const el=document.getElementById(id); if(!el) return; K.forEach(k=>el.classList.toggle('hide-'+k[0],!get(k[0]))); });
      K.forEach(k=>{ const b=bar.querySelector('[data-k="'+k[0]+'"]'); const on=get(k[0]); b.classList.toggle('on',on); b.textContent=(on?'☑ ':'☐ ')+k[1]; b.setAttribute('aria-pressed',String(on)); b.title=k[1].replace(/^\S+ /,'')+' 표시 '+(on?'켜짐 — 누르면 끔':'꺼짐 — 누르면 켬'); }); };
    bar.addEventListener('click',e=>{ const b=e.target.closest('button[data-k]'); if(!b) return; e.stopPropagation(); const k=b.dataset.k; if(!Object.prototype.hasOwnProperty.call(state,k)) return; state[k]=!state[k]; try{ localStorage.setItem('mk_chip_'+k,state[k]?'1':'0'); }catch(x){} apply(); applyEarnBadges(); });
    apply(); setTimeout(apply,1500); setTimeout(apply,5000);
  })();
  ['cap-tbl','cap2-tbl','cap3-tbl','tick-tbl','lev-tbl'].forEach(id=>{ const el=document.getElementById(id); if(el&&window.MutationObserver){ let tm; new MutationObserver(()=>{ clearTimeout(tm); tm=setTimeout(applyEarnBadges,200); }).observe(el,{childList:true,subtree:false}); } });
}

/* ===================== 시간외(장전·장후) 시세 칩 =====================
   Worker(/ext)가 정규장 종가 대비 장전/장후 등락률을 내려준다. 정규장 중이거나 시간외 데이터가 없으면 칩을 숨긴다. */
const EXT_TABLES='#tick-tbl,#cap-tbl,#cap2-tbl,#cap3-tbl,#lev-tbl,#idxchg-tbl';
let EXT_DATA={}, EXT_TM=null;
function injectExtCss(){
  if(document.getElementById('ext-css')) return;
  const st=document.createElement('style'); st.id='ext-css';
  st.textContent='.wl-ext{margin:5px 0 0;font-size:11px;font-weight:700;line-height:1.2;white-space:nowrap;text-align:right;font-variant-numeric:tabular-nums}.wl-ext b{font-weight:800}'+
  '.wl-ext .e-l{color:#475467;font-weight:600}.wl-ext.up b{color:#B42318}.wl-ext.down b{color:#1D3FA6}.wl-ext.flat b{color:#475467}'+
  'html[data-cv="us"] .wl-ext.up b{color:#05603A}html[data-cv="us"] .wl-ext.down b{color:#B42318}';
  st.textContent+='#pb-ext{border-top:1px solid var(--line,#E1E4E8);padding:10px 14px 12px;background:var(--panel2,#FAFBFA);font-size:12px;line-height:1.4}#pb-ext .x-h{display:flex;flex-wrap:wrap;gap:2px 10px;align-items:baseline;margin-bottom:8px}#pb-ext .x-h b{font-size:14px}#pb-ext .x-h span{color:var(--tx2,#475467);font-size:11.5px}'+
    '#pb-ext .x-box{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);border:1px solid var(--line,#D0D5DD);border-radius:10px;background:var(--panel,#fff);overflow:hidden}'+
    '#pb-ext .x-col{min-width:0;padding:10px 12px 12px;display:flex;flex-direction:column;gap:6px}#pb-ext .x-col+.x-col{border-left:1px solid var(--line,#D0D5DD)}'+
    '#pb-ext .x-t{display:flex;align-items:center;gap:6px;margin:0 0 2px;font-size:14px;font-weight:900;color:var(--tx,#101828)}#pb-ext .x-t i{font-style:normal;font-size:11.5px;font-weight:800;padding:2px 9px;border-radius:99px;color:#fff}#pb-ext .x-t.up i{background:#B42318}#pb-ext .x-t.down i{background:#1D3FA6}'+
    '#pb-ext .x-c{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:8px;min-width:0;height:52px;padding:0 12px;border:1px solid var(--line,#D0D5DD);border-left-width:4px;border-radius:8px;background:var(--panel,#fff);color:var(--tx,#101828);font-variant-numeric:tabular-nums}'+
    '#pb-ext .x-c strong{font-size:15px;font-weight:900;letter-spacing:-.2px;white-space:nowrap}#pb-ext .x-c small{font-size:11.5px;color:var(--tx2,#475467);white-space:nowrap;text-align:right;overflow:hidden;text-overflow:ellipsis}#pb-ext .x-c b{font-size:19px;font-weight:900;white-space:nowrap}'+
    '#pb-ext .x-c.up{border-left-color:#D92D20;background:#FEF6F5}#pb-ext .x-c.up b{color:#B42318}#pb-ext .x-c.down{border-left-color:#2E5BDB;background:#F3F6FE}#pb-ext .x-c.down b{color:#1D3FA6}#pb-ext .x-c.none{display:flex;justify-content:center;border-left-color:var(--line,#D0D5DD);color:var(--tx2,#475467);background:transparent}'+
    'html[data-cv="us"] #pb-ext .x-t.up i{background:#05603A}html[data-cv="us"] #pb-ext .x-t.down i{background:#B42318}html[data-cv="us"] #pb-ext .x-c.up{border-left-color:#12B76A;background:#F3FBF6}html[data-cv="us"] #pb-ext .x-c.up b{color:#05603A}html[data-cv="us"] #pb-ext .x-c.down{border-left-color:#D92D20;background:#FEF6F5}html[data-cv="us"] #pb-ext .x-c.down b{color:#B42318}'+
    'html[data-theme="dark"] #pb-ext .x-c.up b{color:#FDA29B}html[data-theme="dark"] #pb-ext .x-c.down b{color:#84ADFF}html[data-theme="dark"][data-cv="us"] #pb-ext .x-c.up b{color:#6CE9A6}html[data-theme="dark"][data-cv="us"] #pb-ext .x-c.down b{color:#FDA29B}html[data-theme="dark"] #pb-ext .x-c.up,html[data-theme="dark"] #pb-ext .x-c.down{background:var(--panel,#1c2128)!important}'+
    '@media(max-width:700px){#pb-ext{padding:10px 8px 12px}#pb-ext .x-col{padding:8px 7px 9px;gap:5px}#pb-ext .x-t{font-size:13px}#pb-ext .x-c{grid-template-columns:1fr auto;grid-template-rows:auto auto;height:auto;min-height:50px;padding:5px 7px;gap:0 4px}#pb-ext .x-c strong{font-size:13.5px;grid-column:1}#pb-ext .x-c b{font-size:14.5px;grid-column:2;grid-row:1}#pb-ext .x-c small{grid-column:1/-1;text-align:left;font-size:11px}}';
  document.head.appendChild(st);
}
function updateExtSummary(){
  const br=document.getElementById('pro-brief'); if(!br) return;
  let box=document.getElementById('pb-ext');
  const arr=Object.keys(EXT_DATA).map(t=>({t,e:EXT_DATA[t]})).filter(x=>x.e&&x.e.pct!=null&&(Date.now()/1000-x.e.t)<=60*3600);
  if(usRegularNow()||arr.length<3){ if(box) box.remove(); return; }
  const st=arr.some(x=>x.e.st==='pre')&&!arr.some(x=>x.e.st==='post')?'pre':'post';
  const up=arr.filter(x=>x.e.pct>0).sort((a,b)=>b.e.pct-a.e.pct).slice(0,3), dn=arr.filter(x=>x.e.pct<0).sort((a,b)=>a.e.pct-b.e.pct).slice(0,3);
  const f2=(typeof fmt==='function'?fmt:(v=>v.toFixed(2)));
  const chip=x=>'<div class="x-c '+(x.e.pct>0?'up':'down')+'" title="'+x.t+' 정규장 종가 $'+f2(x.e.base)+' → '+(st==='pre'?'장전':'장후')+' $'+f2(x.e.px)+'"><strong>'+x.t+'</strong><b>'+(x.e.pct>0?'▲ +':'▼ −')+Math.abs(x.e.pct).toFixed(2)+'%</b><small>$'+f2(x.e.px)+'</small></div>';
  const html='<div class="x-h"><b>'+(st==='pre'?'☀ 장전':'🌙 장후')+' 시세 요약</b><span>정규장 종가 대비 · 관심종목·시총·레버리지·지수 편입편출 '+arr.length+'종목 중 · Yahoo Finance(지연 가능)</span></div>'+
    '<div class="x-box"><div class="x-col"><div class="x-t up"><i>상승</i>TOP'+up.length+'</div>'+(up.length?up.map(chip).join(''):'<div class="x-c none">해당 없음</div>')+'</div>'+
    '<div class="x-col"><div class="x-t down"><i>하락</i>TOP'+dn.length+'</div>'+(dn.length?dn.map(chip).join(''):'<div class="x-c none">해당 없음</div>')+'</div></div>';
  if(!box){ box=document.createElement('div'); box.id='pb-ext'; const fut=document.getElementById('pb-fut'); if(fut) fut.after(box); else br.appendChild(box); }
  if(box.innerHTML!==html) box.innerHTML=html;
}
function usRegularNow(){
  const p={}; new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',weekday:'short',hour:'numeric',minute:'numeric',hour12:false}).formatToParts(new Date()).forEach(x=>p[x.type]=x.value);
  const m=(parseInt(p.hour,10)%24)*60+parseInt(p.minute,10); return p.weekday!=='Sat'&&p.weekday!=='Sun'&&m>=570&&m<960;
}
function extSession(){
  const p={}; new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',weekday:'short',hour:'numeric',minute:'numeric',hour12:false}).formatToParts(new Date()).forEach(x=>p[x.type]=x.value);
  if(p.weekday==='Sat'||p.weekday==='Sun') return null; const m=(parseInt(p.hour,10)%24)*60+parseInt(p.minute,10);
  return m>=240&&m<570?'pre':(m>=960&&m<1200?'post':null);
}
function extSymbols(){
  const s=new Set(); document.querySelectorAll(EXT_TABLES.split(',').map(x=>x+' .wl-row[data-t]').join(',')).forEach(r=>{ const t=r.dataset.t; if(t&&!/\.(KS|KQ)$/.test(t)) s.add(t); }); return [...s];
}
function applyExtChips(){
  injectExtCss();
  const reg=usRegularNow();
  document.querySelectorAll(EXT_TABLES.split(',').map(x=>x+' .wl-row[data-t]').join(',')).forEach(row=>{
    const q=row.querySelector('.wl-quote'); if(!q) return;
    let box=q.querySelector('.wl-ext'); const e=EXT_DATA[row.dataset.t];
    if(!reg&&e&&e.none&&(Date.now()/1000-e.t)<=3*3600){
      if(!box){ box=document.createElement('div'); q.appendChild(box); }
      box.className='wl-ext flat'; box.title='아직 '+(e.st==='pre'?'장전':'장후')+' 체결이 없습니다(거래가 적은 종목)';
      const h0='<span class="e-l">'+(e.st==='pre'?'☀ 장전':'🌙 장후')+' 체결 없음</span>'; if(box.innerHTML!==h0) box.innerHTML=h0; return;
    }
    if(reg||!e||e.pct==null||(Date.now()/1000-e.t)>60*3600){ if(box) box.remove(); return; }
    const cls=e.pct>0?'up':e.pct<0?'down':'flat', f=(typeof fmt==='function'?fmt:(v=>v.toFixed(2)));
    const html='<span class="e-l">'+(e.st==='pre'?'☀ 장전':'🌙 장후')+' $'+f(e.px)+'</span> <b>'+(e.pct>0?'▲ +':e.pct<0?'▼ −':'')+Math.abs(e.pct).toFixed(2)+'%</b>';
    if(!box){ box=document.createElement('div'); box.className='wl-ext'; q.appendChild(box); }
    box.className='wl-ext '+cls; box.title=(e.st==='pre'?'장전':'장후')+' 시세 — 정규장 종가 대비 (Yahoo Finance, 수 분 지연 가능)';
    if(box.innerHTML!==html) box.innerHTML=html;
  });
  updateExtSummary();
}
let EXT_BUSY=false;
async function loadExt(){
  if(!PROXY_BASE||!document.getElementById('tick-tbl')&&!document.getElementById('cap-tbl')) return;
  if(usRegularNow()){ applyExtChips(); return; }
  if(EXT_BUSY) return; EXT_BUSY=true;
  try{
    const origin=PROXY_BASE.replace(/\?url=$/,'');
    const KEYS=['TQQQ','SOXL','TECL','QLD','USD','SCHD'];
    const syms=extSymbols().sort((a,b)=>(KEYS.indexOf(b)>=0?1:0)-(KEYS.indexOf(a)>=0?1:0));
    let bad=[];
    /* 한 번에 12종목씩(Worker 동시조회 한도 안), 2묶음 병렬 · 실패(err)한 종목은 저장하지 않고 다시 시도 */
    const fetchB=async b=>{
      try{
        const r=await fetch(origin+'ext?symbols='+b.map(encodeURIComponent).join(','),{signal:AbortSignal.timeout?AbortSignal.timeout(25000):undefined});
        const j=r.ok?await r.json():null;
        if(j&&!j.error){ Object.keys(j).forEach(k=>{ if(j[k]&&j[k].err) bad.push(k); else EXT_DATA[k]=j[k]; }); } else b.forEach(k=>bad.push(k));
      }catch(e){ b.forEach(k=>bad.push(k)); }
    };
    const ch=[]; for(let i=0;i<syms.length;i+=12) ch.push(syms.slice(i,i+12));
    for(let i=0;i<ch.length;i+=2){ await Promise.all(ch.slice(i,i+2).map(fetchB)); applyExtChips(); }
    for(let tryN=0;tryN<2&&bad.length;tryN++){
      await new Promise(r=>setTimeout(r,2500+tryN*2500));
      const rb=bad.splice(0); for(let i=0;i<rb.length;i+=6) await fetchB(rb.slice(i,i+6));
      applyExtChips();
    }
  }catch(e){ console.warn('시간외 시세 로딩 실패:',e); }
  EXT_BUSY=false;
}
if(document.getElementById('tick-tbl')||document.getElementById('cap-tbl')){
  setTimeout(loadExt,2500); setTimeout(updateExtSummary,6000);
  setInterval(loadExt,(window.MK_SAVE?3:1)*90000);
  EXT_TABLES.split(',').forEach(id=>{ const el=document.querySelector(id); if(el&&window.MutationObserver){ let tm; new MutationObserver(()=>{ clearTimeout(tm); tm=setTimeout(()=>{ if(extSymbols().some(s=>!(s in EXT_DATA))) loadExt(); else applyExtChips(); },400); }).observe(el,{childList:true}); } });
}

/* ===================== 소셜 언급(미국주식) — StockTwits + Reddit =====================
   Worker(/social, /social-reddit). 탭(시총 TOP30·관심종목·레버리지)별로 필요한 종목만 조회한다. */
const SOC_SETS={cap:()=>[...TICKGROUPS.cap.list,...TICKGROUPS.cap2.list,...TICKGROUPS.cap3.list], tick:()=>TICKGROUPS.tick.list.slice(), lev:()=>TICKGROUPS.lev.list.slice()};
const SOC={st:{}, rd:null, rdStatus:null, trend:null, cur:'cap', sort:'rate', loaded:{}};
function injectSocCss(){
  if(document.getElementById('soc-css')) return;
  const st=document.createElement('style'); st.id='soc-css';
  st.textContent='#soc-body .sr{display:grid;grid-template-columns:34px minmax(120px,1.1fr) minmax(150px,1.4fr) 76px 76px 70px minmax(160px,2.2fr);align-items:center;gap:10px;padding:9px 10px;border-bottom:1px solid var(--line,#E4E7EC);font-size:12.5px;font-variant-numeric:tabular-nums}'+
  '#soc-body .sr.h{font-size:11.5px;font-weight:800;color:var(--tx2,#475467);background:var(--panel2,#F6F8F7);border-radius:6px;padding:6px 10px}#soc-body .sr.h button{font:inherit;font-weight:800;background:none;border:0;padding:0;color:inherit;cursor:pointer;text-align:left}#soc-body .sr.h button.on{color:var(--tx,#101828);text-decoration:underline}'+
  '#soc-body .sr .rk{font-weight:800;color:var(--tx2,#475467);text-align:center}#soc-body .sr .nm b{font-size:14px;font-weight:900}#soc-body .sr .nm small{display:block;color:var(--tx2,#475467);font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'+
  '#soc-body .bb{display:flex;height:10px;border-radius:5px;overflow:hidden;background:var(--line,#E4E7EC)}#soc-body .bb i{display:block;height:100%}#soc-body .bb .bu{background:#12B76A}#soc-body .bb .be{background:#F04438}'+
  '#soc-body .bt{display:flex;justify-content:space-between;font-size:11.5px;margin-top:2px;font-weight:700}#soc-body .bt .u{color:#05603A}#soc-body .bt .d{color:#B42318}#soc-body .na{color:var(--tx2,#475467)}'+
  '#soc-body .tp a{color:var(--tx,#101828);text-decoration:none;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}#soc-body .tp a:hover{text-decoration:underline}#soc-body .tp small{color:var(--tx2,#475467);font-size:11px}'+
  '#soc-body .hot{display:inline-block;margin-left:4px;padding:1px 6px;border-radius:99px;background:#FEF0C7;color:#7A4B00;font-size:10.5px;font-weight:800}#soc-body .tr{display:inline-block;margin-left:4px;padding:1px 6px;border-radius:99px;background:#EEF4FF;color:#1D3FA6;font-size:10.5px;font-weight:800}'+
  'html[data-theme="dark"] #soc-body .bt .u{color:#6CE9A6}html[data-theme="dark"] #soc-body .bt .d{color:#FDA29B}html[data-theme="dark"] #soc-body .hot{background:#3b2f0a;color:#FEDF89}html[data-theme="dark"] #soc-body .tr{background:#1a2748;color:#B2CCFF}'+
  '@media(max-width:900px){#soc-body .sr{grid-template-columns:28px 1fr auto;grid-template-areas:"rk nm rt" "bb bb bb" "rd rd rd";gap:6px 8px;padding:10px 6px}#soc-body .sr.h{display:none}#soc-body .sr .rk{grid-area:rk}#soc-body .sr .nm{grid-area:nm}#soc-body .sr .c-rt{grid-area:rt;text-align:right}#soc-body .sr .c-wl,#soc-body .sr .c-rd{display:none}#soc-body .sr .c-bb{grid-area:bb}#soc-body .sr .tp{display:none}#soc-body .sr .m-rd{grid-area:rd;display:block;font-size:11.5px;color:var(--tx2,#475467)}}'+
  '#soc-body .soc-more{display:block;width:100%;margin-top:10px;min-height:44px;border:1px solid var(--line,#D5DCD8);border-radius:8px;background:var(--panel,#fff);color:var(--tx,#111418);font:inherit;font-size:13px;font-weight:700;cursor:pointer}'+
  '@media(min-width:901px){#soc-body .sr .m-rd{display:none}}';
  document.head.appendChild(st);
}
function socName(t){ const r=document.querySelector('.wl-row[data-t="'+t+'"] .wl-tag'); return r?r.textContent.replace(/\s+/g,' ').trim():''; }
function socEsc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
async function socFetch(path){
  if(!PROXY_BASE) return null;
  const origin=PROXY_BASE.replace(/\?url=$/,'');
  try{ const r=await fetch(origin+path,{signal:AbortSignal.timeout?AbortSignal.timeout(25000):undefined}); return r.ok?await r.json():null; }catch(e){ console.warn('소셜 로딩 실패',e); return null; }
}
async function socLoad(set){
  const list=SOC_SETS[set]().filter(t=>!(t in SOC.st));
  const jobs=[];
  for(let i=0;i<list.length;i+=15){
    const part=list.slice(i,i+15), first=(SOC.trend===null&&i===0);
    jobs.push(socFetch('social?tickers='+part.map(encodeURIComponent).join(',')+(first?'&trend=1':'')).then(j=>{ part.forEach(t=>{ SOC.st[t]=(j&&j[t])||null; }); if(j&&j._trend) SOC.trend=j._trend; else if(first&&SOC.trend===null) SOC.trend=[]; }));
  }
  if(SOC.rdStatus===null){ const all=[...new Set([...SOC_SETS.cap(),...SOC_SETS.tick(),...SOC_SETS.lev()])]; jobs.push(socFetch('social-reddit?tickers='+all.map(encodeURIComponent).join(',')).then(j=>{ if(j&&j._status==='ok'){ SOC.rd=j; SOC.rdStatus='ok'; mkMiss('rd','Reddit',false); } else { SOC.rdStatus='blocked'; mkMiss('rd','Reddit',true); } })); }
  await Promise.all(jobs);
}
function socRender(){
  const body=document.getElementById('soc-body'); if(!body) return;
  injectSocCss();
  const list=SOC_SETS[SOC.cur]();
  const rows=list.map(t=>{ const s=SOC.st[t]; const tg=s?s.bull+s.bear:0; return {t, s, tg, pctBull:tg>=5?s.bull/tg*100:null, rate:s?s.rate:null, rd:SOC.rd&&SOC.rd[t]?SOC.rd[t]:null}; });
  const key={rate:r=>r.rate==null?-1:r.rate, bull:r=>r.pctBull==null?-1:r.pctBull, bear:r=>r.pctBull==null?-1:100-r.pctBull, rd:r=>r.rd?r.rd.c:-1, watch:r=>r.s&&r.s.watch?r.s.watch:-1}[SOC.sort]||(r=>0);
  rows.sort((a,b)=>key(b)-key(a));
  const got=rows.filter(r=>r.s).length;
  const note=document.getElementById('soc-note'); if(note) note.textContent='· StockTwits 최근 글 30개 기준 · '+got+'/'+rows.length+'종목 수신'+(SOC.rdStatus==='blocked'?' · Reddit 연결 불가':'');
  const sb=(k,l)=>'<button type="button" data-sort="'+k+'" class="'+(SOC.sort===k?'on':'')+'">'+l+(SOC.sort===k?' ▾':'')+'</button>';
  let h='<div class="sr h"><span>#</span><span>종목</span><span>'+sb('bull','강세')+' / '+sb('bear','약세')+'</span><span>'+sb('rate','글 속도')+'</span><span>'+sb('watch','관심등록')+'</span><span>'+sb('rd','Reddit')+'</span><span>대표 글 (원문 링크)</span></div>';
  const SOC_MOB=!!(window.matchMedia&&matchMedia('(max-width:900px)').matches), SOC_N=SOC_MOB?3:10, socOpen=!!(SOC.exp&&SOC.exp[SOC.cur]), socHide=rows.length>SOC_N&&!socOpen;
  rows.forEach((r,i)=>{
    if(socHide&&i>=SOC_N) return;
    const s=r.s, tr=SOC.trend&&SOC.trend.indexOf(r.t.replace('-','.'))>=0?SOC.trend.indexOf(r.t.replace('-','.'))+1:null;
    const hot=s&&s.rate>=15?'<span class="hot" title="최근 글이 시간당 15개 이상 올라오는 중">🔥 급증</span>':'';
    const bb=r.pctBull==null?'<span class="na">태그 글 부족'+(s?' ('+r.tg+'/30)':'')+'</span>':'<div class="bb" role="img" aria-label="강세 '+r.pctBull.toFixed(0)+'% 약세 '+(100-r.pctBull).toFixed(0)+'%"><i class="bu" style="width:'+r.pctBull+'%"></i><i class="be" style="width:'+(100-r.pctBull)+'%"></i></div><div class="bt"><span class="u">강세 '+r.pctBull.toFixed(0)+'%</span><span class="d">약세 '+(100-r.pctBull).toFixed(0)+'%</span></div>';
    const rdTxt=SOC.rdStatus==='ok'?(r.rd?r.rd.c+'건':'0건'):'<span class="na">—</span>';
    const tops=[]; if(s&&s.top&&s.top.url) tops.push('<a href="'+socEsc(s.top.url)+'" target="_blank" rel="noopener nofollow" title="'+socEsc(s.top.body)+'">💬 '+socEsc(s.top.body||'(내용 없음)')+'</a><small>StockTwits · @'+socEsc(s.top.user)+(s.top.likes?' · ♥'+s.top.likes:'')+'</small>');
    if(r.rd&&r.rd.top) tops.push('<a href="'+socEsc(r.rd.top.url)+'" target="_blank" rel="noopener nofollow" title="'+socEsc(r.rd.top.title)+'">🟠 '+socEsc(r.rd.top.title)+'</a><small>Reddit r/'+socEsc(r.rd.top.sub)+' · ▲'+r.rd.top.score+'</small>');
    h+='<div class="sr"><span class="rk">'+(i+1)+'</span><span class="nm"><b>'+r.t+'</b>'+(tr?'<span class="tr" title="StockTwits 트렌딩 '+tr+'위">트렌딩 '+tr+'위</span>':'')+hot+'<small>'+socEsc(socName(r.t))+'</small></span>'+
      '<span class="c-bb">'+bb+'</span><span class="c-rt">'+(s?s.rate.toFixed(1)+'<small class="na"> 글/시</small>':'<span class="na">—</span>')+'</span><span class="c-wl">'+(s&&s.watch?(s.watch>=1e4?(s.watch/1e4).toFixed(1)+'만':s.watch.toLocaleString('ko-KR')):'<span class="na">—</span>')+'</span><span class="c-rd">'+rdTxt+'</span>'+
      '<span class="tp">'+(tops.length?tops.join(''):'<span class="na">수신된 글 없음</span>')+'</span><span class="m-rd">'+(SOC.rdStatus==='ok'?'Reddit 언급 '+(r.rd?r.rd.c:0)+'건 · ':'')+(s&&s.watch?'관심등록 '+(s.watch>=1e4?(s.watch/1e4).toFixed(1)+'만':s.watch):'')+'</span></div>';
  });
  if(rows.length>SOC_N) h+='<button type="button" class="soc-more" data-more="1" aria-expanded="'+socOpen+'">'+(socOpen?'Top '+SOC_N+'만 보기 ▴':'나머지 '+(rows.length-SOC_N)+'종목 상세보기 ▾')+'</button>';
  if(SOC.rdStatus==='blocked') h+='<p class="mut" style="margin:8px 4px 0;font-size:12px">Reddit이 서버 접속을 막아 이번에는 Reddit 언급을 불러오지 못했습니다(임의 값은 넣지 않습니다).</p>';
  body.innerHTML=h;
  try{ const hr=rows.filter(r=>r.s).sort((a,b)=>b.rate-a.rate)[0], hb=rows.filter(r=>r.pctBull!=null).sort((a,b)=>b.pctBull-a.pctBull)[0]; if(hr) window.MK_SOC_SUM='글 속도 1위 '+hr.t+' ('+hr.rate.toFixed(0)+'글/시)'+(hb?' · 강세 최고 '+hb.t+' '+hb.pctBull.toFixed(0)+'%':''); }catch(e){}
}
async function socShow(set){
  SOC.cur=set; const body=document.getElementById('soc-body'); if(!body) return;
  if(!SOC.loaded[set]){ body.innerHTML='<p class="mut" style="font-size:12.5px">StockTwits·Reddit에서 불러오는 중…</p>'; await socLoad(set); SOC.loaded[set]=true; }
  if(SOC.cur===set) socRender();
}
if(document.getElementById('us-social')){
  const box=document.querySelector('.tabs[data-group="soc"]');
  if(box) box.addEventListener('click',e=>{ const b=e.target.closest('button'); if(b&&b.dataset.p) socShow(b.dataset.p); });
  document.getElementById('soc-body').addEventListener('click',e=>{ const m=e.target.closest('button[data-more]'); if(m){ SOC.exp=SOC.exp||{}; SOC.exp[SOC.cur]=!SOC.exp[SOC.cur]; socRender(); return; } const b=e.target.closest('button[data-sort]'); if(b){ SOC.sort=b.dataset.sort; socRender(); } });
  let started=false; const go=()=>{ if(started) return; started=true; socShow('cap'); };
  if('IntersectionObserver' in window){ new IntersectionObserver((es,ob)=>{ if(es.some(x=>x.isIntersecting)){ ob.disconnect(); go(); } },{rootMargin:'400px'}).observe(document.getElementById('us-social')); } else setTimeout(go,3000);
}

/* ===================== 오늘의 행동 알림 · 데이터 미수신 표시 · 공용 데이터 노출 ===================== */
window.MK_DATA=function(){ return {earn:(typeof EARN_DATA!=='undefined'?EARN_DATA:null), div:(typeof DIV_DATA!=='undefined'?DIV_DATA:null), news:(typeof NEWS_DATA!=='undefined'?NEWS_DATA:null), ext:(typeof EXT_DATA!=='undefined'?EXT_DATA:null), soc:(typeof SOC!=='undefined'?SOC:null)}; };
const MK_MISS={};
window.mkMiss=function(key,label,on){
  if(on) MK_MISS[key]=label; else delete MK_MISS[key];
  const ps=document.getElementById('pro-status'); if(!ps) return;
  let e=document.getElementById('ps-miss'); const names=Object.keys(MK_MISS).map(k=>MK_MISS[k]);
  if(!names.length){ if(e) e.remove(); return; }
  if(!e){ e=document.createElement('span'); e.id='ps-miss'; e.className='ps-miss'; e.setAttribute('role','status'); const anchor=document.getElementById('ps-net')||ps.firstChild; if(anchor&&anchor.after) anchor.after(e); else ps.appendChild(e); }
  e.textContent='⚠ 일부 미수신: '+names.join('·'); e.title='제공처 지연·차단 등으로 아래 항목은 이번에 불러오지 못해 비워 두었습니다(임의 값 없음): '+names.join(', ');
};
function mkActionData(){
  const D=window.MK_DATA(), out={earn:[],div:[],hot:[],swing:[]};
  if(D.earn) Object.keys(D.earn).forEach(t=>{ const e=D.earn[t]; if(e&&e.ts){ const d=earnDays(e.ts); if(d>=0&&d<=7) out.earn.push({t,d}); } });
  if(D.div) Object.keys(D.div).forEach(t=>{ const e=D.div[t]; if(e&&e.ex){ const d=earnDays(e.ex); if(d>=0&&d<=7) out.div.push({t,d}); } });
  if(D.soc&&D.soc.st) Object.keys(D.soc.st).forEach(t=>{ const s=D.soc.st[t]; if(s&&s.rate>=15) out.hot.push({t,r:s.rate}); });
  if(D.ext&&!usRegularNow()) Object.keys(D.ext).forEach(t=>{ const e=D.ext[t]; if(e&&e.pct!=null&&Math.abs(e.pct)>=3&&(Date.now()/1000-e.t)<=60*3600) out.swing.push({t,p:e.pct}); });
  out.earn.sort((a,b)=>a.d-b.d); out.div.sort((a,b)=>a.d-b.d); out.hot.sort((a,b)=>b.r-a.r); out.swing.sort((a,b)=>Math.abs(b.p)-Math.abs(a.p));
  return out;
}
window.mkActionData=mkActionData;
function updateActionLine(){
  const st=document.getElementById('pb-state'); if(!st) return;
  const a=mkActionData(); let box=document.getElementById('pb-act');
  const list=(arr,f)=>arr.slice(0,3).map(f).join('·')+(arr.length>3?' 외 '+(arr.length-3):'');
  const parts=[];
  if(a.earn.length) parts.push('<a href="#cap-tbl" data-go="cap">📣 7일 내 실적 <b>'+a.earn.length+'</b> <span>'+list(a.earn,x=>x.t+(x.d===0?'(오늘)':' D-'+x.d))+'</span></a>');
  if(a.div.length) parts.push('<a href="#cap-tbl" data-go="cap">💰 7일 내 배당락 <b>'+a.div.length+'</b> <span>'+list(a.div,x=>x.t+(x.d===0?'(오늘)':' D-'+x.d))+'</span></a>');
  if(a.swing.length) parts.push('<a href="#cap-tbl" data-go="cap">🌙 시간외 ±3% <b>'+a.swing.length+'</b> <span>'+list(a.swing,x=>x.t+' '+(x.p>0?'+':'−')+Math.abs(x.p).toFixed(1)+'%')+'</span></a>');
  if(a.hot.length) parts.push('<a href="#social" data-go="soc">🔥 소셜 급증 <b>'+a.hot.length+'</b> <span>'+list(a.hot,x=>x.t)+'</span></a>');
  if(box) box.remove(); return; /* v42: 오늘의 알림은 '퇴근 후 5분 체크리스트'로 통합 */
  const html='<b class="ac-h">오늘의 알림</b>'+parts.join('');
  if(!box){ box=document.createElement('div'); box.id='pb-act'; box.setAttribute('role','status'); st.after(box);
    box.addEventListener('click',e=>{ const l=e.target.closest('a[data-go]'); if(!l) return; e.preventDefault(); const key=l.dataset.go==='soc'?'소셜':'시총'; const toc=document.getElementById('pro-toc'); const link=toc&&[].slice.call(toc.querySelectorAll('a')).find(x=>x.textContent.trim().indexOf(key)===0); if(link) link.click(); }); }
  if(box.innerHTML!==html) box.innerHTML=html;
}
window.updateActionLine=updateActionLine;
setInterval(()=>{ try{ updateActionLine(); }catch(e){} },5000);


/* 시장 한눈에 보기(모바일): 종목명이 타일 폭보다 길면 글자 크기를 줄여 한 줄로 맞춘다(최소 9px) */
(function(){
  function fit(){
    if(!window.matchMedia||!matchMedia('(max-width:700px)').matches) return;
    document.querySelectorAll('.pulse .hm div.tl>span').forEach(function(sp){
      sp.style.removeProperty('font-size');
      var fs=parseFloat(getComputedStyle(sp).fontSize)||12.5, n=0;
      while(sp.scrollWidth>sp.clientWidth+0.5&&fs>10&&n++<20){ fs-=0.5; sp.style.setProperty('font-size',fs+'px','important'); }
    });
  }
  var t=0, run=function(){ cancelAnimationFrame(t); t=requestAnimationFrame(fit); };
  var watch=function(){
    var p=document.querySelector('.pulse'); if(!p) return false;
    new MutationObserver(run).observe(p,{childList:true,subtree:true}); run(); return true;
  };
  var go=function(){ if(!watch()){ var iv=setInterval(function(){ if(watch()) clearInterval(iv); },800); setTimeout(function(){clearInterval(iv)},30000); } };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',go); else go();
  window.addEventListener('resize',run);
})();


/* 모바일: 레버리지 ETF 종목명이 한 줄을 넘으면 글자 크기를 줄여 한 줄로 맞춘다(최소 10.5px) */
(function(){
  function fitNames(){
    if(!window.matchMedia||!matchMedia('(max-width:700px)').matches) return;
    document.querySelectorAll('#krlev-tbl .wl-name,#lev-tbl .wl-name').forEach(function(el){
      el.style.removeProperty('font-size'); el.querySelectorAll('a').forEach(function(a){ a.style.removeProperty('font-size'); });
      var fs=parseFloat(getComputedStyle(el).fontSize)||15, n=0;
      while(el.scrollWidth>el.clientWidth+0.5&&fs>10.5&&n++<30){ fs-=0.5; el.style.setProperty('font-size',fs+'px','important'); el.querySelectorAll('a').forEach(function(a){ a.style.setProperty('font-size',fs+'px','important'); }); }
    });
  }
  var t=0, run=function(){ cancelAnimationFrame(t); t=requestAnimationFrame(fitNames); };
  var go=function(){
    run(); [1500,4000,9000].forEach(function(ms){ setTimeout(run,ms); });
    var mo=new MutationObserver(function(){ clearTimeout(go._t); go._t=setTimeout(run,250); });
    ['krlev-tbl','lev-tbl'].forEach(function(id){ var e=document.getElementById(id); if(e) mo.observe(e,{childList:true,subtree:true,characterData:true}); });
    window.addEventListener('resize',run);
  };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',go); else go();
})();

;
/* Source: stock-pro-v47.js */
/* Mr.Kim Signal — 전문 도구형 보강 (티커 띠 · 선형 구간 스케일 · 섹터 히트맵) · body.pro 전용 */
(function(){
  if(!document.body || !document.body.classList.contains('pro')) return;
  var US=!!(window.MK_CV&&window.MK_CV.us), UP=US?'#067647':'#D92D20', DN=US?'#C4281B':'#1D4ED8';

  /* 지연 로딩 도우미: 화면 가까이(기본 700px 이내) 오거나, 지정한 시간(delay ms)이 지나면 한 번만 실행.
     첫 화면(공탐·시세 띠)이 네트워크를 먼저 쓰도록 아래쪽 카드는 뒤로 미룬다. 데이터 절약 모드에서는 가까이 올 때만 실행. */
  window.MK_LAZY=function(el,fn,delay,margin){
    var done=false, run=function(){ if(done) return; done=true; if(el&&el.dataset) delete el.dataset.lazy; try{ fn(); }catch(e){ console.warn('지연 로딩 실패',e); } };
    if(el&&el.dataset) el.dataset.lazy='1';
    var save=false; try{ save=!!(window.MK_SAVE||localStorage.getItem('mk_save')==='1'); }catch(e){}
    if(el&&'IntersectionObserver' in window){
      var io=new IntersectionObserver(function(es){ if(es.some(function(x){return x.isIntersecting;})){ io.disconnect(); run(); } },{rootMargin:(margin==null?700:margin)+'px 0px'}); io.observe(el);
    } else { run(); return; }
    if(delay&&!save) setTimeout(run,delay);
  };

  /* 현재 페이지 메뉴 강조 */
  try{
    var file=(location.pathname.split('/').pop()||'index.html');
    document.querySelectorAll('#nav-menu a').forEach(function(a){ if((a.getAttribute('href')||'')===file) a.classList.add('on-page'); });
  }catch(e){}

  /* 공통 시세 조회 (Worker 프록시 경유 · mrkim-common.js 의 getJSON 재사용) */
  async function quote(sym){
    try{
      var j=await getJSON('https://query1.finance.yahoo.com/v8/finance/chart/'+encodeURIComponent(sym)+'?range=5d&interval=1d');
      var r=j.chart.result[0], c=mkFillClose(r).filter(function(x){return x!=null;});
      var p=(r.meta&&r.meta.regularMarketPrice!=null)?r.meta.regularMarketPrice:c[c.length-1];
      var prev=c.length>=2?c[c.length-2]:null;
      if(prev==null||!isFinite(p)) return null;
      return {p:p, prev:prev, pct:(p/prev-1)*100, diff:p-prev};
    }catch(e){ return null; }
  }
  function fmt(v,d){ return v.toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d}); }

  /* ⑩ 신뢰성: 데이터 상태 띠 · 카드별 출처/갱신 · 로딩 정체 감시 */
  var pad2z=function(n){ return n<10?'0'+n:''+n; };
  var hhmm=function(d){ d=d||new Date(); return pad2z(d.getHours())+':'+pad2z(d.getMinutes()); };
  var MKT=window.MKT={meta:{},retry:{},
    line:function(id){ var c=document.getElementById(id); if(!c) return null; if(c.classList.contains('wl-list')){ var sc=c.closest('.scroll')||c, pl=sc.previousElementSibling; if(!pl||!pl.classList||!pl.classList.contains('src-line')){ pl=document.createElement('div'); pl.className='src-line'; sc.before(pl); } return pl; } var l=c.querySelector(':scope > .src-line'); if(!l){ l=document.createElement('div'); l.className='src-line'; var h=c.querySelector(':scope > h3'); if(h) h.after(l); else c.prepend(l); } return l; },
    last:{},
    set:function(id,st){ var l=MKT.line(id); if(!l) return; var m=MKT.meta[id]||'';
      if(st==='ok'){ MKT.last[id]=hhmm(); l.className='src-line'; l.innerHTML='<span>ⓘ 출처 · '+m+'</span><b>갱신 '+MKT.last[id]+'</b>'; }
      else if(st==='static'){ l.className='src-line'; l.innerHTML='<span>ⓘ '+m+'</span>'; }
      else { l.className='src-line fail'; l.innerHTML='<span>⚠ 갱신 실패 — '+(MKT.last[id]?'마지막 성공 '+MKT.last[id]+' 값을 표시 중입니다':'아직 성공한 갱신이 없어 값이 비어 있을 수 있습니다')+' · '+m+'</span>'; var b=document.createElement('button'); b.type='button'; b.textContent='다시 시도'; b.onclick=function(){ b.disabled=true; b.textContent='불러오는 중…'; (MKT.retry[id]||function(){ location.reload(); })(); }; l.appendChild(b); } }
  };
  MKT.meta['tick-tbl']='Yahoo Finance · 지연 시세 가능'; MKT.meta['cap-tbl']='Yahoo Finance · 지연 시세 가능'; MKT.meta['lev-tbl']='Yahoo Finance · 지연 시세 가능'; MKT.meta['idxchg-tbl']='Yahoo Finance · 지연 시세 가능';
  if(typeof window.loadTickGroup==='function'&&!window.__ltgWrapped){ window.__ltgWrapped=1; var __ltg=window.loadTickGroup;
    window.loadTickGroup=async function(g){ var r; try{ r=await __ltg.apply(this,arguments); }catch(e){ r=null; }
      try{ var G=(typeof TICKGROUPS!=='undefined')&&TICKGROUPS[g]; if(G&&G.table&&MKT.meta[G.table]&&document.getElementById(G.table)){ var n=0; G.list.forEach(function(t){ var d=(typeof tickData!=='undefined')&&tickData[t]; if(d&&d.length) n++; }); MKT.set(G.table,n?'ok':'fail'); MKT.retry[G.table]=function(){ G.list.forEach(function(t){ if(!(tickData[t]&&tickData[t].length)) delete tickData[t]; }); window.loadTickGroup(g); }; } }catch(e){}
      return r; }; }
  MKT.meta['pro-sector']='Yahoo Finance(섹터 ETF) · 최대 15분 지연 가능';
  MKT.meta['pro-int']='Yahoo Finance · TradingView · 5분 주기';
  MKT.meta['pro-cal']='TradingView 경제캘린더 · 5분 캐시 · 일정은 변경될 수 있음';
  MKT.meta['pro-fwd']='CNN 공포탐욕지수 × SPY 종가 과거 통계(고정) · 과거 성과는 미래를 보장하지 않음';

  /* ① 티커 띠 */
  var TICK=[['^GSPC','S&P 500',2],['^IXIC','나스닥',2],['^DJI','다우',0],['^RUT','러셀2000',2],['^VIX','VIX',2],['DX-Y.NYB','달러인덱스',2],['^TNX','미10년',3,'%'],['CL=F','WTI',2],['GC=F','금',1],['BTC-USD','비트코인',0],['KRW=X','USD/KRW',1]];
  var hd=document.querySelector('header'), bar=null;
  if(hd){
    bar=document.createElement('div'); bar.id='pro-tick';
    bar.innerHTML='<div class="pt-live"><u></u>LIVE</div><div class="pt" id="pt-fg"><span>미국 공탐</span><b>--</b><i></i></div>'+
      TICK.map(function(t,i){ return '<div class="pt" id="pt-'+i+'"><span>'+t[1]+'</span><b>--</b><i></i></div>'; }).join('');
    hd.appendChild(bar);
  }
  function setFg(){
    var v=document.getElementById('us-val'), s=document.getElementById('us-state'), el=document.getElementById('pt-fg');
    if(!el||!v) return;
    var n=parseFloat((v.textContent||'').replace(/[^\d.]/g,''));
    if(isFinite(n)){ el.querySelector('b').textContent=Math.round(n); el.querySelector('i').textContent=(s&&s.textContent&&s.textContent.indexOf('불러')<0)?s.textContent.trim():''; }
  }
  async function loadTicks(){
    var res=await Promise.all(TICK.map(function(t){ return quote(t[0]); }));
    res.forEach(function(q,i){
      var el=document.getElementById('pt-'+i); if(!el||!q) return;
      var t=TICK[i], b=el.querySelector('b'), c=el.querySelector('i');
      b.textContent=fmt(q.p,t[2])+(t[3]||'');
      if(t[3]==='%'){ c.textContent=(q.diff>=0?'+':'')+fmt(q.diff*100,1)+'bp'; }
      else c.textContent=(q.pct>=0?'+':'')+fmt(q.pct,2)+'%';
      c.className=q.pct>=0?'up':'down';
    });
    setFg();
  }
  loadTicks(); setInterval(loadTicks,60000); setInterval(setFg,3000); setTimeout(setFg,1500);

  /* ② 선형 구간 스케일 (공탐 숫자 기준) */
  var fgtop=document.querySelector('#stock .fg-top');
  if(fgtop){
    var sc=document.createElement('div'); sc.id='pro-scale';
    sc.innerHTML='<div class="bar"><i style="width:25%;background:#C2362B"></i><i style="width:20%;background:#E58A3A"></i><i style="width:10%;background:#C9CED4"></i><i style="width:20%;background:#5DA86B"></i><i style="width:25%;background:#1F7A4D"></i><span class="mk" id="pro-mk" style="left:0"><b id="pro-mkv">--</b></span></div>'+
      '<div class="tk" aria-hidden="true">'+[[0,'0'],[25,'25'],[45,'45'],[55,'55'],[75,'75'],[100,'100']].map(function(t){ return '<span style="left:'+t[0]+'%">'+t[1]+'</span>'; }).join('')+'</div>'+
      '<div class="lb">'+[[12.5,'극단적 공포'],[35,'공포'],[50,'중립'],[65,'탐욕'],[87.5,'극단적 탐욕']].map(function(t){ return '<span style="left:'+t[0]+'%">'+t[1]+'</span>'; }).join('')+'</div>';
    fgtop.after(sc);
    var upd=function(){ var v=document.getElementById('us-val'); if(!v) return; var n=parseFloat((v.textContent||'').replace(/[^\d.]/g,'')); var mk=document.getElementById('pro-mk'); if(mk&&isFinite(n)){ mk.style.left=Math.max(0,Math.min(100,n))+'%'; var us=document.getElementById('us-state'); if(us){ us.style.color=['#C42318','#C2410C','#475467','#3F7D20','#0B6B3A'][n<25?0:n<45?1:n<=55?2:n<=75?3:4]; } var mv=document.getElementById('pro-mkv'); if(mv) mv.textContent=Math.round(n); } };
    var vv=document.getElementById('us-val'); if(vv){ new MutationObserver(upd).observe(vv,{childList:true,characterData:true,subtree:true}); }
    upd(); setInterval(upd,3000);
  }

  /* ③ 섹터 히트맵 (11개 GICS 섹터 ETF) */
  var SEC=[['XLK','기술'],['XLC','커뮤니케이션'],['XLY','경기소비재'],['XLF','금융'],['XLV','헬스케어'],['XLI','산업재'],['XLP','필수소비재'],['XLE','에너지'],['XLU','유틸리티'],['XLRE','부동산'],['XLB','소재']];
  var firstGrid=document.querySelector('#stock .grid');
  if(firstGrid){
    var card=document.createElement('div'); card.className='card'; card.id='pro-sector'; card.style.marginTop='12px';
    card.innerHTML='<h3><span>섹터 히트맵 · 11개 GICS 섹터</span><span class="mut" style="font-weight:400;font-size:11px">섹터 ETF(SPDR) 당일 등락</span></h3><div id="shm-sum" class="shm-sum"></div><div class="shm" id="shm"></div><div class="shm-note">색 = 당일 등락 (빨강 상승 · 파랑 하락) · 타일을 누르면 Finviz 차트로 이동합니다.</div>';
    firstGrid.after(card);
    var shm=card.querySelector('#shm');
    shm.innerHTML=SEC.map(function(s){ return '<a href="https://finviz.com/quote.ashx?t='+s[0]+'" target="_blank" rel="noopener" id="sh-'+s[0]+'" style="background:#F1F2F4"><span>'+s[1]+' <small>('+s[0]+')</small></span><em>--</em></a>'; }).join('');
    var mix=function(p){ var a=Math.min(1,Math.abs(p)/2.5), to=p>=0?(US?[6,118,71]:[217,45,32]):(US?[196,40,27]:[29,78,216]), f=.25+.75*a; return 'rgb('+Math.round(245+(to[0]-245)*f)+','+Math.round(246+(to[1]-246)*f)+','+Math.round(247+(to[2]-247)*f)+')'; };
    var loadSec=async function(){
      var res=await Promise.all(SEC.map(function(s){ return quote(s[0]); }));
      res.forEach(function(q,i){ var el=document.getElementById('sh-'+SEC[i][0]); if(!el||!q) return; var bgc=mix(q.pct); el.style.background=bgc; var rgbm=bgc.match(/\d+/g).map(Number), lum=(0.2126*Math.pow(rgbm[0]/255,2.2)+0.7152*Math.pow(rgbm[1]/255,2.2)+0.0722*Math.pow(rgbm[2]/255,2.2)); var darkTx=lum>0.2; el.style.color=darkTx?'#111418':'#fff'; el.dataset.dk=darkTx?'1':''; el.querySelector('em').textContent=(q.pct>=0?'▲ +':'▼ ')+Math.abs(q.pct).toFixed(2)+'%'; });
      var okq=res.filter(Boolean); MKT.set('pro-sector',okq.length?'ok':'fail'); var u=okq.filter(function(q){return q.pct>0;}).length, d=okq.filter(function(q){return q.pct<0;}).length, sm=document.getElementById('shm-sum');
      if(sm&&okq.length) sm.innerHTML='<div class="ss-bar"><i style="width:'+(u/okq.length*100)+'%;background:'+UP+'"></i><i style="width:'+((okq.length-u-d)/okq.length*100)+'%;background:#C9CED4"></i><i style="width:'+(d/okq.length*100)+'%;background:'+DN+'"></i></div><div class="ss-lb"><b style="color:'+UP+'">▲ 상승 '+u+'개</b><span>'+(okq.length-u-d?'보합 '+(okq.length-u-d)+'개':'')+'</span><b style="color:'+DN+'">하락 '+d+'개 ▼</b></div>';
    };
    MKT.retry['pro-sector']=loadSec; MK_LAZY(card,function(){ loadSec(); setInterval(loadSec,120000); },3000);
  }
  var FWD={"range": ["2019-05-31", "2026-09-10"], "hz": {"20": {"rows": [["극단적 공포", 229, 2.71, 3.04, 70.7, -22.2, 23.1], ["공포", 534, 1.56, 2.15, 71.3, -31.4, 13.8], ["중립", 327, 0.19, 1.06, 61.8, -29.1, 10.5], ["탐욕", 600, 0.75, 1.49, 64.8, -26.5, 7.7], ["극단적 탐욕", 117, 1.28, 1.88, 79.5, -5.8, 5.8]], "end": "2026-09-10"}, "40": {"rows": [["극단적 공포", 229, 5.28, 4.78, 76.4, -11.1, 31.0], ["공포", 530, 2.75, 3.51, 75.8, -18.7, 17.9], ["중립", 317, 0.86, 1.84, 66.2, -25.2, 12.4], ["탐욕", 594, 1.86, 3.13, 75.3, -32.2, 10.6], ["극단적 탐욕", 117, 0.1, 1.78, 60.7, -27.6, 9.6]], "end": "2026-08-12"}, "60": {"rows": [["극단적 공포", 229, 7.01, 6.53, 81.7, -9.0, 39.8], ["공포", 518, 3.56, 4.24, 74.9, -18.4, 19.2], ["중립", 316, 3.09, 4.5, 76.3, -17.6, 15.4], ["탐욕", 587, 3.4, 4.49, 78.4, -21.8, 12.8], ["극단적 탐욕", 117, -2.24, 1.67, 53.8, -30.6, 11.4]], "end": "2026-07-15"}, "80": {"rows": [["극단적 공포", 228, 7.35, 7.26, 75.4, -13.3, 43.9], ["공포", 500, 5.39, 6.29, 73.8, -16.0, 24.5], ["중립", 315, 4.54, 5.65, 81.0, -17.6, 20.6], ["탐욕", 587, 4.4, 6.39, 80.1, -28.9, 15.0], ["극단적 탐욕", 117, -2.07, -1.26, 39.3, -23.1, 12.3]], "end": "2026-06-15"}, "100": {"rows": [["극단적 공포", 228, 8.68, 8.56, 75.0, -16.6, 51.1], ["공포", 493, 6.24, 7.39, 78.5, -17.0, 32.2], ["중립", 313, 6.18, 8.13, 81.2, -20.0, 21.7], ["탐욕", 576, 5.2, 7.27, 78.0, -26.5, 18.6], ["극단적 탐욕", 117, 1.29, 2.64, 59.8, -19.8, 15.3]], "end": "2026-05-15"}, "200": {"rows": [["극단적 공포", 208, 12.77, 13.82, 68.8, -18.4, 67.5], ["공포", 470, 9.07, 10.49, 73.6, -23.0, 46.8], ["중립", 293, 11.19, 10.73, 81.9, -24.0, 35.5], ["탐욕", 540, 13.19, 14.41, 90.0, -25.3, 31.7], ["극단적 탐욕", 117, 13.86, 14.28, 96.6, -13.3, 24.9]], "end": "2025-12-19"}}, "rows": [["극단적 공포", 229, 2.71, 3.04, 70.7, -22.2, 23.1], ["공포", 534, 1.56, 2.15, 71.3, -31.4, 13.8], ["중립", 327, 0.19, 1.06, 61.8, -29.1, 10.5], ["탐욕", 600, 0.75, 1.49, 64.8, -26.5, 7.7], ["극단적 탐욕", 117, 1.28, 1.88, 79.5, -5.8, 5.8]]};

  /* ④ 시장 내부지표 · 구간별 이후 20거래일 성과 · 경제지표 */
  var anchor=document.getElementById('pro-sector')||firstGrid;
  if(anchor){
    var WORKER=PROXY_BASE.replace(/\?url=$/,'').replace(/\/+$/,'');
    var ZN=['극단적 공포','공포','중립','탐욕','극단적 탐욕'];
    var zoneOf=function(n){ return n<25?0:n<45?1:n<56?2:n<76?3:4; };
    var sg=function(v,d){ return (v>=0?'+':'')+v.toFixed(d==null?2:d); };

    var row=document.createElement('div'); row.className='pro-row';
    row.innerHTML=
      '<div class="card" id="pro-int"><h3><span>시장 내부지표 · 변동성 · 추세</span><span class="mut" style="font-weight:400;font-size:11px">Yahoo · TradingView</span></h3>'+
      '<div class="pi-sub">VIX 기간구조 <span id="vts-badge" class="vbadge">--</span></div>'+
      '<div id="vts" class="vts-wrap"></div><div class="vts-stats" id="vts-stats"></div><div class="pi-note" id="vts-note"></div>'+
      '<div class="pi-sub">지수 추세 (이동평균 대비 · 52주 고점 대비)</div>'+
      '<div id="pi-tr" class="trd"></div><div class="trd-lg"><span><i class="m m200"></i>200일선</span><span><i class="m m50"></i>50일선</span><span><i class="px"></i>현재가</span><span class="mut">막대 = 52주 저점 ~ 고점</span></div>'+
      '</div>'+
      '<div class="card" id="pro-fwd"><h3><span>공탐 구간별 이후 <span id="fwd-hn">20</span>거래일 성과</span><span class="mut" style="font-weight:400;font-size:11px" id="fwd-rg">S&amp;P500(SPY)</span></h3><div class="tabs fwd-tabs" id="fwd-tabs" role="group" aria-label="보유 기간 선택"><button class="on" data-h="20">20일</button><button data-h="40">40일</button><button data-h="60">60일</button><button data-h="80">80일</button><button data-h="100">100일</button><button data-h="200">200일</button></div><div id="fwd-body"></div></div>';
    anchor.after(row);

    /* ── 20거래일 성과 카드 ── */
    var curH='20';
    var renderFwd=function(){
      var vEl=document.getElementById('us-val'), cn=vEl?parseFloat((vEl.textContent||'').replace(/[^\d.]/g,'')):NaN, cz=isFinite(cn)?zoneOf(cn):-1;
      var H=curH, R=FWD.hz[H].rows, lo=0, hi=0;
      var hn=document.getElementById('fwd-hn'); if(hn) hn.textContent=H; var rg=document.getElementById('fwd-rg'); if(rg) rg.textContent='S&P500(SPY) · '+FWD.range[0]+' ~ '+FWD.hz[H].end;
      R.forEach(function(r){ lo=Math.min(lo,r[2]); hi=Math.max(hi,r[2]); });
      var zp=(-lo/(hi-lo||1))*100;
      var h='<div class="fwd-cur">'+(cz>=0?'현재 공탐 <b>'+Math.round(cn)+'</b> · <b>'+ZN[cz]+'</b> 구간 — 과거 이 구간의 이후 '+H+'거래일 평균 <b class="'+(R[cz][2]>=0?'up':'down')+'">'+sg(R[cz][2])+'%</b>, 상승확률 <b>'+R[cz][4].toFixed(1)+'%</b>':'현재 공탐 값을 불러오는 중…')+'</div>';
      var HS=['20','40','60','80','100','200']; h+='<div class="pi-sub">구간 × 보유기간 평균 수익률 (한눈에 비교)</div><table class="pi-tbl fwd-mx"><thead><tr><th>구간</th>'+HS.map(function(k){ return '<th'+(k===H?' class="on"':'')+'>'+k+'일</th>'; }).join('')+'</tr></thead><tbody>'+R.map(function(r,i){ return '<tr'+(i===cz?' class="cur"':'')+'><td><b>'+r[0]+'</b></td>'+HS.map(function(k){ var v=FWD.hz[k].rows[i][2]; return '<td class="'+(v>=0?'up':'down')+(k===H?' on':'')+'">'+sg(v,1)+'%</td>'; }).join('')+'</tr>'; }).join('')+'</tbody></table>';
      var wasOpen=!!document.querySelector('#fwd-body details.fwd-more[open]');
      h+='<details class="fwd-more"'+(wasOpen?' open':'')+'><summary>상세 보기 · 통계표 · 막대 · 수익률 범위</summary>';
      h+='<table class="pi-tbl"><thead><tr><th>구간</th><th>표본</th><th>평균</th><th>중앙값</th><th>상승확률</th><th>최악</th></tr></thead><tbody>'+
        R.map(function(r,i){ return '<tr'+(i===cz?' class="cur"':'')+'><td><b>'+r[0]+'</b></td><td>'+r[1]+'</td><td class="'+(r[2]>=0?'up':'down')+'">'+sg(r[2])+'%</td><td>'+sg(r[3])+'%</td><td>'+r[4].toFixed(1)+'%</td><td class="down">'+r[5].toFixed(1)+'%</td></tr>'; }).join('')+'</tbody></table>';
      h+='<div class="pi-sub">평균 수익률 · 상승확률</div><div class="fwd-bars">'+
        R.map(function(r,i){
          var w=Math.abs(r[2])/((hi-lo)||1)*100, left=r[2]>=0?zp:zp-w;
          return '<div class="fb'+(i===cz?' cur':'')+'"><span>'+r[0]+'</span><i class="fb-avg"><u class="zero" style="left:'+zp+'%"></u><u class="bar '+(r[2]>=0?'up':'down')+'" style="left:'+left+'%;width:'+w+'%"></u></i><b class="'+(r[2]>=0?'up':'down')+'">'+sg(r[2])+'%</b>'+
            '<i class="fb-win"><u class="half"></u><u class="bar" style="width:'+r[4]+'%"></u></i><b>'+r[4].toFixed(0)+'%</b></div>';
        }).join('')+'</div><div class="fb-legend"><span><i class="lg lg-a"></i>평균 수익률</span><span><i class="lg lg-w"></i>상승확률 (│ = 50%)</span></div>';
      var RL=Math.floor(Math.min.apply(null,R.map(function(r){return r[5];}))/5)*5, RH=Math.ceil(Math.max.apply(null,R.map(function(r){return r[6];}))/5)*5, rp=function(v){ return ((v-RL)/(RH-RL)*100); };
      h+='<div class="pi-sub">'+H+'거래일 수익률 범위 · 최악 ~ 최고 (● 평균)</div><div class="fwd-rng">'+
        R.map(function(r,i){ return '<div class="fr'+(i===cz?' cur':'')+'"><span>'+r[0]+'</span><i><u class="zero" style="left:'+rp(0)+'%"></u><u class="rng" style="left:'+rp(r[5])+'%;width:'+(rp(r[6])-rp(r[5]))+'%"></u><u class="dot" style="left:'+rp(r[2])+'%"></u></i><em>'+r[5].toFixed(0)+'% ~ +'+r[6].toFixed(0)+'%</em></div>'; }).join('')+'</div>';
      h+='</details>';
      /* 데이터에서 계산한 요약 */
      var bestA=R.reduce(function(a,r){return r[2]>a[2]?r:a;}), bestW=R.reduce(function(a,r){return r[4]>a[4]?r:a;}), worstD=R.reduce(function(a,r){return r[5]<a[5]?r:a;});
      var fn=R[0][1]+R[1][1], fa=(R[0][2]*R[0][1]+R[1][2]*R[1][1])/fn, fw=(R[0][4]*R[0][1]+R[1][4]*R[1][1])/fn;
      h+='<ul class="fwd-ins"><li>공포 이하(극단적 공포+공포) 합산: 평균 <b>'+sg(fa)+'%</b> · 상승확률 <b>'+fw.toFixed(1)+'%</b> (중립 '+R[2][4].toFixed(1)+'%)</li>'+
        '<li>평균 수익률이 가장 높은 구간 <b>'+bestA[0]+'</b> ('+sg(bestA[2])+'%), 상승확률이 가장 높은 구간 <b>'+bestW[0]+'</b> ('+bestW[4].toFixed(1)+'%)</li>'+
        '<li>최악 낙폭이 가장 컸던 구간은 <b>'+worstD[0]+'</b> ('+worstD[5].toFixed(1)+'%) — 평균이 좋아도 개별 시점의 손실 폭은 큽니다</li></ul>'+
        '<div class="pi-note">공탐 일별 값이 해당 구간이던 날의 종가 기준 이후 '+H+'거래일 수익률(배당 미포함)입니다. 날짜가 겹치는 표본이라 독립적인 횟수가 아니며, 과거 통계가 미래를 보장하지 않습니다.</div>';
      document.getElementById('fwd-body').innerHTML=h;
    };
    var fwdTabs=document.getElementById('fwd-tabs');
    if(fwdTabs) fwdTabs.addEventListener('click',function(e){ var b=e.target.closest('button'); if(!b) return; curH=b.dataset.h; fwdTabs.querySelectorAll('button').forEach(function(x){ x.classList.toggle('on',x===b); }); renderFwd(); });
    renderFwd(); setInterval(renderFwd,5000);

    /* ── 경제지표 카드 ── */
    var cal=document.createElement('div'); cal.className='card'; cal.id='pro-cal'; cal.style.marginTop='12px';
    cal.innerHTML='<h3><span>경제지표 · 핵심 일정</span><span class="mut" style="font-weight:400;font-size:11px">최상 일정 3건만 표시 · 나머지는 상세보기</span></h3>'+
      '<div id="cal-top"></div><div id="cal-body"><div class="pi-note">불러오는 중…</div></div><div id="cal-more"></div><div class="pi-note" id="pc-note"></div>';
    row.after(cal);
    var CAL={mode:'fallback',rows:[],open:false};
    var KOPPL={Powell:'파월',Waller:'월러',Musalem:'무살렘',Collins:'콜린스',Williams:'윌리엄스',Jefferson:'제퍼슨',Barr:'바',Bowman:'보먼',Cook:'쿡',Kashkari:'카시카리',Logan:'로건',Goolsbee:'굴즈비',Daly:'데일리',Bostic:'보스틱',Harker:'하커',Hammack:'해맥',Schmid:'슈미드',Barkin:'바킨',Mester:'메스터',Kugler:'쿠글러',Miran:'미란',Paulson:'폴슨',Bullard:'불라드',Evans:'에번스',Kaplan:'캐플런',Rosengren:'로젠그렌',Lagarde:'라가르드'};
    var KORULES=[
      [/^Fed Interest Rate Decision/i,'연준 기준금리 결정'],[/^FOMC Minutes/i,'FOMC 의사록'],[/^FOMC Press Conference/i,'FOMC 기자회견'],[/^FOMC Economic Projections/i,'FOMC 경제전망(점도표)'],[/^Fed Chair (\w+)/i,function(m){return '연준 의장 '+(KOPPL[m[1]]||m[1])+' 연설';}],
      [/^Fed (\w+) Speech/i,function(m){return '연준 '+(KOPPL[m[1]]||m[1])+' 연설';}],[/^Fed (\w+) Testimony/i,function(m){return '연준 '+(KOPPL[m[1]]||m[1])+' 의회 증언';}],[/^Beige Book/i,'베이지북'],[/^Philly Fed (Employment|New Orders|Prices Paid|CAPEX|Business Conditions)/i,function(m){return '필라델피아 연은 '+({employment:'고용',neworders:'신규주문',pricespaid:'지불물가',capex:'설비투자',businessconditions:'업황'})[m[1].toLowerCase().replace(/ /g,'')];}],[/^Fed Balance Sheet/i,'연준 대차대조표'],[/^Reserve Balances with Fed Banks/i,'연은 지급준비금'],[/^NY Fed Services Activity/i,'뉴욕 연은 서비스업지수'],[/^NY Fed Bill Purchases/i,'뉴욕 연은 단기국채 매입'],[/^Overall Net Capital Flows/i,'순자본 유입(TIC 전체)'],[/^WASDE Report/i,'WASDE 곡물수급전망'],[/^NOPA Crush/i,'NOPA 대두 압착량'],[/^Columbus Day/i,'콜럼버스 데이'],
      [/^Non ?Farm Payrolls/i,'비농업 고용(NFP)'],[/^Unemployment Rate/i,'실업률'],[/^Average Hourly Earnings/i,'평균 시간당 임금'],[/^Average Weekly Hours/i,'평균 주당 근로시간'],[/^Participation Rate/i,'경제활동참가율'],
      [/^Initial Jobless Claims/i,'신규 실업수당 청구'],[/^Continuing Jobless Claims/i,'연속 실업수당 청구'],[/^Jobless Claims 4-week/i,'실업수당 청구 4주 평균'],[/^ADP Employment Change Weekly/i,'ADP 주간 민간고용'],[/^ADP Employment Change/i,'ADP 민간고용'],[/^JOLTs? Job Openings/i,'JOLTS 구인건수'],[/^Challenger Job Cuts/i,'챌린저 감원'],[/^Nonfarm Productivity/i,'비농업 생산성'],[/^Unit Labor Costs/i,'단위노동비용'],[/^Employment Cost Index/i,'고용비용지수'],
      [/^Core Inflation Rate/i,'근원 소비자물가(근원 CPI)'],[/^Inflation Rate/i,'소비자물가(CPI)'],[/^Core CPI/i,'근원 CPI'],[/^CPI Trimmed-Mean/i,'CPI 절사평균'],[/^CPI Median/i,'CPI 중앙값'],[/^CPI/i,'소비자물가지수(CPI)'],
      [/^Core PPI/i,'근원 생산자물가(근원 PPI)'],[/^PPI Ex Food/i,'PPI(식품·에너지 제외)'],[/^PPI/i,'생산자물가(PPI)'],[/^Core PCE Price Index/i,'근원 PCE 물가지수'],[/^PCE Price Index/i,'PCE 물가지수'],[/^Personal Income/i,'개인소득'],[/^Personal Spending/i,'개인소비지출'],[/^Export Prices/i,'수출물가'],[/^Import Prices/i,'수입물가'],
      [/^GDP Growth Rate/i,'GDP 성장률'],[/^GDP Price Index/i,'GDP 물가지수'],[/^Atlanta Fed GDPNow/i,'애틀랜타 연은 GDPNow'],[/^GDP Deflator/i,'GDP 디플레이터'],[/^Gross Domestic Product/i,'GDP'],
      [/^ISM Manufacturing PMI/i,'ISM 제조업 PMI'],[/^ISM Services PMI/i,'ISM 서비스업 PMI'],[/^ISM Manufacturing Prices/i,'ISM 제조업 물가지수'],[/^ISM Manufacturing Employment/i,'ISM 제조업 고용'],[/^ISM Manufacturing New Orders/i,'ISM 제조업 신규주문'],[/^S&P Global Manufacturing PMI/i,'S&P글로벌 제조업 PMI'],[/^S&P Global Services PMI/i,'S&P글로벌 서비스업 PMI'],[/^S&P Global Composite PMI/i,'S&P글로벌 종합 PMI'],[/^Chicago PMI/i,'시카고 PMI'],
      [/^Philadelphia Fed Manufacturing/i,'필라델피아 연은 제조업지수'],[/^NY Empire State Manufacturing/i,'뉴욕 엠파이어스테이트 제조업지수'],[/^Richmond Fed Manufacturing/i,'리치먼드 연은 제조업지수'],[/^Kansas Fed Manufacturing/i,'캔자스시티 연은 제조업지수'],[/^Dallas Fed Manufacturing/i,'댈러스 연은 제조업지수'],[/^Industrial Production/i,'산업생산'],[/^Capacity Utilization/i,'설비가동률'],[/^Manufacturing Production/i,'제조업 생산'],
      [/^Michigan Consumer Sentiment/i,'미시간대 소비자심리지수'],[/^Michigan Inflation Expectations/i,'미시간대 기대인플레이션'],[/^Michigan 5 Year Inflation/i,'미시간대 5년 기대인플레이션'],[/^CB Consumer Confidence/i,'컨퍼런스보드 소비자신뢰지수'],[/^Consumer Confidence/i,'소비자신뢰지수'],[/^NFIB Business Optimism/i,'NFIB 소기업 낙관지수'],[/^CB Leading Index/i,'컨퍼런스보드 경기선행지수'],
      [/^Retail Sales Control Group/i,'소매판매(컨트롤 그룹)'],[/^Retail Sales Ex Autos/i,'소매판매(자동차 제외)'],[/^Retail Sales Ex Gas/i,'소매판매(자동차·휘발유 제외)'],[/^Retail Sales/i,'소매판매'],[/^Redbook/i,'레드북 소매판매'],[/^Durable Goods Orders Ex Transportation/i,'내구재 주문(운송 제외)'],[/^Durable Goods Orders/i,'내구재 주문'],[/^Core Durable Goods Orders/i,'근원 내구재 주문'],[/^Factory Orders/i,'공장재 주문'],[/^Business Inventories/i,'기업재고'],[/^Wholesale Inventories/i,'도매재고'],
      [/^Housing Starts/i,'주택착공'],[/^Building Permits/i,'건축허가'],[/^Existing Home Sales/i,'기존주택 매매'],[/^New Home Sales/i,'신규주택 매매'],[/^Pending Home Sales/i,'잠정주택 매매'],[/^NAHB Housing Market Index/i,'NAHB 주택시장지수'],[/^Case.?Shiller/i,'케이스-실러 주택가격'],[/^FHFA House Price/i,'FHFA 주택가격지수'],[/^MBA 30-Year Mortgage Rate/i,'MBA 30년 모기지 금리'],[/^MBA Mortgage Applications/i,'MBA 모기지 신청'],[/^MBA Mortgage Market Index/i,'MBA 모기지 시장지수'],[/^MBA Purchase Index/i,'MBA 주택구입 지수'],[/^MBA Mortgage Refinance/i,'MBA 재융자 지수'],
      [/^Trade Balance/i,'무역수지'],[/^Goods Trade Balance/i,'상품 무역수지'],[/^Current Account/i,'경상수지'],[/^Monthly Budget Statement/i,'월간 재정수지'],[/^Net Long-term TIC Flows/i,'해외 장기증권 순유입(TIC)'],[/^Foreign Bond Investment/i,'해외 채권 투자'],[/^Consumer Credit Change/i,'소비자신용 변동'],
      [/^API Crude Oil Stock Change/i,'API 원유 재고 변동'],[/^EIA Crude Oil Stocks Change/i,'EIA 원유 재고 변동'],[/^EIA Gasoline Stocks Change/i,'EIA 휘발유 재고 변동'],[/^EIA Distillate/i,'EIA 정제유 재고 변동'],[/^EIA Natural Gas Stocks Change/i,'EIA 천연가스 재고 변동'],[/^EIA Refinery Crude Runs/i,'EIA 정유시설 가동'],[/^EIA Cushing/i,'EIA 쿠싱 원유 재고'],[/^Baker Hughes Oil Rig Count/i,'베이커휴즈 원유 시추기 수'],[/^Baker Hughes Total Rig Count/i,'베이커휴즈 전체 시추기 수'],[/^Crude Oil Imports/i,'원유 수입'],
      [/^(\d+)-Year (Note|Bond) Auction/i,function(m){return m[1]+'년물 국채 입찰';}],[/^(\d+)-Month Bill Auction/i,function(m){return m[1]+'개월 단기국채 입찰';}],[/^(\d+)-Week Bill Auction/i,function(m){return m[1]+'주 단기국채 입찰';}],[/^(\d+)-Year TIPS Auction/i,function(m){return m[1]+'년물 물가연동채 입찰';}],[/^(\d+)-Year FRN Auction/i,function(m){return m[1]+'년물 변동금리채 입찰';}]
    ];
    var KOMOD=[[/\bMoM\b/i,'전월비'],[/\bYoY\b/i,'전년비'],[/\bQoQ\b/i,'전분기비'],[/\bPrel\b/i,'예비'],[/\bFinal\b/i,'확정'],[/\bFlash\b/i,'속보'],[/\bAdv\b/i,'속보치'],[/\b2nd Est\b/i,'2차 추정'],[/\b3rd Est\b/i,'3차 추정'],[/\bs\.a\b/i,'계절조정'],[/\bn\.s\.a\b/i,'비계절조정']];
    var koTitle=function(en){
      for(var i=0;i<KORULES.length;i++){ var m=en.match(KORULES[i][0]); if(m){ var base=typeof KORULES[i][1]==='function'?KORULES[i][1](m):KORULES[i][1], mods=[]; KOMOD.forEach(function(x){ if(x[0].test(en)) mods.push(x[1]); }); return base+(mods.length?' ('+mods.join('·')+')':''); } }
      return null;
    };
    var DOW=['일','월','화','수','목','금','토'], pad=function(n){return String(n).padStart(2,'0');};
    var fnum=function(v,e){ if(v==null) return '--'; var x=(Math.abs(v)>=1000?v.toLocaleString('en-US',{maximumFractionDigits:1}):(+v.toFixed(3)).toString()); return x+(e&&e.unit==='%'?'%':''); };
    var buildFallback=function(){
      var now=new Date(), today=new Date(now.getFullYear(),now.getMonth(),now.getDate()), lim=today.getTime()+30*86400000, L=[];
      try{ Object.keys(MONTH_EVENTS).forEach(function(mk){ (MONTH_EVENTS[mk]||[]).forEach(function(e){
        if(e.hol) return; var dt=new Date(now.getFullYear(),+mk-1,e.d); if(dt<today||dt.getTime()>lim) return;
        L.push({d:dt,time:'',imp:e.g==='h'?2:e.g==='m'?1:0,title:e.t,sub:e.c||'',link:e.s}); }); }); }catch(e){}
      L.sort(function(a,b){return a.d-b.d;}); return L;
    };
    var drawCal=function(){
      var body=document.getElementById('cal-body'); if(!body) return;
      var topEl=document.getElementById('cal-top'), nm=Date.now(), nx=null;
      CAL.rows.forEach(function(r){ if(!nx&&r.imp>=2&&r.d.getTime()>=nm-1800000) nx=r; });
      if(topEl){ if(nx){ var diff=nx.d.getTime()-nm, td=new Date(); td=new Date(td.getFullYear(),td.getMonth(),td.getDate()); var dd=Math.round((new Date(nx.d.getFullYear(),nx.d.getMonth(),nx.d.getDate())-td)/86400000);
          var cd=(CAL.mode==='live'&&diff>0&&diff<36e5*24)?(Math.floor(diff/36e5)+'시간 '+Math.floor(diff%36e5/6e4)+'분 후'):(dd===0?'오늘':'D-'+dd);
          topEl.innerHTML='<div class="cal-alert"><span class="ca-tag">최상 · 다음 일정</span><b>'+nx.title+(nx.period?' <small>'+nx.period+'</small>':'')+'</b><span class="ca-when">'+pad(nx.d.getMonth()+1)+'.'+pad(nx.d.getDate())+' ('+DOW[nx.d.getDay()]+')'+(nx.time?' '+nx.time:'')+'</span><em>'+cd+'</em></div>'; } else topEl.innerHTML=''; }
      var hiRows=CAL.rows.filter(function(r){ return r.imp>=2; }).slice(0,3), rest=CAL.rows.length-hiRows.length, rows=CAL.open?CAL.rows:hiRows;
      var mo=document.getElementById('cal-more');
      if(mo){ mo.innerHTML=rest>0?'<button type="button" class="cal-more-btn">'+(CAL.open?'접기 ▴':'상세보기 ▾ · 나머지 '+rest+'건')+'</button>':''; var bt=mo.querySelector('button'); if(bt) bt.onclick=function(){ CAL.open=!CAL.open; drawCal(); }; }
      if(!rows.length){ body.innerHTML='<div class="pi-note" style="padding:8px 0">기간 내 최상 일정이 없습니다.'+(rest>0?' 아래 상세보기에서 나머지 일정을 확인하세요.':'')+'</div>'; return; }
      var today=new Date(); today=new Date(today.getFullYear(),today.getMonth(),today.getDate());
      var nextIdx=-1, nowMs=Date.now();
      rows.forEach(function(r,i){ if(nextIdx<0&&r.d.getTime()>=nowMs-1800000) nextIdx=i; });
      var live=CAL.mode==='live', h='<div class="cal-list'+(live?'':' noval')+'"><div class="cal-hd"><span>시각</span><span>중요도</span><span>지표</span>'+(live?'<span>이전</span><span>예상</span><span>결과</span>':'')+'</div>', last='';
      rows.forEach(function(r,i){
        var k=r.d.getFullYear()+'-'+r.d.getMonth()+'-'+r.d.getDate();
        if(k!==last){ last=k; var dd=Math.round((new Date(r.d.getFullYear(),r.d.getMonth(),r.d.getDate())-today)/86400000);
          h+='<div class="cal-day"><b>'+pad(r.d.getMonth()+1)+'.'+pad(r.d.getDate())+' ('+DOW[r.d.getDay()]+')</b><em>'+(dd===0?'오늘':dd<0?'지남':'D-'+dd)+'</em></div>'; }
        var imp=r.imp>=2?'h':r.imp===1?'m':'l', dots='<span class="imp-dots imp-'+imp+'" title="'+(r.imp>=2?'높음':r.imp===1?'중간':'낮음')+'"><i></i><i></i><i></i></span>';
        var hiTag=r.imp>=2?'<s class="hi-tag">최상</s>':''; var ttl=r.link?'<a href="'+r.link+'" target="_blank" rel="noopener">'+r.title+'</a>':'<b>'+r.title+'</b>';
        var vals='';
        if(live){
          var tone='', badge='';
          if(r.actual!=null&&r.forecast!=null){ if(r.actual>r.forecast){tone='up';badge='<s class="bd up">상회</s>';} else if(r.actual<r.forecast){tone='down';badge='<s class="bd down">하회</s>';} else badge='<s class="bd">부합</s>'; }
          vals='<span class="cv" data-l="이전">'+fnum(r.prev,r)+'</span><span class="cv" data-l="예상">'+fnum(r.forecast,r)+'</span><span class="cv res '+tone+'" data-l="결과">'+(r.actual==null?'<em class="wait">대기</em>':'<b>'+fnum(r.actual,r)+'</b>'+badge)+'</span>';
        }
        h+='<div class="cal-row'+(i===nextIdx?' next':'')+(r.imp>=2?' hi':'')+'"><span class="ct">'+(r.time||'--:--')+'</span><span class="ci">'+dots+'</span><span class="cn">'+ttl+hiTag+(r.period?' <small>'+r.period+'</small>':'')+(r.sub?'<small class="cs">'+r.sub+'</small>':'')+'</span>'+vals+'</div>';
      });
      body.className=CAL.open?'open':''; body.innerHTML=h+'</div>';
    };
    CAL.rows=buildFallback(); drawCal();
    document.getElementById('pc-note').textContent='제목을 누르면 발표 기관 페이지로 이동합니다 · 예상·이전·결과는 집계 서버 연결 시 표시됩니다.';

    var wj=async function(path){ try{ var r=await fetch(WORKER+path,{signal:AbortSignal.timeout?AbortSignal.timeout(9000):undefined}); if(!r.ok){ window.MK_NET&&MK_NET.rec(false); return {err:'HTTP '+r.status}; } var j=await r.json(); var okj=j&&!j.error; window.MK_NET&&MK_NET.rec(!!okj); return okj?j:{err:(j&&j.error)||'빈 응답'}; }catch(e){ window.MK_NET&&MK_NET.rec(false); return {err:String(e.message||e)}; } };
    var loadEcon=async function(){
      var j=await wj('/us-econ?days=14');
      if(!j||j.err||!j.events||!j.events.length){ MKT.set('pro-cal','fail'); return; }
      var KEYRE=/FOMC|Fed Chair|Powell|Nonfarm|Unemployment Rate|Jobless Claims|GDP|PCE|ISM|Retail Sales MoM|Core Inflation|Inflation Rate/i;
      CAL.rows=j.events.map(function(e){
        var d=new Date(e.t); var k=new Date(d.getTime()+9*3600000);
        return {d:d,time:pad(k.getUTCHours())+':'+pad(k.getUTCMinutes()),imp:e.imp>=1?2:(KEYRE.test(e.title)?1:0),title:(koTitle(e.title)||e.title),sub:(koTitle(e.title)?e.title:''),period:e.period,unit:e.unit,actual:e.actual,forecast:e.forecast,prev:e.prev};
      }).sort(function(a,b){return a.d-b.d;});
      /* 표시 시각은 한국시간이지만 날짜 구분도 한국 기준으로 */
      CAL.rows.forEach(function(r){ var k=new Date(r.d.getTime()+9*3600000); r.d=new Date(k.getUTCFullYear(),k.getUTCMonth(),k.getUTCDate(),k.getUTCHours(),k.getUTCMinutes()); });
      CAL.mode='live'; drawCal(); MKT.set('pro-cal','ok');
      document.getElementById('pc-note').innerHTML='출처: TradingView 경제캘린더(집계 서버 경유, 5분 캐시) · 미국 · 시각은 한국시간(KST). 예상치는 발표가 임박해야 채워지는 항목이 많습니다. 결과가 예상보다 크면 <b style="color:var(--up)">상회(빨강)</b>, 작으면 <b style="color:var(--down)">하회(파랑)</b>입니다.';
    };
    MKT.retry['pro-cal']=loadEcon; MK_LAZY(cal,function(){ loadEcon(); setInterval(loadEcon,300000); },4200);

    /* ── VIX 기간구조 곡선 ── */
    var vixSvg=function(pts,st,cw){
      var W=Math.max(300,Math.min(560,cw||360)),H=136,L=18,Rr=18,T=26,B=26, vs=pts.map(function(p){return p.v;}), mn=Math.min.apply(null,vs), mx=Math.max.apply(null,vs), pad2=Math.max(1,(mx-mn)*.35);
      var y0=mn-pad2, y1=mx+pad2, X=function(i){return L+i*(W-L-Rr)/(pts.length-1);}, Y=function(v){return T+(1-(v-y0)/(y1-y0))*(H-T-B);};
      var col=st==='inv'?'#D92D20':st==='mix'?'#B7791F':'#0A6B48', line=pts.map(function(p,i){return (i?'L':'M')+X(i).toFixed(1)+' '+Y(p.v).toFixed(1);}).join(' ');
      var area=line+' L'+X(pts.length-1).toFixed(1)+' '+(H-B)+' L'+X(0).toFixed(1)+' '+(H-B)+' Z', sp=Y(pts[1].v);
      return '<svg viewBox="0 0 '+W+' '+H+'" class="vsvg" role="img" aria-label="VIX 기간구조 곡선"><line x1="'+L+'" x2="'+(W-Rr)+'" y1="'+(H-B)+'" y2="'+(H-B)+'" stroke="#D5D9DD"/>'+
        '<line x1="'+L+'" x2="'+(W-Rr)+'" y1="'+sp.toFixed(1)+'" y2="'+sp.toFixed(1)+'" stroke="#98A2B3" stroke-dasharray="3 3"/><text x="'+(W-Rr)+'" y="'+(sp-4).toFixed(1)+'" text-anchor="end" font-size="9" fill="#667085">현물 VIX '+pts[1].v.toFixed(1)+'</text>'+
        '<path d="'+area+'" fill="'+col+'" opacity=".10"/><path d="'+line+'" fill="none" stroke="'+col+'" stroke-width="2.2" stroke-linejoin="round"/>'+
        pts.map(function(p,i){ return '<circle cx="'+X(i).toFixed(1)+'" cy="'+Y(p.v).toFixed(1)+'" r="4" fill="#fff" stroke="'+col+'" stroke-width="2"/><text x="'+X(i).toFixed(1)+'" y="'+(Y(p.v)-9).toFixed(1)+'" text-anchor="middle" font-size="12" font-weight="700" font-family="JetBrains Mono,monospace" fill="#111418">'+p.v.toFixed(2)+'</text><text x="'+X(i).toFixed(1)+'" y="'+(H-9)+'" text-anchor="middle" font-size="10.5" fill="#667085">'+p.l+'</text>'; }).join('')+'</svg>';
    };

    async function hist(sym){
      try{
        var j=await getJSON('https://query1.finance.yahoo.com/v8/finance/chart/'+encodeURIComponent(sym)+'?range=1y&interval=1d');
        var r=j.chart.result[0], c=mkFillClose(r).filter(function(x){return x!=null;});
        var p=(r.meta&&r.meta.regularMarketPrice!=null)?r.meta.regularMarketPrice:c[c.length-1];
        if(c.length<60) return null;
        var avg=function(n){ var s=c.slice(-n); return s.reduce(function(a,b){return a+b;},0)/s.length; };
        return {p:p, m50:avg(50), m200:c.length>=200?avg(200):null, hi:Math.max.apply(null,c.concat([p])), lo:Math.min.apply(null,c.concat([p]))};
      }catch(e){ return null; }
    }
    var pc=function(a,b){ return (a/b-1)*100; };
    var cell=function(v){ return v==null?'<td class="mut">--</td>':'<td class="'+(v>=0?'up':'down')+'">'+sg(v,1)+'%</td>'; };
    var loadInt=async function(){
      var VS=[['^VIX9D','9일'],['^VIX','30일'],['^VIX3M','3개월'],['^VIX6M','6개월']];
      var vq=await Promise.all(VS.map(function(s){return quote(s[0]);}));
      var ok=vq.every(Boolean), box=document.getElementById('vts'), bd=document.getElementById('vts-badge'), stt=document.getElementById('vts-stats'), nt=document.getElementById('vts-note');
      if(ok){
        var v=vq.map(function(q){return q.p;}), inc=v[0]<=v[1]&&v[1]<=v[2]&&v[2]<=v[3], inv=v[0]>v[2]||v[1]>v[2], st=inv?'inv':(inc?'norm':'mix');
        box.innerHTML=vixSvg(VS.map(function(s,i){return {l:s[1],v:v[i]};}),st,box.clientWidth-14);
        bd.className='vbadge '+st; bd.textContent=st==='inv'?'역전 (백워데이션)':st==='norm'?'정상 (콘탱고)':'혼조';
        var sp=v[2]-v[1];
        stt.innerHTML='<div><span>3개월−30일 스프레드</span><b class="'+(sp>=0?'':'warn')+'">'+sg(sp)+'pt ('+sg(sp/v[1]*100,1)+'%)</b></div><div><span>9일 ÷ 30일</span><b class="'+(v[0]/v[1]>1?'warn':'')+'">'+(v[0]/v[1]).toFixed(2)+'</b></div><div><span>6개월−9일</span><b>'+sg(v[3]-v[0])+'pt</b></div>';
        nt.innerHTML='<div class="vts-def">※ <b>'+(st==='norm'?'콘탱고(정상)':st==='inv'?'백워데이션(역전)':'혼조')+'</b> : '+(st==='norm'?'만기가 길수록 VIX가 높은 평시 구조 — 시장이 당장은 안정적이라고 본다는 뜻입니다.':st==='inv'?'단기 VIX가 장기보다 높은 구조 — 당장의 불안이 크다는 경고 신호입니다.':'기간별 VIX 순서가 일정하지 않아 방향이 불분명한 상태입니다.')+'</div>'+(st==='inv'?'<b style="color:var(--up)">곡선이 우하향(역전)</b> — 단기 변동성이 중장기보다 높아 지금 당장의 불안이 크다는 신호입니다.':st==='norm'?'<b>곡선이 우상향(정상)</b> — 단기 &lt; 장기 순으로 올라가는 평시 구조입니다. 기울기가 가파를수록 시장은 안정적이지만 미래 변동성에 대한 보험료도 높게 매겨진 상태입니다.':'곡선이 일부 구간에서 꺾여 있어 방향이 뚜렷하지 않습니다.');
      } else { box.innerHTML='<div class="pi-note">VIX 기간구조 데이터를 불러오지 못했습니다.</div>'; bd.textContent='--'; }
      MKT.set('pro-int',ok?'ok':'fail');
      var IX=['SPY','QQQ','IWM','RSP'];
      var hs=await Promise.all(IX.map(hist));
      document.getElementById('pi-tr').innerHTML=IX.map(function(sy,i){ var h=hs[i];
        if(!h) return '<div class="tr-row"><div class="tr-hd"><b>'+sy+'</b><span class="mut">데이터 없음</span></div></div>';
        var rg=(h.hi-h.lo)||1, pos=function(v){ return Math.max(0,Math.min(100,(v-h.lo)/rg*100)); };
        var st=(h.m200&&h.p>h.m50&&h.m50>h.m200)?['정배열','up']:(h.m200&&h.p<h.m50&&h.m50<h.m200)?['역배열','down']:['혼조',''];
        var chip=function(l,v){ return v==null?'':'<span class="chip '+(v>=0?'up':'down')+'">'+l+' '+sg(v,1)+'%</span>'; };
        return '<div class="tr-row"><div class="tr-hd"><b>'+sy+'</b><span class="st '+st[1]+'">'+st[0]+'</span><span class="chips">'+chip('50일',pc(h.p,h.m50))+chip('200일',h.m200?pc(h.p,h.m200):null)+chip('고점',pc(h.p,h.hi))+'</span></div>'+
          '<div class="tr-bar"><i class="fill" style="width:'+pos(h.p)+'%"></i>'+(h.m200?'<u class="m m200" style="left:'+pos(h.m200)+'%"></u>':'')+'<u class="m m50" style="left:'+pos(h.m50)+'%"></u><u class="px" style="left:'+pos(h.p)+'%"></u></div>'+
          '<div class="tr-sc"><span>저점 '+fmt(h.lo,0)+'</span><span>고점 '+fmt(h.hi,0)+'</span></div></div>'; }).join('');
    };
    MKT.retry['pro-int']=loadInt; MK_LAZY(document.getElementById('pro-int'),function(){ loadInt(); setInterval(loadInt,300000); },3600);
  }

  /* ⑤ 지수 편입·편출 — 지수 선택(전체 / S&P500 / 나스닥100) */
  (function(){
    var host=document.getElementById('idxchg-tbl'), per=document.querySelector('.tabs[data-group="idxchg"]');
    if(!host||!per) return;
    var wrap=document.createElement('div'); wrap.className='tabrow'; per.before(wrap); wrap.appendChild(per);
    var sel=document.createElement('div'); sel.className='seg ixf';
    sel.innerHTML='<button class="on" data-x="">전체</button><button data-x="sp">S&amp;P500</button><button data-x="nq">나스닥100</button>';
    wrap.appendChild(sel);
    var sel2=document.createElement('div'); sel2.className='seg ixf ixio'; sel2.setAttribute('role','group'); sel2.setAttribute('aria-label','편입·편출 구분');
    sel2.innerHTML='<button class="on" data-y="">편입+편출</button><button data-y="in">편입</button><button data-y="out">편출</button>';
    wrap.appendChild(sel2);
    var cur='', curT='', busy=false;
    var apply=function(){
      busy=true;
      host.querySelectorAll('.wl-row').forEach(function(r){ var tag=r.querySelector('.ix'); var is=!cur||(tag&&tag.classList.contains('ix-'+cur)); r.style.display=is?'':'none'; var nx=r.nextElementSibling; if(nx&&/^finx/.test(nx.id||'')&&!is) nx.style.display='none'; });
      Array.prototype.forEach.call(host.children,function(g){
        var lists=g.querySelectorAll('.wl-list'); if(!lists.length) return;
        var cnt=[], typs=[];
        lists.forEach(function(l){ var lb0=l.previousElementSibling, typ=(lb0&&/편출/.test(lb0.textContent||''))?'out':'in'; var n=(curT&&curT!==typ)?0:l.querySelectorAll('.wl-row:not([style*="display: none"])').length; cnt.push(n); typs.push(typ); l.style.display=n?'':'none'; var lab=l.previousElementSibling; if(lab&&lab.className!=='wl-list') lab.style.display=n?'':'none'; });
        var tot=cnt.reduce(function(a,b){return a+b;},0); g.style.display=tot?'':'none';
        var sm=g.querySelector('.mut'); if(sm&&cnt.length>=1&&(cur||curT)) { var ci=0,co=0; typs.forEach(function(t,i){ if(t==='out') co+=cnt[i]; else ci+=cnt[i]; }); sm.textContent='· 편입 '+ci+' · 편출 '+co; }
      });
      var emp=document.getElementById('ixf-empty'); if(emp) emp.remove();
      if((cur||curT)&&!Array.prototype.some.call(host.children,function(g){return g.style.display!=='none'&&g.querySelector&&g.querySelector('.wl-list');})){ var d=document.createElement('div'); d.id='ixf-empty'; d.className='pi-note'; d.textContent='선택한 기간에 해당 지수의 편입·편출 종목이 없습니다.'; host.after(d); }
      busy=false;
    };
    sel.addEventListener('click',function(e){ var b=e.target.closest('button'); if(!b) return; sel.querySelectorAll('button').forEach(function(x){x.classList.toggle('on',x===b);}); cur=b.dataset.x; apply(); });
    sel2.addEventListener('click',function(e){ var b=e.target.closest('button'); if(!b) return; sel2.querySelectorAll('button').forEach(function(x){x.classList.toggle('on',x===b);}); curT=b.dataset.y; apply(); });
    new MutationObserver(function(){ if(!busy&&(cur||curT)) apply(); }).observe(host,{childList:true});
  })();

  /* ⑥ 김군코멘트 시각화 */
  (function(){
    var kc=document.getElementById('us-kimcomment'), row=document.querySelector('#stock .fg-row'); if(!kc||!row) return;
    var box=document.createElement('div'); box.id='pro-kc'; row.after(box);
    var ZC=['#C42318','#C2410C','#566074','#3F7D20','#0B6B3A'], ZN=['극단적 공포','공포','중립','탐욕','극단적 탐욕'], ACT=['매수 시작','매수 시작','관망','매수 금지','매수 금지'];
    var draw=function(){
      var v=document.getElementById('us-val'), n=v?parseFloat((v.textContent||'').replace(/[^\d.]/g,'')):NaN; if(!isFinite(n)) return;
      var nt=document.getElementById('us-note'), dl=nt?(nt.textContent||'').replace(/\s+/g,' ').trim():''; if(!/전일/.test(dl)) dl='';
      var z=n<25?0:n<45?1:n<=55?2:n<=75?3:4, a=ACT[z], pill=function(t,cls){ return '<span class="act '+cls+(a===t?' on':'')+'">'+t+'</span>'; };
      box.innerHTML='<div class="kc" style="--zc:'+ZC[z]+'"><div class="kc-l"><span class="kc-k">김군코멘트</span><div class="kc-t"><em>'+ZN[z]+'</em><i>→</i><b>'+a+'</b></div>'+(dl?'<div class="kc-d '+(/▲/.test(dl)?'up':/▼/.test(dl)?'down':'')+'">'+dl+'</div>':'')+'</div>'+
        '<div class="kc-r">'+pill('매수 시작','buy')+pill('관망','wait')+pill('매수 금지','stop')+'</div></div>';
    };
    var vv=document.getElementById('us-val'); if(vv) new MutationObserver(draw).observe(vv,{childList:true,characterData:true,subtree:true});
    draw(); setInterval(draw,3000);
  })();

  /* ⑦ 종목 재무 패널 · 레버리지 체크패널 후처리 (김군 판정 패턴: 색 제목 줄 · 좌우 균형 · 유의사항) */
  (function(){
    var DISC='<div class="fin-disc"><b>⚠ 투자 유의사항</b><span>이 화면의 등급·판정·지표 해석은 Yahoo Finance 데이터를 바탕으로 한 자체 계산 기준의 <u>참고 자료</u>이며, 특정 종목의 매수·매도를 권유하지 않습니다. 시세·재무 데이터는 제공처 사정에 따라 지연되거나 오차가 있을 수 있고, 투자에 대한 최종 판단과 책임은 투자자 본인에게 있습니다.</span></div>';
    var balance=function(host){
      var wr=null; host.querySelectorAll('div').forEach(function(c){ if(!wr&&c.children.length===2&&/flex-wrap:wrap/.test(c.getAttribute('style')||'')&&/flex:1 1 360px/.test(c.children[0].getAttribute('style')||'')) wr=c; });
      if(!wr) return;
      var c0=wr.children[0], c1=wr.children[1], cards=Array.prototype.slice.call(c0.children).concat(Array.prototype.slice.call(c1.children));
      if(cards.length<3) return;
      var hs=cards.map(function(c){ return c.offsetHeight+12; }), tot=hs.reduce(function(a,b){return a+b;},0), best=1, bd=1e9, acc=0;
      for(var i=0;i<cards.length-1;i++){ acc+=hs[i]; var d=Math.abs(tot/2-acc); if(d<bd){bd=d;best=i+1;} }
      cards.forEach(function(c,i){ (i<best?c0:c1).appendChild(c); });
      wr.classList.add('fin-cols'); c0.classList.add('fin-col'); c1.classList.add('fin-col');
    };
    var procFin=function(host){
      if(host.dataset.pro||!host.children.length||host.querySelector(':scope > p.mut')) return;
      if(!host.querySelector('div[style*="border-radius:12px"]')) return;
      host.dataset.pro='1'; balance(host);
      var d=document.createElement('div'); d.innerHTML=DISC; host.appendChild(d.firstChild);
    };
    var procLev=function(el){
      if(el.dataset.pro) return; el.dataset.pro='1';
      el.querySelectorAll('div[style*="font-size:11.5px;font-weight:800"]').forEach(function(h){
        var g=h.nextElementSibling; if(!g||!/grid/.test(g.getAttribute('style')||'')) return;
        var sec=document.createElement('div'); sec.className='lv-sec'; h.before(sec); h.className='lv-hd'; h.removeAttribute('style'); g.classList.add('lv-body'); sec.appendChild(h); sec.appendChild(g); if(g.children.length>4) sec.classList.add('wide');
      });
      var t=el.querySelector('div[style*="font-size:13px;font-weight:900"]'); if(t){ t.classList.add('lv-title'); t.removeAttribute('style'); }
      var tail=el.lastElementChild; if(tail&&/참고용이며 투자 권유가 아닙니다/.test(tail.textContent||'')){ tail.className='fin-disc'; tail.removeAttribute('style'); tail.innerHTML='<b>⚠ 투자 유의사항</b><span>레버리지 ETF는 일일 수익률을 추종해 장기 보유 시 복리 감쇠로 손실이 커질 수 있으며, 원금 전액 손실도 가능합니다. 이 패널은 Yahoo Finance 데이터와 자체 계산에 기반한 참고 자료로 투자 권유가 아니며, 투자 판단과 책임은 투자자 본인에게 있습니다.</span>'; }
    };
    var pending=false, scan=function(){
      pending=false;
      document.querySelectorAll('[id^="finx"],[id^="fin-"]').forEach(function(h){ if(h.style.display!=='none') procFin(h); });
      document.querySelectorAll('.lev-inv:not([data-pro])').forEach(procLev);
    };
    new MutationObserver(function(){ if(!pending){ pending=true; requestAnimationFrame(scan); } }).observe(document.body,{childList:true,subtree:true});
  })();

  /* ⑧ CNN 7개 세부지표 — 수치를 막대 바로 아래(마커 위치)에 표시 */
  (function(){
    var tb=document.getElementById('us-sub'); if(!tb) return;
    var busy=false, run=function(){
      if(busy) return; busy=true;
      tb.querySelectorAll('tr').forEach(function(tr){
        var bc=tr.querySelector('.sub-bar'), nb=tr.querySelector('td.num b'); if(!bc||!nb) return;
        var mk=bc.querySelector('i'), x=parseFloat((mk&&mk.style.left)||'50');
        var lab=bc.parentNode.querySelector('.sb-val'); if(!lab){ lab=document.createElement('span'); lab.className='sb-val'; bc.parentNode.appendChild(lab); }
        lab.textContent=nb.textContent; lab.style.left=Math.max(9,Math.min(91,isFinite(x)?x:50))+'%';
        tr.classList.add('sb-done');
      });
      busy=false;
    };
    new MutationObserver(function(){ if(!busy) run(); }).observe(tb,{childList:true});
    run();
  })();

  /* ⑨ 모바일 전용 접기/펼치기 (CSS가 700px 이하에서만 본문을 숨김) */
  (function(){
    function mf(card,key){
      if(!card||card.dataset.mf) return; var h=card.querySelector('h3'); if(!h) return;
      card.dataset.mf='1'; card.classList.add('m-fold');
      var b=document.createElement('button'); b.type='button'; b.className='m-fold-btn'; b.innerHTML='<em>펼치기</em> ➕';
      h.appendChild(b);
      var sk='mk_m_'+(card.id||key||'x'); var setO=function(o){ card.classList.toggle('m-open',o); b.innerHTML=o?'<em>접기</em> ➖':'<em>펼치기</em> ➕';  };
      setO(window.matchMedia('(min-width:701px)').matches && card.id!=='pro-cal');
      var tg=function(){ setO(!card.classList.contains('m-open')); };
      h.addEventListener('click',function(e){ if(e.target.closest('a')) return; tg(); });
    }
    var cnn=document.getElementById('us-sub'); if(cnn){ var cc=cnn.closest('.card'); if(cc&&!cc.id) cc.id='pro-cnn'; mf(cc); }
    mf(document.getElementById('pro-int')); mf(document.getElementById('pro-fwd')); mf(document.getElementById('pro-cal'));
  })();

  /* ⑩-b 데이터 상태 띠 + 정적 카드 + 로딩 정체 감시 */
  (function(){
    MKT.set('pro-fwd','static'); var fm=document.getElementById('pro-fwd'); if(fm){ var l=fm.querySelector('.src-line'); if(l) l.innerHTML='<span>ⓘ '+MKT.meta['pro-fwd']+' · 기준일 '+FWD.range[1]+'</span>'; }
    if(!hd) return;
    var st=document.createElement('div'); st.id='pro-status';
    st.innerHTML='<span class="ps-mk" id="ps-mk"></span><span class="ps-net" id="ps-net"></span><span class="ps-t" id="ps-t"></span><span class="ps-n">무료 공개 시세(Yahoo Finance·TradingView·CNN) 기반 · 지연·오류 가능 · 투자 판단 참고용</span><button type="button" id="ps-rf" title="새로고침" aria-label="새로고침">↻</button>';
    hd.after(st);
    document.getElementById('ps-rf').onclick=function(){ location.reload(); };
    var dtf=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',weekday:'short',hour:'numeric',minute:'numeric',hour12:false});
    var mkt=function(){ var p={}; dtf.formatToParts(new Date()).forEach(function(x){p[x.type]=x.value;}); var m=(parseInt(p.hour,10)%24)*60+parseInt(p.minute,10), wd=p.weekday;
      if(wd==='Sat'||wd==='Sun') return ['휴장(주말)','c'];
      if(m>=570&&m<960) return ['정규장 진행 중','o']; if(m>=240&&m<570) return ['프리마켓','p']; if(m>=960&&m<1200) return ['애프터마켓','p']; return ['장 마감','c']; };
    var upd=function(){
      var a=mkt(), mk=document.getElementById('ps-mk'); mk.className='ps-mk '+a[1]; mk.textContent='미국장 '+a[0]; mk.title='뉴욕시간 기준 자동 계산 · 공휴일 휴장은 반영되지 않습니다(휴장일에는 직전 종가가 표시됩니다).';
      var N=window.MK_NET||{log:[],lastOk:0}, lg=N.log.slice(-20), fails=lg.filter(function(x){return !x;}).length, ratio=lg.length?fails/lg.length:0, age=N.lastOk?(Date.now()-N.lastOk)/1000:null;
      var result=window.MK_DATA_STATUS(N,navigator.onLine,Date.now(),window.MK_FG_PHASE),cls=result.code,txt=result.text;
      var n=document.getElementById('ps-net'); n.className='ps-net '+cls; if(n.textContent!=='● '+txt) n.textContent='● '+txt;
      var pt=document.getElementById('ps-t'); pt.className='ps-t'+(age!=null&&age>600?' r':age!=null&&age>300?' w':''); pt.title=age!=null&&age>300?'마지막으로 데이터를 받은 지 '+Math.round(age/60)+'분이 지났습니다. 새로고침(↻)을 눌러 보세요.':'';
      pt.innerHTML=N.lastOk?'<span class="lbl">마지막 갱신 </span>'+hhmm(new Date(N.lastOk))+':'+pad2z(new Date(N.lastOk).getSeconds()):'';
    };
    upd(); setInterval(upd,5000);
    /* 공포탐욕지수 카드: 14초가 지나도 값이 없으면 실패 안내 + 다시 시도 */
    setInterval(function(){
      var v=document.getElementById('us-val'), n=v?parseFloat((v.textContent||'').replace(/[^\d.]/g,'')):NaN, f=document.getElementById('fg-fail'), card=document.getElementById('us-card');
      if(isFinite(n)){ if(f) f.remove(); return; }
      if(!card||f||performance.now()<14000) return;
      f=document.createElement('p'); f.id='fg-fail'; f.className='net-fail'; f.setAttribute('role','alert');
      f.innerHTML='⚠ 공포탐욕지수를 불러오지 못했습니다 (CNN 응답 지연·차단 가능) <button type="button" class="net-retry">다시 시도</button>';
      var b=f.querySelector('button'); b.onclick=function(){ b.disabled=true; b.textContent='불러오는 중…'; try{ if(typeof loadUS==='function') loadUS(); else location.reload(); }catch(e){ location.reload(); } setTimeout(function(){ b.disabled=false; b.textContent='다시 시도'; },6000); };
      var src=card.querySelector('.fg-src'); if(src) src.after(f); else card.appendChild(f);
    },4000);
    /* "불러오는 중…"이 오래 남은 곳은 실패 안내 + 재시도 버튼으로 교체 */
    var watch=function(){
      document.querySelectorAll('.mut,.pi-note').forEach(function(e){
        if((e.textContent||'').trim()!=='불러오는 중…'||e.dataset.wd||e.closest('[data-lazy="1"]')) return; e.dataset.wd='1';
        e.innerHTML='⚠ 데이터를 불러오지 못했습니다 (제공처 지연·차단 가능) <button type="button" class="net-retry">다시 시도</button>';
        e.querySelector('button').onclick=function(){ location.reload(); }; e.classList.add('net-fail'); });
    };
    setTimeout(watch,30000); setTimeout(watch,75000);
  })();

  /* ⑪ 기획·UX: 한 줄 요약 · 목차 · 맨 위로 · 용어 툴팁 */
  (function(){
    var wrap=document.querySelector('#stock > .wrap'); if(!wrap) return;
    var txt=function(id){ var e=document.getElementById(id); return e?(e.textContent||'').trim():''; };
    /* 한 줄 요약 */
    var br=document.createElement('div'); br.id='pro-brief'; br.setAttribute('aria-label','오늘의 시장 요약');
    br.innerHTML='<div class="pb-hd"><b>오늘의 시장 요약</b><span class="pb-sub">핵심 지표를 한눈에 · 각 칸을 누르면 상세로 이동</span></div><p class="pb-line" id="pb-line">시장 상태를 불러오는 중…</p><div class="pb-grid">'+
      '<a class="pb-c" href="#pro-kc" data-go="kc"><small>공포탐욕</small><b id="pb-fg">--</b><span id="pb-fg2"></span></a>'+
      '<a class="pb-c" href="#pro-int" data-go="int"><small>변동성(VIX)</small><b id="pb-vx">--</b><span id="pb-vx2"></span></a>'+
      '<a class="pb-c" href="#pro-cal" data-go="cal"><small>가장 가까운 일정</small><b id="pb-ev">--</b><span id="pb-ev2"></span></a>'+
      '<a class="pb-c" href="#pro-sector" data-go="sec"><small>섹터 강세 · 약세</small><b id="pb-sc">--</b><span id="pb-sc2"></span></a></div></div><div id="pb-fut" hidden></div>';
    var stl=document.createElement('div'); stl.id='pb-state'; stl.setAttribute('role','status'); br.querySelector('.pb-hd').after(stl);
    var lead=wrap.querySelector('.pg-lead'); if(lead) lead.after(br); else wrap.prepend(br);
    var ZC=['#C42318','#B54708','#475467','#3F7D20','#0B6B3A'];
    var num=function(t){ var m=(t||'').match(/-?[\d.]+/); return m?parseFloat(m[0]):NaN; };

    /* ⑰ 장 마감 후 선물(S&P500·나스닥100·다우) — 정규장 종료 후/개장 전에만 시장 요약에 표시.
       기준: 직전 정규장 마감(미 동부 16:00) 시점의 선물 가격 대비 현재 선물 등락 + 마감 이후 15분봉 흐름 */
    var FUT=[['ES=F','S&P500 선물'],['NQ=F','나스닥100 선물'],['YM=F','다우 선물']];
    var nyp=function(ms){ try{ var f=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',hour12:false,weekday:'short',hour:'2-digit',minute:'2-digit'}).formatToParts(new Date(ms)), o={}; f.forEach(function(p){o[p.type]=p.value;}); return {w:o.weekday,h:(+o.hour)%24,m:+o.minute}; }catch(e){ return null; } };
    var usOpen=function(){ var n=nyp(Date.now()); if(!n) return false; if(n.w==='Sat'||n.w==='Sun') return false; var t=n.h*60+n.m; return t>=570&&t<960; };
    var futOne=async function(sym){
      try{
        var j=await getJSON('https://query1.finance.yahoo.com/v8/finance/chart/'+encodeURIComponent(sym)+'?range=5d&interval=15m');
        var r=j.chart.result[0], ts=r.timestamp||[], cl=r.indicators.quote[0].close||[], last=r.meta&&r.meta.regularMarketPrice;
        var ref=-1; for(var i=ts.length-1;i>=0;i--){ if(cl[i]==null) continue; var n=nyp(ts[i]*1000); if(n&&n.h===15&&n.m===45&&n.w!=='Sat'&&n.w!=='Sun'){ ref=i; break; } }
        if(ref<0||last==null) return null;
        var pts=[]; for(var k=ref;k<ts.length;k++) if(cl[k]!=null) pts.push(cl[k]);
        pts.push(last);
        return {p:last, ref:cl[ref], pct:(last/cl[ref]-1)*100, pts:pts};
      }catch(e){ return null; }
    };
    var futSpark=function(pts,col){
      if(pts.length<3) return ''; var W=70,H=34,mn=Math.min.apply(null,pts),mx=Math.max.apply(null,pts),rg=(mx-mn)||1;
      var d=pts.map(function(v,i){ return (i/(pts.length-1)*W).toFixed(1)+','+(H-2-(v-mn)/rg*(H-4)).toFixed(1); }).join(' ');
      return '<svg class="pf-sp" viewBox="0 0 '+W+' '+H+'" width="'+W+'" height="'+H+'" role="img" aria-label="정규장 마감 이후 선물 흐름"><polyline points="'+d+'" fill="none" stroke="'+col+'" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    };
    var futBusy=false, futT=0;
    var fillFut=async function(){
      var box=document.getElementById('pb-fut'); if(!box||futBusy) return;
      var open=usOpen();
      if(Date.now()-futT<55000&&!box.hidden&&box._open===open) return;
      futBusy=true;
      try{
        if(open){
          var SP=[['^GSPC','S&P500'],['^IXIC','나스닥 종합'],['^DJI','다우존스']];
          var rs=await Promise.all(SP.map(async function(f){ try{
            var j=await getJSON('https://query1.finance.yahoo.com/v8/finance/chart/'+encodeURIComponent(f[0])+'?range=1d&interval=5m');
            var r=j.chart.result[0], cl=(r.indicators.quote[0].close||[]).filter(function(x){return x!=null;}), p=r.meta.regularMarketPrice, pv=r.meta.chartPreviousClose;
            if(p==null||!pv) return null; return {p:p,pct:(p/pv-1)*100,pts:cl.concat([p])}; }catch(e){ return null; } }));
          if(!rs.some(Boolean)){ box.hidden=true; return; }
          var fm0=function(v){ return v.toLocaleString('en-US',{maximumFractionDigits:2}); };
          box.innerHTML='<div class="pf-hd"><b>📈 정규장 진행 중 · 미국 3대 지수</b><span>전일 종가 대비 · 장중 5분 흐름</span></div><div class="pf-grid">'+
            SP.map(function(f,i){ var d=rs[i]; if(!d) return '<div class="pf-c"><small>'+f[1]+'</small><b>--</b></div>'; var up=d.pct>=0, col=up?UP:DN;
              return '<div class="pf-c"><div class="pf-t"><small>'+f[1]+'</small><b>'+fm0(d.p)+'</b><span style="color:'+col+'">'+(up?'▲ +':'▼ ')+d.pct.toFixed(2)+'%</span></div>'+futSpark(d.pts,col)+'</div>'; }).join('')+
            '</div><p class="pf-note">장중 시세는 약 15분 지연될 수 있습니다. 출처: Yahoo Finance</p>';
          box.hidden=false; box._open=true; futT=Date.now(); window.__futLine=null;
          var s1=rs[0]; if(s1) window.__spotLine='S&amp;P500 <em>'+(s1.pct>=0?'+':'')+s1.pct.toFixed(2)+'%</em>';
          return;
        }
        window.__spotLine=null; box._open=false;
        var res=await Promise.all(FUT.map(function(f){ return futOne(f[0]); })), ok=res.filter(Boolean);
        if(!ok.length){ box.hidden=true; return; }
        var fm=function(v){ return v.toLocaleString('en-US',{maximumFractionDigits:2}); };
        var n=nyp(Date.now()), wk=n&&(n.w==='Sat'||n.w==='Sun');
        box.innerHTML='<div class="pf-hd"><b>🌙 '+(wk?'주말':'정규장 마감 후')+' 선물 흐름</b><span>정규장 마감(미 동부 16:00) 대비 · 다음 개장 방향 참고용</span></div><div class="pf-grid">'+
          FUT.map(function(f,i){ var d=res[i]; if(!d) return '<div class="pf-c"><small>'+f[1]+'</small><b>--</b></div>';
            var up=d.pct>=0, col=up?UP:DN;
            return '<div class="pf-c"><div class="pf-t"><small>'+f[1]+'</small><b>'+fm(d.p)+'</b><span style="color:'+col+'">'+(up?'▲ +':'▼ ')+d.pct.toFixed(2)+'%</span></div>'+futSpark(d.pts,col)+'</div>'; }).join('')+
          '</div><p class="pf-note">선물은 거의 24시간 거래되며 결제월 차이로 현물 지수와 가격이 다를 수 있어 등락률만 참고하세요. 출처: Yahoo Finance</p>';
        box.hidden=false; box._open=false; futT=Date.now();
        var pl=document.getElementById('pb-line');
        if(pl&&ok.length){ var s0=res[0]||ok[0]; window.__futLine=' · 선물 <em>S&amp;P '+(s0.pct>=0?'+':'')+s0.pct.toFixed(2)+'%</em>'; }
      }finally{ futBusy=false; }
    };
    window.__fillFut=fillFut;
    var fillBrief=function(){
      (function(){ var e=document.getElementById('pb-state'); if(!e) return; var n=nyp(Date.now()), wk=n&&(n.w==='Sat'||n.w==='Sun'), op=usOpen(), tm=hhmm();
        var h=op?'<i class="ps-d on"></i>🟢 정규장 진행 중 · 실시간 시세(약 15분 지연 가능)':wk?'<i class="ps-d"></i>🌙 주말 휴장 · 직전 금요일 종가 기준':'<i class="ps-d"></i>🌙 정규장 마감 · 종가 기준 · 선물은 아래 카드';
        h+='<span class="ps-t">확인 '+tm+'</span>'; if(e._h!==h){ e._h=h; e.innerHTML=h; } })();
      var v=num(txt('us-val')); if(v<0||v>100)v=NaN;
      if(isFinite(v)){ var z=v<25?0:v<45?1:v<=55?2:v<=75?3:4, ZN=['극단적 공포','공포','중립','탐욕','극단적 탐욕'], AC=['매수 시작 구간','매수 시작 구간','관망','매수 금지 구간','매수 금지 구간'];
        var b=document.getElementById('pb-fg'); b.textContent=Math.round(v)+' · '+ZN[z]; b.style.color=ZC[z]; b.parentNode.dataset.z=z; document.getElementById('pb-fg2').textContent='김군코멘트: '+AC[z]; } else {document.getElementById('pb-fg').textContent='—';document.getElementById('pb-fg2').textContent='데이터 확인 필요';delete document.getElementById('pb-fg').parentNode.dataset.z;}
      var vt=document.getElementById('pt-4'), vb=vt?vt.querySelector('b').textContent:'--', bd=txt('vts-badge');
      if(vb&&vb!=='--'){ document.getElementById('pb-vx').textContent=vb; document.getElementById('pb-vx2').textContent=bd&&bd!=='--'?'기간구조 '+bd:''; }
      var al=document.querySelector('#cal-top .cal-alert');
      if(al){ var t=al.querySelector('b'), w=al.querySelector('.ca-when'), c=al.querySelector('em'); document.getElementById('pb-ev').textContent=(t?t.firstChild.textContent:'').trim()||'--'; document.getElementById('pb-ev2').textContent=((c?c.textContent:'')+' · '+(w?w.textContent:'')).replace(/^ · /,''); }
      else if(document.getElementById('cal-body')&&document.querySelector('#cal-body .cal-row, #cal-body tr')){ document.getElementById('pb-ev').textContent='예정된 최상 일정 없음'; document.getElementById('pb-ev2').textContent=''; }
      var arr=[]; document.querySelectorAll('#shm a').forEach(function(a){ var em=a.querySelector('em'), sp=a.querySelector('span'); if(!em||!sp) return; var p=num(em.textContent.replace(/▼\s*/,'-').replace(/▲\s*/,'')); if(isFinite(p)) arr.push([sp.firstChild?sp.firstChild.textContent.trim():'',p]); });
      if(arr.length>3){ arr.sort(function(x,y){return y[1]-x[1];}); var h=arr[0], l=arr[arr.length-1], f=function(x){ return (x[1]>=0?'+':'')+x[1].toFixed(2)+'%'; };
        document.getElementById('pb-sc').innerHTML='<span style="color:'+UP+'">▲ '+h[0]+' '+f(h)+'</span>'; document.getElementById('pb-sc2').innerHTML='<span style="color:'+DN+'">▼ '+l[0]+' '+f(l)+'</span>'; }
      var pl=document.getElementById('pb-line'); if(pl){ var P=[], fv=num(txt('us-val')), vv=num(vb);
        if(isFinite(fv)&&fv>=0&&fv<=100){ var zz=fv<25?'극단적 공포':fv<45?'공포':fv<=55?'중립':fv<=75?'탐욕':'극단적 탐욕'; P.push('공포탐욕 '+Math.round(fv)+' <em>'+zz+'</em>'); }
        if(isFinite(vv)){ var vl=vv<15?'낮음':vv<20?'보통':vv<30?'높음':'매우 높음'; P.push('변동성 <em>'+vl+'</em> (VIX '+vv.toFixed(1)+')'); }
        var ev=(document.getElementById('pb-ev')||{}).textContent; if(ev&&ev!=='--'&&ev.indexOf('없음')<0){ var w=(document.getElementById('pb-ev2')||{}).textContent||''; var dm=w.match(/D[-+]?\d+/); P.push('다음 일정 <em>'+ev+(dm?' '+dm[0]:'')+'</em>'); }
        if(usOpen()){ if(window.__spotLine&&P.length) P.push('장중 '+window.__spotLine); } else if(window.__futLine&&P.length) P.push(window.__futLine.replace(/^ · /,'')); var nh=P.length?P.map(function(x){return '<span class="pb-seg">'+x+'</span>'}).join('')+'<span class="pb-note">참고용 요약 · 투자 권유 아님</span>':'시장 상태를 불러오는 중…';
        if(pl._h!==nh){ pl._h=nh; pl.innerHTML=nh; } }
    };
    var sourceScore=document.getElementById('us-val');if(sourceScore)new MutationObserver(fillBrief).observe(sourceScore,{childList:true,characterData:true,subtree:true});fillBrief(); fillFut(); setInterval(fillFut,60000); setInterval(fillBrief,4000); [2500,6000,12000].forEach(function(t){ setTimeout(fillBrief,t); });
    var openAndGo=function(el){ if(!el) return; var h=el.closest&&el.closest('.fold-body'); if(h&&h.style.display==='none'){ var hh=h.previousElementSibling; if(hh&&hh._set) hh._set(true); } var mc=el.closest&&el.closest('.m-fold'); if(mc&&!mc.classList.contains('m-open')){ var bt=mc.querySelector('.m-fold-btn'); if(bt&&getComputedStyle(bt).display!=='none') bt.click(); } setTimeout(function(){ var off=(document.querySelector('header')?document.querySelector('header').offsetHeight:0)+44; var y=el.getBoundingClientRect().top+window.scrollY-off; window.scrollTo({top:y,behavior:'smooth'}); },60); };
    br.addEventListener('click',function(e){ var a=e.target.closest('a.pb-c'); if(!a) return; e.preventDefault(); openAndGo(document.querySelector(a.getAttribute('href'))); });
    /* 목차 */
    var toc=document.createElement('nav'); toc.id='pro-toc'; toc.setAttribute('aria-label','페이지 목차');
    var ITEMS=[['요약','#pro-brief'],['공탐','#us-card'],['섹터','#pro-sector'],['내부지표','#pro-int'],['일정','#pro-cal'],['지수비교','h:주요 지수 ETF'],['김군 관심종목','h:김군 관심종목'],['시총 TOP10','h:시가총액'],['레버리지','h:레버리지'],['소셜','h:소셜 언급'],['유니콘','h:유니콘'],['이벤트','h:주요 이벤트'],['편입·편출','h:지수 편입']];
    toc.innerHTML=ITEMS.map(function(it,i){ return '<a href="#" data-i="'+i+'">'+it[0]+'</a>'; }).join('');
    var hd2=document.querySelector('header'), st2=document.getElementById('pro-status'); (st2||hd2).after(toc);
    var place=function(){ toc.style.top=(hd2?hd2.offsetHeight:0)+'px'; }; place(); window.addEventListener('resize',place); setTimeout(place,1500);
    toc.addEventListener('click',function(e){ var a=e.target.closest('a'); if(!a) return; e.preventDefault(); var t=ITEMS[+a.dataset.i][1], el;
      if(t.indexOf('h:')===0){ var k=t.slice(2); el=[].slice.call(document.querySelectorAll('h2.fold-h,#stock > .wrap > h2')).find(function(h){ return (h.textContent||'').replace(/\s+/g,' ').trim().indexOf(k)===0; }); if(el&&el._set) el._set(true); }
      else el=document.querySelector(t);
      if(el) openAndGo(el); });
    /* 맨 위로 */
    var up=document.createElement('button'); up.id='pro-top'; up.type='button'; up.setAttribute('aria-label','맨 위로'); up.textContent='↑ 맨 위로';
    up.onclick=function(){ window.scrollTo({top:0,behavior:'smooth'}); }; document.body.appendChild(up);
    window.addEventListener('scroll',function(){ up.classList.toggle('on',window.scrollY>700); },{passive:true});
    /* 용어 툴팁 */
    var GL=[['콘탱고','선물 만기가 길수록 가격(VIX)이 높은 평시 구조입니다.'],['백워데이션','단기 가격이 장기보다 높은 역전 구조로, 단기 불안이 크다는 신호입니다.'],
      ['PSR','주가매출비율 = 시가총액 ÷ 매출. 낮을수록 매출 대비 저렴하다고 봅니다.'],['PEG','PER ÷ 이익성장률. 1 미만이면 성장 대비 저평가로 보는 경향이 있습니다.'],
      ['ROA','총자산이익률. 가진 자산으로 이익을 얼마나 효율적으로 내는지 봅니다.'],['ROE','자기자본이익률. 주주 자본 대비 이익이며, 부채가 많으면 부풀려질 수 있습니다.'],
      ['RSI','상대강도지수(14일). 30 이하 과매도, 70 이상 과열로 해석합니다.'],['EPS','주당순이익. 순이익 ÷ 발행주식 수입니다.'],['PER','주가수익비율 = 주가 ÷ 주당순이익. 높을수록 이익 대비 비싸다고 봅니다.'],
      ['VIX','S&P500 옵션으로 계산한 향후 30일 기대 변동성. 흔히 공포지수라 부릅니다.'],['풋/콜','풋옵션은 하락, 콜옵션은 상승에 거는 계약입니다. 풋이 많으면 공포 쪽입니다.'],['정크본드','신용등급이 낮아 금리가 높은 위험 채권입니다.']];
    var ROOTS='#pro-int,#pro-fwd,#us-sub-note,#pro-sector,[id^="finx"],.lev-inv';
    var SKIP={A:1,BUTTON:1,SUMMARY:1,H3:1,ABBR:1,SCRIPT:1,STYLE:1,INPUT:1,TEXTAREA:1,SVG:1,TEXT:1};
    var gloss=function(){
      document.querySelectorAll(ROOTS).forEach(function(root){
        if(root.offsetParent===null&&root.style.display==='none') return;
        GL.forEach(function(g){
          if(root.querySelector('abbr.gl[data-k="'+g[0]+'"]')) return;
          var re=new RegExp('(^|[^A-Za-z가-힣])('+g[0].replace('/','\\/')+')(?![A-Za-z가-힣])');
          var w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,null), n;
          while((n=w.nextNode())){ var p=n.parentNode; if(!p||SKIP[p.tagName.toUpperCase()]||p.closest('a,button,summary,h3,abbr,svg')) continue; var m=re.exec(n.nodeValue); if(!m) continue;
            var i=m.index+m[1].length, r=n.splitText(i); r.splitText(g[0].length); var ab=document.createElement('abbr'); ab.className='gl'; ab.tabIndex=0; ab.dataset.k=g[0]; ab.dataset.tip=g[1]; ab.textContent=r.nodeValue; r.parentNode.replaceChild(ab,r); break; }
        });
      });
    };
    setTimeout(gloss,5000); setInterval(gloss,6000);
  })();

  /* ⑫ 내 관심종목 — 티커를 직접 추가·삭제(이 브라우저의 localStorage에만 저장) */
  (function(){
    var tbl=document.getElementById('tick-tbl'); if(!tbl||typeof TICKGROUPS==='undefined') return;
    var anchor=tbl.closest('.scroll')||tbl, KEY='mk_my_tickers', MAX=20, RE=/^[A-Z0-9.^=\-]{1,15}$/;
    var load=function(){ try{ var a=JSON.parse(localStorage.getItem(KEY)||'[]'); return Array.isArray(a)?a.filter(function(t){return RE.test(t);}).slice(0,MAX):[]; }catch(e){ return []; } };
    var save=function(a){ try{ localStorage.setItem(KEY,JSON.stringify(a)); }catch(e){} };
    var list=load(); TICKGROUPS.my={table:'my-tbl',list:list};
    var box=document.createElement('div'); box.className='card'; box.id='my-wl'; box.style.marginTop='16px';
    box.innerHTML='<h3><span>⭐ 내 관심종목</span><span class="mut" style="font-weight:400;font-size:11px">이 브라우저에만 저장 · 최대 '+MAX+'개</span></h3>'+
      '<form class="my-add" autocomplete="off"><input type="text" maxlength="15" placeholder="티커 입력 (예: AAPL · NVDA · BRK-B · 005930.KS)" aria-label="추가할 종목 티커"><button type="submit">＋ 추가</button></form>'+
      '<div class="my-msg" role="status"></div><div class="wl-list" id="my-tbl" style="margin-top:8px"></div>';
    var briefEl=document.getElementById('pro-brief'); box.style.marginTop='12px'; if(briefEl) briefEl.after(box); else anchor.after(box);
    var msg=box.querySelector('.my-msg'), inp=box.querySelector('input'), host=box.querySelector('#my-tbl');
    var say=function(t,bad){ msg.textContent=t||''; msg.className='my-msg'+(bad?' bad':''); };
    var rowHtml=function(t){
      var q=encodeURIComponent('$'+t+' from:trendspider');
      return '<div class="wl-row" data-t="'+t+'"><div class="wl-bar"></div><div class="wl-info"><div class="wl-tag">내 관심종목</div><div class="wl-name"><a href="https://finviz.com/quote.ashx?t='+t+'" target="_blank" rel="noopener">'+t+'</a></div></div><div class="wl-spark"></div><div class="wl-quote"><div class="px wl-price">--</div><div class="ch wl-pct">--</div><div class="wl-52w"></div></div>'+
        '<div class="wl-actions"><a href="https://finviz.com/quote.ashx?t='+t+'" target="_blank" rel="noopener" title="Finviz에서 '+t+' 상세 지표 보기">+</a><a href="https://x.com/search?q='+q+'&f=live" target="_blank" rel="noopener" class="ts-link" title="X 검색">X</a><a href="https://finance.yahoo.com/quote/'+t+'/news/" target="_blank" rel="noopener" class="news-link" title="최신 뉴스">N</a>'+
        '<button type="button" class="fin-btn" data-stock-click="toggleUsFinancials(\''+t+'\',\'finmy-\')" title="재무비율·주가지표(Yahoo Finance)">재무</button><button type="button" class="my-del" data-t="'+t+'" title="목록에서 삭제" aria-label="'+t+' 삭제">✕</button></div></div>'+
        '<div id="finmy-'+t+'" style="display:none;padding:14px 16px;border-bottom:1px solid var(--line);background:var(--panel2)"></div>';
    };
    var paint=function(){
      TICKGROUPS.my.list=list;
      host.innerHTML=list.length?list.map(rowHtml).join(''):'<div class="my-empty">아직 추가한 종목이 없습니다. 위 입력칸에 티커를 입력하거나, <button type="button" class="my-ex">예시 5종목 한 번에 추가</button> (NVDA · AAPL · MSFT · TSLA · QQQ)</div>';
      host.classList.toggle('my-fold',list.length>5&&!host.classList.contains('my-all')); var mb=box.querySelector('.my-more'); if(mb) mb.style.display=list.length>5?'':'none';
      if(list.length) renderTick('my',(typeof curPer!=='undefined'&&curPer.tick)||'d');
    };
    var fetchAll=async function(){ await Promise.all(list.map(async function(t){ var d=await yclose(t,'1y'); if(d) tickData[t]=d; })); paint(); };
    box.querySelector('form').addEventListener('submit',async function(e){
      e.preventDefault(); var t=(inp.value||'').trim().toUpperCase();
      if(!t) return; if(!RE.test(t)){ say('티커 형식이 올바르지 않습니다. 영문·숫자 위주로 입력해 주세요.',1); return; }
      if(list.indexOf(t)>=0){ say(t+' 는 이미 목록에 있습니다.',1); return; }
      if(list.length>=MAX){ say('최대 '+MAX+'개까지 추가할 수 있습니다.',1); return; }
      say(t+' 시세 확인 중…'); var d=await yclose(t,'1y');
      if(!d){ say('"'+t+'" 시세를 찾지 못했습니다. 티커를 확인해 주세요(한국 종목은 005930.KS, 코스닥은 .KQ).',1); return; }
      tickData[t]=d; list.push(t); save(list); inp.value=''; say(t+' 추가 완료'); paint();
    });
    var more=document.createElement('button'); more.type='button'; more.className='my-more'; more.style.display='none'; more.textContent='전체 보기 ▾'; more.setAttribute('aria-expanded','false');
    more.onclick=function(){ var o=host.classList.toggle('my-all'); more.textContent=o?'접기 ▴':'전체 보기 ▾'; more.setAttribute('aria-expanded',o?'true':'false'); paint(); };
    host.after(more);
    var addMany=async function(arr){ say('시세 확인 중…'); for(var i=0;i<arr.length;i++){ var t=arr[i]; if(list.indexOf(t)>=0||list.length>=MAX) continue; var d=await yclose(t,'1y'); if(d){ tickData[t]=d; list.push(t); } } save(list); say('추가 완료 · '+list.length+'개'); paint(); };
    window.MK_MY_ADD=function(t){ t=String(t||'').trim().toUpperCase(); if(!RE.test(t)) return Promise.resolve(false); if(list.indexOf(t)>=0) return Promise.resolve(true); return addMany([t]).then(function(){ return list.indexOf(t)>=0; }); };
    host.addEventListener('click',function(e){ if(e.target.closest('.my-ex')){ addMany(['NVDA','AAPL','MSFT','TSLA','QQQ']); return; } });
    var undoTimer=null, removed=null;
    host.addEventListener('click',function(e){ var a=e.target.closest('.my-del'); if(!a) return; var t=a.dataset.t, i=list.indexOf(t); if(i<0)return; clearTimeout(undoTimer); removed={t:t,i:i}; list.splice(i,1); save(list); paint(); say(t+' 삭제 · '); var undo=document.createElement('button'); undo.type='button';undo.textContent='되돌리기';undo.className='stock-undo';msg.appendChild(undo);undoTimer=setTimeout(function(){removed=null;say(t+' 삭제 완료');},5000); });
    msg.addEventListener('click',function(e){if(!e.target.closest('.stock-undo')||!removed)return;var r=removed;clearTimeout(undoTimer);removed=null;if(list.indexOf(r.t)<0&&list.length<MAX){list.splice(Math.min(r.i,list.length),0,r.t);save(list);paint();say(r.t+' 복원 완료');}});
    document.addEventListener('click',function(e){ if(e.target.closest('.tabs[data-group="tick"] button')) setTimeout(function(){ if(list.length) renderTick('my',curPer.tick); },0); });
    paint(); if(list.length) fetchAll(); setInterval(function(){ if(list.length) fetchAll(); },300000);
  })();

  /* ⑬ 접근성 보정: 키보드·스크린리더용 속성을 동적 생성 요소에도 자동 부여 */
  (function(){
    var KEY={Enter:1,' ':1};
    var fix=function(){
      document.querySelectorAll('a[href^="javascript:"]:not([data-a11y])').forEach(function(a){ a.dataset.a11y='1'; a.setAttribute('role','button'); if(!a.hasAttribute('tabindex')) a.tabIndex=0; if(!a.getAttribute('aria-label')) a.setAttribute('aria-label',(a.getAttribute('title')||a.textContent||'').trim()||'버튼');
        a.addEventListener('keydown',function(e){ if(KEY[e.key]){ e.preventDefault(); a.click(); } }); });
      document.querySelectorAll('.wl-actions a:not([data-a11y])').forEach(function(a){ a.dataset.a11y='1'; if(!a.getAttribute('aria-label')){ var t=a.getAttribute('title'); if(t) a.setAttribute('aria-label',t); } });
      document.querySelectorAll('table:not([data-a11y])').forEach(function(t){ t.dataset.a11y='1';
        t.querySelectorAll('thead th:not([scope])').forEach(function(th){ th.setAttribute('scope','col'); });
        if(!t.querySelector('caption')&&!t.getAttribute('aria-label')){ var sec=t.closest('.card,section,.fold-body'); var hd=sec&&(sec.querySelector('h3')||(sec.previousElementSibling&&sec.previousElementSibling.matches('h2')?sec.previousElementSibling:null)||sec.querySelector('h2')); if(hd){ var tx=(hd.querySelector&&hd.querySelector('.fold-t')?hd.querySelector('.fold-t').textContent:hd.textContent).replace(/\s+/g,' ').trim(); if(tx) t.setAttribute('aria-label',tx+' 표'); } } });
      document.querySelectorAll('.wl-spark svg:not([aria-hidden])').forEach(function(sv){ sv.setAttribute('aria-hidden','true'); sv.setAttribute('focusable','false'); });
      document.querySelectorAll('img:not([alt])').forEach(function(im){ im.setAttribute('alt',''); });
      document.querySelectorAll('.tabs button,.seg button,.hm-t button').forEach(function(b){ b.setAttribute('aria-pressed',b.classList.contains('on')?'true':'false'); });
    };
    var timer=null, sched=function(){ if(timer) return; timer=setTimeout(function(){ timer=null; fix(); },350); };
    fix(); new MutationObserver(sched).observe(document.body,{childList:true,subtree:true});
    document.addEventListener('click',function(e){ if(e.target.closest('.tabs,.seg,.hm-t')) setTimeout(fix,60); });
    /* 상태 띠는 상태가 바뀔 때만 스크린리더에 알린다 */
    var pn=document.getElementById('ps-net'); if(pn){ pn.setAttribute('role','status'); pn.setAttribute('aria-live','polite'); }
    var ps=document.getElementById('pro-status'); if(ps){ ps.setAttribute('role','region'); ps.setAttribute('aria-label','데이터 상태'); }
    var tk=document.getElementById('pro-tick'); if(tk){ tk.setAttribute('role','region'); tk.setAttribute('aria-label','주요 시세 띠'); tk.tabIndex=0; }
  })();
})();

;
/* Source: stock-page.js */
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
{ const _st=document.querySelector('#stamp-top'); if(_st) mkStamp(_st,now); }

window.MK_FG_PHASE='loading';renderUS('d'); renderTick('tick','d'); renderTick('cap','d'); renderTick('lev','d');
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


;
/* Source: stock-fin.js */
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

;
/* Source: stock-etf.js */
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
      const data=await loadEtfHoldingsFull(ticker);
      let lev='';
      try{ if(typeof LEV_META!=='undefined'&&LEV_META[ticker]) lev=await renderLevPanel(ticker,data); }catch(e){ console.warn('레버리지 패널 실패',e); }
      el.innerHTML=lev+renderEtfHoldings(data);
      etfHoldLoaded[ticker]=true;
    }
  }else{
    el.style.display='none';
  }
}

;
/* Source: stock-fold-v46.js */
/* 섹션 접기/펼치기 — 동일한 제목 바(폰트 20px·줄간격 1.4), 좌측 포인트 선, 요약 칩, 펼치기/접기 버튼. 기본은 접힘 */
(function(){
  const KR=document.body.classList.contains('kr');
  const SUM_KR={
    '투자자별 매매 동향 · 증시자금동향':()=>'개인·외국인·기관 · 예탁금·신용잔고',
    '코스피·코스닥·대표종목 상대수익률 비교':()=>'그래프 + 상관관계',
    '시가총액 TOP10 (코스피)':()=>'TOP10 (+11~20위)',
    '시가총액 TOP10 (코스닥)':()=>'TOP10 (+11~20위)',
    '레버리지 ETF':()=>'7종목 · 2배 레버리지',
    '주요 이벤트 일정':()=>(new Date().getMonth()+1)+'월 일정 · 휴장일 · 월별 보기',
    'KOSPI200 편입 · 편출 종목':()=>document.querySelectorAll('#kridx-tbl .wl-row').length+'종목 · 2025.12 · 2026.6 정기변경'
  };
  const SUM_US={
    '주요 지수 ETF 상대수익률 비교':()=>'지수 5종 · 그래프 + 상관관계',
    '김군 관심종목':()=>document.querySelectorAll('#tick-tbl .wl-row').length+'종목',
    '시가총액 TOP10':()=>'TOP10 (+11~30위)',
    '레버리지 ETF':()=>document.querySelectorAll('#lev-tbl .wl-row').length+'종목',
    '유니콘 기업':()=>document.querySelectorAll('#unicorn .grid>.card').length+'개사',
    '소셜 언급':()=>window.MK_SOC_SUM||'StockTwits 강세·약세 · Reddit 언급',
    '주요 이벤트 일정':()=>(new Date().getMonth()+1)+'월 일정 · 휴장일 · 월별 보기',
    '지수 편입 · 편출 종목':()=>document.querySelectorAll('#idxchg-tbl .wl-row').length+'종목 · S&P500·나스닥100'
  };
  const SUM=KR?SUM_KR:SUM_US;
  function fold(h2){
    if(!h2||h2.dataset.fold) return; h2.dataset.fold='1';
    const nodes=[]; let n=h2.nextElementSibling;
    while(n && n.tagName!=='H2'){ nodes.push(n); n=n.nextElementSibling; }
    const box=document.createElement('div'); box.className='fold-body'; h2.after(box); nodes.forEach(x=>box.appendChild(x));
    const title=h2.textContent.replace(/\s+/g,' ').trim();
    const key=Object.keys(SUM).find(k=>title.indexOf(k)===0);
    h2.className='fold-h'; h2.removeAttribute('style'); h2.id=h2.id||''; 
    const FL=KR?' 🇰🇷':' 🇺🇸';
    const flag=(title.indexOf('🇺🇸')>=0||title.indexOf('🇰🇷')>=0||key)?FL:'';
    h2.innerHTML='<span class="fold-t">'+(key||title)+flag+'</span><span class="fold-sum"></span><button type="button" class="fold-btn"><em>펼치기</em> ➕</button>';
    /* 제목(h2)의 의미는 유지하고, 펼침 조작은 안의 실제 버튼이 맡는다(키보드·스크린리더 접근) */
    h2.cursor='pointer';
    const sum=h2.querySelector('.fold-sum'), btn=h2.querySelector('.fold-btn'); btn.setAttribute('aria-expanded','false'); box.id=box.id||('fold-body-'+Math.random().toString(36).slice(2,8)); btn.setAttribute('aria-controls',box.id); btn.setAttribute('aria-label',(key||title)+' 펼치기/접기');
    const LST=KR?{'시가총액 TOP10 (코스피)':'krcap-tbl','시가총액 TOP10 (코스닥)':'krkq-tbl','레버리지 ETF':'krlev-tbl'}:{'김군 관심종목':'tick-tbl','시가총액 TOP10':'cap-tbl','레버리지 ETF':'lev-tbl'};
    const movers=id=>{ const a=[]; document.querySelectorAll('#'+id+' .wl-row').forEach(r=>{ const c=r.querySelector('.ch'); if(!c) return; const m=c.textContent.match(/([\d.]+)\s*%/); if(!m) return; const v=parseFloat(m[1])*(/▼|-|−/.test(c.textContent)?-1:1); a.push([r.dataset.t,v]); }); if(a.length<2) return ''; a.sort((x,y)=>y[1]-x[1]); const u=a[0],d=a[a.length-1]; const f=x=>(x[1]>=0?'▲':'▼')+Math.abs(x[1]).toFixed(2)+'%'; const up=a.filter(x=>x[1]>0).length, dn=a.filter(x=>x[1]<0).length; return '<span class="mv"><span class="mv-l">상승 '+up+' · 하락 '+dn+'</span><span class="mv-u">'+u[0]+' '+f(u)+'</span><span class="mv-d">'+d[0]+' '+f(d)+'</span></span>'; };
    const refresh=()=>{ const id=LST[key]; const h=id?movers(id):''; if(h) sum.innerHTML=h; else sum.textContent=key?SUM[key]():''; };
    refresh(); [1500,4000,9000].forEach(t=>setTimeout(refresh,t)); setInterval(refresh,15000);
    const SK=(KR?'mk_fk_':'mk_f_')+(key||title); const set=open=>{  box.style.display=open?'block':'none'; btn.innerHTML=open?'<em>접기</em> ➖':'<em>펼치기</em> ➕'; btn.setAttribute('aria-expanded',open?'true':'false'); h2.classList.toggle('open',open); refresh(); };
    let init=false;
    set(init);
    const tg=e=>{ if(e.target.closest('a')) return; set(box.style.display==='none'); };
    h2.addEventListener('click',tg);
    h2._set=function(open){if(open&&window.MK_REQUEST_DETAIL)window.MK_REQUEST_DETAIL(function(){set(true);});else set(open);};
  }
  document.querySelectorAll('#stock > .wrap > h2, #unicorn > .wrap > h2, #events > .wrap > h2, #kr-stock > .wrap > h2').forEach(fold);
  const all=[...document.querySelectorAll('h2.fold-h')];
  if(all[0]){ const bar=document.createElement('div'); bar.className='fold-all'; bar.innerHTML='<button type="button" data-o="0">모두 접기 ➖</button><button type="button" data-o="1">모두 펼치기 ➕</button>'; var brief=document.getElementById('pro-brief');if(brief)brief.before(bar);else all[0].before(bar); bar.addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b) return; all.forEach(h=>h._set(b.dataset.o==='1'));if(b.dataset.o==='0'){document.querySelectorAll('details[open]:not(.stock-nav-group)').forEach(d=>d.open=false);document.querySelectorAll('.m-fold.m-open').forEach(c=>{var btn=c.querySelector('.m-fold-btn');if(btn)btn.click();});} }); }
  const openByHash=()=>{ const h=location.hash&&document.querySelector(location.hash); if(h&&h._set) h._set(true); };
  window.addEventListener('hashchange',openByHash);
  /* 지연 로딩: 섹션을 처음 펼칠 때(또는 저장된 상태가 '펼침'일 때) 해당 데이터를 불러온다 */
  (KR?[]:[['주요 지수 ETF',()=>{ loadIdxRelUS(); loadUSCorr(); }],['지수 편입',()=>loadTickGroup('idxchg')],['유니콘',()=>loadUnicornNews()]]).forEach(([k,fn])=>{
    let done=false; const run=()=>{ if(done) return; done=true; try{ fn(); }catch(e){ console.warn('지연 로딩 실패',k,e); } };
    const h=all.find(x=>{ const t=x.querySelector('.fold-t'); return t&&t.textContent.trim().indexOf(k)===0; });
    if(!h){ run(); return; }
    if(h.classList.contains('open')) run();
    else new MutationObserver(()=>{ if(h.classList.contains('open')) run(); }).observe(h,{attributes:true,attributeFilter:['class']});
  });
})();

;
/* Source: stock-pulse.js */
(function(){
const q=(id)=>[...document.querySelectorAll('#'+id+' .wl-row')].map(r=>{const c=r.querySelector('.ch'),p=r.querySelector('.px');if(!c||!p)return null;const m=c.textContent.match(/([\d.]+)\s*%/);if(!m)return null;const rm=(r.querySelector('.wl-tag')||{textContent:''}).textContent.match(/^(\d+)위/);return{t:r.dataset.t,rk:rm?+rm[1]:0,px:p.textContent,v:parseFloat(m[1])*(/▼|-|−/.test(c.textContent)?-1:1)}}).filter(Boolean);
const ex=t=>{try{if(typeof EXT_DATA==='undefined'||usRegularNow())return '';const e=EXT_DATA[t];if(!e||(Date.now()/1000-e.t)>60*3600)return '';const lb=e.st==='pre'?'☀':'🌙',tt=(e.st==='pre'?'장전':'장후');if(e.none)return '<i class="hm-ext" title="'+tt+' 체결 없음">'+lb+' 체결 없음</i>';if(e.pct==null)return '';return '<i class="hm-ext" title="'+tt+' 시세(정규장 종가 대비)">'+lb+' '+(e.pct>=0?'+':'−')+Math.abs(e.pct).toFixed(2)+'%</i>'}catch(x){return ''}};
function price(text){
 const safe=String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const m=safe.match(/^(.*?)\s*\((₩[^)]+)\)\s*$/);
 return '<b class="hm-price"><span class="hm-usd">'+(m?m[1]:safe)+'</span>'+(m?'<span class="hm-krw">'+m[2]+'</span>':'')+'</b>';
}
function col(v){const a=Math.min(Math.abs(v)/4,1);const US=!!(window.MK_CV&&window.MK_CV.us);const L=v>=0?(US?[6,118,71]:[200,32,20]):(US?[200,32,20]:[26,111,168]);const g=[110,118,112];const c=L.map((x,i)=>Math.round(g[i]+(x-g[i])*(.35+.65*a)));return 'rgb('+c+')'}
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
 if(!p){p=document.createElement('div');p.className='pulse';const bar=document.getElementById('pro-toc');if(bar)bar.after(p);else document.getElementById('pro-brief').after(p);p.classList.add('m-fold');p.addEventListener('click',e=>{const h=e.target.closest('h3');if(h&&p.contains(h)&&!e.target.closest('a')){const o=!p.classList.contains('m-open');p.classList.toggle('m-open',o);draw();return}const b=e.target.closest('[data-m]');if(b){mode=b.dataset.m;draw()}})}
 const KEY=['TQQQ','SOXL','TECL','QLD','USD','SCHD'];
 const kb=(ti,ks)=>{const a=ks.map(k=>all.find(x=>x.t===k)).filter(Boolean);return a.length?'<div class="hm-k"><h4>'+ti+' <small>'+ks.join(' · ')+'</small></h4><div class="hm">'+a.map(x=>'<div class="tl" style="--c:'+col(x.v)+'"><span>★ '+x.t+'</span><small style="background:'+col(x.v)+'">'+price(x.px)+'<b class="hm-chg">'+(x.v>=0?'▲ +':'▼ ')+Math.abs(x.v).toFixed(2)+'%</b>'+ex(x.t)+'</small></div>').join('')+'</div></div>':''};
 const rows=(mode==='up'||mode==='dn')?(MOV[mode]||[]):mode==='cap'?q('cap-tbl'):mode==='tick'?q('tick-tbl'):q('lev-tbl');const g5=(mode==='cap'||mode==='up'||mode==='dn');
 const up=all.filter(x=>x.v>0).length,dn=all.filter(x=>x.v<0).length,fl=all.length-up-dn;
 p.innerHTML='<h3>시장 한눈에 보기 <small>'+all.length+'개 종목 기준 · 최근 시세 등락</small><button type="button" class="m-fold-btn" aria-expanded="'+p.classList.contains('m-open')+'"><em>'+(p.classList.contains('m-open')?'접기':'펼치기')+'</em> '+(p.classList.contains('m-open')?'➖':'➕')+'</button></h3>'+
 '<div class="breadth"><i style="width:'+up/all.length*100+'%;background:var(--up)"></i><i style="width:'+fl/all.length*100+'%;background:#aaa"></i><i style="width:'+dn/all.length*100+'%;background:var(--down)"></i></div>'+
 '<div class="bl"><span style="color:var(--up)">▲ 상승 '+up+'</span><span style="color:var(--tx2)">보합 '+fl+'</span><span style="color:var(--down)">하락 '+dn+' ▼</span></div>'+
 '<div class="hm-kw">'+kb('🔥 3배 핵심 3종',['TQQQ','SOXL','TECL'])+kb('🎯 김군 핵심 3종',['QLD','USD','SCHD'])+'</div>'+
 '<div class="hm-t"><button data-m="cap" class="'+(mode==='cap'?'on':'')+'">시가총액 TOP10</button><button data-m="tick" class="'+(mode==='tick'?'on':'')+'">관심종목</button><button data-m="lev" class="'+(mode==='lev'?'on':'')+'">레버리지 ETF</button><button data-m="up" class="'+(mode==='up'?'on':'')+'">🚀 급등주</button><button data-m="dn" class="'+(mode==='dn'?'on':'')+'">📉 급락주</button></div>'+
 (rows.length||(mode!=='up'&&mode!=='dn')?'':'<p class="mut" style="font-size:12.5px;margin:8px 0">'+(MOV[mode]===null?'급등·급락 종목을 불러오는 중입니다…':'조건(주가 $2 이상·시총 3억달러 이상)에 맞는 종목이 없습니다.')+'</p>')+'<div class="hm '+(g5?'hm-g5':'')+'">'+rows.map((x,i)=>'<div class="tl '+((mode==='cap'&&(i<3||i>=7))?'st ':'')+(mode==='cap'&&i<3?'big ':'')+(KEY.indexOf(x.t)>=0?'star':'')+'" style="--c:'+col(x.v)+'"><span style="--n:'+String(x.t).length+'">'+(mode==='cap'&&x.rk>0&&x.rk<=10?['','🥇','🥈','🥉','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟'][x.rk]+' ':'')+x.t+'</span><small style="background:'+col(x.v)+'">'+price(x.px)+'<b class="hm-chg">'+(x.v>=0?'▲ +':'▼ ')+Math.abs(x.v).toFixed(2)+'%</b>'+ex(x.t)+'</small></div>').join('')+'</div>'+
 '<div class="hm-l">-4%<i style="background:'+col(-4)+'"></i><i style="background:'+col(-1)+'"></i><i style="background:'+col(0.01)+'"></i><i style="background:'+col(1)+'"></i><i style="background:'+col(4)+'"></i>+4%</div>';
}
setTimeout(draw,5000);setInterval(draw,20000);
})();

;
/* Source: stock-mobile.js */
/* 모바일(≤700px) 전용 보강: ① 헤더 자동 숨김 ④ 작은 글씨 12px 보정 ⑤ 종목 행 탭 펼침 */
(function(){
  if(!document.body.classList.contains('pro')) return;
  var mq=window.matchMedia('(max-width:700px)');
  /* ① 아래로 스크롤하면 헤더를 숨기고(목차만 고정), 위로 올리면 다시 보인다 */
  var hd=document.querySelector('header'), last=window.scrollY, hidden=false, tick=false;
  var setH=function(h){ if(h===hidden||!hd) return; hidden=h; hd.classList.toggle('hdr-off',h);
    var t=document.getElementById('pro-toc'); if(t) t.style.top=h?'0px':hd.offsetHeight+'px'; };
  window.addEventListener('scroll',function(){ if(tick) return; tick=true; requestAnimationFrame(function(){ tick=false;
    if(!mq.matches){ setH(false); return; }
    var nt=document.querySelector('.nav-toggle'); if(nt&&nt.getAttribute('aria-expanded')==='true'){ setH(false); return; }
    var y=window.scrollY, d=y-last;
    if(y<120) setH(false); else if(d>8) setH(true); else if(d<-8) setH(false);
    if(Math.abs(d)>8) last=y; }); },{passive:true});
  /* ④ 본문성 글씨가 12px 미만이면 12px로 올린다(종목 행의 신호 배지 .tb 는 11px 허용) */
  var fixing=false, fixFonts=function(){
    if(!mq.matches||fixing) return; fixing=true;
    var root=document.getElementById('main')||document.body, els=root.querySelectorAll('*');
    for(var i=0;i<els.length;i++){ var e=els[i];
      if(e.dataset&&e.dataset.fs) continue;
      if(e.closest&&e.closest('#krlev-tbl .wl-name,#lev-tbl .wl-name,#krlev-tbl .wl-quote,#lev-tbl .wl-quote')){ e.dataset.fs='1'; continue; } /* 레버리지 종목명은 한 줄에 맞게 mrkim-common.js 가 조절 */
      if(e.matches&&e.matches('.pulse .hm div.tl>span')){ e.dataset.fs='1'; continue; } /* 시장 한눈에 보기 종목명은 mrkim-common.js 가 한 줄에 맞게 조절 */
      var has=false, c=e.childNodes; for(var k=0;k<c.length;k++){ if(c[k].nodeType===3&&c[k].textContent.trim().length>1){ has=true; break; } }
      if(!has||e.closest('svg')) continue;
      var fs=parseFloat(getComputedStyle(e).fontSize);
      if(fs<12){ e.style.fontSize=(e.classList.contains('tb')?Math.max(fs,11):12)+'px'; }
      e.dataset.fs='1'; }
    fixing=false; };
  var tm=null, later=function(){ clearTimeout(tm); tm=setTimeout(fixFonts,700); };
  [1200,3500,8000,15000].forEach(function(t){ setTimeout(fixFonts,t); });
  var mo=new MutationObserver(later); var mn=document.getElementById('main'); if(mn) mo.observe(mn,{childList:true,subtree:true});
  /* ⑤ 종목 행: 가격 영역을 누르면 지표 배지·52주·바로가기가 펼쳐진다 */
  var deco=function(){ if(!mq.matches) return;
    document.querySelectorAll('#main .wl-row .wl-quote:not([data-mx])').forEach(function(q){ q.setAttribute('data-mx','1'); q.setAttribute('role','button'); q.setAttribute('tabindex','0'); q.setAttribute('aria-expanded','false'); q.setAttribute('aria-label','상세 지표 펼치기'); }); };
  var toggle=function(q){ var r=q.closest('.wl-row'); if(!r) return; var on=r.classList.toggle('m-x'); q.setAttribute('aria-expanded',on?'true':'false'); q.setAttribute('aria-label',on?'상세 지표 접기':'상세 지표 펼치기'); setTimeout(fixFonts,100); };
  document.addEventListener('click',function(e){ if(!mq.matches) return; var q=e.target.closest&&e.target.closest('.wl-quote[data-mx]'); if(q&&!e.target.closest('a,button')) toggle(q); });
  document.addEventListener('keydown',function(e){ if((e.key==='Enter'||e.key===' ')&&e.target.matches&&e.target.matches('.wl-quote[data-mx]')){ e.preventDefault(); toggle(e.target); } });
  var mo2=new MutationObserver(function(){ clearTimeout(mo2._t); mo2._t=setTimeout(deco,300); }); if(mn) mo2.observe(mn,{childList:true,subtree:true});
  [800,2500,6000].forEach(function(t){ setTimeout(deco,t); });
})();

;
/* Source: stock-ux-v2.js */
/* 모바일 UX 보강 — 스켈레톤 로딩, 데이터 절약 스위치, 표→카드, 탭 스와이프, 당겨서 새로고침, 소개문 접기, 서비스워커 등록 */
(function(){
  if(!document.body.classList.contains('pro')) return;
  var mq=window.matchMedia('(max-width:700px)');
  /* ===== 스켈레톤: "--" / "불러오는 중…" 자리표시를 반짝이는 틀로 ===== */
  var SK_SEL='.wl-price,.wl-pct,#us-val,#us-state,#us-kimcomment,.mut,td.mut,.px,.ch';
  var skel=function(){
    document.querySelectorAll(SK_SEL).forEach(function(e){
      var t=(e.textContent||'').trim(), ph=(t==='--'||t==='불러오는 중'||t==='불러오는 중…'||t==='불러오는 중...');
      if(ph&&e.children.length===0){ if(!e.classList.contains('skel')) e.classList.add('skel'); }
      else if(e.classList.contains('skel')) e.classList.remove('skel'); }); };
  var main=document.getElementById('main'), st=null;
  var sched=function(){ clearTimeout(st); st=setTimeout(function(){ skel(); cards(); },350); };
  if(main) new MutationObserver(sched).observe(main,{childList:true,subtree:true,characterData:true});
  skel();
  /* ===== 데이터 절약 스위치 ===== */
  var saveOn=!!window.MK_SAVE;
  var wire=function(){
    var rf=document.getElementById('ps-rf'); if(!rf||document.getElementById('ps-save')) return;
    var b=document.createElement('button'); b.type='button'; b.id='ps-save'; b.setAttribute('aria-pressed',saveOn?'true':'false');
    b.title='켜면 자동 갱신 주기가 3배 길어지고 로고 이미지를 불러오지 않습니다'; b.innerHTML=saveOn?'📶<span class="lb"> 절약 ON</span>':'📶<span class="lb"> 절약</span>';
    b.onclick=function(){ try{ localStorage.setItem('mk_save',saveOn?'0':'1'); }catch(e){} location.reload(); };
    rf.before(b); };
  wire(); [800,2500].forEach(function(t){ setTimeout(wire,t); });
  /* ===== 원/달러 표기 방식 버튼: 상단 '원화 표시' 체크박스를 새로고침 왼쪽 버튼으로 옮김 ===== */
  var wireKrw=function(){
    var rf=document.getElementById('ps-rf'), cb=document.getElementById('krw-toggle'); if(!rf||!cb||document.getElementById('ps-krw')) return;
    var b=document.createElement('button'); b.type='button'; b.id='ps-krw';
    var sync=function(){ var on=cb.checked; b.setAttribute('aria-pressed',on?'true':'false'); b.innerHTML=on?'$+₩<span class="lb"> 병기</span>':'$<span class="lb"> 달러</span>'; b.title=on?'달러 가격 옆에 원화를 괄호로 함께 표시 중 (누르면 달러만 표시)':'달러로만 표시 중 (누르면 원화를 괄호로 병기)'; };
    b.onclick=function(){ cb.checked=!cb.checked; cb.dispatchEvent(new Event('change')); sync(); };
    cb.addEventListener('change',sync); sync();
    rf.before(b); var lb=cb.closest('label'); if(lb) lb.style.display='none'; };
  wireKrw(); [800,2500].forEach(function(t){ setTimeout(wireKrw,t); });
  /* ===== 표 → 카드(모바일): 각 칸에 머리글을 data-label 로 달아 CSS가 카드로 보여준다 ===== */
  var cards=function(){
    ['holidays-tbl','kr-holidays-tbl'].forEach(function(id){ var tb=document.getElementById(id); if(!tb) return; var tbl=tb.closest('table'); if(!tbl) return;
      var hs=[].map.call(tbl.querySelectorAll('thead th'),function(th){ var n=th.firstChild; return (n&&n.nodeType===3?n.textContent:th.textContent).trim(); });
      tbl.classList.add('m-cards');
      tb.querySelectorAll('tr').forEach(function(tr){ [].forEach.call(tr.children,function(td,i){ if(td.colSpan>1) return; if(!td.getAttribute('data-label')&&hs[i]) td.setAttribute('data-label',hs[i]); }); }); }); };
  cards();
  /* ===== 소개문 접기(모바일) ===== */
  var lead=document.querySelector('.pg-lead');
  if(lead){ var lb=document.createElement('button'); lb.type='button'; lb.className='lead-more'; lb.setAttribute('aria-expanded','false'); lb.textContent='소개 더보기 ▾';
    lb.onclick=function(){ var o=lead.classList.toggle('m-lead-open'); lb.setAttribute('aria-expanded',o?'true':'false'); lb.textContent=o?'접기 ▴':'소개 더보기 ▾'; };
    lead.after(lb); }
  /* ===== 탭 좌우 스와이프(기간 변경) ===== */
  var MAP={'tick-tbl':'tick','cap-tbl':'cap','lev-tbl':'lev','idxchg-tbl':'idxchg','krcap-tbl':'krcap','krkq-tbl':'krkq','krlev-tbl':'krlev','kridx-tbl':'kridx'};
  Object.keys(MAP).forEach(function(id){ var list=document.getElementById(id); if(!list) return;
    var area=list.closest('.scroll')||list, g=MAP[id], x0=0,y0=0,t0=0,on=false;
    var tabs=function(){ return document.querySelector('.tabs[data-group="'+g+'"]'); };
    var tb=tabs(); if(tb&&!tb.nextElementSibling.classList.contains('swipe-hint')){ var h=document.createElement('div'); h.className='swipe-hint'; h.textContent='↔ 목록을 좌우로 밀면 기간이 바뀝니다'; tb.after(h); }
    area.addEventListener('touchstart',function(e){ if(!mq.matches||e.touches.length!==1) return; on=true; x0=e.touches[0].clientX; y0=e.touches[0].clientY; t0=Date.now(); },{passive:true});
    area.addEventListener('touchend',function(e){ if(!on) return; on=false; var c=e.changedTouches[0], dx=c.clientX-x0, dy=c.clientY-y0;
      if(Math.abs(dx)<70||Math.abs(dy)>45||Date.now()-t0>650) return;
      var t=tabs(); if(!t) return; var bs=[].slice.call(t.querySelectorAll('button')); var i=bs.findIndex(function(b){ return b.classList.contains('on'); }); if(i<0) return;
      var n=i+(dx<0?1:-1); if(n<0||n>=bs.length) return; bs[n].click(); },{passive:true}); });
  /* ===== 당겨서 새로고침(맨 위에서만) ===== */
  var ptr=document.createElement('div'); ptr.id='ptr'; ptr.setAttribute('aria-hidden','true'); ptr.textContent='↓ 당겨서 새로고침'; document.body.appendChild(ptr);
  var py=0, pull=0, act=false;
  document.addEventListener('touchstart',function(e){ act=mq.matches&&window.scrollY<=0&&e.touches.length===1; py=e.touches[0].clientY; pull=0; },{passive:true});
  document.addEventListener('touchmove',function(e){ if(!act) return; var d=e.touches[0].clientY-py; if(d<=0||window.scrollY>0){ pull=0; ptr.style.transform=''; ptr.classList.remove('on'); return; }
    pull=Math.min(d,110); ptr.classList.add('on'); ptr.style.transform='translateY('+(pull*0.6-40)+'px)'; ptr.textContent=pull>=80?'↑ 놓으면 새로고침':'↓ 당겨서 새로고침'; },{passive:true});
  document.addEventListener('touchend',function(){ if(!act) return; act=false; var go=pull>=80; ptr.classList.remove('on'); ptr.style.transform='';
    if(go){ ptr.textContent='새로고침 중…'; location.reload(); } pull=0; },{passive:true});

  /* ===== 하단 긴 글: 용어 가이드·데이터 안내를 모바일에서 접어 둔다 ===== */
  var acc=function(head,body){ if(!mq.matches) return; var btn=document.createElement('button'); btn.type='button'; btn.className='acc-btn'; btn.setAttribute('aria-expanded','false');
    while(head.firstChild) btn.appendChild(head.firstChild); head.appendChild(btn); head.classList.add('acc-h'); body.classList.add('acc-b');
    btn.addEventListener('click',function(){ var o=head.classList.toggle('acc-open'); btn.setAttribute('aria-expanded',o?'true':'false'); body.classList.toggle('acc-show',o); }); };
  document.querySelectorAll('.gl-list dt').forEach(function(dt){ var dd=dt.nextElementSibling; if(dd&&dd.tagName==='DD') acc(dt,dd); });
  var dn=document.querySelector('.data-notice');
  if(dn){ var hb=dn.querySelector('b'), wrap=document.createElement('div'); [].slice.call(dn.querySelectorAll('.dl')).forEach(function(x){ wrap.appendChild(x); }); dn.appendChild(wrap); if(hb){ var br=hb.nextElementSibling; if(br&&br.tagName==='BR') br.remove(); acc(hb,wrap); } }
  var pcn=document.getElementById('pc-note'); if(pcn) pcn.addEventListener('click',function(){ pcn.classList.toggle('open'); });
  /* ===== 홈 화면 추가(PWA) 서비스워커 ===== */
  if('serviceWorker' in navigator&&(location.protocol==='https:'||location.hostname==='localhost')){
    window.addEventListener('load',function(){ navigator.serviceWorker.register('stock-sw.js',{scope:'./stock.html'}).catch(function(){}); }); }

  /* ===== 유니콘 카드: 주제별(기업가치·손익·상장·미국/한국 투자자·뉴스) 줄맞춤 — 카드 내용을 구역으로 묶고 subgrid 로 같은 줄에 맞춘다 ===== */
  (function(){ var g=document.querySelector('#unicorn .grid'); if(!g||!CSS.supports||!CSS.supports('grid-template-rows','subgrid')) return;
    var cards=g.querySelectorAll(':scope > .card'); if(!cards.length) return;
    var KEYS=['name','val','est','pnl','ipo','us','kr','news'];
    cards.forEach(function(c){ if(c.dataset.ucs) return; c.dataset.ucs='1';
      var kids=Array.prototype.slice.call(c.children), secs={}, cur='name', n=0;
      kids.forEach(function(k){ var t=(k.textContent||'').trim(), st=k.getAttribute('style')||'';
        if(k.id&&/^unicorn-news/.test(k.id)) cur='news';
        else if(n===0) cur='name';
        else if(n===1&&/display:\s*grid/.test(st)) cur='val';
        else if(k.classList&&k.classList.contains('asof')) cur='est';
        else if(/^손익/.test(t)) cur='pnl';
        else if(/border-left/.test(st)||/^상장/.test(t)) cur='ipo';
        else if(/^주요 투자자\s*—\s*미국/.test(t)) cur='us';
        else if(/^주요 투자자\s*—\s*한국/.test(t)) cur='kr';
        else if(/^최근 뉴스/.test(t)) cur='news';
        n++; (secs[cur]=secs[cur]||[]).push(k); });
      KEYS.forEach(function(key){ var d=document.createElement('div'); d.className='uc-sec uc-'+key; (secs[key]||[]).forEach(function(k){ d.appendChild(k); }); c.appendChild(d); });
      c.classList.add('uc-grid'); });
    g.classList.add('uc-on'); })();

  /* ===== 종목 행 버튼(+ X N 재무) 의미 안내 ===== */
  (function(){ ['tick-tbl','cap-tbl','idxchg-tbl','lev-tbl'].forEach(function(id){ var h=document.getElementById(id); if(!h||h.previousElementSibling&&h.previousElementSibling.classList.contains('act-legend')) return;
    var p=document.createElement('p'); p.className='act-legend'; p.setAttribute('aria-label','종목 행 버튼 설명');
    p.innerHTML='<span class="al-t">버튼 안내</span><span><b>➕ +</b> 상세지표(Finviz)</span><span><b>🐦 X</b> X(트위터) 검색</span><span><b>📰 N</b> 최신 뉴스</span><span><b>📊 재무</b> 재무비율</span><span class="al-m">모바일은 가격 영역을 누르면 펼쳐집니다</span>';
    h.before(p); }); })();
})();

;
/* Source: stock-asof.js */
/* 데이터 기준일·갱신 주기 표시 — <p class="asof" data-asof="YYYY-MM[-DD]" data-label=".." data-cycle=".."> 를 같은 형식으로 렌더링.
   n개월 전 자료로 표시하고 3개월 이상 지나면 주황색 "갱신 필요" 배지를 붙입니다. */
(function(){
  var now=new Date();
  var fmt=function(a){ var p=a.split('-'); return p[0]+'.'+p[1]+(p[2]?'.'+p[2]:''); };
  var age=function(a){
    var p=a.split('-').map(Number), d=new Date(p[0],p[1]-1,p[2]||1);
    var days=Math.floor((now-d)/86400000), mon=(now.getFullYear()-p[0])*12+(now.getMonth()-(p[1]-1));
    if(p[2]&&now.getDate()<p[2]) mon-=1;
    if(mon<0) mon=0;
    var txt= mon>=1 ? mon+'개월 전 자료' : (days>=7 ? Math.floor(days/7)+'주 전 자료' : (days>=1 ? days+'일 전 자료' : '오늘 자료'));
    return {txt:txt, old:mon>=3, mon:mon};
  };
  var esc=function(t){ return String(t).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); };
  document.querySelectorAll('.asof').forEach(function(el){
    var link=el.querySelector('a'), a=el.getAttribute('data-asof'), lb=el.getAttribute('data-label')||'데이터', cy=el.getAttribute('data-cycle')||'';
    var h='';
    if(el.classList.contains('est')) h+='<span class="ao-b ao-e">추정·비공식</span>';
    if(a){ var g=age(a); h+='<span class="ao-b'+(g.old?' old':'')+'">'+esc(lb)+' 기준 '+fmt(a)+' · '+g.txt+(g.old?' · 갱신 필요':'')+'</span>'; }
    else h+='<span class="ao-b">'+esc(lb)+'</span>';
    if(cy) h+='<span>갱신: '+esc(cy)+'</span>';
    var nx=el.getAttribute('data-next');
    if(nx) h+='<span class="ao-n">다음 갱신 예정 '+esc(nx)+'</span>';
    var fb=(window.MK_CFG&&window.MK_CFG.updateRequestUrl)||'';
    if(fb && /^https:\/\//.test(fb) && (a||nx)) h+='<a class="ao-r" href="'+esc(fb)+'" target="_blank" rel="noopener">갱신 요청</a>';
    el.innerHTML=h; if(link) el.appendChild(link);
  });
  /* 갱신 요청 링크: 페이지에서 window.MK_CFG={updateRequestUrl:'https://…'} 로 지정하면 표시(미지정 시 숨김). */
  /* 정적 공탐 문구는 라이브 값이 뜨면 숨김(검색 봇·미리보기용) */
  var st=document.getElementById('static-fg');
  if(st){ var t=0, iv=setInterval(function(){ var v=document.getElementById('us-val'); if(v&&/\d/.test(v.textContent||'')){ st.hidden=true; clearInterval(iv); } if(++t>40) clearInterval(iv); },500); }
})();

;
/* Source: stock-sort.js */
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
    const SK='mk_sort_'+id;
    bar.addEventListener('click',e=>{const b=e.target.closest('button'); if(!b) return; try{localStorage.setItem(SK,b.dataset.s);}catch(_){} bar.querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b));
      const k=b.dataset.s; const arr=[...list.querySelectorAll(':scope > .wl-row')];
      arr.sort((x,y)=>k==='o'?x.dataset.o-y.dataset.o:k==='d'?val(y)-val(x):val(x)-val(y)); arr.forEach(r=>list.appendChild(r)); });
    let sv=null; try{sv=localStorage.getItem(SK);}catch(_){}
    if(sv&&sv!=='o'){const bb=bar.querySelector('[data-s="'+sv+'"]'); if(bb){[0,4000,9000].forEach(t=>setTimeout(()=>bb.click(),t));}}
  });
})();

;
/* Source: stock-extra.js */
/* Mr.Kim Signal — 추가 기능 모음 (body.pro 전용)
   ① 화면 테마(자동·다크·라이트) ② 상승/하락 색 규칙 전환(빨강↑·파랑↓ ↔ 초록↑·빨강↓) ③ 종목·섹션 검색
   ④ 공탐 조건 알림(페이지가 열려 있는 동안) ⑤ 차트 대체 텍스트 자동 부여 ⑥ 개인정보 없는 이용 통계(섹션·탭 클릭 횟수) */
(function () {
  'use strict';
  if (!document.body || !document.body.classList.contains('pro')) return;
  var D = document.documentElement, KR = document.body.classList.contains('kr');
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };
  var prefs = window.MK_STOCK_PREFS;
  var page = (location.pathname.split('/').pop() || 'index').replace(/\.html$/, '').toLowerCase().replace(/[^a-z0-9-]/g, '') || 'index';

  /* ───────── ⑥ 이용 통계(개인정보 없음 · 횟수만) ───────── */
  var EV = { q: [], sent: 0 };
  var statsOn = store.get('mk_noev') === '0' && !(navigator.doNotTrack === '1' || window.doNotTrack === '1' || store.get('mk_noev') === '1');
  var worker = function () { try { return (typeof PROXY_BASE !== 'undefined' && PROXY_BASE) ? PROXY_BASE.replace(/\?url=$/, '').replace(/\/+$/, '') : ''; } catch (e) { return ''; } };
  function ev(type, label) {
    if (!statsOn || EV.sent > 40) return;
    EV.q.push([type, String(label || '').slice(0, 40)]);
    if (EV.q.length >= 12) flush();
  }
  function flush() {
    var w = worker(); if (!statsOn || !w || !EV.q.length) { EV.q = []; return; }
    var body = JSON.stringify({ p: page, e: EV.q.splice(0, 12) }); EV.sent++;
    try { if (navigator.sendBeacon) { navigator.sendBeacon(w + '/ev', new Blob([body], { type: 'text/plain;charset=UTF-8' })); return; } } catch (e) {}
    try { fetch(w + '/ev', { method: 'POST', body: body, keepalive: true, headers: { 'Content-Type': 'text/plain;charset=UTF-8' } }).catch(function () {}); } catch (e) {}
  }
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') flush(); });
  window.addEventListener('pagehide', flush);
  ev('view', 'page');
  document.addEventListener('click', function (e) {
    var t = e.target; if (!t || !t.closest) return;
    var fb = t.closest('.fold-btn, h2.fold-h');
    if (fb && !t.closest('a')) { var h = fb.closest('h2'); var nm = h && $('.fold-t', h); setTimeout(function () { var b = h && $('.fold-btn', h); if (b && b.getAttribute('aria-expanded') === 'true') ev('fold', nm ? nm.textContent.trim() : ''); }, 0); return; }
    var tb = t.closest('.tabs button, .seg button');
    if (tb) { var g = tb.closest('[data-group]'); ev('tab', (g ? g.getAttribute('data-group') : (tb.closest('.seg') ? 'seg' : 'tab')) + ':' + tb.textContent.trim()); return; }
    var lk = t.closest('.wl-actions a, .fin-btn');
    if (lk) ev('link', lk.classList.contains('fin-btn') ? '재무' : lk.classList.contains('ts-link') ? 'X' : lk.classList.contains('news-link') ? 'N' : '+');
  }, true);

  /* ───────── ① 테마 · ② 색 규칙 ───────── */
  var mq = window.matchMedia ? matchMedia('(prefers-color-scheme: dark)') : null;
  function theme() { var t = store.get('mk_theme'); return t === 'dark' || t === 'light' ? t : 'auto'; }
  function applyTheme() {
    var t = theme(), dark = t === 'dark' || (t === 'auto' && mq && mq.matches);
    if (dark) D.setAttribute('data-theme', 'dark'); else D.removeAttribute('data-theme');
    var b = $('#ps-theme');
    if (b) { b.textContent = t === 'dark' ? '☾' : t === 'light' ? '☀' : '◐'; var nm = t === 'dark' ? '다크' : t === 'light' ? '라이트' : '자동(기기 설정)'; b.setAttribute('aria-label', '화면 테마: ' + nm + ' — 누르면 변경'); b.title = '화면 테마: ' + nm; var hl = $('.hp-r[data-for="ps-theme"] .hp-l'); if (hl) hl.textContent = '화면 테마 · ' + (t === 'dark' ? '다크' : t === 'light' ? '라이트' : '자동'); }
  }
  if (mq && mq.addEventListener) mq.addEventListener('change', applyTheme);
  function applyCv() {
    var us = store.get('mk_cv') === 'us'; if (us) D.setAttribute('data-cv', 'us'); else D.removeAttribute('data-cv');
    var b = $('#ps-cv'); if (b) { b.innerHTML = us ? '<i class="cv-u">▲</i><i class="cv-d">▼</i>' : '<i class="cv-d2">▼</i><i class="cv-u2">▲</i>'; b.className = 'ps-cv' + (us ? ' us' : ''); var nm = us ? '상승 초록 · 하락 빨강' : '상승 빨강 · 하락 파랑'; b.setAttribute('aria-label', '상승·하락 색: ' + nm + ' — 누르면 변경'); b.title = '상승·하락 색: ' + nm; }
  }
  var st = $('#pro-status');
  if (st) {
    var rf = $('#ps-rf', st), th = document.createElement('button'), cv = document.createElement('button');
    th.type = cv.type = 'button'; th.id = 'ps-theme'; cv.id = 'ps-cv'; th.className = 'ps-ico';
    th.addEventListener('click', function () { var n = { auto: 'dark', dark: 'light', light: 'auto' }[theme()]; store.set('mk_theme', n); applyTheme(); ev('theme', n); });
    cv.addEventListener('click', function () { var n = store.get('mk_cv') === 'us' ? 'kr' : 'us'; store.set('mk_cv', n); applyCv(); ev('theme', 'cv:' + n); flush(); setTimeout(function () { location.reload(); }, 60); });
    if (rf) { rf.before(cv); rf.before(th); } else { st.appendChild(cv); st.appendChild(th); }
  }
  applyTheme(); applyCv();

  /* ───────── 헤더 '⚙ 설정' 팝오버: 절약·원/달러·색·테마·새로고침(모바일은 포인트 선물하기 링크도) ───────── */
  (function () {
    var ROWS = [['ps-save', '데이터 절약'], ['ps-krw', '원/달러 환산'], ['ps-cv', '상승·하락 색'], ['ps-theme', '화면 테마'], ['ps-rf', '새로고침']];
    var host, pop, tg;
    function build() {
      var anchor = $('#stamp-top') || $('#naver-gift-link'); if (!anchor || !anchor.parentNode) return false;
      host = $('#hd-tools');
      if (!host) {
        host = document.createElement('div'); host.id = 'hd-tools';
        tg = document.createElement('button'); tg.type = 'button'; tg.id = 'hd-set'; tg.setAttribute('aria-expanded', 'false'); tg.setAttribute('aria-controls', 'hd-pop'); tg.innerHTML = '<span aria-hidden="true">⚙</span> <span class="lb">설정</span>'; tg.setAttribute('aria-label', '설정 열기');
        pop = document.createElement('div'); pop.id = 'hd-pop'; pop.hidden = true; pop.setAttribute('role', 'group'); pop.setAttribute('aria-label', '화면 설정');
        pop.innerHTML = ROWS.map(function (r) { return '<div class="hp-r" data-for="' + r[0] + '"><span class="hp-l">' + r[1] + '</span></div>'; }).join('') + '<a class="hp-gift" href="#" target="_blank" rel="noopener">🎁 네이버포인트 선물하기 (coolzet)</a>';
        var adminBadge=document.createElement('span');adminBadge.id='stock-admin-indicator';adminBadge.textContent='🛡 관리자 모드';function syncAdmin(){var on=false;try{on=localStorage.getItem('mk_gate_off')==='1';}catch(e){}adminBadge.hidden=!on;}syncAdmin();setInterval(syncAdmin,1500);host.appendChild(adminBadge);host.appendChild(tg); host.appendChild(pop);
        anchor.parentNode.insertBefore(host, anchor);
        var g = $('#naver-gift-link'); if (g) $('.hp-gift', pop).href = g.href;
        tg.addEventListener('click', function (e) { e.stopPropagation(); var o = pop.hidden; pop.hidden = !o; tg.setAttribute('aria-expanded', String(o));document.body.classList.toggle('stock-settings-open',o); if (o) { var f = $('button', pop); } });
        document.addEventListener('click', function (e) { if (!pop.hidden && !host.contains(e.target)) { pop.hidden = true;document.body.classList.remove('stock-settings-open'); tg.setAttribute('aria-expanded', 'false'); } });
        document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !pop.hidden) { pop.hidden = true;document.body.classList.remove('stock-settings-open'); tg.setAttribute('aria-expanded', 'false'); tg.focus(); } });
      }
      return true;
    }
    function mv() {
      if (!build()) return;
      ROWS.forEach(function (r) { var b = document.getElementById(r[0]), row = $('.hp-r[data-for="' + r[0] + '"]', pop); if (b && row && b.parentNode !== row) row.appendChild(b); });
      var st = document.getElementById('stamp-top');
      if(st){var foot=document.querySelector('footer');var update=document.getElementById('stock-update-footer');if(foot&&!update){update=document.createElement('div');update.id='stock-update-footer';foot.appendChild(update);}if(update&&st.parentNode!==update)update.prepend(st);}
      var g2 = document.getElementById('naver-gift-link'), hg = pop && $('.hp-gift', pop); if (g2 && hg) hg.href = g2.href;
    }
    mv(); [300, 900, 2500, 5000].forEach(function (t) { setTimeout(mv, t); });
    var ps = $('#pro-status'); if (ps && window.MutationObserver) new MutationObserver(mv).observe(ps, { childList: true });
  })();

  /* ───────── ③ 검색 ───────── */
  (function () {
    var toc = $('#pro-toc'); if (!toc) return;
    var btn = document.createElement('button'); btn.type = 'button'; btn.className = 'pt-s'; btn.setAttribute('aria-label', '종목·섹션 검색'); btn.setAttribute('aria-expanded', 'false'); btn.innerHTML = '🔍 <span>검색</span>';
    toc.insertBefore(btn, toc.firstChild);
    var pan = document.createElement('div'); pan.id = 'pro-search'; pan.hidden = true; pan.setAttribute('role', 'dialog'); pan.setAttribute('aria-label', '종목·섹션 검색');
    pan.innerHTML = '<form autocomplete="off"><input type="search" id="psr-q" placeholder="' + (KR ? '종목명·코드 또는 섹션 (예: 삼성전자, 레버리지)' : '티커·종목명·섹션 (예: NVDA, 엔비디아, 레버리지)') + '" aria-label="검색어" maxlength="30"><button type="submit">이동</button></form><ul id="psr-res" role="listbox"></ul><div id="psr-ex"></div>';
    document.body.appendChild(pan);
    var q = $('#psr-q', pan), res = $('#psr-res', pan), ex = $('#psr-ex', pan), idx = [];
    var build = function () {
      idx = [];
      $$('.wl-row[data-t]').forEach(function (r) {
        var t = r.getAttribute('data-t'); var tg = $('.wl-tag', r), nm = tg ? tg.cloneNode(true) : null;
        if (nm) $$('.ix, .tb, i, em, small', nm).forEach(function (x) { x.remove(); });
        var fb = r.closest('.fold-body'), h = fb && fb.previousElementSibling, sec = h && $('.fold-t', h) ? $('.fold-t', h).textContent.trim() : ((r.closest('.card') && $('h3', r.closest('.card'))) ? $('h3', r.closest('.card')).textContent.replace(/\s+/g, ' ').trim().slice(0, 14) : '');
        idx.push({ k: 'row', t: t, n: nm ? nm.textContent.replace(/\s+/g, ' ').trim() : '', sec: sec, el: r });
      });
      $$('h2.fold-h').forEach(function (h) { var n = $('.fold-t', h); if (n) idx.push({ k: 'sec', t: '', n: n.textContent.trim(), sec: '섹션', el: h }); });
      $$('#pro-toc a').forEach(function (a) { idx.push({ k: 'toc', t: '', n: a.textContent.trim(), sec: '바로가기', el: a }); });
    };
    var reveal = function (el) {
      var fb = el.closest && el.closest('.fold-body'); if (fb) { var h = fb.previousElementSibling; if (h && h._set) h._set(true); }
      var w = el.closest && el.closest('[id$="-wrap"]'); if (w && w.style.display === 'none') { var b = document.getElementById(w.id.replace(/-wrap$/, '-btn')); if (b) b.click(); }
    };
    var go = function (it) {
      close();
      if (it.k === 'toc') { it.el.click(); return; }
      reveal(it.el);
      setTimeout(function () { var y = it.el.getBoundingClientRect().top + window.scrollY - (window.innerHeight * .3); window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' }); it.el.classList.add('sr-hit'); setTimeout(function () { it.el.classList.remove('sr-hit'); }, 2600); }, 80);
    };
    var render = function () {
      var v = (q.value || '').trim().toLowerCase(); res.innerHTML = ''; ex.innerHTML = ''; if (!v) { return; }
      var seen = {}, hits = idx.filter(function (x) { var key = x.k + x.t + x.n; if (seen[key]) return false; seen[key] = 1; return (x.t && x.t.toLowerCase().indexOf(v) >= 0) || (x.n && x.n.toLowerCase().indexOf(v) >= 0); })
        .sort(function (a, b) { var as = a.t.toLowerCase() === v ? 0 : a.t.toLowerCase().indexOf(v) === 0 ? 1 : 2, bs = b.t.toLowerCase() === v ? 0 : b.t.toLowerCase().indexOf(v) === 0 ? 1 : 2; return as - bs; }).slice(0, 8);
      hits.forEach(function (it, i) {
        var li = document.createElement('li'); li.setAttribute('role', 'option');
        var b = document.createElement('button'); b.type = 'button'; b.innerHTML = '<b></b><span></span><em></em>'; b.children[0].textContent = it.t || it.n; b.children[1].textContent = it.t ? it.n : ''; b.children[2].textContent = it.sec;
        b.addEventListener('click', function () { go(it); }); li.appendChild(b); res.appendChild(li); it.__b = b; });
      if (!hits.length) { var li = document.createElement('li'); li.className = 'none'; li.textContent = '이 페이지에서 찾지 못했습니다.'; res.appendChild(li); }
      var tk = (q.value || '').trim().toUpperCase();
      if (/^[A-Z0-9.^=\-]{1,15}$/.test(tk)) {
        ex.innerHTML = '<a href="https://finviz.com/quote.ashx?t=' + encodeURIComponent(tk) + '" target="_blank" rel="noopener">↗ Finviz에서 ' + tk + ' 열기</a>' + (window.MK_MY_ADD ? '<button type="button" id="psr-add">⭐ 내 관심종목에 ' + tk + ' 추가</button>' : '');
        var ab = $('#psr-add', ex); if (ab) ab.addEventListener('click', function () { ab.disabled = true; ab.textContent = '시세 확인 중…'; window.MK_MY_ADD(tk).then(function (ok) { ab.textContent = ok ? '추가했습니다 — 위 "내 관심종목"에서 확인' : '시세를 찾지 못했습니다'; ev('search', 'add'); }); });
      }
    };
    var open = function () { build(); var r = toc.getBoundingClientRect(); pan.style.top = Math.max(0, r.bottom) + 'px'; pan.hidden = false; btn.setAttribute('aria-expanded', 'true'); ev('search', 'open'); setTimeout(function () { q.focus(); }, 30); };
    var close = function () { pan.hidden = true; btn.setAttribute('aria-expanded', 'false'); };
    btn.addEventListener('click', function () { pan.hidden ? open() : close(); });
    q.addEventListener('input', render);
    pan.querySelector('form').addEventListener('submit', function (e) { e.preventDefault(); var first = res.querySelector('button'); if (first) first.click(); else { var a = ex.querySelector('a'); if (a) window.open(a.href, '_blank', 'noopener'); } ev('search', 'submit'); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !pan.hidden) { close(); btn.focus(); } if (e.key === '/' && pan.hidden && !/input|textarea|select/i.test((e.target.tagName || ''))) { e.preventDefault(); open(); } });
    document.addEventListener('click', function (e) { if (!pan.hidden && !e.target.closest('#pro-search') && !e.target.closest('.pt-s')) close(); });
    window.addEventListener('scroll', function () { if (!pan.hidden) { var r = toc.getBoundingClientRect(); pan.style.top = Math.max(0, r.bottom) + 'px'; } }, { passive: true });
  })();

  /* ───────── ④ 공탐 조건 알림 ───────── */
  (function () {
    var kc = $('#pro-kc'), valEl = $('#us-val'); if (!kc || !valEl) return;
    var KEY = 'mk_alert', def = { on: false, lo: 25, hi: 75, t: {} };
    var load = function () { try { return Object.assign({}, def, JSON.parse(store.get(KEY) || '{}')); } catch (e) { return Object.assign({}, def); } };
    var cfg = load(), save = function () { store.set(KEY, JSON.stringify(cfg)); };
    var box = document.createElement('details'); box.id = 'fg-alert'; box.className = 'fg-alert';
    box.innerHTML = '<summary>🔔 공탐 알림 <small id="fa-st"></small></summary><div class="fa-body">' +
      '<label class="fa-on"><input type="checkbox" id="fa-on"> 알림 사용</label>' +
      '<div class="fa-row"><label>공탐이 <input type="number" id="fa-lo" min="1" max="99" inputmode="numeric" aria-label="이하 기준 점수"> 이하로 내려오면 <span class="mut">(공포 구간)</span></label></div>' +
      '<div class="fa-row"><label>공탐이 <input type="number" id="fa-hi" min="1" max="99" inputmode="numeric" aria-label="이상 기준 점수"> 이상으로 올라가면 <span class="mut">(탐욕 구간)</span></label></div>' +
      '<div class="fa-row"><button type="button" id="fa-perm">브라우저 알림 허용</button> <span id="fa-ps" class="mut"></span></div>' +
      '<p class="fa-note">이 페이지를 열어 둔 동안에만 확인합니다(앱·문자 알림 아님). 설정은 이 브라우저에만 저장되고, 같은 알림은 12시간에 한 번만 보여 줍니다.</p></div>';
    kc.after(box);
    var $on = $('#fa-on', box), $lo = $('#fa-lo', box), $hi = $('#fa-hi', box), $st = $('#fa-st', box), $perm = $('#fa-perm', box), $ps = $('#fa-ps', box);
    var paint = function () {
      $on.checked = !!cfg.on; $lo.value = cfg.lo; $hi.value = cfg.hi;
      $st.textContent = cfg.on ? '켜짐 · ' + cfg.lo + ' 이하 / ' + cfg.hi + ' 이상' : '꺼짐';
      var p = ('Notification' in window) ? Notification.permission : 'unsupported';
      $ps.textContent = p === 'granted' ? '허용됨' : p === 'denied' ? '차단됨(브라우저 설정에서 허용 필요) · 화면 안내만 표시' : p === 'unsupported' ? '이 브라우저는 알림을 지원하지 않아 화면 안내만 표시' : '허용하면 다른 탭을 보고 있어도 알려 줍니다';
      $perm.style.display = p === 'default' ? '' : 'none';
    };
    var changed = function () { cfg.on = $on.checked; cfg.lo = Math.max(1, Math.min(99, parseInt($lo.value, 10) || 25)); cfg.hi = Math.max(1, Math.min(99, parseInt($hi.value, 10) || 75)); save(); paint(); ev('alert', cfg.on ? 'on' : 'off'); check(true); };
    [$on, $lo, $hi].forEach(function (x) { x.addEventListener('change', changed); });
    $perm.addEventListener('click', function () { try { Notification.requestPermission().then(paint); } catch (e) { paint(); } });
    var toast = function (msg) {
      var t = $('#mk-toast'); if (!t) { t = document.createElement('div'); t.id = 'mk-toast'; t.setAttribute('role', 'status'); t.setAttribute('aria-live', 'polite'); document.body.appendChild(t); }
      t.innerHTML = '<span></span><button type="button" aria-label="닫기">✕</button>'; t.firstChild.textContent = msg; t.className = 'show'; t.lastChild.onclick = function () { t.className = ''; };
      clearTimeout(t._h); t._h = setTimeout(function () { t.className = ''; }, 20000);
    };
    var check = function (quiet) {
      if (!cfg.on) return; var n = parseFloat((valEl.textContent || '').replace(/[^\d.]/g, '')); if (!isFinite(n)) return;
      var side = n <= cfg.lo ? 'lo' : n >= cfg.hi ? 'hi' : ''; if (!side) return;
      var last = (cfg.t || {})[side] || 0; if (Date.now() - last < 12 * 3600e3) return;
      cfg.t = cfg.t || {}; cfg.t[side] = Date.now(); save();
      var msg = '미국 공포탐욕지수 ' + Math.round(n) + (side === 'lo' ? ' — 설정한 ' + cfg.lo + ' 이하(공포 구간)입니다.' : ' — 설정한 ' + cfg.hi + ' 이상(탐욕 구간)입니다.');
      toast('🔔 ' + msg);
      try { if ('Notification' in window && Notification.permission === 'granted') new Notification('Mr.Kim Signal', { body: msg }); } catch (e) {}
    };
    paint(); setInterval(check, 4000); setTimeout(check, 2500);
  })();

  /* ───────── ⑤ 차트 대체 텍스트 ───────── */
  (function () {
    var clean = function (s) { return (s || '').replace(/\s+/g, ' ').trim(); };
    var title = function (el) {
      var c = el.closest('.card, section, .fold-body'); var h = c && (c.querySelector('h3') || c.querySelector('.fold-t'));
      if (!h && c && c.classList.contains('fold-body')) { var p = c.previousElementSibling; h = p && p.querySelector('.fold-t'); }
      return h ? clean((h.querySelector && h.querySelector('span') && h.tagName === 'H3' ? h.querySelector('span') : h).textContent).slice(0, 40) : '차트';
    };
    var label = function () {
      $$('svg:not([role]):not([aria-label]):not([aria-hidden]), canvas:not([role]):not([aria-label])').forEach(function (s) {
        var r = s.getBoundingClientRect(); if (!r.width && !r.height) return; /* 접힌 섹션 등 아직 안 보이는 것은 나중에 */ if (r.width < 24 && r.height < 24) { s.setAttribute('aria-hidden', 'true'); return; }
        var row = s.closest('.wl-row'), txt;
        if (row) { var pct = $('.ch', row) || $('.wl-pct', row); txt = (row.getAttribute('data-t') || '종목') + ' 최근 가격 흐름' + (pct && /\d/.test(pct.textContent) ? ', 등락 ' + clean(pct.textContent) : ''); }
        else {
          var c = s.closest('.card, section'), lg = c && c.querySelector('.rel-chips, .legend, .vts-stats, .fb-legend, .trd-lg'); txt = title(s) + ' 그래프' + (lg ? ' — ' + clean(lg.textContent).slice(0, 110) : '');
          var nb = c && c.querySelector('#us-note, .pi-note'); if (!lg && nb) txt += ' — ' + clean(nb.textContent).slice(0, 90);
        }
        s.setAttribute('role', 'img'); s.setAttribute('aria-label', txt);
      });
      /* 막대·눈금 형태의 그래픽(스케일·바)에도 값 설명 */
      var sc = $('#pro-scale'); if (sc && !sc.getAttribute('aria-label')) { var mv = $('#pro-mkv'); sc.setAttribute('role', 'img'); sc.setAttribute('aria-label', '공포탐욕지수 구간 막대: 0~25 극단적 공포, 25~45 공포, 45~55 중립, 55~75 탐욕, 75~100 극단적 탐욕'); }
      if (sc) { var m2 = $('#pro-mkv'); if (m2 && /\d/.test(m2.textContent)) sc.setAttribute('aria-label', '공포탐욕지수 ' + m2.textContent + ' — 0~25 극단적 공포, 25~45 공포, 45~55 중립, 55~75 탐욕, 75~100 극단적 탐욕'); }
    };
    var tm; var later = function () { clearTimeout(tm); tm = setTimeout(label, 600); };
    document.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('.fold-btn, h2.fold-h, .tabs button, .fold-all button')) setTimeout(label, 500); });
    [1500, 4000, 9000, 16000].forEach(function (t) { setTimeout(label, t); });
    var mn = $('#main') || document.body; new MutationObserver(later).observe(mn, { childList: true, subtree: true });
  })();

  /* ───────── ⑦ 다크 모드: 스크립트가 직접 칠한 글자색(인라인) 보정 ───────── */
  (function () {
    var rgbRe = /rgba?\((\d+),\s*(\d+),\s*(\d+)/;
    function hsl(r, g, b) { r /= 255; g /= 255; b /= 255; var mx = Math.max(r, g, b), mn = Math.min(r, g, b), h = 0, s = 0, l = (mx + mn) / 2; if (mx !== mn) { var d = mx - mn; s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h /= 6; } return [h, s, l]; }
    function rgb(h, s, l) { var f = function (p, q, t) { if (t < 0) t += 1; if (t > 1) t -= 1; if (t < 1 / 6) return p + (q - p) * 6 * t; if (t < .5) return q; if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6; return p; }; var r, g, b; if (s === 0) r = g = b = l; else { var q = l < .5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q; r = f(p, q, h + 1 / 3); g = f(p, q, h); b = f(p, q, h - 1 / 3); } return 'rgb(' + Math.round(r * 255) + ',' + Math.round(g * 255) + ',' + Math.round(b * 255) + ')'; }
    function lighter(c) { var m = rgbRe.exec(c); if (!m) return null; var x = hsl(+m[1], +m[2], +m[3]); if (x[2] > .55) return null; var s = x[1] > .45 ? x[1] * .72 : x[1]; return rgb(x[0], s, x[1] > .45 ? Math.min(.9, .93 - x[2] * .45) : Math.min(.93, 1 - x[2] * .78)); }
    function darkOn() { return D.getAttribute('data-theme') === 'dark'; }
    function lightBg(el) { var b = el.style.backgroundColor || ''; var m = rgbRe.exec(b); if (!m) return false; var x = hsl(+m[1], +m[2], +m[3]); return x[2] > .55 && !/rgba/.test(b); }
    var busy = false;
    function run() {
      if (busy) return; busy = true;
      var dark = darkOn();
      $$('[style*="color"]').forEach(function (el) {
        var cur = el.style.color;
        if (dark) {
          if (el.dataset.lc && cur === el.dataset.lc) return;
          if (!cur || lightBg(el) || el.classList.contains('rb-badge') || el.hasAttribute('data-nolight')) return;
          var n = lighter(cur); if (!n) return;
          el.dataset.oc = cur; el.style.color = n; el.dataset.lc = el.style.color;
        } else if (el.dataset.oc) { el.style.color = el.dataset.oc; delete el.dataset.oc; delete el.dataset.lc; }
      });
      busy = false;
    }
    var q = false, later = function () { if (q) return; q = true; Promise.resolve().then(function () { q = false; run(); }); }; /* 그리기 전에 바로 보정(깜빡임 방지) */
    new MutationObserver(function (ms) { if (!busy) later(); }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style'] });
    new MutationObserver(later).observe(D, { attributes: true, attributeFilter: ['data-theme'] });
    setInterval(run, 2500); run();
  })();

  /* ───────── 모바일 하단 탭바 · PC 우측 패널 · 마지막 섹션 복귀 배너 · 도입문 한 줄 ───────── */
  (function () {
    var toc = $('#pro-toc'); if (!toc) return;
    var goTo = function (name) { if(name==='@watch'||name==='@account'){var b=document.querySelector('.stock-tools-links [data-tool="'+(name==='@watch'?'my-wl':'mk-acct')+'"]');if(b)b.click();return !!b;}  var a = $$('a', toc).filter(function (x) { return x.textContent.trim().indexOf(name) === 0; })[0]; if (a) a.click(); return !!a; };
    /* 탭바 */
    var generic = !$$('a', toc).some(function (a) { return /^요약/.test(a.textContent.trim()); });
    var GT = $$('a', toc).slice(0, 3).map(function (a, i) { var full = a.textContent.trim().replace('…', ''); return [['①', '②', '③'][i], Array.from(full).slice(0, 6).join(''), full]; });
    var TABS = generic ? GT.concat([['⋯', '더보기', '']]) : KR ? [['📊', '요약', '요약'], ['⭐', '관심', '관심종목'], ['🏛', '시총', '시총'], ['⋯', '더보기', '']] : [['📊', '요약', '요약'], ['⭐', '관심', '관심종목'], ['🏛', '시총', '시총'], ['⚡', '레버리지', '레버리지'], ['⋯', '더보기', '']];
    /* 모든 페이지 동일 구성: 홈 · 섹션 3개 · 더보기(전체 섹션 + 사이트 메뉴) */
    TABS = [['📊','요약','요약'],['⭐','내 관심','@watch'],['▣','계좌','@account'],['▦','일정','일정'],['⋯','더보기','']];
    var bar = document.createElement('nav'); bar.id = 'mk-tabbar'; bar.setAttribute('aria-label', '빠른 이동');
    bar.innerHTML = TABS.map(function (t, i) { return '<button type="button" data-i="' + i + '"' + (t[2] ? '' : ' aria-haspopup="dialog" aria-expanded="false"') + '><span class="ti" aria-hidden="true">' + t[0] + '</span><span class="tl">' + t[1] + '</span></button>'; }).join('');
    document.body.appendChild(bar);
    var sheet = document.createElement('div'); sheet.id = 'mk-sheet'; sheet.hidden = true; sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-label', '전체 섹션');
    sheet.innerHTML = '<div class="ms-bg"></div><div class="ms-pn"><div class="ms-hd"><b>전체 섹션</b><button type="button" class="ms-x" aria-label="닫기">✕</button></div><div class="ms-g"></div></div>';
    document.body.appendChild(sheet);
    var more = $('button[aria-haspopup]', bar);
    var closeSheet = function () { sheet.hidden = true; if (more) more.setAttribute('aria-expanded', 'false'); };
    function fillSheet() {
      var g = $('.ms-g', sheet);
      g.innerHTML = '<button type="button" data-s="1">🔍 검색</button>' + $$('a', toc).map(function (a, i) { return '<button type="button" data-n="' + i + '">' + a.textContent.trim() + '</button>'; }).join('') + '<div class="ms-sep">다른 페이지</div>' + [['index.html', '🏠 홈'], ['stock.html', '미국주식'], ['kr-stock.html', '한국주식'], ['bond.html', '채권'], ['crypto.html', '가상화폐'], ['finprod.html', '금융상품'], ['ipo.html', '공모주'], ['p2p.html', 'P2P'], ['fx.html', '환율'], ['trade.html', '매매김군']].map(function (l) { return '<a class="ms-l" href="' + l[0] + '">' + l[1] + '</a>'; }).join('');
    }
    bar.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return; var t = TABS[+b.dataset.i];
      if (t[2] === '@home') { if (/(^|\/)(index\.html)?$/.test(location.pathname)) window.scrollTo({ top: 0, behavior: 'smooth' }); else location.href = 'index.html'; return; }
      else if (t[2]) { closeSheet(); goTo(t[2]); ev('tabbar', t[1]); } else { fillSheet(); sheet.hidden = false; b.setAttribute('aria-expanded', 'true'); var x = $('.ms-x', sheet); if (x) x.focus(); }
    });
    sheet.addEventListener('click', function (e) {
      if (e.target.closest('.ms-bg, .ms-x')) { closeSheet(); return; }
      var b = e.target.closest('button'); if (!b) return;
      closeSheet();
      if (b.dataset.s) { var s = $('.pt-s', toc); if (s) s.click(); return; }
      var a = $$('a', toc)[+b.dataset.n]; if (a) a.click();
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !sheet.hidden) closeSheet(); });
    /* 마지막으로 보던 섹션 기억 + 복귀 배너 */
    var KEY = 'mk_last_' + page;
    var heads = function () { return $$('h2.fold-h'); };
    var last = null;
    function track() {
      var hs = heads(), best = null, y = window.innerHeight * 0.35;
      hs.forEach(function (h) { var r = h.getBoundingClientRect(); if (r.top < y) best = h; });
      if (best) { var t = $('.fold-t', best); var nm = Array.from((t || best).textContent.trim().replace(/\s+/g, ' ')).slice(0, 24).join(''); if (nm && nm !== last) { last = nm; store.set(KEY, JSON.stringify({ n: nm, t: Date.now() })); } }
    }
    var tmr; window.addEventListener('scroll', function () { clearTimeout(tmr); tmr = setTimeout(track, 600); }, { passive: true });
    try {
      var prev = JSON.parse(store.get(KEY) || 'null');
      if (prev && prev.n && Date.now() - prev.t > 30 * 60 * 1000 && Date.now() - prev.t < 14 * 864e5 && window.scrollY < 200) {
        var hit = heads().filter(function (h) { var t = $('.fold-t', h); return t && Array.from(t.textContent.trim().replace(/\s+/g, ' ')).slice(0, 24).join('') === prev.n; })[0];
        var host = $('#pro-brief') || $('.pg-lead');
        if (hit && host && prev.n.indexOf('요약') < 0) {
          var bn = document.createElement('div'); bn.id = 'mk-resume'; bn.setAttribute('role', 'status');
          bn.innerHTML = '<span>마지막으로 보던 곳: <b></b></span><button type="button" class="rs-go">이어보기</button><button type="button" class="rs-x" aria-label="닫기">✕</button>';
          $('b', bn).textContent = prev.n;
          host.parentNode.insertBefore(bn, host);
          bn.addEventListener('click', function (e) {
            if (e.target.closest('.rs-x')) { bn.remove(); return; }
            if (e.target.closest('.rs-go')) { var a = $$('a', toc).filter(function (x) { return prev.n.indexOf(x.textContent.trim().split(' ')[0]) === 0 || x.textContent.trim().indexOf(prev.n.split(' ')[0]) === 0; })[0]; if (a) a.click(); else { hit.scrollIntoView({ behavior: 'smooth' }); } bn.remove(); }
          });
        }
      }
    } catch (e) {}
    /* PC 우측 패널(아주 넓은 화면) */
    var side = document.createElement('aside'); side.id = 'mk-side'; side.setAttribute('aria-label', '목차와 오늘 일정');
    document.body.appendChild(side);
    function sideFill() {
      var ev2 = '';
      var items = $$('a', toc).map(function (a, i) { return '<li><button type="button" data-n="' + i + '">' + a.textContent.trim() + '</button></li>'; }).join('');
      var cal = $$('#pro-cal .cal-row, #pro-cal tr, #pro-cal li').slice(0, 4).map(function (r) { return '<li>' + r.textContent.replace(/\s+/g, ' ').trim().slice(0, 40) + '</li>'; }).join('');
      side.innerHTML = '<b class="sd-h">바로가기</b><ul>' + items + '</ul>' + (cal ? '<b class="sd-h">오늘·다가오는 일정</b><ul class="sd-ev">' + cal + '</ul>' : '');
    }
    side.addEventListener('click', function (e) { var b = e.target.closest('button[data-n]'); if (b) { var a = $$('a', toc)[+b.dataset.n]; if (a) a.click(); } });
    var sdn = 0; var sdt = setInterval(function () { if (++sdn > 8) clearInterval(sdt); if (window.innerWidth >= 1500) sideFill(); }, 2000);
    window.addEventListener('resize', function () { if (window.innerWidth >= 1500 && !side.children.length) sideFill(); });
    if (window.innerWidth >= 1500) setTimeout(sideFill, 600);
    /* PC 도입문 한 줄(더보기로 펼침) */
    var lead = $('.pg-lead');
    if (lead && window.innerWidth > 700) {
      var mb = document.createElement('button'); mb.type = 'button'; mb.className = 'lead-pc'; mb.textContent = '더보기'; mb.setAttribute('aria-expanded', 'false');
      lead.after(mb);
      mb.addEventListener('click', function () { var o = lead.classList.toggle('lead-open'); mb.textContent = o ? '접기' : '더보기'; mb.setAttribute('aria-expanded', String(o)); });
    }
  })();

  /* ───────── v38 마감: 스크롤 상태 · 하나만 열기 · 현재 위치 · 빈 값 · 범례 접기 · 빌드 표시 ───────── */
  (function () {
    var B = document.body, lastY = window.scrollY, ticking = false, posT;
    /* 고정 영역 줄이기: 내려가면 티커 띠 숨김, 올리면 표시 / 맨 위로 버튼은 올릴 때만 */
    var acc = 0, dir = 0;
    window.addEventListener('scroll', function () {
      var y = window.scrollY, dy = y - lastY; lastY = y;
      if (Math.abs(dy) < 14) return;          /* 높이 변화로 생기는 미세 흔들림 무시 */
      var d = dy > 0 ? 1 : -1; if (d !== dir) { dir = d; acc = 0; } acc += Math.abs(dy);
      if (acc < 80) return;                   /* 한 방향으로 80px 이상 움직였을 때만 전환 */
      if (y < 120) { B.classList.remove('mk-down'); D.classList.remove('mk-up'); return; }
      B.classList.toggle('mk-down', d > 0 && y > 240);
      D.classList.toggle('mk-up', d < 0 && y > 600);
    }, { passive: true });
    /* 내 설정 내보내기 / 가져오기 (mk_* 저장값) */
    var pop = $('#hd-pop');
    if (pop && !$('#mk-bk')) {
      var br = document.createElement('div'); br.className = 'hp-r'; br.id = 'mk-bk';
      br.innerHTML = '<span class="hp-l">내 설정 백업</span><span class="mk-bk"><button type="button" id="bk-ex">내보내기</button><button type="button" id="bk-im">가져오기</button><input type="file" id="bk-f" accept="application/json,.json" hidden><span class="mk-bk-s" id="bk-s" role="status"></span></span>';
      pop.insertBefore(br, $('.hp-gift', pop));
      var say = function (t) { $('#bk-s').textContent = t; };
      br.addEventListener('click', function (e) { e.stopPropagation(); });
      $('#bk-ex').addEventListener('click', function () {
        var o = {}; try { for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (prefs.valid(k, localStorage.getItem(k))) o[k] = localStorage.getItem(k); } } catch (e) {}
        var n = Object.keys(o).length; if (!n) { say('저장된 설정이 없습니다.'); return; }
        var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify({ app: 'mrkim', v: 1, data: o }, null, 1)], { type: 'application/json' }));
        a.download = 'mrkim-settings.json'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000); say(n + '개 항목을 내보냈습니다.');
      });
      $('#bk-im').addEventListener('click', function () { $('#bk-f').click(); });
      $('#bk-f').addEventListener('change', function () {
        var f = this.files && this.files[0]; this.value = ''; if (!f) return; if (f.size > 200000) { say('파일이 너무 큽니다.'); return; }
        var rd = new FileReader(); rd.onload = function () {
          try { var j = JSON.parse(rd.result), d = j && j.app === 'mrkim' && j.data, c = 0;
            if (!d || typeof d !== 'object' || Array.isArray(d) || j.v !== 1) throw 0;
            var keys=Object.keys(d); if(keys.length > 200 || keys.some(function(k){return !prefs.valid(k,d[k]);})) throw 0;
            Object.keys(d).forEach(function (k) { if (prefs.valid(k, d[k])) { localStorage.setItem(k, d[k]); c++; } });
            say(c + '개 항목을 가져왔습니다. 새로고침하면 적용됩니다.');
          } catch (e) { say('올바른 백업 파일이 아닙니다.'); }
        }; rd.readAsText(f);
      });
    }
    /* 하나만 열기(설정 메뉴 토글) */
    var pop = $('#hd-pop');
    if (pop && !$('#hp-one')) {
      var r = document.createElement('div'); r.className = 'hp-r'; r.innerHTML = '<span class="hp-l">섹션 하나만 열기</span><button type="button" id="hp-one" aria-pressed="false">끔</button>';
      var g = $('.hp-gift', pop); pop.insertBefore(r, g);
      var one = function () { return store.get('mk_one') === '1'; };
      var sync = function () { var b = $('#hp-one'); b.setAttribute('aria-pressed', String(one())); b.textContent = one() ? '켬' : '끔'; };
      sync();
      $('#hp-one').addEventListener('click', function (e) { e.stopPropagation(); store.set('mk_one', one() ? '0' : '1'); sync(); });
      document.addEventListener('click', function (e) {
        if (!one()) return; var h = e.target.closest && e.target.closest('h2.fold-h'); if (!h || e.target.closest('a')) return;
        setTimeout(function () { var b = $('.fold-btn', h); if (!b || b.getAttribute('aria-expanded') !== 'true') return;
          $$('h2.fold-h').forEach(function (o) { if (o !== h && o._set) { var ob = $('.fold-btn', o); if (ob && ob.getAttribute('aria-expanded') === 'true') o._set(false); } });
          var off = (($('header') || {}).offsetHeight || 0) + 44; window.scrollTo({ top: h.getBoundingClientRect().top + window.scrollY - off, behavior: 'smooth' });
        }, 30);
      }, true);
    }
    /* 현재 위치 표시(모바일) */
    var pill = document.createElement('div'); pill.id = 'mk-pos'; pill.setAttribute('aria-hidden', 'true'); document.body.appendChild(pill);
    window.addEventListener('scroll', function () {
      var hs = $$('h2.fold-h'); if (!hs.length) return; var y = window.innerHeight * 0.35, idx = -1;
      hs.forEach(function (h, i) { if (h.getBoundingClientRect().top < y) idx = i; });
      if (idx < 0) { pill.classList.remove('on'); return; }
      var t = $('.fold-t', hs[idx]); pill.textContent = (idx + 1) + '/' + hs.length + ' · ' + (t ? Array.from(t.textContent.replace(/[\u{1F1E6}-\u{1F1FF}\u{1F300}-\u{1FAFF}]/gu, '').trim().replace(/\s+/g, ' ')).slice(0, 14).join('') : '');
      pill.classList.add('on'); clearTimeout(posT); posT = setTimeout(function () { pill.classList.remove('on'); }, 1800);
    }, { passive: true });
    /* 빈 값 통일: -- 는 회색 + 사유 툴팁 */
    function na() {
      $$('.wl-price, .wl-pct, .px, .ch').forEach(function (e) {
        var t = e.textContent.trim(), isNa = t === '--' || t === '-';
        if (isNa !== e.classList.contains('na')) e.classList.toggle('na', isNa);
        if (isNa && !e.title) e.title = '데이터 없음 · 장 마감 전이거나 공급처 응답 지연';
        if (!isNa && e.title && e.title.indexOf('데이터 없음') === 0) e.removeAttribute('title');
      });
    }
    na(); setInterval(na, 3000);
    /* 버튼 안내 범례 접기 */
    $$('.act-legend').forEach(function (p) {
      if (p.dataset.fold) return; p.dataset.fold = '1';
      var b = document.createElement('button'); b.type = 'button'; b.className = 'lg-t'; b.setAttribute('aria-expanded', 'false'); b.textContent = 'ⓘ 버튼 안내';
      p.before(b); p.hidden = true;
      b.addEventListener('click', function () { var o = p.hidden; p.hidden = !o; b.setAttribute('aria-expanded', String(o)); });
    });
    /* 시총: 기간 탭과 표시 설정을 한 줄로 */
    function mergeCap() {
      var t = $('.tabs[data-group="cap"]'), c = $('#cap-chip-set'); if (!t || !c || $('.cap-ctl')) return;
      var w = document.createElement('div'); w.className = 'cap-ctl'; t.before(w); w.appendChild(c); w.appendChild(t);
    }
    mergeCap(); setTimeout(mergeCap, 1500); setTimeout(mergeCap, 5000);
    /* 빌드 표시 */
    var sc = $('script[src*="mrkim-common"]'); var m = sc && /[?&]v=([0-9a-f]{6,8})/.exec(sc.getAttribute('src'));
    var disc = $('footer .wrap') || $('footer'); if (m && disc && !$('#mk-ver')) { var v = document.createElement('div'); v.id = 'mk-ver'; v.textContent = '빌드 ' + m[1]; disc.appendChild(v); }

    /* 11px 미만 글자는 11.5px로(포인트 선물하기 링크 제외) */
    function tiny() {
      $$('body *').forEach(function (e) {
        if (e.closest('.naver-gift,svg,script,style,#lev-tbl .wl-quote,#krlev-tbl .wl-quote')) return; /* 레버리지 가격·등락률은 CSS(v59)로 통일 */
        var own = false; for (var i = 0; i < e.childNodes.length; i++) { var n = e.childNodes[i]; if (n.nodeType === 3 && n.textContent.trim()) { own = true; break; } }
        if (!own) return; var f = parseFloat(getComputedStyle(e).fontSize); if (f < 11) e.style.setProperty('font-size', '11.5px', 'important');
      });
    }
    [1200, 4000, 9000].forEach(function (t) { setTimeout(tiny, t); });
  })();

  /* ───────── 마지막 방문 이후 변화: 공포탐욕 값을 하루 단위로 저장해 전일/지난 방문 대비를 보여준다 ───────── */
  (function () {
    var pg = (location.pathname.split('/').pop() || '').replace(/\.html$/, ''); if (pg !== 'stock' && pg !== 'kr-stock') return;
    var key = 'mk_pv_' + pg, n = 0, last = null;
    function ymd() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
    function tick() {
      var e = $('#pb-fg'); if (!e) return; var tx = (e.textContent || '').trim(), v = parseFloat(tx); if (!isFinite(v) || tx === last) return; last = tx;
      var o = {}; try { o = JSON.parse(localStorage.getItem(key) || '{}') || {}; } catch (x) { o = {}; }
      var day = ymd(); if (o.day && o.day !== day) o.prev = { v: o.v, day: o.day };
      o.v = v; o.t = tx; o.day = day; o.ts = Date.now(); try { localStorage.setItem(key, JSON.stringify(o)); } catch (x) {}
      var hd = $('#pro-brief .pb-hd'), old = $('#pro-brief .pb-delta'); if (old) old.remove();
      if (hd && o.prev && isFinite(o.prev.v)) { var d = Math.round((v - o.prev.v) * 10) / 10, s = document.createElement('span'); s.className = 'pb-delta'; s.textContent = o.prev.day.slice(5).replace('-', '/') + ' 대비 공탐 ' + (d > 0 ? '+' : d < 0 ? '−' : '±') + Math.abs(d); hd.appendChild(s); }
    }
    var t = setInterval(function () { tick(); if (++n > 40) clearInterval(t); }, 2000);
  })();

  /* ───────── 스켈레톤 로딩 표시 · PC 고정 요약 띠 ───────── */
  (function () {
    var n = 0;
    function skel() {
      $$('.mut, td, p, span, div').forEach(function (el) {
        if (el.children.length) { return; }
        var t = (el.textContent || '').trim();
        if (t.length && t.length < 40 && /^(불러오는 중|로딩 중|데이터 불러오는 중)/.test(t)) { if (!el.classList.contains('skel')) { el.classList.add('skel'); el.setAttribute('aria-busy', 'true'); } }
        else if (el.classList.contains('skel')) { el.classList.remove('skel'); el.removeAttribute('aria-busy'); }
      });
    }
    var id = setInterval(function () { skel(); if (++n > 40) clearInterval(id); }, 1500); skel();
    var br = $('#pro-brief'); if (!br || window.innerWidth <= 700) return;
    var bar = document.createElement('div'); bar.id = 'pb-sticky'; bar.hidden = true; bar.setAttribute('role', 'status'); document.body.appendChild(bar);
    function upd() {
      var ln = $('#pb-line'); if (!ln) return;
      var sg = ln.querySelectorAll('.pb-seg'); var tx = sg.length ? Array.prototype.map.call(sg, function (x) { return x.textContent.trim(); }).join(' · ') : (ln.textContent || '').trim();
      var hd = $('header'), top = hd ? hd.getBoundingClientRect().bottom : 0;
      var off = br.getBoundingClientRect().bottom < Math.max(top, 0) + 4;
      if (bar.textContent !== tx) bar.textContent = tx;
      bar.style.top = Math.max(0, Math.round(top)) + 'px';
      bar.hidden = !(off && tx);
    }
    window.addEventListener('scroll', upd, { passive: true }); setInterval(upd, 2000);
  })();
})();

/* Administrator-only local update history UI. */
(function(){
 var footer=document.querySelector('footer');if(!footer)return;
 var area=document.getElementById('stock-update-footer');if(!area){area=document.createElement('div');area.id='stock-update-footer';footer.appendChild(area);}
 var log=document.createElement('details');log.id='stock-update-history';log.hidden=true;
 var summary=document.createElement('summary');summary.textContent='업데이트 이력 세부보기';log.appendChild(summary);
 var entries=[['v65','첫 화면 압축 · 공통 상태 판정 · 로딩/펼침 개선 · 모바일 시인성 · 5개 파일 통합'],['v63','소제목 박스 높이·간격 및 제목/요약/버튼 정렬 통일'],['v61','펼침 버튼 통일 · 휴장/데이터 상태 색상 구분 · 텔레그램 일일요약 Worker 추가'],['v60','펼치기·접기 버튼/세부보기 디자인 및 기호 통일'],['v59','계좌 저장 체크박스 크기·줄바꿈 및 모바일 관심종목 삭제 크기·간격 개선'],['v58','시장 상태 배지·시세 애니메이션·히트맵 롤오버·가격 글꼴 통일'],['v57','설정 절약모드 가림 수정 · 업데이트 최하단 중앙 배치 · 관리자 이력 메뉴'],['v56','방문 중 펼침 유지 · 암호 확인 · 계좌 요약 조건부 표시 · 상단 상태/시세 애니메이션'],['v55','모바일 종가·등락률 15px 및 소제목 간격 12px 통일'],['v54','롤오버·메뉴 통일 · 히트맵 표현 · PC 바로가기 개선'],['v53','PC 요약 한 줄 · 카드 정렬 · 소셜 탭 · 선물 링크'],['v52','모바일 요약 3+2 배치 · 이벤트 표시 버튼 보완'],['v51','가격 잘림 · CNN 점수/막대 · 하단 겹침 수정'],['v50','실적·배당 모바일 배치 및 표시 설정 유지'],['v49','Worker Secret 분리 · 관리자 인증 · 프록시/요청 제한'],['v48','본문 복사 제한 · 출처/워터마크 · CSP 강화']];
 var list=document.createElement('ol');entries.forEach(function(e){var item=document.createElement('li');var date=document.createElement('b');date.textContent='2026.10.10 · '+e[0]+' — ';item.append(date,document.createTextNode(e[1]));list.appendChild(item);});log.appendChild(list);area.appendChild(log);
 function admin(){try{return localStorage.getItem('mk_gate_off')==='1';}catch(e){return false;}}
 function sync(){log.hidden=!admin();if(log.hidden)log.open=false;}
 summary.addEventListener('click',function(e){if(!admin()){e.preventDefault();log.open=false;log.hidden=true;}});
 sync();setInterval(sync,1500);window.addEventListener('storage',sync);
})();

;
/* Source: stock-returns-v67.js */
/* Calendar periods and common-date portfolio curve; no invented account history. */
(function(root){
 'use strict';
 function cutoff(end,months){var d=new Date(end),day=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()-months);var last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();d.setUTCDate(Math.min(day,last));return d.getTime();}
 function slice(data,months,end){end=end||Math.max.apply(null,data.ts);var start=cutoff(end,months),p=[];data.ts.forEach(function(t,i){var v=data.cl[i];if(t>=start&&t<=end&&Number.isFinite(v)&&v>0)p.push({t:t,v:v});});return p;}
 function portfolio(series,months){if(!series.length)return [];var end=Math.min.apply(null,series.map(function(s){return s.ts[s.ts.length-1];})),maps=series.map(function(s){var m=new Map();slice(s,months,end).forEach(function(p){m.set(p.t,p.v*s.q);});return m;});var out=[];maps[0].forEach(function(_,t){if(maps.every(function(m){return m.has(t);}))out.push({t:t,v:maps.reduce(function(v,m){return v+m.get(t);},0)});});out.sort(function(a,b){return a.t-b.t;});var base=out.length?out[0].v:0;return base>0?out.map(function(p){return {t:p.t,y:(p.v/base-1)*100};}):[];}
 var api={cutoff:cutoff,slice:slice,portfolio:portfolio};root.MK_RETURNS=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);

;
/* Source: stock-invest-v47.js */
/* Mr.Kim Signal — 투자자 도구(미국주식): 퇴근 후 체크리스트 · 개장 카운트다운 · 내 계좌(손익·비중 경고) · 종목 비교
   모든 입력값은 이 브라우저(localStorage)에만 저장되며 서버로 보내지 않습니다. 시세는 기존 공용 조회(getJSON)를 사용하고, 값이 없으면 비워 둡니다. */
(function () {
  'use strict';
  if (!document.body || !document.body.classList.contains('pro') || !document.getElementById('pro-brief') && !document.getElementById('my-wl') && !document.getElementById('tick-tbl')) { /* 요약이 늦게 생길 수 있어 계속 진행 */ }
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var store = { get: function (k) { try { return (k==='mk_hold'&&localStorage.getItem('stock_account_persist')!=='1'&&!localStorage.getItem(k)?sessionStorage:localStorage).getItem(k); } catch (e) { return null; } }, set: function (k, v) { try { (k==='mk_hold'&&localStorage.getItem('stock_account_persist')!=='1'?sessionStorage:localStorage).setItem(k, v); } catch (e) {} } };
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var RE = /^[A-Z0-9.^=\-]{1,15}$/;
  var LEV = function () { try { return Object.keys(LEV_META).filter(function (k) { return LEV_META[k].L === 3 && !LEV_META[k].kr; }); } catch (e) { return []; } };
  var fmtPct = function (v) { return v == null || !isFinite(v) ? '—' : (v >= 0 ? '+' : '') + v.toFixed(2) + '%'; };
  var fmtUsd = function (v) { return v == null || !isFinite(v) ? '—' : (v < 0 ? '−' : '') + '$' + Math.abs(v).toLocaleString('en-US', { maximumFractionDigits: 0 }); };
  var cls = function (v) { return v == null ? '' : v >= 0 ? 'up' : 'down'; };
  var today = function () { var d = new Date(); return d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0'); };

  /* ───────── 시세 조회(60초 캐시) ───────── */
  var QC = {};
  async function chart(sym, range) {
    var k = sym + '|' + range, c = QC[k]; if (c && Date.now() - c.t < 60000) return c.v;
    try {
      var j = await getJSON('https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(sym) + '?range=' + range + '&interval=1d');
      var r = j.chart.result[0], q = r.indicators && r.indicators.quote && r.indicators.quote[0].close || [], T = r.timestamp || [], cl = [], ts = [];
      q.forEach(function (x, i) { if (x != null) { cl.push(x); ts.push((T[i] || 0) * 1000); } });
      var px = (r.meta && r.meta.regularMarketPrice != null) ? r.meta.regularMarketPrice : cl[cl.length - 1];
      /* 전일 종가: 현재가가 속한 거래일(뉴욕) 이전의 마지막 종가 — 장전·휴장·장중 모두 동일 기준 */
      var ky = function (t) { return new Date(t).toLocaleDateString('en-CA', { timeZone: 'America/New_York' }); };
      var pk = r.meta && r.meta.regularMarketTime ? ky(r.meta.regularMarketTime * 1000) : (ts.length ? ky(ts[ts.length - 1]) : null), prev = null;
      for (var ii = cl.length - 1; ii >= 0 && pk; ii--) { if (ts[ii] && ky(ts[ii]) < pk) { prev = cl[ii]; break; } }
      if (prev == null) prev = cl.length >= 2 ? cl[cl.length - 2] : (r.meta && r.meta.previousClose != null ? r.meta.previousClose : null);
      var v = { px: px, cl: cl, ts: ts, prev: prev, meta: r.meta || {} };
      QC[k] = { t: Date.now(), v: v }; return v;
    } catch (e) { return null; }
  }

  /* ───────── 다음 개장 시각(뉴욕 09:30~16:00 · 휴장일은 반영하지 않음) ───────── */
  var NYF = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: false, weekday: 'short' });
  function nyParts(ts) { var p = {}; NYF.formatToParts(new Date(ts)).forEach(function (x) { p[x.type] = x.value; }); p.hour = (+p.hour) % 24; return p; }
  function nyToUtc(y, m, d, hh, mm) { /* 뉴욕 현지 시각 → UTC ms */
    var g = Date.UTC(y, m - 1, d, hh + 5, mm);
    for (var i = 0; i < 3; i++) { var p = nyParts(g), cur = Date.UTC(+p.year, +p.month - 1, +p.day, p.hour, +p.minute), want = Date.UTC(y, m - 1, d, hh, mm); g += want - cur; }
    return g;
  }
  function marketClock() {
    var now = Date.now(), p = nyParts(now), wk = p.weekday;
    var openNow = wk !== 'Sat' && wk !== 'Sun' && (p.hour * 60 + +p.minute) >= 570 && (p.hour * 60 + +p.minute) < 960;
    var y = +p.year, m = +p.month, d = +p.day;
    if (openNow) { return { open: true, until: nyToUtc(y, m, d, 16, 0) - now }; }
    for (var i = 0; i < 8; i++) {
      var base = Date.UTC(y, m - 1, d + i, 12), q = nyParts(base);
      if (q.weekday === 'Sat' || q.weekday === 'Sun') continue;
      var t = nyToUtc(+q.year, +q.month, +q.day, 9, 30);
      if (t > now) return { open: false, at: t, until: t - now };
    }
    return null;
  }
  var hms = function (ms) { var s = Math.max(0, Math.floor(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return (h >= 24 ? Math.floor(h / 24) + '일 ' + (h % 24) : h) + ':' + String(m).padStart(2, '0') + ':' + String(x).padStart(2, '0'); };
  var kst = function (ts) { return new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(ts)); };

  /* ───────── 내 계좌(보유종목) ───────── */
  var HK = 'mk_hold', CK = 'mk_levcap';
  var loadH = function () { try { var o = JSON.parse(store.get(HK) || '{}'); if(!o||typeof o!=='object'||Array.isArray(o))return {};var clean=Object.create(null);Object.keys(o).slice(0,30).forEach(function(t){var r=o[t];if(typeof t!=='string'||!RE.test(t)||!r||typeof r!=='object'||typeof r.q!=='number'||!isFinite(r.q)||r.q<=0||r.q>1e12)return;if(r.c!==null&&(typeof r.c!=='number'||!isFinite(r.c)||r.c<=0||r.c>1e12))return;clean[t]={q:r.q,c:r.c};});return clean; } catch (e) { return {}; } };
  var saveH = function (o) { store.set(HK, JSON.stringify(o)); };
  var levCap = function () { var v = parseFloat(store.get(CK)); return isFinite(v) && v > 0 && v <= 100 ? v : 30; };
  window.MK_ACCT = null;
  var acctBox;
  function myTickers() { try { var a = JSON.parse(store.get('mk_my_tickers') || '[]'); return Array.isArray(a) ? a.filter(function (t) { return RE.test(t); }) : []; } catch (e) { return []; } }
  /* 모바일 접기/펼치기(CSS는 700px 이하에서만 본문을 숨김) — 기본은 접힘 */
  function mfold(card) {
    if (!card || card.dataset.mf) return; var h = card.querySelector('h3'); if (!h) return;
    card.dataset.mf = '1'; card.classList.add('m-fold');
    var b = document.createElement('button'); b.type = 'button'; b.className = 'm-fold-btn'; h.appendChild(b);
    var sk = 'mk_m_' + card.id, set = function (o) { card.classList.toggle('m-open', o); b.innerHTML = o ? '<em>접기</em> ➖' : '<em>펼치기</em> ➕'; b.setAttribute('aria-expanded', String(o)); store.set(sk, o ? '1' : '0'); };
    set(store.get(sk) === '1');
    h.addEventListener('click', function () { set(!card.classList.contains('m-open')); });
  }
  function buildAcct() {
    var my = $('#my-wl'); if (!my || $('#mk-acct')) return !!$('#mk-acct');
    acctBox = document.createElement('div'); acctBox.className = 'card'; acctBox.id = 'mk-acct'; acctBox.style.marginTop = '16px';
    acctBox.innerHTML = '<h3><span>💼 내 계좌 · 손익과 3배 비중</span><span class="mut" style="font-weight:400;font-size:11.5px">선택 입력 · 이 브라우저에만 저장</span></h3>' +
      '<div id="ac-sum" class="ac-sum" role="status"></div><div class="scroll"><table class="ac-t"><thead><tr><th>종목</th><th>수량</th><th>평균단가($)</th><th class="n">현재가</th><th class="n">평가금액</th><th class="n">손익</th><th class="n">오늘</th><th class="n">비중</th><th>수정·삭제</th></tr></thead><tbody id="ac-b"></tbody></table></div>' +
      '<form class="ac-add" autocomplete="off"><input type="text" id="ac-t" maxlength="15" placeholder="티커 (예: TQQQ)" aria-label="보유 종목 티커"><input type="number" id="ac-q" min="0" step="any" placeholder="수량" aria-label="수량"><input type="number" id="ac-c" min="0" step="any" placeholder="평균단가($)" aria-label="평균단가"><button type="submit" id="ac-ok">＋ 추가</button><button type="button" id="ac-cancel" hidden>취소</button></form>' +
      '<label class="ac-cap">3배 ETF 비중 한도 <input type="number" id="ac-cap" min="1" max="100" step="1" aria-label="3배 ETF 비중 한도(%)"> %</label>' +
      '<p class="mut" style="font-size:12px;margin:8px 0 0;line-height:1.6">달러 종목만 합계에 넣습니다(원화 종목 제외). 시세는 지연될 수 있으며 평가금액·손익은 참고용 계산입니다. 3배 ETF 비중은 보유 종목 중 3배 상품의 평가금액 비율입니다.<br>계산식: 손익률 = 현재가÷평균단가−1 · 오늘 = Σ(수량×현재가)÷Σ(수량×전일종가)−1 · 비중 = 종목 평가금액÷달러 종목 합계.</p>';
    my.after(acctBox); mfold(acctBox); buildAccountCurve();
    var retained=localStorage.getItem(HK);if(retained&&localStorage.getItem('stock_account_persist')===null)localStorage.setItem('stock_account_persist','1');
    var preference=document.createElement('label');preference.className='stock-account-save';var remember=document.createElement('input');remember.type='checkbox';remember.checked=localStorage.getItem('stock_account_persist')==='1';preference.appendChild(remember);var saveText=document.createElement('span');saveText.textContent='이 기기에 계좌 정보 계속 저장';var saveHint=document.createElement('small');saveHint.textContent='해제하면 현재 탭에서만 유지';saveText.appendChild(saveHint);preference.appendChild(saveText);acctBox.appendChild(preference);
    remember.addEventListener('change',function(){var holdings=loadH();localStorage.setItem('stock_account_persist',remember.checked?'1':'0');localStorage.removeItem(HK);sessionStorage.removeItem(HK);saveH(holdings);});
    $('#ac-cap', acctBox).value = levCap();
    acctBox.querySelector('form').addEventListener('submit', function (e) {
      e.preventDefault(); var t = $('#ac-t').value.trim().toUpperCase(), q = parseFloat($('#ac-q').value), c = parseFloat($('#ac-c').value);
      if (!RE.test(t) || !(q > 0)) return; var h = loadH(); if (Object.keys(h).length >= 30 && !h[t]) return;
      h[t] = { q: q, c: isFinite(c) && c > 0 ? c : null }; saveH(h); endEdit(); refresh(true);
    });
    var endEdit = function () { acctBox.classList.remove('ac-editing'); $('#ac-t').readOnly = false; $('#ac-ok').textContent = '＋ 추가'; $('#ac-cancel').hidden = true; $('#ac-t').value = ''; $('#ac-q').value = ''; $('#ac-c').value = ''; };
    $('#ac-cancel', acctBox).addEventListener('click', endEdit);
    acctBox.addEventListener('click', function (e) { var eb = e.target.closest('button[data-edit]'); if (eb) { var hh = loadH(), t0 = eb.dataset.edit, o = hh[t0]; if (!o) return; $('#ac-t').value = t0; $('#ac-t').readOnly = true; $('#ac-q').value = o.q; $('#ac-c').value = o.c != null ? o.c : ''; acctBox.classList.add('ac-editing'); $('#ac-ok').textContent = '✔ 수정 저장'; $('#ac-cancel').hidden = false; var f = acctBox.querySelector('form'); if (f.scrollIntoView) f.scrollIntoView({ block: 'center', behavior: 'smooth' }); $('#ac-q').focus(); return; } var b = e.target.closest('button[data-del]'); if (!b) return; var h = loadH(); delete h[b.dataset.del]; saveH(h); refresh(true); });
    $('#ac-cap', acctBox).addEventListener('change', function () { var v = parseFloat(this.value); if (isFinite(v) && v > 0 && v <= 100) store.set(CK, String(v)); refresh(false); });
    return true;
  }
  var lastRows = [];
  async function refresh(fetchNow) {
    if (!buildAcct()) return;
    var signature=JSON.stringify(loadH());if(signature!==acSignature){acSignature=signature;++acCurveSerial;var curveHost=$('#ac-curve-result');if(curveHost)curveHost.textContent='기간을 누르면 현재 보유 수량으로 곡선을 조회합니다.';}
    var h = loadH(), keys = Object.keys(h), tb = $('#ac-b'), sum = $('#ac-sum');
    if (!keys.length) { tb.innerHTML = '<tr><td colspan="9" class="mut" style="padding:14px 6px">보유 종목을 입력하면 평가손익, 오늘 변동, 3배 ETF 비중을 계산합니다. 입력하지 않아도 다른 기능은 그대로 쓸 수 있습니다.</td></tr>'; sum.innerHTML = ''; window.MK_ACCT = null; syncBriefCell(); return; }
    var rows = await Promise.all(keys.map(async function (t) {
      var usd = !/\.(KS|KQ)$/.test(t), c = usd ? await chart(t, '5d') : null;
      return { t: t, q: h[t].q, cost: h[t].c, usd: usd, px: c && c.px, prev: c && c.prev };
    }));
    var tot = 0, totPrev = 0, totCost = 0, costOk = true, levV = 0, lv = LEV();
    rows.forEach(function (r) { if (r.usd && r.px != null) { r.val = r.q * r.px; tot += r.val; if (r.prev != null) totPrev += r.q * r.prev; else totPrev += r.val; if (r.cost != null) totCost += r.q * r.cost; else costOk = false; if (lv.indexOf(r.t) >= 0) levV += r.val; } });
    rows.forEach(function (r) { r.w = r.val != null && tot > 0 ? r.val / tot * 100 : null; r.pl = r.val != null && r.cost != null ? r.val - r.q * r.cost : null; r.plp = r.pl != null ? (r.px / r.cost - 1) * 100 : null; r.day = r.px != null && r.prev ? (r.px / r.prev - 1) * 100 : null; });
    rows.sort(function (a, b) { return (b.val || 0) - (a.val || 0); });
    tb.innerHTML = rows.map(function (r) {
      return '<tr><td><b>' + esc(r.t) + '</b>' + (lv.indexOf(r.t) >= 0 ? ' <span class="ac-l" title="3배 레버리지 상품">3x</span>' : '') + '<small class="ac-sub">' + r.q + '주 · 평단 ' + (r.cost != null ? '$' + r.cost : '—') + '<br>오늘 <span class="' + cls(r.day) + '">' + fmtPct(r.day) + '</span> · 비중 ' + (r.w != null ? r.w.toFixed(0) + '%' : '—') + '</small></td><td>' + r.q + '</td><td>' + (r.cost != null ? r.cost.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}) : '—') + '</td><td class="n ac-price">' + (r.px != null ? '$' + r.px.toFixed(2) : '—') + '</td><td class="n">' + (r.val != null ? fmtUsd(r.val) : '<span class="na">' + (r.usd ? '—' : '합계 제외') + '</span>') + '</td><td class="n ' + cls(r.plp) + '">' + (r.pl != null ? '<span class="pl-a">' + fmtUsd(r.pl) + '</span> <span class="pl-p">(' + fmtPct(r.plp) + ')</span>' : '—') + '</td><td class="n ' + cls(r.day) + '">' + fmtPct(r.day) + (r.prev != null && r.px != null && r.usd ? '<small class="ac-dd">' + fmtUsd(r.q * (r.px - r.prev)) + '</small>' : '') + '</td><td class="n">' + (r.w != null ? r.w.toFixed(1) + '%' : '—') + '</td><td class="ac-act"><button type="button" class="ac-x ac-ed" data-edit="' + esc(r.t) + '" aria-label="' + esc(r.t) + ' 수정" title="수정">✎</button><button type="button" class="ac-x" data-del="' + esc(r.t) + '" aria-label="' + esc(r.t) + ' 삭제">✕</button></td></tr>';
    }).join('');
    var dayPct = tot > 0 && totPrev > 0 ? (tot / totPrev - 1) * 100 : null, dayUsd = tot - totPrev, levPct = tot > 0 ? levV / tot * 100 : null, cap = levCap();
    var plAll = costOk && totCost > 0 ? tot - totCost : null;
    var alerts = [];
    if (levPct != null && levPct > cap) alerts.push('3배 ETF 비중 ' + levPct.toFixed(0) + '%가 한도 ' + cap + '%를 넘었습니다');
    rows.forEach(function (r) { if (r.day != null && r.day <= -7) alerts.push(r.t + ' 오늘 ' + r.day.toFixed(1) + '%'); });
    sum.innerHTML = '<div><small>오늘 내 계좌</small><b class="' + cls(dayPct) + '">' + fmtPct(dayPct) + '</b><span>' + (tot > 0 ? fmtUsd(dayUsd) : '') + '</span></div><div><small>총 평가금액</small><b>' + (tot > 0 ? fmtUsd(tot) : '—') + '</b><span>' + (plAll != null ? '<span title="매입금액 ' + fmtUsd(totCost) + '">누적 ' + fmtUsd(plAll) + '</span>' : '단가 미입력 종목 있음') + '</span></div><div><small>3배 ETF 비중</small><b class="' + (levPct != null && levPct > cap ? 'down' : '') + '">' + (levPct != null ? levPct.toFixed(0) + '%' : '—') + '</b><span>한도 ' + cap + '%</span></div>' +
      (alerts.length ? '<p class="ac-al" role="alert">⚠ ' + alerts.map(esc).join(' · ') + '</p>' : '');
    lastRows = rows; window.MK_ACCT = { dayPct: dayPct, dayUsd: dayUsd, tot: tot, levPct: levPct, cap: cap, alerts: alerts, rows: rows.map(function (r) { return { t: r.t, day: r.day, w: r.w }; }) };
    syncBriefCell();
  }
  /* 요약 카드에 '내 계좌' 칸(모바일은 맨 앞) */
  function syncBriefCell() {
    var g = $('#pro-brief .pb-grid'); if (!g) return; var a = window.MK_ACCT, c = $('#pb-acct');
    if (!a || a.dayPct == null) { if(c)c.remove();g.classList.remove('has-acct'); return; }
    if (!c) { c = document.createElement('a'); c.id = 'pb-acct'; c.className = 'pb-c'; c.href = '#mk-acct'; c.addEventListener('click', function (e) { e.preventDefault(); var t = $$('#pro-toc a').filter(function (x) { return x.textContent.indexOf('관심') === 0; })[0]; if (t) t.click(); setTimeout(function () { var el = $('#mk-acct'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 400); }); g.appendChild(c); }
    c.innerHTML = '<small>오늘 내 계좌</small><b class="' + cls(a.dayPct) + '">' + fmtPct(a.dayPct) + '</b><span>' + (a.levPct != null ? '3배 비중 ' + a.levPct.toFixed(0) + '%' : '') + (a.alerts.length ? ' · ⚠' + a.alerts.length : '') + '</span>';
    g.classList.add('has-acct');
  }

  var acCurveSerial=0,acMonths=12,acSignature='';
  function buildAccountCurve(){if(!acctBox||$('#ac-curve'))return;var box=document.createElement('section');box.id='ac-curve';box.innerHTML='<h4>현재 보유 수량 기준 과거 수익률</h4><div class="ac-periods" role="group" aria-label="계좌 곡선 기간">'+PERIODS.map(function(p){return '<button type="button" data-months="'+p[1]+'" aria-pressed="'+(p[1]===acMonths)+'">'+p[0]+'</button>';}).join('')+'</div><div id="ac-curve-result" role="status">기간을 누르면 곡선을 조회합니다.</div><p class="mut">현재 수량을 과거에도 동일하게 보유했다고 가정한 가격 수익률입니다. 실제 매매·입출금·배당·환율은 반영하지 않습니다. 모든 보유 종목의 공통 시세 구간만 계산합니다.</p>';acctBox.appendChild(box);box.addEventListener('click',function(e){var b=e.target.closest('[data-months]');if(!b)return;acMonths=+b.dataset.months;box.querySelectorAll('button').forEach(function(x){x.setAttribute('aria-pressed',String(x===b));});drawAccountCurve();});}
  async function drawAccountCurve(){var id=++acCurveSerial,hold=loadH(),keys=Object.keys(hold),host=$('#ac-curve-result');if(!host)return;host.textContent='시세를 불러오는 중…';if(!keys.length){host.textContent='보유 종목을 먼저 입력해 주세요.';return;}if(keys.some(function(t){return /\.(KS|KQ)$/.test(t);})){host.textContent='달러 종목으로만 구성된 계좌에서 조회할 수 있습니다.';return;}var data=await Promise.all(keys.map(function(t){return chart(t,acMonths>12?'10y':'1y');}));if(id!==acCurveSerial)return;if(data.some(function(d){return !d||d.cl.length<2;})){host.textContent='일부 보유 종목의 시세 조회에 실패했습니다. 기간 버튼을 눌러 다시 조회해 주세요.';return;}var points=window.MK_RETURNS.portfolio(data.map(function(d,i){return {cl:d.cl,ts:d.ts,q:hold[keys[i]].q};}),acMonths);if(points.length<2){host.textContent='공통 시세 구간이 부족합니다.';return;}var lo=Math.min(0,Math.min.apply(null,points.map(function(p){return p.y;}))),hi=Math.max(0,Math.max.apply(null,points.map(function(p){return p.y;}))),span=hi-lo||1;lo-=span*.08;hi+=span*.08;var X=function(t){return 60+640*(t-points[0].t)/(points[points.length-1].t-points[0].t);},Y=function(v){return 16+224*(1-(v-lo)/(hi-lo));},last=points[points.length-1];var date=function(t){return new Date(t).toLocaleDateString('ko-KR',{timeZone:'America/New_York'});};host.innerHTML='<div class="ac-curve-meta"><b class="'+cls(last.y)+'">'+fmtPct(last.y)+'</b><span>'+esc(date(points[0].t))+' ~ '+esc(date(last.t))+' · '+keys.length+'종목</span></div><svg class="ac-curve-svg" viewBox="0 0 720 278" role="img" aria-label="현재 보유 수량 기준 과거 가격 수익률"><line x1="60" x2="700" y1="'+Y(0)+'" y2="'+Y(0)+'" stroke="var(--line)"/><text x="4" y="24" fill="var(--tx2)">'+hi.toFixed(1)+'%</text><text x="4" y="240" fill="var(--tx2)">'+lo.toFixed(1)+'%</text><polyline fill="none" stroke="var(--accent)" stroke-width="2" points="'+points.map(function(p){return X(p.t).toFixed(1)+','+Y(p.y).toFixed(1);}).join(' ')+'"/></svg>';}
  /* ───────── 퇴근 후 5분 체크리스트 ───────── */
  var eve;
  function buildEve() {
    var br = $('#pro-brief'); if (!br) return false; if ($('#mk-eve')) return true;
    eve = document.createElement('section'); eve.id = 'mk-eve'; eve.setAttribute('aria-label', '퇴근 후 5분 체크리스트');
    eve.innerHTML = '<div class="ev-hd"><b>🌙 퇴근 후 5분 체크리스트</b><span id="ev-clk" class="ev-clk" role="timer" aria-live="off"></span></div><ul id="ev-ls"></ul><p class="ev-nt">자동으로 모은 확인 목록이며 매매 권유가 아닙니다. 미국 휴장일은 반영하지 않아 개장 시각이 다를 수 있습니다.</p>';
    br.after(eve);
    eve.addEventListener('click', function (e) { var b = e.target.closest('.ev-tg'); if (!b) return; var li = b.closest('li'), o = !li.classList.contains('open'); evOpen[b.dataset.id] = o; li.classList.toggle('open', o); b.setAttribute('aria-expanded', String(o)); b.textContent = o ? '접기 ➖' : '펼치기 ➕'; });
    eve.addEventListener('change', function (e) { var cb = e.target.closest('input[type=checkbox]'); if (!cb) return; var k = 'mk_chk_' + today(), o; try { o = JSON.parse(store.get(k) || '{}'); } catch (x) { o = {}; } if (cb.checked) o[cb.dataset.id] = 1; else delete o[cb.dataset.id]; store.set(k, JSON.stringify(o)); cb.closest('li').classList.toggle('done', cb.checked); });
    return true;
  }
  function items() {
    var L = [], A = (typeof mkActionData === 'function') ? mkActionData() : { earn: [], div: [], hot: [], swing: [] };
    var mine = {}; myTickers().forEach(function (t) { mine[t] = 1; }); Object.keys(loadH()).forEach(function (t) { mine[t] = 1; });
    var chip = function (t, v, c) { return '<span class="ev-ch' + (mine[t] ? ' my' : '') + (c ? ' ' + c : '') + '"><b>' + esc(t) + '</b>' + (v ? '<i>' + v + '</i>' : '') + '</span>'; };
    var chips = function (arr, f, n) { n = n || 8; return arr.slice(0, n).map(f).join('') + (arr.length > n ? '<span class="ev-more">외 ' + (arr.length - n) + '</span>' : ''); };
    var dd = function (x) { return x.d === 0 ? '오늘' : 'D-' + x.d; };
    var byMine = function (arr) { return arr.slice().sort(function (x, y) { return (mine[y.t] ? 1 : 0) - (mine[x.t] ? 1 : 0); }); };
    if (A.earn.length) { var ems = A.earn.filter(function (x) { return mine[x.t]; }).length; L.push({ id: 'e', k: '실적', kc: 'k-e', t: '7일 내 실적 발표 ' + A.earn.length + '곳' + (ems ? ' · 내 종목 ' + ems : ''), c: chips(byMine(A.earn), function (x) { return chip(x.t, dd(x), x.d <= 3 ? 'hot' : ''); }), pri: ems ? 1 : 2 }); }
    if (A.div.length) L.push({ id: 'dv', k: '배당락', kc: 'k-d', t: '7일 내 배당락 ' + A.div.length + '곳 — 배당락일 전 매수해야 배당 대상', c: chips(byMine(A.div), function (x) { return chip(x.t, dd(x), x.d <= 3 ? 'hot' : ''); }), pri: 2 });
    if (A.swing.length) L.push({ id: 'sw', k: '시간외', kc: 'k-s', t: '시간외 ±3% 이상 ' + A.swing.length + '종목', c: chips(A.swing, function (x) { return chip(x.t, fmtPct(x.p), x.p > 0 ? 'up' : 'dn'); }), pri: 1 });
    if (A.hot.length) L.push({ id: 'hot', k: '소셜', kc: 'k-h', t: '소셜 글 급증(시간당 15건↑) ' + A.hot.length + '종목', c: chips(A.hot, function (x) { return chip(x.t, '🔥' + x.r.toFixed(0) + '/h'); }), pri: 2 });
    var fg = ($('#pb-fg') || {}).textContent, ev = ($('#pb-ev') || {}).textContent, ev2 = ($('#pb-ev2') || {}).textContent;
    if (ev && ev !== '--') L.push({ id: 'ca', k: '일정', kc: 'k-c', t: '다음 주요 일정: <b>' + esc(ev) + '</b>', c: ev2 ? '<span class="ev-sub">' + esc(ev2) + '</span>' : '', pri: 2 });
    if (fg && fg !== '--') L.push({ id: 'fg', k: '공탐', kc: 'k-f', t: '공포탐욕 <b>' + esc(fg) + '</b>', c: '<span class="ev-sub">분할 규칙을 지킬 구간인지 확인</span>', pri: 3 });
    var a = window.MK_ACCT;
    if (a) { a.alerts.forEach(function (t, i) { L.push({ id: 'ac' + i, k: '계좌', kc: 'k-a', t: esc(t), c: '', pri: 0 }); }); if (!a.alerts.length) L.push({ id: 'ac-ok', k: '계좌', kc: 'k-a', t: '내 계좌 오늘 <b class="' + cls(a.dayPct) + '">' + fmtPct(a.dayPct) + '</b>', c: a.levPct != null ? '<span class="ev-sub">3배 비중 ' + a.levPct.toFixed(0) + '% (한도 ' + a.cap + '%)</span>' : '', pri: 3 }); }
    else L.push({ id: 'ac-no', k: '계좌', kc: 'k-a', t: '보유 종목을 입력하면 손익과 3배 ETF 비중을 확인합니다', c: '<span class="ev-sub">관심종목 아래 “내 계좌”에 입력</span>', pri: 4 });
    L.sort(function (x, y) { return x.pri - y.pri; }); return L;
  }
  var evSig = '';
  var evOpen = {};
  function renderEve() {
    if (!buildEve()) return;
    var mc = marketClock(), clk = $('#ev-clk');
    if (mc && clk) clk.innerHTML = mc.open ? '<span class="ev-o">정규장 진행 중</span> 마감까지 ' + hms(mc.until) : '다음 개장 <b>' + kst(mc.at) + '</b> KST · ' + hms(mc.until) + ' 남음';
    var L = items(), sig = JSON.stringify(L.map(function (x) { return x.id + x.t + x.c; }));
    if (sig === evSig) return; evSig = sig;
    var o; try { o = JSON.parse(store.get('mk_chk_' + today()) || '{}'); } catch (e) { o = {}; }
    $('#ev-ls').innerHTML = L.map(function (x) { var op = !!evOpen[x.id]; return '<li class="' + (o[x.id] ? 'done' : '') + (op ? ' open' : '') + '"><label><input type="checkbox" data-id="' + x.id + '"' + (o[x.id] ? ' checked' : '') + '><span class="ev-b"><span class="ev-h"><em class="ev-k ' + x.kc + '">' + x.k + '</em><span class="ev-t">' + x.t + '</span></span>' + '</span></label>' + (x.c ? '<button type="button" class="ev-tg" data-id="' + x.id + '" aria-expanded="' + op + '">' + (op ? '접기 ➖' : '펼치기 ➕') + '</button><div class="ev-c">' + x.c + '</div>' : '') + '</li>'; }).join('');
  }

  /* ───────── 종목 비교(최대 3개) ───────── */
  function buildCmp() {
    var base = $('#mk-acct') || $('#my-wl'); if (!base) return false; if ($('#mk-cmp')) return true;
    var my = myTickers(), d = my.length ? my.slice(0, 3) : ['NVDA', 'AAPL', 'MSFT'];
    var box = document.createElement('div'); box.className = 'card'; box.id = 'mk-cmp'; box.style.marginTop = '16px';
    box.innerHTML = '<h3><span>🔍 종목 비교</span><span class="mut" style="font-weight:400;font-size:11.5px">최대 3개 · 시세 기준 계산</span></h3>' +
      '<form class="cm-f" autocomplete="off">' + [0, 1, 2].map(function (i) { return '<input type="text" maxlength="15" value="' + esc(d[i] || '') + '" placeholder="티커 ' + (i + 1) + '" aria-label="비교 종목 ' + (i + 1) + '">'; }).join('') + '<button type="submit">비교</button></form><div id="cm-r" class="scroll"></div>';
    base.after(box); mfold(box);
    box.querySelector('form').addEventListener('submit', function (e) { e.preventDefault(); runCmp(); });
    return true;
  }
  async function runCmp() {
    var ts = $$('#mk-cmp input[type=text]').map(function (i) { return i.value.trim().toUpperCase(); }).filter(function (t, i, a) { return RE.test(t) && a.indexOf(t) === i; });
    var host = $('#cm-r'); if (!ts.length) { ++cmSerial;host.innerHTML = ''; return; }
    host.innerHTML = '<p class="mut" style="font-size:12.5px">불러오는 중…</p>';
    var D = (window.MK_DATA ? window.MK_DATA() : {}) || {};
    var serial=++cmSerial;var cs = await Promise.all(ts.map(function (t) { return chart(t, cmRg>12?'10y':'1y'); }));
    var directDiv=null;try{if(typeof PROXY_BASE!=='undefined'&&PROXY_BASE){var response=await fetch(PROXY_BASE.replace(/\?url=$/,'')+'divs?symbols='+ts.map(encodeURIComponent).join(','),{signal:AbortSignal.timeout(25000)});if(response.ok)directDiv=await response.json();}}catch(e){}
    if(serial!==cmSerial)return;
    D=(window.MK_DATA?window.MK_DATA():{})||{};
    var pc = function (a, b) { return a != null && b ? (a / b - 1) * 100 : null; };
    var col = ts.map(function (t, i) {
      var c = cs[i]; if (!c || !c.cl.length) return { t: t, none: true };
      var cl = c.cl, n = cl.length, hi = Math.max.apply(null, cl), px = c.px;
      var e = D.earn && D.earn[t], dv = directDiv&&directDiv[t] || D.div&&D.div[t];
      var year=window.MK_RETURNS.slice(c,12,c.ts[c.ts.length-1]),recent=c.cl.filter(function(_,i){return c.ts[i]>=window.MK_RETURNS.cutoff(c.ts[c.ts.length-1],12);});hi=Math.max.apply(null,recent);
      return { t: t, px: px, d1: pc(px, c.prev), w: n > 5 ? pc(px, cl[n - 6]) : null, m: n > 21 ? pc(px, cl[n - 22]) : null, y: year.length?pc(px,year[0].v):null, hi: pc(px, hi), er: e && e.ts ? earnDays(e.ts) : null, dv: dv && dv.ex ? earnDays(dv.ex) : null, ex:dv&&dv.ex, divFailed:!directDiv||!!directDiv.error };
    });
    var row = function (l, f) { return '<tr><th scope="row">' + l + '</th>' + col.map(function (c) { return '<td class="n">' + (c.none ? '—' : f(c)) + '</td>'; }).join('') + '</tr>'; };
    var pcell = function (v) { return '<span class="' + cls(v) + '">' + fmtPct(v) + '</span>'; };
    var dd = function (v) { return v == null ? '<span class="na">미확인</span>' : v < 0 ? '지남' : 'D-' + (v === 0 ? 'day' : v); };
    var tbl = '<table class="cm-t"><thead><tr><th></th>' + col.map(function (c, i) { return '<th class="n"><i class="cm-sw cm-c' + i + '"></i>' + esc(c.t) + (c.none ? '<br><small class="na">조회 실패</small>' : '') + '</th>'; }).join('') + '</tr></thead><tbody>' +
      row('현재가', function (c) { return '<b class="stock-price">$' + c.px.toFixed(2)+'</b>'; }) + row('1일', function (c) { return pcell(c.d1); }) + row('1주', function (c) { return pcell(c.w); }) + row('1개월', function (c) { return pcell(c.m); }) + row('1년', function (c) { return pcell(c.y); }) + row('52주 고점 대비', function (c) { return pcell(c.hi); }) + row('다음 실적', function (c) { return dd(c.er); }) + row('배당락', function (c) { return c.ex?'<span>'+new Date(c.ex*1000).toLocaleDateString('ko-KR',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'})+'</span><small class="cm-date-note">'+(c.dv<0?'최근 배당락 · 경과':dd(c.dv))+'</small>':'<span class="na">'+(c.divFailed?'조회 실패':'일정 미제공')+'</span>'; }) +
      '</tbody></table>';
    cmData = ts.map(function (t, i) { return cs[i] && cs[i].cl.length ? { t: t, cl: cs[i].cl, ts: cs[i].ts, i: i } : null; }).filter(Boolean);
    host.innerHTML = '<div class="cm-grid"><div class="cm-tb">' + tbl + '</div><div class="cm-ch"><div class="cm-chh"><b>수익률 곡선</b><span class="cm-rg" role="group" aria-label="기간">' + PERIODS.map(function (x) { return '<button type="button" data-rg="' + x[1] + '" class="' + (cmRg == x[1] ? 'on' : '') + '">' + x[0] + '</button>'; }).join('') + '</span></div><div id="cm-svg"></div></div></div>' +
      '<p class="mut" style="font-size:12px;margin:8px 0 0">배당락은 비교 종목을 직접 조회하며 최근 배당락과 예정일을 구분합니다. 일정 미제공은 무배당을 의미하지 않습니다. 곡선은 일봉 종가 기준 가격 수익률(배당 재투자 제외)이며 상장 이후 제공 구간만 표시합니다.</p>';
    drawCmp();
  }
  var PERIODS=[['1개월',1],['3개월',3],['6개월',6],['1년',12],['3년',36],['5년',60],['10년',120]];var cmData = [], cmRg = 12,cmSerial=0;
  function drawCmp() {
    var host = $('#cm-svg'); if (!host) return;
    if (!cmData.length) { host.innerHTML = '<p class="mut" style="font-size:12.5px">그릴 수 있는 시세가 없습니다.</p>'; return; }
    var W = 520, H = 320, pl = 58, pr = 12, pt = 12, pb = 30;
    var end=Math.max.apply(null,cmData.map(function(d){return d.ts[d.ts.length-1];}));
    var start=window.MK_RETURNS.cutoff(end,cmRg);
    var ser=cmData.map(function(d){var p=window.MK_RETURNS.slice(d,cmRg,end);return {t:d.t,i:d.i,y:p.map(function(x){return (x.v/p[0].v-1)*100;}),ts:p.map(function(x){return x.t;})};}).filter(function(s){return s.y.length>1;});
    if(!ser.length){host.innerHTML='<p class="mut">선택 기간에 표시할 시세가 없습니다.</p>';return;}
    var lo = Infinity, hi = -Infinity; ser.forEach(function (s) { s.y.forEach(function (v) { if (v < lo) lo = v; if (v > hi) hi = v; }); });
    lo = Math.min(lo, 0); hi = Math.max(hi, 0); var span = hi - lo || 1; lo -= span * .06; hi += span * .06;
    var X = function (k, n) { return pl + (W - pl - pr) * (n <= 1 ? 0 : k / (n - 1)); }, Y = function (v) { return pt + (H - pt - pb) * (1 - (v - lo) / (hi - lo)); };
    var step = (function () { var raw = (hi - lo) / 4, p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p; return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * p; })();
    var g = '', v0 = Math.ceil(lo / step) * step; for (var v = v0; v <= hi; v += step) { g += '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + Y(v).toFixed(1) + '" y2="' + Y(v).toFixed(1) + '" class="cm-gl' + (Math.abs(v) < step / 100 ? ' z' : '') + '"/><text x="' + (pl - 6) + '" y="' + (Y(v) + 4).toFixed(1) + '" text-anchor="end" class="cm-tx">' + (v > 0 ? '+' : '') + v.toFixed(0) + '%</text>'; }
    var L0 = ser.reduce(function (a, s) { return s.ts.length > a.ts.length ? s : a; }, ser[0]), md = function (t) { var d = new Date(t); return d.getFullYear()+'.'+(d.getMonth() + 1) + '.' + d.getDate(); };
    var xl = '<text x="' + pl + '" y="' + (H - 7) + '" class="cm-tx">' + md(start) + '</text><text x="' + (W - pr) + '" y="' + (H - 7) + '" text-anchor="end" class="cm-tx">' + md(end) + '</text>';
    var ln = ser.map(function (s) { var n = s.y.length, off = L0.ts.length - n; return '<polyline class="cm-ln cm-c' + s.i + '" fill="none" points="' + s.y.map(function (v, k) { return (pl+(W-pl-pr)*(s.ts[k]-start)/(end-start)).toFixed(1) + ',' + Y(v).toFixed(1); }).join(' ') + '"/>'; }).join('');
    var lg = ser.map(function (s) { var e = s.y[s.y.length - 1]; return '<span><i class="cm-sw cm-c' + s.i + '"></i><b>' + esc(s.t) + '</b> <em class="' + cls(e) + '">' + fmtPct(e) + '</em></span>'; }).join('');
    host.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="종목별 누적 수익률 곡선" class="cm-svg">' + g + xl + ln + '</svg><div class="cm-lg">' + lg + '</div>';
  }
  document.addEventListener('click', function (e) { var b = e.target.closest('.cm-rg button'); if (!b) return; cmRg = +b.dataset.rg; $$('.cm-rg button').forEach(function (x) { x.classList.toggle('on', x === b); }); if(cmRg>12&&cmData.some(function(d){return d.ts.length<500;}))runCmp();else drawCmp(); });

  /* ───────── 구동 ───────── */
  var tries = 0;
  (function boot() {
    buildEve(); var ok = buildAcct(); if (ok) buildCmp();
    if ((!$('#mk-eve') || !$('#mk-acct') || !$('#mk-cmp')) && ++tries < 30) { setTimeout(boot, 700); return; }
    refresh(true); renderEve(); setInterval(renderEve, 1000);
    setInterval(function () { if (!document.hidden && Object.keys(loadH()).length) refresh(true); }, 60000);
    document.addEventListener('visibilitychange', function () { if (!document.hidden && Object.keys(loadH()).length) refresh(true); });
  })();
})();

;
/* Source: stock-dashboard-v2.js */
(function(){
 'use strict';
 var lead=document.querySelector('.pg-lead'); if(!lead)return;
 var box=document.createElement('div');box.className='stock-status';box.dataset.state='loading';
 var label=document.createElement('p'); label.textContent='데이터 연결을 확인하고 있습니다. 공개 시세는 지연될 수 있습니다.';
 label.setAttribute('role','status');label.setAttribute('aria-live','polite');
 var retry=document.createElement('button');retry.type='button';retry.textContent='다시 불러오기';retry.addEventListener('click',function(){location.reload();});
 box.append(label,retry);lead.after(box);
 var lastMessage=''; var begun=Date.now();
 function update(){
  var net=window.MK_NET, result=window.MK_DATA_STATUS(net,navigator.onLine,Date.now(),window.MK_FG_PHASE),state=result.state;
  var text=net&&net.lastOk?'최근 조회 '+new Date(net.lastOk).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})+' · 시세 기준은 카드별 표시':'공개 시세 연결 확인 중';
  if(state==='error')text='연결 상태를 확인하거나 다시 불러와 주세요.';
  box.title='최근 조회는 이 페이지가 데이터를 받은 시간입니다. 시세 기준시간과 다르며, 미국 공휴일 여부는 별도 확인이 필요합니다.';
  box.dataset.state=state;if(lastMessage!==text){label.textContent=text;lastMessage=text;}
 }
 update();setInterval(update,5000);window.addEventListener('online',update);window.addEventListener('offline',update);
})();

;
/* Source: stock-layout-v3.js */
/* US-only visual layout. Existing IDs, data objects and event handlers stay intact. */
(function(){
 'use strict';
 var wrap=document.querySelector('#stock > .wrap'),brief=document.getElementById('pro-brief');
 if(!wrap||!brief)return;var foldAll=document.querySelector('.fold-all');if(foldAll)brief.before(foldAll);
 function details(className,title){var d=document.createElement('details');d.className=className;var s=document.createElement('summary');s.textContent=title;d.appendChild(s);return d;}
 // Keep the live ticker available on demand; avoid an extra sticky toolbar.
 var market=details('stock-market-details','주요 지수·환율 시세 보기');
 var ticker=document.getElementById('pro-tick');if(ticker)market.appendChild(ticker);
 var status=document.getElementById('pro-status');if(status){status.hidden=true;market.appendChild(status);}
 if(ticker){var live=ticker.querySelector('.pt-live');if(live)live.textContent='● 주요 시세';var track=document.createElement('div');track.className='stock-ticker-track';while(ticker.firstChild)track.appendChild(ticker.firstChild);ticker.appendChild(track);}
 var state=document.querySelector('.stock-status');if(state)state.after(market);else brief.before(market);
 var session=document.createElement('span');session.className='stock-session';session.setAttribute('aria-label','미국 시장 상태');
 var head=brief.querySelector('.pb-hd');if(head)head.appendChild(session);
 function syncSession(){var e=document.querySelector('#pro-status .ps-mk');session.textContent=e?e.textContent:'미국 시장';}
 syncSession();if(status)new MutationObserver(syncSession).observe(status,{childList:true,subtree:true,characterData:true});
 // Put dense commentary and futures behind a native, keyboard-accessible disclosure.
 var more=details('stock-brief-details','시장 요약·선물 흐름 보기');
 ['pb-state','pb-line','pb-fut'].forEach(function(id){var e=document.getElementById(id);if(e)more.appendChild(e);});
 brief.appendChild(more);
 var desktop=window.matchMedia('(min-width:701px)');
 function syncDesktop(){document.querySelectorAll('.stock-insights-details').forEach(function(d){d.open=desktop.matches;});}
 desktop.addEventListener('change',syncDesktop);setTimeout(syncDesktop,0);
 var toc=document.getElementById('pro-toc');if(toc){brief.after(toc);var search=toc.querySelector('.pt-s');if(search&&search.firstChild&&search.firstChild.nodeType===3){search.firstChild.textContent='';var icon=document.createElementNS('http://www.w3.org/2000/svg','svg');icon.setAttribute('viewBox','0 0 24 24');icon.setAttribute('class','stock-search-icon');icon.setAttribute('aria-hidden','true');icon.innerHTML='<circle cx="10" cy="10" r="6" fill="none" stroke="currentColor" stroke-width="2"/><path d="m15 15 6 6" stroke="currentColor" stroke-width="2"/>';search.prepend(icon);}}
 // Keep personal tools available below the primary market analytics.
 var personal=details('stock-personal-details','관심종목·계좌·종목 비교 도구');
 ['mk-eve','my-wl','mk-acct','mk-cmp'].forEach(function(id){var e=document.getElementById(id);if(e)personal.appendChild(e);});
 if(personal.children.length>1){var calendar=document.getElementById('pro-cal');if(calendar)calendar.after(personal);else wrap.appendChild(personal);}
 // Live gauge reads the original CNN value. Missing data is never replaced with a sample.
 var card=document.getElementById('us-card'),source=document.getElementById('us-val');
 if(card&&source){
  var h=card.querySelector('.fg-hd h3');if(h)Array.from(h.childNodes).forEach(function(n){if(n.nodeType===3)n.textContent=n.textContent.replace('🇺🇸','').trim();});
  var gauge=document.createElement('a');gauge.className='stock-gauge';gauge.href='https://www.cnn.com/markets/fear-and-greed';gauge.target='_blank';gauge.rel='noopener noreferrer';
  gauge.innerHTML='<svg viewBox="0 0 240 160" role="img" aria-label="공포탐욕지수 연결 중"><g class="sg-segments"></g><path class="sg-pointer" fill="currentColor" hidden></path><text class="sg-value" x="120" y="111" text-anchor="middle">—</text><text class="sg-label" x="120" y="137" text-anchor="middle">데이터 연결 중</text><text class="sg-edge" x="19" y="147" text-anchor="start">공포 0</text><text class="sg-edge" x="221" y="147" text-anchor="end">100 탐욕</text></svg>';
  var svg=gauge.querySelector('svg'),group=gauge.querySelector('.sg-segments'),colors=['#ef8e86','#f3c17a','#e7dba0','#9bd5ba','#4bb792'];
  function point(angle,r){return [120+Math.cos(angle)*r,119-Math.sin(angle)*r];}
  colors.forEach(function(color,i){var start=point(Math.PI-i*Math.PI/5-.02,94),end=point(Math.PI-(i+1)*Math.PI/5+.02,94),p=document.createElementNS('http://www.w3.org/2000/svg','path');p.setAttribute('d','M '+start.join(' ')+' A 94 94 0 0 1 '+end.join(' '));p.setAttribute('fill','none');p.setAttribute('stroke',color);p.setAttribute('stroke-width','17');group.appendChild(p);});
  card.querySelector('.fg-top').prepend(gauge);
  var insights=details('stock-insights-details','지수 해석·관련 일정 보기');
  ['pro-kc','fg-alert','us-next-event'].forEach(function(id){var e=document.getElementById(id);if(e)insights.appendChild(e);});
  card.appendChild(insights);
  function syncGauge(){
   var text=source.textContent.trim(),n=Number(text),ok=text!==''&&Number.isFinite(n)&&n>=0&&n<=100;
   gauge.querySelector('.sg-value').textContent=ok?String(Math.round(n)):'—';
   var label=ok?(n<25?'극단적 공포':n<45?'공포':n<=55?'중립':n<=75?'탐욕':'극단적 탐욕'):'데이터 연결 중';
   gauge.querySelector('.sg-label').textContent=label;svg.setAttribute('aria-label',ok?'공포탐욕지수 '+Math.round(n)+'점 · '+label:'공포탐욕지수 연결 중');
   var arrow=gauge.querySelector('.sg-pointer');arrow.style.display=ok?'':'none';
   if(ok){arrow.removeAttribute('hidden');var a=Math.PI*(1-n/100),tip=point(a,108),left=point(a-.065,82),right=point(a+.065,82);arrow.setAttribute('d','M '+tip.join(' ')+' L '+left.join(' ')+' L '+right.join(' ')+' Z');}
  }
  syncGauge();new MutationObserver(syncGauge).observe(source,{childList:true,subtree:true,characterData:true});
 }
 
 var icons=['<path d="M4 20V10h4v10m4 0V4h4v16m4 0v-7h-1"/>','<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9z"/>','<path d="M4 6h15v14H4zM4 6V4h13v2m-3 6h7v5h-7z"/>','<path d="M4 5h16v16H4zM4 10h16M8 3v4m8-4v4"/>','<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>'];
 document.querySelectorAll('#mk-tabbar .ti').forEach(function(el,i){el.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">'+icons[i]+'</svg>';});
 // Native disclosures must open when a direct anchor targets a contained tool.
 document.addEventListener('click',function(e){var a=e.target.closest('a[href^="#"]');if(!a)return;var id=a.getAttribute('href').slice(1),el=id&&document.getElementById(id);if(el){for(var p=el.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;}},true);
})();

;
/* Source: stock-fixes-v44.js */
(function(){
 'use strict';
 function disclosure(cls,label){var d=document.createElement('details');d.className=cls;var s=document.createElement('summary');s.textContent=label;d.appendChild(s);return d;}
 var trend=document.getElementById('us-trend');
 if(trend){var host=trend.parentElement,d=disclosure('stock-trend-details','최근 흐름 그래프 · 세부보기');host.before(d);d.appendChild(host);var media=matchMedia('(max-width:700px)');function sync(){d.open=!media.matches;}sync();media.addEventListener('change',sync);}
 document.querySelectorAll('#unicorn .uc-grid').forEach(function(c){var d=disclosure('stock-company-details','투자자·관련 뉴스 보기');['us','kr','news'].forEach(function(key){var e=c.querySelector('.uc-'+key);if(e)d.appendChild(e);});if(d.children.length>1)c.appendChild(d);});
 function buttons(){document.querySelectorAll('#my-wl .wl-actions .ts-link:not([data-stock-label])').forEach(function(a){a.dataset.stockLabel='1';a.textContent='X 검색';a.setAttribute('aria-label','X에서 관련 게시물 검색');});document.querySelectorAll('#my-wl .my-del:not([data-stock-label])').forEach(function(b){b.dataset.stockLabel='1';b.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 10v7m4-7v7"/></svg><span>삭제</span>';});}
 buttons();var watch=document.getElementById('my-wl');if(watch)new MutationObserver(buttons).observe(watch,{childList:true,subtree:true});
})();

;
/* Source: stock-tools-v47.js */
(function(){
 'use strict';
 var personal=document.querySelector('.stock-personal-details'),brief=document.getElementById('pro-brief');if(!personal||!brief)return;
 var hub=document.createElement('section');hub.className='stock-tools-hub';hub.setAttribute('aria-labelledby','stock-tools-title');
 hub.innerHTML='<div class="stock-tools-heading"><h2 id="stock-tools-title">내 투자 도구</h2><span>저장 정보는 이 브라우저에서 관리</span></div><nav class="stock-tools-links" aria-label="내 투자 도구 바로가기"><button type="button" data-tool="my-wl">관심종목</button><button type="button" data-tool="mk-acct">내 계좌</button><button type="button" data-tool="mk-cmp">종목 비교</button></nav>';
 var toc=document.getElementById('pro-toc');(toc||brief).after(hub);hub.appendChild(personal);
 function syncDisclosure(){personal.querySelector('summary').textContent=personal.open?'투자 도구 접기':'투자 도구 열기';}
 syncDisclosure();personal.addEventListener('toggle',function(){syncDisclosure();if(personal.open&&!hub.querySelector('[aria-current]')){hub.querySelector('[data-tool="my-wl"]').click();}});
 ['my-wl','mk-acct','mk-cmp','mk-eve'].forEach(function(id){var e=document.getElementById(id);if(e)personal.appendChild(e);});
 var icons={
  'my-wl':['내 관심종목','<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9z"/>'],
  'mk-acct':['내 계좌 · 손익·비중','<path d="M4 6h15v14H4zM4 6V4h13v2m-3 6h7v5h-7z"/>'],
  'mk-cmp':['종목 비교','<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>']
 };
 Object.keys(icons).forEach(function(id){var h=document.querySelector('#'+id+' h3>span:first-child');if(!h)return;h.textContent=icons[id][0];var svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('class','stock-tool-icon');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');svg.innerHTML=icons[id][1];h.prepend(svg);});
 var pending=null;
 hub.querySelector('.stock-tools-links').addEventListener('click',function(e){var b=e.target.closest('button[data-tool]');if(!b)return;var target=document.getElementById(b.dataset.tool);if(!target)return;
  personal.open=true; ['my-wl','mk-acct','mk-cmp','mk-eve'].forEach(function(id){var panel=document.getElementById(id);if(panel)panel.hidden=id!==b.dataset.tool;});
  if(target.classList.contains('m-fold')&&!target.classList.contains('m-open')){var fold=target.querySelector('.m-fold-btn');if(fold)fold.click();}
  hub.querySelectorAll('[data-tool]').forEach(function(x){var on=x===b;x.classList.toggle('on',on);if(on)x.setAttribute('aria-current','true');else x.removeAttribute('aria-current');});
  if(pending)clearTimeout(pending);hub.querySelectorAll('.stock-tool-selected').forEach(function(x){x.classList.remove('stock-tool-selected');});target.classList.add('stock-tool-selected');pending=setTimeout(function(){target.classList.remove('stock-tool-selected');},1800);
  target.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
 });
 function fields(selector,names){var form=document.querySelector(selector);if(!form)return;var fields=form.querySelectorAll('input:not([type=hidden])');fields.forEach(function(input,i){if(!names[i])return;var label=document.createElement('label');label.className='stock-tool-field';var span=document.createElement('span');span.textContent=names[i];input.before(label);label.appendChild(span);label.appendChild(input);});}
 var note=document.querySelector('#mk-acct>p.mut');if(note){var extra=document.createElement('details');extra.className='stock-tools-note';var title=document.createElement('summary');title.textContent='계산 기준·데이터 안내';extra.appendChild(title);note.before(extra);extra.appendChild(note);}
 fields('#my-wl .my-add',['종목 티커']);fields('#mk-acct .ac-add',['종목 티커','보유 수량','평균단가 ($)']);fields('#mk-cmp .cm-f',['비교 종목 1','비교 종목 2','비교 종목 3']);
 if(toc){
  var links=Array.from(toc.querySelectorAll('a'));
  var groups=[['시장지표',['공탐','섹터','내부지표','지수비교']],['종목분석',['김군 관심종목','시총 TOP10','레버리지','소셜','유니콘','이벤트','편입·편출']]];
  groups.forEach(function(group){var d=document.createElement('details');d.className='stock-nav-group';var summary=document.createElement('summary');summary.textContent=group[0];d.appendChild(summary);var list=document.createElement('div');d.appendChild(list);links.filter(function(a){return group[1].indexOf(a.textContent.trim())>=0;}).forEach(function(a){list.appendChild(a);});toc.appendChild(d);});
  var investment=document.createElement('button');investment.type='button';investment.className='stock-nav-invest';investment.textContent='내 투자';investment.addEventListener('click',function(){hub.querySelector('[data-tool="my-wl"]').click();});toc.appendChild(investment);
  var calendar=links.find(function(a){return a.textContent.trim()==='일정';});if(calendar)toc.appendChild(calendar);
  toc.addEventListener('click',function(e){if(e.target.closest('.stock-nav-group a'))e.target.closest('.stock-nav-group').open=false;});
 }
})();

;
/* Source: stock-input-v47.js */
(function(){
 'use strict';
 var selector='#my-wl .my-add input,#ac-t,#mk-cmp .cm-f input';
 function normalize(input){
  if(!input.matches(selector)||input.dataset.composing==='1')return;
  var value=input.value,start=input.selectionStart,end=input.selectionEnd,next=value.replace(/[a-z]/g,function(c){return c.toUpperCase();});
  if(value!==next){input.value=next;if(start!==null)input.setSelectionRange(start,end);}
  input.autocapitalize='characters';input.spellcheck=false;input.setAttribute('autocorrect','off');
 }
 document.addEventListener('input',function(e){if(e.target instanceof HTMLInputElement)normalize(e.target);},true);
 document.addEventListener('compositionstart',function(e){if(e.target.matches(selector))e.target.dataset.composing='1';},true);
 document.addEventListener('compositionend',function(e){if(e.target.matches(selector)){delete e.target.dataset.composing;normalize(e.target);}},true);
 document.addEventListener('focusin',function(e){if(e.target instanceof HTMLInputElement)normalize(e.target);});
 document.querySelectorAll(selector).forEach(normalize);
 var sub=document.getElementById('us-sub-note');if(sub){var caption=document.createElement('p');caption.className='stock-score-caption';caption.textContent='막대와 점수는 CNN 환산점수(0~100)입니다. 수익률·풋콜비율 등 원자료의 단위와 다릅니다.';sub.before(caption);}
 var account=document.getElementById('mk-acct');if(account){var privacy=document.createElement('p');privacy.className='stock-privacy';privacy.textContent='공용 기기에서는 계좌 정보를 저장하지 마세요. 이 사이트의 다른 페이지에서도 브라우저 저장 정보에 접근할 수 있습니다. ';var clear=document.createElement('button');clear.type='button';clear.textContent='저장된 계좌 정보 삭제';var armed=false,timer;clear.addEventListener('click',function(){if(!armed){armed=true;clear.textContent='다시 누르면 계좌 전체 삭제';timer=setTimeout(function(){armed=false;clear.textContent='저장된 계좌 정보 삭제';},5000);return;}clearTimeout(timer);localStorage.removeItem('mk_hold');sessionStorage.removeItem('mk_hold');localStorage.removeItem('stock_account_persist');localStorage.removeItem('mk_levcap');location.reload();});privacy.appendChild(clear);account.appendChild(privacy);}

})();

;
/* Source: stock-live-v58.js */
(function(){
 'use strict';
 var status=document.querySelector('.stock-status'),source=document.getElementById('pro-status');
 if(status&&source){var badges=document.createElement('div');badges.className='stock-live-badges';status.prepend(badges);function sync(){badges.replaceChildren();['ps-mk','ps-net'].forEach(function(id){var e=document.getElementById(id);if(!e)return;var badge=document.createElement('span');badge.className=e.className;badge.textContent=e.textContent;badge.title=e.title;badges.appendChild(badge);});}sync();new MutationObserver(sync).observe(source,{subtree:true,childList:true,characterData:true,attributes:true});}
 var ticker=document.querySelector('.stock-ticker-track');if(ticker){var original=document.createElement('div');original.className='stock-ticker-sequence';while(ticker.firstChild)original.appendChild(ticker.firstChild);ticker.appendChild(original);var clone;function copy(){if(clone)clone.remove();clone=original.cloneNode(true);clone.setAttribute('aria-hidden','true');clone.querySelectorAll('[id]').forEach(function(e){e.removeAttribute('id');});ticker.appendChild(clone);}copy();var timer;new MutationObserver(function(){clearTimeout(timer);timer=setTimeout(copy,100);}).observe(original,{subtree:true,childList:true,characterData:true,attributes:true});}
 function wirePulse(){var p=document.querySelector('.pulse');if(!p||p.dataset.hoverWired)return;p.dataset.hoverWired='1';function open(){if(!matchMedia('(hover:hover) and (pointer:fine)').matches)return;p.classList.add('m-open');var b=p.querySelector('.m-fold-btn');if(b){b.setAttribute('aria-expanded','true');b.innerHTML='<em>접기</em> ➖';}}p.addEventListener('pointerenter',open);p.addEventListener('focusin',open);}
 wirePulse();var attempts=0,interval=setInterval(function(){wirePulse();if(++attempts>20)clearInterval(interval);},500);
})();

;
/* Source: stock-disclosure-v60.js */
(function(){
 'use strict';
 var selector='.fold-btn,.m-fold-btn,.fold-all button,.ev-tg,.cal-more-btn,.ev-more-btn,.lead-pc,.my-more';
 function sync(){document.querySelectorAll(selector).forEach(function(b){b.classList.add('stock-disclosure-button');var html=b.innerHTML.replace(/➕/g,'＋').replace(/➖/g,'−').replace(/▴|▲/g,'−').replace(/▾|▼/g,'＋');if(b.innerHTML!==html)b.innerHTML=html;if(b.classList.contains('m-fold-btn')){var card=b.closest('.m-fold'),state=String(!!(card&&card.classList.contains('m-open')));if(b.getAttribute('aria-expanded')!==state)b.setAttribute('aria-expanded',state);}});}
 sync();var timer;new MutationObserver(function(){clearTimeout(timer);timer=setTimeout(sync,40);}).observe(document.body,{childList:true,subtree:true});
})();

;
/* Source: stock-final-v66.js */
/* Final US-only layout and interaction polish. Source retained in backup. */
(function(){
 'use strict';
 var state=document.querySelector('.stock-status'),brief=document.getElementById('pro-brief'),market=document.querySelector('.stock-market-details'),toc=document.getElementById('pro-toc');
 if(state&&brief){state.after(brief);if(market)brief.after(market);if(toc)(market||brief).after(toc);}
 var all=document.querySelector('.fold-all'),heading=brief&&brief.querySelector('.pb-hd');if(all&&heading)heading.appendChild(all);
 var next=document.getElementById('us-next-event');if(next){var title=next.querySelector('h4,.nev-head,.ev-hd');if(title)title.title='영향이 큰 주요 일정입니다. 시장요약은 시간상 가장 가까운 일정을 표시합니다.';next.setAttribute('aria-label','시장 영향이 큰 주요 일정');}
 var card=document.getElementById('us-card'),note=document.createElement('p');note.className='stock-source-note';note.hidden=true;note.setAttribute('role','status');if(card)card.appendChild(note);
 function sourceNote(){var cached=window.MK_FG_PHASE==='snapshot';note.hidden=!cached;if(cached)note.textContent='공포탐욕: 2026-09-10 저장자료 · 최신 조회 실패';}
 sourceNote();setInterval(sourceNote,1500);
 // Pause control is outside the moving track and works with mouse, touch and keyboard.
 if(market){var toggle=document.createElement('button');toggle.type='button';toggle.className='stock-ticker-toggle';toggle.textContent='시세 흐름 일시정지';toggle.setAttribute('aria-pressed','false');toggle.addEventListener('click',function(){var paused=market.classList.toggle('stock-ticker-paused');toggle.setAttribute('aria-pressed',String(paused));toggle.textContent=paused?'시세 흐름 재생':'시세 흐름 일시정지';});market.appendChild(toggle);}
 // Fixed core indices remain readable independently of the moving ticker.
 if(market){var core=document.createElement('div');core.className='stock-core-indices';core.setAttribute('aria-label','주요 지수 고정 요약');var specs=[['S&P500','pt-0'],['나스닥','pt-1'],['VIX','pt-4'],['원/달러','pt-10']];specs.forEach(function(x){var item=document.createElement('div');item.dataset.source=x[1];item.innerHTML='<small>'+x[0]+'</small><b>조회 중</b>';core.appendChild(item);});market.insertBefore(core,market.children[1]||null);function sync(){core.querySelectorAll('[data-source]').forEach(function(item){var src=document.getElementById(item.dataset.source),value=src&&src.querySelector('b'),pct=src&&src.querySelector('em');var text=value?value.textContent+' '+(pct?pct.textContent:''):(src?src.textContent.replace(/^(S&P 500|나스닥|VIX|USD\/KRW)\s*/,''):'조회 중');var target=item.querySelector('b');if(target.textContent!==text)target.textContent=text;});}sync();var source=document.getElementById('pro-tick');if(source)new MutationObserver(sync).observe(source,{subtree:true,childList:true,characterData:true});}
 // Hide floating controls when they would cover an interactive element.
 var queued=false;function avoidOverlap(){queued=false;var controls=[document.getElementById('stock-gift'),document.getElementById('pro-top')].filter(Boolean),targets=[].slice.call(document.querySelectorAll('main button,main a,main input,main summary,#mk-tabbar'));
  controls.forEach(function(control){var r=control.getBoundingClientRect(),collision=targets.some(function(el){var q=el.getBoundingClientRect();return q.width>0&&q.height>0&&q.left<r.right&&q.right>r.left&&q.top<r.bottom&&q.bottom>r.top;});control.classList.toggle('stock-float-obstructed',collision);});
 }
 function queueOverlap(){if(!queued){queued=true;requestAnimationFrame(avoidOverlap);}}
 window.addEventListener('scroll',queueOverlap,{passive:true});window.addEventListener('resize',queueOverlap);queueOverlap();
 // Keep the matrix's expanded state when the source renderer refreshes every 5 seconds.
 var host=document.getElementById('fwd-body');if(host){var fullOpen=matchMedia('(min-width:701px)').matches;function arrange(){var table=host.querySelector('.fwd-mx');if(!table||table.closest('.stock-full-periods'))return;var d=document.createElement('details');d.className='stock-full-periods';d.open=fullOpen;var summary=document.createElement('summary');summary.textContent='전체 기간 비교표';table.before(d);d.append(summary,table);d.addEventListener('toggle',function(){if(d.isConnected)fullOpen=d.open;});}arrange();new MutationObserver(arrange).observe(host,{childList:true});}
})();

/* Shared mobile action stack; measure navigation including safe-area padding. */
(function(){
 'use strict';
 var stack=document.createElement('div');stack.className='stock-floating-actions';
 var gift=document.getElementById('stock-gift'),top=document.getElementById('pro-top');
 if(!gift&&!top)return;
 document.body.appendChild(stack);if(gift)stack.appendChild(gift);if(top)stack.appendChild(top);
 function measure(){var nav=document.getElementById('mk-tabbar');var height=nav&&getComputedStyle(nav).display!=='none'?nav.getBoundingClientRect().height:0;document.documentElement.style.setProperty('--stock-floating-nav-height',height+'px');}
 var nav=document.getElementById('mk-tabbar');if(nav&&window.ResizeObserver)new ResizeObserver(measure).observe(nav);
 window.addEventListener('resize',measure);if(window.visualViewport)window.visualViewport.addEventListener('resize',measure);measure();
})();

;
/* Source: stock-final-v68.js */
(function(){
 'use strict';
 var status=document.getElementById('pro-status'),net=document.getElementById('ps-net');
 if(status&&net){var badge=document.createElement('span');badge.id='ps-telegram';badge.className='ps-telegram';badge.setAttribute('role','status');badge.textContent='텔레그램 확인 중';net.after(badge);
  var labels={sent:['sent','텔레그램 전송 완료'],failed:['failed','텔레그램 전송 실패'],waiting:['waiting','텔레그램 17:30 대기'],sending:['waiting','텔레그램 전송 확인 중'],unconfirmed:['unknown','텔레그램 전송 미확인'],unconfigured:['unknown','텔레그램 설정 미완료'],unavailable:['unknown','텔레그램 상태 조회 불가']};
  async function update(){try{var origin=typeof PROXY_BASE!=='undefined'?PROXY_BASE.replace(/\?url=$/,''):'';if(!origin)throw Error();var r=await fetch(origin+'telegram-status',{cache:'no-store',signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error();var data=await r.json(),label=labels[data.state];if(!label)throw Error();badge.dataset.state=label[0];badge.textContent=label[1];badge.title='오늘 17:30 KST 자동 전송 · '+(data.sentAt?'전송 확인 '+new Date(data.sentAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}):'Worker 기록 기준 · 완료는 Telegram API 수락을 의미하며 읽음 확인은 아닙니다.');}catch{badge.dataset.state='unknown';badge.textContent='텔레그램 상태 미확인';badge.title='상태 조회가 불가능합니다. v68 Worker 배포 및 설정을 확인해 주세요.';}}
  update();setInterval(function(){if(!document.hidden)update();},60000);document.addEventListener('visibilitychange',function(){if(!document.hidden)update();});
 }
 var heading=document.getElementById('guide-h');if(heading){var wrap=heading.parentElement,panel=document.createElement('div');panel.id='stock-guide-content';[].slice.call(wrap.children).forEach(function(el){if(el!==heading)panel.appendChild(el);});wrap.appendChild(panel);panel.hidden=true;var button=document.createElement('button');button.type='button';button.className='stock-help-button';button.textContent='Help · 용어 보기';button.setAttribute('aria-controls',panel.id);button.setAttribute('aria-expanded','false');heading.appendChild(button);button.addEventListener('click',function(){var open=panel.hidden;panel.hidden=!open;button.setAttribute('aria-expanded',String(open));button.textContent=open?'Help · 닫기':'Help · 용어 보기';});}
})();

;
/* Source: stock-final-v70.js */
(function(){
 'use strict';
 var status=document.querySelector('.stock-status'),retry=status&&status.querySelector('button'),all=document.querySelector('.fold-all');
 if(status&&retry&&all){var actions=document.createElement('div');actions.className='stock-status-actions';actions.setAttribute('role','group');actions.setAttribute('aria-label','화면 관리');status.appendChild(actions);actions.append(retry,all);}
})();

;
/* Source: stock-final-v72.js */
(function(){
 'use strict';
 var market=document.querySelector('.stock-market-details'),core=document.querySelector('.stock-core-indices');if(core)core.remove();
 var tools=document.querySelector('.stock-tools-hub'),guide=document.getElementById('guide');
 var section=document.createElement('section');section.className='stock-bottom-tools';var wrap=document.createElement('div');wrap.className='wrap';section.appendChild(wrap);
 if(market){market.open=false;var title=market.querySelector('summary');if(title)title.textContent='시세 보기 · 주요 지수·환율';wrap.appendChild(market);}
 if(tools){var disclosure=document.createElement('details');disclosure.className='stock-bottom-personal';var title=document.createElement('summary');title.textContent='내 투자 도구';disclosure.append(title,tools);wrap.appendChild(disclosure);}
 if(guide)guide.before(section);else(document.querySelector('main')||document.body).appendChild(section);
 // The layout script's queued desktop initializer must not reopen bottom disclosures.
 setTimeout(function(){if(market)market.open=false;},0);
 var cnn=document.getElementById('pro-cnn'),h=cnn&&cnn.querySelector('h3');if(h){var label=document.createElement('span');label.className='stock-cnn-title';[].slice.call(h.childNodes).forEach(function(n){if(n.nodeType===3)label.appendChild(n);});h.prepend(label);}
 document.querySelectorAll('.stock-status-actions button').forEach(function(b){var text=b.textContent;var icon=b.dataset.o==='0'?'⊟':b.dataset.o==='1'?'⊞':'↻';b.dataset.mobileIcon=icon;b.setAttribute('aria-label',text);b.title=text;var label=document.createElement('span');label.className='stock-action-label';label.textContent=text;b.replaceChildren(label);});
 function compactStatus(){var mk=document.getElementById('ps-mk'),net=document.getElementById('ps-net');if(mk)mk.dataset.short=/휴장/.test(mk.textContent)?'휴장':/정규장/.test(mk.textContent)?'장중':/프리/.test(mk.textContent)?'장전':/애프터/.test(mk.textContent)?'장후':'마감';if(net)net.dataset.short=/정상/.test(net.textContent)?'정상':/누락|일부/.test(net.textContent)?'일부 누락':/오류|실패/.test(net.textContent)?'오류':'확인 중';}
 compactStatus();['ps-mk','ps-net'].forEach(function(id){var el=document.getElementById(id);if(el)new MutationObserver(compactStatus).observe(el,{childList:true,characterData:true,subtree:true});});
})();

;
