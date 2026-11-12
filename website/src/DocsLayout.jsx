import { useEffect, useMemo, useRef, useState } from 'react'
import { PAGES } from './docs.jsx'
import { Icon, I } from './ui.jsx'

export const GITHUB = 'https://github.com/angelitosystems/AngelitoPDF'

/** localStorage-backed state; storage can be unavailable (private mode), so failures fall back to memory. */
export function useStored(key, initial) {
  const [v, setV] = useState(() => {
    try { return JSON.parse(localStorage.getItem(key)) ?? initial } catch { return initial }
  })
  const set = (next) => {
    setV(next)
    try { localStorage.setItem(key, JSON.stringify(next)) } catch { /* per-viewer convenience only */ }
  }
  return [v, set]
}

export const slugify = (s) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

const href = (slug, section) => '#/docs/' + slug + (section ? '/' + section : '')

/* ---------- left sidebar ---------- */

const Card = ({ icon, title, sub }) => (
  <div className="flex items-center gap-2.5 px-2 py-1.5">
    <span className="grid size-8 shrink-0 place-items-center rounded-md border border-line bg-surface text-s1"><Icon d={icon} /></span>
    <span className="min-w-0 leading-tight">
      <span className="block text-sm font-medium text-fg">{title}</span>
      <span className="block truncate text-[13px] text-fg2">{sub}</span>
    </span>
  </div>
)

function Toggle({ open, onClick, children, className }) {
  return (
    <button type="button" aria-expanded={open} onClick={onClick}
      className={'flex w-full items-center justify-between rounded-md text-left hover:bg-hover ' + className}>
      {children}
      <Icon d={I.chevron} className={'size-4 shrink-0 text-fg3 transition-transform motion-reduce:transition-none ' + (open ? '' : '-rotate-90')} />
    </button>
  )
}

function NavLink({ page, active, indent }) {
  return (
    <a href={href(page.slug)} aria-current={active ? 'page' : undefined}
      className={'block rounded-md py-2 pr-2.5 text-sm leading-5 ' + indent + ' ' +
        (active ? 'bg-hover font-medium text-fg' : 'text-fg2 hover:bg-hover hover:text-fg')}>
      {page.title}
    </a>
  )
}

export function Sidebar({ slug }) {
  const [open, setOpen] = useStored('angelito-docs-nav', {})
  const groups = [...new Set(PAGES.map((p) => p.group))]
  const isOpen = (k, dflt) => open[k] ?? dflt
  const toggle = (k, dflt) => setOpen({ ...open, [k]: !isOpen(k, dflt) })
  return (
    <nav aria-label="Documentación" className="text-sm">
      <div className="mb-6 space-y-2">
        <Card icon={I.box} title="Paquete Laravel" sub="angelitosystems/pdf" />
        <Card icon={I.tag} title="Versión" sub="v0.1.1" />
      </div>
      {groups.map((g) => {
        const items = PAGES.filter((p) => p.group === g)
        const gOpen = isOpen(g, true)
        const subs = [...new Set(items.map((p) => p.sub).filter(Boolean))]
        return (
          <div key={g} className="mb-2">
            <Toggle open={gOpen} onClick={() => toggle(g, true)} className="h-9 px-2.5 font-medium text-fg">{g}</Toggle>
            {gOpen && (
              <ul className="mt-0.5 space-y-px">
                {items.filter((p) => !p.sub).map((p) => <li key={p.slug}><NavLink page={p} active={p.slug === slug} indent="pl-[22px]" /></li>)}
                {subs.map((s) => {
                  const children = items.filter((p) => p.sub === s)
                  const sOpen = isOpen(g + '/' + s, children.some((p) => p.slug === slug))
                  return (
                    <li key={s}>
                      <Toggle open={sOpen} onClick={() => toggle(g + '/' + s, children.some((p) => p.slug === slug))} className="py-2 pl-[22px] pr-2.5 leading-5 text-fg2 hover:text-fg">{s}</Toggle>
                      {sOpen && (
                        <ul className="space-y-px">
                          {children.map((p) => <li key={p.slug}><NavLink page={p} active={p.slug === slug} indent="pl-[38px]" /></li>)}
                        </ul>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )
      })}
    </nav>
  )
}

/* ---------- right "on this page" ---------- */

function useHeadings(slug, section) {
  const [heads, setHeads] = useState([])
  const [active, setActive] = useState(null)
  useEffect(() => {
    const els = [...document.querySelectorAll('#doc-content > h2, #doc-content > h3')]
    const seen = {}
    const list = els.map((el) => {
      let id = slugify(el.textContent)
      seen[id] = (seen[id] || 0) + 1
      if (seen[id] > 1) id += '-' + seen[id]
      el.id = id
      return { id, text: el.textContent, level: el.tagName === 'H3' ? 3 : 2, el }
    })
    setHeads(list)
    setActive(list[0]?.id ?? null)
    if (!list.length) return
    // Active = last heading that has crossed the line just under the sticky header.
    const pick = () => {
      let cur = list[0].id
      for (const h of list) if (h.el.getBoundingClientRect().top < 120) cur = h.id
      if (innerHeight + scrollY >= document.documentElement.scrollHeight - 2) cur = list[list.length - 1].id
      setActive(cur)
    }
    const io = new IntersectionObserver(pick, { rootMargin: '-64px 0px -60% 0px', threshold: [0, 1] })
    list.forEach((h) => io.observe(h.el))
    addEventListener('scroll', pick, { passive: true })
    pick()
    return () => { io.disconnect(); removeEventListener('scroll', pick) }
  }, [slug])
  // Runs after the ids above are assigned (effects run in order), also for same-page jumps from search.
  useEffect(() => { if (section) document.getElementById(section)?.scrollIntoView() }, [slug, section])
  return [heads, active, setActive]
}

function TocList({ heads, active, onJump }) {
  return (
    <ul className="text-sm">
      {heads.map((h) => (
        <li key={h.id}>
          <a href={h.href} onClick={(e) => onJump(e, h.id)} aria-current={h.id === active ? 'location' : undefined}
            className={'-ml-px block border-l py-1.5 leading-5 ' + (h.level === 3 ? 'pl-[26px] ' : 'pl-3.5 ') +
              (h.id === active ? 'border-fg text-fg' : 'border-line text-fg2 hover:text-fg')}>
            {h.text}
          </a>
        </li>
      ))}
    </ul>
  )
}

/* ---------- search (Ctrl/⌘ K) ---------- */

const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export function search(index, q) {
  const words = norm(q).split(/\s+/).filter(Boolean)
  if (!words.length) return []
  return index
    .map((r) => {
      const title = norm(r.page + ' ' + (r.heading || '')), body = norm(r.text)
      if (!words.every((w) => title.includes(w) || body.includes(w))) return null
      const score = words.reduce((n, w) => n + (title.includes(w) ? 10 : 0) + (body.includes(w) ? 1 : 0), 0) + (r.heading ? 0 : 2)
      const at = body.indexOf(words[0])
      const snippet = at < 0 ? r.text.slice(0, 110) : (at > 40 ? '…' : '') + r.text.slice(Math.max(0, at - 40), at + 90) + '…'
      return { ...r, score, snippet }
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .slice(0, 12)
}

export function SearchDialog({ open, onClose }) {
  const ref = useRef(null)
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(0)
  const [index, setIndex] = useState(null)
  // react-dom/server is only needed to index the pages: load it on first open, not with the page.
  useEffect(() => { if (open && !index) import('./searchIndex.jsx').then((m) => setIndex(m.buildIndex())) }, [open, index])
  const results = useMemo(() => (index ? search(index, q) : []), [index, q])
  useEffect(() => {
    const d = ref.current
    if (open && !d.open) { d.showModal(); setQ(''); setSel(0) }
    if (!open && d.open) d.close()
  }, [open])
  const go = (r) => { location.hash = href(r.slug, r.section); onClose() }
  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(s + 1, results.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)) }
    if (e.key === 'Enter' && results[sel]) go(results[sel])
  }
  return (
    <dialog ref={ref} onClose={onClose} onClick={(e) => e.target === ref.current && onClose()} aria-label="Buscar en la documentación"
      className="m-auto mt-[10vh] w-[min(640px,calc(100vw-32px))] overflow-hidden rounded-xl border border-line bg-surface p-0 text-fg shadow-2xl">
      <div className="flex h-12 items-center gap-2.5 border-b border-line px-4">
        <Icon d={I.search} className="size-4 text-fg3" />
        <input autoFocus value={q} onChange={(e) => { setQ(e.target.value); setSel(0) }} onKeyDown={onKey}
          placeholder="Buscar en la documentación…" aria-label="Buscar" aria-controls="search-results"
          aria-activedescendant={results[sel] ? 'sr-' + sel : undefined}
          className="h-full flex-1 bg-transparent text-[15px] outline-none placeholder:text-fg3" />
        <kbd className="rounded border border-line px-1.5 font-mono text-[11px] text-fg3">Esc</kbd>
      </div>
      <ul id="search-results" role="listbox" className="max-h-[60vh] overflow-y-auto p-2">
        {q && !results.length && <li className="px-3 py-6 text-center text-sm text-fg2">Sin resultados para «{q}»</li>}
        {!q && <li className="px-3 py-6 text-center text-sm text-fg2">Busca instalación, ticket, timeout, benchmarks…</li>}
        {results.map((r, i) => (
          <li key={r.slug + r.section} id={'sr-' + i} role="option" aria-selected={i === sel}
            onMouseEnter={() => setSel(i)} onClick={() => go(r)}
            className={'cursor-pointer rounded-lg px-3 py-2.5 ' + (i === sel ? 'bg-hover' : '')}>
            <div className="flex items-center gap-2 text-sm font-medium text-fg">
              <Icon d={r.heading ? I.hash : I.file} className="size-3.5 shrink-0 text-fg3" />
              {r.page}{r.heading && <span className="font-normal text-fg2">› {r.heading}</span>}
            </div>
            <p className="mt-0.5 line-clamp-2 pl-5.5 text-[13px] leading-5 text-fg2">{r.snippet}</p>
          </li>
        ))}
      </ul>
    </dialog>
  )
}

/* ---------- page ---------- */

export function DocsPage({ slug, section, focusTitle }) {
  const i = Math.max(0, PAGES.findIndex((p) => p.slug === slug))
  const page = PAGES[i], prev = PAGES[i - 1], next = PAGES[i + 1]
  const [heads, active, setActive] = useHeadings(page.slug, section)
  const [menu, setMenu] = useState(false)
  const [copied, setCopied] = useState(false)
  const drawer = useRef(null)
  const h1 = useRef(null)

  useEffect(() => {
    document.title = `${page.title} · Angelito PDF`
    if (focusTitle && !section) h1.current?.focus({ preventScroll: true }) // announce the new page to screen readers
  }, [page]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const d = drawer.current
    if (menu && !d.open) d.showModal()
    if (!menu && d.open) d.close()
  }, [menu])
  useEffect(() => setMenu(false), [slug])

  const toc = heads.map((h) => ({ ...h, href: href(page.slug, h.id) }))
  const jump = (e, id) => {
    e.preventDefault()
    document.getElementById(id)?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
    history.replaceState(null, '', href(page.slug, id))
    setActive(id)
  }
  const copyPage = () => {
    const text = '# ' + page.title + '\n\n' + document.getElementById('doc-content').innerText
    navigator.clipboard?.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) })
  }

  return (
    <>
      {/* mobile / tablet: menu bar under the header */}
      <div className="sticky top-16 z-30 flex h-[53px] items-center border-b border-line bg-bg px-4 sm:px-6 lg:hidden">
        <button onClick={() => setMenu(true)} aria-haspopup="dialog" className="-ml-2 flex h-9 items-center gap-2.5 rounded-md px-2 text-[15px] text-fg hover:bg-hover">
          <Icon d={I.menu} className="size-[18px]" /> Menú
        </button>
        <span className="ml-auto truncate pl-3 text-sm text-fg2">{page.sub || page.group}</span>
      </div>
      <dialog ref={drawer} onClose={() => setMenu(false)} onClick={(e) => e.target === drawer.current && setMenu(false)} aria-label="Navegación de la documentación"
        className="m-0 h-dvh max-h-none w-[min(320px,85vw)] border-r border-line bg-bg p-0 text-fg">
        <div className="flex h-16 items-center justify-between border-b border-line px-4">
          <span className="text-sm font-medium">Documentación</span>
          <button onClick={() => setMenu(false)} aria-label="Cerrar menú" className="grid size-9 place-items-center rounded-md hover:bg-hover"><Icon d={I.close} /></button>
        </div>
        <div className="h-[calc(100dvh-4rem)] overflow-y-auto px-3 py-5"><Sidebar slug={page.slug} /></div>
      </dialog>

      <div className="mx-auto max-w-[1448px] lg:grid lg:grid-cols-[264px_minmax(0,1fr)] lg:pl-3 lg:pr-4 xl:grid-cols-[264px_minmax(0,1fr)_250px]">
        <aside className="sticky top-16 hidden h-[calc(100dvh-4rem)] overflow-y-auto overscroll-contain pb-10 pt-[58px] lg:block">
          <Sidebar slug={page.slug} />
        </aside>

        <main id="contenido" tabIndex={-1} className="min-w-0 outline-none px-4 pb-24 pt-10 sm:px-6 lg:pl-[82px] lg:pr-0 lg:pt-14 xl:pr-[100px]">
          <div className="mx-auto max-w-[716px] lg:mx-0">
            <div className="flex items-start justify-between gap-4">
              <h1 ref={h1} tabIndex={-1} className="text-[32px] font-[450] leading-10 tracking-[-1.5px] text-fg outline-none sm:text-[40px] sm:leading-12 sm:tracking-[-2px]">{page.title}</h1>
              <button onClick={copyPage} className="mt-1.5 inline-flex h-8 shrink-0 items-center gap-2 rounded-md border border-line bg-surface px-2.5 text-sm font-medium text-fg hover:bg-hover">
                <Icon d={copied ? I.check : I.copy} /><span className="hidden sm:inline">{copied ? 'Copiado' : 'Copiar página'}</span>
              </button>
            </div>

            {toc.length > 1 && (
              <details className="mt-6 rounded-lg border border-line xl:hidden">
                <summary className="cursor-pointer px-4 py-2.5 text-sm font-medium">En esta página</summary>
                <div className="px-4 pb-3"><TocList heads={toc} active={active} onJump={jump} /></div>
              </details>
            )}

            <article id="doc-content" className="prose mt-12">
              <page.body />
            </article>

            <nav aria-label="Paginación" className="mt-16 grid grid-cols-2 gap-4 border-t border-line pt-8">
              {prev ? (
                <a href={href(prev.slug)} className="flex flex-col rounded-lg py-1 text-sm hover:text-fg">
                  <span className="text-fg3">Anterior</span><span className="font-medium text-fg">{prev.title}</span>
                </a>
              ) : <span />}
              {next && (
                <a href={href(next.slug)} className="col-start-2 flex flex-col rounded-lg py-1 text-right text-sm">
                  <span className="text-fg3">Siguiente</span><span className="font-medium text-fg">{next.title}</span>
                </a>
              )}
            </nav>
          </div>
        </main>

        <aside className="sticky top-16 hidden h-[calc(100dvh-4rem)] overflow-y-auto pb-10 pt-14 xl:block" aria-label="En esta página">
          {toc.length > 0 && (
            <>
              <p className="mb-5 text-sm font-medium leading-5 text-fg">En esta página</p>
              <TocList heads={toc} active={active} onJump={jump} />
            </>
          )}
          <div className={'space-y-1 text-sm ' + (toc.length ? 'mt-7 border-t border-line pt-5' : '')}>
            <a href={GITHUB + '/issues/new'} target="_blank" rel="noreferrer" className="flex h-9 items-center gap-2.5 text-fg2 hover:text-fg"><Icon d={I.bug} /> Reportar un problema</a>
            <a href={GITHUB + '/blob/main/website/src/docs.jsx'} target="_blank" rel="noreferrer" className="flex h-9 items-center gap-2.5 text-fg2 hover:text-fg"><Icon d={I.edit} /> Editar esta página en GitHub</a>
          </div>
        </aside>
      </div>
    </>
  )
}
