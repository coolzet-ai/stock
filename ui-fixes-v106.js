/* ui-fixes-v106 — 공통 보정 (brand-layout.js 다음에 로드)
   · 업데이트 이력 요소 제거(여러 스크립트가 중복 생성하던 것)
   · 미국 섹터 히트맵에 한국 '시장 한눈에 보기'와 같은 -4%~+4% 색 범례 추가 */
(function () {
  'use strict';
  var d = document;
  var $$ = function (s, r) { return Array.prototype.slice.call((r || d).querySelectorAll(s)); };

  /* ── 업데이트 이력 제거 ── */
  function dropHistory() {
    $$('#v92-update-history,#stock-update-history,.cross-update-log').forEach(function (e) { e.remove(); });
    $$('footer details').forEach(function (e) {
      var s = e.querySelector(':scope>summary');
      if (s && /업데이트 이력/.test(s.textContent)) e.remove();
    });
  }

  /* ── 섹터 히트맵 범례 (stock-pulse.js 의 col() 과 같은 색 계산) ── */
  function col(v) {
    var a = Math.min(Math.abs(v) / 4, 1), US = !!(window.MK_CV && window.MK_CV.us);
    var L = v >= 0 ? (US ? [6, 118, 71] : [200, 32, 20]) : (US ? [200, 32, 20] : [26, 111, 168]);
    var g = [110, 118, 112];
    return 'rgb(' + L.map(function (x, i) { return Math.round(g[i] + (x - g[i]) * a); }).join(',') + ')';
  }
  function sectorLegend() {
    var box = d.getElementById('pro-sector'); if (!box) return;
    var old = box.querySelector('.hm-l'); if (old) old.remove();
    var host = box.querySelector('.shm'); if (!host) return;
    var l = d.createElement('div'); l.className = 'hm-l'; l.setAttribute('aria-label', '색 범례: 하락 -4%에서 상승 +4%');
    l.innerHTML = '-4%' + [-4, -1, 0.01, 1, 4].map(function (v) { return '<i style="background:' + col(v) + '"></i>'; }).join('') + '+4%';
    host.after(l);
  }


  /* ── 메인 페이지: 시장 카드에 실시간 등락률(S&P500 · 코스피 · 비트코인) ── */
  var LIVE_CARDS = { 'stock': ['^GSPC', 'S&P 500'], 'kr-stock': ['^KS11', '코스피'], 'crypto': ['BTC-USD', '비트코인'] };
  var PROXY = 'https://ai.coolzet.workers.dev/?url=';
  function liveCards() {
    $$('.cross-market-links a[data-market]').forEach(function (a) {
      var cfg = LIVE_CARDS[a.dataset.market]; if (!cfg || a.dataset.live === '1') return; a.dataset.live = '1';
      var em = d.createElement('em'); em.className = 'mk-live'; em.textContent = cfg[1] + ' —'; a.append(em);
      var ctl = ('AbortController' in window) ? new AbortController() : null, to = setTimeout(function () { if (ctl) ctl.abort(); }, 9000);
      fetch(PROXY + encodeURIComponent('https://query1.finance.yahoo.com/v8/finance/chart/' + cfg[0] + '?range=5d&interval=1d'), ctl ? { signal: ctl.signal } : {})
        .then(function (r) { if (!r.ok) throw 0; return r.json(); }).then(function (j) {
          clearTimeout(to);
          var r0 = j.chart.result[0], m = r0.meta, last = m.regularMarketPrice;
          /* 전일 종가: range=5d 의 chartPreviousClose 는 '5일 전' 종가라 쓰면 안 된다(예전에 코스피가 -8%대로 잘못 표시) */
          var cl = ((r0.indicators && r0.indicators.quote && r0.indicators.quote[0] && r0.indicators.quote[0].close) || []).filter(function (x) { return x != null && isFinite(x); });
          var prev = m.regularMarketPreviousClose != null ? m.regularMarketPreviousClose : (cl.length ? (Math.abs(last / cl[cl.length - 1] - 1) < 1e-6 ? cl[cl.length - 2] : cl[cl.length - 1]) : null);
          if (last == null || !prev) throw 0;
          var v = (last / prev - 1) * 100;
          em.className = 'mk-live ' + (v > 0 ? 'up' : v < 0 ? 'down' : 'flat');
          em.textContent = cfg[1] + ' ' + (v > 0 ? '▲ +' : v < 0 ? '▼ −' : '') + Math.abs(v).toFixed(2) + '%';
        }).catch(function () { clearTimeout(to); });
    });
  }

  /* ── 암호가 필요한 펼치기(상세 보기)에 🔒 표시. 암호를 통과하면 모두 제거 ── */
  var LOCKED = ['.cross-restricted>summary', '#kr-breadth-panel>summary', '#guide>h2 button', '#guide>h2 a'];
  function lockOn() {
    try { if (localStorage.getItem('mk_gate_off') === '1') return false; } catch (e) {}
    return !window.__mkUnlocked;
  }
  function markLocks() {
    if (!lockOn()) { $$('.mk-locked').forEach(function (e) { e.classList.remove('mk-locked'); }); return; }
    LOCKED.forEach(function (sel) { $$(sel).forEach(function (e) { e.classList.add('mk-locked'); }); });
  }
  function wrapGate() {
    var f = window.MK_REQUEST_DETAIL; if (typeof f !== 'function' || f.__mkWrapped) return;
    var w = function (done) { return f.call(this, function () { window.__mkUnlocked = true; markLocks(); if (done) done.apply(this, arguments); }); };
    w.__mkWrapped = true; window.MK_REQUEST_DETAIL = w;
  }

  /* ═══ 실시간 시세 스위치(MK_LIVE) ═══
     Cloudflare Worker 요청·데이터 사용을 줄이기 위해 실시간 갱신은 사용자가 켠 경우에만 돈다(기본 꺼짐).
     켜 두어도 · 탭이 숨겨지면 멈춤 · 10분간 조작이 없으면 일시정지(다시 조작하면 재개) · 데이터 절약 모드(mk_save)면 기본 꺼짐.
     한국주식(kr-live.js)과 미국주식 선물 카드가 이 설정을 함께 쓴다. 저장: mk_live('0'|'1'), mk_live_ms(60000|1800000|3600000).
     켜기는 관리자 모드(암호 인증 후 mk_gate_off=1)에서만 가능하다. 일반 방문자는 저장값이 1이어도 꺼진 것으로 본다.
     (브라우저 저장소 기반이라 서버가 강제하는 보안 장치는 아니며, 일반 이용자의 실수·과다 사용을 막는 용도다.) */
  var DEFAULT_ON = false, IDLE_MS = 10 * 60000, MS_OPTS = [60000, 1800000, 3600000];
  var lastAct = Date.now(), subs = [], btn = null, sel = null, st = { text: '', cls: '' };
  function rd(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function wr(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  var LIVE = window.MK_LIVE = {
    admin: function () { return rd('mk_gate_off') === '1'; },
    on: function () { if (!LIVE.admin()) return false; var v = rd('mk_live'); return v === null ? (DEFAULT_ON && !window.MK_SAVE) : v === '1'; },
    ms: function () { var m = +rd('mk_live_ms'); return MS_OPTS.indexOf(m) >= 0 ? m : 60000; },
    idle: function () { return Date.now() - lastAct > Math.max(IDLE_MS, LIVE.ms() * 2); },
    active: function () { return LIVE.on() && !LIVE.idle() && !d.hidden; },
    set: function (on) { if (on && !LIVE.admin()) { notify(); return; } wr('mk_live', on ? '1' : '0'); lastAct = Date.now(); notify(); },
    setMs: function (ms) { wr('mk_live_ms', String(ms)); notify(); },
    onChange: function (fn) { subs.push(fn); },
    status: function (text, cls) { st = { text: text, cls: cls || '' }; paintSw(); }
  };
  function notify() { paintSw(); subs.forEach(function (f) { try { f(); } catch (e) {} }); }
  function paintSw() {
    if (!btn) return;
    var on = LIVE.on(), idle = on && LIVE.idle(), adm = LIVE.admin();
    var text = !adm ? '🔒 실시간 · 관리자 전용' : !on ? '○ 실시간 꺼짐' : idle ? '⏸ 무조작 일시정지 · 눌러서 재개' : (st.text || '● 실시간 연결 중');
    if (window.innerWidth <= 700 && on && !idle && st.text) text = '● ' + ((st.text.match(/(\d\d:\d\d)/) || [])[1] || st.text.replace(/^● /, '').replace(/프리마켓 |애프터 |선물 /, '')); /* 모바일: 짧게 */
    btn.textContent = text; btn.className = 'mk-live-sw ' + (!adm ? 'locked' : !on ? 'off' : idle ? 'paused' : (st.cls || 'on'));
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    btn.title = !adm ? '실시간 시세는 관리자 모드에서만 켤 수 있습니다(서버 요청 절약)' : !on ? '꺼져 있습니다(서버 요청 절약). 눌러서 실시간 시세를 켭니다' : '눌러서 실시간 시세를 끕니다. 켜 두면 갱신마다 서버 요청이 발생합니다';
    if (sel) { sel.hidden = !on; sel.value = String(LIVE.ms()); }
  }
  function mountSw() {
    if (btn && btn.isConnected) return true;
    var hd = d.querySelector('#pro-brief .pb-hd'); if (!hd) return false;
    btn = d.getElementById('mk-live-sw') || d.createElement('button'); btn.type = 'button'; btn.id = 'mk-live-sw';
    btn.addEventListener('click', function () { if (!LIVE.admin()) { btn.classList.add('shake'); setTimeout(function () { btn.classList.remove('shake'); }, 500); return; } if (LIVE.on() && LIVE.idle()) { lastAct = Date.now(); notify(); } else LIVE.set(!LIVE.on()); });
    sel = d.createElement('select'); sel.id = 'mk-live-ms'; sel.setAttribute('aria-label', '실시간 갱신 주기');
    MS_OPTS.forEach(function (m) { var o = d.createElement('option'); o.value = m; o.textContent = m >= 3600000 ? (m / 3600000) + '시간' : m >= 60000 && m % 60000 === 0 && m > 60000 ? (m / 60000) + '분' : (m / 1000) + '초'; sel.appendChild(o); });
    sel.addEventListener('change', function () { LIVE.setMs(+sel.value); });
    hd.appendChild(btn); hd.appendChild(sel); paintSw(); return true;
  }
  ['pointerdown', 'keydown', 'touchstart', 'scroll'].forEach(function (ev) {
    window.addEventListener(ev, function () { var was = LIVE.on() && LIVE.idle(); lastAct = Date.now(); if (was) notify(); }, { passive: true, capture: true });
  });
  (function () { var n = 0, iv = setInterval(function () { if (mountSw() || ++n > 60) clearInterval(iv); }, 500); })();
  setInterval(paintSw, 20000); /* 무조작 일시정지 표시 반영 */
  LIVE.onChange(function () { if (LIVE.active() && typeof window.__fillFut === 'function') window.__fillFut(); }); /* 미국 선물: 켜면 바로 한 번 */

  /* ═══ 첫 화면 구조 통일(한국주식·가상화폐 → 미국주식과 같은 구조) ═══
     제목(h1) 안에 부제(small) · 소개문(.pg-lead) · 상태 카드(#pro-status: 칩 + 새로고침/모두 접기·펼치기 + 최근 조회) */
  var PAGE = (location.pathname.split('/').pop() || '').replace(/\.html$/, '');
  function z2(v) { return v < 10 ? '0' + v : '' + v; }
  function iconize() { /* 상태 카드 버튼: 모바일용 아이콘을 실제 요소로 넣는다(의사요소 충돌 방지) */
    $$('#pro-status .v87-status-actions button, #pro-status .v90-actions button, #pro-status .mk-status-actions button').forEach(function (b) {
      if (b.querySelector('.mk-ico')) return; var ic = b.dataset.mobileIcon; if (!ic) return;
      var i = d.createElement('i'); i.className = 'mk-ico'; i.setAttribute('aria-hidden', 'true'); i.textContent = ic; b.appendChild(i); });
  }
  function unifyHead() {
    if (PAGE !== 'kr-stock' && PAGE !== 'crypto') return;
    iconize();
    var head = d.querySelector('.v86-page-head'); if (!head) return;
    var h1 = head.querySelector('h1'); if (!h1) return;
    /* 부제: h1 안의 <small> */
    if (!h1.querySelector('small')) {
      var sub = head.querySelector('.kr-page-subtitle'), txt = sub ? sub.textContent.trim() : (PAGE === 'crypto' ? '공포탐욕지수 · 주요 코인 · 시장 한눈에 · 일정' : '');
      if (txt) { var sm = d.createElement('small'); sm.textContent = txt; h1.appendChild(sm); }
    }
    var sub2 = head.querySelector('.kr-page-subtitle'); if (sub2) sub2.hidden = true;
    /* 소개문 */
    $$(':scope>p', head).forEach(function (pp) { if (!pp.classList.contains('v86-eyebrow') && !pp.classList.contains('kr-page-subtitle')) pp.classList.add('pg-lead'); });
    /* 가상화폐: 새로고침·모두 접기/펼치기 버튼을 상태 카드로 옮기고 칩을 만든다 */
    if (PAGE === 'crypto') {
      var st = d.getElementById('pro-status'), act = head.querySelector('.v90-actions');
      if (st && !st.querySelector('.ps-mk')) {
        var c1 = d.createElement('span'); c1.className = 'ps-mk c'; c1.id = 'ps-mk'; c1.textContent = '24시간 거래';
        var c2 = d.createElement('span'); c2.className = 'ps-net w'; c2.id = 'ps-net'; c2.textContent = '● 데이터 확인 중';
        st.insertBefore(c2, st.firstChild); st.insertBefore(c1, st.firstChild);
        var tm = d.createElement('p'); tm.className = 'ps-t'; st.appendChild(tm);
        var upd = function () { var n = new Date(); tm.textContent = '최근 조회 ' + (n.getHours() < 12 ? '오전 ' : '오후 ') + z2(n.getHours() % 12 || 12) + ':' + z2(n.getMinutes()) + ' · 시세 기준은 카드별 표시';
          var ok = !!d.querySelector('#cr-top [id*="val"], #cr-top .big, #cr-top .state'); /* 값이 그려졌는지 */
          var v = d.querySelector('#cr-top'); var has = v && /\d/.test((v.textContent || '').slice(0, 200));
          c2.className = 'ps-net ' + (has ? 'g' : 'w'); c2.textContent = has ? '● 데이터 정상' : '● 데이터 확인 중'; };
        upd(); setInterval(upd, 10000);
      }
      if (st && act && act.parentElement !== st) { act.classList.add('mk-status-actions'); st.appendChild(act); }
    }
  }

  /* ── 메인 페이지 시장 카드: 각 대시보드 제목과 같은 국기·코인 아이콘 ── */
  var BADGES = {'stock':"<svg viewBox=\"0 0 38 26\" role=\"img\" aria-label=\"미국\"><rect width=\"38\" height=\"26\" fill=\"#fff\"></rect><path d=\"M0 1h38M0 5h38M0 9h38M0 13h38M0 17h38M0 21h38M0 25h38\" stroke=\"#bd2937\" stroke-width=\"2\"></path><rect width=\"16\" height=\"14\" fill=\"#244b82\"></rect><path d=\"M3 3h1m3 0h1m3 0h1M3 7h1m3 0h1m3 0h1M3 11h1m3 0h1m3 0h1\" stroke=\"#fff\" stroke-width=\"1.5\"></path></svg>",'kr-stock':"<svg viewBox=\"0 0 38 26\" role=\"img\" aria-label=\"대한민국\"><rect width=\"38\" height=\"26\" fill=\"#fff\"></rect><circle cx=\"19\" cy=\"13\" r=\"6\" fill=\"#cc2433\"></circle><path d=\"M13 13a6 6 0 0 0 12 0c-3 4-3-4-6 0s-3 0-6 0\" fill=\"#215ba7\"></path><g stroke=\"#20252b\" stroke-width=\"1.3\"><path d=\"M5 7l5-4m-4 6 5-4m-4 6 5-4M27 20l5-4m-4 6 5-4m-4 6 5-4M5 18l5 4m-4-6 5 4m-4-6 5 4M27 3l5 4m-4-2 5 4m-4-2 5 4\"></path></g></svg>",'crypto':"<svg viewBox=\"0 0 38 26\" role=\"img\" aria-label=\"가상화폐 글로벌 시장\"><rect width=\"38\" height=\"26\" rx=\"3\" fill=\"#f7931a\"></rect><circle cx=\"19\" cy=\"13\" r=\"10\" fill=\"#f7931a\" stroke=\"#fff\" stroke-width=\"1.4\"></circle><text x=\"19\" y=\"19\" text-anchor=\"middle\" font-size=\"18\" font-family=\"system-ui\" font-weight=\"800\" fill=\"#fff\">₿</text></svg>"};
  function homeBadges() {
    $$('.cross-market-links a[data-market]').forEach(function (a) {
      var b = a.querySelector('b'), svg = BADGES[a.dataset.market]; if (!b || !svg || b.querySelector('.v87-market-badge')) return;
      var sp = d.createElement('span'); sp.className = 'v87-market-badge'; sp.innerHTML = svg; b.insertBefore(sp, b.firstChild);
    });
  }

  /* ── 가상화폐: 상대수익률·소셜 언급 카드 안쪽의 2중 접기를 풀어 한 번에 보이게(미국주식과 동일) ── */
  function flatten() {
    ['cry-rel-card', 'soc-sent', 'soc-rank'].forEach(function (id) {
      var e = d.getElementById(id), card = e && e.closest('.card');
      var body = card && card.querySelector('.market-fold-body'), h = card && card.querySelector('.market-fold-h');
      if (!body || !h) return;
      var hd = card.querySelector(':scope>.fg-hd'), holder = h.closest('.market-card-header'), anchor = hd || h;
      Array.prototype.slice.call(body.childNodes).forEach(function (k) { anchor.parentNode.insertBefore(k, anchor.nextSibling); anchor = k; });
      body.remove();
      var b = h.querySelector('.market-fold-btn'); if (b) b.remove();
      h.classList.remove('market-fold-h'); h.removeAttribute('id');
      if (holder && holder.parentNode) { var rest = Array.prototype.slice.call(holder.childNodes).filter(function (n) { return n !== h && n !== body; }); holder.replaceWith.apply(holder, [h].concat(rest)); }
      card.classList.add('mk-flat');
    });
  }
  /* ── 가상화폐: 🌈 버튼 = 코인 행을 눌렀을 때 열리는 레인보우 차트와 같은 동작 ── */
  d.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('.rb-open-btn'); if (!b) return;
    e.preventDefault(); e.stopPropagation();
    var row = b.closest('.wl-row'); if (row) row.click();
  }, true);
  /* ── 가상화폐 지표 읽는 법: 미국주식과 같은 용어 목록(dl.gl-list) 구성으로 ── */
  function guideCrypto() {
    if (!d.body.classList.contains('v93-crypto')) return;
    var g = d.querySelector('.v95-guide'), box = g && g.querySelector(':scope>div'); if (!box || box.querySelector('dl.gl-list')) return;
    var T = [
      ['공포탐욕지수 (가상화폐)', 'Alternative.me가 변동성·시장 모멘텀과 거래량·소셜 미디어·비트코인 도미넌스·검색 트렌드 등을 종합해 0~100점으로 만든 심리 지표입니다. 0~24 극단적 공포, 25~44 공포, 45~55 중립, 56~75 탐욕, 76~100 극단적 탐욕으로 구분하며 매매 신호를 보장하지 않습니다.'],
      ['가격 · 등락률', '최근 수신 시세이며 가상화폐는 24시간 거래됩니다. 등락률은 선택한 기간(일간·주간·월간·연간)의 기준 가격 대비 변화이고, 제공처 지연 시에는 갱신 시각을 확인하세요.'],
      ['상대수익률 (시작일=100)', '선택한 기간의 시작일 가격을 100으로 맞춰 여러 코인의 흐름을 같은 기준에서 비교하는 방식입니다.'],
      ['RSI · 이동평균선', 'RSI(14일)는 최근 상승·하락 강도를 0~100으로 나타내며 30 이하는 과매도, 70 이상은 과열로 해석합니다. 5일·200일선은 단기·장기 추세의 기준선입니다.'],
      ['레인보우 차트', '가격 이력에 로그 회귀를 적용해 색 밴드로 나눈 근사 모델입니다. 비트코인 외 코인은 이력이 짧아 신뢰도가 낮고, 투자 권유가 아닌 참고용입니다.'],
      ['센티먼트 · 소셜 순위', '센티먼트는 CoinGecko 커뮤니티의 강세·약세 투표 비율, 소셜 순위는 CoinGecko 트렌딩(검색·관심도) 순위입니다. 게시글 수 기준의 참고 지표로 봇·밈에 의해 왜곡될 수 있습니다.'],
      ['ETF 순유입', '현물 ETF로 들어오고 나간 자금의 합계입니다. 순유입이 이어지면 수요 증가, 순유출이 이어지면 이탈로 해석하는 경향이 있으나 가격을 보장하지 않습니다.']
    ];
    box.id = 'v95-guide-content'; box.innerHTML = '<dl class="gl-list">' + T.map(function (t) { return '<dt>' + t[0] + '</dt><dd>' + t[1] + '</dd>'; }).join('') + '</dl>';
    var h = g.querySelector('h2'); if (h) h.id = h.id || 'guide-h'; var bt = g.querySelector('button'); if (bt) bt.setAttribute('aria-controls', 'v95-guide-content');
    g.id = g.id || 'guide';
  }
  /* ── 첫 화면 조립 완료 신호(mk-boot.js): 상태 카드 안에 버튼·칩이 들어간 것을 확인하면 본문을 보여 준다 ── */
  function bootReady() {
    if (!window.__mkBootDone) return;
    if (performance.now() < 2000) return; /* 늦게 도착하는 그래프·차트 영역이 자리를 잡은 뒤에 보여 준다 */
    /* 문서 높이가 600ms 동안 변하지 않을 때만 보여 준다 — 접기 상태 적용·카드 삽입이 늦게 일어나 화면이 밀리는 것을 가린다(최대 6초) */
    var bh = d.documentElement.scrollHeight, bn2 = performance.now();
    if (bh !== bootReady._h) { bootReady._h = bh; bootReady._t = bn2; }
    if (bn2 - (bootReady._t || 0) < 600) return;
    var st = d.getElementById('pro-status') || d.querySelector('.stock-status');
    var ok = false;
    if (st) {
      var hasBtn = !!st.querySelector('button'), hasChip = !!st.querySelector('.ps-mk,.ps-net,.stock-live-badges');
      ok = hasBtn && hasChip && (PAGE !== 'crypto' || !!st.querySelector('.v90-actions,.mk-status-actions'));
    }
    if (ok) setTimeout(window.__mkBootDone, 300);
  }
  /* ── 가상화폐 "주요 코인 가격" 접이식 제목: 다른 접이식 박스처럼 제목 · 가운데 요약 · 버튼 3칸 ── */
  function coinFold() {
    if (PAGE !== 'crypto') return;
    $$('h2.market-fold-h').forEach(function (h) {
      var t = h.querySelector('.market-fold-title'); if (!t || h.querySelector('.fold-sum') || !/^주요 코인 가격/.test(t.textContent.trim())) return;
      t.textContent = '주요 코인 가격';
      var sm = d.createElement('span'); sm.className = 'fold-sum'; sm.textContent = 'BTC · ETH · SOL · XRP';
      var bt = h.querySelector('button'); h.insertBefore(sm, bt || null); h.classList.add('mk-fold-like');
    });
  }
  /* ── 실시간 숫자 변동 번쩍임 + 값 도착 전 스켈레톤 ── */
  var NUM_SEL = '.wl-price,.wl-pct,#pro-tick .pt b,#pro-tick .pt i,.pb-c>b,.pb-c>span,.pf-t b,.pf-t>span,.kt-c b,.kt-d,.px,.ch';
  var SKEL_RE = /^(--|—|-- --|-)$/;
  function numOf(t) { var m = String(t).replace(/[,\s]/g, '').replace(/−/g, '-').match(/-?\d+(?:\.\d+)?/); return m ? parseFloat(m[0]) : NaN; }
  function touchNum(el) {
    var t = (el.textContent || '').trim();
    if (el._mkTxt === t) return;
    var old = el._mkTxt; el._mkTxt = t;
    var sk = SKEL_RE.test(t) && !el.querySelector('*') && !el.closest('.kt-c.na') && performance.now() < 15000;
    if (sk !== el.classList.contains('mk-skel')) el.classList.toggle('mk-skel', sk);
    if (sk || old == null || SKEL_RE.test(old)) return;
    var a = numOf(old), b = numOf(t); if (!isFinite(a) || !isFinite(b) || a === b) return;
    var cls = b > a ? 'mk-fl-up' : 'mk-fl-dn';
    el.classList.remove('mk-fl-up', 'mk-fl-dn'); void el.offsetWidth; el.classList.add(cls);
    clearTimeout(el._mkT); el._mkT = setTimeout(function () { el.classList.remove('mk-fl-up', 'mk-fl-dn'); }, 1000);
  }
  /* 15초가 지나도 값이 없으면(= 오류) 스켈레톤을 걷고 원래 표시('--')를 보여 준다 */
  setTimeout(function () { $$('.mk-skel').forEach(function (e) { e.classList.remove('mk-skel'); }); }, 15200);
  var numQ = [], numRaf = 0;
  function numFlush() { numRaf = 0; var q = numQ; numQ = []; q.forEach(function (e) { if (e.isConnected) { try { touchNum(e); } catch (x) {} } }); }
  function numScan() { $$(NUM_SEL).forEach(touchNum); }
  try {
    new MutationObserver(function (recs) {
      for (var i = 0; i < recs.length; i++) {
        var t = recs[i].target; var el = t.nodeType === 3 ? t.parentElement : t; if (!el || !el.closest) continue;
        var hit = el.closest(NUM_SEL); if (hit && numQ.indexOf(hit) < 0) numQ.push(hit);
      }
      if (numQ.length && !numRaf) numRaf = requestAnimationFrame(numFlush);
    }).observe(d.body || d.documentElement, { childList: true, characterData: true, subtree: true });
  } catch (e) {}

  /* ── 목차 현재 위치 표시(스크롤 스파이) ── */
  var SPY = {
    'stock': [['#pro-brief'], ['#us-card'], ['#pro-sector'], ['#pro-int'], ['#pro-cal'], ['h:주요 지수 ETF'], ['h:김군 관심종목'], ['h:시가총액'], ['h:레버리지'], ['h:소셜 언급'], ['h:유니콘'], ['h:주요 이벤트'], ['h:지수 편입']],
    'kr-stock': [['#pro-brief'], ['#kr-card'], ['h:투자자별'], ['h:코스피·코스닥'], ['h:시가총액 TOP10 (코스피)'], ['h:시가총액 TOP10 (코스닥)'], ['h:레버리지'], ['h:주요 이벤트'], ['h:KOSPI200']]
  };
  function spyTarget(sel) {
    if (!sel) return null;
    if (sel.indexOf('h:') === 0) { var k = sel.slice(2); return $$('h2.fold-h').filter(function (h) { return (h.textContent || '').replace(/\s+/g, ' ').trim().indexOf(k) === 0; })[0] || null; }
    return d.querySelector(sel);
  }
  var spyRaf = 0;
  function spyUpdate() {
    spyRaf = 0;
    var toc = d.getElementById('pro-toc') || d.getElementById('cr-toc'); if (!toc) return;
    var links = $$('a', toc), hh = (d.querySelector('header') || {}).offsetHeight || 0, line = hh + (toc.offsetHeight || 0) + 40, best = -1;
    links.forEach(function (a, i) {
      var sel = (a.getAttribute('href') || '').length > 1 && a.getAttribute('href').charAt(0) === '#' ? a.getAttribute('href') : (SPY[PAGE] && SPY[PAGE][i] ? SPY[PAGE][i][0] : null);
      var t = spyTarget(sel); if (t && t.getBoundingClientRect().top <= line) best = i;
    });
    links.forEach(function (a, i) { a.classList.toggle('mk-spy', i === best); });
  }
  window.addEventListener('scroll', function () { if (!spyRaf) spyRaf = requestAnimationFrame(spyUpdate); }, { passive: true });

  /* ── 이어보기 배너: 한 세션에 한 번만 ── */
  function resumeOnce() {
    var r = d.getElementById('mk-resume'); if (!r || r._seen) return; r._seen = 1;
    try { if (sessionStorage.getItem('mk_resume_seen') === '1') r.remove(); else sessionStorage.setItem('mk_resume_seen', '1'); } catch (e) {}
  }
  /* ── 메인 페이지: 지표 읽는 법·다른 메뉴 더보기 삭제 ── */
  function homeClean() {
    if (PAGE !== 'mrkim-signal') return;
    $$('.v95-guide,details.cross-more').forEach(function (e) { e.remove(); });
  }
  /* ── 접이식 버튼의 +/− 기호를 다른 버튼과 같은 ➕/➖ 이모티콘으로(주요 코인 가격 등) ── */
  function foldEmoji() {
    $$('.market-fold-btn').forEach(function (b) {
      var fix = function () {
        var t = b.textContent, n = t.replace(/\s*[+＋]\s*$/, ' ➕').replace(/\s*[−-]\s*$/, ' ➖');
        if (n !== t) b.textContent = n;
      };
      fix();
      if (!b._mkEm) { b._mkEm = 1; try { new MutationObserver(fix).observe(b, { childList: true, characterData: true, subtree: true }); } catch (e) {} }
    });
  }
  /* ── 내 투자 도구 · 종목 비교: 미국주식과 같은 방식(종목 1·2·3 입력칸 + 비교 버튼, 기간은 결과의 기간 버튼) ── */
  var CMP_DEF = { 'kr-stock': ['삼성전자', 'SK하이닉스', 'NAVER'], 'crypto': ['비트코인', '이더리움', '솔라나'] };
  function unifyCompare() {
    var def = CMP_DEF[PAGE]; if (!def) return;
    var form = d.querySelector('#unified-tools [data-panel=compare] form'); if (!form || form._mkU) return;
    var sel = form.elements.months, btn = form.querySelector('button[type=submit],button:not([type])'); if (!sel || !btn) return;
    form._mkU = 1;
    var SK = 'mk_cmp_' + PAGE, sv = null;
    try { sv = JSON.parse(localStorage.getItem(SK) || 'null'); } catch (e) {}
    if (sv && !Array.isArray(sv.v)) sv = null;
    $$('input[name^=compare]', form).forEach(function (i, n) {
      if (!i.value) { var sval = sv && typeof sv.v[n] === 'string' ? sv.v[n].slice(0, 40) : ''; i.value = sval || (sv ? '' : def[n] || ''); if (sval && sv.s && typeof sv.s[n] === 'string' && /^[A-Za-z0-9.\-^=]{1,20}$/.test(sv.s[n])) { i.dataset.sym = sv.s[n]; i.dataset.nm = sval; } }
      i.setAttribute('aria-label', '비교 종목 ' + (n + 1)); });
    var svM = sv && [1, 3, 6, 12, 36, 60, 120].indexOf(+sv.m) >= 0 ? +sv.m : 12;
    [[1, '1개월'], [3, '3개월'], [6, '6개월']].forEach(function (x) { if (!$$('option', sel).some(function (o) { return +o.value === x[0]; })) { var o = d.createElement('option'); o.value = x[0]; o.textContent = x[1]; sel.insertBefore(o, sel.firstChild); } });
    var PERIODS = [['1개월', 1], ['3개월', 3], ['6개월', 6], ['1년', 12], ['3년', 36], ['5년', 60], ['10년', 120]];
    var lab = sel.closest('label'); if (lab) lab.hidden = true;
    sel.value = String(svM); btn.textContent = '비교';
    var sec = form.closest('section'), h3 = sec.querySelector('h3');
    if (h3) { h3.textContent = '🔍 종목 비교 '; h3.insertAdjacentHTML('beforeend', '<span class="cm-note">최대 3개 · 시세 기준 계산</span>'); }
    var old = sec.querySelector('.ut-compare-chart'); if (old) old.hidden = true;
    var out = d.createElement('div'); out.className = 'ucm-r'; form.after(out);
    var COL = ['#16865c', '#4386db', '#d5872a'], NAMES = { 'BTC-USD': '비트코인', 'ETH-USD': '이더리움', 'SOL-USD': '솔라나', 'XRP-USD': '리플', 'BNB-USD': '바이낸스코인', 'DOGE-USD': '도지코인', 'ADA-USD': '에이다' };
    var data = [], months = svM, serial = 0, lastRes = [], bench = null, BSYM = PAGE === 'kr-stock' ? '^KS11' : 'QQQ', BNAME = PAGE === 'kr-stock' ? '코스피' : 'QQQ';
    function saveCmp() {
      try {
        var k = 0, v = [], sy = [];
        $$('input[name^=compare]', form).forEach(function (i) { var t = i.value.trim(); v.push(t); sy.push(t && lastRes[k] ? (lastRes[k].sym || '') : ''); if (t) k++; });
        localStorage.setItem(SK, JSON.stringify({ v: v, s: sy, m: months }));
      } catch (er) {}
    }
    var esc = function (x) { return String(x).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
    var msg = function (t) { var m = d.querySelector('#unified-tools .ut-message'); if (m) m.textContent = t || ''; };
    var fp = function (v) { return v == null ? '<span class="na">—</span>' : '<span class="' + (v > 0 ? 'up' : v < 0 ? 'dn' : '') + '">' + (v > 0 ? '+' : '') + v.toFixed(2) + '%</span>'; };
    var cut = function (end, m) { var x = new Date(end), day = x.getUTCDate(); x.setUTCDate(1); x.setUTCMonth(x.getUTCMonth() - m); x.setUTCDate(Math.min(day, new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth() + 1, 0)).getUTCDate())); return +x; };
    var ymd = function (t) { var x = new Date(t); return x.getUTCFullYear() + '.' + (x.getUTCMonth() + 1) + '.' + x.getUTCDate(); };
    var hangul = function (x) { return /[가-힣]/.test(x); };
    var saved = function () { try { return JSON.parse(localStorage.getItem('mk_kr_symbol_names') || '{}') || {}; } catch (e) { return {}; } };
    var price = function (c, v) { if (c.cur === 'KRW') return '₩' + Math.round(v).toLocaleString('ko-KR'); var pre = c.cur === 'USD' ? '$' : ''; return pre + (v < 1 ? v.toFixed(4) : v < 100 ? v.toFixed(2) : v.toLocaleString('en-US', { maximumFractionDigits: 2 })); };
    function at(pts, t) { var r = null; for (var i = 0; i < pts.length; i++) { if (pts[i].t <= t) r = pts[i]; else break; } return r; }
    function metrics(c) {
      var pts = c.pts, last = pts[pts.length - 1], px = c.px || last.v, end = last.t, D = 86400000;
      var pc = function (b) { return b && b.v ? (px / b.v - 1) * 100 : null; };
      var yr = pts.filter(function (p) { return p.t >= cut(end, 12); }), hi = yr.length ? Math.max.apply(null, yr.map(function (p) { return p.v; })) : null;
      var prev = c.prev || (pts.length > 1 ? pts[pts.length - 2].v : null);
      var yr2 = function (m) { return pts[0].t <= cut(end, m) + 7 * D ? pc(at(pts, cut(end, m))) : null; };
      return { px: px, d1: prev ? (px / prev - 1) * 100 : null, w: pc(at(pts, end - 7 * D)), m: pc(at(pts, cut(end, 1))), y: pts[0].t <= cut(end, 12) ? pc(at(pts, cut(end, 12))) : null, y3: yr2(36), y5: yr2(60), y10: yr2(120), hi: hi ? (px / hi - 1) * 100 : null };
    }
    function draw() {
      var host = out.querySelector('.ucm-svg'), lg = out.querySelector('.ucm-lg'); if (!host) return;
      var end = Math.max.apply(null, data.map(function (c) { return c.pts[c.pts.length - 1].t; })), start = cut(end, months);
      var ser = data.map(function (c, i) { var p = c.pts.filter(function (x) { return x.t >= start && x.t <= end; }); return p.length > 1 ? { n: c.name, i: i, t: p.map(function (x) { return x.t; }), y: p.map(function (x) { return (x.v / p[0].v - 1) * 100; }) } : null; }).filter(Boolean);
      if (!ser.length) { host.innerHTML = '<p class="mut">선택 기간에 표시할 시세가 없습니다.</p>'; lg.innerHTML = ''; return; }
      var bs = null; if (bench && bench.length > 1) { var bp = bench.filter(function (x) { return x.t >= start && x.t <= end; }); if (bp.length > 1) bs = { y: bp.map(function (x) { return (x.v / bp[0].v - 1) * 100; }), t: bp.map(function (x) { return x.t; }) }; }
      var lo = 0, hi = 0; ser.concat(bs ? [{ y: bs.y }] : []).forEach(function (s) { s.y.forEach(function (v) { if (v < lo) lo = v; if (v > hi) hi = v; }); });
      var span = hi - lo || 1; lo -= span * .06; hi += span * .06;
      var W = 520, H = 320, pl = 58, pr = 12, pt = 12, pb = 30, X = function (t) { return pl + (W - pl - pr) * (t - start) / ((end - start) || 1); }, Y = function (v) { return pt + (H - pt - pb) * (1 - (v - lo) / (hi - lo)); };
      var raw = (hi - lo) / 4, pw = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / pw, step = (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * pw, g = '';
      for (var v = Math.ceil(lo / step) * step; v <= hi; v += step) g += '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + Y(v).toFixed(1) + '" y2="' + Y(v).toFixed(1) + '" class="ucm-gl' + (Math.abs(v) < step / 100 ? ' z' : '') + '"/><text x="' + (pl - 6) + '" y="' + (Y(v) + 4).toFixed(1) + '" text-anchor="end" class="ucm-tx">' + (v > 0 ? '+' : '') + v.toFixed(0) + '%</text>';
      g += '<text x="' + pl + '" y="' + (H - 7) + '" class="ucm-tx">' + ymd(start) + '</text><text x="' + (W - pr) + '" y="' + (H - 7) + '" text-anchor="end" class="ucm-tx">' + ymd(end) + '</text>';
      var ln = ser.map(function (s) { return '<polyline fill="none" stroke="' + COL[s.i] + '" stroke-width="2" stroke-linejoin="round" points="' + s.y.map(function (v, k) { return X(s.t[k]).toFixed(1) + ',' + Y(v).toFixed(1); }).join(' ') + '"/>'; }).join('');
      if (bs) ln += '<polyline fill="none" stroke="#6b7782" stroke-width="2" stroke-dasharray="5 4" stroke-linejoin="round" points="' + bs.y.map(function (v, k) { return X(bs.t[k]).toFixed(1) + ',' + Y(v).toFixed(1); }).join(' ') + '"/>';
      host.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="종목별 누적 수익률 곡선">' + g + ln + '</svg>';
      lg.innerHTML = ser.map(function (s) { var e = s.y[s.y.length - 1]; return '<span><i style="background:' + COL[s.i] + '"></i><b>' + esc(s.n) + '</b> <em class="' + (e > 0 ? 'up' : e < 0 ? 'dn' : '') + '">' + (e > 0 ? '+' : '') + e.toFixed(2) + '%</em></span>'; }).join('') + (bs ? '<span><i style="background:#6b7782"></i><b>' + BNAME + '</b> <small class="mut">벤치마크</small> <em class="' + (bs.y[bs.y.length - 1] > 0 ? 'up' : bs.y[bs.y.length - 1] < 0 ? 'dn' : '') + '">' + (bs.y[bs.y.length - 1] > 0 ? '+' : '') + bs.y[bs.y.length - 1].toFixed(2) + '%</em></span>' : '');
    }
    function render() {
      var cols = data.map(function (c) { return c.pts ? metrics(c) : null; });
      var row = function (l, fn) { return '<tr><th scope="row">' + l + '</th>' + data.map(function (c, i) { return '<td class="n">' + (cols[i] ? fn(cols[i], c) : '—') + '</td>'; }).join('') + '</tr>'; };
      var tbl = '<table class="ucm-t"><thead><tr><th></th>' + data.map(function (c, i) { return '<th class="n"><i style="background:' + COL[i] + '"></i>' + esc(c.name) + (c.pts ? '' : '<br><small class="na">조회 실패</small>') + '</th>'; }).join('') + '</tr></thead><tbody>' +
        row('현재가', function (m, c) { return '<b>' + price(c, m.px) + '</b>'; }) + row('1일', function (m) { return fp(m.d1); }) + row('1주', function (m) { return fp(m.w); }) + row('1개월', function (m) { return fp(m.m); }) + row('1년', function (m) { return fp(m.y); }) + row('3년', function (m) { return fp(m.y3); }) + row('5년', function (m) { return fp(m.y5); }) + row('10년', function (m) { return fp(m.y10); }) + row('52주 고점 대비', function (m) { return fp(m.hi); }) + '</tbody></table>';
      data = data.filter(function (c) { return c.pts; }).length ? data : data;
      out.innerHTML = '<div class="ucm-grid"><div class="ucm-tb">' + tbl + '</div><div class="ucm-ch"><div class="ucm-chh"><b>수익률 곡선</b><span class="ucm-rg" role="group" aria-label="기간">' + PERIODS.map(function (x) { return '<button type="button" data-m="' + x[1] + '"' + (x[1] === months ? ' class="on"' : '') + '>' + x[0] + '</button>'; }).join('') + '</span></div><div class="ucm-svg"></div><div class="ucm-lg"></div></div></div>' +
        '<p class="ucm-note">곡선은 일봉 종가 기준 가격 수익률(배당·세금·환율 제외)이며 시세가 제공되는 구간만 표시합니다. 3·5·10년 값은 해당 기간 시세가 있는 종목만 나오고 없으면 —입니다. 점선은 벤치마크('+(PAGE==='kr-stock'?'코스피':'QQQ')+')입니다.</p>';
      var ok = data; data = data.filter(function (c) { return c.pts; }); draw(); data = ok;
    }
    async function fetchOne(sym) {
      var url = 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(sym) + '?range=10y&interval=1d';
      var j = typeof getJSON === 'function' ? await getJSON(url) : await fetch('https://ai.coolzet.workers.dev/?url=' + encodeURIComponent(url)).then(function (r) { return r.json(); });
      var r = j.chart.result[0], cl = r.indicators.quote[0].close, pts = [];
      r.timestamp.forEach(function (t, i) { if (cl[i] > 0) pts.push({ t: t * 1000, v: cl[i] }); });
      if (pts.length < 2) throw Error('no data');
      return { pts: pts, px: r.meta.regularMarketPrice, prev: r.meta.regularMarketPreviousClose, cur: r.meta.currency, nm: r.meta.longName || r.meta.shortName };
    }
    var go = async function (e) {
      if (e) e.preventDefault();
      var vals = $$('input[name^=compare]', form).map(function (i) { return i.value.trim(); }).filter(Boolean);
      if (!vals.length) { msg('비교할 종목을 입력해 주세요.'); return; }
      var my = ++serial; msg(''); out.innerHTML = '<p class="mut">수익률을 불러오는 중…</p>';
      var resolver = window.MK_KR_RESOLVE_SYMBOL || window.MK_CRYPTO_RESOLVE_SYMBOL, nm = saved();
      var benchP = fetchOne(BSYM).then(function (q) { return q.pts; }).catch(function () { return null; });
      var res = await Promise.all(vals.map(async function (v) {
        var sym, c = { name: v, pts: null }; var inEl = $$('input[name^=compare]', form).filter(function (i) { return i.value.trim() === v; })[0];
        try { sym = (inEl && inEl.dataset.sym && inEl.value === inEl.dataset.nm) ? inEl.dataset.sym : (resolver ? await resolver(v) : v).toUpperCase(); } catch (er) { msg('종목을 찾지 못했습니다: ' + v); sym = /^[A-Z0-9.\-]+$/i.test(v) ? v.toUpperCase() : null; }
        if (!sym) return c; c.sym = sym;
        c.name = hangul(v) ? v : (NAMES[sym] || nm[sym] || sym);
        if (!hangul(c.name) && /\.(KS|KQ)$/.test(sym) && window.MK_KR_NAME) { try { var kn = await window.MK_KR_NAME(sym, ''); if (kn && hangul(kn)) c.name = kn; } catch (er) {} }
        try { var q = await fetchOne(sym); c.pts = q.pts; c.px = q.px; c.prev = q.prev; c.cur = q.cur || (/\.(KS|KQ)$/.test(sym) ? 'KRW' : 'USD'); } catch (er) {}
        return c;
      }));
      if (my !== serial) return;
      bench = await benchP; data = res; render();
      lastRes = res; saveCmp();
      $$('input[name^=compare]', form).filter(function (i) { return i.value.trim(); }).forEach(function (i, k) { var c = res[k]; if (c && c.sym && c.name && c.name !== c.sym && c.pts && i.value.trim() !== c.name) { i.dataset.sym = c.sym; i.dataset.nm = c.name; i.value = c.name; } });
    };
    form.onsubmit = go; form.addEventListener('submit', function (e) { e.preventDefault(); }, true);
    out.addEventListener('click', function (e) { var b = e.target.closest('button[data-m]'); if (!b) return; months = +b.dataset.m; sel.value = String(months); if (lastRes.length) saveCmp(); else try { localStorage.setItem(SK, JSON.stringify({ v: $$('input[name^=compare]', form).map(function (i) { return i.value.trim(); }), s: [], m: months })); } catch (er) {} $$('button', out).forEach(function (x) { x.classList.toggle('on', x === b); }); var ok = data; data = data.filter(function (c) { return c.pts; }); draw(); data = ok; });
    var nav = d.querySelector('#unified-tools [data-tool=compare]'); if (nav) nav.addEventListener('click', function () { if (!data.length) setTimeout(go, 0); }, { once: true });
  }

  /* ═══ 레버리지 ETF 연속 하락 박스(미국·한국 공통) ═══
     연속 하락 일수별 색(2연속 노랑 → 3연속 주황 → 4연속+ 빨강)과 누적 하락률 막대로 한눈에 보이게 한다.
     rows: [{n:표시명, s:연속일수, c:연속 하락 구간 누적 등락률(%)}] (s>=2 만) */
  window.mkLevHtml = function (rows, total) {
    var esc = function (x) { return String(x).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
    var c2 = 0, c3 = 0, c4 = 0, cx = 0;
    rows.forEach(function (r) { if (r.s === 2) c2++; else if (r.s === 3) c3++; else c4++; if (r.c <= -30) cx++; });
    rows = rows.slice().sort(function (a, b) { return b.s - a.s || a.c - b.c; });
    var mx = Math.max(30, Math.max.apply(null, rows.map(function (r) { return Math.abs(r.c); }).concat([0])));
    var LIM = (window.innerWidth <= 700 ? 5 : 10), shown = rows.slice(0, LIM);
    var tile = function (cls, n, l) { return '<span class="lv2-t ' + cls + (n ? ' on' : '') + '"><b>' + n + '</b><em>' + l + '</em></span>'; };
    var list = shown.length ? shown.map(function (r) {
      var k = r.s >= 4 ? 's4' : r.s === 3 ? 's3' : 's2', w = Math.min(100, Math.abs(r.c) / mx * 100);
      return '<span class="lv2-r ' + k + (r.c <= -30 ? ' x' : '') + '"><i class="lv2-b">' + r.s + '일</i><span class="lv2-n">' + esc(r.n) + '</span><span class="lv2-g"><u style="width:' + w.toFixed(0) + '%"></u></span><b class="lv2-c">' + (r.c <= -30 ? '⚠ ' : '') + '−' + Math.abs(r.c).toFixed(1) + '%</b></span>';
    }).join('') : '<em class="lv2-none">연속 하락 중인 종목이 없습니다</em>';
    return '<small>레버리지 ETF 연속 하락 <span class="lv-n">' + total + '종목 기준 · 종가 기준 연속 하락일 · 누적 하락률</span></small>' +
      '<div class="lv2-sum">' + tile('s2', c2, '2연속') + tile('s3', c3, '3연속') + tile('s4', c4, '4연속 이상') + tile('sx', cx, '−30% 초과') + '</div>' +
      '<div class="lv2-list">' + list + '</div>' + (rows.length > LIM ? '<span class="lv2-more">외 ' + (rows.length - LIM) + '종목 · 아래 표에서 전체 확인</span>' : '');
  };


  /* ═══ 내 투자 도구 입력칸: 종목 코드(005930.KS · BTC-USD)를 입력하면 한글 종목명으로 바꿔 보여 준다 ═══
     값은 dataset.sym 에 코드를 보관하고, 제출 직전에만 코드로 되돌렸다가 곧바로 한글명으로 복원한다. */
  function nameInputs() {
    if (PAGE !== 'kr-stock' && PAGE !== 'crypto') return;
    var hub = d.getElementById('unified-tools'); if (!hub) return;
    var CN = { 'BTC-USD': '비트코인', 'ETH-USD': '이더리움', 'SOL-USD': '솔라나', 'XRP-USD': '리플', 'BNB-USD': '바이낸스코인', 'DOGE-USD': '도지코인', 'ADA-USD': '에이다' };
    var RE = PAGE === 'kr-stock' ? /^[0-9A-Z]{6}\.(KS|KQ)$/i : /^[A-Z0-9]{2,10}-USD$/i;
    var skip = function (n) { return !n || n === '종목명 미수신'; };
    async function nameOf(sym) {
      sym = sym.toUpperCase();
      if (CN[sym]) return CN[sym];
      if (PAGE === 'kr-stock' && window.MK_KR_NAME) { var n = await window.MK_KR_NAME(sym, ''); return skip(n) || !/[가-힣]/.test(n) ? null : n; }
      return null;
    }
    $$('form', hub).forEach(function (form) {
      var ins = $$('input[name^=compare], input[name=ticker]', form).filter(function (i) { return !i._mkN; });
      if (!ins.length) return;
      ins.forEach(function (i) {
        i._mkN = 1;
        i.addEventListener('input', function () { if (i.dataset.nm && i.value !== i.dataset.nm) { delete i.dataset.sym; delete i.dataset.nm; } });
        i.addEventListener('change', async function () {
          var v = i.value.trim(); if (!RE.test(v) || i.dataset.sym) return;
          var n = null; try { n = await nameOf(v); } catch (e) {}
          if (n && i.value.trim() === v) { i.dataset.sym = v.toUpperCase(); i.dataset.nm = n; i.value = n; }
        });
      });
      if (form._mkNs) return; form._mkNs = 1;
      form.addEventListener('submit', function () {
        var sw = $$('input', form).filter(function (i) { return i.dataset.sym && i.value === i.dataset.nm; });
        sw.forEach(function (i) { i.value = i.dataset.sym; });
        setTimeout(function () { sw.forEach(function (i) { if (i.value === i.dataset.sym) i.value = i.dataset.nm; }); }, 0);
      }, true);
    });
  }

  /* 한 기능에서 오류가 나도 나머지(특히 상태 카드 정리 unifyHead)가 멈추지 않도록 각각 따로 실행 */
  function run() {
    [homeClean, coinFold, foldEmoji, unifyCompare, nameInputs, guideCrypto, flatten, dropHistory, sectorLegend, liveCards, homeBadges, wrapGate, markLocks, unifyHead, numScan, spyUpdate, resumeOnce, bootReady].forEach(function (fn) { try { fn(); } catch (e) { if (window.console) console.warn('[ui-fixes]', fn.name, e); } });
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', run); else run();
  var bn = 0, bt = setInterval(function () { if (!window.__mkBootDone || ++bn > 40) { clearInterval(bt); return; } try { unifyHead(); } catch (e) {} bootReady(); }, 150);
  [800, 2000, 4500, 9000].forEach(function (t) { setTimeout(run, t); });
})();
