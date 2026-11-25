/* 분야별 화면 공통 (인허가·제도 / 시장·투자 / 연구·과제 / 공시)
   [조회] 기간 + 검색어(제목·본문·첨부파일 내용까지) + 종류 → dash_feed
   [종류별 칸] 누르면 걸러 보기 → [목록] (첨부는 목록에서 바로 '원본 내려받기') */
(function () {
  'use strict';
  var h = D.h;

  /* 조회 영역: 기간 막대 + 검색어 + 종류 + 검색/초기화. 검색어·종류는 주소(?q=…&kind=…)에도 남김 */
  D.searchPanel = function (o) {
    var p = new URLSearchParams(location.search);
    var st = { q: p.get('q') || '', kind: p.get('kind') || 'all' };
    var input = h('input', { type: 'search', class: 'input grow', id: 'q', placeholder: o.searchHint || '기업·제품·제목·본문 내용', value: st.q,
      onkeydown: function (e) { if (e.key === 'Enter') { e.preventDefault(); search(); } } });
    var kind = h('select', { class: 'input', id: 'kind', onchange: function (e) { st.kind = e.target.value; save(); if (o.onKind) o.onKind(st.kind); } });
    function fillKinds(list) {
      D.set(kind, h('option', { value: 'all', text: '전체' }), list.map(function (k) { return h('option', { value: k, text: k }); }));
      kind.value = list.indexOf(st.kind) >= 0 ? st.kind : 'all';
      st.kind = kind.value;
    }
    fillKinds(o.kinds || []);
    var bar = D.periodBar({ label: '기간', defaultPer: o.defaultPer || '7', onChange: function () { fire(); } });
    bar.classList.add('embedded');
    function save() {
      var q = new URLSearchParams(location.search);
      if (st.q) q.set('q', st.q); else q.delete('q');
      if (st.kind !== 'all') q.set('kind', st.kind); else q.delete('kind');
      history.replaceState(null, '', '?' + q.toString());
    }
    function fire() { save(); var r = bar.range(); o.onSearch({ from: r.from, to: r.to, q: st.q.trim(), kind: st.kind }); }
    function search() { st.q = input.value; fire(); }
    var el = h('section', { class: 'card search-panel', 'aria-label': '조회 조건' },
      h('div', { class: 'card-head' }, h('h2', { text: '조회' }), h('span', { class: 'note', text: '검색어는 제목·기업명뿐 아니라 본문과 첨부파일 내용까지 찾습니다' })),
      bar,
      h('div', { class: 'search-row' },
        h('label', { class: 'field grow', for: 'q' }, '검색어', input),
        h('label', { class: 'field', for: 'kind' }, '종류', kind),
        h('div', { class: 'search-btns' },
          h('button', { type: 'button', class: 'btn primary', onclick: search }, D.svg('M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14M20 20l-4-4', 20), '검색'),
          h('button', { type: 'button', class: 'btn', text: '초기화', onclick: function () { input.value = ''; st.q = ''; st.kind = 'all'; kind.value = 'all'; if (o.onKind) o.onKind('all'); fire(); } }))));
    return {
      el: el, state: st, fillKinds: fillKinds,
      setKind: function (k) { st.kind = k; kind.value = k; save(); },
      start: function () { bar.start(); }
    };
  };

  /* 종류별 칸: 이름은 왼쪽 위, 건수·출처는 오른쪽 아래 (CSS .tile) */
  D.kindTiles = function (rows, o, cur, onPick) {
    var count = {};
    rows.forEach(function (f) { count[f.kind] = (count[f.kind] || 0) + 1; });
    var kinds = (o.kinds || []).concat(Object.keys(count).filter(function (k) { return (o.kinds || []).indexOf(k) < 0; }));
    var defs = [['all', '전체', rows.length, o.allNote || '조회한 기간']].concat(kinds.map(function (k) { return [k, k, count[k] || 0, (o.kindNotes || {})[k] || '']; }));
    return defs.map(function (d) {
      return h('button', { type: 'button', class: 'tile', 'aria-pressed': cur === d[0] ? 'true' : 'false', onclick: function () { onPick(d[0]); } },
        h('span', { class: 'tile-label', text: d[1] }), h('span', { class: 'tile-num' }, D.num(d[2]), h('small', { text: '건' })),
        h('span', { class: 'tile-note', text: d[3] || '' }));
    });
  };

  function norm(t) { return D.clean(t).replace(/\[[^\]]*\]|\([^)]*\)|[^0-9a-z가-힣]/gi, '').slice(0, 22); }
  /* 같은 사건(제목이 거의 같은 기사) 묶기 */
  D.groupSame = function (list, on) {
    if (!on) return list.map(function (f) { return { f: f, dups: [] }; });
    var groups = [], seen = {};
    list.forEach(function (f) {
      var k = norm(f.title);
      if (k && seen[k]) seen[k].dups.push(f);
      else { var g = { f: f, dups: [] }; groups.push(g); if (k) seen[k] = g; }
    });
    return groups;
  };
  /* 검색어가 제목·요약에 없으면 '본문·첨부에서 찾음' 표시 */
  D.foundInside = function (f, q) {
    if (!q) return false;
    var s = q.toLowerCase();
    return ![f.title, f.detail, f.company_name].some(function (x) { return x && D.clean(x).toLowerCase().indexOf(s) >= 0; });
  };

  D.categoryPage = async function (o) {
    var main = await D.boot(o.page);
    if (!main) return;
    var ctx = { rows: [], files: {}, kind: 'all', q: '', group: true, shown: 60 };
    var tiles = h('section', { class: 'tiles', 'aria-label': '종류별 건수 (누르면 걸러 보기)' });
    var listCard = h('section', { class: 'card', 'aria-labelledby': 'list-h' });
    var panel = D.searchPanel({ kinds: o.kinds, defaultPer: o.defaultPer, searchHint: o.searchHint, onSearch: load,
      onKind: function (k) { ctx.kind = k; ctx.shown = 60; drawTiles(); drawList(); } });
    ctx.kind = panel.state.kind;
    var right = o.groupable ? h('button', { type: 'button', class: 'btn', 'aria-pressed': 'true', id: 'group-btn',
      onclick: function (e) { ctx.group = !ctx.group; e.currentTarget.setAttribute('aria-pressed', ctx.group ? 'true' : 'false');
        e.currentTarget.textContent = '같은 사건 묶기: ' + (ctx.group ? '켜짐' : '꺼짐'); drawList(); } }, '같은 사건 묶기: 켜짐') : null;
    D.set(main, D.header(o.title, o.sub, { dot: 'dot-' + (o.dot || o.category), right: right }),
      o.notice ? h('p', { class: 'notice info', text: o.notice }) : null, panel.el, tiles, listCard);
    panel.start();

    async function load(r) {
      ctx.q = r.q; ctx.kind = r.kind; ctx.shown = 60; ctx.files = {};
      D.set(tiles, D.loading()); D.set(listCard, D.loading());
      try {
        ctx.rows = await D.rpc('dash_feed', { p_from: r.from, p_to: r.to, p_category: o.category || null, p_limit: 2000, p_query: r.q || null });
        if (o.only) ctx.rows = ctx.rows.filter(o.only);   // 예: 뉴스만 / 뉴스 빼고
      }
      catch (e) { D.set(tiles); D.set(listCard, D.fail(e)); return; }
      drawTiles(); drawList();
      ctx.files = await D.loadFiles(ctx.rows);
      if (Object.keys(ctx.files).length) drawList();
    }
    function pick(k) { ctx.kind = k; ctx.shown = 60; panel.setKind(k); drawTiles(); drawList(); }
    function drawTiles() { D.set(tiles, D.kindTiles(ctx.rows, { kinds: o.kinds, kindNotes: o.kindNotes, allNote: ctx.q ? '"' + ctx.q + '" 검색 결과' : '' }, ctx.kind, pick)); }
    function drawList() {
      var list = ctx.rows.filter(function (f) { return ctx.kind === 'all' || f.kind === ctx.kind; });
      var groups = D.groupSame(list, o.groupable && ctx.group);
      if (o.renderList) { o.renderList(listCard, groups, ctx, { pick: pick, redraw: drawList, total: list.length }); return; }
      var items = groups.slice(0, ctx.shown).map(function (g) { return D.listEntry(g, ctx); });
      D.set(listCard,
        h('div', { class: 'card-head' }, h('h2', { id: 'list-h', text: ctx.kind === 'all' ? '목록' : ctx.kind }),
          h('span', { class: 'note', text: groups.length + '건' + (o.groupable && ctx.group && groups.length !== list.length ? ' (묶기 전 ' + list.length + '건)' : '') + ' · 최신순' })),
        items.length ? items : D.empty(ctx.q ? '"' + ctx.q + '" 이(가) 들어간 정보가 없습니다.' : o.emptyText),
        groups.length > ctx.shown ? h('button', { type: 'button', class: 'btn more', text: '60건 더 보기', onclick: function () { ctx.shown += 60; drawList(); } }) : null);
    }
  };

  /* 목록 한 줄 (+ 같은 소식 펼치기, 본문·첨부에서 찾음 표시) */
  D.listEntry = function (g, ctx) {
    var el = D.feedItem(g.f, { files: ctx.files[g.f.item_key] });
    if (D.foundInside(g.f, ctx.q)) el.querySelector('.list-meta').appendChild(D.badge('본문·첨부에서 찾음', 'warn'));
    if (g.dups.length) {
      var more = h('div', { hidden: true }, g.dups.map(function (f) { return D.feedItem(f, { noDetail: true, files: ctx.files[f.item_key] }); }));
      el.appendChild(h('button', { type: 'button', class: 'btn small', 'aria-expanded': 'false', text: '같은 소식 ' + g.dups.length + '건 더 보기',
        onclick: function (e) { more.hidden = !more.hidden; e.currentTarget.setAttribute('aria-expanded', more.hidden ? 'false' : 'true'); } }), more);
    }
    return el;
  };
})();
