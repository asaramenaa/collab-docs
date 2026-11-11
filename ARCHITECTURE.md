# Architecture and scope

```text
Browser (index.html + app.js + styles.css)
  ├── dashboard (owned/shared)
  ├── editable document + formatting + autosave
  ├── .txt import and validation
  └── viewer sharing modal + demo account switcher
             │ JSON over HTTP, X-Demo-User (demo only)
             ▼
FastAPI (server.py)
  ├── identity selection + input checks
  ├── permission checks: owner/read-only viewer/unrelated user
  ├── bleach HTML allowlist
  └── SQLite storage
        ├── users
        ├── documents (HTML rich-text content)
        └── document_shares (many-to-many)
```

## Scope decisions

- Full journey over incomplete feature breadth.
- Owner-only mutations; shared viewer can read but cannot modify or re-share.
- `.txt` is the selected product-relevant file format; upload creates a document.
- SQLite persists edits across refresh and server restarts on the same disk.
- No real-time collaboration or production authentication. Those require more time and infrastructure.

## Next 2–4 hours

1. Replace `execCommand` editor with Tiptap and structured JSON.
2. Add authenticated sessions and a hosted Postgres database.
3. Add save version/revision tokens to prevent cross-tab overwrite.
4. Add Playwright interaction tests and automated deployment.
