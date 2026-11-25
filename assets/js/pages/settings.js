/* 관리자 › 기준 정보: 키워드(·비슷한 말) / 언론사 RSS / 언론사 이름 / 사용자·권한 */
(async function () {
  'use strict';
  var main = await D.boot('settings', { admin: true });
  if (!main) return;
  var h = D.h;
  var tab = new URLSearchParams(location.search).get('tab') || 'kw';
  var msg = h('p', { class: 'notice', role: 'status', hidden: true });
  var tabs = h('div', { class: 'tabs', role: 'tablist', 'aria-label': '관리 항목' });
  var panel = h('section', { class: 'card', role: 'tabpanel' });
  function say(text, kind) { msg.hidden = false; msg.className = 'notice ' + (kind || 'info'); msg.textContent = text; }
  function err(e) { return (e && e.message) || String(e); }

  D.set(main, D.header('기준 정보 관리', '수집 키워드, 뉴스를 가져올 언론사, 대시보드 사용자를 관리합니다. 바꾼 내용은 다음 수집부터 반영됩니다.', { admin: true }),
    tabs, msg, panel);

  var TABS = [['kw', '키워드', drawKeywords], ['feed', '언론사 RSS', drawFeeds], ['pub', '언론사 이름', drawPublishers], ['user', '사용자·권한', drawUsers]];
  function drawTabs() {
    D.set(tabs, TABS.map(function (t) {
      return h('button', { type: 'button', class: 'tab', role: 'tab', 'aria-selected': tab === t[0] ? 'true' : 'false', text: t[1],
        onclick: function () { tab = t[0]; history.replaceState(null, '', '?tab=' + tab); msg.hidden = true; drawTabs(); open(); } });
    }));
  }
  function open() { D.set(panel, D.loading()); TABS.filter(function (t) { return t[0] === tab; })[0][2](); }

  // ---- 키워드 ----
  var CAT = { domain: '분야', signal: '신호', regulation: '규제', organization: '기관' };
  var CATC = { domain: 'permit', signal: 'market', regulation: 'research', organization: 'disclosure' };
  var USAGE = { search: '검색', match: '거름', exclude: '제외' };
  var kwState = { q: '', cat: 'all', activeOnly: false, adding: null };
  async function drawKeywords() {
    var kws, syns, asg = [];
    try {
      var r = await Promise.all([
        D.q(D.sb.from('keywords').select('*').order('keyword_category').order('term')),
        D.q(D.sb.from('keyword_synonyms').select('*').order('synonym')),
        D.q(D.sb.from('keyword_assignments').select('keyword_id,usage,is_active,crawl_targets(target_name,source_system)')).catch(function () { return []; })
      ]);
      kws = r[0]; syns = r[1]; asg = r[2] || [];
    } catch (e) { D.set(panel, D.fail(e)); return; }
    var term = h('input', { class: 'input', id: 'k-term', placeholder: '예: 연속혈당', onkeydown: function (e) { if (e.key === 'Enter') add(); } });
    var cat = h('select', { class: 'input', id: 'k-cat' }, Object.keys(CAT).map(function (k) { return h('option', { value: k, text: CAT[k] }); }));
    var search = h('input', { type: 'search', class: 'input', id: 'k-q', placeholder: '키워드·비슷한 말 찾기', value: kwState.q,
      oninput: function () { kwState.q = search.value.trim(); drawList(); } });
    var listBox = h('div');
    var chipBox = h('div', { class: 'chips', role: 'group', 'aria-label': '종류' });
    async function add() {
      if (!term.value.trim()) { say('키워드를 입력해 주세요.', 'error'); return; }
      try { await D.q(D.sb.from('keywords').insert({ term: term.value.trim(), keyword_category: cat.value })); say('"' + term.value.trim() + '" 을(를) 추가했습니다. 수집 대상에 배정해야 검색·거름에 쓰입니다.'); drawKeywords(); }
      catch (e) { say('추가하지 못했습니다: ' + (/keywords_term_uk|duplicate/.test(err(e)) ? '이미 있는 키워드입니다.' : err(e)), 'error'); }
    }
    function drawChips() {
      D.set(chipBox, [['all', '전체']].concat(Object.keys(CAT).map(function (k) { return [k, CAT[k]]; })).map(function (c) {
        var n = c[0] === 'all' ? kws.length : kws.filter(function (k) { return k.keyword_category === c[0]; }).length;
        return h('button', { type: 'button', class: 'chip', 'aria-pressed': kwState.cat === c[0] ? 'true' : 'false', onclick: function () { kwState.cat = c[0]; drawChips(); drawList(); } },
          c[0] !== 'all' ? h('span', { class: 'dot dot-' + CATC[c[0]] }) : null, ' ' + c[1] + ' ', h('span', { class: 'note', text: n }));
      }), h('label', { class: 'check', for: 'k-active' }, h('input', { type: 'checkbox', id: 'k-active', checked: kwState.activeOnly,
        onchange: function (e) { kwState.activeOnly = e.target.checked; drawList(); } }), '사용 중만'));
    }
    function drawList() {
      var s = kwState.q.toLowerCase();
      var list = kws.filter(function (k) {
        if (kwState.cat !== 'all' && k.keyword_category !== kwState.cat) return false;
        if (kwState.activeOnly && !k.is_active) return false;
        if (!s) return true;
        return k.term.toLowerCase().indexOf(s) >= 0 || syns.some(function (x) { return x.keyword_id === k.keyword_id && x.synonym.toLowerCase().indexOf(s) >= 0; });
      });
      if (!list.length) { D.set(listBox, D.empty('조건에 맞는 키워드가 없습니다.')); return; }
      D.set(listBox, h('div', { class: 'table-wrap' }, h('table', { class: 'grid kw-table' },
        h('thead', null, h('tr', null, h('th', { scope: 'col', text: '키워드' }), h('th', { scope: 'col', text: '비슷한 말' }), h('th', { scope: 'col', text: '쓰는 곳' }), h('th', { scope: 'col', class: 'w-switch', text: '사용' }))),
        h('tbody', null, list.map(function (k) {
          var mine = syns.filter(function (x) { return x.keyword_id === k.keyword_id; });
          var uses = asg.filter(function (a) { return a.keyword_id === k.keyword_id && a.is_active; });
          var adding = kwState.adding === k.keyword_id;
          var sIn = h('input', { class: 'input syn-input', 'aria-label': k.term + ' 비슷한 말', placeholder: '비슷한 말 입력 후 Enter',
            onkeydown: async function (e) {
              if (e.key === 'Escape') { kwState.adding = null; drawList(); return; }
              if (e.key !== 'Enter' || !sIn.value.trim()) return;
              try { await D.q(D.sb.from('keyword_synonyms').insert({ keyword_id: k.keyword_id, synonym: sIn.value.trim(), synonym_type: 'variant' })); kwState.adding = k.keyword_id; say('"' + sIn.value.trim() + '" 을(를) 추가했습니다'); drawKeywords(); }
              catch (er) { say('추가하지 못했습니다: ' + (/duplicate|uk/.test(err(er)) ? '이미 있는 말입니다.' : err(er)), 'error'); }
            } });
          return h('tr', { class: k.is_active ? null : 'off' },
            h('td', null, h('b', { class: 'kw-term', text: k.term }), h('span', { class: 'badge cat-' + CATC[k.keyword_category], text: CAT[k.keyword_category] || k.keyword_category })),
            h('td', null, h('span', { class: 'syn-chips' }, mine.map(function (x) {
              return h('span', { class: 'syn' }, x.synonym, h('button', { type: 'button', class: 'syn-x', 'aria-label': x.synonym + ' 삭제', title: '삭제', text: '×', onclick: async function () {
                try { await D.q(D.sb.from('keyword_synonyms').delete().eq('synonym_id', x.synonym_id)); say('"' + x.synonym + '" 을(를) 뺐습니다'); drawKeywords(); }
                catch (er) { say('삭제하지 못했습니다: ' + err(er), 'error'); }
              } }));
            }), adding ? sIn : h('button', { type: 'button', class: 'syn-add', text: '+ 추가', onclick: function () { kwState.adding = k.keyword_id; drawList(); } }))),
            h('td', null, uses.length ? h('span', { class: 'syn-chips' }, uses.slice(0, 4).map(function (a) {
              return h('span', { class: 'use use-' + a.usage, title: (a.crawl_targets && a.crawl_targets.source_system) || '' }, USAGE[a.usage] + ' · ' + ((a.crawl_targets && a.crawl_targets.target_name) || ''));
            }), uses.length > 4 ? h('span', { class: 'note', text: '+' + (uses.length - 4) }) : null) : h('span', { class: 'note', text: '배정 없음' })),
            h('td', null, h('button', { type: 'button', class: 'switch', role: 'switch', 'aria-checked': k.is_active ? 'true' : 'false', 'aria-label': k.term + ' 사용',
              onclick: async function () {
                try { await D.q(D.sb.from('keywords').update({ is_active: !k.is_active }).eq('keyword_id', k.keyword_id)); drawKeywords(); }
                catch (er) { say('바꾸지 못했습니다: ' + err(er), 'error'); }
              } }, h('span', { class: 'knob' }))));
        })))), h('p', { class: 'note', text: list.length + '개 · 비슷한 말은 × 로 빼고, + 추가 로 넣습니다. 쓰는 곳 = 수집 대상 배정 (검색: 출처에 검색어로 보냄 · 거름: 수집 뒤 이 말이 있는 것만 저장 · 제외: 이 말이 있으면 버림)' }));
      if (adding_focus()) sInFocus();
    }
    function adding_focus() { return kwState.adding !== null; }
    function sInFocus() { var el = listBox.querySelector('.syn-input'); if (el) el.focus(); }
    D.set(panel,
      h('div', { class: 'kw-top' },
        h('div', { class: 'kw-filter' }, h('h2', { text: '키워드 ' }), search, chipBox),
        h('div', { class: 'kw-add' }, h('label', { class: 'field', for: 'k-term' }, '새 키워드', term), h('label', { class: 'field', for: 'k-cat' }, '종류', cat),
          h('button', { type: 'button', class: 'btn primary', text: '추가', onclick: add }))),
      listBox);
    drawChips(); drawList();
  }

  // ---- 언론사 RSS ----
  async function drawFeeds() {
    var feeds, logs;
    try {
      feeds = await D.q(D.sb.from('news_feeds').select('*').order('publisher_name'));
      logs = await D.q(D.sb.from('news_crawl_logs').select('feed_id,status,completed_at,error_message').not('feed_id', 'is', null)
        .order('started_at', { ascending: false }).limit(1000));
    } catch (e) { D.set(panel, D.fail(e)); return; }
    var last = {};
    logs.forEach(function (l) { if (!last[l.feed_id]) last[l.feed_id] = l; });
    var name = h('input', { class: 'input', id: 'f-name', placeholder: '예: 메디칼타임즈' });
    var url = h('input', { class: 'input', id: 'f-url', type: 'url', placeholder: 'https:// RSS 주소' });
    var home = h('input', { class: 'input', id: 'f-home', type: 'url', placeholder: 'https:// (선택)' });
    var del = null;
    async function add() {
      if (!name.value.trim() || !/^https:\/\//.test(url.value.trim())) { say('언론사 이름과 https:// 로 시작하는 RSS 주소를 입력해 주세요.', 'error'); return; }
      try {
        await D.q(D.sb.from('news_feeds').insert({ publisher_name: name.value.trim(), feed_url: url.value.trim(), homepage_url: home.value.trim() || null }));
        say('추가했습니다. 다음 뉴스 수집부터 가져옵니다.'); drawFeeds();
      } catch (e) { say('추가하지 못했습니다: ' + (/feed_url_uk|duplicate/.test(err(e)) ? '이미 등록된 주소입니다.' : err(e)), 'error'); }
    }
    function draw() {
      var body = h('tbody', null, feeds.map(function (f) {
        var l = last[f.feed_id];
        var ok = l && ['success', 'empty'].indexOf(l.status) >= 0;
        return h('tr', null,
          h('td', null, h('b', { text: f.publisher_name }), h('span', { class: 'list-meta', text: f.feed_url })),
          h('td', { text: l ? D.fmtTime(l.completed_at) : '아직 없음' }),
          h('td', null, l ? D.badge(ok ? '정상' : '오류', ok ? 'ok' : 'bad') : D.badge('대기', 'gray'),
            l && !ok && l.error_message ? h('span', { class: 'list-meta', text: l.error_message.slice(0, 80) }) : null),
          h('td', null, h('button', { type: 'button', class: 'btn small' + (f.is_active ? ' on' : ''), 'aria-pressed': f.is_active ? 'true' : 'false',
            text: f.is_active ? '사용' : '멈춤', onclick: async function () {
              try { await D.q(D.sb.from('news_feeds').update({ is_active: !f.is_active }).eq('feed_id', f.feed_id)); drawFeeds(); }
              catch (e) { say('바꾸지 못했습니다: ' + err(e), 'error'); }
            } })),
          h('td', null, del === f.feed_id
            ? h('span', { class: 'chips' }, h('button', { type: 'button', class: 'btn small danger', text: '정말 삭제', onclick: async function () {
                try { await D.q(D.sb.from('news_feeds').delete().eq('feed_id', f.feed_id)); say(f.publisher_name + ' 을(를) 삭제했습니다'); drawFeeds(); }
                catch (e) { say('삭제하지 못했습니다: ' + err(e), 'error'); }
              } }), h('button', { type: 'button', class: 'btn small', text: '취소', onclick: function () { del = null; draw(); } }))
            : h('button', { type: 'button', class: 'btn small danger', text: '삭제', onclick: function () { del = f.feed_id; draw(); } })));
      }));
      D.set(panel, h('h2', { text: '언론사 RSS' }),
        h('div', { class: 'top' }, h('label', { class: 'field', for: 'f-name' }, '언론사 이름', name), h('label', { class: 'field', for: 'f-url' }, 'RSS 주소', url),
          h('label', { class: 'field', for: 'f-home' }, '홈페이지 (선택)', home), h('button', { type: 'button', class: 'btn primary', text: '추가', onclick: add })),
        h('p', { class: 'note', text: '새 주소가 제대로 읽히는지는 GitHub › Actions › crawl-manual › news_probe 에 주소를 넣어 확인할 수 있습니다.' }),
        h('div', { class: 'table-wrap' }, h('table', { class: 'grid' }, h('thead', null, h('tr', null,
          ['언론사', '마지막 수집', '상태', '사용', '관리'].map(function (t) { return h('th', { scope: 'col', text: t }); }))), body)));
    }
    draw();
  }

  // ---- 언론사 이름 (네이버 검색 기사는 주소만 있어 주소 → 언론사명 사전으로 이름을 보여 줌) ----
  async function drawPublishers() {
    var unnamed, names;
    try {
      unnamed = await D.rpc('admin_unnamed_publishers', { p_days: 60 });
      names = await D.q(D.sb.from('news_publishers').select('domain,publisher_name').order('publisher_name'));
    } catch (e) { D.set(panel, D.fail(e)); return; }
    var q = h('input', { class: 'input', type: 'search', placeholder: '언론사명·주소 찾기', 'aria-label': '등록된 언론사 찾기' });
    var listBox = h('div');
    async function save(domain, name, done) {
      name = (name || '').trim();
      if (!name) { say('언론사명을 입력해 주세요.', 'error'); return; }
      try {
        await D.q(D.sb.from('news_publishers').upsert({ domain: domain, publisher_name: name }, { onConflict: 'domain' }));
        say(domain + ' → ' + name + ' 로 저장했습니다. 뉴스 화면·메일에 바로 반영됩니다.');
        if (done) done(); else drawPublishers();
      } catch (e) { say('저장하지 못했습니다: ' + err(e), 'error'); }
    }
    var newDom = h('input', { class: 'input', id: 'p-dom', placeholder: '예: medicaltimes.com' });
    var newName = h('input', { class: 'input', id: 'p-name', placeholder: '예: 메디칼타임즈' });
    function addNew() {
      var d = newDom.value.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^(www|m)\./, '');
      if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(d)) { say('주소는 medicaltimes.com 처럼 도메인만 입력해 주세요.', 'error'); return; }
      save(d, newName.value);
    }
    function drawList() {
      var t = q.value.trim().toLowerCase();
      var rows = names.filter(function (n) { return !t || n.domain.indexOf(t) >= 0 || n.publisher_name.toLowerCase().indexOf(t) >= 0; });
      D.set(listBox, h('div', { class: 'table-wrap' }, h('table', { class: 'grid' },
        h('thead', null, h('tr', null, ['언론사명', '주소(도메인)', ''].map(function (x) { return h('th', { scope: 'col', text: x }); }))),
        h('tbody', null, rows.slice(0, 300).map(function (n) {
          var inp = h('input', { class: 'input small', value: n.publisher_name, 'aria-label': n.domain + ' 언론사명' });
          return h('tr', null, h('td', null, inp), h('td', { class: 'nowrap', text: n.domain }),
            h('td', null, h('span', { class: 'chips' },
              h('button', { type: 'button', class: 'btn small', text: '저장', onclick: function () { save(n.domain, inp.value, function () { n.publisher_name = inp.value.trim(); }); } }),
              h('button', { type: 'button', class: 'btn small danger', text: '삭제', onclick: async function () {
                try { await D.q(D.sb.from('news_publishers').delete().eq('domain', n.domain)); say(n.domain + ' 이름을 지웠습니다'); drawPublishers(); }
                catch (e) { say('지우지 못했습니다: ' + err(e), 'error'); }
              } }))));
        })))), h('p', { class: 'note', text: '등록 ' + names.length + '곳' + (rows.length > 300 ? ' · 앞 300곳만 보임 (찾기로 좁혀 주세요)' : '') }));
    }
    q.addEventListener('input', drawList);
    D.set(panel, h('h2', { text: '언론사 이름' }),
      h('p', { class: 'note', text: '네이버 검색으로 모은 기사는 언론사 이름 없이 주소만 옵니다. 여기서 주소마다 언론사명을 정하면 뉴스 화면·기업 정보·메일에 이름으로 보입니다. (하위 주소도 같이 적용: chosun.com → news.chosun.com)' }),
      h('h3', { class: 'sub-h', text: '이름이 없는 언론사 (최근 60일 기사)' }),
      unnamed.length ? h('div', { class: 'table-wrap' }, h('table', { class: 'grid' },
        h('thead', null, h('tr', null, ['주소(도메인)', '기사', '최근 기사 제목', '언론사명'].map(function (x) { return h('th', { scope: 'col', text: x }); }))),
        h('tbody', null, unnamed.map(function (u) {
          var inp = h('input', { class: 'input small', placeholder: '언론사명', 'aria-label': u.domain + ' 언론사명' });
          inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') save(u.domain, inp.value); });
          return h('tr', null, h('td', { class: 'nowrap' }, h('a', { href: 'https://' + u.domain, target: '_blank', rel: 'noopener noreferrer', text: u.domain })),
            h('td', { class: 'nowrap', text: D.num(u.articles) + '건' }), h('td', { class: 'wrap', text: D.clean(u.sample_title || '') }),
            h('td', null, h('span', { class: 'chips nowrap' }, inp, h('button', { type: 'button', class: 'btn small primary', text: '저장', onclick: function () { save(u.domain, inp.value); } }))));
        })))) : D.empty('모든 기사에 언론사명이 있습니다.'),
      h('h3', { class: 'sub-h', text: '직접 추가' }),
      h('div', { class: 'top' }, h('label', { class: 'field', for: 'p-dom' }, '주소(도메인)', newDom), h('label', { class: 'field', for: 'p-name' }, '언론사명', newName),
        h('button', { type: 'button', class: 'btn primary', text: '추가', onclick: addNew })),
      h('details', { class: 'pub-all' }, h('summary', { text: '등록된 언론사 ' + names.length + '곳 보기 · 고치기' }),
        h('div', { class: 'top' }, q), listBox));
    drawList();
  }

  // ---- 사용자·권한: 추가 · 이름 · 권한 · 비밀번호 초기화 ----
  async function drawUsers() {
    var users;
    try { users = await D.rpc('admin_list_users'); } catch (e) { D.set(panel, D.fail(e)); return; }
    var ROLES = [['viewer', '보기'], ['admin', '관리자']];
    var em = h('input', { class: 'input', id: 'u-email', type: 'email', placeholder: 'name@회사.com', autocomplete: 'off' });
    var nm = h('input', { class: 'input', id: 'u-name', placeholder: '예: 홍길동', autocomplete: 'off' });
    var rl = h('select', { class: 'input', id: 'u-role' }, ROLES.map(function (o) { return h('option', { value: o[0], text: o[1] }); }));
    var hint = h('span', { class: 'note' });
    function showHint() { var v = em.value.trim().toLowerCase(); hint.textContent = v.indexOf('@') > 0 ? '처음 비밀번호: ' + v.split('@')[0] : ''; }
    em.addEventListener('input', showHint);
    async function add() {
      var v = em.value.trim().toLowerCase();
      if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(v)) { say('이메일을 정확히 입력해 주세요.', 'error'); em.focus(); return; }
      if (!nm.value.trim()) { say('이름을 입력해 주세요.', 'error'); nm.focus(); return; }
      try {
        await D.rpc('admin_create_user', { p_email: v, p_name: nm.value.trim(), p_role: rl.value });
        say(nm.value.trim() + '(' + v + ') 계정을 만들었습니다. 처음 비밀번호는 "' + v.split('@')[0] + '" 이고, 첫 로그인 때 새 비밀번호로 바꾸게 됩니다.');
        drawUsers();
      } catch (e) { say('만들지 못했습니다: ' + err(e), 'error'); }
    }
    var resetAsk = null;
    function draw() {
      var body = h('tbody', null, users.map(function (u) {
        var me = D.user && u.user_id === D.user.id;
        var name = h('input', { class: 'input small', value: u.display_name || '', placeholder: '이름', 'aria-label': u.email + ' 이름' });
        async function saveName() {
          if ((u.display_name || '') === name.value.trim()) return;
          try { await D.rpc('admin_set_user_name', { p_user_id: u.user_id, p_name: name.value.trim() }); u.display_name = name.value.trim(); say(u.email + ' 이름을 바꿨습니다'); }
          catch (e) { say('바꾸지 못했습니다: ' + err(e), 'error'); }
        }
        name.addEventListener('change', saveName);
        name.addEventListener('keydown', function (e) { if (e.key === 'Enter') name.blur(); });
        var sel = h('select', { class: 'input small', 'aria-label': u.email + ' 권한', disabled: me },
          [['', '권한 없음']].concat(ROLES).map(function (o) { return h('option', { value: o[0], text: o[1] }); }));
        sel.value = u.role || '';
        sel.addEventListener('change', async function () {
          try {
            if (!sel.value) await D.q(D.sb.from('user_roles').delete().eq('user_id', u.user_id));
            else await D.q(D.sb.from('user_roles').upsert({ user_id: u.user_id, role: sel.value }, { onConflict: 'user_id' }));
            u.role = sel.value || null; say(u.email + ' 권한을 바꿨습니다');
          } catch (e) { say('바꾸지 못했습니다: ' + err(e), 'error'); drawUsers(); }
        });
        var reset = resetAsk === u.user_id
          ? h('span', { class: 'chips nowrap' },
              h('button', { type: 'button', class: 'btn small danger', text: '"' + u.email.split('@')[0] + '" 로 초기화', onclick: async function () {
                try { await D.rpc('admin_reset_password', { p_user_id: u.user_id }); resetAsk = null; u.must_change_password = true;
                  say(u.email + ' 비밀번호를 "' + u.email.split('@')[0] + '" 로 초기화했습니다. 다음 로그인 때 새 비밀번호로 바꾸게 됩니다.'); draw(); }
                catch (e) { say('초기화하지 못했습니다: ' + err(e), 'error'); }
              } }),
              h('button', { type: 'button', class: 'btn small', text: '취소', onclick: function () { resetAsk = null; draw(); } }))
          : h('button', { type: 'button', class: 'btn small', text: '비밀번호 초기화', onclick: function () { resetAsk = u.user_id; draw(); } });
        return h('tr', null,
          h('td', null, name),
          h('td', { class: 'nowrap' }, u.email, me ? h('span', { class: 'list-meta', text: '나' }) : null),
          h('td', null, sel),
          h('td', null, u.must_change_password ? D.badge('비밀번호 변경 전', 'warn') : D.badge('사용 중', 'ok')),
          h('td', { class: 'nowrap', text: u.last_sign_in_at ? D.fmtTime(u.last_sign_in_at) : '접속 기록 없음' }),
          h('td', null, reset));
      }));
      D.set(panel, h('h2', { text: '사용자·권한' }),
        h('div', { class: 'add-box' }, h('b', { text: '사용자 추가' }),
          h('div', { class: 'top' }, h('label', { class: 'field', for: 'u-email' }, '아이디 (회사 이메일)', em), h('label', { class: 'field', for: 'u-name' }, '이름', nm),
            h('label', { class: 'field', for: 'u-role' }, '권한', rl), h('button', { type: 'button', class: 'btn primary', text: '추가', onclick: add })),
          hint),
        h('p', { class: 'note', text: '보기 = 모든 화면 조회, 관리자 = 관리자 메뉴까지. 처음·초기화 비밀번호는 이메일 @ 앞부분이고, 그 비밀번호로 로그인하면 새 비밀번호를 정해야 다음 화면으로 갑니다. 이름은 칸에서 고치면 바로 저장됩니다.' }),
        h('div', { class: 'table-wrap' }, h('table', { class: 'grid users-table' }, h('thead', null, h('tr', null,
          ['이름', '아이디(이메일)', '권한', '상태', '마지막 접속', '비밀번호'].map(function (t) { return h('th', { scope: 'col', text: t }); }))), body)));
    }
    draw();
  }

  drawTabs();
  open();
})();
