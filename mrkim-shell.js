/* Mr.Kim Signal — 공통 셸(body.pro.lite 전용): 미국·한국주식과 같은 상태 띠 · 목차 · 맨 위로 버튼을 다른 페이지에도 만든다.
   설정 메뉴(⚙)·하단 탭바·검색·테마는 mrkim-extra.js 가 이 요소들을 기준으로 붙인다. */
(function () {
  'use strict';
  var B = document.body; if (!B || !B.classList.contains('pro') || !B.classList.contains('lite')) return;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var hd = $('header'); if (!hd) return;
  /* 현재 페이지 메뉴 강조 */
  try { var file = (location.pathname.split('/').pop() || 'index.html'); $$('#nav-menu a').forEach(function (a) { if ((a.getAttribute('href') || '') === file) a.classList.add('on-page'); }); } catch (e) {}
  /* 상태 띠 */
  if (!$('#pro-status')) {
    var st = document.createElement('div'); st.id = 'pro-status'; st.setAttribute('role', 'status');
    var pg = (location.pathname.split('/').pop() || '').replace(/\.html$/, ''), NOQ = /^(p2p|finprod|trade)/.test(pg);
    st.innerHTML = '<span class="ps-n">' + (NOQ ? '참고용 정보 · 내용은 변경될 수 있으며 투자 판단과 책임은 이용자 본인에게 있습니다' : '무료 공개 시세(Yahoo Finance·TradingView·CNN) 기반 · 지연·오류 가능 · 투자 판단 참고용') + '</span><button type="button" id="ps-rf" title="새로고침" aria-label="새로고침">↻</button>';
    hd.after(st);
    $('#ps-rf').addEventListener('click', function () { location.reload(); });
  }
  /* 목차: 페이지의 h2 */
  var clean = function (t) { return Array.from(t.replace(/[\u{1F1E6}-\u{1F1FF}\u{1F300}-\u{1FAFF}☀-➿]/gu, '').replace(/\s+/g, ' ').trim()); };
  var hs = $$('main h2, section h2, .wrap > h2').filter(function (h, i, a) { return a.indexOf(h) === i && h.offsetParent !== null && clean(h.textContent).length; });
  if (!$('#pro-toc') && hs.length) {
    var toc = document.createElement('nav'); toc.id = 'pro-toc'; toc.setAttribute('aria-label', '페이지 목차');
    toc.innerHTML = hs.map(function (h, i) { var t = clean(h.textContent); return '<a href="#" data-i="' + i + '">' + t.slice(0, 13).join('') + (t.length > 13 ? '…' : '') + '</a>'; }).join('');
    ($('#pro-status') || hd).after(toc);
    toc.addEventListener('click', function (e) {
      var a = e.target.closest('a'); if (!a) return; e.preventDefault();
      var el = hs[+a.dataset.i]; var off = (hd.offsetHeight || 0) + toc.offsetHeight + 8;
      window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - off, behavior: 'smooth' });
    });
  }
  /* 맨 위로 */
  if (!$('#pro-top')) {
    var up = document.createElement('button'); up.id = 'pro-top'; up.type = 'button'; up.setAttribute('aria-label', '맨 위로'); up.textContent = '↑ 맨 위로';
    up.onclick = function () { window.scrollTo({ top: 0, behavior: 'smooth' }); }; B.appendChild(up);
    window.addEventListener('scroll', function () { up.classList.toggle('on', window.scrollY > 700); }, { passive: true });
  }
})();
