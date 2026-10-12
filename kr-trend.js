/* 한국주식 "오늘의 시장 요약" — 코스피·코스닥·원/달러 추세 (미국주식의 지수 흐름 요약에 대응)
   Yahoo 일봉(최근 1개월)을 기존 Worker 프록시로 받아 미니 추세선과 등락률을 보여 준다. 값이 없으면 임의 값을 만들지 않고 '—'로 둔다. */
(function () {
  'use strict';
  var d = document, PROXY = 'https://ai.coolzet.workers.dev/?url=';
  var ITEMS = [
    { s: '^KS11', n: '코스피', dp: 2, u: '' },
    { s: '^KQ11', n: '코스닥', dp: 2, u: '' },
    { s: 'KRW=X', n: '원/달러', dp: 1, u: '원' }
  ];
  var box, timer, started = false;

  function fmt(v, dp) { return v.toLocaleString('ko-KR', { minimumFractionDigits: dp, maximumFractionDigits: dp }); }
  function pct(v) { return (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(2) + '%'; }
  function arrow(v) { return v > 0 ? '▲' : v < 0 ? '▼' : '–'; }
  function cls(v) { return v > 0 ? 'up' : v < 0 ? 'down' : 'flat'; }

  function spark(closes) {
    var W = 120, H = 34, p = 2, mn = Math.min.apply(null, closes), mx = Math.max.apply(null, closes), r = (mx - mn) || 1;
    var pts = closes.map(function (c, i) { return (p + i * (W - 2 * p) / (closes.length - 1)).toFixed(1) + ',' + (H - p - (c - mn) / r * (H - 2 * p)).toFixed(1); });
    var last = pts[pts.length - 1].split(',');
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" aria-hidden="true"><polyline points="' + pts.join(' ') + '" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/><circle cx="' + last[0] + '" cy="' + last[1] + '" r="2.4" fill="currentColor"/></svg>';
  }

  function load(it) {
    var url = PROXY + encodeURIComponent('https://query1.finance.yahoo.com/v8/finance/chart/' + it.s + '?range=1mo&interval=1d');
    var ctl = ('AbortController' in window) ? new AbortController() : null, to = setTimeout(function () { if (ctl) ctl.abort(); }, 9000);
    return fetch(url, ctl ? { signal: ctl.signal } : {}).then(function (r) { if (!r.ok) throw 0; return r.json(); }).then(function (j) {
      clearTimeout(to);
      var res = j && j.chart && j.chart.result && j.chart.result[0]; if (!res) throw 0;
      var q = res.indicators.quote[0].close.filter(function (x) { return x != null && isFinite(x); });
      var m = res.meta || {}, last = m.regularMarketPrice != null ? m.regularMarketPrice : q[q.length - 1];
      var prev = m.chartPreviousClose != null ? m.chartPreviousClose : q[q.length - 2];
      if (q.length < 3 || last == null || !prev) throw 0;
      return { last: last, day: (last / prev - 1) * 100, mo: (last / q[0] - 1) * 100, closes: q };
    }).catch(function () { clearTimeout(to); return null; });
  }

  function card(it, r) {
    if (!r) return '<div class="kt-c na"><small>' + it.n + '</small><b>—</b><span class="kt-d">시세 일시 오류</span></div>';
    var c = cls(r.day);
    return '<div class="kt-c ' + c + '"><small>' + it.n + '</small><b>' + fmt(r.last, it.dp) + it.u + '</b>' +
      '<span class="kt-d ' + c + '">' + arrow(r.day) + ' ' + pct(r.day) + '<em>전일</em></span>' +
      '<div class="kt-s">' + spark(r.closes) + '</div>' +
      '<span class="kt-m ' + cls(r.mo) + '">1개월 ' + pct(r.mo) + '</span></div>';
  }

  function paint() {
    box.querySelector('.kt-grid').setAttribute('aria-busy', 'true');
    Promise.all(ITEMS.map(load)).then(function (rs) {
      box.querySelector('.kt-grid').innerHTML = rs.map(function (r, i) { return card(ITEMS[i], r); }).join('');
      box.querySelector('.kt-grid').removeAttribute('aria-busy');
      var ok = rs.some(Boolean);
      box.querySelector('.kt-time').textContent = ok ? '갱신 ' + new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '';
      box.querySelector('.kt-retry').hidden = ok && rs.every(Boolean);
    });
  }

  function mount() {
    var host = d.querySelector('#pro-brief .pb-grid'); if (!host || d.getElementById('kr-mkt-trend')) return !!d.getElementById('kr-mkt-trend');
    box = d.createElement('section'); box.id = 'kr-mkt-trend'; box.setAttribute('aria-label', '코스피·코스닥·원/달러 추세');
    box.innerHTML = '<div class="kt-hd"><b>시장 추세</b><span>코스피 · 코스닥 · 원/달러 · 최근 1개월</span><em class="kt-time"></em><button type="button" class="kt-retry" hidden>다시 시도</button></div><div class="kt-grid"><div class="kt-c na"><small>불러오는 중…</small></div></div>';
    host.after(box);
    box.querySelector('.kt-retry').addEventListener('click', paint);
    paint(); timer = setInterval(paint, 180000);
    return true;
  }

  function start() {
    if (started) return; started = true;
    var tries = 0, iv = setInterval(function () { if (mount() || ++tries > 40) clearInterval(iv); }, 500);
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', start); else start();
})();
