# Worker 장애 알림 설정 (텔레그램)

알림은 코드에 이미 들어 있고, 아래 값을 Cloudflare에 넣어야 실제로 동작합니다.

1. 텔레그램에서 @BotFather → /newbot → 토큰 복사
2. 만든 봇에게 아무 메시지나 보낸 뒤 `https://api.telegram.org/bot<토큰>/getUpdates` 에서 chat.id 확인
3. Cloudflare → Workers → 해당 Worker → Settings → Variables and Secrets
   - `TG_BOT_TOKEN` = 토큰 (Secret)
   - `TG_CHAT_ID` = chat.id
4. Settings → Triggers → Cron: `*/30 * * * *`  (30분마다 healthProbe 실행)
5. KV 바인딩 `KR_KV` 가 있어야 같은 알림이 반복 발송되지 않습니다(없으면 매번 발송).
6. 확인: `https://<worker주소>/health` 가 JSON을 반환하면 정상입니다.
