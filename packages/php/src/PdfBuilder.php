<?php

namespace AngelitoPdf;

use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\HeaderUtils;
use Illuminate\Http\Response;

class PdfBuilder
{
    public function __construct(private Renderer $renderer, private string $html, private array $options = []) {}

    public function format(string $format): static
    {
        return $this->options(['format' => $format]);
    }

    public function landscape(bool $landscape = true): static
    {
        return $this->options(['landscape' => $landscape]);
    }

    /** 'portrait' or 'landscape'. */
    public function orientation(string $orientation): static
    {
        return match ($orientation) {
            'portrait' => $this->landscape(false),
            'landscape' => $this->landscape(),
            default => throw new PdfException("orientation must be 'portrait' or 'landscape', got '{$orientation}'", 2),
        };
    }

    /** Millimetres: margin(10) or margin(top, right, bottom, left). */
    public function margin(float $top, ?float $right = null, ?float $bottom = null, ?float $left = null): static
    {
        $m = $right === null ? $top : [$top, $right, $bottom ?? $top, $left ?? $right];

        return $this->options(['margin' => $m]);
    }

    /** Any other RenderOptions key (camelCase), validated by the engine. */
    public function options(array $options): static
    {
        $this->options = array_replace($this->options, $options);

        return $this;
    }

    public function output(): string
    {
        return $this->renderer->render($this->html, $this->options);
    }

    public function save(string $path, ?string $disk = null): static
    {
        $disk === null ? file_put_contents($path, $this->output()) : Storage::disk($disk)->put($path, $this->output());

        return $this;
    }

    public function download(string $name = 'document.pdf'): Response
    {
        return $this->response($name, 'attachment');
    }

    public function stream(string $name = 'document.pdf'): Response
    {
        return $this->response($name, 'inline');
    }

    private function response(string $name, string $disposition): Response
    {
        $fallback = preg_replace('/[^\x20-\x7e]|[%\/\\\\]/', '_', $name);

        return new Response($this->output(), 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => HeaderUtils::makeDisposition($disposition, $name, $fallback),
        ]);
    }
}
