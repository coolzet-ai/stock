process.chdir(require('path').join(__dirname,'..'));
const {chromium}=require('playwright'),assert=require('assert'),fs=require('fs'),path=require('path');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.STOCK_BROWSER_PATH,args:['--no-sandbox']});const results=[];
 for(const width of [320,360,390,1440]){
 const context=await browser.newContext({viewport:{width,height:1000},serviceWorkers:'block'}),page=await context.newPage();
 const font=fs.readFileSync('/tmp/stock-korean.ttf').toString('base64');await page.route('**/*',r=>{const u=new URL(r.request().url());if(u.hostname==='fonts.googleapis.com')return r.fulfill({contentType:'text/css',body:'@font-face{font-family:"Noto Sans KR";font-weight:100 900;src:url(data:font/ttf;base64,'+font+')}body,button{font-family:"Noto Sans KR",sans-serif!important}'});return u.protocol==='file:'?r.continue():r.abort();});
 await context.addInitScript(()=>sessionStorage.setItem('mk_detail','stock.html'));await page.goto(require('url').pathToFileURL(path.resolve('stock.html')).href);await page.waitForTimeout(1800);
 await page.evaluate(()=>{EARN_DATA={};DIV_DATA={};document.querySelectorAll('#cap-tbl .wl-row,#cap2-tbl .wl-row,#cap3-tbl .wl-row,#tick-tbl .wl-row,#lev-tbl .wl-row').forEach(r=>{EARN_DATA[r.dataset.t]={ts:Math.floor(Date.now()/1000)+86400};DIV_DATA[r.dataset.t]={ex:Math.floor(Date.now()/1000)+86400};});applyEarnBadges();document.querySelectorAll('.fold-h').forEach(h=>{if(h._set)h._set(true);});});
 for(const key of ['er','dv']){
 await page.locator('.fold-all [data-o="1"]').first().click();const btn=page.locator('#cap-chip-set [data-k="'+key+'"]');await btn.click();assert.equal(await btn.getAttribute('aria-pressed'),'false');
 assert(await page.evaluate(k=>[...document.querySelectorAll(':is(#cap-tbl,#cap2-tbl,#cap3-tbl,#tick-tbl,#lev-tbl) .'+k+'-b')].every(e=>getComputedStyle(e).display==='none'),key));
 await page.evaluate(()=>applyEarnBadges());assert(await page.evaluate(k=>[...document.querySelectorAll('.'+k+'-b')].every(e=>getComputedStyle(e).display==='none'),key));
 await btn.click();assert.equal(await btn.getAttribute('aria-pressed'),'true');
 }
 const shape=await page.evaluate(()=>{const bs=[...document.querySelectorAll('#cap-chip-set button')].map(e=>{const r=e.getBoundingClientRect();return {y:r.y,h:r.height,w:r.width,sw:e.scrollWidth,cw:e.clientWidth,font:getComputedStyle(e).fontSize,padding:getComputedStyle(e).padding,wrap:getComputedStyle(e).whiteSpace,overflow:e.scrollWidth>e.clientWidth};});return {buttons:bs,overflow:document.documentElement.scrollWidth>innerWidth,tagBadges:document.querySelectorAll('.wl-tag .wl-tc').length,badges:document.querySelectorAll('.wl-info>.wl-tc').length};});
 assert(!shape.overflow);assert.equal(shape.tagBadges,0);assert(shape.badges>0);assert(shape.buttons.every(b=>b.h>=44&&b.wrap==='nowrap'&&!b.overflow));assert(shape.buttons.every(b=>Math.abs(b.y-shape.buttons[0].y)<1));
 await page.locator('#cap-chip-set [data-k="dv"]').click();await page.reload();await page.waitForTimeout(1800);assert.equal(await page.locator('#cap-chip-set [data-k="dv"]').getAttribute('aria-pressed'),'false');
 await page.locator('.fold-all [data-o="1"]').first().click();await page.evaluate(()=>{Storage.prototype.setItem=function(){throw new Error('blocked storage')};});await page.locator('#cap-chip-set [data-k="dv"]').click();assert.equal(await page.locator('#cap-chip-set [data-k="dv"]').getAttribute('aria-pressed'),'true');await page.locator('#cap-chip-set [data-k="dv"]').click();assert.equal(await page.locator('#cap-chip-set [data-k="dv"]').getAttribute('aria-pressed'),'false');
 results.push({width,status:'passed',...shape});await context.close();
 }await browser.close();fs.writeFileSync('tests/events-v50-results.json',JSON.stringify(results,null,2));console.log('Passed: mobile/PC toggles, all lists, async redraw, reload, blocked storage, no wrapping/overflow');
})().catch(e=>{console.error(e);process.exit(1)});
