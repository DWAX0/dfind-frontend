/* 전체 리스트: 분야별(인허가·제도 / 연구·과제 / 공시 / 뉴스) 모든 정보를 기간 제한 없이 표로 (dash_list, 100건씩 쪽 넘김)
   분야별 최신 정보 메뉴는 '요즘 새로 나온 것', 여기는 '처음부터 전부 찾아보기' */
(async function () {
  'use strict';
  var h = D.h;
  var CATS = [['permit', '인허가·제도'], ['research', '연구·과제'], ['disclosure', '공시·조달'], ['market', '뉴스']];
  var p = new URLSearchParams(location.search);
  var cat = CATS.some(function (c) { return c[0] === p.get('cat'); }) ? p.get('cat') : 'permit';
  var main = await D.boot('list');  // 왼쪽 메뉴 › 분야별 최신 정보 › 전체 보기
  if (!main) return;
  var label = CATS.filter(function (c) { return c[0] === cat; })[0][1];
  var PER = 100;
  var st = { q: p.get('q') || '', kind: p.get('kind') || '', from: p.get('from') || '', to: p.get('to') || '', page: Math.max(1, Number(p.get('page')) || 1) };

  var qIn = h('input', { type: 'search', class: 'input', id: 'l-q', value: st.q, placeholder: '제목·기업·내용(본문·첨부 포함)', onkeydown: function (e) { if (e.key === 'Enter') go(1); } });
  var kindSel = h('select', { class: 'input', id: 'l-kind' }, h('option', { value: '', text: '전체 종류' }));
  var fromIn = h('input', { type: 'date', class: 'input', id: 'l-from', value: st.from, max: D.today() });
  var toIn = h('input', { type: 'date', class: 'input', id: 'l-to', value: st.to, max: D.today() });
  var listBox = h('section', { class: 'card', 'aria-labelledby': 'l-h' });

  D.set(main,
    D.header(label + ' 전체 리스트', '처음 수집한 정보부터 지금까지 모두 · 최신순 · 최근 소식만 보려면 「분야별 최신 정보」 메뉴'),
    h('div', { class: 'tabs', role: 'tablist', 'aria-label': '분야' }, CATS.map(function (c) {
      return h('a', { class: 'tab', role: 'tab', href: 'list.html?cat=' + c[0], 'aria-selected': c[0] === cat ? 'true' : 'false', text: c[1] });
    })),
    h('section', { class: 'card list-filter', 'aria-label': '찾기' },
      h('div', { class: 'top' },
        h('label', { class: 'field grow', for: 'l-q' }, '검색어', qIn),
        h('label', { class: 'field', for: 'l-kind' }, '종류', kindSel),
        h('label', { class: 'field', for: 'l-from' }, '시작일 (비우면 처음부터)', fromIn),
        h('label', { class: 'field', for: 'l-to' }, '끝일 (비우면 오늘)', toIn),
        h('div', { class: 'field btns' },
          h('button', { type: 'button', class: 'btn primary', text: '검색', onclick: function () { go(1); } }),
          h('button', { type: 'button', class: 'btn', text: '초기화', onclick: function () { qIn.value = ''; kindSel.value = ''; fromIn.value = ''; toIn.value = ''; go(1); } })))),
    listBox);

  // 종류별 건수 (선택 칸에 같이)
  D.rpc('dash_list_kinds', { p_category: cat }).then(function (ks) {
    D.set(kindSel, h('option', { value: '', text: '전체 종류' }), ks.map(function (k) { return h('option', { value: k.kind, text: k.kind + ' (' + D.num(k.item_count) + ')' }); }));
    if (st.kind && !ks.some(function (k) { return k.kind === st.kind; })) kindSel.appendChild(h('option', { value: st.kind, text: st.kind }));
    kindSel.value = st.kind;
  }).catch(function (e) { console.error(e); });
  kindSel.addEventListener('change', function () { go(1); });

  function save() {
    var q = new URLSearchParams();
    q.set('cat', cat);
    if (st.q) q.set('q', st.q);
    if (st.kind) q.set('kind', st.kind);
    if (st.from) q.set('from', st.from);
    if (st.to) q.set('to', st.to);
    if (st.page > 1) q.set('page', st.page);
    history.replaceState(null, '', '?' + q.toString());
  }
  function go(page) {
    st.q = qIn.value.trim(); st.kind = kindSel.value; st.from = fromIn.value; st.to = toIn.value; st.page = page;
    if (st.from && st.to && st.from > st.to) { D.set(listBox, h('p', { class: 'notice error', text: '시작일이 끝일보다 앞이어야 합니다.' })); return; }
    save(); load();
  }
  function titleLink(f) {
    var t = D.clean(f.title) || '(제목 없음)';
    return /^news:/.test(f.item_key) && f.url
      ? h('a', { class: 'list-title', href: f.url, target: '_blank', rel: 'noopener noreferrer', title: '언론사 원문 (새 창)', text: t })
      : h('a', { class: 'list-title', href: D.itemHref(f.item_key), text: t });
  }
  function pager(total) {
    var pages = Math.max(1, Math.ceil(total / PER));
    if (pages <= 1) return null;
    var nums = [], lo = Math.max(1, st.page - 4), hi = Math.min(pages, lo + 8);
    lo = Math.max(1, hi - 8);
    for (var i = lo; i <= hi; i++) nums.push(i);
    function btn(n, text, dis) {
      return h('button', { type: 'button', class: 'btn small' + (n === st.page && !text ? ' primary' : ''), text: text || String(n), disabled: dis || null,
        'aria-current': n === st.page && !text ? 'page' : null, onclick: function () { go(n); listBox.scrollIntoView({ block: 'start' }); } });
    }
    return h('nav', { class: 'pager', 'aria-label': '쪽 넘기기' }, btn(1, '« 처음', st.page === 1), btn(st.page - 1, '‹ 이전', st.page === 1),
      nums.map(function (n) { return btn(n); }), btn(st.page + 1, '다음 ›', st.page === pages), btn(pages, '끝 »', st.page === pages),
      h('span', { class: 'note', text: st.page + ' / ' + D.num(pages) + '쪽' }));
  }
  async function load() {
    D.set(listBox, D.loading());
    var rows;
    try {
      rows = await D.rpc('dash_list', { p_category: cat, p_kind: st.kind || null, p_query: st.q || null, p_from: st.from || null, p_to: st.to || null,
        p_offset: (st.page - 1) * PER, p_limit: PER });
    } catch (e) { D.set(listBox, D.fail(e)); return; }
    var total = rows.length ? Number(rows[0].total_count) : 0;
    if (!rows.length && st.page > 1 && total === 0) { /* 범위 밖 쪽 */ }
    D.set(listBox,
      h('div', { class: 'card-head' }, h('h2', { id: 'l-h', text: st.kind || '전체' }),
        h('span', { class: 'note', text: '모두 ' + D.num(total) + '건' + (total ? ' · ' + D.num((st.page - 1) * PER + 1) + '~' + D.num((st.page - 1) * PER + rows.length) + '번째' : '') + ' · 최신순' })),
      rows.length ? h('div', { class: 'table-wrap' }, h('table', { class: 'grid list-table' },
        h('thead', null, h('tr', null, ['날짜', '종류', '기업', '제목', '출처', ''].map(function (t, i) { return h('th', { scope: 'col', class: ['w-date', 'w-kind', 'w-co', null, 'w-pub', 'w-star'][i], text: t }); }))),
        h('tbody', null, rows.map(function (f) {
          return h('tr', null,
            h('td', { class: 'nowrap', text: f.item_date || '-' }),
            h('td', null, D.catBadge(f.category, f.kind)),
            h('td', null, f.company_name ? D.companyLink(f.company_id, f.company_name) : h('span', { class: 'note', text: '-' })),
            h('td', { class: 'wrap' }, titleLink(f), D.isNewItem(f) ? D.badge('NEW', 'new') : null),
            h('td', { class: 'nowrap', text: f.source_label || '-' }),
            h('td', null, D.favButton('item', f.item_key, D.clean(f.title), { small: true })));
        })))) : D.empty(st.q ? '"' + st.q + '" 이(가) 들어간 정보가 없습니다.' : '정보가 없습니다.'),
      pager(total));
  }
  load();
})();
