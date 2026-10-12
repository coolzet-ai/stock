/* ui-fixes-v106 — 공통 보정 (brand-layout.js 다음에 로드)
   · 업데이트 이력 요소 제거(여러 스크립트가 중복 생성하던 것)
   · 미국 섹터 히트맵에 한국 '시장 한눈에 보기'와 같은 -4%~+4% 색 범례 추가 */
(function () {
  'use strict';
  var d = document;
  var $$ = function (s, r) { return Array.prototype.slice.call((r || d).querySelectorAll(s)); };

  /* ── 업데이트 이력 제거 ── */
  function dropHistory() {
    $$('#v92-update-history,#stock-update-history,.cross-update-log').forEach(function (e) { e.remove(); });
    $$('footer details').forEach(function (e) {
      var s = e.querySelector(':scope>summary');
      if (s && /업데이트 이력/.test(s.textContent)) e.remove();
    });
  }

  /* ── 섹터 히트맵 범례 (stock-pulse.js 의 col() 과 같은 색 계산) ── */
  function col(v) {
    var a = Math.min(Math.abs(v) / 4, 1), US = !!(window.MK_CV && window.MK_CV.us);
    var L = v >= 0 ? (US ? [6, 118, 71] : [200, 32, 20]) : (US ? [200, 32, 20] : [26, 111, 168]);
    var g = [110, 118, 112];
    return 'rgb(' + L.map(function (x, i) { return Math.round(g[i] + (x - g[i]) * a); }).join(',') + ')';
  }
  function sectorLegend() {
    var box = d.getElementById('pro-sector'); if (!box) return;
    var old = box.querySelector('.hm-l'); if (old) old.remove();
    var host = box.querySelector('.shm'); if (!host) return;
    var l = d.createElement('div'); l.className = 'hm-l'; l.setAttribute('aria-label', '색 범례: 하락 -4%에서 상승 +4%');
    l.innerHTML = '-4%' + [-4, -1, 0.01, 1, 4].map(function (v) { return '<i style="background:' + col(v) + '"></i>'; }).join('') + '+4%';
    host.after(l);
  }


  /* ── 메인 페이지: 시장 카드에 실시간 등락률(S&P500 · 코스피 · 비트코인) ── */
  var LIVE = { 'stock': ['^GSPC', 'S&P 500'], 'kr-stock': ['^KS11', '코스피'], 'crypto': ['BTC-USD', '비트코인'] };
  var PROXY = 'https://ai.coolzet.workers.dev/?url=';
  function liveCards() {
    $$('.cross-market-links a[data-market]').forEach(function (a) {
      var cfg = LIVE[a.dataset.market]; if (!cfg || a.dataset.live === '1') return; a.dataset.live = '1';
      var em = d.createElement('em'); em.className = 'mk-live'; em.textContent = cfg[1] + ' —'; a.append(em);
      var ctl = ('AbortController' in window) ? new AbortController() : null, to = setTimeout(function () { if (ctl) ctl.abort(); }, 9000);
      fetch(PROXY + encodeURIComponent('https://query1.finance.yahoo.com/v8/finance/chart/' + cfg[0] + '?range=5d&interval=1d'), ctl ? { signal: ctl.signal } : {})
        .then(function (r) { if (!r.ok) throw 0; return r.json(); }).then(function (j) {
          clearTimeout(to);
          var m = j.chart.result[0].meta, last = m.regularMarketPrice, prev = m.chartPreviousClose != null ? m.chartPreviousClose : m.previousClose;
          if (last == null || !prev) throw 0;
          var v = (last / prev - 1) * 100;
          em.className = 'mk-live ' + (v > 0 ? 'up' : v < 0 ? 'down' : 'flat');
          em.textContent = cfg[1] + ' ' + (v > 0 ? '▲ +' : v < 0 ? '▼ −' : '') + Math.abs(v).toFixed(2) + '%';
        }).catch(function () { clearTimeout(to); });
    });
  }

  /* ── 암호가 필요한 펼치기(상세 보기)에 🔒 표시. 암호를 통과하면 모두 제거 ── */
  var LOCKED = ['.cross-restricted>summary', '#kr-breadth-panel>summary', '#guide>h2 button', '#guide>h2 a'];
  function lockOn() {
    try { if (localStorage.getItem('mk_gate_off') === '1') return false; } catch (e) {}
    return !window.__mkUnlocked;
  }
  function markLocks() {
    if (!lockOn()) { $$('.mk-locked').forEach(function (e) { e.classList.remove('mk-locked'); }); return; }
    LOCKED.forEach(function (sel) { $$(sel).forEach(function (e) { e.classList.add('mk-locked'); }); });
  }
  function wrapGate() {
    var f = window.MK_REQUEST_DETAIL; if (typeof f !== 'function' || f.__mkWrapped) return;
    var w = function (done) { return f.call(this, function () { window.__mkUnlocked = true; markLocks(); if (done) done.apply(this, arguments); }); };
    w.__mkWrapped = true; window.MK_REQUEST_DETAIL = w;
  }

  /* ═══ 실시간 시세 스위치(MK_LIVE) ═══
     Cloudflare Worker 요청·데이터 사용을 줄이기 위해 실시간 갱신은 사용자가 켠 경우에만 돈다(기본 꺼짐).
     켜 두어도 · 탭이 숨겨지면 멈춤 · 10분간 조작이 없으면 일시정지(다시 조작하면 재개) · 데이터 절약 모드(mk_save)면 기본 꺼짐.
     한국주식(kr-live.js)과 미국주식 선물 카드가 이 설정을 함께 쓴다. 저장: mk_live('0'|'1'), mk_live_ms(15000|30000|60000). */
  var DEFAULT_ON = false, IDLE_MS = 10 * 60000, MS_OPTS = [15000, 30000, 60000];
  var lastAct = Date.now(), subs = [], btn = null, sel = null, st = { text: '', cls: '' };
  function rd(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function wr(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  var LIVE = window.MK_LIVE = {
    on: function () { var v = rd('mk_live'); return v === null ? (DEFAULT_ON && !window.MK_SAVE) : v === '1'; },
    ms: function () { var m = +rd('mk_live_ms'); return MS_OPTS.indexOf(m) >= 0 ? m : 30000; },
    idle: function () { return Date.now() - lastAct > IDLE_MS; },
    active: function () { return LIVE.on() && !LIVE.idle() && !d.hidden; },
    set: function (on) { wr('mk_live', on ? '1' : '0'); lastAct = Date.now(); notify(); },
    setMs: function (ms) { wr('mk_live_ms', String(ms)); notify(); },
    onChange: function (fn) { subs.push(fn); },
    status: function (text, cls) { st = { text: text, cls: cls || '' }; paintSw(); }
  };
  function notify() { paintSw(); subs.forEach(function (f) { try { f(); } catch (e) {} }); }
  function paintSw() {
    if (!btn) return;
    var on = LIVE.on(), idle = on && LIVE.idle();
    var text = !on ? '○ 실시간 꺼짐' : idle ? '⏸ 무조작 일시정지 · 눌러서 재개' : (st.text || '● 실시간 연결 중');
    btn.textContent = text; btn.className = 'mk-live-sw ' + (!on ? 'off' : idle ? 'paused' : (st.cls || 'on'));
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    btn.title = !on ? '꺼져 있습니다(서버 요청 절약). 눌러서 실시간 시세를 켭니다' : '눌러서 실시간 시세를 끕니다. 켜 두면 갱신마다 서버 요청이 발생합니다';
    if (sel) { sel.hidden = !on; sel.value = String(LIVE.ms()); }
  }
  function mountSw() {
    if (btn && btn.isConnected) return true;
    var hd = d.querySelector('#pro-brief .pb-hd'); if (!hd) return false;
    btn = d.getElementById('mk-live-sw') || d.createElement('button'); btn.type = 'button'; btn.id = 'mk-live-sw';
    btn.addEventListener('click', function () { if (LIVE.on() && LIVE.idle()) { lastAct = Date.now(); notify(); } else LIVE.set(!LIVE.on()); });
    sel = d.createElement('select'); sel.id = 'mk-live-ms'; sel.setAttribute('aria-label', '실시간 갱신 주기');
    MS_OPTS.forEach(function (m) { var o = d.createElement('option'); o.value = m; o.textContent = (m / 1000) + '초'; sel.appendChild(o); });
    sel.addEventListener('change', function () { LIVE.setMs(+sel.value); });
    hd.appendChild(btn); hd.appendChild(sel); paintSw(); return true;
  }
  ['pointerdown', 'keydown', 'touchstart', 'scroll'].forEach(function (ev) {
    window.addEventListener(ev, function () { var was = LIVE.on() && LIVE.idle(); lastAct = Date.now(); if (was) notify(); }, { passive: true, capture: true });
  });
  (function () { var n = 0, iv = setInterval(function () { if (mountSw() || ++n > 60) clearInterval(iv); }, 500); })();
  setInterval(paintSw, 20000); /* 무조작 일시정지 표시 반영 */
  LIVE.onChange(function () { if (LIVE.active() && typeof window.__fillFut === 'function') window.__fillFut(); }); /* 미국 선물: 켜면 바로 한 번 */

  function run() { dropHistory(); sectorLegend(); liveCards(); wrapGate(); markLocks(); }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', run); else run();
  [800, 2000, 4500, 9000].forEach(function (t) { setTimeout(run, t); });
})();
