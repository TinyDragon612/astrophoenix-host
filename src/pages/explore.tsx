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
  const [metaMap, setMetaMap] = useState<Record<string, { authors?: string; year?: string; summary?: string }>>({});

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
        const summary = data.summary || data.abstract || undefined;
        setMetaMap((prev) => ({ ...(prev || {}), [file]: { authors, year, summary } }));
        return;
      }
    } catch (e) {
      // ignore and fallback
    }

    try {
      const txtUrl = BASE_URL + encodeURIComponent(file);
      const r = await fetch(txtUrl);
      if (!r.ok) return;
      const text = await r.text();
      const head = text.slice(0, 1200);
      const authorMatch = head.match(/^\s*(?:Authors?|Author)[:]\s*(.+)$/im);
      const authors = authorMatch ? authorMatch[1].trim() : undefined;
      const yearMatch = head.match(/(19|20)\d{2}/);
      const year = yearMatch ? yearMatch[0] : undefined;
      const summary = text.slice(0, 240).trim();
      if (authors || year || summary) setMetaMap((prev) => ({ ...(prev || {}), [file]: { authors, year, summary } }));
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
    <div style={{ padding: 20, maxWidth: 1000, margin: "0 auto", fontFamily: "Lucida Console, Lucida Sans Typewriter, monaco, Bitstream Vera Sans Mono, monospace", background: '#000', color: '#fff' }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <h2 style={{ margin: 0 }}>Explore</h2>
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter titles..."
          style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #333", minWidth: 220, background: 'transparent', color: '#fff' }}
        />
      </div>

      {error && <div style={{ color: "red" }}>{error}</div>}
      {!files && !error && <div>Loading papers…</div>}

      {files && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {items.map((it) => {
            const baseId = it.file.replace(/\.txt$/i, "");
            const isSaved = saved.find((s) => s.id === baseId);
            const summary = it.meta?.summary || "No summary available.";

            return (
              <div
                key={it.file}
                onClick={() => navigate(`/article/${encodeURIComponent(baseId)}`)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/article/${encodeURIComponent(baseId)}`); }}
                style={{ position: 'relative', padding: 16, borderRadius: 10, background: '#0b0b0b', border: '1px solid #151515', boxShadow: '0 1px 3px rgba(255,255,255,0.02)', cursor: 'pointer', width: '100%' }}
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
                  aria-label={isSaved ? 'Unsave' : 'Save'}
                  title={isSaved ? 'Unsave' : 'Save'}
                  style={{ position: 'absolute', right: 8, top: 8, padding: 6, borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isSaved ? 'rgba(133,99,246,0.18)' : '#222', border: isSaved ? '1px solid rgba(133,99,246,0.45)' : '1px solid #444', boxShadow: isSaved ? '0 0 14px rgba(133,99,246,0.35)' : 'none', backdropFilter: isSaved ? 'blur(4px)' : 'none', transition: 'all 0.18s ease' }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block' }}>
                    <path d="M6 2C5.44772 2 5 2.44772 5 3V21.2929C5 21.6834 5.38604 21.8985 5.70711 21.7071L12 17.1213L18.2929 21.7071C18.6139 21.8985 19 21.6834 19 21.2929V3C19 2.44772 18.5523 2 18 2H6Z" fill={isSaved ? 'rgba(133,99,246,0.35)' : 'transparent'} stroke={isSaved ? '#8563f6' : '#888'} strokeWidth="1.2" />
                  </svg>
                </button>

                <div style={{ fontWeight: 700, color: '#fff', paddingRight: 44 }}>{it.title}</div>

                <div style={{ marginTop: 8, fontSize: 13, color: '#aaa', lineHeight: 1.4 }}>{summary}</div>

                <div style={{ marginTop: 8, fontSize: 12, color: '#ccc' }}>
                  {it.meta?.authors || it.meta?.year ? (
                    <>
                      {it.meta?.authors && <span>{it.meta.authors}</span>}
                      {it.meta?.authors && it.meta?.year && <span> — </span>}
                      {it.meta?.year && <span>{it.meta.year}</span>}
                    </>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
