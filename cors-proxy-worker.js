/* ===========================================================
   미주김군 시그널 — 시세 중계 프록시 (Cloudflare Workers)
   무료 플랜 하루 100,000 요청 — 개인 사이트에는 충분합니다.

   [배포 방법]
   1. dash.cloudflare.com 로그인 → 좌측 메뉴 Workers & Pages
   2. Create → Start with Hello World → Deploy
   3. Edit code 클릭 → 아래 코드 전체를 붙여넣고 Deploy
   4. 발급된 주소 확인 (예: https://misujukim.내계정.workers.dev)
   5. misujukim-signal.html 을 열어 아래 한 줄을 수정

        const PROXY_BASE='https://misujukim.내계정.workers.dev/?url=';

   이렇게 하면 공개 프록시에 의존하지 않아 데이터가 항상 안정적으로 뜹니다.

   [중요] 거래량·EPS·PER·PEG·ROA·ROE (Yahoo quoteSummary, v10) 가 뜨지 않는다면:
   Yahoo가 2024년 이후 이 엔드포인트에 세션 쿠키 + crumb 값을 요구하도록 정책을
   강화했습니다. 종가 차트(v8/finance/chart, 현재가·등락률·추세에 사용)는 인증이
   필요 없어 공개 프록시로도 동작하지만, quoteSummary(v10, 펀더멘털 데이터)는
   인증이 없으면 401 Unauthorized 를 반환합니다. 공개 프록시는 이 인증을 대신해줄
   수 없으므로, 아래 코드가 이 Worker 안에서 직접 쿠키를 발급받고 crumb 을 붙여
   요청합니다 — 즉 펀더멘털 데이터는 반드시 PROXY_BASE 에 이 Worker 주소를
   넣어야만 표시됩니다(공개 프록시로는 계속 '--' 로 보입니다).
   =========================================================== */

// 허용할 도메인만 통과시킵니다 (오픈 프록시로 악용되는 것을 막기 위함)
const ALLOW = [
  'query1.finance.yahoo.com',
  'query2.finance.yahoo.com',
  'api.coingecko.com',
  'api.alternative.me',
  'production.dataviz.cnn.io',
  'ecos.bok.or.kr',
  'data-dbg.krx.co.kr',
  'opendart.fss.or.kr'
];

/* OpenDART(전자공시) 인증키 — ECOS와 같은 방식(URL 쿼리파라미터)이지만, 페이지 소스에
   노출되지 않도록 이 Worker가 서버 쪽에서 자동으로 붙여준다(클라이언트는 crtfc_key 없이 요청). */
const DART_KEY = 'd16159a7a9745b083f68a60efb56fc745097261b';

/* KRX Open API 인증키 — AUTH_KEY 는 HTTP 헤더로만 전달 가능해 클라이언트 JS에서는
   직접 호출이 안 됩니다(CORS도 열려있지 않음). 이 Worker 안에만 보관해 페이지
   소스에는 절대 노출되지 않습니다. */
const KRX_AUTH_KEY = 'D18554D94CDB4AE9870672CE9BA98C560004BDB7';

/* ===================== 금융상품 페이지 — 증권·은행·카드 이벤트 자동 수집 =====================
   scheduled()가 24시간 주기로 아래 SOURCES를 순회하며 각 사이트를 가져와(fetch) 이벤트로
   보이는 텍스트 블록(마감일 패턴 + 근처 제목)을 추출한 뒤 KV에 저장한다. 클라이언트는
   /fin-events 로 그 결과만 읽어간다(전종목 배치라 브라우저에서 직접 크롤링 불가).

   [알려진 한계 — 반드시 확인 후 사용하세요]
   - 아래 URL은 각 기관의 "이벤트 목록" 페이지로 추정되는 주소이며, 이 Worker를 만든
     환경에서는 실제 응답을 받아 선택자를 검증할 수 없었습니다(네트워크 접근 불가).
     배포 후 /fin-events 응답을 실제로 확인해 비어있는 기관은 URL을 교체해야 합니다.
   - 은행·증권사·카드사 상당수가 React/Vue 등 JS 렌더링 기반 SPA라, 초기 HTML에는
     목록이 아예 없는 경우가 많습니다. 그런 사이트는 이 범용 파서로는 항상 빈 배열이
     됩니다 — 없는 데이터를 지어내지 않고 그대로 빈 상태로 둡니다.
   - "강도(별점)"는 실제 참여자 수·예산 규모를 알 수 없어 계산한 것이 아니라, 제목에
     강도를 암시하는 키워드(최대/전원/무제한/특별 등)와 금액·% 표기가 있는지로 어림한
     자체 추정치입니다(최대 3점) — 절대적 기준이 아닙니다. */
const FIN_SOURCES=[
  // 증권사
  {cat:'증권', name:'미래에셋증권', url:'https://securities.miraeasset.com/event/list.do'},
  {cat:'증권', name:'삼성증권', url:'https://www.samsungpop.com/wooriwm/index.jsp'},
  {cat:'증권', name:'한국투자증권', url:'https://www.truefriend.com/main/event/EventList.jsp'},
  {cat:'증권', name:'키움증권', url:'https://www.kiwoom.com/h/event/list'},
  {cat:'증권', name:'NH투자증권', url:'https://www.nhqv.com/event/list.do'},
  {cat:'증권', name:'KB증권', url:'https://www.kbsec.com/go.able?linkcd=m01060100'},
  {cat:'증권', name:'신한투자증권', url:'https://www.shinhansec.com/siw/event/EVE'},
  {cat:'증권', name:'대신증권', url:'https://www.daishin.com/c/event/list'},
  {cat:'증권', name:'하나증권', url:'https://www.hanaw.com/event/list.cmd'},
  {cat:'증권', name:'토스증권', url:'https://tossinvest.com/events'},
  // 은행
  {cat:'은행', name:'KB국민은행', url:'https://omoney.kbstar.com/quics?page=oevent&QSL=F'},
  {cat:'은행', name:'하나은행', url:'https://www.kebhana.com/cont/news/news02/index.jsp?_menuNo=98781'},
  {cat:'은행', name:'신한은행', url:'https://www.shinhan.com/hpe/index.jsp#902304010000'},
  {cat:'은행', name:'우리은행', url:'https://spot.wooribank.com/pot/Dream?withyou=EVEVT0001'},
  {cat:'은행', name:'NH농협은행', url:'https://www.nonghyup.com/eventzone/main.aspx'},
  {cat:'은행', name:'IBK기업은행', url:'https://www.ibk.co.kr/event/list.do'},
  {cat:'은행', name:'토스뱅크', url:'https://www.tossbank.com/articles'},
  {cat:'은행', name:'카카오뱅크', url:'https://www.kakaobank.com/notice/event'},
  {cat:'은행', name:'케이뱅크', url:'https://www.kbanknow.com/ib20/mnu/evtNews'},
  // 카드사
  {cat:'카드', name:'신한카드', url:'https://www.shinhancard.com/pconts/html/benefit/event/1198837_2450.html'},
  {cat:'카드', name:'삼성카드', url:'https://www.samsungcard.com/personal/event/UHPPCE0202M0.jsp'},
  {cat:'카드', name:'현대카드', url:'https://www.hyundaicard.com/cpw/ev/CPWEV0101_01.hc'},
  {cat:'카드', name:'국민카드', url:'https://card.kbcard.com/CRD/DVIEW/H0110000000?page=E'},
  {cat:'카드', name:'롯데카드', url:'https://www.lottecard.co.kr/app/LPBNFEA_0201.lc'},
  {cat:'카드', name:'우리카드', url:'https://www.wooricard.com/dcpc/yh1/CADCYH0101R01.do'},
  {cat:'카드', name:'하나카드', url:'https://www.hanacard.co.kr/OPP20000000M.web'},
  {cat:'카드', name:'BC카드', url:'https://www.bccard.com/app/mall/event/EventList.do'}
];

/* HTML → 텍스트만 남기고(태그·스크립트 제거) 공백 정리 */
function htmlToPlainText(html){
  return html
    .replace(/<script[\s\S]*?<\/script>/gi,' ')
    .replace(/<style[\s\S]*?<\/style>/gi,' ')
    .replace(/<!--[\s\S]*?-->/g,' ')
    .replace(/<[^>]+>/g,'\n')
    .replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>')
    .replace(/[ \t]+/g,' ')
    .split('\n').map(s=>s.trim()).filter(Boolean).join('\n');
}

/* 마감일 패턴: "~2026.10.31", "2026-10-31까지", "10.31(금)까지" 등 흔한 표기를 인식해
   해당 줄(또는 바로 앞 줄, 보통 이벤트 제목)과 함께 반환한다 */
const DEADLINE_RE=/(?:~\s*)?(20\d{2})[.\-\/](\d{1,2})[.\-\/](\d{1,2})(?:\s*까지)?|(\d{1,2})[.\-\/](\d{1,2})\s*까지/;
function extractEventsFromText(text, sourceUrl){
  const lines=text.split('\n');
  const events=[];
  const seen=new Set();
  for(let i=0;i<lines.length;i++){
    const line=lines[i];
    const m=DEADLINE_RE.exec(line);
    if(!m) continue;
    let deadlineTs=null;
    if(m[1]){ deadlineTs=Date.UTC(+m[1], +m[2]-1, +m[3]); }
    else if(m[4]){ const y=new Date().getUTCFullYear(); deadlineTs=Date.UTC(y, +m[4]-1, +m[5]); }
    // 제목 후보: 같은 줄에서 날짜 부분을 뺀 나머지, 비어있으면 바로 이전 줄 사용
    let title=line.replace(DEADLINE_RE,'').replace(/[·|\-–—:]+$/,'').trim();
    if(title.length<4 && i>0) title=lines[i-1].trim();
    if(!title || title.length<4 || title.length>80) continue;
    const key=title.slice(0,40);
    if(seen.has(key)) continue;
    seen.add(key);
    // 강도(별점) 자체 추정 — 절대 기준 아님, 키워드 기반 어림
    let star=1;
    if(/최대|전원|무제한|특별|한정|첫/.test(title)) star++;
    if(/\d{2,}(만원|%|만 원)/.test(title)) star++;
    star=Math.max(1,Math.min(3,star));
    events.push({title, deadlineTs, star, url:sourceUrl});
    if(events.length>=15) break;
  }
  return events;
}

async function crawlFinSource(src){
  try{
    const r=await fetch(src.url, { headers:{ 'User-Agent':UA, 'Accept':'text/html,*/*' } });
    if(!r.ok) return { ...src, events:[], error:'HTTP '+r.status };
    const html=await r.text();
    const text=htmlToPlainText(html);
    const events=extractEventsFromText(text, src.url);
    return { ...src, events, error: events.length?null:'이벤트 패턴을 찾지 못함(JS 렌더링 페이지일 가능성)' };
  }catch(e){ return { ...src, events:[], error:e.message }; }
}

async function crawlAllFinEvents(){
  const results=await Promise.all(FIN_SOURCES.map(crawlFinSource));
  const byCat={증권:[],은행:[],카드:[]};
  results.forEach(r=>{
    r.events.forEach(ev=>{ byCat[r.cat].push({ ...ev, source:r.name }); });
  });
  Object.keys(byCat).forEach(cat=>{
    // 마감순 정렬(마감일 모르는 항목은 뒤로)
    byCat[cat].sort((a,b)=>{
      if(a.deadlineTs==null && b.deadlineTs==null) return 0;
      if(a.deadlineTs==null) return 1;
      if(b.deadlineTs==null) return -1;
      return a.deadlineTs-b.deadlineTs;
    });
  });
  const failedSources=results.filter(r=>r.error).map(r=>r.name+'('+r.error+')');
  return { updatedAt:Date.now(), byCat, failedSources };
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
           '(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

/* Yahoo 쿠키·crumb 캐시 — 같은 Worker 인스턴스가 살아있는 동안만 재사용됩니다
   (콜드 스타트 시 자동으로 다시 발급받으므로 별도 관리는 필요 없습니다) */
let yahooAuth = null; // {cookie, crumb, exp}

function readSetCookie(res) {
  if (typeof res.headers.getSetCookie === 'function') {
    const all = res.headers.getSetCookie();
    if (all && all.length) return all.map(c => c.split(';')[0]).join('; ');
  }
  const single = res.headers.get('set-cookie');
  return single ? single.split(';')[0] : '';
}

async function getYahooAuth() {
  if (yahooAuth && Date.now() < yahooAuth.exp) return yahooAuth;
  const headers = { 'User-Agent': UA };
  let cookie = '';
  try {
    const r = await fetch('https://fc.yahoo.com', { headers, redirect: 'manual' });
    cookie = readSetCookie(r);
  } catch (e) {}
  if (!cookie) {
    try {
      const r = await fetch('https://finance.yahoo.com', { headers });
      cookie = readSetCookie(r);
    } catch (e) {}
  }
  if (!cookie) return null;
  let crumb = '';
  try {
    const r = await fetch('https://query1.finance.yahoo.com/v1/test/getcrumb', {
      headers: { ...headers, Cookie: cookie }
    });
    const text = (await r.text()).trim();
    if (r.ok && text && text.length < 20) crumb = text; // 실패 시 보통 HTML 페이지(길이 김)가 옴
  } catch (e) {}
  if (!crumb) return null;
  yahooAuth = { cookie, crumb, exp: Date.now() + 25 * 60 * 1000 };
  return yahooAuth;
}

/* ===== DART corp_code 자동 해석 =====
   OpenDART는 종목코드(005930)가 아니라 자체 corp_code(8자리)를 요구하는데,
   이 매핑은 DART가 제공하는 corpCode.xml(전체 상장·비상장사 목록, zip 압축) 파일에만
   있다. 종목이 늘어날 때마다 corp_code를 하나씩 손으로 찾아 넣는 대신, 이 Worker가
   그 zip 파일을 직접 받아 풀고 파싱해서 "종목코드 → corp_code" 표를 만들어 KV에
   캐시해둔다(7일 주기 갱신). 클라이언트는 /dart-corp?codes=005930,000660 형태로
   물어보기만 하면 된다. */
function readU16LE(buf, off){ return buf[off] | (buf[off+1] << 8); }
function readU32LE(buf, off){ return (buf[off] | (buf[off+1] << 8) | (buf[off+2] << 16) | (buf[off+3] << 24)) >>> 0; }

/* corpCode.xml.zip 은 파일이 1개뿐인 표준 zip이므로 로컬 파일 헤더만 파싱하면 충분하다 */
async function unzipSingleEntry(arrayBuffer) {
  const buf = new Uint8Array(arrayBuffer);
  if (readU32LE(buf, 0) !== 0x04034b50) throw new Error('zip local file header 서명 불일치');
  const compMethod = readU16LE(buf, 8);
  const compSize = readU32LE(buf, 18);
  const nameLen = readU16LE(buf, 26);
  const extraLen = readU16LE(buf, 28);
  const dataStart = 30 + nameLen + extraLen;
  const compData = buf.slice(dataStart, dataStart + compSize);
  if (compMethod === 0) return new TextDecoder('utf-8').decode(compData);
  if (compMethod === 8) {
    const stream = new Blob([compData]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    const decompressed = await new Response(stream).arrayBuffer();
    return new TextDecoder('utf-8').decode(decompressed);
  }
  throw new Error('지원하지 않는 압축 방식: ' + compMethod);
}

function parseCorpCodeXml(xmlText) {
  const map = {};
  const re = /<list>([\s\S]*?)<\/list>/g;
  let m;
  while ((m = re.exec(xmlText))) {
    const block = m[1];
    const cc = /<corp_code>\s*([^<]*)<\/corp_code>/.exec(block);
    const sc = /<stock_code>\s*([^<]*)<\/stock_code>/.exec(block);
    if (cc && sc && sc[1] && sc[1].trim()) map[sc[1].trim()] = cc[1].trim();
  }
  return map;
}

const DART_CORP_MAP_CACHE_KEY = 'dart-corpcode-map-v1';
let dartCorpMapMem = null; // 같은 Worker 인스턴스 생존 중 재사용

async function getDartCorpCodeMap(env) {
  if (dartCorpMapMem) return dartCorpMapMem;
  if (env.KR_KV) {
    try {
      const cached = await env.KR_KV.get(DART_CORP_MAP_CACHE_KEY);
      if (cached) { dartCorpMapMem = JSON.parse(cached); return dartCorpMapMem; }
    } catch (e) {}
  }
  const url = 'https://opendart.fss.or.kr/api/corpCode.xml?crtfc_key=' + DART_KEY;
  const res = await fetch(url);
  if (!res.ok) throw new Error('corpCode.xml 다운로드 실패: ' + res.status);
  const xmlText = await unzipSingleEntry(await res.arrayBuffer());
  const map = parseCorpCodeXml(xmlText);
  dartCorpMapMem = map;
  if (env.KR_KV) {
    try { await env.KR_KV.put(DART_CORP_MAP_CACHE_KEY, JSON.stringify(map), { expirationTtl: 7 * 24 * 3600 }); } catch (e) {}
  }
  return map;
}

/* KRX 응답에서 후보 필드명 중 존재하는 첫 값을 반환 (실제 필드명 미확정 대응) */
function pickField(row, keys) {
  for (const k of keys) { if (row[k] != null && row[k] !== '') return row[k]; }
  return null;
}
function fmtYmd(d) {
  return d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
}
async function fetchKrxRows(path, basDd) {
  try {
    const r = await fetch('https://data-dbg.krx.co.kr/svc/apis/' + path + '?basDd=' + basDd, {
      headers: { 'AUTH_KEY': KRX_AUTH_KEY, 'Accept': 'application/json' }
    });
    if (!r.ok) return null;
    const j = await r.json();
    return j.OutBlock_1 || null;
  } catch (e) { return null; }
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS });
    }

    const reqUrl = new URL(request.url);

    // 2번(주가 강도)·3번(주가 폭) 사전 계산 결과 — 매일 1회 scheduled()가 KV에 저장해둔 값을 그대로 서빙
    if (reqUrl.pathname === '/kr-breadth') {
      let data = '{}';
      try { data = (await env.KR_KV.get('kr-breadth-latest')) || '{}'; } catch (e) {}
      return new Response(data, { headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    // 종목코드 → DART corp_code 자동 해석 (예: /dart-corp?codes=005930,000660)
    if (reqUrl.pathname === '/dart-corp') {
      const codesParam = reqUrl.searchParams.get('codes') || reqUrl.searchParams.get('code');
      if (!codesParam) return new Response('missing codes parameter', { status: 400, headers: CORS });
      try {
        const map = await getDartCorpCodeMap(env);
        const out = {};
        codesParam.split(',').map(s => s.trim()).filter(Boolean).forEach(c => { out[c] = map[c] || null; });
        return new Response(JSON.stringify(out), { headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600' } });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 502, headers: { ...CORS, 'Content-Type': 'application/json' } });
      }
    }

    // 금융상품 페이지 — 증권·은행·카드 이벤트 목록 (scheduled()가 매일 갱신해 KV에 저장한 값을 그대로 서빙)
    if (reqUrl.pathname === '/fin-events') {
      let data = '{}';
      try { data = (await env.KR_KV.get('fin-events-latest')) || '{}'; } catch (e) {}
      return new Response(data, { headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    let target = reqUrl.searchParams.get('url');
    if (!target) {
      return new Response('missing url parameter', { status: 400, headers: CORS });
    }

    let host;
    try {
      host = new URL(target).hostname;
    } catch (e) {
      return new Response('invalid url', { status: 400, headers: CORS });
    }

    if (!ALLOW.includes(host)) {
      return new Response('host not allowed', { status: 403, headers: CORS });
    }

    // CNN 은 Referer/Origin 이 cnn.com 이 아니면 HTTP 418 로 차단합니다.
    // 이 헤더를 붙여주는 것이 이 Worker 의 핵심 역할입니다.
    const headers = {
      'User-Agent': UA,
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.9'
    };
    if (host.endsWith('cnn.io') || host.endsWith('cnn.com')) {
      headers['Referer'] = 'https://edition.cnn.com/';
      headers['Origin'] = 'https://edition.cnn.com';
      headers['sec-fetch-site'] = 'same-site';
      headers['sec-fetch-mode'] = 'cors';
    }

    // Yahoo quoteSummary(v10, 펀더멘털)는 쿠키+crumb 인증이 필요합니다.
    if ((host === 'query1.finance.yahoo.com' || host === 'query2.finance.yahoo.com')
        && target.includes('/quoteSummary/')) {
      const auth = await getYahooAuth();
      if (auth) {
        const u = new URL(target);
        u.searchParams.set('crumb', auth.crumb);
        target = u.toString();
        headers['Cookie'] = auth.cookie;
      }
    }

    // KRX Open API 는 AUTH_KEY 를 HTTP 헤더로 요구합니다(URL 파라미터 아님).
    if (host === 'data-dbg.krx.co.kr') {
      headers['AUTH_KEY'] = KRX_AUTH_KEY;
    }

    // OpenDART 는 crtfc_key 쿼리파라미터로 인증합니다 — 클라이언트가 안 붙여도 여기서 채워준다.
    if (host === 'opendart.fss.or.kr') {
      const u = new URL(target);
      if (!u.searchParams.get('crtfc_key')) {
        u.searchParams.set('crtfc_key', DART_KEY);
        target = u.toString();
      }
    }

    try {
      const upstream = await fetch(target, {
        headers,
        // 같은 응답을 60초간 캐시해 호출 수를 줄입니다
        cf: { cacheTtl: 60, cacheEverything: true }
      });

      const body = await upstream.text();
      return new Response(body, {
        status: upstream.status,
        headers: {
          ...CORS,
          'Content-Type': upstream.headers.get('content-type') || 'application/json',
          'Cache-Control': 'public, max-age=60'
        }
      });
    } catch (e) {
      return new Response('upstream error: ' + e.message, { status: 502, headers: CORS });
    }
  },

  /* 매일 1회(Cron Trigger, 24시간 주기) 실행 — 코스피·코스닥 전종목 당일 시세를 받아
     3번(주가 폭: 상승/하락 거래량)과 2번(주가 강도: 52주 신고가/신저가 종목수)을
     계산해 KV에 저장한다. 클라이언트는 이 결과를 /kr-breadth 로 읽어간다.
     [설정 필요] Worker 대시보드 → Settings → Variables → KV Namespace Bindings 에서
     이름 KR_KV 로 바인딩하고, Triggers → Cron Triggers 에 스케줄을 추가해야 동작합니다
     (예: '0 8 * * *' = 매일 UTC 08:00 = 한국시간 17:00, 장마감 이후). */
  async scheduled(event, env, ctx) {
    const today = new Date();
    const basDd = fmtYmd(today);

    // 금융상품 페이지용 증권·은행·카드 이벤트 크롤링(24시간 주기 — 매일 이 스케줄러가 실행될 때 1회)
    ctx.waitUntil((async()=>{
      try{
        const finData=await crawlAllFinEvents();
        if(env.KR_KV) await env.KR_KV.put('fin-events-latest', JSON.stringify(finData));
      }catch(e){ /* 실패해도 이전 값 유지, 다음 스케줄에서 재시도 */ }
    })());

    const [kospiRows, kosdaqRows] = await Promise.all([
      fetchKrxRows('sto/stk_bydd_trd', basDd),
      fetchKrxRows('sto/ksq_bydd_trd', basDd) // 코스닥 서비스 미승인 시 null → 코스피만으로 계산
    ]);
    const allRows = [].concat(kospiRows || [], kosdaqRows || []);
    if (!allRows.length) return; // 휴장일이거나 응답 실패 — 이번 회차는 건너뜀(이전 값 유지)

    // 3. 주가 폭: 오늘 하루 데이터만으로 계산 가능
    let advVol = 0, declVol = 0;
    allRows.forEach(r => {
      const chg = parseFloat(pickField(r, ['FLUC_RT', 'FLUC_TP_CD', 'CMPPREVDD_PRC']));
      const vol = parseFloat(pickField(r, ['ACC_TRDVOL', 'TRDVOL'])) || 0;
      if (chg > 0) advVol += vol;
      else if (chg < 0) declVol += vol;
    });
    const breadthTotal = advVol + declVol;
    const breadthScore = breadthTotal > 0 ? (advVol / breadthTotal) * 100 : 50;

    // 2. 주가 강도: KV에 종목별 종가 이력을 계속 누적해 52주(252거래일) 롤링 고가/저가 판정
    const histKey = 'kr-price-hist';
    let hist = {};
    try {
      const raw = env.KR_KV ? await env.KR_KV.get(histKey) : null;
      if (raw) hist = JSON.parse(raw);
    } catch (e) {}

    let highs = 0, lows = 0, counted = 0;
    allRows.forEach(r => {
      const code = pickField(r, ['ISU_CD', 'ISU_SRT_CD', 'ISU_CD6']);
      const close = parseFloat(pickField(r, ['TDD_CLSPRC', 'CLSPRC']));
      if (!code || !isFinite(close)) return;
      if (!hist[code]) hist[code] = [];
      hist[code].push(close);
      if (hist[code].length > 252) hist[code].shift();
      const maxV = Math.max(...hist[code]);
      const minV = Math.min(...hist[code]);
      if (close >= maxV) highs++;
      if (close <= minV) lows++;
      counted++;
    });
    const strengthTotal = highs + lows;
    const strengthScore = strengthTotal > 0 ? (highs / strengthTotal) * 100 : 50;
    const daysAccumulated = counted ? Math.max(...Object.values(hist).map(a => a.length)) : 0;

    if (env.KR_KV) {
      await env.KR_KV.put(histKey, JSON.stringify(hist));
      await env.KR_KV.put('kr-breadth-latest', JSON.stringify({
        date: basDd,
        breadth: { advVol, declVol, score: breadthScore },
        strength: { highs, lows, score: strengthScore, daysAccumulated, stockCount: counted },
        market: kosdaqRows ? 'KOSPI+KOSDAQ' : 'KOSPI만'
      }));
    }
  }
};
