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

    /** Footer "Página N de M" via a CSS @page margin box; {page} and {pages} are replaced by the counters. */
    public function pageNumbers(bool $enabled = true, string $text = 'Página {page} de {pages}', string $position = 'bottom-center'): static
    {
        if (! $enabled) {
            return $this;
        }
        if (! preg_match('/^(top|bottom)-(left|center|right)$/', $position)) {
            throw new PdfException("pageNumbers position must be top|bottom-left|center|right, got '{$position}'", 2);
        }
        $parts = preg_split('/(\{page\}|\{pages\})/', $text, -1, PREG_SPLIT_DELIM_CAPTURE | PREG_SPLIT_NO_EMPTY);
        $content = implode(' ', array_map(fn ($p) => match ($p) {
            '{page}' => 'counter(page)',
            '{pages}' => 'counter(pages)',
            // CSS string: escape backslash and quote, drop newlines (they would end the declaration).
            default => '"'.str_replace(['\\', '"', "\n", "\r"], ['\\\\', '\\"', ' ', ''], $p).'"',
        }, $parts));
        $this->options['css'] = [...($this->options['css'] ?? []), "@page { @{$position} { content: {$content}; font-size: 9px } }"];

        return $this;
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
