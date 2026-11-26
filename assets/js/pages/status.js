/* 수집 현황 (GitHub Actions 처럼 출처마다 한 줄 ✓/✗ → 누르면 대상별 표 + 실패 상세)
   [자동 수집 시각(관리자)] [요약 칸] [출처 목록: 상태 · 마지막 실행 · 최근 실행 점 · 신규] — 기간 오늘·어제/7일/30일 */
(async function () {
  'use strict';
  var main = await D.boot('status');
  if (!main) return;
  var h = D.h;
  var SRC = { mfds_api: '식약처 품목허가 API', mfds: '식약처 사이트', emedi: '이머디', neca: 'NECA', news: '뉴스', khidi: 'KHIDI', dart: 'DART',
    ntis: 'NTIS', g2b: '나라장터', pubmed: 'PubMed', thevc: 'THE VC' };
  var ORDER = ['mfds_api', 'mfds', 'emedi', 'neca', 'news', 'khidi', 'dart', 'ntis', 'g2b', 'pubmed', 'thevc'];
  var FAIL = ['failed', 'structure_error', 'auth_error'];
  var ST = { success: ['정상', 'ok'], empty: ['새 글 없음', 'gray'], partial: ['일부 실패', 'warn'], running: ['실행 중', 'warn'],
    failed: ['실패', 'bad'], structure_error: ['화면 구조 변경', 'bad'], auth_error: ['인증 오류', 'bad'] };
  var HINT = { structure_error: '출처 사이트 화면이 바뀌어 읽지 못했습니다. 스크래퍼 수정이 필요합니다.',
    auth_error: '인증 키·권한 문제입니다. GitHub Secrets 의 키가 맞는지, 만료되지 않았는지 확인해 주세요.',
    failed: '일시적인 접속 오류일 수 있습니다. 다음 실행에서도 실패하면 오류 내용을 확인해 주세요.',
    partial: '일부 글만 실패했습니다. 나머지는 저장됐고, 실패한 글은 다음 실행에서 다시 시도합니다.' };
  var days = Number(new URLSearchParams(location.search).get('days')) || 7;
  var open = {};
  var tiles = h('section', { class: 'tiles', 'aria-label': '요약' });
  var list = h('section', { class: 'card runs-card', 'aria-labelledby': 'src-h' });
  var LBL = { 1: '오늘·어제', 7: '최근 7일', 30: '최근 30일' };
  var pick = h('div', { class: 'chips', role: 'group', 'aria-label': '기간' }, [1, 7, 30].map(function (n) {
    return h('button', { type: 'button', class: 'chip', 'aria-pressed': n === days ? 'true' : 'false', 'data-n': n, text: LBL[n],
      onclick: function () { days = n; history.replaceState(null, '', '?days=' + n);
        pick.querySelectorAll('.chip').forEach(function (b) { b.setAttribute('aria-pressed', Number(b.getAttribute('data-n')) === n ? 'true' : 'false'); }); load(); } });
  }));
  D.set(main, D.header('수집 현황', '출처마다 언제 돌았고 성공했는지, 실패했다면 왜인지 봅니다 (한국 시간)', { right: pick }),
    D.role === 'admin' ? D.scheduleCard('crawl_daily', '매일 수집 자동 실행 시각') : null, tiles, list);
  load();

  function badge(s) { var x = ST[s] || [s || '-', 'gray']; return D.badge(x[0], x[1]); }
  function icon(kind) {
    var m = { ok: ['M5 12l5 5 9-10', 'st-ok', '성공'], bad: ['M6 6l12 12M18 6L6 18', 'st-bad', '실패'], warn: ['M12 7v6M12 17h.01', 'st-warn', '일부 실패'], run: ['M12 4a8 8 0 1 0 8 8', 'st-run', '실행 중'] }[kind];
    return h('span', { class: 'st-icon ' + m[1], role: 'img', 'aria-label': m[2] }, D.svg(m[0], 18));
  }
  function kindOf(statuses) {
    if (statuses.some(function (s) { return FAIL.indexOf(s) >= 0; })) return 'bad';
    if (statuses.indexOf('running') >= 0) return 'run';
    if (statuses.indexOf('partial') >= 0) return 'warn';
    return 'ok';
  }
  function dur(a, b) { if (!a || !b) return ''; var s = Math.round((new Date(b) - new Date(a)) / 1000); return s < 60 ? s + '초' : Math.round(s / 60) + '분'; }

  async function load() {
    D.set(tiles, D.loading()); D.set(list, D.loading());
    var span = days === 1 ? 2 : days;
    var since = new Date(Date.now() - span * 864e5).toISOString();
    var res;
    try {
      res = await Promise.all([
        D.rpc('dash_crawl_summary', { p_days: span }),
        D.rpc('dash_crawl_runs', { p_days: span }),
        D.q(D.sb.from('v_crawl_status').select('source_system,crawl_log_id,target,search_query,window_from,window_to,started_at,completed_at,status,total_count,fetched_count,new_count,updated_count,error_message')
          .in('status', FAIL.concat(['partial'])).gte('started_at', since).order('started_at', { ascending: false }).limit(300))
      ]);
    } catch (e) { D.set(tiles); D.set(list, D.fail(e)); return; }
    var sum = res[0], runs = res[1], fails = res[2];
    var by = {};
    sum.forEach(function (r) { (by[r.source_system] = by[r.source_system] || { targets: [], runs: [], fails: [] }).targets.push(r); });
    runs.forEach(function (r) { if (by[r.source_system]) by[r.source_system].runs.push(r); });
    fails.forEach(function (r) { if (by[r.source_system]) by[r.source_system].fails.push(r); });
    var srcs = ORDER.filter(function (k) { return by[k]; }).concat(Object.keys(by).filter(function (k) { return ORDER.indexOf(k) < 0; }));
    var nBad = srcs.filter(function (k) { return by[k].targets.some(function (t) { return FAIL.indexOf(t.last_status) >= 0; }); }).length;
    var lastRun = runs.length ? runs[0].run_at : null;
    D.set(tiles,
      tile('출처', srcs.length + '곳', nBad ? '점검 필요 ' + nBad + '곳' : '모두 정상', nBad ? 'tile-bad' : ''),
      tile('마지막 실행', lastRun ? D.fmtTime(lastRun) : '–', lastRun ? (SRC[runs[0].source_system] || runs[0].source_system) : ''),
      tile('실행 횟수', D.num(runs.length) + '번', LBL[days]),
      tile('새로 모은 정보', D.num(sum.reduce(function (a, r) { return a + r.new_sum; }, 0)) + '건', '변경 ' + D.num(sum.reduce(function (a, r) { return a + r.updated_sum; }, 0)) + '건'));
    D.set(list, h('div', { class: 'card-head' }, h('h2', { id: 'src-h', text: '출처별 실행' }), h('span', { class: 'note', text: '줄을 누르면 대상별 결과와 실패 내용을 봅니다' })),
      srcs.length ? h('ul', { class: 'runs' }, srcs.map(function (k) { return srcRow(k, by[k]); })) : D.empty('이 기간에 수집 기록이 없습니다.'));
  }
  function tile(label, num, note, cls) {
    return h('div', { class: 'tile ' + (cls || '') }, h('span', { class: 'tile-label', text: label }), h('span', { class: 'tile-num tile-num-sm', text: num }), h('span', { class: 'tile-note', text: note || '' }));
  }

  function srcRow(k, d) {
    var last = d.runs[0];
    var lastStatuses = d.targets.map(function (t) { return t.last_status; });
    var kind = kindOf(lastStatuses);
    var nFailT = d.targets.filter(function (t) { return FAIL.indexOf(t.last_status) >= 0; }).length;
    var newSum = d.targets.reduce(function (a, t) { return a + t.new_sum; }, 0);
    var body = h('div', { class: 'run-body', hidden: !open[k] });
    var btn = h('button', { type: 'button', class: 'run-head', 'aria-expanded': open[k] ? 'true' : 'false', onclick: function () {
      open[k] = !open[k]; body.hidden = !open[k]; btn.setAttribute('aria-expanded', open[k] ? 'true' : 'false');
      if (open[k] && !body.childNodes.length) D.set(body, detail(k, d));
    } },
      icon(kind),
      h('span', { class: 'run-name' }, h('b', { text: SRC[k] || k }),
        h('span', { class: 'note', text: kind === 'bad' ? '대상 ' + d.targets.length + '개 중 ' + nFailT + '개 실패' : '대상 ' + d.targets.length + '개' + (kind === 'warn' ? ' · 일부 실패' : ' 모두 정상') })),
      h('span', { class: 'run-dots', 'aria-label': '최근 실행 결과' }, d.runs.slice(0, 14).reverse().map(function (r) {
        var kk = r.fails > 0 ? 'bad' : (r.statuses || []).indexOf('running') >= 0 ? 'run' : (r.statuses || []).indexOf('partial') >= 0 ? 'warn' : 'ok';
        return h('i', { class: 'dot-run st-' + kk, title: D.fmtTime(r.run_at) + ' · ' + (kk === 'bad' ? '실패 ' + r.fails : kk === 'warn' ? '일부 실패' : '정상') + ' · 신규 ' + r.new_sum });
      })),
      h('span', { class: 'run-when' }, h('span', { text: last ? D.fmtTime(last.run_at) : '–' }), h('span', { class: 'note', text: last ? '마지막 실행: 대상 ' + last.targets + '개 · 신규 ' + last.new_sum : '' })),
      h('span', { class: 'run-new', title: LBL[days] + ' 동안 새로 저장한 건수', text: LBL[days].replace('최근 ', '') + ' 신규 ' + D.num(newSum) }),
      h('span', { class: 'run-chev', 'aria-hidden': 'true', text: '▾' }));
    if (open[k]) D.set(body, detail(k, d));
    return h('li', { class: 'run run-' + kind }, btn, body);
  }

  function detail(k, d) {
    var targets = h('div', { class: 'table-wrap' }, h('table', { class: 'grid' },
      h('thead', null, h('tr', null, ['', '대상', '마지막 상태', '마지막 실행', '마지막 성공', '실행 수', '실패 수', '신규', '변경'].map(function (x) { return h('th', { scope: 'col', text: x }); }))),
      h('tbody', null, d.targets.map(function (t) {
        var bad = FAIL.indexOf(t.last_status) >= 0;
        return h('tr', { class: bad ? 'row-bad' : null },
          h('td', null, icon(bad ? 'bad' : t.last_status === 'partial' ? 'warn' : t.last_status === 'running' ? 'run' : 'ok')),
          h('td', null, h('b', { text: t.target_name || t.target }), t.target_name ? h('span', { class: 'note block', text: t.target }) : null),
          h('td', null, badge(t.last_status)), h('td', { class: 'nowrap', text: D.fmtTime(t.last_started) }),
          h('td', { class: 'nowrap', text: t.last_success ? D.fmtTime(t.last_success) : '–' }),
          h('td', { class: 'num-cell', text: t.runs }), h('td', { class: 'num-cell' + (t.fails ? ' bad' : ''), text: t.fails }),
          h('td', { class: 'num-cell', text: t.new_sum }), h('td', { class: 'num-cell', text: t.updated_sum }));
      }))));
    // 실패 뒤에 같은 대상이 다시 정상 수집됐으면 '해결됨' (지난 실패는 접어 둠)
    var okAt = {};
    d.targets.forEach(function (t) { okAt[t.target] = t.last_success; });
    function fixedAt(f) { var t = okAt[f.target]; return t && new Date(t) > new Date(f.started_at) ? t : null; }
    var open = d.fails.filter(function (f) { return !fixedAt(f); }), past = d.fails.filter(function (f) { return fixedAt(f); });
    function failBox(f, isOpen) {
        var fx = fixedAt(f);
        return h('details', { class: 'fail' + (fx ? ' fixed' : ''), open: isOpen },
          h('summary', null, badge(f.status), h('b', { text: ' ' + (f.target || '') }), f.search_query ? h('span', { class: 'note', text: ' · 검색식 «' + f.search_query + '»' }) : null,
            fx ? h('span', { class: 'fixed-tag', text: '✓ 해결됨 · ' + D.fmtTime(fx) + ' 정상 수집' }) : null,
            h('span', { class: 'note right', text: D.fmtTime(f.started_at) + (f.completed_at ? ' · ' + dur(f.started_at, f.completed_at) : '') })),
          h('dl', { class: 'info' },
            h('dt', { text: '오류 내용' }), h('dd', null, h('pre', { class: 'err-pre', text: f.error_message || '(내용 없음)' })),
            h('dt', { text: '할 일' }), h('dd', { text: HINT[f.status] || HINT.failed }),
            h('dt', { text: '수집 기간' }), h('dd', { text: (f.window_from ? D.fmtTime(f.window_from) : '?') + ' ~ ' + (f.window_to ? D.fmtTime(f.window_to) : '?') }),
            h('dt', { text: '건수' }), h('dd', { text: '확인 ' + (f.total_count == null ? '–' : f.total_count) + ' · 상세 ' + (f.fetched_count == null ? '–' : f.fetched_count) + ' · 신규 ' + (f.new_count || 0) + ' · 변경 ' + (f.updated_count || 0) }),
            h('dt', { text: '기록 번호' }), h('dd', { class: 'note', text: k + '_crawl_logs #' + f.crawl_log_id })));
    }
    return [h('h3', { class: 'run-sub', text: '대상별 결과 (' + LBL[days] + ')' }), targets,
      h('h3', { class: 'run-sub', text: '지금 확인이 필요한 실패 ' + (open.length ? open.length + '건' : '') }),
      open.length ? h('div', { class: 'fail-list' }, open.slice(0, 30).map(function (f) { return failBox(f, open.length <= 3); }))
        : h('p', { class: 'note ok-note', text: '없습니다. 모든 대상이 마지막 실행에서 정상 수집됐습니다.' }),
      past.length ? h('details', { class: 'past-fails' },
        h('summary', null, '지난 실패 ' + past.length + '건 보기 — 이후 다시 정상 수집되어 할 일 없음'),
        h('div', { class: 'fail-list' }, past.slice(0, 30).map(function (f) { return failBox(f, false); }))) : null];
  }
})();
