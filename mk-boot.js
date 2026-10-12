/* 첫 화면 조립 중(제목·상태 카드·요약 카드가 여러 스크립트에 의해 차례로 바뀌는 구간)에는 본문을 투명하게 두었다가
   조립이 끝나면(ui-fixes-v106.js 가 window.__mkBootDone 호출) 한 번에 부드럽게 보여 준다 → 화면이 흔들리거나
   버튼이 상태 카드 밖에 있다가 들어가는 모습이 보이지 않는다. 느린 네트워크에서도 최대 6초 후에는 무조건 표시. */
(function () {
  var d = document.documentElement, done = false;
  d.classList.add('mk-boot');
  var f = function () { if (done) return; done = true; d.classList.remove('mk-boot'); };
  window.__mkBootDone = f;
  setTimeout(f, 6000);
  /* 가상화폐: 새로고침·모두 접기/펼치기 버튼(.v90-actions)이 상태 카드 밖에 생기면 즉시 카드 안으로 옮긴다
     (ui-fixes-v106.js 가 늦게 실행되거나 오류가 나도 버튼이 카드 밖에 남지 않도록) */
  if (/\/crypto(\.html)?$/.test(location.pathname)) {
    var fix = function () {
      var st = document.getElementById('pro-status'), a = document.querySelector('.v90-actions');
      if (st && a && !st.contains(a)) { a.classList.add('mk-status-actions'); st.appendChild(a); }
    };
    try { new MutationObserver(fix).observe(document.documentElement, { childList: true, subtree: true }); } catch (e) {}
    setTimeout(function () { try { fix(); } catch (e) {} }, 0);
  }
})();
