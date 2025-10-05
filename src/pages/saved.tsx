import React from "react";
import { useResults } from "../context/ResultsContext";

export default function SavedPage() {
  const { saved, toggleSaved } = useResults();

  if (!saved || saved.length === 0) {
    return (
      <div style={{ textAlign: "center", marginTop: 40 }}>
        <h2>Saved</h2>
        <p>No saved articles yet. Click "Save" on a result to add it here.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 20, maxWidth: 900, margin: "0 auto" }}>
      <h2>Saved</h2>
      {saved.map((s) => (
        <div key={s.id} style={{ padding: 12, borderBottom: "1px solid #eee" }}>
          <div style={{ fontSize: 16, fontWeight: 600 }}>{s.title}</div>
          <div style={{ whiteSpace: "pre-wrap", marginTop: 6 }}>{s.excerpt}</div>
          <div style={{ marginTop: 8 }}>
            <button onClick={() => toggleSaved(s)}>Remove</button>
          </div>
        </div>
      ))}
    </div>
  );
}
