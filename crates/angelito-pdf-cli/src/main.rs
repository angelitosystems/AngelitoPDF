//! angelito-pdf [--options <json>] [-o <out.pdf>] [<input.html>]
//! HTML from <input.html> or stdin; PDF to -o or stdout. Options = RenderOptions JSON.
//! Exit: 0 ok, 1 render error, 2 usage/options error.

use std::io::{Read, Write};
use std::process::ExitCode;

const USAGE: &str = "usage: angelito-pdf [--options <json>] [-o <out.pdf>] [<input.html>|-]";

fn main() -> ExitCode {
    // Default panic output includes build-machine paths; the library already maps panics to errors.
    std::panic::set_hook(Box::new(|_| {}));
    match run() {
        Ok(()) => ExitCode::SUCCESS,
        Err((code, msg)) => {
            eprintln!("angelito-pdf: {msg}");
            ExitCode::from(code)
        }
    }
}

fn run() -> Result<(), (u8, String)> {
    let usage = |m: &str| (2, format!("{m}\n{USAGE}"));
    let (mut opts_json, mut out, mut input) = (None, None, None);
    let mut args = std::env::args().skip(1);
    while let Some(a) = args.next() {
        match a.as_str() {
            "--options" => opts_json = Some(args.next().ok_or_else(|| usage("--options needs a value"))?),
            "-o" | "--output" => out = Some(args.next().ok_or_else(|| usage("-o needs a value"))?),
            "-h" | "--help" => {
                println!("{USAGE}");
                return Ok(());
            }
            "-V" | "--version" => {
                println!("angelito-pdf {}", env!("CARGO_PKG_VERSION"));
                return Ok(());
            }
            _ if input.is_none() && (a == "-" || !a.starts_with('-')) => input = Some(a),
            _ => return Err(usage(&format!("unexpected argument '{a}'"))),
        }
    }

    let opts: angelito_pdf::RenderOptions = match opts_json {
        Some(j) => serde_json::from_str(&j).map_err(|e| (2, format!("invalid options: {e}")))?,
        None => Default::default(),
    };
    let io_err = |what: &str, e: std::io::Error| (1, format!("{what}: {}", e.kind()));

    let pdf = match input.as_deref() {
        None | Some("-") => {
            let mut html = String::new();
            // Read one byte past the limit so oversize input is rejected without buffering it all.
            std::io::stdin()
                .take(opts.max_input_bytes as u64 + 1)
                .read_to_string(&mut html)
                .map_err(|e| io_err("cannot read stdin", e))?;
            angelito_pdf::render(&html, &opts)
        }
        Some(path) => angelito_pdf::render_file(path, &opts),
    }
    .map_err(|e| (if matches!(e, angelito_pdf::Error::InvalidOptions(_)) { 2 } else { 1 }, e.to_string()))?;

    match out.as_deref() {
        None | Some("-") => std::io::stdout().lock().write_all(&pdf).map_err(|e| io_err("cannot write stdout", e)),
        Some(path) => std::fs::write(path, &pdf).map_err(|e| io_err("cannot write output", e)),
    }
}
