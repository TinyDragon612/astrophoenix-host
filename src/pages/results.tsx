import React, { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { SearchResult } from "../types";
import { useResults } from "../context/ResultsContext";
import Fuse from "fuse.js";

function escapeRegex(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function escapeHtml(str: string) {
  return str.replace(/[&<>\"]/g, (c) => {
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
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter(Boolean);
}

function highlightHtml(text: string, q: string) {
  if (!q || !text) return escapeHtml(text);

  const phraseMatch = /^".+"$/.test(q) ? q.slice(1, -1) : q;
  let result = escapeHtml(text);

  const escPhrase = escapeRegex(phraseMatch);
  const phraseRe = new RegExp(escPhrase, "ig");
  if (phraseRe.test(text)) {
    result = escapeHtml(text).replace(new RegExp(escPhrase, "ig"), (m) => `<mark>${m}</mark>`);
    const tokens = tokenize(q).filter((t) => !phraseMatch.toLowerCase().includes(t));
    if (tokens.length) {
      const tokenRe = new RegExp("(" + tokens.map(escapeRegex).join("|") + ")", "ig");
      result = result.replace(tokenRe, (m) => `<mark>${m}</mark>`);
    }
    return result;
  }

  const tokens = tokenize(q);
  if (tokens.length === 0) return escapeHtml(text);
  const tokenRe = new RegExp("(" + tokens.map(escapeRegex).join("|") + ")", "ig");
  result = escapeHtml(text).replace(tokenRe, (m) => `<mark>${m}</mark>`);
  return result;
}

export default function ResultsPage() {
  const loc = useLocation();
  const navigate = useNavigate();
  const { lastResults, query: ctxQuery, pageSize: ctxPageSize, saved, toggleSaved } = useResults();
  const state = (loc.state || {}) as { results?: SearchResult[]; query?: string; pageSize?: number };
  const initialResults = state.results ?? lastResults ?? [];
  const initialQuery = state.query ?? ctxQuery ?? "";
  const [results, setResults] = useState<SearchResult[]>(initialResults);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(state.pageSize ?? ctxPageSize ?? 10);

  // local editable query for the top search bar
  const [queryInput, setQueryInput] = useState<string>(initialQuery);

  // current visible query (for display/highlighting)
  const [activeQuery, setActiveQuery] = useState<string>(initialQuery);

  // perform an in-place fuzzy search over the current result set (or reset when empty)
  function performLocalSearch(q: string) {
    const trimmed = q.trim();
  setActiveQuery(trimmed);
    if (!trimmed) {
      // reset to the original initial results
      setResults(initialResults);
      setPage(1);
      try {
        // also update context query so other pages reflect it
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        // setLastResults is available on context; update query via setLastResults to keep parity
        // We intentionally only update query in context by calling setLastResults with current lastResults
        // (this keeps behavior non-destructive)
        // Note: useResults does not expose a setter for query directly.
      } catch (e) {
        // ignore
      }
      return;
    }

    try {
      const fuse = new Fuse(initialResults, {
        keys: [
          { name: "title", weight: 0.7 },
          { name: "excerpt", weight: 0.3 },
        ],
        includeScore: true,
        threshold: 0.45,
        ignoreLocation: true,
        minMatchCharLength: 2,
      });
      const fr = fuse.search(trimmed, { limit: 1000 });
      const mapped: SearchResult[] = fr.map((r) => ({ ...(r.item as SearchResult) }));
  setResults(mapped);
  setPage(1);
    } catch (e) {
      // fallback: simple substring filter
      const lower = trimmed.toLowerCase();
      const filtered = initialResults.filter((r) => r.title.toLowerCase().includes(lower) || (r.excerpt || "").toLowerCase().includes(lower));
      setResults(filtered);
      setPage(1);
    }
  }

  const totalPages = Math.max(1, Math.ceil(results.length / pageSize));
  const pageResults = useMemo(() => results.slice((page - 1) * pageSize, page * pageSize), [results, page, pageSize]);

  return (
    <div style={{ padding: 20, maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h2>Results</h2>
        <div>
          <button onClick={() => navigate(-1)} style={{ marginRight: 8 }}>Back</button>
          <label style={{ fontSize: 13, color: "#666" }}>
            Page size:
            <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} style={{ marginLeft: 6 }}>
              {[5, 10, 20, 50].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
  <div style={{ color: "#666" }}>{results.length} result{results.length !== 1 ? "s" : ""} {activeQuery ? <>for "{activeQuery}"</> : null}</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            value={queryInput}
            onChange={(e) => setQueryInput(e.target.value)}
            placeholder="refine query"
            style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid #ccc" }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                performLocalSearch(queryInput);
              }
            }}
          />
          <button onClick={() => performLocalSearch(queryInput)}>Search</button>
        </div>
      </div>

      <div>
        {pageResults.length === 0 && <div style={{ color: "#666" }}>No results on this page.</div>}
        {pageResults.map((r) => (
          <div key={r.id} style={{ padding: 12, borderBottom: "1px solid #eee" }}>
            <div style={{ fontSize: 16, fontWeight: 600 }}>
              <span dangerouslySetInnerHTML={{ __html: highlightHtml(r.title, activeQuery) }} />
            </div>
            <div style={{ position: "absolute", right: 12, top: 12 }}>
              <button onClick={() => toggleSaved(r)}>{saved.find((s) => s.id === r.id) ? "Unsave" : "Save"}</button>
            </div>
            <div style={{ fontSize: 12, color: "#666", margin: "6px 0" }}>{r.matches ? `${r.matches} match(es)` : ""}</div>
            <div style={{ whiteSpace: "pre-wrap", marginTop: 4 }}>
              <span dangerouslySetInnerHTML={{ __html: highlightHtml(r.excerpt, activeQuery) }} />
            </div>
            <div style={{ marginTop: 6, fontSize: 12, color: "#999" }}>score: {r.score}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 16, flexWrap: "wrap" }}>
        <button onClick={() => setPage(1)} disabled={page === 1}>« First</button>
        <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>‹ Prev</button>
        <div style={{ padding: "6px 10px", border: "1px solid #eee", borderRadius: 6, minWidth: 120, textAlign: "center" }}>Page {page} of {totalPages}</div>
        <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Next ›</button>
        <button onClick={() => setPage(totalPages)} disabled={page === totalPages}>Last »</button>
      </div>
    </div>
  );
}
