import { useState } from 'react'
import results from '../../benches/results.json'

export const TOOLS = [
  { id: 'angelito', name: 'Angelito PDF', color: 'var(--s1)' },
  { id: 'dompdf', name: 'DOMPDF ' + results.versions.dompdf.replace(/^v/, ''), color: 'var(--s2)' },
  { id: 'chrome', name: 'Chrome headless', color: 'var(--s3)' },
]
export const DOCS = {
  simple: 'Simple (h1 + p)',
  invoice: 'Factura · 90 filas · 3 págs',
  'report-1000': 'Reporte · 1000 filas · 22 págs',
}
export const bench = results

/** One measured cell; RSS = worst of the RSS runs (whole process tree), as in docs/benchmarks.md. */
export function cell(doc, tool, mode = 'cold') {
  const c = results.documents[doc].cells.find((x) => x.tool === tool && x.mode === mode)
  if (!c) return null
  const rss = Math.max(...c.rss_runs.map((r) => r.sum_peak_wset)) / 2 ** 20
  return { ...c.stats_ms, rss, bytes: c.pdf.bytes, pages: c.pdf.pages, mode }
}

export const fmt = (n, d = 1) => n.toLocaleString('es-PE', { maximumFractionDigits: d })

export const Icon = ({ d, className = 'size-4' }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    {[].concat(d).map((p) => <path key={p} d={p} />)}
  </svg>
)
export const I = {
  copy: ['M8 8h11v11H8z', 'M5 16V5h11'],
  check: 'M5 12l4 4L19 7',
  chevron: 'M6 9l6 6 6-6',
  search: ['M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z', 'M20 20l-4-4'],
  menu: ['M4 7h16', 'M4 12h16', 'M4 17h16'],
  close: ['M6 6l12 12', 'M18 6L6 18'],
  sun: ['M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M12 2v2', 'M12 20v2', 'M4.9 4.9l1.4 1.4', 'M17.7 17.7l1.4 1.4', 'M2 12h2', 'M20 12h2', 'M4.9 19.1l1.4-1.4', 'M17.7 6.3l1.4-1.4'],
  moon: 'M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z',
  monitor: ['M3 4h18v12H3z', 'M8 20h8', 'M12 16v4'],
  box: ['M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z', 'M12 12l8-4.5', 'M12 12v9', 'M12 12L4 7.5'],
  tag: ['M3 12V3h9l9 9-9 9-9-9z', 'M7.5 7.5h.01'],
  edit: ['M14 4h6v6', 'M20 4l-9 9', 'M18 14v6H4V6h6'],
  bug: ['M12 20a6 6 0 0 0 6-6v-3a6 6 0 0 0-12 0v3a6 6 0 0 0 6 6z', 'M12 11v9', 'M6 13H3', 'M21 13h-3', 'M9 5l-1-2', 'M15 5l1-2'],
  arrow: 'M7 17L17 7M8 7h9v9',
  file: ['M6 3h8l4 4v14H6z', 'M14 3v4h4'],
  hash: ['M5 9h14', 'M4 15h14', 'M10 3L8 21', 'M16 3l-2 18'],
}

export function Code({ children, lang }) {
  const [copied, setCopied] = useState(false)
  const copy = () => navigator.clipboard?.writeText(children.trim()).then(() => {
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  })
  return (
    <div className="my-5 overflow-hidden rounded-lg border border-line bg-surface">
      <div className="flex h-10 items-center justify-between border-b border-line pl-4 pr-1.5">
        <span className="font-mono text-[13px] text-fg3">{lang || 'código'}</span>
        <button onClick={copy} aria-label={copied ? 'Copiado' : 'Copiar código'} className="grid size-7 place-items-center rounded-md text-fg3 hover:bg-hover hover:text-fg">
          <Icon d={copied ? I.check : I.copy} />
        </button>
      </div>
      <pre className="overflow-x-auto px-4 py-3.5 font-mono text-[13px] leading-[22px] text-fg"><code>{children.trim()}</code></pre>
    </div>
  )
}

export function CodeTabs({ tabs }) {
  const [i, setI] = useState(0)
  return (
    <div>
      <div className="-mb-3 flex gap-1" role="tablist">
        {tabs.map((t, j) => (
          <button
            key={t.label} role="tab" aria-selected={i === j} onClick={() => setI(j)}
            className={'border-b-2 px-2.5 py-1.5 text-sm ' + (i === j ? 'border-fg text-fg' : 'border-transparent text-fg2 hover:text-fg')}
          >{t.label}</button>
        ))}
      </div>
      <Code lang={tabs[i].lang}>{tabs[i].code}</Code>
    </div>
  )
}

export const Note = ({ kind = 'info', title, children }) => (
  <div
    className="my-5 rounded-lg border px-4 py-3 text-sm leading-6 text-fg2"
    style={{ background: `var(--${kind}-bg)`, borderColor: `var(--${kind}-line)` }}
  >
    {title && <strong className="mb-0.5 block font-medium text-fg">{title}</strong>}
    <div>{children}</div>
  </div>
)

const METRICS = { p50: { label: 'Tiempo (p50)', unit: 'ms' }, rss: { label: 'Memoria pico', unit: 'MiB' } }

const Seg = ({ label, items, value, onChange }) => (
  <div role="group" aria-label={label} className="inline-flex gap-0.5 rounded-lg border border-line p-0.5">
    {items.map(([k, v]) => (
      <button key={k} aria-pressed={value === k} onClick={() => onChange(k)}
        className={'rounded-md px-2.5 py-1 text-[13px] ' + (value === k ? 'bg-hover text-fg' : 'text-fg2 hover:text-fg')}>{v}</button>
    ))}
  </div>
)

export function BenchChart() {
  const [doc, setDoc] = useState('invoice')
  const [metric, setMetric] = useState('p50')
  const [tip, setTip] = useState(null)
  const rows = TOOLS.map((t) => ({ ...t, c: cell(doc, t.id) }))
  const max = Math.max(...rows.map((r) => r.c[metric]))
  const unit = METRICS[metric].unit
  return (
    <div className="not-prose my-5 overflow-hidden rounded-lg border border-line bg-surface p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap justify-between gap-2">
        <Seg label="Documento" value={doc} onChange={setDoc} items={Object.entries(DOCS).map(([k, v]) => [k, v.split(' · ')[0]])} />
        <Seg label="Métrica" value={metric} onChange={setMetric} items={Object.entries(METRICS).map(([k, v]) => [k, v.label])} />
      </div>
      <p className="mb-3 text-[13px] leading-5 text-fg2">{DOCS[doc]} — {METRICS[metric].label}, en frío. Una barra más corta es mejor.</p>
      <div role="img" aria-label={rows.map((r) => `${r.name}: ${fmt(r.c[metric])} ${unit}`).join(', ')}>
        {rows.map((r) => {
          const pct = (r.c[metric] / max) * 100
          const inside = pct > 78
          const text = `${r.name} · p50 ${fmt(r.c.p50)} ms · p95 ${fmt(r.c.p95)} ms · mín ${fmt(r.c.min)} ms · ${fmt(r.c.rss)} MiB · ${r.c.pages} págs`
          return (
            <div key={r.id} className="my-1.5 grid grid-cols-[6.5rem_minmax(0,1fr)] items-center gap-2.5 sm:grid-cols-[8.5rem_minmax(0,1fr)]">
              <span className="text-right text-[13px] text-fg2">{r.name}</span>
              <div className="relative h-7">
                <div
                  tabIndex={0} className="h-7 min-w-0.5 rounded-r transition-[width] duration-300 hover:outline-2 hover:outline-fg focus:outline-2 focus:outline-fg motion-reduce:transition-none"
                  style={{ width: pct + '%', background: r.color }}
                  onMouseMove={(e) => setTip({ text, x: e.clientX, y: e.clientY })}
                  onMouseLeave={() => setTip(null)} onBlur={() => setTip(null)}
                  onFocus={(e) => { const b = e.target.getBoundingClientRect(); setTip({ text, x: b.left, y: b.bottom }) }}
                />
                <span
                  className={'pointer-events-none absolute top-0 whitespace-nowrap px-2 text-[13px] leading-7 tabular-nums ' + (inside ? 'font-medium text-white' : 'text-fg')}
                  style={inside ? { right: 100 - pct + '%' } : { left: pct + '%' }}
                >{fmt(r.c[metric])} {unit}</span>
              </div>
            </div>
          )
        })}
      </div>
      <div className="mt-3.5 flex flex-wrap gap-4 text-[13px] text-fg2">
        {TOOLS.map((t) => <span key={t.id} className="inline-flex items-center gap-1.5"><i className="inline-block size-2.5 rounded-sm" style={{ background: t.color }} />{t.name}</span>)}
      </div>
      {tip && (
        <div role="tooltip" className="pointer-events-none fixed z-50 max-w-72 rounded-md bg-fg px-2.5 py-1.5 text-xs text-bg"
          style={{ left: Math.min(tip.x + 12, innerWidth - 300), top: tip.y + 14 }}>{tip.text}</div>
      )}
    </div>
  )
}

export function BenchTable() {
  const rows = Object.keys(DOCS)
    .flatMap((d) => TOOLS.flatMap((t) => ['cold', 'warm'].map((m) => ({ d, t, c: cell(d, t.id, m) }))))
    .filter((r) => r.c)
  return (
    <div className="scroll">
      <table>
        <thead><tr><th>Documento</th><th>Herramienta</th><th>Modo</th><th>p50 ms</th><th>p95 ms</th><th>mín ms</th><th>RSS MiB</th><th>PDF KB</th><th>Págs</th></tr></thead>
        <tbody>
          {rows.map(({ d, t, c }) => (
            <tr key={d + t.id + c.mode}>
              <td>{d}</td><td>{t.name}</td><td>{c.mode === 'cold' ? 'frío' : 'caliente'}</td>
              <td>{fmt(c.p50)}</td><td>{fmt(c.p95)}</td><td>{fmt(c.min)}</td><td>{fmt(c.rss)}</td><td>{fmt(c.bytes / 1000)}</td><td>{c.pages}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
