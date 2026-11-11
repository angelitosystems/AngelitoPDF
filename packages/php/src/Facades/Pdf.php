<?php

namespace AngelitoPdf\Facades;

use Illuminate\Support\Facades\Facade;

/**
 * @method static \AngelitoPdf\PdfBuilder html(string $html)
 * @method static \AngelitoPdf\PdfBuilder view(string $view, array $data = [])
 */
class Pdf extends Facade
{
    protected static function getFacadeAccessor(): string
    {
        return \AngelitoPdf\PdfFactory::class;
    }
}
