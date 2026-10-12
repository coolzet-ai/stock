/* 첫 화면 조립 중(제목·상태 카드·요약 카드가 여러 스크립트에 의해 차례로 바뀌는 구간)에는 본문을 투명하게 두었다가
   조립이 끝나면(ui-fixes-v106.js 가 window.__mkBootDone 호출) 한 번에 부드럽게 보여 준다 → 화면이 흔들리거나
   버튼이 상태 카드 밖에 있다가 들어가는 모습이 보이지 않는다. 느린 네트워크에서도 최대 6초 후에는 무조건 표시. */
(function () {
  var d = document.documentElement, done = false;
  d.classList.add('mk-boot');
  var f = function () { if (done) return; done = true; d.classList.remove('mk-boot'); };
  window.__mkBootDone = f;
  setTimeout(f, 6000);
})();
