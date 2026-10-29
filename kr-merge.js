(function(){var d=document;
function pair(strong,weak,label){var s=d.querySelector('.krp-chips [data-k="'+strong+'"]'),w=d.querySelector('.krp-chips [data-k="'+weak+'"]');if(!s)return;
var sp=s.querySelector('span'),sb=s.querySelector('b');if(!sp||!sb)return;
var wb=w&&w.querySelector('b');var old=s.querySelector('.krp-w');
if(!wb){if(old)old.remove();return}
var txt=wb.textContent.trim();
if(old&&old.textContent===txt&&sp.textContent===label)return;
sp.textContent=label;if(old)old.remove();
var e=d.createElement('b');e.className='krp-w '+(wb.className||'');e.textContent=txt;s.appendChild(e);}
function run(){if(!d.querySelector('.krp-chips'))return;pair('ind','indw','업종 강 · 약');pair('th','thw','테마 강 · 약');}
var t=0,iv=setInterval(function(){run();if(++t>60)clearInterval(iv)},500);
if(window.MutationObserver){var mo=new MutationObserver(function(){run()});mo.observe(d.body,{childList:true,subtree:true});}
})();
