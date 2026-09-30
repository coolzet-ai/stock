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
  'finlife.fss.or.kr' // 금융상품한눈에 오픈API(예금·적금 금리비교) — 인증키 발급 후 사용
];

/* OpenDART(전자공시) 인증키 — ECOS와 같은 방식(URL 쿼리파라미터)이지만, 페이지 소스에
   노출되지 않도록 이 Worker가 서버 쪽에서 자동으로 붙여준다(클라이언트는 crtfc_key 없이 요청). */
const DART_KEY = 'd16159a7a9745b083f68a60efb56fc745097261b';

/* DART corpCode.xml 은 종목코드→고유번호(corp_code) 전체 목록을 zip 압축 파일로 준다.
   [주의] 이 zip 파싱 코드는 실제 파일로 직접 검증하지 못했다(테스트 환경에서 라이브 호출이
   안 됨) — 표준 단일 파일 zip(로컬 파일 헤더 뒤 압축 데이터) 구조를 가정한 최선의 구현이다.
   문제가 있으면 Worker 로그(Cloudflare 대시보드 → Logs)에서 에러 메시지를 확인해달라고
   안내해야 한다. KV에 24시간 캐시해 매번 다시 받지 않는다. */
async function getDartCorpMap(env) {
  const cacheKey = 'dart-corp-map-v1';
  if (env.KR_KV) {
    try {
      const cached = await env.KR_KV.get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch (e) {}
  }
  const resp = await fetch('https://opendart.fss.or.kr/api/corpCode.xml?crtfc_key=' + DART_KEY);
  if (!resp.ok) throw new Error('corpCode.xml 요청 실패: HTTP ' + resp.status);
  const buf = new Uint8Array(await resp.arrayBuffer());
  if (buf.length < 30 || (buf[0]!==0x50 || buf[1]!==0x4b || buf[2]!==0x03 || buf[3]!==0x04)) {
    throw new Error('corpCode.xml 응답이 예상한 zip 형식이 아님(인증키 오류 등의 에러 메시지일 수 있음): ' +
      new TextDecoder('utf-8').decode(buf.slice(0, 300)));
  }
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const compMethod = view.getUint16(8, true);
  const compSize = view.getUint32(18, true);
  const nameLen = view.getUint16(26, true);
  const extraLen = view.getUint16(28, true);
  const dataStart = 30 + nameLen + extraLen;
  const compData = buf.slice(dataStart, dataStart + compSize);
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
  const re = /<corp_code>\s*(\d+)\s*<\/corp_code>\s*<corp_name>([^<]*)<\/corp_name>\s*<stock_code>\s*([^<]*?)\s*<\/stock_code>/g;
  let m;
  while ((m = re.exec(xmlText))) {
    const stockCode = m[3].trim();
    if (stockCode) map[stockCode] = m[1];
  }
  if (env.KR_KV) {
    try { await env.KR_KV.put(cacheKey, JSON.stringify(map), { expirationTtl: 86400 }); } catch (e) {}
  }
  return map;
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

async function fetchFinlifePages(path, grp) {
  let page = 1, maxPage = 1, base = [], opt = [];
  do {
    const url = 'https://finlife.fss.or.kr/finlifeapi/' + path + '.json?auth=' + FSS_SAVINGS_KEY +
      '&topFinGrpNo=' + grp + '&pageNo=' + page;
    const r = await fetch(url);
    if (!r.ok) break;
    const j = await r.json();
    const res = j.result || {};
    maxPage = res.max_page_no || 1;
    base = base.concat(res.baseList || []);
    opt = opt.concat(res.optionList || []);
    page++;
  } while (page <= maxPage && page <= 10); // 무한루프 방지 안전장치
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
  for (const g of FSS_GROUPS) {
    const { base, opt } = await fetchFinlifePages(path, g.code);
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
  if (env.KR_KV) {
    try { await env.KR_KV.put('fin-savings-latest', JSON.stringify(result), { expirationTtl: 21600 }); } catch (e) {}
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

async function fetchEucKr(url) {
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });
  if (!r.ok) return null;
  const buf = await r.arrayBuffer();
  try { return new TextDecoder('euc-kr').decode(buf); }
  catch (e) { return new TextDecoder('utf-8').decode(buf); }
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
   라벨이 <font>로 감싸져 있거나 &nbsp;가 붙는 두 가지 마크업 변형을 모두 흡수한다. */
function b38LabelValue(html, label) {
  const esc = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp('<td[^>]*>\\s*(?:<font[^>]*>)?\\s*' + esc + '\\s*(?:</font>)?\\s*(?:&nbsp;)?\\s*</td>\\s*<td[^>]*>([\\s\\S]*?)</td>');
  const m = html.match(re);
  return m ? ipoCellText(m[1]) : null;
}

async function fetch38Detail(no) {
  const html = await fetchEucKr(B38_BASE + '/html/fund/?o=v&no=' + no);
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
    listDateTxt: b38LabelValue(html, '신규상장일'),
    market: b38LabelValue(html, '시장구분')
  };
}

/* "868.64:1" → 868.64 / "332.82:1 (비례 666:1)" → 332.82 */
function parseRatioColon(txt) {
  if (!txt) return null;
  const m = txt.match(/([\d,.]+)\s*[:대]\s*1/);
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
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });
  if (!r.ok) return null;
  return await r.text(); // 실제로는 UTF-8로 서비스됨(메타태그 표기만 ks_c_5601로 틀림)
}

// 검색 결과에는 최근 조회된 다른 종목도 함께 섞여 나오므로, 이름이 정확히 일치하는 것만 쓴다
// (오탐으로 엉뚱한 종목의 유통비율을 가져오는 것을 막기 위한 안전장치).
async function ipostockSearchCode(name) {
  const html = await fetchIpostockText(IPOSTOCK_BASE + '/sub05/company01.asp?str2=' + encodeURIComponent(name));
  if (!html) return null;
  const re = /code=([A-Z0-9]+)&schk=\d"[^>]*><font[^>]*><b>([^<]+)<\/b>/g;
  let m;
  while ((m = re.exec(html))) {
    if (m[2].trim() === name.trim()) return m[1];
  }
  return null;
}

async function ipostockFloatRatio(code) {
  const html = await fetchIpostockText(IPOSTOCK_BASE + '/view_pg/view_02.asp?code=' + code + '&gmenu=');
  if (!html) return null;
  const fm = html.match(/유통가능\s*주식합계.*?<b>([\d,]+)\s*주/s);
  if (!fm) return null;
  const floatShares = parseFloat(fm[1].replace(/,/g, ''));
  const occs = [...html.matchAll(/발행주식수[^>]*<\/font>\s*<\/td>\s*<td[^>]*>([^<]+)<\/td>/g)];
  if (!occs.length) return null;
  const postShares = parseFloat((occs[occs.length - 1][1] || '').replace(/[^\d]/g, ''));
  if (!postShares) return null;
  return Math.round((floatShares / postShares) * 10000) / 100;
}

async function enrichFloatRatio(name) {
  try {
    const code = await ipostockSearchCode(name);
    if (!code) return null;
    return await ipostockFloatRatio(code);
  } catch (e) { return null; }
}

async function buildIpoList(env) {
  const mainHtml = await fetchEucKr(B38_BASE + '/html/ipo/');
  if (!mainHtml) return { updated: new Date().toISOString(), items: [], error: 'main page fetch failed' };

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
    c.stage = '신규상장';
  });

  const nos = Object.keys(byNo).slice(0, 25); // 안전장치: 상세조회 최대 25종목
  const details = await Promise.all(nos.map(no => fetch38Detail(no).catch(() => null)));

  const names = nos.map(no => (byNo[no].name || '').replace(/\(구\..*$/, '').trim() || byNo[no].name);
  const floatRatios = await Promise.all(names.map(nm => enrichFloatRatio(nm).catch(() => null)));

  const items = nos.map((no, i) => {
    const c = byNo[no];
    const d = details[i] || {};
    const rawName = c.name || '';
    const instRatio = parseRatioColon(d.instRatioTxt);
    // "확정공모가"가 "-"뿐이거나 기관경쟁률이 아직 없으면(수요예측 전) 의무보유확약도
    // 사이트가 기본값 "0.00%"로 표시해 실제 0%처럼 보이므로, 그 경우엔 null로 비워둔다.
    const offerFinalTxt = (d.offerFinalTxt && !/^-\s*원?$/.test(d.offerFinalTxt.trim())) ? d.offerFinalTxt : null;
    const lockupRatio = instRatio != null ? parsePercentTxt(d.lockupTxt) : null;
    return {
      no: no,
      name: names[i],
      market: d.market || null,
      stage: c.stage || null,
      predictDate: c.predictDate || null,
      subscDate: c.subscDate || null,
      listDate: d.listDateTxt || c.listDate || null,
      offerPriceBand: d.offerBandTxt || c.priceBand || null,
      offerPriceFinal: offerFinalTxt,
      instRatio: instRatio,
      lockupRatio: lockupRatio,
      floatRatio: floatRatios[i] != null ? floatRatios[i] : null, // 유통비율(%) — ipostock.co.kr 보강, 못 찾으면 null
      subRatioText: d.subRatioTxt || c.competRatioTxt || null,
      underwriter: d.underwriter || c.underwriterFromList || null,
      totalShares: d.totalSharesTxt || c.shares || null,
      parValue: d.parValueTxt || null,
      sourceUrl: B38_BASE + '/html/fund/?o=v&no=' + no
    };
  });

  return { updated: new Date().toISOString(), items: items };
}

async function runIpoListJob(env) {
  const result = await buildIpoList(env);
  if (env.KR_KV) {
    try { await env.KR_KV.put('ipo-list-latest', JSON.stringify(result), { expirationTtl: 21600 }); } catch (e) {}
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

    // 종목코드(005930) → DART 고유번호(corp_code) 자동 조회. DART가 주는 corpCode.xml(zip) 전체를
    // 받아 한 번 파싱해 KV에 캐시해두고, 이후에는 캐시에서 필요한 종목만 꺼내준다.
    if (reqUrl.pathname === '/dart-corp') {
      const codes = (reqUrl.searchParams.get('codes') || '').split(',').map(s => s.trim()).filter(Boolean);
      try {
        const map = await getDartCorpMap(env);
        const result = {};
        codes.forEach(c => { result[c] = map[c] || null; });
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
        if (!data) data = await runFinSavingsJob(env);
        return new Response(JSON.stringify(data), { headers: { ...CORS, 'Content-Type': 'application/json' } });
      } catch (e) {
        return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });
      }
    }

    // 공모주 페이지 — 38.co.kr IPO 캘린더. KV에 6시간 캐시, 만료 시 요청 처리 중 즉시 재집계.
    if (reqUrl.pathname === '/ipo-list') {
      try {
        let data = null;
        if (env.KR_KV) {
          try {
            const cached = await env.KR_KV.get('ipo-list-latest');
            if (cached) data = JSON.parse(cached);
          } catch (e) {}
        }
        if (!data) data = await runIpoListJob(env);
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
    await runBreadthJob(env);
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
