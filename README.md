# Angelito PDF Engine

HTML + CSS → PDF in native Rust. No Chromium, Puppeteer, Playwright, Docker or network.
By **Angelito Systems S.A.C.**

> **Status: 0.1.0-dev.** The Rust library, the `angelito-pdf` CLI and the Laravel package work and are
> tested (Windows x64). The Node/NestJS package is not built yet. Nothing is published.
> Docs: https://angelitosystems.github.io/AngelitoPDF/ (source: [website/](website/)). Phase plan: [AGENTS.md](AGENTS.md).

## What works today

- HTML string or file → PDF bytes or file, in memory, no temporary files.
- Page formats A3/A4/A5/B4/B5/Letter/Legal/Ledger, landscape, custom size in mm (thermal tickets 58/80 mm), margins.
- `@page` margin boxes with `Página N de M`, `@media print`, `break-before`, multi-page tables with repeated `thead`.
- Flexbox, Grid, borders, radius, outer shadows (via the [Fulgur](https://github.com/fulgur-rs/fulgur) renderer).
- Templates with JSON data (MiniJinja, HTML auto-escaped).
- Title/author/lang metadata.
- Secure defaults: no network, no local file reads unless `baseDir` is set (and confined to it, UNC paths blocked), 10 MiB input cap, nesting-depth cap, template CPU cap. Details and open issues: [docs/security.md](docs/security.md).

Full, test-backed list: [docs/css-support.md](docs/css-support.md). Known gaps: `data:` image URIs,
images without explicit size, `text-shadow`, inset shadows.

## Laravel

```php
// composer require angelitosystems/pdf  &&  php artisan pdf:install   (downloads the binary for this OS)
use AngelitoPdf\Facades\Pdf;

return Pdf::view('invoices.show', ['invoice' => $invoice])->format('A4')->margin(10)->download('F001-1.pdf');
```

Details: [packages/php/README.md](packages/php/README.md).

## Benchmarks (cold, p50, one process per document — machine under background load)

| Document | Angelito | DOMPDF 3.1.6 | Chrome 157 headless |
|---|---|---|---|
| invoice, 90 rows, 3 pages | 49.0 ms · 20.8 MiB | 303.7 ms · 46.4 MiB | 659.5 ms · 757.3 MiB |
| report, 1000 rows, 22 pages | 245.0 ms · 54.4 MiB | 3217.3 ms · 190.1 MiB | 970.2 ms · 932.7 MiB |

DOMPDF lays out less (no flex/grid, no `@page` footer). Method, caveats and raw data: [docs/benchmarks.md](docs/benchmarks.md).

## Rust

```toml
[dependencies]
angelito-pdf = { git = "https://github.com/angelitosystems/AngelitoPDF" } # not on crates.io yet
```

```rust
use angelito_pdf::{Engine, Margin, RenderOptions};

let opts = RenderOptions { format: "A4".into(), margin: Some(Margin::Uniform(10.0)), ..Default::default() };
let engine = Engine::new(&opts)?;          // build once (fonts parsed once), Send + Sync
let pdf: Vec<u8> = engine.render("<h1>Factura</h1>")?;
```

## CLI

```bash
cargo build --release -p angelito-pdf-cli
echo '<h1>Hola</h1>' | angelito-pdf --options '{"format":"A5","margin":10}' > hola.pdf
angelito-pdf -o factura.pdf --options '{"data":{"n":"F001-1"}}' factura.html
```

Exit codes: `0` ok, `1` render/IO error, `2` invalid options. Errors go to stderr only.

## Options (same JSON for every language)

| Key | Type | Default | |
|---|---|---|---|
| `format` | string | `"A4"` | A3, A4, A5, B4, B5, Letter, Legal, Ledger |
| `widthMm`, `heightMm` | number | — | custom size, both required |
| `landscape` | bool | `false` | |
| `margin` | number \| [t,r,b,l] | CSS `@page` | millimetres |
| `title`, `author`, `lang` | string | — | PDF metadata |
| `css` | string[] | `[]` | extra stylesheets (e.g. compiled Tailwind) |
| `fonts` | path[] | `[]` | TTF/OTF/TTC/WOFF2 to embed |
| `images` | {name: path} | `{}` | images usable as `<img src="name">` |
| `baseDir` | path | none | root for `<link>`/`@import`; none = no file access |
| `data` | object | — | treat HTML as a MiniJinja template |
| `systemFonts` | bool | `true` | `false` for identical output across machines |
| `maxInputBytes` | number | 10485760 | |

## Releases

Push a tag equal to the Cargo version (`git tag v0.1.0 && git push origin v0.1.0`). GitHub Actions
([release.yml](.github/workflows/release.yml)) then builds and smoke-tests the CLI for Linux x64/ARM64,
Windows x64 and macOS Intel/Apple Silicon, runs the Laravel tests against the Linux binary, and publishes
a GitHub Release with the binaries + `SHA256SUMS`. Packagist reads the same tag (root `composer.json`).
The docs site is deployed to GitHub Pages by [pages.yml](.github/workflows/pages.yml) on every push to `main`.

## Development

```bash
cargo test --workspace
cargo clippy --workspace --all-targets -- -D warnings
composer install && composer test        # Laravel package (needs target/release/angelito-pdf)
cd website && npm ci && npm test           # docs site: build + Playwright checks
```

Docs: [architecture](docs/architecture.md) · [renderer evaluation](docs/research/evaluation.md) ·
[ADR-0001](docs/adr/0001-renderer-fulgur.md) · [benchmarks](docs/benchmarks.md) · [security](docs/security.md)

## License

Licensed under either of [MIT](LICENSE-MIT) or [Apache-2.0](LICENSE-APACHE), at your option. Dependencies are permissive, with
file-level MPL-2.0 for Stylo/cssparser (used unmodified). Third-party notices: [THIRD-PARTY.md](THIRD-PARTY.md).
