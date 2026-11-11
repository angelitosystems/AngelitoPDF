<?php

namespace AngelitoPdf;

use Illuminate\Console\Command;

class InstallCommand extends Command
{
    protected $signature = 'pdf:install
        {--tag= : Release tag (default: the installed package version, or the latest release)}
        {--path= : Destination (default: config pdf.binary, else storage/app/angelito-pdf/)}
        {--target= : Rust target triple, e.g. x86_64-unknown-linux-gnu (default: this machine)}';

    protected $description = 'Download the angelito-pdf binary for this platform from GitHub Releases';

    public function handle(): int
    {
        $path = $this->option('path') ?: (config('pdf.binary') ?: Installer::defaultPath());
        $tag = $this->option('tag') ?: Installer::tag();
        try {
            $asset = Installer::assetName($this->option('target') ?: null);
            $this->components->info("Downloading {$asset} (".($tag ?? 'latest').')');
            Installer::install($path, $tag, $this->option('target') ?: null, config('pdf.releases_url', Installer::RELEASES));
            // Prove it runs here (e.g. a glibc mismatch shows up now, not on the first invoice).
            if (! $this->option('target') && ! str_starts_with((new Renderer($path, 30))->render('<p>ok</p>'), '%PDF-')) {
                throw new PdfException('installed binary did not produce a PDF', -1);
            }
        } catch (PdfException $e) {
            $this->components->error($e->getMessage());

            return self::FAILURE;
        }
        $this->components->info("Installed and verified: {$path}");

        return self::SUCCESS;
    }
}
