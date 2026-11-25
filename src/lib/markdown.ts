// Convierte el Markdown de los artículos del blog en HTML seguro. Solo
// soporta lo que usan los artículos: títulos (##, ###), párrafos, listas,
// citas, **negritas**, *cursivas* y [links](url). Todo el texto se escapa,
// así que nunca se cuela HTML ni scripts.

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function safeHref(url: string) {
  const u = url.trim()
  if (u.startsWith('/') && !u.startsWith('//')) return u
  if (/^https:\/\//i.test(u)) return u
  return null
}

function inline(text: string) {
  let out = escapeHtml(text)
  // Links: [texto](url)
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label: string, url: string) => {
    const href = safeHref(url.replace(/&amp;/g, '&'))
    if (!href) return label
    const external = href.startsWith('http')
    return `<a href="${escapeHtml(href)}"${external ? ' target="_blank" rel="noopener noreferrer"' : ''}>${label}</a>`
  })
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  out = out.replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
  return out
}

export function renderMarkdown(md: string): string {
  const lines = md.replace(/\r\n/g, '\n').split('\n')
  const html: string[] = []
  let para: string[] = []
  let list: { type: 'ul' | 'ol'; items: string[] } | null = null

  const flushPara = () => {
    if (para.length) html.push(`<p>${inline(para.join(' '))}</p>`)
    para = []
  }
  const flushList = () => {
    if (list) html.push(`<${list.type}>${list.items.map((i) => `<li>${inline(i)}</li>`).join('')}</${list.type}>`)
    list = null
  }

  for (const raw of lines) {
    const line = raw.trim()
    if (!line) {
      flushPara()
      flushList()
      continue
    }
    const h = /^(#{2,4})\s+(.*)$/.exec(line)
    if (h) {
      flushPara()
      flushList()
      const level = h[1].length
      html.push(`<h${level}>${inline(h[2])}</h${level}>`)
      continue
    }
    if (/^#\s+/.test(line)) {
      // El título principal ya va arriba como <h1>; un "# " en el cuerpo se
      // trata como subtítulo para no tener dos <h1>.
      flushPara()
      flushList()
      html.push(`<h2>${inline(line.replace(/^#\s+/, ''))}</h2>`)
      continue
    }
    const ul = /^[-*]\s+(.*)$/.exec(line)
    const ol = /^\d+[.)]\s+(.*)$/.exec(line)
    if (ul || ol) {
      flushPara()
      const type = ul ? 'ul' : 'ol'
      if (!list || list.type !== type) {
        flushList()
        list = { type, items: [] }
      }
      list.items.push((ul ?? ol)![1])
      continue
    }
    if (line.startsWith('>')) {
      flushPara()
      flushList()
      html.push(`<blockquote>${inline(line.replace(/^>\s?/, ''))}</blockquote>`)
      continue
    }
    flushList()
    para.push(line)
  }
  flushPara()
  flushList()
  return html.join('\n')
}

// Tiempo de lectura aproximado (200 palabras por minuto).
export function readingMinutes(md: string) {
  const words = md.split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.round(words / 200))
}
