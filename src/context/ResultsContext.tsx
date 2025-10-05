import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { SearchResult } from "../types";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "../firebase";

type ResultsState = {
  lastResults: SearchResult[];
  query: string;
  pageSize: number;
  setLastResults: (r: SearchResult[], q?: string, pageSize?: number) => void;
  saved: SearchResult[];
  toggleSaved: (item: SearchResult) => void;
};

const ResultsContext = createContext<ResultsState | undefined>(undefined);

const SAVED_KEY = "astrophoenix_saved";

export function ResultsProvider({ children }: { children: React.ReactNode }) {
  const [lastResults, setLastResultsState] = useState<SearchResult[]>([]);
  const [query, setQuery] = useState("");
  const [pageSize, setPageSize] = useState<number>(10);
  const [saved, setSaved] = useState<SearchResult[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SAVED_KEY);
      if (raw) setSaved(JSON.parse(raw));
    } catch (e) {
      // ignore
    }
  }, []);

  // when auth state changes, attempt to load server-side saved items and merge with local
  useEffect(() => {
    const unsub = onAuthStateChanged(getAuth(), async (user) => {
      if (!user) return;
      try {
        const dref = doc(db, "users", user.uid);
        const snap = await getDoc(dref);
        if (snap.exists()) {
          const data = snap.data();
          if (data && Array.isArray(data.saved)) {
            // merge server saved with local saved (server first)
            setSaved((local) => {
              const serverSaved: SearchResult[] = data.saved as SearchResult[];
              const map = new Map<string, SearchResult>();
              serverSaved.forEach((s) => map.set(s.id, s));
              local.forEach((s) => {
                if (!map.has(s.id)) map.set(s.id, s);
              });
              const merged = Array.from(map.values());
              try {
                localStorage.setItem(SAVED_KEY, JSON.stringify(merged));
              } catch (e) {}
              return merged;
            });
          }
        }
      } catch (e) {
        console.warn("Failed to load saved from server", e);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(SAVED_KEY, JSON.stringify(saved));
    } catch (e) {
      // ignore
    }
  }, [saved]);

  const setLastResults = useCallback((r: SearchResult[], q?: string, ps?: number) => {
    setLastResultsState(r);
    if (typeof q === "string") setQuery(q);
    if (typeof ps === "number") setPageSize(ps);
  }, []);

  const toggleSaved = useCallback((item: SearchResult) => {
    setSaved((prev) => {
      const found = prev.find((p) => p.id === item.id);
      const next = found ? prev.filter((p) => p.id !== item.id) : [item, ...prev];
      try {
        localStorage.setItem(SAVED_KEY, JSON.stringify(next));
      } catch (e) {
        // ignore
      }
      // persist to firestore if user logged in
      (async () => {
        try {
          const user = getAuth().currentUser;
          if (!user) return;
          const dref = doc(db, "users", user.uid);
          await setDoc(dref, { saved: next }, { merge: true });
        } catch (e) {
          // ignore
        }
      })();
      return next;
    });
  }, []);

  const value: ResultsState = {
    lastResults,
    query,
    pageSize,
    setLastResults,
    saved,
    toggleSaved,
  };

  return <ResultsContext.Provider value={value}>{children}</ResultsContext.Provider>;
}

export function useResults() {
  const ctx = useContext(ResultsContext);
  if (!ctx) throw new Error("useResults must be used within ResultsProvider");
  return ctx;
}
