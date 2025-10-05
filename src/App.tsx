import React, { useEffect, useRef, useState } from "react";
import { MANIFEST_URL, BASE_URL } from "./config";
import type { Doc, SearchResult } from "./types";
import Fuse from "fuse.js";
import AI from "./call_gpt";

import { initializeApp } from 'firebase/app';

/**
 * App.tsx - Incremental indexing, faster search, pagination, highlighting.
 *
 * Strategy:
 * - Fetch manifest, then fetch files in parallel with limited concurrency.
 * - As each doc downloads:
 *    - Add to `docs` map
 *    - Add to `invertedIndex` for token -> Set<docId>
 *    - Add to global Fuse instance via `fuse.add(doc)`
 *    - Mark progress; UI displays "searchable as indexing proceeds"
 * - Search flow:
 *    1) Normalize query.
 *    2) If exact phrase (quote-wrapped or multi-word) present in title/content -> return prioritized results.
 *    3) Build candidate set from inverted index (intersection of token doc sets). If candidate set size is small (< CANDIDATE_THRESHOLD),
 *       run Fuse on candidate docs only (fast).
 *    4) Otherwise, run Fuse on the global index (already incremental).
 * - Pagination done on final results array.
 * - Highlighting: we highlight phrase matches first, then individual tokens. We produce safe HTML snippets using `escapeHtml`.
 */

/* Small helpers */
function escapeRegex(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function escapeHtml(str: string) {
  return str.replace(/[&<>"]/g, (c) => {
    switch (c) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return c;
    }
  });
}
function tokenize(text: string) {
  // Basic tokenization: split on non-word characters, remove empties
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter(Boolean);
}

const CANDIDATE_THRESHOLD = 600; // if candidate set smaller than this, search only them with Fuse for speed
const DEFAULT_PAGE_SIZE = 10;

export default function App() {
  const [status, setStatus] = useState<"idle" | "indexing" | "ready" | "error">("idle");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const docsRef = useRef<Map<string, Doc>>(new Map());
  const invertedRef = useRef<Map<string, Set<string>>>(new Map());
  const fuseRef = useRef<Fuse<Doc> | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);

  useEffect(() => {
    if (!MANIFEST_URL || !BASE_URL) {
      setError("Please set MANIFEST_URL and BASE_URL in src/config.ts");
      setStatus("error");
      return;
    }

    // initialize fuse with empty collection; we'll add docs incrementally.
    fuseRef.current = new Fuse([], {
      keys: [
        { name: "title", weight: 0.7 },
        { name: "content", weight: 0.3 },
      ],
      includeScore: true,
      useExtendedSearch: true,
      threshold: 0.35,
      ignoreLocation: true,
      minMatchCharLength: 2,
    });

    async function fetchManifestAndIndex() {
      setStatus("indexing");
      try {
        const resp = await fetch(MANIFEST_URL);
        if (!resp.ok) throw new Error("Failed to fetch manifest: " + resp.status);
        const manifest: string[] = await resp.json();
        setProgress({ done: 0, total: manifest.length });

        // concurrency-limited fetch
        const concurrency = Math.min(8, Math.max(2, Math.floor(navigator.hardwareConcurrency || 4)));
        const queue = manifest.slice();
        let active = 0;
        let done = 0;

        function next(): Promise<void> {
          return new Promise(async (resolve) => {
            if (queue.length === 0) return resolve();
            const filename = queue.shift()!;
            active++;
            try {
              // attempt encoded filename, fallback to raw
              const encoded = encodeURIComponent(filename);
              let r = await fetch(BASE_URL + encoded);
              if (!r.ok) {
                r = await fetch(BASE_URL + filename);
                if (!r.ok) {
                  console.warn("Failed to fetch", filename, r.status);
                  // still push empty doc so counts match
                  indexDoc({ id: filename, title: filename.replace(/\.txt$/i, ""), content: "" });
                } else {
                  const text = await r.text();
                  indexDoc({ id: filename, title: filename.replace(/\.txt$/i, ""), content: text });
                }
              } else {
                const text = await r.text();
                indexDoc({ id: filename, title: filename.replace(/\.txt$/i, ""), content: text });
              }
            } catch (err) {
              console.warn("Error fetching", filename, err);
              indexDoc({ id: filename, title: filename.replace(/\.txt$/i, ""), content: "" });
            } finally {
              done++;
              active--;
              setProgress({ done, total: manifest.length });
              // schedule next in queue
              if (queue.length) {
                // small microtask delay to keep UI responsive
                setTimeout(() => next().then(() => resolve()), 0);
              } else {
                resolve();
              }
            }
          });
        }

        // indexDoc: add to docs map, inverted index, and Fuse
        function indexDoc(d: Doc) {
          docsRef.current.set(d.id, d);
          // inverted index: tokens from title + content (but content may be large; we only index tokens)
          const tokens = new Set<string>([...tokenize(d.title), ...tokenize(d.content)]);
          tokens.forEach((t) => {
            let s = invertedRef.current.get(t);
            if (!s) {
              s = new Set<string>();
              invertedRef.current.set(t, s);
            }
            s.add(d.id);
          });
          // add to Fuse incremental index
          try {
            fuseRef.current?.add(d);
          } catch (e) {
            // some Fuse versions may not have add; in that case we recreate
            if (fuseRef.current) {
              const currentDocs = Array.from(docsRef.current.values());
              fuseRef.current = new Fuse(currentDocs, {
                keys: [
                  { name: "title", weight: 0.7 },
                  { name: "content", weight: 0.3 },
                ],
                includeScore: true,
                useExtendedSearch: true,
                threshold: 0.35,
                ignoreLocation: true,
                minMatchCharLength: 2,
              });
            }
          }
        }

        // start workers
        const starters: Promise<void>[] = [];
        for (let i = 0; i < concurrency; i++) {
          starters.push(next());
        }
        await Promise.all(starters);

        // after all downloaded
        setStatus("ready");
      } catch (e: any) {
        setError(String(e.message || e));
        setStatus("error");
      }
    }

    fetchManifestAndIndex();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reset page when results change
  useEffect(() => {
    setPage(1);
  }, [pageSize, query]);

  // search function using hybrid approach
  async function doSearch(q: string) {

    q = q.trim();
    setQuery(q);
    setResults([]);
    if (!q) return;

    // immediate exact-phrase detection: treat quoted query as phrase, otherwise also check the raw phrase
    const isQuoted = /^".+"$/.test(q);
    const phrase = isQuoted ? q.slice(1, -1).toLowerCase() : q.toLowerCase();

    const allDocs = docsRef.current;
    const inverted = invertedRef.current;
    const fuse = fuseRef.current;

    const hitsMap = new Map<string, SearchResult>();

    // 1) exact phrase in title
    for (const [id, d] of allDocs) {
      const titleLower = d.title.toLowerCase();
      if (titleLower.includes(phrase)) {
        hitsMap.set(id, {
          id,
          title: d.title,
          excerpt: d.title,
          score: 0,
          matches: (titleLower.match(new RegExp(escapeRegex(phrase), "g")) || []).length,
        });
      }
    }

    // 2) exact phrase in content (fast indexOf)
    for (const [id, d] of allDocs) {
      if (hitsMap.has(id)) continue;
      const contentLower = d.content.toLowerCase();
      const idx = contentLower.indexOf(phrase);
      if (idx !== -1) {
        hitsMap.set(id, {
          id,
          title: d.title,
          excerpt: makeExcerpt(d.content, idx, phrase.length),
          score: 10,
          matches: (contentLower.match(new RegExp(escapeRegex(phrase), "g")) || []).length,
        });
      }
    }

    // 3) token intersection candidate narrowing using inverted index
    const tokens = tokenize(q);
    let candidateIds: Set<string> | null = null;
    if (tokens.length > 0) {
      for (const t of tokens) {
        const set = inverted.get(t);
        if (!set) {
          candidateIds = new Set(); // no docs for this token, candidate empty
          break;
        }
        if (candidateIds === null) {
          candidateIds = new Set(set);
        } else {
          // intersect
          for (const id of Array.from(candidateIds)) {
            if (!set.has(id)) candidateIds.delete(id);
          }
        }
        // early exit if empty
        if (candidateIds.size === 0) break;
      }
    }

    // If candidateIds is null (meaning tokens was empty or none), fallback to all docs
    if (candidateIds === null) {
      candidateIds = new Set(allDocs.keys());
    }

    // Remove docs already matched by exact phrase (they're in hitsMap)
    for (const id of hitsMap.keys()) candidateIds.delete(id);

    // If candidate set small, run fuse search only on candidates
    let fuzzyResults: Fuse.FuseResult<Doc>[] = [];
    if (candidateIds.size > 0) {
      const candidateArray = Array.from(candidateIds).map((id) => allDocs.get(id)!) as Doc[];
      if (candidateArray.length <= CANDIDATE_THRESHOLD) {
        // create a small Fuse on candidates for fastest fuzzy ranking
        const smallFuse = new Fuse(candidateArray, {
          keys: [
            { name: "title", weight: 0.7 },
            { name: "content", weight: 0.3 },
          ],
          includeScore: true,
          threshold: 0.45,
          ignoreLocation: true,
          minMatchCharLength: 2,
        });
        fuzzyResults = smallFuse.search(q, { limit: 500 });
      } else {
        // candidate set large -> use global fuse but limit
        fuzzyResults = fuse ? fuse.search(q, { limit: 500 }) : [];
      }
    }

    // Combine fuzzy results into hitsMap (skip those already included)
    for (const fr of fuzzyResults) {
      const d = fr.item;
      if (hitsMap.has(d.id)) continue;
      const score = Math.round(((fr.score ?? 1) * 100)) + 50;
      const pos = d.content.toLowerCase().indexOf(q.toLowerCase());
      const excerpt = pos !== -1 ? makeExcerpt(d.content, pos, q.length) : d.content.slice(0, 250) + (d.content.length > 250 ? "…" : "");
      hitsMap.set(d.id, {
        id: d.id,
        title: d.title,
        excerpt,
        score,
        matches: 0,
      });
    }

    // Convert to array and sort: score asc, matches desc, title
    const hitsArr = Array.from(hitsMap.values());
    hitsArr.sort((a, b) => {
      if (a.score !== b.score) return a.score - b.score;
      if (b.matches !== a.matches) return b.matches - a.matches;
      return a.title.localeCompare(b.title);
    });

    // Set results (full array) and reset page
    setResults(hitsArr);
    setPage(1);
  }

  // excerpt helper
  function makeExcerpt(content: string, idx: number, matchLen = 20, len = 220) {
    const start = Math.max(0, idx - Math.floor(len / 2));
    const snippet = content.slice(start, Math.min(content.length, start + len));
    return (start > 0 ? "…" : "") + snippet + (start + len < content.length ? "…" : "");
  }

  // highlighting in excerpt and title
  function highlightHtml(text: string, q: string) {
    if (!q || !text) return escapeHtml(text);

    const phraseMatch = /^".+"$/.test(q) ? q.slice(1, -1) : q;
    // first highlight exact phrase (if present)
    const parts: string[] = [];
    let result = escapeHtml(text);

    const escPhrase = escapeRegex(phraseMatch);
    const phraseRe = new RegExp(escPhrase, "ig");
    if (phraseRe.test(text)) {
      // highlight phrase occurrences
      result = escapeHtml(text).replace(new RegExp(escPhrase, "ig"), (m) => `<mark>${m}</mark>`);
      // still try to highlight tokens (but avoid double-marking)
      const tokens = tokenize(q).filter((t) => !phraseMatch.toLowerCase().includes(t));
      if (tokens.length) {
        const tokenRe = new RegExp("(" + tokens.map(escapeRegex).join("|") + ")", "ig");
        result = result.replace(tokenRe, (m) => `<mark>${m}</mark>`);
      }
      return result;
    }

    // if phrase not present, highlight tokens
    const tokens = tokenize(q);
    if (tokens.length === 0) return escapeHtml(text);
    const tokenRe = new RegExp("(" + tokens.map(escapeRegex).join("|") + ")", "ig");
    result = escapeHtml(text).replace(tokenRe, (m) => `<mark>${m}</mark>`);
    return result;
  }

  // Pagination helpers
  const totalPages = Math.max(1, Math.ceil(results.length / pageSize));
  const pageResults = results.slice((page - 1) * pageSize, page * pageSize);

return (
  <div
    style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      height: "100vh",
      background: "#fafafa",
      fontFamily:
        "Lucida Console, Lucida Sans Typewriter, monaco, Bitstream Vera Sans Mono, monospace",
    }}
  >
    {/* Header + Controls (fixed) */}
    <div
      style={{
        textAlign: "center",
        padding: 20,
        width: "100%",
        maxWidth: 1000,
        position: "sticky",
        top: 0,
        background: "#A094C7",
        zIndex: 10,
        boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
      }}
    >
      <h1 style={{ margin: "0 0 8px", color: "#372554" }}>astrophoenix</h1>
      <p style={{ color: "#372554", margin: "0 0 16px" }}>
        Search keywords and research questions across all 608 papers.
      </p>

      {error && <div style={{ color: "red", marginBottom: 12 }}>{error}</div>}

      <div style={{ marginBottom: 12, color: "#372554"}}>
        <strong>Status:</strong> {status}
        {status === "indexing" && (
          <span>
            {" "}
            — downloaded {progress.done}/{progress.total} (
            {Math.round(
              (progress.done / Math.max(1, progress.total)) * 100
            )}
            %)
          </span>
        )}
        {status === "ready" && (
          <span> — indexed {progress.total} documents</span>
        )}
      </div>

      {/* Search Bar */}
      <div
        style={{
          display: "flex",
          gap: 8,
          justifyContent: "center",
          flexWrap: "wrap",
        }}
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && doSearch(query)}
          placeholder='Enter keywords or exact phrase (use "quotes" for phrase)'
          style={{
            flex: "1 1 300px",
            padding: "10px 14px",
            minWidth: 300,
            borderRadius: 9999,
            border: "1px solid #ccc",
            outline: "none",
            transition: "all 0.2s ease",
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          }}
          onFocus={(e) => (e.target.style.border = "1px solid #888")}
          onBlur={(e) => (e.target.style.border = "1px solid #ccc")}
        />
        <button
          onClick={() => doSearch(query)}
          disabled={!query || (status === "indexing" && progress.done === 0)}
          style={{
            borderRadius: 9999,
            padding: "10px 16px",
            cursor: "pointer",
          }}
        >
          Search
        </button>
        <button
          onClick={() => doSearch(query)}
          style={{
            borderRadius: 9999,
            padding: "10px 16px",
            cursor: "pointer",
          }}
        >
          Refresh
        </button>
      </div>
    </div>

    {/* Scrollable Results Area */}
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        width: "100%",
        maxWidth: 1000,
        padding: "0 20px 40px",
      }}
    >
      {/* Status & Controls */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          margin: "20px 0 10px",
          flexWrap: "wrap",
          color: "#666",
        }}
      >
        <div>
          {results.length} result{results.length !== 1 ? "s" : ""}{" "}
          {results.length > 0 && (
            <> — page {page} / {totalPages}</>
          )}
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <label style={{ fontSize: 13, color: "#666" }}>
            Page size:
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              style={{ marginLeft: 6 }}
            >
              {[5, 10, 20, 50].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {/* Results List */}
      <div>
        {pageResults.length === 0 && (
          <div style={{ color: "#666" }}>No results on this page.</div>
        )}
        {pageResults.map((r) => (
          <div
            key={r.id}
            style={{ padding: 12, borderBottom: "1px solid #eee" }}
          >
            <div style={{ fontSize: 16, fontWeight: 600 }}>
              <span
                dangerouslySetInnerHTML={{
                  __html: highlightHtml(r.title, query),
                }}
              />
            </div>
            <div style={{ fontSize: 12, color: "#666", margin: "6px 0" }}>
              {r.matches ? `${r.matches} match(es)` : ""}
            </div>
            <div style={{ whiteSpace: "pre-wrap", marginTop: 4 }}>
              <span
                dangerouslySetInnerHTML={{
                  __html: highlightHtml(r.excerpt, query),
                }}
              />
            </div>
            <div
              style={{ marginTop: 6, fontSize: 12, color: "#999" }}
            >
              score: {r.score}
            </div>
          </div>
        ))}
      </div>

      {/* Pagination (centered) */}
      <div
        style={{
          display: "flex",
          gap: 8,
          justifyContent: "center",
          marginTop: 16,
          flexWrap: "wrap",
        }}
      >
        <button onClick={() => setPage(1)} disabled={page === 1}>
          « First
        </button>
        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page === 1}
        >
          ‹ Prev
        </button>
        <div
          style={{
            padding: "6px 10px",
            border: "1px solid #eee",
            borderRadius: 6,
            minWidth: 120,
            textAlign: "center",
          }}
        >
          Page {page} of {totalPages}
        </div>
        <button
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={page === totalPages}
        >
          Next ›
        </button>
        <button
          onClick={() => setPage(totalPages)}
          disabled={page === totalPages}
        >
          Last »
        </button>
      </div>
    </div>
  </div>
);



}
