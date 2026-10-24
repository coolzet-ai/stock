/* 예전 미국주식 전용 서비스 워커 → 통합 sw.js로 대체되었습니다. 설치돼 있던 이 워커는 스스로 해제하고 옛 캐시를 지웁니다. */
self.addEventListener('install',e=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith('mk-stock-public-')).map(k=>caches.delete(k)))).then(()=>self.registration.unregister())));
