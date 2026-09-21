// Apply saved public branding before revealing account pages.
(async function applyAccountTheme() {
  const root = document.documentElement;
  const reveal = () => root.classList.add('mq-theme-ready');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  try {
    const response = await fetch('/api/portal-settings', { cache: 'no-store', signal: controller.signal });
    if (!response.ok) throw new Error('Branding request failed');
    const payload = await response.json();
    const s = payload.portalSettings || {};
    const colors = { primaryColor:'--account-primary', secondaryColor:'--account-secondary', backgroundColor:'--account-bg', cardColor:'--account-card', textColor:'--account-text', buttonTextColor:'--account-button-text' };
    for (const [key, variable] of Object.entries(colors)) {
      if (typeof s[key] === 'string' && /^#[0-9a-f]{6}$/i.test(s[key])) root.style.setProperty(variable, s[key]);
    }
    const radius = {pill:'999px',square:'0px',soft:'6px',rounded:'10px'};
    root.style.setProperty('--account-button-radius',radius[s.buttonStyle] || '10px');
    root.style.setProperty('--account-radius',s.cardStyle === 'outline' ? '4px' : '18px');
    if (typeof s.systemName === 'string' && s.systemName.trim()) {
      const brand = document.getElementById('brandName');
      if (brand) brand.textContent = s.systemName.trim();
    }
    const logo = document.getElementById('accountBrandLogo');
    if (logo && typeof s.logoDataUrl === 'string' && /^data:image\//.test(s.logoDataUrl)) {
      await new Promise(resolve => {
        const image = new Image();
        const done = () => { logo.src = s.logoDataUrl; logo.hidden = false; resolve(); };
        image.onload = done;
        image.onerror = resolve;
        image.src = s.logoDataUrl;
        if (image.complete) done();
      });
    }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta && /^#[0-9a-f]{6}$/i.test(s.primaryColor || '')) meta.content = s.primaryColor;
  } catch (error) {
    console.warn('Account branding unavailable; using fallback theme:', error.message);
  } finally {
    clearTimeout(timeout);
    reveal();
  }
})();
