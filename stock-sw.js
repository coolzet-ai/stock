/* Public US dashboard assets only; never cache API, credentials, other pages. */
const CACHE='mk-stock-public-v46';
const STATIC=new Set(['stock.html','stock-fold-v46.js','stock-tools-v46.css','stock-tools-v46.js','stock-alignment-v45.css','stock-fold-v45.js','stock-fixes-v44.css','stock-fixes-v44.js','stock-layout-v3.js','stock-layout-v3.css','stock-bootstrap.js','stock-security.js','stock-design-v2.css','stock-dashboard-v2.js','stock-extra.js','stock-gate-legacy.js','stock-ux-v2.js','stock-common-v2.js','mrkim-pro.min.js','mrkim-pro.css','mrkim-theme.css','stock-page.js','stock-fin.js','stock-etf.js','stock-fold.js','stock-pulse.js','stock-mobile.js','stock-asof.js','stock-sort.js','mrkim-invest.js']);
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
