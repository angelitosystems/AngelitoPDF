"""Self-check of the measuring code. usage: python benches/test_cli_cold.py"""
import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from cli_cold import peak_rss, stats, time_runs

MiB = 2**20
# A child that allocates 200 MiB must report a peak >= 200 MiB; a trivial one far less.
big = [sys.executable, "-c", "a = bytearray(200 * 1024 * 1024); a[::4096] = b'x' * len(a[::4096])"]
small = [sys.executable, "-c", "pass"]
_, peak_big = peak_rss(big)
_, peak_small = peak_rss(small)
assert peak_big >= 200 * MiB, peak_big / MiB
assert peak_small < 100 * MiB, peak_small / MiB
# Process tree: parent spawns a 200 MiB child, so the tree peak must include it.
tree = [sys.executable, "-c", f"import subprocess; subprocess.run({big!r}, check=True)"]
sampled, peak_tree = peak_rss(tree)
assert peak_tree >= 200 * MiB + peak_small // 2, peak_tree / MiB
assert len(time_runs(small, 3)) == 3
st = stats([float(x) for x in range(1, 21)])
assert (st["min"], st["p50"], st["max"]) == (1.0, 10.5, 20.0) and abs(st["p95"] - 19.05) < 1e-9, st
print(f"ok big={peak_big/MiB:.0f}MiB small={peak_small/MiB:.0f}MiB tree={peak_tree/MiB:.0f}MiB (sampled {sampled/MiB:.0f})")
