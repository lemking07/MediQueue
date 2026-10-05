# Staff and admin session update

## Install
Back up your current project, stop the server, and copy the updated code into the main folder containing server.js. Keep your current .env, database and data files. Run:

    npm install
    npm test
    npm start

No Turso import/reset is needed. Existing accounts and notification features are retained.

## Login links after deployment
Staff: https://mediqueue-44ip.onrender.com/staff-login.html
Admin: https://mediqueue-44ip.onrender.com/admin/staff-login.html

The login page has a Staff Login / Admin Login switch. Each role has its own cookie. Use the separate links in different tabs to keep both roles signed in. Tabs for the SAME role still share that role's session. Old admin sessions require signing in once at the new admin link.

Admin navigation and API requests stay under /admin/. The server checks account roles; changing a URL cannot grant administrator access. Patient sessions remain separate.

Welcome labels display Welcome Admin, NAME! or Welcome Staff, NAME! Staff uses the registered full name. Admin uses the account name, falling back to username when its stored name is the generic Administrator.

Staff approval and enable/disable actions now open a themed website dialog. Cancel and Escape make no change. Approve/Disable submits the operation.

## GitHub / Render
Run in your existing project Git checkout:

    git add server.js public/role-context.js public/staff-dialog.js public/staff*.html public/staff*.js public/admin.html public/admin.js public/logout.html scripts/test-storage.js ROLE-UPDATE.md
    git commit -m "Separate admin and staff sessions and improve approval dialog"
    git push origin main

Wait for Render to show Live. Sign into staff in one tab and admin using the admin link in another. Log out of admin and refresh staff: staff should stay logged in. Repeat in the other direction. Check welcome names and cancel/approve a pending account.

## Verification
Automated HTTP tests send both role cookies together and verify both logout directions. Existing account, queue, appointment, import and push tests passed. Physical-browser visual verification should be completed after deployment.
