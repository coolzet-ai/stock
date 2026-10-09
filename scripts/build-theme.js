/* 다크 모드 · 미국식 색(상승=초록/하락=빨강) 오버라이드 CSS 자동 생성
   사용: NODE_PATH=<postcss가 설치된 node_modules> node scripts/build-theme.js
   입력: mrkim-pro.css, stock.html·kr-stock.html 의 <style> 블록
   출력: mrkim-theme.css  (html[data-theme="dark"] / html[data-cv="us"] 아래에서만 적용되므로 기본 화면은 그대로) */
const fs = require('fs'), path = require('path'), postcss = require('postcss');
const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

/* ── 색 변환 도구 ── */
function parseColor(s) {
  s = s.trim();
  let m = s.match(/^#([0-9a-f]{3,8})$/i);
  if (m) {
    let h = m[1];
    if (h.length === 3 || h.length === 4) h = h.split('').map(c => c + c).join('');
    const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
    const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
    return { r, g, b, a };
  }
  m = s.match(/^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)(?:[\s,/]+([\d.]+%?))?\s*\)$/i);
  if (m) { let a = 1; if (m[4] != null) a = m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]); return { r: +m[1], g: +m[2], b: +m[3], a }; }
  return null;
}
function rgb2hsl({ r, g, b }) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let h = 0, s = 0; const l = (mx + mn) / 2;
  if (mx !== mn) { const d = mx - mn; s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn);
    h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h /= 6; }
  return { h, s, l };
}
function hsl2rgb({ h, s, l }) {
  const f = (p, q, t) => { if (t < 0) t += 1; if (t > 1) t -= 1; if (t < 1 / 6) return p + (q - p) * 6 * t; if (t < .5) return q; if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6; return p; };
  let r, g, b;
  if (s === 0) r = g = b = l; else { const q = l < .5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q; r = f(p, q, h + 1 / 3); g = f(p, q, h); b = f(p, q, h - 1 / 3); }
  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
}
function fmt(c, a) {
  const h = n => n.toString(16).padStart(2, '0');
  return a < 1 ? `rgba(${c.r},${c.g},${c.b},${+a.toFixed(3)})` : '#' + h(c.r) + h(c.g) + h(c.b);
}
const COLOR_RE = /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)/g;
const mapColors = (val, fn) => val.replace(COLOR_RE, tok => { const c = parseColor(tok); if (!c) return tok; const o = fn(c); return o || tok; });

/* 배경: 밝은 면은 어둡게(색조는 유지), 어둡거나 진한 색(초록 띠·검정 헤더)은 그대로 */
function bgMap(c) {
  const { h, s, l } = rgb2hsl(c);
  if (l < .55) return null;
  const nl = .075 + (1 - l) * .55;
  const neutral = s < .12;
  return fmt(hsl2rgb({ h: neutral ? .58 : h, s: neutral ? .16 : Math.min(s, .45) * (s > .5 ? .8 : 1), l: nl }), c.a);
}
/* 글자: 어두운 글자는 밝게, 이미 밝은 글자(흰색 등)는 그대로 */
function textMap(c) {
  const { h, s, l } = rgb2hsl(c);
  if (l > .55) return null;
  const nl = s > .45 ? Math.min(.9, .93 - l * .45) : Math.min(.93, 1 - l * .78);
  return fmt(hsl2rgb({ h: s < .12 ? .58 : h, s: s < .12 ? .12 : (s > .45 ? s * .72 : s), l: nl }), c.a);
}
function borderMap(c) {
  const { h, s, l } = rgb2hsl(c);
  if (l < .6) return null;
  return fmt(hsl2rgb({ h: s < .12 ? .58 : h, s: s < .12 ? .14 : Math.min(s, .3), l: .12 + (1 - l) * .7 }), c.a);
}
const DARK_PROP = [
  [/^background(-color|-image)?$/, bgMap],
  [/^(color|fill|stroke|caret-color|text-decoration-color|-webkit-text-fill-color)$/, textMap],
  [/^(border|outline)(-(top|right|bottom|left))?(-color)?$/, borderMap],
];

/* 미국식 색(상승=초록, 하락=빨강): 상승/하락을 뜻하는 선택자에 쓰인 리터럴 색만 교체 */
const UPDN_SEL = /(\.|#|^|\s)(up|down|dn|wl-bar|ch|chg|pct|hm-chg|pt)\b|\.up\b|\.down\b/;
const RED = /^(#?(d92d20|b42318|c42318|c82014|c8281b|ef4444|dc2626|ff4d4f))$/i, BLUE = /^(#?(1d4ed8|1a6fa8|2563eb|3b82f6|2f6fed|4d8dff))$/i;
function swapUpDn(val) {
  return val.replace(COLOR_RE, tok => {
    const k = tok.replace('#', '').toLowerCase();
    if (RED.test(k)) return '#067647';
    if (BLUE.test(k)) return '#C4281B';
    return tok;
  });
}

const out = { dark: [], us: [] }, seen = new Set();
function prefixSel(sel, pre) {
  return sel.split(',').map(x => {
    x = x.trim();
    if (!x) return '';
    if (x === ':root' || x === 'html') return pre;
    if (/^body\b/.test(x)) return pre + ' ' + x;
    if (/^html\b/.test(x)) return x.replace(/^html/, pre);
    return pre + ' ' + x;
  }).filter(Boolean).join(',');
}
function atPath(rule) { const p = []; let n = rule.parent; while (n && n.type !== 'root') { if (n.type === 'atrule') p.unshift(`@${n.name} ${n.params}`); n = n.parent; } return p; }

function process(css, label) {
  let root;
  try { root = postcss.parse(css); } catch (e) { console.warn('parse 실패', label, e.message); return; }
  root.walkRules(rule => {
    if (rule.parent && rule.parent.type === 'atrule' && /keyframes|font-face/.test(rule.parent.name)) return;
    const dark = [], us = [];
    rule.walkDecls(d => {
      if (d.parent !== rule) return;
      if (/^--/.test(d.prop)) return;
      const imp = d.important ? ' !important' : '';
      for (const [re, fn] of DARK_PROP) {
        if (re.test(d.prop) && COLOR_RE.test(d.value)) { COLOR_RE.lastIndex = 0;
          const nv = mapColors(d.value, fn); if (nv !== d.value) dark.push(`${d.prop}:${nv}${imp}`); break; }
        COLOR_RE.lastIndex = 0;
      }
      if (UPDN_SEL.test(rule.selector) && /^(color|background(-color)?|border(-[a-z]+)*|fill|stroke)$/.test(d.prop)) {
        const nv = swapUpDn(d.value); if (nv !== d.value) us.push(`${d.prop}:${nv}${imp}`);
      }
    });
    const emit = (list, key, pre) => {
      if (!list.length) return;
      const body = `${prefixSel(rule.selector, pre)}{${list.join(';')}}`;
      const at = atPath(rule); const full = at.length ? at.reduceRight((acc, a) => `${a}{${acc}}`, body) : body;
      const id = key + full; if (seen.has(id)) return; seen.add(id); out[key].push({ at, body, full });
    };
    emit(dark, 'dark', 'html[data-theme="dark"]');
    emit(us, 'us', 'html[data-cv="us"]');
  });
}

process(read('mrkim-pro.css'), 'mrkim-pro.css');
for (const f of ['stock.html', 'kr-stock.html', 'bond.html', 'crypto.html', 'fx.html', 'ipo.html', 'p2p.html', 'finprod.html', 'trade.html', 'index.html', 'mrkim-signal.html']) {
  const html = read(f);
  let m, re = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  while ((m = re.exec(html))) process(m[1], f);
}

/* 같은 @media 묶음은 합쳐서 출력 */
function group(list) {
  const plain = [], media = new Map();
  list.forEach(x => { if (!x.at.length) plain.push(x.body); else { const k = x.at.join('|'); if (!media.has(k)) media.set(k, { at: x.at, rules: [] }); media.get(k).rules.push(x.body); } });
  let s = plain.join('\n');
  media.forEach(v => { s += '\n' + v.at.reduceRight((acc, a) => `${a}{${acc}}`, v.rules.join('\n')); });
  return s;
}

const BASE = `/* mrkim-theme.css — 자동 생성(scripts/build-theme.js). 직접 고치지 말고 아래 '수동 보정' 구역만 수정하세요. */
/* ===== 기본 변수 ===== */
html[data-theme="dark"]{color-scheme:dark}
html[data-theme="dark"] body.pro{--bg:#0D1115;--panel:#151A20;--panel2:#1A2027;--line:#2A323B;--tx:#E6E9ED;--tx2:#A9B2BD;--up:#FF7A6E;--down:#7FA6FF;--gold:#E3B341;background:var(--bg);color:var(--tx)}
html[data-cv="us"] body.pro{--up:#067647;--down:#C4281B}
html[data-theme="dark"][data-cv="us"] body.pro{--up:#4ADE9C;--down:#FF7A6E}
`;
const MANUAL = fs.existsSync(path.join(ROOT, 'mrkim-theme.manual.css')) ? fs.readFileSync(path.join(ROOT, 'mrkim-theme.manual.css'), 'utf8') : '';
const css = BASE + '\n/* ===== 다크 모드 자동 변환 ===== */\n' + group(out.dark) + '\n/* ===== 미국식 색(상승=초록·하락=빨강) ===== */\n' + group(out.us) + '\n/* ===== 수동 보정 ===== */\n' + MANUAL;
fs.writeFileSync(path.join(ROOT, 'mrkim-theme.css'), css);
console.log('mrkim-theme.css', css.length, 'bytes · 다크 규칙', out.dark.length, '· 미국색 규칙', out.us.length);
