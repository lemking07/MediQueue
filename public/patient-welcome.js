// Display the username from the authenticated server session, not browser storage.
(async function showPatientWelcome() {
  const banner = document.getElementById("mq-personal-welcome");
  if (!banner) return;
  try {
    const response = await fetch("/api/patient/me", { credentials: "same-origin", cache: "no-store" });
    if (response.status === 401) {
      window.location.replace("/patient-login.html");
      return;
    }
    if (!response.ok) return;
    const patient = await response.json();
    if (typeof patient.username !== "string" || !patient.username) return;
    banner.textContent = `Welcome, ${patient.username}!`;
    banner.hidden = false;
  } catch (error) {
    console.warn("Could not load patient welcome message.");
  }
})();
