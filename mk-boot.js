/* 로딩 표시 · 첫 화면 조립 보호 (모든 페이지 공통)
   1) 미국·한국주식·가상화폐: 첫 화면을 조립하는 동안(제목·상태 카드·요약 카드가 여러 스크립트에 의해 차례로 바뀌는 구간)
      본문을 투명하게 두고 로딩 표시(회전 링 + 문구)를 보여 준 뒤, ui-fixes-v106.js 가 window.__mkBootDone 을 부르면 한 번에 부드럽게 보여 준다.
      → 화면이 흔들리거나 버튼이 상태 카드 밖에 있다가 들어가는 모습이 보이지 않는다. 최대 6초 후에는 무조건 표시.
   2) 모든 페이지: "다시 불러오기/새로고침" 버튼을 누르면 즉시 로딩 표시(회전 링 + 본문 흐림)로 반응한다. */
(function () {
  var d = document.documentElement, page = (location.pathname.split('/').pop() || 'index').replace(/\.html$/, '');
  var BOOT = /^(kr-stock|crypto)$/.test(page), reduce = false;
  try { reduce = window.matchMedia('(prefers-reduced-motion:reduce)').matches; } catch (e) {}
  var css = 'html.mk-boot,html.mk-boot body{background:#f4f6f7}html.mk-boot body{opacity:0}html body{transition:opacity .22s ease}' +
    'html.mk-reloading body{opacity:.45;pointer-events:none}' +
    'html.mk-boot::before,html.mk-reloading::before{content:"";position:fixed;left:50%;top:42%;width:38px;height:38px;margin:-19px 0 0 -19px;border:3px solid #cfe5da;border-top-color:#16795a;border-radius:50%;z-index:2147483000;' + (reduce ? '' : 'animation:mkspin .8s linear infinite;') + '}' +
    'html.mk-boot::after,html.mk-reloading::after{content:"시세를 불러오는 중…";position:fixed;left:0;right:0;top:calc(42% + 34px);text-align:center;font:600 13px/1.4 system-ui,-apple-system,"Malgun Gothic",sans-serif;color:#5b6772;z-index:2147483000}' +
    '@keyframes mkspin{to{transform:rotate(360deg)}}' +
    '@media(prefers-reduced-motion:reduce){html body{transition:none}}';
  var st = document.createElement('style'); st.id = 'mk-boot-css'; st.textContent = css; (document.head || d).appendChild(st);

  var done = false;
  var f = function () { if (done) return; done = true; d.classList.remove('mk-boot'); try { if (window.__mkSkelEnd) window.__mkSkelEnd(); } catch (e) {} };
  window.__mkBootDone = f;
  if (BOOT) { d.classList.add('mk-boot'); setTimeout(f, 6000); } else done = true;


  /* ── 미국주식: 스켈레톤 먼저 · 이전 값 즉시 표시 ──
     상태 카드·요약 카드는 스크립트가 만들기 전까지 아예 없어서 빈 화면이 길었다. stock.html 의 #mk-skel(정적 골격)을 첫 화면에 바로 보여 주고,
     실제 카드가 생기면 같은 자리에서 교체한다(높이를 맞춰 화면이 밀리지 않게). 직전 방문 때 저장한 요약 값이 있으면 '이전 값' 으로 흐리게 먼저 채운다. */
  if (page === 'stock' || BOOT) {
    var SK = 'mk_skel_' + page, sk = null, skDone = false, SID = page === 'stock' ? 'mk-skel' : 'mk-skel2';
    var skCss = '#mk-skel{display:block;margin:0 0 16px}#mk-skel .sk-status{display:flex;align-items:center;gap:8px;height:86px;padding:0 14px;border:1px solid #e1e4e8;border-radius:14px;background:#fff;margin-bottom:12px;box-sizing:border-box}' +
      '#mk-skel .sk-brief{border:1px solid #cfe5da;border-radius:16px;background:#fff;padding:14px;height:430px;overflow:hidden;box-sizing:border-box}' +
      '#mk-skel .sk-hd{display:flex;align-items:center;gap:10px;height:48px;border-radius:12px;background:#0f7a55;color:#fff;padding:0 16px;font-weight:800;font-size:15px;margin-bottom:12px}' +
      '#mk-skel .sk-hd small{margin-left:auto;font-weight:600;font-size:11.5px;opacity:.9}' +
      '#mk-skel .sk-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}' +
      '#mk-skel .sk-grid>div{height:96px;border:1px solid #cfe5da;border-radius:14px;padding:12px 14px;background:#f8faf9;overflow:hidden}' +
      '#mk-skel .sk-grid small{display:block;font-size:12px;font-weight:700;color:#4b5864;margin-bottom:8px}#mk-skel .sk-grid b{display:block;font-size:18px;font-weight:800;color:#1b2430;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#mk-skel .sk-grid em{display:block;margin-top:6px;font-style:normal;font-size:11.5px;color:#6b7782;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      '#mk-skel .sk-grid>.sk-lev{grid-column:1/-1;order:9;height:170px;border:1px solid #cfe5da;border-radius:14px;background:#f8faf9}' +
      '#mk-skel .sk-b{display:block;border-radius:6px;background:linear-gradient(90deg,#e9eeeb 25%,#f4f7f5 50%,#e9eeeb 75%);background-size:200% 100%}' +
      '#mk-skel .sk-chip{width:92px;height:26px;border-radius:999px}#mk-skel .sk-btn{width:44px;height:44px;border-radius:12px;margin-left:auto}' +
      '#mk-skel .sk-grid .sk-b{height:24px;width:70%;margin-top:4px}#mk-skel .sk-stale{opacity:.62}' +
      (reduce ? '' : '#mk-skel .sk-b{animation:mksk 1.3s ease-in-out infinite}@keyframes mksk{0%{background-position:200% 0}100%{background-position:-200% 0}}html.mk-skel-done #pro-brief,html.mk-skel-done .stock-status{animation:mkin .22s ease both}@keyframes mkin{from{opacity:0}to{opacity:1}}') +
      '@media(max-width:700px){#mk-skel .sk-status{height:92px}#mk-skel .sk-brief{height:545px}#mk-skel .sk-grid{grid-template-columns:repeat(2,minmax(0,1fr))}#mk-skel .sk-grid>.sk-lev{order:3;height:190px}#mk-skel .sk-grid>div:nth-child(3){order:4}#mk-skel .sk-grid>div:nth-child(4){order:5}}' +
      '@media(max-width:700px){html body :is(#ps-mk,#ps-net)[data-short],html body .stock-live-badges :is(.ps-mk,.ps-net)[data-short]{font-size:0!important}html body :is(#ps-mk,#ps-net)[data-short]::after,html body .stock-live-badges :is(.ps-mk,.ps-net)[data-short]::after{content:attr(data-short);font-size:11px;font-weight:750}}';
    if (BOOT) skCss = skCss.replace(/#mk-skel(?![\w-])/g, '#mk-skel2') +
      '#mk-skel2{font-family:Inter,"Noto Sans KR",system-ui,-apple-system,"Malgun Gothic",sans-serif;position:fixed;left:0;right:0;top:0;bottom:0;z-index:2147482000;background:#f4f6f7;overflow:hidden;margin:0;transition:opacity .22s ease}#mk-skel2.out{opacity:0}' +
      '#mk-skel2 .sk-bar{height:58px;background:#fff;border-bottom:1px solid #e1e4e8;display:flex;align-items:center}#mk-skel2 .sk-in{width:min(1232px,calc(100% - 24px));margin:0 auto}' +
      '#mk-skel2 .sk-logo{font-weight:800;font-size:21px;color:#1b2430;letter-spacing:-.02em}#mk-skel2 .sk-logo span{color:#0f7a55}' +
      '#mk-skel2 .sk-eb{margin:26px 0 6px;font-size:11.5px;font-weight:700;color:#0f7a55}#mk-skel2 .sk-h1{font-size:32px;font-weight:800;color:#1b2430;letter-spacing:-.02em;margin:0 0 4px}#mk-skel2 .sk-h1 small{display:block;font-size:13px;font-weight:500;color:#6b7782;margin-top:4px;letter-spacing:0}' +
      '#mk-skel2 .sk-wrap{margin-top:14px}' +
      '@media(max-width:700px){#mk-skel2 .sk-bar{height:54px}#mk-skel2 .sk-h1{font-size:24px}#mk-skel2 .sk-eb{margin-top:18px}}' +
      '@media(max-width:700px){#mk-skel2 .sk-grid>.sk-lev{order:9}#mk-skel2 .sk-grid>div:nth-child(3),#mk-skel2 .sk-grid>div:nth-child(4){order:0}}' +
      'html.mk-boot:not(.mk-reloading)::before,html.mk-boot:not(.mk-reloading)::after{display:none!important}';
    var st2 = document.createElement('style'); st2.id = 'mk-skel-css'; st2.textContent = skCss; (document.head || d).appendChild(st2);
    var skEnd = function () { if (skDone) return; skDone = true; d.classList.add('mk-skel-done'); var e = document.getElementById(SID); if (!e) return; if (BOOT) { e.classList.add('out'); setTimeout(function () { try { e.remove(); } catch (x) {} }, 280); } else e.remove(); };
    var skCheck = function () { if (skDone) return; if (document.getElementById('pro-brief') && document.querySelector('.stock-status,#pro-status')) skEnd(); };
    var skFill = function () {
      sk = document.getElementById(SID); if (!sk) return false;
      var o = null; try { o = JSON.parse(localStorage.getItem(SK) || 'null'); } catch (e) {}
      if (o && o.t && Date.now() - o.t < 86400000 && Array.isArray(o.tiles) && o.tiles.length >= 3) {
        var tiles = sk.querySelectorAll('.sk-grid>div');
        o.tiles.slice(0, tiles.length).forEach(function (x, i) {
          var t = tiles[i]; t.innerHTML = ''; t.className = 'sk-stale';
          var a = document.createElement('small'); a.textContent = String(x.l || '').slice(0, 30);
          var b = document.createElement('b'); b.textContent = String(x.v || '').slice(0, 24);
          var c = document.createElement('em'); c.textContent = String(x.s || '').slice(0, 40);
          t.appendChild(a); t.appendChild(b); t.appendChild(c);
        });
        var mins = Math.max(1, Math.round((Date.now() - o.t) / 60000));
        var hd = sk.querySelector('.sk-hd small'); if (hd) hd.textContent = '이전 값 · ' + (mins >= 60 ? Math.round(mins / 60) + '시간' : mins + '분') + ' 전 · 갱신 중…';
      }
      return true;
    };
    var skSave = function () {
      try {
        var br = document.getElementById('pro-brief'); if (!br || !d.classList.contains('mk-skel-done')) return;
        var tiles = Array.prototype.slice.call(br.querySelectorAll('.pb-grid>.pb-c:not(.pb-lev):not(.pb-halv)')).slice(0, 4).map(function (t) {
          var l = t.querySelector('small'), v = t.querySelector('b');
          var s = Array.prototype.slice.call(t.childNodes).filter(function (n) { return n !== l && n !== v; }).map(function (n) { return (n.textContent || '').trim(); }).filter(Boolean).join(' ').replace(/\s+/g, ' ');
          return { l: l ? l.textContent.trim() : '', v: v ? v.textContent.trim() : '', s: s };
        });
        if (tiles.length >= 3 && tiles.every(function (x) { return x.v && !/^--+$/.test(x.v); })) localStorage.setItem(SK, JSON.stringify({ t: Date.now(), tiles: tiles }));
      } catch (e) {}
    };
    var LAB = { 'kr-stock': ['한국 공포탐욕', '코스피', '원/달러 환율', '다음 주요 일정'], 'crypto': ['가상화폐 공포탐욕', '비트코인', '이더리움', '다음 주요 일정'] };
    var TTL = { 'kr-stock': ['🇰🇷 한국주식 시장 대시보드', '공포탐욕지수 · 투자자 동향 · 시가총액 · 경제일정'], 'crypto': ['가상화폐 시장 대시보드', '공포탐욕지수 · 주요 코인 · 도미넌스 · 경제일정'] };
    var mkOverlay = function () {
      if (document.getElementById(SID)) return;
      var el = document.createElement('div'); el.id = SID; el.setAttribute('aria-hidden', 'true');
      var tl = TTL[page] || ['', ''], lb = LAB[page] || ['', '', '', ''];
      el.innerHTML = '<div class="sk-bar"><div class="sk-in sk-logo">Mr.<span>Kim Signal</span></div></div><div class="sk-in"><div class="sk-eb">Mr.Kim Signal · 시장 리서치</div><h1 class="sk-h1"></h1><div class="sk-wrap"><div class="sk-status"><i class="sk-b sk-chip"></i><i class="sk-b sk-chip"></i><i class="sk-b sk-btn"></i></div><div class="sk-brief"><div class="sk-hd">오늘의 시장 요약<small>불러오는 중…</small></div><div class="sk-grid"></div></div></div></div>';
      el.querySelector('.sk-h1').appendChild(document.createTextNode(tl[0]));
      var sm = document.createElement('small'); sm.textContent = tl[1]; el.querySelector('.sk-h1').appendChild(sm);
      var g = el.querySelector('.sk-grid');
      lb.forEach(function (x) { var t = document.createElement('div'), a = document.createElement('small'), b = document.createElement('i'); a.textContent = x; b.className = 'sk-b'; t.appendChild(a); t.appendChild(b); g.appendChild(t); });
      var lv = document.createElement('div'); lv.className = 'sk-lev'; g.appendChild(lv);
      d.appendChild(el);
    };
    if (BOOT) { window.__mkSkelEnd = function () { d.classList.add('mk-skel-done'); skEnd(); }; mkOverlay(); }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', skFill); else skFill();
    if (!BOOT) { try { new MutationObserver(function () { if (!sk) skFill(); skCheck(); }).observe(d, { childList: true, subtree: true }); } catch (e) {} setTimeout(skEnd, 8000); }
    else { try { new MutationObserver(function () { if (!sk) skFill(); }).observe(d, { childList: true }); } catch (e) {} }
    setInterval(skSave, 20000); window.addEventListener('pagehide', skSave); document.addEventListener('visibilitychange', function () { if (document.hidden) skSave(); });
  }

  /* 새로고침 버튼 즉시 반응 */
  var rt;
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('button,a'); if (!b) return;
    if (!(b.id === 'ps-rf' || /다시 ?불러오기|새로고침/.test(b.textContent || '') && !b.closest('#mk-live-sw'))) return;
    d.classList.add('mk-reloading'); clearTimeout(rt); rt = setTimeout(function () { d.classList.remove('mk-reloading'); }, 1800);
  }, true);
  window.addEventListener('pageshow', function () { d.classList.remove('mk-reloading'); });

  /* 가상화폐: 새로고침·모두 접기/펼치기 버튼(.v90-actions)이 상태 카드 밖에 생기면 즉시 카드 안으로 옮긴다 */
  if (page === 'crypto') {
    var fix = function () {
      var s = document.getElementById('pro-status'), a = document.querySelector('.v90-actions');
      if (s && a && !s.contains(a)) { a.classList.add('mk-status-actions'); s.appendChild(a); }
    };
    try { new MutationObserver(fix).observe(d, { childList: true, subtree: true }); } catch (e) {}
    setTimeout(function () { try { fix(); } catch (e) {} }, 0);
  }
})();
