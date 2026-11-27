/* 05 뉴스: 언론사 RSS · 네이버 뉴스
   분류 = 관리자 › 기준 정보 › 뉴스 분류 의 키워드로 정함 (그 외는 경쟁사·파트너사), 공통 태그 AI
   [주요 뉴스] 많이 보도된 소식 3건 (요약 포함) → [분류별 표] 대표 키워드 · 매체명 · 기사명 · 업로드 일자
   기사명을 누르면 바로 언론사 원문 (새 창) */
(function () {
  'use strict';
  var h = D.h;
  var KINDS = ['인허가·정책', '투자', '병원·임상', '연구·R&D', '제품·출시', '전시·해외', '경쟁사·파트너사'];

  // 기사명 링크: 원문(언론사)으로 바로, 새 창. 주소가 없을 때만 대시보드 상세
  // 제목: 대웅·대웅제약은 주황 굵게, 분류를 정한 키워드는 검정 굵게
  function articleLink(f, cls, ctx) {
    var term = ctx ? tagOf(ctx, { item_key: f.kind_from || f.item_key }).term : null;
    var a = f.url ? h('a', { class: cls, href: f.url, target: '_blank', rel: 'noopener noreferrer', title: '언론사 원문 (새 창)' })
                  : h('a', { class: cls, href: D.itemHref(f.item_key) });
    D.newsTitle(f.title, term).forEach(function (x) { a.appendChild(typeof x === 'string' ? document.createTextNode(x) : x); });
    return a;
  }
  function tagOf(ctx, f) { return (ctx.tags || {})[f.item_key] || {}; }
  function aiTag(ctx, g) {
    return [g.f].concat(g.dups).some(function (f) { return tagOf(ctx, f).ai; }) ? h('span', { class: 'kw kw-ai', title: '공통 태그: AI·인공지능·딥러닝 등', text: 'AI' }) : null;
  }
  function topicChip(ctx, f) {
    var t = tagOf(ctx, { item_key: f.kind_from || f.item_key });
    return h('span', { class: 'kw kw-topic', title: t.term ? '‘' + t.term + '’ 키워드로 분류' : '분류 키워드가 없는 기사', text: f.kind || '경쟁사·파트너사' });
  }

  function titleCell(g, q, ctx) {
    var f = g.f;
    return h('td', { class: 'news-title' },
      articleLink(f, 'list-title', ctx),
      D.isNewItem(f) ? D.badge('NEW', 'new') : null,
      aiTag(ctx, g),
      D.foundInside(f, q) ? D.badge('본문에서 찾음', 'warn') : null,
      f.company_name ? h('span', { class: 'list-meta' }, D.companyLink(f.company_id, f.company_name)) : null,
      D.dupToggle(g.dups));
  }
  function table(groups, ctx, opts) {
    var o = opts || {};
    return h('div', { class: 'table-wrap' }, h('table', { class: 'grid news-table' },
      h('thead', null, h('tr', null, h('th', { scope: 'col', class: 'w-topic', text: '대표 키워드' }), h('th', { scope: 'col', class: 'w-pub', text: '매체명' }),
        h('th', { scope: 'col', text: '기사명' }), h('th', { scope: 'col', class: 'w-date', text: '업로드 일자' }), h('th', { scope: 'col', class: 'w-star' }, h('span', { class: 'sr', text: '스크랩' })))),
      h('tbody', null, groups.map(function (g) {
        var f = g.f;
        return h('tr', null,
          h('td', null, topicChip(ctx, f)),
          h('td', { class: 'nowrap' }, D.pubName(f.source_label)),
          titleCell(g, ctx.q, ctx),
          h('td', { class: 'nowrap', text: f.item_date || '' }),
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
          h('div', { class: 'list-meta' }, topicChip(ctx, f), D.isNewItem(f) ? D.badge('NEW', 'new') : null, aiTag(ctx, g),
            D.favButton('item', f.item_key, D.clean(f.title), { small: true, right: true })),
          articleLink(f, 'lead-title', ctx),
          f.detail ? h('p', { class: 'lead-summary', text: D.clean(f.detail).slice(0, i === 0 ? 260 : 140) }) : null,
          h('p', { class: 'note' }, D.pubName(f.source_label), f.item_date ? ' · ' + D.fmt(f.item_date) : '',
            g.dups.length ? ' · 외 ' + g.dups.length + '건 (같은 기사)' : '',
            f.company_name ? ' · ' : '', D.companyLink(f.company_id, f.company_name)));
      })));
  }

  D.categoryPage({
    page: 'market', category: null, dot: 'market', title: '뉴스', defaultPer: '1', groupable: true, todayChip: true,  // 뉴스는 기본이 오늘
    only: function (f) { return /^news:/.test(f.item_key); },
    sub: '수집한 기사 전체 — 분류 키워드로 인허가·정책 · 투자 · 병원·임상 · 연구·R&D · 제품·출시 · 전시·해외, 그 외는 경쟁사·파트너사 (기사 날짜 기준) · 같은 기사는 매체력이 높은 언론사 기사 한 줄로 묶고 \'외 N건\'으로 접음 (건수·NEW 도 1건) · 기사명을 누르면 언론사 원문',
    notice: '기사 본문은 저작권 때문에 원본 사이트에서 봅니다. NEW = 마지막 뉴스 수집 이후 새로 들어온 기사.',
    kinds: KINDS,
    kindNotes: { '인허가·정책': '허가·식약처·수가 등', '투자': '투자 유치·시리즈·IPO 등', '병원·임상': 'MOU·공급계약·임상 등', '연구·R&D': '과제 선정·특허·논문 등',
                 '제품·출시': '출시·신제품·매출 등', '전시·해외': 'CES·FDA·수출 등', '경쟁사·파트너사': '분류 키워드 없는 기사' },
    searchHint: '기업·제목·기사 요약', emptyText: '이 기간에 시장·투자 소식이 없습니다.',
    renderList: function (card, groups, ctx, api) {
      card.className = 'card';
      // 분류 키워드·AI 태그는 목록을 새로 불러올 때마다 한 번 (다 오면 다시 그림)
      if (ctx.tagRows !== ctx.rows) {
        ctx.tagRows = ctx.rows; ctx.tags = null;
        var rows = ctx.rows;
        D.loadNewsTags(rows).then(function (by) { if (ctx.tagRows === rows) { ctx.tags = by; api.redraw(); } });
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
