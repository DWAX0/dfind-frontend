/* 수집 현황: [자동 수집 시각(관리자)] [출처별 상태 칸] [대상별 표] [최근 실행] — 기간 1·7·30일 */
(async function () {
  'use strict';
  var main = await D.boot('status');
  if (!main) return;
  var h = D.h;
  var SRC = { mfds_api: '식약처 품목허가 API', mfds: '식약처 사이트', emedi: '이머디', neca: 'NECA', news: '뉴스', khidi: 'KHIDI', dart: 'DART',
    ntis: 'NTIS', g2b: '나라장터', pubmed: 'PubMed', thevc: 'THE VC' };
  var ST = { success: ['정상', 'ok'], empty: ['새 글 없음', 'gray'], partial: ['일부', 'warn'], running: ['실행 중', 'warn'],
    failed: ['실패', 'bad'], structure_error: ['구조 변경', 'bad'], auth_error: ['인증 오류', 'bad'] };
  var days = Number(new URLSearchParams(location.search).get('days')) || 7;
  var tiles = h('section', { class: 'tiles', 'aria-label': '출처별 상태' });
  var table = h('section', { class: 'card', 'aria-labelledby': 'st-h' });
  var runs = h('section', { class: 'card', 'aria-labelledby': 'run-h' });
  var pick = h('div', { class: 'chips', role: 'group', 'aria-label': '기간' }, [1, 7, 30].map(function (n) {
    return h('button', { type: 'button', class: 'chip', 'aria-pressed': n === days ? 'true' : 'false', text: n === 1 ? '오늘·어제' : '최근 ' + n + '일',
      onclick: function () { days = n; history.replaceState(null, '', '?days=' + n); pick.querySelectorAll('.chip').forEach(function (b) { b.setAttribute('aria-pressed', b.textContent === (n === 1 ? '오늘·어제' : '최근 ' + n + '일') ? 'true' : 'false'); }); load(); } });
  }));
  D.set(main, D.header('수집 현황', '출처마다 언제 돌았고, 몇 건을 새로 모았는지, 실패는 없는지 봅니다', { right: pick }),
    D.role === 'admin' ? D.scheduleCard('crawl_daily', '매일 수집 자동 실행 시각') : null,
    h('p', { class: 'note', text: '뉴스는 3시간마다 따로 돕니다 (crawl-news). 아래 시각은 모두 한국 시간입니다.' }),
    tiles, table, runs);
  load();

  function st(s) { var x = ST[s] || [s || '-', 'gray']; return D.badge(x[0], x[1]); }
  async function load() {
    [tiles, table, runs].forEach(function (x) { D.set(x, D.loading()); });
    var res = await Promise.all([D.rpc('dash_crawl_summary', { p_days: days === 1 ? 2 : days }).then(function (v) { return { ok: true, v: v }; }, function (e) { return { e: e }; }),
      D.rpc('dash_crawl_runs', { p_days: days === 1 ? 2 : days }).then(function (v) { return { ok: true, v: v }; }, function (e) { return { e: e }; })]);
    var sum = res[0], rn = res[1];
    if (!sum.ok) { D.set(tiles); D.set(table, D.fail(sum.e)); D.set(runs); return; }
    var by = {};
    sum.v.forEach(function (r) { (by[r.source_system] = by[r.source_system] || []).push(r); });
    D.set(tiles, Object.keys(by).map(function (k) {
      var rows = by[k];
      var bad = rows.filter(function (r) { return ['failed', 'structure_error', 'auth_error'].indexOf(r.last_status) >= 0; }).length;
      var last = rows.map(function (r) { return r.last_started; }).sort().pop();
      var nw = rows.reduce(function (a, r) { return a + r.new_sum; }, 0);
      return h('div', { class: 'tile' + (bad ? ' tile-bad' : '') }, h('span', { class: 'tile-label', text: SRC[k] || k }),
        h('span', { class: 'tile-num' }, D.num(nw), h('small', { text: '건 신규' })),
        h('span', { class: 'tile-note' }, bad ? D.badge('점검 필요 ' + bad, 'bad') : D.badge('정상', 'ok'), ' 마지막 ' + D.fmtTime(last)));
    }));
    D.set(table, h('div', { class: 'card-head' }, h('h2', { id: 'st-h', text: '대상별 상태' }), h('span', { class: 'note', text: sum.v.length + '개 대상' })),
      sum.v.length ? h('div', { class: 'table-wrap' }, h('table', { class: 'grid' },
        h('thead', null, h('tr', null, ['출처', '대상', '마지막 상태', '마지막 실행', '마지막 성공', '실행', '실패', '신규', '변경', '오류 내용'].map(function (x) { return h('th', { scope: 'col', text: x }); }))),
        h('tbody', null, sum.v.map(function (r) {
          return h('tr', null, h('td', { class: 'nowrap', text: SRC[r.source_system] || r.source_system }), h('td', { text: r.target_name || r.target }),
            h('td', null, st(r.last_status)), h('td', { class: 'nowrap', text: D.fmtTime(r.last_started) }),
            h('td', { class: 'nowrap', text: r.last_success ? D.fmtTime(r.last_success) : '–' }),
            h('td', { class: 'num-cell', text: r.runs }), h('td', { class: 'num-cell' + (r.fails ? ' bad' : ''), text: r.fails }),
            h('td', { class: 'num-cell', text: r.new_sum }), h('td', { class: 'num-cell', text: r.updated_sum }),
            h('td', { class: 'err-cell', text: r.last_error || '' }));
        })))) : D.empty('이 기간에 수집 기록이 없습니다.'));
    if (!rn.ok) { D.set(runs, D.fail(rn.e)); return; }
    D.set(runs, h('div', { class: 'card-head' }, h('h2', { id: 'run-h', text: '최근 실행' }), h('span', { class: 'note', text: '출처별 · 30분 안에 시작한 기록은 한 번으로 묶음' })),
      rn.v.length ? h('div', { class: 'table-wrap' }, h('table', { class: 'grid' },
        h('thead', null, h('tr', null, ['시작', '출처', '수집 기간', '대상', '결과', '신규', '변경'].map(function (x) { return h('th', { scope: 'col', text: x }); }))),
        h('tbody', null, rn.v.map(function (r) {
          var bad = r.fails > 0;
          return h('tr', null, h('td', { class: 'nowrap', text: D.fmtTime(r.run_at) }), h('td', { class: 'nowrap', text: SRC[r.source_system] || r.source_system }),
            h('td', { class: 'nowrap', text: (r.window_from ? D.fmtTime(r.window_from) : '?') + ' ~ ' + (r.window_to ? D.fmtTime(r.window_to) : '?') }),
            h('td', { class: 'num-cell', text: r.targets }),
            h('td', null, bad ? D.badge('실패 ' + r.fails, 'bad') : (r.statuses || []).indexOf('running') >= 0 ? st('running') : D.badge('정상', 'ok')),
            h('td', { class: 'num-cell', text: r.new_sum }), h('td', { class: 'num-cell', text: r.updated_sum }));
        })))) : D.empty('이 기간에 실행 기록이 없습니다.'));
  }
})();
