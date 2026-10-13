# 디자인·모션·이벤트 규칙 (미국주식·한국주식·가상화폐·메인)

## 색 규칙
- 브랜드: `#0A6B48` (버튼·강조·링크). 상승 `--mk-up #d92d20`(빨강), 하락 `--mk-dn #2563eb`(파랑) — 한국식 관례.
- 경고/주의: 주황~빨강 배너(사이드카 등). 정상: 초록 칩. 비활성/지연: 회색(`--tx2`).
## 숫자·카드
- 숫자는 `font-variant-numeric: tabular-nums`(자리 폭 고정). 카드 반경 12~16px, 테두리 1px `--line`.
- 터치 대상 최소 44px(모바일·폴드 ≤960px). 작은 버튼은 보이지 않는 히트영역으로 확장.
## 모션
- 스켈레톤 1종: 색 `--sk-a/--sk-b`, 1.3s. 스켈레톤→실내용 120ms 페이드.
- 값 변경 하이라이트 220ms, 첫 로딩 제외(화면 안정 후 또는 8초 뒤부터). 첫 진입 요약 칸 40ms 간격 opacity.
- 경고 애니메이션 3회 후 정지. `prefers-reduced-motion` 시 전부 끔.
## 유입 퍼널 이벤트 (`window.MK_FUNNEL(name)`, mk_noev==='0' 켠 경우에만 /ev 전송)
first_seen → first_glossary | first_dismiss → cross_stock | cross_kr-stock | cross_crypto → share → faq | contact | glossary | legal_* | outage_help
