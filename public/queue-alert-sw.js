// No page caching: every page continues to load the current deployed theme/code.
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('push',event=>event.waitUntil((async()=>{
  let data;try{data=event.data.json();}catch{return;}
  if(!data || Date.now()-data.sentAt>60000) return;
  await self.registration.showNotification(data.title||'MediQueue',{
    body:data.body,tag:data.tag||'mediqueue-call',renotify:true,
    requireInteraction:true,vibrate:[500,200,500,200,800],
    data:{url:'/patient.html'},actions:[{action:'open',title:'View my queue'}]
  });
})()));
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  event.waitUntil((async()=>{
    const target=new URL('/patient.html',self.location.origin).href;
    const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    for(const client of windows) {
      if(client.url.startsWith(target)) {await client.focus();await client.navigate(target);return;}
    }
    await self.clients.openWindow(target);
  })());
});
