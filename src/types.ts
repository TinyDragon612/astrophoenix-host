export type Doc = {
  id: string
  title: string
  content: string
}

export type SearchResult = {
  id: string
  title: string
  excerpt: string
  score: number
  matches: number
  content: string
}
