/* 01 SUMMARY: 오늘의 결론(Claude) · 분야별 건수 · 신기술 확보 감지 · 주목 기업 · 분야별 주요 소식
   날짜 하나만 고름 (기간 선택 없음). 그날 메일과 같은 범위(전날~당일)를 보여주고,
   결론은 매일 9시 작업이 DB(daily_summaries)에 저장해 둔 것을 읽음 — 화면에서는 Claude 를 부르지 않음 */
(async function () {
  'use strict';
  var main = await D.boot('summary');
  if (!main) return;
  var h = D.h;
  var TODAY = D.today();
  var SECURED = ['혁신의료기기 지정', '평가 유예', '신의료기술 평가', '혁신의료기술 평가', '디지털의료기기 허가', '신개발 의료기기 심사', '품목 허가'];
  var EXPECTED = ['임상시험 승인', '투자', '자금 조달', '계약·수주', '병원·임상', '연구·R&D', '전시·해외', '병원 협력', 'R&D 과제', '논문·연구'];
  var NEWS_KINDS = ['인허가·정책', '투자', '병원·임상', '연구·R&D', '제품·출시', '전시·해외', '경쟁사·파트너사', 'R&D 과제', '논문·연구', '병원 협력'];  // 뉴스 화면에서 보는 종류
  // 종류별 칸: 기업 발굴에 쓰는 종류는 0건이어도 늘 보여 줌 (빠진 것처럼 보이지 않게)
  var KINDS = [['혁신의료기기 지정', 'permit'], ['평가 유예', 'permit', '신의료기술 평가 유예'], ['신의료기술 평가', 'permit'], ['혁신의료기술 평가', 'permit'],
    ['디지털의료기기 허가', 'permit'], ['품목 허가', 'permit', '식약처 품목 허가'], ['임상시험 승인', 'research'], ['연구·R&D', 'research', '연구·R&D (뉴스)'],
    ['인허가·정책', 'market', '인허가·정책 (뉴스)'], ['투자', 'market'], ['병원·임상', 'market', '병원·임상 (뉴스)'], ['제품·출시', 'market'], ['전시·해외', 'market'],
    ['자금 조달', 'disclosure', 'DART 유상증자·전환사채'], ['계약·수주', 'disclosure', 'DART 공급계약'], ['지배구조', 'disclosure', 'DART 최대주주 변경·합병·타법인 취득'], ['실적', 'disclosure', 'DART 실적·정기보고서']];

  var titleEl = h('h1', { class: 'title' });
  var subEl = h('p', { class: 'sub' });
  var pastEl = h('p', { class: 'notice', hidden: true });
  var concl = h('section', { class: 'card concl', 'aria-labelledby': 'concl-h' });
  var tiles = h('section', { class: 'tiles', 'aria-label': '분야별 건수' });
  var kindTiles = h('section', { class: 'card', 'aria-labelledby': 'kinds-h' });
  var sense = h('section', { class: 'card sense-card', 'aria-labelledby': 'sense-h' });
  var top = h('section', { class: 'card', 'aria-labelledby': 'top-h' });
  var news = h('section', { class: 'card', 'aria-labelledby': 'news-h' });
  var bar = D.periodBar({ dayOnly: true, onChange: load });
  // 메일 리포트 전송 (관리자, ?send=1): 이 화면 그대로 + 위에 보내기 막대 (고른 날짜의 메일을 보냄)
  var sendBar = D.role === 'admin' && new URLSearchParams(location.search).get('send') === '1' ? D.mailSendBar() : null;
  D.set(main, sendBar,
    h('header', { class: 'top' }, h('div', { class: 'grow' }, titleEl,
      h('p', { class: 'sub' }, h('span', { class: 'greet-notice', text: '사내 전용 · 보기 전용 · 메일 수신자·발송 이력은 표시하지 않음' })), subEl, pastEl)),
    bar, concl, sense, tiles, kindTiles, top, news);
  bar.start();

  function settle(p) { return p.then(function (v) { return { ok: true, v: v }; }, function (e) { return { ok: false, e: e }; }); }

  async function load(r) {
    var single = r.from === r.to;
    var d = r.to;
    if (sendBar) sendBar.setDay(d);
    var feedFrom = single ? D.addDays(d, -1) : r.from;
    titleEl.textContent = !single ? '기간 요약' : d === TODAY ? D.greeting() : Number(d.slice(5, 7)) + '월 ' + Number(d.slice(8)) + '일 요약';
    subEl.textContent = single ? D.fmtLong(d) + ' · 전날과 당일에 발표·승인된 정보' : D.fmt(r.from) + ' ~ ' + D.fmt(r.to) + ' 동안 발표·승인된 정보';
    pastEl.hidden = !(single && d < TODAY);
    pastEl.textContent = '지난 날짜입니다. 결론은 그날 오전 9시 메일과 같은 내용입니다.';
    [concl, tiles, kindTiles, sense, top, news].forEach(function (el) { D.set(el, D.loading()); });

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
    drawKinds(res[0], 'per=range&from=' + feedFrom + '&to=' + d);
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
      return h('li', null, h('span', { class: 'num', text: i + 1 }), h('span', null, D.rich(c.text), h('br'), refLinks(c.refs)));
    }));
  }
  /* 관리자: 수집이 끝난 뒤 '요약 만들기' (1단계: 규칙 방식, 비용 없음). 2단계에서 Claude API 로 바뀜 */
  function makeButton(d, row, range) {
    if (D.role !== 'admin' || row) return null; // 이미 결론이 있으면 버튼 없음 (바꾸려면 관리자 › 오늘의 결론 입력)
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
    var head = h('div', { class: 'card-head' }, h('h2', { id: 'concl-h' }, h('span', { class: 'concl-pill', text: single ? '오늘의 결론' : '기간 동안의 결론 (날짜별)' })),
      single ? D.badge('메일 본문 첫 단락', 'ok') : null,
      h('span', { class: 'note', id: 'concl-how' }));
    var mk = single && r.ok ? makeButton(d, r.v[0], range) : null;
    if (mk) head.appendChild(mk);
    if (!r.ok) { D.set(concl, head, D.fail(r.e)); return; }
    var rows = r.v;
    var m = rows[0] && rows[0].model;
    var how = m === 'claude-app' ? '담당자가 Claude 앱으로 수집 결과를 정리해 입력 · 네이버 검색 기사는 약관에 따라 제외'
      : m && m !== 'rule-based' ? 'Claude 가 수집 결과를 읽고 정리 · 네이버 검색 기사는 약관에 따라 제외'
      : '기업마다 무슨 일이 있었고 발굴에 어떤 의미인지 규칙으로 정리 (중요한 순 최대 5개, 비용 없음 · 문장 요약은 2단계 Claude API)' + (D.role === 'admin' ? ' · 관리자 › 오늘의 결론 입력에서 바꿀 수 있음' : '');
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
        h('span', { class: 'tile-note', text: list.slice(0, 2).map(function (x) { return x.kind + ' ' + x.item_count; }).join(' · ') || '없음' }));
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

  function drawKinds(rc, q) {
    var head = h('div', { class: 'card-head' }, h('h2', { id: 'kinds-h', text: '종류별 건수' }), h('span', { class: 'note', text: '누르면 그 종류만 모아 봅니다' }));
    if (!rc.ok) { D.set(kindTiles, head, D.fail(rc.e)); return; }
    var n = {};
    rc.v.forEach(function (x) { n[x.kind] = (n[x.kind] || 0) + Number(x.item_count); });
    D.set(kindTiles, head, h('div', { class: 'kind-grid' }, KINDS.map(function (k) {
      var page = NEWS_KINDS.indexOf(k[0]) >= 0 ? 'market.html' : D.CAT[k[1]].page;  // 기사에서 온 종류는 뉴스 화면
      return h('a', { class: 'kind-chip' + (n[k[0]] ? ' has' : ''), href: page + '?' + q + '&kind=' + encodeURIComponent(k[0]) },
        h('span', { class: 'dot dot-' + k[1] }), h('span', { class: 'kind-name', text: k[2] || k[0] }), h('b', { text: D.num(n[k[0]] || 0) }));
    })));
  }

  // 뉴스는 대시보드가 아닌 언론사 원문 (새 창), 나머지는 대시보드 정보 보기
  function newsOrItem(f, text) {
    return /^news:/.test(f.item_key || '') && f.url ? h('a', { href: f.url, target: '_blank', rel: 'noopener noreferrer', title: '언론사 원문 (새 창)', text: text })
      : h('a', { href: D.itemHref(f.item_key), text: text });
  }
  function senseItem(f, cls) {
    return h('div', { class: 'sense-item' }, D.badge(f.kind, cls),
      f.company_name ? D.companyLink(f.company_id, f.company_name) : null,
      newsOrItem(f, D.clean(f.title).slice(0, 60)),
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
      col('secured', '확보', '혁신의료기기 지정 · 평가 유예 · 신의료기술 · 허가', sec, 'k-secured', 'regulatory.html'),
      col('expected', '확보 기대', '임상 승인 · 연구·R&D · 투자(뉴스·DART) · 공급계약 · 병원·임상 · 전시·해외', exp, 'k-expected', 'research.html')));
  }

  function drawTop(r) {
    var head = h('div', { class: 'card-head' }, h('h2', { id: 'top-h', text: '주목 기업' }), h('span', { class: 'note', text: '조기 발굴 점수 상위 6곳' }),
      h('a', { class: 'right', href: 'radar.html', text: '기업 레이더 전체' }));
    if (!r.ok) { D.set(top, head, D.fail(r.e)); return; }
    if (!r.v.length) { D.set(top, head, D.empty('점수를 계산할 기업이 없습니다.')); return; }
    var CATK = { '혁신의료기기 지정': 'permit', '평가 유예': 'permit', '신의료기술 평가': 'permit', '디지털의료기기 허가': 'permit', '임상시험 승인': 'research', '투자': 'market', '자금 조달': 'disclosure', '계약·수주': 'disclosure' };
    D.set(top, head, h('div', { class: 'coms' }, r.v.slice(0, 6).map(function (c) {
      var cat = CATK[c.recent_signal] || 'company';
      return h('div', { class: 'com cat-' + cat + '-top' },
        h('div', { class: 'h' }, h('a', { class: 'company-link cname', href: D.companyHref(c.company_id), text: c.company_name }),
          c.has_innovation ? h('span', { class: 'mini', text: '★ 혁신 지정' }) : null, h('span', { class: 'mini', text: c.rank + '위' })),
        h('div', { class: 'scoreline' }, h('b', { text: c.total }), h('span', { class: 'note', text: '/ 100' }),
          h('span', { class: 'meter small' }, D.width(h('span', { class: 'b1' }), c.total)), delta(c.delta)),
        h('span', { class: 'note', text: c.recent_signal ? '최근 ' + c.recent_signal + ' · ' + D.fmt(c.recent_date) : '최근 신호 없음' }));
    })), h('p', { class: 'note', text: '점수는 임시 계산(v0)입니다. 기준은 기업 레이더 화면에 있습니다.' }));
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
