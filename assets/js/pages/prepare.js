/* 08 메일 리포트 · 09 수집 현황: 준비 중 */
(async function () {
  'use strict';
  var page = /status\.html/.test(location.pathname) ? 'status' : 'mail';
  var main = await D.boot(page);
  if (!main) return;
  var h = D.h;
  var P = {
    mail: ['메일 리포트', '매일 오전 9시에 보낸 요약 메일을 날짜별로 다시 보고, 받는 사람과 발송 결과를 함께 확인하는 화면입니다.',
      '지금은 SUMMARY 에서 날짜를 고르면 그날 메일과 같은 결론을 볼 수 있습니다.', 'index.html?per=day', 'SUMMARY 에서 날짜 고르기'],
    status: ['수집 현황', '출처마다 매일 제대로 수집됐는지, 몇 건이 새로 들어왔는지, 실패한 곳은 왜 실패했는지 한눈에 보는 화면입니다.',
      D.role === 'admin' ? '지금은 관리자 › 로그 관리 › 수집 로그에서 같은 내용을 볼 수 있습니다.' : '왼쪽 아래에서 마지막 수집 시각과 정상 출처 수를 볼 수 있습니다.',
      D.role === 'admin' ? 'admin-logs.html' : null, '수집 로그 보기']
  }[page];
  D.set(main, D.header(P[0]),
    h('section', { class: 'card prep' }, D.badge('준비 중 · 2차 오픈', 'gray'), h('h2', { text: '이 화면은 준비 중입니다' }),
      h('p', { text: P[1] }), h('p', { class: 'note', text: P[2] }),
      P[3] ? h('a', { class: 'btn primary', href: P[3], text: P[4] }) : null));
})();
