# Renderer evaluation (2026-11-11)

Method: crates.io API for metadata, shallow clones of the repos for source inspection, and a
compiled test harness that renders **the same invoice** (`tests/fixtures/invoice.html`: flex header,
3-column grid, 90-row table with `thead`, `@page` margin box with `counter(page)`/`counter(pages)`,
`@media print`, `break-before: page`, Spanish accents) with each engine. PDFs inspected with
PyMuPDF. Machine: Intel i7-13650HX, Windows 11, Rust 1.98.1, release profile.

## Candidates

| Crate | Version / last release | License | Role |
|---|---|---|---|
| **fulgur** | 0.41.0 / 2026-11-01 (last commit 2026-11-08) | MIT OR Apache-2.0 | complete HTML→PDF engine (paged media) built **on** Blitz + Stylo + Taffy + Parley + Krilla |
| **ironpress** | 1.7.0 / 2026-09-16 (last commit 2026-10-22) | MIT | complete HTML→PDF engine, its own layout engine |
| blitz-dom/html | 0.2.4 / 2026-10-16 | MIT OR Apache-2.0 | DOM + Stylo styling + Taffy layout (no paged media, no PDF) |
| taffy | 0.15.1 | MIT | flexbox/grid/block layout |
| parley | 0.12.0 | Apache-2.0 OR MIT | text layout / shaping |
| krilla | 0.8.2 | MIT OR Apache-2.0 | PDF writer (fonts subsetting, tagged PDF) |
| html5ever | 0.40.1 | MIT OR Apache-2.0 | HTML5 parser |
| cssparser / stylo | 0.38 / 0.23 | **MPL-2.0** | CSS tokenizer / Servo CSS engine |

Taffy, Parley, Krilla, html5ever, cssparser and Blitz are **building blocks**, not alternatives:
assembling them ourselves means re-writing paged media (pagination, margin boxes, counters,
repeating table headers, break rules), which is exactly what Fulgur already implements
(~140k lines of Rust, visual regression + WPT suites in CI).

## Measured results (same invoice)

| | Fulgur 0.41 | Ironpress 1.7 |
|---|---|---|
| Pages | 4 | 2 |
| All 90 table rows present | **yes** (40 + 48 + 2) | **no — rows 46–90 lost** (page 2 has only the next section) |
| `thead` repeated on continuation pages | yes | n/a (table truncated) |
| `Página N de M` footer on every page | yes | yes |
| `@media print` honoured | **no** (Blitz uses `screen`) → fixed by our 1-line patch | yes |
| Accented text | yes | yes |
| Render time, 1st / warm (in-process) | 117 ms / 45–49 ms | 887 ms / 170–183 ms |
| PDF size | 86 KB | 61 KB |
| Parse errors printed to **stdout** | yes (from blitz-html) → fixed by our patch | — |

Reproduce: `cd docs/research/compare && cargo run --release` (writes `fulgur.pdf` / `ironpress.pdf`). The
Fulgur checks also live as the automated test `invoice_paginates_repeats_header_and_honours_print_rules`.

## Other verified properties of Fulgur

- **Offline by design**: its net provider accepts only `file://` inside a canonicalised base dir
  (`fulgur-blitz/src/net.rs`); `http(s)` is dropped. Confirmed by our tests in `crates/angelito-pdf/tests/security.rs`.
- Templates: MiniJinja with HTML auto-escape (`fulgur-blitz/src/template.rs:90`). Confirmed by test.
- Images are embedded only from an explicit asset bundle (no implicit disk reads).
- Prebuilt npm binaries already published for win32-x64, linux-x64/arm64/musl, darwin-x64/arm64 —
  evidence the dependency tree cross-compiles to all five target platforms.
- Transitive licenses (355 crates via `cargo metadata`): MIT/Apache/BSD/ISC/Zlib/Unicode-3.0,
  17 × MPL-2.0 (Stylo, cssparser, selectors…). **No GPL/LGPL-only/AGPL.**

## Limitations found (to be handled in phase 2)

1. `<img>` without explicit CSS `width` **and** `height` is not drawn unless the file is also
   reachable under `baseDir` (Blitz needs to load it for the intrinsic size).
2. `data:` URIs in `<img>` are not rendered.
3. Blitz paints no `text-shadow` and no `inset` box-shadow (Fulgur `docs/css-support.md`).
4. Pre-1.0 (0.x): breaking API changes are likely → pinned `=0.41.0`, all calls isolated in `backend.rs`.

## Decision

Fulgur, pinned and wrapped. See [ADR-0001](../adr/0001-renderer-fulgur.md).
