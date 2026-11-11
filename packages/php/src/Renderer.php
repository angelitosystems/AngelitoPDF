<?php

namespace AngelitoPdf;

/** Runs the angelito-pdf CLI: HTML on stdin, RenderOptions JSON in argv, PDF on stdout. */
class Renderer
{
    public function __construct(private string $binary, private float $timeout = 60) {}

    public function render(string $html, array $options = []): string
    {
        if ($this->binary === '' || ! is_file($this->binary)) {
            throw new PdfException("angelito-pdf binary not found at '{$this->binary}'. Run `php artisan pdf:install` or set ANGELITO_PDF_BINARY.", -1);
        }
        $json = json_encode($options ?: new \stdClass, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

        // Sockets, not pipes: on Windows only sockets support stream_select / non-blocking I/O, which the timeout needs.
        $spec = [['socket'], ['socket'], ['socket']];
        $proc = proc_open([$this->binary, '--options', $json], $spec, $io, null, null, ['bypass_shell' => true]);
        if (! is_resource($proc)) {
            throw new PdfException('cannot start angelito-pdf', -1);
        }
        foreach ($io as $s) {
            stream_set_blocking($s, false);
        }

        $out = $err = '';
        $written = 0;
        $deadline = microtime(true) + $this->timeout;
        $open = [1 => $io[1], 2 => $io[2]];
        try {
            while ($open) {
                $left = $deadline - microtime(true);
                if ($left <= 0) {
                    proc_terminate($proc);
                    throw new PdfException("angelito-pdf timed out after {$this->timeout}s", -1);
                }
                $r = array_values($open);
                $w = isset($io[0]) ? [$io[0]] : [];
                $e = null;
                if (stream_select($r, $w, $e, (int) $left, (int) (fmod($left, 1) * 1e6)) === false) {
                    throw new PdfException('stream_select failed', -1);
                }
                if ($w) {
                    $n = @fwrite($io[0], substr($html, $written, 65536));
                    $written += (int) $n;
                    if ($n === false || $written >= strlen($html)) {
                        fclose($io[0]); // EOF for the child; a failed write means it stopped reading (it reports why on stderr)
                        unset($io[0]);
                    }
                }
                foreach ($r as $s) {
                    $chunk = fread($s, 65536);
                    $s === $io[1] ? $out .= $chunk : $err .= $chunk;
                    if (feof($s)) {
                        unset($open[$s === $io[1] ? 1 : 2]);
                    }
                }
            }
        } finally {
            foreach ($io as $s) {
                fclose($s);
            }
            $code = proc_close($proc);
        }

        if ($code !== 0) {
            throw new PdfException(trim($err) ?: "angelito-pdf exited with code {$code}", $code);
        }

        return $out;
    }
}
