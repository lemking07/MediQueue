MediQueue V5 — Phase 1: Admin Overview (incremental upgrade)

This package intentionally includes only server.js, public/admin.html, public/admin.js. Existing login pages, patient portal, styling, accounts and database are not replaced.

INSTALL
1. Back up your entire running project and database.
2. Copy server.js into the OUTER project folder beside package.json.
3. Copy admin.html and admin.js into that project's public folder.
4. Keep your existing .env, database and data folders unchanged.
5. Restart with npm start. Log in as Admin and visit /admin.html. Staff users must receive HTTP 403.

This phase adds read-only department and staff counts, not staff permission enforcement, appointments, notifications or patient profile yet. Those need separate development and tests.

SECURITY NOTE: Your uploaded project ZIP contained .env, .git, database/data and node_modules. This package deliberately excludes them. Rotate any exposed credentials, and ensure secrets and real patient records are never committed to GitHub.
