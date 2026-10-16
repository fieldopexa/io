(function(){
'use strict';
const standalone=()=>window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
let promptEvent=null,registration=null,reloading=false;
const button=document.createElement('button');button.type='button';button.className='pwa-install-button';button.textContent='Install app';button.setAttribute('aria-label','Install this app on your phone');
const dialog=document.createElement('dialog');dialog.className='pwa-install-dialog';dialog.setAttribute('aria-labelledby','pwa-install-title');
const title=document.createElement('h2');title.id='pwa-install-title';title.textContent='Keep Opexa on your phone';
const text=document.createElement('p');const action=document.createElement('button');action.type='button';action.textContent='Got it';action.addEventListener('click',()=>dialog.close());dialog.append(title,text,action);document.body.append(button,dialog);
function help(message){text.textContent=message;if(!dialog.open)dialog.showModal();}
function show(){button.hidden=standalone()&&!registration?.waiting;button.textContent=registration?.waiting?'New version available':'Install app';}
button.addEventListener('click',async()=>{
 if(registration?.waiting){help('A new version is ready. Save your visit or other unfinished work before reloading.');action.textContent='Reload app';action.onclick=()=>{reloading=true;registration.waiting?.postMessage({type:'SKIP_WAITING'});dialog.close();};return;}
 action.textContent='Got it';action.onclick=null;
 if(location.protocol!=='https:'&&location.hostname!=='localhost'){help('To install, open the HTTPS app link on your phone. Installation is not available from a local HTML file.');return;}
 if(promptEvent){const event=promptEvent;promptEvent=null;try{await event.prompt();await event.userChoice;}catch(error){help('Open your browser menu and choose Install app or Add to Home screen.');}show();return;}
 const ios=/iPhone|iPad|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
 help(ios?'Open this page in Safari. Tap Share, then Add to Home Screen. Enable Open as Web App if offered, then tap Add.':'Open this page in Chrome on Android. In the browser menu, choose Install app or Add to Home screen. On a computer, use the browser’s install option.');
});
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();promptEvent=event;show();});window.addEventListener('appinstalled',()=>{promptEvent=null;show();});
window.matchMedia('(display-mode: standalone)').addEventListener('change',show);
if('serviceWorker' in navigator&&window.isSecureContext&&location.protocol!=='file:'){
 navigator.serviceWorker.addEventListener('controllerchange',()=>{if(reloading)location.reload();});
 navigator.serviceWorker.register('./sw.js',{scope:'./',updateViaCache:'none'}).then(reg=>{registration=reg;show();reg.addEventListener('updatefound',()=>{const worker=reg.installing;worker?.addEventListener('statechange',()=>{if(worker.state==='installed')show();});});}).catch(()=>{button.title='Installation setup could not load. Reconnect and refresh to try again.';});
}
show();
})();
