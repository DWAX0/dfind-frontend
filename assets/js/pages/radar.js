/* 02 기업 레이더: [기준일 업데이트 소식이 있는 기업] → [기업 순위 (순위·점수가 바뀐 기업 먼저)] → 평가 기준
   dash_company_updates · dash_company_scores (임시 계산 v0) */
(async function () {
  'use strict';
  var main = await D.boot('radar');
  if (!main) return;
  var h = D.h;
  var TODAY = D.today();
  var params = new URLSearchParams(location.search);
  var st = { asOf: params.get('date') || TODAY, filter: 'all', search: '', shown: 50, open: {} };
  var rows = [], updates = [];

  var CRIT = D.SCORE_CRIT;   // company-view.js (평가 기준 · 기준별 근거 카드 같이 씀)

  var dateInput = h('input', { type: 'date', class: 'input', value: st.asOf, max: TODAY, id: 'asof',
    onchange: function (e) { if (e.target.value) { st.asOf = e.target.value; save(); load(); } } });
  var listCard = h('section', { class: 'card', 'aria-labelledby': 'list-h' });
  var updCard = h('section', { class: 'card upd-card', 'aria-labelledby': 'upd-h' });
  D.set(main,
    D.header('기업 레이더', '기준일에 새 소식이 있는 기업 → 조기 발굴 점수(100점) 1위부터 · 바뀐 기업만 보려면 \'순위·점수 변동\' · 순위표의 기업 이름을 누르면 오른쪽에 자세히', {
      right: h('div', { class: 'group' }, h('label', { class: 'field', for: 'asof' }, '기준일 (그날 점수·순위)', dateInput),
        h('button', { type: 'button', class: 'btn', text: '오늘', onclick: function () { st.asOf = TODAY; dateInput.value = TODAY; save(); load(); } }))
    }),
    updCard,
    listCard,
    // 평가 기준 (아래로): 항목마다 기준과 배점
    h('section', { class: 'card', 'aria-labelledby': 'crit-h' },
      h('div', { class: 'card-head' }, h('h2', { id: 'crit-h', text: '평가 기준' }),
        h('span', { class: 'note', text: '4가지 항목 합계 100점 · 기업 줄의 ▸ 를 누르면 그 기업이 어떤 기준을 채웠는지 봅니다' }), D.badge('임시 계산 v0 · 배점 확정 전', 'warn')),
      h('div', { class: 'crit' }, CRIT.map(function (c) {
        return h('div', { class: c.cls }, h('div', { class: 'crit-head' }, h('span', { text: c.name }), h('span', { class: 'crit-max', text: c.max + '점' })),
          h('p', { class: 'note', text: c.desc }),
          h('ul', null, c.rules.map(function (x) { return h('li', null, x.label + ' ', h('b', { text: '+' + x.pts }), x.todo ? h('span', { class: 'note', text: ' (수집 준비 중)' }) : null); })));
      })),
      h('p', { class: 'note', text: '지금은 이머디·식약처·NECA 수집 결과로 계산합니다. 투자·상장·뉴스 연결은 통합 파이프라인(6단계) 뒤에 반영됩니다.' })));

  function save() { var q = new URLSearchParams(location.search); q.set('date', st.asOf); history.replaceState(null, '', '?' + q.toString()); }

  async function load() {
    D.set(listCard, D.loading()); D.set(updCard, D.loading());
    var upd = D.rpc('dash_company_updates', { p_date: st.asOf }).catch(function (e) { return { error: e }; });
    try { rows = await D.rpc('dash_company_scores', { p_as_of: st.asOf }); } catch (e) { D.set(listCard, D.fail(e)); return; }
    st.shown = 50;
    draw();
    var u = await upd;
    if (u && u.error) { D.set(updCard, D.fail(u.error)); return; }
    updates = u || [];
    st.updShown = 8;
    drawUpdates();
  }

  /* ---- 기준일 업데이트 소식이 있는 기업 ---- */
  function itemLink(it) {
    var t = D.clean(it.title) || '(제목 없음)';
    // 뉴스는 언론사 원문, 그 밖은 대시보드 정보 보기
    return /^news:/.test(it.item_key) && it.url
      ? h('a', { class: 'upd-title', href: it.url, target: '_blank', rel: 'noopener noreferrer', title: '언론사 원문 (새 창)', text: t })
      : h('a', { class: 'upd-title', href: D.itemHref(it.item_key), text: t });
  }
  function drawUpdates() {
    var byId = {};
    rows.forEach(function (r) { byId[r.company_id] = r; });
    var list = updates.map(function (u) { return Object.assign({ sc: byId[u.company_id] }, u); }).sort(function (a, b) {
      return (a.sc ? a.sc.rank : 1e9) - (b.sc ? b.sc.rank : 1e9) || b.items.length - a.items.length || a.company_name.localeCompare(b.company_name);
    });
    var isToday = st.asOf === TODAY;
    var head = h('div', { class: 'card-head' }, h('h2', { id: 'upd-h', text: (isToday ? '오늘' : D.fmtLong(st.asOf)) + ' 업데이트 소식이 있는 기업' }),
      h('span', { class: 'note', text: list.length + '곳 · 그날 새로 들어왔거나 그날 날짜인 인허가·임상·NECA·공시·뉴스 · 순위 높은 순' }));
    if (!list.length) { D.set(updCard, head, D.empty((isToday ? '오늘' : '이 날') + ' 업데이트된 기업 소식이 없습니다.')); return; }
    D.set(updCard, head, h('ul', { class: 'upd-list' }, list.slice(0, st.updShown).map(function (u) {
      var kinds = {};
      u.items.forEach(function (it) { kinds[it.kind] = (kinds[it.kind] || 0) + 1; });
      var lines = h('ul', { class: 'upd-items' }, u.items.slice(0, 3).map(function (it) {
        return h('li', null, D.catBadge(it.category, it.kind), itemLink(it), it.source_label ? h('span', { class: 'note', text: it.source_label }) : null);
      }));
      var rest = u.items.length > 3 ? h('button', { type: 'button', class: 'link-btn', text: '외 ' + (u.items.length - 3) + '건 더 보기 ▾', onclick: function (e) {
        u.items.slice(3).forEach(function (it) { lines.appendChild(h('li', null, D.catBadge(it.category, it.kind), itemLink(it), it.source_label ? h('span', { class: 'note', text: it.source_label }) : null)); });
        e.currentTarget.remove();
      } }) : null;
      return h('li', { class: 'upd-row' },
        h('div', { class: 'upd-co' },
          h('a', { class: 'company-link upd-name', href: D.companyHref(u.company_id), text: u.company_name }),
          u.sc ? h('span', { class: 'note', text: u.sc.rank + '위 · ' + u.sc.total + '점' }) : h('span', { class: 'note', text: '점수 없음' }),
          u.sc ? rankDelta(u.sc) : null),
        h('div', { class: 'upd-body' },
          h('div', { class: 'upd-kinds' }, Object.keys(kinds).map(function (k) { return h('span', { class: 'upd-kind' }, k, h('b', { text: kinds[k] })); })),
          lines, rest));
    })), list.length > st.updShown ? h('button', { type: 'button', class: 'btn more', text: '더 보기 (' + (list.length - st.updShown) + '곳)', onclick: function () { st.updShown += 20; drawUpdates(); } }) : null);
  }

  // 전날보다 순위나 점수가 바뀐 기업 (새로 들어온 기업 포함)
  function changed(r) { return r.delta !== 0 || r.prev_rank == null || Number(r.prev_rank) !== Number(r.rank); }
  function rankDelta(r) {
    if (r.prev_rank == null) return h('span', { class: 'delta-new', title: '전날 순위에 없던 기업', text: '신규' });
    var d = Number(r.prev_rank) - Number(r.rank);
    if (d > 0) return h('span', { class: 'delta-up', title: '전날 ' + r.prev_rank + '위', text: '▲ ' + d + '위' });
    if (d < 0) return h('span', { class: 'delta-down', title: '전날 ' + r.prev_rank + '위', text: '▼ ' + Math.abs(d) + '위' });
    return null;
  }
  function filtered() {
    var s = st.search.trim().toLowerCase();
    var week = D.addDays(st.asOf, -6);
    return rows.filter(function (r) {
      if (s && r.company_name.toLowerCase().indexOf(s) < 0) return false;
      if (st.filter === 'star') return r.has_innovation;
      if (st.filter === 'recent') return r.recent_date && r.recent_date >= week;
      if (st.filter === 'up') return r.delta > 0;
      if (st.filter === 'changed') return changed(r);
      return true;
    }).sort(function (a, b) { return a.rank - b.rank; });  // 1위부터 순서대로 (변동 기업만 보려면 '순위·점수 변동' 탭)
  }
  function delta(n) {
    if (n > 0) return h('span', { class: 'delta-up', text: '▲ ' + n });
    if (n < 0) return h('span', { class: 'delta-down', text: '▼ ' + Math.abs(n) });
    return h('span', { class: 'delta-same', text: '–' });
  }
  function draw() {
    var list = filtered();
    var week = D.addDays(st.asOf, -6);
    var counts = {
      all: rows.length, star: rows.filter(function (r) { return r.has_innovation; }).length,
      recent: rows.filter(function (r) { return r.recent_date && r.recent_date >= week; }).length,
      up: rows.filter(function (r) { return r.delta > 0; }).length,
      changed: rows.filter(changed).length
    };
    var chips = h('div', { class: 'chips', role: 'group', 'aria-label': '걸러 보기' },
      [['all', '전체'], ['changed', '순위·점수 변동'], ['star', '★ 혁신 지정'], ['recent', '최근 7일 신호'], ['up', '점수 오른 기업']].map(function (f) {
        return h('button', { type: 'button', class: 'chip', 'aria-pressed': st.filter === f[0] ? 'true' : 'false', text: f[1] + ' ' + counts[f[0]],
          onclick: function () { st.filter = f[0]; st.shown = 50; draw(); } });
      }));
    var search = h('input', { type: 'search', class: 'input', id: 'q', placeholder: '기업 이름', value: st.search,
      oninput: function (e) { st.search = e.target.value; st.shown = 50; drawTable(); } });
    var tableBox = h('div');
    D.set(listCard, 
      h('div', { class: 'card-head' }, h('h2', { id: 'list-h', text: '기업 순위' }), h('span', { class: 'note', text: D.fmtLong(st.asOf) + ' 기준' })),
      h('div', { class: 'top' }, chips, h('label', { class: 'field inline right', for: 'q' }, '기업 검색', search)),
      tableBox);
    function drawTable() {
      list = filtered();
      if (!list.length) { D.set(tableBox, D.empty('조건에 맞는 기업이 없습니다.')); return; }
      var body = h('tbody');
      list.slice(0, st.shown).forEach(function (r) {
        var bar = h('span', { class: 'bar' });
        CRIT.forEach(function (c) { bar.appendChild(D.width(h('span', { class: c.bar }), r[c.key])); });
        var opened = !!st.open[r.company_id];
        var summary = D.companySummary(r, st.asOf);
        function toggle() { st.open[r.company_id] = !opened; drawTable(); }
        body.appendChild(h('tr', { class: 'radar-row' + (opened ? ' open' : '') },
          h('td', null, h('button', { type: 'button', class: 'tri-btn', 'aria-expanded': opened ? 'true' : 'false',
            'aria-label': r.company_name + ' 점수 근거 ' + (opened ? '닫기' : '보기'), text: opened ? '▾' : '▸', onclick: toggle })),
          h('td', { class: 'rank', text: r.rank }),
          h('td', { class: 'radar-co' },
            h('div', { class: 'radar-name' }, r.has_innovation ? D.badge('★ 혁신', 'star') : null,
              h('a', { class: 'company-link', href: D.companyHref(r.company_id), text: r.company_name,
                onclick: function (e) { if (e.ctrlKey || e.metaKey || e.shiftKey) return; e.preventDefault(); D.openCompanyDrawer(r.company_id); } })),
            summary ? h('p', { class: 'radar-sum', title: summary, text: summary }) : null),
          h('td', { class: 'radar-score' }, h('span', { class: 'score', text: r.total }), bar),
          CRIT.map(function (c) {
            return h('td', { class: 'crit-cell' }, h('span', { class: 'cc-num' }, h('b', { text: r[c.key] }), h('small', { text: '/' + c.max })),
              h('span', { class: 'cc-bar' }, D.width(h('i', { class: c.bar }), Math.round(r[c.key] / c.max * 100))));
          }),
          h('td', { class: 'signal' }, r.recent_signal ? h('span', { class: 'sig-kind', text: r.recent_signal }) : '–', r.recent_date ? h('span', { class: 'note block', text: D.fmt(r.recent_date) }) : null),
          h('td', { class: 'radar-delta' }, delta(r.delta), rankDelta(r))));
        if (opened) {
          body.appendChild(h('tr', { class: 'detail radar-detail' }, h('td', { colspan: '11' },
            h('div', { class: 'rd-head' }, h('b', { text: r.company_name + ' · 점수 근거' }), h('span', { class: 'note', text: D.fmtLong(st.asOf) + ' 기준 · ✓ 충족 · – 해당 없음 · … 수집 준비 중' }),
              h('button', { type: 'button', class: 'btn small right', text: '기업 정보 보기', onclick: function () { D.openCompanyDrawer(r.company_id); } })),
            D.scoreBreakdown(r, st.asOf))));
        }
      });
      var head = h('thead', null, h('tr', null, h('th', { scope: 'col', 'aria-label': '근거 펼치기' }), h('th', { scope: 'col', text: '순위' }), h('th', { scope: 'col', text: '기업 · 핵심 요약' }),
        h('th', { scope: 'col', text: '점수' }), CRIT.map(function (c) { return h('th', { scope: 'col', class: 'crit-th ' + c.cls, text: c.name }); }),
        h('th', { scope: 'col', text: '최근 신호' }), h('th', { scope: 'col', text: '변동 (점수·순위)' })));
      D.set(tableBox, h('div', { class: 'table-wrap' }, h('table', { class: 'grid radar-table' }, head, body)),
        h('p', { class: 'note', text: list.length + '곳 중 ' + Math.min(st.shown, list.length) + '곳 표시 · ★ 혁신 = 혁신의료기기 지정 제품 보유 · ▸ 를 누르면 기준별 점수와 근거' }),
        list.length > st.shown ? h('button', { type: 'button', class: 'btn more', text: '50곳 더 보기', onclick: function () { st.shown += 50; drawTable(); } }) : null);
    }
    drawTable();
  }
  save();
  load();
})();
