/* Mr.Kim Signal — 투자자 도구(미국주식): 퇴근 후 체크리스트 · 개장 카운트다운 · 내 계좌(손익·비중 경고) · 종목 비교
   모든 입력값은 이 브라우저(localStorage)에만 저장되며 서버로 보내지 않습니다. 시세는 기존 공용 조회(getJSON)를 사용하고, 값이 없으면 비워 둡니다. */
(function () {
  'use strict';
  if (!document.body || !document.body.classList.contains('pro') || !document.getElementById('pro-brief') && !document.getElementById('my-wl') && !document.getElementById('tick-tbl')) { /* 요약이 늦게 생길 수 있어 계속 진행 */ }
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var store = { get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var RE = /^[A-Z0-9.^=\-]{1,15}$/;
  var LEV = function () { try { return Object.keys(LEV_META).filter(function (k) { return LEV_META[k].L === 3 && !LEV_META[k].kr; }); } catch (e) { return []; } };
  var fmtPct = function (v) { return v == null || !isFinite(v) ? '—' : (v >= 0 ? '+' : '') + v.toFixed(2) + '%'; };
  var fmtUsd = function (v) { return v == null || !isFinite(v) ? '—' : (v < 0 ? '−' : '') + '$' + Math.abs(v).toLocaleString('en-US', { maximumFractionDigits: 0 }); };
  var cls = function (v) { return v == null ? '' : v >= 0 ? 'up' : 'down'; };
  var today = function () { var d = new Date(); return d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0'); };

  /* ───────── 시세 조회(60초 캐시) ───────── */
  var QC = {};
  async function chart(sym, range) {
    var k = sym + '|' + range, c = QC[k]; if (c && Date.now() - c.t < 60000) return c.v;
    try {
      var j = await getJSON('https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(sym) + '?range=' + range + '&interval=1d');
      var r = j.chart.result[0], cl = mkFillClose(r).filter(function (x) { return x != null; });
      var px = (r.meta && r.meta.regularMarketPrice != null) ? r.meta.regularMarketPrice : cl[cl.length - 1];
      var v = { px: px, cl: cl, prev: cl.length >= 2 ? cl[cl.length - 2] : null, meta: r.meta || {} };
      QC[k] = { t: Date.now(), v: v }; return v;
    } catch (e) { return null; }
  }

  /* ───────── 다음 개장 시각(뉴욕 09:30~16:00 · 휴장일은 반영하지 않음) ───────── */
  var NYF = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: false, weekday: 'short' });
  function nyParts(ts) { var p = {}; NYF.formatToParts(new Date(ts)).forEach(function (x) { p[x.type] = x.value; }); p.hour = (+p.hour) % 24; return p; }
  function nyToUtc(y, m, d, hh, mm) { /* 뉴욕 현지 시각 → UTC ms */
    var g = Date.UTC(y, m - 1, d, hh + 5, mm);
    for (var i = 0; i < 3; i++) { var p = nyParts(g), cur = Date.UTC(+p.year, +p.month - 1, +p.day, p.hour, +p.minute), want = Date.UTC(y, m - 1, d, hh, mm); g += want - cur; }
    return g;
  }
  function marketClock() {
    var now = Date.now(), p = nyParts(now), wk = p.weekday;
    var openNow = wk !== 'Sat' && wk !== 'Sun' && (p.hour * 60 + +p.minute) >= 570 && (p.hour * 60 + +p.minute) < 960;
    var y = +p.year, m = +p.month, d = +p.day;
    if (openNow) { return { open: true, until: nyToUtc(y, m, d, 16, 0) - now }; }
    for (var i = 0; i < 8; i++) {
      var base = Date.UTC(y, m - 1, d + i, 12), q = nyParts(base);
      if (q.weekday === 'Sat' || q.weekday === 'Sun') continue;
      var t = nyToUtc(+q.year, +q.month, +q.day, 9, 30);
      if (t > now) return { open: false, at: t, until: t - now };
    }
    return null;
  }
  var hms = function (ms) { var s = Math.max(0, Math.floor(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return (h >= 24 ? Math.floor(h / 24) + '일 ' + (h % 24) : h) + ':' + String(m).padStart(2, '0') + ':' + String(x).padStart(2, '0'); };
  var kst = function (ts) { return new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(ts)); };

  /* ───────── 내 계좌(보유종목) ───────── */
  var HK = 'mk_hold', CK = 'mk_levcap';
  var loadH = function () { try { var o = JSON.parse(store.get(HK) || '{}'); return o && typeof o === 'object' ? o : {}; } catch (e) { return {}; } };
  var saveH = function (o) { store.set(HK, JSON.stringify(o)); };
  var levCap = function () { var v = parseFloat(store.get(CK)); return isFinite(v) && v > 0 && v <= 100 ? v : 30; };
  window.MK_ACCT = null;
  var acctBox;
  function myTickers() { try { var a = JSON.parse(store.get('mk_my_tickers') || '[]'); return Array.isArray(a) ? a.filter(function (t) { return RE.test(t); }) : []; } catch (e) { return []; } }
  function buildAcct() {
    var my = $('#my-wl'); if (!my || $('#mk-acct')) return !!$('#mk-acct');
    acctBox = document.createElement('div'); acctBox.className = 'card'; acctBox.id = 'mk-acct'; acctBox.style.marginTop = '16px';
    acctBox.innerHTML = '<h3><span>💼 내 계좌 · 손익과 3배 비중</span><span class="mut" style="font-weight:400;font-size:11.5px">선택 입력 · 이 브라우저에만 저장</span></h3>' +
      '<div id="ac-sum" class="ac-sum" role="status"></div><div class="scroll"><table class="ac-t"><thead><tr><th>종목</th><th>수량</th><th>평균단가($)</th><th class="n">현재가</th><th class="n">평가금액</th><th class="n">손익</th><th class="n">오늘</th><th class="n">비중</th><th></th></tr></thead><tbody id="ac-b"></tbody></table></div>' +
      '<form class="ac-add" autocomplete="off"><input type="text" id="ac-t" maxlength="15" placeholder="티커 (예: TQQQ)" aria-label="보유 종목 티커"><input type="number" id="ac-q" min="0" step="any" placeholder="수량" aria-label="수량"><input type="number" id="ac-c" min="0" step="any" placeholder="평균단가($)" aria-label="평균단가"><button type="submit">＋ 추가</button></form>' +
      '<label class="ac-cap">3배 ETF 비중 한도 <input type="number" id="ac-cap" min="1" max="100" step="1" aria-label="3배 ETF 비중 한도(%)"> %</label>' +
      '<p class="mut" style="font-size:12px;margin:8px 0 0;line-height:1.6">달러 종목만 합계에 넣습니다(원화 종목 제외). 시세는 지연될 수 있으며 평가금액·손익은 참고용 계산입니다. 3배 ETF 비중은 보유 종목 중 3배 상품의 평가금액 비율입니다.</p>';
    my.after(acctBox);
    $('#ac-cap', acctBox).value = levCap();
    acctBox.querySelector('form').addEventListener('submit', function (e) {
      e.preventDefault(); var t = $('#ac-t').value.trim().toUpperCase(), q = parseFloat($('#ac-q').value), c = parseFloat($('#ac-c').value);
      if (!RE.test(t) || !(q > 0)) return; var h = loadH(); if (Object.keys(h).length >= 30 && !h[t]) return;
      h[t] = { q: q, c: isFinite(c) && c > 0 ? c : null }; saveH(h); $('#ac-t').value = ''; $('#ac-q').value = ''; $('#ac-c').value = ''; refresh(true);
    });
    acctBox.addEventListener('click', function (e) { var b = e.target.closest('button[data-del]'); if (!b) return; var h = loadH(); delete h[b.dataset.del]; saveH(h); refresh(true); });
    $('#ac-cap', acctBox).addEventListener('change', function () { var v = parseFloat(this.value); if (isFinite(v) && v > 0 && v <= 100) store.set(CK, String(v)); refresh(false); });
    return true;
  }
  var lastRows = [];
  async function refresh(fetchNow) {
    if (!buildAcct()) return;
    var h = loadH(), keys = Object.keys(h), tb = $('#ac-b'), sum = $('#ac-sum');
    if (!keys.length) { tb.innerHTML = '<tr><td colspan="9" class="mut" style="padding:14px 6px">보유 종목을 입력하면 평가손익, 오늘 변동, 3배 ETF 비중을 계산합니다. 입력하지 않아도 다른 기능은 그대로 쓸 수 있습니다.</td></tr>'; sum.innerHTML = ''; window.MK_ACCT = null; syncBriefCell(); return; }
    var rows = await Promise.all(keys.map(async function (t) {
      var usd = !/\.(KS|KQ)$/.test(t), c = usd ? await chart(t, '5d') : null;
      return { t: t, q: h[t].q, cost: h[t].c, usd: usd, px: c && c.px, prev: c && c.prev };
    }));
    var tot = 0, totPrev = 0, totCost = 0, costOk = true, levV = 0, lv = LEV();
    rows.forEach(function (r) { if (r.usd && r.px != null) { r.val = r.q * r.px; tot += r.val; if (r.prev != null) totPrev += r.q * r.prev; else totPrev += r.val; if (r.cost != null) totCost += r.q * r.cost; else costOk = false; if (lv.indexOf(r.t) >= 0) levV += r.val; } });
    rows.forEach(function (r) { r.w = r.val != null && tot > 0 ? r.val / tot * 100 : null; r.pl = r.val != null && r.cost != null ? r.val - r.q * r.cost : null; r.plp = r.pl != null ? (r.px / r.cost - 1) * 100 : null; r.day = r.px != null && r.prev ? (r.px / r.prev - 1) * 100 : null; });
    rows.sort(function (a, b) { return (b.val || 0) - (a.val || 0); });
    tb.innerHTML = rows.map(function (r) {
      return '<tr><td><b>' + esc(r.t) + '</b>' + (lv.indexOf(r.t) >= 0 ? ' <span class="ac-l" title="3배 레버리지 상품">3x</span>' : '') + '</td><td>' + r.q + '</td><td>' + (r.cost != null ? r.cost : '—') + '</td><td class="n">' + (r.px != null ? '$' + r.px.toFixed(2) : '—') + '</td><td class="n">' + (r.val != null ? fmtUsd(r.val) : '<span class="na">' + (r.usd ? '—' : '합계 제외') + '</span>') + '</td><td class="n ' + cls(r.plp) + '">' + (r.pl != null ? fmtUsd(r.pl) + ' (' + fmtPct(r.plp) + ')' : '—') + '</td><td class="n ' + cls(r.day) + '">' + fmtPct(r.day) + '</td><td class="n">' + (r.w != null ? r.w.toFixed(1) + '%' : '—') + '</td><td><button type="button" class="ac-x" data-del="' + esc(r.t) + '" aria-label="' + esc(r.t) + ' 삭제">✕</button></td></tr>';
    }).join('');
    var dayPct = tot > 0 && totPrev > 0 ? (tot / totPrev - 1) * 100 : null, dayUsd = tot - totPrev, levPct = tot > 0 ? levV / tot * 100 : null, cap = levCap();
    var plAll = costOk && totCost > 0 ? tot - totCost : null;
    var alerts = [];
    if (levPct != null && levPct > cap) alerts.push('3배 ETF 비중 ' + levPct.toFixed(0) + '%가 한도 ' + cap + '%를 넘었습니다');
    rows.forEach(function (r) { if (r.day != null && r.day <= -7) alerts.push(r.t + ' 오늘 ' + r.day.toFixed(1) + '%'); });
    sum.innerHTML = '<div><small>오늘 내 계좌</small><b class="' + cls(dayPct) + '">' + fmtPct(dayPct) + '</b><span>' + (tot > 0 ? fmtUsd(dayUsd) : '') + '</span></div><div><small>총 평가금액</small><b>' + (tot > 0 ? fmtUsd(tot) : '—') + '</b><span>' + (plAll != null ? '누적 ' + fmtUsd(plAll) : '단가 미입력 종목 있음') + '</span></div><div><small>3배 ETF 비중</small><b class="' + (levPct != null && levPct > cap ? 'down' : '') + '">' + (levPct != null ? levPct.toFixed(0) + '%' : '—') + '</b><span>한도 ' + cap + '%</span></div>' +
      (alerts.length ? '<p class="ac-al" role="alert">⚠ ' + alerts.map(esc).join(' · ') + '</p>' : '');
    lastRows = rows; window.MK_ACCT = { dayPct: dayPct, dayUsd: dayUsd, tot: tot, levPct: levPct, cap: cap, alerts: alerts, rows: rows.map(function (r) { return { t: r.t, day: r.day, w: r.w }; }) };
    syncBriefCell();
  }
  /* 요약 카드에 '내 계좌' 칸(모바일은 맨 앞) */
  function syncBriefCell() {
    var g = $('#pro-brief .pb-grid'); if (!g) return; var a = window.MK_ACCT, c = $('#pb-acct');
    if (!a || a.dayPct == null) { if (c) c.remove(); return; }
    if (!c) { c = document.createElement('a'); c.id = 'pb-acct'; c.className = 'pb-c'; c.href = '#mk-acct'; c.addEventListener('click', function (e) { e.preventDefault(); var t = $$('#pro-toc a').filter(function (x) { return x.textContent.indexOf('관심') === 0; })[0]; if (t) t.click(); setTimeout(function () { var el = $('#mk-acct'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 400); }); g.appendChild(c); }
    c.innerHTML = '<small>오늘 내 계좌</small><b class="' + cls(a.dayPct) + '">' + fmtPct(a.dayPct) + '</b><span>' + (a.levPct != null ? '3배 비중 ' + a.levPct.toFixed(0) + '%' : '') + (a.alerts.length ? ' · ⚠' + a.alerts.length : '') + '</span>';
    g.classList.add('has-acct');
  }

  /* ───────── 퇴근 후 5분 체크리스트 ───────── */
  var eve;
  function buildEve() {
    var br = $('#pro-brief'); if (!br) return false; if ($('#mk-eve')) return true;
    eve = document.createElement('section'); eve.id = 'mk-eve'; eve.setAttribute('aria-label', '퇴근 후 5분 체크리스트');
    eve.innerHTML = '<div class="ev-hd"><b>🌙 퇴근 후 5분 체크리스트</b><span id="ev-clk" class="ev-clk" role="timer" aria-live="off"></span></div><ul id="ev-ls"></ul><p class="ev-nt">자동으로 모은 확인 목록이며 매매 권유가 아닙니다. 미국 휴장일은 반영하지 않아 개장 시각이 다를 수 있습니다.</p>';
    br.after(eve);
    eve.addEventListener('change', function (e) { var cb = e.target.closest('input[type=checkbox]'); if (!cb) return; var k = 'mk_chk_' + today(), o; try { o = JSON.parse(store.get(k) || '{}'); } catch (x) { o = {}; } if (cb.checked) o[cb.dataset.id] = 1; else delete o[cb.dataset.id]; store.set(k, JSON.stringify(o)); cb.closest('li').classList.toggle('done', cb.checked); });
    return true;
  }
  function items() {
    var L = [], A = (typeof mkActionData === 'function') ? mkActionData() : { earn: [], div: [], hot: [], swing: [] };
    var mine = {}; myTickers().forEach(function (t) { mine[t] = 1; }); Object.keys(loadH()).forEach(function (t) { mine[t] = 1; });
    var chip = function (t, v, c) { return '<span class="ev-ch' + (mine[t] ? ' my' : '') + (c ? ' ' + c : '') + '"><b>' + esc(t) + '</b>' + (v ? '<i>' + v + '</i>' : '') + '</span>'; };
    var chips = function (arr, f, n) { n = n || 8; return arr.slice(0, n).map(f).join('') + (arr.length > n ? '<span class="ev-more">외 ' + (arr.length - n) + '</span>' : ''); };
    var dd = function (x) { return x.d === 0 ? '오늘' : 'D-' + x.d; };
    var byMine = function (arr) { return arr.slice().sort(function (x, y) { return (mine[y.t] ? 1 : 0) - (mine[x.t] ? 1 : 0); }); };
    if (A.earn.length) { var ems = A.earn.filter(function (x) { return mine[x.t]; }).length; L.push({ id: 'e', k: '실적', kc: 'k-e', t: '7일 내 실적 발표 ' + A.earn.length + '곳' + (ems ? ' · 내 종목 ' + ems : ''), c: chips(byMine(A.earn), function (x) { return chip(x.t, dd(x), x.d <= 3 ? 'hot' : ''); }), pri: ems ? 1 : 2 }); }
    if (A.div.length) L.push({ id: 'dv', k: '배당락', kc: 'k-d', t: '7일 내 배당락 ' + A.div.length + '곳 — 배당락일 전 매수해야 배당 대상', c: chips(byMine(A.div), function (x) { return chip(x.t, dd(x), x.d <= 3 ? 'hot' : ''); }), pri: 2 });
    if (A.swing.length) L.push({ id: 'sw', k: '시간외', kc: 'k-s', t: '시간외 ±3% 이상 ' + A.swing.length + '종목', c: chips(A.swing, function (x) { return chip(x.t, fmtPct(x.p), x.p > 0 ? 'up' : 'dn'); }), pri: 1 });
    if (A.hot.length) L.push({ id: 'hot', k: '소셜', kc: 'k-h', t: '소셜 글 급증(시간당 15건↑) ' + A.hot.length + '종목', c: chips(A.hot, function (x) { return chip(x.t, '🔥' + x.r.toFixed(0) + '/h'); }), pri: 2 });
    var fg = ($('#pb-fg') || {}).textContent, ev = ($('#pb-ev') || {}).textContent, ev2 = ($('#pb-ev2') || {}).textContent;
    if (ev && ev !== '--') L.push({ id: 'ca', k: '일정', kc: 'k-c', t: '다음 주요 일정: <b>' + esc(ev) + '</b>', c: ev2 ? '<span class="ev-sub">' + esc(ev2) + '</span>' : '', pri: 2 });
    if (fg && fg !== '--') L.push({ id: 'fg', k: '공탐', kc: 'k-f', t: '공포탐욕 <b>' + esc(fg) + '</b>', c: '<span class="ev-sub">분할 규칙을 지킬 구간인지 확인</span>', pri: 3 });
    var a = window.MK_ACCT;
    if (a) { a.alerts.forEach(function (t, i) { L.push({ id: 'ac' + i, k: '계좌', kc: 'k-a', t: esc(t), c: '', pri: 0 }); }); if (!a.alerts.length) L.push({ id: 'ac-ok', k: '계좌', kc: 'k-a', t: '내 계좌 오늘 <b class="' + cls(a.dayPct) + '">' + fmtPct(a.dayPct) + '</b>', c: a.levPct != null ? '<span class="ev-sub">3배 비중 ' + a.levPct.toFixed(0) + '% (한도 ' + a.cap + '%)</span>' : '', pri: 3 }); }
    else L.push({ id: 'ac-no', k: '계좌', kc: 'k-a', t: '보유 종목을 입력하면 손익과 3배 ETF 비중을 확인합니다', c: '<span class="ev-sub">관심종목 아래 “내 계좌”에 입력</span>', pri: 4 });
    L.sort(function (x, y) { return x.pri - y.pri; }); return L;
  }
  var evSig = '';
  function renderEve() {
    if (!buildEve()) return;
    var mc = marketClock(), clk = $('#ev-clk');
    if (mc && clk) clk.innerHTML = mc.open ? '<span class="ev-o">정규장 진행 중</span> 마감까지 ' + hms(mc.until) : '다음 개장 <b>' + kst(mc.at) + '</b> KST · ' + hms(mc.until) + ' 남음';
    var L = items(), sig = JSON.stringify(L.map(function (x) { return x.id + x.t + x.c; }));
    if (sig === evSig) return; evSig = sig;
    var o; try { o = JSON.parse(store.get('mk_chk_' + today()) || '{}'); } catch (e) { o = {}; }
    $('#ev-ls').innerHTML = L.map(function (x) { return '<li class="' + (o[x.id] ? 'done' : '') + '"><label><input type="checkbox" data-id="' + x.id + '"' + (o[x.id] ? ' checked' : '') + '><span class="ev-b"><span class="ev-h"><em class="ev-k ' + x.kc + '">' + x.k + '</em><span class="ev-t">' + x.t + '</span></span>' + (x.c ? '<span class="ev-c">' + x.c + '</span>' : '') + '</span></label></li>'; }).join('');
  }

  /* ───────── 종목 비교(최대 3개) ───────── */
  function buildCmp() {
    var base = $('#mk-acct') || $('#my-wl'); if (!base) return false; if ($('#mk-cmp')) return true;
    var my = myTickers(), d = my.length ? my.slice(0, 3) : ['NVDA', 'AAPL', 'MSFT'];
    var box = document.createElement('div'); box.className = 'card'; box.id = 'mk-cmp'; box.style.marginTop = '16px';
    box.innerHTML = '<h3><span>🔍 종목 비교</span><span class="mut" style="font-weight:400;font-size:11.5px">최대 3개 · 시세 기준 계산</span></h3>' +
      '<form class="cm-f" autocomplete="off">' + [0, 1, 2].map(function (i) { return '<input type="text" maxlength="15" value="' + esc(d[i] || '') + '" placeholder="티커 ' + (i + 1) + '" aria-label="비교 종목 ' + (i + 1) + '">'; }).join('') + '<button type="submit">비교</button></form><div id="cm-r" class="scroll"></div>';
    base.after(box);
    box.querySelector('form').addEventListener('submit', function (e) { e.preventDefault(); runCmp(); });
    return true;
  }
  async function runCmp() {
    var ts = $$('#mk-cmp input[type=text]').map(function (i) { return i.value.trim().toUpperCase(); }).filter(function (t, i, a) { return RE.test(t) && a.indexOf(t) === i; });
    var host = $('#cm-r'); if (!ts.length) { host.innerHTML = ''; return; }
    host.innerHTML = '<p class="mut" style="font-size:12.5px">불러오는 중…</p>';
    var D = (window.MK_DATA ? window.MK_DATA() : {}) || {};
    var cs = await Promise.all(ts.map(function (t) { return chart(t, '1y'); }));
    var pc = function (a, b) { return a != null && b ? (a / b - 1) * 100 : null; };
    var col = ts.map(function (t, i) {
      var c = cs[i]; if (!c || !c.cl.length) return { t: t, none: true };
      var cl = c.cl, n = cl.length, hi = Math.max.apply(null, cl), px = c.px;
      var e = D.earn && D.earn[t], dv = D.div && D.div[t];
      return { t: t, px: px, d1: pc(px, c.prev), w: n > 5 ? pc(px, cl[n - 6]) : null, m: n > 21 ? pc(px, cl[n - 22]) : null, y: pc(px, cl[0]), hi: pc(px, hi), er: e && e.ts ? earnDays(e.ts) : null, dv: dv && dv.ex ? earnDays(dv.ex) : null };
    });
    var row = function (l, f) { return '<tr><th scope="row">' + l + '</th>' + col.map(function (c) { return '<td class="n">' + (c.none ? '—' : f(c)) + '</td>'; }).join('') + '</tr>'; };
    var pcell = function (v) { return '<span class="' + cls(v) + '">' + fmtPct(v) + '</span>'; };
    var dd = function (v) { return v == null ? '<span class="na">미확인</span>' : v < 0 ? '지남' : 'D-' + (v === 0 ? 'day' : v); };
    host.innerHTML = '<table class="cm-t"><thead><tr><th></th>' + col.map(function (c) { return '<th class="n">' + esc(c.t) + (c.none ? '<br><small class="na">조회 실패</small>' : '') + '</th>'; }).join('') + '</tr></thead><tbody>' +
      row('현재가', function (c) { return '$' + c.px.toFixed(2); }) + row('1일', function (c) { return pcell(c.d1); }) + row('1주', function (c) { return pcell(c.w); }) + row('1개월', function (c) { return pcell(c.m); }) + row('1년', function (c) { return pcell(c.y); }) + row('52주 고점 대비', function (c) { return pcell(c.hi); }) + row('다음 실적', function (c) { return dd(c.er); }) + row('배당락', function (c) { return dd(c.dv); }) +
      '</tbody></table><p class="mut" style="font-size:12px;margin:8px 0 0">실적·배당락은 시총 상위·관심종목 조회 범위 안의 종목만 표시됩니다(그 밖은 “미확인”, 임의 값 없음). 기간 수익률은 일봉 종가 기준 근사입니다.</p>';
  }

  /* ───────── 구동 ───────── */
  var tries = 0;
  (function boot() {
    buildEve(); var ok = buildAcct(); if (ok) buildCmp();
    if ((!$('#mk-eve') || !$('#mk-acct') || !$('#mk-cmp')) && ++tries < 30) { setTimeout(boot, 700); return; }
    refresh(true); renderEve(); setInterval(renderEve, 1000);
    setInterval(function () { if (!document.hidden && Object.keys(loadH()).length) refresh(true); }, 60000);
    document.addEventListener('visibilitychange', function () { if (!document.hidden && Object.keys(loadH()).length) refresh(true); });
  })();
})();
