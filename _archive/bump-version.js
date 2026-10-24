/* 사용법: 사이트 폴더에서  node bump-version.js
   모든 *.html 안의 <script src="xxx.js?v=...">, <link href="xxx.css?v=..."> 의 v 값을
   해당 파일 내용의 해시(8자리)로 자동 교체합니다. 파일 내용이 바뀐 것만 v가 바뀌므로
   수동으로 버전을 올리다 빠뜨리는 실수를 막을 수 있습니다. */
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const dir=process.argv[2]||'.';
try{ if(dir==='.'&&fs.existsSync('build-min.js')) require('child_process').execSync('node build-min.js',{stdio:'inherit'}); }catch(e){ console.log('build-min 실행 실패(무시):',e.message); }
const hash=f=>crypto.createHash('md5').update(fs.readFileSync(f)).digest('hex').slice(0,8);
let changed=0;
fs.readdirSync(dir).filter(f=>f.endsWith('.html')).forEach(h=>{
  const p=path.join(dir,h); let s=fs.readFileSync(p,'utf8'), o=s;
  s=s.replace(/((?:src|href)=["'])([^"'?]+\.(?:js|css))\?v=[^"']*(["'])/g,(m,a,f,q)=>{
    const fp=path.join(dir,f); if(!fs.existsSync(fp)) return m; return a+f+'?v='+hash(fp)+q; });
  if(s!==o){ fs.writeFileSync(p,s); changed++; console.log('갱신:',h); }
});
console.log(changed?('완료: '+changed+'개 HTML'):'변경 없음');
