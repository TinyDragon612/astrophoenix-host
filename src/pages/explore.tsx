import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useResults } from "../context/ResultsContext";
import { MANIFEST_URL, BASE_URL } from "../config";

function titleFromFilename(f: string) {
  try {
    return decodeURIComponent(f).replace(/\.txt$/i, "").replace(/[-_]/g, " ");
  } catch (e) {
    return f.replace(/\.txt$/i, "");
  }
}

export default function ExplorePage() {
  const [files, setFiles] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [metaMap, setMetaMap] = useState<Record<string, { authors?: string; year?: string }>>({});

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(MANIFEST_URL);
        if (!res.ok) throw new Error(`Failed to load manifest: ${res.status}`);
        const data: string[] = await res.json();
        if (cancelled) return;
        setFiles(data.slice());
        // start loading lightweight metadata in background
        data.forEach((f) => void loadMeta(f));
      } catch (e: any) {
        if (cancelled) return;
        setError(String(e?.message || e));
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function loadMeta(file: string) {
    // try .json metadata first (same base name)
    const base = file.replace(/\.txt$/i, "");
    try {
      const metaUrl = BASE_URL + encodeURIComponent(base + ".json");
      const res = await fetch(metaUrl);
      if (res.ok) {
        const data = await res.json();
        const authors = Array.isArray(data.authors) ? data.authors.join(", ") : data.authors || data.author;
        let year = data.year || data.published || data.date;
        if (year && typeof year === "string") {
          const m = year.match(/(19|20)\d{2}/);
          year = m ? m[0] : year;
        }
        setMetaMap((prev) => ({ ...(prev || {}), [file]: { authors, year } }));
        return;
      }
    } catch (e) {
      // ignore and fallback
    }

    // fallback: fetch the text and try to parse an Authors/Year header
    try {
      const txtUrl = BASE_URL + encodeURIComponent(file);
      const r = await fetch(txtUrl);
      if (!r.ok) return;
      const text = await r.text();
      const head = text.slice(0, 1200);
      // look for lines like 'Authors: Name1, Name2' or 'Author: Name'
      const authorMatch = head.match(/^\s*(?:Authors?|Author)[:]\s*(.+)$/im);
      const authors = authorMatch ? authorMatch[1].trim() : undefined;
      // find a 4-digit year
      const yearMatch = head.match(/(19|20)\d{2}/);
      const year = yearMatch ? yearMatch[0] : undefined;
      if (authors || year) setMetaMap((prev) => ({ ...(prev || {}), [file]: { authors, year } }));
    } catch (e) {
      // ignore
    }
  }

  const items = useMemo(() => {
    if (!files) return [];
    const mapped = files.map((f) => ({ file: f, title: titleFromFilename(f), meta: metaMap[f] }));
    mapped.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }));
    if (!filter) return mapped;
    const q = filter.toLowerCase();
    return mapped.filter((m) => m.title.toLowerCase().includes(q));
  }, [files, filter, metaMap]);

  const navigate = useNavigate();
  const { saved, toggleSaved } = useResults();

  return (
    <div style={{ padding: 20, maxWidth: 1000, margin: "0 auto", fontFamily: "Lucida Console, Lucida Sans Typewriter, monaco, Bitstream Vera Sans Mono, monospace" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <h2 style={{ margin: 0 }}>Explore</h2>
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter titles..."
          style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd", minWidth: 220 }}
        />
      </div>

      {error && <div style={{ color: "red" }}>{error}</div>}
      {!files && !error && <div>Loading papers…</div>}

      {files && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
          {items.map((it) => {
            const baseId = it.file.replace(/\.txt$/i, "");
            const isSaved = saved.find((s) => s.id === baseId);
            return (
              <div
                key={it.file}
                onClick={() => navigate(`/article/${encodeURIComponent(baseId)}`)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/article/${encodeURIComponent(baseId)}`); }}
                style={{ position: "relative", padding: 12, borderRadius: 10, background: "#fff", border: "1px solid #f0f0f0", boxShadow: "0 1px 3px rgba(0,0,0,0.04)", cursor: "pointer" }}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const sr = {
                      id: baseId,
                      title: it.title,
                      excerpt: "",
                      score: 0,
                      matches: 0,
                      content: "",
                      url: BASE_URL + encodeURIComponent(it.file),
                    };
                    toggleSaved(sr);
                  }}
                  aria-label={isSaved ? "Unsave" : "Save"}
                  title={isSaved ? "Unsave" : "Save"}
                  style={{
                    position: "absolute",
                    right: 8,
                    top: 8,
                    background: "transparent",
                    border: "none",
                    padding: 6,
                    borderRadius: 6,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {/* bookmark icon */}
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block' }}>
                    <path d="M6 2C5.44772 2 5 2.44772 5 3V21.2929C5 21.6834 5.38604 21.8985 5.70711 21.7071L12 17.1213L18.2929 21.7071C18.6139 21.8985 19 21.6834 19 21.2929V3C19 2.44772 18.5523 2 18 2H6Z" fill={isSaved ? '#8563f6' : 'transparent'} stroke={isSaved ? '#8563f6' : '#999'} strokeWidth="1.2" />
                  </svg>
                </button>

                <div style={{ fontWeight: 700, color: "#372554" }}>{it.title}</div>
                <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontSize: 12, color: "#666" }}>
                    {it.meta && (it.meta.authors || it.meta.year) ? (
                      <>
                        {it.meta.authors ? <span>{it.meta.authors}</span> : null}
                        {it.meta.authors && it.meta.year ? <span> — </span> : null}
                        {it.meta.year ? <span>{it.meta.year}</span> : null}
                      </>
                    ) : (
                      <span>{it.file}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}