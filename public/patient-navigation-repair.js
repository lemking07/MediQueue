(() => {
  function init() {
    const screen = document.getElementById('patient-language-screen');
    const nav = document.getElementById('mq-account-nav');
    const toggle = document.getElementById('mq-menu-toggle');
    const openLanguage = document.getElementById('mq-change-language');
    if (!screen || !nav || !toggle || !openLanguage) return;
    const mobile = () => window.matchMedia('(max-width: 900px)').matches;
    function setOpen(open) {
      document.body.classList.toggle('mq-patient-sidebar-collapsed', !open);
      nav.classList.toggle('mq-menu-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Hide patient sidebar' : 'Show patient sidebar');
    }
    setOpen(!mobile());
    window.addEventListener('resize', () => setOpen(!mobile()), { passive: true });
    toggle.addEventListener('click', () => setOpen(document.body.classList.contains('mq-patient-sidebar-collapsed')));
    openLanguage.addEventListener('click', () => {
      screen.hidden = false;
      screen.style.display = 'flex';
      document.body.classList.remove('dashboard-loading');
      if (mobile()) setOpen(false);
    });
    screen.querySelectorAll('button[data-language]').forEach(button => {
      button.addEventListener('click', event => {
        const lang = button.dataset.language;
        if (!['en', 'ms', 'zh', 'ta'].includes(lang)) return;
        // Prevent older language listeners from reopening the overlay or overriding this state.
        event.stopImmediatePropagation();
        sessionStorage.setItem('mediqueue_patient_language', lang);
        localStorage.setItem('mediqueue_language', lang);
        if (window.MediQueueI18n) window.MediQueueI18n.setLanguage(lang);
        document.documentElement.lang = lang;
        screen.hidden = true;
        screen.style.display = 'none';
        document.body.classList.remove('dashboard-loading');
        if (typeof translatePatientPortal === 'function') translatePatientPortal();
        if (window.MediQueueI18n) window.MediQueueI18n.translate();
      }, true);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
