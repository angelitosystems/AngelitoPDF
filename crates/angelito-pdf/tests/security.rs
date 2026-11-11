//! Local-file access is denied by default and confined to `baseDir` when set.
//! Probe: a stylesheet that hides a marker. Marker visible ⇒ stylesheet was NOT read.

use angelito_pdf::{RenderOptions, render};
use std::path::PathBuf;

fn text(html: &str, opts: &RenderOptions) -> String {
    let pdf = render(html, opts).unwrap();
    let doc = lopdf::Document::load_mem(&pdf).unwrap();
    doc.get_pages().keys().map(|&n| doc.extract_text(&[n]).unwrap_or_default()).collect()
}

/// <tmp>/angelito-sec-<test>/{outside.css, base/inside.css}
fn sandbox(name: &str) -> (PathBuf, PathBuf) {
    let root = std::env::temp_dir().join(format!("angelito-sec-{name}-{}", std::process::id()));
    let base = root.join("base");
    std::fs::create_dir_all(&base).unwrap();
    std::fs::write(root.join("outside.css"), ".m{display:none}").unwrap();
    std::fs::write(base.join("inside.css"), ".m{display:none}").unwrap();
    (root, base)
}

fn page(href: &str) -> String {
    format!(r#"<html><head><link rel="stylesheet" href="{href}"></head><body><p>ok</p><p class="m">MARKER</p></body></html>"#)
}

#[test]
fn no_file_access_without_base_dir() {
    let (root, _) = sandbox("nobase");
    let url = format!("file:///{}", root.join("outside.css").display().to_string().replace('\\', "/"));
    let t = text(&page(&url), &RenderOptions::default());
    assert!(t.contains("MARKER"), "absolute file:// stylesheet must not be loaded without baseDir");
    let t = text(&page("base/inside.css"), &RenderOptions::default());
    assert!(t.contains("MARKER"), "relative stylesheet must not be loaded without baseDir");
}

#[test]
fn base_dir_allows_inside_and_blocks_traversal() {
    let (_, base) = sandbox("base");
    let opts = RenderOptions { base_dir: Some(base), ..Default::default() };
    assert!(!text(&page("inside.css"), &opts).contains("MARKER"), "stylesheet inside baseDir should load");
    assert!(text(&page("../outside.css"), &opts).contains("MARKER"), "../ traversal must be blocked");
}

#[test]
fn remote_resources_are_not_fetched() {
    // Unroutable TEST-NET address: if the engine tried to fetch it the render would stall or fail.
    let t = text(&page("http://192.0.2.1/x.css"), &RenderOptions::default());
    assert!(t.contains("MARKER") && t.contains("ok"));
}

/// Windows UNC paths (`file://host/share`) must be rejected before any SMB connection is attempted.
/// TEST-NET-2 address: a connection attempt would stall ~20 s.
#[test]
fn unc_paths_never_touch_the_network() {
    let (_, base) = sandbox("unc");
    let host = "198.51.100.7";
    let probes = [
        format!(r#"<img style="width:9px;height:9px" src="file://{host}/s/x.png">"#),
        format!(r#"<div style="background:url(file://{host}/s/x.png);height:9px"></div>"#),
        format!(r#"<link rel="stylesheet" href="file://{host}/s/x.css">"#),
        format!(r#"<link rel="stylesheet" href="//{host}/s/x.css">"#),
        format!(r#"<style>@import url(file://{host}/s/x.css);</style>"#),
    ];
    for opts in [RenderOptions::default(), RenderOptions { base_dir: Some(base.clone()), ..Default::default() }] {
        for html in &probes {
            let t = std::time::Instant::now();
            render(&format!("{html}<p>ok</p>"), &opts).unwrap();
            assert!(t.elapsed().as_secs_f32() < 3.0, "took {:?}, network attempted? {html}", t.elapsed());
        }
    }
}

#[test]
fn deep_nesting_does_not_overflow_the_stack() {
    let nested = |n: usize| format!("{}<p>deep</p>{}", "<div>".repeat(n), "</div>".repeat(n));
    // Crashed at ~300 levels on the default 1 MiB Windows stack before the render thread existed.
    assert!(text(&nested(400), &RenderOptions::default()).contains("deep"));
    // The renderer deliberately drops content deeper than 512 levels (fulgur MAX_DOM_DEPTH).
    assert!(!text(&nested(5_000), &RenderOptions::default()).contains("deep"));
    // Release builds overflowed between 300k and 1M levels (abort, uncatchable): rejected up front,
    // also when a template loop generates the nesting.
    let bomb = "<b>".repeat(1_000_000);
    assert!(matches!(render(&bomb, &RenderOptions::default()), Err(angelito_pdf::Error::NestingTooDeep { .. })));
    let o = RenderOptions { data: Some(serde_json::json!({})), ..Default::default() };
    assert!(matches!(render("{% for i in range(20000) %}<b>{% endfor %}", &o), Err(angelito_pdf::Error::NestingTooDeep { .. })));
}

#[test]
fn renderer_panic_becomes_an_error() {
    // 70k cells in one row trips an index panic inside taffy's grid code.
    let html = format!("<table><tr>{}</tr></table>", "<td>x</td>".repeat(70_000));
    match render(&html, &RenderOptions::default()) {
        Err(angelito_pdf::Error::Render(m)) => assert_eq!(m, "internal renderer error"),
        other => panic!("expected sanitized render error, got {:?}", other.map(|b| b.len())),
    }
}

#[test]
fn template_cpu_is_bounded() {
    let o = RenderOptions { data: Some(serde_json::json!({})), ..Default::default() };
    let t = std::time::Instant::now();
    let r = render("{% for a in range(30000) %}{% for b in range(30000) %}{% endfor %}{% endfor %}", &o);
    assert!(r.is_err(), "runaway template must fail");
    assert!(t.elapsed().as_secs() < 20, "fuel limit too high: {:?}", t.elapsed());
}
