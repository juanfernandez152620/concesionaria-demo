/* =========================================================================
   Gráficos SVG livianos (sin dependencias) — barras, líneas, dona, ranking.
   Paleta categórica validada (orden fijo, nunca ciclado).
   ========================================================================= */
(function () {
  'use strict';
  const PAL = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'];
  const SEQ = ['#86b6ef', '#5598e7', '#2a78d6', '#1c5cab', '#104281'];
  const STATUS = { good: '#0ca30c', warning: '#fab219', serious: '#ec835a', critical: '#d03b3b' };
  const NS = 'http://www.w3.org/2000/svg';
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function mount(el, draw) {
    if (!el) return;
    el.classList.add('chart');
    let w = 0;
    const render = () => { w = el.clientWidth || 600; el.innerHTML = ''; draw(w); };
    render();
    if (el._ro) el._ro.disconnect();
    if (window.ResizeObserver) { el._ro = new ResizeObserver(() => { if (Math.abs((el.clientWidth || 0) - w) > 6) render(); }); el._ro.observe(el); }
  }
  function niceMax(v) {
    if (v <= 0) return 1;
    const p = Math.pow(10, Math.floor(Math.log10(v))); const n = v / p;
    const s = n <= 1 ? 1 : n <= 1.5 ? 1.5 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 3 ? 3 : n <= 4 ? 4 : n <= 5 ? 5 : n <= 6 ? 6 : n <= 8 ? 8 : 10;
    return s * p;
  }
  function tipFor(el) {
    el.style.position = 'relative';
    const t = document.createElement('div'); t.className = 'chart-tip'; el.appendChild(t);
    return {
      show(html, x, y) {
        t.innerHTML = html; t.classList.add('on');
        const W = el.clientWidth, tw = t.offsetWidth;
        let left = x + 14; if (left + tw > W) left = x - tw - 14; if (left < 0) left = 0;
        t.style.left = left + 'px'; t.style.top = Math.max(0, y - 10) + 'px';
      },
      hide() { t.classList.remove('on'); }
    };
  }
  const rows = (title, list, fmt) => '<b>' + esc(title) + '</b>' + list.map((s) => '<div><i style="background:' + s.color + '"></i>' + esc(s.name) + '<span>' + esc(fmt(s.value)) + '</span></div>').join('');
  function legend(series) {
    if (series.length < 2) return '';
    return '<div class="chart-legend">' + series.map((s) => '<span><i style="background:' + s.color + '"></i>' + esc(s.name) + '</span>').join('') + '</div>';
  }
  // rectángulo con esquinas superiores redondeadas (extremo de dato), base recta
  function rtop(x, y, w, h, r) {
    if (h <= 0) return '';
    r = Math.min(r, w / 2, h);
    return 'M' + x + ',' + (y + h) + 'V' + (y + r) + 'Q' + x + ',' + y + ' ' + (x + r) + ',' + y + 'H' + (x + w - r) + 'Q' + (x + w) + ',' + y + ' ' + (x + w) + ',' + (y + r) + 'V' + (y + h) + 'Z';
  }

  /* ------------------------------------------------------------- barras */
  function bar(el, o) {
    const series = o.series.map((s, i) => ({ ...s, color: s.color || PAL[i] }));
    const fmt = o.fmt || ((v) => v), fmtAxis = o.fmtAxis || fmt;
    mount(el, (W) => {
      el.insertAdjacentHTML('beforeend', legend(series));
      const H = o.height || 240, L = o.left || 58, R = 8, T = 10, B = 26;
      const iw = W - L - R, ih = H - T - B, n = o.labels.length;
      const totals = o.labels.map((_, i) => o.stacked ? series.reduce((a, s) => a + Math.max(0, s.data[i] || 0), 0) : Math.max(...series.map((s) => s.data[i] || 0)));
      const max = niceMax(Math.max(...totals, 0) * 1.05);
      const y = (v) => T + ih - (v / max) * ih;
      const band = iw / n;
      let svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(o.title || 'Gráfico de barras') + '"><g class="grid">';
      for (let k = 0; k <= 4; k++) { const v = max * k / 4, yy = y(v); svg += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + yy + '" y2="' + yy + '"/>'; }
      svg += '</g><g class="axis">';
      for (let k = 0; k <= 4; k++) { const v = max * k / 4; svg += '<text x="' + (L - 8) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + esc(fmtAxis(v)) + '</text>'; }
      const every = Math.ceil(n / Math.max(1, Math.floor(iw / 46)));
      o.labels.forEach((lb, i) => { if (i % every === 0) svg += '<text x="' + (L + band * i + band / 2) + '" y="' + (H - 8) + '" text-anchor="middle">' + esc(lb) + '</text>'; });
      svg += '</g><g>';
      o.labels.forEach((lb, i) => {
        const x0 = L + band * i;
        svg += '<rect class="colhl" data-i="' + i + '" x="' + x0 + '" y="' + T + '" width="' + band + '" height="' + ih + '" style="opacity:0"/>';
        if (o.stacked) {
          const bw = Math.min(38, band * 0.62), bx = x0 + (band - bw) / 2; let acc = 0;
          const top = series.map((s, si) => (s.data[i] > 0 ? si : -1)).filter((x) => x >= 0).pop();
          series.forEach((s, si) => {
            const v = Math.max(0, s.data[i] || 0); if (!v) return;
            const y1 = y(acc + v), h = y(acc) - y1 - (acc > 0 ? 2 : 0);
            svg += si === top ? '<path d="' + rtop(bx, y1, bw, h, 4) + '" fill="' + s.color + '"/>' : '<rect x="' + bx + '" y="' + y1 + '" width="' + bw + '" height="' + Math.max(0, h) + '" fill="' + s.color + '"/>';
            acc += v;
          });
        } else {
          const ns = series.length, gw = Math.min(band * 0.72, ns * 22), bw = (gw - (ns - 1) * 2) / ns, gx = x0 + (band - gw) / 2;
          series.forEach((s, si) => { const v = Math.max(0, s.data[i] || 0); svg += '<path d="' + rtop(gx + si * (bw + 2), y(v), bw, y(0) - y(v), 4) + '" fill="' + s.color + '"/>'; });
        }
      });
      svg += '</g><line class="base" x1="' + L + '" x2="' + (W - R) + '" y1="' + y(0) + '" y2="' + y(0) + '"/>';
      o.labels.forEach((_, i) => { svg += '<rect class="hit" data-i="' + i + '" x="' + (L + band * i) + '" y="' + T + '" width="' + band + '" height="' + ih + '"/>'; });
      svg += '</svg>';
      el.insertAdjacentHTML('beforeend', svg);
      const tip = tipFor(el), s = el.querySelector('svg');
      s.addEventListener('mousemove', (e) => {
        const h = e.target.closest('.hit'); el.querySelectorAll('.colhl').forEach((r) => { r.style.opacity = h && r.dataset.i === h.dataset.i ? 1 : 0; });
        if (!h) return tip.hide();
        const i = +h.dataset.i, rc = el.getBoundingClientRect();
        const list = series.map((x) => ({ name: x.name, color: x.color, value: x.data[i] || 0 }));
        if (o.stacked && series.length > 1) list.push({ name: 'Total', color: 'transparent', value: totals[i] });
        tip.show(rows(o.tipLabels ? o.tipLabels[i] : o.labels[i], list, fmt) + (o.extra ? o.extra(i) : ''), e.clientX - rc.left, e.clientY - rc.top);
      });
      s.addEventListener('mouseleave', () => { tip.hide(); el.querySelectorAll('.colhl').forEach((r) => { r.style.opacity = 0; }); });
    });
  }

  /* -------------------------------------------------------------- líneas */
  function line(el, o) {
    const series = o.series.map((s, i) => ({ ...s, color: s.color || PAL[i] }));
    const fmt = o.fmt || ((v) => v), fmtAxis = o.fmtAxis || fmt;
    mount(el, (W) => {
      el.insertAdjacentHTML('beforeend', legend(series));
      const H = o.height || 220, L = o.left || 58, R = 12, T = 12, B = 26, n = o.labels.length;
      const iw = W - L - R, ih = H - T - B;
      const all = series.flatMap((s) => s.data);
      const minV = Math.min(0, ...all), max = niceMax(Math.max(...all, 0) * 1.08);
      const y = (v) => T + ih - ((v - minV) / (max - minV)) * ih;
      const x = (i) => L + (n === 1 ? iw / 2 : (iw * i) / (n - 1));
      let svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(o.title || 'Gráfico de líneas') + '"><g class="grid">';
      for (let k = 0; k <= 4; k++) { const v = minV + (max - minV) * k / 4; svg += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y(v) + '" y2="' + y(v) + '"/>'; }
      svg += '</g><g class="axis">';
      for (let k = 0; k <= 4; k++) { const v = minV + (max - minV) * k / 4; svg += '<text x="' + (L - 8) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + esc(fmtAxis(v)) + '</text>'; }
      const every = Math.ceil(n / Math.max(1, Math.floor(iw / 46)));
      o.labels.forEach((lb, i) => { if (i % every === 0) svg += '<text x="' + x(i) + '" y="' + (H - 8) + '" text-anchor="middle">' + esc(lb) + '</text>'; });
      svg += '</g>';
      if (minV < 0) svg += '<line class="base" x1="' + L + '" x2="' + (W - R) + '" y1="' + y(0) + '" y2="' + y(0) + '"/>';
      series.forEach((s) => {
        const pts = s.data.map((v, i) => x(i) + ',' + y(v));
        if (o.area && series.length === 1) svg += '<path d="M' + x(0) + ',' + y(Math.max(0, minV)) + 'L' + pts.join('L') + 'L' + x(n - 1) + ',' + y(Math.max(0, minV)) + 'Z" fill="' + s.color + '" opacity=".12"/>';
        svg += '<path d="M' + pts.join('L') + '" fill="none" stroke="' + s.color + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>';
        const li = s.data.length - 1; svg += '<circle cx="' + x(li) + '" cy="' + y(s.data[li]) + '" r="4" fill="' + s.color + '" stroke="#fff" stroke-width="2"/>';
      });
      svg += '<line class="xh" x1="0" x2="0" y1="' + T + '" y2="' + (T + ih) + '" stroke="#9aa0a9" stroke-dasharray="3 3" style="opacity:0"/>';
      series.forEach((s, si) => { svg += '<circle class="mk" data-s="' + si + '" r="5" fill="' + s.color + '" stroke="#fff" stroke-width="2" style="opacity:0"/>'; });
      svg += '<rect class="hit" x="' + L + '" y="' + T + '" width="' + iw + '" height="' + ih + '"/></svg>';
      el.insertAdjacentHTML('beforeend', svg);
      const tip = tipFor(el), s = el.querySelector('svg'), xh = s.querySelector('.xh'), mks = s.querySelectorAll('.mk');
      s.addEventListener('mousemove', (e) => {
        const rc = s.getBoundingClientRect(), scale = W / rc.width, mx = (e.clientX - rc.left) * scale;
        const i = Math.max(0, Math.min(n - 1, Math.round(((mx - L) / iw) * (n - 1))));
        xh.setAttribute('x1', x(i)); xh.setAttribute('x2', x(i)); xh.style.opacity = 1;
        mks.forEach((m) => { const sv = series[+m.dataset.s]; m.setAttribute('cx', x(i)); m.setAttribute('cy', y(sv.data[i])); m.style.opacity = 1; });
        const er = el.getBoundingClientRect();
        tip.show(rows(o.tipLabels ? o.tipLabels[i] : o.labels[i], series.map((sv) => ({ name: sv.name, color: sv.color, value: sv.data[i] })), fmt), x(i) / scale + (rc.left - er.left), e.clientY - er.top);
      });
      s.addEventListener('mouseleave', () => { tip.hide(); xh.style.opacity = 0; mks.forEach((m) => { m.style.opacity = 0; }); });
    });
  }

  /* ---------------------------------------------------------------- dona */
  function donut(el, o) {
    const items = o.items.filter((x) => x.value > 0).map((x, i) => ({ ...x, color: x.color || PAL[i] }));
    const fmt = o.fmt || ((v) => v);
    const total = items.reduce((a, x) => a + x.value, 0) || 1;
    mount(el, () => {
      const S = 180, c = S / 2, r = 72, sw = 22;
      let a0 = -Math.PI / 2, svg = '<svg viewBox="0 0 ' + S + ' ' + S + '" role="img" aria-label="' + esc(o.title || 'Distribución') + '">';
      if (items.length === 1) svg += '<circle cx="' + c + '" cy="' + c + '" r="' + r + '" fill="none" stroke="' + items[0].color + '" stroke-width="' + sw + '" data-i="0" class="seg"/>';
      else items.forEach((it, i) => {
        const a1 = a0 + (it.value / total) * Math.PI * 2, large = a1 - a0 > Math.PI ? 1 : 0;
        const p = (a) => (c + r * Math.cos(a)).toFixed(2) + ',' + (c + r * Math.sin(a)).toFixed(2);
        svg += '<path class="seg" data-i="' + i + '" d="M' + p(a0) + 'A' + r + ',' + r + ' 0 ' + large + ' 1 ' + p(a1) + '" fill="none" stroke="' + it.color + '" stroke-width="' + sw + '"/>';
        a0 = a1;
      });
      // separadores de 2px (color de superficie)
      if (items.length > 1) { let a = -Math.PI / 2; items.forEach((it) => { svg += '<line x1="' + (c + (r - sw / 2 - 1) * Math.cos(a)) + '" y1="' + (c + (r - sw / 2 - 1) * Math.sin(a)) + '" x2="' + (c + (r + sw / 2 + 1) * Math.cos(a)) + '" y2="' + (c + (r + sw / 2 + 1) * Math.sin(a)) + '" stroke="#fff" stroke-width="2"/>'; a += (it.value / total) * Math.PI * 2; }); }
      svg += '<text x="' + c + '" y="' + (c - 2) + '" text-anchor="middle" style="font:700 20px Outfit,Inter,sans-serif;fill:#14171c">' + esc(o.centerValue != null ? o.centerValue : fmt(total)) + '</text><text x="' + c + '" y="' + (c + 16) + '" text-anchor="middle" style="font:500 11px Inter,sans-serif;fill:#6b7280">' + esc(o.centerLabel || 'Total') + '</text></svg>';
      el.insertAdjacentHTML('beforeend', '<div class="donut">' + svg + '<ul>' + items.map((it) => '<li><i style="background:' + it.color + '"></i>' + esc(it.label) + '<span>' + esc(fmt(it.value)) + '</span><small>' + Math.round(it.value / total * 100) + '%</small></li>').join('') + '</ul></div>');
      const tip = tipFor(el);
      el.querySelector('svg').addEventListener('mousemove', (e) => { const sg = e.target.closest('.seg'); if (!sg) return tip.hide(); const it = items[+sg.dataset.i], rc = el.getBoundingClientRect(); tip.show(rows(it.label, [{ name: Math.round(it.value / total * 100) + '% del total', color: it.color, value: it.value }], fmt), e.clientX - rc.left, e.clientY - rc.top); });
      el.querySelector('svg').addEventListener('mouseleave', () => tip.hide());
    });
  }

  /* ------------------------------------------------------- barras horizontales */
  function hbars(el, o) {
    if (!el) return;
    const fmt = o.fmt || ((v) => v);
    const max = o.max || Math.max(...o.items.map((x) => x.value), 1);
    el.innerHTML = '<div class="hbars">' + o.items.map((it, i) => '<div class="hbar" title="' + esc(it.label + ': ' + fmt(it.value)) + '"><span>' + esc(it.label) + '</span><div class="hbar__t"><i style="width:' + Math.max(0.5, it.value / max * 100) + '%;background:' + (it.color || o.color || PAL[0]) + '"></i></div><b>' + esc(it.display || fmt(it.value)) + '</b></div>').join('') + '</div>';
  }

  window.Charts = { bar, line, donut, hbars, PAL, SEQ, STATUS };
})();
