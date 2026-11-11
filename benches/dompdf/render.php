<?php
// cold: php render.php cold <in.html> <out.pdf>        one document per process
// warm: php render.php warm <in.html> <runs> <out.pdf> one warm-up render, then <runs> timed; prints JSON
require __DIR__ . '/vendor/autoload.php';

use Dompdf\Dompdf;
use Dompdf\Options;

function render_pdf(string $html): string
{
    // Defaults a Laravel app gets (barryvdh/laravel-dompdf): A4, no remote fetches.
    $opt = new Options(['isRemoteEnabled' => false, 'defaultPaperSize' => 'a4']);
    $d = new Dompdf($opt);
    $d->loadHtml($html, 'UTF-8');
    $d->render();
    return $d->output();
}

[, $mode, $in] = $argv;
$html = file_get_contents($in);
if ($mode === 'cold') {
    file_put_contents($argv[3], render_pdf($html));
    exit(0);
}
$runs = (int) $argv[3];
$t = hrtime(true);
$pdf = render_pdf($html);
$first = (hrtime(true) - $t) / 1e6;
$samples = [];
for ($i = 0; $i < $runs; $i++) {
    $t = hrtime(true);
    $pdf = render_pdf($html);
    $samples[] = round((hrtime(true) - $t) / 1e6, 3);
}
file_put_contents($argv[4], $pdf);
echo json_encode(['first_render_ms' => round($first, 3), 'samples_ms' => $samples,
    'pdf_bytes' => strlen($pdf), 'peak_php_memory_bytes' => memory_get_peak_usage(true)]), "\n";
