/* =========================================================================
   Rumbo Automotores — núcleo compartido (sitio público + administración)
   Datos demo, persistencia en localStorage y cálculos financieros.
   ========================================================================= */
(function (global) {
  'use strict';

  /* ---------------------------------------------------------------- CONFIG */
  const CONFIG = {
    name: 'Rumbo Automotores',
    short: 'Rumbo',
    tagline: 'Tu próximo 0km, con la cuota que buscás',
    phone: '011 4000-2026',
    phoneHref: '+541140002026',
    servicePhone: '011 4000-2027',
    whatsapp: '5491140002026',
    email: 'ventas@rumbo.demo',
    address: 'Av. del Libertador 4200, Vicente López, Buenos Aires',
    hours: [
      ['Lunes a viernes', '9:00 a 19:00'],
      ['Sábados', '9:00 a 14:00'],
      ['Domingos', 'Cerrado']
    ],
    tna: 39.9,          // TNA crédito prendario estándar
    tnaPromo: 0,        // tasa promocional (modelos seleccionados, 12 meses)
    punitorioDiario: 0.15, // % diario sobre monto vencido
    gastosOtorgamiento: 3, // % sobre capital
    patentamiento: 4.5  // % sobre precio (estimado)
  };

  /* --------------------------------------------------------------- HELPERS */
  const pad = (n, l) => String(n).padStart(l, '0');
  const money = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
  const num = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 });
  const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const MONTHS_L = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const DAYS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

  const fmt = {
    money: (v) => money.format(Math.round(v || 0)).replace(/ /g, ' '),
    moneyShort(v) {
      const a = Math.abs(v || 0), s = v < 0 ? '-' : '';
      if (a >= 1e9) return s + '$ ' + (a / 1e9).toFixed(1).replace('.', ',') + ' MM';
      if (a >= 1e6) return s + '$ ' + (a / 1e6).toFixed(1).replace('.', ',') + ' M';
      if (a >= 1e3) return s + '$ ' + Math.round(a / 1e3) + ' k';
      return fmt.money(v);
    },
    num: (v) => num.format(Math.round(v || 0)),
    pct: (v, d = 1) => (v || 0).toFixed(d).replace('.', ',') + '%',
    date(iso) { if (!iso) return '—'; const d = parse(iso); return pad(d.getDate(), 2) + '/' + pad(d.getMonth() + 1, 2) + '/' + d.getFullYear(); },
    dateShort(iso) { if (!iso) return '—'; const d = parse(iso); return d.getDate() + ' ' + MONTHS[d.getMonth()]; },
    dateLong(iso) { const d = parse(iso); return DAYS[d.getDay()] + ' ' + d.getDate() + ' de ' + MONTHS_L[d.getMonth()]; },
    time(iso) { const d = new Date(iso); return pad(d.getHours(), 2) + ':' + pad(d.getMinutes(), 2); },
    dateTime(iso) { return fmt.date(iso) + ' ' + fmt.time(iso); },
    month(i) { return MONTHS[i]; },
    monthLong(i) { return MONTHS_L[i]; },
    ago(iso) {
      const diff = (Date.now() - new Date(iso).getTime()) / 1000;
      if (diff < 60) return 'recién';
      if (diff < 3600) return 'hace ' + Math.floor(diff / 60) + ' min';
      if (diff < 86400) return 'hace ' + Math.floor(diff / 3600) + ' h';
      const d = Math.floor(diff / 86400);
      if (d < 30) return 'hace ' + d + (d === 1 ? ' día' : ' días');
      const m = Math.floor(d / 30);
      return 'hace ' + m + (m === 1 ? ' mes' : ' meses');
    },
    km: (v) => num.format(v || 0) + ' km',
    phone: (v) => v || '—',
    initials: (s) => (s || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
  };

  function parse(iso) {
    if (iso instanceof Date) return new Date(iso);
    if (typeof iso === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(iso)) { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); }
    return new Date(iso);
  }
  function iso(d) { d = parse(d); return d.getFullYear() + '-' + pad(d.getMonth() + 1, 2) + '-' + pad(d.getDate(), 2); }
  function isoDT(d) { d = parse(d); return iso(d) + 'T' + pad(d.getHours(), 2) + ':' + pad(d.getMinutes(), 2) + ':00'; }
  function today() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }
  function addDays(d, n) { const x = parse(d); x.setDate(x.getDate() + n); return x; }
  function addMonths(d, n) { const x = parse(d); const day = x.getDate(); x.setDate(1); x.setMonth(x.getMonth() + n); x.setDate(Math.min(day, new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate())); return x; }
  function daysBetween(a, b) { return Math.round((parse(b).setHours(0, 0, 0, 0) - parse(a).setHours(0, 0, 0, 0)) / 86400000); }
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const slug = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const round = (v, step = 1000) => Math.round(v / step) * step;
  const sum = (arr, fn) => arr.reduce((a, x) => a + (fn ? fn(x) : x), 0);
  const groupBy = (arr, fn) => arr.reduce((m, x) => { const k = fn(x); (m[k] = m[k] || []).push(x); return m; }, {});
  const waLink = (phone, text) => 'https://wa.me/' + String(phone || '').replace(/\D/g, '') + (text ? '?text=' + encodeURIComponent(text) : '');

  /* deterministic RNG (mulberry32) */
  function rng(seed) {
    let a = seed >>> 0;
    const r = () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    r.int = (min, max) => Math.floor(r() * (max - min + 1)) + min;
    r.pick = (arr) => arr[Math.floor(r() * arr.length)];
    r.weighted = (pairs) => { const tot = sum(pairs, (p) => p[1]); let x = r() * tot; for (const [v, w] of pairs) { if ((x -= w) <= 0) return v; } return pairs[pairs.length - 1][0]; };
    r.chance = (p) => r() < p;
    return r;
  }

  /* ---------------------------------------------------------------- LABELS */
  const LABELS = {
    body: { hatchback: 'Hatchback', sedan: 'Sedán', suv: 'SUV / Crossover', pickup: 'Pick-up', utilitario: 'Utilitario' },
    leadStage: { nuevo: 'Nuevo', contactado: 'Contactado', test_drive: 'Test drive', negociacion: 'Negociación', ganado: 'Ganado', perdido: 'Perdido' },
    leadStageOrder: ['nuevo', 'contactado', 'test_drive', 'negociacion', 'ganado', 'perdido'],
    payment: { contado: 'Contado', financiado: 'Financiado', plan: 'Plan de ahorro', permuta: 'Usado + financiación' },
    saleState: { reservada: 'Reservada', en_gestion: 'En gestión', facturada: 'Facturada', entregada: 'Entregada', anulada: 'Anulada' },
    vehicleState: { disponible: 'Disponible', reservado: 'Reservado', vendido: 'Vendido', en_transito: 'En tránsito' },
    creditState: { al_dia: 'Al día', en_mora: 'En mora', cancelado: 'Cancelado' },
    policyState: { vigente: 'Vigente', por_vencer: 'Por vencer', vencida: 'Vencida', cancelada: 'Cancelada' },
    planState: { ahorrando: 'Ahorrando', adjudicado: 'Adjudicado', entregado: 'Entregado', baja: 'Baja' },
    apptType: { test_drive: 'Test drive', service: 'Service / taller', entrega: 'Entrega 0km', tasacion: 'Tasación', reunion: 'Reunión' },
    apptState: { pendiente: 'Pendiente', confirmado: 'Confirmado', realizado: 'Realizado', cancelado: 'Cancelado' },
    woState: { recibido: 'Recibido', en_proceso: 'En proceso', repuestos: 'Esperando repuestos', listo: 'Listo para retirar', entregado: 'Entregado' },
    tradeState: { pendiente: 'Pendiente', tasado: 'Tasado', aceptado: 'Aceptado', rechazado: 'Rechazado' },
    activity: { llamada: 'Llamada', whatsapp: 'WhatsApp', email: 'Email', visita: 'Visita al salón', nota: 'Nota', test_drive: 'Test drive', presupuesto: 'Presupuesto enviado' },
    coverage: { RC: 'Responsabilidad Civil', TC: 'Terceros Completo', TCP: 'Terceros Completo Premium', TR: 'Todo Riesgo' }
  };
  const TONE = { // color semántico por estado
    nuevo: 'info', contactado: 'violet', test_drive: 'amber', negociacion: 'orange', ganado: 'ok', perdido: 'muted',
    reservada: 'amber', en_gestion: 'info', facturada: 'violet', entregada: 'ok', anulada: 'muted',
    disponible: 'ok', reservado: 'amber', vendido: 'muted', en_transito: 'info',
    al_dia: 'ok', en_mora: 'err', cancelado: 'muted',
    vigente: 'ok', por_vencer: 'amber', vencida: 'err', cancelada: 'muted',
    ahorrando: 'info', adjudicado: 'amber', entregado: 'ok', baja: 'muted',
    pendiente: 'amber', confirmado: 'info', realizado: 'ok',
    recibido: 'info', en_proceso: 'violet', repuestos: 'amber', listo: 'ok',
    tasado: 'violet', aceptado: 'ok', rechazado: 'muted'
  };

  /* ---------------------------------------------------------------- CATALOG */
  const BRANDS = [
    { id: 'chevrolet', name: 'Chevrolet' }, { id: 'toyota', name: 'Toyota' }, { id: 'volkswagen', name: 'Volkswagen' },
    { id: 'renault', name: 'Renault' }, { id: 'peugeot', name: 'Peugeot' }, { id: 'citroen', name: 'Citroën' }, { id: 'nissan', name: 'Nissan' }
  ];
  const IMG = 'assets/img/cars/';
  const BAN = 'assets/img/banners/';
  // [brand, model, version, body, fuel, trans, engine, hp, seats, price, cuotaDesde, plazo, pct, img, tags]
  const MODELS = [
    ['chevrolet', 'Onix', '1.0 LT MT', 'hatchback', 'Nafta', 'Manual', '1.0 12v', 82, 5, 31990000, 265000, 120, 80, IMG + 'chevrolet-onix.webp', ['Tasa 0%', 'Más vendido']],
    ['chevrolet', 'Onix Plus', '1.0 Turbo LTZ AT', 'sedan', 'Nafta', 'Automática', '1.0 Turbo', 116, 5, 36490000, 455000, 84, 100, IMG + 'chevrolet-onixplus.webp', ['Entrega pactada']],
    ['chevrolet', 'Tracker', '1.2 Turbo LTZ AT', 'suv', 'Nafta', 'Automática', '1.2 Turbo', 132, 5, 41990000, 341000, 120, 80, IMG + 'chevrolet-tracker.webp', ['Tasa 0%']],
    ['chevrolet', 'Montana', '1.2 Turbo LTZ AT', 'pickup', 'Nafta', 'Automática', '1.2 Turbo', 132, 5, 40990000, 347000, 120, 80, IMG + 'chevrolet-montana.webp', ['Entregas programadas']],
    ['chevrolet', 'Sonic', '1.0 Turbo RS AT', 'suv', 'Nafta', 'Automática', '1.0 Turbo', 116, 5, 38990000, 548000, 84, 100, IMG + 'chevrolet-sonic.webp', ['Nuevo', 'Entrega pactada']],
    ['chevrolet', 'S10', '2.8 TD 4x4 High Country AT', 'pickup', 'Diésel', 'Automática', '2.8 Turbodiésel', 207, 5, 62990000, 675000, 84, 100, IMG + 'chevrolet-s10.webp', ['Adjudicación pactada']],
    ['chevrolet', 'Spin', '1.8 LTZ AT 7 asientos', 'utilitario', 'Nafta', 'Automática', '1.8 8v', 111, 7, 37990000, 389000, 84, 100, BAN + 'chevrolet-spin-720.webp', ['7 asientos']],
    ['chevrolet', 'Captiva', 'PHEV Premier', 'suv', 'Híbrido enchufable', 'Automática', '1.5 + eléctrico', 204, 5, 54990000, 512000, 84, 100, BAN + 'chevrolet-captiva-720.webp', ['Híbrido', 'Nuevo']],
    ['toyota', 'Yaris', '1.5 XS CVT 5P', 'hatchback', 'Nafta', 'CVT', '1.5 16v', 107, 5, 32990000, 299998, 84, 70, IMG + 'toyota-yaris.webp', []],
    ['toyota', 'Yaris Cross', '1.5 HEV XLI eCVT', 'suv', 'Híbrido', 'Automática', '1.5 Híbrido', 116, 5, 40990000, 465393, 84, 100, IMG + 'toyota-yariscross.webp', ['Híbrido']],
    ['toyota', 'Corolla', '2.0 XEI CVT', 'sedan', 'Nafta', 'CVT', '2.0 16v', 170, 5, 45990000, 494777, 84, 100, IMG + 'toyota-corolla.webp', []],
    ['toyota', 'Corolla Cross', '1.8 HEV XEI eCVT', 'suv', 'Híbrido', 'Automática', '1.8 Híbrido', 122, 5, 49990000, 465407, 84, 100, IMG + 'toyota-corollacross.webp', ['Híbrido', 'Más vendido']],
    ['toyota', 'Hilux', '2.4 TDI DX 4x2', 'pickup', 'Diésel', 'Manual', '2.4 Turbodiésel', 150, 5, 49990000, 414400, 84, 70, IMG + 'toyota-hilux.webp', ['Más vendido']],
    ['toyota', 'Hilux 4x4', '2.8 TDI SRX 4x4 AT', 'pickup', 'Diésel', 'Automática', '2.8 Turbodiésel', 204, 5, 78990000, 558824, 84, 70, IMG + 'toyota-hilux.webp', ['4x4']],
    ['toyota', 'Hiace', 'Furgón 2.8 TDI L2H2', 'utilitario', 'Diésel', 'Manual', '2.8 Turbodiésel', 177, 3, 72990000, 678281, 84, 70, IMG + 'toyota-hiace.webp', []],
    ['volkswagen', 'Polo Track', '1.6 MSI', 'hatchback', 'Nafta', 'Manual', '1.6 16v', 110, 5, 27990000, 375668, 84, 100, IMG + 'volkswagen-polo.webp', []],
    ['volkswagen', 'Virtus', '1.0 TSI Highline AT', 'sedan', 'Nafta', 'Automática', '1.0 TSI', 116, 5, 37990000, 437485, 84, 100, IMG + 'volkswagen-virtus.webp', []],
    ['volkswagen', 'Nivus', '1.0 TSI Highline AT', 'suv', 'Nafta', 'Automática', '1.0 TSI', 116, 5, 40490000, 432577, 84, 100, IMG + 'volkswagen-nivus.webp', []],
    ['volkswagen', 'T-Cross', '1.0 TSI Comfortline AT', 'suv', 'Nafta', 'Automática', '1.0 TSI', 116, 5, 40990000, 492805, 84, 100, IMG + 'volkswagen-tcross.webp', []],
    ['volkswagen', 'Tera', '1.0 MPI Trend', 'suv', 'Nafta', 'Manual', '1.0 MPI', 84, 5, 30990000, 477727, 84, 100, IMG + 'volkswagen-tera.webp', ['Nuevo']],
    ['volkswagen', 'Amarok', 'V6 Highline 4x4 AT', 'pickup', 'Diésel', 'Automática', '3.0 V6 TDI', 258, 5, 79990000, 651945, 84, 70, IMG + 'volkswagen-amarok.webp', ['4x4']],
    ['renault', 'Kwid', '1.0 Zen', 'hatchback', 'Nafta', 'Manual', '1.0 SCe', 66, 5, 22990000, 265356, 120, 80, IMG + 'renault-kwid.webp', ['Precio más bajo']],
    ['renault', 'Kardian', '1.0 Turbo Evolution', 'suv', 'Nafta', 'Manual', '1.0 TCe', 120, 5, 31490000, 340800, 84, 100, IMG + 'renault-kardian.webp', []],
    ['renault', 'Kangoo Express', '1.6 SCe Confort', 'utilitario', 'Nafta', 'Manual', '1.6 SCe', 114, 2, 29990000, 343465, 84, 100, IMG + 'renault-kangoo.webp', []],
    ['renault', 'Kangoo Stepway', '1.6 SCe 5 asientos', 'utilitario', 'Nafta', 'Manual', '1.6 SCe', 114, 5, 36990000, 413510, 84, 100, IMG + 'renault-kangoo-stepway.webp', []],
    ['renault', 'Oroch', '1.3 Turbo Outsider 4x4', 'pickup', 'Nafta', 'Manual', '1.3 TCe', 163, 5, 40990000, 530060, 84, 100, IMG + 'renault-duster-oroch.webp', []],
    ['renault', 'Boreal', '1.3 Turbo Techno EDC', 'suv', 'Nafta', 'Automática', '1.3 TCe', 163, 5, 46990000, 554500, 84, 100, IMG + 'renault-boreal.webp', ['Nuevo']],
    ['renault', 'Master', 'Furgón 2.3 dCi L2H2', 'utilitario', 'Diésel', 'Manual', '2.3 dCi', 136, 3, 64990000, 748078, 84, 70, IMG + 'renault-master.webp', []],
    ['peugeot', '208', '1.6 Active', 'hatchback', 'Nafta', 'Manual', '1.6 16v', 115, 5, 28990000, 390000, 84, 100, IMG + 'peugeot-208.webp', ['Tasa 0%']],
    ['peugeot', '2008', '1.0 Turbo Allure AT', 'suv', 'Nafta', 'Automática', '1.0 T200', 120, 5, 38490000, 604000, 84, 100, IMG + 'peugeot-2008.webp', []],
    ['peugeot', 'Partner Rapid', '1.4 Confort', 'utilitario', 'Nafta', 'Manual', '1.4 8v', 85, 2, 25990000, 460000, 84, 100, IMG + 'peugeot-partner-rapid.webp', []],
    ['peugeot', 'Partner Van', '1.6 HDi Confort', 'utilitario', 'Diésel', 'Manual', '1.6 HDi', 92, 2, 34990000, 595000, 84, 100, IMG + 'peugeot-partner-van.webp', []],
    ['peugeot', 'Expert', '1.6 HDi Furgón L3', 'utilitario', 'Diésel', 'Manual', '1.6 BlueHDi', 116, 3, 49990000, 604000, 84, 100, IMG + 'peugeot-expert.webp', []],
    ['citroen', 'C3', '1.6 Feel', 'hatchback', 'Nafta', 'Manual', '1.6 VTi', 115, 5, 26490000, 258000, 84, 70, IMG + 'citroen-c3.webp', ['Cuota más baja']],
    ['citroen', 'Basalt', '1.0 Turbo Shine CVT', 'suv', 'Nafta', 'CVT', '1.0 T200', 120, 5, 31990000, 486000, 84, 100, IMG + 'citroen-basalt.webp', []],
    ['citroen', 'C3 Aircross', '1.0 Turbo Feel 7 asientos', 'suv', 'Nafta', 'CVT', '1.0 T200', 120, 7, 34490000, 548000, 84, 100, IMG + 'citroen-c3-aircross.webp', ['7 asientos']],
    ['citroen', 'Berlingo Van', '1.6 HDi Business', 'utilitario', 'Diésel', 'Manual', '1.6 HDi', 92, 2, 33990000, 486000, 84, 100, IMG + 'citroen-berlingo-van.webp', []],
    ['nissan', 'Versa', '1.6 Sense MT', 'sedan', 'Nafta', 'Manual', '1.6 16v', 118, 5, 32490000, 262053, 84, 70, IMG + 'nissan-versasense.webp', []],
    ['nissan', 'Kait', '1.6 Advance CVT', 'suv', 'Nafta', 'CVT', '1.6 16v', 118, 5, 36990000, 347370, 84, 80, IMG + 'nissan-kait.webp', ['Nuevo']],
    ['nissan', 'Frontier', '2.3 TD LE 4x4 AT', 'pickup', 'Diésel', 'Automática', '2.3 Biturbo diésel', 190, 5, 61490000, 354971, 84, 70, IMG + 'nissan-frontier.webp', ['4x4']]
  ];

  // banners adicionales por modelo (galería de modelos sin fotos de stock)
  const GALLERY = {
    'chevrolet|Onix': ['assets/img/banners/chevrolet-onix-1080.webp'],
    'chevrolet|Onix Plus': ['assets/img/banners/chevrolet-hero-onix-plus-1080.webp', 'assets/img/banners/chevrolet-onix-plus-678.webp'],
    'chevrolet|S10': ['assets/img/banners/chevrolet-hero-s10-1080.webp', 'assets/img/banners/chevrolet-s10-720.webp'],
    'chevrolet|Montana': ['assets/img/banners/chevrolet-hero-montana-960.webp'],
    'chevrolet|Sonic': ['assets/img/banners/chevrolet-hero-sonic-1080.webp'],
    'chevrolet|Tracker': ['assets/img/banners/chevrolet-tracker-720.webp']
  };
  const EQUIP = {
    base: ['ABS con EBD', 'Control de estabilidad (ESP)', 'Airbags frontales y laterales', 'Pantalla táctil con Apple CarPlay y Android Auto', 'Sensor de estacionamiento trasero', 'Aire acondicionado', 'Levantacristales eléctricos', 'Anclajes ISOFIX'],
    plus: ['Cámara de retroceso', 'Control de crucero', 'Llantas de aleación', 'Faros LED', 'Arranque sin llave', 'Cargador inalámbrico'],
    top: ['Climatizador automático', 'Asistente de frenado autónomo', 'Alerta de punto ciego', 'Tapizado símil cuero', 'Techo panorámico', '6 airbags'],
    pickup: ['Tracción 4x4 con reductora', 'Control de descenso', 'Gancho de remolque', 'Protector de caja'],
    util: ['Puerta lateral corrediza', 'Separador de carga', 'Capacidad de carga ampliada']
  };
  const COLORS = ['Blanco', 'Gris plata', 'Negro', 'Gris oscuro', 'Rojo', 'Azul'];

  /* ----------------------------------------------------------------- FINANZAS */
  const Fin = {
    cuota(capital, tna, n) {
      if (!capital || !n) return 0;
      const i = tna / 100 / 12;
      if (i === 0) return capital / n;
      return capital * i / (1 - Math.pow(1 + i, -n));
    },
    schedule(capital, tna, n, start) {
      const c = Fin.cuota(capital, tna, n), i = tna / 100 / 12; let saldo = capital; const rows = [];
      for (let k = 1; k <= n; k++) {
        const interes = saldo * i, amort = c - interes; saldo = Math.max(0, saldo - amort);
        rows.push({ n: k, vto: iso(addMonths(start, k)), monto: Math.round(c), capital: Math.round(amort), interes: Math.round(interes), saldo: Math.round(saldo), pagada: false, fechaPago: null });
      }
      return rows;
    },
    creditStatus(cr, ref = today()) {
      const cuotas = cr.cuotas || [];
      const pagadas = cuotas.filter((c) => c.pagada);
      const impagas = cuotas.filter((c) => !c.pagada);
      const vencidas = impagas.filter((c) => parse(c.vto) < ref);
      const montoVencido = sum(vencidas, (c) => c.monto);
      const diasMora = vencidas.length ? daysBetween(vencidas[0].vto, ref) : 0;
      const punitorios = sum(vencidas, (c) => c.monto * CONFIG.punitorioDiario / 100 * daysBetween(c.vto, ref));
      const saldoCapital = impagas.length ? (impagas[0].saldo + impagas[0].capital) : 0;
      const saldoTotal = sum(impagas, (c) => c.monto);
      const prox = impagas.find((c) => parse(c.vto) >= ref) || null;
      const atrasosHist = pagadas.filter((c) => c.fechaPago && daysBetween(c.vto, c.fechaPago) > 5).length;
      const estado = !impagas.length ? 'cancelado' : vencidas.length ? 'en_mora' : 'al_dia';
      return { pagadas: pagadas.length, impagas: impagas.length, vencidas: vencidas.length, montoVencido, diasMora, punitorios, saldoCapital, saldoTotal, prox, estado, atrasosHist, total: cuotas.length, avance: cuotas.length ? pagadas.length / cuotas.length : 0 };
    },
    aging(dias) { return dias <= 0 ? null : dias <= 30 ? '1-30' : dias <= 60 ? '31-60' : dias <= 90 ? '61-90' : '+90'; },
    policyState(p, ref = today()) {
      if (p.estado === 'cancelada') return 'cancelada';
      const d = daysBetween(ref, p.vencimiento);
      return d < 0 ? 'vencida' : d <= 30 ? 'por_vencer' : 'vigente';
    },
    // prima mensual estimada por aseguradora y cobertura
    quote(value, year, plan, insurer) {
      const age = Math.max(0, today().getFullYear() - (year || today().getFullYear()));
      const ageF = 1 - Math.min(age, 10) * 0.035;
      const base = plan.tipo === 'RC' ? plan.fijo : value * plan.tasa / 100 * ageF;
      return round(base * (insurer ? insurer.factor : 1), 100);
    },
    planTable(v) {
      const c1 = v.cuotaDesde;
      return [
        { label: 'Cuota 1 (suscripción)', value: c1 },
        { label: 'Cuotas 2 a 12', value: round(c1 * 1.06, 100) },
        { label: 'Cuotas 13 a ' + v.plazo, value: round(c1 * 1.12, 100) }
      ];
    },
    savingsStatus(p, ref = today()) {
      const esperadas = Math.min(p.cuotasTotal, Math.max(1, Math.floor(daysBetween(p.alta, ref) / 30.4) + 1));
      const atrasadas = Math.max(0, esperadas - p.cuotasPagadas);
      return { esperadas, atrasadas, avance: p.cuotasPagadas / p.cuotasTotal, restante: (p.cuotasTotal - p.cuotasPagadas) * p.valorCuota };
    }
  };

  /* ------------------------------------------------------------------- SEED */
  const FIRST = ['Martín', 'Lucía', 'Diego', 'Sofía', 'Nicolás', 'Valentina', 'Juan Pablo', 'Camila', 'Federico', 'Agustina', 'Matías', 'Florencia', 'Gonzalo', 'Micaela', 'Santiago', 'Julieta', 'Facundo', 'Carolina', 'Ezequiel', 'Romina', 'Leandro', 'Paula', 'Hernán', 'Natalia', 'Sebastián', 'Mariana', 'Alejandro', 'Daniela', 'Germán', 'Verónica', 'Rodrigo', 'Silvina', 'Marcelo', 'Gabriela', 'Ignacio', 'Lorena', 'Cristian', 'Andrea', 'Pablo', 'Melina', 'Ramiro', 'Belén', 'Tomás', 'Eugenia', 'Emiliano', 'Victoria', 'Lucas', 'Noelia'];
  const LAST = ['González', 'Rodríguez', 'Gómez', 'Fernández', 'López', 'Díaz', 'Martínez', 'Pérez', 'García', 'Sánchez', 'Romero', 'Sosa', 'Álvarez', 'Torres', 'Ruiz', 'Ramírez', 'Flores', 'Acosta', 'Benítez', 'Medina', 'Herrera', 'Suárez', 'Aguirre', 'Giménez', 'Molina', 'Silva', 'Castro', 'Rojas', 'Ortiz', 'Núñez', 'Luna', 'Juárez', 'Cabrera', 'Ríos', 'Ferreyra', 'Godoy', 'Morales', 'Domínguez', 'Moreno', 'Peralta', 'Vega', 'Carrizo', 'Quiroga', 'Castillo', 'Ledesma', 'Muñoz', 'Ojeda', 'Ponce'];
  const CITIES = [['Vicente López', 'Buenos Aires'], ['San Isidro', 'Buenos Aires'], ['Tigre', 'Buenos Aires'], ['Pilar', 'Buenos Aires'], ['Olivos', 'Buenos Aires'], ['CABA', 'Ciudad de Buenos Aires'], ['CABA', 'Ciudad de Buenos Aires'], ['San Martín', 'Buenos Aires'], ['Morón', 'Buenos Aires'], ['Quilmes', 'Buenos Aires'], ['La Plata', 'Buenos Aires'], ['Escobar', 'Buenos Aires'], ['Rosario', 'Santa Fe'], ['Córdoba', 'Córdoba'], ['Mar del Plata', 'Buenos Aires']];
  const JOBS = [['Empleado/a en relación de dependencia', 1], ['Comerciante', 1], ['Profesional independiente', 1], ['Docente', 1], ['Empleado/a público/a', 1], ['Monotributista', 1], ['Médico/a', 0.4], ['Ingeniero/a', 0.5], ['Contador/a', 0.5], ['Transportista', 0.6], ['Jubilado/a', 0.4]];
  const EMPLOYERS = ['Mercado Libre', 'Banco Galicia', 'Techint', 'Arcor', 'Gobierno CABA', 'Hospital Austral', 'Coto CICSA', 'Despegar', 'Telecom', 'Ternium', 'Propio', 'Propio', 'Molinos Río de la Plata', 'Unilever', 'Ministerio de Educación'];
  const ORIGINS = [['Web', 30], ['WhatsApp', 22], ['Instagram', 14], ['Facebook', 8], ['Salón', 12], ['Referido', 8], ['Mercado Libre', 6]];

  const TEAM = [
    { id: 'U1', nombre: 'Martín Gómez', rol: 'Gerente comercial', email: 'martin@rumbo.demo', tel: '11 5555-0101', objetivo: 0, comision: 0.6, color: '#14171c' },
    { id: 'U2', nombre: 'Lucía Fernández', rol: 'Asesora comercial', email: 'lucia@rumbo.demo', tel: '11 5555-0102', objetivo: 6, comision: 1.2, color: '#cd9834' },
    { id: 'U3', nombre: 'Diego Romero', rol: 'Asesor comercial', email: 'diego@rumbo.demo', tel: '11 5555-0103', objetivo: 6, comision: 1.2, color: '#2a6fdb' },
    { id: 'U4', nombre: 'Sofía Herrera', rol: 'Asesora comercial', email: 'sofia@rumbo.demo', tel: '11 5555-0104', objetivo: 5, comision: 1.2, color: '#1b7f3b' },
    { id: 'U5', nombre: 'Nicolás Acosta', rol: 'Asesor de usados', email: 'nicolas@rumbo.demo', tel: '11 5555-0105', objetivo: 4, comision: 1.5, color: '#8e44ad' },
    { id: 'U6', nombre: 'Carla Benítez', rol: 'Administración y créditos', email: 'carla@rumbo.demo', tel: '11 5555-0106', objetivo: 0, comision: 0, color: '#c0392b' },
    { id: 'U7', nombre: 'Pablo Medina', rol: 'Productor de seguros', email: 'pablo@rumbo.demo', tel: '11 5555-0107', objetivo: 0, comision: 0, color: '#16a085' },
    { id: 'U8', nombre: 'Javier Sosa', rol: 'Jefe de taller', email: 'javier@rumbo.demo', tel: '11 5555-0108', objetivo: 0, comision: 0, color: '#7f8c8d' }
  ];
  const SELLERS = ['U2', 'U3', 'U4', 'U5'];

  const INSURERS = [
    { id: 'I1', nombre: 'Escudo Seguros', color: '#1f4e9c', factor: 1.0, comision: 18, rating: 4.6, asistencia: '0800-222-3726' },
    { id: 'I2', nombre: 'Andina Seguros', color: '#b8862a', factor: 0.94, comision: 16, rating: 4.4, asistencia: '0800-333-2634' },
    { id: 'I3', nombre: 'Federal Protección', color: '#1b7f3b', factor: 1.07, comision: 20, rating: 4.7, asistencia: '0800-444-3337' },
    { id: 'I4', nombre: 'Ruta Segura', color: '#c0392b', factor: 0.9, comision: 15, rating: 4.2, asistencia: '0800-555-7888' },
    { id: 'I5', nombre: 'Patagonia Seguros', color: '#2c3e50', factor: 1.02, comision: 17, rating: 4.5, asistencia: '0800-666-7282' }
  ];
  const COVERAGES = [
    { id: 'RC', tipo: 'RC', nombre: 'Responsabilidad Civil', tasa: 0, fijo: 32000, franquicia: 0, beneficios: ['Responsabilidad civil hasta $ 400 M', 'Asistencia mecánica 24 h', 'Remolque hasta 100 km'] },
    { id: 'TC', tipo: 'TC', nombre: 'Terceros Completo', tasa: 0.28, fijo: 0, franquicia: 0, beneficios: ['Todo lo de RC', 'Robo e incendio total y parcial', 'Destrucción total por accidente', 'Rotura de cristales'] },
    { id: 'TCP', tipo: 'TCP', nombre: 'Terceros Completo Premium', tasa: 0.36, fijo: 0, franquicia: 0, beneficios: ['Todo lo de Terceros Completo', 'Granizo e inundación', 'Cerraduras y cristales sin límite', 'Auto sustituto 10 días'] },
    { id: 'TR', tipo: 'TR', nombre: 'Todo Riesgo', tasa: 0.55, fijo: 0, franquicia: 2.5, beneficios: ['Cobertura total de daños', 'Franquicia 2,5% de la suma asegurada', 'Auto sustituto 15 días', 'Cobertura en países limítrofes'] }
  ];

  function buildVehicles(R) {
    const t = today();
    const list = MODELS.map((m, i) => {
      const [brand, model, version, body, fuel, trans, engine, hp, seats, price, cuotaDesde, plazo, pct, img, tags] = m;
      const equip = [...EQUIP.base, ...(price > 33e6 ? EQUIP.plus : EQUIP.plus.slice(0, 2)), ...(price > 45e6 ? EQUIP.top : []), ...(body === 'pickup' && /4x4/i.test(version) ? EQUIP.pickup : []), ...(body === 'utilitario' && seats <= 3 ? EQUIP.util : [])];
      return {
        id: 'V' + pad(i + 1, 3), cond: '0km', brand, model, version, body, fuel, trans, engine, hp, seats, year: 2026, km: 0,
        price, cost: round(price * R.weighted([[0.82, 1], [0.83, 1], [0.84, 1]]), 10000), cuotaDesde, plazo, pct, img, tags,
        stock: R.weighted([[0, 1], [1, 2], [2, 3], [3, 3], [4, 2], [6, 1], [8, 1]]), status: 'disponible',
        colors: COLORS.slice(0, R.int(3, 6)), equip, consumo: (fuel.startsWith('H') ? R.int(18, 22) : body === 'pickup' || body === 'utilitario' ? R.int(9, 12) : R.int(12, 16)) + ' km/l',
        featured: tags.includes('Más vendido') || tags.includes('Nuevo') || tags.includes('Tasa 0%'), published: true,
        promoTasa0: tags.includes('Tasa 0%'), ingreso: iso(addDays(t, -R.int(5, 120))), patente: '', descripcion: ''
      };
    });
    // unidades con galería de fotos reales (assets/js/stock.js)
    const ST = global.RB_STOCK || [];
    const extraEquip = (s) => s.fuel === 'Eléctrico' ? ['Carga rápida en corriente continua', 'Freno regenerativo', 'Climatización remota por app'] : s.fuel.startsWith('Híbrido') ? ['Sistema híbrido autorrecargable', 'Modo EV 100% eléctrico'] : [];
    const stockVehicle = (s) => {
      const price = round(s.usd * (s.cond === '0km' ? 1750 : 1500), 50000), pct = price > 70e6 ? 60 : 80;
      const equip = [...EQUIP.base, ...EQUIP.plus, ...(price > 45e6 ? EQUIP.top : []), ...(s.body === 'pickup' ? EQUIP.pickup : []), ...extraEquip(s)];
      return {
        id: 'V' + pad(list.length + 1, 3), cond: s.cond, brand: s.brand, model: s.model, version: s.version, body: s.body, fuel: s.fuel, trans: s.trans, engine: s.engine, hp: s.hp, seats: s.seats,
        year: s.year, km: s.km, price, cost: round(price * 0.84, 50000), cuotaDesde: s.cond === '0km' ? round(price * pct / 100 / 84 * 0.92, 1000) : 0, plazo: 84, pct,
        img: s.dir + '01-t.jpg', photos: { dir: s.dir, n: s.n }, tags: s.tags.slice(), stock: s.cond === '0km' ? R.int(1, 3) : 1, status: 'disponible',
        colors: [s.color], colorHex: { [s.color]: s.hex }, equip, drive: s.drive,
        consumo: s.fuel === 'Eléctrico' ? R.int(380, 460) + ' km de autonomía' : (s.fuel.startsWith('Híbrido') ? R.int(18, 23) : R.int(8, 12)) + ' km/l',
        featured: true, published: true, promoTasa0: false, ingreso: iso(addDays(t, -R.int(3, 60))), patente: '', stockNo: s.stockNo,
        descripcion: s.cond === 'usado' ? 'Unidad peritada en 120 puntos, con informe de dominio, verificación policial y service al día. Fotos reales de la unidad.' : 'Unidad en stock, fotos reales. Consultá colores y fecha de entrega.'
      };
    };
    ST.filter((s) => s.cond === '0km').forEach((s) => {
      const ex = list.find((v) => v.cond === '0km' && v.brand === s.brand && v.model === s.model);
      if (ex) { ex.photos = { dir: s.dir, n: s.n }; ex.img = s.dir + '01-t.jpg'; ex.colors = [s.color].concat(ex.colors).slice(0, 5); ex.colorHex = { [s.color]: s.hex }; ex.featured = true; return; }
      list.push(stockVehicle(s));
    });
    // usados seleccionados
    const USED = [
      [0, 2022, 38000], [2, 2023, 21000], [11, 2023, 30500], [12, 2021, 87000], [16, 2022, 41000], [18, 2021, 56000], [21, 2023, 18000],
      [28, 2022, 33000], [29, 2023, 26000], [5, 2020, 112000], [10, 2021, 64000], [20, 2019, 129000], [17, 2023, 22000], [26, 2024, 9800],
      [38, 2022, 47000], [33, 2021, 52000], [1, 2024, 14000], [13, 2022, 76000], [3, 2024, 12500], [8, 2022, 39000], [24, 2023, 28000], [15, 2021, 68000]
    ];
    const letters = 'ABCDEFGHJKLMNPRSTUVWXYZ';
    USED.forEach(([mi, year, km], k) => {
      const b = list[mi];
      const dep = Math.pow(0.9, 2026 - year) * (1 - km / 900000);
      const price = round(b.price * dep * 0.97, 50000);
      const plate = year >= 2016 ? 'A' + letters[R.int(0, 6)] + ' ' + pad(R.int(100, 999), 3) + ' ' + letters[R.int(0, 22)] + letters[R.int(0, 22)] : '';
      list.push({
        ...b, id: 'V' + pad(list.length + 1, 3), cond: 'usado', year, km, price, cost: round(price * 0.84, 50000), stock: 1,
        status: R.weighted([['disponible', 8], ['reservado', 2]]), tags: k % 4 === 0 ? ['Único dueño', 'Service oficial'] : k % 3 === 0 ? ['Garantía 12 meses'] : ['Peritado'],
        colors: [R.pick(COLORS)], featured: false, promoTasa0: false, cuotaDesde: 0, patente: plate, photos: null, colorHex: null,
        ingreso: iso(addDays(t, -R.int(3, 95))), descripcion: 'Unidad peritada en nuestro taller, con informe de dominio y verificación policial al día. ' + (k % 2 ? 'Service al día en concesionario oficial.' : 'Excelente estado general, cubiertas nuevas.')
      });
    });
    ST.filter((s) => s.cond === 'usado').forEach((s) => {
      const v = stockVehicle(s);
      v.patente = 'A' + letters[R.int(0, 6)] + ' ' + pad(R.int(100, 999), 3) + ' ' + letters[R.int(0, 22)] + letters[R.int(0, 22)];
      list.push(v);
    });
    return list;
  }

  function seed() {
    const R = rng(20261105);
    const t = today();
    const vehicles = buildVehicles(R);
    const v0 = vehicles.filter((v) => v.cond === '0km');
    const name = () => R.pick(FIRST) + ' ' + R.pick(LAST);
    const phone = () => '11 ' + R.int(2000, 6999) + '-' + pad(R.int(0, 9999), 4);
    const mail = (n) => slug(n).replace(/-/g, '.') + R.int(1, 99) + '@' + R.pick(['gmail.com', 'hotmail.com', 'yahoo.com.ar', 'outlook.com']);
    const seller = () => R.pick(SELLERS);
    const dt = (dayOffset, hMin = 9, hMax = 18) => { const d = addDays(t, dayOffset); d.setHours(R.int(hMin, hMax), R.pick([0, 15, 30, 45])); return isoDT(d); };
    const past = (s) => { const now = Date.now(); return new Date(s).getTime() > now ? isoDT(new Date(now - R.int(4, 170) * 60000)) : s; };

    /* clientes */
    const clients = [];
    for (let i = 0; i < 72; i++) {
      const n = name(), [ciudad, provincia] = R.pick(CITIES), job = R.weighted(JOBS);
      const ingresos = round(R.weighted([[1.6e6, 2], [2.2e6, 3], [3e6, 3], [4.2e6, 2], [6e6, 1], [9e6, 0.6]]) * (0.85 + R() * 0.3), 10000);
      const dni = R.int(18, 44) * 1e6 + R.int(0, 999999);
      clients.push({
        id: 'C' + pad(i + 1, 4), nombre: n, dni: String(dni), cuit: (R.chance(0.5) ? '20' : '27') + '-' + dni + '-' + R.int(0, 9),
        email: mail(n), tel: phone(), ciudad, provincia, direccion: R.pick(['Av. Maipú', 'Av. Santa Fe', 'Belgrano', 'San Martín', 'Mitre', 'Rivadavia', 'Sarmiento', 'Av. Libertador', 'Moreno', 'Alsina']) + ' ' + R.int(100, 4800),
        nacimiento: iso(new Date(R.int(1958, 2002), R.int(0, 11), R.int(1, 28))), ocupacion: job, empleador: R.pick(EMPLOYERS),
        antiguedad: R.int(1, 22), ingresos, score: R.weighted([[R.int(720, 950), 6], [R.int(560, 719), 3], [R.int(380, 559), 1.2]]),
        bcra: 1, perfil: R.weighted([['bueno', 78], ['demorado', 13], ['moroso', 9]]), vendedorId: seller(),
        tags: [], creado: iso(addDays(t, -R.int(20, 900))), notas: ''
      });
    }
    clients.forEach((c) => { c.bcra = c.perfil === 'moroso' ? R.pick([2, 3]) : c.perfil === 'demorado' ? R.pick([1, 2]) : 1; if (c.perfil === 'moroso') c.score = Math.min(c.score, R.int(420, 580)); });
    clients[0].tags = ['VIP']; clients[3].tags = ['VIP', 'Flota']; clients[7].tags = ['Flota'];

    /* ventas + créditos + pólizas + caja */
    const sales = [], credits = [], policies = [], moves = [];
    const mv = (fecha, tipo, categoria, monto, medio, ref, clientId) => moves.push({ id: 'M' + pad(moves.length + 1, 5), fecha, tipo, categoria, monto: Math.round(monto), medio, ref: ref || '', clientId: clientId || '' });
    let ci = 0;
    for (let m = 11; m >= 0; m--) {
      let n = Math.round(4 + (11 - m) * 0.35 + R.int(0, 3));
      if (m === 0) n = Math.max(3, Math.round(n * Math.max(t.getDate(), 12) / 30));
      for (let k = 0; k < n; k++) {
        const dim = new Date(t.getFullYear(), t.getMonth() - m + 1, 0).getDate();
        const fechaD = new Date(t.getFullYear(), t.getMonth() - m, 1 + R.int(0, (m === 0 ? t.getDate() : dim) - 1));
        if (fechaD > t) continue;
        const fecha = iso(fechaD);
        const usedSale = R.chance(0.08);
        const pool = usedSale ? vehicles.filter((v) => v.cond === 'usado' && v.status !== 'vendido' && !v.photos) : v0.filter((v) => !v.photos || R.chance(0.3));
        const veh = R.pick(pool.length ? pool : v0);
        const client = clients[ci++ % clients.length];
        const forma = R.weighted([['contado', 30], ['financiado', 42], ['permuta', 16], ['plan', 12]]);
        const desc = round(veh.price * R.weighted([[0, 4], [0.02, 3], [0.035, 2], [0.05, 1]]), 10000);
        const precio = veh.price - desc;
        const anticipo = forma === 'contado' ? precio : forma === 'plan' ? 0 : round(precio * R.weighted([[0.3, 2], [0.4, 3], [0.5, 3], [0.6, 2]]), 10000);
        const permutaValor = forma === 'permuta' ? round(precio * R.weighted([[0.25, 1], [0.35, 2], [0.45, 1]]), 50000) : 0;
        const estado = m === 0 && R.chance(0.5) ? R.pick(['reservada', 'en_gestion', 'facturada']) : 'entregada';
        const sale = {
          id: 'S' + pad(sales.length + 1, 4), fecha, clientId: client.id, vehicleId: veh.id, vehiculo: veh.brand === 'citroen' ? 'Citroën ' + veh.model : cap(veh.brand) + ' ' + veh.model, version: veh.version, cond: veh.cond,
          vendedorId: client.vendedorId, precioLista: veh.price, descuento: desc, precio, formaPago: forma, anticipo, permuta: permutaValor ? { desc: R.pick(['Gol Trend 2016', 'Fiesta 2017', 'Corsa 2012', 'Clio 2015', 'Etios 2019', 'Palio 2014', 'Focus 2016', 'Sandero 2018']), valor: permutaValor } : null,
          creditId: null, policyId: null, estado, costo: veh.cost, gastos: round(precio * 0.045, 1000), color: R.pick(veh.colors), notas: ''
        };
        if (veh.cond === 'usado' && estado === 'entregada') veh.status = 'vendido';
        if (forma === 'financiado' || forma === 'permuta') {
          const capital = Math.max(0, precio - anticipo - permutaValor);
          if (capital > 0) {
            const plazo = R.weighted([[12, 2], [18, 2], [24, 3], [36, 3], [48, 1]]);
            const tna = veh.promoTasa0 && plazo <= 12 ? 0 : R.weighted([[CONFIG.tna, 6], [34.9, 2], [44.9, 2]]);
            const cr = { id: 'F' + pad(credits.length + 1, 4), clientId: client.id, saleId: sale.id, entidad: 'Financiación propia', tipo: 'Prendario', capital, tna, plazo, cuota: Math.round(Fin.cuota(capital, tna, plazo)), inicio: fecha, cuotas: Fin.schedule(capital, tna, plazo, fecha), gestor: 'U6' };
            const unpaidTail = client.perfil === 'moroso' ? R.int(1, 4) : client.perfil === 'demorado' && R.chance(0.5) ? 1 : 0;
            const due = cr.cuotas.filter((c) => parse(c.vto) < t);
            due.forEach((c, idx) => {
              if (idx >= due.length - unpaidTail) return;
              const late = client.perfil === 'demorado' ? R.weighted([[R.int(-2, 4), 1], [R.int(6, 25), 1]]) : client.perfil === 'moroso' ? R.weighted([[R.int(0, 5), 1], [R.int(6, 40), 2]]) : R.weighted([[R.int(-6, 0), 9], [R.int(1, 8), 1]]);
              const fp = addDays(c.vto, late); c.pagada = true; c.fechaPago = iso(fp > t ? t : fp); c.medio = R.weighted([['Transferencia', 6], ['Débito automático', 3], ['Efectivo', 1]]);
              mv(c.fechaPago, 'ingreso', 'Cobranza de cuotas', c.monto, c.medio, cr.id + ' · cuota ' + c.n, client.id);
            });
            const nextQ = cr.cuotas.find((q) => !q.pagada);
            if (client.perfil === 'bueno' && nextQ && daysBetween(t, nextQ.vto) <= 7 && t.getDate() > 1 && R.chance(0.6)) { nextQ.pagada = true; nextQ.fechaPago = iso(addDays(t, -R.int(0, Math.min(3, t.getDate() - 1)))); nextQ.medio = 'Débito automático'; mv(nextQ.fechaPago, 'ingreso', 'Cobranza de cuotas', nextQ.monto, nextQ.medio, cr.id + ' · cuota ' + nextQ.n, client.id); }
            mv(fecha, 'ingreso', 'Fondeo bancario de créditos', capital, 'Transferencia', cr.id, client.id);
            credits.push(cr); sale.creditId = cr.id;
          }
        }
        if (anticipo > 0) mv(fecha, 'ingreso', forma === 'contado' ? 'Venta de unidades' : 'Anticipo de venta', anticipo, R.pick(['Transferencia', 'Transferencia', 'Cheque', 'Efectivo']), sale.id, client.id);
        if (forma === 'plan') mv(fecha, 'ingreso', 'Liquidación plan de ahorro', precio, 'Transferencia', sale.id, client.id);
        mv(fecha, 'egreso', 'Compra de unidades', veh.cost, 'Transferencia', sale.id);
        if (R.chance(0.78)) {
          const ins = R.pick(INSURERS), cov = R.weighted([[COVERAGES[3], 4], [COVERAGES[2], 3], [COVERAGES[1], 3], [COVERAGES[0], 1]]);
          let inicio = parse(fecha); const lim = R.chance(0.08) ? addDays(t, -R.int(10, 60)) : addDays(t, R.chance(0.12) ? 20 : -1);
          while (addMonths(inicio, 12) < lim) inicio = addMonths(inicio, 12);
          const pol = { id: 'P' + pad(policies.length + 1, 4), clientId: client.id, saleId: sale.id, insurerId: ins.id, coverage: cov.id, numero: String(R.int(10, 99)) + '-' + R.int(100000, 999999), vehiculo: sale.vehiculo + ' ' + veh.version, patente: veh.patente || ('A' + 'EF'[R.int(0, 1)] + ' ' + R.int(100, 999) + ' ' + 'ABCDEFGHJK'[R.int(0, 9)] + 'XYZ'[R.int(0, 2)]), sumaAsegurada: precio, primaMensual: Fin.quote(precio, veh.year, cov, ins), inicio: iso(inicio), vencimiento: iso(addMonths(inicio, 12)), estado: 'vigente', productor: 'U7', siniestros: [] };
          if (R.chance(0.08)) pol.siniestros.push({ fecha: iso(addDays(t, -R.int(5, 120))), tipo: R.pick(['Choque parcial', 'Rotura de cristal', 'Granizo', 'Robo de rueda']), estado: R.pick(['En trámite', 'Liquidado', 'En peritaje']), monto: round(R.int(300, 2800) * 1000, 1000) });
          policies.push(pol); sale.policyId = pol.id;
        }
        if (veh.cond === '0km' && estado !== 'entregada') veh.stock = Math.max(veh.stock, 1);
        sales.push(sale);
      }
    }
    // pólizas de clientes sin compra reciente
    for (let i = 0; i < 14; i++) {
      const c = R.pick(clients), ins = R.pick(INSURERS), cov = R.pick(COVERAGES.slice(1)), value = round(R.int(14, 45) * 1e6, 100000), year = R.int(2016, 2024);
      const inicio = addDays(t, -R.int(10, 350));
      policies.push({ id: 'P' + pad(policies.length + 1, 4), clientId: c.id, saleId: null, insurerId: ins.id, coverage: cov.id, numero: String(R.int(10, 99)) + '-' + R.int(100000, 999999), vehiculo: R.pick(['Volkswagen Gol Trend', 'Ford Ka', 'Fiat Cronos', 'Toyota Etios', 'Renault Sandero', 'Peugeot 208', 'Chevrolet Prisma', 'Ford EcoSport']) + ' ' + year, patente: (year >= 2016 ? 'A' + 'ABCD'[R.int(0, 3)] + ' ' + R.int(100, 999) + ' ' + 'ABCDEFGH'[R.int(0, 7)] + 'KLM'[R.int(0, 2)] : 'NOP ' + R.int(100, 999)), sumaAsegurada: value, primaMensual: Fin.quote(value, year, cov, ins), inicio: iso(inicio), vencimiento: iso(addMonths(inicio, 12)), estado: 'vigente', productor: 'U7', siniestros: [] });
    }
    policies.forEach((p) => { if (R.chance(0.04)) p.estado = 'cancelada'; });

    /* plan de ahorro */
    const savings = [];
    for (let i = 0; i < 26; i++) {
      const c = clients[(i * 7 + 3) % clients.length], v = R.pick(v0);
      const alta = addDays(t, -R.int(20, 1100));
      const esperadas = Math.min(v.plazo, Math.floor(daysBetween(alta, t) / 30.4) + 1);
      const atraso = c.perfil === 'moroso' ? R.int(1, 3) : c.perfil === 'demorado' ? R.int(0, 1) : 0;
      const pagadas = Math.max(1, esperadas - atraso);
      const adj = pagadas >= 2 && R.chance(Math.min(0.85, 0.15 + pagadas / 60));
      const entregado = adj && R.chance(0.6);
      savings.push({
        id: 'A' + pad(i + 1, 4), clientId: c.id, vehicleId: v.id, modelo: cap(v.brand) + ' ' + v.model, grupo: String(R.int(1100, 9800)), orden: R.int(1, 168),
        plan: v.plazo + ' cuotas · ' + v.pct + '% financiado', cuotasTotal: v.plazo, cuotasPagadas: pagadas, valorCuota: round(v.cuotaDesde * 1.08, 100), alta: iso(alta),
        estado: R.chance(0.05) ? 'baja' : entregado ? 'entregado' : adj ? 'adjudicado' : 'ahorrando',
        adjudicacion: adj ? { tipo: R.weighted([['Sorteo', 4], ['Licitación', 3], ['Pactada', 3]]), fecha: iso(addMonths(alta, R.int(2, Math.max(2, pagadas)))) } : null, vendedorId: c.vendedorId
      });
    }
    savings.filter((s) => s.estado !== 'baja').forEach((s) => { // cobranza de cuotas de plan (comisión)
      for (let k = 0; k < Math.min(s.cuotasPagadas, 12); k++) { const f = addMonths(s.alta, s.cuotasPagadas - 1 - k); if (f <= t && daysBetween(f, t) < 370) mv(iso(f), 'ingreso', 'Comisiones plan de ahorro', s.valorCuota * 0.06, 'Transferencia', s.id, s.clientId); }
    });

    /* leads */
    const leads = [];
    const stageW = [['nuevo', 16], ['contactado', 18], ['test_drive', 10], ['negociacion', 12], ['ganado', 14], ['perdido', 10]];
    const msgs = ['Hola, quiero saber el precio final y si tienen stock.', 'Me interesa financiar, ¿qué tasa tienen?', '¿Toman usado en parte de pago? Tengo un Gol Trend 2016.', 'Quisiera coordinar un test drive este sábado.', 'Consulto por plan de ahorro, ¿desde qué cuota adjudican?', '¿Qué color tienen disponible para entrega inmediata?', 'Necesito presupuesto para empresa (2 unidades).', 'Hola! ¿Cuánto es el anticipo mínimo?', '¿El precio incluye patentamiento y flete?', 'Busco algo automático y económico, ¿qué me recomiendan?'];
    const lost = ['Compró en otra concesionaria', 'Precio fuera de presupuesto', 'No califica para crédito', 'Dejó de responder', 'Posterga la compra'];
    for (let i = 0; i < 84; i++) {
      const n = name(), stage = R.weighted(stageW), v = R.chance(0.82) ? R.pick(vehicles) : null;
      const age = stage === 'nuevo' ? R.int(0, 3) : stage === 'contactado' ? R.int(1, 12) : R.int(3, 60);
      const created = past(dt(-age, 8, 21));
      const acts = [];
      const nActs = stage === 'nuevo' ? 0 : R.int(1, 5);
      for (let a = 0; a < nActs; a++) {
        const tipo = R.weighted([['llamada', 3], ['whatsapp', 4], ['email', 1], ['visita', 1], ['nota', 1], ['presupuesto', 1], ['test_drive', stage === 'test_drive' || stage === 'negociacion' ? 2 : 0]]);
        acts.push({ fecha: past(dt(-Math.max(0, age - Math.round((a + 1) * age / (nActs + 1))), 9, 19)), tipo, texto: ({ llamada: 'Se contactó por teléfono, interesado en ' + (v ? v.model : 'opciones de financiación') + '.', whatsapp: 'Se envió ficha técnica y precio por WhatsApp.', email: 'Se envió presupuesto formal por email.', visita: 'Visitó el salón, vio la unidad en exhibición.', nota: 'Prefiere ser contactado por la tarde.', presupuesto: 'Presupuesto enviado con 3 alternativas de financiación.', test_drive: 'Realizó test drive, muy conforme con el manejo.' })[tipo], user: R.pick(SELLERS) });
      }
      acts.sort((a, b) => a.fecha.localeCompare(b.fecha));
      leads.push({
        id: 'L' + pad(i + 1, 4), nombre: n, tel: phone(), email: mail(n), ciudad: R.pick(CITIES)[0], vehicleId: v ? v.id : '', interes: v ? cap(v.brand) + ' ' + v.model : R.pick(['Seguro automotor', 'Plan de ahorro', 'SUV automática', 'Pick-up 4x4', 'Usado hasta $ 25 M']),
        origen: R.weighted(ORIGINS), etapa: stage, vendedorId: stage === 'nuevo' && R.chance(0.5) ? '' : R.pick(SELLERS), creado: created, actualizado: acts.length ? acts[acts.length - 1].fecha : created,
        mensaje: R.pick(msgs), formaPago: R.weighted([['financiado', 4], ['contado', 2], ['plan', 2], ['permuta', 2]]), presupuesto: v ? v.price : 0,
        temperatura: stage === 'negociacion' ? 'caliente' : stage === 'test_drive' ? R.pick(['caliente', 'tibio']) : R.pick(['frio', 'tibio', 'tibio']), motivoPerdida: stage === 'perdido' ? R.pick(lost) : '', clientId: '', actividades: acts, leido: stage !== 'nuevo' || R.chance(0.4)
      });
    }

    /* agenda */
    const appts = [];
    for (let i = 0; i < 34; i++) {
      const off = R.int(-8, 14), tipo = R.weighted([['test_drive', 4], ['service', 3], ['entrega', 2], ['tasacion', 2], ['reunion', 1]]);
      const c = R.chance(0.6) ? R.pick(clients) : null, l = c ? null : R.pick(leads), v = R.pick(vehicles);
      appts.push({ id: 'T' + pad(i + 1, 4), fecha: dt(off, 9, 18), duracion: tipo === 'service' ? 120 : 45, tipo, clientId: c ? c.id : '', leadId: l ? l.id : '', nombre: c ? c.nombre : l.nombre, tel: c ? c.tel : l.tel, vehiculo: cap(v.brand) + ' ' + v.model, asignado: tipo === 'service' ? 'U8' : R.pick(SELLERS), estado: off < 0 ? R.weighted([['realizado', 8], ['cancelado', 1]]) : off === 0 ? R.pick(['confirmado', 'pendiente']) : R.pick(['pendiente', 'confirmado', 'confirmado']), notas: '' });
    }
    // asegurar algunas citas hoy
    for (let i = 0; i < 4; i++) { const a = appts[i]; a.fecha = dt(0, 9 + i * 2, 9 + i * 2); a.estado = i === 0 ? 'realizado' : 'confirmado'; }

    /* taller */
    const SERV = ['Service 10.000 km', 'Service 20.000 km', 'Service 40.000 km', 'Cambio de pastillas de freno', 'Alineación y balanceo', 'Diagnóstico de motor', 'Cambio de embrague', 'Reparación de chapa y pintura', 'Cambio de batería', 'Revisión pre-VTV'];
    const workOrders = [];
    for (let i = 0; i < 16; i++) {
      const c = R.pick(clients), s = R.pick(sales), est = R.weighted([['recibido', 2], ['en_proceso', 3], ['repuestos', 1], ['listo', 2], ['entregado', 4]]);
      const items = [{ desc: R.pick(SERV), monto: round(R.int(90, 680) * 1000, 1000) }]; if (R.chance(0.5)) items.push({ desc: R.pick(['Filtro de aceite', 'Aceite sintético 5W30', 'Filtro de aire', 'Líquido de frenos', 'Escobillas']), monto: round(R.int(20, 120) * 1000, 1000) });
      const ingreso = addDays(t, -R.int(0, 20));
      workOrders.push({ id: 'OT' + pad(i + 1, 4), clientId: c.id, vehiculo: s.vehiculo, patente: 'A' + 'BCDEF'[R.int(0, 4)] + ' ' + R.int(100, 999) + ' ' + 'ABCDEFGH'[R.int(0, 7)] + 'JKL'[R.int(0, 2)], km: R.int(5, 90) * 1000, ingreso: iso(ingreso), entregaEstimada: iso(addDays(ingreso, R.int(1, 5))), estado: est, tecnico: R.pick(['Javier Sosa', 'Raúl Pereyra', 'Matías Cáceres']), items, garantia: R.chance(0.25), notas: '' });
      if (est === 'entregado') mv(iso(addDays(ingreso, 2)), 'ingreso', 'Taller y repuestos', sum(items, (x) => x.monto), R.pick(['Tarjeta', 'Transferencia', 'Efectivo']), 'OT' + pad(i + 1, 4), c.id);
    }

    /* tasaciones de usados */
    const tradeIns = [];
    const UMOD = [['Volkswagen', 'Gol Trend 1.6', 2016], ['Ford', 'Fiesta Kinetic', 2017], ['Chevrolet', 'Corsa Classic', 2012], ['Renault', 'Clio Mio', 2015], ['Toyota', 'Etios XLS', 2019], ['Fiat', 'Cronos Drive', 2020], ['Peugeot', '208 Allure', 2018], ['Ford', 'EcoSport SE', 2018], ['Volkswagen', 'Suran Highline', 2017], ['Chevrolet', 'Prisma LT', 2019], ['Renault', 'Sandero Stepway', 2020], ['Fiat', 'Toro Freedom', 2021]];
    for (let i = 0; i < 12; i++) {
      const [marca, modelo, anio] = UMOD[i], est = R.weighted([['pendiente', 3], ['tasado', 3], ['aceptado', 2], ['rechazado', 1]]);
      const base = round((2026 - anio < 6 ? 19e6 : 11e6) * (0.8 + R() * 0.5), 100000);
      const n = name();
      tradeIns.push({ id: 'TZ' + pad(i + 1, 4), nombre: n, tel: phone(), email: mail(n), marca, modelo, anio, km: R.int(40, 160) * 1000, estadoGeneral: R.pick(['Muy bueno', 'Bueno', 'Regular']), fecha: iso(addDays(t, -R.int(0, 30))), estado: est, valorMercado: base, valorOfrecido: est === 'pendiente' ? 0 : round(base * 0.85, 50000), interes: R.pick(v0).model, tasador: 'U5', notas: '' });
    }

    /* gastos fijos mensuales */
    for (let m = 11; m >= 0; m--) {
      const f = (d) => { const x = addMonths(t, -m); x.setDate(d); return x > t ? null : iso(x); };
      const g = (d, cat, monto, medio) => { const fe = f(d); if (fe) mv(fe, 'egreso', cat, monto * (1 + (11 - m) * 0.025), medio, 'Mensual'); };
      const mKey = iso(addMonths(t, -m)).slice(0, 7), prevKey = iso(addMonths(t, -m - 1)).slice(0, 7);
      const ventasMes = sum(sales.filter((s) => s.fecha.slice(0, 7) === mKey), (s) => s.precio);
      const ventas0kmPrev = sum(sales.filter((s) => s.fecha.slice(0, 7) === prevKey && s.cond === '0km'), (s) => s.precio);
      const cobrMes = sum(moves.filter((x) => x.categoria === 'Cobranza de cuotas' && x.fecha.slice(0, 7) === mKey), (x) => x.monto);
      g(5, 'Sueldos y cargas sociales', 14500000, 'Transferencia');
      g(1, 'Alquiler y expensas', 3600000, 'Transferencia');
      g(10, 'Marketing y publicidad', 2100000 + R.int(0, 900000), 'Tarjeta');
      g(12, 'Servicios (luz, gas, internet)', 850000, 'Débito automático');
      g(20, 'Impuestos y tasas', 3200000 + R.int(0, 900000), 'Transferencia');
      const f28 = f(28);
      if (f28 && ventasMes) mv(f28, 'egreso', 'Comisiones de vendedores', ventasMes * 0.012, 'Transferencia', 'Liquidación mensual');
      if (f28 && cobrMes) mv(f28, 'egreso', 'Pago a banco (fondeo de cartera)', cobrMes * 0.82, 'Transferencia', 'Liquidación mensual');
      const f8 = f(8); if (f8 && ventas0kmPrev) mv(f8, 'ingreso', 'Bonificaciones de terminal', ventas0kmPrev * 0.025, 'Transferencia', 'Objetivos ' + prevKey);
      const fe = f(25); if (fe) mv(fe, 'ingreso', 'Comisiones de seguros', sum(policies.filter((p) => parse(p.inicio) <= parse(fe)), (p) => p.primaMensual * (INSURERS.find((i) => i.id === p.insurerId).comision / 100)), 'Transferencia', 'Liquidación mensual');
    }
    // ingresos coherentes con los compromisos asumidos (relación cuota/ingreso realista)
    clients.forEach((cl) => {
      const crd = sum(credits.filter((x) => x.clientId === cl.id && x.cuotas.some((q) => !q.pagada)), (x) => x.cuota);
      const sav = sum(savings.filter((x) => x.clientId === cl.id && x.estado !== 'baja'), (x) => x.valorCuota);
      const pol = sum(policies.filter((x) => x.clientId === cl.id), (x) => x.primaMensual);
      const comp = crd + sav + pol; if (!comp) return;
      const target = cl.perfil === 'moroso' ? 0.36 + R() * 0.12 : cl.perfil === 'demorado' ? 0.27 + R() * 0.08 : 0.14 + R() * 0.16;
      cl.ingresos = Math.max(cl.ingresos, round(comp / target, 10000));
    });
    moves.sort((a, b) => a.fecha.localeCompare(b.fecha));
    moves.forEach((m, i) => { m.id = 'M' + pad(i + 1, 5); });

    return {
      version: 1, seededAt: iso(t), config: { ...CONFIG }, team: TEAM.map((u) => ({ ...u })), insurers: INSURERS.map((x) => ({ ...x })), coverages: COVERAGES.map((x) => ({ ...x })),
      vehicles, clients, leads, sales, credits, policies, savings, appts, workOrders, tradeIns, moves, notifications: []
    };
  }
  function cap(s) { return s === 'citroen' ? 'Citroën' : s.charAt(0).toUpperCase() + s.slice(1); }

  /* ---------------------------------------------------------------- STORE */
  const KEY = 'rumbo_demo_v4';
  const PREFIX = { vehicles: ['V', 3], clients: ['C', 4], leads: ['L', 4], sales: ['S', 4], credits: ['F', 4], policies: ['P', 4], savings: ['A', 4], appts: ['T', 4], workOrders: ['OT', 4], tradeIns: ['TZ', 4], moves: ['M', 5], notifications: ['N', 5] };
  const listeners = [];
  const DB = {
    data: null,
    load() {
      let raw = null;
      try { raw = localStorage.getItem(KEY); } catch (e) { /* storage bloqueado */ }
      if (raw) { try { this.data = JSON.parse(raw); } catch (e) { this.data = null; } }
      if (!this.data || this.data.version !== 1) { this.data = seed(); this.save(); }
      return this.data;
    },
    save() { try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (e) { /* sin persistencia */ } listeners.forEach((fn) => fn()); },
    reset() { this.data = seed(); this.save(); },
    all(col) { return this.data[col]; },
    get(col, id) { return this.data[col].find((x) => x.id === id) || null; },
    nextId(col) {
      const [p, l] = PREFIX[col]; const max = this.data[col].reduce((m, x) => Math.max(m, parseInt(String(x.id).slice(p.length), 10) || 0), 0);
      return p + pad(max + 1, l);
    },
    insert(col, obj) { obj.id = obj.id || this.nextId(col); this.data[col].push(obj); this.save(); return obj; },
    update(col, id, patch) { const o = this.get(col, id); if (o) Object.assign(o, patch); this.save(); return o; },
    remove(col, id) { this.data[col] = this.data[col].filter((x) => x.id !== id); this.save(); },
    onChange(fn) { listeners.push(fn); },
    notify(texto, tipo, link) { this.data.notifications.unshift({ id: this.nextId('notifications'), fecha: isoDT(new Date()), texto, tipo: tipo || 'info', link: link || '', leido: false }); this.data.notifications = this.data.notifications.slice(0, 60); }
  };
  // sincroniza pestañas (ej.: un lead enviado desde el sitio aparece en el admin abierto)
  try {
    global.addEventListener('storage', (e) => { if (e.key === KEY && e.newValue) { try { DB.data = JSON.parse(e.newValue); listeners.forEach((fn) => fn(true)); } catch (err) { /* ignore */ } } });
  } catch (e) { /* ignore */ }

  /* --------------------------------------------------------- DOMINIO / QUERIES */
  const Q = {
    brandName: (id) => (BRANDS.find((b) => b.id === id) || { name: ({ 'mercedes-benz': 'Mercedes-Benz' })[id] || cap(id || '') }).name,
    // fotos de una unidad: [{f: grande, t: miniatura}]
    photos(v) {
      if (!v) return [];
      if (v.photos && v.photos.n) return Array.from({ length: v.photos.n }, (_, i) => { const n = pad(i + 1, 2); return { f: v.photos.dir + n + '.jpg', t: v.photos.dir + n + '-t.jpg' }; });
      return [{ f: v.img, t: v.img }].concat((GALLERY[v.brand + '|' + v.model] || []).map((s) => ({ f: s, t: s })));
    },
    vName: (v) => v ? Q.brandName(v.brand) + ' ' + v.model : '—',
    vFull: (v) => v ? Q.vName(v) + ' ' + v.version : '—',
    client: (id) => DB.get('clients', id),
    user: (id) => DB.data.team.find((u) => u.id === id) || null,
    userName: (id) => (Q.user(id) || { nombre: 'Sin asignar' }).nombre,
    insurer: (id) => DB.data.insurers.find((i) => i.id === id),
    coverage: (id) => DB.data.coverages.find((c) => c.id === id),
    published: () => DB.data.vehicles.filter((v) => v.published && (v.cond === '0km' ? true : v.status !== 'vendido')),
    clientFinance(clientId) {
      const t = today();
      const c = DB.get('clients', clientId);
      const credits = DB.data.credits.filter((x) => x.clientId === clientId).map((cr) => ({ ...cr, st: Fin.creditStatus(cr, t) }));
      const savings = DB.data.savings.filter((x) => x.clientId === clientId).map((s) => ({ ...s, st: Fin.savingsStatus(s, t) }));
      const policies = DB.data.policies.filter((x) => x.clientId === clientId).map((p) => ({ ...p, st: Fin.policyState(p, t) }));
      const sales = DB.data.sales.filter((x) => x.clientId === clientId);
      const moves = DB.data.moves.filter((m) => m.clientId === clientId);
      const activeCr = credits.filter((x) => x.st.estado !== 'cancelado');
      const cuotaMensual = sum(activeCr, (x) => x.cuota) + sum(savings.filter((s) => s.estado !== 'baja' && s.st.restante > 0), (s) => s.valorCuota) + sum(policies.filter((p) => p.st !== 'vencida' && p.st !== 'cancelada'), (p) => p.primaMensual);
      const deuda = sum(activeCr, (x) => x.st.saldoTotal);
      const vencido = sum(credits, (x) => x.st.montoVencido);
      const punitorios = sum(credits, (x) => x.st.punitorios);
      const diasMora = Math.max(0, ...credits.map((x) => x.st.diasMora));
      const planAtraso = sum(savings, (s) => s.estado === 'baja' ? 0 : s.st.atrasadas);
      const ratio = c && c.ingresos ? cuotaMensual / c.ingresos * 100 : 0;
      const capacidad = c ? Math.max(0, c.ingresos * 0.35 - cuotaMensual) : 0;
      const totalComprado = sum(sales.filter((s) => s.estado !== 'anulada'), (s) => s.precio);
      const pagosHist = credits.flatMap((x) => x.cuotas.filter((q) => q.pagada));
      const puntual = pagosHist.length ? pagosHist.filter((q) => daysBetween(q.vto, q.fechaPago) <= 5).length / pagosHist.length * 100 : 100;
      let riesgo = 'Bajo';
      if (diasMora > 30 || (c && c.bcra >= 3) || ratio > 45) riesgo = 'Alto'; else if (diasMora > 0 || planAtraso > 0 || ratio > 30 || (c && c.score < 600)) riesgo = 'Medio';
      // cuenta corriente: debe (cuotas devengadas + saldo de operaciones) / haber (pagos)
      const cc = [];
      sales.forEach((s) => { cc.push({ fecha: s.fecha, concepto: 'Operación ' + s.id + ' · ' + s.vehiculo, debe: s.precio, haber: 0 }); if (s.anticipo) cc.push({ fecha: s.fecha, concepto: s.formaPago === 'contado' ? 'Pago contado' : 'Anticipo', debe: 0, haber: s.anticipo }); if (s.permuta) cc.push({ fecha: s.fecha, concepto: 'Usado en parte de pago · ' + s.permuta.desc, debe: 0, haber: s.permuta.valor }); });
      credits.forEach((cr) => { cc.push({ fecha: cr.inicio, concepto: 'Financiación ' + cr.id + ' (' + cr.plazo + ' cuotas)', debe: 0, haber: cr.capital }); cr.cuotas.filter((q) => parse(q.vto) <= t || q.pagada).forEach((q) => { cc.push({ fecha: q.vto, concepto: 'Cuota ' + q.n + '/' + cr.plazo + ' · ' + cr.id, debe: q.monto, haber: 0 }); if (q.pagada) cc.push({ fecha: q.fechaPago, concepto: 'Pago cuota ' + q.n + ' (' + (q.medio || 'Transferencia') + ')', debe: 0, haber: q.monto }); }); });
      cc.sort((a, b) => a.fecha.localeCompare(b.fecha));
      let saldo = 0; cc.forEach((r) => { saldo += r.debe - r.haber; r.saldo = saldo; });
      return { c, credits, savings, policies, sales, moves, cuotaMensual, deuda, vencido, punitorios, diasMora, planAtraso, ratio, capacidad, totalComprado, puntual, riesgo, cc };
    }
  };

  /* Íconos SVG (trazo) compartidos */
  const ICONS = {
    car: '<path d="M5 17h14M6.5 17v1.5M17.5 17v1.5M3 13l2-5.5A2 2 0 0 1 6.9 6h10.2a2 2 0 0 1 1.9 1.5L21 13v4H3v-4zM3 13h18"/><circle cx="7.5" cy="14.8" r=".6"/><circle cx="16.5" cy="14.8" r=".6"/>',
    users: '<circle cx="9" cy="8" r="3.2"/><path d="M3 19c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5"/><path d="M16 4.8a3.2 3.2 0 0 1 0 6.4M18 13.8c1.8.7 3 2.6 3 5.2"/>',
    user: '<circle cx="12" cy="8" r="3.6"/><path d="M4.5 20c0-4 3.4-6.5 7.5-6.5s7.5 2.5 7.5 6.5"/>',
    home: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>',
    funnel: '<path d="M3 4h18l-7 8.5V19l-4 2v-8.5z"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    tag: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.3"/>',
    cash: '<rect x="2.5" y="6" width="19" height="12" rx="2"/><circle cx="12" cy="12" r="2.6"/><path d="M6 9.5v5M18 9.5v5"/>',
    card: '<rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="M2.5 10h19M6 15h4"/>',
    piggy: '<path d="M19 10.5c.8.3 1.5 1 1.5 2v1.5H19a6 6 0 0 1-2.5 3V20h-3v-1.5h-3V20h-3v-3A6.5 6.5 0 0 1 4 11.5C4 8 7 5.5 11 5.5c1.2 0 2.3.2 3.3.7L17 5v3.2c.9.6 1.6 1.4 2 2.3z"/><circle cx="15" cy="10.5" r=".7"/>',
    shield: '<path d="M12 3l8 3v6c0 4.5-3.3 8-8 9-4.7-1-8-4.5-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
    swap: '<path d="M4 8h13l-3.5-3.5M20 16H7l3.5 3.5"/>',
    wrench: '<path d="M14.5 6.5a4 4 0 0 0 5 5L21 13l-8 8-3-3 8-8M14.5 6.5L13 5a4 4 0 0 0-5.3 5.3L3 15l3 3 4.7-4.7"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    wallet: '<path d="M20 7V5.5A1.5 1.5 0 0 0 18.5 4h-13A2.5 2.5 0 0 0 3 6.5v11A2.5 2.5 0 0 0 5.5 20h14a1.5 1.5 0 0 0 1.5-1.5V15"/><path d="M21 9h-5a3 3 0 0 0 0 6h5z"/>',
    team: '<circle cx="12" cy="7" r="3"/><circle cx="5" cy="10" r="2.2"/><circle cx="19" cy="10" r="2.2"/><path d="M7 19c0-3 2.2-5 5-5s5 2 5 5M1.5 18c0-2 1.4-3.5 3.5-3.5M22.5 18c0-2-1.4-3.5-3.5-3.5"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>',
    bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    phone: '<path d="M5 3.5h3.5l1.8 4.5-2.3 1.5a11 11 0 0 0 6.5 6.5l1.5-2.3 4.5 1.8V19a1.5 1.5 0 0 1-1.6 1.5C10.6 20 4 13.4 3.5 5.1A1.5 1.5 0 0 1 5 3.5z"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 6.5l8.5 6.5 8.5-6.5"/>',
    whatsapp: '<path d="M4 20l1.3-4A8 8 0 1 1 8.3 19z"/><path d="M9 8.5c0 3.5 3 6.5 6.5 6.5l1-1.5-2-1-1 .8c-1.2-.5-2.3-1.6-2.8-2.8l.8-1-1-2z"/>',
    pin: '<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    chevron: '<path d="M9 6l6 6-6 6"/>',
    chevronDown: '<path d="M6 9l6 6 6-6"/>',
    heart: '<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.3 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/>',
    fuel: '<path d="M4 20V5a1.5 1.5 0 0 1 1.5-1.5h7A1.5 1.5 0 0 1 14 5v15M3 20h12M4 10h10M14 8l3.5 2.5V17a1.5 1.5 0 0 0 3 0v-7L18 7"/>',
    gearbox: '<circle cx="5" cy="5" r="1.6"/><circle cx="12" cy="5" r="1.6"/><circle cx="19" cy="5" r="1.6"/><circle cx="5" cy="19" r="1.6"/><circle cx="12" cy="19" r="1.6"/><path d="M5 6.6v10.8M12 6.6v10.8M19 6.6V12H5"/>',
    gauge: '<path d="M4.5 17a8.5 8.5 0 1 1 15 0"/><path d="M12 13l4-4"/><circle cx="12" cy="13" r="1.2"/>',
    seat: '<path d="M7 3.5h3.5l1 9.5H18l1 5.5H8z"/><path d="M8.5 18.5V21M17 18.5V21"/>',
    engine: '<path d="M4 9h2V7h4V5h4v2h3l2 3h2v6h-2l-2 3H8l-2-2H4z"/>',
    doc: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>',
    print: '<path d="M7 9V3h10v6M7 17H4V9h16v8h-3"/><rect x="7" y="14" width="10" height="7"/>',
    download: '<path d="M12 4v11M7 10.5l5 5 5-5M4 20h16"/>',
    upload: '<path d="M12 20V9M7 13.5l5-5 5 5M4 4h16"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    star: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8 6.8 19.6l1-5.8L3.5 9.7l5.9-.8z"/>',
    alert: '<path d="M12 3.5l9.5 16.5h-19z"/><path d="M12 10v4.5M12 17.3v.2"/>',
    info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.8v.2"/>',
    logout: '<path d="M14 4h5v16h-5M10 8l-4 4 4 4M6 12h10"/>',
    arrowRight: '<path d="M4 12h15M13 6l6 6-6 6"/>',
    arrowUp: '<path d="M12 19V5M6 11l6-6 6 6"/>',
    arrowDown: '<path d="M12 5v14M6 13l6 6 6-6"/>',
    grid: '<rect x="3.5" y="3.5" width="7" height="7" rx="1"/><rect x="13.5" y="3.5" width="7" height="7" rx="1"/><rect x="3.5" y="13.5" width="7" height="7" rx="1"/><rect x="13.5" y="13.5" width="7" height="7" rx="1"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
    kanban: '<rect x="3" y="4" width="5" height="16" rx="1"/><rect x="10" y="4" width="5" height="10" rx="1"/><rect x="17" y="4" width="4" height="13" rx="1"/>',
    filter: '<path d="M4 6h16M7 12h10M10 18h4"/>',
    compare: '<path d="M8 3v18M16 3v18M3 8h5M16 16h5"/>',
    key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3M15 8l2 2"/>',
    route: '<circle cx="6" cy="19" r="2"/><circle cx="18" cy="5" r="2"/><path d="M8 19h8a3.5 3.5 0 0 0 0-7H8a3.5 3.5 0 0 1 0-7h8"/>',
    percent: '<path d="M19 5L5 19"/><circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="17" r="2.5"/>',
    bolt: '<path d="M13 2.5L4.5 13.5H11L10 21.5l8.5-11H12z"/>',
    sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>',
    camera: '<path d="M4 8h3.2l1.8-2.5h6L16.8 8H20v11H4z"/><circle cx="12" cy="13.2" r="3.4"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
    refresh: '<path d="M20 11a8 8 0 0 0-14.6-4.5L4 8M4 4v4h4M4 13a8 8 0 0 0 14.6 4.5L20 16M20 20v-4h-4"/>'
  };
  const icon = (name, cls) => '<svg class="i ' + (cls || '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[name] || '') + '</svg>';

  global.RB = { CONFIG, fmt, esc, slug, round, sum, groupBy, pad, parse, iso, isoDT, today, addDays, addMonths, daysBetween, waLink, rng, LABELS, TONE, BRANDS, Fin, DB, Q, icon, ICONS, cap };
})(window);
