/* 사용법: node scripts/update-static.js [stock.html 경로]
   CNN 공포탐욕지수(+ 가능하면 VIX) 최신값을 가져와 stock.html 의 정적 문구와 JSON-LD(dateModified)에 기록합니다.
   → JS를 실행하지 않는 검색 봇·SNS 미리보기에도 최신 값이 보이게 하기 위한 용도입니다.
   값을 못 가져오면 파일을 건드리지 않고 종료(코드 0)하므로 기존 문구가 그대로 유지됩니다. */
const fs=require('fs');
const file=process.argv[2]||'stock.html';
const UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const get=async(url,extra)=>{ const r=await fetch(url,{headers:Object.assign({'User-Agent':UA,'Accept':'application/json'},extra||{})}); if(!r.ok) throw new Error(url+' '+r.status); return r.json(); };
const ZN=v=>v<25?'극단적 공포':v<45?'공포':v<=55?'중립':v<=75?'탐욕':'극단적 탐욕';
async function fetchFG(){
  const j=await get('https://production.dataviz.cnn.io/index/fearandgreed/graphdata',{Origin:'https://www.cnn.com',Referer:'https://www.cnn.com/'});
  const s=j&&j.fear_and_greed; if(!s||!isFinite(+s.score)) throw new Error('CNN 응답 형식 이상');
  return {score:Math.round(+s.score), ts:s.timestamp?new Date(s.timestamp):new Date()};
}
async function fetchVIX(){
  const j=await get('https://query1.finance.yahoo.com/v8/finance/chart/%5EVIX?range=5d&interval=1d');
  const m=j&&j.chart&&j.chart.result&&j.chart.result[0]&&j.chart.result[0].meta; return m&&isFinite(+m.regularMarketPrice)?+m.regularMarketPrice:null;
}
const kst=d=>{ const k=new Date(d.getTime()+9*3600e3); return k.toISOString().slice(0,10); };
async function main(){
  let fg; try{ fg=await fetchFG(); }catch(e){ console.log('공탐 조회 실패 → 변경 없음:',e.message); return; }
  let vix=null; try{ vix=await fetchVIX(); }catch(e){ console.log('VIX 조회 실패(무시):',e.message); }
  const day=kst(fg.ts);
  const txt='CNN 공포탐욕지수 '+day+' 기준 '+fg.score+' ('+ZN(fg.score)+')'+(vix!=null?' · VIX '+vix.toFixed(2):'')+'. 0(극단적 공포)~100(극단적 탐욕)이며, 최신 값은 아래 대시보드에서 실시간으로 갱신됩니다.';
  let h=fs.readFileSync(file,'utf8'), o=h;
  h=h.replace(/(<!--FG-STATIC-->)[\s\S]*?(<!--\/FG-STATIC-->)/,'$1'+txt+'$2');
  h=h.replace(/("dateModified":")[^"]*(")/,'$1'+day+'$2');
  if(!/"dateModified"/.test(h)) h=h.replace(/("@type":"WebPage",)/,'$1"dateModified":"'+day+'",');
  if(h===o){ console.log('변경 없음'); return; }
  fs.writeFileSync(file,h); console.log('갱신:',txt);
}
main().catch(e=>{ console.log('오류(무시):',e.message); });
