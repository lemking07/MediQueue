MEDIQUEUE PATIENT ACCOUNT UPGRADE — CLASSROOM PROTOTYPE

1. Back up your existing project folder.
2. Copy the files from this ZIP over your existing project. Keep your existing data/queue.json; it is intentionally NOT included in this ZIP.
3. Use Node.js 24.21.0. Open a terminal in the project folder and run npm install then npm start. The SQLite database is created automatically.
4. Visit http://localhost:3000/patient-login.html to sign up. Staff login remains /staff-login.html.
5. Set SESSION_SECRET, STAFF_USERNAME, and STAFF_PASSWORD environment variables before sharing the site; existing server defaults are unsafe.
6. Use only fictional visit data. This is NOT suitable for real hospital patient records without a security and privacy review.
7. Existing tickets created before this upgrade have no account association and will not appear in history. A call timestamp records staff calling/assigning a room, NOT actual physical arrival.
8. Resetting a queue marks active visit records cancelled without deleting history.
9. Passwords use salted scrypt hashes; patient login is username + password. Full names need not be unique.
10. The existing express-session MemoryStore is not production-ready; deployment requires a persistent session store, HTTPS, and security review.
