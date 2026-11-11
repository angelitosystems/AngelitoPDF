import { useEffect, useState } from 'react'
import { DocsPage, SearchDialog, useStored, GITHUB } from './DocsLayout.jsx'
import { Code, CodeTabs, BenchChart, Icon, I, cell, fmt } from './ui.jsx'

function useHash() {
  const [hash, setHash] = useState(location.hash)
  const [navs, setNavs] = useState(0) // in-app navigations; the first load keeps the browser's focus order
  useEffect(() => {
    const on = () => { setHash(location.hash); setNavs((n) => n + 1); window.scrollTo(0, 0) }
    addEventListener('hashchange', on)
    return () => removeEventListener('hashchange', on)
  }, [])
  return [hash, navs]
}

const THEMES = [['system', 'Sistema', I.monitor], ['light', 'Claro', I.sun], ['dark', 'Oscuro', I.moon]]

function ThemeToggle() {
  const [theme, setTheme] = useStored('angelito-theme', 'system')
  useEffect(() => {
    if (theme === 'system') delete document.documentElement.dataset.theme
    else document.documentElement.dataset.theme = theme
  }, [theme])
  return (
    <div role="radiogroup" aria-label="Apariencia" className="flex h-8 items-center rounded-full border border-line p-0.5">
      {THEMES.map(([k, label, icon]) => (
        <button key={k} role="radio" aria-checked={theme === k} aria-label={label} title={label} onClick={() => setTheme(k)}
          className={'grid size-[26px] place-items-center rounded-full ' + (theme === k ? 'bg-hover text-fg' : 'text-fg3 hover:text-fg')}>
          <Icon d={icon} className="size-3.5" />
        </button>
      ))}
    </div>
  )
}

const GitHubMark = () => (
  <svg viewBox="0 0 16 16" className="size-5" fill="currentColor" aria-hidden="true">
    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
  </svg>
)

const NAV = [
  ['Docs', '#/docs/introduccion', (h) => h.startsWith('#/docs') && !/ejemplo|imagenes|plantillas|benchmarks/.test(h)],
  ['Ejemplos', '#/docs/ejemplo-factura', (h) => /ejemplo|imagenes|plantillas/.test(h)],
  ['Benchmarks', '#/docs/benchmarks', (h) => h.includes('benchmarks')],
]

function Header({ hash, onSearch }) {
  return (
    <header className="sticky top-0 z-40 h-16 bg-bg">
      <div className="mx-auto flex h-full max-w-[1448px] items-center gap-6 px-4 sm:px-6">
        <a href="#/" className="flex shrink-0 items-center gap-2.5 text-[15px] font-semibold tracking-[-.3px]">
          <span aria-hidden="true" className="grid size-6 place-items-center rounded-md bg-fg text-[13px] font-bold text-bg">A</span>
          Angelito PDF
        </a>
        <nav aria-label="Principal" className="hidden h-full items-center md:flex">
          {NAV.map(([label, to, on]) => (
            <a key={label} href={to} aria-current={on(hash) ? 'page' : undefined}
              className={'flex h-full items-center px-3 text-sm ' + (on(hash) ? 'text-fg' : 'text-fg2 hover:text-fg')}>{label}</a>
          ))}
          <a href={GITHUB + '/releases'} target="_blank" rel="noreferrer" className="flex h-full items-center gap-0.5 px-3 text-sm text-fg2 hover:text-fg">
            Versiones <Icon d={I.arrow} className="size-3" />
          </a>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={onSearch} aria-label="Buscar (Ctrl K)"
            className="flex h-8 items-center gap-2 rounded-md bg-surface pl-2 pr-1.5 text-sm text-fg3 shadow-[0_0_0_1px_var(--line)] hover:text-fg2 sm:w-[160px] sm:pl-3">
            <Icon d={I.search} className="size-4 sm:hidden" />
            <span className="hidden sm:inline">Buscar…</span>
            <kbd className="ml-auto hidden rounded border border-line px-1.5 font-mono text-[11px] leading-[18px] text-fg3 sm:inline">Ctrl K</kbd>
          </button>
          <ThemeToggle />
          <a href={GITHUB} target="_blank" rel="noreferrer" aria-label="GitHub" className="grid size-8 place-items-center rounded-md text-fg hover:bg-hover"><GitHubMark /></a>
        </div>
      </div>
    </header>
  )
}

const FEATURES = [
  ['Sin Chromium', 'Un único binario nativo en Rust: sin Puppeteer, sin Docker y sin red.'],
  ['CSS moderno', 'Flexbox, Grid, @page, «Página N de M», @media print y saltos de página.'],
  ['Tablas largas', 'El thead se repite en cada página y no se pierden filas: probado con 1000 filas.'],
  ['Tickets térmicos', 'Tamaños a medida en mm para impresoras de 58 y 80 mm.'],
  ['Seguro por defecto', 'No lee archivos ni accede a la red salvo que lo permitas. Con límites de entrada y timeout.'],
  ['Laravel', 'Pdf::view()->download(), stream() y save() con Storage. Sin extensiones de PHP.'],
]

function Landing() {
  useEffect(() => { document.title = 'Angelito PDF Engine' }, [])
  const a = cell('invoice', 'angelito'), d = cell('invoice', 'dompdf'), c = cell('invoice', 'chrome')
  const stats = [
    [fmt(a.p50, 0) + ' ms', 'por factura de 3 págs (p50)'],
    [fmt(d.p50 / a.p50) + '×', 'más rápido que DOMPDF'],
    [fmt(c.p50 / a.p50) + '×', 'más rápido que Chrome headless'],
    [fmt(a.rss, 0) + ' MiB', `de memoria pico (Chrome: ${fmt(c.rss, 0)})`],
  ]
  return (
    <main id="contenido" tabIndex={-1} className="mx-auto max-w-[1448px] px-4 outline-none sm:px-6">
      <section className="mx-auto max-w-[820px] pb-12 pt-16 text-center sm:pt-24">
        <p className="mb-4 text-[13px] text-fg3">Angelito Systems S.A.C. · v0.1.0-dev</p>
        <h1 className="text-[clamp(2.4rem,7vw,4.5rem)] font-semibold leading-[1.05] tracking-[-.045em]">HTML a PDF.<br />Nativo. Rápido. Sin Chromium.</h1>
        <p className="mx-auto mb-8 mt-5 max-w-[620px] text-[clamp(1rem,2.2vw,1.2rem)] leading-relaxed text-fg2">
          Un motor en Rust que convierte tus vistas Blade en PDF con CSS moderno, en milisegundos y con una fracción de la memoria.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <a href="#/docs/instalacion" className="inline-flex h-10 items-center rounded-md bg-fg px-5 text-sm font-medium text-bg hover:opacity-90">Empezar</a>
          <a href="#/docs/benchmarks" className="inline-flex h-10 items-center rounded-md border border-line bg-surface px-5 text-sm font-medium hover:bg-hover">Ver benchmarks</a>
        </div>
        <div className="mt-12 text-left">
          <CodeTabs tabs={[
            { label: 'Laravel', lang: 'php', code: `use AngelitoPdf\\Facades\\Pdf;

return Pdf::view('facturas.show', compact('factura'))
    ->format('A4')->margin(10)
    ->download('F001-123.pdf');` },
            { label: 'CLI', lang: 'bash', code: `echo '<h1>Hola</h1>' | angelito-pdf --options '{"format":"A5"}' > hola.pdf` },
            { label: 'Rust', lang: 'rust', code: `let engine = Engine::new(&RenderOptions::default())?;
let pdf: Vec<u8> = engine.render("<h1>Factura</h1>")?;` },
          ]} />
        </div>
      </section>

      <section aria-label="Cifras de una factura de 3 páginas" className="grid grid-cols-2 overflow-hidden rounded-xl border border-line bg-surface lg:grid-cols-4">
        {stats.map(([n, t], i) => (
          <div key={t} className={'flex flex-col gap-1 p-5 sm:p-6 ' + (i % 2 ? 'border-l border-line ' : '') + (i > 1 ? 'border-t border-line lg:border-t-0 ' : '') + (i === 2 ? 'lg:border-l' : '')}>
            <strong className="text-[clamp(1.5rem,4vw,2rem)] font-semibold tracking-[-.03em] tabular-nums">{n}</strong>
            <span className="text-sm text-fg2">{t}</span>
          </div>
        ))}
      </section>

      <section className="my-12 grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map(([t, s]) => (
          <div key={t} className="bg-bg p-6">
            <h3 className="mb-1.5 text-base font-medium">{t}</h3>
            <p className="text-sm leading-6 text-fg2">{s}</p>
          </div>
        ))}
      </section>

      <section className="border-t border-line py-12">
        <h2 className="text-[clamp(1.6rem,4vw,2.2rem)] font-semibold tracking-[-.03em]">Medido, no prometido</h2>
        <p className="mt-2 text-fg2">20 ejecuciones por celda, con un proceso por documento, en una sola máquina con carga de fondo. La metodología y los datos crudos están en el repositorio.</p>
        <BenchChart />
        <p className="text-[13px] text-fg2">DOMPDF hace menos trabajo: no aplica flex ni grid ni pies de @page. <a className="text-fg underline underline-offset-4" href="#/docs/benchmarks">Detalles y advertencias →</a></p>
      </section>

      <section className="mx-auto max-w-[720px] border-t border-line py-12 text-center">
        <h2 className="text-[clamp(1.6rem,4vw,2.2rem)] font-semibold tracking-[-.03em]">Instálalo en tu proyecto Laravel</h2>
        <div className="text-left">
          <Code lang="bash">{`composer require angelitosystems/pdf
php artisan pdf:install`}</Code>
        </div>
        <p className="text-[13px] text-fg2">Binarios para Linux, Windows y macOS (x64 y ARM64). <a className="text-fg underline underline-offset-4" href="#/docs/instalacion">Guía de instalación →</a></p>
      </section>
    </main>
  )
}

export default function App() {
  const [hash, navs] = useHash()
  const [searching, setSearching] = useState(false)
  useEffect(() => {
    const on = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setSearching(true) }
    }
    addEventListener('keydown', on)
    return () => removeEventListener('keydown', on)
  }, [])
  const m = hash.match(/^#\/docs\/?([\w-]*)\/?([\w-]*)/)
  return (
    <>
      <a href="#contenido" onClick={(e) => { e.preventDefault(); document.getElementById('contenido')?.focus() }}
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-fg focus:px-3 focus:py-2 focus:text-bg">Saltar al contenido</a>
      <Header hash={hash} onSearch={() => setSearching(true)} />
      {m ? <DocsPage slug={m[1]} section={m[2] || null} focusTitle={navs > 0} /> : <Landing />}
      <SearchDialog open={searching} onClose={() => setSearching(false)} />
      <footer className="border-t border-line px-4 py-6 text-center text-[13px] text-fg3">
        Angelito Systems S.A.C. · MIT OR Apache-2.0 · Lo que no está medido, no aparece.
      </footer>
    </>
  )
}
