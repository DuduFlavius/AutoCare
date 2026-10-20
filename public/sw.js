// Intentionally no cache of private pages, API data or attachments.
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('push',event=>{let data={title:'AutoCare',body:'Ai un memento nou în cont.'};try{data=event.data.json();}catch{}event.waitUntil(self.registration.showNotification(data.title,{body:data.body,tag:data.id||'autocare-reminder',renotify:false,icon:'/icon-192.png',data:{url:'/cont?tab=Notificări'}}));});
self.addEventListener('notificationclick',event=>{event.notification.close();event.waitUntil(self.clients.openWindow('/cont?tab=Notific%C4%83ri'));});
