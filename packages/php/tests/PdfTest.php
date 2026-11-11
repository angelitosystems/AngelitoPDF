<?php

namespace AngelitoPdf\Tests;

use AngelitoPdf\Facades\Pdf;
use AngelitoPdf\PdfException;
use AngelitoPdf\PdfServiceProvider;
use AngelitoPdf\Renderer;
use Illuminate\Support\Facades\Storage;
use Orchestra\Testbench\TestCase;
use Smalot\PdfParser\Parser;

class PdfTest extends TestCase
{
    private static function binary(): string
    {
        $ext = PHP_OS_FAMILY === 'Windows' ? '.exe' : '';

        return getenv('ANGELITO_PDF_BINARY') ?: dirname(__DIR__, 3)."/target/release/angelito-pdf{$ext}";
    }

    protected function getPackageProviders($app): array
    {
        return [PdfServiceProvider::class];
    }

    protected function defineEnvironment($app): void
    {
        $app['config']->set('pdf.binary', self::binary());
        $app['config']->set('view.paths', [__DIR__.'/views']);
    }

    protected function setUp(): void
    {
        parent::setUp();
        if (! is_file(self::binary())) {
            $this->fail('Build the CLI first: cargo build --release -p angelito-pdf-cli (missing '.self::binary().')');
        }
    }

    private function text(string $pdf): string
    {
        return (new Parser)->parseContent($pdf)->getText();
    }

    public function test_html_output_is_pdf(): void
    {
        $pdf = Pdf::html('<h1>Hola Mundo</h1>')->format('A5')->landscape()->margin(10)->output();

        $this->assertStringStartsWith('%PDF-', $pdf);
        $this->assertStringContainsString('Hola Mundo', $this->text($pdf));
    }

    public function test_view_download_returns_pdf_response(): void
    {
        $res = Pdf::view('invoice', ['customer' => 'Angelito & Cía', 'total' => '123.45'])
            ->format('A4')->margin(10, 15)->download('factura.pdf');

        $this->assertSame(200, $res->getStatusCode());
        $this->assertSame('application/pdf', $res->headers->get('Content-Type'));
        $this->assertStringContainsString('attachment; filename=factura.pdf', $res->headers->get('Content-Disposition'));
        $text = $this->text($res->getContent());
        $this->assertStringContainsString('Angelito & Cía', $text);
        $this->assertStringContainsString('123.45', $text);
    }

    public function test_stream_is_inline(): void
    {
        $res = Pdf::html('<p>x</p>')->stream('a.pdf');

        $this->assertStringStartsWith('inline', $res->headers->get('Content-Disposition'));
        $this->assertStringStartsWith('%PDF-', $res->getContent());
    }

    public function test_save_to_disk_and_path(): void
    {
        Storage::fake('local');
        Pdf::html('<p>guardado</p>')->save('docs/a.pdf', 'local');
        $this->assertStringStartsWith('%PDF-', Storage::disk('local')->get('docs/a.pdf'));

        $path = sys_get_temp_dir().'/angelito-pdf-test-'.getmypid().'.pdf';
        try {
            Pdf::html('<p>guardado</p>')->save($path);
            $this->assertStringStartsWith('%PDF-', file_get_contents($path));
        } finally {
            @unlink($path);
        }
    }

    public function test_options_and_config_defaults_reach_the_engine(): void
    {
        config(['pdf.defaults' => ['format' => 'A4', 'title' => 'Default Title']]);
        $this->app->forgetInstance(\AngelitoPdf\PdfFactory::class);
        Pdf::clearResolvedInstances();

        $pdf = Pdf::html('<p>{{ name }}</p>')->options(['data' => ['name' => 'Plantilla OK']])->output();

        $doc = (new Parser)->parseContent($pdf);
        $this->assertStringContainsString('Plantilla OK', $doc->getText());
        $this->assertSame('Default Title', $doc->getDetails()['Title'] ?? null);
    }

    public function test_invalid_options_throw_code_2(): void
    {
        try {
            Pdf::html('<p>x</p>')->options(['noSuchOption' => 1])->output();
            $this->fail('expected PdfException');
        } catch (PdfException $e) {
            $this->assertSame(2, $e->getCode());
            $this->assertStringContainsString('noSuchOption', $e->getMessage());
        }
    }

    public function test_large_html_does_not_deadlock(): void
    {
        $rows = str_repeat('<tr><td>fila de prueba con texto</td><td>12345.67</td></tr>', 18000);
        $html = "<table>{$rows}</table><p>FIN-DEL-DOCUMENTO</p>";
        $this->assertGreaterThan(1_000_000, strlen($html));

        $pdf = Pdf::html($html)->output();

        $this->assertStringStartsWith('%PDF-', $pdf);
        $this->assertStringEndsWith("%%EOF", rtrim($pdf));
    }

    public function test_timeout_kills_the_process(): void
    {
        $html = str_repeat('<p>timeout</p>', 50000);
        $start = microtime(true);
        try {
            (new Renderer(self::binary(), 0.05))->render($html);
            $this->fail('expected timeout');
        } catch (PdfException $e) {
            $this->assertSame(-1, $e->getCode());
            $this->assertStringContainsString('timed out', $e->getMessage());
        }
        $this->assertLessThan(5, microtime(true) - $start);
    }

    public function test_missing_binary_is_a_clear_error(): void
    {
        $this->expectException(PdfException::class);
        $this->expectExceptionMessage('binary not found');
        (new Renderer(__DIR__.'/nope.exe'))->render('<p>x</p>');
    }
}
