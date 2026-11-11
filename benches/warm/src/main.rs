//! usage: angelito-warm-bench <fixture.html> <runs>
//! One Engine (built once, timed separately), one untimed-for-stats warm-up render,
//! then <runs> timed renders. Prints JSON: {"engine_new_ms", "first_render_ms", "samples_ms", "pdf_bytes"}.
use std::time::Instant;

fn main() {
    let mut a = std::env::args().skip(1);
    let path = a.next().expect("fixture path");
    let runs: usize = a.next().map_or(20, |r| r.parse().expect("runs"));
    let html = std::fs::read_to_string(&path).expect("read fixture");
    let t = Instant::now();
    let engine = angelito_pdf::Engine::new(&angelito_pdf::RenderOptions::default()).expect("engine");
    let engine_new_ms = t.elapsed().as_secs_f64() * 1e3;
    let t = Instant::now();
    let first = engine.render(&html).expect("render");
    let first_render_ms = t.elapsed().as_secs_f64() * 1e3;
    assert!(first.starts_with(b"%PDF-"));
    let mut samples = Vec::with_capacity(runs);
    let mut size = 0;
    for _ in 0..runs {
        let t = Instant::now();
        let pdf = engine.render(&html).expect("render");
        samples.push(t.elapsed().as_secs_f64() * 1e3);
        assert!(pdf.starts_with(b"%PDF-"));
        size = pdf.len();
    }
    let s: Vec<String> = samples.iter().map(|x| format!("{x:.3}")).collect();
    println!(
        "{{\"engine_new_ms\":{engine_new_ms:.3},\"first_render_ms\":{first_render_ms:.3},\"samples_ms\":[{}],\"pdf_bytes\":{size}}}",
        s.join(",")
    );
}
