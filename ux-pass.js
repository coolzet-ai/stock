/* ux-pass.js — 전 메뉴 점검 개선
   (1) 첫 방문 카드 자동 접기  (2) 모바일 '맨 위로' 버튼: 스크롤 후에만 표시
   (3) 미국·한국·가상화폐 '오늘의 시그널 체크' 스트립(화면에 이미 표시된 지표를 규칙으로 요약 · 연동 상태 표시 · 눌림목/과열 후보)
   (4) 홈 시장 카드: 5일선·200일선·RSI 한 줄 신호(+ 코인 공포탐욕)
   모두 참고용이며 투자 권유가 아닙니다. 외부 호출은 기존과 같은 Worker 프록시만 사용합니다. */
(function () {
  'use strict'; var d = document;
  var PAGE = (location.pathname.split('/').pop() || '').replace(/\.html$/, '');
  function $(s, r) { return (r || d).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || d).querySelectorAll(s)); }
  function mk(tag, cls, txt) { var e = d.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }

  /* (1) 첫 방문 카드 */
  setTimeout(function () { var c = d.getElementById('mk-first'); if (c && !c.classList.contains('open')) c.classList.add('mk-min'); }, 8000);
  /* (2) 맨 위로 */
  function sc() { var y = window.scrollY || d.documentElement.scrollTop; d.body.classList.toggle('sg-scrolled', y > 520); d.body.classList.toggle('sg-rb-on', y > 760); }
  window.addEventListener('scroll', sc, { passive: true }); sc();
  /* 일부 페이지가 맨 위로 버튼에 인라인 font-size(!important)를 넣어, 모바일에서는 글자를 숨기고 ↑ 아이콘만 남깁니다 */
  setInterval(function () { var b = d.getElementById('pro-top'); if (!b) return; if (window.innerWidth <= 700) b.style.setProperty('font-size', '0', 'important'); else if (b.style.fontSize === '0px') b.style.removeProperty('font-size'); }, 1200);



  /* ───────── 하단 업데이트 표시 통일 (미국·한국·가상화폐·홈) ─────────
     표시 날짜는 아래 상수 한 곳만 고치면 4개 페이지가 함께 바뀝니다(배포하는 날짜로 갱신). */
  window.MK_UPDATED = '2026.10.23';
  if (/^(stock|kr-stock|crypto|mrkim-signal)$/.test(PAGE)) {
    var unifyUpd = function () {
      var f = $('footer'); if (!f) return;
      var old = d.getElementById('stock-update-footer'); if (old) old.style.display = 'none';
      var b = $('.cross-update', f);
      if (!b) { b = mk('button', 'cross-update', '🗓️ 업데이트 · ' + window.MK_UPDATED); b.type = 'button'; b.disabled = true; f.appendChild(b); }
      $$('.cross-update', f).forEach(function (x) { if (x !== b) x.style.display = 'none'; });
    };
    setTimeout(unifyUpd, 1500); setInterval(unifyUpd, 3000);
  }


  /* ───────── 요약 5개 박스 디자인: 숫자는 크게, 상태는 색 배지로 ───────── */
  setInterval(function () { var o = d.getElementById('mk-ov'); if (o && o.parentNode) o.parentNode.removeChild(o); }, 1500); /* 구버전 종목 개요 박스 제거 */
  function decoTiles() {
    var b = d.getElementById('pro-brief'); if (!b) return;
    $$('.pb-grid > .pb-c', b).forEach(function (c) {
      var val = $('b', c), sub = c.querySelector('span');
      /* 공포탐욕: "19 · 극단적 공포" → 큰 숫자 + 상태 배지 */
      if (val && !val.querySelector('.n')) {
        var m = /^\s*(\d+(?:\.\d+)?)\s*·\s*(.+?)\s*$/.exec(val.textContent || '');
        if (m) { val.textContent = ''; val.appendChild(mk('em', 'n', m[1])); val.appendChild(mk('i', 'z', m[2])); }
      }
      /* 일정: "D-4 · 10.27 (화) 21:30" → D-일수 배지 */
      if (sub && !sub.querySelector('.dd') && /일정/.test((c.querySelector('small') || {}).textContent || '')) {
        var e = /^\s*(D-\d+|D-day|D\+\d+)\s*·?\s*(.*)$/.exec(sub.textContent || '');
        if (e) { var n = +(/\d+/.exec(e[1]) || [9])[0]; sub.textContent = ''; sub.appendChild(mk('i', 'dd' + (n <= 3 ? ' soon' : ''), e[1])); sub.appendChild(d.createTextNode(' ' + e[2])); }
      }
      /* 변동성(VIX): 기간구조를 값 옆 배지로, 수준에 따라 색 */
      if (c.getAttribute('data-go') === 'int' && val && !c.querySelector('.vx-pill')) {
        var st = $('#pb-vx2', c), tx = st ? st.textContent : '';
        if (tx) { var back = /역전|백워/.test(tx); var p = mk('i', 'vx-pill ' + (back ? 'bad' : 'ok'), back ? '역전' : '정상'); val.appendChild(p); }
      }
      if (c.getAttribute('data-go') === 'int' && val) { var v = parseFloat(val.textContent); c.setAttribute('data-vl', isFinite(v) ? (v >= 30 ? 'hi' : v >= 20 ? 'mid' : 'lo') : ''); }
    });
  }
  setInterval(decoTiles, 1000);

  /* ───────── 접근성·구조 보강 ───────── */
  function a11y() {
    /* 건너뛰기 링크 */
    if (!$('a.skip-link, a.mk-skip')) { var m = $('main'); if (m) { if (!m.id) m.id = 'main'; if (!m.hasAttribute('tabindex')) m.setAttribute('tabindex', '-1'); var a = mk('a', 'mk-skip', '본문으로 건너뛰기'); a.href = '#' + m.id; d.body.insertBefore(a, d.body.firstChild); } }
    /* h1 은 페이지당 하나: 보이는 첫 h1 만 남기고 나머지는 레벨 2 제목으로 */
    var hs = $$('h1'); if (hs.length > 1) { var keep = hs.filter(function (h) { return !/sr/.test(h.className); })[0] || hs[0]; hs.forEach(function (h) { if (h === keep) { if (h.getAttribute('role') === 'heading') { h.removeAttribute('role'); h.removeAttribute('aria-level'); } } else if (h.getAttribute('role') !== 'heading') { h.setAttribute('role', 'heading'); h.setAttribute('aria-level', '2'); } }); }
    /* 탭 형태 버튼(시총·관심종목·레버리지 …)의 선택 상태를 보조기기에 전달 */
    $$('.hm-t').forEach(function (g) { g.setAttribute('role', 'tablist'); $$('button', g).forEach(function (b) { b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', /\b(on|active|sel)\b/.test(b.className) || b.getAttribute('aria-pressed') === 'true' ? 'true' : 'false'); }); });
    $$('.rsb-tg button, [data-m][class*=rs]').forEach(function (b) { if (!b.hasAttribute('aria-pressed')) b.setAttribute('aria-pressed', /\b(on|active|sel)\b/.test(b.className) ? 'true' : 'false'); });
  }
  setTimeout(a11y, 2500); setTimeout(a11y, 7000); setInterval(a11y, 6000);

  /* ───────── (3) 시그널 스트립 ───────── */
  var brief = null;
  if (/^(stock|kr-stock|crypto)$/.test(PAGE)) {
    var num = function (s) { var m = /(-?\d+(?:\.\d+)?)/.exec(s || ''); return m ? parseFloat(m[1]) : null; };
    var pct = function (s) { var m = /([▲▼])\s*([+\-−]?\d+(?:\.\d+)?)%/.exec(s || ''); if (!m) return null; var v = Math.abs(parseFloat(m[2].replace('−', '-'))); return m[1] === '▼' ? -v : v; };
    var fmtp = function (v) { return v == null ? '–' : (v > 0 ? '+' : '') + v.toFixed(2) + '%'; };
    var read = function () {
      var cs = $$('.pb-grid > .pb-c', brief), t = function (i) { return cs[i] ? cs[i].innerText : ''; };
      var fgn = $('#pb-fg .n', brief); var x = { fg: fgn ? num(fgn.textContent) : num((/(\d+)\s*·/.exec(t(0)) || [])[1]), page: PAGE };
      var lev = $('.pb-lev', brief); x.l3 = null; x.l4 = null;
      if (lev) { var m = lev.innerText.match(/(\d+)\s*\n?\s*2연속\s*\n?\s*(\d+)\s*\n?\s*3연속\s*\n?\s*(\d+)\s*\n?\s*4연속/); if (m) { x.l3 = +m[2]; x.l4 = +m[3]; } }
      var evTxt = '', evi = -1; cs.forEach(function (c, i) { if (/일정/.test(c.innerText.split('\n')[0] || '') && evi < 0) evi = i; });
      if (evi >= 0) { var tt = t(evi); x.ev = (/D-(\d+)/.exec(tt) || [])[1]; x.evn = (tt.split('\n')[1] || '').trim(); }
      if (PAGE === 'stock') { x.vix = num((/VIX\)\s*\n?\s*([\d.]+)/.exec(t(1)) || [])[1]); x.back = /백워데이션/.test(t(1)); x.rs = window.MK_RSI_SUM || null; x.rsw = !window.MK_RSI_W_ERR; }
      if (PAGE === 'kr-stock') { x.kospi = pct(t(1)); x.fx = pct(t(2)); }
      if (PAGE === 'crypto') { x.btc = pct(t(1)); x.eth = pct(t(2)); var hv = /D-(\d+)/.exec($('.pb-halv', brief) ? $('.pb-halv', brief).innerText : ''); x.halv = hv ? hv[1] : null; }
      return x;
    };
    /* 가상화폐 추가 시그널: 코인 4종 시세 · 소셜 강/약세 · ETF 순유입/유출 · 레인보우 단계 */
    var CX = { flow: {}, tried: 0, at: 0 }, CN = { bitcoin: '비트코인', ethereum: '이더리움', solana: '솔라나', ripple: '리플' }, CS = { bitcoin: 'BTC', ethereum: 'ETH', solana: 'SOL', ripple: 'XRP' };
    var loadFlow = function () {
      if (PAGE !== 'crypto') return; var now = Date.now(); if (now - CX.at < 45000) return; CX.at = now;
      Object.keys(CS).forEach(function (id) {
        if (CX.flow[id] != null) return;
        fetch('https://ai.coolzet.workers.dev/?url=' + encodeURIComponent('https://api.coinmarketcap.com/data-api/v3/etf/overview/netflow/chart?category=' + CS[id] + '&range=30d')).then(function (r) { return r.json(); }).then(function (j) {
          var p = j && j.data && j.data.points; if (!p || !p.length) return;
          p = p.slice().sort(function (a, b) { return a.timestamp - b.timestamp; }); var v = null; for (var i = p.length - 1; i >= 0; i--) { if (+p[i].value) { v = +p[i].value; break; } }
          if (v != null) CX.flow[id] = v;
        }).catch(function () { });
      });
    };
    var cryptoX = function () {
      var sy = { BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana', XRP: 'ripple' }, soc = {};
      $$('#soc-sent .soc-row').forEach(function (r) { var nm = $('.soc-nm', r), v = $('.soc-v span', r); if (!nm || !v) return; var id = sy[nm.textContent.trim()], pc = parseFloat(v.textContent); if (id && !isNaN(pc)) soc[id] = pc; });
      return Object.keys(CN).map(function (id) {
        var row = $('#coin-tbl .wl-row[data-c="' + id + '"]'), px = row && $('.px', row), ch = row && $('.ch', row), b = row && $('.rb-badge', row);
        return { n: CN[id], px: px ? px.textContent.trim() : '--', pc: ch ? ch.textContent.trim() : '--', cls: ch && /up/.test(ch.className) ? 'u' : ch && /down/.test(ch.className) ? 'd' : '', soc: soc[id] != null ? soc[id] : null, flow: CX.flow[id] != null ? CX.flow[id] : null, rb: b ? b.textContent.trim() : '', rbc: b ? (b.style.backgroundColor || '') : '' };
      });
    };
    var cands = function () { /* 눌림목(RSI(일) ≤40 & 200일선 위) · 과열(RSI(일) ≥70) 후보 — 미국 표만 */
      var pull = [], heat = [], seen = {};
      ['cap-tbl', 'cap2-tbl', 'cap3-tbl', 'tick-tbl', 'lev-tbl'].forEach(function (id) {
        $$('#' + id + ' .wl-row[data-t]').forEach(function (r) {
          var tk = r.getAttribute('data-t'); if (seen[tk]) return; seen[tk] = 1;
          var db = $('.tb-d', r); if (!db) return; var rsi = num(db.textContent); if (rsi == null) return;
          var up200 = $$('.tb', r).some(function (b) { return /^200▲/.test(b.textContent.trim()); });
          if (rsi <= 40 && up200) pull.push({ t: tk, v: rsi, id: id }); else if (rsi >= 70) heat.push({ t: tk, v: rsi, id: id });
        });
      });
      pull.sort(function (a, b) { return a.v - b.v; }); heat.sort(function (a, b) { return b.v - a.v; });
      return { pull: pull.slice(0, 8), heat: heat.slice(0, 8), np: pull.length, nh: heat.length };
    };
    var judge = function (x) {
      var used = 0, score = 0, heatF = 0, notes = [];
      if (x.fg != null) { used++; if (x.fg <= 45) score++; if (x.fg <= 25) score++; if (x.fg >= 70) heatF++; }
      if (PAGE === 'stock') {
        if (x.rs && x.rs.n) { used++; if (x.rs.lo >= 3) score++; if (x.rs.hi >= 5) heatF++; }
        if (x.l3 != null) { used++; if ((x.l3 + x.l4) >= 2) score++; }
      } else if (x.l3 != null) { used++; if ((x.l3 + x.l4) >= 2) score++; }
      var r = { cls: 'watch', lab: '관망·점검', used: used };
      if (used < (PAGE === 'crypto' ? 1 : 2)) { r.cls = 'warn'; r.lab = '판정 보류(연동 확인)'; }
      else if (heatF >= 1 && (x.fg >= 70 || (x.rs && x.rs.hi >= 5))) { r.cls = 'heat'; r.lab = '과열 점검'; }
      else if (score >= (PAGE === 'stock' ? 3 : 2)) { r.cls = 'buy'; r.lab = '분할 접근 후보 점검'; }
      r.tip = r.cls === 'buy' ? '공포·과매도 신호가 겹칩니다. 비중·손절 기준을 먼저 정하고 분할로만 접근을 검토하세요.'
        : r.cls === 'heat' ? '과열 신호가 있습니다. 신규 추격보다 이익 관리·비중 점검이 우선입니다.'
        : r.cls === 'warn' ? '연동된 지표가 부족해 판정하지 않습니다. 아래 연동 상태를 확인하세요.'
        : '신호가 엇갈립니다. 서두르지 않고 관심종목의 이평선·RSI를 먼저 확인하세요.';
      return r;
    };
    var chip = function (k, v, c) { var e = mk('div', 'sg-chip' + (c ? ' ' + c : '')); e.appendChild(mk('small', '', k)); e.appendChild(mk('b', '', v)); return e; };
    var flash = function (tk, id) {
      var r = $('#' + id + ' .wl-row[data-t="' + tk.replace(/"/g, '') + '"]'); if (!r) return;
      var h = r.closest('.fold-body'); if (h && h.hidden) { var hd = h.previousElementSibling; if (hd && hd._set) hd._set(true); }
      r.scrollIntoView({ behavior: 'smooth', block: 'center' }); r.classList.add('sg-flash'); setTimeout(function () { r.classList.remove('sg-flash'); }, 2200);
    };
    var cline = function (label, arr, cls) {
      var l = mk('div', 'sg-cl'); l.appendChild(mk('span', 'sg-cl-t ' + cls, label));
      if (!arr.length) { l.appendChild(mk('span', 'sg-cl-n', '해당 없음')); return l; }
      arr.forEach(function (c) { var b = mk('a', 'sg-tk ' + cls, c.t + ' ' + Math.round(c.v)); b.href = 'https://finviz.com/quote.ashx?t=' + encodeURIComponent(c.t); b.target = '_blank'; b.rel = 'noopener noreferrer'; b.title = c.t + ' · RSI(일) ' + c.v + ' · 클릭하면 finviz 주가 페이지가 새 탭으로 열립니다'; l.appendChild(b); });
      return l;
    };
    var last = '';
    var render = function () {
      brief = d.getElementById('pro-brief'); if (!brief || !$('.pb-grid', brief)) return;
      if (PAGE === 'crypto') loadFlow();
      var x = read(), r = judge(x), cd = PAGE === 'stock' ? cands() : null, cx = PAGE === 'crypto' ? cryptoX() : null;
      var sig = JSON.stringify([x, r.cls, cd && [cd.pull, cd.heat], cx]); if (sig === last) return; last = sig;
      var g = $('.pb-grid', brief); if (!g) return;
      var el = d.getElementById('sg-strip'); if (!el) { el = mk('div', 'sg-strip'); el.id = 'sg-strip'; g.parentNode.insertBefore(el, g); }
      el.replaceChildren();
      var top = mk('div', 'sg-top'); top.appendChild(mk('span', 'sg-ttl', '📋 오늘의 시그널 체크')); top.appendChild(mk('span', 'sg-badge ' + r.cls, r.lab)); el.appendChild(top);
      var ch = mk('div', 'sg-chips');
      ch.appendChild(chip(PAGE === 'stock' ? '공포탐욕' : PAGE === 'kr-stock' ? '한국 공포탐욕' : '코인 공포탐욕', x.fg != null ? x.fg : '–', x.fg != null && x.fg <= 25 ? 'on' : x.fg >= 70 ? 'cool' : ''));
      if (PAGE === 'stock') {
        ch.appendChild(chip('VIX', x.vix != null ? x.vix : '–', x.back ? 'on' : ''));
        ch.appendChild(chip('RSI 과매도', x.rs ? x.rs.lo + '종목' : '–', x.rs && x.rs.lo >= 3 ? 'on' : ''));
        ch.appendChild(chip('RSI 과매수', x.rs ? x.rs.hi + '종목' : '–', x.rs && x.rs.hi >= 5 ? 'cool' : ''));
      }
      if (PAGE === 'kr-stock') { ch.appendChild(chip('코스피', fmtp(x.kospi), x.kospi != null && x.kospi < 0 ? 'cool' : x.kospi > 0 ? 'on' : '')); ch.appendChild(chip('원/달러', fmtp(x.fx), '')); }
      if (PAGE === 'crypto' && x.halv) ch.appendChild(chip('반감기', 'D-' + x.halv, ''));
      if (x.l3 != null) ch.appendChild(chip('레버리지 3일+ 연속하락', (x.l3 + x.l4) + '종목', 'wide' + ((x.l3 + x.l4) >= 2 ? ' on' : '')));
      ch.appendChild(chip('다음 일정', x.ev != null ? 'D-' + x.ev : '–', x.ev != null && +x.ev <= 3 ? 'on' : '')); el.appendChild(ch);
      if (cx) {
        var fm = function (v) { var a = Math.abs(v), t = a >= 1e9 ? (a / 1e9).toFixed(2) + 'B' : a >= 1e6 ? (a / 1e6).toFixed(a >= 1e8 ? 0 : 1) + 'M' : a >= 1e3 ? Math.round(a / 1e3) + 'K' : Math.round(a); return (v >= 0 ? '+$' : '−$') + t; };
        var mxf = Math.max.apply(null, cx.map(function (c) { return c.flow == null ? 0 : Math.abs(c.flow); }).concat([1]));
        var mt = mk('div', 'cxm');
        ['코인', '💬 소셜 투표', '🏦 ETF 자금', '🌈 레인보우'].forEach(function (h) { mt.appendChild(mk('div', 'cxm-h', h)); });
        var hot = /과열 주의|FOMO|매도 구간|극단적 거품/, buy = /대폭 할인|매수|축적/;
        cx.forEach(function (c) {
          var k = mk('div', 'cxm-c'); k.appendChild(mk('b', '', c.n)); k.appendChild(mk('span', 'cxm-px', c.px)); k.appendChild(mk('em', c.cls, c.pc)); mt.appendChild(k);
          var so = mk('div', 'cxm-s');
          if (c.soc == null) so.appendChild(mk('span', 'cxm-na', '로딩')); else {
            var bar = mk('div', 'cxm-bar'); var up = mk('i', 'u'); up.style.width = c.soc + '%'; var dn = mk('i', 'd'); dn.style.width = (100 - c.soc) + '%'; bar.appendChild(up); bar.appendChild(dn); so.appendChild(bar);
            so.appendChild(mk('span', 'cxm-tag ' + (c.soc >= 55 ? 'u' : c.soc <= 45 ? 'd' : 'n'), (c.soc >= 55 ? '강세 ' : c.soc <= 45 ? '약세 ' : '중립 ') + Math.round(c.soc) + '%'));
          }
          mt.appendChild(so);
          var fl = mk('div', 'cxm-f');
          if (c.flow == null) fl.appendChild(mk('span', 'cxm-na', '로딩')); else {
            var fb = mk('div', 'cxm-fb'); var fi = mk('i', c.flow >= 0 ? 'u' : 'd'); fi.style.width = Math.max(6, Math.abs(c.flow) / mxf * 50) + '%'; if (c.flow >= 0) fi.style.left = '50%'; else fi.style.right = '50%'; fb.appendChild(fi); fl.appendChild(fb);
            fl.appendChild(mk('span', 'cxm-tag ' + (c.flow >= 0 ? 'u' : 'd'), (c.flow >= 0 ? '유입 ' : '유출 ') + fm(c.flow)));
          }
          mt.appendChild(fl);
          var rbx = mk('div', 'cxm-r');
          if (!c.rb) rbx.appendChild(mk('span', 'cxm-na', '로딩')); else { var p = mk('span', 'cxm-rb', c.rb); if (c.rbc) p.style.background = c.rbc; if (/축적|아직 저렴|보유|매수/.test(c.rb) && !/대폭/.test(c.rb)) p.style.color = '#1a1200'; rbx.appendChild(p); rbx.appendChild(mk('small', hot.test(c.rb) ? 'hot' : buy.test(c.rb) ? 'buy' : '', hot.test(c.rb) ? '과열 주의' : buy.test(c.rb) ? '매수 단계' : '관망')); }
          mt.appendChild(rbx);
        });
        el.insertBefore(mt, ch);
        el.appendChild(mk('div', 'sg-note', '빨강=강세·순유입, 파랑=약세·순유출. 소셜: CoinGecko 강세 투표(55%↑ 강세, 45%↓ 약세) · ETF: CoinMarketCap 최근 거래일 순유입/유출 · 레인보우: 현재 구간.'));
     }
      var tip = mk('div', 'sg-msg'); var b = mk('b', '', '👉 ' + r.tip); tip.appendChild(b);
      if (x.ev != null && +x.ev <= 3) tip.appendChild(mk('div', 'sg-warn', '⚠ D-' + x.ev + ' ' + (x.evn || '주요 일정') + ' 임박 — 변동성 확대에 유의하세요.'));
      el.appendChild(tip);
      if (cd) { var cb = mk('div', 'sg-cands'); cb.appendChild(cline('🧊 눌림목 후보 (RSI(일)≤40 · 200일선 위)', cd.pull, 'pull')); cb.appendChild(cline('🔥 과열 (RSI(일)≥70)', cd.heat, 'heat')); el.appendChild(cb); }
      /* 연동 상태 */
      var more = mk('details', 'sg-more'); var sm = mk('summary', '', '연동 상태 · 판정 기준'); more.appendChild(sm);
      var st = mk('div', 'sg-health'); st.appendChild(mk('span', 'sg-h-t', '연동 상태 '));
      var items = [['공포탐욕', x.fg != null]];
      if (PAGE === 'stock') { items.push(['VIX', x.vix != null], ['RSI(일)', !!(x.rs && x.rs.n)], ['RSI(주)', !!x.rsw && !!window.MK_RSI_SUM]); }
      if (PAGE === 'kr-stock') items.push(['코스피', x.kospi != null], ['환율', x.fx != null]);
      if (PAGE === 'crypto') items.push(['BTC', x.btc != null], ['ETH', x.eth != null]);
      if (PAGE !== 'crypto') items.push(['레버리지', x.l3 != null]); items.push(['일정', x.ev != null]);
      var bad = 0; items.forEach(function (i) { if (!i[1]) bad++; st.appendChild(mk('span', 'sg-h ' + (i[1] ? 'ok' : 'ng'), (i[1] ? '✓ ' : '✗ ') + i[0])); });
      more.appendChild(st);
      if (bad) { more.open = true; sm.textContent = '⚠ 연동 상태 · 판정 기준 (미연동 ' + bad + '건)'; sm.className = 'ng'; more.appendChild(mk('div', 'sg-note ng', '미연동(✗) 항목은 판정에서 제외됩니다. 계속 ✗이면 Worker 연결·네트워크 상태를 확인해 주세요(다시 불러오기 버튼).')); }
      more.appendChild(mk('div', 'sg-note', '화면에 표시된 지표를 규칙으로 요약한 참고용 체크입니다(투자 권유 아님). 기준: 공포탐욕 ≤45 공포 / ≤25 극단 / ≥70 탐욕 · RSI ≤30 과매도 / ≥75 과매수.'));
      el.appendChild(more);
      /* 스크롤 시 상단 고정 리본 */
      var rb = d.getElementById('sg-ribbon'); if (!rb) { rb = mk('button', 'sg-ribbon'); rb.id = 'sg-ribbon'; rb.type = 'button'; rb.setAttribute('aria-label', '시그널 체크로 이동'); rb.addEventListener('click', function () { var t = d.getElementById('sg-strip'); if (t) t.scrollIntoView({ behavior: 'smooth', block: 'center' }); }); d.body.appendChild(rb); }
      rb.replaceChildren(); rb.appendChild(mk('span', 'sg-badge ' + r.cls, r.lab));
      var rbi = [[PAGE === 'crypto' ? '코인 F&G' : PAGE === 'kr-stock' ? '한국 F&G' : 'F&G', x.fg != null ? x.fg : '–']];
      if (PAGE === 'stock') rbi.push(['VIX', x.vix != null ? x.vix : '–']); if (PAGE === 'kr-stock') rbi.push(['코스피', fmtp(x.kospi)]); if (PAGE === 'crypto') rbi.push(['BTC', fmtp(x.btc)]);
      if (x.ev != null) rbi.push(['일정', 'D-' + x.ev]);
      rbi.forEach(function (i) { var e = mk('span', 'sg-rb-i'); e.appendChild(mk('small', '', i[0])); e.appendChild(mk('b', '', String(i[1]))); rb.appendChild(e); });
    };
    setInterval(render, 1500); setTimeout(render, 800);
  }

  /* ───────── (4) 홈: 시장 카드 한 줄 신호 ───────── */
  if (PAGE === 'mrkim-signal') {
    var PROXY = 'https://ai.coolzet.workers.dev/?url=', SYM = { 'stock': '^GSPC', 'kr-stock': '^KS11', 'crypto': 'BTC-USD' };
    var ma = function (a, n) { if (a.length < n) return null; var s = 0; for (var i = a.length - n; i < a.length; i++) s += a[i]; return s / n; };
    var rsi = function (c) { if (c.length < 30) return null; var g = 0, l = 0, i; for (i = 1; i <= 14; i++) { var df = c[i] - c[i - 1]; if (df > 0) g += df; else l -= df; } g /= 14; l /= 14; for (i = 15; i < c.length; i++) { var d2 = c[i] - c[i - 1]; g = (g * 13 + Math.max(d2, 0)) / 14; l = (l * 13 + Math.max(-d2, 0)) / 14; } return l === 0 ? 100 : 100 - 100 / (1 + g / l); };
    var HS = {};
    var homeSum = function () {
      var host = $('.cross-market-links'); if (!host) return;
      var names = { 'stock': '미국', 'kr-stock': '한국', 'crypto': '코인' }, keys = Object.keys(HS); if (!keys.length) return;
      var up = keys.filter(function (k) { return HS[k].up200; }).map(function (k) { return names[k]; }), dn = keys.filter(function (k) { return HS[k].up200 === false; }).map(function (k) { return names[k]; });
      var hot = keys.filter(function (k) { return HS[k].rsi >= 70; }).map(function (k) { return names[k] + ' RSI ' + Math.round(HS[k].rsi); }), cold = keys.filter(function (k) { return HS[k].rsi <= 30; }).map(function (k) { return names[k] + ' RSI ' + Math.round(HS[k].rsi); });
      var el = d.getElementById('mk-home-sum'); if (!el) { el = mk('div', 'mk-home-sum'); el.id = 'mk-home-sum'; host.parentNode.insertBefore(el, host); }
      el.replaceChildren(); el.appendChild(mk('b', '', '📌 오늘의 한 줄'));
      var t = []; if (up.length) t.push('200일선 위: ' + up.join('·')); if (dn.length) t.push('200일선 아래: ' + dn.join('·')); if (hot.length) t.push('과열 주의: ' + hot.join(', ')); if (cold.length) t.push('과매도: ' + cold.join(', '));
      el.appendChild(mk('span', '', ' ' + (t.join(' · ') || '추세 신호를 계산 중입니다.')));
      el.appendChild(mk('small', '', '대표 지수(S&P500·코스피·비트코인)의 일봉 기준 참고용 요약입니다(투자 권유 아님).'));
    };
    var sigCards = function () {
      $$('.cross-market-links a[data-market]').forEach(function (a) {
        var s = SYM[a.dataset.market]; if (!s || a.dataset.sig === '1') return; a.dataset.sig = '1';
        var row = mk('span', 'mk-sig', '추세 신호 확인 중…'); a.appendChild(row);
        fetch(PROXY + encodeURIComponent('https://query1.finance.yahoo.com/v8/finance/chart/' + s + '?range=1y&interval=1d')).then(function (r) { if (!r.ok) throw 0; return r.json(); }).then(function (j) {
          var q = j.chart.result[0], cl = (q.indicators.quote[0].close || []).filter(function (v) { return v != null && isFinite(v); }), last = cl[cl.length - 1];
          var m5 = ma(cl, 5), m200 = ma(cl, 200), rs = rsi(cl); if (last == null || m5 == null) throw 0;
          row.replaceChildren();
          var add = function (t, c) { row.appendChild(mk('i', c, t)); };
          add('5일선 ' + (last >= m5 ? '▲' : '▼'), last >= m5 ? 'up' : 'dn');
          if (m200 != null) add('200일선 ' + (last >= m200 ? '▲' : '▼'), last >= m200 ? 'up' : 'dn');
          if (rs != null) add('RSI ' + Math.round(rs), rs >= 70 ? 'hot' : rs <= 30 ? 'cold' : '');
          HS[a.dataset.market] = { up200: m200 != null ? last >= m200 : null, rsi: rs }; homeSum();
        }).catch(function () { row.textContent = '추세 신호 일시 불러오기 실패'; row.className = 'mk-sig bad'; });
      });
      var c = $('.cross-market-links a[data-market="crypto"]'); if (c && !c.dataset.fng) {
        c.dataset.fng = '1';
        fetch(PROXY + encodeURIComponent('https://api.alternative.me/fng/?limit=1&format=json')).then(function (r) { return r.json(); }).then(function (j) {
          var v = j && j.data && j.data[0]; if (!v) return; var n = +v.value; if (!isFinite(n)) return;
          var f = mk('span', 'mk-fng', '공포탐욕 ' + n + ' · ' + (n <= 25 ? '극단적 공포' : n <= 45 ? '공포' : n < 55 ? '중립' : n < 75 ? '탐욕' : '극단적 탐욕')); c.appendChild(f);
        }).catch(function () {});
      }
    };
    var tries = 0; (function w() { if ($('.cross-market-links a[data-market]')) { sigCards(); setTimeout(sigCards, 2500); } else if (++tries < 40) setTimeout(w, 400); })();
  }
})();
