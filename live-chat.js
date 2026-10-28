/* FSM Live Chat v1.1. Uses session-validated FSM SSO through Firebase custom authentication. */
(() => {
  'use strict';
  const cfg=window.FSM_CHAT_FIREBASE_CONFIG;
  const app=document.getElementById('app-shell');
  if(!app) return;
  const host=document.getElementById('fsm-live-chat');
  if(!host)return;
  host.hidden=true;
  host.innerHTML='<button type="button" id="fsm-chat-launcher" hidden aria-label="Open messages"></button>'
    +'<div id="fsm-chat-panel" aria-label="FSM communications">'
    +'<div class="fsm-chat-body" id="fsm-chat-content"><div class="fsm-chat-gate"><h3>Connecting</h3><p>Loading your messages…</p></div></div>'
    +'</div><div id="fsm-chat-toast" hidden role="status" aria-live="polite"></div>';

  const el=id=>document.getElementById(id);
  el('fsm-chat-panel').hidden=false; // Embedded in FSM Operations navigation.
  const launcher=el('fsm-chat-launcher'),panel=el('fsm-chat-panel'),content=el('fsm-chat-content');
  const escapeHtml=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const state={auth:null,db:null,lib:null,user:null,member:null,profiles:[],room:'engineering',unsubMessages:null,unsubMembers:null,unsubActivity:null,unsubPresence:null,unsubPreviews:new Map(),previewReady:{},preview:{},unread:{},lastSeen:{},presence:{},messages:[],filter:'',editingId:null,loading:false,booting:false,presenceTimer:null,firebaseApp:null,messaging:null,pushLib:null,pushEnabled:false,pushToken:null,pushTokenRef:null};
  const defaultTitle=document.title;
  const notifyMemory=new Map();
  // Directory entries are based on confirmed existing FSM usernames, not Firebase
  // email accounts. Add future users here if you need them to appear before
  // their first chat login. Users who have already used chat appear dynamically.
  const TEAM_DIRECTORY=[
    {username:'ian',name:'Ian'},
    {username:'kenneth',name:'Kenneth'},
    {username:'erwin',name:'Erwin'},
    {username:'popoy',name:'Popoy'}
  ];
  function uidForFsmUsername(username){
    const value=String(username||'').trim().toLowerCase();
    if(!/^[a-z0-9._-]{1,64}$/.test(value))return '';
    return 'fsm_'+btoa(value).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  }
  // Keep read status separate for different FSM accounts using the same browser.
  const seenStorageKey=()=>state.user?'fsm-chat-seen-v2:'+state.user.uid:'';
  const isOpen=()=>!!document.getElementById('panel-chat')?.classList.contains('active');
  const roomId=(a,b)=>'dm~'+[a,b].sort().join('~');
  function openToggle(force){if(force===false&&isOpen())document.querySelector('.tab[data-tab="dashboard"]')?.click();}
  // Chat stays embedded in the FSM page. The normal sidebar navigates away.
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&isOpen())openToggle(false);});
  function gate(title,description,form=''){
    content.innerHTML=`<div class="fsm-chat-gate"><h3>${escapeHtml(title)}</h3><p>${escapeHtml(description)}</p>${form}<div id="fsm-chat-status" role="status"></div></div>`;
  }
  function setStatus(s){const n=el('fsm-chat-status');if(n)n.textContent=s;}
  function syncVisible(){
    const visible=app.style.display!=='none'&&!!document.getElementById('logged-user')?.textContent?.trim()&&document.getElementById('logged-user')?.textContent!=='—';
    host.hidden=!visible;
    if(visible&&!state.user&&!state.booting)setTimeout(()=>{if(!state.user&&!state.booting)launcher.click();},150);
  }
  new MutationObserver(syncVisible).observe(app,{attributes:true,attributeFilter:['style']});
  syncVisible();
  function persistSeen(){try{if(state.user)localStorage.setItem(seenStorageKey(),JSON.stringify(state.lastSeen));}catch{}}
  function chatPeople(){
    if(!state.user)return [];
    const profiles=new Map(state.profiles.map(p=>[p.uid,p]));
    const people=new Map();
    for(const entry of TEAM_DIRECTORY){
      const uid=uidForFsmUsername(entry.username);
      const profile=profiles.get(uid);
      if(!uid||uid===state.user.uid||profile?.active===false)continue;
      people.set(uid,{uid,name:entry.name,username:entry.username});
    }
    for(const profile of state.profiles){
      if(profile.uid===state.user.uid||profile.active!==true)continue;
      if(!people.has(profile.uid)){
        people.set(profile.uid,{uid:profile.uid,name:profile.name||profile.username||'Teammate',username:profile.username||''});
      }
    }
    return Array.from(people.values()).sort((a,b)=>a.name.localeCompare(b.name));
  }
  function conversations(){
    return [{id:'engineering',name:'Team Chat',type:'group',description:'Engineering group'},
      ...chatPeople().map(person=>({id:roomId(state.user.uid,person.uid),name:person.name,type:'direct',description:'Private message'}))];
  }
  function updateUnread(){
    const total=Object.values(state.unread).reduce((a,b)=>a+b,0);
    const badge=el('fsm-chat-badge');
    if(badge){badge.hidden=!total;badge.textContent=total>99?'99+':String(total);}
    for(const id of ['fsm-chat-nav-badge','fsm-chat-mobile-badge']){
      const n=el(id);if(n){n.hidden=!total;n.textContent=total>99?'99+':String(total);}
    }
    document.title=total?'('+total+') '+defaultTitle:defaultTitle;
    if(launcher)launcher.title=total?total+' unread conversations':'Team Chat';
  }
  function renderTextWithLinks(node,text){
    const raw=String(text||'');
    const regex=/https?:\/\/[^\s<>]+/gi;
    let last=0,match;
    while((match=regex.exec(raw))){
      if(match.index>last)node.append(document.createTextNode(raw.slice(last,match.index)));
      const safe=match[0];
      try{
        const url=new URL(safe);
        if(url.protocol!=='https:'&&url.protocol!=='http:')throw Error('protocol');
        const link=document.createElement('a');
        link.href=url.href;link.target='_blank';link.rel='noopener noreferrer';
        link.textContent=safe;node.append(link);
      }catch{node.append(document.createTextNode(safe));}
      last=regex.lastIndex;
    }
    if(last<raw.length)node.append(document.createTextNode(raw.slice(last)));
  }
  function relativePreview(msg){
    if(!msg)return 'Start a conversation';
    if(msg.deleted)return 'Message unsent';
    return String(msg.text||'').replace(/\s+/g,' ').slice(0,58)||'New message';
  }
  function relativeTime(stamp){
    const ms=stamp?.toMillis?.()||0;
    if(!ms)return '';
    const d=new Date(ms);
    if(new Date().toDateString()===d.toDateString())return d.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});
    return d.toLocaleDateString([],{month:'short',day:'numeric'});
  }
  function notifyIncoming(room,msg){
    if(!state.user||isOpen()&&state.room===room||msg?.senderId===state.user.uid)return;
    const last=notifyMemory.get(room);
    if(last===msg?.id)return;
    notifyMemory.set(room,msg.id);
    const person=conversations().find(c=>c.id===room);
    const label=person?.name||'A teammate';
    const toast=el('fsm-chat-toast');
    if(toast&&document.visibilityState==='visible'){
      toast.hidden=false;
      toast.textContent='New message from '+label;
      toast.onclick=()=>{document.querySelector('.tab[data-tab="chat"]')?.click();selectRoom(room);toast.hidden=true;};
      clearTimeout(state.toastTimer);
      state.toastTimer=setTimeout(()=>toast.hidden=true,5200);
    }else if(!state.pushEnabled&&'Notification' in window&&Notification.permission==='granted'){
      try{
        const notice=new Notification('New message · '+label,{
          body:'Open FSM to read your message',tag:'fsm-chat-'+room,
          icon:'./icons/icon-192.png'
        });
        notice.onclick=()=>{window.focus();document.querySelector('.tab[data-tab="chat"]')?.click();selectRoom(room);notice.close();};
      }catch(e){console.warn('Browser notification unavailable:',e);}
    }
  }
  function syncRoomPreviews(){
    if(!state.user||!state.lib)return;
    const all=new Set(conversations().map(c=>c.id));
    for(const [id,off] of state.unsubPreviews){
      if(!all.has(id)){off();state.unsubPreviews.delete(id);delete state.preview[id];delete state.unread[id];delete state.previewReady[id];}
    }
    const {query,collection,orderBy,limit,onSnapshot}=state.lib;
    for(const id of all){
      if(state.unsubPreviews.has(id))continue;
      const stream=query(collection(state.db,'chatRooms',id,'messages'),orderBy('createdAt','desc'),limit(1));
      const off=onSnapshot(stream,snap=>{
        const latest=snap.docs.length?{id:snap.docs[0].id,...snap.docs[0].data()}:null;
        const previous=state.preview[id];
        const wasReady=!!state.previewReady[id];
        state.previewReady[id]=true;
        state.preview[id]=latest;
        const ms=latest?.createdAt?.toMillis?.()||0;
        const unread=!!latest&&latest.senderId!==state.user.uid&&ms>(state.lastSeen[id]||0);
        state.unread[id]=unread?1:0;
        if(wasReady&&latest&&latest.id!==previous?.id&&unread)notifyIncoming(id,latest);
        updateUnread();renderContacts();
      },err=>console.warn('Chat preview unavailable for '+id,err.code));
      state.unsubPreviews.set(id,off);
    }
    updateUnread();renderContacts();
  }
  async function syncPresence(){
    if(!state.user||!state.member?.active||document.visibilityState!=='visible')return;
    const {doc,setDoc,serverTimestamp}=state.lib;
    try{
      await setDoc(doc(state.db,'chatPresence',state.user.uid),{uid:state.user.uid,lastSeen:serverTimestamp()});
    }catch(err){console.warn('Chat presence sync failed:',err.code);}
  }
  // Firebase Cloud Messaging is optional and uses ONLY a public VAPID key.
  // Service-account credentials never reach the browser.
  async function registerPushDevice(){
    const vapidKey=String(window.FSM_CHAT_WEB_PUSH_VAPID_KEY||'').trim();
    if(!vapidKey||!state.user||!('serviceWorker' in navigator)||!window.isSecureContext)return false;
    const module=await import('https://www.gstatic.com/firebasejs/11.10.0/firebase-messaging.js');
    if(!(await module.isSupported()))return false;
    const registration=await navigator.serviceWorker.register('./sw.js',{scope:'./'});
    await navigator.serviceWorker.ready;
    const messaging=module.getMessaging(state.firebaseApp);
    const token=await module.getToken(messaging,{vapidKey,serviceWorkerRegistration:registration});
    if(!token)return false;
    const bytes=new TextEncoder().encode(token);
    const hash=new Uint8Array(await crypto.subtle.digest('SHA-256',bytes));
    const id=Array.from(hash).map(b=>b.toString(16).padStart(2,'0')).join('');
    const {doc,setDoc,serverTimestamp}=state.lib;
    const ref=doc(state.db,'chatDevices',state.user.uid,'tokens',id);
    await setDoc(ref,{token,registeredAt:serverTimestamp(),userAgent:navigator.userAgent.slice(0,150)});
    state.messaging=messaging;state.pushLib=module;state.pushToken=token;state.pushTokenRef=ref;state.pushEnabled=true;
    return true;
  }
  async function unregisterPushDevice(){
    if(!state.pushTokenRef||!state.lib)return;
    try{await state.lib.deleteDoc(state.pushTokenRef);}catch(err){console.warn('Failed to revoke chat token document:',err.code);}
    try{await state.pushLib?.deleteToken(state.messaging);}catch(err){console.warn('Failed to revoke browser push token:',err.code);}
    state.pushEnabled=false;state.pushToken=null;state.pushTokenRef=null;
  }
  function isRecentlyActive(uid){
    const seen=state.presence[uid]?.toMillis?.()||0;
    return !!seen&&Date.now()-seen<180000;
  }
  function roomName(){return conversations().find(c=>c.id===state.room)?.name||'Direct message';}
  function markRead(){if(!state.user)return;state.lastSeen[state.room]=Date.now();state.unread[state.room]=0;persistSeen();updateUnread();renderContacts();}
  async function loadSdk(){
    if(state.lib)return state.lib;
    if(!cfg||!cfg.apiKey||!cfg.projectId||!cfg.appId)throw new Error('Firebase is not configured yet. Follow docs/FSM-LIVE-CHAT-SETUP.md.');
    const [appMod,authMod,storeMod]=await Promise.all([
      import('https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js'),
      import('https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js')]);
    const fb=appMod.initializeApp(cfg,'fsm-team-chat');
    state.firebaseApp=fb;state.auth=authMod.getAuth(fb);state.db=storeMod.getFirestore(fb);
    await authMod.setPersistence(state.auth,authMod.browserLocalPersistence);
    return state.lib={...authMod,...storeMod};
  }
  async function connectFromFSM(){
    // This must never trust display names or requested UIDs from the browser.
    // apiPost uses the existing FSM session token, which the Apps Script server validates.
    const fsmUser=(typeof currentUser!=='undefined')?currentUser:null;
    if(!fsmUser?.username)throw new Error('Sign in to FSM first.');
    const result=await apiPost('chatSSO',{});
    if(!result?.customToken)throw new Error('FSM server did not return a Team Chat identity. Update the Apps Script deployment.');
    await state.lib.signInWithCustomToken(state.auth,result.customToken);
    const firebaseUser=state.auth.currentUser;
    // Encode the normalized username into a regex-safe, collision-free Firebase UID.
    const expectedUid=uidForFsmUsername(fsmUser.username);
    if(!firebaseUser || firebaseUser.uid!==expectedUid)throw new Error('Chat identity mismatch. Contact the administrator.');
    await startChat(firebaseUser);
  }
  function stopListeners(){
    state.unsubMessages?.();state.unsubMembers?.();state.unsubPresence?.();
    state.unsubMessages=state.unsubMembers=state.unsubPresence=null;
    for(const off of state.unsubPreviews.values())off();
    state.unsubPreviews.clear();
    clearInterval(state.presenceTimer);state.presenceTimer=null;
  }
  function renderContacts(){
    const list=el('fsm-chat-contacts');if(!list||!state.user)return;
    const filter=state.filter.trim().toLowerCase();
    const all=conversations();
    const mk=x=>{
      const active=state.room===x.id,preview=state.preview[x.id];
      const avatar=x.type==='group'?'✦':String(x.name||'?').charAt(0).toUpperCase();
      const presence=x.type==='direct'&&chatPeople().find(p=>roomId(state.user.uid,p.uid)===x.id);
      const online=presence&&isRecentlyActive(presence.uid);
      const title=x.type==='group'?'Group conversation':'Private conversation';
      const label=relativePreview(preview);
      const unread=state.unread[x.id];
      return '<button type="button" class="fsm-chat-contact '+(active?'active':'')+'" data-chat-room="'+escapeHtml(x.id)+'" aria-current="'+(active?'page':'false')+'" title="'+escapeHtml(title)+'">'
        +'<span class="fsm-chat-avatar '+(x.type==='group'?'group':'')+'">'+escapeHtml(avatar)+(online?'<i class="fsm-chat-online" aria-label="Recently active"></i>':'')+'</span>'
        +'<span class="fsm-chat-contact-detail"><strong>'+escapeHtml(x.name)+'</strong><small>'+escapeHtml(label)+'</small></span>'
        +'<span class="fsm-chat-contact-aside"><span class="fsm-chat-contact-time">'+escapeHtml(relativeTime(preview?.createdAt))+'</span>'
        +(unread?'<span class="fsm-chat-count" aria-label="Unread message">1</span>':'')+'</span></button>';
    };
    const group=all.filter(c=>c.type==='group'&&c.name.toLowerCase().includes(filter));
    const direct=all.filter(c=>c.type==='direct'&&c.name.toLowerCase().includes(filter));
    list.innerHTML='<div class="fsm-chat-caption">Group</div>'+group.map(mk).join('')
      +'<div class="fsm-chat-caption fsm-chat-direct-label">People</div>'+direct.map(mk).join('')
      +(!group.length&&!direct.length?'<div class="fsm-chat-no-results">No conversations found</div>':'');
    list.querySelectorAll('[data-chat-room]').forEach(btn=>btn.addEventListener('click',()=>selectRoom(btn.dataset.chatRoom)));
  }
  function formatChatDay(ms){
    const d=new Date(ms),now=new Date();
    if(d.toDateString()===now.toDateString())return 'Today';
    const yesterday=new Date(now);yesterday.setDate(now.getDate()-1);
    return yesterday.toDateString()===d.toDateString()?'Yesterday':d.toLocaleDateString([],{month:'long',day:'numeric',year:'numeric'});
  }
  function renderMessages(){
    const node=el('fsm-chat-messages');if(!node)return;
    const atBottom=node.scrollHeight-node.scrollTop-node.clientHeight<100;
    node.replaceChildren();
    if(!state.messages.length){
      node.innerHTML='<div class="fsm-chat-empty"><span class="fsm-chat-empty-symbol">✉</span><strong>No messages yet</strong><span>Say hello or share an update with the team.</span></div>';
      return;
    }
    let lastDay='';
    for(const msg of state.messages){
      const mine=msg.senderId===state.user?.uid;
      const ms=msg.createdAt?.toMillis?.()||0;
      if(ms){
        const day=formatChatDay(ms);
        if(day!==lastDay){
          const tag=document.createElement('div');tag.className='fsm-chat-day';tag.textContent=day;node.append(tag);lastDay=day;
        }
      }
      const row=document.createElement('div');row.className='fsm-chat-message-row'+(mine?' mine':'');
      const item=document.createElement('div');item.className='fsm-chat-message'+(mine?' mine':'')+(msg.deleted?' deleted':'');
      const by=document.createElement('div');by.className='fsm-chat-byline';by.textContent=mine?'You':msg.senderName||'Teammate';
      const body=document.createElement('div');body.className='fsm-chat-text';
      if(msg.deleted)body.textContent=mine?'You unsent a message':'Message unsent';
      else renderTextWithLinks(body,msg.text);
      const stamp=document.createElement('div');stamp.className='fsm-chat-stamp';
      const dt=ms?new Date(ms):null;
      stamp.textContent=(dt?dt.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}):'Sending…')+(msg.editedAt&&!msg.deleted?' · edited':'');
      item.append(by,body,stamp);
      row.append(item);
      if(!msg.deleted){
        const actions=document.createElement('div');actions.className='fsm-chat-message-actions';
        const trigger=document.createElement('button');trigger.type='button';trigger.className='fsm-chat-message-more';
        trigger.title='Message actions';trigger.setAttribute('aria-label','Message actions');trigger.setAttribute('aria-expanded','false');
        trigger.textContent='⋯';
        const menu=document.createElement('div');menu.className='fsm-chat-message-menu';menu.hidden=true;
        const options=[['Copy','copy'],...(mine?[['Edit','edit'],['Unsend','unsend']]:[])];
        for(const [label,action] of options){
          const btn=document.createElement('button');btn.type='button';btn.textContent=label;
          btn.dataset.action=action;btn.addEventListener('click',event=>{event.stopPropagation();menu.hidden=true;handleMessageAction(action,msg);});
          menu.append(btn);
        }
        trigger.addEventListener('click',event=>{
          event.stopPropagation();
          document.querySelectorAll('.fsm-chat-message-menu').forEach(el=>{if(el!==menu)el.hidden=true;});
          menu.hidden=!menu.hidden;trigger.setAttribute('aria-expanded',String(!menu.hidden));
        });
        actions.append(trigger,menu);row.append(actions);
      }
      node.append(row);
    }
    if(atBottom)node.scrollTop=node.scrollHeight;
  }
  function stopEdit(){
    state.editingId=null;
    const form=el('fsm-chat-compose'),bar=el('fsm-chat-edit-bar');
    if(bar)bar.hidden=true;
    if(form){
      form.querySelector('textarea').value='';
      el('fsm-chat-send').textContent='Send';
    }
  }
  async function handleMessageAction(action,msg){
    if(!state.user||msg.deleted)return;
    const id=msg.id;
    if(action==='copy'){
      try{await navigator.clipboard.writeText(msg.text||'');}
      catch{window.prompt('Copy message text:',msg.text||'');}
      return;
    }
    if(msg.senderId!==state.user.uid)return;
    if(action==='edit'){
      state.editingId=id;
      const input=el('fsm-chat-input');
      input.value=msg.text||'';
      el('fsm-chat-edit-bar').hidden=false;
      el('fsm-chat-send').textContent='Save';
      input.focus();return;
    }
    if(action==='unsend'){
      if(!window.confirm('Unsend this message for everyone in the conversation?'))return;
      try{
        const {doc,updateDoc,serverTimestamp}=state.lib;
        await updateDoc(doc(state.db,'chatRooms',state.room,'messages',id),{
          text:'',deleted:true,deletedBy:state.user.uid,deletedAt:serverTimestamp()
        });
        if(state.editingId===id)stopEdit();
      }catch(err){
        el('fsm-chat-error').textContent='Could not unsend. The updated Firestore security rules may need publishing.';
      }
    }
  }
  function selectRoom(id){
    if(!state.user||!id||!conversations().some(c=>c.id===id))return;
    state.unsubMessages?.();state.room=id;state.messages=[];stopEdit();
    renderContacts();
    const current=conversations().find(c=>c.id===id);
    el('fsm-chat-thread-head').textContent=current.name;
    el('fsm-chat-thread-subtitle').textContent=current.type==='group'
      ?'Engineering group conversation':'Private conversation · '+(isRecentlyActive(chatPeople().find(p=>roomId(state.user.uid,p.uid)===id)?.uid)?'Recently active':'FSM teammate');
    const input=el('fsm-chat-input');
    if(input)input.placeholder=current.type==='group'?'Message the group…':'Message '+current.name+'…';
    renderMessages();
    const {collection,query,orderBy,limit,onSnapshot}=state.lib;
    state.unsubMessages=onSnapshot(query(collection(state.db,'chatRooms',id,'messages'),orderBy('createdAt','desc'),limit(100)),snap=>{
      if(state.room!==id)return;
      state.messages=snap.docs.map(d=>({id:d.id,...d.data()})).reverse();
      renderMessages();if(isOpen())markRead();
    },err=>{
      console.warn('Chat messages listener:',err.code);
      const n=el('fsm-chat-messages');
      if(n)n.innerHTML='<div class="fsm-chat-empty">Unable to load messages. Check Firestore permissions.</div>';
    });
  }
  async function sendMessage(event){
    event.preventDefault();
    if(state.loading||!state.user||!state.member?.active)return;
    const input=el('fsm-chat-input'),text=input.value.trim();
    if(!text||text.length>2000)return;
    const {collection,doc,writeBatch,serverTimestamp,updateDoc}=state.lib;
    state.loading=true;el('fsm-chat-send').disabled=true;
    try{
      if(state.editingId){
        await updateDoc(doc(state.db,'chatRooms',state.room,'messages',state.editingId),{text,editedAt:serverTimestamp()});
        stopEdit();
      }else{
        const ref=doc(collection(state.db,'chatRooms',state.room,'messages'));
        const batch=writeBatch(state.db);
        batch.set(ref,{text,senderId:state.user.uid,senderName:state.member.name||'Teammate',createdAt:serverTimestamp()});
        batch.set(doc(state.db,'chatActivity',state.room),{senderId:state.user.uid,updatedAt:serverTimestamp()});
        await batch.commit();
        // The trusted Apps Script endpoint verifies the stored message, sender
        // and recipients before sending push. This never blocks sending.
        if(window.FSM_CHAT_WEB_PUSH_VAPID_KEY){
          apiPost('chatPush',{roomId:state.room,messageId:ref.id})
            .catch(err=>console.warn('Background notification unavailable:',err.message));
        }
        input.value='';markRead();
      }
      el('fsm-chat-error').textContent='';
    }catch(err){
      el('fsm-chat-error').textContent='Could not save message. Check your connection and published rules.';
      console.warn('Chat send:',err.code);
    }finally{
      state.loading=false;el('fsm-chat-send').disabled=false;input.focus();
    }
  }
  async function startChat(user){
    const {doc,getDoc,setDoc,getIdTokenResult,collection,onSnapshot,query,limit,orderBy}=state.lib;
    const claims=(await getIdTokenResult(user)).claims;
    if(claims.fsm!==true)throw new Error('Team Chat requires a verified FSM login.');
    const profileRef=doc(state.db,'chatMembers',user.uid);
    let self=await getDoc(profileRef);
    if(!self.exists()){
      const name=String(claims.fsm_name||'').trim();
      const username=String(claims.fsm_username||'').trim();
      if(!name||!username)throw new Error('Your FSM identity is missing required fields.');
      await setDoc(profileRef,{name,username,active:true});
      self=await getDoc(profileRef);
    }
    if(!self.exists()||self.data().active!==true){
      gate('Access disabled','Your Team Chat access is disabled. Contact your FSM administrator.');
      return;
    }
    state.user=user;state.member=self.data();
    // A notification click can open the matching conversation directly.
    const requestedRoom=new URL(location.href).searchParams.get('chat');
    if(requestedRoom&&conversations().some(c=>c.id===requestedRoom)){
      state.room=requestedRoom;
      document.querySelector('.tab[data-tab="chat"]')?.click();
      history.replaceState(null,'',location.pathname+location.hash);
    }
    try{state.lastSeen=JSON.parse(localStorage.getItem(seenStorageKey())||'{}');}catch{state.lastSeen={};}
    state.unread={};updateUnread();
    content.innerHTML='<aside class="fsm-chat-sidebar">'
      +'<div class="fsm-chat-sidebar-heading"><h3>Messages</h3><span>FSM Team</span></div>'
      +'<div class="fsm-chat-search-wrap"><span aria-hidden="true">⌕</span><input type="search" id="fsm-chat-search" placeholder="Search people…" autocomplete="off" aria-label="Search conversations"></div>'
      +'<div class="fsm-chat-contacts" id="fsm-chat-contacts" role="navigation" aria-label="Conversations"></div>'
      +'<div class="fsm-chat-sidebar-foot"><span class="fsm-chat-sidebar-status"></span>Connected with your FSM account</div>'
      +'</aside>'
      +'<section class="fsm-chat-thread">'
      +'<header class="fsm-chat-thread-header"><span class="fsm-chat-thread-avatar" aria-hidden="true">✦</span><span class="fsm-chat-thread-title"><strong id="fsm-chat-thread-head"></strong><small id="fsm-chat-thread-subtitle"></small></span>'
      +'<button class="fsm-chat-notify-button" id="fsm-chat-enable-alerts" type="button" title="Enable browser alerts">♧ <span>Enable alerts</span></button></header>'
      +'<div class="fsm-chat-messages" id="fsm-chat-messages" aria-live="polite"></div>'
      +'<div class="fsm-chat-edit-bar" id="fsm-chat-edit-bar" hidden><span>✎ Editing your message</span><button id="fsm-chat-edit-cancel" type="button">Cancel</button></div>'
      +'<form class="fsm-chat-compose" id="fsm-chat-compose">'
      +'<button id="fsm-chat-attach-link" class="fsm-chat-attach-link" type="button" title="Insert a shared link" aria-label="Insert a shared link">🔗</button>'
      +'<textarea id="fsm-chat-input" maxlength="2000" rows="1" placeholder="Write a message…" aria-label="Message" autocomplete="off" required></textarea>'
      +'<button id="fsm-chat-send" class="fsm-chat-send" type="submit">Send</button>'
      +'</form><div id="fsm-chat-error" role="status" class="fsm-chat-error"></div>'
      +'</section>';
    const search=el('fsm-chat-search');
    search.addEventListener('input',()=>{state.filter=search.value;renderContacts();});
    el('fsm-chat-edit-cancel').addEventListener('click',stopEdit);
    el('fsm-chat-attach-link').addEventListener('click',()=>{
      const raw=window.prompt('Paste an HTTPS link to share (Drive, report, or document):');
      if(raw===null)return;
      let link;
      try{link=new URL(raw.trim());if(!['https:','http:'].includes(link.protocol))throw Error('invalid');}
      catch{el('fsm-chat-error').textContent='Only HTTP or HTTPS links are supported.';return;}
      const input=el('fsm-chat-input');
      input.value=(input.value.trim()?input.value.trim()+'\n':'')+link.href;
      input.focus();
    });
    el('fsm-chat-input').addEventListener('keydown',event=>{
      if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){
        event.preventDefault();el('fsm-chat-compose').requestSubmit();
      }
    });
    const alerts=el('fsm-chat-enable-alerts');
    const paintAlerts=()=>{
      const supported='Notification' in window&&window.isSecureContext;
      alerts.disabled=!supported;
      alerts.querySelector('span').textContent=!supported?'Unavailable':state.pushEnabled?'Push on':Notification.permission==='granted'?'Alerts on':Notification.permission==='denied'?'Blocked in browser':'Enable alerts';
    };
    alerts.addEventListener('click',async()=>{
      if(!('Notification' in window)||!window.isSecureContext)return;
      try{
        const permission=await Notification.requestPermission();
        if(permission==='granted'&&window.FSM_CHAT_WEB_PUSH_VAPID_KEY){
          const enabled=await registerPushDevice();
          if(!enabled)el('fsm-chat-error').textContent='Web push is unavailable on this device. In-app alerts still work.';
        }
      }catch(err){
        console.warn('Push registration failed:',err.code||err.message);
        el('fsm-chat-error').textContent='Browser alerts enabled, but background push could not be registered.';
      }
      paintAlerts();
    });
    paintAlerts();
    el('fsm-chat-compose').addEventListener('submit',sendMessage);
    state.unsubMembers=onSnapshot(collection(state.db,'chatMembers'),snap=>{
      state.profiles=snap.docs.map(d=>({uid:d.id,...d.data()})).filter(p=>/^fsm_[A-Za-z0-9_-]+$/.test(p.uid));
      const me=state.profiles.find(p=>p.uid===user.uid);
      if(!me||me.active!==true){
        stopListeners();gate('Chat access disabled','Contact your FSM administrator.');return;
      }
      state.member=me;syncRoomPreviews();
    },err=>console.warn('Team directory listener:',err.code));
    selectRoom(state.room);
    state.unsubPresence=onSnapshot(collection(state.db,'chatPresence'),snap=>{
      state.presence={};
      for(const entry of snap.docs)state.presence[entry.id]=entry.data().lastSeen;
      renderContacts();
    },err=>console.warn('Presence listener:',err.code));
    syncPresence();
    state.presenceTimer=setInterval(syncPresence,90000);
    // Restore previously granted FCM permission when this device reconnects.
    if('Notification' in window && Notification.permission==='granted' && window.FSM_CHAT_WEB_PUSH_VAPID_KEY){
      registerPushDevice().then(enabled=>{
        if(enabled){
          const button=el('fsm-chat-enable-alerts');
          if(button?.querySelector('span'))button.querySelector('span').textContent='Push on';
        }
      }).catch(err=>console.warn('Chat push re-registration unavailable:',err.code||err.message));
    }

  }
  window.fsmChatSignOut=async()=>{stopListeners();void unregisterPushDevice().catch(()=>{});state.user=null;state.member=null;state.profiles=[];state.lastSeen={};state.preview={};state.unread={};updateUnread();if(state.auth&&state.lib)await state.lib.signOut(state.auth);};
  // Firebase Chat signs out with the existing FSM logout button. No second sign-out UI.
  document.querySelector('.tab[data-tab="chat"]')?.addEventListener('click',()=>{if(state.user)markRead();launcher.click();});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')syncPresence();});
  navigator.serviceWorker?.addEventListener('message',event=>{
    if(event.data?.type!=='FSM_CHAT_OPEN'||!state.user)return;
    const room=event.data.roomId;
    if(conversations().some(c=>c.id===room)){
      document.querySelector('.tab[data-tab="chat"]')?.click();
      selectRoom(room);
    }
  });
  document.addEventListener('click',event=>{
    if(!event.target.closest('.fsm-chat-message-actions')){
      document.querySelectorAll('.fsm-chat-message-menu').forEach(menu=>menu.hidden=true);
    }
  });
  launcher.addEventListener('click',async()=>{
    if(state.user||state.booting)return;
    state.booting=true;
    try{
      gate('Connecting to Team Chat','Verifying your existing FSM session…');
      await loadSdk();
      await connectFromFSM();
    }catch(err){
      const message=err?.message||'Check your connection, backend deployment, or chat permissions.';
      gate('Team Chat connection failed',message);
    }finally{
      state.booting=false;
    }
  });

})();
