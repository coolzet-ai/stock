/* 한국주식 실시간 시세 — 네이버 증권(모바일 API, 기존 Worker 프록시 경유)으로
   · 코스피·코스닥 지수 → 오늘의 시장 요약·시세 띠·공포탐욕(모멘텀) 게이지
   · 시가총액 TOP10(코스피·코스닥)·11~20위·레버리지 ETF·KOSPI200 편입편출 종목 가격·등락률
   을 정규장(평일 09:00~15:30 KST) 동안 사용자가 정한 주기(15·30·60초)로 갱신한다. 실시간 스위치(MK_LIVE)가 꺼져 있으면 요청을 하지 않는다. 장이 끝나면 한 번 마감값으로 맞추고 5분 간격으로 늦춘다.
   받지 못하면 임의 값을 만들지 않고 기존(야후) 값을 그대로 둔다. */
(function () {
  'use strict';
  var d = document, PROXY = 'https://ai.coolzet.workers.dev/?url=', NAVER = 'https://m.stock.naver.com/api/';
  var live = window.__krLive = { idx: {}, open: null, okAt: 0, fails: 0 };
  var gaugeArgs = null, cycle = 0, busy = false, timer = 0;

  function num(s) { return parseFloat(String(s == null ? '' : s).replace(/,/g, '')); }
  function sgn(code, s) {
    var v = Math.abs(num(s)); if (!isFinite(v)) return NaN;
    return (String(code) === '4' || String(code) === '5' || String(s).trim().charAt(0) === '-') ? -v : v;
  }
  function sessionOpen() { /* 평일 09:00~15:30 KST (공휴일은 네이버 marketStatus 로 보정) */
    var k = new Date(Date.now() + 9 * 3600000), day = k.getUTCDay(), m = k.getUTCHours() * 60 + k.getUTCMinutes();
    return day >= 1 && day <= 5 && m >= 540 && m < 930;
  }
  function getJ(path) {
    var ctl = ('AbortController' in window) ? new AbortController() : null, to = setTimeout(function () { if (ctl) ctl.abort(); }, 9000);
    return fetch(PROXY + encodeURIComponent(NAVER + path), ctl ? { signal: ctl.signal } : {}).then(function (r) { clearTimeout(to); if (!r.ok) throw 0; return r.json(); })
      .catch(function (e) { clearTimeout(to); throw e; });
  }

  /* ── 지수 ── */
  window.__krLiveQuote = function (sym) {
    var q = live.idx[sym]; if (!q || Date.now() - q.at > 180000) return null;
    return { p: q.p, prev: q.prev, pct: q.pct, diff: q.diff };
  };
  function pollIdx() {
    return Promise.all([['KOSPI', '^KS11'], ['KOSDAQ', '^KQ11']].map(function (it) {
      return getJ('index/' + it[0] + '/basic').then(function (j) {
        var p = num(j.closePrice), code = j.compareToPreviousPrice && j.compareToPreviousPrice.code;
        var diff = sgn(code, j.compareToPreviousClosePrice), pct = sgn(code, j.fluctuationsRatio);
        if (!isFinite(p) || !isFinite(pct)) return false;
        live.idx[it[1]] = { p: p, diff: isFinite(diff) ? diff : NaN, prev: isFinite(diff) ? p - diff : p / (1 + pct / 100), pct: pct, status: j.marketStatus, at: Date.now() };
        return true;
      }).catch(function () { return false; });
    })).then(function (r) {
      var ok = r.some(Boolean), k = live.idx['^KS11'];
      if (ok) { live.okAt = Date.now(); live.fails = 0; if (k && k.status) live.open = String(k.status).toUpperCase() === 'OPEN'; } else live.fails++;
      return ok;
    });
  }
  function wrapGauge() {
    if (typeof window.renderKR !== 'function' || window.renderKR.__live) return;
    var orig = window.renderKR, w = function () { gaugeArgs = Array.prototype.slice.call(arguments, 1); return orig.apply(this, arguments); };
    w.__live = 1; window.renderKR = w;
  }
  function liveGauge() {
    try {
      var q = live.idx['^KS11']; if (!q || !gaugeArgs) return;
      var m = lastKrMomentumData; if (!m || !isFinite(m.ma125)) return;
      if (Math.abs(q.p / m.last - 1) < 0.00005) return;
      var ratio = (q.p - m.ma125) / m.ma125, c = Math.max(-0.15, Math.min(0.15, ratio));
      lastKrMomentumData = { score: ((c + 0.15) / 0.30) * 100, last: q.p, ma125: m.ma125, ratio: ratio, chg: q.pct };
      lastKrMomentumScore = lastKrMomentumData.score;
      window.renderKR.apply(null, [lastKrMomentumData].concat(gaugeArgs));
    } catch (e) {}
  }

  /* ── 종목 ── */
  function groups() { /* 한국 목록 그룹: { 코드: [심볼, 그룹키] } */
    var map = {}; try { Object.keys(TICKGROUPS).forEach(function (g) { var cfg = TICKGROUPS[g]; if (!cfg || !cfg.list) return;
      cfg.list.forEach(function (s) { if (/\.K[SQ]$/.test(s)) map[s.replace(/\.K[SQ]$/, '')] = { sym: s, g: g, table: cfg.table }; }); }); } catch (e) {}
    return map;
  }
  function apply(sym, p, diff) {
    var arr; try { arr = tickData[sym]; } catch (e) { return false; }
    if (!arr || arr.length < 3 || !isFinite(p) || p <= 0) return false;
    var n = arr.length, prev = isFinite(diff) ? p - diff : null;
    var near = function (a, b) { return b && Math.abs(a / b - 1) < 0.004; };
    if (prev != null) { if (near(arr[n - 2], prev)) arr[n - 1] = p; else if (near(arr[n - 1], prev)) arr.push(p); else return false; }
    else arr[n - 1] = p;
    return true;
  }
  function pollLists(map) {
    var got = {}, dirty = {};
    return Promise.all(['KOSPI', 'KOSDAQ'].map(function (mk) {
      return getJ('stocks/marketValue/' + mk + '?page=1&pageSize=20').then(function (j) {
        (j.stocks || []).forEach(function (s) {
          var t = map[s.itemCode]; if (!t) return;
          var p = num(s.closePrice), diff = sgn(s.compareToPreviousPrice && s.compareToPreviousPrice.code, s.compareToPreviousClosePrice);
          if (apply(t.sym, p, diff)) { dirty[t.g] = 1; got[s.itemCode] = 1; }
        });
      }).catch(function () {});
    })).then(function () { return { got: got, dirty: dirty }; });
  }
  function pollCodes(map, got, dirty, max) { /* 목록에 없는 종목(레버리지 ETF·KOSPI200 편입편출 등)은 종목별로, 보이는 표만 */
    var PRI = { krlev: 0, kridx: 1, krcap2: 2, krkq2: 3 };
    var codes = Object.keys(map).filter(function (c) {
      if (got[c]) return false; var el = d.getElementById(map[c].table); return el && el.offsetParent !== null; })
      .sort(function (a, b) { return (PRI[map[a].g] == null ? 9 : PRI[map[a].g]) - (PRI[map[b].g] == null ? 9 : PRI[map[b].g]); });
    if (!codes.length) return Promise.resolve();
    /* 레버리지 ETF 표는 매번 전부, 나머지(KOSPI200 편입편출 등)는 돌아가며 */
    var first = codes.filter(function (c) { return map[c].g === 'krlev'; }), rest = codes.filter(function (c) { return map[c].g !== 'krlev'; });
    var room = Math.max(0, max - first.length), st = rest.length > room ? (cycle * room) % rest.length : 0;
    var pick = first.concat(rest.slice(st).concat(rest.slice(0, st)).slice(0, room)), i = 0;
    function worker() { if (i >= pick.length) return Promise.resolve(); var c = pick[i++];
      return getJ('stock/' + c + '/basic').then(function (j) {
        var p = num(j.closePrice), diff = sgn(j.compareToPreviousPrice && j.compareToPreviousPrice.code, j.compareToPreviousClosePrice);
        if (apply(map[c].sym, p, diff)) dirty[map[c].g] = 1;
      }).catch(function () {}).then(worker); }
    return Promise.all([worker(), worker(), worker(), worker()]);
  }
  function repaint(dirty) {
    Object.keys(dirty).forEach(function (g) { try { renderTick(g, curPer[g]); } catch (e) {} });
  }

  /* ── 표시: 스위치(MK_LIVE) 버튼에 상태 문구를 넘긴다 ── */
  function paint(state) {
    var n = new Date(), z = function (v) { return v < 10 ? '0' + v : '' + v; }, t = z(n.getHours()) + ':' + z(n.getMinutes()) + ':' + z(n.getSeconds());
    if (!window.MK_LIVE) return;
    if (state === 'on') window.MK_LIVE.status('● 실시간 ' + t, 'on');
    else if (state === 'closed') window.MK_LIVE.status('장 마감 · ' + t.slice(0, 5) + ' 기준', 'closed');
    else window.MK_LIVE.status('시세 연결 지연 · 기존 값 유지', 'err');
  }

  function run() {
    if (busy) return; if (!window.MK_LIVE || !window.MK_LIVE.active()) { schedule(); return; } busy = true;
    var map = groups();
    pollIdx().then(function (ok) {
      if (ok) { window.dispatchEvent(new CustomEvent('mk:kr-live')); liveGauge(); if (window.__krLoadTicks) window.__krLoadTicks(); }
      var open = live.open !== null ? live.open : sessionOpen();
      return pollLists(map).then(function (r) { return pollCodes(map, r.got, r.dirty, open ? 10 : 14).then(function () { repaint(r.dirty); }); })
        .then(function () { paint(!live.okAt || live.fails > 2 ? 'err' : open ? 'on' : 'closed'); });
    }).catch(function () { paint('err'); }).then(function () { busy = false; cycle++; schedule(); });
  }
  function schedule() {
    clearTimeout(timer);
    var open = live.open !== null ? live.open : sessionOpen();
    timer = setTimeout(run, open ? (window.MK_LIVE ? window.MK_LIVE.ms() : 60000) : 300000);
  }
  d.addEventListener('visibilitychange', function () { if (!d.hidden && Date.now() - live.okAt > Math.max(20000, window.MK_LIVE ? window.MK_LIVE.ms() : 0)) { clearTimeout(timer); run(); } });
  /* 스위치를 켜거나 일시정지에서 돌아오면 바로 한 번 */
  function hook() { if (!window.MK_LIVE) { setTimeout(hook, 300); return; } window.MK_LIVE.onChange(function () { clearTimeout(timer); if (window.MK_LIVE.active()) run(); else schedule(); }); }
  hook();

  function start() { wrapGauge(); setTimeout(function () { wrapGauge(); run(); }, 2500); }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', start); else start();
})();
