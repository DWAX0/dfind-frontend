/* 관리자 › 메일 수신자: 요약 메일 받는 사람 추가·수정·중지·삭제 (mail_recipients, admin 만) */
(async function () {
  'use strict';
  var main = await D.boot('recipients', { admin: true });
  if (!main) return;
  var h = D.h;
  var rows = [];
  var st = { edit: null, del: null };
  var msg = h('p', { class: 'notice', role: 'status', hidden: true });
  var summary = h('section', { class: 'tiles', 'aria-label': '발송 요약' });
  var listBox = h('div');

  function say(text, kind) { msg.hidden = false; msg.className = 'notice ' + (kind || 'info'); msg.textContent = text; }
  function input(id, type, ph) { return h('input', { class: 'input', id: id, type: type || 'text', placeholder: ph || '' }); }
  var fName = input('r-name', 'text', '홍길동'), fEmail = input('r-email', 'email', 'name@회사.com'), fDept = input('r-dept', 'text', '사업개발팀');
  var fDaily = h('input', { type: 'checkbox', id: 'r-daily', checked: true }), fWeekly = h('input', { type: 'checkbox', id: 'r-weekly' });

  D.set(main, 
    D.header('메일 수신자 관리', '요약 메일을 받을 사람을 정합니다. 자동 발송 시각은 메일 리포트 화면 위에서, 시험 발송은 위쪽 메일 아이콘에서', { admin: true }),
    summary, msg,
    h('section', { class: 'card', 'aria-labelledby': 'add-h' }, h('h2', { id: 'add-h', text: '받는 사람 추가' }),
      h('div', { class: 'tiles' },
        h('label', { class: 'field', for: 'r-name' }, '이름', fName), h('label', { class: 'field', for: 'r-email' }, '이메일', fEmail),
        h('label', { class: 'field', for: 'r-dept' }, '부서', fDept),
        h('fieldset', { class: 'field' }, h('legend', { text: '받을 메일' }),
          h('label', { class: 'check', for: 'r-daily' }, fDaily, '매일 요약'), h('label', { class: 'check', for: 'r-weekly' }, fWeekly, '주간 요약'))),
      h('button', { type: 'button', class: 'btn primary', text: '추가', onclick: addOne })),
    h('section', { class: 'card', 'aria-labelledby': 'list-h' }, h('h2', { id: 'list-h', text: '받는 사람 목록' }), listBox,
      h('p', { class: 'note', text: '이메일 주소는 관리자에게만 보입니다. 추가·수정·중지·삭제는 로그 관리 › 변경 기록에 남습니다.' })));

  async function load() {
    D.set(listBox, D.loading());
    var r = await Promise.all([
      D.q(D.sb.from('mail_recipients').select('*').order('name')).catch(function (e) { return e; }),
      D.q(D.sb.from('mail_send_logs').select('*').order('sent_at', { ascending: false }).limit(1)).catch(function () { return []; })
    ]);
    if (!Array.isArray(r[0])) { D.set(listBox, D.fail(r[0])); return; }
    rows = r[0];
    var last = r[1][0];
    var active = rows.filter(function (x) { return x.is_active; }).length;
    var RES = { success: '성공', partial: '일부 실패', failed: '실패' };
    D.set(summary, 
      h('div', { class: 'tile' }, h('span', { class: 'tile-label', text: '받는 사람' }), h('span', { class: 'tile-num' }, active, h('small', { text: '명' })),
        h('span', { class: 'tile-note', text: '중지 ' + (rows.length - active) + '명 포함 전체 ' + rows.length + '명' })),
      h('div', { class: 'tile' }, h('span', { class: 'tile-label', text: '발송 시각' }), h('span', { class: 'tile-num', text: '09:00' }),
        h('span', { class: 'tile-note', text: '매일 · 수집이 끝난 뒤 발송 (고정)' })),
      h('div', { class: 'tile' }, h('span', { class: 'tile-label', text: '마지막 발송' }),
        h('span', { class: 'tile-num', text: last ? RES[last.status] : '기록 없음' }),
        h('span', { class: 'tile-note', text: last ? D.fmtTime(last.sent_at) + ' · ' + last.success_count + '/' + last.recipient_count + '명' : '메일 발송 기능 연결 전' })));
    draw();
  }

  function draw() {
    if (!rows.length) { D.set(listBox, D.empty('아직 받는 사람이 없습니다. 위에서 추가해 주세요.')); return; }
    var body = h('tbody', null, rows.map(function (r) { return st.edit === r.recipient_id ? editRow(r) : viewRow(r); }));
    D.set(listBox, h('div', { class: 'table-wrap' }, h('table', { class: 'grid' },
      h('thead', null, h('tr', null, ['이름 · 부서', '이메일', '받을 메일', '받기', '관리'].map(function (t) { return h('th', { scope: 'col', text: t }); }))),
      body)));
  }
  function kinds(r) { return [r.receive_daily ? '매일' : null, r.receive_weekly ? '주간' : null].filter(Boolean).join(' · ') || '없음'; }
  function viewRow(r) {
    var del = st.del === r.recipient_id;
    return h('tr', null,
      h('td', null, h('b', { text: r.name }), r.department ? h('span', { class: 'list-meta', text: r.department }) : null),
      h('td', { text: r.email }), h('td', { text: kinds(r) }),
      h('td', null, h('button', { type: 'button', class: 'btn small' + (r.is_active ? ' on' : ''), 'aria-pressed': r.is_active ? 'true' : 'false',
        text: r.is_active ? '받는 중' : '중지됨', onclick: function () { save(r.recipient_id, { is_active: !r.is_active }, r.is_active ? '중지했습니다' : '다시 받도록 했습니다'); } })),
      h('td', null, h('span', { class: 'chips' },
        h('button', { type: 'button', class: 'btn small', text: '수정', onclick: function () { st.edit = r.recipient_id; st.del = null; draw(); } }),
        del ? h('button', { type: 'button', class: 'btn small danger', text: '정말 삭제', onclick: function () { remove(r); } })
          : h('button', { type: 'button', class: 'btn small danger', text: '삭제', onclick: function () { st.del = r.recipient_id; draw(); } }),
        del ? h('button', { type: 'button', class: 'btn small', text: '취소', onclick: function () { st.del = null; draw(); } }) : null)));
  }
  function editRow(r) {
    var n = h('input', { class: 'input', value: r.name, 'aria-label': '이름' }), d = h('input', { class: 'input', value: r.department || '', 'aria-label': '부서' });
    var e = h('input', { class: 'input', type: 'email', value: r.email, 'aria-label': '이메일' });
    var cd = h('input', { type: 'checkbox', checked: r.receive_daily }), cw = h('input', { type: 'checkbox', checked: r.receive_weekly });
    return h('tr', null, h('td', null, n, d), h('td', null, e),
      h('td', null, h('label', { class: 'check' }, cd, '매일'), h('label', { class: 'check' }, cw, '주간')), h('td'),
      h('td', null, h('span', { class: 'chips' },
        h('button', { type: 'button', class: 'btn small primary', text: '저장', onclick: function () {
          save(r.recipient_id, { name: n.value.trim(), department: d.value.trim() || null, email: e.value.trim(), receive_daily: cd.checked, receive_weekly: cw.checked }, '저장했습니다');
        } }),
        h('button', { type: 'button', class: 'btn small', text: '취소', onclick: function () { st.edit = null; draw(); } }))));
  }
  function errText(e) {
    var m = (e && e.message) || String(e);
    if (/mail_recipients_email_uk|duplicate/.test(m)) return '이미 등록된 이메일입니다.';
    if (/mail_recipients_email_chk/.test(m)) return '이메일 주소 형식이 맞지 않습니다.';
    return m;
  }
  async function save(id, patch, done) {
    try { await D.q(D.sb.from('mail_recipients').update(patch).eq('recipient_id', id)); st.edit = null; say(done); await load(); }
    catch (e) { say('저장하지 못했습니다: ' + errText(e), 'error'); }
  }
  async function remove(r) {
    try { await D.q(D.sb.from('mail_recipients').delete().eq('recipient_id', r.recipient_id)); st.del = null; say(r.name + ' 님을 삭제했습니다'); await load(); }
    catch (e) { say('삭제하지 못했습니다: ' + errText(e), 'error'); }
  }
  async function addOne() {
    var row = { name: fName.value.trim(), email: fEmail.value.trim(), department: fDept.value.trim() || null,
      receive_daily: fDaily.checked, receive_weekly: fWeekly.checked };
    if (!row.name || !row.email) { say('이름과 이메일을 입력해 주세요.', 'error'); return; }
    try {
      await D.q(D.sb.from('mail_recipients').insert(row));
      fName.value = ''; fEmail.value = ''; fDept.value = '';
      say(row.name + ' 님을 추가했습니다'); await load();
    } catch (e) { say('추가하지 못했습니다: ' + errText(e), 'error'); }
  }
  load();
})();
