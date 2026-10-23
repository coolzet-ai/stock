/* csp-bridge.js — 인라인 on*="함수(인자)" 속성을 eval 없이 처리하는 이벤트 위임기.
   CSP에서 'unsafe-inline'을 빼도 기존 마크업(onclick="toggleFinancials('005930',event)" 등)이 그대로 동작하게 한다.
   허용 문법: 전역 함수·this 경로 호출, 인자는 문자열·숫자·true/false/null·event·this(.경로)만. 그 밖의 식은 실행하지 않는다. */
(function () {
  'use strict';
  function splitTop(s, sep) {
    var out = [], cur = '', q = '', dep = 0;
    for (var i = 0; i < s.length; i++) {
      var c = s[i];
      if (q) { cur += c; if (c === '\\') { cur += s[++i] || ''; } else if (c === q) q = ''; continue; }
      if (c === "'" || c === '"') { q = c; cur += c; continue; }
      if (c === '(' || c === '[' || c === '{') dep++; else if (c === ')' || c === ']' || c === '}') dep--;
      if (c === sep && dep === 0) { out.push(cur); cur = ''; continue; }
      cur += c;
    }
    if (cur.trim()) out.push(cur);
    return out;
  }
  function path(p, self) {
    var seg = p.split('.'), obj, par = null, i = 0;
    if (seg[0] === 'this') { obj = self; i = 1; } else { obj = window; par = window; }
    for (; i < seg.length; i++) {
      if (/^(constructor|__proto__|prototype|eval|Function)$/.test(seg[i])) return null;
      par = obj; obj = obj == null ? undefined : obj[seg[i]];
    }
    return { v: obj, p: par };
  }
  function arg(a, self, ev) {
    a = a.trim();
    var m;
    if ((m = /^'((?:[^'\\]|\\.)*)'$/.exec(a)) || (m = /^"((?:[^"\\]|\\.)*)"$/.exec(a))) return { ok: true, v: m[1].replace(/\\(.)/g, '$1') };
    if (/^-?\d+(\.\d+)?$/.test(a)) return { ok: true, v: Number(a) };
    if (a === 'true') return { ok: true, v: true }; if (a === 'false') return { ok: true, v: false };
    if (a === 'null') return { ok: true, v: null }; if (a === 'undefined') return { ok: true, v: undefined };
    if (a === 'event') return { ok: true, v: ev };
    if (/^this(\.[A-Za-z_$][\w$]*)*$/.test(a)) { var r = path(a, self); return r ? { ok: true, v: r.v } : { ok: false }; }
    return { ok: false };
  }
  function run(code, self, ev) {
    var stm = splitTop(code, ';');
    for (var i = 0; i < stm.length; i++) {
      var m = /^\s*((?:this|[A-Za-z_$][\w$]*)(?:\.[A-Za-z_$][\w$]*)*)\s*\(([\s\S]*)\)\s*$/.exec(stm[i]);
      if (!m) { if (window.console) console.warn('[csp-bridge] 지원하지 않는 핸들러:', stm[i].slice(0, 80)); return false; }
      var f = path(m[1], self); if (!f || typeof f.v !== 'function') { if (window.console) console.warn('[csp-bridge] 함수를 찾지 못함:', m[1]); return false; }
      var args = [], parts = m[2].trim() ? splitTop(m[2], ',') : [], ok = true;
      for (var k = 0; k < parts.length; k++) { var r = arg(parts[k], self, ev); if (!r.ok) { ok = false; break; } args.push(r.v); }
      if (!ok) { if (window.console) console.warn('[csp-bridge] 지원하지 않는 인자:', m[2].slice(0, 80)); return false; }
      f.v.apply(f.p, args);
    }
    return true;
  }
  function onBubble(type) {
    document.addEventListener(type, function (ev) {
      var el = ev.target && ev.target.nodeType === 1 ? ev.target : ev.target && ev.target.parentElement;
      while (el && el !== document) {
        var code = el.getAttribute && el.getAttribute('on' + type);
        if (code) {
          var done = run(code, el, ev);
          if (done && el.tagName === 'A') ev.preventDefault();
          if (ev.cancelBubble) return;
        }
        el = el.parentElement;
      }
    });
  }
  onBubble('click'); onBubble('change');
  document.addEventListener('error', function (ev) {
    var el = ev.target; if (!el || el.nodeType !== 1) return;
    var code = el.getAttribute && el.getAttribute('onerror'); if (code) run(code, el, ev);
  }, true);
  /* 이미 로드 완료된 이미지의 onerror 누락 방지는 하지 않음(오류 시점에 리스너가 있어야 하므로 이 파일은 <head>에서 동기 로드) */
})();
