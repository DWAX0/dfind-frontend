/* 기업 한 곳 보기 (기업 정보 상세 화면 · 기업 레이더 오른쪽 패널에서 같이 씀)
   D.renderCompany(box, data, { mode: 'full' | 'brief' })
   D.openCompanyDrawer(id) — 오른쪽 패널, [크게 보기] 누르면 전체 화면 */
(function () {
  'use strict';
  var h = D.h;
  var LIC = { manufacture: '제조업', import: '수입업', repair: '수리업', sales: '판매·임대업' };
  var LST = { active: '', suspended: ' (휴업)', closed: ' (폐업)' };
  var RST = { active: '정상', withdrawn: '취하', cancelled: '취소' };
  var RTYPE = { approval: '허가', certification: '인증', notification: '신고' };
  var STYPE = { digital_device_license: '디지털의료기기 허가', new_device_review: '신개발 의료기기 심사' };
  var CRIT = [['파이프라인', 's_pipeline', 40, 'pipeline', 'b1'], ['기업 단계', 's_stage', 20, 'stage', 'b2'],
    ['선행 신호', 's_signal', 25, 'signal', 'b3'], ['웨어러블 적합', 's_wear', 15, 'wear', 'b4']];
  var NECA = ['평가 유예', '신의료기술 평가', '혁신의료기술 평가'];

  /* Storage 그림 (로그인한 사람만 받을 수 있어 받아서 blob 주소로 보여 줌) */
  var imgCache = {};
  D.storageImg = function (path, alt) {
    var img = h('img', { alt: alt || '', class: 'thumb', loading: 'lazy' });
    if (!path) return img;
    (imgCache[path] = imgCache[path] || D.sb.storage.from('attachments').download(path).then(function (r) {
      if (r.error) throw r.error;
      return URL.createObjectURL(r.data);
    })).then(function (u) { img.src = u; }, function (e) { console.error(e); img.classList.add('broken'); });
    return img;
  };

  function lastDate(lst, k) { return lst && lst.length ? lst.map(function (x) { return x[k]; }).filter(Boolean).sort().pop() : null; }
  function kindsOf(tl) { var k = {}; tl.forEach(function (f) { (k[f.kind] = k[f.kind] || []).push(f); }); return k; }

  // ---- 조기 발굴 점수 (기획안처럼 단순하게: 큰 숫자 + 4색 쌓은 막대 + 항목별 점수) ----
  function scoreCard(sc) {
    var card = h('section', { class: 'card score-simple', 'aria-label': '조기 발굴 점수' });
    if (!sc) return D.set(card, h('div', { class: 'card-head' }, h('h2', { text: '조기 발굴 점수' })), D.empty('점수를 계산할 신호가 없습니다.'));
    var stack = h('div', { class: 'score-stack', role: 'img', 'aria-label': CRIT.map(function (c) { return c[0] + ' ' + sc[c[1]]; }).join(', ') });
    CRIT.forEach(function (c) {
      var ev = sc.evidence && sc.evidence[c[3]] ? Object.values(sc.evidence[c[3]]).join(' · ') : '';
      if (sc[c[1]] > 0) stack.appendChild(D.width(h('i', { class: c[4], title: c[0] + ' ' + sc[c[1]] + '점' + (ev ? ' — ' + ev : '') }), sc[c[1]]));
    });
    return D.set(card,
      h('div', { class: 'card-head' }, h('h2', { text: '조기 발굴 점수' }), h('a', { class: 'right', href: D.root + 'radar.html', text: '평가 기준' })),
      h('div', { class: 'score-row' }, h('span', { class: 'score-big', text: sc.total }), h('span', { class: 'score-of', text: '/ 100' }),
        h('span', { class: 'score-rank', text: sc.rank + '위' }),
        h('span', { class: sc.delta > 0 ? 'delta-up' : sc.delta < 0 ? 'delta-down' : 'delta-same', text: sc.delta > 0 ? '▲ ' + sc.delta : sc.delta < 0 ? '▼ ' + Math.abs(sc.delta) : '전날과 같음' })),
      stack,
      h('div', { class: 'legend' }, CRIT.map(function (c) { return h('span', null, h('i', { class: 'sw ' + c[4] }), c[0] + ' ' + sc[c[1]] + ' / ' + c[2]); })));
  }

  // ---- 인허가 현황 (단계를 누르면 아래 탭으로) ----
  function statusCard(data, kinds, onPick) {
    var steps = [
      ['디지털의료기기 허가', data.registrations.length, lastDate(data.registrations, 'approval_date'), '허가 제품'],
      ['혁신의료기기 지정', data.innovations.length, lastDate(data.innovations, 'designation_date'), '혁신의료기기'],
      ['임상시험 승인', data.trials.length, lastDate(data.trials, 'approval_date'), '임상시험'],
      ['평가 유예·신의료기술', NECA.reduce(function (a, k) { return a + (kinds[k] || []).length; }, 0), null, 'NECA 평가·유예']
    ];
    return h('section', { class: 'card', 'aria-labelledby': 'st-h' }, h('div', { class: 'card-head' }, h('h2', { id: 'st-h', text: '인허가 현황' }),
      h('span', { class: 'note', text: '누르면 아래 목록에서 봅니다' })),
      h('ol', { class: 'steps four compact' }, steps.map(function (s) {
        var done = s[1] > 0;
        return h('li', null, h('button', { type: 'button', class: 'step-btn', onclick: function () { onPick(s[3]); } },
          h('span', { class: 'step-dot ' + (done ? 'done' : 'todo'), text: done ? '✓' : '' }), h('b', { text: s[0] }),
          h('span', { class: 'step-state ' + (done ? 'done' : 'todo'), text: done ? s[1] + '건' : '아직' }),
          h('span', { class: 'note', text: s[2] ? '최근 ' + D.fmt(s[2]) : '' })));
      })));
  }

  // ---- 기본 정보 ----
  function infoCard(data, sc, star) {
    var c = data.company, address = c.company_address || (data.licenses[0] || {}).license_address;
    var closed = data.licenses.length && data.licenses.every(function (l) { return l.license_status !== 'active'; });
    var badges = data.licenses.map(function (l) { return D.badge(LIC[l.license_type] || '업허가', 'lic-' + l.license_type); });
    if (data.innovations.length) badges.push(D.badge('★ 혁신의료기기 지정', 'star'));
    if (closed) badges.push(D.badge('휴·폐업', 'bad'));
    return h('section', { class: 'card info-card', 'aria-labelledby': 'cname' },
      h('div', { class: 'chips tight' }, badges),
      h('div', { class: 'card-head' }, h('h1', { class: 'company-name', id: 'cname', text: c.company_name }), star ? h('span', { class: 'right' }, star) : null),
      h('dl', { class: 'info' },
        h('dt', { text: '소재지' }), h('dd', { text: address || '정보 없음' }),
        data.licenses.length ? data.licenses.map(function (l) {
          return [h('dt', { text: (LIC[l.license_type] || '업') + ' 허가' }), h('dd', { text: l.license_number + (l.license_date ? ' · ' + l.license_date : '') + (LST[l.license_status] || '') })];
        }) : [h('dt', { text: '업허가' }), h('dd', { text: '정보 없음' })],
        sc && sc.field ? [h('dt', { text: '주요 분야' }), h('dd', { text: sc.field })] : null));
  }

  // ---- 통계 + 연도별 묶음 막대 (한 칸) ----
  function statsCard(data, tl) {
    var thisYear = Number(D.today().slice(0, 4));
    var all = [].concat(data.registrations.map(function (r) { return r.approval_date; }), data.innovations.map(function (r) { return r.designation_date; }),
      data.trials.map(function (r) { return r.approval_date; })).filter(Boolean).map(function (d) { return Number(String(d).slice(0, 4)); });
    var first = Math.max(Math.min.apply(null, [thisYear - 4].concat(all)), thisYear - 9), years = [];
    for (var y = first; y <= thisYear; y++) years.push(y);
    function perYear(lst, k) { return years.map(function (yy) { return lst.filter(function (x) { return String(x[k] || '').slice(0, 4) === String(yy); }).length; }); }
    function kpi(label, n, note, cls) {
      return h('div', { class: 'kpi-cell' }, h('span', { class: 'kpi-label' }, cls ? h('i', { class: 'sw ' + cls }) : null, label),
        h('b', { class: 'kpi-num' }, D.num(n), h('small', { text: '건' })), h('span', { class: 'note', text: note || '' }));
    }
    return h('section', { class: 'card', 'aria-label': '통계' },
      h('div', { class: 'kpi-row' },
        kpi('허가 제품', data.registrations.length, lastDate(data.registrations, 'approval_date') ? '최근 ' + D.fmt(lastDate(data.registrations, 'approval_date')) : '', 's1'),
        kpi('혁신의료기기 지정', data.innovations.length, lastDate(data.innovations, 'designation_date') ? '최근 ' + D.fmt(lastDate(data.innovations, 'designation_date')) : '', 's2'),
        kpi('임상시험 승인', data.trials.length, lastDate(data.trials, 'approval_date') ? '최근 ' + D.fmt(lastDate(data.trials, 'approval_date')) : '', 's3'),
        kpi('최근 1년 소식', tl.length, '인허가·연구·뉴스')),
      D.barChart({ title: '연도별 허가·지정·임상 건수', labels: years.map(String), unit: '건', height: 200, width: 1100,
        series: [{ name: '허가', values: perYear(data.registrations, 'approval_date'), cls: 's1' },
          { name: '혁신 지정', values: perYear(data.innovations, 'designation_date'), cls: 's2' },
          { name: '임상 승인', values: perYear(data.trials, 'approval_date'), cls: 's3' }] }));
  }

  // ---- 탭 내용 ----
  function innovationCards(list) {
    if (!list.length) return D.empty('혁신의료기기 지정 정보가 없습니다.');
    return h('div', { class: 'innov-grid' }, list.map(function (r) {
      var inner = [
        h('div', { class: 'innov-img' }, r.image_path ? D.storageImg(r.image_path, (r.item_name || r.product_code || '') + ' 대표 그림') : h('span', { class: 'innov-noimg', text: '그림 없음' })),
        h('div', { class: 'innov-body' },
          h('div', { class: 'innov-meta' }, D.badge(r.designation_number || '지정', 'star'), h('span', { text: D.fmt(r.designation_date) })),
          h('b', { class: 'innov-name', text: r.item_name || r.product_code || '(품목명 없음)' }),
          r.item_name && r.product_code ? h('span', { class: 'note', text: '품목 코드 ' + r.product_code }) : null,
          r.product_summary ? h('p', { class: 'innov-sum', text: r.product_summary }) : null,
          r.source_url ? h('span', { class: 'innov-go', text: '원문 보기 ↗' }) : null)
      ];
      return r.source_url ? h('a', { class: 'innov-card', href: r.source_url, target: '_blank', rel: 'noopener noreferrer' }, inner) : h('div', { class: 'innov-card' }, inner);
    }));
  }
  function registrationTable(list) {
    if (!list.length) return D.empty('허가 정보가 없습니다.');
    var body = h('tbody');
    list.forEach(function (r) {
      var detail = h('tr', { class: 'detail', hidden: true }, h('td', { colspan: 7 }, h('dl', { class: 'info' },
        [['허가번호', r.permit_number], ['제품명', r.product_name], ['구분', STYPE[r.source_type] || r.source_type], ['허가 종류', RTYPE[r.registration_type] || r.registration_type],
          ['등급', r.device_class && r.device_class + '등급'], ['허가일', r.approval_date], ['상태', RST[r.approval_status] || r.approval_status],
          ['품목', [r.product_category_code, r.product_category_name].filter(Boolean).join(' · ')], ['사용목적', r.intended_use]]
          .filter(function (x) { return x[1]; }).map(function (x) { return [h('dt', { text: x[0] }), h('dd', { text: x[1] })]; }),
        h('dt', { text: '원문' }), h('dd', null, r.review_report_url ? h('a', { href: r.review_report_url, target: '_blank', rel: 'noopener noreferrer', text: '심사 결과 보기' }) : null, ' ',
          r.page_url ? h('a', { href: r.page_url, target: '_blank', rel: 'noopener noreferrer', text: '이머디에서 보기' }) : null))));
      var btn = h('button', { type: 'button', class: 'row-toggle', 'aria-expanded': 'false', 'aria-label': (r.product_name || '') + ' 자세히', text: '▸' });
      var tr = h('tr', { class: 'clickable', onclick: function () {
        detail.hidden = !detail.hidden; btn.setAttribute('aria-expanded', detail.hidden ? 'false' : 'true'); btn.textContent = detail.hidden ? '▸' : '▾';
        tr.classList.toggle('open', !detail.hidden);
      } }, h('td', null, btn), h('td', { class: 'wrap' }, h('b', { text: r.product_name || '(제품명 없음)' })), h('td', { class: 'nowrap', text: r.permit_number || '' }),
        h('td', { class: 'nowrap', text: r.device_class ? r.device_class + '등급' : '' }), h('td', { class: 'nowrap', text: r.approval_date || '' }),
        h('td', { class: 'nowrap', text: RTYPE[r.registration_type] || '' }), h('td', null, D.badge(RST[r.approval_status] || '정상', r.approval_status && r.approval_status !== 'active' ? 'bad' : 'ok')));
      body.append(tr, detail);
    });
    return h('div', { class: 'table-wrap' }, h('table', { class: 'grid reg-table' },
      h('thead', null, h('tr', null, ['', '제품명', '허가번호', '등급', '허가일', '종류', '상태'].map(function (x, i) { return h('th', { scope: 'col', class: i === 0 ? 'w-star' : null, text: x }); }))), body),
      h('p', { class: 'note', text: '줄을 누르면 사용목적·품목·원문 링크까지 모두 봅니다.' }));
  }
  function trialList(list) {
    if (!list.length) return D.empty('임상시험 승인 정보가 없습니다.');
    return list.map(function (t) {
      return h('div', { class: 'list-item' },
        t.source_url ? h('a', { class: 'list-title', href: t.source_url, target: '_blank', rel: 'noopener noreferrer', text: t.trial_title }) : h('b', { text: t.trial_title }),
        h('span', { class: 'list-meta', text: [D.fmt(t.approval_date), t.product_name, t.trial_purpose].filter(Boolean).join(' · ') }),
        t.sites && t.sites.length ? h('span', { class: 'list-detail', text: '실시기관: ' + t.sites.join(', ') }) : null);
    });
  }
  function more(list, render, n) {
    var box = h('div', { class: 'tab-panel' }), shown = 0;
    var btn = h('button', { type: 'button', class: 'btn small more', onclick: add });
    box.appendChild(btn);
    function add() {
      list.slice(shown, shown + n).forEach(function (x) { box.insertBefore(render(x), btn); });
      shown += n;
      if (shown >= list.length) btn.remove(); else btn.textContent = '더 보기 (' + (list.length - shown) + '건 남음)';
    }
    add();
    return list.length ? box : D.empty('없습니다.');
  }
  async function newsPanel(cid) {
    var box = h('div', null, D.loading());
    try {
      var rows = await D.rpc('dash_company_news', { p_company_id: cid });
      var kw = await D.loadNewsKeywords(rows);
      D.set(box, rows.length ? [h('p', { class: 'note', text: '수집한 뉴스 중 제목·요약에 기업 이름이 들어간 기사 (최근 1년, ' + rows.length + '건)' }),
        more(rows, function (f) {
          var el = D.feedItem(Object.assign({ category: 'market', kind: '뉴스', company_id: null, company_name: null }, f), { noDetail: false });
          if (kw[f.item_key]) el.querySelector('.list-meta').appendChild(D.keywordChips(kw[f.item_key], 3));
          return el;
        }, 20)] : D.empty('기업 이름이 들어간 뉴스가 없습니다.'));
    } catch (e) { D.set(box, D.fail(e)); }
    return box;
  }

  // ---- 화면 전체 ----
  D.renderCompany = function (box, data, opts) {
    var o = opts || {};
    var c = data.company, sc = data.score, tl = data.timeline || [], kinds = kindsOf(tl);
    var neca = tl.filter(function (f) { return NECA.indexOf(f.kind) >= 0; });
    var TABS = [
      ['전체 소식', tl.length, function () { return more(tl, function (f) { return D.feedItem(f); }, 20); }],
      ['혁신의료기기', data.innovations.length, function () { return innovationCards(data.innovations); }],
      ['허가 제품', data.registrations.length, function () { return registrationTable(data.registrations); }],
      ['임상시험', data.trials.length, function () { return trialList(data.trials); }],
      ['NECA 평가·유예', neca.length, function () { return neca.length ? neca.map(function (f) { return D.feedItem(f); }) : D.empty('NECA 평가·유예 정보가 없습니다.'); }],
      ['뉴스', null, function () { var b = h('div', null, D.loading()); newsPanel(c.company_id).then(function (x) { D.set(b, x); }); return b; }]
    ];
    var tabBody = h('div', { role: 'tabpanel', id: 'tab-body-' + c.company_id });
    var tabBar = h('div', { class: 'tabs wrap-tabs', role: 'tablist', 'aria-label': '기업 자료' });
    var tabCard = h('section', { class: 'card', 'aria-label': '기업 자료' }, tabBar, tabBody);
    function pick(i) {
      tabBar.querySelectorAll('.tab').forEach(function (b, j) { b.setAttribute('aria-selected', j === i ? 'true' : 'false'); });
      D.set(tabBody, TABS[i][2]());
    }
    function pickByName(n) { for (var i = 0; i < TABS.length; i++) if (TABS[i][0] === n) { pick(i); tabCard.scrollIntoView({ block: 'start', behavior: 'smooth' }); return; } }
    TABS.forEach(function (t, i) {
      tabBar.appendChild(h('button', { type: 'button', class: 'tab', role: 'tab', 'aria-selected': 'false', onclick: function () { pick(i); } },
        t[0], t[1] === null ? null : h('span', { class: 'badge gray', text: t[1] })));
    });
    var star = D.favButton('company', c.company_id, c.company_name, { text: true });
    if (o.mode === 'brief') {
      D.set(box, infoCard(data, sc, star), scoreCard(sc), statusCard(data, kinds, function (n) { if (o.onExpand) o.onExpand(n); }),
        innovationCards(data.innovations.slice(0, 2)),
        h('section', { class: 'card' }, h('h2', { text: '최근 90일 신호' }),
          tl.filter(function (f) { return f.item_date >= D.addDays(D.today(), -90); }).slice(0, 8).map(function (f) { return D.feedItem(f, { noDetail: true, noStar: true }); }),
          tl.some(function (f) { return f.item_date >= D.addDays(D.today(), -90); }) ? null : D.empty('최근 90일 신호가 없습니다.')));
      return;
    }
    D.set(box,
      h('div', { class: 'detail-row' }, infoCard(data, sc, star), h('div', { class: 'detail-col' }, scoreCard(sc), statusCard(data, kinds, pickByName))),
      statsCard(data, tl), tabCard);
    pick(o.tab ? Math.max(0, TABS.map(function (t) { return t[0]; }).indexOf(o.tab)) : 0);
  };

  /* 기업 레이더: 오른쪽 패널. [크게 보기] = 전체 화면으로 바꿔 상세 전체를 보여 줌 */
  var drawer = null;
  D.openCompanyDrawer = async function (cid) {
    if (drawer) drawer.close();
    var body = h('div', { class: 'drawer-body' }, D.loading());
    var full = false, data = null;
    var sizeBtn = h('button', { type: 'button', class: 'btn small', onclick: function () { setFull(!full); } });
    var panel = h('aside', { class: 'drawer', role: 'dialog', 'aria-modal': 'true', 'aria-label': '기업 정보' },
      h('div', { class: 'drawer-head' }, h('b', { class: 'drawer-title', text: '기업 정보' }),
        h('span', { class: 'chips right' }, sizeBtn,
          h('a', { class: 'btn small', href: D.companyHref(cid), text: '기업 정보 화면으로' }),
          h('button', { type: 'button', class: 'btn small', 'aria-label': '닫기', text: '✕', onclick: close }))),
      body);
    var back = h('div', { class: 'drawer-back', onclick: close });
    function onKey(e) { if (e.key === 'Escape') close(); }
    function close() { panel.remove(); back.remove(); document.removeEventListener('keydown', onKey); document.body.classList.remove('drawer-open'); drawer = null; }
    function setFull(v, tab) {
      full = v;
      panel.classList.toggle('full', full);
      D.set(sizeBtn, full ? '⤡ 작게 보기' : '⤢ 크게 보기');
      if (data) D.renderCompany(body, data, { mode: full ? 'full' : 'brief', tab: tab, onExpand: function (n) { setFull(true, n); } });
      body.scrollTop = 0;
    }
    drawer = { close: close };
    document.body.append(back, panel);
    document.body.classList.add('drawer-open');
    document.addEventListener('keydown', onKey);
    setFull(false);
    sizeBtn.focus();
    try { data = await D.rpc('dash_company', { p_company_id: cid }); } catch (e) { D.set(body, D.fail(e)); return; }
    if (!data) { D.set(body, D.empty('기업을 찾을 수 없습니다.')); return; }
    panel.querySelector('.drawer-title').textContent = data.company.company_name;
    setFull(false);
  };
})();
