# Roadmap — Angelito PDF Engine

Estado de partida: **v0.1.1** (2026-11-11). Reglas: AGENTS.md. Una tarea está hecha cuando su criterio de
aceptación se ejecuta en CI y pasa; la matriz `docs/css-support.md` se actualiza en el mismo cambio.

## Decisiones que acotan este plan

1. **No escribimos un motor HTML/CSS/layout propio.** ADR-0001: el pipeline es Fulgur
   (html5ever → Stylo, el motor CSS de Firefox → Taffy → Parley → Krilla). Un motor propio costaría años y
   sería peor. Corregimos huecos con parches mínimos en `vendor/` (documentados en `vendor/README.md` y
   enviados upstream) o en nuestra capa (`backend.rs`). Si un hueco exige reescribir una etapa, se decide
   con un ADR, no con un parche.
2. **Medimos cobertura de la matriz CSS, no número de pruebas.** Cada prueba verifica un comportamiento
   (geometría, texto por página, recursos embebidos), nunca "compila".
3. **Ninguna integración duplica el render.** CLI, PHP y Node usan el contrato `RenderOptions` → `Engine`.
4. **Estándares (PDF/A, PDF/UA, PDF/X, PAdES) solo se declaran con su validador ejecutado en CI**
   (veraPDF para PDF/A y PDF/UA).

## Auditoría (2026-11-11)

| Área | Estado real | Evidencia |
|---|---|---|
| Parser HTML5, HTML imperfecto, entidades, UTF-8 | funciona (html5ever) | `simple_html_produces_valid_pdf_with_text`; HTML imperfecto sin prueba propia |
| Cascada, especificidad, herencia, `var()`, `calc()` | heredado de Stylo; **sin pruebas propias** | — |
| Flexbox, Grid, box model, position, text-align | probado (24 pruebas de geometría) | `tests/layout.rs` |
| `border-color` por lado | **bug: un solo color** | `per_side_border_colors` (ignorada) |
| `@page`, margin boxes, contadores, `thead` repetido, `@media print`, `break-before` | probado | `invoice_paginates_…` |
| margin boxes `@page` | probado; bug de alineación corregido (parche) | `tests/paged.rs` |
| Imágenes registradas con tamaño | probado | `images_are_embedded_only_when_registered` |
| Imágenes `data:` (PNG/JPEG/GIF/SVG), tamaño natural | probado (con límites anti-bomba) | `tests/images.rs` |
| Fuentes propias (`fonts`), `@font-face` | `fonts` probado; `@font-face` parcial (solo CSS enlazado) | `tests/paged.rs` |
| SVG, gradientes, `transform`, multicolumna, enlaces, marcadores, etiquetado | Fulgur lo incluye; **sin probar** | `vendor/fulgur-blitz/src/{svg,outline,link,tagging,multicol_layout}.rs` |
| `box-shadow: inset`, `text-shadow` | no soportado | límite del renderizador |
| Seguridad (red, archivos, UNC, límites) | probado | `tests/security.rs` |
| Laravel | probado (16 tests, Laravel 13, CI Linux + Windows) | `packages/php/tests` |
| Node/NestJS | no existe | — |

## Fases

Prioridad: P0 arreglar lo que ya existe y falla → P1 probar lo que se supone que funciona → P2 ampliar.

### Fase 1 — Estabilizar lo existente (P0) · 1.1–1.7 hechas (2026-11-12), 1.8 pendiente

| # | Tarea | Agente | Criterio de aceptación |
|---|---|---|---|
| 1.1 ✅ | `@bottom-center` / margin boxes centrados | pagination-typography | prueba: la x del texto del pie está centrada en la página ±1 mm; también `@top-left/right` |
| 1.2 ✅ | Imágenes `data:` (PNG/JPEG/GIF/SVG) | rust-engine | `data_uri_image_is_embedded` deja de estar ignorada y pasa |
| 1.3 ✅ | Imágenes sin tamaño (tamaño natural, `width` solo) | rust-engine | prueba: la imagen embebida tiene las dimensiones esperadas |
| 1.4 ✅ | Formatos A0–A10 y B0–B10 | rust-engine | prueba de tamaño de página por formato |
| 1.5 ✅ parcial | Fuentes propias (`fonts`, `@font-face` con `baseDir`) | pagination-typography | prueba: la fuente aparece incrustada (subset) y el texto se extrae |
| 1.6 ✅ | Geometría de Flexbox, Grid y box model | html-css | pruebas que leen posiciones del PDF: `justify-content`, `align-items`, `gap`, columnas de Grid, `margin`/`padding` |
| 1.7 ✅ | `break-inside: avoid`, `break-after`, `page-break-*` | pagination-typography | prueba de texto por página |
| 1.9 | `@font-face` en `<style>` inline y descriptor `font-family` (blitz-dom `process_style_element`; vendorizar `blitz-traits`) | pagination-typography | prueba con `<style>@font-face{font-family:Mi;src:url(...)}</style>` y `font-family:Mi` |
| 1.10 | Tamaño natural de imágenes registradas solo con `images` (pasar el AssetBundle al net provider) y `background-image: url(data:)` | rust-engine | prueba de tamaño sin width/height |
| 1.11 | Ejecutar en CI las pruebas unitarias de los crates vendorizados con nuestros parches (hoy cargo no las corre: no son miembros del workspace) | devops | job que corre `cargo test --lib` de fulgur-blitz/blitz-dom parcheados |
| 1.12 | `systemFonts:false` sin fuentes: hoy el texto desaparece sin error → devolver `Error::Render` | rust-engine | prueba que espera el error |
| 1.8 | `border-color` distinto por lado (hoy pinta los 4 lados con el color de arriba) | rust-engine | `per_side_border_colors` (layout.rs) deja de estar ignorada y pasa |

### Fase 2 — Probar lo heredado del renderizador (P1)

Cascada/especificidad/`!important`, variables, `calc/min/max/clamp`, unidades, selectores, `::before/::after`,
contadores, `position`, `overflow`, `opacity`, `transform` 2D, gradientes, `border-radius`, SVG inline,
enlaces y marcadores, HTML imperfecto. Cada uno: prueba que verifique el efecto, o fila "no soportado" en la matriz.
Regresión visual: render de referencia con pdftoppm o PyMuPDF (solo en tests) y diff con tolerancia, informe HTML en CI.

### Fase 3 — Paginación avanzada (P1)

`widows/orphans`, `:first/:left/:right`, páginas nombradas, márgenes espejo, `string-set` y encabezados
dinámicos (Fulgur trae `gcpm/string_set.rs` y `running.rs`), numeración por secciones. Documentos de
1/10/100/1000 páginas con texto por página y sin páginas vacías.

### Fase 4 — Integraciones (P1)

Laravel: ✅ `orientation()`, ✅ `pageNumbers()`, `fonts()`, `css()`,
`header()/footer()`. Node/NestJS con napi-rs (fase 3b de AGENTS.md). CLI: `--options-file`, para opciones de más de 32 KB en Windows.
`printBackground()` solo si el motor puede desactivar fondos; si no puede, no se añade (sería un no-op).

### Fase 5 — Rendimiento (P2)

Repetir benchmarks en máquina en reposo; p99; WeasyPrint si está disponible; perfil (ETW/perf) antes de optimizar.
Modo servidor/persistente para Laravel solo si el coste de arrancar el proceso aparece en el perfil.

### Fase 6 — PDF avanzado (P2)

Marcadores y enlaces (validar), compresión, marcas de agua (CSS), adjuntos. Cifrado, permisos,
combinar/dividir/rotar en un módulo separado (`angelito-pdf-ops`) sobre una biblioteca revisada (licencia y mantenimiento).

### Fase 7 — Estándares y firmas (P2)

PDF/UA y PDF/A-2b con veraPDF en CI; PAdES con una interfaz de firmante externa (HSM o proveedor), nunca con claves en el repo.

## Fuera de alcance por ahora

Motor de layout propio · JavaScript · formularios AcroForm interactivos (se representan solo visualmente) ·
AVIF (hasta que el renderizador lo soporte) · meta de N pruebas.
