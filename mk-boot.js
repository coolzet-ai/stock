/* 첫 화면 조립 중(제목·상태 카드·요약 카드가 여러 스크립트에 의해 차례로 바뀌는 구간)에는 본문을 투명하게 두었다가
   조립이 끝나면 한 번에 부드럽게 보여 준다 → 화면이 흔들리는 것처럼 보이던 현상 방지. 최대 3초 후에는 무조건 표시. */
(function () {
  var d = document.documentElement;
  d.classList.add('mk-boot');
  var f = function () { d.classList.remove('mk-boot'); };
  setTimeout(f, 3000);
  window.addEventListener('load', function () { setTimeout(f, 1700); });
})();
