# Security

Threat model: HTML/CSS and template **data** may contain untrusted input (customer names,
clinical notes). Options (`RenderOptions`) and **templates** are trusted developer input.

## Guarantees (each has a test in `crates/angelito-pdf/tests/security.rs`)

| Guarantee | Test |
|---|---|
| No HTTP/HTTPS fetches, ever | `remote_resources_are_not_fetched` |
| No local file reads unless `baseDir` is set | `no_file_access_without_base_dir` |
| Reads confined to `baseDir` (`../` blocked) | `base_dir_allows_inside_and_blocks_traversal` |
| UNC / SMB paths (`file://host/…`, `//host/…`, `@import`) rejected before touching the network | `unc_paths_never_touch_the_network` |
| `<img src>` never reads disk by itself (only registered `images`) | `images_are_embedded_only_when_registered` |
| Template data HTML-escaped; data is never evaluated as template code | `template_data_is_rendered_and_html_escaped` |
| Template CPU bounded (fuel) | `template_cpu_is_bounded` |
| Input size capped (default 10 MiB), also on CLI stdin | `input_size_limit_is_enforced`, `oversize_stdin_is_rejected` |
| Renderer panics become `Error::Render("internal renderer error")`; CLI prints no paths | `renderer_panic_becomes_an_error` |
| Deep nesting: 400 levels render; estimated depth > 10,000 rejected up front (`NestingTooDeep`), also after templating; 256 MiB render-thread stack. Content deeper than 512 levels is dropped by the renderer | `deep_nesting_does_not_overflow_the_stack` |
| Parse errors never written to stdout | CLI `stdin_to_stdout_is_a_clean_pdf_even_with_malformed_html` |

## Known open issues (from the phase-1 security review)

1. **Memory bomb via SVG `<image href="data:…">`**: a 1.5 MB input decoding to a 20000×20000 image
   peaked at ~1.1 GB. No pixel cap yet. Mitigation until fixed: run the CLI under an OS memory
   limit (cgroup / `ulimit -v` / Windows job object). The PHP package will set a process timeout.
2. **Stack overflow** is prevented by the depth pre-check (release builds overflowed at 300k–1M levels; the
   limit is 10,000). Other unbounded recursion in the renderer is not ruled out — fuzzing is pending.
3. **No wall-clock timeout inside the library.** The CLI caller (PHP) must apply one.
4. Do not use the `|safe` filter on user data in templates; it disables escaping.
5. Templates are trusted: they must not come from end users.

## Accepted dependency advisories

`cargo deny check` runs in CI. These *unmaintained* notices (no known vulnerability) are accepted in
`deny.toml` because they reach us only through the renderer and cannot be swapped independently:

| ID | Crate | Path |
|---|---|---|
| RUSTSEC-2024-0436 | paste (proc-macro, build time only) | fulgur-core → woff2-patched → safer-bytes |
| RUSTSEC-2026-0206 | rustybuzz (text shaping) | krilla, usvg |
| RUSTSEC-2026-0192 | ttf-parser (font parsing) | fontdb, krilla |

Font parsing is the relevant attack surface: fonts are only loaded from paths the integrator passes
in `fonts` (or system fonts), never from the HTML. Revisit on each Fulgur upgrade.
