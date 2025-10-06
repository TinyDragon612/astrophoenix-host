import React, { createContext, useContext, useState, ReactNode } from "react";

// Define the shape of the context
interface ApiKeyContextType {
  apiKey: string | null;
  setApiKey: (key: string) => void;
}

// Create the context
const ApiKeyContext = createContext<ApiKeyContextType | undefined>(undefined);

// Provider component
export function ApiKeyProvider({ children }: { children: ReactNode }) {
  const [apiKey, setApiKeyState] = useState<string | null>(
    localStorage.getItem("openai_api_key") // persist between reloads
  );

  const setApiKey = (key: string) => {
    setApiKeyState(key);
    if (key) localStorage.setItem("openai_api_key", key);
    else localStorage.removeItem("openai_api_key");
  };

  return (
    <ApiKeyContext.Provider value={{ apiKey, setApiKey }}>
      {children}
    </ApiKeyContext.Provider>
  );
}

// Hook for easy use
export function useApiKey() {
  const context = useContext(ApiKeyContext);
  if (!context) throw new Error("useApiKey must be used within ApiKeyProvider");
  return context;
}
