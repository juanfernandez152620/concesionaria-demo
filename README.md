# Rumbo Automotores — Demo de sistema para concesionaria

Demo funcional de punta a punta para presentar a una concesionaria:

1. **Sitio público** (home + catálogo + ficha de vehículo + "Mi cuenta"), responsive, inspirado en Plan Nacional Chevrolet, PlanNacional.autos, Toyota of Manhattan y Manhattan Motorcars.
2. **Sistema de gestión (admin)** con CRM, clientes 360° con estado financiero, ventas, financiación y cobranzas, plan de ahorro, broker de seguros, taller, usados, caja, reportes, equipo y configuración.

Los dos están conectados: una consulta, un test drive, un turno de taller o una tasación que se envía desde el sitio **aparece al instante en el admin** (con notificación), y lo que se edita en el admin (precios, stock, publicación, datos de contacto, tasas, coberturas de seguro) **se refleja en el sitio**.

> Es una demo sin backend: todos los datos son ficticios y se guardan en el navegador (localStorage). "Rumbo Automotores" es un nombre inventado y se cambia desde **Admin → Configuración**.

---

## Cómo abrirla

**Opción recomendada (servidor local, sin instalar nada):**

```bash
node server.js
```

Después abrí <http://localhost:5173>: es la **portada de la demo** (`index.html`), desde donde entrás al sitio web (`home.html`) o al panel (`admin.html`), con accesos directos a cada sección, datos en vivo, un guion sugerido y el botón para reiniciar los datos.

**Opción rápida:** doble clic en `index.html`. Funciona igual, aunque algunos navegadores restringen el almacenamiento en archivos locales; si algo no se guarda, usá el servidor.

**Modo presentación** (<http://localhost:5173/#presentar>): muestra el sitio en un marco de celular y el panel al lado, en la misma pantalla. Enviá una consulta desde el sitio y aparece al instante en el CRM. En el celular se convierte en pestañas "Sitio / Panel". Desde el menú del sitio y la barra lateral del panel hay un enlace "Inicio de la demo" para volver a la portada.

---

## Guion sugerido para la presentación (10 minutos)

| # | Dónde | Qué mostrar |
|---|-------|-------------|
| 1 | Sitio → Home | Slider de promociones, cuenta regresiva de bonificaciones, buscador rápido, 7 marcas y 40 modelos 0km, ofertas, plan de ahorro con cuotas reales de referencia. |
| 2 | Sitio → Financiación | Simulador de crédito prendario (anticipo, plazo, tasa 0% en modelos promo) → "Solicitar pre-aprobación". |
| 3 | Sitio → Seguros | Cotizador que compara 5 aseguradoras por cobertura (RC, Terceros, Premium, Todo Riesgo). |
| 4 | Sitio → Vendé tu usado | Tasador online con rango estimado → genera tasación + lead. |
| 5 | Sitio → Ficha de vehículo | Galería, ficha técnica, equipamiento, financiación, plan de ahorro, seguro, test drive, comparador y favoritos. |
| 6 | Sitio → enviar una consulta | Cambiar a la pestaña del admin: llega el lead en vivo al CRM, asignado automáticamente a un asesor. |
| 7 | Admin → Dashboard | KPIs del mes vs. mes anterior, ventas 12 meses, embudo, agenda de hoy, alertas de mora y pólizas por vencer, objetivos por asesor. |
| 8 | Admin → CRM | Pipeline kanban con arrastrar y soltar, ficha del lead con WhatsApp/llamada/email, historial de actividades, presupuesto imprimible, convertir en cliente. |
| 9 | Admin → Ventas → Nueva operación | Asistente en 5 pasos: cliente (con su riesgo y capacidad de pago) → unidad → condiciones (contado / financiado / usado / plan, alerta si la cuota supera el 35% de los ingresos) → seguro → confirmar. Crea venta, crédito con cronograma, póliza, movimientos de caja y baja de stock. |
| 10 | Admin → Clientes → ficha | **Estado financiero**: score y situación BCRA, capacidad de pago, puntualidad, créditos con tira de cuotas, deuda vencida y punitorios, cuenta corriente, estado de cuenta imprimible, registrar pago, recordatorio por WhatsApp, refinanciación. |
| 11 | Admin → Financiación y cobranzas | Cartera, morosidad, tramos de mora, cuotas vencidas, próximos vencimientos y simulador. |
| 12 | Admin → Plan de ahorro / Seguros / Taller / Caja / Reportes | Simular sorteo de adjudicación, catálogo editable de aseguradoras y coberturas, kanban de taller, estado de resultados, ranking de asesores y conversión por origen. |
| 13 | Sitio → Mi cuenta | El cliente consulta con su DNI sus cuotas, plan de ahorro, pólizas y turnos (hay DNIs de ejemplo en pantalla). |

Para volver al estado inicial: **Admin → Configuración → Restablecer datos demo**.

---

## Qué incluye

**Sitio público**
- Home con hero slider, buscador, accesos rápidos, marcas, modelos por carrocería, ofertas, beneficios, simulador de crédito, tabla de plan de ahorro, usados, tasación online, cotizador de seguros, turnos de taller, testimonios y contacto.
- Catálogo con filtros (condición, marca, carrocería, precio, año, km, combustible, transmisión), orden, vista grilla/lista, favoritos y comparador de hasta 3 vehículos.
- Ficha de vehículo con pestañas (ficha técnica, equipamiento, financiación, plan de ahorro, seguro), test drive y vehículos similares.
- "Mi cuenta": autogestión del cliente por DNI.
- Botón flotante de WhatsApp y barra inferior de acciones en móvil.

**Sistema de gestión**
- Login por perfil (gerente, asesores, administración, seguros, taller).
- Dashboard, CRM (kanban + lista), Clientes 360°, Agenda semanal, Ventas (con boleto de compraventa imprimible), Inventario (0km y usados, márgenes, días en stock, publicar en web), Usados y tasaciones, Financiación y cobranzas, Plan de ahorro, Seguros, Caja y finanzas (flujo + estado de resultados), Taller, Reportes, Equipo (objetivos, comisiones, permisos por rol), Configuración (datos, tasas, integraciones simuladas, backup).
- Búsqueda global (Ctrl + K), menú "Nuevo", notificaciones, exportación a CSV e impresión de presupuestos, recibos, órdenes de trabajo y estados de cuenta.

---

## Estructura

```
index.html                                                    → portada de la demo (sitio + panel + modo presentación)
home.html · catalogo.html · vehiculo.html · mi-cuenta.html    → sitio público
admin.html                                                    → sistema de gestión
server.js                                                     → servidor estático mínimo (Node)
assets/css/site.css · assets/css/admin.css
assets/js/common.js      → datos demo, persistencia y cálculos financieros (compartido)
assets/js/site.js        → lógica del sitio
assets/js/charts.js      → gráficos SVG sin dependencias
assets/js/admin/*.js     → núcleo y módulos del admin
assets/img/              → imágenes de modelos y banners
```

Para cambiar nombre, teléfonos, WhatsApp, dirección o tasas por defecto: `CONFIG` en `assets/js/common.js` (o desde Admin → Configuración).
El catálogo de 40 modelos (precios, cuota de plan, plazo, % financiado, imagen) está en `MODELS` del mismo archivo.

---

## Galería de fotos reales

- **23 unidades** (16 modelos 0km y 7 usados) tienen entre 10 y 12 fotos reales, relevadas del inventario de Toyota of Manhattan. Los datos están en `assets/js/stock.js` y las fotos en `assets/img/stock/<unidad>/` (`NN.jpg` 1200 px para la galería y `NN-t.jpg` 480 px para miniaturas).
- Tarjetas con carrusel deslizable (hasta 5 fotos) y contador de fotos.
- Ficha con galería a pantalla completa en móvil, flechas y miniaturas en escritorio, y visor con modo grilla, navegación por teclado y gesto de deslizar.
- Precios convertidos a pesos (USD × 1.750 para 0km importados, USD × 1.500 para usados). Los modelos que no se venden en Argentina llevan la etiqueta "Importación directa".

## Diseño del sitio

Mobile-first y minimalista: un solo botón de WhatsApp flotante, herramientas (simulador, plan de ahorro, tasación, seguros, turnos) en hojas que se abren desde abajo, secciones en carruseles horizontales y, en la ficha, una barra inferior con precio y un único botón "Consultar" que reúne WhatsApp, formulario, test drive y llamada.

## Notas importantes

- **Imágenes:** las fotos de modelos, banners y unidades se tomaron de los sitios de referencia (material de las marcas y de Toyota of Manhattan). Sirven para la presentación; antes de publicar un sitio real hay que reemplazarlas por material propio o con licencia de la concesionaria.
- **Precios y cuotas:** las cuotas de plan de ahorro se tomaron de los sitios de referencia; los precios de lista son estimados para la demo.
- **Para pasar a producción** haría falta: backend y base de datos, usuarios con contraseña y permisos reales, integración real con WhatsApp Business, facturación electrónica (ARCA), consulta a Central de Deudores (BCRA), pasarela de pagos y las administradoras de planes de ahorro.
