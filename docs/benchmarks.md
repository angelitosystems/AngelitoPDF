# Benchmarks (fase 4)

Comparativa medida en **una sola máquina** el 2026-11-11 (14:57–15:08, UTC-5). Datos crudos — todas las
muestras, versiones, máquina, carga de CPU por celda — en [`benches/results.json`](../benches/results.json).

> **Aviso de carga:** durante toda la corrida la máquina **no estaba en reposo**: un proceso ajeno
> (`vmmem`, la VM de WSL/Hyper-V, más Defender) mantenía la CPU total en ~60–75 % antes de empezar
> (`system_cpu_percent_before` = 64.6 %) y en 67–90 % durante cada celda (`system_cpu_percent` por celda en
> el JSON, incluye a la herramienta medida). Los tiempos absolutos son por tanto pesimistas y con más ruido
> que en una máquina inactiva; las tres herramientas corrieron bajo la misma carga, una tras otra. Repetir
> en reposo antes de publicar cifras absolutas fuera del repo.

## Cómo reproducir

```
cargo build --release -p angelito-pdf-cli                 # target/release/angelito-pdf.exe
cargo build --release --manifest-path benches/warm/Cargo.toml   # bench in-process (caliente)
composer install --working-dir benches/dompdf             # dompdf/dompdf v3.1.6
pip install psutil pypdf pymupdf
python benches/test_cli_cold.py                           # auto-prueba del medidor
python benches/bench.py 20 5                              # 20 corridas por celda, 5 corridas de RSS
```

Variables opcionales: `PHP` (por defecto `C:\php84\php.exe`), `CHROME` (por defecto la ruta estándar de
Chrome en Windows). `bench.py` regenera `benches/fixtures/report-1000.html` (vía `benches/gen_report.py`) y
deja los PDF y un PNG de la página 1 de cada salida en `benches/out/` (ignorado por git).

## Máquina y versiones

| | |
|---|---|
| CPU | 13th Gen Intel Core i7-13650HX (14 núcleos / 20 hilos), 16 GB RAM |
| SO | Windows 11 Pro 10.0.26300 |
| angelito-pdf | 0.1.0, `rustc 1.98.1`, `--release` (thin LTO, 1 CGU, strip). Binario 17.9 MB |
| DOMPDF | v3.1.6 sobre PHP 8.4.21 NTS x64 (OPcache CLI activo, sin `file_cache`, JIT desactivado), `-d memory_limit=-1` |
| Chrome | Google Chrome 157.0.8103.40, `--headless --disable-gpu --no-pdf-header-footer --print-to-pdf=<out> file:///…` |
| wkhtmltopdf | **no instalado — no medido** |
| Medición | Python 3.12.10, psutil 7.2.2, pypdf 6.21.2 (nº de páginas), PyMuPDF 2.1 (texto, PNG) |

## Metodología

- **Frío** = un proceso por documento, tiempo de pared desde el `spawn` hasta la salida del proceso
  (`time.perf_counter`, sin muestreo de memoria en esas corridas).
  - angelito: `angelito-pdf.exe` con HTML por stdin y PDF por stdout (como lo usa `packages/php`).
  - DOMPDF: `php render.php cold <in> <out>` (arranque de PHP + autoload + render + escritura).
  - Chrome: un árbol de procesos de navegador por documento (como Browsershot/Snappy-chrome lanzan uno por PDF);
    perfil temporal que crea el propio Chrome headless.
- **Caliente** = mismo proceso, tras **un** render de calentamiento (reportado aparte, no entra en las estadísticas),
  tiempos tomados dentro del proceso:
  - angelito: `benches/warm` (crate aparte con su propio workspace; usa solo el contrato público
    `Engine::new` + `Engine::render`, con los mismos parches `vendor/` y perfil release que el raíz, y una copia
    de `Cargo.lock`). Un `Engine` reutilizado para todos los renders.
  - DOMPDF: `php render.php warm` — nueva instancia `Dompdf` por documento dentro del mismo proceso PHP (como un
    worker php-fpm que ya cargó las clases).
  - Chrome caliente (navegador persistente vía CDP/puppeteer) **no medido**.
- n = 20 muestras por celda; además 1 corrida de calentamiento en frío por celda, guardada en `warmup_ms` y excluida
  de las estadísticas (llena la caché de ficheros del SO). No se descartó ninguna otra muestra de esta corrida.
- p50 = mediana; p95 = `statistics.quantiles(n=20, method="inclusive")[18]` (interpolación lineal).
- **RSS pico**: 5 corridas adicionales por celda, separadas de las de tiempo. Se sondea el árbol de procesos
  (raíz + todos los descendientes) cada 2 ms. "RSS pico" = working set pico exacto del proceso raíz
  (`GetProcessMemoryInfo` tras su salida) + el mayor `peak_wset` visto de cada descendiente; se muestra el máximo de
  las 5 corridas. Para Chrome es una cota superior (los picos de cada proceso no tienen por qué coincidir) y la
  columna "muestreado" (máxima suma instantánea observada) es una cota inferior. Para angelito y DOMPDF (un proceso)
  el pico es exacto. En caliente, el RSS es el del proceso entero tras 21 renders.
- Tamaño y páginas: del PDF de la última corrida. En "angelito caliente" se reutilizan los datos del PDF del CLI
  (mismo motor; el tamaño en proceso coincide: `pdf_bytes_in_process`).

## Resultados

### simple — `benches/fixtures/simple.html` (260 B: `<h1>` + `<p>`)

| Herramienta | Modo | p50 ms | p95 ms | min ms | max ms | RSS pico MiB | RSS muestreado MiB | PDF bytes | Págs. |
|---|---|---|---|---|---|---|---|---|---|
| angelito | frío | 21.7 | 24.8 | 16.9 | 26.0 | 15.0 | 10.1 | 40 905 | 1 |
| angelito | caliente | 6.4 | 8.1 | 5.0 | 8.3 | 17.9 | 16.6 | 40 905 | 1 |
| DOMPDF | frío | 148.6 | 162.7 | 139.7 | 163.0 | 35.9 | 35.8 | 1 420 | 1 |
| DOMPDF | caliente | 5.5 | 7.1 | 4.6 | 7.2 | 37.4 | 37.2 | 1 420 | 1 |
| Chrome | frío | 630.0 | 672.3 | 609.6 | 738.2 | 725.7 | 677.1 | 40 880 | 1 |
| wkhtmltopdf | — | no medido | | | | | | | |

### invoice — `tests/fixtures/invoice.html` (12 KB, 90 filas, flex + grid + `@page` con pie)

| Herramienta | Modo | p50 ms | p95 ms | min ms | max ms | RSS pico MiB | RSS muestreado MiB | PDF bytes | Págs. |
|---|---|---|---|---|---|---|---|---|---|
| angelito | frío | 49.0 | 57.1 | 42.3 | 59.1 | 20.8 | 20.1 | 84 008 | 3 |
| angelito | caliente | 31.9 | 35.8 | 26.8 | 44.2 | 24.0 | 23.1 | 84 008 | 3 |
| DOMPDF | frío | 303.7 | 335.1 | 283.6 | 340.3 | 46.4 | 46.1 | 12 046 | 3 |
| DOMPDF | caliente | 142.7 | 151.7 | 130.1 | 153.1 | 49.3 | 49.3 | 12 046 | 3 |
| Chrome | frío | 659.5 | 684.6 | 628.7 | 686.8 | 757.3 | 711.7 | 195 221 | 3 |
| wkhtmltopdf | — | no medido | | | | | | | |

### report-1000 — `benches/fixtures/report-1000.html` (123 KB; la factura con 1000 filas, generada)

| Herramienta | Modo | p50 ms | p95 ms | min ms | max ms | RSS pico MiB | RSS muestreado MiB | PDF bytes | Págs. |
|---|---|---|---|---|---|---|---|---|---|
| angelito | frío | 245.0 | 280.3 | 226.0 | 307.2 | 54.4 | 54.3 | 157 070 | 22 |
| angelito | caliente | 243.1 | 251.5 | 214.1 | 272.1 | 62.2 | 61.4 | 157 070 | 22 |
| DOMPDF | frío | 3 217.3 | 3 568.1 | 2 937.9 | 3 583.9 | 190.1 | 190.0 | 74 202 | 22 |
| DOMPDF | caliente | 3 160.2 | 3 370.2 | 2 897.9 | 3 382.7 | 260.2 | 260.2 | 74 202 | 22 |
| Chrome | frío | 970.2 | 1 065.2 | 915.0 | 1 083.2 | 932.7 | 822.4 | 1 471 397 | 21 |
| wkhtmltopdf | — | no medido | | | | | | | |

Primer render en proceso (excluido arriba): angelito 8.9 / 33.6 / 212.9 ms; DOMPDF 74.2 / 230.1 / 3 200.7 ms
(simple / invoice / report-1000). `Engine::new` con opciones por defecto: 0.01–0.02 ms.

## Lectura

- **Frío (un proceso por documento)**: angelito es el más rápido en los tres documentos: ~6.9× DOMPDF y ~29× Chrome
  en `simple`, ~6.2× y ~13× en `invoice`, ~13× y ~4× en `report-1000` (cocientes de p50).
- **Caliente**: en `simple` DOMPDF caliente (5.5 ms) es algo más rápido que angelito caliente (6.4 ms); a ese tamaño
  domina el coste fijo y DOMPDF no incrusta fuentes (usa Helvetica base). En `invoice` angelito caliente es ~4.5×
  más rápido y en `report-1000` ~13×.
- **Coste del proceso en angelito**: frío − caliente ≈ 15–17 ms en documentos pequeños; en `report-1000` la diferencia
  desaparece entre el ruido (245 vs 243 ms): el render domina. Esto es lo que mide el coste de que `packages/php`
  use un CLI (ver `docs/architecture.md`).
- **Memoria**: angelito 15–62 MiB; DOMPDF 36–260 MiB y crece fuerte con el tamaño de la tabla; Chrome 0.7–0.9 GiB
  (cota superior del árbol de procesos).
- **DOMPDF y `memory_limit`**: en `report-1000` DOMPDF reporta `memory_get_peak_usage(true)` = 218 MiB (218 589 568 B)
  en caliente y 190 MiB de RSS en frío. Con el `memory_limit = 128M` por defecto de PHP ese documento **fallaría**;
  por eso se midió con `-d memory_limit=-1`.

## Diferencias de salida (no es la misma salida en las tres herramientas)

Comprobado sobre los PDF generados (texto con PyMuPDF, páginas con pypdf, PNG de la página 1 revisado a ojo):

| Comprobación | angelito | DOMPDF 3.1.6 | Chrome 157 |
|---|---|---|---|
| Cabecera `display:flex` (logo a la derecha del título) | sí | **no** (logo debajo del título) | sí |
| Bloque `display:grid` de 3 columnas | sí | **no** (3 cajas apiladas en vertical) | sí |
| `@media print { .noprint {display:none} }` oculta "ESTO NO DEBE APARECER" | sí | **no** (DOMPDF usa medio `screen` por defecto, como `barryvdh/laravel-dompdf`) | sí |
| Pie `@page @bottom-center` "Página N de M" | sí, pero **alineado a la izquierda** y pegado a la última fila de la tabla (a 60 dpi parece solaparse), no centrado | **no** (no soporta cajas de margen) | sí, centrado |
| `box-shadow` del logo | sí (tenue) | no apreciable en el PNG a 50 dpi | sí |
| Acentos (áéíóú ñ) en el texto extraído | sí | sí | sí |
| Fuentes | incrusta subconjunto (de ahí 41 KB en `simple`) | Helvetica base, sin incrustar (1.4 KB) | incrusta |
| Páginas `invoice` / `report-1000` | 3 / 22 | 3 / 22 | 3 / 21 |

Como DOMPDF no aplica flex/grid/`@page` margin boxes, en estos documentos hace **menos trabajo de maquetación** que
los otros dos; la comparación de tiempo no es de salidas equivalentes. Chrome mete más filas por página en
`report-1000` (21 vs 22 páginas), por diferencias de métricas de fuente/interlineado.

Nota para el coordinador: `invoice.html` produce **3 páginas** en las tres herramientas, no 4 como decía la versión
anterior de este documento y la descripción de la fase.

## Corridas descartadas (y por qué)

- Dos corridas de prueba con `bench.py 2 1` mientras se desarrollaba el arnés (n = 2, no válidas estadísticamente).
- Dos corridas completas (`bench.py 20 5`) que **se solaparon entre sí** por un error mío al detener la primera
  (el `taskkill` mató el shell, no el proceso Python); se midieron compitiendo por CPU entre ellas y se descartaron
  enteras. Los números publicados son de una tercera corrida, única en ejecución.
- Pruebas manuales de Chrome con `--user-data-dir` nuevo por corrida mientras compilaba `cargo` en paralelo
  (9–25 s por PDF): descartadas por la compilación concurrente; el arnés no pasa `--user-data-dir`.

En las corridas descartadas los órdenes de magnitud y el orden entre herramientas fueron los mismos; DOMPDF frío en
`simple` varió más que el resto (p50 entre ~109 y ~190 ms según la corrida).

## No medido

wkhtmltopdf (no instalado); Chrome con navegador persistente (CDP); concurrencia/throughput; Linux y macOS;
documentos con muchas imágenes; máquina en reposo; diff visual automatizado (solo revisión manual de la página 1).
No se han propuesto optimizaciones: no hay perfil (`perf`/ETW) que señale un cuello de botella todavía.
