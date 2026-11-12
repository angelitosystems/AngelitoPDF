# Pagination and typography

What paged-media features do, as verified by `crates/angelito-pdf/tests/paged.rs`. Every claim
below comes from a test that re-parses the PDF with lopdf (an independent parser): page count,
text per page, the decoded content stream (`cm`/`Tm`/`Td`/`Tf`/`TJ`, glyph widths from the
font's `W` array) and the embedded font objects.

Fixtures: `tests/fixtures/paged/` (`NotoSans-Regular.woff2`, SIL Open Font License, copied from
`vendor/fulgur-blitz/tests/fixtures/fonts/`; `fonts.css`).

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
| `@font-face` in a `<link rel=stylesheet>` / `@import` file, `url()` relative to `baseDir` | yes, with the limits below | `font_face_in_linked_stylesheet_resolves_against_base_dir` |
| `@font-face` without `baseDir` | not read (by design: no local file access) | same test |
| `@font-face` in an inline `<style>` | **no** | see below |

Limits of `@font-face` (blitz-dom 0.2.4, outside the files this doc's owner may change):

1. **Inline `<style>` is ignored.** `blitz-dom/src/net.rs` calls `fetch_font_face` only from
   `CssHandler`/`StylesheetLoader` (linked and imported sheets);
   `Document::process_style_element` (`document.rs:593`) never does. Put `@font-face` in a
   linked `.css` file, or use the `fonts` option.
2. **The `font-family` descriptor is ignored.** `document.rs:725` registers the bytes with
   `register_fonts(font, None)`, so the font is found only under its own internal family name
   (`'Noto Sans'`), never under an alias such as `font-family: Marca`. `Resource::Font` (in the
   non-vendored `blitz-traits`) carries only bytes, so fixing it needs the family passed along and
   a `fontique::FontInfoOverride { family_name, .. }`.
3. With `systemFonts: false` and no font available at all, text is silently dropped (the PDF has
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
