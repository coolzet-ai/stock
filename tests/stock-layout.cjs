process.chdir(require('path').join(__dirname,'..'));
const {chromium}=require('playwright'),fs=require('fs'),assert=require('assert'),path=require('path');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.STOCK_BROWSER_PATH||undefined,args:['--no-sandbox']});
 let results=[];
 for(const [name,width,height,scheme] of [['pc',1440,1100,'light'],['mobile',390,1500,'light'],['small-mobile',360,900,'light'],['tablet',768,1024,'light'],['dark-pc',1440,1100,'dark']]){
  const context=await browser.newContext({viewport:{width,height},colorScheme:scheme,serviceWorkers:'block'});const page=await context.newPage();let errors=[];page.on('pageerror',e=>errors.push(e.message));
  const font=process.env.STOCK_KOREAN_FONT?fs.readFileSync(process.env.STOCK_KOREAN_FONT).toString('base64'):'';let emoji='';
  await page.route('**/*',r=>{let u=new URL(r.request().url());if(font&&u.hostname==='fonts.googleapis.com')return r.fulfill({contentType:'text/css',body:'@font-face{font-family:"Noto Sans KR";font-weight:100 900;src:url(data:font/ttf;base64,'+font+')}'+(emoji?'@font-face{font-family:"Noto Color Emoji";src:url(data:font/ttf;base64,'+emoji+')}':'')+'body,body :is(button,input,select,summary,a){font-family:"Noto Sans KR","Noto Color Emoji",sans-serif!important;}'});return u.protocol==='file:'?r.continue():r.abort();});
  await page.goto(require('url').pathToFileURL(path.resolve('stock.html')).href,{waitUntil:'domcontentloaded'});await page.waitForTimeout(5500);await page.evaluate(()=>document.fonts.ready);
  const baseline=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,columns:getComputedStyle(document.querySelector('.pb-grid')).gridTemplateColumns.split(' '),header:getComputedStyle(document.querySelector('.pb-hd')).backgroundColor,gauge:!!document.querySelector('.stock-gauge'),cardCount:document.querySelectorAll('.pb-grid .pb-c').length,personalBelow:document.querySelector('.stock-personal-details').getBoundingClientRect().top>document.querySelector('#us-card').getBoundingClientRect().top,duplicateIds:[...document.querySelectorAll('[id]')].map(e=>e.id).filter(Boolean).filter((s,i,a)=>a.indexOf(s)!==i)}));
  assert.equal(baseline.width,baseline.scroll,'Horizontal overflow');assert.equal(baseline.columns.length,width<=700?2:4);assert(baseline.columns.every(x=>Math.abs(parseFloat(x)-parseFloat(baseline.columns[0]))<1));assert(baseline.gauge&&baseline.personalBelow);assert.equal(baseline.header,'rgba(0, 0, 0, 0)');assert(await page.locator('#us-sub').isVisible(),'CNN indicators should remain visible on mobile');assert.deepEqual(baseline.duplicateIds,[]);assert.deepEqual(errors,[]);
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
