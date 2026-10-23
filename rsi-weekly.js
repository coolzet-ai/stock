/* rsi-weekly.js — 주봉 RSI(14) 계산·표시
   Worker /yw (Yahoo 주봉 2년치)에서 종목별 주봉 종가를 받아 Wilder 방식 RSI(14)를 계산하고,
   종목 표의 RSI 배지 옆에 '주 NN' 배지를 붙인다. 마지막 봉은 '진행 중인 이번 주' 값이다.
   값을 받지 못한 종목은 배지를 달지 않는다(추정·대체 없음). */
(function () {
  'use strict';
  var W = 'https://ai.coolzet.workers.dev', TABLES = ['cap-tbl', 'tick-tbl', 'lev-tbl'], d = document;
  var DATA = window.MK_RSI_W = window.MK_RSI_W || {}; /* {TICKER:{v:RSI, n:봉수, last:'YYYY-MM-DD'}} */
  var fetched = {}, busy = false, failed = 0;
  function rsi(c, n) {
    n = n || 14; if (!c || c.length < n + 1) return null;
    var g = 0, l = 0, i, x;
    for (i = 1; i <= n; i++) { x = c[i] - c[i - 1]; if (x >= 0) g += x; else l -= x; }
    g /= n; l /= n;
    for (i = n + 1; i < c.length; i++) { x = c[i] - c[i - 1]; g = (g * (n - 1) + (x > 0 ? x : 0)) / n; l = (l * (n - 1) + (x < 0 ? -x : 0)) / n; }
    return l === 0 ? 100 : 100 - 100 / (1 + g / l);
  }
  function tickers() {
    var s = {}, a = [];
    TABLES.forEach(function (id) { Array.prototype.forEach.call(d.querySelectorAll('#' + id + ' .wl-row[data-t]'), function (r) { var t = r.getAttribute('data-t'); if (t && !s[t]) { s[t] = 1; a.push(t); } }); });
    return a;
  }
  function load() {
    if (busy) return; var need = tickers().filter(function (t) { return !fetched[t]; }); if (!need.length) return;
    busy = true; var chunks = [], i;
    for (i = 0; i < need.length; i += 30) chunks.push(need.slice(i, i + 30));
    Promise.all(chunks.map(function (ch) {
      return fetch(W + '/yw?symbols=' + encodeURIComponent(ch.join(',')), { signal: AbortSignal.timeout ? AbortSignal.timeout(30000) : undefined })
        .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then(function (j) {
          ch.forEach(function (t) {
            fetched[t] = 1; var o = j && j[t.toUpperCase()]; if (!o || !o.c) return;
            if (o.c.length < 30) return; /* 상장 6개월 미만(주봉 30개 미만)은 RSI가 불안정해 표시하지 않음 */
            var v = rsi(o.c, 14); if (v == null) return;
            DATA[t] = { v: v, n: o.c.length, last: new Date(o.t[o.t.length - 1] * 1000).toISOString().slice(0, 10) };
          });
        });
    })).then(function () { failed = 0; window.MK_RSI_W_ERR = 0; }).catch(function () { failed++; window.MK_RSI_W_ERR = 1; })
      .then(function () { busy = false; decorate(); d.dispatchEvent(new CustomEvent('mk-rsi-weekly')); });
  }
  function cls(v) { return v >= 75 ? 'tb-hot' : v <= 30 ? 'tb-cold' : 'tb-mid'; }
  function decorate() {
    TABLES.forEach(function (id) {
      Array.prototype.forEach.call(d.querySelectorAll('#' + id + ' .wl-row[data-t]'), function (r) {
        var o = DATA[r.getAttribute('data-t')], ind = r.querySelector('.wl-ind'); if (!o || !ind) return;
        var b = ind.querySelector('.tb-w'), txt = '주 ' + Math.round(o.v) + (o.v >= 75 ? '🔥' : o.v <= 30 ? '🧊' : '');
        var tip = '주봉 RSI(14) ' + o.v.toFixed(1) + ' · ' + (o.v >= 75 ? '과매수(75 이상)' : o.v <= 30 ? '과매도(30 이하)' : '중립') + ' · 주봉 ' + o.n + '개 · 마지막 봉 ' + o.last + '(이번 주 진행 중)';
        if (!b) { b = d.createElement('span'); ind.appendChild(b); }
        if (b.textContent !== txt || b.title !== tip) { b.className = 'tb tb-w ' + cls(o.v); b.textContent = txt; b.title = tip; }
      });
    });
  }
  var timer = null;
  function kick() { clearTimeout(timer); timer = setTimeout(function () { decorate(); load(); }, 400); }
  function start() {
    TABLES.forEach(function (id) { var e = d.getElementById(id); if (e) new MutationObserver(kick).observe(e, { childList: true, subtree: true }); });
    kick(); setTimeout(kick, 4000); setTimeout(kick, 10000);
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', start); else start();
})();
