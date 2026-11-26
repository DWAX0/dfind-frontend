/* 심사검토 결과 원문·요약 팝업 (인허가·제도 › 디지털의료기기 정보방, 기업 정보 › 허가 제품 같이 씀)
   - 요약: 문서 글자에서 항목 이름(제품명·사용목적·작용원리·심사 결과 등)을 찾아 옮김
     짧은 항목(제품명·모델명·업체명·등급)은 표 한 칸씩, 긴 항목은 문단·목록으로 나눠 읽기 쉽게
   - [원문 미리보기] 버튼을 눌러야 문서를 띄움 (PDF 는 화면 안에서, 그 밖은 뽑은 글자)
   - [내려받기] 저장된 첨부 파일을 그대로 받음
   r = { review_post_id, product_name, permit_number } */
(function () {
  'use strict';
  var h = D.h;
  var SHORT = { '제품명': 1, '모델명': 1, '업체명': 1, '분류·등급': 1 };
  var SUM_KEYS = [['제품명', '제\\s*품\\s*명|품\\s*명'], ['모델명', '모\\s*델\\s*명'], ['업체명', '업\\s*체\\s*명|제조\\s*(?:수입)?\\s*업자'],
    ['분류·등급', '분\\s*류\\s*번\\s*호|등\\s*급'], ['사용목적', '사\\s*용\\s*목\\s*적'], ['작용원리', '작\\s*용\\s*원\\s*리'],
    ['주요 성능', '(?:주요\\s*)?성\\s*능(?:\\s*및\\s*안전성)?'], ['임상 자료', '임\\s*상(?:\\s*시험)?(?:\\s*자료)?'],
    ['심사 결과', '심\\s*사\\s*(?:결\\s*과|의\\s*견|요\\s*지)|종\\s*합\\s*(?:의견|결론)|결\\s*론']];

  /* [[항목, 내용(최대 1200자)], …] 문서에 나온 순서 */
  D.summarizeReview = function (text) {
    if (!text) return [];
    var t = text.replace(/\r/g, '');
    var hits = [];
    SUM_KEYS.forEach(function (k) {
      var re = new RegExp('(?:^|\\n)\\s*(?:\\d+\\s*[.)]|[가-하]\\s*[.)]|[-·•□○▶])?\\s*(' + k[1] + ')\\s*[:：]?', 'm');
      var m = re.exec(t);
      if (m) hits.push({ label: k[0], at: m.index, end: m.index + m[0].length });
    });
    hits.sort(function (a, b) { return a.at - b.at; });
    var out = [];
    hits.forEach(function (x, i) {
      var nextAt = i + 1 < hits.length ? hits[i + 1].at : x.end + 1500;
      var v = t.slice(x.end, Math.min(nextAt, x.end + 1500)).replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
      if (v.replace(/\s/g, '').length >= 2) out.push([x.label, v.length > 1200 ? v.slice(0, 1200) + '…' : v]);
    });
    return out;
  };

  /* 긴 내용 → 문단·목록 (번호·기호로 시작하는 줄은 목록, 나머지는 문장 단위 문단) */
  function prose(v) {
    var lines = v.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
    var items = [], paras = [];
    lines.forEach(function (s) {
      if (/^(\d+\s*[.)]|[가-하]\s*[.)]|[-·•□○▶※])\s*/.test(s)) items.push(s.replace(/^(\d+\s*[.)]|[가-하]\s*[.)]|[-·•□○▶])\s*/, ''));
      else if (items.length && s.length < 40 && !/[.다]$/.test(items[items.length - 1])) items[items.length - 1] += ' ' + s;  // 줄바꿈으로 끊긴 목록 줄
      else paras.push(s);
    });
    var text = paras.join(' ');
    var sentences = text ? text.split(/(?<=[다음함됨임요]\.)\s+|(?<=\.)\s+(?=[가-힣A-Z(])/) : [];
    return [sentences.length ? sentences.map(function (x) { return h('p', { text: x }); }) : null,
      items.length ? h('ul', null, items.map(function (x) { return h('li', { text: x }); })) : null];
  }
  function block(label, v) {
    var long = v.length > 260;
    var body = h('div', { class: 'rv-prose' + (long ? ' clamp' : '') }, prose(v));
    var btn = long ? h('button', { type: 'button', class: 'link-btn', text: '전체 보기 ▾', onclick: function () {
      var open = body.classList.toggle('clamp'); btn.textContent = open ? '전체 보기 ▾' : '접기 ▴'; } }) : null;
    return h('section', { class: 'rv-block' }, h('h4', { text: label }), body, btn);
  }

  function saveBlob(data, name) {
    var u = URL.createObjectURL(data);
    var a = h('a', { href: u, download: name || 'document' });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(u); }, 4000);
  }

  D.openReview = async function (r) {
    var body = h('div', { class: 'dialog-body' }, D.loading());
    var name = String(r.product_name || '').replace(/\s+/g, ' ').trim();
    var dlg = h('dialog', { class: 'dialog wide review-dlg', 'aria-labelledby': 'rv-h' },
      h('div', { class: 'card-head' }, h('h2', { id: 'rv-h', text: '심사검토 결과 — ' + (name || r.permit_number || '') }),
        h('button', { type: 'button', class: 'btn small right', text: '닫기', onclick: function () { dlg.close(); } })), body);
    var urls = [];
    dlg.addEventListener('close', function () { urls.forEach(function (u) { URL.revokeObjectURL(u); }); dlg.remove(); });
    document.body.appendChild(dlg); dlg.showModal();
    var doc;
    try { doc = await D.rpc('dash_review_doc', { p_post_id: r.review_post_id }); } catch (e) { D.set(body, D.fail(e)); return; }
    if (!doc) { D.set(body, D.empty('글을 찾을 수 없습니다.')); return; }
    var files = doc.files || [];
    var text = files.map(function (f) { return f.text || ''; }).join('\n') || doc.content || '';
    var sum = D.summarizeReview(text);
    var short = sum.filter(function (x) { return SHORT[x[0]]; }), long = sum.filter(function (x) { return !SHORT[x[0]]; });

    // 원문 미리보기 (버튼을 눌러야 띄움)
    var viewer = h('div', { class: 'rv-viewer', hidden: true });
    var fileTabs = h('div', { class: 'chips' });
    function show(f) {
      fileTabs.querySelectorAll('.chip').forEach(function (b) { b.setAttribute('aria-pressed', b._f === f ? 'true' : 'false'); });
      var out = h('div');
      D.set(viewer, files.length > 1 ? fileTabs : null, out);
      if (f.ext === 'pdf' && f.storage_path) {
        D.set(out, D.loading('문서를 여는 중…'));
        D.sb.storage.from('attachments').download(f.storage_path).then(function (res) {
          if (res.error) throw res.error;
          var u = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' })); urls.push(u);
          D.set(out, h('iframe', { class: 'rv-frame', src: u, title: f.file_name }));
        }).catch(function () { showText(out, f, '저장된 파일을 열지 못해 뽑은 글자로 보여 줍니다.'); });
      } else showText(out, f, f.text ? 'PDF 가 아닌 문서라 글자만 보여 줍니다. 원본 서식은 내려받거나 원문 사이트에서 보세요.' : '');
    }
    function showText(out, f, note) {
      D.set(out, f.text ? [note ? h('p', { class: 'note', text: note }) : null, h('pre', { class: 'rv-text', text: f.text })]
        : D.empty('이 파일(' + (f.ext || '?') + ')은 화면에서 미리 볼 수 없습니다. 내려받거나 원문 사이트에서 봐 주세요.'));
    }
    D.set(fileTabs, files.map(function (f) { var b = h('button', { type: 'button', class: 'chip small', text: f.file_name, onclick: function () { show(f); } }); b._f = f; return b; }));
    var previewBtn = h('button', { type: 'button', class: 'btn small primary', text: '원문 미리보기', 'aria-expanded': 'false', onclick: function () {
      if (!viewer.hidden) { viewer.hidden = true; previewBtn.textContent = '원문 미리보기'; previewBtn.setAttribute('aria-expanded', 'false'); return; }
      viewer.hidden = false; previewBtn.textContent = '미리보기 닫기'; previewBtn.setAttribute('aria-expanded', 'true');
      if (files.length) show(files.filter(function (f) { return f.ext === 'pdf'; })[0] || files[0]);
      else D.set(viewer, doc.content ? h('pre', { class: 'rv-text', text: doc.content }) : D.empty('첨부 파일이 없습니다. 원문 사이트에서 확인해 주세요.'));
      viewer.scrollIntoView({ block: 'start', behavior: 'smooth' });
    } });
    var downloads = files.filter(function (f) { return f.storage_path; }).map(function (f) {
      return h('button', { type: 'button', class: 'btn small', title: f.file_name, text: '내려받기' + (files.length > 1 ? ' · ' + (f.ext || '').toUpperCase() : ''), onclick: async function (e) {
        var b = e.currentTarget; b.disabled = true;
        try { var res = await D.sb.storage.from('attachments').download(f.storage_path); if (res.error) throw res.error; saveBlob(res.data, f.file_name); }
        catch (er) { alert('내려받지 못했습니다. 원문 사이트에서 받아 주세요.'); }
        b.disabled = false;
      } });
    });

    D.set(body,
      h('div', { class: 'rv-meta' }, h('b', { text: doc.title }),
        h('span', { class: 'note', text: '게시일 ' + (doc.post_date || '–') + (r.permit_number ? ' · 허가·인증·신고번호 ' + r.permit_number : '') })),
      h('div', { class: 'rv-actions' }, previewBtn, downloads,
        doc.post_url ? h('a', { class: 'btn small', href: doc.post_url, target: '_blank', rel: 'noopener noreferrer', text: '원문 사이트 ↗' }) : null),
      h('section', { class: 'rv-sum', 'aria-label': '심사 결과 요약' },
        h('h3', { text: '요약' }),
        sum.length ? [
          short.length ? h('dl', { class: 'rv-facts' }, short.map(function (x) { return h('div', null, h('dt', { text: x[0] }), h('dd', { text: x[1].replace(/\s+/g, ' ').slice(0, 160) })); })) : null,
          long.map(function (x) { return block(x[0], x[1]); })]
          : h('p', { class: 'note', text: text ? '문서에서 항목을 찾지 못했습니다. 원문 미리보기로 봐 주세요.' : '첨부 문서의 글자를 아직 뽑지 못했습니다. 원문 미리보기나 원문 사이트에서 확인해 주세요.' }),
        h('p', { class: 'note small', text: '문서 글자에서 항목 이름을 찾아 자동으로 옮긴 것입니다. 정확한 내용은 원문을 확인하세요.' })),
      viewer);
  };
})();
