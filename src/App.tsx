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

function Starfield() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrame = 0;
    const stars = Array.from({ length: 200 }, () => ({
      x: Math.random(),
      y: Math.random(),
      size: Math.random() * 1.4 + 0.6,
      twinkle: Math.random() * Math.PI * 2,
      twinkleSpeed: 0.006 + Math.random() * 0.04,
    }));
    interface ShootingStar {
      x: number;
      y: number;
      vx: number;
      vy: number;
      life: number;
      length: number;
      opacity: number;
    }
    const shootingStars: ShootingStar[] = [];

    const spawnShootingStar = () => {
      const side = Math.random() < 0.5 ? -0.1 : 1.1;
      const startX = side;
      const startY = 0.05 + Math.random() * 0.4;
      const baseSpeed = 0.018 + Math.random() * 0.012;
      const angle = side < 0 ? Math.random() * 0.4 - 0.2 : Math.PI - (Math.random() * 0.4 - 0.2);
      shootingStars.push({
        x: startX,
        y: startY,
        vx: baseSpeed * Math.cos(angle),
        vy: baseSpeed * Math.sin(angle),
        life: 120 + Math.random() * 40,
        length: 0.1 + Math.random() * 0.05,
        opacity: 0.9,
      });
    };
    let time = Math.random() * Math.PI * 2;

    const draw = () => {
      const { width, height } = canvas;
      time += 0.0025;

      // deep night base
      const base = ctx.createLinearGradient(0, 0, 0, height);
      base.addColorStop(0, "#05010f");
      base.addColorStop(0.55, "#020007");
      base.addColorStop(1, "#000");
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, width, height);

      // subtle aurora ribbons
      const ribbonCount = 2;
      for (let i = 0; i < ribbonCount; i++) {
        const phase = time * (0.16 + i * 0.045) + i * 2;
        const intensity = 0.2 + (Math.sin(phase) + 1) * 0.25;
        const centerX = width * (0.25 + i * 0.35) + Math.sin(phase * 0.8) * width * 0.08;
        const centerY = height * (0.28 + Math.cos(phase * 0.6) * 0.06);
        const grad = ctx.createRadialGradient(
          centerX,
          centerY,
          width * 0.01,
          centerX,
          centerY,
          width * 0.38
        );
        grad.addColorStop(0, "rgba(130,90,230,0.2)");
        grad.addColorStop(0.35, "rgba(90,60,180,0.12)");
        grad.addColorStop(0.7, "rgba(40,30,120,0.06)");
        grad.addColorStop(1, "rgba(0,0,0,0)");
        ctx.globalAlpha = intensity;
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);
      }
      ctx.globalAlpha = 1;

      stars.forEach((star) => {
        star.twinkle += star.twinkleSpeed;
        const alpha = 0.2 + Math.abs(Math.sin(star.twinkle)) * 0.8;
        ctx.globalAlpha = alpha;
        const px = star.x * width;
        const py = star.y * height;
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(px, py, star.size, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;

      if (shootingStars.length < 2 && Math.random() < 0.01) {
        spawnShootingStar();
      }

      for (let i = shootingStars.length - 1; i >= 0; i--) {
        const star = shootingStars[i];
        star.x += star.vx;
        star.y += star.vy;
        star.life -= 1;
        star.opacity = Math.max(0, star.opacity - 0.006);

        const px = star.x * width;
        const py = star.y * height;
        const tailX = px - star.vx * width * (star.length * 18);
        const tailY = py - star.vy * height * (star.length * 18);

        ctx.strokeStyle = `rgba(255,255,255,${0.65 * star.opacity})`;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(px, py);
        ctx.stroke();

        ctx.fillStyle = `rgba(255,255,255,${0.85 * star.opacity})`;
        ctx.beginPath();
        ctx.arc(px, py, 1.6, 0, Math.PI * 2);
        ctx.fill();

        if (
          star.life <= 0 ||
          px < -50 ||
          px > width + 50 ||
          py < -50 ||
          py > height + 50
        ) {
          shootingStars.splice(i, 1);
        }
      }

      animationFrame = requestAnimationFrame(draw);
    };

    const handleResize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw();
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        zIndex: 0,
        pointerEvents: "none",
      }}
    />
  );
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
        background: "linear-gradient(90deg, rgba(186,163,255,0.15), rgba(133,99,246,0.2))",
        color: "#fff",
        padding: "10px 16px",
        position: "sticky",
        top: 0,
        zIndex: 100,
        borderRadius: 14,
        margin: 10,
        border: "1px solid rgba(133,99,246,0.25)",
        boxShadow: "0 6px 18px rgba(0,0,0,0.35)",
        backdropFilter: "blur(10px)",
        textShadow: "0 0 6px rgba(133,99,246,0.25)",
        fontFamily:
          "Lucida Console, Lucida Sans Typewriter, monaco, Bitstream Vera Sans Mono, monospace",
        transition: "box-shadow 0.2s ease",
      }}
    >

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
              background: location.pathname === tab.path ? "rgba(0,0,0,0.45)" : "transparent",
              boxShadow: location.pathname === tab.path ? "0 0 12px rgba(0,0,0,0.35)" : "none",
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

        const respurl = await fetch("https://raw.githubusercontent.com/AwesomeCoder412412/stupid/refs/heads/main/output.json");
        if (!respurl.ok) throw new Error("Failed to fetch manifest urls: " + resp.status);
        const urls: string[] = await respurl.json();
        // concurrency-limited fetch
        const concurrency = Math.min(8, Math.max(2, Math.floor(navigator.hardwareConcurrency || 4)));
        const queue = manifest.slice();
        const urlqueue = urls.slice();
        let active = 0;
        let done = 0;

        function next(): Promise<void> {
          return new Promise(async (resolve) => {
            if (queue.length === 0) return resolve();
            if (urlqueue.length === 0) return resolve();
            const filename = queue.shift()!;
            const urll = urlqueue.shift()!;
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
                  indexDoc({ id: filename, title: filename.replace(/\.txt$/i, ""), content: "", url: urll});
                } else {
                  const text = await r.text();
                  indexDoc({ id: filename, title: filename.replace(/\.txt$/i, ""), content: text, url: urll});
                }
              } else {
                const text = await r.text();
                indexDoc({ id: filename, title: filename.replace(/\.txt$/i, ""), content: text, url: urll });
              }
            } catch (err) {
              console.warn("Error fetching", filename, err);
              indexDoc({ id: filename, title: filename.replace(/\.txt$/i, ""), content: "", url: urll});
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
          url: d.url,
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
          url: d.url,
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
        url: d.url,
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


    
    
   
    const hitsMap2 = new Map<string, SearchResult>();

        

    if (q.includes("?")) {
        let aiBabble = "The user asked: " + q + "\n I am now going to give you the contents of several academic papers that are relevant to this topic. Use ONLY KNOWLEDGE FROM THE FOLLOWING PAPERS to answer the user's question. Every piece of information you get from the papers MUST BE CITED with the title of cited paper in parentheses at the end of the relevant sentences. Thank you very much. BEGIN PAPERS: "
    
    let count = 0;
    while (count < 3 && count < hitsArr.length) {
        console.log ("On paper " + count);
        aiBabble = aiBabble + "PAPER TITLE: " + hitsArr[count].title + " PAPER CONTENT: " + await AIU("", "Please summarize the key statistics and points in this paper for another AI to be able to quickly read and get as much infomration out of this as possible: " + docsRef.current.get(hitsArr[count].id)?.content) + "END PAPER CONTENT. ", 
        count++;
    }
        hitsMap2.set("1", {
          id: "AI",
          title: "AI Summary",
          excerpt: await AIU("You are a concise, factual assistant. Your job is to summarize and help people learn about papers on Space Biology.", aiBabble) + "\n Papers Cited: " + hitsArr[0].title,
          score: 0,
          matches: 1,
          content: "",
          url: ""
        });
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
  <>
    <Starfield />
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "calc(100vh - 120px)",
        padding: "80px 16px 60px",
        width: "100%",
        boxSizing: "border-box",
        background: "transparent",
        color: "#fff",
        position: "relative",
        zIndex: 1,
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
          maxWidth: 960,
          position: "relative",
          margin: "0 auto",
          background: "#0b0b0b",
          zIndex: 10,
          boxShadow: "0 0 30px rgba(0,0,0,0.5), 0 0 24px rgba(255,255,255,0.08)",
          borderRadius: 50,
          border: "1px solid #151515",
        }}
      >
      <h1 style={{ margin: "0 0 8px", color: "#fff", letterSpacing: 10 }}>🔥AstroPhoenix</h1>
      <p style={{ color: "#ccc", margin: "0 0 16px" }}>
        Search keywords and research questions across all 608 papers.
      </p>

      {error && <div style={{ color: "red", marginBottom: 12 }}>{error}</div>}

  <div style={{ marginBottom: 12, color: "#ccc"}}>
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
            border: "1px solid #333",
            background: "transparent",
            color: "#fff",
            outline: "none",
            transition: "all 0.2s ease",
            boxShadow: "none",
          }}
          onFocus={(e) => (e.target.style.border = "1px solid #444")}
          onBlur={(e) => (e.target.style.border = "1px solid #222")}
        />
        <button
          onClick={() => doSearch(query)}
          disabled={!query || (status === "indexing" && progress.done === 0)}
          style={{
            borderRadius: 9999,
            padding: "14px 26px",
            cursor: "pointer",
            background: "rgba(133,99,246,0.2)",
            border: "1px solid rgba(133,99,246,0.45)",
            color: "#f5ecff",
            fontWeight: 600,
            letterSpacing: 0.5,
            boxShadow: "0 0 18px rgba(133,99,246,0.35)",
            backdropFilter: "blur(6px)",
            transition: "all 0.2s ease",
          }}
        >
          Search
        </button>
        <button
          onClick={() => doSearch(query)}
          style={{
            borderRadius: 9999,
            padding: "10px 14px",
            cursor: "pointer",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid #333",
            color: "#ccc",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 18,
            lineHeight: 1,
            width: 48,
            height: 48,
            boxShadow: "0 0 10px rgba(0,0,0,0.35)",
            transition: "all 0.2s ease",
          }}
          aria-label="Refresh results"
        >
          ↻
        </button>
      </div>
    </div>

    
  </div>
  </>
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
