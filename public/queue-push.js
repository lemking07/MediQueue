/* Separate opt-in for OS alerts. Foreground audio still uses Enable alerts. */
(()=>{
 const start=()=>{
  const anchor=document.getElementById('enable-sound-button');
  if(!anchor)return;
  const button=document.createElement('button');button.type='button';button.className=anchor.className;
  button.textContent='Enable phone notifications';anchor.insertAdjacentElement('afterend',button);
  const note=document.createElement('p');note.setAttribute('role','status');note.style.fontSize='0.9rem';button.after(note);
  let reg;
  const supported=window.isSecureContext && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  if(!supported){button.disabled=true;note.textContent='Phone alerts are unavailable in this browser. Keep the queue page open for alerts.';return;}
  const ready=navigator.serviceWorker.register('/queue-alert-sw.js').then(()=>navigator.serviceWorker.ready).then(r=>reg=r);
  ready.catch(()=>{note.textContent='Could not prepare phone alerts. Reload and try again.';});
  async function api(path,body){const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});if(!r.ok)throw Error('Could not save alerts. Please log in and try again.');}
  button.onclick=async()=>{
   button.disabled=true;
   try{
    // Request directly from the click, before network work.
    const permission=Notification.permission==='granted'?'granted':await Notification.requestPermission();
    if(permission!=='granted')throw Error('Notifications are blocked. Allow them in Chrome site settings, then try again.');
    await ready;
    let sub=await reg.pushManager.getSubscription();
    if(button.dataset.enabled==='yes' && sub){await api('/api/patient/push-disable',{endpoint:sub.endpoint});await sub.unsubscribe();button.dataset.enabled='';button.textContent='Enable phone notifications';note.textContent='Phone notifications disabled on this device.';return;}
    const r=await fetch('/api/patient/push-key');if(!r.ok)throw Error('Please log in again.');const {publicKey}=await r.json();
    const key=Uint8Array.from(atob(publicKey.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
    if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key});
    await api('/api/patient/push-subscription',sub.toJSON());
    button.dataset.enabled='yes';button.textContent='Disable phone notifications';
    note.textContent='Phone notifications enabled. Allow sound, vibration and pop-up banners in your phone settings. Stay signed in.';
   }catch(e){note.textContent=e.message;}finally{button.disabled=false;}
  };
 };
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
