'use strict';
const CACHE_PREFIX='opexa-io-shell-';
const CACHE=CACHE_PREFIX+'20261028-comms-v4-mobile';
const ROOT=new URL('./',self.location.href);
/* Firebase Cloud Messaging support in FSM's EXISTING service worker.
   Data-only push is displayed only after the user has opted in with a public
   VAPID key and a trusted Apps Script sender has been configured. */
try {
  importScripts('https://www.gstatic.com/firebasejs/11.10.0/firebase-app-compat.js');
  importScripts('https://www.gstatic.com/firebasejs/11.10.0/firebase-messaging-compat.js');
  firebase.initializeApp({
    apiKey:'AIzaSyBckNf_qQUMCRXP9qw9YboUWwmsgmAyDxs',
    authDomain:'opexa-fsm-chat.firebaseapp.com',
    projectId:'opexa-fsm-chat',
    messagingSenderId:'559812878681',
    appId:'1:559812878681:web:90aa39609c026216f76c48'
  });
  firebase.messaging().onBackgroundMessage(payload=>{
    const data=payload?.data||{};
    if(data.kind!=='fsm_chat')return;
    return self.registration.showNotification(data.title||'New FSM message',{
      body:data.body||'Open FSM to read your message',
      icon:new URL('./icons/icon-192.png',ROOT).href,
      badge:new URL('./icons/icon-192.png',ROOT).href,
      tag:'fsm-chat-'+(data.roomId||'engineering'),
      data:{roomId:data.roomId||'engineering'}
    });
  });
}catch(error){
  // Offline installation still works; FCM is optional and requires setup.
  console.warn('FSM push messaging is not active:',error.message);
}
self.addEventListener('notificationclick',event=>{
  const roomId=event.notification?.data?.roomId||'engineering';
  event.notification.close();
  const url=new URL('./',ROOT);
  url.searchParams.set('chat',roomId);
  event.waitUntil((async()=>{
    const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    const target=windows.find(client=>client.url.startsWith(ROOT.href));
    if(target){await target.focus();target.postMessage({type:'FSM_CHAT_OPEN',roomId});}
    else await self.clients.openWindow(url.href);
  })());
});

const SHELL=['./','./index.html','./chat-config.js','./live-chat.js','./live-chat.css','./service-form.js','./log-filters.js','./visit-feedback.js','./report-overview.css','./report-overview.js','./weekly-activities.css','./weekly-activities.js','./cabinet-registry.css','./cabinet-registry.js','./movement-list.css','./movement-list.js','./bulk-warehouse.css','./bulk-warehouse.js','./bulk-delete.js','./bulk-delete.css','./quality-polish.css','./quality-polish.js','./service-form-reference.png','./manifest.webmanifest','./install.js','./install.css','./icons/icon-192.png','./icons/icon-512.png','./icons/icon-maskable-512.png','./icons/apple-touch-icon.png'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL.map(file=>new Request(new URL(file,ROOT),{cache:'reload'})))));});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{for(const name of await caches.keys())if(name.startsWith(CACHE_PREFIX)&&name!==CACHE)await caches.delete(name);await self.clients.claim();})());});
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting();});
let checkingUpdate=false;
self.addEventListener('message',event=>{
 if(event.data?.type!=='SAFE_SKIP_WAITING'||checkingUpdate)return;
 checkingUpdate=true;
 event.waitUntil((async()=>{
  try{
   const pages=await self.clients.matchAll({type:'window',includeUncontrolled:true});
   const scoped=pages.filter(page=>page.url.startsWith(ROOT.href));
   const ready=await Promise.all(scoped.map(page=>new Promise(resolve=>{
    const channel=new MessageChannel();
    const finish=value=>{clearTimeout(timer);channel.port1.close();resolve(value);};
    const timer=setTimeout(()=>finish(false),2000);
    channel.port1.onmessage=reply=>finish(reply.data?.ready===true);
    try{page.postMessage({type:'UPDATE_READINESS'},[channel.port2]);}catch{finish(false);}
   })));
   if(ready.every(Boolean))await self.skipWaiting();
  }finally{checkingUpdate=false;}
 })());
});
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 // Never cache API calls, external attachments or requests outside this app.
 if(request.method!=='GET'||url.origin!==ROOT.origin||!url.pathname.startsWith(ROOT.pathname))return;
 const shellUrls=new Set(SHELL.map(file=>new URL(file,ROOT).href));
 const home=url.pathname===ROOT.pathname||url.pathname===new URL('index.html',ROOT).pathname;
 if(request.mode==='navigate'&&home){event.respondWith((async()=>{const cache=await caches.open(CACHE);try{const response=await fetch(request);if(response.ok)await cache.put(new URL('./index.html',ROOT),response.clone());if(response.ok)return response;const cached=await cache.match(new URL('./index.html',ROOT));return cached||response;}catch(error){return (await cache.match(new URL('./index.html',ROOT)))||Response.error();}})());return;}
 if(shellUrls.has(url.href)){event.respondWith((async()=>{const cache=await caches.open(CACHE),cached=await cache.match(request);return cached||fetch(request);})());}
});
