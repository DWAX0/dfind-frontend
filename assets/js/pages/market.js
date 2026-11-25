/* 05 시장·투자 동향: 언론사 RSS · 네이버 뉴스 (투자·병원 협력·전시)
   [주요 뉴스] 많이 보도된 소식 3건 (요약 포함) → [종류별 표] 제목 · 구분 · 언론사 · 게재일 */
(function () {
  'use strict';
  var h = D.h;
  var KINDS = ['투자', '병원 협력', '전시·해외', 'R&D 과제', '논문·연구', '뉴스'];

  function titleCell(g, q) {
    var f = g.f;
    return h('td', { class: 'news-title' },
      h('a', { class: 'list-title', href: D.itemHref(f.item_key), text: D.clean(f.title) || '(제목 없음)' }),
      D.isNewItem(f) ? D.badge('NEW', 'new') : null,
      D.foundInside(f, q) ? D.badge('본문에서 찾음', 'warn') : null,
      f.company_name || g.dups.length ? h('span', { class: 'list-meta' }, D.companyLink(f.company_id, f.company_name),
        g.dups.length ? h('span', { class: 'note', text: '같은 소식 ' + (g.dups.length + 1) + '건' }) : null) : null);
  }
  function kwOf(ctx, g) {
    var all = [];
    [g.f].concat(g.dups).forEach(function (f) { (ctx.kw[f.item_key] || []).forEach(function (k) { if (!all.some(function (x) { return x.keyword === k.keyword; })) all.push(k); }); });
    return all;
  }
  function table(groups, ctx, opts) {
    var o = opts || {};
    return h('div', { class: 'table-wrap' }, h('table', { class: 'grid news-table' },
      h('thead', null, h('tr', null, h('th', { scope: 'col', text: '제목' }), h('th', { scope: 'col', class: 'w-kw', text: '키워드' }),
        h('th', { scope: 'col', class: 'w-pub', text: '언론사' }), h('th', { scope: 'col', class: 'w-date', text: '게재일' }), h('th', { scope: 'col', class: 'w-star' }, h('span', { class: 'sr', text: '스크랩' })))),
      h('tbody', null, groups.map(function (g) {
        var f = g.f;
        return h('tr', null, titleCell(g, ctx.q),
          h('td', null, ctx.kw ? D.keywordChips(kwOf(ctx, g), 3) : h('span', { class: 'note', text: '…' })),
          h('td', { text: f.source_label || '' }),
          h('td', { class: 'nowrap', text: D.fmt(f.item_date) }),
          h('td', null, D.favButton('item', f.item_key, D.clean(f.title), { small: true })));
      }))), o.more || null);
  }
  function lead(groups, ctx) {
    // 많이 보도된(묶인 기사 수가 많은) 소식 → 최근 순
    var top = groups.slice().sort(function (a, b) { return b.dups.length - a.dups.length || String(b.f.item_date).localeCompare(String(a.f.item_date)); }).slice(0, 3);
    if (!top.length) return null;
    return h('section', { class: 'card lead-news', 'aria-labelledby': 'lead-h' },
      h('div', { class: 'card-head' }, h('h2', { id: 'lead-h', text: '주요 뉴스' }), h('span', { class: 'note', text: '여러 곳에서 보도된 소식 순' })),
      h('div', { class: 'lead-list' }, top.map(function (g, i) {
        var f = g.f;
        return h('article', { class: 'lead-item' + (i === 0 ? ' first' : '') },
          h('div', { class: 'list-meta' }, D.catBadge(f.category, f.kind), D.isNewItem(f) ? D.badge('NEW', 'new') : null,
            ctx.kw ? D.keywordChips(kwOf(ctx, g), 3) : null,
            D.favButton('item', f.item_key, D.clean(f.title), { small: true, right: true })),
          h('a', { class: 'lead-title', href: D.itemHref(f.item_key), text: D.clean(f.title) }),
          f.detail ? h('p', { class: 'lead-summary', text: D.clean(f.detail).slice(0, i === 0 ? 260 : 140) }) : null,
          h('p', { class: 'note' }, [f.source_label, D.fmt(f.item_date)].filter(Boolean).join(' · '),
            g.dups.length ? ' · 같은 소식 ' + (g.dups.length + 1) + '건' : '',
            f.company_name ? ' · ' : '', D.companyLink(f.company_id, f.company_name)));
      })));
  }

  D.categoryPage({
    page: 'market', category: null, dot: 'market', title: '뉴스', defaultPer: '7', groupable: true,
    only: function (f) { return /^news:/.test(f.item_key); },
    sub: '수집한 기사 전체 — 투자 · 병원 협력 · 전시 · R&D · 논문 · 업계 뉴스 (기사 날짜 기준) · 같은 사건은 한 줄로 묶음',
    notice: '네이버 검색 기사는 이용 약관에 따라 20일이 지나면 자동으로 지워집니다. 기사 본문은 저작권 때문에 원본 사이트에서 봅니다. NEW = 마지막 뉴스 수집 이후 새로 들어온 기사.',
    kinds: KINDS,
    kindNotes: { '투자': '네이버 투자 검색', '병원 협력': '네이버 병원 검색', '전시·해외': '네이버 전시 검색', 'R&D 과제': '네이버 R&D 검색', '논문·연구': '논문 관련 기사', '뉴스': '언론사 RSS 등' },
    searchHint: '기업·제목·기사 요약', emptyText: '이 기간에 시장·투자 소식이 없습니다.',
    renderList: function (card, groups, ctx, api) {
      card.className = 'card';
      // 키워드는 목록을 새로 불러올 때마다 한 번 (다 오면 다시 그림)
      if (ctx.kwRows !== ctx.rows) {
        ctx.kwRows = ctx.rows; ctx.kw = null;
        var rows = ctx.rows;
        D.loadNewsKeywords(rows).then(function (by) { if (ctx.kwRows === rows) { ctx.kw = by; api.redraw(); } });
      }
      if (!groups.length) {
        D.set(card, h('h2', { id: 'list-h', text: '뉴스' }), D.empty(ctx.q ? '"' + ctx.q + '" 이(가) 들어간 기사가 없습니다.' : '이 기간에 시장·투자 소식이 없습니다.'));
        return;
      }
      // 종류를 골랐거나 검색 중이면 표 하나로 전부
      if (ctx.kind !== 'all' || ctx.q) {
        D.set(card, h('div', { class: 'card-head' }, h('h2', { id: 'list-h', text: ctx.kind === 'all' ? '검색 결과' : ctx.kind }),
          h('span', { class: 'note', text: groups.length + '건 · 최신순' }),
          ctx.kind !== 'all' ? h('button', { type: 'button', class: 'btn small right', text: '전체 종류 보기', onclick: function () { api.pick('all'); } }) : null),
        table(groups.slice(0, ctx.shown), ctx, { more: groups.length > ctx.shown
          ? h('button', { type: 'button', class: 'btn more', text: '60건 더 보기', onclick: function () { ctx.shown += 60; api.redraw(); } }) : null }));
        return;
      }
      card.className = 'stack';
      var kinds = KINDS.concat(groups.map(function (g) { return g.f.kind; }).filter(function (k, i, a) { return KINDS.indexOf(k) < 0 && a.indexOf(k) === i; }));
      D.set(card, lead(groups, ctx), kinds.map(function (k) {
        var list = groups.filter(function (g) { return g.f.kind === k; });
        if (!list.length) return null;
        return h('section', { class: 'card', 'aria-label': k },
          h('div', { class: 'card-head' }, h('h2', null, h('span', { class: 'dot dot-market' }), ' ' + k), h('span', { class: 'note', text: list.length + '건' }),
            list.length > 8 ? h('button', { type: 'button', class: 'btn small right', text: '더 보기 (' + list.length + '건)', onclick: function () { api.pick(k); card.scrollIntoView({ block: 'start' }); } }) : null),
          table(list.slice(0, 8), ctx));
      }));
    }
  });
})();
