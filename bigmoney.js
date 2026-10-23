/* bigmoney.js — 미국주식 '큰손 동향'
   ① 선물 포지션: Worker /cot (CFTC Commitments of Traders TFF) (매주 금요일 갱신, 화요일 기준)
   ② 옵션: Worker /opt-flow (CBOE 15분 지연 시세) — 풋/콜 비율, 거래량>미결제약정 후보 (방향 미구분)
   ③ 13F: Worker /sec-13f (SEC EDGAR) — 분기별 기관 보유 종목 (롱 포지션만, 45일 지연)
   데이터를 못 받으면 빈칸 대신 사유를 표시한다. 값은 만들어 내지 않는다. */
(function () {
  'use strict';
  var W = 'https://ai.coolzet.workers.dev';
    var d = document;
  var $ = function (s, r) { return (r || d).querySelector(s); };
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
  function err(box, msg) { box.textContent = ''; var e = el('div', 'bm-err', msg); box.appendChild(e); }
  function spark(vals) {
    var n = vals.length; if (n < 2) return null;
    var mn = Math.min.apply(0, vals), mx = Math.max.apply(0, vals), r = mx - mn || 1, p = [];
    vals.forEach(function (v, i) { p.push((i / (n - 1) * 200).toFixed(1) + ',' + (34 - (v - mn) / r * 30).toFixed(1)); });
    var s = d.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 200 36'); s.setAttribute('preserveAspectRatio', 'none'); s.setAttribute('class', 'bm-spark'); s.setAttribute('aria-hidden', 'true');
    var pl = d.createElementNS('http://www.w3.org/2000/svg', 'polyline'); pl.setAttribute('points', p.join(' ')); pl.setAttribute('fill', 'none'); pl.setAttribute('stroke', '#006241'); pl.setAttribute('stroke-width', '2'); pl.setAttribute('vector-effect', 'non-scaling-stroke');
    s.appendChild(pl); return s;
  }

  /* ───── ① 선물 포지션 ───── */
  var MK = [['13874A', 'S&P 500 선물 (E-mini)'], ['209742', '나스닥100 선물 (E-mini)'], ['239742', '러셀2000 선물 (E-mini)']];
  var cotDone = false;
  function loadCot(box) {
    if (cotDone) return; cotDone = true; box.textContent = '불러오는 중…';
    jget(W + '/cot', 30000).then(function (j) {
      if (j.error) throw new Error(j.error); var rows = j.rows || [];
      var by = {}; rows.forEach(function (r) { var k = r.cftc_contract_market_code; (by[k] = by[k] || {})[ymd(r.report_date_as_yyyy_mm_dd)] = r; });
      box.textContent = ''; var g = el('div', 'bm-grid'), any = false, last = '';
      MK.forEach(function (m) {
        var o = by[m[0]]; if (!o) return;
        var ds = Object.keys(o).sort().slice(-13); if (!ds.length) return; any = true;
        var cur = o[ds[ds.length - 1]], prev = ds.length > 1 ? o[ds[ds.length - 2]] : null; last = ds[ds.length - 1];
        var net = function (r, a, b) { return (+r[a] || 0) - (+r[b] || 0); };
        var lev = net(cur, 'lev_money_positions_long', 'lev_money_positions_short'), levP = prev ? net(prev, 'lev_money_positions_long', 'lev_money_positions_short') : null;
        var am = net(cur, 'asset_mgr_positions_long', 'asset_mgr_positions_short'), dl = net(cur, 'dealer_positions_long_all', 'dealer_positions_short_all');
        var c = el('div', 'bm-card'); c.appendChild(el('h3', '', m[1]));
        c.appendChild(el('div', 'bm-mut', '레버리지 펀드(헤지펀드·CTA 성격) 순포지션'));
        c.appendChild(el('div', 'bm-big ' + cls(lev), sg(lev) + ' 계약'));
        c.appendChild(el('div', 'bm-mut', (lev > 0 ? '순매수 우위' : lev < 0 ? '순매도 우위' : '중립') + (levP != null ? ' · 전주 대비 ' + sg(lev - levP) : '')));
        var sp = spark(ds.map(function (k) { return net(o[k], 'lev_money_positions_long', 'lev_money_positions_short'); })); if (sp) c.appendChild(sp);
        var rk = ds.map(function (k) { return net(o[k], 'lev_money_positions_long', 'lev_money_positions_short'); }), mn = Math.min.apply(0, rk), mx = Math.max.apply(0, rk);
        c.appendChild(el('div', 'bm-mut', '최근 ' + ds.length + '주 범위 ' + sg(mn) + ' ~ ' + sg(mx)));
        [['자산운용사', am], ['딜러(은행)', dl]].forEach(function (x) { var r = el('div', 'bm-row'); r.appendChild(el('span', '', x[0] + ' 순포지션')); r.appendChild(el('b', cls(x[1]), sg(x[1]))); c.appendChild(r); });
        g.appendChild(c);
      });
      if (!any) return err(box, 'CFTC에서 해당 선물 데이터를 찾지 못했습니다.');
      box.appendChild(g);
      box.appendChild(el('p', 'bm-note', '기준일 ' + last + '(화요일 마감) · 금요일 발표라 3일 늦습니다. "순포지션"은 롱−숏 계약 수이며, 레버리지 펀드를 CTA·헤지펀드의 대리 지표로 쓴 것입니다(CTA만 따로 공시되지는 않습니다). 매매 권유가 아닌 참고 자료입니다. 출처: CFTC Commitments of Traders'));
    }).catch(function (e) { cotDone = false; err(box, 'CFTC 데이터를 불러오지 못했습니다 (' + e.message + '). Worker에 새 경로(/cot)가 배포돼 있어야 표시됩니다.'); });
  }

  /* ───── ② 옵션 ───── */
  var OSYM = ['SPY', 'QQQ', 'NVDA', 'TSLA', 'AAPL', 'SOXL'];
  function loadOpt(box, sym) {
    box.textContent = '불러오는 중…';
    jget(W + '/opt-flow?sym=' + encodeURIComponent(sym), 30000).then(function (j) {
      if (j.error) throw new Error(j.error);
      box.textContent = ''; var g = el('div', 'bm-grid');
      var c1 = el('div', 'bm-card'); c1.appendChild(el('h3', '', sym + ' 풋/콜 비율'));
      c1.appendChild(el('div', 'bm-mut', '거래량 기준 (풋÷콜)')); c1.appendChild(el('div', 'bm-big', j.pcVol != null ? j.pcVol.toFixed(2) : '-'));
      [['콜 거래량', j.callVol], ['풋 거래량', j.putVol], ['미결제약정 풋/콜', j.pcOI != null ? j.pcOI.toFixed(2) : null]].forEach(function (x) { var r = el('div', 'bm-row'); r.appendChild(el('span', '', x[0])); r.appendChild(el('b', '', typeof x[1] === 'number' ? nf(x[1]) : (x[1] == null ? '-' : x[1]))); c1.appendChild(r); });
      c1.appendChild(el('div', 'bm-mut', '1 초과면 풋(하락 대비·헤지) 거래가 더 많습니다. 지수 ETF는 헤지 거래가 많아 단독 신호로 보기 어렵습니다.'));
      g.appendChild(c1);
      var c2 = el('div', 'bm-card'); c2.appendChild(el('h3', '', '거래량 급증 후보 (거래량 > 미결제약정)'));
      if (!j.unusual || !j.unusual.length) c2.appendChild(el('div', 'bm-mut', '조건(거래량 2,000계약 이상 · 미결제약정 초과 · 당일 만기 제외)에 맞는 항목이 없습니다.'));
      else { var tw = el('div', 'bm-tw'), t = d.createElement('table'); var h = d.createElement('tr'); ['종목(만기·행사가)', '거래량', '미결제'].forEach(function (x) { h.appendChild(el('th', '', x)); }); t.appendChild(h);
        j.unusual.forEach(function (u) { var tr = d.createElement('tr'); var a = el('td', ''); a.appendChild(el('b', u.type === 'C' ? 'bm-up' : 'bm-dn', u.type === 'C' ? '콜 ' : '풋 ')); a.appendChild(d.createTextNode(u.exp.slice(5) + ' · ' + u.strike)); tr.appendChild(a); tr.appendChild(el('td', '', nf(u.vol))); tr.appendChild(el('td', '', nf(u.oi))); t.appendChild(tr); });
        tw.appendChild(t); c2.appendChild(tw); }
      g.appendChild(c2); box.appendChild(g);
      box.appendChild(el('p', 'bm-note', '기준 ' + (j.asOf || '-') + ' (ET, 15분 지연) · 매수/매도 방향을 알 수 없어 "고래의 매수"가 아니라 거래가 몰린 후보일 뿐입니다. 실제 대량 체결(블록·스윕) 데이터는 유료 서비스에서만 제공됩니다. 출처: Cboe Delayed Quotes'));
    }).catch(function (e) { err(box, '옵션 데이터를 불러오지 못했습니다 (' + e.message + '). Worker에 새 경로(/opt-flow)가 배포돼 있어야 표시됩니다.'); });
  }

  /* ───── ③ 13F ───── */
  var MGR = [['1067983', '버크셔 해서웨이 (워런 버핏)'], ['1649339', '사이언 (마이클 버리)'], ['1336528', '퍼싱 스퀘어 (빌 애크먼)'], ['1536411', '듀케인 (드러켄밀러)'], ['1350694', '브리지워터'], ['1029160', '소로스 펀드'], ['1697748', 'ARK 인베스트'], ['1423053', '시타델'], ['1167483', '타이거 글로벌']];
  var CH = { add: ['추가', 'bm-up'], cut: ['축소', 'bm-dn'], same: ['유지', ''], new: ['신규', 'bm-up'] };
  function loadF(box, cik) {
    box.textContent = '불러오는 중… (처음엔 10초가량 걸릴 수 있습니다)';
    jget(W + '/sec-13f?cik=' + cik, 45000).then(function (j) {
      if (j.error) throw new Error(j.error);
      box.textContent = ''; var c = el('div', 'bm-card');
      c.appendChild(el('h3', '', j.manager)); c.appendChild(el('div', 'bm-mut', '분기 ' + j.period + ' 기준 · 공시일 ' + j.filed + ' · 총 ' + usd(j.total) + ' · ' + j.count + '종목'));
      var tw = el('div', 'bm-tw'), t = d.createElement('table'), h = d.createElement('tr'); ['종목', '평가액', '비중', '전분기 대비'].forEach(function (x) { h.appendChild(el('th', '', x)); }); t.appendChild(h);
      j.rows.forEach(function (r) { var tr = d.createElement('tr'); tr.appendChild(el('td', '', r.name)); tr.appendChild(el('td', '', usd(r.value))); tr.appendChild(el('td', '', r.weight != null ? r.weight.toFixed(1) + '%' : '-'));
        var cc = r.chg ? CH[r.chg] : null, td = el('td', cc ? cc[1] : '', cc ? cc[0] + (r.pct != null && r.chg !== 'same' && r.chg !== 'new' ? ' ' + (r.pct > 0 ? '+' : '') + r.pct.toFixed(0) + '%' : '') : '-'); tr.appendChild(td); t.appendChild(tr); });
      tw.appendChild(t); c.appendChild(tw);
      if (j.exits && j.exits.length) c.appendChild(el('div', 'bm-mut', '전량 정리(전분기 보유 → 이번 분기 없음): ' + j.exits.map(function (x) { return x.name; }).join(', ')));
      box.appendChild(c); box.appendChild(el('p', 'bm-note', '"전분기 대비"는 보유 주식 수 변화(%)입니다. 13F는 분기말 기준 롱(매수) 포지션만 공시되고 45일 늦게 나오므로 현재 보유와 다를 수 있습니다. 상위 15개만 표시. 출처: SEC EDGAR'));
    }).catch(function (e) { err(box, '13F 데이터를 불러오지 못했습니다 (' + e.message + '). Worker에 새 경로(/sec-13f)가 배포돼 있어야 표시됩니다.'); });
  }

  /* ───── 뼈대 ───── */
  function build() {
    var sec = $('#bigmoney'); if (!sec || sec.getAttribute('data-ready')) return; sec.setAttribute('data-ready', '1');
    var wrap = $('.wrap', sec) || sec;
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
    var loaded = { cot: 0, opt: 0, f13: 0 };
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
    /* 화면에 가까워졌을 때 처음 한 번만 불러온다 */
    if ('IntersectionObserver' in window) { var io = new IntersectionObserver(function (es) { if (es.some(function (x) { return x.isIntersecting; })) { io.disconnect(); open('cot'); } }, { rootMargin: '300px' }); io.observe(sec); } else open('cot');
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', build); else build();
})();
