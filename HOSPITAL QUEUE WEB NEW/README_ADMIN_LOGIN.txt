MediQueue Staff + Admin Login update

1. BACK UP your project.
2. Copy server.js into the main project folder (beside package.json).
3. Copy files from public/ into your main project public/ folder, replacing matching files. These include previous targeted fixes.
4. Restart the server and open /staff-login.html. Staff login appears first; Admin Login is at the bottom.
5. Admin accounts are not publicly registered. The existing server creates an initial admin only when ADMIN_STAFF_ID and ADMIN_PASSWORD (12+ characters) are configured before the first start; optionally set ADMIN_USERNAME. If an admin already exists, these variables will not reset its password. Keep secrets in your local environment, not Git.
6. Verify both roles: staff must not be able to log in through Admin Login; admin must not log in through Staff Login. Admin signs in through the Admin option and opens existing staff.html with admin-only controls.

This package does not contain your database, .env, node_modules, or Git history. It does not reset passwords or create new credentials.
