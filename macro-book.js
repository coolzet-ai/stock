/* 매크로 차트북 — FRED 공개 데이터(집계 서버 /fred 경유). 값은 가공만 하고 추정하지 않는다. */
(function () {
  'use strict';
  var W = 'https://ai.coolzet.workers.dev/fred?ids=', d = document;
  /* [id, 제목, 가공(lvl|yoy|mom|diff), 단위, 소수, 차트(line|bar), 좋은방향(up|down|none)] */
  var S = [
    ['DGS10', '미 국채 10년 (%)', 'lvl', '%', 2, 'line'], ['DFEDTARU', '정책금리 상단 (%)', 'lvl', '%', 2, 'line'],
    ['T10Y2Y', '장단기 금리차 10Y-2Y (%p)', 'lvl', '%p', 2, 'line'], ['BAMLH0A0HYM2', '하이일드 스프레드 (%p)', 'lvl', '%p', 2, 'line'],
    ['DTWEXBGS', '달러지수(광의, Index)', 'lvl', '', 1, 'line'], ['DCOILWTICO', 'WTI 유가 ($/배럴)', 'lvl', '$', 1, 'line'],
    ['UNRATE', '실업률 (%)', 'lvl', '%', 1, 'line'], ['PAYEMS', '비농업 고용 증감 (천명, 전월차)', 'diff', '천명', 0, 'bar'],
    ['ICSA', '신규 실업수당 청구 (건)', 'lvl', '건', 0, 'line'], ['CPIAUCSL', '소비자물가 CPI (% 전년비)', 'yoy', '%', 2, 'bar'],
    ['PCEPI', 'PCE 물가 (% 전년비)', 'yoy', '%', 2, 'bar'], ['A191RL1Q225SBEA', 'GDP 성장률 (% 연율, 전기비)', 'lvl', '%', 1, 'bar'],
    ['RSXFS', '소매판매 (% 전년비)', 'yoy', '%', 2, 'bar'], ['INDPRO', '산업생산 (% 전월비)', 'mom', '%', 2, 'bar'],
    ['UMCSENT', '미시간 소비자심리 (Index)', 'lvl', '', 1, 'line'], ['M2SL', 'M2 통화량 (% 전년비)', 'yoy', '%', 2, 'bar']
  ];
  function tr(raw, mode) {
    var t = raw.t, v = raw.v, o = { t: [], v: [] }, i;
    if (mode === 'lvl') return raw;
    for (i = 0; i < v.length; i++) {
      if (mode === 'diff') { if (i) { o.t.push(t[i]); o.v.push(v[i] - v[i - 1]); } }
      else if (mode === 'mom') { if (i && v[i - 1]) { o.t.push(t[i]); o.v.push((v[i] / v[i - 1] - 1) * 100); } }
      else if (mode === 'yoy') { var j = -1, y = +t[i].slice(0, 4) - 1, tgt = y + t[i].slice(4); for (var k = 0; k < i; k++) if (t[k] >= tgt) { j = k; break; } if (j >= 0 && j < i && Math.abs(new Date(t[j]) - new Date(tgt)) < 45 * 86400000 && v[j]) { o.t.push(t[i]); o.v.push((v[i] / v[j] - 1) * 100); } }
    }
    return o;
  }
  function fmt(n, dg) { return n.toLocaleString('en-US', { minimumFractionDigits: dg, maximumFractionDigits: dg }); }
  function spark(o, kind) {
    var n = o.v.length, W2 = 300, H = 90, P = 6, mn = Math.min.apply(null, o.v), mx = Math.max.apply(null, o.v);
    if (kind === 'bar') { mn = Math.min(mn, 0); mx = Math.max(mx, 0); }
    var rg = (mx - mn) || 1, y = function (v) { return P + (H - 2 * P) * (1 - (v - mn) / rg); }, x = function (i) { return P + (W2 - 2 * P) * (n === 1 ? .5 : i / (n - 1)); };
    var h = '<svg viewBox="0 0 ' + W2 + ' ' + H + '" class="cb-svg" preserveAspectRatio="none" aria-hidden="true">';
    if (kind === 'bar') { var bw = Math.max(2, (W2 - 2 * P) / n * .7), z = y(0); h += '<line x1="0" x2="' + W2 + '" y1="' + z + '" y2="' + z + '" stroke="#d0d5dd"/>'; o.v.forEach(function (v, i) { var yy = y(v); h += '<rect x="' + (x(i) - bw / 2).toFixed(1) + '" y="' + Math.min(yy, z).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + Math.max(1, Math.abs(yy - z)).toFixed(1) + '" fill="' + (i === n - 1 ? '#1D4ED8' : '#98B4F0') + '"/>'; }); }
    else h += '<polyline fill="none" stroke="#1D4ED8" stroke-width="2" vector-effect="non-scaling-stroke" points="' + o.v.map(function (v, i) { return x(i).toFixed(1) + ',' + y(v).toFixed(1); }).join(' ') + '"/><circle cx="' + x(n - 1) + '" cy="' + y(o.v[n - 1]) + '" r="3.5" fill="#1D4ED8"/>';
    return h + '</svg>';
  }
  function cell(s, raw) {
    if (!raw) return '<div class="cb-c"><div class="cb-t">' + s[1] + '</div><div class="cb-na">데이터를 불러오지 못했습니다</div></div>';
    var o = tr(raw, s[2]); if (o.v.length < 2) return '<div class="cb-c"><div class="cb-t">' + s[1] + '</div><div class="cb-na">데이터 부족</div></div>';
    var cap = s[5] === 'bar' ? 14 : 60; if (s[0] === 'DGS10' || s[0] === 'T10Y2Y' || s[0] === 'BAMLH0A0HYM2' || s[0] === 'DTWEXBGS' || s[0] === 'DCOILWTICO') cap = 90;
    var f = { t: o.t.slice(-cap), v: o.v.slice(-cap) }, n = f.v.length, last = f.v[n - 1], prev = f.v[n - 2], df = last - prev;
    var up = df > 0 ? 'u' : df < 0 ? 'dn' : '';
    return '<div class="cb-c"><div class="cb-t">' + s[1] + '</div><div class="cb-v">' + fmt(last, s[4]) + '<small>' + (s[3] === '%' || s[3] === '%p' ? s[3] : '') + '</small><span class="' + up + '">' + (df > 0 ? '▲' : df < 0 ? '▼' : '–') + ' ' + fmt(Math.abs(df), s[4]) + '</span></div>' + spark(f, s[5]) + '<div class="cb-d">' + f.t[n - 1] + ' 기준 · 직전 대비</div></div>';
  }
  function init() {
    var anchor = d.getElementById('us-caprel-card') || d.getElementById('us-corr-card'); if (!anchor || d.getElementById('mk-cb')) return;
    var c = d.createElement('div'); c.className = 'card'; c.id = 'mk-cb';
    c.innerHTML = '<details' + (innerWidth > 900 ? ' open' : '') + '><summary><b>🗂️ 매크로 차트북</b><span class="mut"> 금리·물가·고용·성장 16개 지표 · FRED</span></summary><div class="cb-g" id="cb-g"><div class="cb-na">불러오는 중…</div></div><div class="cb-s">출처: 미 연준 FRED(세인트루이스 연은) 공개 통계. 월간 지표는 발표 시차가 있어 최신 월이 지난달일 수 있습니다. 빨강=직전 대비 상승, 파랑=하락(좋고 나쁨 판단 아님).</div></details>';
    anchor.parentNode.insertBefore(c, anchor.nextSibling);
    var done = false;
    c.querySelector('details').addEventListener('toggle', load); if (innerWidth > 900) load();
    function load() {
      if (done || !c.querySelector('details').open) return; done = true;
      fetch(W + S.map(function (s) { return s[0]; }).join(',')).then(function (r) { return r.json(); }).then(function (j) {
        d.getElementById('cb-g').innerHTML = S.map(function (s) { return cell(s, j[s[0]]); }).join('');
      }).catch(function () { d.getElementById('cb-g').innerHTML = '<div class="cb-na">차트북을 불러오지 못했습니다. (집계 서버 v47 배포 필요)</div>'; });
    }
  }
  var t = setInterval(function () { if (d.getElementById('us-corr-card')) { clearInterval(t); setTimeout(init, 800); } }, 700);
})();
