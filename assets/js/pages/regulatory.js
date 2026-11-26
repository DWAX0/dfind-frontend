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
  var st = { from: p.get('from') || thisMon, to: p.get('to') || D.addDays(thisMon, 6), q: p.get('q') || '', group: p.get('g') || 'all', onlyNew: p.get('new') === '1' };
  var weekRows = [], rows = [], files = {};

  var label = h('span', { class: 'week-label' });
  var chips = h('div', { class: 'wk-row', role: 'group', 'aria-label': '주차 (이번 주 앞뒤 4주)' });
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
    D.header('인허가·제도', '혁신의료기기 지정 · 식약처 허가 · NECA 신의료기술 · 공지를 주간 단위로 봅니다 (발표·허가일 기준)', { dot: 'dot-permit', right: label }),
    h('div', { class: 'reg-layout' },
    // 왼쪽: 주차별 건수 (이번 주 앞뒤 4주, 누르면 그 주로)
    h('aside', { class: 'card wk-side', 'aria-labelledby': 'wk-side-h' }, h('h2', { id: 'wk-side-h', class: 'wk-side-h', text: '주차별 건수' }),
      h('p', { class: 'note', text: '전체 건수 · NEW = 새로 들어온 것' }), chips),
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
    if (st.from !== thisMon || st.to !== D.addDays(thisMon, 6)) { u.set('from', st.from); u.set('to', st.to); }
    if (st.q) u.set('q', st.q);
    if (st.group !== 'all') u.set('g', st.group);
    if (st.onlyNew) u.set('new', '1');
    history.replaceState(null, '', '?' + u.toString());
  }
  function setWeek(mon) { st.from = monday(mon); st.to = D.addDays(st.from, 6); load(); }
  function isWeek() { return st.to === D.addDays(st.from, 6) && dow(st.from) === 1; }

  // 주차 칩 건수: 이번 주 앞뒤 4주를 한 번에 받아 셈
  async function loadWeeks() {
    try { weekRows = await D.rpc('dash_feed', { p_from: D.addDays(thisMon, -28), p_to: D.addDays(thisMon, 34), p_category: 'permit', p_limit: 2000 }); }
    catch (e) { weekRows = []; }
    drawChips();
  }
  function drawChips() {
    D.set(chips, [-4, -3, -2, -1, 0, 1, 2, 3, 4].map(function (k) {
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
    label.textContent = isWeek() ? w.y + '년 ' + w.w + '주차 · ' + md(st.from) + '(' + DAY[dow(st.from)] + ')–' + md(st.to) + '(' + DAY[dow(st.to)] + ')'
      : '기간 ' + st.from + ' ~ ' + st.to;
    if (isWeek()) pick.value = w.y + '-W' + String(w.w).padStart(2, '0');
    from.value = st.from; to.value = st.to;
    drawChips();
    D.set(sum, D.loading()); D.set(table, D.loading());
    try { rows = await D.rpc('dash_feed', { p_from: st.from, p_to: st.to, p_category: 'permit', p_limit: 2000, p_query: st.q || null }); }
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
    var list = rows.filter(function (f) { return (st.group === 'all' || groupOf(f.kind) === st.group) && (!st.onlyNew || D.isNewItem(f)); });
    if (!list.length) { D.set(table, D.empty(st.q ? '"' + st.q + '" 이(가) 들어간 인허가 소식이 없습니다.' : '이 기간에는 인허가 소식이 없습니다.')); return; }
    D.set(table, h('div', { class: 'table-wrap' }, h('table', { class: 'grid permit-table' },
      h('thead', null, h('tr', null, ['날짜', '종류', '업체', '내용', '첨부', '신규', ''].map(function (x, i) { return h('th', { scope: 'col', class: i === 6 ? 'w-star' : null, text: x }); }))),
      h('tbody', null, list.map(function (f) {
        var isNew = D.isNewItem(f);
        var fl = (files[f.item_key] || []).filter(function (x) { return x.download_url; });
        return h('tr', { class: isNew ? 'is-new' : null },
          h('td', { class: 'nowrap num-cell-left', text: f.item_date ? md(f.item_date) + '(' + DAY[dow(f.item_date)] + ')' : '' }),
          h('td', null, D.catBadge('permit', f.kind)),
          h('td', { class: 'nowrap' }, D.companyLink(f.company_id, f.company_name) || h('span', { class: 'note', text: '–' })),
          h('td', { class: 'wrap' }, h('a', { class: 'list-title', href: D.itemHref(f.item_key), text: D.clean(f.title) || '(제목 없음)' }),
            f.detail ? h('span', { class: 'list-detail block', text: D.clean(f.detail).slice(0, 160) }) : null,
            D.foundInside(f, st.q) ? D.badge('본문·첨부에서 찾음', 'warn') : null),
          h('td', null, fl.length ? h('span', { class: 'list-files' }, fl.map(function (x) { return D.fileLink(x); })) : h('span', { class: 'note', text: '–' })),
          h('td', null, isNew ? D.badge('NEW', 'new') : null),
          h('td', { class: 'nowrap' }, f.url ? h('a', { href: f.url, target: '_blank', rel: 'noopener noreferrer', title: '원본 보기', text: '원문 ↗' }) : null, ' ',
            D.favButton('item', f.item_key, D.clean(f.title), { small: true })));
      })))),
      h('p', { class: 'note', text: list.length + '건 · 날짜 최신순 · 신규 = 출처마다 마지막 수집 이후 새로 들어온 것 (줄 색으로 표시)' }));
  }

  loadWeeks();
  load();
})();
