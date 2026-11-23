/* 02 기업 레이더: 평가 기준 공개 + 기준일 점수·순위 (dash_company_scores, 임시 계산 v0) */
(async function () {
  'use strict';
  var main = await D.boot('radar');
  if (!main) return;
  var h = D.h;
  var TODAY = D.today();
  var params = new URLSearchParams(location.search);
  var st = { asOf: params.get('date') || TODAY, filter: 'all', search: '', shown: 50, open: {} };
  var rows = [];

  var CRIT = [
    { key: 's_pipeline', ev: 'pipeline', name: '파이프라인', max: 40, cls: 'c1', bar: 'b1',
      rules: ['혁신의료기기 지정 +20', '신의료기술·평가 유예 +12', '허가 1건당 +4 (최대 8)'] },
    { key: 's_stage', ev: 'stage', name: '기업 단계', max: 20, cls: 'c2', bar: 'b2',
      rules: ['업허가 후 3~10년 +5', '투자 단계 +10 · 상장 전 +5 (DART·투자 수집 후)'] },
    { key: 's_signal', ev: 'signal', name: '선행 신호', max: 25, cls: 'c3', bar: 'b3',
      rules: ['최근 90일 임상시험 승인 +8', '최근 90일 혁신 지정 +6 · 허가 +5', 'R&D·투자·병원 실증 (뉴스 연결 후)'] },
    { key: 's_wear', ev: 'wear', name: '웨어러블 적합', max: 15, cls: 'c4', bar: 'b4',
      rules: ['제품·사용목적에 착용형 표현 +8', '생체신호 측정 +4', '관심 키워드 일치 +3'] }
  ];

  var dateInput = h('input', { type: 'date', class: 'input', value: st.asOf, max: TODAY, id: 'asof',
    onchange: function (e) { if (e.target.value) { st.asOf = e.target.value; save(); load(); } } });
  var listCard = h('section', { class: 'card', 'aria-labelledby': 'list-h' });
  D.set(main, 
    D.header('기업 레이더', '조기 발굴 점수(100점) 높은 순 · 기준일의 점수와 순위 · 변동은 전날 대비', {
      right: h('div', { class: 'group' }, h('label', { class: 'field', for: 'asof' }, '기준일 (그날 점수·순위)', dateInput),
        h('button', { type: 'button', class: 'btn', text: '오늘', onclick: function () { st.asOf = TODAY; dateInput.value = TODAY; save(); load(); } }))
    }),
    h('section', { class: 'card', 'aria-labelledby': 'crit-h' },
      h('div', { class: 'card-head' }, h('h2', { id: 'crit-h', text: '평가 기준' }),
        h('span', { class: 'note', text: '4가지 항목 합계 100점' }), D.badge('임시 계산 v0 · 배점 확정 전', 'warn')),
      h('div', { class: 'crit' }, CRIT.map(function (c) {
        return h('div', { class: c.cls }, h('div', { class: 'crit-head' }, h('span', { text: c.name }), h('span', { class: 'crit-max', text: c.max + '점' })),
          h('ul', null, c.rules.map(function (x) { return h('li', { text: x }); })));
      })),
      h('p', { class: 'note', text: '지금은 이머디·식약처·NECA 수집 결과로 계산합니다. 투자·상장·뉴스 연결은 통합 파이프라인(6단계) 뒤에 반영됩니다.' })),
    listCard);

  function save() { var q = new URLSearchParams(location.search); q.set('date', st.asOf); history.replaceState(null, '', '?' + q.toString()); }

  async function load() {
    D.set(listCard, D.loading());
    try { rows = await D.rpc('dash_company_scores', { p_as_of: st.asOf }); } catch (e) { D.set(listCard, D.fail(e)); return; }
    st.shown = 50;
    draw();
  }

  function filtered() {
    var s = st.search.trim().toLowerCase();
    var week = D.addDays(st.asOf, -6);
    return rows.filter(function (r) {
      if (s && r.company_name.toLowerCase().indexOf(s) < 0) return false;
      if (st.filter === 'star') return r.has_innovation;
      if (st.filter === 'recent') return r.recent_date && r.recent_date >= week;
      if (st.filter === 'up') return r.delta > 0;
      return true;
    });
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
      up: rows.filter(function (r) { return r.delta > 0; }).length
    };
    var chips = h('div', { class: 'chips', role: 'group', 'aria-label': '걸러 보기' },
      [['all', '전체'], ['star', '★ 혁신 지정'], ['recent', '최근 7일 신호'], ['up', '점수 오른 기업']].map(function (f) {
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
        body.appendChild(h('tr', null,
          h('td', { class: 'rank', text: r.rank }),
          h('td', null, r.has_innovation ? D.badge('★ 혁신', 'star') : null, ' ',
            h('a', { class: 'company-link', href: D.companyHref(r.company_id), text: r.company_name }),
            r.field ? h('span', { class: 'list-meta', text: r.field }) : null),
          h('td', null, h('span', { class: 'score', text: r.total }), bar),
          CRIT.map(function (c) { return h('td', { class: 'num-cell', text: r[c.key] }); }),
          h('td', { class: 'signal', text: [r.recent_signal, D.fmt(r.recent_date)].filter(Boolean).join(' · ') }),
          h('td', null, delta(r.delta)),
          h('td', null, h('button', { type: 'button', class: 'btn small', 'aria-expanded': opened ? 'true' : 'false', text: opened ? '근거 닫기' : '근거',
            onclick: function () { st.open[r.company_id] = !opened; drawTable(); } }))));
        if (opened) {
          body.appendChild(h('tr', { class: 'detail' }, h('td'), h('td', { colspan: '9' },
            h('dl', { class: 'info' }, CRIT.map(function (c) {
              var ev = r.evidence && r.evidence[c.ev] ? Object.values(r.evidence[c.ev]) : [];
              return [h('dt', { text: c.name + ' ' + r[c.key] + '/' + c.max }), h('dd', { text: ev.join(' · ') || '해당 없음' })];
            })))));
        }
      });
      var head = h('thead', null, h('tr', null, h('th', { scope: 'col', text: '순위' }), h('th', { scope: 'col', text: '기업' }),
        h('th', { scope: 'col', text: '점수' }), CRIT.map(function (c) { return h('th', { scope: 'col', class: c.cls, text: c.name }); }),
        h('th', { scope: 'col', text: '최근 신호' }), h('th', { scope: 'col', text: '변동' }), h('th', { scope: 'col', text: '' })));
      D.set(tableBox, h('div', { class: 'table-wrap' }, h('table', { class: 'grid' }, head, body)),
        h('p', { class: 'note', text: list.length + '곳 중 ' + Math.min(st.shown, list.length) + '곳 표시 · ★ 혁신 = 혁신의료기기 지정 제품 보유' }),
        list.length > st.shown ? h('button', { type: 'button', class: 'btn more', text: '50곳 더 보기', onclick: function () { st.shown += 50; drawTable(); } }) : null);
    }
    drawTable();
  }
  save();
  load();
})();
