/* FSM Live Chat v1.0. Separate Firebase login, no changes to FSM sign-in. */
(() => {
  'use strict';
  const cfg=window.FSM_CHAT_FIREBASE_CONFIG;
  const app=document.getElementById('app-shell');
  if(!app) return;
  const host=document.getElementById('fsm-live-chat');
  if(!host)return;
  host.hidden=true;
  host.innerHTML=`<button type="button" id="fsm-chat-launcher" aria-expanded="false" aria-controls="fsm-chat-panel">💬 Team Chat <span id="fsm-chat-badge" hidden></span></button>
    <div id="fsm-chat-panel" hidden role="dialog" aria-label="FSM live chat">
      <div class="fsm-chat-top"><div><strong>Team Chat</strong><small id="fsm-chat-subtitle">Engineering communications</small></div>
        <div class="fsm-chat-actions"><button type="button" class="fsm-chat-icon-button" id="fsm-chat-signout" title="Sign out of chat" hidden>↪</button><button type="button" class="fsm-chat-icon-button" id="fsm-chat-close" aria-label="Close chat">✕</button></div></div>
      <div class="fsm-chat-body" id="fsm-chat-content"><div class="fsm-chat-gate"><h3>Team Chat</h3><p>Loading chat…</p></div></div>
    </div>`;
  const el=id=>document.getElementById(id);
  el('fsm-chat-panel').hidden=false; // Embedded panel is controlled by FSM's existing tab navigation.
  const launcher=el('fsm-chat-launcher'),panel=el('fsm-chat-panel'),content=el('fsm-chat-content');
  const escapeHtml=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const state={auth:null,db:null,lib:null,user:null,member:null,profiles:[],room:'engineering',unsubMessages:null,unsubMembers:null,unsubActivity:null,unread:{},lastSeen:{},messages:[],loading:false};
  const STATUS='fsm-chat-seen-v1';
  try{state.lastSeen=JSON.parse(localStorage.getItem(STATUS)||'{}');}catch{}
  const isOpen=()=>!!document.getElementById('panel-chat')?.classList.contains('active');
  const roomId=(a,b)=>'dm_'+[a,b].sort().join('_');
  function openToggle(force){if(force===false&&isOpen())document.querySelector('.tab[data-tab="dashboard"]')?.click();}
  el('fsm-chat-close').addEventListener('click',()=>openToggle(false));
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&isOpen())openToggle(false);});
  function gate(title,description,form=''){
    content.innerHTML=`<div class="fsm-chat-gate"><h3>${escapeHtml(title)}</h3><p>${escapeHtml(description)}</p>${form}<div id="fsm-chat-status" role="status"></div></div>`;
  }
  function setStatus(s){const n=el('fsm-chat-status');if(n)n.textContent=s;}
  function syncVisible(){const visible=app.style.display!=='none'&&!!document.getElementById('logged-user')?.textContent?.trim()&&document.getElementById('logged-user')?.textContent!=='—';host.hidden=!visible;}
  new MutationObserver(syncVisible).observe(app,{attributes:true,attributeFilter:['style']});
  syncVisible();
  function persistSeen(){try{localStorage.setItem(STATUS,JSON.stringify(state.lastSeen));}catch{}}
  function updateUnread(){
    const total=Object.values(state.unread).reduce((a,b)=>a+b,0),badge=el('fsm-chat-badge');
    badge.hidden=!total;badge.textContent=total>99?'99+':String(total);
    for(const id of ['fsm-chat-nav-badge','fsm-chat-mobile-badge']){const n=el(id);if(n){n.hidden=!total;n.textContent=total>99?'99+':String(total);}}
    launcher.title=total?`${total} unread chat messages`:'Team Chat';
  }
  function roomName(){if(state.room==='engineering')return'Engineering Team';return state.profiles.find(p=>roomId(p.uid,state.user.uid)===state.room)?.name||'Direct message';}
  function markRead(){if(!state.user)return;state.lastSeen[state.room]=Date.now();state.unread[state.room]=0;persistSeen();updateUnread();renderContacts();}
  async function loadSdk(){
    if(state.lib)return state.lib;
    if(!cfg||!cfg.apiKey||!cfg.projectId||!cfg.appId)throw new Error('Firebase is not configured yet. Follow docs/FSM-LIVE-CHAT-SETUP.md.');
    const [appMod,authMod,storeMod]=await Promise.all([
      import('https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js'),
      import('https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js')]);
    const fb=appMod.initializeApp(cfg,'fsm-team-chat');
    state.auth=authMod.getAuth(fb);state.db=storeMod.getFirestore(fb);
    await authMod.setPersistence(state.auth,authMod.browserLocalPersistence);
    return state.lib={...authMod,...storeMod};
  }
  function showLogin(message='Use your approved team chat account. Your device remembers this sign-in.'){
    stopListeners();el('fsm-chat-signout').hidden=true;
    gate('Sign in to Team Chat',message,`<form id="fsm-chat-login-form"><input type="email" name="email" aria-label="Email" placeholder="Work email" autocomplete="email" required><input type="password" name="password" aria-label="Password" placeholder="Password" autocomplete="current-password" required minlength="6"><button type="submit">Sign in</button></form>`);
    el('fsm-chat-login-form').addEventListener('submit',async e=>{
      e.preventDefault();const form=e.currentTarget,button=form.querySelector('button');button.disabled=true;setStatus('Signing in…');
      try{await state.lib.signInWithEmailAndPassword(state.auth,form.elements.namedItem('email').value.trim(),form.elements.namedItem('password').value);}catch(err){setStatus('Unable to sign in. Check your account or ask the administrator.');button.disabled=false;}
    });
  }
  function stopListeners(){state.unsubMessages?.();state.unsubMembers?.();state.unsubActivity?.();state.unsubMessages=state.unsubMembers=state.unsubActivity=null;}
  function renderContacts(){
    const list=el('fsm-chat-contacts');if(!list||!state.user)return;
    const options=[{id:'engineering',name:'Engineering Team'},...state.profiles.filter(p=>p.uid!==state.user.uid&&p.active===true).map(p=>({id:roomId(state.user.uid,p.uid),name:p.name||p.email||'Teammate'}))];
    list.innerHTML='<div class="fsm-chat-caption">Conversations</div>'+options.map(x=>`<button type="button" class="fsm-chat-contact ${state.room===x.id?'active':''}" data-chat-room="${escapeHtml(x.id)}"><span>${escapeHtml(x.name)}</span>${state.unread[x.id]?`<span class="fsm-chat-count">${state.unread[x.id]}</span>`:''}</button>`).join('');
    list.querySelectorAll('[data-chat-room]').forEach(b=>b.onclick=()=>selectRoom(b.dataset.chatRoom));
  }
  function renderMessages(){
    const node=el('fsm-chat-messages');if(!node)return;const atBottom=node.scrollHeight-node.scrollTop-node.clientHeight<85;
    node.replaceChildren();
    if(!state.messages.length){node.innerHTML='<div class="fsm-chat-empty">No messages yet. Start the conversation.</div>';return;}
    for(const msg of state.messages){
      const mine=msg.senderId===state.user?.uid;
      const item=document.createElement('div');item.className='fsm-chat-message'+(mine?' mine':'');
      const by=document.createElement('div');by.className='fsm-chat-byline';by.textContent=mine?'You':msg.senderName||'Teammate';
      const body=document.createElement('div');body.className='fsm-chat-text';body.textContent=msg.text||'';
      const stamp=document.createElement('div');stamp.className='fsm-chat-stamp';stamp.textContent=msg.createdAt?.toDate?msg.createdAt.toDate().toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}):'Sending…';
      item.append(by,body,stamp);node.append(item);
    }
    if(atBottom)node.scrollTop=node.scrollHeight;
  }
  function selectRoom(id){
    if(!state.user||!id)return;
    state.unsubMessages?.();state.room=id;state.messages=[];renderContacts();
    el('fsm-chat-thread-head').textContent=roomName();renderMessages();
    const {collection,query,orderBy,limit,onSnapshot}=state.lib;
    state.unsubMessages=onSnapshot(query(collection(state.db,'chatRooms',id,'messages'),orderBy('createdAt','desc'),limit(100)),snap=>{
      state.messages=snap.docs.map(d=>({id:d.id,...d.data()})).reverse();renderMessages();
      if(isOpen())markRead();
    },()=>{const n=el('fsm-chat-messages');if(n)n.innerHTML='<div class="fsm-chat-empty">Unable to load messages. Contact the administrator.</div>';});
  }
  async function sendMessage(e){
    e.preventDefault();if(state.loading||!state.user||!state.member?.active)return;
    const input=el('fsm-chat-input'),text=input.value.trim();if(!text||text.length>2000)return;
    const {collection,doc,writeBatch,serverTimestamp}=state.lib;
    state.loading=true;el('fsm-chat-send').disabled=true;
    try{
      const messageRef=doc(collection(state.db,'chatRooms',state.room,'messages'));const batch=writeBatch(state.db);batch.set(messageRef,{text,senderId:state.user.uid,senderName:state.member.name||state.user.email,createdAt:serverTimestamp()});batch.set(doc(state.db,'chatActivity',state.room),{senderId:state.user.uid,updatedAt:serverTimestamp()});await batch.commit();
      input.value='';markRead();
    }catch(err){const n=el('fsm-chat-error');n.textContent='Message not sent. Check your connection or permissions.';}
    finally{state.loading=false;el('fsm-chat-send').disabled=false;input.focus();}
  }
  async function startChat(user){
    const {doc,getDoc,collection,onSnapshot,query,limit,orderBy}=state.lib;
    const self=await getDoc(doc(state.db,'chatMembers',user.uid));
    if(!self.exists()||self.data().active!==true){gate('Access pending','Your chat account has not been approved. Ask the administrator to add your Firebase User UID to chatMembers.');el('fsm-chat-signout').hidden=false;return;}
    state.user=user;state.member=self.data();el('fsm-chat-signout').hidden=false;
    content.innerHTML=`<aside class="fsm-chat-contacts" id="fsm-chat-contacts"></aside><div class="fsm-chat-thread"><div class="fsm-chat-thread-head" id="fsm-chat-thread-head"></div><div class="fsm-chat-messages" id="fsm-chat-messages" aria-live="polite"></div><form class="fsm-chat-compose" id="fsm-chat-compose"><input id="fsm-chat-input" maxlength="2000" placeholder="Write a message…" aria-label="Message" autocomplete="off" required><button id="fsm-chat-send" class="fsm-chat-send" type="submit">Send</button></form><div id="fsm-chat-error" role="status" style="padding:0 12px;color:#ffb3a4;font-size:11px"></div></div>`;
    el('fsm-chat-compose').addEventListener('submit',sendMessage);
    state.unsubMembers=onSnapshot(collection(state.db,'chatMembers'),snap=>{
      state.profiles=snap.docs.map(d=>({uid:d.id,...d.data()})).filter(p=>p.active===true);
      const me=state.profiles.find(p=>p.uid===user.uid);if(!me){stopListeners();gate('Access disabled','Contact your FSM administrator.');return;}
      state.member=me;renderContacts();
    },()=>{});
    selectRoom(state.room);
    // Lightweight room activity badges while the app is open, even if chat is minimized.
    state.unsubActivity=onSnapshot(query(collection(state.db,'chatActivity'),orderBy('updatedAt','desc'),limit(100)),snap=>{
      for(const entry of snap.docs){const data=entry.data();const id=entry.id;
        if(id!=='engineering'&&!state.profiles.some(p=>p.uid!==user.uid&&roomId(user.uid,p.uid)===id))continue;
        const millis=data.updatedAt?.toMillis?.()||0;
        state.unread[id]=(data.senderId!==user.uid&&millis>(state.lastSeen[id]||0))?1:0;
      }
      updateUnread();renderContacts();
    },()=>{});
  }
  el('fsm-chat-signout').addEventListener('click',async()=>{stopListeners();state.user=null;await state.lib.signOut(state.auth);});
  document.querySelector('.tab[data-tab="chat"]')?.addEventListener('click',()=>{if(state.user)markRead();launcher.click();});
  launcher.addEventListener('click',async()=>{
    if(state.auth||state.booting)return;state.booting=true;
    try{
      gate('Connecting','Loading secure chat…');await loadSdk();
      state.lib.onAuthStateChanged(state.auth,async user=>{
        stopListeners();if(!user){state.user=null;showLogin();return;}
        try{await startChat(user);}catch(err){gate('Chat unavailable','Unable to load the team directory. Check connection and Firestore rules.');el('fsm-chat-signout').hidden=false;}
      });
    }catch(err){gate('Setup needed',err.message||'Unable to initialize chat.');}
    finally{state.booting=false;}
  });
})();
