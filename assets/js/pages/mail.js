/* 메일 리포트: 보낸 요약 메일을 날짜별로 다시 보기 (mail_archives). 왼쪽 날짜 목록 → 오른쪽 메일 내용 */
(async function () {
  'use strict';
  var main = await D.boot('mail');
  if (!main) return;
  var h = D.h;
  var CAT = ['permit', 'research', 'market', 'disclosure'];
  var HOW = { 'rule-based': '규칙 방식 자동 정리', 'claude-app': '담당자 정리 (Claude)' };
  var list = h('nav', { class: 'card archive-list', 'aria-label': '보낸 날짜' });
  var view = h('article', { class: 'card archive-view', 'aria-live': 'polite' });
  D.set(main, D.header('메일 리포트', '보낸 요약 메일을 날짜별로 다시 봅니다'), h('div', { class: 'archive' }, list, view));
  var rows;
  try { rows = await D.q(D.sb.from('mail_archives').select('mail_date,subject,recipient_count,sent_at').order('mail_date', { ascending: false }).limit(120)); }
  catch (e) { D.set(list, D.fail(e)); D.set(view); return; }
  if (!rows.length) { D.set(list, D.empty('아직 보낸 메일이 없습니다.')); D.set(view, D.empty('메일을 보내면 여기에서 다시 볼 수 있습니다.')); return; }
  var want = new URLSearchParams(location.search).get('date') || rows[0].mail_date;
  D.set(list, h('h2', { text: '보낸 날짜' }), h('ul', { class: 'archive-dates' }, rows.map(function (r) {
    return h('li', null, h('button', { type: 'button', class: 'archive-date', 'aria-current': r.mail_date === want ? 'true' : null, 'data-date': r.mail_date,
      onclick: function () { show(r.mail_date); } }, h('b', { text: D.fmt(r.mail_date) }), h('span', { class: 'note', text: r.recipient_count + '명' })));
  })));
  show(rows.some(function (r) { return r.mail_date === want; }) ? want : rows[0].mail_date);

  async function show(day) {
    history.replaceState(null, '', '?date=' + day);
    list.querySelectorAll('.archive-date').forEach(function (b) { if (b.getAttribute('data-date') === day) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current'); });
    D.set(view, D.loading());
    var a;
    try { a = await D.q(D.sb.from('mail_archives').select('*').eq('mail_date', day).single()); } catch (e) { D.set(view, D.fail(e)); return; }
    var c = a.content || {}, sum = c.summary || {}, items = c.items || [];
    D.set(view,
      h('div', { class: 'mail-head' }, h('div', null, h('p', { class: 'note', text: 'D*Find · 유망 디지털헬스케어 기업 발굴' }), h('h2', { text: a.subject || D.fmtLong(day) }),
        h('p', { class: 'note', text: D.fmtTime(a.sent_at) + ' 보냄 · 받는 사람 ' + a.recipient_count + '명' })),
        h('a', { class: 'btn small', href: 'index.html?day=' + day, text: '이날 SUMMARY 보기' })),
      h('h3', { text: '오늘의 결론' }),
      (sum.conclusions || []).length ? h('ol', { class: 'mail-concl' }, sum.conclusions.map(function (x) {
        var ref = (x.refs || [])[0];
        return h('li', null, D.rich(x.text), ref && ref.item_key ? [' ', h('a', { href: D.itemHref(ref.item_key), text: '근거 보기' })] : null);
      })) : D.empty('결론이 없었습니다.'),
      sum.model ? h('p', { class: 'note', text: HOW[sum.model] || 'AI 정리' }) : null,
      (c.top || []).length ? [h('h3', { text: '주목 기업 TOP 5' }), h('ol', { class: 'mail-top' }, c.top.map(function (r) {
        return h('li', null, D.companyLink(r.company_id, r.company_name), h('b', { text: ' ' + r.total + '점' }),
          h('span', { class: 'note', text: ' ' + (r.delta > 0 ? '▲' + r.delta : r.delta < 0 ? '▼' + (-r.delta) : '–') + (r.recent_signal ? ' · ' + r.recent_signal : '') }));
      }))] : null,
      h('h3', { text: '분야별 새 소식' }),
      items.length ? CAT.map(function (k) {
        var lst = items.filter(function (it) { return it.category === k; });
        if (!lst.length) return null;
        return h('div', null, h('h4', null, h('span', { class: 'dot dot-' + k }), ' ' + D.CAT[k].label + ' ', h('span', { class: 'note', text: lst.length + '건' })),
          lst.map(function (it) { return D.feedItem(it, { noDetail: true, noStar: false }); }));
      }) : D.empty('새 소식이 없었습니다.'));
  }
})();
