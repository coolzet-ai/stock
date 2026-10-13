/* Mr.Kim Signal 서비스 워커 — 같은 출처의 정적 파일만 다룹니다(시세·지표 API 등 다른 출처는 건드리지 않음).
   · ?v=해시가 붙은 JS/CSS: 캐시 우선(내용이 바뀌면 주소가 바뀌므로 재방문 때 네트워크 없이 즉시 로드)
   · HTML·JSON 데이터: 네트워크 우선, 실패 시 캐시(오래된 화면이 남지 않게)
   · 아이콘·이미지: 캐시 우선 + 백그라운드 갱신 */
const V='mk-v2', IMM='mk-imm-v2';
self.addEventListener('install',e=>{ self.skipWaiting(); });
self.addEventListener('activate',e=>{ e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==V&&k!==IMM).map(k=>caches.delete(k)))).then(()=>self.clients.claim())); });
const put=(name,r,res)=>{ if(res&&res.ok&&res.type==='basic'&&!/no-store/i.test(res.headers.get('Cache-Control')||'')){ const c=res.clone(); caches.open(name).then(ca=>ca.put(r,c)); } return res; };
self.addEventListener('fetch',e=>{
  const r=e.request, u=new URL(r.url);
  if(r.method!=='GET'||u.origin!==location.origin) return;
  const ext=(u.pathname.match(/\.([a-z0-9]+)$/i)||[,''])[1].toLowerCase();
  if((ext==='js'||ext==='css')&&/^\?v=[A-Za-z0-9_-]+$/.test(u.search)){
    e.respondWith(caches.open(IMM).then(ca=>ca.match(r).then(hit=>hit||fetch(r).then(res=>put(IMM,r,res))))); return;
  }
  if(/^(png|jpg|jpeg|webp|svg|ico|woff2?)$/.test(ext)){
    e.respondWith(caches.open(V).then(ca=>ca.match(r).then(hit=>{ const net=fetch(r).then(res=>put(V,r,res)).catch(()=>hit); return hit||net; }))); return;
  }
  e.respondWith(fetch(r).then(res=>put(V,r,res)).catch(()=>caches.match(r).then(m=>m||(r.mode==='navigate'?caches.match('stock.html'):Response.error()))));
});
