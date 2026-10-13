/* 한국주식 "오늘의 시장 요약" — 코스피·코스닥·원/달러 추세 (미국주식의 지수 흐름 요약에 대응)
   Yahoo 일봉(최근 1개월)을 기존 Worker 프록시로 받아 미니 추세선과 등락률을 보여 준다. 값이 없으면 임의 값을 만들지 않고 '—'로 둔다. */
(function () {
  'use strict';
  var d = document, PROXY = 'https://ai.coolzet.workers.dev/?url=';
  var ITEMS = [
    { s: '^KS11', n: '코스피', dp: 2, u: '', nv: 'KOSPI' },
    { s: '^KQ11', n: '코스닥', dp: 2, u: '', nv: 'KOSDAQ' },
    { s: 'KRW=X', n: '원/달러', dp: 1, u: '원' }
  ];
  var box, timer, started = false, cache = null, nq = {};
  /* 장중 반영: 정규장(평일 09:00~15:30 KST) 동안은 네이버 실시간 지수(코스피·코스닥)로 현재가·전일 대비·추세선 끝점을 맞춘다.
     실시간 스위치(MK_LIVE)와 별개로 지수 2건만 1분마다 가져온다(탭이 보일 때만). 값이 없으면 야후 값 그대로. */
  function sessionOpen() { var k = new Date(Date.now() + 9 * 3600000), day = k.getUTCDay(), m = k.getUTCHours() * 60 + k.getUTCMinutes(); return day >= 1 && day <= 5 && m >= 540 && m < 930; }
  function num(x) { return parseFloat(String(x == null ? '' : x).replace(/,/g, '')); }
  function pollNaver() {
    return Promise.all(ITEMS.filter(function (it) { return it.nv; }).map(function (it) {
      var ctl = ('AbortController' in window) ? new AbortController() : null, to = setTimeout(function () { if (ctl) ctl.abort(); }, 9000);
      return fetch(PROXY + encodeURIComponent('https://m.stock.naver.com/api/index/' + it.nv + '/basic'), ctl ? { signal: ctl.signal } : {}).then(function (r) { clearTimeout(to); if (!r.ok) throw 0; return r.json(); }).then(function (j) {
        var p = num(j.closePrice), code = String(j.compareToPreviousPrice && j.compareToPreviousPrice.code), pc = Math.abs(num(j.fluctuationsRatio));
        if (!isFinite(p) || !isFinite(pc)) return;
        nq[it.s] = { p: p, pct: (code === '4' || code === '5') ? -pc : pc, at: Date.now(), open: String(j.marketStatus || '').toUpperCase() === 'OPEN' };
      }).catch(function () { clearTimeout(to); });
    }));
  }

  function fmt(v, dp) { return v.toLocaleString('ko-KR', { minimumFractionDigits: dp, maximumFractionDigits: dp }); }
  function pct(v) { return (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(2) + '%'; }
  function arrow(v) { return v > 0 ? '▲' : v < 0 ? '▼' : '–'; }
  function cls(v) { return v > 0 ? 'up' : v < 0 ? 'down' : 'flat'; }

  function spark(closes) {
    var W = 120, H = 34, p = 2, mn = Math.min.apply(null, closes), mx = Math.max.apply(null, closes), r = (mx - mn) || 1;
    var pts = closes.map(function (c, i) { return (p + i * (W - 2 * p) / (closes.length - 1)).toFixed(1) + ',' + (H - p - (c - mn) / r * (H - 2 * p)).toFixed(1); });
    var last = pts[pts.length - 1].split(',');
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" aria-hidden="true"><polyline points="' + pts.join(' ') + '" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/><circle cx="' + last[0] + '" cy="' + last[1] + '" r="2.4" fill="currentColor"/></svg>';
  }

  function load(it) {
    var url = PROXY + encodeURIComponent('https://query1.finance.yahoo.com/v8/finance/chart/' + it.s + '?range=1mo&interval=1d');
    var ctl = ('AbortController' in window) ? new AbortController() : null, to = setTimeout(function () { if (ctl) ctl.abort(); }, 9000);
    return fetch(url, ctl ? { signal: ctl.signal } : {}).then(function (r) { if (!r.ok) throw 0; return r.json(); }).then(function (j) {
      clearTimeout(to);
      var res = j && j.chart && j.chart.result && j.chart.result[0]; if (!res) throw 0;
      var q = res.indicators.quote[0].close.filter(function (x) { return x != null && isFinite(x); });
      var m = res.meta || {}, last = m.regularMarketPrice != null ? m.regularMarketPrice : q[q.length - 1];
      /* 전일 종가: range=1mo 의 chartPreviousClose 는 '한 달 전' 종가라 쓰면 안 된다. 직전 종가 → 현재가가 마지막 일봉과 같은지로 판단 */
      var prev = m.regularMarketPreviousClose != null ? m.regularMarketPreviousClose : (Math.abs(last / q[q.length - 1] - 1) < 1e-6 ? q[q.length - 2] : q[q.length - 1]);
      if (q.length < 3 || last == null || !prev) throw 0;
      return { last: last, day: (last / prev - 1) * 100, mo: (last / q[0] - 1) * 100, closes: q };
    }).catch(function () { clearTimeout(to); return null; });
  }

  /* kr-live.js 가 받은 네이버 실시간 지수값이 있으면 현재가·전일 등락·추세선 끝점을 그 값으로 맞춘다 */
  function adjust(it, r) {
    var q = (window.__krLiveQuote && window.__krLiveQuote(it.s)) || (nq[it.s] && Date.now() - nq[it.s].at < 240000 ? nq[it.s] : null); if (!r || !q) return r;
    var cl = r.closes.slice(0, -1).concat([q.p]);
    return { last: q.p, day: q.pct, mo: (q.p / cl[0] - 1) * 100, closes: cl, live: true, open: q.open };
  }
  function render() {
    if (!cache) return;
    box.querySelector('.kt-grid').innerHTML = cache.map(function (r, i) { return card(ITEMS[i], adjust(ITEMS[i], r)); }).join('');
  }
  function card(it, r) {
    if (!r) return '<div class="kt-c na"><small>' + it.n + '</small><b>—</b><span class="kt-d">시세 일시 오류</span></div>';
    var c = cls(r.day);
    return '<div class="kt-c ' + c + '"><small>' + it.n + '</small><b>' + fmt(r.last, it.dp) + it.u + '</b>' +
      '<span class="kt-d ' + c + '">' + arrow(r.day) + ' ' + pct(r.day) + '<em>' + (r.live && r.open ? '장중' : '전일') + '</em></span>' +
      '<div class="kt-s">' + spark(r.closes) + '</div>' +
      '<span class="kt-m ' + cls(r.mo) + '">1개월 ' + pct(r.mo) + '</span></div>';
  }

  function paint() {
    box.querySelector('.kt-grid').setAttribute('aria-busy', 'true');
    Promise.all(ITEMS.map(load).concat(sessionOpen() ? [pollNaver()] : [])).then(function (rs) {
      rs = rs.slice(0, ITEMS.length); cache = rs; render();
      box.querySelector('.kt-grid').removeAttribute('aria-busy');
      var ok = rs.some(Boolean);
      box.querySelector('.kt-time').textContent = ok ? '갱신 ' + new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '';
      box.querySelector('.kt-retry').hidden = ok && rs.every(Boolean);
    });
  }


  /* ── 사이드카(매수·매도) 강조 ──
     코스피200 선물이 전일 대비 ±5%(1분 지속)면 프로그램매매 호가 효력 5분 정지, 코스닥150 선물 ±6%·지수 ±3%면 코스닥 사이드카.
     선물 시세 API가 없어 코스피200 지수(코스닥은 종합지수)의 등락률로 '발동 가능 구간'을 추정해 보여 준다. 공식 발동 여부는 KRX 공시 확인. */
  var sc = { k200: null, kq: null }, scBox, sawBelow = false;
  function pollSide() {
    var one = function (code, key) {
      var ctl = ('AbortController' in window) ? new AbortController() : null, to = setTimeout(function () { if (ctl) ctl.abort(); }, 9000);
      return fetch(PROXY + encodeURIComponent('https://m.stock.naver.com/api/index/' + code + '/basic'), ctl ? { signal: ctl.signal } : {}).then(function (r) { clearTimeout(to); if (!r.ok) throw 0; return r.json(); }).then(function (j) {
        var cd = String(j.compareToPreviousPrice && j.compareToPreviousPrice.code), pc = Math.abs(num(j.fluctuationsRatio)), p = num(j.closePrice);
        if (!isFinite(pc)) return; sc[key] = { p: p, pct: (cd === '4' || cd === '5') ? -pc : pc, at: Date.now(), open: String(j.marketStatus || '').toUpperCase() === 'OPEN' };
      }).catch(function () { clearTimeout(to); });
    };
    return Promise.all([one('KPI200', 'k200'), one('KOSDAQ', 'kq')]).then(paintSide);
  }
  function kstDay(ms) { return new Date(ms + 9 * 3600000).toISOString().slice(0, 10); }
  function readLatch() { try { var o = JSON.parse(localStorage.getItem('mk_sidecar') || 'null'); return o && o.d && o.t ? o : null; } catch (e) { return null; } }
  function sideValid(L) { /* 발동 당일, 또는 다음 날 09:00(KST) 전 */
    var now = Date.now(), k = new Date(now + 9 * 3600000), today = kstDay(now); if (L.d === today) return true;
    return kstDay(now - 86400000) === L.d && (k.getUTCHours() < 9);
  }
  function afterCloseWindow() { var k = new Date(Date.now() + 9 * 3600000), m = k.getUTCHours() * 60 + k.getUTCMinutes(), wd = k.getUTCDay(); return wd >= 1 && wd <= 5 && m >= 930 || wd >= 2 && wd <= 6 && m < 540; }
  function paintSide() {
    if (!scBox) return;
    var T = [{ q: sc.k200, n: '코스피200', th: 5, mk: '코스피' }, { q: sc.kq, n: '코스닥', th: 6, mk: '코스닥' }].filter(function (x) { return x.q; });
    if (!T.length) { scBox.className = 'kr-sc sc-na'; scBox.innerHTML = ''; titleMark(); return; }
    var hit = T.filter(function (x) { return Math.abs(x.q.pct) >= x.th; }), near = T.filter(function (x) { return Math.abs(x.q.pct) >= x.th * 0.8; });
    var sg = function (v) { return (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(2) + '%'; };
    var now = Date.now(), L = readLatch(), h = hit[0]; if (!h) sawBelow = true;
    if (h && h.q.open && (!L || L.mk !== h.mk)) { L = { d: kstDay(now), t: now, side: h.q.pct < 0 ? 'sell' : 'buy', mk: h.mk, n: h.n, pct: h.q.pct, late: !sawBelow }; try { localStorage.setItem('mk_sidecar', JSON.stringify(L)); } catch (e) {} }
    var WIN = 5 * 60000, hm = function (t) { return new Date(t).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Seoul' }); };
    if (L && !L.late && h && h.q.open && now - L.t < WIN) { /* 발동 직후 5분: 크게 강조 + 남은 시간(효력 정지 5분 기준 추정) */
      var sell = L.side === 'sell', left = Math.max(0, WIN - (now - L.t)), mm = Math.floor(left / 60000), ss = Math.floor(left % 60000 / 1000);
      scBox.className = 'kr-sc sc-hit ' + (sell ? 'sc-sell' : 'sc-buy');
      scBox.innerHTML = '<span class="sc-ic" aria-hidden="true">' + (sell ? '🚨' : '🔔') + '</span><div class="sc-tx"><b>' + (sell ? '매도' : '매수') + ' 사이드카 발동 구간 <em>' + h.mk + '</em></b><span>' + h.n + ' ' + sg(h.q.pct) + ' (기준 ±' + h.th + '%) · 프로그램매매 ' + (sell ? '매도' : '매수') + '호가 효력정지 약 <u>' + mm + ':' + (ss < 10 ? '0' : '') + ss + '</u> 남음(추정)</span><small>' + hm(L.t) + ' 감지 · 지수 등락률 기준 추정 · 공식 발동 여부는 KRX 공시 확인</small></div><span class="sc-live">LIVE</span>';
      scBox.setAttribute('role', 'alert');
    } else if (L && sideValid(L)) { /* 5분 경과·장 마감 후: 오늘 있었던 일로 조용히 남김(당일 → 다음 날 09시 전까지) */
      var s2 = L.side === 'sell';
      scBox.className = 'kr-sc sc-done ' + (s2 ? 'sc-sell' : 'sc-buy'); scBox.removeAttribute('role');
      scBox.innerHTML = '<span class="sc-ic" aria-hidden="true">' + (s2 ? '🚨' : '🔔') + '</span><div class="sc-tx"><b>오늘 ' + (s2 ? '매도' : '매수') + ' 사이드카 ' + (L.late ? '기준 초과 상태 · 접속 시 이미 도달' : '발동 구간 진입 · ' + hm(L.t)) + '</b><span>' + L.n + ' ' + sg(L.pct) + (L.late ? ' · 발동 시각은 KRX 공시 확인' : ' · 효력정지 5분 경과(해제 추정)') + (h ? ' · 현재 ' + sg(h.q.pct) : '') + '</span></div>';
    } else if (h && !h.q.open && afterCloseWindow()) { /* 장 마감 후 접속: 마감 등락률이 기준을 넘은 경우만 */
      var s3 = h.q.pct < 0;
      scBox.className = 'kr-sc sc-done ' + (s3 ? 'sc-sell' : 'sc-buy'); scBox.removeAttribute('role');
      scBox.innerHTML = '<span class="sc-ic" aria-hidden="true">' + (s3 ? '🚨' : '🔔') + '</span><div class="sc-tx"><b>오늘 장중 ' + (s3 ? '매도' : '매수') + ' 사이드카 기준(±' + h.th + '%) 도달 · 마감 기준</b><span>' + h.n + ' ' + sg(h.q.pct) + ' · 발동 시각은 KRX 공시 확인</span></div>';
    } else { /* 미발동(근접 포함): 아무것도 표시하지 않는다 */
      scBox.className = 'kr-sc sc-na'; scBox.removeAttribute('role'); scBox.innerHTML = '';
    }
    titleMark();
  }
  /* 발동(또는 오늘 발동 이력)이 있으면 '오늘의 시장 요약' 제목줄에 이모티콘 표시 */
  function titleMark() {
    var hd = d.querySelector('#pro-brief .pb-hd'); if (!hd) return;
    var on = scBox && /\bsc-(hit|done)\b/.test(scBox.className), sell = scBox && scBox.classList.contains('sc-sell'), mk = d.getElementById('kr-sc-mark');
    if (!on) { if (mk) mk.remove(); return; }
    if (!mk) { mk = d.createElement('span'); mk.id = 'kr-sc-mark'; var t = hd.querySelector('b,h2,h3,strong') || hd.firstElementChild; if (t) t.after(mk); else hd.prepend(mk); }
    mk.textContent = sell ? '🚨' : '🔔'; mk.className = 'sc-mark ' + (scBox.classList.contains('sc-hit') ? 'live' : 'done');
    mk.title = (sell ? '매도' : '매수') + ' 사이드카 ' + (scBox.classList.contains('sc-hit') ? '발동 구간' : '오늘 발동 이력') + ' — 아래 안내 참고';
    mk.setAttribute('role', 'img'); mk.setAttribute('aria-label', mk.title);
  }
  function mountSide() {
    var hd = d.querySelector('#pro-brief .pb-hd'); if (!hd) return false;
    if (d.getElementById('kr-sidecar')) return true;
    scBox = d.createElement('div'); scBox.id = 'kr-sidecar'; scBox.className = 'kr-sc sc-na'; hd.after(scBox);
    pollSide(); setInterval(function () { if (!d.hidden && sessionOpen()) pollSide(); }, 60000);
    setInterval(function () { if (scBox && scBox.classList.contains('sc-hit')) paintSide(); }, 1000);
    return true;
  }

  function mount() {
    var host = d.querySelector('#pro-brief .pb-grid'); if (!host || d.getElementById('kr-mkt-trend')) return !!d.getElementById('kr-mkt-trend');
    box = d.createElement('section'); box.id = 'kr-mkt-trend'; box.setAttribute('aria-label', '코스피·코스닥·원/달러 추세');
    box.innerHTML = '<div class="kt-hd"><b>시장 추세</b><span>코스피 · 코스닥 · 원/달러 · 최근 1개월</span><em class="kt-time"></em><button type="button" class="kt-retry" hidden>다시 시도</button></div><div class="kt-grid"><div class="kt-c na"><small>불러오는 중…</small></div></div>';
    host.after(box); mountSide();
    box.querySelector('.kt-retry').addEventListener('click', paint);
    paint(); timer = setInterval(paint, 180000);
    setInterval(function () { if (d.hidden || !sessionOpen() || !cache) return; pollNaver().then(function () { render(); var t = box.querySelector('.kt-time'); if (t) t.textContent = '장중 ' + new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }); }); }, 60000);
    window.addEventListener('mk:kr-live', render);
    return true;
  }

  function start() {
    if (started) return; started = true;
    var tries = 0, iv = setInterval(function () { if (mount() || ++tries > 40) clearInterval(iv); }, 500);
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', start); else start();
})();
