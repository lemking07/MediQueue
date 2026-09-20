MediQueue refresh-flash fix

Back up your project. Replace ONLY public/staff-login.html and public/staff.js in the MAIN project folder (the one containing your running server.js). Restart npm start and hard-refresh Ctrl+F5. No accounts, database, .env, or patient files are included.

The login page embeds critical auth.css to avoid an unstyled flash. Staff dashboard waits for its custom logo before initial reveal and stays hidden during expired-session redirects. Browser runtime testing was not performed.
