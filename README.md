# Academic Search Engine (Barebones, React + TypeScript)

This is a minimal React + TypeScript project (Vite) that implements a local search engine for a directory of academic articles stored as plain text files.

Features:
- Fetches a `manifest.json` (array of filenames) from a remote folder.
- Downloads article `.txt` files ( filenames are the article titles ).
- Builds an in-memory index using Fuse.js for fuzzy search.
- Prioritizes exact phrase matches (title/content) before fuzzy results.
- Returns results sorted by relevance with snippets.

Quick start:
1. Install dependencies:
   ```
   npm install
   ```
2. Edit `src/config.ts` and set `MANIFEST_URL` and `BASE_URL`.
   - `MANIFEST_URL` should point to a JSON file containing an array of filenames, e.g.:
     `["Article One.txt", "Another Paper.txt"]`
   - `BASE_URL` should be the folder URL containing the .txt files, e.g. `https://example.com/articles/`
3. Run dev server:
   ```
   npm run dev
   ```
4. Open http://localhost:5173

Notes & tips:
- The app downloads all text files in parallel with a concurrency limit to avoid hammering servers.
- For large collections (~thousands), consider building a server-side index.
- Manifest file must contain filenames exactly as they appear on the server.

