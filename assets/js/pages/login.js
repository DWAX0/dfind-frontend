/* 로그인: 아이디(회사 이메일) + 비밀번호
   - 계정은 관리자가 대시보드 › 기준 정보 › 사용자·권한 에서 추가 (처음 비밀번호 = 이메일 @ 앞부분)
   - 첫 로그인·비밀번호 초기화 뒤에는 새 비밀번호를 정해야 다음 화면으로 감 (login.html?change=1) */
(async function () {
  'use strict';
  var h = D.h;
  var main = document.getElementById('main');
  if (!D.sb) {
    D.set(main, h('p', { class: 'notice error', text: '설정이 비어 있습니다. assets/js/config.js 에 Supabase 주소와 anon 키를 넣어 주세요.' }));
    return;
  }
  var msg = h('p', { class: 'notice info', role: 'status', hidden: true });
  function show(text, kind) { msg.hidden = false; msg.className = 'notice ' + (kind || 'info'); msg.textContent = text; }
  function brand() {
    return h('span', { class: 'brand' }, h('span', { class: 'brand-mark', text: 'D*' }),
      h('span', null, h('b', { text: 'D*Find' }), h('small', { text: '디지털헬스 기업 발굴' })));
  }
  var ASK = '비밀번호가 기억나지 않으면 관리자에게 초기화를 요청해 주세요.';

  async function mustChange(uid) {
    try {
      var p = await D.q(D.sb.from('user_profiles').select('must_change_password').eq('user_id', uid).maybeSingle());
      return !!(p && p.must_change_password);
    } catch (e) { return false; }
  }

  // ---- 1) 아이디·비밀번호 ----
  function loginForm() {
    var id = h('input', { class: 'input', type: 'email', id: 'login-id', autocomplete: 'username', required: true, placeholder: 'name@회사.com' });
    var pw = h('input', { class: 'input', type: 'password', id: 'login-pw', autocomplete: 'current-password', required: true });
    var btn = h('button', { type: 'submit', class: 'btn primary block', text: '로그인' });
    var form = h('form', { class: 'login-form', novalidate: true },
      h('label', { class: 'field', for: 'login-id' }, '아이디 (회사 이메일)', id),
      h('label', { class: 'field', for: 'login-pw' }, '비밀번호', pw),
      btn, msg,
      h('p', { class: 'note login-help', text: ASK }));
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      if (!id.value.trim() || !pw.value) { show('아이디와 비밀번호를 입력해 주세요.', 'error'); return; }
      btn.disabled = true; btn.textContent = '확인 중…';
      var r = await D.sb.auth.signInWithPassword({ email: id.value.trim().toLowerCase(), password: pw.value });
      btn.disabled = false; btn.textContent = '로그인';
      if (r.error) { show('아이디 또는 비밀번호가 맞지 않습니다. ' + ASK, 'error'); pw.value = ''; pw.focus(); return; }
      if (await mustChange(r.data.user.id)) { changeForm(pw.value); return; }
      location.replace('index.html');
    });
    D.set(main, h('section', { class: 'card login-card' }, brand(), h('h1', { class: 'title', text: '로그인' }), form));
    id.focus();
  }

  // ---- 2) 첫 로그인: 새 비밀번호 정하기 ----
  function changeForm(oldPw) {
    var old = h('input', { class: 'input', type: 'password', id: 'pw-old', autocomplete: 'current-password', required: true });
    var nw = h('input', { class: 'input', type: 'password', id: 'pw-new', autocomplete: 'new-password', required: true, minlength: 8 });
    var nw2 = h('input', { class: 'input', type: 'password', id: 'pw-new2', autocomplete: 'new-password', required: true, minlength: 8 });
    if (oldPw) old.value = oldPw;
    var btn = h('button', { type: 'submit', class: 'btn primary block', text: '비밀번호 바꾸고 시작하기' });
    msg.hidden = true;
    var form = h('form', { class: 'login-form', novalidate: true },
      oldPw ? null : h('label', { class: 'field', for: 'pw-old' }, '지금 비밀번호 (처음이면 이메일 @ 앞부분)', old),
      h('label', { class: 'field', for: 'pw-new' }, '새 비밀번호 (8자 이상)', nw),
      h('label', { class: 'field', for: 'pw-new2' }, '새 비밀번호 한 번 더', nw2),
      btn, msg,
      h('button', { type: 'button', class: 'btn small', text: '다른 계정으로 로그인', onclick: async function () { await D.sb.auth.signOut(); location.replace('login.html'); } }));
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      if (nw.value.length < 8) { show('새 비밀번호는 8자 이상으로 정해 주세요.', 'error'); nw.focus(); return; }
      if (nw.value !== nw2.value) { show('새 비밀번호 두 칸이 서로 다릅니다.', 'error'); nw2.focus(); return; }
      btn.disabled = true; btn.textContent = '바꾸는 중…';
      try {
        await D.rpc('change_my_password', { p_old: old.value, p_new: nw.value });
        show('비밀번호를 바꿨습니다. 시작 화면으로 갑니다.');
        location.replace('index.html');
      } catch (err) {
        btn.disabled = false; btn.textContent = '비밀번호 바꾸고 시작하기';
        show((err && err.message) || String(err), 'error');
      }
    });
    D.set(main, h('section', { class: 'card login-card' }, brand(), h('h1', { class: 'title', text: '새 비밀번호 정하기' }),
      h('p', { class: 'note', text: '처음 로그인했거나 관리자가 비밀번호를 초기화했습니다. 다른 사람이 알 수 없는 새 비밀번호로 바꿔 주세요.' }), form));
    (oldPw ? nw : old).focus();
  }

  var s = (await D.sb.auth.getSession()).data.session;
  if (s) {
    if (await mustChange(s.user.id)) { changeForm(null); return; }
    location.replace('index.html');
    return;
  }
  loginForm();
})();
