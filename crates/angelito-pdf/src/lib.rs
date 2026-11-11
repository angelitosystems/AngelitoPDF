//! Angelito PDF Engine — HTML/CSS to PDF without a browser.
//!
//! Public contract shared by every binding (CLI, PHP, Node): [`RenderOptions`]
//! (JSON-deserializable, camelCase) + [`Engine::render`] → PDF bytes.
//! Renderer details live only in `backend.rs`, so the renderer can be swapped.

mod backend;

use serde::Deserialize;
use std::path::PathBuf;

/// Default cap on input HTML size (10 MiB).
pub const DEFAULT_MAX_INPUT_BYTES: usize = 10 * 1024 * 1024;

/// Content deeper than 512 levels is dropped by the renderer anyway; past ~300k levels its
/// recursion overflows even the large render stack, which aborts the process (uncatchable).
pub const MAX_NESTING_DEPTH: usize = 10_000;

/// Cheap lexical upper bound on DOM depth. Returns the depth once it passes `limit`.
/// Tags that cannot nest in themselves or have optional end tags are not counted, so
/// sloppy-but-legal HTML (unclosed `<p>`, `<li>`, `<td>`) is never rejected.
fn exceeds_nesting(html: &str, limit: usize) -> Option<usize> {
    const FLAT: &[&str] = &[
        "area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr",
        "p", "li", "dt", "dd", "tr", "td", "th", "option", "optgroup", "colgroup", "thead", "tbody", "tfoot",
        "rb", "rt", "rp", "param",
    ];
    let b = html.as_bytes();
    let (mut depth, mut i) = (0usize, 0usize);
    while let Some(off) = b[i..].iter().position(|&c| c == b'<') {
        i += off + 1;
        let close = b.get(i) == Some(&b'/');
        let start = i + close as usize;
        let len = b[start.min(b.len())..].iter().take_while(|c| c.is_ascii_alphanumeric()).count();
        if len == 0 || !b[start].is_ascii_alphabetic() {
            continue;
        }
        let name = html[start..start + len].to_ascii_lowercase();
        if FLAT.contains(&name.as_str()) {
            continue;
        }
        if close {
            depth = depth.saturating_sub(1);
        } else {
            let gt = b[start..].iter().position(|&c| c == b'>').map(|p| start + p);
            if gt.is_some_and(|g| b[g - 1] == b'/') {
                continue; // self-closing
            }
            depth += 1;
            if depth > limit {
                return Some(depth);
            }
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::exceeds_nesting;

    #[test]
    fn nesting_estimate() {
        assert_eq!(exceeds_nesting("<div><div></div></div>", 1), Some(2));
        assert_eq!(exceeds_nesting("<div></div><div></div>", 1), None);
        assert_eq!(exceeds_nesting(&"<p>x".repeat(50), 2), None, "unclosed <p> does not nest");
        assert_eq!(exceeds_nesting(&"<tr><td>x".repeat(50), 2), None);
        assert_eq!(exceeds_nesting(&"<br><img src=a><x-a/>".repeat(50), 2), None);
        assert_eq!(exceeds_nesting("<!-- <div><div><div> --> a < b", 1), Some(2), "upper bound: over-counts comments");
        assert_eq!(exceeds_nesting(&"<b>".repeat(5), 4), Some(5));
        assert_eq!(exceeds_nesting("<", 0), None);
        assert_eq!(exceeds_nesting("</", 0), None);
    }
}

/// Stack for the render thread. Virtual reservation; only touched pages are committed.
const RENDER_STACK_BYTES: usize = 256 * 1024 * 1024;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields, default)]
pub struct RenderOptions {
    /// Named size: A3, A4, A5, B4, B5, Letter, Legal, Ledger (case-insensitive).
    /// Ignored when `widthMm`/`heightMm` are set.
    pub format: String,
    /// Custom page size in millimetres, e.g. thermal tickets (58 or 80 mm wide).
    pub width_mm: Option<f32>,
    pub height_mm: Option<f32>,
    pub landscape: bool,
    /// Page margins in mm: `10` or `[top, right, bottom, left]`.
    /// `None` keeps the engine/CSS default (`@page { margin }`).
    pub margin: Option<Margin>,
    pub title: Option<String>,
    pub author: Option<String>,
    pub lang: Option<String>,
    /// Extra stylesheets (CSS text), applied after the document's own styles.
    pub css: Vec<String>,
    /// Font files (TTF/OTF/TTC/WOFF2) to embed. Trusted, developer-supplied paths.
    pub fonts: Vec<PathBuf>,
    /// Images referenced as `<img src="NAME">`, mapped NAME → file. Trusted, developer-supplied paths.
    /// The renderer embeds only registered images; `src` is never read from disk on its own.
    pub images: std::collections::BTreeMap<String, PathBuf>,
    /// Root directory for relative `<link>`/`<img>` resources. `None` (default)
    /// means the document cannot read any local file.
    pub base_dir: Option<PathBuf>,
    /// When set, the HTML is treated as a MiniJinja template (auto-escaped) rendered with this data.
    pub data: Option<serde_json::Value>,
    /// Use fonts installed on the host. Disable for byte-reproducible output across machines.
    pub system_fonts: bool,
    pub max_input_bytes: usize,
}

impl Default for RenderOptions {
    fn default() -> Self {
        Self {
            format: "A4".into(),
            width_mm: None,
            height_mm: None,
            landscape: false,
            margin: None,
            title: None,
            author: None,
            lang: None,
            css: Vec::new(),
            fonts: Vec::new(),
            images: Default::default(),
            base_dir: None,
            data: None,
            system_fonts: true,
            max_input_bytes: DEFAULT_MAX_INPUT_BYTES,
        }
    }
}

#[derive(Debug, Clone, Copy, Deserialize, PartialEq)]
#[serde(untagged)]
pub enum Margin {
    Uniform(f32),
    Sides([f32; 4]),
}

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("invalid options: {0}")]
    InvalidOptions(String),
    #[error("input is {size} bytes, limit is {limit}")]
    InputTooLarge { size: usize, limit: usize },
    #[error("HTML nesting depth exceeds {limit} (estimated {depth})")]
    NestingTooDeep { depth: usize, limit: usize },
    #[error("render failed: {0}")]
    Render(String),
}

pub type Result<T> = std::result::Result<T, Error>;

/// A configured engine. Build once, render many times (fonts are parsed once); `Send + Sync`.
pub struct Engine {
    inner: backend::Backend,
    max_input_bytes: usize,
    data: Option<serde_json::Value>,
}

impl Engine {
    pub fn new(opts: &RenderOptions) -> Result<Self> {
        Ok(Self {
            inner: backend::Backend::new(opts)?,
            max_input_bytes: opts.max_input_bytes,
            data: opts.data.clone(),
        })
    }

    pub fn render(&self, html: &str) -> Result<Vec<u8>> {
        if html.len() > self.max_input_bytes {
            return Err(Error::InputTooLarge { size: html.len(), limit: self.max_input_bytes });
        }
        let expanded;
        let html = match &self.data {
            Some(data) => {
                expanded = backend::expand_template(html, data)?;
                expanded.as_str()
            }
            None => html,
        };
        // Checked after templating: a template loop can generate the nesting.
        if let Some(depth) = exceeds_nesting(html, MAX_NESTING_DEPTH) {
            return Err(Error::NestingTooDeep { depth, limit: MAX_NESTING_DEPTH });
        }
        // Own thread: a large stack for deeply nested HTML (the renderer recurses per element),
        // and a panic inside the renderer becomes an error instead of killing the host process.
        std::thread::scope(|s| {
            std::thread::Builder::new()
                .name("angelito-pdf-render".into())
                .stack_size(RENDER_STACK_BYTES)
                .spawn_scoped(s, || self.inner.render(html))
                .map_err(|_| Error::Render("cannot start render thread".into()))?
                .join()
                .unwrap_or_else(|_| Err(Error::Render("internal renderer error".into())))
        })
    }
}

/// One-shot convenience: `Engine::new(opts)?.render(html)`.
pub fn render(html: &str, opts: &RenderOptions) -> Result<Vec<u8>> {
    Engine::new(opts)?.render(html)
}

/// Read an HTML file and render it. Relative resources resolve against the file's
/// directory unless `opts.base_dir` is already set.
pub fn render_file(path: impl AsRef<std::path::Path>, opts: &RenderOptions) -> Result<Vec<u8>> {
    let path = path.as_ref();
    let html = std::fs::read_to_string(path).map_err(|e| Error::InvalidOptions(format!("cannot read input file: {}", e.kind())))?;
    let mut opts = opts.clone();
    if opts.base_dir.is_none() {
        opts.base_dir = path.parent().map(|p| if p.as_os_str().is_empty() { ".".into() } else { p.to_path_buf() });
    }
    render(&html, &opts)
}
