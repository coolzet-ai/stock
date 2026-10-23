/* rsi-brief.js — 미국주식 '오늘의 시장 요약'에 RSI(14) 과매도(≤30)·과매수(≥75) 종목 칸 (일봉/주봉 전환)
   일봉: 종목 표에 이미 계산돼 있는 RSI 배지를 읽는다.  주봉: rsi-weekly.js 가 Worker(/yw)로 받아 계산한 값(window.MK_RSI_W).
   표시 범위는 '이 페이지에 올라와 있는 종목'(시총 TOP·관심종목·레버리지 ETF)뿐이며 시장 전체 스크린이 아니다. */
(function () {
  'use strict';
  var LOW = 30, HIGH = 75, TABLES = ['cap-tbl', 'tick-tbl', 'lev-tbl'], MAXN = 6, d = document;
  var mode = 'd'; try { if (localStorage.getItem('mk_rsi_mode') === 'w') mode = 'w'; } catch (e) {}
  var t0 = Date.now();
  function scan() {
    var seen = {}, rows = [];
    TABLES.forEach(function (id) {
      Array.prototype.forEach.call(d.querySelectorAll('#' + id + ' .wl-row[data-t]'), function (r) {
        var t = r.getAttribute('data-t'); if (!t || seen[t]) return; seen[t] = 1;
        var b = r.querySelector('.tb[title^="RSI(14)"]'), m = b && /RSI\(14\)\s*([\d.]+)/.exec(b.getAttribute('title') || '');
        var w = window.MK_RSI_W && window.MK_RSI_W[t];
        rows.push({ t: t, dv: m ? parseFloat(m[1]) : null, wv: w ? w.v : null });
      });
    });
    var key = mode === 'w' ? 'wv' : 'dv', lo = [], hi = [], both = [], n = 0;
    rows.forEach(function (x) {
      if (x.dv != null && x.wv != null) { if (x.dv <= LOW && x.wv <= LOW) both.push({ t: x.t, v: x.dv, w: x.wv, k: 'lo' }); else if (x.dv >= HIGH && x.wv >= HIGH) both.push({ t: x.t, v: x.dv, w: x.wv, k: 'hi' }); }
      var v = x[key]; if (v == null) return; n++;
      if (v <= LOW) lo.push({ t: x.t, v: v }); else if (v >= HIGH) hi.push({ t: x.t, v: v });
    });
    lo.sort(function (a, b) { return a.v - b.v; }); hi.sort(function (a, b) { return b.v - a.v; });
    return { lo: lo, hi: hi, n: n, both: both };
  }
  function line(cls, label, arr, n, waiting) {
    var s = d.createElement('div'); s.className = 'rsb-l ' + cls;
    var k = d.createElement('em'); k.textContent = label; s.appendChild(k);
    var v = d.createElement('span');
    if (!n) v.textContent = waiting || '계산 중';
    else if (!arr.length) v.textContent = '해당 없음';
    else v.textContent = arr.slice(0, MAXN).map(function (x) { return x.t + ' ' + Math.round(x.v) + (x.w != null ? '/' + Math.round(x.w) : ''); }).join(' · ') + (arr.length > MAXN ? ' 외 ' + (arr.length - MAXN) : '');
    s.appendChild(v); return s;
  }
  function render(force) {
    var g = d.querySelector('#pro-brief .pb-grid'); if (!g) return;
    var r = scan(), err = window.MK_RSI_W_ERR ? 1 : 0, late = Date.now() - t0 > 20000 ? 1 : 0;
    var key = [mode, r.n, err, late, r.lo.map(function (x) { return x.t + x.v.toFixed(0); }).join(), r.hi.map(function (x) { return x.t + x.v.toFixed(0); }).join(), r.both.map(function (x) { return x.t + x.k; }).join()].join('|');
    var a = g.querySelector('.pb-rsi');
    if (a && a._k === key && !force) return;
    if (!a) { a = d.createElement('div'); a.className = 'pb-c pb-rsi'; g.appendChild(a); }
    a._k = key; a.textContent = '';
    var hd = d.createElement('div'); hd.className = 'rsb-hd';
    var sm = d.createElement('small'); sm.textContent = 'RSI(14) 과매도·과매수 '; var ln = d.createElement('span'); ln.className = 'lv-n'; ln.textContent = (r.n ? r.n + '종목 기준 · ' : '') + '≤' + LOW + ' / ≥' + HIGH; sm.appendChild(ln); hd.appendChild(sm);
    var sw = d.createElement('div'); sw.className = 'rsb-sw'; sw.setAttribute('role', 'group'); sw.setAttribute('aria-label', 'RSI 기준 봉');
    [['d', '일봉'], ['w', '주봉']].forEach(function (x) { var b = d.createElement('button'); b.type = 'button'; b.textContent = x[1]; b.setAttribute('data-m', x[0]); b.setAttribute('aria-pressed', mode === x[0] ? 'true' : 'false'); sw.appendChild(b); });
    hd.appendChild(sw); a.appendChild(hd);
    var wait = mode === 'w' ? (err ? '주봉 데이터를 받지 못했습니다 (Worker /yw 필요)' : late ? '주봉 데이터 없음' : '주봉 계산 중') : null;
    var cols = d.createElement('div'); cols.className = 'rsb-cols'; cols.appendChild(line('rsb-lo', '🧊 과매도', r.lo, r.n, wait)); cols.appendChild(line('rsb-hi', '🔥 과매수', r.hi, r.n, wait)); a.appendChild(cols);
    var bo = r.both.filter(function (x) { return x.k === 'lo'; }), bh = r.both.filter(function (x) { return x.k === 'hi'; });
    if (r.both.length) { var s = d.createElement('div'); s.className = 'rsb-l rsb-bo'; var k = d.createElement('em'); k.textContent = '⚡ 일·주 동시'; s.appendChild(k); var v = d.createElement('span'); v.textContent = bo.map(function (x) { return '과매도 ' + x.t + ' ' + Math.round(x.v) + '/' + Math.round(x.w); }).concat(bh.map(function (x) { return '과매수 ' + x.t + ' ' + Math.round(x.v) + '/' + Math.round(x.w); })).join(' · '); s.appendChild(v); a.appendChild(s); }
    var nt = d.createElement('div'); nt.className = 'rsb-nt'; nt.textContent = mode === 'w' ? '주봉: 최근 2년 주봉 종가 · 마지막 봉은 이번 주 진행 중 값' : '일봉: 최근 1년 일봉 종가'; if (r.both.length) nt.textContent += ' · 숫자는 일/주 RSI'; a.appendChild(nt);
  }
  d.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('.pb-rsi .rsb-sw button'); if (!b) return; e.preventDefault();
    mode = b.getAttribute('data-m') === 'w' ? 'w' : 'd'; try { localStorage.setItem('mk_rsi_mode', mode); } catch (x) {} render(true);
  });
  d.addEventListener('mk-rsi-weekly', function () { render(); });
  var t = 0, iv = setInterval(function () { render(); if (++t > 120) { clearInterval(iv); iv = setInterval(render, 15000); } }, 2000);
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', function () { render(); }); else render();
})();
