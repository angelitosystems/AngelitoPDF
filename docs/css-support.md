# HTML/CSS compatibility matrix

Rule: **Supported** = covered by an automated test in this repo that passes.
**Renderer claims** = documented by Fulgur (`fulgur/docs/css-support.md`) but not yet tested by us.
Angelito PDF Engine is **not** a full HTML5/CSS browser engine.

| Feature | Status | Evidence / notes |
|---|---|---|
| Block text, headings, inline `color`, UTF-8 / Spanish accents | Supported | `simple_html_produces_valid_pdf_with_text` |
| `display: flex` (justify/align) | Supported (visual check only) | invoice fixture header; automated visual diff pending |
| `display: grid` (`grid-template-columns`, `gap`) | Supported (visual check only) | invoice fixture |
| Tables, `border-collapse`, multi-page tables | Supported | invoice test: 90 rows across pages, none lost |
| `thead` repeated on each page | Supported | invoice test (page 2 contains header) |
| `@page { size; margin }`, margin boxes, `counter(page)` / `counter(pages)` | Supported | invoice test: "Página N de M" on every page |
| `@media print` / `@media screen` | Supported (with our Blitz patch) | invoice test; `vendor/README.md` |
| `break-before: page` | Supported | invoice test |
| `break-inside: avoid` on rows | Renderer claims | not asserted yet |
| Page sizes A3/A4/A5/B4/B5/Letter/Legal/Ledger, landscape, custom mm (tickets 58/80 mm) | Supported | `page_formats_orientation_and_ticket_sizes` |
| Border, `border-radius`, `box-shadow` (outer) | Supported (visual check only) | invoice fixture |
| `box-shadow: inset`, `text-shadow` | **Not supported** | renderer limitation |
| `<img>` PNG/JPEG/GIF registered via `images` option + explicit width & height | Supported | `images_are_embedded_only_when_registered` |
| `<img>` with only width / natural size | Partial | needs file also under `baseDir`; automatic in phase 2 |
| `<img src="data:...">` | **Pending** | ignored test `data_uri_image_is_embedded` |
| `<link rel=stylesheet>` / `@import` inside `baseDir` | Supported | `base_dir_allows_inside_and_blocks_traversal` |
| Extra CSS (`css` option, e.g. compiled Tailwind) | Renderer claims | Tailwind build not tested yet |
| Custom fonts (`fonts` option, TTF/OTF/WOFF2) | Renderer claims | test pending (phase 2) |
| Inline SVG, gradients, `transform`, multi-column, `position` | Renderer claims | tests pending |
| Templates with data (MiniJinja, auto-escaped) | Supported | `template_data_is_rendered_and_html_escaped` |
| Remote resources (`http(s)`) | Blocked by design | `remote_resources_are_not_fetched` |
| JavaScript | Not supported (by design) | — |
