import React, { JSX, useEffect, useRef, useState } from "react";
import { MANIFEST_URL, BASE_URL } from "./config";
import type { Doc, SearchResult } from "./types";
import Fuse from "fuse.js";
import AI from "./call_gpt";
import AIU from "./gptItYourself";
import { BrowserRouter as Router, Routes, Route, Link, useLocation, useNavigate } from "react-router-dom";

import Explore from "./pages/explore";
import Profile from "./pages/profile";
import Saved from "./pages/saved";
import Results from "./pages/results";
import ArticlePage from "./pages/article";
import LoginSignup from "./pages/login";

import { initializeApp } from 'firebase/app';
import { ResultsProvider, useResults } from "./context/ResultsContext";
import { getAuth, signOut } from "firebase/auth";
import { onAuthStateChanged } from "firebase/auth";
import { setPersistence, browserLocalPersistence } from "firebase/auth";
import { Navigate } from "react-router-dom";


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

function Navbar() {

  const location = useLocation();

  const auth = getAuth();

    const tabs = [
    { path: "/", label: "Search" },
    { path: "/explore", label: "Explore" },
    { path: "/saved", label: "Saved" },
    { path: "/profile", label: "Profile" },
  ];

return (

    <nav
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        gap: 24,
        background: "linear-gradient(90deg,#baa3ffcc,#8563f6cc)",
        color: "#fff",
        padding: "10px 16px",
        position: "sticky",
        top: 0,
        zIndex: 100,
        borderRadius: 12,
        margin: 10,
        boxShadow: "0 2px 8px rgba(56,47,84,0.08)",
        fontFamily:
          "Lucida Console, Lucida Sans Typewriter, monaco, Bitstream Vera Sans Mono, monospace",
      }}
    >

      <nav>
      {/* ... your tab links ... */}
      <button
        onClick={() => signOut(auth)}
        style={{
          marginLeft: "auto",
          background: "none",
          border: "none",
          color: "#fde8ff",
          cursor: "pointer",
          fontSize: 16,
          fontFamily:
          "Lucida Console, Lucida Sans Typewriter, monaco, Bitstream Vera Sans Mono, monospace",
        }}
      >
        Logout
      </button>
    </nav>

      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        {tabs.map((tab) => (
          <Link
            key={tab.path}
            to={tab.path}
            style={{
              textDecoration: "none",
              color: location.pathname === tab.path ? "#fff" : "#fde8ff",
              fontWeight: location.pathname === tab.path ? "700" : "600",
              fontSize: 15,
              padding: "6px 12px",
              borderRadius: 999,
              background: location.pathname === tab.path ? "rgba(0,0,0,0.08)" : "transparent",
              transition: "all 0.15s ease",
            }}
          >
            {tab.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

function SearchPage() {
  const navigate = useNavigate();
  const { setLastResults } = useResults();
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
  const [pageSize, setPageSize] = useState<number>(10);
  const [activeTab, setActiveTab] = useState("search");

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
                console.log("fallback")
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
   /* q = q.trim()
   const result = AI(q, "classify");
   console.log(await result)
    if (await result !== "question") {
        console.log(result)
        const summary : SearchResult[] = [];
        summary.push({
                id: "0",
                title: "AI Summary",
                excerpt: await AI(q, "question"),
                score: 0,
                matches: 0
      });
        setQuery(q);
        setResults(summary);
        setPage(1);
        navigate("/results");
        return;
    } */
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
          content: d.content,
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
          content: d.content,
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
      if (candidateArray.length <= 600) {
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
        content: d.content,
      });
    }

    


    // Convert to array and sort: score asc, matches desc, title
    let hitsArr = Array.from(hitsMap.values());
    
    //const hitsArr = Array.from(hitsMap.values());
    hitsArr.sort((a, b) => {
      if (a.score !== b.score) return a.score - b.score;
      if (b.matches !== a.matches) return b.matches - a.matches;
      return a.title.localeCompare(b.title);
    });

    console.log(docsRef.current.get(hitsArr[0].id)?.content);

    let aiBabble = "The user asked: " + q + "\n I am now going to give you the contents of several academic papers that are relevant to this topic. Use ONLY KNOWLEDGE FROM THE FOLLOWING PAPERS to answer the user's question. Every piece of information you get from the papers MUST BE CITED with the title of cited paper in parentheses at the end of the relevant sentences. Thank you very much. BEGIN PAPERS: "
    
    let count = 0;
    while (count < 3 && count < hitsArr.length) {
        console.log ("On paper " + count);
        aiBabble = aiBabble + "PAPER TITLE: " + hitsArr[count].title + " PAPER CONTENT: " + await AIU("", "Please summarize the key statistics and points in this paper for another AI to be able to quickly read and get as much infomration out of this as possible: " + docsRef.current.get(hitsArr[count].id)?.content) + "END PAPER CONTENT. ", 
        count++;
    }
    console.log(aiBabble);

   
    const hitsMap2 = new Map<string, SearchResult>();

        hitsMap2.set("1", {
          id: "AI",
          title: "AI Summary",
          excerpt: await AIU("You are a concise, factual assistant. Your job is to summarize and help people learn about papers on Space Biology.", aiBabble) + "\n Papers Cited: " + hitsArr[0].title,
          score: 0,
          matches: 1,
          content: ""
        });

    if (q.includes("?")) {
       hitsArr = Array.from(hitsMap2.values());
    }
    // Set results (full array) and reset page
    setResults(hitsArr);
    setPage(1);
    // save to context so Results page is resilient to refresh
    try {
      setLastResults(hitsArr, q, pageSize);
    } catch (e) {
      // ignore if context not available
    }
    // navigate to results page
    try {
      navigate("/results");
    } catch (e) {
      // ignore
    }
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
      justifyContent: "center",
      height: "100vh",
      background: "#fafafa",
      fontFamily:
        "Lucida Console, Lucida Sans Typewriter, monaco, Bitstream Vera Sans Mono, monospace",
    }}
  >
    {/* PAGE CONTENT AREA */}
    <div
      style={{
        textAlign: "center",
        padding: "40px 24px",
        width: "100%",
        maxWidth: 1000,
        position: "relative",
        background: "#fff",
        zIndex: 10,
        boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
        borderRadius: 50,
      }}
    >
      <h1 style={{ margin: "0 0 8px", color: "#372554", letterSpacing: 10 }}>🔥AstroPhoenix</h1>
      <p style={{ color: "#372554", margin: "0 0 16px" }}>
        Search keywords and research questions across all 608 papers.
      </p>

      {error && <div style={{ color: "red", marginBottom: 12 }}>{error}</div>}

      <div style={{ marginBottom: 12, color: "#372554"}}>
        <strong>Status:</strong> {status}
        {status === "indexing" && (
          <span>
            {" "}
            — downloaded {progress.done + 14 }/{progress.total + 14} (
            {Math.round(
              (progress.done / Math.max(1, progress.total)) * 100
            )}
            %)
          </span>
        )}
        {status === "ready" && (
          <span> — indexed {progress.total + 14} documents</span>
        )}
      </div>

      {/* Search Bar */}
      <div
        style={{
          display: "flex",
          gap: 8,
          justifyContent: "center",
          flexWrap: "wrap"
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

    
  </div>
);
}

//PAGES!!!!!

function PrivateRoute({ children }: { children: JSX.Element }) {
  const auth = getAuth();
  const user = auth.currentUser;
  return user ? children : <Navigate to="/" replace />;
}

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false); // stop showing loading spinner
    });

    return () => unsubscribe();
  }, []);

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      {user ? <MainApp /> : <LoginSignup />}
    </div>
  );

  function MainApp() {
  return (
    <ResultsProvider>
      <Router>
        <Navbar />
        <Routes>
          <Route path="/" element={<SearchPage />} />
          <Route path="/explore" element={<Explore/>} />
          <Route path="/results" element={<Results/>} />
          <Route path="/saved" element={<Saved/>} />
          <Route path="/profile" element={<PrivateRoute><Profile /></PrivateRoute>} />
          <Route path="/article/:id" element={<ArticlePage />} />
        </Routes>
      </Router>
    </ResultsProvider>
  );
}}
