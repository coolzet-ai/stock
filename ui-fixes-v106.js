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

  function run() { dropHistory(); sectorLegend(); liveCards(); }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', run); else run();
  [800, 2000, 4500, 9000].forEach(function (t) { setTimeout(run, t); });
})();
