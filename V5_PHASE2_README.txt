MEDIQUEUE V5 PHASE 2 — STAFF DEPARTMENT PERMISSIONS

PREREQUISITE: Install and verify V5 Phase 1 first.
BACK UP: Back up the entire outer project, especially server.js, data/ and database/.

INSTALL (outer project folder only):
1. Replace outer server.js with this server.js.
2. Copy public/admin.html, public/staff-permissions.html and public/staff-permissions.js into outer public/.
3. Do NOT replace .env, database/, data/, node_modules/ or account-theme.js.
4. Restart npm start. Sign in as Admin and open http://localhost:3000/staff-permissions.html (also linked from Admin overview).
5. Assign departments to each staff member and click Save permissions.
6. Test with a separate staff account: allowed department actions should work, other department actions must return HTTP 403. Admin remains unrestricted.

BEHAVIOR:
- All existing staff start with zero department permissions (secure default). Admin must assign access.
- Staff may operate assigned queues and edit assigned department details. Only admin may create/delete departments, edit rooms/logos, or change global portal settings.
- Permission checks are enforced on the server for mutations, not just the UI.
- Patient ticket requests are unchanged.
- Permissions stored in a new SQLite table, without removing existing data.
- The existing staff page may still show controls that now return a 403; UI-level filtering is planned for Phase 6.
- This package is incremental: keep the previous Phase 1 files that are not included here.

VALIDATION: node --check server.js and staff-permissions.js; ZIP integrity. Not browser/integration tested; test locally before deploying.

SECURITY: Never upload .env, live database, or patient data to GitHub. Configure Render environment variables separately. Database persistence on Render requires persistent storage.
