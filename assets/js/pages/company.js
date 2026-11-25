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
    var input = h('input', { type: 'search', class: 'input grow', id: 'cq', placeholder: '기업명 · 주소 · 업허가번호 · 사업자번호', value: st.q,
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
        return [c.company_name, c.address, c.license_number, c.business_number].some(function (x) { return x && String(x).toLowerCase().indexOf(s) >= 0; });
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
          h('thead', null, h('tr', null, ['', '기업 유형', '기업명', '연관성', '허가·지정·임상', '최근 소식', '사업자번호', '업허가번호', '소재지', '연관 정보']
            .map(function (x, i) { return h('th', { scope: 'col', class: i === 0 ? 'w-star' : null }, i === 0 ? h('span', { class: 'sr', text: '관심' }) : x); }))),
          h('tbody', null, shown.map(row)))) : D.empty('조건에 맞는 기업이 없습니다.'),
        pages > 1 ? pager(pages) : null,
        h('p', { class: 'note', text: '연관성 = 조기 발굴 점수(v0, 100점 만점). 전화·대표자는 수집하는 자료에 없어 표시하지 않습니다.' }));
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
      var more = h('tr', { class: 'detail', hidden: true }, h('td', { colspan: 10 }));
      var btn = h('button', { type: 'button', class: 'btn small', 'aria-expanded': 'false', text: '더 보기', onclick: function () {
        more.hidden = !more.hidden; btn.setAttribute('aria-expanded', more.hidden ? 'false' : 'true'); btn.textContent = more.hidden ? '더 보기' : '접기';
        if (!more.hidden && !more.loaded) { more.loaded = true; related(c, more.firstChild); }
      } });
      return [h('tr', null,
        h('td', null, D.favButton('company', c.company_id, c.company_name, { small: true })),
        h('td', null, h('span', { class: 'chips tight' }, types.length ? types : D.badge('기타', 'gray'))),
        h('td', null, h('a', { class: 'company-link', href: D.companyHref(c.company_id), text: c.company_name }), c.field ? h('span', { class: 'note block', text: c.field }) : null),
        h('td', { class: 'nowrap' }, c.total ? [h('span', { class: 'meter small' }, D.width(h('span', { class: 'b1' }), c.total)), h('b', { text: ' ' + c.total }), h('span', { class: 'note', text: '점' })] : h('span', { class: 'note', text: '–' })),
        h('td', { class: 'nowrap', text: '허가 ' + c.n_products + ' · 지정 ' + c.n_innovations + ' · 임상 ' + c.n_trials }),
        h('td', { class: 'recent' }, c.recent_signal ? [h('span', { text: c.recent_signal }), h('span', { class: 'note block', text: D.fmt(c.recent_date) })] : h('span', { class: 'note', text: '–' })),
        h('td', { class: 'nowrap', text: fmtBiz(c.business_number) || '–' }),
        h('td', { class: 'nowrap', text: c.license_number || '–' }),
        h('td', { text: c.region || '–', title: c.address || '' }),
        h('td', null, btn)), more];
    }
    async function related(c, td) {
      D.set(td, D.loading());
      try {
        var d = await D.rpc('dash_company', { p_company_id: c.company_id });
        var tl = (d && d.timeline) || [];
        D.set(td, h('div', { class: 'related' },
          h('dl', { class: 'info' }, h('dt', { text: '주소' }), h('dd', { text: c.address || '정보 없음' }),
            h('dt', { text: '업허가' }), h('dd', { text: (d.licenses || []).map(function (l) { return (LIC[l.license_type] || '업') + ' ' + l.license_number + (l.license_date ? ' (' + l.license_date + ')' : '') + (LST[l.license_status] || ''); }).join(' / ') || '정보 없음' })),
          h('h3', { text: '연관 문서 (최근 1년 ' + tl.length + '건)' }),
          tl.length ? tl.slice(0, 5).map(function (f) { return D.feedItem(f, { noDetail: true }); }) : D.empty('최근 1년 소식이 없습니다.'),
          h('a', { class: 'btn small', href: D.companyHref(c.company_id), text: '기업 상세 보기' })));
      } catch (e) { D.set(td, D.fail(e)); }
    }
  }
  /* 이름 순: (주)·주식회사 등은 빼고 */
  function bare(n) { return String(n || '').replace(/\((주|유|재|사|의)\)|주식회사|유한회사|\s/g, ''); }
  function fmtBiz(b) { var s = String(b || '').replace(/\D/g, ''); return s.length === 10 ? s.slice(0, 3) + '-' + s.slice(3, 5) + '-' + s.slice(5) : (b || ''); }

  // =========================================================== 상세
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

    // ---- 그래프 자료: 연도별 허가·지정·임상, 최근 12개월 소식
    var years = [];
    var firstYear = Math.min.apply(null, [new Date().getFullYear() - 4].concat(
      [].concat(data.registrations.map(function (r) { return r.approval_date; }), data.innovations.map(function (r) { return r.designation_date; }),
        data.trials.map(function (r) { return r.approval_date; }), data.licenses.map(function (l) { return l.license_date; }))
        .filter(Boolean).map(function (d) { return Number(String(d).slice(0, 4)); })));
    firstYear = Math.max(firstYear, new Date().getFullYear() - 9);
    for (var y = firstYear; y <= new Date().getFullYear(); y++) years.push(y);
    function perYear(lst, k) { return years.map(function (yy) { return lst.filter(function (x) { return String(x[k] || '').slice(0, 4) === String(yy); }).length; }); }
    var yReg = perYear(data.registrations, 'approval_date'), yInn = perYear(data.innovations, 'designation_date'), yTri = perYear(data.trials, 'approval_date');
    var months = [];
    var today = D.today();
    for (var i = 11; i >= 0; i--) {
      var d = new Date(today.slice(0, 7) + '-01T00:00:00Z'); d.setUTCMonth(d.getUTCMonth() - i); months.push(d.toISOString().slice(0, 7));
    }
    var mNews = months.map(function (m) { return tl.filter(function (f) { return String(f.item_date || '').slice(0, 7) === m; }).length; });

    var steps = [
      { name: '디지털의료기기 허가', done: data.registrations.length > 0, note: data.registrations.length ? data.registrations.length + '건 · 최근 ' + D.fmt(lastDate(data.registrations, 'approval_date')) : '정보 없음' },
      { name: '혁신의료기기 지정', done: data.innovations.length > 0, note: data.innovations.length ? data.innovations.length + '건 · ' + D.fmt(lastDate(data.innovations, 'designation_date')) : '정보 없음' },
      { name: '임상시험 승인', done: data.trials.length > 0, note: data.trials.length ? data.trials.length + '건 · ' + D.fmt(lastDate(data.trials, 'approval_date')) : '정보 없음' },
      { name: '평가 유예·신의료기술', done: !!(kinds['평가 유예'] || kinds['신의료기술 평가']), doing: !!kinds['혁신의료기술 평가'],
        note: (kinds['평가 유예'] || kinds['신의료기술 평가'] || kinds['혁신의료기술 평가'] || [{}])[0].detail || '정보 없음' },
      { name: '건강보험 급여', done: false, note: '수집 대상 아님' }
    ];
    var crit = [['파이프라인', 's_pipeline', 40, 'pipeline', 'b1', 'c1'], ['기업 단계', 's_stage', 20, 'stage', 'b2', 'c2'],
      ['선행 신호', 's_signal', 25, 'signal', 'b3', 'c3'], ['웨어러블 적합', 's_wear', 15, 'wear', 'b4', 'c4']];
    var why = [];
    if (data.innovations.length) why.push('혁신의료기기 지정 제품 보유 (' + D.fmt(lastDate(data.innovations, 'designation_date')) + ')');
    if (data.trials.length) why.push('임상시험 승인 ' + data.trials.length + '건 · 최근 ' + D.fmt(lastDate(data.trials, 'approval_date')));
    if (kinds['평가 유예']) why.push('평가 유예 대상 — 출시 뒤 바로 병원 사용 가능');
    if (sc && sc.delta > 0) why.push('기준일 점수가 전날보다 ' + sc.delta + '점 올랐습니다');
    if (!why.length) why.push('최근 눈에 띄는 신호가 없습니다');

    var tlBox = h('div'), st = { cat: 'all' };
    function drawTimeline() {
      var cats = ['all', 'permit', 'market', 'research', 'disclosure'];
      var lst = tl.filter(function (f) { return st.cat === 'all' || f.category === st.cat; });
      D.set(tlBox,
        h('div', { class: 'chips', role: 'group', 'aria-label': '분야' }, cats.map(function (k) {
          var n = k === 'all' ? tl.length : tl.filter(function (f) { return f.category === k; }).length;
          return h('button', { type: 'button', class: 'chip', 'aria-pressed': st.cat === k ? 'true' : 'false',
            text: (k === 'all' ? '전체' : D.CAT[k].label) + ' ' + n, onclick: function () { st.cat = k; drawTimeline(); } });
        })),
        lst.length ? lst.slice(0, 30).map(function (f) { return D.feedItem(f); }) : D.empty('최근 1년 소식이 없습니다.'));
    }
    drawTimeline();

    function kpi(label, value, unit, note, bars, barLabels, max) {
      return h('div', { class: 'tile kpi' }, h('span', { class: 'tile-label', text: label }),
        bars ? D.miniBars(bars, barLabels, max) : null,
        h('span', { class: 'tile-num' }, value, h('small', { text: unit })), note ? h('span', { class: 'tile-note', text: note }) : null);
    }
    var badges = data.licenses.map(function (l) { return D.badge(LIC[l.license_type] || '업허가', 'lic-' + l.license_type); });
    if (data.innovations.length) badges.push(D.badge('★ 혁신의료기기 지정', 'star'));
    if (closed) badges.push(D.badge('휴·폐업', 'bad'));

    D.set(main,
      h('div', { class: 'chips' }, h('a', { class: 'btn small', href: 'company.html' }, D.svg('M15 5l-7 7 7 7', 20), '기업 목록으로'),
        h('a', { class: 'btn small', href: 'radar.html', text: '기업 레이더' })),
      h('div', { class: 'company-top' },
        h('section', { class: 'card company-info', 'aria-labelledby': 'cname' },
          h('div', { class: 'chips tight' }, badges),
          h('div', { class: 'card-head' }, h('h1', { class: 'company-name', id: 'cname', text: c.company_name }),
            D.favButton('company', c.company_id, c.company_name, { text: true, right: true })),
          h('dl', { class: 'info' },
            h('dt', { text: '사업자번호' }), h('dd', { text: fmtBiz(c.business_number) || '정보 없음' }),
            h('dt', { text: '소재지' }), h('dd', { text: address || '정보 없음' }),
            data.licenses.length ? data.licenses.map(function (l) {
              return [h('dt', { text: (LIC[l.license_type] || '업') + ' 허가' }), h('dd', { text: l.license_number + (l.license_date ? ' · ' + l.license_date : '') + (LST[l.license_status] || '') })];
            }) : [h('dt', { text: '업허가' }), h('dd', { text: '정보 없음' })],
            sc && sc.field ? [h('dt', { text: '분야' }), h('dd', { text: sc.field })] : null,
            sc ? [h('dt', { text: '조기 발굴 점수' }), h('dd', null, h('b', { text: sc.total + ' / 100' }), ' · ' + sc.rank + '위 · 전날 대비 ' + (sc.delta > 0 ? '▲ ' + sc.delta : sc.delta < 0 ? '▼ ' + Math.abs(sc.delta) : '변동 없음'))] : null),
          h('div', { class: 'chips' }, h('a', { class: 'btn small', href: 'regulatory.html?per=30&q=' + encodeURIComponent(c.company_name), text: '이 기업 인허가 소식' }),
            h('a', { class: 'btn small', href: 'market.html?per=30&q=' + encodeURIComponent(c.company_name), text: '이 기업 뉴스' })),
          h('p', { class: 'note', text: '출처: 이머디 업허가 현황 · 디지털의료기기 대장' })),
        h('section', { class: 'card company-charts', 'aria-label': '그래프' },
          D.lineChart({ title: '연도별 허가·지정·임상 건수', labels: years.map(String), unit: '건',
            series: [{ name: '디지털의료기기 허가', values: yReg, cls: 's1' }, { name: '혁신 지정', values: yInn, cls: 's2' }, { name: '임상 승인', values: yTri, cls: 's3' }] }),
          D.lineChart({ title: '최근 12개월 소식 건수', labels: months.map(function (m) { return Number(m.slice(5)) + '월'; }), unit: '건',
            series: [{ name: '소식', values: mNews, cls: 's1' }] }))),
      h('section', { class: 'tiles kpis', 'aria-label': '핵심 숫자' },
        kpi('조기 발굴 점수', sc ? sc.total : 0, '점', sc ? sc.rank + '위' : '점수 없음', sc ? crit.map(function (k) { return Math.round(sc[k[1]] / k[2] * 100); }) : null, crit.map(function (k) { return k[0] + ' (%)'; }), 100),
        kpi('허가 제품', data.registrations.length, '건', '연도별 ' + years[0] + '~', yReg, years),
        kpi('혁신의료기기 지정', data.innovations.length, '건', lastDate(data.innovations, 'designation_date') ? '최근 ' + D.fmt(lastDate(data.innovations, 'designation_date')) : '없음', yInn, years),
        kpi('임상시험 승인', data.trials.length, '건', lastDate(data.trials, 'approval_date') ? '최근 ' + D.fmt(lastDate(data.trials, 'approval_date')) : '없음', yTri, years),
        kpi('최근 1년 소식', tl.length, '건', '월별', mNews, months)),
      h('div', { class: 'row' },
        h('section', { class: 'card wide' }, h('h2', { text: '지금 볼 이유' }), h('ul', null, why.map(function (x) { return h('li', { text: x }); }))),
        h('section', { class: 'card wide' }, h('h2', { text: '인허가 진행 단계' }),
          h('ol', { class: 'steps' }, steps.map(function (s) {
            var state = s.done ? 'done' : s.doing ? 'doing' : 'todo';
            return h('li', null, h('span', { class: 'step-dot ' + state, text: s.done ? '✓' : '' }), h('b', { text: s.name }),
              h('span', { class: 'step-state ' + state, text: s.done ? '완료' : s.doing ? '진행 중' : '아직' }), h('span', { class: 'note', text: s.note }));
          })))),
      h('div', { class: 'row' },
        h('div', { class: 'wide' },
          sc ? h('section', { class: 'card' }, h('h2', { text: '점수 근거' }), crit.map(function (k) {
            var ev = sc.evidence && sc.evidence[k[3]] ? Object.values(sc.evidence[k[3]]) : [];
            return h('div', null, h('div', { class: 'score-line' }, h('b', { class: k[5], text: k[0] }),
              h('span', { class: 'meter' }, D.width(h('span', { class: k[4] }), sc[k[1]] / k[2] * 100)),
              h('span', null, h('b', { text: sc[k[1]] }), ' / ' + k[2])),
              h('p', { class: 'score-ev', text: ev.join(' · ') || '해당 없음' }));
          }), h('p', { class: 'note', text: '임시 계산(v0). 기준은 기업 레이더 화면에 있습니다.' })) : null,
          h('section', { class: 'card' }, h('h2', { text: '최근 1년 소식' }), tlBox)),
        h('div', { class: 'narrow' },
          h('section', { class: 'card' }, h('h2', null, '허가 제품 ', h('span', { class: 'note', text: data.registrations.length + '건' })),
            data.registrations.length ? data.registrations.map(function (r, i) {
              var el = h('div', { class: 'list-item' }, h('b', { text: r.product_name || '(제품명 없음)' }),
                h('span', { class: 'list-meta', text: [r.permit_number, r.device_class && r.device_class + '등급', r.approval_date, RST[r.approval_status]].filter(Boolean).join(' · ') }),
                r.intended_use ? h('span', { class: 'list-detail', text: r.intended_use.slice(0, 160) }) : null);
              if (i >= 8) el.hidden = true;
              return el;
            }) : D.empty('허가 정보가 없습니다.'),
            data.registrations.length > 8 ? h('button', { type: 'button', class: 'btn small', text: '나머지 ' + (data.registrations.length - 8) + '건 보기',
              onclick: function (e) { e.currentTarget.parentNode.querySelectorAll('.list-item[hidden]').forEach(function (x) { x.hidden = false; }); e.currentTarget.remove(); } }) : null),
          h('section', { class: 'card' }, h('h2', null, '임상시험 ', h('span', { class: 'note', text: data.trials.length + '건' })),
            data.trials.length ? data.trials.map(function (t) {
              return h('div', { class: 'list-item' },
                t.source_url ? h('a', { class: 'list-title', href: t.source_url, target: '_blank', rel: 'noopener noreferrer', text: t.trial_title }) : h('b', { text: t.trial_title }),
                h('span', { class: 'list-meta', text: [D.fmt(t.approval_date), t.product_name, t.trial_purpose].filter(Boolean).join(' · ') }),
                t.sites && t.sites.length ? h('span', { class: 'list-detail', text: '실시기관: ' + t.sites.join(', ') }) : null);
            }) : D.empty('임상시험 승인 정보가 없습니다.')))));
    document.title = c.company_name + ' · D*Find';
  }
})();
