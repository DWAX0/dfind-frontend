/* 메일 리포트 (기획안 07): 보낸 요약 메일 목록 — 날짜 · 신규 · 받는 사람 · 상태 · 메일 본문 [보기]
   월 단위로 이동. [보기] 누르면 그날 보낸 메일 내용을 창으로. (지금 단계는 메일만, PPT·Word 없음) */
(async function () {
  'use strict';
  var main = await D.boot('mail');
  if (!main) return;
  var h = D.h;
  var CAT = ['permit', 'research', 'market', 'disclosure'];
  var HOW = { 'rule-based': '규칙 방식 자동 정리', 'claude-app': '담당자 정리 (Claude)' };
  var DAY = '일월화수목금토';
  var month = (new URLSearchParams(location.search).get('m') || D.today().slice(0, 7));
  var label = h('b', { class: 'week-label' });
  var card = h('section', { class: 'card', 'aria-labelledby': 'ml-h' });
  D.set(main, D.header('메일 리포트', '날짜별로 보낸 요약 메일을 다시 봅니다', {
    right: h('span', { class: 'chips' },
      h('button', { type: 'button', class: 'btn small', text: '◀ 이전 달', onclick: function () { move(-1); } }), label,
      h('button', { type: 'button', class: 'btn small', text: '다음 달 ▶', onclick: function () { move(1); } })) }),
    // 관리자: 발송 요약 (받는 사람 · 자동 발송 시각 · 마지막 발송) — 메일 수신자 화면에서 옮김
    D.role === 'admin' ? adminOverview() : null,
    card);

  function adminOverview() {
    var tiles = h('div', { class: 'mail-over-tiles' }, D.loading());
    var RES = { success: '성공', partial: '일부 실패', failed: '실패' };
    Promise.all([
      D.q(D.sb.from('mail_recipients').select('recipient_id,is_active,receive_daily')).catch(function () { return []; }),
      D.q(D.sb.from('mail_send_logs').select('*').order('sent_at', { ascending: false }).limit(1)).catch(function () { return []; })
    ]).then(function (r) {
      var rows = r[0] || [], last = (r[1] || [])[0];
      var active = rows.filter(function (x) { return x.is_active && x.receive_daily; }).length;
      D.set(tiles,
        h('a', { class: 'mail-over-tile', href: 'admin-recipients.html' },
          h('span', { class: 'note', text: '받는 사람' }), h('b', null, String(active), h('small', { text: ' 명' })),
          h('span', { class: 'note', text: '전체 ' + rows.length + '명 (중지·주간만 ' + (rows.length - active) + '명) · 수신자 관리 →' })),
        h('div', { class: 'mail-over-tile' + (last && last.status !== 'success' ? ' warn' : '') },
          h('span', { class: 'note', text: '마지막 발송' }), h('b', { text: last ? RES[last.status] || last.status : '기록 없음' }),
          h('span', { class: 'note', text: last ? D.fmtTime(last.sent_at) + ' · ' + last.success_count + '/' + last.recipient_count + '명' : '아직 보낸 적 없음' })));
    });
    var auto = D.mailAutoStatus(); auto.classList.add('wide');
    return h('div', { class: 'stack' }, h('section', { class: 'mail-over', 'aria-label': '발송 요약' },
      D.scheduleCard ? D.scheduleCard('mail_daily', '요약 메일 자동 발송 시각') : null, tiles), auto);
  }
  load();

  function move(n) {
    var y = Number(month.slice(0, 4)), m = Number(month.slice(5)) + n;
    if (m < 1) { y -= 1; m = 12; } if (m > 12) { y += 1; m = 1; }
    month = y + '-' + String(m).padStart(2, '0');
    history.replaceState(null, '', '?m=' + month);
    load();
  }
  function lastDay(m) { var d = new Date(Date.UTC(Number(m.slice(0, 4)), Number(m.slice(5)), 0)); return d.toISOString().slice(0, 10); }

  async function load() {
    label.textContent = month.slice(0, 4) + '년 ' + Number(month.slice(5)) + '월';
    D.set(card, D.loading());
    var a = month + '-01', b = lastDay(month);
    var arc, logs = [];
    try {
      arc = await D.q(D.sb.from('mail_archives').select('mail_date,subject,recipient_count,sent_at,content').gte('mail_date', a).lte('mail_date', b).order('mail_date', { ascending: false }));
      if (D.role === 'admin') {
        logs = await D.q(D.sb.from('mail_send_logs').select('mail_date,mail_kind,status,recipient_count,success_count,error_message,sent_at')
          .eq('mail_kind', 'daily').gte('mail_date', a).lte('mail_date', b).order('sent_at', { ascending: false }));
      }
    } catch (e) { D.set(card, D.fail(e)); return; }
    // 날짜마다 한 줄: 보낸 내용(아카이브) + 마지막 발송 기록(관리자)
    var by = {};
    arc.forEach(function (r) { by[r.mail_date] = { date: r.mail_date, arc: r }; });
    logs.forEach(function (l) { var x = by[l.mail_date] = by[l.mail_date] || { date: l.mail_date }; if (!x.log) x.log = l; });
    var list = Object.keys(by).sort().reverse().map(function (k) { return by[k]; });
    var ST = { success: ['발송 완료', 'ok'], partial: ['일부 실패', 'warn'], failed: ['실패', 'bad'] };
    D.set(card, h('div', { class: 'card-head' }, h('h2', { id: 'ml-h', text: '보낸 메일' }), h('span', { class: 'note', text: list.length + '건' })),
      list.length ? h('div', { class: 'table-wrap' }, h('table', { class: 'grid mail-table' },
        h('thead', null, h('tr', null, ['날짜', '신규 소식', '받는 사람', '상태', '메일 본문'].map(function (x) { return h('th', { scope: 'col', text: x }); }))),
        h('tbody', null, list.map(function (x) {
          var c = (x.arc && x.arc.content) || {};
          var items = c.items || [], counts = c.counts || {};
          var total = Object.keys(counts).reduce(function (s, k) { return s + counts[k]; }, 0);
          var st = x.log ? ST[x.log.status] || [x.log.status, 'gray'] : x.arc ? ST.success : ['미발송', 'gray'];
          return h('tr', null,
            h('td', { class: 'nowrap num-cell-left', text: md(x.date) + '(' + DAY[new Date(x.date + 'T12:00:00+09:00').getUTCDay()] + ')' }),
            h('td', { class: 'num-cell', text: x.arc ? D.num(total || items.length) + '건' : '–' }),
            h('td', { class: 'num-cell', text: x.arc ? x.arc.recipient_count + '명' : x.log ? x.log.success_count + '/' + x.log.recipient_count + '명' : '–' }),
            h('td', null, D.badge(st[0], st[1]), x.log && x.log.error_message ? h('span', { class: 'note block', text: x.log.error_message.slice(0, 80) }) : null),
            h('td', null, x.arc ? h('button', { type: 'button', class: 'btn small', text: '보기', onclick: function () { openView(x.arc); } }) : h('span', { class: 'note', text: '–' })));
        })))) : D.empty('이 달에 보낸 메일이 없습니다.'),
      h('p', { class: 'note', text: '신규 소식 = 그날(전날~당일) 발표·승인된 정보 (네이버 검색 기사 제외) · 받는 사람 주소는 보여 주지 않습니다.' }));
  }
  function md(d) { return Number(d.slice(5, 7)) + '/' + d.slice(8); }

  function openView(a) {
    var c = a.content || {}, sum = c.summary || {}, items = c.items || [];
    var dlg = h('dialog', { class: 'dialog wide', 'aria-label': '메일 본문' });
    dlg.addEventListener('close', function () { dlg.remove(); });
    D.set(dlg,
      h('div', { class: 'mail-head' }, h('div', null, h('p', { class: 'note', text: 'D*Find · 유망 디지털헬스케어 기업 발굴' }), h('h2', { text: a.subject || D.fmtLong(a.mail_date) }),
        h('p', { class: 'note', text: D.fmtTime(a.sent_at) + ' 보냄 · 받는 사람 ' + a.recipient_count + '명' })),
        h('span', { class: 'chips' }, h('a', { class: 'btn small', href: 'index.html?day=' + a.mail_date, text: '이날 SUMMARY' }),
          h('button', { type: 'button', class: 'btn small', text: '닫기', onclick: function () { dlg.close(); } }))),
      h('div', { class: 'archive-view' },
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
            lst.map(function (it) { return D.feedItem(it, { noDetail: true }); }));
        }) : D.empty('새 소식이 없었습니다.')));
    document.body.appendChild(dlg);
    dlg.showModal();
  }
})();
