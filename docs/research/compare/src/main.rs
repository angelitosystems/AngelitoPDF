use std::time::Instant;
fn main() {
    let html = std::fs::read_to_string("../../../tests/fixtures/invoice.html").unwrap();
    for i in 0..3 {
        let t = Instant::now();
        let f = fulgur::engine::Engine::builder().build().render(&html);
        let tf = t.elapsed();
        let t = Instant::now();
        let p = ironpress::html_to_pdf(&html);
        let tp = t.elapsed();
        if i == 0 {
            match &f { Ok(b) => { std::fs::write("fulgur.pdf", b).unwrap(); } Err(e) => println!("fulgur err {e:?}") }
            match &p { Ok(b) => { std::fs::write("ironpress.pdf", b).unwrap(); } Err(e) => println!("ironpress err {e:?}") }
        }
        println!("run{i} fulgur {:?} ({} B) | ironpress {:?} ({} B)", tf, f.map(|b|b.len()).unwrap_or(0), tp, p.map(|b|b.len()).unwrap_or(0));
    }
}
