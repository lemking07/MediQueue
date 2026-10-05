# MediQueue: Turso upgrade

This version stores patient/staff accounts, visit history, active queues, department configuration, portal theme/logo/favicon settings, appointments, staff permissions, audit history, and login sessions in one database.

The web address remains https://mediqueue-44ip.onrender.com. Patient and staff accounts remain separate. Staff still need administrator approval and department permission. Existing tickets remain assigned to the patient until staff complete them or cancel them through the existing department reset action.

## 1. Back up and copy the upgrade

1. Stop your local Node server with Ctrl+C.
2. Make a backup copy of your entire existing project folder. In particular, preserve `database/mediqueue.db` and `data/queue.json`.
3. Extract this ZIP. Copy its contents into your MAIN project folder (the one you use for `npm start`). Replace matching code files. Do not copy it into the old nested duplicate project folder.
4. Keep your original `.env`, `database/mediqueue.db`, and `data/queue.json`. This ZIP intentionally contains no real accounts, passwords, database, or token.
5. Open that main folder in VS Code. In its terminal run:

```powershell
npm install
```

Node 22.16 or later is required for the import tool; Node 24 is suitable. In PowerShell, use `npm.cmd` if your execution policy blocks `npm.ps1`.

## 2. Add the Turso values locally

In your existing local `.env`, keep your existing admin variables and add:

```dotenv
TURSO_DATABASE_URL=libsql://mediqueue-lemking07.aws-us-east-2.turso.io
TURSO_AUTH_TOKEN=PASTE_YOUR_PRIVATE_REPLACEMENT_TOKEN_HERE
```

Replace the placeholder with the actual token privately. Do not upload `.env` to GitHub. Use the same URL/token in Render's MediQueue service Environment, alongside `ADMIN_STAFF_ID`, `ADMIN_USERNAME`, and `ADMIN_PASSWORD` (at least 12 characters). Revoke the tokens previously shared in chat. Creating another token alone does not revoke earlier ones.

Check the connection:

```powershell
npm run check:database
```

Expect `Connected to Turso successfully.` This confirms credentials/network access, not that old data has been imported.

## 3. Preserve your existing accounts and theme (before first startup)

If you want to keep data from your laptop, import it BEFORE running the upgraded server or deploying it to Render:

```powershell
npm run migrate:turso -- --confirm-empty-target
```

The importer reads your existing local database and queue JSON without changing them. It preserves IDs and password hashes, so imported accounts keep their passwords. It refuses to overwrite a Turso database that already contains application data or queue settings.

If your source files are elsewhere:

```powershell
npm run migrate:turso -- --confirm-empty-target --database "C:\path\to\database\mediqueue.db" --queue "C:\path\to\data\queue.json"
```

Only data present in those source files can be imported. Accounts created only on the old Render instance are not automatically in your laptop database. Data already lost from Render's temporary disk cannot be recovered by this upgrade.

If you intentionally want a new empty system, skip import and start the app. It creates empty department settings and the configured admin account. Once started, the import tool will refuse to overwrite it. To import later, use a separate empty Turso database; do not delete a live database to bypass the check.

## 4. Start and test

```powershell
npm start
```

Expected log:

```text
Database: TURSO connected (accounts, queues, settings and sessions)
```

Open your local patient/staff pages to check the imported data. When your laptop and Render use the same Turso URL, both read/write the same live data. Queue test actions will therefore affect that shared database.

For automated checks that use ONLY temporary local test databases:

```powershell
npm test
```

The tests cover separate patient/staff registration, independent-session login, staff approval/permissions, concurrent ticket requests, restart persistence, completion/reset, appointment capacity, write rollback, and non-destructive import. These are local libSQL tests; your real Turso connection must be confirmed using `check:database` and the Render startup log.

## 5. Push through VS Code

From your existing Git repository folder:

```powershell
git add server.js package.json package-lock.json .gitignore .env.example lib scripts START-HERE-TURSO.md
git diff --cached --stat
git commit -m "Store MediQueue accounts queues and settings in Turso"
git push origin main
```

Do not stage `.env`, database files, or a project ZIP. Render should use `npm install` (or `npm ci`) as its build command and `npm start` as its start command. Wait for the new commit to deploy successfully. The old queue-retention commit alone does not connect Turso.

## 6. Confirm on two devices

1. Open the SAME Render website on both devices.
2. Register a patient on device A and log in with that account on device B without registering again.
3. Take a queue number. Reopen the page or log out/in: the active number should remain.
4. Staff/admin completes the checkup (or resets/cancels the department's active queue). Only then can the patient receive a new active ticket.
5. Register and approve a staff account. Log in on both devices. A patient account does not automatically grant staff access; the same username/password can be registered separately for both roles.
6. Restart/redeploy Render, then confirm the account and active ticket remain.

## Storage and limits

With both Turso variables configured, the server uses Turso directly and does not fall back to a temporary local database if cloud access fails. Queue mutations and visit changes commit together. Failed writes do not send success responses or broadcast uncommitted changes. Request handlers await database operations.

Without Turso variables, local development uses `database/mediqueue.db`; it imports the local queue JSON into `queue_state` once, then uses the DB row. On Render, missing Turso configuration stops startup. Database errors produce a retry message, rather than silently replacing data with an empty queue.

Login sessions are stored in the database with an 8-hour cookie duration. A stable `SESSION_SECRET` can be set in both environments; otherwise one is generated and persisted in the database. Existing sessions from the old version may require one new login. Expired session records are cleaned at startup.

This remains a college prototype. Socket.IO notifications are served by one Render process; running multiple active web instances would additionally need shared Socket.IO event delivery. Database writes remain transactional, but this package does not add a multi-instance notification service.
