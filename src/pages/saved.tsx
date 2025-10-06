import React from "react";
import { useResults } from "../context/ResultsContext";
import { useNavigate, Link } from "react-router-dom";

export default function SavedPage() {
  const { saved, toggleSaved } = useResults();
  const navigate = useNavigate();

  if (!saved || saved.length === 0) {
    return (
      <div style={{ textAlign: "center", marginTop: 40, color: "#fff", fontFamily:
        "Lucida Console, Lucida Sans Typewriter, monaco, Bitstream Vera Sans Mono, monospace" }}>
        <h2>Saved</h2>
        <p>No saved articles yet. What will you explore? 🤔💭</p>
        <Link
          to="/"
          style={{
            display: "inline-block",
            marginTop: 12,
            padding: "8px 14px",
            background: "rgba(133,99,246,0.18)",
            color: "#f5ecff",
            borderRadius: 10,
            textDecoration: "none",
            border: "1px solid rgba(133,99,246,0.45)",
            boxShadow: "0 0 16px rgba(133,99,246,0.35)",
            backdropFilter: "blur(6px)",
          }}
        >
          Go search papers
        </Link>
      </div>
    );
  }

  return (
    <div style={{ padding: 20, maxWidth: 900, margin: "0 auto", color: "#fff", background: "#000", fontFamily: "Lucida Console, Lucida Sans Typewriter, monaco, Bitstream Vera Sans Mono, monospace"}}>
      <h2>Saved</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {saved.map((s) => (
          <div
            key={s.id}
            role="button"
            tabIndex={0}
            onClick={() => navigate(`/article/${encodeURIComponent(s.id)}`)}
            onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/article/${encodeURIComponent(s.id)}`); }}
            style={{ padding: 16, borderRadius: 10, background: "#0b0b0b", border: "1px solid #151515", boxShadow: "0 1px 3px rgba(255,255,255,0.02)", cursor: "pointer", width: '100%' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#fff", fontFamily: "Lucida Console, Lucida Sans Typewriter, monaco, Bitstream Vera Sans Mono, monospace"}}>{s.title}</div>
                <div style={{ whiteSpace: "pre-wrap", marginTop: 8, color: "#ccc" }}>{s.excerpt}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                <button
                  onClick={(e) => { e.stopPropagation(); toggleSaved(s); }}
                  style={{
                    background: "rgba(229,57,53,0.18)",
                    border: "1px solid rgba(229,57,53,0.45)",
                    color: "#ffb4b2",
                    padding: "6px 12px",
                    borderRadius: 10,
                    cursor: "pointer",
                    boxShadow: "0 0 16px rgba(229,57,53,0.3)",
                    backdropFilter: "blur(4px)",
                    transition: "all 0.2s ease",
                  }}
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
