/* ux-pass.js — (1) 첫 방문 카드 자동 접기 (2) 미국주식 '오늘의 시그널 체크' 스트립
   스트립은 화면에 이미 표시된 지표(공포탐욕·VIX·레버리지 연속하락·RSI·일정)만 읽어 규칙으로 요약합니다. 투자 권유가 아닙니다. */
(function () {
  'use strict'; var d = document;
  setTimeout(function () { var c = d.getElementById('mk-first'); if (c && !c.classList.contains('open')) c.classList.add('mk-min'); }, 8000);
  var brief = d.getElementById('pro-brief'); if (!brief) return;
  function num(s) { var m = /(-?\d+(?:\.\d+)?)/.exec(s || ''); return m ? parseFloat(m[1]) : null; }
  function read() {
    var cs = brief.querySelectorAll('.pb-grid > .pb-c'), t = function (i) { return cs[i] ? cs[i].innerText : ''; };
    var fg = num((/(\d+)\s*·/.exec(t(0)) || [])[1]), vix = num((/VIX\)\s*\n?\s*([\d.]+)/.exec(t(1)) || [])[1]);
    var back = /백워데이션/.test(t(1));
    var ev = (/D-(\d+)/.exec(t(2)) || [])[1], evn = (t(2).split('\n')[1] || '').trim();
    var lev = brief.querySelector('.pb-lev'), l4 = null, l3 = null;
    if (lev) { var big = lev.querySelectorAll('.lv-box b, .lv-c b, [class*=lv] b'); }
    if (lev) { var m = lev.innerText.match(/(\d+)\s*\n?\s*2연속\s*\n?\s*(\d+)\s*\n?\s*3연속\s*\n?\s*(\d+)\s*\n?\s*4연속/); if (m) { l3 = +m[2]; l4 = +m[3]; } }
    var rs = window.MK_RSI_SUM || null;
    return { fg: fg, vix: vix, back: back, ev: ev, evn: evn, l3: l3, l4: l4, rs: rs };
  }
  function build(x) {
    var fear = x.fg != null && x.fg <= 45, extreme = x.fg != null && x.fg <= 25, greed = x.fg != null && x.fg >= 70;
    var os = x.rs ? x.rs.lo : 0, ob = x.rs ? x.rs.hi : 0, streak = (x.l4 || 0) + (x.l3 || 0);
    var score = (fear ? 1 : 0) + (extreme ? 1 : 0) + (os >= 3 ? 1 : 0) + (streak >= 2 ? 1 : 0);
    var cls = 'watch', lab = '관망·점검';
    if (greed || ob >= 5) { cls = 'heat'; lab = '과열 점검'; } else if (score >= 3) { cls = 'buy'; lab = '분할 접근 후보 점검'; }
    var msg = [];
    if (x.fg != null) msg.push('공포탐욕 ' + x.fg + (extreme ? '(극단적 공포)' : fear ? '(공포)' : greed ? '(탐욕)' : '(중립권)'));
    if (os) msg.push('RSI 과매도 ' + os + '종목'); if (ob) msg.push('RSI 과매수 ' + ob + '종목');
    if (streak) msg.push('레버리지 3일+ 연속하락 ' + streak + '종목');
    if (x.ev != null && +x.ev <= 3) msg.push('D-' + x.ev + ' ' + x.evn + ' 임박 → 변동성 확대 주의');
    var txt = msg.length ? msg.join(' · ') : '지표를 불러오는 중입니다.';
    var tip = cls === 'buy' ? '공포·과매도 신호가 겹칩니다. 비중·손절 기준을 먼저 정하고 분할로만 접근을 검토하세요.' : cls === 'heat' ? '과열 신호가 있습니다. 신규 추격보다 이익 관리·비중 점검이 우선입니다.' : '신호가 엇갈립니다. 서두르지 않고 관심종목의 이평선·RSI를 먼저 확인하세요.';
    return { cls: cls, lab: lab, txt: txt, tip: tip, os: os, ob: ob, streak: streak };
  }
  function chip(k, v, c) { return '<div class="sg-chip' + (c ? ' ' + c : '') + '"><small>' + k + '</small><b>' + v + '</b></div>'; }
  var last = '';
  function render() {
    var x = read(); if (x.fg == null) return; var r = build(x);
    var html = '<div class="sg-top"><span class="sg-ttl">📋 오늘의 시그널 체크</span><span class="sg-badge ' + r.cls + '">' + r.lab + '</span></div>' +
      '<div class="sg-chips">' + chip('공포탐욕', x.fg, x.fg <= 25 ? 'on' : x.fg >= 70 ? 'cool' : '') + chip('VIX', x.vix != null ? x.vix : '–', x.back ? 'on' : '') +
      chip('RSI 과매도', r.os + '종목', r.os >= 3 ? 'on' : '') + chip('RSI 과매수', r.ob + '종목', r.ob >= 5 ? 'cool' : '') + chip('레버리지 연속하락', r.streak + '종목', r.streak >= 2 ? 'on' : '') +
      chip('다음 일정', x.ev != null ? 'D-' + x.ev : '–', x.ev != null && +x.ev <= 3 ? 'on' : '') + '</div>' +
      '<div class="sg-msg">' + r.txt + '</div><div class="sg-msg" style="margin-top:4px"><b>👉 ' + r.tip + '</b></div>' +
      '<div class="sg-note">화면에 표시된 지표를 규칙으로 요약한 참고용 체크입니다(투자 권유 아님). 기준: 공포탐욕 ≤45 공포 / ≤25 극단 · RSI ≤30 과매도 / ≥75 과매수.</div>';
    if (html === last) return; last = html;
    var el = d.getElementById('sg-strip');
    if (!el) { el = d.createElement('div'); el.id = 'sg-strip'; el.className = 'sg-strip'; var g = brief.querySelector('.pb-grid'); if (!g) return; g.parentNode.insertBefore(el, g); }
    el.innerHTML = html;
  }
  setInterval(render, 1500); setTimeout(render, 800);
})();
