# Coordinación de agentes — Angelito PDF Engine

El **coordinador** es la sesión principal de Claude Code. Los especialistas están en
`.claude/agents/*.md` y se invocan como subagentes. El coordinador reparte tareas, integra
y ejecuta la batería completa antes de cerrar una fase.

## Reglas

1. Cada agente edita solo los archivos que tiene asignados (tabla abajo). Si necesita cambiar
   otra cosa, lo pide en su informe final.
2. El contrato público es `angelito_pdf::{Engine, RenderOptions, render}` (ver `docs/architecture.md`).
   Solo `architect` lo cambia, con aprobación del coordinador y un ADR en `docs/adr/`.
3. Los bindings (CLI, PHP, Node) consumen **solo** el contrato público, nunca tipos de Fulgur.
4. Una función no está terminada hasta que tiene una prueba que se ejecuta y pasa. Compilar no es prueba.
5. Prohibido: inventar resultados, desactivar pruebas o lints para que pase el CI, stubs presentados como implementación.
6. Agentes en paralelo solo cuando no compartan archivos.

## Propiedad de archivos

| Agente | Archivos |
|---|---|
| architect | `docs/architecture.md`, `docs/adr/**` |
| researcher | `docs/research/**` |
| rust-engine | `crates/angelito-pdf/**`, `crates/angelito-pdf-cli/**` |
| html-css | `tests/fixtures/**`, `tests/visual/**`, `docs/css-support.md` |
| pagination-typography | `tests/fixtures/paged/**`, `crates/angelito-pdf/src/fonts.rs`, `docs/pagination.md` |
| laravel-php | `packages/php/**` |
| node-nestjs | `packages/node/**` |
| performance | `benches/**`, `docs/benchmarks.md` |
| security | `docs/security.md`, `tests/security/**` |
| qa | `tests/**` restantes, `scripts/check.*` |
| devops | `.github/**`, `release/**`, `deny.toml` |
| docs-writer | `README.md`, `CHANGELOG.md`, `examples/**`, resto de `docs/**` |

## Fases y criterios de salida

| Fase | Resultado verificable | Depende de | Estado |
|---|---|---|---|
| 0. Base tecnológica | `docs/research/evaluation.md` con pruebas ejecutadas; ADR-0001 | — | hecho |
| 1. Núcleo | `cargo test` genera un PDF real desde HTML+CSS (sin Chromium), validado con un parser PDF independiente | 0 | hecho (CI verde en Linux x64/ARM64, Windows x64, macOS Intel/ARM64) |
| 2. Fuentes, imágenes, tablas, paginación | fixtures de factura, ticket 58/80mm, reporte largo; nº de páginas y texto por página verificados | 1 | en curso: ver docs/ROADMAP.md fase 1 (1.1–1.7 hechas) |
| 3a. Laravel (`packages/php`) | Testbench: `Pdf::view()->download()` devuelve `application/pdf` válido | 1 | hecho (18 tests, Laravel 11–13, CI verde en Linux y Windows) |
| 3b. Node/NestJS (`packages/node`) | `npm test`: `await Pdf.fromHtml().render()` devuelve Buffer PDF válido sin bloquear el event loop | 1 | en curso: ver docs/ROADMAP.md fase 1 (1.1–1.7 hechas) |
| 4. Rendimiento | `docs/benchmarks.md` con p50/p95, RSS, tamaño, frío/caliente, datos crudos | 1 | hecho (máquina con carga; repetir en reposo) |
| 5. Distribución | CI matriz 5 plataformas, smoke test por binario, publicación npm/Packagist | 3a, 3b | Release v0.1.0 con 5 binarios + SHA256SUMS y Pages publicados; `pdf:install` verificado contra el Release real. Pendiente: alta en Packagist (manual) y npm (depende de 3b) |

3a, 3b y 4 son independientes entre sí → pueden correr en paralelo.
