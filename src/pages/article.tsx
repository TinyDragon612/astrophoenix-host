// src/pages/article.tsx
import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { BASE_URL } from "../config";

// Simple type for what we display
type DocData = { id: string; title: string; content: string };

export default function ArticlePage() {
  const { id = "" } = useParams(); // filename from the URL
  const [doc, setDoc] = useState<DocData | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    // Fetch the article file directly from the external repo by filename
    async function fetchDoc(fileId: string) {
      try {
        setLoading(true);
        setErr(null);

        // decode the id for display; try encoded fetch first
        const file = decodeURIComponent(fileId);
        const title = file.replace(/\.txt$/i, "");

        let res = await fetch(BASE_URL + encodeURIComponent(file));
        if (!res.ok) {
          // Fallback to raw filename if server already expects raw paths
          res = await fetch(BASE_URL + file);
        }
        if (!res.ok) throw new Error(`Fetch failed (${res.status})`);

        const text = await res.text();
        setDoc({ id: file, title, content: text });
      } catch (e: any) {
        setErr(e?.message ?? "Unknown error");
      } finally {
        setLoading(false);
      }
    }

    if (!id) {
      setErr("Missing article id.");
      setLoading(false);
    } else {
      fetchDoc(id);
    }
  }, [id]);

  return (
    <div
      style={{
        minHeight: "100vh",
        padding: "32px 20px 80px",
        display: "flex",
        justifyContent: "center",
        background: "#fafafa",
        fontFamily:
          "Lucida Console, Lucida Sans Typewriter, monaco, Bitstream Vera Sans Mono, monospace",
      }}
    >
      <div style={{ width: "100%", maxWidth: 900 }}>
        <div style={{ marginBottom: 16 }}>
          <Link to="/" style={{ color: "#372554", textDecoration: "none" }}>
            ← Back to search
          </Link>
        </div>

        {loading && <div>Loading…</div>}
        {err && (
          <div style={{ color: "red" }}>
            Could not load article. {err}
          </div>
        )}
        {doc && (
          <article
            style={{
              background: "#fff",
              borderRadius: 16,
              boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
              padding: "28px 28px 40px",
            }}
          >
            <h1 style={{ marginTop: 0, color: "#372554", letterSpacing: 1 }}>
              {doc.title}
            </h1>
            {/* Render plain text content with wrapping */}
            <div
              style={{
                whiteSpace: "pre-wrap",
                lineHeight: 1.5,
                color: "#222",
                fontSize: 16,
              }}
            >
              {doc.content}
            </div>
          </article>
        )}
      </div>
    </div>
  );
}
