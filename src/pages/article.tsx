// src/pages/article.tsx
import React from "react";
import { useParams, Link } from "react-router-dom";

/**
 * Turn the route param into a title.
 * - By default we show the decoded id exactly.
 * - Flip PRETTIFY to true if you want "filename" -> "Filename" (no extension/underscores).
 */
const PRETTIFY = false;

function makeTitleFromId(raw: string): string {
  const decoded = decodeURIComponent(raw || "");
  if (!PRETTIFY) return decoded || "Untitled";

  // Optional prettifying: strip path + extension; underscores/hyphens -> spaces.
  const pretty = decoded
    .replace(/^.*\//, "")
    .replace(/\.[^.]+$/i, "")
    .replace(/[_-]+/g, " ")
    .trim();

  // Capitalize first letter for a nicer look.
  return pretty ? pretty.charAt(0).toUpperCase() + pretty.slice(1) : decoded || "Untitled";
}

export default function ArticlePage() {
  const { id = "" } = useParams();

  const title = makeTitleFromId(id);

  React.useEffect(() => {
    if (title) document.title = `${title} — AstroPhoenix`;
  }, [title]);

  if (!id) {
    return (
      <div style={{ padding: 24 }}>
        <Link to="/" style={{ textDecoration: "none" }}>← Back to search</Link>
        <div style={{ color: "red", marginTop: 12 }}>Missing article id.</div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        padding: "32px 20px 80px",
        display: "flex",
        justifyContent: "center",
        background: "#fafafa",
        fontFamily:
          "Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
      }}
    >
      <div style={{ width: "100%", maxWidth: 960 }}>
        <div style={{ marginBottom: 16 }}>
          <Link to="/" style={{ color: "#372554", textDecoration: "none" }}>
            ← Back to search
          </Link>
        </div>

        <article
          style={{
            background: "#fff",
            borderRadius: 16,
            boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
            padding: "40px 60px",
            maxWidth: 900,
            margin: "0 auto",
          }}
        >
          <h1 style={{ margin: 0, color: "#372554", letterSpacing: 0.3 }}>
            {title}
          </h1>
        </article>
      </div>
    </div>
  );
}
