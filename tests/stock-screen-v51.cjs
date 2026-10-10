process.chdir(require('path').join(__dirname,'..'));
const {chromium}=require('playwright'),assert=require('assert'),fs=require('fs'),path=require('path');
(async()=>{
 const browser=await chromium.launch({executablePath:'/tmp/stock-headless/chrome-headless-shell-linux64/chrome-headless-shell',args:['--no-sandbox']});let results=[];
 for(const width of [320,360,390,768,1000,1440]){
 const context=await browser.newContext({viewport:{width,height:1000},serviceWorkers:'block'});const page=await context.newPage();let errors=[];page.on('pageerror',e=>errors.push(e.message));
 const font=fs.readFileSync('/tmp/stock-korean.ttf').toString('base64');await page.route('**/*',r=>{const u=new URL(r.request().url());if(u.hostname==='fonts.googleapis.com')return r.fulfill({contentType:'text/css',body:'@font-face{font-family:"Noto Sans KR";font-weight:100 900;src:url(data:font/ttf;base64,'+font+')}'});return u.protocol==='file:'?r.continue():r.abort();});
 await context.addInitScript(()=>sessionStorage.setItem('mk_detail','stock.html'));
 await page.goto(require('url').pathToFileURL(path.resolve('stock.html')).href);await page.waitForTimeout(1600);
 await page.evaluate(()=>{
 document.querySelectorAll('.fold-h').forEach(h=>h._set&&h._set(true));
 document.querySelectorAll('#cap-tbl .wl-row,#tick-tbl .wl-row,#lev-tbl .wl-row').forEach((r,i)=>{r.querySelector('.px').textContent='$'+(i===0?'229.28':'242.35')+' (₩'+(i===0?'307,442':'999,999')+')';r.querySelector('.ch').textContent='▲ +1.31%';EXT_DATA[r.dataset.t]={st:'post',px:242.35,base:242.30,pct:0.02,t:Date.now()/1000};});
 document.querySelector('#us-sub').innerHTML=[72.8,5.4,3.2,34.6,50,87.8,61.4].map((n,i)=>'<tr class="sb-done"><td class="sub-lab"><span class="sub-no">'+(i+1)+'</span><span class="sub-nm">시장 모멘텀</span></td><td>'+subBarCell(n)+'<span class="sb-val">'+n+'</span></td><td class="num"><b>'+n+'</b><br><span class="tag t-l">극단적 탐욕</span></td></tr>').join('');
 });
 await page.waitForTimeout(4000);await page.evaluate(()=>document.querySelector('.pulse').classList.add('m-open'));
 const geometry=await page.evaluate(()=>{
 const overlap=(a,b)=>a.left<b.right&&b.left<a.right&&a.top<b.bottom&&b.top<a.bottom;
 const prices=[...document.querySelectorAll('.pulse .hm-price>span')].map(e=>({text:e.textContent,fits:e.scrollWidth<=e.clientWidth+1}));
 const cnn=[...document.querySelectorAll('#us-sub tr')].map(r=>({barOverlap:overlap(r.querySelector('.sub-bar').getBoundingClientRect(),r.querySelector('td.num b').getBoundingClientRect()),number:getComputedStyle(r.querySelector('td.num b')).display,duplicate:getComputedStyle(r.querySelector('.sb-val')).display}));
 const stamp=document.querySelector('.stock-source-stamp').getBoundingClientRect(),top=document.querySelector('#pro-top').getBoundingClientRect(),tabs=document.querySelector('#mk-tabbar');
 return {width:innerWidth,scroll:document.documentElement.scrollWidth,prices,cnn,topOverlap:overlap(stamp,top),stampBottom:stamp.bottom,tabsTop:tabs&&getComputedStyle(tabs).display!=='none'?tabs.getBoundingClientRect().top:innerHeight,extSpacing:[...document.querySelectorAll('.pulse .hm-ext')].map(e=>getComputedStyle(e).letterSpacing)};
 });
 assert.equal(geometry.scroll,width,'page overflow');assert(geometry.prices.length>10);assert(geometry.prices.every(x=>x.fits),'price text clipped '+JSON.stringify(geometry.prices.filter(x=>!x.fits)));assert(geometry.cnn.every(x=>!x.barOverlap&&x.number==='block'&&x.duplicate==='none'));assert(!geometry.topOverlap);assert(Math.abs(geometry.stampBottom-geometry.tabsTop)<2);assert(geometry.extSpacing.every(x=>x==='0px'||x==='normal'),JSON.stringify(geometry.extSpacing));assert.deepEqual(errors,[]);
 await page.locator('.pulse').scrollIntoViewIfNeeded();await page.screenshot({path:'tests/screen-v51-'+width+'.png'});results.push({width,status:'passed',...geometry});await context.close();
 }
 await browser.close();fs.writeFileSync('tests/screen-v51-results.json',JSON.stringify(results,null,2));console.log('Passed: six widths, KRW price visibility, CNN scores, extended-hours spacing, footer/control clearance');
})().catch(e=>{console.error(e);process.exit(1)});
