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

## Owner (admin) access
Set `ADMIN_EMAIL=you@example.com` in Render > Environment, create an account with that email, then open `/admin.html`.
Only that account can list users and view their details; every other account only ever sees its own data.

## Render notes
The free plan sleeps when idle (slow first load) and its disk is erased on redeploy. Use a paid plan with a persistent disk
(set `DB_PATH` to a path on that disk) so user accounts are kept.

## Forgot password (email code)
`POST /api/forgot`, `POST /api/reset` and `POST /api/change-password` are included.
1. EmailJS > Email Templates > Create: To Email = `{{to_email}}`, Subject = `Your CareMate password reset code`,
   Content = `Hi {{to_name}}, your CareMate code is {{code}}. It works for {{minutes}} minutes.` Copy its Template ID.
2. EmailJS > Account > Security: tick "Allow EmailJS API for non-browser applications".
3. Render > Environment: add `EMAILJS_RESET_TEMPLATE_ID` = that Template ID (then redeploy).
Optional: `EMAILJS_SERVICE_ID`, `EMAILJS_PUBLIC_KEY` (default to the Contact form's) and `EMAILJS_PRIVATE_KEY`.
Without step 3 the server answers "Password reset email is not set up" (set `DEV_RESET_LOG=1` to print codes in the log while testing).

## Forgot the admin password
Render > Environment: set `ADMIN_RESET_PASSWORD` to a new password (6+ characters). Your email must already be in `ADMIN_EMAIL`.
Save (Render redeploys), log in with that email and the new password, then **delete `ADMIN_RESET_PASSWORD`** so it is not left behind.
All sessions of that account are signed out when the password changes.
