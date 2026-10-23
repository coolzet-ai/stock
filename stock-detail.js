/* 시가총액 TOP 「재무」 패널 확장 — 기존 재무 정보와 겹치지 않는 항목(투자의견·목표주가·실적전망·서프라이즈·기관/펀드 보유·일정)을
   같은 fv2 디자인으로 이어 붙인다. 데이터: Yahoo quoteSummary(집계 서버 /analyst). stock-app.js 의 toggleUsFinancials 가 MKOV.mount 를 호출한다. */
(function () {
  'use strict';
  var API = 'https://ai.coolzet.workers.dev/analyst?sym=', cache = {};
  function raw(o) { return o == null ? null : (typeof o === 'object' ? (o.raw != null ? o.raw : null) : o); }
  function f(n, dg) { return n == null || !isFinite(n) ? '—' : (+n).toLocaleString('en-US', { minimumFractionDigits: dg == null ? 2 : dg, maximumFractionDigits: dg == null ? 2 : dg }); }
  function big(n) { if (n == null) return '—'; var a = Math.abs(n); return a >= 1e12 ? '$' + f(n / 1e12, 2) + 'T' : a >= 1e9 ? '$' + f(n / 1e9, 1) + 'B' : a >= 1e6 ? '$' + f(n / 1e6, 0) + 'M' : f(n, 0); }
  function pc(n, dg) { return n == null ? '—' : f(n * 100, dg == null ? 1 : dg) + '%'; }
  function spc(n) { return n == null ? '—' : (n > 0 ? '+' : '') + f(n * 100, 1) + '%'; }
  function dt(o) { var v = raw(o); return v ? new Date(v * 1000).toISOString().slice(0, 10) : '—'; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  var col = function (v) { return v == null ? 'var(--tx2)' : v >= 0 ? 'var(--up)' : 'var(--down)'; };
  function tile(l, v, c, sub) { return '<div class="fv2-c"><small>' + l + '</small><b' + (c ? ' style="color:' + c + '"' : '') + '>' + v + '</b>' + (sub ? '<em>' + sub + '</em>' : '') + '</div>'; }
  function build(sym, r) {
    var fd = r.financialData || {}, sd = r.summaryDetail || {}, pr = r.price || {}, h = '';
    var px = raw(fd.currentPrice) != null ? raw(fd.currentPrice) : raw(pr.regularMarketPrice), tp = raw(fd.targetMeanPrice), up = tp && px ? tp / px - 1 : null;
    var rt = r.recommendationTrend && r.recommendationTrend.trend && r.recommendationTrend.trend[0];
    /* 투자의견 분포 + 목표주가 */
    if (rt) {
      var L = [['적극매수', rt.strongBuy, '#B42318'], ['매수', rt.buy, '#F04438'], ['보유', rt.hold, '#98A2B3'], ['매도', rt.sell, '#528BFF'], ['적극매도', rt.strongSell, '#1D4ED8']];
      var tot = L.reduce(function (a, x) { return a + (x[1] || 0); }, 0) || 1, sc = (1 * (rt.strongBuy || 0) + 2 * (rt.buy || 0) + 3 * (rt.hold || 0) + 4 * (rt.sell || 0) + 5 * (rt.strongSell || 0)) / tot;
      h += '<div class="fv2-row"><div class="fv2-c"><small>투자의견 분포 · 애널리스트 ' + (raw(fd.numberOfAnalystOpinions) || tot) + '명 · 평균 ' + f(sc, 2) + ' (1=적극매수 ~ 5=적극매도)</small>' +
        '<div class="fv2-bar" style="height:14px;display:flex;margin-top:6px">' + L.map(function (x) { return x[1] ? '<i style="flex:' + x[1] + ';background:' + x[2] + '" title="' + x[0] + ' ' + x[1] + '"></i>' : ''; }).join('') + '</div>' +
        '<em style="display:flex;gap:10px;flex-wrap:wrap;margin-top:5px">' + L.map(function (x) { return '<span><u style="display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:3px;background:' + x[2] + '"></u>' + x[0] + ' <b style="display:inline;font-size:12px">' + (x[1] || 0) + '</b></span>'; }).join('') + '</em></div></div>';
    }
    /* 목표주가 범위(저~고) + 현재가·평균 위치 / 상승여력(0 기준 −·+) */
    var tl = raw(fd.targetLowPrice), th = raw(fd.targetHighPrice);
    if (tp && tl != null && th != null && th > tl) {
      var pos = function (v) { return Math.max(0, Math.min(100, (v - tl) / (th - tl) * 100)); }, pp = px != null ? pos(px) : null, pm = pos(tp);
      h += '<div class="fv2-row"><div class="fv2-c"><small>목표주가 범위 · 애널리스트 저가 ~ 고가</small>' +
        '<div class="ov-rg"><i class="ov-rg-b"></i>' + (pp != null ? '<u class="ov-rg-px" style="left:' + pp + '%"><span>현재 $' + f(px, 0) + '</span></u>' : '') + '<u class="ov-rg-av" style="left:' + pm + '%"><span>평균 $' + f(tp, 0) + '</span></u></div>' +
        '<div class="ov-rg-l"><span>저 $' + f(tl, 0) + '</span><span>고 $' + f(th, 0) + '</span></div></div></div>';
    }
    if (up != null) {
      var cl = Math.max(-50, Math.min(50, up * 100)), w = Math.abs(cl) / 50 * 50;
      h += '<div class="fv2-row fv2-3" style="grid-template-columns:1fr">' + '<div class="fv2-c"><small>상승여력 (목표주가 평균 ÷ 현재가 − 1)</small><b style="color:' + col(up) + '">' + spc(up) + '</b>' +
        '<div class="ov-dv"><i class="ov-dv-z"></i>' + (cl >= 0 ? '<i class="ov-dv-b" style="left:50%;width:' + w + '%;background:var(--up)"></i>' : '<i class="ov-dv-b" style="right:50%;width:' + w + '%;background:var(--down)"></i>') + '</div>' +
        '<div class="ov-dv-l"><span>−50%</span><span>0</span><span>+50%</span></div><em>' + (px != null ? '현재가 $' + f(px) + ' → 목표 $' + f(tp) : '') + ' · 시가총액 ' + big(raw(sd.marketCap) || raw(pr.marketCap)) + ' · 52주 ' + f(raw(sd.fiftyTwoWeekLow), 0) + '~' + f(raw(sd.fiftyTwoWeekHigh), 0) + '</em></div></div>';
    }
    /* 분기·연간 전망 EPS 막대 */
    var et = r.earningsTrend && r.earningsTrend.trend, nm = { '0q': '이번 분기', '+1q': '다음 분기', '0y': '올해', '+1y': '내년' };
    if (et && et.length) {
      var rows = et.filter(function (x) { return nm[x.period] && x.earningsEstimate && raw(x.earningsEstimate.avg) != null; });
      var grp = function (ks, title) {
        var g = rows.filter(function (x) { return ks.indexOf(x.period) >= 0; }); if (!g.length) return '';
        var mx = Math.max.apply(null, g.map(function (x) { return Math.abs(raw(x.earningsEstimate.avg)); })) || 1;
        return '<div class="fv2-c"><small>' + title + ' 전망 EPS (컨센서스)</small>' + g.map(function (x) {
          var v = raw(x.earningsEstimate.avg), gr = raw(x.growth), rg = x.revenueEstimate && raw(x.revenueEstimate.growth);
          return '<div class="ov-eb"><span class="ov-eb-n">' + nm[x.period] + '</span><div class="ov-eb-t"><i style="width:' + Math.max(3, Math.abs(v) / mx * 100) + '%"></i></div><b>' + f(v) + '</b><span class="ov-chip" style="background:' + (gr == null ? '#eef2f6' : gr >= 0 ? '#FEE4E2' : '#DCE8FF') + ';color:' + col(gr) + '">' + spc(gr) + '</span></div>' +
            '<em class="ov-eb-s">매출 ' + big(x.revenueEstimate && raw(x.revenueEstimate.avg)) + ' (' + spc(rg) + ')</em>';
        }).join('') + '</div>';
      };
      var gh = grp(['0q', '+1q'], '분기') + grp(['0y', '+1y'], '연간');
      if (gh) h += '<div class="fv2-row fv2-m" style="grid-template-columns:repeat(auto-fit,minmax(260px,1fr))">' + gh + '</div>';
    }
    /* 분기 실적 서프라이즈: 예상 vs 실제 쌍막대 */
    var q = r.earnings && r.earnings.earningsChart && r.earnings.earningsChart.quarterly;
    if (q && q.length) {
      var qq = q.slice(-4), qm = Math.max.apply(null, qq.map(function (x) { return Math.max(Math.abs(raw(x.actual) || 0), Math.abs(raw(x.estimate) || 0)); })) || 1;
      h += '<div class="fv2-row"><div class="fv2-c"><small>최근 분기 EPS · 예상(회색) vs 실제(색)</small><div class="ov-sp">' + qq.map(function (x) {
        var a = raw(x.actual), e = raw(x.estimate), sp = a != null && e ? (a / e - 1) : null;
        return '<div class="ov-sp-c"><div class="ov-sp-bars"><i class="e" style="height:' + Math.max(4, Math.abs(e || 0) / qm * 100) + '%" title="예상 ' + f(e) + '"></i><i class="a" style="height:' + Math.max(4, Math.abs(a || 0) / qm * 100) + '%;background:' + (sp != null && sp < 0 ? 'var(--down)' : 'var(--up)') + '" title="실제 ' + f(a) + '"></i></div><b>' + f(a) + '</b><em>예상 ' + f(e) + '</em><span class="ov-chip" style="background:' + (sp == null ? '#eef2f6' : sp >= 0 ? '#FEE4E2' : '#DCE8FF') + ';color:' + col(sp) + '">' + (sp == null ? '—' : (sp >= 0 ? '서프라이즈 ' : '쇼크 ') + spc(sp)) + '</span><small>' + esc(x.date) + '</small></div>';
      }).join('') + '</div></div></div>';
    }
    /* 실적 발표일·배당락일 D-day */
    var ce = r.calendarEvents || {}, er = ce.earnings && ce.earnings.earningsDate && ce.earnings.earningsDate[0];
    function dday(label, o, span) {
      var v = raw(o); if (!v) return '<div class="fv2-c"><small>' + label + '</small><b>—</b></div>';
      var days = Math.round((v * 1000 - Date.now()) / 86400000), past = days < 0, n = Math.abs(days), soon = !past && days <= 7;
      var p = past ? 100 : Math.max(0, Math.min(100, (1 - days / 90) * 100));
      return '<div class="fv2-c"><small>' + label + '</small><div class="ov-dd"><span class="ov-dd-b ' + (past ? 'past' : soon ? 'soon' : '') + '">' + (past ? 'D+' + n + ' 지남' : days === 0 ? 'D-DAY' : 'D-' + n) + '</span><b>' + dt(o) + '</b></div><div class="ov-dd-t"><i style="width:' + p + '%;background:' + (past ? '#98A2B3' : soon ? 'var(--up)' : '#0B6B3A') + '"></i></div><em>' + (past ? '지난 일정' : '90일 타임라인') + '</em></div>';
    }
    h += '<div class="fv2-row fv2-3" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr))">' + dday('다음 실적 발표', er) + dday('배당락일', sd.exDividendDate) + '</div>';
    /* 보유 비율 누적 막대 */
    var mh = r.majorHoldersBreakdown;
    if (mh && raw(mh.insidersPercentHeld) != null && raw(mh.institutionsPercentHeld) != null) {
      var ins = Math.max(0, raw(mh.insidersPercentHeld)), ist = Math.max(0, raw(mh.institutionsPercentHeld)), etc = Math.max(0, 1 - ins - Math.min(ist, 1 - ins));
      h += '<div class="fv2-row"><div class="fv2-c"><small>보유 비율 · 내부자 / 기관 / 기타 (기관 수 ' + f(raw(mh.institutionsCount), 0) + ')</small><div class="ov-st"><i style="flex:' + Math.max(ins, .004) + ';background:#B54708" title="내부자"></i><i style="flex:' + Math.min(ist, 1 - ins) + ';background:#1D4ED8" title="기관"></i><i style="flex:' + Math.max(etc, .004) + ';background:#D0D5DD" title="기타"></i></div>' +
        '<em class="ov-st-l"><span><u style="background:#B54708"></u>내부자 <b>' + pc(ins, 2) + '</b></span><span><u style="background:#1D4ED8"></u>기관 <b>' + pc(ist, 1) + '</b></span><span><u style="background:#D0D5DD"></u>기타(개인 등) <b>' + pc(etc, 1) + '</b></span></em></div></div>';
    }
    /* 기관·펀드 보유 */
    function own(list, t) {
      if (!list || !list.length) return '';
      return '<details><summary>' + t + ' (상위 ' + Math.min(8, list.length) + ')</summary><div class="fv2-rs">' + list.slice(0, 8).map(function (x) { var ch = raw(x.pctChange); return '<div><span>' + esc(x.organization) + ' · ' + pc(raw(x.pctHeld), 2) + '</span><b style="color:' + col(ch) + '">' + spc(ch) + '</b></div>'; }).join('') + '</div></details>';
    }
    h += own(r.institutionOwnership && r.institutionOwnership.ownershipList, '🏦 기관 투자자') + own(r.fundOwnership && r.fundOwnership.ownershipList, '📦 보유 펀드');
    return h;
  }
  function mount(el, sym) {
    var box = el && el.querySelector('.fv2'); if (!box || box.querySelector('.fv2-ext')) return;
    var ext = document.createElement('div'); ext.className = 'fv2-ext';
    ext.innerHTML = '<div class="fv2-t" style="margin-top:14px">🔎 애널리스트 · 실적 전망 · 보유 현황 (Yahoo)</div><p class="mut" style="font-size:12px">불러오는 중…</p>';
    var ft = box.querySelector('.fv2-ft'); ft ? box.insertBefore(ext, ft) : box.appendChild(ext);
    (cache[sym] || (cache[sym] = fetch(API + encodeURIComponent(sym)).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }).then(function (j) { if (j.error) throw new Error(j.error); return j; })))
      .then(function (j) { ext.innerHTML = '<div class="fv2-t" style="margin-top:14px">🔎 애널리스트 · 실적 전망 · 보유 현황 (Yahoo)</div>' + build(sym, j); })
      .catch(function (e) { cache[sym] = null; ext.innerHTML = '<div class="fv2-t" style="margin-top:14px">🔎 애널리스트 · 실적 전망 · 보유 현황 (Yahoo)</div><p class="mut" style="font-size:12px">추가 정보를 불러오지 못했습니다 (' + esc(e && e.message || '오류') + '). ETF·신규 상장 종목은 없을 수 있고, 집계 서버 v47 배포가 필요합니다.</p>'; });
  }
  window.MKOV = { mount: mount };
})();
