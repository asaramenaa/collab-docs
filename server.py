"""DocSpace Lite: small, reviewable full-stack document workspace."""
from __future__ import annotations

import html
import os
import re
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

import bleach
from fastapi import FastAPI, Header, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parent
DB_PATH = Path(os.environ.get("DOCSPACE_DB", "/tmp/docspace.sqlite3" if os.getenv("VERCEL") else str(ROOT / "docspace.sqlite3")))
MAX_CONTENT = 200_000
MAX_IMPORT = 1024 * 1024
USERS = (
    ("alex", "Alex Morgan", "alex@demo.local"),
    ("sam", "Sam Rivera", "sam@demo.local"),
    ("jordan", "Jordan Lee", "jordan@demo.local"),
)
ALLOWED_TAGS = ["p", "br", "strong", "b", "em", "i", "u", "h1", "h2", "h3", "ul", "ol", "li", "div", "blockquote"]

app = FastAPI(title="DocSpace Lite API", docs_url="/api/docs", redoc_url=None)


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


@contextmanager
def connection():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(DB_PATH, timeout=10)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA foreign_keys=ON")
    db.execute("PRAGMA busy_timeout=10000")
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def init_db():
    with connection() as db:
        db.execute("PRAGMA journal_mode=WAL")
        db.executescript("""
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE
            );
            CREATE TABLE IF NOT EXISTS documents (
                id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id),
                title TEXT NOT NULL, content TEXT NOT NULL DEFAULT '<p></p>',
                created_at TEXT NOT NULL, updated_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS document_shares (
                document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
                user_id TEXT NOT NULL REFERENCES users(id),
                created_at TEXT NOT NULL,
                PRIMARY KEY(document_id, user_id)
            );
            CREATE INDEX IF NOT EXISTS documents_owner_idx ON documents(owner_id);
            CREATE INDEX IF NOT EXISTS document_shares_user_idx ON document_shares(user_id);
        """)
        db.executemany("INSERT OR IGNORE INTO users(id, name, email) VALUES (?, ?, ?)", USERS)


init_db()


def user_id(x_demo_user: str | None) -> str:
    """Simulated login is deliberately NOT production authentication."""
    if x_demo_user not in {item[0] for item in USERS}:
        raise HTTPException(401, "Choose a valid demo user")
    return x_demo_user


def validate_title(title: str) -> str:
    title = title.strip()
    if not 1 <= len(title) <= 100:
        raise HTTPException(422, "Title must be 1–100 characters")
    return title


def sanitize_content(value: str) -> str:
    if len(value) > MAX_CONTENT:
        raise HTTPException(413, "Document is too large (maximum 200,000 characters)")
    # No attributes, CSS, links, images, scripts, embeds or event handlers.
    return bleach.clean(value, tags=ALLOWED_TAGS, attributes={}, protocols=[], strip=True)


def get_access(db: sqlite3.Connection, document_id: str, actor: str, *, write: bool = False):
    row = db.execute("""
        SELECT d.*, u.name AS owner_name,
          EXISTS(SELECT 1 FROM document_shares s WHERE s.document_id=d.id AND s.user_id=?) AS shared_to_actor
        FROM documents d JOIN users u ON u.id=d.owner_id WHERE d.id=?
    """, (actor, document_id)).fetchone()
    if row is None or (row["owner_id"] != actor and (write or not row["shared_to_actor"])):
        # Same status conceals existence for users without permission.
        raise HTTPException(404, "Document not found or not accessible")
    return row


def serialize_summary(row, actor: str) -> dict:
    return {"id": row["id"], "title": row["title"], "owner_id": row["owner_id"],
            "owner_name": row["owner_name"], "created_at": row["created_at"],
            "updated_at": row["updated_at"], "can_edit": row["owner_id"] == actor}


class CreateDocument(BaseModel):
    title: str = "Untitled document"
    content: str = "<p></p>"


class UpdateDocument(BaseModel):
    title: str | None = None
    content: str | None = None


class ImportFile(BaseModel):
    filename: str
    content: str


class ShareDocument(BaseModel):
    user_id: str


@app.get("/api/health")
def health():
    return {"ok": True, "service": "docspace-lite"}


@app.get("/api/users")
def list_users():
    return [{"id": uid, "name": name, "email": email} for uid, name, email in USERS]


@app.get("/api/documents")
def list_documents(x_demo_user: str | None = Header(default=None)):
    actor = user_id(x_demo_user)
    with connection() as db:
        rows = db.execute("""
            SELECT d.id,d.title,d.owner_id,u.name AS owner_name,d.created_at,d.updated_at
            FROM documents d JOIN users u ON u.id=d.owner_id
            WHERE d.owner_id=? OR EXISTS (
                SELECT 1 FROM document_shares s WHERE s.document_id=d.id AND s.user_id=?
            ) ORDER BY d.updated_at DESC, d.id DESC
        """, (actor, actor)).fetchall()
        owned = [serialize_summary(r, actor) for r in rows if r["owner_id"] == actor]
        shared = [serialize_summary(r, actor) for r in rows if r["owner_id"] != actor]
    return {"owned": owned, "shared": shared}


@app.post("/api/documents", status_code=201)
def create_document(data: CreateDocument, x_demo_user: str | None = Header(default=None)):
    actor = user_id(x_demo_user)
    title, content = validate_title(data.title), sanitize_content(data.content)
    identifier, now = str(uuid.uuid4()), utc_now()
    with connection() as db:
        db.execute("INSERT INTO documents VALUES (?,?,?,?,?,?)", (identifier, actor, title, content, now, now))
    return {"id": identifier, "title": title}


@app.get("/api/documents/{document_id}")
def read_document(document_id: str, x_demo_user: str | None = Header(default=None)):
    actor = user_id(x_demo_user)
    with connection() as db:
        row = get_access(db, document_id, actor)
        result = serialize_summary(row, actor)
        result["content"] = row["content"]
        result["shares"] = [dict(r) for r in db.execute("""
            SELECT u.id AS user_id, u.name, u.email FROM document_shares s
            JOIN users u ON u.id=s.user_id WHERE s.document_id=? ORDER BY u.name
        """, (document_id,))] if row["owner_id"] == actor else []
    return result


@app.patch("/api/documents/{document_id}")
def update_document(document_id: str, data: UpdateDocument, x_demo_user: str | None = Header(default=None)):
    actor = user_id(x_demo_user)
    if data.title is None and data.content is None:
        raise HTTPException(422, "Specify a title or content update")
    with connection() as db:
        get_access(db, document_id, actor, write=True)
        fields, params = [], []
        if data.title is not None:
            fields.append("title=?")
            params.append(validate_title(data.title))
        if data.content is not None:
            fields.append("content=?")
            params.append(sanitize_content(data.content))
        fields.append("updated_at=?")
        now = utc_now()
        params.extend((now, document_id))
        db.execute(f"UPDATE documents SET {', '.join(fields)} WHERE id=?", params)
    return {"ok": True, "updated_at": now}


@app.delete("/api/documents/{document_id}")
def delete_document(document_id: str, x_demo_user: str | None = Header(default=None)):
    actor = user_id(x_demo_user)
    with connection() as db:
        get_access(db, document_id, actor, write=True)
        db.execute("DELETE FROM documents WHERE id=?", (document_id,))
    return {"ok": True}


@app.post("/api/documents/import", status_code=201)
def import_document(data: ImportFile, x_demo_user: str | None = Header(default=None)):
    actor = user_id(x_demo_user)
    name = Path(data.filename).name
    if not name.lower().endswith(".txt") or name.lower() == ".txt":
        raise HTTPException(415, "Only .txt files are supported")
    if len(data.content.encode("utf-8")) > MAX_IMPORT:
        raise HTTPException(413, "Maximum import size is 1 MB")
    # Convert untrusted text to simple safe HTML; do not treat imported text as markup.
    escaped = html.escape(data.content)
    paragraphs = escaped.replace("\r\n", "\n").replace("\r", "\n").split("\n")
    content = "".join(f"<p>{line or '<br>'}</p>" for line in paragraphs)
    # Cap final editor payload as well (HTML escape can multiply size).
    if len(content) > MAX_CONTENT:
        raise HTTPException(413, "Imported text exceeds the editable document limit")
    title = validate_title(Path(name).stem[:100])
    return create_document(CreateDocument(title=title, content=content), x_demo_user=actor)


@app.post("/api/documents/{document_id}/shares", status_code=201)
def share_document(document_id: str, data: ShareDocument, x_demo_user: str | None = Header(default=None)):
    actor = user_id(x_demo_user)
    target = data.user_id
    if target not in {u[0] for u in USERS}:
        raise HTTPException(422, "Unknown recipient")
    if target == actor:
        raise HTTPException(422, "You already own this document")
    with connection() as db:
        get_access(db, document_id, actor, write=True)
        cursor = db.execute("INSERT OR IGNORE INTO document_shares VALUES (?,?,?)", (document_id, target, utc_now()))
    return {"ok": True, "created": cursor.rowcount == 1}


@app.delete("/api/documents/{document_id}/shares/{target}")
def revoke_share(document_id: str, target: str, x_demo_user: str | None = Header(default=None)):
    actor = user_id(x_demo_user)
    with connection() as db:
        get_access(db, document_id, actor, write=True)
        db.execute("DELETE FROM document_shares WHERE document_id=? AND user_id=?", (document_id, target))
    return {"ok": True}


app.mount("/static", StaticFiles(directory=ROOT / "static"), name="static")


@app.get("/{path:path}", include_in_schema=False)
def application_page(path: str):
    # Browser history routes load the same standalone app.
    if path and path != "" and not re.fullmatch(r"documents/[a-f0-9-]{36}", path):
        raise HTTPException(404, "Page not found")
    return FileResponse(ROOT / "static" / "index.html")




