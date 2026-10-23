/* bigmoney.js — 미국주식 '큰손 동향' (Shadow DOM 로 페이지의 다른 CSS·스크립트와 분리)
   ① 선물 포지션: Worker /cot (CFTC Commitments of Traders TFF)
   ② 옵션: Worker /opt-flow (CBOE 15분 지연 시세) — 풋/콜 비율, 거래량>미결제약정 후보 (방향 미구분)
   ③ 13F: Worker /sec-13f (SEC EDGAR) — 분기별 기관 보유 종목 (롱 포지션만, 45일 지연)
   '김군해석'은 위 숫자에서 규칙으로 뽑은 해설이다(투자 권유 아님). 데이터를 못 받으면 사유를 표시하고 값은 만들지 않는다. */
(function () {
  'use strict';
  var W = 'https://ai.coolzet.workers.dev';
  var d = document, root = null;
  var CSS = [
    ':host{display:block;font-size:14px;line-height:1.5;color:inherit}',
    '*{box-sizing:border-box}',
    '.bm-tabs{display:flex;gap:6px;flex-wrap:wrap;margin:10px 0}',
    '.bm-tabs button{min-height:40px;padding:0 16px;border:1px solid #d6dbd8;border-radius:999px;background:#fff;color:#1e3932;font:inherit;font-weight:700;font-size:14px;cursor:pointer}',
    '.bm-tabs button[aria-pressed=true]{background:#006241;border-color:#006241;color:#fff}',
    '.bm-pane[hidden]{display:none}.bm-pane{min-height:120px}',
    '.bm-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px}',
    '.bm-card{background:#fff;border:1px solid #e3e8e5;border-radius:12px;padding:14px 16px;min-width:0;color:#1c2933}',
    '.bm-card h3{margin:0 0 4px;font-size:15px}',
    '.bm-big{font-size:22px;font-weight:800;line-height:1.3}',
    '.bm-up{color:#B42318}.bm-dn{color:#1D4ED8}',
    '.bm-mut{color:#55625d;font-size:13px;line-height:1.5}',
    '.bm-row{display:flex;justify-content:space-between;gap:8px;font-size:13px;padding:3px 0;border-top:1px dashed #e8ece9}',
    '.bm-note{margin:10px 0 0;padding:10px 12px;border-radius:8px;background:#f3f6f4;font-size:13px;line-height:1.55;color:#4a5651}',
    '.bm-sel{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:4px 0 10px}',
    'select{min-height:40px;padding:0 10px;border:1px solid #d6dbd8;border-radius:8px;background:#fff;color:#1c2933;font:inherit;font-size:14px;max-width:100%}',
    'table{width:100%;border-collapse:collapse;font-size:13px}',
    'th,td{padding:6px;text-align:right;border-bottom:1px solid #eef1ef;white-space:nowrap}th:first-child,td:first-child{text-align:left;white-space:normal}',
    '.bm-tw{overflow-x:auto}',
    'svg.bm-spark{width:100%;height:36px;display:block;margin-top:6px}',
    '.bm-err{padding:12px;border-radius:8px;background:#fff6f4;border:1px solid #f3cfc8;font-size:13px;line-height:1.6;color:#1c2933}',
    '.bm-kim{margin-top:10px;padding:10px 12px;border-radius:10px;background:#eef6f1;border:1px solid #cfe3d6;color:#1c2933}',
    '.bm-kim.bm-kim-big{margin-top:12px;padding:12px 14px}',
    '.bm-kim .kh{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-weight:800;font-size:13.5px;margin-bottom:4px}',
    '.bm-kim .kc{display:inline-block;padding:1px 9px;border-radius:999px;background:#006241;color:#fff;font-size:12px;font-weight:700}',
    '.bm-kim .kc.warn{background:#B54708}.bm-kim .kc.dn{background:#1D4ED8}.bm-kim .kc.up{background:#B42318}.bm-kim .kc.gray{background:#667085}',
    '.bm-kim p{margin:3px 0 0;font-size:13px;line-height:1.6}',
    ':host([data-dark]) .bm-card,:host([data-dark]) select,:host([data-dark]) .bm-tabs button{background:#1b2220;border-color:#33403b;color:#e6ece9}',
    ':host([data-dark]) .bm-tabs button[aria-pressed=true]{background:#00a36c;border-color:#00a36c;color:#06130d}',
    ':host([data-dark]) .bm-note{background:#222b28;color:#b7c3be}:host([data-dark]) .bm-mut{color:#a9b6b0}',
    ':host([data-dark]) .bm-up{color:#ff8a7a}:host([data-dark]) .bm-dn{color:#7fa8ff}',
    ':host([data-dark]) .bm-kim{background:#1d2a24;border-color:#2e4439;color:#e6ece9}:host([data-dark]) .bm-err{background:#2a1c1a;border-color:#5b3029;color:#e6ece9}',
    ':host([data-dark]) th,:host([data-dark]) td{border-color:#2a3330}:host([data-dark]) .bm-row{border-color:#2a3330}'
  ].join('\n');

  function el(t, c, x) { var e = d.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
  function nf(n) { return n == null || isNaN(n) ? '-' : Math.round(n).toLocaleString('ko-KR'); }
  function sg(n) { return (n > 0 ? '+' : '') + nf(n); }
  function cls(n) { return n > 0 ? 'bm-up' : n < 0 ? 'bm-dn' : ''; }
  function usd(n) { if (n == null) return '-'; var a = Math.abs(n); return a >= 1e9 ? '$' + (n / 1e9).toFixed(1) + 'B' : a >= 1e6 ? '$' + (n / 1e6).toFixed(0) + 'M' : '$' + nf(n); }
  function ymd(s) { return String(s || '').slice(0, 10); }
  function jget(u, ms) {
    var c = new AbortController(), t = setTimeout(function () { c.abort(); }, ms || 20000);
    return fetch(u, { signal: c.signal }).then(function (r) { clearTimeout(t); if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
  }
  function err(box, msg) { box.textContent = ''; box.appendChild(el('div', 'bm-err', msg)); }
  function spark(vals) {
    var n = vals.length; if (n < 2) return null;
    var mn = Math.min.apply(0, vals), mx = Math.max.apply(0, vals), r = mx - mn || 1, p = [];
    vals.forEach(function (v, i) { p.push((i / (n - 1) * 200).toFixed(1) + ',' + (34 - (v - mn) / r * 30).toFixed(1)); });
    var NS = 'http://www.w3.org/2000/svg', s = d.createElementNS(NS, 'svg'); s.setAttribute('viewBox', '0 0 200 36'); s.setAttribute('preserveAspectRatio', 'none'); s.setAttribute('class', 'bm-spark'); s.setAttribute('aria-hidden', 'true');
    var pl = d.createElementNS(NS, 'polyline'); pl.setAttribute('points', p.join(' ')); pl.setAttribute('fill', 'none'); pl.setAttribute('stroke', '#00a36c'); pl.setAttribute('stroke-width', '2'); pl.setAttribute('vector-effect', 'non-scaling-stroke');
    s.appendChild(pl); return s;
  }
  /* 김군해석 박스: chip = [문구, 색(''|warn|dn|up|gray)], lines = 문장 배열 */
  function kim(chip, lines, big) {
    var b = el('div', 'bm-kim' + (big ? ' bm-kim-big' : '')), h = el('div', 'kh'); h.appendChild(el('span', '', '🧭 김군해석'));
    if (chip) h.appendChild(el('span', 'kc ' + (chip[1] || ''), chip[0])); b.appendChild(h);
    lines.forEach(function (x) { if (x) b.appendChild(el('p', '', x)); }); return b;
  }
  var pct1 = function (x) { return (x >= 0 ? '+' : '') + x.toFixed(1) + '%'; };

  /* ───── ① 선물 포지션 ───── */
  var MK = [['13874A', 'S&P 500 선물 (E-mini)', 'S&P500'], ['209742', '나스닥100 선물 (E-mini)', '나스닥100'], ['239742', '러셀2000 선물 (E-mini)', '러셀2000']];
  var cotDone = false;
  function kimFut(name, lev, am, dl) {
    var n = lev.length, cur = lev[n - 1], prev = n > 1 ? lev[n - 2] : null, chg = prev != null ? cur - prev : 0;
    var below = 0; for (var i = 0; i < n - 1; i++) if (lev[i] < cur) below++;
    var p = n > 7 ? below / (n - 1) * 100 : null, tag, chip, L = [];
    var state = cur < 0 ? '헤지펀드·CTA 성격의 레버리지 펀드가 순매도(숏) 우위' : '레버리지 펀드가 순매수(롱) 우위';
    var move = cur < 0 ? (chg > 0 ? '지난주보다 숏을 ' + nf(chg) + '계약 줄였습니다(숏 청산 쪽).' : chg < 0 ? '지난주보다 숏을 ' + nf(-chg) + '계약 늘렸습니다(하락 베팅 확대).' : '지난주와 같습니다.')
      : (chg > 0 ? '지난주보다 롱을 ' + nf(chg) + '계약 늘렸습니다.' : chg < 0 ? '지난주보다 롱을 ' + nf(-chg) + '계약 줄였습니다.' : '지난주와 같습니다.');
    L.push(name + ': ' + state + '입니다. ' + move);
    if (p != null && p <= 10) { chip = ['숏 쏠림 주의', 'warn']; L.push('최근 ' + n + '주 중 숏이 가장 많은 쪽(하위 ' + Math.round(p) + '%)이라 한쪽으로 쏠려 있습니다. 한쪽 쏠림은 반대로 움직일 때 포지션 청산으로 변동성이 커질 수 있습니다.'); }
    else if (p != null && p >= 90) { chip = ['롱 쏠림 주의', 'warn']; L.push('최근 ' + n + '주 중 롱이 가장 많은 쪽(상위 ' + Math.round(100 - p) + '%)이라 과열 쏠림입니다. 조정이 오면 되돌림이 커질 수 있습니다.'); }
    else if (cur < 0) chip = chg > 0 ? ['숏 청산 중', 'up'] : chg < 0 ? ['숏 확대', 'dn'] : ['중립', 'gray'];
    else chip = chg > 0 ? ['롱 확대', 'up'] : chg < 0 ? ['롱 축소', 'dn'] : ['중립', 'gray'];
    if (p != null && p > 10 && p < 90) L.push('최근 ' + n + '주 범위에서는 중간대(하위 ' + Math.round(p) + '%)로 극단적 쏠림은 아닙니다.');
    if (am > 0 && cur < 0) L.push('자산운용사는 순매수(' + sg(am) + ')인데 레버리지 펀드는 순매도입니다. 장기 자금의 롱을 헤지하거나 현물-선물 차익거래(베이시스) 때문에 생기는 숏일 수 있어, 숏 포지션을 곧바로 약세 신호로 읽지는 않습니다.');
    return { chip: chip, lines: L, dir: cur < 0 ? (chg > 0 ? 'cover' : chg < 0 ? 'short' : 'flat') : (chg > 0 ? 'long' : chg < 0 ? 'cut' : 'flat'), ext: p != null && (p <= 10 || p >= 90) };
  }
  function loadCot(box) {
    if (cotDone) return; cotDone = true; box.textContent = '불러오는 중…';
    jget(W + '/cot', 30000).then(function (j) {
      if (j.error) throw new Error(j.error); var rows = j.rows || [];
      var by = {}; rows.forEach(function (r) { var k = r.cftc_contract_market_code; (by[k] = by[k] || {})[ymd(r.report_date_as_yyyy_mm_dd)] = r; });
      box.textContent = ''; var g = el('div', 'bm-grid'), any = false, last = '', ks = [];
      MK.forEach(function (m) {
        var o = by[m[0]]; if (!o) return;
        var ds = Object.keys(o).sort().slice(-26); if (!ds.length) return; any = true;
        var cur = o[ds[ds.length - 1]]; last = ds[ds.length - 1];
        var net = function (r, a, b) { return (+r[a] || 0) - (+r[b] || 0); };
        var lev = ds.map(function (k) { return net(o[k], 'lev_money_positions_long', 'lev_money_positions_short'); });
        var am = net(cur, 'asset_mgr_positions_long', 'asset_mgr_positions_short'), dl = net(cur, 'dealer_positions_long_all', 'dealer_positions_short_all');
        var L0 = lev[lev.length - 1], L1 = lev.length > 1 ? lev[lev.length - 2] : null;
        var c = el('div', 'bm-card'); c.appendChild(el('h3', '', m[1]));
        c.appendChild(el('div', 'bm-mut', '레버리지 펀드(헤지펀드·CTA 성격) 순포지션'));
        c.appendChild(el('div', 'bm-big ' + cls(L0), sg(L0) + ' 계약'));
        c.appendChild(el('div', 'bm-mut', (L0 > 0 ? '순매수 우위' : L0 < 0 ? '순매도 우위' : '중립') + (L1 != null ? ' · 전주 대비 ' + sg(L0 - L1) : '')));
        var sp = spark(lev); if (sp) c.appendChild(sp);
        c.appendChild(el('div', 'bm-mut', '최근 ' + ds.length + '주 범위 ' + sg(Math.min.apply(0, lev)) + ' ~ ' + sg(Math.max.apply(0, lev))));
        [['자산운용사 순포지션', am], ['딜러(은행) 순포지션', dl]].forEach(function (x) { var r = el('div', 'bm-row'); r.appendChild(el('span', '', x[0])); r.appendChild(el('b', cls(x[1]), sg(x[1]))); c.appendChild(r); });
        var k = kimFut(m[2], lev, am, dl); ks.push(k); c.appendChild(kim(k.chip, k.lines)); g.appendChild(c);
      });
      if (!any) return err(box, 'CFTC에서 해당 선물 데이터를 찾지 못했습니다.');
      box.appendChild(g);
      var cov = ks.filter(function (k) { return k.dir === 'cover' || k.dir === 'long'; }).length, sh = ks.filter(function (k) { return k.dir === 'short' || k.dir === 'cut'; }).length, ex = ks.filter(function (k) { return k.ext; }).length;
      var sum = [ks.length + '개 지수선물 중 ' + cov + '개는 레버리지 펀드가 상승 쪽(숏 청산·롱 확대)으로, ' + sh + '개는 하락 쪽(숏 확대·롱 축소)으로 움직였습니다.'];
      if (ex) sum.push(ex + '개 시장에서 최근 범위의 극단에 포지션이 쏠려 있습니다. 쏠림은 방향이 맞아도 청산 구간에서 변동성이 커집니다.');
      sum.push('선물 포지션은 화요일 기준·3일 지연 자료라 오늘 시장과는 시차가 있고, 가격 방향을 맞히는 신호가 아니라 "누가 어느 쪽에 얼마나 쏠려 있는지"를 보는 참고 자료입니다.');
      box.appendChild(kim([cov > sh ? '상승 쪽 우세' : sh > cov ? '하락 쪽 우세' : '엇갈림', cov > sh ? 'up' : sh > cov ? 'dn' : 'gray'], sum, true));
      box.appendChild(el('p', 'bm-note', '기준일 ' + last + '(화요일 마감) · 금요일 발표라 3일 늦습니다. "순포지션"은 롱−숏 계약 수이며, 레버리지 펀드를 CTA·헤지펀드의 대리 지표로 쓴 것입니다(CTA만 따로 공시되지는 않습니다). 매매 권유가 아닌 참고 자료입니다. 출처: CFTC Commitments of Traders'));
    }).catch(function (e) { cotDone = false; err(box, 'CFTC 데이터를 불러오지 못했습니다 (' + e.message + '). Worker에 새 경로(/cot)가 배포돼 있어야 표시됩니다.'); });
  }

  /* ───── ② 옵션 ───── */
  var OSYM = ['SPY', 'QQQ', 'NVDA', 'TSLA', 'AAPL', 'SOXL'], ETF = { SPY: 1, QQQ: 1, SOXL: 1, IWM: 1, DIA: 1 };
  function daysTo(exp, asOf) { var a = new Date(exp + 'T00:00:00Z').getTime(), b = new Date(String(asOf || '').slice(0, 10) + 'T00:00:00Z').getTime(); return isNaN(a) || isNaN(b) ? null : Math.round((a - b) / 86400000); }
  function kimOpt(j, sym) {
    var etf = !!ETF[sym], r = j.pcVol, L = [], chip;
    if (r == null) return kim(['판단 불가', 'gray'], ['풋/콜 비율을 계산할 거래량이 없습니다.']);
    var T = etf ? [0.8, 1.2, 1.6] : [0.5, 0.9, 1.3];
    if (r < T[0]) { chip = ['콜 쏠림', 'up']; L.push('거래량 풋/콜 ' + r.toFixed(2) + ' — 콜(상승 베팅) 거래가 풋보다 훨씬 많아 낙관·투기 심리가 강한 편입니다. 지나치게 쏠리면 과열 신호가 되기도 합니다.'); }
    else if (r < T[1]) { chip = ['평소 수준', 'gray']; L.push('거래량 풋/콜 ' + r.toFixed(2) + ' — ' + (etf ? '지수 ETF의 평소 범위' : '개별 종목의 평소 범위') + '로 뚜렷한 쏠림은 없습니다.'); }
    else if (r < T[2]) { chip = [etf ? '헤지 증가' : '풋 비중 높음', 'warn']; L.push('거래량 풋/콜 ' + r.toFixed(2) + ' — 풋 거래 비중이 평소보다 높습니다. ' + (etf ? '지수 ETF는 보유 주식을 보호하는 헤지 거래가 많아 반드시 하락 베팅은 아닙니다.' : '하락 베팅이나 보호 목적 거래가 늘었다는 뜻입니다.')); }
    else { chip = ['풋 급증', 'dn']; L.push('거래량 풋/콜 ' + r.toFixed(2) + ' — 풋 거래가 매우 많습니다. 불안·급락 대비 수요가 커진 상태이며, 심리가 한쪽으로 몰린 뒤에는 반대로 반등이 나오기도 합니다.'); }
    if (j.pcOI != null) L.push('누적(미결제약정) 기준 풋/콜은 ' + j.pcOI.toFixed(2) + '입니다. 누적 포지션은 ' + (etf ? '지수 ETF의 경우 구조적으로 풋이 많아' : '개별 종목은 보통 1 안팎이라') + ' 오늘 거래량 비율과 함께 봐야 합니다.');
    var u = j.unusual || [], cv = 0, pv = 0; u.forEach(function (x) { if (x.type === 'C') cv += x.vol; else pv += x.vol; });
    if (u.length) {
      var top = u[0], dist = j.last ? (top.strike / j.last - 1) * 100 : null, dd = daysTo(top.exp, j.asOf);
      var share = (cv + pv) ? Math.round(pv / (cv + pv) * 100) : null;
      L.push('거래량이 미결제약정을 넘은 상위 ' + u.length + '개 중 풋이 ' + share + '%, 콜이 ' + (100 - share) + '%입니다. 가장 많이 거래된 계약은 ' + top.exp.slice(5) + ' 만기 ' + (top.type === 'C' ? '콜' : '풋') + ' ' + top.strike + (dist != null ? '(현재가 대비 ' + pct1(dist) + ')' : '') + '입니다.');
      if (dd != null && dd <= 7 && dist != null && Math.abs(dist) >= 2) L.push('만기가 ' + dd + '일 안쪽이고 현재가에서 먼 행사가라, ' + (top.type === 'P' ? '단기 급락에 대비한 헤지나 베팅' : '단기 급등에 거는 투기') + ' 성격일 가능성이 있습니다.');
    } else L.push('거래량이 미결제약정을 크게 넘는 계약(당일 만기 제외)은 눈에 띄지 않습니다.');
    L.push('방향(사는 쪽/파는 쪽)은 알 수 없는 15분 지연 자료라, 큰손의 매수 확정이 아니라 "거래가 몰린 곳"을 보는 용도입니다.');
    return kim(chip, L, true);
  }
  function loadOpt(box, sym) {
    box.textContent = '불러오는 중…';
    jget(W + '/opt-flow?sym=' + encodeURIComponent(sym), 30000).then(function (j) {
      if (j.error) throw new Error(j.error);
      box.textContent = ''; var g = el('div', 'bm-grid');
      var c1 = el('div', 'bm-card'); c1.appendChild(el('h3', '', sym + ' 풋/콜 비율'));
      c1.appendChild(el('div', 'bm-mut', '거래량 기준 (풋÷콜)')); c1.appendChild(el('div', 'bm-big', j.pcVol != null ? j.pcVol.toFixed(2) : '-'));
      [['콜 거래량', j.callVol], ['풋 거래량', j.putVol], ['미결제약정 풋/콜', j.pcOI != null ? j.pcOI.toFixed(2) : null]].forEach(function (x) { var r = el('div', 'bm-row'); r.appendChild(el('span', '', x[0])); r.appendChild(el('b', '', typeof x[1] === 'number' ? nf(x[1]) : (x[1] == null ? '-' : x[1]))); c1.appendChild(r); });
      c1.appendChild(el('div', 'bm-mut', '1 초과면 풋(하락 대비·헤지) 거래가 더 많습니다.'));
      g.appendChild(c1);
      var c2 = el('div', 'bm-card'); c2.appendChild(el('h3', '', '거래량 급증 후보 (거래량 > 미결제약정)'));
      if (!j.unusual || !j.unusual.length) c2.appendChild(el('div', 'bm-mut', '조건(거래량 2,000계약 이상 · 미결제약정 초과 · 당일 만기 제외)에 맞는 항목이 없습니다.'));
      else { var tw = el('div', 'bm-tw'), t = d.createElement('table'); var h = d.createElement('tr'); ['종목(만기·행사가)', '거래량', '미결제'].forEach(function (x) { h.appendChild(el('th', '', x)); }); t.appendChild(h);
        j.unusual.forEach(function (u) { var tr = d.createElement('tr'); var a = el('td', ''); a.appendChild(el('b', u.type === 'C' ? 'bm-up' : 'bm-dn', u.type === 'C' ? '콜 ' : '풋 ')); a.appendChild(d.createTextNode(u.exp.slice(5) + ' · ' + u.strike)); tr.appendChild(a); tr.appendChild(el('td', '', nf(u.vol))); tr.appendChild(el('td', '', nf(u.oi))); t.appendChild(tr); });
        tw.appendChild(t); c2.appendChild(tw); }
      g.appendChild(c2); box.appendChild(g);
      box.appendChild(kimOpt(j, sym));
      box.appendChild(el('p', 'bm-note', '기준 ' + (j.asOf || '-') + ' (ET, 15분 지연) · 실제 대량 체결(블록·스윕) 데이터는 유료 서비스에서만 제공됩니다. 출처: Cboe Delayed Quotes'));
    }).catch(function (e) { err(box, '옵션 데이터를 불러오지 못했습니다 (' + e.message + '). Worker에 새 경로(/opt-flow)가 배포돼 있어야 표시됩니다.'); });
  }

  /* ───── ③ 13F ───── */
  var MGR = [['1067983', '버크셔 해서웨이 (워런 버핏)'], ['1649339', '사이언 (마이클 버리)'], ['1336528', '퍼싱 스퀘어 (빌 애크먼)'], ['1536411', '듀케인 (드러켄밀러)'], ['1350694', '브리지워터'], ['1029160', '소로스 펀드'], ['1697748', 'ARK 인베스트'], ['1423053', '시타델'], ['1167483', '타이거 글로벌']];
  var CH = { add: ['추가', 'bm-up'], cut: ['축소', 'bm-dn'], same: ['유지', ''], new: ['신규', 'bm-up'] };
  function kim13f(j) {
    var rows = j.rows || [], L = [], chip, top3 = 0, i;
    for (i = 0; i < Math.min(3, rows.length); i++) top3 += rows[i].weight || 0;
    var conc = j.count >= 200 ? '보유 ' + nf(j.count) + '종목으로 시장 전체에 넓게 분산한 대형 운용사 스타일입니다(상위 3종목 ' + top3.toFixed(0) + '%).'
      : top3 >= 50 ? '상위 3종목이 ' + top3.toFixed(0) + '%를 차지하는 집중형 포트폴리오(' + nf(j.count) + '종목)입니다. 몇 종목의 움직임이 성과를 좌우합니다.'
      : top3 >= 30 ? '상위 3종목 ' + top3.toFixed(0) + '% · 총 ' + nf(j.count) + '종목으로 중간 정도의 집중도입니다.'
      : '상위 3종목 ' + top3.toFixed(0) + '% · 총 ' + nf(j.count) + '종목으로 분산된 편입니다.';
    L.push(conc);
    if (j.prevPeriod) {
      var adds = rows.filter(function (r) { return r.chg === 'add' && r.pct >= 10; }).sort(function (a, b) { return b.pct - a.pct; }),
        cuts = rows.filter(function (r) { return r.chg === 'cut' && r.pct <= -10; }).sort(function (a, b) { return a.pct - b.pct; }),
        news = rows.filter(function (r) { return r.chg === 'new'; }), same = rows.filter(function (r) { return r.chg === 'same'; });
      var nm = function (r) { var m = /\(CAP STK CL ([A-C])\)/.exec(r.name); return r.name.replace(/\s*\(.*\)$/, '') + (m ? ' ' + m[1] + '주' : ''); }, parts = [];
      if (news.length) parts.push('신규 편입 ' + news.slice(0, 3).map(nm).join(', ') + (news.length > 3 ? ' 외 ' + (news.length - 3) : ''));
      if (adds.length) parts.push('비중 확대 ' + adds.slice(0, 2).map(function (r) { return nm(r) + ' ' + pct1(r.pct); }).join(', '));
      if (cuts.length) parts.push('비중 축소 ' + cuts.slice(0, 2).map(function (r) { return nm(r) + ' ' + pct1(r.pct); }).join(', '));
      if (j.exits && j.exits.length) parts.push('전량 정리 ' + j.exits.slice(0, 3).map(nm).join(', ') + (j.exits.length > 3 ? ' 외 ' + (j.exits.length - 3) : ''));
      L.push(parts.length ? '직전 분기(' + j.prevPeriod + ') 대비 상위 15종목에서 ' + parts.join(' · ') + '입니다.' : '직전 분기 대비 상위 종목에 큰 변화(±10% 이상, 신규·정리)는 없습니다.' + (same.length ? ' 상위 15종목 중 ' + same.length + '개는 주식 수가 그대로입니다.' : ''));
      var net = 0; rows.forEach(function (r) { if (r.chg === 'new') net += r.value; else if ((r.chg === 'add' || r.chg === 'cut') && r.pct != null) net += r.value - r.value / (1 + r.pct / 100); });
      (j.exits || []).forEach(function (x) { net -= x.value; });
      var np = j.total ? net / j.total * 100 : 0;
      if (Math.abs(np) < 1) chip = ['변화 적음', 'gray']; else if (np > 0) chip = ['매수 우위', 'up']; else chip = ['매도 우위', 'dn'];
      L.push('상위 종목의 주식 수 변화를 현재 평가액으로 환산하면 순' + (np >= 0 ? '매수' : '매도') + ' 규모는 총 평가액의 약 ' + Math.abs(np).toFixed(1) + '%입니다(가격 변동은 제외한 추정치).');
    } else chip = ['비교 불가', 'gray'];
    var days = Math.round((Date.now() - new Date(j.filed + 'T00:00:00Z').getTime()) / 86400000);
    if (days > 140) { chip = ['공시 오래됨', 'warn']; L.push('이 공시는 ' + days + '일 전(' + j.filed + ')에 제출된 마지막 13F입니다. 이후 변화는 반영돼 있지 않고 최신 공시가 아닐 수 있습니다.'); }
    else L.push('분기 말(' + j.period + ') 기준 롱 포지션만 보여 주고 공시까지 ' + Math.round((new Date(j.filed) - new Date(j.period)) / 86400000) + '일이 걸렸습니다. 지금 보유와 다를 수 있고 숏·파생 포지션은 보이지 않습니다.');
    return kim(chip, L, true);
  }
  function loadF(box, cik) {
    box.textContent = '불러오는 중… (처음엔 10초가량 걸릴 수 있습니다)';
    jget(W + '/sec-13f?cik=' + cik, 45000).then(function (j) {
      if (j.error) throw new Error(j.error);
      box.textContent = ''; var c = el('div', 'bm-card');
      c.appendChild(el('h3', '', j.manager)); c.appendChild(el('div', 'bm-mut', '분기 ' + j.period + ' 기준 · 공시일 ' + j.filed + ' · 총 ' + usd(j.total) + ' · ' + nf(j.count) + '종목'));
      var tw = el('div', 'bm-tw'), t = d.createElement('table'), h = d.createElement('tr'); ['종목', '평가액', '비중', '전분기 대비'].forEach(function (x) { h.appendChild(el('th', '', x)); }); t.appendChild(h);
      j.rows.forEach(function (r) { var tr = d.createElement('tr'); tr.appendChild(el('td', '', r.name)); tr.appendChild(el('td', '', usd(r.value))); tr.appendChild(el('td', '', r.weight != null ? r.weight.toFixed(1) + '%' : '-'));
        var cc = r.chg ? CH[r.chg] : null, td = el('td', cc ? cc[1] : '', cc ? cc[0] + (r.pct != null && r.chg !== 'same' && r.chg !== 'new' ? ' ' + (r.pct > 0 ? '+' : '') + r.pct.toFixed(0) + '%' : '') : '-'); tr.appendChild(td); t.appendChild(tr); });
      tw.appendChild(t); c.appendChild(tw);
      if (j.exits && j.exits.length) c.appendChild(el('div', 'bm-mut', '전량 정리(전분기 보유 → 이번 분기 없음): ' + j.exits.map(function (x) { return x.name; }).join(', ')));
      box.appendChild(c); box.appendChild(kim13f(j));
      box.appendChild(el('p', 'bm-note', '"전분기 대비"는 보유 주식 수 변화(%)입니다. 상위 15개만 표시. 출처: SEC EDGAR'));
    }).catch(function (e) { err(box, '13F 데이터를 불러오지 못했습니다 (' + e.message + '). Worker에 새 경로(/sec-13f)가 배포돼 있어야 표시됩니다.'); });
  }

  /* ───── 뼈대 ───── */
  function isDark() { var t = d.documentElement.getAttribute('data-theme'); return t === 'dark' || (t !== 'light' && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches); }
  function build() {
    var sec = d.getElementById('bigmoney'); if (!sec || sec.getAttribute('data-ready')) return; sec.setAttribute('data-ready', '1');
    var host = sec.querySelector('#bm-root');
    if (!host) { host = d.createElement('div'); host.id = 'bm-root'; (sec.querySelector('.wrap') || sec).appendChild(host); }
    /* 다른 CSS가 건드리지 못하게 호스트를 일반 블록으로 고정 */
    host.style.cssText = 'display:block!important;position:relative!important;float:none!important;transform:none!important;height:auto!important;max-height:none!important;overflow:visible!important;width:100%!important;max-width:100%!important;min-height:80px;contain:none!important;columns:auto!important';
    try { root = host.shadowRoot || host.attachShadow({ mode: 'open' }); } catch (e) { root = host; }
    var st = d.createElement('style'); st.textContent = root === host ? CSS.replace(/:host\(\[data-dark\]\)/g, 'body.bm-dark').replace(/:host/g, '#bm-root') : CSS; root.appendChild(st);
    var setDark = function () { if (isDark()) host.setAttribute('data-dark', ''); else host.removeAttribute('data-dark'); }; setDark();
    try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', setDark); new MutationObserver(setDark).observe(d.documentElement, { attributes: true, attributeFilter: ['data-theme'] }); } catch (e) {}
    var wrap = el('div', 'bm'); root.appendChild(wrap);
    var tabs = el('div', 'bm-tabs'); tabs.setAttribute('role', 'group'); tabs.setAttribute('aria-label', '큰손 동향 종류');
    var panes = {}, names = [['cot', '선물 포지션 (CTA·헤지펀드)'], ['opt', '옵션 풋/콜'], ['f13', '기관 13F']];
    names.forEach(function (n, i) { var b = el('button', '', n[1]); b.type = 'button'; b.setAttribute('data-bm', n[0]); b.setAttribute('aria-pressed', i === 0 ? 'true' : 'false'); tabs.appendChild(b); var p = el('div', 'bm-pane'); if (i) p.hidden = true; panes[n[0]] = p; });
    wrap.appendChild(tabs); Object.keys(panes).forEach(function (k) { wrap.appendChild(panes[k]); });
    var cotBox = el('div'), optSel = el('div', 'bm-sel'), optBox = el('div'), fSel = el('div', 'bm-sel'), fBox = el('div');
    panes.cot.appendChild(cotBox);
    var os = d.createElement('select'); os.setAttribute('aria-label', '옵션 종목'); OSYM.forEach(function (s) { var o = el('option', '', s); o.value = s; os.appendChild(o); }); optSel.appendChild(el('span', 'bm-mut', '종목')); optSel.appendChild(os);
    panes.opt.appendChild(optSel); panes.opt.appendChild(optBox); os.onchange = function () { loadOpt(optBox, os.value); };
    var fs = d.createElement('select'); fs.setAttribute('aria-label', '기관 선택'); MGR.forEach(function (m) { var o = el('option', '', m[1]); o.value = m[0]; fs.appendChild(o); }); fSel.appendChild(el('span', 'bm-mut', '기관')); fSel.appendChild(fs);
    panes.f13.appendChild(fSel); panes.f13.appendChild(fBox); fs.onchange = function () { loadF(fBox, fs.value); };
    var loaded = { opt: 0, f13: 0 };
    function open(k) {
      if (k === 'cot') loadCot(cotBox);
      else if (k === 'opt' && !loaded.opt) { loaded.opt = 1; loadOpt(optBox, os.value); }
      else if (k === 'f13' && !loaded.f13) { loaded.f13 = 1; loadF(fBox, fs.value); }
    }
    tabs.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-bm]'); if (!b) return; var k = b.getAttribute('data-bm');
      Array.prototype.forEach.call(tabs.children, function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      Object.keys(panes).forEach(function (n) { panes[n].hidden = n !== k; }); open(k);
    });
    if ('IntersectionObserver' in window) { var io = new IntersectionObserver(function (es) { if (es.some(function (x) { return x.isIntersecting; })) { io.disconnect(); open('cot'); } }, { rootMargin: '300px' }); io.observe(host); } else open('cot');
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', build); else build();
})();
