(function(){'use strict';function ready(){var d=document,p=location.pathname.split('/').pop().replace('.html','')||'mrkim-signal';d.body.classList.add('brand-v93','v93-'+p);var logo=d.querySelector('header .logo');if(logo&&!d.querySelector('.v93-beta')){var beta=d.createElement('span');beta.className='v93-beta';beta.textContent='🧪 Beta';beta.setAttribute('aria-label','베타 버전');logo.append(beta);}d.querySelectorAll('main .pg-h1,.v86-page-head h1').forEach(function(n){n.classList.add('v93-title');});d.querySelectorAll('.stock-eyebrow,.v86-eyebrow').forEach(function(n){n.textContent='Mr.Kim Signal · 시장 리서치';});if(p==='kr-stock'||p==='crypto'){var tools=d.getElementById('unified-tools');if(tools&&!tools.parentElement.classList.contains('v93-personal-wrap')){var wrap=d.createElement('div');wrap.className='wrap v93-personal-wrap';tools.before(wrap);wrap.append(tools);var guide=d.getElementById('guide');if(guide)wrap.append(guide);}}
if(p==='trade'){var cards=Array.from(d.querySelectorAll('.strat .scard'));cards.forEach(function(card){var b=card.querySelector('[data-sc]');if(b)b.addEventListener('click',function(){if(card.classList.contains('open'))return;cards.forEach(function(other){if(other===card)return;other.classList.remove('open');var button=other.querySelector('[data-sc]');if(button){button.textContent='펼치기';button.setAttribute('aria-expanded','false');}});},true);});}
if(p==='p2p'){function decorate(){d.querySelectorAll('#p2p-open-list .p2p-card').forEach(function(card){card.classList.add('v93-product');if(card.parentElement.style.display==='grid')card.parentElement.classList.add('v93-product-grid');});}decorate();var list=d.getElementById('p2p-open-list');if(list)new MutationObserver(decorate).observe(list,{childList:true,subtree:true});}
enhance(p);}
function enhance(p){setTimeout(function(){refine100(p);},0);setTimeout(function(){refine99(p);},0);setTimeout(function(){refine98(p);},0);setTimeout(function(){refine97(p);},0);refine96(p);refine95(p);var d=document,labels={'stock':'미국주식','kr-stock':'한국주식','crypto':'가상화폐','bond':'채권','finprod':'금융상품','ipo':'공모주','p2p':'P2P','fx':'환율','trade':'매매김군','mrkim-signal':'홈'},name=labels[p]||p;
var guide=d.querySelector('.market-help');if(guide){var section=d.createElement('section');section.className='v94-guide';var heading=d.createElement('h2');heading.textContent='지표 읽는 법 (용어 가이드)';var button=d.createElement('button');button.type='button';button.className='v94-help';button.textContent='Help ⓘ';button.setAttribute('aria-expanded','false');heading.append(button);var content=d.createElement('div');content.className='v94-guide-content';content.hidden=true;Array.from(guide.children).forEach(function(n){if(n.tagName!=='SUMMARY')content.append(n);});section.append(heading,content);guide.replaceWith(section);button.onclick=function(){function toggle(){content.hidden=!content.hidden;button.setAttribute('aria-expanded',String(!content.hidden));}if(content.hidden&&window.MK_REQUEST_DETAIL)window.MK_REQUEST_DETAIL(toggle);else toggle();};}
var history=d.getElementById('v92-update-history');if(!history){history=d.createElement('details');history.id='v92-update-history';d.querySelector('footer').append(history);}history.replaceChildren();var summary=d.createElement('summary');summary.textContent='🗓️ 업데이트 이력';history.append(summary);var records=[['2026-10-11','v95','제목·메뉴·Help 통일, 그래프·투자도구·시장 정보 배치 개선'],['2026-10-11','v94','로고·Beta·제목 통일, 용어가이드 및 관리자 업데이트 이력 정리']];if(p==='stock')records.push(['2026-10-11','v94','사용량 보기를 관리자모드 해제 옆에 배치'],['2026-10-11','v92','공포탐욕 최근 흐름·하단 사용량 개선']);if(p==='kr-stock')records.push(['2026-10-11','v93','투자도구 왼쪽 정렬·한글 종목명·3종목 비교'],['2026-10-11','v92','기간 탭·실제 수신 점수 흐름·상세 표 개선'],['2026-10-11','v91','한글 검색·시장 지표·Help 개선']);if(p==='crypto')records.push(['2026-10-11','v94','한글 코인명 검색·왼쪽 투자도구·3종목 비교'],['2026-10-11','v92','현재 지수 제목·글로벌 트렌드 정렬']);if(p==='p2p')records.push(['2026-10-11','v93','오픈예정 상품 카드·일정 표시·제목 효과 개선']);if(p==='trade')records.push(['2026-10-11','v93','전략 3열·개별 상세 펼침·상단 잘림 개선']);records.push(['2026-10-23','v107','미국·한국·가상화폐·홈 하단 업데이트 표시 통일, 시그널 체크·한국주식 종목 표기 통일']);if(!['stock','kr-stock','mrkim-signal'].includes(p))records.push(['2026-10-11','v92','제목 옆 화면관리 버튼·상단 탭줄 정리'],['2026-10-11','v90','표·카드·모바일 간격 통일']);
if(p==='stock'){var legacy=d.getElementById('stock-update-history');if(legacy)legacy.querySelectorAll('li').forEach(function(li){records.push(['2026-10-10','기존',li.textContent]);});}
records.sort(function(a,b){return b[0].localeCompare(a[0])||Number(b[1].slice(1))-Number(a[1].slice(1));});Array.from(new Set(records.map(function(r){return r[0];}))).forEach(function(date){var group=d.createElement('details'),s=d.createElement('summary'),list=d.createElement('ul');s.textContent=date+' · '+name;records.filter(function(r){return r[0]===date;}).forEach(function(r){var li=d.createElement('li');li.textContent=r[1]+' · '+r[2];list.append(li);});group.append(s,list);history.append(group);});
function sync(){var admin=false;try{admin=localStorage.getItem('mk_gate_off')==='1';}catch(e){}history.hidden=!admin;if(!admin)history.open=false;d.querySelectorAll('.cross-update,#stock-update-footer').forEach(function(b){b.hidden=!admin;if(b.tagName==='BUTTON')b.textContent='🗓️ 업데이트 · '+(window.MK_UPDATED||'2026.10.23');});if(p==='stock'){var bar=d.getElementById('mk-admin-bar'),usage=d.getElementById('v92-usage');if(bar&&usage&&!bar.querySelector('.v94-usage-button')){var b=d.createElement('button');b.type='button';b.className='v94-usage-button';b.textContent='📊 사용량 보기';bar.append(b);b.onclick=function(){usage.open=!usage.open;usage.hidden=!admin;if(usage.open)usage.scrollIntoView({behavior:'smooth',block:'center'});};}if(usage)usage.classList.add('v94-usage');}}
sync();setInterval(sync,1500);window.addEventListener('storage',sync);var update=d.querySelector('.cross-update');if(p==='mrkim-signal'&&update)update.addEventListener('click',function(e){e.preventDefault();e.stopImmediatePropagation();if(!history.hidden)history.open=!history.open;},true);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready);else ready();})();

function refine95(p){var d=document;d.body.classList.add('refine-v95');
function repair(){if(p==='mrkim-signal'){d.querySelectorAll('.v90-actions,#pro-status,#pro-toc').forEach(function(n){n.hidden=true;});}else if(/^(bond|crypto|finprod|ipo|fx|trade)$/.test(p)){var status=d.getElementById('pro-status');if(status)status.classList.add('v95-inline-status');}
if(p==='kr-stock'){var brief=d.getElementById('pro-brief'),breadth=d.getElementById('kr-breadth-panel');if(brief&&breadth&&!brief.contains(breadth))brief.append(breadth);var tick=d.getElementById('pro-tick');if(tick)tick.hidden=true;var a=d.getElementById('kr-investor-trend'),b=d.getElementById('kr-market-deposit');if(a&&b){a.closest('.card').classList.add('v95-flow-card');b.closest('.card').classList.add('v95-flow-card');a.closest('.grid').classList.add('v95-flow-grid');}var comment=d.getElementById('kr-kimcomment');if(comment)comment.parentElement.classList.add('v95-comment');}
var hub=d.getElementById('unified-tools');if(hub){hub.querySelector('summary').classList.add('v95-tools-title');var panel=hub.querySelector('[data-panel=compare]'),chart=panel&&panel.querySelector('.ut-compare-chart'),form=panel&&panel.querySelector('form');if(chart&&form&&!panel.querySelector('.v95-compare-layout')){var layout=d.createElement('div');layout.className='v95-compare-layout';form.before(layout);layout.append(form,chart);}hub.querySelectorAll('[data-panel] h3').forEach(function(h){h.classList.add('v95-panel-title');});}
}
repair();var queued=false;new MutationObserver(function(records){if(records.every(function(r){return r.target.closest&&r.target.closest('#v92-update-history,#v92-usage');}))return;if(queued)return;queued=true;setTimeout(function(){queued=false;repair();},180);}).observe(d.querySelector('main'),{childList:true,subtree:true});
// Preserve market-specific definitions while giving every page the same Help interaction.
var guide=d.getElementById('guide'),existing=d.querySelector('.v94-guide,.market-help,.cross-home-guide');if(guide){var nodes=guide.querySelector('dl.gl-list,dl');if(nodes){var section=d.createElement('section');section.className='v95-guide';section.id='guide';var h=d.createElement('h2');h.id='guide-h';h.textContent='지표 읽는 법 (용어 가이드)';var button=d.createElement('button');button.type='button';button.className='v95-help';button.textContent='Help · 용어 보기 ⓘ';button.setAttribute('aria-expanded','false');button.setAttribute('aria-controls','v95-guide-content');h.append(button);var body=d.createElement('div');body.id='v95-guide-content';body.hidden=true;nodes.hidden=false;body.append(nodes);section.append(h,body);guide.replaceWith(section);if(existing)existing.remove();existing=section;}}
if(existing){existing.classList.add('v95-guide');var h=existing.querySelector('h2'),button=existing.querySelector('.v94-help,.v95-help'),body=existing.querySelector('.v94-guide-content,#v95-guide-content');if(h&&button&&body){button.textContent='Help · 용어 보기 ⓘ';button.classList.add('v95-help');button.onclick=function(){function toggle(){body.hidden=!body.hidden;button.setAttribute('aria-expanded',String(!body.hidden));button.textContent=body.hidden?'Help · 용어 보기 ⓘ':'Help · 용어 접기 ⓘ';}if(body.hidden&&window.MK_REQUEST_DETAIL)window.MK_REQUEST_DETAIL(toggle);else toggle();};}else if(existing.tagName==='DETAILS'){var replacement=d.createElement('section');replacement.className='v95-guide';var title=d.createElement('h2');title.textContent='지표 읽는 법 (용어 가이드)';var b=d.createElement('button');b.type='button';b.className='v95-help';b.textContent='Help · 용어 보기 ⓘ';b.setAttribute('aria-expanded','false');title.append(b);var content=d.createElement('div');content.hidden=true;Array.from(existing.children).forEach(function(n){if(n.tagName!=='SUMMARY')content.append(n);});replacement.append(title,content);existing.replaceWith(replacement);b.onclick=function(){function toggle(){content.hidden=!content.hidden;b.setAttribute('aria-expanded',String(!content.hidden));b.textContent=content.hidden?'Help · 용어 보기 ⓘ':'Help · 용어 접기 ⓘ';}if(content.hidden&&window.MK_REQUEST_DETAIL)window.MK_REQUEST_DETAIL(toggle);else toggle();};}}
var log=d.getElementById('v92-update-history'),list=log&&log.querySelector('ul');if(list){var entry=d.createElement('li');entry.textContent='v95 · 제목·메뉴·Help 통일, 그래프·투자도구 배치 및 여백 개선';list.prepend(entry);}
}

function refine96(p){var d=document;d.body.classList.add('refine-v96');if(/^(finprod|ipo|p2p|trade)$/.test(p)){var title=d.querySelector('main .hero2 h1,main .wrap>h2');if(title&&!title.closest('.v86-page-head')){title.classList.add('v96-duplicate-title');if(title.parentElement.classList.contains('hero2'))title.parentElement.classList.add('v96-duplicate-title');}}
if(p==='crypto'){var dial=d.getElementById('cf-dial'),card=dial&&dial.closest('.card');if(card){card.classList.add('v96-crypto-fg');var comment=d.getElementById('cf-kimcomment');if(comment&&comment.parentElement)comment.parentElement.classList.add('v96-comment');}var global=d.getElementById('cry-global-trend');if(global)global.closest('.card').classList.add('v96-global');}
setTimeout(function(){var log=d.querySelector('#v92-update-history ul');if(log){var li=d.createElement('li');li.textContent='v96 · 사용량 하단 줄·중복 제목 정리, 카드 여백·롤오버 및 전체 전략 펼침 개선';log.prepend(li);}},0);
}

function refine97(p){var d=document;d.body.classList.add('refine-v97');if(p==='stock'){var title=d.querySelector('#my-wl h3>span:first-child');if(title){title.querySelectorAll('.stock-tool-icon').forEach(function(n){n.remove();});title.classList.add('v97-watch-title');}var usage=d.getElementById('v92-usage');if(usage){var dialog=d.createElement('dialog');dialog.id='v97-usage-dialog';dialog.setAttribute('aria-labelledby','v97-usage-title');var heading=d.createElement('h2');heading.id='v97-usage-title';heading.textContent='사용량 조회';var close=d.createElement('button');close.type='button';close.className='v97-dialog-close';close.textContent='닫기 ×';heading.append(close);dialog.append(heading,usage);d.body.append(dialog);usage.querySelectorAll('summary').forEach(function(n){n.hidden=true;});usage.open=true;close.onclick=function(){if(dialog.close)dialog.close();else dialog.removeAttribute('open');};function connect(){var button=d.querySelector('.v94-usage-button');if(button)button.onclick=function(){if(localStorage.getItem('mk_gate_off')!=='1')return;usage.hidden=false;usage.open=true;var input=usage.querySelector('input');if(input&&!input.value)input.value=localStorage.getItem('mk_stats_key')||'';if(dialog.showModal)dialog.showModal();else dialog.setAttribute('open','');};if(localStorage.getItem('mk_gate_off')!=='1'&&dialog.open)close.onclick();}connect();setInterval(connect,1500);window.addEventListener('storage',connect);}}
var list=d.querySelector('#v92-update-history ul');if(list){var li=d.createElement('li');li.textContent='v97 · 경제일정 제목 정렬·관심종목 아이콘·용어가이드 글자 및 여백, 하단 사용량 카드 제거';list.prepend(li);}}

function refine98(p){var d=document;d.body.classList.add('refine-v98');function repair(){if(p==='finprod'){var status=d.getElementById('fin-events-status');if(status&&!status.closest('.fin-sec')){var card=status.nextElementSibling;if(card&&card.classList.contains('fin-sec')){var h=card.querySelector('h3');if(h)h.after(status);else card.prepend(status);}}}
if(p==='ipo'){var status=d.getElementById('ipo-live-status'),head=d.querySelector('.v86-page-head');if(status&&head&&!head.contains(status)){status.classList.add('v98-data-status');head.append(status);}var strip=d.getElementById('pro-status');if(strip)strip.hidden=true;}
if(p==='crypto'){d.querySelectorAll('h2.fold-h').forEach(function(h){var button=h.querySelector('.fold-b,.fold-btn,.m-fold-btn,button');if(button&&h.lastElementChild!==button)h.append(button);});}}
repair();var pending=false;new MutationObserver(function(records){if(records.every(function(r){return r.target.closest&&r.target.closest('#v92-update-history');}))return;if(pending)return;pending=true;setTimeout(function(){pending=false;repair();},180);}).observe(d.querySelector('main'),{childList:true,subtree:true});var log=d.querySelector('#v92-update-history ul');if(log){var li=d.createElement('li');li.textContent='v98 · 투자도구 글자·종목 행, 가상화폐 제목·버튼, 상품 안내·기준일·전략 배치 개선';log.prepend(li);}}

function refine99(p){var d=document;d.body.classList.add('refine-v99');function repair(){if(p==='kr-stock'){d.querySelectorAll('#pro-brief .stock-market-details,#pro-brief .stock-core-indices,#pro-tick').forEach(function(n){n.hidden=true;});var tape=d.getElementById('pro-tick'),group=tape&&tape.closest('details');if(group)group.hidden=true;var pulse=d.querySelector('.pulse');if(pulse&&!pulse.querySelector('.v99-percent-note')){var note=d.createElement('p');note.className='v99-percent-note';note.textContent='등락률(%) · 선택 기간 기준';var heading=pulse.querySelector('h3');if(heading)heading.after(note);}}
if(p==='finprod'){var head=d.querySelector('.v86-page-head');if(head&&!head.querySelector('.v99-fin-notes')){var box=d.createElement('div');box.className='v99-fin-notes';var notes=Array.from(d.querySelectorAll('main p')).filter(function(n){return n.tagName==='P'&&/예금·적금 금리 비교|이벤트는 기사 기반/.test(n.textContent);});if(notes.length){notes.forEach(function(n){box.append(n);});head.append(box);}}}}
repair();var pending=false;new MutationObserver(function(){if(pending)return;pending=true;setTimeout(function(){pending=false;repair();},180);}).observe(d.querySelector('main'),{childList:true,subtree:true});var log=d.querySelector('#v92-update-history ul');if(log){var li=d.createElement('li');li.textContent='v99 · 한국주식 종목·지수 줄·등락률 범례, 모바일 최근 흐름 숨김, 상단 여백·안내 정리';log.prepend(li);}}

function refine100(p){var d=document;d.body.classList.add('refine-v100');if(p==='p2p'){var key='mk_p2p_favorites_v100',favorites=[];try{var raw=JSON.parse(localStorage.getItem(key)||'[]');if(Array.isArray(raw))favorites=raw.filter(function(x){return x&&typeof x.url==='string'&&/^https?:\/\//.test(x.url)&&typeof x.name==='string';}).slice(0,30);}catch(e){}var host=d.getElementById('p2p-open-list');if(host){var section=d.createElement('section');section.className='v100-favorites';var heading=d.createElement('h3');heading.textContent='☆ 내 관심상품';var hint=d.createElement('p');hint.textContent='이 브라우저에 저장 · 최대 30개 · 신청 전 최신 조건을 확인하세요.';var list=d.createElement('div');list.className='v100-saved-list';var message=d.createElement('p');message.setAttribute('role','status');section.append(heading,hint,list,message);host.after(section);
function render(){list.replaceChildren();if(!favorites.length)list.textContent='상품의 ☆ 관심상품 버튼으로 저장하세요.';favorites.forEach(function(item){var row=d.createElement('div');row.className='v100-saved-row';var a=d.createElement('a');a.href=item.url;a.target='_blank';a.rel='noopener';a.textContent=item.name;var remove=d.createElement('button');remove.type='button';remove.textContent='삭제';remove.setAttribute('aria-label',item.name+' 관심상품 삭제');remove.onclick=function(){commit(favorites.filter(function(x){return x.url!==item.url;}));};row.append(a,remove);list.append(row);});host.querySelectorAll('[data-favorite-url]').forEach(function(b){var saved=favorites.some(function(x){return x.url===b.dataset.favoriteUrl;});b.textContent=saved?'★ 저장됨':'☆ 관심상품';b.setAttribute('aria-pressed',String(saved));});}
function commit(next){try{localStorage.setItem(key,JSON.stringify(next));favorites=next;message.textContent='관심상품 목록을 저장했습니다.';render();}catch(e){message.textContent='저장 공간을 확인해 주세요. 관심상품을 저장하지 못했습니다.';}}
function decorate(){host.querySelectorAll('a.p2p-card').forEach(function(card){if(card.parentElement.classList.contains('v100-product-wrap'))return;var url=card.href,name=card.querySelector('.p2p-tl')?.textContent.trim()||card.querySelector('.p2p-hd')?.textContent.trim()||'P2P 상품';var wrap=d.createElement('div');wrap.className='v100-product-wrap';card.before(wrap);wrap.append(card);var b=d.createElement('button');b.type='button';b.dataset.favoriteUrl=url;b.className='v100-save';b.onclick=function(){if(favorites.some(function(x){return x.url===url;})){commit(favorites.filter(function(x){return x.url!==url;}));return;}if(favorites.length>=30){message.textContent='관심상품은 최대 30개까지 저장할 수 있습니다.';return;}commit(favorites.concat({url:url,name:name,savedAt:Date.now()}));};wrap.append(b);});render();}
var pending=false;new MutationObserver(function(records){if(!records.some(function(r){return Array.from(r.addedNodes).some(function(n){return n.nodeType===1;});}))return;if(pending)return;pending=true;setTimeout(function(){pending=false;decorate();},100);}).observe(host,{childList:true,subtree:true});decorate();window.addEventListener('storage',function(e){if(e.key===key){try{var rows=JSON.parse(e.newValue||'[]');if(Array.isArray(rows))favorites=rows.filter(function(x){return x&&typeof x.url==='string'&&/^https?:\/\//.test(x.url)&&typeof x.name==='string';}).slice(0,30);render();}catch(error){}}});}}
var log=d.querySelector('#v92-update-history ul');if(log){var li=d.createElement('li');li.textContent='v100 · 모바일 제목·버튼·홈 2/3열, 공모주 추천·환율 표, P2P 관심상품 저장, 전략 여백 개선';log.prepend(li);}}
;(function(){try{
var d=document;
function tagFab(){
  var mq=window.matchMedia&&matchMedia('(max-width:700px)');
  if(mq&&!mq.matches)return;
  var els=d.body?d.body.querySelectorAll('a,button,div'):[];
  for(var i=0;i<els.length;i++){var el=els[i];
    if(el.id==='pro-top'||el.id==='mk-tabbar'||el.id==='mk-pos'||el.closest('#hd-pop,#mk-tabbar,#mk-gate,header'))continue;
    if(el.classList.contains('v101-fab-gift'))continue;
    var hit=(el.tagName==='A'&&/pay\.naver\.com\/point-gift/.test(el.getAttribute('href')||''))||/선물|🎁|💌/.test((el.textContent||'').slice(0,12))&&el.children.length<3;
    if(!hit)continue;
    var cs=getComputedStyle(el);
    if(cs.position==='fixed'){el.classList.add('v101-fab-gift');}
  }
}
[600,2000,5000].forEach(function(t){setTimeout(tagFab,t);});
window.addEventListener('resize',function(){clearTimeout(tagFab._t);tagFab._t=setTimeout(tagFab,300);});
}catch(e){}})();
;(function(){try{
var d=document;if(!d.body||!d.body.classList.contains('v93-stock'))return;
var mob=function(){return window.matchMedia&&matchMedia('(max-width:700px)').matches};
function foldsOpenDefault(){
  var KEY='mk_v102_init';try{if(localStorage.getItem(KEY))return;}catch(e){return}
  var want=mob()?['시가총액']:['시가총액','주요 이벤트'];
  var any=false;
  d.querySelectorAll('h2.fold-h').forEach(function(h){
    var t=(h.textContent||'');var hit=want.some(function(w){return t.indexOf(w)===0||t.indexOf(w)>-1&&t.indexOf(w)<3});
    var b=h.querySelector('button.fold-btn');
    if(hit&&b&&b.getAttribute('aria-expanded')==='false'){b.click();any=true}
  });
  try{localStorage.setItem(KEY,'1')}catch(e){}
}
function flags(){
  d.querySelectorAll('h2.fold-h .fold-t').forEach(function(t){
    if(t.querySelector('.v102-flag'))return;
    var n=t.lastChild;if(!n||n.nodeType!==3)return;
    var m=n.textContent.match(/^([\s\S]*?)\s*((?:\uD83C[\uDDE6-\uDDFF]){2})\s*$/);if(!m)return;
    n.textContent=m[1];var s=d.createElement('span');s.className='v102-flag';s.textContent=m[2];t.appendChild(s);
  });
}
function statusCompact(){
  var st=d.getElementById('pro-status');if(!st)return;
  var acts=d.querySelectorAll('#pro-status .cross-status-actions button,#pro-status .v87-status-actions button,.fold-all button[data-o]');
  acts.forEach(function(b){var l=(b.getAttribute('aria-label')||b.title||b.textContent||'');if(/다시|새로|불러/.test(l))return;b.classList.add('v102-hide-m');b._v102=1});
  hideM();
  var pop=d.getElementById('hd-pop');if(!pop||pop.querySelector('.v102-folds'))return;
  var row=d.createElement('div');row.className='hp-r v102-folds';
  [['모두 펼치기','1'],['모두 접기','0']].forEach(function(x){
    var btn=d.createElement('button');btn.type='button';btn.textContent=x[0];btn.style.cssText='min-height:44px;margin:4px 4px 4px 0;padding:0 12px';
    btn.onclick=function(){var o=d.querySelector('.fold-all button[data-o="'+x[1]+'"]');if(o)o.click()};row.appendChild(btn)});
  pop.appendChild(row);
}
function hideM(){var m=mob();d.querySelectorAll('.v102-hide-m').forEach(function(b){if(m)b.style.setProperty('display','none','important');else b.style.removeProperty('display')})}
window.addEventListener('resize',function(){clearTimeout(hideM._t);hideM._t=setTimeout(hideM,200)});
function run(){flags();statusCompact()}
[500,1500,3500].forEach(function(t){setTimeout(run,t)});
setTimeout(foldsOpenDefault,1800);
}catch(e){}})();

/* v104 — 공모주·금융상품 페이지 배치 정리 */
(function(){try{
var d=document,p=location.pathname.split('/').pop().replace('.html','');
function ipoFix(){
 var btn=d.getElementById('ipo-refresh'),acts=d.querySelector('.v90-actions');
 if(btn&&acts&&btn.parentElement!==acts){
  var reload=acts.querySelector('[data-other-action="reload"]');
  btn.textContent='↻ 공모주 새로고침';btn.classList.add('v104-ipo-rf');
  if(reload)reload.after(btn);else acts.prepend(btn);
 }
 var row=d.querySelector('.ipo-asof');
 if(row&&!row.querySelector('button,#ipo-live-status'))row.remove();
 else if(row&&!row.querySelector('button'))row.style.setProperty('display','none','important');
 var tabs=d.getElementById('ipo-month-tabs'),first=d.querySelector('#ipo .card, main section .card');
 var sub=d.querySelector('#ipo .pg-sub');
 if(tabs){var anchor=sub||null;
  if(anchor&&anchor.nextElementSibling!==tabs){anchor.after(tabs);}
  else if(!anchor&&first&&first.previousElementSibling!==tabs){first.before(tabs);}
  tabs.classList.add('v104-top-tabs');}
}
function finFix(){
 var st=d.getElementById('fin-events-status'),h=st&&st.parentElement&&st.parentElement.querySelector('h3.market-fold-h');
 if(st&&h&&st.parentElement!==h){var t=h.querySelector('.market-fold-title');(t?t:h.firstChild).after(st);st.classList.add('v104-inline-status');st.removeAttribute('style');}
 if(st)st.title=st.textContent;
}
function run(){if(p==='ipo')ipoFix();if(p==='finprod')finFix();}
if(p==='ipo'||p==='finprod'){[300,1200,2800,5000].forEach(function(t){setTimeout(run,t)});
 if(window.MutationObserver){var m=d.querySelector('main');if(m){var q;new MutationObserver(function(){clearTimeout(q);q=setTimeout(run,300)}).observe(m,{childList:true,subtree:true})}}}
}catch(e){}})();

/* v104 — "마지막으로 보던 곳 · 이어보기" 배너를 모든 페이지에서 미국주식과 같은 자리(본문 최상단)로 */
(function(){try{
var d=document;
function place(){
 var r=d.getElementById('mk-resume');if(!r)return;
 var brief=d.getElementById('pro-brief'),t=brief;
 if(!t){var w=d.querySelector('main section .wrap, main .wrap');t=w&&Array.prototype.find.call(w.children,function(c){return c!==r&&c.tagName!=='STYLE'&&!/^H[12]$/.test(c.tagName)&&c.getBoundingClientRect().height>0;});}
 if(t&&r.nextElementSibling!==t&&t.parentNode)t.parentNode.insertBefore(r,t);
}
[300,1200,2800,5000,8000].forEach(function(t){setTimeout(place,t)});
if(window.MutationObserver){var q;new MutationObserver(function(){clearTimeout(q);q=setTimeout(place,250)}).observe(d.body,{childList:true,subtree:true})}
}catch(e){}})();

/* v105 — 하단 메뉴: 떠 있는 둥근 5탭 + 탭을 누르면 위로 열리는 2열 팝업 (미국·한국·가상화폐 공통, 모바일) */
(function(){try{
var d=document,p=location.pathname.split('/').pop().replace('.html','');
if(!/^(stock|kr-stock|crypto)$/.test(p))return;
var ic={
 home:'<path d="M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"/>',
 mkt:'<path d="M4 20V10m6 10V4m6 16v-7m4 7H3"/>',
 sec:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2"/>',
 my:'<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9z"/>',
 more:'<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>'};
var svg=function(k){return '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">'+ic[k]+'</svg>'};
/* 섹션 제목 → 라벨 (제목에 해당 문구가 있는 섹션만 팝업에 표시) */
var G={
 mkt:[['요약','#pro-brief','요약'],['공탐지수','공포탐욕지수|공탐지수','공포·탐욕 지수'],['세부지표','세부지표','7개 세부지표'],['시장 한눈에','시장 한눈에 보기','시장 한눈에 보기'],['내부지표','내부지표','시장 내부지표'],['구간별','구간별','구간별 성과'],['경제지표','경제지표','경제지표·일정'],['지수 해석','지수 해석','지수 해석']],
 sec:[['시총 코스피','시가총액 TOP10 \\(코스피','시총 TOP10 (코스피)'],['시총 코스닥','시가총액 TOP10 \\(코스닥','시총 TOP10 (코스닥)'],['시총','시총 TOP10|시가총액 TOP10','시총 TOP10'],['레버리지','레버리지','레버리지 ETF'],['투자자','투자자별','투자자 동향'],['상대수익률','상대수익률|지수비교','상대수익률 비교'],['코인','주요 코인','주요 코인 가격'],['소셜','소셜','소셜 언급'],['유니콘','유니콘','유니콘'],['편입','편입','편입·편출']],
 ev:[['일정','이벤트 일정|주요 이벤트|핵심 일정','주요 이벤트 일정'],['가이드','지표 읽는 법','용어 가이드']]
};
var MY=[['관심종목','watch'],['내 계좌','account'],['종목 비교','compare']];
var MK=[['미국주식','stock.html','stock'],['한국주식','kr-stock.html','kr-stock'],['가상화폐','crypto.html','crypto']];
function heads(){return Array.prototype.filter.call(d.querySelectorAll('main h2.fold-h,main h3.market-fold-h,main h2.market-fold-h,main .pulse>h3,main .card>h3,main .fg-hd h3,main .v92-fg-header h3,main #pro-brief .pb-hd,main .v95-guide h2,main .v95-guide>*:first-child'),function(h){return h.getClientRects().length||h.closest('details:not([open])');});}
function txt(h){return (h.textContent||'').replace(/\s+/g,' ').trim();}
function find(rx){if(rx==='#pro-brief')return d.getElementById('pro-brief');var re=new RegExp(rx),hs=heads();for(var i=0;i<hs.length;i++){if(re.test(txt(hs[i])))return hs[i];}return null;}
function openFold(h){try{var b=h.querySelector('[aria-expanded]')||(h.hasAttribute('aria-expanded')?h:null);if(b&&b.getAttribute('aria-expanded')==='false'){b.click();}else if(h.classList&&h.classList.contains('fold-h')&&!h.classList.contains('open')){h.click();}var det=h.closest('details');if(det&&!det.open)det.open=true;}catch(e){}}
function go(h){if(!h)return;openFold(h);setTimeout(function(){var off=(d.querySelector('header')?d.querySelector('header').offsetHeight:0)+12;var y=h.getBoundingClientRect().top+window.scrollY-off;window.scrollTo({top:Math.max(0,y),behavior:'smooth'});},120);}
function tool(key){var hub=d.querySelector('#unified-tools'),det=d.querySelector('.stock-personal-details'),top=d.querySelector('.stock-bottom-personal');
 var sw=d.querySelector('.stock-tools-links [data-tool="'+key+'"]');
 if(p==='stock'){var map={watch:'my-wl',account:'mk-acct',compare:'mk-cmp'};sw=d.querySelector('.stock-tools-links [data-tool="'+map[key]+'"]');if(top)top.open=true;if(det)det.open=true;}
 else if(hub)hub.open=true;
 setTimeout(function(){if(sw)sw.click();var t=hub||top||sw;if(t){var off=(d.querySelector('header')?d.querySelector('header').offsetHeight:0)+8;window.scrollTo({top:Math.max(0,t.getBoundingClientRect().top+window.scrollY-off),behavior:'smooth'});}},200);}
function items(tab){
 var out=[];
 if(tab==='mkt'||tab==='sec'){var seen={};G[tab].forEach(function(g){var h=find(g[1]);if(!h)return;var key=txt(h).slice(0,30);if(seen[key])return;seen[key]=1;out.push({t:g[2],f:function(){go(h)}});});}
 if(tab==='my')MY.forEach(function(m){out.push({t:m[0],f:function(){tool(m[1])}});});
 if(tab==='more'){MK.forEach(function(m){if(m[2]!==p)out.push({t:m[0],f:function(){location.href=m[1]}});});G.ev.forEach(function(g){var h=find(g[1]);if(h)out.push({t:g[2],f:function(){go(h)}});});out.push({t:'맨 위로',f:function(){window.scrollTo({top:0,behavior:'smooth'})}});}
 return out;
}
var TABS=[['home','홈'],['mkt','시장'],['sec',p==='crypto'?'코인':'종목'],['my','투자도구'],['more','더보기']];
var bar,pop,cur=null;
function close(){if(pop)pop.hidden=true;cur=null;mark();}
function mark(){if(!bar)return;Array.prototype.forEach.call(bar.querySelectorAll('button'),function(b){b.classList.toggle('on',b.dataset.bb===cur);b.setAttribute('aria-expanded',b.dataset.bb===cur?'true':'false');});}
function layout(){if(!bar)return;var r=bar.getBoundingClientRect();if(pop)pop.style.bottom=(window.innerHeight-r.top+10)+'px';
 var h=bar.getBoundingClientRect().height+10;d.documentElement.style.setProperty('--stock-floating-nav-height',h+'px');d.documentElement.style.setProperty('--stock-tabs-height',h+'px');}
function build(){
 bar=d.getElementById('mk-tabbar');
 if(!bar){bar=d.createElement('nav');bar.id='mk-tabbar';d.body.appendChild(bar);}
 if(bar.dataset.v105)return;bar.dataset.v105='1';bar.classList.add('v105-bb');bar.setAttribute('aria-label','하단 메뉴');
 bar.innerHTML=TABS.map(function(t){return '<button type="button" data-bb="'+t[0]+'" aria-haspopup="'+(t[0]==='home'?'false':'true')+'" aria-expanded="false"><span class="ti">'+svg(t[0])+'</span><span class="tl">'+t[1]+'</span></button>';}).join('');
 var oldSheet=d.getElementById('mk-sheet');if(oldSheet)oldSheet.remove();
 pop=d.createElement('div');pop.id='mk-bb-pop';pop.hidden=true;pop.setAttribute('role','menu');d.body.appendChild(pop);
 /* 기존 탭바 클릭 처리를 막고 새 동작만 수행 */
 bar.addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;e.stopImmediatePropagation();e.preventDefault();var k=b.dataset.bb;
  if(k==='home'){close();cur='home';mark();window.scrollTo({top:0,behavior:'smooth'});setTimeout(function(){cur=null;mark();},900);return;}
  if(cur===k){close();return;}
  var it=items(k);pop.innerHTML=it.length?it.map(function(x,i){return '<button type="button" role="menuitem" data-i="'+i+'">'+x.t+'</button>';}).join(''):'<p class="v105-empty">이동할 항목을 불러오는 중입니다.</p>';
  pop._it=it;pop.hidden=false;cur=k;mark();layout();},true);
 pop.addEventListener('click',function(e){var b=e.target.closest('button[data-i]');if(!b)return;var it=pop._it[+b.dataset.i];close();if(it)it.f();});
 d.addEventListener('click',function(e){if(pop.hidden)return;if(e.target.closest('#mk-tabbar,#mk-bb-pop'))return;close();});
 d.addEventListener('keydown',function(e){if(e.key==='Escape')close();});
 window.addEventListener('resize',function(){layout();});
 layout();
}
function run(){build();layout();}
[600,1800,3500].forEach(function(t){setTimeout(run,t)});
}catch(e){}})();
