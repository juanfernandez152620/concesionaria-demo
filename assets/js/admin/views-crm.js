/* =========================================================================
   Admin — Dashboard, CRM, Clientes (ficha 360° + estado financiero), Agenda
   ========================================================================= */
(function () {
  'use strict';
  const { DB, Q, Fin, fmt, esc, icon, LABELS, today, iso, isoDT, addDays, addMonths, daysBetween, parse, sum, groupBy, waLink } = RB;
  const { $, $$ } = A;
  const C = window.Charts;
  const me = () => A.user;
  const isSeller = () => /asesor/i.test(me().rol);
  const waNum = (tel) => '549' + String(tel || '').replace(/\D/g, '');
  const monthKeys = (n) => Array.from({ length: n }, (_, i) => iso(addMonths(today(), -(n - 1 - i))).slice(0, 7));
  const mLabel = (k) => fmt.month(+k.slice(5) - 1) + (k.slice(5) === '01' ? ' ' + k.slice(2, 4) : '');
  A.monthKeys = monthKeys; A.mLabel = mLabel; A.waNum = waNum;

  /* ============================================================ DASHBOARD */
  A.reg('dashboard', (v) => {
    A.setTitle('Dashboard');
    const d = DB.data, t = today(), mk = iso(t).slice(0, 7), pk = iso(addMonths(t, -1)).slice(0, 7), dom = t.getDate();
    const valid = d.sales.filter((s) => s.estado !== 'anulada');
    const sm = valid.filter((s) => s.fecha.startsWith(mk)), sp = valid.filter((s) => s.fecha.startsWith(pk) && +s.fecha.slice(8) <= dom);
    const lm = d.leads.filter((l) => l.creado.startsWith(mk)), lp = d.leads.filter((l) => l.creado.startsWith(pk) && +l.creado.slice(8, 10) <= dom);
    const closed = d.leads.filter((l) => ['ganado', 'perdido'].includes(l.etapa));
    const conv = closed.length ? closed.filter((l) => l.etapa === 'ganado').length / closed.length * 100 : 0;
    const cst = d.credits.map((c) => Fin.creditStatus(c, t));
    const cartera = sum(cst, (s) => s.saldoTotal), vencido = sum(cst, (s) => s.montoVencido);
    const stock0 = sum(d.vehicles.filter((x) => x.cond === '0km'), (x) => x.stock), stockU = d.vehicles.filter((x) => x.cond === 'usado' && x.status !== 'vendido').length;
    const stockVal = sum(d.vehicles.filter((x) => x.cond === '0km'), (x) => x.stock * x.cost) + sum(d.vehicles.filter((x) => x.cond === 'usado' && x.status !== 'vendido'), (x) => x.cost);
    const cobM = sum(d.moves.filter((m) => m.categoria === 'Cobranza de cuotas' && m.fecha.startsWith(mk)), (m) => m.monto);
    const cobP = sum(d.moves.filter((m) => m.categoria === 'Cobranza de cuotas' && m.fecha.startsWith(pk) && +m.fecha.slice(8) <= dom), (m) => m.monto);
    const hour = new Date().getHours();
    v.innerHTML = A.ph((hour < 12 ? 'Buen día' : hour < 20 ? 'Buenas tardes' : 'Buenas noches') + ', ' + me().nombre.split(' ')[0], fmt.dateLong(iso(t)).replace(/^\w/, (c) => c.toUpperCase()) + ' · Resumen del mes en curso comparado con el mismo período del mes anterior.', '<a class="btn" href="home.html" target="_blank" rel="noopener">' + icon('eye') + 'Ver sitio</a><a class="btn btn--pri" href="#/ventas/nueva">' + icon('plus') + 'Nueva operación</a>') +
      '<div class="kpis">' +
      A.kpi({ label: 'Unidades vendidas', icon: 'tag', value: sm.length, trend: A.trend(sm.length, sp.length), sub: 'vs. ' + sp.length + ' mes anterior', href: '#/ventas' }) +
      A.kpi({ label: 'Facturación del mes', icon: 'cash', value: fmt.moneyShort(sum(sm, (s) => s.precio)), trend: A.trend(sum(sm, (s) => s.precio), sum(sp, (s) => s.precio)), sub: 'Ticket ' + fmt.moneyShort(sm.length ? sum(sm, (s) => s.precio) / sm.length : 0) }) +
      A.kpi({ label: 'Leads nuevos', icon: 'funnel', value: lm.length, trend: A.trend(lm.length, lp.length), sub: 'Conversión ' + fmt.pct(conv), href: '#/crm' }) +
      A.kpi({ label: 'Cobranzas del mes', icon: 'card', value: fmt.moneyShort(cobM), trend: A.trend(cobM, cobP), sub: 'Cartera ' + fmt.moneyShort(cartera), href: '#/cobranzas' }) +
      A.kpi({ label: 'Cartera vencida', icon: 'alert', value: fmt.moneyShort(vencido), alert: vencido > 0, sub: 'Morosidad ' + fmt.pct(cartera ? vencido / cartera * 100 : 0), href: '#/cobranzas' }) +
      A.kpi({ label: 'Stock disponible', icon: 'car', value: (stock0 + stockU) + ' u.', sub: stock0 + ' 0km · ' + stockU + ' usados · ' + fmt.moneyShort(stockVal), href: '#/inventario' }) +
      '</div>' +
      '<div class="grid g-21">' + A.card({ title: 'Ventas de los últimos 12 meses', icon: 'chart', sub: 'Facturación por condición', bodyId: 'chSales' }) + A.card({ title: 'Embudo comercial', icon: 'funnel', sub: 'Leads por etapa', bodyId: 'chFunnel', acts: '<a class="btn btn--sm" href="#/crm">Ver CRM</a>' }) + '</div>' +
      '<div class="grid g3 mt">' + A.card({ title: 'Agenda de hoy', icon: 'calendar', bodyId: 'dAgenda', flush: true, acts: '<a class="btn btn--sm" href="#/agenda">Agenda</a>' }) + A.card({ title: 'Alertas y pendientes', icon: 'alert', bodyId: 'dAlerts', flush: true }) + A.card({ title: 'Objetivos del mes', icon: 'team', bodyId: 'dGoals', acts: '<a class="btn btn--sm" href="#/equipo">Equipo</a>' }) + '</div>' +
      '<div class="grid g3 mt">' + A.card({ title: 'Leads por origen', icon: 'funnel', sub: 'Últimos 90 días', bodyId: 'chOrig' }) + A.card({ title: 'Ventas por marca', icon: 'car', sub: '12 meses', bodyId: 'chBrand' }) + A.card({ title: 'Últimos leads', icon: 'bolt', bodyId: 'dLeads', flush: true, acts: '<a class="btn btn--sm" href="#/crm?view=list">Todos</a>' }) + '</div>';

    // ventas 12m
    const keys = monthKeys(12);
    const by = (k, cond) => sum(valid.filter((s) => s.fecha.startsWith(k) && s.cond === cond), (s) => s.precio);
    C.bar($('#chSales'), { labels: keys.map(mLabel), tipLabels: keys.map((k) => fmt.monthLong(+k.slice(5) - 1) + ' ' + k.slice(0, 4)), stacked: true, series: [{ name: '0km', data: keys.map((k) => by(k, '0km')) }, { name: 'Usados', data: keys.map((k) => by(k, 'usado')) }], fmt: fmt.money, fmtAxis: fmt.moneyShort, height: 250, extra: (i) => '<div style="margin-top:4px;color:#aab0ba">' + valid.filter((s) => s.fecha.startsWith(keys[i])).length + ' unidades</div>' });
    // embudo
    const stages = ['nuevo', 'contactado', 'test_drive', 'negociacion', 'ganado'];
    const cnt = stages.map((s) => d.leads.filter((l) => l.etapa === s).length);
    C.hbars($('#chFunnel'), { items: stages.map((s, i) => ({ label: LABELS.leadStage[s], value: cnt[i], color: C.SEQ[i] })), fmt: (x) => x + ' leads' });
    $('#chFunnel').insertAdjacentHTML('beforeend', '<p class="small mut" style="margin-top:14px">Pipeline abierto: <b class="strong">' + fmt.moneyShort(sum(d.leads.filter((l) => !['ganado', 'perdido'].includes(l.etapa)), (l) => l.presupuesto)) + '</b> · Tasa de cierre ' + fmt.pct(conv) + '</p>');
    // agenda hoy
    const ap = d.appts.filter((a) => a.fecha.slice(0, 10) === iso(t)).sort((a, b) => a.fecha.localeCompare(b.fecha));
    $('#dAgenda').innerHTML = ap.length ? '<div class="list">' + ap.map((a) => '<a href="#/agenda?id=' + a.id + '"><b class="nowrap" style="width:44px">' + fmt.time(a.fecha) + '</b><span style="min-width:0"><b class="strong">' + esc(a.nombre) + '</b><br><small class="mut">' + LABELS.apptType[a.tipo] + ' · ' + esc(a.vehiculo) + '</small></span><span class="r">' + A.badge(a.estado, LABELS.apptState) + '</span></a>').join('') + '</div>' : A.empty('Sin citas para hoy', 'calendar');
    // alertas
    const alerts = [];
    d.credits.forEach((c, i) => { const s = cst[i]; if (s.estado === 'en_mora') alerts.push([s.diasMora, '<a href="#/clientes/' + c.clientId + '?tab=finanzas"><span class="bd bd--err bd--plain">' + s.diasMora + ' d</span><span style="min-width:0"><b class="strong">' + esc((Q.client(c.clientId) || {}).nombre) + '</b><br><small class="mut">' + s.vencidas + ' cuota(s) vencida(s) · ' + fmt.money(s.montoVencido) + '</small></span><span class="r">' + icon('chevron') + '</span></a>']); });
    alerts.sort((a, b) => b[0] - a[0]);
    const pv = d.policies.filter((p) => Fin.policyState(p, t) === 'por_vencer').sort((a, b) => a.vencimiento.localeCompare(b.vencimiento));
    const nl = d.leads.filter((l) => l.etapa === 'nuevo' && daysBetween(l.creado, t) >= 1);
    const tz = d.tradeIns.filter((x) => x.estado === 'pendiente');
    const ot = d.workOrders.filter((w) => w.estado === 'listo');
    $('#dAlerts').innerHTML = '<div class="list">' + alerts.slice(0, 4).map((a) => a[1]).join('') +
      (pv.length ? '<a href="#/seguros?f=por_vencer"><span class="bd bd--amber bd--plain">' + pv.length + '</span><span><b class="strong">Pólizas por vencer</b><br><small class="mut">Próxima: ' + esc((Q.client(pv[0].clientId) || {}).nombre) + ' · ' + fmt.date(pv[0].vencimiento) + '</small></span><span class="r">' + icon('chevron') + '</span></a>' : '') +
      (nl.length ? '<a href="#/crm"><span class="bd bd--info bd--plain">' + nl.length + '</span><span><b class="strong">Leads sin contactar (+24 h)</b><br><small class="mut">Asignalos y respondé hoy</small></span><span class="r">' + icon('chevron') + '</span></a>' : '') +
      (tz.length ? '<a href="#/usados"><span class="bd bd--violet bd--plain">' + tz.length + '</span><span><b class="strong">Tasaciones pendientes</b><br><small class="mut">Usados para peritar</small></span><span class="r">' + icon('chevron') + '</span></a>' : '') +
      (ot.length ? '<a href="#/taller"><span class="bd bd--ok bd--plain">' + ot.length + '</span><span><b class="strong">Vehículos listos en taller</b><br><small class="mut">Avisar al cliente para retiro</small></span><span class="r">' + icon('chevron') + '</span></a>' : '') + '</div>';
    // objetivos
    const sellers = d.team.filter((u) => u.objetivo > 0);
    $('#dGoals').innerHTML = '<div style="display:grid;gap:14px">' + sellers.map((u) => { const n = sm.filter((s) => s.vendedorId === u.id).length; return '<div style="display:grid;gap:6px"><div style="display:flex;align-items:center;gap:8px">' + A.av(u.nombre, u.color, 'sm') + '<b class="strong" style="font-size:.86rem">' + esc(u.nombre) + '</b><span class="small mut" style="margin-left:auto">' + n + ' / ' + u.objetivo + ' u.</span></div>' + A.prog(n / u.objetivo, n >= u.objetivo ? 'ok' : 'acc') + '</div>'; }).join('') + '<p class="small mut">Total concesionaria: <b class="strong">' + sm.length + ' / ' + sum(sellers, (u) => u.objetivo) + '</b> unidades</p></div>';
    // origen
    const l90 = d.leads.filter((l) => daysBetween(l.creado, t) <= 90);
    const og = groupBy(l90, (l) => l.origen);
    C.donut($('#chOrig'), { items: Object.entries(og).sort((a, b) => b[1].length - a[1].length).map(([k, list]) => ({ label: k, value: list.length })), centerLabel: 'leads', fmt: (x) => String(x) });
    // marcas
    const bb = groupBy(valid.filter((s) => daysBetween(s.fecha, t) <= 365), (s) => (DB.get('vehicles', s.vehicleId) || {}).brand || 'otro');
    C.hbars($('#chBrand'), { items: Object.entries(bb).map(([k, list]) => ({ label: Q.brandName(k), value: list.length, display: list.length + ' u.' })).sort((a, b) => b.value - a.value), color: C.PAL[0] });
    // últimos leads
    $('#dLeads').innerHTML = '<div class="list">' + d.leads.slice().sort((a, b) => b.creado.localeCompare(a.creado)).slice(0, 6).map((l) => '<a href="#/crm/' + l.id + '">' + A.av(l.nombre, null, 'sm') + '<span style="min-width:0"><b class="strong">' + esc(l.nombre) + '</b><br><small class="mut">' + esc(l.interes) + ' · ' + esc(l.origen) + '</small></span><span class="r">' + A.badge(l.etapa, LABELS.leadStage) + '<br><small class="mut">' + fmt.ago(l.creado) + '</small></span></a>').join('') + '</div>';
  });

  /* ================================================================== CRM */
  const crm = { view: 'kanban', q: '', seller: '', origen: '', temp: '' };
  let crmInit = false;
  A.reg('crm', (v, id) => {
    A.setTitle('CRM · Leads');
    const qp = A.query(); if (qp.view) crm.view = qp.view;
    if (!crmInit) { crmInit = true; if (isSeller()) crm.seller = me().id; }
    const d = DB.data;
    const list = d.leads.filter((l) => (!crm.seller || l.vendedorId === crm.seller) && (!crm.origen || l.origen === crm.origen) && (!crm.temp || l.temperatura === crm.temp) &&
      (!crm.q || (l.nombre + ' ' + l.tel + ' ' + l.email + ' ' + l.interes).toLowerCase().includes(crm.q.toLowerCase())));
    const open = list.filter((l) => !['ganado', 'perdido'].includes(l.etapa));
    v.innerHTML = A.ph('CRM · Leads', open.length + ' oportunidades abiertas · Pipeline ' + fmt.money(sum(open, (l) => l.presupuesto)),
      '<div class="seg"><button data-v="kanban"' + (crm.view === 'kanban' ? ' class="on"' : '') + '>' + icon('kanban') + 'Pipeline</button><button data-v="list"' + (crm.view === 'list' ? ' class="on"' : '') + '>' + icon('list') + 'Lista</button></div><button class="btn" id="lExp">' + icon('download') + 'Exportar</button><button class="btn btn--pri" id="lNew">' + icon('plus') + 'Nuevo lead</button>') +
      '<div class="filters"><label class="search">' + icon('search') + '<input class="inp" id="lq" type="search" placeholder="Buscar nombre, teléfono, interés…" value="' + esc(crm.q) + '"></label>' +
      '<select class="inp" id="lSeller">' + A.sellerOpts(crm.seller, 'Todos los asesores') + '</select><select class="inp" id="lOrig">' + A.opts([...new Set(d.leads.map((l) => l.origen))].sort(), crm.origen, 'Todos los orígenes') + '</select>' +
      '<select class="inp" id="lTemp">' + A.opts([['caliente', 'Caliente'], ['tibio', 'Tibio'], ['frio', 'Frío']], crm.temp, 'Temperatura') + '</select></div><div id="crmBody"></div>';
    const body = $('#crmBody');
    if (crm.view === 'kanban') {
      body.innerHTML = '<div class="kanban">' + LABELS.leadStageOrder.map((st, i) => {
        const L = list.filter((l) => l.etapa === st).sort((a, b) => b.actualizado.localeCompare(a.actualizado));
        return '<div class="kcol"><div class="kcol__h"><b>' + LABELS.leadStage[st] + '</b><span class="n">' + L.length + '</span><small>' + fmt.moneyShort(sum(L, (l) => l.presupuesto)) + '</small></div><div class="kcol__bar" style="background:' + (st === 'perdido' ? '#9aa0a9' : st === 'ganado' ? '#1baf7a' : C.SEQ[i]) + '"></div><div class="kcol__b" data-st="' + st + '">' +
          L.slice(0, 60).map((l) => '<article class="kc" draggable="true" data-id="' + l.id + '"><div class="kc__t">' + (!l.leido ? '<span class="unread" title="Sin leer"></span>' : '') + '<span class="temp temp--' + l.temperatura + '" title="' + l.temperatura + '"></span><b>' + esc(l.nombre) + '</b></div><div class="kc__i">' + esc(l.interes) + (l.presupuesto ? ' · <b>' + fmt.moneyShort(l.presupuesto) + '</b>' : '') + '</div>' +
            '<div class="kc__f"><span class="tag">' + esc(l.origen) + '</span><span>' + fmt.ago(l.actualizado) + '</span>' + A.userAv(l.vendedorId, 'sm') + '</div>' +
            '<select class="inp move" aria-label="Mover a etapa" style="height:30px;font-size:.78rem">' + A.opts(LABELS.leadStageOrder.map((s) => [s, 'Mover a: ' + LABELS.leadStage[s]]), st) + '</select></article>').join('') + '</div></div>';
      }).join('') + '</div>';
      let drag = null;
      body.addEventListener('dragstart', (e) => { const c = e.target.closest('.kc'); if (!c) return; drag = c.dataset.id; c.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', drag); } catch (err) { /* noop */ } });
      body.addEventListener('dragend', (e) => { const c = e.target.closest('.kc'); if (c) c.classList.remove('dragging'); $$('.kcol__b', body).forEach((x) => x.classList.remove('over')); });
      $$('.kcol__b', body).forEach((col) => {
        col.addEventListener('dragover', (e) => { e.preventDefault(); col.classList.add('over'); });
        col.addEventListener('dragleave', (e) => { if (!col.contains(e.relatedTarget)) col.classList.remove('over'); });
        col.addEventListener('drop', (e) => { e.preventDefault(); col.classList.remove('over'); if (drag) A.moveLead(drag, col.dataset.st); drag = null; });
      });
      body.addEventListener('click', (e) => { if (e.target.closest('select')) return; const c = e.target.closest('.kc'); if (c) A.openLead(c.dataset.id); });
      body.addEventListener('change', (e) => { if (e.target.classList.contains('move')) A.moveLead(e.target.closest('.kc').dataset.id, e.target.value); });
    } else {
      body.innerHTML = '<div class="card" id="lTbl"></div>';
      A.table($('#lTbl'), {
        key: 'leads', rows: list, sort: { k: 'creado', d: -1 }, onRow: (l) => A.openLead(l.id), pageSize: 15,
        cols: [
          { k: 'nombre', l: 'Lead', r: (l) => A.who(l.nombre, esc(l.tel) + (l.email ? ' · ' + esc(l.email) : '')) },
          { k: 'interes', l: 'Interés', r: (l) => esc(l.interes) },
          { k: 'origen', l: 'Origen', r: (l) => '<span class="tag">' + esc(l.origen) + '</span>' },
          { k: 'etapa', l: 'Etapa', r: (l) => A.badge(l.etapa, LABELS.leadStage), s: (l) => LABELS.leadStageOrder.indexOf(l.etapa) },
          { k: 'temperatura', l: 'Temp.', r: (l) => '<span class="temp temp--' + l.temperatura + '"></span> ' + l.temperatura },
          { k: 'vendedorId', l: 'Asesor', r: (l) => A.userAv(l.vendedorId, 'sm') + ' <span class="small">' + esc(Q.userName(l.vendedorId).split(' ')[0]) + '</span>', s: (l) => Q.userName(l.vendedorId) },
          { k: 'presupuesto', l: 'Valor', num: true, r: (l) => l.presupuesto ? fmt.money(l.presupuesto) : '—' },
          { k: 'creado', l: 'Ingreso', r: (l) => '<span class="nowrap">' + fmt.date(l.creado) + '</span>' }
        ]
      });
    }
    $$('.seg button', v).forEach((b) => b.addEventListener('click', () => { crm.view = b.dataset.v; history.replaceState(null, '', '#/crm'); A.refresh(); }));
    $('#lq').addEventListener('input', (e) => { crm.q = e.target.value; clearTimeout(crm._t); crm._t = setTimeout(() => { A.refresh(); const i = $('#lq'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }, 250); });
    $('#lSeller').addEventListener('change', (e) => { crm.seller = e.target.value; A.refresh(); });
    $('#lOrig').addEventListener('change', (e) => { crm.origen = e.target.value; A.refresh(); });
    $('#lTemp').addEventListener('change', (e) => { crm.temp = e.target.value; A.refresh(); });
    $('#lNew').addEventListener('click', () => A.leadForm());
    $('#lExp').addEventListener('click', () => A.csv('leads', [['ID', (l) => l.id], ['Nombre', (l) => l.nombre], ['Teléfono', (l) => l.tel], ['Email', (l) => l.email], ['Interés', (l) => l.interes], ['Origen', (l) => l.origen], ['Etapa', (l) => LABELS.leadStage[l.etapa]], ['Asesor', (l) => Q.userName(l.vendedorId)], ['Ingreso', (l) => fmt.date(l.creado)]], list));
    if (id) A.openLead(id);
  });

  A.addActivity = (lead, tipo, texto) => { lead.actividades.push({ fecha: isoDT(new Date()), tipo, texto, user: me().id }); lead.actualizado = isoDT(new Date()); };
  A.moveLead = (id, st) => {
    const l = DB.get('leads', id); if (!l || l.etapa === st) return;
    const done = () => { A.addActivity(l, 'nota', 'Etapa cambiada a «' + LABELS.leadStage[st] + '».'); l.etapa = st; l.leido = true; DB.save(); A.refresh(); };
    if (st === 'perdido') {
      return A.formModal({ title: 'Marcar como perdido', sub: esc(l.nombre), ok: 'Marcar perdido', fields: [{ n: 'motivo', l: 'Motivo', t: 'select', o: ['Compró en otra concesionaria', 'Precio fuera de presupuesto', 'No califica para crédito', 'Dejó de responder', 'Posterga la compra', 'Otro'], req: true }, { n: 'nota', l: 'Comentario', t: 'textarea' }], onOk: (b, f) => { l.motivoPerdida = f.motivo; if (f.nota) A.addActivity(l, 'nota', f.nota); done(); } });
    }
    done();
    if (st === 'ganado') A.toast('¡Lead ganado! ' + l.nombre, ['#/ventas/nueva?lead=' + l.id, 'Crear operación']);
    else A.toast(l.nombre + ' → ' + LABELS.leadStage[st]);
  };
  A.leadForm = (l) => {
    const isNew = !l; l = l || { origen: 'Salón', etapa: 'nuevo', vendedorId: isSeller() ? me().id : '', temperatura: 'tibio', formaPago: 'financiado' };
    A.formModal({
      title: isNew ? 'Nuevo lead' : 'Editar lead', ok: isNew ? 'Crear lead' : 'Guardar', values: l,
      fields: [{ n: 'nombre', l: 'Nombre y apellido', req: true }, { n: 'tel', l: 'Teléfono', t: 'tel', req: true }, { n: 'email', l: 'Email', t: 'email' }, { n: 'ciudad', l: 'Localidad' },
        { n: 'origen', l: 'Origen', t: 'select', o: ['Salón', 'Web', 'WhatsApp', 'Instagram', 'Facebook', 'Referido', 'Mercado Libre', 'Teléfono'] }, { n: 'vehicleId', l: 'Vehículo de interés', t: 'select', o: DB.data.vehicles.filter((x) => x.status !== 'vendido').map((x) => [x.id, Q.vName(x) + ' ' + x.version + (x.cond === 'usado' ? ' (' + x.year + ')' : '')]), empty: '— Sin definir —' },
        { n: 'formaPago', l: 'Forma de pago', t: 'select', o: Object.entries(LABELS.payment) }, { n: 'vendedorId', l: 'Asesor asignado', t: 'select', o: DB.data.team.filter((u) => /asesor|gerente/i.test(u.rol)).map((u) => [u.id, u.nombre]), empty: 'Sin asignar' },
        { n: 'temperatura', l: 'Temperatura', t: 'select', o: [['caliente', 'Caliente'], ['tibio', 'Tibio'], ['frio', 'Frío']] }, { n: 'etapa', l: 'Etapa', t: 'select', o: LABELS.leadStageOrder.map((s) => [s, LABELS.leadStage[s]]) },
        { n: 'mensaje', l: 'Consulta / notas', t: 'textarea' }],
      onOk: (b, f) => {
        const veh = f.vehicleId ? DB.get('vehicles', f.vehicleId) : null;
        Object.assign(f, { interes: veh ? Q.vName(veh) : (l.interes || 'Consulta general'), presupuesto: veh ? veh.price : (l.presupuesto || 0) });
        if (isNew) { const now = isoDT(new Date()); const nl = DB.insert('leads', { ...f, creado: now, actualizado: now, motivoPerdida: '', clientId: '', leido: true, actividades: [{ fecha: now, tipo: 'nota', texto: 'Lead cargado manualmente por ' + me().nombre + '.', user: me().id }] }); A.toast('Lead creado'); if (A.current === 'crm') A.refresh(); A.openLead(nl.id); }
        else { DB.update('leads', l.id, f); A.toast('Lead actualizado'); A.refresh(); A.openLead(l.id); }
      }
    });
  };
  A.openLead = (id) => {
    const l = DB.get('leads', id); if (!l) return;
    if (!l.leido) { l.leido = true; DB.save(); }
    const veh = l.vehicleId ? DB.get('vehicles', l.vehicleId) : null;
    const prev = $('.drawer'); if (prev) prev.remove();
    const ICO = { llamada: 'phone', whatsapp: 'whatsapp', email: 'mail', visita: 'home', nota: 'doc', test_drive: 'key', presupuesto: 'doc' };
    const wa = waLink(waNum(l.tel), 'Hola ' + l.nombre.split(' ')[0] + ', te escribe ' + me().nombre + ' de ' + DB.data.config.name + '. Te contacto por tu consulta sobre ' + l.interes + '.');
    const dr = A.drawer({
      head: A.who(l.nombre, esc(l.interes) + ' · ' + l.id, null, 'lg'),
      body: '<div class="fgrid fgrid--3"><label class="fld">Etapa<select class="inp" id="dStage">' + A.opts(LABELS.leadStageOrder.map((s) => [s, LABELS.leadStage[s]]), l.etapa) + '</select></label><label class="fld">Temperatura<select class="inp" id="dTemp">' + A.opts([['caliente', '🔴 Caliente'], ['tibio', '🟡 Tibio'], ['frio', '🔵 Frío']], l.temperatura) + '</select></label><label class="fld">Asesor<select class="inp" id="dSeller">' + A.opts(DB.data.team.filter((u) => /asesor|gerente/i.test(u.rol)).map((u) => [u.id, u.nombre]), l.vendedorId, 'Sin asignar') + '</select></label></div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap"><a class="btn btn--sm" href="tel:' + esc(l.tel.replace(/\s/g, '')) + '" data-act="llamada">' + icon('phone') + 'Llamar</a><a class="btn btn--sm btn--wa" target="_blank" rel="noopener" href="' + wa + '" data-act="whatsapp">' + icon('whatsapp') + 'WhatsApp</a>' + (l.email ? '<a class="btn btn--sm" href="mailto:' + esc(l.email) + '?subject=' + encodeURIComponent('Tu consulta por ' + l.interes) + '" data-act="email">' + icon('mail') + 'Email</a>' : '') + '<button class="btn btn--sm" id="dEdit">' + icon('edit') + 'Editar</button></div>' +
        '<dl class="dl"><dt>Teléfono</dt><dd>' + esc(l.tel) + '</dd><dt>Email</dt><dd>' + esc(l.email || '—') + '</dd><dt>Localidad</dt><dd>' + esc(l.ciudad || '—') + '</dd><dt>Origen</dt><dd><span class="tag">' + esc(l.origen) + '</span></dd><dt>Forma de pago</dt><dd>' + LABELS.payment[l.formaPago] + '</dd><dt>Ingresó</dt><dd>' + fmt.dateTime(l.creado) + ' (' + fmt.ago(l.creado) + ')</dd>' + (l.motivoPerdida ? '<dt>Motivo pérdida</dt><dd class="err-t">' + esc(l.motivoPerdida) + '</dd>' : '') + '</dl>' +
        (veh ? '<a class="card" href="#/inventario/' + veh.id + '" style="text-decoration:none;display:block"><div class="vcard" style="padding:10px"><img src="' + esc(veh.img) + '" alt=""><div><b class="strong">' + esc(Q.vFull(veh)) + '</b><br><span class="small mut">' + (veh.cond === '0km' ? '0km · Stock ' + veh.stock : 'Usado ' + veh.year + ' · ' + fmt.km(veh.km)) + '</span><br><b>' + fmt.money(veh.price) + '</b></div></div></a>' : '') +
        (l.mensaje ? '<div class="alert alert--info">' + icon('mail') + '<span>“' + esc(l.mensaje) + '”</span></div>' : '') +
        '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn--sm" id="dAppt">' + icon('calendar') + 'Agendar cita</button><button class="btn btn--sm" id="dQuote">' + icon('doc') + 'Presupuesto</button>' + (l.clientId ? '<a class="btn btn--sm" href="#/clientes/' + l.clientId + '">' + icon('user') + 'Ver cliente</a>' : '<button class="btn btn--sm" id="dConv">' + icon('user') + 'Convertir en cliente</button>') + '<a class="btn btn--sm btn--pri" href="#/ventas/nueva?lead=' + l.id + '">' + icon('tag') + 'Crear operación</a></div>' +
        '<form class="card" id="dAct" style="padding:12px;display:grid;gap:8px"><b class="strong">Registrar actividad</b><div style="display:flex;gap:8px"><select class="inp" name="tipo" style="max-width:170px">' + A.opts(Object.entries(LABELS.activity)) + '</select><input class="inp" name="texto" required placeholder="Ej.: Llamé, le envié la cotización…"><button class="btn btn--pri">Guardar</button></div></form>' +
        '<div><b class="strong" style="display:block;margin-bottom:10px">Historial</b><div class="tl">' + l.actividades.slice().reverse().map((a) => '<div class="tl__i"><span class="tl__ic">' + icon(ICO[a.tipo] || 'doc') + '</span><div><p><b>' + LABELS.activity[a.tipo] + '</b> · ' + esc(a.texto) + '</p><small>' + fmt.dateTime(a.fecha) + ' · ' + (a.user === 'sistema' ? 'Sistema' : esc(Q.userName(a.user))) + '</small></div></div>').join('') + '</div></div>' +
        '<button class="btn btn--sm btn--danger" id="dDel" style="justify-self:start">' + icon('trash') + 'Eliminar lead</button>',
      onClose: () => { if (location.hash.startsWith('#/crm/')) history.replaceState(null, '', '#/crm'); }
    });
    const b = dr.box;
    const upd = (patch, msg) => { Object.assign(l, patch); A.addActivity(l, 'nota', msg); DB.save(); A.refresh(); A.openLead(l.id); };
    $('#dStage', b).addEventListener('change', (e) => { const st = e.target.value; dr.close(); A.moveLead(l.id, st); if (st !== 'perdido') A.openLead(l.id); });
    $('#dTemp', b).addEventListener('change', (e) => upd({ temperatura: e.target.value }, 'Temperatura: ' + e.target.value + '.'));
    $('#dSeller', b).addEventListener('change', (e) => upd({ vendedorId: e.target.value }, 'Asignado a ' + Q.userName(e.target.value) + '.'));
    $$('[data-act]', b).forEach((a) => a.addEventListener('click', () => { A.addActivity(l, a.dataset.act, a.dataset.act === 'whatsapp' ? 'Se envió mensaje de WhatsApp.' : a.dataset.act === 'llamada' ? 'Llamada saliente.' : 'Se envió email.'); if (l.etapa === 'nuevo') l.etapa = 'contactado'; DB.save(); setTimeout(() => { A.refresh(); A.openLead(l.id); }, 300); }));
    $('#dEdit', b).addEventListener('click', () => { dr.close(); A.leadForm(l); });
    $('#dAct', b).addEventListener('submit', (e) => { e.preventDefault(); const f = A.read(e.target); A.addActivity(l, f.tipo, f.texto); if (l.etapa === 'nuevo') l.etapa = 'contactado'; if (f.tipo === 'test_drive' && ['nuevo', 'contactado'].includes(l.etapa)) l.etapa = 'test_drive'; DB.save(); A.toast('Actividad registrada'); A.refresh(); A.openLead(l.id); });
    $('#dAppt', b).addEventListener('click', () => A.apptForm({ tipo: 'test_drive', leadId: l.id, nombre: l.nombre, tel: l.tel, vehiculo: veh ? Q.vName(veh) : l.interes, asignado: l.vendedorId || me().id }));
    $('#dQuote', b).addEventListener('click', () => { if (!veh) return A.toast('Asigná un vehículo de interés para generar el presupuesto'); A.printQuote({ nombre: l.nombre, tel: l.tel, email: l.email }, veh); A.addActivity(l, 'presupuesto', 'Presupuesto generado para ' + Q.vFull(veh) + '.'); DB.save(); });
    const conv = $('#dConv', b); if (conv) conv.addEventListener('click', () => A.clientForm({ nombre: l.nombre, tel: l.tel, email: l.email, ciudad: l.ciudad, vendedorId: l.vendedorId }, (c) => { l.clientId = c.id; A.addActivity(l, 'nota', 'Convertido en cliente ' + c.id + '.'); DB.save(); A.openLead(l.id); }));
    $('#dDel', b).addEventListener('click', async () => { if (await A.confirm('Eliminar lead', 'Se eliminará el lead de ' + esc(l.nombre) + ' y su historial.', 'Eliminar', true)) { DB.remove('leads', l.id); dr.close(); A.toast('Lead eliminado'); A.refresh(); } });
  };
  A.printQuote = (who, v) => {
    const c = DB.data.config, gastos = v.price * c.patentamiento / 100;
    const rows = [12, 24, 36, 48].map((n) => { const cap = v.price * 0.6, tna = v.promoTasa0 && n <= 12 ? c.tnaPromo : c.tna; return '<tr><td>' + n + ' cuotas</td><td class="num">' + fmt.money(v.price * 0.4) + '</td><td class="num">' + fmt.money(cap) + '</td><td class="num">' + fmt.pct(tna) + '</td><td class="num"><b>' + fmt.money(Fin.cuota(cap, tna, n)) + '</b></td></tr>'; }).join('');
    A.print('Presupuesto', '<div class="box grid"><div><b>Cliente:</b> ' + esc(who.nombre) + '</div><div><b>Teléfono:</b> ' + esc(who.tel || '—') + '</div><div><b>Email:</b> ' + esc(who.email || '—') + '</div><div><b>Asesor:</b> ' + esc(me().nombre) + '</div></div>' +
      '<h2>Vehículo</h2><table><tr><th>Unidad</th><th>Condición</th><th class="num">Precio</th></tr><tr><td>' + esc(Q.vFull(v)) + '</td><td>' + (v.cond === '0km' ? '0km ' + v.year : 'Usado ' + v.year + ' · ' + fmt.km(v.km)) + '</td><td class="num">' + fmt.money(v.price) + '</td></tr><tr><td colspan="2">Gastos de patentamiento y entrega (estimado ' + c.patentamiento + '%)</td><td class="num">' + fmt.money(gastos) + '</td></tr><tr><td colspan="2" class="tot">Total contado</td><td class="num tot">' + fmt.money(v.price + gastos) + '</td></tr></table>' +
      '<h2>Alternativas de financiación (anticipo 40%)</h2><table><tr><th>Plazo</th><th class="num">Anticipo</th><th class="num">Capital</th><th class="num">TNA</th><th class="num">Cuota</th></tr>' + rows + '</table>' +
      (v.cond === '0km' ? '<h2>Plan de ahorro</h2><table>' + Fin.planTable(v).map((r) => '<tr><td>' + r.label + '</td><td class="num">' + fmt.money(r.value) + '</td></tr>').join('') + '</table>' : '') +
      '<p class="muted">Presupuesto válido por 72 horas. Precios sujetos a modificación sin previo aviso. Financiación sujeta a aprobación crediticia.</p>');
  };

  /* ============================================================= CLIENTES */
  const cf = { q: '', riesgo: '', mora: '', seller: '' };
  A.reg('clientes', (v, id) => {
    if (id) return clientFile(v, id);
    A.setTitle('Clientes');
    const d = DB.data;
    const rows = d.clients.map((c) => { const f = Q.clientFinance(c.id); return { c, f, id: c.id }; });
    const list = rows.filter(({ c, f }) => (!cf.q || (c.nombre + ' ' + c.dni + ' ' + c.email + ' ' + c.tel + ' ' + c.ciudad).toLowerCase().includes(cf.q.toLowerCase())) && (!cf.riesgo || f.riesgo === cf.riesgo) && (!cf.mora || (cf.mora === 'si' ? f.vencido > 0 : f.vencido === 0)) && (!cf.seller || c.vendedorId === cf.seller));
    const enMora = rows.filter((r) => r.f.vencido > 0);
    v.innerHTML = A.ph('Clientes', d.clients.length + ' clientes · ' + enMora.length + ' con deuda vencida', '<button class="btn" id="cExp">' + icon('download') + 'Exportar</button><button class="btn btn--pri" id="cNew">' + icon('plus') + 'Nuevo cliente</button>') +
      '<div class="kpis">' + A.kpi({ label: 'Clientes activos', icon: 'users', value: rows.filter((r) => r.f.credits.some((x) => x.st.estado !== 'cancelado') || r.f.policies.some((p) => p.st === 'vigente') || r.f.savings.length).length, sub: 'con productos vigentes' }) +
      A.kpi({ label: 'Deuda total financiada', icon: 'card', value: fmt.moneyShort(sum(rows, (r) => r.f.deuda)), sub: 'saldo de cartera' }) +
      A.kpi({ label: 'Clientes en mora', icon: 'alert', value: enMora.length, alert: enMora.length > 0, sub: fmt.money(sum(enMora, (r) => r.f.vencido)) + ' vencido' }) +
      A.kpi({ label: 'Riesgo alto', icon: 'shield', value: rows.filter((r) => r.f.riesgo === 'Alto').length, sub: 'requieren seguimiento' }) + '</div>' +
      '<div class="filters"><label class="search">' + icon('search') + '<input class="inp" id="cq" type="search" placeholder="Nombre, DNI, email, teléfono…" value="' + esc(cf.q) + '"></label><select class="inp" id="cRisk">' + A.opts(['Bajo', 'Medio', 'Alto'].map((x) => [x, 'Riesgo ' + x.toLowerCase()]), cf.riesgo, 'Todos los riesgos') + '</select><select class="inp" id="cMora">' + A.opts([['si', 'Con deuda vencida'], ['no', 'Al día']], cf.mora, 'Estado de pago') + '</select><select class="inp" id="cSeller">' + A.sellerOpts(cf.seller, 'Todos los asesores') + '</select></div><div class="card" id="cTbl"></div>';
    A.table($('#cTbl'), {
      key: 'clients', rows: list, sort: { k: 'nombre', d: 1 }, onRow: (r) => A.go('#/clientes/' + r.id),
      cols: [
        { k: 'nombre', l: 'Cliente', s: (r) => r.c.nombre, r: (r) => A.who(r.c.nombre, esc(r.c.email)) + (r.c.tags.length ? '<div style="margin-top:4px;display:flex;gap:4px">' + r.c.tags.map((t) => '<span class="tag">' + esc(t) + '</span>').join('') + '</div>' : '') },
        { k: 'dni', l: 'DNI', s: (r) => r.c.dni, r: (r) => '<span class="nowrap">' + esc(r.c.dni) + '</span>' },
        { k: 'tel', l: 'Teléfono', s: (r) => r.c.tel, r: (r) => '<span class="nowrap">' + esc(r.c.tel) + '</span>' },
        { k: 'ciudad', l: 'Localidad', s: (r) => r.c.ciudad, r: (r) => esc(r.c.ciudad) },
        { k: 'ops', l: 'Compras', num: true, s: (r) => r.f.sales.length, r: (r) => r.f.sales.length },
        { k: 'deuda', l: 'Saldo', num: true, s: (r) => r.f.deuda, r: (r) => r.f.deuda ? fmt.money(r.f.deuda) : '—' },
        { k: 'vencido', l: 'Estado', s: (r) => r.f.vencido, r: (r) => r.f.vencido ? '<span class="bd bd--err">Mora ' + r.f.diasMora + ' d</span>' : r.f.credits.length ? '<span class="bd bd--ok">Al día</span>' : '<span class="bd bd--muted">Sin crédito</span>' },
        { k: 'riesgo', l: 'Riesgo', s: (r) => ['Bajo', 'Medio', 'Alto'].indexOf(r.f.riesgo), r: (r) => '<span class="bd bd--' + ({ Bajo: 'ok', Medio: 'amber', Alto: 'err' })[r.f.riesgo] + '">' + r.f.riesgo + '</span>' },
        { k: 'seller', l: 'Asesor', s: (r) => Q.userName(r.c.vendedorId), r: (r) => A.userAv(r.c.vendedorId, 'sm') }
      ]
    });
    $('#cq').addEventListener('input', (e) => { cf.q = e.target.value; clearTimeout(cf._t); cf._t = setTimeout(() => { A.refresh(); const i = $('#cq'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }, 250); });
    $('#cRisk').addEventListener('change', (e) => { cf.riesgo = e.target.value; A.refresh(); });
    $('#cMora').addEventListener('change', (e) => { cf.mora = e.target.value; A.refresh(); });
    $('#cSeller').addEventListener('change', (e) => { cf.seller = e.target.value; A.refresh(); });
    $('#cNew').addEventListener('click', () => A.clientForm(null, (c) => A.go('#/clientes/' + c.id)));
    $('#cExp').addEventListener('click', () => A.csv('clientes', [['ID', (r) => r.c.id], ['Nombre', (r) => r.c.nombre], ['DNI', (r) => r.c.dni], ['CUIT', (r) => r.c.cuit], ['Email', (r) => r.c.email], ['Teléfono', (r) => r.c.tel], ['Localidad', (r) => r.c.ciudad], ['Ingresos', (r) => r.c.ingresos], ['Saldo', (r) => Math.round(r.f.deuda)], ['Vencido', (r) => Math.round(r.f.vencido)], ['Riesgo', (r) => r.f.riesgo]], list));
  });

  A.clientForm = (c, after) => {
    const isNew = !c || !c.id; c = c || {};
    A.formModal({
      title: isNew ? 'Nuevo cliente' : 'Editar cliente', size: 'lg', ok: isNew ? 'Crear cliente' : 'Guardar', values: { provincia: 'Buenos Aires', bcra: 1, score: 700, vendedorId: me().id, ...c, tags: (c.tags || []).join(', ') },
      fields: [{ n: 'nombre', l: 'Nombre y apellido', req: true }, { n: 'dni', l: 'DNI', req: true, ph: 'Sin puntos' }, { n: 'cuit', l: 'CUIT/CUIL' }, { n: 'nacimiento', l: 'Fecha de nacimiento', t: 'date' },
        { n: 'tel', l: 'Teléfono', t: 'tel', req: true }, { n: 'email', l: 'Email', t: 'email' }, { n: 'direccion', l: 'Dirección' }, { n: 'ciudad', l: 'Localidad' }, { n: 'provincia', l: 'Provincia' },
        { n: 'ocupacion', l: 'Ocupación' }, { n: 'empleador', l: 'Empleador / actividad' }, { n: 'antiguedad', l: 'Antigüedad laboral (años)', t: 'number', min: 0 }, { n: 'ingresos', l: 'Ingresos mensuales netos', t: 'money', req: true },
        { n: 'score', l: 'Score crediticio (0-999)', t: 'number', min: 0, max: 999 }, { n: 'bcra', l: 'Situación BCRA', t: 'select', o: [[1, '1 · Normal'], [2, '2 · Riesgo bajo'], [3, '3 · Riesgo medio'], [4, '4 · Riesgo alto'], [5, '5 · Irrecuperable']] },
        { n: 'vendedorId', l: 'Asesor', t: 'select', o: DB.data.team.map((u) => [u.id, u.nombre]) }, { n: 'tags', l: 'Etiquetas', ph: 'VIP, Flota…' }, { n: 'notas', l: 'Notas internas', t: 'textarea' }],
      onOk: (b, f) => {
        f.bcra = +f.bcra; f.tags = f.tags ? f.tags.split(',').map((s) => s.trim()).filter(Boolean) : []; f.dni = f.dni.replace(/\D/g, '');
        const dup = DB.data.clients.find((x) => x.dni === f.dni && x.id !== c.id);
        if (dup) { A.toast('Ya existe un cliente con ese DNI: ' + dup.nombre); return false; }
        let saved;
        if (isNew) saved = DB.insert('clients', { ...f, perfil: 'bueno', creado: iso(today()) }); else saved = DB.update('clients', c.id, f);
        A.toast(isNew ? 'Cliente creado' : 'Datos actualizados');
        if (after) after(saved); else A.refresh();
      }
    });
  };

  function gauge(score) {
    const p = Math.max(0, Math.min(1, score / 999)), a = Math.PI * (1 - p), r = 80, cx = 100, cy = 95;
    const col = score >= 700 ? '#0ca30c' : score >= 550 ? '#fab219' : '#d03b3b';
    const x = cx + r * Math.cos(a), y = cy - r * Math.sin(a);
    return '<svg class="gauge" viewBox="0 0 200 110" role="img" aria-label="Score ' + score + ' de 999"><path d="M20,95 A80,80 0 0 1 180,95" fill="none" stroke="#f0ede7" stroke-width="14" stroke-linecap="round"/><path d="M20,95 A80,80 0 0 1 ' + x.toFixed(1) + ',' + y.toFixed(1) + '" fill="none" stroke="' + col + '" stroke-width="14" stroke-linecap="round"/><text x="100" y="86" text-anchor="middle" style="font:800 30px Outfit,sans-serif;fill:#14171c">' + score + '</text><text x="100" y="104" text-anchor="middle" style="font:500 11px Inter,sans-serif;fill:#6b7280">score / 999</text></svg>';
  }
  function payStrip(cr) {
    const t = today();
    return '<div class="paystrip" aria-label="Historial de cuotas">' + cr.cuotas.map((q) => { const late = q.pagada && daysBetween(q.vto, q.fechaPago) > 5; const due = !q.pagada && parse(q.vto) < t; return '<i class="' + (q.pagada ? (late ? 'p-late' : 'p-ok') : due ? 'p-due' : 'p-fut') + '" title="Cuota ' + q.n + ' · vto ' + fmt.date(q.vto) + (q.pagada ? ' · pagada ' + fmt.date(q.fechaPago) : due ? ' · VENCIDA' : ' · pendiente') + '"></i>'; }).join('') + '</div>';
  }
  A.payStrip = payStrip; A.gauge = gauge;

  function clientFile(v, id) {
    const c = DB.get('clients', id); if (!c) { v.innerHTML = A.ph('Cliente no encontrado', '', '', ['#/clientes', 'Clientes']); return; }
    A.setTitle(c.nombre);
    const f = Q.clientFinance(id), t = today();
    const tab = A.query().tab || 'resumen';
    const appts = DB.data.appts.filter((a) => a.clientId === id), wos = DB.data.workOrders.filter((w) => w.clientId === id);
    const leads = DB.data.leads.filter((l) => l.clientId === id);
    const age = c.nacimiento ? Math.floor(daysBetween(c.nacimiento, t) / 365.25) : null;
    const riskTone = { Bajo: 'ok', Medio: 'amber', Alto: 'err' }[f.riesgo];
    const wa = waLink(waNum(c.tel), 'Hola ' + c.nombre.split(' ')[0] + ', te escribimos de ' + DB.data.config.name + '.');
    v.innerHTML = '<a class="back" href="#/clientes">' + icon('chevron') + 'Clientes</a>' +
      '<section class="card hero360"><div class="hero360__top">' + A.av(c.nombre, null, 'lg') + '<div style="min-width:0"><h2>' + esc(c.nombre) + ' ' + c.tags.map((tg) => '<span class="tag" style="vertical-align:middle">' + esc(tg) + '</span>').join(' ') + '</h2><div class="hero360__meta"><span>' + icon('user') + 'DNI ' + esc(c.dni) + (age ? ' · ' + age + ' años' : '') + '</span><span>' + icon('phone') + esc(c.tel) + '</span><span>' + icon('mail') + esc(c.email || '—') + '</span><span>' + icon('pin') + esc(c.ciudad) + '</span><span>' + icon('team') + esc(Q.userName(c.vendedorId)) + '</span></div></div>' +
      '<div class="hero360__acts"><a class="btn btn--sm btn--wa" target="_blank" rel="noopener" href="' + wa + '">' + icon('whatsapp') + 'WhatsApp</a><button class="btn btn--sm" id="cfEdit">' + icon('edit') + 'Editar</button><button class="btn btn--sm" id="cfPrint">' + icon('print') + 'Estado de cuenta</button>' + (f.credits.some((x) => x.st.impagas) ? '<button class="btn btn--sm btn--ok" id="cfPay">' + icon('cash') + 'Registrar pago</button>' : '') + '<a class="btn btn--sm btn--pri" href="#/ventas/nueva?cliente=' + c.id + '">' + icon('tag') + 'Nueva operación</a></div></div>' +
      '<div class="kpis" style="margin:0">' + A.kpi({ label: 'Total comprado', icon: 'tag', value: fmt.moneyShort(f.totalComprado), sub: f.sales.length + ' operación(es)' }) + A.kpi({ label: 'Saldo financiado', icon: 'card', value: fmt.money(f.deuda), sub: f.credits.filter((x) => x.st.estado !== 'cancelado').length + ' crédito(s) activo(s)' }) +
      A.kpi({ label: 'Deuda vencida', icon: 'alert', value: fmt.money(f.vencido), alert: f.vencido > 0, sub: f.vencido ? f.diasMora + ' días · punitorios ' + fmt.money(f.punitorios) : 'Sin atrasos' }) + A.kpi({ label: 'Compromiso mensual', icon: 'wallet', value: fmt.money(f.cuotaMensual), sub: fmt.pct(f.ratio) + ' de sus ingresos' }) +
      '<div class="kpi"><span class="kpi__l">' + icon('shield') + 'Riesgo crediticio</span><span class="kpi__v"><span class="bd bd--' + riskTone + '" style="font-size:.9rem">' + f.riesgo + '</span></span><span class="kpi__s">Score ' + c.score + ' · BCRA sit. ' + c.bcra + '</span></div></div></section>' +
      '<div class="tabs mt" id="cfTabs">' + [['resumen', 'Resumen'], ['finanzas', 'Estado financiero'], ['cc', 'Cuenta corriente'], ['ops', 'Operaciones', f.sales.length], ['seguros', 'Seguros', f.policies.length], ['plan', 'Plan de ahorro', f.savings.length], ['taller', 'Turnos y taller', appts.length + wos.length], ['datos', 'Datos personales']].map(([k, l, n]) => '<button data-t="' + k + '"' + (k === tab ? ' class="on"' : '') + '>' + l + (n ? '<span class="cnt">' + n + '</span>' : '') + '</button>').join('') + '</div><div id="cfBody"></div>';
    const body = $('#cfBody');
    const T = {
      resumen() {
        const ev = [];
        f.sales.forEach((s) => ev.push([s.fecha, 'tag', 'Compró ' + s.vehiculo + ' (' + LABELS.payment[s.formaPago] + ')', fmt.money(s.precio), '#/ventas/' + s.id]));
        f.credits.forEach((cr) => cr.cuotas.filter((q) => q.pagada).slice(-3).forEach((q) => ev.push([q.fechaPago, 'cash', 'Pagó cuota ' + q.n + '/' + cr.plazo + ' de ' + cr.id, fmt.money(q.monto)])));
        f.policies.forEach((p) => ev.push([p.inicio, 'shield', 'Póliza ' + Q.coverage(p.coverage).nombre + ' con ' + Q.insurer(p.insurerId).nombre, fmt.money(p.primaMensual) + '/mes']));
        appts.forEach((a) => ev.push([a.fecha.slice(0, 10), 'calendar', LABELS.apptType[a.tipo] + ' · ' + LABELS.apptState[a.estado], a.vehiculo]));
        f.savings.forEach((s) => ev.push([s.alta, 'piggy', 'Suscribió plan de ahorro ' + s.modelo, 'Grupo ' + s.grupo]));
        ev.sort((a, b) => b[0].localeCompare(a[0]));
        body.innerHTML = '<div class="grid g-21">' + A.card({ title: 'Actividad reciente', icon: 'clock', body: ev.length ? '<div class="tl">' + ev.slice(0, 12).map((e) => '<div class="tl__i"><span class="tl__ic">' + icon(e[1]) + '</span><div><p>' + (e[4] ? '<a href="' + e[4] + '" class="strong" style="text-decoration:none">' + esc(e[2]) + '</a>' : esc(e[2])) + ' · <b>' + esc(e[3]) + '</b></p><small>' + fmt.date(e[0]) + '</small></div></div>').join('') + '</div>' : A.empty('Sin actividad registrada') }) +
          '<div style="display:grid;gap:16px;align-content:start">' + A.card({ title: 'Perfil', icon: 'user', body: '<dl class="dl"><dt>Ocupación</dt><dd>' + esc(c.ocupacion || '—') + '</dd><dt>Empleador</dt><dd>' + esc(c.empleador || '—') + '</dd><dt>Antigüedad</dt><dd>' + (c.antiguedad || 0) + ' años</dd><dt>Ingresos netos</dt><dd>' + fmt.money(c.ingresos) + '</dd><dt>Cliente desde</dt><dd>' + fmt.date(c.creado) + '</dd><dt>Dirección</dt><dd>' + esc(c.direccion || '—') + '</dd></dl>' + (c.notas ? '<div class="alert alert--warn mt">' + icon('doc') + esc(c.notas) + '</div>' : '') }) +
          (leads.length ? A.card({ title: 'Oportunidades', icon: 'funnel', flush: true, body: '<div class="list">' + leads.map((l) => '<a href="#/crm/' + l.id + '"><span><b class="strong">' + esc(l.interes) + '</b><br><small class="mut">' + fmt.date(l.creado) + '</small></span><span class="r">' + A.badge(l.etapa, LABELS.leadStage) + '</span></a>').join('') + '</div>' }) : '') + '</div></div>';
      },
      finanzas() {
        const compCred = sum(f.credits.filter((x) => x.st.estado !== 'cancelado'), (x) => x.cuota), compPlan = sum(f.savings.filter((s) => s.estado !== 'baja' && s.st.restante > 0), (s) => s.valorCuota), compSeg = sum(f.policies.filter((p) => !['vencida', 'cancelada'].includes(p.st)), (p) => p.primaMensual);
        const ing = c.ingresos || 1, lim = 0.35;
        const i = DB.data.config.tna / 1200, capMax = f.capacidad > 0 ? f.capacidad * (1 - Math.pow(1 + i, -36)) / i : 0;
        const seg = (val, col) => '<i style="left:' + 0 + '%;width:' + Math.min(100, val / ing * 100) + '%;background:' + col + '"></i>';
        body.innerHTML = '<div class="grid g-12">' +
          A.card({ title: 'Perfil de riesgo', icon: 'shield', body: '<div class="risk">' + gauge(c.score) + '<span class="bd bd--' + riskTone + '" style="font-size:.85rem;padding:4px 12px">' + icon(f.riesgo === 'Bajo' ? 'check' : 'alert') + ' Riesgo ' + f.riesgo.toLowerCase() + '</span><dl class="dl" style="width:100%;text-align:left"><dt>Situación BCRA</dt><dd>' + c.bcra + ' · ' + ['Normal', 'Riesgo bajo', 'Riesgo medio', 'Riesgo alto', 'Irrecuperable'][c.bcra - 1] + '</dd><dt>Puntualidad de pagos</dt><dd>' + fmt.pct(f.puntual, 0) + '</dd><dt>Máx. días de atraso</dt><dd class="' + (f.diasMora ? 'err-t' : '') + '">' + f.diasMora + ' días</dd><dt>Cuotas de plan atrasadas</dt><dd>' + f.planAtraso + '</dd></dl></div>' }) +
          A.card({ title: 'Capacidad de pago', icon: 'wallet', sub: 'Regla: compromisos ≤ 35% de ingresos', body: '<div class="meter"><div class="meter__row"><span>Compromisos mensuales: <b class="strong">' + fmt.money(f.cuotaMensual) + '</b></span><span>Ingresos: <b class="strong">' + fmt.money(c.ingresos) + '</b></span></div>' +
            '<div class="meter__bar" style="display:flex">' + [[compCred, '#2a78d6'], [compPlan, '#eb6834'], [compSeg, '#1baf7a']].map(([val, col]) => '<span style="height:100%;width:' + Math.min(100, val / ing * 100) + '%;background:' + col + ';margin-right:2px"></span>').join('') + '<span class="lim" style="left:' + lim * 100 + '%"></span></div>' +
            '<div class="legend"><span><i style="background:#2a78d6"></i>Créditos ' + fmt.money(compCred) + '</span><span><i style="background:#eb6834"></i>Plan de ahorro ' + fmt.money(compPlan) + '</span><span><i style="background:#1baf7a"></i>Seguros ' + fmt.money(compSeg) + '</span><span><i style="background:#14171c;width:2px"></i>Límite 35%</span></div></div>' +
            '<div class="grid g3 mt"><div class="kpi"><span class="kpi__l">Relación cuota/ingreso</span><span class="kpi__v ' + (f.ratio > 35 ? 'err-t' : f.ratio > 25 ? 'amber-t' : 'ok-t') + '">' + fmt.pct(f.ratio) + '</span></div><div class="kpi"><span class="kpi__l">Margen disponible</span><span class="kpi__v">' + fmt.money(f.capacidad) + '</span><span class="kpi__s">por mes</span></div><div class="kpi"><span class="kpi__l">Pre-aprobación sugerida</span><span class="kpi__v">' + fmt.moneyShort(capMax) + '</span><span class="kpi__s">capital a 36 m · TNA ' + fmt.pct(DB.data.config.tna) + '</span></div></div>' +
            (f.riesgo === 'Alto' ? '<div class="alert alert--err mt">' + icon('alert') + '<span>Cliente con riesgo alto: se recomienda exigir anticipo mayor al 50% o codeudor para nuevas financiaciones.</span></div>' : f.riesgo === 'Medio' ? '<div class="alert alert--warn mt">' + icon('info') + '<span>Riesgo medio: verificar recibos de sueldo recientes antes de aprobar nuevas operaciones.</span></div>' : '<div class="alert alert--ok mt">' + icon('check') + '<span>Cliente apto para nuevas financiaciones dentro del margen disponible.</span></div>') }) + '</div>' +
          '<h3 class="mt" style="font-size:1.1rem;margin:22px 0 12px">Financiaciones</h3>' +
          (f.credits.length ? '<div class="grid g2">' + f.credits.map((cr) => {
            const s = cr.st, sale = DB.get('sales', cr.saleId);
            return A.card({ title: cr.id + ' · ' + (sale ? sale.vehiculo : 'Crédito'), icon: 'card', acts: A.badge(s.estado, LABELS.creditState), body: '<div style="display:grid;gap:12px"><div style="display:flex;justify-content:space-between" class="small"><span>' + s.pagadas + ' de ' + s.total + ' cuotas pagas</span><b>' + Math.round(s.avance * 100) + '%</b></div>' + A.prog(s.avance, s.estado === 'en_mora' ? 'err' : 'ok') + payStrip(cr) +
              '<div class="legend"><span><i style="background:#1baf7a"></i>A término</span><span><i style="background:#eda100"></i>Con atraso</span><span><i style="background:#e34948"></i>Vencida impaga</span><span><i style="background:#f0ede7"></i>Futura</span></div>' +
              '<dl class="dl"><dt>Capital financiado</dt><dd>' + fmt.money(cr.capital) + '</dd><dt>TNA · plazo</dt><dd>' + fmt.pct(cr.tna) + ' · ' + cr.plazo + ' meses</dd><dt>Cuota</dt><dd>' + fmt.money(cr.cuota) + '</dd><dt>Saldo pendiente</dt><dd>' + fmt.money(s.saldoTotal) + '</dd><dt>Próximo vencimiento</dt><dd>' + (s.prox ? fmt.date(s.prox.vto) : '—') + '</dd>' + (s.vencidas ? '<dt class="err-t">Vencido</dt><dd class="err-t">' + fmt.money(s.montoVencido) + ' (' + s.vencidas + ' cuotas · ' + s.diasMora + ' d)</dd><dt class="err-t">Punitorios</dt><dd class="err-t">' + fmt.money(s.punitorios) + '</dd>' : '') + '</dl>' +
              '<div style="display:flex;gap:8px;flex-wrap:wrap">' + (s.impagas ? '<button class="btn btn--sm btn--ok" data-pay="' + cr.id + '">' + icon('cash') + 'Registrar pago</button>' : '') + (s.vencidas ? '<a class="btn btn--sm btn--wa" target="_blank" rel="noopener" href="' + waLink(waNum(c.tel), 'Hola ' + c.nombre.split(' ')[0] + ', te recordamos que tenés ' + s.vencidas + ' cuota(s) vencida(s) del crédito ' + cr.id + ' por ' + fmt.money(s.montoVencido) + '. Podés regularizar por transferencia o en nuestras oficinas. ¡Gracias!') + '">' + icon('whatsapp') + 'Recordatorio</a><button class="btn btn--sm" data-refi="' + cr.id + '">' + icon('refresh') + 'Refinanciar</button>' : '') + '<a class="btn btn--sm" href="#/cobranzas/' + cr.id + '">' + icon('list') + 'Cronograma</a></div></div>' });
          }).join('') + '</div>' : A.card({ body: A.empty('El cliente no tiene financiaciones', 'card') })) +
          '<div class="grid g2 mt">' + A.card({ title: 'Plan de ahorro', icon: 'piggy', body: f.savings.length ? f.savings.map((s) => '<div style="display:grid;gap:6px;margin-bottom:12px"><div style="display:flex;justify-content:space-between;gap:8px"><b class="strong">' + esc(s.modelo) + '</b>' + A.badge(s.estado, LABELS.planState) + '</div>' + A.prog(s.st.avance, 'acc') + '<span class="small mut">' + s.cuotasPagadas + '/' + s.cuotasTotal + ' cuotas · ' + fmt.money(s.valorCuota) + '/mes · Restan ' + fmt.money(s.st.restante) + (s.st.atrasadas && s.estado !== 'baja' ? ' · <b class="err-t">' + s.st.atrasadas + ' atrasada(s)</b>' : '') + '</span></div>').join('') : A.empty('Sin planes de ahorro', 'piggy') }) +
          A.card({ title: 'Seguros', icon: 'shield', body: f.policies.length ? '<div class="list" style="margin:-16px">' + f.policies.map((p) => '<a href="#/seguros?p=' + p.id + '"><span><b class="strong">' + esc(p.vehiculo) + '</b><br><small class="mut">' + esc(Q.coverage(p.coverage).nombre) + ' · ' + esc(Q.insurer(p.insurerId).nombre) + ' · vence ' + fmt.date(p.vencimiento) + '</small></span><span class="r">' + fmt.money(p.primaMensual) + '<br>' + A.badge(p.st, LABELS.policyState) + '</span></a>').join('') + '</div>' : A.empty('Sin pólizas', 'shield') }) + '</div>';
        $$('[data-pay]', body).forEach((b) => b.addEventListener('click', () => A.payCredit(b.dataset.pay)));
        $$('[data-refi]', body).forEach((b) => b.addEventListener('click', () => A.refinance(b.dataset.refi)));
      },
      cc() {
        body.innerHTML = '<div class="card" id="ccTbl"></div>';
        A.table($('#ccTbl'), { key: 'cc' + id, rows: f.cc.slice().reverse(), noPage: true, cols: [{ k: 'fecha', l: 'Fecha', r: (r) => fmt.date(r.fecha) }, { k: 'concepto', l: 'Concepto', r: (r) => esc(r.concepto) }, { k: 'debe', l: 'Debe', num: true, r: (r) => r.debe ? fmt.money(r.debe) : '' }, { k: 'haber', l: 'Haber', num: true, r: (r) => r.haber ? fmt.money(r.haber) : '' }, { k: 'saldo', l: 'Saldo', num: true, r: (r) => '<b class="' + (r.saldo > 0 ? 'err-t' : '') + '">' + fmt.money(r.saldo) + '</b>' }], empty: 'Sin movimientos' });
        body.insertAdjacentHTML('afterbegin', '<div class="alert alert--info" style="margin-bottom:12px">' + icon('info') + '<span>Saldo deudor actual: <b>' + fmt.money(f.cc.length ? f.cc[f.cc.length - 1].saldo : 0) + '</b>. Incluye cuotas devengadas a la fecha; el saldo de capital futuro se informa en Estado financiero.</span></div>');
      },
      ops() {
        body.innerHTML = '<div class="card" id="opTbl"></div>';
        A.table($('#opTbl'), { key: 'ops' + id, rows: f.sales, sort: { k: 'fecha', d: -1 }, onRow: (s) => A.go('#/ventas/' + s.id), cols: [{ k: 'id', l: 'N°' }, { k: 'fecha', l: 'Fecha', r: (s) => fmt.date(s.fecha) }, { k: 'vehiculo', l: 'Vehículo', r: (s) => '<b class="strong">' + esc(s.vehiculo) + '</b><br><small class="mut">' + esc(s.version) + '</small>' }, { k: 'formaPago', l: 'Pago', r: (s) => LABELS.payment[s.formaPago] }, { k: 'precio', l: 'Precio', num: true, r: (s) => fmt.money(s.precio) }, { k: 'estado', l: 'Estado', r: (s) => A.badge(s.estado, LABELS.saleState) }], empty: 'Sin operaciones' });
      },
      seguros() {
        body.innerHTML = '<div style="display:flex;justify-content:flex-end;margin-bottom:10px"><button class="btn btn--pri btn--sm" id="cfPol">' + icon('plus') + 'Cotizar y emitir póliza</button></div><div class="card" id="poTbl"></div>';
        A.table($('#poTbl'), { key: 'pol' + id, rows: f.policies, onRow: (p) => A.go('#/seguros?p=' + p.id), cols: [{ k: 'numero', l: 'Póliza' }, { k: 'vehiculo', l: 'Vehículo', r: (p) => esc(p.vehiculo) + '<br><small class="mut">' + esc(p.patente) + '</small>' }, { k: 'coverage', l: 'Cobertura', r: (p) => esc(Q.coverage(p.coverage).nombre) + '<br><small class="mut">' + esc(Q.insurer(p.insurerId).nombre) + '</small>' }, { k: 'primaMensual', l: 'Prima', num: true, r: (p) => fmt.money(p.primaMensual) }, { k: 'vencimiento', l: 'Vence', r: (p) => fmt.date(p.vencimiento) }, { k: 'st', l: 'Estado', r: (p) => A.badge(p.st, LABELS.policyState) }], empty: 'Sin pólizas' });
        $('#cfPol').addEventListener('click', () => A.quoteModal({ clientId: id }));
      },
      plan() {
        body.innerHTML = '<div class="card" id="plTbl"></div>';
        A.table($('#plTbl'), { key: 'pl' + id, rows: f.savings, cols: [{ k: 'modelo', l: 'Modelo', r: (s) => '<b class="strong">' + esc(s.modelo) + '</b><br><small class="mut">' + esc(s.plan) + '</small>' }, { k: 'grupo', l: 'Grupo/Orden', r: (s) => s.grupo + ' / ' + s.orden }, { k: 'cuotasPagadas', l: 'Avance', r: (s) => s.cuotasPagadas + '/' + s.cuotasTotal + A.prog(s.st.avance, 'acc') }, { k: 'valorCuota', l: 'Cuota', num: true, r: (s) => fmt.money(s.valorCuota) }, { k: 'estado', l: 'Estado', r: (s) => A.badge(s.estado, LABELS.planState) + (s.st.atrasadas && s.estado !== 'baja' ? ' <span class="bd bd--err">' + s.st.atrasadas + ' atrasada(s)</span>' : '') }], empty: 'Sin planes de ahorro' });
      },
      taller() {
        body.innerHTML = '<div class="grid g2"><div class="card" id="apTbl"></div><div class="card" id="woTbl"></div></div>';
        A.table($('#apTbl'), { key: 'ap' + id, rows: appts, sort: { k: 'fecha', d: -1 }, cols: [{ k: 'fecha', l: 'Turno', r: (a) => fmt.dateTime(a.fecha) }, { k: 'tipo', l: 'Tipo', r: (a) => LABELS.apptType[a.tipo] }, { k: 'estado', l: 'Estado', r: (a) => A.badge(a.estado, LABELS.apptState) }], empty: 'Sin turnos' });
        A.table($('#woTbl'), { key: 'wo' + id, rows: wos, onRow: (w) => A.woModal(w.id), cols: [{ k: 'id', l: 'OT' }, { k: 'vehiculo', l: 'Vehículo', r: (w) => esc(w.vehiculo) + '<br><small class="mut">' + esc(w.items[0].desc) + '</small>' }, { k: 'estado', l: 'Estado', r: (w) => A.badge(w.estado, LABELS.woState) }], empty: 'Sin órdenes de taller' });
      },
      datos() {
        body.innerHTML = A.card({ title: 'Datos personales', icon: 'user', acts: '<button class="btn btn--sm btn--pri" id="cfEdit2">' + icon('edit') + 'Editar</button>', body: '<dl class="dl" style="max-width:640px">' + [['Nombre', c.nombre], ['DNI', c.dni], ['CUIT/CUIL', c.cuit], ['Nacimiento', fmt.date(c.nacimiento)], ['Teléfono', c.tel], ['Email', c.email], ['Dirección', c.direccion], ['Localidad', c.ciudad + ', ' + c.provincia], ['Ocupación', c.ocupacion], ['Empleador', c.empleador], ['Ingresos', fmt.money(c.ingresos)], ['Score', c.score], ['BCRA', c.bcra], ['Asesor', Q.userName(c.vendedorId)]].map(([k, val]) => '<dt>' + k + '</dt><dd>' + esc(val == null ? '—' : val) + '</dd>').join('') + '</dl>' });
        $('#cfEdit2').addEventListener('click', () => A.clientForm(c));
      }
    };
    (T[tab] || T.resumen)();
    $('#cfTabs').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) history.replaceState(null, '', '#/clientes/' + id + '?tab=' + b.dataset.t), A.refresh(); });
    $('#cfEdit').addEventListener('click', () => A.clientForm(c));
    $('#cfPrint').addEventListener('click', () => A.printStatement(id));
    const pb = $('#cfPay'); if (pb) pb.addEventListener('click', () => { const cr = f.credits.find((x) => x.st.vencidas) || f.credits.find((x) => x.st.impagas); A.payCredit(cr.id); });
  }

  A.printStatement = (id) => {
    const c = DB.get('clients', id), f = Q.clientFinance(id);
    A.print('Estado de cuenta', '<div class="box grid"><div><b>Cliente:</b> ' + esc(c.nombre) + '</div><div><b>DNI:</b> ' + esc(c.dni) + '</div><div><b>Domicilio:</b> ' + esc(c.direccion + ', ' + c.ciudad) + '</div><div><b>Teléfono:</b> ' + esc(c.tel) + '</div></div>' +
      '<h2>Resumen</h2><table><tr><td>Saldo financiado</td><td class="num">' + fmt.money(f.deuda) + '</td></tr><tr><td>Deuda vencida</td><td class="num">' + fmt.money(f.vencido) + '</td></tr><tr><td>Intereses punitorios</td><td class="num">' + fmt.money(f.punitorios) + '</td></tr><tr><td class="tot">Total a regularizar hoy</td><td class="num tot">' + fmt.money(f.vencido + f.punitorios) + '</td></tr></table>' +
      f.credits.map((cr) => '<h2>Crédito ' + cr.id + ' — ' + cr.plazo + ' cuotas de ' + fmt.money(cr.cuota) + ' (TNA ' + fmt.pct(cr.tna) + ')</h2><table><tr><th>Cuota</th><th>Vencimiento</th><th class="num">Capital</th><th class="num">Interés</th><th class="num">Total</th><th>Estado</th></tr>' + cr.cuotas.map((q) => '<tr><td>' + q.n + '</td><td>' + fmt.date(q.vto) + '</td><td class="num">' + fmt.money(q.capital) + '</td><td class="num">' + fmt.money(q.interes) + '</td><td class="num">' + fmt.money(q.monto) + '</td><td>' + (q.pagada ? 'Pagada ' + fmt.date(q.fechaPago) : parse(q.vto) < today() ? '<b>VENCIDA</b>' : 'Pendiente') + '</td></tr>').join('') + '</table>').join('') +
      (f.policies.length ? '<h2>Seguros</h2><table><tr><th>Póliza</th><th>Vehículo</th><th>Cobertura</th><th>Vence</th><th class="num">Prima</th></tr>' + f.policies.map((p) => '<tr><td>' + p.numero + '</td><td>' + esc(p.vehiculo) + '</td><td>' + esc(Q.coverage(p.coverage).nombre) + '</td><td>' + fmt.date(p.vencimiento) + '</td><td class="num">' + fmt.money(p.primaMensual) + '</td></tr>').join('') + '</table>' : ''));
  };

  /* ================================================================ AGENDA */
  const ag = { week: 0, tipo: '', who: '' };
  A.reg('agenda', (v) => {
    A.setTitle('Agenda');
    const qp = A.query();
    const t = today(), dow = (t.getDay() + 6) % 7, start = addDays(t, -dow + ag.week * 7);
    const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
    const list = DB.data.appts.filter((a) => (!ag.tipo || a.tipo === ag.tipo) && (!ag.who || a.asignado === ag.who));
    const todays = DB.data.appts.filter((a) => a.fecha.slice(0, 10) === iso(t) && a.estado !== 'cancelado');
    const weekList = list.filter((a) => a.fecha.slice(0, 10) >= iso(days[0]) && a.fecha.slice(0, 10) <= iso(days[6]));
    v.innerHTML = A.ph('Agenda', 'Test drives, entregas, turnos de taller y tasaciones', '<button class="btn btn--pri" id="agNew">' + icon('plus') + 'Nuevo turno</button>') +
      '<div class="kpis">' + A.kpi({ label: 'Citas de hoy', icon: 'calendar', value: todays.length }) + A.kpi({ label: 'Test drives semana', icon: 'key', value: weekList.filter((a) => a.tipo === 'test_drive').length }) + A.kpi({ label: 'Entregas semana', icon: 'car', value: weekList.filter((a) => a.tipo === 'entrega').length }) + A.kpi({ label: 'Pendientes de confirmar', icon: 'clock', value: list.filter((a) => a.estado === 'pendiente' && a.fecha >= iso(t)).length }) + '</div>' +
      '<div class="filters"><div class="seg"><button id="agPrev" aria-label="Semana anterior"><span style="transform:rotate(180deg);display:grid">' + icon('chevron') + '</span></button><button id="agToday"' + (ag.week === 0 ? ' class="on"' : '') + '>Esta semana</button><button id="agNext" aria-label="Semana siguiente">' + icon('chevron') + '</button></div><b class="strong" style="margin:0 8px">' + fmt.dateShort(iso(days[0])) + ' – ' + fmt.dateShort(iso(days[6])) + ' ' + days[6].getFullYear() + '</b>' +
      '<select class="inp" id="agTipo" style="margin-left:auto">' + A.opts(Object.entries(LABELS.apptType), ag.tipo, 'Todos los tipos') + '</select><select class="inp" id="agWho">' + A.opts(DB.data.team.map((u) => [u.id, u.nombre]), ag.who, 'Todo el equipo') + '</select></div>' +
      '<div class="legend" style="margin-bottom:10px">' + Object.entries(LABELS.apptType).map(([k, l]) => '<span><i style="background:' + ({ test_drive: '#2a78d6', service: '#6250d6', entrega: '#1baf7a', tasacion: '#eb6834', reunion: '#9aa0a9' })[k] + '"></i>' + l + '</span>').join('') + '</div>' +
      '<div class="week">' + days.map((dd) => { const k = iso(dd), ev = list.filter((a) => a.fecha.slice(0, 10) === k).sort((a, b) => a.fecha.localeCompare(b.fecha)); return '<div class="day' + (k === iso(t) ? ' today' : '') + '"><div class="day__h"><b>' + dd.getDate() + '</b><span>' + fmt.dateLong(k).split(' ')[0] + ' · ' + ev.length + ' citas</span></div><div class="day__b">' + ev.map((a) => '<button class="ev ev--' + a.tipo + ' ' + a.estado + '" data-id="' + a.id + '"><b>' + fmt.time(a.fecha) + ' · ' + LABELS.apptType[a.tipo] + '</b><span>' + esc(a.nombre) + '</span><span>' + esc(a.vehiculo) + '</span></button>').join('') + '</div></div>'; }).join('') + '</div>';
    $('#agPrev').addEventListener('click', () => { ag.week--; A.refresh(); });
    $('#agNext').addEventListener('click', () => { ag.week++; A.refresh(); });
    $('#agToday').addEventListener('click', () => { ag.week = 0; A.refresh(); });
    $('#agTipo').addEventListener('change', (e) => { ag.tipo = e.target.value; A.refresh(); });
    $('#agWho').addEventListener('change', (e) => { ag.who = e.target.value; A.refresh(); });
    $('#agNew').addEventListener('click', () => A.apptForm());
    $('.week', v).addEventListener('click', (e) => { const b = e.target.closest('.ev'); if (b) A.apptForm(DB.get('appts', b.dataset.id)); });
    if (qp.id) { const a = DB.get('appts', qp.id); if (a) { history.replaceState(null, '', '#/agenda'); A.apptForm(a); } }
  });
  A.apptForm = (a) => {
    const isNew = !a || !a.id;
    const def = new Date(); def.setDate(def.getDate() + 1); def.setHours(10, 0, 0, 0);
    a = { tipo: 'test_drive', fecha: isoDT(def), duracion: 45, estado: 'pendiente', asignado: me().id, ...(a || {}) };
    const lead = a.leadId ? DB.get('leads', a.leadId) : null;
    A.formModal({
      title: isNew ? 'Nuevo turno' : LABELS.apptType[a.tipo] + ' · ' + a.nombre, sub: !isNew && (a.clientId || lead) ? (a.clientId ? '<a href="#/clientes/' + a.clientId + '">Ver ficha del cliente</a>' : '<a href="#/crm/' + lead.id + '">Ver lead</a>') : '', values: { ...a, fecha: a.fecha.slice(0, 16) },
      fields: [{ n: 'tipo', l: 'Tipo', t: 'select', o: Object.entries(LABELS.apptType) }, { n: 'fecha', l: 'Fecha y hora', t: 'dt', req: true }, { n: 'clientId', l: 'Cliente', t: 'select', o: DB.data.clients.slice().sort((x, y) => x.nombre.localeCompare(y.nombre)).map((c) => [c.id, c.nombre + ' · DNI ' + c.dni]), empty: '— No es cliente / lead —' },
        { n: 'nombre', l: 'Nombre de contacto', req: true }, { n: 'tel', l: 'Teléfono', t: 'tel' }, { n: 'vehiculo', l: 'Vehículo' }, { n: 'asignado', l: 'Responsable', t: 'select', o: DB.data.team.map((u) => [u.id, u.nombre]) },
        { n: 'duracion', l: 'Duración (min)', t: 'number', min: 15, step: 15 }, { n: 'estado', l: 'Estado', t: 'select', o: Object.entries(LABELS.apptState) }, { n: 'notas', l: 'Notas', t: 'textarea' }],
      foot: [].concat(isNew ? [] : [{ label: 'Eliminar', cls: 'btn--danger', icon: 'trash', act: async (b, close) => { if (await A.confirm('Eliminar turno', '¿Eliminar este turno de la agenda?', 'Eliminar', true)) { DB.remove('appts', a.id); close(); A.toast('Turno eliminado'); A.refresh(); } } }],
        a.tel ? [{ label: 'Confirmar por WhatsApp', cls: 'btn--wa', icon: 'whatsapp', act: () => window.open(waLink(waNum(a.tel), 'Hola ' + (a.nombre || '').split(' ')[0] + ', te confirmamos tu ' + LABELS.apptType[a.tipo].toLowerCase() + ' el ' + fmt.dateLong(a.fecha.slice(0, 10)) + ' a las ' + fmt.time(a.fecha) + ' h en ' + DB.data.config.address + '.'), '_blank', 'noopener') }] : [],
        [{ label: 'Cancelar', act: 'close' }, { label: isNew ? 'Agendar' : 'Guardar', cls: 'btn--pri', act: 'ok' }]),
      onOpen: (box) => { const sel = $('[name=clientId]', box); sel.addEventListener('change', () => { const c = DB.get('clients', sel.value); if (c) { $('[name=nombre]', box).value = c.nombre; $('[name=tel]', box).value = c.tel; } }); },
      onOk: (b, f) => {
        f.fecha = f.fecha.length === 16 ? f.fecha + ':00' : f.fecha;
        if (isNew) { DB.insert('appts', { ...f, leadId: a.leadId || '' }); if (lead) { A.addActivity(lead, f.tipo === 'test_drive' ? 'test_drive' : 'nota', LABELS.apptType[f.tipo] + ' agendado para el ' + fmt.dateTime(f.fecha) + '.'); if (f.tipo === 'test_drive' && ['nuevo', 'contactado'].includes(lead.etapa)) lead.etapa = 'test_drive'; DB.save(); } A.toast('Turno agendado para el ' + fmt.dateTime(f.fecha), ['#/agenda', 'Ver agenda']); }
        else { DB.update('appts', a.id, f); A.toast('Turno actualizado'); }
        A.refresh();
      }
    });
  };
})();
