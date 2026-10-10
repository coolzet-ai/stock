# Worker v49 보안 수정 및 재배포

이 폴더의 `worker-v49.mjs`는 첨부하신 실제 Worker를 수정한 전체 코드입니다. 미국주식 프런트엔드는 v48 그대로 유지합니다. 서버 코드는 GitHub Pages에 올리는 것만으로 적용되지 않으며 **Cloudflare의 기존 Worker에 재배포**해야 합니다. 자동 배포하거나 실제 키를 변경하지 않았습니다.

## 적용한 수정

| 기존 문제 | 수정 |
|---|---|
| DART·KRX·금융상품 API 키가 소스에 직접 포함 | 3개 키를 env Secret으로 읽고 함수 호출에 env 전달 |
| 수동 실행 및 KV·IPO 진단을 누구나 호출 가능 | 관리자 Bearer 토큰 인증, 변경 동작 POST 필수 |
| 통계 키를 URL에 전달 | URL key 거부, Authorization 헤더로 변경 |
| 요청별 디버그 권한을 globalThis에 보관 | 공유 디버그 플래그 제거, 공개 오류는 일반 메시지 |
| 프록시가 호스트만 검사 | HTTPS·호스트·경로 검사, 사용자정보·비표준 포트·조작 경로 차단 |
| 리다이렉트 자동 추적 | 수동 추적, 매번 검증, 다른 출처로 이동 금지, 최대 3회 |
| 요청/응답 크기 및 대기 무제한 | URL 8KB, 프록시 URL 4KB, 이벤트/관리자 본문 2KB, 프록시 응답 4MB, 최종 API 응답 8MB, 각 upstream fetch 12초 및 프록시 루프 전체 15초 |
| Worker 인스턴스 메모리에만 속도 제한 | Cloudflare Rate Limiting 바인딩 사용; 미설정/장애 시 503으로 차단 |
| /health에 전체 오류·통계 공개 | 일반 조회는 {ok:true}, 상세 조회는 관리자 인증 |
| 모든 출처 CORS와 로컬 개발 출처 기본 허용 | 운영 출처 정확히 일치할 때만 허용, 로컬은 별도 변수 선택 |
| 관리자·오류 응답 캐시 가능 | no-store, API 보안 헤더, 응답에 포함된 Secret 값 치환 |

공개 시세·뉴스·지표의 경로/응답 구조, KR_KV 캐시와 Cron 작업은 유지했습니다. DEBUG/refresh/force/rebuild 플래그와 *-run-now는 관리자용으로 바뀌므로 기존 진단 URL은 그대로 사용할 수 없습니다. 빈 캐시를 채우는 공개 데이터 조회는 여전히 서버 작업을 수행할 수 있으므로 충분한 Cron 사전 갱신이 필요합니다.

## 반드시 먼저 설정할 항목

Cloudflare 기존 Worker의 Variables and Secrets에 아래 이름으로 **Secret**을 추가하세요. 기존 코드에 있던 키는 가능하면 재발급하여 넣으세요. 실제 값은 이 ZIP에 포함하지 않았습니다.

| 이름 | 값 |
|---|---|
| DART_KEY | OpenDART 인증키 |
| KRX_AUTH_KEY | KRX Open API 인증키 |
| FSS_SAVINGS_KEY | 금융상품한눈에 인증키 |
| ADMIN_TOKEN | 별도로 생성한 최소 32자 이상의 무작위 관리자 토큰 |

ADMIN_TOKEN을 공개 HTML/JS·브라우저 저장소·URL에 넣지 마세요. 기존 STATS_KEY 및 DEBUG로 관리자 권한을 부여하지 않습니다. 64자리 무작위 16진수 토큰 등을 서버 관리용으로 사용하세요.

기존 `KR_KV` 바인딩과 모든 Cron Trigger를 유지하세요. TG_BOT_TOKEN/TG_CHAT_ID/ALERT_WEBHOOK는 기존 사용 중인 경우에만 유지하면 됩니다.

Rate Limiting 바인딩을 다음과 같이 추가하세요. 같은 계정의 다른 제한과 상태를 공유하지 않도록 namespace_id는 사용하지 않은 두 값을 지정하세요. 아래 예시의 ID는 예시값입니다.

| 바인딩 | 권장 초기 설정 |
|---|---|
| PUBLIC_RATE_LIMITER | 600회 / 60초 |
| DIRECT_RATE_LIMITER | 60회 / 60초 |

둘 중 필요한 바인딩이 없으면 503이 발생합니다. 계정에서 지원하는 바인딩을 먼저 확인하고 준비한 뒤 배포하세요. `wrangler.security.example.toml`을 기존 설정에 병합할 수 있습니다. 기존 Worker 이름·계정·KV ID·Cron을 예시 설정으로 덮어쓰지 마세요. 권장 compatibility_date는 2026-10-10입니다.

로컬 테스트가 필요한 경우에만 ALLOW_LOCAL_ORIGIN=1, file:// 테스트가 필요한 경우에만 ALLOW_NULL_ORIGIN=1을 설정하세요. 운영에서는 둘 다 해제하세요. ENABLE_EVENTS=1을 설정한 경우에만 방문 통계를 저장합니다. 원래 통계 기록은 동시 KV 갱신의 정확한 카운터가 아니며 엄격한 분석 집계에는 Durable Object 등이 필요합니다.

## 배포 순서

1. 기존 Worker 코드와 설정을 별도로 백업하고, 새 Secret·Rate Limiting 바인딩을 준비합니다.
2. 별도 테스트 Worker에 이 전체 코드를 배포해 CNN·Yahoo·DART·KRX·금융상품 응답과 Cron을 확인합니다. 외부 제공처 쿠키 정책·실제 바인딩은 로컬 단위 테스트로 검증할 수 없습니다.
3. 현재 프런트엔드의 Worker 주소는 유지하면서 기존 Worker 코드를 교체하고 배포합니다.
4. 일반 /health는 200과 {ok:true}, 인증 없는 /kr-kv-debug는 403, 허용하지 않은 프록시 URL은 400을 확인합니다.
5. 미국주식의 CNN·재무·ETF·유니콘 뉴스 및 공유 Worker를 사용하는 다른 페이지를 확인합니다. 바인딩 누락 503, 시간 제한 502, 정상 사용 429가 발생하면 설정/상류 응답을 점검합니다.
6. 문제가 있으면 이전 Worker 버전으로 롤백합니다. 재발급한 키는 이전 코드의 하드코딩 값과 다르므로 롤백용 코드도 Secret을 읽도록 준비해야 합니다.

## 관리자 호출 변경

통계/진단 조회는 GET과 `Authorization: Bearer <ADMIN_TOKEN>` 헤더를 사용합니다. 수동 실행 및 강제 갱신은 같은 인증 헤더와 POST를 사용합니다. URL의 ?key=... 방식은 거부합니다. 토큰을 넣는 관리 페이지는 공개 GitHub Pages에 만들지 마세요.

## 남은 구조적 범위

- 이 Worker는 공개 시장 데이터 API입니다. 관리자 기능에 서버 인증을 추가했지만, 기존 클라이언트 비밀번호 잠금을 유료 사용자 인증으로 바꾸지는 않았습니다. 비공개 상세 콘텐츠를 보호하려면 사용자 세션·권한·만료·로그아웃 시스템과 서버에서의 콘텐츠 제공을 별도 구현해야 합니다.
- GitHub Pages HTML의 HTTP 보안 헤더는 이 API Worker 재배포만으로 바뀌지 않습니다. 기존 Pages 이전용 _headers 예시를 별도로 적용할 호스팅 환경이 필요합니다.
- Rate Limiting 바인딩은 Cloudflare 지역별 제한입니다. IP는 여러 사용자가 공유할 수 있고 Origin은 서버 호출에서 위조할 수 있으므로 CORS를 인증으로 보지 마세요. 전역의 엄격한 제한에는 Durable Object/인증된 사용자 기준 제한을 추가해야 합니다.
- 공개 데이터 요청이 여러 종목/여러 외부 요청으로 확장되는 비용은 단순 요청 횟수 제한만으로 모두 통제되지 않습니다. 인스턴스별 동시 작업 제한과 사전 캐시, 필요 시 유료/비용 예산 정책을 추가해야 합니다.
- 최종 응답 제한은 응답을 만드는 중간 JSON/HTML의 메모리를 모두 제한하지 않습니다. DART ZIP 해제 및 외부 HTML 파서까지 별도 자원 한도가 필요한 추가 개선 범위입니다.

## 검증

`node --check worker/worker-v49.mjs` 및 `node --experimental-vm-modules tests/worker-security-v49.mjs`로 확인했습니다. 검증은 외부 요청과 바인딩을 모의 처리한 테스트이며 실제 Cloudflare 배포·실시간 제공처 통합 검증을 대신하지 않습니다. 실제 API 키 3개가 새 파일들에 포함되지 않는지도 검사했습니다.

공식 참고: https://developers.cloudflare.com/workers/configuration/secrets/ · https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/
