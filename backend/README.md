# CareMate backend

Node 22.5+ only. No `npm install` needed (uses the built-in SQLite).

    cd backend
    npm start          # http://localhost:3000  (serves the website and the API)
    npm test           # runs the API checks

Open the site at **http://localhost:3000**, not by double-clicking index.html.
If the server is not running the site still works on that device only and syncs once it is.

The database file is created at `backend/data/caremate.db` (schema in `schema.sql`).
Optional environment variables: `PORT`, `DB_PATH`, `SESSION_DAYS` (default 30), `CORS_ORIGIN`.

## Endpoints
`POST /api/register`, `POST /api/login`, `POST /api/logout`, `GET /api/me`, `GET /api/sync`,
`GET|PUT /api/profile`, `GET|PUT /api/plan`, `GET|PUT /api/log`, `PUT /api/log/:day`,
`GET /api/dashboard`, `GET|PUT /api/reminders`, `PUT /api/kv/:key`, `DELETE /api/data`, `DELETE /api/me`, `GET /api/health`.
Protected routes need the header `Authorization: Bearer <token>` (returned by login/register).
