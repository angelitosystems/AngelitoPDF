# Pagination and typography

What paged-media features do, as verified by `crates/angelito-pdf/tests/paged.rs`. Every claim
below comes from a test that re-parses the PDF with lopdf (an independent parser): page count,
text per page, the decoded content stream (`cm`/`Tm`/`Td`/`Tf`/`TJ`, glyph widths from the
font's `W` array) and the embedded font objects.

Fixtures: `tests/fixtures/paged/` (`NotoSans-Regular.woff2`, SIL Open Font License, copied from
`vendor/fulgur-blitz/tests/fixtures/fonts/`; `fonts.css`; `no-fonts/`, a `baseDir` that does not contain the font).

## Margin boxes (`@page { @top-left { ... } }`)

| Box | Default `text-align` | Verified |
|---|---|---|
| `@top-left`, `@bottom-left` | left | `margin_boxes_are_aligned_on_their_side` (text starts at the left margin, ±1 mm) |
| `@top-center`, `@bottom-center` | center | same test + `invoice_footer_is_centred_on_every_page` (centre of the text at page centre, ±1 mm) |
| `@top-right`, `@bottom-right` | right | text ends at the right margin, ±1 mm |
| corners | `right` (left corners), `left` (right corners) | spec value, not asserted |
| `@left-*`, `@right-*` | center | spec value, not asserted |

An explicit `text-align` inside the box wins (`bottom_right_and_author_text_align_override`).

Fixed bug: Fulgur 0.41 gave every margin box `text-align: start`, so `@bottom-center` came out
flush left. The box rectangle was right (the centre box spans the whole edge when alone); only
the text inside it lacked the CSS Paged Media 3 §4.2 UA default. Patch:
`vendor/fulgur-blitz/src/gcpm/margin_box.rs` (`default_text_align`) and
`vendor/fulgur-blitz/src/gcpm/parser.rs` (declarations start with it).

Not done: margin-box `vertical-align` defaults (top boxes `middle`, etc.) are not applied.

## Fonts

| Way | Works | Test |
|---|---|---|
| `fonts: [path]` option (TTF/OTF/WOFF2) | yes; embedded as a subset (`ABCDEF+NotoSans-Regular`, `FontFile2`), text extractable | `fonts_option_embeds_the_font` |
| `@font-face` in an inline `<style>`, `url()` relative to `baseDir`, any `font-family` alias | yes (our patch, `vendor/blitz-dom/src/font_face.rs`) | `inline_font_face_with_url_under_base_dir_and_family_alias` |
| `@font-face` in an inline `<style>` with `src: url(data:font/woff2,...)` | yes, no `baseDir` needed (decoded in memory) | `inline_font_face_from_data_url` |
| inline `@font-face` with a relative or `file:///` URL and no `baseDir`, or a path outside `baseDir` | not read | `inline_font_face_file_url_stays_inside_base_dir` (with a positive control) |
| `@font-face` in a `<link rel=stylesheet>` / `@import` file, `url()` relative to `baseDir` | yes, but only under the font's internal family name (limit 1) | `font_face_in_linked_stylesheet_resolves_against_base_dir` |
| `@font-face` without `baseDir` | not read (by design: no local file access) | same test |
| `@font-face` font used inside a `@page` margin box | **no** (limit 2) | checked by hand with `systemFonts: false`: body text embedded, margin-box text absent |

Inline `<style>` sheets: `Document::process_style_element` fetches the `src` of every top-level
`@font-face` through the net provider (same `baseDir` sandbox, 32 MiB cap, `data:` in memory),
sniffs the format from the magic number (TTF/OTF, WOFF/WOFF2 decompressed, anything else
dropped) and registers it with `fontique::FontInfoOverride { family_name }`, so
`font-family: Mi` matches even though the font calls itself `Noto Sans`.

Limits of `@font-face`:

1. **Linked/imported sheets ignore the `font-family` descriptor.** They are still loaded by
   upstream `fetch_font_face` in `vendor/blitz-dom/src/net.rs`, which sends `Resource::Font(bytes)`
   without the family. Use the font's internal family name there, or move the rule to an inline
   `<style>`. Fix: make `net.rs` call `crate::font_face::fetch_font_faces` instead (needs the
   document's `PendingFonts`, so `StylesheetLoader`/`CssHandler` must carry it).
2. **Margin boxes do not see `@font-face` fonts.** Fulgur lays out each margin box as a separate
   mini-document (`render.rs`, `blitz_adapter::parse_and_layout`) with only the `fonts` option and
   no net provider. Use the `fonts` option (`'Noto Sans'` then works in margin boxes) or keep
   system fonts enabled. Fix (outside `gcpm/`): pass the main document's `@font-face` bytes and
   families into `parse_and_layout`.
3. Not supported: `@font-face` inside `@media`/`@supports`, `local()` sources, `unicode-range`,
   and the `font-weight`/`font-style` descriptors (the values in the font file are used). Every
   `url()` in `src` is fetched, not only the first one that loads.
4. With `systemFonts: false` and no font available at all, text is silently dropped (the PDF has
   no text). Always ship a font with `fonts` when disabling system fonts.

## Fragmentation

| Property | Works | Test |
|---|---|---|
| `break-before: page`, `page-break-before: always` | yes | `forced_breaks_and_legacy_aliases_start_a_new_page` |
| `break-after: page`, `page-break-after: always` | yes, next content starts a new page | same |
| `page-break-inside: avoid` | yes (alias added in our patch to `column_css.rs:618`) | `break_inside_avoid_keeps_a_block_on_one_page` |
| `break-inside: avoid` / `avoid-page` on a block | yes, the block moves whole to the next page (control without it splits) | `break_inside_avoid_keeps_a_block_on_one_page` |
| `tr { break-inside: avoid }` | yes, 60 three-line rows, none split | `table_rows_with_break_inside_avoid_are_never_split` |

Observed, not a guarantee: a single block of lines separated by `<br>` (one paragraph-like box)
moved whole to page 2 instead of splitting; a long `<p>` does split across pages.
