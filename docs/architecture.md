# Architecture

```
                    ┌──────────────────────────────┐
 Laravel (PHP) ───► │ angelito-pdf CLI (stdin/out) │──┐
                    └──────────────────────────────┘  │
 Node / NestJS ───► napi-rs addon (planned) ──────────┤
 Rust apps ───────────────────────────────────────────┤
                                                      ▼
                    ┌───────────────────────────────────────────┐
                    │ crates/angelito-pdf  (public contract)    │
                    │  RenderOptions · Engine · render · Error  │
                    │  limits (input size), templating, files   │
                    │ ───────────── backend.rs ──────────────── │  ← only file that knows the renderer
                    └───────────────────────┬───────────────────┘
                                            ▼
                     Fulgur 0.41 (Blitz/Stylo → Taffy → Parley → Krilla)
```

## Contract

- `RenderOptions` is the single option set for every language. It deserializes from JSON
  (camelCase, unknown fields rejected), so the CLI, PHP and Node send the **same JSON**.
- `Engine::new(&opts)?.render(html) -> Result<Vec<u8>>`. An `Engine` is `Send + Sync` and
  reusable: fonts are parsed once, documents can be rendered concurrently from many threads.
- `render(html, &opts)` / `render_file(path, &opts)` are one-shot helpers.
- `Error` kinds: `InvalidOptions` (CLI exit 2), `InputTooLarge`, `NestingTooDeep`, `Render` (CLI exit 1).
- Every render runs on its own 256 MiB-stack thread; renderer panics become `Error::Render`.

## Workspace layout

| Path | Contents | Status |
|---|---|---|
| `crates/angelito-pdf` | core library + contract | working, tested |
| `crates/angelito-pdf-cli` | `angelito-pdf` binary: HTML stdin/file → PDF stdout/file | working, tested |
| `packages/php` | Composer package `angelitosystems/pdf` (drives the CLI) | working, tested (Windows x64) |
| `packages/node` | npm package `@angelitosystems/pdf` (napi-rs) | planned (phase 3b) |

There are deliberately no separate `html`, `layout` and `pdf` crates: those stages already exist
as maintained crates inside the renderer (Stylo, Taffy/Parley, Krilla). Wrapping each in an empty
crate of ours would add surface without adding behaviour. A crate gets split out when we own real
code for that stage.

## Why the PHP package uses a CLI instead of a PHP extension (for now)

A PHP extension must be compiled per PHP minor version × thread-safety mode × OS/arch, and many
hosts forbid loading custom extensions. A static CLI binary works with any PHP ≥ 8.1 and needs
only `proc_open`. Cost: one process spawn per document (to be measured in phase 4). An
extension will be considered only if benchmarks show the spawn cost matters.
