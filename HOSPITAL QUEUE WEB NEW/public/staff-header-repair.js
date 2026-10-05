(() => {
 async function init() {
  const greeting = document.getElementById('staff-session-greeting');
  if (!greeting) return;
  try {
   const response = await fetch('/api/staff/session', {credentials:'same-origin',cache:'no-store'});
   if (!response.ok) return;
   const session = await response.json();
   if (!session.loggedIn) return;
   // The session endpoint exposes the authenticated username, not the full name.
   const name = String(session.username || session.staffId || 'Staff').trim();
   greeting.textContent = `Welcome, ${name}!`;
  } catch (error) { console.warn('Staff greeting unavailable:', error); }
 }
 if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
 else init();
})();
