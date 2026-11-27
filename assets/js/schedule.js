/* 자동 실행 시각 카드 (관리자): 메일 리포트 화면 위(mail_daily) · 수집 현황 화면 위(crawl_daily) — 같은 모양
   한 줄 요약 [시계 · 시각 · 요일 · 상태] + [시각 바꾸기] 를 누르면 그 자리에서 고침
   저장하면 admin_set_schedule → Supabase pg_cron 예약이 다시 등록되고, 그 시각에 GitHub 작업을 깨움 */
(function () {
  'use strict';
  var h = D.h;
  D.scheduleCard = function (name, title) {
    var card = h('section', { class: 'card schedule-card', 'aria-labelledby': 'sch-' + name });
    var msg = h('span', { class: 'note', role: 'status' });
    async function load() {
      D.set(card, D.loading());
      var s;
      try { s = await D.rpc('dash_schedules'); } catch (e) { D.set(card, D.fail(e)); return; }
      draw(s);
    }
    function ready(s) {
      var probs = [];
      if (!s.pg_cron) probs.push('Supabase › Database › Extensions 에서 pg_cron 켜기');
      if (!s.pg_net) probs.push('Supabase › Database › Extensions 에서 pg_net 켜기');
      if (!s.github_ready) probs.push('Supabase › Vault 에 github_dispatch_token · github_repo 저장');
      var last = s.last_dispatch;
      if (last && last.status_code && last.status_code !== 204) probs.push('GitHub 연결 오류 (마지막 응답 ' + last.status_code + ': 토큰 승인·저장소 이름 확인)');
      return probs;
    }
    function draw(s) {
      var it = (s.items || []).filter(function (x) { return x.name === name; })[0];
      if (!it) { D.set(card, D.empty('일정 정보가 없습니다. DB 업데이트(20261125d)를 실행해 주세요.')); return; }
      var time = h('input', { type: 'time', class: 'input', id: 'sch-time-' + name, value: it.run_time, step: '300' });
      var on = h('input', { type: 'checkbox', id: 'sch-on-' + name, checked: it.enabled });
      var wd = h('input', { type: 'checkbox', id: 'sch-wd-' + name, checked: it.weekdays_only });
      var probs = ready(s);
      var registered = it.cron && it.cron.active;
      var state = !it.enabled ? ['꺼짐', 'gray'] : probs.length ? ['준비 안 됨', 'bad'] : registered ? ['켜짐', 'ok'] : ['등록 대기', 'warn'];
      var editor = h('div', { class: 'sch-edit', hidden: true },
        h('label', { class: 'field', for: 'sch-time-' + name }, '실행 시각', time),
        h('label', { class: 'check', for: 'sch-on-' + name }, on, '자동 실행 켜기'),
        h('label', { class: 'check', for: 'sch-wd-' + name }, wd, '월~금만 (주말 제외)'),
        h('button', { type: 'button', class: 'btn primary', text: '저장', onclick: async function (e) {
          e.currentTarget.disabled = true; msg.textContent = '저장하는 중…';
          try {
            var r = await D.rpc('admin_set_schedule', { p_name: name, p_time: time.value, p_enabled: on.checked, p_weekdays_only: wd.checked });
            draw(r.schedules);
            card.querySelector('[role=status]').textContent = r.status === 'scheduled' ? '저장했습니다. 다음 실행부터 이 시각에 돕니다.'
              : r.status === 'off' ? '저장했습니다. 자동 실행을 껐습니다.' : '시각은 저장했지만 pg_cron 이 꺼져 있어 예약되지 않았습니다.';
          } catch (err) { msg.textContent = '저장하지 못했습니다: ' + (err.message || err); e.currentTarget.disabled = false; }
        } }),
        h('button', { type: 'button', class: 'btn', text: '취소', onclick: function () { editor.hidden = true; editBtn.hidden = false; } }));
      var editBtn = h('button', { type: 'button', class: 'btn small', text: '시각 바꾸기', 'aria-controls': 'sch-ed-' + name,
        onclick: function () { editor.hidden = false; editBtn.hidden = true; time.focus(); } });
      editor.id = 'sch-ed-' + name;
      D.set(card,
        h('div', { class: 'sch-strip' },
          h('span', { class: 'sch-ico', 'aria-hidden': 'true' }, D.svg('M12 7v5l3 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18', 22)),
          h('div', { class: 'sch-what' }, h('h2', { id: 'sch-' + name, text: title || it.label }),
            h('span', { class: 'note', text: '한국 시간 · 공휴일은 작업이 스스로 건너뜀' })),
          h('div', { class: 'sch-when' },
            h('b', { class: 'sch-time' + (it.enabled ? '' : ' off'), text: it.run_time }),
            h('span', { class: 'sch-days', text: it.weekdays_only ? '월~금' : '매일' })),
          D.badge(state[0], state[1]),
          h('span', { class: 'right' }, editBtn)),
        editor,
        msg,
        probs.length && it.enabled ? h('div', { class: 'notice' }, h('b', { text: '자동 실행을 쓰려면 먼저 해 주세요' }),
          h('ul', null, probs.map(function (p) { return h('li', { text: p }); }))) : null);
    }
    load();
    return card;
  };
})();
