//! Paged-media tests (docs/pagination.md): margin-box alignment from the decoded content
//! stream, custom fonts embedded in the PDF, and fragmentation (`break-*`) checked per page.
//! Every PDF is re-parsed with lopdf, independent of the renderer.

use angelito_pdf::{RenderOptions, render};
use lopdf::content::Content;
use lopdf::{Dictionary, Document, Object, ObjectId};
use std::path::PathBuf;

const MM: f32 = 72.0 / 25.4;

fn fixtures() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../tests/fixtures")
}

fn parse(pdf: &[u8]) -> Document {
    Document::load_mem(pdf).expect("lopdf must parse the output")
}

fn page_texts(doc: &Document) -> Vec<String> {
    doc.get_pages().keys().map(|&n| doc.extract_text(&[n]).unwrap_or_default()).collect()
}

fn num(o: &Object) -> f32 {
    o.as_float().unwrap_or_else(|_| o.as_i64().unwrap() as f32)
}

/// One `Tj`/`TJ` show: horizontal extent and baseline y, in PDF user space (origin bottom-left).
#[derive(Debug, Clone, Copy)]
struct Run {
    x0: f32,
    x1: f32,
    y: f32,
}

/// Glyph widths (1/1000 em) of a Type0/Identity-H font: (DW, W array).
fn cid_widths(doc: &Document, font: &Dictionary) -> (f32, Vec<Object>) {
    assert_eq!(font.get(b"Subtype").unwrap().as_name().unwrap(), b"Type0", "only Type0 fonts are measured");
    let deref = |o: &Object| match o {
        Object::Reference(r) => doc.get_object(*r).unwrap().clone(),
        o => o.clone(),
    };
    let desc = deref(&deref(font.get(b"DescendantFonts").unwrap()).as_array().unwrap()[0]);
    let desc = desc.as_dict().unwrap();
    let dw = desc.get(b"DW").map(num).unwrap_or(1000.0);
    let w = desc.get(b"W").map(|o| deref(o).as_array().unwrap().clone()).unwrap_or_default();
    (dw, w)
}

fn cid_width(cid: u32, dw: f32, w: &[Object]) -> f32 {
    let mut i = 0;
    while i < w.len() {
        let c = w[i].as_i64().unwrap() as u32;
        if let Ok(arr) = w[i + 1].as_array() {
            if cid >= c && cid < c + arr.len() as u32 {
                return num(&arr[(cid - c) as usize]);
            }
            i += 2;
        } else {
            if cid >= c && cid <= w[i + 1].as_i64().unwrap() as u32 {
                return num(&w[i + 2]);
            }
            i += 3;
        }
    }
    dw
}

/// Decode the page content stream, following `cm`, `Tm`, `Td`, `Tf` and `Tj`/`TJ`.
/// shortcut: assumes no rotation/skew and Tc = Tw = 0 (what the renderer emits); upgrade if that changes.
fn text_runs(doc: &Document, page: ObjectId) -> Vec<Run> {
    let fonts = doc.get_page_fonts(page).unwrap();
    let ops = Content::decode(&doc.get_page_content(page)).unwrap().operations;
    let (mut ctm, mut stack) = ([1.0, 1.0, 0.0, 0.0f32], Vec::new()); // [a, d, e, f]
    let (mut tm, mut lm) = ([1.0, 1.0, 0.0, 0.0f32], [1.0, 1.0, 0.0, 0.0f32]);
    let (mut size, mut widths) = (0.0f32, (1000.0, Vec::new()));
    let mut runs = Vec::new();
    for op in ops {
        let n = |i: usize| num(&op.operands[i]);
        match op.operator.as_str() {
            "q" => stack.push(ctm),
            "Q" => ctm = stack.pop().unwrap(),
            "cm" => ctm = [ctm[0] * n(0), ctm[1] * n(3), ctm[0] * n(4) + ctm[2], ctm[1] * n(5) + ctm[3]],
            "BT" => (tm, lm) = ([1.0, 1.0, 0.0, 0.0], [1.0, 1.0, 0.0, 0.0]),
            "Tm" => {
                tm = [n(0), n(3), n(4), n(5)];
                lm = tm;
            }
            "Td" => {
                lm = [lm[0], lm[1], lm[2] + n(0) * lm[0], lm[3] + n(1) * lm[1]];
                tm = lm;
            }
            "Tf" => {
                size = n(1);
                widths = cid_widths(doc, fonts[op.operands[0].as_name().unwrap()]);
            }
            "Tj" | "TJ" => {
                let items = if op.operator == "TJ" { op.operands[0].as_array().unwrap().clone() } else { op.operands.clone() };
                let mut adv = 0.0; // text space units
                for it in &items {
                    match it {
                        Object::String(b, _) => {
                            adv += b.chunks(2).map(|c| cid_width(u32::from(c[0]) << 8 | u32::from(c[1]), widths.0, &widths.1)).sum::<f32>() / 1000.0 * size
                        }
                        o => adv -= num(o) / 1000.0 * size,
                    }
                }
                let ux = |x: f32| ctm[0] * (tm[2] + x * tm[0]) + ctm[2];
                runs.push(Run { x0: ux(0.0), x1: ux(adv), y: ctm[1] * tm[3] + ctm[3] });
                tm[2] += adv * tm[0];
            }
            _ => {}
        }
    }
    runs
}

/// Horizontal extent of all runs whose baseline lies in `[y_lo, y_hi]`.
fn extent(runs: &[Run], y_lo: f32, y_hi: f32) -> (f32, f32) {
    let band: Vec<_> = runs.iter().filter(|r| r.y >= y_lo && r.y <= y_hi).collect();
    assert!(!band.is_empty(), "no text between y={y_lo} and y={y_hi}: {runs:?}");
    (band.iter().map(|r| r.x0).fold(f32::MAX, f32::min), band.iter().map(|r| r.x1).fold(f32::MIN, f32::max))
}

#[test]
fn margin_boxes_are_aligned_on_their_side() {
    let html = r#"<style>@page { size: A4; margin: 20mm;
        @top-left { content: "Izquierda" } @top-right { content: "Derecha" }
        @bottom-center { content: "Página " counter(page) " de " counter(pages) } }</style><p>Cuerpo</p>"#;
    let doc = parse(&render(html, &RenderOptions::default()).unwrap());
    let page = *doc.get_pages().values().next().unwrap();
    let runs = text_runs(&doc, page);
    let (w, h, m) = (595.28, 841.89, 20.0 * MM);
    let top: Vec<_> = runs.iter().filter(|r| r.y > h - m).collect();
    assert_eq!(top.len(), 2, "{runs:?}");
    let (left, right) = if top[0].x0 < top[1].x0 { (top[0], top[1]) } else { (top[1], top[0]) };
    assert!((left.x0 - m).abs() < MM, "@top-left must start at the left margin: {left:?}");
    assert!((right.x1 - (w - m)).abs() < MM, "@top-right must end at the right margin: {right:?}");
    let (x0, x1) = extent(&runs, 0.0, m);
    assert!(((x0 + x1) / 2.0 - w / 2.0).abs() < MM, "@bottom-center not centred: {x0}..{x1}");
}

#[test]
fn bottom_right_and_author_text_align_override() {
    let html = r#"<style>@page { margin: 15mm;
        @bottom-right { content: "p. " counter(page) } @top-center { content: "Encabezado"; text-align: left } }</style><p>x</p>"#;
    let doc = parse(&render(html, &RenderOptions::default()).unwrap());
    let runs = text_runs(&doc, *doc.get_pages().values().next().unwrap());
    let (w, h, m) = (595.28, 841.89, 15.0 * MM);
    let (_, x1) = extent(&runs, 0.0, m);
    assert!((x1 - (w - m)).abs() < MM, "@bottom-right must end at the right margin: {x1}");
    let (x0, _) = extent(&runs, h - m, h);
    assert!((x0 - m).abs() < MM, "author text-align: left must override the UA centre: {x0}");
}

#[test]
fn invoice_footer_is_centred_on_every_page() {
    let html = std::fs::read_to_string(fixtures().join("invoice.html")).unwrap();
    let doc = parse(&render(&html, &RenderOptions::default()).unwrap());
    assert!(doc.get_pages().len() >= 3);
    for (n, &page) in doc.get_pages().iter() {
        let (x0, x1) = extent(&text_runs(&doc, page), 0.0, 15.0 * MM);
        assert!(((x0 + x1) / 2.0 - 595.28 / 2.0).abs() < MM, "page {n} footer not centred: {x0}..{x1}");
    }
}

// ---- fonts -------------------------------------------------------------------------------

/// (BaseFont, has FontFile2/FontFile3) of every embedded font descriptor.
fn embedded_fonts(doc: &Document) -> Vec<(String, bool)> {
    doc.objects
        .values()
        .filter_map(|o| o.as_dict().ok())
        .filter(|d| d.get(b"Type").and_then(Object::as_name).is_ok_and(|n| n == b"FontDescriptor"))
        .map(|d| {
            let name = String::from_utf8_lossy(d.get(b"FontName").unwrap().as_name().unwrap()).into_owned();
            (name, d.has(b"FontFile2") || d.has(b"FontFile3"))
        })
        .collect()
}

fn assert_noto_embedded(doc: &Document) {
    let fonts = embedded_fonts(doc);
    let noto: Vec<_> = fonts.iter().filter(|(n, _)| n.contains("NotoSans")).collect();
    assert!(!noto.is_empty(), "NotoSans not in the PDF: {fonts:?}");
    for (name, file) in noto {
        assert!(file, "{name} has no FontFile2/FontFile3");
        let (tag, _) = name.split_once('+').unwrap_or_else(|| panic!("{name} is not subset-tagged"));
        assert!(tag.len() == 6 && tag.bytes().all(|b| b.is_ascii_uppercase()), "bad subset tag in {name}");
    }
}

#[test]
fn fonts_option_embeds_the_font() {
    let o = RenderOptions { fonts: vec![fixtures().join("paged/NotoSans-Regular.woff2")], system_fonts: false, ..Default::default() };
    let doc = parse(&render("<p style=\"font-family:'Noto Sans'\">Fuente propia ñandú</p>", &o).unwrap());
    assert_noto_embedded(&doc);
    assert!(page_texts(&doc).concat().contains("Fuente propia ñandú"));
}

#[test]
fn font_face_in_linked_stylesheet_resolves_against_base_dir() {
    let html = "<link rel=stylesheet href=fonts.css><p style=\"font-family: 'Noto Sans'\">Texto de marca</p>";
    let o = RenderOptions { base_dir: Some(fixtures().join("paged")), system_fonts: false, ..Default::default() };
    let doc = parse(&render(html, &o).unwrap());
    assert_noto_embedded(&doc);
    assert!(page_texts(&doc).concat().contains("Texto de marca"));
    // Without baseDir neither the stylesheet nor the font is read (local files are opt-in).
    // With system fonts off that leaves no font at all, which is reported instead of dropping the text.
    let none = render(html, &RenderOptions { system_fonts: false, ..Default::default() });
    assert!(matches!(none, Err(angelito_pdf::Error::Render(ref m)) if m.contains("no font")), "{:?}", none.map(|b| b.len()));
}

// ---- fragmentation -----------------------------------------------------------------------

/// Page index (0-based) of every page whose text contains `needle`.
fn pages_with(pages: &[String], needle: &str) -> Vec<usize> {
    pages.iter().enumerate().filter(|(_, t)| t.contains(needle)).map(|(i, _)| i).collect()
}

#[test]
fn forced_breaks_and_legacy_aliases_start_a_new_page() {
    for css in ["break-after: page", "page-break-after: always"] {
        let html = format!("<p>Antes</p><div style='{css}'>Bloque</div><p>Despues</p>");
        let pages = page_texts(&parse(&render(&html, &RenderOptions::default()).unwrap()));
        assert_eq!(pages.len(), 2, "{css}: {pages:?}");
        assert_eq!((pages_with(&pages, "Bloque"), pages_with(&pages, "Despues")), (vec![0], vec![1]), "{css}");
    }
    for css in ["break-before: page", "page-break-before: always"] {
        let html = format!("<p>Antes</p><div style='{css}'>Bloque</div>");
        let pages = page_texts(&parse(&render(&html, &RenderOptions::default()).unwrap()));
        assert_eq!((pages_with(&pages, "Antes"), pages_with(&pages, "Bloque")), (vec![0], vec![1]), "{css}");
    }
}

/// A block of 12 paragraphs placed so it straddles the first page boundary.
fn straddling_block(css: &str) -> Vec<String> {
    let lines: String = (1..=12).map(|i| format!("<p>Linea {i:02}</p>")).collect();
    let html = format!("<div style='height:900px'></div><div style='{css}'>{lines}</div>");
    page_texts(&parse(&render(&html, &RenderOptions::default()).unwrap()))
}

#[test]
fn break_inside_avoid_keeps_a_block_on_one_page() {
    let split = straddling_block("");
    assert_ne!(pages_with(&split, "Linea 01"), pages_with(&split, "Linea 12"), "control: block must straddle the break");
    for css in ["break-inside: avoid", "break-inside: avoid-page", "page-break-inside: avoid"] {
        let pages = straddling_block(css);
        assert_eq!(pages_with(&pages, "Linea 01"), vec![1], "{css}: block must move to page 2: {pages:?}");
        assert_eq!(pages_with(&pages, "Linea 12"), vec![1], "{css}");
    }
}

#[test]
fn table_rows_with_break_inside_avoid_are_never_split() {
    let rows: String = (1..=60).map(|r| format!("<tr><td>F{r:02}a<br>F{r:02}b<br>F{r:02}c</td></tr>")).collect();
    let html = format!("<style>tr {{ break-inside: avoid }}</style><table>{rows}</table>");
    let pages = page_texts(&parse(&render(&html, &RenderOptions::default()).unwrap()));
    assert!(pages.len() >= 2, "60 three-line rows must paginate");
    for r in 1..=60 {
        let first = pages_with(&pages, &format!("F{r:02}a"));
        assert_eq!(first.len(), 1, "row {r} on {first:?}");
        assert_eq!(first, pages_with(&pages, &format!("F{r:02}c")), "row {r} split across pages");
    }
}
