/* 내 스크랩: 내가 ☆ 를 눌러 둔 관심 기업·관심 정보 (계정마다 따로, 다른 사람에게는 안 보임) */
(async function () {
  'use strict';
  var main = await D.boot('scrap');
  if (!main) return;
  var h = D.h;
  var comp = h('section', { class: 'card', 'aria-labelledby': 'fc-h' });
  var items = h('section', { class: 'card', 'aria-labelledby': 'fi-h' });
  D.set(main, D.header('내 스크랩', '기업 목록·정보 화면에서 ☆ 를 누르면 여기에 모입니다. 내 계정에서만 보입니다.', { dot: 'dot-company' }), comp, items);
  async function draw() {
    var rows;
    try { rows = await D.favs(); } catch (e) { D.set(comp, D.fail(e)); return; }
    var cs = rows.filter(function (r) { return r.target_type === 'company'; });
    var is = rows.filter(function (r) { return r.target_type === 'item'; });
    function remove(r) {
      return h('button', { type: 'button', class: 'btn small', text: '해제', onclick: async function (e) {
        e.currentTarget.disabled = true;
        try { await D.toggleFav(r.target_type, r.target_key); } catch (err) { console.error(err); }
        draw();
      } });
    }
    D.set(comp, h('div', { class: 'card-head' }, h('h2', { id: 'fc-h', text: '★ 관심 기업' }), h('span', { class: 'note', text: cs.length + '곳' }),
      h('a', { class: 'right', href: 'company.html?fav=1', text: '기업 목록에서 보기' })),
      cs.length ? h('div', { class: 'table-wrap' }, h('table', { class: 'grid' },
        h('thead', null, h('tr', null, h('th', { text: '기업명' }), h('th', { text: '등록일' }), h('th', null, h('span', { class: 'sr', text: '해제' })))),
        h('tbody', null, cs.map(function (r) {
          return h('tr', null, h('td', null, h('a', { class: 'company-link', href: D.companyHref(r.target_key), text: r.title || ('기업 ' + r.target_key) })),
            h('td', { class: 'nowrap', text: D.fmtTime(r.created_at) }), h('td', null, remove(r)));
        })))) : D.empty('아직 관심 기업이 없습니다. 기업 정보 목록에서 ☆ 를 눌러 보세요.'));
    D.set(items, h('div', { class: 'card-head' }, h('h2', { id: 'fi-h', text: '★ 스크랩한 정보' }), h('span', { class: 'note', text: is.length + '건' })),
      is.length ? is.map(function (r) {
        return h('div', { class: 'list-item' },
          h('div', { class: 'list-meta' }, h('span', { text: '스크랩 ' + D.fmtTime(r.created_at) }), h('span', { class: 'right' }, remove(r))),
          h('a', { class: 'list-title', href: D.itemHref(r.target_key), text: r.title || r.target_key }));
      }) : D.empty('아직 스크랩한 정보가 없습니다. 목록이나 자세히 화면에서 ☆ 를 눌러 보세요.'),
      is.length ? h('p', { class: 'note', text: '네이버 검색 기사는 약관에 따라 20일이 지나면 원본 정보가 지워져 열리지 않을 수 있습니다.' }) : null);
  }
  draw();
})();
