/* D*Find 공통: 로그인 확인, 왼쪽 메뉴, 글자 크기, 조회 막대, 화면 조각 만들기
   - 수집 데이터는 항상 textContent 로 넣음 (innerHTML 금지)
   - 실제 권한은 DB(RLS·함수)가 막음. 화면 숨김은 편의 */
(function () {
  'use strict';
  var C = window.DFIND_CONFIG || {};
  var D = (window.D = {});
  D.root = ''; // 화면(html)은 모두 pages/ 한 폴더에 있어 서로 같은 폴더 주소로 연결
  D.sb = C.SUPABASE_URL && C.SUPABASE_ANON_KEY && window.supabase
    ? window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY, { auth: { persistSession: true, detectSessionInUrl: true } })
    : null;

  // ---- 화면 조각 ----------------------------------------------------------
  D.h = function (tag, attrs) {
    var el = document.createElement(tag);
    var a = attrs || {};
    Object.keys(a).forEach(function (k) {
      var v = a[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = String(v);
      else if (k.indexOf('on') === 0 && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'value') el.value = v;
      else if (k === 'checked') el.checked = !!v;
      else el.setAttribute(k, v === true ? '' : String(v));
    });
    for (var i = 2; i < arguments.length; i++) add(el, arguments[i]);
    return el;
  };
  /* 내용 바꾸기 (배열도 펼쳐서) */
  D.set = function (el) {
    el.replaceChildren();
    for (var i = 1; i < arguments.length; i++) add(el, arguments[i]);
    return el;
  };
  function add(el, kid) {
    if (kid === null || kid === undefined || kid === false) return;
    if (Array.isArray(kid)) { kid.forEach(function (k) { add(el, k); }); return; }
    el.appendChild(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  D.svg = function (d, size) {
    var ns = 'http://www.w3.org/2000/svg';
    var s = document.createElementNS(ns, 'svg');
    s.setAttribute('width', size || 24); s.setAttribute('height', size || 24); s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', '2');
    s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round'); s.setAttribute('aria-hidden', 'true');
    var p = document.createElementNS(ns, 'path'); p.setAttribute('d', d); s.appendChild(p);
    return s;
  };
  D.width = function (el, pct) { el.style.width = Math.max(0, Math.min(100, pct)) + '%'; return el; };
  D.clean = function (s) { // 네이버 제목의 <b>·&quot; 같은 표시를 글자로 (스크립트는 실행되지 않음)
    if (!s) return '';
    return new DOMParser().parseFromString(String(s), 'text/html').body.textContent || '';
  };
  D.empty = function (msg) { return D.h('p', { class: 'empty', text: msg || '해당 기간에 정보가 없습니다.' }); };
  D.loading = function () { return D.h('p', { class: 'loading', text: '불러오는 중…' }); };
  D.fail = function (err) {
    var msg = (err && (err.message || err.error_description)) || String(err);
    if (/function .* does not exist|Could not find the function/i.test(msg)) {
      msg = 'DB 업데이트가 필요합니다. Supabase SQL Editor 에서 migrations/20261124_dashboard.sql 을 실행해 주세요.';
    }
    console.error(err);
    return D.h('p', { class: 'notice error', role: 'alert', text: '불러오지 못했습니다: ' + msg });
  };

  // ---- 날짜 (모두 한국 시간 기준 YYYY-MM-DD 문자열) ------------------------
  var WD = '일월화수목금토';
  D.today = function () { return new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10); };
  D.addDays = function (s, n) { var d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  D.fmt = function (s) {
    if (!s) return '';
    var d = new Date(String(s).slice(0, 10) + 'T00:00:00Z');
    return (d.getUTCMonth() + 1) + '/' + d.getUTCDate() + '(' + WD[d.getUTCDay()] + ')';
  };
  D.fmtLong = function (s) {
    var d = new Date(s + 'T00:00:00Z');
    return d.getUTCFullYear() + '년 ' + (d.getUTCMonth() + 1) + '월 ' + d.getUTCDate() + '일 (' + WD[d.getUTCDay()] + ')';
  };
  D.fmtTime = function (ts) {
    if (!ts) return '';
    var d = new Date(new Date(ts).getTime() + 9 * 3600e3);
    return (d.getUTCMonth() + 1) + '/' + d.getUTCDate() + ' ' + String(d.getUTCHours()).padStart(2, '0') + ':' + String(d.getUTCMinutes()).padStart(2, '0');
  };
  D.isNew = function (ts) { return ts && Date.now() - new Date(ts).getTime() < 24 * 3600e3; };
  D.num = function (n) { return Number(n || 0).toLocaleString('ko-KR'); };

  // ---- 분류 --------------------------------------------------------------
  D.CAT = {
    permit: { label: '인허가·제도', page: 'regulatory.html' },
    market: { label: '시장·투자', page: 'market.html' },
    research: { label: '연구·과제', page: 'research.html' },
    disclosure: { label: '공시', page: 'disclosure.html' }
  };
  D.badge = function (text, cls) { return D.h('span', { class: 'badge ' + (cls || 'gray'), text: text }); };
  D.catBadge = function (cat, text) { return D.badge(text || (D.CAT[cat] || {}).label || cat, 'cat-' + cat); };
  D.companyHref = function (id) { return D.root + 'company.html?id=' + encodeURIComponent(id); };
  D.companyLink = function (id, name) {
    if (!name) return null;
    return id ? D.h('a', { class: 'company-link', href: D.companyHref(id), text: name }) : D.h('b', { text: name });
  };
  /* 정보 한 줄 (dash_feed 행) */
  D.feedItem = function (f, opts) {
    var o = opts || {};
    var title = f.url
      ? D.h('a', { class: 'list-title', href: f.url, target: '_blank', rel: 'noopener noreferrer', text: D.clean(f.title) || '(제목 없음)' })
      : D.h('span', { class: 'list-title', text: D.clean(f.title) || '(제목 없음)' });
    return D.h('div', { class: 'list-item' },
      D.h('div', { class: 'list-meta' },
        D.catBadge(f.category, o.kindOnly ? f.kind : f.kind),
        D.isNew(f.collected_at) ? D.badge('NEW', 'new') : null,
        D.companyLink(f.company_id, f.company_name),
        D.h('span', { text: [D.fmt(f.item_date), f.source_label].filter(Boolean).join(' · ') })),
      title,
      f.detail && !o.noDetail ? D.h('span', { class: 'list-detail', text: D.clean(f.detail).slice(0, 220) }) : null);
  };

  // ---- 데이터 ------------------------------------------------------------
  D.rpc = async function (name, args) {
    var r = await D.sb.rpc(name, args || {});
    if (r.error) throw r.error;
    return r.data;
  };
  D.q = async function (builder) {
    var r = await builder;
    if (r.error) throw r.error;
    return r.data;
  };

  // ---- 왼쪽 메뉴 ----------------------------------------------------------
  var I = {
    sum: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z', radar: 'M12 3a9 9 0 1 0 9 9M12 7a5 5 0 1 0 5 5M12 12l6-6',
    comp: 'M4 21V5l8-2v18M12 9h8v12M7 8h2M7 12h2M7 16h2M15 13h2M15 17h2', permit: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l2 2 4-4',
    market: 'M3 17l6-6 4 4 8-8M15 7h6v6', research: 'M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3',
    disc: 'M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h7', mail: 'M3 6h18v12H3zM3 6l9 7 9-7', status: 'M12 7v5l3 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18',
    users: 'M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6M22 19v-1a4 4 0 0 0-3-3.9M16 4.1a3 3 0 0 1 0 5.8',
    gear: 'M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1M15 4v4M9 10v4M17 16v4', log: 'M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01'
  };
  var MENU = [
    { label: '요약', items: [['summary', 'SUMMARY', 'index.html', I.sum]] },
    { label: '기업', items: [['radar', '기업 레이더', 'radar.html', I.radar], ['company', '기업 정보', 'company.html', I.comp]] },
    { label: '분야별 정보', items: [['regulatory', '인허가·제도', 'regulatory.html', I.permit], ['market', '시장·투자 동향', 'market.html', I.market],
      ['research', '연구·과제', 'research.html', I.research], ['disclosure', '공시', 'disclosure.html', I.disc]] },
    { label: '기록·운영', items: [['mail', '메일 리포트', 'mail.html', I.mail, '준비 중'], ['status', '수집 현황', 'status.html', I.status, '준비 중']] },
    { label: '관리자', admin: true, items: [['recipients', '메일 수신자', 'admin-recipients.html', I.users],
      ['settings', '기준 정보', 'admin-settings.html', I.gear], ['logs', '로그 관리', 'admin-logs.html', I.log]] }
  ];

  function renderNav(active, role) {
    var nav = document.getElementById('side');
    if (!nav) return;
    var kids = [D.h('a', { class: 'brand', href: D.root + 'index.html' },
      D.h('span', { class: 'brand-mark', text: 'D*' }), D.h('span', null, D.h('b', { text: 'D*Find' }), D.h('small', { text: '디지털헬스 기업 발굴' })))];
    MENU.forEach(function (g) {
      if (g.admin && role !== 'admin') return;
      kids.push(D.h('div', { class: 'menu-group' }, D.h('span', { class: 'menu-label', text: g.label }),
        g.items.map(function (m) {
          return D.h('a', { class: 'menu-item', href: D.root + m[2], 'aria-current': m[0] === active ? 'page' : null },
            D.svg(m[3]), m[1], m[4] && m[0] !== active ? D.h('span', { class: 'menu-tag', text: m[4] }) : null);
        })));
    });
    var foot = D.h('div', { class: 'side-foot' }, D.h('span', { text: '마지막 수집' }), D.h('b', { id: 'last-crawl', text: '확인 중…' }),
      D.h('span', { id: 'crawl-health' }),
      D.h('button', { type: 'button', class: 'side-btn', id: 'font-toggle', onclick: toggleFont }),
      D.user ? D.h('span', { text: D.user.email }) : null,
      D.user ? D.h('button', { type: 'button', class: 'side-btn', text: '로그아웃', onclick: logout }) : null);
    kids.push(foot);
    D.set(nav, kids);
    setFontLabel();
  }
  async function loadCrawlHealth() {
    try {
      var rows = await D.q(D.sb.from('v_crawl_latest').select('source_system,status,completed_at'));
      var last = rows.map(function (r) { return r.completed_at; }).filter(Boolean).sort().pop();
      var bad = {};
      var all = {};
      rows.forEach(function (r) { all[r.source_system] = 1; if (['failed', 'structure_error', 'auth_error'].indexOf(r.status) >= 0) bad[r.source_system] = 1; });
      var nAll = Object.keys(all).length, nBad = Object.keys(bad).length;
      document.getElementById('last-crawl').textContent = last ? D.fmtTime(last) : '기록 없음';
      var hl = document.getElementById('crawl-health');
      hl.textContent = nAll ? (nAll - nBad) + '곳 정상' + (nBad ? ' · 점검 필요 ' + nBad + '곳' : '') : '';
      hl.className = nBad ? 'bad' : 'ok';
    } catch (e) { document.getElementById('last-crawl').textContent = '확인 못 함'; }
  }

  // ---- 글자 크기 ----------------------------------------------------------
  function bigOn() { try { return localStorage.getItem('dfind-big') === '1'; } catch (e) { return false; } }
  function applyFont() { document.documentElement.classList.toggle('big', bigOn()); }
  function setFontLabel() { var b = document.getElementById('font-toggle'); if (b) b.textContent = bigOn() ? '글자 보통으로' : '글자 크게'; }
  function toggleFont() { try { localStorage.setItem('dfind-big', bigOn() ? '0' : '1'); } catch (e) { /* 저장 안 돼도 이번 화면만 */ } applyFont(); setFontLabel(); }
  applyFont();

  async function logout() { await D.sb.auth.signOut(); location.href = D.root + 'login.html'; }

  // ---- 시작: 로그인·권한 확인 ---------------------------------------------
  D.boot = async function (page, opts) {
    var o = opts || {};
    var main = document.getElementById('main');
    if (!D.sb) {
      renderNav(page, null);
      D.set(main, D.h('p', { class: 'notice error', text: '설정이 비어 있습니다. assets/js/config.js 에 Supabase 주소와 anon 키를 넣어 주세요.' }));
      return null;
    }
    var s = (await D.sb.auth.getSession()).data.session;
    if (!s) { location.replace(D.root + 'login.html'); return null; }
    D.user = s.user;
    var roleRow = null;
    try { roleRow = await D.q(D.sb.from('user_roles').select('role').eq('user_id', s.user.id).maybeSingle()); } catch (e) { roleRow = null; }
    D.role = roleRow && roleRow.role;
    renderNav(page, D.role);
    if (!D.role) {
      D.set(main, D.h('p', { class: 'notice error', text: '이 계정에는 아직 권한이 없습니다. 관리자에게 권한을 요청해 주세요. (' + s.user.email + ')' }));
      return null;
    }
    if (o.admin && D.role !== 'admin') {
      D.set(main, D.h('p', { class: 'notice error', text: '관리자만 쓸 수 있는 화면입니다.' }));
      return null;
    }
    loadCrawlHealth();
    return main;
  };

  // ---- 조회 막대: 오늘 · 최근 7일 · 최근 30일 · 날짜 지정 · 기간 지정 --------
  // 고른 값은 주소(?per=7, ?day=…, ?from=…&to=…)에 남아 새로고침·공유해도 유지됨
  D.periodBar = function (opts) {
    var o = opts || {};
    var p = new URLSearchParams(location.search);
    var TODAY = D.today();
    var st = { per: p.get('per') || o.defaultPer || '7', day: p.get('day') || TODAY, from: p.get('from') || D.addDays(TODAY, -6), to: p.get('to') || TODAY };
    var el = D.h('section', { class: 'period', 'aria-label': '날짜·기간 선택' });
    function range() {
      if (st.per === 'day') return { from: st.day, to: st.day };
      if (st.per === 'range') return st.from <= st.to ? { from: st.from, to: st.to } : { from: st.to, to: st.from };
      return { from: D.addDays(TODAY, -(Number(st.per) - 1)), to: TODAY };
    }
    function save() {
      var q = new URLSearchParams(location.search);
      ['per', 'day', 'from', 'to'].forEach(function (k) { q.delete(k); });
      q.set('per', st.per);
      if (st.per === 'day') q.set('day', st.day);
      if (st.per === 'range') { q.set('from', st.from); q.set('to', st.to); }
      history.replaceState(null, '', '?' + q.toString());
    }
    function fire() { save(); draw(); var r = range(); r.per = st.per; o.onChange(r); }
    function draw() {
      var r = range();
      var presets = [['1', '오늘'], ['7', '최근 7일'], ['30', '최근 30일'], ['day', '날짜 지정'], ['range', '기간 지정']];
      var kids = [D.h('b', { text: '조회' }),
        D.h('div', { class: 'group', role: 'group', 'aria-label': '빠른 선택' }, presets.map(function (x) {
          return D.h('button', { type: 'button', class: 'btn', 'aria-pressed': st.per === x[0] ? 'true' : 'false', text: x[1],
            onclick: function () { st.per = x[0]; fire(); } });
        }))];
      if (st.per === 'day') {
        kids.push(D.h('div', { class: 'group' },
          D.h('button', { type: 'button', class: 'icon-btn', 'aria-label': '하루 전', onclick: function () { st.day = D.addDays(st.day, -1); fire(); } }, D.svg('M15 5l-7 7 7 7')),
          D.h('label', { class: 'field inline' }, '날짜', D.h('input', { type: 'date', value: st.day, max: TODAY,
            onchange: function (e) { if (e.target.value) { st.day = e.target.value > TODAY ? TODAY : e.target.value; fire(); } } })),
          D.h('button', { type: 'button', class: 'icon-btn', 'aria-label': '하루 뒤', disabled: st.day >= TODAY,
            onclick: function () { if (st.day < TODAY) { st.day = D.addDays(st.day, 1); fire(); } } }, D.svg('M9 5l7 7-7 7'))));
      }
      if (st.per === 'range') {
        kids.push(D.h('div', { class: 'group' },
          D.h('label', { class: 'field inline' }, '시작일', D.h('input', { type: 'date', value: st.from, max: TODAY,
            onchange: function (e) { if (e.target.value) { st.from = e.target.value; fire(); } } })),
          D.h('span', { 'aria-hidden': 'true', text: '~' }),
          D.h('label', { class: 'field inline' }, '종료일', D.h('input', { type: 'date', value: st.to, max: TODAY,
            onchange: function (e) { if (e.target.value) { st.to = e.target.value > TODAY ? TODAY : e.target.value; fire(); } } }))));
      }
      kids.push(D.h('span', { class: 'range', text: r.from === r.to ? D.fmt(r.to) : D.fmt(r.from) + ' ~ ' + D.fmt(r.to) }));
      D.set(el, kids);
    }
    el.start = function () { fire(); };
    el.range = range;
    draw();
    return el;
  };

  // ---- 화면 위쪽 제목 ------------------------------------------------------
  D.header = function (title, sub, opts) {
    var o = opts || {};
    return D.h('header', { class: 'top' },
      D.h('div', { class: 'grow' },
        D.h('h1', { class: 'title' }, o.dot ? D.h('span', { class: 'dot ' + o.dot }) : null, title, o.admin ? D.h('span', { class: 'admin-tag', text: '관리자 전용' }) : null),
        sub ? D.h('p', { class: 'sub', text: sub }) : null),
      o.right || null);
  };
})();
