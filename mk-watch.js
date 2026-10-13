/* 김군 관심종목 — 검색해서 추가 · ✕ 로 삭제 (미국주식 #tick-tbl, 한국주식 #krwl-tbl)
   저장: 이 브라우저(localStorage)만. 기본 종목은 삭제해도 "기본값 복원"으로 되돌릴 수 있다.
   · 미국: 기존 정적 행(QLD·USD·…)은 그대로 두고, 삭제 목록(del)과 추가 목록(add)만 저장
   · 한국: 기본 6종목 + 추가 목록을 스크립트가 행으로 만든다(종목명은 한글) */
(function () {
  'use strict';
  var d = document, PAGE = (location.pathname.split('/').pop() || '').replace(/\.html$/, '');
  var CFG = {
    'stock': { group: 'tick', table: 'tick-tbl', key: 'mk_wl_us', kr: false, max: 20 },
    'kr-stock': { group: 'krwl', table: 'krwl-tbl', key: 'mk_wl_kr', kr: true, max: 20, defaults: [
      ['161510.KS', 'PLUS 고배당주', 'ETF'], ['086790.KS', '하나금융지주'], ['316140.KS', '우리금융지주'],
      ['000815.KS', '삼성화재우'], ['005387.KS', '현대차2우B'], ['088980.KS', '맥쿼리인프라']] }
  }[PAGE];
  if (!CFG) return;
  var RE = CFG.kr ? /^[0-9A-Z]{6}\.(KS|KQ)$/ : /^[A-Z0-9.^=\-]{1,15}$/;
  var esc = function (x) { return String(x == null ? '' : x).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var st = (function () { try { var o = JSON.parse(localStorage.getItem(CFG.key) || '{}') || {}; return { add: (Array.isArray(o.add) ? o.add : []).filter(function (a) { return Array.isArray(a) && RE.test(a[0]); }).slice(0, CFG.max), del: (Array.isArray(o.del) ? o.del : []).filter(function (t) { return RE.test(t); }) }; } catch (e) { return { add: [], del: [] }; } })();
  var save = function () { try { localStorage.setItem(CFG.key, JSON.stringify(st)); } catch (e) {} };
  var host, msg, inp, dl, undo = null, tmr = null;
  var say = function (t, bad) { if (!msg) return; msg.textContent = t || ''; msg.className = 'mw-msg' + (bad ? ' bad' : ''); };
  var list = function () { return TICKGROUPS[CFG.group].list; };
  var rows = function () { return Array.prototype.slice.call(host.querySelectorAll('.wl-row')); };
  var per = function () { return (typeof curPer !== 'undefined' && curPer[CFG.group]) || 'd'; };

  function rowHtml(t, name, tag) {
    if (CFG.kr) {
      var c = t.slice(0, 6);
      return '<div class="wl-row" data-t="' + t + '" data-mw="1"><div class="wl-bar"></div><div class="wl-info"><div class="wl-tag">' + esc(tag || '관심') + ' · ' + c + '</div><div class="wl-name"><a href="https://finance.naver.com/item/main.naver?code=' + c + '" target="_blank" rel="noopener" title="네이버 증권에서 ' + esc(name) + ' 보기">' + esc(name) + '</a></div></div><div class="wl-spark"></div><div class="wl-quote"><div class="px wl-price">--</div><div class="ch wl-pct">--</div><div class="wl-52w"></div></div>' +
        '<div class="wl-actions"><a href="https://finance.naver.com/item/main.naver?code=' + c + '" target="_blank" rel="noopener" title="네이버 증권에서 상세 지표 보기">+</a><a href="https://finance.yahoo.com/quote/' + t + '/news/" target="_blank" rel="noopener" class="news-link" title="관련 최신 뉴스 보기">N</a></div></div>';
    }
    var q = encodeURIComponent('$' + t + ' from:trendspider');
    return '<div class="wl-row" data-t="' + t + '" data-mw="1"><div class="wl-bar"></div><div class="wl-info"><div class="wl-tag">' + esc(name && name !== t ? '추가 · ' + name : '추가한 종목') + '</div><div class="wl-name"><a href="https://finviz.com/quote.ashx?t=' + t + '" target="_blank" rel="noopener">' + esc(t) + '</a></div></div><div class="wl-spark"></div><div class="wl-quote"><div class="px wl-price">--</div><div class="ch wl-pct">--</div><div class="wl-52w"></div></div>' +
      '<div class="wl-actions"><a href="https://finviz.com/quote.ashx?t=' + t + '" target="_blank" rel="noopener" title="Finviz에서 ' + esc(t) + ' 상세 지표 보기">+</a><a href="https://x.com/search?q=' + q + '&f=live" target="_blank" rel="noopener" class="ts-link" title="X 검색">X</a></div></div>';
  }
  function decorate() { /* 모든 행에 ✕ 삭제 버튼 */
    rows().forEach(function (r) { var a = r.querySelector('.wl-actions'); if (!a || a.querySelector('.mw-del')) return; var b = d.createElement('button'); b.type = 'button'; b.className = 'mw-del'; b.dataset.t = r.dataset.t; b.title = '목록에서 삭제'; b.setAttribute('aria-label', r.dataset.t + ' 삭제'); b.textContent = '✕'; a.appendChild(b); });
  }
  var fetching = {};
  async function ensureData(ts) {
    await Promise.all(ts.map(async function (t) { if (tickData[t] && tickData[t].length > 3) return; if (fetching[t]) return fetching[t]; fetching[t] = yclose(t, '1y').then(function (v) { if (v) tickData[t] = v; }); await fetching[t]; delete fetching[t]; }));
    try { renderTick(CFG.group, per()); } catch (e) {}
  }
  function removeRow(t) { rows().forEach(function (r) { if (r.dataset.t !== t) return; var nx = r.nextElementSibling; if (nx && /^etf-hold-|^fin-/.test(nx.id || '')) nx.remove(); r.remove(); }); var L = list(), i = L.indexOf(t); if (i >= 0) L.splice(i, 1); }
  function isDefault(t) { return CFG.kr ? CFG.defaults.some(function (x) { return x[0] === t; }) : !!(baseSet && baseSet[t]); }
  var baseSet = null, baseHtml = {};

  function addTicker(t, name, tag) {
    if (rows().some(function (r) { return r.dataset.t === t; })) { say(t + ' 는 이미 목록에 있습니다.', 1); return false; }
    if (rows().length >= CFG.max + (CFG.kr ? CFG.defaults.length : 10)) { say('너무 많습니다. 몇 개를 삭제한 뒤 추가해 주세요.', 1); return false; }
    host.insertAdjacentHTML('beforeend', rowHtml(t, name, tag)); list().push(t); decorate();
    return true;
  }
  async function submit(e) {
    e.preventDefault(); var v = (inp.value || '').trim(); if (!v) return;
    var t = v.toUpperCase().replace(/\s+/g, ''), name = v;
    say('종목 확인 중…');
    try {
      if (CFG.kr) {
        if (!/^[0-9A-Z]{6}\.(KS|KQ)$/.test(t)) { if (!window.MK_KR_RESOLVE_SYMBOL) throw Error('종목 검색 기능을 불러오는 중입니다. 잠시 후 다시 시도해 주세요.'); t = await window.MK_KR_RESOLVE_SYMBOL(v); }
        else if (/^[0-9]{6}$/.test(v)) t = v + '.KS';
        name = /[가-힣]/.test(v) ? v : name;
      } else {
        var opt = Array.prototype.slice.call(dl.options).find(function (o) { return (o.label || '').replace(/\s+/g, '').toUpperCase() === t || o.value === t; });
        if (!RE.test(t) || !opt && /[^A-Z0-9.^=\-]/.test(t)) { var sr = await searchUS(v); if (!sr.length) throw Error('종목을 찾지 못했습니다. 티커를 확인해 주세요.'); t = sr[0].symbol; name = sr[0].name; }
        else if (opt) name = opt.label || t;
      }
      if (!RE.test(t)) throw Error('종목 형식이 올바르지 않습니다.');
      if (rows().some(function (r) { return r.dataset.t === t; })) { say(t + ' 는 이미 목록에 있습니다.', 1); return; }
      var data = await yclose(t, '1y');
      if (!data) throw Error('"' + v + '" 시세를 찾지 못했습니다.' + (CFG.kr ? ' 한글 종목명 또는 6자리코드.KS/.KQ를 확인해 주세요.' : ' 티커를 확인해 주세요.'));
      tickData[t] = data;
      if (CFG.kr && window.MK_KR_NAME) { try { name = await window.MK_KR_NAME(t, name); } catch (e2) {} }
      if (!addTicker(t, name)) return;
      var di = st.del.indexOf(t); if (di >= 0) st.del.splice(di, 1);
      if (!isDefault(t) || di < 0) st.add.push([t, name]);
      save(); inp.value = ''; say(name + ' 추가 완료'); renderTick(CFG.group, per());
    } catch (er) { say(er && er.message ? er.message : '추가하지 못했습니다.', 1); }
  }
  async function searchUS(q) {
    var url = 'https://query1.finance.yahoo.com/v1/finance/search?q=' + encodeURIComponent(q) + '&quotesCount=8&newsCount=0';
    var j = typeof getJSON === 'function' ? await getJSON(url) : await fetch('https://ai.coolzet.workers.dev/?url=' + encodeURIComponent(url)).then(function (r) { return r.json(); });
    return ((j && j.quotes) || []).filter(function (x) { return x.symbol && RE.test(x.symbol) && /EQUITY|ETF|INDEX|MUTUALFUND/i.test(x.quoteType || 'EQUITY'); }).map(function (x) { return { symbol: x.symbol, name: x.shortname || x.longname || x.symbol, ex: x.exchDisp || '' }; });
  }
  var sq = 0, stm = null;
  function suggest() {
    clearTimeout(stm); var q = inp.value.trim(); if (q.length < (CFG.kr ? 2 : 1)) return; var my = ++sq;
    stm = setTimeout(async function () {
      try {
        var res = CFG.kr ? (window.MK_KR_CANDIDATES ? await window.MK_KR_CANDIDATES(q) : []) : await searchUS(q);
        if (my !== sq) return; dl.replaceChildren();
        res.slice(0, 12).forEach(function (r) { var o = d.createElement('option'); o.value = r.symbol; o.label = r.name + (r.ex ? ' · ' + r.ex : ''); dl.appendChild(o); });
      } catch (e) {}
    }, 300);
  }
  function del(t) {
    var i = st.add.findIndex(function (a) { return a[0] === t; }), name = (host.querySelector('.wl-row[data-t="' + t + '"] .wl-name a') || {}).textContent || t, wasDefault = i < 0;
    var snap = null; rows().forEach(function (r) { if (r.dataset.t === t) { snap = r.outerHTML; var nx = r.nextElementSibling; if (nx && /^etf-hold-|^fin-/.test(nx.id || '')) snap += nx.outerHTML; } });
    var before = rows().map(function (r) { return r.dataset.t; }), at = before.indexOf(t);
    removeRow(t);
    if (i >= 0) st.add.splice(i, 1); else if (st.del.indexOf(t) < 0) st.del.push(t);
    save(); clearTimeout(tmr);
    undo = { t: t, snap: snap, name: name, i: i, wasDefault: wasDefault, at: at };
    msg.className = 'mw-msg'; msg.textContent = name + ' 삭제 · ';
    var u = d.createElement('button'); u.type = 'button'; u.className = 'mw-undo'; u.textContent = '되돌리기'; msg.appendChild(u);
    tmr = setTimeout(function () { undo = null; say(''); }, 8000);
  }
  function restore() {
    if (!undo) return; var u = undo; undo = null; clearTimeout(tmr);
    var ref = rows()[u.at]; if (ref) ref.insertAdjacentHTML('beforebegin', u.snap); else host.insertAdjacentHTML('beforeend', u.snap);
    list().push(u.t); decorate();
    if (u.wasDefault) { var k = st.del.indexOf(u.t); if (k >= 0) st.del.splice(k, 1); } else st.add.push([u.t, u.name]);
    save(); say(u.name + ' 복원 완료'); ensureData([u.t]);
  }
  function build() {
    var tbl = d.getElementById(CFG.table); if (!tbl || typeof TICKGROUPS === 'undefined' || !TICKGROUPS[CFG.group] && !CFG.kr) return false;
    if (CFG.kr && !TICKGROUPS[CFG.group]) TICKGROUPS[CFG.group] = { table: CFG.table, list: [], cur: '₩', fmt: fmtWon };
    host = tbl;
    if (d.getElementById('mw-bar')) return true;
    if (!CFG.kr) { baseSet = {}; Array.prototype.forEach.call(tbl.querySelectorAll('.wl-row'), function (r) { baseSet[r.dataset.t] = 1; }); }
    var bar = d.createElement('form'); bar.id = 'mw-bar'; bar.className = 'mw-bar'; bar.autocomplete = 'off';
    bar.innerHTML = '<input type="text" maxlength="30" list="mw-dl" placeholder="' + (CFG.kr ? '종목명·코드 검색 (예: 삼성전자)' : '종목·티커 검색 (예: AAPL)') + '" aria-label="추가할 종목 검색"><datalist id="mw-dl"></datalist><button type="submit" class="mw-add">＋ 추가</button><button type="button" class="mw-reset" title="삭제·추가한 내용을 모두 되돌립니다">기본값 복원</button><div class="mw-msg" role="status" aria-live="polite"></div>';
    var anchor = tbl.closest('.scroll') || tbl; anchor.before(bar);
    inp = bar.querySelector('input'); dl = bar.querySelector('datalist'); msg = bar.querySelector('.mw-msg');
    bar.addEventListener('submit', submit); inp.addEventListener('input', suggest);
    bar.querySelector('.mw-reset').addEventListener('click', function () { if (!st.add.length && !st.del.length) { say('이미 기본 상태입니다.'); return; } try { localStorage.removeItem(CFG.key); } catch (e) {} location.reload(); });
    msg.addEventListener('click', function (e) { if (e.target.closest('.mw-undo')) restore(); });
    tbl.addEventListener('click', function (e) { var b = e.target.closest('.mw-del'); if (b) { e.preventDefault(); e.stopPropagation(); del(b.dataset.t); } }, true);
    if (CFG.kr) { host.innerHTML = ''; TICKGROUPS[CFG.group].list.length = 0; CFG.defaults.forEach(function (x) { if (st.del.indexOf(x[0]) < 0) { host.insertAdjacentHTML('beforeend', rowHtml(x[0], x[1], x[2])); TICKGROUPS[CFG.group].list.push(x[0]); } }); }
    else st.del.forEach(removeRow);
    st.add.forEach(function (a) { if (!rows().some(function (r) { return r.dataset.t === a[0]; })) { host.insertAdjacentHTML('beforeend', rowHtml(a[0], a[1])); list().push(a[0]); } });
    decorate();
    new MutationObserver(function () { decorate(); }).observe(host, { childList: true, subtree: true });
    ensureData(list().slice()).then(function () { if (CFG.kr && typeof fillKrRowStats === 'function') try { fillKrRowStats(CFG.table); } catch (e) {} });
    setInterval(function () { if (d.hidden) return; list().forEach(function (t) { delete tickData[t]; }); ensureData(list().slice()); }, 300000);
    return true;
  }
  var n = 0, iv = setInterval(function () { var ok = false; try { ok = build(); } catch (e) { if (window.console) console.warn('[mk-watch]', e); } if (ok || ++n > 60) clearInterval(iv); }, 300);
})();
