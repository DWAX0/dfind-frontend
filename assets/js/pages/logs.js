/* 관리자 › 로그 관리: 수집 · 메일 발송 · Claude 요약 · 변경 기록 (날짜·기간별) */
(async function () {
  'use strict';
  var main = await D.boot('logs', { admin: true });
  if (!main) return;
  var h = D.h;
  var st = { tab: new URLSearchParams(location.search).get('tab') || 'crawl', bad: false, range: null };
  var SRC = { mfds_api: '식약처 API', mfds: '식약처 사이트', emedi: '이머디', neca: 'NECA', khidi: 'KHIDI', dart: 'DART', news: '뉴스',
    ntis: 'NTIS', g2b: '나라장터', pubmed: 'PubMed', thevc: 'THE VC' };
  var STATUS = {
    success: ['성공', 'ok'], empty: ['새 정보 없음', 'gray'], partial: ['일부 실패', 'warn'], failed: ['실패', 'bad'],
    structure_error: ['화면 구조 바뀜', 'bad'], auth_error: ['인증 오류', 'bad'], running: ['실행 중', 'gray']
  };
  var BAD = ['partial', 'failed', 'structure_error', 'auth_error'];
  var TABLE = { mail_recipients: '메일 수신자', keywords: '키워드', keyword_synonyms: '비슷한 말', news_feeds: '언론사 RSS',
    user_roles: '사용자 권한', crawl_targets: '수집 대상', keyword_assignments: '키워드 배정' };
  var ACT = { insert: '추가', update: '수정', delete: '삭제' };

  var tabs = h('div', { class: 'tabs', role: 'tablist', 'aria-label': '로그 종류' });
  var box = h('section', { class: 'card', role: 'tabpanel' });
  var badBox = h('input', { type: 'checkbox', id: 'only-bad', onchange: function (e) { st.bad = e.target.checked; load(); } });
  var bar = D.periodBar({ defaultPer: '7', onChange: function (r) { st.range = r; load(); } });
  D.set(main, D.header('로그 관리', '수집 · 메일 발송 · Claude 요약 · 변경 기록을 날짜별로 확인합니다', { admin: true }),
    bar, tabs, box);

  var TABS = [['crawl', '수집'], ['mail', '메일 발송'], ['ai', 'Claude 요약'], ['audit', '변경 기록']];
  function drawTabs() {
    D.set(tabs, TABS.map(function (t) {
      return h('button', { type: 'button', class: 'tab', role: 'tab', 'aria-selected': st.tab === t[0] ? 'true' : 'false', text: t[1],
        onclick: function () { st.tab = t[0]; var q = new URLSearchParams(location.search); q.set('tab', st.tab); history.replaceState(null, '', '?' + q); drawTabs(); load(); } });
    }));
  }
  function span(r) { return [r.from + 'T00:00:00+09:00', D.addDays(r.to, 1) + 'T00:00:00+09:00']; }
  function badge(s) { var x = STATUS[s] || [s, 'gray']; return D.badge(x[0], x[1]); }
  function table(cols, rows) {
    return h('div', { class: 'table-wrap' }, h('table', { class: 'grid' },
      h('thead', null, h('tr', null, cols.map(function (c) { return h('th', { scope: 'col', text: c }); }))),
      h('tbody', null, rows)));
  }
  function took(a, b) {
    if (!a || !b) return '';
    var s = Math.round((new Date(b) - new Date(a)) / 1000);
    return s >= 60 ? Math.floor(s / 60) + '분 ' + (s % 60) + '초' : s + '초';
  }

  async function load() {
    if (!st.range) return;
    var t = span(st.range);
    D.set(box, D.loading());
    try {
      var head = h('div', { class: 'card-head' }, h('h2', { text: TABS.filter(function (x) { return x[0] === st.tab; })[0][1] + ' 로그' }),
        st.tab !== 'audit' ? h('label', { class: 'check right', for: 'only-bad' }, badBox, '문제 있는 것만 보기') : null);
      var rows, out;
      if (st.tab === 'crawl') {
        var q = D.sb.from('v_crawl_status').select('*').gte('started_at', t[0]).lt('started_at', t[1]).order('started_at', { ascending: false }).limit(1000);
        if (st.bad) q = q.in('status', BAD);
        rows = await D.q(q);
        out = table(['실행 시각', '결과', '출처 · 대상', '조회 / 신규 / 변경', '걸린 시간', '메모'], rows.map(function (r) {
          return h('tr', null, h('td', { text: D.fmtTime(r.started_at) }), h('td', null, badge(r.status)),
            h('td', null, h('b', { text: SRC[r.source_system] || r.source_system }), ' · ' + r.target, r.search_query ? h('span', { class: 'list-meta', text: r.search_query }) : null),
            h('td', { text: D.num(r.fetched_count) + ' / ' + D.num(r.new_count) + ' / ' + D.num(r.updated_count) }),
            h('td', { text: took(r.started_at, r.completed_at) }), h('td', { text: (r.error_message || '').slice(0, 200) }));
        }));
      } else if (st.tab === 'mail') {
        var qm = D.sb.from('mail_send_logs').select('*').gte('sent_at', t[0]).lt('sent_at', t[1]).order('sent_at', { ascending: false });
        if (st.bad) qm = qm.neq('status', 'success');
        rows = await D.q(qm);
        out = table(['발송 시각', '결과', '제목', '받는 사람', '받지 못한 주소'], rows.map(function (r) {
          return h('tr', null, h('td', { text: D.fmtTime(r.sent_at) }), h('td', null, badge(r.status)), h('td', { text: r.subject || '' }),
            h('td', { text: r.success_count + ' / ' + r.recipient_count + '명' }),
            h('td', { text: (r.failed_recipients || []).map(function (x) { return x.email + (x.reason ? ' (' + x.reason + ')' : ''); }).join(', ') || '없음' }));
        }));
      } else if (st.tab === 'ai') {
        var qa = D.sb.from('ai_usage_logs').select('*').gte('called_at', t[0]).lt('called_at', t[1]).order('called_at', { ascending: false });
        if (st.bad) qa = qa.neq('status', 'success');
        rows = await D.q(qa);
        out = table(['실행 시각', '결과', '종류', '읽은 정보', '사용량 (토큰)', '모델', '메모'], rows.map(function (r) {
          return h('tr', null, h('td', { text: D.fmtTime(r.called_at) }), h('td', null, badge(r.status)),
            h('td', { text: r.purpose === 'daily_summary' ? '오늘의 결론' : '기간 요약' }), h('td', { text: r.input_count + '건' }),
            h('td', { text: r.input_tokens != null ? '입력 ' + D.num(r.input_tokens) + ' · 출력 ' + D.num(r.output_tokens) : '-' }),
            h('td', { text: r.model || '' }), h('td', { text: (r.error_message || '').slice(0, 200) }));
        }));
      } else {
        rows = await D.q(D.sb.from('audit_logs').select('*').gte('changed_at', t[0]).lt('changed_at', t[1]).order('changed_at', { ascending: false }).limit(1000));
        out = table(['시각', '사람', '항목', '동작', '바뀐 내용'], rows.map(function (r) {
          var nv = r.new_values || {}, ov = r.old_values || {};
          var keys = Object.keys(nv).filter(function (k) { return ['updated_at', 'created_at'].indexOf(k) < 0 && JSON.stringify(nv[k]) !== JSON.stringify(ov[k]); });
          var what = r.action === 'update' ? keys.map(function (k) { return k + ': ' + JSON.stringify(ov[k]) + ' → ' + JSON.stringify(nv[k]); }).join(', ')
            : JSON.stringify(r.action === 'delete' ? ov : nv).slice(0, 160);
          return h('tr', null, h('td', { text: D.fmtTime(r.changed_at) }), h('td', { text: r.user_email || '백엔드(자동)' }),
            h('td', { text: TABLE[r.table_name] || r.table_name }), h('td', { text: ACT[r.action] || r.action }), h('td', { text: what.slice(0, 300) }));
        }));
      }
      D.set(box, head, rows.length ? out : D.empty(st.tab === 'mail' ? '발송 기록이 없습니다. (메일 발송 기능 연결 전)' : '기록이 없습니다.'),
        h('p', { class: 'note', text: rows.length + '건' + (rows.length >= 1000 ? ' (최근 1,000건까지)' : '') }));
    } catch (e) { D.set(box, D.fail(e)); }
  }
  drawTabs();
  bar.start();
})();
