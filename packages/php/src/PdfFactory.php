<?php

namespace AngelitoPdf;

class PdfFactory
{
    public function __construct(private Renderer $renderer, private array $defaults = []) {}

    public function html(string $html): PdfBuilder
    {
        return new PdfBuilder($this->renderer, $html, $this->defaults);
    }

    public function view(string $view, array $data = []): PdfBuilder
    {
        return $this->html(view($view, $data)->render());
    }
}
