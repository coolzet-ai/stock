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
 var entries=[['v63','소제목 박스 높이·간격 및 제목/요약/버튼 정렬 통일'],['v61','펼침 버튼 통일 · 휴장/데이터 상태 색상 구분 · 텔레그램 일일요약 Worker 추가'],['v60','펼치기·접기 버튼/세부보기 디자인 및 기호 통일'],['v59','계좌 저장 체크박스 크기·줄바꿈 및 모바일 관심종목 삭제 크기·간격 개선'],['v58','시장 상태 배지·시세 애니메이션·히트맵 롤오버·가격 글꼴 통일'],['v57','설정 절약모드 가림 수정 · 업데이트 최하단 중앙 배치 · 관리자 이력 메뉴'],['v56','방문 중 펼침 유지 · 암호 확인 · 계좌 요약 조건부 표시 · 상단 상태/시세 애니메이션'],['v55','모바일 종가·등락률 15px 및 소제목 간격 12px 통일'],['v54','롤오버·메뉴 통일 · 히트맵 표현 · PC 바로가기 개선'],['v53','PC 요약 한 줄 · 카드 정렬 · 소셜 탭 · 선물 링크'],['v52','모바일 요약 3+2 배치 · 이벤트 표시 버튼 보완'],['v51','가격 잘림 · CNN 점수/막대 · 하단 겹침 수정'],['v50','실적·배당 모바일 배치 및 표시 설정 유지'],['v49','Worker Secret 분리 · 관리자 인증 · 프록시/요청 제한'],['v48','본문 복사 제한 · 출처/워터마크 · CSP 강화']];
 var list=document.createElement('ol');entries.forEach(function(e){var item=document.createElement('li');var date=document.createElement('b');date.textContent='2026.10.10 · '+e[0]+' — ';item.append(date,document.createTextNode(e[1]));list.appendChild(item);});log.appendChild(list);area.appendChild(log);
 function admin(){try{return localStorage.getItem('mk_gate_off')==='1';}catch(e){return false;}}
 function sync(){log.hidden=!admin();if(log.hidden)log.open=false;}
 summary.addEventListener('click',function(e){if(!admin()){e.preventDefault();log.open=false;log.hidden=true;}});
 sync();setInterval(sync,1500);window.addEventListener('storage',sync);
})();
