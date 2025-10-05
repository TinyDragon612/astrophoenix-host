import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { SearchResult } from "../types";

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
      if (found) return prev.filter((p) => p.id !== item.id);
      return [item, ...prev];
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
