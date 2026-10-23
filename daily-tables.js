/* 한국주식: 코스피 × 원/달러 · 가상화폐: 비트코인 × 공포탐욕 — 겹쳐보기 차트 + 최근 10일 시세표 (Yahoo·alternative.me, 집계 서버 경유) */
(function () {
  'use strict';
  var P = 'https://ai.coolzet.workers.dev/?url=', d = document, page = /kr-stock/.test(location.pathname) ? 'kr' : /crypto/.test(location.pathname) ? 'cr' : '';
  if (!page) return;
  function yc(sym) {
    return fetch(P + encodeURIComponent('https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(sym) + '?range=6mo&interval=1d')).then(function (r) { return r.json(); }).then(function (j) {
      var r = j.chart.result[0], q = r.indicators.quote[0], o = [];
      r.timestamp.forEach(function (t, i) { if (q.close[i] != null) o.push({ k: ymd(t * 1000), t: t * 1000, o: q.open ? q.open[i] : null, h: q.high ? q.high[i] : null, l: q.low ? q.low[i] : null, c: q.close[i] }); }); return o;
    });
  }
  function fg() {
    return fetch(P + encodeURIComponent('https://api.alternative.me/fng/?limit=120&format=json')).then(function (r) { return r.json(); }).then(function (j) {
      return j.data.map(function (x) { var t = +x.timestamp * 1000; return { k: ymd(t), t: t, c: +x.value, cls: x.value_classification }; }).reverse();
    });
  }
  function ymd(ms) { var x = new Date(ms + 9 * 3600e3); return x.getUTCFullYear() + '/' + ('0' + (x.getUTCMonth() + 1)).slice(-2) + '/' + ('0' + (x.getUTCDate())).slice(-2); }
  function f(v, dg) { return v == null || !isFinite(v) ? '-' : v.toLocaleString('en-US', { minimumFractionDigits: dg, maximumFractionDigits: dg }); }
  function cl(v) { return v > 0 ? 'u' : v < 0 ? 'dn' : ''; }
  function chart(r, ka, kb, ca, cb, la, lb, da, db) {
    var n = r.length, W = 640, H = 200, L = 46, R = 46, T = 12, B = 22, mm = function (k) { var a = r.map(function (x) { return x[k]; }); return [Math.min.apply(null, a), Math.max.apply(null, a)]; };
    var A = mm(ka), Bm = mm(kb), x = function (i) { return L + (W - L - R) * i / (n - 1); }, ya = function (v) { return T + (H - T - B) * (1 - (v - A[0]) / ((A[1] - A[0]) || 1)); }, yb = function (v) { return T + (H - T - B) * (1 - (v - Bm[0]) / ((Bm[1] - Bm[0]) || 1)); };
    var g = '', i; for (i = 0; i <= 3; i++) { var gy = T + (H - T - B) * i / 3; g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + gy + '" y2="' + gy + '" stroke="#E4E7EC"/><text x="' + (L - 4) + '" y="' + (gy + 3) + '" text-anchor="end" font-size="10" fill="' + ca + '">' + f(A[1] - (A[1] - A[0]) * i / 3, da) + '</text><text x="' + (W - R + 4) + '" y="' + (gy + 3) + '" font-size="10" fill="' + cb + '">' + f(Bm[1] - (Bm[1] - Bm[0]) * i / 3, db) + '</text>'; }
    var xl = ''; [0, Math.floor(n / 2), n - 1].forEach(function (k) { xl += '<text x="' + x(k) + '" y="' + (H - 6) + '" text-anchor="middle" font-size="10" fill="#667085">' + r[k].k.slice(2) + '</text>'; });
    var pl = function (key, fy, col) { return '<polyline fill="none" stroke="' + col + '" stroke-width="1.8" points="' + r.map(function (a, k) { return x(k).toFixed(1) + ',' + fy(a[key]).toFixed(1); }).join(' ') + '"/>'; };
    return '<div class="vt-h"><b>' + (page === 'kr' ? '📈 코스피 × 원/달러 (최근 3개월)' : '📈 비트코인 × 공포탐욕지수 (최근 3개월)') + '</b><span class="vt-lg"><i style="background:' + ca + '"></i>' + la + '(좌) <i style="background:' + cb + '"></i>' + lb + '(우)</span></div><svg viewBox="0 0 ' + W + ' ' + H + '" class="vt-svg" role="img" aria-label="' + la + '와 ' + lb + ' 비교 차트">' + g + xl + pl(ka, ya, ca) + pl(kb, yb, cb) + '</svg>';
  }
  function table(head, rows) { return '<div class="vt-tw"><table class="vt-t"><tbody><tr>' + head.map(function (h) { return '<th>' + h + '</th>'; }).join('') + '</tr>' + rows.join('') + '</tbody></table></div>'; }
  function build(host) {
    if (page === 'kr') return Promise.all([yc('^KS11'), yc('KRW=X')]).then(function (a) {
      var m = {}; a[1].forEach(function (x) { m[x.k] = x; });
      var r = a[0].filter(function (x) { return m[x.k]; }).map(function (x) { return { k: x.k, t: x.t, kc: x.c, kh: x.h, kl: x.l, fx: m[x.k].c }; });
      if (r.length < 20) throw 0; r = r.slice(-66);
      var rows = r.slice(-10).reverse().map(function (x, i, ar) { var p = ar[i + 1], dk = p ? x.kc / p.kc - 1 : 0, df = p ? x.fx / p.fx - 1 : 0; return '<tr><td>' + x.k + '</td><td class="' + cl(dk) + '">' + f(x.kc, 2) + '</td><td class="' + cl(dk) + '">' + (p ? (dk > 0 ? '+' : '') + f(dk * 100, 2) + '%' : '-') + '</td><td>' + f(x.kh, 2) + '</td><td>' + f(x.kl, 2) + '</td><td class="' + cl(df) + '">' + f(x.fx, 1) + '</td><td class="' + cl(df) + '">' + (p ? (df > 0 ? '+' : '') + f(df * 100, 2) + '%' : '-') + '</td></tr>'; });
      var l = r[r.length - 1];
      host.innerHTML = chart(r, 'kc', 'fx', '#067647', '#B54708', '코스피', '원/달러', 0, 0) + '<div class="vt-n">원/달러가 오르면(원화 약세) 외국인 매도 압력이 커지는 경향이 있습니다. 두 선이 반대로 움직이는지 확인하세요. <span class="mut">(VKOSPI는 일별 이력 데이터가 없어 제외)</span></div>' + table(['일자', '코스피', '등락', '고가', '저가', '원/달러', '등락'], rows) + '<div class="vt-s">출처: Yahoo Finance 일봉(한국 거래일 기준, 지연 가능). 상승 <b class="u">빨강</b>, 하락 <b class="dn">파랑</b>.</div>';
    });
    return Promise.all([yc('BTC-USD'), fg()]).then(function (a) {
      var m = {}; a[1].forEach(function (x) { m[x.k] = x; });
      var r = a[0].filter(function (x) { return m[x.k]; }).map(function (x) { return { k: x.k, t: x.t, c: x.c, o: x.o, h: x.h, l: x.l, g: m[x.k].c, gc: m[x.k].cls }; });
      if (r.length < 20) throw 0; r = r.slice(-66);
      var kor = { 'Extreme Fear': '극단적 공포', 'Fear': '공포', 'Neutral': '중립', 'Greed': '탐욕', 'Extreme Greed': '극단적 탐욕' };
      var rows = r.slice(-10).reverse().map(function (x, i, ar) { var p = ar[i + 1], dc = p ? x.c / p.c - 1 : 0; return '<tr><td>' + x.k + '</td><td class="' + cl(dc) + '">$' + f(x.c, 0) + '</td><td class="' + cl(dc) + '">' + (p ? (dc > 0 ? '+' : '') + f(dc * 100, 2) + '%' : '-') + '</td><td>$' + f(x.h, 0) + '</td><td>$' + f(x.l, 0) + '</td><td><b>' + x.g + '</b> <span class="mut">' + (kor[x.gc] || x.gc) + '</span></td></tr>'; });
      host.innerHTML = chart(r, 'c', 'g', '#B54708', '#7A5AF8', '비트코인', '공포탐욕', 0, 0) + '<div class="vt-n">공포탐욕지수가 극단적 공포일 때 가격이 바닥권이었던 경우가 많지만, 하락 추세에서는 공포가 더 길어질 수도 있습니다.</div>' + table(['일자', 'BTC 종가', '등락', '고가', '저가', '공포탐욕'], rows) + '<div class="vt-s">출처: Yahoo Finance(BTC-USD, UTC 일봉)·alternative.me. 상승 <b class="u">빨강</b>, 하락 <b class="dn">파랑</b>.</div>';
    });
  }
  function init() {
    var a = page === 'kr' ? d.getElementById('kr-corr-grid') : d.getElementById('cry-rel-card'); if (!a || d.getElementById('mk-dt')) return;
    var c = d.createElement('div'); c.className = 'card vt-box vt-card'; c.id = 'mk-dt'; c.textContent = '일별 시세를 불러오는 중…';
    var top = a; while (top.parentElement && top.parentElement.className.indexOf('wrap') < 0 && top.parentElement.tagName !== 'SECTION') top = top.parentElement; /* 접힌 섹션 밖(바로 다음)에 둔다 */
    top.parentNode.insertBefore(c, top.nextSibling);
    build(c).catch(function () { c.textContent = '일별 시세를 불러오지 못했습니다.'; });
  }
  var t = setInterval(function () { if (d.getElementById(page === 'kr' ? 'kr-corr-grid' : 'cry-rel-card')) { clearInterval(t); setTimeout(init, 1500); } }, 800);
})();
