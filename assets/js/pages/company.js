/* 03 기업 정보
   ?id 없음 → [조회] 이름·유형·지역·관심·정렬 → [기업 목록 표] (연관 정보는 펼쳐서)
   ?id=…   → [기본 정보 | 그래프] → [핵심 숫자] → 지금 볼 이유 · 인허가 단계 · 점수 근거 · 소식 · 허가 제품 · 임상 */
(async function () {
  'use strict';
  var main = await D.boot('company');
  if (!main) return;
  var h = D.h;
  var LIC = { manufacture: '제조업', import: '수입업', repair: '수리업', sales: '판매·임대업' };
  var LICS = { manufacture: '제조', import: '수입', repair: '수리', sales: '판매' };
  var LST = { active: '', suspended: ' (휴업)', closed: ' (폐업)' };
  var RST = { active: '정상', withdrawn: '취하', cancelled: '취소' };
  var id = new URLSearchParams(location.search).get('id');
  if (id) await detail(Number(id)); else await list();

  // =========================================================== 목록
  async function list() {
    var p = new URLSearchParams(location.search);
    var st = { q: p.get('q') || '', type: p.get('type') || 'all', region: p.get('region') || 'all', sort: p.get('sort') || 'score',
      fav: p.get('fav') === '1', closed: p.get('closed') === '1', page: 0 };
    var PAGE = 50;
    var all = [];
    var input = h('input', { type: 'search', class: 'input grow', id: 'cq', placeholder: '기업명 · 주소 · 업허가번호', value: st.q,
      onkeydown: function (e) { if (e.key === 'Enter') { e.preventDefault(); st.q = input.value; apply(); } } });
    function sel(idv, opts, val, on) {
      var el = h('select', { class: 'input', id: idv, onchange: function (e) { on(e.target.value); apply(); } },
        opts.map(function (x) { return h('option', { value: x[0], text: x[1] }); }));
      el.value = val;
      return el;
    }
    var TYPES = [['all', '전체'], ['manufacture', '제조업'], ['import', '수입업'], ['innovation', '혁신의료기기 지정'], ['trial', '임상시험 승인'], ['scored', '점수 있는 기업']];
    var SORTS = [['score', '점수 높은 순'], ['recent', '최근 소식 순'], ['products', '허가 제품 많은 순'], ['license', '업허가일 최근 순'], ['name', '이름 순']];
    var typeSel = sel('ctype', TYPES, st.type, function (v) { st.type = v; });
    var regionSel = sel('cregion', [['all', '전체']], 'all', function (v) { st.region = v; });
    var sortSel = sel('csort', SORTS, st.sort, function (v) { st.sort = v; });
    var favBox = h('input', { type: 'checkbox', id: 'cfav', checked: st.fav, onchange: function (e) { st.fav = e.target.checked; apply(); } });
    var closedBox = h('input', { type: 'checkbox', id: 'cclosed', checked: st.closed, onchange: function (e) { st.closed = e.target.checked; apply(); } });
    var tiles = h('section', { class: 'tiles', 'aria-label': '기업 수' });
    var card = h('section', { class: 'card', 'aria-labelledby': 'clist-h' });
    D.set(main, D.header('기업 정보', '이머디 업허가 현황·디지털의료기기 대장에 있는 기업 (이름을 누르면 자세히)', { dot: 'dot-company' }),
      h('section', { class: 'card search-panel', 'aria-label': '조회 조건' },
        h('div', { class: 'card-head' }, h('h2', { text: '조회' })),
        h('div', { class: 'search-row' },
          h('label', { class: 'field grow', for: 'cq' }, '검색어', input),
          h('label', { class: 'field', for: 'ctype' }, '기업 유형', typeSel),
          h('label', { class: 'field', for: 'cregion' }, '지역', regionSel),
          h('label', { class: 'field', for: 'csort' }, '정렬', sortSel)),
        h('div', { class: 'search-row' },
          h('label', { class: 'check', for: 'cfav' }, favBox, '★ 관심 기업만'),
          h('label', { class: 'check', for: 'cclosed' }, closedBox, '휴업·폐업 기업도 보기'),
          h('div', { class: 'search-btns right' },
            h('button', { type: 'button', class: 'btn primary', onclick: function () { st.q = input.value; apply(); } }, D.svg('M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14M20 20l-4-4', 20), '검색'),
            h('button', { type: 'button', class: 'btn', text: '초기화', onclick: function () {
              st = { q: '', type: 'all', region: 'all', sort: 'score', fav: false, closed: false, page: 0 };
              input.value = ''; typeSel.value = 'all'; regionSel.value = 'all'; sortSel.value = 'score'; favBox.checked = false; closedBox.checked = false; apply();
            } })))),
      tiles, card);
    D.set(card, D.loading());
    try { all = await D.rpc('dash_company_list'); await D.favs(); } catch (e) { D.set(card, D.fail(e)); return; }
    var regions = {};
    all.forEach(function (c) { if (c.region) regions[c.region] = (regions[c.region] || 0) + 1; });
    D.set(regionSel, h('option', { value: 'all', text: '전체' }), Object.keys(regions).sort(function (a, b) { return regions[b] - regions[a]; })
      .map(function (r) { return h('option', { value: r, text: r + ' (' + regions[r] + ')' }); }));
    regionSel.value = regions[st.region] ? st.region : 'all';
    st.region = regionSel.value;
    apply();

    function has(c, t) {
      if (t === 'all') return true;
      if (t === 'innovation') return c.n_innovations > 0;
      if (t === 'trial') return c.n_trials > 0;
      if (t === 'scored') return c.total > 0;
      return (c.license_types || []).indexOf(t) >= 0;
    }
    function save() {
      var q = new URLSearchParams();
      if (st.q) q.set('q', st.q);
      ['type', 'region'].forEach(function (k) { if (st[k] !== 'all') q.set(k, st[k]); });
      if (st.sort !== 'score') q.set('sort', st.sort);
      if (st.fav) q.set('fav', '1');
      if (st.closed) q.set('closed', '1');
      history.replaceState(null, '', '?' + q.toString());
    }
    function apply() { st.page = 0; save(); draw(); }
    function filtered(ignoreType) {
      var s = st.q.trim().toLowerCase();
      return all.filter(function (c) {
        if (!st.closed && c.license_status && c.license_status !== 'active') return false;
        if (!ignoreType && !has(c, st.type)) return false;
        if (st.region !== 'all' && c.region !== st.region) return false;
        if (st.fav && !D.isFav('company', c.company_id)) return false;
        if (!s) return true;
        return [c.company_name, c.address, c.license_number].some(function (x) { return x && String(x).toLowerCase().indexOf(s) >= 0; });
      });
    }
    function draw() {
      var base = filtered(true);
      D.set(tiles, TYPES.slice(0, 5).map(function (t) {
        var n = base.filter(function (c) { return has(c, t[0]); }).length;
        return h('button', { type: 'button', class: 'tile', 'aria-pressed': st.type === t[0] ? 'true' : 'false',
          onclick: function () { st.type = t[0]; typeSel.value = t[0]; apply(); } },
          h('span', { class: 'tile-label', text: t[0] === 'all' ? '전체 기업' : t[1] }), h('span', { class: 'tile-num' }, D.num(n), h('small', { text: '곳' })),
          h('span', { class: 'tile-note', text: t[0] === 'innovation' || t[0] === 'trial' ? '이머디' : '업허가 현황' }));
      }));
      var rows = filtered(false);
      var cmp = {
        score: function (a, b) { return b.total - a.total || String(b.recent_date || '').localeCompare(String(a.recent_date || '')); },
        recent: function (a, b) { return String(b.recent_date || '').localeCompare(String(a.recent_date || '')) || b.total - a.total; },
        products: function (a, b) { return (b.n_products + b.n_innovations) - (a.n_products + a.n_innovations) || b.total - a.total; },
        license: function (a, b) { return String(b.license_date || '').localeCompare(String(a.license_date || '')); },
        name: function (a, b) { return bare(a.company_name).localeCompare(bare(b.company_name), 'ko'); }
      }[st.sort];
      rows.sort(cmp);
      var pages = Math.max(1, Math.ceil(rows.length / PAGE));
      st.page = Math.min(st.page, pages - 1);
      var shown = rows.slice(st.page * PAGE, st.page * PAGE + PAGE);
      D.set(card,
        h('div', { class: 'card-head' }, h('h2', { id: 'clist-h', text: '기업 목록' }), h('span', { class: 'note', text: D.num(rows.length) + '곳 · ' + SORTS.filter(function (x) { return x[0] === st.sort; })[0][1] })),
        rows.length ? h('div', { class: 'table-wrap' }, h('table', { class: 'grid company-table' },
          h('thead', null, h('tr', null, ['', '기업 유형', '기업명', '연관성 (점수)', '허가 · 지정 · 임상', '최근 소식', '업허가번호', '소재지']
            .map(function (x, i) { return h('th', { scope: 'col', class: i === 0 ? 'w-star' : null }, i === 0 ? h('span', { class: 'sr', text: '관심' }) : x); }))),
          h('tbody', null, shown.map(row)))) : D.empty('조건에 맞는 기업이 없습니다.'),
        pages > 1 ? pager(pages) : null,
        h('p', { class: 'note', text: '연관성 = 조기 발굴 점수(v0, 100점 만점). 기업명을 누르면 자세히 봅니다.' }));
    }
    function pager(pages) {
      function go(i) { st.page = i; draw(); card.scrollIntoView({ block: 'start' }); }
      var nums = [];
      for (var i = Math.max(0, st.page - 3); i < Math.min(pages, st.page + 4); i++) {
        (function (k) { nums.push(h('button', { type: 'button', class: 'btn small', 'aria-current': k === st.page ? 'page' : null, 'aria-pressed': k === st.page ? 'true' : 'false', text: k + 1, onclick: function () { go(k); } })); })(i);
      }
      return h('nav', { class: 'pager', 'aria-label': '쪽' },
        h('button', { type: 'button', class: 'btn small', disabled: st.page === 0, text: '이전', onclick: function () { go(st.page - 1); } }), nums,
        h('button', { type: 'button', class: 'btn small', disabled: st.page >= pages - 1, text: '다음', onclick: function () { go(st.page + 1); } }),
        h('span', { class: 'note', text: (st.page + 1) + ' / ' + pages + '쪽' }));
    }
    function row(c) {
      var types = (c.license_types || []).map(function (t) { return D.badge(LICS[t] || t, 'lic-' + t); });
      if (c.n_innovations) types.push(D.badge('혁신', 'star'));
      if (c.license_status && c.license_status !== 'active') types.push(D.badge(c.license_status === 'closed' ? '폐업' : '휴업', 'bad'));
      return h('tr', null,
        h('td', null, D.favButton('company', c.company_id, c.company_name, { small: true })),
        h('td', null, h('span', { class: 'chips tight' }, types.length ? types : D.badge('기타', 'gray'))),
        h('td', { class: 'name' }, h('a', { class: 'company-link', href: D.companyHref(c.company_id), text: c.company_name }), c.field ? h('span', { class: 'note block', text: c.field }) : null),
        h('td', { class: 'nowrap' }, c.total ? [h('span', { class: 'meter small' }, D.width(h('span', { class: 'b1' }), c.total)), h('b', { text: ' ' + c.total }), h('span', { class: 'note', text: '점' })] : h('span', { class: 'note', text: '–' })),
        h('td', null, h('span', { class: 'counts', title: '허가 제품 · 혁신의료기기 지정 · 임상시험 승인' },
          h('span', null, '허가 ', h('b', { text: c.n_products })), h('span', null, '지정 ', h('b', { text: c.n_innovations })), h('span', null, '임상 ', h('b', { text: c.n_trials })))),
        h('td', { class: 'recent' }, c.recent_signal ? [h('span', { text: c.recent_signal }), h('span', { class: 'note block', text: D.fmt(c.recent_date) })] : h('span', { class: 'note', text: '–' })),
        h('td', { class: 'nowrap', text: c.license_number || '–' }),
        h('td', { text: c.region || '–', title: c.address || '' }));
    }
  }

  // =========================================================== 상세
  // [목록으로 · 레이더 ……… ☆ 관심 기업 등록]
  // [기본 정보        | 조기 발굴 점수·순위·근거]
  // [통계 2×2         | 연도별 그래프 · 12개월 그래프]
  // [인허가 진행 단계 (한 줄)]
  // [탭: 전체 소식 · 혁신의료기기 · 허가 제품 · 임상시험 · NECA 평가 · 투자 · 병원 협력 · …]
  async function detail(cid) {
    D.set(main, D.loading());
    var data;
    try { data = await D.rpc('dash_company', { p_company_id: cid }); } catch (e) { D.set(main, D.fail(e)); return; }
    if (!data) { D.set(main, h('a', { class: 'btn small', href: 'company.html', text: '기업 목록으로' }), D.empty('기업을 찾을 수 없습니다.')); return; }
    var c = data.company, sc = data.score, tl = data.timeline || [];
    var kinds = {};
    tl.forEach(function (f) { kinds[f.kind] = (kinds[f.kind] || []).concat([f]); });
    function lastDate(lst, k) { return lst && lst.length ? lst.map(function (x) { return x[k]; }).filter(Boolean).sort().pop() : null; }
    var address = c.company_address || (data.licenses[0] || {}).license_address;
    var closed = data.licenses.length && data.licenses.every(function (l) { return l.license_status !== 'active'; });

    // ---- 그래프 자료
    var thisYear = Number(D.today().slice(0, 4));
    var allYears = [].concat(data.registrations.map(function (r) { return r.approval_date; }), data.innovations.map(function (r) { return r.designation_date; }),
      data.trials.map(function (r) { return r.approval_date; })).filter(Boolean).map(function (d) { return Number(String(d).slice(0, 4)); });
    var firstYear = Math.max(Math.min.apply(null, [thisYear - 4].concat(allYears)), thisYear - 9);
    var years = [];
    for (var y = firstYear; y <= thisYear; y++) years.push(y);
    function perYear(lst, k) { return years.map(function (yy) { return lst.filter(function (x) { return String(x[k] || '').slice(0, 4) === String(yy); }).length; }); }
    var yReg = perYear(data.registrations, 'approval_date'), yInn = perYear(data.innovations, 'designation_date'), yTri = perYear(data.trials, 'approval_date');
    var months = [];
    for (var i = 11; i >= 0; i--) { var d = new Date(D.today().slice(0, 7) + '-01T00:00:00Z'); d.setUTCMonth(d.getUTCMonth() - i); months.push(d.toISOString().slice(0, 7)); }
    var mNews = months.map(function (m) { return tl.filter(function (f) { return String(f.item_date || '').slice(0, 7) === m; }).length; });

    // ---- 기본 정보 (정보만)
    var badges = data.licenses.map(function (l) { return D.badge(LIC[l.license_type] || '업허가', 'lic-' + l.license_type); });
    if (data.innovations.length) badges.push(D.badge('★ 혁신의료기기 지정', 'star'));
    if (closed) badges.push(D.badge('휴·폐업', 'bad'));
    var info = h('section', { class: 'card', 'aria-labelledby': 'cname' },
      h('div', { class: 'chips tight' }, badges),
      h('h1', { class: 'company-name', id: 'cname', text: c.company_name }),
      h('dl', { class: 'info' },
        h('dt', { text: '소재지' }), h('dd', { text: address || '정보 없음' }),
        data.licenses.length ? data.licenses.map(function (l) {
          return [h('dt', { text: (LIC[l.license_type] || '업') + ' 허가' }), h('dd', { text: l.license_number + (l.license_date ? ' · ' + l.license_date : '') + (LST[l.license_status] || '') })];
        }) : [h('dt', { text: '업허가' }), h('dd', { text: '정보 없음' })],
        sc && sc.field ? [h('dt', { text: '주요 분야' }), h('dd', { text: sc.field })] : null));

    // ---- 조기 발굴 점수 · 순위 · 근거
    var crit = [['파이프라인', 's_pipeline', 40, 'pipeline', 'b1', 'c1'], ['기업 단계', 's_stage', 20, 'stage', 'b2', 'c2'],
      ['선행 신호', 's_signal', 25, 'signal', 'b3', 'c3'], ['웨어러블 적합', 's_wear', 15, 'wear', 'b4', 'c4']];
    var score = h('section', { class: 'card score-card', 'aria-labelledby': 'score-h' },
      h('div', { class: 'card-head' }, h('h2', { id: 'score-h', text: '조기 발굴 점수' }), h('a', { class: 'right', href: 'radar.html', text: '평가 기준 보기' })),
      sc ? [
        h('div', { class: 'score-head' }, h('span', null, h('span', { class: 'score-big', text: sc.total }), ' / 100'),
          h('b', { text: sc.rank + '위' }),
          h('span', { class: sc.delta > 0 ? 'delta-up' : sc.delta < 0 ? 'delta-down' : 'delta-same', text: '전날 대비 ' + (sc.delta > 0 ? '▲ ' + sc.delta : sc.delta < 0 ? '▼ ' + Math.abs(sc.delta) : '변동 없음') })),
        crit.map(function (k) {
          var ev = sc.evidence && sc.evidence[k[3]] ? Object.values(sc.evidence[k[3]]) : [];
          return h('div', null, h('div', { class: 'score-line' }, h('b', { class: k[5], text: k[0] }),
            h('span', { class: 'meter' }, D.width(h('span', { class: k[4] }), sc[k[1]] / k[2] * 100)),
            h('span', null, h('b', { text: sc[k[1]] }), ' / ' + k[2])),
            h('p', { class: 'score-ev', text: ev.join(' · ') || '해당 없음' }));
        }),
        h('p', { class: 'note', text: '임시 계산(v0)입니다.' })] : D.empty('점수를 계산할 신호가 없습니다.'));

    // ---- 통계 2×2 · 그래프
    function stat(label, value, note, bars, barLabels) {
      return h('div', { class: 'tile kpi' }, h('span', { class: 'tile-label', text: label }), D.miniBars(bars, barLabels),
        h('span', { class: 'tile-num' }, value, h('small', { text: '건' })), h('span', { class: 'tile-note', text: note || '' }));
    }
    var stats = h('section', { class: 'stat-grid', 'aria-label': '통계' },
      stat('허가 제품', data.registrations.length, years[0] + '년부터 연도별', yReg, years),
      stat('혁신의료기기 지정', data.innovations.length, lastDate(data.innovations, 'designation_date') ? '최근 ' + D.fmt(lastDate(data.innovations, 'designation_date')) : '없음', yInn, years),
      stat('임상시험 승인', data.trials.length, lastDate(data.trials, 'approval_date') ? '최근 ' + D.fmt(lastDate(data.trials, 'approval_date')) : '없음', yTri, years),
      stat('최근 1년 소식', tl.length, '월별', mNews, months));
    var charts = h('section', { class: 'card', 'aria-label': '그래프' }, h('div', { class: 'charts-2' },
      D.lineChart({ title: '연도별 허가·지정·임상 건수', labels: years.map(String), unit: '건',
        series: [{ name: '허가', values: yReg, cls: 's1' }, { name: '혁신 지정', values: yInn, cls: 's2' }, { name: '임상 승인', values: yTri, cls: 's3' }] }),
      D.lineChart({ title: '최근 12개월 소식 건수', labels: months.map(function (m) { return Number(m.slice(5)) + '월'; }), unit: '건',
        series: [{ name: '소식', values: mNews, cls: 's1' }] })));

    // ---- 인허가 진행 단계 (한 줄)
    var steps = [
      { name: '디지털의료기기 허가', done: data.registrations.length > 0, note: data.registrations.length ? data.registrations.length + '건 · 최근 ' + D.fmt(lastDate(data.registrations, 'approval_date')) : '정보 없음' },
      { name: '혁신의료기기 지정', done: data.innovations.length > 0, note: data.innovations.length ? data.innovations.length + '건 · ' + D.fmt(lastDate(data.innovations, 'designation_date')) : '정보 없음' },
      { name: '임상시험 승인', done: data.trials.length > 0, note: data.trials.length ? data.trials.length + '건 · ' + D.fmt(lastDate(data.trials, 'approval_date')) : '정보 없음' },
      { name: '평가 유예·신의료기술', done: !!(kinds['평가 유예'] || kinds['신의료기술 평가']), doing: !!kinds['혁신의료기술 평가'],
        note: (kinds['평가 유예'] || kinds['신의료기술 평가'] || kinds['혁신의료기술 평가'] || [{}])[0].detail || '정보 없음' },
      { name: '건강보험 급여', done: false, note: '수집 대상 아님' }
    ];
    var stepCard = h('section', { class: 'card', 'aria-labelledby': 'steps-h' }, h('h2', { id: 'steps-h', text: '인허가 진행 단계' }),
      h('ol', { class: 'steps one-row' }, steps.map(function (st) {
        var state = st.done ? 'done' : st.doing ? 'doing' : 'todo';
        return h('li', null, h('span', { class: 'step-dot ' + state, text: st.done ? '✓' : '' }), h('b', { text: st.name }),
          h('span', { class: 'step-state ' + state, text: st.done ? '완료' : st.doing ? '진행 중' : '아직' }), h('span', { class: 'note', text: st.note }));
      })));

    // ---- 탭: 가진 자료로 나눠 보기 (건수 0인 소식 종류는 숨김)
    function itemsPanel(list, empty) { return list.length ? list.map(function (f) { return D.feedItem(f); }) : D.empty(empty); }
    function more(list, render, n) {
      var box = h('div', { class: 'tab-panel' });
      var shown = 0;
      function add() {
        list.slice(shown, shown + n).forEach(function (x) { box.insertBefore(render(x), btn); });
        shown += n;
        if (shown >= list.length) btn.remove(); else btn.textContent = '더 보기 (' + (list.length - shown) + '건 남음)';
      }
      var btn = h('button', { type: 'button', class: 'btn small more', onclick: add });
      box.appendChild(btn);
      add();
      return box;
    }
    function regItem(r) {
      return h('div', { class: 'list-item' },
        r.source_url ? h('a', { class: 'list-title', href: r.source_url, target: '_blank', rel: 'noopener noreferrer', text: r.product_name || '(제품명 없음)' }) : h('b', { text: r.product_name || '(제품명 없음)' }),
        h('span', { class: 'list-meta', text: [r.permit_number, r.device_class && r.device_class + '등급', r.approval_date, RST[r.approval_status]].filter(Boolean).join(' · ') }),
        r.intended_use ? h('span', { class: 'list-detail', text: r.intended_use.slice(0, 220) }) : null);
    }
    function innItem(r) {
      return h('div', { class: 'list-item' },
        r.source_url ? h('a', { class: 'list-title', href: r.source_url, target: '_blank', rel: 'noopener noreferrer', text: r.item_name || '(제품명 없음)' }) : h('b', { text: r.item_name || '(제품명 없음)' }),
        h('span', { class: 'list-meta', text: [r.designation_number, D.fmt(r.designation_date), r.product_code].filter(Boolean).join(' · ') }),
        r.product_summary ? h('span', { class: 'list-detail', text: r.product_summary.slice(0, 260) }) : null);
    }
    function triItem(t) {
      return h('div', { class: 'list-item' },
        t.source_url ? h('a', { class: 'list-title', href: t.source_url, target: '_blank', rel: 'noopener noreferrer', text: t.trial_title }) : h('b', { text: t.trial_title }),
        h('span', { class: 'list-meta', text: [D.fmt(t.approval_date), t.product_name, t.trial_purpose].filter(Boolean).join(' · ') }),
        t.sites && t.sites.length ? h('span', { class: 'list-detail', text: '실시기관: ' + t.sites.join(', ') }) : null);
    }
    var NECA = ['평가 유예', '신의료기술 평가', '혁신의료기술 평가'];
    var neca = tl.filter(function (f) { return NECA.indexOf(f.kind) >= 0; });
    var TABS = [
      ['전체 소식 (1년)', tl.length, function () { return more(tl, function (f) { return D.feedItem(f); }, 20); }, true],
      ['혁신의료기기', data.innovations.length, function () { return data.innovations.length ? more(data.innovations, innItem, 20) : D.empty('혁신의료기기 지정 정보가 없습니다.'); }, true],
      ['허가 제품', data.registrations.length, function () { return data.registrations.length ? more(data.registrations, regItem, 20) : D.empty('허가 정보가 없습니다.'); }, true],
      ['임상시험', data.trials.length, function () { return data.trials.length ? more(data.trials, triItem, 20) : D.empty('임상시험 승인 정보가 없습니다.'); }, true],
      ['NECA 평가·유예', neca.length, function () { return itemsPanel(neca, ''); }]
    ].concat(['투자', '병원 협력', '전시·해외', 'R&D 과제', '논문·연구', '뉴스', '품목 허가'].map(function (k) {
      var lst = kinds[k] || [];
      return [k, lst.length, function () { return itemsPanel(lst, ''); }];
    })).filter(function (t) { return t[3] || t[1] > 0; });
    var tabBody = h('div', { role: 'tabpanel', id: 'tab-body' });
    var tabBar = h('div', { class: 'tabs wrap-tabs', role: 'tablist', 'aria-label': '기업 자료' });
    function pick(idx) {
      tabBar.querySelectorAll('.tab').forEach(function (b, j) { b.setAttribute('aria-selected', j === idx ? 'true' : 'false'); });
      D.set(tabBody, TABS[idx][2]());
    }
    TABS.forEach(function (t, idx) {
      tabBar.appendChild(h('button', { type: 'button', class: 'tab', role: 'tab', 'aria-controls': 'tab-body', 'aria-selected': 'false', onclick: function () { pick(idx); } },
        t[0], h('span', { class: 'badge gray', text: t[1] })));
    });
    var tabCard = h('section', { class: 'card', 'aria-label': '기업 자료' }, tabBar, tabBody);

    D.set(main,
      h('div', { class: 'detail-bar' },
        h('a', { class: 'btn small', href: 'company.html' }, D.svg('M15 5l-7 7 7 7', 20), '기업 목록'),
        h('a', { class: 'btn small', href: 'radar.html', text: '기업 레이더' }),
        h('span', { class: 'right' }, D.favButton('company', c.company_id, c.company_name, { text: true }))),
      h('div', { class: 'detail-grid' },
        h('div', { class: 'detail-col' }, info, stats),
        h('div', { class: 'detail-col' }, score, charts)),
      stepCard, tabCard);
    pick(0);
    document.title = c.company_name + ' · D*Find';
  }
})();
