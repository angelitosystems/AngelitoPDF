"""Cold-start measurement: one process per document.
usage: python benches/cli_cold.py <binary> <fixture.html> [runs]   (angelito-pdf CLI, stdin -> stdout)
As a module: `time_runs` and `peak_rss` are used by benches/bench.py for every tool."""
import os, subprocess, sys, time, statistics
import psutil


def time_runs(argv, runs, stdin_bytes=None, check=None):
    """Wall time (ms) of `runs` sequential processes. Unpolled, so RSS sampling cannot skew it."""
    samples = []
    for _ in range(runs):
        t = time.perf_counter()
        p = subprocess.run(argv, input=stdin_bytes, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        samples.append((time.perf_counter() - t) * 1000)
        assert p.returncode == 0, (argv, p.returncode, p.stderr[-2000:])
        if check: check(p.stdout)
    return samples


def _exact_peak(popen):
    """Windows: PeakWorkingSetSize of the root process read after it exited (handle still open)."""
    if os.name != "nt":
        return None
    import ctypes
    from ctypes import wintypes
    class PMC(ctypes.Structure):
        _fields_ = [("cb", wintypes.DWORD), ("PageFaultCount", wintypes.DWORD)] + [
            (n, ctypes.c_size_t) for n in ("PeakWorkingSetSize", "WorkingSetSize", "QuotaPeakPagedPoolUsage",
                                           "QuotaPagedPoolUsage", "QuotaPeakNonPagedPoolUsage",
                                           "QuotaNonPagedPoolUsage", "PagefileUsage", "PeakPagefileUsage")]
    pmc = PMC(cb=ctypes.sizeof(PMC))
    ok = ctypes.WinDLL("psapi").GetProcessMemoryInfo(wintypes.HANDLE(int(popen._handle)), ctypes.byref(pmc), pmc.cb)
    assert ok, "GetProcessMemoryInfo failed"
    return pmc.PeakWorkingSetSize


def peak_rss(argv, stdin_bytes=None, interval=0.002):
    """Run once and poll the whole process tree (parent + all descendants) every `interval` s.
    Returns (max sampled sum of RSS, peak sum) in bytes. The peak sum is the root process's exact
    OS peak working set (read after exit) plus the largest peak_wset seen for each descendant.
    Sampled sum = lower bound (can miss short peaks). Peak sum = upper bound for multi-process
    tools (per-process peaks need not coincide), except descendants living < `interval` are missed.
    For a single-process tool the peak sum is exact."""
    p = subprocess.Popen(argv, stdin=subprocess.PIPE if stdin_bytes is not None else subprocess.DEVNULL,
                         stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    root = psutil.Process(p.pid)
    if stdin_bytes is not None:
        p.stdin.write(stdin_bytes); p.stdin.close()
    peaks, max_sum = {}, 0
    while p.poll() is None:
        try:
            tree = [root] + root.children(recursive=True)
        except psutil.Error:
            break
        total = 0
        for q in tree:
            try:
                m = q.memory_info()
            except psutil.Error:
                continue
            total += m.rss
            peaks[q.pid] = max(peaks.get(q.pid, 0), getattr(m, "peak_wset", m.rss))
        max_sum = max(max_sum, total)
        time.sleep(interval)
    assert p.wait() == 0, (argv, p.returncode)
    exact = _exact_peak(p)
    if exact is not None:
        peaks[p.pid] = max(peaks.get(p.pid, 0), exact)
    return max_sum, sum(peaks.values())


def stats(samples):
    s = sorted(samples)
    return {"n": len(s), "min": s[0], "p50": statistics.median(s),
            "p95": statistics.quantiles(s, n=20, method="inclusive")[18], "max": s[-1]}


if __name__ == "__main__":
    binary, fixture, runs = sys.argv[1], sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else 30
    html = open(fixture, "rb").read()
    out = []
    def chk(o):
        assert o.startswith(b"%PDF-"), o[:40]
        out.append(len(o))
    t = time_runs([binary], runs, html, check=chk)
    _, peak = peak_rss([binary], html)
    st = stats(t)
    print(f"runs={runs} p50={st['p50']:.1f}ms p95={st['p95']:.1f}ms min={st['min']:.1f}ms "
          f"peak_rss~{peak/2**20:.1f}MiB pdf={out[-1]}B")
