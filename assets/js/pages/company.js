/* 03 기업 정보: ?id=… 한 기업 (기본·업허가·인허가 단계·점수 근거·최근 1년 소식·허가 제품·임상시험)
   id 가 없으면 기업 찾기 화면 */
(async function () {
  'use strict';
  var main = await D.boot('company');
  if (!main) return;
  var h = D.h;
  var id = new URLSearchParams(location.search).get('id');
  if (!id) { await finder(); return; }

  D.set(main, D.loading());
  var data;
  try { data = await D.rpc('dash_company', { p_company_id: Number(id) }); } catch (e) { D.set(main, D.fail(e)); return; }
  if (!data) { D.set(main, h('a', { href: 'company.html', text: '기업 찾기로' }), D.empty('기업을 찾을 수 없습니다.')); return; }

  var c = data.company, sc = data.score, tl = data.timeline || [];
  var kinds = {};
  tl.forEach(function (f) { kinds[f.kind] = (kinds[f.kind] || []).concat([f]); });
  var LIC = { manufacture: '제조업', import: '수입업', repair: '수리업', sales: '판매·임대업' };
  var LST = { active: '', suspended: ' (휴업)', closed: ' (폐업)' };
  var RST = { active: '정상', withdrawn: '취하', cancelled: '취소' };

  // 인허가 진행 단계
  function lastDate(list, key) { return list && list.length ? list.map(function (x) { return x[key]; }).filter(Boolean).sort().pop() : null; }
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

  var tlBox = h('div');
  var st = { cat: 'all' };
  function drawTimeline() {
    var cats = ['all', 'permit', 'market', 'research', 'disclosure'];
    var list = tl.filter(function (f) { return st.cat === 'all' || f.category === st.cat; });
    D.set(tlBox, 
      h('div', { class: 'chips', role: 'group', 'aria-label': '분야' }, cats.map(function (k) {
        var n = k === 'all' ? tl.length : tl.filter(function (f) { return f.category === k; }).length;
        return h('button', { type: 'button', class: 'chip', 'aria-pressed': st.cat === k ? 'true' : 'false',
          text: (k === 'all' ? '전체' : D.CAT[k].label) + ' ' + n, onclick: function () { st.cat = k; drawTimeline(); } });
      })),
      list.length ? list.map(function (f) { return D.feedItem(f); }) : D.empty('최근 1년 소식이 없습니다.'));
  }
  drawTimeline();

  var why = [];
  if (data.innovations.length) why.push('혁신의료기기 지정 제품 보유 (' + D.fmt(lastDate(data.innovations, 'designation_date')) + ')');
  if (data.trials.length) why.push('임상시험 승인 ' + data.trials.length + '건 · 최근 ' + D.fmt(lastDate(data.trials, 'approval_date')));
  if (kinds['평가 유예']) why.push('평가 유예 대상 — 출시 뒤 바로 병원 사용 가능');
  if (sc && sc.delta > 0) why.push('기준일 점수가 전날보다 ' + sc.delta + '점 올랐습니다');
  if (!why.length) why.push('최근 눈에 띄는 신호가 없습니다');

  D.set(main, 
    h('a', { class: 'btn small', href: 'radar.html' }, D.svg('M15 5l-7 7 7 7', 20), '기업 레이더로'),
    h('header', { class: 'card company-head' },
      h('div', { class: 'grow' },
        h('h1', { class: 'company-name' }, c.company_name, ' ', data.innovations.length ? D.badge('★ 혁신의료기기 지정', 'star') : null),
        h('span', { class: 'sub', text: [c.company_address, sc && sc.field].filter(Boolean).join(' · ') || '' }),
        h('div', { class: 'chips' }, h('a', { class: 'btn', href: 'regulatory.html?per=30&q=' + encodeURIComponent(c.company_name), text: '이 기업 인허가 소식' }))),
      sc ? h('div', { class: 'big-score' }, h('span', { class: 'note', text: '조기 발굴 점수' }), h('br'), h('b', { text: sc.total }), ' / 100',
        h('p', { class: 'note', text: sc.rank + '위 · 전날 대비 ' + (sc.delta > 0 ? '▲ ' + sc.delta : sc.delta < 0 ? '▼ ' + Math.abs(sc.delta) : '변동 없음') })) : null),
    h('section', { class: 'card' }, h('h2', { text: '지금 볼 이유' }), h('ul', null, why.map(function (x) { return h('li', { text: x }); }))),
    h('section', { class: 'card' }, h('h2', { text: '인허가 진행 단계' }),
      h('ol', { class: 'steps' }, steps.map(function (s) {
        var state = s.done ? 'done' : s.doing ? 'doing' : 'todo';
        return h('li', null, h('span', { class: 'step-dot ' + state, text: s.done ? '✓' : '' }), h('b', { text: s.name }),
          h('span', { class: 'step-state ' + state, text: s.done ? '완료' : s.doing ? '진행 중' : '아직' }), h('span', { class: 'note', text: s.note }));
      }))),
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
        h('section', { class: 'card' }, h('h2', { text: '기본 정보' }),
          h('dl', { class: 'info' },
            h('dt', { text: '주소' }), h('dd', { text: c.company_address || '정보 없음' }),
            data.licenses.length ? data.licenses.map(function (l) {
              return [h('dt', { text: (LIC[l.license_type] || '업') + ' 허가' }),
                h('dd', { text: l.license_number + (l.license_date ? ' · ' + l.license_date : '') + (LST[l.license_status] || '') })];
            }) : [h('dt', { text: '업허가' }), h('dd', { text: '정보 없음' })]),
          h('p', { class: 'note', text: '출처: 이머디 업허가 현황 · 디지털의료기기 대장' })),
        h('section', { class: 'card' }, h('h2', null, '허가 제품 ', h('span', { class: 'note', text: data.registrations.length + '건' })),
          data.registrations.length ? data.registrations.map(function (r, i) {
            return h('div', { class: 'list-item' }, h('b', { text: r.product_name || '(제품명 없음)' }),
              h('span', { class: 'list-meta', text: [r.permit_number, r.device_class && r.device_class + '등급', r.approval_date, RST[r.approval_status]].filter(Boolean).join(' · ') }),
              r.intended_use ? h('span', { class: 'list-detail', text: r.intended_use.slice(0, 160) }) : null);
          }).map(function (el, i) { if (i >= 8) el.hidden = true; return el; }) : D.empty('허가 정보가 없습니다.'),
          data.registrations.length > 8 ? h('button', { type: 'button', class: 'btn small', text: '나머지 ' + (data.registrations.length - 8) + '건 보기',
            onclick: function (e) { e.currentTarget.parentNode.querySelectorAll('.list-item[hidden]').forEach(function (x) { x.hidden = false; }); e.currentTarget.remove(); } }) : null),
        h('section', { class: 'card' }, h('h2', null, '임상시험 ', h('span', { class: 'note', text: data.trials.length + '건' })),
          data.trials.length ? data.trials.map(function (t) {
            return h('div', { class: 'list-item' },
              t.source_url ? h('a', { class: 'list-title', href: t.source_url, target: '_blank', rel: 'noopener noreferrer', text: t.trial_title })
                : h('b', { text: t.trial_title }),
              h('span', { class: 'list-meta', text: [D.fmt(t.approval_date), t.product_name, t.trial_purpose].filter(Boolean).join(' · ') }),
              t.sites && t.sites.length ? h('span', { class: 'list-detail', text: '실시기관: ' + t.sites.join(', ') }) : null);
          }) : D.empty('임상시험 승인 정보가 없습니다.')))));

  async function finder() {
    var box = h('div');
    var input = h('input', { type: 'search', class: 'input', id: 'q', placeholder: '기업 이름을 입력하세요', autofocus: true });
    D.set(main, D.header('기업 정보', '기업 이름으로 찾거나, 기업 레이더·목록에서 기업 이름을 누르면 이 화면으로 옵니다.'),
      h('section', { class: 'card' }, h('label', { class: 'field', for: 'q' }, '기업 찾기', input), box));
    var all = [];
    D.set(box, D.loading());
    try { all = await D.rpc('dash_company_scores', { p_as_of: D.today() }); } catch (e) { D.set(box, D.fail(e)); return; }
    function draw() {
      var s = input.value.trim().toLowerCase();
      var list = all.filter(function (r) { return !s || r.company_name.toLowerCase().indexOf(s) >= 0; }).slice(0, 40);
      D.set(box, list.length ? list.map(function (r) {
        return h('div', { class: 'list-item' }, h('a', { class: 'list-title', href: D.companyHref(r.company_id), text: r.company_name }),
          h('span', { class: 'list-meta', text: '점수 ' + r.total + ' · ' + r.rank + '위' + (r.field ? ' · ' + r.field : '') }));
      }) : D.empty('찾는 기업이 없습니다. (점수가 0점인 기업은 목록에 없습니다)'));
    }
    input.addEventListener('input', draw);
    draw();
  }
})();
