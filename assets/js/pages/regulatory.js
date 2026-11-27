/* 04 인허가·제도 (기획안 4-1 주간별 인허가)
   [주차 칩: 이번 주 앞뒤 4주 + 건수] [이전 주 · 주차 선택 · 다음 주 · 이번 주 | 기간 조회 | 검색어(본문·첨부까지)]
   [종류별 요약 칸] [종류 탭] [표: 날짜 · 종류 · 업체 · 내용 · 첨부 · 신규 · 원문] — 신규(마지막 수집 이후 들어온 것)는 줄 색으로 표시 */
(async function () {
  'use strict';
  var main = await D.boot('regulatory');
  if (!main) return;
  var h = D.h;
  var DAY = '일월화수목금토';
  // 종류 묶음 (요약 칸·탭)
  var GROUPS = [
    ['innov', '혁신의료기기 지정', ['혁신의료기기 지정']],
    ['permit', '허가·심사', ['디지털의료기기 허가', '신개발 의료기기 심사', '품목 허가']],
    ['neca', 'NECA 신의료기술·유예', ['신의료기술 평가', '평가 유예', '혁신의료기술 평가']],
    ['notice', '식약처·NECA 공지', ['식약처 공지', 'NECA 공지']],
    ['board', '디지털의료기기 정보방', ['디지털의료기기 정보방']]
  ];
  function groupOf(kind) { for (var i = 0; i < GROUPS.length; i++) if (GROUPS[i][2].indexOf(kind) >= 0) return GROUPS[i][0]; return 'etc'; }

  // ---- 날짜 도우미 (한국 날짜 문자열 YYYY-MM-DD 로만 계산) ----
  function dow(d) { return new Date(d + 'T12:00:00+09:00').getUTCDay(); }
  function monday(d) { return D.addDays(d, -((dow(d) + 6) % 7)); }
  function isoWeek(d) {
    var t = new Date(d + 'T00:00:00Z'), day = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - day);
    var y = t.getUTCFullYear();
    return { y: y, w: Math.ceil(((t - Date.UTC(y, 0, 1)) / 864e5 + 1) / 7) };
  }
  function weekStart(y, w) { var j4 = y + '-01-04'; return D.addDays(monday(j4), (w - 1) * 7); }
  function md(d) { return Number(d.slice(5, 7)) + '/' + d.slice(8); }

  var p = new URLSearchParams(location.search);
  var thisMon = monday(D.today());
  var ALL_FROM = '2000-01-01';
  // '전체 목록' 탭은 없앰 (처음부터 모두 보기는 전체 리스트 화면). 예전 주소 ?all=1 은 이번 주로
  var st = { from: p.get('from') || thisMon, to: p.get('to') || D.addDays(thisMon, 6), q: p.get('q') || '', group: p.get('g') || 'all', onlyNew: p.get('new') === '1' };
  function isAll() { return st.from === ALL_FROM; }
  var weekRows = [], rows = [], files = {};

  var label = h('span', { class: 'week-label' });
  var chips = h('div', { class: 'wk-row', role: 'group', 'aria-label': '주차 (이번 주부터 지난 8주)' });
  var pick = h('input', { type: 'week', class: 'input', id: 'wk-pick', 'aria-label': '주차 고르기', onchange: function () {
    var m = /^(\d{4})-W(\d{2})$/.exec(pick.value); if (m) setWeek(weekStart(+m[1], +m[2]));
  } });
  var from = h('input', { type: 'date', class: 'input', id: 'wk-from', 'aria-label': '시작일' });
  var to = h('input', { type: 'date', class: 'input', id: 'wk-to', 'aria-label': '종료일' });
  var q = h('input', { type: 'search', class: 'input grow', id: 'wk-q', placeholder: '업체·품목·제목·본문·첨부 내용', value: st.q,
    onkeydown: function (e) { if (e.key === 'Enter') { e.preventDefault(); st.q = q.value.trim(); load(); } } });
  var sum = h('section', { class: 'wk-sum', 'aria-label': '종류별 건수' });
  var tabs = h('div', { class: 'tabs wrap-tabs', role: 'tablist', 'aria-label': '종류' });
  var newChip = h('button', { type: 'button', class: 'chip', 'aria-pressed': st.onlyNew ? 'true' : 'false', onclick: function () { st.onlyNew = !st.onlyNew; newChip.setAttribute('aria-pressed', st.onlyNew ? 'true' : 'false'); save(); drawTable(); } });
  var table = h('div');
  var listCard = h('section', { class: 'card', 'aria-labelledby': 'wk-h' }, h('div', { class: 'card-head' }, h('h2', { id: 'wk-h', text: '목록' }), h('span', { class: 'right' }, newChip)), tabs, table);

  D.set(main,
    D.header('인허가·제도', '혁신의료기기 지정 · 식약처 허가 · NECA 신의료기술 · 공지를 주간 단위로 봅니다 (발표·허가일 기준)', { dot: 'dot-permit', right: h('div', { class: 'group' }, label, h('a', { class: 'btn', href: 'list.html?cat=permit', text: '전체 리스트 보기 →' })) }),
    h('div', { class: 'reg-layout' },
    // 왼쪽: 주차별 건수 (이번 주 앞뒤 4주, 누르면 그 주로)
    h('aside', { class: 'card wk-side', 'aria-labelledby': 'wk-side-h' }, h('h2', { id: 'wk-side-h', class: 'wk-side-h', text: '주차별 건수' }),
      h('p', { class: 'note', text: '이번 주부터 지난 주 순 · NEW = 새로 들어온 것' }), chips),
    h('div', { class: 'reg-main' },
    h('section', { class: 'card search-panel', 'aria-label': '주차·기간 조회' },
      h('div', { class: 'search-row' },
        h('button', { type: 'button', class: 'btn small', text: '◀ 이전 주', onclick: function () { setWeek(D.addDays(st.from, -7)); } }),
        pick,
        h('button', { type: 'button', class: 'btn small', text: '다음 주 ▶', onclick: function () { setWeek(D.addDays(st.from, 7)); } }),
        h('button', { type: 'button', class: 'btn small', text: '이번 주', onclick: function () { setWeek(thisMon); } }),
        h('span', { class: 'sep', 'aria-hidden': 'true', text: '|' }),
        h('label', { class: 'field inline', for: 'wk-from' }, '기간', from), h('span', { text: '~' }), to,
        h('button', { type: 'button', class: 'btn small', text: '기간 조회', onclick: function () {
          if (!from.value || !to.value) return;
          var a = from.value, b = to.value; if (a > b) { var t = a; a = b; b = t; }
          st.from = a; st.to = b; load();
        } })),
      h('div', { class: 'search-row' },
        h('label', { class: 'field grow', for: 'wk-q' }, '검색어 (고른 주·기간 안에서, 본문·첨부 내용까지)', q),
        h('div', { class: 'search-btns' },
          h('button', { type: 'button', class: 'btn primary', onclick: function () { st.q = q.value.trim(); load(); } }, D.svg('M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14M20 20l-4-4', 20), '검색'),
          h('button', { type: 'button', class: 'btn', text: '초기화', onclick: function () { q.value = ''; st.q = ''; st.group = 'all'; st.onlyNew = false; newChip.setAttribute('aria-pressed', 'false'); setWeek(thisMon); } })))),
    sum, listCard)));

  function save() {
    var u = new URLSearchParams();
    if (isAll()) u.set('all', '1');
    else if (st.from !== thisMon || st.to !== D.addDays(thisMon, 6)) { u.set('from', st.from); u.set('to', st.to); }
    if (st.q) u.set('q', st.q);
    if (st.group !== 'all') u.set('g', st.group);
    if (st.onlyNew) u.set('new', '1');
    history.replaceState(null, '', '?' + u.toString());
  }
  function setWeek(mon) { st.from = monday(mon); st.to = D.addDays(st.from, 6); load(); }
  function isWeek() { return st.to === D.addDays(st.from, 6) && dow(st.from) === 1; }

  // 주차 칩 건수: 이번 주 앞뒤 4주를 한 번에 받아 셈
  async function loadWeeks() {
    try { weekRows = await D.rpc('dash_feed', { p_from: D.addDays(thisMon, -56), p_to: D.addDays(thisMon, 6), p_category: 'permit', p_limit: 5000 }); }
    catch (e) { weekRows = []; }
    drawChips();
  }
  function drawChips() {
    D.set(chips, [0, -1, -2, -3, -4, -5, -6, -7, -8].map(function (k) {
      var a = D.addDays(thisMon, k * 7), b = D.addDays(a, 6), w = isoWeek(a);
      var inWeek = weekRows.filter(function (f) { return f.item_date >= a && f.item_date <= b; });
      var nNew = inWeek.filter(function (f) { return D.isNewItem(f); }).length;
      var on = st.from === a && st.to === b;
      return h('button', { type: 'button', class: 'wk' + (k === 0 ? ' now' : '') + (on ? ' on' : ''), 'aria-pressed': on ? 'true' : 'false', onclick: function () { setWeek(a); } },
        h('span', { class: 'wk-top' }, h('b', { text: (k === 0 ? '이번 주 · ' : '') + w.w + '주차' }), h('small', { text: md(a) + '–' + md(b) })),
        h('span', { class: 'wk-cnt' }, h('span', { class: 'wk-n', text: inWeek.length + '건' }), nNew ? h('span', { class: 'wk-new', text: 'NEW ' + nNew }) : null));
    }));
  }

  async function load() {
    save();
    var w = isoWeek(st.from);
    label.textContent = isAll() ? '전체 목록 (기간 상관없이)' : isWeek() ? w.y + '년 ' + w.w + '주차 · ' + md(st.from) + '(' + DAY[dow(st.from)] + ')–' + md(st.to) + '(' + DAY[dow(st.to)] + ')'
      : '기간 ' + st.from + ' ~ ' + st.to;
    if (isWeek()) pick.value = w.y + '-W' + String(w.w).padStart(2, '0');
    from.value = isAll() ? '' : st.from; to.value = isAll() ? '' : st.to;
    drawChips();
    D.set(sum, D.loading()); D.set(table, D.loading());
    try { rows = await D.rpc('dash_feed', { p_from: st.from, p_to: st.to, p_category: 'permit', p_limit: 5000, p_query: st.q || null }); }
    catch (e) { D.set(sum); D.set(table, D.fail(e)); return; }
    files = {};
    drawSum(); drawTable();
    files = await D.loadFiles(rows);
    if (Object.keys(files).length) drawTable();
  }
  function drawSum() {
    D.set(sum, GROUPS.map(function (g) {
      var list = rows.filter(function (f) { return groupOf(f.kind) === g[0]; });
      var nNew = list.filter(function (f) { return D.isNewItem(f); }).length;
      return h('button', { type: 'button', class: 'wk-box', 'aria-pressed': st.group === g[0] ? 'true' : 'false', onclick: function () { st.group = st.group === g[0] ? 'all' : g[0]; save(); drawTable(); drawSum(); } },
        h('span', { class: 'wk-box-label', text: g[1] }), h('b', { text: list.length }), nNew ? h('span', { class: 'badge new', text: '신규 ' + nNew }) : h('span', { class: 'note', text: '건' }));
    }));
  }
  function drawTable() {
    var nNewAll = rows.filter(function (f) { return D.isNewItem(f); }).length;
    newChip.textContent = '신규만 보기 (' + nNewAll + ')';
    D.set(tabs, [['all', '전체', rows.length]].concat(GROUPS.map(function (g) { return [g[0], g[1], rows.filter(function (f) { return groupOf(f.kind) === g[0]; }).length]; }))
      .map(function (t) {
        return h('button', { type: 'button', class: 'tab', role: 'tab', 'aria-selected': st.group === t[0] ? 'true' : 'false', onclick: function () { st.group = t[0]; save(); drawTable(); drawSum(); } },
          t[1], h('span', { class: 'badge gray', text: t[2] }));
      }));
    if (st.group === 'board') { D.set(table, boardPanel()); return; }
    var list = rows.filter(function (f) { return (st.group === 'all' || groupOf(f.kind) === st.group) && (!st.onlyNew || D.isNewItem(f)); });
    if (!isAll()) { D.set(table, feedTable(list)); return; }
    // 전체 목록: 건수가 많아 기본은 회사별로 묶어 보여 줌 (접힌 줄 = 회사 요약)
    var mode = h('div', { class: 'chips group-mode', role: 'group', 'aria-label': '전체 목록 보기' },
      [['company', '회사별로 묶기'], ['flat', '하나씩 보기']].map(function (m) {
        return h('button', { type: 'button', class: 'chip small', 'aria-pressed': st.allMode === m[0] ? 'true' : 'false', text: m[1],
          onclick: function () { st.allMode = m[0]; drawTable(); } });
      }));
    D.set(table, mode, st.allMode === 'flat' ? feedTable(list) : companyGroups(list));
  }
  st.allMode = 'company';
  var openCo = {};
  function companyGroups(list) {
    if (!list.length) return D.empty('인허가 소식이 없습니다.');
    var groups = {}, order = [];
    list.forEach(function (f) {
      var k = f.company_id ? 'c' + f.company_id : f.company_name ? 'n' + f.company_name : '_';
      if (!groups[k]) { groups[k] = { key: k, id: f.company_id, name: f.company_name || '기업 정보 없음 (공고·안내 등)', items: [] }; order.push(k); }
      groups[k].items.push(f);
    });
    order.sort(function (a, b) {
      if (a === '_') return 1; if (b === '_') return -1;
      return String(groups[b].items[0].item_date || '').localeCompare(String(groups[a].items[0].item_date || '')) || groups[b].items.length - groups[a].items.length;
    });
    var body = h('tbody');
    order.slice(0, st.coShown || 100).forEach(function (k) {
      var g = groups[k], op = !!openCo[k];
      var kinds = {}; g.items.forEach(function (f) { kinds[f.kind] = (kinds[f.kind] || 0) + 1; });
      var nNew = g.items.filter(D.isNewItem).length;
      var row = h('tr', { class: 'co-row' + (op ? ' open' : '') + (nNew ? ' is-new' : ''), tabindex: '0', 'aria-expanded': op ? 'true' : 'false',
        onclick: function (e) { if (e.target.closest('a')) return; openCo[k] = !op; drawTable(); },
        onkeydown: function (e) { if (e.key === 'Enter' && !e.target.closest('a')) { openCo[k] = !op; drawTable(); } } },
        h('td', null, h('span', { class: 'tri', 'aria-hidden': 'true', text: op ? '▾' : '▸' })),
        h('td', { class: 'nowrap' }, g.id ? D.companyLink(g.id, g.name) : h('b', { text: g.name })),
        h('td', { class: 'num-cell', text: g.items.length + '건' }),
        h('td', null, h('span', { class: 'chips tight' }, Object.keys(kinds).map(function (kd) { return h('span', { class: 'mini-kind' }, D.catBadge('permit', kd), ' ' + kinds[kd]); }))),
        h('td', { class: 'wrap' }, D.titleLink(g.items[0], 'list-title co-latest')),
        h('td', { class: 'nowrap', text: g.items[0].item_date || '–' }),
        h('td', null, nNew ? D.badge('NEW ' + nNew, 'new') : null));
      body.appendChild(row);
      if (op) body.appendChild(h('tr', { class: 'detail' }, h('td', { colspan: 7 }, feedTable(g.items))));
    });
    return [h('div', { class: 'table-wrap' }, h('table', { class: 'grid co-table' },
      h('thead', null, h('tr', null, ['', '회사', '건수', '종류', '가장 최근 소식', '최근 날짜', '신규'].map(function (x) { return h('th', { scope: 'col', text: x }); }))), body)),
      h('p', { class: 'note', text: '회사 ' + order.length + '곳 · ' + list.length + '건 · 가장 최근 소식이 있는 회사 순 · 줄을 누르면 그 회사의 인허가 목록' }),
      order.length > (st.coShown || 100) ? h('button', { type: 'button', class: 'btn more', text: '100곳 더 보기', onclick: function () { st.coShown = (st.coShown || 100) + 100; drawTable(); } }) : null];
  }
  function feedTable(list) {
    if (!list.length) return D.empty(st.q ? '"' + st.q + '" 이(가) 들어간 인허가 소식이 없습니다.' : '이 기간에는 인허가 소식이 없습니다.');
    // 최신 정보 확인용: 날짜 · 종류 · 업체 · 제목(누르면 원문 바로) · 신규. 자세한 내용은 업체 → 기업 정보에서
    return [h('div', { class: 'table-wrap' }, h('table', { class: 'grid permit-table' },
      h('thead', null, h('tr', null, ['날짜', '종류', '업체', '제목', '신규', ''].map(function (x, i) { return h('th', { scope: 'col', class: i === 5 ? 'w-star' : null, text: x }); }))),
      h('tbody', null, list.map(function (f) {
        var isNew = D.isNewItem(f);
        return h('tr', { class: isNew ? 'is-new' : null },
          h('td', { class: 'nowrap num-cell-left', text: f.item_date ? md(f.item_date) + '(' + DAY[dow(f.item_date)] + ')' : '' }),
          h('td', null, D.catBadge('permit', f.kind)),
          h('td', { class: 'nowrap' }, D.companyLink(f.company_id, f.company_name) || h('span', { class: 'note', text: '–' })),
          h('td', { class: 'wrap' }, D.titleLink(f), D.foundInside(f, st.q) ? D.badge('본문·첨부에서 찾음', 'warn') : null),
          h('td', null, isNew ? D.badge('NEW', 'new') : null),
          h('td', { class: 'nowrap' }, D.favButton('item', f.item_key, D.clean(f.title), { small: true })));
      })))),
      h('p', { class: 'note', text: list.length + '건 · 날짜 최신순 · 제목을 누르면 원문으로 바로 · 자세한 내용은 업체를 눌러 기업 정보에서 · 신규 = 출처마다 마지막 수집 이후 새로 들어온 것' })];
  }

  // ================= 디지털의료기기 정보방: 엑셀 대장을 표로 (기간과 상관없이 전체) =================
  var NEW_DAYS = 14;   // 대장 NEW = 허가일이 최근 14일 안
  var RT = { approval: ['허가', 'permit'], certification: ['인증', 'ok'], notification: ['신고', 'gray'] };
  var RS = { withdrawn: '취하', cancelled: '취소' };
  var bd = { sub: p.get('sub') || 'products', products: null, licenses: null, q: '', type: 'all', origin: 'all', ltype: 'all', shown: 100, open: {} };
  // 대장 '명칭'이 'A,A' 처럼 같은 이름이 겹쳐 오는 경우 한 번만
  function pname(n) { if (!n) return '(제품명 없음)'; var a = n.split(','), u = []; a.forEach(function (x) { x = x.trim(); if (x && u.indexOf(x) < 0) u.push(x); }); return u.join(', '); }
  function recentNew(d) { return !!d && d >= D.addDays(D.today(), -NEW_DAYS); }
  function boardPanel() {
    var box = h('div', { class: 'board-panel' });
    var posts = rows.filter(function (f) { return groupOf(f.kind) === 'board'; });
    var SUBS = [['products', '제품허가·인증·신고 대장', bd.products ? bd.products.length : '…'], ['licenses', '업허가 현황 (제조·수입)', bd.licenses ? bd.licenses.length : '…'],
      ['posts', '정보방 게시글 (고른 기간)', posts.length]];
    var bar = h('div', { class: 'chips sub-tabs', role: 'group', 'aria-label': '디지털의료기기 정보방 보기' }, SUBS.map(function (x) {
      return h('button', { type: 'button', class: 'chip', 'aria-pressed': bd.sub === x[0] ? 'true' : 'false', onclick: function () { bd.sub = x[0]; bd.shown = 100; drawTable(); } },
        x[1] + ' ', h('b', { text: x[2] }));
    }));
    var body = h('div');
    D.set(box, bar, body);
    if (bd.sub === 'posts') { D.set(body, feedTable(posts)); return box; }
    var key = bd.sub;
    if (!bd[key]) {
      D.set(body, D.loading());
      D.rpc(key === 'products' ? 'dash_digital_products' : 'dash_digital_licenses').then(function (r) { bd[key] = r; drawTable(); },
        function (e) { D.set(body, D.fail(e)); });
      return box;
    }
    D.set(body, key === 'products' ? productTable() : licenseTable());
    return box;
  }
  function filterBar(chipsDef, cur, setter, ph) {
    var q = h('input', { type: 'search', class: 'input', placeholder: ph, value: bd.q, 'aria-label': '대장에서 찾기' });
    q.addEventListener('input', function () { bd.q = q.value; bd.shown = 100; clearTimeout(q._t); q._t = setTimeout(function () { drawTable(); setTimeout(function () { var x = document.querySelector('.board-panel input[type=search]'); if (x) { x.focus(); x.setSelectionRange(x.value.length, x.value.length); } }, 0); }, 250); });
    return h('div', { class: 'top board-filter' }, chipsDef.map(function (grp) {
      return h('span', { class: 'chips', role: 'group', 'aria-label': grp.label }, grp.items.map(function (it) {
        return h('button', { type: 'button', class: 'chip small', 'aria-pressed': grp.cur === it[0] ? 'true' : 'false', text: it[1] + (it[2] != null ? ' ' + it[2] : ''),
          onclick: function () { grp.set(it[0]); bd.shown = 100; drawTable(); } });
      }));
    }), h('span', { class: 'right' }, q));
  }
  function matchQ(vals) { var t = bd.q.trim().toLowerCase(); return !t || vals.some(function (v) { return v && String(v).toLowerCase().indexOf(t) >= 0; }); }
  bd.byCo = true; bd.openCo = {};
  function purpose(r) { return r.review_purpose || r.intended_use || ''; }
  function productRows(list, withCompany) {
    var body = h('tbody');
    list.forEach(function (r) {
      var isNew = recentNew(r.approval_date), op = !!bd.open['p' + r.registration_id], rt = RT[r.registration_type] || [r.registration_type || '–', 'gray'];
      var pu = purpose(r);
      var row = h('tr', { class: 'dd-row' + (isNew ? ' is-new' : '') + (op ? ' open' : ''), tabindex: '0', 'aria-expanded': op ? 'true' : 'false',
        onclick: function (e) { if (e.target.closest('a,button')) return; bd.open['p' + r.registration_id] = !op; drawTable(); },
        onkeydown: function (e) { if (e.key === 'Enter' && !e.target.closest('a,button')) { bd.open['p' + r.registration_id] = !op; drawTable(); } } },
        h('td', { class: 'nowrap num-cell-left', text: r.approval_date || '–' }),
        withCompany ? h('td', { class: 'nowrap' }, D.companyLink(r.company_id, r.company_name) || h('span', { class: 'note', text: '–' })) : null,
        h('td', { class: 'nowrap mono', text: r.product_category_code || '–' }),
        h('td', { class: 'wrap' }, h('b', { text: pname(r.product_name) }), RS[r.approval_status] ? D.badge(RS[r.approval_status], 'bad') : null,
          pu ? h('span', { class: 'dd-purpose', title: pu, text: (r.review_purpose ? '사용목적(심사) · ' : '사용목적 · ') + pu }) : null),
        h('td', { class: 'nowrap' }, D.badge(rt[0], rt[1]), h('span', { class: 'note', text: ' ' + (r.origin === 'import' ? '수입' : r.origin === 'manufacture' ? '제조' : '') })),
        h('td', { class: 'nowrap' }, r.review_post_id ? h('button', { type: 'button', class: 'btn small', text: '원문·요약', onclick: function () { openReview(r); } })
          : h('span', { class: 'note', title: '이 번호의 심사검토 결과 공개 글이 아직 없거나 수집 전입니다', text: '공개 글 없음' })),
        h('td', null, isNew ? D.badge('NEW', 'new') : null));
      body.appendChild(row);
      if (op) body.appendChild(h('tr', { class: 'detail' }, h('td', { colspan: withCompany ? 7 : 6 }, h('dl', { class: 'info' },
        h('dt', { text: '허가·인증·신고번호' }), h('dd', { text: r.permit_number || '–' }),
        h('dt', { text: '등급' }), h('dd', { text: r.device_class ? r.device_class + '등급' : '–' }),
        h('dt', { text: '품목 상태' }), h('dd', { text: RS[r.approval_status] || '정상' }),
        h('dt', { text: '사용 목적 (대장)' }), h('dd', { text: r.intended_use || '–' }),
        r.review_purpose ? [h('dt', { text: '사용 목적 (심사)' }), h('dd', { text: r.review_purpose })] : null,
        h('dt', { text: '심사검토 결과' }), h('dd', null, r.review_post_id ? h('span', null, r.review_title + ' ', h('button', { type: 'button', class: 'btn small', text: '원문·요약 보기', onclick: function () { openReview(r); } })) : '공개 글 없음')))));
    });
    return h('div', { class: 'table-wrap' }, h('table', { class: 'grid dd-table' },
      h('thead', null, h('tr', null, ['허가일'].concat(withCompany ? ['기업명'] : [], ['제품코드', '제품명 · 사용목적', '구분', '원문', '신규']).map(function (x) { return h('th', { scope: 'col', text: x }); }))), body));
  }
  function productGroups(list) {
    var groups = {}, order = [];
    list.forEach(function (r) {
      var k = r.company_id ? 'c' + r.company_id : 'n' + (r.company_name || '?');
      if (!groups[k]) { groups[k] = { key: k, id: r.company_id, name: r.company_name || '(업체명 없음)', items: [] }; order.push(k); }
      groups[k].items.push(r);
    });
    var body = h('tbody');
    order.slice(0, bd.shown).forEach(function (k) {
      var g = groups[k], op = !!bd.openCo[k], it = g.items;
      var cnt = function (t) { return it.filter(function (r) { return r.registration_type === t; }).length; };
      var org = {}; it.forEach(function (r) { if (r.origin) org[r.origin === 'import' ? '수입' : '제조'] = 1; });
      var nRev = it.filter(function (r) { return r.review_post_id; }).length, nNew = it.filter(function (r) { return recentNew(r.approval_date); }).length;
      var names = []; it.forEach(function (r) { var n = pname(r.product_name); if (names.indexOf(n) < 0) names.push(n); });
      var pu = it.map(purpose).filter(Boolean)[0];
      body.appendChild(h('tr', { class: 'co-row' + (op ? ' open' : '') + (nNew ? ' is-new' : ''), tabindex: '0', 'aria-expanded': op ? 'true' : 'false',
        onclick: function (e) { if (e.target.closest('a,button')) return; bd.openCo[k] = !op; drawTable(); },
        onkeydown: function (e) { if (e.key === 'Enter' && !e.target.closest('a,button')) { bd.openCo[k] = !op; drawTable(); } } },
        h('td', null, h('span', { class: 'tri', 'aria-hidden': 'true', text: op ? '▾' : '▸' })),
        h('td', { class: 'nowrap' }, g.id ? D.companyLink(g.id, g.name) : h('b', { text: g.name }), h('span', { class: 'note block', text: Object.keys(org).join('·') })),
        h('td', { class: 'nowrap' }, h('b', { class: 'num', text: it.length + '개' }),
          h('span', { class: 'note block', text: ['허가 ' + cnt('approval'), '인증 ' + cnt('certification'), '신고 ' + cnt('notification')].filter(function (x) { return !/ 0$/.test(x); }).join(' · ') })),
        h('td', { class: 'wrap' }, h('span', { text: names.slice(0, 3).join(', ') + (names.length > 3 ? ' 외 ' + (names.length - 3) + '개' : '') }),
          pu ? h('span', { class: 'dd-purpose', title: pu, text: '사용목적 · ' + pu }) : null),
        h('td', { class: 'nowrap', text: it[0].approval_date || '–' }),
        h('td', { class: 'nowrap' }, nRev ? h('span', null, h('b', { text: nRev }), ' / ' + it.length + '건') : h('span', { class: 'note', text: '없음' })),
        h('td', null, nNew ? D.badge('NEW ' + nNew, 'new') : null)));
      if (op) body.appendChild(h('tr', { class: 'detail' }, h('td', { colspan: 7 }, productRows(it, false))));
    });
    return [h('div', { class: 'table-wrap' }, h('table', { class: 'grid co-table' },
      h('thead', null, h('tr', null, ['', '회사', '제품 수', '제품 · 사용목적', '최근 허가일', '원문 연결', '신규'].map(function (x) { return h('th', { scope: 'col', text: x }); }))), body)),
      h('p', { class: 'note', text: '회사 ' + order.length + '곳 · 제품 ' + list.length + '개 · 최근 허가가 있는 회사 순 · 줄을 누르면 그 회사의 제품 목록 (줄마다 원문·요약)' }),
      order.length > bd.shown ? h('button', { type: 'button', class: 'btn more', text: '100곳 더 보기', onclick: function () { bd.shown += 100; drawTable(); } }) : null];
  }
  function productTable() {
    var all = bd.products;
    var cnt = function (f) { return all.filter(f).length; };
    var list = all.filter(function (r) {
      return (bd.type === 'all' || r.registration_type === bd.type) && (bd.origin === 'all' || r.origin === bd.origin) && (!st.onlyNew || recentNew(r.approval_date))
        && matchQ([r.company_name, r.product_name, r.product_category_code, r.permit_number]);
    });
    var nNew = all.filter(function (r) { return recentNew(r.approval_date); }).length;
    return [filterBar([
      { label: '구분', cur: bd.type, set: function (v) { bd.type = v; }, items: [['all', '전체', all.length], ['approval', '허가', cnt(function (r) { return r.registration_type === 'approval'; })],
        ['certification', '인증', cnt(function (r) { return r.registration_type === 'certification'; })], ['notification', '신고', cnt(function (r) { return r.registration_type === 'notification'; })]] },
      { label: '제조·수입', cur: bd.origin, set: function (v) { bd.origin = v; }, items: [['all', '제조·수입'], ['manufacture', '제조', cnt(function (r) { return r.origin === 'manufacture'; })], ['import', '수입', cnt(function (r) { return r.origin === 'import'; })]] }
    ], null, null, '기업·제품명·제품코드·번호'),
      h('div', { class: 'chips group-mode', role: 'group', 'aria-label': '대장 보기' }, [[true, '회사별로 묶기'], [false, '제품 하나씩']].map(function (m) {
        return h('button', { type: 'button', class: 'chip small', 'aria-pressed': bd.byCo === m[0] ? 'true' : 'false', text: m[1], onclick: function () { bd.byCo = m[0]; bd.shown = 100; drawTable(); } });
      })),
      !list.length ? D.empty('조건에 맞는 제품이 없습니다.') : bd.byCo ? productGroups(list) : productRows(list.slice(0, bd.shown), true),
      h('p', { class: 'note', text: '대장 전체 ' + all.length + '건 중 ' + list.length + '건' + (list.length > bd.shown ? ' (앞 ' + bd.shown + '건 표시)' : '') + ' · 허가일 최신순 · NEW = 허가일이 최근 ' + NEW_DAYS + '일 안 (' + nNew + '건) · 줄을 누르면 자세히 · 원문 = 디지털의료기기 심사검토 결과 정보 공개 글' }),
      !bd.byCo && list.length > bd.shown ? h('button', { type: 'button', class: 'btn more', text: '100건 더 보기', onclick: function () { bd.shown += 100; drawTable(); } }) : null];
  }
  var LT = { manufacture: '제조업', import: '수입업' }, LS = { active: '정상', suspended: '휴업', closed: '폐업' };
  function licenseTable() {
    var all = bd.licenses;
    var list = all.filter(function (r) { return (bd.ltype === 'all' || r.license_type === bd.ltype) && (!st.onlyNew || recentNew(r.license_date)) && matchQ([r.company_name, r.license_number, r.license_address]); });
    var nNew = all.filter(function (r) { return recentNew(r.license_date); }).length;
    return [filterBar([{ label: '업종', cur: bd.ltype, set: function (v) { bd.ltype = v; }, items: [['all', '전체', all.length],
      ['import', '수입업', all.filter(function (r) { return r.license_type === 'import'; }).length], ['manufacture', '제조업', all.filter(function (r) { return r.license_type === 'manufacture'; }).length]] }],
      null, null, '기업명·허가번호·소재지'),
      list.length ? h('div', { class: 'table-wrap' }, h('table', { class: 'grid dd-table' },
        h('thead', null, h('tr', null, ['허가일자', '기업명', '업종', '업허가번호', '상태', '소재지', '신규'].map(function (x) { return h('th', { scope: 'col', text: x }); }))),
        h('tbody', null, list.slice(0, bd.shown).map(function (r) {
          var isNew = recentNew(r.license_date);
          return h('tr', { class: isNew ? 'is-new' : null },
            h('td', { class: 'nowrap num-cell-left', text: r.license_date || '–' }),
            h('td', { class: 'nowrap' }, D.companyLink(r.company_id, r.company_name) || h('span', { class: 'note', text: '–' })),
            h('td', null, D.badge(LT[r.license_type] || r.license_type, 'lic-' + r.license_type)),
            h('td', { class: 'nowrap mono', text: r.license_number }),
            h('td', null, r.license_status && r.license_status !== 'active' ? D.badge(LS[r.license_status] || r.license_status, 'bad') : h('span', { class: 'note', text: '정상' })),
            h('td', { class: 'wrap', text: r.license_address || '–' }),
            h('td', null, isNew ? D.badge('NEW', 'new') : null));
        })))) : D.empty('조건에 맞는 업허가가 없습니다.'),
      h('p', { class: 'note', text: '업허가 현황 전체 ' + all.length + '건 중 ' + list.length + '건 · 허가일자 최신순 · NEW = 허가일자가 최근 ' + NEW_DAYS + '일 안 (' + nNew + '건) · 기업명을 누르면 기업 정보' }),
      list.length > bd.shown ? h('button', { type: 'button', class: 'btn more', text: '100건 더 보기', onclick: function () { bd.shown += 100; drawTable(); } }) : null];
  }
  // 원문·요약 팝업은 assets/js/review.js (D.openReview, 기업 정보 › 허가 제품과 같이 씀)
  function openReview(r) { D.openReview(Object.assign({}, r, { product_name: pname(r.product_name) })); }

  loadWeeks();
  load();
})();
