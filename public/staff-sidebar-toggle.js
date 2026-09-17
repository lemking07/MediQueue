// Desktop collapse control; original mobile drawer remains unchanged.
(() => {
  function init() {
    const button = document.getElementById('mobile-sidebar-button');
    const close = document.getElementById('sidebar-close');
    const body = document.body;
    if (!button || !close) return;
    const desktop = () => window.matchMedia('(min-width: 901px)').matches;
    function sync() {
      if (desktop()) {
        body.classList.remove('sidebar-open');
        button.setAttribute('aria-expanded', String(!body.classList.contains('mq-sidebar-collapsed')));
        button.setAttribute('aria-label', body.classList.contains('mq-sidebar-collapsed') ? 'Show staff sidebar' : 'Hide staff sidebar');
      } else {
        body.classList.remove('mq-sidebar-collapsed');
        button.setAttribute('aria-expanded', String(body.classList.contains('sidebar-open')));
        button.setAttribute('aria-label', 'Open staff menu');
      }
    }
    button.addEventListener('click', () => {
      if (!desktop()) return;
      body.classList.toggle('mq-sidebar-collapsed');
      sync();
    });
    close.addEventListener('click', () => {
      if (!desktop()) return;
      body.classList.add('mq-sidebar-collapsed');
      sync();
    });
    window.addEventListener('resize', sync);
    sync();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
