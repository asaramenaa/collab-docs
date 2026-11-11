# AI-Native workflow note

This implementation was produced with help from an AI coding assistant for the initial application, UI, endpoint structure and tests. AI output is not treated as self-verifying.

**Where it helps:** quickly generating cohesive boilerplate, identifying security-focused sharing tests, laying out the demo sequence and documenting implementation trade-offs.

**Verification:** run `python -m unittest discover -s tests -v` and open the app to manually check create → format → save → refresh → import → share → switch → read-only → revoke. Review server-side permission checks separately from UI restrictions.

**Intentional choices:** opted for FastAPI + SQLite and a standalone JS editor to remove third-party build tooling and paid backend dependencies. Account switching is a demo shortcut, **not** a secure login system.

**What I changed/rejected:** avoided real-time cursors, broad file types and unverified claims of production-ready authentication. Restricted stored editor markup to an allowlist, and tested denial of unauthorized writes.

**Before submission:** edit this note to state which tools *you* used and what *you* personally tested. Do not represent unperformed reviews as complete.
