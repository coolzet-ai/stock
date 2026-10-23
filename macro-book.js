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
  var CAT = { DGS10: 'm', DFEDTARU: 'm', T10Y2Y: 'm', BAMLH0A0HYM2: 'm', DTWEXBGS: 'm', DCOILWTICO: 'm', UNRATE: 'j', PAYEMS: 'j', ICSA: 'j', CPIAUCSL: 'p', PCEPI: 'p', A191RL1Q225SBEA: 'gr', RSXFS: 'gr', INDPRO: 'gr', UMCSENT: 'gr', M2SL: 'p' };
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
  var STORE = {};
  function fmt(n, dg) { return n.toLocaleString('en-US', { minimumFractionDigits: dg, maximumFractionDigits: dg }); }
  function spark(o, kind) {
    var n = o.v.length, W2 = 300, H = 90, P = 6, mn = Math.min.apply(null, o.v), mx = Math.max.apply(null, o.v);
    if (kind === 'bar') { mn = Math.min(mn, 0); mx = Math.max(mx, 0); }
    var rg = (mx - mn) || 1, y = function (v) { return P + (H - 2 * P) * (1 - (v - mn) / rg); }, x = function (i) { return P + (W2 - 2 * P) * (n === 1 ? .5 : i / (n - 1)); };
    var h = '<svg viewBox="0 0 ' + W2 + ' ' + H + '" class="cb-svg" preserveAspectRatio="none" aria-hidden="true">';
    if (kind === 'bar') { var bw = Math.max(2, (W2 - 2 * P) / n * .7), z = y(0); h += '<line x1="0" x2="' + W2 + '" y1="' + z + '" y2="' + z + '" stroke="#d0d5dd"/>'; o.v.forEach(function (v, i) { var yy = y(v); h += '<rect x="' + (x(i) - bw / 2).toFixed(1) + '" y="' + Math.min(yy, z).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + Math.max(1, Math.abs(yy - z)).toFixed(1) + '" fill="' + (i === n - 1 ? '#0B6B3A' : '#8FD3AE') + '" data-i="' + i + '" class="cb-bar"/>'; }); }
    else h += '<polyline fill="none" stroke="#1D4ED8" stroke-width="2" vector-effect="non-scaling-stroke" points="' + o.v.map(function (v, i) { return x(i).toFixed(1) + ',' + y(v).toFixed(1); }).join(' ') + '"/><circle cx="' + x(n - 1) + '" cy="' + y(o.v[n - 1]) + '" r="3.5" fill="#1D4ED8"/>';
    return h + '</svg>';
  }
  function cell(s, raw, wn) {
    if (!raw) return '<div class="cb-c"><div class="cb-t">' + s[1] + '</div><div class="cb-na">데이터를 불러오지 못했습니다</div></div>';
    var o = tr(raw, s[2]); if (o.v.length < 2) return '<div class="cb-c"><div class="cb-t">' + s[1] + '</div><div class="cb-na">데이터 부족</div></div>';
    var cap = s[5] === 'bar' ? 14 : 60; if (s[0] === 'DGS10' || s[0] === 'T10Y2Y' || s[0] === 'BAMLH0A0HYM2' || s[0] === 'DTWEXBGS' || s[0] === 'DCOILWTICO') cap = 90;
    var f = { t: o.t.slice(-cap), v: o.v.slice(-cap) }, n = f.v.length, last = f.v[n - 1], prev = f.v[n - 2], df = last - prev;
    var up = df > 0 ? 'u' : df < 0 ? 'dn' : '';
    var mn = Math.min.apply(null, f.v), mx = Math.max.apply(null, f.v), cat = CAT[s[0]] || 'm';
    STORE[s[0]] = { t: f.t, v: f.v, dg: s[4], u: (s[3] === '%' || s[3] === '%p') ? s[3] : (s[3] === '$' ? '$' : ''), kind: s[5], mn: s[5] === 'bar' ? Math.min(mn, 0) : mn, mx: s[5] === 'bar' ? Math.max(mx, 0) : mx };
    return '<div class="cb-c cb-' + cat + (wn ? ' cb-w' + (wn[0] === '경고' ? 'r' : 'y') : '') + '">' + (wn ? '<div class="cb-wn ' + (wn[0] === '경고' ? 'r' : 'y') + '">' + (wn[0] === '경고' ? '🔴 경고' : '🟡 주의') + ' · ' + wn[1] + '</div>' : '') + '<div class="cb-t">' + s[1] + '</div><div class="cb-v">' + fmt(last, s[4]) + '<small>' + (s[3] === '%' || s[3] === '%p' ? s[3] : '') + '</small><span class="cb-chg ' + up + '">' + (df > 0 ? '▲' : df < 0 ? '▼' : '–') + ' ' + fmt(Math.abs(df), s[4]) + '</span></div>' + '<div class="cb-sp" data-id="' + s[0] + '">' + spark(f, s[5]) + '<div class="cb-guide"></div><div class="cb-dot"></div><div class="cb-tip"></div></div><div class="cb-mm"><span>최저 ' + fmt(mn, s[4]) + '</span><span>최고 ' + fmt(mx, s[4]) + '</span></div><div class="cb-d">' + f.t[n - 1] + ' 기준 · 직전 대비</div></div>';
  }

  /* 주의 판정: [수준('주의'|'경고'), 이유] 또는 null — 기준은 화면 하단에 공개 */
  function pct(v, k) { var n = v.length; return n > k ? (v[n - 1] / v[n - 1 - k] - 1) * 100 : null; }
  var RULE = {
    DGS10: function (v) { var x = v[v.length - 1]; return x >= 5 ? ['경고', '5% 이상 · 고금리 부담'] : x >= 4.5 ? ['주의', '4.5% 이상 · 금리 부담'] : null; },
    DFEDTARU: function (v) { var x = v[v.length - 1]; return x >= 5 ? ['주의', '정책금리 5% 이상'] : null; },
    T10Y2Y: function (v) { var x = v[v.length - 1]; return x < 0 ? ['경고', '장단기 금리 역전(경기 침체 신호)'] : x < 0.2 ? ['주의', '금리차 0.2%p 미만'] : null; },
    BAMLH0A0HYM2: function (v) { var x = v[v.length - 1]; return x >= 5 ? ['경고', '신용 스트레스 5%p 이상'] : x >= 4 ? ['주의', '하이일드 스프레드 4%p 이상'] : null; },
    DTWEXBGS: function (v) { var c = pct(v, 21); return c != null && Math.abs(c) >= 3 ? ['주의', '한 달 변동 ' + (c > 0 ? '+' : '') + c.toFixed(1) + '% (달러 ' + (c > 0 ? '강세' : '약세') + ')'] : null; },
    DCOILWTICO: function (v) { var x = v[v.length - 1]; return x >= 100 ? ['주의', '유가 $100 이상 · 물가 압력'] : x <= 55 ? ['주의', '유가 $55 이하 · 수요 둔화 신호'] : null; },
    UNRATE: function (v) { var n = v.length, x = v[n - 1], lo = Math.min.apply(null, v.slice(-12)); return x - lo >= 0.5 ? ['경고', '12개월 저점 대비 +' + (x - lo).toFixed(1) + '%p (침체 신호)'] : x >= 5 ? ['주의', '실업률 5% 이상'] : null; },
    PAYEMS: function (v) { var x = v[v.length - 1]; return x < 0 ? ['경고', '고용 감소'] : x < 50 ? ['주의', '고용 증가 5만 명 미만(둔화)'] : null; },
    ICSA: function (v) { var x = v[v.length - 1]; return x >= 300000 ? ['경고', '청구 30만 건 이상'] : x >= 250000 ? ['주의', '청구 25만 건 이상'] : null; },
    CPIAUCSL: function (v) { var x = v[v.length - 1]; return x >= 4 ? ['경고', '물가 4% 이상'] : x >= 3 ? ['주의', '물가 3% 이상(목표 2% 상회)'] : null; },
    PCEPI: function (v) { var x = v[v.length - 1]; return x >= 3 ? ['경고', 'PCE 3% 이상'] : x >= 2.5 ? ['주의', 'PCE 2.5% 이상(목표 2% 상회)'] : null; },
    A191RL1Q225SBEA: function (v) { var x = v[v.length - 1]; return x < 0 ? ['경고', '역성장'] : x < 1 ? ['주의', '성장률 1% 미만'] : null; },
    RSXFS: function (v) { var x = v[v.length - 1]; return x < 0 ? ['경고', '소매판매 감소'] : x < 2 ? ['주의', '소매판매 증가 2% 미만'] : null; },
    INDPRO: function (v) { var x = v[v.length - 1]; return x <= -0.5 ? ['경고', '산업생산 급감'] : x < 0 ? ['주의', '산업생산 감소'] : null; },
    UMCSENT: function (v) { var x = v[v.length - 1]; return x < 55 ? ['경고', '소비심리 55 미만'] : x < 65 ? ['주의', '소비심리 65 미만'] : null; },
    M2SL: function (v) { var x = v[v.length - 1]; return x < 0 ? ['주의', '통화량 감소'] : x > 8 ? ['주의', '통화량 8% 초과 증가'] : null; }
  };
  var CRIT = '주의 판정 기준: 10년물 4.5%↑ · 정책금리 5%↑ · 금리차 0.2%p↓(역전은 경고) · 하이일드 4%p↑ · 달러 한 달 ±3% · WTI $100↑/$55↓ · 실업률 5%↑ 또는 저점 대비 +0.5%p · 고용 5만↓ · 청구 25만↑ · CPI 3%↑ · PCE 2.5%↑ · GDP 1%↓ · 소매판매 2%↓ · 산업생산 감소 · 소비심리 65↓ · M2 감소/8%↑. 참고용 기준이며 투자 판단을 대신하지 않습니다.';
  function warnOf(s, raw) { if (!raw || !RULE[s[0]]) return null; var o = tr(raw, s[2]); if (o.v.length < 2) return null; try { return RULE[s[0]](o.v, o.t); } catch (e) { return null; } }
  function render(host, j) {
    var W2 = [], OK = [], NA = [];
    S.forEach(function (s) { var w = warnOf(s, j[s[0]]); if (!j[s[0]]) NA.push(s); else if (w) { W2.push([s, w]); } else OK.push(s); });
    W2.sort(function (a, b) { return (a[1][0] === '경고' ? 0 : 1) - (b[1][0] === '경고' ? 0 : 1); });
    var h = W2.length ? '<div class="cb-sub">⚠ 주의가 필요한 지표 ' + W2.length + '개</div><div class="cb-gg">' + W2.map(function (x) { return cell(x[0], j[x[0][0]], x[1]); }).join('') + '</div>' : '<div class="cb-ok">✅ 현재 주의가 필요한 지표가 없습니다.</div>';
    var rest = OK.concat(NA);
    if (rest.length) h += '<details class="cb-more"><summary>나머지 ' + rest.length + '개 지표 상세보기 (정상 범위)</summary><div class="cb-gg">' + rest.map(function (s) { return cell(s, j[s[0]], null); }).join('') + '</div></details>';
    h += '<details class="cb-crit"><summary>주의 판정 기준 보기</summary><p>' + CRIT + '</p></details>';
    host.innerHTML = h;
  }
  function init() {
    var anchor = d.getElementById('pro-sector'); if (!anchor || d.getElementById('mk-cb')) return;
    var c = d.createElement('div'); c.className = 'card'; c.id = 'mk-cb';
    c.innerHTML = '<details' + (innerWidth > 900 ? ' open' : '') + '><summary><b>🗂️ 매크로 차트북</b><span class="mut"> 금리·물가·고용·성장 16개 지표 · FRED</span></summary><div class="cb-g" id="cb-g"><div class="cb-na">불러오는 중…</div></div><div class="cb-s">출처: 미 연준 FRED(세인트루이스 연은) 공개 통계. 월간 지표는 발표 시차가 있어 최신 월이 지난달일 수 있습니다. 빨강=직전 대비 상승, 파랑=하락(좋고 나쁨 판단 아님).</div></details>';
    anchor.parentNode.insertBefore(c, anchor); c.style.marginTop = '12px';

    /* 마우스 롤오버/터치: 해당 시점의 날짜·값·직전 대비를 표시하고 막대는 진한 녹색으로 강조 */
    var g = c.querySelector('#cb-g'), lastBar = null, SW = 300, SH = 90, SP = 6;
    function clear(sp) { if (!sp) return; sp.classList.remove('on'); if (lastBar) { lastBar.setAttribute('fill', lastBar.getAttribute('data-f')); lastBar = null; } }
    function move(e) {
      var sp = e.target.closest && e.target.closest('.cb-sp'); g.querySelectorAll('.cb-sp.on').forEach(function (o) { if (o !== sp) clear(o); }); if (!sp) return;
      var D = STORE[sp.getAttribute('data-id')]; if (!D) return;
      var rc = sp.getBoundingClientRect(), n = D.v.length, fx = (e.clientX - rc.left) / rc.width * SW, i = Math.round((fx - SP) / (SW - 2 * SP) * (n - 1)); i = Math.max(0, Math.min(n - 1, i));
      var xp = (SP + (SW - 2 * SP) * (n === 1 ? .5 : i / (n - 1))) / SW * 100, rg = (D.mx - D.mn) || 1, yp = (SP + (SH - 2 * SP) * (1 - (D.v[i] - D.mn) / rg)) / SH * 100;
      var prev = i ? D.v[i] - D.v[i - 1] : null, tip = sp.querySelector('.cb-tip'), guide = sp.querySelector('.cb-guide'), dot = sp.querySelector('.cb-dot');
      tip.innerHTML = '<b>' + D.t[i] + '</b><span>' + (D.u === '$' ? '$' : '') + fmt(D.v[i], D.dg) + (D.u === '%' || D.u === '%p' ? D.u : '') + '</span>' + (prev == null ? '' : '<em class="' + (prev > 0 ? 'u' : prev < 0 ? 'dn' : '') + '">' + (prev > 0 ? '▲ ' : prev < 0 ? '▼ ' : '– ') + fmt(Math.abs(prev), D.dg) + ' (직전 대비)</em>');
      tip.style.left = Math.max(18, Math.min(82, xp)) + '%'; guide.style.left = xp + '%';
      if (D.kind === 'bar') { dot.style.display = 'none'; var rs = sp.querySelectorAll('rect.cb-bar'); if (lastBar) lastBar.setAttribute('fill', lastBar.getAttribute('data-f')); lastBar = rs[i]; if (lastBar) { if (!lastBar.getAttribute('data-f')) lastBar.setAttribute('data-f', lastBar.getAttribute('fill')); lastBar.setAttribute('fill', '#067647'); } }
      else { dot.style.display = 'block'; dot.style.left = xp + '%'; dot.style.top = yp + '%'; }
      sp.classList.add('on');
    }
    g.addEventListener('pointermove', move); g.addEventListener('pointerdown', move);
    g.addEventListener('pointerleave', function () { g.querySelectorAll('.cb-sp.on').forEach(clear); });
    var done = false;
    var seen = false; c.querySelector('details').addEventListener('toggle', function () { if (seen) load(); });
    if (innerWidth > 900) {
      if ('IntersectionObserver' in window) { var io = new IntersectionObserver(function (es) { if (es.some(function (e) { return e.isIntersecting; })) { io.disconnect(); seen = true; load(); } }, { rootMargin: '400px 0px' }); io.observe(c); }
      else { seen = true; load(); }
    } else seen = true;
    function load() {
      if (done || !c.querySelector('details').open) return; done = true;
      var host = d.getElementById('cb-g'), why = '';
      var attempt = function (k) {
        fetch(W + S.map(function (s) { return s[0]; }).join(',')).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }).then(function (j) {
          var okn = S.filter(function (s) { return j[s[0]]; }).length; if (!okn) throw new Error('FRED 응답 없음');
          render(host, j);
          /* 일시적으로 비어 온 지표만 잠시 뒤 한 번 더 요청해 채운다 */
          var miss = S.filter(function (s) { return !j[s[0]]; }).map(function (s) { return s[0]; });
          if (miss.length) setTimeout(function () { fetch(W + miss.join(',')).then(function (r) { return r.json(); }).then(function (k2) { Object.keys(k2).forEach(function (id) { if (k2[id]) j[id] = k2[id]; }); render(host, j); }).catch(function () {}); }, 2500);
        }).catch(function (e) { if (k < 1) { setTimeout(function () { attempt(k + 1); }, 3000); } else { why = e && e.message || '연결 실패'; fallback(host, why); } });
      };
      attempt(0);
    }
    /* 집계 서버 v47(/fred)이 아직 없을 때: 기존 서버로 받을 수 있는 시장가격형 지표 4개만 먼저 보여준다 */
    function fallback(host, why) {
      var FB = [['^TNX', '미 국채 10년 (%)', 'lvl', '%', 2, 'line'], ['DX-Y.NYB', '달러인덱스 (Index)', 'lvl', '', 1, 'line'], ['CL=F', 'WTI 유가 ($/배럴)', 'lvl', '$', 1, 'line'], ['GC=F', '금 선물 ($/온스)', 'lvl', '$', 0, 'line']];
      Promise.all(FB.map(function (s) {
        return fetch('https://ai.coolzet.workers.dev/?url=' + encodeURIComponent('https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(s[0]) + '?range=6mo&interval=1d')).then(function (r) { return r.json(); }).then(function (j) {
          var r0 = j.chart.result[0], cl = r0.indicators.quote[0].close, o = { t: [], v: [] }; r0.timestamp.forEach(function (t, i) { if (cl[i] != null) { o.t.push(new Date(t * 1000).toISOString().slice(0, 10)); o.v.push(cl[i]); } }); return o;
        }).catch(function () { return null; });
      })).then(function (arr) {
        host.innerHTML = '<div class="cb-na" style="grid-column:1/-1">⚠ 금리·물가·고용 등 FRED 지표를 불러오지 못했습니다 (' + why + '). 집계 서버(Worker) v47 배포 후 16개 지표가 모두 표시됩니다. 우선 시장가격 지표만 보여드립니다.</div><div class="cb-gg">' + FB.map(function (s, i) { return cell(s, arr[i]); }).join('') + '</div>';
      });
    }
  }
  var t = setInterval(function () { if (d.getElementById('pro-sector')) { clearInterval(t); setTimeout(init, 300); } }, 700);
})();
