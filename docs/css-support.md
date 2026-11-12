# HTML/CSS compatibility matrix

Rule: **Supported** = covered by an automated test in this repo that passes.
**Renderer claims** = documented by Fulgur (`fulgur/docs/css-support.md`) but not yet tested by us.
Angelito PDF Engine is **not** a full HTML5/CSS browser engine.

| Feature | Status | Evidence / notes |
|---|---|---|
| Block text, headings, inline `color`, UTF-8 / Spanish accents | Supported | `simple_html_produces_valid_pdf_with_text` |
| `display: flex`: `justify-content` (flex-start/center/flex-end/space-between/space-around/space-evenly) | Supported | `crates/angelito-pdf/tests/layout.rs`: `flex_justify_content` (geometry, ±0.5 pt) |
| `display: flex`: `align-items` (flex-start/center/flex-end/stretch), `align-self`, `order`, `flex-direction` (column, row-reverse) | Supported | `flex_align_items`, `flex_row_reverse_order_and_align_self`, `flex_direction_column` |
| `display: flex`: `gap`, `flex-grow`, `flex-shrink`, `flex-wrap` | Supported | `flex_gap`, `flex_grow_distributes_free_space`, `flex_shrink_and_wrap` |
| `display: grid`: `grid-template-columns` (px, fr, `repeat()`), `gap` / row+column gap, `grid-column: span N` | Supported | `crates/angelito-pdf/tests/layout.rs`: `grid_template_columns_px_and_fr`, `grid_repeat_and_gap`, `grid_row_and_column_gap`, `grid_column_span` |
| `display: grid`: `grid-template-areas`, `grid-area`, `justify-items` | Supported | `grid_template_areas_and_justify_items` |
| Box model: `margin` (incl. vertical collapse, `margin: auto`), `padding`, `border-width`, `box-sizing` (content-box/border-box), `display: inline-block` | Supported | `box_model_content_box`, `box_model_border_box`, `box_model_padding_offsets_text`, `margin_between_blocks`, `margin_auto_centers_block`, `inline_block_flows_horizontally` |
| `position: relative` / `absolute` (left/top/right/bottom vs. positioned ancestor) | Supported | `position_relative_offsets_from_flow`, `position_absolute_in_relative_container`, `helper_sanity_absolute_text_and_margin_box` |
| `text-align` left/center/right | Supported | `text_align_left_center_right` |
| `background-color`, uniform `border` (width + colour) | Supported | `background_color_is_exact`, `border_width_and_color` |
| Tables, `border-collapse`, multi-page tables | Supported | invoice test: 90 rows across pages, none lost |
| `thead` repeated on each page | Supported | invoice test (page 2 contains header) |
| `@page { size; margin }`, margin boxes, `counter(page)` / `counter(pages)` | Supported | invoice test: "Página N de M" on every page |
| `@media print` / `@media screen` | Supported (with our Blitz patch) | invoice test; `vendor/README.md` |
| `break-before: page` | Supported | invoice test |
| `break-inside: avoid` on rows | Renderer claims | not asserted yet |
| Page sizes A3/A4/A5/B4/B5/Letter/Legal/Ledger, landscape, custom mm (tickets 58/80 mm) | Supported | `page_formats_orientation_and_ticket_sizes` |
| Per-side border colours (`border-color: a b c d`) | **Partial (bug)** | ignored test `per_side_border_colors`: one stroke in the top colour for all four sides |
| `border-radius`, `box-shadow` (outer) | Supported (visual check only) | invoice fixture; no geometry test yet |
| `box-shadow: inset`, `text-shadow` | **Not supported** | renderer limitation |
| `<img>` PNG/JPEG/GIF registered via `images` option + explicit width & height | Supported | `images_are_embedded_only_when_registered` |
| `<img>` with only width / natural size | Partial | needs file also under `baseDir`; automatic in phase 2 |
| `<img src="data:...">` | **Pending** | ignored test `data_uri_image_is_embedded` |
| `<link rel=stylesheet>` / `@import` inside `baseDir` | Supported | `base_dir_allows_inside_and_blocks_traversal` |
| Extra CSS (`css` option, e.g. compiled Tailwind) | Renderer claims | Tailwind build not tested yet |
| Custom fonts (`fonts` option, TTF/OTF/WOFF2) | Renderer claims | test pending (phase 2) |
| Inline SVG, gradients, `transform`, multi-column | Renderer claims | tests pending |
| Templates with data (MiniJinja, auto-escaped) | Supported | `template_data_is_rendered_and_html_escaped` |
| Remote resources (`http(s)`) | Blocked by design | `remote_resources_are_not_fetched` |
| JavaScript | Not supported (by design) | — |
