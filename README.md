# DocSpace Lite

A lightweight, Google Docs–inspired full-stack document workspace, built for the **AI-Native Full Stack Developer Assignment**. It supports document editing, file import, owner-controlled sharing and real persistence without paid services.

## Quick start

Requirements: **Python 3.10+** and `pip`.

```bash
cd docspace-lite
python -m venv .venv
# macOS/Linux:
source .venv/bin/activate
# Windows PowerShell:
# .venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn server:app --reload
```

Open **http://127.0.0.1:8000**. API documentation: **http://127.0.0.1:8000/api/docs**.

> This source distribution does not contain a deployed URL. For assessment submission, deploy the application to a publicly reachable host with a **persistent disk** or replace local SQLite with a hosted database. SQLite on an ephemeral host will lose data after restarts.

## Demo walkthrough (3–5 minutes)

1. Start as **Alex Morgan** and create a new document.
2. Rename it **Launch Notes**; type a paragraph and format words as bold, italic and underline. Add a heading and list. Explain that changes autosave.
3. Refresh the page. Confirm title, text and formatting persist.
4. Return to dashboard. Click **Import .txt** and choose a small UTF-8 text file. Open and edit it.
5. Reopen **Launch Notes**, click **Share**, grant Sam Rivera viewer access.
6. Switch to **Sam Rivera** in the bottom left. Open **Shared with me**, then open Launch Notes. Demonstrate disabled editing controls.
7. Switch to Alex and revoke access. Switch back to Sam and show that the document is no longer shared.
8. Summarize scope decisions and tests; mention that real authentication and live collaboration are intentionally out of scope.

**Video requirement:** The assessment asks for a **3–5 minute walkthrough video** as a submission deliverable, not a video recorded during development. Record it **after** the working app is ready, and place a public/unlisted Loom, YouTube or similar video link in the submission.

## Tech and architecture

- **Frontend:** standalone responsive HTML/CSS/JavaScript; browser `contenteditable` rich-text editor, with built-in formatting commands. No npm or frontend build step.
- **Backend:** FastAPI routes in `server.py`; validates payloads and enforces owner/viewer rules.
- **Storage:** Python's built-in SQLite with 3 tables: `users`, `documents`, and `document_shares`; WAL mode, foreign keys, transactions and indexes.
- **Rich text:** safe restricted HTML, sanitized on the server with `bleach`; persisted and restored without stripping supported headings, lists or formatting.
- **File upload:** `.txt` imported in-browser and sent to the API as UTF-8 JSON; one file maximum 1 MB, resulting editable content maximum 200,000 characters. Other formats are not supported. No direct server disk upload.
- **Users:** Alex, Sam and Jordan are seeded. Switching users simulates identity only; this is **not authentication**.

### Permissions

| Action | Owner | Shared viewer | Unrelated user |
|---|---|---|---|
| Open/read | Yes | Yes | No |
| Rename/edit | Yes | No | No |
| Invite/revoke access | Yes | No | No |
| Delete | Yes | No | No |

The server verifies the acting demo user for every protected request. A user lacking access receives HTTP 404; a shared viewer cannot write or grant further access. In a real product, replace the client-supplied `X-Demo-User` identity with a verified session.

## API

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/users` | Demo accounts |
| GET | `/api/documents` | Owned + shared sections |
| POST | `/api/documents` | Create |
| GET | `/api/documents/{id}` | Read if permitted |
| PATCH | `/api/documents/{id}` | Rename / save editor content |
| DELETE | `/api/documents/{id}` | Owner delete |
| POST | `/api/documents/import` | Import .txt to an editable document |
| POST | `/api/documents/{id}/shares` | Grant viewer access |
| DELETE | `/api/documents/{id}/shares/{user_id}` | Revoke viewer access |
| GET | `/api/health` | Health check |

Protected requests require `X-Demo-User: alex` (or `sam`/`jordan`).

## Test

```bash
pip install httpx
python -m unittest discover -s tests -v
```

Tests cover document CRUD and persistence, access enforcement, sharing/revocation, imports, validation and HTML sanitization.

## Engineering trade-offs

**What I prioritized:** complete end-to-end workflows, backend permission enforcement, autosave, safe persistence, and a clear editable/read-only distinction.

**What I intentionally skipped:** authentication, concurrent collaboration, PDF/DOCX import, comments, version history, and PDF export. They are not required core features in this timebox.

**Browser editor trade-off:** `document.execCommand` is deprecated, but remains supported in major desktop browsers and is useful for a very small dependency-free prototype. For a production-grade collaborative editor I would replace it with Tiptap/ProseMirror and persist structured document JSON.

**Autosave trade-off:** the client saves after 700 ms of inactivity, and on explicit navigation. Closing the browser during an in-flight request might lose the last keystrokes. The save indicator makes this visible.

**Security limitation:** demo account IDs come from the browser and are intentionally forgeable. This is *not* suitable for real private documents. The server enforces role logic for the selected demo actor, but production requires session authentication, CSRF protections and a security review.

**Deployment limitation:** SQLite requires durable filesystem storage. For cheap ephemeral hosting, use hosted PostgreSQL instead. Restrict CORS/origins, terminate TLS, and disable debug services in production.

## AI-native workflow note (customize truthfully)

AI assistance can accelerate initial API design, UI scaffolding, test-case generation, and writing documentation. The actual finished application must still be checked by running tests and manually demonstrating create/edit/refresh/import/share/switch/revoke. Verify permissions with direct API requests, not only by hiding UI buttons. Any claims about personal AI tools or manual verification should reflect what you actually performed. No AI model is called by the runtime app.

## Final submission checklist

- [ ] Source code in a Google Drive folder
- [ ] README.md with local run commands
- [ ] Short architecture note (`ARCHITECTURE.md`)
- [ ] AI workflow note (`AI_WORKFLOW.md`)
- [ ] `SUBMISSION.md` with included files and live app link
- [ ] Live public deployment (with persistent storage)
- [ ] An actual recorded **3–5 minute** video and its public/unlisted URL
- [ ] Reviewer account instructions (Alex/Sam/Jordan demo switcher)
- [ ] Screenshots if reviewer setup needs extra steps

Do not claim deployment or video completion until you have uploaded them.
