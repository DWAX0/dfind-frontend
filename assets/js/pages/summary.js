/* 01 SUMMARY: 오늘의 결론(Claude) · 분야별 건수 · 신기술 확보 감지 · 주목 기업 · 분야별 주요 소식
   날짜 하나만 고름 (기간 선택 없음). 그날 메일과 같은 범위(전날~당일)를 보여주고,
   결론은 매일 9시 작업이 DB(daily_summaries)에 저장해 둔 것을 읽음 — 화면에서는 Claude 를 부르지 않음 */
(async function () {
  'use strict';
  var main = await D.boot('summary');
  if (!main) return;
  var h = D.h;
  var TODAY = D.today();
  var SECURED = ['혁신의료기기 지정', '평가 유예', '신의료기술 평가', '혁신의료기술 평가'];
  var EXPECTED = ['임상시험 승인', '투자', '병원 협력', 'R&D 과제'];

  var titleEl = h('h1', { class: 'title' });
  var subEl = h('p', { class: 'sub' });
  var pastEl = h('p', { class: 'notice', hidden: true });
  var concl = h('section', { class: 'card concl', 'aria-labelledby': 'concl-h' });
  var tiles = h('section', { class: 'tiles', 'aria-label': '분야별 건수' });
  var sense = h('section', { class: 'card', 'aria-labelledby': 'sense-h' });
  var top = h('section', { class: 'card', 'aria-labelledby': 'top-h' });
  var news = h('section', { class: 'card', 'aria-labelledby': 'news-h' });
  var bar = D.periodBar({ dayOnly: true, onChange: load });
  D.set(main, 
    h('header', { class: 'top' }, h('div', { class: 'grow' }, titleEl, subEl, pastEl)),
    bar, concl, tiles, sense, h('div', { class: 'row' }, h('div', { class: 'wide' }, top), h('div', { class: 'wide' }, news)));
  bar.start();

  function settle(p) { return p.then(function (v) { return { ok: true, v: v }; }, function (e) { return { ok: false, e: e }; }); }

  async function load(r) {
    var single = r.from === r.to;
    var d = r.to;
    var feedFrom = single ? D.addDays(d, -1) : r.from;
    titleEl.textContent = !single ? '기간 요약' : d === TODAY ? '오늘의 요약' : Number(d.slice(5, 7)) + '월 ' + Number(d.slice(8)) + '일 요약';
    subEl.textContent = single ? D.fmtLong(d) + ' · 전날과 당일에 발표·승인된 정보' : D.fmt(r.from) + ' ~ ' + D.fmt(r.to) + ' 동안 발표·승인된 정보';
    pastEl.hidden = !(single && d < TODAY);
    pastEl.textContent = '지난 날짜입니다. 결론은 그날 오전 9시 메일과 같은 내용입니다.';
    [concl, tiles, sense, top, news].forEach(function (el) { D.set(el, D.loading()); });

    var res = await Promise.all([
      settle(D.rpc('dash_feed_counts', { p_from: feedFrom, p_to: d })),
      settle(D.q(D.sb.from('daily_summaries').select('*').eq('kind', 'daily').gte('summary_date', single ? d : r.from)
        .lte('summary_date', d).order('summary_date', { ascending: false }))),
      settle(D.rpc('dash_company_scores', { p_as_of: d })),
      settle(D.rpc('dash_feed', { p_from: D.addDays(d, -27), p_to: d, p_category: null, p_limit: 2000 })),
      settle(D.rpc('dash_feed', { p_from: feedFrom, p_to: d, p_category: null, p_limit: 600 }))
    ]);
    drawConclusions(res[1], single, d, r);
    drawTiles(res[0], res[2], '?per=range&from=' + feedFrom + '&to=' + d);
    drawSense(res[3], d);
    drawTop(res[2]);
    drawNews(res[4]);
    if (res[0].ok) {
      var total = res[0].v.reduce(function (s, x) { return s + Number(x.item_count); }, 0);
      subEl.textContent += ' ' + D.num(total) + '건';
    }
  }

  function refLinks(refs) {
    if (!refs || !refs.length) return null;
    return h('span', { class: 'refs' }, '근거:', refs.map(function (f) {
      var label = (f.kind ? f.kind + ' · ' : '') + D.clean(f.title || '').slice(0, 40);
      if (f.url) return h('a', { href: f.url, target: '_blank', rel: 'noopener noreferrer', text: label });
      if (f.company_id) return h('a', { href: D.companyHref(f.company_id), text: label });
      return h('span', { text: label });
    }));
  }
  function sentenceList(row) {
    return h('ol', null, (row.conclusions || []).map(function (c, i) {
      return h('li', null, h('span', { class: 'num', text: i + 1 }), h('span', null, c.text, h('br'), refLinks(c.refs)));
    }));
  }
  /* 관리자: 수집이 끝난 뒤 '요약 만들기' (1단계: 규칙 방식, 비용 없음). 2단계에서 Claude API 로 바뀜 */
  function makeButton(d, row, range) {
    if (D.role !== 'admin') return null;
    var label = row ? '요약 다시 만들기' : '요약 만들기';
    var msg = h('span', { class: 'note', role: 'status' });
    var btn = h('button', { type: 'button', class: 'btn primary small', onclick: async function () {
      var force = false;
      if (row && row.model === 'claude-app') {
        if (!window.confirm('담당자가 직접 입력한 결론이 있습니다. 규칙 요약으로 바꿀까요?')) return;
        force = true;
      }
      btn.disabled = true; msg.textContent = '만드는 중…';
      try {
        var r = await D.rpc('admin_make_summary', { p_date: d, p_force: force });
        msg.textContent = r && r.status === 'kept' ? '직접 입력한 결론이 있어 그대로 두었습니다.' : '만들었습니다.';
        load(range);
      } catch (e) { msg.textContent = '만들지 못했습니다: ' + (e.message || e); btn.disabled = false; }
    } }, D.svg('M4 4v6h6M20 20v-6h-6M5 15a7 7 0 0 0 12 3M19 9a7 7 0 0 0-12-3', 18), label);
    return h('span', { class: 'chips right' }, msg, btn);
  }
  function drawConclusions(r, single, d, range) {
    var head = h('div', { class: 'card-head' }, h('h2', { id: 'concl-h', text: single ? '오늘의 결론' : '기간 동안의 결론 (날짜별)' }),
      single ? D.badge('메일 본문 첫 단락', 'ok') : null,
      h('span', { class: 'note', id: 'concl-how' }));
    var mk = single && r.ok ? makeButton(d, r.v[0], range) : null;
    if (mk) head.appendChild(mk);
    if (!r.ok) { D.set(concl, head, D.fail(r.e)); return; }
    var rows = r.v;
    var m = rows[0] && rows[0].model;
    var how = m === 'claude-app' ? '담당자가 Claude 앱으로 수집 결과를 정리해 입력 · 네이버 검색 기사는 약관에 따라 제외'
      : m && m !== 'rule-based' ? 'Claude 가 수집 결과를 읽고 정리 · 네이버 검색 기사는 약관에 따라 제외'
      : '수집 결과를 규칙에 따라 자동 정리 (혁신 지정 → 임상 승인 → 투자 → 허가 순)' + (D.role === 'admin' ? ' · 관리자 › 오늘의 결론 입력에서 바꿀 수 있음' : '');
    head.querySelector('#concl-how').textContent = how;
    if (!rows.length) {
      D.set(concl, head, D.empty(single ? '이날 요약이 아직 없습니다. 수집이 끝난 뒤 관리자가 \'요약 만들기\'를 누르면 만들어집니다.' : '이 기간에 만들어진 요약이 없습니다.'));
      return;
    }
    if (single) {
      var row = rows[0];
      if (row.status === 'failed') D.set(concl, head, h('p', { class: 'notice error', text: '이날 요약을 만들지 못했습니다. 관리자 › 로그 관리 › Claude 요약에서 원인을 확인하세요.' }));
      else D.set(concl, head, sentenceList(row));
      return;
    }
    D.set(concl, head, rows.filter(function (x) { return x.status !== 'failed'; }).map(function (row) {
      return h('div', { class: 'day-block' }, h('h3', { text: D.fmtLong(row.summary_date) }), sentenceList(row));
    }));
  }

  function drawTiles(rc, rs, q) {
    if (!rc.ok) { D.set(tiles, D.fail(rc.e)); return; }
    var by = {};
    rc.v.forEach(function (x) { (by[x.category] = by[x.category] || []).push(x); });
    var kids = ['permit', 'market', 'research', 'disclosure'].map(function (c) {
      var list = (by[c] || []).sort(function (a, b) { return b.item_count - a.item_count; });
      var n = list.reduce(function (s, x) { return s + Number(x.item_count); }, 0);
      return h('a', { class: 'tile', href: D.CAT[c].page + q },
        h('span', { class: 'tile-label' }, h('span', { class: 'dot dot-' + c }), D.CAT[c].label),
        h('span', { class: 'tile-num' }, D.num(n), h('small', { text: '건' })),
        h('span', { class: 'tile-note', text: list.slice(0, 2).map(function (x) { return x.kind + ' ' + x.item_count; }).join(' · ') || (c === 'disclosure' ? 'DART 수집 준비 중' : '없음') }));
    });
    if (rs.ok) {
      var up = rs.v.filter(function (x) { return x.delta > 0; }).length, down = rs.v.filter(function (x) { return x.delta < 0; }).length;
      kids.push(h('a', { class: 'tile', href: 'radar.html' },
        h('span', { class: 'tile-label' }, h('span', { class: 'dot dot-company' }), '점수 바뀐 기업'),
        h('span', { class: 'tile-num' }, D.num(up + down), h('small', { text: '곳' })),
        h('span', { class: 'tile-note', text: '오른 곳 ' + up + ' · 내린 곳 ' + down + ' (전날 대비)' })));
    }
    D.set(tiles, kids);
  }

  function senseItem(f, cls) {
    return h('div', { class: 'sense-item' }, D.badge(f.kind, cls),
      f.company_name ? D.companyLink(f.company_id, f.company_name) : null,
      h('a', { href: D.itemHref(f.item_key), text: D.clean(f.title).slice(0, 60) }),
      h('span', { class: 'when', text: D.fmt(f.item_date) }));
  }
  function drawSense(r, d) {
    var head = h('div', { class: 'card-head' }, h('h2', { id: 'sense-h', text: '신기술 확보 감지' }));
    if (!r.ok) { D.set(sense, head, D.fail(r.e)); return; }
    var sec = r.v.filter(function (f) { return SECURED.indexOf(f.kind) >= 0; });
    var exp = r.v.filter(function (f) { return EXPECTED.indexOf(f.kind) >= 0; });
    head.appendChild(h('span', { class: 'note', text: '최근 4주 (' + D.fmt(D.addDays(d, -27)) + ' ~ ' + D.fmt(d) + ') · 확보 ' + sec.length + '건 · 확보 기대 ' + exp.length + '건' }));
    function col(cls, title, desc, list, badgeCls, page) {
      return h('div', { class: 'sense-col ' + cls }, h('h3', null, title + ' ', h('span', { class: 'note', text: desc })),
        list.length ? list.slice(0, 6).map(function (f) { return senseItem(f, badgeCls); }) : D.empty('없음'),
        list.length > 6 ? h('a', { href: page + '?per=30', text: '전체 ' + list.length + '건 보기' }) : null);
    }
    D.set(sense, head, h('div', { class: 'sense' },
      col('secured', '확보', '혁신의료기기 지정 · 평가 유예 · 신의료기술', sec, 'k-secured', 'regulatory.html'),
      col('expected', '확보 기대', '임상 승인 · R&D · 투자 · 병원 협력', exp, 'k-expected', 'research.html')));
  }

  function drawTop(r) {
    var head = h('div', { class: 'card-head' }, h('h2', { id: 'top-h', text: '주목 기업 TOP 5' }),
      h('a', { class: 'right', href: 'radar.html', text: '기업 레이더 전체' }));
    if (!r.ok) { D.set(top, head, D.fail(r.e)); return; }
    if (!r.v.length) { D.set(top, head, D.empty('점수를 계산할 기업이 없습니다.')); return; }
    var table = h('table', { class: 'grid' }, h('tbody', null, r.v.slice(0, 5).map(function (c) {
      var bar = h('span', { class: 'meter' }, D.width(h('span', { class: 'b1' }), c.total));
      return h('tr', null, h('td', { class: 'rank', text: c.rank }),
        h('td', null, h('a', { class: 'company-link', href: D.companyHref(c.company_id), text: c.company_name }),
          h('span', { class: 'list-meta', text: [c.recent_signal, D.fmt(c.recent_date)].filter(Boolean).join(' · ') })),
        h('td', null, bar),
        h('td', null, h('span', { class: 'score', text: c.total }), h('br'), delta(c.delta)));
    })));
    D.set(top, head, h('div', { class: 'table-wrap' }, table), h('p', { class: 'note', text: '점수는 임시 계산(v0)입니다. 기준은 기업 레이더 화면에 있습니다.' }));
  }
  function delta(n) {
    if (n > 0) return h('span', { class: 'delta-up', text: '▲ ' + n });
    if (n < 0) return h('span', { class: 'delta-down', text: '▼ ' + Math.abs(n) });
    return h('span', { class: 'delta-same', text: '–' });
  }

  function drawNews(r) {
    var head = h('div', { class: 'card-head' }, h('h2', { id: 'news-h', text: '분야별 주요 소식' }));
    if (!r.ok) { D.set(news, head, D.fail(r.e)); return; }
    var pick = [];
    ['permit', 'market', 'research', 'disclosure'].forEach(function (c) {
      var list = r.v.filter(function (f) { return f.category === c; });
      list.sort(function (a, b) { return (b.company_id ? 1 : 0) - (a.company_id ? 1 : 0); });
      pick = pick.concat(list.slice(0, 2));
    });
    D.set(news, head, pick.length ? pick.map(function (f) { return D.feedItem(f, { noDetail: true }); }) : D.empty());
  }
})();
