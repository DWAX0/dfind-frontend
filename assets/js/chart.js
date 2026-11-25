/* 작은 선 그래프 (SVG) — 기업 상세에서 씀
   선 2px · 점 8px · 옅은 눈금 · 마우스를 올리면 그 칸 값 모두 표시 · 색만으로 구분하지 않게 범례·표 함께 */
(function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  function s(tag, attrs) {
    var el = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(function (k) { el.setAttribute(k, attrs[k]); });
    return el;
  }
  function nice(max) {
    if (max <= 4) return 4;
    var p = Math.pow(10, Math.floor(Math.log10(max))), m = max / p;
    return (m <= 2 ? 2 : m <= 5 ? 5 : 10) * p;
  }
  /* o: { labels: [...], series: [{ name, values, cls }], title, unit } */
  D.lineChart = function (o) {
    var W = 560, H = o.height || 210, L = 34, R = 14, T = 14, B = 30;
    var max = nice(Math.max.apply(null, [1].concat(o.series.map(function (x) { return Math.max.apply(null, x.values); }))));
    var n = o.labels.length;
    var xs = function (i) { return L + (n === 1 ? (W - L - R) / 2 : i * (W - L - R) / (n - 1)); };
    var ys = function (v) { return T + (H - T - B) * (1 - v / max); };
    var svg = s('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'chart', role: 'img', 'aria-label': o.title || '' });
    [0, 0.5, 1].forEach(function (f) {
      var y = ys(max * f);
      svg.appendChild(s('line', { x1: L, x2: W - R, y1: y, y2: y, class: f === 0 ? 'axis' : 'gridline' }));
      var t = s('text', { x: L - 6, y: y + 4, class: 'tick', 'text-anchor': 'end' }); t.textContent = Math.round(max * f); svg.appendChild(t);
    });
    var step = Math.ceil(n / 8);
    o.labels.forEach(function (lb, i) {
      if (i % step && i !== n - 1) return;
      var t = s('text', { x: xs(i), y: H - 10, class: 'tick', 'text-anchor': 'middle' }); t.textContent = lb; svg.appendChild(t);
    });
    var guide = s('line', { y1: T, y2: H - B, class: 'guide', visibility: 'hidden' });
    svg.appendChild(guide);
    var dots = [];
    o.series.forEach(function (sr) {
      svg.appendChild(s('polyline', { points: sr.values.map(function (v, i) { return xs(i) + ',' + ys(v); }).join(' '), class: 'line ' + sr.cls }));
      dots.push(sr.values.map(function (v, i) { var c = s('circle', { cx: xs(i), cy: ys(v), r: 4, class: 'dot-pt ' + sr.cls }); svg.appendChild(c); return c; }));
    });
    var tip = D.h('div', { class: 'chart-tip', hidden: true });
    var box = D.h('figure', { class: 'chart-box' }, o.title ? D.h('figcaption', { class: 'chart-title', text: o.title }) : null, D.h('div', { class: 'chart-area' }, svg, tip),
      o.series.length > 1 ? D.h('div', { class: 'legend' }, o.series.map(function (sr) { return D.h('span', null, D.h('i', { class: 'sw ' + sr.cls }), sr.name); })) : null);
    function show(i) {
      guide.setAttribute('x1', xs(i)); guide.setAttribute('x2', xs(i)); guide.setAttribute('visibility', 'visible');
      dots.forEach(function (d) { d.forEach(function (c, j) { c.setAttribute('r', j === i ? 6 : 4); }); });
      D.set(tip, D.h('b', { text: o.labels[i] }), o.series.map(function (sr) {
        return D.h('span', null, D.h('i', { class: 'sw ' + sr.cls }), sr.name + ' ' + sr.values[i] + (o.unit || ''));
      }));
      tip.hidden = false;
      var px = xs(i) / W * 100;
      tip.style.left = Math.min(Math.max(px, 15), 85) + '%';
    }
    function hide() { guide.setAttribute('visibility', 'hidden'); tip.hidden = true; dots.forEach(function (d) { d.forEach(function (c) { c.setAttribute('r', 4); }); }); }
    svg.addEventListener('mousemove', function (e) {
      var r = svg.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * W;
      var i = n === 1 ? 0 : Math.round((x - L) / ((W - L - R) / (n - 1)));
      show(Math.max(0, Math.min(n - 1, i)));
    });
    svg.addEventListener('mouseleave', hide);
    return box;
  };
  /* 묶음 막대 (연도별 허가·지정·임상): 칸마다 막대 여러 개, 막대 사이 2px, 위쪽만 둥글게, 마우스를 올리면 그 칸 값 모두 */
  D.barChart = function (o) {
    var W = o.width || 640, H = o.height || 230, L = 34, R = 10, T = 14, B = 30;
    var max = nice(Math.max.apply(null, [1].concat(o.series.map(function (x) { return Math.max.apply(null, x.values); }))));
    var n = o.labels.length, k = o.series.length;
    var band = (W - L - R) / n, inner = band * 0.72, bw = Math.max(4, (inner - (k - 1) * 2) / k);
    var ys = function (v) { return T + (H - T - B) * (1 - v / max); };
    var svg = s('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'chart', role: 'img', 'aria-label': o.title || '' });
    [0, 0.5, 1].forEach(function (f) {
      var y = ys(max * f);
      svg.appendChild(s('line', { x1: L, x2: W - R, y1: y, y2: y, class: f === 0 ? 'axis' : 'gridline' }));
      var t = s('text', { x: L - 6, y: y + 4, class: 'tick', 'text-anchor': 'end' }); t.textContent = Math.round(max * f); svg.appendChild(t);
    });
    var hover = s('rect', { y: T, height: H - T - B, width: band, class: 'band', visibility: 'hidden' });
    svg.appendChild(hover);
    o.labels.forEach(function (lb, i) {
      var x0 = L + i * band + (band - (k * bw + (k - 1) * 2)) / 2;
      o.series.forEach(function (sr, j) {
        var v = sr.values[i], y = ys(v), hgt = Math.max(0, H - B - y);
        if (v > 0) {
          var r = Math.min(4, bw / 2, hgt);
          var x = x0 + j * (bw + 2);
          svg.appendChild(s('path', { class: 'bar ' + sr.cls,
            d: 'M' + x + ',' + (H - B) + 'V' + (y + r) + 'Q' + x + ',' + y + ' ' + (x + r) + ',' + y + 'H' + (x + bw - r) + 'Q' + (x + bw) + ',' + y + ' ' + (x + bw) + ',' + (y + r) + 'V' + (H - B) + 'Z' }));
        }
      });
      var t = s('text', { x: L + i * band + band / 2, y: H - 10, class: 'tick', 'text-anchor': 'middle' }); t.textContent = lb; svg.appendChild(t);
    });
    var tip = D.h('div', { class: 'chart-tip', hidden: true });
    svg.addEventListener('mousemove', function (e) {
      var r = svg.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * W;
      var i = Math.floor((x - L) / band);
      if (i < 0 || i >= n) { hover.setAttribute('visibility', 'hidden'); tip.hidden = true; return; }
      hover.setAttribute('x', L + i * band); hover.setAttribute('visibility', 'visible');
      D.set(tip, D.h('b', { text: o.labels[i] }), o.series.map(function (sr) { return D.h('span', null, D.h('i', { class: 'sw ' + sr.cls }), sr.name + ' ' + sr.values[i] + (o.unit || '')); }));
      tip.hidden = false;
      tip.style.left = Math.min(Math.max((L + i * band + band / 2) / W * 100, 15), 85) + '%';
    });
    svg.addEventListener('mouseleave', function () { hover.setAttribute('visibility', 'hidden'); tip.hidden = true; });
    return D.h('figure', { class: 'chart-box' }, o.title ? D.h('figcaption', { class: 'chart-title', text: o.title }) : null,
      D.h('div', { class: 'chart-area' }, svg, tip),
      D.h('div', { class: 'legend' }, o.series.map(function (sr) { return D.h('span', null, D.h('i', { class: 'sw ' + sr.cls }), sr.name + ' ' + sr.values.reduce(function (a, b) { return a + b; }, 0) + (o.unit || '')); })));
  };
  /* 작은 막대 (KPI 칸 안): 값 목록 → 높이 */
  D.miniBars = function (values, labels, fixedMax) {
    var max = fixedMax || Math.max.apply(null, [1].concat(values));
    return D.h('span', { class: 'mini-bars', 'aria-hidden': 'true' }, values.map(function (v, i) {
      var b = D.h('span', { title: (labels ? labels[i] + ': ' : '') + v });
      b.style.height = Math.max(6, v / max * 100) + '%';
      if (!v) b.className = 'zero';
      return b;
    }));
  };
})();
