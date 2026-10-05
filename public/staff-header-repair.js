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
   const name = String((session.fullName === 'Administrator' ? session.username : session.fullName) || session.username || 'User').trim();
   greeting.textContent = `Welcome ${session.role === 'admin' ? 'Admin' : 'Staff'}, ${name}!`;
  } catch (error) { console.warn('Staff greeting unavailable:', error); }
 }
 if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
 else init();
})();
