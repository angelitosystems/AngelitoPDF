import { Code, CodeTabs, Note, BenchChart, BenchTable, bench, cell, fmt } from './ui.jsx'

const REPO = 'https://github.com/angelitosystems/AngelitoPDF/blob/main/'
const A = ({ to, children }) => <a href={'#/docs/' + to}>{children}</a>
const Src = ({ path, children }) => <a href={REPO + path} target="_blank" rel="noreferrer">{children ?? path}</a>

const INVOICE_BLADE = `
{{-- resources/views/facturas/show.blade.php --}}
<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<style>
  @page {
    size: A4;
    margin: 15mm;
    @bottom-center { content: "Página " counter(page) " de " counter(pages); font-size: 9px; }
  }
  body  { font-family: sans-serif; font-size: 11px; color: #222 }
  .head { display: flex; justify-content: space-between; border-bottom: 3px solid #0a5 }
  table { width: 100%; border-collapse: collapse }
  thead th { background: #0a5; color: #fff; padding: 4px; text-align: left }
  td { border-bottom: 1px solid #ddd; padding: 3px }
  tr { break-inside: avoid }
  .num { text-align: right }
</style>
</head>
<body>
  <div class="head">
    <h1>FACTURA {{ $factura->serie }}-{{ $factura->numero }}</h1>
    <p>{{ $factura->cliente }}</p>
  </div>
  <table>
    <thead><tr><th>Descripción</th><th>Cant.</th><th class="num">Importe</th></tr></thead>
    <tbody>
      @foreach ($factura->items as $item)
        <tr><td>{{ $item->descripcion }}</td><td>{{ $item->cantidad }}</td><td class="num">S/ {{ number_format($item->importe, 2) }}</td></tr>
      @endforeach
    </tbody>
  </table>
</body>
</html>`

export const PAGES = [
  {
    group: 'Primeros pasos', slug: 'introduccion', title: 'Introducción',
    body: () => (
      <>
        <p className="lead">Angelito PDF Engine convierte <strong>HTML + CSS en PDF</strong> con un motor nativo escrito en Rust. No usa Chromium, Puppeteer, Playwright ni Docker, y no accede a la red.</p>
        <h2>Qué incluye</h2>
        <ul>
          <li><strong>Motor Rust</strong> (<code>angelito-pdf</code>): la biblioteca con el contrato público <code>Engine</code>, <code>RenderOptions</code> y <code>render</code>.</li>
          <li><strong>CLI</strong> (<code>angelito-pdf</code>): recibe el HTML por stdin o desde un archivo y devuelve el PDF por stdout o en un archivo. Todos los lenguajes usan las mismas opciones JSON.</li>
          <li><strong>Paquete Laravel</strong> (<code>angelitosystems/pdf</code>): <code>Pdf::view()</code>, <code>download()</code>, <code>stream()</code> y <code>save()</code> con Storage.</li>
        </ul>
        <h2>Cuándo usarlo</h2>
        <p>Sirve para facturas, boletas, tickets térmicos de 58/80 mm, reportes de muchas páginas y constancias: documentos maquetados con CSS moderno (Flexbox, Grid, <code>@page</code>) que hoy obligan a elegir entre DOMPDF, que no maqueta flex ni grid, y Chrome headless, que tarda unos 650 ms y usa unos 750 MiB por documento.</p>
        <Note kind="warn" title="Estado: 0.1.0-dev">
          Probado a mano en Windows x64. Los binarios de Linux y macOS los compila y prueba GitHub Actions en cada versión publicada. Aún no está en crates.io. No es un navegador completo: no ejecuta JavaScript. Mira lo que sí funciona en <A to="css">Soporte CSS</A>.
        </Note>
        <h2>Cómo funciona</h2>
        <Code lang="text">{`
Laravel (PHP) ──► angelito-pdf CLI ──┐   HTML por stdin, PDF por stdout
Rust ────────────────────────────────┤
                                     ▼
           crates/angelito-pdf  (Engine · RenderOptions · render)
                                     ▼
        Fulgur (Blitz/Stylo → Taffy → Parley → Krilla) → PDF`}</Code>
      </>
    ),
  },
  {
    group: 'Primeros pasos', slug: 'instalacion', title: 'Instalación',
    body: () => (
      <>
        <p className="lead">Hay dos piezas: el <strong>paquete de Composer</strong>, que es código PHP, y el <strong>binario</strong> <code>angelito-pdf</code>, que es el motor nativo y se descarga aparte con un comando.</p>
        <h2>1. Instalar el paquete</h2>
        <p>Requisitos: PHP 8.2 o superior, Laravel 11 o 12 y <code>proc_open</code> habilitado.</p>
        <Code lang="bash">{`composer require angelitosystems/pdf`}</Code>
        <p>El ServiceProvider y la Facade <code>Pdf</code> se registran solos gracias al <i>auto-discovery</i>.</p>
        <h2>2. Descargar el binario</h2>
        <Code lang="bash">{`php artisan pdf:install`}</Code>
        <p>Detecta tu sistema y arquitectura, descarga de <a href="https://github.com/angelitosystems/AngelitoPDF/releases" target="_blank" rel="noreferrer">GitHub Releases</a> el binario de la misma versión del paquete, comprueba su SHA-256 y genera un PDF de prueba. Lo guarda en <code>storage/app/angelito-pdf/</code>, donde el paquete lo busca por defecto.</p>
        <div className="scroll"><table>
          <thead><tr><th>Sistema</th><th>Binario</th></tr></thead>
          <tbody>
            {[
              ['Linux x64 (glibc 2.35 o superior)', 'angelito-pdf-x86_64-unknown-linux-gnu'],
              ['Linux ARM64', 'angelito-pdf-aarch64-unknown-linux-gnu'],
              ['Windows x64', 'angelito-pdf-x86_64-pc-windows-msvc.exe'],
              ['macOS Intel', 'angelito-pdf-x86_64-apple-darwin'],
              ['macOS Apple Silicon', 'angelito-pdf-aarch64-apple-darwin'],
            ].map(([os, f]) => <tr key={f}><td>{os}</td><td><code>{f}</code></td></tr>)}
          </tbody>
        </table></div>
        <p>Opciones: <code>--tag=v0.1.0</code> elige la versión, <code>--path=/opt/angelito/angelito-pdf</code> elige el destino y <code>--target=x86_64-unknown-linux-gnu</code> sirve para descargar el binario de otra plataforma, por ejemplo al preparar una imagen Docker.</p>
        <Note title="En producción">
          Ejecuta <code>php artisan pdf:install</code> en el despliegue, después de <code>composer install</code>. Si tu servidor no tiene salida a internet, descarga el binario a mano desde Releases e indica la ruta:
        </Note>
        <Code lang=".env">{`
ANGELITO_PDF_BINARY=/opt/angelito/angelito-pdf
ANGELITO_PDF_TIMEOUT=60`}</Code>
        <h2>3. Comprobar</h2>
        <Code lang="bash">{`php artisan tinker --execute="echo strlen(AngelitoPdf\Facades\Pdf::html('<h1>Hola</h1>')->output());"`}</Code>
        <p>Si imprime un número (los bytes del PDF), ya está todo listo. Sigue en <A to="inicio-rapido">Inicio rápido</A>.</p>
        <h2>Compilar desde el código</h2>
        <p>Para otra plataforma o para contribuir, necesitas Rust 1.89 o superior:</p>
        <Code lang="bash">{`
git clone https://github.com/angelitosystems/AngelitoPDF
cd AngelitoPDF
cargo build --release -p angelito-pdf-cli
# → target/release/angelito-pdf  (angelito-pdf.exe en Windows)`}</Code>
      </>
    ),
  },
  {
    group: 'Primeros pasos', slug: 'inicio-rapido', title: 'Inicio rápido',
    body: () => (
      <>
        <p className="lead">Tu primer PDF en Laravel, en tres pasos.</p>
        <h2>1. Crear la vista</h2>
        <Code lang="blade">{`
{{-- resources/views/pdf/hola.blade.php --}}
<style>
  @page { size: A4; margin: 20mm }
  h1 { color: #0a5 }
</style>
<h1>Hola, {{ $nombre }}</h1>
<p>Generado el {{ now()->format('d/m/Y') }}.</p>`}</Code>
        <h2>2. Devolverla desde una ruta</h2>
        <Code lang="php">{`
use AngelitoPdf\\Facades\\Pdf;

Route::get('/hola', fn () =>
    Pdf::view('pdf.hola', ['nombre' => 'Angelito'])->download('hola.pdf')
);`}</Code>
        <h2>3. Abrir</h2>
        <p>Al visitar <code>/hola</code> se descarga <code>hola.pdf</code>. Si usas <code>stream()</code> en lugar de <code>download()</code>, el PDF se abre en el navegador.</p>
        <CodeTabs tabs={[
          { label: 'Laravel', lang: 'php', code: `Pdf::html('<h1>Hola</h1>')->format('A5')->margin(10)->stream('hola.pdf');` },
          { label: 'CLI', lang: 'bash', code: `echo '<h1>Hola</h1>' | angelito-pdf --options '{"format":"A5","margin":10}' > hola.pdf` },
          { label: 'Rust', lang: 'rust', code: `let pdf = angelito_pdf::render("<h1>Hola</h1>", &RenderOptions { format: "A5".into(), ..Default::default() })?;` },
        ]} />
      </>
    ),
  },
  {
    group: 'Laravel', slug: 'laravel', title: 'API de Laravel',
    body: () => (
      <>
        <p className="lead">Todo empieza en la Facade <code>AngelitoPdf\Facades\Pdf</code>, que devuelve un <i>builder</i> encadenable.</p>
        <h2>Crear</h2>
        <table className="api"><tbody>
          <tr><td><code>Pdf::view($vista, $datos = [])</code></td><td>Renderiza una vista Blade y la usa como HTML.</td></tr>
          <tr><td><code>Pdf::html($html)</code></td><td>Usa un HTML que ya tengas en una cadena.</td></tr>
        </tbody></table>
        <h2>Configurar</h2>
        <table className="api"><tbody>
          <tr><td><code>-&gt;format('A4')</code></td><td>A3, A4, A5, B4, B5, Letter, Legal o Ledger.</td></tr>
          <tr><td><code>-&gt;landscape()</code></td><td>Orientación horizontal. <code>landscape(false)</code> la desactiva.</td></tr>
          <tr><td><code>-&gt;margin(10)</code></td><td>Margen en mm. Acepta <code>margin(v, h)</code> o <code>margin(t, r, b, l)</code>.</td></tr>
          <tr><td><code>-&gt;options([...])</code></td><td>Cualquier otra opción del motor; mira <A to="opciones">Opciones</A>. Las claves desconocidas se rechazan.</td></tr>
        </tbody></table>
        <h2>Obtener el PDF</h2>
        <table className="api"><tbody>
          <tr><td><code>-&gt;download('x.pdf')</code></td><td><code>Response</code> con <code>application/pdf</code> y <code>attachment</code>, para descargar.</td></tr>
          <tr><td><code>-&gt;stream('x.pdf')</code></td><td>Lo mismo con <code>inline</code>, para abrirlo en el navegador.</td></tr>
          <tr><td><code>-&gt;save($ruta, $disco = null)</code></td><td>Guarda en un disco de Storage (s3, local…) o en una ruta del sistema de archivos.</td></tr>
          <tr><td><code>-&gt;output()</code></td><td>Devuelve los bytes del PDF como <code>string</code>.</td></tr>
        </tbody></table>
        <h2>Ejemplos</h2>
        <Code lang="php">{`
use AngelitoPdf\\Facades\\Pdf;

// Controlador
public function show(Factura $factura)
{
    return Pdf::view('facturas.show', compact('factura'))
        ->format('A4')
        ->margin(10, 15)
        ->options(['title' => "Factura {$factura->numero}", 'author' => config('app.name')])
        ->download("{$factura->numero}.pdf");
}

// Guardar en S3 y adjuntar a un correo
Pdf::view('facturas.show', compact('factura'))->save("facturas/{$factura->numero}.pdf", 's3');

Mail::to($cliente)->send(new FacturaMail(
    Pdf::view('facturas.show', compact('factura'))->output()
));`}</Code>
        <h2>En una cola</h2>
        <p>Cada render lanza un proceso corto, unos 50 ms para una factura. Para lotes grandes, genera los PDF en un <i>Job</i>:</p>
        <Code lang="php">{`
class GenerarFactura implements ShouldQueue
{
    public function __construct(public Factura $factura) {}

    public function handle(): void
    {
        Pdf::view('facturas.show', ['factura' => $this->factura])
            ->save("facturas/{$this->factura->numero}.pdf", 's3');
    }
}`}</Code>
      </>
    ),
  },
  {
    group: 'Laravel', slug: 'configuracion', title: 'Configuración',
    body: () => (
      <>
        <p>Publicar la configuración es opcional:</p>
        <Code lang="bash">{`php artisan vendor:publish --tag=pdf-config`}</Code>
        <Code lang="php">{`
// config/pdf.php
return [
    // Ruta absoluta al binario angelito-pdf. No se descarga automáticamente.
    'binary' => env('ANGELITO_PDF_BINARY'),

    // Segundos antes de matar el proceso de render.
    'timeout' => (float) env('ANGELITO_PDF_TIMEOUT', 60),

    // Opciones por defecto (mismas claves que el CLI). Cada documento puede sobrescribirlas.
    'defaults' => [
        'format' => 'A4',
    ],
];`}</Code>
        <p>Por ejemplo, para que todos los PDF salgan iguales en cualquier servidor:</p>
        <Code lang="php">{`
'defaults' => [
    'format' => 'A4',
    'margin' => 10,
    'systemFonts' => false,          // no depender de las fuentes instaladas
    'fonts' => [resource_path('fonts/Inter.ttf')],
    'lang' => 'es',
],`}</Code>
      </>
    ),
  },
  {
    group: 'Laravel', slug: 'errores', title: 'Errores y límites',
    body: () => (
      <>
        <p>Cualquier fallo lanza <code>AngelitoPdf\PdfException</code>. Su <code>getCode()</code> indica la causa:</p>
        <table className="api"><tbody>
          <tr><td><code>1</code></td><td>Error de render o de E/S, por ejemplo HTML demasiado grande o demasiado anidado.</td></tr>
          <tr><td><code>2</code></td><td>Opciones inválidas, como una clave desconocida o un formato inexistente. El mensaje dice cuál.</td></tr>
          <tr><td><code>-1</code></td><td>No se encontró el binario o se superó el <code>timeout</code>. En ese caso el proceso se termina.</td></tr>
        </tbody></table>
        <Code lang="php">{`
use AngelitoPdf\\PdfException;

try {
    return Pdf::view('reporte', $datos)->download('reporte.pdf');
} catch (PdfException $e) {
    report($e);
    abort($e->getCode() === -1 ? 504 : 500, 'No se pudo generar el PDF');
}`}</Code>
        <h2>Límites por defecto</h2>
        <ul>
          <li>Entrada máxima de 10 MiB de HTML. Se cambia con <code>maxInputBytes</code>.</li>
          <li>Hay un límite de profundidad de anidamiento y de CPU para las plantillas.</li>
          <li>Cada archivo cargado (CSS, imagen, fuente) puede ocupar hasta 32 MiB.</li>
        </ul>
        <Note kind="warn" title="Opciones muy grandes en Windows">
          Las opciones viajan como argumento del proceso, y en Windows la línea de comandos admite unos 32 KB. Si pasas un <code>data</code> enorme, renderiza con Blade, porque los datos se procesan en PHP y no viajan en las opciones.
        </Note>
      </>
    ),
  },
  {
    group: 'Laravel', sub: 'Ejemplos', slug: 'ejemplo-factura', title: 'Factura A4',
    body: () => (
      <>
        <p className="lead">Factura con cabecera en flex, tabla de varias páginas que repite el <code>thead</code> y pie «Página N de M».</p>
        <Code lang="blade">{INVOICE_BLADE}</Code>
        <Code lang="php">{`return Pdf::view('facturas.show', compact('factura'))->download("{$factura->numero}.pdf");`}</Code>
        <p>Esta plantilla es una versión reducida de <Src path="tests/fixtures/invoice.html" />, el documento de las pruebas. Con 90 filas salen 3 páginas en unos {fmt(cell('invoice', 'angelito').p50, 0)} ms.</p>
        <Note kind="warn" title="Problema conocido">
          El pie <code>@bottom-center</code> todavía sale alineado a la izquierda, no centrado. Está previsto corregirlo en la fase 2.
        </Note>
      </>
    ),
  },
  {
    group: 'Laravel', sub: 'Ejemplos', slug: 'ejemplo-ticket', title: 'Ticket térmico 58/80 mm',
    body: () => (
      <>
        <p className="lead">Para impresoras térmicas, define un tamaño en mm con <code>widthMm</code> y <code>heightMm</code>. Las dos opciones son obligatorias.</p>
        <Code lang="php">{`
return Pdf::view('pos.ticket', compact('venta'))
    ->options(['widthMm' => 80, 'heightMm' => 200, 'margin' => [4, 3, 4, 3]])
    ->stream('ticket.pdf');`}</Code>
        <Code lang="blade">{`
<style>
  body { font-family: monospace; font-size: 9px; margin: 0 }
  .c { text-align: center } .r { text-align: right }
  table { width: 100% } hr { border: 0; border-top: 1px dashed #000 }
</style>
<div class="c"><strong>{{ config('app.name') }}</strong><br>RUC 20123456789</div>
<hr>
<table>
  @foreach ($venta->items as $i)
    <tr><td>{{ $i->cantidad }} × {{ $i->nombre }}</td><td class="r">{{ number_format($i->total, 2) }}</td></tr>
  @endforeach
</table>
<hr>
<div class="r"><strong>TOTAL S/ {{ number_format($venta->total, 2) }}</strong></div>`}</Code>
        <p>Para papel de 58 mm usa <code>'widthMm' =&gt; 58</code>.</p>
        <Note title="Alto fijo">
          El alto es fijo. Calcula un valor proporcional al número de líneas, por ejemplo <code>60 + count($items) * 6</code>. Si el contenido no cabe, el motor crea otra página.
        </Note>
      </>
    ),
  },
  {
    group: 'Laravel', sub: 'Ejemplos', slug: 'ejemplo-reporte', title: 'Reporte de muchas páginas',
    body: () => (
      <>
        <p className="lead">Para tablas largas: <code>thead</code> que se repite en cada página, filas que no se parten, saltos de página forzados y una versión para pantalla oculta al imprimir.</p>
        <Code lang="css">{`
@page { size: A4 landscape; margin: 12mm;
        @bottom-right { content: counter(page) " / " counter(pages) } }
thead { display: table-header-group }   /* se repite en cada página */
tr    { break-inside: avoid }           /* no partir filas */
.seccion { break-before: page }         /* empezar en página nueva */
@media print { .solo-pantalla { display: none } }`}</Code>
        <Code lang="php">{`
Pdf::view('reportes.ventas', ['filas' => Venta::whereYear('fecha', 2026)->get()])
    ->landscape()
    ->save('reportes/ventas-2026.pdf', 'local');`}</Code>
        <p>Como referencia, el reporte de pruebas de 1000 filas (22 páginas) se genera en unos {fmt(cell('report-1000', 'angelito').p50, 0)} ms con {fmt(cell('report-1000', 'angelito').rss, 0)} MiB de memoria. Mira los <A to="benchmarks">Benchmarks</A>.</p>
      </>
    ),
  },
  {
    group: 'Laravel', sub: 'Ejemplos', slug: 'imagenes-fuentes', title: 'Imágenes, fuentes y CSS',
    body: () => (
      <>
        <p className="lead">Por seguridad el motor no lee archivos ni accede a la red. Los recursos se le pasan de forma explícita.</p>
        <h2>Imágenes</h2>
        <p>Registra cada imagen con un nombre y úsalo como <code>src</code>. Indica siempre <code>width</code> y <code>height</code>.</p>
        <Code lang="php">{`
Pdf::view('facturas.show', compact('factura'))
    ->options(['images' => ['logo' => public_path('img/logo.png')]])
    ->download('f.pdf');`}</Code>
        <Code lang="html">{`<img src="logo" width="120" height="40" alt="Logo">`}</Code>
        <Note kind="warn" title="Aún no soportado">
          <code>&lt;img src="data:..."&gt;</code> todavía no funciona. Las imágenes sin tamaño explícito tienen soporte parcial.
        </Note>
        <h2>Hojas de estilo (Tailwind compilado, etc.)</h2>
        <Code lang="php">{`
->options(['css' => [file_get_contents(public_path('build/pdf.css'))]])
// o permitir <link rel="stylesheet"> y @import dentro de una carpeta:
->options(['baseDir' => resource_path('pdf')])`}</Code>
        <p>Con <code>baseDir</code> el motor solo lee dentro de esa carpeta: bloquea <code>..</code> y las rutas UNC.</p>
        <h2>Fuentes</h2>
        <Code lang="php">{`->options(['fonts' => [resource_path('fonts/Inter-Regular.ttf')], 'systemFonts' => false])`}</Code>
        <Note title="Sin prueba propia">
          Según el renderizador, se pueden incrustar fuentes TTF/OTF/TTC/WOFF2, pero todavía no tenemos una prueba propia que lo confirme (fase 2).
        </Note>
      </>
    ),
  },
  {
    group: 'Laravel', sub: 'Ejemplos', slug: 'plantillas', title: 'Plantillas con datos (sin Blade)',
    body: () => (
      <>
        <p className="lead">Si pasas <code>data</code>, el HTML se trata como una plantilla MiniJinja (sintaxis Jinja). El HTML se escapa automáticamente. Esto sirve fuera de Laravel: en el CLI, en Rust o con plantillas guardadas en la base de datos.</p>
        <CodeTabs tabs={[
          { label: 'Laravel', lang: 'php', code: `Pdf::html('<h1>Factura {{ n }}</h1>{% for i in items %}<p>{{ i }}</p>{% endfor %}')
    ->options(['data' => ['n' => 'F001-1', 'items' => ['Uno', 'Dos']]])
    ->output();` },
          { label: 'CLI', lang: 'bash', code: `angelito-pdf -o factura.pdf --options '{"data":{"n":"F001-1"}}' factura.html` },
        ]} />
        <Note title="Blade o MiniJinja">
          En Laravel, normalmente <code>Pdf::view()</code> con Blade es más cómodo. Usa <code>data</code> cuando la plantilla venga del usuario: MiniJinja tiene límite de CPU y no ejecuta PHP.
        </Note>
      </>
    ),
  },
  {
    group: 'Referencia', slug: 'opciones', title: 'Opciones',
    body: () => (
      <>
        <p className="lead">Las mismas opciones JSON sirven para el CLI, Laravel (<code>options()</code>) y Rust (<code>RenderOptions</code>). Las claves van en camelCase y las desconocidas se rechazan.</p>
        <div className="scroll"><table>
          <thead><tr><th>Clave</th><th>Tipo</th><th>Por defecto</th><th>Descripción</th></tr></thead>
          <tbody>
            {[
              ['format', 'string', '"A4"', 'A3, A4, A5, B4, B5, Letter, Legal, Ledger'],
              ['widthMm, heightMm', 'number', '—', 'Tamaño a medida en mm. Hacen falta los dos.'],
              ['landscape', 'bool', 'false', 'Orientación horizontal'],
              ['margin', 'number | [t,r,b,l]', '@page del CSS', 'Margen en milímetros'],
              ['title, author, lang', 'string', '—', 'Metadatos del PDF'],
              ['css', 'string[]', '[]', 'Hojas de estilo extra'],
              ['fonts', 'path[]', '[]', 'TTF/OTF/TTC/WOFF2 que se incrustan'],
              ['images', '{nombre: path}', '{}', 'Imágenes disponibles como <img src="nombre">'],
              ['baseDir', 'path', 'ninguno', 'Raíz para <link> y @import. Sin ella no se accede a archivos.'],
              ['data', 'object', '—', 'Trata el HTML como plantilla MiniJinja'],
              ['systemFonts', 'bool', 'true', 'false para obtener la misma salida en cualquier máquina'],
              ['maxInputBytes', 'number', '10485760', 'Tamaño máximo del HTML'],
            ].map(([k, t, d, s]) => <tr key={k}><td><code>{k}</code></td><td>{t}</td><td><code>{d}</code></td><td>{s}</td></tr>)}
          </tbody>
        </table></div>
      </>
    ),
  },
  {
    group: 'Referencia', slug: 'cli', title: 'CLI',
    body: () => (
      <>
        <Code lang="text">{`angelito-pdf [--options <json>] [-o <salida.pdf>] [<entrada.html> | -]`}</Code>
        <p>El HTML se lee de un archivo o de stdin, y el PDF se escribe en <code>-o</code> o en stdout. Los errores solo van a stderr.</p>
        <Code lang="bash">{`
echo '<h1>Hola</h1>' | angelito-pdf --options '{"format":"A5","margin":10}' > hola.pdf
angelito-pdf -o factura.pdf --options '{"data":{"n":"F001-1"}}' factura.html
angelito-pdf --version`}</Code>
        <table className="api"><tbody>
          <tr><td><code>0</code></td><td>Correcto</td></tr>
          <tr><td><code>1</code></td><td>Error de render o de E/S</td></tr>
          <tr><td><code>2</code></td><td>Uso u opciones inválidas</td></tr>
        </tbody></table>
        <p>Desde cualquier lenguaje basta con lanzar el proceso sin shell, escribir el HTML en stdin y leer stdout. El paquete PHP lo hace así en <Src path="packages/php/src/Renderer.php">Renderer.php</Src>.</p>
      </>
    ),
  },
  {
    group: 'Referencia', slug: 'rust', title: 'Rust',
    body: () => (
      <>
        <Code lang="toml">{`
[dependencies]
angelito-pdf = { git = "https://github.com/angelitosystems/AngelitoPDF" }  # aún no está en crates.io`}</Code>
        <Code lang="rust">{`
use angelito_pdf::{Engine, Margin, RenderOptions};

let opts = RenderOptions { format: "A4".into(), margin: Some(Margin::Uniform(10.0)), ..Default::default() };
let engine = Engine::new(&opts)?;          // créalo una vez: las fuentes se cargan una sola vez. Es Send + Sync.
let pdf: Vec<u8> = engine.render("<h1>Factura</h1>")?;`}</Code>
        <p>Un <code>Engine</code> se puede reutilizar y compartir entre hilos. Con el motor ya cargado, una factura tarda unos {fmt(cell('invoice', 'angelito', 'warm').p50, 0)} ms. Tipos de error: <code>InvalidOptions</code>, <code>InputTooLarge</code>, <code>NestingTooDeep</code> y <code>Render</code>.</p>
      </>
    ),
  },
  {
    group: 'Referencia', slug: 'css', title: 'Soporte CSS',
    body: () => (
      <>
        <p className="lead">«Soportado» significa que una prueba automática del repositorio lo cubre y pasa.</p>
        <div className="scroll"><table>
          <thead><tr><th>Característica</th><th>Estado</th></tr></thead>
          <tbody>
            {[
              ['Texto, encabezados, colores, UTF-8 y acentos', 'Soportado'],
              ['display: flex / grid', 'Soportado (solo revisión visual)'],
              ['Tablas de varias páginas, thead repetido', 'Soportado'],
              ['@page size/margin, margin boxes, counter(page) / counter(pages)', 'Soportado'],
              ['@media print / screen, break-before: page', 'Soportado'],
              ['Formatos A3–Ledger, landscape, mm a medida (58/80 mm)', 'Soportado'],
              ['border, border-radius, box-shadow exterior', 'Soportado (solo revisión visual)'],
              ['<img> registrada con width y height', 'Soportado'],
              ['<link rel=stylesheet> / @import dentro de baseDir', 'Soportado'],
              ['Plantillas MiniJinja con datos', 'Soportado'],
              ['break-inside: avoid, fuentes propias, SVG inline, transform, gradientes', 'Lo afirma el renderizador, sin prueba propia'],
              ['<img src="data:...">', 'Pendiente'],
              ['box-shadow inset, text-shadow', 'No soportado'],
              ['Recursos http(s), JavaScript', 'Bloqueado a propósito'],
            ].map(([f, s]) => <tr key={f}><td>{f}</td><td>{s}</td></tr>)}
          </tbody>
        </table></div>
        <p>Matriz completa, con el nombre de cada prueba: <Src path="docs/css-support.md" />.</p>
      </>
    ),
  },
  {
    group: 'Referencia', slug: 'benchmarks', title: 'Benchmarks',
    body: () => (
      <>
        <p className="lead">Angelito PDF comparado con DOMPDF {bench.versions.dompdf} y {bench.versions.chrome}. Son 20 ejecuciones por celda, con un proceso por documento («frío»), que es como lo usa Laravel.</p>
        <BenchChart />
        <h2>Todos los datos</h2>
        <p>«Caliente» significa que el motor ya está cargado en el mismo proceso: <code>Engine</code> en Rust, o DOMPDF después de un render de calentamiento.</p>
        <BenchTable />
        <h2>Lee esto antes de citar cifras</h2>
        <ul>
          <li>Máquina: {bench.machine.cpu} con Windows 11. Había carga ajena en la CPU (la VM de WSL, entre el 60 y el 90 %), así que las cifras absolutas salen pesimistas. Las tres herramientas se midieron una tras otra con la misma carga.</li>
          <li>DOMPDF hace menos trabajo: no aplica flex ni grid, no pinta los pies de <code>@page</code>, usa el medio <code>screen</code> y no incrusta fuentes. Por eso sus PDF pesan menos. Con el reporte de 1000 filas necesita unos 218 MiB de PHP, así que no cabe en el <code>memory_limit=128M</code> por defecto.</li>
          <li>Chrome se midió con un proceso por documento, como Browsershot o Snappy. No se midió con un navegador persistente. wkhtmltopdf no se midió porque no estaba instalado.</li>
        </ul>
        <p>Medido del {bench.started.slice(0, 16).replace('T', ' ')} al {bench.finished.slice(11, 16)}. Para reproducir: <code>{bench.command}</code>. Metodología: <Src path="docs/benchmarks.md" />. Datos crudos: <Src path="benches/results.json" />.</p>
      </>
    ),
  },
  {
    group: 'Referencia', slug: 'seguridad', title: 'Seguridad',
    body: () => (
      <>
        <p className="lead">Por defecto el motor es seguro, incluso con HTML que no es de confianza.</p>
        <ul>
          <li><strong>Sin red:</strong> nunca descarga recursos http(s), así que no hay riesgo de SSRF.</li>
          <li><strong>Sin archivos</strong> salvo los que registres en <code>images</code>/<code>fonts</code> o los que estén dentro de <code>baseDir</code>. Bloquea el recorrido con <code>..</code> y las rutas UNC/SMB (en Windows evita fugas de NTLM).</li>
          <li><strong>Sin JavaScript.</strong></li>
          <li><strong>Límites:</strong> 10 MiB de HTML, profundidad de anidamiento, CPU de las plantillas, 32 MiB por archivo y <code>timeout</code> en Laravel.</li>
          <li><strong>Sin shell:</strong> Laravel lanza el binario con un array de argumentos, sin pasar por un intérprete de comandos.</li>
          <li>Plantillas: MiniJinja escapa el HTML. En Blade, usa <code>{'{{ }}'}</code> y no <code>{'{!! !!}'}</code> para los datos del usuario.</li>
        </ul>
        <p>Detalles y temas abiertos: <Src path="docs/security.md" />.</p>
      </>
    ),
  },
]
