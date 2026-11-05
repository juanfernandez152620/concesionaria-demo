/* =========================================================================
   Admin — núcleo: layout, router, componentes reutilizables
   ========================================================================= */
(function () {
  'use strict';
  const { DB, Q, fmt, esc, icon, LABELS, TONE, today, iso, sum } = RB;
  DB.load();
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const A = window.A = { views: {}, user: null, $, $$ };
  const LOGO = '<svg viewBox="0 0 48 48" aria-hidden="true"><rect width="48" height="48" rx="12" fill="#2a3038"/><path d="M14 36L22 12h4l8 24" fill="none" stroke="#cd9834" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M24 17v4M24 25v4M24 33v3" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/></svg>';
  A.LOGO = LOGO;

  /* ------------------------------------------------------------ html helpers */
  const AVC = ['#2a3038', '#8a6418', '#2160b8', '#1b7f3b', '#5b45c9', '#c2501f', '#0f766e', '#7c3a5c'];
  A.colorFor = (s) => { let h = 0; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return AVC[h % AVC.length]; };
  A.badge = (key, map, tone) => '<span class="bd bd--' + (tone || TONE[key] || 'muted') + '">' + esc((map && map[key]) || key) + '</span>';
  A.av = (name, color, size) => '<span class="av' + (size ? ' av--' + size : '') + '" style="background:' + (color || A.colorFor(name)) + '" title="' + esc(name) + '">' + esc(fmt.initials(name)) + '</span>';
  A.userAv = (id, size) => { const u = Q.user(id); return u ? A.av(u.nombre, u.color, size) : '<span class="av' + (size ? ' av--' + size : '') + '" style="background:#d9d5cc" title="Sin asignar">?</span>'; };
  A.who = (name, sub, color, size) => '<div class="who">' + A.av(name, color, size) + '<div style="min-width:0"><b>' + esc(name) + '</b>' + (sub ? '<small>' + sub + '</small>' : '') + '</div></div>';
  A.trend = (cur, prev, invert) => {
    if (!prev) return '';
    const p = (cur - prev) / Math.abs(prev) * 100, up = p >= 0, good = invert ? !up : up;
    return '<span class="trend trend--' + (good ? 'up' : 'down') + '">' + icon(up ? 'arrowUp' : 'arrowDown') + (p > 200 ? '×' + (cur / prev).toFixed(1).replace('.', ',') : Math.abs(p).toFixed(0) + '%') + '</span>';
  };
  A.kpi = (o) => '<div class="kpi' + (o.alert ? ' kpi--alert' : '') + '"' + (o.href ? ' style="cursor:pointer" onclick="location.hash=\'' + o.href + '\'"' : '') + '><span class="kpi__l">' + (o.icon ? icon(o.icon) : '') + esc(o.label) + '</span><span class="kpi__v" title="' + esc(o.value) + '">' + esc(o.value) + '</span>' + (o.sub || o.trend ? '<span class="kpi__s">' + (o.trend || '') + (o.sub || '') + '</span>' : '') + '</div>';
  A.card = (o) => '<section class="card' + (o.cls ? ' ' + o.cls : '') + '"' + (o.id ? ' id="' + o.id + '"' : '') + '>' + (o.title ? '<header class="card__h"><h3>' + (o.icon ? icon(o.icon) : '') + esc(o.title) + '</h3>' + (o.sub ? '<span class="sub">' + o.sub + '</span>' : '') + (o.acts ? '<div class="acts">' + o.acts + '</div>' : '') + '</header>' : '') + '<div class="card__b' + (o.flush ? ' card__b--flush' : '') + '"' + (o.bodyId ? ' id="' + o.bodyId + '"' : '') + '>' + (o.body || '') + '</div></section>';
  A.empty = (t, ic) => '<div class="empty">' + icon(ic || 'info') + '<span>' + esc(t) + '</span></div>';
  A.prog = (p, tone) => '<div class="prog' + (tone ? ' prog--' + tone : '') + '"><i style="width:' + Math.max(0, Math.min(100, p * 100)).toFixed(1) + '%"></i></div>';
  A.ph = (title, sub, acts, back) => (back ? '<a class="back" href="' + back[0] + '">' + icon('chevron') + esc(back[1]) + '</a>' : '') + '<div class="ph"><div><h1>' + esc(title) + '</h1>' + (sub ? '<p>' + sub + '</p>' : '') + '</div>' + (acts ? '<div class="ph__acts">' + acts + '</div>' : '') + '</div>';
  A.opts = (list, sel, empty) => (empty != null ? '<option value="">' + esc(empty) + '</option>' : '') + list.map((o) => { const [v, l] = Array.isArray(o) ? o : [o, o]; return '<option value="' + esc(v) + '"' + (String(v) === String(sel) ? ' selected' : '') + '>' + esc(l) + '</option>'; }).join('');
  A.sellerOpts = (sel, empty) => A.opts(DB.data.team.filter((u) => /comercial|usados|gerente/i.test(u.rol)).map((u) => [u.id, u.nombre]), sel, empty);
  A.clientLink = (id) => { const c = Q.client(id); return c ? '<a href="#/clientes/' + c.id + '" class="strong" style="text-decoration:none">' + esc(c.nombre) + '</a>' : '—'; };

  /* ------------------------------------------------------------------ toast */
  A.toast = (msg, link) => {
    let box = $('.toasts'); if (!box) { box = document.createElement('div'); box.className = 'toasts'; box.setAttribute('role', 'status'); document.body.appendChild(box); }
    const t = document.createElement('div'); t.className = 'toast';
    t.innerHTML = icon('check') + '<span>' + esc(msg) + '</span>' + (link ? '<a href="' + link[0] + '">' + esc(link[1]) + '</a>' : '');
    box.appendChild(t); setTimeout(() => t.remove(), 4200);
  };

  /* ------------------------------------------------------------ modal/drawer */
  A.modal = (o) => {
    const m = document.createElement('div'); m.className = 'modal'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true');
    m.innerHTML = '<div class="modal__box' + (o.size ? ' modal__box--' + o.size : '') + '"><div class="modal__h"><div><h3>' + esc(o.title || '') + '</h3>' + (o.sub ? '<p>' + o.sub + '</p>' : '') + '</div><button class="btn btn--icon btn--ghost x" aria-label="Cerrar">' + icon('x') + '</button></div><div class="modal__b">' + (o.body || '') + '</div>' +
      (o.foot !== false ? '<div class="modal__f">' + (o.foot || [{ label: 'Cancelar', act: 'close' }, { label: o.ok || 'Guardar', cls: 'btn--pri', act: 'ok' }]).map((b, i) => '<button class="btn ' + (b.cls || '') + '" data-b="' + i + '">' + (b.icon ? icon(b.icon) : '') + esc(b.label) + '</button>').join('') + '</div>' : '') + '</div>';
    document.body.appendChild(m); document.body.style.overflow = 'hidden';
    const close = () => { m.remove(); if (!$('.modal') && !$('.drawer')) document.body.style.overflow = ''; document.removeEventListener('keydown', onKey); };
    const onKey = (e) => { if (e.key === 'Escape' && m === $$('.modal').pop()) close(); };
    document.addEventListener('keydown', onKey);
    const box = $('.modal__box', m);
    m.addEventListener('mousedown', (e) => { if (e.target === m) close(); });
    $('.x', m).addEventListener('click', close);
    const btns = o.foot || [{ label: 'Cancelar', act: 'close' }, { label: o.ok || 'Guardar', cls: 'btn--pri', act: 'ok' }];
    $$('[data-b]', m).forEach((b) => b.addEventListener('click', () => {
      const def = btns[+b.dataset.b];
      if (def.act === 'close') return close();
      if (def.act === 'ok') { const f = $('form', box); if (f && !f.reportValidity()) return; if (o.onOk && o.onOk(box, f ? A.read(f) : null) === false) return; return close(); }
      if (typeof def.act === 'function') def.act(box, close);
    }));
    const form = $('form', box); if (form) form.addEventListener('submit', (e) => { e.preventDefault(); const ok = $$('[data-b]', m).find((b) => btns[+b.dataset.b].act === 'ok'); if (ok) ok.click(); });
    if (o.onOpen) o.onOpen(box, close);
    setTimeout(() => { const f = $('.modal__b input:not([type=hidden]):not([readonly]), .modal__b select, .modal__b textarea', box); if (f && !o.noFocus) f.focus(); }, 40);
    return { box, close };
  };
  A.confirm = (title, text, okLabel, danger) => new Promise((res) => {
    A.modal({ title, size: 'sm', body: '<p class="mut">' + text + '</p>', foot: [{ label: 'Cancelar', act: (b, c) => { c(); res(false); } }, { label: okLabel || 'Confirmar', cls: danger ? 'btn--danger' : 'btn--pri', act: (b, c) => { c(); res(true); } }] });
  });
  A.drawer = (o) => {
    const d = document.createElement('div'); d.className = 'drawer';
    d.innerHTML = '<aside class="drawer__box" role="dialog" aria-modal="true"><div class="drawer__h">' + (o.head || '') + '<button class="btn btn--icon btn--ghost x" style="margin-left:auto" aria-label="Cerrar">' + icon('x') + '</button></div><div class="drawer__b">' + (o.body || '') + '</div></aside>';
    document.body.appendChild(d); document.body.style.overflow = 'hidden';
    const close = () => { d.remove(); if (!$('.modal') && !$('.drawer')) document.body.style.overflow = ''; document.removeEventListener('keydown', onKey); if (o.onClose) o.onClose(); };
    const onKey = (e) => { if (e.key === 'Escape' && !$('.modal')) close(); };
    document.addEventListener('keydown', onKey);
    d.addEventListener('mousedown', (e) => { if (e.target === d) close(); });
    $('.x', d).addEventListener('click', close);
    return { box: $('.drawer__box', d), close };
  };

  /* ------------------------------------------------------------------ forms */
  A.fields = (defs, v) => {
    v = v || {};
    return '<div class="fgrid' + (defs.cols3 ? ' fgrid--3' : '') + '">' + defs.map((d) => {
      if (!d) return '';
      const val = v[d.n] != null ? v[d.n] : (d.v != null ? d.v : '');
      const attrs = ' name="' + d.n + '" data-t="' + (d.t || 'text') + '"' + (d.req ? ' required' : '') + (d.min != null ? ' min="' + d.min + '"' : '') + (d.max != null ? ' max="' + d.max + '"' : '') + (d.step ? ' step="' + d.step + '"' : '') + (d.ph ? ' placeholder="' + esc(d.ph) + '"' : '') + (d.ro ? ' readonly' : '') + (d.id ? ' id="' + d.id + '"' : '');
      const full = d.full || d.t === 'textarea' ? ' fld--full' : '';
      if (d.t === 'check') return '<label class="fld fld--check' + full + '"><input type="checkbox"' + attrs + (val ? ' checked' : '') + '> ' + esc(d.l) + '</label>';
      if (d.t === 'hidden') return '<input type="hidden"' + attrs + ' value="' + esc(val) + '">';
      let input;
      if (d.t === 'select') input = '<select' + attrs + '>' + A.opts(d.o, val, d.empty) + '</select>';
      else if (d.t === 'textarea') input = '<textarea' + attrs + '>' + esc(val) + '</textarea>';
      else input = '<input type="' + ({ money: 'number', number: 'number', date: 'date', dt: 'datetime-local', email: 'email', tel: 'tel' }[d.t] || 'text') + '"' + attrs + ' value="' + esc(val) + '"' + (d.t === 'money' ? ' step="' + (d.step || 1000) + '" inputmode="numeric"' : '') + '>';
      return '<label class="fld' + full + '">' + esc(d.l) + (d.req ? ' *' : '') + input + (d.help ? '<small>' + d.help + '</small>' : '') + '</label>';
    }).join('') + '</div>';
  };
  A.read = (form) => {
    const o = {};
    $$('[name]', form).forEach((el) => {
      const t = el.dataset.t;
      if (el.type === 'checkbox') o[el.name] = el.checked;
      else if (el.type === 'radio') { if (el.checked) o[el.name] = el.value; }
      else if (t === 'money' || t === 'number') o[el.name] = el.value === '' ? 0 : Number(el.value);
      else o[el.name] = el.value.trim();
    });
    return o;
  };
  A.formModal = (o) => A.modal({ ...o, body: '<form novalidate>' + (o.pre || '') + A.fields(o.fields, o.values) + (o.post || '') + '</form>' });

  /* ------------------------------------------------------------------ tabla */
  A.table = (el, o) => {
    if (!el) return;
    const st = el._t && el._t.key === o.key ? el._t : { key: o.key, sort: o.sort || null, page: 0 };
    el._t = st; st.o = o;
    const draw = () => {
      const cols = o.cols.filter(Boolean);
      let rows = o.rows.slice();
      if (st.sort) { const c = cols.find((x) => x.k === st.sort.k); if (c) { const f = c.s || ((r) => r[c.k]); rows.sort((a, b) => { const x = f(a), y = f(b); return (x > y ? 1 : x < y ? -1 : 0) * st.sort.d; }); } }
      const ps = o.pageSize || 12, pages = Math.max(1, Math.ceil(rows.length / ps)); if (st.page >= pages) st.page = pages - 1;
      const view = o.noPage ? rows : rows.slice(st.page * ps, st.page * ps + ps);
      el.innerHTML = '<div class="tw"><table class="tbl"><thead><tr>' + cols.map((c) => '<th class="' + (c.num ? 'num ' : '') + (c.sortable !== false && (c.s || c.k) ? 'sortable ' : '') + (st.sort && st.sort.k === c.k ? 'sorted' : '') + '" data-k="' + (c.k || '') + '"' + (c.w ? ' style="width:' + c.w + '"' : '') + '>' + esc(c.l || '') + (c.sortable !== false && (c.s || c.k) ? '<span class="arr">' + (st.sort && st.sort.k === c.k ? (st.sort.d > 0 ? '▲' : '▼') : '↕') + '</span>' : '') + '</th>').join('') + '</tr></thead><tbody>' +
        (view.length ? view.map((r, i) => '<tr data-i="' + (st.page * ps + i) + '" class="' + (o.onRow ? 'link ' : '') + (o.rowCls ? o.rowCls(r) : '') + '">' + cols.map((c) => '<td class="' + (c.num ? 'num ' : '') + (c.cls || '') + '">' + (c.r ? c.r(r) : esc(r[c.k])) + '</td>').join('') + '</tr>').join('') : '<tr><td colspan="' + cols.length + '">' + A.empty(o.empty || 'Sin resultados') + '</td></tr>') +
        '</tbody>' + (o.foot ? '<tfoot><tr>' + o.foot(rows).map((f) => '<td class="' + (f && f.num ? 'num' : '') + '"' + (f && f.span ? ' colspan="' + f.span + '"' : '') + '>' + (f ? (f.v != null ? f.v : f) : '') + '</td>').join('') + '</tr></tfoot>' : '') + '</table></div>' +
        (!o.noPage && rows.length > ps ? '<div class="pager"><span>' + (st.page * ps + 1) + '–' + Math.min(rows.length, st.page * ps + ps) + ' de ' + rows.length + '</span><button class="btn btn--sm btn--icon" data-p="-1" aria-label="Anterior"' + (st.page ? '' : ' disabled') + '><span style="transform:rotate(180deg);display:grid">' + icon('chevron') + '</span></button><button class="btn btn--sm btn--icon" data-p="1" aria-label="Siguiente"' + (st.page < pages - 1 ? '' : ' disabled') + '>' + icon('chevron') + '</button></div>' : '');
      st.rows = rows;
    };
    if (!el._bound) {
      el._bound = true;
      el.addEventListener('click', (e) => {
        const s = el._t, oo = s.o;
        const th = e.target.closest('th.sortable'); if (th) { const k = th.dataset.k; s.sort = s.sort && s.sort.k === k ? { k, d: -s.sort.d } : { k, d: 1 }; s.draw(); return; }
        const pg = e.target.closest('[data-p]'); if (pg) { s.page += +pg.dataset.p; s.draw(); return; }
        if (e.target.closest('a,button,input,select,label')) return;
        const tr = e.target.closest('tbody tr[data-i]'); if (tr && oo.onRow) oo.onRow(s.rows[+tr.dataset.i]);
      });
    }
    st.draw = draw; draw();
  };

  /* ------------------------------------------------------------- export/print */
  A.csv = (name, cols, rows) => {
    const q = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const txt = '﻿' + cols.map((c) => q(c[0])).join(';') + '\n' + rows.map((r) => cols.map((c) => q(c[1](r))).join(';')).join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], { type: 'text/csv;charset=utf-8' })); a.download = name + '-' + iso(today()) + '.csv';
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    A.toast('Exportado ' + rows.length + ' registros a CSV');
  };
  A.print = (title, html) => {
    const c = DB.data.config;
    const f = document.createElement('iframe'); f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'; document.body.appendChild(f);
    const doc = f.contentWindow.document;
    doc.open();
    doc.write('<!doctype html><html lang="es"><head><meta charset="utf-8"><title>' + esc(title) + '</title><style>body{font:13px/1.5 Inter,Arial,sans-serif;color:#222;margin:28px}h1{font-size:20px;margin:0}h2{font-size:15px;margin:22px 0 8px;border-bottom:2px solid #cd9834;padding-bottom:4px}table{width:100%;border-collapse:collapse;margin:6px 0}th,td{padding:6px 8px;border-bottom:1px solid #ddd;text-align:left;font-size:12px}th{background:#f4f2ee;font-size:11px;text-transform:uppercase;letter-spacing:.04em}.num{text-align:right}.hd{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #14171c;padding-bottom:12px;margin-bottom:8px}.hd small{color:#666;display:block}.tot{font-size:16px;font-weight:700}.box{border:1px solid #ddd;border-radius:8px;padding:10px 12px;margin:8px 0}.grid{display:grid;grid-template-columns:1fr 1fr;gap:4px 24px}.muted{color:#666}.sign{margin-top:60px;display:grid;grid-template-columns:1fr 1fr;gap:60px}.sign div{border-top:1px solid #333;padding-top:6px;text-align:center;font-size:12px}</style></head><body>' +
      '<div class="hd"><div><h1>' + esc(c.name) + '</h1><small>' + esc(c.address) + ' · Tel. ' + esc(c.phone) + ' · ' + esc(c.email) + '</small></div><div style="text-align:right"><b>' + esc(title) + '</b><small>Emitido: ' + fmt.date(iso(today())) + '</small></div></div>' + html + '<p class="muted" style="margin-top:30px;font-size:11px">Documento generado por el sistema de gestión de ' + esc(c.name) + '. Valores expresados en pesos argentinos.</p></body></html>');
    doc.close();
    setTimeout(() => { f.contentWindow.focus(); f.contentWindow.print(); setTimeout(() => f.remove(), 1500); }, 250);
  };

  /* ----------------------------------------------------------- navegación */
  const NAV = [
    ['General', [['dashboard', 'Dashboard', 'home']]],
    ['Comercial', [['crm', 'CRM · Leads', 'funnel'], ['clientes', 'Clientes', 'users'], ['agenda', 'Agenda', 'calendar'], ['ventas', 'Ventas', 'tag']]],
    ['Stock', [['inventario', 'Inventario', 'car'], ['usados', 'Usados y tasaciones', 'swap']]],
    ['Finanzas', [['cobranzas', 'Financiación y cobranzas', 'card'], ['planes', 'Plan de ahorro', 'piggy'], ['seguros', 'Seguros', 'shield'], ['caja', 'Caja y finanzas', 'wallet']]],
    ['Postventa', [['taller', 'Taller', 'wrench']]],
    ['Gestión', [['reportes', 'Reportes', 'chart'], ['equipo', 'Equipo', 'team'], ['config', 'Configuración', 'gear']]]
  ];
  A.counts = () => {
    const t = today(), d = DB.data;
    return {
      crm: [d.leads.filter((l) => l.etapa === 'nuevo').length, 'hot'],
      agenda: [d.appts.filter((a) => a.fecha.slice(0, 10) === iso(t) && a.estado !== 'cancelado').length, ''],
      usados: [d.tradeIns.filter((x) => x.estado === 'pendiente').length, ''],
      cobranzas: [d.credits.filter((c) => RB.Fin.creditStatus(c, t).estado === 'en_mora').length, 'err'],
      seguros: [d.policies.filter((p) => RB.Fin.policyState(p, t) === 'por_vencer').length, ''],
      taller: [d.workOrders.filter((w) => w.estado !== 'entregado').length, '']
    };
  };
  function sidebar(active) {
    const cnt = A.counts();
    $('#sideNav').innerHTML = NAV.map(([sec, items]) => '<h6>' + sec + '</h6>' + items.map(([k, l, ic]) => '<a href="#/' + k + '"' + (k === active ? ' class="on" aria-current="page"' : '') + '>' + icon(ic) + '<span>' + l + '</span>' + (cnt[k] && cnt[k][0] ? '<span class="cnt' + (cnt[k][1] ? ' cnt--' + cnt[k][1] : '') + '">' + cnt[k][0] + '</span>' : '') + '</a>').join('')).join('');
  }
  A.refreshChrome = () => { sidebar(A.current); notifBadge(); };
  A.setTitle = (t) => { $('#topTitle').textContent = t; document.title = t + ' · ' + DB.data.config.name + ' (Admin)'; };
  A.go = (h) => { if (location.hash === h) A.route(); else location.hash = h; };
  A.query = () => { const q = location.hash.split('?')[1]; return q ? Object.fromEntries(new URLSearchParams(q)) : {}; };
  A.route = (keepScroll) => {
    if (!A.user) return;
    const h = (location.hash || '#/dashboard').replace(/^#\/?/, '').split('?')[0];
    const parts = h.split('/').filter(Boolean);
    const name = A.views[parts[0]] ? parts[0] : 'dashboard';
    const y = window.scrollY;
    A.current = name;
    sidebar(name);
    $('#side').classList.remove('open'); $('#scrim').classList.remove('on');
    const v = $('#view');
    try { A.views[name](v, ...parts.slice(1)); } catch (err) { console.error(err); v.innerHTML = A.ph('Ups', 'Ocurrió un error al mostrar esta sección.') + '<pre class="card card__b small">' + esc(err.stack || err) + '</pre>'; }
    window.scrollTo(0, keepScroll ? y : 0);
  };
  A.refresh = () => { A.route(true); };
  A.reg = (name, fn) => { A.views[name] = fn; };

  /* ----------------------------------------------------------- notificaciones */
  function notifBadge() {
    const n = DB.data.notifications.filter((x) => !x.leido).length;
    const b = $('#notifDot'); if (b) { b.textContent = n > 9 ? '9+' : n; b.hidden = !n; }
  }
  function notifMenu() {
    const t = today(), d = DB.data;
    const auto = [];
    const mora = d.credits.filter((c) => RB.Fin.creditStatus(c, t).estado === 'en_mora');
    if (mora.length) auto.push({ texto: mora.length + ' créditos con cuotas vencidas requieren gestión de cobranza', link: '#/cobranzas', tipo: 'alert' });
    const pv = d.policies.filter((p) => RB.Fin.policyState(p, t) === 'por_vencer');
    if (pv.length) auto.push({ texto: pv.length + ' pólizas vencen en los próximos 30 días', link: '#/seguros', tipo: 'shield' });
    const sinContacto = d.leads.filter((l) => l.etapa === 'nuevo' && RB.daysBetween(l.creado, t) >= 1);
    if (sinContacto.length) auto.push({ texto: sinContacto.length + ' leads llevan más de 24 h sin contactar', link: '#/crm', tipo: 'funnel' });
    const ICO = { lead: 'funnel', agenda: 'calendar', taller: 'wrench', alert: 'alert', shield: 'shield', funnel: 'funnel', pago: 'cash', info: 'info' };
    return '<div style="display:flex;align-items:center;padding:6px 8px 8px"><b>Notificaciones</b>' + (d.notifications.some((x) => !x.leido) ? '<button class="btn btn--xs btn--ghost" style="margin-left:auto;width:auto" id="notifRead">Marcar leídas</button>' : '') + '</div>' +
      d.notifications.slice(0, 12).map((n) => '<a class="notif' + (n.leido ? '' : ' unread') + '" href="' + esc(n.link || '#/dashboard') + '"><span class="ic">' + icon(ICO[n.tipo] || 'bell') + '</span><div><p>' + esc(n.texto) + '</p><small>' + fmt.ago(n.fecha) + '</small></div></a>').join('') +
      (auto.length ? '<hr><div style="padding:4px 8px" class="small mut">Alertas del sistema</div>' + auto.map((n) => '<a class="notif" href="' + n.link + '"><span class="ic" style="color:var(--err)">' + icon(ICO[n.tipo]) + '</span><div><p>' + esc(n.texto) + '</p></div></a>').join('') : '') +
      (!d.notifications.length && !auto.length ? A.empty('Sin notificaciones') : '');
  }

  /* --------------------------------------------------------------- búsqueda */
  function search(q) {
    q = q.trim().toLowerCase(); if (q.length < 2) return '';
    const d = DB.data, has = (...s) => s.join(' ').toLowerCase().includes(q);
    const cl = d.clients.filter((c) => has(c.nombre, c.dni, c.email, c.tel)).slice(0, 5);
    const ld = d.leads.filter((l) => has(l.nombre, l.tel, l.email, l.interes)).slice(0, 5);
    const vh = d.vehicles.filter((v) => has(Q.vFull(v), v.patente, v.id)).slice(0, 5);
    const sl = d.sales.filter((s) => has(s.id, s.vehiculo, (Q.client(s.clientId) || {}).nombre)).slice(0, 3);
    const po = d.policies.filter((p) => has(p.numero, p.patente)).slice(0, 3);
    const sec = (t, list, fn) => list.length ? '<h6>' + t + '</h6>' + list.map(fn).join('') : '';
    const out = sec('Clientes', cl, (c) => '<a href="#/clientes/' + c.id + '">' + A.av(c.nombre, null, 'sm') + '<span><b>' + esc(c.nombre) + '</b><br><small class="mut">DNI ' + esc(c.dni) + ' · ' + esc(c.tel) + '</small></span></a>') +
      sec('Leads', ld, (l) => '<a href="#/crm/' + l.id + '">' + icon('funnel') + '<span><b>' + esc(l.nombre) + '</b><br><small class="mut">' + esc(l.interes) + ' · ' + LABELS.leadStage[l.etapa] + '</small></span></a>') +
      sec('Vehículos', vh, (v) => '<a href="#/inventario/' + v.id + '">' + icon('car') + '<span><b>' + esc(Q.vName(v)) + '</b><br><small class="mut">' + esc(v.version) + ' · ' + (v.cond === '0km' ? '0km' : v.year + ' · ' + esc(v.patente)) + '</small></span></a>') +
      sec('Ventas', sl, (s) => '<a href="#/ventas/' + s.id + '">' + icon('tag') + '<span><b>' + s.id + ' · ' + esc(s.vehiculo) + '</b><br><small class="mut">' + esc((Q.client(s.clientId) || {}).nombre || '') + '</small></span></a>') +
      sec('Pólizas', po, (p) => '<a href="#/seguros?p=' + p.id + '">' + icon('shield') + '<span><b>' + esc(p.numero) + '</b><br><small class="mut">' + esc(p.vehiculo) + ' · ' + esc(p.patente) + '</small></span></a>');
    return out || '<div class="empty" style="padding:20px">Sin resultados para “' + esc(q) + '”</div>';
  }

  /* ------------------------------------------------------------------ shell */
  function shell() {
    const u = A.user;
    document.body.innerHTML =
      '<div class="app"><aside class="side" id="side"><a class="side__brand" href="#/dashboard">' + LOGO + '<span><b>RUMBO</b><small>Gestión</small></span></a><nav class="side__nav" id="sideNav" aria-label="Módulos"></nav>' +
      '<div class="side__foot"><a href="home.html" target="_blank" rel="noopener">' + icon('eye') + 'Ver sitio público</a><a href="index.html" target="_top">' + icon('home') + 'Inicio de la demo</a></div></aside><div class="scrim" id="scrim"></div>' +
      '<div class="main"><header class="topb"><button class="topb__burger" id="burger" aria-label="Menú">' + icon('menu') + '</button><span class="topb__title" id="topTitle"></span>' +
      '<div class="gsearch">' + icon('search') + '<input id="gq" type="search" placeholder="Buscar clientes, DNI, leads, patentes, pólizas…" autocomplete="off" aria-label="Buscar"><div class="gsearch__res" id="gres"></div></div>' +
      '<div class="topb__acts"><div class="dd"><button class="btn btn--acc btn--sm" id="newBtn" aria-haspopup="true">' + icon('plus') + '<span>Nuevo</span></button><div class="dd__menu" id="newMenu">' +
      '<button data-new="lead">' + icon('funnel') + 'Lead</button><button data-new="cliente">' + icon('user') + 'Cliente</button><button data-new="venta">' + icon('tag') + 'Operación de venta</button><button data-new="turno">' + icon('calendar') + 'Turno / cita</button><button data-new="vehiculo">' + icon('car') + 'Vehículo al stock</button><button data-new="poliza">' + icon('shield') + 'Cotizar seguro</button><button data-new="ot">' + icon('wrench') + 'Orden de taller</button></div></div>' +
      '<div class="dd"><button class="ibtn" id="notifBtn" aria-label="Notificaciones">' + icon('bell') + '<span class="dot" id="notifDot" hidden></span></button><div class="dd__menu notifs" id="notifMenu"></div></div>' +
      '<div class="dd"><button class="me" id="meBtn">' + A.av(u.nombre, u.color) + '<span><b>' + esc(u.nombre) + '</b><small>' + esc(u.rol) + '</small></span></button><div class="dd__menu" id="meMenu"><a href="#/equipo">' + icon('user') + 'Mi perfil</a><a href="home.html" target="_blank" rel="noopener">' + icon('eye') + 'Ver sitio público</a><a href="#/config">' + icon('gear') + 'Configuración</a><hr><button id="switchUser">' + icon('refresh') + 'Cambiar de usuario</button><button id="logout">' + icon('logout') + 'Salir</button></div></div></div></header>' +
      '<main class="view" id="view"></main></div></div>';
    $('#burger').addEventListener('click', () => { $('#side').classList.add('open'); $('#scrim').classList.add('on'); });
    $('#scrim').addEventListener('click', () => { $('#side').classList.remove('open'); $('#scrim').classList.remove('on'); });
    const dd = (btn, menu, fill) => { $(btn).addEventListener('click', (e) => { e.stopPropagation(); const m = $(menu); const on = !m.classList.contains('on'); $$('.dd__menu').forEach((x) => x.classList.remove('on')); if (on) { if (fill) m.innerHTML = fill(); m.classList.add('on'); } }); };
    dd('#newBtn', '#newMenu'); dd('#notifBtn', '#notifMenu', notifMenu); dd('#meBtn', '#meMenu');
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.dd__menu') || e.target.closest('a,button[data-new]')) $$('.dd__menu').forEach((x) => x.classList.remove('on'));
      if (!e.target.closest('.gsearch')) $('#gres').classList.remove('on');
      if (e.target.closest('#notifRead')) { DB.data.notifications.forEach((n) => { n.leido = true; }); DB.save(); notifBadge(); $('#notifMenu').innerHTML = notifMenu(); $('#notifMenu').classList.add('on'); }
      const nw = e.target.closest('[data-new]'); if (nw && A.quickNew) A.quickNew(nw.dataset.new);
    });
    $('#logout').addEventListener('click', () => { try { localStorage.removeItem('rumbo_admin_user'); } catch (e) { /* noop */ } location.hash = ''; login(); });
    $('#switchUser').addEventListener('click', () => { try { localStorage.removeItem('rumbo_admin_user'); } catch (e) { /* noop */ } login(); });
    const gq = $('#gq'), gres = $('#gres');
    gq.addEventListener('input', () => { const h = search(gq.value); gres.innerHTML = h; gres.classList.toggle('on', !!h); });
    gq.addEventListener('keydown', (e) => { if (e.key === 'Enter') { const a = $('a', gres); if (a) { location.hash = a.getAttribute('href'); gres.classList.remove('on'); gq.blur(); } } if (e.key === 'Escape') { gres.classList.remove('on'); gq.blur(); } });
    gres.addEventListener('click', (e) => { if (e.target.closest('a')) { gres.classList.remove('on'); gq.value = ''; } });
    document.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); gq.focus(); } });
    notifBadge();
  }

  /* ------------------------------------------------------------------ login */
  function login() {
    A.user = null;
    const team = DB.data.team;
    document.body.innerHTML = '<div class="login"><div class="login__art"><img src="assets/img/banners/chevrolet-hero-s10-1080.webp" alt=""><div><h2>Todo tu concesionario en un solo lugar.</h2><p>CRM de leads, clientes 360° con estado financiero, stock, ventas, financiación, cobranzas, plan de ahorro, seguros, taller y caja.</p></div></div>' +
      '<div class="login__box"><div class="side__brand" style="border:0;padding:0;height:auto">' + LOGO + '<span><b>RUMBO</b><small>Gestión</small></span></div><h1>Ingresá al sistema</h1><p>Demo: elegí un perfil para entrar. Cada rol ve su información relevante.</p><div class="profiles">' +
      team.slice(0, 8).map((u) => '<button class="profile" data-u="' + u.id + '">' + A.av(u.nombre, u.color) + '<span><b>' + esc(u.nombre) + '</b><small>' + esc(u.rol) + '</small></span><span class="go">' + icon('arrowRight') + '</span></button>').join('') +
      '</div><div class="login__foot"><a href="index.html" target="_top">← Inicio de la demo</a><a href="home.html">Ver sitio público</a><span>Datos ficticios de demostración</span></div></div></div>';
    $$('.profile').forEach((b) => b.addEventListener('click', () => { enter(b.dataset.u); }));
  }
  function enter(id) {
    A.user = Q.user(id); if (!A.user) return login();
    try { localStorage.setItem('rumbo_admin_user', id); } catch (e) { /* noop */ }
    shell(); A.route();
  }

  /* ------------------------------------------------------------- arranque */
  A.start = () => {
    let saved = null; try { saved = localStorage.getItem('rumbo_admin_user'); } catch (e) { /* noop */ }
    window.addEventListener('hashchange', () => A.route());
    let lastN = DB.data.notifications.length;
    DB.onChange((external) => {
      if (!A.user) return;
      if (external) {
        const n = DB.data.notifications.length;
        if (n > lastN) { const nt = DB.data.notifications[0]; A.toast(nt.texto, [nt.link || '#/crm', 'Ver']); }
        lastN = n;
        if (!$('.modal') && !$('.drawer')) A.refresh(); else A.refreshChrome();
      } else { lastN = DB.data.notifications.length; A.refreshChrome(); }
    });
    if (saved && Q.user(saved)) enter(saved); else login();
  };
})();
