// Independent language navigation: keep the current ticket and page state intact.
(() => {
  function setup() {
    const screen = document.getElementById('patient-language-screen');
    const open = document.getElementById('mq-change-language');
    if (!screen || !open) return;
    open.addEventListener('click', () => {
      screen.hidden = false;
      screen.style.display = 'flex';
      document.body.classList.remove('dashboard-loading');
    });
    screen.querySelectorAll('button[data-language]').forEach(button => {
      // Capture phase ensures selection works even if the older handler fails.
      button.addEventListener('click', () => {
        const lang = button.dataset.language;
        if (!['en','ms','zh','ta'].includes(lang)) return;
        sessionStorage.setItem('mediqueue_patient_language', lang);
        localStorage.setItem('mediqueue_language', lang);
        window.MediQueueI18n?.setLanguage(lang);
        document.documentElement.lang = lang;
        screen.hidden = true;
        screen.style.display = 'none';
        document.body.classList.remove('dashboard-loading');
      }, true);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup);
  else setup();
})();
