/* 사용법: node build-min.js   (최초 1회: npm i terser)
   mrkim-common.js, mrkim-pro.js 를 압축해 *.min.js 로 만듭니다. stock.html 은 *.min.js 를 불러옵니다.
   원본(.js)을 수정한 뒤에는 이 스크립트(또는 node bump-version.js — 내부에서 자동 실행)를 다시 돌려 주세요.
   terser 가 없으면 원본을 그대로 복사하므로 동작은 같고 용량만 줄지 않습니다. */
const fs=require('fs');
let T=null; try{ T=require('terser'); }catch(e){ console.log('terser 미설치 → 압축 없이 복사 (npm i terser 후 다시 실행하면 용량이 줄어듭니다)'); }
(async()=>{
  for(const f of ['mrkim-common.js','mrkim-pro.js']){
    const out=f.replace(/\.js$/,'.min.js'), src=fs.readFileSync(f,'utf8');
    if(!T){ if(!fs.existsSync(out)||fs.statSync(out).mtimeMs<fs.statSync(f).mtimeMs) fs.writeFileSync(out,src); continue; }
    const r=await T.minify(src,{compress:{passes:1},mangle:true,format:{comments:false,ascii_only:false}});
    if(r.error||!r.code){ console.log(f,'압축 실패 → 원본 복사'); fs.writeFileSync(out,src); continue; }
    fs.writeFileSync(out,r.code); console.log(f,fs.statSync(f).size,'→',fs.statSync(out).size,'bytes');
  }
})();
