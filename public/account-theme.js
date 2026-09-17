// Share the Staff Dashboard's public patient-portal theme with account pages.
(async function applyAccountTheme(){
  try {
    const response=await fetch('/api/portal-settings',{cache:'no-store'});
    if(!response.ok)return;
    const payload=await response.json();
    const s=payload.portalSettings||{};
    const root=document.documentElement;
    const colors={primaryColor:'--account-primary',secondaryColor:'--account-secondary',backgroundColor:'--account-bg',cardColor:'--account-card',textColor:'--account-text',buttonTextColor:'--account-button-text'};
    for(const [key,variable] of Object.entries(colors)){
      if(typeof s[key]==='string'&&/^#[0-9a-f]{6}$/i.test(s[key]))root.style.setProperty(variable,s[key]);
    }
    if(s.buttonStyle==='pill')root.style.setProperty('--account-button-radius','999px');
    else if(s.buttonStyle==='square')root.style.setProperty('--account-button-radius','0px');
    else if(s.buttonStyle==='soft')root.style.setProperty('--account-button-radius','6px');
    if(s.cardStyle==='outline')root.style.setProperty('--account-radius','4px');
    if(typeof s.systemName==='string'&&s.systemName.trim()){
      const brand=document.getElementById('brandName');
      if(brand)brand.textContent=s.systemName.trim();
    }
    const meta=document.querySelector('meta[name="theme-color"]');
    if(meta&&typeof s.primaryColor==='string'&&/^#[0-9a-f]{6}$/i.test(s.primaryColor))meta.content=s.primaryColor;
  }catch(error){console.warn('Using default account theme:',error.message);}
})();
