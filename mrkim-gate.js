/* Mr.Kim Signal — 페이지 이동 암호 잠금
   · 각 페이지에 들어올 때마다 이용 암호를 묻는다(같은 페이지 새로고침은 재입력 없음, 다른 페이지로 이동하면 다시 입력).
   · "관리자 암호"를 입력하면 이 기기에서는 잠금 기능 자체가 꺼진다(localStorage). 다시 켜려면 주소 뒤에 ?gate=on 을 붙여 접속.
   · 암호는 평문이 아니라 SHA-256 해시로만 저장한다. gate-setup.html에서 해시를 만들어 아래 두 줄에 붙여넣는다.
   · 두 값이 비어 있으면 잠금은 동작하지 않는다.
   ※ 정적 웹페이지의 브라우저 측 잠금이라 '가벼운 접근 제한' 용도입니다(소스 보기·직접 파일 접근까지 막는 서버 보안은 아님). */
(function(){
  var USER_HASH  = 'b3e9a9911d67f0454cb582a33bd15d0108196d7e833d65277c4a5ecdc5b131bf';   // ← gate-setup.html 에서 만든 "이용 암호" 해시
  var ADMIN_HASH = 'a0cd5da6a6e2225ca6a7d8ece1f7ebc1c4c8ed28159dfe85a0110b8b14140f11';   // ← gate-setup.html 에서 만든 "관리자 암호" 해시
  var SALT='mk|';
  try{ if(/[?&]gate=on\b/.test(location.search)) localStorage.removeItem('mk_gate_off'); }catch(e){}
  if(!USER_HASH) return;
  try{ if(localStorage.getItem('mk_gate_off')==='1') return; }catch(e){}
  var page=(location.pathname.split('/').pop()||'index.html');
  try{ if(sessionStorage.getItem('mk_ok')===page) return; }catch(e){}

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
  var hide=document.createElement('style');
  hide.id='mk-gate-hide';
  hide.textContent='html{overflow:hidden!important}body{visibility:hidden!important}';
  document.documentElement.appendChild(hide);
  function unlock(){
    var o=document.getElementById('mk-gate'); if(o) o.remove();
    var h=document.getElementById('mk-gate-hide'); if(h) h.remove();
  }
  function build(){
    var o=document.createElement('div'); o.id='mk-gate';
    o.innerHTML='<style>#mk-gate{position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;padding:20px;background:#f4f6f5;color:#1b1f1d;font-family:-apple-system,BlinkMacSystemFont,"Pretendard","Noto Sans KR",sans-serif}'+
      '@media(prefers-color-scheme:dark){#mk-gate{background:#0f1311;color:#eef2ef}#mk-gate .bx{background:#171d1a;border-color:#2a332e}#mk-gate input{background:#0f1311;color:#eef2ef;border-color:#2f3a34}}'+
      '#mk-gate .bx{width:100%;max-width:340px;background:#fff;border:1px solid #dfe5e1;border-radius:16px;padding:26px 22px;text-align:center;box-shadow:0 10px 30px rgba(0,0,0,.12)}'+
      '#mk-gate h1{font-size:18px;margin:0 0 4px;font-weight:900}#mk-gate p{font-size:12.5px;opacity:.7;margin:0 0 16px}'+
      '#mk-gate input{width:100%;box-sizing:border-box;padding:12px;border:1.5px solid #cfd8d3;border-radius:10px;font-size:16px;text-align:center;margin-bottom:10px}'+
      '#mk-gate button{width:100%;padding:12px;border:0;border-radius:10px;background:#00754a;color:#fff;font-size:15px;font-weight:800;cursor:pointer}'+
      '#mk-gate .er{color:#d93025;font-size:12.5px;min-height:18px;margin-top:8px}</style>'+
      '<form class="bx" autocomplete="off"><h1>🔒 Mr.Kim Signal</h1><p>이 페이지에 들어가려면 암호를 입력해 주세요</p>'+
      '<input type="password" id="mk-gate-pw" placeholder="암호" autocomplete="current-password" autofocus>'+
      '<button type="submit">확인</button><div class="er" id="mk-gate-er"></div></form>';
    document.documentElement.appendChild(o);
    var fails=0,busy=false, f=o.querySelector('form'), inp=o.querySelector('#mk-gate-pw'), er=o.querySelector('#mk-gate-er');
    setTimeout(function(){try{inp.focus();}catch(e){}},50);
    f.addEventListener('submit',function(ev){
      ev.preventDefault(); if(busy) return;
      var v=inp.value; if(!v) return;
      busy=true;
      sha256(SALT+v).then(function(h){
        if(ADMIN_HASH&&h===ADMIN_HASH){ try{localStorage.setItem('mk_gate_off','1');}catch(e){} unlock(); return; }
        if(h===USER_HASH){ try{sessionStorage.setItem('mk_ok',page);}catch(e){} unlock(); return; }
        fails++; inp.value=''; er.textContent='암호가 맞지 않습니다'+(fails>=5?' · 잠시 후 다시 시도해 주세요':'');
        setTimeout(function(){busy=false;},fails>=5?5000:300); return;
      }).then(function(){ if(document.getElementById('mk-gate')) return; busy=false; });
    });
  }
  if(document.body) build(); else document.addEventListener('DOMContentLoaded',build);
  if(!document.body) document.addEventListener('DOMContentLoaded',function(){});
})();
