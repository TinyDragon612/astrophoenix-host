export type Doc = {
  id: string
  title: string
  content: string
  url: string
}

export type SearchResult = {
  id: string
  title: string
  excerpt: string
  score: number
  matches: number
  content: string
  url: string
}
