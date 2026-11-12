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
| Margin box default alignment (`@*-left` left, `@*-center` centre, `@*-right` right; author `text-align` wins) | Supported (our patch) | `margin_boxes_are_aligned_on_their_side`, `invoice_footer_is_centred_on_every_page`, `bottom_right_and_author_text_align_override` |
| `@media print` / `@media screen` | Supported (with our Blitz patch) | invoice test; `vendor/README.md` |
| `break-before/after: page`, `page-break-before/after: always` | Supported | `forced_breaks_and_legacy_aliases_start_a_new_page` |
| `break-inside: avoid` / `avoid-page` / `page-break-inside: avoid` on blocks | Supported (alias: our patch) | `break_inside_avoid_keeps_a_block_on_one_page` |
| `break-inside: avoid` on table rows | Supported | `table_rows_with_break_inside_avoid_are_never_split` |
| Page sizes A0–A10, B0–B10, Letter/Legal/Ledger, landscape, custom mm (tickets 58/80 mm) | Supported | `page_formats_orientation_and_ticket_sizes`, `iso_216_a_and_b_series` |
| Per-side border colours (`border-color: a b c d`) | **Partial (bug)** | ignored test `per_side_border_colors`: one stroke in the top colour for all four sides |
| `border-radius`, `box-shadow` (outer) | Supported (visual check only) | invoice fixture; no geometry test yet |
| `box-shadow: inset`, `text-shadow` | **Not supported** | renderer limitation |
| `<img>` PNG/JPEG/GIF registered via `images` option + explicit width & height | Supported | `images_are_embedded_only_when_registered` |
| `<img>` natural size / only `width` or `height` (keeps ratio) | Supported for `data:` and files under `baseDir`; **Partial** for images registered only via `images` (need explicit width & height) | `natural_size_and_aspect_ratio` |
| `<img src="data:image/png\|jpeg\|gif;base64,…">` | Supported (≤ 32 MiB per URL, ≤ 40 MP) | `data_uri_raster_formats_are_embedded`, `data_uri_size_cap`, `data_uri_decompression_bomb_is_not_embedded` |
| `<img src="data:image/svg+xml,…">` | Supported, drawn as vectors | `data_uri_svg_is_drawn_as_vector` |
| `<link rel=stylesheet href="data:text/css,…">` | Supported without `baseDir` | `data_uri_stylesheet_applies_without_base_dir` |
| `background-image: url(data:…)` | Not supported yet | reads only registered `images` |
| `<link rel=stylesheet>` / `@import` inside `baseDir` | Supported | `base_dir_allows_inside_and_blocks_traversal` |
| Extra CSS (`css` option, e.g. compiled Tailwind) | Renderer claims | Tailwind build not tested yet |
| Custom fonts (`fonts` option) | Supported | `fonts_option_embeds_the_font` (subset + FontFile2, text extractable) |
| `@font-face` in a linked stylesheet / `@import` inside `baseDir` | Partial | `font_face_in_linked_stylesheet_resolves_against_base_dir`; `font-family` must be the font's internal name (blitz-dom ignores the descriptor) |
| `@font-face` in inline `<style>` | **Not supported** | blitz-dom `process_style_element` never fetches fonts; see docs/pagination.md |
| Inline SVG, gradients, `transform`, multi-column | Renderer claims | tests pending |
| Templates with data (MiniJinja, auto-escaped) | Supported | `template_data_is_rendered_and_html_escaped` |
| Remote resources (`http(s)`) | Blocked by design | `remote_resources_are_not_fetched` |
| JavaScript | Not supported (by design) | — |
