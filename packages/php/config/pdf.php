<?php

return [
    // Absolute path to the angelito-pdf binary. Empty = storage/app/angelito-pdf/, where `php artisan pdf:install` puts it.
    'binary' => env('ANGELITO_PDF_BINARY'),

    // Where `pdf:install` downloads release binaries from (override for a private mirror).
    'releases_url' => env('ANGELITO_PDF_RELEASES_URL', 'https://github.com/angelitosystems/AngelitoPDF/releases'),

    // Seconds before the render process is killed.
    'timeout' => (float) env('ANGELITO_PDF_TIMEOUT', 60),

    // Default RenderOptions (camelCase keys, same JSON the CLI accepts). Merged under per-document options.
    'defaults' => [
        'format' => 'A4',
    ],
];
