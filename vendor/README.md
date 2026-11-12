# Vendored, patched crates

Copied unmodified from crates.io except for the lines below. Both are
`MIT OR Apache-2.0`, © the Blitz contributors (https://github.com/dioxuslabs/blitz).
Remove a patch as soon as upstream ships an equivalent fix.

Validate the patches against upstream's own unit tests with `bash scripts/vendored-tests.sh`
(builds the three crates against each other's patched copies; runs in CI as job `vendored`).

| Crate | Version | Change | Why |
|---|---|---|---|
| blitz-dom | 0.2.4 | `src/document.rs:180` `MediaType::screen()` → `MediaType::print()` | We render paged print output; `@media print` rules were ignored and `@media screen` applied. Verified by `invoice_paginates_repeats_header_and_honours_print_rules`. |
| blitz-html | 0.2.0 | `src/html_sink.rs:149` removed `println!("ERROR: {error}")` | HTML parse errors were written to **stdout**, corrupting PDFs streamed to stdout by the CLI and polluting host apps (Node/PHP). |
| fulgur-blitz | 0.41.0 | `src/net.rs`: new `is_plain_local_path()`; `resolve_local_path` requires a base dir and rejects UNC/device paths **before** `canonicalize()`; resource reads capped at 32 MiB | `canonicalize()` on `\host\share\x` opened SMB connections from untrusted HTML (SSRF + NTLM hash leak on Windows), even without `baseDir`. Found by the security review; test `unc_paths_never_touch_the_network`. |
| fulgur-blitz | 0.41.0 | `src/blitz_adapter.rs` `resolve_style_imports`: same UNC check before `canonicalize()` | same issue via `@import` |
| fulgur-blitz | 0.41.0 | `src/template.rs`: `env.set_fuel(Some(10_000_000))`; `Cargo.toml`: minijinja feature `fuel` | templates had no CPU bound. Test `template_cpu_is_bounded`. |

| fulgur-blitz | 0.41.0 | `src/gcpm/margin_box.rs:63` new `default_text_align()`; `src/gcpm/parser.rs:481` margin-box declarations start with the UA `text-align` | Fulgur did not apply the CSS Paged Media 3 §4.2 defaults: `@bottom-center` was left-aligned. Tests `margin_boxes_are_aligned_on_their_side`, `invoice_footer_is_centred_on_every_page`. |
| fulgur-blitz | 0.41.0 | `src/column_css.rs:618` also match `page-break-inside` | legacy alias was ignored. Test `break_inside_avoid_keeps_a_block_on_one_page`. |
| fulgur-blitz | 0.41.0 | `src/net.rs:63` new `decode_data_url()` (in memory, rejects > 32 MiB before decoding); `src/net.rs:229` `fetch` serves `data:` without disk/network | upstream dropped every non-`file://` URL, so `<img src="data:…">` had no size. Tests in `tests/images.rs`. |
| fulgur-blitz | 0.41.0 | `src/convert/replaced.rs:184` `MAX_DATA_URL_PIXELS = 40_000_000` + header-only `within_pixel_cap()`; `:207` registered image first, then `data:`; `:222` SVG in `<img>` drawn as vectors (`svg::sandboxed_options()`) | krilla decodes PNG/GIF to pixels (decompression bomb); upstream required the asset bundle and never drew SVG `<img>`. Test `data_uri_decompression_bomb_is_not_embedded`. |
| blitz-dom | 0.2.4 | `src/net.rs:308,327` `raster_header_size()` reads PNG/JPEG/GIF size from the header instead of decoding to RGBA; `Cargo.toml:98` dep `imagesize 0.14` (already in Cargo.lock via krilla, MIT) | JPEG/GIF had no intrinsic size (only PNG decoder enabled) and full decode was a memory-bomb vector. Test `natural_size_and_aspect_ratio`. |
| fulgur-blitz | 0.41.0 | `src/convert/style/border.rs:11`; `src/draw_primitives.rs:732` `border_colors: [[u8;4];4]`, `:1561`, `:1617` | one colour per side; the single-stroke fast path requires equal colours; solid sides filled as mitred trapezoids | upstream painted all four sides in the top colour. Tests `per_side_border_colors`, `per_side_border_widths`, `per_side_border_styles`. |
| fulgur-blitz | 0.41.0 | `src/net.rs:78-173` registered images served by name (no copy, before any disk access); `src/blitz_adapter.rs:313`; `src/engine.rs:14` `assets: Option<Arc<AssetBundle>>` | images registered via `images` had no intrinsic size without `baseDir`. Test `registered_image_has_natural_size_without_base_dir`. |
| fulgur-blitz | 0.41.0 | `src/convert/replaced.rs:193` `image_source()`; `src/convert/style/background.rs:86-91` | `background-image` accepts `data:` (40 MP cap); natural size px→pt (was 1 px = 1 pt). Test `background_image_data_uri`. |
| fulgur-blitz | 0.41.0 | `src/convert/inline_root.rs:614`, `src/drawables.rs:481` `text_without_font`; `src/engine.rs` builder option `error_on_missing_font` (default `false` = upstream behaviour; our `backend.rs` enables it) | text with no font was silently dropped. Test `text_without_any_font_is_an_error`; upstream test `system_fonts_false_still_produces_pdf` still passes. |
| blitz-dom | 0.2.4 | new `src/font_face.rs`; `src/document.rs:596` inline `<style>` fetches `@font-face`, `:613` `register_pending_fonts`, `:624` `register_font` with `fontique::FontInfoOverride { family_name }`; `src/lib.rs` `mod font_face` | upstream never loaded inline `@font-face` and ignored the `font-family` descriptor. Tests `inline_font_face_*`. |

fulgur-blitz is `MIT OR Apache-2.0`, © the Fulgur contributors (https://github.com/fulgur-rs/fulgur).
All three issues should be reported upstream.
