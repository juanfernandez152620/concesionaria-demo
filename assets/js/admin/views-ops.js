/* =========================================================================
   Admin — Inventario, Ventas, Financiación y cobranzas, Plan de ahorro, Seguros
   ========================================================================= */
(function () {
  'use strict';
  const { DB, Q, Fin, fmt, esc, icon, LABELS, BRANDS, today, iso, isoDT, addDays, addMonths, daysBetween, parse, sum, groupBy, waLink, round } = RB;
  const { $, $$ } = A;
  const C = window.Charts;
  const me = () => A.user;
  const cfg = () => DB.data.config;
  const vLabel = (v) => Q.vName(v) + ' ' + v.version + (v.cond === 'usado' ? ' · ' + v.year : '');

  /* ============================================================ INVENTARIO */
  const inv = { cond: '', brand: '', status: '', q: '', pub: '' };
  A.reg('inventario', (v, id) => {
    A.setTitle('Inventario');
    const d = DB.data, t = today();
    const L = d.vehicles.filter((x) => (!inv.cond || x.cond === inv.cond) && (!inv.brand || x.brand === inv.brand) && (!inv.pub || String(x.published) === inv.pub) &&
      (inv.status ? (inv.status === 'sin_stock' ? x.cond === '0km' && !x.stock : x.cond === 'usado' ? x.status === inv.status : inv.status === 'disponible' && x.stock > 0) : !(x.cond === 'usado' && x.status === 'vendido')) &&
      (!inv.q || (vLabel(x) + ' ' + x.patente + ' ' + x.id).toLowerCase().includes(inv.q.toLowerCase())));
    const z = d.vehicles.filter((x) => x.cond === '0km'), u = d.vehicles.filter((x) => x.cond === 'usado' && x.status !== 'vendido');
    const inStock = z.filter((x) => x.stock > 0).concat(u);
    const avgDays = inStock.length ? sum(inStock, (x) => daysBetween(x.ingreso, t)) / inStock.length : 0;
    v.innerHTML = A.ph('Inventario', 'Stock de 0km y usados · lo publicado se muestra en el sitio web', '<button class="btn" id="iExp">' + icon('download') + 'Exportar</button><button class="btn btn--pri" id="iNew">' + icon('plus') + 'Agregar vehículo</button>') +
      '<div class="kpis">' + A.kpi({ label: 'Unidades 0km', icon: 'car', value: sum(z, (x) => x.stock), sub: z.filter((x) => !x.stock).length + ' modelos sin stock' }) + A.kpi({ label: 'Usados disponibles', icon: 'swap', value: u.length, sub: u.filter((x) => x.status === 'reservado').length + ' reservados' }) +
      A.kpi({ label: 'Valor de stock (costo)', icon: 'cash', value: fmt.moneyShort(sum(z, (x) => x.stock * x.cost) + sum(u, (x) => x.cost)) }) + A.kpi({ label: 'Días promedio en stock', icon: 'clock', value: Math.round(avgDays) + ' días', alert: avgDays > 60 }) + A.kpi({ label: 'Margen potencial', icon: 'percent', value: fmt.moneyShort(sum(z, (x) => x.stock * (x.price - x.cost)) + sum(u, (x) => x.price - x.cost)) }) + '</div>' +
      '<div class="filters"><label class="search">' + icon('search') + '<input class="inp" id="iq" type="search" placeholder="Modelo, versión, patente…" value="' + esc(inv.q) + '"></label><div class="seg" id="iCond">' + [['', 'Todos'], ['0km', '0km'], ['usado', 'Usados']].map(([k, l]) => '<button data-c="' + k + '"' + (inv.cond === k ? ' class="on"' : '') + '>' + l + '</button>').join('') + '</div>' +
      '<select class="inp" id="iBrand">' + A.opts(BRANDS.map((b) => [b.id, b.name]), inv.brand, 'Todas las marcas') + '</select><select class="inp" id="iStatus">' + A.opts([['disponible', 'Disponible'], ['reservado', 'Reservado'], ['vendido', 'Vendido'], ['sin_stock', '0km sin stock']], inv.status, 'Estado: activos') + '</select><select class="inp" id="iPub">' + A.opts([['true', 'Publicado en web'], ['false', 'No publicado']], inv.pub, 'Publicación') + '</select></div><div class="card" id="iTbl"></div>';
    A.table($('#iTbl'), {
      key: 'inv', rows: L, sort: { k: 'veh', d: 1 }, onRow: (x) => A.vehicleForm(x), pageSize: 15,
      cols: [
        { k: 'veh', l: 'Vehículo', s: (x) => vLabel(x), r: (x) => '<div class="vcard"><img src="' + esc(x.img) + '" alt="" loading="lazy"><div><b class="strong">' + esc(Q.vName(x)) + '</b><br><small class="mut">' + esc(x.version) + ' · ' + x.id + '</small></div></div>' },
        { k: 'cond', l: 'Condición', r: (x) => x.cond === '0km' ? '<span class="bd bd--dark bd--plain">0km ' + x.year + '</span>' : '<span class="bd bd--muted bd--plain">Usado ' + x.year + '</span><br><small class="mut">' + fmt.km(x.km) + ' · ' + esc(x.patente) + '</small>' },
        { k: 'stock', l: 'Stock / estado', s: (x) => x.cond === '0km' ? x.stock : x.status, r: (x) => x.cond === '0km' ? (x.stock ? '<b class="strong">' + x.stock + '</b> u.' : '<span class="bd bd--amber">A pedido</span>') : A.badge(x.status, LABELS.vehicleState) },
        { k: 'price', l: 'Precio', num: true, r: (x) => fmt.money(x.price) },
        { k: 'cost', l: 'Costo', num: true, r: (x) => '<span class="mut">' + fmt.money(x.cost) + '</span>' },
        { k: 'mg', l: 'Margen', num: true, s: (x) => (x.price - x.cost) / x.price, r: (x) => fmt.pct((x.price - x.cost) / x.price * 100) },
        { k: 'ingreso', l: 'Días', num: true, s: (x) => daysBetween(x.ingreso, t), r: (x) => { const dd = daysBetween(x.ingreso, t); return '<span class="' + (dd > 90 ? 'err-t' : dd > 60 ? 'amber-t' : '') + '">' + dd + '</span>'; } },
        { k: 'published', l: 'Web', r: (x) => '<label class="switch" title="Publicar en el sitio"><input type="checkbox" data-pub="' + x.id + '"' + (x.published ? ' checked' : '') + '><span></span></label>' }
      ]
    });
    $('#iTbl').addEventListener('change', (e) => { const p = e.target.dataset.pub; if (p) { DB.update('vehicles', p, { published: e.target.checked }); A.toast(e.target.checked ? 'Publicado en el sitio web' : 'Oculto del sitio web'); } });
    $('#iq').addEventListener('input', (e) => { inv.q = e.target.value; clearTimeout(inv._t); inv._t = setTimeout(() => { A.refresh(); const i = $('#iq'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }, 250); });
    $('#iCond').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { inv.cond = b.dataset.c; A.refresh(); } });
    $('#iBrand').addEventListener('change', (e) => { inv.brand = e.target.value; A.refresh(); });
    $('#iStatus').addEventListener('change', (e) => { inv.status = e.target.value; A.refresh(); });
    $('#iPub').addEventListener('change', (e) => { inv.pub = e.target.value; A.refresh(); });
    $('#iNew').addEventListener('click', () => A.vehicleForm());
    $('#iExp').addEventListener('click', () => A.csv('inventario', [['ID', (x) => x.id], ['Condición', (x) => x.cond], ['Marca', (x) => Q.brandName(x.brand)], ['Modelo', (x) => x.model], ['Versión', (x) => x.version], ['Año', (x) => x.year], ['Km', (x) => x.km], ['Patente', (x) => x.patente], ['Stock', (x) => x.cond === '0km' ? x.stock : 1], ['Estado', (x) => x.status], ['Precio', (x) => x.price], ['Costo', (x) => x.cost], ['Publicado', (x) => x.published ? 'Sí' : 'No']], L));
    if (id) { const x = DB.get('vehicles', id); if (x) { history.replaceState(null, '', '#/inventario'); A.vehicleForm(x); } }
  });
  A.vehicleForm = (x, preset) => {
    const isNew = !x;
    const imgs = [...new Set(DB.data.vehicles.map((y) => y.img))].sort();
    x = x || { cond: '0km', brand: 'chevrolet', year: today().getFullYear(), km: 0, body: 'hatchback', fuel: 'Nafta', trans: 'Manual', seats: 5, stock: 1, status: 'disponible', published: true, featured: false, promoTasa0: false, plazo: 84, pct: 100, tags: [], colors: ['Blanco', 'Gris plata', 'Negro'], img: imgs[0], ...(preset || {}) };
    A.formModal({
      title: isNew ? 'Agregar vehículo' : Q.vName(x) + ' · ' + x.id, sub: isNew ? '' : '<a href="vehiculo.html?id=' + x.id + '" target="_blank" rel="noopener">Ver publicación en el sitio ↗</a>', size: 'lg', values: { ...x, tags: (x.tags || []).join(', '), colors: (x.colors || []).join(', ') },
      pre: '<div id="vfImg" style="margin-bottom:14px"><img src="' + esc(x.img) + '" alt="" style="width:220px;border-radius:10px;aspect-ratio:370/222;object-fit:cover"></div>',
      fields: [{ n: 'cond', l: 'Condición', t: 'select', o: [['0km', '0km'], ['usado', 'Usado']] }, { n: 'brand', l: 'Marca', t: 'select', o: BRANDS.map((b) => [b.id, b.name]).concat([['otra', 'Otra']]) }, { n: 'model', l: 'Modelo', req: true }, { n: 'version', l: 'Versión', req: true },
        { n: 'year', l: 'Año', t: 'number', min: 1990, max: 2030 }, { n: 'km', l: 'Kilómetros', t: 'number', min: 0, step: 100 }, { n: 'body', l: 'Carrocería', t: 'select', o: Object.entries(LABELS.body) }, { n: 'fuel', l: 'Combustible', t: 'select', o: ['Nafta', 'Diésel', 'Híbrido', 'Híbrido enchufable', 'Eléctrico', 'GNC'] },
        { n: 'trans', l: 'Transmisión', t: 'select', o: ['Manual', 'Automática', 'CVT'] }, { n: 'engine', l: 'Motor' }, { n: 'hp', l: 'Potencia (CV)', t: 'number' }, { n: 'seats', l: 'Asientos', t: 'number', min: 1, max: 9 },
        { n: 'price', l: 'Precio de venta', t: 'money', req: true }, { n: 'cost', l: 'Costo', t: 'money', req: true }, { n: 'stock', l: 'Stock (0km)', t: 'number', min: 0 }, { n: 'status', l: 'Estado (usados)', t: 'select', o: Object.entries(LABELS.vehicleState) },
        { n: 'patente', l: 'Patente (usados)' }, { n: 'img', l: 'Imagen', t: 'select', o: imgs.map((s) => [s, s.split('/').pop()]) }, { n: 'cuotaDesde', l: 'Plan: cuota desde', t: 'money', step: 100 }, { n: 'plazo', l: 'Plan: cuotas', t: 'select', o: [[84, '84'], [120, '120']] },
        { n: 'pct', l: 'Plan: % financiado', t: 'select', o: [[60, '60%'], [70, '70%'], [80, '80%'], [100, '100%']] }, { n: 'colors', l: 'Colores', ph: 'Blanco, Negro…' }, { n: 'tags', l: 'Etiquetas', ph: 'Tasa 0%, Nuevo…', full: true },
        { n: 'published', l: 'Publicar en el sitio web', t: 'check' }, { n: 'featured', l: 'Destacado en la home', t: 'check' }, { n: 'promoTasa0', l: 'Promo tasa 0% a 12 meses', t: 'check' }, { n: 'descripcion', l: 'Descripción', t: 'textarea' }],
      foot: [].concat(isNew ? [] : [{ label: 'Eliminar', cls: 'btn--danger', icon: 'trash', act: async (b, close) => { if (DB.data.sales.some((s) => s.vehicleId === x.id)) return A.toast('No se puede eliminar: tiene operaciones asociadas. Despublicalo.'); if (await A.confirm('Eliminar vehículo', 'Se eliminará ' + esc(vLabel(x)) + ' del inventario.', 'Eliminar', true)) { DB.remove('vehicles', x.id); close(); A.toast('Vehículo eliminado'); A.refresh(); } } }], [{ label: 'Cancelar', act: 'close' }, { label: isNew ? 'Agregar' : 'Guardar', cls: 'btn--pri', act: 'ok' }]),
      onOpen: (box) => { $('[name=img]', box).addEventListener('change', (e) => { $('#vfImg img', box).src = e.target.value; }); },
      onOk: (b, f) => {
        f.plazo = +f.plazo; f.pct = +f.pct; f.tags = f.tags ? f.tags.split(',').map((s) => s.trim()).filter(Boolean) : []; f.colors = f.colors ? f.colors.split(',').map((s) => s.trim()).filter(Boolean) : ['Blanco'];
        if (f.cond === 'usado') f.stock = 1;
        if (isNew) {
          const twin = DB.data.vehicles.find((y) => y.brand === f.brand && y.model.toLowerCase() === f.model.toLowerCase());
          const nv = DB.insert('vehicles', { ...f, equip: twin ? twin.equip.slice() : ['ABS', 'Airbags frontales', 'Aire acondicionado', 'Dirección asistida'], consumo: twin ? twin.consumo : '12 km/l', ingreso: iso(today()), cuotaDesde: f.cuotaDesde || (twin ? twin.cuotaDesde : 0) });
          A.toast('Vehículo agregado al stock', ['#/inventario/' + nv.id, 'Ver']);
        } else { DB.update('vehicles', x.id, f); A.toast('Vehículo actualizado'); }
        A.refresh();
      }
    });
  };

  /* ================================================================ VENTAS */
  const vs = { q: '', estado: '', forma: '', seller: '' };
  A.reg('ventas', (v, id) => {
    if (id === 'nueva') return wizard(v);
    if (id) return saleDetail(v, id);
    A.setTitle('Ventas');
    const d = DB.data, t = today(), mk = iso(t).slice(0, 7);
    const L = d.sales.filter((s) => (!vs.estado || s.estado === vs.estado) && (!vs.forma || s.formaPago === vs.forma) && (!vs.seller || s.vendedorId === vs.seller) && (!vs.q || (s.id + ' ' + s.vehiculo + ' ' + ((Q.client(s.clientId) || {}).nombre || '')).toLowerCase().includes(vs.q.toLowerCase())));
    const m = d.sales.filter((s) => s.fecha.startsWith(mk) && s.estado !== 'anulada');
    const fac = sum(m, (s) => s.precio), mg = sum(m, (s) => s.precio - s.costo);
    v.innerHTML = A.ph('Ventas', 'Operaciones de venta, reservas y entregas', '<button class="btn" id="sExp">' + icon('download') + 'Exportar</button><a class="btn btn--pri" href="#/ventas/nueva">' + icon('plus') + 'Nueva operación</a>') +
      '<div class="kpis">' + A.kpi({ label: 'Unidades del mes', icon: 'tag', value: m.length, sub: m.filter((s) => s.cond === 'usado').length + ' usados' }) + A.kpi({ label: 'Facturación del mes', icon: 'cash', value: fmt.moneyShort(fac) }) + A.kpi({ label: 'Ticket promedio', icon: 'chart', value: fmt.moneyShort(m.length ? fac / m.length : 0) }) + A.kpi({ label: 'Margen bruto', icon: 'percent', value: fmt.moneyShort(mg), sub: fmt.pct(fac ? mg / fac * 100 : 0) + ' sobre ventas' }) + A.kpi({ label: 'Pendientes de entrega', icon: 'clock', value: d.sales.filter((s) => ['reservada', 'en_gestion', 'facturada'].includes(s.estado)).length }) + '</div>' +
      '<div class="filters"><label class="search">' + icon('search') + '<input class="inp" id="sq" type="search" placeholder="N°, cliente, vehículo…" value="' + esc(vs.q) + '"></label><select class="inp" id="sEst">' + A.opts(Object.entries(LABELS.saleState), vs.estado, 'Todos los estados') + '</select><select class="inp" id="sForma">' + A.opts(Object.entries(LABELS.payment), vs.forma, 'Todas las formas de pago') + '</select><select class="inp" id="sSeller">' + A.sellerOpts(vs.seller, 'Todos los asesores') + '</select></div><div class="card" id="sTbl"></div>';
    A.table($('#sTbl'), {
      key: 'sales', rows: L, sort: { k: 'fecha', d: -1 }, onRow: (s) => A.go('#/ventas/' + s.id), pageSize: 15,
      cols: [{ k: 'id', l: 'N°', r: (s) => '<b class="strong">' + s.id + '</b>' }, { k: 'fecha', l: 'Fecha', r: (s) => '<span class="nowrap">' + fmt.date(s.fecha) + '</span>' }, { k: 'cliente', l: 'Cliente', s: (s) => (Q.client(s.clientId) || {}).nombre, r: (s) => A.clientLink(s.clientId) },
        { k: 'vehiculo', l: 'Vehículo', r: (s) => esc(s.vehiculo) + '<br><small class="mut">' + (s.cond === '0km' ? '0km' : 'Usado') + ' · ' + esc(s.version) + '</small>' }, { k: 'formaPago', l: 'Pago', r: (s) => LABELS.payment[s.formaPago] },
        { k: 'vendedorId', l: 'Asesor', s: (s) => Q.userName(s.vendedorId), r: (s) => A.userAv(s.vendedorId, 'sm') }, { k: 'precio', l: 'Precio', num: true, r: (s) => fmt.money(s.precio) }, { k: 'estado', l: 'Estado', r: (s) => A.badge(s.estado, LABELS.saleState) }],
      foot: (rows) => [{ v: rows.length + ' operaciones', span: 6 }, { v: fmt.money(sum(rows.filter((s) => s.estado !== 'anulada'), (s) => s.precio)), num: true }, '']
    });
    $('#sq').addEventListener('input', (e) => { vs.q = e.target.value; clearTimeout(vs._t); vs._t = setTimeout(() => { A.refresh(); const i = $('#sq'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }, 250); });
    $('#sEst').addEventListener('change', (e) => { vs.estado = e.target.value; A.refresh(); });
    $('#sForma').addEventListener('change', (e) => { vs.forma = e.target.value; A.refresh(); });
    $('#sSeller').addEventListener('change', (e) => { vs.seller = e.target.value; A.refresh(); });
    $('#sExp').addEventListener('click', () => A.csv('ventas', [['N°', (s) => s.id], ['Fecha', (s) => fmt.date(s.fecha)], ['Cliente', (s) => (Q.client(s.clientId) || {}).nombre], ['Vehículo', (s) => s.vehiculo + ' ' + s.version], ['Condición', (s) => s.cond], ['Forma de pago', (s) => LABELS.payment[s.formaPago]], ['Asesor', (s) => Q.userName(s.vendedorId)], ['Precio', (s) => s.precio], ['Costo', (s) => s.costo], ['Estado', (s) => LABELS.saleState[s.estado]]], L));
  });

  function saleDetail(v, id) {
    const s = DB.get('sales', id); if (!s) { v.innerHTML = A.ph('Operación no encontrada', '', '', ['#/ventas', 'Ventas']); return; }
    A.setTitle('Operación ' + s.id);
    const c = Q.client(s.clientId), veh = DB.get('vehicles', s.vehicleId), cr = s.creditId ? DB.get('credits', s.creditId) : null, pol = s.policyId ? DB.get('policies', s.policyId) : null;
    const order = ['reservada', 'en_gestion', 'facturada', 'entregada'], idx = order.indexOf(s.estado);
    const capital = cr ? cr.capital : 0, margen = s.precio - s.costo, com = s.precio * ((Q.user(s.vendedorId) || {}).comision || 0) / 100;
    v.innerHTML = A.ph('Operación ' + s.id, fmt.dateLong(s.fecha) + ' · ' + A.badge(s.estado, LABELS.saleState), (s.estado !== 'anulada' && idx < 3 ? '<button class="btn btn--ok" id="sAdv">' + icon('check') + 'Pasar a «' + LABELS.saleState[order[idx + 1]] + '»</button>' : '') + '<button class="btn" id="sPrint">' + icon('print') + 'Boleto de compraventa</button>' + (s.estado !== 'anulada' && s.estado !== 'entregada' ? '<button class="btn btn--danger" id="sCancel">' + icon('x') + 'Anular</button>' : ''), ['#/ventas', 'Ventas']) +
      (s.estado !== 'anulada' ? '<div class="card" style="padding:14px 10px;margin-bottom:16px"><div class="stepper">' + order.map((o, i) => '<div class="' + (i <= idx ? 'done' : '') + '">' + LABELS.saleState[o] + '</div>').join('') + '</div></div>' : '<div class="alert alert--err" style="margin-bottom:16px">' + icon('x') + 'Operación anulada</div>') +
      '<div class="grid g3">' + A.card({ title: 'Vehículo', icon: 'car', body: (veh ? '<img src="' + esc(veh.img) + '" alt="" style="border-radius:10px;width:100%;aspect-ratio:370/222;object-fit:cover;margin-bottom:10px">' : '') + '<b class="strong">' + esc(s.vehiculo) + '</b><p class="mut small">' + esc(s.version) + '</p><dl class="dl mt"><dt>Condición</dt><dd>' + (s.cond === '0km' ? '0km' : 'Usado') + '</dd><dt>Color</dt><dd>' + esc(s.color || '—') + '</dd>' + (veh && veh.patente ? '<dt>Patente</dt><dd>' + esc(veh.patente) + '</dd>' : '') + '</dl>' }) +
      A.card({ title: 'Cliente', icon: 'user', body: c ? A.who(c.nombre, 'DNI ' + esc(c.dni)) + '<dl class="dl mt"><dt>Teléfono</dt><dd>' + esc(c.tel) + '</dd><dt>Email</dt><dd>' + esc(c.email) + '</dd><dt>Asesor</dt><dd>' + esc(Q.userName(s.vendedorId)) + '</dd></dl><a class="btn btn--sm mt" href="#/clientes/' + c.id + '?tab=finanzas">' + icon('user') + 'Ficha y estado financiero</a>' : '—' }) +
      A.card({ title: 'Rentabilidad', icon: 'percent', body: '<dl class="dl"><dt>Precio de venta</dt><dd>' + fmt.money(s.precio) + '</dd><dt>Costo de la unidad</dt><dd>' + fmt.money(s.costo) + '</dd><dt>Margen bruto</dt><dd class="ok-t">' + fmt.money(margen) + ' (' + fmt.pct(margen / s.precio * 100) + ')</dd><dt>Comisión asesor</dt><dd>' + fmt.money(com) + '</dd><dt>Gastos de entrega (cliente)</dt><dd>' + fmt.money(s.gastos) + '</dd></dl>' }) + '</div>' +
      '<div class="grid g2 mt">' + A.card({ title: 'Condiciones comerciales', icon: 'cash', body: '<dl class="dl"><dt>Precio de lista</dt><dd>' + fmt.money(s.precioLista) + '</dd><dt>Descuento</dt><dd>' + (s.descuento ? '− ' + fmt.money(s.descuento) : '—') + '</dd><dt>Precio final</dt><dd><b>' + fmt.money(s.precio) + '</b></dd><dt>Forma de pago</dt><dd>' + LABELS.payment[s.formaPago] + '</dd><dt>Anticipo / contado</dt><dd>' + fmt.money(s.anticipo) + '</dd>' + (s.permuta ? '<dt>Usado entregado</dt><dd>' + esc(s.permuta.desc) + ' · ' + fmt.money(s.permuta.valor) + '</dd>' : '') + '<dt>Saldo financiado</dt><dd>' + fmt.money(capital) + '</dd></dl>' + (s.notas ? '<p class="small mut mt">' + esc(s.notas) + '</p>' : '') }) +
      '<div style="display:grid;gap:16px">' + A.card({ title: 'Financiación', icon: 'card', body: cr ? (() => { const st = Fin.creditStatus(cr); return '<dl class="dl"><dt>Crédito</dt><dd><a href="#/cobranzas/' + cr.id + '">' + cr.id + '</a></dd><dt>Plan</dt><dd>' + cr.plazo + ' cuotas de ' + fmt.money(cr.cuota) + '</dd><dt>TNA</dt><dd>' + fmt.pct(cr.tna) + '</dd><dt>Avance</dt><dd>' + st.pagadas + '/' + st.total + '</dd><dt>Estado</dt><dd>' + A.badge(st.estado, LABELS.creditState) + '</dd></dl>'; })() : A.empty(s.formaPago === 'plan' ? 'Entrega por plan de ahorro (liquidado por la administradora)' : 'Sin financiación', 'card') }) +
      A.card({ title: 'Seguro', icon: 'shield', body: pol ? '<dl class="dl"><dt>Póliza</dt><dd><a href="#/seguros?p=' + pol.id + '">' + pol.numero + '</a></dd><dt>Aseguradora</dt><dd>' + esc(Q.insurer(pol.insurerId).nombre) + '</dd><dt>Cobertura</dt><dd>' + esc(Q.coverage(pol.coverage).nombre) + '</dd><dt>Prima</dt><dd>' + fmt.money(pol.primaMensual) + '/mes</dd></dl>' : '<div class="empty">' + icon('shield') + '<span>Sin seguro asociado</span><button class="btn btn--sm" id="sIns">Cotizar seguro</button></div>' }) + '</div></div>';
    const adv = $('#sAdv'); if (adv) adv.addEventListener('click', () => { const nx = order[idx + 1]; s.estado = nx; if (nx === 'entregada' && veh && veh.cond === 'usado') veh.status = 'vendido'; if (nx === 'entregada') DB.insert('appts', { fecha: isoDT(new Date()), duracion: 60, tipo: 'entrega', clientId: s.clientId, leadId: '', nombre: c ? c.nombre : '', tel: c ? c.tel : '', vehiculo: s.vehiculo, asignado: s.vendedorId, estado: 'realizado', notas: 'Entrega de unidad ' + s.id }); DB.save(); A.toast('Operación ' + LABELS.saleState[nx].toLowerCase()); A.refresh(); });
    $('#sPrint').addEventListener('click', () => printBoleto(s));
    const cn = $('#sCancel'); if (cn) cn.addEventListener('click', async () => { if (!(await A.confirm('Anular operación', 'La unidad vuelve al stock disponible. ¿Continuar?', 'Anular', true))) return; s.estado = 'anulada'; if (veh) { if (veh.cond === '0km') veh.stock++; else veh.status = 'disponible'; } DB.save(); A.toast('Operación anulada'); A.refresh(); });
    const si = $('#sIns'); if (si) si.addEventListener('click', () => A.quoteModal({ clientId: s.clientId, value: s.precio, year: veh ? veh.year : today().getFullYear(), vehiculo: s.vehiculo + ' ' + s.version, saleId: s.id }));
  }
  function printBoleto(s) {
    const c = Q.client(s.clientId), cr = s.creditId ? DB.get('credits', s.creditId) : null;
    A.print('Boleto de compraventa ' + s.id, '<div class="box grid"><div><b>Comprador:</b> ' + esc(c.nombre) + '</div><div><b>DNI/CUIT:</b> ' + esc(c.cuit || c.dni) + '</div><div><b>Domicilio:</b> ' + esc(c.direccion + ', ' + c.ciudad) + '</div><div><b>Teléfono:</b> ' + esc(c.tel) + '</div></div>' +
      '<h2>Unidad</h2><table><tr><th>Vehículo</th><th>Versión</th><th>Condición</th><th>Color</th></tr><tr><td>' + esc(s.vehiculo) + '</td><td>' + esc(s.version) + '</td><td>' + (s.cond === '0km' ? '0km' : 'Usado') + '</td><td>' + esc(s.color || '') + '</td></tr></table>' +
      '<h2>Condiciones</h2><table><tr><td>Precio de lista</td><td class="num">' + fmt.money(s.precioLista) + '</td></tr><tr><td>Bonificación</td><td class="num">− ' + fmt.money(s.descuento) + '</td></tr><tr><td><b>Precio final</b></td><td class="num"><b>' + fmt.money(s.precio) + '</b></td></tr><tr><td>Anticipo / pago contado</td><td class="num">' + fmt.money(s.anticipo) + '</td></tr>' + (s.permuta ? '<tr><td>Usado en parte de pago: ' + esc(s.permuta.desc) + '</td><td class="num">' + fmt.money(s.permuta.valor) + '</td></tr>' : '') + (cr ? '<tr><td>Saldo financiado: ' + cr.plazo + ' cuotas de ' + fmt.money(cr.cuota) + ' (TNA ' + fmt.pct(cr.tna) + ')</td><td class="num">' + fmt.money(cr.capital) + '</td></tr>' : '') + '</table>' +
      '<p class="muted">Forma de pago: ' + LABELS.payment[s.formaPago] + '. Los gastos de patentamiento y entrega (' + fmt.money(s.gastos) + ') están a cargo del comprador. La entrega de la unidad queda sujeta a la cancelación del precio o aprobación de la financiación.</p>' +
      '<div class="sign"><div>Firma comprador</div><div>Por ' + esc(cfg().name) + '</div></div>');
  }

  /* --------------------------------------------------------- nueva operación */
  let wz = null;
  function wizard(v) {
    A.setTitle('Nueva operación');
    const qp = A.query(), key = JSON.stringify(qp);
    if (!wz || wz.key !== key) {
      const lead = qp.lead ? DB.get('leads', qp.lead) : null;
      wz = { key, step: 1, leadId: lead ? lead.id : '', clientId: qp.cliente || (lead && lead.clientId) || '', vehicleId: qp.vehiculo || (lead && lead.vehicleId) || '', forma: lead && lead.formaPago ? lead.formaPago : 'financiado', descuento: 0, anticipo: null, permDesc: '', permValor: 0, plazo: 24, tna: null, ins: '', cov: '', vendedorId: (lead && lead.vendedorId) || me().id, estado: 'reservada', color: '', notas: '', vq: '', vcond: '' };
    }
    const w = wz, c = w.clientId ? Q.client(w.clientId) : null, veh = w.vehicleId ? DB.get('vehicles', w.vehicleId) : null, lead = w.leadId ? DB.get('leads', w.leadId) : null;
    const precio = veh ? veh.price - (w.descuento || 0) : 0;
    if (veh && w.anticipo == null) w.anticipo = w.forma === 'contado' ? precio : w.forma === 'plan' ? 0 : round(precio * 0.4, 10000);
    if (veh && w.tna == null) w.tna = veh.promoTasa0 && w.plazo <= 12 ? cfg().tnaPromo : cfg().tna;
    const perm = w.forma === 'permuta' ? w.permValor || 0 : 0;
    const capital = veh && ['financiado', 'permuta'].includes(w.forma) ? Math.max(0, precio - w.anticipo - perm) : 0;
    const cuota = Fin.cuota(capital, w.tna || 0, w.plazo);
    const ins = w.ins ? Q.insurer(w.ins) : null, cov = w.cov ? Q.coverage(w.cov) : null, prima = ins && cov && veh ? Fin.quote(precio, veh.year, cov, ins) : 0;
    const steps = ['Cliente', 'Vehículo', 'Condiciones', 'Seguro', 'Confirmar'];
    v.innerHTML = A.ph('Nueva operación de venta', lead ? 'Desde el lead <a href="#/crm/' + lead.id + '">' + esc(lead.nombre) + '</a>' : 'Reserva, financiación, seguro y entrega en un solo flujo', '', ['#/ventas', 'Ventas']) +
      '<div class="steps">' + steps.map((s, i) => '<button data-s="' + (i + 1) + '" class="' + (w.step === i + 1 ? 'on' : w.step > i + 1 ? 'done' : '') + '"><b>' + (w.step > i + 1 ? '✓' : i + 1) + '</b>' + s + '</button>').join('') + '</div><div class="grid g-21"><div id="wzBody"></div><div id="wzSum"></div></div>';
    // resumen lateral
    $('#wzSum').innerHTML = '<div class="sumbox" style="position:sticky;top:80px"><b style="font-size:.8rem;text-transform:uppercase;letter-spacing:.08em;color:#aab0ba">Resumen</b><dl class="dl"><dt>Cliente</dt><dd>' + (c ? esc(c.nombre) : '—') + '</dd><dt>Vehículo</dt><dd>' + (veh ? esc(Q.vName(veh)) : '—') + '</dd><dt>Precio final</dt><dd>' + (veh ? fmt.money(precio) : '—') + '</dd><dt>Forma de pago</dt><dd>' + LABELS.payment[w.forma] + '</dd>' + (veh && w.forma !== 'plan' ? '<dt>Anticipo</dt><dd>' + fmt.money(w.anticipo) + '</dd>' : '') + (perm ? '<dt>Usado</dt><dd>' + fmt.money(perm) + '</dd>' : '') + (capital ? '<dt>A financiar</dt><dd>' + fmt.money(capital) + '</dd>' : '') + (prima ? '<dt>Seguro</dt><dd>' + fmt.money(prima) + '/mes</dd>' : '') + '</dl>' + (capital ? '<div style="border-top:1px solid #2a3038;padding-top:10px"><span style="color:#aab0ba;font-size:.8rem">' + w.plazo + ' cuotas de</span><div class="big">' + fmt.money(cuota) + '</div></div>' : '') + '</div>';
    const body = $('#wzBody');
    const nav = (back, next, nextLabel, disabled) => '<div style="display:flex;gap:8px;justify-content:space-between;margin-top:16px">' + (back ? '<button class="btn" data-go="' + back + '">← Atrás</button>' : '<span></span>') + (next ? '<button class="btn btn--pri" data-go="' + next + '"' + (disabled ? ' disabled' : '') + '>' + (nextLabel || 'Continuar →') + '</button>' : '') + '</div>';
    if (w.step === 1) {
      const f = c ? Q.clientFinance(c.id) : null;
      body.innerHTML = A.card({ title: 'Seleccioná el cliente', icon: 'user', acts: '<button class="btn btn--sm" id="wzNewC">' + icon('plus') + 'Nuevo cliente</button>', body: (lead && !lead.clientId && !c ? '<div class="alert alert--info" style="margin-bottom:12px">' + icon('info') + '<span>El lead <b>' + esc(lead.nombre) + '</b> todavía no es cliente. <a href="#" id="wzConv">Crealo con sus datos</a> o elegí uno existente.</span></div>' : '') +
        '<label class="fld">Cliente<select class="inp" id="wzC">' + A.opts(DB.data.clients.slice().sort((a, b) => a.nombre.localeCompare(b.nombre)).map((x) => [x.id, x.nombre + ' · DNI ' + x.dni]), w.clientId, '— Elegí un cliente —') + '</select></label>' +
        (f ? '<div class="grid g3 mt">' + A.kpi({ label: 'Riesgo', value: f.riesgo, sub: 'Score ' + c.score + ' · BCRA ' + c.bcra }) + A.kpi({ label: 'Ingresos', value: fmt.money(c.ingresos), sub: 'Compromisos ' + fmt.money(f.cuotaMensual) }) + A.kpi({ label: 'Margen de cuota', value: fmt.money(f.capacidad), sub: 'disponible por mes', alert: f.capacidad <= 0 }) + '</div>' + (f.vencido ? '<div class="alert alert--err">' + icon('alert') + '<span>El cliente tiene ' + fmt.money(f.vencido) + ' vencidos (' + f.diasMora + ' días). Regularizar antes de financiar.</span></div>' : '') : '') + nav(0, 2, null, !c) });
      $('#wzC').addEventListener('change', (e) => { w.clientId = e.target.value; A.refresh(); });
      $('#wzNewC').addEventListener('click', () => A.clientForm(lead ? { nombre: lead.nombre, tel: lead.tel, email: lead.email, ciudad: lead.ciudad, vendedorId: lead.vendedorId } : null, (nc) => { w.clientId = nc.id; if (lead) { lead.clientId = nc.id; DB.save(); } A.refresh(); }));
      const cv = $('#wzConv'); if (cv) cv.addEventListener('click', (e) => { e.preventDefault(); $('#wzNewC').click(); });
    } else if (w.step === 2) {
      const pool = DB.data.vehicles.filter((x) => (x.cond === '0km' || x.status === 'disponible' || x.id === w.vehicleId) && (!w.vcond || x.cond === w.vcond) && (!w.vq || vLabel(x).toLowerCase().includes(w.vq.toLowerCase())));
      body.innerHTML = A.card({ title: 'Elegí la unidad', icon: 'car', body: '<div class="filters"><label class="search">' + icon('search') + '<input class="inp" id="wzVq" placeholder="Buscar modelo…" value="' + esc(w.vq) + '"></label><div class="seg" id="wzVc">' + [['', 'Todos'], ['0km', '0km'], ['usado', 'Usados']].map(([k, l]) => '<button data-c="' + k + '"' + (w.vcond === k ? ' class="on"' : '') + '>' + l + '</button>').join('') + '</div></div>' +
        '<div class="pick">' + pool.map((x) => '<label><input type="radio" name="veh" value="' + x.id + '"' + (x.id === w.vehicleId ? ' checked' : '') + '><img src="' + esc(x.img) + '" alt="" loading="lazy"><div><b>' + esc(Q.vName(x)) + '</b>' + esc(x.version) + '<br><span class="mut">' + (x.cond === '0km' ? (x.stock ? 'Stock: ' + x.stock : 'A pedido') : 'Usado ' + x.year + ' · ' + fmt.km(x.km)) + '</span><br><b>' + fmt.money(x.price) + '</b></div></label>').join('') + '</div>' +
        (veh ? '<label class="fld mt" style="max-width:260px">Color<select class="inp" id="wzColor">' + A.opts(veh.colors, w.color || veh.colors[0]) + '</select></label>' : '') + nav(1, 3, null, !veh) });
      $$('input[name=veh]', body).forEach((r) => r.addEventListener('change', () => { w.vehicleId = r.value; w.anticipo = null; w.tna = null; w.color = ''; A.refresh(); }));
      $('#wzVq').addEventListener('input', (e) => { w.vq = e.target.value; clearTimeout(w._t); w._t = setTimeout(() => { A.refresh(); const i = $('#wzVq'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }, 250); });
      $('#wzVc').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { w.vcond = b.dataset.c; A.refresh(); } });
      const col = $('#wzColor'); if (col) { w.color = col.value; col.addEventListener('change', () => { w.color = col.value; }); }
    } else if (w.step === 3) {
      const f = Q.clientFinance(c.id), ratio = c.ingresos ? (f.cuotaMensual + cuota) / c.ingresos * 100 : 0;
      body.innerHTML = A.card({ title: 'Condiciones comerciales', icon: 'cash', body: '<div class="opts" id="wzForma">' + Object.entries(LABELS.payment).map(([k, l]) => '<label><input type="radio" name="forma" value="' + k + '"' + (w.forma === k ? ' checked' : '') + '><b>' + l + '</b><small>' + ({ contado: 'Pago total de la unidad', financiado: 'Anticipo + crédito prendario', plan: 'Entrega por adjudicación', permuta: 'Usado + saldo financiado' })[k] + '</small></label>').join('') + '</div>' +
        '<div class="fgrid mt"><label class="fld">Precio de lista<input class="inp" value="' + fmt.money(veh.price) + '" readonly></label><label class="fld">Bonificación / descuento<input class="inp" type="number" step="10000" id="wzDesc" value="' + (w.descuento || 0) + '"></label>' +
        (w.forma !== 'plan' ? '<label class="fld">' + (w.forma === 'contado' ? 'Pago contado' : 'Anticipo') + '<input class="inp" type="number" step="10000" id="wzAnt" value="' + Math.round(w.anticipo) + '"><small>' + fmt.pct(precio ? w.anticipo / precio * 100 : 0) + ' del precio</small></label>' : '') +
        (w.forma === 'permuta' ? '<label class="fld">Usado que entrega<input class="inp" id="wzPd" placeholder="Ej.: VW Gol Trend 2016" value="' + esc(w.permDesc) + '"></label><label class="fld">Valor de toma<input class="inp" type="number" step="50000" id="wzPv" value="' + (w.permValor || 0) + '"></label>' : '') +
        (['financiado', 'permuta'].includes(w.forma) ? '<label class="fld">Plazo<select class="inp" id="wzPlazo">' + A.opts([6, 12, 18, 24, 36, 48, 60].map((n) => [n, n + ' cuotas']), w.plazo) + '</select></label><label class="fld">TNA %<input class="inp" type="number" step="0.1" id="wzTna" value="' + w.tna + '">' + (veh.promoTasa0 ? '<small>Este modelo tiene tasa 0% hasta 12 cuotas</small>' : '') + '</label>' : '') + '</div>' +
        (capital ? '<div class="alert ' + (ratio > 35 ? 'alert--err' : ratio > 25 ? 'alert--warn' : 'alert--ok') + ' mt">' + icon(ratio > 35 ? 'alert' : 'check') + '<span>Con esta cuota los compromisos del cliente serían <b>' + fmt.pct(ratio) + '</b> de sus ingresos' + (ratio > 35 ? ' — supera el 35% recomendado. Sugerí más anticipo o más plazo.' : '.') + '</span></div>' : '') +
        (w.forma === 'plan' ? '<div class="alert alert--info mt">' + icon('info') + '<span>La administradora del plan liquida el valor de la unidad a la concesionaria al momento de la entrega.</span></div>' : '') + nav(2, 4) });
      $$('input[name=forma]', body).forEach((r) => r.addEventListener('change', () => { w.forma = r.value; w.anticipo = null; A.refresh(); }));
      const bind = (sel, fn) => { const el = $(sel, body); if (el) el.addEventListener('change', () => { fn(el.value); A.refresh(); }); };
      bind('#wzDesc', (x) => { w.descuento = +x || 0; if (w.forma === 'contado') w.anticipo = null; });
      bind('#wzAnt', (x) => { w.anticipo = Math.max(0, Math.min(precio, +x || 0)); });
      bind('#wzPd', (x) => { w.permDesc = x; }); bind('#wzPv', (x) => { w.permValor = +x || 0; });
      bind('#wzPlazo', (x) => { w.plazo = +x; w.tna = veh.promoTasa0 && w.plazo <= 12 ? cfg().tnaPromo : cfg().tna; }); bind('#wzTna', (x) => { w.tna = +x; });
    } else if (w.step === 4) {
      const covs = DB.data.coverages, insL = DB.data.insurers;
      body.innerHTML = A.card({ title: 'Seguro para la unidad', icon: 'shield', sub: 'Suma asegurada ' + fmt.money(precio), body: '<div class="tw"><table class="tbl"><thead><tr><th>Aseguradora</th>' + covs.map((cv) => '<th class="num">' + esc(cv.nombre) + '</th>').join('') + '</tr></thead><tbody>' + insL.map((i) => '<tr><td><b class="strong"><span class="temp" style="background:' + i.color + '"></span> ' + esc(i.nombre) + '</b><br><small class="mut">Comisión ' + i.comision + '%</small></td>' + covs.map((cv) => { const p = Fin.quote(precio, veh.year, cv, i); return '<td class="num"><label style="display:inline-flex;gap:6px;align-items:center;cursor:pointer"><input type="radio" name="ins" value="' + i.id + '|' + cv.id + '"' + (w.ins === i.id && w.cov === cv.id ? ' checked' : '') + '> ' + fmt.money(p) + '</label></td>'; }).join('') + '</tr>').join('') + '</tbody></table></div><label class="fld--check fld mt"><input type="radio" name="ins" value=""' + (!w.ins ? ' checked' : '') + '> Sin seguro (el cliente lo contrata por su cuenta)</label>' + nav(3, 5) });
      $$('input[name=ins]', body).forEach((r) => r.addEventListener('change', () => { const [i, cv] = r.value.split('|'); w.ins = i || ''; w.cov = cv || ''; A.refresh(); }));
    } else {
      body.innerHTML = A.card({ title: 'Confirmar operación', icon: 'check', body: '<dl class="dl"><dt>Cliente</dt><dd>' + esc(c.nombre) + ' · DNI ' + esc(c.dni) + '</dd><dt>Unidad</dt><dd>' + esc(Q.vFull(veh)) + ' · ' + esc(w.color || veh.colors[0]) + '</dd><dt>Precio final</dt><dd>' + fmt.money(precio) + '</dd><dt>Forma de pago</dt><dd>' + LABELS.payment[w.forma] + '</dd>' + (w.forma !== 'plan' ? '<dt>Anticipo</dt><dd>' + fmt.money(w.anticipo) + '</dd>' : '') + (perm ? '<dt>Usado</dt><dd>' + esc(w.permDesc || 'Usado') + ' · ' + fmt.money(perm) + '</dd>' : '') + (capital ? '<dt>Financiación</dt><dd>' + w.plazo + ' × ' + fmt.money(cuota) + ' · TNA ' + fmt.pct(w.tna) + '</dd>' : '') + (prima ? '<dt>Seguro</dt><dd>' + esc(cov.nombre) + ' · ' + esc(ins.nombre) + ' · ' + fmt.money(prima) + '/mes</dd>' : '') + '</dl>' +
        '<div class="fgrid mt"><label class="fld">Asesor<select class="inp" id="wzSel">' + A.sellerOpts(w.vendedorId) + '</select></label><label class="fld">Estado inicial<select class="inp" id="wzEst">' + A.opts(['reservada', 'en_gestion', 'facturada', 'entregada'].map((k) => [k, LABELS.saleState[k]]), w.estado) + '</select></label><label class="fld fld--full">Notas<textarea class="inp" id="wzNotas">' + esc(w.notas) + '</textarea></label></div>' +
        (precio - (w.forma === 'plan' ? precio : w.anticipo + perm + capital) > 1 && w.forma !== 'contado' ? '' : '') +
        '<div style="display:flex;gap:8px;justify-content:space-between;margin-top:16px;flex-wrap:wrap"><button class="btn" data-go="4">← Atrás</button><div style="display:flex;gap:8px"><button class="btn" id="wzQuote">' + icon('print') + 'Imprimir presupuesto</button><button class="btn btn--ok" id="wzOk">' + icon('check') + 'Confirmar operación</button></div></div>' });
      ['#wzSel', '#wzEst', '#wzNotas'].forEach((s) => $(s).addEventListener('change', (e) => { w[{ '#wzSel': 'vendedorId', '#wzEst': 'estado', '#wzNotas': 'notas' }[s]] = e.target.value; }));
      $('#wzQuote').addEventListener('click', () => A.printQuote(c, veh));
      $('#wzOk').addEventListener('click', () => confirmSale({ c, veh, precio, perm, capital, cuota, ins, cov, prima, lead }));
    }
    $$('[data-go]', v).forEach((b) => b.addEventListener('click', () => { if (b.disabled) return; w.step = +b.dataset.go; A.refresh(); window.scrollTo(0, 0); }));
    $$('.steps button', v).forEach((b) => b.addEventListener('click', () => { const s = +b.dataset.s; if (s === 1 || (s >= 2 && c) && (s <= 2 || veh)) { w.step = s; A.refresh(); } }));
  }
  function confirmSale(o) {
    const w = wz, d = DB.data, f = iso(today());
    const sale = DB.insert('sales', { fecha: f, clientId: o.c.id, vehicleId: o.veh.id, vehiculo: Q.vName(o.veh), version: o.veh.version, cond: o.veh.cond, vendedorId: w.vendedorId, precioLista: o.veh.price, descuento: w.descuento || 0, precio: o.precio, formaPago: w.forma, anticipo: w.forma === 'plan' ? 0 : w.anticipo, permuta: o.perm ? { desc: w.permDesc || 'Usado', valor: o.perm } : null, creditId: null, policyId: null, estado: w.estado, costo: o.veh.cost, gastos: round(o.precio * cfg().patentamiento / 100, 1000), color: w.color || o.veh.colors[0], notas: w.notas });
    const mv = (tipo, cat, monto, ref) => d.moves.push({ id: DB.nextId('moves'), fecha: f, tipo, categoria: cat, monto: Math.round(monto), medio: 'Transferencia', ref, clientId: o.c.id });
    if (sale.anticipo) mv('ingreso', w.forma === 'contado' ? 'Venta de unidades' : 'Anticipo de venta', sale.anticipo, sale.id);
    if (w.forma === 'plan') mv('ingreso', 'Liquidación plan de ahorro', o.precio, sale.id);
    mv('egreso', 'Compra de unidades', o.veh.cost, sale.id);
    if (o.capital > 0) {
      const cr = DB.insert('credits', { clientId: o.c.id, saleId: sale.id, entidad: 'Financiación propia', tipo: 'Prendario', capital: o.capital, tna: w.tna, plazo: w.plazo, cuota: Math.round(o.cuota), inicio: f, cuotas: Fin.schedule(o.capital, w.tna, w.plazo, f), gestor: 'U6' });
      sale.creditId = cr.id; mv('ingreso', 'Fondeo bancario de créditos', o.capital, cr.id);
    }
    if (o.ins && o.cov) {
      const pol = DB.insert('policies', { clientId: o.c.id, saleId: sale.id, insurerId: o.ins.id, coverage: o.cov.id, numero: String(10 + Math.floor(Math.random() * 89)) + '-' + (100000 + Math.floor(Math.random() * 899999)), vehiculo: Q.vFull(o.veh), patente: o.veh.patente || 'A confirmar', sumaAsegurada: o.precio, primaMensual: o.prima, inicio: f, vencimiento: iso(addMonths(f, 12)), estado: 'vigente', productor: 'U7', siniestros: [] });
      sale.policyId = pol.id;
    }
    if (o.veh.cond === '0km') o.veh.stock = Math.max(0, o.veh.stock - 1); else o.veh.status = w.estado === 'entregada' ? 'vendido' : 'reservado';
    if (o.perm) {
      const m = (w.permDesc || 'Usado').match(/(19|20)\d{2}/); const parts = (w.permDesc || 'Otra Usado').replace(/(19|20)\d{2}/, '').trim().split(/\s+/);
      DB.data.vehicles.push({ id: DB.nextId('vehicles'), cond: 'usado', brand: (parts.shift() || 'otra').toLowerCase(), model: parts.join(' ') || 'Usado', version: 'A peritar', body: 'hatchback', fuel: 'Nafta', trans: 'Manual', engine: '—', hp: 0, seats: 5, year: m ? +m[0] : today().getFullYear() - 8, km: 0, price: round(o.perm * 1.15, 50000), cost: o.perm, stock: 1, status: 'disponible', img: o.veh.img, tags: ['Recién ingresado'], colors: ['A confirmar'], equip: [], consumo: '—', featured: false, published: false, promoTasa0: false, cuotaDesde: 0, plazo: 84, pct: 100, ingreso: f, patente: '', descripcion: 'Ingresado como parte de pago en ' + sale.id + '.' });
    }
    if (o.lead) { o.lead.etapa = 'ganado'; o.lead.clientId = o.c.id; A.addActivity(o.lead, 'nota', 'Operación ' + sale.id + ' confirmada (' + LABELS.payment[w.forma] + ').'); }
    DB.notify('Nueva venta ' + sale.id + ': ' + Q.vName(o.veh) + ' a ' + o.c.nombre + ' (' + fmt.money(o.precio) + ')', 'pago', '#/ventas/' + sale.id);
    DB.save(); wz = null;
    A.toast('¡Operación ' + sale.id + ' registrada!');
    A.go('#/ventas/' + sale.id);
  }

  /* ================================================== FINANCIACIÓN Y COBRANZAS */
  const co = { tab: 'vencidas', q: '' };
  A.reg('cobranzas', (v, id) => {
    if (id) return creditDetail(v, id);
    A.setTitle('Financiación y cobranzas');
    const d = DB.data, t = today(), mk = iso(t).slice(0, 7);
    const rows = d.credits.map((c) => ({ c, s: Fin.creditStatus(c, t), cl: Q.client(c.clientId) }));
    const act = rows.filter((r) => r.s.estado !== 'cancelado');
    const cartera = sum(act, (r) => r.s.saldoTotal), venc = sum(rows, (r) => r.s.montoVencido), pun = sum(rows, (r) => r.s.punitorios);
    const cobM = sum(d.moves.filter((m) => m.categoria === 'Cobranza de cuotas' && m.fecha.startsWith(mk)), (m) => m.monto);
    const next30 = rows.flatMap((r) => r.c.cuotas.filter((q) => !q.pagada && q.vto >= iso(t) && q.vto <= iso(addDays(t, 30))).map((q) => ({ ...q, r })));
    const mora = rows.filter((r) => r.s.estado === 'en_mora').filter((r) => !co.q || (r.cl.nombre + r.c.id).toLowerCase().includes(co.q.toLowerCase()));
    v.innerHTML = A.ph('Financiación y cobranzas', 'Cartera de créditos prendarios propios, mora y gestión de cobro', '<button class="btn" id="coExp">' + icon('download') + 'Exportar mora</button><a class="btn btn--pri" href="#/ventas/nueva">' + icon('plus') + 'Nueva financiación</a>') +
      '<div class="kpis">' + A.kpi({ label: 'Cartera activa', icon: 'card', value: fmt.moneyShort(cartera), sub: act.length + ' créditos' }) + A.kpi({ label: 'Monto vencido', icon: 'alert', value: fmt.moneyShort(venc), alert: venc > 0, sub: mora.length + ' clientes en mora' }) + A.kpi({ label: 'Índice de morosidad', icon: 'percent', value: fmt.pct(cartera ? venc / cartera * 100 : 0), sub: 'vencido / cartera' }) + A.kpi({ label: 'Punitorios devengados', icon: 'clock', value: fmt.moneyShort(pun), sub: cfg().punitorioDiario + '% diario' }) + A.kpi({ label: 'Cobrado este mes', icon: 'cash', value: fmt.moneyShort(cobM) }) + A.kpi({ label: 'A cobrar 30 días', icon: 'calendar', value: fmt.moneyShort(sum(next30, (q) => q.monto)), sub: next30.length + ' cuotas' }) + '</div>' +
      '<div class="grid g2">' + A.card({ title: 'Antigüedad de la deuda vencida', icon: 'alert', bodyId: 'coAging' }) + A.card({ title: 'Cobranzas últimos 12 meses', icon: 'chart', bodyId: 'coChart' }) + '</div>' +
      '<div class="tabs mt" id="coTabs">' + [['vencidas', 'Cuotas vencidas', mora.length], ['proximas', 'Próximos vencimientos', next30.length], ['creditos', 'Todos los créditos', rows.length], ['sim', 'Simulador']].map(([k, l, n]) => '<button data-t="' + k + '"' + (co.tab === k ? ' class="on"' : '') + '>' + l + (n != null ? '<span class="cnt">' + n + '</span>' : '') + '</button>').join('') + '</div><div id="coBody"></div>';
    const buckets = ['1-30', '31-60', '61-90', '+90'], bcol = [C.STATUS.warning, C.STATUS.serious, C.STATUS.critical, '#8f1f1f'];
    const bAmt = buckets.map((b) => sum(rows.filter((r) => Fin.aging(r.s.diasMora) === b), (r) => r.s.montoVencido));
    C.hbars($('#coAging'), { items: buckets.map((b, i) => ({ label: b + ' días', value: bAmt[i], color: bcol[i], display: fmt.moneyShort(bAmt[i]) + ' · ' + rows.filter((r) => Fin.aging(r.s.diasMora) === b).length + ' cl.' })), fmt: fmt.moneyShort });
    $('#coAging').insertAdjacentHTML('afterbegin', '<p class="small" style="margin-bottom:12px"><span class="bd bd--ok">Al día</span> ' + act.filter((r) => r.s.estado === 'al_dia').length + ' créditos · saldo ' + fmt.money(sum(act.filter((r) => r.s.estado === 'al_dia'), (r) => r.s.saldoTotal)) + '</p>');
    $('#coAging').insertAdjacentHTML('beforeend', '<p class="small mut" style="margin-top:12px">Tramos de mora según días desde la cuota impaga más antigua. Gestión sugerida: 1-30 recordatorio · 31-60 llamado + carta · 61-90 intimación · +90 gestión judicial / secuestro prendario.</p>');
    const keys = A.monthKeys(12);
    C.bar($('#coChart'), { labels: keys.map(A.mLabel), series: [{ name: 'Cobranzas', data: keys.map((k) => sum(d.moves.filter((m) => m.categoria === 'Cobranza de cuotas' && m.fecha.startsWith(k)), (m) => m.monto)) }], fmt: fmt.money, fmtAxis: fmt.moneyShort, height: 220 });
    const body = $('#coBody');
    if (co.tab === 'vencidas') {
      body.innerHTML = '<div class="filters"><label class="search">' + icon('search') + '<input class="inp" id="coq" type="search" placeholder="Cliente o crédito…" value="' + esc(co.q) + '"></label></div><div class="card" id="coTbl"></div>';
      A.table($('#coTbl'), {
        key: 'mora', rows: mora, sort: { k: 'dias', d: -1 }, onRow: (r) => A.go('#/clientes/' + r.cl.id + '?tab=finanzas'),
        cols: [{ k: 'cl', l: 'Cliente', s: (r) => r.cl.nombre, r: (r) => A.who(r.cl.nombre, esc(r.cl.tel)) }, { k: 'cr', l: 'Crédito', s: (r) => r.c.id, r: (r) => '<a href="#/cobranzas/' + r.c.id + '">' + r.c.id + '</a><br><small class="mut">' + fmt.money(r.c.cuota) + '/mes</small>' },
          { k: 'venc', l: 'Cuotas venc.', num: true, s: (r) => r.s.vencidas, r: (r) => r.s.vencidas }, { k: 'dias', l: 'Días', num: true, s: (r) => r.s.diasMora, r: (r) => '<b class="err-t">' + r.s.diasMora + '</b>' },
          { k: 'tramo', l: 'Tramo', s: (r) => r.s.diasMora, r: (r) => { const b = Fin.aging(r.s.diasMora); return '<span class="bd bd--' + (b === '1-30' ? 'amber' : b === '31-60' ? 'orange' : 'err') + '">' + b + ' d</span>'; } },
          { k: 'monto', l: 'Vencido', num: true, s: (r) => r.s.montoVencido, r: (r) => fmt.money(r.s.montoVencido) }, { k: 'pun', l: 'Punitorios', num: true, s: (r) => r.s.punitorios, r: (r) => fmt.money(r.s.punitorios) },
          { k: 'acc', l: '', sortable: false, r: (r) => '<div style="display:flex;gap:4px;justify-content:flex-end"><a class="btn btn--xs btn--wa" target="_blank" rel="noopener" href="' + waLink(A.waNum(r.cl.tel), 'Hola ' + r.cl.nombre.split(' ')[0] + ', te recordamos que tenés ' + r.s.vencidas + ' cuota(s) vencida(s) del crédito ' + r.c.id + ' por ' + fmt.money(r.s.montoVencido) + '. ¿Coordinamos el pago? ' + cfg().name) + '">' + icon('whatsapp') + '</a><a class="btn btn--xs" href="tel:' + esc(r.cl.tel.replace(/\s/g, '')) + '">' + icon('phone') + '</a><button class="btn btn--xs btn--ok" data-pay="' + r.c.id + '">' + icon('cash') + 'Cobrar</button></div>' }],
        foot: (rs) => [{ v: rs.length + ' clientes', span: 5 }, { v: fmt.money(sum(rs, (r) => r.s.montoVencido)), num: true }, { v: fmt.money(sum(rs, (r) => r.s.punitorios)), num: true }, ''], empty: 'No hay cuotas vencidas 🎉'
      });
      $('#coq').addEventListener('input', (e) => { co.q = e.target.value; clearTimeout(co._t); co._t = setTimeout(() => { A.refresh(); const i = $('#coq'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }, 250); });
    } else if (co.tab === 'proximas') {
      body.innerHTML = '<div class="card" id="coTbl"></div>';
      A.table($('#coTbl'), { key: 'next', rows: next30, sort: { k: 'vto', d: 1 }, cols: [{ k: 'vto', l: 'Vencimiento', r: (q) => '<b class="strong">' + fmt.date(q.vto) + '</b><br><small class="mut">en ' + daysBetween(t, q.vto) + ' días</small>' }, { k: 'cl', l: 'Cliente', s: (q) => q.r.cl.nombre, r: (q) => A.clientLink(q.r.cl.id) }, { k: 'cr', l: 'Crédito', s: (q) => q.r.c.id, r: (q) => q.r.c.id + ' · cuota ' + q.n + '/' + q.r.c.plazo }, { k: 'monto', l: 'Monto', num: true, r: (q) => fmt.money(q.monto) }, { k: 'acc', l: '', sortable: false, r: (q) => '<div style="display:flex;gap:4px;justify-content:flex-end"><a class="btn btn--xs btn--wa" target="_blank" rel="noopener" href="' + waLink(A.waNum(q.r.cl.tel), 'Hola ' + q.r.cl.nombre.split(' ')[0] + ', te recordamos que el ' + fmt.date(q.vto) + ' vence la cuota ' + q.n + ' de tu crédito por ' + fmt.money(q.monto) + '. ¡Gracias!') + '">' + icon('whatsapp') + 'Recordar</a><button class="btn btn--xs btn--ok" data-pay="' + q.r.c.id + '">Cobrar</button></div>' }], foot: (rs) => [{ v: rs.length + ' cuotas', span: 3 }, { v: fmt.money(sum(rs, (q) => q.monto)), num: true }, ''] });
    } else if (co.tab === 'creditos') {
      body.innerHTML = '<div class="card" id="coTbl"></div>';
      A.table($('#coTbl'), { key: 'creds', rows, sort: { k: 'inicio', d: -1 }, onRow: (r) => A.go('#/cobranzas/' + r.c.id), pageSize: 15, cols: [{ k: 'id', l: 'Crédito', s: (r) => r.c.id, r: (r) => '<b class="strong">' + r.c.id + '</b>' }, { k: 'cl', l: 'Cliente', s: (r) => r.cl.nombre, r: (r) => A.clientLink(r.cl.id) }, { k: 'inicio', l: 'Otorgado', s: (r) => r.c.inicio, r: (r) => fmt.date(r.c.inicio) }, { k: 'cap', l: 'Capital', num: true, s: (r) => r.c.capital, r: (r) => fmt.money(r.c.capital) }, { k: 'tna', l: 'TNA', num: true, s: (r) => r.c.tna, r: (r) => fmt.pct(r.c.tna) }, { k: 'cuota', l: 'Cuota', num: true, s: (r) => r.c.cuota, r: (r) => fmt.money(r.c.cuota) }, { k: 'av', l: 'Avance', s: (r) => r.s.avance, r: (r) => '<span class="small">' + r.s.pagadas + '/' + r.s.total + '</span>' + A.prog(r.s.avance, r.s.estado === 'en_mora' ? 'err' : 'ok') }, { k: 'saldo', l: 'Saldo', num: true, s: (r) => r.s.saldoTotal, r: (r) => fmt.money(r.s.saldoTotal) }, { k: 'estado', l: 'Estado', s: (r) => r.s.estado, r: (r) => A.badge(r.s.estado, LABELS.creditState) }] });
    } else {
      const sim = co.sim || (co.sim = { capital: 20000000, tna: cfg().tna, plazo: 24 });
      const sched = Fin.schedule(sim.capital, sim.tna, sim.plazo, iso(t)), tot = sum(sched, (q) => q.monto);
      body.innerHTML = '<div class="grid g-12">' + A.card({ title: 'Parámetros', icon: 'percent', body: '<form id="simF" class="fgrid" style="grid-template-columns:1fr">' + '<label class="fld">Capital<input class="inp" name="capital" type="number" step="100000" value="' + sim.capital + '"></label><label class="fld">TNA %<input class="inp" name="tna" type="number" step="0.1" value="' + sim.tna + '"></label><label class="fld">Plazo (meses)<select class="inp" name="plazo">' + A.opts([6, 12, 18, 24, 36, 48, 60], sim.plazo) + '</select></label></form><div class="sumbox mt"><span style="color:#aab0ba;font-size:.8rem">Cuota (sistema francés)</span><div class="big">' + fmt.money(sched[0].monto) + '</div><dl class="dl"><dt>Total a pagar</dt><dd>' + fmt.money(tot) + '</dd><dt>Intereses</dt><dd>' + fmt.money(tot - sim.capital) + '</dd><dt>TEA</dt><dd>' + fmt.pct((Math.pow(1 + sim.tna / 1200, 12) - 1) * 100) + '</dd></dl></div>' }) +
        A.card({ title: 'Cronograma de pagos', icon: 'list', flush: true, body: '<div class="tw" style="max-height:520px"><table class="tbl"><thead><tr><th>N°</th><th>Vencimiento</th><th class="num">Capital</th><th class="num">Interés</th><th class="num">Cuota</th><th class="num">Saldo</th></tr></thead><tbody>' + sched.map((q) => '<tr><td>' + q.n + '</td><td>' + fmt.date(q.vto) + '</td><td class="num">' + fmt.money(q.capital) + '</td><td class="num">' + fmt.money(q.interes) + '</td><td class="num"><b>' + fmt.money(q.monto) + '</b></td><td class="num">' + fmt.money(q.saldo) + '</td></tr>').join('') + '</tbody></table></div>' }) + '</div>';
      $('#simF').addEventListener('change', (e) => { const f = A.read(e.currentTarget); sim.capital = f.capital || 0; sim.tna = f.tna || 0; sim.plazo = +$('[name=plazo]', e.currentTarget).value; A.refresh(); });
    }
    $('#coTabs').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { co.tab = b.dataset.t; A.refresh(); } });
    body.addEventListener('click', (e) => { const b = e.target.closest('[data-pay]'); if (b) A.payCredit(b.dataset.pay); });
    $('#coExp').addEventListener('click', () => A.csv('mora', [['Cliente', (r) => r.cl.nombre], ['DNI', (r) => r.cl.dni], ['Teléfono', (r) => r.cl.tel], ['Crédito', (r) => r.c.id], ['Cuotas vencidas', (r) => r.s.vencidas], ['Días de mora', (r) => r.s.diasMora], ['Monto vencido', (r) => Math.round(r.s.montoVencido)], ['Punitorios', (r) => Math.round(r.s.punitorios)]], mora));
  });
  function creditDetail(v, id) {
    const cr = DB.get('credits', id); if (!cr) { v.innerHTML = A.ph('Crédito no encontrado', '', '', ['#/cobranzas', 'Cobranzas']); return; }
    const s = Fin.creditStatus(cr), cl = Q.client(cr.clientId), sale = DB.get('sales', cr.saleId), t = today();
    A.setTitle('Crédito ' + cr.id);
    v.innerHTML = A.ph('Crédito ' + cr.id, esc(cl.nombre) + ' · ' + (sale ? esc(sale.vehiculo) : '') + ' · ' + A.badge(s.estado, LABELS.creditState), (s.impagas ? '<button class="btn btn--ok" id="crPay">' + icon('cash') + 'Registrar pago</button>' : '') + (s.vencidas ? '<button class="btn" id="crRefi">' + icon('refresh') + 'Refinanciar</button>' : '') + '<a class="btn" href="#/clientes/' + cl.id + '?tab=finanzas">' + icon('user') + 'Ficha del cliente</a>', ['#/cobranzas', 'Financiación y cobranzas']) +
      '<div class="kpis">' + A.kpi({ label: 'Capital', value: fmt.money(cr.capital), sub: cr.plazo + ' cuotas · TNA ' + fmt.pct(cr.tna) }) + A.kpi({ label: 'Cuota', value: fmt.money(cr.cuota) }) + A.kpi({ label: 'Avance', value: s.pagadas + ' / ' + s.total, sub: Math.round(s.avance * 100) + '% pagado' }) + A.kpi({ label: 'Saldo pendiente', value: fmt.money(s.saldoTotal) }) + A.kpi({ label: 'Vencido', value: fmt.money(s.montoVencido), alert: s.vencidas > 0, sub: s.vencidas ? s.diasMora + ' días · punit. ' + fmt.money(s.punitorios) : 'Al día' }) + '</div>' +
      A.card({ title: 'Cronograma', icon: 'list', acts: A.payStrip(cr), flush: true, body: '<div class="tw"><table class="tbl"><thead><tr><th>N°</th><th>Vencimiento</th><th class="num">Capital</th><th class="num">Interés</th><th class="num">Cuota</th><th>Estado</th><th>Pago</th><th></th></tr></thead><tbody>' + cr.cuotas.map((q) => { const due = !q.pagada && parse(q.vto) < t; const late = q.pagada && daysBetween(q.vto, q.fechaPago); return '<tr class="' + (due ? 'row-err' : q.pagada ? 'row-paid' : '') + '"><td>' + q.n + '</td><td>' + fmt.date(q.vto) + '</td><td class="num">' + fmt.money(q.capital) + '</td><td class="num">' + fmt.money(q.interes) + '</td><td class="num"><b>' + fmt.money(q.monto) + '</b></td><td>' + (q.pagada ? '<span class="bd bd--ok">Pagada</span>' : due ? '<span class="bd bd--err">Vencida ' + daysBetween(q.vto, t) + ' d</span>' : '<span class="bd bd--muted">Pendiente</span>') + '</td><td class="small">' + (q.pagada ? fmt.date(q.fechaPago) + (late > 5 ? ' <span class="amber-t">(+' + late + ' d)</span>' : '') + '<br><span class="mut">' + esc(q.medio || '') + '</span>' : '') + '</td><td>' + (q.pagada ? '<button class="btn btn--xs" data-rec="' + q.n + '">' + icon('print') + 'Recibo</button>' : '') + '</td></tr>'; }).join('') + '</tbody></table></div>' });
    const pb = $('#crPay'); if (pb) pb.addEventListener('click', () => A.payCredit(cr.id));
    const rf = $('#crRefi'); if (rf) rf.addEventListener('click', () => A.refinance(cr.id));
    v.querySelector('.tbl').addEventListener('click', (e) => { const b = e.target.closest('[data-rec]'); if (b) { const q = cr.cuotas[+b.dataset.rec - 1]; printReceipt(cl, cr, [q], q.monto, 0, q.medio, q.fechaPago); } });
  }
  function printReceipt(cl, cr, cuotas, total, pun, medio, fecha) {
    A.print('Recibo de pago', '<div class="box grid"><div><b>Recibimos de:</b> ' + esc(cl.nombre) + '</div><div><b>DNI:</b> ' + esc(cl.dni) + '</div><div><b>Fecha de pago:</b> ' + fmt.date(fecha) + '</div><div><b>Medio:</b> ' + esc(medio || '') + '</div></div><h2>Detalle</h2><table><tr><th>Concepto</th><th>Vencimiento</th><th class="num">Importe</th></tr>' + cuotas.map((q) => '<tr><td>Crédito ' + cr.id + ' · cuota ' + q.n + '/' + cr.plazo + '</td><td>' + fmt.date(q.vto) + '</td><td class="num">' + fmt.money(q.monto) + '</td></tr>').join('') + (pun ? '<tr><td colspan="2">Intereses punitorios</td><td class="num">' + fmt.money(pun) + '</td></tr>' : '') + '<tr><td colspan="2" class="tot">Total recibido</td><td class="num tot">' + fmt.money(total + pun) + '</td></tr></table><div class="sign"><div>Firma y sello</div><div>Aclaración</div></div>');
  }
  A.payCredit = (id, after) => {
    const cr = DB.get('credits', id), cl = Q.client(cr.clientId), t = today(), st = Fin.creditStatus(cr, t);
    const unpaid = cr.cuotas.filter((q) => !q.pagada);
    const pre = new Set(unpaid.filter((q) => parse(q.vto) < t).map((q) => q.n)); if (!pre.size && unpaid.length) pre.add(unpaid[0].n);
    A.modal({
      title: 'Registrar pago · ' + cr.id, sub: esc(cl.nombre) + ' · cuota ' + fmt.money(cr.cuota), size: 'lg',
      body: '<form><div class="tw" style="max-height:300px;border:1px solid var(--line);border-radius:10px"><table class="tbl"><thead><tr><th></th><th>Cuota</th><th>Vencimiento</th><th class="num">Monto</th><th class="num">Punitorio</th></tr></thead><tbody>' + unpaid.slice(0, 18).map((q) => { const dd = Math.max(0, daysBetween(q.vto, t)); const p = q.monto * cfg().punitorioDiario / 100 * dd; return '<tr class="' + (dd ? 'row-err' : '') + '"><td><input type="checkbox" name="q' + q.n + '" data-m="' + q.monto + '" data-p="' + Math.round(p) + '"' + (pre.has(q.n) ? ' checked' : '') + ' style="width:18px;height:18px;accent-color:#cd9834"></td><td>' + q.n + '/' + cr.plazo + '</td><td>' + fmt.date(q.vto) + (dd ? ' <span class="bd bd--err">' + dd + ' d</span>' : '') + '</td><td class="num">' + fmt.money(q.monto) + '</td><td class="num">' + (p ? fmt.money(p) : '—') + '</td></tr>'; }).join('') + '</tbody></table></div>' +
        '<div class="fgrid fgrid--3 mt"><label class="fld">Fecha de pago<input class="inp" type="date" name="fecha" value="' + iso(t) + '" max="' + iso(t) + '"></label><label class="fld">Medio de pago<select class="inp" name="medio">' + A.opts(['Transferencia', 'Efectivo', 'Débito automático', 'Tarjeta de débito', 'Cheque', 'Mercado Pago']) + '</select></label><label class="fld fld--check" style="align-self:end"><input type="checkbox" name="pun" checked> Cobrar punitorios</label></div>' +
        '<div class="sumbox mt"><div style="display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:8px"><span style="color:#aab0ba">Total a cobrar</span><span class="big" id="payTot"></span></div></div><label class="fld fld--check mt"><input type="checkbox" name="recibo" checked> Imprimir recibo al confirmar</label></form>',
      ok: 'Confirmar cobro',
      onOpen: (box) => {
        const calc = () => { const cks = $$('input[name^=q]:checked', box); const tot = sum(cks, (c) => +c.dataset.m) + ($('[name=pun]', box).checked ? sum(cks, (c) => +c.dataset.p) : 0); $('#payTot', box).textContent = fmt.money(tot) + ' · ' + cks.length + ' cuota(s)'; };
        box.addEventListener('change', calc); calc();
      },
      onOk: (box) => {
        const cks = $$('input[name^=q]:checked', box); if (!cks.length) { A.toast('Seleccioná al menos una cuota'); return false; }
        const fecha = $('[name=fecha]', box).value || iso(t), medio = $('[name=medio]', box).value, withPun = $('[name=pun]', box).checked;
        const paid = cks.map((c) => cr.cuotas[+c.name.slice(1) - 1]);
        paid.forEach((q) => { q.pagada = true; q.fechaPago = fecha; q.medio = medio; });
        const total = sum(paid, (q) => q.monto), pun = withPun ? sum(cks, (c) => +c.dataset.p) : 0;
        DB.data.moves.push({ id: DB.nextId('moves'), fecha, tipo: 'ingreso', categoria: 'Cobranza de cuotas', monto: Math.round(total), medio, ref: cr.id + ' · cuota ' + paid.map((q) => q.n).join(', '), clientId: cl.id });
        if (pun) DB.data.moves.push({ id: DB.nextId('moves'), fecha, tipo: 'ingreso', categoria: 'Intereses punitorios', monto: Math.round(pun), medio, ref: cr.id, clientId: cl.id });
        DB.notify('Pago registrado: ' + cl.nombre + ' · ' + fmt.money(total + pun) + ' (' + cr.id + ')', 'pago', '#/clientes/' + cl.id + '?tab=finanzas'); DB.save();
        if ($('[name=recibo]', box).checked) printReceipt(cl, cr, paid, total, pun, medio, fecha);
        A.toast('Pago de ' + fmt.money(total + pun) + ' registrado'); A.refresh(); if (after) after();
      }
    });
  };
  A.refinance = (id) => {
    const cr = DB.get('credits', id), cl = Q.client(cr.clientId), st = Fin.creditStatus(cr);
    const base = st.saldoCapital + sum(cr.cuotas.filter((q) => !q.pagada && parse(q.vto) < today()), (q) => q.interes) + st.punitorios;
    A.modal({
      title: 'Refinanciar ' + cr.id, sub: esc(cl.nombre) + ' · ' + st.vencidas + ' cuotas vencidas · ' + st.diasMora + ' días',
      body: '<form><div class="alert alert--warn">' + icon('info') + '<span>Se consolida el saldo de capital + intereses vencidos + punitorios en un nuevo crédito. Las cuotas impagas del crédito actual quedan canceladas por refinanciación.</span></div><dl class="dl mt"><dt>Saldo de capital</dt><dd>' + fmt.money(st.saldoCapital) + '</dd><dt>Intereses vencidos + punitorios</dt><dd>' + fmt.money(base - st.saldoCapital) + '</dd><dt>Nuevo capital</dt><dd><b>' + fmt.money(base) + '</b></dd></dl><div class="fgrid mt"><label class="fld">Nuevo plazo<select class="inp" name="plazo">' + A.opts([12, 18, 24, 36, 48].map((n) => [n, n + ' cuotas']), 24) + '</select></label><label class="fld">TNA %<input class="inp" name="tna" type="number" step="0.1" value="' + (cfg().tna + 5) + '"></label></div><div class="sumbox mt"><span style="color:#aab0ba">Nueva cuota</span><span class="big" id="rfC"></span></div></form>',
      ok: 'Refinanciar',
      onOpen: (box) => { const calc = () => { $('#rfC', box).textContent = fmt.money(Fin.cuota(base, +$('[name=tna]', box).value, +$('[name=plazo]', box).value)); }; box.addEventListener('input', calc); box.addEventListener('change', calc); calc(); },
      onOk: (box) => {
        const plazo = +$('[name=plazo]', box).value, tna = +$('[name=tna]', box).value, f = iso(today());
        cr.cuotas.filter((q) => !q.pagada).forEach((q) => { q.pagada = true; q.fechaPago = f; q.medio = 'Refinanciación'; });
        const nc = DB.insert('credits', { clientId: cl.id, saleId: cr.saleId, entidad: 'Refinanciación de ' + cr.id, tipo: 'Prendario', capital: Math.round(base), tna, plazo, cuota: Math.round(Fin.cuota(base, tna, plazo)), inicio: f, cuotas: Fin.schedule(base, tna, plazo, f), gestor: 'U6' });
        DB.notify('Crédito ' + cr.id + ' refinanciado en ' + nc.id + ' (' + cl.nombre + ')', 'pago', '#/cobranzas/' + nc.id); DB.save();
        A.toast('Refinanciación creada: ' + nc.id, ['#/cobranzas/' + nc.id, 'Ver']); A.refresh();
      }
    });
  };

  /* ========================================================== PLAN DE AHORRO */
  const pl = { estado: '', q: '' };
  A.reg('planes', (v) => {
    A.setTitle('Plan de ahorro');
    const d = DB.data, t = today();
    const rows = d.savings.map((s) => ({ s, st: Fin.savingsStatus(s, t), cl: Q.client(s.clientId) }));
    const L = rows.filter((r) => (!pl.estado || (pl.estado === 'atraso' ? r.st.atrasadas > 0 && r.s.estado !== 'baja' : r.s.estado === pl.estado)) && (!pl.q || (r.cl.nombre + ' ' + r.s.modelo + ' ' + r.s.grupo).toLowerCase().includes(pl.q.toLowerCase())));
    const act = rows.filter((r) => ['ahorrando', 'adjudicado'].includes(r.s.estado));
    const acto = new Date(t.getFullYear(), t.getMonth() + (t.getDate() > 10 ? 1 : 0), 10);
    v.innerHTML = A.ph('Plan de ahorro', 'Suscripciones, cobranza de cuotas, adjudicaciones y entregas', '<button class="btn btn--pri" id="plNew">' + icon('plus') + 'Nueva suscripción</button>') +
      '<div class="kpis">' + A.kpi({ label: 'Suscripciones activas', icon: 'piggy', value: act.length }) + A.kpi({ label: 'Adjudicados sin entregar', icon: 'key', value: rows.filter((r) => r.s.estado === 'adjudicado').length, sub: 'coordinar entrega' }) + A.kpi({ label: 'Con cuotas atrasadas', icon: 'alert', value: act.filter((r) => r.st.atrasadas).length, alert: act.some((r) => r.st.atrasadas) }) + A.kpi({ label: 'Recaudación mensual', icon: 'cash', value: fmt.moneyShort(sum(act.filter((r) => r.st.restante > 0), (r) => r.s.valorCuota)), sub: 'comisión 6%: ' + fmt.moneyShort(sum(act, (r) => r.s.valorCuota) * 0.06) }) + A.kpi({ label: 'Entregados', icon: 'check', value: rows.filter((r) => r.s.estado === 'entregado').length }) + '</div>' +
      '<div class="card" style="margin-bottom:16px"><div class="card__h"><h3>' + icon('sparkle') + 'Próximo acto de adjudicación</h3><span class="sub">' + fmt.dateLong(iso(acto)) + ' · sorteo + licitación</span><div class="acts"><button class="btn btn--sm btn--acc" id="plDraw">' + icon('sparkle') + 'Simular sorteo</button></div></div><div class="card__b small mut">' + rows.filter((r) => r.s.estado === 'ahorrando' && r.s.cuotasPagadas >= 2 && !r.st.atrasadas).length + ' suscriptores al día participan del sorteo. Para licitar se requieren cuotas adelantadas.</div></div>' +
      '<div class="filters"><label class="search">' + icon('search') + '<input class="inp" id="plq" type="search" placeholder="Cliente, modelo, grupo…" value="' + esc(pl.q) + '"></label><select class="inp" id="plEst">' + A.opts(Object.entries(LABELS.planState).concat([['atraso', 'Con atraso']]), pl.estado, 'Todos los estados') + '</select></div><div class="card" id="plTbl"></div>';
    A.table($('#plTbl'), {
      key: 'plans', rows: L, sort: { k: 'alta', d: -1 }, onRow: (r) => planModal(r.s.id),
      cols: [{ k: 'cl', l: 'Suscriptor', s: (r) => r.cl.nombre, r: (r) => A.who(r.cl.nombre, 'DNI ' + esc(r.cl.dni)) }, { k: 'modelo', l: 'Modelo', s: (r) => r.s.modelo, r: (r) => '<b class="strong">' + esc(r.s.modelo) + '</b><br><small class="mut">' + esc(r.s.plan) + '</small>' }, { k: 'grupo', l: 'Grupo/Orden', s: (r) => r.s.grupo, r: (r) => r.s.grupo + ' / ' + r.s.orden },
        { k: 'av', l: 'Avance', s: (r) => r.st.avance, r: (r) => '<span class="small">' + r.s.cuotasPagadas + '/' + r.s.cuotasTotal + '</span>' + A.prog(r.st.avance, 'acc') }, { k: 'cuota', l: 'Cuota', num: true, s: (r) => r.s.valorCuota, r: (r) => fmt.money(r.s.valorCuota) },
        { k: 'atr', l: 'Atraso', num: true, s: (r) => r.st.atrasadas, r: (r) => r.st.atrasadas && r.s.estado !== 'baja' ? '<span class="bd bd--err">' + r.st.atrasadas + '</span>' : '—' }, { k: 'estado', l: 'Estado', s: (r) => r.s.estado, r: (r) => A.badge(r.s.estado, LABELS.planState) + (r.s.adjudicacion ? '<br><small class="mut">' + r.s.adjudicacion.tipo + ' · ' + fmt.date(r.s.adjudicacion.fecha) + '</small>' : '') },
        { k: 'alta', l: 'Alta', r: (r) => fmt.date(r.s.alta) }]
    });
    $('#plq').addEventListener('input', (e) => { pl.q = e.target.value; clearTimeout(pl._t); pl._t = setTimeout(() => { A.refresh(); const i = $('#plq'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }, 250); });
    $('#plEst').addEventListener('change', (e) => { pl.estado = e.target.value; A.refresh(); });
    $('#plNew').addEventListener('click', () => planNew());
    $('#plDraw').addEventListener('click', () => {
      const pool = rows.filter((r) => r.s.estado === 'ahorrando' && r.s.cuotasPagadas >= 2 && !r.st.atrasadas);
      if (!pool.length) return A.toast('No hay suscriptores en condiciones de participar');
      const w = pool[Math.floor(Math.random() * pool.length)];
      A.modal({ title: '🎉 ¡Tenemos adjudicado!', size: 'sm', body: '<div style="text-align:center;display:grid;gap:8px;justify-items:center">' + A.av(w.cl.nombre, null, 'lg') + '<h3>' + esc(w.cl.nombre) + '</h3><p class="mut">' + esc(w.s.modelo) + ' · Grupo ' + w.s.grupo + ' · Orden ' + w.s.orden + '</p><p class="small">Salió sorteado entre ' + pool.length + ' participantes.</p></div>', ok: 'Confirmar adjudicación', foot: [{ label: 'Descartar', act: 'close' }, { label: 'Confirmar adjudicación', cls: 'btn--pri', act: 'ok' }], onOk: () => { w.s.estado = 'adjudicado'; w.s.adjudicacion = { tipo: 'Sorteo', fecha: iso(today()) }; DB.notify('Adjudicado por sorteo: ' + w.cl.nombre + ' (' + w.s.modelo + ')', 'info', '#/planes'); DB.save(); A.toast('Adjudicación registrada'); A.refresh(); } });
    });
  });
  function planModal(id) {
    const s = DB.get('savings', id), cl = Q.client(s.clientId), st = Fin.savingsStatus(s);
    A.modal({
      title: s.modelo + ' · Grupo ' + s.grupo, sub: esc(cl.nombre) + ' · ' + A.badge(s.estado, LABELS.planState),
      body: '<dl class="dl"><dt>Plan</dt><dd>' + esc(s.plan) + '</dd><dt>Orden</dt><dd>' + s.orden + '</dd><dt>Alta</dt><dd>' + fmt.date(s.alta) + '</dd><dt>Cuotas pagas</dt><dd>' + s.cuotasPagadas + ' de ' + s.cuotasTotal + '</dd><dt>Valor de cuota</dt><dd>' + fmt.money(s.valorCuota) + '</dd><dt>Saldo restante</dt><dd>' + fmt.money(st.restante) + '</dd><dt>Atrasadas</dt><dd class="' + (st.atrasadas ? 'err-t' : '') + '">' + st.atrasadas + '</dd>' + (s.adjudicacion ? '<dt>Adjudicación</dt><dd>' + s.adjudicacion.tipo + ' · ' + fmt.date(s.adjudicacion.fecha) + '</dd>' : '') + '<dt>Asesor</dt><dd>' + esc(Q.userName(s.vendedorId)) + '</dd></dl>' + A.prog(st.avance, 'acc'),
      foot: [{ label: 'Dar de baja', cls: 'btn--danger', act: async (b, close) => { if (await A.confirm('Baja del plan', 'Se registrará la baja de la suscripción.', 'Dar de baja', true)) { s.estado = 'baja'; DB.save(); close(); A.refresh(); } } },
        { label: 'Registrar cuota', icon: 'cash', act: (b, close) => { if (s.cuotasPagadas >= s.cuotasTotal) return A.toast('Plan completamente pago'); s.cuotasPagadas++; DB.data.moves.push({ id: DB.nextId('moves'), fecha: iso(today()), tipo: 'ingreso', categoria: 'Comisiones plan de ahorro', monto: Math.round(s.valorCuota * 0.06), medio: 'Transferencia', ref: s.id, clientId: s.clientId }); DB.save(); close(); A.toast('Cuota ' + s.cuotasPagadas + ' registrada'); A.refresh(); } }]
        .concat(s.estado === 'ahorrando' ? [{ label: 'Adjudicar', cls: 'btn--acc', icon: 'key', act: (b, close) => { close(); A.formModal({ title: 'Adjudicar plan', fields: [{ n: 'tipo', l: 'Modalidad', t: 'select', o: ['Sorteo', 'Licitación', 'Pactada'] }, { n: 'fecha', l: 'Fecha', t: 'date', v: iso(today()) }], ok: 'Adjudicar', onOk: (bx, f) => { s.estado = 'adjudicado'; s.adjudicacion = f; DB.save(); A.toast('Plan adjudicado'); A.refresh(); } }); } }] : [])
        .concat(s.estado === 'adjudicado' ? [{ label: 'Registrar entrega', cls: 'btn--ok', icon: 'car', act: (b, close) => { s.estado = 'entregado'; DB.insert('appts', { fecha: isoDT(new Date()), duracion: 60, tipo: 'entrega', clientId: cl.id, leadId: '', nombre: cl.nombre, tel: cl.tel, vehiculo: s.modelo, asignado: s.vendedorId, estado: 'realizado', notas: 'Entrega por plan de ahorro ' + s.id }); close(); A.toast('Entrega registrada'); A.refresh(); } }] : [])
    });
  }
  function planNew() {
    const v0 = DB.data.vehicles.filter((x) => x.cond === '0km');
    A.formModal({
      title: 'Nueva suscripción a plan de ahorro', ok: 'Suscribir',
      fields: [{ n: 'clientId', l: 'Cliente', t: 'select', req: true, o: DB.data.clients.slice().sort((a, b) => a.nombre.localeCompare(b.nombre)).map((c) => [c.id, c.nombre + ' · ' + c.dni]), empty: '— Elegí —' }, { n: 'vehicleId', l: 'Modelo', t: 'select', req: true, o: v0.map((x) => [x.id, Q.vName(x) + ' · ' + x.plazo + ' cuotas ' + x.pct + '% · desde ' + fmt.money(x.cuotaDesde)]), empty: '— Elegí —' }, { n: 'grupo', l: 'Grupo', v: String(9000 + Math.floor(Math.random() * 800)) }, { n: 'alta', l: 'Fecha de alta', t: 'date', v: iso(today()) }],
      onOk: (b, f) => { const x = DB.get('vehicles', f.vehicleId), c = Q.client(f.clientId); DB.insert('savings', { clientId: f.clientId, vehicleId: x.id, modelo: Q.vName(x), grupo: f.grupo, orden: 1 + Math.floor(Math.random() * 168), plan: x.plazo + ' cuotas · ' + x.pct + '% financiado', cuotasTotal: x.plazo, cuotasPagadas: 1, valorCuota: round(x.cuotaDesde * 1.08, 100), alta: f.alta, estado: 'ahorrando', adjudicacion: null, vendedorId: c.vendedorId || me().id }); A.toast('Suscripción creada'); A.refresh(); }
    });
  }

  /* ================================================================ SEGUROS */
  const sg = { tab: 'polizas', estado: '', ins: '', cov: '', q: '' };
  A.reg('seguros', (v) => {
    A.setTitle('Seguros');
    const qp = A.query(); if (qp.f) { sg.estado = qp.f; sg.tab = 'polizas'; } if (qp.p) sg.tab = 'polizas';
    const d = DB.data, t = today();
    const rows = d.policies.map((p) => ({ p, st: Fin.policyState(p, t), cl: Q.client(p.clientId), ins: Q.insurer(p.insurerId), cov: Q.coverage(p.coverage) }));
    const vig = rows.filter((r) => ['vigente', 'por_vencer'].includes(r.st));
    const sin = rows.flatMap((r) => r.p.siniestros.map((s, i) => ({ ...s, r, i })));
    v.innerHTML = A.ph('Seguros', 'Broker multicompañía: cotización, emisión, renovaciones y siniestros', '<button class="btn btn--pri" id="sgQuote">' + icon('plus') + 'Cotizar y emitir</button>') +
      '<div class="kpis">' + A.kpi({ label: 'Pólizas vigentes', icon: 'shield', value: vig.length }) + A.kpi({ label: 'Prima mensual de cartera', icon: 'cash', value: fmt.moneyShort(sum(vig, (r) => r.p.primaMensual)) }) + A.kpi({ label: 'Comisión mensual', icon: 'percent', value: fmt.moneyShort(sum(vig, (r) => r.p.primaMensual * r.ins.comision / 100)) }) + A.kpi({ label: 'Por vencer (30 d)', icon: 'clock', value: rows.filter((r) => r.st === 'por_vencer').length, href: '#/seguros?f=por_vencer' }) + A.kpi({ label: 'Vencidas sin renovar', icon: 'alert', value: rows.filter((r) => r.st === 'vencida').length, alert: rows.some((r) => r.st === 'vencida') }) + A.kpi({ label: 'Siniestros abiertos', icon: 'wrench', value: sin.filter((s) => s.estado !== 'Liquidado').length }) + '</div>' +
      '<div class="tabs" id="sgTabs">' + [['polizas', 'Pólizas', rows.length], ['catalogo', 'Aseguradoras y coberturas', d.insurers.length], ['siniestros', 'Siniestros', sin.length], ['cartera', 'Cartera por compañía']].map(([k, l, n]) => '<button data-t="' + k + '"' + (sg.tab === k ? ' class="on"' : '') + '>' + l + (n != null ? '<span class="cnt">' + n + '</span>' : '') + '</button>').join('') + '</div><div id="sgBody"></div>';
    const body = $('#sgBody');
    if (sg.tab === 'polizas') {
      const L = rows.filter((r) => (!sg.estado || r.st === sg.estado) && (!sg.ins || r.p.insurerId === sg.ins) && (!sg.cov || r.p.coverage === sg.cov) && (!sg.q || (r.cl.nombre + ' ' + r.p.numero + ' ' + r.p.patente + ' ' + r.p.vehiculo).toLowerCase().includes(sg.q.toLowerCase())));
      body.innerHTML = '<div class="filters"><label class="search">' + icon('search') + '<input class="inp" id="sgq" type="search" placeholder="Cliente, póliza, patente…" value="' + esc(sg.q) + '"></label><select class="inp" id="sgEst">' + A.opts(Object.entries(LABELS.policyState), sg.estado, 'Todos los estados') + '</select><select class="inp" id="sgIns">' + A.opts(d.insurers.map((i) => [i.id, i.nombre]), sg.ins, 'Todas las aseguradoras') + '</select><select class="inp" id="sgCov">' + A.opts(d.coverages.map((c) => [c.id, c.nombre]), sg.cov, 'Todas las coberturas') + '</select></div><div class="card" id="sgTbl"></div>';
      A.table($('#sgTbl'), {
        key: 'pols', rows: L, sort: { k: 'vencimiento', d: 1 }, onRow: (r) => policyModal(r.p.id), pageSize: 15,
        cols: [{ k: 'numero', l: 'Póliza', s: (r) => r.p.numero, r: (r) => '<b class="strong nowrap">' + r.p.numero + '</b>' }, { k: 'cl', l: 'Asegurado', s: (r) => r.cl.nombre, r: (r) => A.clientLink(r.cl.id) }, { k: 'veh', l: 'Vehículo', s: (r) => r.p.vehiculo, r: (r) => esc(r.p.vehiculo) + '<br><small class="mut">' + esc(r.p.patente) + '</small>' },
          { k: 'ins', l: 'Compañía', s: (r) => r.ins.nombre, r: (r) => '<span class="temp" style="background:' + r.ins.color + '"></span> ' + esc(r.ins.nombre) }, { k: 'cov', l: 'Cobertura', s: (r) => r.cov.nombre, r: (r) => esc(r.cov.nombre) }, { k: 'prima', l: 'Prima', num: true, s: (r) => r.p.primaMensual, r: (r) => fmt.money(r.p.primaMensual) },
          { k: 'vencimiento', l: 'Vence', s: (r) => r.p.vencimiento, r: (r) => '<span class="nowrap">' + fmt.date(r.p.vencimiento) + '</span>' }, { k: 'st', l: 'Estado', s: (r) => r.st, r: (r) => A.badge(r.st, LABELS.policyState) }]
      });
      $('#sgq').addEventListener('input', (e) => { sg.q = e.target.value; clearTimeout(sg._t); sg._t = setTimeout(() => { A.refresh(); const i = $('#sgq'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }, 250); });
      $('#sgEst').addEventListener('change', (e) => { sg.estado = e.target.value; history.replaceState(null, '', '#/seguros'); A.refresh(); });
      $('#sgIns').addEventListener('change', (e) => { sg.ins = e.target.value; A.refresh(); });
      $('#sgCov').addEventListener('change', (e) => { sg.cov = e.target.value; A.refresh(); });
      if (qp.p) { history.replaceState(null, '', '#/seguros'); policyModal(qp.p); }
    } else if (sg.tab === 'catalogo') {
      body.innerHTML = '<div class="grid g3">' + d.insurers.map((i) => A.card({ title: i.nombre, acts: '<button class="btn btn--sm" data-ins="' + i.id + '">' + icon('edit') + 'Editar</button>', body: '<div style="height:6px;border-radius:3px;background:' + i.color + ';margin:-6px 0 12px"></div><dl class="dl"><dt>Comisión</dt><dd>' + i.comision + '%</dd><dt>Factor de tarifa</dt><dd>' + i.factor.toFixed(2) + '</dd><dt>Calificación</dt><dd>★ ' + i.rating.toFixed(1) + '</dd><dt>Asistencia 24 h</dt><dd>' + esc(i.asistencia) + '</dd><dt>Pólizas vigentes</dt><dd>' + vig.filter((r) => r.p.insurerId === i.id).length + '</dd></dl>' })).join('') + '</div>' +
        A.card({ cls: 'mt', title: 'Catálogo de coberturas', icon: 'shield', flush: true, body: '<div class="tw"><table class="tbl"><thead><tr><th>Cobertura</th><th>Tarifa base</th><th>Franquicia</th><th>Incluye</th><th></th></tr></thead><tbody>' + d.coverages.map((c) => '<tr><td><b class="strong">' + esc(c.nombre) + '</b><br><small class="mut">' + c.id + '</small></td><td>' + (c.tipo === 'RC' ? fmt.money(c.fijo) + ' fijo/mes' : fmt.pct(c.tasa, 2) + ' mensual s/ suma') + '</td><td>' + (c.franquicia ? fmt.pct(c.franquicia) : '—') + '</td><td class="small">' + c.beneficios.map(esc).join(' · ') + '</td><td><button class="btn btn--sm" data-cov="' + c.id + '">' + icon('edit') + '</button></td></tr>').join('') + '</tbody></table></div>' });
      body.addEventListener('click', (e) => {
        const bi = e.target.closest('[data-ins]'), bc = e.target.closest('[data-cov]');
        if (bi) { const i = Q.insurer(bi.dataset.ins); A.formModal({ title: 'Editar ' + i.nombre, values: i, fields: [{ n: 'nombre', l: 'Nombre', req: true }, { n: 'comision', l: 'Comisión %', t: 'number', step: 0.5 }, { n: 'factor', l: 'Factor de tarifa', t: 'number', step: 0.01, help: '1,00 = tarifa base' }, { n: 'rating', l: 'Calificación', t: 'number', step: 0.1, min: 0, max: 5 }, { n: 'asistencia', l: 'Teléfono de asistencia' }, { n: 'color', l: 'Color (hex)' }], onOk: (b, f) => { Object.assign(i, f); DB.save(); A.toast('Aseguradora actualizada'); A.refresh(); } }); }
        if (bc) { const c = Q.coverage(bc.dataset.cov); A.formModal({ title: 'Editar cobertura ' + c.id, values: { ...c, beneficios: c.beneficios.join('\n') }, fields: [{ n: 'nombre', l: 'Nombre', req: true }, c.tipo === 'RC' ? { n: 'fijo', l: 'Prima fija mensual', t: 'money', step: 100 } : { n: 'tasa', l: 'Tasa mensual % s/ suma asegurada', t: 'number', step: 0.01 }, { n: 'franquicia', l: 'Franquicia %', t: 'number', step: 0.5 }, { n: 'beneficios', l: 'Beneficios (uno por línea)', t: 'textarea' }], onOk: (b, f) => { f.beneficios = f.beneficios.split('\n').map((s) => s.trim()).filter(Boolean); Object.assign(c, f); DB.save(); A.toast('Cobertura actualizada · el cotizador del sitio ya usa la nueva tarifa'); A.refresh(); } }); }
      });
    } else if (sg.tab === 'siniestros') {
      body.innerHTML = '<div class="card" id="sinTbl"></div>';
      A.table($('#sinTbl'), { key: 'sin', rows: sin, sort: { k: 'fecha', d: -1 }, onRow: (s) => policyModal(s.r.p.id), cols: [{ k: 'fecha', l: 'Fecha', r: (s) => fmt.date(s.fecha) }, { k: 'cl', l: 'Asegurado', s: (s) => s.r.cl.nombre, r: (s) => A.clientLink(s.r.cl.id) }, { k: 'tipo', l: 'Tipo', r: (s) => esc(s.tipo) }, { k: 'pol', l: 'Póliza', s: (s) => s.r.p.numero, r: (s) => s.r.p.numero + '<br><small class="mut">' + esc(s.r.ins.nombre) + '</small>' }, { k: 'monto', l: 'Monto estimado', num: true, r: (s) => fmt.money(s.monto) }, { k: 'estado', l: 'Estado', r: (s) => '<span class="bd bd--' + (s.estado === 'Liquidado' ? 'ok' : s.estado === 'En peritaje' ? 'violet' : 'amber') + '">' + esc(s.estado) + '</span>' }], empty: 'Sin siniestros denunciados' });
    } else {
      const byIns = d.insurers.map((i) => ({ label: i.nombre, value: sum(vig.filter((r) => r.p.insurerId === i.id), (r) => r.p.primaMensual), color: i.color }));
      body.innerHTML = '<div class="grid g2">' + A.card({ title: 'Prima mensual por compañía', icon: 'chart', bodyId: 'sgC1' }) + A.card({ title: 'Mix de coberturas vigentes', icon: 'shield', bodyId: 'sgC2' }) + '</div>';
      C.hbars($('#sgC1'), { items: byIns.sort((a, b) => b.value - a.value).map((x) => ({ ...x, color: C.PAL[0] })), fmt: fmt.moneyShort });
      C.donut($('#sgC2'), { items: d.coverages.map((c) => ({ label: c.nombre, value: vig.filter((r) => r.p.coverage === c.id).length })), centerLabel: 'pólizas', fmt: (x) => String(x) });
    }
    $('#sgTabs').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { sg.tab = b.dataset.t; history.replaceState(null, '', '#/seguros'); A.refresh(); } });
    $('#sgQuote').addEventListener('click', () => A.quoteModal({}));
  });
  function policyModal(id) {
    const p = DB.get('policies', id); if (!p) return;
    const cl = Q.client(p.clientId), ins = Q.insurer(p.insurerId), cov = Q.coverage(p.coverage), st = Fin.policyState(p);
    A.modal({
      title: 'Póliza ' + p.numero, sub: esc(ins.nombre) + ' · ' + esc(cov.nombre) + ' · ' + A.badge(st, LABELS.policyState), size: 'lg',
      body: '<div class="grid g2"><dl class="dl"><dt>Asegurado</dt><dd><a href="#/clientes/' + cl.id + '">' + esc(cl.nombre) + '</a></dd><dt>Vehículo</dt><dd>' + esc(p.vehiculo) + '</dd><dt>Patente</dt><dd>' + esc(p.patente) + '</dd><dt>Suma asegurada</dt><dd>' + fmt.money(p.sumaAsegurada) + '</dd></dl><dl class="dl"><dt>Vigencia</dt><dd>' + fmt.date(p.inicio) + ' → ' + fmt.date(p.vencimiento) + '</dd><dt>Prima mensual</dt><dd>' + fmt.money(p.primaMensual) + '</dd><dt>Comisión</dt><dd>' + fmt.money(p.primaMensual * ins.comision / 100) + '/mes</dd><dt>Asistencia</dt><dd>' + esc(ins.asistencia) + '</dd></dl></div>' +
        '<h4 style="margin:16px 0 8px">Coberturas incluidas</h4><ul class="small" style="display:grid;gap:4px">' + cov.beneficios.map((b) => '<li>✓ ' + esc(b) + '</li>').join('') + '</ul>' +
        '<h4 style="margin:16px 0 8px">Siniestros</h4>' + (p.siniestros.length ? '<table class="tbl"><tbody>' + p.siniestros.map((s) => '<tr><td>' + fmt.date(s.fecha) + '</td><td>' + esc(s.tipo) + '</td><td class="num">' + fmt.money(s.monto) + '</td><td>' + esc(s.estado) + '</td></tr>').join('') + '</tbody></table>' : '<p class="mut small">Sin siniestros.</p>'),
      foot: [{ label: 'Cancelar póliza', cls: 'btn--danger', act: async (b, close) => { if (await A.confirm('Cancelar póliza', 'La póliza quedará anulada.', 'Cancelar póliza', true)) { p.estado = 'cancelada'; DB.save(); close(); A.refresh(); } } },
        { label: 'Denunciar siniestro', icon: 'alert', act: (b, close) => { close(); A.formModal({ title: 'Denuncia de siniestro', sub: 'Póliza ' + p.numero, fields: [{ n: 'fecha', l: 'Fecha', t: 'date', v: iso(today()) }, { n: 'tipo', l: 'Tipo', t: 'select', o: ['Choque parcial', 'Choque total', 'Robo total', 'Robo parcial', 'Rotura de cristal', 'Granizo', 'Incendio', 'Responsabilidad civil'] }, { n: 'monto', l: 'Monto estimado', t: 'money' }, { n: 'detalle', l: 'Relato', t: 'textarea' }], ok: 'Registrar denuncia', onOk: (bx, f) => { p.siniestros.push({ ...f, estado: 'En trámite' }); DB.notify('Siniestro denunciado: ' + cl.nombre + ' · ' + f.tipo, 'alert', '#/seguros'); DB.save(); A.toast('Siniestro registrado y enviado a ' + ins.nombre); A.refresh(); } }); } },
        { label: 'Recordar por WhatsApp', cls: 'btn--wa', icon: 'whatsapp', act: () => window.open(waLink(A.waNum(cl.tel), 'Hola ' + cl.nombre.split(' ')[0] + ', tu póliza ' + p.numero + ' (' + p.vehiculo + ') vence el ' + fmt.date(p.vencimiento) + '. ¿Querés que la renovemos? ' + DB.data.config.name), '_blank', 'noopener') },
        { label: 'Renovar 12 meses', cls: 'btn--pri', icon: 'refresh', act: (b, close) => { const ini = st === 'vencida' ? iso(today()) : p.vencimiento; p.inicio = ini; p.vencimiento = iso(addMonths(ini, 12)); p.primaMensual = round(p.primaMensual * 1.06, 100); p.estado = 'vigente'; DB.save(); close(); A.toast('Póliza renovada hasta ' + fmt.date(p.vencimiento) + ' (ajuste +6%)'); A.refresh(); } }]
    });
  }
  A.quoteModal = (o) => {
    o = o || {};
    const st = { value: o.value || 30000000, year: o.year || today().getFullYear(), sel: '' };
    A.modal({
      title: 'Cotizador de seguros', sub: 'Compará las 5 compañías y emití la póliza', size: 'lg',
      body: '<form><div class="fgrid fgrid--3"><label class="fld">Vehículo del stock<select class="inp" name="veh">' + A.opts(DB.data.vehicles.filter((x) => x.status !== 'vendido').map((x) => [x.id, vLabel(x)]), '', '— Otro vehículo —') + '</select></label><label class="fld">Suma asegurada<input class="inp" type="number" name="value" step="100000" value="' + st.value + '"></label><label class="fld">Año<input class="inp" type="number" name="year" value="' + st.year + '"></label>' +
        '<label class="fld">Cliente<select class="inp" name="clientId" required>' + A.opts(DB.data.clients.slice().sort((a, b) => a.nombre.localeCompare(b.nombre)).map((c) => [c.id, c.nombre]), o.clientId || '', '— Elegí el asegurado —') + '</select></label><label class="fld">Descripción del vehículo<input class="inp" name="vehiculo" value="' + esc(o.vehiculo || '') + '" placeholder="Marca modelo versión año"></label><label class="fld">Patente<input class="inp" name="patente" placeholder="AB 123 CD"></label></div><div id="qMatrix" class="mt"></div></form>',
      ok: 'Emitir póliza',
      onOpen: (box) => {
        const draw = () => {
          const val = +$('[name=value]', box).value || 0, yr = +$('[name=year]', box).value || today().getFullYear();
          $('#qMatrix', box).innerHTML = '<div class="tw"><table class="tbl"><thead><tr><th>Compañía</th>' + DB.data.coverages.map((c) => '<th class="num">' + esc(c.nombre) + '</th>').join('') + '</tr></thead><tbody>' + DB.data.insurers.map((i) => '<tr><td><span class="temp" style="background:' + i.color + '"></span> <b class="strong">' + esc(i.nombre) + '</b></td>' + DB.data.coverages.map((c) => { const k = i.id + '|' + c.id; return '<td class="num"><label style="display:inline-flex;gap:6px;cursor:pointer;align-items:center"><input type="radio" name="sel" value="' + k + '"' + (st.sel === k ? ' checked' : '') + '>' + fmt.money(Fin.quote(val, yr, c, i)) + '</label></td>'; }).join('') + '</tr>').join('') + '</tbody></table></div>';
        };
        box.addEventListener('change', (e) => {
          if (e.target.name === 'veh' && e.target.value) { const x = DB.get('vehicles', e.target.value); $('[name=value]', box).value = x.price; $('[name=year]', box).value = x.year; $('[name=vehiculo]', box).value = Q.vFull(x) + ' ' + x.year; $('[name=patente]', box).value = x.patente || ''; }
          if (e.target.name === 'sel') st.sel = e.target.value; else draw();
        });
        draw();
      },
      onOk: (box, f) => {
        if (!f.clientId) { A.toast('Elegí el cliente asegurado'); return false; }
        if (!f.sel) { A.toast('Elegí una compañía y cobertura de la tabla'); return false; }
        f.year = +f.year || today().getFullYear();
        const [iid, cid] = f.sel.split('|'), ins = Q.insurer(iid), cov = Q.coverage(cid), val = +f.value || 0, inicio = iso(today());
        const p = DB.insert('policies', { clientId: f.clientId, saleId: o.saleId || null, insurerId: iid, coverage: cid, numero: String(10 + Math.floor(Math.random() * 89)) + '-' + (100000 + Math.floor(Math.random() * 899999)), vehiculo: f.vehiculo || 'Vehículo', patente: (f.patente || 'A confirmar').toUpperCase(), sumaAsegurada: val, primaMensual: Fin.quote(val, f.year, cov, ins), inicio, vencimiento: iso(addMonths(inicio, 12)), estado: 'vigente', productor: 'U7', siniestros: [] });
        if (o.saleId) { const s = DB.get('sales', o.saleId); if (s) s.policyId = p.id; }
        DB.notify('Póliza emitida ' + p.numero + ' · ' + ins.nombre + ' · ' + Q.client(f.clientId).nombre, 'info', '#/seguros?p=' + p.id); DB.save();
        A.toast('Póliza ' + p.numero + ' emitida con ' + ins.nombre); A.refresh();
      }
    });
  };
})();
