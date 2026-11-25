/* 관리자 › 기준 정보: 키워드(·비슷한 말) / 언론사 RSS / 사용자·권한 */
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

  var TABS = [['kw', '키워드', drawKeywords], ['feed', '언론사 RSS', drawFeeds], ['user', '사용자·권한', drawUsers]];
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

  // ---- 사용자·권한 ----
  async function drawUsers() {
    var users;
    try { users = await D.rpc('admin_list_users'); } catch (e) { D.set(panel, D.fail(e)); return; }
    var body = h('tbody', null, users.map(function (u) {
      var me = D.user && u.user_id === D.user.id;
      var sel = h('select', { class: 'input', 'aria-label': u.email + ' 권한', disabled: me },
        [['', '권한 없음'], ['viewer', '보기'], ['admin', '관리자']].map(function (o) { return h('option', { value: o[0], text: o[1] }); }));
      sel.value = u.role || '';
      sel.addEventListener('change', async function () {
        try {
          if (!sel.value) await D.q(D.sb.from('user_roles').delete().eq('user_id', u.user_id));
          else await D.q(D.sb.from('user_roles').upsert({ user_id: u.user_id, role: sel.value }, { onConflict: 'user_id' }));
          say(u.email + ' 권한을 바꿨습니다');
        } catch (e) { say('바꾸지 못했습니다: ' + err(e), 'error'); drawUsers(); }
      });
      return h('tr', null, h('td', { text: u.email }), h('td', null, sel, me ? h('span', { class: 'list-meta', text: '본인 권한은 바꿀 수 없습니다' }) : null),
        h('td', { text: u.last_sign_in_at ? D.fmtTime(u.last_sign_in_at) : '접속 기록 없음' }));
    }));
    D.set(panel, h('h2', { text: '사용자·권한' }),
      h('p', { class: 'note', text: '보기 = 모든 화면 조회, 관리자 = 관리자 메뉴까지. 새 사용자는 Supabase › Authentication › Users › Invite user 로 초대한 뒤 여기서 권한을 줍니다.' }),
      h('div', { class: 'table-wrap' }, h('table', { class: 'grid' }, h('thead', null, h('tr', null,
        ['이메일', '권한', '마지막 접속'].map(function (t) { return h('th', { scope: 'col', text: t }); }))), body)));
  }

  drawTabs();
  open();
})();
