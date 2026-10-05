(()=>{
 window.mqStaffConfirm=({title,message,accept='Confirm'})=>new Promise(resolve=>{
  const previous=document.activeElement,dialog=document.createElement('dialog');
  dialog.style.cssText='width:min(440px,90vw);border:0;border-radius:20px;padding:26px;background:var(--account-card,#fff);color:var(--account-text,#222);box-shadow:0 20px 80px #0005;font:inherit';
  const heading=document.createElement('h2');heading.id='staff-confirm-title';heading.textContent=title;
  const text=document.createElement('p');text.textContent=message;text.style.lineHeight='1.6';
  const actions=document.createElement('div');actions.style.cssText='display:flex;justify-content:flex-end;gap:12px;margin-top:24px';
  let done=false;const finish=value=>{if(done)return;done=true;dialog.close();dialog.remove();previous?.focus();resolve(value);};
  const cancel=document.createElement('button');cancel.type='button';cancel.textContent='Cancel';cancel.onclick=()=>finish(false);
  const ok=document.createElement('button');ok.type='button';ok.textContent=accept;ok.onclick=()=>finish(true);
  for(const b of [cancel,ok])b.style.cssText='padding:12px 20px;border:1px solid #aaa5;border-radius:10px;font:inherit;cursor:pointer';
  ok.style.background='var(--account-primary,#7047e8)';ok.style.color='var(--account-button-text,#fff)';
  actions.append(cancel,ok);dialog.append(heading,text,actions);dialog.setAttribute('aria-labelledby',heading.id);
  dialog.addEventListener('cancel',e=>{e.preventDefault();finish(false)});document.body.append(dialog);dialog.showModal();cancel.focus();
 });
})();
