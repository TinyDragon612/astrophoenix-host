// src/pages/article.tsx
import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { BASE_URL } from "../config";
import askGPT from "../call_gpt";

type DocData = { id: string; title: string; text: string, sourceUrl: string };

function chunkText(text: string, target = 12000): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < text.length) {
    let end = Math.min(i + target, text.length);
    if (end < text.length) {
      const nl = text.lastIndexOf("\n", end);
      if (nl > i + Math.floor(target * 0.6)) end = nl;
    }
    out.push(text.slice(i, end));
    i = end;
  }
  return out;
}

async function summarizeWithAI(fullText: string): Promise<string> {
  const CHUNK_LIMIT = 12000; // characters; tune if your model allows more
  if (fullText.length <= CHUNK_LIMIT) {
    const prompt = fullText;
    // If your call_gpt API differs, swap the next line to match it.
    return await askGPT(prompt, "summarize");
  }
  const chunks = chunkText(fullText, CHUNK_LIMIT);
  const partials: string[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const prompt = `\n\n(Chunk ${i + 1}/${chunks.length})\n${chunks[i]}`;
    partials.push(await askGPT(prompt, "summarize"));
  }
  const synthPrompt = partials.map((p, i) => `Chunk ${i + 1}:\n${p}`).join("\n\n---\n\n");
  return await askGPT(synthPrompt, "summarize");
}

function titleFromFirstLine(raw: string, fallback: string): string {
  const first = (raw.split(/\r?\n/).find((l) => l.trim().length > 0) || "").trim();
  if (!first) return fallback;
  return first
    .replace(/\s*[-–|]\s*(PMC|PubMed( Central)?).*/i, "") // drop " - PMC", " | PubMed"
    .replace(/\s+/g, " ")
    .trim();
}

export default function ArticlePage() {
  const { id = "" } = useParams();
  const [doc, setDoc] = useState<DocData | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const title = id

  const [summarizing, setSummarizing] = useState(false);
  const [summary, setSummary] = useState<string>("");

  useEffect(() => {
    async function fetchDoc(rawId: string) {
      try {
        setLoading(true);
        setErr(null);

        const baseId = decodeURIComponent(rawId);
        const filename = /\.[a-z0-9]+$/i.test(baseId) ? baseId : `${baseId}.txt`;

        // Try encoded path; fall back to raw.
        let res = await fetch(BASE_URL + encodeURIComponent(filename));
        if (!res.ok) res = await fetch(BASE_URL + filename);
        if (!res.ok) throw new Error(`Fetch failed (${res.status})`);

        const text = await res.text();
        const sourceUrl = res.url;
        const title = titleFromFirstLine(text, baseId);

        setDoc({ id: baseId, title, text, sourceUrl });
        document.title = `${title} — AstroPhoenix`;
      } catch (e: any) {
        setErr(e?.message ?? "Unknown error");
      } finally {
        setLoading(false);
      }
    }

    setSummary("");
    if (!id) {
      setErr("Missing article id.");
      setLoading(false);
    } else {
      fetchDoc(id);
    }
  }, [id]);

  async function handleSummarize() {
    if (!doc?.text) return;
    try {
      setSummarizing(true);
      const s = await summarizeWithAI(doc.text);
      setSummary(s.trim());
    } catch (e: any) {
      setSummary("");
      setErr(`Summarization failed: ${e?.message || e}`);
    } finally {
      setSummarizing(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        padding: "32px 20px 80px",
        display: "flex",
        justifyContent: "center",
        background: "#000",
        color: "#fff",
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

        {loading && <div>Loading…</div>}
        {err && <div style={{ color: "red", whiteSpace: "pre-wrap" }}>{err}</div>}

        {doc && (
          <article
            style={{
              background: "#0b0b0b",
              borderRadius: 16,
              boxShadow: "0 2px 8px rgba(255,255,255,0.03)",
              padding: "40px 60px",
              maxWidth: 900,
              margin: "0 auto",
              border: "1px solid #151515",
              fontFamily:
        "Lucida Console, Lucida Sans Typewriter, monaco, Bitstream Vera Sans Mono, monospace"
            }}
          >
            <h1 style={{ marginTop: 0, color: "#fff", letterSpacing: 0.3 }}>
              {doc.title}
            </h1>

            <div style={{ marginTop: 8, fontSize: 13 }}>
              <a href={doc.sourceUrl} target="_blank" rel="noreferrer">
                View source
              </a>
            </div>

            <div style={{ marginTop: 16, display: "flex", gap: 12 }}>
              <button onClick={handleSummarize} disabled={summarizing}>
                {summarizing ? "Summarizing…" : "Summarize"}
              </button>
            </div>

            {summary && (
              <section
                style={{
                  marginTop: 20,
                  padding: "16px 18px",
                  background: "#121212",
                  border: "1px solid #222",
                  borderRadius: 12,
                  whiteSpace: "pre-wrap",
                  color: "#ddd",
                }}
              >
                {summary}
              </section>
            )}
          </article>
        )}
      </div>
    </div>
  );
}
