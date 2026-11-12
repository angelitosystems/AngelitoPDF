//! The only module that knows about the renderer (Fulgur, see docs/adr/0001).
//! Swapping renderers means rewriting this file, nothing else.

use crate::{Error, Margin, RenderOptions, Result};
use fulgur::{AssetBundle, PageSize};

pub(crate) struct Backend(fulgur::Engine);

impl Backend {
    pub fn new(opts: &RenderOptions) -> Result<Self> {
        let mut size = match (opts.width_mm, opts.height_mm) {
            (Some(w), Some(h)) if w > 0.0 && h > 0.0 => PageSize::custom(w, h),
            (None, None) => PageSize::from_css_keyword(&opts.format.to_ascii_lowercase())
                .or_else(|| iso_216(&opts.format))
                .ok_or_else(|| Error::InvalidOptions(format!("unknown format '{}'", opts.format)))?,
            _ => return Err(Error::InvalidOptions("widthMm and heightMm must both be positive".into())),
        };
        if opts.landscape {
            size = size.landscape();
        }

        let mut b = fulgur::Engine::builder().page_size(size).system_fonts(opts.system_fonts);
        if let Some(m) = opts.margin {
            let [t, r, bo, l] = match m {
                Margin::Uniform(v) => [v; 4],
                Margin::Sides(s) => s,
            };
            if [t, r, bo, l].iter().any(|v| !v.is_finite() || *v < 0.0) {
                return Err(Error::InvalidOptions("margins must be non-negative".into()));
            }
            let pt = |mm: f32| mm * 72.0 / 25.4;
            b = b.margin(fulgur::Margin { top: pt(t), right: pt(r), bottom: pt(bo), left: pt(l) });
        }
        if let Some(t) = &opts.title {
            b = b.title(t);
        }
        if let Some(a) = &opts.author {
            b = b.author(a);
        }
        if let Some(l) = &opts.lang {
            b = b.lang(l);
        }
        if let Some(dir) = &opts.base_dir {
            b = b.base_path(dir);
        }
        if !opts.css.is_empty() || !opts.fonts.is_empty() || !opts.images.is_empty() {
            let mut assets = AssetBundle::new();
            for css in &opts.css {
                assets.add_css(css.as_str());
            }
            for f in &opts.fonts {
                assets.add_font_file(f).map_err(|e| Error::InvalidOptions(format!("font: {e}")))?;
            }
            for (name, path) in &opts.images {
                assets.add_image_file(name, path).map_err(|e| Error::InvalidOptions(format!("image '{name}': {e}")))?;
            }
            b = b.assets(assets);
        }
        Ok(Self(b.build()))
    }

    pub fn render(&self, html: &str) -> Result<Vec<u8>> {
        self.0.render(html).map_err(|e| Error::Render(e.to_string()))
    }
}

/// ISO 216 A0–A10 / B0–B10: each size halves the previous one's long side, rounded down to whole mm.
fn iso_216(format: &str) -> Option<PageSize> {
    let f = format.trim().to_ascii_uppercase();
    let (series, rest) = f.split_at_checked(1)?;
    let n = rest.parse::<u8>().ok().filter(|n| *n <= 10 && n.to_string() == rest)?; // rejects "A04", "A+4"
    let (mut w, mut h) = match series {
        "A" => (841u32, 1189u32),
        "B" => (1000, 1414),
        _ => return None,
    };
    for _ in 0..n {
        (w, h) = (h / 2, w);
    }
    Some(PageSize::custom(w as f32, h as f32))
}

pub(crate) fn expand_template(tpl: &str, data: &serde_json::Value) -> Result<String> {
    fulgur::template::render_template("document", tpl, data).map_err(|e| Error::Render(e.to_string()))
}
