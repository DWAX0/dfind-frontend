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

  /* ---- 조기 발굴 점수: 평가 기준 · 기업별 항목 점수와 근거 (기업 레이더 · 기업 정보에서 같이 씀) ----
     evidence: { pipeline:{innovation,neca,registrations}, stage:{age}, signal:{trial,innovation,registration}, wear:{...}, details:{…} } */
  D.SCORE_CRIT = [
    { key: 's_pipeline', ev: 'pipeline', name: '파이프라인', max: 40, cls: 'c1', bar: 'b1', desc: '규제 단계를 얼마나 밟았나',
      rules: [{ k: 'innovation', label: '혁신의료기기 지정', pts: 20, det: 'innovation' }, { k: 'neca', label: '신의료기술평가·평가 유예', pts: 12, det: 'neca' },
        { k: 'registrations', label: '허가 (1건당 4점, 최대 8점)', pts: 8, det: 'registration' }] },
    { key: 's_stage', ev: 'stage', name: '기업 단계', max: 20, cls: 'c2', bar: 'b2', desc: '아직 크지 않은 성장 초기 기업인가',
      rules: [{ k: 'age', label: '업허가 후 3~10년', pts: 5, det: 'license' }, { k: 'invest', label: '투자 단계 (시리즈 A~B)', pts: 10, todo: true },
        { k: 'ipo', label: '상장 전 (DART 비상장 법인)', pts: 5, det: 'dart_cls' }] },
    { key: 's_signal', ev: 'signal', name: '선행 신호', max: 25, cls: 'c3', bar: 'b3', desc: '최근 90일에 움직임이 있었나',
      rules: [{ k: 'trial', label: '최근 90일 임상시험 승인', pts: 8, det: 'trial', recent: true }, { k: 'innovation', label: '최근 90일 혁신의료기기 지정', pts: 6, det: 'innovation', recent: true },
        { k: 'registration', label: '최근 90일 허가', pts: 5, det: 'registration', recent: true },
        { k: 'news', label: '최근 90일 투자 소식 (DART 유상증자·전환사채)', pts: 6, det: 'funding', recent: true }] },
    { key: 's_wear', ev: 'wear', name: '웨어러블 적합', max: 15, cls: 'c4', bar: 'b4', desc: '우리 관심 분야(착용형·생체신호)와 맞나',
      rules: [{ k: 'wearable', label: '제품·사용 목적에 착용형 표현', pts: 8, det: 'wear_terms' }, { k: 'biosignal', label: '생체신호 측정', pts: 4, det: 'bio_terms' },
        { k: 'keyword', label: '관심 키워드 일치', pts: 3 }] }
  ];
  function cleanName(n) { return String(n || '').split('·').pop().split(',')[0].trim(); }
  function ymd(d) { return d ? String(d).slice(0, 10) : ''; }
  function detLines(r, rule, asOf) {
    var d = (r.evidence && r.evidence.details) || {};
    if (rule.todo) return ['수집 준비 중 (투자 정보 연결 후 반영)'];
    if (rule.det === 'license') {
      if (!d.license_first) return ['업허가 정보 없음'];
      var y = Math.floor((new Date(asOf || D.today()) - new Date(d.license_first)) / (365.25 * 864e5));
      return ['업허가 ' + ymd(d.license_first) + ' · 업력 ' + y + '년'];
    }
    if (rule.det === 'dart_cls') {
      var cl = { Y: '유가증권 상장', K: '코스닥 상장', N: '코넥스 상장', E: '비상장 (기타법인)' }[d.dart_cls];
      return [cl ? 'DART: ' + cl : 'DART 에서 찾지 못함 (공시 대상이 아니거나 아직 연결 전)'];
    }
        if (rule.det === 'wear_terms' || rule.det === 'bio_terms') return (d[rule.det] || []).length ? ['찾은 말: ' + d[rule.det].join(', ')] : [];
    var lst = d[rule.det] || [];
    if (rule.recent) { var lim = D.addDays(asOf || D.today(), -90); lst = lst.filter(function (x) { return ymd(x.date) > lim; }); }
    return lst.map(function (x) { return cleanName(x.name) + (x.kind ? ' · ' + x.kind : '') + (x.date ? ' (' + ymd(x.date) + ')' : ''); });
  }
  function rulePts(r, c, rule) {
    var t = r.evidence && r.evidence[c.ev] && r.evidence[c.ev][rule.k];
    if (!t) return 0;
    var m = /\+(\d+)\s*$/.exec(t); return m ? Number(m[1]) : rule.pts;
  }
  /* 4가지 항목 카드: 항목 점수 + 기준마다 ✓/— · 점수 · 근거 세부 */
  D.scoreBreakdown = function (r, asOf) {
    return h('div', { class: 'sb-grid' }, D.SCORE_CRIT.map(function (c) {
      var v = r[c.key] || 0;
      return h('section', { class: 'sb-card ' + c.cls },
        h('div', { class: 'sb-head' }, h('b', { text: c.name }), h('span', { class: 'sb-score' }, h('b', { text: v }), ' / ' + c.max)),
        h('div', { class: 'sb-bar' }, D.width(h('i', { class: c.bar }), Math.round(v / c.max * 100))),
        h('p', { class: 'note sb-desc', text: c.desc }),
        h('ul', { class: 'sb-rules' }, c.rules.map(function (rule) {
          var p = rulePts(r, c, rule), ok = p > 0, lines = detLines(r, rule, asOf);
          return h('li', { class: ok ? 'ok' : rule.todo ? 'todo' : 'no' },
            h('span', { class: 'sb-mark', 'aria-label': ok ? '충족' : rule.todo ? '준비 중' : '해당 없음', text: ok ? '✓' : rule.todo ? '…' : '–' }),
            h('span', { class: 'sb-rule' }, h('span', { class: 'sb-label', text: rule.label }),
              lines.length ? h('span', { class: 'sb-det' }, lines.slice(0, 3).map(function (x) { return h('span', { text: x }); })) : null),
            h('span', { class: 'sb-pts', text: ok ? '+' + p : '0' }, h('small', { text: ' / ' + rule.pts })));
        })));
    }));
  };
  /* 기업별 핵심 요약 한두 줄 (근거 세부에서) */
  D.companySummary = function (r, asOf) {
    var d = (r.evidence && r.evidence.details) || {}, out = [];
    var inv = d.innovation || [], reg = d.registration || [], tr = d.trial || [], ne = d.neca || [];
    if (inv.length) out.push('혁신의료기기 「' + cleanName(inv[0].name) + '」' + (inv.length > 1 ? ' 등 ' + inv.length + '건' : '') + ' 지정');
    if (ne.length) out.push('NECA ' + (ne[0].kind || '평가') + ' 「' + cleanName(ne[0].name) + '」');
    if (reg.length) out.push('허가 「' + cleanName(reg[0].name) + '」' + (reg[0].date ? '(' + ymd(reg[0].date).slice(2).replace(/-/g, '.') + ')' : ''));
    var lim = D.addDays(asOf || D.today(), -90);
    if (tr.some(function (x) { return ymd(x.date) > lim; })) out.push('최근 90일 임상시험 승인');
    var terms = (d.wear_terms || []).concat(d.bio_terms || []);
    if (terms.length) out.push(terms.slice(0, 3).join('·') + ' 관련');
    return out.join(' · ');
  };
  /* 평가 기준 팝업: 4가지 기준 설명 + 이 기업의 기준별 점수와 현황 */
  D.openScoreDialog = function (sc, name) {
    var dlg = h('dialog', { class: 'dialog wide', 'aria-labelledby': 'sd-h' },
      h('div', { class: 'card-head' }, h('h2', { id: 'sd-h', text: '조기 발굴 점수 평가 기준' + (name ? ' — ' + name : '') }),
        h('button', { type: 'button', class: 'btn small right', text: '닫기', onclick: function () { dlg.close(); } })),
      h('div', { class: 'dialog-body' },
        sc ? h('div', { class: 'sd-total' }, h('span', { class: 'score-big', text: sc.total }), h('span', { class: 'score-of', text: '/ 100' }),
          sc.rank ? h('span', { class: 'score-rank', text: sc.rank + '위' }) : null,
          h('span', { class: 'note', text: '4가지 항목 합계 · 매일 다시 계산 · 임시 배점 v0 (확정 전)' })) : null,
        sc ? D.scoreBreakdown(sc) : D.empty('이 기업은 점수를 계산할 신호가 아직 없습니다.'),
        h('p', { class: 'note', text: '✓ = 이 기업이 충족한 기준 · – = 해당 없음 · … = 자료 수집 준비 중인 기준 (아직 점수에 넣지 않음)' })));
    dlg.addEventListener('close', function () { dlg.remove(); });
    document.body.appendChild(dlg);
    dlg.showModal();
  };

  function lastDate(lst, k) { return lst && lst.length ? lst.map(function (x) { return x[k]; }).filter(Boolean).sort().pop() : null; }
  function kindsOf(tl) { var k = {}; tl.forEach(function (f) { (k[f.kind] = k[f.kind] || []).push(f); }); return k; }

  // ---- 조기 발굴 점수 (기획안처럼 단순하게: 큰 숫자 + 4색 쌓은 막대 + 항목별 점수) ----
  function scoreCard(sc, name) {
    var card = h('section', { class: 'card score-simple', 'aria-label': '조기 발굴 점수' });
    if (!sc) return D.set(card, h('div', { class: 'card-head' }, h('h2', { text: '조기 발굴 점수' })), D.empty('점수를 계산할 신호가 없습니다.'));
    var stack = h('div', { class: 'score-stack', role: 'img', 'aria-label': CRIT.map(function (c) { return c[0] + ' ' + sc[c[1]]; }).join(', ') });
    CRIT.forEach(function (c) {
      var ev = sc.evidence && sc.evidence[c[3]] ? Object.values(sc.evidence[c[3]]).join(' · ') : '';
      if (sc[c[1]] > 0) stack.appendChild(D.width(h('i', { class: c[4], title: c[0] + ' ' + sc[c[1]] + '점' + (ev ? ' — ' + ev : '') }), sc[c[1]]));
    });
    return D.set(card,
      h('div', { class: 'card-head' }, h('h2', { text: '조기 발굴 점수' }),
        h('button', { type: 'button', class: 'btn small right', text: '평가 기준', onclick: function () { D.openScoreDialog(sc, name); } })),
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
  var CLS = { Y: '유가증권 상장', K: '코스닥 상장', N: '코넥스 상장', E: '비상장 (기타법인)' };
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
        sc && sc.field ? [h('dt', { text: '주요 분야' }), h('dd', { text: sc.field })] : null,
        dartRows(data.dart)));
  }
  /* DART 기업 정보: 항목마다 한 줄, 없으면 '-' (DART 에 연결되지 않은 기업도 같은 칸) */
  function dartRows(d) {
    d = d || {};
    function v(x) { return x == null || x === '' ? '-' : String(x); }
    function link(u, t) { return u ? h('a', { href: /^https?:/.test(u) ? u : 'https://' + u, target: '_blank', rel: 'noopener noreferrer', text: t + ' ↗' }) : '-'; }
    var biz = d.bizr_no && /^\d{10}$/.test(d.bizr_no) ? d.bizr_no.slice(0, 3) + '-' + d.bizr_no.slice(3, 5) + '-' + d.bizr_no.slice(5) : d.bizr_no;
    var rows = [
      ['상장 구분', CLS[d.corp_cls] || v(d.corp_cls)],
      ['종목코드', v(d.stock_code)],
      ['대표자', v(d.ceo_nm)],
      ['설립일', v(d.est_dt)],
      ['사업자번호', v(biz)],
      ['업종 코드', v(d.induty_code)],
      ['결산월', d.acc_mt ? Number(d.acc_mt) + '월' : '-'],
      ['홈페이지', link(d.hm_url, '홈페이지')],
      ['IR', link(d.ir_url, 'IR 페이지')],
      ['DART 공시', d.corp_code ? (d.disclosures ? D.num(d.disclosures) + '건' + (d.last_disclosure ? ' · 최근 ' + d.last_disclosure : '') : '0건') : '-']
    ];
    return [h('dt', { class: 'dart-h' }, 'DART'), h('dd', { class: 'dart-h' }, d.corp_code
        ? h('span', { class: 'note', text: '전자공시 기업 정보' + (d.corp_name ? ' · ' + d.corp_name : '') })
        : h('span', { class: 'note', text: 'DART 에 연결되지 않은 기업 (비상장·공시 대상 아님 등)' })),
      rows.map(function (r) { return [h('dt', { class: 'dart-sub', text: r[0] }), h('dd', { class: 'dart-sub' }, r[1])]; })];
  }

  // ---- 통계 + 그래프 (연도별 허가·지정·임상 막대 | 월별 소식 꺾은선, 기간 고르기) ----
  function monthsBetween(from, to) {
    var out = [], y = Number(from.slice(0, 4)), m = Number(from.slice(5, 7)), ey = Number(to.slice(0, 4)), em = Number(to.slice(5, 7));
    while (y < ey || (y === ey && m <= em)) { out.push(y + '-' + String(m).padStart(2, '0')); m++; if (m > 12) { m = 1; y++; } }
    return out;
  }
  function statsCard(data, st, onPick, periodBar) {
    var thisYear = Number(D.today().slice(0, 4));
    var dates = [].concat(data.registrations.map(function (r) { return r.approval_date; }), data.innovations.map(function (r) { return r.designation_date; }),
      data.trials.map(function (r) { return r.approval_date; })).filter(Boolean).map(function (d) { return Number(String(d).slice(0, 4)); });
    var first = Math.max(Math.min.apply(null, [thisYear - 4].concat(dates)), thisYear - 9), years = [];
    for (var y = first; y <= thisYear; y++) years.push(y);
    function perYear(lst, k) { return years.map(function (yy) { return lst.filter(function (x) { return String(x[k] || '').slice(0, 4) === String(yy); }).length; }); }
    // 기간이 길면 분기·연 단위로 묶어 그림 (3년 넘으면 분기, 10년 넘으면 연)
    var months = monthsBetween(st.from, st.to);
    var unit = months.length > 120 ? 'year' : months.length > 36 ? 'q' : 'm';
    function bucket(ym) { if (unit === 'year') return ym.slice(0, 4); if (unit === 'q') return ym.slice(0, 4) + 'Q' + (Math.floor((Number(ym.slice(5, 7)) - 1) / 3) + 1); return ym; }
    var buckets = []; months.forEach(function (mm) { var b = bucket(mm); if (buckets[buckets.length - 1] !== b) buckets.push(b); });
    function perMonth(lst) { var c = {}; lst.forEach(function (x) { var k = bucket(String(x.item_date || '').slice(0, 7)); c[k] = (c[k] || 0) + 1; }); return buckets.map(function (b) { return c[b] || 0; }); }
    function bLabel(b) { return unit === 'm' ? b.slice(2, 4) + '.' + b.slice(5) : unit === 'q' ? b.slice(2, 4) + '.' + b.slice(4) : b; }
    var nonNews = st.all.filter(function (f) { return !/^news:/.test(f.item_key); });
    function kpi(label, n, note, cls, tab) {
      var inner = [h('span', { class: 'kpi-label' }, cls ? h('i', { class: 'sw ' + cls }) : null, label),
        h('b', { class: 'kpi-num' }, D.num(n), h('small', { text: '건' })), h('span', { class: 'note', text: note || '' })];
      return tab ? h('button', { type: 'button', class: 'kpi-cell clickable', onclick: function () { onPick(tab); } }, inner) : h('div', { class: 'kpi-cell' }, inner);
    }
    function recent(lst, k) { var l = lastDate(lst, k); return l ? '최근 ' + D.fmt(l) : ''; }
    return h('section', { class: 'card co-stats', 'aria-label': '통계' },
      h('div', { class: 'stats-head' }, h('h2', { text: '통계' }), h('span', { class: 'note', text: '소식 기간' }), periodBar),
      h('div', { class: 'kpi-row' },
        kpi('허가 제품', data.registrations.length, recent(data.registrations, 'approval_date'), 's1', '허가 제품'),
        kpi('혁신의료기기 지정', data.innovations.length, recent(data.innovations, 'designation_date'), 's2', '혁신의료기기'),
        kpi('임상시험 승인', data.trials.length, recent(data.trials, 'approval_date'), 's3', '임상시험'),
        kpi(st.label + ' 소식', st.all.length, '인허가·연구 ' + nonNews.length + ' · 뉴스 ' + st.news.length, null, '모든 소식')),
      h('div', { class: 'chart-pair' },
        D.barChart({ title: '연도별 허가·지정·임상 건수 (전체 기간)', labels: years.map(String), unit: '건', height: 230, width: 600,
          series: [{ name: '허가', values: perYear(data.registrations, 'approval_date'), cls: 's1' },
            { name: '혁신 지정', values: perYear(data.innovations, 'designation_date'), cls: 's2' },
            { name: '임상 승인', values: perYear(data.trials, 'approval_date'), cls: 's3' }] }),
        h('div', null,
          D.lineChart({ title: (unit === 'm' ? '월별' : unit === 'q' ? '분기별' : '연도별') + ' 소식 건수 (' + st.label + ')', labels: buckets.map(bLabel), unit: '건', height: 230, width: 600,
            series: [{ name: '인허가·연구', values: perMonth(nonNews), cls: 's4' }, { name: '뉴스', values: perMonth(st.news), cls: 's5' }] }))));
  }
  /* 최근 90일 신호 (기업 레이더 오른쪽 패널과 같은 내용) */
  function recentCard(all, onAll) {
    var lim = D.addDays(D.today(), -90);
    var r90 = all.filter(function (f) { return f.item_date >= lim; });
    return h('section', { class: 'card recent-card' }, h('div', { class: 'card-head' }, h('h2', { text: '최근 90일 신호' }), h('span', { class: 'badge gray', text: r90.length }),
      onAll ? h('button', { type: 'button', class: 'btn small right', text: '모든 소식 보기', onclick: onAll }) : null),
      h('div', { class: 'recent-list' }, r90.slice(0, 12).map(function (f) { return D.feedItem(f, { noDetail: true, noStar: true }); }),
        r90.length ? null : D.empty('최근 90일 신호가 없습니다.')),
      r90.length > 12 ? h('p', { class: 'note', text: '최근 12건만 보입니다. 나머지는 아래 「모든 소식」에서 봅니다.' }) : null);
  }

  // ---- 탭 내용 ----
  function innovationCards(list) {
    if (!list.length) return D.empty('혁신의료기기 지정 정보가 없습니다.');
    return h('div', { class: 'innov-grid' }, list.map(function (r) {
      var inner = [
        h('div', { class: 'innov-img' }, r.image_path ? D.storageImg(r.image_path, (r.item_name || r.product_code || '') + ' 대표 그림') : h('span', { class: 'innov-noimg', text: '그림 준비 중' })),
        h('div', { class: 'innov-body' },
          h('div', { class: 'innov-meta' }, D.badge(r.designation_number || '지정', 'star'), h('span', { text: r.designation_date || '' }),
            D.isNew(r.collected_at, 'emedi') ? D.badge('NEW', 'new') : null),
          h('b', { class: 'innov-name', text: r.item_name || r.product_code || '(품목명 없음)' }),
          r.item_name && r.product_code ? h('span', { class: 'note', text: '품목 코드 ' + r.product_code }) : null,
          r.product_summary ? h('p', { class: 'innov-sum', text: r.product_summary }) : null,
          r.source_url ? h('span', { class: 'innov-go', text: '원문 보기 ↗' }) : null)
      ];
      return r.source_url ? h('a', { class: 'innov-card', href: r.source_url, target: '_blank', rel: 'noopener noreferrer' }, inner) : h('div', { class: 'innov-card' }, inner);
    }));
  }
  /* 오른쪽 패널: 여러 건이면 한 장씩 넘겨 보기 */
  function innovationSlider(list) {
    if (list.length <= 1) return innovationCards(list);
    var track = h('div', { class: 'slider-track', tabindex: '0', 'aria-label': '혁신의료기기 ' + list.length + '건, 좌우로 넘겨 보기' },
      list.map(function (r) { return h('div', { class: 'slide' }, innovationCards([r]).firstChild); }));
    var count = h('span', { class: 'slider-count', 'aria-live': 'polite', text: '1 / ' + list.length });
    var dots = h('span', { class: 'slider-dots' }, list.map(function (r, i) {
      return h('button', { type: 'button', class: 'dot', 'aria-label': (i + 1) + '번째', onclick: function () { go(i); } });
    }));
    function at() { return Math.round(track.scrollLeft / Math.max(track.clientWidth, 1)); }
    function go(i) { i = Math.max(0, Math.min(list.length - 1, i)); track.scrollTo({ left: i * track.clientWidth, behavior: 'smooth' }); }
    function mark() {
      var i = at(); count.textContent = (i + 1) + ' / ' + list.length;
      dots.querySelectorAll('.dot').forEach(function (d, j) { d.setAttribute('aria-current', j === i ? 'true' : 'false'); });
    }
    track.addEventListener('scroll', function () { clearTimeout(track._t); track._t = setTimeout(mark, 60); });
    track.addEventListener('keydown', function (e) { if (e.key === 'ArrowRight') { e.preventDefault(); go(at() + 1); } if (e.key === 'ArrowLeft') { e.preventDefault(); go(at() - 1); } });
    var box = h('section', { class: 'card innov-slider', 'aria-label': '혁신의료기기 지정' },
      h('div', { class: 'card-head' }, h('h2', { text: '혁신의료기기 지정' }),
        h('span', { class: 'right chips nowrap' }, count,
          h('button', { type: 'button', class: 'icon-btn', 'aria-label': '이전', onclick: function () { go(at() - 1); } }, D.svg('M15 5l-7 7 7 7')),
          h('button', { type: 'button', class: 'icon-btn', 'aria-label': '다음', onclick: function () { go(at() + 1); } }, D.svg('M9 5l7 7-7 7')))),
      track, dots);
    setTimeout(mark, 0);
    return box;
  }
  function reviewBtn(r, label) {
    if (!r.review_post_id || !D.openReview) return null;
    return h('button', { type: 'button', class: 'btn small', text: label, onclick: function (e) { e.stopPropagation(); D.openReview(r); } });
  }
  function registrationTable(list) {
    if (!list.length) return D.empty('허가 정보가 없습니다.');
    var body = h('tbody');
    list.forEach(function (r) {
      var detail = h('tr', { class: 'detail', hidden: true }, h('td', { colspan: 8 }, h('dl', { class: 'info' },
        [['허가번호', r.permit_number], ['제품명', r.product_name], ['구분', STYPE[r.source_type] || r.source_type], ['허가 종류', RTYPE[r.registration_type] || r.registration_type],
          ['등급', r.device_class && r.device_class + '등급'], ['허가일', r.approval_date], ['상태', RST[r.approval_status] || r.approval_status],
          ['품목', [r.product_category_code, r.product_category_name].filter(Boolean).join(' · ')], ['사용목적', r.intended_use]]
          .filter(function (x) { return x[1]; }).map(function (x) { return [h('dt', { text: x[0] }), h('dd', { text: x[1] })]; }),
        h('dt', { text: '원문' }), h('dd', null, reviewBtn(r, '심사검토 결과 원문·요약'), ' ',
          !r.review_post_id && r.review_report_url ? h('a', { href: r.review_report_url, target: '_blank', rel: 'noopener noreferrer', text: '심사 결과 보기 ↗' }) : null, ' ',
          r.page_url ? h('a', { href: r.page_url, target: '_blank', rel: 'noopener noreferrer', text: '이머디에서 보기 ↗' }) : null,
          !r.review_post_id && !r.review_report_url && !r.page_url ? '-' : null))));
      var btn = h('button', { type: 'button', class: 'row-toggle', 'aria-expanded': 'false', 'aria-label': (r.product_name || '') + ' 자세히', text: '▸' });
      var tr = h('tr', { class: 'clickable', onclick: function () {
        detail.hidden = !detail.hidden; btn.setAttribute('aria-expanded', detail.hidden ? 'false' : 'true'); btn.textContent = detail.hidden ? '▸' : '▾';
        tr.classList.toggle('open', !detail.hidden);
      } }, h('td', null, btn), h('td', { class: 'wrap' }, h('b', { text: r.product_name || '(제품명 없음)' }), D.isNew(r.collected_at, 'emedi') ? D.badge('NEW', 'new') : null), h('td', { class: 'nowrap', text: r.permit_number || '' }),
        h('td', { class: 'nowrap', text: r.device_class ? r.device_class + '등급' : '' }), h('td', { class: 'nowrap', text: r.approval_date || '' }),
        h('td', { class: 'nowrap', text: RTYPE[r.registration_type] || '' }), h('td', null, D.badge(RST[r.approval_status] || '정상', r.approval_status && r.approval_status !== 'active' ? 'bad' : 'ok')),
        h('td', { class: 'nowrap' }, reviewBtn(r, '원문·요약') || h('span', { class: 'note', text: '-' })));
      body.append(tr, detail);
    });
    return h('div', { class: 'table-wrap' }, h('table', { class: 'grid reg-table' },
      h('thead', null, h('tr', null, ['', '제품명', '허가번호', '등급', '허가일', '종류', '상태', '상세'].map(function (x, i) { return h('th', { scope: 'col', class: i === 0 ? 'w-star' : null, text: x }); }))), body),
      h('p', { class: 'note', text: '줄을 누르면 사용목적·품목·원문 링크까지 모두 봅니다. 「원문·요약」 = 심사검토 결과 공개 문서의 요약·미리보기·내려받기 (디지털의료기기 정보방에 공개된 제품만).' }));
  }
  function trialList(list) {
    if (!list.length) return D.empty('임상시험 승인 정보가 없습니다.');
    return list.map(function (t) {
      return h('div', { class: 'list-item' },
        h('span', { class: 'chips tight' }, t.source_url ? h('a', { class: 'list-title', href: t.source_url, target: '_blank', rel: 'noopener noreferrer', text: t.trial_title }) : h('b', { text: t.trial_title }),
          D.isNew(t.collected_at, 'emedi') ? D.badge('NEW', 'new') : null),
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
  function newsTotal(groups) { return groups.reduce(function (n, g) { return n + 1 + g.dups.length; }, 0); }
  /* 뉴스: 키워드 · 언론사 · 제목 · 날짜(yyyy-mm-dd) 한 줄씩, 누르면 원문으로 바로. 같은 기사는 '외 N건' */
  function newsList(groups) {
    if (!groups.length) return D.empty('기업 이름이 들어간 뉴스가 없습니다.');
    var cells = {}, rows = groups.map(function (g) { return g.f; });
    var list = h('ul', { class: 'news-mini' }, groups.map(function (g) {
      var f = g.f;
      var kw = cells[f.item_key] = h('span', { class: 'nm-kw' }, h('span', { class: 'note', text: '…' }));
      var go = f.url ? { href: f.url, target: '_blank', rel: 'noopener noreferrer' } : { href: D.itemHref(f.item_key) };
      return h('li', { class: D.isNewItem(f) ? 'is-new' : null }, kw,
        h('span', { class: 'nm-pub', text: f.source_label || '' }),
        h('a', Object.assign({ class: 'nm-title', title: D.clean(f.title) }, go), D.clean(f.title) || '(제목 없음)'),
        D.isNewItem(f) ? D.badge('NEW', 'new') : null,
        h('span', { class: 'nm-date', text: f.item_date || '' }),
        g.dups.length ? h('span', { class: 'nm-dups' }, D.dupToggle(g.dups)) : null);
    }));
    D.loadNewsKeywords(rows).then(function (kw) {
      rows.forEach(function (f) {
        var k = (kw[f.item_key] || [])[0];
        D.set(cells[f.item_key], k ? h('span', { class: 'kw-pill', title: (kw[f.item_key] || []).map(function (x) { return x.keyword; }).join(', '), text: k.keyword }) : h('span', { class: 'note', text: '—' }));
      });
    }, function () { rows.forEach(function (f) { D.set(cells[f.item_key], h('span', { class: 'note', text: '—' })); }); });
    return h('div', null, h('p', { class: 'note', text: '수집한 뉴스 중 제목·요약에 기업 이름이 들어간 기사 (최근 1년, ' + rows.length + '건' + (newsTotal(groups) > rows.length ? ', 같은 기사 묶기 전 ' + newsTotal(groups) + '건' : '') + ') · 제목을 누르면 언론사 원문이 열립니다' }), list);
  }

  // ---- 화면 전체 ----
  var PERIODS = [[12, '최근 12개월'], [24, '최근 2년'], [36, '최근 3년'], [0, '전체']];
  function groupAll(tl, newsRaw) {
    var newsRows = (newsRaw || []).map(function (n) { return Object.assign({ category: 'market', company_id: null, company_name: null }, n, { kind: n.kind || '경쟁사·파트너사' }); });
    var newsGroups = D.groupSame(newsRows, true);   // 같은 기사는 1건, 나머지 '외 N건'
    var allGroups = tl.map(function (f) { return { f: f, dups: [] }; }).concat(newsGroups)
      .sort(function (a, b) { return String(b.f.item_date || '').localeCompare(String(a.f.item_date || '')); });
    return { tl: tl, newsGroups: newsGroups, news: newsGroups.map(function (g) { return g.f; }), allGroups: allGroups,
      all: allGroups.map(function (g) { return g.f; }), neca: tl.filter(function (f) { return NECA.indexOf(f.kind) >= 0; }) };
  }
  D.renderCompany = function (box, data, opts) {
    var o = opts || {};
    var c = data.company, sc = data.score, kinds = kindsOf(data.timeline || []);
    var base = groupAll(data.timeline || [], data.news);           // 처음 불러온 최근 1년 (최근 90일 신호에 씀)
    var st = Object.assign(groupAll(data.timeline || [], data.news), { from: D.addDays(D.today(), -365), to: D.today(), label: '최근 12개월', months: 12 });
    function anyNew(lst) { return lst.some(function (r) { return D.isNew(r.collected_at, 'emedi'); }); }
    var TABS = [
      ['모든 소식', function () { return null; }, function () { return st.all.some(D.isNewItem); }, function () {
        return [h('p', { class: 'note tab-help', text: '이 기업과 관련된 인허가·임상·NECA·뉴스 등 모든 출처의 소식을 날짜순으로 모아 봅니다 (' + st.label + ', ' + D.fmt(st.from) + ' ~ ' + D.fmt(st.to) + ').' }),
          more(st.allGroups, function (g) { return D.listEntry(g, { files: {}, q: '' }); }, 20)]; }],
      ['혁신의료기기', function () { return data.innovations.length; }, function () { return anyNew(data.innovations); }, function () { return innovationCards(data.innovations); }],
      ['허가 제품', function () { return data.registrations.length; }, function () { return anyNew(data.registrations); }, function () { return registrationTable(data.registrations); }],
      ['임상시험', function () { return data.trials.length; }, function () { return anyNew(data.trials); }, function () { return trialList(data.trials); }],
      ['NECA 평가·유예', function () { return st.neca.length; }, function () { return st.neca.some(D.isNewItem); }, function () { return st.neca.length ? st.neca.map(function (f) { return D.feedItem(f); }) : D.empty('이 기간에 NECA 평가·유예 정보가 없습니다.'); }],
      ['뉴스', function () { return st.news.length; }, function () { return st.news.some(D.isNewItem); }, function () { return newsList(st.newsGroups); }]
    ];
    var tabBody = h('div', { role: 'tabpanel', id: 'tab-body-' + c.company_id });
    var tabBar = h('div', { class: 'tabs wrap-tabs', role: 'tablist', 'aria-label': '기업 자료' });
    var tabCard = h('section', { class: 'card co-tabcard', 'aria-label': '기업 자료' }, tabBar, tabBody);
    var cur = 0;
    function drawTabs() {
      D.set(tabBar, TABS.map(function (t, i) {
        return h('button', { type: 'button', class: 'tab', role: 'tab', 'aria-selected': i === cur ? 'true' : 'false', onclick: function () { pick(i); } },
          t[0], t[1]() == null ? null : h('span', { class: 'badge gray', text: t[1]() }), t[2]() ? D.newDot(t[0] + '에 새로 들어온 정보가 있습니다') : null);
      }));
    }
    function pick(i) { cur = i; drawTabs(); D.set(tabBody, TABS[i][3]()); }
    function pickByName(n) {
      if (n === '전체 소식') n = '모든 소식';
      for (var i = 0; i < TABS.length; i++) if (TABS[i][0] === n) { pick(i); tabCard.scrollIntoView({ block: 'start', behavior: 'smooth' }); return; }
    }
    var star = D.favButton('company', c.company_id, c.company_name, { text: true });
    if (o.mode === 'brief') {
      D.set(box, infoCard(data, sc, star), scoreCard(sc, c.company_name), statusCard(data, kinds, function (n) { if (o.onExpand) o.onExpand(n); }),
        data.innovations.length ? innovationSlider(data.innovations) : null,
        recentCard(base.all, function () { if (o.onExpand) o.onExpand('모든 소식'); }));
      return;
    }
    // 기간 고르기 (기본 최근 12개월, 12개월 이전도 볼 수 있음)
    var fromIn = h('input', { class: 'input small', type: 'date', value: st.from, max: D.today(), 'aria-label': '시작일' });
    var toIn = h('input', { class: 'input small', type: 'date', value: st.to, max: D.today(), 'aria-label': '끝일' });
    var pmsg = h('span', { class: 'note', role: 'status' });
    var periodBar = h('div', { class: 'period-bar' },
      h('span', { class: 'chips', role: 'group', 'aria-label': '기간' }, PERIODS.map(function (p) {
        return h('button', { type: 'button', class: 'chip small', 'data-m': p[0], 'aria-pressed': p[0] === 12 ? 'true' : 'false', text: p[1],
          onclick: function () { setPeriod(p[0] ? D.addDays(D.today(), -Math.round(p[0] * 30.44)) : '2000-01-01', D.today(), p[1], p[0]); } });
      })),
      h('span', { class: 'chips nowrap' }, fromIn, '~', toIn,
        h('button', { type: 'button', class: 'btn small', text: '기간 적용', onclick: function () {
          if (!fromIn.value || !toIn.value || fromIn.value > toIn.value) { pmsg.textContent = '시작일이 끝일보다 앞이어야 합니다.'; return; }
          setPeriod(fromIn.value, toIn.value, D.fmt(fromIn.value) + '~' + D.fmt(toIn.value), -1);
        } })), pmsg);
    var statsBox = h('div', { class: 'stats-box' });
    async function setPeriod(from, to, label, m) {
      periodBar.querySelectorAll('[data-m]').forEach(function (b) { b.setAttribute('aria-pressed', Number(b.getAttribute('data-m')) === m ? 'true' : 'false'); });
      pmsg.textContent = '불러오는 중…';
      try {
        var r = await D.rpc('dash_company_activity', { p_company_id: c.company_id, p_from: from, p_to: to });
        var g = groupAll(r.timeline || [], r.news);
        Object.assign(st, g, { from: r.from || from, to: r.to || to, label: label, months: m });
        if (m === 0 && st.all.length) st.from = st.all.map(function (f) { return f.item_date; }).filter(Boolean).sort()[0] || st.from;
        fromIn.value = st.from; toIn.value = st.to;
        pmsg.textContent = '';
        drawStats(); pick(cur);
      } catch (e) { pmsg.textContent = '불러오지 못했습니다: ' + ((e && e.message) || e); }
    }
    function drawStats() { D.set(statsBox, statsCard(data, st, pickByName, periodBar)); }
    D.set(box,
      h('div', { class: 'detail-row' }, infoCard(data, sc, star), h('div', { class: 'detail-col' }, scoreCard(sc, c.company_name), statusCard(data, kinds, pickByName))),
      h('div', { class: 'detail-row2' }, recentCard(base.all, function () { pickByName('모든 소식'); }), statsBox),
      tabCard);
    drawStats();
    pick(o.tab ? Math.max(0, TABS.map(function (t) { return t[0]; }).indexOf(o.tab === '전체 소식' ? '모든 소식' : o.tab)) : 0);
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
