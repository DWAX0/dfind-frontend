/* 정보 한 건 자세히 (?key=emedi_post:12 …)
   출처·날짜 → 제목 → 본문(바로 아래) → 항목 → 첨부파일(원본 내려받기 · 파일 내용 보기(엑셀은 표) · 지난 파일과 비교) */
(async function () {
  'use strict';
  var main = await D.boot('item');
  if (!main) return;
  var h = D.h;
  var key = new URLSearchParams(location.search).get('key');
  var SRC = { emedi_post: 'emedi', mfds_post: 'mfds', neca_post: 'neca' };
  var EXT = { pdf: 'PDF', hwp: '한글', hwpx: '한글', xlsx: '엑셀', xls: '엑셀', xlsm: '엑셀', docx: '워드', doc: '워드', zip: '압축', pptx: 'PPT', txt: '글', csv: 'CSV' };
  var ROWS_STEP = 300;
  function back() { return h('button', { type: 'button', class: 'btn small', onclick: function () { if (history.length > 1) history.back(); else location.href = 'index.html'; } }, D.svg('M15 5l-7 7 7 7', 20), '목록으로'); }
  if (!key) { D.set(main, back(), D.empty('보여줄 정보를 고르지 않았습니다.')); return; }
  D.set(main, D.loading());
  var it;
  try { it = await D.rpc('dash_item', { p_key: key }); } catch (e) { D.set(main, back(), D.fail(e)); return; }
  if (!it) { D.set(main, back(), D.empty('정보를 찾을 수 없습니다. (네이버 기사는 20일이 지나면 지워집니다)')); return; }
  var source = SRC[key.split(':')[0]] || (key.indexOf('mfds_innov:') === 0 ? 'mfds' : null);

  function original(big) {
    if (!it.url) return null;
    return h('a', { class: 'btn' + (big ? ' primary' : ' small'), href: it.url, target: '_blank', rel: 'noopener noreferrer' },
      D.svg('M14 4h6v6M20 4l-9 9M18 14v6H4V6h6', 20), '원본 보기 (' + (it.source_label || '원본 사이트') + ')');
  }

  /* 본문: 같은 문단이 두 번 들어온 경우(요약 + 본문 등) 한 번만 */
  function dedupeBody(text) {
    var seen = [], out = [];
    D.clean(text).split(/\n/).forEach(function (line) {
      var n = line.replace(/\s+/g, ' ').trim();
      if (!n) { if (out.length && out[out.length - 1] !== '') out.push(''); return; }
      var dup = n.length >= 8 && seen.some(function (s) { return s === n || (n.length >= 30 && s.indexOf(n) >= 0); });
      if (dup) return;
      seen.push(n); out.push(line.trim());
    });
    return out.join('\n').trim();
  }

  // ---- 표 (엑셀 모양) --------------------------------------------------------
  function isTable(a, text) {
    var ext = extOf(a);
    if (['xlsx', 'xls', 'xlsm', 'csv'].indexOf(ext) < 0) return false;
    var lines = text.split('\n').filter(Boolean);
    var tabbed = lines.filter(function (l) { return l.indexOf('\t') >= 0; }).length;
    return tabbed >= Math.max(1, lines.length * 0.3);
  }
  function parseSheets(text) {
    var sheets = [], cur = null;
    text.split('\n').forEach(function (line) {
      var m = /^\[(.+)\]$/.exec(line);
      if (m && line.indexOf('\t') < 0) { cur = { name: m[1], rows: [] }; sheets.push(cur); return; }
      if (!line.trim()) return;
      if (!cur) { cur = { name: '시트1', rows: [] }; sheets.push(cur); }
      cur.rows.push(line.split('\t'));
    });
    return sheets.filter(function (s) { return s.rows.length; });
  }
  function colName(i) { var s = ''; i += 1; while (i > 0) { var m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }
  function grid(sheet) {
    var width = sheet.rows.reduce(function (m, r) { return Math.max(m, r.length); }, 0);
    var shown = Math.min(sheet.rows.length, ROWS_STEP);
    var tbody = h('tbody');
    var wrap = h('div', { class: 'sheet-wrap' });
    function addRows(from, to) {
      for (var i = from; i < to; i++) {
        var r = sheet.rows[i], tds = [h('th', { scope: 'row', class: 'rn', text: i + 1 })];
        for (var j = 0; j < width; j++) tds.push(h('td', { text: r[j] || '' }));
        tbody.appendChild(h('tr', null, tds));
      }
    }
    addRows(0, shown);
    var cols = [h('th', { class: 'rn corner' })];
    for (var j = 0; j < width; j++) cols.push(h('th', { scope: 'col', text: colName(j) }));
    var more = sheet.rows.length > shown ? h('button', { type: 'button', class: 'btn small', text: '아래 ' + ROWS_STEP + '줄 더 보기 (전체 ' + D.num(sheet.rows.length) + '줄)',
      onclick: function (e) { var to = Math.min(sheet.rows.length, shown + ROWS_STEP); addRows(shown, to); shown = to; if (shown >= sheet.rows.length) e.currentTarget.remove(); else e.currentTarget.textContent = '아래 ' + ROWS_STEP + '줄 더 보기 (' + D.num(shown) + ' / ' + D.num(sheet.rows.length) + '줄)'; } }) : null;
    D.set(wrap, h('table', { class: 'sheet' }, h('thead', null, h('tr', null, cols)), tbody));
    return h('div', null, wrap, more);
  }
  function tableView(text) {
    var sheets = parseSheets(text);
    var box = h('div');
    if (sheets.length === 1) return D.set(box, grid(sheets[0]));
    var body = h('div');
    var tabs = h('div', { class: 'tabs sheet-tabs', role: 'tablist' }, sheets.map(function (s, i) {
      return h('button', { type: 'button', class: 'tab', role: 'tab', 'aria-selected': i === 0 ? 'true' : 'false', text: s.name + ' (' + D.num(s.rows.length) + '줄)',
        onclick: function (e) { tabs.querySelectorAll('.tab').forEach(function (t) { t.setAttribute('aria-selected', 'false'); }); e.currentTarget.setAttribute('aria-selected', 'true'); D.set(body, grid(s)); } });
    }));
    D.set(body, grid(sheets[0]));
    return D.set(box, tabs, body);
  }

  // ---- 지난 파일과 비교 (규칙: 열쇠 열로 줄을 맞춰 추가·삭제·변경) -------------
  function headerIndex(rows) {
    var max = rows.slice(0, 15).reduce(function (m, r) { return Math.max(m, r.filter(Boolean).length); }, 0);
    for (var i = 0; i < Math.min(rows.length, 15); i++) if (rows[i].filter(Boolean).length >= Math.max(2, max * 0.6)) return i;
    return 0;
  }
  function pickKey(header, a, b) {
    var all = a.concat(b), best = -1, bestScore = 0;
    for (var j = 0; j < header.length; j++) {
      var vals = all.map(function (r) { return (r[j] || '').trim(); }).filter(Boolean);
      if (vals.length < all.length * 0.9) continue;
      var uniqA = new Set(a.map(function (r) { return r[j]; })).size / Math.max(1, a.length);
      var uniqB = new Set(b.map(function (r) { return r[j]; })).size / Math.max(1, b.length);
      var u = Math.min(uniqA, uniqB);
      var bonus = /번호|코드|no\b|일련|허가|승인|지정/i.test(header[j] || '') ? 0.05 : 0;
      if (u >= 0.98 && u + bonus > bestScore) { best = j; bestScore = u + bonus; }
    }
    return best;
  }
  function diffRows(oldRows, newRows) {
    var tabbed = newRows.some(function (r) { return r.length > 1; });
    if (!tabbed) { // 예전에 모은 파일: 칸 정보가 없어 줄 단위로만
      var count = {};
      oldRows.forEach(function (r) { var k = r.join(' '); count[k] = (count[k] || 0) + 1; });
      var added = [];
      newRows.forEach(function (r) { var k = r.join(' '); if (count[k]) count[k] -= 1; else added.push(r); });
      var removed = [];
      Object.keys(count).forEach(function (k) { for (var i = 0; i < count[k]; i++) removed.push([k]); });
      return { header: null, key: -1, added: added, removed: removed, changed: [] };
    }
    var hi = headerIndex(newRows), header = newRows[hi] || [];
    var ohi = headerIndex(oldRows);
    var a = oldRows.slice(ohi + 1), b = newRows.slice(hi + 1);
    var k = pickKey(header, a, b);
    if (k < 0) {
      var r = diffRows(a.map(function (x) { return [x.join('\t')]; }), b.map(function (x) { return [x.join('\t')]; }));
      r.header = header; r.added = r.added.map(function (x) { return x[0].split('\t'); }); r.removed = r.removed.map(function (x) { return x[0].split('\t'); });
      return r;
    }
    var om = new Map();
    a.forEach(function (row) { if (!om.has(row[k])) om.set(row[k], row); });
    var nm = new Set(), res = { header: header, key: k, added: [], removed: [], changed: [] };
    b.forEach(function (row) {
      nm.add(row[k]);
      var old = om.get(row[k]);
      if (!old) { res.added.push(row); return; }
      var cells = [];
      for (var j = 0; j < Math.max(row.length, old.length); j++) {
        if ((row[j] || '').trim() !== (old[j] || '').trim()) cells.push({ col: header[j] || colName(j), from: old[j] || '', to: row[j] || '' });
      }
      if (cells.length) res.changed.push({ row: row, cells: cells });
    });
    a.forEach(function (row) { if (!nm.has(row[k])) res.removed.push(row); });
    return res;
  }
  function rowLabel(row, d) {
    var name = row.filter(function (c, j) { return c && j !== d.key && !/^\d+$/.test(c.trim()); }).slice(0, 2).join(' · ');
    return (d.key >= 0 ? (d.header[d.key] || '번호') + ' ' + row[d.key] + ' ' : '') + (name ? '(' + name.slice(0, 60) + ')' : '');
  }
  function diffTable(d, rows, kind) {
    if (!rows.length) return null;
    var head = d.header && kind !== 'changed' ? d.header : null;
    var limit = 200;
    return h('details', { class: 'diff-part', open: rows.length <= 20 },
      h('summary', { text: { added: '새로 생긴 줄', removed: '없어진 줄', changed: '내용이 바뀐 줄' }[kind] + ' ' + D.num(rows.length) + '개' }),
      h('div', { class: 'sheet-wrap' }, h('table', { class: 'sheet diff-' + kind },
        kind === 'changed'
          ? [h('thead', null, h('tr', null, h('th', { text: '줄' }), h('th', { text: '바뀐 칸' }), h('th', { text: '이전' }), h('th', { text: '지금' }))),
            h('tbody', null, rows.slice(0, limit).map(function (c) {
              return c.cells.map(function (x, i) {
                return h('tr', null, i === 0 ? h('td', { rowspan: c.cells.length, text: rowLabel(c.row, d) }) : null,
                  h('td', { text: x.col }), h('td', { class: 'from', text: x.from }), h('td', { class: 'to', text: x.to }));
              });
            }))]
          : [head ? h('thead', null, h('tr', null, head.map(function (x) { return h('th', { text: x }); }))) : null,
            h('tbody', null, rows.slice(0, limit).map(function (r) { return h('tr', null, r.map(function (x) { return h('td', { text: x }); })); }))])),
      rows.length > limit ? h('p', { class: 'note', text: '앞 ' + limit + '개만 표시했습니다.' }) : null);
  }
  async function compare(a, box, btn) {
    btn.disabled = true;
    D.set(box, D.loading());
    try {
      var res = await Promise.all([fullText(a), D.rpc('dash_attachment_text', { p_source: source, p_attachment_id: a.prev_id })]);
      var cur = parseSheets(res[0] || ''), old = parseSheets(res[1] || '');
      var parts = cur.map(function (s, i) {
        var o = old.filter(function (x) { return x.name === s.name; })[0] || old[i] || { rows: [] };
        return { name: s.name, d: diffRows(o.rows, s.rows) };
      });
      var tot = parts.reduce(function (t, p) { t.a += p.d.added.length; t.r += p.d.removed.length; t.c += p.d.changed.length; return t; }, { a: 0, r: 0, c: 0 });
      var lines = [];
      parts.forEach(function (p) {
        var pre = parts.length > 1 ? '[' + p.name + '] ' : '';
        if (p.d.added.length) lines.push(pre + '새로 추가 ' + p.d.added.length + '개: ' + p.d.added.slice(0, 3).map(function (r) { return rowLabel(r, p.d); }).join(', ') + (p.d.added.length > 3 ? ' 외' : ''));
        if (p.d.removed.length) lines.push(pre + '빠짐 ' + p.d.removed.length + '개: ' + p.d.removed.slice(0, 3).map(function (r) { return rowLabel(r, p.d); }).join(', ') + (p.d.removed.length > 3 ? ' 외' : ''));
        if (p.d.changed.length) {
          var cols = {};
          p.d.changed.forEach(function (c) { c.cells.forEach(function (x) { cols[x.col] = (cols[x.col] || 0) + 1; }); });
          lines.push(pre + '내용 변경 ' + p.d.changed.length + '개 (' + Object.keys(cols).sort(function (x, y) { return cols[y] - cols[x]; }).slice(0, 4).map(function (c) { return c + ' ' + cols[c]; }).join(', ') + ')');
        }
      });
      D.set(box,
        h('div', { class: 'diff-summary' },
          h('p', null, h('b', { text: '지난 파일(' + D.fmt(a.prev_post_date) + ' 게시 · ' + a.prev_file_name + ') 대비' })),
          h('p', { class: 'diff-count' }, D.badge('추가 ' + tot.a, 'ok'), ' ', D.badge('빠짐 ' + tot.r, 'bad'), ' ', D.badge('변경 ' + tot.c, 'warn')),
          lines.length ? h('ul', null, lines.map(function (l) { return h('li', { text: l }); })) : h('p', { text: '달라진 내용이 없습니다.' }),
          h('p', { class: 'note', text: '규칙으로 줄을 맞춰 비교한 결과입니다' + (parts.some(function (p) { return !p.d.header; }) ? ' (예전에 모은 파일이라 칸 구분 없이 줄 단위로 비교)' : '') + '. 문장으로 된 AI 요약은 2단계(Claude API)에서 붙입니다.' })),
        parts.map(function (p) {
          return [parts.length > 1 ? h('h3', { text: p.name }) : null, diffTable(p.d, p.d.added, 'added'), diffTable(p.d, p.d.removed, 'removed'), diffTable(p.d, p.d.changed, 'changed')];
        }));
    } catch (e) { D.set(box, D.fail(e)); }
    btn.disabled = false;
  }

  function extOf(a) { return (a.file_extension || (a.file_name || '').split('.').pop() || '').toLowerCase(); }
  async function fullText(a) {
    if (a.text_length > (a.text || '').length && source) return D.rpc('dash_attachment_text', { p_source: source, p_attachment_id: a.attachment_id });
    return a.text;
  }
  function attachment(a) {
    var ext = extOf(a);
    var hasText = a.text && a.text.trim();
    var view = h('div');
    var diffBox = h('div', { class: 'diff', hidden: true });
    var kids = [
      h('div', { class: 'att-head' },
        D.badge(EXT[ext] || ext.toUpperCase() || '파일', 'gray'),
        h('b', { class: 'att-name', text: a.file_name }),
        h('span', { class: 'chips right' },
          a.download_url ? h('a', { class: 'btn small', href: a.download_url, target: '_blank', rel: 'noopener noreferrer' }, D.svg('M12 4v11M7 10l5 5 5-5M5 20h14', 18), '원본 내려받기') : null))
    ];
    if (hasText) {
      var table = isTable(a, a.text);
      var det = h('details', { class: 'att-text' },
        h('summary', { text: '파일 내용 보기' + (table ? ' (표)' : '') + ' · ' + D.num(a.text_length) + '자' }), view);
      det.addEventListener('toggle', async function () {
        if (!det.open || view.childNodes.length) return;
        D.set(view, D.loading());
        var text = a.text;
        try { if (table) text = await fullText(a); } catch (e) { console.error(e); }
        D.set(view, table ? tableView(text) : h('pre', { class: 'doc-text', text: text }),
          !table && a.text_length > a.text.length ? h('p', { class: 'note', text: '앞 10만 자만 표시했습니다. 전체는 원본을 내려받아 확인해 주세요.' }) : null);
      });
      kids.push(det);
      if (!table && ['xlsx', 'xls', 'xlsm'].indexOf(ext) >= 0) kids.push(h('p', { class: 'note', text: '예전에 모은 엑셀이라 칸 구분이 없어 글자로 보여 줍니다. (관리자가 crawl-manual › reextract_xlsx 를 한 번 돌리면 표로 보입니다)' }));
    } else {
      kids.push(h('p', { class: 'note', text: a.extract_status === 'success' ? '글자가 없는 파일입니다.' : '이 파일은 글자를 뽑지 못했습니다 (그림·암호 등). 원본을 내려받아 확인해 주세요.' }));
    }
    if (a.prev_id && hasText && source) {
      var btn = h('button', { type: 'button', class: 'btn small', onclick: function () {
        diffBox.hidden = !diffBox.hidden;
        btn.setAttribute('aria-expanded', diffBox.hidden ? 'false' : 'true');
        if (!diffBox.hidden && !diffBox.childNodes.length) compare(a, diffBox, btn);
      }, 'aria-expanded': 'false' }, D.svg('M7 4v16M17 4v16M3 8h8M13 16h8', 18), '지난 파일과 비교 (' + D.fmt(a.prev_post_date) + ' 게시본)');
      kids.push(h('div', { class: 'chips' }, btn), diffBox);
    }
    return h('div', { class: 'att' + (a.parent_attachment_id ? ' child' : '') }, kids);
  }

  // 뉴스: 어떤 키워드로 수집·매칭됐는지
  var kwLine = h('p', { class: 'sub kw-line' });
  if (/^news:/.test(key)) D.loadNewsKeywords([{ item_key: key }]).then(function (by) {
    var list = by[key] || [];
    D.set(kwLine, '키워드: ', list.length ? D.keywordChips(list, 10) : '없음',
      list.some(function (k) { return k.how === 'search'; }) ? h('span', { class: 'note', text: ' (진한 칸 = 이 키워드로 검색해서 수집)' }) : null);
  });
  var fields = (it.fields || []).filter(function (f) { return f.value !== null && f.value !== ''; });
  var body = it.body && it.body.trim() ? dedupeBody(it.body) : '';
  var atts = it.attachments || [];
  D.set(main,
    h('div', { class: 'chips' }, back(), original(false)),
    h('article', { class: 'card item-card' },
      h('div', { class: 'list-meta' }, D.catBadge(it.category, it.kind), h('span', { text: [it.source_label, D.fmt(it.item_date)].filter(Boolean).join(' · ') }),
        D.favButton('item', key, D.clean(it.title), { text: true, right: true })),
      h('h1', { class: 'item-title', text: D.clean(it.title) || '(제목 없음)' }),
      it.company && it.company.name ? h('p', { class: 'sub' }, '기업: ', D.companyLink(it.company.id, it.company.name)) : null,
      /^news:/.test(key) ? kwLine : null,
      body ? h('div', { class: 'doc-body', text: body }) : null,
      fields.length ? h('dl', { class: 'info item-fields' }, fields.map(function (f) { return [h('dt', { text: f.label }), h('dd', { text: String(f.value) })]; })) : null,
      it.note ? h('p', { class: 'notice info', text: it.note }) : null),
    atts.length ? h('section', { class: 'card' }, h('h2', null, '첨부파일 ', h('span', { class: 'note', text: atts.length + '개' })), atts.map(attachment)) : null,
    (it.related || []).length ? h('section', { class: 'card' }, h('h2', { text: '관련' }), it.related.map(function (r) {
      return h('p', null, r.url ? h('a', { href: r.url, target: '_blank', rel: 'noopener noreferrer', text: r.label }) : r.label);
    })) : null,
    it.url ? h('div', { class: 'chips' }, original(true)) : null);
  document.title = (D.clean(it.title) || '정보') + ' · D*Find';
})();
