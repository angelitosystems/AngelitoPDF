# ADR-0001: Use Fulgur as the renderer, behind `backend.rs`

**Status:** accepted (2026-11-11)

## Decision

Render with `fulgur = "=0.41.0"`. Only `crates/angelito-pdf/src/backend.rs` imports it.
Two upstream Blitz bugs are patched via `[patch.crates-io]` (`vendor/README.md`).

## Why

- On the same invoice, Fulgur kept all content and repeated table headers; Ironpress dropped
  half the table rows (`docs/research/evaluation.md`). Losing invoice lines is disqualifying.
- Fulgur already composes Blitz/Stylo/Taffy/Parley/Krilla with paged media — the part we
  would otherwise write from scratch.
- Offline by default, base-dir confinement, auto-escaped templates: matches our security defaults.
- Permissive licenses only (plus file-level MPL-2.0 from Stylo, unmodified).

## Rejected

- **Ironpress**: content loss on multi-page tables; ~3.5× slower warm on our fixture.
- **Build our own on Blitz+Krilla**: months of paged-media work Fulgur has done and tests.

## Consequences

- Fulgur is 0.x: upgrades may break `backend.rs`; pinned with `=` and covered by integration tests.
- Our vendored Blitz patches must be re-applied or dropped on every Blitz upgrade; report both upstream.
- Replacing the renderer = rewrite `backend.rs` and keep `tests/` green.
