/* 로그인: 메일로 받은 링크를 누르거나, 비밀번호로 로그인 (계정은 관리자가 Supabase 에서 초대) */
(async function () {
  'use strict';
  var h = D.h;
  var main = document.getElementById('main');
  if (!D.sb) {
    D.set(main, h('p', { class: 'notice error', text: '설정이 비어 있습니다. assets/js/config.js 에 Supabase 주소와 anon 키를 넣어 주세요.' }));
    return;
  }
  var s = (await D.sb.auth.getSession()).data.session;
  if (s) { location.replace('index.html'); return; }

  var msg = h('p', { class: 'notice info', role: 'status', hidden: true });
  var email = h('input', { class: 'input', type: 'email', id: 'email', autocomplete: 'email', required: true, placeholder: 'name@회사.com' });
  var pw = h('input', { class: 'input', type: 'password', id: 'pw', autocomplete: 'current-password', placeholder: '비밀번호를 정했다면 입력' });
  function show(text, kind) { msg.hidden = false; msg.className = 'notice ' + (kind || 'info'); msg.textContent = text; }

  async function sendLink() {
    if (!email.value) { show('이메일을 입력해 주세요.', 'error'); return; }
    var back = location.href.replace(/login\.html.*$/, 'index.html');
    var r = await D.sb.auth.signInWithOtp({ email: email.value.trim(), options: { shouldCreateUser: false, emailRedirectTo: back } });
    if (r.error) show('보내지 못했습니다: ' + r.error.message + ' (초대받은 이메일인지 확인해 주세요)', 'error');
    else show(email.value + ' 로 로그인 링크를 보냈습니다. 메일함에서 링크를 눌러 주세요.');
  }
  async function withPassword() {
    if (!email.value || !pw.value) { show('이메일과 비밀번호를 입력해 주세요.', 'error'); return; }
    var r = await D.sb.auth.signInWithPassword({ email: email.value.trim(), password: pw.value });
    if (r.error) show('로그인하지 못했습니다. 이메일·비밀번호를 확인해 주세요.', 'error');
    else location.replace('index.html');
  }

  D.set(main, h('section', { class: 'card login-card' },
    h('span', { class: 'brand' }, h('span', { class: 'brand-mark', text: 'D*' }),
      h('span', null, h('b', { text: 'D*Find' }), h('small', { text: '디지털헬스 기업 발굴' }))),
    h('h1', { class: 'title', text: '로그인' }),
    h('label', { class: 'field', for: 'email' }, '회사 이메일', email),
    h('button', { type: 'button', class: 'btn primary', text: '메일로 로그인 링크 받기', onclick: sendLink }),
    h('p', { class: 'note', text: '비밀번호를 정해 둔 경우에는 아래에 입력하고 로그인해도 됩니다.' }),
    h('label', { class: 'field', for: 'pw' }, '비밀번호', pw),
    h('button', { type: 'button', class: 'btn', text: '비밀번호로 로그인', onclick: withPassword }),
    msg));
  pw.addEventListener('keydown', function (e) { if (e.key === 'Enter') withPassword(); });
})();
