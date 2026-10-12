/* 로딩 표시 · 첫 화면 조립 보호 (모든 페이지 공통)
   1) 미국·한국주식·가상화폐: 첫 화면을 조립하는 동안(제목·상태 카드·요약 카드가 여러 스크립트에 의해 차례로 바뀌는 구간)
      본문을 투명하게 두고 로딩 표시(회전 링 + 문구)를 보여 준 뒤, ui-fixes-v106.js 가 window.__mkBootDone 을 부르면 한 번에 부드럽게 보여 준다.
      → 화면이 흔들리거나 버튼이 상태 카드 밖에 있다가 들어가는 모습이 보이지 않는다. 최대 6초 후에는 무조건 표시.
   2) 모든 페이지: "다시 불러오기/새로고침" 버튼을 누르면 즉시 로딩 표시(회전 링 + 본문 흐림)로 반응한다. */
(function () {
  var d = document.documentElement, page = (location.pathname.split('/').pop() || 'index').replace(/\.html$/, '');
  var BOOT = /^(stock|kr-stock|crypto)$/.test(page), reduce = false;
  try { reduce = window.matchMedia('(prefers-reduced-motion:reduce)').matches; } catch (e) {}
  var css = 'html.mk-boot,html.mk-boot body{background:#f4f6f7}html.mk-boot body{opacity:0}html body{transition:opacity .22s ease}' +
    'html.mk-reloading body{opacity:.45;pointer-events:none}' +
    'html.mk-boot::before,html.mk-reloading::before{content:"";position:fixed;left:50%;top:42%;width:38px;height:38px;margin:-19px 0 0 -19px;border:3px solid #cfe5da;border-top-color:#16795a;border-radius:50%;z-index:2147483000;' + (reduce ? '' : 'animation:mkspin .8s linear infinite;') + '}' +
    'html.mk-boot::after,html.mk-reloading::after{content:"시세를 불러오는 중…";position:fixed;left:0;right:0;top:calc(42% + 34px);text-align:center;font:600 13px/1.4 system-ui,-apple-system,"Malgun Gothic",sans-serif;color:#5b6772;z-index:2147483000}' +
    '@keyframes mkspin{to{transform:rotate(360deg)}}' +
    '@media(prefers-reduced-motion:reduce){html body{transition:none}}';
  var st = document.createElement('style'); st.id = 'mk-boot-css'; st.textContent = css; (document.head || d).appendChild(st);

  var done = false;
  var f = function () { if (done) return; done = true; d.classList.remove('mk-boot'); };
  window.__mkBootDone = f;
  if (BOOT) { d.classList.add('mk-boot'); setTimeout(f, 6000); } else done = true;

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
