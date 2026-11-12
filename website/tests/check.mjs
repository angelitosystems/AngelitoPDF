// Layout-fidelity + functional checks. Run: npm test  (builds, serves dist/, drives the installed Chrome).
// Optional: SHOTS=<dir> saves screenshots.
import { preview } from 'vite'
import { chromium } from 'playwright-core'
import assert from 'node:assert/strict'

// Measured on https://nextjs.org/docs with Playwright on 2026-11-11 (getBoundingClientRect / computed style).
const REF = {
  1440: { header: 64, aside: [12, 264], content: [358, 716], toc: [1174, 250], h1: { y: 120, size: 40, weight: 450 } },
  1705: { header: 64, aside: [141, 264], content: [491, 716], toc: [1311, 250], h1: { y: 120, size: 40, weight: 450 } },
}
const TOL = 4 // px
const near = (got, want, what) => assert.ok(Math.abs(got - want) <= TOL, `${what}: ${got} vs ref ${want}`)

const server = await preview({ preview: { port: 4180, strictPort: true }, logLevel: 'silent' })
const base = 'http://localhost:4180/'
const browser = await chromium.launch({ channel: 'chrome' })
const errors = []
let passed = 0
const ok = (name) => { passed++; console.log('  ✓', name) }

async function page(w, h, hash = '') {
  const p = await browser.newPage({ viewport: { width: w, height: h } })
  p.on('pageerror', (e) => errors.push(`${w} ${hash}: ${e.message}`))
  p.on('console', (m) => m.type() === 'error' && errors.push(`${w} ${hash}: ${m.text()}`))
  await p.goto(base + hash)
  await p.waitForSelector('h1')
  await p.evaluate(() => document.fonts.ready)
  return p
}
const box = (p, sel) => p.locator(sel).first().evaluate((e) => { const r = e.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } })
const shot = (p, name) => process.env.SHOTS && p.screenshot({ path: `${process.env.SHOTS}/${name}.png` })

try {
  for (const [w, h] of [[1705, 895], [1440, 900]]) {
    console.log(`layout ${w}×${h}`)
    const r = REF[w], p = await page(w, h, '#/docs/introduccion')
    near((await box(p, 'header')).h, r.header, 'header height')
    const aside = await box(p, 'aside:has(nav[aria-label="Documentación"])')
    near(aside.x, r.aside[0], 'sidebar x'); near(aside.w, r.aside[1], 'sidebar width')
    const content = await box(p, '#doc-content')
    near(content.x, r.content[0], 'content x'); near(content.w, r.content[1], 'content width')
    const toc = await box(p, 'aside[aria-label="En esta página"]')
    near(toc.x, r.toc[0], 'toc x'); near(toc.w, r.toc[1], 'toc width')
    const h1 = await p.locator('h1').evaluate((e) => ({ y: e.getBoundingClientRect().y, size: parseFloat(getComputedStyle(e).fontSize), weight: +getComputedStyle(e).fontWeight }))
    near(h1.y, r.h1.y, 'h1 y'); assert.equal(h1.size, r.h1.size); assert.equal(h1.weight, r.h1.weight)
    const h2 = await p.locator('#doc-content > h2').first().evaluate((e) => [getComputedStyle(e).fontSize, getComputedStyle(e).lineHeight])
    assert.deepEqual(h2, ['24px', '32px'])
    const para = await p.locator('#doc-content > p').first().evaluate((e) => [getComputedStyle(e).fontSize, getComputedStyle(e).lineHeight])
    assert.deepEqual(para, ['16px', '28px'])
    ok('header, 3 columns, h1/h2/p match reference within ' + TOL + 'px')
    await shot(p, `docs-${w}`)
    await p.close()
  }

  console.log('functional 1440×900')
  {
    const p = await page(1440, 900, '#/docs/benchmarks')
    // TOC detects headings, click scrolls smoothly and marks active; scrolling updates it.
    const links = p.locator('aside[aria-label="En esta página"] a[href*="/benchmarks/"]')
    assert.ok((await links.count()) >= 2, 'toc has headings')
    await links.nth(1).click()
    await p.waitForFunction(() => document.querySelector('aside[aria-label="En esta página"] [aria-current="location"]')?.textContent === 'Lee esto antes de citar cifras')
    assert.ok(p.url().endsWith('#/docs/benchmarks/lee-esto-antes-de-citar-cifras'))
    await p.evaluate(() => window.scrollTo(0, 0)) // not mouse.wheel: the pointer still sits over the (scrollable) TOC after the click
    await p.waitForFunction(() => document.querySelector('aside[aria-label="En esta página"] [aria-current="location"]')?.textContent === 'Todos los datos')
    ok('TOC: click → smooth scroll + active; scroll → active follows')

    // Deep link opens the section.
    await p.goto(base + '#/docs/errores/limites-por-defecto'); await p.reload()
    await p.waitForFunction(() => {
      const e = document.getElementById('limites-por-defecto'); if (!e || scrollY === 0) return false
      const top = e.getBoundingClientRect().top, atEnd = innerHeight + scrollY >= document.documentElement.scrollHeight - 2
      return Math.abs(top - 88) < 30 || (atEnd && top > 64 && top < innerHeight) // short page: scrolled as far as it goes
    })
    ok('deep link to a section scrolls to it')

    // Sidebar: collapse a group, state survives reload; nested "Ejemplos" expands.
    const g = p.locator('aside nav[aria-label="Documentación"] button', { hasText: 'Referencia' })
    await g.click()
    assert.equal(await g.getAttribute('aria-expanded'), 'false')
    assert.equal(await p.locator('aside nav[aria-label="Documentación"] a', { hasText: 'Opciones' }).count(), 0)
    await p.reload(); await p.waitForSelector('h1')
    assert.equal(await p.locator('aside nav[aria-label="Documentación"] button', { hasText: 'Referencia' }).getAttribute('aria-expanded'), 'false')
    await p.locator('aside nav[aria-label="Documentación"] button', { hasText: 'Referencia' }).click()
    const ej = p.locator('aside nav[aria-label="Documentación"] button', { hasText: 'Ejemplos' })
    if ((await ej.getAttribute('aria-expanded')) === 'false') await ej.click()
    await p.locator('aside nav[aria-label="Documentación"] a', { hasText: 'Ticket térmico' }).click()
    await p.waitForFunction(() => document.querySelector('h1').textContent.startsWith('Ticket térmico'))
    assert.equal(await p.locator('aside a[aria-current="page"]').textContent(), 'Ticket térmico 58/80 mm')
    ok('sidebar: collapse persists across reload, nested group, active link')

    // Search: Ctrl+K, type, arrow + Enter navigates to the section.
    await p.keyboard.press('Control+k')
    const input = p.getByRole('dialog', { name: 'Buscar en la documentación' }).locator('input')
    await input.waitFor()
    await input.fill('timeout')
    await p.waitForSelector('#search-results [role=option]')
    const first = await p.locator('#search-results [role=option]').first().textContent()
    assert.match(first, /Errores|API|Configuración|Seguridad/)
    await input.press('Enter')
    await p.waitForFunction(() => !document.querySelector('dialog[open][aria-label="Buscar en la documentación"]'))
    assert.match(p.url(), /#\/docs\/(errores|laravel|configuracion|seguridad)/)
    await p.keyboard.press('Control+k'); await input.fill('zzzzqqq')
    await p.waitForSelector('text=Sin resultados')
    await p.keyboard.press('Escape')
    ok('search: Ctrl+K, results, Enter navigates, empty state, Esc closes')

    // Theme toggle sets data-theme and persists.
    await p.getByRole('radio', { name: 'Oscuro' }).click()
    assert.equal(await p.evaluate(() => document.documentElement.dataset.theme), 'dark')
    await p.reload(); await p.waitForSelector('h1')
    assert.equal(await p.evaluate(() => document.documentElement.dataset.theme), 'dark')
    await shot(p, 'docs-1440-dark')
    await p.getByRole('radio', { name: 'Sistema' }).click()
    assert.equal(await p.evaluate(() => document.documentElement.dataset.theme), undefined)
    ok('theme: dark persists, system clears it')

    // Keyboard: Tab reaches skip link first.
    await p.goto(base + '#/docs/cli'); await p.reload(); await p.waitForSelector('h1')
    await p.keyboard.press('Tab')
    assert.equal(await p.evaluate(() => document.activeElement.textContent), 'Saltar al contenido')
    ok('keyboard: skip link is the first tab stop')
    await p.close()
  }

  console.log('mobile 390×844')
  {
    const p = await page(390, 844, '#/docs/instalacion')
    assert.equal(await p.locator('aside nav[aria-label="Documentación"]').isVisible(), false)
    await p.getByRole('button', { name: 'Menú' }).click()
    const drawer = p.getByRole('dialog', { name: 'Navegación de la documentación' })
    await drawer.waitFor()
    await shot(p, 'mobile-menu')
    await drawer.locator('a', { hasText: 'Opciones' }).click()
    await p.waitForFunction(() => document.querySelector('h1').textContent === 'Opciones' && !document.querySelector('dialog[open]'))
    ok('mobile: menu panel opens, navigates and closes')
    const h1 = await box(p, 'h1')
    near(h1.x, 16, 'mobile h1 x')
    ok('mobile: content gutter 16px')
    await p.close()
  }

  console.log('every route: no horizontal overflow, no console errors')
  const slugs = await (async () => { // every page listed in the (fully expanded) sidebar
    const p = await page(1440, 900, '#/docs/ejemplo-ticket')
    const s = await p.$$eval('aside nav[aria-label="Documentación"] a', (as) => as.map((a) => a.getAttribute('href').split('/')[2]))
    await p.close(); return s
  })()
  assert.equal(slugs.length, 17, 'sidebar lists all 17 pages')
  for (const [w, h] of [[390, 844], [1440, 900]]) {
    const p = await page(w, h, '')
    for (const hash of ['#/', ...slugs.map((s) => '#/docs/' + s)]) {
      await p.goto(base + hash); await p.waitForSelector('h1')
      const over = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth)
      assert.ok(over <= 0, `${w} ${hash}: horizontal overflow ${over}px`)
    }
    if (w === 390) { await p.goto(base + '#/'); await p.waitForSelector('h1'); await shot(p, 'landing-390') }
    await p.close()
  }
  ok(`${slugs.length + 1} routes × 2 widths without overflow`)
  for (const [w, h] of [[1705, 895], [1440, 900]]) { const p = await page(w, h, '#/'); await shot(p, `landing-${w}`); await p.close() }
  assert.deepEqual(errors, [], 'console/page errors')
  ok('no console or page errors')
  console.log(`\n${passed} checks passed`)
} finally {
  await browser.close()
  server.httpServer.close()
}
