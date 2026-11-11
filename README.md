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

