<?php

namespace AngelitoPdf;

use Composer\InstalledVersions;
use Illuminate\Support\Facades\Http;

/** Downloads the angelito-pdf binary for this OS/arch from GitHub Releases and verifies its SHA-256. */
class Installer
{
    public const RELEASES = 'https://github.com/angelitosystems/AngelitoPDF/releases';

    /** Rust target triple of the release asset for an OS family / machine name (php_uname('m')). */
    public static function target(string $os = PHP_OS_FAMILY, ?string $arch = null): string
    {
        $arch = strtolower($arch ?? php_uname('m'));
        $cpu = match (true) {
            in_array($arch, ['x86_64', 'amd64', 'x64'], true) => 'x86_64',
            in_array($arch, ['aarch64', 'arm64'], true) => 'aarch64',
            default => throw new PdfException("unsupported CPU architecture '{$arch}'", -1),
        };

        return match ($os) {
            'Linux' => "{$cpu}-unknown-linux-gnu",
            'Darwin' => "{$cpu}-apple-darwin",
            'Windows' => $cpu === 'x86_64' ? 'x86_64-pc-windows-msvc' : throw new PdfException('Windows ARM64 has no release binary yet', -1),
            default => throw new PdfException("unsupported OS '{$os}'", -1),
        };
    }

    public static function assetName(?string $target = null): string
    {
        $target ??= self::target();

        return 'angelito-pdf-'.$target.(str_contains($target, 'windows') ? '.exe' : '');
    }

    /** Where `pdf:install` puts the binary and where the renderer looks when no path is configured. */
    public static function defaultPath(): string
    {
        return storage_path('app/angelito-pdf/'.(PHP_OS_FAMILY === 'Windows' ? 'angelito-pdf.exe' : 'angelito-pdf'));
    }

    /** Release tag matching the installed package version; dev installs use the latest release. */
    public static function tag(): ?string
    {
        $v = class_exists(InstalledVersions::class) && InstalledVersions::isInstalled('angelitosystems/pdf')
            ? InstalledVersions::getPrettyVersion('angelitosystems/pdf') : null;

        return $v && preg_match('/^v?\d+\.\d+\.\d+/', $v) ? 'v'.ltrim($v, 'v') : null;
    }

    /** @return string path of the installed binary */
    public static function install(string $path, ?string $tag = null, ?string $target = null, string $releases = self::RELEASES): string
    {
        $asset = self::assetName($target);
        $base = rtrim($releases, '/').($tag ? "/download/{$tag}/" : '/latest/download/');

        $sums = Http::timeout(30)->get($base.'SHA256SUMS');
        if (! $sums->successful()) {
            throw new PdfException("cannot download {$base}SHA256SUMS (HTTP {$sums->status()})", -1);
        }
        $expected = null;
        foreach (preg_split('/\R/', trim($sums->body())) as $line) {
            if (preg_match('/^([0-9a-f]{64})\s+\*?(\S+)$/i', trim($line), $m) && $m[2] === $asset) {
                $expected = strtolower($m[1]);
            }
        }
        if ($expected === null) {
            throw new PdfException("release has no binary named {$asset}", -1);
        }

        $bin = Http::timeout(300)->get($base.$asset);
        if (! $bin->successful()) {
            throw new PdfException("cannot download {$base}{$asset} (HTTP {$bin->status()})", -1);
        }
        if (! hash_equals($expected, hash('sha256', $bin->body()))) {
            throw new PdfException("checksum mismatch for {$asset}: download corrupted or tampered with", -1);
        }

        // Write next to the target and rename, so a failed download never leaves a half-written binary in place.
        if (! is_dir(dirname($path)) && ! mkdir(dirname($path), 0755, true) && ! is_dir(dirname($path))) {
            throw new PdfException('cannot create '.dirname($path), -1);
        }
        $tmp = $path.'.part';
        if (file_put_contents($tmp, $bin->body()) === false) {
            throw new PdfException("cannot write {$tmp}", -1);
        }
        chmod($tmp, 0755);
        if (! @rename($tmp, $path)) {
            @unlink($tmp);
            throw new PdfException("cannot replace {$path} (is it running?)", -1);
        }

        return $path;
    }
}
