/* Public US dashboard assets only; never cache API, credentials, other pages. */
const CACHE='mk-stock-public-v65';
const STATIC=new Set(['stock.html','stock-init.js','stock-app.js','stock.css']);
self.addEventListener('install',e=>e.waitUntil(self.skipWaiting()));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>(k.startsWith('mk-stock-public-')&&k!==CACHE)).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
 const r=e.request,u=new URL(r.url),base=new URL('./',self.location.href);
 if(r.method!=='GET'||u.origin!==base.origin||u.pathname.slice(0,u.pathname.lastIndexOf('/')+1)!==base.pathname||!STATIC.has(u.pathname.split('/').pop()))return;
 if(u.search&& !/^\?v=[A-Za-z0-9_-]+$/.test(u.search))return;
 e.respondWith((async()=>{
  const cache=await caches.open(CACHE);
  try{const res=await fetch(r);if(res.ok&&!res.headers.has('Set-Cookie')&&!/no-store|private/i.test(res.headers.get('Cache-Control')||'')){await cache.put(r,res.clone());}return res;}
  catch(err){const hit=await cache.match(r);return hit||Response.error();}
 })());
});
