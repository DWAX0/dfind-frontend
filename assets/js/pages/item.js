/* 정보 한 건 자세히 (?key=emedi_post:12 …): 본문 · 첨부파일(내용 보기·내려받기) · 원본 보기
   목록 어디서든 제목을 누르면 이 화면으로 옴 */
(async function () {
  'use strict';
  var main = await D.boot('item');
  if (!main) return;
  var h = D.h;
  var key = new URLSearchParams(location.search).get('key');
  var EXT = { pdf: 'PDF', hwp: '한글', hwpx: '한글', xlsx: '엑셀', xls: '엑셀', docx: '워드', doc: '워드', zip: '압축', pptx: 'PPT', txt: '글' };
  function back() { return h('button', { type: 'button', class: 'btn small', onclick: function () { if (history.length > 1) history.back(); else location.href = 'index.html'; } }, D.svg('M15 5l-7 7 7 7', 20), '목록으로'); }
  if (!key) { D.set(main, back(), D.empty('보여줄 정보를 고르지 않았습니다.')); return; }
  D.set(main, D.loading());
  var it;
  try { it = await D.rpc('dash_item', { p_key: key }); } catch (e) { D.set(main, back(), D.fail(e)); return; }
  if (!it) { D.set(main, back(), D.empty('정보를 찾을 수 없습니다. (네이버 기사는 20일이 지나면 지워집니다)')); return; }

  function original(big) {
    if (!it.url) return null;
    return h('a', { class: 'btn' + (big ? ' primary' : ' small'), href: it.url, target: '_blank', rel: 'noopener noreferrer' },
      D.svg('M14 4h6v6M20 4l-9 9M18 14v6H4V6h6', 20), '원본 보기 (' + (it.source_label || '원본 사이트') + ')');
  }
  async function download(a, btn) {
    btn.disabled = true;
    try {
      var r = await D.sb.storage.from('attachments').createSignedUrl(a.storage_path, 600, { download: a.file_name });
      if (r.error) throw r.error;
      location.href = r.data.signedUrl;
    } catch (e) { alert('내려받지 못했습니다: ' + (e.message || e) + (a.download_url ? '\n원본 사이트 링크로 받아 주세요.' : '')); }
    btn.disabled = false;
  }
  function attachment(a) {
    var ext = (a.file_extension || (a.file_name || '').split('.').pop() || '').toLowerCase();
    var hasText = a.text && a.text.trim();
    var kids = [
      h('div', { class: 'att-head' },
        D.badge(EXT[ext] || ext.toUpperCase() || '파일', 'gray'),
        h('b', { class: 'att-name', text: a.file_name }),
        h('span', { class: 'chips right' },
          a.storage_path ? h('button', { type: 'button', class: 'btn small', text: '내려받기', onclick: function (e) { download(a, e.currentTarget); } }) : null,
          a.download_url ? h('a', { class: 'btn small', href: a.download_url, target: '_blank', rel: 'noopener noreferrer', text: '원본 사이트에서 받기' }) : null))
    ];
    if (hasText) {
      kids.push(h('details', { class: 'att-text' },
        h('summary', { text: '파일 내용 보기 (' + D.num(a.text_length) + '자' + (a.text_length > 100000 ? ', 앞 10만 자만 표시' : '') + ')' }),
        h('pre', { class: 'doc-text', text: a.text })));
    } else {
      kids.push(h('p', { class: 'note', text: a.extract_status === 'success' ? '글자가 없는 파일입니다.' : '이 파일은 글자를 뽑지 못했습니다 (그림·암호 등). 내려받아 확인해 주세요.' }));
    }
    return h('div', { class: 'att' + (a.parent_attachment_id ? ' child' : '') }, kids);
  }

  var fields = (it.fields || []).filter(function (f) { return f.value !== null && f.value !== ''; });
  D.set(main,
    h('div', { class: 'chips' }, back(), original(false)),
    h('header', { class: 'card' },
      h('div', { class: 'list-meta' }, D.catBadge(it.category, it.kind), h('span', { text: [D.fmt(it.item_date), it.source_label].filter(Boolean).join(' · ') })),
      h('h1', { class: 'item-title', text: D.clean(it.title) || '(제목 없음)' }),
      it.company && it.company.name ? h('p', { class: 'sub' }, '기업: ', D.companyLink(it.company.id, it.company.name)) : null,
      fields.length ? h('dl', { class: 'info' }, fields.map(function (f) { return [h('dt', { text: f.label }), h('dd', { text: String(f.value) })]; })) : null),
    it.body && it.body.trim() ? h('section', { class: 'card' }, h('h2', { text: it.body_label || '내용' }), h('div', { class: 'doc-body', text: D.clean(it.body) })) : null,
    it.note ? h('p', { class: 'notice info', text: it.note }) : null,
    (it.attachments || []).length ? h('section', { class: 'card' }, h('h2', null, '첨부파일 ', h('span', { class: 'note', text: it.attachments.length + '개' })),
      it.attachments.map(attachment)) : null,
    (it.related || []).length ? h('section', { class: 'card' }, h('h2', { text: '관련' }), it.related.map(function (r) {
      return h('p', null, r.url ? h('a', { href: r.url, target: '_blank', rel: 'noopener noreferrer', text: r.label }) : r.label);
    })) : null,
    it.url ? h('div', { class: 'chips' }, original(true)) : null);
  document.title = (D.clean(it.title) || '정보') + ' · D*Find';
})();
