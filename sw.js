/* 같은 출처의 정적 파일만 "네트워크 우선, 실패 시 캐시"로 처리합니다. 시세·지표 API(다른 출처)는 건드리지 않아 오래된 데이터가 남지 않습니다. */
const V='mk-v1';
self.addEventListener('install',e=>{ self.skipWaiting(); });
self.addEventListener('activate',e=>{ e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==V).map(k=>caches.delete(k)))).then(()=>self.clients.claim())); });
self.addEventListener('fetch',e=>{
  const r=e.request, u=new URL(r.url);
  if(r.method!=='GET'||u.origin!==location.origin) return;
  e.respondWith(fetch(r).then(res=>{ if(res&&res.ok){ const c=res.clone(); caches.open(V).then(ca=>ca.put(r,c)); } return res; })
    .catch(()=>caches.match(r).then(m=>m||(r.mode==='navigate'?caches.match('stock.html'):Response.error()))));
});
