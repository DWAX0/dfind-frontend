/* 통합 검색: 위쪽 막대 검색창·키워드에서 옴 (search.html?q=…&per=…)
   [기업] 기업명·허가 제품·혁신 지정 품목·DART 회사명 → [분야별] 인허가·제도 / 연구·과제 / 공시 / 뉴스 최신 10건씩 (+ 전체 리스트로)
   검색어가 키워드 사전의 대표어·비슷한 말이면 같은 키워드의 표기를 모두 찾음 */
(async function () {
  'use strict';
  var main = await D.boot('search');
  if (!main) return;
  var h = D.h;
  var p = new URLSearchParams(location.search);
  var st = { q: (p.get('q') || '').trim(), per: p.get('per') || 'all', scope: p.get('scope') || 'all' };
  var CATS = [['permit', '인허가·제도'], ['research', '연구·과제'], ['disclosure', '공시'], ['market', '뉴스']];
  var PERS = [['all', '전체 기간'], ['365', '최근 1년'], ['90', '최근 3개월'], ['30', '최근 1개월']];
  var SCOPES = [['all', '전부'], ['company', '기업']].concat(CATS);

  var input = h('input', { type: 'search', class: 'input big', id: 's-q', value: st.q, placeholder: '기업명 · 제품명 · 키워드 (예: 웨어러블, 심전도, 혁신의료기기)' });
  var pickBox = h('div', { class: 'search-kw' });
  var res = h('div', { class: 'stack' });
  var termsNote = h('p', { class: 'note' });
  function chipRow(list, cur, on) {
    return h('div', { class: 'chips', role: 'group' }, list.map(function (x) {
      return h('button', { type: 'button', class: 'chip', 'aria-pressed': cur === x[0] ? 'true' : 'false', text: x[1], onclick: function () { on(x[0]); } });
    }));
  }
  var perBox = h('div'), scopeBox = h('div');
  function drawFilters() {
    D.set(perBox, h('span', { class: 'note', text: '기간' }), chipRow(PERS, st.per, function (v) { st.per = v; go(); }));
    D.set(scopeBox, h('span', { class: 'note', text: '범위' }), chipRow(SCOPES, st.scope, function (v) { st.scope = v; save(); drawFilters(); draw(); }));
  }
  D.set(main,
    D.header('통합 검색', '기업 · 허가 제품 · 인허가 · 연구 · 공시 · 뉴스를 한 번에 찾습니다. 제목을 누르면 원문, 기업을 누르면 기업 정보'),
    h('section', { class: 'card search-top', 'aria-label': '검색' },
      h('form', { class: 'search-row', role: 'search', onsubmit: function (e) { e.preventDefault(); st.q = input.value.trim(); go(); } },
        h('label', { class: 'sr', for: 's-q', text: '검색어' }), input,
        h('button', { type: 'submit', class: 'btn primary' }, D.svg('M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14M20 20l-4-4', 20), '검색')),
      h('details', { class: 'kw-details' }, h('summary', { text: '키워드에서 고르기' }), pickBox),
      h('div', { class: 'search-filters' }, perBox, scopeBox), termsNote),
    res);
  pickBox.appendChild(D.keywordPicker(function (t) { input.value = t; st.q = t; go(); }));

  function save() {
    var u = new URLSearchParams();
    if (st.q) u.set('q', st.q);
    if (st.per !== 'all') u.set('per', st.per);
    if (st.scope !== 'all') u.set('scope', st.scope);
    history.replaceState(null, '', '?' + u.toString());
  }
  var data = null;
  async function go() {
    save(); drawFilters();
    if (!st.q) { D.set(res, D.empty('검색어를 넣거나 키워드를 골라 주세요.')); termsNote.textContent = ''; return; }
    D.rememberSearch(st.q);
    var gq = document.getElementById('gnb-q'); if (gq) gq.value = st.q;
    D.set(res, D.loading());
    var from = st.per === 'all' ? null : D.addDays(D.today(), -Number(st.per));
    try {
      var r = await Promise.all([
        D.rpc('dash_search_terms', { p_query: st.q }),
        D.rpc('dash_search_companies', { p_query: st.q, p_limit: 30 }),
        D.rpc('dash_search', { p_query: st.q, p_from: from, p_to: null, p_per: 10 })]);
      data = { terms: r[0] || [], companies: r[1] || [], items: r[2] || [] };
    } catch (e) { D.set(res, D.fail(e)); return; }
    var others = data.terms.filter(function (t) { return t !== st.q; });
    termsNote.textContent = others.length ? '같은 키워드로 함께 찾은 말: ' + others.join(' · ') : '';
    draw();
  }
  function catCount(c) { var f = data.items.filter(function (x) { return x.category === c; })[0]; return f ? Number(f.category_count) : 0; }
  function draw() {
    if (!data) return;
    var total = data.companies.length + CATS.reduce(function (n, c) { return n + catCount(c[0]); }, 0);
    var tiles = h('div', { class: 'tiles search-tiles' },
      [['company', '기업', data.companies.length + (data.companies.length >= 30 ? '+' : '')]].concat(CATS.map(function (c) { return [c[0], c[1], catCount(c[0])]; })).map(function (t) {
        return h('button', { type: 'button', class: 'tile' + (st.scope === t[0] ? ' on' : ''), onclick: function () { st.scope = st.scope === t[0] ? 'all' : t[0]; save(); drawFilters(); draw(); } },
          h('span', { class: 'tile-label', text: t[1] }), h('b', { class: 'tile-num', text: String(t[2]) }), h('span', { class: 'note', text: '건' }));
      }));
    var parts = [];
    if (st.scope === 'all' || st.scope === 'company') parts.push(companySection());
    CATS.forEach(function (c) { if (st.scope === 'all' || st.scope === c[0]) parts.push(catSection(c)); });
    D.set(res, h('p', { class: 'note', text: '"' + st.q + '" 검색 결과 ' + D.num(total) + '건' }), tiles, parts);
  }
  function companySection() {
    var list = data.companies;
    return h('section', { class: 'card', 'aria-labelledby': 'sr-co' },
      h('div', { class: 'card-head' }, h('h2', { id: 'sr-co', text: '기업' }), h('span', { class: 'note', text: list.length + '곳 · 기업명 → 제품·혁신 지정 순' })),
      list.length ? h('ul', { class: 'sr-companies' }, list.map(function (c) {
        return h('li', null,
          h('a', { class: 'company-link sr-co-name', href: D.companyHref(c.company_id), text: c.company_name }),
          c.has_innovation ? D.badge('★ 혁신', 'star') : null,
          c.registrations ? h('span', { class: 'note', text: '허가 제품 ' + c.registrations + '개' }) : null,
          h('span', { class: 'sr-why' }, (c.reasons || []).map(function (r) { return h('span', { class: 'kw', text: r }); })));
      })) : D.empty('기업명·제품명에 "' + st.q + '" 이(가) 들어간 기업이 없습니다.'));
  }
  function catSection(c) {
    var list = data.items.filter(function (x) { return x.category === c[0]; });
    var n = catCount(c[0]);
    return h('section', { class: 'card', 'aria-labelledby': 'sr-' + c[0] },
      h('div', { class: 'card-head' }, h('h2', { id: 'sr-' + c[0] }, h('span', { class: 'dot dot-' + c[0] }), ' ' + c[1]),
        h('span', { class: 'note', text: D.num(n) + '건' + (n > list.length ? ' 중 최신 ' + list.length + '건' : '') }),
        n ? h('a', { class: 'btn small right', href: 'list.html?cat=' + c[0] + '&q=' + encodeURIComponent(st.q), text: '전체 리스트에서 모두 보기 →' }) : null),
      list.length ? list.map(function (f) { return D.feedItem(f, { compact: true }); }) : D.empty(c[1] + '에서 찾지 못했습니다.'));
  }
  drawFilters();
  go();
})();
