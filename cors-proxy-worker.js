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
  'opendart.fss.or.kr',
  'finlife.fss.or.kr', // 금융상품한눈에 오픈API(예금·적금 금리비교) — 인증키 발급 후 사용
  'api.bcb.gov.br', // 브라질 중앙은행 SGS(SELIC·IPCA) — 환율 페이지 브라질 국채 수익률
  'news.google.com', // 유니콘 기업 최근 뉴스(Google News RSS)
  'm.stock.naver.com', // Npay 증권 모바일 — 지수별 투자자 동향(개인/외국인/기관 순매수)
  'stock.naver.com', // Npay 증권 PC — 증시자금동향(고객예탁금·신용잔고·펀드)
  'api.coinmarketcap.com' // 코인마켓캡 ETF 순유입 차트(가상화폐 페이지 + 버튼)
];

/* OpenDART(전자공시) 인증키 — ECOS와 같은 방식(URL 쿼리파라미터)이지만, 페이지 소스에
   노출되지 않도록 이 Worker가 서버 쪽에서 자동으로 붙여준다(클라이언트는 crtfc_key 없이 요청). */
const DART_KEY = 'd16159a7a9745b083f68a60efb56fc745097261b';

/* DART corpCode.xml 은 종목코드→고유번호(corp_code) 전체 목록을 zip 압축 파일로 준다.
   [주의] 이 zip 파싱 코드는 실제 파일로 직접 검증하지 못했다(테스트 환경에서 라이브 호출이
   안 됨) — 표준 단일 파일 zip(로컬 파일 헤더 뒤 압축 데이터) 구조를 가정한 최선의 구현이다.
   문제가 있으면 Worker 로그(Cloudflare 대시보드 → Logs)에서 에러 메시지를 확인해달라고
   안내해야 한다. KV에 24시간 캐시해 매번 다시 받지 않는다. */
async function getDartCorpMap(env, forceRebuild) {
  // [버그 수정] zip 파싱 버그가 있던 예전 코드가 이미 빈 byName({})을 KV에 24시간 캐시해둔
  // 상태였다 — forceRebuild를 걸어도 getDartCorpMapByName이 그 낡은 빈 캐시를 그대로 읽어
  // 반환해버려(캐시 값이 "{}"라는 비어있지 않은 문자열이라 truthy 체크를 통과) 고쳐도 안 고쳐진
  // 것처럼 보였다. 캐시 키 버전을 올려 낡은 캐시를 완전히 무시하고 새로 받도록 한다.
  const cacheKey = 'dart-corp-map-v2';
  if (env.KR_KV && !forceRebuild) {
    try {
      const cached = await env.KR_KV.get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch (e) {}
  }
  // [버그 수정] User-Agent 없이 호출하면 Cloudflare 엣지에서 나가는 요청을 OpenDART가
  // 봇으로 간주해 /error1.html로 계속 리다이렉트해(무한 루프 → "Too many redirects") 실패했다.
  // 다른 DART 호출(fetchEucKr, 일반 프록시 경로)처럼 브라우저 User-Agent를 붙여준다.
  const resp = await fetch('https://opendart.fss.or.kr/api/corpCode.xml?crtfc_key=' + DART_KEY, {
    headers: { 'User-Agent': UA }
  });
  if (!resp.ok) throw new Error('corpCode.xml 요청 실패: HTTP ' + resp.status);
  const buf = new Uint8Array(await resp.arrayBuffer());
  if (buf.length < 30 || (buf[0]!==0x50 || buf[1]!==0x4b || buf[2]!==0x03 || buf[3]!==0x04)) {
    throw new Error('corpCode.xml 응답이 예상한 zip 형식이 아님(인증키 오류 등의 에러 메시지일 수 있음): ' +
      new TextDecoder('utf-8').decode(buf.slice(0, 300)));
  }
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  // [버그 수정] corpCode.xml의 zip은 스트리밍 방식(로컬 파일 헤더의 general purpose flag의
  // bit 3이 켜져 있음)으로 만들어져 있어, 로컬 헤더의 압축크기·압축해제크기가 전부 0으로
  // 채워져 있고 실제 값은 파일 맨 끝의 중앙 디렉터리(Central Directory)에만 들어있다.
  // 로컬 헤더의 compSize(=0)를 그대로 슬라이스에 써버리면 압축 데이터가 빈 배열이 돼
  // DecompressionStream이 "incomplete data"로 실패한다 — 그래서 EOCD → 중앙 디렉터리 →
  // (필요하면) 그 안의 로컬 헤더 오프셋까지 따라가 진짜 압축크기를 읽는다.
  const localFlag = view.getUint16(6, true);
  let compMethod, compSize, dataStart;
  const localNameLen = view.getUint16(26, true);
  const localExtraLen = view.getUint16(28, true);
  const usesDataDescriptor = (localFlag & 0x0008) !== 0;
  if (!usesDataDescriptor) {
    compMethod = view.getUint16(8, true);
    compSize = view.getUint32(18, true);
    dataStart = 30 + localNameLen + localExtraLen;
  } else {
    // EOCD 시그니처(PK\x05\x06)를 파일 끝에서부터 거꾸로 찾는다(끝에 코멘트가 붙어있을 수
    // 있어 고정 오프셋을 가정할 수 없음 — 표준 zip 파싱 방식).
    let eocdIdx = -1;
    const searchFrom = Math.max(0, buf.length - 65557); // EOCD(22) + 코멘트 최대 65535
    for (let i = buf.length - 22; i >= searchFrom; i--) {
      if (buf[i] === 0x50 && buf[i+1] === 0x4b && buf[i+2] === 0x05 && buf[i+3] === 0x06) { eocdIdx = i; break; }
    }
    if (eocdIdx < 0) throw new Error('corpCode.xml zip에서 EOCD(중앙 디렉터리 끝 표시)를 찾지 못함 — 응답이 중간에 잘렸을 수 있음(len=' + buf.length + ')');
    const cdOffset = view.getUint32(eocdIdx + 16, true);
    if (buf[cdOffset] !== 0x50 || buf[cdOffset+1] !== 0x4b || buf[cdOffset+2] !== 0x01 || buf[cdOffset+3] !== 0x02) {
      throw new Error('corpCode.xml zip 중앙 디렉터리 헤더 시그니처가 예상과 다름(offset=' + cdOffset + ')');
    }
    compMethod = view.getUint16(cdOffset + 10, true);
    compSize = view.getUint32(cdOffset + 20, true);
    const localHeaderOffset = view.getUint32(cdOffset + 42, true);
    const nameLen2 = view.getUint16(localHeaderOffset + 26, true);
    const extraLen2 = view.getUint16(localHeaderOffset + 28, true);
    dataStart = localHeaderOffset + 30 + nameLen2 + extraLen2;
  }
  const compData = buf.slice(dataStart, dataStart + compSize);
  if (compData.length !== compSize) {
    throw new Error('corpCode.xml 응답이 중간에 잘림(필요 ' + compSize + '바이트, 받은 ' + compData.length + '바이트) — 네트워크 타임아웃 가능성');
  }
  let xmlBytes;
  if (compMethod === 0) {
    xmlBytes = compData;
  } else if (compMethod === 8) {
    const stream = new Blob([compData]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    xmlBytes = new Uint8Array(await new Response(stream).arrayBuffer());
  } else {
    throw new Error('지원하지 않는 zip 압축 방식(' + compMethod + ')');
  }
  const xmlText = new TextDecoder('utf-8').decode(xmlBytes);
  const map = {};
  // 공모주(38.co.kr) 신규상장 종목은 stock_code가 아직 우리 IPO 캘린더 데이터에 없어 회사명으로
  // corp_code를 찾아야 할 때가 있다(비상장·상장예정 회사는 stock_code가 비어 있을 수도 있음) —
  // 그래서 stock_code 맵과 별개로 회사명→corp_code 맵도 함께 만들어둔다.
  const byName = {};
  // [버그 수정] 실제 corpCode.xml은 <corp_name> 다음에 바로 <stock_code>가 오지 않고 그 사이에
  // <corp_eng_name>(영문명) 태그가 하나 더 있다(순서: corp_code, corp_name, corp_eng_name,
  // stock_code, modify_date). 이전 정규식은 </corp_name> 뒤에 곧바로 <stock_code>가 온다고
  // 가정해 단 한 건도 매칭되지 않았다(totalNames:0의 진짜 원인 — 캐시 문제가 아니었다).
  // <list>...</list> 블록 단위로 잘라, 그 안에서 각 태그를 순서와 무관하게 개별로 뽑아내는
  // 방식으로 바꿔 향후 필드 순서가 바뀌어도 안전하게 만든다.
  const listRe = /<list>([\s\S]*?)<\/list>/g;
  const codeRe = /<corp_code>\s*(\d+)\s*<\/corp_code>/;
  const nameRe = /<corp_name>([^<]*)<\/corp_name>/;
  const stockRe = /<stock_code>\s*([^<]*?)\s*<\/stock_code>/;
  let lm;
  while ((lm = listRe.exec(xmlText))) {
    const block = lm[1];
    const cm = codeRe.exec(block);
    const nm = nameRe.exec(block);
    const sm = stockRe.exec(block);
    if (!cm) continue;
    const corpCode = cm[1];
    const corpName = nm ? nm[1].trim() : '';
    const stockCode = sm ? sm[1].trim() : '';
    if (stockCode) map[stockCode] = corpCode;
    // 동명 회사가 있으면 상장사(stock_code 있음)를 우선 채택 — 이미 상장사로 채워져 있으면 덮어쓰지 않는다.
    if (corpName && (!(corpName in byName) || (stockCode && !byName[corpName].stockCode))) {
      byName[corpName] = { corpCode: corpCode, stockCode: stockCode || null };
    }
  }
  // [버그 수정] 결과가 비어있으면(파싱 실패 등으로 종목이 하나도 안 잡힌 경우) 캐시에 저장하지
  // 않는다 — 빈 값을 24시간 캐시해버리면 다음 요청부터 원인과 상관없이 계속 빈 결과만 보게 된다.
  if (env.KR_KV) {
    if (Object.keys(map).length > 0) {
      try { await env.KR_KV.put(cacheKey, JSON.stringify(map), { expirationTtl: 86400 }); } catch (e) {}
    }
    if (Object.keys(byName).length > 0) {
      try { await env.KR_KV.put(cacheKey + '-byname', JSON.stringify(byName), { expirationTtl: 86400 }); } catch (e) {}
    }
  }
  getDartCorpMap._byNameCache = byName; // 같은 요청/워커 인스턴스 내 재사용(KV 재조회 회피)
  return map;
}

async function getDartCorpMapByName(env) {
  if (env.KR_KV) {
    try {
      const cached = await env.KR_KV.get('dart-corp-map-v2-byname');
      // [버그 수정] 캐시된 값이 "{}"(빈 객체)면 예전 실패한 빌드가 남긴 찌꺼기일 수 있으므로
      // 신뢰하지 않고 강제로 다시 만든다 — 키만 비운 값을 24시간 그대로 믿고 계속 돌려주던
      // 문제(재배포해도 계속 totalNames:0)를 근본적으로 막기 위함.
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && Object.keys(parsed).length > 0) return parsed;
      }
    } catch (e) {}
  }
  if (getDartCorpMap._byNameCache && Object.keys(getDartCorpMap._byNameCache).length > 0) {
    return getDartCorpMap._byNameCache;
  }
  // KV에 아직 유효한 byname 캐시가 없다(최초 실행이거나 이전에 빈 값으로 실패했던 경우) —
  // corpCode.xml을 강제로 새로 받아 byName 맵을 만든다.
  await getDartCorpMap(env, true);
  return getDartCorpMap._byNameCache || {};
}

/* KRX Open API 인증키 — AUTH_KEY 는 HTTP 헤더로만 전달 가능해 클라이언트 JS에서는
   직접 호출이 안 됩니다(CORS도 열려있지 않음). 이 Worker 안에만 보관해 페이지
   소스에는 절대 노출되지 않습니다. */
const KRX_AUTH_KEY = 'D18554D94CDB4AE9870672CE9BA98C560004BDB7';

/* 금융감독원 "금융상품한눈에" 오픈API 인증키 — 예금/적금 금리비교(금융상품 페이지).
   ECOS와 마찬가지로 URL 쿼리파라미터 방식이지만, 페이지 소스 노출을 막기 위해
   이 Worker 안에서만 사용한다(클라이언트는 auth 없이 /fin-savings 로 요청). */
const FSS_SAVINGS_KEY = 'a80b3f5cd2bdf13971df53a72f67604f';
/* [2026-09-29 실측 확인] topFinGrpNo 코드: 은행=020000(39개 상품, 1페이지),
   저축은행=030300(393개 상품, 4페이지) — 처음 추정했던 030200(저축은행)은 총건수 0으로
   틀린 코드였다. finlife 포털에 공식 코드표가 없어 실제 호출로 직접 검증한 값이다. */
const FSS_GROUPS = [{ code: '020000', label: '은행' }, { code: '030300', label: '저축은행' }];

let FIN_DIAG = [];
async function fetchFinlifePages(path, grp) {
  const mk = page => 'https://finlife.fss.or.kr/finlifeapi/' + path + '.json?auth=' + FSS_SAVINGS_KEY + '&topFinGrpNo=' + grp + '&pageNo=' + page;
  const get = async page => { try { const r = await fetch(mk(page), { redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Accept': 'application/json' } }); if (!r.ok) { FIN_DIAG.push(path + ' ' + grp + ' p' + page + ' HTTP ' + r.status); return null; } const j = await r.json(); const res = j.result || {}; if (res.err_cd && res.err_cd !== '000') FIN_DIAG.push(path + ' ' + grp + ' ' + res.err_cd + ' ' + (res.err_msg || '')); return res; } catch (e) { FIN_DIAG.push(path + ' ' + grp + ' p' + page + ' ' + String(e).slice(0, 80)); return null; } };
  // 1페이지로 전체 페이지 수를 알아낸 뒤 나머지는 동시에 요청한다(예전엔 순차 → 저축은행 4페이지를 하나씩 기다렸다).
  const first = await get(1);
  if (!first) return { base: [], opt: [] };
  const maxPage = Math.min(first.max_page_no || 1, 10);
  const rest = [];
  for (let p = 2; p <= maxPage; p++) rest.push(get(p));
  const others = await Promise.all(rest);
  let base = (first.baseList || []), opt = (first.optionList || []);
  others.forEach(res => { if (res) { base = base.concat(res.baseList || []); opt = opt.concat(res.optionList || []); } });
  return { base, opt };
}

/* 여러 저축기간(save_trm) 옵션 중 비교 기준으로 삼을 하나를 고른다 — 12개월이 있으면
   그걸 쓰고, 없으면 12개월에 가장 가까운 기간을 쓴다(상품마다 제공 기간이 달라서). */
function pickTermRate(opts, prefTerm) {
  const withTerm = opts.map(o => Object.assign({}, o, { termNum: parseInt(o.save_trm, 10) }))
    .filter(o => isFinite(o.termNum));
  if (!withTerm.length) return null;
  let best = withTerm.find(o => o.termNum === prefTerm);
  if (!best) best = withTerm.slice().sort((a, b) => Math.abs(a.termNum - prefTerm) - Math.abs(b.termNum - prefTerm))[0];
  return best;
}

async function buildFinlifeList(path) {
  const items = [];
  const fetched = await Promise.all(FSS_GROUPS.map(g => fetchFinlifePages(path, g.code)));
  for (let gi = 0; gi < FSS_GROUPS.length; gi++) {
    const g = FSS_GROUPS[gi];
    const { base, opt } = fetched[gi];
    const optByCd = {};
    opt.forEach(o => { (optByCd[o.fin_prdt_cd] = optByCd[o.fin_prdt_cd] || []).push(o); });
    base.forEach(b => {
      const rates = optByCd[b.fin_prdt_cd] || [];
      const r = pickTermRate(rates, 12);
      if (!r || !isFinite(r.intr_rate2)) return;
      items.push({
        group: g.label,
        company: b.kor_co_nm,
        product: b.fin_prdt_nm,
        term: r.termNum,
        baseRate: r.intr_rate,
        maxRate: r.intr_rate2,
        rsrvType: r.rsrv_type_nm || null,
        joinWay: b.join_way,
        maxLimit: b.max_limit,
        condition: (b.spcl_cnd || '').replace(/\s+/g, ' ').trim().slice(0, 220)
      });
    });
  }
  items.sort((a, b) => (b.maxRate || 0) - (a.maxRate || 0));
  return items;
}

async function runFinSavingsJob(env) {
  const [deposit, saving] = await Promise.all([
    buildFinlifeList('depositProductsSearch'),
    buildFinlifeList('savingProductsSearch')
  ]);
  const result = { updated: new Date().toISOString(), deposit, saving };
  if (!deposit.length && !saving.length) { result.diag = FIN_DIAG.slice(0, 6); return result; } // 빈 결과는 캐시하지 않는다(다음 요청에서 다시 시도)
  FIN_DIAG = [];
  if (env.KR_KV) {
    try { await env.KR_KV.put('fin-savings-latest', JSON.stringify(result), { expirationTtl: 172800 }); } catch (e) {}
  }
  return result;
}

/* 미국주식 시가총액 TOP10 재무비율/주가지표 — Yahoo Finance quoteSummary 연동.
   이 엔드포인트는 (Yahoo가 크럼(crumb) 없는 quoteSummary 요청을 확률적으로 401 Invalid Crumb로
   거부하는 경우가 있어) 실패한 티커는 null로 두고 나머지는 그대로 반환한다 — mapLimit의 재시도(3회)로
   대부분 커버되고, KV 캐시+Cron 프리웜으로 사용자 요청 시점에는 거의 항상 직전 성공값을 보여준다.
   ETF(QLD/USD 등 관심종목)는 회사 재무제표가 없어 전부 빈 값이 오므로, 개별 종목인 시가총액
   TOP10(NVDA/AAPL/GOOGL/MSFT/AMZN/AVGO/META/TSLA/TSM/SPCX)만 대상으로 한다. */
const US_FUND_TICKERS = ['NVDA', 'AAPL', 'GOOGL', 'MSFT', 'AMZN', 'AVGO', 'META', 'TSLA', 'TSM', 'SPCX'];
// 시가총액 11~20위(추가 보기) — 별도 세트로 분리해 기본 10종목 응답 속도에 영향이 없게 한다
const US_FUND_TICKERS2 = ['MU', 'BRK-B', 'AMD', 'LLY', 'JPM', 'WMT', 'V', 'XOM', 'INTC', 'JNJ'];
// 시가총액 21~30위(프론트 TICKGROUPS.cap3 / US_MORE3 와 같은 목록)
const US_FUND_TICKERS3 = ['MA', 'ABBV', 'CSCO', 'BAC', 'AMAT', 'COST', 'CAT', 'CVX', 'UNH', 'LRCX'];

/* 배당 이력(연도별 합계, 5년 성장률·분기 여부) — Yahoo chart API events=div. 실패해도 null */
async function fetchUsDividendHistory(ticker) {
  try {
    const r = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/' + ticker + '?range=7y&interval=3mo&events=div', { headers: { 'User-Agent': UA } });
    if (!r.ok) return null;
    const j = await r.json();
    const ev = j && j.chart && j.chart.result && j.chart.result[0] && j.chart.result[0].events && j.chart.result[0].events.dividends;
    if (!ev) return null;
    const list = Object.keys(ev).map(k => ({ t: ev[k].date, a: ev[k].amount })).sort((x, y) => x.t - y.t);
    if (!list.length) return null;
    const byYear = {};
    list.forEach(d => { const y = new Date(d.t * 1000).getUTCFullYear(); byYear[y] = (byYear[y] || 0) + d.a; });
    const nowY = new Date().getUTCFullYear();
    const years = Object.keys(byYear).map(Number).sort();
    const full = years.filter(y => y < nowY); // 완료된 연도
    let growth5 = null;
    if (full.length >= 6) { const e = byYear[full[full.length - 1]], b = byYear[full[full.length - 6]]; if (b > 0) growth5 = e / b - 1; }
    else if (full.length >= 2) { const e = byYear[full[full.length - 1]], b = byYear[full[0]]; if (b > 0) growth5 = e / b - 1; }
    const lastY = full.length ? full[full.length - 1] : null;
    const cnt = lastY ? list.filter(d => new Date(d.t * 1000).getUTCFullYear() === lastY).length : 0;
    return { growth5, growthYears: full.length >= 6 ? 5 : Math.max(0, full.length - 1), lastYear: lastY, lastAnnual: lastY ? byYear[lastY] : null, freq: cnt >= 11 ? '월' : cnt >= 3 ? '분기' : cnt === 2 ? '반기' : cnt === 1 ? '연' : null, lastAmt: list[list.length - 1].a };
  } catch (e) { return null; }
}

async function fetchUsFundamentalOne(ticker, tries) {
  const baseUrl = 'https://query1.finance.yahoo.com/v10/finance/quoteSummary/' + ticker +
    '?modules=defaultKeyStatistics,financialData,summaryDetail,earningsTrend';
  for (let i = 0; i < (tries || 3); i++) {
    try {
      // quoteSummary는 쿠키+크럼(crumb) 인증이 있어야 401 Invalid Crumb 없이 응답한다
      // (일반 프록시 경로의 크럼 주입 로직을 여기서도 그대로 재사용).
      const auth = await getYahooAuth();
      const headers = { 'User-Agent': UA };
      let url = baseUrl;
      if (auth) {
        url += '&crumb=' + encodeURIComponent(auth.crumb);
        headers['Cookie'] = auth.cookie;
      }
      const r = await fetch(url, { headers });
      if (r.ok) {
        const j = await r.json();
        const res = j && j.quoteSummary && j.quoteSummary.result && j.quoteSummary.result[0];
        if (res) {
          const fd = res.financialData || {};
          const dk = res.defaultKeyStatistics || {};
          const sd = res.summaryDetail || {};
          const raw = v => (v && typeof v === 'object' && 'raw' in v) ? v.raw : (typeof v === 'number' ? v : null);
          return {
            ticker,
            revenueGrowth: raw(fd.revenueGrowth),           // 매출액증가율(YoY)
            earningsGrowth: raw(fd.earningsGrowth),         // 영업이익증가율 근사치(분기 실적 성장률, Yahoo가 영업이익 성장률을 별도 제공하지 않음)
            operatingMargins: raw(fd.operatingMargins),
            trailingEps: raw(dk.trailingEps),
            forwardEps: raw(dk.forwardEps),
            psr: raw(sd.priceToSalesTrailing12Months),
            trailingPE: raw(sd.trailingPE),
            // 투자자 4축·PEG·ROA/ROE·이익수정 용
            price: raw(fd.currentPrice),
            forwardPE: raw(sd.forwardPE) != null ? raw(sd.forwardPE) : raw(dk.forwardPE),
            pegRatio: raw(dk.pegRatio),
            roa: raw(fd.returnOnAssets),
            roe: raw(fd.returnOnEquity),
            profitMargins: raw(fd.profitMargins),
            grossMargins: raw(fd.grossMargins),
            debtToEquity: raw(fd.debtToEquity),      // % 단위(예: 41.0)
            currentRatio: raw(fd.currentRatio),
            freeCashflow: raw(fd.freeCashflow),
            div: {
              yield: raw(sd.dividendYield) != null ? raw(sd.dividendYield) : raw(sd.trailingAnnualDividendYield),
              rate: raw(sd.dividendRate) != null ? raw(sd.dividendRate) : raw(sd.trailingAnnualDividendRate),
              payout: raw(sd.payoutRatio),
              avg5y: raw(sd.fiveYearAvgDividendYield) // % 단위
            },
            trend: (function () {
              const tr = (res.earningsTrend && res.earningsTrend.trend) || [];
              const by = p => tr.find(x => x && x.period === p) || {};
              const y0 = by('0y'), y5 = by('+5y');
              const et = y0.epsTrend || {}, er = y0.epsRevisions || {};
              return {
                growth5y: raw(y5.growth),
                epsNow: raw(et.current), eps30: raw(et['30daysAgo']), eps90: raw(et['90daysAgo']),
                up30: raw(er.upLast30days), down30: raw(er.downLast30days)
              };
            })()
          };
        }
      } else {
        yahooAuth = null; // 401 Invalid Crumb 등 — 캐시된 크럼이 무효화됐을 수 있어 다음 시도에서 새로 받는다
      }
    } catch (e) {}
  }
  return { ticker, revenueGrowth: null, earningsGrowth: null, operatingMargins: null, trailingEps: null, forwardEps: null, psr: null, trailingPE: null };
}

/* 관심종목(ETF) 카드 클릭 시 보여줄 "주요 티커별 가중치·섹터 가중치" — Yahoo quoteSummary의
   topHoldings 모듈(개별종목에는 없고 ETF/펀드에만 있는 모듈). 필드명이 holdings 계열은 버전마다
   holdingsList/holdings 두 가지로 보여 둘 다 시도한다. sectorWeightings는 [{technology:{raw:0.3}},...]
   형태(키가 섹터인 단일 속성 객체 배열)라 그대로는 쓰기 불편해 {key,pct} 배열로 펼쳐서 반환한다. */
async function fetchEtfHoldingsOne(ticker, tries) {
  const baseUrl = 'https://query1.finance.yahoo.com/v10/finance/quoteSummary/' + ticker + '?modules=topHoldings,fundProfile,summaryDetail,defaultKeyStatistics';
  for (let i = 0; i < (tries || 2); i++) {
    try {
      const auth = await getYahooAuth();
      const headers = { 'User-Agent': UA };
      let url = baseUrl;
      if (auth) {
        url += '&crumb=' + encodeURIComponent(auth.crumb);
        headers['Cookie'] = auth.cookie;
      }
      const r = await fetch(url, { headers });
      if (r.ok) {
        const j = await r.json();
        const res = j && j.quoteSummary && j.quoteSummary.result && j.quoteSummary.result[0];
        const th = res && res.topHoldings;
        if (th) {
          const raw = v => (v && typeof v === 'object' && 'raw' in v) ? v.raw : (typeof v === 'number' ? v : null);
          const holdingsRaw = th.holdingsList || th.holdings || [];
          const holdings = holdingsRaw.map(h => ({
            symbol: h.symbol || null,
            name: h.holdingName || h.symbol || '',
            pct: raw(h.holdingPercent)
          })).filter(h => h.pct != null);
          const sectors = [];
          (th.sectorWeightings || []).forEach(obj => {
            Object.keys(obj || {}).forEach(k => {
              const pct = raw(obj[k]);
              if (pct != null) sectors.push({ key: k, pct });
            });
          });
          sectors.sort((a, b) => b.pct - a.pct);
          // 투자자 관점 추가 정보: 총보수·순자산·배당률·설정일·베타·보유종목 밸류에이션
          const fp = res.fundProfile || {}, sd = res.summaryDetail || {}, ks = res.defaultKeyStatistics || {};
          const fee = fp.feesExpensesInvestment || {};
          const eh = th.equityHoldings || {};
          const info = {
            expenseRatio: raw(fee.annualReportExpenseRatio),
            category: fp.categoryName || null,
            family: fp.family || null,
            totalAssets: raw(sd.totalAssets) != null ? raw(sd.totalAssets) : raw(ks.totalAssets),
            yield: raw(sd.yield),
            inception: raw(ks.fundInceptionDate),
            beta3y: raw(ks.beta3Year),
            ytd: raw(ks.ytdReturn),
            avgVolume: raw(sd.averageVolume),
            pe: raw(eh.priceToEarnings),
            pb: raw(eh.priceToBook),
            medianCap: raw(eh.medianMarketCap)
          };
          return { ticker, holdings, sectors, info };
        }
      } else {
        yahooAuth = null;
      }
    } catch (e) {}
  }
  return { ticker, holdings: [], sectors: [] };
}

/* 한국지수 페이지 "투자자 동향" — Npay 증권(stock.naver.com)이 자체 집계해서 내려주는
   지수별 당일 개인/외국인/기관 순매수(억원) 요약값. m.stock.naver.com 모바일 API가
   별도 인증(쿠키/crumb) 없이 공개돼 있어 그대로 중계한다. marketCode는 'KOSPI'|'KOSDAQ'. */
async function fetchKrInvestorTrend(marketCode) {
  const url = 'https://m.stock.naver.com/api/index/' + encodeURIComponent(marketCode) + '/trend';
  const r = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!r.ok) return null;
  const j = await r.json();
  if (!j || !j.bizdate) return null;
  return {
    market: marketCode,
    bizdate: j.bizdate,
    personal: j.personalValue || null,      // 개인 순매수(억원, "+"/"-" 부호 포함 문자열)
    foreign: j.foreignValue || null,        // 외국인 순매수
    institutional: j.institutionalValue || null // 기관 순매수
  };
}

/* 한국지수 페이지 "투자자 동향" 기간별(1주/1개월/3개월) 보기용 — 일별 순매수 이력.
   stock.naver.com/api/domestic/market/trend/daily 는 투자자 유형코드(investorGubun)별 순매수액(원)을
   날짜별로 준다. 코드 매핑은 index/trend(네이버 공식 요약값)와 같은 시점에 대조해 검증했다:
     개인   = 8000
     외국인 = 9000 + 9001(기타외국인)
     기관   = 1000(금융투자)+2000(보험)+3000(투신)+3100(사모)+4000(은행)+5000(기타금융)+6000(연기금)+7000
   (7100=기타법인은 기관에 포함되지 않는다 — 개인+외국인+기관+기타법인 ≈ 0 으로 확인됨) */
async function fetchKrInvestorHistory(marketCode, size) {
  const url = 'https://stock.naver.com/api/domestic/market/trend/daily?tradeType=KRX&marketType=' +
    encodeURIComponent(marketCode) + '&startIdx=0&pageSize=' + (size || 70);
  const r = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!r.ok) return null;
  const j = await r.json();
  const rows = (j && j.content) || [];
  const INST = { '1000': 1, '2000': 1, '3000': 1, '3100': 1, '4000': 1, '5000': 1, '6000': 1, '7000': 1 };
  const eok = v => Math.round((Number(v) || 0) / 1e8); // 원 → 억원
  return rows.slice().reverse().map(row => {
    let personal = 0, foreign = 0, inst = 0;
    (row.netAmounts || []).forEach(n => {
      const g = String(n.investorGubun), v = eok(n.diffValue);
      if (g === '8000') personal += v;
      else if (g === '9000' || g === '9001') foreign += v;
      else if (INST[g]) inst += v;
    });
    return { bizdate: row.bizdate, personal, foreign, institutional: inst };
  });
}

/* 한국지수 페이지 "증시자금동향" — 고객예탁금/신용잔고/주식형·혼합형·채권형 펀드 설정액을
   날짜별로 내려주는 stock.naver.com(Npay 증권 PC)의 공개 API. 같은 origin이라 별도 인증이
   필요 없다. size는 최근 영업일 수(스파크라인용으로 40일 안팎이면 충분). */
async function fetchKrMarketDeposit(size) {
  const url = 'https://stock.naver.com/api/domestic/market/trendDeposit?startIdx=0&pageSize=' + (size || 40);
  const r = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!r.ok) return null;
  const j = await r.json();
  const rows = (j && j.content) || [];
  // 최신순으로 내려오므로 차트가 시간순(과거→현재)이 되도록 뒤집어서 반환한다.
  return rows.slice().reverse().map(row => ({
    bizdate: row.bizdate,
    customerDeposit: Number(row.customerDeposit) || null,           // 고객예탁금(억원)
    customerDepositDiff: row.customerDepositDiff != null ? Number(row.customerDepositDiff) : null,
    creditLoan: Number(row.creditLoan) || null,                     // 신용잔고(억원)
    creditLoanDiff: row.creditLoanDiff != null ? Number(row.creditLoanDiff) : null,
    stockFund: Number(row.beneficiaryCertificateStock) || null,     // 주식형펀드(억원)
    stockFundDiff: row.beneficiaryCertificateStockDiff != null ? Number(row.beneficiaryCertificateStockDiff) : null,
    mixedFund: Number(row.beneficiaryCertificateMixing) || null,    // 혼합형펀드(억원)
    mixedFundDiff: row.beneficiaryCertificateMixingDiff != null ? Number(row.beneficiaryCertificateMixingDiff) : null,
    bondFund: Number(row.beneficiaryCertificateBond) || null,       // 채권형펀드(억원)
    bondFundDiff: row.beneficiaryCertificateBondDiff != null ? Number(row.beneficiaryCertificateBondDiff) : null
  }));
}

async function runUsFundamentalsJob(env, set) {
  const list = set === 3 ? US_FUND_TICKERS3 : set === 2 ? US_FUND_TICKERS2 : US_FUND_TICKERS;
  const kvKey = set === 3 ? 'us-fundamentals-s3' : set === 2 ? 'us-fundamentals-x3' : 'us-fundamentals-v3';
  // [버그 대응] "재무" 클릭 시 "불러오는 중"에서 멈추는 문제 — Cron으로 미리 캐시가 채워져
  // 있지 않은 최초 요청(cold)에서는 이 함수가 Yahoo 쿠키/crumb 발급(왕복 2회) + 종목 10개
  // quoteSummary 요청(종목당 최대 3회 재시도)을 모두 마쳐야 응답하는데, 동시성 4·재시도 3회면
  // 최악의 경우 Cloudflare Workers 무료 플랜의 서브리퀘스트 시간 제한에 걸릴 만큼 오래 걸릴 수
  // 있었다. 동시성을 올리고 재시도 횟수를 줄여 총 소요 시간을 단축한다.
  const rows = await mapLimit(list, 6, async t => {
    const o = await fetchUsFundamentalOne(t, 2);
    if (o && o.div && (o.div.rate || o.div.yield)) { o.divHist = await fetchUsDividendHistory(t); }
    return o;
  });
  const result = { updated: new Date().toISOString(), items: rows };
  if (env.KR_KV) {
    try { await env.KR_KV.put(kvKey, JSON.stringify(result), { expirationTtl: 21600 }); } catch (e) {}
  }
  return result;
}

/* 미국지수 페이지 "유니콘 기업" 섹션 — 회사별 최근 뉴스 3건을 Google News RSS(인증 불필요, XML)로
   가져온다. 카드가 4개뿐인 정적 섹션이라 회사별 검색어를 고정 매핑으로 둔다. */
const UNICORN_NEWS_QUERIES = {
  anthropic: 'Anthropic AI',
  openai: 'OpenAI',
  databricks: 'Databricks',
  xai: 'xAI Grok'
};

/* Bing News RSS 파서 — 링크가 apiclick 리다이렉트라 url= 파라미터에서 실제 기사 주소를 꺼내고, 14일보다 오래된 기사는 제외 */
function parseBingNewsRss(xml, limit) {
  const items = [];
  const dec = t => String(t || '').replace(/<!\[CDATA\[|\]\]>/g, '').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').trim();
  const blocks = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
  for (const b of blocks.slice(0, limit || 20)) {
    const t = b.match(/<title>([\s\S]*?)<\/title>/), l = b.match(/<link>([\s\S]*?)<\/link>/), p = b.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
    if (!t || !l) continue;
    let url = dec(l[1]);
    const um = url.match(/[?&]url=([^&]+)/);
    if (um) { try { url = decodeURIComponent(um[1]); } catch (e) {} }
    const pub = p ? p[1].trim() : null;
    if (pub && Date.parse(pub) < Date.now() - 14 * 86400000) continue;
    items.push({ title: dec(t[1]), url, pubDate: pub, source: '' });
  }
  return items;
}
function parseGoogleNewsRss(xml, limit) {
  const items = [];
  const blocks = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
  for (const b of blocks.slice(0, limit || 3)) {
    const titleM = b.match(/<title>([\s\S]*?)<\/title>/);
    const linkM = b.match(/<link>([\s\S]*?)<\/link>/);
    const pubM = b.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
    const srcM = b.match(/<source[^>]*>([\s\S]*?)<\/source>/);
    if (!titleM || !linkM) continue;
    const rawTitle = titleM[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim();
    // "제목 - 출처" 형식이면 출처를 분리(소스 태그가 비어 있을 때 대비)
    let title = rawTitle, source = srcM ? srcM[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim() : '';
    if (!source) {
      const dash = rawTitle.lastIndexOf(' - ');
      if (dash > 0) { title = rawTitle.slice(0, dash); source = rawTitle.slice(dash + 3); }
    }
    items.push({
      title: title.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"'),
      url: linkM[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim(),
      source,
      pubDate: pubM ? pubM[1].trim() : null
    });
  }
  return items;
}

/* 금융상품 페이지 — 증권·은행·카드 이벤트. 각 사 이벤트 페이지는 대부분 JS 렌더링이라 직접 수집이
   어려워, Google News RSS(최근 14일, 한국어)에서 "이벤트" 기사만 골라 회사명·마감일·강도를 추정한다. */
const FIN_EVENT_QUERIES = {
  '증권': ['증권사 신규고객 이벤트', '해외주식 수수료 이벤트 증권', '증권 퇴직연금 ISA 이벤트'],
  '은행': ['은행 예적금 이벤트', '토스뱅크 카카오뱅크 케이뱅크 이벤트', '은행 신규고객 혜택 이벤트'],
  '카드': ['신용카드 캐시백 이벤트', '카드사 신규 발급 이벤트', '카드 프로모션 혜택 이벤트']
};
const FIN_COMPANIES = {
  '증권': ['NH투자증권','미래에셋증권','삼성증권','KB증권','한국투자증권','키움증권','신한투자증권','하나증권','대신증권','토스증권','카카오페이증권','유안타증권','메리츠증권','SK증권','한화투자증권','유진투자증권','현대차증권','교보증권','IBK투자증권','DB금융투자','LS증권','다올투자증권','상상인증권','신영증권'],
  '은행': ['토스뱅크','카카오뱅크','케이뱅크','KB국민은행','국민은행','신한은행','하나은행','우리은행','NH농협은행','농협은행','IBK기업은행','기업은행','SC제일은행','iM뱅크','부산은행','경남은행','광주은행','전북은행','제주은행','수협은행','SBI저축은행','OK저축은행','웰컴저축은행'],
  '카드': ['신한카드','삼성카드','KB국민카드','국민카드','현대카드','롯데카드','우리카드','하나카드','BC카드','NH농협카드','농협카드','카카오뱅크카드','토스카드']
};
function finEventDeadline(title, pubTs) {
  const now = new Date(pubTs || Date.now());
  let m = title.match(/~\s*(\d{1,2})[./월]\s*(\d{1,2})\s*일?/) || title.match(/(\d{1,2})월\s*(\d{1,2})일\s*까지/) || title.match(/(\d{1,2})\/(\d{1,2})\s*까지/);
  if (!m) return null;
  let y = now.getFullYear(), mo = +m[1], d = +m[2];
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  let t = new Date(y, mo - 1, d, 23, 59).getTime();
  if (t < now.getTime() - 86400000 * 30) t = new Date(y + 1, mo - 1, d, 23, 59).getTime();
  return t;
}
function finEventStar(title) {
  let sc = 1;
  if (/최대|전원|무제한|한정|파격|역대|두배|2배/.test(title)) sc++;
  if (/\d[\d,]*\s*(만\s*원|억|%|만원|천원|원)/.test(title)) sc++;
  return Math.min(3, sc);
}
async function runFinEventsJob(env) {
  const out = { '증권': [], '은행': [], '카드': [] };
  const failed = [];
  for (const cat of Object.keys(FIN_EVENT_QUERIES)) {
    const seen = new Set();
    const rows = await mapLimit(FIN_EVENT_QUERIES[cat], 3, async q => {
      try {
        /* 1순위 Google News RSS → Cloudflare IP가 막히거나(429/403) 빈 결과면 2순위 Bing News RSS로 대체 */
        let list = [];
        try {
          const r = await fetch('https://news.google.com/rss/search?q=' + encodeURIComponent(q + ' when:14d') + '&hl=ko&gl=KR&ceid=KR:ko', { headers: { 'User-Agent': UA, 'Accept': 'application/rss+xml,text/xml,*/*', 'Accept-Language': 'ko-KR,ko;q=0.9' } });
          if (r.ok) list = parseGoogleNewsRss(await r.text(), 25);
          else failed.push(q + ' [google ' + r.status + ']');
        } catch (e) { failed.push(q + ' [google ' + String(e).slice(0, 40) + ']'); }
        if (!list.length) {
          try {
            const r2 = await fetch('https://www.bing.com/news/search?q=' + encodeURIComponent(q) + '&format=rss&setlang=ko&cc=KR', { headers: { 'User-Agent': UA, 'Accept-Language': 'ko-KR,ko;q=0.9' } });
            if (r2.ok) list = parseBingNewsRss(await r2.text(), 30);
            else failed.push(q + ' [bing ' + r2.status + ']');
          } catch (e) { failed.push(q + ' [bing ' + String(e).slice(0, 40) + ']'); }
        }
        return list;
      } catch (e) { failed.push(q); return []; }
    });
    rows.forEach(list => (list || []).forEach(n => {
      const t = (n.title || '').replace(/\s+-\s+[^-]+$/, '').trim();
      if (!/이벤트|혜택|프로모션|캐시백|증정/.test(t)) return;
      const key = t.slice(0, 22);
      if (seen.has(key)) return; seen.add(key);
      const comp = FIN_COMPANIES[cat].find(c => t.indexOf(c) >= 0);
      if (!comp) return; // 회사명이 제목에 없는 기사(일반 해설 기사)는 제외
      const pub = n.pubDate ? Date.parse(n.pubDate) : null;
      const dl = finEventDeadline(t, pub);
      if (dl && dl < Date.now() - 86400000) return; // 이미 마감
      out[cat].push({ source: comp, title: t, url: n.url, deadlineTs: dl, star: finEventStar(t), pubTs: pub });
    }));
    out[cat].sort((a, b) => ((a.deadlineTs || 9e15) - (b.deadlineTs || 9e15)) || ((b.pubTs || 0) - (a.pubTs || 0)));
    out[cat] = out[cat].slice(0, 15);
  }
  const result = { updatedAt: new Date().toISOString(), byCat: out, failedSources: failed, via: 'news(google→bing)' };
  const total = out['증권'].length + out['은행'].length + out['카드'].length;
  if (env.KR_KV && total > 0) { try { await env.KR_KV.put('fin-events-v1', JSON.stringify(result), { expirationTtl: 172800 }); } catch (e) {} } // 빈 결과는 캐시하지 않는다(12시간 동안 '없음'으로 굳는 문제 방지)
  return result;
}

/* 카드고릴라 인기 카드 차트 Top10 — api.card-gorilla.com:8080 (공개 API, 8080 포트로 리다이렉트됨) */
async function runCardTopJob(env, debug) {
  const pad = n => String(n).padStart(2, '0');
  let found = null, usedDate = null, rawSample = null; const tried = []; const seenT = new Set();
  const note = m => { if (!seenT.has(m)) { seenT.add(m); tried.push(m); } };
  const H = { 'User-Agent': UA, 'Accept': 'application/json, text/plain, */*', 'Accept-Language': 'ko-KR,ko;q=0.9', 'Origin': 'https://www.card-gorilla.com', 'Referer': 'https://www.card-gorilla.com/' };
  /* [진단 반영] https :8080은 200이지만 본문이 비어 있었다 = 주소/파라미터가 맞지 않는 경우.
     카드고릴라 차트 API는 기간(term)과 기준일(date) 파라미터를 받는 형태가 있어 함께 시도한다. */
  const base = 'https://api.card-gorilla.com:8080/v1/charts/';
  for (let back = 0; back <= 9 && !found; back++) {
    const d = new Date(Date.now() + 9 * 3600000 - back * 86400000);
    const ds = d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
    for (const u of [
      base + 'ranking?term=weekly&card_gb=CRD&limit=10&chart=top100', // [2026-10-08 확인] 카드고릴라 웹페이지가 실제로 호출하는 주소
      base + 'ranking?term=weekly&card_gb=CRD&limit=10&chart=top100&date=' + ds,
      base + 'top100?term=weekly&date=' + ds,
      base + 'top10?term=weekly&date=' + ds,
      base + 'top10?date=' + ds,
      base + 'top100?term=daily&date=' + ds
    ]) {
      try {
        const r = await fetch(u, { headers: H });
        const txt = await r.text();
        const key = u.replace(/\?.*/, '') + (u.match(/term=(\w+)/) ? '?term=' + u.match(/term=(\w+)/)[1] : '');
        if (!r.ok) { note(key + ' → HTTP ' + r.status + (txt ? ' ' + txt.slice(0, 80) : '')); continue; }
        if (!txt) { note(key + ' → 빈 본문(200)'); continue; }
        let j; try { j = JSON.parse(txt); } catch (e) { note(key + ' → JSON아님: ' + txt.slice(0, 80)); continue; }
        let arr = Array.isArray(j) ? j : (j && (j.data || j.list || j.result || j.items)) || null;
        if (arr && !Array.isArray(arr)) arr = arr.data || arr.list || arr.items || null;
        if (Array.isArray(arr) && arr.length) { found = arr; usedDate = ds; rawSample = arr[0]; break; }
        note(key + ' → 목록 없음: ' + txt.slice(0, 80));
      } catch (e) { note(u.replace(/\?.*/, '') + ' → ' + String(e).slice(0, 60)); }
    }
  }
  if (!found) return { updated: new Date().toISOString(), items: [], tried: debug ? tried : undefined };
  const items = found.slice(0, 10).map((it, i) => {
    const c = it.card || it;
    return {
      rank: it.rank || it.ranking || i + 1,
      name: c.name || c.card_name || c.title || it.name || '',
      corp: (c.corp && (c.corp.name || c.corp.corp_name)) || c.corp_name || c.company || it.corp_name || '',
      annualFee: c.annual_fee_basic || c.annual_fee || null,
      benefit: (c.key_benefit && (Array.isArray(c.key_benefit) ? c.key_benefit.map(k => k.title || k.name || k).join(' · ') : c.key_benefit)) || c.benefit || '',
      img: (c.card_img && (c.card_img.url || c.card_img)) || c.image || null,
      idx: c.idx || it.idx || c.card_idx || null
    };
  }).filter(x => x.name);
  const result = { updated: new Date().toISOString(), date: usedDate, items };
  if (debug) result.raw = rawSample;
  if (env.KR_KV && items.length) { try { await env.KR_KV.put('card-top10-v1', JSON.stringify(result), { expirationTtl: 172800 }); } catch (e) {} }
  return result;
}

/* 에잇퍼센트 오픈예정 상품 — core-api.8percent.kr/api/deals/?category=… (비로그인 공개 API).
   state==='P' = 오픈 전(예약/대기). 카테고리별로 모아 오픈 시각순으로 정렬해 돌려준다. */
async function runP2pEightJob(env) {
  const cats = [['real-estate-special', '부동산담보', 'real-estate-special'], ['stock-purchase', '증권계좌담보', 'stock-purchase'], ['individual', '개인신용', 'individual']];
  const out = [];
  const errs = [];
  await Promise.all(cats.map(async ([cat, label, path]) => {
    try {
      const r = await fetch('https://core-api.8percent.kr/api/deals/?category=' + cat, { headers: { 'User-Agent': UA, 'Accept': 'application/json', 'Origin': 'https://8percent.kr', 'Referer': 'https://8percent.kr/' } });
      if (!r.ok) { errs.push(cat + ' HTTP ' + r.status); return; }
      const arr = await r.json();
      (Array.isArray(arr) ? arr : []).forEach(d => {
        if (d.state !== 'P') return;
        out.push({
          id: d.id, category: label,
          title: d.title, sub: [d.cardMainTitle, d.cardSubTitle].filter(Boolean).join(' '),
          amount: d.amount, months: d.length, method: d.method,
          rate: d.earningRate != null ? Number(d.earningRate) : null,
          grade: d.eightCreditGrade || d.grade || null, ltv: d.ltv != null ? d.ltv : null,
          openAt: d.startDatetime || null, reservationStart: d.reservationStartDatetime || null,
          reservationClose: d.reservationCloseDatetime || null, reservationOpen: !!d.isReservationOpen,
          progress: d.progress != null ? d.progress : null,
          url: 'https://8percent.kr/deals/' + path + '/' + d.id + '/'
        });
      });
    } catch (e) { errs.push(cat + ' ' + e); }
  }));
  /* 상세(차주 KCB 신용등급·점수·연체 여부) — S급 추가 평가용. 실패해도 목록은 그대로 반환 */
  await Promise.all(out.map(async it => {
    try {
      const r = await fetch('https://core-api.8percent.kr/api/deals/' + it.id + '/', { headers: { 'User-Agent': UA, 'Accept': 'application/json', 'Origin': 'https://8percent.kr', 'Referer': 'https://8percent.kr/' } });
      if (!r.ok) return;
      const dj = await r.json();
      const a = dj.dealApplication || {};
      it.kcbGrade = a.kcbGrade != null ? Number(a.kcbGrade) : null;
      it.kcbScore = a.kcbScore != null ? Number(a.kcbScore) : null;
      it.clean = !(a.overdueHistory || a.hasDefaultRecord || a.hasRemainingOverdue || a.hasDelinquentTax || dj.hasOverdueLast1Year);
      it.overdueNote = a.hasRemainingOverdue ? '현재 연체 중' : (a.overdueHistory || dj.hasOverdueLast1Year) ? '연체 이력 있음' : (a.hasDefaultRecord ? '채무불이행 기록' : (a.hasDelinquentTax ? '세금 체납' : ''));
      const by = a.userBorn ? Number(String(a.userBorn).slice(0, 4)) : null;
      it.age = by ? (new Date().getFullYear() - by) : null;
      it.income = a.borrowerMonthIncome != null ? Number(a.borrowerMonthIncome) : null;
      it.reason = dj.reason || null;
      const m = a.mortgage || {};
      if (m.appraisedValue) {
        it.appraised = Number(m.appraisedValue);
        it.priorAmount = Number(m.priorityAmount || 0);
        it.priorLoan = Number(m.priorityLoanAmount || 0);
        it.address = m.address || null; it.propType = m.propertyType || null; it.usage = m.usage || null;
      }
      const sp = a.stockPurchase || {};
      if (sp.accountValuationAmount) { it.acctValue = Number(sp.accountValuationAmount); it.broker = sp.securitiesCompany ? sp.securitiesCompany.name : null; it.maintain = sp.accountManagementRule && sp.accountManagementRule.diversifiedCollateralMaintenanceRatio ? Number(sp.accountManagementRule.diversifiedCollateralMaintenanceRatio) : null; }
    } catch (e) {}
  }));
  out.sort((a, b) => String(a.openAt || '').localeCompare(String(b.openAt || '')) || (b.rate || 0) - (a.rate || 0));
  const result = { updated: new Date().toISOString(), items: out, errors: errs };
  if (env.KR_KV && out.length) { try { await env.KR_KV.put('p2p-eight-v3', JSON.stringify(result), { expirationTtl: 600 }); } catch (e) {} }
  return result;
}

async function fetchUnicornNewsOne(key, query) {
  try {
    const url = 'https://news.google.com/rss/search?q=' + encodeURIComponent(query) +
      '&hl=en-US&gl=US&ceid=US:en';
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });
    if (!r.ok) return { key, items: [] };
    const xml = await r.text();
    return { key, items: parseGoogleNewsRss(xml, 3) };
  } catch (e) {
    return { key, items: [] };
  }
}

async function runUnicornNewsJob(env) {
  const keys = Object.keys(UNICORN_NEWS_QUERIES);
  const rows = await mapLimit(keys, 4, k => fetchUnicornNewsOne(k, UNICORN_NEWS_QUERIES[k]));
  const byKey = {};
  rows.forEach(r => { byKey[r.key] = r.items; });
  const result = { updated: new Date().toISOString(), news: byKey };
  if (env.KR_KV) {
    try { await env.KR_KV.put('unicorn-news-latest', JSON.stringify(result), { expirationTtl: 21600 }); } catch (e) {}
  }
  return result;
}

/* 공모주 페이지 — 38.co.kr(www.38.co.kr) IPO 데이터 연동.
   38.co.kr은 robots.txt가 전체 허용(Disallow: 없음)이고, /html/ipo/ 메인페이지 자체에
   7개 탭(심사청구·심사승인·수요예측·공모청약·신규상장·CB·BW)의 데이터가 숨겨진 <div>로
   전부 서버사이드 렌더링돼 있어(AJAX 불필요) GET 한 번으로 전체 목록을 받을 수 있다.
   종목별 상세(/html/fund/?o=v&no=NNNN)에서 기관경쟁률·의무보유확약·확정공모가 등을 추가로 가져온다.
   페이지가 EUC-KR로 서비스되므로(메타태그도 정확함, ipostock과 달리) TextDecoder로 직접 디코딩. */
const B38_BASE = 'http://www.38.co.kr';

function ipoCellText(html) {
  return html.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').trim().replace(/\s+/g, ' ');
}

/* [버그 대응] 38.co.kr도 Cloudflare 뒤에 있는 것으로 보이며, 우리 Worker(역시 Cloudflare)가
   호출할 때 가끔 522(Origin이 제때 응답 안 함) 를 반환한다 — 대개 일시적이라 짧게 재시도하면
   대부분 통과한다. 재시도해도 계속 실패하면 그대로 null을 반환(호출부가 이미 null 처리함). */
async function fetchEucKr(url, tries) {
  for (let i = 0; i < (tries || 3); i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });
      if (r.ok) {
        const buf = await r.arrayBuffer();
        try { return new TextDecoder('euc-kr').decode(buf); }
        catch (e) { return new TextDecoder('utf-8').decode(buf); }
      }
    } catch (e) {}
    if (i < (tries || 3) - 1) await new Promise(res => setTimeout(res, 600 * (i + 1)));
  }
  return null;
}

/* 메인페이지 안의 <div id='ipopanlayer_N'>...</div> 블록 하나를 찾아 각 <tr>의 <td> 텍스트를
   배열로 뽑아낸다. 종목 링크의 no= 파라미터도 함께 추출(상세페이지 조회용 키). */
function parse38Panel(html, panelId, nextPanelId) {
  const startMarker = "id='ipopanlayer_" + panelId + "'";
  const start = html.indexOf(startMarker);
  if (start < 0) return [];
  let end = html.indexOf("id='ipopanlayer_" + nextPanelId + "'", start);
  if (end < 0) end = start + 20000;
  const block = html.slice(start, end);
  const rows = block.match(/<tr>[\s\S]*?<\/tr>/g) || [];
  const out = [];
  for (const r of rows) {
    const tds = r.match(/<td[^>]*>[\s\S]*?<\/td>/g);
    if (!tds || tds.length < 2) continue;
    const noM = r.match(/no=(\d+)/);
    out.push({ no: noM ? noM[1] : null, cells: tds.map(ipoCellText) });
  }
  return out;
}

/* 상세페이지는 "<td>라벨</td><td>값</td>" 형태의 표라, 라벨 텍스트로 값 셀을 찾는다.
   라벨이 <font>로 감싸져 있거나 &nbsp;가 붙는 두 가지 마크업 변형을 모두 흡수한다.
   [버그 수정] "신규상장일" 라벨은 청약 진행 단계에서는 38.co.kr이 "신규상장일(예정)"처럼
   뒤에 괄호를 붙여 표시하는데, 이전 정규식은 정확히 "신규상장일"만 매칭해 청약이 끝났어도
   실제 상장일이 표시될 때까지(신규상장 단계로 바뀔 때까지) 계속 "미정"으로만 보였다.
   라벨 뒤에 "(예정)" 등 괄호가 붙어도 값을 집어올 수 있도록 선택적으로 허용한다. */
function b38LabelValue(html, label) {
  const esc = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp('<td[^>]*>\\s*(?:<font[^>]*>)?\\s*' + esc + '\\s*(?:\\([^)]{0,10}\\))?\\s*(?:</font>)?\\s*(?:&nbsp;)?\\s*</td>\\s*<td[^>]*>([\\s\\S]*?)</td>');
  const m = html.match(re);
  return m ? ipoCellText(m[1]) : null;
}
/* 후보 라벨을 순서대로 시도해 처음 값이 있는 걸 쓴다 — 같은 항목이라도 상장 단계에 따라
   38.co.kr이 다른 문구("신규상장일" ↔ "상장예정일" 등)를 쓸 수 있어 하나만 찾는 것보다 안전하다. */
function b38LabelValueAny(html, labels) {
  for (const l of labels) {
    const v = b38LabelValue(html, l);
    if (v && v !== '-' && !/^\s*$/.test(v)) return v;
  }
  return null;
}

/* 상세페이지의 "6.동종업체와의 재무정보 비교" 섹션(증권신고서에서 그대로 옮겨붙인 표)을 파싱.
   회사명(동사)과 이미 상장된 동종업체(피어) 몇 곳의 재무제표 핵심 항목을 나란히 비교해서
   보여주는 표라, 태그를 걷어내 파이프(|)로 토큰화한 뒤 "구 분" 다음에 오는 회사명 개수(N)를
   알아내고, 이후 (라벨+N개 숫자) 묶음을 값이 숫자로 안 읽힐 때까지 순서대로 읽는다.
   모든 신규상장 종목이 이 섹션을 갖고 있는 건 아니라(증권신고서 없이 상장하는 코넥스 이전상장
   등) 못 찾으면 null을 반환한다. */
function parseIpoPeerComparison(html) {
  const startMarker = '동종업체와의 재무정보 비교';
  const start = html.indexOf(startMarker);
  if (start < 0) return null;
  const endMarker = 'IPO 공모주 정보';
  let end = html.indexOf(endMarker, start);
  if (end < 0) end = start + 20000;
  const seg = html.slice(start, end);
  const text = seg.replace(/<[^>]+>/g, '|').replace(/&nbsp;/g, ' ');
  const tokens = text.split('|').map(s => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
  // 단위: "(단위 : 백만원)" · "(단위: 천원)" · "(단위 : 원)"
  let unit = null;
  for (const t of tokens) { const um = t.match(/단위\s*:\s*(백만원|천원|원|억원)/); if (um) { unit = um[1]; break; } }
  const numRe = /^-?[\d,]+(\.\d+)?$/;
  const isNum = v => numRe.test(v) || v === '-' || v === 'N/A';
  const labelRe = /^(\[?(유동|비유동)?자산\]?|자산총계|\[?(유동|비유동)부채\]?|부채총계|\[?자본금\]?|자본총계|매출액|영업이익|당기순이익|[\[유동비]*자산)/;
  const giIdx = tokens.findIndex(t => t.replace(/\s+/g, '') === '구분');
  if (giIdx < 0) return null;
  // 첫 데이터 행(라벨) 위치 — "회계기준"이 있으면 그 다음 값 N개를 건너뛴 뒤, 없으면 첫 라벨부터
  let firstLabel = -1;
  for (let i = giIdx + 1; i < tokens.length; i++) { if (labelRe.test(tokens[i]) && i + 1 < tokens.length && isNum(tokens[i + 1])) { firstLabel = i; break; } }
  if (firstLabel < 0) return null;
  let n = 0;
  while (firstLabel + 1 + n < tokens.length && isNum(tokens[firstLabel + 1 + n])) n++;
  if (n < 2) return null;
  // 헤더 토큰(회사명) 수집: '구분' ~ ('회계기준' 또는 첫 라벨) 사이, 제목/단위 줄은 제외
  let hdrEnd = tokens.findIndex((t, idx) => idx > giIdx && t === '회계기준');
  const basisIdx = hdrEnd;
  if (hdrEnd < 0 || hdrEnd > firstLabel) hdrEnd = firstLabel;
  let hdr = tokens.slice(giIdx + 1, hdrEnd);
  // "(케이앤에스아이앤씨)"처럼 괄호만 있는 토큰은 앞선 회사명 보조 표기라 첫 회사에 붙인다
  const paren = hdr.filter(t => /^\(.*\)$/.test(t));
  hdr = hdr.filter(t => !/^\(.*\)$/.test(t));
  let companies;
  if (hdr.length === n) companies = hdr.slice();
  else {
    companies = []; for (let k = 0; k < n; k++) companies.push(k === 0 ? '동사' : '비교기업' + k);
  }
  if (companies.length && paren.length && hdr.length === n) companies[0] = companies[0] + paren[0];
  if (companies[0] === '발행회사') companies[0] = '동사';
  if (companies[0] === '동사' && paren.length && hdr.length !== n) companies[0] = '동사 ' + paren[0];
  let i = firstLabel;
  let basis = null;
  if (basisIdx >= 0 && basisIdx < firstLabel) basis = tokens.slice(basisIdx + 1, basisIdx + 1 + n);
  const rows = [];
  while (i + n < tokens.length) {
    const label = tokens[i];
    const vals = tokens.slice(i + 1, i + 1 + n);
    if (!vals.every(isNum)) break;
    rows.push({ label, values: vals.map(v => (v === '-' || v === 'N/A') ? null : parseFloat(v.replace(/,/g, ''))) });
    i += 1 + n;
    if (rows.length >= 24) break;
  }
  if (!rows.length) return null;
  return { companies, basis: basis || [], unit: unit, rows }; // rows[k].values[0]은 항상 "동사"(공모기업 본인)
}

/* 상세페이지 "4.공모후 유통가능 물량" 표의 "합계" 행: 공모전 주식수·지분율 | 공모후 | 매각제한 | 유통가능(주식수·지분율).
   마지막 지분율이 곧 상장 직후 유통가능 비율이다(예: 멜콘 34.57%). 외부 사이트 없이 38.co.kr만으로 계산되므로 가장 안정적이다. */
function b38FloatRatio(html) {
  const start = html.indexOf('공모후 유통가능 물량');
  if (start < 0) return null;
  const seg = html.slice(start, start + 80000);
  const text = seg.replace(/<[^>]+>/g, '|').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').replace(/\|[\s|]*/g, '|');
  const m = text.match(/\|\s*합\s*계\s*\|\s*([\d,]+)\s*\|\s*[\d.]+%\s*\|\s*([\d,]+)\s*\|\s*[\d.]+%\s*\|\s*[\d,\-]+\s*\|\s*[\d.\-]+%?\s*\|\s*([\d,]+)\s*\|\s*([\d.]+)%/);
  if (!m) return null;
  const v = parseFloat(m[4]);
  return isFinite(v) ? v : null;
}

/* 상세페이지 "5.요약재무제표"에서 매출액·영업이익·당기순이익을 기간별로 뽑는다(DART 사업보고서가 없는 신규 종목용 대체 자료).
   단위(원/천원/백만원)는 표 위 "(단위 : …)"에서 읽어 원 단위로 환산해 돌려준다. */
function parseIpoSummaryFin(html) {
  const start = html.indexOf('5.요약재무제표');
  if (start < 0) return null;
  let end = html.indexOf('6.동종업체', start);
  if (end < 0) end = start + 30000;
  const text = html.slice(start, end).replace(/<[^>]+>/g, '|').replace(/&nbsp;/g, ' ');
  const tokens = text.split('|').map(s => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
  let mult = null;
  for (const t of tokens) { const m = t.match(/단위\s*:\s*(백만원|천원|원|억원)/); if (m) { mult = { '원': 1, '천원': 1e3, '백만원': 1e6, '억원': 1e8 }[m[1]]; break; } }
  const numRe = /^\(?-?[\d,]+(\.\d+)?\)?$/;
  const isNum = v => numRe.test(v) || v === '-';
  const toNum = v => { if (v === '-') return null; const neg = /^\(/.test(v) || /^-/.test(v); const n = parseFloat(v.replace(/[^\d.]/g, '')); return isFinite(n) ? (neg ? -n : n) : null; };
  // 열 개수 n: 첫 "[유동자산]" 행의 숫자 개수
  let n = 0;
  for (let i = 0; i < tokens.length; i++) {
    if (/유동자산/.test(tokens[i]) && isNum(tokens[i + 1] || '')) { while (isNum(tokens[i + 1 + n] || '')) n++; break; }
  }
  if (n < 2) return null;
  if (mult == null) { // 단위 문구가 없는 표는 첫 [유동자산] 값의 크기로 추정(≥10억=원, ≥100만=천원, 그 외 백만원)
    const ai = tokens.findIndex(t => /유동자산/.test(t));
    const av = Math.abs(toNum(tokens[ai + 1]) || 0);
    mult = av >= 1e9 ? 1 : av >= 1e6 ? 1e3 : 1e6;
  }
  // 기간 라벨: '과목/구분' 뒤 헤더에서 연도(4자리) 포함 토큰을 앞에서 n개
  const gi = tokens.findIndex(t => t === '과목' || t.replace(/\s+/g, '') === '구분');
  const labels = [];
  for (let i = gi + 1; i < tokens.length && labels.length < n; i++) {
    const y = tokens[i].match(/(\d{4})\s*년?\s*(반기|[0-9]+월말|[0-9]분기)?/);
    if (y && !/^\(제/.test(tokens[i])) labels.push(y[2] ? y[1] + ' ' + y[2] : y[1]);
    if (/회계/.test(tokens[i])) break;
  }
  if (labels.length !== n) return null;
  const grab = re => {
    for (let i = 0; i < tokens.length; i++) {
      if (re.test(tokens[i].replace(/\s/g, '')) && !/지배|비지배|증가율|률/.test(tokens[i]) && isNum(tokens[i + 1] || '')) {
        const vals = []; for (let k = 0; k < n; k++) { const t = tokens[i + 1 + k]; if (!isNum(t || '')) return null; vals.push(toNum(t)); }
        return vals;
      }
    }
    return null;
  };
  const rev = grab(/^(\[?매출액\]?|영업수익|수익\(매출액\)|이자수익)/);
  const op = grab(/^(영업이익|영업손익|영업이익\(손실\)|영업손실)/);
  const np = grab(/^(연결|별도)?(당기|반기|분기|기)?순(이익|손익|손실)(\(손실\))?$|^당기순이익|^\(당\)기순이익/);
  if (!rev && !op && !np) return null;
  const periods = labels.map((l, k) => ({
    label: l,
    revenue: rev && rev[k] != null ? rev[k] * mult : null,
    opProfit: op && op[k] != null ? op[k] * mult : null,
    netProfit: np && np[k] != null ? np[k] * mult : null
  }));
  return { periods, unit: mult };
}

async function fetch38Detail(no) {
  // 200으로 응답해도 차단/오류 안내 페이지가 올 수 있어(상세표가 없음) '시장구분' 라벨이 보일 때까지 재시도한다.
  let html = null;
  for (let t = 0; t < 4; t++) {
    if (t > 0) await new Promise(res => setTimeout(res, 700 * t));
    const base = (t % 2 === 0) ? B38_BASE : 'https://www.38.co.kr'; // 짝수 시도는 http, 홀수 시도는 https로 번갈아 시도
    const h = await fetchEucKr(base + '/html/fund/?o=v&no=' + no, 2);
    if (h && h.indexOf('시장구분') >= 0) { html = h; break; }
  }
  if (!html) return null;
  return {
    instRatioTxt: b38LabelValue(html, '기관경쟁률'),
    lockupTxt: b38LabelValue(html, '의무보유확약'),
    offerBandTxt: b38LabelValue(html, '희망공모가액'),
    offerFinalTxt: b38LabelValue(html, '확정공모가'),
    subRatioTxt: b38LabelValue(html, '청약경쟁률'),
    underwriter: b38LabelValue(html, '주간사'),
    totalSharesTxt: b38LabelValue(html, '총공모주식수'),
    parValueTxt: b38LabelValue(html, '액면가'),
    listDateTxt: b38LabelValueAny(html, ['신규상장일', '상장예정일', '상장일']),
    market: b38LabelValue(html, '시장구분') || ((html.match(/시장구분[\s\S]{0,200}?(코스닥|코스피|유가증권|코넥스|거래소)/) || [])[1] || null),
    floatRatio38: b38FloatRatio(html),
    stockCodeTxt: (function(){ var v=b38LabelValue(html,'종목코드'); var m=v&&String(v).match(/\b([0-9A-Z]{6})\b/); return m?m[1]:null; })(),
    predictPeriodTxt: b38LabelValue(html, '수요예측일'),
    subscPeriodTxt: b38LabelValue(html, '공모청약일'),
    payDateTxt: b38LabelValue(html, '납입일'),
    refundDateTxt: b38LabelValue(html, '환불일'),
    offerAmountTxt: b38LabelValue(html, '공모금액'),
    allocInstTxt: b38LabelValue(html, '기관투자자등'),
    subRule: (function(){
      try{
        var t=String(html).replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/\s+/g,' ');
        var i=t.indexOf('일반청약자'); if(i<0) return null;
        var seg=t.slice(i,i+400);
        var mg=seg.match(/청약증거금율\s*:\s*([\d.]+)\s*%/), mx=seg.match(/청약\s*최고한도\s*:\s*([\d,~\s]+?)\s*주/), mn=seg.match(/최저\s*:\s*([\d,]+)\s*주/);
        return {marginRate: mg?parseFloat(mg[1]):null, maxShares: mx?mx[1].trim():null, minShares: mn?parseInt(mn[1].replace(/,/g,''),10):null};
      }catch(e){ return null; }
    })(),
    allocRetailTxt: b38LabelValue(html, '일반청약자')
  };
}

/* "868.64:1" → 868.64 / "332.82:1 (비례 666:1)" → 332.82 */
function parseRatioColon(txt) {
  if (!txt) return null;
  // "868.64:1" · "1,196.08:1" · 에이치엘지노믹스처럼 ":1" 없이 숫자만("714.52") 적힌 경우도 인식
  let m = txt.match(/([\d,]+(?:\.\d+)?)\s*[:대]\s*1/);
  if (!m) m = String(txt).trim().match(/^([\d,]+(?:\.\d+)?)$/);
  return m ? parseFloat(m[1].replace(/,/g, '')) : null;
}
function parsePercentTxt(txt) {
  if (!txt) return null;
  const m = txt.match(/([\d.]+)\s*%/);
  return m ? parseFloat(m[1]) : null;
}

/* 유통비율 보강 — ipostock.co.kr(UTF-8, robots.txt 없음). 38.co.kr에는 유통비율 수치가
   없어서, 종목명으로 ipostock의 "주주구성" 페이지(view_02.asp)를 찾아
   유통가능주식합계 ÷ 공모후 발행주식수 로 직접 계산한다. ipostock은 자체 종목코드
   (B202511171 형식)를 쓰므로 38.co.kr의 no와 다르며, 먼저 이름으로 검색해 코드를 찾아야 한다. */
const IPOSTOCK_BASE = 'http://ipostock.co.kr';

async function fetchIpostockText(url) {
  // 동시 요청이 몰리면 가끔 빈 응답/오류가 나므로 짧게 쉬면서 최대 3번 재시도한다.
  for (let i = 0; i < 3; i++) {
    if (i > 0) await new Promise(res => setTimeout(res, 500 * i));
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36', 'Accept-Language': 'ko-KR,ko;q=0.9' } });
      if (!r.ok) continue;
      const t = await r.text(); // 실제로는 UTF-8로 서비스됨(메타태그 표기만 ks_c_5601로 틀림)
      if (t && t.length > 2000) return t;
    } catch (e) {}
  }
  return null;
}

// 검색 결과에는 최근 조회된 다른 종목도 함께 섞여 나오므로, 이름이 정확히 일치하는 것만 쓴다
// (오탐으로 엉뚱한 종목의 유통비율을 가져오는 것을 막기 위한 안전장치).
async function ipostockSearchCode(name) {
  const html = await fetchIpostockText(IPOSTOCK_BASE + '/sub05/company01.asp?str2=' + encodeURIComponent(name));
  if (!html) return null;
  const re = /code=([A-Z0-9]+)&schk=\d"[^>]*><font[^>]*><b>([^<]+)<\/b>/g;
  let m;
  const norm = x => String(x || '').replace(/\(주\)|㈜|\s+/g, '').trim();
  const want = norm(name);
  while ((m = re.exec(html))) {
    if (norm(m[2]) === want) return m[1];
  }
  // 정확히 일치하는 이름이 없으면(예: "(구.OOO)" 표기 차이) 포함 관계가 하나뿐일 때만 채택
  if (want.length >= 3) {
    const cands = [];
    re.lastIndex = 0;
    while ((m = re.exec(html))) { const n = norm(m[2]); if (n.indexOf(want) >= 0 || want.indexOf(n) >= 0) cands.push(m[1]); }
    if (cands.length === 1) return cands[0];
  }
  return null;
}

async function ipostockFloatRatio(code) {
  const html = await fetchIpostockText(IPOSTOCK_BASE + '/view_pg/view_02.asp?code=' + code + '&gmenu=');
  if (!html) return null;
  const fm = html.match(/유통가능\s*주식합계.*?<b>\s*(?:&nbsp;)*([\d,]+)\s*주/s);
  if (!fm) return null;
  const floatShares = parseFloat(fm[1].replace(/,/g, ''));
  const occs = [...html.matchAll(/발행주식수[^>]*<\/font>\s*<\/td>\s*<td[^>]*>([^<]+)<\/td>/g)];
  if (!occs.length) return null;
  const postShares = parseFloat((occs[occs.length - 1][1] || '').replace(/[^\d]/g, ''));
  if (!postShares) return null;
  return Math.round((floatShares / postShares) * 10000) / 100;
}


/* 보호예수 일정 — ipostock 주주구성(view_02.asp)의 "보호예수 / 매도금지" 표에서
   '상장후 15일·1개월·3개월·6개월·12개월' 별 수량(주)·비율(%)을 읽어 기간별로 합산한다.
   ('합병후'처럼 상장일 기준이 아닌 행은 제외) */
function parseIpostockLockup(html) {
  if (!html) return null;
  html = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<!--[\s\S]*?-->/g, '');
  const a = html.indexOf('보호예수');
  const b = html.indexOf('유통가능', a + 1);
  if (a < 0 || b < 0) return null;
  const t = html.slice(a, b).replace(/<[^>]+>/g, '|').replace(/&nbsp;/g, ' ').replace(/[\s|]*\|[\s|]*/g, '|');
  const re = /([\d,]+)\s*주\|[\d,]+\s*주\|([\d.]+)\s*%\|([^|]*)\|/g;
  const by = {};
  let m;
  while ((m = re.exec(t))) {
    const per = m[3];
    if (/합병/.test(per)) continue;
    const pm = per.match(/(\d+)\s*(일|개월|년)/);
    if (!pm) continue;
    const n = +pm[1];
    const months = pm[2] === '개월' ? n : pm[2] === '년' ? n * 12 : 0;
    const days = pm[2] === '일' ? n : 0;
    const key = months ? months + 'm' : days + 'd';
    if (!by[key]) by[key] = { months: months, days: days, label: months ? (months % 12 === 0 ? (months / 12) + '년' : months + '개월') : days + '일', shares: 0, pct: 0 };
    by[key].shares += parseFloat(m[1].replace(/,/g, ''));
    by[key].pct += parseFloat(m[2]);
  }
  const out = Object.keys(by).map(k => by[k]).sort((x, y) => (x.months * 31 + x.days) - (y.months * 31 + y.days));
  out.forEach(o => { o.pct = Math.round(o.pct * 100) / 100; });
  return out.length ? out : null;
}
async function enrichLockupSchedule(name) {
  try {
    const code = await ipostockSearchCode(name);
    if (!code) return null;
    const html = await fetchIpostockText(IPOSTOCK_BASE + '/view_pg/view_02.asp?code=' + code + '&gmenu=');
    return parseIpostockLockup(html);
  } catch (e) { return null; }
}

async function enrichFloatRatio(name) {
  try {
    const code = await ipostockSearchCode(name);
    if (!code) return null;
    return await ipostockFloatRatio(code);
  } catch (e) { return null; }
}

/* 동시 요청 수를 제한하며 배열을 매핑한다 — 종목 수가 많아지면(신규상장 과거 전체 조회)
   상세페이지·ipostock 조회가 한 번에 너무 많이 몰리는 것을 막기 위한 안전장치. */
async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx], idx).catch(() => null);
    }
  }
  await Promise.all(new Array(Math.min(limit, items.length)).fill(0).map(worker));
  return out;
}

/* 신규상장(이미 상장된) 종목의 과거 이력 전체를 담은 아카이브 목록 페이지.
   메인페이지(/html/ipo/)에는 최근 3개월치 정도만 나오므로, 연초까지의 "과거 자료"를
   보여주려면 이 목록(오래된 순으로 페이지가 넘어감)을 페이지별로 훑어야 한다. */
function parse38NwArchive(html) {
  // [버그 수정] 유가증권(코스피) 상장 종목은 이름이 "케이뱅크<font>(유가)</font>"처럼 <font>가 중첩돼
  // 이전 정규식(<font>…</font> 한 겹만 허용)에 매칭되지 않아 코스피 신규상장 전체가 통째로 누락됐다.
  // 링크 안쪽 HTML을 통째로 잡은 뒤 태그를 걷어내 이름을 얻는다.
  const re = /<tr[^>]*>\s*<td[^>]*><a href="\.\/\?o=v&amp;no=(\d+)[^"]*"[^>]*>([\s\S]*?)<\/a><\/td>\s*<td[^>]*>(\d{4}\/\d{2}\/\d{2})<\/td>/g;
  const out = [];
  let m;
  while ((m = re.exec(html))) {
    const name = m[2].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim().replace(/\((유가|코넥스|코)\)\s*$/, '').trim();
    out.push({ no: m[1], name: name, listDate: m[3] }); // "2026/01/30" — 나머지 파이프라인과 동일하게 "."/"/" 구분자를 유지
  }
  return out;
}

/* targetYear(예: '2026')에 해당하는 상장 종목을 목록 페이지를 페이지별로 넘기며 모은다.
   페이지는 최신순 정렬이라, targetYear보다 이전 연도 행을 만나면 그 페이지에서 즉시 멈춘다.
   [버그 수정] 페이지 fetch 실패(null)를 "더 이상 데이터 없음"과 구분 없이 그냥 break 해버리면,
   38.co.kr이 짧은 시간에 연속 요청을 걸러낼 때(레이트리밋으로 추정) 1페이지만 받고 조용히
   멈춰버려도 전혀 알아챌 방법이 없었다 — 그래서 실패 사유를 err 필드로 밖으로 내보내고,
   페이지 사이에 짧은 간격을 둬 연속 요청처럼 보이지 않게 한다. */
async function fetchIpoArchiveYear(targetYear, maxPages) {
  const items = [];
  let err = null;
  for (let page = 1; page <= maxPages; page++) {
    if (page > 1) await new Promise(res => setTimeout(res, 350));
    const html = await fetchEucKr(B38_BASE + '/html/fund/index.htm?o=nw&page=' + page);
    if (!html) { err = 'page ' + page + ' fetch 실패(null)'; break; }
    const rows = parse38NwArchive(html);
    if (!rows.length) { if (page === 1) err = 'page 1 파싱 결과 0건(정규식 불일치 가능성)'; break; }
    let hitOlder = false;
    for (const r of rows) {
      const year = r.listDate.slice(0, 4);
      if (year < targetYear) { hitOlder = true; break; }
      if (year === targetYear) items.push(r);
    }
    if (hitOlder) break;
  }
  return { items, err };
}

/* 수요예측 결과 목록(o=r1) — 종목별 확정공모가·기관경쟁률·의무보유확약. 상세페이지 조회가 실패하거나 값이 비어 있어도
   이 목록으로 보완한다(최근 약 3개월분). 반환: { 정규화된종목명: {finalPrice, instTxt, lockupTxt} } */
async function fetchIpoResultsMap() {
  const out = {};
  const html = await fetchEucKr(B38_BASE + '/html/fund/index.htm?o=r1', 3);
  if (!html) return out;
  const normName = x => String(x || '').replace(/\(구\..*$/, '').replace(/\s+/g, '').trim();
  const rows = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) || [];
  for (const r of rows) {
    const tds = (r.match(/<td[^>]*>[\s\S]*?<\/td>/g) || []).map(ipoCellText);
    if (tds.length < 8 || !/\d{4}[./]\d{2}[./]\d{2}/.test(tds[1])) continue;
    out[normName(tds[0])] = { finalPrice: tds[3], instTxt: tds[5], lockupTxt: tds[6] };
  }
  return out;
}

async function buildIpoList(env) {
  // [진단용] fetchEucKr()는 실패 사유를 감춘 채 null만 돌려주므로, 메인페이지 요청만은 실제
  // HTTP 상태코드/예외 메시지를 그대로 남겨 어디서 막히는지(사이트 차단인지, 타임아웃인지) 알 수 있게 한다.
  // [버그 대응] 38.co.kr도 Cloudflare 뒤에 있는 것으로 보여 가끔 522(Origin 응답 지연)가 나는데,
  // 대개 일시적이라 짧게 텀을 두고 최대 3번 재시도한다.
  let mainHtml = null, mainErr = null;
  for (let i = 0; i < 3 && !mainHtml; i++) {
    if (i > 0) await new Promise(res => setTimeout(res, 700 * i));
    try {
      const r = await fetch(B38_BASE + '/html/ipo/', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8'
        }
      });
      if (!r.ok) { mainErr = 'HTTP ' + r.status + (i < 2 ? ' (재시도 ' + (i + 1) + '/3)' : ''); }
      else {
        const buf = await r.arrayBuffer();
        try { mainHtml = new TextDecoder('euc-kr').decode(buf); }
        catch (e) { mainHtml = new TextDecoder('utf-8').decode(buf); }
      }
    } catch (e) { mainErr = String(e); }
  }
  if (!mainHtml) return { updated: new Date().toISOString(), items: [], error: 'main page fetch failed', mainErr: mainErr };

  const predictRows = parse38Panel(mainHtml, 3, 4); // 수요예측
  const subRows = parse38Panel(mainHtml, 4, 5);     // 공모청약
  const listedRows = parse38Panel(mainHtml, 5, 6);  // 신규상장

  const byNo = {};
  function ensure(no, name) {
    if (!byNo[no]) byNo[no] = { no: no, name: name };
    return byNo[no];
  }
  predictRows.forEach(r => {
    if (!r.no || r.cells.length < 5) return;
    const c = ensure(r.no, r.cells[0]);
    c.predictDate = r.cells[1]; c.priceBand = r.cells[2]; c.shares = r.cells[3]; c.underwriterFromList = r.cells[4];
    c.stage = c.stage || '수요예측';
  });
  subRows.forEach(r => {
    if (!r.no || r.cells.length < 6) return;
    const c = ensure(r.no, r.cells[0]);
    c.subscDate = r.cells[1]; c.offerPriceTxt = r.cells[2]; c.subLimit = r.cells[3]; c.competRatioTxt = r.cells[4]; c.underwriterFromList = r.cells[5];
    c.stage = '청약중';
  });
  listedRows.forEach(r => {
    if (!r.no || r.cells.length < 7) return;
    const c = ensure(r.no, r.cells[0]);
    c.listDate = r.cells[1]; c.openPriceTxt = r.cells[3]; c.sharesListed = r.cells[4]; c.listStatus = r.cells[6];
    c.inListedPanel = true;
    if (!c.stage) c.stage = '신규상장';
  });

  // 메인페이지(/html/ipo/)는 최근 3개월 안팎만 보여주므로, 올해 연초까지의 "과거" 신규상장
  // 종목은 목록 아카이브(o=nw)를 페이지별로 훑어 보강한다(연도 경계에서 자동 정지).
  const targetYear = String(new Date().getFullYear());
  let archiveRows = [], archiveErr = null;
  try {
    const archiveResult = await fetchIpoArchiveYear(targetYear, 10);
    archiveRows = archiveResult.items;
    archiveErr = archiveResult.err;
  } catch (e) { archiveErr = String(e); }
  archiveRows.forEach(r => {
    if (!r.no) return;
    const c = ensure(r.no, r.name);
    if (!c.listDate) c.listDate = r.listDate;
    if (!c.stage) c.stage = '신규상장';
  });

  // [버그 수정] "케이뱅크"처럼 이미 상장(메인페이지 최근 3개월 창에서 벗어남)한 지 오래된 종목은
  // archiveRows(연간 전체)에서만 잡히는데, Object.keys는 삽입 순서를 유지하고 predict/sub/listed
  // (메인페이지, 최근 것들)가 archiveRows보다 먼저 삽입되므로, 90개로 자르면 오히려 오래된
  // archive 종목들이 뒤로 밀려 통째로 잘려나갔다(연간 상장 종목수가 90개에 근접/초과하면 발생).
  // 국내 연간 신규상장 종목수(스팩 포함)가 넉넉히 들어가도록 한도를 올린다.
  const nos = Object.keys(byNo).slice(0, 200);
  // [원인] 38.co.kr은 짧은 시간에 요청이 많으면(상세페이지 50여 건) 뒤쪽 요청부터 빈 응답을 준다. 종목번호 오름차순으로
  // 요청하면 가장 중요한 "최근·진행 중" 종목(번호가 큰 것)이 맨 마지막에 걸려 실패했다. 그래서
  //  ① 이미 상장이 끝난 종목은 KV에 보관한 정상본을 그대로 쓰고(재요청 안 함),
  //  ② 나머지는 번호가 큰(최근) 종목부터 천천히(동시 2건) 요청하며,
  //  ③ 실패하면 아래 2차 재시도에서 더 긴 간격으로 다시 시도한다.
  const details = new Array(nos.length).fill(null);
  const nowK = new Date(Date.now() + 9 * 3600 * 1000);
  const todayN = nowK.getUTCFullYear() * 10000 + (nowK.getUTCMonth() + 1) * 100 + nowK.getUTCDate();
  const needFetch = [];
  for (let i = 0; i < nos.length; i++) {
    let cachedD = null;
    if (env.KR_KV) { try { const c = await env.KR_KV.get('ipo-detail-' + nos[i]); if (c) cachedD = JSON.parse(c); } catch (e) {} }
    if (cachedD && cachedD.market && cachedD.instRatioTxt && ('stockCodeTxt' in cachedD) && ('subRule' in cachedD)) {
      const lm0 = String(cachedD.listDateTxt || '').match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
      const ln0 = lm0 ? (+lm0[1]) * 10000 + (+lm0[2]) * 100 + (+lm0[3]) : 0;
      if (ln0 && ln0 + 3 <= todayN) { details[i] = cachedD; continue; } // 상장 3일 이후면 값이 더 바뀌지 않는다
    }
    needFetch.push({ i: i, cachedD: cachedD });
  }
  needFetch.sort((x, y) => (+nos[y.i]) - (+nos[x.i])); // 최근(번호 큰) 종목 우선
  await mapLimit(needFetch, 2, async it => {
    await new Promise(res => setTimeout(res, 250));
    let d = null;
    try { d = await fetch38Detail(nos[it.i]); } catch (e) {}
    const key = 'ipo-detail-' + nos[it.i];
    if (d && d.market) {
      if (env.KR_KV) { try { await env.KR_KV.put(key, JSON.stringify(d), { expirationTtl: 1209600 }); } catch (e) {} }
      details[it.i] = d;
    } else if (it.cachedD && it.cachedD.market) {
      it.cachedD._stale = true; details[it.i] = it.cachedD;
    } else details[it.i] = d;
    return null;
  });

  let resultsMap = {};
  try { resultsMap = await fetchIpoResultsMap(); } catch (e) {}
  const names = nos.map(no => (byNo[no].name || '').replace(/\(구\..*$/, '').replace(/\((유가|코넥스|코)\)\s*$/, '').trim() || byNo[no].name);
  // 1차에서 실패한 종목은 천천히 한 건씩 다시 시도한다(몰려서 막힌 경우 대부분 여기서 복구됨)
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < nos.length; i++) {
      if (details[i] && details[i].market) continue;
      await new Promise(res => setTimeout(res, 1500 * (pass + 1)));
      try {
        const d2 = await fetch38Detail(nos[i]);
        if (d2 && d2.market) {
          details[i] = d2;
          if (env.KR_KV) { try { await env.KR_KV.put('ipo-detail-' + nos[i], JSON.stringify(d2), { expirationTtl: 1209600 }); } catch (e) {} }
        }
      } catch (e) {}
    }
  }

  let dartByName = {};
  try { if (nos.some((no, i) => !(details[i] && details[i].stockCodeTxt))) dartByName = await getDartCorpMapByName(env); } catch (e) {}
  // 유통비율: ipostock(상장 직후 유통가능주식 ÷ 공모후 발행주식, 전 종목 동일 기준)을 우선 쓰고, 못 구하면
  // 38.co.kr 상세표 값으로 대체한다. 성공값은 KV에 24시간 보관해 일시적 조회 실패에도 값이 사라지지 않게 한다.
  const floatRatios = await mapLimit(names, 4, async (nm, idx) => {
    if (/스팩/.test(nm)) return null; // 스팩은 유통비율 개념이 달라 제외(프론트에서 '해당없음' 표기)
    const kvKey = 'ipo-float-' + nm;
    let v = null;
    try { v = await enrichFloatRatio(nm); } catch (e) {}
    if (v == null && details[idx] && details[idx].floatRatio38 != null) v = details[idx].floatRatio38;
    if (env.KR_KV) {
      try {
        if (v != null) await env.KR_KV.put(kvKey, String(v), { expirationTtl: 86400 });
        else { const c = await env.KR_KV.get(kvKey); if (c != null) v = parseFloat(c); }
      } catch (e) {}
    }
    return v;
  });

  const items = nos.map((no, i) => {
    const c = byNo[no];
    const d = details[i] || {};
    const rawName = c.name || '';
    const rmKey = String(names[i] || '').replace(/\s+/g, '');
    const rm = resultsMap[rmKey] || null;
    let instRatio = parseRatioColon(d.instRatioTxt);
    if (instRatio == null && rm) instRatio = parseRatioColon(rm.instTxt);
    // "확정공모가"가 "-"뿐이거나 기관경쟁률이 아직 없으면(수요예측 전) 의무보유확약도
    // 사이트가 기본값 "0.00%"로 표시해 실제 0%처럼 보이므로, 그 경우엔 null로 비워둔다.
    let offerFinalTxt = (d.offerFinalTxt && !/^-\s*원?$/.test(d.offerFinalTxt.trim())) ? d.offerFinalTxt : null;
    if (!offerFinalTxt && rm && /\d/.test(rm.finalPrice || '')) offerFinalTxt = rm.finalPrice + (/원/.test(rm.finalPrice) ? '' : ' 원');
    let lockupRatio = instRatio != null ? parsePercentTxt(d.lockupTxt) : null;
    if (lockupRatio == null && instRatio != null && rm) lockupRatio = parsePercentTxt(rm.lockupTxt);
    // [버그 수정] 신규상장 패널에는 "상장 예정"인 종목도 함께 나오므로, 상장일(전체 날짜)이 오늘(KST) 이전일 때만
    // 상장완료로 보고, 아직이면 상장예정(청약이 끝난 경우) 또는 기존 단계(청약중 등)를 유지한다.
    const listFull = d.listDateTxt || c.listDate || '';
    const lm = String(listFull).match(/(\d{4})[.\-\/](\d{1,2})[.\-\/](\d{1,2})/);
    const nowKst = new Date(Date.now() + 9 * 3600 * 1000);
    const todayNum = nowKst.getUTCFullYear() * 10000 + (nowKst.getUTCMonth() + 1) * 100 + nowKst.getUTCDate();
    let stage = c.stage || null;
    if (lm) {
      const ln = (+lm[1]) * 10000 + (+lm[2]) * 100 + (+lm[3]);
      if (ln <= todayNum) stage = '신규상장';
      else if (stage === '신규상장') stage = '상장예정';
    } else if (stage === '신규상장' && c.inListedPanel) {
      stage = '상장예정';
    }
    // 청약 단계 세분화: 청약예정 / 청약중 / 청약완료(청약은 끝났고 아직 상장 전) / 상장완료
    if (stage === '청약중' || stage === '상장예정') {
      const sm = String(c.subscDate || d.subscPeriodTxt || '').match(/(?:(\d{4})[\/.])?(\d{1,2})[\/.](\d{1,2})\s*~\s*(?:(\d{4})[\/.])?(\d{1,2})[\/.](\d{1,2})/);
      if (sm) {
        const y1 = +(sm[1] || nowKst.getUTCFullYear()), y2 = +(sm[4] || sm[1] || nowKst.getUTCFullYear());
        const sNum = y1 * 10000 + (+sm[2]) * 100 + (+sm[3]);
        const eNum = y2 * 10000 + (+sm[5]) * 100 + (+sm[6]);
        if (todayNum < sNum) stage = '청약예정';
        else if (todayNum <= eNum) stage = '청약중';
        else stage = '청약완료';
      } else if (stage === '상장예정') stage = '청약완료';
    }
    return {
      no: no,
      name: names[i],
      market: d.market || null,
      stage: stage,
      predictDate: c.predictDate || null,
      subscDate: c.subscDate || (d.subscPeriodTxt && /\d/.test(d.subscPeriodTxt) ? d.subscPeriodTxt : null),
      predictPeriod: d.predictPeriodTxt || null,
      payDate: d.payDateTxt || null,
      refundDate: d.refundDateTxt || null,
      offerAmount: d.offerAmountTxt || null,
      allocInst: d.allocInstTxt || null,
      allocRetail: d.allocRetailTxt || null,
      listDate: d.listDateTxt || c.listDate || null,
      offerPriceBand: d.offerBandTxt || c.priceBand || null,
      offerPriceFinal: offerFinalTxt,
      instRatio: instRatio,
      lockupRatio: lockupRatio,
      isSpac: /스팩/.test(names[i]),
      stockCode: d.stockCodeTxt || (dartByName[names[i]] && dartByName[names[i]].stockCode) || null,
      floatRatio: floatRatios[i] != null ? floatRatios[i] : null, // 유통비율(%) — ipostock.co.kr 보강, 못 찾으면 null
      subRatioText: d.subRatioTxt || c.competRatioTxt || null,
      underwriter: d.underwriter || c.underwriterFromList || null,
      subRule: d.subRule || null,
      totalShares: d.totalSharesTxt || c.shares || null,
      parValue: d.parValueTxt || null,
      sourceUrl: B38_BASE + '/html/fund/?o=v&no=' + no
    };
  });

  // 상장완료 종목의 보호예수 일정(15일·1개월·3개월·6개월…별 수량) — ipostock 주주구성 표. 성공값은 KV 보관.
  const listed = items.filter(x => x.stage === '신규상장');
  await mapLimit(listed, 3, async it => {
    const nm = String(it.name || '').replace(/\(구\..*$/, '').replace(/\((유가|코넥스|코)\)\s*$/, '').trim();
    const kk = 'ipo-lock-' + nm;
    let v = null;
    if (env.KR_KV) { try { const c = await env.KR_KV.get(kk); if (c) v = JSON.parse(c); } catch (e) {} }
    if (!v) {
      v = await enrichLockupSchedule(nm);
      if (v && env.KR_KV) { try { await env.KR_KV.put(kk, JSON.stringify(v), { expirationTtl: 604800 }); } catch (e) {} }
    }
    it.lockupSchedule = v || null;
    return null;
  });

  const missing = items.filter(x => !x.market).length;
  return { updated: new Date().toISOString(), items: items, archiveCount: archiveRows.length, archiveErr: archiveErr, missingDetail: missing };
}

async function runIpoListJob(env) {
  const result = await buildIpoList(env);
  if (env.KR_KV) {
    try { await env.KR_KV.put('ipo-list-v6', JSON.stringify(result), { expirationTtl: 172800 }); } catch (e) {}
  }
  return result;
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
    if (!r.ok) return null; // 401(미승인) 등 — 날짜를 바꿔도 소용없는 실패
    const j = await r.json();
    return (j.OutBlock_1 && j.OutBlock_1.length) ? j.OutBlock_1 : []; // 빈 배열=해당일 미집계(휴장/발표지연)
  } catch (e) { return null; }
}
/* [2026-09-28 발견] KRX Open API는 최근 2~4거래일치가 아직 집계 전이라 당일(basDd=오늘)
   요청은 거의 항상 빈 배열을 반환한다(클라이언트 krxJSONRecent와 동일한 현상). Cron이
   "오늘" 날짜로만 조회하면 매번 skipped 되므로, 최근 며칠을 거슬러 올라가며 가장 최근에
   실제로 발표된 거래일을 찾는다. 401(미승인)이면 날짜를 바꿔도 의미 없으므로 즉시 포기. */
async function fetchKrxRowsRecent(path, maxBack) {
  for (let i = 0; i < (maxBack || 10); i++) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const rows = await fetchKrxRows(path, fmtYmd(d));
    if (rows === null) return null; // 401 등 진짜 실패 — 더 시도해도 의미 없음
    if (rows.length) return { rows, basDd: fmtYmd(d) };
  }
  return { rows: [], basDd: fmtYmd(new Date()) };
}

const handler = {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS });
    }

    const reqUrl = new URL(request.url);

    // [미국] 시장 폭 — TradingView 스캐너에서 NYSE·NASDAQ 보통주(시총 3억$ 이상) 개수를 집계 (5분 캐시)
    if (reqUrl.pathname.replace(/\/{2,}/g, '/') === '/us-breadth') {
      const hdr = { ...CORS, 'Content-Type': 'application/json' };
      const ck = new Request('https://cache.local/us-breadth-v1');
      try {
        const hit = await caches.default.match(ck);
        if (hit) return new Response(await hit.text(), { headers: hdr });
        const base = [
          { left: 'type', operation: 'equal', right: 'stock' },
          { left: 'subtype', operation: 'equal', right: 'common' },
          { left: 'exchange', operation: 'in_range', right: ['NYSE', 'NASDAQ'] },
          { left: 'market_cap_basic', operation: 'greater', right: 300000000 }
        ];
        const cnt = async (extra) => {
          const r = await fetch('https://scanner.tradingview.com/america/scan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Origin': 'https://www.tradingview.com', 'User-Agent': 'Mozilla/5.0' },
            body: JSON.stringify({ filter: base.concat([extra]), markets: ['america'], columns: ['name'], range: [0, 1] })
          });
          if (!r.ok) throw new Error('scanner ' + r.status);
          return (await r.json()).totalCount;
        };
        const [all, up, down, a50, a200, nh, nl] = await Promise.all([
          cnt({ left: 'close', operation: 'greater', right: 1 }),
          cnt({ left: 'change', operation: 'greater', right: 0 }),
          cnt({ left: 'change', operation: 'less', right: 0 }),
          cnt({ left: 'close', operation: 'greater', right: 'SMA50' }),
          cnt({ left: 'close', operation: 'greater', right: 'SMA200' }),
          cnt({ left: 'high', operation: 'egreater', right: 'price_52_week_high' }),
          cnt({ left: 'low', operation: 'eless', right: 'price_52_week_low' })
        ]);
        const body = JSON.stringify({ all, up, down, a50, a200, nh, nl, ts: Date.now(), src: 'TradingView scanner' });
        ctx.waitUntil(caches.default.put(ck, new Response(body, { headers: { 'Cache-Control': 'max-age=300' } })));
        return new Response(body, { headers: hdr });
      } catch (e) {
        return new Response(JSON.stringify({ error: String(e) }), { status: 502, headers: hdr });
      }
    }

    // [미국] 경제지표 일정 — TradingView 경제캘린더(예상·이전·결과 포함, 5분 캐시). ?days=14
    if (reqUrl.pathname.replace(/\/{2,}/g, '/') === '/us-econ') {
      const hdr = { ...CORS, 'Content-Type': 'application/json' };
      const days = Math.max(1, Math.min(30, parseInt(reqUrl.searchParams.get('days') || '14', 10) || 14));
      const ck = new Request('https://cache.local/us-econ-v1-' + days);
      try {
        const hit = await caches.default.match(ck);
        if (hit) return new Response(await hit.text(), { headers: hdr });
        const from = new Date(Date.now() - 86400000).toISOString();
        const to = new Date(Date.now() + days * 86400000).toISOString();
        const r = await fetch('https://economic-calendar.tradingview.com/events?from=' + from + '&to=' + to + '&countries=US', {
          headers: { 'Origin': 'https://www.tradingview.com', 'User-Agent': 'Mozilla/5.0' }
        });
        if (!r.ok) throw new Error('calendar ' + r.status);
        const j = await r.json();
        const ev = (j.result || []).map(e => ({
          t: e.date, title: e.title, imp: e.importance, period: e.period, unit: e.unit, scale: e.scale,
          actual: e.actual, forecast: e.forecast, prev: e.previous
        }));
        const body = JSON.stringify({ events: ev, ts: Date.now(), src: 'TradingView economic calendar' });
        ctx.waitUntil(caches.default.put(ck, new Response(body, { headers: { 'Cache-Control': 'max-age=300' } })));
        return new Response(body, { headers: hdr });
      } catch (e) {
        return new Response(JSON.stringify({ error: String(e) }), { status: 502, headers: hdr });
      }
    }

    // 2번(주가 강도)·3번(주가 폭) 사전 계산 결과 — 매일 1회 scheduled()가 KV에 저장해둔 값을 그대로 서빙
    if (reqUrl.pathname === '/kr-breadth') {
      let data = '{}';
      try { data = (await env.KR_KV.get('kr-breadth-latest')) || '{}'; } catch (e) {}
      return new Response(data, { headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    // [진단용] KV 바인딩이 실제로 연결됐는지 테스트 — /kr-breadth 는 바인딩이 없어도
    // catch로 조용히 '{}' 를 반환하므로 "바인딩 안 됨"과 "바인딩은 됐지만 아직 데이터 없음"을
    // 구분할 수 없다. 이 라우트는 실제 쓰기/읽기를 해보고 결과를 그대로 보여준다.
    if (reqUrl.pathname === '/kr-kv-debug') {
      const out = { bound: !!env.KR_KV };
      if (env.KR_KV) {
        try {
          const testKey = '__kv_debug_test__';
          await env.KR_KV.put(testKey, String(Date.now()));
          out.writeOk = true;
          out.readBack = await env.KR_KV.get(testKey);
          out.latest = await env.KR_KV.get('kr-breadth-latest');
          out.histExists = !!(await env.KR_KV.get('kr-price-hist'));
        } catch (e) {
          out.error = String(e);
        }
      }
      return new Response(JSON.stringify(out, null, 2), { headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    // [진단용] Cron 스케줄을 기다리지 않고 즉시 1회 실행해서 KV에 결과를 채운다.
    // 설정 검증용 — 정상 운영 시엔 Cron Trigger가 매일 자동으로 이 로직을 돌린다.
    if (reqUrl.pathname === '/kr-breadth-run-now') {
      try {
        const result = await runBreadthJob(env);
        return new Response(JSON.stringify(result, null, 2), { headers: { ...CORS, 'Content-Type': 'application/json' } });
      } catch (e) {
        return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });
      }
    }

    // 진단/수동갱신용 — KV 캐시를 무시하고 즉시 다시 집계한다(배포 직후 옛 캐시가 남아있을 때 사용).
    if (reqUrl.pathname === '/ipo-list-run-now') {
      try {
        const result = await runIpoListJob(env);
        return new Response(JSON.stringify(result, null, 2), { headers: { ...CORS, 'Content-Type': 'application/json' } });
      } catch (e) {
        return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });
      }
    }

    // 공모주 상장완료 종목 시세 — 네이버 fchart(일봉 XML). 신규상장 스팩 등 Yahoo에 없는 종목도 조회된다.
    // code가 없으면 name으로 네이버 자동완성에서 종목코드를 찾는다.
    if (reqUrl.pathname === '/ipo-quote') {
      const hdr = { ...CORS, 'Content-Type': 'application/json' };
      try {
        let code = (reqUrl.searchParams.get('code') || '').trim();
        const nm = (reqUrl.searchParams.get('name') || '').replace(/\(.*$/, '').trim();
        if (!/^[0-9A-Z]{6}$/.test(code) && nm) {
          code = '';
          const qs = [nm, nm.replace(/호스팩$/, '호'), nm.replace(/스팩$/, '')];
          for (const q of qs) {
            if (code || !q) continue;
            try {
              const r = await fetch('https://ac.stock.naver.com/ac?q=' + encodeURIComponent(q) + '&target=stock', { headers: { 'User-Agent': UA } });
              const j = await r.json();
              const arr = (j.items || []).map(x => Array.isArray(x) ? { code: x[0], name: x[1] } : x);
              const hit = arr.find(x => x && String(x.name || '').replace(/\s/g, '') === nm.replace(/\s/g, '')) || (arr.length === 1 ? arr[0] : null);
              if (hit && /^[0-9A-Z]{6}$/.test(String(hit.code))) code = String(hit.code);
            } catch (e) {}
          }
        }
        if (!/^[0-9A-Z]{6}$/.test(code)) return new Response(JSON.stringify({ error: 'no-code' }), { status: 404, headers: hdr });
        const r = await fetch('https://fchart.stock.naver.com/sise.nhn?symbol=' + code + '&timeframe=day&count=400&requestType=0', { headers: { 'User-Agent': UA } });
        const xml = await r.text();
        const rows = [];
        const re = /<item data="(\d{8})\|([\d.]+)\|([\d.]+)\|([\d.]+)\|([\d.]+)\|/g;
        let m;
        while ((m = re.exec(xml))) {
          const t = Date.UTC(+m[1].slice(0, 4), +m[1].slice(4, 6) - 1, +m[1].slice(6, 8)) / 1000;
          rows.push({ t: t, o: +m[2], h: +m[3], l: +m[4], c: +m[5] });
        }
        if (rows.length < 1) return new Response(JSON.stringify({ error: 'no-data', code: code }), { status: 404, headers: hdr });
        return new Response(JSON.stringify({ code: code, rows: rows }), { headers: { ...hdr, 'Cache-Control': 'max-age=300' } });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: hdr });
      }
    }

    // 국내 종목 증권사 컨센서스(연간 실적 + 예상치) — 네이버 증권 모바일 API(FnGuide 기반). 값은 억원. 6시간 KV 캐시.
    if (reqUrl.pathname === '/kr-consensus') {
      const hdr = { ...CORS, 'Content-Type': 'application/json' };
      const code = (reqUrl.searchParams.get('code') || '').trim();
      if (!/^[0-9A-Z]{6}$/.test(code)) return new Response(JSON.stringify({ error: 'code required' }), { status: 400, headers: hdr });
      try {
        const key = 'kr-cons-' + code;
        if (env.KR_KV) { try { const c = await env.KR_KV.get(key); if (c) return new Response(c, { headers: hdr }); } catch (e) {} }
        const r = await fetch('https://m.stock.naver.com/api/stock/' + code + '/finance/annual', { headers: { 'User-Agent': UA, 'Accept': 'application/json' } });
        if (!r.ok) return new Response(JSON.stringify({ error: 'upstream ' + r.status }), { status: 502, headers: hdr });
        const j = await r.json();
        const fi = j && j.financeInfo;
        if (!fi || !fi.trTitleList) return new Response(JSON.stringify({ error: 'no-data' }), { status: 404, headers: hdr });
        const num = t => { if (t == null) return null; const x = String(t).replace(/,/g, '').trim(); if (!x || x === '-') return null; const v = parseFloat(x); return isFinite(v) ? v : null; };
        const rowOf = nm => (fi.rowList || []).find(r => r.title === nm);
        const rev = rowOf('매출액'), op = rowOf('영업이익'), np = rowOf('당기순이익');
        const years = fi.trTitleList.map(t => ({
          key: t.key, title: t.title, est: t.isConsensus === 'Y',
          revenue: rev && rev.columns[t.key] ? num(rev.columns[t.key].value) : null,
          opProfit: op && op.columns[t.key] ? num(op.columns[t.key].value) : null,
          netProfit: np && np.columns[t.key] ? num(np.columns[t.key].value) : null
        }));
        const body = JSON.stringify({ code: code, unit: '억원', years: years, source: 'Naver Finance (FnGuide)' });
        if (env.KR_KV) { try { await env.KR_KV.put(key, body, { expirationTtl: 21600 }); } catch (e) {} }
        return new Response(body, { headers: hdr });
      } catch (e) {
        return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: hdr });
      }
    }

    // 종목코드(005930) → DART 고유번호(corp_code) 자동 조회. DART가 주는 corpCode.xml(zip) 전체를
    // 받아 한 번 파싱해 KV에 캐시해두고, 이후에는 캐시에서 필요한 종목만 꺼내준다.
    if (reqUrl.pathname === '/dart-corp') {
      const codes = (reqUrl.searchParams.get('codes') || '').split(',').map(s => s.trim()).filter(Boolean);
      const names = (reqUrl.searchParams.get('names') || '').split(',').map(s => s.trim()).filter(Boolean);
      try {
        const result = {};
        if (codes.length) {
          const map = await getDartCorpMap(env);
          codes.forEach(c => { result[c] = map[c] || null; });
        }
        if (names.length) {
          const mapByName = await getDartCorpMapByName(env);
          const byName = {};
          names.forEach(n => { byName[n] = mapByName[n] || null; });
          result.byName = byName;
          // 진단용: byName 맵이 통째로 비었는지(zip 전체가 실패), 아니면 이 이름만 없는지
          // 구분할 수 있게 전체 개수와 임의 샘플 몇 개를 같이 보여준다(한글 인코딩이 깨졌는지도 확인 가능).
          if (reqUrl.searchParams.get('debug') === '1') {
            const allNames = Object.keys(mapByName);
            result.debug = { totalNames: allNames.length, sample: allNames.slice(0, 5) };
          }
        }
        return new Response(JSON.stringify(result), { headers: { ...CORS, 'Content-Type': 'application/json' } });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });
      }
    }

    // 금융상품 페이지 — 예금/적금 금리비교(금융감독원 금융상품한눈에). KV에 6시간 캐시,
    // 만료됐으면 이 요청을 처리하는 김에 즉시 다시 집계해서 채운다(별도 Cron 불필요 —
    // 개인 사이트 트래픽 수준에서는 요청 시점 계산으로 충분하고 매일 자동 갱신할 만큼
    // 자주 바뀌는 데이터도 아님).
    if (reqUrl.pathname === '/fin-savings') {
      try {
        let data = null;
        if (env.KR_KV) {
          try {
            const cached = await env.KR_KV.get('fin-savings-latest');
            if (cached) data = JSON.parse(cached);
          } catch (e) {}
        }
        if (data && !(data.deposit && data.deposit.length) && !(data.saving && data.saving.length)) data = null; // 예전에 저장된 빈 캐시는 무시하고 다시 집계
        // stale-while-revalidate: 캐시가 있으면 즉시 응답하고, 1시간 넘었으면 응답 뒤에 백그라운드로 갱신한다.
        if (data) {
          if (Date.now() - new Date(data.updated || 0).getTime() > 3600000 && ctx && ctx.waitUntil) ctx.waitUntil(runFinSavingsJob(env).catch(e => console.error('fin-savings bg refresh failed', e)));
        } else {
          data = await runFinSavingsJob(env);
        }
        return new Response(JSON.stringify(data), { headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60' } });
      } catch (e) {
        return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });
      }
    }

    // 공모주 페이지 — 38.co.kr IPO 캘린더. KV에 6시간 캐시, 만료 시 요청 처리 중 즉시 재집계.
    if (reqUrl.pathname === '/ipo-debug') {
      // 진단용: Worker에서 38.co.kr 상세페이지가 실제로 어떻게 받아지는지(상태코드·크기·상세표 포함 여부) 확인
      const no = reqUrl.searchParams.get('no') || '2315';
      const out = [];
      for (const base of ['http://www.38.co.kr', 'https://www.38.co.kr']) {
        try {
          const r = await fetch(base + '/html/fund/?o=v&no=' + no, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });
          const buf = await r.arrayBuffer();
          const t = new TextDecoder('euc-kr').decode(buf);
          out.push({ base, status: r.status, bytes: buf.byteLength, hasMarket: t.indexOf('시장구분') >= 0 });
        } catch (e) { out.push({ base, error: String(e) }); }
      }
      return new Response(JSON.stringify(out), { headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    if (reqUrl.pathname === '/ipo-list') {
      try {
        let data = null;
        if (env.KR_KV && reqUrl.searchParams.get('refresh') !== '1') {
          try {
            const cached = await env.KR_KV.get('ipo-list-v6');
            if (cached) data = JSON.parse(cached);
          } catch (e) {}
        }
        if (data && !(data.deposit && data.deposit.length) && !(data.saving && data.saving.length)) data = null; // 예전에 저장된 빈 캐시는 무시하고 다시 집계
        // stale-while-revalidate: 캐시가 있으면 (오래됐어도) 즉시 응답하고, 신선하지 않으면(30분, 상세 누락 시 10분)
        // 응답 뒤에 백그라운드로 다시 계산한다. 캐시가 아예 없을 때만 직접 계산(약 1분)한다.
        if (data) {
          const age = Date.now() - new Date(data.updated || 0).getTime();
          const maxAge = (data.missingDetail > 0 ? 10 : 30) * 60000;
          if (age > maxAge && ctx && ctx.waitUntil) ctx.waitUntil(runIpoListJob(env).catch(e => console.error('ipo bg refresh failed', e)));
        } else {
          data = await runIpoListJob(env);
        }
        return new Response(JSON.stringify(data), { headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60' } });
      } catch (e) {
        return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });
      }
    }

    // 공모주 상세 — "동종업체와의 재무정보 비교" 표(증권신고서 발췌). 종목별로 거의 안 바뀌는
    // 정적 데이터라 KV에 24시간 캐시(?no=38.co.kr 상세페이지 id, ipo-list 응답의 no 필드).
    if (reqUrl.pathname === '/ipo-fin') {
      // DART 사업보고서가 없는 신규 종목용 — 38.co.kr "5.요약재무제표"에서 매출액·영업이익·당기순이익 추출
      const no = reqUrl.searchParams.get('no');
      if (!no) return new Response(JSON.stringify({ error: 'no 파라미터가 필요합니다' }), { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } });
      try {
        const cacheKey = 'ipo-fin-' + no;
        let data = null;
        if (env.KR_KV) { try { const c = await env.KR_KV.get(cacheKey); if (c) data = JSON.parse(c); } catch (e) {} }
        if (!data) {
          let html = null;
          for (let t = 0; t < 3 && !html; t++) {
            const h = await fetchEucKr((t % 2 === 0 ? B38_BASE : 'https://www.38.co.kr') + '/html/fund/?o=v&no=' + no, 2);
            if (h && h.indexOf('5.요약재무제표') >= 0) html = h;
          }
          data = { fin: html ? parseIpoSummaryFin(html) : null };
          if (env.KR_KV && data.fin) { try { await env.KR_KV.put(cacheKey, JSON.stringify(data), { expirationTtl: 86400 }); } catch (e) {} }
        }
        return new Response(JSON.stringify(data), { headers: { ...CORS, 'Content-Type': 'application/json' } });
      } catch (e) {
        return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });
      }
    }

    if (reqUrl.pathname === '/ipo-peer') {
      const no = reqUrl.searchParams.get('no');
      if (!no) return new Response(JSON.stringify({ error: 'no 파라미터가 필요합니다' }), { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } });
      try {
        const cacheKey = 'ipo-peer-' + no;
        let data = null;
        if (env.KR_KV) {
          try {
            const cached = await env.KR_KV.get(cacheKey);
            if (cached) data = JSON.parse(cached);
          } catch (e) {}
        }
        if (!data) {
          const html = await fetchEucKr(B38_BASE + '/html/fund/?o=v&no=' + no);
          data = { peer: html ? parseIpoPeerComparison(html) : null };
          if (env.KR_KV && data.peer) {
            try { await env.KR_KV.put(cacheKey, JSON.stringify(data), { expirationTtl: 86400 }); } catch (e) {}
          }
        }
        return new Response(JSON.stringify(data), { headers: { ...CORS, 'Content-Type': 'application/json' } });
      } catch (e) {
        return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });
      }
    }

    // 미국주식 시가총액 TOP10 재무비율/주가지표. KV에 6시간 캐시, 만료 시 요청 처리 중 즉시 재집계.
    if (reqUrl.pathname === '/us-fundamentals') {
      try {
        const fsetQ = reqUrl.searchParams.get('set');
        const fset = fsetQ === '3' ? 3 : fsetQ === '2' ? 2 : 1;
        let data = null;
        if (env.KR_KV) {
          try {
            const cached = await env.KR_KV.get(fset === 3 ? 'us-fundamentals-s3' : fset === 2 ? 'us-fundamentals-x3' : 'us-fundamentals-v3');
            if (cached) data = JSON.parse(cached);
          } catch (e) {}
        }
        if (!data) data = await runUsFundamentalsJob(env, fset);
        return new Response(JSON.stringify(data), { headers: { ...CORS, 'Content-Type': 'application/json' } });
      } catch (e) {
        return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });
      }
    }

    // [진단용] KV 캐시를 건너뛰고 강제로 새로 집계 — "재무" 버튼이 계속 로딩 중에 멈추는 문제를
    // 확인할 때, 이 주소를 직접 열어 실제로 몇 초가 걸리는지·에러가 나는지 바로 볼 수 있다.
    if (reqUrl.pathname === '/us-fundamentals-run-now') {
      try {
        const data = await runUsFundamentalsJob(env);
        return new Response(JSON.stringify(data), { headers: { ...CORS, 'Content-Type': 'application/json' } });
      } catch (e) {
        return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });
      }
    }

    // 지수 편입·편출 등 임의 종목의 재무비율 — 종목별 온디맨드 조회(KV 6시간 캐시).
    if (reqUrl.pathname === '/us-fundamental-one') {
      const tk = (reqUrl.searchParams.get('t') || '').toUpperCase().replace(/[^A-Z0-9.\-]/g, '').slice(0, 12);
      if (!tk) return new Response(JSON.stringify({ error: 't required' }), { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } });
      try {
        const ck = 'us-fund-one-v1-' + tk;
        let data = null;
        if (env.KR_KV) { try { const c = await env.KR_KV.get(ck); if (c) data = JSON.parse(c); } catch (e) {} }
        if (!data) {
          data = await fetchUsFundamentalOne(tk, 2);
          if (data && data.div && (data.div.rate || data.div.yield)) { try { data.divHist = await fetchUsDividendHistory(tk); } catch (e) {} }
          if (env.KR_KV && data) { try { await env.KR_KV.put(ck, JSON.stringify(data), { expirationTtl: 21600 }); } catch (e) {} }
        }
        return new Response(JSON.stringify(data || { ticker: tk }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
      } catch (e) {
        return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });
      }
    }

    // 관심종목(ETF) 카드 클릭 시 "주요 티커별 가중치·섹터 가중치" — 종목별 온디맨드 조회.
    // 보유종목 구성은 자주 안 바뀌므로 KV에 24시간 캐시한다(배치잡이 아니라 클릭 시 필요한
    // 종목만 그때그때 조회 — ETF 7개 전부를 미리 받아둘 필요는 없어 보인다).
    // 시총 TOP30 "핵심 뉴스" — Google News RSS(한국어, 최근 2일)에서 종목별로 주가 급등·급락·실적·규제 등
    // 시장 영향 키워드가 들어간 최신 기사 1건을 골라 원문(기사 링크)·출처와 함께 내려준다. 1시간 KV 캐시.
    if (reqUrl.pathname === '/cap-news') {
      const NAMES = { NVDA:['엔비디아','NVIDIA'], AAPL:['애플','Apple'], GOOGL:['알파벳','구글','Alphabet'], MSFT:['마이크로소프트','Microsoft'], AMZN:['아마존','Amazon'], TSM:['TSMC','대만 반도체'], SPCX:['스페이스X','SpaceX'], AVGO:['브로드컴','Broadcom'], META:['메타 플랫폼','메타플랫폼','메타(','페이스북','Meta Platforms'], TSLA:['테슬라','Tesla'], MU:['마이크론','Micron'], 'BRK-B':['버크셔','Berkshire'], AMD:['AMD'], LLY:['일라이 릴리','일라이릴리','Eli Lilly'], JPM:['JP모건','JPMorgan','제이피모건'], WMT:['월마트','Walmart'], V:['비자카드','비자(V','Visa Inc','비자 주가'], XOM:['엑슨모빌','Exxon'], INTC:['인텔','Intel'], JNJ:['존슨앤드존슨','존슨앤존슨','J&J','Johnson'], MA:['마스터카드','Mastercard'], ABBV:['애브비','AbbVie'], CSCO:['시스코','Cisco'], BAC:['뱅크오브아메리카','BofA','Bank of America'], AMAT:['어플라이드 머티어리얼즈','어플라이드머티어리얼즈','Applied Materials'], COST:['코스트코','Costco'], CAT:['캐터필러','Caterpillar'], CVX:['셰브런','Chevron'], UNH:['유나이티드헬스','UnitedHealth'], LRCX:['램리서치','Lam Research'] };
      const QN = { 'BRK-B':'버크셔 해서웨이', GOOGL:'알파벳 구글', LLY:'일라이 릴리', V:'비자카드 Visa', META:'메타 플랫폼스', AMAT:'어플라이드 머티어리얼즈' };
      const list = (reqUrl.searchParams.get('tickers') || '').toUpperCase().split(',').map(s => s.trim()).filter(s => NAMES[s]).slice(0, 35);
      if (!list.length) return new Response(JSON.stringify({ error: 'tickers required' }), { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } });
      const debug = reqUrl.searchParams.get('debug') === '1';
      const UP = /급등|폭등|상승|강세|호조|호실적|사상 최고|신고가|상향|서프라이즈|랠리|반등|수주|승인|돌파|최고가|껑충|뛰/;
      const DOWN = /급락|폭락|하락|약세|부진|쇼크|사상 최저|신저가|하향|우려|리스크|소송|규제|관세|제재|조사|리콜|감원|취소|지연|뚝|추락|밀려|흔들/;
      try {
        const cacheKey = 'capnews-v2-' + list.slice().sort().join('_').slice(0, 400);
        let data = null; const dbg = {};
        if (!debug && env.KR_KV) { try { const c = await env.KR_KV.get(cacheKey); if (c) data = JSON.parse(c); } catch (e) {} }
        if (!data) {
          data = {};
          await mapLimit(list, 5, async (t) => {
            const q = (QN[t] || NAMES[t][0]) + ' 주가';
            let items = [];
            try {
              const r = await fetch('https://news.google.com/rss/search?q=' + encodeURIComponent(q + ' when:2d') + '&hl=ko&gl=KR&ceid=KR:ko', { headers: { 'User-Agent': UA, 'Accept': 'application/rss+xml,text/xml,*/*', 'Accept-Language': 'ko-KR,ko;q=0.9' } });
              if (r.ok) items = parseGoogleNewsRss(await r.text(), 15); else dbg[t] = 'google ' + r.status;
            } catch (e) { dbg[t] = 'google ' + String(e).slice(0, 40); }
            if (!items.length) {
              try {
                const r2 = await fetch('https://www.bing.com/news/search?q=' + encodeURIComponent(q) + '&format=rss&setlang=ko&cc=KR', { headers: { 'User-Agent': UA, 'Accept-Language': 'ko-KR,ko;q=0.9' } });
                if (r2.ok) items = parseBingNewsRss(await r2.text(), 20).filter(it => !it.pubDate || Date.parse(it.pubDate) > Date.now() - 3 * 86400000); else dbg[t] = (dbg[t] || '') + ' bing ' + r2.status;
              } catch (e) { dbg[t] = (dbg[t] || '') + ' bing ' + String(e).slice(0, 40); }
            }
            const names = NAMES[t].map(s => s.toLowerCase());
            const okItem = it => { const ti = it.title.toLowerCase(); return names.some(n => ti.indexOf(n) >= 0) && (UP.test(it.title) || DOWN.test(it.title)); };
            const LOWQ = /Simply Wall St|TradingKey|Mitrade|BeInCrypto|MarketBeat|주식 움직였습니다/i;
            const hit = items.find(it => okItem(it) && !LOWQ.test((it.source || '') + ' ' + it.title)) || items.find(okItem);
            if (debug) dbg[t] = (dbg[t] || 'ok') + ' items=' + items.length + (hit ? ' hit' : ' nohit');
            if (hit) {
              const up = UP.test(hit.title), dn = DOWN.test(hit.title);
              data[t] = { title: hit.title, url: hit.url, source: hit.source, pubDate: hit.pubDate, dir: up && !dn ? 'up' : dn && !up ? 'down' : 'mix' };
            }
          });
          if (!debug && env.KR_KV && Object.keys(data).length) { try { await env.KR_KV.put(cacheKey, JSON.stringify(data), { expirationTtl: 3600 }); } catch (e) {} }
        }
        return new Response(JSON.stringify(debug ? { data, dbg } : data), { headers: { ...CORS, 'Content-Type': 'application/json' } });
      } catch (e) {
        return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });
      }
    }

    // 시총 TOP30 "실적 발표 D-day" — Yahoo quoteSummary calendarEvents(다음 실적 발표 예정일).
    // 30개를 한 번에 모아 KV에 6시간 캐시(요청 1회당 서브리퀘스트 수 절약). 날짜는 회사 확정 전 추정일일 수 있다.
    if (reqUrl.pathname === '/earnings') {
      const list = (reqUrl.searchParams.get('tickers') || '').toUpperCase().split(',').map(s => s.trim()).filter(s => /^[A-Z0-9.\-]{1,8}$/.test(s)).slice(0, 35);
      if (!list.length) return new Response(JSON.stringify({ error: 'tickers required' }), { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } });
      try {
        const cacheKey = 'earn-v1-' + list.slice().sort().join('_').slice(0, 400);
        let data = null;
        if (env.KR_KV) { try { const c = await env.KR_KV.get(cacheKey); if (c) data = JSON.parse(c); } catch (e) {} }
        if (!data) {
          data = {};
          const auth = await getYahooAuth();
          await Promise.all(list.map(async (t) => {
            try {
              let url = 'https://query1.finance.yahoo.com/v10/finance/quoteSummary/' + encodeURIComponent(t) + '?modules=calendarEvents';
              const headers = { 'User-Agent': UA };
              if (auth) { url += '&crumb=' + encodeURIComponent(auth.crumb); headers['Cookie'] = auth.cookie; }
              const r = await fetch(url, { headers });
              if (!r.ok) return;
              const j = await r.json();
              const ce = j && j.quoteSummary && j.quoteSummary.result && j.quoteSummary.result[0] && j.quoteSummary.result[0].calendarEvents;
              const ed = ce && ce.earnings && ce.earnings.earningsDate;
              const raws = (ed || []).map(x => (x && typeof x === 'object') ? x.raw : x).filter(x => typeof x === 'number');
              if (raws.length) data[t] = { ts: raws[0], ts2: raws.length > 1 ? raws[raws.length - 1] : null };
            } catch (e) {}
          }));
          if (env.KR_KV && Object.keys(data).length) { try { await env.KR_KV.put(cacheKey, JSON.stringify(data), { expirationTtl: 21600 }); } catch (e) {} }
        }
        return new Response(JSON.stringify(data), { headers: { ...CORS, 'Content-Type': 'application/json' } });
      } catch (e) {
        return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });
      }
    }

    if (reqUrl.pathname === '/etf-holdings') {
      const ticker = (reqUrl.searchParams.get('ticker') || '').toUpperCase().trim();
      if (!ticker) return new Response(JSON.stringify({ error: 'ticker required' }), { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } });
      try {
        const cacheKey = 'etf-holdings-v3-' + ticker;
        let data = null;
        if (env.KR_KV) {
          try {
            const cached = await env.KR_KV.get(cacheKey);
            if (cached) data = JSON.parse(cached);
          } catch (e) {}
        }
        if (!data) {
          data = await fetchEtfHoldingsOne(ticker, 2);
          if (env.KR_KV && data && data.holdings && data.holdings.length) {
            try { await env.KR_KV.put(cacheKey, JSON.stringify(data), { expirationTtl: 86400 }); } catch (e) {}
          }
        }
        return new Response(JSON.stringify(data), { headers: { ...CORS, 'Content-Type': 'application/json' } });
      } catch (e) {
        return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });
      }
    }

    // 한국지수 페이지 "투자자 동향" — 지수(KOSPI/KOSDAQ)별 당일 개인/외국인/기관 순매수(억원).
    // 장중 계속 바뀌는 값이라 KV 캐시는 짧게(3분)만 두고, 그 사이는 재사용한다.
    if (reqUrl.pathname === '/kr-investor-trend') {
      const market = (reqUrl.searchParams.get('market') || 'KOSPI').toUpperCase().trim();
      if (market !== 'KOSPI' && market !== 'KOSDAQ') {
        return new Response(JSON.stringify({ error: 'market must be KOSPI or KOSDAQ' }), { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } });
      }
      try {
        const cacheKey = 'kr-investor-trend-' + market;
        let data = null;
        if (env.KR_KV) {
          try {
            const cached = await env.KR_KV.get(cacheKey);
            if (cached) data = JSON.parse(cached);
          } catch (e) {}
        }
        if (!data) {
          data = await fetchKrInvestorTrend(market);
          if (env.KR_KV && data) {
            try { await env.KR_KV.put(cacheKey, JSON.stringify(data), { expirationTtl: 180 }); } catch (e) {}
          }
        }
        return new Response(JSON.stringify(data || {}), { headers: { ...CORS, 'Content-Type': 'application/json' } });
      } catch (e) {
        return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });
      }
    }

    // 한국지수 페이지 "투자자 동향" 기간별(1주/1개월/3개월) — 일별 개인/외국인/기관 순매수 이력.
    // 당일 값이 장중에 바뀌므로 KV에 10분만 캐시한다.
    if (reqUrl.pathname === '/kr-investor-history') {
      const market = (reqUrl.searchParams.get('market') || 'KOSPI').toUpperCase().trim();
      if (market !== 'KOSPI' && market !== 'KOSDAQ') {
        return new Response(JSON.stringify({ error: 'market must be KOSPI or KOSDAQ' }), { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } });
      }
      const size = Math.min(parseInt(reqUrl.searchParams.get('size') || '70', 10) || 70, 120);
      try {
        const cacheKey = 'kr-investor-history-' + market + '-' + size;
        let data = null;
        if (env.KR_KV) {
          try {
            const cached = await env.KR_KV.get(cacheKey);
            if (cached) data = JSON.parse(cached);
          } catch (e) {}
        }
        if (!data) {
          data = await fetchKrInvestorHistory(market, size);
          if (env.KR_KV && data && data.length) {
            try { await env.KR_KV.put(cacheKey, JSON.stringify(data), { expirationTtl: 600 }); } catch (e) {}
          }
        }
        return new Response(JSON.stringify(data || []), { headers: { ...CORS, 'Content-Type': 'application/json' } });
      } catch (e) {
        return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });
      }
    }

    // 한국지수 페이지 "증시자금동향" — 고객예탁금·신용잔고·주식형/혼합형/채권형 펀드 설정액
    // 추이(최근 size 영업일). 하루 한 번만 바뀌는 값이라 KV에 6시간 캐시한다.
    if (reqUrl.pathname === '/coin-global-trend') {
      // Npay 증권 가상화폐 "글로벌 마켓 트렌드"(공포·탐욕지수, 상승 자산 비중, 비트코인 도미넌스, 알트코인 시즌 지수)
      try {
        let data = null;
        if (env.KR_KV) {
          try { const cached = await env.KR_KV.get('coin-global-trend'); if (cached) data = JSON.parse(cached); } catch (e) {}
        }
        if (!data) {
          const r = await fetch('https://stock.naver.com/api/coin/globalMarketTrend', { headers: { 'User-Agent': UA, 'Accept': 'application/json' } });
          if (!r.ok) throw new Error('HTTP ' + r.status);
          data = await r.json();
          if (env.KR_KV && data && data.fearAndGreed) {
            try { await env.KR_KV.put('coin-global-trend', JSON.stringify(data), { expirationTtl: 300 }); } catch (e) {}
          }
        }
        return new Response(JSON.stringify(data || {}), { headers: { ...CORS, 'Content-Type': 'application/json' } });
      } catch (e) {
        return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });
      }
    }

    if (reqUrl.pathname === '/kr-market-deposit') {
      const size = Math.min(parseInt(reqUrl.searchParams.get('size') || '40', 10) || 40, 90);
      try {
        const cacheKey = 'kr-market-deposit-' + size;
        let data = null;
        if (env.KR_KV) {
          try {
            const cached = await env.KR_KV.get(cacheKey);
            if (cached) data = JSON.parse(cached);
          } catch (e) {}
        }
        if (!data) {
          data = await fetchKrMarketDeposit(size);
          if (env.KR_KV && data && data.length) {
            try { await env.KR_KV.put(cacheKey, JSON.stringify(data), { expirationTtl: 21600 }); } catch (e) {}
          }
        }
        return new Response(JSON.stringify(data || []), { headers: { ...CORS, 'Content-Type': 'application/json' } });
      } catch (e) {
        return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });
      }
    }

    // 미국지수 페이지 "유니콘 기업" 섹션 최근 뉴스. KV에 6시간 캐시, 만료 시 요청 처리 중 즉시 재집계.
    if (reqUrl.pathname === '/ipo-lockup') {
      const nm = (reqUrl.searchParams.get('name') || '').replace(/\(구\..*$/, '').replace(/\((유가|코넥스|코)\)\s*$/, '').trim();
      if (!nm) return new Response(JSON.stringify({ error: 'name required' }), { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } });
      try {
        const kk = 'ipo-lock-' + nm;
        let v = null;
        if (env.KR_KV) { try { const c = await env.KR_KV.get(kk); if (c) v = JSON.parse(c); } catch (e) {} }
        if (!v) {
          v = await enrichLockupSchedule(nm);
          if (v && env.KR_KV) { try { await env.KR_KV.put(kk, JSON.stringify(v), { expirationTtl: 604800 }); } catch (e) {} }
        }
        return new Response(JSON.stringify({ name: nm, schedule: v || null }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
      } catch (e) {
        return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });
      }
    }

    if (reqUrl.pathname === '/p2p-8percent') {
      try {
        let data = null;
        if (env.KR_KV && reqUrl.searchParams.get('refresh') !== '1') {
          try { const c = await env.KR_KV.get('p2p-eight-v3'); if (c) data = JSON.parse(c); } catch (e) {}
        }
        if (!data) data = await runP2pEightJob(env);
        return new Response(JSON.stringify(data), { headers: { ...CORS, 'Content-Type': 'application/json' } });
      } catch (e) {
        return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });
      }
    }

    if (reqUrl.pathname === '/fin-events' || reqUrl.pathname === '/card-top10') {
      const isEv = reqUrl.pathname === '/fin-events';
      const kvk = isEv ? 'fin-events-v1' : 'card-top10-v1';
      try {
        let data = null;
        const force = reqUrl.searchParams.get('refresh') === '1';
        if (env.KR_KV && !force) {
          try { const c = await env.KR_KV.get(kvk); if (c) data = JSON.parse(c); } catch (e) {}
        }
        if (data && isEv && data.byCat && !((data.byCat['증권']||[]).length + (data.byCat['은행']||[]).length + (data.byCat['카드']||[]).length)) data = null; // 예전에 캐시된 빈 결과는 무시하고 재수집
        if (reqUrl.searchParams.get('debug') === '1') data = null; // 진단 모드는 항상 새로 호출
        const rerun = () => isEv ? runFinEventsJob(env) : runCardTopJob(env, reqUrl.searchParams.get('debug') === '1');
        if (data) {
          // stale-while-revalidate: 6시간 넘은 캐시는 즉시 응답한 뒤 응답 뒤에서 갱신
          if (Date.now() - new Date(data.updated || 0).getTime() > 21600000 && ctx && ctx.waitUntil) ctx.waitUntil(rerun().catch(e => console.error('bg refresh failed', e)));
        } else {
          data = await rerun();
        }
        return new Response(JSON.stringify(data), { headers: { ...CORS, 'Content-Type': 'application/json' } });
      } catch (e) {
        return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });
      }
    }

    if (reqUrl.pathname === '/unicorn-news') {
      try {
        let data = null;
        if (env.KR_KV) {
          try {
            const cached = await env.KR_KV.get('unicorn-news-latest');
            if (cached) data = JSON.parse(cached);
          } catch (e) {}
        }
        if (!data) data = await runUnicornNewsJob(env);
        return new Response(JSON.stringify(data), { headers: { ...CORS, 'Content-Type': 'application/json' } });
      } catch (e) {
        return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });
      }
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

  /* 매일 1회(Cron Trigger) 실행 — 코스피·코스닥 전종목 당일 시세를 받아
     3번(주가 폭: 상승/하락 거래량)과 2번(주가 강도: 52주 신고가/신저가 종목수)을
     계산해 KV에 저장한다. 클라이언트는 이 결과를 /kr-breadth 로 읽어간다.
     [설정 필요] Worker 대시보드 → Settings → Variables → KV Namespace Bindings 에서
     이름 KR_KV 로 바인딩하고, Triggers → Cron Triggers 에 스케줄을 추가해야 동작합니다
     (예: '0 10 * * *' = 매일 UTC 10:00 = 한국시간 19:00, 장마감 이후). */
  async scheduled(event, env, ctx) {
    // 세 작업을 병렬로 실행하고, 하나가 실패해도 나머지 KV 캐시는 정상 갱신되도록 개별로 감싼다.
    // /ipo-list는 연간 신규상장 전체(약 50~60종목)를 상세조회하며 10~20초 이상 걸릴 수 있어,
    // 요청 시점에 처음 계산하게 두면 클라이언트가 타임아웃될 위험이 있다 — 그래서 Cron으로 미리 데워둔다.
    await Promise.all([
      runBreadthJob(env).catch(e => console.error('runBreadthJob failed', e)),
      runFinSavingsJob(env).catch(e => console.error('runFinSavingsJob failed', e)),
      runIpoListJob(env).catch(e => console.error('runIpoListJob failed', e)),
      runUsFundamentalsJob(env).catch(e => console.error('runUsFundamentalsJob failed', e)),
      runUnicornNewsJob(env).catch(e => console.error('runUnicornNewsJob failed', e)),
      runCardTopJob(env, false).catch(e => console.error('runCardTopJob failed', e)),
      runFinEventsJob(env).catch(e => console.error('runFinEventsJob failed', e))
    ]);
  }
};

/* scheduled()와 /kr-breadth-run-now(진단용 수동실행) 양쪽에서 공유하는 집계 로직.
   [주의] 2번(주가 강도)은 KV에 매일 종가를 계속 누적해가며 "지금까지 쌓인 기간 중"
   롤링 고가/저가로 판정한다 — 첫 실행 때는 하루치 데이터밖에 없어 모든 종목이
   고가이자 저가로 잡혀(52주 최고=최저=오늘 종가) strengthScore가 50 근처로 나오는 게
   정상이다. 진짜 52주 판정이 되려면 이 Cron이 ~252거래일(약 1년) 누적돼야 하며,
   그 전까지는 클라이언트에 daysAccumulated로 "N일 누적" 이라고 표시해 부정확함을 알린다. */
async function runBreadthJob(env) {
  const [kospi, kosdaq] = await Promise.all([
    fetchKrxRowsRecent('sto/stk_bydd_trd', 10),
    fetchKrxRowsRecent('sto/ksq_bydd_trd', 10) // 코스닥 서비스 미승인 시 null → 코스피만으로 계산
  ]);
  const kospiRows = kospi ? kospi.rows : null;
  const kosdaqRows = kosdaq ? kosdaq.rows : null;
  const basDd = (kospi && kospi.basDd) || fmtYmd(new Date());
  const allRows = [].concat(kospiRows || [], kosdaqRows || []);
  if (!allRows.length) return { skipped: true, reason: '최근 10일 내 KRX 집계 데이터를 찾지 못함(휴장/미승인/응답 실패)', basDd };

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

  const result = {
    date: basDd,
    breadth: { advVol, declVol, score: breadthScore },
    strength: { highs, lows, score: strengthScore, daysAccumulated, stockCount: counted },
    market: (kosdaqRows && kosdaqRows.length) ? 'KOSPI+KOSDAQ' : 'KOSPI만'
  };

  if (env.KR_KV) {
    await env.KR_KV.put(histKey, JSON.stringify(hist));
    await env.KR_KV.put('kr-breadth-latest', JSON.stringify(result));
    result.kvSaved = true;
  } else {
    result.kvSaved = false;
    result.warning = 'env.KR_KV 바인딩이 없어 저장하지 못했습니다 — Worker Settings에서 확인하세요.';
  }
  return result;
}


/* ===========================================================
   [보안·모니터링 래퍼] — 모든 응답에 공통 적용
   1) Origin 허용 목록: 목록 밖의 웹사이트가 이 Worker를 브라우저에서 호출하는 것을 막는다.
      (Origin 헤더가 없는 직접 접속·서버 호출은 막지 못한다 — 그 부분은 아래 요청 수 제한과 ALLOW 도메인 목록이 보완)
      다른 도메인에서도 사이트를 운영하면 ALLOWED_ORIGINS 에 추가한 뒤 재배포해야 한다.
   2) IP별 분당 요청 수 제한(Worker 인스턴스 단위 근사치) — 과다 호출 시 429
   3) /health : 최근 요청 수·오류 수·마지막 오류(인스턴스 단위) — 장애 확인용
   =========================================================== */
const ALLOWED_ORIGINS = [
  'https://coolzet-ai.github.io',
  'http://localhost', 'http://127.0.0.1',
  'null' // file:// 로 연 로컬 테스트 페이지
];
const RATE_LIMIT_PER_MIN = 240;
const _rate = new Map();
const _stat = { since: Date.now(), total: 0, blockedOrigin: 0, limited: 0, err5xx: 0, lastErrors: [] };
function originOk(o) {
  if (!o) return true;
  return ALLOWED_ORIGINS.some(a => o === a || o.startsWith(a + ':'));
}
function withCors(resp, origin) {
  const h = new Headers(resp.headers);
  if (origin) { h.set('Access-Control-Allow-Origin', origin); h.append('Vary', 'Origin'); }
  return new Response(resp.body, { status: resp.status, statusText: resp.statusText, headers: h });
}

/* 방문 통계 기록 — 하루 한 덩어리(JSON)에 횟수만 더한다. 개인 식별 정보(IP·UA·쿠키)는 저장하지 않는다. */
const EV_TYPES = { view: 1, fold: 1, tab: 1, link: 1, search: 1, alert: 1, theme: 1 };
let _evWrites = 0, _evDay = '';
async function recordEv(request, env) {
  if (!env.KR_KV) return;
  const raw = (await request.text()).slice(0, 2000);
  let j; try { j = JSON.parse(raw); } catch (e) { return; }
  const page = String(j.p || '').toLowerCase();
  if (!/^[a-z0-9-]{1,20}$/.test(page) || !Array.isArray(j.e)) return;
  const day = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
  if (_evDay !== day) { _evDay = day; _evWrites = 0; }
  if (++_evWrites > 700) return; // KV 무료 쓰기 한도(하루 1,000회) 보호
  const key = 'ev:' + day;
  let d = {}; try { const v = await env.KR_KV.get(key); if (v) d = JSON.parse(v); } catch (e) {}
  d.v = (d.v || 0) + 1; d.p = d.p || {}; d.p[page] = (d.p[page] || 0) + 1; d.c = d.c || {};
  j.e.slice(0, 12).forEach(x => {
    if (!Array.isArray(x) || !EV_TYPES[x[0]]) return;
    const lab = String(x[1] || '').replace(/[^\p{L}\p{N} ._·\-]/gu, '').slice(0, 40); if (!lab) return;
    const k = page + '|' + x[0] + '|' + lab;
    if (!(k in d.c) && Object.keys(d.c).length >= 250) return;
    d.c[k] = (d.c[k] || 0) + 1;
  });
  await env.KR_KV.put(key, JSON.stringify(d), { expirationTtl: 60 * 86400 });
}
async function guardedFetch(request, env, ctx) {
  const origin = request.headers.get('Origin') || '';
  const u = new URL(request.url);
  _stat.total++;
  if (!originOk(origin)) {
    _stat.blockedOrigin++;
    return new Response('origin not allowed', { status: 403 });
  }
  if (request.method === 'OPTIONS') {
    return withCors(new Response(null, { headers: { 'Access-Control-Allow-Methods': 'GET,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400' } }), origin);
  }
  const ip = request.headers.get('CF-Connecting-IP') || 'x';
  const minute = Math.floor(Date.now() / 60000);
  const rec = _rate.get(ip);
  if (!rec || rec.m !== minute) _rate.set(ip, { m: minute, n: 1 });
  else if (++rec.n > RATE_LIMIT_PER_MIN) {
    _stat.limited++;
    return withCors(new Response('rate limited', { status: 429, headers: { 'Retry-After': '30' } }), origin);
  }
  if (_rate.size > 5000) _rate.clear();
  if (u.pathname.replace(/\/{2,}/g, '/') === '/health') {
    return withCors(new Response(JSON.stringify({ ok: true, ..._stat, uptimeMin: Math.round((Date.now() - _stat.since) / 60000) }), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } }), origin);
  }
  /* /ev — 개인정보 없는 방문 통계(섹션 펼침·탭·검색 횟수만 하루 단위로 합산). /ev-stats?key=… 로 조회(STATS_KEY 시크릿 필요) */
  if (u.pathname.replace(/\/{2,}/g, '/') === '/ev' && request.method === 'POST') {
    try { await recordEv(request, env); } catch (e) {}
    return withCors(new Response(null, { status: 204 }), origin);
  }
  if (u.pathname.replace(/\/{2,}/g, '/') === '/ev-stats') {
    const okKey = env.STATS_KEY && u.searchParams.get('key') === env.STATS_KEY;
    if (!okKey) return withCors(new Response('forbidden', { status: 403 }), origin);
    const days = Math.min(30, Math.max(1, parseInt(u.searchParams.get('days') || '14', 10) || 14));
    const out = {};
    for (let i = 0; i < days; i++) {
      const d = new Date(Date.now() + 9 * 3600e3 - i * 86400e3).toISOString().slice(0, 10);
      try { const v = env.KR_KV && await env.KR_KV.get('ev:' + d); if (v) out[d] = JSON.parse(v); } catch (e) {}
    }
    return withCors(new Response(JSON.stringify(out), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } }), origin);
  }
  /* /yq?symbols=AAPL,MSFT,...&range=1y — Yahoo 일봉 종가를 여러 종목 한 번에(최대 30종목) 반환.
     브라우저가 종목마다 따로 요청하던 것을 1회로 묶어 요청 수를 줄인다. 종목별 5분 캐시. */
  if (u.pathname.replace(/\/{2,}/g, '/') === '/yq') {
    const rng = /^(1d|5d|1mo|3mo|6mo|1y|2y|5y|10y|ytd|max)$/.test(u.searchParams.get('range') || '') ? u.searchParams.get('range') : '1y';
    const syms = [...new Set((u.searchParams.get('symbols') || '').split(',').map(x => x.trim().toUpperCase()).filter(x => /^[A-Z0-9.^=\-]{1,15}$/.test(x)))].slice(0, 30);
    if (!syms.length) return withCors(new Response(JSON.stringify({ error: 'symbols required' }), { status: 400, headers: { 'Content-Type': 'application/json' } }), origin);
    const out = {};
    await Promise.all(syms.map(async sym => {
      const ck = new Request('https://cache.local/yq-v2/' + encodeURIComponent(sym) + '/' + rng);
      try {
        const hit = await caches.default.match(ck);
        if (hit) { out[sym] = await hit.json(); return; }
        const r = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(sym) + '?range=' + rng + '&interval=1d', { headers: { 'User-Agent': UA, 'Accept': 'application/json' } });
        if (!r.ok) { out[sym] = null; return; }
        const j = await r.json();
        const r0 = j.chart.result[0], cl = (r0.indicators.quote[0].close || []).slice(), ts0 = r0.timestamp || [], mt = r0.meta || {}, n0 = cl.length;
        if (n0 && cl[n0 - 1] == null && mt.regularMarketPrice != null && ts0[n0 - 1] && mt.regularMarketTime >= ts0[n0 - 1]) cl[n0 - 1] = mt.regularMarketPrice; /* 마감 직후 마지막 봉 null 보정 */
        const arr = cl.filter(x => x != null);
        out[sym] = arr.length ? arr : null;
        if (out[sym]) ctx.waitUntil(caches.default.put(ck, new Response(JSON.stringify(out[sym]), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'max-age=300' } })));
      } catch (e) { out[sym] = null; }
    }));
    return withCors(new Response(JSON.stringify(out), { headers: { 'Content-Type': 'application/json' } }), origin);
  }
  /* 시간외(장전·장후) 시세 — Yahoo chart(1분봉, includePrePost)에서 마지막 장전/장후 봉을 골라
     정규장 종가 대비 등락률을 계산한다. 정규장 중이거나 시간외 봉이 없으면 null(추정하지 않음). 60초 캐시. */
  if (u.pathname.replace(/\/{2,}/g, '/') === '/ext') {
    const syms = [...new Set((u.searchParams.get('symbols') || '').split(',').map(x => x.trim().toUpperCase()).filter(x => /^[A-Z0-9.\-]{1,10}$/.test(x) && !/\.(KS|KQ)$/.test(x)))].slice(0, 30);
    if (!syms.length) return withCors(new Response(JSON.stringify({ error: 'symbols required' }), { status: 400, headers: { 'Content-Type': 'application/json' } }), origin);
    const out = {};
    await Promise.all(syms.map(async sym => {
      const ck = new Request('https://cache.local/ext-v1/' + encodeURIComponent(sym));
      try {
        const hit = await caches.default.match(ck);
        if (hit) { out[sym] = await hit.json(); return; }
        const r = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(sym) + '?range=1d&interval=1m&includePrePost=true', { headers: { 'User-Agent': UA, 'Accept': 'application/json' } });
        if (!r.ok) { out[sym] = null; return; }
        const j = await r.json();
        const r0 = j.chart.result[0], mt = r0.meta || {}, ts = r0.timestamp || [], cl = (r0.indicators.quote[0].close || []);
        const ctp = mt.currentTradingPeriod || {}, pre = ctp.pre, reg = ctp.regular, post = ctp.post;
        let res = null, i = cl.length - 1;
        while (i >= 0 && cl[i] == null) i--;
        if (i >= 0 && mt.regularMarketPrice) {
          const t = ts[i], px = cl[i];
          let st = null;
          if (post && t >= post.start && t <= post.end) st = 'post';
          else if (pre && t >= pre.start && t < pre.end) st = 'pre';
          if (st && Math.abs(px / mt.regularMarketPrice - 1) < 0.5) res = { st, px: Math.round(px * 10000) / 10000, base: mt.regularMarketPrice, pct: Math.round((px / mt.regularMarketPrice - 1) * 10000) / 100, t };
        }
        if (!res) { /* 지금이 장전/장후 세션인데 체결 봉이 아직 없는 종목(거래 적은 ETF 등) — 빈칸 대신 '체결 없음'으로 표시 */
          const ns = Math.floor(Date.now() / 1000);
          if (pre && ns >= pre.start && ns < pre.end) res = { st: 'pre', none: true, px: null, base: mt.regularMarketPrice || null, pct: null, t: ns };
          else if (post && ns >= post.start && ns <= post.end) res = { st: 'post', none: true, px: null, base: mt.regularMarketPrice || null, pct: null, t: ns };
        }
        out[sym] = res;
        ctx.waitUntil(caches.default.put(ck, new Response(JSON.stringify(res), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'max-age=60' } })));
      } catch (e) { out[sym] = null; }
    }));
    return withCors(new Response(JSON.stringify(out), { headers: { 'Content-Type': 'application/json' } }), origin);
  }
  /* 소셜 언급(미국주식) — StockTwits 종목별 최신 30개 글에서 강세/약세 태그 비율·글 속도·대표 글을 계산한다.
     trend=1 이면 StockTwits 트렌딩 심볼 순위(_trend)도 함께 준다. 10분 캐시. */
  if (u.pathname.replace(/\/{2,}/g, '/') === '/social') {
    const syms = [...new Set((u.searchParams.get('tickers') || '').split(',').map(x => x.trim().toUpperCase()).filter(x => /^[A-Z0-9.\-]{1,10}$/.test(x) && !/\.(KS|KQ)$/.test(x)))].slice(0, 20);
    if (!syms.length) return withCors(new Response(JSON.stringify({ error: 'tickers required' }), { status: 400, headers: { 'Content-Type': 'application/json' } }), origin);
    const out = {};
    await Promise.all(syms.map(async sym => {
      const ck = new Request('https://cache.local/social-v1/' + encodeURIComponent(sym));
      try {
        const hit = await caches.default.match(ck);
        if (hit) { out[sym] = await hit.json(); return; }
        const r = await fetch('https://api.stocktwits.com/api/2/streams/symbol/' + encodeURIComponent(sym.replace('-', '.')) + '.json', { headers: { 'User-Agent': UA, 'Accept': 'application/json' } });
        if (!r.ok) { out[sym] = null; return; }
        const j = await r.json();
        const ms = j.messages || [];
        if (!ms.length) { out[sym] = null; return; }
        let bull = 0, bear = 0;
        ms.forEach(m => { const s = m.entities && m.entities.sentiment && m.entities.sentiment.basic; if (s === 'Bullish') bull++; else if (s === 'Bearish') bear++; });
        const t0 = Date.parse(ms[0].created_at), t1 = Date.parse(ms[ms.length - 1].created_at);
        const spanH = Math.max(0.05, (t0 - t1) / 3600000);
        let best = ms[0]; ms.forEach(m => { const l = (m.likes && m.likes.total) || 0, bl = (best.likes && best.likes.total) || 0; if (l > bl) best = m; });
        const res = { n: ms.length, bull, bear, rate: Math.round(Math.min(999, ms.length / spanH) * 10) / 10, watch: (j.symbol && j.symbol.watchlist_count) || null, last: ms[0].created_at,
          top: { body: String(best.body || '').replace(/\s+/g, ' ').slice(0, 140), user: best.user && best.user.username, url: best.user ? 'https://stocktwits.com/' + best.user.username + '/message/' + best.id : null, likes: (best.likes && best.likes.total) || 0, at: best.created_at } };
        out[sym] = res;
        ctx.waitUntil(caches.default.put(ck, new Response(JSON.stringify(res), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'max-age=600' } })));
      } catch (e) { out[sym] = null; }
    }));
    if (u.searchParams.get('trend') === '1') {
      try {
        const r = await fetch('https://api.stocktwits.com/api/2/trending/symbols.json', { headers: { 'User-Agent': UA, 'Accept': 'application/json' } });
        if (r.ok) { const j = await r.json(); out._trend = (j.symbols || []).map(s => s.symbol); }
      } catch (e) {}
    }
    return withCors(new Response(JSON.stringify(out), { headers: { 'Content-Type': 'application/json' } }), origin);
  }
  /* 소셜 언급 — Reddit(r/wallstreetbets·stocks·investing·StockMarket 인기글) 티커 언급 횟수 + 대표 글.
     Reddit이 서버 IP를 막으면 _status:'blocked' 로만 응답한다(추정 금지). 15분 캐시. */
  if (u.pathname.replace(/\/{2,}/g, '/') === '/social-reddit') {
    const syms = [...new Set((u.searchParams.get('tickers') || '').split(',').map(x => x.trim().toUpperCase()).filter(x => /^[A-Z0-9.\-]{1,10}$/.test(x) && !/\.(KS|KQ)$/.test(x)))].slice(0, 80);
    if (!syms.length) return withCors(new Response(JSON.stringify({ error: 'tickers required' }), { status: 400, headers: { 'Content-Type': 'application/json' } }), origin);
    const ck = new Request('https://cache.local/social-reddit-v1');
    let posts = null;
    try { const hit = await caches.default.match(ck); if (hit) posts = await hit.json(); } catch (e) {}
    if (!posts) {
      posts = [];
      await Promise.all(['wallstreetbets', 'stocks', 'investing', 'StockMarket'].map(async sub => {
        for (const host of ['www.reddit.com', 'old.reddit.com']) {
          try {
            const r = await fetch('https://' + host + '/r/' + sub + '/hot.json?limit=100&raw_json=1', { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MrKimSignal/1.0)', 'Accept': 'application/json' } });
            if (!r.ok) continue;
            const j = await r.json();
            ((j.data && j.data.children) || []).forEach(c => { const d = c.data || {}; if (d.title) posts.push({ t: d.title, s: d.score || 0, u: 'https://www.reddit.com' + d.permalink, r: sub, c: d.created_utc }); });
            return;
          } catch (e) {}
        }
      }));
      if (posts.length) ctx.waitUntil(caches.default.put(ck, new Response(JSON.stringify(posts), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'max-age=900' } })));
    }
    if (!posts.length) return withCors(new Response(JSON.stringify({ _status: 'blocked' }), { headers: { 'Content-Type': 'application/json' } }), origin);
    const ALIAS = { NVDA: ['nvidia'], AAPL: ['apple'], GOOGL: ['alphabet', 'google'], GOOG: ['alphabet', 'google'], MSFT: ['microsoft'], AMZN: ['amazon'], TSM: ['tsmc'], AVGO: ['broadcom'], META: ['facebook', 'meta platforms'], TSLA: ['tesla'], MU: ['micron'], 'BRK-B': ['berkshire'], AMD: ['advanced micro'], LLY: ['eli lilly'], JPM: ['jpmorgan'], WMT: ['walmart'], V: ['visa inc'], XOM: ['exxon'], INTC: ['intel'], JNJ: ['johnson & johnson'], MA: ['mastercard'], ABBV: ['abbvie'], CSCO: ['cisco'], BAC: ['bank of america'], AMAT: ['applied materials'], COST: ['costco'], CAT: ['caterpillar'], CVX: ['chevron'], UNH: ['unitedhealth'], LRCX: ['lam research'], SPCX: ['spacex'] };
    const NEED_DOLLAR = new Set(['V', 'MA', 'MU', 'CAT', 'COST', 'META', 'TAP', 'POOL', 'FLEX', 'ROM', 'RAM', 'USD', 'FAS', 'BE', 'TER', 'EA', 'AMD', 'ALL']);
    const out = { _status: 'ok', _posts: posts.length };
    syms.forEach(t => {
      const tk = t.replace('-', '.'), needD = tk.length <= 2 || NEED_DOLLAR.has(tk);
      const re = new RegExp('(^|[^A-Za-z0-9$])' + (needD ? '\\$' : '\\$?') + tk.replace('.', '[.\\-]') + '(?![A-Za-z0-9])');
      const al = (ALIAS[t] || []);
      let cnt = 0, best = null;
      posts.forEach(p => { const lo = p.t.toLowerCase(); if (re.test(p.t) || al.some(a => lo.indexOf(a) >= 0)) { cnt++; if (!best || p.s > best.s) best = p; } });
      out[t] = { c: cnt, top: best ? { title: best.t.slice(0, 140), url: best.u, score: best.s, sub: best.r } : null };
    });
    return withCors(new Response(JSON.stringify(out), { headers: { 'Content-Type': 'application/json' } }), origin);
  }
  /* 배당락일·배당률 — Yahoo quoteSummary(summaryDetail+calendarEvents). 배당률은 (연 배당금 ÷ 전일 종가)로 계산해
     단위 혼동(%/소수)을 피하고, 없으면 trailingAnnualDividendYield(소수)를 쓴다. 6시간 캐시. */
  if (u.pathname.replace(/\/{2,}/g, '/') === '/divs') {
    const syms = [...new Set((u.searchParams.get('symbols') || '').split(',').map(x => x.trim().toUpperCase()).filter(x => /^[A-Z0-9.\-]{1,10}$/.test(x) && !/\.(KS|KQ)$/.test(x)))].slice(0, 25);
    if (!syms.length) return withCors(new Response(JSON.stringify({ error: 'symbols required' }), { status: 400, headers: { 'Content-Type': 'application/json' } }), origin);
    const out = {};
    const auth = await getYahooAuth();
    const raw = v => (v && typeof v === 'object' && 'raw' in v) ? v.raw : (typeof v === 'number' ? v : null);
    await Promise.all(syms.map(async sym => {
      const ck = new Request('https://cache.local/divs-v1/' + encodeURIComponent(sym));
      try {
        const hit = await caches.default.match(ck);
        if (hit) { out[sym] = await hit.json(); return; }
        let url = 'https://query1.finance.yahoo.com/v10/finance/quoteSummary/' + encodeURIComponent(sym) + '?modules=summaryDetail,calendarEvents';
        const headers = { 'User-Agent': UA, 'Accept': 'application/json' };
        if (auth) { url += '&crumb=' + encodeURIComponent(auth.crumb); headers['Cookie'] = auth.cookie; }
        const r = await fetch(url, { headers });
        if (!r.ok) { out[sym] = null; return; }
        const j = await r.json();
        const res0 = j && j.quoteSummary && j.quoteSummary.result && j.quoteSummary.result[0];
        if (!res0) { out[sym] = null; return; }
        const sd = res0.summaryDetail || {}, ce = res0.calendarEvents || {};
        const rate = raw(sd.dividendRate) != null ? raw(sd.dividendRate) : raw(sd.trailingAnnualDividendRate);
        const pc = raw(sd.previousClose);
        let y = (rate != null && pc) ? rate / pc : null;
        if (y == null) { const ty = raw(sd.trailingAnnualDividendYield); if (ty != null) y = ty; }
        const ex = raw(ce.exDividendDate) != null ? raw(ce.exDividendDate) : raw(sd.exDividendDate);
        const pay = raw(ce.dividendDate);
        const res = (y || ex) ? { ex: ex || null, pay: pay || null, rate: rate, y: y != null ? Math.round(y * 100000) / 100000 : null } : null;
        out[sym] = res;
        ctx.waitUntil(caches.default.put(ck, new Response(JSON.stringify(res), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'max-age=21600' } })));
      } catch (e) { out[sym] = null; }
    }));
    return withCors(new Response(JSON.stringify(out), { headers: { 'Content-Type': 'application/json' } }), origin);
  }
  let resp;
  try { resp = await handler.fetch(request, env, ctx); }
  catch (e) {
    _stat.err5xx++; _stat.lastErrors.push({ t: new Date().toISOString(), path: u.pathname, msg: String(e).slice(0, 160) }); if (_stat.lastErrors.length > 8) _stat.lastErrors.shift();
    ctx.waitUntil(sendAlert(env, 'err:' + u.pathname, '⚠ Worker 오류 ' + u.pathname + ' — ' + String(e).slice(0, 120)));
    return withCors(new Response(JSON.stringify({ error: 'internal error' }), { status: 500, headers: { 'Content-Type': 'application/json' } }), origin);
  }
  if (resp.status >= 500) {
    _stat.err5xx++; _stat.lastErrors.push({ t: new Date().toISOString(), path: u.pathname, msg: 'HTTP ' + resp.status }); if (_stat.lastErrors.length > 8) _stat.lastErrors.shift();
    ctx.waitUntil(sendAlert(env, 'http:' + u.pathname, '⚠ Worker 응답 오류 HTTP ' + resp.status + ' ' + u.pathname));
  }
  return withCors(resp, origin);
}
/* ===========================================================
   [장애 알림] — 텔레그램 또는 웹훅(디스코드·슬랙)으로 알려준다. 설정(Worker → Settings → Variables and Secrets):
     방법 A) TG_BOT_TOKEN + TG_CHAT_ID           (텔레그램 봇)
     방법 B) ALERT_WEBHOOK = 웹훅 URL            (디스코드/슬랙 호환 JSON 전송)
   같은 종류의 알림은 30분에 1번만 보낸다(KV 바인딩 KR_KV가 있을 때 정확, 없으면 인스턴스 메모리 기준).
   설정이 없으면 아무것도 하지 않는다(안전). 추가로 Cron Trigger 에 '30분마다'(0,30분 주기, 표기: 별표 슬래시30 별표 별표 별표 별표) 를 하나 더 등록하면
   30분마다 Yahoo·CNN·TradingView 응답을 점검해 이상이 있을 때 알려준다.
   =========================================================== */
const _alertMem = new Map();
async function sendAlert(env, key, text) {
  try {
    if (!(env.ALERT_WEBHOOK || (env.TG_BOT_TOKEN && env.TG_CHAT_ID))) return;
    const now = Date.now(), k = 'alert-' + key;
    let last = _alertMem.get(k) || 0;
    if (env.KR_KV) { try { last = Math.max(last, parseInt(await env.KR_KV.get(k) || '0', 10)); } catch (e) {} }
    if (now - last < 30 * 60 * 1000) return;
    _alertMem.set(k, now);
    if (env.KR_KV) { try { await env.KR_KV.put(k, String(now), { expirationTtl: 3600 }); } catch (e) {} }
    const msg = '[Mr.Kim Signal] ' + text;
    if (env.TG_BOT_TOKEN && env.TG_CHAT_ID) {
      await fetch('https://api.telegram.org/bot' + env.TG_BOT_TOKEN + '/sendMessage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: env.TG_CHAT_ID, text: msg }) });
    } else {
      await fetch(env.ALERT_WEBHOOK, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: msg, text: msg }) });
    }
  } catch (e) { /* 알림 실패는 무시 */ }
}
async function healthProbe(env) {
  const checks = [
    ['Yahoo', 'https://query1.finance.yahoo.com/v8/finance/chart/SPY?range=5d&interval=1d', { 'User-Agent': UA }],
    ['CNN', 'https://production.dataviz.cnn.io/index/fearandgreed/graphdata', { 'User-Agent': UA, 'Origin': 'https://edition.cnn.com', 'Referer': 'https://edition.cnn.com/' }]
  ];
  for (const [nm, url, hd] of checks) {
    try {
      const r = await fetch(url, { headers: hd });
      if (!r.ok) await sendAlert(env, 'probe-' + nm, '⚠ ' + nm + ' 데이터 응답 이상 (HTTP ' + r.status + ') — 대시보드 일부가 비어 보일 수 있습니다.');
    } catch (e) { await sendAlert(env, 'probe-' + nm, '⚠ ' + nm + ' 데이터 연결 실패 — ' + String(e).slice(0, 80)); }
  }
}
export default {
  fetch: guardedFetch,
  scheduled: (event, env, ctx) => {
    if (event && event.cron && /^\*\/\d+ \* \* \* \*$/.test(event.cron)) return healthProbe(env); // 점검 전용 Cron(30분마다 등)
    return handler.scheduled(event, env, ctx);
  }
};
