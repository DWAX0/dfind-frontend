/* 분야별 화면 공통 (인허가·제도 / 시장·투자 / 연구·과제 / 공시)
   조회 막대 → dash_feed(분야) → 종류별 칸(누르면 걸러 보기) + 검색 + 목록 */
(function () {
  'use strict';
  var h = D.h;
  D.categoryPage = async function (o) {
    var main = await D.boot(o.page);
    if (!main) return;
    var params = new URLSearchParams(location.search);
    var st = { kind: 'all', search: params.get('q') || '', group: true, shown: 60 };
    var rows = [];
    var tiles = h('section', { class: 'tiles', 'aria-label': '종류별 건수 (누르면 걸러 보기)' });
    var listCard = h('section', { class: 'card', 'aria-labelledby': 'list-h' });
    var bar = D.periodBar({ defaultPer: o.defaultPer || '7', onChange: load });
    var right = o.groupable ? h('button', { type: 'button', class: 'btn', 'aria-pressed': 'true', id: 'group-btn',
      onclick: function (e) { st.group = !st.group; e.currentTarget.setAttribute('aria-pressed', st.group ? 'true' : 'false');
        e.currentTarget.textContent = '같은 사건 묶기: ' + (st.group ? '켜짐' : '꺼짐'); drawList(); } }, '같은 사건 묶기: 켜짐') : null;
    var listTitle = h('h2', { id: 'list-h' }), listNote = h('span', { class: 'note' }), listBody = h('div');
    var search = h('input', { type: 'search', class: 'input', id: 'q', placeholder: o.searchHint || '기업·제품·제목', value: st.search,
      oninput: function (e) { st.search = e.target.value; st.shown = 60; clearTimeout(drawList.t); drawList.t = setTimeout(drawList, 250); } });
    listCard.append(h('div', { class: 'card-head' }, listTitle, listNote, h('label', { class: 'field inline right', for: 'q' }, '검색', search)), listBody);
    D.set(main, D.header(o.title, o.sub, { dot: 'dot-' + o.category, right: right }),
      o.notice ? h('p', { class: 'notice info', text: o.notice }) : null, bar, tiles, listCard);
    bar.start();

    async function load(r) {
      D.set(tiles, D.loading()); D.set(listBody, D.loading());
      try { rows = await D.rpc('dash_feed', { p_from: r.from, p_to: r.to, p_category: o.category, p_limit: 2000 }); }
      catch (e) { D.set(tiles); D.set(listBody, D.fail(e)); return; }
      st.shown = 60;
      drawTiles(); drawList();
    }
    function drawTiles() {
      var count = {};
      rows.forEach(function (f) { count[f.kind] = (count[f.kind] || 0) + 1; });
      var kinds = (o.kinds || []).concat(Object.keys(count).filter(function (k) { return (o.kinds || []).indexOf(k) < 0; }));
      var defs = [['all', '전체', rows.length, '선택한 기간']].concat(kinds.map(function (k) { return [k, k, count[k] || 0, (o.kindNotes || {})[k] || '']; }));
      D.set(tiles, defs.map(function (d) {
        return h('button', { type: 'button', class: 'tile', 'aria-pressed': st.kind === d[0] ? 'true' : 'false',
          onclick: function () { st.kind = d[0]; st.shown = 60; drawTiles(); drawList(); } },
          h('span', { class: 'tile-label', text: d[1] }), h('span', { class: 'tile-num' }, D.num(d[2]), h('small', { text: '건' })),
          d[3] ? h('span', { class: 'tile-note', text: d[3] }) : null);
      }));
    }
    function norm(t) { return D.clean(t).replace(/\[[^\]]*\]|\([^)]*\)|[^0-9a-z가-힣]/gi, '').slice(0, 22); }
    function drawList() {
      var s = st.search.trim().toLowerCase();
      var list = rows.filter(function (f) {
        if (st.kind !== 'all' && f.kind !== st.kind) return false;
        if (!s) return true;
        return [f.title, f.company_name, f.detail].some(function (x) { return x && D.clean(x).toLowerCase().indexOf(s) >= 0; });
      });
      var groups = [];
      if (o.groupable && st.group) {
        var seen = {};
        list.forEach(function (f) {
          var k = norm(f.title);
          if (k && seen[k]) seen[k].dups.push(f);
          else { var g = { f: f, dups: [] }; groups.push(g); if (k) seen[k] = g; }
        });
      } else groups = list.map(function (f) { return { f: f, dups: [] }; });
      var items = groups.slice(0, st.shown).map(function (g) {
        var el = D.feedItem(g.f);
        if (g.dups.length) {
          var more = h('div', { hidden: true }, g.dups.map(function (f) { return D.feedItem(f, { noDetail: true }); }));
          el.appendChild(h('button', { type: 'button', class: 'btn small', 'aria-expanded': 'false', text: '같은 소식 ' + g.dups.length + '건 더 보기',
            onclick: function (e) { more.hidden = !more.hidden; e.currentTarget.setAttribute('aria-expanded', more.hidden ? 'false' : 'true'); } }), more);
        }
        return el;
      });
      listTitle.textContent = st.kind === 'all' ? '목록' : st.kind;
      listNote.textContent = groups.length + '건' + (o.groupable && st.group && groups.length !== list.length ? ' (묶기 전 ' + list.length + '건)' : '') + ' · 최신순';
      D.set(listBody, (items.length ? items : [D.empty(o.emptyText)]).concat(
        groups.length > st.shown ? [h('button', { type: 'button', class: 'btn more', text: '60건 더 보기', onclick: function () { st.shown += 60; drawList(); } })] : []));
    }
  };
})();
