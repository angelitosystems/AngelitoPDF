"""Writes benches/fixtures/report-1000.html: tests/fixtures/invoice.html with 1000 table rows
instead of 90 (same CSS: flex header, grid, @page footer, break-before section).
usage: python benches/gen_report.py [rows]"""
import pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent


def row(i):
    return (f"<tr><td>{i}</td><td>Producto de prueba número {i} con descripción</td>"
            f"<td class=n>{i % 7 + 1}</td><td class=n>S/ {i * 3.5:.2f}</td></tr>")


def generate(rows=1000):
    src = (ROOT / "tests/fixtures/invoice.html").read_text(encoding="utf-8")
    body = "".join(row(i) for i in range(1, rows + 1))
    out, n = re.subn(r"<tbody>.*?</tbody>", lambda _: f"<tbody>{body}</tbody>", src, flags=re.S)
    assert n == 1, "invoice.html must have exactly one <tbody>"
    path = ROOT / f"benches/fixtures/report-{rows}.html"
    path.write_text(out, encoding="utf-8")
    return path


if __name__ == "__main__":
    p = generate(int(sys.argv[1]) if len(sys.argv) > 1 else 1000)
    assert row(90) in (ROOT / "tests/fixtures/invoice.html").read_text(encoding="utf-8"), "row format drifted from invoice.html"
    print(p)
