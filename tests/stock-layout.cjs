process.chdir(require('path').join(__dirname,'..'));
const {chromium}=require('playwright'),fs=require('fs'),assert=require('assert'),path=require('path');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.STOCK_BROWSER_PATH||undefined,args:['--no-sandbox']});
 let results=[];
 for(const [name,width,height,scheme] of [['pc',1440,1100,'light'],['mobile',390,1500,'light'],['small-mobile',360,900,'light'],['tablet',768,1024,'light'],['compact-pc',1000,1100,'light'],['dark-pc',1440,1100,'dark']]){
  const context=await browser.newContext({viewport:{width,height},colorScheme:scheme,serviceWorkers:'block'});const page=await context.newPage();let errors=[];page.on('pageerror',e=>errors.push(e.message));
  const font=process.env.STOCK_KOREAN_FONT?fs.readFileSync(process.env.STOCK_KOREAN_FONT).toString('base64'):'';let emoji='';
  await page.route('**/*',r=>{let u=new URL(r.request().url());if(font&&u.hostname==='fonts.googleapis.com')return r.fulfill({contentType:'text/css',body:'@font-face{font-family:"Noto Sans KR";font-weight:100 900;src:url(data:font/ttf;base64,'+font+')}'+(emoji?'@font-face{font-family:"Noto Color Emoji";src:url(data:font/ttf;base64,'+emoji+')}':'')+'body,body :is(button,input,select,summary,a){font-family:"Noto Sans KR","Noto Color Emoji",sans-serif!important;}'});return u.protocol==='file:'?r.continue():r.abort();});
  await context.addInitScript(()=>localStorage.setItem('mk_my_tickers',JSON.stringify(['AAPL'])));
  await page.goto(require('url').pathToFileURL(path.resolve('stock.html')).href,{waitUntil:'domcontentloaded'});await page.waitForTimeout(5500);await page.evaluate(()=>document.fonts.ready);
  const baseline=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,columns:getComputedStyle(document.querySelector('.pb-grid')).gridTemplateColumns.split(' '),header:getComputedStyle(document.querySelector('.pb-hd')).backgroundColor,gauge:!!document.querySelector('.stock-gauge'),cardCount:document.querySelectorAll('.pb-grid .pb-c').length,personalPosition:document.querySelector('.stock-tools-hub').getBoundingClientRect().top>document.querySelector('#pro-brief').getBoundingClientRect().bottom&&document.querySelector('.stock-tools-hub').getBoundingClientRect().bottom<document.querySelector('#us-card').getBoundingClientRect().top,duplicateIds:[...document.querySelectorAll('[id]')].map(e=>e.id).filter(Boolean).filter((s,i,a)=>a.indexOf(s)!==i)}));
  assert.equal(baseline.width,baseline.scroll,'Horizontal overflow');assert.equal(baseline.columns.length,width<=700?2:4);assert(baseline.columns.every(x=>Math.abs(parseFloat(x)-parseFloat(baseline.columns[0]))<1));assert(baseline.gauge&&baseline.personalPosition);assert.equal(baseline.header,'rgba(0, 0, 0, 0)');assert(await page.locator('#us-sub').isVisible(),'CNN indicators should remain visible on mobile');assert.deepEqual(baseline.duplicateIds,[]);assert.deepEqual(errors,[]);
  // Interaction regressions: white text always has a green hover background.
  if(width>700){await page.locator('#pro-toc a').first().hover();await page.waitForTimeout(400);assert.equal(await page.locator('#pro-toc a').first().evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(0, 117, 74)');}
  await page.locator('.fold-h').first().hover();await page.waitForTimeout(400);assert.equal(await page.locator('.fold-h').first().evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(0, 117, 74)');
  await page.locator('#us-card .tabs button').first().hover();await page.waitForTimeout(400);assert.equal(await page.locator('#us-card .tabs button').first().evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(0, 117, 74)');
  assert.equal(await page.locator('.stock-trend-details').evaluate(e=>e.open),width>700);
  if(width<=700){
   await page.locator('.stock-trend-details>summary').click();assert(await page.locator('#us-trend').isVisible());await page.locator('.stock-trend-details>summary').click();
   assert.equal(await page.locator('#us-sub .sb-val').first().evaluate(e=>getComputedStyle(e).display),'none');
   assert.equal(await page.locator('#us-sub td.num b').first().evaluate(e=>getComputedStyle(e).display),'block');
   const overlaps=await page.evaluate(()=>[...document.querySelectorAll('#us-sub tr')].some(r=>{let b=r.querySelector('.sub-bar'),n=r.querySelector('td.num b');if(!b||!n)return false;let x=b.getBoundingClientRect(),y=n.getBoundingClientRect();return x.left<y.right&&y.left<x.right&&x.top<y.bottom&&y.top<x.bottom;}));assert(!overlaps,'CNN value overlaps bar');
  }
  assert.equal(await page.locator('#unicorn .stock-company-details').count(),4);
  assert.equal(await page.locator('#unicorn .stock-company-details[open]').count(),0);
  assert.equal(await page.locator('#unicorn .uc-grid').first().evaluate(e=>getComputedStyle(e).display),'block');
  // All three visible shortcuts open both disclosure layers in one click.
  for(const [tool,field] of [['my-wl','.my-add input'],['mk-acct','#ac-t'],['mk-cmp','.cm-f input']]){
   await page.locator('.stock-tools-links [data-tool="'+tool+'"]').click();assert(await page.locator('#'+tool+' '+field).first().isVisible(),'Shortcut must reveal input');assert.equal(await page.locator('.stock-personal-details').evaluate(e=>e.open),true);
   await page.waitForTimeout(50);assert.equal(await page.locator('.stock-personal-details>summary').textContent(),'투자 도구 접기');
   if(width<=700)assert(await page.locator('#'+tool).evaluate(e=>!e.classList.contains('m-fold')||e.classList.contains('m-open')),'Selected mobile tool must be expanded: '+tool);
   const bounds=await page.locator('#'+tool+' '+field).first().evaluate(e=>{let r=e.getBoundingClientRect();return r.width>40&&r.height>=44&&r.height<=46&&r.left>=0&&r.right<=innerWidth;});assert(bounds,'Tool input must fit viewport');
  }
  assert.equal(await page.locator('#mk-acct .stock-tool-field').count(),3);assert.equal(await page.locator('#mk-cmp .stock-tool-field').count(),3);
  await page.evaluate(()=>{document.querySelector('.stock-personal-details').open=false;document.querySelectorAll('.stock-tools-links button').forEach(e=>{e.classList.remove('on');e.removeAttribute('aria-current');});});
  // Real fold setters: summary geometry must not change between closed/open states.
  const fixed=await page.evaluate(()=>{let h=document.querySelector('#unicorn h2.fold-h'),r=h.querySelector('.fold-sum'),b=h.querySelector('.fold-btn');h._set(false);let before=r.getBoundingClientRect();h._set(true);let after=r.getBoundingClientRect();let text=r.textContent;h._set(false);return {before:[before.x-h.getBoundingClientRect().x,before.width],after:[after.x-h.getBoundingClientRect().x,after.width],text};});
  assert.deepEqual(fixed.before,fixed.after);assert.equal(fixed.text,'4개사');
  // News arriving later must never enter the heading summary.
  await page.evaluate(()=>{let a=document.createElement('a');a.href='https://www.example.com/news';a.textContent='A long injected news fixture';document.querySelector('#unicorn-news-anthropic').appendChild(a);let h=document.querySelector('#unicorn h2.fold-h');h._set(false);});assert.equal(await page.locator('#unicorn .fold-sum').textContent(),fixed.text);
  if(width>=1000){
   const geometry=await page.evaluate(()=>{let rows=[...document.querySelectorAll('#cap-tbl>.wl-row')];let h=document.querySelector('#cap-tbl').closest('.fold-body').previousElementSibling;h._set(true);rows.forEach((r,i)=>{putRowStats(r,{rg:i?null:105.9,og:127.8,per:29,eps:i?1.1:7.91,feps:15.91,psr:18.27});r.querySelector('.wl-quote').style.width=i%2?'120px':'198px';});let all=rows.map(r=>[...r.querySelectorAll('.wl-stats>div')].map(e=>e.getBoundingClientRect().x));let overflow=document.documentElement.scrollWidth>innerWidth;h._set(false);rows.forEach(r=>{r.querySelector('.wl-stats').remove();r.querySelector('.wl-quote').style.removeProperty('width');});return {all,overflow};});assert(!geometry.overflow,'Metric rows overflow');assert(geometry.all.every(r=>r.every((x,i)=>Math.abs(x-geometry.all[0][i])<1)),'Metric column positions differ');
  }
  if(width<=700){await page.evaluate(()=>{document.querySelector('.stock-personal-details').open=true;document.querySelector('#my-wl').classList.add('m-open');});assert(await page.locator('#my-wl .my-del').first().isVisible(),'Delete must be visible without expanding a ticker row');assert(await page.locator('#my-wl .my-del svg').first().isVisible());assert(await page.locator('#my-wl .my-del').first().evaluate(e=>{let a=e.getBoundingClientRect(),b=e.closest('.wl-row').getBoundingClientRect();return a.left>=b.left&&a.right<=b.right&&a.top>=b.top&&a.bottom<=b.bottom;}),'Delete must fit inside the visible row');await page.evaluate(()=>document.querySelector('.stock-personal-details').open=false);}
  // Seed a stored test ticker; exercise the real renderer and delete repaint offline.
  assert.equal(await page.locator('#my-wl .ts-link').first().textContent(),'X 검색');assert.equal(await page.locator('#my-wl .my-del').first().textContent(),'삭제');
  await page.locator('#my-wl .my-del').first().evaluate(e=>e.click());await page.waitForTimeout(80);assert.equal(await page.locator('#my-wl .my-del').count(),0);
  // Gauge follows data updates, treats missing/out-of-range values as missing.
  const original=await page.locator('#us-val').textContent();
  for(const [n,wanted] of [['52','52'],['--','—'],['140','—']]){await page.evaluate(v=>document.getElementById('us-val').textContent=v,n);await page.waitForTimeout(80);assert.equal(await page.locator('.sg-value').textContent(),wanted);}
  await page.evaluate(v=>document.getElementById('us-val').textContent=v,original);await page.waitForTimeout(80);
  if(name==='mobile'){
   await page.click('#nav-toggle');assert.equal(await page.locator('#nav-toggle').getAttribute('aria-expanded'),'true');await page.click('#nav-toggle');
   await page.locator('.stock-personal-details>summary').click();if(!(await page.locator('#ac-t').isVisible()))await page.locator('#mk-acct .m-fold-btn').click();assert(await page.locator('#ac-t').isVisible());await page.locator('.stock-personal-details>summary').click();
   await page.locator('.stock-market-details>summary').click();assert(await page.locator('#pro-tick').isVisible());await page.locator('.stock-market-details>summary').click();
   await page.locator('.fold-h').first().click();assert.equal(await page.locator('#mk-gate').count(),1);await page.locator('#mk-gate-cl').click();
  }
  // Screenshot explicitly shows offline status; no simulated live quotes.
  await context.setOffline(true);await page.evaluate(()=>window.dispatchEvent(new Event('offline')));assert.equal(await page.locator('.stock-status').getAttribute('data-state'),'error');
  await page.evaluate(()=>window.scrollTo(0,0));await page.waitForTimeout(250);await page.screenshot({path:path.resolve('previews/preview-'+name+'.png'),fullPage:false});
  results.push({name,...baseline,pageErrors:errors.length,checks:'passed',screenshotMode:'offline; original fallback values only'});await context.close();
 }
 await browser.close();fs.writeFileSync('tests/layout-results.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
})().catch(e=>{console.error(e);process.exit(1)});
