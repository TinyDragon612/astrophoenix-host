import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
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

  return (
    <div style={{ padding: 20, maxWidth: 1000, margin: "0 auto" }}>
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
          {items.map((it) => (
            <div key={it.file} style={{ padding: 12, borderRadius: 10, background: "#fff", border: "1px solid #f0f0f0", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
              <Link to={`/article/${encodeURIComponent(it.file.replace(/\.txt$/i, ""))}`} style={{ textDecoration: "none", color: "#372554", fontWeight: 700 }}>
                {it.title}
              </Link>
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
                <Link to={`/article/${encodeURIComponent(it.file.replace(/\.txt$/i, ""))}`} style={{ textDecoration: "none", color: "#8563f6", fontWeight: 600 }}>Open</Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}