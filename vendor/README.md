# Vendored, patched crates

Copied unmodified from crates.io except for the lines below. Both are
`MIT OR Apache-2.0`, © the Blitz contributors (https://github.com/dioxuslabs/blitz).
Remove a patch as soon as upstream ships an equivalent fix.

| Crate | Version | Change | Why |
|---|---|---|---|
| blitz-dom | 0.2.4 | `src/document.rs:180` `MediaType::screen()` → `MediaType::print()` | We render paged print output; `@media print` rules were ignored and `@media screen` applied. Verified by `invoice_paginates_repeats_header_and_honours_print_rules`. |
| blitz-html | 0.2.0 | `src/html_sink.rs:149` removed `println!("ERROR: {error}")` | HTML parse errors were written to **stdout**, corrupting PDFs streamed to stdout by the CLI and polluting host apps (Node/PHP). |
| fulgur-blitz | 0.41.0 | `src/net.rs`: new `is_plain_local_path()`; `resolve_local_path` requires a base dir and rejects UNC/device paths **before** `canonicalize()`; resource reads capped at 32 MiB | `canonicalize()` on `\host\share\x` opened SMB connections from untrusted HTML (SSRF + NTLM hash leak on Windows), even without `baseDir`. Found by the security review; test `unc_paths_never_touch_the_network`. |
| fulgur-blitz | 0.41.0 | `src/blitz_adapter.rs` `resolve_style_imports`: same UNC check before `canonicalize()` | same issue via `@import` |
| fulgur-blitz | 0.41.0 | `src/template.rs`: `env.set_fuel(Some(10_000_000))`; `Cargo.toml`: minijinja feature `fuel` | templates had no CPU bound. Test `template_cpu_is_bounded`. |

fulgur-blitz is `MIT OR Apache-2.0`, © the Fulgur contributors (https://github.com/fulgur-rs/fulgur).
All three issues should be reported upstream.
