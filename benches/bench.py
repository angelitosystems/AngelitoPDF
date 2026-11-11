"""Phase-4 comparative benchmark: angelito-pdf vs DOMPDF vs Chrome headless. Writes benches/results.json.
usage: python benches/bench.py [runs=20] [rss_runs=5]
Needs: target/release/angelito-pdf.exe, benches/warm (cargo build --release),
benches/dompdf (composer install), Chrome, PHP (env PHP, default C:\\php84\\php.exe),
python packages psutil, pypdf, pymupdf."""
import json, os, pathlib, platform, subprocess, sys, datetime
import psutil, pypdf, pymupdf

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from cli_cold import time_runs, peak_rss, stats
from gen_report import generate

ROOT = pathlib.Path(__file__).resolve().parent.parent
B = ROOT / "benches"
OUT = B / "out"
EXE = ".exe" if os.name == "nt" else ""
ANGELITO = str(ROOT / f"target/release/angelito-pdf{EXE}")
WARM = str(B / f"warm/target/release/angelito-warm-bench{EXE}")
PHP = os.environ.get("PHP", r"C:\php84\php.exe")
PHP_ARGS = [PHP, "-d", "memory_limit=-1", str(B / "dompdf/render.php")]
CHROME = os.environ.get("CHROME", r"C:\Program Files\Google\Chrome\Application\chrome.exe")

RUNS = int(sys.argv[1]) if len(sys.argv) > 1 else 20
RSS_RUNS = int(sys.argv[2]) if len(sys.argv) > 2 else 5


def out_check(path):
    def check(_stdout):
        data = path.read_bytes()
        assert data.startswith(b"%PDF-"), path
        path.unlink()
    return check


def pdf_facts(pdf_path, doc, tool, last_row):
    """Independent parsers: pypdf for page count, PyMuPDF for text and a page-1 PNG."""
    pages = len(pypdf.PdfReader(pdf_path).pages)
    d = pymupdf.open(pdf_path)
    text = [p.get_text() for p in d]
    d[0].get_pixmap(dpi=50).save(OUT / f"{doc}-{tool}-p1.png")
    full = "\n".join(text)
    return {
        "bytes": os.path.getsize(pdf_path), "pages": pages,
        "has_noprint_text": "ESTO NO DEBE APARECER" in full,  # @media print must hide it
        "has_page_footer": "Página 1 de" in full,             # @page @bottom-center counter
        "has_accents": "áéíóú" in full,
        "has_last_row": f"número {last_row} con" in full if last_row else None,
        "condiciones_on_page": next((i + 1 for i, t in enumerate(text) if "Condiciones" in t), None),
    }


def cell(name, mode, samples, rss, facts, extra=None):
    # Average whole-machine CPU % since the previous cell (includes the benchmarked tool itself).
    r = {"tool": name, "mode": mode, "system_cpu_percent": psutil.cpu_percent(None), "samples_ms": [round(x, 3) for x in samples],
         "stats_ms": {k: (round(v, 3) if isinstance(v, float) else v) for k, v in stats(samples).items()},
         "rss_runs": [{"max_sampled_tree_rss": a, "sum_peak_wset": b} for a, b in rss],
         "pdf": facts}
    if extra: r.update(extra)
    print(f"  {name:9} {mode:5} p50={r['stats_ms']['p50']:9.1f} p95={r['stats_ms']['p95']:9.1f} "
          f"min={r['stats_ms']['min']:9.1f} rss={max(b for _, b in rss)/2**20:7.1f}MiB "
          f"pages={facts['pages']} bytes={facts['bytes']} cpu={r['system_cpu_percent']}%", flush=True)
    return r


def bench_doc(doc, fixture, last_row):
    html = fixture.read_bytes()
    res = []
    # angelito CLI, cold: stdin -> stdout, exactly how packages/php drives it.
    warm_up = time_runs([ANGELITO], 1, html)  # fills the OS file cache; reported, not in stats
    last = {}
    def keep(o):
        assert o.startswith(b"%PDF-")
        last["pdf"] = o
    s = time_runs([ANGELITO], RUNS, html, check=keep)
    p = OUT / f"{doc}-angelito.pdf"; p.write_bytes(last["pdf"])
    res.append(cell("angelito", "cold", s, [peak_rss([ANGELITO], html) for _ in range(RSS_RUNS)],
                    pdf_facts(p, doc, "angelito", last_row), {"warmup_ms": warm_up}))
    # angelito warm: one Engine in one process (benches/warm), timings taken inside the process.
    argv = [WARM, str(fixture), str(RUNS)]
    j = json.loads(subprocess.run(argv, capture_output=True, check=True).stdout)
    res.append(cell("angelito", "warm", j["samples_ms"], [peak_rss(argv) for _ in range(RSS_RUNS)],
                    pdf_facts(p, doc, "angelito", last_row),
                    {"engine_new_ms": j["engine_new_ms"], "first_render_ms": j["first_render_ms"],
                     "pdf_bytes_in_process": j["pdf_bytes"], "pdf_note": "pdf facts from the cold CLI output (same engine)"}))
    # DOMPDF cold: one `php` process per document.
    p = OUT / f"{doc}-dompdf.pdf"
    argv = PHP_ARGS + ["cold", str(fixture), str(p)]
    warm_up = time_runs(argv, 1)
    s = time_runs(argv, RUNS, check=out_check(p))
    rss = [peak_rss(argv) for _ in range(RSS_RUNS)]
    res.append(cell("dompdf", "cold", s, rss, pdf_facts(p, doc, "dompdf", last_row), {"warmup_ms": warm_up}))
    # DOMPDF warm: same PHP process, after one warm-up render (like a php-fpm worker).
    argv = PHP_ARGS + ["warm", str(fixture), str(RUNS), str(p)]
    j = json.loads(subprocess.run(argv, capture_output=True, check=True).stdout)
    res.append(cell("dompdf", "warm", j["samples_ms"], [peak_rss(argv) for _ in range(RSS_RUNS)],
                    pdf_facts(p, doc, "dompdf", last_row),
                    {"first_render_ms": j["first_render_ms"], "peak_php_memory_bytes": j["peak_php_memory_bytes"]}))
    # Chrome headless: one browser process tree per document (Browsershot-style launch per PDF).
    p = OUT / f"{doc}-chrome.pdf"
    argv = [CHROME, "--headless", "--disable-gpu", "--no-pdf-header-footer",
            f"--print-to-pdf={p}", fixture.as_uri()]
    warm_up = time_runs(argv, 1, check=out_check(p))
    s = time_runs(argv, RUNS, check=out_check(p))
    rss = [peak_rss(argv) for _ in range(RSS_RUNS)]
    res.append(cell("chrome", "cold", s, rss, pdf_facts(p, doc, "chrome", last_row), {"warmup_ms": warm_up}))
    return res


def first_line(argv):
    r = subprocess.run(argv, capture_output=True, text=True)
    return (r.stdout or r.stderr).strip().splitlines()[0]


def main():
    OUT.mkdir(exist_ok=True)
    docs = [("simple", B / "fixtures/simple.html", None),
            ("invoice", ROOT / "tests/fixtures/invoice.html", 90),
            ("report-1000", generate(1000), 1000)]
    dompdf_ver = next(p["version"] for p in json.loads((B / "dompdf/vendor/composer/installed.json").read_text())["packages"]
                      if p["name"] == "dompdf/dompdf")
    cpu = subprocess.run(["powershell", "-NoProfile", "-Command", "(Get-CimInstance Win32_Processor).Name"],
                         capture_output=True, text=True).stdout.strip() if os.name == "nt" else platform.processor()
    result = {
        "started": datetime.datetime.now().astimezone().isoformat(timespec="seconds"),
        "command": "python benches/bench.py " + " ".join(sys.argv[1:]),
        "runs_per_cell": RUNS, "rss_runs_per_cell": RSS_RUNS,
        "p95_method": "statistics.quantiles(n=20, method='inclusive')[18] (linear interpolation)",
        "machine": {"cpu": cpu, "logical_cpus": psutil.cpu_count(), "physical_cpus": psutil.cpu_count(logical=False),
                    "ram_bytes": psutil.virtual_memory().total, "os": platform.platform(),
                    "python": platform.python_version(), "psutil": psutil.__version__,
                    "pypdf": pypdf.__version__, "pymupdf": pymupdf.VersionBind},
        "versions": {"angelito-pdf": first_line([ANGELITO, "--version"]),
                     "rustc": first_line(["rustc", "--version"]),
                     "php": first_line([PHP, "-v"]), "dompdf": dompdf_ver,
                     "chrome": first_line([CHROME, "--version"]),
                     "wkhtmltopdf": "not installed - not measured"},
        "documents": {},
    }
    result["system_cpu_percent_before"] = psutil.cpu_percent(interval=5)
    for doc, fixture, last_row in docs:
        print(doc, flush=True)
        result["documents"][doc] = {"fixture": str(fixture.relative_to(ROOT)).replace("\\", "/"),
                                    "html_bytes": fixture.stat().st_size,
                                    "cells": bench_doc(doc, fixture, last_row)}
    result["finished"] = datetime.datetime.now().astimezone().isoformat(timespec="seconds")
    (B / "results.json").write_text(json.dumps(result, indent=1, ensure_ascii=False), encoding="utf-8")
    print("wrote", B / "results.json")


if __name__ == "__main__":
    main()
