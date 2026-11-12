//! Layout geometry tests: the PDF content stream is decoded with lopdf (independent of the
//! renderer) and positions are compared with values computed by hand from the CSS spec.
//! Coordinates are in PDF points with origin at the top-left of the page (y grows down);
//! 1 CSS px = 0.75 pt. Every page uses margin 0 and `body{margin:0}` so CSS px map 1:1.

use angelito_pdf::{Margin, RenderOptions, render};
use lopdf::{Document, Object, content::Content};
use std::collections::BTreeMap;

const TOL: f32 = 0.5;

type M = [f32; 6];
fn mul(a: M, b: M) -> M {
    [
        a[0] * b[0] + a[1] * b[2],
        a[0] * b[1] + a[1] * b[3],
        a[2] * b[0] + a[3] * b[2],
        a[2] * b[1] + a[3] * b[3],
        a[4] * b[0] + a[5] * b[2] + b[4],
        a[4] * b[1] + a[5] * b[3] + b[5],
    ]
}
fn apply(m: M, x: f32, y: f32) -> (f32, f32) {
    (m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5])
}

#[derive(Debug, Clone)]
struct Text {
    s: String,
    /// Start of the text run (left edge, baseline), top-left origin.
    x: f32,
    y: f32,
}

/// Axis-aligned bounding box of a painted path.
#[derive(Debug, Clone, Copy)]
struct Rect {
    x: f32,
    y: f32,
    w: f32,
    h: f32,
    rgb: [f32; 3],
    /// Line width (strokes only, in pt).
    lw: f32,
}

#[derive(Debug, Default)]
struct Page {
    texts: Vec<Text>,
    fills: Vec<Rect>,
    strokes: Vec<Rect>,
}

fn px(v: f32) -> f32 {
    v * 0.75
}

fn close(got: f32, want: f32, what: &str) {
    assert!((got - want).abs() <= TOL, "{what}: expected {want} pt, got {got} pt");
}

impl Page {
    fn text(&self, s: &str) -> &Text {
        let hits: Vec<_> = self.texts.iter().filter(|t| t.s == s).collect();
        assert_eq!(hits.len(), 1, "text {s:?} must appear exactly once; texts: {:?}", self.texts);
        hits[0]
    }
    fn fill(&self, hex: u32) -> Rect {
        let hits: Vec<_> = self.fills.iter().filter(|r| same_rgb(r.rgb, hex)).collect();
        assert_eq!(hits.len(), 1, "fill #{hex:06x} must appear exactly once; fills: {:?}", self.fills);
        *hits[0]
    }
    fn stroke(&self, hex: u32) -> Rect {
        let hits: Vec<_> = self.strokes.iter().filter(|r| same_rgb(r.rgb, hex)).collect();
        assert_eq!(hits.len(), 1, "stroke #{hex:06x} must appear exactly once; strokes: {:?}", self.strokes);
        *hits[0]
    }
}

fn same_rgb(rgb: [f32; 3], hex: u32) -> bool {
    let c = [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255].map(|v| v as f32 / 255.0);
    (0..3).all(|i| (rgb[i] - c[i]).abs() < 0.01)
}

/// Asserts a rect's box in CSS px (converted to pt).
fn assert_box(r: Rect, x: f32, y: f32, w: f32, h: f32, what: &str) {
    close(r.x, px(x), &format!("{what} x"));
    close(r.y, px(y), &format!("{what} y"));
    close(r.w, px(w), &format!("{what} width"));
    close(r.h, px(h), &format!("{what} height"));
}

fn nums(ops: &[Object]) -> Vec<f32> {
    ops.iter().filter_map(|o| o.as_float().ok()).collect()
}

/// Renders `body` (page margin 0, body margin 0) and decodes every page.
fn layout(body: &str) -> Vec<Page> {
    let html = format!("<style>body{{margin:0}}</style>{body}");
    let o = RenderOptions { margin: Some(Margin::Uniform(0.0)), ..Default::default() };
    let doc = Document::load_mem(&render(&html, &o).unwrap()).unwrap();
    doc.get_pages().values().map(|&id| decode_page(&doc, id)).collect()
}

fn one_page(body: &str) -> Page {
    let mut pages = layout(body);
    assert_eq!(pages.len(), 1, "expected a single page");
    pages.remove(0)
}

// shortcut: a run's position is taken at Tm/Td/T*, not advanced by glyph widths inside a
// TJ; enough because the renderer emits one Tm per glyph run. Upgrade if it starts chaining TJ.
fn decode_page(doc: &Document, id: lopdf::ObjectId) -> Page {
    let fonts = doc.get_page_fonts(id).unwrap();
    let enc: BTreeMap<_, _> = fonts.into_iter().filter_map(|(n, f)| f.get_font_encoding(doc).ok().map(|e| (n, e))).collect();
    let mb = doc.get_object(id).unwrap().as_dict().unwrap().get(b"MediaBox").unwrap().as_array().unwrap();
    let top = mb[3].as_float().unwrap();
    let content = Content::decode(&doc.get_page_content(id)).unwrap();

    #[derive(Clone)]
    struct G {
        ctm: M,
        fill: [f32; 3],
        stroke: [f32; 3],
        lw: f32,
    }
    let id_m = [1.0, 0.0, 0.0, 1.0, 0.0, 0.0];
    let mut g = G { ctm: id_m, fill: [0.0; 3], stroke: [0.0; 3], lw: 1.0 };
    let mut stack = vec![];
    let (mut tm, mut tlm, mut leading, mut font) = (id_m, id_m, 0.0f32, None);
    let mut path: Vec<(f32, f32)> = vec![];
    let mut page = Page::default();
    // Device space -> top-left origin.
    let to_page = |m: M, x, y| {
        let (dx, dy) = apply(m, x, y);
        (dx, top - dy)
    };
    let bbox = |p: &[(f32, f32)], rgb, lw| {
        let (x0, x1) = p.iter().fold((f32::MAX, f32::MIN), |(a, b), q| (a.min(q.0), b.max(q.0)));
        let (y0, y1) = p.iter().fold((f32::MAX, f32::MIN), |(a, b), q| (a.min(q.1), b.max(q.1)));
        Rect { x: x0, y: y0, w: x1 - x0, h: y1 - y0, rgb, lw }
    };
    for op in &content.operations {
        let n = nums(&op.operands);
        match op.operator.as_str() {
            "q" => stack.push(g.clone()),
            "Q" => g = stack.pop().unwrap(),
            "cm" => g.ctm = mul([n[0], n[1], n[2], n[3], n[4], n[5]], g.ctm),
            "rg" if n.len() == 3 => g.fill = [n[0], n[1], n[2]],
            "g" => g.fill = [n[0]; 3],
            "RG" if n.len() == 3 => g.stroke = [n[0], n[1], n[2]],
            "G" => g.stroke = [n[0]; 3],
            "w" => g.lw = n[0],
            "m" | "l" => path.push(to_page(g.ctm, n[0], n[1])),
            "c" => path.push(to_page(g.ctm, n[4], n[5])),
            "v" | "y" => path.push(to_page(g.ctm, n[2], n[3])),
            "re" => {
                for (x, y) in [(n[0], n[1]), (n[0] + n[2], n[1] + n[3])] {
                    path.push(to_page(g.ctm, x, y));
                }
            }
            "f" | "F" | "f*" | "B" | "B*" | "b" | "b*" | "S" | "s" => {
                if !path.is_empty() {
                    let o = op.operator.as_str();
                    if o != "S" && o != "s" {
                        page.fills.push(bbox(&path, g.fill, 0.0));
                    }
                    if !o.starts_with('f') && o != "F" {
                        page.strokes.push(bbox(&path, g.stroke, g.lw * g.ctm[0].abs()));
                    }
                }
                path.clear();
            }
            "n" => path.clear(),
            "BT" => (tm, tlm) = (id_m, id_m),
            "Tf" => font = op.operands[0].as_name().ok().map(|f| f.to_vec()),
            "TL" => leading = n[0],
            "Tm" => (tm, tlm) = ([n[0], n[1], n[2], n[3], n[4], n[5]], [n[0], n[1], n[2], n[3], n[4], n[5]]),
            "Td" | "TD" => {
                if op.operator == "TD" {
                    leading = -n[1];
                }
                tlm = mul([1.0, 0.0, 0.0, 1.0, n[0], n[1]], tlm);
                tm = tlm;
            }
            "T*" => {
                tlm = mul([1.0, 0.0, 0.0, 1.0, 0.0, -leading], tlm);
                tm = tlm;
            }
            "Tj" | "TJ" => {
                let e = font.as_ref().and_then(|f| enc.get(f)).expect("text without a decodable font");
                let mut s = String::new();
                let mut push = |o: &Object| {
                    if let Ok(b) = o.as_str() {
                        s.push_str(&Document::decode_text(e, b).unwrap());
                    }
                };
                match &op.operands[0] {
                    Object::Array(a) => a.iter().for_each(&mut push),
                    o => push(o),
                }
                let (x, y) = to_page(mul(tm, g.ctm), 0.0, 0.0);
                page.texts.push(Text { s, x, y });
            }
            _ => {}
        }
    }
    page
}

// ---------------------------------------------------------------- helper sanity

#[test]
fn helper_sanity_absolute_text_and_margin_box() {
    let p = one_page(
        "<div style='position:absolute;left:100px;top:200px;font-size:16px'>Hola</div>\
         <div style='margin:80px 0 0 40px;width:60px;height:20px;background:#ff0000'></div>",
    );
    let t = p.text("Hola");
    close(t.x, px(100.0), "absolute text x");
    // Baseline sits inside the first line box: below the box top, above top + font-size.
    assert!(t.y > px(200.0) && t.y < px(216.0), "baseline {} not within the line", t.y);
    assert_box(p.fill(0xff0000), 40.0, 80.0, 60.0, 20.0, "margin box");
}

// ---------------------------------------------------------------- flexbox

const R: u32 = 0xff0000;
const G: u32 = 0x00ff00;
const B: u32 = 0x0000ff;

/// Three 100x20 px children in a 400 px wide flex container.
fn flex3(container: &str, child: &str) -> Page {
    let c = |hex: u32| format!("<div style='width:100px;height:20px;flex-shrink:0;background:#{hex:06x};{child}'></div>");
    one_page(&format!("<div style='display:flex;width:400px;{container}'>{}{}{}</div>", c(R), c(G), c(B)))
}

fn xs(p: &Page) -> [f32; 3] {
    [R, G, B].map(|c| p.fill(c).x)
}

fn assert_xs(p: &Page, want_px: [f32; 3], what: &str) {
    let got = xs(p);
    for i in 0..3 {
        close(got[i], px(want_px[i]), &format!("{what} child {i} x"));
    }
}

#[test]
fn flex_justify_content() {
    for (jc, want) in [
        ("flex-start", [0.0, 100.0, 200.0]),
        ("center", [50.0, 150.0, 250.0]),
        ("flex-end", [100.0, 200.0, 300.0]),
        ("space-between", [0.0, 150.0, 300.0]),
        ("space-around", [100.0 / 6.0, 150.0, 300.0 - 100.0 / 6.0]),
        ("space-evenly", [25.0, 150.0, 275.0]),
    ] {
        assert_xs(&flex3(&format!("justify-content:{jc}"), ""), want, jc);
    }
}

#[test]
fn flex_align_items() {
    for (ai, want_y) in [("flex-start", 0.0), ("center", 40.0), ("flex-end", 80.0)] {
        let p = flex3(&format!("height:100px;align-items:{ai}"), "");
        for c in [R, G, B] {
            close(p.fill(c).y, px(want_y), &format!("align-items:{ai} y"));
        }
    }
    // stretch (default) fills the cross size when the item has no height.
    let p = one_page("<div style='display:flex;height:100px'><div style='width:50px;background:#ff0000'></div></div>");
    assert_box(p.fill(R), 0.0, 0.0, 50.0, 100.0, "align-items:stretch");
}

#[test]
fn flex_gap() {
    assert_xs(&flex3("gap:20px", ""), [0.0, 120.0, 240.0], "gap:20px");
}

#[test]
fn flex_grow_distributes_free_space() {
    // Free space 400 - 200 = 200 split 1:3 -> 150 px and 250 px.
    let p = one_page(
        "<div style='display:flex;width:400px'>\
         <div style='flex:1 1 100px;height:20px;background:#ff0000'></div>\
         <div style='flex:3 1 100px;height:20px;background:#00ff00'></div></div>",
    );
    assert_box(p.fill(R), 0.0, 0.0, 150.0, 20.0, "grow 1");
    assert_box(p.fill(G), 150.0, 0.0, 250.0, 20.0, "grow 3");
}

#[test]
fn flex_shrink_and_wrap() {
    // nowrap: 300 px of items in 240 px, equal shrink -> 80 px each.
    let c = |hex: u32| format!("<div style='width:100px;height:20px;background:#{hex:06x}'></div>");
    let items = format!("{}{}{}", c(R), c(G), c(B));
    let p = one_page(&format!("<div style='display:flex;width:240px'>{items}</div>"));
    for (i, col) in [R, G, B].into_iter().enumerate() {
        assert_box(p.fill(col), 80.0 * i as f32, 0.0, 80.0, 20.0, "flex-shrink");
    }
    // wrap: the third item moves to a second line.
    let p = one_page(&format!("<div style='display:flex;flex-wrap:wrap;width:240px'>{items}</div>"));
    assert_box(p.fill(G), 100.0, 0.0, 100.0, 20.0, "wrap line 1");
    assert_box(p.fill(B), 0.0, 20.0, 100.0, 20.0, "wrap line 2");
}

#[test]
fn flex_direction_column() {
    let p = flex3("flex-direction:column", "");
    for (i, c) in [R, G, B].into_iter().enumerate() {
        assert_box(p.fill(c), 0.0, 20.0 * i as f32, 100.0, 20.0, "column");
    }
}

// ---------------------------------------------------------------- grid

fn grid(style: &str, items: &[(u32, &str)]) -> Page {
    let cells: String = items.iter().map(|(c, s)| format!("<div style='height:20px;background:#{c:06x};{s}'></div>")).collect();
    one_page(&format!("<div style='display:grid;{style}'>{cells}</div>"))
}

#[test]
fn grid_template_columns_px_and_fr() {
    let p = grid("width:400px;grid-template-columns:100px 1fr 2fr", &[(R, ""), (G, ""), (B, "")]);
    assert_box(p.fill(R), 0.0, 0.0, 100.0, 20.0, "100px");
    assert_box(p.fill(G), 100.0, 0.0, 100.0, 20.0, "1fr");
    assert_box(p.fill(B), 200.0, 0.0, 200.0, 20.0, "2fr");
}

#[test]
fn grid_repeat_and_gap() {
    // (460 - 3*20) / 4 = 100 px per column.
    let p = grid("width:460px;grid-template-columns:repeat(4,1fr);gap:20px", &[(R, ""), (G, ""), (B, ""), (0xffff00, "")]);
    for (i, c) in [R, G, B, 0xffff00].into_iter().enumerate() {
        assert_box(p.fill(c), 120.0 * i as f32, 0.0, 100.0, 20.0, "repeat(4,1fr)");
    }
}

#[test]
fn grid_row_and_column_gap() {
    let p = grid("grid-template-columns:100px 100px;gap:10px 30px", &[(R, ""), (G, ""), (B, "")]);
    assert_box(p.fill(G), 130.0, 0.0, 100.0, 20.0, "column-gap");
    assert_box(p.fill(B), 0.0, 30.0, 100.0, 20.0, "row-gap");
}

#[test]
fn grid_column_span() {
    let p = grid("grid-template-columns:repeat(3,100px)", &[(R, "grid-column:span 2"), (G, ""), (B, "")]);
    assert_box(p.fill(R), 0.0, 0.0, 200.0, 20.0, "span 2");
    assert_box(p.fill(G), 200.0, 0.0, 100.0, 20.0, "after span");
    assert_box(p.fill(B), 0.0, 20.0, 100.0, 20.0, "next row");
}

// ---------------------------------------------------------------- box model

#[test]
fn box_model_content_box() {
    // border box = 100 + 2*5 + 2*3 = 116 x 66, placed at the margins.
    let p = one_page("<div style='margin:10px 20px;padding:5px;border:3px solid #0000ff;width:100px;height:50px;background:#ff0000'></div>");
    assert_box(p.fill(R), 20.0, 10.0, 116.0, 66.0, "content-box background");
}

#[test]
fn box_model_border_box() {
    let p = one_page("<div style='box-sizing:border-box;padding:5px;border:3px solid #0000ff;width:100px;height:50px;background:#ff0000'></div>");
    assert_box(p.fill(R), 0.0, 0.0, 100.0, 50.0, "border-box background");
}

#[test]
fn box_model_padding_offsets_text() {
    let p = one_page("<div style='padding:12px 0 0 40px;border-left:8px solid #000'>Pad</div>");
    close(p.text("Pad").x, px(48.0), "text x after border + padding");
}

#[test]
fn margin_between_blocks() {
    // Adjacent vertical margins collapse: max(30, 10) = 30 px.
    let p = one_page(
        "<div style='height:20px;margin-bottom:30px;background:#ff0000'></div>\
         <div style='height:20px;margin-top:10px;background:#00ff00'></div>",
    );
    close(p.fill(G).y, px(50.0), "collapsed margin");
}

#[test]
fn border_width_and_color() {
    // Uniform border: stroked on the centre line of the border area.
    let p = one_page("<div style='width:100px;height:40px;border:4px solid #336699'></div>");
    let s = p.stroke(0x336699);
    close(s.lw, px(4.0), "border width");
    assert_box(s, 2.0, 2.0, 104.0, 44.0, "border centre line");
}

#[test]
fn background_color_is_exact() {
    let p = one_page("<div style='width:10px;height:10px;background-color:#336699'></div>");
    let r = p.fill(0x336699);
    let want = [0x33, 0x66, 0x99].map(|v| v as f32 / 255.0);
    for i in 0..3 {
        assert!((r.rgb[i] - want[i]).abs() < 0.002, "channel {i}: {:?} vs {want:?}", r.rgb);
    }
}

// ---------------------------------------------------------------- positioning

#[test]
fn position_relative_offsets_from_flow() {
    let p = one_page(
        "<div style='height:20px'></div>\
         <div style='position:relative;left:30px;top:40px;width:50px;height:10px;background:#ff0000'></div>",
    );
    assert_box(p.fill(R), 30.0, 60.0, 50.0, 10.0, "relative");
}

#[test]
fn position_absolute_in_relative_container() {
    let p = one_page(
        "<div style='position:relative;margin-left:100px;width:400px;height:100px'>\
         <div style='position:absolute;right:0;bottom:10px;width:50px;height:20px;background:#ff0000'></div></div>",
    );
    assert_box(p.fill(R), 450.0, 70.0, 50.0, 20.0, "absolute right/bottom");
}

// ---------------------------------------------------------------- text-align

#[test]
fn text_align_left_center_right() {
    let x = |a: &str| one_page(&format!("<div style='width:400px;text-align:{a}'>Mmm</div>")).text("Mmm").x;
    let (l, c, r) = (x("left"), x("center"), x("right"));
    close(l, 0.0, "left");
    // right = 400 - w, center = (400 - w) / 2, for the same glyph width w.
    assert!(r > px(300.0) && r < px(400.0), "right-aligned start {r} implausible");
    close(c, r / 2.0, "center = right / 2");
}

// ---------------------------------------------------------------- more flex / grid / block

#[test]
fn flex_row_reverse_order_and_align_self() {
    assert_xs(&flex3("flex-direction:row-reverse", ""), [300.0, 200.0, 100.0], "row-reverse");
    let p = one_page(
        "<div style='display:flex;height:100px;align-items:flex-start'>\
         <div style='order:2;width:100px;height:20px;background:#ff0000'></div>\
         <div style='order:1;align-self:flex-end;width:100px;height:20px;background:#00ff00'></div></div>",
    );
    assert_box(p.fill(G), 0.0, 80.0, 100.0, 20.0, "order:1 + align-self:flex-end");
    assert_box(p.fill(R), 100.0, 0.0, 100.0, 20.0, "order:2");
}

#[test]
fn margin_auto_centers_block() {
    // Page width 595.28 pt; a 400 px (300 pt) block is centred.
    let p = one_page("<div style='margin:0 auto;width:400px;height:10px;background:#ff0000'></div>");
    close(p.fill(R).x, (595.28 - 300.0) / 2.0, "margin:auto x");
}

#[test]
fn grid_template_areas_and_justify_items() {
    let p = one_page(
        "<div style='display:grid;grid-template-columns:100px 200px;grid-template-areas:\"a b\" \"c c\";justify-items:center'>\
         <div style='grid-area:b;width:50px;height:20px;background:#ff0000'></div>\
         <div style='grid-area:c;width:50px;height:20px;background:#00ff00'></div></div>",
    );
    // Area b = column 2 (x 100..300), centred 50 px item -> x = 175. Area c spans 0..300 -> x = 125.
    assert_box(p.fill(R), 175.0, 0.0, 50.0, 20.0, "area b centred");
    assert_box(p.fill(G), 125.0, 20.0, 50.0, 20.0, "area c centred");
}

#[test]
fn inline_block_flows_horizontally() {
    // font-size:0 removes the inter-element whitespace.
    let p = one_page(
        "<div style='font-size:0'><div style='display:inline-block;width:100px;height:20px;background:#ff0000'></div>\
         <div style='display:inline-block;width:60px;height:20px;background:#00ff00'></div></div>",
    );
    close(p.fill(R).x, 0.0, "inline-block 1 x");
    close(p.fill(G).x, px(100.0), "inline-block 2 x");
}

#[test]
#[ignore = "bug: border-color with 4 different side colours paints one stroked rectangle in the top colour (#ff0000) for all sides; right/bottom/left colours are never painted"]
fn per_side_border_colors() {
    let p = one_page("<div style='width:100px;height:40px;border-style:solid;border-width:4px;border-color:#ff0000 #00ff00 #0000ff #ffff00'></div>");
    let any = |hex: u32| p.fills.iter().chain(&p.strokes).filter(|r| same_rgb(r.rgb, hex)).count();
    for c in [R, G, B, 0xffff00] {
        assert_eq!(any(c), 1, "side colour #{c:06x} painted once; fills {:?} strokes {:?}", p.fills, p.strokes);
    }
}
