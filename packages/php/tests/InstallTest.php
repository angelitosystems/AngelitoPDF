<?php

namespace AngelitoPdf\Tests;

use AngelitoPdf\Installer;
use AngelitoPdf\PdfException;
use AngelitoPdf\PdfServiceProvider;
use Illuminate\Support\Facades\Http;
use Orchestra\Testbench\TestCase;

/** GitHub is faked with Http::fake; the "downloaded" bytes are the real CLI, so the post-install render is real. */
class InstallTest extends TestCase
{
    private string $dir;

    protected function getPackageProviders($app): array
    {
        return [PdfServiceProvider::class];
    }

    protected function setUp(): void
    {
        parent::setUp();
        $this->dir = sys_get_temp_dir().'/angelito-install-'.bin2hex(random_bytes(4));
    }

    protected function tearDown(): void
    {
        foreach (glob($this->dir.'/*') ?: [] as $f) {
            @unlink($f);
        }
        @rmdir($this->dir);
        parent::tearDown();
    }

    private static function realBinary(): string
    {
        $bin = getenv('ANGELITO_PDF_BINARY') ?: dirname(__DIR__, 3).'/target/release/angelito-pdf'.(PHP_OS_FAMILY === 'Windows' ? '.exe' : '');
        if (! is_file($bin)) {
            self::fail('Build the CLI first: cargo build --release -p angelito-pdf-cli');
        }

        return $bin;
    }

    private function fakeRelease(string $tagPath, string $body, ?string $sum = null): void
    {
        $asset = Installer::assetName();
        Http::fake([
            "github.com/angelitosystems/AngelitoPDF/releases/{$tagPath}SHA256SUMS" => Http::response(
                ($sum ?? hash('sha256', $body))."  {$asset}\n".str_repeat('0', 64)."  angelito-pdf-other-target\n"
            ),
            "github.com/angelitosystems/AngelitoPDF/releases/{$tagPath}{$asset}" => Http::response($body),
        ]);
    }

    public function test_latest_release_is_used_without_a_tag(): void
    {
        $this->fakeRelease('latest/download/', 'bytes');
        $this->assertFileExists(Installer::install($this->dir.'/x', null));
    }

    public function test_target_triples(): void
    {
        $this->assertSame('x86_64-unknown-linux-gnu', Installer::target('Linux', 'x86_64'));
        $this->assertSame('aarch64-unknown-linux-gnu', Installer::target('Linux', 'aarch64'));
        $this->assertSame('aarch64-apple-darwin', Installer::target('Darwin', 'arm64'));
        $this->assertSame('x86_64-apple-darwin', Installer::target('Darwin', 'x86_64'));
        $this->assertSame('x86_64-pc-windows-msvc', Installer::target('Windows', 'AMD64'));
        $this->assertSame('angelito-pdf-x86_64-pc-windows-msvc.exe', Installer::assetName('x86_64-pc-windows-msvc'));
        $this->assertSame('angelito-pdf-aarch64-apple-darwin', Installer::assetName('aarch64-apple-darwin'));
        $this->expectException(PdfException::class);
        Installer::target('Linux', 'riscv64');
    }

    public function test_command_downloads_verifies_and_runs_the_binary(): void
    {
        $this->fakeRelease('download/v1.2.3/', file_get_contents(self::realBinary()));
        $path = $this->dir.'/angelito-pdf'.(PHP_OS_FAMILY === 'Windows' ? '.exe' : '');

        $this->artisan('pdf:install', ['--tag' => 'v1.2.3', '--path' => $path])
            ->expectsOutputToContain('Installed and verified')
            ->assertSuccessful();

        $this->assertFileEquals(self::realBinary(), $path);
        $this->assertFileDoesNotExist($path.'.part');
        if (PHP_OS_FAMILY !== 'Windows') {
            $this->assertTrue(is_executable($path));
        }
    }

    public function test_checksum_mismatch_installs_nothing(): void
    {
        $this->fakeRelease('download/v1.2.3/', 'tampered bytes', str_repeat('a', 64));
        $path = $this->dir.'/angelito-pdf';

        $this->artisan('pdf:install', ['--tag' => 'v1.2.3', '--path' => $path])
            ->expectsOutputToContain('checksum mismatch')
            ->assertFailed();

        $this->assertFileDoesNotExist($path);
        $this->assertFileDoesNotExist($path.'.part');
    }

    public function test_missing_asset_is_reported(): void
    {
        Http::fake(['*SHA256SUMS' => Http::response(str_repeat('0', 64)."  angelito-pdf-other-target\n")]);
        $this->artisan('pdf:install', ['--tag' => 'v1.2.3', '--path' => $this->dir.'/x'])->expectsOutputToContain('has no binary named')->assertFailed();
    }

    public function test_http_errors_are_reported(): void
    {
        Http::fake(['*' => Http::response('', 404)]);
        $this->expectExceptionMessage('HTTP 404');
        Installer::install($this->dir.'/x', 'v9.9.9');
    }

    public function test_renderer_falls_back_to_the_install_path(): void
    {
        config(['pdf.binary' => null]);
        $this->app->forgetInstance(\AngelitoPdf\PdfFactory::class);
        try {
            $this->app->make(\AngelitoPdf\PdfFactory::class)->html('<p>x</p>')->output();
            $this->fail('expected a missing-binary error');
        } catch (PdfException $e) {
            $this->assertStringContainsString(str_replace('\\', '/', Installer::defaultPath()), str_replace('\\', '/', $e->getMessage()));
            $this->assertStringContainsString('pdf:install', $e->getMessage());
        }
    }
}
