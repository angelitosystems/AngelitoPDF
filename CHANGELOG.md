# Changelog

Format: [Keep a Changelog](https://keepachangelog.com/). Versioning: SemVer.

## [Unreleased]

### Added
- `angelito-pdf` crate: `RenderOptions` (JSON contract), `Engine`, `render`, `render_file`.
- `angelito-pdf` CLI: HTML via stdin/file → PDF via stdout/file, JSON options, exit codes 0/1/2.
- Renderer: Fulgur 0.41.0 behind `backend.rs` (ADR-0001).
- Patched Blitz: `@media print` now applies; HTML parse errors no longer printed to stdout.
- Options: format, custom mm size, landscape, margins, metadata, extra CSS, fonts, images, baseDir, template data, input cap.
- Security hardening (from the phase-1 security review): UNC/SMB paths rejected before `canonicalize()` (SSRF/NTLM leak on Windows), 32 MiB cap per loaded file, template fuel limit, panics mapped to a sanitized error, render on a 256 MiB-stack thread, nesting-depth pre-check.
- Tests: 21 tests + 1 pending (`data:` image URIs), PDF validated with lopdf.
- `php artisan pdf:install`: downloads + SHA-256-verifies the release binary for the host OS/arch.
- GitHub Actions: `release.yml` (5-platform binaries, smoke tests, GitHub Release, Packagist notify), `pages.yml` (docs site), CI runs PHP + website tests.
- Laravel package `angelitosystems/pdf` (`packages/php`, published from the root `composer.json`): `Pdf::html()/view()`, `output/save/download/stream`, config, timeout; 9 Testbench tests against the real binary.
- Benchmarks vs DOMPDF 3.1.6 and Chrome 157 headless (`benches/bench.py`, raw data in `benches/results.json`).
- Website (`website/`, React 19 + Vite 7): landing, 17 doc pages (install, Laravel API, examples, options, CLI, Rust, CSS, benchmarks, security); charts read `benches/results.json` at build time.
- CI workflow (5 OS/arch: test + clippy -D warnings) and cargo-deny config — not yet run on GitHub.
