use std::io::Write;
use std::process::{Command, Stdio};

fn run(args: &[&str], stdin: &[u8]) -> std::process::Output {
    let mut child = Command::new(env!("CARGO_BIN_EXE_angelito-pdf"))
        .args(args)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .unwrap();
    child.stdin.take().unwrap().write_all(stdin).unwrap();
    child.wait_with_output().unwrap()
}

#[test]
fn stdin_to_stdout_is_a_clean_pdf_even_with_malformed_html() {
    // Malformed HTML triggers html5ever parse errors; they must never reach stdout.
    let out = run(&["--options", r#"{"format":"A5","margin":8}"#], b"<p>Hola <b>mundo</p></i><table><p>x");
    assert!(out.status.success(), "stderr: {}", String::from_utf8_lossy(&out.stderr));
    assert!(out.stdout.starts_with(b"%PDF-"), "stdout must start with the PDF header");
    let doc = lopdf::Document::load_mem(&out.stdout).expect("stdout must be a parseable PDF");
    assert!(doc.extract_text(&[1]).unwrap().contains("Hola"));
}

#[test]
fn bad_options_exit_2_with_message_and_no_output() {
    let out = run(&["--options", r#"{"format":"A99"}"#], b"<p>x</p>");
    assert_eq!(out.status.code(), Some(2));
    assert!(out.stdout.is_empty());
    assert!(String::from_utf8_lossy(&out.stderr).contains("unknown format"));
    let out = run(&["--options", "{not json"], b"");
    assert_eq!(out.status.code(), Some(2));
}

#[test]
fn oversize_stdin_is_rejected() {
    let out = run(&["--options", r#"{"maxInputBytes":10}"#], &[b'a'; 50]);
    assert_eq!(out.status.code(), Some(1));
    assert!(String::from_utf8_lossy(&out.stderr).contains("limit is 10"));
}
