import Fuse from 'fuse.js'
import type { Doc, SearchResult } from './types'

// Build index by fetching a manifest.json and then fetching each .txt file.
export async function buildIndex(manifestUrl: string, baseUrl: string, opts?: {
  concurrency?: number,
  onProgress?: (done: number, total: number) => void
}) : Promise<{ search: (q: string, max?: number)=> Promise<SearchResult[]> }> {
  if (!manifestUrl || !baseUrl) throw new Error('Please set manifestUrl and baseUrl')
  const concurrency = opts?.concurrency ?? 8
  const onProgress = opts?.onProgress

  const resp = await fetch(manifestUrl)
  if (!resp.ok) throw new Error('Failed to fetch manifest: ' + resp.status)
  const manifest: string[] = await resp.json()
  const total = manifest.length
  const docs: Doc[] = []
  let done = 0

  // helper to fetch with error handling
  async function fetchText(filename: string) {
    const url = baseUrl + encodeURIComponent(filename)
    try {
      const r = await fetch(url)
      if (!r.ok) {
        // try unencoded fallback
        const r2 = await fetch(baseUrl + filename)
        if (!r2.ok) throw new Error('fetch failed for ' + filename + ' : ' + r2.status)
        return await r2.text()
      }
      return await r.text()
    } catch (e) {
      console.warn('Could not fetch', filename, e)
      return ''
    }
  }

  // concurrency pool
  const q = manifest.slice()
  async function worker() {
    while (q.length) {
      const filename = q.shift()!
      const content = await fetchText(filename)
      docs.push({
        id: filename,
        title: filename.replace(/\.txt$/i, ''),
        content
      })
      done++
      onProgress?.(done, total)
    }
  }

  const workers = Array.from({length: Math.min(concurrency, manifest.length)}, () => worker())
  await Promise.all(workers)

  // Build Fuse index
  const fuse = new Fuse(docs, {
    keys: [
      {name: 'title', weight: 0.7},
      {name: 'content', weight: 0.3}
    ],
    includeScore: true,
    useExtendedSearch: true,
    threshold: 0.35,
    ignoreLocation: true,
    minMatchCharLength: 2
  })

  function excerptFor(content: string, idx: number, len=200) {
    const start = Math.max(0, idx - Math.floor(len/2))
    const snippet = content.slice(start, Math.min(content.length, start + len))
    return (start>0 ? '…' : '') + snippet + (start + len < content.length ? '…' : '')
  }

  async function search(q: string, max = 20) : Promise<SearchResult[]> {
    q = q.trim()
    if (!q) return []
    const lower = q.toLowerCase()

    const hits: SearchResult[] = []

    for (const d of docs) {
      let score = 1000
      let matches = 0
      const titleLower = d.title.toLowerCase()
      const contentLower = d.content.toLowerCase()
      // exact phrase in title -> best
      if (titleLower.includes(lower)) {
        score = 0
        matches += 1
        const idx = titleLower.indexOf(lower)
        hits.push({
          id: d.id,
          title: d.title,
          excerpt: d.title,
          score,
          matches
        })
        continue
      }
      // exact phrase in content
      const idx = contentLower.indexOf(lower)
      if (idx !== -1) {
        score = 10
        matches = (contentLower.match(new RegExp(lower.replace(/[.*+?^${}()|[\]\\]/g,''), 'g')) || []).length
        hits.push({
          id: d.id,
          title: d.title,
          excerpt: excerptFor(d.content, idx),
          score,
          matches
        })
        continue
      }
    }

    // Fuzzy search via Fuse for remaining docs
    const fuseResults = fuse.search(q, {limit: max * 2})
    for (const fr of fuseResults) {
      const d = fr.item as Doc
      // skip if already included
      if (hits.find(h => h.id === d.id)) continue
      const score = Math.round((fr.score ?? 1) * 100) + 50
      // find best match position in content for snippet
      const pos = d.content.toLowerCase().indexOf(q.toLowerCase())
      const excerpt = pos !== -1 ? excerptFor(d.content, pos) : d.content.slice(0, 200) + (d.content.length>200 ? '…' : '')
      hits.push({
        id: d.id,
        title: d.title,
        excerpt,
        score,
        matches: 0
      })
    }

    // sort by score asc, then matches desc, then title
    hits.sort((a,b) => {
      if (a.score !== b.score) return a.score - b.score
      if (b.matches !== a.matches) return b.matches - a.matches
      return a.title.localeCompare(b.title)
    })

    return hits.slice(0, max)
  }

  return { search }
}
