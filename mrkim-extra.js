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
  var page = (location.pathname.split('/').pop() || 'index').replace(/\.html$/, '').toLowerCase().replace(/[^a-z0-9-]/g, '') || 'index';

  /* ───────── ⑥ 이용 통계(개인정보 없음 · 횟수만) ───────── */
  var EV = { q: [], sent: 0 };
  var statsOn = !(navigator.doNotTrack === '1' || window.doNotTrack === '1' || store.get('mk_noev') === '1');
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
    if (b) { b.textContent = t === 'dark' ? '☾' : t === 'light' ? '☀' : '◐'; var nm = t === 'dark' ? '다크' : t === 'light' ? '라이트' : '자동(기기 설정)'; b.setAttribute('aria-label', '화면 테마: ' + nm + ' — 누르면 변경'); b.title = '화면 테마: ' + nm; }
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

  /* ───────── 상단 도구 버튼(절약·원/달러·색·테마·새로고침)을 헤더 '포인트 선물하기' 왼쪽(PC는 업데이트 일자 왼쪽)으로 ───────── */
  (function () {
    var IDS = ['ps-save', 'ps-krw', 'ps-cv', 'ps-theme', 'ps-rf'];
    function mv() {
      var anchor = $('#stamp-top') || $('#naver-gift-link'); if (!anchor || !anchor.parentNode) return;
      var host = $('#hd-tools');
      if (!host) { host = document.createElement('div'); host.id = 'hd-tools'; host.setAttribute('role', 'group'); host.setAttribute('aria-label', '화면 설정'); anchor.parentNode.insertBefore(host, anchor); }
      var have = IDS.map(function (i) { return document.getElementById(i); }).filter(Boolean);
      var cur = [].map.call(host.children, function (c) { return c.id; }).join(',');
      if (cur === have.map(function (b) { return b.id; }).join(',')) return;
      have.forEach(function (b) { host.appendChild(b); });
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
          if (!cur || lightBg(el)) return;
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
})();
