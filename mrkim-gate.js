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
    b.querySelector('button').onclick=function(){ try{localStorage.removeItem('mk_gate_off');}catch(e){} b.remove(); };
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
  var detailOk=false; try{ detailOk=sessionStorage.getItem('mk_detail')===page; }catch(e){}
  var DETAIL_SEL='.wl-info,.wl-spark,[onclick*="toggle"],[onclick*="Detail"],[onclick*="detail"]';
  function isDetail(el){
    if(el.closest(DETAIL_SEL)) return true;
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
        detailOk=true; try{sessionStorage.setItem('mk_detail',page);}catch(x){}
        setTimeout(function(){ try{ t.click(); }catch(x){} },30);
      }});
    }
  },true);
})();
