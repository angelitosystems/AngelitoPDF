# angelitosystems/pdf

HTML/CSS → PDF for Laravel 11/12 without Chromium. Drives the native `angelito-pdf` CLI
(HTML on stdin, PDF on stdout, no shell, no temp files).

## Install

```bash
composer require angelitosystems/pdf
php artisan pdf:install      # downloads the angelito-pdf binary for this OS/arch from GitHub Releases
```

`pdf:install` picks the release matching the package version, verifies its SHA-256, renders a test PDF and
stores the binary in `storage/app/angelito-pdf/`. Options: `--tag=`, `--path=`, `--target=` (e.g.
`x86_64-unknown-linux-gnu` when building a Docker image on another OS). Offline servers: download the
binary from https://github.com/angelitosystems/AngelitoPDF/releases and set `ANGELITO_PDF_BINARY`.

Optional: `php artisan vendor:publish --tag=pdf-config` → `config/pdf.php` (`binary`, `timeout`, `releases_url`, `defaults`).

## Use

```php
use AngelitoPdf\Facades\Pdf;

return Pdf::view('invoices.show', ['invoice' => $invoice])
    ->format('A4')->margin(10)->download('invoice.pdf');   // attachment

Pdf::html('<h1>Hi</h1>')->landscape()->stream('hi.pdf');    // inline
Pdf::html($html)->margin(10, 15, 10, 15)->save('pdfs/a.pdf', 's3');
$bytes = Pdf::html($html)->options(['title' => 'Report', 'widthMm' => 80, 'heightMm' => 200])->output();
```

`options()` accepts any `RenderOptions` key (camelCase, see `docs/architecture.md`); unknown keys are rejected.

Errors throw `AngelitoPdf\PdfException`; `getCode()` is the CLI exit code
(`1` render error, `2` invalid options) or `-1` (binary missing, timeout).

## Test

```bash
composer install && composer test   # from the repo root; uses target/release/angelito-pdf[.exe] or ANGELITO_PDF_BINARY
```
