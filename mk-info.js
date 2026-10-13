/* 안내·유입 보강(미국주식·한국주식·가상화폐·메인): 푸터 안내 링크, 첫 방문 3단계, 카드 출처 표기,
   장애 안내 링크, 공유, 다른 시장 이동, 갱신 완료 표시, 유입 퍼널 이벤트(opt-in). 실패해도 본 기능에 영향 없음. */
(function () {
  'use strict';
  var d = document, PAGE = (location.pathname.split('/').pop() || 'index').replace(/\.html$/, '');
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) {} return null; }
  function ss(k, v) { try { if (v === undefined) return sessionStorage.getItem(k); sessionStorage.setItem(k, v); } catch (e) {} return null; }
  var NAMES = { stock: '미국주식', 'kr-stock': '한국주식', crypto: '가상화폐', 'mrkim-signal': '메인' };

  /* ── 퍼널 이벤트: 기존 정책과 같이 '켠 경우에만'(mk_noev==='0')·DNT 존중. 이름만 전송(개인정보 없음) ── */
  var EVQ = [], on = ls('mk_noev') === '0' && navigator.doNotTrack !== '1' && window.doNotTrack !== '1';
  function ev(name) {
    if (!on || EVQ.length > 20) return; EVQ.push(['fn', name]);
  }
  function flush() {
    if (!on || !EVQ.length) return;
    var body = JSON.stringify({ p: PAGE, e: EVQ.splice(0, 12) });
    try { navigator.sendBeacon('https://ai.coolzet.workers.dev/ev', new Blob([body], { type: 'text/plain;charset=UTF-8' })); } catch (e) {}
  }
  d.addEventListener('visibilitychange', function () { if (d.visibilityState === 'hidden') flush(); });
  window.MK_FUNNEL = ev;

  function el(tag, cls, html) { var e = d.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }

  /* ── 푸터: 안내 링크 + 공유 ── */
  function footer() {
    var f = d.querySelector('footer .wrap') || d.querySelector('footer'); if (!f || f.querySelector('.mk-flinks')) return;
    var b = el('nav', 'mk-flinks', '<a href="legal.html#terms" data-fn="legal_terms">이용약관</a><a href="legal.html#privacy" data-fn="legal_privacy">개인정보처리방침</a><a href="legal.html#disclaimer" data-fn="legal_disclaimer">투자 유의·면책</a><a href="faq.html" data-fn="faq">FAQ</a><a href="faq.html#contact" data-fn="contact">문의·제보</a><a href="faq.html#updates" data-fn="updates">업데이트 공지</a><a href="glossary.html" data-fn="glossary">용어 사전</a><button type="button" class="mk-share" data-fn="share">공유하기</button>');
    b.setAttribute('aria-label', '안내 링크');
    f.appendChild(b);
    b.addEventListener('click', function (e) {
      var t = e.target.closest('[data-fn]'); if (!t) return; ev(t.getAttribute('data-fn'));
      if (t.classList.contains('mk-share')) share(t);
    });
  }
  function share(btn) {
    var data = { title: d.title, text: 'Mr.Kim Signal — 공포탐욕지수·시장 신호 대시보드', url: location.href.split('#')[0] };
    if (navigator.share) { navigator.share(data).catch(function () {}); return; }
    var done = function () { var o = btn.textContent; btn.textContent = '주소 복사됨 ✓'; setTimeout(function () { btn.textContent = o; }, 1800); };
    try { navigator.clipboard.writeText(data.url).then(done, function () { prompt('주소를 복사하세요', data.url); }); } catch (e) { prompt('주소를 복사하세요', data.url); }
  }

  /* ── 다른 시장 이동(페이지 간 연결) ── */
  function cross() {
    var main = d.querySelector('main'); if (!main || main.querySelector('.mk-cross')) return;
    var items = [['stock', 'stock.html', '미국주식', '공포탐욕·VIX·섹터'], ['kr-stock', 'kr-stock.html', '한국주식', '코스피 심리·투자자 동향'], ['crypto', 'crypto.html', '가상화폐', '반감기 사이클·코인 비교']];
    var h = '<h2 class="mk-cross-h">다른 시장도 확인해 보세요</h2><div class="mk-cross-g">';
    items.forEach(function (x) { if (x[0] !== PAGE) h += '<a href="' + x[1] + '" data-fn="cross_' + x[0] + '"><b>' + x[2] + '</b><span>' + x[3] + '</span></a>'; });
    h += '</div>';
    var box = el('section', 'mk-cross', h); main.appendChild(box);
    box.addEventListener('click', function (e) { var t = e.target.closest('[data-fn]'); if (t) { ev(t.getAttribute('data-fn')); flush(); } });
  }

  /* ── 카드(섹션) 출처·지연 표기 ── */
  var SRC = {
    stock: [['상대수익률', 'Yahoo Finance · 최대 15분 지연'], ['관심종목', 'Yahoo Finance · 최대 15분 지연'], ['시가총액', 'Yahoo Finance · 장 마감 기준'], ['레버리지 ETF', 'Yahoo Finance · 최대 15분 지연'], ['이벤트 일정', 'TradingView 경제캘린더']],
    'kr-stock': [['투자자별', '네이버 금융 · 장중 지연 가능'], ['상승', '네이버 금융 · 최대 20분 지연'], ['관심종목', '네이버 금융 · 최대 20분 지연'], ['시가총액', '네이버 금융 · 장 마감 기준'], ['레버리지 ETF', '네이버 금융 · 최대 20분 지연']],
    crypto: [['공포탐욕', '공개 지수 · 일 1회 갱신'], ['주요 코인 가격', 'Yahoo Finance · 최대 15분 지연'], ['상대수익률', 'Yahoo Finance · 일봉 기준'], ['소셜', 'CoinGecko · 호출 제한 시 지연']]
  };
  function sources() {
    var map = SRC[PAGE]; if (!map) return;
    d.querySelectorAll('main h2').forEach(function (h) {
      if (h.querySelector('.mk-src')) return; var t = h.textContent;
      for (var i = 0; i < map.length; i++) if (t.indexOf(map[i][0]) >= 0) {
        var s = el('small', 'mk-src', map[i][1]); s.title = '출처·지연 안내 — 자세한 내용은 FAQ'; h.appendChild(s); break;
      }
    });
  }

  /* ── 장애 안내: 실패 표시에 원인·재시도 링크 ── */
  function failLinks() {
    d.querySelectorAll('.src-line.fail:not([data-mkh]), .net-fail:not([data-mkh]), .net-err:not([data-mkh])').forEach(function (n) {
      n.setAttribute('data-mkh', '1');
      var a = el('a', 'mk-why', '원인·해결 방법'); a.href = 'faq.html#outage'; a.addEventListener('click', function () { ev('outage_help'); });
      n.appendChild(d.createTextNode(' ')); n.appendChild(a);
    });
  }

  /* ── 첫 방문 3단계 ── */
  function onboard() {
    if (ls('mk_first') === '1' || d.getElementById('mk-first')) return;
    var c = el('aside', 'mk-first', '<button type="button" class="mk-x" aria-label="닫기">×</button><b class="mk-t">처음 오셨나요?</b><ol><li><b>분위기 보기</b> <a href="glossary.html#fear-greed">공포탐욕지수</a>로 시장 심리 확인</li><li><b>요약 보기</b> <a href="glossary.html#vix">VIX</a>·지수·환율은 “오늘의 시장 요약”에서</li><li><b>내 것 저장</b> “내 투자 도구”에 관심종목·비교를 저장</li></ol><a class="mk-more" href="glossary.html">용어가 어렵다면 용어 사전 →</a>');
    c.id = 'mk-first'; c.setAttribute('role', 'complementary'); c.setAttribute('aria-label', '처음 방문 안내');
    d.body.appendChild(c); ev('first_seen');
    c.querySelector('.mk-t').addEventListener('click', function () { c.classList.toggle('open'); });
    c.querySelector('.mk-x').addEventListener('click', function () { ls('mk_first', '1'); c.classList.add('out'); setTimeout(function () { c.remove(); }, 200); ev('first_dismiss'); flush(); });
    c.addEventListener('click', function (e) { if (e.target.tagName === 'A') { ls('mk_first', '1'); ev('first_glossary'); flush(); } });
  }

  /* ── 갱신 완료 표시(새로고침 버튼 → 다시 열린 뒤 ✓) ── */
  d.addEventListener('click', function (e) { if (e.target.closest('#ps-rf')) ss('mk_rf', String(Date.now())); }, true);
  function refreshed() {
    var t = +ss('mk_rf') || 0; if (!t) return; ss('mk_rf', '');
    if (Date.now() - t > 20000) return;
    var n = el('div', 'mk-done', '✓ 갱신 완료'); n.setAttribute('role', 'status'); d.body.appendChild(n);
    setTimeout(function () { n.classList.add('out'); setTimeout(function () { n.remove(); }, 250); }, 1600);
  }

  try { if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); }); } catch (e) {}
  function boot() {
    try { footer(); } catch (e) {} try { cross(); } catch (e) {} try { sources(); } catch (e) {}
    try { failLinks(); new MutationObserver(function () { failLinks(); }).observe(d.body, { childList: true, subtree: true }); } catch (e) {}
    /* 첫 방문 카드는 화면이 안정된 뒤(고정 위치라 레이아웃 이동 없음) */
    var go = function () { try { onboard(); refreshed(); sources(); } catch (e) {} };
    var tries = 0; (function w() { if (window.__mkBootDone || ++tries > 30) { setTimeout(go, 600); } else setTimeout(w, 200); })();
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', boot); else boot();
})();
