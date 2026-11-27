/* 분야별 화면 공통 (인허가·제도 / 시장·투자 / 연구·과제 / 공시)
   [조회] 기간 + 검색어(제목·본문·첨부파일 내용까지) + 종류 → dash_feed
   [종류별 칸] 누르면 걸러 보기 → [목록] (첨부는 목록에서 바로 '원본 내려받기') */
(function () {
  'use strict';
  var h = D.h;

  /* 조회 영역: 기간 막대 + 검색어 + 종류 + 검색/초기화. 검색어·종류는 주소(?q=…&kind=…)에도 남김 */
  D.searchPanel = function (o) {
    var p = new URLSearchParams(location.search);
    var st = { q: p.get('q') || '', kind: p.get('kind') || 'all' };
    var input = h('input', { type: 'search', class: 'input grow', id: 'q', placeholder: o.searchHint || '기업·제품·제목·본문 내용', value: st.q,
      onkeydown: function (e) { if (e.key === 'Enter') { e.preventDefault(); search(); } } });
    var kind = h('select', { class: 'input', id: 'kind', onchange: function (e) { st.kind = e.target.value; save(); if (o.onKind) o.onKind(st.kind); } });
    function fillKinds(list) {
      D.set(kind, h('option', { value: 'all', text: '전체' }), list.map(function (k) { return h('option', { value: k, text: k }); }));
      kind.value = list.indexOf(st.kind) >= 0 ? st.kind : 'all';
      st.kind = kind.value;
    }
    fillKinds(o.kinds || []);
    var bar = D.periodBar({ label: '기간', defaultPer: o.defaultPer || '7', onChange: function () { fire(); } });
    bar.classList.add('embedded');
    function save() {
      var q = new URLSearchParams(location.search);
      if (st.q) q.set('q', st.q); else q.delete('q');
      if (st.kind !== 'all') q.set('kind', st.kind); else q.delete('kind');
      history.replaceState(null, '', '?' + q.toString());
    }
    function fire() { save(); var r = bar.range(); o.onSearch({ from: r.from, to: r.to, q: st.q.trim(), kind: st.kind }); }
    function search() { st.q = input.value; fire(); }
    var el = h('section', { class: 'card search-panel', 'aria-label': '조회 조건' },
      h('div', { class: 'card-head' }, h('h2', { text: '조회' }), h('span', { class: 'note', text: '검색어는 제목·기업명뿐 아니라 본문과 첨부파일 내용까지 찾습니다' })),
      bar,
      h('div', { class: 'search-row' },
        h('label', { class: 'field grow', for: 'q' }, '검색어', input),
        h('label', { class: 'field', for: 'kind' }, '종류', kind),
        h('div', { class: 'search-btns' },
          h('button', { type: 'button', class: 'btn primary', onclick: search }, D.svg('M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14M20 20l-4-4', 20), '검색'),
          h('button', { type: 'button', class: 'btn', text: '초기화', onclick: function () { input.value = ''; st.q = ''; st.kind = 'all'; kind.value = 'all'; if (o.onKind) o.onKind('all'); fire(); } }))));
    return {
      el: el, state: st, fillKinds: fillKinds,
      setKind: function (k) { st.kind = k; kind.value = k; save(); },
      start: function () { bar.start(); }
    };
  };

  /* 종류별 칸: 이름은 왼쪽 위, 건수·출처는 오른쪽 아래 (CSS .tile) */
  D.kindTiles = function (rows, o, cur, onPick) {
    var count = {};
    rows.forEach(function (f) { count[f.kind] = (count[f.kind] || 0) + 1; });
    var kinds = (o.kinds || []).concat(Object.keys(count).filter(function (k) { return (o.kinds || []).indexOf(k) < 0; }));
    var defs = [['all', '전체', rows.length, o.allNote || '조회한 기간']].concat(kinds.map(function (k) { return [k, k, count[k] || 0, (o.kindNotes || {})[k] || '']; }));
    return defs.map(function (d) {
      return h('button', { type: 'button', class: 'tile', 'aria-pressed': cur === d[0] ? 'true' : 'false', onclick: function () { onPick(d[0]); } },
        h('span', { class: 'tile-label', text: d[1] }), h('span', { class: 'tile-num' }, D.num(d[2]), h('small', { text: '건' })),
        h('span', { class: 'tile-note', text: d[3] || '' }));
    });
  };

  /* 같은 기사 묶기 (뉴스만, 인허가·공시는 건마다 다른 사건이라 묶지 않음)
     - 묶음 키: 서버가 뉴스 수집 때 계산한 것(dash_news_groups · group_key, common/news_dedup.py 규칙)
     - 서버 키가 없는 기사: 언론사 꼬리·말머리·기호를 뗀 제목이 8글자 이상 똑같을 때만
     - 대표: 언론사 우선순위(관리자 설정) → 분류(인허가·정책 > 투자 > 병원·임상 > 연구·R&D > 제품·출시 > 전시·해외 > 경쟁사·파트너사) → 기업명 → 금액 → 최신. 나머지는 '외 N건'
     - NEW·건수: 묶음 1건, 묶음에서 가장 먼저 들어온 때 기준 */
  var KIND_ORDER = { '인허가·정책': 0, '투자': 1, '병원·임상': 2, '연구·R&D': 3, '제품·출시': 4, '전시·해외': 5, '경쟁사·파트너사': 6,
                     '병원 협력': 2, 'R&D 과제': 3, '논문·연구': 3, '뉴스': 6 };
  // 언론사 우선순위 (news_publisher_ranks, 관리자 › 기준 정보 › 언론사 우선순위). 없으면 99 = 맨 뒤
  var PUB_RANK = null;
  D.loadPubRanks = async function (force) {
    if (PUB_RANK && !force) return PUB_RANK;
    var m = {};
    try { (await D.q(D.sb.from('news_publisher_ranks').select('publisher_name,rank_level'))).forEach(function (r) { m[r.publisher_name] = r.rank_level; }); }
    catch (e) { console.error(e); }
    PUB_RANK = m;
    return m;
  };
  D.pubRank = function (label) { var r = PUB_RANK && PUB_RANK[String(label || '').trim()]; return r == null ? 99 : r; };
  var MONEY = /\d[\d,.]*\s*(조|억|천만|만)\s*원?/;
  D.titleKey = function (t) {
    var s = D.clean(t || '');
    for (var n = 0; n < 3; n++) s = s.replace(/^\s*(\[[^\]]{1,15}\]|【[^】]{1,15}】|<[^>]{1,15}>|\([^)]{1,10}\))\s*/, '');
    for (var m = 0; m < 2; m++) s = s.replace(/\s+[-|│ㅣ]\s*[^-|│ㅣ]{1,15}$/, '').replace(/\s*(\[[^\]]{1,12}\]|【[^】]{1,12}】|\([^)]{1,12}\))\s*$/, '');  // 끝의 언론사 꼬리
    s = s.toLowerCase().replace(/[^0-9a-z가-힣]/g, '');
    return s.length >= 8 ? s : null;
  };
  function leadRank(f) {
    var news = /^news:/.test(f.item_key || '');
    return [news ? D.pubRank(f.source_label) : 99, KIND_ORDER[f.kind] == null ? 6 : KIND_ORDER[f.kind], f.company_name ? 0 : 1, MONEY.test(f.title || '') ? 0 : 1];
  }
  function better(a, b) {  // a 가 대표로 더 나으면 true
    var x = leadRank(a), y = leadRank(b);
    for (var i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] < y[i];
    return String(a.item_date || '') > String(b.item_date || '');
  }
  D.groupSame = function (list, on, groupOf) {
    if (!on) return list.map(function (f) { return { f: f, dups: [] }; });
    var groups = [], seen = {}, map = groupOf || {};
    list.forEach(function (f) {
      var news = /^news:/.test(f.item_key || '');
      var k = news ? (map[f.item_key] || f.group_key || (D.titleKey(f.title) ? 't:' + D.titleKey(f.title) : null)) : null;
      if (k && seen[k]) seen[k].all.push(f);
      else { var g = { all: [f] }; groups.push(g); if (k) seen[k] = g; }
    });
    return groups.map(function (g) {
      var lead = g.all.reduce(function (a, b) { return better(b, a) ? b : a; });
      var first = g.all.map(function (x) { return x.collected_at; }).filter(Boolean).sort()[0];
      // 분류는 묶음 안에서 가장 앞 분류 (대표 언론사 제목에 분류 키워드가 없어도 다른 기사 제목으로 분류)
      var kindBy = g.all.reduce(function (a, b) { return (KIND_ORDER[b.kind] == null ? 6 : KIND_ORDER[b.kind]) < (KIND_ORDER[a.kind] == null ? 6 : KIND_ORDER[a.kind]) ? b : a; });
      var f = g.all.length > 1 ? Object.assign({}, lead, { first_seen: first, kind: kindBy.kind, category: kindBy.category, kind_from: kindBy.item_key }) : lead;
      return { f: f, dups: g.all.filter(function (x) { return x !== lead; }).sort(function (a, b) { return better(a, b) ? -1 : better(b, a) ? 1 : 0; }) };
    });
  };
  /* 같은 기사 묶기 기준 (common/news_dedup.py 와 같은 내용, 화면에서 펼쳐 봄) */
  D.dupRules = function () {
    var li = function (t) { return h('li', { text: t }); };
    return h('details', { class: 'card dup-rules' }, h('summary', null, '같은 기사 묶기 기준 보기'),
      h('div', { class: 'dup-rules-body' },
        h('h3', { text: '같은 기사로 보는 경우 (하나라도 맞으면 묶음)' }),
        h('ul', null,
          li('제목이 완전히 같음: 언론사 꼬리("- 의학신문", "| 머니투데이", 끝의 "[의학신문]"·"(종합)")와 말머리("[단독]"), 기호를 뗀 뒤 8글자 이상이 똑같으면 같은 기사'),
          li('핵심 단어 겹침 (기본 기준): 제목의 핵심 단어가 3개 이상, 그리고 짧은 쪽 제목 단어의 60% 이상 겹침'),
          li('보조 기준 (발행일 2일 이내 기사끼리만): 같은 투자 금액(예: "250억") + 핵심 단어 1개 이상 겹침, 또는 핵심 단어 2개 이상 + 짧은 쪽의 40% 이상 겹침'),
          li('A≈B, B≈C 이면 A·B·C 를 한 묶음으로 봄')),
        h('h3', { text: '핵심 단어에서 빼는 말' }),
        h('ul', null,
          li('어느 기사에나 나오는 말 약 230개: 투자·유치·억원·시리즈·디지털헬스케어·의료기기·허가·승인·임상·웨어러블·식약처·플랫폼·솔루션·출시·협약 등 (그래서 "웨어러블"만 같다고 묶이지 않음)'),
          li('2글자 미만 단어, 숫자로 시작하는 말(250억·3년), 3글자 이하 영문 약어(FDA·CEO), "시리즈C"·"프리A" 같은 투자 단계'),
          li('조사·어미를 뗀 뒤 비교 ("엔젤로보틱스는" = "엔젤로보틱스")')),
        h('h3', { text: '묶지 않는 것' }),
        h('ul', null,
          li('인허가·DART 공시: 건마다 다른 사건이라 묶지 않음 (뉴스만 묶음)'),
          li('"이번 주 투자 결산", "○곳", "총정리", "주간" 같은 라운드업 기사: 단어 비교에서 빼고, 제목이 완전히 같을 때만'),
          li('영문 논문 제목: 완전히 같을 때만')),
        h('h3', { text: '대표 기사와 건수' }),
        h('ul', null,
          li('대표: 언론사 우선순위 (매체력이 높은 언론사 기준: 조선·중앙·동아일보 > 매일경제·한국경제 > 연합뉴스·뉴시스·뉴스1 > 주요 전문지(데일리팜·메디파나·의학신문·약업신문·약사공론) > 그 밖, 관리자 › 기준 정보 › 언론사 우선순위에서 바꿈)'),
          li('언론사 단계가 같으면: 분류(인허가·정책 > 투자 > 병원·임상 > 연구·R&D > 제품·출시 > 전시·해외 > 경쟁사·파트너사) → 기업명 있음 → 금액 있음 → 언론사 RSS → 먼저 나온 기사. 나머지는 "외 N건"으로 접고 펼치면 같은 순서'),
          li('건수·NEW·메일·오늘의 결론에서 묶음은 1건. NEW 는 묶음에서 처음 들어온 기사 기준 (이미 본 사건의 후속 보도는 NEW 아님)'),
          li('묶음 계산: 뉴스 수집(3시간마다)이 끝날 때 최근 30일 기사로 다시 계산'))));
  };
  /* 뉴스 item_key → 묶음 키 (서버) */
  D.loadNewsGroups = async function (rows) {
    var keys = rows.map(function (f) { return f.item_key; }).filter(function (k) { return /^news:/.test(k || ''); });
    var out = {};
    for (var i = 0; i < keys.length; i += 1000) {
      (await D.rpc('dash_news_groups', { p_keys: keys.slice(i, i + 1000) })).forEach(function (r) { out[r.item_key] = r.group_key; });
    }
    return out;
  };
  /* '외 N건' 펼치기 (같은 기사 목록: 언론사 · 제목 · 날짜, 누르면 원문) */
  D.dupToggle = function (dups) {
    if (!dups || !dups.length) return null;
    var list = h('ul', { class: 'dup-list', hidden: true }, dups.map(function (f) {
      return h('li', null, h('span', { class: 'dup-pub', text: f.source_label || '' }),
        h('a', f.url ? { href: f.url, target: '_blank', rel: 'noopener noreferrer', text: D.clean(f.title) } : { href: D.itemHref(f.item_key), text: D.clean(f.title) }),
        h('span', { class: 'dup-date', text: f.item_date || '' }));
    }));
    var btn = h('button', { type: 'button', class: 'dup-btn', 'aria-expanded': 'false', text: '외 ' + dups.length + '건 ▾',
      onclick: function (e) { e.stopPropagation(); list.hidden = !list.hidden; btn.setAttribute('aria-expanded', list.hidden ? 'false' : 'true'); btn.textContent = '외 ' + dups.length + '건 ' + (list.hidden ? '▾' : '▴'); } });
    return h('span', { class: 'dup-wrap' }, btn, list);
  };
  /* 검색어가 제목·요약에 없으면 '본문·첨부에서 찾음' 표시 */
  D.foundInside = function (f, q) {
    if (!q) return false;
    var s = q.toLowerCase();
    return ![f.title, f.detail, f.company_name].some(function (x) { return x && D.clean(x).toLowerCase().indexOf(s) >= 0; });
  };

  D.categoryPage = async function (o) {
    var main = await D.boot(o.page);
    if (!main) return;
    // 분야별 최신 정보: 새 소식 확인용 한 줄 목록 (o.compact 가 false 일 때만 자세히)
    var ctx = { rows: [], files: {}, kind: 'all', q: '', group: true, shown: 60, groupOf: {}, compact: o.compact !== false };
    var tiles = h('section', { class: 'tiles', 'aria-label': '종류별 건수 (누르면 걸러 보기)' });
    var listCard = h('section', { class: 'card', 'aria-labelledby': 'list-h' });
    var panel = D.searchPanel({ kinds: o.kinds, defaultPer: o.defaultPer, searchHint: o.searchHint, onSearch: load,
      onKind: function (k) { ctx.kind = k; ctx.shown = 60; drawTiles(); drawList(); } });
    ctx.kind = panel.state.kind;
    var right = o.groupable ? h('button', { type: 'button', class: 'btn', 'aria-pressed': 'true', id: 'group-btn',
      onclick: function (e) { ctx.group = !ctx.group; e.currentTarget.setAttribute('aria-pressed', ctx.group ? 'true' : 'false');
        e.currentTarget.textContent = '같은 기사 묶기: ' + (ctx.group ? '켜짐' : '꺼짐'); drawTiles(); drawList(); } }, '같은 기사 묶기: 켜짐') : null;
    // 분야별 최신 정보 → 같은 분야 전체 리스트로
    var LIST_CAT = { research: 'research', disclosure: 'disclosure', market: 'market' }[o.page];
    var allLink = LIST_CAT ? h('a', { class: 'btn', href: 'list.html?cat=' + LIST_CAT, text: '전체 리스트 보기 →' }) : null;
    D.set(main, D.header(o.title, o.sub, { dot: 'dot-' + (o.dot || o.category), right: h('div', { class: 'group' }, right, allLink) }),
      o.notice ? h('p', { class: 'notice info', text: o.notice }) : null, o.groupable ? D.dupRules() : null, panel.el, tiles, listCard);
    panel.start();

    async function load(r) {
      ctx.q = r.q; ctx.kind = r.kind; ctx.shown = 60; ctx.files = {};
      D.set(tiles, D.loading()); D.set(listCard, D.loading());
      try {
        ctx.rows = await D.rpc('dash_feed', { p_from: r.from, p_to: r.to, p_category: o.category || null, p_limit: 2000, p_query: r.q || null });
        if (o.only) ctx.rows = ctx.rows.filter(o.only);   // 예: 뉴스만 / 뉴스 빼고
        ctx.groupOf = {};
        if (o.groupable) { try { await D.loadPubRanks(); ctx.groupOf = await D.loadNewsGroups(ctx.rows); } catch (e) { console.error(e); } }
      }
      catch (e) { D.set(tiles); D.set(listCard, D.fail(e)); return; }
      drawTiles(); drawList();
      ctx.files = await D.loadFiles(ctx.rows);
      if (Object.keys(ctx.files).length) drawList();
    }
    function pick(k) { ctx.kind = k; ctx.shown = 60; panel.setKind(k); drawTiles(); drawList(); }
    function shownRows() { return o.groupable && ctx.group ? D.groupSame(ctx.rows, true, ctx.groupOf).map(function (g) { return g.f; }) : ctx.rows; }
    function drawTiles() { D.set(tiles, D.kindTiles(shownRows(), { kinds: o.kinds, kindNotes: o.kindNotes, allNote: ctx.q ? '"' + ctx.q + '" 검색 결과' : '' }, ctx.kind, pick)); }
    function drawList() {
      // 묶은 뒤 대표 종류로 거름 (같은 기사가 투자·뉴스 두 칸에 두 번 세지지 않게)
      var groups = D.groupSame(ctx.rows, o.groupable && ctx.group, ctx.groupOf).filter(function (g) { return ctx.kind === 'all' || g.f.kind === ctx.kind; });
      var list = [].concat.apply([], groups.map(function (g) { return [g.f].concat(g.dups); }));
      if (o.renderList) { o.renderList(listCard, groups, ctx, { pick: pick, redraw: drawList, total: list.length }); return; }
      var items = groups.slice(0, ctx.shown).map(function (g) { return D.listEntry(g, ctx); });
      D.set(listCard,
        h('div', { class: 'card-head' }, h('h2', { id: 'list-h', text: ctx.kind === 'all' ? '목록' : ctx.kind }),
          h('span', { class: 'note', text: groups.length + '건' + (o.groupable && ctx.group && groups.length !== list.length ? ' (묶기 전 ' + list.length + '건)' : '') + ' · 최신순' })),
        items.length ? items : D.empty(ctx.q ? '"' + ctx.q + '" 이(가) 들어간 정보가 없습니다.' : o.emptyText),
        groups.length > ctx.shown ? h('button', { type: 'button', class: 'btn more', text: '60건 더 보기', onclick: function () { ctx.shown += 60; drawList(); } }) : null);
    }
  };

  /* 목록 한 줄 (+ 같은 소식 펼치기, 본문·첨부에서 찾음 표시) */
  D.listEntry = function (g, ctx) {
    var el = D.feedItem(g.f, { files: ctx.files[g.f.item_key], compact: ctx.compact });
    if (D.foundInside(g.f, ctx.q)) el.querySelector('.list-meta').appendChild(D.badge('본문·첨부에서 찾음', 'warn'));
    if (g.dups.length) el.appendChild(D.dupToggle(g.dups));
    return el;
  };
})();
