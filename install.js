(function(){
'use strict';
const standalone=()=>window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
let promptEvent=null,registration=null,reloading=false,dirty=false,pendingReload=false;
const hadController=!!navigator.serviceWorker?.controller;
function safeToUpdate(){
 return !dirty&&!document.querySelector('dialog[open],#panel-log.active,.syncing-btn,[aria-busy="true"],.attachment-upload-dock.show')&&
   !document.activeElement?.matches('input,textarea,select,[contenteditable="true"]');
}
function applyUpdate(){
 if(!safeToUpdate())return;
 if(pendingReload&&!reloading){reloading=true;location.reload();return;}
 registration?.waiting?.postMessage({type:'SAFE_SKIP_WAITING'});
}
document.addEventListener('input',event=>{
 if(event.target.closest('form,#panel-log,dialog'))dirty=true;
});
document.addEventListener('change',event=>{
 if(event.target.closest('form,#panel-log,dialog'))dirty=true;
});
window.addEventListener('visit-committed',()=>{dirty=false;});
document.addEventListener('click',event=>{
 if(event.target.closest('#logout-btn,#mobile-logout-btn'))return;
 setTimeout(applyUpdate,0);
});
const button=document.createElement('button');button.type='button';button.className='pwa-install-button';button.textContent='Install app';button.setAttribute('aria-label','Install this app on your phone');
const dialog=document.createElement('dialog');dialog.className='pwa-install-dialog';dialog.setAttribute('aria-labelledby','pwa-install-title');
const title=document.createElement('h2');title.id='pwa-install-title';title.textContent='Keep Opexa on your phone';
const text=document.createElement('p');const action=document.createElement('button');action.type='button';action.textContent='Got it';action.addEventListener('click',()=>dialog.close());dialog.append(title,text,action);document.body.append(button,dialog);
function help(message){text.textContent=message;if(!dialog.open)dialog.showModal();}
function show(){button.hidden=standalone();button.textContent='Install app';}
button.addEventListener('click',async()=>{
 action.textContent='Got it';action.onclick=null;
 if(location.protocol!=='https:'&&location.hostname!=='localhost'){help('To install, open the HTTPS app link on your phone. Installation is not available from a local HTML file.');return;}
 if(promptEvent){const event=promptEvent;promptEvent=null;try{await event.prompt();await event.userChoice;}catch(error){help('Open your browser menu and choose Install app or Add to Home screen.');}show();return;}
 const ios=/iPhone|iPad|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
 help(ios?'Open this page in Safari. Tap Share, then Add to Home Screen. Enable Open as Web App if offered, then tap Add.':'Open this page in Chrome on Android. In the browser menu, choose Install app or Add to Home screen. On a computer, use the browser’s install option.');
});
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();promptEvent=event;show();});window.addEventListener('appinstalled',()=>{promptEvent=null;show();});
window.matchMedia('(display-mode: standalone)').addEventListener('change',show);
if('serviceWorker' in navigator&&window.isSecureContext&&location.protocol!=='file:'){
 navigator.serviceWorker.addEventListener('message',event=>{
  if(event.data?.type==='UPDATE_READINESS')event.ports[0]?.postMessage({ready:safeToUpdate()});
 });
 navigator.serviceWorker.addEventListener('controllerchange',()=>{if(hadController){pendingReload=true;applyUpdate();}});
 navigator.serviceWorker.register('./sw.js',{scope:'./',updateViaCache:'none'}).then(reg=>{
  registration=reg;show();applyUpdate();
  reg.addEventListener('updatefound',()=>{const worker=reg.installing;worker?.addEventListener('statechange',()=>{if(worker.state==='installed')applyUpdate();});});
 }).catch(()=>{button.title='Installation setup could not load. Reconnect and refresh to try again.';});
 setInterval(applyUpdate,15000);
 const check=()=>{if(document.visibilityState==='visible'){registration?.update().catch(()=>{});applyUpdate();}};
 window.addEventListener('online',check);window.addEventListener('focus',check);document.addEventListener('visibilitychange',check);
}
show();
})();
