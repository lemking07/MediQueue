MEDIQUEUE - TURSO UPDATE
=========================

This version connects the existing MediQueue patient/staff database to Turso
when these two environment variables are present:

TURSO_DATABASE_URL
TURSO_AUTH_TOKEN

RENDER
------
You already added these two variables in Render. After replacing the project
files, push the updated project to GitHub and let Render redeploy.

LOCAL TESTING
-------------
If you want to test Turso locally too, add the same two variables to your local
.env file. If they are not present locally, the project falls back to the old
SQLite database so the existing local project remains usable.

IMPORTANT
---------
The old SQLite database is NOT automatically copied to Turso. If you need the
existing local patient/staff/visit records in Turso, run the migration script:

    node database/migrate-to-turso.js

Run it from the project folder after TURSO_DATABASE_URL and TURSO_AUTH_TOKEN are
available in your local environment.

The migration script preserves the existing IDs and copies the current SQLite
data into Turso. Run it only once against a fresh Turso database.
