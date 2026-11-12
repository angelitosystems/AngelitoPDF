//! Integration tests: every PDF is re-parsed with lopdf (independent of the renderer)
//! and checked for page count, page size and extracted text.

use angelito_pdf::{Engine, Error, Margin, RenderOptions, render};
use lopdf::Document;

fn fixture(name: &str) -> String {
    std::fs::read_to_string(format!("{}/../../tests/fixtures/{name}", env!("CARGO_MANIFEST_DIR"))).unwrap()
}

fn parse(pdf: &[u8]) -> Document {
    assert!(pdf.starts_with(b"%PDF-"), "missing PDF header");
    Document::load_mem(pdf).expect("lopdf must parse the output")
}

fn page_texts(doc: &Document) -> Vec<String> {
    doc.get_pages().keys().map(|&n| doc.extract_text(&[n]).unwrap_or_default()).collect()
}

/// MediaBox [w, h] in points of the first page.
fn first_page_size(doc: &Document) -> (f32, f32) {
    let id = *doc.get_pages().values().next().unwrap();
    let mb = doc.get_object(id).unwrap().as_dict().unwrap().get(b"MediaBox").unwrap().as_array().unwrap();
    let n = |i: usize| mb[i].as_float().unwrap();
    (n(2) - n(0), n(3) - n(1))
}

#[test]
fn simple_html_produces_valid_pdf_with_text() {
    let pdf = render("<h1>Hola Angelito</h1><p style='color:red'>Texto ñandú</p>", &RenderOptions::default()).unwrap();
    let doc = parse(&pdf);
    assert_eq!(doc.get_pages().len(), 1);
    let text = page_texts(&doc).concat();
    assert!(text.contains("Hola Angelito"), "text was: {text:?}");
    assert!(text.contains("ñandú"), "text was: {text:?}");
    let (w, h) = first_page_size(&doc);
    assert!((w - 595.28).abs() < 0.5 && (h - 841.89).abs() < 0.5, "A4 expected, got {w}x{h}");
}

#[test]
fn invoice_paginates_repeats_header_and_honours_print_rules() {
    let doc = parse(&render(&fixture("invoice.html"), &RenderOptions::default()).unwrap());
    let pages = page_texts(&doc);
    let n = pages.len();
    assert!(n >= 3, "90-row table + forced break should span >= 3 pages, got {n}");
    for (i, t) in pages.iter().enumerate() {
        assert!(t.contains(&format!("Página {} de {n}", i + 1)), "page {} footer missing: {t:?}", i + 1);
        assert!(!t.contains("ESTO NO DEBE APARECER"), "@media print not applied on page {}", i + 1);
    }
    assert!(pages[1].contains("Descripción"), "thead not repeated on page 2");
    assert!(pages[n - 1].contains("Condiciones"), "break-before: page section not on last page");
    assert!(!pages[n - 2].contains("Condiciones"));
    let all = pages.concat();
    for row in ["Producto de prueba número 1 ", "número 90 "] {
        assert!(all.contains(row), "row {row:?} lost");
    }
}

#[test]
fn page_formats_orientation_and_ticket_sizes() {
    let size = |o: RenderOptions| first_page_size(&parse(&render("<p>x</p>", &o).unwrap()));
    let (w, h) = size(RenderOptions { format: "letter".into(), ..Default::default() });
    assert!((w - 612.0).abs() < 0.5 && (h - 792.0).abs() < 0.5, "{w}x{h}");
    let (w, h) = size(RenderOptions { format: "A5".into(), landscape: true, ..Default::default() });
    assert!(w > h && (h - 419.5).abs() < 1.0, "{w}x{h}");
    let (w, _) = size(RenderOptions { width_mm: Some(80.0), height_mm: Some(200.0), margin: Some(Margin::Uniform(3.0)), ..Default::default() });
    assert!((w - 80.0 * 72.0 / 25.4).abs() < 0.5, "80mm ticket width, got {w}");
    let (w, _) = size(RenderOptions { width_mm: Some(58.0), height_mm: Some(150.0), ..Default::default() });
    assert!((w - 58.0 * 72.0 / 25.4).abs() < 0.5, "58mm ticket width, got {w}");
}

#[test]
fn iso_216_a_and_b_series() {
    const A: [(f32, f32); 11] = [(841., 1189.), (594., 841.), (420., 594.), (297., 420.), (210., 297.), (148., 210.), (105., 148.), (74., 105.), (52., 74.), (37., 52.), (26., 37.)];
    const B: [(f32, f32); 11] = [(1000., 1414.), (707., 1000.), (500., 707.), (353., 500.), (250., 353.), (176., 250.), (125., 176.), (88., 125.), (62., 88.), (44., 62.), (31., 44.)];
    let mm = |pt: f32| pt * 25.4 / 72.0;
    // Default margins leave no content area on A10/B10, so pages are margin-free here.
    for (series, table) in [("A", A), ("b", B)] {
        for (n, (w, h)) in table.into_iter().enumerate() {
            let format = format!("{series}{n}");
            let (pw, ph) = first_page_size(&parse(&render("<p>x</p>", &RenderOptions { format: format.clone(), margin: Some(Margin::Uniform(0.0)), ..Default::default() }).unwrap()));
            assert!((mm(pw) - w).abs() <= 0.5 && (mm(ph) - h).abs() <= 0.5, "{format}: expected {w}x{h} mm, got {}x{} mm", mm(pw), mm(ph));
        }
    }
    let bad = |f: &str| matches!(Engine::new(&RenderOptions { format: f.into(), ..Default::default() }), Err(Error::InvalidOptions(_)));
    for f in ["A11", "B-1", "A04", "A+4", "C4", "A", ""] {
        assert!(bad(f), "{f:?} must be rejected");
    }
}

#[test]
fn options_deserialize_from_json_contract() {
    let o: RenderOptions = serde_json::from_str(r#"{"format":"Letter","margin":[10,5,10,5],"title":"T","systemFonts":false}"#).unwrap();
    assert_eq!(o.margin, Some(Margin::Sides([10.0, 5.0, 10.0, 5.0])));
    assert!(!o.system_fonts);
    assert!(serde_json::from_str::<RenderOptions>(r#"{"formato":"A4"}"#).is_err(), "unknown fields must be rejected");
}

#[test]
fn invalid_options_are_rejected() {
    let bad = |o: RenderOptions| matches!(Engine::new(&o), Err(Error::InvalidOptions(_)));
    assert!(bad(RenderOptions { format: "A99".into(), ..Default::default() }));
    assert!(bad(RenderOptions { width_mm: Some(80.0), ..Default::default() }));
    assert!(bad(RenderOptions { margin: Some(Margin::Uniform(-1.0)), ..Default::default() }));
}

#[test]
fn input_size_limit_is_enforced() {
    let o = RenderOptions { max_input_bytes: 100, ..Default::default() };
    assert!(matches!(render(&"a".repeat(101), &o), Err(Error::InputTooLarge { size: 101, limit: 100 })));
}

#[test]
fn template_data_is_rendered_and_html_escaped() {
    let o = RenderOptions {
        data: Some(serde_json::json!({"cliente": "<b>ACME</b>", "items": [{"n": "Uno"}, {"n": "Dos"}]})),
        ..Default::default()
    };
    let pdf = render("<p>Cliente: {{ cliente }}</p>{% for i in items %}<p>{{ i.n }}</p>{% endfor %}", &o).unwrap();
    let text = page_texts(&parse(&pdf)).concat();
    assert!(text.contains("<b>ACME</b>"), "data must be escaped and shown literally: {text:?}");
    assert!(text.contains("Uno") && text.contains("Dos"));
}

#[test]
fn text_without_any_font_is_an_error() {
    let o = RenderOptions { system_fonts: false, ..Default::default() };
    match render("<p>Hola</p>", &o) {
        Err(Error::Render(m)) => assert!(m.contains("no font"), "{m}"),
        other => panic!("expected Error::Render, got {:?}", other.map(|b| b.len())),
    }
    // Documents without text still render; whitespace alone is not text.
    let png = "iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAEElEQVR4nGM4wcAARwzEcQBRwwyB7RhOggAAAABJRU5ErkJggg==";
    let html = format!("<div style='width:10px;height:10px;background:red'></div>\n  <p> </p><p> <img src='data:image/png;base64,{png}'> </p>");
    let doc = parse(&render(&html, &o).unwrap());
    assert_eq!((doc.get_pages().len(), image_count(&doc)), (1, 1));
}

#[test]
fn metadata_is_written() {
    let o = RenderOptions { title: Some("Factura F001".into()), author: Some("Angelito Systems".into()), ..Default::default() };
    let doc = parse(&render("<p>x</p>", &o).unwrap());
    let info = doc.trailer.get(b"Info").and_then(|r| doc.get_object(r.as_reference().unwrap())).unwrap().as_dict().unwrap();
    let s = |k: &[u8]| String::from_utf8_lossy(info.get(k).unwrap().as_str().unwrap()).into_owned();
    assert!(s(b"Title").contains("Factura F001"));
    assert!(s(b"Author").contains("Angelito Systems"));
}

#[test]
fn engine_is_reusable_and_thread_safe() {
    fn assert_send_sync<T: Send + Sync>() {}
    assert_send_sync::<Engine>();
    let engine = std::sync::Arc::new(Engine::new(&RenderOptions::default()).unwrap());
    let handles: Vec<_> = (0..4)
        .map(|i| {
            let e = engine.clone();
            std::thread::spawn(move || e.render(&format!("<p>doc {i}</p>")).unwrap())
        })
        .collect();
    for (i, h) in handles.into_iter().enumerate() {
        assert!(page_texts(&parse(&h.join().unwrap())).concat().contains(&format!("doc {i}")));
    }
}

fn image_count(doc: &Document) -> usize {
    doc.objects.values().filter(|o| o.as_stream().is_ok_and(|s| s.dict.get(b"Subtype").is_ok_and(|v| v.as_name().is_ok_and(|n| n == b"Image")))).count()
}

#[test]
fn data_uri_image_is_embedded() {
    let html = r#"<img style="width:40px" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAEElEQVR4nGM4wcAARwzEcQBRwwyB7RhOggAAAABJRU5ErkJggg==">"#;
    assert_eq!(image_count(&parse(&render(html, &RenderOptions::default()).unwrap())), 1);
}

#[test]
fn images_are_embedded_only_when_registered() {
    let html = r#"<img style="width:40px" src="logo.png">"#;
    let fixtures = format!("{}/../../tests/fixtures", env!("CARGO_MANIFEST_DIR"));
    let with_base = RenderOptions { base_dir: Some(fixtures.clone().into()), ..Default::default() };
    assert_eq!(image_count(&parse(&render(html, &with_base).unwrap())), 0, "src alone must not embed a file");
    // Explicit width+height: registering the image is enough.
    let reg = RenderOptions { images: [("logo.png".into(), format!("{fixtures}/logo.png").into())].into(), ..Default::default() };
    let sized = r#"<img style="width:40px;height:40px" src="logo.png">"#;
    assert_eq!(image_count(&parse(&render(sized, &reg).unwrap())), 1);
    // Registered without baseDir and without height: the intrinsic size comes from the registered bytes.
    assert_eq!(image_count(&parse(&render(html, &reg).unwrap())), 1);
    let both = RenderOptions { base_dir: Some(fixtures.into()), ..reg };
    assert_eq!(image_count(&parse(&render(html, &both).unwrap())), 1);
    let missing = RenderOptions { images: [("x.png".into(), "no/such.png".into())].into(), ..Default::default() };
    assert!(matches!(Engine::new(&missing), Err(Error::InvalidOptions(_))));
}
