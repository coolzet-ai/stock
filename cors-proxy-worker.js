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
  'data-dbg.krx.co.kr'
];

/* KRX Open API 인증키 — AUTH_KEY 는 HTTP 헤더로만 전달 가능해 클라이언트 JS에서는
   직접 호출이 안 됩니다(CORS도 열려있지 않음). 이 Worker 안에만 보관해 페이지
   소스에는 절대 노출되지 않습니다. */
const KRX_AUTH_KEY = 'D18554D94CDB4AE9870672CE9BA98C560004BDB7';

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
     (예: '0 8 * * *' = 매일 UTC 08:00 = 한국시간 17:00, 장마감 이후). */
  async scheduled(event, env, ctx) {
    const today = new Date();
    const basDd = fmtYmd(today);

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
