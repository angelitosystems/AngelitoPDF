<?php

namespace AngelitoPdf;

use Illuminate\Support\ServiceProvider;

class PdfServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->mergeConfigFrom(__DIR__.'/../config/pdf.php', 'pdf');
        $this->app->singleton(PdfFactory::class, fn ($app) => new PdfFactory(
            new Renderer((string) ($app['config']['pdf.binary'] ?: Installer::defaultPath()), (float) $app['config']['pdf.timeout']),
            (array) $app['config']['pdf.defaults'],
        ));
    }

    public function boot(): void
    {
        $this->publishes([__DIR__.'/../config/pdf.php' => config_path('pdf.php')], 'pdf-config');
        if ($this->app->runningInConsole()) {
            $this->commands([InstallCommand::class]);
        }
    }
}
