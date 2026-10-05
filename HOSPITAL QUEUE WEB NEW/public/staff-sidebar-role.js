// Show administration links only for a verified administrator session.
(async () => {
  const adminNav = document.getElementById('mq-admin-navigation');
  if (!adminNav) return;
  adminNav.hidden = true;
  try {
    const response = await fetch('/api/staff/session', { credentials: 'same-origin', cache: 'no-store' });
    if (!response.ok) return;
    const session = await response.json();
    adminNav.hidden = !(session.loggedIn === true && session.role === 'admin');
  } catch (error) {
    console.warn('Could not load staff permissions:', error);
  }
})();
