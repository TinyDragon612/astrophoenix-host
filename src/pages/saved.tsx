import React from "react";
import { useResults } from "../context/ResultsContext";
import { Link } from "react-router-dom";

export default function SavedPage() {
  const { saved, toggleSaved } = useResults();

  if (!saved || saved.length === 0) {
    return (
      <div style={{ textAlign: "center", marginTop: 40, color: "#fff" }}>
        <h2>Saved</h2>
        <p>No saved articles yet.</p>
        <Link to="/" style={{ display: "inline-block", marginTop: 12, padding: "8px 14px", background: "#8563f6", color: "#fff", borderRadius: 8, textDecoration: "none" }}>
          Go search papers
        </Link>
      </div>
    );
  }

  return (
    <div style={{ padding: 20, maxWidth: 900, margin: "0 auto", color: "#fff", background: "#000", fontFamily: "Lucida Console, Lucida Sans Typewriter, monaco, Bitstream Vera Sans Mono, monospace"}}>
      <h2>Saved</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
        {saved.map((s) => (
          <div key={s.id} style={{ padding: 12, borderRadius: 10, background: "#0b0b0b", border: "1px solid #151515", boxShadow: "0 1px 3px rgba(255,255,255,0.02)" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#fff", fontFamily: "Lucida Console, Lucida Sans Typewriter, monaco, Bitstream Vera Sans Mono, monospace"}}>{s.title}</div>
            <div style={{ whiteSpace: "pre-wrap", marginTop: 8, color: "#ccc" }}>{s.excerpt}</div>
            <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Link to={`/article/${encodeURIComponent(s.id)}`} style={{ textDecoration: "none", color: "#8563f6", fontWeight: 600 }}>Open</Link>
              <button
                onClick={() => toggleSaved(s)}
                style={{ background: "transparent", border: "1px solid #ff6b6b", color: "#ff6b6b", padding: "6px 10px", borderRadius: 8, cursor: "pointer" }}
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
