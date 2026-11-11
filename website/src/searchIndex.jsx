import { renderToStaticMarkup } from 'react-dom/server'
import { PAGES } from './docs.jsx'
import { slugify } from './DocsLayout.jsx'

/** One entry per page section (text before the first h2, then each h2/h3), ids matching the TOC's. */
export function buildIndex() {
  const doc = new DOMParser()
  return PAGES.flatMap((p) => {
    const root = doc.parseFromString('<div>' + renderToStaticMarkup(<p.body />) + '</div>', 'text/html').body.firstChild
    const sections = [{ heading: null, text: '' }]
    for (const el of root.children) {
      if (el.tagName === 'H2' || el.tagName === 'H3') sections.push({ heading: el.textContent, text: '' })
      else sections[sections.length - 1].text += ' ' + el.textContent
    }
    return sections.map((s) => ({
      slug: p.slug, page: p.title, group: p.sub ? p.group + ' › ' + p.sub : p.group,
      heading: s.heading, text: s.text.replace(/\s+/g, ' ').trim(),
      section: s.heading ? slugify(s.heading) : null,
    }))
  })
}

