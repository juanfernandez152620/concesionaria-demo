/* =========================================================================
   Rumbo Automotores — sitio público (mobile-first, minimalista)
   ========================================================================= */
(function () {
  'use strict';
  const { DB, Q, Fin, fmt, esc, icon, CONFIG, LABELS, BRANDS, today, iso, isoDT, addDays, waLink } = RB;
  DB.load();
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const cfg = () => DB.data.config || CONFIG;
  const LOGO = '<svg viewBox="0 0 48 48" aria-hidden="true"><rect width="48" height="48" rx="13" fill="#111317"/><path d="M14 36L22 12h4l8 24" fill="none" stroke="#c8922f" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M24 17v4M24 25v4M24 33v3" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/></svg>';
  const brandHTML = () => '<a class="brand" href="home.html" aria-label="' + esc(cfg().name) + ' — inicio">' + LOGO + '<span><b>RUMBO</b><small>AUTOMOTORES</small></span></a>';
  const HEX = { 'Blanco': '#f5f5f5', 'Gris plata': '#c0c4c8', 'Negro': '#111', 'Gris oscuro': '#4a4f55', 'Rojo': '#a8202a', 'Azul': '#1f3f7a' };
  const hexOf = (v, c) => (v.colorHex && v.colorHex[c]) || HEX[c] || '#bbb';
  const params = () => Object.fromEntries(new URLSearchParams(location.search).entries());
  const formData = (f) => Object.fromEntries(new FormData(f).entries());
  const vLabel = (v) => Q.vName(v) + ' ' + v.version + (v.cond === 'usado' ? ' · ' + v.year : '');
  const vehicleOptions = (sel, filter) => Q.published().filter(filter || (() => true)).sort((a, b) => Q.vName(a).localeCompare(Q.vName(b))).map((v) => '<option value="' + v.id + '"' + (v.id === sel ? ' selected' : '') + '>' + esc(vLabel(v)) + (v.cond === 'usado' ? ' (usado)' : '') + '</option>').join('');
  const waMsg = (v) => waLink(cfg().whatsapp, v ? 'Hola! Me interesa el ' + Q.vFull(v) + (v.cond === 'usado' ? ' ' + v.year : '') + ' (' + v.id + ').' : 'Hola! Quiero hacer una consulta.');

  /* ---------------------------------------------------------- utilidades */
  const store = { get(k, d) { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* noop */ } } };
  const favs = () => store.get('rumbo_favs', []);
  function toggleFav(id) { const f = favs(); const i = f.indexOf(id); i >= 0 ? f.splice(i, 1) : f.push(id); store.set('rumbo_favs', f); updateFavCount(); return i < 0; }
  function updateFavCount() { const n = favs().length; $$('.js-favcount').forEach((el) => { el.textContent = n; el.hidden = !n; }); }
  function toast(msg) {
    let t = $('.toast'); if (!t) { t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.innerHTML = icon('check') + '<span>' + esc(msg) + '</span>'; t.classList.add('on'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('on'), 2800);
  }
  const lockScroll = (on) => { document.documentElement.style.overflow = on ? 'hidden' : ''; };

  /* hoja inferior (mobile) / modal (escritorio) */
  function sheet(title, sub, body, wide) {
    let s = $('#sheet');
    if (!s) {
      s = document.createElement('div'); s.id = 'sheet'; s.className = 'sheet'; s.setAttribute('role', 'dialog'); s.setAttribute('aria-modal', 'true'); document.body.appendChild(s);
      s.addEventListener('click', (e) => { if (e.target === s || e.target.closest('.sheet__x')) closeSheet(); });
    }
    s.innerHTML = '<div class="sheet__box' + (wide ? ' sheet__box--wide' : '') + '"><div class="sheet__grab"></div><div class="sheet__h"><div><h3>' + esc(title) + '</h3>' + (sub ? '<p>' + sub + '</p>' : '') + '</div><button class="sheet__x" aria-label="Cerrar">' + icon('x') + '</button></div><div class="sheet__b">' + body + '</div></div>';
    requestAnimationFrame(() => s.classList.add('on')); lockScroll(true);
    return $('.sheet__b', s);
  }
  function closeSheet() { const s = $('#sheet'); if (s) s.classList.remove('on'); if (!$('.lb.on') && !$('.menu.on')) lockScroll(false); }
  const doneHTML = (title, text) => '<div class="done"><div class="ok">' + icon('check') + '</div><h3>' + esc(title) + '</h3><p>' + esc(text) + '</p><button class="btn btn--line btn--block" style="margin-top:8px" onclick="document.querySelector(\'.sheet__x\').click()">Listo</button></div>';
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { if ($('.lb.on')) return; closeSheet(); closeMenu(); } });

  /* ------------------------------------------------------ alta de leads */
  function autoAssign() {
    const sellers = DB.data.team.filter((u) => /asesor/i.test(u.rol));
    const open = (id) => DB.data.leads.filter((l) => l.vendedorId === id && !['ganado', 'perdido'].includes(l.etapa)).length;
    return sellers.sort((a, b) => open(a.id) - open(b.id))[0].id;
  }
  function createLead(d) {
    const v = d.vehicleId ? DB.get('vehicles', d.vehicleId) : null;
    const now = isoDT(new Date()), seller = autoAssign();
    const lead = DB.insert('leads', {
      nombre: d.nombre, tel: d.tel, email: d.email || '', ciudad: d.ciudad || '', vehicleId: v ? v.id : '', interes: d.interes || (v ? Q.vName(v) : 'Consulta general'),
      origen: 'Web', etapa: 'nuevo', vendedorId: seller, creado: now, actualizado: now, mensaje: d.mensaje || '', formaPago: d.formaPago || 'financiado',
      presupuesto: v ? v.price : 0, temperatura: 'tibio', motivoPerdida: '', clientId: '', leido: false,
      actividades: [{ fecha: now, tipo: 'nota', texto: 'Lead ingresado desde ' + (d.canal || 'el sitio web') + '. Asignado automáticamente a ' + Q.userName(seller) + '.', user: 'sistema' }]
    });
    DB.notify('Nuevo lead web: ' + d.nombre + ' — ' + lead.interes, 'lead', '#/crm/' + lead.id); DB.save();
    return lead;
  }
  function leadForm(o) {
    o = o || {};
    return '<form class="form js-lead">' + (o.vehicleId ? '<input type="hidden" name="vehicleId" value="' + esc(o.vehicleId) + '">' : (o.pick ? '<label class="field">Vehículo<select name="vehicleId"><option value="">Quiero asesoramiento</option>' + vehicleOptions('') + '</select></label>' : '')) +
      (o.interes ? '<input type="hidden" name="interes" value="' + esc(o.interes) + '">' : '') + '<input type="hidden" name="formaPago" value="' + esc(o.formaPago || 'financiado') + '">' +
      '<label class="field">Nombre y apellido<input name="nombre" required autocomplete="name"></label>' +
      '<label class="field">Teléfono / WhatsApp<input name="tel" required type="tel" inputmode="tel" autocomplete="tel" placeholder="11 5555-5555"></label>' +
      '<label class="field">Mensaje (opcional)<textarea name="mensaje" rows="3">' + esc(o.mensaje || '') + '</textarea></label>' +
      '<button class="btn btn--block">' + esc(o.cta || 'Enviar') + '</button><p class="legal">Te respondemos en menos de 2 horas hábiles.</p></form>';
  }
  function openLead(o) {
    o = o || {};
    const v = o.vehicleId ? DB.get('vehicles', o.vehicleId) : null;
    const b = sheet(o.title || (v ? 'Cotizá tu ' + Q.vName(v) : 'Dejanos tu consulta'), o.sub || 'Un asesor te contacta con precio final, stock y financiación.', leadForm({ pick: !v && o.pick !== false, ...o }));
    const f = $('input[name=nombre]', b); if (f && matchMedia('(min-width: 640px)').matches) setTimeout(() => f.focus(), 60);
  }
  document.addEventListener('submit', (e) => {
    const f = e.target; if (!f.classList.contains('js-lead')) return;
    e.preventDefault();
    const d = formData(f), lead = createLead({ ...d, canal: 'el sitio web' });
    f.outerHTML = doneHTML('¡Gracias, ' + d.nombre.split(' ')[0] + '!', 'Recibimos tu consulta. ' + Q.userName(lead.vendedorId) + ' te va a contactar a la brevedad.');
  });
  function contactSheet(v) {
    const c = cfg();
    const b = sheet(v ? 'Consultá por este ' + v.model : '¿Cómo querés contactarnos?', v ? esc(vLabel(v)) : 'Elegí la opción que te quede más cómoda.',
      '<div class="opts"><a class="opt" target="_blank" rel="noopener" href="' + waMsg(v) + '"><span class="ic" style="color:#1fa855">' + icon('whatsapp') + '</span><span><b>WhatsApp</b><span>Respuesta inmediata en horario comercial</span></span>' + icon('chevron') + '</a>' +
      '<button class="opt" data-o="form"><span class="ic">' + icon('mail') + '</span><span><b>Dejanos tus datos</b><span>Te llamamos con el precio final</span></span>' + icon('chevron') + '</button>' +
      (v ? '<button class="opt" data-o="td"><span class="ic">' + icon('key') + '</span><span><b>Agendar test drive</b><span>Elegí día y horario</span></span>' + icon('chevron') + '</button>' : '') +
      '<a class="opt" href="tel:' + esc(c.phoneHref) + '"><span class="ic">' + icon('phone') + '</span><span><b>Llamar</b><span>' + esc(c.phone) + '</span></span>' + icon('chevron') + '</a></div>');
    b.addEventListener('click', (e) => { const o = e.target.closest('[data-o]'); if (!o) return; if (o.dataset.o === 'form') openLead({ vehicleId: v ? v.id : '' }); else openTestDrive(v.id); });
  }
  function openTestDrive(vehicleId) {
    const v = DB.get('vehicles', vehicleId), min = iso(addDays(today(), 1));
    const b = sheet('Agendá tu test drive', esc(vLabel(v)),
      '<form class="form" id="tdF"><label class="field">Nombre y apellido<input name="nombre" required autocomplete="name"></label><label class="field">Teléfono<input name="tel" required type="tel" autocomplete="tel"></label>' +
      '<div class="form__row"><label class="field">Día<input name="fecha" type="date" required min="' + min + '" value="' + min + '"></label><label class="field">Horario<select name="hora">' + ['09:30', '10:30', '11:30', '12:30', '15:00', '16:00', '17:00', '18:00'].map((h) => '<option>' + h + '</option>').join('') + '</select></label></div>' +
      '<label class="check"><input type="checkbox" required checked> Tengo registro de conducir vigente</label><button class="btn btn--block">Confirmar</button></form>');
    $('#tdF', b).addEventListener('submit', (e) => {
      e.preventDefault(); const d = formData(e.target);
      const lead = createLead({ nombre: d.nombre, tel: d.tel, vehicleId, mensaje: 'Solicitó test drive para el ' + fmt.date(d.fecha) + ' a las ' + d.hora + ' h.', canal: 'la agenda de test drive' });
      DB.update('leads', lead.id, { etapa: 'test_drive', temperatura: 'caliente' });
      DB.insert('appts', { fecha: d.fecha + 'T' + d.hora + ':00', duracion: 45, tipo: 'test_drive', clientId: '', leadId: lead.id, nombre: d.nombre, tel: d.tel, vehiculo: Q.vName(v), asignado: lead.vendedorId, estado: 'pendiente', notas: 'Reservado desde la web' });
      DB.notify('Test drive web: ' + d.nombre + ' — ' + Q.vName(v) + ' (' + fmt.date(d.fecha) + ' ' + d.hora + ')', 'agenda', '#/agenda'); DB.save();
      e.target.outerHTML = doneHTML('¡Test drive reservado!', fmt.dateLong(d.fecha) + ' a las ' + d.hora + ' h. Te confirmamos por WhatsApp.');
    });
  }

  /* --------------------------------------------------------------- layout */
  let closeMenu = () => {};
  function layout(active, opts) {
    opts = opts || {};
    const c = cfg();
    const nav = [['0km', 'catalogo.html?cond=0km', '0km'], ['usados', 'catalogo.html?cond=usado', 'Usados'], ['fin', 'home.html#servicios', 'Financiación'], ['seguros', 'home.html#servicios', 'Seguros'], ['contacto', 'home.html#contacto', 'Contacto']];
    $('#site-header').outerHTML = '<header class="top"><div class="wrap top__in">' + brandHTML() +
      '<nav class="nav" aria-label="Principal">' + nav.map(([k, h, l]) => '<a href="' + h + '"' + (k === active ? ' class="on" aria-current="page"' : '') + '>' + l + '</a>').join('') + '</nav>' +
      '<a class="ibtn" href="catalogo.html" aria-label="Buscar vehículos">' + icon('search') + '</a>' +
      '<a class="ibtn" href="catalogo.html?favs=1" aria-label="Favoritos">' + icon('heart') + '<span class="count js-favcount" hidden>0</span></a>' +
      '<a class="ibtn top__cta" href="mi-cuenta.html" aria-label="Mi cuenta">' + icon('user') + '</a>' +
      '<button class="btn btn--sm top__cta js-cotizar">Cotizar</button>' +
      '<button class="ibtn burger" aria-label="Abrir menú" aria-controls="menu">' + icon('menu') + '</button></div></header>' +
      '<div class="menu" id="menu" role="dialog" aria-modal="true" aria-label="Menú"><div class="menu__h">' + brandHTML() + '<button class="ibtn" id="menuX" aria-label="Cerrar menú">' + icon('x') + '</button></div><div class="menu__b">' +
      [['catalogo.html?cond=0km', '0km'], ['catalogo.html?cond=usado', 'Usados'], ['catalogo.html?favs=1', 'Mis favoritos'], ['home.html#servicios', 'Financiación y plan de ahorro'], ['home.html#servicios', 'Seguros'], ['home.html#servicios', 'Taller y servicio'], ['home.html#contacto', 'Contacto']].map(([h, l]) => '<a href="' + h + '">' + l + icon('chevron') + '</a>').join('') +
      '<small>Tu cuenta</small><a href="mi-cuenta.html">Estado de cuotas y pólizas' + icon('chevron') + '</a><a href="admin.html">Acceso concesionaria' + icon('chevron') + '</a><a href="index.html" target="_top">Inicio de la demo' + icon('chevron') + '</a></div>' +
      '<div class="menu__f"><a class="btn btn--line" href="tel:' + esc(c.phoneHref) + '">' + icon('phone') + 'Llamar</a><a class="btn btn--wa" target="_blank" rel="noopener" href="' + waMsg() + '">' + icon('whatsapp') + 'WhatsApp</a></div></div>';
    $('#site-footer').outerHTML = '<footer class="foot"><div class="wrap"><div class="foot__grid"><div>' + brandHTML() + '<p>Concesionario multimarca: 0km, usados seleccionados, planes de ahorro, financiación, seguros y taller.</p><p>' + esc(c.address) + '<br>' + esc(c.phone) + ' · ' + esc(c.email) + '</p></div>' +
      '<div><h4>Vehículos</h4><ul><li><a href="catalogo.html?cond=0km">0km</a></li><li><a href="catalogo.html?cond=usado">Usados</a></li><li><a href="catalogo.html?body=suv">SUV</a></li><li><a href="catalogo.html?body=pickup">Pick-ups</a></li></ul></div>' +
      '<div><h4>Servicios</h4><ul><li><a href="home.html#servicios">Financiación</a></li><li><a href="home.html#servicios">Plan de ahorro</a></li><li><a href="home.html#servicios">Seguros</a></li><li><a href="home.html#servicios">Taller</a></li></ul></div>' +
      '<div><h4>Cuenta</h4><ul><li><a href="mi-cuenta.html">Mis cuotas</a></li><li><a href="admin.html">Acceso concesionaria</a></li><li><a href="index.html" target="_top">Inicio de la demo</a></li></ul></div></div>' +
      '<div class="foot__legal">Precios sugeridos en pesos, sujetos a modificación. No incluyen flete, patentamiento ni gastos de entrega. Financiación sujeta a aprobación crediticia. Planes de ahorro según contrato de adhesión. Imágenes ilustrativas. © ' + today().getFullYear() + ' ' + esc(c.name) + ' · Sitio de demostración.</div></div></footer>' +
      (opts.noFab ? '' : '<a class="wafab" target="_blank" rel="noopener" href="' + waMsg() + '" aria-label="Escribinos por WhatsApp">' + icon('whatsapp') + '</a>');
    const menu = $('#menu');
    const openMenu = () => { menu.classList.add('on'); lockScroll(true); };
    closeMenu = () => { menu.classList.remove('on'); if (!$('.sheet.on')) lockScroll(false); };
    $('.burger').addEventListener('click', openMenu); $('#menuX').addEventListener('click', closeMenu);
    menu.addEventListener('click', (e) => { if (e.target.closest('a')) closeMenu(); });
    const top = $('.top'); const onScroll = () => top.classList.toggle('scrolled', window.scrollY > 4); window.addEventListener('scroll', onScroll, { passive: true }); onScroll();
    document.addEventListener('click', (e) => {
      const b = e.target.closest('.js-cotizar'); if (b) { e.preventDefault(); openLead({ vehicleId: b.dataset.v || '', formaPago: b.dataset.pago, interes: b.dataset.interes, mensaje: b.dataset.msg, title: b.dataset.title }); }
      const ct = e.target.closest('.js-contact'); if (ct) { e.preventDefault(); contactSheet(ct.dataset.v ? DB.get('vehicles', ct.dataset.v) : null); }
      const fv = e.target.closest('.fav'); if (fv) { e.preventDefault(); e.stopPropagation(); const on = toggleFav(fv.dataset.v); fv.classList.toggle('on', on); fv.setAttribute('aria-pressed', on); toast(on ? 'Guardado en favoritos' : 'Quitado de favoritos'); }
      const ar = e.target.closest('.vc__arr'); if (ar) { e.preventDefault(); const tr = $('.vc__track', ar.closest('.vc__media')); tr.scrollBy({ left: (ar.classList.contains('vc__arr--n') ? 1 : -1) * tr.clientWidth, behavior: 'smooth' }); }
      const tool = e.target.closest('[data-tool]'); if (tool) { e.preventDefault(); TOOLS[tool.dataset.tool](); }
    });
    // puntos de los carruseles de tarjetas
    document.addEventListener('scroll', (e) => {
      const tr = e.target; if (!tr.classList || !tr.classList.contains('vc__track')) return;
      const i = Math.round(tr.scrollLeft / tr.clientWidth); $$('.vc__dots i', tr.parentNode).forEach((d, k) => d.classList.toggle('on', k === i));
    }, true);
    updateFavCount();
  }

  /* ------------------------------------------------------- tarjeta auto */
  function card(v, opts) {
    opts = opts || {};
    const ph = Q.photos(v), show = ph.slice(0, 5), isFav = favs().includes(v.id), url = 'vehiculo.html?id=' + v.id;
    const tag = v.cond === 'usado' ? 'Usado ' + v.year : v.tags[0] && /tasa|nuevo|eléctrico|híbrido/i.test(v.tags[0]) ? v.tags[0] : '0km';
    const meta = v.cond === '0km' ? (v.cuotaDesde ? 'Plan desde <b>' + fmt.moneyShort(v.cuotaDesde) + '</b>/mes' : '') : fmt.km(v.km) + ' · ' + esc(v.trans);
    return '<article class="vc"><div class="vc__media"><div class="vc__track">' + show.map((p, i) => '<a href="' + url + '" tabindex="' + (i ? -1 : 0) + '" aria-label="' + esc(Q.vFull(v)) + (i ? ' — foto ' + (i + 1) : '') + '"><img src="' + esc(p.t) + '" alt="' + (i ? '' : esc(Q.vFull(v))) + '" loading="lazy" width="480" height="360"></a>').join('') + '</div>' +
      '<span class="vc__tag' + (v.cond === '0km' && tag === '0km' ? '' : ' vc__tag--dark') + '">' + esc(tag) + '</span>' +
      '<button class="fav' + (isFav ? ' on' : '') + '" data-v="' + v.id + '" aria-pressed="' + isFav + '" aria-label="Guardar en favoritos">' + icon('heart') + '</button>' +
      (ph.length > 1 ? '<span class="vc__count">' + icon('camera') + ph.length + ' fotos</span><span class="vc__dots">' + show.map((_, i) => '<i' + (i ? '' : ' class="on"') + '></i>').join('') + '</span><button class="vc__arr vc__arr--p" aria-label="Foto anterior" tabindex="-1">' + icon('chevron') + '</button><button class="vc__arr vc__arr--n" aria-label="Foto siguiente" tabindex="-1">' + icon('chevron') + '</button>' : '') + '</div>' +
      '<div class="vc__b"><h3><a href="' + url + '">' + esc(Q.vName(v)) + '</a></h3><p class="vc__sub">' + esc(v.version) + ' · ' + v.year + '</p>' +
      '<div class="vc__t" style="margin-top:6px"><span class="vc__price">' + fmt.money(v.price) + '</span><span class="vc__meta">' + meta + '</span></div>' +
      (opts.compare ? '<label class="vc__cmp"><input type="checkbox" class="js-cmp" value="' + v.id + '"' + (opts.compared ? ' checked' : '') + '> Comparar</label>' : '') + '</div></article>';
  }

  /* ------------------------------------------------------- herramientas */
  function simulator(root, fixed) {
    const c = cfg();
    root.innerHTML = '<div class="sim">' + (fixed ? '' : '<label class="field">Vehículo<select id="sV">' + vehicleOptions((Q.published().find((v) => v.promoTasa0) || {}).id) + '</select></label>') +
      '<div><div class="sim__l"><span>Anticipo</span><output id="sAO"></output></div><input type="range" id="sA" min="20" max="80" step="5" value="40" aria-label="Anticipo"></div>' +
      '<div><div class="sim__l"><span>Plazo</span></div><div class="seg seg--full" id="sP">' + [12, 24, 36, 48, 60].map((p) => '<button type="button" data-p="' + p + '"' + (p === 24 ? ' class="on"' : '') + '>' + p + 'm</button>').join('') + '</div></div>' +
      '<div class="sim__res" aria-live="polite"><div class="big"><span>Cuota estimada</span><b id="sC"></b></div><dl class="dl" id="sD"></dl></div>' +
      '<button class="btn btn--block" id="sGo">Solicitar pre-aprobación</button><p class="note">Simulación orientativa (sistema francés). Sujeta a aprobación crediticia.</p></div>';
    let plazo = 24;
    const calc = () => {
      const v = fixed || DB.get('vehicles', $('#sV', root).value), ant = +$('#sA', root).value;
      const cap = v.price * (100 - ant) / 100, tna = v.promoTasa0 && plazo <= 12 ? c.tnaPromo : c.tna, cuota = Fin.cuota(cap, tna, plazo);
      $('#sAO', root).textContent = ant + '% · ' + fmt.money(v.price * ant / 100);
      $('#sC', root).textContent = fmt.money(cuota);
      $('#sD', root).innerHTML = '<dt>Precio</dt><dd>' + fmt.money(v.price) + '</dd><dt>A financiar</dt><dd>' + fmt.money(cap) + '</dd><dt>TNA</dt><dd>' + fmt.pct(tna) + '</dd>';
      root.dataset.v = v.id; root.dataset.msg = 'Simulación: ' + Q.vName(v) + ', anticipo ' + ant + '%, ' + plazo + ' cuotas de ' + fmt.money(cuota) + '.';
    };
    $('#sP', root).addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; plazo = +b.dataset.p; $$('#sP button', root).forEach((x) => x.classList.toggle('on', x === b)); calc(); });
    $('#sA', root).addEventListener('input', calc); if (!fixed) $('#sV', root).addEventListener('change', calc);
    $('#sGo', root).addEventListener('click', () => openLead({ vehicleId: root.dataset.v, title: 'Pre-aprobación de crédito', sub: 'Te respondemos en 24 h hábiles.', formaPago: 'financiado', mensaje: root.dataset.msg, cta: 'Solicitar pre-aprobación' }));
    calc();
  }
  function insurance(root, fixed) {
    const y = today().getFullYear();
    root.innerHTML = (fixed ? '' : '<div class="form" style="margin-bottom:16px"><label class="field">Tu vehículo<select id="iV"><option value="">Otro (ingresar valor)</option>' + vehicleOptions((Q.published().find((v) => v.model === 'Corolla Cross') || {}).id) + '</select></label><div class="form__row"><label class="field">Valor<input id="iVal" type="number" inputmode="numeric" step="100000"></label><label class="field">Año<select id="iY">' + Array.from({ length: 15 }, (_, i) => y - i).map((a) => '<option>' + a + '</option>').join('') + '</select></label></div></div>') +
      '<div class="covs" id="iC"></div><p class="note" style="margin-top:10px">Mejor precio entre ' + DB.data.insurers.length + ' aseguradoras: ' + DB.data.insurers.map((i) => esc(i.nombre)).join(', ') + '.</p>';
    const sync = () => { const v = fixed || DB.get('vehicles', $('#iV', root).value); if (v && !fixed) { $('#iVal', root).value = v.price; $('#iY', root).value = v.year; } };
    const render = () => {
      const v = fixed || DB.get('vehicles', ($('#iV', root) || {}).value);
      const val = fixed ? fixed.price : (+$('#iVal', root).value || 30e6), yr = fixed ? fixed.year : +$('#iY', root).value, name = v ? Q.vName(v) : 'mi vehículo';
      $('#iC', root).innerHTML = DB.data.coverages.map((cv) => { const best = DB.data.insurers.map((i) => ({ i, p: Fin.quote(val, yr, cv, i) })).sort((a, b) => a.p - b.p)[0]; return '<button class="cov js-cotizar" data-pago="contado" data-title="Contratá tu seguro" data-interes="Seguro ' + esc(cv.nombre) + ' · ' + esc(name) + '" data-msg="Quiero ' + esc(cv.nombre) + ' para ' + esc(name) + ' (' + yr + '). Cotización: ' + fmt.money(best.p) + '/mes con ' + esc(best.i.nombre) + '." ' + (v ? 'data-v="' + v.id + '"' : '') + '><b>' + esc(cv.nombre) + '</b><span>' + esc(cv.beneficios.slice(0, 2).join(' · ')) + '</span><strong>' + fmt.money(best.p) + '<small>/mes · ' + esc(best.i.nombre) + '</small></strong></button>'; }).join('');
    };
    if (!fixed) { $('#iV', root).addEventListener('change', () => { sync(); render(); }); $('#iVal', root).addEventListener('change', render); $('#iY', root).addEventListener('change', render); sync(); if (!$('#iVal', root).value) $('#iVal', root).value = 30000000; }
    render();
  }
  const TOOLS = {
    sim() { simulator(sheet('Simulá tu crédito', 'Crédito prendario en pesos · aprobación en 24 h', '<div id="tSim"></div>').querySelector('#tSim')); },
    seguro() { insurance(sheet('Cotizá tu seguro', 'Comparamos 5 aseguradoras en el momento', '<div id="tIns"></div>').querySelector('#tIns')); },
    plan() {
      const L = Q.published().filter((v) => v.cond === '0km' && v.cuotaDesde).sort((a, b) => a.cuotaDesde - b.cuotaDesde).slice(0, 14);
      const b = sheet('Plan de ahorro', 'Adjudicación desde la cuota 2 por sorteo o licitación.', '<div class="plist">' + L.map((v) => '<button class="js-cotizar" data-v="' + v.id + '" data-pago="plan" data-title="Plan de ahorro ' + esc(Q.vName(v)) + '"><img src="' + esc(v.img) + '" alt="" loading="lazy"><span><b>' + esc(Q.vName(v)) + '</b><span>' + v.plazo + ' cuotas · ' + v.pct + '% financiado</span></span><strong>' + fmt.money(v.cuotaDesde) + '<small>cuota desde</small></strong></button>').join('') + '</div>');
      return b;
    },
    usado() {
      const y = today().getFullYear();
      const b = sheet('¿Cuánto vale tu auto?', 'Valor estimado en segundos. Lo tomamos como parte de pago.',
        '<form class="form" id="tzF"><div class="form__row"><label class="field">Marca<select name="marca">' + ['Chevrolet', 'Fiat', 'Ford', 'Honda', 'Nissan', 'Peugeot', 'Renault', 'Toyota', 'Volkswagen', 'Citroën', 'Jeep', 'Otra'].map((m) => '<option>' + m + '</option>').join('') + '</select></label><label class="field">Modelo<input name="modelo" required placeholder="Ej.: Gol Trend"></label></div>' +
        '<div class="form__row"><label class="field">Año<select name="anio">' + Array.from({ length: 16 }, (_, i) => y - 1 - i).map((a) => '<option>' + a + '</option>').join('') + '</select></label><label class="field">Kilómetros<input name="km" type="number" inputmode="numeric" required placeholder="85000"></label></div>' +
        '<div id="tzR" hidden></div><button class="btn btn--block" id="tzB">Ver valor estimado</button></form>');
      let step = 1;
      $('#tzF', b).addEventListener('submit', (e) => {
        e.preventDefault(); const d = formData(e.target), age = y - +d.anio, km = +d.km || 0;
        const base = 36e6 * ({ Toyota: 1.15, Volkswagen: 1.05, Honda: 1.08, Jeep: 1.1 }[d.marca] || 1) * Math.pow(0.89, age) * Math.max(0.55, 1 - km / 450000);
        const lo = RB.round(base * 0.9, 50000), hi = RB.round(base * 1.05, 50000);
        if (step === 1) { step = 2; const r = $('#tzR', b); r.hidden = false; r.innerHTML = '<div class="sim__res" style="margin-bottom:4px"><div class="big"><span>Valor estimado de toma</span></div><b style="font:700 1.5rem var(--display)">' + fmt.money(lo) + ' – ' + fmt.money(hi) + '</b></div><div class="form__row" style="margin-top:12px"><label class="field">Nombre<input name="nombre" required autocomplete="name"></label><label class="field">Teléfono<input name="tel" required type="tel" autocomplete="tel"></label></div>'; $('#tzB', b).textContent = 'Quiero que lo tasen'; return; }
        DB.insert('tradeIns', { nombre: d.nombre, tel: d.tel, email: '', marca: d.marca, modelo: d.modelo, anio: +d.anio, km, estadoGeneral: 'A peritar', fecha: iso(today()), estado: 'pendiente', valorMercado: RB.round((lo + hi) / 2 / 0.85, 50000), valorOfrecido: 0, interes: '', tasador: 'U5', notas: 'Estimación web: ' + fmt.money(lo) + ' – ' + fmt.money(hi) });
        createLead({ nombre: d.nombre, tel: d.tel, interes: 'Toma de usado: ' + d.marca + ' ' + d.modelo + ' ' + d.anio, mensaje: 'Quiere entregar su ' + d.marca + ' ' + d.modelo + ' ' + d.anio + ' (' + fmt.km(km) + '). Estimación ' + fmt.money(lo) + ' – ' + fmt.money(hi) + '.', formaPago: 'permuta', canal: 'el tasador online' });
        e.target.outerHTML = doneHTML('¡Listo!', 'Un perito te contacta hoy para coordinar la revisión de tu ' + d.marca + ' ' + d.modelo + '.');
      });
    },
    taller() {
      const min = iso(addDays(today(), 1));
      const b = sheet('Turno de taller', 'Service oficial, diagnóstico y chapa y pintura.',
        '<form class="form" id="svF"><label class="field">Nombre y apellido<input name="nombre" required autocomplete="name"></label><label class="field">Teléfono<input name="tel" required type="tel" autocomplete="tel"></label>' +
        '<div class="form__row"><label class="field">Vehículo<input name="vehiculo" required placeholder="Ej.: Hilux 2022"></label><label class="field">Patente<input name="patente" placeholder="AB 123 CD"></label></div>' +
        '<label class="field">Servicio<select name="servicio">' + ['Service oficial', 'Service por kilometraje', 'Frenos y tren delantero', 'Diagnóstico computarizado', 'Chapa y pintura', 'Revisión pre-VTV', 'Garantía'].map((s) => '<option>' + s + '</option>').join('') + '</select></label>' +
        '<div class="form__row"><label class="field">Día<input name="fecha" type="date" required min="' + min + '" value="' + min + '"></label><label class="field">Horario<select name="hora">' + ['08:00', '09:00', '10:00', '11:00', '14:00', '15:00', '16:00'].map((h) => '<option>' + h + '</option>').join('') + '</select></label></div><button class="btn btn--block">Reservar turno</button></form>');
      $('#svF', b).addEventListener('submit', (e) => {
        e.preventDefault(); const d = formData(e.target);
        DB.insert('appts', { fecha: d.fecha + 'T' + d.hora + ':00', duracion: 120, tipo: 'service', clientId: '', leadId: '', nombre: d.nombre, tel: d.tel, vehiculo: d.vehiculo + (d.patente ? ' · ' + d.patente.toUpperCase() : ''), asignado: 'U8', estado: 'pendiente', notas: d.servicio + ' (turno web)' });
        DB.notify('Turno de taller web: ' + d.nombre + ' — ' + d.servicio + ' (' + fmt.date(d.fecha) + ' ' + d.hora + ')', 'taller', '#/agenda'); DB.save();
        e.target.outerHTML = doneHTML('¡Turno reservado!', fmt.dateLong(d.fecha) + ' a las ' + d.hora + ' h. Traé la cédula del vehículo.');
      });
    },
    contacto() { contactSheet(null); }
  };

  /* ================================================================ HOME */
  function home() {
    layout('inicio');
    const V = Q.published(), by = (b, m) => V.find((v) => v.cond === '0km' && v.brand === b && v.model === m);
    // hero
    const slides = [
      { v: by('chevrolet', 'S10'), img: 'chevrolet-hero-s10-1080.webp', k: 'Bonificaciones especiales', t: 'Tu S10 0km con adjudicación pactada' },
      { v: by('chevrolet', 'Onix'), img: 'chevrolet-onix-1080.webp', k: 'Tasa 0% · 12 meses', t: 'Onix financiado sin interés' },
      { v: by('chevrolet', 'Montana'), img: 'chevrolet-hero-montana-960.webp', k: 'Nueva generación', t: 'Montana turbo con entrega programada' },
      { v: by('chevrolet', 'Sonic'), img: 'chevrolet-hero-sonic-1080.webp', k: 'Lanzamiento', t: 'Nuevo Sonic, preventa abierta' }
    ].filter((s) => s.v);
    const track = $('#heroTrack');
    track.innerHTML = slides.map((s, i) => '<div class="slide" role="group" aria-label="' + (i + 1) + ' de ' + slides.length + '"><img src="assets/img/banners/' + s.img + '" alt="" ' + (i ? 'loading="lazy"' : 'fetchpriority="high"') + '><div class="slide__in"><span class="slide__k">' + esc(s.k) + '</span><h2>' + esc(s.t) + '</h2><p>Cuota desde <b>' + fmt.money(s.v.cuotaDesde) + '</b></p><div class="slide__btns"><a class="btn btn--light" href="vehiculo.html?id=' + s.v.id + '">Ver modelo</a><button class="btn btn--acc js-cotizar" data-v="' + s.v.id + '" data-pago="plan">Quiero mi plan</button></div></div></div>').join('');
    const dots = $('#heroDots'); dots.innerHTML = slides.map((_, i) => '<button aria-label="Ir a la promoción ' + (i + 1) + '"' + (i ? '' : ' class="on"') + '></button>').join('');
    let cur = 0, timer;
    const go = (i) => { cur = (i + slides.length) % slides.length; track.scrollTo({ left: track.clientWidth * cur, behavior: 'smooth' }); };
    const auto = () => { clearInterval(timer); if (!matchMedia('(prefers-reduced-motion: reduce)').matches) timer = setInterval(() => go(cur + 1), 6000); };
    track.addEventListener('scroll', () => { const i = Math.round(track.scrollLeft / track.clientWidth); cur = i; $$('button', dots).forEach((b, k) => b.classList.toggle('on', k === i)); }, { passive: true });
    track.addEventListener('pointerdown', () => clearInterval(timer), { passive: true });
    $$('button', dots).forEach((b, i) => b.addEventListener('click', () => { go(i); auto(); }));
    auto();
    // buscador
    $('#find').addEventListener('submit', (e) => { e.preventDefault(); const q = $('#findQ').value.trim(); location.href = 'catalogo.html' + (q ? '?q=' + encodeURIComponent(q) : ''); });
    const cnt = (f) => V.filter(f).length;
    $('#chips').innerHTML = [['catalogo.html?cond=0km', '0km', cnt((v) => v.cond === '0km')], ['catalogo.html?cond=usado', 'Usados', cnt((v) => v.cond === 'usado')], ['catalogo.html?body=suv', 'SUV', cnt((v) => v.body === 'suv')], ['catalogo.html?body=pickup', 'Pick-up', cnt((v) => v.body === 'pickup')], ['catalogo.html?body=sedan', 'Sedán', cnt((v) => v.body === 'sedan')], ['catalogo.html?body=hatchback', 'Hatchback', cnt((v) => v.body === 'hatchback')], ['catalogo.html?fuel=hibrido', 'Híbridos y eléctricos', cnt((v) => /híbrido|eléctrico/i.test(v.fuel))], ['catalogo.html?max=35000000', 'Hasta $ 35 M', cnt((v) => v.price <= 35e6)]].map(([h, l, n]) => '<a class="chip" href="' + h + '">' + l + ' <small>' + n + '</small></a>').join('');
    // accesos
    const SC = [['catalogo.html?cond=0km', 'car', '0km'], ['catalogo.html?cond=usado', 'shield', 'Usados'], ['sim', 'percent', 'Financiación'], ['plan', 'piggy', 'Plan de ahorro'], ['usado', 'swap', 'Vendé tu usado'], ['seguro', 'shield', 'Seguros'], ['taller', 'wrench', 'Taller'], ['mi-cuenta.html', 'user', 'Mi cuenta']];
    $('#shortcuts').innerHTML = SC.map(([k, ic, l]) => k.includes('.html') ? '<a href="' + k + '"><span class="ic">' + icon(ic) + '</span>' + l + '</a>' : '<button data-tool="' + k + '"><span class="ic">' + icon(ic) + '</span>' + l + '</button>').join('');
    // recién llegados (fotos reales)
    $('#fresh').innerHTML = V.filter((v) => v.photos && v.cond === '0km').sort((a, b) => b.ingreso.localeCompare(a.ingreso)).slice(0, 8).map((v) => card(v)).join('');
    // ofertas
    const end = new Date(today().getFullYear(), today().getMonth() + 1, 0, 23, 59, 59);
    const tick = () => { let s = Math.max(0, Math.floor((end - new Date()) / 1000)); const d = Math.floor(s / 86400); s %= 86400; const h = Math.floor(s / 3600); s %= 3600; const m = Math.floor(s / 60); $('#timer').innerHTML = '<span class="dot"></span>Terminan en <b>' + d + 'd ' + String(h).padStart(2, '0') + 'h ' + String(m).padStart(2, '0') + 'm</b>'; };
    tick(); setInterval(tick, 30000);
    const offers = [
      { v: by('chevrolet', 'Onix'), img: 'assets/img/banners/chevrolet-onix-1080.webp', k: 'Tasa 0%', t: 'Onix a 12 meses sin interés', d: 'Con 40% de anticipo.' },
      { v: by('toyota', 'Corolla Cross'), img: (by('toyota', 'Corolla Cross') || {}).img ? Q.photos(by('toyota', 'Corolla Cross'))[0].f : '', k: 'Bonificación', t: 'Corolla Cross con patentamiento bonificado', d: 'Tomamos tu usado con sobretasación.' },
      { v: by('chevrolet', 'Tracker'), img: 'assets/img/banners/chevrolet-tracker-720.webp', k: 'Plan 80%', t: 'Tracker en 120 cuotas', d: 'Cuotas bonificadas al suscribir.' },
      { v: by('toyota', 'RAV4'), img: (by('toyota', 'RAV4') ? Q.photos(by('toyota', 'RAV4'))[0].f : ''), k: 'Híbrido', t: 'RAV4 Hybrid: seguro 50% off', d: 'Durante 3 meses contratando con nosotros.' }
    ].filter((o) => o.v && o.img);
    $('#offers').innerHTML = offers.map((o) => '<a class="offer" href="vehiculo.html?id=' + o.v.id + '"><img src="' + esc(o.img) + '" alt="' + esc(Q.vName(o.v)) + '" loading="lazy"><div><small>' + esc(o.k) + '</small><h3>' + esc(o.t) + '</h3><p>' + esc(o.d) + '</p></div></a>').join('');
    // usados
    $('#used').innerHTML = V.filter((v) => v.cond === 'usado').sort((a, b) => (b.photos ? 1 : 0) - (a.photos ? 1 : 0) || b.year - a.year).slice(0, 8).map((v) => card(v)).join('');
    // servicios
    const minCuota = Math.min(...V.filter((v) => v.cuotaDesde).map((v) => v.cuotaDesde));
    const minSeg = Math.min(...DB.data.insurers.map((i) => Fin.quote(30e6, today().getFullYear(), DB.data.coverages[1], i)));
    $('#services').innerHTML = [['sim', 'percent', 'Financiación', 'Créditos en pesos con aprobación en 24 h y tasa 0% en modelos seleccionados.', 'Hasta 60 cuotas'], ['plan', 'piggy', 'Plan de ahorro', 'Planes hasta 100% financiados, adjudicación desde la cuota 2.', 'Cuotas desde ' + fmt.money(minCuota)], ['seguro', 'shield', 'Seguros', 'Comparamos 5 aseguradoras y te mostramos la mejor cuota.', 'Terceros completo desde ' + fmt.money(minSeg)], ['taller', 'wrench', 'Taller oficial', 'Service con precio cerrado y seguimiento por WhatsApp.', 'Turnos online']]
      .map(([k, ic, t, d, s]) => '<button class="svc" data-tool="' + k + '"><span class="ic">' + icon(ic) + '</span><h3>' + t + '</h3><p>' + d + '</p><span class="stat">' + s + '</span><span class="link">' + ({ sim: 'Simular cuota', plan: 'Ver planes', seguro: 'Cotizar', taller: 'Pedir turno' })[k] + icon('arrowRight') + '</span></button>').join('');
    // marcas
    $('#brands').innerHTML = BRANDS.map((b) => '<a href="catalogo.html?marca=' + b.id + '">' + b.name + '</a>').join('');
    // testimonios
    const T = [['Mariana', 'Vicente López', 'Corolla Cross', 5, 'Me explicaron todas las opciones sin apuro. Retiré el auto en 10 días con todo resuelto.'], ['Federico', 'Pilar', 'Hilux', 5, 'Me tomaron el usado a buen precio y dejé el seguro contratado en el momento.'], ['Carolina', 'San Isidro', 'Onix Plus', 4, 'Muy buena atención por WhatsApp. Coordinamos el test drive para el sábado.'], ['Julieta', 'CABA', 'Tera', 5, 'Era mi primer 0km y me acompañaron en todo. Adjudiqué el plan en la cuota 4.'], ['Gonzalo', 'Tigre', 'RAV4 Hybrid', 5, 'Las fotos de la web eran exactamente la unidad que me entregaron. Impecable.'], ['Hernán', 'Escobar', 'Kangoo', 4, 'Compré dos utilitarios para la empresa con financiación propia. Rápido y claro.']];
    $('#testi').innerHTML = T.map(([n, c, m, s, q]) => '<figure class="quote"><div class="stars" aria-label="' + s + ' de 5">' + icon('star').repeat(s) + '</div><p>“' + esc(q) + '”</p><footer><b>' + esc(n) + '</b> · ' + esc(c) + ' · ' + esc(m) + '</footer></figure>').join('');
    // contacto
    const c = cfg();
    $('#contact').innerHTML = '<div><div class="contact__row">' + icon('pin') + '<div><b>Showroom</b><span>' + esc(c.address) + '</span></div></div><div class="contact__row">' + icon('clock') + '<div><b>Horarios</b><span>' + c.hours.map(([d, h]) => esc(d) + ': ' + esc(h)).join('<br>') + '</span></div></div></div>' +
      '<div><div class="contact__row">' + icon('phone') + '<div><b>Ventas</b><a href="tel:' + esc(c.phoneHref) + '">' + esc(c.phone) + '</a></div></div><div class="contact__row">' + icon('wrench') + '<div><b>Taller</b><a href="tel:' + esc(c.servicePhone) + '">' + esc(c.servicePhone) + '</a></div></div>' +
      '<div class="contact__btns"><a class="btn btn--line" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(c.address) + '">' + icon('pin') + 'Cómo llegar</a><button class="btn" data-tool="contacto">' + icon('mail') + 'Escribinos</button></div></div>';
  }

  /* ============================================================= CATÁLOGO */
  function catalog() {
    const p = params();
    layout(p.cond === 'usado' ? 'usados' : p.cond === '0km' ? '0km' : '');
    const V = Q.published();
    const st = { cond: p.favs ? '' : (p.cond || ''), brands: p.marca ? p.marca.split(',') : [], bodies: p.body ? p.body.split(',') : [], fuel: p.fuel === 'hibrido' ? ['Híbrido', 'Híbrido enchufable', 'Eléctrico'] : [], trans: [], min: '', max: p.max || '', year: '', km: '', q: p.q || '', sort: 'rel', favs: !!p.favs, cmp: [] };
    $('#catTitle').textContent = st.favs ? 'Mis favoritos' : st.cond === 'usado' ? 'Usados seleccionados' : st.cond === '0km' ? 'Autos 0km' : 'Todos los vehículos';
    $('#catSub').textContent = st.favs ? 'Los vehículos que guardaste.' : st.cond === 'usado' ? 'Peritados, con garantía y financiación.' : 'Stock real, precios de lista y fotos de cada unidad.';
    const brandIds = [...new Set(V.map((v) => v.brand))].sort((a, b) => Q.brandName(a).localeCompare(Q.brandName(b)));
    const uniq = (k) => [...new Set(V.map((v) => v[k]))].sort();
    const match = (v, skip) => (skip === 'cond' || !st.cond || v.cond === st.cond) && (!st.favs || favs().includes(v.id)) &&
      (skip === 'brands' || !st.brands.length || st.brands.includes(v.brand)) && (skip === 'bodies' || !st.bodies.length || st.bodies.includes(v.body)) &&
      (skip === 'fuel' || !st.fuel.length || st.fuel.includes(v.fuel)) && (skip === 'trans' || !st.trans.length || st.trans.includes(v.trans)) &&
      (!st.min || v.price >= +st.min) && (!st.max || v.price <= +st.max) && (!st.year || v.year >= +st.year) && (st.km === '' || v.km <= +st.km) &&
      (!st.q || (Q.vFull(v) + ' ' + LABELS.body[v.body] + ' ' + v.fuel).toLowerCase().includes(st.q.toLowerCase()));
    const nActive = () => st.brands.length + st.bodies.length + st.fuel.length + st.trans.length + (st.min ? 1 : 0) + (st.max ? 1 : 0) + (st.year ? 1 : 0) + (st.km !== '' ? 1 : 0) + (st.cond ? 1 : 0);
    const pills = (key, list, label) => '<div class="pills">' + list.map((x) => { const n = V.filter((v) => match(v, key) && ({ brands: v.brand, bodies: v.body, fuel: v.fuel, trans: v.trans })[key] === x).length; return '<button type="button" class="chip' + (st[key].includes(x) ? ' on' : '') + '" data-k="' + key + '" data-x="' + esc(x) + '">' + esc(label ? label(x) : x) + ' <small>' + n + '</small></button>'; }).join('') + '</div>';
    const filtersHTML = () => '<div><h4>Buscar</h4><input class="inp js-fq" type="search" placeholder="Modelo o versión" value="' + esc(st.q) + '"></div>' +
      '<div><h4>Condición</h4><div class="seg seg--full">' + [['', 'Todos'], ['0km', '0km'], ['usado', 'Usados']].map(([k, l]) => '<button type="button" data-cond="' + k + '"' + (st.cond === k ? ' class="on"' : '') + '>' + l + '</button>').join('') + '</div></div>' +
      '<div><h4>Marca</h4>' + pills('brands', brandIds, Q.brandName) + '</div><div><h4>Carrocería</h4>' + pills('bodies', Object.keys(LABELS.body), (k) => LABELS.body[k]) + '</div>' +
      '<div><h4>Precio</h4><div class="range2"><input class="inp js-fmin" type="number" inputmode="numeric" placeholder="Mínimo" step="1000000" value="' + esc(st.min) + '"><input class="inp js-fmax" type="number" inputmode="numeric" placeholder="Máximo" step="1000000" value="' + esc(st.max) + '"></div></div>' +
      '<div><h4>Año y kilometraje</h4><div class="range2"><select class="inp js-fyear"><option value="">Año desde</option>' + [2027, 2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019].map((y) => '<option' + (String(y) === st.year ? ' selected' : '') + '>' + y + '</option>').join('') + '</select><select class="inp js-fkm"><option value="">Km máx.</option>' + [0, 20000, 50000, 80000, 120000].map((k) => '<option value="' + k + '"' + (String(k) === st.km ? ' selected' : '') + '>' + (k ? 'Hasta ' + fmt.num(k / 1000) + ' mil' : '0 km') + '</option>').join('') + '</select></div></div>' +
      '<div><h4>Combustible</h4>' + pills('fuel', uniq('fuel')) + '</div><div><h4>Transmisión</h4>' + pills('trans', uniq('trans')) + '</div>';
    const bindFilters = (root, onChange) => {
      root.addEventListener('click', (e) => {
        const ch = e.target.closest('[data-k]'); if (ch) { const k = ch.dataset.k, x = ch.dataset.x; st[k] = st[k].includes(x) ? st[k].filter((y) => y !== x) : st[k].concat(x); onChange(); }
        const cd = e.target.closest('[data-cond]'); if (cd) { st.cond = cd.dataset.cond; st.favs = false; onChange(); }
      });
      root.addEventListener('input', (e) => { const t = e.target; if (t.matches('.js-fq,.js-fmin,.js-fmax')) { clearTimeout(root._t); root._t = setTimeout(() => { st.q = $('.js-fq', root).value.trim(); st.min = $('.js-fmin', root).value; st.max = $('.js-fmax', root).value; onChange(true); }, 300); } });
      root.addEventListener('change', (e) => { const t = e.target; if (t.matches('.js-fyear')) { st.year = t.value; onChange(); } if (t.matches('.js-fkm')) { st.km = t.value; onChange(); } });
    };
    const aside = $('#filters');
    const paintAside = () => { const f = document.activeElement && document.activeElement.closest('#filters') ? document.activeElement.className : ''; aside.innerHTML = filtersHTML() + '<button class="btn btn--line btn--block js-clear">Limpiar filtros</button>'; if (f) { const el = $('.' + f.split(' ').find((c) => c.startsWith('js-')), aside); if (el) { el.focus(); if (el.setSelectionRange && el.type !== 'number') el.setSelectionRange(el.value.length, el.value.length); } } };
    const clear = () => { Object.assign(st, { cond: '', brands: [], bodies: [], fuel: [], trans: [], min: '', max: '', year: '', km: '', q: '', favs: false }); };
    bindFilters(aside, (typing) => { if (!typing) paintAside(); render(); });
    aside.addEventListener('click', (e) => { if (e.target.closest('.js-clear')) { clear(); paintAside(); render(); } });
    $('#fOpen').addEventListener('click', () => {
      const b = sheet('Filtros', '', '<div class="filters">' + filtersHTML() + '</div><div class="filters__foot"><button class="btn btn--line js-clear">Limpiar</button><button class="btn js-apply"></button></div>');
      const repaint = (typing) => { if (!typing) $('.filters', b).innerHTML = filtersHTML(); $('.js-apply', b).textContent = 'Ver ' + V.filter((v) => match(v)).length + ' resultados'; render(); };
      bindFilters($('.filters', b), repaint); repaint(true);
      b.addEventListener('click', (e) => { if (e.target.closest('.js-clear')) { clear(); repaint(); } if (e.target.closest('.js-apply')) { closeSheet(); paintAside(); } });
    });
    $('#sort').addEventListener('change', (e) => { st.sort = e.target.value; render(); });
    const render = () => {
      const list = V.filter((v) => match(v));
      const S = { rel: (a, b) => (b.photos ? 1 : 0) - (a.photos ? 1 : 0) || (b.featured - a.featured) || a.price - b.price, pa: (a, b) => a.price - b.price, pd: (a, b) => b.price - a.price, yd: (a, b) => b.year - a.year || a.km - b.km, ka: (a, b) => a.km - b.km };
      list.sort(S[st.sort]);
      $('#count').textContent = list.length + (list.length === 1 ? ' resultado' : ' resultados');
      const n = nActive(); $('#fN').textContent = n; $('#fN').hidden = !n;
      $('#results').innerHTML = list.length ? list.map((v) => card(v, { compare: true, compared: st.cmp.includes(v.id) })).join('') : '<div class="empty">' + icon('search') + '<b>No encontramos vehículos con esos filtros</b><span>Probá quitar algún filtro o pedinos que lo busquemos por vos.</span><button class="btn btn--sm js-contact">Pedir asesoramiento</button></div>';
    };
    // comparador (escritorio)
    const bar = $('#cmpbar');
    const updCmp = () => { bar.classList.toggle('on', st.cmp.length > 0); $('#cmpN').textContent = st.cmp.length + ' para comparar'; };
    $('#results').addEventListener('change', (e) => { if (!e.target.classList.contains('js-cmp')) return; const id = e.target.value; if (e.target.checked) { if (st.cmp.length >= 3) { e.target.checked = false; toast('Hasta 3 vehículos'); return; } st.cmp.push(id); } else st.cmp = st.cmp.filter((x) => x !== id); updCmp(); });
    $('#cmpClear').addEventListener('click', () => { st.cmp = []; $$('.js-cmp').forEach((i) => { i.checked = false; }); updCmp(); });
    $('#cmpGo').addEventListener('click', () => {
      const L = st.cmp.map((id) => DB.get('vehicles', id));
      const rows = [['', (v) => '<img src="' + esc(v.img) + '" alt=""><b style="display:block;margin-top:8px">' + esc(Q.vName(v)) + '</b><small class="mut">' + esc(v.version) + '</small>'], ['Precio', (v) => '<b>' + fmt.money(v.price) + '</b>'], ['Condición', (v) => v.cond === '0km' ? '0km ' + v.year : 'Usado ' + v.year + ' · ' + fmt.km(v.km)], ['Carrocería', (v) => LABELS.body[v.body]], ['Motor', (v) => esc(v.engine) + ' · ' + v.hp + ' CV'], ['Combustible', (v) => esc(v.fuel)], ['Transmisión', (v) => esc(v.trans)], ['Asientos', (v) => v.seats], ['Consumo', (v) => esc(v.consumo)], ['Fotos', (v) => Q.photos(v).length], ['', (v) => '<a class="btn btn--sm" href="vehiculo.html?id=' + v.id + '">Ver</a>']];
      sheet('Comparador', '', '<div style="overflow-x:auto"><table class="cmptbl">' + rows.map(([l, fn]) => '<tr><th>' + l + '</th>' + L.map((v) => '<td>' + fn(v) + '</td>').join('') + '</tr>').join('') + '</table></div>', true);
    });
    paintAside(); render();
  }

  /* ========================================================== GALERÍA */
  function gallery(root, v) {
    const ph = Q.photos(v), n = ph.length;
    const badges = [v.cond === '0km' ? '0km' : 'Usado ' + v.year].concat(v.tags.slice(0, 2));
    root.innerHTML = '<div class="gal"><div class="gal__stage"><div class="gal__badges">' + badges.map((b, i) => '<span class="vc__tag' + (i ? ' vc__tag--dark' : '') + '">' + esc(b) + '</span>').join('') + '</div>' +
      '<div class="gal__track" id="gT">' + ph.map((p, i) => '<button type="button" data-i="' + i + '" aria-label="Ampliar foto ' + (i + 1) + ' de ' + n + '"><img src="' + esc(p.f) + '" alt="' + esc(Q.vFull(v)) + ' — foto ' + (i + 1) + '"' + (i ? ' loading="lazy"' : ' fetchpriority="high"') + ' width="1200" height="900"></button>').join('') + '</div>' +
      (n > 1 ? '<button class="gal__arr gal__arr--p" aria-label="Foto anterior">' + icon('chevron') + '</button><button class="gal__arr gal__arr--n" aria-label="Foto siguiente">' + icon('chevron') + '</button>' : '') +
      '<button class="gal__count" id="gC" aria-label="Ver todas las fotos">' + icon('camera') + '<span>1 / ' + n + '</span></button></div>' +
      (n > 1 ? '<div class="gal__thumbs" id="gTh">' + ph.map((p, i) => '<button type="button" data-i="' + i + '"' + (i ? '' : ' class="on"') + ' aria-label="Foto ' + (i + 1) + '"><img src="' + esc(p.t) + '" alt=""></button>').join('') + '</div>' : '') + '</div>';
    const tr = $('#gT', root);
    const goTo = (i, smooth) => tr.scrollTo({ left: tr.clientWidth * i, behavior: smooth === false ? 'auto' : 'smooth' });
    const idx = () => Math.round(tr.scrollLeft / tr.clientWidth);
    tr.addEventListener('scroll', () => { const i = idx(); $('#gC span', root).textContent = (i + 1) + ' / ' + n; const th = $('#gTh', root); if (th) { $$('button', th).forEach((b, k) => b.classList.toggle('on', k === i)); const b = th.children[i]; if (b) th.scrollTo({ left: b.offsetLeft - (th.clientWidth - b.clientWidth) / 2, behavior: 'smooth' }); } }, { passive: true });
    tr.addEventListener('click', (e) => { const b = e.target.closest('[data-i]'); if (b) lightbox(v, +b.dataset.i); });
    root.addEventListener('click', (e) => {
      const th = e.target.closest('#gTh [data-i]'); if (th) goTo(+th.dataset.i);
      const ar = e.target.closest('.gal__arr'); if (ar) goTo(Math.max(0, Math.min(n - 1, idx() + (ar.classList.contains('gal__arr--n') ? 1 : -1))));
      if (e.target.closest('#gC')) lightbox(v, idx(), true);
    });
  }
  function lightbox(v, start, grid) {
    const ph = Q.photos(v), n = ph.length;
    let lb = $('#lb');
    if (!lb) { lb = document.createElement('div'); lb.id = 'lb'; lb.className = 'lb'; lb.setAttribute('role', 'dialog'); lb.setAttribute('aria-modal', 'true'); lb.setAttribute('aria-label', 'Galería de fotos'); document.body.appendChild(lb); }
    lb.innerHTML = '<div class="lb__h"><span id="lbT"></span><button id="lbG" aria-label="Ver grilla de fotos">' + icon('grid') + '</button><button id="lbX" aria-label="Cerrar">' + icon('x') + '</button></div>' +
      '<div class="lb__main"><div class="lb__track" id="lbTr">' + ph.map((p, i) => '<div><img src="' + esc(p.f) + '" alt="Foto ' + (i + 1) + ' de ' + n + '" loading="lazy"></div>').join('') + '</div>' +
      (n > 1 ? '<button class="lb__arr lb__arr--p" aria-label="Anterior">' + icon('chevron') + '</button><button class="lb__arr lb__arr--n" aria-label="Siguiente">' + icon('chevron') + '</button>' : '') +
      '<div class="lb__grid" id="lbGr">' + ph.map((p, i) => '<button data-i="' + i + '" aria-label="Foto ' + (i + 1) + '"><img src="' + esc(p.t) + '" alt="" loading="lazy"></button>').join('') + '</div></div>' +
      '<div class="lb__thumbs" id="lbTh">' + ph.map((p, i) => '<button data-i="' + i + '" aria-label="Foto ' + (i + 1) + '"><img src="' + esc(p.t) + '" alt=""></button>').join('') + '</div>';
    const tr = $('#lbTr', lb), title = Q.vName(v);
    const upd = () => { const i = Math.round(tr.scrollLeft / tr.clientWidth); $('#lbT', lb).textContent = title + ' · ' + (i + 1) + ' / ' + n; const th = $('#lbTh', lb); $$('button', th).forEach((x, k) => x.classList.toggle('on', k === i)); const cb = th.children[i]; if (cb) th.scrollTo({ left: cb.offsetLeft - (th.clientWidth - cb.clientWidth) / 2 }); };
    const goTo = (i, smooth) => { tr.scrollTo({ left: tr.clientWidth * Math.max(0, Math.min(n - 1, i)), behavior: smooth ? 'smooth' : 'auto' }); };
    const setGrid = (on) => { lb.classList.toggle('grid', on); $('#lbG', lb).classList.toggle('on', on); };
    lb.classList.add('on'); lockScroll(true); setGrid(!!grid);
    requestAnimationFrame(() => { goTo(start || 0); upd(); });
    tr.addEventListener('scroll', upd, { passive: true });
    const close = () => { lb.classList.remove('on'); document.removeEventListener('keydown', onKey); if (!$('.sheet.on')) lockScroll(false); const g = $('#gT'); if (g) g.scrollTo({ left: g.clientWidth * Math.round(tr.scrollLeft / tr.clientWidth) }); };
    const onKey = (e) => { if (e.key === 'Escape') { if (lb.classList.contains('grid') && !grid) setGrid(false); else close(); } if (e.key === 'ArrowRight') goTo(Math.round(tr.scrollLeft / tr.clientWidth) + 1, true); if (e.key === 'ArrowLeft') goTo(Math.round(tr.scrollLeft / tr.clientWidth) - 1, true); };
    document.addEventListener('keydown', onKey);
    lb.onclick = (e) => {
      if (e.target.closest('#lbX')) return close();
      if (e.target.closest('#lbG')) return setGrid(!lb.classList.contains('grid'));
      const a = e.target.closest('.lb__arr'); if (a) return goTo(Math.round(tr.scrollLeft / tr.clientWidth) + (a.classList.contains('lb__arr--n') ? 1 : -1), true);
      const g = e.target.closest('#lbGr [data-i]'); if (g) { setGrid(false); grid = false; return goTo(+g.dataset.i); }
      const t = e.target.closest('#lbTh [data-i]'); if (t) return goTo(+t.dataset.i, true);
    };
    $('#lbX', lb).focus();
  }

  /* ============================================================== FICHA */
  function detail() {
    const v = DB.get('vehicles', params().id) || Q.published().find((x) => x.photos) || Q.published()[0];
    document.body.classList.add('has-bar');
    layout(v.cond === 'usado' ? 'usados' : '0km');
    document.title = Q.vFull(v) + ' · ' + cfg().name;
    const c = cfg(), ph = Q.photos(v);
    $('#crumbs').innerHTML = '<a href="home.html">Inicio</a><span>/</span><a href="catalogo.html?cond=' + v.cond + '">' + (v.cond === '0km' ? '0km' : 'Usados') + '</a><span>/</span><span>' + esc(Q.vName(v)) + '</span>';
    gallery($('#gallery'), v);
    const fin = Fin.cuota(v.price * 0.6, v.promoTasa0 ? c.tnaPromo : c.tna, v.promoTasa0 ? 12 : 48);
    const avail = v.cond === '0km' ? (v.stock > 0 ? ['Disponible · entrega inmediata', ''] : ['A pedido · 30 a 45 días', 'pill--amber']) : v.status === 'reservado' ? ['Reservado', 'pill--amber'] : ['Disponible en el salón', ''];
    const isFav = favs().includes(v.id);
    $('#vInfo').innerHTML = '<div class="vi"><div><span class="vi__brand">' + esc(Q.brandName(v.brand)) + ' · ' + (v.cond === '0km' ? '0km ' + v.year : 'Usado ' + v.year + ' · ' + fmt.km(v.km)) + '</span><h1>' + esc(v.model) + '</h1><p class="vi__ver">' + esc(v.version) + '</p></div>' +
      '<div class="vi__price"><b>' + fmt.money(v.price) + '</b><span>' + (v.cuotaDesde ? 'Plan desde <strong>' + fmt.money(v.cuotaDesde) + '</strong>/mes · ' : '') + 'Financiado desde <strong>' + fmt.money(fin) + '</strong>/mes</span></div>' +
      '<span class="pill ' + avail[1] + '">' + avail[0] + '</span>' +
      '<div class="specs4"><div><small>Motor</small><b>' + esc(v.engine) + '</b></div><div><small>Potencia</small><b>' + v.hp + ' CV</b></div><div><small>Transmisión</small><b>' + esc(v.trans) + '</b></div><div><small>' + (v.cond === 'usado' ? 'Kilometraje' : 'Combustible') + '</small><b>' + (v.cond === 'usado' ? fmt.km(v.km) : esc(v.fuel)) + '</b></div></div>' +
      '<div class="swatches">' + v.colors.slice(0, 5).map((cl) => '<i style="background:' + hexOf(v, cl) + '" title="' + esc(cl) + '"></i>').join('') + '<span>' + esc(v.colors[0]) + (v.colors.length > 1 ? ' y ' + (v.colors.length - 1) + ' más' : '') + '</span></div>' +
      '<div class="vi__cta"><button class="btn btn--block js-cotizar" data-v="' + v.id + '">Quiero cotizar</button><div class="row"><button class="btn btn--line js-td" data-v="' + v.id + '">' + icon('key') + 'Test drive</button><button class="btn btn--line js-contact" data-v="' + v.id + '">' + icon('phone') + 'Contactar</button></div></div>' +
      '<div class="vi__links"><button class="link fav-link" aria-pressed="' + isFav + '">' + icon('heart') + '<span>' + (isFav ? 'Guardado' : 'Guardar') + '</span></button><button class="link" id="share">' + icon('arrowRight') + 'Compartir</button><button class="link" onclick="window.print()">' + icon('print') + 'Imprimir</button></div></div>';
    $('.fav-link').addEventListener('click', (e) => { const on = toggleFav(v.id); e.currentTarget.setAttribute('aria-pressed', on); $('span', e.currentTarget).textContent = on ? 'Guardado' : 'Guardar'; toast(on ? 'Guardado en favoritos' : 'Quitado de favoritos'); });
    $('#share').addEventListener('click', () => { const u = location.href; if (navigator.share) navigator.share({ title: Q.vFull(v), url: u }).catch(() => {}); else if (navigator.clipboard) navigator.clipboard.writeText(u).then(() => toast('Enlace copiado')); });
    document.addEventListener('click', (e) => { const td = e.target.closest('.js-td'); if (td) openTestDrive(td.dataset.v); });
    // acordeones
    const chev = icon('chevronDown');
    const spec = [['Marca', Q.brandName(v.brand)], ['Modelo', v.model], ['Versión', v.version], ['Año', v.year], ['Carrocería', LABELS.body[v.body]], ['Motor', v.engine], ['Potencia', v.hp + ' CV'], ['Combustible', v.fuel], ['Transmisión', v.trans], ['Tracción', v.drive || (/4x4|4WD|AWD/i.test(v.version) ? 'Integral' : 'Delantera')], ['Asientos', v.seats], ['Consumo / autonomía', v.consumo], ['Kilometraje', fmt.km(v.km)], ['Garantía', v.cond === '0km' ? '3 años o 100.000 km' : '12 meses motor y caja'], ['Fotos', ph.length], ['Código', v.id + (v.stockNo ? ' · stock ' + v.stockNo : '')]];
    $('#acc').innerHTML = '<div class="acc">' +
      '<details open><summary>Ficha técnica' + chev + '</summary><div class="acc__b">' + (v.descripcion ? '<p class="mut" style="margin-bottom:12px">' + esc(v.descripcion) + '</p>' : '') + '<dl class="specs">' + spec.map(([k, val]) => '<div><dt>' + k + '</dt><dd>' + esc(val) + '</dd></div>').join('') + '</dl></div></details>' +
      '<details><summary>Equipamiento' + chev + '</summary><div class="acc__b"><ul class="equip">' + v.equip.map((e) => '<li>' + icon('check') + esc(e) + '</li>').join('') + '</ul></div></details>' +
      '<details id="dFin"><summary>Financiación' + chev + '</summary><div class="acc__b" id="vSim"></div></details>' +
      (v.cond === '0km' && v.cuotaDesde ? '<details><summary>Plan de ahorro' + chev + '</summary><div class="acc__b"><p class="mut" style="margin-bottom:10px">' + v.plazo + ' cuotas · ' + v.pct + '% financiado · adjudicación desde la cuota 2.</p><dl class="dl">' + Fin.planTable(v).map((r) => '<dt>' + esc(r.label) + '</dt><dd>' + fmt.money(r.value) + '</dd>').join('') + '<dt>Valor móvil</dt><dd>' + fmt.money(v.price) + '</dd></dl><button class="btn btn--line btn--block js-cotizar" style="margin-top:16px" data-v="' + v.id + '" data-pago="plan">Suscribir plan</button></div></details>' : '') +
      '<details id="dIns"><summary>Seguro' + chev + '</summary><div class="acc__b" id="vIns"></div></details></div>';
    let simDone = false, insDone = false;
    $('#dFin').addEventListener('toggle', (e) => { if (e.target.open && !simDone) { simDone = true; simulator($('#vSim'), v); } });
    $('#dIns').addEventListener('toggle', (e) => { if (e.target.open && !insDone) { insDone = true; insurance($('#vIns'), v); } });
    // similares
    const sim = Q.published().filter((x) => x.id !== v.id && (x.body === v.body || x.brand === v.brand)).sort((a, b) => (b.photos ? 1 : 0) - (a.photos ? 1 : 0) || Math.abs(a.price - v.price) - Math.abs(b.price - v.price)).slice(0, 4);
    $('#similar').innerHTML = sim.map((x) => card(x)).join('');
    // barra inferior (móvil)
    const bar = document.createElement('div'); bar.className = 'vbar';
    bar.innerHTML = '<div><b>' + fmt.money(v.price) + '</b><span>' + (v.cuotaDesde ? 'o plan desde ' + fmt.moneyShort(v.cuotaDesde) + '/mes' : 'Financiado desde ' + fmt.moneyShort(fin) + '/mes') + '</span></div><button class="btn js-contact" data-v="' + v.id + '">Consultar</button>';
    document.body.appendChild(bar);
  }

  /* ========================================================== MI CUENTA */
  function account() {
    layout('');
    const root = $('#acc');
    const samples = (() => { const L = DB.data.credits.slice(0, 40).map((c) => Q.client(c.clientId)).filter(Boolean); const mora = L.find((c) => Q.clientFinance(c.id).diasMora > 0); const ok = L.find((c) => Q.clientFinance(c.id).diasMora === 0); const plan = Q.client(DB.data.savings[2].clientId); return [ok, mora, plan].filter(Boolean); })();
    const login = () => {
      root.innerHTML = '<div class="acc-login"><form class="form" id="accF"><label class="field">DNI (sin puntos)<input name="dni" required inputmode="numeric" pattern="[0-9]{7,8}" placeholder="Ej.: 30123456"></label><button class="btn btn--block">Ingresar</button>' +
        '<div class="hint"><b>Demo:</b> probá con estos DNI de ejemplo<br>' + samples.map((c) => '<button type="button" data-dni="' + c.dni + '">' + c.dni + '</button>').join('') + '</div></form></div>';
      $('#accF').addEventListener('click', (e) => { const b = e.target.closest('[data-dni]'); if (b) { $('#accF input').value = b.dataset.dni; $('#accF').requestSubmit(); } });
      $('#accF').addEventListener('submit', (e) => { e.preventDefault(); const dni = new FormData(e.target).get('dni').replace(/\D/g, ''); const c = DB.data.clients.find((x) => x.dni === dni); if (!c) { toast('No encontramos ese DNI'); return; } show(c); });
    };
    const show = (cl) => {
      const f = Q.clientFinance(cl.id), appts = DB.data.appts.filter((a) => a.clientId === cl.id && a.fecha >= iso(today()));
      const prox = f.credits.map((x) => x.st.prox).filter(Boolean).sort((a, b) => a.vto.localeCompare(b.vto))[0];
      root.innerHTML = '<div style="display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between"><div><h2 style="font-size:1.5rem">Hola, ' + esc(cl.nombre.split(' ')[0]) + '</h2><p class="mut">DNI ' + esc(cl.dni) + ' · cliente desde ' + fmt.date(cl.creado) + '</p></div><div style="display:flex;gap:8px" class="no-print"><button class="btn btn--line btn--sm" onclick="window.print()">' + icon('print') + 'Estado de cuenta</button><button class="btn btn--line btn--sm" id="accOut">Salir</button></div></div>' +
        '<div class="kpis"><div class="kpi' + (f.vencido ? ' kpi--warn' : '') + '"><small>Deuda vencida</small><b>' + fmt.money(f.vencido + f.punitorios) + '</b><span>' + (f.vencido ? f.diasMora + ' días de atraso' : 'Estás al día') + '</span></div><div class="kpi"><small>Próximo vencimiento</small><b>' + (prox ? fmt.money(prox.monto) : '—') + '</b><span>' + (prox ? fmt.dateLong(prox.vto) : 'Sin cuotas') + '</span></div><div class="kpi"><small>Saldo financiado</small><b>' + fmt.money(f.deuda) + '</b><span>' + f.credits.filter((x) => x.st.estado !== 'cancelado').length + ' crédito(s)</span></div><div class="kpi"><small>Pagos mensuales</small><b>' + fmt.money(f.cuotaMensual) + '</b><span>Cuotas + plan + seguros</span></div></div>' +
        (f.credits.length ? '<div class="box"><h3>' + icon('card') + 'Mis financiaciones</h3>' + f.credits.map((cr) => { const s = cr.st, sale = DB.get('sales', cr.saleId); return '<div style="display:grid;gap:8px;padding:12px 0;border-top:1px solid var(--line)"><div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap"><b>' + esc(sale ? sale.vehiculo : 'Crédito') + '</b><span class="st st--' + RB.TONE[s.estado] + '">' + LABELS.creditState[s.estado] + '</span></div><div class="prog"><i style="width:' + Math.round(s.avance * 100) + '%"></i></div><small class="mut">' + s.pagadas + ' de ' + s.total + ' cuotas pagas · cuota ' + fmt.money(cr.cuota) + '</small><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Cuota</th><th>Vence</th><th class="num">Monto</th><th>Estado</th></tr></thead><tbody>' + cr.cuotas.filter((q) => !q.pagada).slice(0, 3).concat(cr.cuotas.filter((q) => q.pagada).slice(-2)).sort((a, b) => a.n - b.n).map((q) => { const venc = !q.pagada && RB.parse(q.vto) < today(); return '<tr><td>' + q.n + '/' + cr.plazo + '</td><td>' + fmt.date(q.vto) + '</td><td class="num">' + fmt.money(q.monto) + '</td><td><span class="st st--' + (q.pagada ? 'ok' : venc ? 'err' : 'muted') + '">' + (q.pagada ? 'Pagada' : venc ? 'Vencida' : 'Pendiente') + '</span></td></tr>'; }).join('') + '</tbody></table></div></div>'; }).join('') + '</div>' : '') +
        (f.savings.length ? '<div class="box"><h3>' + icon('piggy') + 'Plan de ahorro</h3>' + f.savings.map((s) => '<div style="display:grid;gap:8px;padding:10px 0;border-top:1px solid var(--line)"><div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap"><b>' + esc(s.modelo) + ' · grupo ' + s.grupo + '</b><span class="st st--' + RB.TONE[s.estado] + '">' + LABELS.planState[s.estado] + '</span></div><div class="prog"><i style="width:' + Math.round(s.st.avance * 100) + '%"></i></div><small class="mut">' + s.cuotasPagadas + ' de ' + s.cuotasTotal + ' cuotas · ' + fmt.money(s.valorCuota) + '/mes' + (s.st.atrasadas && s.estado !== 'baja' ? ' · ' + s.st.atrasadas + ' atrasada(s)' : '') + '</small></div>').join('') + '</div>' : '') +
        (f.policies.length ? '<div class="box"><h3>' + icon('shield') + 'Seguros</h3><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Vehículo</th><th>Cobertura</th><th>Vence</th><th class="num">Cuota</th></tr></thead><tbody>' + f.policies.map((p) => '<tr><td>' + esc(p.vehiculo) + '</td><td>' + esc(Q.coverage(p.coverage).nombre) + '<br><small class="mut">' + esc(Q.insurer(p.insurerId).nombre) + '</small></td><td>' + fmt.date(p.vencimiento) + '</td><td class="num">' + fmt.money(p.primaMensual) + '</td></tr>').join('') + '</tbody></table></div></div>' : '') +
        '<div class="box"><h3>' + icon('calendar') + 'Próximos turnos</h3>' + (appts.length ? appts.map((a) => '<p style="padding:8px 0;border-top:1px solid var(--line)"><b>' + LABELS.apptType[a.tipo] + '</b> · ' + fmt.dateLong(a.fecha.slice(0, 10)) + ' ' + fmt.time(a.fecha) + ' h</p>').join('') : '<p class="mut">No tenés turnos. <button class="link" data-tool="taller">Pedir turno de taller' + icon('arrowRight') + '</button></p>') + '</div>';
      $('#accOut').addEventListener('click', login); window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    login();
  }

  window.Site = { home, catalog, detail, account, openLead, toast };
})();
