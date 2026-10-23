/* VIX × S&P500 겹쳐보기 + 일별 시세표 (시장 내부지표 카드 하단). 데이터: Yahoo 일봉(집계 서버 경유) */
(function () {
  'use strict';
  var P = 'https://ai.coolzet.workers.dev/?url=', d = document, done = false;
  function get(sym) {
    return fetch(P + encodeURIComponent('https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(sym) + '?range=6mo&interval=1d'))
      .then(function (r) { return r.json(); }).then(function (j) {
        var r = j.chart.result[0], q = r.indicators.quote[0], out = [];
        r.timestamp.forEach(function (t, i) { if (q.close[i] != null) out.push({ t: t * 1000, o: q.open ? q.open[i] : null, h: q.high ? q.high[i] : null, l: q.low ? q.low[i] : null, c: q.close[i] }); });
        return out;
      });
  }
  function ymd(ms) { var x = new Date(ms + 9 * 3600e3); return x.getUTCFullYear() + '/' + ('0' + (x.getUTCMonth() + 1)).slice(-2) + '/' + ('0' + x.getUTCDate()).slice(-2); }
  function f2(v) { return v == null || !isFinite(v) ? '-' : v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function line(arr, key, x, y, col) {
    return '<polyline fill="none" stroke="' + col + '" stroke-width="1.8" points="' + arr.map(function (p, i) { return x(i).toFixed(1) + ',' + y(p[key]).toFixed(1); }).join(' ') + '"/>';
  }
  function render(host, vx, sp) {
    var map = {}; sp.forEach(function (s) { map[ymd(s.t)] = s; });
    var rows = vx.filter(function (v) { return map[ymd(v.t)]; }).map(function (v) { return { t: v.t, vc: v.c, vo: v.o, vh: v.h, vl: v.l, sc: map[ymd(v.t)].c }; });
    if (rows.length < 20) return false;
    var n = Math.min(66, rows.length), r = rows.slice(-n), W = 640, H = 200, L = 34, R = 44, T = 12, B = 22;
    var vmin = Math.min.apply(null, r.map(function (a) { return a.vc; })), vmax = Math.max.apply(null, r.map(function (a) { return a.vc; }));
    var smin = Math.min.apply(null, r.map(function (a) { return a.sc; })), smax = Math.max.apply(null, r.map(function (a) { return a.sc; }));
    var x = function (i) { return L + (W - L - R) * i / (n - 1); };
    var yv = function (v) { return T + (H - T - B) * (1 - (v - vmin) / ((vmax - vmin) || 1)); };
    var ys = function (v) { return T + (H - T - B) * (1 - (v - smin) / ((smax - smin) || 1)); };
    var vp = r.map(function (a) { return { k: a.vc }; }), sq = r.map(function (a) { return { k: a.sc }; });
    var grid = '';
    for (var g = 0; g <= 3; g++) { var gy = T + (H - T - B) * g / 3; grid += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + gy + '" y2="' + gy + '" stroke="#E4E7EC"/><text x="' + (L - 4) + '" y="' + (gy + 3) + '" text-anchor="end" font-size="10" fill="#067647">' + (vmax - (vmax - vmin) * g / 3).toFixed(1) + '</text><text x="' + (W - R + 4) + '" y="' + (gy + 3) + '" font-size="10" fill="#1D4ED8">' + Math.round(smax - (smax - smin) * g / 3).toLocaleString() + '</text>'; }
    var xl = '';[0, Math.floor(n / 2), n - 1].forEach(function (i) { xl += '<text x="' + x(i) + '" y="' + (H - 6) + '" text-anchor="middle" font-size="10" fill="#667085">' + ymd(r[i].t).slice(2) + '</text>'; });
    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="vt-svg" role="img" aria-label="VIX와 S&P500 최근 3개월 비교 차트">' + grid + xl +
      '<polyline fill="none" stroke="#1D4ED8" stroke-width="1.8" points="' + r.map(function (a, i) { return x(i).toFixed(1) + ',' + ys(a.sc).toFixed(1); }).join(' ') + '"/>' +
      '<polyline fill="none" stroke="#067647" stroke-width="1.8" points="' + r.map(function (a, i) { return x(i).toFixed(1) + ',' + yv(a.vc).toFixed(1); }).join(' ') + '"/></svg>';
    var body = r.slice(-10).reverse().map(function (a, i, arr) {
      var prev = arr[i + 1] || null, dv = prev ? a.vc - prev.vc : 0;
      var cls = dv > 0 ? 'u' : dv < 0 ? 'dn' : '';
      return '<tr><td>' + ymd(a.t) + '</td><td>' + f2(a.sc) + '</td><td class="' + cls + '">' + f2(a.vc) + '</td><td>' + f2(a.vo) + '</td><td>' + f2(a.vh) + '</td><td>' + f2(a.vl) + '</td></tr>';
    }).join('');
    var last = r[n - 1], lvl = last.vc >= 30 ? '매우 높음 · 패닉 구간' : last.vc >= 20 ? '높음 · 경계 구간' : last.vc >= 15 ? '보통' : '낮음 · 안일 구간';
    host.innerHTML = '<div class="vt-h"><b>📈 VIX × S&amp;P500 (최근 3개월)</b><span class="vt-lg"><i style="background:#067647"></i>VIX(좌) <i style="background:#1D4ED8"></i>S&amp;P500(우)</span></div>' + svg +
      '<div class="vt-n">최근 VIX <b>' + f2(last.vc) + '</b> · ' + lvl + ' <span class="mut">(VIX가 오르면 보통 주가는 내립니다. 두 선이 반대로 움직이는지 확인하세요.)</span></div>' +
      '<div class="vt-tw"><table class="vt-t"><tbody><tr><th>일자</th><th>S&amp;P500</th><th>VIX 종가</th><th>VIX 시가</th><th>VIX 고가</th><th>VIX 저가</th></tr>' + body + '</tbody></table></div>' +
      '<div class="vt-s">출처: Yahoo Finance 일봉(미국 거래일 기준, 15분 지연 가능). 종가가 전일보다 높으면 <b class="u">빨강</b>, 낮으면 <b class="dn">파랑</b>.</div>';
    return true;
  }
  function init() {
    if (done) return; var card = d.getElementById('pro-int'); if (!card) return;
    if (!card.querySelector('.vt-box')) { var h = d.createElement('div'); h.className = 'vt-box'; h.textContent = 'VIX 일별 시세를 불러오는 중…'; card.appendChild(h); }
    done = true;
    var host = card.querySelector('.vt-box');
    Promise.all([get('^VIX'), get('^GSPC')]).then(function (a) { if (!render(host, a[0], a[1])) host.textContent = 'VIX 일별 시세 데이터가 부족합니다.'; })
      .catch(function () { host.textContent = 'VIX 일별 시세를 불러오지 못했습니다.'; });
  }
  var t = setInterval(function () { if (d.getElementById('pro-int')) { clearInterval(t); setTimeout(init, 1500); } }, 800);
})();
