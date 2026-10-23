/* 종목 개요 — 투자의견 분포·목표주가·실적전망·실적서프라이즈·기관/펀드 보유·배당. 데이터: Yahoo quoteSummary(집계 서버 /analyst) */
(function () {
  'use strict';
  var API = 'https://ai.coolzet.workers.dev/analyst?sym=', d = document, CH = ['AAPL', 'NVDA', 'MSFT', 'GOOGL', 'AMZN', 'META', 'TSLA', 'AVGO', 'TSM'];
  function raw(o) { return o == null ? null : (typeof o === 'object' ? (o.raw != null ? o.raw : null) : o); }
  function f(n, dg) { return n == null || !isFinite(n) ? '-' : (+n).toLocaleString('en-US', { minimumFractionDigits: dg == null ? 2 : dg, maximumFractionDigits: dg == null ? 2 : dg }); }
  function big(n) { if (n == null) return '-'; var a = Math.abs(n); return a >= 1e12 ? '$' + f(n / 1e12, 2) + 'T' : a >= 1e9 ? '$' + f(n / 1e9, 1) + 'B' : a >= 1e6 ? '$' + f(n / 1e6, 0) + 'M' : f(n, 0); }
  function pc(n, dg) { return n == null ? '-' : f(n * 100, dg == null ? 1 : dg) + '%'; }
  function dt(o) { var v = raw(o); return v ? new Date(v * 1000).toISOString().slice(0, 10) : '-'; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function sec(t, b) { return '<div class="ov-sec"><h4>' + t + '</h4>' + b + '</div>'; }
  function render(box, sym, r) {
    var fd = r.financialData || {}, sd = r.summaryDetail || {}, ap = r.assetProfile || {}, pr = r.price || {}, h = '';
    var px = raw(fd.currentPrice) != null ? raw(fd.currentPrice) : raw(pr.regularMarketPrice), tp = raw(fd.targetMeanPrice), up = tp && px ? tp / px - 1 : null;
    h += '<div class="ov-hd"><b>' + esc(pr.longName || sym) + '</b> <span class="mut">(' + esc(sym) + ')</span> <a class="ov-fv" href="https://finviz.com/quote.ashx?t=' + encodeURIComponent(sym) + '" target="_blank" rel="noopener noreferrer">finviz ↗</a><div class="mut">' + esc([ap.sector, ap.industry, ap.country, ap.fullTimeEmployees ? '직원 ' + f(ap.fullTimeEmployees, 0) + '명' : ''].filter(Boolean).join(' · ')) + '</div></div>';
    h += '<div class="ov-kp">' + [['현재가', px != null ? '$' + f(px) : '-'], ['PER(후행)', f(raw(sd.trailingPE), 1)], ['PER(선행)', f(raw(sd.forwardPE), 1)], ['배당수익률', pc(raw(sd.dividendYield), 2)], ['52주 고/저', f(raw(sd.fiftyTwoWeekHigh), 0) + ' / ' + f(raw(sd.fiftyTwoWeekLow), 0)], ['시가총액', big(raw(sd.marketCap) || raw(pr.marketCap))]].map(function (k) { return '<div><small>' + k[0] + '</small><b>' + k[1] + '</b></div>'; }).join('') + '</div>';
    /* 투자의견 분포 */
    var rt = r.recommendationTrend && r.recommendationTrend.trend && r.recommendationTrend.trend[0];
    if (rt) {
      var L = [['적극매수', rt.strongBuy, '#B42318'], ['매수', rt.buy, '#F04438'], ['보유', rt.hold, '#98A2B3'], ['매도', rt.sell, '#528BFF'], ['적극매도', rt.strongSell, '#1D4ED8']], tot = L.reduce(function (a, x) { return a + (x[1] || 0); }, 0) || 1;
      var sc = (1 * (rt.strongBuy || 0) + 2 * (rt.buy || 0) + 3 * (rt.hold || 0) + 4 * (rt.sell || 0) + 5 * (rt.strongSell || 0)) / tot;
      var gau = '<div class="ov-bar">' + L.map(function (x) { return x[1] ? '<i style="flex:' + x[1] + ';background:' + x[2] + '" title="' + x[0] + ' ' + x[1] + '"></i>' : ''; }).join('') + '</div><div class="ov-lg">' + L.map(function (x) { return '<span><u style="background:' + x[2] + '"></u>' + x[0] + ' <b>' + (x[1] || 0) + '</b></span>'; }).join('') + '</div>';
      var tgt = tp ? '<div class="ov-tp">목표주가 평균 <b>$' + f(tp) + '</b> (저 $' + f(raw(fd.targetLowPrice), 0) + ' ~ 고 $' + f(raw(fd.targetHighPrice), 0) + ') · 상승여력 <b class="' + (up > 0 ? 'u' : 'dn') + '">' + (up > 0 ? '+' : '') + f(up * 100, 1) + '%</b> · 애널리스트 ' + (raw(fd.numberOfAnalystOpinions) || tot) + '명</div>' : '';
      h += sec('투자의견 분포 <span class="mut">평균 ' + f(sc, 2) + ' (1=적극매수 ~ 5=적극매도)</span>', gau + tgt);
    }
    /* 실적 전망 */
    var et = r.earningsTrend && r.earningsTrend.trend;
    if (et && et.length) {
      var nm = { '0q': '이번 분기', '+1q': '다음 분기', '0y': '올해', '+1y': '내년' };
      h += sec('실적 전망 (컨센서스)', '<div class="ov-tw"><table class="ov-t"><tbody><tr><th>기간</th><th>EPS 예상</th><th>EPS 성장</th><th>매출 예상</th><th>매출 성장</th></tr>' + et.filter(function (x) { return nm[x.period]; }).map(function (x) { var g = raw(x.growth), rg = x.revenueEstimate && raw(x.revenueEstimate.growth); return '<tr><td>' + nm[x.period] + '</td><td>' + f(x.earningsEstimate && raw(x.earningsEstimate.avg)) + '</td><td class="' + (g > 0 ? 'u' : g < 0 ? 'dn' : '') + '">' + pc(g) + '</td><td>' + big(x.revenueEstimate && raw(x.revenueEstimate.avg)) + '</td><td class="' + (rg > 0 ? 'u' : rg < 0 ? 'dn' : '') + '">' + pc(rg) + '</td></tr>'; }).join('') + '</tbody></table></div>');
    }
    /* 분기 실적 서프라이즈 */
    var q = r.earnings && r.earnings.earningsChart && r.earnings.earningsChart.quarterly;
    if (q && q.length) h += sec('최근 분기 EPS: 실제 vs 예상', '<div class="ov-tw"><table class="ov-t"><tbody><tr><th>분기</th><th>예상</th><th>실제</th><th>서프라이즈</th></tr>' + q.slice(-4).reverse().map(function (x) { var a = raw(x.actual), e = raw(x.estimate), s = a != null && e ? (a / e - 1) : null; return '<tr><td>' + esc(x.date) + '</td><td>' + f(e) + '</td><td>' + f(a) + '</td><td class="' + (s > 0 ? 'u' : s < 0 ? 'dn' : '') + '">' + (s == null ? '-' : (s > 0 ? '+' : '') + f(s * 100, 1) + '%') + '</td></tr>'; }).join('') + '</tbody></table></div>');
    /* 보유 */
    function own(list, t) { return list && list.length ? sec(t, '<div class="ov-tw"><table class="ov-t"><tbody><tr><th>기관/펀드</th><th>비중</th><th>보유 주식</th><th>증감</th></tr>' + list.slice(0, 8).map(function (x) { var ch = raw(x.pctChange); return '<tr><td class="l">' + esc(x.organization) + '</td><td>' + pc(raw(x.pctHeld), 2) + '</td><td>' + f(raw(x.position), 0) + '</td><td class="' + (ch > 0 ? 'u' : ch < 0 ? 'dn' : '') + '">' + (ch == null ? '-' : (ch > 0 ? '+' : '') + f(ch * 100, 1) + '%') + '</td></tr>'; }).join('') + '</tbody></table></div>') : ''; }
    h += own(r.institutionOwnership && r.institutionOwnership.ownershipList, '상위 기관 투자자') + own(r.fundOwnership && r.fundOwnership.ownershipList, '상위 보유 펀드');
    var mh = r.majorHoldersBreakdown; if (mh) h += '<div class="ov-sm">내부자 보유 ' + pc(raw(mh.insidersPercentHeld), 2) + ' · 기관 보유 ' + pc(raw(mh.institutionsPercentHeld), 1) + ' (기관 수 ' + f(raw(mh.institutionsCount), 0) + ')</div>';
    /* 배당·일정 */
    var ce = r.calendarEvents || {}, er = ce.earnings && ce.earnings.earningsDate && ce.earnings.earningsDate[0];
    h += sec('배당 · 일정', '<div class="ov-kp">' + [['다음 실적 발표', dt(er)], ['배당금(연)', sd.dividendRate ? '$' + f(raw(sd.dividendRate)) : '-'], ['배당성향', pc(raw(sd.payoutRatio), 0)], ['배당락일', dt(sd.exDividendDate)]].map(function (k) { return '<div><small>' + k[0] + '</small><b>' + k[1] + '</b></div>'; }).join('') + '</div>');
    box.innerHTML = h;
  }
  function load(card, sym) {
    var box = card.querySelector('.ov-body'); box.innerHTML = '<div class="cb-na">' + esc(sym) + ' 불러오는 중…</div>';
    card.querySelectorAll('.ov-ch button').forEach(function (b) { b.classList.toggle('on', b.textContent === sym); });
    fetch(API + encodeURIComponent(sym)).then(function (r) { return r.json(); }).then(function (j) { if (j.error) throw 0; render(box, sym, j); })
      .catch(function () { box.innerHTML = '<div class="cb-na">' + esc(sym) + ' 개요를 불러오지 못했습니다. ETF·신규 상장 종목은 일부 항목이 없을 수 있고, 집계 서버 v47 배포가 필요합니다.</div>'; });
  }
  function init() {
    var a = d.getElementById('bigmoney'); if (!a || d.getElementById('mk-ov')) return;
    var c = d.createElement('section'); c.className = 'card'; c.id = 'mk-ov';
    c.innerHTML = '<details' + (innerWidth > 900 ? ' open' : '') + '><summary><b>🔎 종목 개요</b><span class="mut"> 투자의견·목표주가·실적전망·보유기관·배당</span></summary><div class="ov-q"><form class="ov-f"><input type="text" inputmode="latin" autocapitalize="characters" maxlength="10" placeholder="티커 입력 (예: AAPL)" aria-label="티커"><button type="submit">조회</button></form><div class="ov-ch">' + CH.map(function (t) { return '<button type="button">' + t + '</button>'; }).join('') + '</div></div><div class="ov-body"><div class="cb-na">종목을 선택하세요.</div></div><div class="cb-s">출처: Yahoo Finance(애널리스트 컨센서스·공시 기준, 지연·누락 가능). 투자 권유가 아닌 참고 자료입니다.</div></details>';
    a.parentNode.insertBefore(c, a);
    var sym = 'AAPL', started = false;
    function go(s) { sym = s; started = true; load(c, s); }
    c.querySelector('.ov-ch').addEventListener('click', function (e) { if (e.target.tagName === 'BUTTON') go(e.target.textContent); });
    c.querySelector('form').addEventListener('submit', function (e) { e.preventDefault(); var v = c.querySelector('input').value.trim().toUpperCase(); if (/^[A-Z0-9.\-]{1,10}$/.test(v)) go(v); });
    c.querySelector('details').addEventListener('toggle', function () { if (this.open && !started) go(sym); });
    if (innerWidth > 900) go(sym);
  }
  var t = setInterval(function () { if (d.getElementById('bigmoney')) { clearInterval(t); setTimeout(init, 1000); } }, 700);
})();
